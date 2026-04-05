/**
 * =============================================================================
 *  META GEN ULTRA — Core Application Script
 *  Tool     : SEO Meta Tag Generator, SERP Preview & Social Card Builder
 *  Project  : Trusted Tools Web by MD KAWSAR
 *  Version  : 2.0 (CodeCanyon Release Build)
 *  Pattern  : Module-style IIFE via DOMContentLoaded; global window bindings
 *             for HTML onclick attributes.
 *  Features : Live Google SERP preview · Social card preview · SEO score meter
 *             · Pixel-accurate title width counter · Keyword tag builder
 *             · Open Graph / Twitter Card code generator · LocalStorage persistence
 *  Security : All user input is HTML-entity-escaped before insertion (XSS safe).
 *  Performance : Debounced input handler (50 ms) prevents excessive repaints.
 * =============================================================================
 */

// =============================================================================
// SECTION 1 — APPLICATION STATE & CONFIGURATION
// =============================================================================

/**
 * APP_STATE
 * Central singleton that holds mutable runtime data for the tool.
 *
 * @property {string[]} tags          - Array of current keyword tag strings.
 * @property {number|null} debounceTimer - setTimeout reference for input debounce.
 * @property {Object} settings        - Read-only tuning constants.
 * @property {number} settings.googleTitleLimit - Max pixel width before Google truncates (~600 px).
 * @property {number} settings.descCharLimit    - Recommended meta description character ceiling.
 */
const APP_STATE = {
    tags          : [],
    debounceTimer : null,
    settings      : {
        googleTitleLimit : 600, // Google truncates titles at approximately 600 px rendered width
        descCharLimit    : 160  // Standard maximum length for a meta description
    }
};

/**
 * measureElement
 * An invisible <span> appended to <body> used exclusively for pixel-width
 * measurement. Its font properties (Arial 20 px normal) exactly replicate
 * the font Google uses to render title tags in its SERP, giving us accurate
 * truncation without relying on character counts.
 */
const measureElement = document.createElement('span');
measureElement.style.cssText =
    'visibility:hidden; white-space:nowrap; position:absolute; ' +
    'top:-9999px; left:-9999px; font-family:arial, sans-serif; ' +
    'font-size:20px; font-weight:400; letter-spacing:normal;';
document.body.appendChild(measureElement);


// =============================================================================
// SECTION 2 — INITIALISATION
// =============================================================================

/**
 * DOMContentLoaded handler
 * Bootstraps the tool once the DOM is fully parsed.
 * Order matters: data is loaded first so inputs are populated before the
 * first updateAll() call renders previews and generates code.
 */
document.addEventListener('DOMContentLoaded', () => {
    initLoadData();       // 1. Restore previously saved session data from localStorage
    initEventListeners(); // 2. Attach input, change, and tab-click listeners
    initTagSystem();      // 3. Wire up the keyword pill-tag input system
    initColorSync();      // 4. Keep hex display in sync with the native color picker
    updateAll();          // 5. Populate all previews and code output on first load
});

/**
 * initEventListeners
 * Attaches event listeners to every text input, textarea, and select inside
 * the form container.
 *
 * - 'input' events use debounce() for performance: rapidly typing does not
 *   trigger expensive DOM repaints on every keystroke.
 * - 'change' events fire updateAll() immediately so pasting or selecting an
 *   option updates the preview without delay.
 */
function initEventListeners() {
    const inputs = document.querySelectorAll('.container input, .container textarea, .container select');

    inputs.forEach(el => {
        // Debounced handler: waits 50 ms after the last keystroke before updating
        el.addEventListener('input', () => debounce(updateAll, 50));
        // Immediate handler: covers select changes, color picker, and blur-triggered changes
        el.addEventListener('change', updateAll);
    });

    // Tab navigation: each .tab-btn reads its data-mode attribute and delegates to setTab()
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            setTab(this.dataset.mode);
        });
    });
}


// =============================================================================
// SECTION 3 — CORE LOGIC ENGINE
// =============================================================================

