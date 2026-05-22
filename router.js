/**
 * ColinsChartsMacros - Single Page App Router
 * Manages view transition layers, navbar states, browser History navigation, and stream safety.
 */

import { AppState } from "./state.js";
import { BarcodeScannerManager } from "./scanner.js";
import { DashboardController } from "./controllers/dashboard.js";
import { FoodController } from "./controllers/food.js";
import { WeightController } from "./controllers/weight.js";
import { StrategyController } from "./controllers/strategy.js";
import { SettingsController } from "./controllers/settings.js";
import { RecipeBuilderController } from "./controllers/recipe.js";
import { FoodSelectorController } from "./controllers/food_selector.js";

export const appRouter = {
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
