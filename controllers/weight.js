/**
 * ColinsChartsMacros - Weight Tracking View Controller
 * Handles weight logging, active unit updates, Mifflin-St Jeor TDEE recalculations, and regression charting.
 */

window.WeightController = {
  init() {
    document.getElementById("weight-log-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.logWeight();
    });

    // Make the Weight History chart card navigate to the detail view,
    // but show data point info when a specific point is clicked
    const chartCard = document.querySelector("#panel-weight .chart-card");
    if (chartCard) {
      chartCard.addEventListener("click", (e) => {
        // Check if the click landed on a chart data point
        const chart = WeightChartManager.chartInstance;
        if (chart) {
          const elements = chart.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
          if (elements.length > 0) {
            const el = elements[0];
            const datasetIndex = el.datasetIndex;
            // Only show popup for actual weight dataset (index 0), not trendline
            if (datasetIndex === 0) {
              const index = el.index;
              const weight = chart.data.datasets[0].data[index];
              const label = chart.data.labels[index];
              if (weight !== null && weight !== undefined) {
                const unit = AppState.data.settings.unit || "lbs";
                this.showDataPointPopup(e, `${label}: ${Number(weight).toFixed(1)} ${unit}`);
                return; // Don't navigate
              }
            }
          }
        }
        appRouter.navigate("weight_history_detail");
      });
    }
  },

  showDataPointPopup(event, text) {
    // Remove any existing popup
    const existing = document.getElementById("weight-point-popup");
    if (existing) existing.remove();

    const popup = document.createElement("div");
    popup.id = "weight-point-popup";
    popup.textContent = text;
    document.body.appendChild(popup);

    // Position near click
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    popup.style.left = `${event.clientX}px`;
    popup.style.top = `${event.clientY - 50}px`;

    // Auto-remove after 2 seconds
    setTimeout(() => {
      popup.classList.add("fade-out");
      setTimeout(() => popup.remove(), 300);
    }, 2000);
  },

  render() {
    const dateKey = AppState.selectedDateISO;
    const loggedVal = AppState.data.weights[dateKey] || null;
    const unit = AppState.data.settings.unit;

    // Set standard unit label
    const unitLbl = document.getElementById("lbl-weight-unit");
    if (unitLbl) unitLbl.textContent = unit;

    const inputField = document.getElementById("weight-input");
    const statusBox = document.getElementById("today-weight-status-container");
    const statusText = document.getElementById("today-weight-text");

    if (inputField && statusBox && statusText) {
      if (loggedVal !== null) {
        inputField.value = loggedVal.toFixed(1);
        statusBox.classList.add("active");
        statusText.innerHTML = `Logged weight for today: <strong>${loggedVal.toFixed(1)} ${unit}</strong>`;
      } else {
        inputField.value = "";
        statusBox.classList.remove("active");
      }
    }

    // Refresh history chart and calculations
    WeightChartManager.renderChart(AppState.data.weights, dateKey, unit);
  },

  logWeight() {
    const weightRaw = parseFloat(document.getElementById("weight-input").value);
    
    if (isNaN(weightRaw) || weightRaw < 20 || weightRaw > 500) {
      alert("Please log a valid weight measurement (20 to 500).");
      return;
    }

    // Round weight strictly to 1 decimal place
    const cleanedWeight = parseFloat(weightRaw.toFixed(1));
    const dateKey = AppState.selectedDateISO;

    AppState.data.weights[dateKey] = cleanedWeight;
    AppState.saveToStorage();
    
    this.render();
    
    // Silently recalculate daily calorie target based on new weight
    this.silentRecalcAndApply(cleanedWeight);
    
    AppState.showToast("Weight logged & calorie target updated!");
  },

  /**
   * Recalculates TDEE/target calories using the stored profile and the newly-logged weight,
   * then proportionally scales macros and saves. Never redirects or shows an alert.
   */
  silentRecalcAndApply(newWeightInActiveUnit) {
    const profile = AppState.data.profile;
    if (!profile) return;

    const unit = AppState.data.settings.unit;
    const sex = profile.sex || "male";
    const age = parseInt(profile.age) || 30;
    const heightFt = parseFloat(profile.heightFt) || 5;
    const heightIn = parseFloat(profile.heightIn) || 10;
    const activity = profile.activity || "light";
    const targetWeight = parseFloat(profile.targetWeight) || (unit === "lbs" ? 170 : 77);
    const weeklyRate = parseFloat(profile.weeklyRate) || (unit === "lbs" ? 1.0 : 0.5);

    const currentWeightKg = unit === "lbs" ? newWeightInActiveUnit / 2.20462 : newWeightInActiveUnit;
    const targetWeightKg = unit === "lbs" ? targetWeight / 2.20462 : targetWeight;
    const heightCm = (heightFt * 12 + heightIn) * 2.54;

    // BMR via Mifflin-St Jeor
    let bmr = 0;
    if (sex === "male") {
      bmr = (10 * currentWeightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
      bmr = (10 * currentWeightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }

    const activityMultipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
    const tdee = bmr * (activityMultipliers[activity] || 1.2);

    // Calorie adjustment for deficit or surplus
    const weeklyRateLbs = unit === "kg" ? weeklyRate * 2.20462 : weeklyRate;
    const dailyCalorieDelta = weeklyRateLbs * 500;

    let targetCalories = tdee;
    if (targetWeightKg < currentWeightKg) {
      targetCalories = tdee - dailyCalorieDelta;
    } else if (targetWeightKg > currentWeightKg) {
      targetCalories = tdee + dailyCalorieDelta;
    }
    targetCalories = Math.max(Math.round(targetCalories), 500);

    // Proportionally scale macros from old calorie base
    const oldCalories = AppState.data.standardGoals.calories || 2000;
    const scale = oldCalories > 0 ? targetCalories / oldCalories : 1;

    AppState.data.standardGoals.calories = targetCalories;
    AppState.data.standardGoals.protein = Math.max(Math.round((AppState.data.standardGoals.protein || 150) * scale), 10);
    AppState.data.standardGoals.carbs = Math.max(Math.round((AppState.data.standardGoals.carbs || 250) * scale), 10);
    AppState.data.standardGoals.fats = Math.max(Math.round((AppState.data.standardGoals.fats || 65) * scale), 5);

    // Also update today's daily goal override so today reflects the new target immediately
    const dateKey = AppState.selectedDateISO;
    AppState.data.dailyGoals[dateKey] = {
      calories: AppState.data.standardGoals.calories,
      protein: AppState.data.standardGoals.protein,
      carbs: AppState.data.standardGoals.carbs,
      fats: AppState.data.standardGoals.fats
    };

    AppState.saveToStorage();
    console.log(`[Weight] Recalculated calorie target: ${targetCalories} kcal (TDEE: ${Math.round(tdee)})`);
  }
};
