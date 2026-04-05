/**
 * ============================================================================
 *  BULK URL TO XML SITEMAP GENERATOR — PRODUCTION SCRIPT
 *  Tool     : Bulk URL to XML Sitemap Generator
 *  Project  : Trusted Tools Web
 *  Author   : MD KAWSAR
 *  Version  : 2.0 (CodeCanyon Refactored Build)
 * ============================================================================
 *
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. WEB WORKER  (inline Blob worker)
 *     The entire URL parsing and XML assembly logic runs inside a dedicated
 *     Web Worker thread. This ensures the main UI thread never blocks, even
 *     when processing 50,000+ URLs. The worker is created from a Blob string,
 *     which removes the need for a separate worker .js file — ideal for
 *     distribution packages.
 *
 *  2. CLIENT-SIDE BLOB DOWNLOADS
 *     All file downloads (sitemap.xml, robots.txt) are generated on the
 *     client using the Blob + URL.createObjectURL API. No server contact is
 *     ever made — the user's URL data never leaves their browser.
 *
 *  3. LOCAL STORAGE — STATE PERSISTENCE
 *     The tool auto-saves the user's inputs (base URL, URL list, settings)
 *     to localStorage with a debounced 300 ms delay. This ensures that a
 *     browser refresh or accidental tab close does not cause data loss.
 *
 *  4. GLOBAL TOAST NOTIFICATIONS
 *     All user-facing feedback messages are sent via window.showToast(),
 *     which is provided by the global.js system. No local toast DOM elements
 *     or functions are used in this file.
 *
 *  TOAST USAGE CONVENTION (CodeCanyon standard)
 *  ─────────────────────────────────────────────────────────────────────────
 *  Success : window.showToast("Message")           → green toast
 *  Error   : window.showToast("Message", true)     → red/error toast
 *  Note    : Boolean `true` (not string "error") signals an error toast.
 * ============================================================================
 */


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1 — WEB WORKER SCRIPT (Inline Blob)
   ───────────────────────────────────────────────────────────────────────────
   The worker script is defined as a template-literal string so it can be
   instantiated via new Blob([workerScript]) without a separate file.

   Inside the worker (self context):
   ─ Receives: { rawText, baseUrl, lastModOpt, freq, prio, limit }
   ─ Sends  : { type: 'progress', percent: Number }  (every 500 lines)
               { type: 'done',    xml: String, stats: Object }  (final)
═══════════════════════════════════════════════════════════════════════════ */

