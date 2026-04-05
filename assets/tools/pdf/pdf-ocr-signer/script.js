/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DocuSign OCR Studio — Application Script
 * File    : assets/tools/pdf/pdf-ocr-signer/script.js
 * Project : Trusted Tools Web — CodeCanyon Premium Release
 * Author  : MD KAWSAR
 * Version : 1.0
 *
 * Architecture Overview:
 * ─────────────────────────────────────────────────────────────────────────
 * The application is organized into self-contained IIFE modules that
 * communicate via a central AppState object. Each module handles a single
 * discrete concern, making the code highly maintainable and testable.
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  AppState          — Centralized reactive state (single source of  │
 *  │                       truth for all runtime data)                  │
 *  │  Logger            — Real-time terminal log output                 │
 *  │  escapeHtml        — XSS-safe HTML insertion utility               │
 *  │  formatBytes       — Human-readable file size formatter            │
 *  │  FileHandler       — PDF/image upload, validation, removal         │
 *  │  PDFViewer         — PDF.js rendering, page navigation, zoom       │
 *  │  SignatureCanvas   — Bezier curve drawing engine                   │
 *  │  StampHandler      — Image stamp upload + preview                  │
 *  │  TextAnnotation    — Text-as-image annotation creation             │
 *  │  PlacementModal    — Interactive signature/stamp positioning        │
 *  │  AnnotationManager — Track placed items, render canvas overlays    │
 *  │  OCREngine         — Tesseract.js WebWorker OCR integration        │
 *  │  SecurityModule    — WebCrypto SHA-256 hashing + seal embedding    │
 *  │  ExportEngine      — pdf-lib flatten & download                    │
 *  │  TabController     — Main tab and sub-tab switching                │
 *  │  UIHelpers         — Range sliders, toggles, misc UI               │
 *  │  enableExportBtn   — Utility to gate the export download button    │
 *  │  Init              — Bootstrap all modules + environment checks    │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 * Toast Notification System:
 * ─────────────────────────────────────────────────────────────────────────
 * Uses the GLOBAL toast system provided by global.js:
 *   window.showToast("Message")          → info/success toast
 *   window.showToast("Error message", true) → error toast
 * No local toast HTML container or showToast/injectToast function is used.
 *
 * Security Model:
 * ─────────────────────────────────────────────────────────────────────────
 * All processing (PDF rendering, OCR, SHA-256 hashing, PDF export) is
 * performed 100% client-side. No data leaves the browser at any point.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   CENTRALIZED APPLICATION STATE
   ─────────────────────────────────────────────────────────────────────────
   Single source of truth for all reactive data. Every module reads from
   and writes to this object. Using a plain object avoids complex state
   management overhead while keeping everything predictable.
═══════════════════════════════════════════════════════════════════════════ */
const AppState = {
    // ── File & PDF Document ──────────────────────────────────────────────
    pdfFile:          null,   // Original File object from the file picker
    pdfArrayBuffer:   null,   // Raw ArrayBuffer of the PDF (used by pdf-lib)
    pdfJsDoc:         null,   // PDF.js PDFDocumentProxy instance
    currentPage:      1,      // Currently displayed page number (1-based)
    totalPages:       0,      // Total page count of the loaded document
    currentScale:     1.5,    // PDF.js render scale (1.5 = 150% resolution)
    fitMode:          'width', // Current fit mode: 'width' | 'page' | 'custom'

    // ── Annotations ──────────────────────────────────────────────────────
    // All placed items (signatures, stamps, text, seals) on the document.
    // Each annotation: { id, type, page, xPt, yPt, widthPt, heightPt, data, label, opacity, scale }
    annotations:      [],

    // ── Signature Canvas State ────────────────────────────────────────────
    isDrawing:        false,  // True while the user is actively drawing
    sigPoints:        [],     // Collected { x, y } points for current stroke

    // ── Stamp State ───────────────────────────────────────────────────────
    stampImageData:   null,   // Base64 data URL of the uploaded stamp image
    stampOpacity:     1.0,    // Current stamp opacity (0.0 – 1.0)

    // ── Pending Placement ─────────────────────────────────────────────────
    // Holds the item currently waiting to be positioned via the placement modal.
    pendingItem:      null,   // { type, data, label, opacity?, meta? }

    // ── OCR Engine State ──────────────────────────────────────────────────
    ocrWorker:        null,   // Tesseract.js worker instance (if reused)
    ocrBusy:          false,  // Prevents concurrent OCR runs
    lastOcrText:      '',     // Last successfully extracted OCR text

    // ── Security / Hashing ────────────────────────────────────────────────
    documentHash:     null,   // Hex string of the SHA-256 document fingerprint
    hashTimestamp:    null,   // ISO timestamp of when the hash was generated
    sealApplied:      false,  // True once a visual seal has been embedded

    // ── Export ────────────────────────────────────────────────────────────
    exportCount:      0,      // Running count of successful PDF exports
};


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: LOGGER
   ─────────────────────────────────────────────────────────────────────────
   Appends structured, color-coded log lines to the terminal panel.
   Each line contains: [timestamp] [type badge] [message].
   The terminal auto-scrolls to the latest entry on each append.
