/**
 * ColinsChartsMacros - Open Food Facts API Integration
 * Handles barcode metadata searches and nutrient extraction.
 */

window.FoodDatabase = {
  /**
   * Fetches product information by barcode from Open Food Facts API v2.
   * @param {string} barcode Barcode EAN/UPC digit sequence
   * @returns {Promise<Object>} Formatted product details
   */
  async lookupBarcode(barcode) {
    if (!barcode) throw new Error("Barcode is empty.");
    
    const cleanBarcode = barcode.trim();
    
    // 1. Try Open Food Facts
    try {
      console.log(`[Database] Querying Open Food Facts for barcode: ${cleanBarcode}...`);
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`, {
        headers: {
          'User-Agent': 'ColinsChartsMacros - Web - Version 1.0 - https://aurafit.app'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 1 && data.product) {
          const product = data.product;
          const nutriments = product.nutriments || {};
          console.log(`[Database] Found in Open Food Facts: ${product.product_name || "Unknown"}`);
          return {
            barcode: cleanBarcode,
            name: product.product_name || product.product_name_en || product.product_name_es || "Unknown Item",
            brand: product.brands ? product.brands.split(',')[0].trim() : "Generic Brand",
            servingSize: product.serving_size || null,
            servingQuantity: product.serving_quantity ? parseFloat(product.serving_quantity) : null,
            nutrients: {
              calories: Math.round(Number(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0)),
              protein: parseFloat(Number(nutriments['proteins_100g'] || nutriments['proteins'] || 0).toFixed(1)),
              carbs: parseFloat(Number(nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0).toFixed(1)),
              fats: parseFloat(Number(nutriments['fat_100g'] || nutriments['fat'] || 0).toFixed(1)),
              fiber: parseFloat(Number(nutriments['fiber_100g'] || nutriments['fiber'] || 0).toFixed(1))
            }
          };
        }
      }
    } catch (e) {
      console.warn(`[Database] Open Food Facts lookup failed:`, e);
    }

    // 2. Try USDA FoodData Central
    try {
      console.log(`[Database] Querying USDA FoodData Central for barcode: ${cleanBarcode}...`);
      const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${cleanBarcode}&api_key=DEMO_KEY`;
      const response = await fetch(usdaUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.foods && data.foods.length > 0) {
          const fdcFood = data.foods[0];
          console.log(`[Database] Found in USDA FoodData Central: ${fdcFood.description}`);
          
          const nutrients = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
          if (fdcFood.foodNutrients) {
            fdcFood.foodNutrients.forEach(n => {
              const nameLower = n.nutrientName.toLowerCase();
              if (nameLower.includes("energy") && (n.unitName === "KCAL" || nameLower.includes("kcal"))) {
                nutrients.calories = Math.round(n.value);
              } else if (nameLower === "protein") {
                nutrients.protein = parseFloat(Number(n.value).toFixed(1));
              } else if (nameLower.includes("carbohydrate")) {
                nutrients.carbs = parseFloat(Number(n.value).toFixed(1));
              } else if (nameLower.includes("lipid") || nameLower === "fat") {
                nutrients.fats = parseFloat(Number(n.value).toFixed(1));
              } else if (nameLower.includes("fiber")) {
                nutrients.fiber = parseFloat(Number(n.value).toFixed(1));
              }
            });
          }
          
          const servingSize = fdcFood.householdServingFullText || (fdcFood.servingSize ? `${fdcFood.servingSize} ${fdcFood.servingSizeUnit || 'g'}` : null);
          const servingQuantity = fdcFood.servingSize ? parseFloat(fdcFood.servingSize) : null;
          
          return {
            barcode: cleanBarcode,
            name: fdcFood.description || "Unknown Item",
            brand: fdcFood.brandOwner || "Generic Brand",
            servingSize: servingSize,
            servingQuantity: servingQuantity,
            nutrients: nutrients
          };
        }
      }
    } catch (e) {
      console.warn(`[Database] USDA lookup failed:`, e);
    }

    // 3. Try UPCitemdb Trial API
    try {
      console.log(`[Database] Querying UPCitemdb for barcode: ${cleanBarcode}...`);
      const upcUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`;
      const response = await fetch(upcUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.code === "OK" && data.items && data.items.length > 0) {
          const item = data.items[0];
          console.log(`[Database] Found in UPCitemdb: ${item.title}`);
          return {
            barcode: cleanBarcode,
            name: item.title || "Unknown Item",
            brand: item.brand || "Generic Brand",
            needsMacroEntry: true,
            nutrients: { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
          };
        }
      }
    } catch (e) {
      console.warn(`[Database] UPCitemdb lookup failed:`, e);
    }

    // If all fail, throw error so UI displays manual registry
    throw new Error("Product not found in any database.");
  },

  // Local fallback dictionary of common, high-quality generic whole foods
  COMMON_WHOLE_FOODS: [
    {
      name: "Chicken Breast, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["chicken", "breast", "cooked", "poultry", "meat"],
      nutrients: { calories: 165, protein: 31.0, carbs: 0.0, fats: 3.6, fiber: 0.0 }
    },
    {
      name: "Chicken Breast, raw",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["chicken", "breast", "raw", "poultry", "meat"],
      nutrients: { calories: 120, protein: 22.5, carbs: 0.0, fats: 2.6, fiber: 0.0 }
    },
    {
      name: "Whole Egg, cooked / boiled",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["egg", "whole", "boiled", "cooked"],
      nutrients: { calories: 155, protein: 12.6, carbs: 1.1, fats: 10.6, fiber: 0.0 }
    },
    {
      name: "Egg White, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["egg", "white", "whites", "cooked"],
      nutrients: { calories: 52, protein: 10.9, carbs: 0.7, fats: 0.2, fiber: 0.0 }
    },
    {
      name: "Oats / Oatmeal, raw",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["oat", "oats", "oatmeal", "porridge", "raw"],
      nutrients: { calories: 389, protein: 16.9, carbs: 66.3, fats: 6.9, fiber: 10.6 }
    },
    {
      name: "White Rice, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["rice", "white", "cooked"],
      nutrients: { calories: 130, protein: 2.7, carbs: 28.2, fats: 0.3, fiber: 0.4 }
    },
    {
      name: "Brown Rice, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["rice", "brown", "cooked"],
      nutrients: { calories: 111, protein: 2.6, carbs: 23.0, fats: 0.9, fiber: 1.8 }
    },
    {
      name: "Salmon, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["salmon", "fish", "cooked", "seafood"],
      nutrients: { calories: 206, protein: 22.1, carbs: 0.0, fats: 12.3, fiber: 0.0 }
    },
    {
      name: "Greek Yogurt (Nonfat / Plain)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["yogurt", "greek", "plain", "nonfat", "yoghurt"],
      nutrients: { calories: 59, protein: 10.3, carbs: 3.6, fats: 0.4, fiber: 0.0 }
    },
    {
      name: "Beef (Ground, 93% Lean, cooked)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["beef", "ground", "lean", "cooked", "meat"],
      nutrients: { calories: 172, protein: 25.8, carbs: 0.0, fats: 7.6, fiber: 0.0 }
    },
    {
      name: "Banana",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["banana", "bananas", "fruit"],
      nutrients: { calories: 89, protein: 1.1, carbs: 22.8, fats: 0.3, fiber: 2.6 }
    },
    {
      name: "Apple (with skin, raw)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["apple", "apples", "fruit"],
      nutrients: { calories: 52, protein: 0.3, carbs: 13.8, fats: 0.2, fiber: 2.4 }
    },
    {
      name: "Sweet Potato, baked / cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["potato", "sweet", "baked", "cooked", "potatoes"],
      nutrients: { calories: 90, protein: 2.0, carbs: 20.7, fats: 0.2, fiber: 3.0 }
    },
    {
      name: "Broccoli, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["broccoli", "cooked", "vegetable", "green"],
      nutrients: { calories: 35, protein: 2.4, carbs: 7.2, fats: 0.4, fiber: 3.3 }
    },
    {
      name: "Avocado",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["avocado", "avocados"],
      nutrients: { calories: 160, protein: 2.0, carbs: 8.5, fats: 14.7, fiber: 6.7 }
    },
    {
      name: "Almonds",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["almond", "almonds", "nuts", "nut"],
      nutrients: { calories: 579, protein: 21.2, carbs: 21.6, fats: 49.9, fiber: 12.5 }
    },
    {
      name: "Peanut Butter",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["peanut", "butter", "peanuts"],
      nutrients: { calories: 588, protein: 25.1, carbs: 20.0, fats: 50.4, fiber: 6.0 }
    },
    {
      name: "Whole Milk (3.25% Fat)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["milk", "whole", "dairy"],
      nutrients: { calories: 61, protein: 3.2, carbs: 4.8, fats: 3.3, fiber: 0.0 }
    },
    {
      name: "Whey Protein Powder (Standard)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["protein", "powder", "whey", "supplement"],
      nutrients: { calories: 400, protein: 80.0, carbs: 6.0, fats: 6.0, fiber: 0.0 }
    }
  ],

  /**
   * Helper function to calculate the Levenshtein distance between two strings.
   * Enables robust client-side typo tolerance.
   */
  levenshteinDistance(str1, str2) {
    const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    return track[str2.length][str1.length];
  },

  /**
   * Computes a similarity score between 0.0 and 1.0 for a query and target string.
   * Handles multi-word substring match and typo-tolerance matches.
   */
  fuzzyScore(query, target) {
    if (!query || !target) return 0;
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    
    // Perfect substring match
    if (t.includes(q)) {
      // Reward matches that start with the query
      return t.startsWith(q) ? 1.0 : 0.9;
    }

    const qWords = q.split(/\s+/).filter(w => w.length > 0);
    const tWords = t.split(/\s+/).filter(w => w.length > 0);
    let matchedWords = 0;
    let totalWordScore = 0;

    qWords.forEach(qw => {
      let bestWordScore = 0;
      tWords.forEach(tw => {
        if (tw.includes(qw)) {
          bestWordScore = Math.max(bestWordScore, qw.length / tw.length);
        } else if (qw.length > 2 && tw.length > 2) {
          // Typo tolerance via Levenshtein distance
          const dist = this.levenshteinDistance(qw, tw);
          const maxLen = Math.max(qw.length, tw.length);
          if (dist <= 2) { // Allow up to 2 character edits
            bestWordScore = Math.max(bestWordScore, (maxLen - dist) / maxLen * 0.85);
          }
        }
      });
      if (bestWordScore > 0) {
        matchedWords++;
        totalWordScore += bestWordScore;
      }
    });

    if (qWords.length === 0) return 0;
    // Overlap percentage multiplied by average similarity
    return (matchedWords / qWords.length) * (totalWordScore / qWords.length);
  },

  /**
   * Queries the configured Typesense cluster for matching products.
   * @param {string} query Search keyword
   * @returns {Promise<Array>} Normalized product hits
   */
  async queryTypesense(query) {
    const config = AppState.data.settings.typesenseConfig;
    if (!config || !config.enabled || !config.host) return [];

    const host = config.host.trim();
    const port = config.port || 443;
    const protocol = config.protocol || "https";
    const apiKey = config.apiKey ? config.apiKey.trim() : "";
    const collection = config.collection ? config.collection.trim() : "foods";

    const url = `${protocol}://${host}:${port}/collections/${collection}/documents/search?q=${encodeURIComponent(query)}&query_by=name,brand,keywords&prefix=true&typo_tolerance=2&prioritize_exact_match=true`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-TYPESENSE-API-KEY": apiKey,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Typesense request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const hits = data.hits || [];

    return hits.map(hit => {
      const doc = hit.document || {};
      const rawNutrients = doc.nutrients || {};
      const nutrients = {
        calories: Math.round(Number(doc.calories !== undefined ? doc.calories : (rawNutrients.calories || doc.energy_kcal || doc.energy || 0))),
        protein: parseFloat(Number(doc.protein !== undefined ? doc.protein : (rawNutrients.protein || doc.proteins || 0)).toFixed(1)),
        carbs: parseFloat(Number(doc.carbs !== undefined ? doc.carbs : (rawNutrients.carbs || doc.carbohydrates || 0)).toFixed(1)),
        fats: parseFloat(Number(doc.fats !== undefined ? doc.fats : (rawNutrients.fats || doc.fat || 0)).toFixed(1)),
        fiber: parseFloat(Number(doc.fiber !== undefined ? doc.fiber : (rawNutrients.fiber || doc.fiber || 0)).toFixed(1))
      };

      return {
        name: doc.name || doc.product_name || doc.description || "Unknown Item",
        brand: doc.brand || doc.brands || doc.brand_owner || "Generic Brand",
        source: "Typesense",
        servingSize: doc.serving_size || doc.servingSize || null,
        servingQuantity: doc.serving_quantity ? parseFloat(doc.serving_quantity) : (doc.servingQuantity ? parseFloat(doc.servingQuantity) : null),
        nutrients: nutrients
      };
    });
  },

  /**
   * Keyword search across Typesense, Local Fallback Database, USDA FoodData Central and Open Food Facts.
   * Returns an array of normalized food objects sorted by relevance.
   * @param {string} query  Free-text food name, e.g. "cooked chicken breast"
   * @returns {Promise<Array>} Array of { name, brand, source, nutrients: {calories, protein, carbs, fats, fiber} }
   */
  async searchFoods(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const qWords = q.replace(/[^a-z0-9 ]/g, "").split(" ").filter(w => w.length > 0);
    const results = [];
    const seenKeys = new Set();

    const addResult = (item) => {
      const key = `${item.name.toLowerCase()}||${item.brand.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(item);
      }
    };

    // --- Direct Typesense Sync Routing ---
    const tsConfig = AppState.data.settings.typesenseConfig;
    if (tsConfig && tsConfig.enabled && tsConfig.host) {
      try {
        console.log(`[Database] Routing query to Typesense: "${q}"...`);
        const tsResults = await this.queryTypesense(q);
        if (tsResults && tsResults.length > 0) {
          // If Typesense successfully finds matches, return them as absolute truth
          return tsResults;
        }
      } catch (err) {
        console.warn("[Database] Typesense search failed. Falling back to default APIs:", err);
      }
    }

    // --- Fallback Pipeline: Local Fuzzy + USDA + OFF ---

    // 1. Search Local Fallback Dictionary (Fuzzy match)
    this.COMMON_WHOLE_FOODS.forEach(food => {
      const score = this.fuzzyScore(q, food.name);
      if (score > 0.28) { // Similarity threshold
        addResult({
          name: food.name,
          brand: food.brand,
          source: food.source,
          nutrients: { ...food.nutrients },
          fuzzyScore: score
        });
      }
    });

    // 2. USDA FoodData Central — excellent for whole/generic foods
    try {
      const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query.trim())}&api_key=DEMO_KEY&pageSize=20&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`;
      const resp = await fetch(usdaUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.foods && data.foods.length > 0) {
          data.foods.forEach(food => {
            const nutrients = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
            if (food.foodNutrients) {
              food.foodNutrients.forEach(n => {
                const nameLower = (n.nutrientName || "").toLowerCase();
                const val = n.value || 0;
                if (nameLower.includes("energy") && (n.unitName === "KCAL" || nameLower.includes("kcal"))) {
                  nutrients.calories = Math.round(val);
                } else if (nameLower === "protein") {
                  nutrients.protein = parseFloat(Number(val).toFixed(1));
                } else if (nameLower.includes("carbohydrate")) {
                  nutrients.carbs = parseFloat(Number(val).toFixed(1));
                } else if (nameLower.includes("lipid") || nameLower === "total lipid (fat)") {
                  nutrients.fats = parseFloat(Number(val).toFixed(1));
                } else if (nameLower.includes("fiber")) {
                  nutrients.fiber = parseFloat(Number(val).toFixed(1));
                }
              });
            }
            if (nutrients.calories > 0 || nutrients.protein > 0) {
              const servingSize = food.householdServingFullText || (food.servingSize ? `${food.servingSize} ${food.servingSizeUnit || 'g'}` : null);
              const servingQuantity = food.servingSize ? parseFloat(food.servingSize) : null;
              addResult({
                name: food.description || "Unknown Item",
                brand: food.brandOwner || food.brandName || "USDA",
                source: "USDA",
                servingSize: servingSize,
                servingQuantity: servingQuantity,
                nutrients
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[Search] USDA search failed:", e);
    }

    // 3. Open Food Facts — great for packaged branded foods
    try {
      const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,brands,nutriments,serving_size,serving_quantity`;
      const resp = await fetch(offUrl, {
        headers: { 'User-Agent': 'ColinsChartsMacros - Web - Version 1.0 - https://aurafit.app' }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.products && data.products.length > 0) {
          data.products.forEach(prod => {
            const name = prod.product_name;
            if (!name || name.trim() === "") return;
            const n = prod.nutriments || {};
            const calories = Math.round(Number(n['energy-kcal_100g'] || n['energy-kcal'] || 0));
            const protein = parseFloat(Number(n['proteins_100g'] || n['proteins'] || 0).toFixed(1));
            const carbs = parseFloat(Number(n['carbohydrates_100g'] || n['carbohydrates'] || 0).toFixed(1));
            const fats = parseFloat(Number(n['fat_100g'] || n['fat'] || 0).toFixed(1));
            const fiber = parseFloat(Number(n['fiber_100g'] || n['fiber'] || 0).toFixed(1));
            const servingSize = prod.serving_size || null;
            const servingQuantity = prod.serving_quantity ? parseFloat(prod.serving_quantity) : null;
            if (calories > 0 || protein > 0) {
              addResult({
                name: name.trim(),
                brand: prod.brands ? prod.brands.split(',')[0].trim() : "Open Food Facts",
                source: "OFF",
                servingSize: servingSize,
                servingQuantity: servingQuantity,
                nutrients: { calories, protein, carbs, fats, fiber }
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[Search] Open Food Facts search failed:", e);
    }

    // 4. Implement Smart Relevance Scoring & Sorting
    const scoreResult = (item) => {
      const name = (item.name || "").toLowerCase();
      const brand = (item.brand || "").toLowerCase();
      
      let score = 0;
      
      // Compute fuzzy baseline (0.0 to 1.0) and map to significant scale
      const baseFuzzy = item.fuzzyScore || this.fuzzyScore(q, name);
      score += baseFuzzy * 1200;
      
      // Local DB items get absolute priority
      if (item.source === "Local DB") {
        score += 8000;
      }
      
      // Exact full match (case insensitive)
      if (name === q) {
        score += 2000;
      }
      
      // Prefix string match
      const qNormalized = q.replace(/[^a-z0-9 ]/g, "");
      const nameNormalized = name.replace(/[^a-z0-9 ]/g, "");
      if (nameNormalized.startsWith(qNormalized)) {
        score += 500;
      }
      
      // Prioritize generic whole foods
      const isGenericBrand = brand === "usda" || brand === "generic brand" || brand === "generic" || brand === "open food facts" || brand === "generic whole food";
      if (isGenericBrand) {
        score += 300;
      }
      
      if (item.source === "USDA" && isGenericBrand) {
        score += 200;
      }
      
      // Length penalty (favor shorter, cleaner names)
      score -= name.length * 0.7;
      
      return score;
    };

    results.sort((a, b) => scoreResult(b) - scoreResult(a));

    return results;
  }
};
