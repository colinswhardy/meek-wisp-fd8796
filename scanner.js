/**
 * ColinsChartsMacros - Barcode Scanner Integration
 * Controls mobile camera scanner instances utilizing html5-qrcode.
 */

window.BarcodeScannerManager = {
  html5QrcodeInstance: null,
  isScanning: false,
  activeContext: null, // "dashboard", "food", or "recipe"
  transitioning: false,

  /**
   * Initializes and starts camera scanning in the container for the specified context.
   * @param {string} context "dashboard", "food", or "recipe"
   * @param {Function} onScanSuccessCallback Callback when a barcode is scanned. Receives barcode string.
   * @param {Function} onErrorCallback Optional error reporter for camera permissions.
   */
  async start(context, onScanSuccessCallback, onErrorCallback) {
    if (this.transitioning) {
      console.log("[Scanner] Busy transitioning, deferring start request...");
      return;
    }
    if (this.isScanning) {
      if (this.activeContext === context) return;
      await this.stop();
    }
    
    this.transitioning = true;
    this.activeContext = context;
    const scannerId = `camera-scanner-${context}`;
    const scannerEl = document.getElementById(scannerId);
    if (!scannerEl) {
      this.transitioning = false;
      return;
    }
    
    scannerEl.classList.remove("hidden");
    
    try {
      this.html5QrcodeInstance = new Html5Qrcode(scannerId);
      
      const config = {
        fps: 10,
        // Since product barcodes are wide 1D tags, a landscape scanner box is best
        qrbox: (width, height) => {
          const size = Math.min(width, height) * 0.75;
          return {
            width: size,
            height: size * 0.6
          };
        },
        aspectRatio: 1.0,
        videoConstraints: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      this.isScanning = true;

      // Start camera feed (defaults to rear camera via facingMode: environment)
      await this.html5QrcodeInstance.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          console.log(`[Scanner-${context}] Barcode decoded: ${decodedText}`);
          this.stop(); // Stop camera upon successful reading
          onScanSuccessCallback(decodedText);
        },
        (errorMessage) => {
          // Failure to decode in a frame is normal, skip console flooding
        }
      );

      document.getElementById(`btn-start-scan-${context}`).classList.add("hidden");
      document.getElementById(`btn-stop-scan-${context}`).classList.remove("hidden");

    } catch (err) {
      console.error(`[Scanner-${context}] Camera failed to start:`, err);
      this.isScanning = false;
      this.activeContext = null;
      scannerEl.classList.add("hidden");
      
      // Clean DOM nodes on error to prevent leaks
      try {
        scannerEl.innerHTML = "";
      } catch (domErr) {}

      if (onErrorCallback) {
        onErrorCallback(err);
      } else {
        alert("Camera access denied or unavailable. Please enter the barcode manually.");
      }
    } finally {
      this.transitioning = false;
    }
  },

  /**
   * Stops camera stream and clears scanner state.
   */
  async stop() {
    // If starting up, wait until transitioning is complete to prevent raw camera driver hangs
    let checkCount = 0;
    while (this.transitioning && checkCount < 30) {
      console.log("[Scanner] Waiting for camera start transition to finish before stopping...");
      await new Promise(resolve => setTimeout(resolve, 100));
      checkCount++;
    }

    if (!this.isScanning || !this.activeContext) return;
    
    this.transitioning = true;
    const context = this.activeContext;

    try {
      if (this.html5QrcodeInstance) {
        await this.html5QrcodeInstance.stop();
      }
    } catch (err) {
      console.warn(`[Scanner-${context}] Clean stop failed:`, err);
    } finally {
      this.html5QrcodeInstance = null;
      this.isScanning = false;
      this.activeContext = null;
      
      const scannerEl = document.getElementById(`camera-scanner-${context}`);
      if (scannerEl) {
        scannerEl.classList.add("hidden");
        // Systematically prune dynamically spawned canvas/video elements to avoid memory leaks
        try {
          scannerEl.innerHTML = "";
        } catch (domErr) {
          console.warn("[Scanner] DOM pruning failed:", domErr);
        }
      }
      
      const startBtn = document.getElementById(`btn-start-scan-${context}`);
      if (startBtn) startBtn.classList.remove("hidden");
      
      const stopBtn = document.getElementById(`btn-stop-scan-${context}`);
      if (stopBtn) stopBtn.classList.add("hidden");
      
      this.transitioning = false;
    }
  }
};
