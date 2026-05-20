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
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      },
      highCalorieSurplusType: "flat",
      highCalorieSurplusValue: 300
    },
    profile: {
      sex: "male",
      age: 30,
      heightFt: 5,
      heightIn: 10,
      activity: "light",
      targetWeight: 170,
      weeklyRate: 1.0
    }
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
        if (parsed.settings) this.data.settings = { ...this.data.settings, ...parsed.settings };
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
      
      if (this.data.settings.highCalorieDays[dayName]) {
        // Calculate surplus
        let surplus = 0;
        if (this.data.settings.highCalorieSurplusType === "flat") {
          surplus = Number(this.data.settings.highCalorieSurplusValue) || 0;
        } else if (this.data.settings.highCalorieSurplusType === "percent") {
          const pct = Number(this.data.settings.highCalorieSurplusValue) || 0;
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
          surplusApplied: Math.round(surplus)
        };
      }
    }
    
    return {
      ...baseGoals,
      isHighCalorieDay: false,
      surplusApplied: 0
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

// Simple Single Page App Router
const appRouter = {
  panels: {},
  navItems: [],

  init() {
    this.panels = {
      dashboard: document.getElementById("panel-dashboard"),
      weight: document.getElementById("panel-weight"),
      weight_planner: document.getElementById("panel-weight-planner"),
      weight_budgets: document.getElementById("panel-weight-budgets"),
      settings: document.getElementById("panel-settings")
    };
    this.navItems = document.querySelectorAll(".app-navbar .nav-item");

    this.navItems.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        this.navigate(tab);
      });
    });
  },

  navigate(tabName) {
    if (!this.panels[tabName]) return;
    
    // Close camera scanner stream cleanly if leaving the dashboard tab
    if (AppState.activeTab === "dashboard" && tabName !== "dashboard") {
      BarcodeScannerManager.stop();
    }

    AppState.activeTab = tabName;

    // Toggle panels
    Object.keys(this.panels).forEach((key) => {
      if (key === tabName) {
        this.panels[key].classList.add("active");
      } else {
        this.panels[key].classList.remove("active");
      }
    });

    // Toggle navigation buttons
    this.navItems.forEach((btn) => {
      const btnTab = btn.getAttribute("data-tab");
      const isWeightRelated = (tabName === "weight" || tabName === "weight_planner" || tabName === "weight_budgets");
      if (btnTab === tabName || (btnTab === "weight" && isWeightRelated)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Render contents specific to active tabs
    this.refreshCurrentView();
  },

  refreshCurrentView() {
    if (AppState.activeTab === "dashboard") {
      DashboardController.render();
    } else if (AppState.activeTab === "weight") {
      WeightController.render();
    } else if (AppState.activeTab === "weight_planner" || AppState.activeTab === "weight_budgets") {
      SettingsController.render();
    } else if (AppState.activeTab === "settings") {
      SettingsController.render();
    }
  }
};

// Dashboard Controller (Progress circles, Bars, Eaten meal items)
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
    const strokeDash = 251.2; // 2 * PI * r (40)
    let offset = strokeDash;
    
    if (goals.calories > 0) {
      const clampedPct = Math.min(eatenKcal / goals.calories, 1.0);
      offset = strokeDash - (strokeDash * clampedPct);
    }
    ring.style.strokeDashoffset = offset;

    // Show/hide high calorie day refeed badge
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
      badgeEl.textContent = `🔥 +${goals.surplusApplied} kcal Refeed Day`;
      badgeEl.classList.remove("hidden");
    } else if (badgeEl) {
      badgeEl.classList.add("hidden");
    }

    // Macro Progress Bars
    this.updateMacroRow("protein", eatenProtein, goals.protein);
    this.updateMacroRow("carbs", eatenCarbs, goals.carbs);
    this.updateMacroRow("fats", eatenFats, goals.fats);

    // List meals eaten today
    this.renderMealList(meals);
  },

  updateMacroRow(macroName, eaten, target) {
    document.getElementById(`val-${macroName}-eaten`).textContent = Math.round(eaten);
    document.getElementById(`val-${macroName}-target`).textContent = Math.round(target);
    
    const pct = target > 0 ? Math.min((eaten / target) * 100, 100) : 0;
    document.getElementById(`bar-${macroName}`).style.width = `${pct}%`;
  },

  renderMealList(meals) {
    const container = document.getElementById("meals-list-container");
    document.getElementById("meals-count-badge").textContent = `${meals.length} item${meals.length === 1 ? '' : 's'}`;

    if (meals.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          <p>No food logged for this day yet.</p>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('btn-start-scan').scrollIntoView({behavior: 'smooth'})">Scan Food Now</button>
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
  }
};

