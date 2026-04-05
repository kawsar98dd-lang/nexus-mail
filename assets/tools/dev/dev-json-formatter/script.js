/**
 * =============================================================================
 *  ULTRA JSON PRO MAX — CORE MODULE
 *  File    : script.js
 *  Version : 3.2.0 (CodeCanyon Release Build — Documented)
 *  Author  : MD KAWSAR
 * -----------------------------------------------------------------------------
 *  Description:
 *  Handles 100% client-side JSON parsing, validation, formatting, and
 *  visualisation inside the Trusted Tools Web platform.
 *
 *  Architecture:
 *  The entire module is wrapped in an IIFE (Immediately Invoked Function
 *  Expression) and exposed as the global constant `UltraJSON`. This pattern
 *  prevents any variable from polluting the global namespace while still
 *  allowing HTML onclick attributes to call public methods.
 *
 *  Key capabilities:
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │  • Beautify / Format (2-space or 4-space indent)                        │
 *  │  • Minify (zero-indent stringify)                                        │
 *  │  • Auto-Fix (Regex heuristics for JS-Object → JSON conversion)          │
 *  │  • Syntax highlighting via DOM manipulation                              │
 *  │  • Collapsible Tree View (recursive DOM node builder)                    │
 *  │  • Grid / Table View (virtual-DOM table renderer, max 500 rows)         │
 *  │  • XML Conversion (recursive tag builder)                                │
 *  │  • CSV Conversion (flat key extraction across array of objects)          │
 *  │  • File Upload (.json / .txt / .csv via FileReader API)                  │
 *  │  • URL Fetch (live JSON from any CORS-enabled API endpoint)              │
 *  │  • Local History (up to 8 entries persisted in localStorage)             │
 *  │  • Session Restore (last edited JSON persisted across page reloads)      │
 *  │  • Global Toast notifications (via window.showToast — no local toast)    │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 *  Dependencies:
 *  • global.js  → Must be loaded first; provides window.showToast().
 *  • Font Awesome (icons referenced in inline HTML strings within JS).
 * =============================================================================
 */

