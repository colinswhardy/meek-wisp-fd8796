/**
 * ColinsChartsMacros - Scanner View Controller
 * Handles manual barcode search, custom food logging, online lookups, custom barcode registration, and camera scanner lifecycle.
 */

window.ScannerViewController = {
  currentFetchedProduct: {
    dashboard: null,
    food: null,
    recipe: null,
    weight: null
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
          
          // Auto-focus the first custom food entry field immediately
          const customName = document.getElementById("custom-name");
          if (customName) {
            setTimeout(() => {
              customName.focus();
              try { customName.select(); } catch (err) {}
            }, 50);
          }
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

    const customFiber = document.getElementById("custom-fiber");
    if (customProtein && customCarbs && customFats && customFiber && customCalInput) {
      const updateCalculatedCalories = () => {
        let p = parseFloat(customProtein.value) || 0;
        let c = parseFloat(customCarbs.value) || 0;
        let f = parseFloat(customFats.value) || 0;
        let fib = parseFloat(customFiber.value) || 0;
        let netC = Math.max(0, c - fib);
        let kcal = Math.round((p * 4) + (netC * 4) + (f * 9));
        customCalInput.value = kcal > 0 ? kcal : "";
      };

      customProtein.addEventListener("input", updateCalculatedCalories);
      customCarbs.addEventListener("input", updateCalculatedCalories);
      customFats.addEventListener("input", updateCalculatedCalories);
      customFiber.addEventListener("input", updateCalculatedCalories);
    }

    const customFoodForm = document.getElementById("custom-food-form");
    if (customFoodForm) {
      customFoodForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addCustomFoodLog();
      });
    }

    // Initialize listeners for four contexts
    this.initContext("dashboard");
    this.initContext("food");
    this.initContext("recipe");
    this.initContext("weight");
  },

  initContext(context) {
    // Start scan
    const btnStart = document.getElementById(`btn-start-scan-${context}`);
    if (btnStart) {
      btnStart.addEventListener("click", () => {
        // Show manual barcode input on the camera page
        const manualInput = document.getElementById(`manual-barcode-input-${context}`);
        if (manualInput) {
          manualInput.classList.remove("hidden");
        }

        BarcodeScannerManager.start(
          context,
          (barcode) => {
            this.triggerProductLookup(context, barcode);
          },
          (err) => {
            console.warn(`[Scanner] Camera failed to start in context ${context}:`, err);
            // Hide camera scanner container to exit modal view
            const scannerEl = document.getElementById(`camera-scanner-${context}`);
            if (scannerEl) scannerEl.classList.add("hidden");

            // Keep manual input visible as a fallback on the main page card
            if (manualInput) {
              manualInput.classList.remove("hidden");
            }

            // Show feedback
            AppState.showToast("Camera access denied or unavailable. Please enter the barcode manually.");
          }
        );
      });
    }

    // Stop scan
    const btnStop = document.getElementById(`btn-stop-scan-${context}`);
    if (btnStop) {
      btnStop.addEventListener("click", () => {
        BarcodeScannerManager.stop();
        const manualInput = document.getElementById(`manual-barcode-input-${context}`);
        if (manualInput) {
          manualInput.classList.add("hidden");
        }
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

    // Portion unit select dropdown listener
    const portionSelect = document.getElementById(`food-portion-unit-${context}`);
    if (portionSelect) {
      portionSelect.addEventListener("change", () => {
        const wtUnit = document.getElementById(`food-weight-unit-${context}`);
        const wtInput = document.getElementById(`food-weight-input-${context}`);
        const selectedUnit = portionSelect.value;
        const product = this.currentFetchedProduct[context];
        
        if (selectedUnit === "serving") {
          if (wtUnit) wtUnit.textContent = "servings";
          if (wtInput) wtInput.value = 1;
        } else {
          if (wtUnit) wtUnit.textContent = "g";
          if (wtInput) {
            wtInput.value = (product && product.servingQuantity) ? product.servingQuantity : 100;
          }
        }
        
        this.updateScaledMacros(context);
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

    // Dynamic nutrient basis label update
    const servingQtyInput = document.getElementById(`not-found-serving-quantity-${context}`);
    const servingNameInput = document.getElementById(`not-found-serving-name-${context}`);
    const basisLabel = document.getElementById(`not-found-nutri-basis-label-${context}`);

    if (servingQtyInput && basisLabel) {
      const updateBasisLabel = () => {
        const qty = parseFloat(servingQtyInput.value) || 100;
        const name = servingNameInput ? servingNameInput.value.trim() : "";
        if (name) {
          basisLabel.textContent = `Enter Nutrients per ${qty}g (${name})`;
        } else {
          basisLabel.textContent = `Enter Nutrients per ${qty}g`;
        }
      };
      servingQtyInput.addEventListener("input", updateBasisLabel);
      if (servingNameInput) {
        servingNameInput.addEventListener("input", updateBasisLabel);
      }
    }
  },

  async triggerProductLookup(context, barcode) {
    // If scanning was active, stop it cleanly
    if (BarcodeScannerManager.isScanning && BarcodeScannerManager.activeContext === context) {
      await BarcodeScannerManager.stop();
    }

    // Hide manual input container
    const manualInput = document.getElementById(`manual-barcode-input-${context}`);
    if (manualInput) {
      manualInput.classList.add("hidden");
    }

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
        
        // Reset serving inputs
        const servingQtyInput = document.getElementById(`not-found-serving-quantity-${context}`);
        if (servingQtyInput) servingQtyInput.value = "100";
        const servingNameInput = document.getElementById(`not-found-serving-name-${context}`);
        if (servingNameInput) servingNameInput.value = "";
        const basisLabel = document.getElementById(`not-found-nutri-basis-label-${context}`);
        if (basisLabel) basisLabel.textContent = "Enter Nutrients per 100g";
        
        // Hide preview
        this.closePreview(context);
        
        // Show not found registration card
        const notFoundCard = document.getElementById(`barcode-not-found-card-${context}`);
        if (notFoundCard) {
          notFoundCard.classList.remove("hidden");
          notFoundCard.scrollIntoView({ behavior: 'smooth' });
          
          // Auto-focus the manual registration product name input box
          const regName = document.getElementById(`not-found-name-${context}`);
          if (regName) {
            setTimeout(() => {
              regName.focus();
              try { regName.select(); } catch (err) {}
            }, 50);
          }
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

      // Populate portion select dropdown
      const portionSelect = document.getElementById(`food-portion-unit-${context}`);
      const wtInput = document.getElementById(`food-weight-input-${context}`);
      const wtUnit = document.getElementById(`food-weight-unit-${context}`);

      if (portionSelect) {
        portionSelect.innerHTML = "";
        let html = `<option value="g">Grams (g)</option>`;
        if (product.servingSize && product.servingQuantity) {
          html += `<option value="serving">Serving (${product.servingSize})</option>`;
        }
        portionSelect.innerHTML = html;
        portionSelect.value = "g"; // Always default to grams
      }

      if (wtUnit) wtUnit.textContent = "g";
      if (wtInput) {
        wtInput.value = product.servingQuantity ? product.servingQuantity : 100;
      }
      this.updateScaledMacros(context);

      // Hide not found card if visible
      const notFoundCard = document.getElementById(`barcode-not-found-card-${context}`);
      if (notFoundCard) notFoundCard.classList.add("hidden");

      // Show preview card
      const previewCard = document.getElementById(`food-detail-card-${context}`);
      if (previewCard) {
        previewCard.classList.remove("hidden");
        previewCard.scrollIntoView({ behavior: 'smooth' });
        
        // Auto-focus the weight input box in scanned preview card
        const wtInput = document.getElementById(`food-weight-input-${context}`);
        if (wtInput) {
          setTimeout(() => {
            wtInput.focus();
            try { wtInput.select(); } catch (err) {}
          }, 50);
        }
      }

    } catch (err) {
      console.warn(`[Lookup] Product not found for barcode: ${barcode}`);
      
      // Clear forms
      document.getElementById(`not-found-code-${context}`).textContent = barcode;
      document.getElementById(`not-found-name-${context}`).value = "";
      document.getElementById(`not-found-brand-${context}`).value = "";
      
      const servingQtyInput = document.getElementById(`not-found-serving-quantity-${context}`);
      if (servingQtyInput) servingQtyInput.value = "100";
      const servingNameInput = document.getElementById(`not-found-serving-name-${context}`);
      if (servingNameInput) servingNameInput.value = "";
      const basisLabel = document.getElementById(`not-found-nutri-basis-label-${context}`);
      if (basisLabel) basisLabel.textContent = "Enter Nutrients per 100g";

      document.getElementById(`not-found-calories-${context}`).value = "";
      document.getElementById(`not-found-protein-${context}`).value = "";
      document.getElementById(`not-found-carbs-${context}`).value = "";
      document.getElementById(`not-found-fats-${context}`).value = "";

      // Auto-compute calories for manual registration form
      const proteinInput = document.getElementById(`not-found-protein-${context}`);
      const carbsInput = document.getElementById(`not-found-carbs-${context}`);
      const fatsInput = document.getElementById(`not-found-fats-${context}`);
      const fiberInput = document.getElementById(`not-found-fiber-${context}`);
      const calsInput = document.getElementById(`not-found-calories-${context}`);

      if (proteinInput && carbsInput && fatsInput && fiberInput && calsInput) {
        const updateCalculatedCalories = () => {
          let p = parseFloat(proteinInput.value) || 0;
          let c = parseFloat(carbsInput.value) || 0;
          let f = parseFloat(fatsInput.value) || 0;
          let fib = parseFloat(fiberInput.value) || 0;
          let netC = Math.max(0, c - fib);
          let kcal = Math.round((p * 4) + (netC * 4) + (f * 9));
          calsInput.value = kcal > 0 ? kcal : "";
        };

        // Bind auto compute on input
        proteinInput.oninput = updateCalculatedCalories;
        carbsInput.oninput = updateCalculatedCalories;
        fatsInput.oninput = updateCalculatedCalories;
        fiberInput.oninput = updateCalculatedCalories;
      }

      this.closePreview(context);
      
      const notFoundCard = document.getElementById(`barcode-not-found-card-${context}`);
      if (notFoundCard) {
        notFoundCard.classList.remove("hidden");
        notFoundCard.scrollIntoView({ behavior: 'smooth' });
        
        // Auto-focus the manual registration product name input box
        const regName = document.getElementById(`not-found-name-${context}`);
        if (regName) {
          setTimeout(() => {
            regName.focus();
            try { regName.select(); } catch (err) {}
          }, 50);
        }
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
    
    const servingQtyEl = document.getElementById(`not-found-serving-quantity-${context}`);
    const servingQuantity = servingQtyEl ? (parseFloat(servingQtyEl.value) || 100) : 100;
    
    const servingNameEl = document.getElementById(`not-found-serving-name-${context}`);
    const servingSize = servingNameEl ? servingNameEl.value.trim() : "";

    const rawKcal = Number(document.getElementById(`not-found-calories-${context}`).value);
    const rawProtein = Number(document.getElementById(`not-found-protein-${context}`).value);
    const rawCarbs = Number(document.getElementById(`not-found-carbs-${context}`).value);
    const rawFats = Number(document.getElementById(`not-found-fats-${context}`).value);
    const rawFiber = Number(document.getElementById(`not-found-fiber-${context}`).value) || 0;

    if (!barcode || !name) {
      alert("Please fill out barcode and product name.");
      return;
    }

    // Scale to standard 100g database representation
    const scale = 100 / servingQuantity;
    const kcal = Math.round(rawKcal * scale);
    const protein = parseFloat((rawProtein * scale).toFixed(1));
    const carbs = parseFloat((rawCarbs * scale).toFixed(1));
    const fats = parseFloat((rawFats * scale).toFixed(1));
    const fiber = parseFloat((rawFiber * scale).toFixed(1)) || 0;

    const newFood = {
      barcode: barcode,
      name: name,
      brand: brand,
      servingQuantity: servingQuantity,
      servingSize: servingSize || `${servingQuantity}g`,
      nutrients: {
        calories: kcal,
        protein: protein,
        carbs: carbs,
        fats: fats,
        fiber: fiber
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
    let factor = weight / 100;

    const portionSelect = document.getElementById(`food-portion-unit-${context}`);
    if (portionSelect && portionSelect.value === "serving" && product.servingQuantity) {
      factor = (weight * product.servingQuantity) / 100;
    }

    const p = parseFloat((raw.protein * factor).toFixed(1));
    const c = parseFloat((raw.carbs * factor).toFixed(1));
    const f = parseFloat((raw.fats * factor).toFixed(1));
    const fib = parseFloat(((raw.fiber || 0) * factor).toFixed(1));
    const netC = Math.max(0, c - fib);
    const kcal = Math.round(p * 4 + netC * 4 + f * 9);

    document.getElementById(`scaled-kcal-${context}`).textContent = kcal;
    document.getElementById(`scaled-protein-${context}`).textContent = `${p}g`;
    document.getElementById(`scaled-carbs-${context}`).textContent = `${c}g`;
    document.getElementById(`scaled-fats-${context}`).textContent = `${f}g`;
    const fiberEl = document.getElementById(`scaled-fiber-${context}`);
    if (fiberEl) fiberEl.textContent = `${fib}g`;
  },

  addScaledProductToLog(context) {
    const product = this.currentFetchedProduct[context];
    if (!product) return;

    let weight = parseFloat(document.getElementById(`food-weight-input-${context}`).value);
    if (isNaN(weight) || weight <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const raw = product.nutrients;
    let factor = weight / 100;
    let storedWeight = weight;

    const portionSelect = document.getElementById(`food-portion-unit-${context}`);
    if (portionSelect && portionSelect.value === "serving" && product.servingQuantity) {
      factor = (weight * product.servingQuantity) / 100;
      storedWeight = weight * product.servingQuantity;
    }

    const p = parseFloat((raw.protein * factor).toFixed(1));
    const c = parseFloat((raw.carbs * factor).toFixed(1));
    const f = parseFloat((raw.fats * factor).toFixed(1));
    const fib = parseFloat(((raw.fiber || 0) * factor).toFixed(1));
    const netC = Math.max(0, c - fib);
    const kcal = Math.round(p * 4 + netC * 4 + f * 9);

    if (context === "recipe") {
      // Add as ingredient to the Recipe Builder
      const newIng = {
        name: product.name,
        brand: product.brand,
        weight: storedWeight,
        nutrients: {
          calories: kcal,
          protein: p,
          carbs: c,
          fats: f,
          fiber: fib
        }
      };
      if (product.servingSize) newIng.servingSize = product.servingSize;
      if (product.servingQuantity) newIng.servingQuantity = product.servingQuantity;

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
      weight: storedWeight,
      calories: kcal,
      protein: p,
      carbs: c,
      fats: f,
      fiber: fib,
      loggedAt: Date.now()
    };
    if (product.servingSize) newLogItem.servingSize = product.servingSize;
    if (product.servingQuantity) newLogItem.servingQuantity = product.servingQuantity;

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
    const fiber = parseFloat(Number(document.getElementById("custom-fiber").value).toFixed(1)) || 0;
    
    const weightEl = document.getElementById("custom-weight");
    const weight = weightEl ? (parseFloat(weightEl.value) || 100) : 100;

    const newLogItem = {
      id: "food_custom_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: name,
      brand: "Custom Entry",
      weight: weight,
      calories: kcal,
      protein: protein,
      carbs: carbs,
      fats: fats,
      fiber: fiber,
      loggedAt: Date.now()
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
