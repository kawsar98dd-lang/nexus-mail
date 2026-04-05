/**
 * =============================================================================
 * Smart DocuScan ULTRA MAX — Core Scanner Logic
 * =============================================================================
 * File    : assets/tools/img/img-document-scanner/script.js
 * Project : TrustedToolsWeb (CodeCanyon)
 * Author  : MD KAWSAR
 * Version : 2.0 — Refactored (global toast system, professional comments)
 *
 * ── ARCHITECTURE OVERVIEW ────────────────────────────────────────────────────
 *
 *  This file is structured as a single IIFE (Immediately Invoked Function
 *  Expression) to avoid polluting the global namespace. All modules are
 *  clearly separated named object literals for maintainability:
 *
 *   1.  STATE          — Central application state object (single source of truth)
 *   2.  CONFIG         — Constants and immutable configuration values
 *   3.  DOM            — Cached DOM element references (query once, use everywhere)
 *   4.  OPENCV_MANAGER — OpenCV.js WASM lifecycle: polling, ready, error callbacks
 *   5.  CAMERA_MANAGER — WebRTC getUserMedia, stream control, camera switch, torch
 *   6.  CAPTURE_ENGINE — Video frame capture and file upload → crop editor pipeline
 *   7.  CROP_ENGINE    — 4-point draggable corner handles, handle positioning, SVG quad
 *   8.  OPENCV_ENGINE  — Canny edge detection, contour find, warpPerspective, fallback
 *   9.  FILTER_ENGINE  — Canvas API image filters: Magic Color, Grayscale, B&W, Original
 *  10.  PAGES_MANAGER  — Multi-page document state, thumbnail rendering, delete/clear
 *  11.  OCR_ENGINE     — Tesseract.js worker recognition with progress callback
 *  12.  PDF_ENGINE     — jsPDF multi-page PDF assembly and download
 *  13.  UI_MANAGER     — Centralized button enable/disable, filter highlight, page count
 *  14.  EVENT_BINDER   — All addEventListener calls (mouse + touch), centralized wiring
 *  15.  INIT           — Bootstrap: wires everything up on DOMContentLoaded
 *
 * ── TOAST SYSTEM ─────────────────────────────────────────────────────────────
 *  All notifications use the global toast system from global.js:
 *    window.showToast("message")           → informational (default)
 *    window.showToast("message", true)     → error (red)
 *  The internal `toast()` helper wraps this with a console fallback.
 *
 * ── PRIVACY NOTE ─────────────────────────────────────────────────────────────
 *  Zero network requests are made during scanning, OCR, or PDF export.
 *  Only the initial page load fetches OpenCV.js from CDN.
 *  All processing happens 100% in the user's browser via WebAssembly.
 * =============================================================================
 */