const UltraJSON = (() => {

    /* =========================================================================
     * SECTION 1: DOM CACHE
     * All frequently accessed DOM nodes are cached once at module load time.
     * This avoids repeated document.getElementById() calls during hot paths
     * such as the debounced input handler and the recursive tree renderer.
     * ========================================================================= */

    /**
     * DOM — Cached references to every interactive element in the tool.
     * @type {Object}
     */
    const DOM = {
        /** Raw JSON input textarea */
        input       : document.getElementById('jsonInput'),

        /** Syntax-highlighted formatted output container (Code tab) */
        codeOutput  : document.getElementById('jsonOutput'),

        /** Collapsible tree view container (Tree tab) */
        treeOutput  : document.getElementById('treeOutput'),

        /** Tabular data table container (Grid tab) */
        tableOutput : document.getElementById('tableOutput'),

        /** Validation status indicator in the Output panel header */
        statusIcon  : document.getElementById('statusIcon'),

        /** Live byte/KB size readout in the Input panel header */
        sizeStat    : document.getElementById('sizeStat'),

        /** Inline syntax-error banner between toolbar and editor grid */
        errorBox    : document.getElementById('errorBox'),

        /** NodeList of all three output tab buttons (Code / Tree / Grid) */
        tabs        : document.querySelectorAll('.panel-tab'),

        /** Container for history pill buttons */
        historyList : document.getElementById('historyList')
    };

    /* =========================================================================
     * SECTION 2: MODULE STATE
     * A single plain-object store tracks all mutable runtime state.
     * Centralising state here makes the flow easy to reason about and test.
     * ========================================================================= */

    /**
     * state — Runtime state for the current editing session.
     * @property {any}     data      - The most recently parsed JSON value (object / array / primitive).
     * @property {number}  rawSize   - Size of the current raw input string in bytes.
     * @property {boolean} isValid   - Whether the current input parses without error.
     * @property {string}  activeTab - Which output tab is currently visible ('code'|'tree'|'table').
     */
    let state = {
        data      : null,
        rawSize   : 0,
        isValid   : false,
        activeTab : 'code'
    };

    /* =========================================================================
     * SECTION 3: INITIALISATION
     * init() is called once when the DOM is fully ready.
     * It attaches all permanent event listeners and attempts to restore the
     * user's previous session from localStorage.
     * ========================================================================= */

    /**
     * init
     * Bootstraps the module: registers event listeners, restores last session,
     * and renders the local-history strip.
     *
     * Called automatically via: document.addEventListener('DOMContentLoaded', init)
     */
    function init() {

        /* ── Debounced input listener ──────────────────────────────────────────
         * Fires handleInput() 600 ms after the user stops typing.
         * Debouncing prevents the UI from freezing when large JSON blocks are
         * pasted character-by-character (e.g. from a slow remote clipboard).
         */
        DOM.input.addEventListener('input', debounce(() => handleInput(true), 600));

        /* ── Tab-key indentation support ───────────────────────────────────────
         * Normally the Tab key moves focus away from a textarea. This listener
         * intercepts Tab and inserts 4 spaces at the caret position instead,
         * giving the textarea editor-like indentation behaviour.
         */
        DOM.input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();

                const start = DOM.input.selectionStart;
                const end   = DOM.input.selectionEnd;

                /* Insert 4 spaces and reposition the caret */
                DOM.input.value =
                    DOM.input.value.substring(0, start) +
                    '    ' +
                    DOM.input.value.substring(end);

                DOM.input.selectionStart = DOM.input.selectionEnd = start + 4;
            }
        });

        /* ── Session restore ────────────────────────────────────────────────────
         * On each page load, check localStorage for JSON the user was editing
         * in a previous session. If found and small enough (< 100 KB), auto-
         * format it immediately. Larger payloads are loaded into the textarea
         * without formatting so the page remains responsive.
         */
        try {
            const saved = localStorage.getItem('ultraJsonData');
            if (saved) {
                DOM.input.value = saved;

                if (saved.length < 100000) {
                    /* File is small — safe to parse and render immediately */
                    handleInput(false);
                    processJSON(4);
                } else {
                    /* Large file — just update the size stat without parsing */
                    updateSizeStat(saved);
                }
            }

            /* Always render the history strip, even if session data is absent */
            renderHistory();

        } catch (e) {
            /* localStorage may be disabled in private-browsing modes */
            console.warn('[UltraJSON] localStorage unavailable:', e.message);
        }
    }

    /* =========================================================================
     * SECTION 4: INPUT HANDLER
     * Reacts to every change in the raw JSON textarea.
     * Responsible for: byte-size tracking, localStorage persistence, and
     * lightweight (non-rendering) validation status update.
     * ========================================================================= */

    /**
     * handleInput
     * Processes a change to the raw input textarea without rendering output.
     * Updates the size stat, conditionally persists to localStorage, and
     * sets the validation status icon to Valid / Invalid / Ready.
     *
     * @param {boolean} [save=true] - When true, persists raw text to localStorage
     *                                (skipped if the payload exceeds 5 MB to
     *                                prevent QuotaExceededError).
     */
    function handleInput(save = true) {
        const raw    = DOM.input.value;
        state.rawSize = new Blob([raw]).size;

        /* Update the byte/KB counter in the panel header */
        updateSizeStat(raw);

        /* Persist to localStorage — hard 5 MB cap to avoid storage errors */
        if (save && state.rawSize < 5 * 1024 * 1024) {
            try {
                localStorage.setItem('ultraJsonData', raw);
            } catch (e) {
                /* Storage quota exceeded — silently skip persistence */
            }
        }

        /* Empty input → reset to idle state */
        if (!raw.trim()) {
            state.data               = null;
            setStatus('ready');
            DOM.errorBox.style.display = 'none';
            return;
        }

        /* Quick parse to update the status icon (no rendering) */
        try {
            JSON.parse(raw);
            setStatus('valid');
            DOM.errorBox.style.display = 'none';
        } catch (e) {
            setStatus('invalid');
        }
    }

    /* =========================================================================
     * SECTION 5: MAIN PROCESSOR — FORMAT & RENDER
     * The central workhorse of the tool. Parses the raw textarea, runs
     * JSON.stringify with the requested indent level, and triggers all three
     * view renderers (Code, Tree, Grid).
     * ========================================================================= */

    /**
     * processJSON
     * Parses the raw input, formats it with the specified indent, and
     * renders all three output views (Code, Tree, Grid).
     *
     * Performance note: A 50 ms setTimeout is used to yield to the browser's
     * rendering engine so the spinner appears before the heavy parse begins.
     * For payloads > 500 KB, syntax highlighting is skipped (textContent only)
     * to prevent Chrome/Firefox from freezing on very large highlight loops.
     *
     * @param {number} indent - JSON.stringify spacing:
     *                          0  → minified (no whitespace)
     *                          2  → 2-space formatted
     *                          4  → 4-space beautified
     */
    function processJSON(indent) {
        const raw = DOM.input.value.trim();

        if (!raw) {
            /* Nothing to process — alert the user */
            window.showToast('Please paste or upload JSON data first.');
            return;
        }

        /* Show a spinner so the user knows work is in progress */
        DOM.codeOutput.innerHTML =
            '<div style="padding:20px; color:var(--brand-secondary)">' +
            '<i class="fa-solid fa-spinner fa-spin"></i> Processing…</div>';

        /* Yield to the UI thread so the spinner frame renders */
        setTimeout(() => {
            try {
                const parsed   = JSON.parse(raw);
                state.data     = parsed;
                state.isValid  = true;

                /* ── 1. Render Code View ──────────────────────────────────────── */
                if (indent === 0) {
                    /* Minified: single line, no whitespace */
                    DOM.codeOutput.textContent = JSON.stringify(parsed);
                } else {
                    const formatted = JSON.stringify(parsed, null, indent);

                    /* Skip syntax highlighting for large payloads to stay responsive */
                    if (formatted.length > 500000) {
                        DOM.codeOutput.textContent = formatted;
                    } else {
                        DOM.codeOutput.innerHTML = syntaxHighlight(formatted);
                    }
                }

                /* ── 2. Render Secondary Views ───────────────────────────────── */
                renderTree(parsed);
                renderTable(parsed);

                /* ── 3. Finalise State ───────────────────────────────────────── */
                setStatus('valid');
                DOM.errorBox.style.display = 'none';

                /* Add a history entry for the parsed payload */
                addToHistory(parsed);

                /* Always land on the Code tab after a successful parse */
                switchTab('code');

            } catch (e) {
                /* Parsing failed — display the inline error and a toast */
                showError(e);
                DOM.codeOutput.textContent = '';
            }
        }, 50);
    }

    /* =========================================================================
     * SECTION 6: AUTO-FIX ENGINE
     * Applies a series of Regex transformations to convert common JavaScript
     * object literals into valid JSON. Covers the most frequent copy-paste
     * mistakes developers encounter when moving data between JS and JSON.
     * ========================================================================= */

    /**
     * autoFixJSON
     * Attempts to repair the raw input using Regex heuristics and re-renders
     * the output. If the input is already valid or cannot be fixed further,
     * the user is informed via the global toast.
     *
     * Transformations applied (in order):
     *  1. Remove single-line comments (//)
     *  2. Remove block comments (/* … * /)
     *  3. Replace single quotes with double quotes
     *  4. Strip trailing commas before ] or }
     *  5. Wrap unquoted object keys in double quotes
     *  6. Remove a trailing semicolon
     */
    function autoFixJSON() {
        let raw = DOM.input.value.trim();
        if (!raw) return;

        let fixed = raw
            /* Remove JS single-line comments */
            .replace(/\/\/.*$/gm, '')
            /* Remove JS block comments */
            .replace(/\/\*[\s\S]*?\*\//g, '')
            /* Swap single quotes to double quotes */
            .replace(/'/g, '"')
            /* Remove trailing commas before closing brackets */
            .replace(/,\s*([\]}])/g, '$1')
            /* Add double quotes around unquoted object keys */
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
            /* Remove trailing semicolon */
            .replace(/;\s*$/, '');

        if (fixed !== raw) {
            /* At least one transformation was applied — update the textarea */
            DOM.input.value = fixed;
            handleInput();

            try {
                processJSON(4);
                DOM.errorBox.style.display = 'none';

                /* Flash the button label to confirm success */
                const btn  = document.querySelector('button[onclick="UltraJSON.autoFixJSON()"]');
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Fixed!';
                setTimeout(() => btn.innerHTML = orig, 2000);

            } catch (e) {
                showError(e);
                window.showToast('Auto-Fix applied partial fixes, but JSON is still invalid. Check the error log.', true);
            }

        } else {
            /* No transformations were needed */
            window.showToast('No standard syntax errors detected. JSON may already be valid.');
        }
    }

    /* =========================================================================
     * SECTION 7: VISUALISATION ENGINES
     * Three independent renderers: syntax-highlighted Code view, collapsible
     * Tree view, and a tabular Grid view. Each renders into its own container.
     * ========================================================================= */

    /* ── 7-A: Tree View Renderer ──────────────────────────────────────────── */

    /**
     * renderTree
     * Clears the tree output container and kicks off the recursive node builder.
     *
     * @param {any} data - The parsed JSON value to visualise as a tree.
     */
    function renderTree(data) {
        DOM.treeOutput.innerHTML = '';
        DOM.treeOutput.appendChild(createTreeNodes(data));
    }

    /**
     * createTreeNodes
     * Recursively converts a parsed JSON value into a collapsible <ul>/<li>
     * DOM structure. Objects and arrays become expandable branches; primitive
     * values become leaf nodes with colour-coded type classes.
     *
     * @param {any} obj - The current node to convert (can be any JSON value).
     * @returns {HTMLElement} A <ul> element containing the rendered nodes.
     */
    function createTreeNodes(obj) {
        const ul = document.createElement('ul');

        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

            const li      = document.createElement('li');
            const val     = obj[key];
            const safeKey = escapeHtml(key);

            if (val !== null && typeof val === 'object') {
                /* Branch node — object or array → render as collapsible */
                const isArray = Array.isArray(val);
                const size    = Object.keys(val).length;

                /* Triangle toggle button */
                const toggle = document.createElement('span');
                toggle.className = 'caret';
                toggle.innerHTML = '&#9654;'; /* ▶ right-pointing triangle */

                toggle.onclick = function () {
                    /* Rotate triangle and reveal/hide children */
                    this.classList.toggle('caret-down');
                    this.parentElement.querySelector('.nested').classList.toggle('active-tree');
                };

                /* Key label with child count summary */
                const label = document.createElement('span');
                label.innerHTML =
                    `<span class="json-key">${safeKey}</span>: ` +
                    `<span style="color:var(--text-muted); font-size:0.8em">` +
                    `${isArray ? `Array[${size}]` : 'Object'}</span>`;

                li.appendChild(toggle);
                li.appendChild(label);

                /* Recursively build child nodes and mark as collapsible */
                const nested      = createTreeNodes(val);
                nested.className  = 'nested';
                li.appendChild(nested);

            } else {
                /* Leaf node — primitive value → display with type colour class */
                let typeClass = 'json-string';
                if (typeof val === 'number')  typeClass = 'json-number';
                if (typeof val === 'boolean') typeClass = 'json-boolean';
                if (val === null)             typeClass = 'json-null';

                li.innerHTML =
                    `<span style="display:inline-block; width:14px;"></span>` +
                    `<span class="json-key">${safeKey}</span>: ` +
                    `<span class="${typeClass}">${escapeHtml(val)}</span>`;
            }

            ul.appendChild(li);
        }

        return ul;
    }

    /* ── 7-B: Grid / Table View Renderer ─────────────────────────────────── */

    /**
     * renderTable
     * Renders parsed JSON as an HTML table inside the Grid tab.
     * Accepts both a plain object (wrapped in an array) and an array of
     * objects. Caps rendering at 500 rows for browser performance safety.
     *
     * @param {any} data - The parsed JSON value to tabulate.
     */
    function renderTable(data) {
        DOM.tableOutput.innerHTML = '';

        /* Normalise input: wrap a plain object in an array so the table
         * renderer always works with an array of rows. */
        const dataArray = Array.isArray(data)
            ? data
            : (typeof data === 'object' && data !== null ? [data] : null);

        /* Guard: table view only makes sense for arrays of objects */
        if (!dataArray || !dataArray.length ||
            typeof dataArray[0] !== 'object' || dataArray[0] === null) {
            DOM.tableOutput.innerHTML =
                '<div style="padding:40px; text-align:center; color:var(--text-muted)">' +
                'Grid view requires an Object or Array of Objects.</div>';
            return;
        }

        /* Performance guard: browsers lag when rendering > 2 000 complex DOM nodes */
        const MAX_ROWS    = 500;
        const displayData = dataArray.slice(0, MAX_ROWS);

        /* Build the HTML table string */
        let html = '<div class="table-responsive"><table class="data-table"><thead><tr>';
        const keys = Object.keys(dataArray[0]);

        /* Column headers derived from the first object's keys */
        keys.forEach(k => html += `<th>${escapeHtml(k)}</th>`);
        html += '</tr></thead><tbody>';

        /* Data rows — nested objects are collapsed to "[Object]" for readability */
        displayData.forEach(row => {
            html += '<tr>';
            keys.forEach(k => {
                let val = row[k];
                if (typeof val === 'object' && val !== null) val = '[Object]';
                html += `<td>${escapeHtml(String(val !== undefined ? val : ''))}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        /* Append a truncation notice when the dataset exceeds the row cap */
        if (dataArray.length > MAX_ROWS) {
            html +=
                `<div style="padding:10px; background:rgba(210,153,34,0.1); ` +
                `color:#d29922; font-size:12px; text-align:center;">` +
                `Showing first ${MAX_ROWS} rows. Download CSV for full data.</div>`;
        }

        DOM.tableOutput.innerHTML = html;
    }

    /* =========================================================================
     * SECTION 8: CONVERTERS — XML & CSV
     * Transform the currently parsed JSON value into alternative formats
     * and display the result in the Code view.
     * ========================================================================= */

    /**
     * convertToXML
     * Converts the parsed JSON object/array into an XML document string.
     * Uses a recursive helper that sanitises property names to valid XML tags
     * and escapes all text content. The result replaces the Code view output.
     */
    function convertToXML() {
        /* Ensure we have parsed data; attempt parse if not */
        if (!state.data) return processJSON(4);
        if (!state.isValid) return;

        /**
         * jsonToXml (inner recursive helper)
         * Converts a JS object to an XML fragment string.
         *
         * @param {Object} obj - The object to serialise.
         * @returns {string}   - An XML fragment (no root element wrapper).
         */
        const jsonToXml = (obj) => {
            let xml = '';

            for (let prop in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, prop)) continue;

                /* Sanitise property names: replace invalid XML chars, prefix digits */
                let tag = String(prop).replace(/[^a-zA-Z0-9-_]/g, '_');
                if (/^\d/.test(tag)) tag = '_' + tag;

                if (Array.isArray(obj[prop])) {
                    /* Array: emit one tag per item */
                    for (let item of obj[prop]) {
                        xml += `<${tag}>${
                            (typeof item === 'object' && item !== null)
                                ? jsonToXml(item)
                                : escapeHtml(item)
                        }</${tag}>`;
                    }
                } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                    /* Nested object: recurse */
                    xml += `<${tag}>${jsonToXml(obj[prop])}</${tag}>`;
                } else {
                    /* Primitive: escape and wrap */
                    xml += `<${tag}>${escapeHtml(obj[prop])}</${tag}>`;
                }
            }

            return xml;
        };

        /* Wrap the recursive output in an XML declaration and root element */
        DOM.codeOutput.textContent =
            '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n' +
            jsonToXml(state.data) +
            '\n</root>';

        switchTab('code');
    }

    /**
     * convertToCSV
     * Flattens an array of objects into a comma-separated values string.
     * Column headers are derived from the union of all keys across every row
     * so sparse datasets are handled correctly. Values are double-quoted and
     * internal double-quotes are escaped per RFC 4180.
     *
     * Requirement: The JSON root must be an array of objects. A single object
     * is auto-wrapped. Primitive arrays or deeply nested structures are
     * rejected with a toast message.
     */
    function convertToCSV() {
        /* Attempt parse if we don't yet have data */
        if (!state.data) return processJSON(4);

        const data = Array.isArray(state.data) ? state.data : [state.data];

        if (!data[0] || typeof data[0] !== 'object') {
            window.showToast('CSV conversion requires an array of objects. Nested or primitive arrays are not supported.', true);
            return;
        }

        /* Collect all unique keys across every row (handles sparse rows) */
        const keys = new Set();
        data.forEach(o => Object.keys(o).forEach(k => keys.add(k)));
        const headers = Array.from(keys);

        /* Build the CSV string: header row + data rows */
        const csv = [
            headers.join(','),
            ...data.map(row =>
                headers.map(k => {
                    let val = (row[k] === null || row[k] === undefined) ? '' : String(row[k]);
                    /* Escape internal double-quotes per RFC 4180 */
                    val = val.replace(/"/g, '""');
                    return `"${val}"`;
                }).join(',')
            )
        ].join('\n');

        DOM.codeOutput.textContent = csv;
        switchTab('code');
    }

    /* =========================================================================
     * SECTION 9: I/O — FILE UPLOAD, URL FETCH, DOWNLOAD, CLIPBOARD
     * ========================================================================= */

    /**
     * downloadResult
     * Creates a Blob from the current Code view text content and triggers a
     * browser download. The filename includes a Unix timestamp to prevent
     * collisions when downloading multiple times in one session.
     */
    function downloadResult() {
        const content = DOM.codeOutput.textContent;

        if (!content) {
            window.showToast('Nothing to save. Please process your JSON first.');
            return;
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = `ultra_json_${Date.now()}.txt`;
        a.click();

        /* Revoke the object URL to free memory after the download is triggered */
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    /**
     * copyToClipboard
     * Copies the current Code view text content to the system clipboard using
     * the modern Clipboard API. Briefly changes the button label to "Copied"
     * to provide haptic confirmation.
     */
    function copyToClipboard() {
        const text = DOM.codeOutput.textContent;
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            /* Visual confirmation: swap button label for 2 seconds */
            const btn      = document.querySelector('button[onclick="UltraJSON.copyToClipboard()"]');
            const original = btn.innerHTML;
            btn.innerHTML  = '<i class="fa-solid fa-check"></i> Copied';
            setTimeout(() => btn.innerHTML = original, 2000);
        }).catch(() => {
            window.showToast('Clipboard access denied. Please copy manually.', true);
        });
    }

    /**
     * handleFileUpload
     * Reads the selected file using the FileReader API and loads its content
     * into the raw input textarea, then immediately processes it.
     * Accepts .json, .txt, and .csv extensions (set on the file input).
     *
     * @param {HTMLInputElement} input - The file <input> element that triggered the change event.
     */
    function handleFileUpload(input) {
        const file = input.files[0];
        if (!file) return;

        const reader    = new FileReader();
        reader.onload   = (e) => {
            DOM.input.value = e.target.result;
            handleInput();
            processJSON(4);
        };
        reader.onerror  = () => {
            window.showToast('File read failed. Please try a different file.', true);
        };
        reader.readAsText(file);
    }

    /**
     * fetchFromUrl
     * Fetches JSON from a user-supplied URL using the native fetch API.
     * A spinner is shown on the button while the request is in-flight.
     * On success the response JSON is pretty-printed into the editor.
     * On failure a descriptive toast is shown.
     *
     * Note: The target URL must serve CORS-permissive headers. Requests to
     * same-origin or CORS-blocked endpoints will throw a TypeError.
     */
    async function fetchFromUrl() {
        const url = document.getElementById('urlInput').value.trim();
        if (!url) return;

        const btn  = document.querySelector('button[onclick="UltraJSON.fetchFromUrl()"]');
        const orig = btn.innerHTML;

        /* Show spinner while waiting for the network response */
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const res  = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

            const json = await res.json();
            DOM.input.value = JSON.stringify(json, null, 4);
            handleInput();
            processJSON(4);

        } catch (e) {
            window.showToast('Fetch Failed: ' + e.message, true);
        } finally {
            /* Always restore the original button label */
            btn.innerHTML = orig;
        }
    }

    /* =========================================================================
     * SECTION 10: SAMPLE DATA LOADER
     * ========================================================================= */

    /**
     * loadSample
     * Populates the editor with a representative sample JSON payload so new
     * users can immediately see the formatting, tree, and grid features in action.
     */
    function loadSample() {
        const sample = {
            'app'        : 'Ultra JSON Pro',
            'version'    : 3.0,
            'commercial' : true,
            'features'   : ['Validation', 'Minification', 'Visualisation'],
            'config'     : { 'theme': 'auto', 'offline': true },
            'users'      : [
                { 'id': 1, 'role': 'admin',  'active': true  },
                { 'id': 2, 'role': 'editor', 'active': false }
            ]
        };

        DOM.input.value = JSON.stringify(sample, null, 4);
        handleInput();
        processJSON(4);
    }

    /* =========================================================================
     * SECTION 11: CLEAR ALL
     * ========================================================================= */

    /**
     * clearAll
     * Prompts the user for confirmation, then wipes both the editor and all
     * localStorage entries created by this tool. The history strip is
     * re-rendered to show the empty state.
     */
    function clearAll() {
        if (confirm('Clear editor and local history?')) {
            DOM.input.value          = '';
            DOM.codeOutput.textContent = '';
            DOM.treeOutput.innerHTML   = '';
            DOM.tableOutput.innerHTML  = '';
            state.data                 = null;

            setStatus('ready');

            /* Remove both localStorage keys used by this tool */
            localStorage.removeItem('ultraJsonData');
            localStorage.removeItem('ultraJsonHist');

            renderHistory();
        }
    }

    /* =========================================================================
     * SECTION 12: LOCAL HISTORY
     * Maintains a ring buffer of up to 8 recently processed JSON entries in
     * localStorage. Each entry stores a short snippet label, the full payload,
     * and the timestamp at which it was processed.
     * ========================================================================= */

    /**
     * addToHistory
     * Prepends a new history entry to the ring buffer and re-renders the strip.
     * Duplicate consecutive entries (same full payload) are silently ignored.
     * The buffer is capped at 8 entries; the oldest is dropped when full.
     *
     * @param {any} data - The parsed JSON value to store.
     */
    function addToHistory(data) {
        try {
            let h   = JSON.parse(localStorage.getItem('ultraJsonHist') || '[]');
            const str = JSON.stringify(data);

            /* Prevent duplicate consecutive entries */
            if (h.length && h[0].full === str) return;

            /* Build a short human-readable snippet label */
            let snip = Array.isArray(data)
                ? `Array[${data.length}]`
                : `{${Object.keys(data)[0] || 'Empty'}…}`;

            /* Prepend and enforce the 8-item cap */
            h.unshift({ snip, full: str, time: new Date().toLocaleTimeString() });
            if (h.length > 8) h.pop();

            localStorage.setItem('ultraJsonHist', JSON.stringify(h));
            renderHistory();

        } catch (e) {
            /* localStorage may throw on private-browsing or quota exceeded */
        }
    }

    /**
     * renderHistory
     * Reads the history ring buffer from localStorage and rebuilds the pill
     * button strip. If the buffer is empty, a "No recent files" message is shown.
     */
    function renderHistory() {
        const h = JSON.parse(localStorage.getItem('ultraJsonHist') || '[]');

        if (!h.length) {
            DOM.historyList.innerHTML =
                '<small style="color:var(--text-muted)">No recent files.</small>';
            return;
        }

        /* Render one compact pill button per history entry */
        DOM.historyList.innerHTML = h.map((item, i) => `
            <button onclick="UltraJSON.loadHistoryItem(${i})"
                    class="btn btn-secondary"
                    style="padding:5px 12px; font-size:11px; white-space:nowrap; border-radius:50px;">
                <i class="fa-regular fa-clock"></i> ${escapeHtml(item.snip)}
            </button>
        `).join('');
    }

    /**
     * loadHistoryItem
     * Restores a specific history entry from localStorage into the editor
     * and immediately re-formats it.
     *
     * @param {number} index - Zero-based index into the history ring buffer.
     */
    function loadHistoryItem(index) {
        const h = JSON.parse(localStorage.getItem('ultraJsonHist') || '[]');
        if (h[index]) {
            DOM.input.value = h[index].full;
            handleInput(false);
            processJSON(4);
        }
    }

    /* =========================================================================
     * SECTION 13: TAB SWITCHER
     * ========================================================================= */

    /**
     * switchTab
     * Activates the specified output tab by toggling .active on the tab buttons
     * and toggling .hidden on the three view containers. If the user switches
     * to a non-code tab before pressing Beautify and the input is non-empty,
     * a silent processJSON(4) is triggered to ensure the views are populated.
     *
     * @param {string} tabName - One of 'code' | 'tree' | 'table'.
     */
    function switchTab(tabName) {
        /* Update active class on tab buttons */
        DOM.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

        /* Show/hide the three view containers */
        DOM.codeOutput.classList.toggle('hidden', tabName !== 'code');
        DOM.treeOutput.classList.toggle('hidden', tabName !== 'tree');
        DOM.tableOutput.classList.toggle('hidden', tabName !== 'table');

        /* Auto-process if the user switches tabs before hitting Beautify */
        if (tabName !== 'code' && !state.isValid && DOM.input.value.trim()) {
            processJSON(4);
        }
    }

    /* =========================================================================
     * SECTION 14: UTILITY HELPERS
     * Small, reusable functions used throughout the module.
     * ========================================================================= */

    /**
     * syntaxHighlight
     * Applies syntax-colour class spans to a JSON string using a single
     * RegExp pass. The input string is first entity-encoded to prevent XSS.
     * Returns an HTML string safe for assignment to innerHTML.
     *
     * Colour classes (defined in tools-template.css Section 28-G):
     *  .json-key     → cyan
     *  .json-string  → green
     *  .json-number  → orange
     *  .json-boolean → purple / bold
     *  .json-null    → muted / italic
     *
     * @param {string} json - A valid JSON string produced by JSON.stringify.
     * @returns {string}    - An HTML string with <span> colour wrappers.
     */
    function syntaxHighlight(json) {
        /* Entity-encode first to prevent raw < > & breaking the DOM */
        json = json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return json.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                let cls = 'json-number'; /* Default: numeric */

                if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? 'json-key' : 'json-string';
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }

                return `<span class="${cls}">${match}</span>`;
            }
        );
    }

    /**
     * escapeHtml
     * Sanitises a value for safe insertion into innerHTML by replacing the
     * four special HTML characters with their entity equivalents.
     * Returns an empty string for null or undefined inputs.
     *
     * @param {any}    text - The value to sanitise (will be coerced to string).
     * @returns {string}   - The entity-encoded string.
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;');
    }

    /**
     * updateSizeStat
     * Calculates the byte size of a string and updates the size indicator
     * in the Input panel header. Uses the Blob constructor for an accurate
     * multi-byte character count.
     *
     * @param {string} str - The raw string whose size to display.
     */
    function updateSizeStat(str) {
        const bytes = new Blob([str]).size;
        DOM.sizeStat.textContent = bytes > 1024
            ? (bytes / 1024).toFixed(2) + ' KB'
            : bytes + ' B';
    }

    /**
     * debounce
     * Returns a debounced version of the provided function that delays its
     * invocation until `wait` milliseconds have elapsed since the last call.
     * Used to prevent the input handler from firing on every keystroke.
     *
     * @param {Function} func - The function to debounce.
     * @param {number}   wait - Delay in milliseconds.
     * @returns {Function}    - The debounced wrapper function.
     */
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * showError
     * Displays a parse error inline in the error box and updates the
     * validation status indicator to "Invalid".
     *
     * @param {Error} e - The SyntaxError thrown by JSON.parse.
     */
    function showError(e) {
        setStatus('invalid');
        DOM.errorBox.style.display = 'block';
        DOM.errorBox.innerHTML =
            `<strong><i class="fa-solid fa-circle-exclamation"></i> Syntax Error:</strong> ` +
            escapeHtml(e.message);
    }

    /**
     * setStatus
     * Updates the validation status indicator in the Output panel header.
     * Also changes the Input panel's border colour for immediate visual feedback.
     *
     * @param {'valid'|'invalid'|'ready'} type - The new status state.
     */
    function setStatus(type) {
        if (type === 'valid') {
            DOM.statusIcon.innerHTML =
                '<i class="fa-solid fa-check-circle" style="color:var(--status-success)"></i> Valid JSON';
            DOM.input.parentElement.style.borderColor = 'var(--status-success)';

        } else if (type === 'invalid') {
            DOM.statusIcon.innerHTML =
                '<i class="fa-solid fa-triangle-exclamation" style="color:var(--status-error)"></i> Invalid';
            DOM.input.parentElement.style.borderColor = 'var(--status-error)';

        } else {
            /* 'ready' — idle / empty state */
            DOM.statusIcon.innerHTML =
                '<i class="fa-solid fa-circle" style="color:var(--text-muted)"></i> Ready';
            DOM.input.parentElement.style.borderColor = 'var(--border-main)';
        }
    }

    /* =========================================================================
     * SECTION 15: INITIALISATION HOOK
     * Defers init() until the DOM is fully constructed so all getElementById
     * calls inside DOM{} resolve correctly.
     * ========================================================================= */
    document.addEventListener('DOMContentLoaded', init);

    /* =========================================================================
     * SECTION 16: PUBLIC API
     * Only the methods that are called from HTML onclick attributes need to be
     * exposed. Internal helpers remain private inside the IIFE closure.
     * ========================================================================= */
    return {
        processJSON,
        autoFixJSON,
        switchTab,
        convertToXML,
        convertToCSV,
        downloadResult,
        copyToClipboard,
        fetchFromUrl,
        loadSample,
        clearAll,
        handleFileUpload,
        loadHistoryItem
    };

})();
