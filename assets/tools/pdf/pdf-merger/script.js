/**
 * ============================================================================
 *  Ultra PDF AI — Client-Side Merge Engine
 * ============================================================================
 *  Product  : Ultra PDF AI: God Mode Editor & Merger
 *  Author   : MD KAWSAR
 *  Version  : 2.0 (CodeCanyon Marketplace Release)
 *  File     : script.js
 *
 *  OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  All PDF operations execute entirely within the user's browser.
 *  No file data is ever transmitted to an external server.
 *
 *  TECHNOLOGY STACK
 *  ─────────────────────────────────────────────────────────────────────────
 *  - pdf-lib   : Reads, copies, manipulates, and serialises PDF bytes.
 *  - pdf.js    : Renders individual PDF pages to <canvas> for thumbnails.
 *  - SortableJS: Powers the touch-friendly drag-and-drop page grid.
 *
 *  ARCHITECTURE
 *  ─────────────────────────────────────────────────────────────────────────
 *  - state.pages      : Source-of-truth array for all loaded page metadata.
 *  - state.pageCounter: Monotonically increasing counter for unique IDs.
 *  - objectUrlRegistry: Map<pageId, objectUrl> — every Blob URL created for
 *                       image previews is tracked here so URL.revokeObjectURL()
 *                       is always called on removal, preventing memory leaks.
 *
 *  NOTIFICATION SYSTEM
 *  ─────────────────────────────────────────────────────────────────────────
 *  All user notifications use the GLOBAL toast system provided by global.js:
 *    window.showToast("message")        → standard (success/info) toast
 *    window.showToast("message", true)  → error toast (boolean true = error)
 *
 *  THEME MANAGEMENT
 *  ─────────────────────────────────────────────────────────────────────────
 *  Theme toggling (dark/light) is handled entirely by global.js.
 *  No local theme logic exists in this file.
 * ============================================================================
 */


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum allowed file size per file in bytes (30 MB). */
const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

/**
 * Set of MIME types accepted for image input.
 * Only JPG and PNG are supported because pdf-lib can only embed these formats.
 */
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

/**
 * Standard A4 page dimensions expressed in PDF points (72 pt = 1 inch).
 * Used when inserting blank divider pages via addBlankPage().
 */
const A4_WIDTH_PT  = 595.28;
const A4_HEIGHT_PT = 841.89;


// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central application state object.
 *
 * @type {{ pages: Array<PageObject>, pageCounter: number }}
 *
 * PageObject shape:
 * ─────────────────────────────────────────────────────────────────────────
 * {
 *   id         : string          — Unique DOM and state identifier.
 *   type       : 'pdf' | 'image' | 'blank'
 *   docRef     : PDFDocument | null  — pdf-lib document reference (pdf only).
 *   pageIndex  : number | null       — Zero-based page index within docRef (pdf).
 *   imageBytes : ArrayBuffer | null  — Raw image bytes (image type only).
 *   imageType  : string | null       — MIME type, e.g. 'image/jpeg' (image only).
 *   rotation   : number              — Accumulated visual rotation in degrees.
 *   imgSrc     : string | null       — Data URL or Blob URL for the thumbnail.
 *   objectUrl  : string | null       — Blob URL to be revoked on cleanup.
 * }
 */
const state = {
    pages       : [],
    pageCounter : 0
};

/**
 * Registry of Blob object URLs keyed by their associated page ID.
 * This ensures URL.revokeObjectURL() is called every time a page is removed
 * or the workspace is cleared, freeing the underlying Blob memory.
 *
 * @type {Map<string, string>}
 */
const objectUrlRegistry = new Map();


// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DOMContentLoaded handler — entry point for the tool.
 *
 * Responsibilities:
 *  1. Configure the pdf.js web worker path to the correct relative asset URL.
 *  2. Bind all drag-and-drop / file-input events to the drop zone.
 *  3. Bind the "Add More Files" compact strip to the shared file input.
 *  4. Initialise the SortableJS drag-and-drop grid on #pdfGrid.
 *  5. Detect mobile browsers and warn if PDF API support may be limited.
 */
