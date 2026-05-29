/**
 * ColinsChartsMacros - Dashboard View Controller
 * Manages macro summaries, calorie remaining mathematics, and calorie rings.
 */

window.DashboardController = {
  init() {
    const wtAnalyticsCard = document.getElementById("dashboard-weight-analytics");
    if (wtAnalyticsCard) {
      wtAnalyticsCard.addEventListener("click", () => {
        appRouter.navigate("weight_history_detail");
      });
      wtAnalyticsCard.style.cursor = "pointer";
    }
  },

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
      eatenProtein += Number(meal.protein) || 0;
      eatenCarbs += Number(meal.carbs) || 0;
      eatenFats += Number(meal.fats) || 0;
      eatenFiber += Number(meal.fiber) || 0;
    });

    const eatenNetCarbs = AppUtils.netCarbs(eatenCarbs, eatenFiber);
    const eatenKcal = AppUtils.calculateCalories(eatenProtein, eatenCarbs, eatenFats, eatenFiber);

    const targetProtein = Number(goals.protein) || 150;
    const targetCarbs = Number(goals.carbs) || 250;
    const targetFats = Number(goals.fats) || 65;
    const targetCalories = AppUtils.calculateCalories(targetProtein, targetCarbs, targetFats, 0);

    // Update textual indicators
    const eatenCalEl = document.getElementById("val-calories-eaten");
    if (eatenCalEl) eatenCalEl.textContent = Math.round(eatenKcal).toLocaleString();
    const targetCalEl = document.getElementById("val-calories-target");
    if (targetCalEl) targetCalEl.textContent = targetCalories.toLocaleString();

    const remainingKcal = targetCalories - eatenKcal;
    const remainingEl = document.getElementById("val-calories-remaining");
    if (remainingEl) {
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
    }

    const pctVal = targetCalories > 0 ? Math.round((eatenKcal / targetCalories) * 100) : 0;
    const burnStatusEl = document.getElementById("val-burn-status");
    if (burnStatusEl) burnStatusEl.textContent = `${pctVal}%`;

    // Animate calorie bar
    const calBar = document.getElementById("bar-calories");
    if (calBar) {
      const pct = targetCalories > 0 ? Math.min((eatenKcal / targetCalories) * 100, 100) : 0;
      calBar.style.width = `${pct}%`;
      calBar.style.background = ''; // reset to stylesheet default

      if (targetCalories > 0 && eatenKcal > targetCalories) {
        const overPct = eatenKcal / targetCalories;
        const leewayFactor = 1.05; // 5% overage leeway
        if (overPct > leewayFactor) {
          const overage = overPct - 1.00; // proportional overage fraction
          const redStop = Math.max(0, 100 - (overage * 100));
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
        const leewayFactor = 1.05; // 5% overage leeway
        if (overPct > leewayFactor) {
          const overage = overPct - 1.00; // proportional overage fraction
          const redStop = Math.max(0, 100 - (overage * 100));
          
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
