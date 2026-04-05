/**
 * ============================================================================
 *  FAVICON X ULTRA PRO — CORE ENGINE
 * ============================================================================
 *  Project   : Trusted Tools Web
 *  Tool      : Favicon Generator (seo-favicon-generator)
 *  Author    : MD KAWSAR / Trusted Tools Web
 *  Version   : 2.0 (CodeCanyon Release Build)
 *
 *  Description:
 *    Client-side favicon generation engine. Renders vector-quality icons to
 *    an HTML5 Canvas (512×512px) in real time, then exports a complete ZIP
 *    package containing:
 *      - PNG favicons at 16, 32, 180, 192, and 512px sizes
 *      - A true binary-encoded favicon.ico (32×32)
 *      - A site.webmanifest file for PWA / Android installation
 *
 *  Key features:
 *    • Three input modes: Image upload, Text/Initials, Emoji
 *    • Shape masks: Square, Rounded (custom radius), Circle
 *    • Background types: Solid color, Linear gradient, Transparent PNG
 *    • Pro effects: Border stroke, Drop shadow, Brightness, Contrast, Rotation
 *    • Stepped downscaling algorithm to avoid aliasing on small icon sizes
 *    • Real-time SEO Health Score with heuristic analysis
 *    • Google SERP 2026 mobile preview mockup
 *    • XSS-safe HTML code output
 *    • Custom .ttf / .otf font upload support
 *    • All processing is 100% client-side — no data ever leaves the browser
 *
 *  Dependencies (loaded in HTML, resolved before this script runs):
 *    • JSZip    — bundles generated assets into a single .zip download
 *    • FileSaver — triggers the browser's native Save-File dialog
 *
 *  Toast notifications:
 *    Uses the global window.showToast() system injected by global.js.
 *    Signature: window.showToast(message, isError)
 *      - isError = false (default) → success/info toast (green)
 *      - isError = true            → error toast (red)
 * ============================================================================
 */


/* ═══════════════════════════════════════════════════════════════════════════
   1. APPLICATION STATE
   Central immutable-pattern state object. All rendering reads from here
   and all input handlers write to it before triggering a canvas update.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * @type {Object} state — Single source of truth for the favicon editor state.
 * @property {string}  mode       — Active input mode: 'image' | 'text' | 'emoji'
 * @property {Image|null} img     — The loaded HTMLImageElement for image mode
 * @property {string}  text       — Current text/initials value (max 3 chars)
 * @property {string}  emoji      — Current emoji character
 * @property {string}  shape      — Active shape mask: 'square' | 'rounded' | 'circle'
 * @property {string}  bgType     — Background fill type: 'solid' | 'gradient' | 'transparent'
 * @property {Object}  colors     — Active color values { bg1, bg2, text }
 * @property {string}  font       — CSS font-family string for text mode
 * @property {Object}  vals       — Slider values { pad, rot, bright, contrast, fontSize, radius }
 * @property {boolean} isRendering — Lock flag to prevent concurrent rAF calls
 */
const state = {
    mode        : 'image',
    img         : null,
    text        : 'TT',
    emoji       : '⚡',
    shape       : 'square',
    bgType      : 'solid',
    colors      : { bg1: '#6366f1', bg2: '#ec4899', text: '#ffffff' },
    font        : 'Outfit',
    vals        : { pad: 0, rot: 0, bright: 100, contrast: 100, fontSize: 300, radius: 120 },
    isRendering : false
};


/* ═══════════════════════════════════════════════════════════════════════════
   2. CANVAS SETUP
   The master 512×512 canvas. All icon artwork is drawn here at full
   resolution. Scaling to smaller sizes happens in getHighQualityScaledCanvas().
═══════════════════════════════════════════════════════════════════════════ */

/** @type {HTMLCanvasElement} Main off-screen rendering canvas (512×512) */
const canvas = document.getElementById('canvas');

/**
 * @type {CanvasRenderingContext2D} 2D context with willReadFrequently hint
 * to optimise toDataURL() calls made on every frame.
 */
const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });

/* Enable maximum-quality bilinear interpolation for all draw calls */
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';


/* ═══════════════════════════════════════════════════════════════════════════
   3. CONSTANTS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * @const {number[]} sizes
 * The five PNG export sizes.
 * 180 → apple-touch-icon.png
 * 192 → android-chrome-192x192.png
 * 512 → android-chrome-512x512.png
 */
const sizes = [16, 32, 180, 192, 512];


/* ═══════════════════════════════════════════════════════════════════════════
   4. UTILITY FUNCTIONS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * debouncedUpdate()
 * Wraps updateCanvas() in a 15ms debounce to prevent canvas thrashing
 * while the user drags a range slider (which fires many rapid events).
 */
let debounceTimer;
function debouncedUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateCanvas(), 15);
}

/**
 * escapeHtml(text)
 * XSS sanitizer. Converts the five HTML special characters to their safe
 * entity equivalents before inserting any user-supplied text into the DOM.
 *
 * @param  {string} text  — Raw string from user input
 * @returns {string}      — HTML-safe escaped string
 */
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#039;");
}

