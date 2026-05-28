/**
 * ColinsChartsMacros - AI Fallback Estimator Service
 * Handles client-side direct Google Gemini API requests or client-side Firebase Vertex AI estimations.
 */

let firebaseApp = null;
let appCheck = null;
let vertexAI = null;
let generativeModel = null;

export const AIEstimatorService = {
  /**
   * Initializes Firebase, App Check, and Gemini Vertex AI.
   * Caches instances to prevent multiple initializations.
   */
  async ensureInitialized() {
    const config = window.AppState.data.settings.firebaseConfig;
    if (!config || !config.enabled) {
      throw new Error("AI Estimation is not enabled. Please enable it in Settings.");
    }
    if (!config.apiKey || !config.projectId || !config.appId) {
      throw new Error("Firebase is not fully configured. Please fill in the Firebase settings.");
    }

    if (firebaseApp) return; // Already initialized

    try {
      console.log("[AIEstimator] Dynamically importing Firebase client-side SDKs...");
      
      // Dynamic imports of modular CDN packages
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js");
      const { getVertexAI, getGenerativeModel } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-vertex-ai-preview.js");

      // 1. Initialize Firebase App
      const firebaseConfig = {
        apiKey: config.apiKey,
        authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId,
        storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
        messagingSenderId: config.messagingSenderId || "",
        appId: config.appId
      };

      console.log("[AIEstimator] Initializing Firebase App...");
      firebaseApp = initializeApp(firebaseConfig);

      // 2. Setup App Check (Enable Debug Token on localhost)
      if (config.recaptchaKey) {
        const isLocalhost = window.location.hostname === "localhost" || 
                            window.location.hostname === "127.0.0.1" || 
                            window.location.protocol === "file:";
        
        if (isLocalhost) {
          console.log("[AIEstimator] Local domain detected. Registering App Check developer debug provider.");
          self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }

        console.log("[AIEstimator] Initializing Firebase App Check...");
        appCheck = initializeAppCheck(firebaseApp, {
          provider: new ReCaptchaEnterpriseProvider(config.recaptchaKey),
          isTokenAutoRefreshEnabled: true
        });
      } else {
        console.warn("[AIEstimator] reCAPTCHA Site Key is missing. App Check is bypassing production verification.");
      }

      // 3. Initialize Vertex AI
      console.log("[AIEstimator] Initializing Vertex AI in Firebase...");
      vertexAI = getVertexAI(firebaseApp);

      // Define strict JSON Schema for Gemini
      const responseSchema = {
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
      };

      // 4. Instantiate Generative Model with Structured Outputs
      generativeModel = getGenerativeModel(vertexAI, {
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      console.log("[AIEstimator] Vertex AI initialized successfully.");
    } catch (err) {
      firebaseApp = null; // Clear on error so we can retry
      console.error("[AIEstimator] Failed to initialize Firebase Vertex AI:", err);
      throw new Error(`AI Initialization failed: ${err.message}`);
    }
  },

  /**
   * Queries Gemini to estimate macronutrients for a given search query.
   * Leverages direct developer key if configured, otherwise falls back to Firebase Vertex AI.
   * @param {string} foodQuery Food name search string
   * @returns {Promise<Object>} Formatted nutrition data
   */
  async estimateMacros(foodQuery) {
    if (!foodQuery || !foodQuery.trim()) {
      throw new Error("Query is empty.");
    }

    const settings = window.AppState.data.settings;
    const directKey = settings.geminiApiKey;

    if (directKey && directKey.trim()) {
      console.log(`[AIEstimator] Routing query directly to Gemini REST API for: "${foodQuery}"`);
      return this.estimateMacrosDirect(foodQuery.trim(), directKey.trim());
    }

    const fbConfig = settings.firebaseConfig;
    if (!fbConfig || !fbConfig.enabled) {
      throw new Error("AI Estimation is not configured. Please enter a Gemini API Key or enable the Firebase AI Fallback in Settings.");
    }

    await this.ensureInitialized();

    const prompt = `Act as an expert clinical dietitian and nutritional database compiler. Estimate the macronutrient content per 100g serving for the food query: "${foodQuery.trim()}". Provide estimates based on standard USDA nutrient averages.`;
    
    console.log(`[AIEstimator] Estimating macros via Firebase Vertex AI for: "${foodQuery}"...`);
    
    try {
      const result = await generativeModel.generateContent(prompt);
      const text = result.response.text();
      
      console.log("[AIEstimator] Received raw response from Firebase Gemini:", text);
      const data = JSON.parse(text);

      return {
        food_name: data.food_name || foodQuery,
        estimated_calories: Math.round(Number(data.estimated_calories || 0)),
        protein_g: Math.round(Number(data.protein_g || 0)),
        carbs_g: Math.round(Number(data.carbs_g || 0)),
        fat_g: Math.round(Number(data.fat_g || 0))
      };
    } catch (err) {
      console.error("[AIEstimator] Firebase Vertex AI estimation failed:", err);
      throw new Error(`AI estimation failed: ${err.message}`);
    }
  },

  /**
   * Directly queries the Gemini REST API using the user's direct developer API key.
   * @param {string} foodQuery Food search query
   * @param {string} apiKey Direct Gemini Developer API key
   * @returns {Promise<Object>} Formatted nutrition data
   */
  async estimateMacrosDirect(foodQuery, apiKey) {
    // We target the stable gemini-1.5-flash model
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Act as an expert clinical dietitian and nutritional database compiler. Estimate the macronutrient content per 100g serving for the food query: "${foodQuery}". Provide estimates based on standard USDA nutrient averages.`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            food_name: {
              type: "STRING",
              description: "Standardized descriptive name of the food item, capitalized."
            },
            estimated_calories: {
              type: "INTEGER",
              description: "Total estimated energy in kcal per 100g serving."
            },
            protein_g: {
              type: "INTEGER",
              description: "Estimated protein in grams per 100g serving, rounded to the nearest integer."
            },
            carbs_g: {
              type: "INTEGER",
              description: "Estimated total carbohydrates in grams per 100g serving, rounded to the nearest integer."
            },
            fat_g: {
              type: "INTEGER",
              description: "Estimated total fat in grams per 100g serving, rounded to the nearest integer."
            }
          },
          required: ["food_name", "estimated_calories", "protein_g", "carbs_g", "fat_g"]
        }
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError;
        try { parsedError = JSON.parse(errorText); } catch (_) {}
        const msg = parsedError?.error?.message || errorText || `HTTP ${response.status}`;
        throw new Error(`Gemini API returned error: ${msg}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response received from Gemini API.");
      }

      console.log("[AIEstimator] Received raw response from direct Gemini API:", text);
      const data = JSON.parse(text);

      return {
        food_name: data.food_name || foodQuery,
        estimated_calories: Math.round(Number(data.estimated_calories || 0)),
        protein_g: Math.round(Number(data.protein_g || 0)),
        carbs_g: Math.round(Number(data.carbs_g || 0)),
        fat_g: Math.round(Number(data.fat_g || 0))
      };
    } catch (err) {
      console.error("[AIEstimator] Direct Gemini API estimation failed:", err);
      throw new Error(`AI estimation failed: ${err.message}`);
    }
  }
};
