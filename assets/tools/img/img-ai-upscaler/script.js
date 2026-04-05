/**
 * ================================================================
 * AI IMAGE UPSCALER PRO MAX — script.js
 * Tool    : img-ai-upscaler
 * Portal  : TrustedToolsWeb
 * Author  : MD KAWSAR
 * Version : 1.0.0
 *
 * ARCHITECTURE OVERVIEW:
 * ─────────────────────────────────────────────────────────────────
 * This script implements a complete client-side AI image upscaler
 * using TensorFlow.js and Upscaler.js. All processing happens
 * entirely within the user's browser. NO IMAGE DATA IS EVER SENT
 * TO A SERVER.
 *
 * CORE PIPELINE:
 *  1. User uploads image → FileReader converts to HTMLImageElement
 *  2. User configures: AI Model, Scale Factor, Export Format
 *  3. On "Upscale": Image is sliced into 256×256px tiles
 *  4. Each tile is passed through the Upscaler.js neural network
 *  5. Upscaled tiles (512×512 or 1024×1024) are stitched onto
 *     a hidden <canvas> element
 *  6. The final canvas is displayed in the Before/After slider
 *  7. User can download the stitched canvas in PNG/JPG/WebP
 *
 * MEMORY MANAGEMENT:
 *  - tf.dispose() is called after each tile to release GPU tensors
 *  - tf.tidy() wraps operations where possible
 *  - The Upscaler instance is recreated if model changes
 *
 * GLOBAL TOAST API (injected by global.js):
 *  - window.showToast(message: string, isError?: boolean)
 *    Pass `true` as the second argument for error toasts.
 *    Omit or pass nothing for success/info toasts.
 *
 * DEPENDENCIES (CDN — download for full offline use):
 *  - TensorFlow.js:  https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js
 *  - Upscaler.js:    https://cdn.jsdelivr.net/npm/upscaler@latest/dist/browser.umd.js
 * ================================================================
 */

