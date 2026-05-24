/**
 * ColinsChartsMacros - Recipe Builder View Controller
 * Manages adding recipe ingredients, scaling macro properties, and saving compiled meals.
 */

window.RecipeBuilderController = {
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
          
          // Auto-focus the first custom ingredient field immediately
          const customName = document.getElementById("recipe-custom-name");
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

    // Auto-calculate calories for custom ingredient
    const customProtein = document.getElementById("recipe-custom-protein");
    const customCarbs = document.getElementById("recipe-custom-carbs");
    const customFats = document.getElementById("recipe-custom-fats");
    const customCalInput = document.getElementById("recipe-custom-calories");

    const customFiber = document.getElementById("recipe-custom-fiber");
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
    const fiber = parseFloat(Number(document.getElementById("recipe-custom-fiber").value).toFixed(1)) || 0;
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
        fats: fats,
        fiber: fiber
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
    let totalFiber = 0;
    let totalWeight = 0;

    this.ingredients.forEach((ing, index) => {
      totalKcal += ing.nutrients.calories;
      totalProtein += ing.nutrients.protein;
      totalCarbs += ing.nutrients.carbs;
      totalFats += ing.nutrients.fats;
      totalFiber += ing.nutrients.fiber || 0;
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

    this.updateRecipeTotals(totalKcal, totalProtein, totalCarbs, totalFats, totalFiber, totalWeight);
  },

  deleteIngredient(index) {
    this.ingredients.splice(index, 1);
    this.renderIngredients();
  },

  updateRecipeTotals(kcal, protein, carbs, fats, fiber, weight) {
    document.getElementById("recipe-total-kcal").textContent = Math.round(kcal);
    document.getElementById("recipe-total-protein").textContent = `${protein.toFixed(1)}g`;
    document.getElementById("recipe-total-carbs").textContent = `${carbs.toFixed(1)}g`;
    document.getElementById("recipe-total-fats").textContent = `${fats.toFixed(1)}g`;
    const fiberEl = document.getElementById("recipe-total-fiber");
    if (fiberEl) fiberEl.textContent = `${fiber.toFixed(1)}g`;
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
    let totalFiber = 0;
    let totalWeight = 0;

    this.ingredients.forEach(ing => {
      totalKcal += ing.nutrients.calories;
      totalProtein += ing.nutrients.protein;
      totalCarbs += ing.nutrients.carbs;
      totalFats += ing.nutrients.fats;
      totalFiber += ing.nutrients.fiber || 0;
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
        fats: parseFloat(totalFats.toFixed(1)),
        fiber: parseFloat(totalFiber.toFixed(1))
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
