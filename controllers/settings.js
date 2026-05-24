/**
 * ColinsChartsMacros - Settings View Controller
 * Handles standard goal targets, unit metrics conversion, Mifflin-St Jeor planner, Renpho CSV imports, and backups.
 */

window.SettingsController = {
  init() {
    // 1. Config form updates
    const targetForm = document.getElementById("targets-form");
    if (targetForm) {
      targetForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveStandardTargets();
      });
    }

    const calEl = document.getElementById("target-calories");
    const protEl = document.getElementById("target-protein");
    const carbEl = document.getElementById("target-carbs");
    const fatEl = document.getElementById("target-fats");
    
    if (calEl && protEl && carbEl && fatEl) {
      const updateCalculatedCalories = () => {
        const p = parseFloat(protEl.value) || 0;
        const c = parseFloat(carbEl.value) || 0;
        const f = parseFloat(fatEl.value) || 0;
        calEl.value = Math.round(p * 4 + c * 4 + f * 9);
      };
      
      protEl.addEventListener("input", updateCalculatedCalories);
      carbEl.addEventListener("input", updateCalculatedCalories);
      fatEl.addEventListener("input", updateCalculatedCalories);
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
      "profile-starting-weight",
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
        startingWeight: null,
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

    const startWtEl = document.getElementById("profile-starting-weight");
    if (startWtEl) startWtEl.value = profile.startingWeight || "";

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
    const startingWeightRaw = document.getElementById("profile-starting-weight").value;
    const startingWeight = startingWeightRaw ? parseFloat(startingWeightRaw) : null;

    const currentUnit = AppState.data.settings.unit;
    const currentWeight = this.getCurrentWeight();

    // Persist profile variables immediately
    AppState.data.profile = {
      sex,
      age,
      heightFt,
      heightIn,
      activity,
      startingWeight,
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

    const p = Math.max(Math.round((AppState.data.standardGoals.protein || 150) * scale), 10);
    const c = Math.max(Math.round((AppState.data.standardGoals.carbs || 250) * scale), 10);
    const f = Math.max(Math.round((AppState.data.standardGoals.fats || 65) * scale), 5);
    const reconciledKcal = Math.round(p * 4 + c * 4 + f * 9);

    AppState.data.standardGoals.calories = reconciledKcal;
    AppState.data.standardGoals.protein = p;
    AppState.data.standardGoals.carbs = c;
    AppState.data.standardGoals.fats = f;

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
    const protein = Math.round(Number(document.getElementById("target-protein").value));
    const carbs = Math.round(Number(document.getElementById("target-carbs").value));
    const fats = Math.round(Number(document.getElementById("target-fats").value));
    const kcal = Math.round(protein * 4 + carbs * 4 + fats * 9);

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
        if (profile.startingWeight) {
          profile.startingWeight = parseFloat((profile.startingWeight / 2.20462).toFixed(1));
        }
        const rateMap = { 0.5: 0.25, 1.0: 0.5, 1.5: 0.75, 2.0: 1.0 };
        profile.weeklyRate = rateMap[profile.weeklyRate] || parseFloat((profile.weeklyRate / 2.20462).toFixed(2));
      } else {
        profile.targetWeight = parseFloat((profile.targetWeight * 2.20462).toFixed(1));
        if (profile.startingWeight) {
          profile.startingWeight = parseFloat((profile.startingWeight * 2.20462).toFixed(1));
        }
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
      
      mealIndices.forEach((idx, step) => {
        const templ = mealTemplates[idx];
        
        // Calculate realistic loggedAt time spread through the day
        const mealTime = new Date(d);
        if (step === 0) mealTime.setHours(8, 30, 0, 0);       // Breakfast
        else if (step === 1) mealTime.setHours(12, 45, 0, 0); // Lunch
        else mealTime.setHours(19, 15, 0, 0);                 // Dinner

        dayMeals.push({
          id: `food_demo_${i}_${idx}_` + Math.random().toString(36).substr(2, 5),
          name: templ.name,
          brand: templ.brand,
          weight: 150,
          calories: templ.calories,
          protein: templ.protein,
          carbs: templ.carbs,
          fats: templ.fats,
          loggedAt: mealTime.getTime()
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

      function parseDateToISO(raw) {
        // Try standard constructor first
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          return WeightChartManager.formatISODate(d);
        }

        // Regex fallback for YYYY-MM-DD or YYYY/MM/DD
        let match = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (match) {
          return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
        }

        // Regex fallback for MM/DD/YYYY or DD/MM/YYYY
        match = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (match) {
          const p1 = parseInt(match[1]);
          const p2 = parseInt(match[2]);
          const year = match[3];
          if (p1 > 12) {
            // DD/MM/YYYY
            return `${year}-${String(p2).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
          }
          if (p2 > 12) {
            // MM/DD/YYYY
            return `${year}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`;
          }
          // Default to MM/DD/YYYY
          return `${year}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`;
        }
        return null;
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

        const dateKey = parseDateToISO(rawDate);

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
    
    let csvContent = "Date,Weight (" + AppState.data.settings.unit + "),Calories Eaten (kcal),Protein Eaten (g),Carbs Eaten (g),Fats Eaten (g),Fiber Eaten (g),Net Carbs Eaten (g),Calorie Target (kcal)\n";
    
    sortedDates.forEach(dateISO => {
      const weight = AppState.data.weights[dateISO] !== undefined ? AppState.data.weights[dateISO] : "";
      const meals = AppState.data.meals[dateISO] || [];
      const goals = AppState.getGoalsForDate(dateISO);
      
      let eatenProtein = 0;
      let eatenCarbs = 0;
      let eatenFats = 0;
      let eatenFiber = 0;
      
      meals.forEach(m => {
        eatenProtein += m.protein || 0;
        eatenCarbs += m.carbs || 0;
        eatenFats += m.fats || 0;
        eatenFiber += m.fiber || 0;
      });
      
      const eatenNetCarbs = Math.max(0, eatenCarbs - eatenFiber);
      const eatenKcal = Math.round(eatenProtein * 4 + eatenNetCarbs * 4 + eatenFats * 9);
      
      const targetProtein = goals.protein || 150;
      const targetCarbs = goals.carbs || 250;
      const targetFats = goals.fats || 65;
      const targetKcal = Math.round(targetProtein * 4 + targetCarbs * 4 + targetFats * 9);
      
      csvContent += `${dateISO},${weight},${eatenKcal},${eatenProtein.toFixed(1)},${eatenCarbs.toFixed(1)},${eatenFats.toFixed(1)},${eatenFiber.toFixed(1)},${eatenNetCarbs.toFixed(1)},${targetKcal}\n`;
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