/**
 * sanitizeFilename(name)
 * Strips non-alphanumeric characters from a string so it can be used
 * safely as a download filename (prevents path traversal issues).
 *
 * @param  {string} name — Raw user-supplied app name
 * @returns {string}     — Lowercase alphanumeric string (underscores replace specials)
 */
function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'app';
}


/* ═══════════════════════════════════════════════════════════════════════════
   5. INITIALIZATION
   window.onload waits for the DOM and all deferred scripts (JSZip, FileSaver)
   to finish loading before wiring up events and doing the first render.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Entry point. Runs after all HTML, scripts, and stylesheets have loaded.
 * Sequence: wire events → build asset grid → wait for fonts → first render.
 */
window.onload = () => {
    initEvents();   // Attach all DOM event listeners
    generateGrid(); // Build the generated-asset thumbnail placeholders

    /*
     * Defer the initial canvas render until document.fonts.ready resolves.
     * This prevents a flash of unstyled text (FOUT) in text mode, where
     * the Outfit / JetBrains Mono fonts must be fully loaded before drawing.
     * A 100ms safety setTimeout is added because some browsers resolve
     * fonts.ready before all glyphs are actually rasterized.
     */
    document.fonts.ready.then(() => {
        setTimeout(() => updateCanvas(), 100);
    });
};


/* ═══════════════════════════════════════════════════════════════════════════
   6. EVENT LISTENERS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * initEvents()
 * Wires all DOM event listeners for the favicon editor controls.
 * Handles:
 *   - File input change event (standard browse dialog)
 *   - Drop zone drag-and-drop events (dragover, dragleave, drop)
 *
 * All other inputs use inline oninput/onchange handlers in the HTML
 * for simplicity and to keep this file's event wiring surface minimal.
 */
