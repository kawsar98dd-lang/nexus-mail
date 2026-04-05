/**
 * ============================================================
 * AI Background Remover Ultra Max — script.js
 * Tool      : img-bg-remover
 * Version   : 1.0.0
 * Author    : Trusted Tools Web (MD KAWSAR) — CodeCanyon Release
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────────────────────────────────────────────
 *  1.  CONFIG          — Global constants and tunable defaults
 *  2.  STATE           — Centralized mutable application state
 *  3.  DOM CACHE       — Cached element references (performance)
 *  4.  LIBRARY LOADER  — Dynamic ESM import of @imgly/background-removal
 *  5.  INDEXEDDB       — Local history storage (no server needed)
 *  6.  UPLOAD / INPUT  — Dropzone, file input, batch queue logic
 *  7.  AI PROCESSING   — Core background removal pipeline
 *  8.  CANVAS ENGINE   — Stroke, shadow, background compositing
 *  9.  BEFORE/AFTER    — Interactive comparison slider
 * 10.  PREVIEW TABS    — Tab switching logic
 * 11.  EXPORT          — PNG/WebP download + ZIP batch export
 * 12.  UI HELPERS      — Sliders, toggles, presets
 * 13.  UTILITY FUNCTIONS
 * 14.  INITIALIZATION  — DOMContentLoaded wiring
 * ============================================================
 */


/* ============================================================
   1. CONFIG — Tune these values to adjust tool behavior
   ============================================================ */
const CONFIG = {
    // [CODECANYON AUTHOR NOTE]:
    // 100% Offline & Client-Side Setup.
    // Points to the local pre-bundled browser module.
    IMGLY_CDN: "../../assets/library/imgly-bg-removal/background-removal.esm.js",

    // Points to the local directory containing .wasm and .onnx files.
    // MUST end with a trailing slash (/)
    ASSETS_PATH: "../../assets/library/imgly-bg-removal/",

    // Application Defaults
    DEFAULT_FORMAT: 'png',
    ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    
    // IndexedDB History Settings
    IDB_NAME: 'bgr_database',
    IDB_VERSION: 1,
    IDB_STORE: 'cutouts',
    MAX_HISTORY: 5,

    // UI Color Presets
    SOLID_PRESETS: ['#ffffff', '#000000', '#f1f5f9', '#ef4444', '#3b82f6', '#10b981'],
    STROKE_PRESETS: ['#ffffff', '#000000', '#f87171', '#60a5fa', '#34d399', '#fbbf24']
};



/* ============================================================
   2. STATE — Single source of truth for all runtime data
   ============================================================ */

const STATE = {

    /** Cached @imgly/background-removal module (lazy-loaded on first use) */
    imglyModule  : null,

    /** Index of the currently active item in the batch queue */
    activeIndex  : 0,

    /**
     * Batch queue array. Each item has the shape:
     * {
     *   file           : File,
     *   originalDataUrl: string,
     *   resultBlob     : Blob | null,
     *   resultDataUrl  : string | null,
     *   status         : 'pending' | 'processing' | 'done' | 'error'
     * }
     */
    batch        : [],

    /**
     * Active background replacement mode.
     * One of: 'transparent' | 'solid' | 'gradient' | 'image'
     */
    bgType       : 'transparent',

    /** HTMLImageElement for the custom background image (if uploaded) */
    bgImage      : null,

    /** Currently selected export format: 'png' or 'webp' */
    exportFormat : CONFIG.DEFAULT_FORMAT,

    /** Whether the user is currently dragging the compare slider */
    isDragging   : false,

    /** Current position of the compare slider as a 0–1 fraction */
    sliderFraction: 0.5,

    /**
     * Offscreen canvas holding the original (pre-removal) image.
     * Used to paint the BEFORE canvas in the comparison view.
     */
    originalCanvas: null,

    /**
     * Offscreen canvas holding the raw AI-processed result.
     * This transparent PNG is used as the source for all compositing.
     */
    removedCanvas : null,

    /** Active IndexedDB database handle (populated during DOMContentLoaded) */
    db           : null,
};


/* ============================================================
   3. DOM CACHE — Query all elements once to avoid repeated lookups
   ============================================================ */

/** @type {Object.<string, HTMLElement|NodeList>} */
const DOM = {};

/**
 * cacheDom()
 * Populates the DOM object with references to every interactive element.
 * Called once on DOMContentLoaded for optimal performance.
 */
function cacheDom() {

    // ── Upload / File Input ───────────────────────────────────
    DOM.dropzone        = document.getElementById('dropzone');
    DOM.fileInput       = document.getElementById('fileInput');
    DOM.batchQueue      = document.getElementById('batchQueue');
    DOM.batchThumbnails = document.getElementById('batchThumbnails');

    // ── Background Replacement Controls ──────────────────────
    DOM.bgTabs          = document.querySelectorAll('.bgr-bg-tab');
    DOM.ctrlSolid       = document.getElementById('ctrl-solid');
    DOM.ctrlGradient    = document.getElementById('ctrl-gradient');
    DOM.ctrlImage       = document.getElementById('ctrl-image');
    DOM.bgSolidColor    = document.getElementById('bgSolidColor');
    DOM.bgGradStart     = document.getElementById('bgGradStart');
    DOM.bgGradEnd       = document.getElementById('bgGradEnd');
    DOM.bgGradDir       = document.getElementById('bgGradDir');
    DOM.bgImgDropzone   = document.getElementById('bgImgDropzone');
    DOM.bgImgInput      = document.getElementById('bgImgInput');
    DOM.bgImgLabel      = document.getElementById('bgImgLabel');
    DOM.bgImgFit        = document.getElementById('bgImgFit');
    DOM.solidPresets    = document.getElementById('solidPresets');

    // ── Stroke (Outline) Controls ─────────────────────────────
    DOM.strokeEnabled   = document.getElementById('strokeEnabled');
    DOM.strokeControls  = document.getElementById('strokeControls');
    DOM.strokeWidth     = document.getElementById('strokeWidth');
    DOM.strokeWidthVal  = document.getElementById('strokeWidthVal');
    DOM.strokeColor     = document.getElementById('strokeColor');
    DOM.strokeFeather   = document.getElementById('strokeFeather');
    DOM.strokeFeatherVal= document.getElementById('strokeFeatherVal');
    DOM.strokePresets   = document.getElementById('strokePresets');

    // ── Drop Shadow Controls ──────────────────────────────────
    DOM.shadowEnabled   = document.getElementById('shadowEnabled');
    DOM.shadowControls  = document.getElementById('shadowControls');
    DOM.shadowBlur      = document.getElementById('shadowBlur');
    DOM.shadowBlurVal   = document.getElementById('shadowBlurVal');
    DOM.shadowOffX      = document.getElementById('shadowOffX');
    DOM.shadowOffXVal   = document.getElementById('shadowOffXVal');
    DOM.shadowOffY      = document.getElementById('shadowOffY');
    DOM.shadowOffYVal   = document.getElementById('shadowOffYVal');
    DOM.shadowOpacity   = document.getElementById('shadowOpacity');
    DOM.shadowOpacityVal= document.getElementById('shadowOpacityVal');
    DOM.shadowColor     = document.getElementById('shadowColor');

    // ── Export / Action Buttons ───────────────────────────────
    DOM.btnDownload     = document.getElementById('btnDownload');
    DOM.btnBatchDl      = document.getElementById('btnBatchDl');

    // ── History Containers ────────────────────────────────────
    DOM.historyGrid     = document.getElementById('historyGrid');
    DOM.historyPanelGrid= document.getElementById('historyPanelGrid');

    // ── Preview Tab Buttons & Content Panels ──────────────────
    DOM.tabBtns         = document.querySelectorAll('.bgr-tab-btn');
    DOM.viewCompare     = document.getElementById('view-compare');
    DOM.viewResult      = document.getElementById('view-result');
    DOM.viewHistory     = document.getElementById('view-history');

    // ── Preview UI Elements ───────────────────────────────────
    DOM.previewIdle       = document.getElementById('previewIdle');
    DOM.processingOverlay = document.getElementById('processingOverlay');
    DOM.processingStatus  = document.getElementById('processingStatus');
    DOM.progressBar       = document.getElementById('progressBar');
    DOM.compareContainer  = document.getElementById('compareContainer');
    DOM.compareBefore     = document.getElementById('compareBefore');
    DOM.compareAfter      = document.getElementById('compareAfter');
    DOM.compareHandle     = document.getElementById('compareHandle');
    DOM.canvasBefore      = document.getElementById('canvasBefore');
    DOM.canvasAfter       = document.getElementById('canvasAfter');
    DOM.canvasResult      = document.getElementById('canvasResult');
    DOM.canvasDimLabel    = document.getElementById('canvasDimLabel');
}


