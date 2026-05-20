/**
 * ColinsChartsMacros - Core Application Controller
 * Manages state, persistent storage, routing, PWA operations, and event orchestration.
 */

// Global Application State Manager
const AppState = {
  storageKey: "colins_charts_macros_user_data_v1",
  
  // Default Initialized State
  data: {
    standardGoals: {
      calories: 2000,
      protein: 150,
      carbs: 250,
      fats: 65
    },
    dailyGoals: {}, // "YYYY-MM-DD": { calories, protein, carbs, fats }
    meals: {},      // "YYYY-MM-DD": [ { id, name, brand, weight, calories, protein, carbs, fats } ]
    weights: {},    // "YYYY-MM-DD": weightNumeric
    settings: {
      unit: "lbs",   // "lbs" or "kg"
      highCalorieDaysEnabled: false,
      highCalorieDays: {
        sunday: { enabled: false, type: "flat", value: 300 },
        monday: { enabled: false, type: "flat", value: 300 },
        tuesday: { enabled: false, type: "flat", value: 300 },
        wednesday: { enabled: false, type: "flat", value: 300 },
        thursday: { enabled: false, type: "flat", value: 300 },
        friday: { enabled: false, type: "flat", value: 300 },
        saturday: { enabled: false, type: "flat", value: 300 }
      }
    },
    profile: {
      sex: "male",
      age: 30,
      heightFt: 5,
      heightIn: 10,
      activity: "light",
      targetWeight: 170,
      weeklyRate: 1.0
    },
    recipes: {},      // id: { id, name, ingredients: [], nutrients: {}, totalWeight }
    customBarcodes: {} // barcode: { barcode, name, brand, nutrients: {} }
  },

  selectedDateISO: "", // Current active date YYYY-MM-DD
  activeTab: "dashboard",
  toastTimeout: null,

  init() {
    this.selectedDateISO = this.getTodayISODate();
    this.loadFromStorage();
  },

  loadFromStorage() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Deep merge logic to assure schema compatibility
        if (parsed.standardGoals) this.data.standardGoals = { ...this.data.standardGoals, ...parsed.standardGoals };
        if (parsed.dailyGoals) this.data.dailyGoals = { ...this.data.dailyGoals, ...parsed.dailyGoals };
        if (parsed.meals) this.data.meals = { ...this.data.meals, ...parsed.meals };
        if (parsed.weights) this.data.weights = { ...this.data.weights, ...parsed.weights };
        if (parsed.recipes) this.data.recipes = { ...this.data.recipes, ...parsed.recipes };
        if (parsed.customBarcodes) this.data.customBarcodes = { ...this.data.customBarcodes, ...parsed.customBarcodes };
        if (parsed.settings) {
          this.data.settings = { ...this.data.settings, ...parsed.settings };
          
          // Legacy migration for highCalorieDays (from boolean/missing to day-by-day object format)
          const oldDays = this.data.settings.highCalorieDays || {};
          const oldType = this.data.settings.highCalorieSurplusType || "flat";
          const oldValue = this.data.settings.highCalorieSurplusValue !== undefined ? this.data.settings.highCalorieSurplusValue : 300;
          
          const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const migratedDays = {};
          
          weekdays.forEach(day => {
            if (typeof oldDays[day] === "boolean") {
              migratedDays[day] = {
                enabled: oldDays[day],
                type: oldType,
                value: oldValue
              };
            } else if (oldDays[day] && typeof oldDays[day] === "object") {
              migratedDays[day] = {
                enabled: oldDays[day].enabled !== undefined ? oldDays[day].enabled : false,
                type: oldDays[day].type || "flat",
                value: oldDays[day].value !== undefined ? oldDays[day].value : 300
              };
            } else {
              migratedDays[day] = {
                enabled: false,
                type: "flat",
                value: 300
              };
            }
          });
          
          this.data.settings.highCalorieDays = migratedDays;
          
          // Clean up legacy root-level calorie cycling variables
          delete this.data.settings.highCalorieSurplusType;
          delete this.data.settings.highCalorieSurplusValue;
        }
        if (parsed.profile) this.data.profile = { ...this.data.profile, ...parsed.profile };
      } catch (e) {
        console.error("[Storage] Corrupt save file. Initializing standard defaults...", e);
      }
    }
  },

  saveToStorage() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  },

  getTodayISODate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  // Helper to obtain targets for a specific date (falls back to standards)
  getGoalsForDate(dateISO) {
    const baseGoals = this.data.dailyGoals[dateISO] || this.data.standardGoals;
    
    // Check if calorie cycling is enabled and this is a high-calorie day
    if (this.data.settings.highCalorieDaysEnabled) {
      // Find the day of the week
      const date = new Date(dateISO + "T00:00:00");
      const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayName = weekdays[date.getDay()];
      
      const dayConfig = this.data.settings.highCalorieDays[dayName];
      
      if (dayConfig && dayConfig.enabled) {
        // Calculate surplus
        let surplus = 0;
        if (dayConfig.type === "flat") {
          surplus = Number(dayConfig.value) || 0;
        } else if (dayConfig.type === "percent") {
          const pct = Number(dayConfig.value) || 0;
          surplus = baseGoals.calories * (pct / 100);
        }
        
        const adjustedCalories = Math.max(Math.round(baseGoals.calories + surplus), 500);
        const scalingFactor = baseGoals.calories > 0 ? (adjustedCalories / baseGoals.calories) : 1;
        
        return {
          calories: adjustedCalories,
          protein: Math.max(Math.round(baseGoals.protein * scalingFactor), 10),
          carbs: Math.max(Math.round(baseGoals.carbs * scalingFactor), 10),
          fats: Math.max(Math.round(baseGoals.fats * scalingFactor), 5),
          isHighCalorieDay: true,
          surplusApplied: Math.round(surplus),
          surplusType: dayConfig.type,
          surplusValue: dayConfig.value
        };
      }
    }
    
    return {
      ...baseGoals,
      isHighCalorieDay: false,
      surplusApplied: 0,
      surplusType: "flat",
      surplusValue: 0
    };
  },

  showToast(message) {
    const toast = document.getElementById("toast-notification");
    const toastMsg = document.getElementById("toast-message");
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");

    // Clear any existing timeout on the toast
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.classList.add("hidden");
      }, 300); // Wait for transition fade-out
    }, 2500);
  }
};

