/**
 * ColinsChartsMacros - Strategy View Controller
 * Controls Calorie Cycling weekday schedules, toggling active days, and custom surplus amounts.
 */

window.StrategyController = {
  init() {
    // Enable/Disable Calorie Cycling
    const cyclingToggle = document.getElementById("cycling-enabled");
    if (cyclingToggle) {
      cyclingToggle.addEventListener("change", (e) => {
        AppState.data.settings.highCalorieDaysEnabled = e.target.checked;
        AppState.saveToStorage();
        this.toggleCyclingBodyVisibility();
        DashboardController.render();
        AppState.showToast(e.target.checked ? "Calorie cycling enabled" : "Calorie cycling disabled");
      });
    }

    // Set up day-by-day checkbox, dropdown, and value input listeners
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    weekdays.forEach(day => {
      // Toggle day enabled
      const dayCheckbox = document.getElementById(`cycling-day-${day}`);
      if (dayCheckbox) {
        dayCheckbox.addEventListener("change", (e) => {
          if (!AppState.data.settings.highCalorieDays[day]) {
            AppState.data.settings.highCalorieDays[day] = { enabled: false, type: "flat", value: 300 };
          }
          AppState.data.settings.highCalorieDays[day].enabled = e.target.checked;
          AppState.saveToStorage();
          this.toggleDayInputsVisibility(day, e.target.checked);
          DashboardController.render();
        });
      }

      // Dropdown type (+ kcal vs + %)
      const typeSelect = document.getElementById(`cycling-type-${day}`);
      if (typeSelect) {
        typeSelect.addEventListener("change", (e) => {
          if (!AppState.data.settings.highCalorieDays[day]) {
            AppState.data.settings.highCalorieDays[day] = { enabled: true, type: "flat", value: 300 };
          }
          AppState.data.settings.highCalorieDays[day].type = e.target.value;
          AppState.saveToStorage();
          DashboardController.render();
        });
      }

      // Value input
      const valInput = document.getElementById(`cycling-val-${day}`);
      if (valInput) {
        valInput.addEventListener("input", (e) => {
          if (!AppState.data.settings.highCalorieDays[day]) {
            AppState.data.settings.highCalorieDays[day] = { enabled: true, type: "flat", value: 300 };
          }
          AppState.data.settings.highCalorieDays[day].value = Number(e.target.value) || 0;
          AppState.saveToStorage();
          DashboardController.render();
        });
      }
    });
  },

  render() {
    const cyclingEnabled = AppState.data.settings.highCalorieDaysEnabled;
    const cyclingToggle = document.getElementById("cycling-enabled");
    if (cyclingToggle) {
      cyclingToggle.checked = cyclingEnabled;
    }
    this.toggleCyclingBodyVisibility();

    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    weekdays.forEach(day => {
      const dayConfig = AppState.data.settings.highCalorieDays[day] || { enabled: false, type: "flat", value: 300 };
      const el = document.getElementById(`cycling-day-${day}`);
      if (el) {
        el.checked = dayConfig.enabled;
      }
      this.toggleDayInputsVisibility(day, dayConfig.enabled);

      const typeEl = document.getElementById(`cycling-type-${day}`);
      if (typeEl) {
        typeEl.value = dayConfig.type;
      }
      const valEl = document.getElementById(`cycling-val-${day}`);
      if (valEl) {
        valEl.value = dayConfig.value;
      }
    });
  },

  toggleCyclingBodyVisibility() {
    const enabled = AppState.data.settings.highCalorieDaysEnabled;
    const body = document.getElementById("cycling-settings-body");
    if (body) {
      if (enabled) {
        body.classList.remove("hidden");
      } else {
        body.classList.add("hidden");
      }
    }
  },

  toggleDayInputsVisibility(day, enabled) {
    const inputsEl = document.getElementById(`cycling-inputs-${day}`);
    if (inputsEl) {
      if (enabled) {
        inputsEl.classList.remove("hidden");
      } else {
        inputsEl.classList.add("hidden");
      }
    }
  }
};
