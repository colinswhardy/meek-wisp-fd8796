/**
 * ColinsChartsMacros - Global Shared Utilities
 * Centralizes calculations for calories, TDEE/BMR, and least-squares regression.
 */
(function() {
  const AppUtils = {
    /**
     * Calculates net carbohydrates.
     * @param {number} carbs 
     * @param {number} fiber 
     * @returns {number}
     */
    netCarbs(carbs, fiber) {
      return Math.max(0, (parseFloat(carbs) || 0) - (parseFloat(fiber) || 0));
    },

    /**
     * Calculates total calories using standard macronutrient values.
     * @param {number} protein 
     * @param {number} carbs 
     * @param {number} fats 
     * @param {number} fiber 
     * @returns {number}
     */
    calculateCalories(protein, carbs, fats, fiber) {
      const p = parseFloat(protein) || 0;
      const f = parseFloat(fats) || 0;
      const net = this.netCarbs(carbs, fiber);
      return Math.round(p * 4 + net * 4 + f * 9);
    },

    /**
     * Calculates TDEE (Total Daily Energy Expenditure) using the Mifflin-St Jeor equation.
     * @param {string} sex 
     * @param {number} age 
     * @param {number} weightKg 
     * @param {number} heightCm 
     * @param {string} activity 
     * @returns {number}
     */
    calculateTDEE(sex, age, weightKg, heightCm, activity) {
      const w = parseFloat(weightKg) || 70;
      const h = parseFloat(heightCm) || 170;
      const a = parseFloat(age) || 30;

      const bmr = (sex === "female")
        ? (10 * w + 6.25 * h - 5 * a - 161)
        : (10 * w + 6.25 * h - 5 * a + 5);

      const activityMultipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very: 1.725,
        extra: 1.9
      };
      
      const factor = activityMultipliers[activity] || 1.2;
      return bmr * factor;
    },

    /**
     * Calculates the slope and intercept for a least-squares linear regression line.
     * @param {Array} points Array of { x, y } coordinates.
     * @returns {Object} { slope, intercept }
     */
    calculateLinearRegression(points) {
      if (!points || points.length < 2) {
        return { slope: 0, intercept: 0 };
      }

      const n = points.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;

      for (let i = 0; i < n; i++) {
        const p = points[i];
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumX2 += p.x * p.x;
      }

      const denominator = n * sumX2 - sumX * sumX;
      if (denominator === 0) {
        return { slope: 0, intercept: 0 };
      }

      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / n;

      return { slope, intercept };
    }
  };

  // Expose globally on the window
  window.AppUtils = AppUtils;
})();