═══════════════════════════════════════════════════════════════════════════ */
const Logger = (() => {
    /** Reference to the scrollable terminal body element. */
    const body = document.getElementById('terminal-log-body');

    /**
     * Returns the current time formatted as HH:MM:SS for log timestamps.
     * @returns {string} e.g. "14:32:07"
     */
    function getTime() {
        return new Date().toTimeString().slice(0, 8);
    }

    /**
     * Appends a structured log line to the terminal panel.
     *
     * @param {'system'|'info'|'warn'|'error'|'ocr'|'success'} type
     *        The log type — determines the badge color and text color.
     * @param {string} message
     *        The human-readable message to display.
     */
    function log(type, message) {
        if (!body) return;

        // Map log types to their short badge labels
        const badgeLabels = {
            system:  'SYS',
            info:    'INFO',
            warn:    'WARN',
            error:   'ERR',
            ocr:     'OCR',
            success: 'OK',
        };

        // Build the log line DOM element using CSS classes defined in tools-template.css
        const line = document.createElement('div');
        line.className = `dos-log-line dos-log-line--${type}`;
        line.innerHTML = `
            <span class="dos-log-time" aria-hidden="true">${getTime()}</span>
            <span class="dos-log-badge dos-log-badge--${type}">${badgeLabels[type] || type.toUpperCase()}</span>
            <span class="dos-log-msg">${escapeHtml(message)}</span>
        `;

        body.appendChild(line);

        // Auto-scroll the terminal body to always show the latest entry
        body.scrollTop = body.scrollHeight;
    }

    /**
     * Clears all existing log entries and writes a fresh "Terminal cleared" message.
     * Bound to the clear-log-btn click event by UIHelpers.
     */
    function clear() {
        if (body) body.innerHTML = '';
        log('system', 'Terminal cleared.');
    }

    return { log, clear };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY: HTML ESCAPE
   ─────────────────────────────────────────────────────────────────────────
   Converts user-provided strings to HTML-safe text before inserting them
   into innerHTML contexts, preventing Cross-Site Scripting (XSS) attacks.
═══════════════════════════════════════════════════════════════════════════ */
/**
 * Safely escapes HTML special characters in a string.
 * Uses a temporary DOM text node to leverage the browser's own escaping.
 *
 * @param {string|number} str - The raw input string to escape.
 * @returns {string} HTML-safe string with <, >, &, ", ' converted to entities.
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}


/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY: FORMAT FILE SIZE
   ─────────────────────────────────────────────────────────────────────────
   Converts raw byte counts into human-readable strings with appropriate units.
═══════════════════════════════════════════════════════════════════════════ */
/**
 * Formats a byte count as a human-readable size string.
 *
 * @param {number} bytes - File size in bytes.
 * @returns {string} e.g. "1.4 MB", "512 KB", "800 B"
 */
function formatBytes(bytes) {
    if (bytes < 1024)            return bytes + ' B';
    if (bytes < 1024 * 1024)     return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: FILE HANDLER
   ─────────────────────────────────────────────────────────────────────────
   Manages the complete file lifecycle:
     1. Registers drag-and-drop and click-to-browse upload events.
     2. Validates the uploaded file type and size.
     3. Reads the file as an ArrayBuffer (required by both PDF.js and pdf-lib).
     4. Routes PDF files directly to PDFViewer, and image files through a
        conversion step (image → single-page PDF via pdf-lib).
     5. Updates the file info bar and page navigation UI.
     6. Handles the "remove file" action to reset the workspace.
═══════════════════════════════════════════════════════════════════════════ */
const FileHandler = (() => {
    const uploadZone  = document.getElementById('upload-zone');
    const fileInput   = document.getElementById('file-input');
    const fileInfoBar = document.getElementById('file-info-bar');
    const fileNameEl  = document.getElementById('file-name-display');
    const fileMetaEl  = document.getElementById('file-meta-display');
    const removeBtn   = document.getElementById('remove-file-btn');
    const pageNav     = document.getElementById('page-nav');

    /** Maximum allowed file size: 100 MB */
    const MAX_SIZE_BYTES = 100 * 1024 * 1024;

    /** Supported MIME types for upload */
    const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

    /**
     * Registers all upload-related event listeners.
     * Called once during module initialization.
     */
    function init() {
        // Click the upload zone → trigger the hidden native file input
        uploadZone.addEventListener('click', () => fileInput.click());

        // Keyboard accessibility: Enter or Space also triggers file picker
        uploadZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInput.click();
        });

        // Native file input change event (user selected a file via browser dialog)
        fileInput.addEventListener('change', (e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
        });

        // Drag-and-drop: add visual feedback when file is dragged over the zone
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        // Remove visual feedback when dragged file leaves the zone
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        // Drop event: extract the dropped file and process it
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file) handleFile(file);
        });

        // Remove file button resets the entire workspace
        removeBtn.addEventListener('click', removeFile);
    }

    /**
     * Validates and processes an uploaded file.
     * Rejects unsupported file types and files exceeding the size limit.
     * For PDFs: loads directly into PDF.js.
     * For images (PNG, JPEG, WebP): converts to a PDF first via pdf-lib.
     *
     * @param {File} file - The File object from the input or drag event.
     */
    async function handleFile(file) {
        // ── Type Validation ──────────────────────────────────────────────
        if (!ACCEPTED_TYPES.includes(file.type)) {
            window.showToast('Unsupported file type. Please upload a PDF or image (PNG, JPEG, WebP).', true);
            Logger.log('error', `File rejected — unsupported type: ${file.type}`);
            return;
        }

        // ── Size Validation ───────────────────────────────────────────────
        if (file.size > MAX_SIZE_BYTES) {
            window.showToast(`File too large (${formatBytes(file.size)}). Maximum size is 100 MB.`, true);
            Logger.log('error', `File rejected — size ${formatBytes(file.size)} exceeds 100 MB limit.`);
            return;
        }

        Logger.log('info', `Loading file: "${file.name}" (${formatBytes(file.size)}, ${file.type})`);

        // ── Read File as ArrayBuffer ──────────────────────────────────────
        // Both PDF.js and pdf-lib operate on raw binary ArrayBuffer data.
        try {
            const arrayBuffer = await file.arrayBuffer();

            // Update centralized state with the new file data
            AppState.pdfFile        = file;
            AppState.pdfArrayBuffer = arrayBuffer;
            AppState.annotations    = [];
            AppState.documentHash   = null;
            AppState.sealApplied    = false;

            if (file.type === 'application/pdf') {
                // PDFs go directly to the viewer renderer
                await PDFViewer.load(arrayBuffer);
            } else {
                // Images are first embedded into a PDF document, then loaded
                await convertImageToPdf(arrayBuffer, file.type);
            }

            // ── Update File Info Bar UI ───────────────────────────────────
            fileNameEl.textContent = file.name;
            fileMetaEl.textContent = `${AppState.totalPages} page${AppState.totalPages !== 1 ? 's' : ''} · ${formatBytes(file.size)}`;
            fileInfoBar.hidden     = false;
            pageNav.hidden         = false;

            // Sync downstream module UIs
            AnnotationManager.updateUI();
            ExportEngine.updateSummary();
            enableExportBtn();

            window.showToast(`"${file.name}" loaded successfully.`);
            Logger.log('success', `Document loaded. Pages: ${AppState.totalPages}`);

        } catch (err) {
            window.showToast('Failed to load file. The PDF may be corrupted or password-protected.', true);
            Logger.log('error', `Load error: ${err.message}`);
            console.error('[DocuSignOCR] FileHandler error:', err);
        }
    }

    /**
     * Converts an image file (PNG/JPEG/WebP) to a single-page PDF using pdf-lib.
     * This allows images to be processed through the same signing, OCR,
     * and export pipeline as native PDFs.
     *
     * @param {ArrayBuffer} imageBuffer - Raw bytes of the image file.
     * @param {string} mimeType - MIME type of the image (e.g. 'image/png').
     */
    async function convertImageToPdf(imageBuffer, mimeType) {
        Logger.log('info', 'Converting image to PDF format for processing…');

        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.create();

        // Embed the image into the new PDF document based on its MIME type
        let embeddedImage;
        if (mimeType === 'image/jpeg') {
            embeddedImage = await pdfDoc.embedJpg(imageBuffer);
        } else {
            // pdf-lib handles both PNG and WebP through its PNG embedder
            embeddedImage = await pdfDoc.embedPng(imageBuffer);
        }

        // Create a page sized exactly to the image's natural dimensions
        const { width, height } = embeddedImage.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(embeddedImage, { x: 0, y: 0, width, height });

        // Serialize the new PDF to bytes and reload it as the active document
        const pdfBytes = await pdfDoc.save();
        AppState.pdfArrayBuffer = pdfBytes.buffer;

        await PDFViewer.load(AppState.pdfArrayBuffer);
        Logger.log('success', `Image converted to PDF (${width.toFixed(0)}×${height.toFixed(0)}pt).`);
    }

    /**
     * Resets the entire application to its initial empty state.
     * Clears all AppState properties, hides UI panels, and resets the viewer.
     * Triggered by the remove-file-btn click.
     */
    function removeFile() {
        // Clear all state
        AppState.pdfFile        = null;
        AppState.pdfArrayBuffer = null;
        AppState.pdfJsDoc       = null;
        AppState.currentPage    = 1;
        AppState.totalPages     = 0;
        AppState.annotations    = [];
        AppState.documentHash   = null;
        AppState.sealApplied    = false;

        // Hide file-specific UI panels
        fileInfoBar.hidden = true;
        pageNav.hidden     = true;
        fileInput.value    = ''; // Reset input so the same file can be re-uploaded

        // Reset downstream modules
        PDFViewer.reset();
        AnnotationManager.updateUI();
        ExportEngine.updateSummary();

        // Disable export button — no document loaded
        document.getElementById('export-btn').disabled = true;

        Logger.log('system', 'Document removed. Workspace reset.');
        window.showToast('Document removed.');
    }

    return { init };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: PDF VIEWER
   ─────────────────────────────────────────────────────────────────────────
   Uses PDF.js (cdnjs v3.11.174) to render PDF pages onto an HTML5 Canvas.
   Handles:
     - Loading a PDFDocumentProxy from an ArrayBuffer
     - Rendering individual pages at the current scale
     - Page navigation (prev/next)
     - Zoom controls (in/out) and fit modes (fit-to-width, fit-to-page)
     - Cancelling in-flight renders to prevent race conditions on fast navigation
     - Switching between the empty state UI and the canvas stack
═══════════════════════════════════════════════════════════════════════════ */
const PDFViewer = (() => {
    // ── DOM References ───────────────────────────────────────────────────
    const emptyState    = document.getElementById('viewer-empty-state');
    const canvasStack   = document.getElementById('canvas-stack');
    const pdfCanvas     = document.getElementById('pdf-canvas');
    const overlayCanvas = document.getElementById('overlay-canvas');
    const toolbar       = document.getElementById('viewer-toolbar');
    const zoomDisplay   = document.getElementById('zoom-level-display');
    const prevBtn       = document.getElementById('prev-page-btn');
    const nextBtn       = document.getElementById('next-page-btn');
    const currentPageEl = document.getElementById('current-page-num');
    const totalPagesEl  = document.getElementById('total-pages-num');

     /**
     * Configure PDF.js to use its Web Worker for off-main-thread parsing.
     * This prevents the UI from freezing while decoding large PDFs.
     * UPDATED FOR CODECANYON: Using local path based on your current folder structure.
     */
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        '../../assets/library/pdf-engine/jspdf/pdf.worker.min.js';

    /** Active PDF.js RenderTask — tracked so it can be cancelled on fast navigation. */
    let renderTask = null;

    /**
     * Wires up all viewer control buttons and the pdfjs-version display.
     * Called once during Init.run().
     */
    function init() {
        prevBtn.addEventListener('click', () => navigatePage(-1));
        nextBtn.addEventListener('click', () => navigatePage(1));
        document.getElementById('zoom-in-btn').addEventListener('click',  () => adjustZoom(0.25));
        document.getElementById('zoom-out-btn').addEventListener('click', () => adjustZoom(-0.25));
        document.getElementById('fit-width-btn').addEventListener('click', fitToWidth);
        document.getElementById('fit-page-btn').addEventListener('click',  fitToPage);

        // Display the loaded PDF.js library version in the terminal after a short delay
        setTimeout(() => {
            const versionEl = document.getElementById('pdfjs-version-log');
            if (versionEl && pdfjsLib?.version) {
                versionEl.textContent = `v${pdfjsLib.version}`;
            }
        }, 500);
    }

    /**
     * Loads a PDF document from an ArrayBuffer and renders its first page.
     * Uses a buffer copy because PDF.js takes ownership (and may detach) the buffer.
     *
     * @param {ArrayBuffer} buffer - Raw PDF bytes.
     */
    async function load(buffer) {
        // Create an independent copy — PDF.js may detach the original ArrayBuffer
        const bufferCopy = buffer.slice(0);

        const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });

        // Stream load progress to the terminal
        loadingTask.onProgress = ({ loaded, total }) => {
            const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
            Logger.log('info', `Loading PDF data… ${pct}%`);
        };

        AppState.pdfJsDoc   = await loadingTask.promise;
        AppState.totalPages = AppState.pdfJsDoc.numPages;
        AppState.currentPage = 1;

        totalPagesEl.textContent = AppState.totalPages;
        prevBtn.disabled = true;
        nextBtn.disabled = AppState.totalPages <= 1;

        // Switch from the empty-state placeholder to the live canvas view
        emptyState.hidden = true;
        emptyState.setAttribute('aria-hidden', 'true');
        canvasStack.hidden = false;
        toolbar.hidden     = false;

        await renderCurrentPage();
    }

    /**
     * Renders AppState.currentPage onto the main PDF canvas at AppState.currentScale.
     * Cancels any active render task first to prevent race conditions.
     * After rendering, re-draws any annotation overlays for the current page.
     */
    async function renderCurrentPage() {
        if (!AppState.pdfJsDoc) return;

        // Cancel any in-flight render (occurs on fast page navigation)
        if (renderTask) {
            renderTask.cancel();
            renderTask = null;
        }

        const page     = await AppState.pdfJsDoc.getPage(AppState.currentPage);
        const viewport = page.getViewport({ scale: AppState.currentScale });

        const ctx = pdfCanvas.getContext('2d');

        // Resize both canvases to match the current page dimensions
        pdfCanvas.width     = viewport.width;
        pdfCanvas.height    = viewport.height;
        overlayCanvas.width  = viewport.width;
        overlayCanvas.height = viewport.height;

        // Start the render task
        renderTask = page.render({ canvasContext: ctx, viewport });

        try {
            await renderTask.promise;
        } catch (err) {
            // RenderingCancelledException is expected on fast navigation — ignore it
            if (err?.name !== 'RenderingCancelledException') {
                Logger.log('error', `Page render failed: ${err.message}`);
            }
            return;
        }

        // Update page counter display
        currentPageEl.textContent = AppState.currentPage;
        prevBtn.disabled = AppState.currentPage <= 1;
        nextBtn.disabled = AppState.currentPage >= AppState.totalPages;

        // Re-draw all annotations placed on the current page
        AnnotationManager.renderOverlay();

        Logger.log('info', `Rendered page ${AppState.currentPage} of ${AppState.totalPages} @ ${Math.round(AppState.currentScale * 100)}% scale.`);
    }

    /**
     * Navigate to the next or previous page by a delta offset.
     * Clamps to valid page range [1, totalPages].
     *
     * @param {number} delta - +1 for next page, -1 for previous page.
     */
    async function navigatePage(delta) {
        const newPage = AppState.currentPage + delta;
        if (newPage < 1 || newPage > AppState.totalPages) return;
        AppState.currentPage = newPage;
        await renderCurrentPage();
    }

    /**
     * Adjusts the current zoom scale by the given delta.
     * Scale is clamped between 0.25× (25%) and 5× (500%).
     *
     * @param {number} delta - Zoom step, e.g. +0.25 to zoom in by 25%.
     */
    async function adjustZoom(delta) {
        const newScale         = Math.min(5, Math.max(0.25, AppState.currentScale + delta));
        AppState.currentScale  = newScale;
        AppState.fitMode       = 'custom';
        zoomDisplay.textContent = Math.round(newScale * 100) + '%';
        await renderCurrentPage();
    }

    /**
     * Scales the PDF to fill the viewer container's available width.
     * Useful for reading documents horizontally.
     */
    async function fitToWidth() {
        const container      = document.getElementById('pdf-viewer');
        const containerWidth = container.clientWidth - 48; // Subtract viewer padding

        if (!AppState.pdfJsDoc) return;

        const page            = await AppState.pdfJsDoc.getPage(AppState.currentPage);
        const defaultViewport = page.getViewport({ scale: 1 });
        AppState.currentScale = containerWidth / defaultViewport.width;
        AppState.fitMode      = 'width';
        zoomDisplay.textContent = Math.round(AppState.currentScale * 100) + '%';
        await renderCurrentPage();
    }

    /**
     * Scales the PDF so the entire page fits within the visible viewer area.
     * Computes the minimum of the width-fit and height-fit scales.
     */
    async function fitToPage() {
        const container       = document.getElementById('pdf-viewer');
        const containerWidth  = container.clientWidth  - 48;
        const containerHeight = container.clientHeight - 80; // Subtract toolbar height

        if (!AppState.pdfJsDoc) return;

        const page            = await AppState.pdfJsDoc.getPage(AppState.currentPage);
        const defaultViewport = page.getViewport({ scale: 1 });
        const scaleX          = containerWidth  / defaultViewport.width;
        const scaleY          = containerHeight / defaultViewport.height;
        AppState.currentScale = Math.min(scaleX, scaleY);
        AppState.fitMode      = 'page';
        zoomDisplay.textContent = Math.round(AppState.currentScale * 100) + '%';
        await renderCurrentPage();
    }

    /**
     * Resets the viewer to the empty state (before any file is loaded).
     * Cancels any active render, hides the canvas stack, and shows the placeholder.
     */
    function reset() {
        if (renderTask) renderTask.cancel();
        emptyState.hidden = false;
        emptyState.removeAttribute('aria-hidden');
        canvasStack.hidden   = true;
        toolbar.hidden       = true;
        pdfCanvas.width      = 0;
        pdfCanvas.height     = 0;
        overlayCanvas.width  = 0;
        overlayCanvas.height = 0;
        currentPageEl.textContent = '1';
        totalPagesEl.textContent  = '1';
    }

    return { init, load, renderCurrentPage, reset, fitToWidth };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: SIGNATURE CANVAS
   ─────────────────────────────────────────────────────────────────────────
   Implements smooth handwritten signature drawing using:
     - Pointer Events API (mouse + touch + stylus support)
     - Quadratic Bezier curves (quadraticCurveTo with midpoints as anchors)
     - Stroke state management (finalized strokes stored for undo compatibility)

   Drawing Algorithm:
     1. pointerdown  → Begin a new stroke, collect starting point.
     2. pointermove  → Collect points and render smooth bezier curve in real-time.
     3. pointerup    → Finalize the stroke and push to the strokes array.
   The midpoint between each consecutive pair of points acts as the bezier
   curve end-anchor, creating natural, smooth S-curves without extra math.
