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
   * Keyword search across Local Fallback Database, USDA FoodData Central and Open Food Facts.
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

    // 1. Search Local Fallback Dictionary
    this.COMMON_WHOLE_FOODS.forEach(food => {
      const foodNameLower = food.name.toLowerCase();
      let matchCount = 0;
      
      qWords.forEach(word => {
        if (food.keywords.includes(word) || foodNameLower.includes(word)) {
          matchCount++;
        }
      });

      // If all words in the query match, add it
      if (qWords.length > 0 && matchCount >= qWords.length) {
        addResult({
          name: food.name,
          brand: food.brand,
          source: food.source,
          nutrients: { ...food.nutrients }
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
            // Only include items that have at least some calorie data
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
      
      // Local DB items get absolute priority
      if (item.source === "Local DB") {
        return 10000;
      }
      
      // Exact full match (case insensitive)
      if (name === q) {
        score += 2000;
      }
      
      const qNormalized = q.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
      const nameNormalized = name.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
      
      // Exact phrase match
      if (nameNormalized.includes(qNormalized)) {
        score += 800;
        
        // Starts with the phrase
        if (nameNormalized.startsWith(qNormalized)) {
          score += 400;
        }
      }
      
      // Word match count
      let matchCount = 0;
      qWords.forEach(word => {
        if (nameNormalized.split(" ").includes(word)) {
          matchCount++;
        }
      });
      
      if (matchCount > 0) {
        score += (matchCount / qWords.length) * 500;
      }
      
      // Prioritize generic whole foods
      const isGenericBrand = brand === "usda" || brand === "generic brand" || brand === "generic" || brand === "open food facts" || brand === "generic whole food";
      if (isGenericBrand) {
        score += 300;
      }
      
      // USDA source boost (USDA legacy/foundation data has extremely high quality nutrition info for whole foods)
      if (item.source === "USDA" && isGenericBrand) {
        score += 200;
      }
      
      // Length penalty (favor shorter, cleaner names)
      score -= name.length * 0.8;
      
      return score;
    };

    results.sort((a, b) => scoreResult(b) - scoreResult(a));

    return results;
  }
};
