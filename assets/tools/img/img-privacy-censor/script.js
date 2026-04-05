/**
 * =============================================================================
 * AI Privacy Censor ULTRA MAX — Main Script
 * Author  : MD KAWSAR | TrustedToolsWeb
 * File    : assets/tools/img/img-privacy-censor/script.js
 * Version : 1.0.0
 *
 * ARCHITECTURE OVERVIEW:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  PrivacyCensorApp (Main Namespace / Controller)             │
 * │                                                             │
 * │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
 * │  │  FaceEngine  │  │  OCREngine   │  │   CanvasEngine   │  │
 * │  │  (MediaPipe) │  │ (Tesseract)  │  │  (Blur/Pixel/BB) │  │
 * │  └──────────────┘  └──────────────┘  └──────────────────┘  │
 * │                                                             │
 * │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
 * │  │  BrushEngine │  │  ExifEngine  │  │   BatchEngine    │  │
 * │  │ (Manual Draw)│  │ (Strip Meta) │  │ (JSZip/Filesavr) │  │
 * │  └──────────────┘  └──────────────┘  └──────────────────┘  │
 * │                                                             │
 * │  ┌──────────────┐                                           │
 * │  │   UIManager  │                                           │
 * │  │(DOM updates) │                                           │
 * │  └──────────────┘                                           │
 * └─────────────────────────────────────────────────────────────┘
 *
 * TOAST NOTIFICATION SYSTEM:
 *   All notifications are handled by the global window.showToast()
 *   function injected by global.js. This script does NOT contain
 *   any local toast logic or containers.
 *
 * PRIVACY GUARANTEE:
 *   All processing is 100% client-side. Zero network requests are
 *   made with image data. MediaPipe WASM and Tesseract WASM run
 *   entirely in the browser's sandboxed JavaScript environment.
 * =============================================================================
 */

'use strict';


/* =============================================================================
   MODULE: CanvasEngine
   Provides low-level pixel manipulation routines for blur, pixelation, and
   black-bar censoring applied to a specified rectangular region of a canvas.
   All methods operate directly on a CanvasRenderingContext2D reference.
============================================================================= */
const CanvasEngine = (() => {

    /**
     * Apply Gaussian-style blur to a rectangular region of a canvas.
     * Uses a downscale → upscale technique for performance — avoids expensive
     * convolution and produces smooth, convincing blur results.
     *
     * @param {CanvasRenderingContext2D} ctx    - The 2D rendering context to modify.
     * @param {number} x          - Region origin X coordinate in pixels.
     * @param {number} y          - Region origin Y coordinate in pixels.
     * @param {number} w          - Region width in pixels.
     * @param {number} h          - Region height in pixels.
     * @param {number} intensity  - Blur strength factor (1–50; higher = blurrier).
     */
    function applyBlur(ctx, x, y, w, h, intensity = 20) {
        if (w <= 0 || h <= 0) return;

        // Clamp the region to canvas bounds to prevent out-of-bounds pixel reads
        const canvas = ctx.canvas;
        x = Math.max(0, Math.floor(x));
        y = Math.max(0, Math.floor(y));
        w = Math.min(canvas.width  - x, Math.ceil(w));
        h = Math.min(canvas.height - y, Math.ceil(h));

        if (w <= 0 || h <= 0) return;

        // Create a temporary off-screen canvas for the blur pass
        const tmpCanvas  = document.createElement('canvas');
        const factor     = Math.max(2, Math.min(intensity, 40)); // scale-down factor
        tmpCanvas.width  = Math.max(1, Math.floor(w / factor));
        tmpCanvas.height = Math.max(1, Math.floor(h / factor));
        const tmpCtx     = tmpCanvas.getContext('2d');

        // Enable smoothing for the downscale step (discards fine detail)
        tmpCtx.imageSmoothingEnabled = true;
        tmpCtx.imageSmoothingQuality = 'low';

        // Step 1: Scale region DOWN — reduces detail and creates blur source
        tmpCtx.drawImage(ctx.canvas, x, y, w, h, 0, 0, tmpCanvas.width, tmpCanvas.height);

        // Step 2: Scale UP back to full region — nearest-neighbour creates blur
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
        ctx.drawImage(tmpCanvas, 0, 0, tmpCanvas.width, tmpCanvas.height, x, y, w, h);

        // Restore high-quality smoothing preference for subsequent draws
        ctx.imageSmoothingQuality = 'high';
    }

    /**
     * Apply pixelation to a rectangular region by replacing each block of pixels
     * with the average RGBA colour of that block.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} blockSize - Edge length of each pixelation tile (4–60px).
     */
    function applyPixelate(ctx, x, y, w, h, blockSize = 12) {
        if (w <= 0 || h <= 0) return;

        const canvas = ctx.canvas;
        x = Math.max(0, Math.floor(x));
        y = Math.max(0, Math.floor(y));
        w = Math.min(canvas.width  - x, Math.ceil(w));
        h = Math.min(canvas.height - y, Math.ceil(h));

        if (w <= 0 || h <= 0) return;

        // Clamp blockSize to a visually meaningful range
        const bs = Math.max(4, Math.min(blockSize, 60));

        // Read raw pixel data for the region at once (single getImageData call)
        const imageData = ctx.getImageData(x, y, w, h);
        const data      = imageData.data; // Flat RGBA array

        // Iterate over each tile-sized block within the region
        for (let tileY = 0; tileY < h; tileY += bs) {
            for (let tileX = 0; tileX < w; tileX += bs) {

                // Accumulate RGBA channel totals across all pixels in this block
                let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;

                for (let py = tileY; py < Math.min(tileY + bs, h); py++) {
                    for (let px = tileX; px < Math.min(tileX + bs, w); px++) {
                        const idx = (py * w + px) * 4;
                        rSum += data[idx];
                        gSum += data[idx + 1];
                        bSum += data[idx + 2];
                        aSum += data[idx + 3];
                        count++;
                    }
                }

                // Compute the average colour for this block
                const rAvg = Math.round(rSum / count);
                const gAvg = Math.round(gSum / count);
                const bAvg = Math.round(bSum / count);
                const aAvg = Math.round(aSum / count);

                // Flood-fill the block with its average colour
                for (let py = tileY; py < Math.min(tileY + bs, h); py++) {
                    for (let px = tileX; px < Math.min(tileX + bs, w); px++) {
                        const idx      = (py * w + px) * 4;
                        data[idx]      = rAvg;
                        data[idx + 1]  = gAvg;
                        data[idx + 2]  = bAvg;
                        data[idx + 3]  = aAvg;
                    }
                }
            }
        }

        // Write the modified pixel buffer back to the canvas region
        ctx.putImageData(imageData, x, y);
    }

    /**
     * Paint a solid black bar over a rectangular region of the canvas.
     * A small padding is added so bars extend slightly beyond the exact bounds,
     * ensuring text characters at the edges are fully covered.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    function applyBlackBar(ctx, x, y, w, h) {
        if (w <= 0 || h <= 0) return;

        const pad = 2; // Extra pixels added on all sides for edge coverage
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(
            Math.max(0, x - pad),
            Math.max(0, y - pad),
            Math.min(ctx.canvas.width  - x, w + pad * 2),
            Math.min(ctx.canvas.height - y, h + pad * 2)
        );
        ctx.restore();
    }

    /**
     * Central dispatch function: routes to the correct censor method by name.
     * This is the single entry point used by BrushEngine and the main pipeline.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string}  method     - 'blur' | 'pixelate' | 'blackbar'
     * @param {number}  x
     * @param {number}  y
     * @param {number}  w
     * @param {number}  h
     * @param {number}  intensity  - Blur intensity or pixel block-size divisor.
     */
    function applyCensor(ctx, method, x, y, w, h, intensity = 20) {
        switch (method) {
            case 'pixelate': applyPixelate(ctx, x, y, w, h, Math.round(intensity / 2)); break;
            case 'blackbar': applyBlackBar(ctx, x, y, w, h);                             break;
            case 'blur':
            default:         applyBlur(ctx, x, y, w, h, intensity);                      break;
        }
    }

    // Expose only the public API of CanvasEngine
    return { applyBlur, applyPixelate, applyBlackBar, applyCensor };
})();


