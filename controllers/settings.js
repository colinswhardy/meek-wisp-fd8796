/**
 * ColinsChartsMacros - Settings View Controller
 * Handles standard goal targets, unit metrics conversion, Mifflin-St Jeor planner, Renpho CSV imports, and backups.
 */

window.SettingsController = {

  // Track which diet preset is currently active (null = custom)
  _activePreset: null,

  // Diet preset definitions. Protein presets use g/lb of body weight.
  // Carb/Fat presets use percentage of total calories.
  DIET_PRESETS: {
    "normal-protein":     { type: "protein", gPerLb: 0.8,  carbPct: 0.55, fatPct: 0.45 },
    "high-protein":       { type: "protein", gPerLb: 1.0,  carbPct: 0.50, fatPct: 0.50 },
    "ultra-high-protein": { type: "protein", gPerLb: 1.4,  carbPct: 0.50, fatPct: 0.50 },
    "low-carb":           { type: "carb",    carbPct: 0.15, protGPerLb: 1.0  },
    "regular-carb":       { type: "carb",    carbPct: 0.50, protGPerLb: 0.8  },
    "high-carb":          { type: "carb",    carbPct: 0.65, protGPerLb: 0.8  },
    "low-fat":            { type: "fat",     fatPct: 0.20,  protGPerLb: 0.8  },
    "high-fat":           { type: "fat",     fatPct: 0.50,  protGPerLb: 0.8  }
  },

  // Verbose explanation data for each preset
  PRESET_EXPLANATIONS: {
    "normal-protein": {
      icon: "💪",
      title: "Normal Protein Diet",
      subtitle: "0.8g per lb of bodyweight — the active lifestyle standard",
      science: "Based on the <strong>ISSN and ACSM joint position stand</strong>, active adults need 1.4–2.0g/kg of protein daily to support muscle repair and nitrogen balance. 0.8g/lb (≈1.76g/kg) sits comfortably in the lower end of this range, providing sufficient protein to preserve lean mass during moderate activity without excessive caloric allocation to a single macronutrient. Remaining calories are split ~55% carbs / 45% fats, supporting energy availability and hormonal health.",
      pros: ["Easy to meet through whole foods", "Supports muscle repair for recreational athletes", "Hormonal balance maintained with adequate fats", "Flexible — leaves room for carbs and fats", "Aligned with RDA recommendations for active adults"],
      cons: ["May be insufficient during aggressive cutting phases", "Less effective at maximising muscle growth vs. High/Ultra", "Not optimal if training intensively 5+ days/week"]
    },
    "high-protein": {
      icon: "🏋️",
      title: "High Protein Diet",
      subtitle: "1.0g per lb of bodyweight — the athletic gold standard",
      science: "A landmark <strong>meta-analysis by Morton et al. (2018, British Journal of Sports Medicine)</strong> analysed 49 randomised controlled trials and found that muscle hypertrophy benefits plateau around <strong>1.62g/kg (0.73g/lb)</strong> under normal conditions, but can extend up to <strong>2.2g/kg (1.0g/lb)</strong> during intense physical training or moderate caloric deficits. At 1.0g/lb, this is the most widely cited athletic recommendation and the gold standard for bodybuilders and strength athletes. Higher protein also elevates the <strong>Thermic Effect of Food (TEF)</strong> — your body burns ~25–30% of protein calories just digesting it, effectively boosting your metabolic rate.",
      pros: ["Maximises muscle protein synthesis", "Reduces muscle catabolism during deficits", "High TEF boosts total daily energy expenditure by ~80–100 kcal", "Strong satiety — reduces hunger hormones (ghrelin)", "Well-supported by extensive peer-reviewed literature"],
      cons: ["Can be difficult to hit without protein supplements", "Higher food costs (lean meats, fish, whey)", "Excess protein above needs is oxidised or stored as fat", "May crowd out carbs needed for high-intensity training fuel"]
    },
    "ultra-high-protein": {
      icon: "🔥",
      title: "Ultra-High Protein Diet",
      subtitle: "1.4g per lb of bodyweight — for cutting and muscle preservation",
      science: "Research led by <strong>Dr. Jose Antonio (Nova Southeastern University)</strong> demonstrated that protein intakes of up to <strong>3.4g/kg (1.54g/lb)</strong> are safe in resistance-trained athletes and produce superior lean mass retention during caloric restriction. During a <em>cutting phase</em>, the body increasingly catabolises muscle tissue for energy. Ultra-high protein intakes of <strong>2.3–3.1g/kg (1.0–1.4g/lb)</strong> counteract this by providing a constant surplus of amino acids. The exceptionally high TEF of protein (~30%) also means ultra-high protein diets can create a larger effective calorie deficit than the numbers suggest. This preset is most appropriate when aggressively cutting body fat while preserving hard-earned muscle.",
      pros: ["Maximally preserves lean muscle during hard cuts", "Extremely high satiety — reduced hunger", "TEF is highest of all macros (~30% of protein kcal)", "Prevents muscle catabolism in large caloric deficits", "Clinically validated safe up to 3.4g/kg in athletes"],
      cons: ["Very hard to achieve through food alone without protein shakes", "Leaves limited caloric room for carbs and fats", "Not necessary during maintenance or bulk phases", "May cause digestive discomfort if increased too quickly", "Kidney load increased — stay well hydrated"]
    },
    "low-carb": {
      icon: "🥩",
      title: "Low Carb Diet",
      subtitle: "~15% of calories from carbohydrates",
      science: "Low carbohydrate diets (typically <20% of calories or <100–130g/day) reduce blood glucose and insulin levels, prompting the body to mobilise stored fat as its primary energy source through <strong>beta-oxidation</strong>. Studies published in <strong>JAMA and The Lancet</strong> show that low-carb diets produce superior short-term weight loss compared to low-fat diets, largely due to reduced water retention (glycogen stores water at a 3:1 ratio), improved insulin sensitivity, and reduced appetite from ketone production. At 15% carbs, the body is near-keto territory but not fully ketogenic (typically <5% or ~20–50g). Protein is set to 1.0g/lb to prevent muscle loss.",
      pros: ["Rapid initial weight loss (water + fat)", "Stabilises blood sugar and insulin levels", "Reduced hunger — ketones suppress appetite hormones", "Effective for insulin resistance and metabolic syndrome", "Improves HDL cholesterol and triglyceride markers"],
      cons: ["Restricts performance in high-intensity exercise (glycolytic activity requires glucose)", "'Keto flu' adaptation period (fatigue, headaches) for 1–2 weeks", "Difficult to maintain socially — most foods contain carbs", "Risk of electrolyte imbalances (sodium, potassium, magnesium)", "May negatively affect thyroid hormones over very long periods"]
    },
    "regular-carb": {
      icon: "🌾",
      title: "Regular Carb Diet",
      subtitle: "~50% of calories from carbohydrates — standard dietary guidelines",
      science: "The <strong>USDA Dietary Guidelines for Americans, WHO, and the Acceptable Macronutrient Distribution Range (AMDR)</strong> all recommend <strong>45–65% of calories from carbohydrates</strong> for healthy adults. At 50%, this preset aligns with the evidence-based default for sustainable energy, athletic performance, and long-term health. Carbohydrates provide <strong>glucose</strong> — the brain's primary fuel and the only fuel source for high-intensity anaerobic exercise. Protein is maintained at 0.8g/lb to support lean mass.",
      pros: ["Balanced and sustainable long-term", "Fully supports both aerobic and anaerobic exercise performance", "Sufficient carbs to maintain glycogen stores", "Easy to meet with common whole foods", "Aligned with mainstream dietary guidelines"],
      cons: ["Requires attention to carb quality (whole grains vs. refined)", "Less effective for rapid fat loss vs. low-carb approaches", "Blood sugar fluctuations possible with refined carb sources", "Not optimal during aggressive fat-loss phases"]
    },
    "high-carb": {
      icon: "⚡",
      title: "High Carb Diet",
      subtitle: "~65% of calories from carbohydrates — for endurance athletes",
      science: "High-carbohydrate diets are the gold standard for <strong>endurance and team sport athletes</strong>. Research consistently demonstrates that <strong>muscle glycogen</strong> is the primary limiting factor in endurance performance. At 65% carbohydrate intake, glycogen stores are maximised and replenished rapidly between training sessions. The <strong>American College of Sports Medicine (ACSM)</strong> recommends 6–10g/kg of carbohydrates per day for endurance athletes during heavy training. This preset is also commonly used as a <strong>re-feed strategy</strong> on high-training days to spike leptin levels (a key fat-burning hormone that drops during caloric restriction) and restore glycogen.",
      pros: ["Maximises muscle and liver glycogen stores", "Optimal for endurance running, cycling, swimming", "Faster recovery between training sessions", "Supports leptin replenishment during dieting phases", "Reduces perceived exertion during long efforts"],
      cons: ["Not ideal for fat loss — high insulin suppresses fat oxidation", "Excess refined carbs linked to inflammation and blood sugar dysregulation", "Leaves less room for protein and fat", "Can cause bloating if fibre intake is excessive", "Not appropriate for sedentary lifestyles"]
    },
    "low-fat": {
      icon: "🥗",
      title: "Low Fat Diet",
      subtitle: "~20% of calories from fat — a classic dietary approach",
      science: "Low-fat diets (<30% of calories from fat) were the cornerstone of mainstream dietary advice from the 1970s through the 1990s, based on the <strong>Seven Countries Study (Ancel Keys)</strong> linking saturated fat intake to cardiovascular disease. While later research has nuanced this relationship, low-fat diets remain clinically effective tools for <strong>reducing LDL cholesterol, lowering caloric density</strong>, and managing certain conditions. The critical trade-off: dietary fat is essential for absorbing <strong>fat-soluble vitamins (A, D, E, K)</strong> and producing steroid hormones (testosterone, estrogen, cortisol). At 20%, these critical functions are maintained while fat calories are minimised. Protein is held at 0.8g/lb.",
      pros: ["Naturally reduces caloric density of diet", "Clinically validated for reducing LDL cholesterol", "Easier to track and implement than ketogenic approaches", "Leaves maximum calories for carbohydrates — great for athletes", "Reduces intake of unhealthy trans and saturated fats"],
      cons: ["Very low fat can impair fat-soluble vitamin absorption", "Can reduce testosterone and estrogen production", "Fat is highly satiating — low fat may increase hunger", "Modern research disputes fat as the primary driver of CVD", "Risk of overconsumption of refined carbs to compensate"]
    },
    "high-fat": {
      icon: "🥑",
      title: "High Fat Diet",
      subtitle: "~50% of calories from fat — the ketogenic approach",
      science: "At 50% fat with 15% carbs, this preset borders the classical <strong>ketogenic diet</strong> threshold. When carbohydrate intake is sufficiently low, the liver converts fatty acids into <strong>ketone bodies</strong> (beta-hydroxybutyrate, acetoacetate, acetone), which cross the blood-brain barrier and serve as an alternative fuel for the brain and heart. <strong>Multiple RCTs (Yancy et al., Volek et al.)</strong> demonstrate superior fat mass loss, reduced triglycerides, and improved HDL cholesterol with ketogenic diets vs. low-fat diets over 6–12 months. The high-fat, very-low-carb combination also appears to have <strong>neurological benefits</strong> — ketogenic diets are an established treatment for drug-resistant epilepsy and are being studied in Alzheimer's disease (Type 3 Diabetes hypothesis).",
      pros: ["Promotes fat oxidation and ketone production", "Dramatically reduces blood triglycerides", "Increases HDL (good) cholesterol", "Strong appetite suppression from ketones and dietary fat", "Stable energy without blood sugar spikes and crashes", "Neurological benefits — focus, cognitive clarity"],
      cons: ["Glycogen depletion impairs high-intensity anaerobic performance", "Adaptation period (keto flu) 1–3 weeks", "Very restrictive — eliminates most fruits, grains, legumes", "Elevated LDL in some individuals (especially ApoE4 carriers)", "Requires careful electrolyte management", "Long-term sustainability is challenging socially"]
    }
  },

  init() {
    // 1. Config form submit
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
      // When calories change with an active preset, recalculate macros
      calEl.addEventListener("input", () => {
        if (this._activePreset) {
          this._applyPresetToInputs(this._activePreset, false);
        } else {
          // No preset — just update calorie display passively (don't touch macros)
        }
      });

      // When macros are manually changed, deselect any active preset
      const deactivatePreset = () => {
        if (this._activePreset) {
          this._activePreset = null;
          document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
          const expBox = document.getElementById("diet-explanation-box");
          if (expBox) expBox.classList.add("hidden");
        }
        // Check macro match warning
        this.checkMacroMatch();
      };

      protEl.addEventListener("input", deactivatePreset);
      carbEl.addEventListener("input", deactivatePreset);
      fatEl.addEventListener("input", deactivatePreset);
    }

    // 2. Diet preset buttons
    document.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const preset = btn.getAttribute("data-preset");
        if (!preset) return;

        // Toggle — clicking the same button again deselects
        if (this._activePreset === preset) {
          this._activePreset = null;
          document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
          const expBox = document.getElementById("diet-explanation-box");
          if (expBox) expBox.classList.add("hidden");
          return;
        }

        this._activePreset = preset;
        // Highlight only this button
        document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        // Apply macro calculations
        this._applyPresetToInputs(preset, true);
      });
    });

    // 3. Unit selector
    const btnLbs = document.getElementById("btn-unit-lbs");
    const btnKg = document.getElementById("btn-unit-kg");
    if (btnLbs) btnLbs.addEventListener("click", () => this.toggleWeightUnit("lbs"));
    if (btnKg) btnKg.addEventListener("click", () => this.toggleWeightUnit("kg"));

    // 4. Mock Data trigger
    const loadMockBtn = document.getElementById("btn-load-mock");
    if (loadMockBtn) loadMockBtn.addEventListener("click", () => this.injectDemoLogs());

    // 5. Data Wipe
    const clearBtn = document.getElementById("btn-clear-data");
    if (clearBtn) clearBtn.addEventListener("click", () => this.purgeStorageData());

    // 6. Renpho CSV Import
    const csvInput = document.getElementById("csv-file-input");
    if (csvInput) csvInput.addEventListener("change", (e) => this.importRenphoCSV(e));

    // 7. Danger Zone collapsible
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

    // 8. Planner Form live updates
    const plannerInputs = [
      "profile-sex", "profile-age", "profile-height-ft", "profile-height-in",
      "profile-activity", "profile-starting-weight", "profile-target-weight", "profile-weekly-rate"
    ];
    plannerInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => this.calculateTargetPlanner());
        el.addEventListener("change", () => this.calculateTargetPlanner());
      }
    });

    // 9. Apply Planner
    const btnApply = document.getElementById("btn-apply-planner");
    if (btnApply) btnApply.addEventListener("click", () => this.applyPlannerTarget());

    // 10. Backup & Restore
    const btnExportCSV = document.getElementById("btn-export-csv");
    if (btnExportCSV) btnExportCSV.addEventListener("click", () => this.exportCSV());

    const btnExportJSON = document.getElementById("btn-export-json");
    if (btnExportJSON) btnExportJSON.addEventListener("click", () => this.exportJSON());

    const jsonFileInput = document.getElementById("json-file-input");
    if (jsonFileInput) jsonFileInput.addEventListener("change", (e) => this.importJSON(e));

    // 11. Algolia Search Engine Config bindings
    const algoliaEnabled = document.getElementById("algolia-enabled");
    const algoliaFields = document.getElementById("algolia-fields");
    const algoliaAppId = document.getElementById("algolia-appid");
    const algoliaApiKey = document.getElementById("algolia-apikey");
    const algoliaIndexName = document.getElementById("algolia-indexname");

    const saveAlgoliaConfig = () => {
      const config = AppState.data.settings.algoliaConfig;
      if (!config) return;
      config.enabled = algoliaEnabled ? algoliaEnabled.checked : false;
      config.appId = algoliaAppId ? algoliaAppId.value.trim() : "";
      config.apiKey = algoliaApiKey ? algoliaApiKey.value.trim() : "";
      config.indexName = algoliaIndexName ? algoliaIndexName.value.trim() : "foods";

      AppState.saveToStorage();

      if (algoliaFields) {
        if (config.enabled) algoliaFields.classList.remove("hidden");
        else algoliaFields.classList.add("hidden");
      }
    };

    [algoliaEnabled, algoliaAppId, algoliaApiKey, algoliaIndexName].forEach(el => {
      if (el) {
        el.addEventListener("input", saveAlgoliaConfig);
        el.addEventListener("change", saveAlgoliaConfig);
      }
    });

    // USDA API Key Config binding
    const usdaApiKeyInput = document.getElementById("usda-api-key-input");
    if (usdaApiKeyInput) {
      usdaApiKeyInput.addEventListener("input", () => {
        AppState.data.settings.usdaApiKey = usdaApiKeyInput.value.trim();
        if (window.FoodDatabase) {
          window.FoodDatabase.onlineSearchCache = {}; // Clear online search cache on API key changes
        }
        AppState.saveToStorage();
      });
    }

    // Gemini API Key Config binding
    const geminiApiKeyInput = document.getElementById("gemini-api-key-input");
    if (geminiApiKeyInput) {
      geminiApiKeyInput.addEventListener("input", () => {
        AppState.data.settings.geminiApiKey = geminiApiKeyInput.value.trim();
        AppState.saveToStorage();
      });
    }
  },

  // -----------------------------------------------------------------------
  // Diet Preset Calculation Engine
  // -----------------------------------------------------------------------

  /**
   * Returns the user's current body weight in lbs regardless of display unit.
   */
  getCurrentWeightLbs() {
    const wt = this.getCurrentWeight();
    const unit = AppState.data.settings.unit;
    return unit === "kg" ? wt * 2.20462 : wt;
  },

  /**
   * Calculates macros based on a named preset, total calories, and body weight.
   * Returns { protein, carbs, fats, calories } (reconciled calories).
   */
  calculateMacrosForPreset(presetKey, calories, weightLbs) {
    const def = this.DIET_PRESETS[presetKey];
    if (!def) return null;

    const MAX_PROTEIN_PCT = 0.45; // Hard cap: protein can't exceed 45% of calories
    let protein, carbs, fats;

    if (def.type === "protein") {
      // Protein determined by g/lb — remaining split between carbs & fats
      const rawProtein = Math.round(weightLbs * def.gPerLb);
      const proteinKcal = rawProtein * 4;
      const maxProteinKcal = calories * MAX_PROTEIN_PCT;
      const clampedProteinKcal = Math.min(proteinKcal, maxProteinKcal);
      protein = Math.round(clampedProteinKcal / 4);

      const remaining = calories - protein * 4;
      carbs = Math.max(Math.round((remaining * def.carbPct) / 4), 10);
      fats  = Math.max(Math.round((remaining * (1 - def.carbPct)) / 9), 5);

    } else if (def.type === "carb") {
      // Carb percentage is fixed; protein set by g/lb; fat fills remainder
      const rawProtein = Math.round(weightLbs * def.protGPerLb);
      const proteinKcal = rawProtein * 4;
      const maxProteinKcal = calories * MAX_PROTEIN_PCT;
      protein = Math.round(Math.min(proteinKcal, maxProteinKcal) / 4);

      const carbKcal = Math.round(calories * def.carbPct);
      carbs = Math.max(Math.round(carbKcal / 4), 10);
      const fatKcal = calories - protein * 4 - carbs * 4;
      fats  = Math.max(Math.round(fatKcal / 9), 5);

    } else if (def.type === "fat") {
      // Fat percentage is fixed; protein set by g/lb; carbs fill remainder
      const rawProtein = Math.round(weightLbs * def.protGPerLb);
      const proteinKcal = rawProtein * 4;
      const maxProteinKcal = calories * MAX_PROTEIN_PCT;
      protein = Math.round(Math.min(proteinKcal, maxProteinKcal) / 4);

      const fatKcal = Math.round(calories * def.fatPct);
      fats  = Math.max(Math.round(fatKcal / 9), 5);
      const carbKcal = calories - protein * 4 - fats * 9;
      carbs = Math.max(Math.round(carbKcal / 4), 10);
    }

    const reconciledKcal = Math.round(protein * 4 + carbs * 4 + fats * 9);
    return {
      protein,
      carbs,
      fats,
      calories: reconciledKcal
    };
  },

  /**
   * Apply a named preset to the macro input fields.
   * @param {string} presetKey  - key in DIET_PRESETS
   * @param {boolean} showExplanation - whether to show/update the explanation box
   */
  _applyPresetToInputs(presetKey, showExplanation) {
    const calEl  = document.getElementById("target-calories");
    const protEl = document.getElementById("target-protein");
    const carbEl = document.getElementById("target-carbs");
    const fatEl  = document.getElementById("target-fats");
    if (!calEl || !protEl || !carbEl || !fatEl) return;

    const calories = parseFloat(calEl.value) || 2000;
    const weightLbs = this.getCurrentWeightLbs();

    const macros = this.calculateMacrosForPreset(presetKey, calories, weightLbs);
    if (!macros) return;

    protEl.value = macros.protein;
    carbEl.value = macros.carbs;
    fatEl.value  = macros.fats;

    if (showExplanation) {
      this._renderExplanationBox(presetKey, macros.protein, macros.carbs, macros.fats, macros.calories);
    }

    this.checkMacroMatch();
  },

  /**
   * Render the verbose explanation box for the given preset.
   */
  _renderExplanationBox(presetKey, protein, carbs, fats, calories) {
    const box = document.getElementById("diet-explanation-box");
    if (!box) return;

    const exp = this.PRESET_EXPLANATIONS[presetKey];
    if (!exp) {
      box.classList.add("hidden");
      return;
    }

    // Calculate percentages for display
    const protPct = Math.round((protein * 4 / calories) * 100);
    const carbPct = Math.round((carbs * 4 / calories) * 100);
    const fatPct  = Math.round((fats * 9 / calories) * 100);

    const prosHTML = exp.pros.map(p => `<li>${p}</li>`).join("");
    const consHTML = exp.cons.map(c => `<li>${c}</li>`).join("");

    box.innerHTML = `
      <div class="diet-exp-header">
        <span class="diet-exp-icon">${exp.icon}</span>
        <div>
          <div class="diet-exp-title">${exp.title}</div>
          <div class="diet-exp-subtitle">${exp.subtitle}</div>
        </div>
      </div>

      <div class="diet-exp-macro-pills">
        <span class="diet-exp-pill pill-protein">Protein: ${protein}g <span class="pill-pct">(${protPct}%)</span></span>
        <span class="diet-exp-pill pill-carbs">Carbs: ${carbs}g <span class="pill-pct">(${carbPct}%)</span></span>
        <span class="diet-exp-pill pill-fats">Fats: ${fats}g <span class="pill-pct">(${fatPct}%)</span></span>
      </div>

      <div class="diet-exp-section">
        <div class="diet-exp-section-title">Scientific Rationale</div>
        <div class="diet-exp-body">${exp.science}</div>
      </div>

      <div class="diet-exp-pros-cons">
        <div class="diet-exp-pros">
          <div class="diet-exp-pros-title">✦ Pros</div>
          <ul class="diet-exp-list">${prosHTML}</ul>
        </div>
        <div class="diet-exp-cons">
          <div class="diet-exp-cons-title">⚠ Considerations</div>
          <ul class="diet-exp-list">${consHTML}</ul>
        </div>
      </div>
    `;

    box.classList.remove("hidden");
  },

  render() {
    const dateKey = AppState.selectedDateISO;

    // Load active preset from state settings
    this._activePreset = AppState.data.settings.activePreset || null;

    // IMPORTANT: Always use BASE goals (never re-feed/cycling adjusted) in the budget form.
    // getGoalsForDate() returns re-feed adjusted values which is NOT what we want here.
    const baseGoals = AppState.data.dailyGoals[dateKey] || AppState.data.standardGoals;

    // Form defaults populate
    const calEl = document.getElementById("target-calories");
    const protEl = document.getElementById("target-protein");
    const carbEl = document.getElementById("target-carbs");
    const fatEl = document.getElementById("target-fats");

    if (calEl) calEl.value = baseGoals.calories;
    if (protEl) protEl.value = baseGoals.protein;
    if (carbEl) carbEl.value = baseGoals.carbs;
    if (fatEl) fatEl.value = baseGoals.fats;

    // Highlight active preset button if any
    document.querySelectorAll(".preset-btn").forEach(b => {
      const preset = b.getAttribute("data-preset");
      if (this._activePreset && preset === this._activePreset) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    // Render explanation box if active preset exists
    const expBox = document.getElementById("diet-explanation-box");
    if (this._activePreset) {
      this._renderExplanationBox(this._activePreset, baseGoals.protein, baseGoals.carbs, baseGoals.fats, baseGoals.calories);
    } else if (expBox) {
      expBox.classList.add("hidden");
    }

    this.checkMacroMatch();

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

    // --- Algolia Config Populating ---
    const algoliaConfig = AppState.data.settings.algoliaConfig;
    if (algoliaConfig) {
      const algoliaEnabled = document.getElementById("algolia-enabled");
      const algoliaFields = document.getElementById("algolia-fields");
      const algoliaAppId = document.getElementById("algolia-appid");
      const algoliaApiKey = document.getElementById("algolia-apikey");
      const algoliaIndexName = document.getElementById("algolia-indexname");

      if (algoliaEnabled) algoliaEnabled.checked = algoliaConfig.enabled || false;
      if (algoliaAppId) algoliaAppId.value = algoliaConfig.appId || "";
      if (algoliaApiKey) algoliaApiKey.value = algoliaConfig.apiKey || "";
      if (algoliaIndexName) algoliaIndexName.value = algoliaConfig.indexName || "foods";

      if (algoliaFields) {
        if (algoliaConfig.enabled) algoliaFields.classList.remove("hidden");
        else algoliaFields.classList.add("hidden");
      }
    }

    // --- USDA API Key Populating ---
    const usdaApiKeyInput = document.getElementById("usda-api-key-input");
    if (usdaApiKeyInput) {
      usdaApiKeyInput.value = AppState.data.settings.usdaApiKey || "";
    }

    // --- Gemini API Key Populating ---
    const geminiApiKeyInput = document.getElementById("gemini-api-key-input");
    if (geminiApiKeyInput) {
      geminiApiKeyInput.value = AppState.data.settings.geminiApiKey || "";
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

    const sexEl = document.getElementById("profile-sex");
    if (!sexEl) return;

    const sex = sexEl.value;
    const ageEl = document.getElementById("profile-age");
    const age = ageEl ? (parseInt(ageEl.value) || 30) : 30;
    const heightFtEl = document.getElementById("profile-height-ft");
    const heightFt = heightFtEl ? (parseFloat(heightFtEl.value) || 5) : 5;
    const heightInEl = document.getElementById("profile-height-in");
    const heightIn = heightInEl ? (parseFloat(heightInEl.value) || 10) : 10;
    const activityEl = document.getElementById("profile-activity");
    const activity = activityEl ? activityEl.value : "light";
    const targetWeightEl = document.getElementById("profile-target-weight");
    const targetWeight = targetWeightEl ? (parseFloat(targetWeightEl.value) || 170) : 170;
    const weeklyRateEl = document.getElementById("profile-weekly-rate");
    const weeklyRate = weeklyRateEl ? (parseFloat(weeklyRateEl.value) || 1.0) : 1.0;
    const startingWeightEl = document.getElementById("profile-starting-weight");
    const startingWeightRaw = startingWeightEl ? startingWeightEl.value : "";
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

    const tdee = AppUtils.calculateTDEE(sex, age, currentWeightKg, heightCm, activity);

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
    const plannerCalResult = document.getElementById("planner-cal-result");
    if (plannerCalResult) plannerCalResult.textContent = targetCalories.toLocaleString();
    const plannerTdeeResult = document.getElementById("planner-tdee-result");
    if (plannerTdeeResult) plannerTdeeResult.textContent = `${Math.round(tdee).toLocaleString()} kcal`;
    const plannerWeeksResult = document.getElementById("planner-weeks-result");
    if (plannerWeeksResult) plannerWeeksResult.textContent = weeksToGoal > 0 ? `${weeksToGoal.toFixed(1)} Weeks` : "0 Weeks";
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
        warningMsg = currentUnit === "kg"
          ? `Aggressive rate selected. Safe weight change rate is up to 0.9 kg (2.0 lbs equivalent) per week.`
          : `Aggressive rate selected. Safe weight change rate is up to 2.0 lbs (0.9 kg equivalent) per week.`;
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

    // Automatically update the calorie budget in the Set Budgets page to match the planner calculator
    const calEl = document.getElementById("target-calories");
    if (calEl) {
      calEl.value = targetCalories;
      
      // Update macros in real-time to match the new calories
      if (this._activePreset) {
        // If there is an active preset, re-apply it to update macros in real-time
        this._applyPresetToInputs(this._activePreset, true);
      } else {
        // If it's custom macros, scale them proportionally based on the saved standard goals
        const protEl = document.getElementById("target-protein");
        const carbEl = document.getElementById("target-carbs");
        const fatEl = document.getElementById("target-fats");
        if (protEl && carbEl && fatEl) {
          const oldCalories = AppState.data.standardGoals.calories || 2000;
          const scale = oldCalories > 0 ? targetCalories / oldCalories : 1;
          protEl.value = Math.max(Math.round((AppState.data.standardGoals.protein || 150) * scale), 10);
          carbEl.value = Math.max(Math.round((AppState.data.standardGoals.carbs || 250) * scale), 10);
          fatEl.value = Math.max(Math.round((AppState.data.standardGoals.fats || 65) * scale), 5);
        }
      }
      this.checkMacroMatch();
    }
  },

  applyPlannerTarget() {
    const calResultText = document.getElementById("planner-cal-result").textContent.replace(/,/g, "");
    const targetCalories = parseInt(calResultText) || 2000;

    let p, c, f, kcal;

    if (this._activePreset) {
      const weightLbs = this.getCurrentWeightLbs();
      const macros = this.calculateMacrosForPreset(this._activePreset, targetCalories, weightLbs);
      p = macros.protein;
      c = macros.carbs;
      f = macros.fats;
      kcal = macros.calories;
    } else {
      // Proportional Macro Scaling
      const oldCalories = AppState.data.standardGoals.calories || 2000;
      const scale = targetCalories / oldCalories;

      p = Math.max(Math.round((AppState.data.standardGoals.protein || 150) * scale), 10);
      c = Math.max(Math.round((AppState.data.standardGoals.carbs || 250) * scale), 10);
      f = Math.max(Math.round((AppState.data.standardGoals.fats || 65) * scale), 5);
      kcal = Math.round(p * 4 + c * 4 + f * 9);
    }

    AppState.data.standardGoals.calories = kcal;
    AppState.data.standardGoals.protein = p;
    AppState.data.standardGoals.carbs = c;
    AppState.data.standardGoals.fats = f;

    // Persist activePreset in settings
    AppState.data.settings.activePreset = this._activePreset;

    // Save Daily Override for current active date
    const dateKey = AppState.selectedDateISO;
    AppState.data.dailyGoals[dateKey] = {
      calories: AppState.data.standardGoals.calories,
      protein: AppState.data.standardGoals.protein,
      carbs: AppState.data.standardGoals.carbs,
      fats: AppState.data.standardGoals.fats
    };

    AppState.saveToStorage();
    AppState.showToast(`Applied ${targetCalories} kcal budget & updated macros!`);
    
    // Refresh UI inputs
    this.render();
  },

  saveStandardTargets() {
    const protein = Math.round(Number(document.getElementById("target-protein").value));
    const carbs = Math.round(Number(document.getElementById("target-carbs").value));
    const fats = Math.round(Number(document.getElementById("target-fats").value));
    const kcal = Math.round(Number(document.getElementById("target-calories").value)) || 2000;

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

    // Persist activePreset in settings
    AppState.data.settings.activePreset = this._activePreset;

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
    AppState.showToast("Demo logs populated!");
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
        AppState.showToast("The selected file appears to be empty or has no weight data rows.");
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
        AppState.showToast("Could not identify Date/Time and Weight columns. Ensure this is a Renpho CSV export.");
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
        AppState.showToast(`Success! Imported ${importCount} weight records.`);
        event.target.value = "";
        
        appRouter.refreshCurrentView();
      } else {
        AppState.showToast("No valid weight data points found in selected file.");
      }
    };

    reader.onerror = () => {
      AppState.showToast("Error reading the CSV file.");
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
        eatenProtein += Number(m.protein) || 0;
        eatenCarbs += Number(m.carbs) || 0;
        eatenFats += Number(m.fats) || 0;
        eatenFiber += Number(m.fiber) || 0;
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
    URL.revokeObjectURL(url);
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
    URL.revokeObjectURL(url);
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
        
        if (confirm("This will completely replace all your current settings and history records with this backup file. Proceed?")) {
          const success = AppState.restoreFromBackup(parsed);
          if (success) {
            AppState.showToast("App database restored!");
            
            // Force hard reload of application to reload memory states cleanly
            window.location.reload();
          } else {
            AppState.showToast("Invalid backup structure. Verify database export file.");
          }
        }
      } catch (err) {
        AppState.showToast("Failed to parse backup file: " + err.message);
      } finally {
        event.target.value = ""; // Reset file selector
      }
    };
    reader.readAsText(file);
  },

  // Check if the sum of macro calories matches target calories (give or take a tiny bit)
  checkMacroMatch() {
    const calEl = document.getElementById("target-calories");
    const protEl = document.getElementById("target-protein");
    const carbEl = document.getElementById("target-carbs");
    const fatEl = document.getElementById("target-fats");
    const warningBox = document.getElementById("macro-warning-box");

    if (!calEl || !protEl || !carbEl || !fatEl || !warningBox) return;

    const targetKcal = parseFloat(calEl.value) || 0;
    const p = parseFloat(protEl.value) || 0;
    const c = parseFloat(carbEl.value) || 0;
    const f = parseFloat(fatEl.value) || 0;

    const totalMacroKcal = Math.round(p * 4 + c * 4 + f * 9);
    const diff = Math.abs(totalMacroKcal - targetKcal);

    if (diff > 10) {
      warningBox.classList.remove("hidden");
    } else {
      warningBox.classList.add("hidden");
    }
  }
};