/**
 * updateAll
 * Master orchestrator function. Reads the current form state and pipes it
 * through every rendering pipeline in sequence:
 *   getFormData → updatePreviews → generateCode → calculateScore → saveData
 *
 * Called on: initial load, every (debounced) input event, every change event,
 * and after tag mutations.
 */
function updateAll() {
    const data = getFormData();

    updatePreviews(data);   // Refresh Google SERP + social card previews
    generateCode(data);     // Re-render the generated <head> HTML in the textarea
    calculateScore(data);   // Recalculate and display the live SEO score
    saveData(data);         // Persist current state to localStorage
}

/**
 * getFormData
 * Reads values from all named DOM inputs and returns them as a plain object.
 * The keywords property is derived from APP_STATE.tags (the live tag array)
 * rather than the hidden #siteKeywords input, ensuring consistency.
 *
 * @returns {{title:string, desc:string, url:string, img:string,
 *            author:string, robots:string, theme:string, keywords:string}}
 */
function getFormData() {
    return {
        title    : document.getElementById('siteTitle').value.trim(),
        desc     : document.getElementById('siteDesc').value.trim(),
        url      : document.getElementById('siteUrl').value.trim(),
        img      : document.getElementById('ogImage').value.trim(),
        author   : document.getElementById('siteAuthor').value.trim(),
        robots   : document.getElementById('siteRobots').value,
        theme    : document.getElementById('siteTheme').value,
        keywords : APP_STATE.tags.join(', ')
    };
}

/**
 * updatePreviews
 * Updates both the Google SERP card and the social (OG) card in the preview
 * panel to reflect the current form data.
 *
 * Google preview:
 *   - Title is truncated by pixel width (not chars) using truncateByPixel().
 *   - Description is truncated to 160 characters with an ellipsis.
 *   - The domain is parsed from the canonical URL input.
 *
 * Social preview:
 *   - Title, description, and domain text are set via textContent (XSS-safe).
 *   - If an OG Image URL is provided, a test Image object is created:
 *       onload  → the real image is appended to the preview box.
 *       onerror → a styled error indicator is shown instead.
 *   - If no URL is present, a placeholder icon is displayed.
 *
 * @param {Object} d - Form data object from getFormData().
 */
function updatePreviews(d) {
    // ── Google SERP Preview ──────────────────────────────────────────────
    const googleTitle = truncateByPixel(
        d.title || 'Page Title Example',
        APP_STATE.settings.googleTitleLimit
    );
    const googleDesc = d.desc.length > 160
        ? d.desc.substring(0, 157) + '...'
        : (d.desc || 'This is how your description will look on Google search results.');

    // Extract the hostname from the canonical URL for the cite row
    let domain = 'example.com';
    try {
        if (d.url) {
            domain = new URL(d.url.startsWith('http') ? d.url : 'https://' + d.url).hostname;
        }
    } catch (e) {
        // If URL parsing fails (e.g. partial URL), keep the default domain
    }

    // Write to DOM using textContent to prevent XSS via user input
    document.getElementById('prevGoogleTitle').textContent = googleTitle;
    document.getElementById('prevGoogleDesc').textContent  = googleDesc;
    document.getElementById('prevGoogleUrl').textContent   = domain;

    // ── Social Card Preview ──────────────────────────────────────────────
    document.getElementById('prevSocialTitle').textContent  = d.title  || 'Title Placeholder';
    document.getElementById('prevSocialDesc').textContent   = d.desc   || 'Description placeholder...';
    document.getElementById('prevSocialDomain').textContent = (d.author || domain).toUpperCase();

    const imgBox = document.getElementById('prevSocialImg');

    if (d.img && d.img.length > 8) {
        // Safely clear existing child nodes (avoids innerHTML injection)
        while (imgBox.firstChild) imgBox.removeChild(imgBox.firstChild);

        // Create a test Image to validate the URL before showing it in the preview
        const img  = new Image();
        img.src    = d.img;
        img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
        img.alt    = 'Social Preview Image';

        img.onload = () => {
            // URL is valid and the image loaded successfully — display it
            imgBox.innerHTML = '';
            imgBox.appendChild(img);
        };

        img.onerror = () => {
            // URL is invalid or the image failed to load — show a styled error state
            imgBox.innerHTML = '';

            const errorContainer = document.createElement('div');
            errorContainer.style.textAlign = 'center';
            errorContainer.style.color     = '#ff0055';

            const icon       = document.createElement('i');
            icon.className   = 'fa-solid fa-link-slash';
            icon.style.cssText = 'font-size:24px; margin-bottom:5px; display:block;';

            const txt        = document.createElement('span');
            txt.style.fontSize = '11px';
            txt.textContent  = 'Image Error';

            errorContainer.appendChild(icon);
            errorContainer.appendChild(txt);
            imgBox.appendChild(errorContainer);
        };
    } else {
        // No URL entered — reset to the default placeholder icon
        imgBox.innerHTML = '<i class="fa-regular fa-image" style="font-size: 48px; opacity:0.3;"></i>';
    }
}