/* =============================================================================
   MODULE: FaceEngine
   Wraps the MediaPipe Tasks Vision FaceDetector.
   Loads the model locally to avoid CDN dependency.
   The detector instance is cached after first use to avoid reloading.
   Exposes detectFaces() which returns an array of bounding box objects.
============================================================================= */
const FaceEngine = (() => {

    /** Cached FaceDetector instance — avoid re-downloading the WASM model. */
    let _detector = null;

    /** * LOCAL paths to MediaPipe files. 
     * Paths are relative to the HTML file (tools/img/img-privacy-censor.html)
     */
    const MEDIAPIPE_MODULE_PATH = '../../assets/library/ai-engine/mediapipe/vision_bundle.mjs';
    const MEDIAPIPE_WASM_DIR    = '../../assets/library/ai-engine/mediapipe/wasm';
    const MEDIAPIPE_MODEL_PATH  = '../../assets/library/ai-engine/mediapipe/blaze_face_short_range.tflite';

    /**
     * Initialize (or return the cached) MediaPipe FaceDetector.
     * Uses the SHORT_RANGE model for best performance on portrait images.
     *
     * @returns {Promise<FaceDetector>} Initialized detector instance.
     */
    async function _getDetector() {
        if (_detector) return _detector;

        // Dynamic ES module import from local file
        const { FaceDetector, FilesetResolver } = await import(MEDIAPIPE_MODULE_PATH);

        // FilesetResolver resolves paths to local WASM binaries
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_DIR);

        // Instantiate the detector with the local blaze_face model
        _detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: MEDIAPIPE_MODEL_PATH,
                delegate: 'GPU', // Uses GPU acceleration when available; graceful CPU fallback
            },
            runningMode           : 'IMAGE', // Static image mode (not real-time video)
            minDetectionConfidence: 0.45,  // Balanced: good recall, low false positives
        });

        return _detector;
    }

    /**
     * Detect all faces in an image or canvas source element.
     * Returns an empty array on failure so the pipeline continues gracefully.
     *
     * @param {HTMLImageElement|HTMLCanvasElement} imageSource
     * @returns {Promise<Array<{x: number, y: number, w: number, h: number}>>}
     * Bounding boxes in absolute pixel coordinates.
     */
    async function detectFaces(imageSource) {
        try {
            const detector = await _getDetector();
            const result   = await detector.detect(imageSource);

            // Remap MediaPipe's boundingBox format to our internal {x, y, w, h} schema
            return (result.detections || []).map(det => {
                const bb = det.boundingBox;
                return {
                    x: Math.round(bb.originX),
                    y: Math.round(bb.originY),
                    w: Math.round(bb.width),
                    h: Math.round(bb.height),
                };
            });
        } catch (err) {
            console.error('[FaceEngine] Detection failed:', err);
            return []; // Non-fatal: return empty array so OCR phase still runs
        }
    }

    return { detectFaces };
})();


/* =============================================================================
   MODULE: OCREngine
   Wraps Tesseract.js for sensitive text detection.
   The Tesseract worker is initialised from local library assets.
   Three regex patterns detect: email addresses, phone numbers, credit cards.
   Returns an array of bounding rectangles for each match found.
============================================================================= */
const OCREngine = (() => {

    /** Cached Tesseract worker instance — expensive to re-initialize. */
    let _worker = null;

    /** * Paths to local Tesseract library assets.
     * Paths are relative to the HTML file (tools/img/img-privacy-censor.html)
     */
    const TESSERACT_WORKER_PATH = '../../assets/library/media-vision/tesseract/worker.min.js';
    const TESSERACT_CORE_PATH   = '../../assets/library/media-vision/tesseract/tesseract-core.wasm.js'; 
    const TESSERACT_LANG_DIR    = '../../assets/library/media-vision/tesseract/lang-data';

    /**
     * Sensitive data regex patterns.
     * Each RegExp uses the global flag to support multiple matches per string.
     */
    const PATTERNS = {
        email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
        phone: /(?:\+?[\d][\s\-.]?)?(?:\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]?\d{3,4}[\s\-.]?\d{0,4}/g,
        card:  /\b(?:\d[ \-]?){13,19}\b/g,
    };

    /**
     * Initialize (or return the cached) Tesseract worker.
     * Uses the globally loaded Tesseract from the <script> tag in HTML.
     *
     * @returns {Promise<Tesseract.Worker>}
     */
    async function _getWorker() {
        if (_worker) return _worker;

        _worker = await Tesseract.createWorker('eng', 1, {
            workerPath: TESSERACT_WORKER_PATH,
            corePath  : TESSERACT_CORE_PATH,
            langPath  : TESSERACT_LANG_DIR, // Forces Tesseract to load local .gz file
            logger    : m => {
                // Forward OCR progress events to the UI via a custom DOM event
                document.dispatchEvent(new CustomEvent('ocr-progress', { detail: m }));
            },
        });

        return _worker;
    }

    /**
     * Scan a canvas for sensitive text and return redaction bounding rectangles.
     * Each element in the returned array maps directly to a canvas region
     * that should be blacked out.
     *
     * @param {HTMLCanvasElement} canvas   - The source canvas to OCR-scan.
     * @param {Object}  options            - Which pattern types to detect.
     * @param {boolean} options.email      - Detect email addresses.
     * @param {boolean} options.phone      - Detect phone numbers.
     * @param {boolean} options.card       - Detect credit/debit card numbers.
     * @returns {Promise<Array<{x, y, w, h, type, text}>>} Redaction regions.
     */
    async function findSensitiveRegions(canvas, options = { email: true, phone: true, card: true }) {
        try {
            const worker = await _getWorker();

            // Run recognition with word-level bounding box data enabled
            const { data } = await worker.recognize(canvas, {}, { hocr: false, tsv: false, text: false, blocks: true });

            const regions = [];
            if (!data || !data.words) return regions;

            // Iterate over every word detected by Tesseract
            for (const word of data.words) {
                const text = word.text.trim();
                if (!text) continue;

                // ── Email detection ──
                if (options.email && PATTERNS.email.test(text)) {
                    PATTERNS.email.lastIndex = 0; // Reset stateful regex
                    regions.push({
                        x: word.bbox.x0, y: word.bbox.y0,
                        w: word.bbox.x1 - word.bbox.x0, h: word.bbox.y1 - word.bbox.y0,
                        type: 'email', text,
                    });
                }

                // ── Phone number detection — with digit count guard ──
                if (options.phone && PATTERNS.phone.test(text)) {
                    PATTERNS.phone.lastIndex = 0;
                    const digits = text.replace(/\D/g, '');
                    // Valid phone numbers contain 7–15 digits
                    if (digits.length >= 7 && digits.length <= 15) {
                        regions.push({
                            x: word.bbox.x0, y: word.bbox.y0,
                            w: word.bbox.x1 - word.bbox.x0, h: word.bbox.y1 - word.bbox.y0,
                            type: 'phone', text,
                        });
                    }
                }

                // ── Credit / debit card number detection — with digit count guard ──
                if (options.card && PATTERNS.card.test(text)) {
                    PATTERNS.card.lastIndex = 0;
                    const digits = text.replace(/\D/g, '');
                    // Valid card numbers are 13–19 digits (Visa/Mastercard/Amex/etc.)
                    if (digits.length >= 13 && digits.length <= 19) {
                        regions.push({
                            x: word.bbox.x0, y: word.bbox.y0,
                            w: word.bbox.x1 - word.bbox.x0, h: word.bbox.y1 - word.bbox.y0,
                            type: 'card', text,
                        });
                    }
                }
            }

            return regions;
        } catch (err) {
            console.error('[OCREngine] OCR failed:', err);
            return []; // Non-fatal: return empty regions so download is still possible
        }
    }

    /**
     * Terminate the Tesseract worker to free browser memory.
     * Should be called if the user clears the tool or navigates away.
     */
    async function terminate() {
        if (_worker) {
            await _worker.terminate();
            _worker = null;
        }
    }

    return { findSensitiveRegions, terminate };
})();