// Simple Single Page App Router with popstate back gestures
const appRouter = {
  panels: {},
  navItems: [],

  init() {
    this.panels = {
      dashboard: document.getElementById("panel-dashboard"),
      food: document.getElementById("panel-food"),
      weight: document.getElementById("panel-weight"),
      strategy: document.getElementById("panel-strategy"),
      weight_planner: document.getElementById("panel-weight-planner"),
      weight_budgets: document.getElementById("panel-weight-budgets"),
      settings: document.getElementById("panel-settings"),
      add_recipe: document.getElementById("panel-add-recipe"),
      food_selector: document.getElementById("panel-food-selector")
    };
    this.navItems = document.querySelectorAll(".app-navbar .nav-item");

    this.navItems.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        this.navigate(tab);
      });
    });

    // Popstate back gesture / browser back listener
    window.addEventListener("popstate", (event) => {
      const tabName = (event.state && event.state.tab) ? event.state.tab : "dashboard";
      this.navigate(tabName, false);
    });

    // Set initial default browser state
    history.replaceState({ tab: "dashboard" }, "", "#dashboard");
  },

  navigate(tabName, pushState = true) {
    if (!this.panels[tabName]) return;
    
    // Close camera scanner stream cleanly if leaving the active camera tabs
    if ((AppState.activeTab === "dashboard" || AppState.activeTab === "food" || AppState.activeTab === "add_recipe") && tabName !== AppState.activeTab) {
      BarcodeScannerManager.stop();
    }

    const previousTab = AppState.activeTab;
    AppState.activeTab = tabName;

    // Toggle panels
    Object.keys(this.panels).forEach((key) => {
      if (key === tabName) {
        this.panels[key].classList.add("active");
      } else {
        this.panels[key].classList.remove("active");
      }
    });

    // Toggle bottom navigation active buttons
    this.navItems.forEach((btn) => {
      const btnTab = btn.getAttribute("data-tab");
      const isWeightRelated = (tabName === "weight" || tabName === "weight_planner" || tabName === "weight_budgets");
      const isStrategyRelated = (tabName === "strategy");
      const isFoodRelated = (tabName === "food" || tabName === "add_recipe" || tabName === "food_selector");
      if (btnTab === tabName || (btnTab === "weight" && isWeightRelated) || (btnTab === "strategy" && isStrategyRelated) || (btnTab === "food" && isFoodRelated)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Push new history state for back button gestures
    if (pushState && tabName !== previousTab) {
      history.pushState({ tab: tabName }, "", "#" + tabName);
    }

    // Render contents specific to active tabs
    this.refreshCurrentView();
  },

  refreshCurrentView() {
    if (AppState.activeTab === "dashboard") {
      DashboardController.render();
    } else if (AppState.activeTab === "food") {
      FoodController.render();
    } else if (AppState.activeTab === "weight") {
      WeightController.render();
    } else if (AppState.activeTab === "strategy") {
      StrategyController.render();
    } else if (AppState.activeTab === "weight_planner" || AppState.activeTab === "weight_budgets" || AppState.activeTab === "settings") {
      SettingsController.render();
    } else if (AppState.activeTab === "add_recipe") {
      RecipeBuilderController.render();
    } else if (AppState.activeTab === "food_selector") {
      FoodSelectorController.render();
    }
  }
};

// Dashboard Controller (Progress circles, Macro bars, Scanner)
const DashboardController = {
  render() {
    const dateKey = AppState.selectedDateISO;
    const meals = AppState.data.meals[dateKey] || [];
    const goals = AppState.getGoalsForDate(dateKey);

    // Cumulative tallies
    let eatenKcal = 0;
    let eatenProtein = 0;
    let eatenCarbs = 0;
    let eatenFats = 0;

    meals.forEach((meal) => {
      eatenKcal += meal.calories;
      eatenProtein += meal.protein;
      eatenCarbs += meal.carbs;
      eatenFats += meal.fats;
    });

    // Update textual indicators
    document.getElementById("val-calories-eaten").textContent = Math.round(eatenKcal).toLocaleString();
    document.getElementById("val-calories-target").textContent = goals.calories.toLocaleString();

    const remainingKcal = goals.calories - eatenKcal;
    const remainingEl = document.getElementById("val-calories-remaining");
    remainingEl.textContent = Math.abs(Math.round(remainingKcal)).toLocaleString();
    if (remainingKcal < 0) {
      remainingEl.classList.add("color-danger");
      remainingEl.parentElement.querySelector(".stat-lbl").textContent = "Surplus";
    } else {
      remainingEl.classList.remove("color-danger");
      remainingEl.parentElement.querySelector(".stat-lbl").textContent = "Remaining";
    }

    const pctVal = goals.calories > 0 ? Math.round((eatenKcal / goals.calories) * 100) : 0;
    document.getElementById("val-burn-status").textContent = `${pctVal}%`;

    // Animate circular progress ring
    const ring = document.getElementById("calorie-progress-ring");
    if (ring) {
      const strokeDash = 251.2; // 2 * PI * r (40)
      let offset = strokeDash;
      
      if (goals.calories > 0) {
        const clampedPct = Math.min(eatenKcal / goals.calories, 1.0);
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
    this.updateMacroRow("protein", eatenProtein, goals.protein);
    this.updateMacroRow("carbs", eatenCarbs, goals.carbs);
    this.updateMacroRow("fats", eatenFats, goals.fats);
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

// Food Controller - Detailed logs, custom log form, 7-day calorie history
const FoodController = {
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
// Scanner & Barcode View Controller (Triple Context aware)
const ScannerViewController = {
  currentFetchedProduct: {
    dashboard: null,
    food: null,
    recipe: null
  },

  init() {
    // 1. Collapsible custom form toggle (Only on the Food tab)
    const toggleHeader = document.getElementById("toggle-custom-form-btn");
    const customForm = document.getElementById("custom-food-form");
    const customCard = document.getElementById("custom-food-card");

    if (toggleHeader && customForm && customCard) {
      toggleHeader.addEventListener("click", () => {
        const isHidden = customForm.classList.contains("hidden");
        if (isHidden) {
          customForm.classList.remove("hidden");
          customCard.classList.add("active");
        } else {
          customForm.classList.add("hidden");
          customCard.classList.remove("active");
        }
      });
    }

    // Auto-calculate custom calories from custom macros on the custom form
    const customProtein = document.getElementById("custom-protein");
    const customCarbs = document.getElementById("custom-carbs");
    const customFats = document.getElementById("custom-fats");
    const customCalInput = document.getElementById("custom-calories");

    if (customProtein && customCarbs && customFats && customCalInput) {
      const updateCalculatedCalories = () => {
        let p = parseFloat(customProtein.value) || 0;
        let c = parseFloat(customCarbs.value) || 0;
        let f = parseFloat(customFats.value) || 0;
        let kcal = Math.round((p * 4) + (c * 4) + (f * 9));
        customCalInput.value = kcal > 0 ? kcal : "";
      };

      customProtein.addEventListener("input", updateCalculatedCalories);
      customCarbs.addEventListener("input", updateCalculatedCalories);
      customFats.addEventListener("input", updateCalculatedCalories);
    }

    const customFoodForm = document.getElementById("custom-food-form");
    if (customFoodForm) {
      customFoodForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addCustomFoodLog();
      });
    }

    // Initialize listeners for three contexts
    this.initContext("dashboard");
    this.initContext("food");
    this.initContext("recipe");
  },

  initContext(context) {
    // Start scan
    const btnStart = document.getElementById(`btn-start-scan-${context}`);
    if (btnStart) {
      btnStart.addEventListener("click", () => {
        BarcodeScannerManager.start(context, (barcode) => {
          this.triggerProductLookup(context, barcode);
        });
      });
    }

    // Stop scan
    const btnStop = document.getElementById(`btn-stop-scan-${context}`);
    if (btnStop) {
      btnStop.addEventListener("click", () => {
        BarcodeScannerManager.stop();
      });
    }

    // Lookup manual barcode
    const btnLookup = document.getElementById(`btn-lookup-barcode-${context}`);
    if (btnLookup) {
      btnLookup.addEventListener("click", () => {
        const code = document.getElementById(`manual-barcode-field-${context}`).value;
        if (code) {
          this.triggerProductLookup(context, code);
        }
      });
    }

    // Close preview card
    const btnClose = document.getElementById(`btn-close-preview-${context}`);
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        this.closePreview(context);
      });
    }

    // Serving weight scaling
    const weightInput = document.getElementById(`food-weight-input-${context}`);
    if (weightInput) {
      weightInput.addEventListener("input", () => {
        this.updateScaledMacros(context);
      });
      weightInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.addScaledProductToLog(context);
        }
      });
    }

    // Add scaled button
    const btnAdd = document.getElementById(`btn-add-scaled-food-${context}`);
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        this.addScaledProductToLog(context);
      });
    }

    // Manual registration form submission
    const regForm = document.getElementById(`not-found-register-form-${context}`);
    if (regForm) {
      regForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.registerCustomBarcode(context);
      });
    }

    // Close manual registration card
    const btnCloseNotFound = document.getElementById(`btn-close-not-found-${context}`);
    if (btnCloseNotFound) {
      btnCloseNotFound.addEventListener("click", () => {
        const card = document.getElementById(`barcode-not-found-card-${context}`);
        if (card) card.classList.add("hidden");
      });
    }
  },

  async triggerProductLookup(context, barcode) {
    const inputField = document.getElementById(`manual-barcode-field-${context}`);
    const searchBtn = document.getElementById(`btn-lookup-barcode-${context}`);
    
    if (inputField) inputField.disabled = true;
    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.textContent = "Loading...";
    }

    try {
      // 1. Check local customBarcodes database first
      let product = AppState.data.customBarcodes[barcode];

      if (!product) {
        // 2. Query online databases sequential fallbacks
        product = await FoodDatabase.lookupBarcode(barcode);
      }

      if (product.needsMacroEntry) {
        // pre-fill known details but show manual registration form
        document.getElementById(`not-found-name-${context}`).value = product.name;
        document.getElementById(`not-found-brand-${context}`).value = product.brand;
        document.getElementById(`not-found-code-${context}`).textContent = barcode;
        
        // Hide preview
        this.closePreview(context);
        
        // Show not found registration card
        const notFoundCard = document.getElementById(`barcode-not-found-card-${context}`);
        if (notFoundCard) {
          notFoundCard.classList.remove("hidden");
          notFoundCard.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      // Product successfully loaded with nutrients!
      this.currentFetchedProduct[context] = product;
      
      // Populate elements
      document.getElementById(`preview-food-name-${context}`).textContent = product.name;
      document.getElementById(`preview-food-brand-${context}`).textContent = product.brand;
      
      document.getElementById(`preview-100g-kcal-${context}`).textContent = product.nutrients.calories;
      document.getElementById(`preview-100g-protein-${context}`).textContent = product.nutrients.protein;
      document.getElementById(`preview-100g-carbs-${context}`).textContent = product.nutrients.carbs;
      document.getElementById(`preview-100g-fats-${context}`).textContent = product.nutrients.fats;

      // Set standard weight scale to 100g
      const wtInput = document.getElementById(`food-weight-input-${context}`);
      if (wtInput) wtInput.value = 100;
      this.updateScaledMacros(context);

      // Hide not found card if visible
      const notFoundCard = document.getElementById(`barcode-not-found-card-${context}`);
      if (notFoundCard) notFoundCard.classList.add("hidden");

      // Show preview card
      const previewCard = document.getElementById(`food-detail-card-${context}`);
      if (previewCard) {
        previewCard.classList.remove("hidden");
        previewCard.scrollIntoView({ behavior: 'smooth' });
      }

    } catch (err) {
      console.warn(`[Lookup] Product not found for barcode: ${barcode}`);
      
      // Clear forms
      document.getElementById(`not-found-code-${context}`).textContent = barcode;
      document.getElementById(`not-found-name-${context}`).value = "";
      document.getElementById(`not-found-brand-${context}`).value = "";
      document.getElementById(`not-found-calories-${context}`).value = "";
      document.getElementById(`not-found-protein-${context}`).value = "";
      document.getElementById(`not-found-carbs-${context}`).value = "";
      document.getElementById(`not-found-fats-${context}`).value = "";

      // Auto-compute calories for manual registration form
      const proteinInput = document.getElementById(`not-found-protein-${context}`);
      const carbsInput = document.getElementById(`not-found-carbs-${context}`);
      const fatsInput = document.getElementById(`not-found-fats-${context}`);
      const calsInput = document.getElementById(`not-found-calories-${context}`);

      if (proteinInput && carbsInput && fatsInput && calsInput) {
        const updateCalculatedCalories = () => {
          let p = parseFloat(proteinInput.value) || 0;
          let c = parseFloat(carbsInput.value) || 0;
          let f = parseFloat(fatsInput.value) || 0;
          let kcal = Math.round((p * 4) + (c * 4) + (f * 9));
          calsInput.value = kcal > 0 ? kcal : "";
        };

        // Bind auto compute on input
        proteinInput.oninput = updateCalculatedCalories;
        carbsInput.oninput = updateCalculatedCalories;
        fatsInput.oninput = updateCalculatedCalories;
      }

      this.closePreview(context);
      
      const notFoundCard = document.getElementById(`barcode-not-found-card-${context}`);
      if (notFoundCard) {
        notFoundCard.classList.remove("hidden");
        notFoundCard.scrollIntoView({ behavior: 'smooth' });
      }
    } finally {
      if (inputField) {
        inputField.disabled = false;
        inputField.value = "";
      }
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = "Search";
      }
    }
  },

  registerCustomBarcode(context) {
    const barcode = document.getElementById(`not-found-code-${context}`).textContent;
    const name = document.getElementById(`not-found-name-${context}`).value.trim();
    const brand = document.getElementById(`not-found-brand-${context}`).value.trim() || "Generic Brand";
    const kcal = Math.round(Number(document.getElementById(`not-found-calories-${context}`).value));
    const protein = parseFloat(Number(document.getElementById(`not-found-protein-${context}`).value).toFixed(1));
    const carbs = parseFloat(Number(document.getElementById(`not-found-carbs-${context}`).value).toFixed(1));
    const fats = parseFloat(Number(document.getElementById(`not-found-fats-${context}`).value).toFixed(1));

    if (!barcode || !name) {
      alert("Please fill out barcode and product name.");
      return;
    }

    const newFood = {
      barcode: barcode,
      name: name,
      brand: brand,
      nutrients: {
        calories: kcal,
        protein: protein,
        carbs: carbs,
        fats: fats
      }
    };

    // Save locally
    AppState.data.customBarcodes[barcode] = newFood;
    AppState.saveToStorage();

    // Hide registration card
    const notFoundCard = document.getElementById(`barcode-not-found-card-${context}`);
    if (notFoundCard) notFoundCard.classList.add("hidden");

    AppState.showToast("Product registered locally!");

    // Run lookup flow which will now succeed immediately
    this.triggerProductLookup(context, barcode);
  },

  updateScaledMacros(context) {
    const product = this.currentFetchedProduct[context];
    if (!product) return;
    
    let weight = parseFloat(document.getElementById(`food-weight-input-${context}`).value);
    if (isNaN(weight) || weight <= 0) weight = 0;

    const raw = product.nutrients;
    const factor = weight / 100;

    document.getElementById(`scaled-kcal-${context}`).textContent = Math.round(raw.calories * factor);
    document.getElementById(`scaled-protein-${context}`).textContent = `${(raw.protein * factor).toFixed(1)}g`;
    document.getElementById(`scaled-carbs-${context}`).textContent = `${(raw.carbs * factor).toFixed(1)}g`;
    document.getElementById(`scaled-fats-${context}`).textContent = `${(raw.fats * factor).toFixed(1)}g`;
  },

  addScaledProductToLog(context) {
    const product = this.currentFetchedProduct[context];
    if (!product) return;

    let weight = parseFloat(document.getElementById(`food-weight-input-${context}`).value);
    if (isNaN(weight) || weight <= 0) {
      alert("Please enter a valid weight in grams.");
      return;
    }

    const raw = product.nutrients;
    const factor = weight / 100;

    if (context === "recipe") {
      // Add as ingredient to the Recipe Builder
      const newIng = {
        name: product.name,
        brand: product.brand,
        weight: weight,
        nutrients: {
          calories: Math.round(raw.calories * factor),
          protein: parseFloat((raw.protein * factor).toFixed(1)),
          carbs: parseFloat((raw.carbs * factor).toFixed(1)),
          fats: parseFloat((raw.fats * factor).toFixed(1))
        }
      };
      RecipeBuilderController.addIngredient(newIng);
      this.closePreview("recipe");
      AppState.showToast("Ingredient added to recipe!");
      return;
    }

    // Daily meals logging
    const newLogItem = {
      id: "food_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: product.name,
      brand: product.brand,
      weight: weight,
      calories: Math.round(raw.calories * factor),
      protein: parseFloat((raw.protein * factor).toFixed(1)),
      carbs: parseFloat((raw.carbs * factor).toFixed(1)),
      fats: parseFloat((raw.fats * factor).toFixed(1))
    };

    const dateKey = AppState.selectedDateISO;
    if (!AppState.data.meals[dateKey]) {
      AppState.data.meals[dateKey] = [];
    }
    
    AppState.data.meals[dateKey].push(newLogItem);
    AppState.saveToStorage();

    // Close preview card
    this.closePreview(context);
    
    // Refresh current view
    appRouter.refreshCurrentView();
    AppState.showToast("Food item added to log!");
  },

  addCustomFoodLog() {
    const name = document.getElementById("custom-name").value;
    const kcal = Math.round(Number(document.getElementById("custom-calories").value));
    const protein = parseFloat(Number(document.getElementById("custom-protein").value).toFixed(1));
    const carbs = parseFloat(Number(document.getElementById("custom-carbs").value).toFixed(1));
    const fats = parseFloat(Number(document.getElementById("custom-fats").value).toFixed(1));

    const newLogItem = {
      id: "food_custom_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: name,
      brand: "Custom Entry",
      weight: 100, // Static serving placeholder
      calories: kcal,
      protein: protein,
      carbs: carbs,
      fats: fats
    };

    const dateKey = AppState.selectedDateISO;
    if (!AppState.data.meals[dateKey]) {
      AppState.data.meals[dateKey] = [];
    }
    
    AppState.data.meals[dateKey].push(newLogItem);
    AppState.saveToStorage();

    // Reset forms
    const form = document.getElementById("custom-food-form");
    if (form) {
      form.reset();
      form.classList.add("hidden");
    }
    const card = document.getElementById("custom-food-card");
    if (card) {
      card.classList.remove("active");
    }

    appRouter.refreshCurrentView();
    AppState.showToast("Custom food item added!");
  },

  closePreview(context) {
    this.currentFetchedProduct[context] = null;
    const preview = document.getElementById(`food-detail-card-${context}`);
    if (preview) preview.classList.add("hidden");
  }
};