document.addEventListener('DOMContentLoaded', () => {

    // ── 1. pdf.js worker configuration ──────────────────────────────────────
    // Point pdf.js to the locally hosted worker script. This MUST be set before
    // any pdfjsLib.getDocument() call or the library will throw.
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        '../../assets/library/pdf-engine/jspdf/pdf.worker.min.js';

    // ── 2–3. Event binding ───────────────────────────────────────────────────
    setupDropZone();
    setupAddMoreStrip();

    // ── 4. Sortable grid ─────────────────────────────────────────────────────
    initSortableGrid();

    // ── 5. Mobile capability warning ─────────────────────────────────────────
    // Warn users on mobile browsers that heavy PDF files may be slower to
    // process due to memory constraints. Does not block any functionality.
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(
        navigator.userAgent
    );
    if (isMobile) {
        // Defer the toast slightly so the global.js toast system is ready.
        setTimeout(() => {
            window.showToast(
                'Mobile tip: Keep PDF files under 10 MB for the best performance.'
            );
        }, 1200);
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// DRAG-AND-DROP / FILE INPUT SETUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Binds all drag-and-drop and click-to-browse events to the drop zone element.
 *
 * Design decisions:
 *  - The #fileInput element is never replaced or cloned; only its `change`
 *    event is used. This prevents the "listener destruction" bug where a
 *    new element loses the previously bound event handlers.
 *  - The keyboard handler adds Enter/Space support for full accessibility.
 *  - dragenter/dragover/dragleave toggle the .drag-over class for visual
 *    feedback without any layout changes.
 */
function setupDropZone() {
    const dropZone  = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // ── Click on the visible drop zone triggers the hidden file picker ───────
    dropZone.addEventListener('click', () => fileInput.click());

    // ── Keyboard accessibility: Enter or Space mimics a click ─────────────
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    // ── Native file picker change event ──────────────────────────────────────
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
            // Reset value so the same file(s) can be re-selected if desired.
            e.target.value = '';
        }
    });

    // ── Drag visual feedback ──────────────────────────────────────────────────
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    // ── File drop handler ─────────────────────────────────────────────────────
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });
}

/**
 * Binds the "Add More Files" compact strip to the shared #fileInput element.
 * This strip is revealed after the workspace has been populated and provides
 * a secondary, less prominent entry point for appending additional files.
 *
 * @listens click  — Programmatically opens the native file picker.
 * @listens keydown — Enter/Space keyboard support for accessibility.
 */