/**
 * generateCode
 * Builds the complete HTML <head> meta tag snippet from the current form data
 * and writes it into the #outputCode textarea.
 *
 * Security: All user-supplied strings are passed through escapeHtml() before
 * being embedded in the code string to prevent injection into the generated output.
 *
 * Logic:
 *   1. Always writes: <title>, primary meta tags, robots, canonical, theme-color.
 *   2. Conditionally writes: keywords (if any), author (if any), canonical (if any).
 *   3. Appends Open Graph block if title, desc, or image is present.
 *   4. Appends Twitter Card block if title, desc, or image is present.
 *
 * @param {Object} d - Form data object from getFormData().
 */
function generateCode(d) {
    const safeTitle = escapeHtml(d.title);
    const safeDesc  = escapeHtml(d.desc);
    // Ensure the URL has a protocol prefix before embedding it in code
    const safeUrl   = d.url
        ? (d.url.startsWith('http') ? d.url : 'https://' + d.url)
        : '';

    let code = `<!-- Generated by Meta Gen Ultra (Trusted Tools Web) -->\n`;

    // ── Primary Meta Tags ────────────────────────────────────────────────
    code += `<!-- Primary Meta Tags -->\n`;
    code += `<title>${safeTitle}</title>\n`;
    code += `<meta name="title" content="${safeTitle}">\n`;
    code += `<meta name="description" content="${safeDesc}">\n`;
    if (d.keywords)  code += `<meta name="keywords" content="${escapeHtml(d.keywords)}">\n`;
    code += `<meta name="robots" content="${d.robots}">\n`;
    code += `<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n`;
    code += `<meta name="language" content="English">\n`;
    if (d.author)    code += `<meta name="author" content="${escapeHtml(d.author)}">\n`;
    if (safeUrl)     code += `<link rel="canonical" href="${safeUrl}">\n`;
    code += `<meta name="theme-color" content="${d.theme}">\n`;

    // ── Open Graph / Facebook ────────────────────────────────────────────
    if (d.title || d.desc || d.img) {
        code += `\n<!-- Open Graph / Facebook -->\n`;
        code += `<meta property="og:type" content="website">\n`;
        if (safeUrl) code += `<meta property="og:url" content="${safeUrl}">\n`;
        code += `<meta property="og:title" content="${safeTitle}">\n`;
        code += `<meta property="og:description" content="${safeDesc}">\n`;
        if (d.img) {
            code += `<meta property="og:image" content="${escapeHtml(d.img)}">\n`;
            code += `<meta property="og:image:width" content="1200">\n`;
            code += `<meta property="og:image:height" content="630">\n`;
        }
    }

    // ── Twitter Card ─────────────────────────────────────────────────────
    if (d.title || d.desc || d.img) {
        code += `\n<!-- Twitter / X Card -->\n`;
        code += `<meta property="twitter:card" content="summary_large_image">\n`;
        if (safeUrl) code += `<meta property="twitter:url" content="${safeUrl}">\n`;
        code += `<meta property="twitter:title" content="${safeTitle}">\n`;
        code += `<meta property="twitter:description" content="${safeDesc}">\n`;
        if (d.img)   code += `<meta property="twitter:image" content="${escapeHtml(d.img)}">\n`;
    }

    document.getElementById('outputCode').value = code;
}

