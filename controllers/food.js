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
    const sortedMeals = [...meals].sort((a, b) => {
      const tA = AppState.getMealTimestamp(a) || 0;
      const tB = AppState.getMealTimestamp(b) || 0;
      return tB - tA;
    });

    sortedMeals.forEach((meal) => {
      const timestamp = AppState.getMealTimestamp(meal);
      const timeStr = AppState.formatTimeOfDay(timestamp);
      const timeDisplay = timeStr ? ` • ${timeStr}` : "";

      const item = document.createElement("div");
      item.className = "meal-item";
      item.innerHTML = `
        <div class="meal-info">
          <span class="meal-name">${meal.name}</span>
          <span class="meal-sub">${meal.brand} • ${meal.weight}g${timeDisplay}</span>
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

      let pressTimer = null;
      let isLongPress = false;

      const startPress = (e) => {
        // If it's a right click or clicking the delete button, ignore
        if (e.type === "mousedown" && e.button !== 0) return;
        if (e.target.closest(".btn-delete-meal")) return;

        isLongPress = false;
        item.classList.add("long-pressing");

        pressTimer = setTimeout(() => {
          isLongPress = true;
          item.classList.remove("long-pressing");
          this.showMoveModal(meal);
        }, 600); // 600ms hold time
      };

      const cancelPress = (e) => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        item.classList.remove("long-pressing");
      };

      // Touch hold / Long press event listeners
      item.addEventListener("mousedown", startPress);
      item.addEventListener("touchstart", startPress, { passive: true });

      item.addEventListener("mouseup", cancelPress);
      item.addEventListener("touchend", cancelPress);
      item.addEventListener("touchmove", cancelPress);
      item.addEventListener("touchcancel", cancelPress);
      item.addEventListener("mouseleave", cancelPress);

      // Tap / Click handler
      item.addEventListener("click", (e) => {
        if (isLongPress) {
          isLongPress = false;
          return;
        }
        if (e.target.closest(".btn-delete-meal")) {
          e.stopPropagation();
          this.showDeleteConfirmation(meal);
          return;
        }
        this.showEditModal(meal);
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

    // Re-render dashboard totals in case we are looking at them or navigated
    if (window.DashboardController && typeof window.DashboardController.render === "function") {
      window.DashboardController.render();
    }
  },

  showDeleteConfirmation(meal) {
    const modal = document.getElementById("confirm-delete-modal");
    const nameSpan = document.getElementById("delete-food-name");
    const btnCancel = document.getElementById("btn-cancel-delete");
    const btnConfirm = document.getElementById("btn-confirm-delete");

    if (!modal || !nameSpan || !btnCancel || !btnConfirm) return;

    nameSpan.textContent = `${meal.name} (${meal.weight}g)`;
    modal.classList.remove("hidden");

    const closeModal = () => {
      modal.classList.add("hidden");
      btnCancel.removeEventListener("click", onCancel);
      btnConfirm.removeEventListener("click", onConfirm);
    };

    const onCancel = (e) => {
      e.preventDefault();
      closeModal();
    };

    const onConfirm = (e) => {
      e.preventDefault();
      this.deleteMeal(meal.id);
      closeModal();
      AppState.showToast("Food deleted.");
    };

    btnCancel.addEventListener("click", onCancel);
    btnConfirm.addEventListener("click", onConfirm);
  },

  showMoveModal(meal) {
    const modal = document.getElementById("move-food-modal");
    const nameSpan = document.getElementById("move-food-name");
    const dateInput = document.getElementById("move-food-date-input");
    const btnCancel = document.getElementById("btn-cancel-move");
    const btnConfirm = document.getElementById("btn-confirm-move");

    // Copy / Move Segment controls
    const btnModeCopy = document.getElementById("btn-mode-copy");
    const btnModeMove = document.getElementById("btn-mode-move");
    const promptActionSpan = document.getElementById("copy-move-prompt-action");

    // Quick add controls
    const btnQuickToday = document.getElementById("btn-quick-today");
    const btnQuickTomorrow = document.getElementById("btn-quick-tomorrow");
    const labelToday = document.getElementById("quick-today-date-label");
    const labelTomorrow = document.getElementById("quick-tomorrow-date-label");

    if (!modal || !nameSpan || !dateInput || !btnCancel || !btnConfirm) return;

    // Default mode is Copy
    let activeMode = "copy";

    nameSpan.textContent = `${meal.name} (${meal.weight}g)`;
    dateInput.value = AppState.selectedDateISO;

    // Calculate dates
    const todayISO = AppState.getTodayISODate();
    const todayDateObj = new Date(todayISO + "T12:00:00");
    const todayLabelText = todayDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const tomorrowDateObj = new Date(todayDateObj);
    tomorrowDateObj.setDate(todayDateObj.getDate() + 1);
    const tomorrowISO = `${tomorrowDateObj.getFullYear()}-${String(tomorrowDateObj.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDateObj.getDate()).padStart(2, "0")}`;
    const tomorrowLabelText = tomorrowDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const yesterdayDateObj = new Date(todayDateObj);
    yesterdayDateObj.setDate(todayDateObj.getDate() - 1);
    const yesterdayISO = `${yesterdayDateObj.getFullYear()}-${String(yesterdayDateObj.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDateObj.getDate()).padStart(2, "0")}`;
    const yesterdayLabelText = yesterdayDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    modal.classList.remove("hidden");

    const updateMode = (mode) => {
      activeMode = mode;
      if (activeMode === "copy") {
        if (btnModeCopy) btnModeCopy.classList.add("active");
        if (btnModeMove) btnModeMove.classList.remove("active");
        if (promptActionSpan) promptActionSpan.textContent = "Copy";
        btnConfirm.textContent = "Copy Food";

        // "Copy food" should have "today and tomorrow"
        const strongLeft = btnQuickToday ? btnQuickToday.querySelector("strong") : null;
        if (strongLeft) strongLeft.textContent = "Today";
        if (labelToday) labelToday.textContent = todayLabelText;
      } else {
        if (btnModeCopy) btnModeCopy.classList.remove("active");
        if (btnModeMove) btnModeMove.classList.add("active");
        if (promptActionSpan) promptActionSpan.textContent = "Move";
        btnConfirm.textContent = "Move Food";

        // "Move food" should have "yesterday and tomorrow"
        const strongLeft = btnQuickToday ? btnQuickToday.querySelector("strong") : null;
        if (strongLeft) strongLeft.textContent = "Yesterday";
        if (labelToday) labelToday.textContent = yesterdayLabelText;
      }
    };

    // Set initial toggle state via helper
    updateMode("copy");

    const onModeCopyClick = (e) => {
      e.preventDefault();
      updateMode("copy");
    };

    const onModeMoveClick = (e) => {
      e.preventDefault();
      updateMode("move");
    };

    const performAction = (targetDate) => {
      if (!targetDate) {
        alert("Please select a target date.");
        return;
      }

      const sourceDate = AppState.selectedDateISO;

      if (activeMode === "move") {
        // Remove from source
        let sourceMeals = AppState.data.meals[sourceDate] || [];
        const mealToMove = sourceMeals.find(m => m.id === meal.id);
        if (!mealToMove) {
          closeModal();
          return;
        }

        sourceMeals = sourceMeals.filter(m => m.id !== meal.id);
        if (sourceMeals.length === 0) {
          delete AppState.data.meals[sourceDate];
        } else {
          AppState.data.meals[sourceDate] = sourceMeals;
        }

        // Add to target
        if (!AppState.data.meals[targetDate]) {
          AppState.data.meals[targetDate] = [];
        }
        AppState.data.meals[targetDate].push(mealToMove);

        AppState.saveToStorage();
        closeModal();
        this.render();

        if (window.DashboardController && typeof window.DashboardController.render === "function") {
          window.DashboardController.render();
        }

        AppState.showToast(`Moved to ${targetDate}`);
      } else {
        // Copy mode
        const sourceMeals = AppState.data.meals[sourceDate] || [];
        const mealToCopy = sourceMeals.find(m => m.id === meal.id);
        if (!mealToCopy) {
          closeModal();
          return;
        }

        // Make clone with new unique ID
        const copiedMeal = {
          ...mealToCopy,
          id: "food_copy_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5)
        };

        if (!AppState.data.meals[targetDate]) {
          AppState.data.meals[targetDate] = [];
        }
        AppState.data.meals[targetDate].push(copiedMeal);

        AppState.saveToStorage();
        closeModal();
        this.render();

        if (window.DashboardController && typeof window.DashboardController.render === "function") {
          window.DashboardController.render();
        }

        AppState.showToast(`Copied to ${targetDate}`);
      }
    };

    const onConfirm = (e) => {
      e.preventDefault();
      performAction(dateInput.value);
    };

    const onCancel = (e) => {
      e.preventDefault();
      closeModal();
    };

    const onTodayClick = (e) => {
      e.preventDefault();
      performAction(activeMode === "copy" ? todayISO : yesterdayISO);
    };

    const onTomorrowClick = (e) => {
      e.preventDefault();
      performAction(tomorrowISO);
    };

    const closeModal = () => {
      modal.classList.add("hidden");
      btnCancel.removeEventListener("click", onCancel);
      btnConfirm.removeEventListener("click", onConfirm);
      if (btnModeCopy) btnModeCopy.removeEventListener("click", onModeCopyClick);
      if (btnModeMove) btnModeMove.removeEventListener("click", onModeMoveClick);
      if (btnQuickToday) btnQuickToday.removeEventListener("click", onTodayClick);
      if (btnQuickTomorrow) btnQuickTomorrow.removeEventListener("click", onTomorrowClick);
    };

    btnCancel.addEventListener("click", onCancel);
    btnConfirm.addEventListener("click", onConfirm);
    if (btnModeCopy) btnModeCopy.addEventListener("click", onModeCopyClick);
    if (btnModeMove) btnModeMove.addEventListener("click", onModeMoveClick);
    if (btnQuickToday) btnQuickToday.addEventListener("click", onTodayClick);
    if (btnQuickTomorrow) btnQuickTomorrow.addEventListener("click", onTomorrowClick);
  },

  showEditModal(meal) {
    const modal = document.getElementById("edit-food-modal");
    const form = document.getElementById("edit-food-form");
    const nameInput = document.getElementById("edit-food-name-input");
    const brandInput = document.getElementById("edit-food-brand-input");
    const weightInput = document.getElementById("edit-food-weight-input");
    const caloriesInput = document.getElementById("edit-food-calories-input");
    const proteinInput = document.getElementById("edit-food-protein-input");
    const carbsInput = document.getElementById("edit-food-carbs-input");
    const fatsInput = document.getElementById("edit-food-fats-input");
    const btnCancel = document.getElementById("btn-cancel-edit");
    const btnSave = document.getElementById("btn-save-edit");

    if (!modal || !form || !nameInput || !brandInput || !weightInput || !caloriesInput || 
        !proteinInput || !carbsInput || !fatsInput || !btnCancel || !btnSave) return;

    nameInput.value = meal.name || "";
    brandInput.value = meal.brand || "";
    weightInput.value = meal.weight || 0;
    caloriesInput.value = meal.calories || 0;
    proteinInput.value = meal.protein || 0;
    carbsInput.value = meal.carbs || 0;
    fatsInput.value = meal.fats || 0;

    modal.classList.remove("hidden");

    // Auto-focus the food name input inside edit modal and select text
    setTimeout(() => {
      nameInput.focus();
      try {
        nameInput.select();
      } catch (err) {}
    }, 50);

    const originalWeight = parseFloat(meal.weight) || 0;
    const originalCalories = parseFloat(meal.calories) || 0;
    const originalProtein = parseFloat(meal.protein) || 0;
    const originalCarbs = parseFloat(meal.carbs) || 0;
    const originalFats = parseFloat(meal.fats) || 0;

    const onWeightChange = () => {
      const newWeight = parseFloat(weightInput.value) || 0;
      if (originalWeight > 0 && newWeight > 0) {
        const factor = newWeight / originalWeight;
        caloriesInput.value = Math.round(originalCalories * factor);
        proteinInput.value = parseFloat((originalProtein * factor).toFixed(1));
        carbsInput.value = parseFloat((originalCarbs * factor).toFixed(1));
        fatsInput.value = parseFloat((originalFats * factor).toFixed(1));
      }
    };

    weightInput.addEventListener("input", onWeightChange);

    const onWeightKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSave(e);
      }
    };

    weightInput.addEventListener("keydown", onWeightKeyDown);

    const onFormKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSave(e);
      }
    };

    form.addEventListener("keydown", onFormKeyDown);

    const closeModal = () => {
      modal.classList.add("hidden");
      weightInput.removeEventListener("input", onWeightChange);
      weightInput.removeEventListener("keydown", onWeightKeyDown);
      form.removeEventListener("keydown", onFormKeyDown);
      btnCancel.removeEventListener("click", onCancel);
      btnSave.removeEventListener("click", onSave);
    };

    const onCancel = (e) => {
      e.preventDefault();
      closeModal();
    };

    const onSave = (e) => {
      e.preventDefault();
      const newName = nameInput.value.trim();
      const newWeight = parseFloat(weightInput.value);

      if (!newName) {
        alert("Please enter a valid food name.");
        return;
      }
      if (isNaN(newWeight) || newWeight <= 0) {
        alert("Please enter a valid weight.");
        return;
      }

      const dateKey = AppState.selectedDateISO;
      const meals = AppState.data.meals[dateKey] || [];
      const mealToEdit = meals.find(m => m.id === meal.id);
      
      if (mealToEdit) {
        mealToEdit.name = newName;
        mealToEdit.brand = brandInput.value.trim() || "Generic";
        mealToEdit.weight = newWeight;
        mealToEdit.calories = Math.round(parseFloat(caloriesInput.value) || 0);
        mealToEdit.protein = parseFloat(parseFloat(proteinInput.value).toFixed(1)) || 0;
        mealToEdit.carbs = parseFloat(parseFloat(carbsInput.value).toFixed(1)) || 0;
        mealToEdit.fats = parseFloat(parseFloat(fatsInput.value).toFixed(1)) || 0;

        AppState.saveToStorage();
        AppState.showToast("Food entry updated!");
      }

      closeModal();
      this.render();
      
      if (window.DashboardController && typeof window.DashboardController.render === "function") {
        window.DashboardController.render();
      }
    };

    btnCancel.addEventListener("click", onCancel);
    btnSave.addEventListener("click", onSave);
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
      
      let eatenProtein = 0;
      let eatenCarbs = 0;
      let eatenFats = 0;
      let eatenFiber = 0;

      meals.forEach(m => {
        eatenProtein += Number(m.protein) || 0;
        eatenCarbs += Number(m.carbs) || 0;
        eatenFats += Number(m.fats) || 0;
        eatenFiber += Number(m.fiber) || 0;
      });

      const eatenNetCarbs = Math.max(0, eatenCarbs - eatenFiber);
      const eatenKcal = Math.round(eatenProtein * 4 + eatenNetCarbs * 4 + eatenFats * 9);

      const targetProtein = Number(goals.protein) || 150;
      const targetCarbs = Number(goals.carbs) || 250;
      const targetFats = Number(goals.fats) || 65;
      const targetKcal = Math.round(targetProtein * 4 + targetCarbs * 4 + targetFats * 9);
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
