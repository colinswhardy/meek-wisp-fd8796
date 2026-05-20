/**
 * ColinsChartsMacros - Open Food Facts API Integration
 * Handles barcode metadata searches and nutrient extraction.
 */

const FoodDatabase = {
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
            nutrients: {
              calories: Math.round(Number(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0)),
              protein: parseFloat(Number(nutriments['proteins_100g'] || nutriments['proteins'] || 0).toFixed(1)),
              carbs: parseFloat(Number(nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0).toFixed(1)),
              fats: parseFloat(Number(nutriments['fat_100g'] || nutriments['fat'] || 0).toFixed(1))
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
          
          const nutrients = { calories: 0, protein: 0, carbs: 0, fats: 0 };
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
              }
            });
          }
          
          return {
            barcode: cleanBarcode,
            name: fdcFood.description || "Unknown Item",
            brand: fdcFood.brandOwner || "Generic Brand",
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
            nutrients: { calories: 0, protein: 0, carbs: 0, fats: 0 }
          };
        }
      }
    } catch (e) {
      console.warn(`[Database] UPCitemdb lookup failed:`, e);
    }

    // If all fail, throw error so UI displays manual registry
    throw new Error("Product not found in any database.");
  },

  /**
   * Keyword search across USDA FoodData Central and Open Food Facts.
   * Returns an array of normalized food objects (per 100g nutrients).
   * @param {string} query  Free-text food name, e.g. "cooked chicken breast"
   * @returns {Promise<Array>} Array of { name, brand, source, nutrients: {calories, protein, carbs, fats} }
   */
  async searchFoods(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim();
    const results = [];
    const seenKeys = new Set();

    const addResult = (item) => {
      const key = `${item.name.toLowerCase()}||${item.brand.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(item);
      }
    };

    // 1. USDA FoodData Central — excellent for whole/generic foods
    try {
      const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=DEMO_KEY&pageSize=20&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`;
      const resp = await fetch(usdaUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.foods && data.foods.length > 0) {
          data.foods.forEach(food => {
            const nutrients = { calories: 0, protein: 0, carbs: 0, fats: 0 };
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
                }
              });
            }
            // Only include items that have at least some calorie data
            if (nutrients.calories > 0 || nutrients.protein > 0) {
              addResult({
                name: food.description || "Unknown Item",
                brand: food.brandOwner || food.brandName || "USDA",
                source: "USDA",
                nutrients
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[Search] USDA search failed:", e);
    }

    // 2. Open Food Facts — great for packaged branded foods
    try {
      const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,brands,nutriments`;
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
            if (calories > 0 || protein > 0) {
              addResult({
                name: name.trim(),
                brand: prod.brands ? prod.brands.split(',')[0].trim() : "Open Food Facts",
                source: "OFF",
                nutrients: { calories, protein, carbs, fats }
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[Search] Open Food Facts search failed:", e);
    }

    return results;
  }
};