/* ============================================================
   4. LIBRARY LOADER — Dynamically load @imgly/background-removal
      The module is imported on-demand (not at page load) so the
      browser only downloads the ~50MB WASM bundle when needed.
   ============================================================ */

/**
 * loadImglyModule()
 * Imports the @imgly/background-removal ES module from CDN.
 * Uses a cached reference in STATE.imglyModule after the first load
 * so subsequent calls are instantaneous.
 *
 * @returns {Promise<object>} The loaded module object.
 * @throws  {Error}          If the CDN import fails (e.g. offline on first use).
 */
async function loadImglyModule() {
    // Return the cached module if already loaded
    if (STATE.imglyModule) return STATE.imglyModule;

    try {
        // Dynamic ESM import — browser caches the response automatically
        const module = await import(CONFIG.IMGLY_CDN);
        STATE.imglyModule = module;
        return module;
    } catch (err) {
        console.error('[BG Remover] Failed to load @imgly/background-removal:', err);
        throw new Error('AI library failed to load. Check your internet connection and try again.');
    }
}


/* ============================================================
   5. INDEXEDDB — Persistent local history (survives page refresh)
      Schema: { id (auto-increment), name, timestamp, dataUrl }
   ============================================================ */

/**
 * openDb()
 * Opens (or creates) the IndexedDB database for cutout history storage.
 * The object store is created with an auto-incrementing primary key.
 *
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(CONFIG.IDB_NAME, CONFIG.IDB_VERSION);

        // Called only when the DB is first created or upgraded
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(CONFIG.IDB_STORE)) {
                // Create the cutouts store with auto-increment PK
                db.createObjectStore(CONFIG.IDB_STORE, {
                    keyPath     : 'id',
                    autoIncrement: true
                });
            }
        };

        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

/**
 * saveToHistory()
 * Persists a processed image (as a base64 data URL) to IndexedDB.
 * Automatically trims the store to CONFIG.MAX_HISTORY entries,
 * deleting the oldest records first when the limit is exceeded.
 *
 * @param {string} dataUrl — Base64 PNG/WebP data URL of the processed image.
 * @param {string} name    — Original filename for display in the history grid.
 */
async function saveToHistory(dataUrl, name) {
    if (!STATE.db) return;

    const tx    = STATE.db.transaction(CONFIG.IDB_STORE, 'readwrite');
    const store = tx.objectStore(CONFIG.IDB_STORE);

    // Insert the new history entry
    store.add({ name, timestamp: Date.now(), dataUrl });

    // Prune: keep only the most recent MAX_HISTORY items
    const countReq = store.count();
    countReq.onsuccess = () => {
        const count = countReq.result;
        if (count > CONFIG.MAX_HISTORY) {
            // Open a cursor in ascending (oldest-first) order and delete excess
            const cursorReq = store.openCursor();
            let toDelete = count - CONFIG.MAX_HISTORY;

            cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && toDelete > 0) {
                    cursor.delete();
                    toDelete--;
                    cursor.continue(); // advance to next oldest record
                }
            };
        }
    };

    // Refresh the history UI after the transaction commits
    tx.oncomplete = () => renderHistoryUi();
}

/**
 * loadHistory()
 * Reads all records from the IndexedDB cutouts store and returns them
 * sorted with the most recently processed image first.
 *
 * @returns {Promise<Array>} Array of history record objects.
 */
async function loadHistory() {
    if (!STATE.db) return [];

    return new Promise((resolve) => {
        const tx      = STATE.db.transaction(CONFIG.IDB_STORE, 'readonly');
        const store   = tx.objectStore(CONFIG.IDB_STORE);
        const results = [];

        store.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                // Reverse so newest items appear first
                resolve(results.reverse());
            }
        };
    });
}

/**
 * clearHistory()
 * Deletes all records from the IndexedDB history store and refreshes the UI.
 */
async function clearHistory() {
    if (!STATE.db) return;
    const tx = STATE.db.transaction(CONFIG.IDB_STORE, 'readwrite');
    tx.objectStore(CONFIG.IDB_STORE).clear();
    tx.oncomplete = () => renderHistoryUi();

    // Notify the user via the global toast system
    window.showToast('History cleared');
}

/**
 * renderHistoryUi()
 * Rebuilds both the sidebar history widget (#historyGrid) and the History
 * tab panel (#historyPanelGrid) from IndexedDB.
 * Shows a placeholder message when no history entries exist.
 */
