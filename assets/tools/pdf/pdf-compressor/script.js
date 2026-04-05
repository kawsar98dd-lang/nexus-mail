/**
 * =============================================================================
 *  PDF COMPRESS TITANIUM — PRODUCTION SCRIPT
 * =============================================================================
 *  File    : script.js
 *  Version : 3.1.0  (CodeCanyon Release Build — Refactored)
 *  Author  : MD KAWSAR
 *  Project : Trusted Tools Web
 *
 *  Architecture Overview:
 *  ─────────────────────────────────────────────────────────────────────────
 *  • Global Toast System      : All notifications routed through
 *                               window.showToast() injected by global.js.
 *                               Error toasts use boolean `true` as the
 *                               second argument per site convention.
 *  • PDF.js Integration       : Parses and renders each PDF page to an
 *                               off-screen HTML5 <canvas> element.
 *  • jsPDF Integration        : Assembles compressed JPEG frames into a
 *                               brand-new, lightweight PDF document.
 *  • Sequential Page Pipeline : Processes one page at a time to prevent
 *                               out-of-memory crashes on large files.
 *  • Intelligent Scale Factor : Dynamically adjusts render DPI based on
 *                               the selected quality tier.
 *  • File Size Validation     : Enforces a strict 50 MB upload ceiling.
 *  • PDF Pre-Validation       : Detects password-protected or corrupted
 *                               files before compression begins.
 *  • Button State Machine     : Single action button toggles cleanly
 *                               between "Compress" and "Download" states.
 *  • Orientation Detection    : Correctly handles portrait & landscape pages.
 *  • Mobile API Warning       : Detects mobile browsers and warns if the
 *                               device may struggle with large files.
 * =============================================================================
 */

'use strict';

// =============================================================================
// PDF.js WORKER CONFIGURATION
// =============================================================================
/**
 * Point PDF.js at its companion Web Worker script.
 * The worker handles PDF parsing off the main thread, preventing UI freezes.
 * Path must match the localised library location in the project structure.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc =
    '../../assets/library/pdf-engine/jspdf/pdf.worker.min.js';


// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum permitted upload size in bytes (50 MB). Files exceeding this limit
 *  are rejected before any processing begins to protect browser memory. */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Milliseconds to yield to the browser's UI thread between page renders.
 *  Prevents an "Application Not Responding" (ANR) state on heavy documents. */
const RENDER_YIELD_DELAY_MS = 30;


// =============================================================================
// APPLICATION STATE
// =============================================================================

/** @type {File|null} The PDF file object currently loaded by the user. */
let selectedFile = null;

/** @type {Blob|null} The compressed output blob — kept for potential future use. */
let compressedBlob = null;

/** @type {boolean} Guard flag: true after compression succeeds. Prevents the
 *  action button from re-triggering the compression pipeline on double-click. */
let isDownloadReady = false;


// =============================================================================
// DOM ELEMENT REFERENCES
// =============================================================================
/**
 * Cache all frequently accessed DOM nodes at module load time.
 * This avoids repeated getElementById() calls during the hot compression loop.
 */
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const fileCard      = document.getElementById('file-card');
const settingsPanel = document.getElementById('settings-panel');
const actionArea    = document.getElementById('action-area');
const rangeSlider   = document.getElementById('compression-range');
const resultSummary = document.getElementById('result-summary');
const btnAction     = document.getElementById('btn-action');
const progressBar   = document.getElementById('progress-bar');
const statusText    = document.getElementById('status-text');


// =============================================================================
// MOBILE BROWSER CAPABILITY WARNING
// =============================================================================
/**
 * On page load, detect whether the user is on a mobile/tablet device.
 * If so, display a soft advisory toast (non-blocking) informing them that
 * processing very large PDFs may be slow due to limited mobile memory.
 * This check runs once after the global.js module has had time to initialise
 * the window.showToast function (deferred by 800 ms).
 */
(function checkMobileCapability() {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
        setTimeout(() => {
            window.showToast(
                'Mobile Device Detected',
                'For best results, use a desktop browser. Large PDFs may be slower to process on mobile devices.'
            );
        }, 800);
    }
})();


// =============================================================================
// DRAG & DROP EVENT HANDLING
// =============================================================================

/**
 * Prevent the browser's default behaviour (open file in tab) for all
 * four drag lifecycle events on the drop zone. Also suppresses event bubbling
 * so parent elements do not accidentally handle the same event.
 */
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

/**
 * Apply the visual 'dragover' highlight class when a file enters or hovers
 * over the drop zone. This gives the user clear drop-target feedback.
 */
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('dragover');
    }, false);
});

