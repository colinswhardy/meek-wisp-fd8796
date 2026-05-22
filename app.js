/**
 * ColinsChartsMacros - Main Entry Point (ES Module)
 * Imports, orchestrates, and initializes all sub-controllers and views.
 */

import { AppState } from "./state.js";
import { appRouter } from "./router.js";
import { WeightChartManager } from "./charts.js";
import { FoodDatabase } from "./database.js";
import { BarcodeScannerManager } from "./scanner.js";

import { CalendarSelectorController } from "./controllers/calendar.js";
import { DashboardController } from "./controllers/dashboard.js";
import { FoodController } from "./controllers/food.js";
import { FoodSelectorController } from "./controllers/food_selector.js";
import { RecipeBuilderController } from "./controllers/recipe.js";
import { SettingsController } from "./controllers/settings.js";
import { StrategyController } from "./controllers/strategy.js";
import { WeightController } from "./controllers/weight.js";
import { ScannerViewController } from "./controllers/scanner_view.js";

// Expose controllers globally on window to maintain 100% backward-compatibility
// with existing inline HTML event handlers (e.g. onclick, onchange, etc.)
window.AppState = AppState;
window.appRouter = appRouter;
window.WeightChartManager = WeightChartManager;
window.FoodDatabase = FoodDatabase;
window.BarcodeScannerManager = BarcodeScannerManager;

window.CalendarSelectorController = CalendarSelectorController;
window.DashboardController = DashboardController;
window.FoodController = FoodController;
window.FoodSelectorController = FoodSelectorController;
window.RecipeBuilderController = RecipeBuilderController;
window.SettingsController = SettingsController;
window.StrategyController = StrategyController;
window.WeightController = WeightController;
window.ScannerViewController = ScannerViewController;

// Global App Initialization Lifecycles
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
  let lastCheckedDate = AppState.getTodayISODate();
  setInterval(() => {
    const todayStr = AppState.getTodayISODate();
    if (todayStr !== lastCheckedDate) {
      console.log("[Rollover] Midnight crossed. Refreshing calendar context...");
      lastCheckedDate = todayStr;
      AppState.selectedDateISO = todayStr;
      CalendarSelectorController.updateLabel();
      appRouter.refreshCurrentView();
    }
  }, 30000); // Clock check once every 30 seconds
});
