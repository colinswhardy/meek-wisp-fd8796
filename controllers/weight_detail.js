/**
 * ColinsChartsMacros - Weight Detail View Controller
 * Manages full weight history analytics, chronological regression drawing, dynamic zooming, and auto-scroll alignment.
 */

window.WeightDetailController = {
  chartInstance: null,
  yAxisChart: null,
  zoomLevel: 100,
  isInitialized: false,
  isFreshNavigation: true,
  _popstateHandler: null,

  init() {
    if (this.isInitialized) return;

    // Bind Zoom Buttons
    const btnOut = document.getElementById("btn-zoom-out");
    const btnIn = document.getElementById("btn-zoom-in");
    const btnFit = document.getElementById("btn-zoom-fit");

    if (btnOut) {
      btnOut.addEventListener("click", () => this.adjustZoom(-25));
    }
    if (btnIn) {
      btnIn.addEventListener("click", () => this.adjustZoom(25));
    }
    if (btnFit) {
      btnFit.addEventListener("click", () => this.resetZoom());
    }

    // Bind Wipe All Weights button
    const btnWipe = document.getElementById("btn-wipe-all-weights");
    if (btnWipe) {
      btnWipe.addEventListener("click", () => this.confirmWipeAllWeights());
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
    // Dynamic step based on zoom level: if high, step is larger (e.g. 50 or 100), if low, step is smaller
    let step = 25;
    if (this.zoomLevel >= 1000) {
      step = 250;
    } else if (this.zoomLevel >= 500) {
      step = 100;
    } else if (this.zoomLevel >= 200) {
      step = 50;
    } else if (this.zoomLevel <= 25) {
      step = 5;
    }
    const realDelta = delta > 0 ? step : -step;
    const newZoom = Math.max(5, Math.min(this.zoomLevel + realDelta, 3000));
    if (newZoom !== this.zoomLevel) {
      this.zoomLevel = newZoom;
      this.applyZoomAndScroll(true);
      this.updateVisibleYScale();
    }
  },

  resetZoom() {
    const totalDays = this.totalDays || 14;
    const fitZoom = Math.max(5, Math.round((14 / totalDays) * 100));
    if (this.zoomLevel !== fitZoom) {
      this.zoomLevel = fitZoom;
      this.applyZoomAndScroll(false); // don't scroll to end, just fit all
      this.updateVisibleYScale();
    }
  },

  applyZoomAndScroll(scrollToEnd = true) {
    const container = document.getElementById("detail-chart-container");
    const badge = document.getElementById("zoom-level-badge");
    const scrollWrapper = document.getElementById("detail-chart-scroll-wrapper");
    const totalDays = this.totalDays || 14;

    // Default 100% zoom shows exactly 2 weeks (14 days)
    let widthPercent = (totalDays / 14) * this.zoomLevel;
    if (widthPercent < 100) {
      widthPercent = 100;
    }
    // Safe GPU limit: maximum 1500% of viewport width to avoid Canvas memory crash on mobile devices
    if (widthPercent > 1500) {
      widthPercent = 1500;
    }

    if (container) {
      container.style.width = widthPercent + "%";
    }
    if (badge) {
      let badgeText = "";
      const visibleDays = 1400 / this.zoomLevel;
      if (visibleDays >= totalDays) {
        badgeText = "All";
      } else if (visibleDays >= 7) {
        const wks = visibleDays / 7;
        badgeText = Number.isInteger(wks) ? `${wks} Wk${wks > 1 ? "s" : ""}` : `${wks.toFixed(1)} Wk${wks > 1 ? "s" : ""}`;
      } else if (visibleDays >= 1) {
        badgeText = `${Math.round(visibleDays)} Day${Math.round(visibleDays) !== 1 ? "s" : ""}`;
      } else {
        badgeText = `${Math.round(visibleDays * 24)} Hr${Math.round(visibleDays * 24) !== 1 ? "s" : ""}`;
      }
      badge.textContent = badgeText;
    }

    // Tell Chart.js to resize to fill the new container width
    if (this.chartInstance) {
      this.chartInstance.resize();
    }

    // Scroll to the far right (most recent weights) synchronously if scrollToEnd is true
    if (scrollToEnd && scrollWrapper) {
      this.isProgrammaticScroll = true;
      const maxScroll = scrollWrapper.scrollWidth - scrollWrapper.clientWidth;
      scrollWrapper.scrollLeft = maxScroll;
      // Clear programmatic flag on next animation frame/tick
      setTimeout(() => {
        this.isProgrammaticScroll = false;
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

    // 2. Generate contiguous dates from the earliest log or the last 45 days (whichever is older) ending today
    // Normalize today to local noon to avoid any midnight-crossing or timezone shift mismatches
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    let startDate = new Date(today);
    startDate.setDate(today.getDate() - 14);
    startDate.setHours(12, 0, 0, 0);

    if (loggedDates.length > 0) {
      const earliestLogDate = new Date(loggedDates[0] + "T12:00:00");
      if (earliestLogDate < startDate) {
        startDate = earliestLogDate;
      }
    }

    const datesInRange = [];
    const currentIter = new Date(startDate);
    const seenDateKeys = new Set();
    
    // Safety check to prevent infinite loop
    let safetyCounter = 0;
    while (currentIter <= today && safetyCounter < 2000) {
      // Force hours to local noon to prevent DST hours arithmetic drift crossing calendar days
      currentIter.setHours(12, 0, 0, 0);
      const isoKey = this.formatISODate(currentIter);
      
      // Absolute guarantee of calendar date deduplication
      if (!seenDateKeys.has(isoKey)) {
        seenDateKeys.add(isoKey);
        datesInRange.push(new Date(currentIter));
      }
      
      currentIter.setDate(currentIter.getDate() + 1);
      safetyCounter++;
    }

    const totalDays = datesInRange.length;

    // Set default zoom to 100% (which corresponds to exactly 14 days/2 weeks visible)
    if (this.isFreshNavigation) {
      this.zoomLevel = 100;
      this.isFreshNavigation = false;
    }

    // Format keys ("YYYY-MM-DD")
    const dateKeys = datesInRange.map(d => this.formatISODate(d));

    // Build smart deduplicated labels
    const displayLabels = this.buildSmartLabels(datesInRange);

    // 3. Map weight values (null if day skipped)
    const actualWeights = dateKeys.map(key => allWeightLogs[key] || null);

    this.totalDays = totalDays;
    this.actualWeights = actualWeights;

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
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const el = elements[0];
            if (el.datasetIndex === 0) {
              const index = el.index;
              const weight = actualWeights[index];
              const dateKey = dateKeys[index];
              if (weight !== null && weight !== undefined) {
                this.showWeightActionModal(dateKey, weight, unit);
              }
            }
          }
        },
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

    // Bind scroll listener for dynamic Y scaling
    const scrollWrapper = document.getElementById("detail-chart-scroll-wrapper");
    if (scrollWrapper) {
      let scrollTimeout = null;
      scrollWrapper.onscroll = () => {
        if (!this.chartInstance) return;
        if (this.isProgrammaticScroll) return; // Ignore programmatic scroll events
        if (scrollTimeout) {
          cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = requestAnimationFrame(() => {
          this.updateVisibleYScale();
        });
      };
    }

    // 6. Apply Current Zoom and automatically scroll to the most recent data (always true)
    this.applyZoomAndScroll(true);

    // 7. Initial visible Y scale and overlay rendering
    this.updateVisibleYScale();

    // 8. Render the chronological weight management list
    this.renderWeightList(allWeightLogs, loggedDates, unit);
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
        const dayOfMonth = d.getDate();
        // Show label on 1st of month, or every ~7 days
        const isFirstOfMonth = dayOfMonth === 1;
        const isWeekBoundary = (i - lastShownIndex) >= 7;
        if (isFirstOfMonth || isWeekBoundary) {
          const key = `${d.getFullYear()}-${d.getMonth()}-${dayOfMonth}`;
          if (!seen.has(key)) {
            seen.add(key);
            const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            labels[i] = label;
            lastShownIndex = i;
          }
        }
      }
    } else {
      // Show "Mon YYYY" only on the first day of each new month in the range
      for (let i = 0; i < totalDays; i++) {
        const d = datesInRange[i];
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
        if (!seen.has(monthKey)) {
          seen.add(monthKey);
          const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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
  renderYAxisOverlay(forcedMin = null, forcedMax = null) {
    const mainChart = this.chartInstance;
    const overlayCanvas = document.getElementById("weightDetailYAxis");
    if (!mainChart || !overlayCanvas) return;

    let minVal, maxVal;
    if (forcedMin !== null && forcedMax !== null) {
      minVal = forcedMin;
      maxVal = forcedMax;
    } else {
      if (mainChart.options.scales.y.min !== undefined && mainChart.options.scales.y.max !== undefined) {
        minVal = mainChart.options.scales.y.min;
        maxVal = mainChart.options.scales.y.max;
      } else {
        const datasets = mainChart.data.datasets;
        let dMin = Infinity, dMax = -Infinity;
        datasets.forEach(ds => {
          ds.data.forEach(v => {
            if (v !== null && v !== undefined) {
              if (v < dMin) dMin = v;
              if (v > dMax) dMax = v;
            }
          });
        });
        if (dMin === Infinity) { dMin = 0; dMax = 100; }
        const range = dMax - dMin || 1;
        const pad = range * 0.1;
        minVal = dMin - pad;
        maxVal = dMax + pad;
      }
    }

    // Nice tick generation based on minVal and maxVal
    const nTicks = 5;
    const rawStep = (maxVal - minVal) / nTicks;
    const magnitude = rawStep > 0 ? Math.pow(10, Math.floor(Math.log10(rawStep))) : 1;
    const step = Math.max(0.1, Math.ceil(rawStep / magnitude) * magnitude || 1);
    const tickMin = Math.floor(minVal / step) * step;
    const ticks = [];
    let safety = 0;
    for (let t = tickMin; t <= maxVal + step * 0.01 && safety < 100; t += step) {
      ticks.push(parseFloat(t.toFixed(2)));
      safety++;
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

  updateVisibleYScale() {
    const scrollWrapper = document.getElementById("detail-chart-scroll-wrapper");
    const container = document.getElementById("detail-chart-container");
    if (!scrollWrapper || !container || !this.chartInstance || !this.actualWeights) return;

    const scrollLeft = scrollWrapper.scrollLeft;
    const clientWidth = scrollWrapper.clientWidth;
    const scrollWidth = scrollWrapper.scrollWidth || container.offsetWidth;
    const totalDays = this.totalDays || this.actualWeights.length;

    if (scrollWidth <= 0 || totalDays <= 0) return;

    // Convert scroll position to data indices (add 1 day padding on each side)
    const startIndex = Math.max(0, Math.floor((scrollLeft / scrollWidth) * totalDays) - 1);
    const endIndex = Math.min(totalDays - 1, Math.ceil(((scrollLeft + clientWidth) / scrollWidth) * totalDays) + 1);

    const visibleWeights = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const w = this.actualWeights[i];
      if (w !== null && w !== undefined) {
        visibleWeights.push(w);
      }
    }

    // Also include trendline values in the visible range to avoid clipping
    const trendlineDataset = this.chartInstance.data.datasets[1];
    if (trendlineDataset && trendlineDataset.data) {
      for (let i = startIndex; i <= endIndex; i++) {
        const val = trendlineDataset.data[i];
        if (val !== null && val !== undefined) {
          visibleWeights.push(val);
        }
      }
    }

    let minVal, maxVal;
    if (visibleWeights.length > 0) {
      minVal = Math.min(...visibleWeights);
      maxVal = Math.max(...visibleWeights);
    } else {
      const allLogged = this.actualWeights.filter(w => w !== null && w !== undefined);
      if (allLogged.length > 0) {
        minVal = Math.min(...allLogged);
        maxVal = Math.max(...allLogged);
      } else {
        minVal = AppState.data.settings.unit === "lbs" ? 100 : 45;
        maxVal = AppState.data.settings.unit === "lbs" ? 200 : 90;
      }
    }

    // Add padding (15% of range, minimum 0.5 unit padding so weights aren't tightly bunched)
    const range = maxVal - minVal;
    let pad = 0.5;
    if (range > 0) {
      pad = Math.max(0.5, range * 0.15);
    }
    minVal = minVal - pad;
    maxVal = maxVal + pad;

    // Update Chart.js scale
    this.chartInstance.options.scales.y.min = parseFloat(minVal.toFixed(1));
    this.chartInstance.options.scales.y.max = parseFloat(maxVal.toFixed(1));
    this.chartInstance.update("none");

    // Redraw sticky Y-axis ticks overlay
    this.renderYAxisOverlay(minVal, maxVal);
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
      this.updateVisibleYScale();
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

  renderWeightList(allWeightLogs, loggedDates, unit) {
    const listContainer = document.getElementById("weight-history-list-container");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (loggedDates.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; padding: 24px; color: rgba(255, 255, 255, 0.4); font-size: 0.9rem;">No weight logs recorded yet.</div>`;
      return;
    }

    // Sort loggedDates descending to show most recent first in the history list!
    const sortedDatesDesc = [...loggedDates].sort().reverse();

    sortedDatesDesc.forEach(dateKey => {
      const weight = allWeightLogs[dateKey];
      if (weight === null || weight === undefined) return;

      const dateObj = new Date(dateKey + "T12:00:00");
      const formattedDate = dateObj.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

      const itemDiv = document.createElement("div");
      itemDiv.className = "weight-history-item";
      itemDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 6px; transition: transform 0.2s, background-color 0.2s;";
      
      itemDiv.innerHTML = `
        <div>
          <span style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 0.95rem; color: #fff;">${Number(weight).toFixed(1)} ${unit}</span>
          <span style="display: block; font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">${formattedDate}</span>
        </div>
        <button class="weight-row-delete-btn" data-date="${dateKey}" style="background: none; border: none; color: rgba(239, 68, 68, 0.7); cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; transition: color 0.2s;">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      `;

      // Hover effects
      itemDiv.addEventListener("mouseenter", () => {
        itemDiv.style.backgroundColor = "rgba(255, 255, 255, 0.06)";
      });
      itemDiv.addEventListener("mouseleave", () => {
        itemDiv.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
      });

      const delBtn = itemDiv.querySelector(".weight-row-delete-btn");
      delBtn.addEventListener("mouseenter", () => {
        delBtn.style.color = "#ef4444";
      });
      delBtn.addEventListener("mouseleave", () => {
        delBtn.style.color = "rgba(239, 68, 68, 0.7)";
      });

      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showWeightActionModal(dateKey, weight, unit);
      });

      listContainer.appendChild(itemDiv);
    });
  },

  showWeightActionModal(dateKey, weight, unit) {
    const modal = document.getElementById("weight-action-modal");
    const dateEl = document.getElementById("weight-modal-date");
    const valEl = document.getElementById("weight-modal-val");
    const deleteBtn = document.getElementById("btn-delete-weight-modal");
    const closeBtn = document.getElementById("btn-cancel-weight-modal");

    if (!modal || !dateEl || !valEl) return;

    // Parse date beautifully
    const dateObj = new Date(dateKey + "T12:00:00");
    const formattedDate = dateObj.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    dateEl.textContent = formattedDate;
    valEl.textContent = `${Number(weight).toFixed(1)} ${unit}`;

    // Show modal
    modal.classList.remove("hidden");

    // Clear event listeners from buttons to prevent multiple bindings
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    newCloseBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    newDeleteBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      this.confirmDeleteWeightEntry(dateKey, weight, unit);
    });
  },

  confirmDeleteWeightEntry(dateKey, weight, unit) {
    const modal = document.getElementById("confirm-weight-delete-modal");
    const labelEl = document.getElementById("weight-delete-label");
    const confirmBtn = document.getElementById("btn-confirm-weight-delete");
    const cancelBtn = document.getElementById("btn-cancel-weight-delete");

    if (!modal || !labelEl) {
      if (confirm(`Are you sure you want to delete the weight record of ${weight} ${unit} on ${dateKey}?`)) {
        this.deleteWeightEntry(dateKey);
      }
      return;
    }

    const dateObj = new Date(dateKey + "T12:00:00");
    const formattedDate = dateObj.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    labelEl.textContent = `${Number(weight).toFixed(1)} ${unit} on ${formattedDate}`;

    modal.classList.remove("hidden");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newCancelBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    newConfirmBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      this.deleteWeightEntry(dateKey);
    });
  },

  deleteWeightEntry(dateKey) {
    if (AppState.data.weights[dateKey] !== undefined) {
      delete AppState.data.weights[dateKey];
      AppState.saveToStorage();
      
      // Refresh both pages
      this.render();
      if (window.WeightController && typeof window.WeightController.render === "function") {
        window.WeightController.render();
      }
      
      AppState.showToast("Weight entry successfully removed.");
    }
  },

  confirmWipeAllWeights() {
    const modal = document.getElementById("confirm-weight-wipe-modal");
    const confirmBtn = document.getElementById("btn-confirm-weight-wipe");
    const cancelBtn = document.getElementById("btn-cancel-weight-wipe");

    if (!modal) {
      if (confirm("WARNING: Are you absolutely sure you want to wipe your entire weight history? This will delete all manual and imported weight data permanently!")) {
        this.wipeAllWeights();
      }
      return;
    }

    modal.classList.remove("hidden");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newCancelBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    newConfirmBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      this.wipeAllWeights();
    });
  },

  wipeAllWeights() {
    AppState.data.weights = {};
    AppState.saveToStorage();
    
    // Refresh both pages
    this.render();
    if (window.WeightController && typeof window.WeightController.render === "function") {
      window.WeightController.render();
    }
    
    AppState.showToast("All weight records have been wiped.");
  },

  formatISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
};