async function renderHistoryUi() {
    const items = await loadHistory();

    // ── Sidebar History Widget (compact thumbnail strip) ─────
    if (items.length === 0) {
        DOM.historyGrid.innerHTML = `
            <div class="bgr-history-empty">
                <i class="fa-solid fa-image" style="font-size:24px; opacity:0.2;"></i>
                <span>Processed images appear here</span>
            </div>`;
    } else {
        DOM.historyGrid.innerHTML = items.map((item, i) => `
            <div class="bgr-history-thumb" title="${escHtml(item.name)}"
                 onclick="loadHistoryItem(${item.id})">
                <img src="${item.dataUrl}" alt="Cutout ${i + 1}" loading="lazy">
            </div>
        `).join('');
    }

    // ── History Tab Panel (larger cards with filename + download) ──
    if (items.length === 0) {
        DOM.historyPanelGrid.innerHTML = `
            <div class="bgr-history-empty">
                <i class="fa-solid fa-box-archive" style="font-size:32px; opacity:0.2;"></i>
                <span>No history yet. Process an image to begin.</span>
            </div>`;
    } else {
        DOM.historyPanelGrid.innerHTML = items.map((item) => `
            <div class="bgr-history-panel-item" title="Click to reload this cutout">
                <img src="${item.dataUrl}" alt="${escHtml(item.name)}" loading="lazy"
                     onclick="loadHistoryItem(${item.id})">
                <div class="bgr-history-item-meta">
                    <span>${truncate(item.name, 14)}</span>
                    <button class="bgr-history-item-dl"
                            onclick="downloadDataUrl('${item.dataUrl}', '${escHtml(item.name)}')"
                            aria-label="Download this cutout">
                        <i class="fa-solid fa-download"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
}

/**
 * loadHistoryItem()
 * Retrieves a single history record from IndexedDB by its primary key,
 * paints the image onto the result canvases, and switches to the compare tab.
 *
 * @param {number} id — The auto-incremented IndexedDB record key.
 */
async function loadHistoryItem(id) {
    const tx  = STATE.db.transaction(CONFIG.IDB_STORE, 'readonly');
    const req = tx.objectStore(CONFIG.IDB_STORE).get(id);

    req.onsuccess = async (e) => {
        const item = e.target.result;
        if (!item) return;

        // Load the stored data URL back into an HTMLImageElement
        const img = await loadImageFromUrl(item.dataUrl);

        // Paint the image onto both the result canvas and the after-canvas
        paintRemovedImageToCanvases(img);

        setPreviewTab('compare');
        window.showToast(`Loaded "${truncate(item.name, 20)}" from history`);
    };
}


/* ============================================================
   6. UPLOAD / INPUT — Dropzone, file picker, batch queue
   ============================================================ */

/**
 * initUploadHandlers()
 * Attaches all event listeners for the main dropzone, the hidden file input,
 * and the mini background image dropzone.
 */
function initUploadHandlers() {
    const dz = DOM.dropzone;

    // Click or keyboard activation opens the file picker
    dz.addEventListener('click', () => DOM.fileInput.click());
    dz.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') DOM.fileInput.click();
    });

    // Drag & Drop: highlight zone, prevent default browser behavior
    dz.addEventListener('dragover',  (e) => {
        e.preventDefault();
        dz.classList.add('drag-over');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('drag-over');
        handleFiles(Array.from(e.dataTransfer.files));
    });

    // File <input> change — reset value so the same file can be re-selected
    DOM.fileInput.addEventListener('change', () => {
        handleFiles(Array.from(DOM.fileInput.files));
        DOM.fileInput.value = '';
    });

    // Mini dropzone for background image upload
    DOM.bgImgDropzone.addEventListener('click', () => DOM.bgImgInput.click());
    DOM.bgImgDropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') DOM.bgImgInput.click();
    });

    DOM.bgImgInput.addEventListener('change', async () => {
        const file = DOM.bgImgInput.files[0];
        if (!file) return;

        // Load the custom background image and store in STATE
        STATE.bgImage = await loadImageFromFile(file);
        DOM.bgImgLabel.textContent = truncate(file.name, 28);

        // Re-render the result with the new background applied
        renderResult();
    });
}

/**
 * handleFiles()
 * Validates the dropped/selected files against the accepted MIME type list,
 * builds the batch STATE array, renders the queue UI, and starts processing.
 *
 * @param {File[]} files — Array of File objects from the input or drop event.
 */
async function handleFiles(files) {
    // Filter out unsupported file types
    const valid = files.filter(f => CONFIG.ACCEPTED_TYPES.includes(f.type));

    if (valid.length === 0) {
        // Pass true as second argument for error styling in the global toast
        window.showToast('Please upload JPG, PNG, or WebP files only.', true);
        return;
    }

    // Append new files to the batch queue
    for (const file of valid) {
        const dataUrl = await fileToDataUrl(file);
        STATE.batch.push({
            file,
            originalDataUrl: dataUrl,
            resultBlob     : null,
            resultDataUrl  : null,
            status         : 'pending',  // 'pending' | 'processing' | 'done' | 'error'
        });
    }

    renderBatchQueue();

    // Show the batch queue strip if more than one image is queued
    if (STATE.batch.length > 1) {
        DOM.batchQueue.style.display = 'block';
    }

    // Kick off processing from the first unprocessed item
    processNextInQueue();
}

/**
 * renderBatchQueue()
 * Regenerates the thumbnail strip (#batchThumbnails) to reflect the current
 * batch STATE. Highlights the active item with a border.
 */
function renderBatchQueue() {
    DOM.batchThumbnails.innerHTML = STATE.batch.map((item, i) => `
        <div class="bgr-batch-thumb ${i === STATE.activeIndex ? 'active' : ''}"
             onclick="activateBatchItem(${i})"
             title="${escHtml(item.file.name)}">
            <img src="${item.originalDataUrl}" alt="Batch item ${i + 1}">
            <div class="bgr-batch-thumb-status ${statusClass(item.status)} ${item.status !== 'pending' ? 'visible' : ''}">
                ${statusIcon(item.status)}
            </div>
        </div>
    `).join('');
}

/**
 * statusClass()
 * Maps a batch item's status string to a CSS modifier class used by the
 * thumbnail status overlay badge.
 *
 * @param {string} s — 'pending' | 'processing' | 'done' | 'error'
 * @returns {string} CSS class string.
 */
function statusClass(s) {
    return { done: 'done', error: 'error', processing: 'pending', pending: '' }[s] || '';
}

/**
 * statusIcon()
 * Returns the appropriate FontAwesome HTML icon for a batch item's status.
 *
 * @param {string} s — Status string.
 * @returns {string} HTML string containing the <i> tag.
 */
function statusIcon(s) {
    return {
        done      : '<i class="fa-solid fa-check"></i>',
        error     : '<i class="fa-solid fa-xmark"></i>',
        processing: '<i class="fa-solid fa-spinner fa-spin"></i>',
        pending   : ''
    }[s] || '';
}

/**
 * activateBatchItem()
 * Switches the UI focus to a specific batch index. If the item is already
 * processed, its cached result is repainted without reprocessing. If the item
 * is still pending, it is queued for immediate processing.
 *
 * @param {number} index — Zero-based index into STATE.batch.
 */
function activateBatchItem(index) {
    STATE.activeIndex = index;
    renderBatchQueue();

    const item = STATE.batch[index];

    if (item.status === 'done') {
        // Restore this item's cached result by repainting both canvases
        loadImageFromUrl(item.resultDataUrl).then(img => {
            paintRemovedImageToCanvases(img);
            loadImageFromUrl(item.originalDataUrl).then(orig => paintOriginalCanvas(orig));
        });
    } else if (item.status === 'pending') {
        // Process this item immediately
        processItem(index);
    }
}

/**
 * clearQueue()
 * Empties the entire batch queue and resets all related UI state.
 */
function clearQueue() {
    STATE.batch        = [];
    STATE.activeIndex  = 0;
    DOM.batchQueue.style.display       = 'none';
    DOM.batchThumbnails.innerHTML      = '';
    resetCanvases();
    DOM.btnDownload.disabled = true;
    DOM.btnBatchDl.disabled  = true;
}

/**
 * processNextInQueue()
 * Scans the batch array for the next item with 'pending' status and
 * processes it. If all items are done or errored, returns silently.
 */
async function processNextInQueue() {
    const nextIndex = STATE.batch.findIndex(item => item.status === 'pending');
    if (nextIndex === -1) return; // nothing left to process
    await processItem(nextIndex);
}


/* ============================================================
   7. AI PROCESSING — Core background removal pipeline
   ============================================================ */

/**
 * processItem()
 * Processes a single batch item through the full AI background removal pipeline:
 *  1. Shows the processing overlay with a progress indicator.
 *  2. Loads (or uses the cached) @imgly/background-removal module.
 *  3. Calls removeBackground() with progress callbacks.
 *  4. Paints the result onto the canvases.
 *  5. Saves the result to IndexedDB history.
 *  6. Enables the Download/ZIP buttons on success.
 *  7. Advances the queue to process the next pending item.
 *
 * @param {number} index — Index of the batch item to process.
 */
async function processItem(index) {
    const item = STATE.batch[index];
    item.status = 'processing';
    STATE.activeIndex = index;
    renderBatchQueue();

    // Show the full-panel processing overlay
    DOM.previewIdle.style.display       = 'none';
    DOM.compareContainer.style.display  = 'none';
    DOM.processingOverlay.style.display = 'flex';
    setProgress(5, 'Loading AI model (first-time only, ~50MB cached)...');

    try {
        // Load the @imgly module (instantaneous if already cached in STATE)
        const module = await loadImglyModule();
        setProgress(20, 'AI model ready. Analysing image...');

        /**
         * module.removeBackground()
         * Accepts a File, Blob, or URL.
         * Returns a Blob (PNG with a full alpha channel).
         *
         * Configuration reference:
         * https://github.com/imgly/background-removal-js
         */
            const resultBlob = await module.removeBackground(item.file, {
            // CRITICAL: Load WASM and ONNX models from local folder (100% Offline)
            publicPath: CONFIG.ASSETS_PATH,

            // Progress callback — maps fetch + inference progress to 20%–90% UI range
            progress: (key, current, total) => {
                if (total > 0) {
                    const pct = 20 + Math.round((current / total) * 70);
                    setProgress(pct, `Processing… ${Math.round((current / total) * 100)}%`);
                }
            },

            output: {
                format : 'image/png', // always output a transparent PNG internally
                quality: 1.0,
            }
        });

        setProgress(95, 'Compositing result...');

        // Convert the returned Blob to a data URL for canvas drawing and persistence
        const resultDataUrl  = await blobToDataUrl(resultBlob);
        item.resultBlob      = resultBlob;
        item.resultDataUrl   = resultDataUrl;
        item.status          = 'done';

        // Load both images concurrently for performance
        const [removedImg, originalImg] = await Promise.all([
            loadImageFromUrl(resultDataUrl),
            loadImageFromUrl(item.originalDataUrl),
        ]);

        // Paint canvases with the original (before) and processed (after) images
        paintOriginalCanvas(originalImg);
        paintRemovedImageToCanvases(removedImg);

        setProgress(100, 'Done!');

        // Persist the result to the local IndexedDB history
        await saveToHistory(resultDataUrl, item.file.name);

        // Enable the Download button; enable ZIP only when all items are done
        DOM.btnDownload.disabled = false;
        if (STATE.batch.length > 1) {
            DOM.btnBatchDl.disabled = !STATE.batch.every(b => b.status === 'done');
        }

        // Success toast notification (global system)
        window.showToast(`"${truncate(item.file.name, 20)}" processed successfully!`);

    } catch (err) {
        console.error('[BG Remover] Processing failed:', err);
        item.status = 'error';

        // Error toast (global system — true = error styling)
        window.showToast(`Failed: ${err.message}`, true);
        DOM.previewIdle.style.display = 'flex';

    } finally {
        // Always hide the overlay and refresh the queue, then continue
        DOM.processingOverlay.style.display = 'none';
        renderBatchQueue();
        processNextInQueue();
    }
}

/**
 * setProgress()
 * Updates the progress bar fill width and status text message
 * inside the processing overlay.
 *
 * @param {number} pct  — Progress percentage (0–100).
 * @param {string} text — Human-readable status message.
 */
function setProgress(pct, text) {
    DOM.progressBar.style.width        = `${pct}%`;
    DOM.processingStatus.textContent   = text;
}


/* ============================================================
   8. CANVAS ENGINE — Compositing: BG + Stroke + Shadow + Subject
   ============================================================ */

/**
 * paintOriginalCanvas()
 * Draws the original (pre-removal) image onto the Before canvas
 * for the comparison slider view.
 *
 * @param {HTMLImageElement} img — The original unmodified image element.
 */
function paintOriginalCanvas(img) {
    const canvas  = DOM.canvasBefore;
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
}

/**
 * paintRemovedImageToCanvases()
 * Stores the AI-processed image in STATE.removedCanvas (an offscreen buffer),
 * then calls renderResult() to composite the full output onto the visible canvases.
 * Also updates the dimensions label and resets the slider to centre.
 *
 * @param {HTMLImageElement} img — Transparent PNG image element from the AI.
 */
function paintRemovedImageToCanvases(img) {
    // Store a persistent offscreen copy for re-use by renderResult()
    STATE.removedCanvas        = document.createElement('canvas');
    STATE.removedCanvas.width  = img.naturalWidth;
    STATE.removedCanvas.height = img.naturalHeight;
    STATE.removedCanvas.getContext('2d').drawImage(img, 0, 0);

    // Composite and paint the full result (with BG, stroke, shadow)
    renderResult();

    // Reveal the compare view and hide the idle placeholder
    DOM.compareContainer.style.display = 'flex';
    DOM.previewIdle.style.display      = 'none';

    // Update the dimensions label (shown in the Result tab action bar)
    DOM.canvasDimLabel.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;

    // Reset the slider handle to the 50% centre position
    STATE.sliderFraction = 0.5;
    updateSliderPosition(0.5);
}

/**
 * renderResult()
 * Full compositor: builds the final image with all applied effects onto
 * both canvasAfter (compare slider view) and canvasResult (result tab).
 *
 * Pipeline order:
 *   1. Background fill (transparent / solid / gradient / custom image)
 *   2. Drop shadow (drawn below the subject using blurred alpha mask)
 *   3. Stroke outline (dilated alpha mask filled with chosen color)
 *   4. Subject (the AI-removed foreground drawn on top)
 *
 * All compositing is done on an offscreen canvas at full source resolution
 * before being blitted to the two visible canvases.
 */
function renderResult() {
    if (!STATE.removedCanvas) return;

    const src = STATE.removedCanvas;
    const W   = src.width;
    const H   = src.height;

    // Allocate a full-resolution offscreen canvas for compositing
    const out  = document.createElement('canvas');
    out.width  = W;
    out.height = H;
    const ctx  = out.getContext('2d');

    // ── Step 1: Background ────────────────────────────────────
    drawBackground(ctx, W, H);

    // ── Step 2: Drop Shadow ───────────────────────────────────
    if (DOM.shadowEnabled.checked) {
        applyDropShadow(ctx, src, W, H);
    }

    // ── Step 3: Stroke Outline ────────────────────────────────
    if (DOM.strokeEnabled.checked) {
        applyStroke(ctx, src, W, H);
    }

    // ── Step 4: Subject (foreground) ──────────────────────────
    ctx.drawImage(src, 0, 0);

    // ── Blit to visible canvases ──────────────────────────────
    // After canvas — used by the Before/After comparison slider
    DOM.canvasAfter.width  = W;
    DOM.canvasAfter.height = H;
    DOM.canvasAfter.getContext('2d').drawImage(out, 0, 0);

    // Result canvas — shown in the Result preview tab
    DOM.canvasResult.width  = W;
    DOM.canvasResult.height = H;
    DOM.canvasResult.getContext('2d').drawImage(out, 0, 0);
}

/**
 * drawBackground()
 * Paints the selected background type onto the provided 2D context.
 * Does nothing for the 'transparent' mode (canvas stays transparent).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W — Canvas width in pixels.
 * @param {number} H — Canvas height in pixels.
 */
function drawBackground(ctx, W, H) {
    switch (STATE.bgType) {

        case 'transparent':
            // Canvas default is transparent — no action required
            break;

        case 'solid':
            // Fill with a flat color from the color picker
            ctx.fillStyle = DOM.bgSolidColor.value;
            ctx.fillRect(0, 0, W, H);
            break;

        case 'gradient': {
            // Build a linear or radial gradient from the two color pickers
            const dir = DOM.bgGradDir.value;
            let grad;

            if (dir === 'radial') {
                // Radial gradient centred on the canvas
                grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) / 2);
            } else {
                // Linear gradient — convert direction string to coordinates
                const coords = gradientCoords(dir, W, H);
                grad = ctx.createLinearGradient(...coords);
            }

            grad.addColorStop(0, DOM.bgGradStart.value);
            grad.addColorStop(1, DOM.bgGradEnd.value);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            break;
        }

        case 'image':
            // Draw the custom background image with the selected fit mode
            if (STATE.bgImage) {
                drawBgImage(ctx, STATE.bgImage, W, H, DOM.bgImgFit.value);
            }
            break;
    }
}

/**
 * gradientCoords()
 * Converts a CSS gradient direction string to the [x0, y0, x1, y1]
 * coordinate array required by CanvasRenderingContext2D.createLinearGradient().
 *
 * @param {string} dir — CSS direction (e.g. 'to right', '135deg').
 * @param {number} W   — Canvas width.
 * @param {number} H   — Canvas height.
 * @returns {number[]} Four-element coordinate array.
 */
function gradientCoords(dir, W, H) {
    const map = {
        'to right'    : [0, 0, W, 0],
        'to bottom'   : [0, 0, 0, H],
        '135deg'      : [0, 0, W, H],
        'to top right': [0, H, W, 0],
    };
    return map[dir] || [0, 0, W, 0];
}

/**
 * drawBgImage()
 * Renders a custom background image onto the canvas using one of three
 * fit modes: cover (fills the canvas, may crop), contain (fits fully, may
 * letterbox), or stretch (ignores aspect ratio).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement}         img  — The background image element.
 * @param {number}                   W    — Canvas width.
 * @param {number}                   H    — Canvas height.
 * @param {string}                   mode — 'cover' | 'contain' | 'stretch'.
 */
function drawBgImage(ctx, img, W, H, mode) {
    const iW = img.naturalWidth;
    const iH = img.naturalHeight;

    if (mode === 'stretch') {
        // Ignore aspect ratio — stretch to fill canvas entirely
        ctx.drawImage(img, 0, 0, W, H);
        return;
    }

    // Compute scale factor that either fills (cover) or fits (contain) the canvas
    const scale = mode === 'cover'
        ? Math.max(W / iW, H / iH)
        : Math.min(W / iW, H / iH);

    const sw = iW * scale;
    const sh = iH * scale;

    // Centre the image on the canvas
    const sx = (W - sw) / 2;
    const sy = (H - sh) / 2;

    ctx.drawImage(img, sx, sy, sw, sh);
}

/**
 * applyDropShadow()
 * Generates a soft drop shadow beneath the subject by:
 *  1. Creating an offscreen mask canvas painted with the subject's alpha shape.
 *  2. Tinting the mask to the chosen shadow color.
 *  3. Applying a CSS blur filter and global alpha to simulate depth.
 *  4. Drawing the blurred, offset, tinted mask onto the destination context.
 *
 * @param {CanvasRenderingContext2D} ctx  — Destination compositing context.
 * @param {HTMLCanvasElement}        src  — Offscreen removed-background canvas.
 * @param {number}                   W    — Width.
 * @param {number}                   H    — Height.
 */
function applyDropShadow(ctx, src, W, H) {
    const blur    = parseInt(DOM.shadowBlur.value);
    const offX    = parseInt(DOM.shadowOffX.value);
    const offY    = parseInt(DOM.shadowOffY.value);
    const opacity = parseInt(DOM.shadowOpacity.value) / 100;
    const color   = DOM.shadowColor.value;

    // Decompose hex color into RGB components for rgba() usage
    const { r, g, b } = hexToRgb(color);

    // ── Build the tinted shadow mask ──────────────────────────
    const maskCanvas  = document.createElement('canvas');
    maskCanvas.width  = W;
    maskCanvas.height = H;
    const maskCtx     = maskCanvas.getContext('2d');

    // Draw subject alpha shape onto the mask
    maskCtx.drawImage(src, 0, 0);

    // Tint the mask to the shadow color using source-in compositing
    maskCtx.globalCompositeOperation = 'source-in';
    maskCtx.fillStyle = `rgb(${r},${g},${b})`;
    maskCtx.fillRect(0, 0, W, H);

    // ── Composite the blurred, offset shadow onto the destination ──
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.filter      = `blur(${blur}px)`;

    // Draw the shadow mask at the specified offset
    ctx.drawImage(maskCanvas, offX, offY);

    ctx.filter      = 'none';
    ctx.globalAlpha = 1;
    ctx.restore();
}

/**
 * applyStroke()
 * Draws a crisp color outline around the subject boundary using a
 * canvas shadow-based dilation technique:
 *
 * Algorithm:
 *  1. Create an offscreen mask canvas.
 *  2. Repeatedly draw the subject with a large shadowBlur + color offset in
 *     all four diagonal directions — this "expands" the alpha silhouette.
 *  3. Use destination-out compositing to punch out the original alpha shape,
 *     leaving only the border region filled with the stroke color.
 *  4. Composite the stroke mask below the subject on the main canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement}        src
 * @param {number}                   W
 * @param {number}                   H
 */
function applyStroke(ctx, src, W, H) {
    const strokeW        = parseInt(DOM.strokeWidth.value);
    const feather        = parseInt(DOM.strokeFeather.value);
    const color          = DOM.strokeColor.value;
    const { r, g, b }   = hexToRgb(color);

    // ── Build the dilated stroke mask ─────────────────────────
    const maskCanvas  = document.createElement('canvas');
    maskCanvas.width  = W;
    maskCanvas.height = H;
    const maskCtx     = maskCanvas.getContext('2d');

    // Set shadow to the stroke color + combined blur (width + feather)
    maskCtx.shadowColor = `rgb(${r},${g},${b})`;
    maskCtx.shadowBlur  = strokeW + feather;

    // Multiple draw passes ensure even fill at large stroke widths.
    // Each pass offsets the shadow in one of the four diagonal directions.
    const passes = Math.max(1, Math.ceil(strokeW / 4));
    for (let p = 0; p < passes; p++) {
        maskCtx.shadowOffsetX = strokeW * Math.cos((Math.PI / 2) * p);
        maskCtx.shadowOffsetY = strokeW * Math.sin((Math.PI / 2) * p);
        maskCtx.drawImage(src, 0, 0);
    }

    // Reset shadow settings before the knockout pass
    maskCtx.shadowBlur    = 0;
    maskCtx.shadowOffsetX = 0;
    maskCtx.shadowOffsetY = 0;

    // Knockout: remove the subject's interior from the mask,
    // leaving only the surrounding stroke border region
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.drawImage(src, 0, 0);
    maskCtx.globalCompositeOperation = 'source-over';

    // ── Composite the stroke mask below the subject ───────────
    ctx.drawImage(maskCanvas, 0, 0);
}


/* ============================================================
   9. BEFORE/AFTER COMPARISON SLIDER
   ============================================================ */

/**
 * initCompareSlider()
 * Binds all pointer (mouse + touch) events required for the
 * interactive Before/After comparison slider drag behavior.
 */
function initCompareSlider() {
    const container = DOM.compareContainer;

    // Desktop mouse events
    container.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove',    onDragMove);
    window.addEventListener('mouseup',      onDragEnd);

    // Mobile touch events (passive where possible for scroll performance)
    container.addEventListener('touchstart', onDragStart, { passive: true });
    window.addEventListener('touchmove',    onDragMove,  { passive: true });
    window.addEventListener('touchend',     onDragEnd);
}

/** Marks the drag as active and immediately updates the slider position. */
function onDragStart(e) {
    STATE.isDragging = true;
    updateSliderFromEvent(e);
}

/** Moves the slider to follow the pointer while dragging is active. */
function onDragMove(e) {
    if (!STATE.isDragging) return;
    updateSliderFromEvent(e);
}

/** Marks the drag as ended. */
function onDragEnd() {
    STATE.isDragging = false;
}

/**
 * updateSliderFromEvent()
 * Computes the pointer's horizontal position as a 0–1 fraction relative
 * to the compare container and updates the slider accordingly.
 *
 * @param {MouseEvent|TouchEvent} e
 */
function updateSliderFromEvent(e) {
    const container = DOM.compareContainer;
    const rect      = container.getBoundingClientRect();

    // Normalize for both mouse and touch events
    const clientX   = e.touches ? e.touches[0].clientX : e.clientX;
    const fraction  = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));

    STATE.sliderFraction = fraction;
    updateSliderPosition(fraction);
}

/**
 * updateSliderPosition()
 * Moves the slider handle and updates the clip-path of the AFTER layer
 * to reveal the processed result up to the slider position.
 *
 * @param {number} fraction — 0.0 = full before view, 1.0 = full after view.
 */
function updateSliderPosition(fraction) {
    const pct = fraction * 100;

    // Move the handle to the new position
    DOM.compareHandle.style.left = `${pct}%`;

    // Clip the after layer: inset from right = remaining fraction
    const rightInset = (1 - fraction) * 100;
    DOM.compareAfter.style.clipPath = `inset(0 ${rightInset}% 0 0)`;
}


/* ============================================================
   10. PREVIEW TABS — Switch between Compare / Result / History
   ============================================================ */

/**
 * setPreviewTab()
 * Toggles the active state on both the tab buttons (.bgr-tab-btn)
 * and the content panels (.bgr-preview-content) to show the correct panel.
 * Refreshes history data when the History tab is opened.
 *
 * @param {string} mode — 'compare' | 'result' | 'history'
 */
function setPreviewTab(mode) {
    // Toggle active class on tab navigation buttons
    DOM.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Toggle active class on tab content panels
    DOM.viewCompare.classList.toggle('active', mode === 'compare');
    DOM.viewResult.classList.toggle('active',  mode === 'result');
    DOM.viewHistory.classList.toggle('active', mode === 'history');

    // Reload the history grid when the user opens the History tab
    if (mode === 'history') renderHistoryUi();
}


/* ============================================================
   11. EXPORT — Download single image or batch ZIP archive
   ============================================================ */

/**
 * downloadResult()
 * Exports the current canvasResult to a file in the selected format
 * (PNG or WebP) and triggers a browser download via FileSaver.js.
 */
function downloadResult() {
    if (!DOM.canvasResult.width) {
        // Error toast if no image has been processed yet
        window.showToast('Nothing to download yet. Process an image first.', true);
        return;
    }

    const format   = STATE.exportFormat === 'webp' ? 'image/webp' : 'image/png';
    const ext      = STATE.exportFormat;
    const filename = buildExportFilename(STATE.batch[STATE.activeIndex]?.file?.name, ext);

    // toBlob is asynchronous — FileSaver.js handles the browser download
    DOM.canvasResult.toBlob((blob) => {
        saveAs(blob, filename); // FileSaver.js global
        window.showToast(`Downloaded as ${filename}`);
    }, format, 0.95);
}

/**
 * downloadBatchZip()
 * Packages all successfully processed batch images into a single ZIP archive
 * using JSZip and triggers a download via FileSaver.js.
 */
async function downloadBatchZip() {
    const done = STATE.batch.filter(item => item.status === 'done');

    if (done.length === 0) {
        window.showToast('No processed images to export.', true);
        return;
    }

    window.showToast(`Building ZIP with ${done.length} image(s)...`);

    const zip    = new JSZip();
    const folder = zip.folder('bg-removed');

    // Add each processed image blob to the ZIP folder
    for (const item of done) {
        const filename = buildExportFilename(item.file.name, STATE.exportFormat);
        const blob     = await dataUrlToBlob(item.resultDataUrl);
        folder.file(filename, blob);
    }

    // Generate the ZIP blob with DEFLATE compression, then download
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    saveAs(zipBlob, 'bg-removed-batch.zip'); // FileSaver.js global
    window.showToast('ZIP downloaded successfully!');
}

/**
 * copyToClipboard()
 * Copies the current canvasResult image (as a PNG blob) to the system
 * clipboard using the Clipboard API (requires HTTPS + user gesture).
 */
async function copyToClipboard() {
    if (!DOM.canvasResult.width) return;

    try {
        const blob = await new Promise(res => DOM.canvasResult.toBlob(res, 'image/png'));
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        window.showToast('Image copied to clipboard!');
    } catch (err) {
        window.showToast('Clipboard access denied. Please use Download instead.', true);
    }
}

/**
 * downloadDataUrl()
 * Downloads an arbitrary data URL as a file by creating a temporary
 * <a> anchor element. Used by the History tab download buttons.
 *
 * @param {string} dataUrl — Base64 data URL to download.
 * @param {string} name    — Original filename (used to build export name).
 */
function downloadDataUrl(dataUrl, name) {
    const link    = document.createElement('a');
    link.href     = dataUrl;
    link.download = buildExportFilename(name, STATE.exportFormat);
    link.click();
}

/**
 * buildExportFilename()
 * Builds a sanitized, human-readable export filename.
 * Example: "product photo.jpg" → "product_photo-bg-removed.png"
 *
 * @param {string} original — Original filename (may be undefined).
 * @param {string} ext      — Target extension ('png' or 'webp').
 * @returns {string}
 */
function buildExportFilename(original, ext) {
    const base = original
        ? original.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'image';
    return `${base}-bg-removed.${ext}`;
}

/**
 * setExportFormat()
 * Updates the active export format in STATE and reflects the selection
 * visually on the format toggle buttons (.bgr-fmt-tab).
 *
 * @param {string} fmt — 'png' | 'webp'
 */
function setExportFormat(fmt) {
    STATE.exportFormat = fmt;
    document.querySelectorAll('.bgr-fmt-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.fmt === fmt);
    });
}


/* ============================================================
   12. UI HELPERS — Sliders, toggles, color presets, BG tabs
   ============================================================ */

/**
 * setBgType()
 * Switches the active background replacement mode, updates the tab
 * button active states, shows/hides the relevant control panels,
 * and re-renders the result canvas.
 *
 * @param {string} type — 'transparent' | 'solid' | 'gradient' | 'image'
 */
function setBgType(type) {
    STATE.bgType = type;

    // Update the active state on each background type tab
    DOM.bgTabs.forEach(t => t.classList.toggle('active', t.dataset.bg === type));

    // Show only the control panel relevant to the selected background type
    DOM.ctrlSolid.style.display    = type === 'solid'    ? 'block' : 'none';
    DOM.ctrlGradient.style.display = type === 'gradient' ? 'block' : 'none';
    DOM.ctrlImage.style.display    = type === 'image'    ? 'block' : 'none';

    // Re-composite the result with the new background
    renderResult();
}

/**
 * initSliders()
 * Binds all range <input> elements to their companion label spans.
 * Updates the live value display and triggers a full re-render on each
 * input event so the canvas preview updates in real time.
 */
function initSliders() {
    const sliders = [
        { el: DOM.strokeWidth,   label: DOM.strokeWidthVal,   suffix: 'px' },
        { el: DOM.strokeFeather, label: DOM.strokeFeatherVal, suffix: 'px' },
        { el: DOM.shadowBlur,    label: DOM.shadowBlurVal,    suffix: 'px' },
        { el: DOM.shadowOffX,    label: DOM.shadowOffXVal,    suffix: 'px' },
        { el: DOM.shadowOffY,    label: DOM.shadowOffYVal,    suffix: 'px' },
        { el: DOM.shadowOpacity, label: DOM.shadowOpacityVal, suffix: '%'  },
    ];

    sliders.forEach(({ el, label, suffix }) => {
        el.addEventListener('input', () => {
            label.textContent = el.value + suffix; // update live display
            renderResult();                          // re-composite immediately
        });
    });
}

/**
 * initColorPickers()
 * Attaches 'input' listeners to all color pickers and the gradient direction
 * / bg image fit selects, triggering a re-render on every change.
 */
function initColorPickers() {
    [
        DOM.bgSolidColor,
        DOM.bgGradStart, DOM.bgGradEnd,
        DOM.strokeColor, DOM.shadowColor,
    ].forEach(picker => {
        picker.addEventListener('input', () => renderResult());
    });

    // Gradient direction select and BG image fit select
    DOM.bgGradDir.addEventListener('change', () => renderResult());
    DOM.bgImgFit.addEventListener('change',  () => renderResult());
}

/**
 * initToggles()
 * Wires the stroke and shadow enable/disable checkboxes to show/hide their
 * respective control panels and immediately re-render the canvas.
 */
function initToggles() {
    DOM.strokeEnabled.addEventListener('change', () => {
        DOM.strokeControls.style.display = DOM.strokeEnabled.checked ? 'block' : 'none';
        renderResult();
    });

    DOM.shadowEnabled.addEventListener('change', () => {
        DOM.shadowControls.style.display = DOM.shadowEnabled.checked ? 'block' : 'none';
        renderResult();
    });
}

/**
 * buildColorPresets()
 * Dynamically injects a row of clickable color swatches (.color-swatch)
 * into a container element. Clicking a swatch selects it (visual ring),
 * calls the provided onSelect callback with the hex color, and triggers
 * a re-render.
 *
 * @param {HTMLElement} container — Target element to inject swatches into.
 * @param {string[]}    colors    — Array of hex color strings.
 * @param {function}    onSelect  — Callback called with the selected hex color.
 */
function buildColorPresets(container, colors, onSelect) {
    container.innerHTML = colors.map(c => `
        <div class="color-swatch"
             style="background:${c}; border-color: ${c === '#ffffff' ? '#ccc' : 'transparent'};"
             title="${c}"
             data-color="${c}"
             onclick="this.parentElement.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected')); this.classList.add('selected');">
        </div>
    `).join('');

    // Attach click listeners after injection
    container.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            onSelect(swatch.dataset.color);
        });
    });
}


/* ============================================================
   UI HELPER: resetTool()
   Resets the entire tool to its initial blank state.
   ============================================================ */

/**
 * resetTool()
 * Clears all batch, canvas, and state data. Returns the UI to the
 * idle (no image loaded) state and resets all controls to defaults.
 */
function resetTool() {
    // Clear batch state
    STATE.batch          = [];
    STATE.activeIndex    = 0;
    STATE.bgType         = 'transparent';
    STATE.bgImage        = null;
    STATE.removedCanvas  = null;
    STATE.originalCanvas = null;

    // Reset UI elements
    DOM.batchQueue.style.display        = 'none';
    DOM.batchThumbnails.innerHTML       = '';
    DOM.btnDownload.disabled            = true;
    DOM.btnBatchDl.disabled             = true;
    DOM.previewIdle.style.display       = 'flex';
    DOM.compareContainer.style.display  = 'none';
    DOM.processingOverlay.style.display = 'none';
    DOM.canvasDimLabel.textContent      = '–';

    // Clear all canvas surfaces
    resetCanvases();

    // Restore background and tab defaults
    setBgType('transparent');
    setPreviewTab('compare');

    window.showToast('Tool has been reset.');
}

/**
 * resetCanvases()
 * Clears (zeroes) all three visible canvases (before, after, result).
 */
function resetCanvases() {
    [DOM.canvasBefore, DOM.canvasAfter, DOM.canvasResult].forEach(c => {
        c.width  = 0;
        c.height = 0;
    });
}


/* ============================================================
   13. UTILITY FUNCTIONS
   ============================================================ */

/**
 * fileToDataUrl()
 * Reads a File object into a base64-encoded data URL using FileReader.
 *
 * @param {File} file
 * @returns {Promise<string>} Base64 data URL.
 */
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader   = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * blobToDataUrl()
 * Converts a Blob to a base64-encoded data URL using FileReader.
 *
 * @param {Blob} blob
 * @returns {Promise<string>} Base64 data URL.
 */
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader   = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * dataUrlToBlob()
 * Converts a data URL back to a Blob by fetching the data URL internally.
 * Used when building the ZIP archive from cached data URLs.
 *
 * @param {string} dataUrl
 * @returns {Promise<Blob>}
 */
async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
}

/**
 * loadImageFromFile()
 * Loads a File object into an HTMLImageElement using an object URL.
 * Revokes the object URL automatically after load to free memory.
 *
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageFromFile(file) {
    return new Promise((resolve) => {
        const url    = URL.createObjectURL(file);
        const img    = new Image();
        img.onload   = () => { URL.revokeObjectURL(url); resolve(img); };
        img.src      = url;
    });
}

/**
 * loadImageFromUrl()
 * Loads a data URL or blob URL string into an HTMLImageElement.
 *
 * @param {string} url — Data URL or object URL string.
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const img    = new Image();
        img.onload   = () => resolve(img);
        img.onerror  = reject;
        img.src      = url;
    });
}

/**
 * hexToRgb()
 * Parses a hex color string and returns an object with r, g, b components.
 * Used by applyDropShadow() and applyStroke() to build rgba() color values.
 *
 * @param {string} hex — Hex color string (e.g. '#ff0055' or 'ff0055').
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
}

/**
 * escHtml()
 * Sanitizes a string for safe insertion into HTML attributes and innerHTML.
 * Prevents XSS by escaping the five dangerous HTML characters.
 *
 * @param {string} str — Unsanitized string (e.g. filename from user input).
 * @returns {string} Escaped string safe for HTML context.
 */
function escHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}

/**
 * truncate()
 * Shortens a string to `max` characters and appends an ellipsis if needed.
 * Used in UI labels and toast messages to avoid overflow.
 *
 * @param {string} str — String to truncate.
 * @param {number} max — Maximum character count.
 * @returns {string}
 */
function truncate(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : str;
}


/* ============================================================
   14. INITIALIZATION — Wire all modules on DOMContentLoaded
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {

    // ── Cache all DOM references ──────────────────────────────
    cacheDom();

    // ── Open (or create) the IndexedDB history store ──────────
    // Wrapped in try/catch because IndexedDB is unavailable in some
    // browser private modes (e.g. Firefox private browsing).
    try {
        STATE.db = await openDb();
        await renderHistoryUi();
    } catch (err) {
        console.warn('[BG Remover] IndexedDB unavailable (private mode?):', err);
    }

    // ── Mobile / WebAssembly capability warning ───────────────
    // Warn mobile users if their browser may struggle with the WASM AI model.
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        const hasWasm = typeof WebAssembly === 'object';
        if (!hasWasm) {
            // Global error toast warning (true = error styling)
            window.showToast(
                'WebAssembly is not supported on your browser. AI processing may not work.',
                true
            );
        } else {
            // Informational toast for mobile users
            window.showToast(
                'Mobile detected: AI processing may be slower on low-powered devices.'
            );
        }
    }

    // ── Initialise event handlers and UI subsystems ───────────
    initUploadHandlers();
    initSliders();
    initColorPickers();
    initToggles();
    initCompareSlider();

    // ── Inject color preset swatches ─────────────────────────
    // Solid background color presets
    buildColorPresets(DOM.solidPresets, CONFIG.SOLID_PRESETS, (color) => {
        DOM.bgSolidColor.value = color;
        renderResult();
    });

    // Stroke / outline color presets
    buildColorPresets(DOM.strokePresets, CONFIG.STROKE_PRESETS, (color) => {
        DOM.strokeColor.value = color;
        renderResult();
    });

    // ── Optional: Pre-warm the AI module in background ────────
    // Uncomment the line below to begin downloading the ~50MB ONNX model
    // immediately on page load, reducing wait time on the user's first image.
    // Only enable if your users are likely to use the tool (high bounce = waste).
    // loadImglyModule().catch(() => {});

    console.log('[BG Remover Ultra Max] Initialized. Ready.');
});


/* ============================================================
   GLOBAL FUNCTION EXPORTS
   Attaches all functions called by inline onclick="" handlers
   in the HTML to the window object for global scope access.
   ============================================================ */
window.setBgType         = setBgType;
window.setPreviewTab     = setPreviewTab;
window.setExportFormat   = setExportFormat;
window.downloadResult    = downloadResult;
window.downloadBatchZip  = downloadBatchZip;
window.copyToClipboard   = copyToClipboard;
window.downloadDataUrl   = downloadDataUrl;
window.resetTool         = resetTool;
window.clearQueue        = clearQueue;
window.clearHistory      = clearHistory;
window.loadHistoryItem   = loadHistoryItem;
window.activateBatchItem = activateBatchItem;