function initEvents() {

    /* ── Standard file picker ──────────────────────────────────────────── */
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', e => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
                // Reset value so the same file can be re-selected
                e.target.value = '';
            }
        });
    }

    /* ── Drag-and-drop zone ────────────────────────────────────────────── */
    const dz = document.getElementById('dropZone');
    if (dz) {

        /**
         * dragover: Prevent default to allow the drop event to fire.
         * Highlight the drop zone border to give the user visual feedback.
         */
        dz.addEventListener('dragover', e => {
            e.preventDefault();
            dz.style.borderColor     = '#6366f1';
            dz.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
        });

        /**
         * dragleave: Reset drop zone styles when the cursor leaves.
         */
        dz.addEventListener('dragleave', e => {
            e.preventDefault();
            dz.style.borderColor     = '';
            dz.style.backgroundColor = '';
        });

        /**
         * drop: Extract the first dragged file and pass it to handleFile().
         * Reset drop zone styles after the drop event fires.
         */
        dz.addEventListener('drop', e => {
            e.preventDefault();
            dz.style.borderColor     = '';
            dz.style.backgroundColor = '';
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   7. FILE HANDLING
═══════════════════════════════════════════════════════════════════════════ */

/**
 * handleFile(file)
 * Validates and loads an image file selected by the user (via browse or
 * drag-and-drop). Supported types: PNG, JPG/JPEG, WebP, SVG.
 *
 * Security notes:
 *   - MIME type is validated against a strict allowlist pattern before loading.
 *   - SVG files receive explicit 512×512 dimensions to prevent canvas
 *     origin-taint issues caused by SVGs with no intrinsic size.
 *   - readAsDataURL encodes the file as a base64 data: URI, which ensures
 *     the image is loaded into the same origin context as the page.
 *
 * @param {File} file — The File object from the input or DataTransfer event
 */
function handleFile(file) {
    if (!file) return;

    try {
        /* Validate MIME type — reject anything outside the allowed image types */
        if (!file.type.match(/^image\/(png|jpeg|jpg|webp|svg\+xml)/)) {
            window.showToast('Invalid file. Please use PNG, JPG, or SVG.', true);
            return;
        }

        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();

            img.onload = () => {
                state.img = img;        // Store the loaded image in state
                setMode('image');       // Switch UI to image mode
                window.showToast('Image loaded successfully!');
                updateCanvas();         // Trigger an immediate re-render
            };

            img.onerror = () => window.showToast('Error parsing image data.', true);

            /*
             * SVG Handling Fix:
             * SVG files without explicit width/height attributes render as 0×0
             * in some browsers, which causes canvas.drawImage() to produce a
             * blank output. Setting these attributes before assigning .src
             * forces the browser to rasterize the SVG at 512×512.
             */
            if (file.type === 'image/svg+xml') {
                img.width  = 512;
                img.height = 512;
            }

            img.src = e.target.result; // Trigger the image load from the data URI
        };

        reader.readAsDataURL(file); // Convert file to base64 data: URI

    } catch (err) {
        console.error('handleFile error:', err);
        window.showToast('Unexpected error loading file.', true);
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   8. CUSTOM FONT LOADER
═══════════════════════════════════════════════════════════════════════════ */

/**
 * loadCustomFont(input)
 * Allows the user to upload a local .ttf / .otf / .woff font file and use
 * it inside Text mode. The font is loaded via the FontFace API and added to
 * the document's font set, then dynamically added to the #fontSelect dropdown.
 *
 * Security: Each uploaded font gets a unique timestamped name to prevent
 * collisions and avoid overwriting system fonts.
 *
 * @param {HTMLInputElement} input — The hidden file input element
 */
function loadCustomFont(input) {
    try {
        const file = input.files[0];
        if (!file) return;

        /* Limit font file size to 5 MB to prevent browser crashes */
        if (file.size > 5 * 1024 * 1024) {
            window.showToast('Font file too large (Max 5MB).', true);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            /* Generate a unique font name so multiple uploads don't conflict */
            const fontName = 'CustomFont_' + Date.now();
            const fontFace = new FontFace(fontName, `url(${e.target.result})`);

            fontFace.load().then((loadedFace) => {
                /* Register the font with the browser's font engine */
                document.fonts.add(loadedFace);

                /* Dynamically add the new font as an option in the dropdown */
                const select = document.getElementById('fontSelect');
                const option = document.createElement('option');
                option.value = fontName;
                option.text  = 'Custom Font (' + escapeHtml(file.name) + ')';
                select.add(option);

                /* Immediately select the newly loaded font */
                select.value = fontName;

                window.showToast('Font Loaded Successfully!');
                updateCanvas(); // Re-render with the new font

            }).catch((e) => {
                console.error('FontFace.load error:', e);
                window.showToast('Font format not supported.', true);
            });
        };

        reader.readAsDataURL(file);

    } catch (err) {
        console.error('loadCustomFont error:', err);
        window.showToast('Error loading font.', true);
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   9. CANVAS RENDER ENGINE
═══════════════════════════════════════════════════════════════════════════ */

/**
 * updateCanvas()
 * The render scheduler. Wraps renderLogic() inside requestAnimationFrame
 * to synchronize rendering with the browser's display refresh cycle (60fps).
 *
 * The isRendering lock prevents multiple rAF calls from queuing up when
 * several inputs fire rapid change events simultaneously (e.g., slider drag
 * while debounceTimer is still running).
 */
function updateCanvas() {
    if (state.isRendering) return; // Skip if a frame is already in flight
    state.isRendering = true;

    requestAnimationFrame(() => {
        try {
            renderLogic(); // Execute the full drawing sequence
        } catch (e) {
            console.error('Canvas Render Error:', e);
        }
        state.isRendering = false; // Release the lock after the frame completes
    });
}

/**
 * renderLogic()
 * The main drawing function. Executes a complete canvas render pass:
 *   1. Read all current input values from the DOM into state
 *   2. Toggle conditional UI elements (gradient color2, radius control)
 *   3. Clear the canvas
 *   4. Apply the shape clip mask (square / rounded / circle)
 *   5. Fill the background (solid / gradient / transparent)
 *   6. Apply transform (translate to center → rotate → scale)
 *   7. Apply CSS filter (brightness + contrast)
 *   8. Draw content (image / text / emoji)
 *   9. Restore canvas state and update preview elements
 */
function renderLogic() {

    /* ── Helper: safely read an element's value, with a default fallback ── */
    const getVal = (id, def) => {
        const el = document.getElementById(id);
        return el ? el.value : def;
    };

    /* ── Step 1: Sync state from DOM inputs ─────────────────────────────── */
    state.text         = getVal('textInput', 'TTW');
    state.colors.bg1   = getVal('bgColor1', '#6366f1');
    state.colors.bg2   = getVal('bgColor2', '#ec4899');
    state.colors.text  = getVal('textColor', '#ffffff');
    state.bgType       = getVal('bgType', 'solid');
    state.font         = getVal('fontSelect', 'Outfit');

    state.vals.pad      = parseInt(getVal('paddingRange',   0));
    state.vals.rot      = parseInt(getVal('rotateRange',    0));
    state.vals.bright   = parseInt(getVal('brightRange',  100));
    state.vals.contrast = parseInt(getVal('contrastRange', 100));
    state.vals.fontSize = parseInt(getVal('fontSizeRange', 300));
    state.vals.radius   = parseInt(getVal('radiusRange',   120));
    state.emoji         = getVal('emojiInput', '⚡');

    /* ── Step 2: Conditional UI element visibility ───────────────────────── */

    /* Show the second gradient color picker only in gradient mode */
    const bg2Input = document.getElementById('bgColor2');
    if (bg2Input) bg2Input.style.display = state.bgType === 'gradient' ? 'inline-block' : 'none';

    /* Show the corner radius slider only for the 'rounded' shape */
    const radiusCtrl = document.getElementById('radiusControl');
    if (radiusCtrl) radiusCtrl.style.display = state.shape === 'rounded' ? 'block' : 'none';

    /* ── Step 3: Clear canvas ────────────────────────────────────────────── */
    const size = 512;
    ctx.clearRect(0, 0, size, size);
    ctx.save(); // Save the unclipped, untransformed state

    /* ── Step 4: Apply shape clip mask ──────────────────────────────────── */
    ctx.beginPath();
    if (state.shape === 'circle') {
        /* Perfect circle inscribed within the 512×512 canvas */
        ctx.arc(256, 256, 256, 0, Math.PI * 2);
    } else if (state.shape === 'rounded') {
        /* Rounded rectangle with user-defined corner radius */
        roundRect(ctx, 0, 0, 512, 512, state.vals.radius);
    } else {
        /* Full square (no clipping) */
        ctx.rect(0, 0, 512, 512);
    }
    ctx.clip(); // All subsequent draws are clipped to this shape

    /* ── Step 5: Fill background ─────────────────────────────────────────── */
    if (state.bgType !== 'transparent') {
        if (state.bgType === 'gradient') {
            /* Diagonal linear gradient from top-left to bottom-right */
            const g = ctx.createLinearGradient(0, 0, 512, 512);
            g.addColorStop(0, state.colors.bg1);
            g.addColorStop(1, state.colors.bg2);
            ctx.fillStyle = g;
        } else {
            /* Solid color fill */
            ctx.fillStyle = state.colors.bg1;
        }
        ctx.fillRect(0, 0, 512, 512);
    }
    /* Transparent mode: canvas alpha channel left intact (no fill) */

    /* ── Step 6: Apply canvas transform ─────────────────────────────────── */
    ctx.translate(256, 256);                                  // Move origin to center
    ctx.rotate(state.vals.rot * Math.PI / 180);               // Apply rotation in radians

    const scale = 1 - (state.vals.pad / 100);                // Padding → zoom-out factor
    ctx.scale(scale, scale);

    /* ── Step 7: Apply CSS filter (brightness + contrast) ───────────────── */
    ctx.filter = `brightness(${state.vals.bright}%) contrast(${state.vals.contrast}%)`;

    /* ── Step 8: Draw content ────────────────────────────────────────────── */

    if (state.mode === 'image' && state.img) {
        /*
         * IMAGE MODE:
         * Maintain aspect ratio. The longer dimension fills the full 512px
         * and the shorter dimension is scaled proportionally.
         */
        try {
            const imgRatio = state.img.width / state.img.height;
            let drawW = 512;
            let drawH = 512;

            if (imgRatio > 1) drawH = 512 / imgRatio;   // Landscape: constrain height
            else              drawW = 512 * imgRatio;    // Portrait:  constrain width

            /* Draw centered: the canvas origin is already translated to (256, 256) */
            ctx.drawImage(state.img, -drawW / 2, -drawH / 2, drawW, drawH);
        } catch (e) {
            /*
             * Canvas taint may occur if the image is served from a cross-origin
             * URL without CORS headers. Silently skip and log a warning.
             */
            console.warn('Image draw failed (possible canvas taint):', e);
        }

    } else if (state.mode === 'text' || state.mode === 'emoji') {
        /*
         * TEXT / EMOJI MODE:
         * Renders text or a single emoji character centered on the canvas.
         * Supports border stroke, drop shadow, and custom font size.
         */

        /* Font size: user-configurable for text mode; fixed 300px for emoji */
        const fSize = state.mode === 'text' ? state.vals.fontSize : 300;
        ctx.font         = state.mode === 'text'
            ? `bold ${fSize}px "${state.font}", sans-serif`
            : `300px serif`; // Emoji renders best in a generic serif font

        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        /* Read effects controls from DOM */
        const borderWidth = parseInt(document.getElementById('borderWidth').value  || 0);
        const borderColor = document.getElementById('borderColor').value;
        const shadowBlur  = parseInt(document.getElementById('shadowBlur').value   || 0);
        const shadowColor = document.getElementById('shadowColor').value;

        /* Clamp text to 3 characters for visual sanity */
        let content = state.mode === 'text' ? state.text : state.emoji;
        if (state.mode === 'text' && content.length > 3) content = content.substring(0, 3);

        /*
         * Vertical alignment correction:
         * measureText().actualBoundingBoxAscent/Descent gives the true rendered
         * glyph height. A small nudge (yOffset) adjusts for the difference
         * between the CSS "middle" baseline and the actual glyph center,
         * especially noticeable for emoji characters.
         */
        const metrics      = ctx.measureText(content);
        const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        const yOffset      = (actualHeight / 15) + (state.mode === 'text' ? 0 : 20);

        /* Apply drop shadow if shadow blur > 0 */
        if (shadowBlur > 0) {
            ctx.shadowBlur  = shadowBlur;
            ctx.shadowColor = shadowColor;
        }

        /* Fill the text/emoji */
        ctx.fillStyle = state.colors.text;
        ctx.fillText(content, 0, yOffset);

        /* Reset shadow so it doesn't bleed onto subsequent draws */
        ctx.shadowBlur = 0;

        /* Apply border stroke if border width > 0 */
        if (borderWidth > 0) {
            ctx.lineWidth   = borderWidth;
            ctx.strokeStyle = borderColor;
            ctx.strokeText(content, 0, yOffset);
            ctx.fillText(content, 0, yOffset); // Redraw fill on top of stroke for clean edges
        }
    }

    /* ── Step 9: Restore & update previews ──────────────────────────────── */
    ctx.restore();    // Restore pre-transform, pre-clip state
    updatePreviews(); // Push the rendered canvas to all preview elements
}


/* ═══════════════════════════════════════════════════════════════════════════
   10. CANVAS DRAWING HELPERS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * roundRect(ctx, x, y, w, h, r)
 * Draws a rounded rectangle path on the given canvas context.
 * Used to create the 'rounded' shape clip mask in renderLogic().
 *
 * If the radius is larger than half the smallest dimension, it is clamped
 * to prevent the arcs from inverting.
 *
 * @param {CanvasRenderingContext2D} ctx — The canvas context
 * @param {number} x — X origin
 * @param {number} y — Y origin
 * @param {number} w — Width
 * @param {number} h — Height
 * @param {number} r — Corner radius
 */
function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2; // Clamp radius to half-width
    if (h < 2 * r) r = h / 2; // Clamp radius to half-height
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r); // Top-right corner
    ctx.arcTo(x + w, y + h, x,     y + h, r); // Bottom-right corner
    ctx.arcTo(x,     y + h, x,     y,     r); // Bottom-left corner
    ctx.arcTo(x,     y,     x + w, y,     r); // Top-left corner
    ctx.closePath();
}


/* ═══════════════════════════════════════════════════════════════════════════
   11. HIGH-QUALITY SCALED CANVAS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * getHighQualityScaledCanvas(targetSize)
 * Implements a stepped downscaling algorithm to produce crisp thumbnails
 * at very small target sizes (e.g., 16×16 from a 512×512 source).
 *
 * Naive single-step resizing (512 → 16) produces blurry, artefact-heavy
 * results because the browser's bilinear filter loses too much data.
 * This function instead halves the canvas repeatedly until the next halving
 * would overshoot the target, then scales to the exact target size.
 *
 * Example for targetSize = 16:
 *   512 → 256 → 128 → 64 → 32 → 16  (5 steps, each ×0.5)
 *
 * @param  {number} targetSize — The desired output size in pixels (square)
 * @returns {HTMLCanvasElement} — An off-screen canvas at targetSize × targetSize
 */
function getHighQualityScaledCanvas(targetSize) {
    /* Build the array of intermediate step sizes */
    const steps = [];
    let currentSize = 512;

    while (currentSize * 0.5 >= targetSize) {
        currentSize = Math.floor(currentSize * 0.5);
        steps.push(currentSize);
    }
    steps.push(targetSize); // Always end at the exact target size

    /* Chain the steps: each iteration draws from the previous temp canvas */
    let currentCanvas = canvas; // Start from the master 512×512 canvas

    for (let i = 0; i < steps.length; i++) {
        const s       = steps[i];
        const tempC   = document.createElement('canvas');
        tempC.width   = s;
        tempC.height  = s;
        const tempCtx = tempC.getContext('2d');

        /* Enable high-quality interpolation at each step */
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        tempCtx.drawImage(currentCanvas, 0, 0, s, s);

        currentCanvas = tempC; // Previous step's output becomes next step's input
    }

    return currentCanvas; // Final canvas at targetSize × targetSize
}


/* ═══════════════════════════════════════════════════════════════════════════
   12. PREVIEW UPDATER
═══════════════════════════════════════════════════════════════════════════ */

/**
 * updatePreviews()
 * Converts the master canvas to a PNG data URL and distributes it
 * to all live preview image elements on the page.
 *
 * Also triggers checkSEO() and updateCode() after every render to keep
 * the SEO score and HTML snippet always in sync with the current canvas state.
 *
 * Errors are suppressed here because canvas.toDataURL() throws a SecurityError
 * if the canvas has been tainted by a cross-origin image. The user will see
 * a blank preview rather than a JavaScript crash.
 */
function updatePreviews() {
    try {
        const url = canvas.toDataURL('image/png');

        /* Helper: safely set the src of an element by ID */
        const safeSetSrc = (id, src) => {
            const el = document.getElementById(id);
            if (el) el.src = src;
        };

        /* Update the three primary preview images */
        safeSetSrc('liveFavicon',   url); // Browser tab mockup (16×16)
        safeSetSrc('bigPreview',    url); // Large preview stage (96×96)
        safeSetSrc('googleFavicon', url); // Google SERP mockup (18×18)

        /* Update each size thumbnail in the generated-asset grid */
        sizes.forEach(s => safeSetSrc(`p-${s}`, url));

        /* Run the SEO heuristic check and refresh the HTML code output */
        checkSEO();
        updateCode();

    } catch (e) {
        /* Canvas is tainted (cross-origin image) or empty — suppress gracefully */
        console.warn('Preview update suppressed (Canvas tainted or empty):', e);
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   13. SEO HEALTH SCORE
═══════════════════════════════════════════════════════════════════════════ */

/**
 * checkSEO()
 * Computes a 0–100 SEO quality score for the current favicon configuration
 * based on widely accepted best-practice heuristics:
 *
 *   +30 pts — Content exists (uploaded image, or text/emoji entered)
 *   +20 pts — Contrast filter is not too low (≥ 80%)
 *   +30 pts — Non-transparent background (Google recommends solid bg for iOS)
 *   +20 pts — Resolution bonus (always awarded when content exists)
 *   =100 max
 *
 * The score drives:
 *   - The numeric display inside #seoRing
 *   - The border and text color of #seoRing (red / amber / green)
 *   - The status class on #seoCard (bad / warn / good)
 *   - The explanatory message in #seoMsg
 */
function checkSEO() {
    let score = 0;
    let msg   = "";

    const ring = document.getElementById('seoRing');
    const card = document.getElementById('seoCard');

    if (state.mode === 'image' && !state.img) {
        /* No image loaded in image mode — score remains 0 */
        score = 0;
        msg   = "Please upload an image first.";
    } else {
        score += 30; // Base score awarded for having any content

        /* Contrast check: low contrast produces an illegible 16×16 icon */
        if (state.vals.contrast < 80) {
            msg = "Low contrast may be hard to see.";
        } else {
            score += 20;
        }

        /* Background type check */
        if (state.bgType === 'transparent') {
            /*
             * Apple iOS Safari adds a black background behind transparent favicons,
             * which often produces poor visual results. Flag as a warning.
             */
            msg    = "Avoid transparent BG for iOS (adds black bg).";
            score += 10;
        } else {
            score += 30; // Solid or gradient background — full points
        }

        score += 20; // Resolution bonus: always awarded (we export 512px master)
    }

    /* Cap score at 100 */
    if (score > 100) score = 100;

    /* ── Update ring display ─────────────────────────────────────────────── */
    if (ring && card) {
        ring.innerText = score;

        /* Color thresholds: red (<50), amber (50–89), green (≥90) */
        let color  = "#ef4444"; // Red   — bad
        let status = "bad";

        if (score >= 50) { color = "#f59e0b"; status = "warn"; } // Amber  — warning
        if (score >= 90) { color = "#10b981"; status = "good"; } // Green  — good

        ring.style.color       = color;
        ring.style.borderColor = color;

        /* Apply status class to the card for background tint */
        card.className = "fav-seo-card " + status;
    }

    /* Update the explanatory message below the title */
    const seoMsg = document.getElementById('seoMsg');
    if (seoMsg) seoMsg.innerText = msg || "Perfect SEO Configuration!";
}


/* ═══════════════════════════════════════════════════════════════════════════
   14. HTML CODE OUTPUT
═══════════════════════════════════════════════════════════════════════════ */

/**
 * updateCode()
 * Generates the ready-to-paste HTML <head> snippet for the user's website.
 * The snippet includes:
 *   - apple-touch-icon link
 *   - 32×32 and 16×16 favicon PNGs
 *   - site.webmanifest link
 *   - theme-color meta tag (value pulled from the PWA Manifest section)
 *
 * XSS Prevention:
 *   The themeColor value (a hex color string) is passed through escapeHtml()
 *   before being embedded in the output, even though color inputs are
 *   restricted by the browser, as an additional layer of defence.
 *   All < and > characters in the HTML string are then entity-encoded
 *   for safe display inside a <code> element.
 */
function updateCode() {
    const theme = escapeHtml(document.getElementById('themeColor').value);

    const html = `
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${theme}">`;

    const codeBlock = document.getElementById('htmlCode');
    if (codeBlock) {
        /* Entity-encode the HTML string so it displays as text, not rendered markup */
        codeBlock.innerHTML = html.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

/**
 * copyCode()
 * Copies the currently displayed HTML snippet to the user's clipboard
 * using the modern Clipboard API (async, no deprecated execCommand).
 * Shows a success toast on completion.
 */
function copyCode() {
    const codeBlock = document.getElementById('htmlCode');
    if (codeBlock) {
        /* Use innerText to get the visible (decoded) text, not the entity-encoded HTML */
        const textToCopy = codeBlock.innerText || codeBlock.textContent;
        navigator.clipboard.writeText(textToCopy);
        window.showToast('HTML Snippet Copied to Clipboard!');
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   15. ASSET THUMBNAIL GRID
═══════════════════════════════════════════════════════════════════════════ */

/**
 * generateGrid()
 * Builds the generated-asset preview thumbnails by programmatically
 * inserting one .fav-icon-card per output size into the #assetGrid container.
 *
 * Each card contains:
 *   - An <img> with id="p-{size}" (updated by updatePreviews on every render)
 *   - A size label (e.g., "16x16")
 *   - A "PNG" format badge
 *
 * Icons larger than 64px are displayed at 32px (CSS max-width) to prevent
 * the grid from breaking its layout with oversized thumbnails.
 */
function generateGrid() {
    const g = document.getElementById('assetGrid');
    if (!g) return;

    g.innerHTML = sizes.map(s => `
        <div class="fav-icon-card" title="${s}×${s} PNG">
            <img id="p-${s}" src="" alt="Icon ${s}px"
                 style="width:${s > 64 ? 32 : s}px; height:${s > 64 ? 32 : s}px;
                        object-fit:contain; margin-bottom:6px;">
            <div class="fav-icon-card-text">${s}×${s}</div>
            <small style="color:var(--text-muted); font-size:10px;">PNG</small>
        </div>
    `).join('');
}


/* ═══════════════════════════════════════════════════════════════════════════
   16. BINARY ICO GENERATOR
═══════════════════════════════════════════════════════════════════════════ */

/**
 * generateIcoBlob(pngBlob)
 * Creates a genuine, standards-compliant binary ICO file by manually
 * writing the ICO file format headers using a DataView over an ArrayBuffer.
 *
 * ICO File Format (ICONDIRHEADER + ICONDIRENTRY + image data):
 *   Offset  Size  Value   Description
 *   0       2     0       Reserved — always 0
 *   2       2     1       Type: 1 = ICO (2 = CUR)
 *   4       2     1       Number of images in the file
 *   ── DIRECTORY ENTRY (16 bytes per image) ──
 *   6       1     32      Width  (0 = 256px; 32 here = 32px icon)
 *   7       1     32      Height
 *   8       1     0       Color count (0 = 256+ colors)
 *   9       1     0       Reserved
 *   10      2     1       Color planes
 *   12      2     32      Bits per pixel
 *   14      4     N       Size of image data in bytes
 *   18      4     22      Offset from file start to image data (= header size)
 *   ── IMAGE DATA (raw PNG bytes) ──
 *   22      N     –       The 32×32 PNG blob bytes
 *
 * Modern browsers and operating systems fully support embedding a PNG
 * inside an ICO container (PNG-in-ICO), which means we don't need to
 * decode/re-encode the pixel data — we simply wrap the existing PNG.
 *
 * @param  {Blob}    pngBlob — A 32×32 PNG Blob from canvas.toBlob()
 * @returns {Promise<Blob>}  — Resolves with a valid ICO Blob
 */
function generateIcoBlob(pngBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function() {
            try {
                const pngData = new Uint8Array(this.result);
                const pngSize = pngData.length;

                /* ICO Header (6 bytes) + one Directory Entry (16 bytes) = 22 bytes */
                const headerSize = 6 + 16;
                const buffer     = new ArrayBuffer(headerSize + pngSize);
                const view       = new DataView(buffer);

                /* ── ICONDIRHEADER (6 bytes) ─────────────────────────────── */
                view.setUint16(0,  0, true); // Reserved — must be 0
                view.setUint16(2,  1, true); // Type: 1 = ICO file
                view.setUint16(4,  1, true); // Count: 1 image in this file

                /* ── ICONDIRENTRY (16 bytes starting at offset 6) ────────── */
                view.setUint8 ( 6, 32);          // Width  = 32px
                view.setUint8 ( 7, 32);          // Height = 32px
                view.setUint8 ( 8,  0);          // Color count = 0 (256+ colors)
                view.setUint8 ( 9,  0);          // Reserved
                view.setUint16(10,  1, true);     // Color planes = 1
                view.setUint16(12, 32, true);     // Bits per pixel = 32 (RGBA)
                view.setUint32(14, pngSize, true);  // Size of image data in bytes
                view.setUint32(18, headerSize, true); // Byte offset to image data

                /* ── IMAGE DATA ──────────────────────────────────────────── */
                /* Copy the PNG byte stream directly after the header block */
                const bytes = new Uint8Array(buffer);
                bytes.set(pngData, headerSize);

                resolve(new Blob([buffer], { type: "image/x-icon" }));

            } catch (e) {
                reject(e);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(pngBlob); // Read the PNG blob as a raw byte buffer
    });
}


/* ═══════════════════════════════════════════════════════════════════════════
   17. ZIP DOWNLOAD HANDLER
═══════════════════════════════════════════════════════════════════════════ */

/**
 * downloadAll()
 * Packages all generated favicon assets into a single ZIP file and
 * triggers a browser download via FileSaver.js.
 *
 * ZIP contents:
 *   favicon-16x16.png          — Standard browser favicon (16px)
 *   favicon-32x32.png          — High-DPI browser favicon (32px)
 *   apple-touch-icon.png       — iOS / macOS Safari bookmark icon (180px)
 *   android-chrome-192x192.png — Android PWA launcher icon (192px)
 *   android-chrome-512x512.png — Android splash screen icon (512px)
 *   favicon.ico                — Legacy binary ICO (32px PNG-in-ICO format)
 *   site.webmanifest           — PWA manifest JSON file
 *
 * Async flow:
 *   1. Validate preconditions (image loaded, JSZip/FileSaver available)
 *   2. Lock UI (disable download button, show processing overlay)
 *   3. Generate all PNG blobs in parallel via Promise.all()
 *   4. Generate the binary ICO blob
 *   5. Generate the site.webmanifest JSON
 *   6. Bundle everything with JSZip and trigger saveAs()
 *   7. Unlock UI in the finally block (runs even if an error occurs)
 */
async function downloadAll() {
    const btn     = document.querySelector('.btn.btn-success');
    const overlay = document.getElementById('processingOverlay');

    /* ── Precondition checks ────────────────────────────────────────────── */
    if (state.mode === 'image' && !state.img) {
        window.showToast('Please generate or upload an icon first!', true);
        return;
    }

    if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
        window.showToast('Required libraries are missing. Check your internet connection.', true);
        return;
    }

    /* ── Lock UI while processing ───────────────────────────────────────── */
    if (btn)     btn.disabled = true;
    if (overlay) overlay.classList.add('active');

    try {
        const zip      = new JSZip();
        const promises = [];

        /* ── Generate PNG files at all required sizes ────────────────────── */
        sizes.forEach(size => {
            promises.push(new Promise(resolve => {
                /* Use the stepped downscaling algorithm for maximum sharpness */
                const hqCanvas = getHighQualityScaledCanvas(size);

                hqCanvas.toBlob(blob => {
                    /* Map standard sizes to their conventional filenames */
                    let name = `favicon-${size}x${size}.png`;
                    if (size === 180) name = 'apple-touch-icon.png';
                    if (size === 192) name = 'android-chrome-192x192.png';
                    if (size === 512) name = 'android-chrome-512x512.png';

                    zip.file(name, blob); // Add PNG to the ZIP archive
                    resolve();
                });
            }));
        });

        /* ── Generate binary favicon.ico ────────────────────────────────── */
        promises.push(new Promise((resolve, reject) => {
            /* Use the 32×32 scaled canvas as the ICO source image */
            const c = getHighQualityScaledCanvas(32);
            c.toBlob(async blob => {
                try {
                    const icoBlob = await generateIcoBlob(blob);
                    zip.file('favicon.ico', icoBlob);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }, 'image/png');
        }));

        /* ── Generate site.webmanifest ──────────────────────────────────── */
        const appName   = document.getElementById('appName').value;
        const themeColor = document.getElementById('themeColor').value;
        const safeName  = sanitizeFilename(appName);

        const manifest = {
            name            : appName || 'My PWA',
            short_name      : appName || 'App',
            icons           : [
                { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
                { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
            ],
            theme_color      : themeColor,
            background_color : themeColor,
            display          : "standalone"
        };

        /* Serialize the manifest with 2-space indentation for readability */
        zip.file("site.webmanifest", JSON.stringify(manifest, null, 2));

        /* ── Wait for all async blob generation to complete ─────────────── */
        await Promise.all(promises);

        /* ── Generate the ZIP and trigger browser download ──────────────── */
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${safeName}_favicon_pack.zip`);

        window.showToast('Download Started! Check your downloads folder.');

    } catch (e) {
        console.error('downloadAll error:', e);
        window.showToast('Error creating ZIP file. Please try again.', true);

    } finally {
        /* Always unlock the UI, whether the download succeeded or failed */
        if (btn)     btn.disabled = false;
        if (overlay) overlay.classList.remove('active');
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   18. MODE & SHAPE SETTERS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * setMode(m)
 * Switches the active input mode between 'image', 'text', and 'emoji'.
 * Updates:
 *   - state.mode
 *   - .fav-mode-tab .active class (visual tab highlight)
 *   - #mode-{image|text|emoji} visibility (.hidden class toggle)
 *   - Triggers a canvas re-render
 *
 * @param {string} m — Target mode: 'image' | 'text' | 'emoji'
 */
function setMode(m) {
    state.mode = m;

    /* Deactivate all mode tabs */
    const tabs = document.querySelectorAll('.fav-mode-tab');
    tabs.forEach(t => t.classList.remove('active'));

    /* Activate the correct tab based on index (image=0, text=1, emoji=2) */
    if (tabs.length >= 3) {
        if (m === 'image') tabs[0].classList.add('active');
        if (m === 'text')  tabs[1].classList.add('active');
        if (m === 'emoji') tabs[2].classList.add('active');
    }

    /* Hide all mode content panels, then reveal only the active one */
    ['image', 'text', 'emoji'].forEach(x => {
        const el = document.getElementById('mode-' + x);
        if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById('mode-' + m);
    if (activeEl) activeEl.classList.remove('hidden');

    updateCanvas(); // Re-render with the new mode's content
}

/**
 * setShape(s, btn)
 * Sets the favicon shape mask and updates the active state of the shape buttons.
 *
 * @param {string}          s   — Target shape: 'square' | 'rounded' | 'circle'
 * @param {HTMLButtonElement} btn — The clicked button element (for .active toggle)
 */
function setShape(s, btn) {
    state.shape = s;

    /* Deactivate all shape tabs and activate the clicked one */
    document.querySelectorAll('.fav-shape-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    updateCanvas(); // Re-render with the new shape mask
}