═══════════════════════════════════════════════════════════════════════════ */
const SignatureCanvas = (() => {
    const canvas          = document.getElementById('sig-canvas');
    const hint            = document.getElementById('sig-canvas-hint');
    const ctx             = canvas.getContext('2d');
    const colorPicker     = document.getElementById('sig-color');
    const thicknessSlider = document.getElementById('sig-thickness');
    const thicknessVal    = document.getElementById('sig-thickness-val');

    /** Points collected for the current in-progress stroke. */
    let points  = [];
    /** All completed strokes — each is { points: [...], color: '#...', width: N }. */
    let strokes = [];

    /**
     * Registers all canvas event listeners for drawing and control changes.
     */
    function init() {
        // Use Pointer Events for unified mouse + touch + stylus support
        canvas.addEventListener('pointerdown',  onPointerDown);
        canvas.addEventListener('pointermove',  onPointerMove);
        canvas.addEventListener('pointerup',    onPointerUp);
        canvas.addEventListener('pointerleave', onPointerUp);

        // Prevent the browser from scroll-hijacking touch drawing
        canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

        // Redraw all strokes when color or thickness changes
        colorPicker.addEventListener('input', redrawAll);
        thicknessSlider.addEventListener('input', () => {
            thicknessVal.textContent = thicknessSlider.value + 'px';
            redrawAll();
        });

        document.getElementById('clear-sig-btn').addEventListener('click',  clearCanvas);
        document.getElementById('apply-sig-btn').addEventListener('click', applySig);
    }

    /**
     * Converts a PointerEvent to canvas-local { x, y } coordinates.
     * Accounts for canvas CSS scaling vs. its intrinsic pixel dimensions.
     *
     * @param {PointerEvent} e
     * @returns {{ x: number, y: number }}
     */
    function getPos(e) {
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY,
        };
    }

    /** Begins a new stroke on pointer press. */
    function onPointerDown(e) {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId); // Retain pointer even if it leaves the canvas
        AppState.isDrawing = true;
        points = [getPos(e)];
        hint.classList.add('hidden'); // Hide the "Draw your signature" hint
    }

    /** Extends the current stroke on pointer movement. */
    function onPointerMove(e) {
        if (!AppState.isDrawing) return;
        e.preventDefault();
        points.push(getPos(e));
        drawStrokeSmooth(points); // Live rendering as the user draws
    }

    /** Finalizes the stroke on pointer release or canvas exit. */
    function onPointerUp(e) {
        if (!AppState.isDrawing) return;
        AppState.isDrawing = false;

        // Only save strokes with at least two points (not accidental taps)
        if (points.length > 1) {
            strokes.push({
                points: [...points],
                color:  colorPicker.value,
                width:  parseFloat(thicknessSlider.value),
            });
        }
        points = [];
    }

    /**
     * Renders a smooth Bezier stroke through an array of pointer points.
     * Clears the canvas first, then redraws all finalized strokes + the
     * current in-progress stroke using quadratic bezier curves.
     *
     * The algorithm uses the midpoint between each consecutive pair of
     * collected points as the bezier end-anchor, which creates smooth,
     * natural-looking curves without complex math.
     *
     * @param {Array<{x:number, y:number}>} pts - Points of the current stroke.
     */
    function drawStrokeSmooth(pts) {
        // Clear and redraw all previous finalized strokes first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        redrawStrokes(strokes);

        if (pts.length < 2) return;

        ctx.beginPath();
        ctx.strokeStyle = colorPicker.value;
        ctx.lineWidth   = parseFloat(thicknessSlider.value);
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.moveTo(pts[0].x, pts[0].y);

        // Draw quadratic bezier curves through each consecutive point pair
        for (let i = 1; i < pts.length - 1; i++) {
            // The midpoint acts as the smooth bezier anchor
            const midX = (pts[i].x + pts[i + 1].x) / 2;
            const midY = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }

        // Connect to the final collected point
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
    }

    /**
     * Redraws a provided list of finalized strokes onto the canvas.
     * Called after clear or after a color/thickness change requires a full redraw.
     *
     * @param {Array<{points: Array, color: string, width: number}>} strokeList
     */
    function redrawStrokes(strokeList) {
        strokeList.forEach(({ points: pts, color, width }) => {
            if (pts.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth   = width;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length - 1; i++) {
                const midX = (pts[i].x + pts[i + 1].x) / 2;
                const midY = (pts[i].y + pts[i + 1].y) / 2;
                ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
            }
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            ctx.stroke();
        });
    }

    /** Redraws all strokes when color or thickness settings change. */
    function redrawAll() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        redrawStrokes(strokes);
    }

    /**
     * Clears the signature canvas and resets all stroke state.
     * Re-shows the "Draw your signature" hint overlay.
     */
    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokes = [];
        points  = [];
        hint.classList.remove('hidden');
    }

    /**
     * Returns true if the canvas contains at least one drawn stroke.
     * Used to validate before opening the placement modal.
     *
     * @returns {boolean}
     */
    function hasContent() {
        return strokes.length > 0;
    }

    /**
     * Exports the current canvas content as a PNG data URL.
     * Used as the image data passed to the PlacementModal and AnnotationManager.
     *
     * @returns {string} Base64 PNG data URL.
     */
    function exportAsDataURL() {
        return canvas.toDataURL('image/png');
    }

    /**
     * Validates that a signature has been drawn and a PDF is loaded,
     * then sets the pending item and opens the placement modal.
     */
    function applySig() {
        if (!hasContent()) {
            window.showToast('Please draw your signature first.');
            return;
        }
        if (!AppState.pdfJsDoc) {
            window.showToast('Please load a PDF document first.');
            return;
        }

        // Store the pending item in AppState for the placement modal to consume
        AppState.pendingItem = {
            type:  'signature',
            data:  exportAsDataURL(),
            label: 'Handwritten Signature',
        };

        PlacementModal.open();
    }

    return { init, clearCanvas, exportAsDataURL, hasContent };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: STAMP HANDLER
   ─────────────────────────────────────────────────────────────────────────
   Manages the upload, preview, and placement of custom image stamps.
   Supported formats: PNG, JPEG, WebP (with optional opacity control).
   After upload, the stamp image is converted to a Base64 data URL stored
   in AppState.stampImageData for use in the placement pipeline.
