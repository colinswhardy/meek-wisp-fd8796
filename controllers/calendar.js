/**
 * ColinsChartsMacros - Calendar Selector View Controller
 * Manages the calendar toolbar date shifting and labels.
 */

window.CalendarSelectorController = {
  labelEl: null,
  btnPrev: null,
  btnNext: null,

  init() {
    this.labelEl = document.getElementById("current-day-label");
    this.btnPrev = document.getElementById("btn-prev-day");
    this.btnNext = document.getElementById("btn-next-day");

    if (this.btnPrev) {
      this.btnPrev.addEventListener("click", () => this.shiftDay(-1));
    }
    if (this.btnNext) {
      this.btnNext.addEventListener("click", () => this.shiftDay(1));
    }

    this.updateLabel();
  },

  shiftDay(offsetDays) {
    const current = new Date(AppState.selectedDateISO + "T00:00:00");
    current.setDate(current.getDate() + offsetDays);
    
    AppState.selectedDateISO = WeightChartManager.formatISODate(current);
    
    this.updateLabel();
    appRouter.refreshCurrentView();
  },

  updateLabel() {
    if (!this.labelEl) return;
    
    const selected = new Date(AppState.selectedDateISO + "T00:00:00");
    const today = new Date(AppState.getTodayISODate() + "T00:00:00");

    const diffTime = selected.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      this.labelEl.textContent = "Today";
    } else if (diffDays === -1) {
      this.labelEl.textContent = "Yesterday";
    } else if (diffDays === 1) {
      this.labelEl.textContent = "Tomorrow";
    } else {
      this.labelEl.textContent = selected.toLocaleDateString("en-US", { 
        weekday: "short", 
        month: "short", 
        day: "numeric", 
        timeZone: "UTC" 
      });
    }
  }
};
