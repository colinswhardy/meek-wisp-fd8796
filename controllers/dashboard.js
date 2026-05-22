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
      const statLbl = remainingEl.parentElement.querySelector(".stat-lbl");
      if (statLbl) statLbl.textContent = "Surplus";
    } else {
      remainingEl.classList.remove("color-danger");
      const statLbl = remainingEl.parentElement.querySelector(".stat-lbl");
      if (statLbl) statLbl.textContent = "Remaining";
    }

    const pctVal = targetCalories > 0 ? Math.round((eatenKcal / targetCalories) * 100) : 0;
    document.getElementById("val-burn-status").textContent = `${pctVal}%`;

    // Animate circular progress ring
    const ring = document.getElementById("calorie-progress-ring");
    if (ring) {
      const strokeDash = 251.2; // 2 * PI * r (40)
      let offset = strokeDash;
      
      if (targetCalories > 0) {
        const clampedPct = Math.min(eatenKcal / targetCalories, 1.0);
        offset = strokeDash - (strokeDash * clampedPct);
      }
      ring.style.strokeDashoffset = offset;
    }

    // Show/hide high calorie day re-feed badge with silver-gray formatting
    let badgeEl = document.getElementById("refeed-badge");
    if (!badgeEl) {
      badgeEl = document.createElement("div");
      badgeEl.id = "refeed-badge";
      badgeEl.className = "refeed-badge";
      const container = document.querySelector(".circular-progress-container");
      if (container) {
        container.parentNode.insertBefore(badgeEl, container.nextSibling);
      }
    }
    
    if (goals.isHighCalorieDay && badgeEl) {
      const text = goals.surplusType === "percent" 
        ? `${goals.surplusValue}% re-feed day` 
        : `${goals.surplusValue} kcal re-feed day`;
      badgeEl.textContent = text;
      badgeEl.classList.remove("hidden");
    } else if (badgeEl) {
      badgeEl.classList.add("hidden");
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