/* =============================================================================
   MODULE: BrushEngine
   Manages the manual Magic Brush painting tool on the main canvas.
   Supports real-time brush-cursor preview, a full undo stack (up to 20 steps),
   pointer events for both mouse and touch input, and three censor modes.
============================================================================= */
const BrushEngine = (() => {

    let _canvas    = null;
    let _ctx       = null;
    let _isActive  = false;  // Is brush mode currently enabled?
    let _isPainting = false; // Is the user actively dragging?
    let _brushSize  = 40;    // Brush diameter in pixels
    let _method     = 'blur'; // Active censor method

    // Undo stack: each entry is a full ImageData snapshot captured before a stroke
    const _undoStack = [];
    const MAX_UNDO   = 20; // Maximum number of undo levels

    /** External reference to the Undo button — toggled enabled/disabled by engine. */
    let _undoBtn = null;

    /**
     * Attach the brush engine to a canvas element and reference the undo button.
     * Registers all necessary pointer event listeners for brush interaction.
     *
     * @param {HTMLCanvasElement} canvas   - The working canvas to paint on.
     * @param {HTMLButtonElement} undoBtn  - The Undo button to enable/disable.
     */
    function init(canvas, undoBtn) {
        _canvas  = canvas;
        _ctx     = canvas.getContext('2d');
        _undoBtn = undoBtn;

        // Pointer events cover both mouse and touch input uniformly
        _canvas.addEventListener('pointerdown',   _onPointerDown);
        _canvas.addEventListener('pointermove',   _onPointerMove);
        _canvas.addEventListener('pointerup',     _onPointerUp);
        _canvas.addEventListener('pointerleave',  _onPointerLeave);
        _canvas.addEventListener('pointercancel', _onPointerUp);
    }

    /**
     * Enable brush mode.
     * Hides the default cursor so the custom brush cursor overlay takes over.
     */
    function activate()   {
        _isActive = true;
        _canvas.style.cursor = 'none';
    }

    /**
     * Disable brush mode.
     * Restores the crosshair cursor and cancels any active paint stroke.
     */
    function deactivate() {
        _isActive   = false;
        _isPainting = false;
        _canvas.style.cursor = 'crosshair';
    }

    /**
     * Update the brush diameter.
     * @param {number} size - Brush size in pixels (clamped 10–200).
     */
    function setBrushSize(size) {
        _brushSize = Math.max(10, Math.min(200, size));
    }

    /**
     * Update the active censor method.
     * @param {string} method - 'blur' | 'pixelate' | 'blackbar'
     */
    function setMethod(method) {
        _method = method;
    }

    /**
     * Convert a pointer event's client coordinates to canvas-relative coordinates.
     * Accounts for CSS scaling between the canvas's intrinsic resolution and its
     * displayed size on screen.
     *
     * @param {PointerEvent} event
     * @returns {{ x: number, y: number }} Canvas-space coordinates.
     */
    function _getCanvasPos(event) {
        const rect   = _canvas.getBoundingClientRect();
        const scaleX = _canvas.width  / rect.width;
        const scaleY = _canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top)  * scaleY,
        };
    }

    /**
     * Save a full-canvas ImageData snapshot to the undo stack.
     * Called once at the start of each new stroke (not during drag).
     * Evicts the oldest snapshot when the stack reaches MAX_UNDO.
     */
    function _saveSnapshot() {
        if (_undoStack.length >= MAX_UNDO) _undoStack.shift();
        _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
        if (_undoBtn) _undoBtn.disabled = false; // Enable the Undo button
    }

    /**
     * Undo the last brush stroke by restoring the most recent snapshot.
     * Disables the Undo button when the stack becomes empty.
     */
    function undo() {
        if (!_undoStack.length) return;
        const snapshot = _undoStack.pop();
        _ctx.putImageData(snapshot, 0, 0);
        if (_undoBtn) _undoBtn.disabled = (_undoStack.length === 0);
    }

    /**
     * Clear the entire undo history.
     * Called when a new image is loaded or the canvas is reset.
     */
    function clearHistory() {
        _undoStack.length = 0;
        if (_undoBtn) _undoBtn.disabled = true;
    }

    /**
     * Apply the active censor effect at the given canvas coordinate.
     * The brush paints a square region centred on (x, y).
     *
     * @param {number} x - Canvas X coordinate of the brush centre.
     * @param {number} y - Canvas Y coordinate of the brush centre.
     */
    function _paint(x, y) {
        const half = _brushSize / 2;
        CanvasEngine.applyCensor(
            _ctx,
            _method,
            x - half,
            y - half,
            _brushSize,
            _brushSize,
            Math.round(_brushSize / 3) // Intensity scales with brush size
        );
    }

    // ── Pointer Event Handlers ────────────────────────────────────────────────

    /**
     * pointerdown: Start a new stroke. Save a snapshot before the first paint.
     * setPointerCapture keeps the brush tracking even if the pointer leaves the element.
     */
    function _onPointerDown(e) {
        if (!_isActive) return;
        e.preventDefault();
        _isPainting = true;
        _saveSnapshot();
        _canvas.setPointerCapture(e.pointerId);
        const { x, y } = _getCanvasPos(e);
        _paint(x, y);
    }

    /**
     * pointermove: Paint continuously during drag. Also updates the brush cursor
     * overlay's visual position and size to track the pointer.
     */
    function _onPointerMove(e) {
        if (!_isActive) return;
        e.preventDefault();
        const { x, y } = _getCanvasPos(e);

        // Update the CSS brush cursor circle to follow the pointer
        const brushCursorEl = document.getElementById('brushCursor');
        if (brushCursorEl) {
            const rect   = _canvas.getBoundingClientRect();
            const scaleX = rect.width  / _canvas.width;
            const scaleY = rect.height / _canvas.height;
            brushCursorEl.style.left   = `${e.clientX - rect.left}px`;
            brushCursorEl.style.top    = `${e.clientY - rect.top}px`;
            brushCursorEl.style.width  = `${_brushSize * scaleX}px`;
            brushCursorEl.style.height = `${_brushSize * scaleY}px`;
            brushCursorEl.classList.add('visible');
        }

        if (_isPainting) _paint(x, y);
    }

    /** pointerup: End the active stroke. */
    function _onPointerUp(e) {
        if (!_isActive) return;
        _isPainting = false;
    }

    /** pointerleave: Stop painting and hide the brush cursor overlay. */
    function _onPointerLeave() {
        _isPainting = false;
        const brushCursorEl = document.getElementById('brushCursor');
        if (brushCursorEl) brushCursorEl.classList.remove('visible');
    }

    return { init, activate, deactivate, setBrushSize, setMethod, undo, clearHistory };
})();