const workerScript = `

    /**
     * self.onmessage — Entry point for the Web Worker.
     * Receives configuration from the main thread, processes every URL line,
     * builds the XML string, and posts progress updates + the final result.
     *
     * @param {MessageEvent} e - Contains:
     *   rawText   {string}  - The full textarea content (one URL/slug per line)
     *   baseUrl   {string}  - The validated base domain (e.g. https://example.com)
     *   lastModOpt{string}  - 'today' | 'none'  — whether to include <lastmod>
     *   freq      {string}  - <changefreq> value (monthly, weekly, daily, etc.)
     *   prio      {string}  - <priority> value (0.3 – 1.0)
     *   limit     {number}  - Maximum URL count (50,000 per Google protocol)
     */
    self.onmessage = function(e) {
        const { rawText, baseUrl, lastModOpt, freq, prio, limit } = e.data;

        // Statistics counters — reported back to the main thread
        const stats = { valid: 0, duplicates: 0, invalid: 0 };

        // ── Normalise the base URL ──────────────────────────────────────────
        // Strip trailing slash and ensure a proper scheme prefix so that
        // relative slugs (e.g. /about) can be concatenated cleanly.
        let cleanBase = baseUrl.trim();
        if (cleanBase.endsWith('/'))  cleanBase = cleanBase.slice(0, -1);
        if (!cleanBase.startsWith('http')) cleanBase = 'https://' + cleanBase;

        // ── Duplicate-detection set ─────────────────────────────────────────
        // Using a Set guarantees O(1) lookup even at 50k+ entries.
        const uniqueUrls = new Set();

        let xmlBody = "";
        const localDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // ── Split raw input into lines (handles \\r\\n and \\n) ────────────────
        const rawLines = rawText.split(/\\r?\\n/);
        const totalLines = rawLines.length;

        // ────────────────────────────────────────────────────────────────────
        // Helper: escapeXml
        // Replaces the five XML-reserved characters (<, >, &, ", ')
        // with their entity equivalents to produce well-formed XML output.
        // ────────────────────────────────────────────────────────────────────
        function escapeXml(unsafe) {
            return unsafe.replace(/[<>&"']/g, (c) => {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case '"': return '&quot;';
                    case "'": return '&apos;';
                }
            });
        }

        // ────────────────────────────────────────────────────────────────────
        // Helper: cleanUrl
        // Resolves an input token into a fully qualified URL string.
        // Handles three input formats:
        //   1. Relative path  : "/about"      → "https://example.com/about"
        //   2. Absolute URL   : "https://..."  → unchanged
        //   3. Bare domain    : "example.com/page" → "https://example.com/page"
        // CSV artifacts (surrounding quotes) are stripped first.
        // ────────────────────────────────────────────────────────────────────
        function cleanUrl(input) {
            // Strip surrounding quotes (common in CSV-exported files)
            let cleaned = input.replace(/^["']|["']$/g, '').trim();

            // Relative path: prepend the base domain
            if (cleaned.startsWith('/')) return cleanBase + cleaned;

            // Already fully qualified URL
            if (cleaned.match(/^http/i)) return cleaned;

            // Bare domain with path (e.g. "example.com/blog")
            if (!cleaned.startsWith('http') && cleaned.includes('.')) {
                return 'https://' + cleaned;
            }

            return cleaned;
        }

        // ────────────────────────────────────────────────────────────────────
        // Helper: isValidUrl
        // Uses the native URL constructor as the most reliable validator.
        // Returns false for any string that is not a valid http/https URL.
        // ────────────────────────────────────────────────────────────────────
        function isValidUrl(string) {
            try {
                const u = new URL(string);
                return u.protocol === "http:" || u.protocol === "https:";
            } catch (_) { return false; }
        }

        // ────────────────────────────────────────────────────────────────────
        // MAIN PROCESSING LOOP
        // Iterates over every non-empty line, resolves it to a full URL,
        // validates and deduplicates, then appends an <url> block to xmlBody.
        // Progress messages are posted every 500 lines to throttle IPC traffic.
        // ────────────────────────────────────────────────────────────────────
        for (let i = 0; i < totalLines; i++) {
            let line = rawLines[i].trim();

            // Skip blank lines
            if (!line) continue;

            // CSV handling: if a line contains a comma, only use the first field
            // (the URL). The rest (e.g. a date column) is intentionally ignored.
            if (line.includes(',')) line = line.split(',')[0];

            let fullUrl = cleanUrl(line);

            if (isValidUrl(fullUrl)) {
                try {
                    let uObj = new URL(fullUrl);

                    // Remove hash fragments — these are client-side only and
                    // have no meaning for search engine crawlers.
                    uObj.hash = '';
                    fullUrl = uObj.href;

                    if (uniqueUrls.has(fullUrl)) {
                        // Duplicate detected — count but skip
                        stats.duplicates++;
                    } else {
                        uniqueUrls.add(fullUrl);
                        stats.valid++;

                        // Append the <url> block to the XML body string
                        xmlBody += '   <url>\\n';
                        xmlBody += '      <loc>' + escapeXml(fullUrl) + '</loc>\\n';
                        if (lastModOpt === 'today') {
                            xmlBody += '      <lastmod>' + localDate + '</lastmod>\\n';
                        }
                        xmlBody += '      <changefreq>' + freq + '</changefreq>\\n';
                        xmlBody += '      <priority>' + prio + '</priority>\\n';
                        xmlBody += '   </url>\\n';
                    }
                } catch (e) {
                    // URL constructor threw — treat as invalid
                    stats.invalid++;
                }
            } else {
                stats.invalid++;
            }

            // Post a progress update every 500 lines (and on the final line)
            // to keep the main thread progress bar smooth without flooding IPC.
            if (i % 500 === 0 || i === totalLines - 1) {
                self.postMessage({
                    type    : 'progress',
                    percent : Math.round((i / totalLines) * 100)
                });
            }
        }

        // ── Assemble the final XML string ───────────────────────────────────
        // Wraps xmlBody with proper XML declaration and <urlset> root element
        // that includes the standard Sitemaps.org namespace declaration.
        let finalXml  = '<?xml version="1.0" encoding="UTF-8"?>\\n';
        finalXml     += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n';
        finalXml     += xmlBody;
        finalXml     += '</urlset>';

        // ── Post completion message to main thread ──────────────────────────
        self.postMessage({ type: 'done', xml: finalXml, stats: stats });
    };
`;


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2 — MAIN THREAD STATE
   ───────────────────────────────────────────────────────────────────────────
   Module-level variables shared across functions.
