/**
 * ColinsChartsMacros - Weight Detail View Controller
 * Manages full weight history analytics, chronological regression drawing, dynamic zooming, and panning.
 */

window.WeightDetailController = {
  chartInstance: null,
  isInitialized: false,
  zoomSteps: [3, 5, 7, 10, 14, 30, 90, 180, 365, 730, 1825], // Days
  zoomLabels: ["3 Days", "5 Days", "7 Days", "10 Days", "14 Days", "1 Month", "3 Months", "6 Months", "1 Year", "2 Years", "5 Years"],
  currentZoomIndex: 4, // Default to 14 days
  panOffset: 0, // Days offset from today (0 means anchored to today)

  init() {
    if (this.isInitialized) return;

    // Bind Zoom Buttons
    const btnOut = document.getElementById("btn-zoom-out");
    const btnIn = document.getElementById("btn-zoom-in");
    const btnPanLeft = document.getElementById("btn-pan-left");
    const btnPanRight = document.getElementById("btn-pan-right");

    if (btnOut) btnOut.addEventListener("click", () => this.zoomOut());
    if (btnIn) btnIn.addEventListener("click", () => this.zoomIn());
    if (btnPanLeft) btnPanLeft.addEventListener("click", () => this.panLeft());
    if (btnPanRight) btnPanRight.addEventListener("click", () => this.panRight());

    this.isInitialized = true;
  },

  zoomOut() {
    if (this.currentZoomIndex < this.zoomSteps.length - 1) {
      this.currentZoomIndex++;
      this.renderChart();
    }
  },

  zoomIn() {
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
      this.renderChart();
    }
  },

  panLeft() {
    // Pan backward in time by half the current zoom window
    const windowDays = this.zoomSteps[this.currentZoomIndex];
    this.panOffset += Math.max(1, Math.floor(windowDays / 2));
    this.renderChart();
  },

  panRight() {
    // Pan forward in time
    const windowDays = this.zoomSteps[this.currentZoomIndex];
    this.panOffset -= Math.max(1, Math.floor(windowDays / 2));
    if (this.panOffset < 0) this.panOffset = 0; // Don't pan into the future beyond today
    this.renderChart();
  },

  formatISODate(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },

  render() {
    this.init();
    
    // When opened fresh, reset to default state
    this.currentZoomIndex = 4;
    this.panOffset = 0;
    
    this.renderChart();
    
    // We also need to update the dashboard stats if they exist when we render
    this.renderDashboardStats();
  },

  renderChart() {
    const allWeightLogs = AppState.data.weights || {};
    const unit = AppState.data.settings.unit || "lbs";

    // Update Zoom Badge
    const badge = document.getElementById("zoom-level-badge");
    if (badge) badge.textContent = this.zoomLabels[this.currentZoomIndex];

    const zoomDays = this.zoomSteps[this.currentZoomIndex];

    // Determine the date range based on zoom and pan offset
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() - this.panOffset);
    
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - zoomDays);

    const datesInRange = [];
    const currentIter = new Date(startDate);
    const seenDateKeys = new Set();
    
    while (currentIter <= endDate) {
      currentIter.setHours(12, 0, 0, 0);
      const isoKey = this.formatISODate(currentIter);
      if (!seenDateKeys.has(isoKey)) {
        seenDateKeys.add(isoKey);
        datesInRange.push(new Date(currentIter));
      }
      currentIter.setDate(currentIter.getDate() + 1);
    }

    const dateKeys = datesInRange.map(d => this.formatISODate(d));
    const displayLabels = this.buildSmartLabels(datesInRange);
    const actualWeights = dateKeys.map(key => allWeightLogs[key] || null);
    
    // Compute Linear Regression across the ENTIRE dataset so the trendline is accurate for the whole history
    const allLoggedDates = Object.keys(allWeightLogs).filter(d => allWeightLogs[d] !== null && allWeightLogs[d] !== undefined).sort();
    
    // Calculate and display historical metrics for the detail view
    this.renderStats("detail", allWeightLogs, allLoggedDates, unit);

    let regressionDataset = Array(datesInRange.length).fill(null);
    if (allLoggedDates.length >= 2) {
      const firstDateStr = allLoggedDates[0];
      const firstDateMs = new Date(firstDateStr + "T12:00:00").getTime();
      
      const points = [];
      for (const d of allLoggedDates) {
        const ms = new Date(d + "T12:00:00").getTime();
        const elapsedDays = (ms - firstDateMs) / (1000 * 60 * 60 * 24);
        points.push({ x: elapsedDays, y: allWeightLogs[d] });
      }

      const n = points.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += points[i].x; sumY += points[i].y;
        sumXY += points[i].x * points[i].y; sumXX += points[i].x * points[i].x;
      }
      const denominator = n * sumXX - sumX * sumX;
      
      if (denominator !== 0) {
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        
        regressionDataset = datesInRange.map(date => {
          const elapsedDays = (date.getTime() - firstDateMs) / (1000 * 60 * 60 * 24);
          return parseFloat((slope * elapsedDays + intercept).toFixed(1));
        });
      }
    }

    // Determine Y Axis limits dynamically based on visible data
    const visibleValues = actualWeights.filter(w => w !== null).concat(regressionDataset.filter(r => r !== null));
    let minVal = unit === "lbs" ? 100 : 45;
    let maxVal = unit === "lbs" ? 200 : 90;

    if (visibleValues.length > 0) {
      const vMin = Math.min(...visibleValues);
      const vMax = Math.max(...visibleValues);
      const pad = Math.max(0.5, (vMax - vMin) * 0.15);
      minVal = Math.floor(vMin - pad);
      maxVal = Math.ceil(vMax + pad);
      if (minVal === maxVal) { minVal -= 5; maxVal += 5; }
    }

    const canvas = document.getElementById("weightDetailChart");
    if (!canvas) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    const weightGradient = ctx.createLinearGradient(0, 0, 0, 300);
    weightGradient.addColorStop(0, "rgba(59, 130, 246, 0.25)");
    weightGradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");

    // Only draw points if we're not zoomed out too far
    const pointRadius = zoomDays > 90 ? 0 : (zoomDays > 30 ? 2 : 4);

    this.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: displayLabels,
        datasets: [
          {
            label: `Actual Weight (${unit})`,
            data: actualWeights,
            borderColor: "#3b82f6",
            borderWidth: 3,
            pointBackgroundColor: "#3b82f6",
            pointBorderColor: "rgba(255,255,255,0.8)",
            pointBorderWidth: 1.5,
            pointRadius: pointRadius,
            pointHoverRadius: 6,
            backgroundColor: weightGradient,
            fill: true,
            tension: 0.15,
            spanGaps: true
          },
          {
            label: "Trendline",
            data: regressionDataset,
            borderColor: "#cbd5e1",
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { left: 5, right: 15, top: 10, bottom: 0 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(18, 20, 28, 0.95)",
            titleFont: { family: "Outfit", size: 13, weight: "bold" },
            bodyFont: { family: "Inter", size: 12 },
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            padding: 10,
            displayColors: true,
            callbacks: {
              label: function(context) {
                if (context.raw === null) return "No Log";
                return ` ${context.dataset.label.split(" (")[0]}: ${Number(context.raw).toFixed(1)} ${unit}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: {
              color: "#909bb2",
              font: { family: "Inter", size: 11 },
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: Math.min(10, Math.ceil(zoomDays / 2))
            }
          },
          y: {
            min: minVal,
            max: maxVal,
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: {
              color: "#909bb2",
              font: { family: "Inter", size: 11 },
              callback: function(value) { return value.toFixed(1); }
            }
          }
        }
      }
    });
  },

  buildSmartLabels(datesInRange) {
    return datesInRange.map(d => {
      // Just return standard short month/day. Chart.js will autoSkip appropriately
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
  },

  renderDashboardStats() {
    const allWeightLogs = AppState.data.weights || {};
    const unit = AppState.data.settings.unit || "lbs";
    const loggedDates = Object.keys(allWeightLogs).filter(d => allWeightLogs[d] !== null && allWeightLogs[d] !== undefined).sort();
    this.renderStats("dash", allWeightLogs, loggedDates, unit);
  },

  renderStats(prefix, allWeightLogs, loggedDates, unit) {
    const elCurrent = document.getElementById(`${prefix}-val-current`);
    const elChange = document.getElementById(`${prefix}-val-change`);
    const elTimeframe = document.getElementById(`${prefix}-val-timeframe`);
    const elGoalDate = document.getElementById(`${prefix}-val-goaldate`);

    if (!elCurrent || !elChange || !elTimeframe || !elGoalDate) return;

    if (loggedDates.length === 0) {
      elCurrent.textContent = "--";
      elChange.textContent = "--";
      elChange.className = "";
      elTimeframe.textContent = "--";
      elGoalDate.textContent = "--";
      return;
    }

    const weights = loggedDates.map(d => allWeightLogs[d]);
    const current = weights[weights.length - 1];

    const profile = AppState.data.profile || {};
    const startingWeight = profile.startingWeight;
    const referenceWeight = startingWeight !== null && startingWeight !== undefined ? startingWeight : weights[0];
    const netChange = current - referenceWeight;

    elCurrent.textContent = `${current.toFixed(1)} ${unit}`;
    
    const sign = netChange > 0 ? "+" : "";
    elChange.textContent = `${sign}${netChange.toFixed(1)} ${unit}`;
    if (netChange > 0) {
      elChange.className = "gain";
      elChange.style.color = "#ef4444"; // Red for gain
    } else if (netChange < 0) {
      elChange.className = "loss";
      elChange.style.color = "#22c55e"; // Green for loss
    } else {
      elChange.className = "";
      elChange.style.color = "#fff";
    }

    const targetWeight = parseFloat(profile.targetWeight) || 0;
    const weeklyRate = parseFloat(profile.weeklyRate) || 0;
    const weightDiff = Math.abs(current - targetWeight);
    const weeksToGoal = weeklyRate > 0 ? (weightDiff / weeklyRate) : 0;

    if (weeksToGoal > 0) {
      elTimeframe.textContent = `${weeksToGoal.toFixed(1)} Weeks`;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Math.round(weeksToGoal * 7));
      elGoalDate.textContent = targetDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } else {
      elTimeframe.textContent = "0 Weeks";
      elGoalDate.textContent = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }
};