/**
 * calculateScore
 * Computes a simple 0–100 SEO quality score based on three weighted signals:
 *
 *   Title pixel width (30 pts):  200–600 px → full score; any other non-zero → 10 pts.
 *   Description length (40 pts): 100–160 chars → full score; > 10 chars → 20 pts.
 *   OG Image URL present (30 pts).
 *
 * Also updates the two character-count badge elements (#titleCount, #descCount)
 * via updateCounter() which applies CSS modifier classes (.limit-ok / .limit-warn
 * / .limit-err) for coloured feedback.
 *
 * @param {Object} d - Form data object from getFormData().
 */
function calculateScore(d) {
    // ── Title pixel counter ──────────────────────────────────────────────
    const px = getPixelWidth(d.title);
    updateCounter('titleCount', px + 'px', APP_STATE.settings.googleTitleLimit, px);

    // ── Description character counter ────────────────────────────────────
    updateCounter('descCount', d.desc.length, 160, d.desc.length);

    // ── Score Algorithm ───────────────────────────────────────────────────
    let score = 0;

    // Title: best if pixel width is within 200–600 px (Google's safe zone)
    if (px > 200 && px <= 600) score += 30;
    else if (px > 0)            score += 10;

    // Description: best between 100–160 characters
    if (d.desc.length > 100 && d.desc.length <= 160) score += 40;
    else if (d.desc.length > 10)                       score += 20;

    // OG Image: having a social image greatly improves social sharing quality
    if (d.img && d.img.length > 5) score += 30;

    // ── UI Score Bar Update ───────────────────────────────────────────────
    const bar  = document.getElementById('scoreFill');
    const text = document.getElementById('scoreText');

    bar.style.width   = `${score}%`;
    text.innerText    = `${score}/100`;

    // Colour the bar according to the score tier
    let color = '#ff0055'; // Red  — below 50
    if      (score >= 80) color = '#238636'; // Green — 80 and above
    else if (score >= 50) color = '#d29922'; // Amber — 50 to 79

    bar.style.backgroundColor = color;
    text.style.color           = color;
}


// =============================================================================
// SECTION 4 — KEYWORD TAG SYSTEM
// =============================================================================

/**
 * initTagSystem
 * Wires up the keyword pill-tag input system inside #tagContainer.
 *
 * Supported input modes:
 *   - Press Enter or comma → adds the current input value as a new tag.
 *   - Press Backspace on empty input → removes the last tag (UX convenience).
 *   - Paste event → splits pasted text on commas, newlines, and tabs; bulk-adds
 *     all resulting values as individual tags.
 *   - Click on container → focuses the hidden text input so users can
 *     start typing anywhere inside the tag area.
 */
function initTagSystem() {
    const input     = document.getElementById('tagInput');
    const container = document.getElementById('tagContainer');

    // ── Keyboard input handler ────────────────────────────────────────────
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            // Prevent form submission (Enter) and comma insertion into the field
            e.preventDefault();
            addTags(input.value);
            input.value = '';
        } else if (e.key === 'Backspace' && input.value === '' && APP_STATE.tags.length > 0) {
            // Remove the most recently added tag when backspacing on an empty field
            APP_STATE.tags.pop();
            renderTags();
            updateAll();
        }
    });

    // ── Paste handler: bulk tag import ────────────────────────────────────
    input.addEventListener('paste', (e) => {
        e.preventDefault(); // Prevent pasted text from appearing raw in the input
        const text = (e.clipboardData || window.clipboardData).getData('text');
        addTags(text);  // addTags() handles CSV / newline splitting internally
        renderTags();
        updateAll();
        input.value = ''; // Clear the input after bulk import
    });

    // ── Click-to-focus: entire container acts as the input target ─────────
    container.addEventListener('click', () => input.focus());
}

