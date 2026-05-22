/**
 * ColinsChartsMacros - Single Page App Router
 * Manages view transition layers, navbar states, browser History navigation, and stream safety.
 */

window.appRouter = {
  panels: {},
  navItems: [],
  scrollPositions: {},
  lastActivePanelByTab: {},

  init() {
    this.scrollPositions = {};
    this.lastActivePanelByTab = {
      dashboard: "dashboard",
      food: "food",
      weight: "weight",
      strategy: "strategy"
    };

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
        const activeNavTab = this.getNavbarTabForPanel(AppState.activeTab);
        
        if (activeNavTab === tab) {
          // Re-clicked the currently active tab button: reset its root scroll to 0 and navigate there
          const rootPanel = tab;
          this.scrollPositions[rootPanel] = 0;
          this.navigate(rootPanel);
        } else {
          // Clicked a different tab button: restore last active sub-panel in that group
          const targetPanel = this.lastActivePanelByTab[tab] || tab;
          this.navigate(targetPanel);
        }
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

  getNavbarTabForPanel(panelName) {
    if (panelName === "dashboard" || panelName === "settings") {
      return "dashboard";
    }
    if (panelName === "food" || panelName === "add_recipe" || panelName === "food_selector") {
      return "food";
    }
    if (panelName === "weight" || panelName === "weight_planner" || panelName === "weight_budgets") {
      return "weight";
    }
    if (panelName === "strategy") {
      return "strategy";
    }
    return null;
  },

  isBackNavigation(previousTab, tabName, pushState) {
    if (!pushState) return true; // browser popstate / back gestures

    const parentOf = {
      settings: "dashboard",
      add_recipe: "food",
      weight_planner: "strategy",
      weight_budgets: "strategy"
    };

    if (parentOf[previousTab] === tabName) {
      return true;
    }

    if (previousTab === "food_selector" && (tabName === "food" || tabName === "add_recipe")) {
      return true;
    }

    return false;
  },

  navigate(tabName, pushState = true) {
    if (!this.panels[tabName]) return;
    
    // Close camera scanner stream cleanly if leaving the active camera tabs
    if ((AppState.activeTab === "dashboard" || AppState.activeTab === "food" || AppState.activeTab === "add_recipe") && tabName !== AppState.activeTab) {
      BarcodeScannerManager.stop();
    }

    const previousTab = AppState.activeTab;
    const targetGroup = this.getNavbarTabForPanel(tabName);

    // Save scroll position of the outgoing panel
    const viewport = document.querySelector(".app-viewport");
    if (viewport && previousTab) {
      this.scrollPositions[previousTab] = viewport.scrollTop;
    }

    // Reset scroll of incoming panel if this is a back navigation
    const isBack = this.isBackNavigation(previousTab, tabName, pushState);
    if (isBack) {
      this.scrollPositions[tabName] = 0;
    }

    AppState.activeTab = tabName;

    // Update last active panel under the target group
    if (targetGroup) {
      this.lastActivePanelByTab[targetGroup] = tabName;
    }

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

    // Restore scroll position instantly
    if (viewport) {
      const targetScrollTop = this.scrollPositions[tabName] || 0;
      const originalScrollBehavior = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = "auto";
      viewport.scrollTop = targetScrollTop;
      viewport.offsetHeight; // force synchronous reflow to ensure instant scroll is rendered
      viewport.style.scrollBehavior = originalScrollBehavior;
    }
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
