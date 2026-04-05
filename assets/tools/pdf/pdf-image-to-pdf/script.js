/**
 * =============================================================================
 * IMAGE TO PDF STUDIO ULTRA — CORE APPLICATION ENGINE  v4.0
 * =============================================================================
 * Author      : MD KAWSAR / Trusted Tools Web
 * Description : Handles all client-side logic for converting JPG, PNG, and
 *               HEIC images into a downloadable PDF document using jsPDF.
 *
 * Architecture overview
 * ─────────────────────
 * 1. Library Check  — Validates jsPDF, CropperJS, and SortableJS on load.
 * 2. File Handling  — Processes FileList objects from drag-drop or <input>.
 * 3. Thumbnails     — Renders draggable .img-card elements into #imageGrid.
 * 4. Image Actions  — Rotate, remove, and reorder individual images.
 * 5. Image Editor   — CropperJS modal with B&W / Magic filters + watermark.
 * 6. PDF Generation — jsPDF pipeline with per-page rotation, sizing & margins.
 * 7. Utilities      — Canvas helpers, size estimator, loader, UI-state sync.
 *
 * Notification system
 * ────────────────────
 * All user-facing notifications use the GLOBAL toast system provided by
 * global.js.  Signature:
 *   window.showToast(message)              → standard / info  toast
 *   window.showToast(message, true)        → error toast
 *
 * No server communication: every operation runs entirely in the browser.
 * =============================================================================
 */

'use strict';

/* =============================================================================
   SECTION 1 — DOM ELEMENT REFERENCES
   A single `el` object holds every DOM handle needed by the application.
   Centralising references avoids repeated document.getElementById() calls
   and makes future refactoring straightforward.
============================================================================= */
const el = {
    dropZone          : document.getElementById('dropZone'),
    fileInput         : document.getElementById('fileInput'),
    imageGrid         : document.getElementById('imageGrid'),
    generateBtn       : document.getElementById('generateBtn'),
    clearBtn          : document.getElementById('clearBtn'),
    toolbar           : document.getElementById('toolbar'),
    guideText         : document.getElementById('guideText'),
    loader            : document.getElementById('loader'),
    loaderTitle       : document.getElementById('loaderTitle'),
    loaderSub         : document.getElementById('loaderSub'),
    pageSize          : document.getElementById('pageSize'),
    orientation       : document.getElementById('orientation'),
    margin            : document.getElementById('margin'),
    quality           : document.getElementById('quality'),
    qualityVal        : document.getElementById('qualityVal'),
    filenameArea      : document.getElementById('filenameArea'),
    pdfFilename       : document.getElementById('pdfFilename'),
    estSizeBadge      : document.getElementById('estSizeBadge'),
    editorModal       : document.getElementById('editorModal'),
    editorCloseBtn    : document.getElementById('editorCloseBtn'),
    editorImage       : document.getElementById('editorImage'),
    watermarkInput    : document.getElementById('watermarkText'),
    libErrorBanner    : document.getElementById('libErrorBanner'),
    // Editor tool buttons
    cropBtn           : document.getElementById('cropBtn'),
    filterResetBtn    : document.getElementById('filterResetBtn'),
    filterBwBtn       : document.getElementById('filterBwBtn'),
    filterMagicBtn    : document.getElementById('filterMagicBtn'),
    applyWatermarkBtn : document.getElementById('applyWatermarkBtn'),
    saveEditsBtn      : document.getElementById('saveEditsBtn'),
};

/* =============================================================================
   SECTION 2 — CONSTANTS
============================================================================= */

/** Maximum number of images allowed in a single batch to protect RAM. */
const MAX_BATCH_SIZE = 50;

/**
 * Maximum canvas dimension (px) used when encoding images for PDF.
 * Prevents memory crashes on low-end mobile devices with large photos.
 */
const MAX_CANVAS_DIM = 4096;

/* =============================================================================
   SECTION 3 — APPLICATION STATE
============================================================================= */

/**
 * @type {Array<{
 *   id: string,
 *   src: string,
 *   originalSrc: string,
 *   rotation: number,
 *   width: number,
 *   height: number,
 *   sizeMB: number
 * }>}
 * Ordered list of image objects managed by the application.
 * The array order directly maps to PDF page order.
 */
let imagesData = [];

/**
 * @type {string|null}
 * The `id` of the image currently open in the editor modal, or null when
 * the editor is closed.
 */
let currentEditId = null;

/**
 * @type {Cropper|null}
 * Active CropperJS instance attached to #editorImage, or null when the
 * crop tool is not in use.
 */
let cropper = null;

/* =============================================================================
   SECTION 4 — LIBRARY AVAILABILITY CHECK
   Runs immediately on script load. If a critical dependency failed to load
   (e.g. due to a blocked CDN), the error banner (#libErrorBanner) is shown
   and the missing library is logged to the console.
============================================================================= */