/**
 * Remove the 'dragover' highlight when the drag leaves the zone or the
 * file is dropped — restoring the zone to its resting appearance.
 */
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('dragover');
    }, false);
});

/**
 * Attach the drop handler and the file-input change handler.
 * The slider's input event updates the quality label in real time.
 */
dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFileInputChange, false);
rangeSlider.addEventListener('input', e => updateQualityLabel(e.target.value));

/**
 * handleDrop
 * ──────────
 * Extracts the first file from the native DragEvent dataTransfer payload
 * and routes it through the central file-processing pipeline.
 *
 * @param {DragEvent} e - The native drag-and-drop event fired on the zone.
 */
function handleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length) {
        processSelectedFile(files[0]);
    }
}

/**
 * handleFileInputChange
 * ──────────────────────
 * Fires when the user selects a file via the hidden <input type="file">
 * native picker dialog. Routes the chosen file to processSelectedFile().
 */
function handleFileInputChange() {
    if (this.files.length) {
        processSelectedFile(this.files[0]);
    }
}


// =============================================================================
// FILE VALIDATION & UI INITIALISATION
// =============================================================================

/**
 * processSelectedFile
 * ────────────────────
 * Entry point for any new file selection (drop or browse).
 * Performs two lightweight client-side validations before updating the UI:
 *   1. MIME type must be 'application/pdf'.
 *   2. File size must not exceed MAX_FILE_SIZE_BYTES (50 MB).
 *
 * On success:
 *   • Stores the file reference in `selectedFile`.
 *   • Resets compression state flags.
 *   • Populates the file info card with metadata.
 *   • Transitions the UI from upload zone to tool controls.
 *   • Triggers a silent PDF pre-validation (password / corruption check).
 *
 * @param {File} file - The File object provided by the browser.
 */
function processSelectedFile(file) {

    // ── Validation: MIME type ──────────────────────────────────────────────
    if (file.type !== 'application/pdf') {
        window.showToast('Invalid File Type — Please upload a valid PDF (.pdf) file.', true);
        return;
    }

    // ── Validation: File size ceiling ──────────────────────────────────────
    if (file.size > MAX_FILE_SIZE_BYTES) {
        window.showToast(
            `File Too Large — The selected file exceeds the 50 MB limit. Please choose a smaller file.`,
            true
        );
        return;
    }

    // ── Store file reference & reset state ─────────────────────────────────
    selectedFile    = file;
    isDownloadReady = false;
    compressedBlob  = null;

    // ── Populate file metadata in the info card ───────────────────────────
    document.getElementById('display-name').textContent  = file.name;
    document.getElementById('original-size').textContent = formatBytes(file.size);

    // ── Transition UI from upload zone to tool controls ───────────────────
    dropZone.classList.add('hidden');         // hide the drop zone
    fileCard.style.display    = 'flex';       // reveal the file info card
    settingsPanel.classList.add('active');    // expand compression settings
    actionArea.style.display  = 'block';      // show the action button area
    resultSummary.classList.add('d-none');    // ensure results are hidden

    // ── Reset action button to initial "Compress" state ───────────────────
    setButtonToCompressState();
    updateQualityLabel(rangeSlider.value);

    // ── Pre-validate PDF (password / corruption check) ────────────────────
    validatePDF(file);
}

/**
 * validatePDF
 * ────────────
 * Silently attempts to open the PDF with PDF.js before the user clicks
 * "Compress". If the document is password-protected or corrupted, a clear
 * error toast is shown and the tool resets — preventing a confusing mid-
 * compression failure.
 *
 * Handled error types:
 *   • PasswordException  — PDF requires a password to open.
 *   • InvalidPDFException — File is corrupted or is not a real PDF.
 *
 * @param {File} file - The PDF file to validate.
 * @returns {Promise<void>}
 */
async function validatePDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        // Validation passed — no action needed.
    } catch (error) {

        if (error.name === 'PasswordException') {
            window.showToast(
                'Password Protected — This PDF requires a password. Please remove the password and try again.',
                true
            );
            resetTool();

        } else if (error.name === 'InvalidPDFException') {
            window.showToast(
                'Invalid PDF — This file appears to be corrupted or is not a valid PDF document.',
                true
            );
            resetTool();
        }
        // Other errors (e.g. network abort) are silently ignored here;
        // they will surface with a descriptive message during startCompression().
    }
}


// =============================================================================
// SLIDER UI — QUALITY LABEL & TRACK FILL
// =============================================================================

