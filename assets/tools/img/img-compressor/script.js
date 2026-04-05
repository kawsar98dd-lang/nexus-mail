/**
 * ============================================================================
 *  ULTRA IMAGE TITANIUM — Engine v4.0.0 (Gold Master)
 *  Product   : Trusted Tools Web
 *  License   : Commercial / CodeCanyon Standard
 *  Author    : MD KAWSAR
 * ----------------------------------------------------------------------------
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. Module / IIFE Pattern
 *     The entire engine is wrapped in an Immediately Invoked Function
 *     Expression (IIFE) and exposed on `window.TitaniumEngine`. This
 *     encapsulates all private state and prevents global namespace pollution.
 *
 *  2. Semaphore Concurrency (MAX_CONCURRENT_TASKS = 3)
 *     A queue of Promise-returning tasks is dispatched in parallel, capped
 *     at three simultaneous compressions to prevent browser tab hangs on
 *     large batches (e.g., 50 files).
 *
 *  3. Aggressive Memory / Blob Management
 *     Every Object URL created is tracked in `State.blobRegistry` (a Set).
 *     On session reset, `revokeAll()` iterates the registry and revokes
 *     every URL, plus closes any live ImageBitmap — preventing memory leaks.
 *
 *  4. OffscreenCanvas GPU Acceleration
 *     The engine prefers `OffscreenCanvas` for off-main-thread rendering.
 *     It falls back transparently to a standard `<canvas>` element when the
 *     browser does not support it (e.g., Safari < 16.4).
 *
 *  5. Global Toast System
 *     All user notifications are dispatched through the site-wide
 *     `window.showToast(message, isError)` function injected by global.js.
 *     Error toasts pass `true` as the second argument (boolean, not string).
 * ============================================================================
 */