═══════════════════════════════════════════════════════════════════════════ */
const StampHandler = (() => {
    const dropZone       = document.getElementById('stamp-upload-zone');
    const stampInput     = document.getElementById('stamp-file-input');
    const previewWrapper = document.getElementById('stamp-preview-wrapper');
    const previewImg     = document.getElementById('stamp-preview');
    const opacitySlider  = document.getElementById('stamp-opacity');
    const opacityVal     = document.getElementById('stamp-opacity-val');

    /**
     * Registers click, keyboard, change, and opacity events for stamp handling.
     */
    function init() {
        // Click zone → open file picker
        dropZone.addEventListener('click', () => stampInput.click());
        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') stampInput.click();
        });

        // Process the selected stamp image file
        stampInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) handleStampFile(file);
        });

        // Opacity slider: updates AppState and live preview transparency
        opacitySlider.addEventListener('input', () => {
            const val = opacitySlider.value;
            opacityVal.textContent   = val + '%';
            AppState.stampOpacity    = val / 100;
            previewImg.style.opacity = AppState.stampOpacity;
        });

        document.getElementById('apply-stamp-btn').addEventListener('click', applyStamp);
    }

    /**
     * Validates the stamp image file and shows a preview if valid.
     * Converts the image to a Base64 data URL via FileReader.
     *
     * @param {File} file - The stamp image file to process.
     */
    function handleStampFile(file) {
        const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

        if (!ACCEPTED.includes(file.type)) {
            window.showToast('Stamp must be PNG, JPEG, or WebP.', true);
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            window.showToast('Stamp image must be under 5 MB.', true);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            AppState.stampImageData  = e.target.result;
            previewImg.src           = AppState.stampImageData;
            previewWrapper.hidden    = false;
            dropZone.style.display   = 'none'; // Hide drop zone once stamp is loaded
            Logger.log('info', `Stamp loaded: "${file.name}" (${formatBytes(file.size)})`);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Validates that a stamp and PDF are loaded, then triggers the placement modal.
     */
    function applyStamp() {
        if (!AppState.stampImageData) {
            window.showToast('Please upload a stamp image first.');
            return;
        }
        if (!AppState.pdfJsDoc) {
            window.showToast('Please load a PDF document first.');
            return;
        }

        AppState.pendingItem = {
            type:    'stamp',
            data:    AppState.stampImageData,
            opacity: AppState.stampOpacity,
            label:   'Image Stamp',
        };

        PlacementModal.open();
    }

    return { init };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: TEXT ANNOTATION HANDLER
   ─────────────────────────────────────────────────────────────────────────
   Creates text annotations by rendering text onto an off-screen canvas
   and converting it to a PNG data URL. The resulting image is then treated
   identically to a signature or stamp through the placement pipeline.
   This approach avoids pdf-lib's limited font embedding requirements.
═══════════════════════════════════════════════════════════════════════════ */
const TextAnnotation = (() => {
    /**
     * Wires up the font-size slider value display and apply button.
     */
    function init() {
        const fontSizeSlider = document.getElementById('text-font-size');
        const fontSizeVal    = document.getElementById('text-font-size-val');

        fontSizeSlider.addEventListener('input', () => {
            fontSizeVal.textContent = fontSizeSlider.value + 'px';
        });

        document.getElementById('apply-text-btn').addEventListener('click', applyText);
    }

    /**
     * Renders the entered text onto an off-screen canvas and opens the
     * placement modal so the user can position it on the PDF.
     *
     * The canvas is sized to exactly fit the rendered text (with 10px padding).
     * Fira Code monospace font is used for a clean, professional appearance.
     */
    function applyText() {
        const text = document.getElementById('text-annotation-input').value.trim();
        if (!text) {
            window.showToast('Please enter some text first.');
            return;
        }
        if (!AppState.pdfJsDoc) {
            window.showToast('Please load a PDF document first.');
            return;
        }

        const color    = document.getElementById('text-color').value;
        const fontSize = parseInt(document.getElementById('text-font-size').value, 10);

        // Create a temporary canvas to measure and render the text
        const tempCanvas = document.createElement('canvas');
        const tempCtx    = tempCanvas.getContext('2d');

        // Measure text width at the target font size to size the canvas
        tempCtx.font       = `${fontSize}px "Fira Code", monospace`;
        const metrics      = tempCtx.measureText(text);
        tempCanvas.width   = Math.ceil(metrics.width) + 20;   // 10px padding each side
        tempCanvas.height  = fontSize * 1.4 + 10;             // 40% line-height + padding

        // Re-apply font (canvas reset on resize) and draw the text
        tempCtx.font         = `${fontSize}px "Fira Code", monospace`;
        tempCtx.fillStyle    = color;
        tempCtx.textBaseline = 'top';
        tempCtx.fillText(text, 10, 5);

        // Prepare the pending item with the text image data
        AppState.pendingItem = {
            type:  'text',
            data:  tempCanvas.toDataURL('image/png'),
            label: `Text: "${text.slice(0, 20)}${text.length > 20 ? '…' : ''}"`,
            meta:  { text, fontSize, color },
        };

        PlacementModal.open();
    }

    return { init };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: PLACEMENT MODAL
   ─────────────────────────────────────────────────────────────────────────
   Provides an interactive dialog for precisely positioning a signature,
   stamp, or text annotation on the PDF page.

   Coordinate System:
   ─────────────────────────────────────────────────────────────────────────
   The modal renders a scaled-down thumbnail of the current PDF page.
   When the user clicks, the click pixel coordinates are converted back to
   PDF point coordinates using the canvasScale ratios computed during render.

   pdf-lib uses a bottom-left origin coordinate system (PDF standard).
   The Y-axis flip is applied during export (ExportEngine), not here.
═══════════════════════════════════════════════════════════════════════════ */
const PlacementModal = (() => {
    const modal         = document.getElementById('placement-modal');
    const closeBtn      = document.getElementById('placement-modal-close');
    const cancelBtn     = document.getElementById('placement-cancel-btn');
    const confirmBtn    = document.getElementById('placement-confirm-btn');
    const previewCanvas = document.getElementById('placement-preview-canvas');
    const scaleSlider   = document.getElementById('placement-scale');
    const scaleVal      = document.getElementById('placement-scale-val');

    /** Chosen position in PDF point coordinates (null = not yet chosen). */
    let chosenX       = null;
    let chosenY       = null;
    /** Computed signature dimensions in PDF points at current scale. */
    let sigWidthPts   = 0;
    let sigHeightPts  = 0;
    /** Ratio of canvas pixels to PDF points (used for coordinate conversion). */
    let canvasScaleX  = 1;
    let canvasScaleY  = 1;

    /**
     * Registers all modal interaction event listeners.
     */
    function init() {
        closeBtn.addEventListener('click',   close);
        cancelBtn.addEventListener('click',  close);
        confirmBtn.addEventListener('click', confirm);

        // Scale slider: update label and redraw ghost if position already chosen
        scaleSlider.addEventListener('input', () => {
            scaleVal.textContent = scaleSlider.value + '%';
            if (chosenX !== null) drawPlacementPreview();
        });

        // Click on the thumbnail canvas → record placement position
        previewCanvas.addEventListener('click', onCanvasClick);

        // Close modal when clicking outside the modal card (on the backdrop)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });

        // Keyboard accessibility: Escape key closes the modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) close();
        });
    }

    /**
     * Opens the placement modal, resets state, and renders the page thumbnail.
     * Called by SignatureCanvas.applySig(), StampHandler.applyStamp(),
     * TextAnnotation.applyText(), and SecurityModule.applySeal().
     */
    async function open() {
        if (!AppState.pdfJsDoc || !AppState.pendingItem) return;

        // Reset placement state for this session
        chosenX              = null;
        chosenY              = null;
        scaleSlider.value    = 100;
        scaleVal.textContent = '100%';
        confirmBtn.disabled  = true;

        // Show the modal and prevent background scrolling
        modal.hidden           = false;
        document.body.style.overflow = 'hidden';

        await renderThumbnail();
    }

    /**
     * Renders a scaled-down version of the current PDF page onto the
     * placement canvas. Calculates and stores the canvas-to-PDF-point ratios.
     */
    async function renderThumbnail() {
        const page          = await AppState.pdfJsDoc.getPage(AppState.currentPage);
        const containerW    = previewCanvas.parentElement.clientWidth - 32;
        const maxH          = 400;
        const baseViewport  = page.getViewport({ scale: 1 });

        // Calculate the best-fit scale to fill the container without overflow
        const scale = Math.min(
            containerW / baseViewport.width,
            maxH       / baseViewport.height,
        );
        const viewport = page.getViewport({ scale });

        previewCanvas.width  = viewport.width;
        previewCanvas.height = viewport.height;

        // Store the pixel-to-point conversion ratios for coordinate mapping
        canvasScaleX = viewport.width  / baseViewport.width;
        canvasScaleY = viewport.height / baseViewport.height;

        const ctx = previewCanvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        // If user already chose a position (e.g., changed scale), redraw ghost
        if (chosenX !== null) drawPlacementPreview();
    }

    /**
     * Handles a click on the placement thumbnail canvas.
     * Converts the click pixel coordinates to PDF point coordinates,
     * stores them in chosenX/chosenY, and enables the confirm button.
     *
     * @param {MouseEvent} e
     */
    function onCanvasClick(e) {
        const rect   = previewCanvas.getBoundingClientRect();
        // Account for CSS scaling: canvas logical pixels vs. CSS display pixels
        const pixelX = (e.clientX - rect.left)  * (previewCanvas.width  / rect.width);
        const pixelY = (e.clientY - rect.top)   * (previewCanvas.height / rect.height);

        // Convert canvas pixels → PDF points using the stored scale ratios
        chosenX = pixelX / canvasScaleX;
        chosenY = pixelY / canvasScaleY;

        drawPlacementPreview();
        confirmBtn.disabled = false; // Allow confirmation once a position is chosen
    }

    /**
     * Draws a dashed ghost rectangle at the chosen position on the thumbnail canvas.
     * Shows the user exactly where the signature/stamp will be placed before confirming.
     * A crosshair is drawn at the exact click point.
     */
    function drawPlacementPreview() {
        if (chosenX === null) return;

        const ctx   = previewCanvas.getContext('2d');
        const scale = parseFloat(scaleSlider.value) / 100;

        // Compute signature display size in PDF points at the current scale
        const baseW       = 200 * scale;
        const baseH       = 80  * scale;
        sigWidthPts       = baseW;
        sigHeightPts      = baseH;

        // Convert to canvas pixel coordinates for drawing the ghost overlay
        const ghostX = chosenX * canvasScaleX - (baseW * canvasScaleX) / 2;
        const ghostY = chosenY * canvasScaleY - (baseH * canvasScaleY) / 2;
        const ghostW = baseW   * canvasScaleX;
        const ghostH = baseH   * canvasScaleY;

        // Draw the ghost rectangle (semi-transparent blue fill + dashed border)
        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = '#4f8eff';
        ctx.lineWidth   = 2;
        ctx.fillStyle   = 'rgba(79, 142, 255, 0.1)';
        ctx.fillRect(ghostX, ghostY, ghostW, ghostH);
        ctx.strokeRect(ghostX, ghostY, ghostW, ghostH);

        // Draw crosshair at the exact click anchor point
        const cx = chosenX * canvasScaleX;
        const cy = chosenY * canvasScaleY;
        ctx.setLineDash([]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
        ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Finalizes the placement by creating an annotation record in AppState,
     * then closing the modal and triggering an overlay re-render.
     * Called when the user clicks "Place Here".
     */
    function confirm() {
        if (chosenX === null || !AppState.pendingItem) return;

        const scale = parseFloat(scaleSlider.value) / 100;

        // Build the annotation record in PDF point coordinates
        const annotation = {
            id:       `ann_${Date.now()}`,
            type:     AppState.pendingItem.type,
            page:     AppState.currentPage,
            // The origin is at the top-left of the item (center-offset from click point)
            // Y-axis flip for pdf-lib bottom-left origin is handled during export.
            xPt:      chosenX - (sigWidthPts  / 2),
            yPt:      chosenY - (sigHeightPts / 2),
            widthPt:  sigWidthPts,
            heightPt: sigHeightPts,
            data:     AppState.pendingItem.data,
            label:    AppState.pendingItem.label,
            opacity:  AppState.pendingItem.opacity ?? 1.0,
            scale,
        };

        AppState.annotations.push(annotation);
        AppState.pendingItem = null;

        Logger.log('success', `Placed ${annotation.type} on page ${annotation.page} at (${Math.round(annotation.xPt)}, ${Math.round(annotation.yPt)}) pt.`);

        close();
        AnnotationManager.updateUI();
        PDFViewer.renderCurrentPage();
        ExportEngine.updateSummary();
        enableExportBtn();
        window.showToast(`${annotation.label} placed on page ${annotation.page}.`);
    }

    /**
     * Closes the modal and restores body scrolling.
     * Also clears the pending item to prevent stale state.
     */
    function close() {
        modal.hidden                 = true;
        document.body.style.overflow = '';
        AppState.pendingItem         = null;
    }

    return { init, open };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: ANNOTATION MANAGER
   ─────────────────────────────────────────────────────────────────────────
   Maintains two views of the placed annotations:
     1. Overlay Canvas — renders annotation images on top of the PDF canvas
        at the correct scaled positions (for visual preview).
     2. Placed Items List — displays a UI list in the sidebar showing each
        annotation with a remove button.

   The overlay canvas is re-rendered after every page navigation, zoom change,
   and annotation add/remove operation to stay in sync with the PDF canvas.
═══════════════════════════════════════════════════════════════════════════ */
const AnnotationManager = (() => {
    const listEl  = document.getElementById('placed-items-list');
    const countEl = document.getElementById('placed-count');

    /**
     * Draws all annotations for the current page onto the overlay canvas.
     * The overlay canvas sits directly above the PDF canvas and is transparent,
     * so the PDF shows through wherever no annotation is drawn.
     *
     * Coordinate conversion:
     *   PDF points (AppState.currentScale) → canvas pixels
     *   xCanvas = ann.xPt * AppState.currentScale
     *   yCanvas = ann.yPt * AppState.currentScale
     */
    function renderOverlay() {
        const canvas = document.getElementById('overlay-canvas');
        const ctx    = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Filter annotations to only those on the currently displayed page
        const pageAnnotations = AppState.annotations.filter(
            (a) => a.page === AppState.currentPage
        );

        pageAnnotations.forEach((ann) => {
            const img    = new Image();
            img.onload = () => {
                // Scale PDF point coordinates to canvas pixel coordinates
                const x = ann.xPt     * AppState.currentScale;
                const y = ann.yPt     * AppState.currentScale;
                const w = ann.widthPt  * AppState.currentScale;
                const h = ann.heightPt * AppState.currentScale;

                ctx.save();
                ctx.globalAlpha = ann.opacity; // Apply annotation opacity
                ctx.drawImage(img, x, y, w, h);
                ctx.restore();
            };
            img.src = ann.data;
        });
    }

    /**
     * Updates the placed items sidebar list to reflect the current AppState.annotations.
     * Each list item shows the annotation type icon, label, page number,
     * and a remove button that splices the item from AppState.
     */
    function updateUI() {
        const items = AppState.annotations;

        // Update the count badge
        countEl.textContent = items.length;

        if (items.length === 0) {
            listEl.innerHTML = '<p class="dos-empty-state-text">No items placed yet</p>';
            return;
        }

        listEl.innerHTML = '';

        items.forEach((ann, index) => {
            // Map annotation types to Font Awesome icon names
            const iconMap = {
                signature: 'fa-signature',
                stamp:     'fa-stamp',
                text:      'fa-font',
                seal:      'fa-certificate',
            };

            const item = document.createElement('div');
            item.className = 'placed-item';
            item.innerHTML = `
                <i class="fa-solid ${iconMap[ann.type] || 'fa-layer-group'}" aria-hidden="true"></i>
                <span class="placed-item__label" title="${escapeHtml(ann.label)}">
                    ${escapeHtml(ann.label)} — P.${ann.page}
                </span>
                <button class="placed-item__remove" aria-label="Remove this item"
                    data-index="${index}" title="Remove">
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            `;

            // Wire up the remove button to splice this annotation from state
            item.querySelector('.placed-item__remove').addEventListener('click', () => {
                AppState.annotations.splice(index, 1);
                updateUI();
                PDFViewer.renderCurrentPage();
                ExportEngine.updateSummary();
                Logger.log('info', `Removed annotation: "${ann.label}"`);
                window.showToast('Annotation removed.');
            });

            listEl.appendChild(item);
        });
    }

    return { renderOverlay, updateUI };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: OCR ENGINE
   ─────────────────────────────────────────────────────────────────────────
   Integrates Tesseract.js v5 for WebAssembly-powered offline OCR.
   UPDATED FOR CODECANYON: Uses Tesseract.createWorker() with explicitly
   defined local paths to guarantee 100% offline functionality without
   fetching fallback files from external CDNs.
═══════════════════════════════════════════════════════════════════════════ */
const OCREngine = (() => {
    const runBtn        = document.getElementById('run-ocr-btn');
    const btnText       = document.getElementById('ocr-btn-text');
    const progressWrap  = document.getElementById('ocr-progress-wrapper');
    const progressBar   = document.getElementById('ocr-progress-bar');
    const progressLabel = document.getElementById('ocr-progress-label');
    const resultSection = document.getElementById('ocr-result-section');
    const outputArea    = document.getElementById('ocr-text-output');
    const statsEl       = document.getElementById('ocr-stats');

    function init() {
        runBtn.addEventListener('click', runOCR);
        document.getElementById('copy-ocr-btn').addEventListener('click',     copyText);
        document.getElementById('download-ocr-btn').addEventListener('click', downloadText);
    }

    async function runOCR() {
        if (!AppState.pdfJsDoc) {
            window.showToast('Please load a PDF document first.');
            return;
        }
        if (AppState.ocrBusy) {
            window.showToast('OCR is already running. Please wait.');
            return;
        }

        const lang     = document.getElementById('ocr-lang-select').value;
        const pageMode = document.getElementById('ocr-page-select').value;

        AppState.ocrBusy    = true;
        runBtn.disabled     = true;
        btnText.innerHTML   = '<i class="fa-solid fa-circle-notch fa-spin-pulse" aria-hidden="true"></i> Processing…';
        progressWrap.hidden = false;
        progressWrap.removeAttribute('hidden');
        resultSection.hidden = true;

        Logger.log('ocr', `Starting OCR — Language: ${lang}, Mode: ${pageMode}`);

        let worker = null;

        try {
            const pagesToProcess = pageMode === 'all'
                ? Array.from({ length: AppState.totalPages }, (_, i) => i + 1)
                : [AppState.currentPage];

            let fullText  = '';
            let startTime = performance.now();

            // ── Initialize Offline WebWorker with Local Paths ────────────────
            worker = await Tesseract.createWorker({
                workerPath: '../../assets/library/media-vision/tesseract/worker.min.js',
                corePath: '../../assets/library/media-vision/tesseract/tesseract-core.wasm.js',
                langPath: '../../assets/library/media-vision/tesseract/lang-data',
                logger: (m) => {
                    // We handle detailed progress logging below
                },
            });

            await worker.loadLanguage(lang);
            await worker.initialize(lang);

            for (let i = 0; i < pagesToProcess.length; i++) {
                const pageNum  = pagesToProcess[i];
                const pageLabel = `Page ${pageNum}/${pagesToProcess.length}`;

                const baseProgress = (i / pagesToProcess.length) * 100;
                updateProgress(baseProgress, `Rendering ${pageLabel}…`);

                const imageBlob = await renderPageToBlob(pageNum, 2.0);

                updateProgress(baseProgress + (1 / pagesToProcess.length) * 20, `Running OCR on ${pageLabel}…`);
                Logger.log('ocr', `Processing ${pageLabel} (rendered at 2× scale for accuracy)…`);

                // Create a temporary worker to track per-page progress correctly
                const tempWorker = await Tesseract.createWorker({
                     workerPath: '../../assets/library/media-vision/tesseract/worker.min.js',
                     corePath: '../../assets/library/media-vision/tesseract/tesseract-core.wasm.js',
                     langPath: '../../assets/library/media-vision/tesseract/lang-data',
                     logger: (m) => {
                         if (m.status === 'recognizing text') {
                             const pct = baseProgress + (m.progress * (1 / pagesToProcess.length) * 80);
                             updateProgress(pct, `OCR ${pageLabel}: ${Math.round(m.progress * 100)}%`);
                         }
                     }
                });
                
                await tempWorker.loadLanguage(lang);
                await tempWorker.initialize(lang);
                await tempWorker.setParameters({ tessjs_create_pdf: '0' });

                const result = await tempWorker.recognize(imageBlob);
                await tempWorker.terminate();

                fullText += `\n--- Page ${pageNum} ---\n${result.data.text}`;
                Logger.log('ocr', `Page ${pageNum} complete. Words found: ${result.data.words?.length ?? '?'}`);
            }

            const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);

            AppState.lastOcrText  = fullText.trim();
            outputArea.value      = AppState.lastOcrText;
            statsEl.textContent   = `${pagesToProcess.length} page(s) · ${AppState.lastOcrText.split(/\s+/).filter(Boolean).length} words · ${elapsedSec}s`;

            updateProgress(100, 'OCR Complete!');
            resultSection.hidden = false;

            Logger.log('success', `OCR completed in ${elapsedSec}s. Total characters: ${AppState.lastOcrText.length}`);
            window.showToast('OCR extraction complete!');

            ExportEngine.updateSummary();

        } catch (err) {
            Logger.log('error', `OCR failed: ${err.message}`);
            window.showToast('OCR failed. Make sure language data is available locally.', true);
            console.error('[DocuSignOCR] OCR error:', err);
        } finally {
            if (worker) {
                try { await worker.terminate(); } catch (e) {}
            }
            AppState.ocrBusy  = false;
            runBtn.disabled   = false;
            btnText.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Extract Text (OCR)';

            setTimeout(() => {
                if (progressWrap) progressWrap.hidden = true;
            }, 1500);
        }
    }

    async function renderPageToBlob(pageNum, scale = 2.0) {
        const page      = await AppState.pdfJsDoc.getPage(pageNum);
        const viewport  = page.getViewport({ scale });
        const offscreen = document.createElement('canvas');
        offscreen.width  = viewport.width;
        offscreen.height = viewport.height;
        const ctx = offscreen.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        return new Promise((resolve) => {
            offscreen.toBlob(resolve, 'image/png');
        });
    }

    function updateProgress(pct, label) {
        const clampedPct = Math.min(100, Math.max(0, pct));
        progressBar.style.width = clampedPct + '%';
        progressBar.classList.toggle('dos-ocr-progress-bar--animating', clampedPct < 100);
        progressLabel.textContent = label;
        progressWrap.setAttribute('aria-valuenow', Math.round(clampedPct));
    }

    async function copyText() {
        if (!AppState.lastOcrText) return;
        try {
            await navigator.clipboard.writeText(AppState.lastOcrText);
            window.showToast('OCR text copied to clipboard.');
        } catch {
            window.showToast('Copy failed — please select and copy manually.', true);
        }
    }

    function downloadText() {
        if (!AppState.lastOcrText) return;
        const filename = (AppState.pdfFile?.name?.replace(/\.[^/.]+$/, '') || 'extracted-text') + '-ocr.txt';
        const blob     = new Blob([AppState.lastOcrText], { type: 'text/plain;charset=utf-8' });
        const url      = URL.createObjectURL(blob);
        const a        = document.createElement('a');
        a.href         = url;
        a.download     = filename;
        a.click();
        URL.revokeObjectURL(url);
        Logger.log('info', `OCR text downloaded as "${filename}".`);
    }

    return { init };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: SECURITY MODULE
   ─────────────────────────────────────────────────────────────────────────
   Generates a SHA-256 cryptographic hash (document fingerprint) using the
   browser's built-in WebCrypto API (window.crypto.subtle) — no library needed.

   Why SHA-256?
   ─────────────────────────────────────────────────────────────────────────
   - One-way function: impossible to reconstruct the document from the hash.
   - Deterministic: identical documents always produce identical hashes.
   - Avalanche effect: any change (even 1 bit) produces a completely different hash.
   - WebCrypto implementation uses native hardware acceleration where available.
   - The resulting 64-character hex string can optionally be embedded as a
     visible watermark seal on any page of the PDF.
═══════════════════════════════════════════════════════════════════════════ */
const SecurityModule = (() => {
    const generateBtn   = document.getElementById('generate-hash-btn');
    const hashSection   = document.getElementById('hash-result-section');
    const hashDisplay   = document.getElementById('hash-display');
    const hashTimestamp = document.getElementById('hash-timestamp');
    const sealOptions   = document.getElementById('seal-options');
    const copyHashBtn   = document.getElementById('copy-hash-btn');
    const embedToggle   = document.getElementById('embed-seal-toggle');
    const applySealBtn  = document.getElementById('apply-seal-btn');

    /**
     * Wires up the generate, copy, and apply-seal button listeners.
     * Also registers the aria-checked update for the embed toggle.
     */
    function init() {
        generateBtn.addEventListener('click',  generateHash);
        copyHashBtn.addEventListener('click',  copyHash);
        applySealBtn.addEventListener('click', applySeal);

        // Keep aria-checked attribute in sync for accessibility
        embedToggle.addEventListener('change', () => {
            embedToggle.setAttribute('aria-checked', embedToggle.checked.toString());
        });
    }

    /**
     * Computes a SHA-256 hash of the current PDF's raw bytes using WebCrypto.
     * The hash is computed over the ORIGINAL file bytes (AppState.pdfArrayBuffer)
     * to create a deterministic baseline fingerprint.
     *
     * The resulting 64-character hex string is stored in AppState.documentHash
     * and displayed in the hash-display element.
     */
    async function generateHash() {
        if (!AppState.pdfArrayBuffer) {
            window.showToast('Please load a PDF document first.');
            return;
        }

        Logger.log('info', 'Computing SHA-256 hash via WebCrypto API…');
        generateBtn.disabled    = true;
        generateBtn.innerHTML   = '<i class="fa-solid fa-circle-notch fa-spin-pulse" aria-hidden="true"></i> Hashing…';

        try {
            // subtle.digest is hardware-accelerated on most platforms
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', AppState.pdfArrayBuffer);

            // Convert the raw hash bytes (ArrayBuffer) to a hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex   = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

            AppState.documentHash  = hashHex;
            AppState.hashTimestamp = new Date().toISOString();

            hashDisplay.textContent   = hashHex;
            hashTimestamp.textContent = `Generated: ${new Date(AppState.hashTimestamp).toLocaleString()}`;
            hashSection.hidden = false;
            sealOptions.hidden = false;

            Logger.log('success', `SHA-256: ${hashHex.slice(0, 32)}…`);
            window.showToast('SHA-256 hash generated successfully.');
            ExportEngine.updateSummary();

        } catch (err) {
            Logger.log('error', `Hash generation failed: ${err.message}`);
            window.showToast('Hash generation failed. WebCrypto may not be available.', true);
        } finally {
            generateBtn.disabled  = false;
            generateBtn.innerHTML = '<i class="fa-solid fa-fingerprint" aria-hidden="true"></i> Generate SHA-256 Hash';
        }
    }

    /**
     * Copies the generated hash string to the system clipboard.
     */
    async function copyHash() {
        if (!AppState.documentHash) return;
        try {
            await navigator.clipboard.writeText(AppState.documentHash);
            window.showToast('Hash copied to clipboard.');
        } catch {
            window.showToast('Copy failed — please select and copy manually.', true);
        }
    }

    /**
     * Renders the SHA-256 hash as a visual watermark seal image and places it
     * on the PDF at the user-selected position (bottom-right, center, etc.).
     *
     * The seal is drawn on an off-screen canvas (420×80 px) and converted to
     * a PNG data URL, then added to AppState.annotations via the same pipeline
     * used by signatures and stamps.
     */
    async function applySeal() {
        if (!AppState.documentHash) {
            window.showToast('Please generate a hash first.');
            return;
        }

        const position = document.getElementById('seal-position-select').value;
        Logger.log('info', `Embedding SHA-256 seal at position: ${position}`);

        // ── Render Seal Image ─────────────────────────────────────────────
        const sealCanvas      = document.createElement('canvas');
        sealCanvas.width      = 420;
        sealCanvas.height     = 80;
        const ctx             = sealCanvas.getContext('2d');

        // Dark blue glass background
        ctx.fillStyle = 'rgba(22, 34, 68, 0.88)';
        roundRect(ctx, 0, 0, sealCanvas.width, sealCanvas.height, 8);
        ctx.fill();

        // Blue border
        ctx.strokeStyle = '#4f8eff';
        ctx.lineWidth   = 1.5;
        roundRect(ctx, 1, 1, sealCanvas.width - 2, sealCanvas.height - 2, 8);
        ctx.stroke();

        // Icon + header label
        ctx.fillStyle = '#4f8eff';
        ctx.font      = 'bold 11px monospace';
        ctx.fillText('🔒 SHA-256 CRYPTOGRAPHIC SEAL', 14, 20);

        // Hash string (truncated for display — full hash stored in metadata)
        ctx.fillStyle = '#22c55e';
        ctx.font      = '9px monospace';
        ctx.fillText(AppState.documentHash.slice(0, 52) + '…', 14, 38);

        // Timestamp line
        ctx.fillStyle = '#9ba3c2';
        ctx.font      = '9px monospace';
        ctx.fillText(`Signed: ${new Date(AppState.hashTimestamp).toLocaleString()}`, 14, 55);

        // Verification attribution line
        ctx.fillStyle = '#5a6385';
        ctx.font      = '8px monospace';
        ctx.fillText('Verified by DocuSign OCR Studio · trustedtoolsweb.com', 14, 72);

        const sealDataUrl = sealCanvas.toDataURL('image/png');

        // ── Calculate PDF Point Coordinates for the Chosen Position ───────
        const page     = await AppState.pdfJsDoc.getPage(AppState.currentPage);
        const viewport = page.getViewport({ scale: 1 });
        const sW = 240;  // Seal width in PDF points
        const sH = 48;   // Seal height in PDF points
        const margin = 20;

        // Position map: defines top-left corner of the seal for each preset
        const positionMap = {
            'bottom-right': { xPt: viewport.width  - sW - margin, yPt: viewport.height - sH - margin },
            'bottom-left':  { xPt: margin,                         yPt: viewport.height - sH - margin },
            'top-right':    { xPt: viewport.width  - sW - margin,  yPt: margin },
            'top-left':     { xPt: margin,                         yPt: margin },
            'center':       { xPt: (viewport.width - sW) / 2,     yPt: (viewport.height - sH) / 2 },
        };

        const { xPt, yPt } = positionMap[position] || positionMap['bottom-right'];

        // Add the seal as an annotation (same pipeline as signatures/stamps)
        AppState.annotations.push({
            id:       `seal_${Date.now()}`,
            type:     'seal',
            page:     AppState.currentPage,
            xPt, yPt,
            widthPt:  sW,
            heightPt: sH,
            data:     sealDataUrl,
            label:    'SHA-256 Security Seal',
            opacity:  0.9,
        });

        AppState.sealApplied = true;

        AnnotationManager.updateUI();
        PDFViewer.renderCurrentPage();
        ExportEngine.updateSummary();
        enableExportBtn();

        Logger.log('success', 'Security seal embedded on page ' + AppState.currentPage);
        window.showToast('Security seal applied to document.');
    }

    /**
     * Draws a rounded rectangle path on a 2D canvas context.
     * Compatible with browsers before the native roundRect() method (pre-2023).
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     * @param {number} w - Width.
     * @param {number} h - Height.
     * @param {number} r - Corner radius.
     */
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y,     x + w, y + r,     r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x,     y + h, x,     y + h - r, r);
        ctx.lineTo(x,     y + r);
        ctx.arcTo(x,     y,     x + r, y,         r);
        ctx.closePath();
    }

    return { init };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: EXPORT ENGINE
   ─────────────────────────────────────────────────────────────────────────
   Uses pdf-lib v1.17.1 to embed all annotations as permanent page content
   and export the final PDF for download.

   Export Workflow:
   ─────────────────────────────────────────────────────────────────────────
   1. Load the original PDF bytes into pdf-lib (PDFDocument.load).
   2. Optionally embed metadata: author, title, creation date, SHA-256 hash.
   3. For each annotation (grouped by page):
      a. Convert its base64 data URL to Uint8Array bytes.
      b. Embed as PNG or JPEG via pdfDoc.embedPng/embedJpg.
      c. Convert viewer coordinates (top-left origin, scaled pixels) back to
         pdf-lib coordinates (bottom-left origin, PDF points).
      d. Draw the image onto the page with pdfDoc.drawImage().
   4. Serialize the modified PDF with PDFDocument.save().
   5. Create a Blob URL and trigger a browser download.

   Coordinate System Conversion:
   ─────────────────────────────────────────────────────────────────────────
   Viewer (screen): origin = top-left,    Y increases DOWNWARD
   pdf-lib (PDF):   origin = bottom-left, Y increases UPWARD

   Conversion: pdfY = pageHeight - viewerY - annotationHeight
═══════════════════════════════════════════════════════════════════════════ */
const ExportEngine = (() => {
    const exportBtn     = document.getElementById('export-btn');
    const filenameInput = document.getElementById('export-filename');

    /**
     * Registers the export button click listener.
     */
    function init() {
        exportBtn.addEventListener('click', exportPDF);
    }

    /**
     * Main export function.
     * Validates state, loads the PDF into pdf-lib, embeds all annotations,
     * optionally flattens and embeds metadata, then downloads the result.
     */
    async function exportPDF() {
        if (!AppState.pdfArrayBuffer) {
            window.showToast('No document loaded.');
            return;
        }

        const shouldFlatten = document.getElementById('flatten-toggle').checked;
        const embedMetadata = document.getElementById('metadata-toggle').checked;
        const filename      = (filenameInput.value.trim() || 'signed-document') + '.pdf';

        // Disable button and show spinner during export
        exportBtn.disabled  = true;
        exportBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin-pulse" aria-hidden="true"></i> Exporting…';

        Logger.log('info', `Starting PDF export: "${filename}" — ${AppState.annotations.length} annotations, flatten: ${shouldFlatten}`);

        try {
            const { PDFDocument, rgb, degrees } = PDFLib;

            // Load a fresh copy of the original PDF bytes into pdf-lib
            const pdfDoc = await PDFDocument.load(AppState.pdfArrayBuffer, {
                ignoreEncryption: false,
            });

            // ── Embed Document Metadata ────────────────────────────────────
            if (embedMetadata) {
                pdfDoc.setTitle(AppState.pdfFile?.name?.replace(/\.pdf$/i, '') || 'Signed Document');
                pdfDoc.setAuthor('DocuSign OCR Studio — Trusted Tools Web');
                pdfDoc.setSubject('Document signed and processed with DocuSign OCR Studio');
                pdfDoc.setCreator('DocuSign OCR Studio v1.0 (trustedtoolsweb.com)');
                pdfDoc.setProducer('pdf-lib 1.17.1 + Trusted Tools Web');
                pdfDoc.setCreationDate(new Date());
                pdfDoc.setModificationDate(new Date());

                if (AppState.documentHash) {
                    // Embed the SHA-256 hash in the keywords field for programmatic verification
                    pdfDoc.setKeywords([
                        'signed', 'ocr', 'sha256:' + AppState.documentHash,
                        'trustedtoolsweb', new Date().toISOString(),
                    ]);
                } else {
                    pdfDoc.setKeywords(['signed', 'ocr', 'trustedtoolsweb']);
                }

                Logger.log('info', 'Document metadata embedded.');
            }

            // ── Embed Annotations ──────────────────────────────────────────
            // Group annotations by page number for efficient processing
            const pageMap = new Map();
            AppState.annotations.forEach((ann) => {
                if (!pageMap.has(ann.page)) pageMap.set(ann.page, []);
                pageMap.get(ann.page).push(ann);
            });

            for (const [pageNum, anns] of pageMap.entries()) {
                // pdf-lib uses 0-based page indexing (subtract 1 from 1-based page)
                const page = pdfDoc.getPage(pageNum - 1);
                const { width: pageWidth, height: pageHeight } = page.getSize();

                for (const ann of anns) {
                    Logger.log('info', `Embedding ${ann.type} on page ${pageNum}…`);

                    // Convert Base64 data URL to raw Uint8Array for pdf-lib
                    const base64 = ann.data.split(',')[1];
                    const bytes  = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

                    // Embed the image — pdf-lib auto-handles PNG and JPEG formats
                    let embeddedImg;
                    if (ann.data.startsWith('data:image/jpeg')) {
                        embeddedImg = await pdfDoc.embedJpg(bytes);
                    } else {
                        embeddedImg = await pdfDoc.embedPng(bytes);
                    }

                    // ── Coordinate System Conversion ───────────────────────
                    // Our viewer uses top-left origin (screen coordinates).
                    // pdf-lib uses bottom-left origin (PDF coordinates).
                    // Formula: pdfY = pageHeight - viewerY - annotationHeight
                    const pdfX = ann.xPt;
                    const pdfY = pageHeight - ann.yPt - ann.heightPt;

                    page.drawImage(embeddedImg, {
                        x:       pdfX,
                        y:       pdfY,
                        width:   ann.widthPt,
                        height:  ann.heightPt,
                        opacity: ann.opacity,
                    });
                }
            }

            // ── Flattening Note ────────────────────────────────────────────
            // pdf-lib embeds images directly as page content streams (not as
            // interactive form fields). This means the output is effectively
            // already "flat" — there are no removable annotation layers.
            // No additional flatten operation is needed beyond calling save().
            if (shouldFlatten) {
                Logger.log('info', 'PDF flattened — annotations baked into page content.');
            }

            // ── Serialize & Download ───────────────────────────────────────
            const pdfBytes = await pdfDoc.save({
                useObjectStreams: false,  // Improves compatibility with older PDF readers
                addDefaultPage:  false,
                objectsPerTick:  50,     // Batch size for async serialization ticks
            });

            // Create a Blob URL and trigger the browser's file download dialog
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            AppState.exportCount++;
            Logger.log('success', `PDF exported: "${filename}" (${formatBytes(pdfBytes.length)}). Total exports: ${AppState.exportCount}`);
            window.showToast(`Document downloaded: "${filename}"`);

        } catch (err) {
            Logger.log('error', `Export failed: ${err.message}`);
            window.showToast('Export failed. See terminal for details.', true);
            console.error('[DocuSignOCR] Export error:', err);
        } finally {
            // Always restore the export button state
            exportBtn.disabled  = false;
            exportBtn.innerHTML = '<i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i><span>Flatten &amp; Download PDF</span>';
        }
    }

    /**
     * Updates the export summary panel with current AppState information.
     * Called after any annotation change, OCR completion, or hash generation.
     */
    function updateSummary() {
        // Count all placed signatures, stamps, seals
        const sigCount  = AppState.annotations.filter(
            (a) => a.type === 'signature' || a.type === 'stamp' || a.type === 'seal'
        ).length;

        document.getElementById('summary-sigs').textContent =
            `${sigCount} signature/stamp${sigCount !== 1 ? 's' : ''} placed`;

        document.getElementById('summary-ocr').textContent =
            AppState.lastOcrText
                ? `OCR: ${AppState.lastOcrText.split(/\s+/).filter(Boolean).length} words extracted`
                : 'OCR not run';

        document.getElementById('summary-hash').textContent =
            AppState.sealApplied
                ? 'SHA-256 seal applied'
                : AppState.documentHash
                    ? 'Hash generated (seal not embedded)'
                    : 'No seal applied';
    }

    return { init, updateSummary };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: TAB CONTROLLER
   ─────────────────────────────────────────────────────────────────────────
   Manages tab switching for both the main action tabs (Sign / OCR /
   Security / Export) and the sub-tabs within the Sign panel (Draw / Stamp / Text).

   Main tabs:
   - Buttons have class .dos-tab-btn and data-tab attribute.
   - Panels have IDs of the format: tab-panel-{tabId}.
   - Active state: .dos-tab-btn--active on button, .tab-panel--active on panel.

   Sub-tabs:
   - Buttons have class .dos-sub-tab-btn and data-subtab attribute.
   - Panels have IDs of the format: subtab-content-{subtabId}.
   - Active state: .dos-sub-tab-btn--active on button, .dos-subtab-content--active on panel.
═══════════════════════════════════════════════════════════════════════════ */
const TabController = (() => {
    /**
     * Attaches click listeners to all main tab and sub-tab buttons.
     */
    function init() {
        // ── Main Action Tabs ───────────────────────────────────────────────
        document.querySelectorAll('.dos-tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;

                // Deactivate all tab buttons
                document.querySelectorAll('.dos-tab-btn').forEach((b) => {
                    b.classList.remove('dos-tab-btn--active');
                    b.setAttribute('aria-selected', 'false');
                });

                // Activate the clicked tab button
                btn.classList.add('dos-tab-btn--active');
                btn.setAttribute('aria-selected', 'true');

                // Show the matching panel, hide all others
                document.querySelectorAll('.tab-panel').forEach((panel) => {
                    const isActive = panel.id === `tab-panel-${tabId}`;
                    panel.classList.toggle('tab-panel--active', isActive);
                    panel.hidden = !isActive;
                });
            });
        });

        // ── Sub-Tabs (Draw / Stamp / Text within Sign panel) ───────────────
        document.querySelectorAll('.dos-sub-tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const subtabId = btn.dataset.subtab;

                // Deactivate all sub-tab buttons
                document.querySelectorAll('.dos-sub-tab-btn').forEach((b) =>
                    b.classList.remove('dos-sub-tab-btn--active')
                );

                // Activate the clicked sub-tab button
                btn.classList.add('dos-sub-tab-btn--active');

                // Show matching sub-panel, hide all others
                document.querySelectorAll('.dos-subtab-content').forEach((content) => {
                    const isActive = content.id === `subtab-content-${subtabId}`;
                    content.classList.toggle('dos-subtab-content--active', isActive);
                });
            });
        });
    }

    return { init };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: UI HELPERS
   ─────────────────────────────────────────────────────────────────────────
   Miscellaneous UI wiring that doesn't belong to a specific feature module:
     - Terminal clear button
     - Range slider live value display (for all sliders)
     - Toggle switch aria-checked synchronization
     - Export filename sanitization (removes OS-invalid characters)
═══════════════════════════════════════════════════════════════════════════ */
const UIHelpers = (() => {
    /**
     * Registers all miscellaneous UI event listeners.
     */
    function init() {
        // Terminal clear button → Logger.clear()
        document.getElementById('clear-log-btn').addEventListener('click', Logger.clear);

        // ── Range Slider Live Value Display ────────────────────────────────
        // Each slider has an associated <span> that shows its current value.
        const ranges = [
            { slider: 'sig-thickness',   output: 'sig-thickness-val',  suffix: 'px' },
            { slider: 'stamp-opacity',   output: 'stamp-opacity-val',  suffix: '%' },
            { slider: 'text-font-size',  output: 'text-font-size-val', suffix: 'px' },
            { slider: 'placement-scale', output: 'placement-scale-val', suffix: '%' },
        ];

        ranges.forEach(({ slider, output, suffix }) => {
            const el  = document.getElementById(slider);
            const out = document.getElementById(output);
            if (el && out) {
                el.addEventListener('input', () => {
                    out.textContent = el.value + suffix;
                });
            }
        });

        // ── Toggle Switch aria-checked Sync ────────────────────────────────
        // Keep ARIA state in sync with visual state for screen readers.
        document.querySelectorAll('[role="switch"]').forEach((toggle) => {
            toggle.addEventListener('change', () => {
                toggle.setAttribute('aria-checked', toggle.checked.toString());
            });
        });

        // ── Export Filename Sanitization ───────────────────────────────────
        // Remove characters that are invalid in filenames on Windows, macOS, Linux.
        const filenameInput = document.getElementById('export-filename');
        filenameInput.addEventListener('input', () => {
            filenameInput.value = filenameInput.value.replace(/[/\\:*?"<>|]/g, '');
        });
    }

    return { init };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY: ENABLE EXPORT BUTTON
   ─────────────────────────────────────────────────────────────────────────
   The export button is gated behind having a loaded PDF. This function is
   called after any action that makes the document ready for export:
   file load, annotation placement, OCR completion, hash generation.
═══════════════════════════════════════════════════════════════════════════ */
/**
 * Enables the export/download button if a PDF ArrayBuffer is present.
 * Silently does nothing if no document is currently loaded.
 */
function enableExportBtn() {
    const btn = document.getElementById('export-btn');
    if (AppState.pdfArrayBuffer) {
        btn.disabled = false;
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   MODULE: INIT
   ─────────────────────────────────────────────────────────────────────────
   Bootstrap function that:
     1. Checks browser API availability (WebCrypto, WebAssembly, File API,
        Clipboard API) and logs the results to the terminal.
     2. Disables features that require unavailable APIs (OCR disabled if
        no WebAssembly; Security disabled if no WebCrypto).
     3. Initializes all feature modules in dependency order.
     4. Detects mobile browsers and shows a feature-limitation toast for
        advanced APIs that may not work on mobile.
═══════════════════════════════════════════════════════════════════════════ */
const Init = (() => {
    /**
     * Main bootstrap entry point.
     * Runs environment checks and initializes all modules.
     */
    async function run() {
        // ── Step 1: Environment Capability Checks ──────────────────────────
        checkCapabilities();

        // ── Step 2: Mobile Detection ───────────────────────────────────────
        // Warn mobile users that some advanced APIs (WebAssembly OCR, WebCrypto)
        // may be unavailable or limited on older mobile browsers.
        detectMobileAndWarn();

        // ── Step 3: Initialize All Feature Modules ─────────────────────────
        TabController.init();
        UIHelpers.init();
        FileHandler.init();
        PDFViewer.init();
        SignatureCanvas.init();
        StampHandler.init();
        TextAnnotation.init();
        PlacementModal.init();
        OCREngine.init();
        SecurityModule.init();
        ExportEngine.init();

        Logger.log('success', 'All modules initialized. DocuSign OCR Studio is ready.');
    }

    /**
     * Checks for required browser APIs and logs availability status.
     * Disables specific features gracefully if APIs are missing.
     */
    function checkCapabilities() {
        // ── WebCrypto API ──────────────────────────────────────────────────
        const webcryptoEl  = document.getElementById('webcrypto-status-log');
        const hasWebCrypto = typeof window.crypto?.subtle?.digest === 'function';
        if (webcryptoEl) {
            webcryptoEl.textContent = hasWebCrypto ? '✓ Available' : '✗ Not available';
            webcryptoEl.style.color = hasWebCrypto ? '#22c55e' : '#ef4444';
        }
        if (!hasWebCrypto) {
            Logger.log('warn', 'WebCrypto API not available. SHA-256 hashing disabled. Use HTTPS or a modern browser.');
        }

        // ── WebAssembly (required by Tesseract.js OCR) ─────────────────────
        const wasmEl  = document.getElementById('wasm-status-log');
        const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
        if (wasmEl) {
            wasmEl.textContent = hasWasm ? '✓ Available' : '✗ Not available';
            wasmEl.style.color = hasWasm ? '#22c55e' : '#ef4444';
        }
        if (!hasWasm) {
            Logger.log('warn', 'WebAssembly not available. OCR functionality will be disabled.');
            const ocrBtn = document.getElementById('run-ocr-btn');
            if (ocrBtn) {
                ocrBtn.disabled = true;
                ocrBtn.title    = 'WebAssembly required for OCR';
            }
        }

        // ── File API ───────────────────────────────────────────────────────
        if (typeof FileReader === 'undefined') {
            Logger.log('warn', 'File API not available. File uploads may not work.');
        }

        // ── Clipboard API ──────────────────────────────────────────────────
        if (!navigator.clipboard) {
            Logger.log('warn', 'Clipboard API not available. Copy buttons may not work. Requires HTTPS.');
        }

        // Log browser identifier for diagnostic purposes
        Logger.log('info', `Browser: ${navigator.userAgent.split(' ').slice(-2).join(' ')}`);
    }

    /**
     * Detects mobile/tablet browsers and shows a non-blocking informational toast
     * if the user agent suggests a mobile device. Certain advanced features
     * (WebAssembly OCR, large PDF processing) may be slower on mobile hardware.
     * The tool is not blocked — only an informational notification is shown.
     */
    function detectMobileAndWarn() {
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
        if (isMobile) {
            window.showToast(
                'Mobile detected: OCR & large PDF processing may be slower on mobile browsers.'
            );
            Logger.log('warn', 'Mobile browser detected. Performance may vary for WebAssembly OCR.');
        }
    }

    return { run };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   APPLICATION ENTRY POINT
   ─────────────────────────────────────────────────────────────────────────
   Wait for the DOM to be fully parsed before running the bootstrap.
   When the script is loaded with the `defer` attribute (as it is in the HTML),
   DOMContentLoaded will have already fired, so we check readyState and
   call Init.run() directly if the document is already ready.
═══════════════════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
    // DOM is still being parsed — wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', Init.run);
} else {
    // DOM is already ready (deferred script executed after parsing)
    Init.run();
}