/**
 * updateQualityLabel
 * ───────────────────
 * Responds to every 'input' event on the compression range slider.
 * Performs two updates simultaneously:
 *
 *   1. LABEL TEXT & COLOUR — Updates the quality-val badge with a human-
 *      readable tier name and an appropriate colour:
 *        • 0.1 – 0.3 : "Extreme (Low Quality)"  — red warning
 *        • 0.4 – 0.6 : "Balanced (Recommended)" — cyan accent
 *        • 0.7 – 1.0 : "High Quality (Low Comp)"— green success
 *
 *   2. TRACK FILL — Paints the slider track with a CSS gradient so the
 *      portion left of the thumb appears filled (brand primary) and the
 *      remainder appears unfilled (border colour). This is a pure-CSS
 *      cross-browser workaround for styling range inputs.
 *
 * @param {string|number} val - The current slider value in the range 0.1–1.0.
 */
function updateQualityLabel(val) {
    const qualityEl = document.getElementById('quality-val');
    const floatVal  = parseFloat(val);

    // Calculate fill percentage relative to the slider's own min/max range.
    const percentage = ((val - 0.1) / (1.0 - 0.1)) * 100;

    // Apply the dual-colour gradient track fill using CSS variables.
    rangeSlider.style.background = `linear-gradient(
        to right,
        var(--brand-primary) ${percentage}%,
        var(--border-main)   ${percentage}%
    )`;

    // Update badge label and colour based on quality tier.
    if (floatVal <= 0.3) {
        qualityEl.textContent  = 'Extreme (Low Quality)';
        qualityEl.style.color  = '#ff0055'; // brand red — signals trade-off risk
    } else if (floatVal <= 0.6) {
        qualityEl.textContent  = 'Balanced (Recommended)';
        qualityEl.style.color  = '#00e5ff'; // accent cyan — neutral/positive
    } else {
        qualityEl.textContent  = 'High Quality (Low Comp)';
        qualityEl.style.color  = '#238636'; // success green — high fidelity
    }
}


// =============================================================================
// BUTTON STATE MACHINE
// =============================================================================

/**
 * setButtonToCompressState
 * ─────────────────────────
 * Resets the action button (#btn-action) to its initial "Compress PDF Now"
 * appearance and attaches the startCompression() click handler.
 *
 * Called:
 *   • After a new file is selected (processSelectedFile).
 *   • After an error triggers a tool reset (resetTool → page reload, so
 *     this acts as a safety net for any future non-reload reset paths).
 */
function setButtonToCompressState() {
    btnAction.disabled   = false;
    btnAction.innerHTML  = '<i class="fa-solid fa-bolt"></i> Compress PDF Now';
    btnAction.classList.remove('btn-compress--download');
    btnAction.onclick    = startCompression;
}

/**
 * setButtonToDownloadState
 * ─────────────────────────
 * Transitions the action button to the "Download File" state after a
 * successful compression run. Swaps the icon, label, visual style, and
 * click handler so the same button fulfils a new purpose without any
 * additional DOM elements.
 */
function setButtonToDownloadState() {
    btnAction.disabled   = false;
    btnAction.innerHTML  = '<i class="fa-solid fa-download"></i> Download File';
    btnAction.classList.add('btn-compress--download');
    btnAction.onclick    = triggerDownload;
}


// =============================================================================
// DOWNLOAD TRIGGER
// =============================================================================

/**
 * _downloadFn
 * ────────────
 * A module-level variable that stores a closure reference to the jsPDF
 * document's `.save()` call, created at the end of startCompression().
 *
 * Using a closure here avoids re-running the entire compression pipeline
 * when the user clicks the "Download File" button. The jsPDF instance is
 * kept alive in memory until the page is unloaded or resetTool() is called.
 *
 * @type {Function|null}
 */
let _downloadFn = null;

/**
 * triggerDownload
 * ────────────────
 * Called when the user clicks the "Download File" button (after compression).
 * Invokes the stored jsPDF save closure to initiate the browser file download.
 * Guard check ensures nothing happens if the closure was never set.
 */
function triggerDownload() {
    if (typeof _downloadFn === 'function') {
        _downloadFn();
    }
}


// =============================================================================
// CORE COMPRESSION PIPELINE
// =============================================================================

