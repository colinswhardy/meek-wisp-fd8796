/**
 * ColinsChartsMacros - Main Entry Point
 * Orchestrates and initializes all sub-controllers and views.
 */

// Global App Initialization Lifecycles
window.addEventListener("DOMContentLoaded", () => {
  const initController = (name, controller) => {
    try {
      console.log(`[Init] Initializing ${name}...`);
      if (controller && typeof controller.init === "function") {
        controller.init();
      } else {
        console.warn(`[Init] ${name} does not have an init method or is not defined.`);
      }
    } catch (err) {
      console.error(`[Init] Failed to initialize ${name}:`, err);
      showCrashAlert(name, err);
    }
  };

  const showCrashAlert = (name, err) => {
    let errorBox = document.getElementById("crash-error-banner");
    if (!errorBox) {
      errorBox = document.createElement("div");
      errorBox.id = "crash-error-banner";
      errorBox.style.cssText = "position: fixed; top: 0; left: 0; right: 0; background: rgba(220, 53, 69, 0.95); color: #fff; padding: 15px; z-index: 100000; font-family: monospace; font-size: 14px; line-height: 1.5; border-bottom: 2px solid #b21f2d; text-shadow: 0 1px 2px rgba(0,0,0,0.5); max-height: 50vh; overflow-y: auto; box-shadow: 0 5px 15px rgba(0,0,0,0.3);";
      
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "✕";
      closeBtn.style.cssText = "float: right; background: none; border: none; color: white; font-size: 20px; cursor: pointer; margin-left: 15px;";
      closeBtn.onclick = () => errorBox.remove();
      
      errorBox.appendChild(closeBtn);
      const title = document.createElement("strong");
      title.textContent = "⚠️ Critical Application Initialization Crash:";
      title.style.display = "block";
      title.style.marginBottom = "5px";
      errorBox.appendChild(title);
      
      document.body.prepend(errorBox);
    }
    const errorMsg = document.createElement("div");
    errorMsg.textContent = `${name}: ${err.message || err}\n${err.stack || ''}`;
    errorMsg.style.whiteSpace = "pre-wrap";
    errorMsg.style.marginTop = "5px";
    errorBox.appendChild(errorMsg);
  };

  // Set up global window error boundary
  window.addEventListener("error", (event) => {
    console.error("[Uncaught Error]", event.error);
    showCrashAlert("Uncaught Runtime Error", event.error || event.message);
  });

  initController("AppState", AppState);
  initController("appRouter", appRouter);
  initController("CalendarSelectorController", CalendarSelectorController);
  
  // Tab-specific controllers initialization
  initController("ScannerViewController", ScannerViewController);
  initController("RecipeBuilderController", RecipeBuilderController);
  initController("FoodSelectorController", FoodSelectorController);
  initController("WeightController", WeightController);
  initController("StrategyController", StrategyController);
  initController("SettingsController", SettingsController);

  // Run initial dashboard view render
  try {
    appRouter.navigate("dashboard");
  } catch (err) {
    console.error("[Init] Failed initial navigation:", err);
    showCrashAlert("appRouter.navigate('dashboard')", err);
  }

  // Track and monitor active midnight resets while app is running
  let lastCheckedDate = AppState.getTodayISODate();
  setInterval(() => {
    try {
      const todayStr = AppState.getTodayISODate();
      if (todayStr !== lastCheckedDate) {
        console.log("[Rollover] Midnight crossed. Refreshing calendar context...");
        lastCheckedDate = todayStr;
        AppState.selectedDateISO = todayStr;
        CalendarSelectorController.updateLabel();
        appRouter.refreshCurrentView();
      }
    } catch (err) {
      console.error("[Rollover Error]", err);
    }
  }, 30000); // Clock check once every 30 seconds
});
