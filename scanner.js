/**
 * ColinsChartsMacros - Barcode Scanner Integration
 * Controls mobile camera scanner instances utilizing html5-qrcode.
 */

const BarcodeScannerManager = {
  html5QrcodeInstance: null,
  isScanning: false,

  /**
   * Initializes and starts camera scanning in #camera-scanner container.
   * @param {Function} onScanSuccessCallback Callback when a barcode is scanned. Receives barcode string.
   * @param {Function} onErrorCallback Optional error reporter for camera permissions.
   */
  async start(onScanSuccessCallback, onErrorCallback) {
    if (this.isScanning) return;
    
    const scannerEl = document.getElementById("camera-scanner");
    if (!scannerEl) return;
    
    scannerEl.classList.remove("hidden");
    
    try {
      this.html5QrcodeInstance = new Html5Qrcode("camera-scanner");
      
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
          console.log(`[Scanner] Barcode decoded: ${decodedText}`);
          this.stop(); // Stop camera upon successful reading
          onScanSuccessCallback(decodedText);
        },
        (errorMessage) => {
          // Failure to decode in a frame is normal, skip console flooding
        }
      );

      document.getElementById("btn-start-scan").classList.add("hidden");
      document.getElementById("btn-stop-scan").classList.remove("hidden");

    } catch (err) {
      console.error("[Scanner] Camera failed to start:", err);
      this.isScanning = false;
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
    if (!this.isScanning) return;

    try {
      if (this.html5QrcodeInstance) {
        await this.html5QrcodeInstance.stop();
        this.html5QrcodeInstance = null;
      }
    } catch (err) {
      console.warn("[Scanner] Clean stop failed:", err);
    } finally {
      this.isScanning = false;
      document.getElementById("camera-scanner").classList.add("hidden");
      document.getElementById("btn-start-scan").classList.remove("hidden");
      document.getElementById("btn-stop-scan").classList.add("hidden");
    }
  }
};