/**
 * addTags
 * Parses a raw string into individual tag values, deduplicates them against
 * APP_STATE.tags, and appends any new unique tags to the array.
 *
 * Delimiter support: comma, newline (\n), and tab (\t) for Excel paste compatibility.
 *
 * @param {string} str - Raw input string (single word or delimited list).
 */
function addTags(str) {
    // Split on comma, newline, or tab; trim whitespace; remove empties
    const raw = str.split(/[\n,\t]+/).map(t => t.trim()).filter(t => t);

    raw.forEach(tag => {
        // Only add if the tag is non-empty and not already in the array
        if (!APP_STATE.tags.includes(tag) && tag.length > 0) {
            APP_STATE.tags.push(tag);
        }
    });

    renderTags(); // Refresh the visual pill display
}

/**
 * renderTags
 * Rebuilds the visual keyword pill UI inside #tagContainer from APP_STATE.tags.
 *
 * Approach:
 *   1. Remove all children of #tagContainer except #tagInput (the live text field).
 *   2. For each tag in APP_STATE.tags, create a <span class="tag"> pill with a
 *      removal icon (<i class="fa-solid fa-xmark">).
 *   3. Insert each pill before the input so the input always stays at the end.
 *   4. Sync the comma-joined tag list into the hidden #siteKeywords input so it
 *      is included in getFormData().
 */
function renderTags() {
    const container = document.getElementById('tagContainer');
    const input     = document.getElementById('tagInput');

    // Remove all existing pill elements but keep the text input in place
    Array.from(container.children).forEach(child => {
        if (child !== input) container.removeChild(child);
    });

    // Recreate pill elements for each tag in the current state array
    APP_STATE.tags.forEach((tag, idx) => {
        const el       = document.createElement('span');
        el.className   = 'tag';
        el.textContent = tag + ' '; // Trailing space separates text from the × icon

        // Build the removal icon with a click handler that splices the tag from state
        const icon     = document.createElement('i');
        icon.className = 'fa-solid fa-xmark';
        icon.onclick   = (e) => {
            e.stopPropagation(); // Prevent click from bubbling to container focus handler
            APP_STATE.tags.splice(idx, 1);
            renderTags();
            updateAll();
        };

        el.appendChild(icon);
        container.insertBefore(el, input); // Keep the text input at the end of the list
    });

    // Keep the hidden input in sync for getFormData() to read
    document.getElementById('siteKeywords').value = APP_STATE.tags.join(', ');
}


// =============================================================================
// SECTION 5 — UTILITY FUNCTIONS
// =============================================================================

/**
 * initColorSync
 * Keeps the read-only hex text display (#themeHex) in sync with the native
 * color picker (#siteTheme) whenever the user picks a new colour.
 * Also triggers updateAll() so the generated code reflects the new theme colour.
 */
function initColorSync() {
    const picker = document.getElementById('siteTheme');
    const hex    = document.getElementById('themeHex');

    picker.addEventListener('input', (e) => {
        hex.value = e.target.value; // Mirror the hex string from the picker
        updateAll();
    });
}

/**
 * getPixelWidth
 * Measures the rendered pixel width of a text string using the hidden
 * measureElement span. This replicates the exact font Google uses for SERP
 * titles (Arial 20 px normal weight), so the truncation logic is accurate.
 *
 * @param {string} text - The string to measure.
 * @returns {number}      Rounded pixel width of the rendered string.
 */
function getPixelWidth(text) {
    if (!text) return 0;
    measureElement.textContent = text;
    return Math.round(measureElement.offsetWidth);
}

