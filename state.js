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
      },
      algoliaConfig: {
        enabled: false,
        appId: "",
        apiKey: "",
        indexName: "foods"
      },
      usdaApiKey: "",
      geminiApiKey: ""
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
  toastFadeTimeout: null,

  init() {
    this.selectedDateISO = this.getTodayISODate();
    this.data = this.getDefaultSchema();
    this.loadFromStorage();
  },

  getDefaultSchema() {
    return {
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
        },
        algoliaConfig: {
          enabled: false,
          appId: "",
          apiKey: "",
          indexName: "foods"
        },
        usdaApiKey: "",
        geminiApiKey: ""
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
    };
  },

  deepClone(val) {
    if (val === null || val === undefined) return val;
    if (val instanceof Date) {
      return new Date(val.getTime());
    }
    if (Array.isArray(val)) {
      return val.map(item => this.deepClone(item));
    }
    if (typeof val === "object") {
      const clone = {};
      for (const k in val) {
        if (Object.prototype.hasOwnProperty.call(val, k)) {
          clone[k] = this.deepClone(val[k]);
        }
      }
      return clone;
    }
    return val;
  },

  reconcileSchema(defaultSchema, sourceData, isRoot = false) {
    const result = this.deepClone(defaultSchema);
    
    if (sourceData && typeof sourceData === "object" && !Array.isArray(sourceData)) {
      for (const key in sourceData) {
        if (Object.prototype.hasOwnProperty.call(sourceData, key)) {
          const sourceVal = sourceData[key];
          if (sourceVal === undefined) continue;
          
          if (Object.prototype.hasOwnProperty.call(result, key)) {
            const defaultVal = result[key];
            if (defaultVal && typeof defaultVal === "object" && !Array.isArray(defaultVal) &&
                sourceVal && typeof sourceVal === "object" && !Array.isArray(sourceVal)) {
              result[key] = this.reconcileSchema(defaultVal, sourceVal, false);
            } else {
              result[key] = this.deepClone(sourceVal);
            }
          } else {
            if (isRoot) {
              console.log(`[Schema Hygiene] Pruned unrecognized root schema key: ${key}`);
            } else {
              // Keep unrecognized/extra keys (e.g. from future features) to prevent data loss on sub-objects
              result[key] = this.deepClone(sourceVal);
            }
          }
        }
      }
    }
    
    return result;
  },

  runMigrations() {
    if (this.data.settings) {
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

      // Clean up legacy Typesense settings
      delete this.data.settings.typesenseConfig;

      // Migrate/initialize Algolia settings safely
      if (!this.data.settings.algoliaConfig) {
        this.data.settings.algoliaConfig = {
          enabled: false,
          appId: "",
          apiKey: "",
          indexName: "foods"
        };
      } else {
        this.data.settings.algoliaConfig = {
          enabled: this.data.settings.algoliaConfig.enabled || false,
          appId: this.data.settings.algoliaConfig.appId || "",
          apiKey: this.data.settings.algoliaConfig.apiKey || "",
          indexName: this.data.settings.algoliaConfig.indexName || "foods"
        };
      }


      // Migrate/initialize USDA API Key safely
      if (this.data.settings.usdaApiKey === undefined) {
        this.data.settings.usdaApiKey = "";
      }
      
      // Migrate/initialize Gemini API Key safely
      if (this.data.settings.geminiApiKey === undefined) {
        this.data.settings.geminiApiKey = "";
      }
    }
  },

  loadFromStorage() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Reconcile schema structure recursively using clean default as base
        this.data = this.reconcileSchema(this.getDefaultSchema(), parsed, true);
        
        // Run migrations to sanitize any old schema models
        this.runMigrations();
      } catch (e) {
        console.error("[Storage] Corrupt save file. Initializing standard defaults...", e);
      }
    }
  },

  restoreFromBackup(parsed) {
    if (!parsed || typeof parsed !== "object") return false;
    
    // Validate backup contains at least one core property of the application database
    const hasCoreData = parsed.standardGoals || parsed.meals || parsed.weights || parsed.settings || parsed.profile || parsed.recipes;
    if (!hasCoreData) return false;
    
    // Reconcile backup schema recursively using clean default as base
    this.data = this.reconcileSchema(this.getDefaultSchema(), parsed, true);
    
    // Run migrations immediately on the merged data
    this.runMigrations();
    
    // Persist to local storage
    this.saveToStorage();
    return true;
  },

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (err) {
      if (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 1014) {
        console.error("[Storage] LocalStorage quota exceeded!", err);
        this.showToast("⚠️ Storage full! Attempting to free space...");
        this.pruneOldData();
      } else {
        console.error("[Storage] Failed to save data to localStorage:", err);
      }
    }
  },

  pruneOldData() {
    try {
      console.log("[Storage] Attempting to prune old meals to free up space...");
      // Prune meals/weights older than 6 months
      const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000);
      let prunedMeals = 0;
      let prunedWeights = 0;

      if (this.data.meals) {
        Object.keys(this.data.meals).forEach(dateISO => {
          const date = new Date(dateISO + "T00:00:00");
          if (!isNaN(date.getTime()) && date.getTime() < sixMonthsAgo) {
            delete this.data.meals[dateISO];
            prunedMeals++;
          }
        });
      }

      if (this.data.weights) {
        Object.keys(this.data.weights).forEach(dateISO => {
          const date = new Date(dateISO + "T00:00:00");
          if (!isNaN(date.getTime()) && date.getTime() < sixMonthsAgo) {
            delete this.data.weights[dateISO];
            prunedWeights++;
          }
        });
      }

      if (prunedMeals > 0 || prunedWeights > 0) {
        console.log(`[Storage] Pruned ${prunedMeals} meal days and ${prunedWeights} weight logs.`);
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.data));
          this.showToast(`✨ Automatically freed space by pruning logs older than 6 months.`);
        } catch (e) {
          this.showToast("⚠️ Storage full! Please manually clear data in Settings.");
        }
      } else {
        this.showToast("⚠️ Storage full! Please delete some custom recipes or clear mock data.");
      }
    } catch (e) {
      console.error("[Storage] Pruning failed:", e);
    }
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
        
        // Keep protein constant
        const protein = baseGoals.protein;
        
        // Calculate remaining calories for carbs and fats in base goals
        const baseRemainingKcal = baseGoals.calories - (protein * 4);
        const adjustedRemainingKcal = adjustedCalories - (protein * 4);
        
        let carbs, fats;
        if (baseRemainingKcal > 0 && adjustedRemainingKcal > 0) {
          const remainingScalingFactor = adjustedRemainingKcal / baseRemainingKcal;
          carbs = Math.max(Math.round(baseGoals.carbs * remainingScalingFactor), 10);
          fats = Math.max(Math.round(baseGoals.fats * remainingScalingFactor), 5);
        } else {
          // Fallback to proportional scaling if calories are extremely low or invalid
          const scalingFactor = baseGoals.calories > 0 ? (adjustedCalories / baseGoals.calories) : 1;
          carbs = Math.max(Math.round(baseGoals.carbs * scalingFactor), 10);
          fats = Math.max(Math.round(baseGoals.fats * scalingFactor), 5);
        }
        
        // Reconcile calories to match the actual macros exactly
        const reconciledCalories = Math.round(protein * 4 + carbs * 4 + fats * 9);
        
        return {
          calories: reconciledCalories,
          protein: protein,
          carbs: carbs,
          fats: fats,
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

    // Clear any existing timeouts on the toast
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    if (this.toastFadeTimeout) {
      clearTimeout(this.toastFadeTimeout);
      this.toastFadeTimeout = null;
    }

    this.toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
      this.toastFadeTimeout = setTimeout(() => {
        toast.classList.add("hidden");
        this.toastFadeTimeout = null;
      }, 300); // Wait for transition fade-out
      this.toastTimeout = null;
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

// Global HTML escaping utility to prevent XSS across the application
window.escapeHTML = function(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
