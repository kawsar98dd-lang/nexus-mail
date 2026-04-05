/**
 * ============================================================================
 *  TRUSTED TOOLS WEB — Thumbnail Ultra Pro
 *  Tool     : YouTube Thumbnail Downloader 4K & Live Editor
 *  Author   : MD KAWSAR
 *  Version  : 3.0 (CodeCanyon Release Build)
 *  File     : thumbnail-ultra-pro.js
 *
 *  Description:
 *    Secure, 100% client-side engine for fetching YouTube thumbnails at the
 *    highest available resolution (4K → HD → HQ fallback), rendering them
 *    on an HTML5 Canvas with real-time CSS filter adjustments (brightness,
 *    contrast, saturation, blur, sepia, grayscale), rounded-corner clipping,
 *    border overlays, and an optional YouTube-style play button overlay.
 *    Exports the final canvas as JPG, PNG, or WebP without any server upload.
 *
 *  Architecture:
 *    - IIFE (Immediately Invoked Function Expression) pattern to avoid
 *      polluting the global scope. Only the public API object is returned.
 *    - All DOM elements are cached once on init() for performance.
 *    - Canvas renders are debounced via requestAnimationFrame to prevent
 *      frame drops while the user drags sliders.
 *    - Image loading uses the wsrv.nl CORS proxy to allow canvas taint-free
 *      data export (toDataURL) even on static hosting without a backend.
 *
 *  Toast Notifications:
 *    Uses the global window.showToast(message, isError) system injected
 *    by global.js. Pass `true` as the second argument for error toasts.
 * ============================================================================
 */