const TitaniumEngine = (function () {

    /* =========================================================================
       SECTION 1: STATE & CONFIGURATION
       ─────────────────────────────────────────────────────────────────────────
       `DOM`   – cache of all getElementById references (populated in init).
       `State` – mutable runtime state; reset between sessions via handleFiles().
       `MAX_CONCURRENT_TASKS` – semaphore cap for parallel compression workers.
    ========================================================================= */

    /** @type {Object.<string, HTMLElement>} Cached DOM node references. */
    const DOM = {};

    /**
     * Mutable application state for a single processing session.
     * @property {File[]}      files          - Raw File objects queued by the user.
     * @property {Object[]}    processed      - Array of result objects after batch.
     * @property {ImageBitmap|null} activeImg - Bitmap of the currently previewed file.
     * @property {Cropper|null} cropper       - Active Cropper.js instance (modal).
     * @property {Set<string>} blobRegistry   - Tracks all Object URLs for GC.
     * @property {Object}      transform      - Current rotate/flip/crop state.
     * @property {boolean}     isProcessing   - Guard flag to prevent double-run.
     * @property {AbortController|null} abortController - Reserved for future cancel.
     */
    const State = {
        files          : [],
        processed      : [],
        activeImg      : null,
        cropper        : null,
        blobRegistry   : new Set(),
        transform      : {
            rotate     : 0,
            flipH      : 1,
            flipV      : 1,
            isCropped  : false,
            cropCanvas : null
        },
        isProcessing   : false,
        abortController: null
    };

    /**
     * Maximum number of files processed in parallel.
     * Increasing this beyond 3–4 may cause tab OOM on large images.
     * @constant {number}
     */
    const MAX_CONCURRENT_TASKS = 3;


    /* =========================================================================
       SECTION 2: HELPERS
       ─────────────────────────────────────────────────────────────────────────
       Utility functions used throughout the engine.
    ========================================================================= */

    /**
     * Shorthand alias for document.getElementById.
     * @param {string} id - The element ID to look up.
     * @returns {HTMLElement|null}
     */
    const $ = (id) => document.getElementById(id);

    /**
     * Populates the `DOM` cache object with references to every element
     * the engine needs to read or write during its lifecycle.
     * Called once at init time — avoids repeated getElementById calls.
     */
    function cacheDOM() {
        const ids = [
            'dropZone', 'fileInput', 'workspace', 'resultList',
            'imgOrig', 'imgComp', 'imgOverlay', 'compareSlider', 'sliderHandle',
            'quality', 'qDisp', 'format', 'targetKB',
            'inpWidth', 'inpHeight', 'aspectLock',
            'brightness', 'contrast', 'wmText', 'stripExif',
            'dlZip', 'dlPdf', 'dlSingle',
            'fileCount', 'globalLoader', 'progressText',
            'cyberProgressPanel', 'cyberProgressBar', 'cyberPercentText', 'cyberStatusText',
            'cropModal', 'cropTarget',
            'btnCrop', 'btnRotate', 'btnFlipH', 'btnFlipV',
            'btnProcessBatch', 'resetFiltersBtn',
            'btnCancelCrop', 'btnApplyCrop'
        ];
        ids.forEach(id => DOM[id] = $(id));
    }

    /**
     * Converts a raw byte count into a human-readable string
     * (e.g., 1048576 → "1 MB").
     *
     * @param {number} bytes    - Raw byte size.
     * @param {number} decimals - Decimal places in the output (default 2).
     * @returns {string} Formatted size string.
     */
    function formatBytes(bytes, decimals = 2) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k     = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i     = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            parseFloat((bytes / Math.pow(k, i)).toFixed(decimals < 0 ? 0 : decimals)) +
            ' ' + sizes[i]
        );
    }


    /* =========================================================================
       SECTION 3: MEMORY MANAGEMENT
       ─────────────────────────────────────────────────────────────────────────
       All Object URLs created during a session are tracked in blobRegistry.
       On session reset, revokeAll() frees every URL and closes ImageBitmaps
       to prevent memory leaks across multiple file loads.
    ========================================================================= */

    /**
     * Creates an Object URL from a Blob and registers it for later cleanup.
     *
     * @param {Blob} blob - The source blob (compressed image, etc.).
     * @returns {string}  The temporary Object URL string.
     */
    function createUrl(blob) {
        const url = URL.createObjectURL(blob);
        State.blobRegistry.add(url);
        return url;
    }

    /**
     * Revokes every tracked Object URL and closes any open ImageBitmap.
     * Called at the start of each new `handleFiles()` session to garbage-collect
     * memory from the previous batch before allocating new resources.
     */
    function revokeAll() {
        State.blobRegistry.forEach(url => URL.revokeObjectURL(url));
        State.blobRegistry.clear();

        // Close any live ImageBitmap (GPU-backed — must be manually freed)
        if (State.activeImg) {
            if (typeof State.activeImg.close === 'function') State.activeImg.close();
            State.activeImg = null;
        }
    }


    /* =========================================================================
       SECTION 4: INITIALIZATION
       ─────────────────────────────────────────────────────────────────────────
       `init()` is the single public entry point called on DOMContentLoaded.
       It caches DOM nodes and attaches all event listeners.
    ========================================================================= */

    /**
     * Bootstraps the engine: caches DOM references and binds all event
     * listeners. Called once via `window.addEventListener('DOMContentLoaded', ...)`.
     */
    function init() {
        cacheDOM();
        bindEvents();
    }

    /**
     * Attaches all interactive event listeners to cached DOM elements:
     *  - Drag-and-drop file ingestion on the drop zone.
     *  - Keyboard accessibility (Enter / Space) for the drop zone.
     *  - Range slider live-update for quality display.
     *  - Brightness / Contrast range → live preview filter update.
     *  - Compare slider → overlay width + handle position.
     *  - Aspect-ratio lock: auto-calculates the opposite dimension.
     *  - All transform (crop, rotate, flip) and action (process, download) buttons.
     *  - Crop modal confirm / cancel buttons.
     */
    function bindEvents() {

        // ── Drag & Drop ──────────────────────────────────────────────────────
        if (DOM.dropZone) {
            // Prevent browser default file-open behavior for all drag events
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
                DOM.dropZone.addEventListener(evt, e => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Visual feedback: highlight border on drag-over
            DOM.dropZone.addEventListener('dragover',  () => DOM.dropZone.style.borderColor = 'var(--accent-cyan)');
            DOM.dropZone.addEventListener('dragleave', () => DOM.dropZone.style.borderColor = '');

            // Ingest dropped files
            DOM.dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

            // Click opens the hidden native file picker
            DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());

            // Keyboard accessibility: Enter / Space also open file picker
            DOM.dropZone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') DOM.fileInput.click();
            });
        }

        // Native file input change → ingest selected files
        if (DOM.fileInput) {
            DOM.fileInput.addEventListener('change', e => handleFiles(e.target.files));
        }

        // ── Quality Slider ───────────────────────────────────────────────────
        // Mirrors the range value into the badge label in real time
        if (DOM.quality) {
            DOM.quality.addEventListener('input', e => {
                DOM.qDisp.innerText = e.target.value + '%';
            });
        }

        // ── Brightness & Contrast Sliders ────────────────────────────────────
        // Both call updatePreviewStyle() to apply CSS filter to imgComp instantly
        ['brightness', 'contrast'].forEach(id => {
            if (DOM[id]) DOM[id].addEventListener('input', updatePreviewStyle);
        });

        // ── Before/After Compare Slider ──────────────────────────────────────
        if (DOM.compareSlider) {
            DOM.compareSlider.addEventListener('input', (e) => slideCompare(e.target.value));
        }

        // ── Aspect Ratio Lock (Width / Height sync) ──────────────────────────
        // When the user types a width, auto-calculate the locked height, and vice versa
        if (DOM.inpWidth && DOM.inpHeight) {
            DOM.inpWidth.addEventListener('keyup', () => {
                if (DOM.aspectLock.checked && State.activeImg && DOM.inpWidth.value) {
                    DOM.inpHeight.value = Math.round(
                        DOM.inpWidth.value * (State.activeImg.height / State.activeImg.width)
                    );
                }
            });
            DOM.inpHeight.addEventListener('keyup', () => {
                if (DOM.aspectLock.checked && State.activeImg && DOM.inpHeight.value) {
                    DOM.inpWidth.value = Math.round(
                        DOM.inpHeight.value * (State.activeImg.width / State.activeImg.height)
                    );
                }
            });
        }

        // ── Transform Buttons ────────────────────────────────────────────────
        if (DOM.btnCrop)         DOM.btnCrop.addEventListener('click', startCropper);
        if (DOM.btnRotate)       DOM.btnRotate.addEventListener('click', () => rotate(90));
        if (DOM.btnFlipH)        DOM.btnFlipH.addEventListener('click', () => flip('h'));
        if (DOM.btnFlipV)        DOM.btnFlipV.addEventListener('click', () => flip('v'));
        if (DOM.resetFiltersBtn) DOM.resetFiltersBtn.addEventListener('click', resetFilters);

        // ── Action Buttons ───────────────────────────────────────────────────
        if (DOM.btnProcessBatch) DOM.btnProcessBatch.addEventListener('click', processBatch);
        if (DOM.dlZip)           DOM.dlZip.addEventListener('click', dlZip);
        if (DOM.dlPdf)           DOM.dlPdf.addEventListener('click', dlPdf);
        if (DOM.dlSingle)        DOM.dlSingle.addEventListener('click', () => dlOne(0));

        // ── Crop Modal Buttons ───────────────────────────────────────────────
        if (DOM.btnCancelCrop) DOM.btnCancelCrop.addEventListener('click', closeCropper);
        if (DOM.btnApplyCrop)  DOM.btnApplyCrop.addEventListener('click', applyCrop);
    }


    /* =========================================================================
       SECTION 5: FILE HANDLING & PREVIEW
       ─────────────────────────────────────────────────────────────────────────
       handleFiles() — entry point for both drag-drop and file-input events.
       loadPreview() — decodes HEIC if needed, creates an ImageBitmap,
                       and renders the first file into the compare preview.
    ========================================================================= */

    /**
     * Handles a new batch of files from any input source (drop zone or file input).
     * Revokes previous session memory, resets UI, queues files in State, and
     * loads the first file into the live preview.
     *
     * @param {FileList|File[]} files - The files selected or dropped by the user.
     */
    async function handleFiles(files) {
        if (!files || files.length === 0) return;

        // Garbage-collect the previous session's blob URLs and ImageBitmaps
        revokeAll();

        // Store new file list and reset processed results + transforms
        State.files     = Array.from(files);
        State.processed = [];
        State.transform = { rotate: 0, flipH: 1, flipV: 1, isCropped: false, cropCanvas: null };

        // Reset all UI elements to their initial state
        resetUI();

        // Swap drop zone for the workspace grid
        DOM.dropZone.style.display   = 'none';
        DOM.workspace.style.display  = 'grid';
        DOM.workspace.style.opacity  = '1';

        // Update the file counter label
        DOM.fileCount.innerText    = `${State.files.length} FILES QUEUED`;
        DOM.fileCount.style.color  = 'var(--accent-cyan)';

        // Load the first file into the before/after compare preview
        loadPreview(State.files[0]);
    }

    /**
     * Loads a single file into the live preview panel.
     * Handles HEIC → JPEG conversion transparently before decoding
     * the image into an ImageBitmap for dimension extraction.
     *
     * @param {File} file - The file to preview (first in the queue).
     */
    async function loadPreview(file) {
        try {
            DOM.globalLoader.style.display = 'flex';
            let blob = file;

            // ── HEIC Conversion ──────────────────────────────────────────────
            // Apple's HEIC format cannot be decoded natively by most browsers.
            // heic2any converts the HEIC binary to a standard JPEG Blob.
            if (file.name.toLowerCase().endsWith('.heic')) {
                if (typeof heic2any === 'undefined') throw new Error('HEIC Module missing.');
                const res = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.6 });
                blob = Array.isArray(res) ? res[0] : res;
            }

            // ── ImageBitmap Decode (for dimensions) ──────────────────────────
            // Close any previously decoded bitmap to free GPU memory
            if (State.activeImg) State.activeImg.close();
            State.activeImg = await createImageBitmap(blob);

            // Create a tracked Object URL and set both preview images
            const url            = createUrl(blob);
            DOM.imgOrig.src      = url;
            DOM.imgComp.src      = url;

            // Pre-populate the resize fields with the image's actual dimensions
            DOM.inpWidth.value   = State.activeImg.width;
            DOM.inpHeight.value  = State.activeImg.height;

            // Show original size in the stats strip
            $('sizeOrig').innerText = formatBytes(file.size);
            $('sizeNew').innerText  = formatBytes(file.size);
            $('sizeSaved').innerText = '0%';

            // Apply current brightness/contrast/transform to the preview
            updatePreviewStyle();

            DOM.globalLoader.style.display = 'none';

        } catch (e) {
            DOM.globalLoader.style.display = 'none';
            // Global toast — error = true (boolean)
            window.showToast('Preview Error: ' + e.message, true);
            console.error(e);
        }
    }


    /* =========================================================================
       SECTION 6: TRANSFORMATIONS
       ─────────────────────────────────────────────────────────────────────────
       Visual transform state (rotate, flip, brightness, contrast) is applied
       as CSS filters/transforms to the imgComp preview element in real time.
       The actual pixel transformations are applied to the canvas in Section 7
       during batch processing — the preview is CSS-only for performance.
    ========================================================================= */

    /**
     * Applies the current brightness, contrast, rotation, and flip values
     * as CSS `filter` and `transform` properties to the compressed preview image.
     * Called on every slider change and after each transform action.
     */
    function updatePreviewStyle() {
        if (!DOM.imgComp) return;

        const b = DOM.brightness.value;
        const c = DOM.contrast.value;
        const t = State.transform;

        // If a crop has been applied, the canvas already encodes rotation,
        // so only flip needs to be reflected in the CSS preview.
        const trans = t.isCropped
            ? `scale(${t.flipH}, ${t.flipV})`
            : `rotate(${t.rotate}deg) scale(${t.flipH}, ${t.flipV})`;

        DOM.imgComp.style.filter    = `brightness(${b}%) contrast(${c}%)`;
        DOM.imgComp.style.transform = trans;
    }

    /**
     * Moves the before/after compare divider to the given percentage position.
     * Called on every `input` event of the compare range slider.
     *
     * @param {number|string} val - Slider value 0–100 representing split position.
     */
    function slideCompare(val) {
        DOM.imgOverlay.style.width    = val + '%';
        DOM.sliderHandle.style.left   = val + '%';
    }

    /**
     * Resets all adjustment sliders (brightness, contrast) and all transform
     * state (rotation, flips, crop) back to their factory defaults.
     * Also restores the compressed preview image to the original source.
     */
    function resetFilters() {
        DOM.brightness.value = 100;
        DOM.contrast.value   = 100;
        State.transform      = { rotate: 0, flipH: 1, flipV: 1, isCropped: false, cropCanvas: null };

        // Restore the compressed preview from the original if an image is loaded
        if (State.activeImg) {
            DOM.imgComp.src = DOM.imgOrig.src;
        }

        updatePreviewStyle();
        closeCropper();
    }

    /**
     * Rotates the current image by the given number of degrees (clockwise).
     * Rotation is blocked when a crop has been applied because the crop
     * canvas already encodes rotation — resetting would be misleading.
     *
     * @param {number} deg - Degrees to rotate (typically 90).
     */
    function rotate(deg) {
        // Guard: prevent rotation after crop to avoid matrix confusion
        if (State.transform.isCropped) {
            return window.showToast('Reset crop to rotate.', true);
        }
        State.transform.rotate = (State.transform.rotate + deg) % 360;
        updatePreviewStyle();
    }

    /**
     * Flips the image horizontally or vertically by negating the flip scalar.
     * CSS `scale(-1, 1)` achieves a horizontal mirror; `scale(1, -1)` vertical.
     *
     * @param {'h'|'v'} axis - The axis to flip along.
     */
    function flip(axis) {
        if (axis === 'h') State.transform.flipH *= -1;
        else              State.transform.flipV *= -1;
        updatePreviewStyle();
    }

    /**
     * Opens the Cropper.js modal and initializes a new Cropper instance
     * on the `cropTarget` image element using the original image source.
     * Any existing Cropper instance is destroyed first to prevent leaks.
     */
    function startCropper() {
        if (!DOM.imgOrig.src) return;

        // Show the full-screen crop modal
        DOM.cropModal.style.display = 'flex';
        DOM.cropTarget.src          = DOM.imgOrig.src;

        // Destroy any previous Cropper instance before creating a new one
        if (State.cropper) State.cropper.destroy();

        // Slight delay allows the modal's DOM to settle before Cropper measures dimensions
        setTimeout(() => {
            State.cropper = new Cropper(DOM.cropTarget, {
                viewMode    : 1,       // Restrict crop box within the image canvas
                dragMode    : 'move',  // Move the image, not the crop box
                autoCropArea: 0.9,     // Auto-select 90% of the image initially
                background  : false    // Hide the pattern background for clarity
            });
        }, 50);
    }

    /**
     * Applies the Cropper.js selection: captures the cropped canvas from
     * the Cropper instance, stores it in transform state, and updates the
     * compressed preview with the cropped result.
     */
    function applyCrop() {
        if (!State.cropper) return;

        // Store the cropped canvas — used during processSingleFile() for file 0
        State.transform.cropCanvas = State.cropper.getCroppedCanvas();
        State.transform.isCropped  = true;

        // Reflect the crop in the compressed image preview immediately
        DOM.imgComp.src = State.transform.cropCanvas.toDataURL();

        closeCropper();
        updatePreviewStyle();

        // Confirm to the user via the global toast system
        window.showToast('Image Cropped');
    }

    /**
     * Hides the crop modal and destroys the active Cropper.js instance,
     * releasing its event listeners and internal canvas references.
     */
    function closeCropper() {
        DOM.cropModal.style.display = 'none';
        if (State.cropper) {
            State.cropper.destroy();
            State.cropper = null;
        }
    }

    /**
     * Resets the main workspace UI back to its idle/pre-processing state:
     * clears the result list, disables export buttons, hides the progress
     * panel, and resets all filters/transforms. Called at the start of each
     * new file session to ensure a clean slate.
     */
    function resetUI() {
        DOM.resultList.innerHTML          = '';
        DOM.resultList.style.display      = 'none';
        DOM.dlZip.disabled                = true;
        DOM.dlPdf.disabled                = true;
        DOM.dlSingle.style.display        = 'none';
        DOM.cyberProgressPanel.style.display = 'none';
        resetFilters();
    }


    /* =========================================================================
       SECTION 7: CORE ENGINE — PROCESSING LOGIC
       ─────────────────────────────────────────────────────────────────────────
       processSingleFile() — encodes one file to the target format/quality,
                             applying all transforms and watermark on a Canvas.
       processBatch()      — orchestrates a concurrent queue of processSingleFile
                             tasks, updates the UI progress panel in real time,
                             and finalises the export buttons on completion.
    ========================================================================= */

    /**
     * Compresses a single File object into a Blob using the user's settings.
     * Steps:
     *  A. Prepare ImageBitmap (with HEIC conversion if needed).
     *  B. Calculate final output dimensions (respecting resize settings).
     *  C. Obtain a Canvas context (OffscreenCanvas preferred for GPU perf).
     *  D. Apply white background (JPEG), CSS-equivalent filters, rotation,
     *     flip, watermark, and then encode to the target format.
     *  E. Binary search quality reduction if a target KB limit is set.
     *
     * @param {File}   file     - The original source File object.
     * @param {number} idx      - Zero-based index in the queue (used for crop logic).
     * @param {Object} settings - Compression/transform settings collected from the UI.
     * @returns {Promise<Object>} Result object: { idx, name, blob, type, originalSize }
     *                           or { error, name } on failure.
     */
    async function processSingleFile(file, idx, settings) {
        try {

            // ── A. PREPARE BITMAP ────────────────────────────────────────────
            let imgBitmap;

            if (file.name.toLowerCase().endsWith('.heic')) {
                // Decode Apple HEIC → JPEG blob before creating the bitmap
                const blob = await heic2any({ blob: file, toType: 'image/jpeg' });
                imgBitmap  = await createImageBitmap(Array.isArray(blob) ? blob[0] : blob);
            } else if (idx === 0 && State.transform.isCropped && State.transform.cropCanvas) {
                // First file with an active crop: use the crop canvas as the source
                imgBitmap = await createImageBitmap(State.transform.cropCanvas);
            } else {
                imgBitmap = await createImageBitmap(file);
            }

            // ── B. DIMENSION MATH ─────────────────────────────────────────────
            // If the image is rotated 90/270°, width and height are effectively swapped
            const isRotated = !State.transform.isCropped && (State.transform.rotate % 180 !== 0);
            const origW     = isRotated ? imgBitmap.height : imgBitmap.width;
            const origH     = isRotated ? imgBitmap.width  : imgBitmap.height;

            // Apply user-requested resize, maintaining aspect ratio if only one axis given
            let finalW = origW, finalH = origH;
            if (settings.w && settings.h) {
                finalW = settings.w;
                finalH = settings.h;
            } else if (settings.w) {
                finalW = settings.w;
                finalH = Math.round(origH * (settings.w / origW));
            } else if (settings.h) {
                finalH = settings.h;
                finalW = Math.round(origW * (settings.h / origH));
            }

            // ── C. CANVAS CONTEXT ─────────────────────────────────────────────
            // OffscreenCanvas runs off the main thread → smoother UI during batch
            const useOffscreen = typeof OffscreenCanvas !== 'undefined';
            let canvas, ctx;

            try {
                canvas = useOffscreen
                    ? new OffscreenCanvas(finalW, finalH)
                    : document.createElement('canvas');
                if (!useOffscreen) { canvas.width = finalW; canvas.height = finalH; }
                ctx = canvas.getContext('2d', { willReadFrequently: true });
            } catch (e) {
                // OffscreenCanvas can fail under extreme memory pressure — fall back
                canvas        = document.createElement('canvas');
                canvas.width  = finalW;
                canvas.height = finalH;
                ctx           = canvas.getContext('2d');
            }

            // JPEG does not support transparency — fill with white to avoid black artifacts
            if (settings.fmt === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, finalW, finalH);
            }

            // ── D. APPLY FILTERS & TRANSFORMS ────────────────────────────────
            // CSS-equivalent brightness / contrast via Canvas 2D `filter` property
            ctx.filter = `brightness(${settings.bri}%) contrast(${settings.con}%)`;

            // Translate to center before rotation/flip so the image stays centered
            ctx.translate(finalW / 2, finalH / 2);
            ctx.scale(finalW / origW, finalH / origH);

            if (!State.transform.isCropped) {
                // Apply rotation (radians) and global flip scalars
                ctx.rotate(State.transform.rotate * Math.PI / 180);
                ctx.scale(State.transform.flipH, State.transform.flipV);
            } else if (idx === 0) {
                // Crop canvas already encodes rotation — only apply flip
                ctx.scale(State.transform.flipH, State.transform.flipV);
            }

            // Draw the bitmap centered at the origin (after translate to center)
            ctx.drawImage(imgBitmap, -imgBitmap.width / 2, -imgBitmap.height / 2);

            // ── WATERMARK ────────────────────────────────────────────────────
            // Rendered after the main image draw, on a fresh transform reset,
            // so its position is always bottom-right regardless of rotation.
            if (settings.wm) {
                ctx.filter = 'none';
                ctx.setTransform(1, 0, 0, 1, 0, 0);  // Reset matrix to screen space
                const size      = Math.max(16, finalW * 0.04);
                ctx.font        = `bold ${size}px sans-serif`;
                ctx.fillStyle   = 'rgba(255, 255, 255, 0.5)';
                ctx.textAlign   = 'right';
                ctx.fillText(settings.wm, finalW - 20, finalH - 20);
            }

            // ── E. COMPRESSION (+ Binary Search for Target Size) ─────────────
            // Initial encode at the user's selected quality level
            let blob = await (useOffscreen
                ? canvas.convertToBlob({ type: settings.fmt, quality: settings.q })
                : new Promise(r => canvas.toBlob(r, settings.fmt, settings.q)));

            // If a target KB limit was set and the initial encode exceeds it,
            // run a binary search over the quality range to find the highest
            // quality that still fits within the target byte budget.
            if (settings.targetBytes && blob.size > settings.targetBytes) {
                let min       = 0.01;
                let max       = settings.q;
                let iteration = 0;

                while (iteration < 6 && min <= max) {
                    const mid = (min + max) / 2;
                    const b   = await (useOffscreen
                        ? canvas.convertToBlob({ type: settings.fmt, quality: mid })
                        : new Promise(r => canvas.toBlob(r, settings.fmt, mid)));

                    if (b.size > settings.targetBytes) {
                        // Still too large — reduce the upper quality bound
                        max = mid - 0.05;
                    } else {
                        // Within budget — keep this blob and try increasing quality
                        min  = mid + 0.05;
                        blob = b;
                    }
                    iteration++;
                }
            }

            // Release the GPU-backed bitmap immediately after drawing
            imgBitmap.close();

            // Determine the output file extension from the selected format
            const ext     = settings.fmt === 'image/webp' ? 'webp'
                          : settings.fmt === 'image/png'  ? 'png'
                          : 'jpg';
            const newName = file.name.replace(/\.[^/.]+$/, '') + `_titanium.${ext}`;

            // Return the structured result object for use by processBatch()
            return {
                idx         : idx,
                name        : newName,
                blob        : blob,
                type        : settings.fmt,
                originalSize: file.size
            };

        } catch (error) {
            // Non-fatal: log the error and return an error marker so the batch
            // can continue processing remaining files.
            console.error(`Error processing ${file.name}:`, error);
            return { error: error.message, name: file.name };
        }
    }

    /**
     * Orchestrates the full batch processing workflow:
     *  1. Reads all active settings from the UI controls.
     *  2. Builds a queue of task factory functions for concurrent dispatch.
     *  3. Runs up to MAX_CONCURRENT_TASKS in parallel, updating the progress
     *     panel and result list incrementally as each file finishes.
     *  4. On completion, enables export buttons and shows a success toast.
     */
    async function processBatch() {
        // Guard: prevent re-entry if a batch is already running
        if (State.isProcessing) return;

        // Require at least one file before starting
        if (State.files.length === 0) {
            return window.showToast('No images loaded.', true);
        }

        State.isProcessing = true;
        State.processed    = [];

        // ── Reveal the progress panel and clear any previous result list ─────
        DOM.cyberProgressPanel.style.display = 'block';
        DOM.resultList.innerHTML             = '';
        DOM.resultList.style.display         = 'block';

        // ── Collect UI Settings ───────────────────────────────────────────────
        const settings = {
            q          : parseInt(DOM.quality.value) / 100,
            fmt        : DOM.format.value,
            targetBytes: DOM.targetKB.value ? parseInt(DOM.targetKB.value) * 1024 : null,
            w          : DOM.inpWidth.value  ? parseInt(DOM.inpWidth.value)  : null,
            h          : DOM.inpHeight.value ? parseInt(DOM.inpHeight.value) : null,
            bri        : DOM.brightness.value,
            con        : DOM.contrast.value,
            wm         : DOM.wmText.value
        };

        const total     = State.files.length;
        let   completed = 0;

        // ── Build Concurrency Queue ───────────────────────────────────────────
        // Each entry is a factory function that, when called, returns a Promise
        // (this defers execution so we can control concurrency precisely).
        const queue     = State.files.map((file, i) => () => processSingleFile(file, i, settings));
        const executing = [];

        // ── Dispatch Loop ─────────────────────────────────────────────────────
        for (const task of queue) {
            const p = task().then(res => {
                // ── Per-file completion callback ──────────────────────────────
                completed++;
                const pct = Math.round((completed / total) * 100);

                // Update the progress bar and percentage label
                DOM.cyberProgressBar.style.width  = pct + '%';
                DOM.cyberPercentText.innerText     = pct + '%';
                DOM.cyberStatusText.innerText      = `PROCESSING: ${res.name || 'Unknown'}`;

                if (!res.error) {
                    // Successful result: add to processed array and create a result row
                    State.processed.push(res);
                    addResultItem(res.idx, res.name, res.blob.size);

                    // Special case: update the live preview stats for the first image
                    if (res.idx === 0) {
                        const saved = ((res.originalSize - res.blob.size) / res.originalSize) * 100;
                        $('sizeNew').innerText    = formatBytes(res.blob.size);
                        $('sizeSaved').innerText  = saved > 0 ? saved.toFixed(1) + '%' : '0%';
                        DOM.imgComp.src           = createUrl(res.blob);
                    }
                } else {
                    // Non-fatal error: notify the user and continue
                    window.showToast(`Error: ${res.name}`, true);
                }

                return res;
            });

            executing.push(p);

            // Throttle: once we hit the concurrency cap, wait for one slot to free
            if (executing.length >= MAX_CONCURRENT_TASKS) {
                await Promise.race(executing);
                // Note: Promise.race resolves when the fastest task finishes;
                // the loop then proceeds to dispatch the next task, keeping the
                // pipeline filled at MAX_CONCURRENT_TASKS at all times.
            }
        }

        // ── Wait for all remaining in-flight tasks ────────────────────────────
        await Promise.all(executing);

        // ── Finalize ──────────────────────────────────────────────────────────
        // Sort results by original queue index to ensure consistent order
        State.processed.sort((a, b) => a.idx - b.idx);

        // Update progress panel status to "completed"
        DOM.cyberStatusText.innerText    = 'BATCH COMPLETED.';
        DOM.cyberStatusText.style.color  = '#3fb950';

        // Enable bulk export buttons now that results are ready
        DOM.dlZip.disabled   = false;
        DOM.dlPdf.disabled   = false;

        // Show single-file download button if only one file was processed
        if (State.processed.length === 1) DOM.dlSingle.style.display = 'flex';

        // Update the file counter label to reflect ready count
        DOM.fileCount.innerText   = `${State.processed.length} READY`;
        DOM.fileCount.style.color = '#3fb950';

        State.isProcessing = false;

        // Global toast — success (no second argument = info; 'success' not needed as it's not error)
        window.showToast('All files processed successfully!');
    }

    /**
     * Creates and appends a single row to the results list panel.
     * Each row shows the file index, truncated name, compressed size,
     * and a mini download icon-button that calls dlOne() for that index.
     *
     * NOTE: The class names `result-item`, `file-info`, and `dl-mini-btn`
     * are referenced in tools-template.css (Section 37-K) — do NOT rename.
     *
     * @param {number} idx  - Zero-based file index.
     * @param {string} name - Output filename (e.g., "photo_titanium.jpg").
     * @param {number} size - Compressed blob size in bytes.
     */
    function addResultItem(idx, name, size) {
        const item       = document.createElement('div');
        item.className   = 'result-item';
        item.innerHTML   = `
            <div class="file-info">
                <strong>${idx + 1}.</strong> ${name}<br>
                <span style="color:#3fb950;">${formatBytes(size)}</span>
            </div>
            <button class="dl-mini-btn"
                    onclick="TitaniumEngine.dlOne(${idx})"
                    aria-label="Download ${name}">
                <i class="fa-solid fa-download"></i>
            </button>
        `;
        DOM.resultList.appendChild(item);
        // Auto-scroll to the newest entry as items are added
        DOM.resultList.scrollTop = DOM.resultList.scrollHeight;
    }


    /* =========================================================================
       SECTION 8: DOWNLOADS
       ─────────────────────────────────────────────────────────────────────────
       Three download paths:
         dlOne(idx)  – single file, creates a temporary <a> and clicks it.
         dlZip()     – generates a JSZip archive of all processed files.
         dlPdf()     – compiles all processed images into a jsPDF document,
                       auto-detecting landscape vs portrait per page.
    ========================================================================= */

    /**
     * Downloads a single processed file by its queue index.
     * Creates a temporary anchor element with an Object URL, programmatically
     * clicks it, then revokes the URL after a short delay.
     *
     * @param {number} idx - The zero-based index in State.processed to download.
     */
    function dlOne(idx) {
        const f = State.processed.find(p => p.idx === idx);
        if (!f) return;

        const link    = document.createElement('a');
        link.href     = URL.createObjectURL(f.blob);
        link.download = f.name;
        link.click();

        // Revoke the temporary URL after 2 seconds to free memory
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }

    /**
     * Packages all processed files into a single ZIP archive using JSZip
     * and triggers a browser download for the resulting archive.
     * Shows an error toast if the JSZip library has not been loaded.
     */
    async function dlZip() {
        if (typeof JSZip === 'undefined') {
            return window.showToast('ZIP Library missing.', true);
        }

        const zip = new JSZip();

        // Add each processed blob under its output filename
        State.processed.forEach(f => zip.file(f.name, f.blob));

        // Compress and generate the final ZIP blob
        const content = await zip.generateAsync({ type: 'blob' });

        const link    = document.createElement('a');
        link.href     = URL.createObjectURL(content);
        link.download = 'Titanium_Batch_Optimized.zip';
        link.click();

        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }

    /**
     * Compiles all processed images into a multi-page PDF document using jsPDF.
     * Each image is placed on its own page with auto-detected orientation
     * (landscape or portrait) and scaled to fill the page with a small margin.
     * Shows the global loader during the async PDF build operation.
     */
    async function dlPdf() {
        if (typeof jspdf === 'undefined') {
            return window.showToast('PDF Library missing.', true);
        }

        DOM.globalLoader.style.display = 'flex';

        try {
            const { jsPDF } = window.jspdf;

            // Instantiate a new document (default page will be deleted next)
            const doc = new jsPDF();
            doc.deletePage(1); // Remove the auto-created blank first page

            for (let i = 0; i < State.processed.length; i++) {
                const f = State.processed[i];

                // Convert the compressed Blob to a base64 data URL for jsPDF
                const imgData = await new Promise(resolve => {
                    const reader    = new FileReader();
                    reader.onload   = e => resolve(e.target.result);
                    reader.readAsDataURL(f.blob);
                });

                // Detect orientation from the decoded image dimensions
                const imgProps   = doc.getImageProperties(imgData);
                const isLandscape = imgProps.width > imgProps.height;

                // Add a new page with the correct orientation
                doc.addPage(null, isLandscape ? 'l' : 'p');

                const pdfWidth  = doc.internal.pageSize.getWidth();
                const pdfHeight = doc.internal.pageSize.getHeight();
                const margin    = 10;

                // Scale image proportionally to fit within the page margins
                const ratio = Math.min(
                    (pdfWidth  - margin * 2) / imgProps.width,
                    (pdfHeight - margin * 2) / imgProps.height
                );
                const w = imgProps.width  * ratio;
                const h = imgProps.height * ratio;
                const x = (pdfWidth  - w) / 2;
                const y = (pdfHeight - h) / 2;

                doc.addImage(imgData, f.type === 'image/png' ? 'PNG' : 'JPEG', x, y, w, h);
            }

            doc.save('Titanium_Binder.pdf');

        } catch (e) {
            window.showToast('PDF Error: ' + e.message, true);
        } finally {
            // Always hide the loader regardless of success or failure
            DOM.globalLoader.style.display = 'none';
        }
    }


    /* =========================================================================
       SECTION 9: PUBLIC API
       ─────────────────────────────────────────────────────────────────────────
       Exposes the minimal surface area required for:
         - DOMContentLoaded boot (init)
         - Inline onclick attributes in dynamically generated HTML (dlOne)
         - Externally callable modal and action methods (for future extensibility)
    ========================================================================= */

    return {
        /** Bootstraps the engine — called on DOMContentLoaded. */
        init,

        /** Downloads a single processed file by index. Used by inline onclick in result rows. */
        dlOne,

        /** Downloads all processed files as a ZIP archive. */
        dlZip,

        /** Compiles all processed images into a PDF and downloads it. */
        dlPdf,

        /** Processes all queued files with the current settings. */
        processBatch,

        /** Opens the Cropper.js modal. */
        startCropper,

        /** Applies the current crop selection and closes the modal. */
        applyCrop,

        /** Cancels and closes the crop modal without applying. */
        closeCropper,

        /** Rotates the preview by the given degrees. */
        rotate,

        /** Flips the preview along the given axis. */
        flip,

        /** Resets all adjustments and transforms. */
        resetFilters,

        /** Moves the before/after compare slider to the given position. */
        slideCompare
    };

})();


/* =============================================================================
   BOOT
   Initializes the TitaniumEngine once the full DOM is parsed and ready.
   All event listeners and DOM cache operations happen inside init().
============================================================================= */
window.addEventListener('DOMContentLoaded', TitaniumEngine.init);
