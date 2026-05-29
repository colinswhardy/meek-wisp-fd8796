/**
 * ColinsChartsMacros - Open Food Facts API Integration
 * Handles barcode metadata searches and nutrient extraction.
 */

window.FoodDatabase = {
  db: null,
  localCache: [],
  onlineSearchCache: {},

  getUsdaApiKey() {
    const configKey = AppState.data.settings.usdaApiKey;
    return (configKey && configKey.trim()) ? configKey.trim() : "DEMO_KEY";
  },

  parseUsdaNutrients(foodNutrients) {
    const nutrients = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
    if (foodNutrients && Array.isArray(foodNutrients)) {
      foodNutrients.forEach(n => {
        const nameLower = (n.nutrientName || "").toLowerCase();
        const val = n.value || 0;
        if (nameLower.includes("energy") && ((n.unitName || "").toUpperCase() === "KCAL" || nameLower.includes("kcal"))) {
          nutrients.calories = Math.round(val);
        } else if (nameLower === "protein") {
          nutrients.protein = parseFloat(Number(val).toFixed(1));
        } else if (nameLower.includes("carbohydrate")) {
          nutrients.carbs = parseFloat(Number(val).toFixed(1));
        } else if (nameLower.includes("lipid") || nameLower === "fat" || nameLower === "total fat" || nameLower === "total lipid (fat)") {
          nutrients.fats = parseFloat(Number(val).toFixed(1));
        } else if (nameLower.includes("fiber")) {
          nutrients.fiber = parseFloat(Number(val).toFixed(1));
        }
      });
    }
    return nutrients;
  },

  /**
   * Normalizes a local cached food object to ensure it has a nutrients structure.
   */
  normalizeLocalFood(item) {
    if (!item) return item;
    if (!item.nutrients) {
      item.nutrients = {
        calories: item.calories !== undefined ? item.calories : 0,
        protein: item.protein !== undefined ? item.protein : 0,
        carbs: item.carbs !== undefined ? item.carbs : 0,
        fats: item.fats !== undefined ? item.fats : 0,
        fiber: item.fiber !== undefined ? item.fiber : 0
      };
    }
    return item;
  },

  /**
   * Initializes the IndexedDB database for food cache and loads records into memory.
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("colins_food_cache_db", 1);
      
      request.onerror = (e) => {
        console.error("[LocalDB] Failed to open IndexedDB database:", e);
        reject(e);
      };
      
      request.onsuccess = (e) => {
        this.db = e.target.result;
        console.log("[LocalDB] IndexedDB opened successfully.");
        this.loadLocalCache().then(resolve).catch(reject);
      };
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("cached_foods")) {
          db.createObjectStore("cached_foods", { keyPath: "food_id" });
          console.log("[LocalDB] Object store 'cached_foods' created.");
        }
      };
    });
  },

  /**
   * Loads all cached foods from IndexedDB into memory for synchronous queries.
   */
  async loadLocalCache() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      const transaction = this.db.transaction("cached_foods", "readonly");
      const store = transaction.objectStore("cached_foods");
      const request = store.getAll();
      
      request.onsuccess = () => {
        const list = request.result || [];
        this.localCache = list.map(item => this.normalizeLocalFood(item));
        console.log(`[LocalDB] Loaded ${this.localCache.length} foods into in-memory cache.`);
        
        // Trigger auto-seeding if it has never been completed
        if (!localStorage.getItem("colins_food_cache_seeded")) {
          this.seedFromHistory().then(resolve).catch(reject);
        } else {
          resolve();
        }
      };
      
      request.onerror = (e) => {
        console.error("[LocalDB] Failed to load cached foods:", e);
        reject(e);
      };
    });
  },

  /**
   * Crawls meals history and custom barcodes to populate IndexedDB with existing records.
   */
  async seedFromHistory() {
    console.log("[LocalDB] Seeding local cache from existing user logging history...");
    const tempCache = {};
    
    // 1. Gather all logged meals across dates
    if (AppState.data && AppState.data.meals) {
      Object.keys(AppState.data.meals).forEach(dateISO => {
        const meals = AppState.data.meals[dateISO] || [];
        meals.forEach(meal => {
          const name = meal.name || "Unknown";
          const brand = meal.brand || "Generic";
          const key = (name + "||" + brand).toLowerCase();
          
          const mealTime = AppState.getMealTimestamp(meal) || new Date(dateISO + "T12:00:00").getTime();
          const weight = Number(meal.weight) || 100;
          const scale = weight > 0 ? (100 / weight) : 1;
          
          if (!tempCache[key]) {
            tempCache[key] = {
              food_id: key,
              name: name,
              brand: brand,
              calories: Math.round(Number(meal.calories || 0) * scale),
              protein: parseFloat((Number(meal.protein || 0) * scale).toFixed(1)),
              carbs: parseFloat((Number(meal.carbs || 0) * scale).toFixed(1)),
              fats: parseFloat((Number(meal.fats || 0) * scale).toFixed(1)),
              fiber: parseFloat((Number(meal.fiber || 0) * scale).toFixed(1)),
              last_logged_at: mealTime,
              log_frequency: 1
            };
            // Set nested macros object to comply with schema requirements
            tempCache[key].macros = {
              protein: tempCache[key].protein,
              carbs: tempCache[key].carbs,
              fats: tempCache[key].fats,
              fiber: tempCache[key].fiber
            };
          } else {
            tempCache[key].log_frequency++;
            if (mealTime > tempCache[key].last_logged_at) {
              tempCache[key].last_logged_at = mealTime;
            }
          }
        });
      });
    }

    // 2. Gather custom barcodes
    if (AppState.data && AppState.data.customBarcodes) {
      Object.keys(AppState.data.customBarcodes).forEach(barcode => {
        const item = AppState.data.customBarcodes[barcode];
        const key = barcode;
        if (!tempCache[key]) {
          const raw = item.nutrients || {};
          tempCache[key] = {
            food_id: key,
            name: item.name || "Unknown",
            brand: item.brand || "Generic Brand",
            calories: Math.round(Number(raw.calories || 0)),
            protein: parseFloat(Number(raw.protein || 0).toFixed(1)),
            carbs: parseFloat(Number(raw.carbs || 0).toFixed(1)),
            fats: parseFloat(Number(raw.fats || 0).toFixed(1)),
            fiber: parseFloat(Number(raw.fiber || 0).toFixed(1)),
            last_logged_at: 0,
            log_frequency: 1,
            servingQuantity: item.servingQuantity || 100,
            servingSize: item.servingSize || null
          };
          tempCache[key].macros = {
            protein: tempCache[key].protein,
            carbs: tempCache[key].carbs,
            fats: tempCache[key].fats,
            fiber: tempCache[key].fiber
          };
        }
      });
    }

    // Write all to IndexedDB
    const list = Object.values(tempCache);
    if (list.length > 0) {
      const transaction = this.db.transaction("cached_foods", "readwrite");
      const store = transaction.objectStore("cached_foods");
      
      for (const food of list) {
        store.put(food);
      }
      
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          localStorage.setItem("colins_food_cache_seeded", "true");
          resolve();
        };
        transaction.onerror = (err) => {
          console.error("[LocalDB] Seed transaction error:", err);
          reject(err);
        };
        transaction.onabort = (err) => {
          console.error("[LocalDB] Seed transaction aborted:", err);
          reject(err);
        };
      });
      console.log(`[LocalDB] Seeding complete! Cached ${list.length} staple foods.`);
    } else {
      localStorage.setItem("colins_food_cache_seeded", "true");
    }
    
    // Reload into memory
    const transaction = this.db.transaction("cached_foods", "readonly");
    const store = transaction.objectStore("cached_foods");
    const request = store.getAll();
    await new Promise((resolve) => {
      request.onsuccess = () => {
        const list = request.result || [];
        this.localCache = list.map(item => this.normalizeLocalFood(item));
        resolve();
      };
    });
  },

  /**
   * Logs or updates a food occurrence in IndexedDB and in-memory cache.
   */
  async logFoodOccurrence(food) {
    if (!food || !food.name) return;
    
    const name = food.name.trim();
    const brand = food.brand || "Generic";
    const baseKey = (name + "||" + brand).toLowerCase();
    const foodId = food.barcode || food.food_id || baseKey;
    
    // Standardize calories and macros to 100g base for the cache
    let calories = Number(food.calories || 0);
    let protein = Number(food.protein || 0);
    let carbs = Number(food.carbs || 0);
    let fats = Number(food.fats || 0);
    let fiber = Number(food.fiber || 0);
    
    if (food.weight && food.weight > 0 && food.weight !== 100) {
      const scale = 100 / food.weight;
      calories = Math.round(calories * scale);
      protein = parseFloat((protein * scale).toFixed(1));
      carbs = parseFloat((carbs * scale).toFixed(1));
      fats = parseFloat((fats * scale).toFixed(1));
      fiber = parseFloat((fiber * scale).toFixed(1));
    }
    
    const time = Date.now();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.warn("[LocalDB] Database not loaded. Skipping log cache.");
        resolve();
        return;
      }
      
      const transaction = this.db.transaction("cached_foods", "readwrite");
      const store = transaction.objectStore("cached_foods");
      const getReq = store.get(foodId);
      
      getReq.onsuccess = () => {
        let record = getReq.result;
        if (record) {
          record.log_frequency = (record.log_frequency || 0) + 1;
          record.last_logged_at = time;
          record.name = name;
          record.brand = brand;
          record.calories = calories;
          record.protein = protein;
          record.carbs = carbs;
          record.fats = fats;
          record.fiber = fiber;
          record.macros = { protein, carbs, fats, fiber };
        } else {
          record = {
            food_id: foodId,
            name: name,
            brand: brand,
            calories: calories,
            protein: protein,
            carbs: carbs,
            fats: fats,
            fiber: fiber,
            macros: { protein, carbs, fats, fiber },
            last_logged_at: time,
            log_frequency: 1
          };
          if (food.servingQuantity) record.servingQuantity = food.servingQuantity;
          if (food.servingSize) record.servingSize = food.servingSize;
        }
        
        const putReq = store.put(record);
        putReq.onsuccess = () => {
          const normalized = this.normalizeLocalFood(record);
          // Update localCache in memory
          const idx = this.localCache.findIndex(item => item.food_id === foodId);
          if (idx !== -1) {
            this.localCache[idx] = normalized;
          } else {
            this.localCache.push(normalized);
          }
          console.log(`[LocalDB] Occurrence logged for food: "${name}" (${brand}) | Freq: ${normalized.log_frequency}`);
          resolve();
        };
        putReq.onerror = (e) => reject(e);
      };
      
      getReq.onerror = (e) => reject(e);
    });
  },

  /**
   * Deletes a food item from the IndexedDB cache and in-memory localCache.
   */
  async removeFoodFromCache(foodId) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.warn("[LocalDB] Database not initialized. Skipping deletion.");
        resolve();
        return;
      }

      const transaction = this.db.transaction("cached_foods", "readwrite");
      const store = transaction.objectStore("cached_foods");
      const request = store.delete(foodId);

      request.onsuccess = () => {
        this.localCache = this.localCache.filter(item => item.food_id !== foodId);
        console.log(`[LocalDB] Successfully removed food item: ${foodId} from cache.`);
        resolve();
      };

      request.onerror = (e) => {
        console.error("[LocalDB] Failed to delete food item from cache:", e);
        reject(e);
      };
    });
  },


  /**
   * Synchronously queries the in-memory local cache.
   */
  searchLocalCache(query) {
    if (!query || !query.trim()) return [];
    
    const q = query.trim().toLowerCase();
    
    const results = this.localCache.filter(item => {
      const name = (item.name || "").toLowerCase();
      const brand = (item.brand || "").toLowerCase();
      return name.includes(q) || brand.includes(q);
    });

    // Ensure all returned results are normalized with nutrients
    results.forEach(item => this.normalizeLocalFood(item));
    
    // Sort: log_frequency (descending), then last_logged_at (descending)
    return results.sort((a, b) => {
      if (b.log_frequency !== a.log_frequency) {
        return b.log_frequency - a.log_frequency;
      }
      return b.last_logged_at - a.last_logged_at;
    });
  },

  /**
   * Fetches product information by barcode from Open Food Facts API v2.
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
      const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${cleanBarcode}&api_key=${this.getUsdaApiKey()}`;
      const response = await fetch(usdaUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.foods && data.foods.length > 0) {
          const fdcFood = data.foods[0];
          console.log(`[Database] Found in USDA FoodData Central: ${fdcFood.description}`);
          
          const nutrients = this.parseUsdaNutrients(fdcFood.foodNutrients);
          
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
      servingSize: "1 breast (150g)",
      servingQuantity: 150,
      nutrients: { calories: 165, protein: 31.0, carbs: 0.0, fats: 3.6, fiber: 0.0 }
    },
    {
      name: "Chicken Breast, raw",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["chicken", "breast", "raw", "poultry", "meat"],
      servingSize: "1 breast (150g)",
      servingQuantity: 150,
      nutrients: { calories: 120, protein: 22.5, carbs: 0.0, fats: 2.6, fiber: 0.0 }
    },
    {
      name: "Whole Egg, cooked / boiled",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["egg", "whole", "boiled", "cooked"],
      servingSize: "1 egg (50g)",
      servingQuantity: 50,
      nutrients: { calories: 155, protein: 12.6, carbs: 1.1, fats: 10.6, fiber: 0.0 }
    },
    {
      name: "Egg White, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["egg", "white", "whites", "cooked"],
      servingSize: "1 egg white (33g)",
      servingQuantity: 33,
      nutrients: { calories: 52, protein: 10.9, carbs: 0.7, fats: 0.2, fiber: 0.0 }
    },
    {
      name: "Oats / Oatmeal, raw",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["oat", "oats", "oatmeal", "porridge", "raw"],
      servingSize: "1/2 cup (40g)",
      servingQuantity: 40,
      nutrients: { calories: 389, protein: 16.9, carbs: 66.3, fats: 6.9, fiber: 10.6 }
    },
    {
      name: "White Rice, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["rice", "white", "cooked"],
      servingSize: "1 cup (158g)",
      servingQuantity: 158,
      nutrients: { calories: 130, protein: 2.7, carbs: 28.2, fats: 0.3, fiber: 0.4 }
    },
    {
      name: "Brown Rice, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["rice", "brown", "cooked"],
      servingSize: "1 cup (195g)",
      servingQuantity: 195,
      nutrients: { calories: 111, protein: 2.6, carbs: 23.0, fats: 0.9, fiber: 1.8 }
    },
    {
      name: "Salmon, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["salmon", "fish", "cooked", "seafood"],
      servingSize: "1 fillet (150g)",
      servingQuantity: 150,
      nutrients: { calories: 206, protein: 22.1, carbs: 0.0, fats: 12.3, fiber: 0.0 }
    },
    {
      name: "Greek Yogurt (Nonfat / Plain)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["yogurt", "greek", "plain", "nonfat", "yoghurt"],
      servingSize: "1 container (150g)",
      servingQuantity: 150,
      nutrients: { calories: 59, protein: 10.3, carbs: 3.6, fats: 0.4, fiber: 0.0 }
    },
    {
      name: "Beef (Ground, 93% Lean, cooked)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["beef", "ground", "lean", "cooked", "meat"],
      servingSize: "3 oz (85g)",
      servingQuantity: 85,
      nutrients: { calories: 172, protein: 25.8, carbs: 0.0, fats: 7.6, fiber: 0.0 }
    },
    {
      name: "Banana",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["banana", "bananas", "fruit"],
      servingSize: "1 medium banana (118g)",
      servingQuantity: 118,
      nutrients: { calories: 89, protein: 1.1, carbs: 22.8, fats: 0.3, fiber: 2.6 }
    },
    {
      name: "Apple (with skin, raw)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["apple", "apples", "fruit"],
      servingSize: "1 medium apple (182g)",
      servingQuantity: 182,
      nutrients: { calories: 52, protein: 0.3, carbs: 13.8, fats: 0.2, fiber: 2.4 }
    },
    {
      name: "Sweet Potato, baked / cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["potato", "sweet", "baked", "cooked", "potatoes"],
      servingSize: "1 medium potato (150g)",
      servingQuantity: 150,
      nutrients: { calories: 90, protein: 2.0, carbs: 20.7, fats: 0.2, fiber: 3.0 }
    },
    {
      name: "Broccoli, cooked",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["broccoli", "cooked", "vegetable", "green"],
      servingSize: "1 cup (150g)",
      servingQuantity: 150,
      nutrients: { calories: 35, protein: 2.4, carbs: 7.2, fats: 0.4, fiber: 3.3 }
    },
    {
      name: "Avocado",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["avocado", "avocados"],
      servingSize: "1 avocado (150g)",
      servingQuantity: 150,
      nutrients: { calories: 160, protein: 2.0, carbs: 8.5, fats: 14.7, fiber: 6.7 }
    },
    {
      name: "Almonds",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["almond", "almonds", "nuts", "nut"],
      servingSize: "1 oz (28g)",
      servingQuantity: 28,
      nutrients: { calories: 579, protein: 21.2, carbs: 21.6, fats: 49.9, fiber: 12.5 }
    },
    {
      name: "Peanut Butter",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["peanut", "butter", "peanuts"],
      servingSize: "2 tbsp (32g)",
      servingQuantity: 32,
      nutrients: { calories: 588, protein: 25.1, carbs: 20.0, fats: 50.4, fiber: 6.0 }
    },
    {
      name: "Whole Milk (3.25% Fat)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["milk", "whole", "dairy"],
      servingSize: "1 cup (244g)",
      servingQuantity: 244,
      nutrients: { calories: 61, protein: 3.2, carbs: 4.8, fats: 3.3, fiber: 0.0 }
    },
    {
      name: "Whey Protein Powder (Standard)",
      brand: "Generic Whole Food",
      source: "Local DB",
      keywords: ["protein", "powder", "whey", "supplement"],
      servingSize: "1 scoop (30g)",
      servingQuantity: 30,
      nutrients: { calories: 400, protein: 80.0, carbs: 6.0, fats: 6.0, fiber: 0.0 }
    }
  ],

  /**
   * Helper function to calculate the Levenshtein distance between two strings.
   * Enables robust client-side typo tolerance.
   */
  levenshteinDistance(str1, str2, maxDistance = 2) {
    if (Math.abs(str1.length - str2.length) > maxDistance) {
      return maxDistance + 1; // Early exit based on length difference
    }

    let len1 = str1.length;
    let len2 = str2.length;

    // Ensure len1 >= len2 to minimize space
    if (len1 < len2) {
      const tempStr = str1; str1 = str2; str2 = tempStr;
      const tempLen = len1; len1 = len2; len2 = tempLen;
    }

    let prevRow = Array(len2 + 1);
    let currRow = Array(len2 + 1);

    for (let i = 0; i <= len2; i++) {
      prevRow[i] = i;
    }

    for (let i = 1; i <= len1; i++) {
      currRow[0] = i;
      let minVal = currRow[0];

      for (let j = 1; j <= len2; j++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        currRow[j] = Math.min(
          currRow[j - 1] + 1,        // Insertion
          prevRow[j] + 1,            // Deletion
          prevRow[j - 1] + indicator // Substitution
        );
        minVal = Math.min(minVal, currRow[j]);
      }

      // Early termination check
      if (minVal > maxDistance) {
        return maxDistance + 1;
      }

      // Swap rows
      const temp = prevRow;
      prevRow = currRow;
      currRow = temp;
    }

    return prevRow[len2];
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
   * @param {AbortSignal} abortSignal Signal to cancel pending fetches
   * @returns {Promise<Array>} Normalized product hits
   */
  /**
   * Queries the configured Algolia index for matching products.
   * @param {string} query Search keyword
   * @param {AbortSignal} abortSignal Signal to cancel pending fetches
   * @returns {Promise<Array>} Normalized product hits
   */
  async queryAlgolia(query, abortSignal) {
    const config = AppState.data.settings.algoliaConfig;
    if (!config || !config.enabled || !config.appId || !config.apiKey) return [];

    const appId = config.appId.trim();
    const apiKey = config.apiKey.trim();
    const indexName = config.indexName ? config.indexName.trim() : "foods";

    const url = `https://${appId}-dsn.algolia.net/1/indexes/${indexName}/query`;

    try {
      const response = await fetch(url, {
        method: "POST",
        signal: abortSignal,
        headers: {
          "X-Algolia-Application-Id": appId,
          "X-Algolia-API-Key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          query: query,
          hitsPerPage: 20
        })
      });

      if (!response.ok) {
        throw new Error(`Algolia request failed with status: ${response.status}`);
      }

      const data = await response.json();
      const hits = data.hits || [];

      return hits.map(hit => {
        const rawNutrients = hit.nutrients || {};
        const protein = parseFloat(Number(hit.protein !== undefined ? hit.protein : (rawNutrients.protein || hit.proteins || 0)).toFixed(1));
        const carbs = parseFloat(Number(hit.carbs !== undefined ? hit.carbs : (rawNutrients.carbs || hit.carbohydrates || 0)).toFixed(1));
        const fats = parseFloat(Number(hit.fats !== undefined ? hit.fats : (rawNutrients.fats || hit.fat || 0)).toFixed(1));
        const fiber = parseFloat(Number(hit.fiber !== undefined ? hit.fiber : (rawNutrients.fiber || hit.fiber || 0)).toFixed(1));
        const calories = Math.round(Number(hit.calories !== undefined ? hit.calories : (rawNutrients.calories || hit.energy_kcal || hit.energy || 0)));

        const normalizedFood = {
          food_id: hit.objectID || hit.barcode || (hit.name + "||" + (hit.brand || "Generic")).toLowerCase(),
          name: hit.name || hit.product_name || hit.description || "Unknown Item",
          brand: hit.brand || hit.brands || hit.brand_owner || "Generic Brand",
          source: "Algolia",
          servingSize: hit.serving_size || hit.servingSize || null,
          servingQuantity: hit.serving_quantity ? parseFloat(hit.serving_quantity) : (hit.servingQuantity ? parseFloat(hit.servingQuantity) : null),
          nutrients: { calories, protein, carbs, fats, fiber },
          protein: protein,
          carbs: carbs,
          fats: fats,
          fiber: fiber,
          calories: calories
        };
        // Add nested macros to comply with schema requirements
        normalizedFood.macros = { protein, carbs, fats, fiber };
        return normalizedFood;
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[Algolia] Fetch aborted for query: "${query}"`);
        throw err;
      }
      console.warn("[Algolia] Query failed:", err);
      return [];
    }
  },

  /**
   * Keyword search across Algolia, Local Fallback Database, USDA FoodData Central and Open Food Facts.
   * Returns an array of normalized food objects sorted by relevance.
   * @param {string} query  Free-text food name, e.g. "cooked chicken breast"
   * @returns {Promise<Array>} Array of { name, brand, source, nutrients: {calories, protein, carbs, fats, fiber} }
   */
  async searchFoods(query, signal) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();

    // 0. Check in-memory search cache for instant hit
    if (this.onlineSearchCache[q]) {
      console.log(`[Database] Cache hit for search query: "${q}"`);
      return this.onlineSearchCache[q];
    }

    const qWords = q.replace(/[^a-z0-9 ]/g, "").split(" ").filter(w => w.length > 0);
    const results = [];
    const seenKeys = new Set();

    const addResult = (item) => {
      const key = `${item.name.toLowerCase()}||${(item.brand || "Generic").toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(item);
      }
    };

    // --- Direct Algolia Sync Routing ---
    const algoliaConfig = AppState.data.settings.algoliaConfig;
    if (algoliaConfig && algoliaConfig.enabled && algoliaConfig.appId) {
      try {
        console.log(`[Database] Routing query to Algolia: "${q}"...`);
        const algoliaResults = await this.queryAlgolia(q);
        if (algoliaResults && algoliaResults.length > 0) {
          // Cache and return Algolia results as absolute truth
          this.onlineSearchCache[q] = algoliaResults;
          return algoliaResults;
        }
      } catch (err) {
        console.warn("[Database] Algolia search failed. Falling back to default APIs:", err);
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
          servingSize: food.servingSize || null,
          servingQuantity: food.servingQuantity || null,
          nutrients: { ...food.nutrients },
          fuzzyScore: score
        });
      }
    });

    // 2. Setup USDA FoodData Central Fetch Promise (Runs Concurrently)
    const usdaPromise = (async () => {
      try {
        const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query.trim())}&api_key=${this.getUsdaApiKey()}&pageSize=20`;
        const resp = await fetch(usdaUrl, { signal });
        if (resp.ok) {
          const data = await resp.json();
          const usdaFoods = [];
          if (data.foods && data.foods.length > 0) {
            data.foods.forEach(food => {
              const nutrients = this.parseUsdaNutrients(food.foodNutrients);
              if (nutrients.calories > 0 || nutrients.protein > 0) {
                const servingSize = food.householdServingFullText || (food.servingSize ? `${food.servingSize} ${food.servingSizeUnit || 'g'}` : null);
                const servingQuantity = food.servingSize ? parseFloat(food.servingSize) : null;
                usdaFoods.push({
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
          return usdaFoods;
        }
      } catch (e) {
        console.warn("[Search] USDA search failed:", e);
      }
      return [];
    })();

    // 3. Setup Open Food Facts Fetch Promise (Runs Concurrently)
    const offPromise = (async () => {
      try {
        const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,brands,nutriments,serving_size,serving_quantity`;
        const resp = await fetch(offUrl, {
          headers: { 'User-Agent': 'ColinsChartsMacros - Web - Version 1.0 - https://aurafit.app' },
          signal
        });
        if (resp.ok) {
          const data = await resp.json();
          const offFoods = [];
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
                offFoods.push({
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
          return offFoods;
        }
      } catch (e) {
        console.warn("[Search] Open Food Facts search failed:", e);
      }
      return [];
    })();

    // 4. Resolve USDA and OFF Concurrent Requests in Parallel
    const [usdaResults, offResults] = await Promise.all([usdaPromise, offPromise]);
    usdaResults.forEach(addResult);
    offResults.forEach(addResult);

    // 5. Implement Smart Relevance Scoring & Sorting
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

    // Cache sorted results (keep cache size capped at 50 items)
    this.onlineSearchCache[q] = results;
    const cacheKeys = Object.keys(this.onlineSearchCache);
    if (cacheKeys.length > 50) {
      delete this.onlineSearchCache[cacheKeys[0]];
    }

    return results;
  }

};
