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
  }
};
