/**
 * ColinsChartsMacros - Weight Detail View Controller
 * Manages full weight history analytics, chronological regression drawing, dynamic zooming, and panning.
 */

window.WeightDetailController = {
  chartInstance: null,
  isInitialized: false,
  zoomSteps: [3, 5, 7, 10, 14, 30, 60, 90, 120, 180, 240, 300, 365, 545, 730], // Days
  zoomLabels: ["3 Days", "5 Days", "7 Days", "10 Days", "14 Days", "1 Month", "2 Months", "3 Months", "4 Months", "6 Months", "8 Months", "10 Months", "12 Months", "18 Months", "2 Years"],
  currentZoomIndex: 4, // Default to 14 days
  panOffset: 0, // Days offset from today (0 means anchored to today)

  init() {
    if (this.isInitialized) return;

    // Bind Zoom Buttons
    const btnOut = document.getElementById("btn-zoom-out");
    const btnIn = document.getElementById("btn-zoom-in");
    const btnPanLeft = document.getElementById("btn-pan-left");
    const btnPanRight = document.getElementById("btn-pan-right");
    const btnToday = document.getElementById("btn-today");

    if (btnOut) btnOut.addEventListener("click", () => this.zoomOut());
    if (btnIn) btnIn.addEventListener("click", () => this.zoomIn());
    if (btnPanLeft) btnPanLeft.addEventListener("click", () => this.panLeft());
    if (btnPanRight) btnPanRight.addEventListener("click", () => this.panRight());
    if (btnToday) btnToday.addEventListener("click", () => this.goToToday());

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
    // Pan backward in time by 60% of current zoom window
    const windowDays = this.zoomSteps[this.currentZoomIndex];
    this.panOffset += Math.max(1, Math.round(windowDays * 0.6));
    this.renderChart();
  },

  panRight() {
    // Pan forward in time by 60% of current zoom window
    const windowDays = this.zoomSteps[this.currentZoomIndex];
    this.panOffset -= Math.max(1, Math.round(windowDays * 0.6));
    if (this.panOffset < 0) this.panOffset = 0; // Don't pan into the future beyond today
    this.renderChart();
  },

  goToToday() {
    this.panOffset = 0;
    this.currentZoomIndex = 4; // Default to 14 Days
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
    
    // Compute Linear Regression across the VISIBLE dataset on the screen
    const allLoggedDates = Object.keys(allWeightLogs).filter(d => allWeightLogs[d] !== null && allWeightLogs[d] !== undefined).sort();
    
    // Calculate and display historical metrics for the detail view
    this.renderStats("detail", allWeightLogs, allLoggedDates, unit);

    let regressionDataset = Array(datesInRange.length).fill(null);
    
    // Extract visible points
    let pointsForRegression = [];
    datesInRange.forEach((date, idx) => {
      const key = dateKeys[idx];
      const w = allWeightLogs[key];
      if (w !== null && w !== undefined) {
        pointsForRegression.push({ date: date, weight: w });
      }
    });

    // Fallback: if there are fewer than 2 visible points on screen, use all historical logged points so the line is still displayed
    if (pointsForRegression.length < 2 && allLoggedDates.length >= 2) {
      pointsForRegression = allLoggedDates.map(dStr => ({
        date: new Date(dStr + "T12:00:00"),
        weight: allWeightLogs[dStr]
      }));
    }

    if (pointsForRegression.length >= 2) {
      // Sort points chronologically
      pointsForRegression.sort((a, b) => a.date - b.date);
      
      const firstDateMs = pointsForRegression[0].date.getTime();
      const points = pointsForRegression.map(p => {
        const elapsedDays = (p.date.getTime() - firstDateMs) / (1000 * 60 * 60 * 24);
        return { x: elapsedDays, y: p.weight };
      });

      const { slope, intercept } = AppUtils.calculateLinearRegression(points);
      
      if (slope !== 0 || intercept !== 0) {
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

    const yRange = maxVal - minVal;
    const dynamicStepSize = yRange <= 10 ? 0.5 : (yRange <= 20 ? 1.0 : (yRange <= 50 ? 5.0 : 10.0));

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
            pointHitRadius: 25,
            backgroundColor: weightGradient,
            fill: true,
            tension: 0.15,
            spanGaps: true
          },
          {
            label: "Trendline",
            data: regressionDataset,
            borderColor: "#ffffff",
            borderWidth: 2.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "nearest",
          intersect: false,
          axis: "x"
        },
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
              stepSize: dynamicStepSize,
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
    let weeklyRate = parseFloat(profile.weeklyRate) || 0;

    if (loggedDates.length >= 7) {
      const lastDateStr = loggedDates[loggedDates.length - 1];
      const lastDate = new Date(lastDateStr + "T12:00:00");
      const sevenDaysAgo = new Date(lastDate);
      sevenDaysAgo.setDate(lastDate.getDate() - 6); // Covers exactly 7 calendar days inclusive of lastDate

      // Filter all logged points within this 7-day window
      const pointsInWindow = [];
      loggedDates.forEach(dStr => {
        const d = new Date(dStr + "T12:00:00");
        if (d >= sevenDaysAgo && d <= lastDate) {
          pointsInWindow.push({
            x: (d.getTime() - sevenDaysAgo.getTime()) / (1000 * 60 * 60 * 24), // Days elapsed
            y: allWeightLogs[dStr]
          });
        }
      });

      // Require exactly 7 logs in the last 7 days
      if (pointsInWindow.length >= 7) {
        pointsInWindow.sort((a, b) => a.x - b.x);
        
        // Compute linear regression slope
        const { slope: slopePerDay } = AppUtils.calculateLinearRegression(pointsInWindow);
        const slopePerWeek = slopePerDay * 7;
        
        // Determine if trend direction is progressing towards target weight
        const isLosingGoal = current > targetWeight;
        const isProgressing = isLosingGoal ? (slopePerWeek < 0) : (slopePerWeek > 0);
        
        if (isProgressing) {
          weeklyRate = Math.abs(slopePerWeek);
        }
      }
    }

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