/* =============================================================================
   MODULE: ExifEngine
   EXIF stripping is achieved by re-drawing image data to a fresh canvas and
   exporting as a PNG blob. The HTML5 Canvas API never preserves EXIF metadata
   so the exported image inherently contains zero GPS, device, or timestamp data.

   This module encapsulates and documents that behaviour, and provides a
   clean helper to export any canvas to a metadata-free blob.
============================================================================= */
const ExifEngine = (() => {

    /**
     * Export a canvas to a clean image Blob with all EXIF metadata stripped.
     * The PNG format produced by canvas.toBlob() contains no EXIF data by design.
     *
     * @param {HTMLCanvasElement} canvas
     * @param {string} [mimeType='image/png'] - Output MIME type.
     * @param {number} [quality=0.95]         - Compression quality (0–1) for JPEG.
     * @returns {Promise<Blob>} A clean image blob containing no metadata.
     */
    function exportCleanBlob(canvas, mimeType = 'image/png', quality = 0.95) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
                mimeType,
                quality
            );
        });
    }

    return { exportCleanBlob };
})();


/* =============================================================================
   MODULE: BatchEngine
   Handles multi-image processing: iterates the batch queue, applies the AI
   censor pipeline to each image on an off-screen canvas, packages all results
   into a ZIP archive with JSZip, and triggers the download via FileSaver.js.
============================================================================= */
const BatchEngine = (() => {

    /**
     * Process an array of image Files, censor each one, and download
     * all results packaged as a single ZIP archive.
     *
     * @param {File[]}   files          - Array of image File objects from the queue.
     * @param {Object}   options        - Censor settings for the batch run.
     * @param {boolean}  options.face   - Run AI face detection and blur.
     * @param {boolean}  options.ocr    - Run OCR sensitive text redaction.
     * @param {boolean}  options.exif   - Strip EXIF metadata on export.
     * @param {Function} onProgress     - Callback(processed, total, filename): updates the progress bar.
     * @param {Function} onItemStatus   - Callback(index, 'working'|'done'|'error'): updates thumbnail badge.
     */
    async function processAndDownload(files, options, onProgress, onItemStatus) {
        const zip = new JSZip();

        // Batch always uses Gaussian blur at fixed intensity for faces
        const FACE_METHOD    = 'blur';
        const FACE_INTENSITY = 20;

        // Process each file sequentially to keep memory usage bounded
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            onItemStatus(i, 'working'); // Update thumbnail badge to spinning state

            try {
                // Step 1: Load File object into an HTMLImageElement
                const imageEl = await _loadImageFile(file);

                // Step 2: Draw onto an off-screen canvas (inherently strips EXIF)
                const canvas     = document.createElement('canvas');
                canvas.width     = imageEl.naturalWidth;
                canvas.height    = imageEl.naturalHeight;
                const ctx        = canvas.getContext('2d');
                ctx.drawImage(imageEl, 0, 0);

                // Step 3: AI Face Detection and Blur/Censor
                if (options.face) {
                    const faces = await FaceEngine.detectFaces(imageEl);
                    for (const face of faces) {
                        CanvasEngine.applyCensor(ctx, FACE_METHOD, face.x, face.y, face.w, face.h, FACE_INTENSITY);
                    }
                }

                // Step 4: OCR Sensitive Text Redaction (always uses black bar)
                if (options.ocr) {
                    const regions = await OCREngine.findSensitiveRegions(canvas, {
                        email: true, phone: true, card: true,
                    });
                    for (const region of regions) {
                        CanvasEngine.applyBlackBar(ctx, region.x, region.y, region.w, region.h);
                    }
                }

                // Step 5: Export clean PNG blob (EXIF stripped inherently via toBlob)
                const blob = await ExifEngine.exportCleanBlob(canvas, 'image/png');

                // Step 6: Add to ZIP archive with a descriptive filename
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                zip.file(`${baseName}_censored.png`, blob);

                onItemStatus(i, 'done'); // Mark thumbnail as successfully processed

            } catch (err) {
                console.error(`[BatchEngine] Failed to process ${file.name}:`, err);
                onItemStatus(i, 'error'); // Mark thumbnail as failed
            }

            // Report per-file progress after each iteration
            onProgress(i + 1, files.length, file.name);
        }

        // Generate ZIP archive in memory and trigger browser download
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `privacy_censored_${Date.now()}.zip`);
    }

    /**
     * Load a File object into an HTMLImageElement, resolving when fully loaded.
     * Revokes the Object URL immediately after the image loads to free memory.
     *
     * @param {File} file
     * @returns {Promise<HTMLImageElement>}
     */
    function _loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed to load ${file.name}`)); };
            img.src     = url;
        });
    }

    return { processAndDownload };
})();


/* =============================================================================
   MODULE: UIManager
   Manages all DOM updates, overlays, tab switching, and drag-drop events.
   Keeps UI concerns separated from AI, canvas, and batch logic.
   DOM elements are cached once on init() for efficient repeated access.
============================================================================= */
const UIManager = (() => {

    /** Internal cache of DOM element references, populated by _cacheEls(). */
    const _els = {};

    /**
     * Cache all frequently accessed DOM elements by their IDs.
     * Called once during app initialization.
     */
    function _cacheEls() {
        const ids = [
            'dropZone', 'fileInput', 'batchDropZone', 'batchFileInput',
            'controlsPanel', 'mainCanvas', 'canvasOverlay', 'overlayMessage',
            'progressBar', 'progressBarContainer',
            'btnProcess', 'btnDownload', 'btnClearAll', 'btnUndo', 'btnReset',
            'toggleFace', 'faceMethod', 'faceIntensity', 'faceIntensityVal',
            'toggleOCR', 'ocrEmail', 'ocrPhone', 'ocrCard',
            'toggleBrush', 'brushSize', 'brushSizeVal', 'brushMethod',
            'toggleEXIF',
            'statsBar', 'statFaces', 'statText', 'statExif',
            'panel-single', 'panel-batch',
            'tab-single', 'tab-batch',
            'batchQueue', 'batchOptions',
            'btnBatchProcess', 'btnBatchClear',
            'batchProgressWrapper', 'batchProgressBar', 'batchProgressLabel',
            'batchFace', 'batchOCR', 'batchEXIF',
            'brushCursor', 'canvasWrapper',
        ];
        ids.forEach(id => { _els[id] = document.getElementById(id); });
    }

    /**
     * Show the canvas processing overlay with a status message.
     * The overlay blocks interaction with the canvas until dismissed.
     *
     * @param {string} message - Human-readable status line shown to the user.
     */
    function showOverlay(message = 'Processing…') {
        if (!_els['canvasOverlay']) return;
        _els['overlayMessage'].textContent = message;
        _els['canvasOverlay'].classList.add('active');
    }

    /**
     * Hide the canvas processing overlay and restore normal interaction.
     */
    function hideOverlay() {
        if (!_els['canvasOverlay']) return;
        _els['canvasOverlay'].classList.remove('active');
    }

    /**
     * Update the overlay progress bar fill width (0–100%).
     *
     * @param {number} percent - Progress value clamped to [0, 100].
     */
    function setProgress(percent) {
        if (_els['progressBar']) {
            _els['progressBar'].style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }

    /**
     * Reveal the controls panel (was hidden before the first image load).
     * Removes aria-hidden so assistive technologies can access the controls.
     */
    function showControlsPanel() {
        const panel = _els['controlsPanel'];
        if (!panel) return;
        panel.removeAttribute('aria-hidden');
        panel.style.display = '';
    }

    /**
     * Hide the controls panel and mark it as inert for assistive technologies.
     */
    function hideControlsPanel() {
        const panel = _els['controlsPanel'];
        if (!panel) return;
        panel.setAttribute('aria-hidden', 'true');
    }

    /**
     * Update the stats bar with post-processing results and animate it in.
     *
     * @param {number}  faces        - Number of faces detected and censored.
     * @param {number}  texts        - Number of sensitive text blocks redacted.
     * @param {boolean} exifStripped - Whether EXIF metadata was stripped on export.
     */
    function updateStats(faces, texts, exifStripped) {
        if (_els['statFaces']) _els['statFaces'].textContent = faces;
        if (_els['statText'])  _els['statText'].textContent  = texts;
        if (_els['statExif'])  _els['statExif'].textContent  = exifStripped ? 'EXIF: Stripped ✓' : 'EXIF: Kept';
        if (_els['statsBar'])  _els['statsBar'].classList.add('visible');
    }

    /**
     * Switch the visible tab panel between Single Image and Batch mode.
     * Updates ARIA selected state and hidden attribute for accessibility.
     *
     * @param {'single'|'batch'} mode - The target tab to activate.
     */
    function switchTab(mode) {
        const panels = ['single', 'batch'];
        panels.forEach(m => {
            const tab   = _els[`tab-${m}`];
            const panel = _els[`panel-${m}`];
            if (!tab || !panel) return;

            const isActive = (m === mode);
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));

            if (isActive) {
                panel.removeAttribute('hidden');
            } else {
                panel.setAttribute('hidden', '');
            }
        });
    }

    // Expose the public UIManager API
    return {
        init            : _cacheEls,
        showOverlay,
        hideOverlay,
        setProgress,
        showControlsPanel,
        hideControlsPanel,
        updateStats,
        switchTab,
        els             : () => _els,
    };
})();


/* =============================================================================
   MODULE: PrivacyCensorApp (Main Controller)
   Orchestrates all sub-modules. Handles user interactions and the main
   AI processing pipeline. Entrypoint: PrivacyCensorApp.init().
============================================================================= */
const PrivacyCensorApp = (() => {

    // ── Module-level State ────────────────────────────────────────────────────

    let _sourceImage   = null;  // Original HTMLImageElement (never mutated by censor ops)
    let _workingCanvas = null;  // Reference to the #mainCanvas DOM element
    let _workingCtx    = null;  // Canvas 2D rendering context
    let _isProcessing  = false; // Guard flag — prevents concurrent processing runs
    let _hasProcessed  = false; // True after at least one successful pipeline run
    let _batchFiles    = [];    // Files queued for batch processing

    // ── Initialization ────────────────────────────────────────────────────────

    /**
     * Initialize the entire application.
     * Caches DOM elements, sets up the canvas context, attaches all event
     * listeners, and detects mobile API compatibility.
     */
    function init() {
        // Initialize UIManager and cache all DOM element references
        UIManager.init();
        const els = UIManager.els();

        // Get canvas element and context (willReadFrequently = true optimises getImageData calls)
        _workingCanvas = els['mainCanvas'];
        _workingCtx    = _workingCanvas.getContext('2d', { willReadFrequently: true });

        // Attach the BrushEngine to the canvas and give it the Undo button reference
        BrushEngine.init(_workingCanvas, els['btnUndo']);

        // Register all interaction event listeners
        _bindSingleImageEvents(els);
        _bindControlEvents(els);
        _bindBatchEvents(els);
        _bindTabEvents(els);

        // Subscribe to OCR progress custom events fired by the Tesseract worker logger
        document.addEventListener('ocr-progress', _onOCRProgress);

        // Controls panel and stats bar are hidden until an image is loaded
        if (els['controlsPanel']) els['controlsPanel'].style.display = 'none';
        if (els['statsBar'])      els['statsBar'].style.display      = 'none';

        // Detect mobile browsers and warn if advanced APIs (MediaPipe WASM) may be limited
        _detectMobileLimitations();
    }

    /**
     * Detect if the user is on a mobile browser and display a soft warning
     * via the global toast system. Does not block usage — it is informational only.
     * MediaPipe WASM requires sufficient memory and WebAssembly support.
     */
    function _detectMobileLimitations() {
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            // Use the global toast — this is informational, not a fatal error
            window.showToast(
                'AI face detection may be slower on mobile. Batch mode performance depends on device memory.',
                false
            );
        }
    }

    // ── Single Image Event Bindings ───────────────────────────────────────────

    /**
     * Attach all event listeners for the Single Image tab.
     * Covers: drop zone clicks, keyboard access, drag-and-drop,
     * and the three main action button handlers.
     *
     * @param {Object} els - Cached DOM element map from UIManager.
     */
    function _bindSingleImageEvents(els) {

        // Click to open the native file picker (delegates to hidden input)
        if (els['dropZone']) {
            els['dropZone'].addEventListener('click', e => {
                if (e.target !== els['fileInput']) els['fileInput']?.click();
            });

            // Keyboard accessibility: Enter or Space triggers the file picker
            els['dropZone'].addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    els['fileInput']?.click();
                }
            });
        }

        // File input change — fires when user selects a file through the picker
        if (els['fileInput']) {
            els['fileInput'].addEventListener('change', e => {
                const file = e.target.files?.[0];
                if (file) _loadSingleImage(file);
                e.target.value = ''; // Reset so the same file can be re-selected
            });
        }

        // Drag-and-drop: visual feedback on dragenter/dragover
        if (els['dropZone']) {
            ['dragenter', 'dragover'].forEach(evt => {
                els['dropZone'].addEventListener(evt, e => {
                    e.preventDefault();
                    els['dropZone'].classList.add('dragover');
                });
            });
            ['dragleave', 'dragend'].forEach(evt => {
                els['dropZone'].addEventListener(evt, () => {
                    els['dropZone'].classList.remove('dragover');
                });
            });

            // Drop: extract the first dropped image file
            els['dropZone'].addEventListener('drop', e => {
                e.preventDefault();
                els['dropZone'].classList.remove('dragover');
                const file = e.dataTransfer?.files?.[0];
                if (file && file.type.startsWith('image/')) {
                    _loadSingleImage(file);
                } else {
                    window.showToast('Please drop a valid image file.', false);
                }
            });
        }

        // Action buttons — all linked directly to their handler functions
        els['btnProcess']?.addEventListener('click',  _runProcessingPipeline);
        els['btnDownload']?.addEventListener('click', _downloadResult);
        els['btnClearAll']?.addEventListener('click', _clearAll);
        els['btnReset']?.addEventListener('click',    _resetToSource);
        els['btnUndo']?.addEventListener('click',     () => BrushEngine.undo());
    }

    // ── Control Panel Event Bindings ──────────────────────────────────────────

    /**
     * Attach event listeners for the censor control panel widgets:
     * intensity slider, brush size slider, brush method select, and brush toggle.
     *
     * @param {Object} els - Cached DOM element map from UIManager.
     */
    function _bindControlEvents(els) {

        // Face intensity slider — update the live numeric label on every input
        els['faceIntensity']?.addEventListener('input', () => {
            if (els['faceIntensityVal']) {
                els['faceIntensityVal'].textContent = els['faceIntensity'].value;
            }
        });

        // Brush size slider — update the live label and inform BrushEngine
        els['brushSize']?.addEventListener('input', () => {
            const size = parseInt(els['brushSize'].value, 10);
            if (els['brushSizeVal']) els['brushSizeVal'].textContent = size;
            BrushEngine.setBrushSize(size);

            // Synchronise the brush cursor overlay size with the new brush diameter
            if (els['brushCursor']) {
                els['brushCursor'].style.width  = `${size}px`;
                els['brushCursor'].style.height = `${size}px`;
            }
        });

        // Brush method dropdown — inform BrushEngine of the selected censor mode
        els['brushMethod']?.addEventListener('change', () => {
            BrushEngine.setMethod(els['brushMethod'].value);
        });

        // Brush toggle — activate or deactivate brush mode with user feedback
        els['toggleBrush']?.addEventListener('change', () => {
            if (els['toggleBrush'].checked) {
                BrushEngine.activate();
                window.showToast('Magic Brush activated — paint over areas to censor.', false);
            } else {
                BrushEngine.deactivate();
            }
        });
    }

    // ── Batch Event Bindings ──────────────────────────────────────────────────

    /**
     * Attach event listeners for the Batch Mode tab.
     * Covers: batch drop zone, file input, and batch action buttons.
     *
     * @param {Object} els - Cached DOM element map from UIManager.
     */
    function _bindBatchEvents(els) {

        if (els['batchDropZone']) {
            // Click to open native multi-file picker
            els['batchDropZone'].addEventListener('click', e => {
                if (e.target !== els['batchFileInput']) els['batchFileInput']?.click();
            });

            // Drag-and-drop visual feedback
            ['dragenter', 'dragover'].forEach(evt => {
                els['batchDropZone'].addEventListener(evt, e => {
                    e.preventDefault();
                    els['batchDropZone'].classList.add('dragover');
                });
            });
            ['dragleave', 'dragend'].forEach(evt => {
                els['batchDropZone'].addEventListener(evt, () => {
                    els['batchDropZone'].classList.remove('dragover');
                });
            });

            // Drop: add all dropped image files to the batch queue
            els['batchDropZone'].addEventListener('drop', e => {
                e.preventDefault();
                els['batchDropZone'].classList.remove('dragover');
                _addBatchFiles(Array.from(e.dataTransfer?.files || []));
            });
        }

        // Batch file input change — adds selected files to the queue
        els['batchFileInput']?.addEventListener('change', e => {
            _addBatchFiles(Array.from(e.target.files || []));
            e.target.value = ''; // Reset so the same files can be re-selected
        });

        // Batch action buttons
        els['btnBatchProcess']?.addEventListener('click', _runBatchProcess);
        els['btnBatchClear']?.addEventListener('click',   _clearBatchQueue);
    }

    // ── Tab Switching ─────────────────────────────────────────────────────────

    /**
     * Attach click listeners to the mode-tab buttons.
     * Each tab reads its data-mode attribute and delegates to UIManager.switchTab().
     *
     * @param {Object} els - Cached DOM element map from UIManager.
     */
    function _bindTabEvents(els) {
        document.querySelectorAll('.pct-mode-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                UIManager.switchTab(tab.dataset.mode);
            });
        });
    }

    // ── Image Loading ─────────────────────────────────────────────────────────

    /**
     * Load a single image File onto the working canvas.
     * Hides the drop zone, shows the canvas wrapper, and reveals the controls panel.
     *
     * @param {File} file - The image file to load.
     */
    function _loadSingleImage(file) {
        if (!file.type.startsWith('image/')) {
            window.showToast('Invalid file type. Please upload an image.', true);
            return;
        }

        // Reset per-image state for the new load
        _hasProcessed = false;
        BrushEngine.clearHistory();
        UIManager.els()['btnDownload']?.setAttribute('disabled', '');
        UIManager.els()['statsBar']?.classList.remove('visible');

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);
            _sourceImage = img; // Cache the immutable source for resets

            // Size the working canvas to the image's natural (intrinsic) dimensions
            _workingCanvas.width  = img.naturalWidth;
            _workingCanvas.height = img.naturalHeight;

            // Draw the source image to the canvas as the initial state
            _workingCtx.drawImage(img, 0, 0);

            // Show the controls panel now that an image is loaded
            UIManager.showControlsPanel();

            // Swap: hide drop zone, show canvas wrapper
            const els = UIManager.els();
            if (els['dropZone'])      els['dropZone'].style.display     = 'none';
            if (els['canvasWrapper']) els['canvasWrapper'].style.display = '';

            window.showToast(`Image loaded: ${img.naturalWidth}×${img.naturalHeight}px`, false);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            window.showToast('Failed to load image. The file may be corrupted.', true);
        };

        img.src = url;
    }

    // ── Main AI Processing Pipeline ───────────────────────────────────────────

    /**
     * Orchestrate the full AI Privacy Censor pipeline:
     *   1. Reset canvas to the clean source image.
     *   2. AI Face Detection (MediaPipe) — blur/pixelate/blackbar all faces.
     *   3. OCR Text Redaction (Tesseract) — black-bar all sensitive text regions.
     *   4. Update stats bar with results.
     *   5. Enable the Download button.
     *
     * A guard flag prevents re-entrant calls if the user double-clicks.
     */
    async function _runProcessingPipeline() {
        if (_isProcessing) return;

        if (!_sourceImage) {
            window.showToast('Please upload an image first.', false);
            return;
        }

        _isProcessing = true;
        let facesFound = 0, textsFound = 0;
        const els = UIManager.els();

        try {
            UIManager.showOverlay('Resetting canvas…');
            UIManager.setProgress(5);

            // Step 1: Re-draw the original source image to clear any previous run
            _workingCtx.clearRect(0, 0, _workingCanvas.width, _workingCanvas.height);
            _workingCtx.drawImage(_sourceImage, 0, 0);
            BrushEngine.clearHistory();

            // ── FACE DETECTION PHASE ──────────────────────────────────────────

            if (els['toggleFace']?.checked) {
                UIManager.showOverlay('Loading AI face detection model…');
                UIManager.setProgress(10);

                const faces = await FaceEngine.detectFaces(_sourceImage);
                facesFound  = faces.length;
                UIManager.setProgress(40);

                if (faces.length > 0) {
                    UIManager.showOverlay(`Censoring ${faces.length} face(s)…`);
                    const method    = els['faceMethod']?.value          || 'blur';
                    const intensity = parseInt(els['faceIntensity']?.value || '20', 10);

                    for (const face of faces) {
                        // Expand the bounding box by 10% on all sides to ensure full coverage
                        const pad = Math.round(Math.min(face.w, face.h) * 0.10);
                        CanvasEngine.applyCensor(
                            _workingCtx,
                            method,
                            face.x - pad,
                            face.y - pad,
                            face.w + pad * 2,
                            face.h + pad * 2,
                            intensity
                        );
                    }
                    window.showToast(`✓ ${faces.length} face(s) detected and censored.`, false);
                } else {
                    window.showToast('No faces detected in this image.', false);
                }
            }

            UIManager.setProgress(50);

            // ── OCR TEXT REDACTION PHASE ──────────────────────────────────────

            if (els['toggleOCR']?.checked) {
                UIManager.showOverlay('Running OCR text scan… (this may take 15–30 seconds)');
                UIManager.setProgress(55);

                const ocrOptions = {
                    email : els['ocrEmail']?.checked ?? true,
                    phone : els['ocrPhone']?.checked ?? true,
                    card  : els['ocrCard']?.checked  ?? true,
                };

                // Only invoke OCR if at least one target pattern type is selected
                if (ocrOptions.email || ocrOptions.phone || ocrOptions.card) {
                    const regions = await OCREngine.findSensitiveRegions(_workingCanvas, ocrOptions);
                    textsFound    = regions.length;
                    UIManager.setProgress(88);

                    if (regions.length > 0) {
                        UIManager.showOverlay(`Redacting ${regions.length} sensitive text block(s)…`);
                        for (const region of regions) {
                            // Always use black bar for text redaction — maximally legible redaction
                            CanvasEngine.applyBlackBar(_workingCtx, region.x, region.y, region.w, region.h);
                        }
                        window.showToast(`✓ ${regions.length} text block(s) redacted.`, false);
                    } else {
                        window.showToast('No sensitive text patterns found in image.', false);
                    }
                } else {
                    window.showToast('Select at least one OCR target type (Email, Phone, Card).', false);
                }
            }

            UIManager.setProgress(95);

            // ── COMPLETION ────────────────────────────────────────────────────

            const exifStripped = els['toggleEXIF']?.checked ?? true;

            // Populate and reveal the stats bar
            UIManager.updateStats(facesFound, textsFound, exifStripped);
            if (els['statsBar']) els['statsBar'].style.display = '';

            // Enable the Download button
            els['btnDownload']?.removeAttribute('disabled');

            _hasProcessed = true;
            UIManager.setProgress(100);
            UIManager.hideOverlay();

            window.showToast('AI Censor complete! Use Magic Brush for final touch-ups.', false);

        } catch (err) {
            console.error('[PrivacyCensorApp] Processing pipeline error:', err);
            window.showToast('An error occurred during processing. See console for details.', true);
            UIManager.hideOverlay();
        } finally {
            _isProcessing = false; // Always release the guard, even on error
        }
    }

    // ── OCR Progress Handler ──────────────────────────────────────────────────

    /**
     * Handle OCR progress custom events dispatched by the Tesseract worker logger.
     * Maps Tesseract's internal status strings to human-readable overlay messages
     * and updates the progress bar proportionally within the OCR phase (55–90%).
     *
     * @param {CustomEvent} e - Event with detail: { status: string, progress: number }
     */
    function _onOCRProgress(e) {
        const msg      = e.detail;
        // Map OCR progress value (0–1) into the 55–90% band of the overall progress
        const pct      = msg.progress ? Math.round(msg.progress * 35) + 55 : null;
        const statusMap = {
            'loading tesseract core'        : 'Loading OCR engine…',
            'loading language traineddata'  : 'Loading language model…',
            'initializing tesseract'        : 'Initializing Tesseract…',
            'recognizing text'              : 'Scanning image for text…',
        };

        const displayMsg = statusMap[msg.status] || `OCR: ${msg.status}`;
        UIManager.showOverlay(displayMsg);
        if (pct !== null) UIManager.setProgress(pct);
    }

    // ── Download Result ───────────────────────────────────────────────────────

    /**
     * Export the current working canvas as a clean PNG blob (EXIF stripped
     * inherently by the Canvas API) and trigger a browser file download.
     */
    async function _downloadResult() {
        if (!_workingCanvas || _workingCanvas.width === 0) {
            window.showToast('Nothing to download yet.', false);
            return;
        }

        try {
            const stripExif = UIManager.els()['toggleEXIF']?.checked ?? true;

            // canvas.toBlob() always produces a metadata-free PNG
            const blob = await ExifEngine.exportCleanBlob(_workingCanvas, 'image/png');
            saveAs(blob, `censored_image_${Date.now()}.png`);

            window.showToast(
                stripExif
                    ? 'Image downloaded with all EXIF metadata stripped.'
                    : 'Image downloaded.',
                false
            );
        } catch (err) {
            console.error('[PrivacyCensorApp] Download failed:', err);
            window.showToast('Download failed. Please try again.', true);
        }
    }

    // ── Reset Canvas to Source ────────────────────────────────────────────────

    /**
     * Re-draw the original source image onto the canvas, discarding all censor layers
     * and brush strokes. Resets the undo stack and disables the Download button.
     */
    function _resetToSource() {
        if (!_sourceImage) return;
        _workingCtx.clearRect(0, 0, _workingCanvas.width, _workingCanvas.height);
        _workingCtx.drawImage(_sourceImage, 0, 0);
        BrushEngine.clearHistory();
        UIManager.els()['btnDownload']?.setAttribute('disabled', '');
        UIManager.els()['statsBar']?.classList.remove('visible');
        _hasProcessed = false;
        window.showToast('Canvas reset to original image.', false);
    }

    // ── Clear Everything ──────────────────────────────────────────────────────

    /**
     * Completely clear the tool state: source image, canvas, brush history,
     * and all UI elements. Returns the tool to its initial empty state.
     */
    function _clearAll() {
        _sourceImage  = null;
        _hasProcessed = false;

        // Wipe the canvas content and collapse its dimensions
        _workingCtx.clearRect(0, 0, _workingCanvas.width, _workingCanvas.height);
        _workingCanvas.width  = 0;
        _workingCanvas.height = 0;
        BrushEngine.clearHistory();
        BrushEngine.deactivate();

        // Reset all UI elements to their initial (pre-image) state
        const els = UIManager.els();
        if (els['toggleBrush']) els['toggleBrush'].checked = false;
        if (els['dropZone'])    els['dropZone'].style.display = '';
        UIManager.hideControlsPanel();
        if (els['controlsPanel']) els['controlsPanel'].style.display = 'none';
        if (els['statsBar']) {
            els['statsBar'].classList.remove('visible');
            els['statsBar'].style.display = 'none';
        }
        els['btnDownload']?.setAttribute('disabled', '');

        window.showToast('Canvas cleared. Ready for a new image.', false);
    }

    // ── Batch Processing ──────────────────────────────────────────────────────

    /**
     * Validate and add an array of Files to the batch queue.
     * Filters to image files only, enforces the 20-image limit,
     * renders a thumbnail card for each, and reveals the options panel.
     *
     * @param {File[]} files - Array of File objects (may include non-images).
     */
    function _addBatchFiles(files) {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (!imageFiles.length) {
            window.showToast('Please select image files.', false);
            return;
        }

        const MAX_BATCH = 20;
        const remaining = MAX_BATCH - _batchFiles.length;
        if (remaining <= 0) {
            window.showToast(`Batch limit is ${MAX_BATCH} images.`, false);
            return;
        }

        // Respect the remaining capacity — silently truncate excess files
        const filesToAdd = imageFiles.slice(0, remaining);
        filesToAdd.forEach(file => {
            _batchFiles.push(file);
            _renderBatchItem(file, _batchFiles.length - 1);
        });

        // Reveal the batch options section now that files are in the queue
        const els = UIManager.els();
        if (els['batchOptions']) {
            els['batchOptions'].removeAttribute('aria-hidden');
            els['batchOptions'].style.display = '';
        }

        window.showToast(`${filesToAdd.length} image(s) added to batch queue.`, false);
    }

    /**
     * Render a thumbnail card for a single batch queue item.
     * Each card contains the image preview, filename overlay, status badge,
     * and a remove button. Appended to the #batchQueue element.
     *
     * @param {File}   file  - The image file to render.
     * @param {number} index - The file's index in the _batchFiles array.
     */
    function _renderBatchItem(file, index) {
        const queueEl = UIManager.els()['batchQueue'];
        if (!queueEl) return;

        const url  = URL.createObjectURL(file);
        const item = document.createElement('div');
        item.className    = 'batch-item';
        item.dataset.index = index;

        item.innerHTML = `
            <img src="${url}" alt="${file.name}" loading="lazy">
            <div class="batch-item-overlay">
                <span class="batch-item-name">${file.name}</span>
            </div>
            <div class="batch-item-status pending" id="batch-status-${index}" aria-label="Pending">
                <i class="fa-solid fa-clock"></i>
            </div>
            <button class="batch-item-remove" aria-label="Remove ${file.name}" data-remove-index="${index}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        // Attach remove button listener immediately after injection
        item.querySelector('[data-remove-index]')?.addEventListener('click', e => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.removeIndex, 10);
            _removeBatchItem(idx, item, url);
        });

        queueEl.appendChild(item);
        URL.revokeObjectURL(url); // The <img> has loaded it — URL no longer needed
    }

    /**
     * Remove a single item from the batch queue array and its DOM card.
     * Hides the batch options panel when the queue becomes empty.
     *
     * @param {number}      index    - Index in _batchFiles to remove.
     * @param {HTMLElement} domEl    - The batch-item DOM element to remove.
     * @param {string}      objectUrl - Object URL to revoke (if not already revoked).
     */
    function _removeBatchItem(index, domEl, objectUrl) {
        _batchFiles.splice(index, 1);
        domEl.remove();

        if (_batchFiles.length === 0) {
            const els = UIManager.els();
            if (els['batchOptions']) els['batchOptions'].style.display = 'none';
        }
    }

    /**
     * Clear the entire batch queue — resets the file array, empties the DOM grid,
     * and hides the batch options panel.
     */
    function _clearBatchQueue() {
        _batchFiles = [];
        const els = UIManager.els();
        if (els['batchQueue'])   els['batchQueue'].innerHTML = '';
        if (els['batchOptions']) els['batchOptions'].style.display = 'none';
        window.showToast('Batch queue cleared.', false);
    }

    /**
     * Update the status badge on a specific batch thumbnail card.
     * Maps status string to the appropriate icon class.
     *
     * @param {number} index  - Index of the batch item in the queue.
     * @param {'pending'|'working'|'done'|'error'} status - New status to apply.
     */
    function _updateBatchItemStatus(index, status) {
        const el = document.getElementById(`batch-status-${index}`);
        if (!el) return;

        const iconMap = {
            pending : 'fa-clock',
            working : 'fa-spinner fa-spin',
            done    : 'fa-check',
            error   : 'fa-xmark',
        };

        el.className = `batch-item-status ${status}`;
        el.innerHTML = `<i class="fa-solid ${iconMap[status] || 'fa-clock'}"></i>`;
    }

    /**
     * Run the full batch processing pipeline.
     * Reads options from the batch settings checkboxes, shows the progress bar,
     * and delegates per-file processing to BatchEngine.processAndDownload().
     */
    async function _runBatchProcess() {
        if (!_batchFiles.length) {
            window.showToast('Batch queue is empty. Add images first.', false);
            return;
        }

        if (_isProcessing) return;
        _isProcessing = true;

        const els     = UIManager.els();
        const options = {
            face : els['batchFace']?.checked ?? true,
            ocr  : els['batchOCR']?.checked  ?? true,
            exif : els['batchEXIF']?.checked  ?? true,
        };

        // Show the batch progress section
        if (els['batchProgressWrapper']) {
            els['batchProgressWrapper'].classList.add('active');
        }

        try {
            await BatchEngine.processAndDownload(
                _batchFiles,
                options,
                // onProgress callback — updates the batch progress bar and label
                (processed, total, filename) => {
                    const pct = Math.round((processed / total) * 100);
                    if (els['batchProgressBar'])  els['batchProgressBar'].style.width = `${pct}%`;
                    if (els['batchProgressLabel']) {
                        els['batchProgressLabel'].textContent = `Processing ${processed}/${total}: ${filename}`;
                    }
                },
                // onItemStatus callback — updates individual thumbnail status badges
                (index, status) => _updateBatchItemStatus(index, status)
            );

            window.showToast('Batch complete! ZIP archive downloaded.', false);

        } catch (err) {
            console.error('[PrivacyCensorApp] Batch processing error:', err);
            window.showToast('Batch processing failed. See console for details.', true);
        } finally {
            _isProcessing = false;

            // Update the label to show completion regardless of success/failure
            if (els['batchProgressLabel']) {
                els['batchProgressLabel'].textContent = 'Complete!';
            }
        }
    }

    // Expose only the init entrypoint — all other methods are internal
    return { init };

})();


/* =============================================================================
   BOOTSTRAP
   Wait for the DOM to be fully parsed before initializing the app.
   requestAnimationFrame defers execution by one frame so that global.js
   (which mounts the header, footer, and toast container) finishes first.
============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
        try {
            PrivacyCensorApp.init();
        } catch (err) {
            console.error('[PrivacyCensorApp] Initialization failed:', err);
        }
    });
});