(function checkLibraries() {
    const missingLibs = [];

    if (typeof window.jspdf === 'undefined') {
        missingLibs.push('jsPDF (PDF engine)');
    }
    if (typeof window.Cropper === 'undefined') {
        missingLibs.push('Cropper.js (Image editor)');
    }
    if (typeof window.Sortable === 'undefined') {
        missingLibs.push('SortableJS (Drag & drop ordering)');
    }

    if (missingLibs.length > 0) {
        // Show the HTML error banner element (becomes visible via .is-visible)
        el.libErrorBanner.classList.add('is-visible');
        console.error('[ImageToPDF] Missing libraries:', missingLibs.join(', '));
    }
})();

/* =============================================================================
   SECTION 5 — CUSTOM CONFIRM DIALOG
   Provides a branded Promise-based replacement for window.confirm().
   The overlay (#confirm-overlay) is shown by adding .is-open and hidden
   on Cancel or Confirm click.
============================================================================= */

/**
 * Displays the custom confirm dialog and resolves when the user responds.
 *
 * @param {string} title   - Headline displayed in the dialog.
 * @param {string} message - Body text describing the action.
 * @returns {Promise<boolean>} Resolves to `true` (confirmed) or `false` (cancelled).
 */
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay   = document.getElementById('confirm-overlay');
        const titleEl   = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const okBtn     = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        // Populate dialog content dynamically
        titleEl.textContent   = title;
        messageEl.textContent = message;
        overlay.classList.add('is-open');

        /**
         * Removes the dialog, detaches event listeners, and resolves the
         * Promise with the user's boolean choice.
         * @param {boolean} result
         */
        const cleanup = (result) => {
            overlay.classList.remove('is-open');
            okBtn.removeEventListener('click',     onOk);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onOk     = () => cleanup(true);
        const onCancel = () => cleanup(false);

        // Use { once: true } as a safety net, though cleanup also removes them
        okBtn.addEventListener('click',     onOk,     { once: true });
        cancelBtn.addEventListener('click', onCancel, { once: true });
    });
}

/* =============================================================================
   SECTION 6 — QUALITY SLIDER
   Updates the live percentage label and re-calculates the estimated PDF
   size every time the user moves the range slider.
============================================================================= */

/**
 * Listens for changes on the quality range input (#quality).
 * Updates the display label and triggers an estimated size recalculation.
 */
el.quality.addEventListener('input', (e) => {
    // Convert the float value (0.1–1.0) to an integer percentage (10–100)
    const val = Math.round(parseFloat(e.target.value) * 100);
    el.qualityVal.textContent = `${val}%`;
    updateEstimatedSize();
});

/* =============================================================================
   SECTION 7 — DRAG & DROP AND FILE INPUT EVENT LISTENERS
   Handles all file-entry pathways: click-to-browse, keyboard activation,
   drag-enter highlight, and the actual drop event.
============================================================================= */

/**
 * Click on the drop zone triggers the hidden <input type="file"> picker.
 */
el.dropZone.addEventListener('click', () => el.fileInput.click());

/**
 * Keyboard accessibility: pressing Enter or Space on the focusable drop zone
 * opens the native file picker, matching button behaviour for screen-reader users.
 */
el.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.fileInput.click();
    }
});

/**
 * Add the .dragover highlight class while a dragged file is over the zone.
 * preventDefault() is required to allow the drop event to fire.
 */
['dragenter', 'dragover'].forEach(eventName => {
    el.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropZone.classList.add('dragover');
    });
});

/**
 * Remove the .dragover highlight class when the drag leaves or after a drop.
 */
['dragleave', 'drop'].forEach(eventName => {
    el.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropZone.classList.remove('dragover');
    });
});

// Route dropped files and picker-selected files to the same handler
el.dropZone.addEventListener('drop',   (e) => handleFiles(e.dataTransfer.files));
el.fileInput.addEventListener('change',(e) => handleFiles(e.target.files));

/* =============================================================================
   SECTION 8 — FILE PROCESSING ENGINE
   Iterates a FileList, converts HEIC files on the fly, creates object URLs
   for each image, and appends them to imagesData / the grid.
============================================================================= */

/**
 * Processes a FileList from a drag-drop event or the native file picker.
 * Enforces the MAX_BATCH_SIZE limit, handles HEIC → JPEG conversion, filters
 * non-image files, and calls renderThumbnail() for every valid image.
 *
 * @param {FileList} fileList - Raw FileList from a drop or <input> change event.
 * @returns {Promise<void>}
 */
