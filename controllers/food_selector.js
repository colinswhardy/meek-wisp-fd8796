/**
 * ColinsChartsMacros - Food Selector View Controller
 * Manages search, lookup tabs (recipes, history, online search), previews, and logs weight/servings adjustments.
 */

window.FoodSelectorController = {
  activeContext: null, // "daily_log" (standard) or "recipe_ingredient"
  selectedFoodItem: null, // current selected item in preview card
  selectedFoodType: null, // "recipe" or "history"
  activeTab: "search", // "recipes", "history", or "search"

  setTabActive(tabName) {
    this.closePreview();
    this.activeTab = tabName;

    const btnRecipes = document.getElementById("btn-tab-recipes");
    const btnHistory = document.getElementById("btn-tab-history");
    const btnTabSearch = document.getElementById("btn-tab-search");

    const tabRecipes = document.getElementById("tab-content-recipes");
    const tabHistory = document.getElementById("tab-content-history");
    const tabSearch = document.getElementById("tab-content-search");

    // Update tab button highlights
    if (btnRecipes) {
      if (tabName === "recipes") btnRecipes.classList.add("active");
      else btnRecipes.classList.remove("active");
    }
    if (btnHistory) {
      if (tabName === "history") btnHistory.classList.add("active");
      else btnHistory.classList.remove("active");
    }
    if (btnTabSearch) {
      if (tabName === "search") btnTabSearch.classList.add("active");
      else btnTabSearch.classList.remove("active");
    }

    // Update tab content visibilities
    if (tabRecipes) {
      if (tabName === "recipes") tabRecipes.classList.remove("hidden");
      else tabRecipes.classList.add("hidden");
    }
    if (tabHistory) {
      if (tabName === "history") tabHistory.classList.remove("hidden");
      else tabHistory.classList.add("hidden");
    }
    if (tabSearch) {
      if (tabName === "search") tabSearch.classList.remove("hidden");
      else tabSearch.classList.add("hidden");
    }

    // Clear online search results if they are empty
    if (tabName === "search") {
      const resultsEl = document.getElementById("online-search-results");
      if (resultsEl && resultsEl.innerHTML === "") {
        resultsEl.innerHTML = `<div class="empty-state"><p>Type a food name above and press Search.</p></div>`;
      }
    }

    this.renderList();
  },

  init() {
    // Bind tab clicks
    const btnRecipes = document.getElementById("btn-tab-recipes");
    const btnHistory = document.getElementById("btn-tab-history");
    const btnTabSearch = document.getElementById("btn-tab-search");

    if (btnRecipes) {
      btnRecipes.addEventListener("click", () => this.setTabActive("recipes"));
    }
    if (btnHistory) {
      btnHistory.addEventListener("click", () => this.setTabActive("history"));
    }
    if (btnTabSearch) {
      btnTabSearch.addEventListener("click", () => this.setTabActive("search"));
    }

    // Search bar filtering (history tab)
    const searchInput = document.getElementById("history-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        this.closePreview();
        this.renderList();
      });
    }

    // Search button click
    const btnOnlineSearch = document.getElementById("btn-online-search");
    if (btnOnlineSearch) {
      btnOnlineSearch.addEventListener("click", () => {
        this.performOnlineSearch();
      });
    }

    // Enter key triggers search
    const onlineSearchInput = document.getElementById("online-search-input");
    if (onlineSearchInput) {
      onlineSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.performOnlineSearch();
        }
      });
    }

    // Close preview button
    const btnClosePreview = document.getElementById("btn-close-selector-preview");
    if (btnClosePreview) {
      btnClosePreview.addEventListener("click", () => {
        this.closePreview();
      });
    }

    // Serving weight scaling input
    const weightInput = document.getElementById("selector-weight-input");
    if (weightInput) {
      weightInput.addEventListener("input", () => {
        this.updateScaledDisplay();
      });
      weightInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.logSelectedFood();
        }
      });
    }

    // Portion unit select dropdown listener
    const portionSelect = document.getElementById("selector-portion-unit");
    if (portionSelect) {
      portionSelect.addEventListener("change", () => {
        const wtUnit = document.getElementById("selector-weight-unit");
        const wtInput = document.getElementById("selector-weight-input");
        const selectedUnit = portionSelect.value;
        
        if (selectedUnit === "serving") {
          if (wtUnit) wtUnit.textContent = "servings";
          if (wtInput) wtInput.value = 1;
        } else if (selectedUnit === "recipe") {
          if (wtUnit) wtUnit.textContent = "x";
          if (wtInput) wtInput.value = 1;
        } else {
          if (wtUnit) wtUnit.textContent = "g";
          if (wtInput) {
            wtInput.value = (this.selectedFoodItem && this.selectedFoodItem.servingQuantity) ? this.selectedFoodItem.servingQuantity : 100;
          }
        }
        
        this.updateScaledDisplay();
      });
    }

    // Log food button click
    const btnLogFood = document.getElementById("btn-log-selector-food");
    if (btnLogFood) {
      btnLogFood.addEventListener("click", () => {
        this.logSelectedFood();
      });
    }

    // Setup selector trigger buttons on Dashboard, Food and Weight tabs
    const btnFoodSelectDash = document.getElementById("btn-food-selector-dashboard");
    if (btnFoodSelectDash) {
      btnFoodSelectDash.addEventListener("click", () => {
        this.openSelector("daily_log");
      });
    }

    const btnFoodSelectFood = document.getElementById("btn-food-selector-food");
    if (btnFoodSelectFood) {
      btnFoodSelectFood.addEventListener("click", () => {
        this.openSelector("daily_log");
      });
    }

    const btnFoodSelectWeight = document.getElementById("btn-food-selector-weight");
    if (btnFoodSelectWeight) {
      btnFoodSelectWeight.addEventListener("click", () => {
        this.openSelector("daily_log");
      });
    }

    // Recipe history lookup button
    const btnRecipeHist = document.getElementById("btn-recipe-history-lookup");
    if (btnRecipeHist) {
      btnRecipeHist.addEventListener("click", () => {
        this.openSelector("recipe_ingredient");
      });
    }

    // Back button routing logic
    const btnBackSelector = document.getElementById("btn-back-food-selector");
    if (btnBackSelector) {
      btnBackSelector.addEventListener("click", () => {
        if (this.activeContext === "recipe_ingredient") {
          appRouter.navigate("add_recipe");
        } else {
          const backTab = this.openedFromTab || "food";
          appRouter.navigate(backTab);
        }
      });
    }

    // Quick Add collapsible toggle button
    const btnQuickAddToggle = document.getElementById("btn-recipes-quick-add");
    const quickAddForm = document.getElementById("recipe-quick-add-form");
    if (btnQuickAddToggle && quickAddForm) {
      btnQuickAddToggle.addEventListener("click", () => {
        const isHidden = quickAddForm.classList.contains("hidden");
        if (isHidden) {
          quickAddForm.classList.remove("hidden");
          btnQuickAddToggle.style.background = "rgba(255,255,255,0.06)";
          
          // Auto-focus the first input (name) of the Quick Add form immediately
          const qaName = document.getElementById("quick-add-name");
          if (qaName) {
            setTimeout(() => {
              qaName.focus();
              try { qaName.select(); } catch (err) {}
            }, 50);
          }
        } else {
          quickAddForm.classList.add("hidden");
          btnQuickAddToggle.style.background = "rgba(255,255,255,0.03)";
        }
      });
    }

    // Live calorie calculator for Quick Add
    const qaProtein = document.getElementById("quick-add-protein");
    const qaCarbs = document.getElementById("quick-add-carbs");
    const qaFats = document.getElementById("quick-add-fats");
    const qaCalInput = document.getElementById("quick-add-calories");
    const qaWeight = document.getElementById("quick-add-weight");

    const updateQuickAddCalories = () => {
      if (!qaProtein || !qaCarbs || !qaFats || !qaCalInput) return;
      const p = parseFloat(qaProtein.value) || 0;
      const c = parseFloat(qaCarbs.value) || 0;
      const f = parseFloat(qaFats.value) || 0;
      const calories = Math.round((p * 4) + (c * 4) + (f * 9));
      qaCalInput.value = calories;
    };

    [qaProtein, qaCarbs, qaFats].forEach(input => {
      if (input) {
        input.addEventListener("input", updateQuickAddCalories);
      }
    });

    // Form submit
    if (quickAddForm) {
      quickAddForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const p = parseFloat(qaProtein.value) || 0;
        const c = parseFloat(qaCarbs.value) || 0;
        const f = parseFloat(qaFats.value) || 0;
        const w = parseFloat(qaWeight.value) || 100;
        const nameVal = document.getElementById("quick-add-name").value.trim() || "Quick Add";
        const calories = Math.round((p * 4) + (c * 4) + (f * 9));

        const newLogItem = {
          id: "quick_add_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          name: nameVal,
          brand: "Quick Add",
          weight: w,
          calories: calories,
          protein: p,
          carbs: c,
          fats: f,
          loggedAt: Date.now()
        };

        const dateKey = AppState.selectedDateISO;
        if (!AppState.data.meals[dateKey]) {
          AppState.data.meals[dateKey] = [];
        }

        AppState.data.meals[dateKey].push(newLogItem);
        AppState.saveToStorage();

        // Reset and collapse form
        quickAddForm.reset();
        if (qaCalInput) qaCalInput.value = "";
        quickAddForm.classList.add("hidden");
        if (btnQuickAddToggle) {
          btnQuickAddToggle.style.background = "rgba(255,255,255,0.03)";
        }

        AppState.showToast("Quick macros added!");
        
        // Refresh views to show the newly added meal instantly
        if (window.FoodController && typeof window.FoodController.render === "function") {
          window.FoodController.render();
        }
        if (window.DashboardController && typeof window.DashboardController.render === "function") {
          window.DashboardController.render();
        }
        
        // Navigate back to the Food tab
        appRouter.navigate("food");
      });
    }
  },

  openSelector(context) {
    this.openedFromTab = AppState.activeTab;
    this.activeContext = context;
    this.closePreview();
    
    // Clear search inputs
    const searchInput = document.getElementById("history-search-input");
    if (searchInput) searchInput.value = "";
    const onlineSearchInput = document.getElementById("online-search-input");
    if (onlineSearchInput) onlineSearchInput.value = "";

    // Reset Quick Add Form
    const quickAddForm = document.getElementById("recipe-quick-add-form");
    if (quickAddForm) {
      quickAddForm.reset();
      quickAddForm.classList.add("hidden");
      const qaCalInput = document.getElementById("quick-add-calories");
      if (qaCalInput) qaCalInput.value = "";
      const btnQuickAddToggle = document.getElementById("btn-recipes-quick-add");
      if (btnQuickAddToggle) {
        btnQuickAddToggle.style.background = "rgba(255,255,255,0.03)";
      }
    }

    const btnRecipes = document.getElementById("btn-tab-recipes");
    const btnHistory = document.getElementById("btn-tab-history");
    const btnTabSearch = document.getElementById("btn-tab-search");

    if (context === "recipe_ingredient") {
      // Hide Recipes tab header entirely (to avoid nested recipes)
      if (btnRecipes) btnRecipes.classList.add("hidden");
    } else {
      // Show Recipes tab header
      if (btnRecipes) btnRecipes.classList.remove("hidden");
    }

    // Always show Search Online and History tabs
    if (btnTabSearch) btnTabSearch.classList.remove("hidden");
    if (btnHistory) btnHistory.classList.remove("hidden");
    
    // Default active tab: Search Online
    this.setTabActive("search");

    // Update back label
    const backLabel = document.getElementById("food-selector-back-label");
    if (backLabel) {
      backLabel.textContent = context === "recipe_ingredient" ? "Back to Recipe" : "Back";
    }

    appRouter.navigate("food_selector");
  },

  render() {
    this.renderList();
  },

  // Dynamic Food History Aggregator
  getFoodHistory() {
    const historyMap = {};
    
    // Walk through all dates and meals
    Object.keys(AppState.data.meals).forEach(dateISO => {
      const meals = AppState.data.meals[dateISO] || [];
      meals.forEach(meal => {
        const key = `${meal.name.trim()}||${meal.brand.trim()}`.toLowerCase();
        
        // Scale nutrients to per 100g base for history standard display
        const scale = meal.weight > 0 ? (100 / meal.weight) : 1;
        const normalized = {
          calories: Math.round(meal.calories * scale),
          protein: parseFloat((meal.protein * scale).toFixed(1)),
          carbs: parseFloat((meal.carbs * scale).toFixed(1)),
          fats: parseFloat((meal.fats * scale).toFixed(1)),
          fiber: parseFloat(((meal.fiber || 0) * scale).toFixed(1))
        };

        const mealTime = AppState.getMealTimestamp(meal) || new Date(dateISO + "T12:00:00").getTime();

        if (!historyMap[key]) {
          historyMap[key] = {
            name: meal.name,
            brand: meal.brand,
            nutrients: normalized,
            count: 0,
            lastLoggedAt: mealTime
          };
          if (meal.servingSize) historyMap[key].servingSize = meal.servingSize;
          if (meal.servingQuantity) historyMap[key].servingQuantity = meal.servingQuantity;
        } else {
          if (mealTime > historyMap[key].lastLoggedAt) {
            historyMap[key].lastLoggedAt = mealTime;
          }
        }
        historyMap[key].count++;
      });
    });

    // Inject custom registered barcodes
    Object.keys(AppState.data.customBarcodes).forEach(barcode => {
      const item = AppState.data.customBarcodes[barcode];
      const key = `${item.name.trim()}||${item.brand.trim()}`.toLowerCase();
      if (!historyMap[key]) {
        historyMap[key] = {
          name: item.name,
          brand: item.brand,
          nutrients: { ...item.nutrients },
          count: 1,
          lastLoggedAt: 0 // lowest priority if never logged
        };
        if (item.servingSize) historyMap[key].servingSize = item.servingSize;
        if (item.servingQuantity) historyMap[key].servingQuantity = item.servingQuantity;
      }
    });

    // Sort by most recently logged descending (newest ones first)
    return Object.values(historyMap).sort((a, b) => b.lastLoggedAt - a.lastLoggedAt);
  },

  renderList() {
    if (this.activeTab === "recipes") {
      this.renderRecipesList();
    } else if (this.activeTab === "search") {
      // Search tab manages its own render via performOnlineSearch(); don't clobber results
    } else {
      this.renderHistoryList();
    }
  },

  renderRecipesList() {
    this.closePreview();
    const container = document.getElementById("selector-recipes-list");
    if (!container) return;

    const recipes = Object.values(AppState.data.recipes || {});
    if (recipes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No saved recipes found. Create one using the "Add Recipe" button at the bottom of the Food tab.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    recipes.forEach(rec => {
      const item = document.createElement("div");
      item.className = "meal-item clickable-selector-item";
      item.style.cursor = "pointer";
      item.innerHTML = `
        <div class="meal-info">
          <span class="meal-name" style="font-weight: 600;">${rec.name}</span>
          <span class="meal-sub">${rec.ingredients.length} ingredients • ${rec.totalWeight.toFixed(0)}g</span>
          <div class="meal-macros">
            <span class="m-tag p">P: ${rec.nutrients.protein}g</span>
            <span class="m-tag c">C: ${rec.nutrients.carbs}g</span>
            <span class="m-tag f">F: ${rec.nutrients.fats}g</span>
          </div>
        </div>
        <div class="meal-kcal-block" style="align-items: flex-end;">
          <span class="meal-kcal" style="font-size: 1.1rem;">${rec.nutrients.calories} <span style="font-size:0.75rem">kcal</span></span>
          <button class="btn-delete-recipe-stored" aria-label="Delete recipe from database" style="background: none; border: none; color: rgba(255,255,255,0.3); padding: 4px; border-radius: 4px; margin-top: 4px;" onclick="event.stopPropagation(); FoodSelectorController.deleteStoredRecipe('${rec.id}')">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      item.addEventListener("click", () => {
        this.selectFoodItem(rec, "recipe", item);
      });

      container.appendChild(item);
    });
  },

  deleteStoredRecipe(id) {
    if (!confirm("Are you sure you want to permanently delete this recipe from your database?")) return;
    delete AppState.data.recipes[id];
    AppState.saveToStorage();
    AppState.showToast("Recipe deleted.");
    this.closePreview();
    this.renderRecipesList();
  },

  renderHistoryList() {
    this.closePreview();
    const container = document.getElementById("selector-history-list");
    if (!container) return;

    const historyItems = this.getFoodHistory();
    const searchVal = document.getElementById("history-search-input").value.toLowerCase().trim();

    const filtered = historyItems.filter(item => {
      return item.name.toLowerCase().includes(searchVal) || item.brand.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No historical foods found matching your search.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    filtered.forEach(food => {
      const item = document.createElement("div");
      item.className = "meal-item clickable-selector-item";
      item.style.cursor = "pointer";
      const lastLoggedStr = food.lastLoggedAt ? ` • Last logged ${AppState.formatLastLogged(food.lastLoggedAt)}` : "";

      item.innerHTML = `
        <div class="meal-info">
          <span class="meal-name" style="font-weight: 600;">${food.name}</span>
          <span class="meal-sub">${food.brand} • per 100g${lastLoggedStr}</span>
          <div class="meal-macros">
            <span class="m-tag p">P: ${food.nutrients.protein}g</span>
            <span class="m-tag c">C: ${food.nutrients.carbs}g</span>
            <span class="m-tag f">F: ${food.nutrients.fats}g</span>
          </div>
        </div>
        <div class="meal-kcal-block">
          <span class="meal-kcal" style="font-size: 1.1rem;">${food.nutrients.calories} <span style="font-size:0.75rem">kcal</span></span>
        </div>
      `;

      item.addEventListener("click", () => {
        this.selectFoodItem(food, "history", item);
      });

      container.appendChild(item);
    });
  },

  selectFoodItem(food, type, clickedEl) {
    const previewCard = document.getElementById("selector-preview-card");
    
    // Toggling: If the clicked item is clicked again and the preview card is already open after it, close it!
    if (this.selectedFoodItem && this.selectedFoodItem === food && previewCard && !previewCard.classList.contains("hidden") && clickedEl && clickedEl.nextSibling === previewCard) {
      this.closePreview();
      return;
    }

    this.selectedFoodItem = food;
    this.selectedFoodType = type;

    // Remove active styling from any other active selector item
    document.querySelectorAll(".clickable-selector-item.selector-active").forEach(el => {
      el.classList.remove("selector-active");
    });

    if (clickedEl) {
      clickedEl.classList.add("selector-active");
    }

    // Populate preview card
    const titleEl = document.getElementById("selector-preview-title");
    const subtitleEl = document.getElementById("selector-preview-subtitle");
    const kcalEl = document.getElementById("selector-preview-kcal");
    const proteinEl = document.getElementById("selector-preview-protein");
    const carbsEl = document.getElementById("selector-preview-carbs");
    const fatsEl = document.getElementById("selector-preview-fats");
    const baseWeightEl = document.getElementById("selector-preview-base-weight");
    const weightLabel = document.getElementById("selector-weight-label");
    const weightUnit = document.getElementById("selector-weight-unit");
    const weightInput = document.getElementById("selector-weight-input");
    const logBtn = document.getElementById("btn-log-selector-food");
    const portionSelect = document.getElementById("selector-portion-unit");

    if (titleEl) titleEl.textContent = food.name;
    if (subtitleEl) subtitleEl.textContent = food.brand || (type === "recipe" ? "Recipe" : "Generic");

    if (portionSelect) {
      portionSelect.innerHTML = "";
      if (type === "recipe") {
        portionSelect.innerHTML = `<option value="recipe">Recipe Multiplier (x)</option>`;
        portionSelect.value = "recipe";
      } else {
        let html = `<option value="g">Grams (g)</option>`;
        if (food.servingSize && food.servingQuantity) {
          html += `<option value="serving">Serving (${food.servingSize})</option>`;
        }
        portionSelect.innerHTML = html;
        portionSelect.value = "g"; // Always default to grams
      }
    }

    if (type === "recipe") {
      if (kcalEl) kcalEl.textContent = food.nutrients.calories;
      if (proteinEl) proteinEl.textContent = food.nutrients.protein;
      if (carbsEl) carbsEl.textContent = food.nutrients.carbs;
      if (fatsEl) fatsEl.textContent = food.nutrients.fats;
      if (baseWeightEl) baseWeightEl.textContent = `Values shown for complete recipe (${food.totalWeight.toFixed(0)}g)`;
      
      if (weightLabel) weightLabel.textContent = "Servings / Multiplier";
      if (weightUnit) weightUnit.textContent = "x";
      if (weightInput) {
        weightInput.value = 1;
        weightInput.step = "0.1";
        weightInput.min = "0.01";
      }
      if (logBtn) logBtn.textContent = this.activeContext === "recipe_ingredient" ? "Add to Recipe" : "Log Recipe Eaten";
    } else {
      if (kcalEl) kcalEl.textContent = food.nutrients.calories;
      if (proteinEl) proteinEl.textContent = food.nutrients.protein;
      if (carbsEl) carbsEl.textContent = food.nutrients.carbs;
      if (fatsEl) fatsEl.textContent = food.nutrients.fats;
      if (baseWeightEl) baseWeightEl.textContent = "Values shown per 100g";
      
      if (weightLabel) weightLabel.textContent = this.activeContext === "recipe_ingredient" ? "Weight Eaten" : "Weight Eaten";
      if (weightUnit) weightUnit.textContent = "g";
      if (weightInput) {
        weightInput.value = food.servingQuantity ? food.servingQuantity : 100;
        weightInput.step = "1";
        weightInput.min = "0.1";
      }
      if (logBtn) logBtn.textContent = this.activeContext === "recipe_ingredient" ? "Add to Recipe" : "Log Eaten";
    }

    this.updateScaledDisplay();

    // Display card inline immediately underneath the clicked element
    if (previewCard && clickedEl) {
      clickedEl.after(previewCard);
      previewCard.classList.remove("hidden");
      
      // Auto-focus and select the weight/servings input box immediately
      if (weightInput) {
        setTimeout(() => {
          weightInput.focus();
          try { weightInput.select(); } catch (err) {}
        }, 50);
      }

      // Instant jump/scroll the clicked element to the top of the screen
      clickedEl.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  },

  updateScaledDisplay() {
    if (!this.selectedFoodItem) return;

    const food = this.selectedFoodItem;
    const type = this.selectedFoodType;
    let inputVal = parseFloat(document.getElementById("selector-weight-input").value);
    if (isNaN(inputVal) || inputVal <= 0) inputVal = 0;

    let factor = 1;
    if (type === "recipe") {
      factor = inputVal; // servings multiplier
    } else {
      const portionSelect = document.getElementById("selector-portion-unit");
      const unit = portionSelect ? portionSelect.value : "g";
      if (unit === "serving" && food.servingQuantity) {
        factor = (inputVal * food.servingQuantity) / 100;
      } else {
        factor = inputVal / 100; // grams weight scale per 100g
      }
    }

    const raw = food.nutrients;
    const p = parseFloat((raw.protein * factor).toFixed(1));
    const c = parseFloat((raw.carbs * factor).toFixed(1));
    const f = parseFloat((raw.fats * factor).toFixed(1));
    const fib = parseFloat(((raw.fiber || 0) * factor).toFixed(1));
    const netC = Math.max(0, c - fib);
    const kcal = Math.round(p * 4 + netC * 4 + f * 9);

    document.getElementById("selector-scaled-kcal").textContent = kcal;
    document.getElementById("selector-scaled-protein").textContent = `${p}g`;
    document.getElementById("selector-scaled-carbs").textContent = `${c}g`;
    document.getElementById("selector-scaled-fats").textContent = `${f}g`;
    const fiberEl = document.getElementById("selector-scaled-fiber");
    if (fiberEl) fiberEl.textContent = `${fib}g`;
  },

  logSelectedFood() {
    if (!this.selectedFoodItem) return;

    const food = this.selectedFoodItem;
    const type = this.selectedFoodType;
    let inputVal = parseFloat(document.getElementById("selector-weight-input").value);

    if (isNaN(inputVal) || inputVal <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    let factor = 1;
    let storedWeight = inputVal;
    if (type === "recipe") {
      factor = inputVal;
      storedWeight = Math.round(food.totalWeight * factor);
    } else {
      const portionSelect = document.getElementById("selector-portion-unit");
      const unit = portionSelect ? portionSelect.value : "g";
      if (unit === "serving" && food.servingQuantity) {
        factor = (inputVal * food.servingQuantity) / 100;
        storedWeight = inputVal * food.servingQuantity;
      } else {
        factor = inputVal / 100;
        storedWeight = inputVal;
      }
    }

    const raw = food.nutrients;
    const p = parseFloat((raw.protein * factor).toFixed(1));
    const c = parseFloat((raw.carbs * factor).toFixed(1));
    const f = parseFloat((raw.fats * factor).toFixed(1));
    const fib = parseFloat(((raw.fiber || 0) * factor).toFixed(1));
    const netC = Math.max(0, c - fib);
    const kcal = Math.round(p * 4 + netC * 4 + f * 9);

    if (this.activeContext === "recipe_ingredient") {
      // Add as ingredient to the Recipe Builder
      const newIng = {
        name: food.name,
        brand: food.brand || "Generic",
        weight: storedWeight,
        nutrients: {
          calories: kcal,
          protein: p,
          carbs: c,
          fats: f,
          fiber: fib
        }
      };
      if (food.servingSize) newIng.servingSize = food.servingSize;
      if (food.servingQuantity) newIng.servingQuantity = food.servingQuantity;

      RecipeBuilderController.addIngredient(newIng);
      this.closePreview();
      AppState.showToast("Ingredient added!");
      
      appRouter.navigate("add_recipe");
      return;
    }

    // Daily meals log ingestion
    const newLogItem = {
      id: "food_select_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: food.name,
      brand: food.brand || (type === "recipe" ? "Recipe" : "Generic"),
      weight: storedWeight,
      calories: kcal,
      protein: p,
      carbs: c,
      fats: f,
      fiber: fib,
      loggedAt: Date.now()
    };
    if (food.servingSize) newLogItem.servingSize = food.servingSize;
    if (food.servingQuantity) newLogItem.servingQuantity = food.servingQuantity;

    const dateKey = AppState.selectedDateISO;
    if (!AppState.data.meals[dateKey]) {
      AppState.data.meals[dateKey] = [];
    }

    AppState.data.meals[dateKey].push(newLogItem);
    AppState.saveToStorage();

    this.closePreview();
    AppState.showToast("Food added to tracker!");

    appRouter.navigate("food");
  },

  closePreview() {
    this.selectedFoodItem = null;
    const preview = document.getElementById("selector-preview-card");
    if (preview) {
      preview.classList.add("hidden");
      // Move it back to the bottom of the panel-food-selector so it's safe from container.innerHTML = ""
      const panel = document.getElementById("panel-food-selector");
      if (panel) {
        panel.appendChild(preview);
      }
    }
    
    // Remove active styling from any active selector item
    document.querySelectorAll(".clickable-selector-item.selector-active").forEach(el => {
      el.classList.remove("selector-active");
    });
  },

  // --- Online Food Search ---

  async performOnlineSearch() {
    const input = document.getElementById("online-search-input");
    const btnSearch = document.getElementById("btn-online-search");
    const loadingEl = document.getElementById("online-search-loading");
    const resultsEl = document.getElementById("online-search-results");

    if (!input || !resultsEl) return;
    const query = input.value.trim();
    if (!query) {
      this.closePreview();
      resultsEl.innerHTML = `<div class="empty-state"><p>Please enter a food name to search.</p></div>`;
      return;
    }

    // Show loading state
    if (loadingEl) loadingEl.classList.remove("hidden");
    if (btnSearch) { btnSearch.disabled = true; btnSearch.textContent = "Searching..."; }
    this.closePreview();
    resultsEl.innerHTML = "";

    try {
      const items = await FoodDatabase.searchFoods(query);
      this.renderOnlineResults(items);
    } catch (err) {
      console.warn("[OnlineSearch] Failed:", err);
      resultsEl.innerHTML = `<div class="empty-state"><p>Search failed. Please check your connection and try again.</p></div>`;
    } finally {
      if (loadingEl) loadingEl.classList.add("hidden");
      if (btnSearch) { btnSearch.disabled = false; btnSearch.textContent = "Search"; }
    }
  },

  renderOnlineResults(items) {
    this.closePreview();
    const container = document.getElementById("online-search-results");
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No results found. Try a different search term, or log it manually using "Log Custom Food".</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    items.forEach(food => {
      const sourceBadge = food.source === "USDA"
        ? `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 10px; background: rgba(99,179,237,0.18); color: #63b3ed; margin-left: 6px;">USDA</span>`
        : (food.source === "Local DB"
          ? `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 10px; background: rgba(167,139,250,0.18); color: #a78bfa; margin-left: 6px;">LOCAL</span>`
          : `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 10px; background: rgba(154,230,180,0.15); color: #68d391; margin-left: 6px;">OFF</span>`);

      const item = document.createElement("div");
      item.className = "meal-item clickable-selector-item";
      item.style.cursor = "pointer";
      item.innerHTML = `
        <div class="meal-info">
          <span class="meal-name" style="font-weight: 600;">${food.name}${sourceBadge}</span>
          <span class="meal-sub">${food.brand} &bull; per 100g</span>
          <div class="meal-macros">
            <span class="m-tag p">P: ${food.nutrients.protein}g</span>
            <span class="m-tag c">C: ${food.nutrients.carbs}g</span>
            <span class="m-tag f">F: ${food.nutrients.fats}g</span>
          </div>
        </div>
        <div class="meal-kcal-block">
          <span class="meal-kcal" style="font-size: 1.1rem;">${food.nutrients.calories} <span style="font-size:0.75rem">kcal</span></span>
        </div>
      `;

      item.addEventListener("click", () => {
        this.selectFoodItem(food, "history", item);
      });

      container.appendChild(item);
    });
  }
};
