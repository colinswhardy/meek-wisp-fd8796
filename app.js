/**
 * ColinsChartsMacros - Main Entry Point
 * Orchestrates and initializes all sub-controllers and views.
 */

// Global App Initialization Lifecycles
window.addEventListener("DOMContentLoaded", async () => {
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

  // Initialize Local Cache DB
  try {
    console.log("[Init] Initializing Local Food Cache IndexedDB...");
    await window.FoodDatabase.initDB();
  } catch (err) {
    console.error("[Init] Failed to initialize Local Food Cache DB:", err);
  }

  initController("AppState", AppState);
  initController("appRouter", appRouter);
  initController("CalendarSelectorController", CalendarSelectorController);
  initController("DashboardController", DashboardController);
  
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
    
    // Clear recovery timer and set initialized status
    window.AppInitialized = true;
    if (window.appLoadTimer) {
      clearTimeout(window.appLoadTimer);
      console.log("[Init] App loaded successfully. PWA Recovery timer cleared.");
    }
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

  // Low-latency visual "clickable box" gesture accelerator
  const handleGlobalPointerDown = (e) => {
    const target = e.target;

    // 1. If clicked inside an interactive element like a button, link, or switch toggle, let it handle its own click
    if (target.closest('button, a, .switch-toggle, select, option, label[for]')) {
      return;
    }

    // 2. If clicking a label, find the associated input by id and focus/select it immediately
    if (target.tagName === 'LABEL') {
      const htmlFor = target.getAttribute('for');
      if (htmlFor) {
        const input = document.getElementById(htmlFor);
        if (input) {
          input.focus();
          if (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number' || input.type === 'password')) {
            try {
              input.select();
            } catch (err) {}
          }
        }
      }
      return;
    }

    // 3. If clicking directly on an input or textarea (except file/checkbox/radio), force focus and select to bring up keyboard instantly
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      if (target.type === 'file' || target.type === 'checkbox' || target.type === 'radio') {
        return;
      }
      target.focus();
      if (target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'number' || target.type === 'password')) {
        try {
          target.select();
        } catch (err) {}
      }
      return;
    }

    // 4. Check if clicked inside a styled input box container/wrapper
    const containerSelectors = '.form-group, .weight-input-container, .weight-input-wrapper, .input-inline, .pref-row';
    const container = target.closest(containerSelectors);
    if (container) {
      const input = container.querySelector('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea');
      if (input) {
        input.focus();
        if (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number' || input.type === 'password')) {
          try {
            input.select();
          } catch (err) {}
        }
      }
    }
  };

  // Listen to pointerdown on document to bypass mobile touch delay completely
  document.addEventListener('pointerdown', handleGlobalPointerDown, { passive: true });

  // 5. Scroll focused card container to the top of the screen (just below header)
  window.scrollToAlignWithTop = function(element) {
    if (!element) return;
    const header = document.querySelector(".app-header");
    const headerHeight = header ? header.offsetHeight : 54;
    const viewport = document.querySelector(".app-viewport");

    setTimeout(() => {
      const rect = element.getBoundingClientRect();
      if (viewport && window.getComputedStyle(viewport).overflowY === "auto") {
        const currentScrollTop = viewport.scrollTop;
        const targetScroll = currentScrollTop + rect.top - headerHeight - 10;
        viewport.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth"
        });
      } else {
        const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
        const targetScroll = currentScrollTop + rect.top - headerHeight - 10;
        window.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth"
        });
      }
    }, 80);
  };

  document.addEventListener("focusin", (e) => {
    const target = e.target;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
      const container = target.closest(".glass-card, .scanner-activation-card, .custom-food-card, .weight-logger-card, .planner-card, .recipe-meta-card, .recipe-ingredients-card, .danger-zone-card");
      if (container) {
        window.scrollToAlignWithTop(container);
      }
    }
  });

  // 6. Keyboard visibility detector to toggle body class
  const detectKeyboard = () => {
    const isInputFocused = document.activeElement && 
      (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") && 
      !["checkbox", "radio", "button", "submit", "file"].includes(document.activeElement.type);
      
    const heightThreshold = window.screen.height * 0.75;
    const isHeightShrunk = window.innerHeight < heightThreshold;

    if (isInputFocused && isHeightShrunk) {
      document.body.classList.add("keyboard-visible");
    } else {
      document.body.classList.remove("keyboard-visible");
    }
  };

  window.addEventListener("resize", detectKeyboard);
  document.addEventListener("focusin", () => setTimeout(detectKeyboard, 50));
  document.addEventListener("focusout", () => setTimeout(detectKeyboard, 50));
});
