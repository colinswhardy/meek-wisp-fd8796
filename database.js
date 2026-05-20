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
    // Use the official, rate-friendly v2 Open Food Facts API URL
    const url = `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`;
    
    try {
      console.log(`[Database] Querying barcode: ${cleanBarcode}...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ColinsChartsMacros - Web - Version 1.0 - https://aurafit.app'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API returned HTTP status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Open Food Facts API returns status = 1 when the product is found
      if (data.status !== 1 || !data.product) {
        throw new Error("Product not found in the database.");
      }
      
      const product = data.product;
      const nutriments = product.nutriments || {};
      
      // Format response cleanly with scaled defaults per 100g
      return {
        barcode: cleanBarcode,
        name: product.product_name || product.product_name_en || product.product_name_es || "Unknown Item",
        brand: product.brands ? product.brands.split(',')[0].trim() : "Generic Brand",
        nutrients: {
          // Calories can be stored under energy-kcal_100g
          calories: Math.round(Number(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0)),
          protein: parseFloat(Number(nutriments['proteins_100g'] || nutriments['proteins'] || 0).toFixed(1)),
          carbs: parseFloat(Number(nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0).toFixed(1)),
          fats: parseFloat(Number(nutriments['fat_100g'] || nutriments['fat'] || 0).toFixed(1))
        }
      };
    } catch (error) {
      console.warn(`[Database] Error fetching barcode: ${error.message}`);
      throw error;
    }
  }
};
