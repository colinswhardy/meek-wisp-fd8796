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
          <p>No food logged for this day yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    // 1-Hour Block Header Formatter
    const formatHourBlockHeader = (hour) => {
      const startHour = hour;
      const endHour = (hour + 1) % 24;
      
      const formatHour = (h) => {
        if (h === 0) return "12 AM";
        if (h === 12) return "12 PM";
        return h > 12 ? `${h - 12} PM` : `${h} AM`;
      };
      
      return `${formatHour(startHour)} - ${formatHour(endHour)}`;
    };

    // Group meals by 24 hourly buckets (0 to 23)
    const mealsByHour = {};
    for (let h = 0; h < 24; h++) {
      mealsByHour[h] = [];
    }

    meals.forEach((meal) => {
      const timestamp = AppState.getMealTimestamp(meal) || Date.now();
      const hour = new Date(timestamp).getHours();
      mealsByHour[hour].push(meal);
    });

    // Sort meals inside each hour block latest first
    for (let h = 0; h < 24; h++) {
      mealsByHour[h].sort((a, b) => {
        const tA = AppState.getMealTimestamp(a) || 0;
        const tB = AppState.getMealTimestamp(b) || 0;
        return tB - tA;
      });
    }

    // Render 1-hour blocks from 23 (11 PM - 12 AM) down to 0 (12 AM - 1 AM)
    for (let h = 23; h >= 0; h--) {
      const mealsInBlock = mealsByHour[h];
      const blockKcal = mealsInBlock.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
      const blockCount = mealsInBlock.length;
      const isEmpty = blockCount === 0;

      const blockContainer = document.createElement("div");
      blockContainer.className = `hour-block-container${isEmpty ? " is-empty" : ""}`;
      blockContainer.setAttribute("data-hour", h);

      blockContainer.innerHTML = `
        <div class="hour-block-header">
          <div class="hour-block-title-group">
            <svg class="hour-clock-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span class="hour-block-title">${formatHourBlockHeader(h)}</span>
          </div>
          <span class="hour-block-summary">${blockCount} item${blockCount === 1 ? '' : 's'} • ${blockKcal} kcal</span>
        </div>
        <div class="hour-block-meals-list"></div>
        <div class="empty-hour-placeholder">
          <span>Drop here to move to ${formatHourBlockHeader(h)}</span>
        </div>
      `;

      const mealsListContainer = blockContainer.querySelector(".hour-block-meals-list");

      mealsInBlock.forEach((meal) => {
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

        // Modern Unified PointerEvents Drag-and-Drop system
        let pressTimer = null;
        let isDragging = false;
        let wasDragged = false;
        let startX = 0, startY = 0;
        let rect = null;
        let offsetX = 0, offsetY = 0;
        let clone = null;
        let currentDragOverBlock = null;
        let autoScrollInterval = null;
        let lastClientY = 0;

        const handlePointerDown = (e) => {
          if (e.button !== 0 && e.type === "mousedown") return;
          if (e.target.closest(".btn-delete-meal")) return;

          startX = e.clientX;
          startY = e.clientY;
          rect = item.getBoundingClientRect();
          offsetX = e.clientX - rect.left;
          offsetY = e.clientY - rect.top;

          isDragging = false;
          wasDragged = false;
          item.classList.add("long-pressing");

          if (pressTimer) clearTimeout(pressTimer);

          pressTimer = setTimeout(() => {
            isDragging = true;
            item.classList.remove("long-pressing");
            item.classList.add("dragging-original");

            if (navigator.vibrate) navigator.vibrate(50);

            // Activate dragging state visual overlays
            const listContainer = document.getElementById("meals-list-container");
            if (listContainer) {
              listContainer.classList.add("meals-drag-active");
            }
            document.body.classList.add("drag-active-mode");

            // Build floating drag-preview clone
            clone = item.cloneNode(true);
            clone.classList.remove("dragging-original");
            clone.classList.add("meal-item-drag-clone");
            
            Object.assign(clone.style, {
              position: "fixed",
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`
            });
            document.body.appendChild(clone);

            // Bind move and release listeners globally to window
            window.addEventListener("pointermove", handlePointerMove, { passive: false });
            window.addEventListener("pointerup", handlePointerUp);
            window.addEventListener("pointercancel", handlePointerUp);

            startAutoScrollChecking();
          }, 500);

          // Add temporary release listeners locally to handle premature tap cancel
          item.addEventListener("pointerup", handlePointerUpLocal);
          item.addEventListener("pointercancel", handlePointerUpLocal);
        };

        const handlePointerUpLocal = () => {
          cancelPress();
          item.removeEventListener("pointerup", handlePointerUpLocal);
          item.removeEventListener("pointercancel", handlePointerUpLocal);
        };

        const handlePointerMove = (e) => {
          if (!isDragging) {
            if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
              cancelPress();
            }
            return;
          }

          e.preventDefault();
          lastClientY = e.clientY;

          if (clone) {
            clone.style.left = `${e.clientX - offsetX}px`;
            clone.style.top = `${e.clientY - offsetY}px`;
          }

          // Hit testing drop blocks
          const element = document.elementFromPoint(e.clientX, e.clientY);
          const hourBlock = element ? element.closest(".hour-block-container") : null;

          if (hourBlock !== currentDragOverBlock) {
            if (currentDragOverBlock) {
              currentDragOverBlock.classList.remove("drag-over");
            }
            currentDragOverBlock = hourBlock;
            if (currentDragOverBlock) {
              currentDragOverBlock.classList.add("drag-over");
            }
          }
        };

        const handlePointerUp = (e) => {
          cancelPress();

          if (!isDragging) return;
          isDragging = false;
          wasDragged = true;

          stopAutoScrollChecking();

          if (currentDragOverBlock) {
            currentDragOverBlock.classList.remove("drag-over");
            const targetHour = parseInt(currentDragOverBlock.getAttribute("data-hour"));
            const currentTimestamp = AppState.getMealTimestamp(meal) || Date.now();
            const currentDate = new Date(currentTimestamp);
            const currentHour = currentDate.getHours();

            if (currentHour !== targetHour) {
              currentDate.setHours(targetHour);
              meal.loggedAt = currentDate.getTime();

              AppState.saveToStorage();

              if (window.DashboardController && typeof window.DashboardController.render === "function") {
                window.DashboardController.render();
              }
              AppState.showToast(`Moved to ${formatHourBlockHeader(targetHour)}`);
            }
          }

          const listContainer = document.getElementById("meals-list-container");
          if (listContainer) {
            listContainer.classList.remove("meals-drag-active");
          }
          document.body.classList.remove("drag-active-mode");

          if (clone) {
            clone.remove();
            clone = null;
          }

          item.classList.remove("dragging-original");

          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", handlePointerUp);
          window.removeEventListener("pointercancel", handlePointerUp);

          // Force full UI re-render of this page
          window.FoodController.render();
        };

        const cancelPress = () => {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
          item.classList.remove("long-pressing");
        };

        const startAutoScrollChecking = () => {
          if (autoScrollInterval) clearInterval(autoScrollInterval);
          const scrollThreshold = 80;
          const maxScrollSpeed = 15;
          const viewport = document.querySelector(".app-viewport");
          if (!viewport) return;

          autoScrollInterval = setInterval(() => {
            const rect = viewport.getBoundingClientRect();
            if (lastClientY < rect.top + scrollThreshold) {
              const ratio = (rect.top + scrollThreshold - lastClientY) / scrollThreshold;
              viewport.scrollTop -= maxScrollSpeed * Math.min(Math.max(ratio, 0.1), 1);
            } else if (lastClientY > rect.bottom - scrollThreshold) {
              const ratio = (lastClientY - (rect.bottom - scrollThreshold)) / scrollThreshold;
              viewport.scrollTop += maxScrollSpeed * Math.min(Math.max(ratio, 0.1), 1);
            }
          }, 16);
        };

        const stopAutoScrollChecking = () => {
          if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
          }
        };

        // Bind core touch/mouse events to unified PointerEvents
        item.style.touchAction = "none";
        item.addEventListener("pointerdown", handlePointerDown);

        // Click / Tap listener
        item.addEventListener("click", (e) => {
          if (wasDragged) {
            wasDragged = false;
            e.stopPropagation();
            e.preventDefault();
            return;
          }
          if (isDragging) {
            return;
          }
          if (e.target.closest(".btn-delete-meal")) {
            e.stopPropagation();
            this.showDeleteConfirmation(meal);
            return;
          }
          this.showEditModal(meal);
        });

        mealsListContainer.appendChild(item);
      });

      container.appendChild(blockContainer);
    }
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
