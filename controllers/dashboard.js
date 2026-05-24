/**
 * ColinsChartsMacros - Dashboard View Controller
 * Manages macro summaries, calorie remaining mathematics, and calorie rings.
 */

window.DashboardController = {
  render() {
    const dateKey = AppState.selectedDateISO;
    const meals = AppState.data.meals[dateKey] || [];
    const goals = AppState.getGoalsForDate(dateKey) || {};

    // Cumulative tallies
    let eatenProtein = 0;
    let eatenCarbs = 0;
    let eatenFats = 0;
    let eatenFiber = 0;

    meals.forEach((meal) => {
      eatenProtein += meal.protein || 0;
      eatenCarbs += meal.carbs || 0;
      eatenFats += meal.fats || 0;
      eatenFiber += meal.fiber || 0;
    });

    const eatenNetCarbs = Math.max(0, eatenCarbs - eatenFiber);
    const eatenKcal = Math.round(eatenProtein * 4 + eatenNetCarbs * 4 + eatenFats * 9);

    const targetProtein = Number(goals.protein) || 150;
    const targetCarbs = Number(goals.carbs) || 250;
    const targetFats = Number(goals.fats) || 65;
    const targetCalories = Math.round(targetProtein * 4 + targetCarbs * 4 + targetFats * 9);

    // Update textual indicators
    document.getElementById("val-calories-eaten").textContent = Math.round(eatenKcal).toLocaleString();
    document.getElementById("val-calories-target").textContent = targetCalories.toLocaleString();

    const remainingKcal = targetCalories - eatenKcal;
    const remainingEl = document.getElementById("val-calories-remaining");
    remainingEl.textContent = Math.abs(Math.round(remainingKcal)).toLocaleString();
    if (remainingKcal < 0) {
      remainingEl.classList.add("color-danger");
      const statLbl = document.getElementById("lbl-calories-remaining");
      if (statLbl) statLbl.textContent = "Surplus";
    } else {
      remainingEl.classList.remove("color-danger");
      const statLbl = document.getElementById("lbl-calories-remaining");
      if (statLbl) statLbl.textContent = "Remaining";
    }

    const pctVal = targetCalories > 0 ? Math.round((eatenKcal / targetCalories) * 100) : 0;
    document.getElementById("val-burn-status").textContent = `${pctVal}%`;

    // Animate calorie bar
    const calBar = document.getElementById("bar-calories");
    if (calBar) {
      const pct = targetCalories > 0 ? Math.min((eatenKcal / targetCalories) * 100, 100) : 0;
      calBar.style.width = `${pct}%`;
      calBar.style.background = ''; // reset to stylesheet default

      if (targetCalories > 0 && eatenKcal > targetCalories) {
        const overPct = eatenKcal / targetCalories;
        const leewayFactor = 1.15;
        if (overPct > leewayFactor) {
          const maxRedPct = 1.50; // fully red at 150% of target
          const fraction = (overPct - leewayFactor) / (maxRedPct - leewayFactor);
          const redStop = Math.max(0, Math.min(100, 100 - fraction * 100));
          const transitionWidth = 15;
          const redStart = Math.min(100, redStop + transitionWidth);
          calBar.style.background = `linear-gradient(90deg, #1d4ed8 0%, #60a5fa ${redStop}%, var(--color-danger) ${redStart}%)`;
        }
      }
    }

    // Macro Progress Bars
    this.updateMacroRow("protein", eatenProtein, targetProtein);
    this.updateMacroRow("carbs", eatenNetCarbs, targetCarbs);
    this.updateMacroRow("fats", eatenFats, targetFats);

    // Update Weight Analytics on Dashboard
    if (window.WeightDetailController) {
      window.WeightDetailController.renderDashboardStats();
    }
  },

  updateMacroRow(macroName, eaten, target) {
    const eatenEl = document.getElementById(`val-${macroName}-eaten`);
    const targetEl = document.getElementById(`val-${macroName}-target`);
    const barEl = document.getElementById(`bar-${macroName}`);

    if (eatenEl) eatenEl.textContent = Math.round(eaten);
    if (targetEl) targetEl.textContent = Math.round(target);
    
    if (barEl) {
      const pct = target > 0 ? Math.min((eaten / target) * 100, 100) : 0;
      barEl.style.width = `${pct}%`;
      barEl.style.background = ''; // reset to stylesheet default

      if (target > 0 && eaten > target) {
        const overPct = eaten / target;
        const leewayFactor = 1.15;
        if (overPct > leewayFactor) {
          const maxRedPct = 1.50; // fully red at 150% of target
          const fraction = (overPct - leewayFactor) / (maxRedPct - leewayFactor);
          const redStop = Math.max(0, Math.min(100, 100 - fraction * 100));
          
          let startColor, brandColor;
          if (macroName === 'protein') {
            startColor = '#1d4ed8';
            brandColor = 'var(--color-protein)';
          } else if (macroName === 'carbs') {
            startColor = '#94a3b8';
            brandColor = 'var(--color-carbs)';
          } else if (macroName === 'fats') {
            startColor = '#1e3a8a';
            brandColor = 'var(--color-fats)';
          }

          if (startColor && brandColor) {
            const transitionWidth = 15;
            const redStart = Math.min(100, redStop + transitionWidth);
            barEl.style.background = `linear-gradient(90deg, ${startColor} 0%, ${brandColor} ${redStop}%, var(--color-danger) ${redStart}%)`;
          }
        }
      }
    }
  }
};