(function () {
    'use strict';

    /* =========================================================================
     * 1. STATE — Central Application State
     * ─────────────────────────────────────
     * All mutable application state lives in this single object.
     * Using a centralized state object prevents scattered globals and makes
     * debugging straightforward — inspect `state` in the console at any time.
     * ========================================================================= */
    const state = {

        // ── Camera ────────────────────────────────────────────────────────────
        cameraStream  : null,           // Active MediaStream from getUserMedia
        facingMode    : 'environment',  // 'environment' (rear) or 'user' (front)
        torchEnabled  : false,          // Flashlight/torch toggle state
        cameraActive  : false,          // Whether a live camera feed is running

        // ── Capture ───────────────────────────────────────────────────────────
        capturedImageData : null,       // Raw ImageData from the captured video frame
        capturedCanvas    : null,       // Off-screen canvas holding the captured image

        // ── Crop Handle Coordinates (in DISPLAY canvas pixel space) ──────────
        cropHandles : {
            tl : { x: 0, y: 0 },       // Top-Left corner handle position
            tr : { x: 0, y: 0 },       // Top-Right corner handle position
            bl : { x: 0, y: 0 },       // Bottom-Left corner handle position
            br : { x: 0, y: 0 },       // Bottom-Right corner handle position
        },
        draggingHandle : null,          // Key of the handle currently being dragged
        _dragOffset    : null,          // Mouse offset from handle center at drag start

        // ── Processing ────────────────────────────────────────────────────────
        processedCanvas : null,         // Canvas output after perspective warp + filter
        activeFilter    : 'magic',      // Currently selected filter name
        rotationAngle   : 0,            // Cumulative rotation (0 | 90 | 180 | 270 degrees)

        // ── Pages ─────────────────────────────────────────────────────────────
        pages : [],                     // Array of { dataUrl, width, height } objects

        // ── OCR ───────────────────────────────────────────────────────────────
        tesseractWorker : null,         // Tesseract.js worker instance (lazy-initialized)
        ocrRunning      : false,        // Guard flag — prevents concurrent OCR runs

        // ── OpenCV ────────────────────────────────────────────────────────────
        opencvReady     : false,        // True once the OpenCV WASM runtime is ready

        // ── PDF Quality ───────────────────────────────────────────────────────
        pdfQuality : 0.85,             // JPEG quality for PDF image encoding (0.0–1.0)
    };


    /* =========================================================================
     * 2. CONFIG — Constants and Configuration Values
     * ──────────────────────────────────────────────
     * All magic numbers and configurable values live here.
     * Modify these to tune behaviour without hunting through the code.
     * ========================================================================= */
    const CONFIG = {

        // Maximum display canvas dimensions (aspect ratio is always preserved)
        MAX_CANVAS_DISPLAY_WIDTH  : 700,
        MAX_CANVAS_DISPLAY_HEIGHT : 500,

        // Minimum contour area as a fraction of total image area for edge detection.
        // Contours smaller than this are ignored (prevents detecting noise/wrinkles).
        MIN_CONTOUR_AREA_FRACTION : 0.05,

        // Pixel radius around a crop handle that registers as a "hit" for dragging.
        HANDLE_HIT_RADIUS : 25,

        // Path to the Tesseract.js worker files — adjust if self-hosting locally.
        // Base path for offline Tesseract dependencies
 TESSERACT_BASE_PATH: '../../assets/library/media-vision/tesseract/',
 };

    /* =========================================================================
     * 3. DOM — Cached Element References
     * ────────────────────────────────────
     * All DOM lookups are performed once at script load time and stored here.
     * This avoids expensive repeated querySelector/getElementById calls during
     * animation frames and event handlers.
     * ========================================================================= */
    const DOM = {

        // ── Camera Panel ─────────────────────────────────────────────────────
        cameraFeed          : document.getElementById('cameraFeed'),
        overlayCanvas       : document.getElementById('overlayCanvas'),
        viewportContainer   : document.getElementById('viewportContainer'),
        cameraFallback      : document.getElementById('cameraFallback'),
        fallbackFileInput   : document.getElementById('fallbackFileInput'),
        btnStartCamera      : document.getElementById('btnStartCamera'),
        btnCapture          : document.getElementById('btnCapture'),
        btnSwitchCamera     : document.getElementById('btnSwitchCamera'),
        btnTorch            : document.getElementById('btnTorch'),
        imageFileInput      : document.getElementById('imageFileInput'),
        opencvStatus        : document.getElementById('opencvStatus'),
        opencvDot           : document.getElementById('opencvDot'),
        opencvStatusText    : document.getElementById('opencvStatusText'),

        // ── Editor Panel ─────────────────────────────────────────────────────
        cropCanvas          : document.getElementById('cropCanvas'),
        cropCanvasContainer : document.getElementById('cropCanvasContainer'),
        cropEmptyState      : document.getElementById('cropEmptyState'),
        handleTL            : document.getElementById('handle-tl'),
        handleTR            : document.getElementById('handle-tr'),
        handleBL            : document.getElementById('handle-bl'),
        handleBR            : document.getElementById('handle-br'),
        cropQuadPoly        : document.getElementById('cropQuadPoly'),
        btnResetCrop        : document.getElementById('btnResetCrop'),
        btnRotate           : document.getElementById('btnRotate'),
        filterToolbar       : document.getElementById('filterToolbar'),
        filterBtns          : document.querySelectorAll('.dsc-filter-btn'),
        btnApplyCrop        : document.getElementById('btnApplyCrop'),

        // ── Output Panel ─────────────────────────────────────────────────────
        pagesStrip          : document.getElementById('pagesStrip'),
        pagesEmptyState     : document.getElementById('pagesEmptyState'),
        pageCounter         : document.getElementById('pageCounter'),
        btnAddPage          : document.getElementById('btnAddPage'),
        ocrLanguage         : document.getElementById('ocrLanguage'),
        btnRunOcr           : document.getElementById('btnRunOcr'),
        ocrProgressWrap     : document.getElementById('ocrProgressWrap'),
        ocrProgressBar      : document.getElementById('ocrProgressBar'),
        ocrProgressLabel    : document.getElementById('ocrProgressLabel'),
        ocrOutput           : document.getElementById('ocrOutput'),
        btnCopyOcr          : document.getElementById('btnCopyOcr'),
        btnClearOcr         : document.getElementById('btnClearOcr'),
        pdfPageSize         : document.getElementById('pdfPageSize'),
        pdfOrientation      : document.getElementById('pdfOrientation'),
        pdfQuality          : document.getElementById('pdfQuality'),
        pdfQualityVal       : document.getElementById('pdfQualityVal'),
        btnExportPdf        : document.getElementById('btnExportPdf'),
        btnClearPages       : document.getElementById('btnClearPages'),
    };


    /* =========================================================================
     * 4. OPENCV_MANAGER
     * ──────────────────
     * Monitors the loading state of OpenCV.js, which is loaded asynchronously
     * via the <script async> tag in the HTML. OpenCV 4.8's CDN build uses the
     * Module.onRuntimeInitialized callback pattern (WASM async load).
     *
     * Strategy:
     *  - Poll `typeof cv` every 200ms until the global `cv` object appears.
     *  - If `cv.getBuildInformation` exists, OpenCV is synchronously ready.
     *  - Otherwise, hook `cv.onRuntimeInitialized` to detect async WASM init.
     *  - Timeout after 30 seconds and show a warning toast if it never loads.
     * ========================================================================= */
    const OPENCV_MANAGER = {

        /**
         * Initialize the OpenCV ready-detection mechanism.
         * Begins polling and sets up the 30-second load timeout.
         */
        init() {
            // Poll every 200ms for the `cv` global to become available
            const pollInterval = setInterval(() => {
                if (typeof cv !== 'undefined') {
                    clearInterval(pollInterval);

                    if (cv.getBuildInformation) {
                        // Synchronous build — OpenCV is already fully initialized
                        OPENCV_MANAGER.onReady();
                    } else {
                        // Asynchronous WASM build — wait for the runtime to complete
                        cv['onRuntimeInitialized'] = () => {
                            OPENCV_MANAGER.onReady();
                        };
                    }
                }
            }, 200);

            // Safety timeout: if OpenCV hasn't loaded within 30 seconds, warn the user
            setTimeout(() => {
                if (!state.opencvReady) {
                    OPENCV_MANAGER.onError();
                }
            }, 30000);
        },

        /**
         * Called when OpenCV.js WASM runtime is fully initialized and ready.
         * Updates the status indicator dot to "ready" state.
         */
        onReady() {
            state.opencvReady                    = true;
            DOM.opencvDot.className              = 'dsc-status-dot ready';
            DOM.opencvStatusText.textContent     = 'OpenCV.js Ready — Smart Edge Detection Active';
            console.log('[DocuScan] OpenCV.js initialized successfully.');
        },

        /**
         * Called if OpenCV.js fails to load within the 30-second timeout.
         * Switches the indicator to error state and informs the user via toast.
         * Manual crop handles still work without OpenCV.
         */
        onError() {
            DOM.opencvDot.className              = 'dsc-status-dot error';
            DOM.opencvStatusText.textContent     = 'OpenCV.js failed to load — manual crop only';
            window.showToast('OpenCV.js failed to load. Smart edge detection unavailable. Manual crop still works.');
            console.warn('[DocuScan] OpenCV.js load failed. Manual crop mode active.');
        },
    };


    /* =========================================================================
     * 5. CAMERA_MANAGER
     * ──────────────────
     * Handles all WebRTC camera operations using the MediaDevices API:
     *  - Start and stop the camera stream (getUserMedia)
     *  - Switch between front (user) and rear (environment) cameras
     *  - Toggle the device flashlight/torch via MediaTrackConstraints
     *  - Resize the edge-detection overlay canvas to match the video element
     *  - Handle permission denial and hardware errors with informative toasts
     * ========================================================================= */
    const CAMERA_MANAGER = {

        /**
         * Request camera access and start the live video feed.
         * Uses ideal 1080p resolution constraints; falls back to default on error.
         * Stops any existing stream before starting a new one to prevent conflicts.
         */
        async startCamera() {
            // Stop any existing camera stream to release the hardware lock
            CAMERA_MANAGER.stopCamera();

            const constraints = {
                video : {
                    facingMode : state.facingMode,
                    width      : { ideal: 1920 },
                    height     : { ideal: 1080 },
                },
                audio : false,
            };

            try {
                // Request camera permission and get the media stream
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                state.cameraStream  = stream;
                DOM.cameraFeed.srcObject = stream;
                await DOM.cameraFeed.play();
                state.cameraActive  = true;

                // Update the Start Camera button to become a Stop Camera button
                DOM.btnStartCamera.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Camera';
                DOM.btnStartCamera.classList.add('dsc-cam-danger');
                DOM.btnStartCamera.classList.remove('dsc-cam-primary');
                DOM.btnCapture.disabled  = false;
                DOM.cameraFallback.classList.add('hidden');

                window.showToast('Camera started successfully.');
                console.log('[DocuScan] Camera stream started. Facing:', state.facingMode);

                // Resize the edge-detection overlay canvas once video metadata is available
                DOM.cameraFeed.addEventListener('loadedmetadata', () => {
                    CAMERA_MANAGER.resizeOverlay();
                }, { once: true });

            } catch (err) {
                console.error('[DocuScan] Camera access error:', err);
                CAMERA_MANAGER.handleCameraError(err);
            }
        },

        /**
         * Stop the active camera stream, release all media tracks, and reset the UI.
         * This frees the hardware camera resource and reverts button state.
         */
        stopCamera() {
            if (state.cameraStream) {
                state.cameraStream.getTracks().forEach(track => track.stop());
                state.cameraStream = null;
            }

            DOM.cameraFeed.srcObject    = null;
            state.cameraActive          = false;
            state.torchEnabled          = false;
            DOM.btnCapture.disabled     = true;
            DOM.btnStartCamera.innerHTML = '<i class="fa-solid fa-play"></i> Start Camera';
            DOM.btnStartCamera.classList.remove('dsc-cam-danger');
            DOM.btnStartCamera.classList.add('dsc-cam-primary');
        },

        /**
         * Toggle between the front (user-facing) and rear (environment-facing) cameras.
         * Only takes effect if the camera is currently active — triggers a camera restart.
         */
        async switchCamera() {
            state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';

            if (state.cameraActive) {
                await CAMERA_MANAGER.startCamera();
                window.showToast(
                    `Switched to ${state.facingMode === 'environment' ? 'rear' : 'front'} camera.`
                );
            }
        },

        /**
         * Toggle the device flashlight/torch.
         * Uses MediaTrackCapabilities to verify torch support before attempting.
         * Only works on mobile devices with a rear camera that supports torch mode.
         */
        async toggleTorch() {
            if (!state.cameraStream) return;

            const track        = state.cameraStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};

            // Check if the current camera track supports torch control
            if (!capabilities.torch) {
                window.showToast('Torch not supported on this camera/device.');
                return;
            }

            try {
                state.torchEnabled = !state.torchEnabled;
                await track.applyConstraints({ advanced: [{ torch: state.torchEnabled }] });

                // Visual feedback: yellow icon when torch is ON
                DOM.btnTorch.style.color = state.torchEnabled ? '#f59e0b' : '';
                window.showToast(state.torchEnabled ? 'Flashlight ON' : 'Flashlight OFF');
            } catch (e) {
                window.showToast('Could not control torch.');
            }
        },

        /**
         * Resize the edge-detection overlay canvas to exactly match the video element's
         * rendered (CSS pixel) dimensions. Called after video metadata loads and on window resize.
         */
        resizeOverlay() {
            const r = DOM.cameraFeed.getBoundingClientRect();
            DOM.overlayCanvas.width  = r.width;
            DOM.overlayCanvas.height = r.height;
        },

        /**
         * Graceful error handler for camera access failures.
         * Maps common DOMException names to user-friendly messages.
         * Shows the fallback upload UI as an alternative.
         * @param {DOMException} err — The error thrown by getUserMedia
         */
        handleCameraError(err) {
            let message = 'Camera access denied.';

            if (err.name === 'NotFoundError') {
                message = 'No camera found on this device.';
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                message = 'Camera permission denied. Please allow camera access in your browser settings.';
            } else if (err.name === 'NotReadableError') {
                message = 'Camera is in use by another application.';
            } else if (err.name === 'OverconstrainedError') {
                message = 'Camera does not support the required resolution. Trying fallback…';
                // Retry with minimal constraints rather than failing completely
                CAMERA_MANAGER.startCameraFallback();
                return;
            }

            // Error toast — second argument `true` marks this as an error (red style)
            window.showToast(message, true);
            DOM.cameraFallback.classList.remove('hidden');
        },

        /**
         * Fallback camera start with minimal constraints.
         * Used when the preferred resolution is not supported by the device.
         * Retries with just `{ video: true }` — the browser picks defaults.
         */
        async startCameraFallback() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                state.cameraStream       = stream;
                DOM.cameraFeed.srcObject = stream;
                await DOM.cameraFeed.play();
                state.cameraActive       = true;
                DOM.btnCapture.disabled  = false;
                DOM.cameraFallback.classList.add('hidden');
                window.showToast('Camera started with default settings.');
            } catch (e) {
                // If even the fallback fails, show the file upload UI
                DOM.cameraFallback.classList.remove('hidden');
            }
        },
    };


    /* =========================================================================
     * 6. CAPTURE_ENGINE
     * ──────────────────
     * Handles the two ways to get an image into the crop editor:
     *  (a) Capture a frame from the live WebRTC video feed
     *  (b) Load a user-selected image file via FileReader
     *
     * In both cases the image is drawn to an off-screen canvas at full native
     * resolution, stored in `state.capturedCanvas`, then passed to
     * `loadImageIntoEditor()` which scales it to fit the display and triggers
     * auto edge detection if OpenCV is ready.
     * ========================================================================= */
    const CAPTURE_ENGINE = {

        /**
         * Capture the current video frame to an off-screen canvas.
         * Stores the full-resolution frame in `state.capturedCanvas`.
         * Resets rotation state since this is a fresh capture.
         */
        captureFrame() {
            if (!state.cameraActive || !DOM.cameraFeed.videoWidth) {
                window.showToast('Camera not active. Please start the camera first.');
                return;
            }

            const vw = DOM.cameraFeed.videoWidth;
            const vh = DOM.cameraFeed.videoHeight;

            // Create an off-screen canvas at the camera's full native resolution
            const offCanvas    = document.createElement('canvas');
            offCanvas.width    = vw;
            offCanvas.height   = vh;
            const offCtx       = offCanvas.getContext('2d');

            // Draw the current video frame onto the off-screen canvas
            offCtx.drawImage(DOM.cameraFeed, 0, 0, vw, vh);
            state.capturedCanvas = offCanvas;
            state.rotationAngle  = 0;   // Reset rotation for new capture

            CAPTURE_ENGINE.loadImageIntoEditor(offCanvas);
            window.showToast('Image captured! Adjust crop handles if needed.');
        },

        /**
         * Scale and display a source canvas in the crop editor.
         * Computes a display scale that fits within the container while preserving
         * the original aspect ratio. Triggers auto edge detection after display.
         *
         * @param {HTMLCanvasElement} srcCanvas — Full-resolution source image canvas
         */
        loadImageIntoEditor(srcCanvas) {
            const displayCanvas = DOM.cropCanvas;
            const container     = DOM.cropCanvasContainer;
            const containerW    = container.clientWidth  || 400;
            const containerH    = container.clientHeight || 350;

            // Calculate the largest scale that fits within the container boundaries
            const scaleW = Math.min(containerW / srcCanvas.width,  1);
            const scaleH = Math.min(containerH / srcCanvas.height, 1);
            const scale  = Math.min(scaleW, scaleH, 1);

            // Set display canvas to the scaled dimensions
            displayCanvas.width  = Math.round(srcCanvas.width  * scale);
            displayCanvas.height = Math.round(srcCanvas.height * scale);

            // Draw the source image scaled down to display size
            const ctx = displayCanvas.getContext('2d');
            ctx.drawImage(srcCanvas, 0, 0, displayCanvas.width, displayCanvas.height);

            // Show the canvas and hide the empty state placeholder
            DOM.cropEmptyState.classList.add('hidden');
            CROP_ENGINE.showHandles();

            // Attempt auto document edge detection if OpenCV is ready
            if (state.opencvReady) {
                OPENCV_ENGINE.detectDocumentEdges(displayCanvas);
            } else {
                CROP_ENGINE.setDefaultCorners(displayCanvas.width, displayCanvas.height);
                window.showToast('OpenCV not ready — using full-image crop. Smart edge detection will activate when ready.');
            }

            // Enable all editor action buttons now that an image is loaded
            UI_MANAGER.setEditorEnabled(true);
        },

        /**
         * Handle a File object selected via <input type="file"> or drag-and-drop.
         * Uses FileReader to convert the file to a data URL, creates an Image
         * element to get the natural dimensions, then draws to an off-screen canvas.
         *
         * @param {File} file — The selected image file
         */
        loadFileAsImage(file) {
            if (!file || !file.type.startsWith('image/')) {
                window.showToast('Please select a valid image file (JPG, PNG, WEBP, etc.)', true);
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const img    = new Image();

                img.onload = () => {
                    // Draw the loaded image at full native resolution on an off-screen canvas
                    const offCanvas    = document.createElement('canvas');
                    offCanvas.width    = img.naturalWidth;
                    offCanvas.height   = img.naturalHeight;
                    const offCtx       = offCanvas.getContext('2d');
                    offCtx.drawImage(img, 0, 0);

                    state.capturedCanvas = offCanvas;
                    state.rotationAngle  = 0;

                    CAPTURE_ENGINE.loadImageIntoEditor(offCanvas);
                    window.showToast('Image loaded successfully!');
                };

                img.onerror = () => window.showToast('Failed to load image.', true);
                img.src     = e.target.result;
            };

            reader.readAsDataURL(file);
        },
    };


    /* =========================================================================
     * 7. CROP_ENGINE
     * ───────────────
     * Manages the four draggable corner handles that define the perspective
     * crop quadrilateral. Handles are <div> elements positioned absolutely over
     * the crop canvas via inline left/top styles.
     *
     * Supports both mouse events (desktop) and touch events (mobile).
     *
     * Handle coordinate system:
     *  - All coordinates are in DISPLAY canvas pixel space (not screen/viewport).
     *  - The canvas may be centered inside its container, so an offset is computed
     *    each time handle positions are updated to account for this.
     * ========================================================================= */
    const CROP_ENGINE = {

        /** The four corner handle DOM elements, keyed by handle name */
        handleElements : {
            tl : DOM.handleTL,
            tr : DOM.handleTR,
            bl : DOM.handleBL,
            br : DOM.handleBR,
        },

        /** Make all four corner handles visible */
        showHandles() {
            Object.values(CROP_ENGINE.handleElements).forEach(el => {
                el.style.display = 'block';
            });
        },

        /** Hide all four corner handles (after crop is applied — result is flat) */
        hideHandles() {
            Object.values(CROP_ENGINE.handleElements).forEach(el => {
                el.style.display = 'none';
            });
        },

        /**
         * Place the four handles at a default position slightly inside the canvas corners.
         * The inset fraction is defined by CONFIG.DEFAULT_CROP_PADDING (default 5%).
         *
         * @param {number} w — Display canvas width in pixels
         * @param {number} h — Display canvas height in pixels
         */
        setDefaultCorners(w, h) {
            const pad = CONFIG.DEFAULT_CROP_PADDING;

            state.cropHandles = {
                tl : { x : w * pad,       y : h * pad       },
                tr : { x : w * (1 - pad), y : h * pad       },
                bl : { x : w * pad,       y : h * (1 - pad) },
                br : { x : w * (1 - pad), y : h * (1 - pad) },
            };

            CROP_ENGINE.updateHandlePositions();
        },

        /**
         * Set handle positions from OpenCV-detected document corners.
         * @param {{ tl, tr, bl, br }} corners — Each is {x, y} in display canvas space
         */
        setDetectedCorners(corners) {
            state.cropHandles = { ...corners };
            CROP_ENGINE.updateHandlePositions();
        },

        /**
         * Synchronize the CSS left/top positions of the four handle DOM elements
         * to match the current `state.cropHandles` coordinate values.
         *
         * The canvas may be centered within its container, so we compute the
         * canvas-to-container offset before applying the positions.
         */
        updateHandlePositions() {
            const container     = DOM.cropCanvasContainer;
            const canvas        = DOM.cropCanvas;
            const canvasRect    = canvas.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Pixel offset of the canvas top-left corner relative to the container
            const offsetX = canvasRect.left - containerRect.left;
            const offsetY = canvasRect.top  - containerRect.top;

            Object.entries(state.cropHandles).forEach(([key, pt]) => {
                const el          = CROP_ENGINE.handleElements[key];
                el.style.left     = (offsetX + pt.x) + 'px';
                el.style.top      = (offsetY + pt.y) + 'px';
            });

            // Keep the connecting SVG quadrilateral in sync
            CROP_ENGINE.updateQuadOverlay();
        },

        /**
         * Redraw the SVG <polygon> that visually connects the four handles.
         * The polygon points string is computed from the current handle positions,
         * offset to account for the canvas position within its container.
         */
        updateQuadOverlay() {
            const canvas        = DOM.cropCanvas;
            const container     = DOM.cropCanvasContainer;
            const canvasRect    = canvas.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const ox = canvasRect.left - containerRect.left;
            const oy = canvasRect.top  - containerRect.top;

            // Build the polygon points string: TL → TR → BR → BL (clockwise winding)
            const pts = [
                state.cropHandles.tl,
                state.cropHandles.tr,
                state.cropHandles.br,
                state.cropHandles.bl,
            ];

            const pointsStr = pts.map(p => `${ox + p.x},${oy + p.y}`).join(' ');
            DOM.cropQuadPoly.setAttribute('points', pointsStr);
        },

        /**
         * Begin a handle drag operation.
         * Records the starting drag offset so the handle follows the cursor precisely.
         *
         * @param {string} handleKey — Which handle: 'tl', 'tr', 'bl', or 'br'
         * @param {number} clientX   — Mouse/touch X position in viewport coordinates
         * @param {number} clientY   — Mouse/touch Y position in viewport coordinates
         */
        startDrag(handleKey, clientX, clientY) {
            state.draggingHandle = handleKey;
            CROP_ENGINE.handleElements[handleKey].classList.add('dragging');

            // Store the offset between the cursor and the handle's current position
            state._dragOffset = {
                x : clientX - state.cropHandles[handleKey].x,
                y : clientY - state.cropHandles[handleKey].y,
            };
        },

        /**
         * Update a handle position during an active drag operation.
         * Clamps the position to the canvas boundaries to prevent handles going off-canvas.
         *
         * @param {number} clientX — Current mouse/touch X position
         * @param {number} clientY — Current mouse/touch Y position
         */
        doDrag(clientX, clientY) {
            if (!state.draggingHandle) return;

            const canvas     = DOM.cropCanvas;
            const canvasRect = canvas.getBoundingClientRect();

            // Compute position relative to the canvas top-left corner
            const rawX = clientX - canvasRect.left;
            const rawY = clientY - canvasRect.top;

            // Clamp to canvas bounds so handles cannot exceed the image area
            const x = Math.max(0, Math.min(canvas.width,  rawX));
            const y = Math.max(0, Math.min(canvas.height, rawY));

            state.cropHandles[state.draggingHandle] = { x, y };
            CROP_ENGINE.updateHandlePositions();
        },

        /**
         * End the current drag operation and clean up state.
         * Removes the "dragging" visual class from the handle element.
         */
        endDrag() {
            if (state.draggingHandle) {
                CROP_ENGINE.handleElements[state.draggingHandle].classList.remove('dragging');
            }
            state.draggingHandle = null;
            state._dragOffset    = null;
        },

        /**
         * Reset all four crop handles to the default corner positions.
         * Useful when the user wants to start over or OpenCV placed corners incorrectly.
         */
        resetToFullImage() {
            if (!DOM.cropCanvas.width) return;
            CROP_ENGINE.setDefaultCorners(DOM.cropCanvas.width, DOM.cropCanvas.height);
            window.showToast('Crop reset to full image.');
        },
    };


    /* =========================================================================
     * 8. OPENCV_ENGINE
     * ─────────────────
     * Uses the OpenCV.js (cv namespace) WebAssembly library for two tasks:
     *
     * (a) EDGE DETECTION — detectDocumentEdges():
     *     1. Convert image to grayscale
     *     2. Gaussian blur to reduce noise
     *     3. Canny edge detection
     *     4. Dilate edges to close small gaps
     *     5. Find contours (RETR_LIST / CHAIN_APPROX_SIMPLE)
     *     6. Find the largest 4-sided polygon (the document boundary)
     *     7. Order the 4 corners (TL, TR, BR, BL) and set crop handles
     *
     * (b) PERSPECTIVE WARP — applyPerspectiveWarp():
     *     1. Map the 4 handle points to a perfect rectangle via getPerspectiveTransform
     *     2. Apply warpPerspective to produce a flat, deskewed document view
     *     3. Return the result as a new canvas element
     *
     * Both methods properly delete all OpenCV Mat objects to prevent WASM memory leaks.
     * ========================================================================= */
    const OPENCV_ENGINE = {

        /**
         * Run Canny edge detection + contour analysis to automatically locate
         * the four corners of the document in the image.
         * Updates the crop handles if a valid document boundary is detected.
         *
         * @param {HTMLCanvasElement} displayCanvas — The display-resolution crop canvas
         */
        detectDocumentEdges(displayCanvas) {
            // If OpenCV isn't ready, fall back to default corner placement
            if (!state.opencvReady || typeof cv === 'undefined') {
                CROP_ENGINE.setDefaultCorners(displayCanvas.width, displayCanvas.height);
                return;
            }

            try {
                // ── Step 1: Read canvas into an OpenCV RGBA Mat ──────────────
                const src = cv.imread(displayCanvas);

                // ── Step 2: Convert RGBA → Grayscale for edge detection ──────
                const gray  = new cv.Mat();
                cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

                // ── Step 3: Gaussian blur to reduce noise ────────────────────
                // Kernel size 5×5 provides good noise reduction without losing edges
                const blurred = new cv.Mat();
                const ksize   = new cv.Size(5, 5);
                cv.GaussianBlur(gray, blurred, ksize, 0);

                // ── Step 4: Canny edge detection ─────────────────────────────
                // Thresholds 75/200 are tuned for typical document photography
                const edges = new cv.Mat();
                cv.Canny(blurred, edges, 75, 200);

                // ── Step 5: Dilate edges to close small gaps ─────────────────
                // A 3×3 kernel fills breaks in document border lines
                const dilated = new cv.Mat();
                const kernel  = cv.Mat.ones(3, 3, cv.CV_8U);
                cv.dilate(edges, dilated, kernel);

                // ── Step 6: Find all contours ────────────────────────────────
                const contours  = new cv.MatVector();
                const hierarchy = new cv.Mat();
                cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

                // ── Step 7: Find the largest quadrilateral contour ───────────
                const imageArea = displayCanvas.width * displayCanvas.height;
                const minArea   = imageArea * CONFIG.MIN_CONTOUR_AREA_FRACTION;
                let bestContour = null;
                let bestArea    = 0;

                for (let i = 0; i < contours.size(); i++) {
                    const contour   = contours.get(i);
                    const area      = cv.contourArea(contour);
                    const perimeter = cv.arcLength(contour, true);
                    const approx    = new cv.Mat();

                    // approxPolyDP simplifies the contour to 4 vertices (document shape)
                    cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

                    // We only want quadrilaterals (4 vertices) above the minimum area
                    if (approx.rows === 4 && area > minArea && area > bestArea) {
                        bestArea    = area;
                        bestContour = approx;
                    } else {
                        approx.delete();
                    }
                    contour.delete();
                }

                if (bestContour) {
                    // Extract the raw {x, y} coordinates of the 4 detected corners
                    const rawPoints = [];
                    for (let i = 0; i < 4; i++) {
                        rawPoints.push({
                            x : bestContour.data32S[i * 2],
                            y : bestContour.data32S[i * 2 + 1],
                        });
                    }

                    // Order the points consistently: TL, TR, BR, BL
                    const ordered = OPENCV_ENGINE.orderPoints(rawPoints);
                    CROP_ENGINE.setDetectedCorners({
                        tl : ordered[0],
                        tr : ordered[1],
                        br : ordered[2],
                        bl : ordered[3],
                    });

                    window.showToast('Document edges detected automatically!');
                    bestContour.delete();
                } else {
                    // No suitable quadrilateral found — use full-image default crop
                    CROP_ENGINE.setDefaultCorners(displayCanvas.width, displayCanvas.height);
                    window.showToast('Auto-detect found no document. Adjust handles manually.');
                }

                // ── Cleanup: delete all OpenCV Mats to prevent WASM memory leaks ──
                src.delete();
                gray.delete();
                blurred.delete();
                edges.delete();
                dilated.delete();
                kernel.delete();
                contours.delete();
                hierarchy.delete();

            } catch (err) {
                console.error('[DocuScan] OpenCV edge detection error:', err);
                CROP_ENGINE.setDefaultCorners(displayCanvas.width, displayCanvas.height);
                window.showToast('Edge detection failed. Using manual crop.');
            }
        },

        /**
         * Order 4 detected points into the standard TL, TR, BR, BL arrangement.
         * Algorithm uses sum and difference of coordinates:
         *   Sum (x+y):  smallest → TL,  largest → BR
         *   Diff (x-y): largest  → TR,  smallest → BL
         *
         * @param  {Array<{x: number, y: number}>} pts — Unordered 4 corner points
         * @returns {Array<{x, y}>} — Ordered [tl, tr, br, bl]
         */
        orderPoints(pts) {
            const sums  = pts.map(p => p.x + p.y);
            const diffs = pts.map(p => p.x - p.y);

            const tl = pts[sums.indexOf(Math.min(...sums))];
            const br = pts[sums.indexOf(Math.max(...sums))];
            const tr = pts[diffs.indexOf(Math.max(...diffs))];
            const bl = pts[diffs.indexOf(Math.min(...diffs))];

            return [tl, tr, br, bl];
        },

        /**
         * Apply a 4-point perspective transform using the current crop handle positions.
         * This "bird's eye view" transform corrects camera angle and produces a
         * perfectly flat, orthographic document view.
         *
         * Returns a new <canvas> with the warped output, or falls back to a simple
         * rectangular crop if OpenCV is unavailable or throws an error.
         *
         * @param  {HTMLCanvasElement} sourceCanvas — The display-resolution crop canvas
         * @returns {HTMLCanvasElement|null} — Warped output canvas, or null on failure
         */
        applyPerspectiveWarp(sourceCanvas) {
            // If OpenCV is unavailable, use the simpler rectangular crop fallback
            if (!state.opencvReady || typeof cv === 'undefined') {
                return OPENCV_ENGINE.fallbackRectCrop(sourceCanvas);
            }

            try {
                const pts = state.cropHandles; // { tl, tr, bl, br } in display coords

                // Calculate output width from the top edge and bottom edge distances
                const widthTop    = Math.hypot(pts.tr.x - pts.tl.x, pts.tr.y - pts.tl.y);
                const widthBottom = Math.hypot(pts.br.x - pts.bl.x, pts.br.y - pts.bl.y);
                const outWidth    = Math.round(Math.max(widthTop, widthBottom));

                // Calculate output height from the left edge and right edge distances
                const heightLeft  = Math.hypot(pts.bl.x - pts.tl.x, pts.bl.y - pts.tl.y);
                const heightRight = Math.hypot(pts.br.x - pts.tr.x, pts.br.y - pts.tr.y);
                const outHeight   = Math.round(Math.max(heightLeft, heightRight));

                // Guard: prevent processing if the crop area is too small
                if (outWidth < 10 || outHeight < 10) {
                    window.showToast('Crop area too small. Please adjust the handles.');
                    return null;
                }

                // ── Build the perspective transform ──────────────────────────

                // Read the source canvas pixels into an OpenCV Mat
                const src = cv.imread(sourceCanvas);

                // Define the 4 source points (the quadrilateral the user defined)
                const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
                    pts.tl.x, pts.tl.y,
                    pts.tr.x, pts.tr.y,
                    pts.br.x, pts.br.y,
                    pts.bl.x, pts.bl.y,
                ]);

                // Define the 4 destination points (a perfect rectangle)
                const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
                    0,        0,
                    outWidth, 0,
                    outWidth, outHeight,
                    0,        outHeight,
                ]);

                // Compute the 3×3 perspective transformation matrix
                const M      = cv.getPerspectiveTransform(srcPts, dstPts);
                const warped = new cv.Mat();
                const dsize  = new cv.Size(outWidth, outHeight);

                // Apply the warp — INTER_LINEAR interpolation for best quality
                cv.warpPerspective(
                    src, warped, M, dsize,
                    cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar()
                );

                // Write the warped Mat to an output canvas element
                const outCanvas    = document.createElement('canvas');
                outCanvas.width    = outWidth;
                outCanvas.height   = outHeight;
                cv.imshow(outCanvas, warped);

                // ── Cleanup: delete all OpenCV Mats ──────────────────────────
                src.delete();
                srcPts.delete();
                dstPts.delete();
                M.delete();
                warped.delete();

                return outCanvas;

            } catch (err) {
                console.error('[DocuScan] Warp perspective error:', err);
                window.showToast('Perspective correction failed. Applying simple crop.');
                return OPENCV_ENGINE.fallbackRectCrop(sourceCanvas);
            }
        },

        /**
         * Fallback: Simple axis-aligned rectangular crop using the bounding box
         * of the four handle positions. Used when OpenCV is unavailable or errors.
         *
         * @param  {HTMLCanvasElement} sourceCanvas
         * @returns {HTMLCanvasElement} — Cropped canvas
         */
        fallbackRectCrop(sourceCanvas) {
            const pts = state.cropHandles;

            // Bounding box of the quadrilateral
            const x = Math.min(pts.tl.x, pts.bl.x);
            const y = Math.min(pts.tl.y, pts.tr.y);
            const w = Math.max(pts.tr.x, pts.br.x) - x;
            const h = Math.max(pts.bl.y, pts.br.y) - y;

            const outCanvas    = document.createElement('canvas');
            outCanvas.width    = Math.max(1, Math.round(w));
            outCanvas.height   = Math.max(1, Math.round(h));
            const ctx          = outCanvas.getContext('2d');

            // Crop the source region and stretch to the output canvas size
            ctx.drawImage(sourceCanvas, x, y, w, h, 0, 0, outCanvas.width, outCanvas.height);
            return outCanvas;
        },
    };


    /* =========================================================================
     * 9. FILTER_ENGINE
     * ─────────────────
     * Applies document enhancement filters to a canvas using the Canvas 2D API.
     * All filters operate on raw pixel data (RGBA Uint8ClampedArray) for maximum
     * performance without external dependencies.
     *
     * Available Filters:
     *  'magic'     — Contrast stretching + saturation boost + warm tone correction
     *  'grayscale' — ITU-R BT.709 luminance-correct grayscale (perceptually accurate)
     *  'bw'        — Adaptive mean threshold black & white (ideal for printing)
     *  'original'  — No processing — returns the source canvas as-is
     * ========================================================================= */
    const FILTER_ENGINE = {

        /**
         * Apply a named filter to a source canvas and return a new processed canvas.
         * The source canvas is never modified — a new canvas is always created.
         *
         * @param  {HTMLCanvasElement} srcCanvas  — Input canvas to process
         * @param  {string}            filterName — 'magic' | 'grayscale' | 'bw' | 'original'
         * @returns {HTMLCanvasElement} — New canvas with the filter applied
         */
        apply(srcCanvas, filterName) {
            const outCanvas    = document.createElement('canvas');
            outCanvas.width    = srcCanvas.width;
            outCanvas.height   = srcCanvas.height;
            const ctx          = outCanvas.getContext('2d');
            ctx.drawImage(srcCanvas, 0, 0);

            // Original filter: return a copy without any pixel manipulation
            if (filterName === 'original') return outCanvas;

            // Get the raw RGBA pixel data for direct manipulation
            const imageData = ctx.getImageData(0, 0, outCanvas.width, outCanvas.height);
            const data      = imageData.data; // Uint8ClampedArray [R,G,B,A, R,G,B,A, ...]

            switch (filterName) {
                case 'magic':
                    FILTER_ENGINE._applyMagic(data);
                    break;
                case 'grayscale':
                    FILTER_ENGINE._applyGrayscale(data);
                    break;
                case 'bw':
                    FILTER_ENGINE._applyBW(data);
                    break;
                default:
                    break;
            }

            // Write the modified pixel data back to the canvas
            ctx.putImageData(imageData, 0, 0);
            return outCanvas;
        },

        /**
         * Magic Color Filter:
         * Simulates the auto-enhance mode of professional scanner software.
         *
         * Algorithm:
         *  Pass 1 — Find the min and max luminance values (for contrast stretching)
         *  Pass 2 — Apply min-max normalization to stretch contrast across full range
         *         — Apply saturation boost (push colors away from neutral gray)
         *         — Apply a subtle warm tone (+5 red, -2 blue) for pleasing color
         *
         * @param {Uint8ClampedArray} data — RGBA pixel data array (modified in-place)
         */
        _applyMagic(data) {
            // Pass 1: Find minimum and maximum luminance for contrast range
            let minL = 255, maxL = 0;
            for (let i = 0; i < data.length; i += 4) {
                // Perceptual luminance using BT.601 coefficients
                const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                if (lum < minL) minL = lum;
                if (lum > maxL) maxL = lum;
            }
            const range = maxL - minL || 1; // Avoid division by zero for uniform images

            // Pass 2: Stretch contrast and boost saturation per pixel
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i], g = data[i + 1], b = data[i + 2];

                // Contrast stretch: linearly map [minL, maxL] → [0, 255]
                r = Math.round(((r - minL) / range) * 255);
                g = Math.round(((g - minL) / range) * 255);
                b = Math.round(((b - minL) / range) * 255);

                // Saturation boost: amplify deviation from the neutral gray average
                const avg      = (r + g + b) / 3;
                const satBoost = 1.25; // 25% saturation increase
                r = Math.round(avg + (r - avg) * satBoost);
                g = Math.round(avg + (g - avg) * satBoost);
                b = Math.round(avg + (b - avg) * satBoost);

                // Subtle warm tone correction — mimics incandescent light white balance
                r += 5;
                b -= 2;

                // Clamp values to valid [0, 255] range
                data[i]     = Math.max(0, Math.min(255, r));
                data[i + 1] = Math.max(0, Math.min(255, g));
                data[i + 2] = Math.max(0, Math.min(255, b));
            }
        },

        /**
         * Luminance-Correct Grayscale Filter (ITU-R BT.709 standard):
         * Y = 0.2126·R + 0.7152·G + 0.0722·B
         *
         * These weights match human perceptual sensitivity: green is perceived as
         * brightest, then red, then blue. Classic scanners use this conversion.
         *
         * @param {Uint8ClampedArray} data — RGBA pixel data array (modified in-place)
         */
        _applyGrayscale(data) {
            for (let i = 0; i < data.length; i += 4) {
                const lum = Math.round(
                    0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
                );
                // Set R=G=B=luminance (alpha unchanged)
                data[i] = data[i + 1] = data[i + 2] = lum;
            }
        },

        /**
         * High-Contrast Black & White Filter:
         * Produces clean, print-ready binary document images.
         *
         * Algorithm:
         *  1. Convert to grayscale first
         *  2. Compute the mean luminance of the entire image as a global threshold
         *  3. Pixels above threshold → white (255); below → black (0)
         *
         * The mean-based threshold approximates local adaptive thresholding and
         * works well for standard printed documents on a light background.
         *
         * @param {Uint8ClampedArray} data — RGBA pixel data array (modified in-place)
         */
        _applyBW(data) {
            // Step 1: Convert to grayscale using standard luminance weights
            FILTER_ENGINE._applyGrayscale(data);

            // Step 2: Compute mean luminance of the grayscale image
            let sum = 0;
            const pixelCount = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
                sum += data[i]; // R=G=B after grayscale, so just use R
            }
            const threshold = sum / pixelCount;

            // Step 3: Apply binary threshold — black or white, nothing in between
            for (let i = 0; i < data.length; i += 4) {
                const val = data[i] > threshold ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = val;
            }
        },
    };


    /* =========================================================================
     * 10. PAGES_MANAGER
     * ──────────────────
     * Manages the list of scanned document pages stored in `state.pages`.
     * Each page is a plain object: { dataUrl: string, width: number, height: number }.
     *
     * Pages are rendered as thumbnails in the `.dsc-pages-strip` container.
     * Each thumbnail has a page number badge and an × delete button.
     * ========================================================================= */
    const PAGES_MANAGER = {

        /**
         * Add the currently processed canvas to the document as a new page.
         * Encodes the canvas to a JPEG data URL at the configured quality.
         * Updates the page counter and renders a new thumbnail.
         */
        addCurrentPage() {
            if (!state.processedCanvas) {
                window.showToast('No processed image ready. Please capture and apply crop first.');
                return;
            }

            // Convert the processed canvas to a compressed JPEG data URL
            const dataUrl = state.processedCanvas.toDataURL('image/jpeg', state.pdfQuality);

            const page = {
                dataUrl,
                width   : state.processedCanvas.width,
                height  : state.processedCanvas.height,
            };

            state.pages.push(page);
            PAGES_MANAGER.renderThumbnail(page, state.pages.length - 1);
            UI_MANAGER.updatePageCount();

            window.showToast(`Page ${state.pages.length} added to document.`);
        },

        /**
         * Create and insert a thumbnail card for a page into the pages strip.
         * Each thumbnail contains: the page image, a page number badge, and a delete button.
         *
         * @param {{ dataUrl: string }} page — The page object with the image data URL
         * @param {number}              index — Zero-based index in state.pages
         */
        renderThumbnail(page, index) {
            // Hide the empty state placeholder now that we have at least one page
            DOM.pagesEmptyState.classList.add('hidden');

            // ── Build the thumbnail card ─────────────────────────────────────
            const thumb           = document.createElement('div');
            thumb.className       = 'page-thumb';
            thumb.dataset.index   = index;

            // Thumbnail image — lazy loaded for performance
            const img             = document.createElement('img');
            img.src               = page.dataUrl;
            img.alt               = `Page ${index + 1}`;
            img.loading           = 'lazy';

            // Page number badge (bottom-left of thumbnail)
            const numBadge        = document.createElement('div');
            numBadge.className    = 'page-thumb-number';
            numBadge.textContent  = index + 1;

            // Delete button (top-right of thumbnail, revealed on hover)
            const delBtn          = document.createElement('button');
            delBtn.className      = 'page-thumb-delete';
            delBtn.innerHTML      = '<i class="fa-solid fa-xmark"></i>';
            delBtn.title          = 'Remove page';

            // Clicking delete removes this page and re-renders the strip
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent any parent click handlers
                PAGES_MANAGER.removePage(index);
            });

            // Assemble and append the thumbnail
            thumb.appendChild(img);
            thumb.appendChild(numBadge);
            thumb.appendChild(delBtn);
            DOM.pagesStrip.appendChild(thumb);

            // Scroll the strip to show the newly added thumbnail
            thumb.scrollIntoView({ behavior: 'smooth', inline: 'end' });
        },

        /**
         * Remove a page from the document by its index.
         * Re-renders all remaining thumbnails to keep page numbers in sync.
         *
         * @param {number} index — Zero-based index of the page to remove
         */
        removePage(index) {
            state.pages.splice(index, 1);
            PAGES_MANAGER.rebuildThumbnails();
            UI_MANAGER.updatePageCount();
            window.showToast('Page removed.');
        },

        /**
         * Prompt the user and remove all pages from the document.
         * Uses a native confirm dialog to prevent accidental data loss.
         */
        clearAll() {
            if (state.pages.length === 0) return;
            if (!confirm(`Remove all ${state.pages.length} page(s) from the document?`)) return;

            state.pages = [];
            PAGES_MANAGER.rebuildThumbnails();
            UI_MANAGER.updatePageCount();
            window.showToast('All pages cleared.');
        },

        /**
         * Completely rebuild the thumbnail strip from scratch.
         * Called after any delete or clear-all operation to ensure
         * page numbers and indices are always in sync.
         */
        rebuildThumbnails() {
            // Clear the entire strip and re-add just the empty state element
            DOM.pagesStrip.innerHTML = '';
            DOM.pagesStrip.appendChild(DOM.pagesEmptyState);

            if (state.pages.length === 0) {
                DOM.pagesEmptyState.classList.remove('hidden');
                return;
            }

            // Re-render thumbnails for all remaining pages
            state.pages.forEach((page, i) => {
                PAGES_MANAGER.renderThumbnail(page, i);
            });
        },
    };


    /* =========================================================================
     * 11. OCR_ENGINE
     * ───────────────
     * Runs offline text extraction on the processed canvas using Tesseract.js.
     * The Tesseract.js worker is initialized on first use (lazy initialization)
     * to avoid blocking the page load with a large WASM module.
     *
     * Progress is reported via the Tesseract logger callback, which updates the
     * progress bar and label in real time.
     * ========================================================================= */
    const OCR_ENGINE = {

        /**
         * Run OCR on the currently processed canvas image.
         * Handles concurrency guard, library presence check, and error recovery.
         * Updates the progress bar during recognition and shows the result in the textarea.
         */
        async run() {
            // Guard: prevent concurrent OCR runs
            if (state.ocrRunning) {
                window.showToast('OCR is already running. Please wait.');
                return;
            }

            if (!state.processedCanvas) {
                window.showToast('No processed image. Please capture, crop and apply a filter first.');
                return;
            }

            // Verify Tesseract.js library is loaded
            if (typeof Tesseract === 'undefined') {
                window.showToast('Tesseract.js library not found. Check the library path.', true);
                return;
            }

            const language      = DOM.ocrLanguage.value || 'eng';
            state.ocrRunning    = true;
            DOM.btnRunOcr.disabled = true;

            // Show the progress bar with the initial "loading" state
            DOM.ocrProgressWrap.classList.remove('hidden');
            DOM.ocrProgressBar.style.width   = '0%';
            DOM.ocrProgressLabel.textContent = 'Loading OCR engine…';

            try {
                // Convert the processed canvas to a PNG data URL for Tesseract input
                const imageUrl = state.processedCanvas.toDataURL('image/png');

                // Run Tesseract recognition with explicit local paths
                const result = await Tesseract.recognize(imageUrl, language, {
                    logger: (m) => OCR_ENGINE.onProgress(m),
                    workerPath: CONFIG.TESSERACT_BASE_PATH + 'worker.min.js',
                    corePath: CONFIG.TESSERACT_BASE_PATH + 'tesseract-core.wasm.js',
                    // Tesseract automatically looks for [lang].traineddata.gz inside this directory
                    langPath: CONFIG.TESSERACT_BASE_PATH + 'lang-data' 
                });

                const text = result.data.text.trim();

                // Display the extracted text (or a helpful message if nothing was found)
                DOM.ocrOutput.value     = text || '(No text detected. Try a different filter or improve lighting.)';
                DOM.btnCopyOcr.disabled = !text;

                // Complete the progress bar
                DOM.ocrProgressLabel.textContent = 'Done!';
                DOM.ocrProgressBar.style.width   = '100%';

                // Auto-hide the progress bar after a short delay
                setTimeout(() => {
                    DOM.ocrProgressWrap.classList.add('hidden');
                }, 1500);

                // Show result summary toast
                window.showToast(
                    text
                        ? `Text extracted! ${text.length} characters found.`
                        : 'No text found in the image.'
                );

            } catch (err) {
                console.error('[DocuScan] OCR error:', err);
                window.showToast('OCR failed: ' + (err.message || 'Unknown error'), true);
                DOM.ocrProgressWrap.classList.add('hidden');

            } finally {
                // Always re-enable the OCR button regardless of success or failure
                state.ocrRunning       = false;
                DOM.btnRunOcr.disabled = false;
            }
        },

        /**
         * Handle Tesseract.js logger progress callbacks.
         * Maps Tesseract status strings to human-readable progress bar updates.
         *
         * @param {{ status: string, progress: number }} m — Logger message from Tesseract
         */
        onProgress(m) {
            if (m.status === 'recognizing text') {
                const pct = Math.round(m.progress * 100);
                DOM.ocrProgressBar.style.width   = pct + '%';
                DOM.ocrProgressLabel.textContent = `Recognizing… ${pct}%`;
            } else if (m.status === 'loading tesseract core') {
                DOM.ocrProgressLabel.textContent  = 'Loading OCR core…';
            } else if (m.status === 'initializing tesseract') {
                DOM.ocrProgressLabel.textContent  = 'Initializing…';
            } else if (m.status === 'loading language traineddata') {
                DOM.ocrProgressLabel.textContent  = `Loading ${DOM.ocrLanguage.value} language data…`;
                DOM.ocrProgressBar.style.width    = '15%';
            } else if (m.status === 'initialized api') {
                DOM.ocrProgressBar.style.width    = '30%';
                DOM.ocrProgressLabel.textContent  = 'Ready. Starting recognition…';
            }
        },
    };


    /* =========================================================================
     * 12. PDF_ENGINE
     * ───────────────
     * Generates a multi-page PDF from all pages in `state.pages` using jsPDF.
     *
     * Each page image is centered on its PDF page with 5mm margins, and an
     * aspect-ratio-preserving resize ensures no content is clipped.
     * A small page number footer is added at the bottom of each page.
     *
     * The output file is automatically downloaded with a timestamped filename.
     * ========================================================================= */
    const PDF_ENGINE = {

        /**
         * Build and trigger a download of the multi-page PDF document.
         * Iterates over all pages in state.pages and adds each as a JPEG image.
         */
        export() {
            if (state.pages.length === 0) {
                window.showToast('No pages to export. Please add at least one page first.');
                return;
            }

            // Verify jsPDF is loaded (handles both UMD and global variants)
            if (typeof jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
                window.showToast('jsPDF library not found. Check the library path.', true);
                return;
            }

            const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };

            // Get page configuration from the UI controls
            const pageSize = DOM.pdfPageSize.value    || 'a4';
            const orient   = DOM.pdfOrientation.value || 'portrait';

            // Initialize the jsPDF document with the selected format
            const doc = new jsPDF({
                orientation : orient,
                unit        : 'mm',
                format      : pageSize,
            });

            // Get the physical page dimensions in millimetres
            const pageW  = doc.internal.pageSize.getWidth();
            const pageH  = doc.internal.pageSize.getHeight();

            // Define consistent 5mm margins on all sides
            const margin = 5;
            const maxW   = pageW - margin * 2;
            const maxH   = pageH - margin * 2;

            window.showToast(`Generating PDF with ${state.pages.length} page(s)…`);

            // ── Add each scanned page image to the PDF ───────────────────────
            state.pages.forEach((page, index) => {
                // Add a new blank page for every page after the first
                if (index > 0) {
                    doc.addPage(pageSize, orient);
                }

                // Calculate dimensions that fit within the margins while preserving aspect ratio
                const imgAspect = page.width / page.height;
                let imgW = maxW;
                let imgH = imgW / imgAspect;

                // If the height exceeds the maximum, scale down based on height instead
                if (imgH > maxH) {
                    imgH = maxH;
                    imgW = imgH * imgAspect;
                }

                // Center the image on the page within the defined margins
                const x = margin + (maxW - imgW) / 2;
                const y = margin + (maxH - imgH) / 2;

                // Add the page image as a JPEG (smaller file size than PNG)
                doc.addImage(page.dataUrl, 'JPEG', x, y, imgW, imgH);

                // Add a small footer with page number and tool attribution
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                    `Page ${index + 1} of ${state.pages.length}  •  Smart DocuScan ULTRA MAX`,
                    pageW / 2,
                    pageH - 2,
                    { align: 'center' }
                );
            });

            // Generate a timestamped filename (e.g., "DocuScan_2026-03-15_14-30.pdf")
            const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
            const filename  = `DocuScan_${timestamp}.pdf`;

            // Trigger the browser download dialog
            doc.save(filename);
            window.showToast(`PDF exported: ${filename}`);
        },
    };


    /* =========================================================================
     * 13. UI_MANAGER
     * ───────────────
     * Centralized management of all UI state changes.
     * Buttons are enabled/disabled based on application state, not scattered
     * across the codebase — keeps UI transitions predictable and maintainable.
     * ========================================================================= */
    const UI_MANAGER = {

        /**
         * Enable or disable the crop editor action buttons (Apply Crop, OCR, Add Page).
         * Called when an image is loaded into (enable) or cleared from (disable) the editor.
         *
         * @param {boolean} enabled — True to enable, false to disable
         */
        setEditorEnabled(enabled) {
            DOM.btnApplyCrop.disabled = !enabled;
            DOM.btnRunOcr.disabled    = !enabled;
            DOM.btnAddPage.disabled   = !enabled;
        },

        /**
         * Update the page counter badge text and conditionally enable/disable
         * the Export PDF button based on whether any pages have been added.
         */
        updatePageCount() {
            const count = state.pages.length;

            // Pluralize "page/pages" correctly
            DOM.pageCounter.textContent = `${count} page${count !== 1 ? 's' : ''}`;

            // Export PDF requires at least one page; Add Page requires a processed canvas
            DOM.btnExportPdf.disabled = count === 0;
            DOM.btnAddPage.disabled   = !state.processedCanvas;
        },

        /**
         * Update the visual active state of the filter buttons to highlight
         * the currently selected filter, and update `state.activeFilter`.
         *
         * @param {string} filterName — The filter to mark as active
         */
        setActiveFilter(filterName) {
            DOM.filterBtns.forEach(btn => {
                // Toggle 'active' class: on if this button matches the selected filter
                btn.classList.toggle('active', btn.dataset.filter === filterName);
            });
            state.activeFilter = filterName;
        },

        /**
         * Re-apply the currently selected filter to the crop canvas and update
         * `state.processedCanvas` with the result. Used for live filter preview
         * when the user switches filters after an image is already loaded.
         */
        applyFilterPreview() {
            if (!DOM.cropCanvas.width) return;

            // Re-apply the selected filter to the current crop canvas contents
            const filtered       = FILTER_ENGINE.apply(DOM.cropCanvas, state.activeFilter);
            state.processedCanvas = filtered;
        },
    };


    /* =========================================================================
     * 14. EVENT_BINDER
     * ─────────────────
     * All addEventListener calls are centralized here for easy maintenance.
     * This module is the single point of truth for all user interactions —
     * no event listeners are attached anywhere else in the codebase.
     *
     * Includes both mouse events (desktop) and touch events (mobile) for full
     * cross-device compatibility.
     * ========================================================================= */
    const EVENT_BINDER = {

        /**
         * Wire up all UI event listeners.
         * Called once during initialization (INIT.init()).
         */
        bind() {

            // ── CAMERA CONTROLS ──────────────────────────────────────────────

            // Start Camera / Stop Camera toggle
            DOM.btnStartCamera.addEventListener('click', () => {
                if (state.cameraActive) {
                    CAMERA_MANAGER.stopCamera();
                } else {
                    CAMERA_MANAGER.startCamera();
                }
            });

            // Capture the current video frame
            DOM.btnCapture.addEventListener('click', () => {
                CAPTURE_ENGINE.captureFrame();
            });

            // Switch between front and rear camera
            DOM.btnSwitchCamera.addEventListener('click', () => {
                CAMERA_MANAGER.switchCamera();
            });

            // Toggle torch/flashlight
            DOM.btnTorch.addEventListener('click', () => {
                CAMERA_MANAGER.toggleTorch();
            });

            // Upload image file via the toolbar label
            DOM.imageFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) CAPTURE_ENGINE.loadFileAsImage(file);
                // Reset input value so the same file can be re-selected next time
                e.target.value = '';
            });

            // Upload image file via the camera-denied fallback UI
            DOM.fallbackFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    CAPTURE_ENGINE.loadFileAsImage(file);
                    DOM.cameraFallback.classList.add('hidden');
                }
                e.target.value = '';
            });


            // ── CROP HANDLE DRAGGING: MOUSE (Desktop) ────────────────────────

            // Attach mousedown to each of the 4 corner handle elements
            Object.entries(CROP_ENGINE.handleElements).forEach(([key, el]) => {
                el.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent text selection during drag
                    CROP_ENGINE.startDrag(key, e.clientX, e.clientY);
                });
            });

            // Track mouse movement globally (not just on the handle) for smooth dragging
            document.addEventListener('mousemove', (e) => {
                if (state.draggingHandle) {
                    CROP_ENGINE.doDrag(e.clientX, e.clientY);
                }
            });

            // Release the drag on mouseup anywhere on the document
            document.addEventListener('mouseup', () => {
                CROP_ENGINE.endDrag();
            });


            // ── CROP HANDLE DRAGGING: TOUCH (Mobile) ─────────────────────────

            // Attach touchstart to each handle — passive: false to allow preventDefault
            Object.entries(CROP_ENGINE.handleElements).forEach(([key, el]) => {
                el.addEventListener('touchstart', (e) => {
                    e.preventDefault(); // Prevent scroll interference during handle drag
                    const touch = e.touches[0];
                    CROP_ENGINE.startDrag(key, touch.clientX, touch.clientY);
                }, { passive: false });
            });

            // Track touch movement globally — passive: false required for preventDefault
            document.addEventListener('touchmove', (e) => {
                if (state.draggingHandle) {
                    e.preventDefault(); // Prevent page scroll while dragging a handle
                    const touch = e.touches[0];
                    CROP_ENGINE.doDrag(touch.clientX, touch.clientY);
                }
            }, { passive: false });

            // Release the drag when the touch ends or is cancelled
            document.addEventListener('touchend', () => {
                CROP_ENGINE.endDrag();
            });


            // ── EDITOR CONTROLS ───────────────────────────────────────────────

            // Reset all crop handles to the full-image default positions
            DOM.btnResetCrop.addEventListener('click', () => {
                CROP_ENGINE.resetToFullImage();
            });

            // Rotate the captured image 90° clockwise
            DOM.btnRotate.addEventListener('click', () => {
                EVENT_BINDER.rotateImage();
            });

            // Filter selection buttons — update active state and preview
            DOM.filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    UI_MANAGER.setActiveFilter(btn.dataset.filter);
                    // If an image is already loaded, instantly preview the new filter
                    if (DOM.cropCanvas.width) UI_MANAGER.applyFilterPreview();
                });
            });

            // Apply the perspective warp + selected filter to produce the processed canvas
            DOM.btnApplyCrop.addEventListener('click', () => {
                EVENT_BINDER.applyCropAndFilter();
            });


            // ── PAGES & PDF EXPORT ────────────────────────────────────────────

            // Add the processed canvas as a new page in the document
            DOM.btnAddPage.addEventListener('click', () => {
                PAGES_MANAGER.addCurrentPage();
            });

            // Remove all pages from the document (with confirmation)
            DOM.btnClearPages.addEventListener('click', () => {
                PAGES_MANAGER.clearAll();
            });

            // Generate and download the multi-page PDF
            DOM.btnExportPdf.addEventListener('click', () => {
                PDF_ENGINE.export();
            });


            // ── OCR ───────────────────────────────────────────────────────────

            // Run Tesseract OCR on the processed canvas
            DOM.btnRunOcr.addEventListener('click', () => {
                OCR_ENGINE.run();
            });

            // Copy the extracted OCR text to the clipboard
            DOM.btnCopyOcr.addEventListener('click', () => {
                const text = DOM.ocrOutput.value;
                if (!text) return;

                navigator.clipboard.writeText(text)
                    .then(() => window.showToast('Text copied to clipboard!'))
                    .catch(() => {
                        // Fallback for browsers that block Clipboard API without HTTPS
                        DOM.ocrOutput.select();
                        document.execCommand('copy');
                        window.showToast('Text copied!');
                    });
            });

            // Clear the OCR textarea and disable the copy button
            DOM.btnClearOcr.addEventListener('click', () => {
                DOM.ocrOutput.value     = '';
                DOM.btnCopyOcr.disabled = true;
            });


            // ── PDF QUALITY SLIDER ────────────────────────────────────────────

            // Update the displayed quality value and the state when the slider moves
            DOM.pdfQuality.addEventListener('input', (e) => {
                const val           = parseInt(e.target.value, 10);
                state.pdfQuality    = val / 100;       // Convert % to 0.0–1.0 fraction
                DOM.pdfQualityVal.textContent = val;   // Update the live display label
            });


            // ── WINDOW RESIZE ─────────────────────────────────────────────────

            // Recalculate handle positions and overlay canvas size on window resize
            window.addEventListener('resize', () => {
                if (DOM.cropCanvas.width) {
                    // Reposition the 4 corner handles relative to the resized canvas
                    CROP_ENGINE.updateHandlePositions();
                }
                if (state.cameraActive) {
                    // Resize the edge-detection overlay to match the resized video element
                    CAMERA_MANAGER.resizeOverlay();
                }
            });
        },


        /**
         * Rotate the captured image 90° clockwise and reload it into the editor.
         * Creates a new canvas with swapped width/height, uses a rotation transform
         * to draw the source image, and updates state.capturedCanvas.
         */
        rotateImage() {
            if (!state.capturedCanvas) {
                window.showToast('No image to rotate. Please capture or upload first.');
                return;
            }

            const src = state.capturedCanvas;
            const w   = src.width;
            const h   = src.height;

            // New canvas has swapped dimensions: portrait ↔ landscape
            const rotated     = document.createElement('canvas');
            rotated.width     = h;
            rotated.height    = w;
            const ctx         = rotated.getContext('2d');

            // Rotate 90° clockwise: translate to new center, rotate π/2, draw offset
            ctx.translate(h / 2, w / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(src, -w / 2, -h / 2);

            // Update the captured canvas state and reload into the editor
            state.capturedCanvas = rotated;
            state.rotationAngle  = (state.rotationAngle + 90) % 360;

            CAPTURE_ENGINE.loadImageIntoEditor(rotated);
            window.showToast('Image rotated 90°.');
        },


        /**
         * Main processing pipeline — triggered by the "Apply Crop" button:
         *  Step 1: Apply perspective warp using current handle positions (OpenCV)
         *  Step 2: Apply the selected image filter (Canvas API)
         *  Step 3: Store the result in state.processedCanvas
         *  Step 4: Preview the result in the crop canvas
         *  Step 5: Hide the crop handles (result is already flat)
         *  Step 6: Enable the Add Page and Extract Text buttons
         */
        applyCropAndFilter() {
            if (!DOM.cropCanvas.width) {
                window.showToast('Nothing to process. Please capture or upload an image first.');
                return;
            }

            // Step 1: Perspective warp via OpenCV (or rectangular crop fallback)
            const warped = OPENCV_ENGINE.applyPerspectiveWarp(DOM.cropCanvas);
            if (!warped) return;

            // Step 2: Apply the selected image filter
            const filtered = FILTER_ENGINE.apply(warped, state.activeFilter);

            // Step 3: Store the result
            state.processedCanvas = filtered;

            // Step 4: Preview the result in the crop canvas
            DOM.cropCanvas.width  = filtered.width;
            DOM.cropCanvas.height = filtered.height;
            const ctx = DOM.cropCanvas.getContext('2d');
            ctx.drawImage(filtered, 0, 0);

            // Step 5: Hide crop handles — the output is already a flat, corrected image
            CROP_ENGINE.hideHandles();
            DOM.cropQuadPoly.setAttribute('points', '');

            // Step 6: Enable downstream action buttons
            DOM.btnAddPage.disabled = false;
            DOM.btnRunOcr.disabled  = false;
            DOM.btnCopyOcr.disabled = true;  // No OCR text yet for the new result
            DOM.ocrOutput.value     = '';    // Clear any previous OCR output

            window.showToast('Crop applied! Image is ready. Add it to your document or extract text.');
        },
    };


    /* =========================================================================
     * 15. INIT — Bootstrap Function
     * ───────────────────────────────
     * Called on DOMContentLoaded. Sets up the complete application:
     *  1. Start watching for OpenCV.js to load
     *  2. Wire all event listeners
     *  3. Set initial UI state (buttons disabled, empty state visible)
     *  4. Check for required browser API support (camera, jsPDF, Tesseract)
     * ========================================================================= */
    function init() {
        console.log('[DocuScan] Smart DocuScan ULTRA MAX v2.0 initializing…');

        // Start polling for OpenCV.js readiness
        OPENCV_MANAGER.init();

        // Bind all event listeners
        EVENT_BINDER.bind();

        // Initialize UI to a clean disabled state
        UI_MANAGER.updatePageCount();
        UI_MANAGER.setEditorEnabled(false);

        // ── Camera API Support Check ─────────────────────────────────────────
        // Check if the browser supports WebRTC camera access
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            DOM.btnStartCamera.disabled          = true;
            DOM.btnCapture.disabled              = true;
            DOM.cameraFallback.classList.remove('hidden');
            DOM.opencvStatusText.textContent     = 'Camera API not supported in this browser.';
            window.showToast('Camera not supported in this browser. Please use the Upload option.');
            console.warn('[DocuScan] getUserMedia not supported in this browser.');
        }

        // ── Library Load Verification ────────────────────────────────────────
        // Deferred check (2s) to allow async library scripts to finish loading
        setTimeout(() => {
            if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
                console.warn('[DocuScan] jsPDF library not detected. PDF export will fail.');
            }
            if (typeof Tesseract === 'undefined') {
                console.warn('[DocuScan] Tesseract.js library not detected. OCR will fail.');
            }
        }, 2000);

        console.log('[DocuScan] Initialization complete. Ready.');
    }


    /* =========================================================================
     * UTILITY: Global Toast Notification Helper
     * ──────────────────────────────────────────
     * Thin wrapper around `window.showToast()` from global.js.
     * Provides a console fallback in case global.js hasn't loaded yet.
     *
     * Usage:
     *   toast('Message')           → Informational toast
     *   toast('Error', true)       → Error toast (red, via global.js boolean flag)
     *
     * NOTE: This internal helper is kept for legacy call sites within this file.
     *       All new code should call window.showToast() directly for clarity.
     * ========================================================================= */
    function toast(message, isError = false) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, isError || false);
        } else {
            // Fallback: log to console if global.js hasn't initialized yet
            const logFn = isError ? console.error : console.log;
            logFn(`[DocuScan Toast][${isError ? 'ERROR' : 'INFO'}] ${message}`);
        }
    }


    /* =========================================================================
     * BOOTSTRAP: Wait for DOM to be ready, then initialize.
     * Handles both defer-loaded and inline-at-end-of-body script positions.
     * ========================================================================= */
    if (document.readyState === 'loading') {
        // DOM is still being parsed — wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM is already parsed (script loaded with defer or at end of <body>)
        init();
    }

})(); // End IIFE — all vars remain private, no global namespace pollution