const app = (() => {

    // =========================================================================
    // DOM ELEMENT CACHE
    // All elements are cached here once at init() time to avoid repeated
    // document.getElementById() calls on every render / event tick.
    // =========================================================================
    const els = {
        urlInput        : document.getElementById('urlInput'),        // URL text field
        loader          : document.getElementById('loader'),          // Spinner element
        workspace       : document.getElementById('workspace'),       // Editor grid wrapper
        canvas          : document.getElementById('editorCanvas'),    // Output <canvas>
        ctx             : document.getElementById('editorCanvas').getContext('2d'), // 2D rendering context
        sourceImg       : document.getElementById('sourceImg'),       // Hidden proxy-loaded <img>
        vidTitle        : document.getElementById('vidTitle'),        // Video title display
        vidAuthor       : document.getElementById('vidAuthor'),       // Channel name display
        vidId           : document.getElementById('vidId'),           // Video ID display
        qualityBadge    : document.getElementById('qualityBadge'),    // "4K ULTRA / HD / HQ" pill badge
        historySection  : document.getElementById('historySection'),  // History strip wrapper
        historyList     : document.getElementById('historyList'),     // History thumbnails container

        // ── All Filter & Edit Inputs ──
        inputs: {
            bright   : document.getElementById('brightRange'),       // Brightness (50–150)
            contrast : document.getElementById('contrastRange'),     // Contrast (50–150)
            sat      : document.getElementById('satRange'),          // Saturation (0–200)
            blur     : document.getElementById('blurRange'),         // Blur (0–10px, step 0.5)
            sepia    : document.getElementById('sepiaRange'),        // Sepia tint (0–100)
            gray     : document.getElementById('grayRange'),         // Grayscale (0–100)
            radius   : document.getElementById('radiusRange'),       // Corner radius (0–50)
            borderW  : document.getElementById('borderWidthRange'),  // Border width (0–40)
            borderC  : document.getElementById('borderColorPicker'), // Border colour (native color input)
            playBtn  : document.getElementById('playBtnToggle')      // Play button overlay (checkbox)
        },

        // ── Live Value Readout Labels ──
        labels: {
            bright   : document.getElementById('val-bright'),    // Displays e.g. "108%"
            contrast : document.getElementById('val-contrast'),  // Displays e.g. "108%"
            sat      : document.getElementById('val-sat'),       // Displays e.g. "135%"
            blur     : document.getElementById('val-blur'),      // Displays e.g. "2px"
            sepia    : document.getElementById('val-sepia'),     // Displays e.g. "30%"
            gray     : document.getElementById('val-gray'),      // Displays e.g. "0%"
            rad      : document.getElementById('val-rad'),       // Displays e.g. "10%"
            border   : document.getElementById('val-border')     // Displays e.g. "5px"
        }
    };

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /** @type {string} The extracted 11-character YouTube video ID of the current thumbnail. */
    let currentVideoID = '';

    /** @type {number|null} requestAnimationFrame ID used to debounce canvas re-renders. */
    let renderReq = null;

    /** @type {string} Sanitized video title used to generate the download filename. */
    let currentTitle = 'YouTube_Thumbnail';


    // =========================================================================
    // INITIALIZATION
    // Runs once when the DOM is ready (called via DOMContentLoaded listener below).
    // Sets up all event listeners and loads saved history from localStorage.
    // =========================================================================

    /**
     * init()
     * Bootstraps the application:
     *   1. Loads localStorage history into the history strip.
     *   2. Attaches 'input' / 'change' listeners to every filter control so
     *      that moving any slider instantly re-renders the canvas.
     *   3. Attaches a window 'resize' listener to re-render at new canvas
     *      display size (important for responsive layouts).
     */
    function init() {
        // Populate the history strip from localStorage on page load
        loadHistory();

        // ── Attach filter-change event listeners to all editor inputs ──
        // We use 'change' for color/checkbox (fired on commit) and 'input'
        // for sliders (fired continuously while dragging for live preview).
        Object.values(els.inputs).forEach(el => {
            if (!el) return; // Defensive guard: skip if an element is not in the DOM

            const eventType = (el.type === 'checkbox' || el.type === 'color') ? 'change' : 'input';

            el.addEventListener(eventType, () => {
                updateLabels();   // Refresh the numeric readouts next to each label
                requestRender();  // Schedule a canvas repaint via rAF (debounced)
            });
        });

        // ── Re-render canvas on window resize ──
        // The canvas element scales via CSS (width:100%), but we still
        // need to redraw to ensure the border/radius math stays accurate.
        window.addEventListener('resize', () => {
            if (els.sourceImg.src) requestRender();
        });
    }


    // =========================================================================
    // CORE LOGIC — VIDEO ID EXTRACTION
    // =========================================================================

    /**
     * extractVideoID(url)
     * Extracts the 11-character YouTube video ID from any valid YouTube URL format:
     *   - Standard watch: https://www.youtube.com/watch?v=XXXXXXXXXXX
     *   - Shorts:         https://www.youtube.com/shorts/XXXXXXXXXXX
     *   - Short URL:      https://youtu.be/XXXXXXXXXXX
     *   - Embed:          https://www.youtube.com/embed/XXXXXXXXXXX
     *   - Mobile:         https://m.youtube.com/watch?v=XXXXXXXXXXX
     *   - With timestamp: https://www.youtube.com/watch?v=XXXXXXXXXXX&t=30
     *
     * @param   {string}      url  — The raw URL string entered by the user.
     * @returns {string|null}      — 11-char video ID string, or null if not found.
     */
    function extractVideoID(url) {
        if (!url) return null;

        // Comprehensive regex matching all YouTube URL patterns that contain
        // the video ID in a consistent position after the path segment key.
        const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }


    // =========================================================================
    // PROCESS VIDEO — Main Fetch & Load Orchestration
    // =========================================================================

    /**
     * processVideo()
     * Entry point triggered by the "Fetch" button or Enter key.
     * Orchestration flow:
     *   1. Extract video ID from the URL input.
     *   2. Show the loading spinner, hide the workspace.
     *   3. Fire fetchMetadata() async (non-blocking — fills title/author in background).
     *   4. Attempt to load thumbnail at three quality levels in sequence:
     *        maxresdefault (4K) → sddefault (HD) → hqdefault (HQ)
     *   5. On success: set canvas dimensions, trigger initial render, add to history.
     *   6. On total failure: show error toast.
     *
     * @async
     */
    async function processVideo() {
        const url = els.urlInput.value.trim();
        const videoId = extractVideoID(url);

        // ── Validate input ──
        if (!videoId) {
            window.showToast('Invalid YouTube URL. Please try again.', true);
            return;
        }

        currentVideoID = videoId;
        toggleLoader(true); // Show spinner, hide workspace

        // Fire metadata fetch in the background (does not block image loading)
        fetchMetadata(videoId);

        // ── Quality fallback ladder ──
        // Try highest quality first; step down if the thumbnail doesn't exist.
        // YouTube returns a 120×90 placeholder for missing maxresdefault images.
        const qualityLevels = [
            { name: 'maxresdefault', badge: '4K ULTRA',   color: '#8e44ad' },
            { name: 'sddefault',     badge: 'HD STANDARD', color: '#2980b9' },
            { name: 'hqdefault',     badge: 'HQ BASIC',    color: '#7f8c8d' }
        ];

        let isLoaded = false;

        for (const level of qualityLevels) {
            try {
                // Attempt to load the image at this quality level via CORS proxy
                await loadImagePromise(videoId, level.name);

                // ── Success at this quality level ──
                isLoaded = true;
                els.qualityBadge.textContent        = level.badge;
                els.qualityBadge.style.background   = level.color;
                break; // Stop trying lower quality levels
            } catch (e) {
                // This quality level is unavailable — continue to next
                console.warn(`[Thumbnail Ultra Pro] Quality "${level.name}" unavailable for video: ${videoId}`);
            }
        }

        if (isLoaded) {
            // ── Set canvas buffer to match the image's native resolution ──
            // This ensures the exported file is the full original quality, not
            // scaled down to the CSS display size.
            els.canvas.width  = els.sourceImg.naturalWidth;
            els.canvas.height = els.sourceImg.naturalHeight;

            requestRender();   // Perform the initial canvas paint
            toggleLoader(false);

            // Save to history using the title fetched async (may be partial)
            addToHistory(videoId, els.vidTitle.textContent);

            // On mobile, auto-scroll to the workspace so the user sees the result
            if (window.innerWidth < 850) {
                els.workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            window.showToast('Thumbnail successfully loaded!');
        } else {
            // All quality levels failed — likely an invalid/private video
            toggleLoader(false);
            window.showToast('Error: Could not retrieve thumbnail. Check the URL or video privacy.', true);
        }
    }


    // =========================================================================
    // PROXY IMAGE LOADER
    // =========================================================================

    /**
     * loadImagePromise(id, quality)
     * Loads a YouTube thumbnail via the wsrv.nl public CORS proxy.
     *
     * WHY A PROXY?
     *   Calling canvas.toDataURL() on a canvas that has drawn a cross-origin
     *   image without proper CORS headers throws a SecurityError ("tainted canvas").
     *   wsrv.nl serves the image with `Access-Control-Allow-Origin: *`, allowing
     *   the canvas to remain untainted and enabling data export.
     *
     * PLACEHOLDER DETECTION:
     *   When a quality level doesn't exist, YouTube returns a 120×90 grey image
     *   rather than a 404. We detect this by checking naturalWidth === 120.
     *
     * @param   {string}  id       — 11-char YouTube video ID
     * @param   {string}  quality  — YouTube thumbnail quality key (e.g. 'maxresdefault')
     * @returns {Promise}           — Resolves on valid image load; rejects on error/placeholder.
     */
    function loadImagePromise(id, quality) {
        return new Promise((resolve, reject) => {
            const ytImgUrl  = `https://img.youtube.com/vi/${id}/${quality}.jpg`;
            const proxyUrl  = `https://wsrv.nl/?url=${encodeURIComponent(ytImgUrl)}`;

            // IMPORTANT: crossOrigin attribute MUST be set before assigning src.
            // Setting it after src may cause the browser to load without CORS headers.
            els.sourceImg.crossOrigin = 'anonymous';
            els.sourceImg.src         = proxyUrl;

            els.sourceImg.onload = function () {
                // YouTube's "missing thumbnail" placeholder is always 120px wide.
                // Treat it as a failure and try the next quality level.
                if (this.naturalWidth === 120) {
                    reject('Placeholder detected — quality level not available.');
                } else {
                    resolve(); // Valid full-size thumbnail loaded
                }
            };

            els.sourceImg.onerror = function () {
                reject('Network error — proxy request failed.');
            };
        });
    }


    // =========================================================================
    // METADATA FETCHING
    // =========================================================================

    /**
     * fetchMetadata(id)
     * Fetches the video's title and channel name via the public noembed.com API.
     * This is a non-blocking async call; the image loading does not wait for it.
     * Falls back gracefully to default strings if the API fails or times out.
     *
     * @async
     * @param {string} id — 11-char YouTube video ID
     */
    async function fetchMetadata(id) {
        els.vidTitle.textContent = 'Loading info...';

        try {
            const res  = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
            const data = await res.json();

            if (data.title) {
                // Populate DOM with fetched data
                els.vidTitle.textContent  = data.title;
                currentTitle              = data.title;         // Used in download filename
                els.vidAuthor.textContent = data.author_name;
                els.vidId.textContent     = id;
            } else {
                throw new Error('noembed returned no title field.');
            }
        } catch (e) {
            // Graceful fallback — tool remains functional even without metadata
            console.warn('[Thumbnail Ultra Pro] Metadata fetch failed:', e);
            els.vidTitle.textContent  = 'YouTube Video';
            currentTitle              = 'YouTube_Thumbnail';
            els.vidAuthor.textContent = 'Unknown Channel';
            els.vidId.textContent     = id;
        }
    }


    // =========================================================================
    // CANVAS RENDER ENGINE
    // =========================================================================

    /**
     * requestRender()
     * Debounces canvas repaint requests using requestAnimationFrame.
     * Cancels any pending frame before scheduling a new one to ensure
     * only one render happens per animation frame even if multiple sliders
     * fire events in rapid succession.
     */
    function requestRender() {
        if (renderReq) cancelAnimationFrame(renderReq);
        renderReq = requestAnimationFrame(renderCanvas);
    }

    /**
     * renderCanvas()
     * The core canvas painting function. Called once per animation frame.
     * Rendering pipeline:
     *   1. Clear the canvas buffer.
     *   2. Define a clipping path with rounded corners (via ctx.roundRect or fallback).
     *   3. Draw the source image with all CSS filter values applied.
     *   4. Optionally draw a colored border stroke inside the clipping path.
     *   5. Optionally draw a YouTube-style play button overlay on top.
     */
    function renderCanvas() {
        // Safety guard: do nothing if the source image has not loaded yet
        if (!els.sourceImg.complete || els.sourceImg.naturalWidth === 0) return;

        const ctx = els.ctx;
        const w   = els.canvas.width;
        const h   = els.canvas.height;

        // ── Collect all current control values ──
        const v = {
            bri   : els.inputs.bright.value,
            con   : els.inputs.contrast.value,
            sat   : els.inputs.sat.value,
            blur  : els.inputs.blur.value,
            sepia : els.inputs.sepia.value,
            gray  : els.inputs.gray.value,
            rad   : els.inputs.radius.value,    // Roundness percentage (0–50)
            bw    : els.inputs.borderW.value,   // Border width slider value (0–40)
            bc    : els.inputs.borderC.value,   // Border colour hex string
            play  : els.inputs.playBtn.checked  // Boolean: draw play button?
        };

        // ── Step 1: Clear the canvas ──
        ctx.clearRect(0, 0, w, h);
        ctx.save();

        // ── Step 2: Define rounded-corner clipping path ──
        // Corner radius is expressed as a percentage of image width (0–50%).
        // Border width is scaled proportionally to image size for consistent
        // visual weight regardless of the image's native resolution.
        const r = v.rad * (w / 100);         // Absolute radius in canvas pixels
        const b = v.bw * (w / 500);          // Scaled border thickness

        ctx.beginPath();

        // Use native roundRect if supported (Chrome 99+, Firefox 112+, Safari 15.4+)
        if (ctx.roundRect) {
            ctx.roundRect(b / 2, b / 2, w - b, h - b, r);
        } else {
            // Fallback for older browsers — no rounded corners but functionally correct
            ctx.rect(b / 2, b / 2, w - b, h - b);
        }

        ctx.clip(); // All subsequent drawing is clipped to this path

        // ── Step 3: Draw image with CSS filter string ──
        ctx.filter = `brightness(${v.bri}%) contrast(${v.con}%) saturate(${v.sat}%) blur(${v.blur}px) sepia(${v.sepia}%) grayscale(${v.gray}%)`;
        ctx.drawImage(els.sourceImg, 0, 0, w, h);
        ctx.restore(); // Pop clip so the border is drawn outside clip constraints

        // ── Step 4: Draw border (if width > 0) ──
        if (b > 0) {
            ctx.save();
            ctx.beginPath();

            if (ctx.roundRect) {
                ctx.roundRect(b / 2, b / 2, w - b, h - b, r);
            } else {
                ctx.rect(b / 2, b / 2, w - b, h - b);
            }

            ctx.lineWidth   = b;
            ctx.strokeStyle = v.bc;
            ctx.stroke();
            ctx.restore();
        }

        // ── Step 5: Draw YouTube play button overlay (if toggled on) ──
        if (v.play) drawPlayButton(ctx, w, h);
    }

    /**
     * drawPlayButton(ctx, w, h)
     * Renders a semi-transparent YouTube-style play button in the centre of
     * the canvas. Composed of a red rounded rectangle background and a white
     * right-pointing triangle (constructed from ctx.moveTo / lineTo geometry).
     *
     * Dimensions are proportional to the canvas size so the button looks
     * correct at any resolution (4K or thumbnail).
     *
     * @param {CanvasRenderingContext2D} ctx — Active 2D rendering context
     * @param {number}                  w   — Canvas width in pixels
     * @param {number}                  h   — Canvas height in pixels
     */
    function drawPlayButton(ctx, w, h) {
        ctx.save();
        ctx.filter = 'none'; // Reset any inherited filter from the image draw pass

        // ── Button rectangle geometry ──
        const btnW = w * 0.18;          // Button width: 18% of canvas width
        const btnH = btnW * 0.7;        // Button height: maintains YouTube aspect ratio (~0.7)
        const x    = (w - btnW) / 2;   // Horizontal centre
        const y    = (h - btnH) / 2;   // Vertical centre
        const rad  = btnH * 0.2;       // Corner radius: 20% of button height

        // ── Red rounded background ──
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.beginPath();

        if (ctx.roundRect) ctx.roundRect(x, y, btnW, btnH, rad);
        else               ctx.rect(x, y, btnW, btnH);

        ctx.fill();

        // ── White play triangle ──
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();

        const triH = btnH * 0.35;       // Half-height of the triangle
        const cx   = x + (btnW / 2);   // Triangle horizontal centre
        const cy   = y + (btnH / 2);   // Triangle vertical centre

        // Triangle vertices: top-left, right-point, bottom-left
        ctx.moveTo(cx - (triH / 1.5), cy - triH);  // Top-left vertex
        ctx.lineTo(cx + triH,          cy);          // Right-centre vertex (the "point")
        ctx.lineTo(cx - (triH / 1.5), cy + triH);  // Bottom-left vertex
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }


    // =========================================================================
    // UTILITIES — Label Updates, Filter Presets, Clipboard, Download
    // =========================================================================

    /**
     * updateLabels()
     * Reads the current value of every slider/input and updates the
     * corresponding live readout span next to each control's label.
     * Called on every 'input' event to give real-time numeric feedback.
     */
    function updateLabels() {
        els.labels.bright.innerText   = els.inputs.bright.value   + '%';
        els.labels.contrast.innerText = els.inputs.contrast.value + '%';
        els.labels.sat.innerText      = els.inputs.sat.value      + '%';
        els.labels.blur.innerText     = els.inputs.blur.value     + 'px';
        els.labels.sepia.innerText    = els.inputs.sepia.value    + '%';
        els.labels.gray.innerText     = els.inputs.gray.value     + '%';
        els.labels.rad.innerText      = els.inputs.radius.value   + '%';
        els.labels.border.innerText   = els.inputs.borderW.value  + 'px';
    }

    /**
     * applyVibrant()
     * Applies a one-click "Vibrant" preset that boosts saturation,
     * brightness, and contrast to create a punchy, eye-catching look.
     * Calls resetFilters() first to clear any previous custom adjustments,
     * then sets the vibrant values and triggers a re-render.
     */
    function applyVibrant() {
        resetFilters(false); // Clear existing settings without triggering a render

        els.inputs.sat.value      = 135; // Boosted saturation
        els.inputs.bright.value   = 108; // Slight brightness lift
        els.inputs.contrast.value = 108; // Slight contrast boost

        updateLabels();
        requestRender();
        window.showToast('✨ Vibrant Magic Applied!');
    }

    /**
     * resetFilters(shouldRender)
     * Resets all filter sliders, the border width/colour, and the play button
     * toggle back to their default values (no adjustments applied).
     *
     * @param {boolean} [shouldRender=true]
     *   Pass `false` when calling from applyVibrant() to avoid an unnecessary
     *   intermediate render before the vibrant values are applied.
     */
    function resetFilters(shouldRender = true) {
        els.inputs.bright.value   = 100;
        els.inputs.contrast.value = 100;
        els.inputs.sat.value      = 100;
        els.inputs.blur.value     = 0;
        els.inputs.sepia.value    = 0;
        els.inputs.gray.value     = 0;
        els.inputs.radius.value   = 0;
        els.inputs.borderW.value  = 0;
        els.inputs.borderC.value  = '#ffffff';
        els.inputs.playBtn.checked = false;

        updateLabels();
        if (shouldRender) requestRender();
    }

    /**
     * pasteLink()
     * Reads text from the system clipboard using the Clipboard API and
     * automatically populates the URL field and begins processing.
     * Falls back to a toast error if clipboard permission is denied.
     *
     * @async
     */
    async function pasteLink() {
        try {
            const text = await navigator.clipboard.readText();
            els.urlInput.value = text;
            processVideo();
        } catch (err) {
            window.showToast('Clipboard access denied. Please press Ctrl+V manually.', true);
        }
    }

    /**
     * copyText(elementId)
     * Copies the innerText of any DOM element (specified by ID) to the
     * system clipboard. Used by the metadata row copy buttons.
     *
     * @param {string} elementId — The ID of the element whose text to copy.
     */
    function copyText(elementId) {
        const text = document.getElementById(elementId).innerText;

        // Guard: don't copy empty or still-loading placeholder text
        if (!text || text.includes('Loading')) return;

        navigator.clipboard.writeText(text).then(
            ()  => window.showToast('Copied to Clipboard!'),
            ()  => window.showToast('Failed to copy to clipboard.', true)
        );
    }

    /**
     * downloadImage(format)
     * Exports the current canvas state as a downloadable image file.
     * The filename is sanitized from the video title + video ID to ensure
     * cross-OS file system compatibility.
     *
     * Supports three formats:
     *   - 'jpg'  → JPEG at quality 1.0 (maximum)
     *   - 'png'  → Lossless PNG
     *   - 'webp' → WebP at quality 1.0 (maximum)
     *
     * @param {string} format — One of 'jpg', 'png', 'webp'
     */
    function downloadImage(format) {
        // Guard: ensure an image has actually been loaded before exporting
        if (!currentVideoID || els.sourceImg.naturalWidth === 0) {
            window.showToast('No image loaded to download. Fetch a thumbnail first.', true);
            return;
        }

        // Sanitize the video title: keep only alphanumeric chars and underscores,
        // collapse multiple consecutive underscores, and cap at 50 characters.
        const safeTitle  = currentTitle
            .replace(/[^a-z0-9]/gi, '_')
            .replace(/_{2,}/g, '_')
            .substring(0, 50);

        const filename   = `Thumbnail_${safeTitle}_${currentVideoID}.${format}`;

        // Create a temporary anchor element and trigger a programmatic click
        // to initiate the browser's native file download dialog.
        const link       = document.createElement('a');
        link.download    = filename;

        // toDataURL quality param (1.0 = maximum) applies to JPEG and WebP.
        // PNG is always lossless and ignores the quality argument.
        link.href        = els.canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : format}`, 1.0);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.showToast(`Downloading ${format.toUpperCase()} — High Quality!`);
    }


    // =========================================================================
    // UI HELPERS
    // =========================================================================

    /**
     * toggleLoader(show)
     * Shows or hides the loading spinner and correspondingly shows/hides
     * the workspace grid. Prevents the user from seeing an empty canvas.
     *
     * @param {boolean} show — True to show spinner, false to reveal workspace.
     */
    function toggleLoader(show) {
        els.loader.style.display = show ? 'block' : 'none';

        if (show) {
            // Hide workspace while loading to avoid showing stale canvas content
            els.workspace.style.display = 'none';
        } else if (els.sourceImg.src) {
            // Only reveal workspace if an image has been assigned to the source
            els.workspace.style.display = 'grid';
        }
    }


    // =========================================================================
    // LOCAL STORAGE HISTORY
    // Stores the last 10 fetched video IDs for quick re-access via the
    // thumbnail history strip shown below the workspace.
    // =========================================================================

    /**
     * addToHistory(id, title)
     * Persists a video ID + title to the 'thumbHistory' localStorage key.
     * Deduplicates by removing any existing entry with the same ID before
     * prepending the new entry. Caps the list at 10 items.
     *
     * @param {string} id    — 11-char YouTube video ID
     * @param {string} title — Video title (used as alt/title text on the thumbnail)
     */
    function addToHistory(id, title) {
        let h = JSON.parse(localStorage.getItem('thumbHistory') || '[]');

        // Remove any duplicate entry for this video ID (deduplication)
        h = h.filter(x => x.id !== id);

        // Prepend the new entry at the front (most recent first)
        h.unshift({ id, title: title || 'Video' });

        // Keep only the most recent 10 entries to avoid unbounded growth
        if (h.length > 10) h.pop();

        localStorage.setItem('thumbHistory', JSON.stringify(h));
        loadHistory(); // Refresh the DOM strip immediately
    }

    /**
     * loadHistory()
     * Reads localStorage and renders the recently-fetched thumbnail strip.
     * Each thumbnail is rendered as an <img> tag with an onclick that
     * re-fills the URL field and re-triggers processVideo() automatically.
     * Hides the history section entirely if the list is empty.
     */
    function loadHistory() {
        const h = JSON.parse(localStorage.getItem('thumbHistory') || '[]');

        // Nothing to show — keep the section hidden
        if (h.length === 0) return;

        // Reveal the history strip
        els.historySection.style.display = 'block';

        // Build the thumbnail strip HTML
        // mqdefault (320×180) is used for the strip previews to keep them lightweight.
        els.historyList.innerHTML = h.map(x =>
            `<img class="history-thumb"
                  src="https://img.youtube.com/vi/${x.id}/mqdefault.jpg"
                  alt="${x.title}"
                  title="${x.title}"
                  onclick="document.getElementById('urlInput').value='https://youtu.be/${x.id}';app.processVideo()">`
        ).join('');
    }


    // =========================================================================
    // PUBLIC API
    // Only these methods are exposed to the global scope via the `app` variable.
    // All internal helpers remain private within the IIFE closure.
    // =========================================================================
    return {
        init,
        processVideo,
        pasteLink,
        applyVibrant,
        resetFilters,
        copyText,
        downloadImage
    };

})();

// ============================================================================
// BOOT
// Wait for the full DOM to be parsed before initialising the application.
// This ensures all getElementById() calls in the DOM cache resolve correctly.
// ============================================================================
document.addEventListener('DOMContentLoaded', app.init);