// Weight Log View Controller
const WeightController = {
  init() {
    document.getElementById("weight-log-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.logWeight();
    });
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

// Strategy Controller - Manages the weekday cycling scheduler
const StrategyController = {
  init() {
    // Enable/Disable Calorie Cycling
    const cyclingToggle = document.getElementById("cycling-enabled");
    if (cyclingToggle) {
      cyclingToggle.addEventListener("change", (e) => {
        AppState.data.settings.highCalorieDaysEnabled = e.target.checked;
        AppState.saveToStorage();
        this.toggleCyclingBodyVisibility();
        DashboardController.render();
        AppState.showToast(e.target.checked ? "Calorie cycling enabled" : "Calorie cycling disabled");
      });
    }

    // Set up day-by-day checkbox, dropdown, and value input listeners
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    weekdays.forEach(day => {
      // Toggle day enabled
      const dayCheckbox = document.getElementById(`cycling-day-${day}`);
      if (dayCheckbox) {
        dayCheckbox.addEventListener("change", (e) => {
          if (!AppState.data.settings.highCalorieDays[day]) {
            AppState.data.settings.highCalorieDays[day] = { enabled: false, type: "flat", value: 300 };
          }
          AppState.data.settings.highCalorieDays[day].enabled = e.target.checked;
          AppState.saveToStorage();
          this.toggleDayInputsVisibility(day, e.target.checked);
          DashboardController.render();
        });
      }

      // Dropdown type (+ kcal vs + %)
      const typeSelect = document.getElementById(`cycling-type-${day}`);
      if (typeSelect) {
        typeSelect.addEventListener("change", (e) => {
          if (!AppState.data.settings.highCalorieDays[day]) {
            AppState.data.settings.highCalorieDays[day] = { enabled: true, type: "flat", value: 300 };
          }
          AppState.data.settings.highCalorieDays[day].type = e.target.value;
          AppState.saveToStorage();
          DashboardController.render();
        });
      }

      // Value input
      const valInput = document.getElementById(`cycling-val-${day}`);
      if (valInput) {
        valInput.addEventListener("input", (e) => {
          if (!AppState.data.settings.highCalorieDays[day]) {
            AppState.data.settings.highCalorieDays[day] = { enabled: true, type: "flat", value: 300 };
          }
          AppState.data.settings.highCalorieDays[day].value = Number(e.target.value) || 0;
          AppState.saveToStorage();
          DashboardController.render();
        });
      }
    });
  },

  render() {
    const cyclingEnabled = AppState.data.settings.highCalorieDaysEnabled;
    const cyclingToggle = document.getElementById("cycling-enabled");
    if (cyclingToggle) {
      cyclingToggle.checked = cyclingEnabled;
    }
    this.toggleCyclingBodyVisibility();

    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    weekdays.forEach(day => {
      const dayConfig = AppState.data.settings.highCalorieDays[day] || { enabled: false, type: "flat", value: 300 };
      const el = document.getElementById(`cycling-day-${day}`);
      if (el) {
        el.checked = dayConfig.enabled;
      }
      this.toggleDayInputsVisibility(day, dayConfig.enabled);

      const typeEl = document.getElementById(`cycling-type-${day}`);
      if (typeEl) {
        typeEl.value = dayConfig.type;
      }
      const valEl = document.getElementById(`cycling-val-${day}`);
      if (valEl) {
        valEl.value = dayConfig.value;
      }
    });
  },

  toggleCyclingBodyVisibility() {
    const enabled = AppState.data.settings.highCalorieDaysEnabled;
    const body = document.getElementById("cycling-settings-body");
    if (body) {
      if (enabled) {
        body.classList.remove("hidden");
      } else {
        body.classList.add("hidden");
      }
    }
  },

  toggleDayInputsVisibility(day, enabled) {
    const inputsEl = document.getElementById(`cycling-inputs-${day}`);
    if (inputsEl) {
      if (enabled) {
        inputsEl.classList.remove("hidden");
      } else {
        inputsEl.classList.add("hidden");
      }
    }
  }
};

// App Settings & Configuration Controller
const SettingsController = {
  init() {
    // 1. Config form updates
    const targetForm = document.getElementById("targets-form");
    if (targetForm) {
      targetForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveStandardTargets();
      });
    }

    // 2. Unit selector adjustments
    const btnLbs = document.getElementById("btn-unit-lbs");
    const btnKg = document.getElementById("btn-unit-kg");

    if (btnLbs) btnLbs.addEventListener("click", () => this.toggleWeightUnit("lbs"));
    if (btnKg) btnKg.addEventListener("click", () => this.toggleWeightUnit("kg"));

    // 3. Mock Data trigger
    const loadMockBtn = document.getElementById("btn-load-mock");
    if (loadMockBtn) {
      loadMockBtn.addEventListener("click", () => this.injectDemoLogs());
    }

    // 4. Data Wipe actions
    const clearBtn = document.getElementById("btn-clear-data");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.purgeStorageData());
    }

    // 5. Renpho CSV Import
    const csvInput = document.getElementById("csv-file-input");
    if (csvInput) {
      csvInput.addEventListener("change", (e) => this.importRenphoCSV(e));
    }

    // 6. Danger Zone collapsible card toggle
    const toggleDangerBtn = document.getElementById("toggle-danger-zone-btn");
    const dangerBody = document.getElementById("danger-zone-body");
    const dangerCard = document.getElementById("danger-zone-card");
    if (toggleDangerBtn && dangerBody && dangerCard) {
      toggleDangerBtn.addEventListener("click", () => {
        const isHidden = dangerBody.classList.contains("hidden");
        if (isHidden) {
          dangerBody.classList.remove("hidden");
          dangerCard.classList.add("active");
        } else {
          dangerBody.classList.add("hidden");
          dangerCard.classList.remove("active");
        }
      });
    }

    // 7. Planner Form live updates on inputs
    const plannerInputs = [
      "profile-sex",
      "profile-age",
      "profile-height-ft",
      "profile-height-in",
      "profile-activity",
      "profile-target-weight",
      "profile-weekly-rate"
    ];

    plannerInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => this.calculateTargetPlanner());
        el.addEventListener("change", () => this.calculateTargetPlanner());
      }
    });

    // 8. Apply Planner daily calories to budgets
    const btnApply = document.getElementById("btn-apply-planner");
    if (btnApply) {
      btnApply.addEventListener("click", () => this.applyPlannerTarget());
    }

    // 9. Backup & Restore Events
    const btnExportCSV = document.getElementById("btn-export-csv");
    if (btnExportCSV) {
      btnExportCSV.addEventListener("click", () => this.exportCSV());
    }

    const btnExportJSON = document.getElementById("btn-export-json");
    if (btnExportJSON) {
      btnExportJSON.addEventListener("click", () => this.exportJSON());
    }

    const jsonFileInput = document.getElementById("json-file-input");
    if (jsonFileInput) {
      jsonFileInput.addEventListener("change", (e) => this.importJSON(e));
    }
  },

  render() {
    const dateKey = AppState.selectedDateISO;
    const goals = AppState.getGoalsForDate(dateKey);

    // Form defaults populate
    const calEl = document.getElementById("target-calories");
    const protEl = document.getElementById("target-protein");
    const carbEl = document.getElementById("target-carbs");
    const fatEl = document.getElementById("target-fats");
    
    if (calEl) calEl.value = goals.calories;
    if (protEl) protEl.value = goals.protein;
    if (carbEl) carbEl.value = goals.carbs;
    if (fatEl) fatEl.value = goals.fats;

    // Weight active unit indicator
    const currentUnit = AppState.data.settings.unit;
    const lbsBtn = document.getElementById("btn-unit-lbs");
    const kgBtn = document.getElementById("btn-unit-kg");
    
    if (lbsBtn && kgBtn) {
      if (currentUnit === "lbs") {
        lbsBtn.classList.add("active");
        kgBtn.classList.remove("active");
      } else {
        lbsBtn.classList.remove("active");
        kgBtn.classList.add("active");
      }
    }

    // --- Profile & Planner Populating ---
    if (!AppState.data.profile) {
      AppState.data.profile = {
        sex: "male",
        age: 30,
        heightFt: 5,
        heightIn: 10,
        activity: "light",
        targetWeight: currentUnit === "lbs" ? 170 : 77,
        weeklyRate: currentUnit === "lbs" ? 1.0 : 0.5
      };
    }

    const profile = AppState.data.profile;
    
    // Safely write profile fields
    const sexEl = document.getElementById("profile-sex");
    if (sexEl) sexEl.value = profile.sex || "male";

    const ageEl = document.getElementById("profile-age");
    if (ageEl) ageEl.value = profile.age || 30;

    const ftEl = document.getElementById("profile-height-ft");
    if (ftEl) ftEl.value = profile.heightFt || 5;

    const inEl = document.getElementById("profile-height-in");
    if (inEl) inEl.value = profile.heightIn || 10;

    const actEl = document.getElementById("profile-activity");
    if (actEl) actEl.value = profile.activity || "light";

    const targetWtEl = document.getElementById("profile-target-weight");
    if (targetWtEl) targetWtEl.value = profile.targetWeight || (currentUnit === "lbs" ? 170 : 77);

    // Update labels with active unit
    document.querySelectorAll(".planner-unit").forEach(el => {
      el.textContent = currentUnit;
    });

    // Populate weekly rates dynamically based on active unit
    const rateSelect = document.getElementById("profile-weekly-rate");
    if (rateSelect) {
      const selectedRate = profile.weeklyRate || (currentUnit === "lbs" ? 1.0 : 0.5);
      rateSelect.innerHTML = "";
      if (currentUnit === "lbs") {
        const lbsOptions = [
          { value: "0.5", text: "0.5 lbs / week (Slow & steady)" },
          { value: "1.0", text: "1.0 lbs / week (Recommended)" },
          { value: "1.5", text: "1.5 lbs / week (Moderate)" },
          { value: "2.0", text: "2.0 lbs / week (Aggressive)" }
        ];
        lbsOptions.forEach(opt => {
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.text;
          if (parseFloat(opt.value) === selectedRate) o.selected = true;
          rateSelect.appendChild(o);
        });
      } else {
        const kgOptions = [
          { value: "0.25", text: "0.25 kg / week (Slow & steady)" },
          { value: "0.5", text: "0.5 kg / week (Recommended)" },
          { value: "0.75", text: "0.75 kg / week (Moderate)" },
          { value: "1.0", text: "1.0 kg / week (Aggressive)" }
        ];
        kgOptions.forEach(opt => {
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.text;
          if (parseFloat(opt.value) === selectedRate) o.selected = true;
          rateSelect.appendChild(o);
        });
      }
    }

    // Run calculations to populate standard results on render load
    this.calculateTargetPlanner();
  },

  getCurrentWeight() {
    const todayISO = AppState.getTodayISODate();
    if (AppState.data.weights[todayISO] !== undefined) {
      return AppState.data.weights[todayISO];
    }
    const dates = Object.keys(AppState.data.weights).sort().reverse();
    if (dates.length > 0) {
      return AppState.data.weights[dates[0]];
    }
    return AppState.data.settings.unit === "lbs" ? 180 : 80;
  },

  calculateTargetPlanner() {
    const sexEl = document.getElementById("profile-sex");
    if (!sexEl) return;

    const sex = sexEl.value;
    const age = parseInt(document.getElementById("profile-age").value) || 30;
    const heightFt = parseFloat(document.getElementById("profile-height-ft").value) || 5;
    const heightIn = parseFloat(document.getElementById("profile-height-in").value) || 10;
    const activity = document.getElementById("profile-activity").value;
    const targetWeight = parseFloat(document.getElementById("profile-target-weight").value) || 170;
    const weeklyRate = parseFloat(document.getElementById("profile-weekly-rate").value) || 1.0;

    const currentUnit = AppState.data.settings.unit;
    const currentWeight = this.getCurrentWeight();

    // Persist profile variables immediately
    AppState.data.profile = {
      sex,
      age,
      heightFt,
      heightIn,
      activity,
      targetWeight,
      weeklyRate
    };
    AppState.saveToStorage();

    // Metric conversions for MSJ Formula
    const currentWeightKg = currentUnit === "lbs" ? currentWeight / 2.20462 : currentWeight;
    const targetWeightKg = currentUnit === "lbs" ? targetWeight / 2.20462 : targetWeight;
    const heightCm = (heightFt * 12 + heightIn) * 2.54;

    // BMR Calculation (Mifflin-St Jeor)
    let bmr = 0;
    if (sex === "male") {
      bmr = (10 * currentWeightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
      bmr = (10 * currentWeightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }

    // TDEE Multipliers
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725
    };
    const activityFactor = activityMultipliers[activity] || 1.2;
    const tdee = bmr * activityFactor;

    // Target Calorie adjustment (deficit/surplus)
    const weeklyRateLbs = currentUnit === "kg" ? weeklyRate * 2.20462 : weeklyRate;
    const dailyCalorieDelta = weeklyRateLbs * 500;

    let targetCalories = tdee;
    if (targetWeightKg < currentWeightKg) {
      targetCalories = tdee - dailyCalorieDelta;
    } else if (targetWeightKg > currentWeightKg) {
      targetCalories = tdee + dailyCalorieDelta;
    }
    
    // Absolute minimum clamp of 500 kcal
    targetCalories = Math.max(Math.round(targetCalories), 500);

    // Weeks calculation
    const weightDiff = Math.abs(currentWeight - targetWeight);
    const weeksToGoal = weeklyRate > 0 ? (weightDiff / weeklyRate) : 0;

    // Goal Date calculation
    let goalDateStr = "--";
    if (weeksToGoal > 0) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Math.round(weeksToGoal * 7));
      goalDateStr = targetDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } else if (weeksToGoal === 0) {
      const targetDate = new Date();
      goalDateStr = targetDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    // Display summary results
    document.getElementById("planner-cal-result").textContent = targetCalories.toLocaleString();
    document.getElementById("planner-tdee-result").textContent = `${Math.round(tdee).toLocaleString()} kcal`;
    document.getElementById("planner-weeks-result").textContent = weeksToGoal > 0 ? `${weeksToGoal.toFixed(1)} Weeks` : "0 Weeks";
    const dateResultEl = document.getElementById("planner-date-result");
    if (dateResultEl) {
      dateResultEl.textContent = goalDateStr;
    }

    // Safety checks & warnings
    const warningBox = document.getElementById("planner-warning-box");
    const warningText = document.getElementById("planner-warning-text");

    if (warningBox && warningText) {
      let isDangerous = false;
      let warningMsg = "";

      if (weeklyRateLbs > 2.0) {
        isDangerous = true;
        warningMsg = `Aggressive rate selected. Safe weight change rate is up to 2.0 lbs (${currentUnit === "kg" ? "0.9 kg" : "0.9 kg"} equivalent) per week.`;
      }

      const minKcal = sex === "male" ? 1500 : 1200;
      if (targetCalories < minKcal) {
        isDangerous = true;
        if (warningMsg) warningMsg += " Also, ";
        warningMsg += `Target calories (${targetCalories} kcal) are below the recommended safe daily minimum (${minKcal} kcal for biological ${sex}s).`;
      }

      if (isDangerous) {
        warningText.textContent = warningMsg;
        warningBox.classList.remove("hidden");
        if (weeklyRateLbs <= 2.0 && targetCalories >= minKcal - 200) {
          warningBox.classList.add("caution");
        } else {
          warningBox.classList.remove("caution");
        }
      } else {
        warningBox.classList.add("hidden");
      }
    }
  },

  applyPlannerTarget() {
    const calResultText = document.getElementById("planner-cal-result").textContent.replace(/,/g, "");
    const targetCalories = parseInt(calResultText) || 2000;

    // Proportional Macro Scaling
    const oldCalories = AppState.data.standardGoals.calories || 2000;
    const scale = targetCalories / oldCalories;

    AppState.data.standardGoals.calories = targetCalories;
    AppState.data.standardGoals.protein = Math.max(Math.round((AppState.data.standardGoals.protein || 150) * scale), 10);
    AppState.data.standardGoals.carbs = Math.max(Math.round((AppState.data.standardGoals.carbs || 250) * scale), 10);
    AppState.data.standardGoals.fats = Math.max(Math.round((AppState.data.standardGoals.fats || 65) * scale), 5);

    // Save Daily Override for current active date
    const dateKey = AppState.selectedDateISO;
    AppState.data.dailyGoals[dateKey] = {
      calories: AppState.data.standardGoals.calories,
      protein: AppState.data.standardGoals.protein,
      carbs: AppState.data.standardGoals.carbs,
      fats: AppState.data.standardGoals.fats
    };

    AppState.saveToStorage();
    AppState.showToast(`Applied ${targetCalories} kcal budget & scaled macros!`);
    
    // Refresh UI inputs
    this.render();
  },

  saveStandardTargets() {
    const kcal = Math.round(Number(document.getElementById("target-calories").value));
    const protein = Math.round(Number(document.getElementById("target-protein").value));
    const carbs = Math.round(Number(document.getElementById("target-carbs").value));
    const fats = Math.round(Number(document.getElementById("target-fats").value));

    // Support flexible overrides for currently selected date
    const dateKey = AppState.selectedDateISO;
    
    // Save to daily goals override list
    AppState.data.dailyGoals[dateKey] = {
      calories: kcal,
      protein: protein,
      carbs: carbs,
      fats: fats
    };

    // Save as standard defaults
    AppState.data.standardGoals = {
      calories: kcal,
      protein: protein,
      carbs: carbs,
      fats: fats
    };

    AppState.saveToStorage();
    AppState.showToast("Target budgets saved successfully!");
    
    // Refresh UI inputs
    this.render();
  },

  toggleWeightUnit(targetUnit) {
    const currentUnit = AppState.data.settings.unit;
    if (currentUnit === targetUnit) return;

    // Convert weight logs
    const weights = AppState.data.weights;
    Object.keys(weights).forEach((dateKey) => {
      const original = weights[dateKey];
      if (targetUnit === "kg") {
        weights[dateKey] = parseFloat((original / 2.20462).toFixed(1));
      } else {
        weights[dateKey] = parseFloat((original * 2.20462).toFixed(1));
      }
    });

    // Convert goal profile targets
    if (AppState.data.profile) {
      const profile = AppState.data.profile;
      if (targetUnit === "kg") {
        profile.targetWeight = parseFloat((profile.targetWeight / 2.20462).toFixed(1));
        const rateMap = { 0.5: 0.25, 1.0: 0.5, 1.5: 0.75, 2.0: 1.0 };
        profile.weeklyRate = rateMap[profile.weeklyRate] || parseFloat((profile.weeklyRate / 2.20462).toFixed(2));
      } else {
        profile.targetWeight = parseFloat((profile.targetWeight * 2.20462).toFixed(1));
        const rateMap = { 0.25: 0.5, 0.5: 1.0, 0.75: 1.5, 1.0: 2.0 };
        profile.weeklyRate = rateMap[profile.weeklyRate] || parseFloat((profile.weeklyRate * 2.20462).toFixed(2));
      }
    }

    AppState.data.settings.unit = targetUnit;
    AppState.saveToStorage();
    
    this.render();
  },

  injectDemoLogs() {
    if (!confirm("Populate mock calories and 7-day weight loss trend logs to preview layouts? (Will overwrite logs for dates conflict)")) return;

    const today = new Date();
    const unit = AppState.data.settings.unit;
    
    // Setup realistic weights decrementing based on unit
    const startWeight = unit === "lbs" ? 184.2 : 83.5;
    const dailyStep = unit === "lbs" ? 0.35 : 0.16;

    // Mock meals
    const mealTemplates = [
      { name: "Egg & Cheese English Muffin", brand: "Homemade Breakfast", calories: 340, protein: 18.0, carbs: 29.0, fats: 14.5 },
      { name: "Oatmeal with Blueberries & Honey", brand: "Quaker Oats", calories: 220, protein: 6.0, carbs: 42.0, fats: 3.0 },
      { name: "Grilled Chicken & Rice Salad", brand: "Fresh Prep", calories: 510, protein: 44.0, carbs: 55.0, fats: 9.0 },
      { name: "Whey Isolate Shake", brand: "Optimum Nutrition", calories: 150, protein: 30.0, carbs: 3.0, fats: 1.5 },
      { name: "Pan Seared Salmon & Asparagus", brand: "Healthy Kitchen", calories: 480, protein: 38.0, carbs: 12.0, fats: 26.0 },
      { name: "Greek Yogurt & Granola Bowl", brand: "Fage Yogurt", calories: 280, protein: 19.0, carbs: 32.0, fats: 5.0 }
    ];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateISO = WeightChartManager.formatISODate(d);

      // Decrementing Weight trend
      AppState.data.weights[dateISO] = parseFloat((startWeight - (6 - i) * dailyStep + (Math.random() * 0.4 - 0.2)).toFixed(1));

      // Dynamic daily meals
      const dayMeals = [];
      const mealIndices = i % 2 === 0 ? [0, 2, 4] : [1, 3, 5];
      
      mealIndices.forEach((idx) => {
        const templ = mealTemplates[idx];
        dayMeals.push({
          id: `food_demo_${i}_${idx}_` + Math.random().toString(36).substr(2, 5),
          name: templ.name,
          brand: templ.brand,
          weight: 150,
          calories: templ.calories,
          protein: templ.protein,
          carbs: templ.carbs,
          fats: templ.fats
        });
      });

      AppState.data.meals[dateISO] = dayMeals;
    }

    AppState.saveToStorage();
    alert("Demo logs populated! Redirecting to Dashboard to view your macros.");
    appRouter.navigate("dashboard");
  },

  purgeStorageData() {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL logged weights, calorie logs, and goals! Are you absolutely sure?")) return;
    
    localStorage.removeItem(AppState.storageKey);
    // Hard refresh window to reset DOM memory
    window.location.reload();
  },

  importRenphoCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        alert("The selected file appears to be empty or has no weight data rows.");
        return;
      }

      function parseCSVRow(line) {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      }

      const headers = parseCSVRow(lines[0]);
      let timeIdx = -1;
      let weightIdx = -1;

      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase();
        if (h.includes("time of measurement") || h.includes("time") || h.includes("date")) {
          if (timeIdx === -1) timeIdx = i;
        }
        if (h.includes("weight") || h.includes("wt") || h.includes("lbs") || h.includes("kg") || h.includes("weight value")) {
          if (weightIdx === -1) weightIdx = i;
        }
      }

      if (timeIdx === -1 || weightIdx === -1) {
        alert("Could not identify Date/Time and Weight columns in the CSV. Please make sure this is a Renpho CSV export.");
        return;
      }

      const headerWeightStr = headers[weightIdx].toLowerCase();
      let fileUnit = null;
      if (headerWeightStr.includes("kg")) {
        fileUnit = "kg";
      } else if (headerWeightStr.includes("lb") || headerWeightStr.includes("lbs")) {
        fileUnit = "lbs";
      }

      const activeUnit = AppState.data.settings.unit;
      let importCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = parseCSVRow(line);
        if (cells.length <= Math.max(timeIdx, weightIdx)) continue;

        const rawDate = cells[timeIdx];
        const rawWeight = cells[weightIdx];
        if (!rawDate || !rawWeight) continue;

        let dateKey = null;
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          dateKey = WeightChartManager.formatISODate(d);
        } else {
          const match = rawDate.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (match) {
            dateKey = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
          }
        }

        if (!dateKey) continue;

        const weightClean = rawWeight.replace(/[^\d.]/g, "");
        let weightVal = parseFloat(weightClean);
        if (isNaN(weightVal) || weightVal <= 0) continue;

        if (fileUnit && fileUnit !== activeUnit) {
          if (activeUnit === "kg" && fileUnit === "lbs") {
            weightVal = parseFloat((weightVal / 2.20462).toFixed(1));
          } else if (activeUnit === "lbs" && fileUnit === "kg") {
            weightVal = parseFloat((weightVal * 2.20462).toFixed(1));
          }
        } else {
          weightVal = parseFloat(weightVal.toFixed(1));
        }

        AppState.data.weights[dateKey] = weightVal;
        importCount++;
      }

      if (importCount > 0) {
        AppState.saveToStorage();
        alert(`Success! Imported ${importCount} weight records from Renpho.`);
        event.target.value = "";
        
        appRouter.refreshCurrentView();
      } else {
        alert("No valid weight data points were found in the selected file.");
      }
    };

    reader.onerror = () => {
      alert("Error reading the CSV file.");
    };

    reader.readAsText(file);
  },

  // Export database logs in CSV format suited for Google Sheets copy-pasting
  exportCSV() {
    const allDates = new Set([
      ...Object.keys(AppState.data.weights),
      ...Object.keys(AppState.data.meals)
    ]);
    const sortedDates = Array.from(allDates).sort(); // oldest first is best for sheets
    
    let csvContent = "Date,Weight (" + AppState.data.settings.unit + "),Calories Eaten (kcal),Protein Eaten (g),Carbs Eaten (g),Fats Eaten (g),Calorie Target (kcal)\n";
    
    sortedDates.forEach(dateISO => {
      const weight = AppState.data.weights[dateISO] !== undefined ? AppState.data.weights[dateISO] : "";
      const meals = AppState.data.meals[dateISO] || [];
      const goals = AppState.getGoalsForDate(dateISO);
      
      let eatenKcal = 0;
      let eatenProtein = 0;
      let eatenCarbs = 0;
      let eatenFats = 0;
      
      meals.forEach(m => {
        eatenKcal += m.calories;
        eatenProtein += m.protein;
        eatenCarbs += m.carbs;
        eatenFats += m.fats;
      });
      
      csvContent += `${dateISO},${weight},${Math.round(eatenKcal)},${eatenProtein.toFixed(1)},${eatenCarbs.toFixed(1)},${eatenFats.toFixed(1)},${goals.calories}\n`;
    });
    
    // Download trigger
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `colins_macros_backup_${AppState.getTodayISODate()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    AppState.showToast("Google Sheets CSV Exported!");
  },

  // Export raw JSON backup of entire database
  exportJSON() {
    const dataStr = JSON.stringify(AppState.data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `colins_macros_db_${AppState.getTodayISODate()}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    AppState.showToast("JSON Database Backup downloaded!");
  },

  // Restore database from raw JSON backup file
  importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        
        // Critical structure validation checks
        if (!parsed.standardGoals || !parsed.meals || !parsed.weights || !parsed.settings) {
          alert("Invalid backup file structure. Ensure this is a valid ColinsChartsMacros database export.");
          return;
        }
        
        if (confirm("This will completely replace all your current settings and history records with this backup file. Proceed?")) {
          AppState.data = parsed;
          AppState.saveToStorage();
          AppState.showToast("App database restored!");
          
          // Force hard reload of application to reload memory states cleanly
          window.location.reload();
        }
      } catch (err) {
        alert("Failed to parse the backup file: " + err.message);
      } finally {
        event.target.value = ""; // Reset file selector
      }
    };
    reader.readAsText(file);
  }
};