/**
 * startCompression
 * ─────────────────
 * The main async compression engine. Orchestrates the full PDF → JPEG → PDF
 * pipeline across all pages of the selected document.
 *
 * Detailed Workflow:
 * ─────────────────────────────────────────────────────────────────────────
 *  PRE-PROCESSING:
 *   • Guard against double invocation (isDownloadReady flag).
 *   • Disable the action button and show a spinning "Processing…" state.
 *   • Read the selected quality from the range slider.
 *
 *  PER-PAGE LOOP (i = 1 → totalPages):
 *   1. RENDER  — Retrieve the PDF page via PDF.js, create an off-screen
 *                <canvas> at the calculated scaleFactor DPI, and render
 *                the page vectors/text/images onto it.
 *   2. COMPRESS — Export the canvas to a JPEG data URL at the chosen
 *                 quality value (0.1 = maximum compression, 1.0 = lossless).
 *   3. INSERT  — Add the JPEG data as a full-page image in the jsPDF
 *                document, matching the page orientation (portrait/landscape).
 *   4. CLEANUP — Shrink the canvas to 1×1 px to release the GPU backing
 *                store, then call page.cleanup() to free PDF.js resources.
 *   5. YIELD   — Await a short setTimeout to hand control back to the UI
 *                thread, keeping the progress bar animation smooth.
 *
 *  POST-PROCESSING:
 *   • Calculate compressed size, bytes saved, and percentage reduction.
 *   • Reveal the result summary cards with the calculated values.
 *   • Show a success or advisory warning toast depending on outcome.
 *   • Store the jsPDF save closure in _downloadFn.
 *   • Transition the action button to the "Download File" state.
 *
 *  ERROR HANDLING:
 *   • Any thrown error is caught and displayed via global toast.
 *   • resetTool() is called to return the UI to a clean idle state.
 *
 * @returns {Promise<void>}
 */