═══════════════════════════════════════════════════════════════════════════ */

/** @type {Worker|null} sitemapWorker — The active Web Worker instance */
let sitemapWorker = null;

/** @type {number} debounceTimer — setTimeout ID for the debounced input handler */
let debounceTimer;

/** @const {number} GOOGLE_LIMIT — Maximum URLs in a single sitemap per Sitemaps.org protocol */
const GOOGLE_LIMIT = 50000;


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3 — INITIALISATION
   ───────────────────────────────────────────────────────────────────────────
   Runs once the DOM is fully parsed. Restores saved state, updates the URL
   counter, spins up the Web Worker, and wires up event listeners.
═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // Restore any previously saved workspace from localStorage
    loadState();

    // Update the line-count badge to reflect restored data
    updateCounterUI();

    // Instantiate the Web Worker from the inline Blob script
    initWorker();

    // ── Event Listeners ─────────────────────────────────────────────────────

    /**
     * URL textarea input — triggers debounced counter update and state save.
     * Wired here in addition to the inline oninput attribute for robustness.
     */
    document.getElementById('urlInput').addEventListener('input', handleInput);

    /**
     * Base URL field change — triggers an immediate state save so the domain
     * is never lost between sessions.
     */
    document.getElementById('baseUrl').addEventListener('input', saveState);

});


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 4 — WEB WORKER MANAGEMENT
═══════════════════════════════════════════════════════════════════════════ */

/**
 * initWorker
 * ─────────────────────────────────────────────────────────────────────────
 * Creates a Web Worker from the inline `workerScript` string by converting
 * it to a Blob and then to an object URL. This technique avoids the need for
 * a separate worker file — essential for clean distribution packages.
 *
 * If the browser does not support Web Workers, an error toast is shown and
 * the tool degrades gracefully (generation will fail, but no crash occurs).
 */
