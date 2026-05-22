/**
 * ColinsChartsMacros - Food Logging View Controller
 * Manages daily meal list logs, meal entry deletion, and 7-day historical calorie summaries.
 */

window.FoodController = {
  render() {
    const dateKey = AppState.selectedDateISO;
    const meals = AppState.data.meals[dateKey] || [];
    
    // 1. Render Meals list eaten today
    this.renderMealList(meals);
    
    // 2. Render 7-day calorie history list
    this.renderCalorieHistory();
  },

  renderMealList(meals) {
    const container = document.getElementById("meals-list-container");
    if (!container) return;

    const countBadge = document.getElementById("meals-count-badge");
    if (countBadge) {
      countBadge.textContent = `${meals.length} item${meals.length === 1 ? '' : 's'}`;
    }

    if (meals.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          <p>No food logged for this day yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    // Draw items in reverse chronological log (newest at top)
    [...meals].reverse().forEach((meal) => {
      const item = document.createElement("div");
      item.className = "meal-item";
      item.innerHTML = `
        <div class="meal-info">
          <span class="meal-name">${meal.name}</span>
          <span class="meal-sub">${meal.brand} • ${meal.weight}g</span>
          <div class="meal-macros">
            <span class="m-tag p">P: ${meal.protein}g</span>
            <span class="m-tag c">C: ${meal.carbs}g</span>
            <span class="m-tag f">F: ${meal.fats}g</span>
          </div>
        </div>
        <div class="meal-kcal-block">
          <span class="meal-kcal">${meal.calories} <span style="font-size:0.75rem">kcal</span></span>
          <button class="btn-delete-meal" aria-label="Delete food entry">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      `;

      item.querySelector(".btn-delete-meal").addEventListener("click", () => {
        this.deleteMeal(meal.id);
      });

      container.appendChild(item);
    });
  },

  deleteMeal(mealId) {
    const dateKey = AppState.selectedDateISO;
    let meals = AppState.data.meals[dateKey] || [];
    meals = meals.filter(m => m.id !== mealId);
    
    if (meals.length === 0) {
      delete AppState.data.meals[dateKey];
    } else {
      AppState.data.meals[dateKey] = meals;
    }

    AppState.saveToStorage();
    this.render();
  },

  renderCalorieHistory() {
    const container = document.getElementById("calorie-history-container");
    if (!container) return;

    container.innerHTML = "";

    const today = new Date();
    
    // We will generate the last 7 days (including today) in descending order (Today first)
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateISO = WeightChartManager.formatISODate(d);
      
      const meals = AppState.data.meals[dateISO] || [];
      const goals = AppState.getGoalsForDate(dateISO);
      
      let eatenKcal = 0;
      meals.forEach(m => eatenKcal += m.calories);
      eatenKcal = Math.round(eatenKcal);

      const targetKcal = goals.calories;
      const pct = targetKcal > 0 ? Math.min(Math.round((eatenKcal / targetKcal) * 100), 120) : 0;
      
      let label = "";
      if (i === 0) {
        label = "Today";
      } else if (i === 1) {
        label = "Yesterday";
      } else {
        label = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      }

      const row = document.createElement("div");
      row.className = "history-calorie-row";
      
      let statusClass = "status-normal";
      if (pct > 100) {
        statusClass = "status-over";
      } else if (pct >= 90) {
        statusClass = "status-perfect";
      }

      const barWidth = Math.min(pct, 100);

      row.innerHTML = `
        <div class="history-row-meta">
          <span class="history-row-day">${label}</span>
          <span class="history-row-fraction">
            <strong>${eatenKcal}</strong> / ${targetKcal} kcal
          </span>
        </div>
        <div class="history-row-bar-container">
          <div class="history-row-bar-fill ${statusClass}" style="width: ${barWidth}%"></div>
          <span class="history-row-pct">${pct}%</span>
        </div>
      `;

      container.appendChild(row);
    }
  }
};