// Day Selector Calendar Logic
const CalendarSelectorController = {
  labelEl: null,
  btnPrev: null,
  btnNext: null,

  init() {
    this.labelEl = document.getElementById("current-day-label");
    this.btnPrev = document.getElementById("btn-prev-day");
    this.btnNext = document.getElementById("btn-next-day");

    this.btnPrev.addEventListener("click", () => this.shiftDay(-1));
    this.btnNext.addEventListener("click", () => this.shiftDay(1));

    this.updateLabel();
  },

  shiftDay(offsetDays) {
    const current = new Date(AppState.selectedDateISO + "T00:00:00");
    current.setDate(current.getDate() + offsetDays);
    
    AppState.selectedDateISO = WeightChartManager.formatISODate(current);
    
    this.updateLabel();
    appRouter.refreshCurrentView();
  },

  updateLabel() {
    const selected = new Date(AppState.selectedDateISO + "T00:00:00");
    const today = new Date(AppState.getTodayISODate() + "T00:00:00");

    const diffTime = selected.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      this.labelEl.textContent = "Today";
    } else if (diffDays === -1) {
      this.labelEl.textContent = "Yesterday";
    } else if (diffDays === 1) {
      this.labelEl.textContent = "Tomorrow";
    } else {
      this.labelEl.textContent = selected.toLocaleDateString("en-US", { 
        weekday: "short", 
        month: "short", 
        day: "numeric", 
        timeZone: "UTC" 
      });
    }
  }
};