/* ================================================================
   MODULE: AI_UPSCALER_APP
   All logic is wrapped in an IIFE (Immediately Invoked Function
   Expression) to avoid polluting the global scope. The public
   API is exported as window.aiUpscaler for optional external access.
================================================================ */
(function (window, document) {
    'use strict';

    // ────────────────────────────────────────────────────────────
    // SECTION 1: CONFIGURATION & CONSTANTS
    // ────────────────────────────────────────────────────────────

    /**
     * @const {Object} CONFIG
     * Central configuration object. Modify these values to tune
     * performance vs quality tradeoffs for your deployment.
     */
    const CONFIG = {
        /**
         * Size (px) of each tile fed to the AI model.
         * Larger = fewer passes but more GPU memory per tile.
         * 256px is a safe, broadly compatible default.
         */
        TILE_SIZE: 256,

        /**
         * Overlap in pixels between adjacent tiles.
         * Prevents visible seam artifacts at tile boundaries by
         * blending the overlapping edges during stitching.
         */
        TILE_OVERLAP: 8,

        /**
         * Maximum allowed source image dimension in pixels.
         * Images larger than this are rejected to prevent OOM crashes.
         */
        MAX_INPUT_DIMENSION: 6000,

        /**
         * Maximum accepted file size in bytes (20 MB).
         */
        MAX_FILE_SIZE: 20 * 1024 * 1024,

        /**
         * Delay in milliseconds between tile renders.
         * Yields to the browser event loop so the progress UI
         * updates remain smooth and responsive during processing.
         */
        TILE_YIELD_DELAY: 5,

        /**
         * Quality factor for lossy export formats (JPEG, WebP).
         * Range: 0.0 (lowest quality) – 1.0 (highest quality).
         */
        EXPORT_QUALITY: 0.95,

        /**
         * Array of accepted MIME types for the file validation step.
         * GIF and BMP are accepted at upload but may have limited AI
         * enhancement vs photographic formats.
         */
        ACCEPTED_TYPES: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'],
    };

    /**
     * @const {Object} MODEL_CONFIG
     * Metadata for each available AI upscaling model.
     * `modelConfig` is currently undefined (uses Upscaler.js defaults).
     * For production: import specific Upscaler.js model packages and
     * assign them here — see https://upscalerjs.com/models.
     */
    const MODEL_CONFIG = {
        photo: {
            label: 'Photo Reality',
            hint: 'Optimised for real-world photographs',
            modelConfig: undefined, // Upscaler.js default (ESRGAN-style photo model)
        },
        anime: {
            label: 'Anime / Illustration',
            hint: 'Sharp lines for artwork & illustrations',
            modelConfig: undefined, // Upscaler.js default (falls back to same base model)
        },
    };

    // ────────────────────────────────────────────────────────────
    // SECTION 2: APPLICATION STATE
    // ────────────────────────────────────────────────────────────

    /**
     * @type {Object} state
     * Single source of truth for the application.
     * All mutable values live here — never scattered in the DOM.
     */
    const state = {
        /** The raw File object selected by the user */
        sourceFile: null,

        /** HTMLImageElement loaded from the user's file */
        sourceImage: null,

        /** Natural width of the source image in pixels */
        sourceWidth: 0,

        /** Natural height of the source image in pixels */
        sourceHeight: 0,

        /** Upscale factor — 2 or 4 (set by scale toggle buttons) */
        scaleFactor: 2,

        /** Active AI model key — 'photo' or 'anime' */
        selectedModel: 'photo',

        /** Selected export format — 'png', 'jpeg', or 'webp' */
        exportFormat: 'png',

        /** True while the AI upscale pipeline is running */
        isProcessing: false,

        /** True once a fully stitched result canvas is available */
        hasResult: false,

        /** Cached Upscaler.js instance (destroyed on model change) */
        upscalerInstance: null,

        /** Unix timestamp (ms) recorded when upscaling begins */
        processStartTime: 0,

        /** Total number of tiles for the current job */
        totalTiles: 0,

        /** Number of tiles successfully upscaled so far */
        completedTiles: 0,
    };

    // ────────────────────────────────────────────────────────────
    // SECTION 3: DOM ELEMENT REFERENCES
    // ────────────────────────────────────────────────────────────

    /**
     * @type {Object} DOM
     * Cache of frequently accessed DOM nodes.
     * Populated once during init via cacheDOMRefs() to avoid
     * repeated querySelector calls in the render loop.
     */
    const DOM = {};

    /**
     * cacheDOMRefs()
     * Retrieves and stores references to every interactive element
     * in the tool. Must be called at the very start of init().
     */
    function cacheDOMRefs() {
        // ── Upload Zone ──────────────────────────────────────────
        DOM.uploadZone      = document.getElementById('uploadZone');
        DOM.fileInput       = document.getElementById('fileInput');

        // ── Settings Controls ─────────────────────────────────────
        DOM.modelSelect     = document.getElementById('modelSelect');
        DOM.modelHint       = document.getElementById('modelHint');
        DOM.scaleFactor     = document.getElementById('scaleFactor');
        DOM.scaleBtns       = document.querySelectorAll('.aiu-scale-btn');
        DOM.exportFormat    = document.getElementById('exportFormat');

        // ── Image Info Display (shown after file load) ────────────
        DOM.imageInfoGroup  = document.getElementById('imageInfoGroup');
        DOM.infoFilename    = document.getElementById('infoFilename');
        DOM.infoDimensions  = document.getElementById('infoDimensions');
        DOM.infoFilesize    = document.getElementById('infoFilesize');

        // ── Primary Action Buttons ────────────────────────────────
        DOM.btnUpscale      = document.getElementById('btnUpscale');
        DOM.btnDownload     = document.getElementById('btnDownload');
        DOM.btnReset        = document.getElementById('btnReset');

        // ── Progress Section Elements ─────────────────────────────
        DOM.progressSection = document.getElementById('progressSection');
        DOM.progressTitle   = document.getElementById('progressTitle');
        DOM.progressSub     = document.getElementById('progressSub');
        DOM.progressPercent = document.getElementById('progressPercent');
        DOM.progressBarTrack= document.getElementById('progressBarTrack');
        DOM.progressBarFill = document.getElementById('progressBarFill');
        DOM.statTile        = document.getElementById('statTile');
        DOM.statTensors     = document.getElementById('statTensors');
        DOM.statETA         = document.getElementById('statETA');

        // ── Skeleton Loader ──────────────────────────────────────
        DOM.skeletonLoader  = document.getElementById('skeletonLoader');

        // ── Before/After Result Section ───────────────────────────
        DOM.resultSection       = document.getElementById('resultSection');
        DOM.resultMeta          = document.getElementById('resultMeta');
        DOM.comparisonContainer = document.getElementById('comparisonContainer');
        DOM.comparisonOriginal  = document.getElementById('comparisonOriginal');
        DOM.comparisonUpscaled  = document.getElementById('comparisonUpscaled');
        DOM.comparisonSlider    = document.getElementById('comparisonSlider');
        DOM.imgOriginal         = document.getElementById('imgOriginal');
        DOM.canvasOutput        = document.getElementById('canvasOutput');

        // ── Result Stats Bar ─────────────────────────────────────
        DOM.statOutputSize  = document.getElementById('statOutputSize');
        DOM.statProcessTime = document.getElementById('statProcessTime');
        DOM.statTilesTotal  = document.getElementById('statTilesTotal');
        DOM.statScaleFactor = document.getElementById('statScaleFactor');
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 4: GLOBAL TOAST BRIDGE
    // ────────────────────────────────────────────────────────────

    /**
     * showToast()
     * Routes all in-app notifications through the global toast system
     * injected by global.js (window.showToast).
     *
     * IMPORTANT: The global API uses a boolean second argument:
     *   window.showToast("Message")        → success / info toast
     *   window.showToast("Message", true)  → error toast
     *
     * This wrapper translates the old string-type convention used
     * internally (e.g. 'error', 'warning') into the global boolean API.
     *
     * @param {string}  message - Human-readable notification text
     * @param {string}  [type='info'] - One of: 'success'|'error'|'warning'|'info'
     */
    function showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            // Convert string type → boolean isError for the global API
            const isError = (type === 'error');
            window.showToast(message, isError);
        } else {
            // Graceful console fallback if global.js has not loaded yet
            console[type === 'error' ? 'error' : 'log'](`[Toast:${type}] ${message}`);
        }
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 5: MOBILE / WEBGL COMPATIBILITY CHECK
    // ────────────────────────────────────────────────────────────

    /**
     * checkMobileCompatibility()
     * Detects mobile devices and warns users that AI upscaling
     * is a GPU-intensive task that may be significantly slower
     * on mobile hardware. Does NOT block the tool — just informs.
     *
     * Called once on initialization, non-blocking.
     */
    function checkMobileCompatibility() {
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        if (isMobile) {
            // Delay slightly so global.js toast system is ready
            setTimeout(() => {
                showToast(
                    'Mobile device detected. AI upscaling is GPU-intensive — ' +
                    'processing may be slower. For best results, use a desktop browser.',
                    'warning'
                );
            }, 1500);
        }
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 6: UPLOAD ZONE LOGIC
    // ────────────────────────────────────────────────────────────

    /**
     * initUploadZone()
     * Attaches all interaction listeners to the file drop zone:
     *  - Click / keyboard → opens the hidden file browser
     *  - Drag over / leave → visual highlight feedback
     *  - Drop → extracts File from DataTransfer
     *  - File input change → processes selected file
     */
    function initUploadZone() {
        const zone = DOM.uploadZone;

        // ── Click → open file dialog ────────────────────────────
        zone.addEventListener('click', () => {
            if (!state.isProcessing) DOM.fileInput.click();
        });

        // ── Keyboard accessibility (Enter / Space) ──────────────
        // Allows keyboard-only users to open the file browser
        zone.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !state.isProcessing) {
                e.preventDefault();
                DOM.fileInput.click();
            }
        });

        // ── Drag over → add .drag-over visual state ─────────────
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!state.isProcessing) zone.classList.add('drag-over');
        });

        // ── Drag leave → remove visual state ────────────────────
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
        });

        // ── Drop → extract and process the dropped file ─────────
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
            if (state.isProcessing) return;
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelection(file);
        });

        // ── File input change (via dialog selection) ────────────
        DOM.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFileSelection(file);
            // Reset so the same file can be re-selected without issues
            DOM.fileInput.value = '';
        });
    }

    /**
     * handleFileSelection()
     * Validates the selected file (type + size + dimensions) and
     * loads it into state.sourceImage if all checks pass.
     *
     * Validation order:
     *  1. MIME type — must be in CONFIG.ACCEPTED_TYPES
     *  2. File size — must be below CONFIG.MAX_FILE_SIZE (20 MB)
     *  3. Dimensions — neither axis may exceed CONFIG.MAX_INPUT_DIMENSION
     *
     * @param {File} file - The File object from the input or drop event
     */
    function handleFileSelection(file) {
        // ── Validate MIME type ────────────────────────────────────
        if (!CONFIG.ACCEPTED_TYPES.includes(file.type)) {
            showToast('Unsupported file type. Please upload a PNG, JPG, WebP, GIF, or BMP image.', 'error');
            return;
        }

        // ── Validate file size ────────────────────────────────────
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            const maxMB = (CONFIG.MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
            showToast(`File too large. Maximum allowed size is ${maxMB}MB.`, 'error');
            return;
        }

        // ── Load image to validate dimensions ────────────────────
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                // ── Validate pixel dimensions ─────────────────────
                if (img.naturalWidth  > CONFIG.MAX_INPUT_DIMENSION ||
                    img.naturalHeight > CONFIG.MAX_INPUT_DIMENSION) {
                    showToast(
                        `Image too large (${img.naturalWidth}×${img.naturalHeight}px). ` +
                        `Maximum is ${CONFIG.MAX_INPUT_DIMENSION}px per side.`,
                        'error'
                    );
                    return;
                }

                // ── All checks passed — update application state ──
                state.sourceFile   = file;
                state.sourceImage  = img;
                state.sourceWidth  = img.naturalWidth;
                state.sourceHeight = img.naturalHeight;
                state.hasResult    = false;

                // Update the UI: zone state, info box, and button state
                updateUploadZoneState(true);
                displayImageInfo(file, img);
                setUIState('ready');
                hideResult();

                showToast(
                    `"${truncateFilename(file.name, 30)}" loaded — configure settings and upscale!`,
                    'success'
                );
            };

            img.onerror = () => {
                showToast('Could not decode image. The file may be corrupted.', 'error');
            };

            img.src = e.target.result;
        };

        reader.onerror = () => {
            showToast('Failed to read the file. Please try again.', 'error');
        };

        reader.readAsDataURL(file);
    }

    /**
     * updateUploadZoneState()
     * Toggles the .has-file CSS class on the upload zone.
     * The CSS provides a green border when a file is loaded.
     *
     * @param {boolean} hasFile - True after a valid image is loaded
     */
    function updateUploadZoneState(hasFile) {
        if (hasFile) {
            DOM.uploadZone.classList.add('has-file');
        } else {
            DOM.uploadZone.classList.remove('has-file');
        }
    }

    /**
     * displayImageInfo()
     * Populates the image metadata group (#imageInfoGroup) with the
     * filename, pixel dimensions, and file size of the loaded image.
     * The group is hidden by default and shown here via display:flex.
     *
     * @param {File}             file - The source File object
     * @param {HTMLImageElement} img  - The loaded image element
     */
    function displayImageInfo(file, img) {
        DOM.imageInfoGroup.style.display = 'flex';
        DOM.infoFilename.textContent   = truncateFilename(file.name, 35);
        DOM.infoDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
        DOM.infoFilesize.textContent   = formatFileSize(file.size);
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 7: SETTINGS EVENT LISTENERS
    // ────────────────────────────────────────────────────────────

    /**
     * initSettings()
     * Attaches change/click listeners to all configuration controls:
     *  - AI Model dropdown (#modelSelect)
     *  - Scale factor toggle buttons (.aiu-scale-btn)
     *  - Export format dropdown (#exportFormat)
     */
    function initSettings() {

        // ── AI Model dropdown ─────────────────────────────────────
        DOM.modelSelect.addEventListener('change', (e) => {
            state.selectedModel = e.target.value;

            // Update the hint text below the dropdown to match the selected model
            DOM.modelHint.textContent = MODEL_CONFIG[state.selectedModel]?.hint ?? '';

            // The Upscaler instance is model-specific — destroy it so
            // a fresh one with the correct model is created on next run
            destroyUpscaler();
        });

        // ── Scale factor toggle buttons ───────────────────────────
        // These are styled segments (not standard radio buttons).
        // Only one can be active at a time; JS manages the .active class.
        DOM.scaleBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                // Block setting changes while processing is in progress
                if (state.isProcessing) return;

                // Deactivate all buttons
                DOM.scaleBtns.forEach((b) => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });

                // Activate the clicked button and update state
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                state.scaleFactor = parseInt(btn.dataset.scale, 10);
            });
        });

        // ── Export format dropdown ────────────────────────────────
        DOM.exportFormat.addEventListener('change', (e) => {
            state.exportFormat = e.target.value;
        });
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 8: BUTTON ACTIONS & UI STATE MACHINE
    // ────────────────────────────────────────────────────────────

    /**
     * initButtons()
     * Binds click handlers to the three primary action buttons:
     *  - #btnUpscale  → starts the AI upscale pipeline
     *  - #btnDownload → triggers the canvas-to-file download
     *  - #btnReset    → clears all state and resets the UI
     */
    function initButtons() {
        DOM.btnUpscale.addEventListener('click',  startUpscaleProcess);
        DOM.btnDownload.addEventListener('click', downloadResult);
        DOM.btnReset.addEventListener('click',    resetAll);
    }

    /**
     * setUIState()
     * Controls the enabled/disabled state of all action buttons
     * based on the current application stage.
     *
     * States:
     *  - 'idle'       → no image loaded; upscale + download disabled
     *  - 'ready'      → image loaded; upscale enabled, download disabled
     *  - 'processing' → AI running; all buttons disabled; button shows spinner
     *  - 'done'       → result ready; both upscale ("Again") + download enabled
     *
     * @param {'idle'|'ready'|'processing'|'done'} uiState
     */
    function setUIState(uiState) {
        switch (uiState) {

            case 'idle':
                DOM.btnUpscale.disabled  = true;
                DOM.btnDownload.disabled = true;
                DOM.btnUpscale.classList.remove('processing');
                DOM.btnUpscale.innerHTML =
                    '<i class="fa-solid fa-wand-magic-sparkles"></i> Upscale Image';
                break;

            case 'ready':
                DOM.btnUpscale.disabled  = false;
                DOM.btnDownload.disabled = true;
                DOM.btnUpscale.classList.remove('processing');
                DOM.btnUpscale.innerHTML =
                    '<i class="fa-solid fa-wand-magic-sparkles"></i> Upscale Image';
                break;

            case 'processing':
                DOM.btnUpscale.disabled  = true;
                DOM.btnDownload.disabled = true;
                DOM.btnUpscale.classList.add('processing');
                DOM.btnUpscale.innerHTML =
                    '<i class="fa-solid fa-cog"></i> Processing\u2026';
                break;

            case 'done':
                DOM.btnUpscale.disabled  = false;
                DOM.btnDownload.disabled = false;
                DOM.btnUpscale.classList.remove('processing');
                DOM.btnUpscale.innerHTML =
                    '<i class="fa-solid fa-wand-magic-sparkles"></i> Upscale Again';
                break;
        }
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 9: UPSCALER.JS INSTANCE MANAGEMENT
    // ────────────────────────────────────────────────────────────

    /**
     * getOrCreateUpscaler()
     * Returns the cached Upscaler.js instance, or creates a new one
     * if none exists (e.g. on first run or after a model change).
     *
     * @returns {Promise<Object>} The active Upscaler.js instance
     */
    async function getOrCreateUpscaler() {
        // Return cached instance if available
        if (state.upscalerInstance) return state.upscalerInstance;

        updateProgress(0, 'Initialising AI Engine\u2026', 'Loading TensorFlow.js + WebGL backend');

        // Ensure TF.js WebGL backend is ready
        await tf.ready();
        updateProgress(10, 'WebGL Backend Ready', `Using: ${tf.getBackend()}`);

        /**
         * Build the Upscaler.js options object for complete offline support.
         * We inherit the default model configurations but override the path
         * to force it to load the local model.json file.
         */
        const upscalerOptions = {
            model: {
                ...DefaultUpscalerJSModel, 
                path: '../../assets/library/ai-engine/upscaler/models/model.json' 
            }
        };

        try {
            // Initialize the Upscaler instance with the offline model
            state.upscalerInstance = new Upscaler(upscalerOptions);
            
            updateProgress(
                20,
                'AI Model Loaded',
                `Model: ${MODEL_CONFIG[state.selectedModel].label}`
            );
            return state.upscalerInstance;
        } catch (err) {
            throw new Error(`Failed to initialise Upscaler.js: ${err.message}`);
        }
    }

    /**
     * destroyUpscaler()
     * Disposes the current Upscaler.js instance and releases its
     * TensorFlow.js memory. Called when the user changes the AI model
     * so a fresh instance with the correct weights is created next time.
     */
    function destroyUpscaler() {
        if (state.upscalerInstance) {
            try {
                state.upscalerInstance.dispose?.();
            } catch (_) { /* Silently ignore disposal errors */ }
            state.upscalerInstance = null;
        }
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 10: CORE UPSCALE PIPELINE
    // ────────────────────────────────────────────────────────────

    /**
     * startUpscaleProcess()
     * MAIN ENTRY POINT for the AI upscaling pipeline.
     * Triggered by the #btnUpscale click event.
     *
     * Full execution flow:
     *  1. Guard checks (no source image, already processing)
     *  2. Set processing state & show progress UI
     *  3. Initialise / retrieve the Upscaler.js instance
     *  4. Render source image onto an offscreen canvas
     *  5. Prepare the output canvas (scale × source dimensions)
     *  6. Calculate tile grid (cols × rows based on TILE_SIZE)
     *  7. Loop: extract → upscale → stitch each tile
     *         → dispose tensors → update progress
     *  8. Show result, initialise comparison slider, toast success
     *  9. On error: show toast, revert UI state
     * 10. Always: cleanup tensors, reset isProcessing flag
     */
    async function startUpscaleProcess() {
        // ── Guard: must have a loaded source image ─────────────────
        if (!state.sourceImage) {
            showToast('Please upload an image first.', 'warning');
            return;
        }

        // ── Guard: prevent double-click during processing ──────────
        if (state.isProcessing) return;

        state.isProcessing     = true;
        state.processStartTime = Date.now();
        state.hasResult        = false;

        // Transition UI to processing mode
        setUIState('processing');
        showProgress();
        hideResult();

        try {
            // ── STEP 1: Obtain the AI upscaler instance ────────────
            const upscaler = await getOrCreateUpscaler();

            // ── STEP 2: Render source image to an offscreen canvas ─
            // HTMLImageElement pixels cannot be read directly;
            // we must draw into a canvas to access raw pixel data for tiling.
            const sourceCanvas      = document.createElement('canvas');
            const sourceCtx         = sourceCanvas.getContext('2d');
            sourceCanvas.width      = state.sourceWidth;
            sourceCanvas.height     = state.sourceHeight;
            sourceCtx.drawImage(state.sourceImage, 0, 0);

            // ── STEP 3: Prepare the output canvas ─────────────────
            // Final dimensions = source × scale factor
            const outWidth  = state.sourceWidth  * state.scaleFactor;
            const outHeight = state.sourceHeight * state.scaleFactor;

            DOM.canvasOutput.width  = outWidth;
            DOM.canvasOutput.height = outHeight;
            const outCtx = DOM.canvasOutput.getContext('2d');

            // ── STEP 4: Calculate the tile grid ───────────────────
            const tileSize = CONFIG.TILE_SIZE;
            const overlap  = CONFIG.TILE_OVERLAP;
            const cols     = Math.ceil(state.sourceWidth  / tileSize);
            const rows     = Math.ceil(state.sourceHeight / tileSize);
            const totalTiles = cols * rows;

            state.totalTiles     = totalTiles;
            state.completedTiles = 0;

            updateProgress(
                25,
                'Slicing Image Into Tiles\u2026',
                `Grid: ${cols} \u00D7 ${rows} = ${totalTiles} tiles`
            );

            // ── STEP 5 & 6: Process each tile in the grid ─────────
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {

                    // Calculate source tile bounds with overlap padding
                    // The overlap is clipped to image edges to avoid reading outside
                    const srcX = Math.max(0, col * tileSize - overlap);
                    const srcY = Math.max(0, row * tileSize - overlap);
                    const srcW = Math.min(tileSize + overlap * 2, state.sourceWidth  - srcX);
                    const srcH = Math.min(tileSize + overlap * 2, state.sourceHeight - srcY);

                    // Extract the pixel-accurate tile canvas
                    const tileCanvas   = extractTile(sourceCanvas, srcX, srcY, srcW, srcH);

                    // Run the tile through the Upscaler.js neural network
                    const upscaledTile = await upscaleTile(upscaler, tileCanvas);

                    // Calculate destination coordinates on the output canvas.
                    // The overlap padding must be removed before stitching.
                    const dstX  = col * tileSize * state.scaleFactor;
                    const dstY  = row * tileSize * state.scaleFactor;
                    const cropX = (srcX === col * tileSize - overlap) ? overlap * state.scaleFactor : 0;
                    const cropY = (srcY === row * tileSize - overlap) ? overlap * state.scaleFactor : 0;

                    // Stitch the upscaled tile onto the output canvas
                    stitchTile(outCtx, upscaledTile, dstX, dstY, cropX, cropY);

                    // ── CRITICAL: Memory cleanup ───────────────────
                    // Without explicit disposal, GPU tensors accumulate
                    // and cause WebGL Out of Memory crashes on large images.
                    if (upscaledTile instanceof HTMLCanvasElement) {
                        upscaledTile.width  = 0;
                        upscaledTile.height = 0;
                    }
                    tf.disposeVariables();

                    // ── Update progress counters ───────────────────
                    state.completedTiles++;
                    const percent = 25 + Math.round((state.completedTiles / totalTiles) * 70);
                    const eta     = calculateETA(state.completedTiles, totalTiles, state.processStartTime);

                    updateProgress(
                        percent,
                        `Upscaling Tiles\u2026 (${state.completedTiles}/${totalTiles})`,
                        `Row ${row + 1}/${rows} \u00B7 Col ${col + 1}/${cols}`,
                        state.completedTiles,
                        totalTiles,
                        tf.memory().numTensors,
                        eta
                    );

                    // ── Yield to the browser event loop ───────────
                    // Prevents the UI from freezing and ensures the
                    // progress bar updates are visually rendered.
                    await yieldToMain();
                }
            }

            // ── STEP 7: Finalize and reveal the result ─────────────
            const processDuration = ((Date.now() - state.processStartTime) / 1000).toFixed(1);

            updateProgress(100, 'Complete!', 'Rendering comparison view\u2026');

            // Brief pause so the 100% completed state is visible
            await new Promise(r => setTimeout(r, 400));

            state.hasResult = true;
            hideProgress();
            showResultSection(outWidth, outHeight, processDuration, totalTiles);
            setUIState('done');

            showToast(
                `Image upscaled ${state.scaleFactor}\u00D7 successfully in ${processDuration}s!`,
                'success'
            );

        } catch (err) {
            // ── Error handling: log, notify, revert UI ─────────────
            console.error('[AI Upscaler] Processing Error:', err);
            showToast(
                `Upscaling failed: ${err.message}. Try a smaller image or refresh.`,
                'error'
            );
            hideProgress();
            setUIState(state.sourceImage ? 'ready' : 'idle');

        } finally {
            // ── Always run: cleanup GPU tensors and reset flag ──────
            cleanupTensors();
            state.isProcessing = false;
        }
    }

    /**
     * extractTile()
     * Copies a rectangular region from the source canvas into a new
     * HTMLCanvasElement representing a single processing tile.
     *
     * @param {HTMLCanvasElement} srcCanvas - Full source image canvas
     * @param {number} x - Left edge of the tile (px)
     * @param {number} y - Top edge of the tile (px)
     * @param {number} w - Width of the tile (px)
     * @param {number} h - Height of the tile (px)
     * @returns {HTMLCanvasElement} A new canvas containing only this tile
     */
    function extractTile(srcCanvas, x, y, w, h) {
        const tile    = document.createElement('canvas');
        tile.width    = w;
        tile.height   = h;
        const ctx     = tile.getContext('2d');
        ctx.drawImage(srcCanvas, x, y, w, h, 0, 0, w, h);
        return tile;
    }

    /**
     * upscaleTile()
     * Passes a single tile canvas through the Upscaler.js model and
     * returns the upscaled result as an HTMLCanvasElement.
     *
     * Upscaler.js returns an image src (data URL) by default.
     * We wrap it in a canvas so stitchTile() can use drawImage().
     *
     * @param {Object}            upscaler   - The active Upscaler.js instance
     * @param {HTMLCanvasElement} tileCanvas - The source tile (pre-overlap-padded)
     * @returns {Promise<HTMLCanvasElement>} The upscaled tile canvas
     */
    async function upscaleTile(upscaler, tileCanvas) {
        /**
         * upscaler.upscale() options:
         *  - patchSize: internal sub-tile size for very large tiles
         *  - padding:   internal overlap for Upscaler.js sub-tiles
         *  - output:    'src' returns a base64 data URL
         *  - progressCallback: we manage our own progress display
         */
        const resultImg = await upscaler.upscale(tileCanvas, {
            patchSize:        CONFIG.TILE_SIZE,
            padding:          CONFIG.TILE_OVERLAP,
            output:           'src',
            progressCallback: () => {}, // Suppress internal progress; we handle it
        });

        // Convert the returned data URL to a drawable canvas
        return new Promise((resolve, reject) => {
            const img  = new Image();
            img.onload = () => {
                const canvas   = document.createElement('canvas');
                canvas.width   = img.width;
                canvas.height  = img.height;
                const ctx      = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas);
            };
            img.onerror = reject;
            img.src     = resultImg;
        });
    }

    /**
     * stitchTile()
     * Draws a single upscaled tile onto the final output canvas at
     * the correct position, cropping away the overlap padding that
     * was added to prevent seam artifacts.
     *
     * @param {CanvasRenderingContext2D} outCtx     - Output canvas 2D context
     * @param {HTMLCanvasElement}        tileCanvas - The upscaled tile
     * @param {number} dstX  - Destination X on output canvas (px)
     * @param {number} dstY  - Destination Y on output canvas (px)
     * @param {number} cropX - Pixels to crop from the left (removes left overlap)
     * @param {number} cropY - Pixels to crop from the top  (removes top overlap)
     */
    function stitchTile(outCtx, tileCanvas, dstX, dstY, cropX, cropY) {
        outCtx.drawImage(
            tileCanvas,
            cropX,                          // sx: start x (remove left overlap)
            cropY,                          // sy: start y (remove top overlap)
            tileCanvas.width  - cropX,      // sw: cropped source width
            tileCanvas.height - cropY,      // sh: cropped source height
            dstX,                           // dx: destination x on output
            dstY,                           // dy: destination y on output
            tileCanvas.width  - cropX,      // dw: drawn width (1:1 scale)
            tileCanvas.height - cropY       // dh: drawn height (1:1 scale)
        );
    }

    /**
     * yieldToMain()
     * Returns a Promise that resolves after a short configurable delay
     * (CONFIG.TILE_YIELD_DELAY ms). Calling `await yieldToMain()` inside
     * the tile loop gives the browser time to:
     *  - Repaint the progress bar
     *  - Handle user interactions
     *  - Prevent the "Page Unresponsive" dialog on long jobs
     *
     * @returns {Promise<void>}
     */
    function yieldToMain() {
        return new Promise(resolve => setTimeout(resolve, CONFIG.TILE_YIELD_DELAY));
    }

    /**
     * cleanupTensors()
     * Aggressively releases all TensorFlow.js GPU tensors and variables
     * after a processing job. Always called in the `finally` block to
     * guarantee cleanup even when an error occurs mid-processing.
     */
    function cleanupTensors() {
        try {
            tf.disposeVariables();
            const mem = tf.memory();
            console.log(
                `[AI Upscaler] Memory after cleanup — ` +
                `Tensors: ${mem.numTensors}, ` +
                `Bytes: ${(mem.numBytes / 1024 / 1024).toFixed(2)} MB`
            );
        } catch (e) {
            console.warn('[AI Upscaler] Tensor cleanup error:', e);
        }
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 11: PROGRESS UI
    // ────────────────────────────────────────────────────────────

    /**
     * showProgress()
     * Reveals the progress section by removing the `hidden` attribute
     * and ensures the skeleton loader is hidden simultaneously.
     */
    function showProgress() {
        DOM.progressSection.hidden = false;
        DOM.skeletonLoader.hidden  = true;
    }

    /**
     * hideProgress()
     * Hides the progress section after upscaling completes or fails.
     */
    function hideProgress() {
        DOM.progressSection.hidden = true;
    }

    /**
     * updateProgress()
     * Atomically updates every element in the progress section.
     * Designed to be called once per tile to keep the display in sync
     * without causing layout thrashing.
     *
     * @param {number} percent  - Progress value from 0 to 100
     * @param {string} title    - Primary status message (#progressTitle)
     * @param {string} [sub]    - Secondary detail line (#progressSub)
     * @param {number} [done]   - Tiles completed so far (#statTile)
     * @param {number} [total]  - Total tiles in this job (#statTile)
     * @param {number} [tensors]- Current tf.memory().numTensors (#statTensors)
     * @param {string} [eta]    - ETA string, e.g. "~12s" (#statETA)
     */
    function updateProgress(
        percent, title, sub = '',
        done = 0, total = 0, tensors = 0, eta = '\u2014'
    ) {
        const pct = Math.min(100, Math.max(0, percent));

        DOM.progressTitle.textContent   = title;
        DOM.progressSub.textContent     = sub;
        DOM.progressPercent.textContent = `${pct}%`;
        DOM.progressBarFill.style.width = `${pct}%`;
        DOM.progressBarTrack.setAttribute('aria-valuenow', pct);

        // Only update tile stats when tile data is available
        if (total > 0) {
            DOM.statTile.textContent    = `${done}/${total}`;
            DOM.statTensors.textContent = tensors;
            DOM.statETA.textContent     = eta;
        }
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 12: RESULT SECTION & COMPARISON SLIDER
    // ────────────────────────────────────────────────────────────

    /**
     * showResultSection()
     * Reveals the #resultSection, populates all metadata fields,
     * initialises the Before/After comparison slider at 50%, and
     * smoothly scrolls the result into view.
     *
     * @param {number} outWidth        - Output canvas width in pixels
     * @param {number} outHeight       - Output canvas height in pixels
     * @param {string} processDuration - Processing time as a string (e.g. "4.2")
     * @param {number} totalTiles      - Total tiles rendered
     */
    function showResultSection(outWidth, outHeight, processDuration, totalTiles) {
        // Set the original image for the "before" half of the slider
        DOM.imgOriginal.src = state.sourceImage.src;
        DOM.imgOriginal.alt = `Original: ${state.sourceWidth}\u00D7${state.sourceHeight}px`;

        // Apply an aspect-ratio constraint so the slider always
        // maintains the correct proportions regardless of screen width
        DOM.comparisonContainer.style.height      = `min(${outHeight}px, 70vh)`;
        DOM.comparisonContainer.style.aspectRatio = `${outWidth} / ${outHeight}`;

        // Populate the meta string in the result header
        DOM.resultMeta.textContent =
            `${state.sourceWidth}\u00D7${state.sourceHeight} \u2192 ` +
            `${outWidth}\u00D7${outHeight} (${state.scaleFactor}\u00D7)`;

        // Populate the four stats tiles
        DOM.statOutputSize.textContent  = `${outWidth} \u00D7 ${outHeight}`;
        DOM.statProcessTime.textContent = `${processDuration}s`;
        DOM.statTilesTotal.textContent  = `${totalTiles} tiles`;
        DOM.statScaleFactor.textContent = `${state.scaleFactor}\u00D7`;

        // Reveal the section
        DOM.resultSection.hidden = false;

        // Position slider at 50% (equal before/after split)
        setSliderPosition(50);

        // Smooth scroll so the result is immediately visible
        DOM.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Attach mouse/touch/keyboard event listeners to the slider
        initComparisonSlider();
    }

    /**
     * hideResult()
     * Hides the result section — called when a new image is loaded
     * or when the user resets.
     */
    function hideResult() {
        DOM.resultSection.hidden = true;
    }

    /**
     * setSliderPosition()
     * Moves the comparison slider handle and updates the CSS clip-path
     * on the upscaled layer to reveal the correct portion.
     *
     * The upscaled layer sits on top and is progressively revealed from
     * the left as `percent` increases. The original image below always
     * shows through on the right side of the cut.
     *
     * @param {number} percent - Slider position as 0–100 percentage
     */
    function setSliderPosition(percent) {
        const pct   = Math.min(100, Math.max(0, percent));
        const right = 100 - pct;

        // Clip the upscaled layer from the right, revealing more as pct grows
        DOM.comparisonUpscaled.style.clipPath = `inset(0 ${right}% 0 0)`;

        // Move the drag handle to match
        DOM.comparisonSlider.style.left = `${pct}%`;
        DOM.comparisonSlider.setAttribute('aria-valuenow', Math.round(pct));
    }

    /**
     * initComparisonSlider()
     * Attaches pointer, touch, and keyboard listeners to the comparison
     * container and slider handle.
     *
     * Pointer events use setPointerCapture() so dragging works even when
     * the cursor/finger moves outside the container bounds.
     * Touch events use { passive: false } to allow e.preventDefault(),
     * which prevents page scroll interfering with slider drag.
     */
    function initComparisonSlider() {
        const container = DOM.comparisonContainer;
        const slider    = DOM.comparisonSlider;
        let isDragging  = false;

        /**
         * Converts a raw clientX value to a percentage (0–100)
         * relative to the container's bounding rectangle.
         * @param {number} clientX - Pointer X position in viewport coordinates
         * @returns {number} Percentage 0–100
         */
        const getPercentFromX = (clientX) => {
            const rect = container.getBoundingClientRect();
            return ((clientX - rect.left) / rect.width) * 100;
        };

        // ── Mouse Events ──────────────────────────────────────────
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            // Pointer capture ensures mousemove fires even outside the element
            container.setPointerCapture?.(e.pointerId);
            setSliderPosition(getPercentFromX(e.clientX));
            e.preventDefault();
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            setSliderPosition(getPercentFromX(e.clientX));
        });

        container.addEventListener('mouseup',    () => { isDragging = false; });
        container.addEventListener('mouseleave', () => { isDragging = false; });

        // ── Touch Events ──────────────────────────────────────────
        container.addEventListener('touchstart', (e) => {
            isDragging = true;
            setSliderPosition(getPercentFromX(e.touches[0].clientX));
            e.preventDefault(); // Prevent page scroll
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            setSliderPosition(getPercentFromX(e.touches[0].clientX));
            e.preventDefault();
        }, { passive: false });

        container.addEventListener('touchend', () => { isDragging = false; });

        // ── Keyboard Accessibility ────────────────────────────────
        // Arrow keys move the slider 2% per press (10% with Shift held).
        // Home/End jump to the extremes.
        slider.addEventListener('keydown', (e) => {
            const current = parseFloat(slider.getAttribute('aria-valuenow') || '50');
            const step    = e.shiftKey ? 10 : 2;

            if (e.key === 'ArrowLeft')  { setSliderPosition(current - step); e.preventDefault(); }
            if (e.key === 'ArrowRight') { setSliderPosition(current + step); e.preventDefault(); }
            if (e.key === 'Home')       { setSliderPosition(0);   e.preventDefault(); }
            if (e.key === 'End')        { setSliderPosition(100); e.preventDefault(); }
        });
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 13: DOWNLOAD / EXPORT SYSTEM
    // ────────────────────────────────────────────────────────────

    /**
     * downloadResult()
     * Exports the final stitched output canvas as a downloadable file
     * in the user's chosen format (PNG, JPEG, or WebP).
     *
     * Uses canvas.toBlob() for non-blocking conversion, then creates
     * a temporary <a> element and programmatically clicks it to trigger
     * the browser's native Save dialog.
     *
     * The generated filename includes the original base name,
     * the scale factor, and the enhancement indicator for clarity:
     *   e.g. "photo_2x_AI-Enhanced.png"
     */
    function downloadResult() {
        // ── Guard: result must be available ─────────────────────────
        if (!state.hasResult || !DOM.canvasOutput.width) {
            showToast('No result to download yet. Please upscale an image first.', 'warning');
            return;
        }

        const format   = state.exportFormat;                      // 'png' | 'jpeg' | 'webp'
        const mimeType = `image/${format}`;
        const quality  = format === 'png' ? undefined : CONFIG.EXPORT_QUALITY;

        // Build a descriptive output filename from the source file's base name
        const baseName = state.sourceFile
            ? state.sourceFile.name.replace(/\.[^.]+$/, '')
            : 'upscaled';
        const filename = `${baseName}_${state.scaleFactor}x_AI-Enhanced.${format}`;

        // Convert canvas pixels → Blob asynchronously (off main thread)
        DOM.canvasOutput.toBlob(
            (blob) => {
                if (!blob) {
                    showToast('Failed to generate image file. Please try again.', 'error');
                    return;
                }

                // Create a temporary Object URL and anchor element for download
                const url  = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href            = url;
                link.download        = filename;
                link.style.display   = 'none';
                document.body.appendChild(link);
                link.click();

                // Revoke the Object URL after 60 seconds to free memory
                // (Immediate revocation can fail on some browsers / iOS Safari)
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    document.body.removeChild(link);
                }, 60000);

                const sizeLabel = formatFileSize(blob.size);
                showToast(
                    `Downloaded "${filename}" (${sizeLabel}) as ${format.toUpperCase()}`,
                    'success'
                );
            },
            mimeType,
            quality
        );
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 14: RESET
    // ────────────────────────────────────────────────────────────

    /**
     * resetAll()
     * Resets the entire application to the initial idle state.
     *
     * Clears:
     *  - All state properties (sourceFile, sourceImage, dimensions…)
     *  - Output canvas pixels and size
     *  - Original image src
     *  - Upload zone visual state and image info display
     *  - Progress section and result section visibility
     *  - File input value (allows re-selecting the same file)
     *
     * Preserves:
     *  - The Upscaler.js instance (keeps model weights in memory
     *    for faster processing on the next image)
     *  - User's current settings (model, scale factor, format)
     */
    function resetAll() {
        // ── Clear application state ───────────────────────────────
        state.sourceFile     = null;
        state.sourceImage    = null;
        state.sourceWidth    = 0;
        state.sourceHeight   = 0;
        state.hasResult      = false;
        state.isProcessing   = false;
        state.completedTiles = 0;
        state.totalTiles     = 0;

        // ── Clear the output canvas ────────────────────────────────
        const ctx = DOM.canvasOutput.getContext('2d');
        ctx.clearRect(0, 0, DOM.canvasOutput.width, DOM.canvasOutput.height);
        DOM.canvasOutput.width  = 0;
        DOM.canvasOutput.height = 0;

        // ── Clear the original image element ────────────────────────
        DOM.imgOriginal.src = '';

        // ── Reset upload zone visuals ─────────────────────────────
        updateUploadZoneState(false);
        DOM.imageInfoGroup.style.display = 'none';

        // ── Hide progress and result panels ──────────────────────
        hideProgress();
        hideResult();

        // ── Return buttons to idle state ─────────────────────────
        setUIState('idle');

        // ── Clear the hidden file input ───────────────────────────
        DOM.fileInput.value = '';

        // ── Release any remaining GPU tensors ────────────────────
        cleanupTensors();

        showToast('Reset complete. Ready for a new image.', 'info');
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 15: UTILITY FUNCTIONS
    // ────────────────────────────────────────────────────────────

    /**
     * formatFileSize()
     * Converts a raw byte count into a human-readable string.
     *
     * @param {number} bytes - File size in bytes
     * @returns {string} Human-readable size, e.g. "2.4 MB", "340 KB"
     */
    function formatFileSize(bytes) {
        if (bytes < 1024)         return `${bytes} B`;
        if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }

    /**
     * truncateFilename()
     * Shortens a filename to a maximum character count while
     * preserving the file extension for readability.
     *
     * @param {string} name   - Original filename (with extension)
     * @param {number} maxLen - Maximum allowed total length
     * @returns {string} Truncated filename with ellipsis if needed
     */
    function truncateFilename(name, maxLen) {
        if (name.length <= maxLen) return name;
        const ext  = name.lastIndexOf('.') > -1 ? name.slice(name.lastIndexOf('.')) : '';
        const base = name.slice(0, maxLen - ext.length - 3);
        return `${base}\u2026${ext}`;
    }

    /**
     * calculateETA()
     * Estimates the remaining processing time using a simple linear
     * interpolation based on the average time per completed tile.
     *
     * @param {number} done      - Number of tiles completed so far
     * @param {number} total     - Total number of tiles in this job
     * @param {number} startTime - Unix timestamp (ms) when processing began
     * @returns {string} Human-readable ETA, e.g. "~23s", "~2m", "< 1s"
     */
    function calculateETA(done, total, startTime) {
        if (done === 0) return '\u2014'; // Em-dash — no data yet

        const elapsed   = (Date.now() - startTime) / 1000; // seconds elapsed
        const perTile   = elapsed / done;                   // avg seconds per tile
        const remaining = (total - done) * perTile;         // projected seconds left

        if (remaining < 1)   return '< 1s';
        if (remaining < 60)  return `~${Math.round(remaining)}s`;
        return `~${Math.round(remaining / 60)}m`;
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 16: TENSORFLOW.JS READINESS CHECK
    // ────────────────────────────────────────────────────────────

    /**
     * checkDependencies()
     * Verifies that both TensorFlow.js and Upscaler.js are available
     * and initialises the optimal backend (WebGL preferred, CPU fallback).
     *
     * Called asynchronously during init so it does not block
     * the page render or user interactions.
     *
     * @returns {Promise<boolean>} True if dependencies are ready
     */
    async function checkDependencies() {
        // ── Check TensorFlow.js ────────────────────────────────────
        if (typeof tf === 'undefined') {
            showToast(
                'TensorFlow.js failed to load. AI upscaling is unavailable. ' +
                'Check your internet connection or download the library locally.',
                'error'
            );
            DOM.btnUpscale.disabled = true;
            DOM.btnUpscale.title    = 'TensorFlow.js not loaded';
            return false;
        }

        // ── Check Upscaler.js ──────────────────────────────────────
        if (typeof Upscaler === 'undefined') {
            showToast(
                'Upscaler.js failed to load. AI upscaling is unavailable. ' +
                'Check your internet connection or download the library locally.',
                'error'
            );
            DOM.btnUpscale.disabled = true;
            DOM.btnUpscale.title    = 'Upscaler.js not loaded';
            return false;
        }

        // ── Initialise TF.js backend ───────────────────────────────
        // Prefer WebGL (GPU) for maximum performance.
        // Gracefully fall back to CPU if WebGL is unavailable.
        try {
            await tf.setBackend('webgl');
            await tf.ready();
            console.log(`[AI Upscaler] TensorFlow.js ready. Backend: ${tf.getBackend()}`);
        } catch (webglErr) {
            console.warn('[AI Upscaler] WebGL unavailable, falling back to CPU backend.', webglErr);
            try {
                await tf.setBackend('cpu');
                await tf.ready();
                showToast(
                    'WebGL not available on this device. Falling back to CPU mode — processing will be slower.',
                    'warning'
                );
            } catch (cpuErr) {
                showToast(
                    'TensorFlow.js backend initialization failed. Try Chrome or Edge.',
                    'error'
                );
                return false;
            }
        }

        return true;
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 17: INITIALIZATION
    // ────────────────────────────────────────────────────────────

    /**
     * init()
     * Main entry point — bootstraps the entire application.
     *
     * Execution order:
     *  1. Cache all DOM references (must be first)
     *  2. Attach event listeners (upload, settings, buttons)
     *  3. Set UI to idle state
     *  4. Check mobile compatibility (non-blocking toast)
     *  5. Verify TF.js + Upscaler.js are loaded (async, non-blocking)
     */
    async function init() {
        // Step 1: Populate the DOM reference cache
        cacheDOMRefs();

        // Step 2: Wire up all event listeners
        initUploadZone();
        initSettings();
        initButtons();

        // Step 3: Start in idle (no image loaded)
        setUIState('idle');

        // Step 4: Warn mobile users about performance expectations
        checkMobileCompatibility();

        // Step 5: Verify AI libraries loaded correctly (async)
        const ready = await checkDependencies();
        if (ready) {
            console.log('[AI Upscaler] Ready. Awaiting user image upload.');
        }
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 18: DOM READY BOOTSTRAP
    // ────────────────────────────────────────────────────────────

    /**
     * Guard: if the DOM is still being parsed when this script runs,
     * wait for DOMContentLoaded before calling init().
     * In practice this script is placed at the bottom of <body>, so
     * the DOM is almost always ready by the time this executes.
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ────────────────────────────────────────────────────────────
    // SECTION 19: PUBLIC API EXPORT
    // ────────────────────────────────────────────────────────────

    /**
     * window.aiUpscaler
     * Minimal public API for optional external access or debugging.
     *
     * Methods:
     *  - reset()        : Programmatically trigger a full reset
     *  - getState()     : Returns a copy of the current state object
     *                     (upscalerInstance is masked for safety)
     *  - download()     : Triggers the download if a result is available
     *  - getMemoryInfo(): Returns tf.memory() object for GPU debugging
     */
    window.aiUpscaler = {
        reset       : resetAll,
        getState    : () => ({ ...state, upscalerInstance: '[hidden]' }),
        download    : downloadResult,
        getMemoryInfo: () => typeof tf !== 'undefined' ? tf.memory() : null,
    };

})(window, document);