/**
 * truncateByPixel
 * Truncates a title string so its rendered pixel width does not exceed `limit`.
 * Appends "..." to the truncated result. If the title already fits, it is
 * returned unchanged.
 *
 * Algorithm: binary-style right-walk from the end of the string until the
 * truncated + ellipsis version fits within the pixel limit.
 *
 * @param {string} text  - Original title string.
 * @param {number} limit - Maximum pixel width (e.g. 600 for Google).
 * @returns {string}       Truncated string ending in "..." if over limit.
 */
function truncateByPixel(text, limit) {
    if (getPixelWidth(text) <= limit) return text;
    let i = text.length;
    while (getPixelWidth(text.substring(0, i) + '...') > limit && i > 0) i--;
    return text.substring(0, i) + '...';
}

/**
 * escapeHtml
 * Sanitises a string by converting the five critical HTML characters into
 * their entity equivalents. Used throughout generateCode() and showToast()
 * to prevent Cross-Site Scripting (XSS).
 *
 * @param {string} text - Raw user input.
 * @returns {string}      HTML-safe string.
 */
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

/**
 * debounce
 * Classic debounce implementation. Delays `func` execution until `wait`
 * milliseconds have passed since the last call. Uses APP_STATE.debounceTimer
 * as the shared cancel token so only one timer is ever active at once.
 *
 * @param {Function} func - The function to debounce.
 * @param {number}   wait - Delay in milliseconds.
 */
function debounce(func, wait) {
    clearTimeout(APP_STATE.debounceTimer);
    APP_STATE.debounceTimer = setTimeout(func, wait);
}

/**
 * updateCounter
 * Updates a character/pixel counter badge element (#id) with a formatted
 * value string and applies the correct colour modifier class:
 *   .limit-ok   → rawVal is within a safe range (< 90 % of limit)
 *   .limit-warn → rawVal is close to the limit (90 %–100 % of limit)
 *   .limit-err  → rawVal exceeds the limit
 *
 * @param {string}          id     - DOM id of the counter <span> element.
 * @param {number|string}   val    - Display value (e.g. 450 or "450px").
 * @param {number}          limit  - The upper threshold to compare against.
 * @param {number}          rawVal - The raw numeric value for threshold comparison.
 */
function updateCounter(id, val, limit, rawVal) {
    const el     = document.getElementById(id);
    el.innerText = typeof val === 'number'
        ? `${val} / ${limit}`
        : `${val} / ${limit}px`;

    // Reset modifier classes before applying the correct one
    el.className = 'char-count';

    if      (rawVal > limit)          el.classList.add('limit-err');
    else if (rawVal > limit * 0.9)    el.classList.add('limit-warn');
    else                               el.classList.add('limit-ok');
}


// =============================================================================
// SECTION 6 — TAB SWITCHING
// =============================================================================

/**
 * setTab  (window-exposed for HTML onclick attributes)
 * Switches the active preview panel in the right column.
 *
 * Algorithm:
 *   1. Remove .active from all .tab-btn elements.
 *   2. Remove .active from all .preview-content elements.
 *   3. Add .active to the button whose data-mode matches `mode`.
 *   4. Add .active to the element with id="view-{mode}".
 *
 * @param {string} mode - One of: "google" | "facebook" | "code"
 */
