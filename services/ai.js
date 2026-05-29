/**
 * ColinsChartsMacros - AI Fallback Estimator Service
 * Handles client-side direct Google Gemini API requests.
 */

export const AIEstimatorService = {
  /**
   * Queries Gemini to estimate macronutrients for a given search query.
   * Leverages direct developer key.
   * @param {string} foodQuery Food name search string
   * @returns {Promise<Object>} Formatted nutrition data
   */
  async estimateMacros(foodQuery) {
    if (!foodQuery || !foodQuery.trim()) {
      throw new Error("Query is empty.");
    }

    const settings = window.AppState.data.settings;
    const directKey = settings.geminiApiKey;

    if (!directKey || !directKey.trim()) {
      throw new Error("Gemini API Key is missing. Please enter your Gemini API Key in Settings (under App Options) to enable AI macro estimations.");
    }

    console.log(`[AIEstimator] Routing query directly to Gemini REST API for: "${foodQuery}"`);
    return this.estimateMacrosDirect(foodQuery.trim(), directKey.trim());
  },

  /**
   * Directly queries the Gemini REST API using the user's direct developer API key.
   * @param {string} foodQuery Food search query
   * @param {string} apiKey Direct Gemini Developer API key
   * @returns {Promise<Object>} Formatted nutrition data
   */
  async estimateMacrosDirect(foodQuery, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Act as an expert clinical dietitian and nutritional database compiler. Estimate the macronutrient content per 100g serving for the food query: "${foodQuery}". Provide estimates based on standard USDA nutrient averages.`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generation_config: {
        response_mime_type: "application/json",
        response_schema: {
          type: "object",
          properties: {
            food_name: {
              type: "string",
              description: "Standardized descriptive name of the food item, capitalized."
            },
            estimated_calories: {
              type: "integer",
              description: "Total estimated energy in kcal per 100g serving."
            },
            protein_g: {
              type: "integer",
              description: "Estimated protein in grams per 100g serving, rounded to the nearest integer."
            },
            carbs_g: {
              type: "integer",
              description: "Estimated total carbohydrates in grams per 100g serving, rounded to the nearest integer."
            },
            fat_g: {
              type: "integer",
              description: "Estimated total fat in grams per 100g serving, rounded to the nearest integer."
            }
          },
          required: ["food_name", "estimated_calories", "protein_g", "carbs_g", "fat_g"]
        }
      }
    };

    // 1. Timeout Abort Controller (cancels query after 10 seconds to prevent infinite loaders)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId); // Clear timeout since fetch completed

      // 2. Capture HTTP Error States & Provide Actionable Technical Feedback
      if (!response.ok) {
        const errorText = await response.text();
        let parsedError;
        try { parsedError = JSON.parse(errorText); } catch (_) {}
        
        const apiMsg = parsedError?.error?.message || "";
        
        if (response.status === 429) {
          throw new Error("Gemini API rate limit exceeded (429). Please wait a moment and try again.");
        }
        if (response.status === 400 && apiMsg.includes("API key")) {
          throw new Error("Invalid Gemini API Key (400). Please check your key settings in Settings.");
        }
        if (response.status === 403) {
          throw new Error("Authentication forbidden (403). Make sure your API key is active and has correct project bounds.");
        }
        
        const msg = apiMsg || errorText || `HTTP ${response.status}`;
        throw new Error(`Gemini API returned error [${response.status}]: ${msg}`);
      }

      const result = await response.json();

      // 3. Capture Safety Filter Blocks or Blocked Prompt boundaries
      const promptFeedback = result.promptFeedback;
      if (promptFeedback?.blockReason) {
        throw new Error(`The search query was blocked by Gemini safety filters: ${promptFeedback.blockReason}`);
      }

      const candidate = result.candidates?.[0];
      if (candidate?.finishReason === "SAFETY") {
        throw new Error("The nutritional estimation was blocked by content safety filters. Please try another query.");
      }
      if (candidate?.finishReason === "RECITATION") {
        throw new Error("Content generation stopped due to recitation restrictions. Please rephrase your food query.");
      }

      const text = candidate?.content?.parts?.[0]?.text;
      if (!text || !text.trim()) {
        throw new Error("No candidates or content parts returned by Gemini. Please try a different query.");
      }

      console.log("[AIEstimator] Received raw response from direct Gemini API:", text);
      
      // 4. Capture JSON Schema Parse Failures Defensively
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.warn("[AIEstimator] Failed to parse JSON text, attempting regex extraction fallback:", text);
        // Fallback regex parsers to recover raw numeric tokens if JSON wrapping has slight parsing variations
        const calMatch = text.match(/"estimated_calories"\s*:\s*(\d+)/i);
        const protMatch = text.match(/"protein_g"\s*:\s*(\d+)/i);
        const carbMatch = text.match(/"carbs_g"\s*:\s*(\d+)/i);
        const fatMatch = text.match(/"fat_g"\s*:\s*(\d+)/i);
        const nameMatch = text.match(/"food_name"\s*:\s*"([^"]+)"/i);

        if (calMatch && protMatch && carbMatch && fatMatch) {
          data = {
            food_name: nameMatch ? nameMatch[1] : foodQuery,
            estimated_calories: parseInt(calMatch[1]),
            protein_g: parseInt(protMatch[1]),
            carbs_g: parseInt(carbMatch[1]),
            fat_g: parseInt(fatMatch[1])
          };
        } else {
          throw new Error("Gemini returned invalid or unparseable JSON structure. Please try again.");
        }
      }

      return {
        food_name: data.food_name || foodQuery,
        estimated_calories: Math.round(Number(data.estimated_calories || 0)),
        protein_g: Math.round(Number(data.protein_g || 0)),
        carbs_g: Math.round(Number(data.carbs_g || 0)),
        fat_g: Math.round(Number(data.fat_g || 0))
      };
    } catch (err) {
      clearTimeout(timeoutId); // Ensure cleanup
      if (err.name === "AbortError") {
        throw new Error("Estimation timed out (10s limit). Check your internet connection and try again.");
      }
      console.error("[AIEstimator] Direct Gemini API estimation failed:", err);
      throw new Error(`AI estimation failed: ${err.message}`);
    }
  }
};
