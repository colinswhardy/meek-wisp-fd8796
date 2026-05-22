/**
 * ColinsChartsMacros - Scanner View Controller
 * Handles manual barcode search, custom food logging, online lookups, custom barcode registration, and camera scanner lifecycle.
 */

window.ScannerViewController = {
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