async function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    let files = Array.from(fileList);

    // Warn if the user exceeded the batch limit and silently truncate the array
    if (files.length > MAX_BATCH_SIZE) {
        window.showToast(
            `Batch limit: only the first ${MAX_BATCH_SIZE} of ${files.length} images will be processed.`,
            false
        );
        files = files.slice(0, MAX_BATCH_SIZE);
    }

    // Reset the native input so the same file can be re-selected later if needed
    el.fileInput.value = '';

    showLoader('Importing Images...', '');

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        updateLoaderSub(`Processing ${i + 1} of ${files.length}`);

        // Yield to the browser's main thread so the UI stays responsive
        await yieldToMain();

        try {
            let processedBlob = file;

            const isHeic = file.name.toLowerCase().endsWith('.heic') ||
                           file.type.includes('heic');

            if (isHeic) {
                /*
                 * HEIC images (captured by iPhones) are not natively supported
                 * by most browsers. heic2any converts them to standard JPEG blobs
                 * before we create the object URL.
                 */
                if (window.heic2any) {
                    try {
                        const converted = await heic2any({
                            blob    : file,
                            toType  : 'image/jpeg',
                            quality : 0.85
                        });
                        processedBlob = Array.isArray(converted) ? converted[0] : converted;
                    } catch (heicErr) {
                        console.error('[ImageToPDF] HEIC conversion failed:', heicErr);
                        window.showToast(`Could not convert "${file.name}". The file may be corrupted.`, true);
                        continue;
                    }
                } else {
                    // Library not loaded — skip and warn the user
                    console.warn('[ImageToPDF] heic2any not loaded. HEIC file skipped.');
                    window.showToast('HEIC conversion library failed to load. Please refresh and try again.', true);
                    continue;
                }
            } else if (!file.type.startsWith('image/')) {
                // Silently skip files that are not images (e.g. PDFs dropped by mistake)
                continue;
            }

            // Create a memory-efficient object URL for the processed blob
            const blobUrl = URL.createObjectURL(processedBlob);
            const sizeMB  = processedBlob.size / (1024 * 1024);
            const dims    = await getImageDimensions(blobUrl);

            /**
             * Image state object stored in imagesData.
             * originalSrc is kept as a reference so the Reset filter can
             * restore the unedited version.
             */
            const imgObj = {
                id          : `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                src         : blobUrl,
                originalSrc : blobUrl,
                rotation    : 0,
                width       : dims.width,
                height      : dims.height,
                sizeMB      : sizeMB,
            };

            imagesData.push(imgObj);
            renderThumbnail(imgObj);

        } catch (err) {
            console.error('[ImageToPDF] Unexpected error processing file:', file.name, err);
        }
    }

    // Sync UI state (toolbar, buttons, guide text) based on whether we have images
    updateUIState(imagesData.length > 0);
    updateEstimatedSize();
    hideLoader();
}

/**
 * Returns the pixel dimensions of the image at the given URL.
 * Used immediately after creating an object URL to store width/height in state.
 *
 * @param {string} url - Object URL or data URL.
 * @returns {Promise<{width: number, height: number}>}
 */
function getImageDimensions(url) {
    return new Promise((resolve, reject) => {
        const img    = new Image();
        img.onload   = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror  = () => reject(new Error(`[ImageToPDF] Failed to load image dimensions: ${url}`));
        img.src      = url;
    });
}

/* =============================================================================
   SECTION 9 — THUMBNAIL RENDERING
   Creates a draggable .img-card DOM node for each image and appends it to
   #imageGrid. Card action buttons use data-action / data-id attributes so
   a single delegated listener on the grid handles all interactions.
============================================================================= */

/**
 * Creates and appends a thumbnail card for the given image object to #imageGrid.
 * The card structure contains:
 *   - A preview <img> (id="thumb-{id}" targeted by rotation/edit logic)
 *   - .card-actions overlay with edit / rotate / remove icon buttons
 *   - .page-num badge updated by updatePageNumbers()
 *
 * @param {{id: string, src: string}} imgObj - Image state object from imagesData.
 */
function renderThumbnail(imgObj) {
    const div      = document.createElement('div');
    div.className  = 'img-card';
    div.setAttribute('data-id', imgObj.id);
    // SortableJS manages dragging; disable native drag to avoid browser conflicts
    div.setAttribute('draggable', 'false');

    div.innerHTML = `
        <img src="${escapeHtml(imgObj.src)}" alt="Page preview" id="thumb-${imgObj.id}">
        <div class="card-actions">
            <button
                class="action-btn"
                data-action="edit"
                data-id="${imgObj.id}"
                aria-label="Open editor for this image"
                title="Edit image"
            >
                <i class="fa-solid fa-pen" aria-hidden="true"></i>
            </button>
            <button
                class="action-btn btn-rotate"
                data-action="rotate"
                data-id="${imgObj.id}"
                aria-label="Rotate image 90 degrees clockwise"
                title="Rotate 90°"
            >
                <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
            </button>
            <button
                class="action-btn btn-remove"
                data-action="remove"
                data-id="${imgObj.id}"
                aria-label="Remove this image from the list"
                title="Remove image"
            >
                <i class="fa-solid fa-times" aria-hidden="true"></i>
            </button>
        </div>
        <div class="page-num" aria-hidden="true"></div>
    `;

    el.imageGrid.appendChild(div);
    // Renumber all page badges so the new card shows the correct page number
    updatePageNumbers();
}

/**
 * Escapes a string so it can be safely embedded in an HTML attribute value.
 * Prevents XSS from maliciously crafted filenames or object URLs.
 *
 * @param {string} str - Raw string to escape.
 * @returns {string} HTML-entity-encoded string.
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Delegated click handler on #imageGrid.
 * Routes button clicks to the appropriate action (edit / rotate / remove)
 * based on data-action and data-id attributes. Using event delegation avoids
 * attaching separate listeners to every dynamically created card.
 */
el.imageGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (action === 'edit')   openEditor(id);
    if (action === 'rotate') rotateImage(id);
    if (action === 'remove') removeImage(id);
});

/* =============================================================================
   SECTION 10 — IMAGE INTERACTIONS  (rotate / remove / clear all)
============================================================================= */

/**
 * Rotates an image 90° clockwise in-memory and updates its thumbnail preview.
 * The rotation is stored in state; the actual canvas rotation is applied later
 * by getRotatedImageData() during PDF generation.
 *
 * For 90° and 270° orientations the thumbnail uses object-fit:contain and
 * scale(0.7) to prevent overflow within the fixed-size square card.
 *
 * @param {string} id - Unique image state ID.
 */
function rotateImage(id) {
    const imgObj = imagesData.find(i => i.id === id);
    if (!imgObj) return;

    imgObj.rotation = (imgObj.rotation + 90) % 360;
    const thumbEl   = document.getElementById(`thumb-${id}`);

    if (imgObj.rotation % 180 !== 0) {
        // 90° or 270°: use contain + scale down to prevent card overflow
        thumbEl.style.transform = `rotate(${imgObj.rotation}deg) scale(0.7)`;
        thumbEl.style.objectFit = 'contain';
    } else {
        // 0° or 180°: standard cover fill, no special scaling needed
        thumbEl.style.transform = `rotate(${imgObj.rotation}deg)`;
        thumbEl.style.objectFit = 'cover';
    }
}

/**
 * Removes a single image from both the imagesData array and the DOM.
 * Revokes its object URL(s) to free browser memory.
 *
 * @param {string} id - Unique image state ID.
 */
function removeImage(id) {
    const index = imagesData.findIndex(i => i.id === id);
    if (index === -1) return;

    // Free memory by revoking all object URLs held by this image
    revokeImageUrls(imagesData[index]);
    imagesData.splice(index, 1);

    // Remove the corresponding .img-card from the DOM
    const card = el.imageGrid.querySelector(`[data-id="${id}"]`);
    if (card) card.remove();

    updatePageNumbers();
    updateEstimatedSize();

    // If no images remain, reset the toolbar and action buttons
    if (imagesData.length === 0) updateUIState(false);
}

/**
 * Prompts the user with the custom confirm dialog and clears all images if
 * the user confirms. Revokes all object URLs to avoid memory leaks.
 *
 * @returns {Promise<void>}
 */
async function clearAll() {
    const confirmed = await showConfirm(
        'Clear All Images',
        'This will remove all uploaded images. This action cannot be undone.'
    );
    if (!confirmed) return;

    // Release all object URLs before clearing the array
    imagesData.forEach(revokeImageUrls);
    imagesData = [];
    el.imageGrid.innerHTML = '';

    updateUIState(false);
    window.showToast('All images have been removed.');
}

/**
 * Safely revokes the object URL(s) held by an image state object.
 * Called before deleting an item from imagesData to prevent memory leaks.
 *
 * @param {{src: string, originalSrc: string}} img - Image state object.
 */
function revokeImageUrls(img) {
    if (img.src         && img.src.startsWith('blob:'))         URL.revokeObjectURL(img.src);
    if (img.originalSrc && img.originalSrc !== img.src &&
        img.originalSrc.startsWith('blob:'))                    URL.revokeObjectURL(img.originalSrc);
}

// Bind top-level action buttons to their handlers
el.clearBtn.addEventListener('click',    clearAll);
el.generateBtn.addEventListener('click', generatePDF);

/* =============================================================================
   SECTION 11 — SORTABLE DRAG & DROP (reordering)
   SortableJS enables drag-to-reorder on the #imageGrid.
   After each reorder the imagesData array is rebuilt to match the new DOM order
   so PDF page sequence stays in sync with the visual grid.
============================================================================= */

if (typeof Sortable !== 'undefined') {
    new Sortable(el.imageGrid, {
        animation        : 150,          // Smooth ghost animation (ms)
        ghostClass       : 'sortable-ghost',
        delay            : 100,          // Short delay prevents accidental drags
        delayOnTouchOnly : true,         // Delay only on touch devices

        /**
         * Called by SortableJS after each drag-and-drop reorder completes.
         * Rebuilds imagesData to match the new DOM card order so the PDF
         * page sequence is always consistent with the visual grid.
         */
        onEnd() {
            const newOrder = [];
            el.imageGrid.querySelectorAll('.img-card').forEach(card => {
                const id   = card.getAttribute('data-id');
                const item = imagesData.find(i => i.id === id);
                if (item) newOrder.push(item);
            });
            imagesData = newOrder;
            updatePageNumbers();
        },
    });
}

/* =============================================================================
   SECTION 12 — IMAGE EDITOR MODAL
   The editor modal hosts a CropperJS canvas plus B&W, Magic, and Reset
   pixel filters, and a diagonal-text watermark tool.
============================================================================= */

/**
 * Opens the editor modal for the image identified by `id`.
 * Loads the image source into #editorImage and activates the .modal-overlay.
 *
 * @param {string} id - Image state ID to edit.
 */
function openEditor(id) {
    if (typeof Cropper === 'undefined') {
        window.showToast('Image editor library failed to load. Please refresh.', true);
        return;
    }

    currentEditId           = id;
    const imgObj            = imagesData.find(i => i.id === id);
    if (!imgObj) return;

    el.editorImage.src      = imgObj.src;
    el.watermarkInput.value = '';

    // Destroy any lingering CropperJS instance before re-opening
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    el.editorModal.classList.add('is-open');
}

/**
 * Closes the editor modal and cleans up the active CropperJS instance
 * if one was created but not committed.
 */
function closeEditor() {
    el.editorModal.classList.remove('is-open');
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

/**
 * Activates CropperJS on the editor image.
 * Does nothing if CropperJS is already active (guards against double-init).
 */
function enableCrop() {
    if (cropper) return; // Already active — no double initialisation
    cropper = new Cropper(el.editorImage, {
        viewMode     : 1,     // Restrict crop box to canvas boundaries
        autoCropArea : 0.8,   // Default crop area covers 80% of the image
        dragMode     : 'move',
    });
}

/**
 * Applies a pixel-level filter to the current editor image via an off-screen
 * canvas and replaces #editorImage.src with the processed data URL.
 *
 * Supported filter types:
 *   'bw'       — Greyscale conversion using per-pixel luminance averaging.
 *   'magic'    — Contrast + brightness + saturation boost ideal for scans.
 *   'original' — Restores the unmodified original blob URL from imagesData.
 *
 * @param {'bw'|'magic'|'original'} type - Filter to apply.
 */
function applyFilter(type) {
    // Prevent filter application while the crop tool is active
    if (cropper) {
        window.showToast('Please save or cancel your crop before applying a filter.');
        return;
    }

    if (type === 'original') {
        // Restore the original blob URL stored at load time
        const imgObj = imagesData.find(i => i.id === currentEditId);
        if (imgObj) el.editorImage.src = imgObj.originalSrc;
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const img    = new Image();

    img.onload = () => {
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        if (type === 'bw') {
            /*
             * Greyscale: iterate every pixel, replace R/G/B with the
             * average (luminance) value to produce a true greyscale image.
             */
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data      = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const avg   = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i]     = avg; // Red
                data[i + 1] = avg; // Green
                data[i + 2] = avg; // Blue
                // Alpha (data[i+3]) is unchanged
            }

            ctx.putImageData(imageData, 0, 0);

        } else if (type === 'magic') {
            /*
             * "Magic" filter: boost contrast (1.3×), brightness (1.1×), and
             * saturation (1.1×) via ctx.filter, then apply a subtle white
             * overlay using the 'overlay' composite mode to lift shadows —
             * ideal for improving scanned document readability.
             */
            ctx.filter = 'contrast(1.3) brightness(1.1) saturate(1.1)';
            ctx.drawImage(img, 0, 0);
            ctx.filter = 'none';

            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
        }

        el.editorImage.src = canvas.toDataURL('image/jpeg', 0.92);
    };

    img.onerror = () => {
        window.showToast('Could not apply filter. The image failed to load into the canvas.', true);
    };

    img.src = el.editorImage.src;
}

/**
 * Draws a diagonal red semi-transparent text watermark over the current editor
 * image and replaces #editorImage.src with the result.
 *
 * The font size scales with the image width (image_width / 15, min 30px) so
 * the watermark is proportionate across all image sizes.
 */
function applyWatermark() {
    const text = el.watermarkInput.value.trim();
    if (!text) {
        window.showToast('Please enter watermark text before applying.');
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const img    = new Image();

    img.onload = () => {
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        // Scale font size relative to image width (min 30px prevents tiny text)
        const fontSize       = Math.max(30, canvas.width / 15);
        ctx.font             = `bold ${fontSize}px Arial`;
        ctx.fillStyle        = 'rgba(255, 59, 48, 0.5)';
        ctx.textAlign        = 'center';
        ctx.textBaseline     = 'middle';

        // Draw the watermark diagonally across the centre of the image
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-45 * Math.PI / 180);
        ctx.fillText(text, 0, 0);
        ctx.restore();

        el.editorImage.src = canvas.toDataURL('image/jpeg', 0.92);
    };

    img.onerror = () => {
        window.showToast('Could not apply watermark. The image failed to load.', true);
    };

    img.src = el.editorImage.src;
}

/**
 * Commits the editor state (crop or filtered image) back to imagesData and
 * updates the corresponding thumbnail in #imageGrid.
 *
 * If CropperJS is active: the cropped canvas is used as the final data URL.
 * Otherwise: the raw #editorImage.src (which may have a filter applied) is used.
 *
 * The data URL is converted to a Blob and a new object URL is created to
 * replace the old src — this is more memory-efficient than storing the full
 * base64 string in state.
 */
function saveEdits() {
    let finalDataUrl;

    if (cropper) {
        // Get the cropped region from CropperJS as a JPEG data URL at 92% quality
        finalDataUrl = cropper.getCroppedCanvas().toDataURL('image/jpeg', 0.92);
        cropper.destroy();
        cropper = null;
    } else {
        // Use the current #editorImage.src (may have a filter or watermark applied)
        finalDataUrl = el.editorImage.src;
    }

    const imgObj = imagesData.find(i => i.id === currentEditId);
    if (!imgObj) {
        closeEditor();
        return;
    }

    /*
     * Revoke the previous edited blob URL only if it differs from the original
     * to avoid releasing the original source before it is no longer needed.
     */
    if (imgObj.src !== imgObj.originalSrc && imgObj.src.startsWith('blob:')) {
        URL.revokeObjectURL(imgObj.src);
    }

    // Convert the data URL to a Blob for memory efficiency, then create a new URL
    const blob   = dataURLtoBlob(finalDataUrl);
    const newUrl = URL.createObjectURL(blob);

    imgObj.src      = newUrl;
    imgObj.rotation = 0; // A hard pixel edit resets any pending in-memory rotation

    // Update the thumbnail <img> in the grid to reflect the saved edit
    const thumbEl = document.getElementById(`thumb-${currentEditId}`);
    if (thumbEl) {
        thumbEl.src             = newUrl;
        thumbEl.style.transform = '';
        thumbEl.style.objectFit = 'cover';
    }

    /*
     * Asynchronously refresh stored dimensions because a crop changes
     * the image's width and height (needed for accurate PDF sizing).
     */
    const dimImg   = new Image();
    dimImg.onload  = () => {
        imgObj.width  = dimImg.naturalWidth;
        imgObj.height = dimImg.naturalHeight;
    };
    dimImg.src = newUrl;

    closeEditor();
    window.showToast('Your edits have been saved to the image.');
}

/* Wire up all editor modal button interactions */
el.editorCloseBtn.addEventListener('click',    closeEditor);
el.cropBtn.addEventListener('click',           enableCrop);
el.filterResetBtn.addEventListener('click',    () => applyFilter('original'));
el.filterBwBtn.addEventListener('click',       () => applyFilter('bw'));
el.filterMagicBtn.addEventListener('click',    () => applyFilter('magic'));
el.applyWatermarkBtn.addEventListener('click', applyWatermark);
el.saveEditsBtn.addEventListener('click',      saveEdits);

/**
 * Clicking the modal backdrop (outside .itp-modal-content) closes the editor.
 * The check `e.target === el.editorModal` ensures clicks inside the panel
 * do not accidentally trigger a close.
 */
el.editorModal.addEventListener('click', (e) => {
    if (e.target === el.editorModal) closeEditor();
});

/* =============================================================================
   SECTION 13 — PDF GENERATION ENGINE
   The main pipeline: iterates imagesData, applies canvas-based rotation,
   and builds a multi-page PDF using jsPDF with the user's chosen settings.
============================================================================= */

/**
 * Generates a PDF from all images in imagesData and triggers a browser
 * download of the resulting file.
 *
 * Supports three page-sizing modes:
 *   'a4'     — Standard ISO A4 page; image is scaled and centred with margin.
 *   'letter' — US Letter page; same layout as A4.
 *   'fit'    — Each page is resized dynamically to match the image dimensions.
 *
 * jsPDF creates a blank first page by default; this is deleted after the first
 * real content page is added to avoid a spurious empty page at the start.
 *
 * @returns {Promise<void>}
 */
async function generatePDF() {
    if (imagesData.length === 0) return;

    if (typeof window.jspdf === 'undefined') {
        window.showToast('PDF engine failed to load. Please refresh and try again.', true);
        return;
    }

    el.generateBtn.disabled = true;
    showLoader('Initialising PDF Engine...', '');
    await yieldToMain();

    try {
        const { jsPDF } = window.jspdf;

        // Capture current settings from the toolbar controls
        const settings = {
            size    : el.pageSize.value,
            orient  : el.orientation.value,
            margin  : el.margin.value,
            quality : parseFloat(el.quality.value),
        };

        /*
         * Initialise the jsPDF document.
         * For 'fit' mode we still start with A4; individual page dimensions
         * are overridden per-page using doc.addPage([w, h], orientation).
         */
        const doc = new jsPDF({
            orientation : settings.orient,
            unit        : 'mm',
            format      : settings.size === 'fit' ? 'a4' : settings.size,
            compress    : true,
        });

        let firstPageAdded = false;

        for (let i = 0; i < imagesData.length; i++) {
            updateLoaderTitle(`Building PDF — Page ${i + 1} of ${imagesData.length}`);
            updateLoaderSub('Encoding image data...');
            await yieldToMain();

            const imgObj = imagesData[i];

            try {
                /*
                 * Render the image (with stored rotation) onto an off-screen
                 * canvas and return the result as a JPEG data URL.
                 */
                const processed = await getRotatedImageData(imgObj, settings.quality);
                const imgProps  = doc.getImageProperties(processed.data);

                if (settings.size === 'fit') {
                    /*
                     * Fit-to-Image mode: create a page whose dimensions exactly
                     * match the image dimensions. Orientation is inferred from
                     * whether the image is taller than it is wide.
                     */
                    const isPortrait = imgProps.height >= imgProps.width;
                    doc.addPage([imgProps.width, imgProps.height], isPortrait ? 'p' : 'l');
                    doc.addImage(processed.data, 'JPEG', 0, 0, imgProps.width, imgProps.height);
                } else {
                    /*
                     * Fixed page size (A4 / Letter): add a new page, calculate
                     * the scaled image dimensions to fit within the work area
                     * (page minus margins), and centre the image on the page.
                     */
                    doc.addPage(settings.size, settings.orient);

                    const pageW  = doc.internal.pageSize.getWidth();
                    const pageH  = doc.internal.pageSize.getHeight();
                    const margin = settings.margin === 'small' ? 10
                                 : settings.margin === 'big'   ? 20
                                 : 0;
                    const workW  = pageW - margin * 2;
                    const workH  = pageH - margin * 2;

                    // Proportional scale to fit inside the work area
                    const scale  = Math.min(workW / imgProps.width, workH / imgProps.height);
                    const finalW = imgProps.width  * scale;
                    const finalH = imgProps.height * scale;

                    // Centre the image both horizontally and vertically on the page
                    const x = (pageW - finalW) / 2;
                    const y = (pageH - finalH) / 2;

                    doc.addImage(processed.data, 'JPEG', x, y, finalW, finalH, undefined, 'FAST');
                }

                /*
                 * BUG FIX: Delete jsPDF's default blank first page ONLY after
                 * the first real content page has been successfully added.
                 * Deleting before adding would crash some jsPDF versions.
                 */
                if (!firstPageAdded) {
                    doc.deletePage(1);
                    firstPageAdded = true;
                }

            } catch (pageErr) {
                /*
                 * A single-page error should not abort the entire batch.
                 * Log and continue to the next image.
                 */
                console.error(`[ImageToPDF] Failed to process page ${i + 1}:`, pageErr);
            }
        }

        // If no page was successfully added, abort with an error toast
        if (!firstPageAdded) {
            hideLoader();
            el.generateBtn.disabled = false;
            window.showToast('No valid images could be processed. Check your files and try again.', true);
            return;
        }

        updateLoaderTitle('Saving PDF...');
        updateLoaderSub('');

        /*
         * Sanitise the filename: strip everything except alphanumerics,
         * hyphens, and underscores to ensure a valid, cross-OS filename.
         */
        const rawName = el.pdfFilename.value.trim().replace(/[^a-zA-Z0-9\-_]/g, '') || 'My_Document';
        doc.save(`${rawName}.pdf`);

        window.showToast(`"${rawName}.pdf" has been saved to your downloads folder.`);

    } catch (err) {
        console.error('[ImageToPDF] PDF generation error:', err);
        window.showToast('PDF generation failed. Try with fewer images or a lower quality setting.', true);
    } finally {
        hideLoader();
        el.generateBtn.disabled = false;
    }
}

/* =============================================================================
   SECTION 14 — CANVAS ROTATION HELPER
   Renders an image onto an off-screen canvas with its stored rotation applied,
   then returns the result as a JPEG data URL. Used by generatePDF().
============================================================================= */

/**
 * Draws the image described by `imgObj` into an off-screen canvas respecting
 * its stored `rotation` value, then returns the canvas content as a JPEG data URL.
 *
 * Key implementation notes:
 * - For 90°/270° rotations the canvas width and height are SWAPPED so that
 *   the rotated image fills the canvas without black bars.
 * - The image is always drawn centred at the canvas origin using its ORIGINAL
 *   natural dimensions — this prevents distortion when canvas dimensions differ
 *   from the image dimensions after a swap.
 * - Large images are downscaled to MAX_CANVAS_DIM to prevent out-of-memory
 *   crashes on mobile devices.
 *
 * @param {{src: string, rotation: number}} imgObj - Image state object.
 * @param {number} quality - JPEG encode quality 0.1–1.0.
 * @returns {Promise<{data: string}>} Resolves with the JPEG data URL.
 */
function getRotatedImageData(imgObj, quality) {
    return new Promise((resolve, reject) => {
        const img  = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx    = canvas.getContext('2d');
            const rot    = imgObj.rotation;

            /*
             * Swap canvas dimensions for 90° and 270° rotations so the
             * rotated image naturally fills the canvas without any whitespace.
             */
            if (rot % 180 !== 0) {
                canvas.width  = img.naturalHeight;
                canvas.height = img.naturalWidth;
            } else {
                canvas.width  = img.naturalWidth;
                canvas.height = img.naturalHeight;
            }

            /*
             * Downscale oversized images to protect mobile device RAM.
             * The aspect ratio is preserved by scaling with the smaller ratio.
             */
            if (canvas.width > MAX_CANVAS_DIM || canvas.height > MAX_CANVAS_DIM) {
                const ratio   = Math.min(MAX_CANVAS_DIM / canvas.width, MAX_CANVAS_DIM / canvas.height);
                canvas.width  = Math.round(canvas.width  * ratio);
                canvas.height = Math.round(canvas.height * ratio);
            }

            // Translate origin to canvas centre, then rotate the drawing context
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rot * Math.PI / 180);

            /*
             * BUG FIX: Always draw using the ORIGINAL image dimensions
             * (naturalWidth × naturalHeight) centred at the origin, regardless
             * of the (possibly swapped) canvas dimensions. This is the key fix
             * that prevents aspect-ratio distortion on 90°/270° rotations.
             */
            ctx.drawImage(
                img,
                -img.naturalWidth  / 2,
                -img.naturalHeight / 2,
                img.naturalWidth,
                img.naturalHeight
            );

            resolve({ data: canvas.toDataURL('image/jpeg', quality) });
        };

        img.onerror = () => reject(
            new Error(`[ImageToPDF] Failed to load image for rotation: ${imgObj.src}`)
        );

        img.src = imgObj.src;
    });
}

/* =============================================================================
   SECTION 15 — UTILITY HELPERS
============================================================================= */

/**
 * Converts a base64 data URL to a Blob object.
 * Storing edits as Blob object URLs is significantly more memory-efficient
 * than keeping the full base64 string in the imagesData array.
 *
 * @param {string} dataurl - The data URL to convert (e.g. "data:image/jpeg;base64,...").
 * @returns {Blob}
 */
function dataURLtoBlob(dataurl) {
    const parts = dataurl.split(',');
    const mime  = parts[0].match(/:(.*?);/)[1];
    const bstr  = atob(parts[1]);
    const n     = bstr.length;
    const u8arr = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
    }

    return new Blob([u8arr], { type: mime });
}

/**
 * Yields control back to the browser's main thread by scheduling a
 * zero-delay macrotask via setTimeout.
 *
 * Inserting `await yieldToMain()` inside long processing loops allows the
 * browser to repaint the loading overlay and process UI events, preventing
 * the page from appearing frozen during heavy PDF builds.
 *
 * @returns {Promise<void>}
 */
function yieldToMain() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Re-numbers the "Page N" badge on every thumbnail card in #imageGrid
 * to reflect the current visual (and PDF page) order.
 * Called after any operation that adds, removes, or reorders cards.
 */
function updatePageNumbers() {
    el.imageGrid.querySelectorAll('.img-card').forEach((card, idx) => {
        card.querySelector('.page-num').textContent = `Page ${idx + 1}`;
    });
}

/**
 * Calculates and displays an estimated PDF output size in the toolbar badge.
 * Uses a heuristic: JPEG inside PDF is ~35% of the raw image size at quality 1.0.
 * This gives the user a rough file-size preview before generating the PDF.
 */
function updateEstimatedSize() {
    const quality = parseFloat(el.quality.value);
    let totalMB   = 0;

    imagesData.forEach(img => { totalMB += img.sizeMB || 0.5; });

    const estimated = (totalMB * quality * 0.35).toFixed(2);
    el.estSizeBadge.textContent = `Est: ~${estimated} MB`;
}

/**
 * Synchronises the toolbar, guide text, filename input, and action button
 * states based on whether any images are currently loaded.
 *
 * @param {boolean} hasImages - Pass `true` when imagesData has at least one entry.
 */
function updateUIState(hasImages) {
    if (hasImages) {
        el.toolbar.classList.add('is-active');
        el.guideText.classList.add('is-visible');
        el.filenameArea.style.display = 'block';
        el.generateBtn.disabled       = false;
        el.clearBtn.disabled          = false;
    } else {
        el.toolbar.classList.remove('is-active');
        el.guideText.classList.remove('is-visible');
        el.filenameArea.style.display = 'none';
        el.generateBtn.disabled       = true;
        el.clearBtn.disabled          = true;
        // Reset the size badge when the grid is empty
        updateEstimatedSize();
    }
}

/* ─── Loading Overlay Helpers ─── */

/**
 * Shows the full-screen loading overlay with a given title and subtitle.
 * @param {string} title - Main status headline (e.g. "Importing Images...").
 * @param {string} sub   - Secondary detail line (e.g. "Processing 3 of 12").
 */
function showLoader(title, sub) {
    el.loaderTitle.textContent = title;
    el.loaderSub.textContent   = sub;
    el.loader.classList.add('is-visible');
}

/** Hides the full-screen loading overlay. */
function hideLoader() {
    el.loader.classList.remove('is-visible');
}

/**
 * Updates only the headline of the loading overlay without hiding it.
 * @param {string} text - New title text.
 */
function updateLoaderTitle(text) {
    el.loaderTitle.textContent = text;
}

/**
 * Updates only the subtitle line of the loading overlay without hiding it.
 * @param {string} text - New subtitle text.
 */
function updateLoaderSub(text) {
    el.loaderSub.textContent = text;
}
