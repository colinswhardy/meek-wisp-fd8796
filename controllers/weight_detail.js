/**
 * ColinsChartsMacros - Weight Detail View Controller
 * Manages full weight history analytics, chronological regression drawing, dynamic zooming, and auto-scroll alignment.
 */

window.WeightDetailController = {
  chartInstance: null,
  yAxisChart: null,
  zoomLevel: 100,
  isInitialized: false,
  _popstateHandler: null,

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

    // Fullscreen button
    const btnFullscreen = document.getElementById("btn-fullscreen-chart");
    if (btnFullscreen) {
      btnFullscreen.addEventListener("click", () => this.toggleFullscreen());
    }

    // Back button wiring: if in fullscreen, exit fullscreen instead of navigating
    const btnBack = document.querySelector("#panel-weight-history-detail .btn-back");
    if (btnBack) {
      btnBack.addEventListener("click", (e) => {
        const panel = document.getElementById("panel-weight-history-detail");
        if (panel && panel.classList.contains("chart-fullscreen-mode")) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleFullscreen();
        }
        // Otherwise the inline onclick="appRouter.navigate('weight')" runs normally
      }, true);
    }
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

    // Re-render Y-axis overlay after resize
    if (this.chartInstance) {
      setTimeout(() => this.renderYAxisOverlay(), 50);
    }

    // Scroll to the far right (most recent weights) after rendering/scaling
    if (scrollToEnd && scrollWrapper) {
      setTimeout(() => {
        scrollWrapper.scrollLeft = scrollWrapper.scrollWidth - scrollWrapper.clientWidth;
      }, 80);
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

    // 2. Generate contiguous dates for the last 45 days (1.5 months) ending today
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 45);

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

    // Build smart deduplicated labels
    const displayLabels = this.buildSmartLabels(datesInRange);

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
            pointRadius: datesInRange.length > 90 ? 2 : 4,
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
          padding: { left: 0, right: 8, top: 4, bottom: 0 }
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
            grid: { display: false },
            ticks: {
              color: "#909bb2",
              font: { family: "Inter", size: 10 },
              maxRotation: 35,
              autoSkip: false,
              // Show tick only if label is non-empty
              callback: function(val, index) {
                return displayLabels[index] || "";
              }
            }
          },
          y: {
            // Hide the Y-axis on the scrollable chart — we'll draw it on the sticky overlay
            display: false,
            grid: { color: "rgba(255, 255, 255, 0.03)" },
            ticks: {
              color: "#909bb2",
              font: { family: "Inter", size: 11 },
              callback: function(value) { return value.toFixed(1); }
            }
          }
        }
      }
    });

    // 6. Apply Current Zoom and automatically scroll to the most recent data
    this.applyZoomAndScroll(this.zoomLevel !== 100);

    // 7. Draw the sticky Y-axis overlay
    setTimeout(() => this.renderYAxisOverlay(), 80);
  },

  /**
   * Build smart, deduplicated X-axis labels.
   * - Spans <= 60 days: show "Mon DD" on the first of the month and every ~7 days; suppress duplicates.
   * - Spans > 60 days: show "Mon YYYY" only on the first occurrence of each month; rest empty.
   */
  buildSmartLabels(datesInRange) {
    const totalDays = datesInRange.length;
    const labels = Array(totalDays).fill("");
    const seen = new Set();

    if (totalDays <= 60) {
      // Show "Mon DD" format, one per ~7 days, no duplicates
      let lastShownIndex = -999;
      for (let i = 0; i < totalDays; i++) {
        const d = datesInRange[i];
        const dayOfMonth = d.getUTCDate();
        // Show label on 1st of month, or every ~7 days
        const isFirstOfMonth = dayOfMonth === 1;
        const isWeekBoundary = (i - lastShownIndex) >= 7;
        if (isFirstOfMonth || isWeekBoundary) {
          const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${dayOfMonth}`;
          if (!seen.has(key)) {
            seen.add(key);
            const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
            labels[i] = label;
            lastShownIndex = i;
          }
        }
      }
    } else {
      // Show "Mon YYYY" only on the first day of each new month in the range
      for (let i = 0; i < totalDays; i++) {
        const d = datesInRange[i];
        const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
        if (!seen.has(monthKey)) {
          seen.add(monthKey);
          const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
          labels[i] = label;
        }
      }
    }

    return labels;
  },

  /**
   * Renders the sticky Y-axis overlay canvas to the left of the scrolling chart.
   * Reads scale state from the main chartInstance.
   */
  renderYAxisOverlay() {
    const mainChart = this.chartInstance;
    const overlayCanvas = document.getElementById("weightDetailYAxis");
    if (!mainChart || !overlayCanvas) return;

    // Get the chart area and Y scale from the main chart
    // Since the Y axis is hidden on the main chart, we need to derive min/max from its data
    const datasets = mainChart.data.datasets;
    let minVal = Infinity, maxVal = -Infinity;
    datasets.forEach(ds => {
      ds.data.forEach(v => {
        if (v !== null && v !== undefined) {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
      });
    });
    if (minVal === Infinity) { minVal = 0; maxVal = 100; }

    // Add a small padding to min/max so points aren't clipped at the edge
    const range = maxVal - minVal || 1;
    const pad = range * 0.1;
    minVal = minVal - pad;
    maxVal = maxVal + pad;

    // Nice tick generation
    const nTicks = 5;
    const rawStep = (maxVal - minVal) / nTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = Math.ceil(rawStep / magnitude) * magnitude;
    const tickMin = Math.floor(minVal / step) * step;
    const ticks = [];
    for (let t = tickMin; t <= maxVal + step * 0.01; t += step) {
      ticks.push(parseFloat(t.toFixed(2)));
    }

    // Style the overlay canvas to match the chart height
    const chartCanvas = mainChart.canvas;
    const chartHeight = chartCanvas.offsetHeight;
    overlayCanvas.width = overlayCanvas.offsetWidth * (window.devicePixelRatio || 1);
    overlayCanvas.height = chartHeight * (window.devicePixelRatio || 1);
    overlayCanvas.style.height = chartHeight + "px";

    const dpr = window.devicePixelRatio || 1;
    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    const canvasH = chartHeight;
    const canvasW = overlayCanvas.offsetWidth;

    // Chart area top/bottom padding mirroring Chart.js internal layout
    const topPad = 10;
    const bottomPad = 30; // approximate x-axis tick height
    const plotH = canvasH - topPad - bottomPad;

    const valueToY = (v) => topPad + plotH * (1 - (v - minVal) / (maxVal - minVal));

    // Draw background matching the surface
    ctx.fillStyle = "rgba(13, 15, 22, 0.97)";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw a right border line
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvasW - 0.5, topPad);
    ctx.lineTo(canvasW - 0.5, canvasH - bottomPad);
    ctx.stroke();

    // Draw grid lines + tick labels
    ctx.font = `600 11px Inter, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#909bb2";

    ticks.forEach(tick => {
      const y = valueToY(tick);
      if (y < topPad || y > canvasH - bottomPad) return;
      ctx.fillText(tick.toFixed(1), canvasW - 6, y + 4);
    });

    ctx.restore();
  },

  toggleFullscreen() {
    const panel = document.getElementById("panel-weight-history-detail");
    const btnBack = document.querySelector("#panel-weight-history-detail .subpage-header");
    if (!panel) return;

    if (panel.classList.contains("chart-fullscreen-mode")) {
      // Exit fullscreen
      panel.classList.remove("chart-fullscreen-mode");
      if (btnBack) btnBack.style.display = "";
      // Remove popstate intercept
      if (this._popstateHandler) {
        window.removeEventListener("popstate", this._popstateHandler);
        this._popstateHandler = null;
      }
      if (screen.orientation && screen.orientation.unlock) {
        try { screen.orientation.unlock(); } catch(e) {}
      }
    } else {
      // Enter fullscreen — hide the back button
      panel.classList.add("chart-fullscreen-mode");
      if (btnBack) btnBack.style.display = "none";
      // Lock to landscape if supported
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
      // Intercept the next popstate (back gesture) to exit fullscreen instead
      this._popstateHandler = (e) => {
        e.stopImmediatePropagation();
        // Push a dummy state forward so we stay on this page
        history.pushState({ tab: "weight_history_detail" }, "", "#weight_history_detail");
        this.toggleFullscreen();
      };
      window.addEventListener("popstate", this._popstateHandler, { once: true });
    }

    // Resize chart after DOM update
    setTimeout(() => {
      if (this.chartInstance) this.chartInstance.resize();
      this.applyZoomAndScroll(true);
      this.renderYAxisOverlay();
    }, 100);
  },

  renderStats(allWeightLogs, loggedDates, unit) {
    const elCurrent = document.getElementById("detail-val-current");
    const elChange = document.getElementById("detail-val-change");
    const elTimeframe = document.getElementById("detail-val-timeframe");
    const elGoalDate = document.getElementById("detail-val-goaldate");

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

    // Use starting weight from profile for Total Change comparison
    const profile = AppState.data.profile || {};
    const startingWeight = profile.startingWeight;
    const referenceWeight = startingWeight !== null && startingWeight !== undefined ? startingWeight : weights[0];
    const netChange = current - referenceWeight;

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

    // Estimated Timeframe & Goal Date from planner profile data
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