async function startCompression() {

    // ── Guard: Prevent re-entry after a successful compression ─────────────
    if (isDownloadReady) return;

    // ── Disable button and show processing state ───────────────────────────
    btnAction.disabled  = true;
    btnAction.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

    // ── Read quality value from the slider (0.1 – 1.0) ────────────────────
    const quality = parseFloat(rangeSlider.value);

    try {
        // ── Load the PDF document into a PDF.js instance ──────────────────
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages  = pdf.numPages;

        // ── Destructure jsPDF from the UMD global namespace ───────────────
        const { jsPDF } = window.jspdf;

        /** @type {import('jspdf').jsPDF|null} Accumulates all compressed pages. */
        let newDoc = null;

        /**
         * Scale Factor — Controls render resolution (effective DPI).
         * ────────────────────────────────────────────────────────────────────
         * Lower quality setting → lower scale → smaller canvas in memory →
         * smaller JPEG output → better compression ratio.
         *
         * Higher quality setting → higher scale → sharper detail preserved →
         * larger JPEG output → less compression but higher fidelity.
         *
         * Thresholds:
         *   quality ≤ 0.3  → scaleFactor = 1.0  (screen resolution)
         *   quality 0.4–0.7 → scaleFactor = 1.5  (medium — balanced default)
         *   quality ≥ 0.8  → scaleFactor = 2.0  (retina-level sharpness)
         */
        let scaleFactor = 1.5;
        if (quality <= 0.3) scaleFactor = 1.0;
        if (quality >= 0.8) scaleFactor = 2.0;

        // ── Sequential page-by-page processing loop ───────────────────────
        for (let i = 1; i <= totalPages; i++) {

            // Update the progress bar and status line for this page.
            statusText.textContent      = `Optimizing page ${i} of ${totalPages}...`;
            progressBar.style.width     = `${(i / totalPages) * 100}%`;

            // ── STEP 1: Retrieve the page and create a viewport ───────────
            const page     = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: scaleFactor });

            // Create an off-screen canvas at the viewport dimensions.
            const canvas   = document.createElement('canvas');

            // alpha:false skips the alpha compositing step — saves memory
            // and avoids white-transparent artefacts in JPEG output.
            const ctx      = canvas.getContext('2d', { alpha: false });
            canvas.height  = viewport.height;
            canvas.width   = viewport.width;

            // Render the PDF page's vector content onto the canvas.
            await page.render({ canvasContext: ctx, viewport }).promise;

            // ── STEP 2: Compress rendered canvas to JPEG ──────────────────
            // quality is directly used as the JPEG encoder quality (0.0–1.0).
            const imgData = canvas.toDataURL('image/jpeg', quality);

            // ── STEP 3: Insert JPEG into the jsPDF document ───────────────
            // Detect orientation so jsPDF creates the page at the correct angle.
            const isLandscape = viewport.width > viewport.height;
            const orientation = isLandscape ? 'l' : 'p';

            if (i === 1) {
                // First page: initialise the jsPDF document.
                newDoc = new jsPDF({
                    orientation,
                    unit    : 'px',
                    format  : [viewport.width, viewport.height],
                    compress: true,   // Enable internal jsPDF lossless stream compression.
                });
                newDoc.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height);
            } else {
                // Subsequent pages: append a new page with matching dimensions.
                newDoc.addPage([viewport.width, viewport.height], orientation);
                newDoc.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height);
            }

            // ── STEP 4: Aggressive memory cleanup ────────────────────────
            // Shrinking the canvas to 1×1 immediately releases its GPU
            // backing store, which is critical for large multi-page PDFs.
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width  = 1;
            canvas.height = 1;
            page.cleanup(); // Release PDF.js page resources.

            // ── STEP 5: Yield to the UI thread ────────────────────────────
            // A short setTimeout pause allows the browser to repaint the
            // progress bar and prevents ANR (Application Not Responding).
            await new Promise(r => setTimeout(r, RENDER_YIELD_DELAY_MS));
        }

        // =================================================================
        // POST-COMPRESSION: Calculate savings and update the results UI
        // =================================================================

        const blob           = newDoc.output('blob');
        const compressedSize = blob.size;
        const savedBytes     = selectedFile.size - compressedSize;
        const savedPerc      = ((savedBytes / selectedFile.size) * 100).toFixed(1);
        const savedEl        = document.getElementById('saved-percent');

        // Reveal the result summary cards.
        resultSummary.classList.remove('d-none');
        document.getElementById('final-size').textContent = formatBytes(compressedSize);

        if (savedBytes < 0) {
            // The compressed file is LARGER than the original.
            // This is expected when the original PDF uses vector graphics or
            // fonts that are more compact than rasterised JPEG equivalents.
            savedEl.textContent = `+${Math.abs(savedPerc)}%`;
            savedEl.className   = 'pct-result-card__value pct-result-card__value--danger';
            statusText.textContent = 'Finished — size increased due to rasterization.';

            window.showToast(
                'Optimization Note — Output is larger than original. Try a lower quality setting for better compression.'
            );

        } else {
            // The compressed file is SMALLER — standard success case.
            savedEl.textContent = `-${savedPerc}%`;
            savedEl.className   = 'pct-result-card__value pct-result-card__value--accent';
            statusText.textContent = 'Compression successful!';
            statusText.style.color = 'var(--status-text-success)';

            window.showToast(
                `Compression Complete — Saved ${savedPerc}%. Your file is ready to download.`
            );
        }

        // ── Store the download closure ────────────────────────────────────
        // Naming convention: "Titan_Compressed_" prefix + original filename.
        const outputFileName = `Titan_Compressed_${selectedFile.name.replace('.pdf', '')}.pdf`;
        _downloadFn = () => newDoc.save(outputFileName);

        // Mark compression as complete and transition the button.
        isDownloadReady = true;
        setButtonToDownloadState();

    } catch (error) {

        // ── Catch-all error handler ───────────────────────────────────────
        // Logs the full error to the browser console for debugging, then
        // shows a user-friendly toast and resets the tool.
        console.error('[PDF Compress TITANIUM] Compression pipeline error:', error);

        window.showToast(
            'Processing Error — An error occurred during compression. The file may be too complex for available browser memory.',
            true
        );

        resetTool();
    }
}


// =============================================================================
// UTILITIES
// =============================================================================

/**
 * formatBytes
 * ────────────
 * Converts a raw byte count into a human-readable size string.
 * Automatically selects the appropriate unit (Bytes, KB, MB, GB).
 *
 * Examples:
 *   formatBytes(0)          → "0 Bytes"
 *   formatBytes(1024)       → "1.00 KB"
 *   formatBytes(1048576)    → "1.00 MB"
 *   formatBytes(5242880, 1) → "5.0 MB"
 *
 * @param {number} bytes    - The raw byte value to format.
 * @param {number} decimals - Number of decimal places (default: 2).
 * @returns {string} Human-readable size string, e.g. "2.45 MB".
 */
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k     = 1024;
    const dm    = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i     = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * resetTool
 * ──────────
 * Resets the entire tool to its pristine initial state by reloading the page.
 *
 * A full page reload is the safest and most complete reset strategy because:
 *   • All PDF.js internal worker state is fully cleared.
 *   • Canvas backing stores are released from GPU memory.
 *   • The jsPDF document object and its blob data are garbage-collected.
 *   • All DOM mutations are reversed to their original HTML state.
 *
 * This avoids subtle bugs that would result from trying to manually
 * reset every piece of state in a long-running JS session.
 */
function resetTool() {
    location.reload();
}