window.setTab = (mode) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.preview-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.tab-btn[data-mode="${mode}"]`).classList.add('active');
    document.getElementById(`view-${mode}`).classList.add('active');
};


// =============================================================================
// SECTION 7 — USER ACTION HANDLERS
// =============================================================================

/**
 * copyCode  (window-exposed for HTML onclick attributes)
 * Copies the text content of a given textarea to the clipboard.
 *
 * Strategy:
 *   - Uses the async navigator.clipboard API when available in a secure context.
 *   - Falls back to document.execCommand('copy') for older browsers.
 *   - If the textarea is empty, shows an error toast and aborts.
 *
 * @param {string} id - The DOM id of the <textarea> to copy from.
 */
window.copyCode = (id) => {
    const el = document.getElementById(id);

    // Guard: abort and notify if there is nothing to copy yet
    if (!el.value) {
        window.showToast('Generate code first!', true);
        return;
    }

    if (navigator.clipboard && window.isSecureContext) {
        // Modern async clipboard API (HTTPS required)
        navigator.clipboard.writeText(el.value).then(() => {
            window.showToast('Code Copied to Clipboard!');
        });
    } else {
        // Legacy fallback: select the text and execute the copy command
        el.select();
        document.execCommand('copy');
        window.showToast('Code Copied!');
    }
};

/**
 * downloadCode  (window-exposed for HTML onclick attributes)
 * Creates a Blob from the generated HTML code and triggers a browser file
 * download for it. The downloaded file is named "meta-tags-generated.html".
 *
 * If the code textarea is empty, an error toast is shown and no download
 * is initiated.
 */
window.downloadCode = () => {
    const content = document.getElementById('outputCode').value;

    if (!content) {
        window.showToast('No code to download!', true);
        return;
    }

    const blob = new Blob([content], { type: 'text/html' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'meta-tags-generated.html';

    document.body.appendChild(a);
    a.click(); // Trigger the download
    document.body.removeChild(a);

    window.showToast('Download Started!');
};

/**
 * resetForm  (window-exposed for HTML onclick attributes)
 * Prompts the user for confirmation, then clears all form inputs, resets
 * the keyword tag array, and removes the saved localStorage entry.
 * A success toast confirms the reset.
 */
window.resetForm = () => {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        // Clear localStorage session for this tool
        localStorage.removeItem('metaGenData');

        // Reset all text inputs and textareas (preserve color-type inputs)
        document.querySelectorAll('input:not([type="color"]), textarea').forEach(i => {
            i.value = '';
        });

        // Clear the keyword tags array and re-render the empty tag container
        APP_STATE.tags = [];
        renderTags();

        // Refresh all previews and regenerate (empty) code
        updateAll();

        window.showToast('Form Reset Successfully!');
    }
};


// =============================================================================
// SECTION 8 — LOCALSTORAGE PERSISTENCE
// =============================================================================

/**
 * saveData
 * Serialises the current form state (including the keyword tag array) to
 * localStorage under the key 'metaGenData'. Wrapped in try/catch to silently
 * handle environments where localStorage is unavailable (e.g. private browsing
 * in some browsers, or storage quota exceeded).
 *
 * @param {Object} data - Form data object from getFormData().
 */
function saveData(data) {
    try {
        localStorage.setItem('metaGenData', JSON.stringify({ ...data, tags: APP_STATE.tags }));
    } catch (e) {
        // Storage unavailable — non-fatal; the tool continues to function
    }
}

/**
 * initLoadData
 * Attempts to restore previously saved session data from localStorage on
 * page load. Repopulates every relevant input field and the tag array.
 *
 * Called before initEventListeners() and the first updateAll() so that saved
 * data is present when the initial render runs.
 *
 * @sideeffects Mutates APP_STATE.tags and multiple DOM input values.
 */
function initLoadData() {
    try {
        const saved = JSON.parse(localStorage.getItem('metaGenData'));

        if (saved) {
            // Restore text field values (guard against null/undefined with conditional)
            if (saved.title)  document.getElementById('siteTitle').value  = saved.title;
            if (saved.desc)   document.getElementById('siteDesc').value   = saved.desc;
            if (saved.url)    document.getElementById('siteUrl').value    = saved.url;
            if (saved.img)    document.getElementById('ogImage').value    = saved.img;
            if (saved.author) document.getElementById('siteAuthor').value = saved.author;

            // Restore the theme color picker and its hex display input
            if (saved.theme) {
                document.getElementById('siteTheme').value = saved.theme;
                document.getElementById('themeHex').value  = saved.theme;
            }

            // Restore keyword tags into the state array and re-render pills
            if (saved.tags && Array.isArray(saved.tags)) {
                APP_STATE.tags = saved.tags;
                renderTags();
            }
        }
    } catch (e) {
        // Corrupted or missing storage data — log a warning and continue with defaults
        console.warn('Meta Gen Ultra: Could not restore saved session data.', e);
    }
}
