/**
 * ColinsChartsMacros - Charts & Analytics Manager
 * Manages Chart.js rendering and least-squares linear regression modeling.
 */

window.WeightChartManager = {
  chartInstance: null,

  /**
   * Main entry point to refresh or construct the weight chart.
   * @param {Object} allWeightLogs Key-value logs { "YYYY-MM-DD": WeightNumeric }
   * @param {string} selectedDateISO Target center date "YYYY-MM-DD"
   * @param {string} unit Current weight unit ("lbs" or "kg")
   */
  renderChart(allWeightLogs, selectedDateISO, unit) {
    const canvas = document.getElementById("weightHistoryChart");
    if (!canvas) return;

    // 1. Generate 7-day range ending at the selected date
    const targetDate = new Date(selectedDateISO + "T12:00:00");
    const datesInRange = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(targetDate);
      d.setDate(targetDate.getDate() - i);
      d.setHours(12, 0, 0, 0); // Guarantee DST/timezone shift immunity
      datesInRange.push(d);
    }

    // Format date string keys ("YYYY-MM-DD")
    const dateKeys = datesInRange.map(d => this.formatISODate(d));

    // Get display labels e.g. "May 14"
    const displayLabels = datesInRange.map(d => {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });

    // 2. Map weight values (null if not logged)
    const actualWeights = dateKeys.map(key => allWeightLogs[key] !== undefined ? allWeightLogs[key] : null);

    // 3. Calculate Stats: Average and Net Weekly Change
    const loggedWeights = actualWeights.filter(w => w !== null);
    this.updateStats(actualWeights, loggedWeights, unit);

    // 4. Compute Linear Regression coordinates
    const regressionDataset = this.computeRegressionDataset(datesInRange, dateKeys, allWeightLogs);

    // 5. Tear down old instance to prevent canvas rendering ghosting
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // 6. Draw Chart
    const ctx = canvas.getContext("2d");
    
    // Create a beautiful subtle gradient underneath the actual weight path
    const weightGradient = ctx.createLinearGradient(0, 0, 0, 200);
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
            pointRadius: 5,
            pointHoverRadius: 7,
            pointHitRadius: 25,
            backgroundColor: weightGradient,
            fill: true,
            tension: 0.15,
            spanGaps: true // Draw continuous lines even if days are skipped
          },
          {
            label: "Trendline",
            data: regressionDataset,
            borderColor: "#ffffff",
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0, // Dotted line only, no points
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
        plugins: {
          legend: {
            display: false // We use our custom styled HTML legend
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
              }
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
              stepSize: 0.5,
              callback: function(value) {
                return value.toFixed(1);
              }
            }
          }
        }
      }
    });
  },

  /**
   * Calculates linear regression line of best fit over the 7 days.
   * Uses standard least-squares regression y = mx + c
   */
  computeRegressionDataset(datesInRange, dateKeys, allWeightLogs) {
    const points = [];
    const firstDateMs = datesInRange[0].getTime();

    // Map each date to: x = elapsed fractional days, y = logged weight
    for (let i = 0; i < datesInRange.length; i++) {
      const key = dateKeys[i];
      const weight = allWeightLogs[key];
      if (weight !== undefined && weight !== null) {
        const elapsedDays = (datesInRange[i].getTime() - firstDateMs) / (1000 * 60 * 60 * 24);
        points.push({ x: elapsedDays, y: weight });
      }
    }

    // Need at least 2 points to draw a trendline
    if (points.length < 2) {
      return Array(datesInRange.length).fill(null);
    }

    const { slope, intercept } = AppUtils.calculateLinearRegression(points);

    // Evaluate trendline for every day in the range
    return datesInRange.map((date) => {
      const elapsedDays = (date.getTime() - firstDateMs) / (1000 * 60 * 60 * 24);
      const predictedWeight = slope * elapsedDays + intercept;
      return parseFloat(predictedWeight.toFixed(1));
    });
  },

  /**
   * Refreshes average weight and net change indicators on the dashboard card.
   */
  updateStats(actualWeights, loggedWeights, unit) {
    const avgDailyChangeEl = document.getElementById("val-weight-avg-daily-change");
    const changeEl = document.getElementById("val-weight-change");
    if (!avgDailyChangeEl || !changeEl) return;

    if (loggedWeights.length === 0) {
      avgDailyChangeEl.textContent = "--";
      avgDailyChangeEl.className = "neutral";
      changeEl.textContent = "--";
      changeEl.className = "neutral";
      return;
    }

    // Net Change (first logged point vs last logged point in this 7-day range)
    if (loggedWeights.length < 2) {
      avgDailyChangeEl.textContent = "--";
      avgDailyChangeEl.className = "neutral";
      changeEl.textContent = "Log more days";
      changeEl.className = "neutral";
    } else {
      // Find the indices of the first and last logged weights in actualWeights to get number of days
      let firstIdx = -1;
      let lastIdx = -1;
      for (let i = 0; i < actualWeights.length; i++) {
        if (actualWeights[i] !== null) {
          if (firstIdx === -1) firstIdx = i;
          lastIdx = i;
        }
      }
      const days = lastIdx - firstIdx;

      const net = loggedWeights[loggedWeights.length - 1] - loggedWeights[0];
      const sign = net > 0 ? "+" : "";
      changeEl.textContent = `${sign}${net.toFixed(1)} ${unit}`;
      
      if (net > 0) {
        changeEl.className = "gain"; // red-orange for gain
      } else if (net < 0) {
        changeEl.className = "loss"; // green for loss
      } else {
        changeEl.className = "neutral";
      }

      // Calculate Average Daily Change: total net change / number of days
      if (days > 0) {
        const avgDailyChange = net / days;
        const signChange = avgDailyChange > 0 ? "+" : "";
        avgDailyChangeEl.textContent = `${signChange}${avgDailyChange.toFixed(2)} ${unit}/day`;
        
        if (avgDailyChange > 0) {
          avgDailyChangeEl.className = "gain";
        } else if (avgDailyChange < 0) {
          avgDailyChangeEl.className = "loss";
        } else {
          avgDailyChangeEl.className = "neutral";
        }
      } else {
        avgDailyChangeEl.textContent = "--";
        avgDailyChangeEl.className = "neutral";
      }
    }
  },

  /**
   * Safely formats local date objects to 'YYYY-MM-DD' strings.
   */
  formatISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
};
