/**
 * ColinsChartsMacros - State Management Module
 * Manages user preference syncing, local storage deep merges, and daily goal/log requests.
 */

window.AppState = {
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
      activePreset: null, // "normal-protein", "high-protein", etc.
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
  },

  getMealTimestamp(meal) {
    if (meal.loggedAt) return meal.loggedAt;
    if (meal.id) {
      const parts = meal.id.split("_");
      for (const part of parts) {
        if (/^\d{13}$/.test(part)) {
          return parseInt(part);
        }
      }
    }
    return null;
  },

  formatTimeOfDay(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  },

  formatLastLogged(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
    const timeStr = this.formatTimeOfDay(timestamp);
    if (isToday) {
      return `today at ${timeStr}`;
    }
    const options = { month: "short", day: "numeric" };
    const dateStr = date.toLocaleDateString("en-US", options);
    return `${dateStr} at ${timeStr}`;
  }
};
