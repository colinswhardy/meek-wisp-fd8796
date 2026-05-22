/**
 * ColinsChartsMacros - Weight Detail View Controller
 * Manages full weight history analytics, chronological regression drawing, dynamic zooming, and auto-scroll alignment.
 */

window.WeightDetailController = {
  chartInstance: null,
  zoomLevel: 100, // percentage: default is 100% (shows 6 months of data fitting the screen)
  isInitialized: false,

  init() {
    if (this.isInitialized) return;

    // Bind Zoom Buttons
    const btnOut = document.getElementById("btn-zoom-out");
    const btnIn = document.getElementById("btn-zoom-in");
    const btnFit = document.getElementById("btn-zoom-fit");

    if (btnOut) {
      btnOut.addEventListener("click", () => this.adjustZoom(-50));
    }
    if (btnIn) {
      btnIn.addEventListener("click", () => this.adjustZoom(50));
    }
    if (btnFit) {
      btnFit.addEventListener("click", () => this.resetZoom());
    }

    this.isInitialized = true;
  },

  adjustZoom(delta) {
    const newZoom = Math.max(this.zoomLevel + delta, 100);
    if (newZoom !== this.zoomLevel) {
      this.zoomLevel = newZoom;
      this.applyZoomAndScroll(true);
    }
  },

  resetZoom() {
    if (this.zoomLevel !== 100) {
      this.zoomLevel = 100;
      this.applyZoomAndScroll(false); // don't need to scroll to end if it fits the screen
    }
  },

  applyZoomAndScroll(scrollToEnd = true) {
    const container = document.getElementById("detail-chart-container");
    const badge = document.getElementById("zoom-level-badge");
    const scrollWrapper = document.getElementById("detail-chart-scroll-wrapper");

    if (container) {
      container.style.width = this.zoomLevel + "%";
    }
    if (badge) {
      badge.textContent = this.zoomLevel + "%";
    }

    // Tell Chart.js to resize to fill the new container width
    if (this.chartInstance) {
      this.chartInstance.resize();
    }

    // Scroll to the far right (most recent weights) after rendering/scaling
    if (scrollToEnd && scrollWrapper) {
      setTimeout(() => {
        scrollWrapper.scrollLeft = scrollWrapper.scrollWidth - scrollWrapper.clientWidth;
      }, 50);
    }
  },

  render() {
    // Make sure event listeners are attached
    this.init();

    const allWeightLogs = AppState.data.weights || {};
    const unit = AppState.data.settings.unit || "lbs";

    // 1. Gather all logged weights chronologically for analytics
    const loggedDates = Object.keys(allWeightLogs).filter(d => allWeightLogs[d] !== null && allWeightLogs[d] !== undefined).sort();
    
    // Calculate and display historical metrics
    this.renderStats(allWeightLogs, loggedDates, unit);

    // 2. Generate contiguous dates for the last 90 days (3 months) ending today
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 90);

    const datesInRange = [];
    const currentIter = new Date(startDate);
    
    // Safety check to prevent infinite loop
    let safetyCounter = 0;
    while (currentIter <= today && safetyCounter < 2000) {
      datesInRange.push(new Date(currentIter));
      currentIter.setDate(currentIter.getDate() + 1);
      safetyCounter++;
    }

    // Format keys ("YYYY-MM-DD")
    const dateKeys = datesInRange.map(d => this.formatISODate(d));

    // Display labels e.g. "May 14"
    const displayLabels = datesInRange.map(d => {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    });

    // 3. Map weight values (null if day skipped)
    const actualWeights = dateKeys.map(key => allWeightLogs[key] || null);

    // 4. Compute Linear Regression dataset coordinates
    const regressionDataset = this.computeRegressionDataset(datesInRange, dateKeys, allWeightLogs);

    // 5. Setup Chart Canvas
    const canvas = document.getElementById("weightDetailChart");
    if (!canvas) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    const weightGradient = ctx.createLinearGradient(0, 0, 0, 300);
    weightGradient.addColorStop(0, "rgba(59, 130, 246, 0.25)");
    weightGradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");

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
            pointRadius: datesInRange.length > 90 ? 2 : 4, // smaller points if huge range
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
        plugins: {
          legend: {
            display: false
          },
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
            grid: {
              display: false
            },
            ticks: {
              color: "#909bb2",
              font: {
                family: "Inter",
                size: 11
              },
              maxRotation: 45,
              autoSkip: true,
              autoSkipPadding: 15
            }
          },
          y: {
            grid: {
              color: "rgba(255, 255, 255, 0.03)"
            },
            ticks: {
              color: "#909bb2",
              font: {
                family: "Inter",
                size: 11
              },
              callback: function(value) {
                return value.toFixed(1);
              }
            }
          }
        }
      }
    });

    // 6. Apply Current Zoom and automatically scroll to the most recent data
    this.applyZoomAndScroll(this.zoomLevel !== 100);
  },

  renderStats(allWeightLogs, loggedDates, unit) {
    const elCurrent = document.getElementById("detail-val-current");
    const elChange = document.getElementById("detail-val-change");
    const elPeak = document.getElementById("detail-val-peak");
    const elFloor = document.getElementById("detail-val-floor");
    const elAvg = document.getElementById("detail-val-avg");

    if (!elCurrent || !elChange || !elPeak || !elFloor || !elAvg) return;

    if (loggedDates.length === 0) {
      elCurrent.textContent = "--";
      elChange.textContent = "--";
      elChange.className = "";
      elPeak.textContent = "--";
      elFloor.textContent = "--";
      elAvg.textContent = "--";
      return;
    }

    const weights = loggedDates.map(d => allWeightLogs[d]);
    const current = weights[weights.length - 1];
    const earliest = weights[0];
    const netChange = current - earliest;
    const peak = Math.max(...weights);
    const floor = Math.min(...weights);
    const sum = weights.reduce((a, b) => a + b, 0);
    const avg = sum / weights.length;

    elCurrent.textContent = `${current.toFixed(1)} ${unit}`;
    
    const sign = netChange > 0 ? "+" : "";
    elChange.textContent = `${sign}${netChange.toFixed(1)} ${unit}`;
    if (netChange > 0) {
      elChange.className = "gain";
    } else if (netChange < 0) {
      elChange.className = "loss";
    } else {
      elChange.className = "";
    }

    elPeak.textContent = `${peak.toFixed(1)} ${unit}`;
    elFloor.textContent = `${floor.toFixed(1)} ${unit}`;
    elAvg.textContent = `${avg.toFixed(1)} ${unit}`;
  },

  computeRegressionDataset(datesInRange, dateKeys, allWeightLogs) {
    const points = [];
    const firstDateMs = datesInRange[0].getTime();

    // Map each date to: x = elapsed days, y = logged weight
    for (let i = 0; i < datesInRange.length; i++) {
      const key = dateKeys[i];
      const weight = allWeightLogs[key];
      if (weight !== undefined && weight !== null) {
        const elapsedDays = (datesInRange[i].getTime() - firstDateMs) / (1000 * 60 * 60 * 24);
        points.push({ x: elapsedDays, y: weight });
      }
    }

    if (points.length < 2) {
      return Array(datesInRange.length).fill(null);
    }

    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
      const p = points[i];
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) {
      return Array(datesInRange.length).fill(null);
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    return datesInRange.map((date) => {
      const elapsedDays = (date.getTime() - firstDateMs) / (1000 * 60 * 60 * 24);
      const predictedWeight = slope * elapsedDays + intercept;
      return parseFloat(predictedWeight.toFixed(1));
    });
  },

  formatISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
};
