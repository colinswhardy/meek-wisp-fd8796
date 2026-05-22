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
    let eatenKcal = 0;
    let eatenProtein = 0;
    let eatenCarbs = 0;
    let eatenFats = 0;

    meals.forEach((meal) => {
      eatenKcal += meal.calories || 0;
      eatenProtein += meal.protein || 0;
      eatenCarbs += meal.carbs || 0;
      eatenFats += meal.fats || 0;
    });

    const targetCalories = Number(goals.calories) || 2000;
    const targetProtein = Number(goals.protein) || 150;
    const targetCarbs = Number(goals.carbs) || 250;
    const targetFats = Number(goals.fats) || 65;

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
    }

    // Macro Progress Bars
    this.updateMacroRow("protein", eatenProtein, targetProtein);
    this.updateMacroRow("carbs", eatenCarbs, targetCarbs);
    this.updateMacroRow("fats", eatenFats, targetFats);
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
    }
  }
};