function initWorker() {
    try {
        const blob    = new Blob([workerScript], { type: 'application/javascript' });
        sitemapWorker = new Worker(URL.createObjectURL(blob));

        // Route all incoming worker messages to the handler function
        sitemapWorker.onmessage = handleWorkerMessage;

        // Surface any unhandled worker errors as error toasts
        sitemapWorker.onerror = (e) => {
            window.showToast('Worker Error: ' + e.message, true);
        };

    } catch (err) {
        console.error('Sitemap Worker Init Failed:', err);
        window.showToast('This browser does not support background processing.', true);
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 5 — GENERATION FLOW
═══════════════════════════════════════════════════════════════════════════ */

/**
 * generateSitemap
 * ─────────────────────────────────────────────────────────────────────────
 * Called when the user clicks "Generate XML Sitemap".
 *
 * Flow:
 *  1. Read and validate all input values.
 *  2. Update the UI to a "loading / processing" state.
 *  3. Dispatch the work payload to the Web Worker.
 *
 * The worker runs asynchronously; handleWorkerMessage() handles the response.
 */
function generateSitemap() {
    // ── Reference the generate button (JS selects by class, matching HTML) ──
    const btn        = document.querySelector('.btn-primary');
    const rawText    = document.getElementById('urlInput').value.trim();
    let   baseUrl    = document.getElementById('baseUrl').value.trim();
    const lastModOpt = document.getElementById('lastMod').value;
    const freq       = document.getElementById('changeFreq').value;
    const prio       = document.getElementById('priority').value;

    // ── Input Validation ────────────────────────────────────────────────────
    if (!rawText) return window.showToast('Please enter at least one URL first!', true);
    if (!baseUrl) return window.showToast('Website Domain (Base URL) is required!', true);

    // Auto-prepend scheme if the user omitted it
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

    // Validate the resulting base URL string
    try {
        new URL(baseUrl);
    } catch (e) {
        return window.showToast('Invalid Base URL — please check the domain format.', true);
    }

    // ── UI: Enter Loading State ─────────────────────────────────────────────
    btn.disabled   = true;
    btn.innerHTML  = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    document.getElementById('progressBarContainer').style.display = 'block';
    document.getElementById('progressBar').style.width            = '1%';
    document.getElementById('statsBar').style.display             = 'none';

    // ── Dispatch Payload to Worker ──────────────────────────────────────────
    sitemapWorker.postMessage({
        rawText,
        baseUrl,
        lastModOpt,
        freq,
        prio,
        limit : GOOGLE_LIMIT
    });
}

/**
 * handleWorkerMessage
 * ─────────────────────────────────────────────────────────────────────────
 * Handles all messages posted back from the Web Worker:
 *
 *  • type === 'progress' → Update the progress bar fill percentage.
 *  • type === 'done'     → Render the XML output, update stats badges,
 *                          restore the generate button, and notify the user.
 *
 * @param {MessageEvent} e - Worker message event containing:
 *   { type: 'progress', percent: Number }  — for progress updates
 *   { type: 'done', xml: String, stats: Object }  — for the final result
 */
function handleWorkerMessage(e) {
    const data = e.data;

    if (data.type === 'progress') {
        // ── Progress Update: set progress bar fill width ──────────────────
        document.getElementById('progressBar').style.width = data.percent + '%';

    } else if (data.type === 'done') {
        const { xml, stats } = data;

        // ── Reference the generate button ──────────────────────────────────
        const btn = document.querySelector('.btn-primary');

        // ── Render XML Output ───────────────────────────────────────────────
        document.getElementById('xmlOutput').value = xml;

        // ── Render Statistics Badges ────────────────────────────────────────
        // toLocaleString() adds thousands separators (e.g. 10,000 not 10000)
        document.getElementById('statValid').innerText   = stats.valid.toLocaleString();
        document.getElementById('statDups').innerText    = stats.duplicates.toLocaleString();
        document.getElementById('statInvalid').innerText = stats.invalid.toLocaleString();

        // Show the stats bar (JS removes the d-none class by toggling display)
        document.getElementById('statsBar').style.display = 'flex';

        // ── Restore Button to Default State ────────────────────────────────
        btn.disabled  = false;
        btn.innerHTML = '<span class="btn-text"><i class="fa-solid fa-gears"></i> Generate XML Sitemap</span>';

        // Hide progress bar after a short delay so the user sees 100% briefly
        setTimeout(() => {
            document.getElementById('progressBarContainer').style.display = 'none';
            document.getElementById('progressBar').style.width            = '0%';
        }, 1000);

        // ── Auto-scroll on Mobile ───────────────────────────────────────────
        // On smaller viewports the output panel is below the input panel.
        // Scroll to it automatically so the user sees results without manual scrolling.
        if (window.innerWidth < 850) {
            document.querySelector('.sxg-panel:last-of-type')
                    ?.scrollIntoView({ behavior: 'smooth' });
        }

        // ── Result Notification & Warnings ─────────────────────────────────
        if (stats.valid > 0) {

            window.showToast('Sitemap Generated Successfully!');

            // Warn if the generated sitemap exceeds Google's 50,000 URL limit
            if (stats.valid > GOOGLE_LIMIT) {
                alert(
                    `⚠️ WARNING: Your sitemap contains ${stats.valid.toLocaleString()} URLs.\n\n` +
                    `Google limits a single sitemap file to 50,000 URLs.\n\n` +
                    `Please consider splitting this into multiple files and creating\n` +
                    `a Sitemap Index file to link them together.`
                );
            }

            // Persist the current state after a successful generation
            saveState();

        } else {
            // No valid URLs were found — inform the user
            window.showToast('No valid URLs found. Please check your input.', true);
        }
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 6 — INPUT HANDLING & COUNTER
═══════════════════════════════════════════════════════════════════════════ */

/**
 * handleInput
 * ─────────────────────────────────────────────────────────────────────────
 * Fired on every keystroke in the URL textarea (via oninput attribute and
 * the DOMContentLoaded event listener).
 *
 * Responsibilities:
 *  • Disable the generate button when the textarea is empty.
 *  • Debounce the counter update and state save to avoid excessive repaints
 *    and localStorage writes during rapid typing (300 ms delay).
 */
function handleInput() {
    const text = document.getElementById('urlInput').value;
    const btn  = document.querySelector('.btn-primary');

    // Disable generate button when the textarea is empty
    if (btn) btn.disabled = text.trim().length === 0;

    // Debounce: cancel any pending timer and start a new one
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        updateCounterUI();
        saveState();
    }, 300);
}

/**
 * updateCounterUI
 * ─────────────────────────────────────────────────────────────────────────
 * Counts the number of non-empty lines in the URL textarea and updates the
 * counter badge displayed above it.
 *
 * If the count exceeds Google's 50,000 URL limit, the badge turns red and
 * shows a warning tooltip to alert the user before generation.
 */
function updateCounterUI() {
    const text  = document.getElementById('urlInput').value;
    const count = text
        ? text.split(/\r?\n/).filter(line => line.trim().length > 0).length
        : 0;

    const counterEl = document.getElementById('urlCounter');
    counterEl.innerText = `${count.toLocaleString()} Lines`;

    // Visual warning when the Google 50k limit is exceeded
    if (count > GOOGLE_LIMIT) {
        counterEl.style.color  = 'var(--accent-red, #ff4757)';
        counterEl.title        = 'Warning: Exceeds Google 50,000 URL limit';
    } else {
        // Reset to default badge style
        counterEl.style.color  = '';
        counterEl.title        = '';
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 7 — FILE IMPORT
═══════════════════════════════════════════════════════════════════════════ */

/**
 * handleFileUpload
 * ─────────────────────────────────────────────────────────────────────────
 * Processes a user-selected .txt or .csv file and appends (or replaces)
 * its text content into the URL textarea.
 *
 * Behaviour:
 *  • Rejects files larger than 15 MB to prevent memory issues.
 *  • If the textarea already has content, the file content is appended on a
 *    new line rather than overwriting the existing data.
 *  • Clears the file input value after reading so the same file can be
 *    re-selected if needed.
 *
 * @param {HTMLInputElement} input - The file input element
 */
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Reject oversized files with an error toast
    if (file.size > 15 * 1024 * 1024) {
        return window.showToast('File is too large. Maximum size is 15 MB.', true);
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        const content  = e.target.result;
        const textArea = document.getElementById('urlInput');

        // Append if existing content is present; replace if textarea is empty
        textArea.value = textArea.value.trim()
            ? textArea.value + '\n' + content
            : content;

        // Trigger input handler to update counter and save state
        handleInput();

        window.showToast('File Imported Successfully!');

        // Clear the file input so the same file can be selected again
        input.value = '';
    };

    reader.readAsText(file);
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 8 — WORKSPACE MANAGEMENT
═══════════════════════════════════════════════════════════════════════════ */

/**
 * clearInput
 * ─────────────────────────────────────────────────────────────────────────
 * Resets the entire tool workspace after user confirmation:
 *  • Clears the URL textarea and the XML output textarea.
 *  • Hides the stats bar.
 *  • Removes the saved state from localStorage.
 *  • Resets the line counter badge.
 */
function clearInput() {
    if (!confirm('Clear current workspace? This cannot be undone.')) return;

    document.getElementById('urlInput').value    = '';
    document.getElementById('xmlOutput').value   = '';
    document.getElementById('statsBar').style.display = 'none';

    // Remove persisted state so a refresh also starts fresh
    localStorage.removeItem('sitemapState_v2');

    updateCounterUI();
    window.showToast('Workspace cleared.');
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 9 — EXPORT & DOWNLOAD FUNCTIONS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * downloadRobots
 * ─────────────────────────────────────────────────────────────────────────
 * Generates a minimal, SEO-standard robots.txt file that:
 *  • Allows all crawlers to access all pages (User-agent: * / Allow: /).
 *  • Declares the sitemap location using the base domain.
 *
 * Requires the base URL field to be filled in before calling.
 */
function downloadRobots() {
    let baseUrl = document.getElementById('baseUrl').value.trim();

    if (!baseUrl) {
        return window.showToast('Please enter the Base Domain first!', true);
    }

    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

    const content =
        `User-agent: *\n` +
        `Allow: /\n\n` +
        `Sitemap: ${baseUrl.replace(/\/$/, '')}/sitemap.xml`;

    downloadFile('robots.txt', content, 'text/plain');
}

/**
 * downloadXML
 * ─────────────────────────────────────────────────────────────────────────
 * Downloads the generated XML sitemap as a .xml file.
 *
 * The filename is derived from the base domain (e.g. sitemap_example.com.xml)
 * for easy identification when managing multiple sitemaps.
 * Falls back to "sitemap.xml" if the domain cannot be parsed.
 */
function downloadXML() {
    const content = document.getElementById('xmlOutput').value;

    if (!content) {
        return window.showToast('Please generate an XML sitemap first!', true);
    }

    // Attempt to build a domain-specific filename
    let filename = 'sitemap.xml';
    try {
        const domain = new URL(document.getElementById('baseUrl').value).hostname;
        if (domain) filename = `sitemap_${domain}.xml`;
    } catch (e) {
        // If URL parsing fails, the default "sitemap.xml" name is used
    }

    downloadFile(filename, content, 'text/xml');
}

/**
 * downloadFile (private helper)
 * ─────────────────────────────────────────────────────────────────────────
 * Creates a client-side Blob from the given text content, attaches it to a
 * temporary anchor element, and programmatically clicks it to trigger the
 * browser's native file download dialog.
 *
 * @param {string} filename - The suggested filename for the download
 * @param {string} content  - The file's text content
 * @param {string} type     - MIME type (e.g. 'text/xml', 'text/plain')
 */
function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const link = document.createElement('a');

    link.href     = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    // Notify the user that the download has been initiated
    window.showToast('Download Started!');
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 10 — CLIPBOARD FUNCTIONS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * copyCode
 * ─────────────────────────────────────────────────────────────────────────
 * Copies the generated XML content to the system clipboard.
 *
 * Strategy:
 *  1. Use the modern navigator.clipboard API (async, secure contexts).
 *  2. Fall back to the legacy document.execCommand('copy') for older browsers
 *     or non-secure HTTP contexts.
 */
function copyCode() {
    const code = document.getElementById('xmlOutput').value;

    if (!code) {
        return window.showToast('Nothing to copy — generate a sitemap first!', true);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        // Modern Clipboard API (preferred)
        navigator.clipboard.writeText(code)
            .then(() => window.showToast('Copied to Clipboard!'))
            .catch(() => fallbackCopy(code));  // Fallback on permission error
    } else {
        fallbackCopy(code);
    }
}

/**
 * fallbackCopy (private helper)
 * ─────────────────────────────────────────────────────────────────────────
 * Legacy clipboard copy using a temporary off-screen textarea and the
 * deprecated document.execCommand('copy') approach.
 * Used as a fallback for browsers that do not support the Clipboard API.
 *
 * @param {string} text - The text content to copy
 */
function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;

    // Position off-screen so the element is invisible to the user
    ta.style.position = 'fixed';
    ta.style.top      = '-9999px';
    ta.style.left     = '-9999px';

    document.body.appendChild(ta);
    ta.select();

    try {
        document.execCommand('copy');
        window.showToast('Copied to Clipboard!');
    } catch (e) {
        window.showToast('Copy failed — please copy manually.', true);
    }

    document.body.removeChild(ta);
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 11 — STATE PERSISTENCE (localStorage)
═══════════════════════════════════════════════════════════════════════════ */

/**
 * saveState
 * ─────────────────────────────────────────────────────────────────────────
 * Serialises the current tool configuration and URL list to localStorage
 * under the key 'sitemapState_v2'. Called on every input event (debounced)
 * and after successful generation.
 *
 * Also flashes a brief "Saved" indicator next to the textarea to provide
 * visual confirmation that the auto-save has occurred.
 */
function saveState() {
    const state = {
        baseUrl : document.getElementById('baseUrl').value,
        urls    : document.getElementById('urlInput').value,
        lastMod : document.getElementById('lastMod').value,
        freq    : document.getElementById('changeFreq').value,
        prio    : document.getElementById('priority').value
    };

    localStorage.setItem('sitemapState_v2', JSON.stringify(state));

    // Flash the auto-save indicator for 2 seconds
    const ind = document.getElementById('autoSaveIndicator');
    if (ind) {
        ind.innerText = 'Saved';
        setTimeout(() => { ind.innerText = ''; }, 2000);
    }
}

/**
 * loadState
 * ─────────────────────────────────────────────────────────────────────────
 * Reads the previously saved state from localStorage and restores all input
 * field values. Called once during DOMContentLoaded.
 *
 * Uses optional chaining on each field to safely handle partially saved
 * states (e.g. if the user cleared some fields before closing the tab).
 */
function loadState() {
    const saved = localStorage.getItem('sitemapState_v2');
    if (!saved) return;

    try {
        const s = JSON.parse(saved);

        if (s.baseUrl) document.getElementById('baseUrl').value    = s.baseUrl;
        if (s.urls)    document.getElementById('urlInput').value   = s.urls;
        if (s.lastMod) document.getElementById('lastMod').value    = s.lastMod;
        if (s.freq)    document.getElementById('changeFreq').value = s.freq;
        if (s.prio)    document.getElementById('priority').value   = s.prio;

    } catch (e) {
        // Corrupted or unreadable saved state — silently discard
        console.warn('Sitemap Generator: Could not restore saved state.', e);
    }
}