function setupAddMoreStrip() {
    const strip     = document.getElementById('addMoreStrip');
    const fileInput = document.getElementById('fileInput');

    strip.addEventListener('click', () => fileInput.click());

    strip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// SORTABLE GRID INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialises the SortableJS instance on the #pdfGrid element.
 *
 * Configuration notes:
 *  - animation: 150ms CSS transition for ghost element movement — feels natural.
 *  - ghostClass: 'sortable-ghost' — styled in tools-template.css as semi-transparent.
 *  - delay / delayOnTouchOnly: A 150ms press-and-hold delay is applied only on
 *    touch devices to prevent drag from interfering with normal page scrolling.
 *  - onEnd: Calls reindexPages() to refresh the page-number badges after every sort.
 */
function initSortableGrid() {
    new Sortable(document.getElementById('pdfGrid'), {
        animation          : 150,
        ghostClass         : 'sortable-ghost',
        delay              : 150,
        delayOnTouchOnly   : true,
        onEnd              : reindexPages
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// FILE HANDLING & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a FileList from the drop event or file picker.
 *
 * Responsibilities (per file):
 *  1. Validate file size — skip and warn if > MAX_FILE_SIZE_BYTES.
 *  2. Validate file type — skip and warn if not PDF, JPG, or PNG.
 *  3. Dispatch to processPDF() or processImage() accordingly.
 *  4. On first call, reveal the workspace and hide the main drop zone.
 *
 * @param {FileList} files - Files from the input element or a drop event.
 * @returns {Promise<void>}
 */
async function handleFiles(files) {
    if (!files || files.length === 0) return;

    // Show the global loading overlay with a contextual status message.
    showLoader(true, 'Analyzing documents...');

    // Reveal the workspace and hide the primary drop zone on first file load.
    document.getElementById('workspace').style.display    = 'block';
    document.getElementById('dropZoneWrapper').classList.add('hidden');
    document.getElementById('addMoreStrip').style.display = 'flex';

    for (const file of files) {

        // ── Validation: File size limit ───────────────────────────────────────
        if (file.size > MAX_FILE_SIZE_BYTES) {
            window.showToast(
                `"${file.name}" exceeds the 30 MB limit and was skipped.`,
                true
            );
            continue;
        }

        // ── Validation: Supported formats — route to correct processor ────────
        if (file.type === 'application/pdf') {
            await safeProcess(file, processPDF);

        } else if (ALLOWED_IMAGE_TYPES.has(file.type)) {
            await safeProcess(file, processImage);

        } else {
            // Unsupported format — notify and skip.
            window.showToast(
                `"${file.name}" is not supported (PDF, JPG, or PNG only).`,
                true
            );
        }
    }

    showLoader(false);
}

/**
 * Wraps a file-processor function in try/catch so one corrupt or unsupported
 * file cannot abort processing of the entire batch.
 *
 * @param {File}     file      - The file to process.
 * @param {Function} processor - The async processor function to invoke.
 * @returns {Promise<void>}
 */
async function safeProcess(file, processor) {
    try {
        await processor(file);
    } catch (err) {
        console.error(`[Ultra PDF AI] Error processing "${file.name}":`, err);
        window.showToast(
            `Failed to process "${file.name}". The file may be corrupted.`,
            true
        );
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// CORE FILE PROCESSORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a PDF file, iterates every page, renders each to a canvas thumbnail,
 * and adds each page as an individual draggable card to the grid.
 *
 * How it works:
 *  1. Read the file's raw bytes into an ArrayBuffer.
 *  2. Load the ArrayBuffer into pdf-lib (for manipulation) and into pdf.js
 *     (for thumbnail rendering) as two independent library instances.
 *  3. For each page index, render a low-scale (0.4×) canvas via pdf.js and
 *     convert it to a JPEG data URL for the thumbnail src.
 *  4. Push a PageObject into state.pages and add its card to the grid.
 *
 * @param {File} file - A valid PDF file with type 'application/pdf'.
 * @returns {Promise<void>}
 */
async function processPDF(file) {
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF document via pdf-lib for later manipulation (copy/merge).
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, {
        // Tolerate minor structural errors common in real-world PDF files.
        ignoreEncryption: true
    });

    // Load a separate rendering instance via pdf.js for thumbnail generation.
    const pdfRenderer = await pdfjsLib.getDocument(
        { data: new Uint8Array(arrayBuffer) }
    ).promise;

    const pageCount = pdfDoc.getPageCount();

    for (let i = 0; i < pageCount; i++) {
        const pageId = generatePageId();

        // ── Render the page to a canvas at reduced scale for performance ──────
        // pdf.js uses a 1-based page index, so add 1 to the zero-based loop index.
        const rendererPage = await pdfRenderer.getPage(i + 1);
        const viewport     = rendererPage.getViewport({ scale: 0.4 });
        const canvas       = document.createElement('canvas');

        canvas.width  = viewport.width;
        canvas.height = viewport.height;

        await rendererPage.render({
            canvasContext : canvas.getContext('2d'),
            viewport      : viewport
        }).promise;

        // Build the page state object for this PDF page.
        const pageObj = {
            id         : pageId,
            type       : 'pdf',
            docRef     : pdfDoc,        // pdf-lib reference — used during merge.
            pageIndex  : i,             // Zero-based page index within docRef.
            imageBytes : null,
            imageType  : null,
            rotation   : 0,
            imgSrc     : canvas.toDataURL('image/jpeg', 0.8), // JPEG thumbnail.
            objectUrl  : null
        };

        state.pages.push(pageObj);
        addPageToGrid(pageObj);
    }
}

/**
 * Converts an image file (JPG or PNG) into a PageObject and adds it to the grid.
 *
 * A Blob object URL is created for the thumbnail src and registered in
 * objectUrlRegistry so it can be properly revoked when the page is removed.
 *
 * @param {File} file - A valid JPG or PNG image file.
 * @returns {Promise<void>}
 */
async function processImage(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pageId      = generatePageId();

    // Create a Blob URL for fast <img> rendering without encoding overhead.
    const blob      = new Blob([arrayBuffer], { type: file.type });
    const objectUrl = URL.createObjectURL(blob);

    // Register the URL so it can be revoked when this page card is removed.
    objectUrlRegistry.set(pageId, objectUrl);

    const pageObj = {
        id         : pageId,
        type       : 'image',
        docRef     : null,
        pageIndex  : null,
        imageBytes : arrayBuffer,   // Raw bytes needed by pdf-lib embedJpg/embedPng.
        imageType  : file.type,     // MIME type determines the embed method.
        rotation   : 0,
        imgSrc     : objectUrl,     // Blob URL used as the <img> thumbnail src.
        objectUrl  : objectUrl
    };

    state.pages.push(pageObj);
    addPageToGrid(pageObj);
}


// ─────────────────────────────────────────────────────────────────────────────
// BLANK PAGE INSERTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a blank A4 white page and appends it to the grid.
 *
 * Blank pages are useful for inserting visual dividers or section separators
 * between document chunks before the final merge. They render as A4-dimensioned
 * white pages in the output PDF (using A4_WIDTH_PT × A4_HEIGHT_PT constants).
 */
function addBlankPage() {
    const pageId  = generatePageId();

    const pageObj = {
        id         : pageId,
        type       : 'blank',
        docRef     : null,
        pageIndex  : null,
        imageBytes : null,
        imageType  : null,
        rotation   : 0,
        imgSrc     : null,      // No thumbnail — placeholder UI is used instead.
        objectUrl  : null
    };

    state.pages.push(pageObj);
    addPageToGrid(pageObj);

    // Notify the user that the blank page was successfully inserted.
    window.showToast('Blank A4 page added.');
}


// ─────────────────────────────────────────────────────────────────────────────
// UI RENDERING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates and appends a draggable thumbnail card to the #pdfGrid.
 *
 * Card anatomy:
 *  - .page-card         : Outer draggable container (styled in tools-template.css).
 *  - .thumb-wrapper     : Aspect-ratio box for the thumbnail or blank placeholder.
 *  - .page-overlay      : Semi-transparent hover overlay with action buttons.
 *  - .icon-btn.btn-rotate : Rotates the page 90° clockwise on click.
 *  - .icon-btn.btn-delete : Removes the page from the workspace.
 *  - .page-num          : Numeric position badge at the bottom of the card.
 *
 * @param {Object} pageObj - A page state object from state.pages.
 */
function addPageToGrid(pageObj) {
    const grid = document.getElementById('pdfGrid');
    const card = document.createElement('div');

    // Apply the blank-page modifier class for blank pages.
    card.className = 'page-card' + (pageObj.type === 'blank' ? ' blank-page' : '');
    card.id        = pageObj.id;
    card.setAttribute('role', 'listitem');

    // ── Build the thumbnail content based on the page type ──────────────────
    const thumbContent = pageObj.type === 'blank'
        // Blank page: show a centred file icon with a label.
        ? `<div class="blank-page-placeholder">
               <i class="fa-regular fa-file" aria-hidden="true"></i>
               <span>Blank Page</span>
           </div>`
        // PDF / Image page: show the rendered thumbnail.
        : `<img
               src="${pageObj.imgSrc}"
               alt="PDF page thumbnail"
               id="img-${pageObj.id}"
               loading="lazy">`;

    // ── Assemble the full card HTML ──────────────────────────────────────────
    card.innerHTML = `
        <div class="thumb-wrapper">
            ${thumbContent}
            <div class="page-overlay" aria-hidden="true">
                <button
                    class="icon-btn btn-rotate"
                    onclick="rotatePage('${pageObj.id}')"
                    title="Rotate 90° clockwise"
                    aria-label="Rotate page 90 degrees clockwise">
                    <i class="fa-solid fa-rotate-right"></i>
                </button>
                <button
                    class="icon-btn btn-delete"
                    onclick="deletePage('${pageObj.id}')"
                    title="Remove this page"
                    aria-label="Remove page from document">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="page-num" id="num-${pageObj.id}" aria-label="Page number"></div>
    `;

    grid.appendChild(card);

    // Refresh all page-number badges to account for the newly added card.
    updatePageNumbers();
}


// ─────────────────────────────────────────────────────────────────────────────
// PAGE ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rotates a page 90° clockwise, updating both the state object and the
 * visible CSS transform on the thumbnail image.
 *
 * Rotation is accumulated in 90° increments (modulo 360°) so the value
 * remains within [0, 90, 180, 270]. This accumulated value is applied to
 * the final PDF page during the merge step.
 *
 * @param {string} id - The unique page ID of the card to rotate.
 */
function rotatePage(id) {
    const pageObj = state.pages.find(p => p.id === id);
    if (!pageObj) return;

    // Accumulate 90° rotation, wrapping at 360° to avoid unbounded growth.
    pageObj.rotation = (pageObj.rotation + 90) % 360;

    // Apply the visual CSS transform to the thumbnail image immediately.
    const img = document.getElementById(`img-${id}`);
    if (img) {
        img.style.transform = `rotate(${pageObj.rotation}deg)`;
    }
}

/**
 * Removes a page from the workspace: DOM, state array, and Blob URL registry.
 *
 * Order of operations:
 *  1. Revoke the Blob URL (if any) to free memory before removing from state.
 *  2. Remove the card element from the DOM.
 *  3. Filter the page out of state.pages.
 *  4. Refresh all page-number badges.
 *
 * @param {string} id - The unique page ID of the card to delete.
 */
function deletePage(id) {
    // Step 1: Free any Blob URL held for this page to prevent memory leaks.
    revokePageObjectUrl(id);

    // Step 2: Remove the card element from the DOM.
    const card = document.getElementById(id);
    if (card) card.remove();

    // Step 3: Remove the corresponding entry from the state array.
    state.pages = state.pages.filter(p => p.id !== id);

    // Step 4: Update the position badges to reflect the new grid order.
    updatePageNumbers();
}

/**
 * Updates the numeric position badge (.page-num) on every card in the grid
 * to reflect the current visual (DOM) order.
 *
 * This function is called after every addition, deletion, or sort operation
 * to keep the displayed numbers in sync with the actual document order.
 */
function updatePageNumbers() {
    const cards = document.getElementById('pdfGrid').querySelectorAll('.page-card');
    cards.forEach((card, index) => {
        const badge = card.querySelector('.page-num');
        if (badge) badge.textContent = index + 1;
    });
}

/**
 * SortableJS onEnd callback — called after every drag-and-drop reorder.
 * Refreshes the page-number badges to match the new DOM sort order.
 */
function reindexPages() {
    updatePageNumbers();
}

/**
 * Resets the workspace to its initial empty state.
 *
 * Steps:
 *  1. Ask the user for confirmation via the native browser dialog.
 *  2. Revoke all tracked Blob URLs to release Blob memory.
 *  3. Reset the state object (pages array and page counter).
 *  4. Clear the DOM grid (#pdfGrid.innerHTML).
 *  5. Hide the workspace and the "Add More" strip.
 *  6. Re-show the primary drop zone.
 */
function clearWorkspace() {
    // Confirm before destructive action — uses native browser confirm dialog.
    if (!confirm('Are you sure you want to remove all pages?')) return;

    // Revoke every outstanding Blob URL before clearing the state array.
    for (const id of objectUrlRegistry.keys()) {
        revokePageObjectUrl(id);
    }

    // Reset in-memory state.
    state.pages       = [];
    state.pageCounter = 0;

    // Clear the rendered grid.
    document.getElementById('pdfGrid').innerHTML = '';

    // Restore the initial UI state.
    document.getElementById('workspace').style.display    = 'none';
    document.getElementById('addMoreStrip').style.display = 'none';
    document.getElementById('dropZoneWrapper').classList.remove('hidden');
}


// ─────────────────────────────────────────────────────────────────────────────
// MERGE & DOWNLOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the current DOM order of the page grid, assembles a new merged PDF
 * document using pdf-lib, and triggers a browser file download.
 *
 * Processing pipeline:
 *  1. Guard: abort if the workspace is empty.
 *  2. Create a new empty PDFDocument via pdf-lib.
 *  3. Apply optional metadata from the toolbar text inputs.
 *  4. Walk the grid DOM to determine the current page order (by card IDs).
 *  5. For each page, dispatch to the correct pdf-lib operation:
 *       - 'pdf'   → copyPages() from the source doc reference.
 *       - 'image' → embedJpg() / embedPng() and drawImage() on a new page.
 *       - 'blank' → addPage() with A4 dimensions.
 *  6. Apply any accumulated rotation to newly added pages.
 *  7. Serialize the document to bytes via mergedPdf.save().
 *  8. Create a Blob download URL, inject a temporary <a> tag, click it,
 *     and schedule URL revocation after 5 seconds.
 *  9. Show a success toast with the output file name.
 *
 * @returns {Promise<void>}
 */
async function mergeAndDownload() {
    // ── Guard: nothing to merge ───────────────────────────────────────────────
    if (state.pages.length === 0) {
        window.showToast('There are no pages to merge.', true);
        return;
    }

    showLoader(true, 'Merging document...');

    try {
        // ── Step 2: Create the output document ────────────────────────────────
        const mergedPdf = await PDFLib.PDFDocument.create();

        // ── Step 3: Apply optional document metadata ──────────────────────────
        const titleValue  = document.getElementById('metaTitle').value.trim();
        const authorValue = document.getElementById('metaAuthor').value.trim();

        mergedPdf.setTitle(titleValue   || 'Untitled Document');
        mergedPdf.setAuthor(authorValue || 'Ultra PDF AI');
        mergedPdf.setProducer('Ultra PDF AI — God Mode v2.0');
        mergedPdf.setCreationDate(new Date());

        // ── Step 4: Determine current DOM order ───────────────────────────────
        // Query the grid for .page-card elements in their current visual order.
        // The DOM order reflects any drag-and-drop reordering the user has done.
        const grid   = document.getElementById('pdfGrid');
        const domIds = Array.from(grid.querySelectorAll('.page-card')).map(c => c.id);

        // ── Step 5–6: Build the merged document page by page ─────────────────
        for (const id of domIds) {
            const pageData = state.pages.find(p => p.id === id);
            if (!pageData) continue;

            let newPage = null;

            if (pageData.type === 'pdf') {
                // Copy the specified page from the source pdf-lib document instance.
                const [copied] = await mergedPdf.copyPages(pageData.docRef, [pageData.pageIndex]);
                newPage        = copied;
                mergedPdf.addPage(newPage);

            } else if (pageData.type === 'image') {
                // Embed the image into the PDF using the format-appropriate method,
                // then create a new page sized to the image's natural dimensions.
                let embeddedImage;
                if (pageData.imageType === 'image/jpeg') {
                    embeddedImage = await mergedPdf.embedJpg(pageData.imageBytes);
                } else {
                    embeddedImage = await mergedPdf.embedPng(pageData.imageBytes);
                }

                const { width, height } = embeddedImage.scale(1);
                newPage = mergedPdf.addPage([width, height]);
                newPage.drawImage(embeddedImage, { x: 0, y: 0, width, height });

            } else if (pageData.type === 'blank') {
                // Add a standard A4 white page with no content.
                newPage = mergedPdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
            }

            // ── Step 6: Apply accumulated rotation ───────────────────────────
            if (newPage && pageData.rotation !== 0) {
                const currentAngle = newPage.getRotation().angle;
                newPage.setRotation(PDFLib.degrees(currentAngle + pageData.rotation));
            }
        }

        // ── Step 7: Serialize to bytes ────────────────────────────────────────
        const pdfBytes = await mergedPdf.save();

        // ── Step 8: Trigger browser file download ─────────────────────────────
        // Sanitize the user-supplied file name, stripping path-unsafe characters.
        const customName    = document.getElementById('outputFileName').value.trim();
        const sanitizedName = customName
            ? customName.replace(/[^a-zA-Z0-9_\-. ]/g, '_')
            : `Ultra_Merged_${Date.now()}`;
        const fileName = `${sanitizedName}.pdf`;

        // Create a Blob URL for the merged PDF bytes and trigger the download.
        const blob      = new Blob([pdfBytes], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor    = document.createElement('a');

        anchor.href      = objectUrl;
        anchor.download  = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // Revoke the temporary download URL after a safe delay to free memory.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);

        showLoader(false);

        // ── Step 9: Success notification ──────────────────────────────────────
        window.showToast(`"${fileName}" downloaded successfully!`);

    } catch (err) {
        console.error('[Ultra PDF AI] Merge failed:', err);
        showLoader(false);
        window.showToast(`Merge failed: ${err.message}`, true);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a unique page identifier by combining the current timestamp with
 * a monotonically increasing counter. This guarantees uniqueness even when
 * multiple files are processed within the same millisecond.
 *
 * @returns {string} A unique identifier string, e.g. "page-1715000000000-3".
 */
function generatePageId() {
    return `page-${Date.now()}-${state.pageCounter++}`;
}

/**
 * Revokes the Blob object URL registered for a given page ID, freeing the
 * associated Blob memory from the browser's internal URL store.
 * Removes the entry from the registry after revocation.
 *
 * @param {string} id - The page ID whose Blob URL should be revoked.
 */
function revokePageObjectUrl(id) {
    if (objectUrlRegistry.has(id)) {
        URL.revokeObjectURL(objectUrlRegistry.get(id));
        objectUrlRegistry.delete(id);
    }
}

/**
 * Shows or hides the full-screen loading overlay.
 *
 * The overlay (#loader) is a global component styled by global.css.
 * It blocks user interaction during async processing to prevent
 * concurrent merge or file-load operations.
 *
 * Note: The #loader has display:none as an inline style on page load to
 * prevent flash-of-loader on first render. We explicitly set style.display
 * here so the .active class transition works correctly alongside it.
 *
 * @param {boolean} show  - true to display the overlay, false to hide it.
 * @param {string}  [text] - Optional status text shown below the spinner.
 */
function showLoader(show, text = 'Processing...') {
    const loader     = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');

    if (show) {
        loader.style.display = 'flex';   // Override the initial display:none inline style.
        loader.classList.add('active');
        if (loaderText) loaderText.textContent = text;
    } else {
        loader.classList.remove('active');
        loader.style.display = 'none';   // Re-apply hidden state after dismissal.
    }
}
