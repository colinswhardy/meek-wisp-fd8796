/**
 * ColinsChartsMacros - Barcode Scanner Integration
 * Controls mobile camera scanner instances utilizing html5-qrcode.
 */

const BarcodeScannerManager = {
  html5QrcodeInstance: null,
  isScanning: false,
  activeContext: null, // "dashboard" or "food"

  /**
   * Initializes and starts camera scanning in the container for the specified context.
   * @param {string} context "dashboard" or "food"
   * @param {Function} onScanSuccessCallback Callback when a barcode is scanned. Receives barcode string.
   * @param {Function} onErrorCallback Optional error reporter for camera permissions.
   */
  async start(context, onScanSuccessCallback, onErrorCallback) {
    if (this.isScanning) {
      if (this.activeContext === context) return;
      await this.stop();
    }
    
    this.activeContext = context;
    const scannerId = `camera-scanner-${context}`;
    const scannerEl = document.getElementById(scannerId);
    if (!scannerEl) return;
    
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
        aspectRatio: 1.0
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
      if (onErrorCallback) {
        onErrorCallback(err);
      } else {
        alert("Camera access denied or unavailable. Please enter the barcode manually.");
      }
    }
  },

  /**
   * Stops camera stream and clears scanner state.
   */
  async stop() {
    if (!this.isScanning || !this.activeContext) return;
    
    const context = this.activeContext;

    try {
      if (this.html5QrcodeInstance) {
        await this.html5QrcodeInstance.stop();
        this.html5QrcodeInstance = null;
      }
    } catch (err) {
      console.warn(`[Scanner-${context}] Clean stop failed:`, err);
    } finally {
      this.isScanning = false;
      this.activeContext = null;
      
      const scannerEl = document.getElementById(`camera-scanner-${context}`);
      if (scannerEl) scannerEl.classList.add("hidden");
      
      const startBtn = document.getElementById(`btn-start-scan-${context}`);
      if (startBtn) startBtn.classList.remove("hidden");
      
      const stopBtn = document.getElementById(`btn-stop-scan-${context}`);
      if (stopBtn) stopBtn.classList.add("hidden");
    }
  }
};