// Recipe Builder Controller (Manages #panel-add-recipe)
const RecipeBuilderController = {
  ingredients: [], // current recipe ingredients being built
  
  init() {
    // Custom ingredient toggle
    const toggleBtn = document.getElementById("toggle-recipe-custom-form-btn");
    const customForm = document.getElementById("recipe-custom-food-form");
    const customCard = document.getElementById("recipe-custom-food-card");

    if (toggleBtn && customForm && customCard) {
      toggleBtn.addEventListener("click", () => {
        const isHidden = customForm.classList.contains("hidden");
        if (isHidden) {
          customForm.classList.remove("hidden");
          customCard.classList.add("active");
        } else {
          customForm.classList.add("hidden");
          customCard.classList.remove("active");
        }
      });
    }

    // Auto-calculate calories for custom ingredient
    const customProtein = document.getElementById("recipe-custom-protein");
    const customCarbs = document.getElementById("recipe-custom-carbs");
    const customFats = document.getElementById("recipe-custom-fats");
    const customCalInput = document.getElementById("recipe-custom-calories");

    if (customProtein && customCarbs && customFats && customCalInput) {
      const updateCalculatedCalories = () => {
        let p = parseFloat(customProtein.value) || 0;
        let c = parseFloat(customCarbs.value) || 0;
        let f = parseFloat(customFats.value) || 0;
        let kcal = Math.round((p * 4) + (c * 4) + (f * 9));
        customCalInput.value = kcal > 0 ? kcal : "";
      };

      customProtein.addEventListener("input", updateCalculatedCalories);
      customCarbs.addEventListener("input", updateCalculatedCalories);
      customFats.addEventListener("input", updateCalculatedCalories);
    }

    // Submit custom ingredient form
    const customIngForm = document.getElementById("recipe-custom-food-form");
    if (customIngForm) {
      customIngForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addCustomIngredientSubmit();
      });
    }

    // Save recipe button
    const btnSave = document.getElementById("btn-save-recipe");
    if (btnSave) {
      btnSave.addEventListener("click", () => {
        this.saveRecipe();
      });
    }
  },

  render() {
    this.renderIngredients();
    
    // Clear forms and previews
    const preview = document.getElementById("food-detail-card-recipe");
    if (preview) preview.classList.add("hidden");
    const notFound = document.getElementById("barcode-not-found-card-recipe");
    if (notFound) notFound.classList.add("hidden");
  },

  addIngredient(ing) {
    this.ingredients.push(ing);
    this.renderIngredients();
  },

  addCustomIngredientSubmit() {
    const name = document.getElementById("recipe-custom-name").value;
    const kcal = Math.round(Number(document.getElementById("recipe-custom-calories").value));
    const protein = parseFloat(Number(document.getElementById("recipe-custom-protein").value).toFixed(1));
    const carbs = parseFloat(Number(document.getElementById("recipe-custom-carbs").value).toFixed(1));
    const fats = parseFloat(Number(document.getElementById("recipe-custom-fats").value).toFixed(1));
    const weight = parseFloat(document.getElementById("recipe-custom-weight").value);

    if (!name || isNaN(weight) || weight <= 0) {
      alert("Please enter a valid ingredient name and weight.");
      return;
    }

    const newIng = {
      name: name,
      brand: "Custom Ingredient",
      weight: weight,
      nutrients: {
        calories: kcal,
        protein: protein,
        carbs: carbs,
        fats: fats
      }
    };

    this.addIngredient(newIng);

    // Reset custom ingredient form
    const form = document.getElementById("recipe-custom-food-form");
    if (form) {
      form.reset();
      form.classList.add("hidden");
    }
    const card = document.getElementById("recipe-custom-food-card");
    if (card) {
      card.classList.remove("active");
    }

    AppState.showToast("Custom ingredient added!");
  },

  renderIngredients() {
    const container = document.getElementById("recipe-ingredients-list-container");
    if (!container) return;

    if (this.ingredients.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No ingredients added yet.</p>
        </div>
      `;
      this.updateRecipeTotals(0, 0, 0, 0, 0);
      return;
    }

    container.innerHTML = "";
    
    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;
    let totalWeight = 0;

    this.ingredients.forEach((ing, index) => {
      totalKcal += ing.nutrients.calories;
      totalProtein += ing.nutrients.protein;
      totalCarbs += ing.nutrients.carbs;
      totalFats += ing.nutrients.fats;
      totalWeight += ing.weight;

      const item = document.createElement("div");
      item.className = "meal-item";
      item.innerHTML = `
        <div class="meal-info">
          <span class="meal-name">${ing.name}</span>
          <span class="meal-sub">${ing.brand} • ${ing.weight}g</span>
          <div class="meal-macros">
            <span class="m-tag p">P: ${ing.nutrients.protein}g</span>
            <span class="m-tag c">C: ${ing.nutrients.carbs}g</span>
            <span class="m-tag f">F: ${ing.nutrients.fats}g</span>
          </div>
        </div>
        <div class="meal-kcal-block">
          <span class="meal-kcal">${ing.nutrients.calories} <span style="font-size:0.75rem">kcal</span></span>
          <button class="btn-delete-ingredient" aria-label="Delete ingredient" data-index="${index}">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      `;

      item.querySelector(".btn-delete-ingredient").addEventListener("click", () => {
        this.deleteIngredient(index);
      });

      container.appendChild(item);
    });

    this.updateRecipeTotals(totalKcal, totalProtein, totalCarbs, totalFats, totalWeight);
  },

  deleteIngredient(index) {
    this.ingredients.splice(index, 1);
    this.renderIngredients();
  },

  updateRecipeTotals(kcal, protein, carbs, fats, weight) {
    document.getElementById("recipe-total-kcal").textContent = Math.round(kcal);
    document.getElementById("recipe-total-protein").textContent = `${protein.toFixed(1)}g`;
    document.getElementById("recipe-total-carbs").textContent = `${carbs.toFixed(1)}g`;
    document.getElementById("recipe-total-fats").textContent = `${fats.toFixed(1)}g`;
    document.getElementById("recipe-total-weight").textContent = `${weight.toFixed(0)}g`;
  },

  saveRecipe() {
    const nameInput = document.getElementById("recipe-name-field");
    const name = nameInput ? nameInput.value.trim() : "";

    if (!name) {
      alert("Please enter a Recipe Name.");
      return;
    }

    if (this.ingredients.length === 0) {
      alert("Please add at least one ingredient to save a recipe.");
      return;
    }

    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;
    let totalWeight = 0;

    this.ingredients.forEach(ing => {
      totalKcal += ing.nutrients.calories;
      totalProtein += ing.nutrients.protein;
      totalCarbs += ing.nutrients.carbs;
      totalFats += ing.nutrients.fats;
      totalWeight += ing.weight;
    });

    const recipeId = "recipe_" + Date.now();
    const newRecipe = {
      id: recipeId,
      name: name,
      ingredients: [...this.ingredients],
      nutrients: {
        calories: Math.round(totalKcal),
        protein: parseFloat(totalProtein.toFixed(1)),
        carbs: parseFloat(totalCarbs.toFixed(1)),
        fats: parseFloat(totalFats.toFixed(1))
      },
      totalWeight: totalWeight
    };

    AppState.data.recipes[recipeId] = newRecipe;
    AppState.saveToStorage();

    // Reset Recipe Builder state
    this.ingredients = [];
    if (nameInput) nameInput.value = "";
    this.render();

    AppState.showToast("Recipe saved successfully!");
    
    // Go back to food log view
    appRouter.navigate("food");
  }
};

// Food Selector Controller (Manages #panel-food-selector)
const FoodSelectorController = {
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

    // Log food button click
    const btnLogFood = document.getElementById("btn-log-selector-food");
    if (btnLogFood) {
      btnLogFood.addEventListener("click", () => {
        this.logSelectedFood();
      });
    }

    // Setup selector trigger buttons on Dashboard and Food tab
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
          appRouter.navigate("food");
        }
      });
    }
  },

  openSelector(context) {
    this.activeContext = context;
    this.closePreview();
    
    // Clear search inputs
    const searchInput = document.getElementById("history-search-input");
    if (searchInput) searchInput.value = "";
    const onlineSearchInput = document.getElementById("online-search-input");
    if (onlineSearchInput) onlineSearchInput.value = "";

    const btnRecipes = document.getElementById("btn-tab-recipes");
    const btnHistory = document.getElementById("btn-tab-history");
    const btnTabSearch = document.getElementById("btn-tab-search");

    if (context === "recipe_ingredient") {
      // Hide Recipes and Search Online tab headers entirely
      if (btnRecipes) btnRecipes.classList.add("hidden");
      if (btnTabSearch) btnTabSearch.classList.add("hidden");
      
      // Force active tab to history
      this.setTabActive("history");
      if (btnHistory) btnHistory.classList.remove("hidden");
    } else {
      // Show Recipes and Search Online tab headers
      if (btnRecipes) btnRecipes.classList.remove("hidden");
      if (btnTabSearch) btnTabSearch.classList.remove("hidden");
      if (btnHistory) btnHistory.classList.remove("hidden");
      
      // Default active tab: Search Online
      this.setTabActive("search");
    }

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
          fats: parseFloat((meal.fats * scale).toFixed(1))
        };

        if (!historyMap[key]) {
          historyMap[key] = {
            name: meal.name,
            brand: meal.brand,
            nutrients: normalized,
            count: 0
          };
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
          count: 1
        };
      } else {
        historyMap[key].count += 2; // boost priority
      }
    });

    // Sort by log frequency descending
    return Object.values(historyMap).sort((a, b) => b.count - a.count);
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
      item.innerHTML = `
        <div class="meal-info">
          <span class="meal-name" style="font-weight: 600;">${food.name}</span>
          <span class="meal-sub">${food.brand} • per 100g</span>
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

    if (titleEl) titleEl.textContent = food.name;
    if (subtitleEl) subtitleEl.textContent = food.brand || (type === "recipe" ? "Recipe" : "Generic");

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
      
      if (weightLabel) weightLabel.textContent = this.activeContext === "recipe_ingredient" ? "Weight in Recipe (grams)" : "Weight Eaten (grams)";
      if (weightUnit) weightUnit.textContent = "g";
      if (weightInput) {
        weightInput.value = 100;
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
      
      // Smooth scroll the clicked element and its preview card into view nicely
      clickedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      factor = inputVal / 100; // grams weight scale per 100g
    }

    const raw = food.nutrients;
    document.getElementById("selector-scaled-kcal").textContent = Math.round(raw.calories * factor);
    document.getElementById("selector-scaled-protein").textContent = `${(raw.protein * factor).toFixed(1)}g`;
    document.getElementById("selector-scaled-carbs").textContent = `${(raw.carbs * factor).toFixed(1)}g`;
    document.getElementById("selector-scaled-fats").textContent = `${(raw.fats * factor).toFixed(1)}g`;
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
    if (type === "recipe") {
      factor = inputVal;
    } else {
      factor = inputVal / 100;
    }

    const raw = food.nutrients;

    if (this.activeContext === "recipe_ingredient") {
      // Add as ingredient to the Recipe Builder
      const newIng = {
        name: food.name,
        brand: food.brand || "Generic",
        weight: inputVal,
        nutrients: {
          calories: Math.round(raw.calories * factor),
          protein: parseFloat((raw.protein * factor).toFixed(1)),
          carbs: parseFloat((raw.carbs * factor).toFixed(1)),
          fats: parseFloat((raw.fats * factor).toFixed(1))
        }
      };

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
      weight: type === "recipe" ? Math.round(food.totalWeight * factor) : inputVal,
      calories: Math.round(raw.calories * factor),
      protein: parseFloat((raw.protein * factor).toFixed(1)),
      carbs: parseFloat((raw.carbs * factor).toFixed(1)),
      fats: parseFloat((raw.fats * factor).toFixed(1))
    };

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

// Global App Initialization Hooks
window.addEventListener("DOMContentLoaded", () => {
  AppState.init();
  appRouter.init();
  CalendarSelectorController.init();
  
  // Tab-specific controllers initialization
  ScannerViewController.init();
  RecipeBuilderController.init();
  FoodSelectorController.init();
  WeightController.init();
  StrategyController.init();
  SettingsController.init();

  // Run initial dashboard view render
  appRouter.navigate("dashboard");

  // Track and monitor active midnight resets while app is running
  setInterval(() => {
    const todayStr = AppState.getTodayISODate();
    if (todayStr !== AppState.getTodayISODate()) {
      console.log("[Rollover] Midnight crossed. Refreshing calendar context...");
      AppState.selectedDateISO = todayStr;
      CalendarSelectorController.updateLabel();
      appRouter.refreshCurrentView();
    }
  }, 30000); // Clock check once every 30 seconds
});