// Scanner & Barcode View Controller
const ScannerViewController = {
  currentFetchedProduct: null, // Temporary store for the active query result

  init() {
    // 1. Collapsible custom form toggle
    const toggleHeader = document.getElementById("toggle-custom-form-btn");
    const customForm = document.getElementById("custom-food-form");
    const customCard = document.getElementById("custom-food-card");

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

    // 2. Camera Trigger Actions
    document.getElementById("btn-start-scan").addEventListener("click", () => {
      BarcodeScannerManager.start((barcode) => {
        this.triggerProductLookup(barcode);
      });
    });

    document.getElementById("btn-stop-scan").addEventListener("click", () => {
      BarcodeScannerManager.stop();
    });

    // 3. Manual code entry search click
    document.getElementById("btn-lookup-barcode").addEventListener("click", () => {
      const code = document.getElementById("manual-barcode-field").value;
      if (code) {
        this.triggerProductLookup(code);
      }
    });

    // Close preview card trigger
    document.getElementById("btn-close-preview").addEventListener("click", () => {
      this.closePreview();
    });

    // 4. Serving Gram Scaler Input Listener
    const weightInput = document.getElementById("food-weight-input");
    weightInput.addEventListener("input", () => {
      this.updateScaledMacros();
    });
    weightInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.addScaledProductToLog();
      }
    });

    // 5. Scaled add button
    document.getElementById("btn-add-scaled-food").addEventListener("click", () => {
      this.addScaledProductToLog();
    });

    // 6. Custom manual food log form submission
    document.getElementById("custom-food-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.addCustomFoodLog();
    });

    // 7. Auto-calculate custom calories from custom macros
    const customProtein = document.getElementById("custom-protein");
    const customCarbs = document.getElementById("custom-carbs");
    const customFats = document.getElementById("custom-fats");
    const customCalInput = document.getElementById("custom-calories");

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
  },

  async triggerProductLookup(barcode) {
    const inputField = document.getElementById("manual-barcode-field");
    const searchBtn = document.getElementById("btn-lookup-barcode");
    
    inputField.disabled = true;
    searchBtn.disabled = true;
    searchBtn.textContent = "Loading...";

    try {
      const product = await FoodDatabase.lookupBarcode(barcode);
      this.currentFetchedProduct = product;
      
      // Populate elements
      document.getElementById("preview-food-name").textContent = product.name;
      document.getElementById("preview-food-brand").textContent = product.brand;
      
      document.getElementById("preview-100g-kcal").textContent = product.nutrients.calories;
      document.getElementById("preview-100g-protein").textContent = product.nutrients.protein;
      document.getElementById("preview-100g-carbs").textContent = product.nutrients.carbs;
      document.getElementById("preview-100g-fats").textContent = product.nutrients.fats;

      // Set standard weight scale to 100g
      document.getElementById("food-weight-input").value = 100;
      this.updateScaledMacros();

      // Show preview card, hide loader
      document.getElementById("food-detail-card").classList.remove("hidden");
      
      // Scroll to detail preview card on small mobile browsers
      document.getElementById("food-detail-card").scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      alert("Product details could not be found or barcode is invalid. Try adding it below as a Custom Food.");
    } finally {
      inputField.disabled = false;
      searchBtn.disabled = false;
      searchBtn.textContent = "Search";
      inputField.value = "";
    }
  },

  updateScaledMacros() {
    if (!this.currentFetchedProduct) return;
    
    let weight = parseFloat(document.getElementById("food-weight-input").value);
    if (isNaN(weight) || weight <= 0) weight = 0;

    const raw = this.currentFetchedProduct.nutrients;
    const factor = weight / 100;

    document.getElementById("scaled-kcal").textContent = Math.round(raw.calories * factor);
    document.getElementById("scaled-protein").textContent = `${(raw.protein * factor).toFixed(1)}g`;
    document.getElementById("scaled-carbs").textContent = `${(raw.carbs * factor).toFixed(1)}g`;
    document.getElementById("scaled-fats").textContent = `${(raw.fats * factor).toFixed(1)}g`;
  },

  addScaledProductToLog() {
    if (!this.currentFetchedProduct) return;

    let weight = parseFloat(document.getElementById("food-weight-input").value);
    if (isNaN(weight) || weight <= 0) {
      alert("Please enter a valid weight in grams.");
      return;
    }

    const raw = this.currentFetchedProduct.nutrients;
    const factor = weight / 100;

    const newLogItem = {
      id: "food_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: this.currentFetchedProduct.name,
      brand: this.currentFetchedProduct.brand,
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

    // Close preview card cleanly, reset state
    this.closePreview();
    
    // Rerender dashboard directly
    DashboardController.render();
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
    document.getElementById("custom-food-form").reset();
    document.getElementById("custom-food-form").classList.add("hidden");
    document.getElementById("custom-food-card").classList.remove("active");

    DashboardController.render();
    AppState.showToast("Custom food item added!");
  },

  closePreview() {
    this.currentFetchedProduct = null;
    document.getElementById("food-detail-card").classList.add("hidden");
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
    document.getElementById("lbl-weight-unit").textContent = unit;

    const inputField = document.getElementById("weight-input");
    const statusBox = document.getElementById("today-weight-status-container");
    const statusText = document.getElementById("today-weight-text");

    if (loggedVal !== null) {
      inputField.value = loggedVal.toFixed(1);
      statusBox.classList.add("active");
      statusText.innerHTML = `Logged weight for today: <strong>${loggedVal.toFixed(1)} ${unit}</strong>`;
    } else {
      inputField.value = "";
      statusBox.classList.remove("active");
    }

    // Refresh history chart and calculations
    WeightChartManager.renderChart(AppState.data.weights, dateKey, unit);
    
    // Render 7-Day Calorie History
    this.renderCalorieHistory();
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
    AppState.showToast("Weight logged successfully!");
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

// App Settings & Configuration Controller
const SettingsController = {
  init() {
    // 1. Config form updates
    document.getElementById("targets-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveStandardTargets();
    });

    // 2. Unit selector adjustments
    const btnLbs = document.getElementById("btn-unit-lbs");
    const btnKg = document.getElementById("btn-unit-kg");

    btnLbs.addEventListener("click", () => this.toggleWeightUnit("lbs"));
    btnKg.addEventListener("click", () => this.toggleWeightUnit("kg"));

    // 3. Mock Data trigger
    document.getElementById("btn-load-mock").addEventListener("click", () => this.injectDemoLogs());

    // 4. Data Wipe actions
    document.getElementById("btn-clear-data").addEventListener("click", () => this.purgeStorageData());

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

    // 9. Calorie Cycling Event Listeners
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

    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    weekdays.forEach(day => {
      const el = document.getElementById(`cycling-day-${day}`);
      if (el) {
        el.addEventListener("change", (e) => {
          AppState.data.settings.highCalorieDays[day] = e.target.checked;
          AppState.saveToStorage();
          DashboardController.render();
        });
      }
    });

    const surplusType = document.getElementById("cycling-surplus-type");
    if (surplusType) {
      surplusType.addEventListener("change", (e) => {
        AppState.data.settings.highCalorieSurplusType = e.target.value;
        AppState.saveToStorage();
        this.updateSurplusUnitLabel();
        DashboardController.render();
      });
    }

    const surplusValue = document.getElementById("cycling-surplus-value");
    if (surplusValue) {
      surplusValue.addEventListener("input", (e) => {
        AppState.data.settings.highCalorieSurplusValue = Number(e.target.value) || 0;
        AppState.saveToStorage();
        DashboardController.render();
      });
    }
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

  updateSurplusUnitLabel() {
    const type = AppState.data.settings.highCalorieSurplusType;
    const label = document.getElementById("cycling-surplus-unit-label");
    if (label) {
      label.textContent = type === "flat" ? "kcal" : "%";
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

    // Calorie Cycling UI Populating
    const cyclingEnabled = AppState.data.settings.highCalorieDaysEnabled;
    const cyclingToggle = document.getElementById("cycling-enabled");
    if (cyclingToggle) {
      cyclingToggle.checked = cyclingEnabled;
    }
    this.toggleCyclingBodyVisibility();

    const cyclingWeekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    cyclingWeekdays.forEach(day => {
      const el = document.getElementById(`cycling-day-${day}`);
      if (el) {
        el.checked = AppState.data.settings.highCalorieDays[day] || false;
      }
    });

    const surplusType = document.getElementById("cycling-surplus-type");
    if (surplusType) {
      surplusType.value = AppState.data.settings.highCalorieSurplusType || "flat";
    }
    this.updateSurplusUnitLabel();

    const surplusValue = document.getElementById("cycling-surplus-value");
    if (surplusValue) {
      surplusValue.value = AppState.data.settings.highCalorieSurplusValue !== undefined ? AppState.data.settings.highCalorieSurplusValue : 300;
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

    // Persist variables immediately so they don't wipe on tab switches
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

    // Display summary results
    document.getElementById("planner-cal-result").textContent = targetCalories.toLocaleString();
    document.getElementById("planner-tdee-result").textContent = `${Math.round(tdee).toLocaleString()} kcal`;
    document.getElementById("planner-weeks-result").textContent = weeksToGoal > 0 ? `${weeksToGoal.toFixed(1)} Weeks` : "0 Weeks";

    // Safety checks & warnings
    const warningBox = document.getElementById("planner-warning-box");
    const warningText = document.getElementById("planner-warning-text");

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

    // Support flexible overrides for the currently selected calendar day
    const dateKey = AppState.selectedDateISO;
    
    // Save to daily goals override list
    AppState.data.dailyGoals[dateKey] = {
      calories: kcal,
      protein: protein,
      carbs: carbs,
      fats: fats
    };

    // Save as standard default templates as well
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

    // Convert existing weight records automatically so data isn't broken
    const weights = AppState.data.weights;
    Object.keys(weights).forEach((dateKey) => {
      const original = weights[dateKey];
      if (targetUnit === "kg") {
        // lbs -> kg
        weights[dateKey] = parseFloat((original / 2.20462).toFixed(1));
      } else {
        // kg -> lbs
        weights[dateKey] = parseFloat((original * 2.20462).toFixed(1));
      }
    });

    // Proactively convert goal profile target weight and weekly rates
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

    // Mock meal ingredients
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

      // 1. Decrementing Weight trend (ideal line of best fit demonstration)
      AppState.data.weights[dateISO] = parseFloat((startWeight - (6 - i) * dailyStep + (Math.random() * 0.4 - 0.2)).toFixed(1));

      // 2. Dynamic daily macro food inputs
      const dayMeals = [];
      const mealIndices = i % 2 === 0 ? [0, 2, 4] : [1, 3, 5]; // alternates meals
      
      mealIndices.forEach((idx) => {
        const templ = mealTemplates[idx];
        dayMeals.push({
          id: `food_demo_${i}_${idx}_` + Math.random().toString(36).substr(2, 5),
          name: templ.name,
          brand: templ.brand,
          weight: 150, // gram scale
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

      // Helper to parse standard CSV row taking care of double quotes
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

      // Scan headers for target metrics
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase();
        if (h.includes("time of measurement") || h.includes("time") || h.includes("date")) {
          if (timeIdx === -1) timeIdx = i;
        }
        if (h.includes("weight") || h.includes("wt") || h.includes("lbs") || h.includes("kg") || h.includes("weight value")) {
          if (weightIdx === -1) weightIdx = i;
        }
      }

      // Check if critical columns were discovered
      if (timeIdx === -1 || weightIdx === -1) {
        alert("Could not identify Date/Time and Weight columns in the CSV. Please make sure this is a Renpho CSV export.");
        return;
      }

      // Check weight unit from header if possible
      const headerWeightStr = headers[weightIdx].toLowerCase();
      let fileUnit = null;
      if (headerWeightStr.includes("kg")) {
        fileUnit = "kg";
      } else if (headerWeightStr.includes("lb") || headerWeightStr.includes("lbs")) {
        fileUnit = "lbs";
      }

      const activeUnit = AppState.data.settings.unit;
      let importCount = 0;

      // Loop and parse each data row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = parseCSVRow(line);
        if (cells.length <= Math.max(timeIdx, weightIdx)) continue;

        const rawDate = cells[timeIdx];
        const rawWeight = cells[weightIdx];
        if (!rawDate || !rawWeight) continue;

        // Parse date safely
        let dateKey = null;
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          dateKey = WeightChartManager.formatISODate(d);
        } else {
          // Fallback match for YYYY-MM-DD
          const match = rawDate.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (match) {
            dateKey = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
          }
        }

        if (!dateKey) continue;

        // Clean weight characters (remove units, parse float)
        const weightClean = rawWeight.replace(/[^\d.]/g, "");
        let weightVal = parseFloat(weightClean);
        if (isNaN(weightVal) || weightVal <= 0) continue;

        // Convert weight units automatically if file and app units mismatch
        if (fileUnit && fileUnit !== activeUnit) {
          if (activeUnit === "kg" && fileUnit === "lbs") {
            // lbs -> kg
            weightVal = parseFloat((weightVal / 2.20462).toFixed(1));
          } else if (activeUnit === "lbs" && fileUnit === "kg") {
            // kg -> lbs
            weightVal = parseFloat((weightVal * 2.20462).toFixed(1));
          }
        } else {
          // Round weight strictly to 1 decimal place
          weightVal = parseFloat(weightVal.toFixed(1));
        }

        // Save entry
        AppState.data.weights[dateKey] = weightVal;
        importCount++;
      }

      if (importCount > 0) {
        AppState.saveToStorage();
        alert(`Success! Imported ${importCount} weight records from Renpho.`);
        // Reset file selector so same file can be reloaded
        event.target.value = "";
        
        // Refresh view/charts
        appRouter.refreshCurrentView();
        if (AppState.activeTab === "dashboard") {
          DashboardController.render();
        }
      } else {
        alert("No valid weight data points were found in the selected file.");
      }
    };

    reader.onerror = () => {
      alert("Error reading the CSV file.");
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
      // General form: Wed, May 20
      this.labelEl.textContent = selected.toLocaleDateString("en-US", { 
        weekday: "short", 
        month: "short", 
        day: "numeric", 
        timeZone: "UTC" 
      });
    }
  }
};

// Global App Initialization Hooks
window.addEventListener("DOMContentLoaded", () => {
  AppState.init();
  appRouter.init();
  CalendarSelectorController.init();
  
  // Tab-specific initializations
  ScannerViewController.init();
  WeightController.init();
  SettingsController.init();

  // Run initial dashboard view render
  appRouter.navigate("dashboard");

  // Track and monitor active midnight resets while app is running
  setInterval(() => {
    const todayStr = AppState.getTodayISODate();
    // If local date has drifted past our logged active date and we are viewing "Today"
    if (todayStr !== AppState.getTodayISODate()) {
      console.log("[Rollover] Midnight crossed. Refreshing calendar context...");
      AppState.selectedDateISO = todayStr;
      CalendarSelectorController.updateLabel();
      appRouter.refreshCurrentView();
    }
  }, 30000); // Clock check once every 30 seconds
});
