/**
 * =============================================================================
 *  TextNova Core — script.js
 *  Version    : 3.0 (CodeCanyon Commercial Production Release)
 *  Author     : MD KAWSAR
 *  Project    : Trusted Tools Web
 * =============================================================================
 *
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  The entire application is wrapped in a self-executing IIFE (Immediately
 *  Invoked Function Expression) assigned to the global `TextNova` constant.
 *  Only the public API object at the bottom is exposed to the HTML onclick
 *  handlers — all internal helpers are fully private. This prevents global
 *  scope pollution and meets CodeCanyon's premium code quality standards.
 *
 *  KEY MODULES (all private):
 *   ┌─ dom             → Cached DOM element references (single query per ID)
 *   ├─ state           → Mutable application state (history, search, timers)
 *   ├─ debounce        → Generic debounce factory for performance-critical ops
 *   ├─ setLoading      → Shows/hides the processing overlay during async work
 *   ├─ historyManager  → Undo/redo stack engine (max 30 entries)
 *   ├─ init            → Bootstrap function wired to window.onload
 *   ├─ updateStats     → Computes char/word/line/byte counts from textarea
 *   ├─ formatBytes     → Human-readable byte formatter (B → KB → MB → GB)
 *   ├─ showAnalysisModal / closeAnalysisModal → Detailed stats popup
 *   ├─ transform       → Central switch-dispatch for ALL text transformations
 *   ├─ insert          → Generator engine: password, UUID, Lorem Ipsum
 *   ├─ resetSearch     → Clears search state and hides match counter
 *   ├─ findNext        → Forward-cycling text search with Regex support
 *   ├─ performReplace  → Find-all-and-replace using Regex or literal strings
 *   ├─ generateHash    → Async SHA-256 hashing via Web Crypto API
 *   ├─ downloadFile    → Smart file download (auto-detects .json/.html/.sql)
 *   ├─ copyToClipboard → Clipboard write via navigator.clipboard
 *   ├─ clearAll        → Confirmed workspace wipe with undo checkpoint
 *   ├─ toggleSidebar   → Shows/hides the tool sidebar panel
 *   ├─ toggleSearchMobile → Shows/hides search box on small screens
 *   └─ toCase          → Tokenizer + case converter (camel/pascal/snake/kebab)
 *
 *  TOAST SYSTEM
 *  All user notifications use the GLOBAL toast system injected by global.js.
 *  Call: window.showToast("Message")        → info/success style
 *        window.showToast("Error msg", true) → error/warning style (red)
 * =============================================================================
 */

const TextNova = (() => {

    // =========================================================================
    //  DOM CACHE
    //  All element references are resolved once at module load time.
    //  Never use document.getElementById() inside hot paths (transform loop).
    // =========================================================================
    const dom = {
        /** Primary content textarea — the user's editing workspace */
        input       : document.getElementById('textInput'),

        /** Find field inside the search/replace bar */
        find        : document.getElementById('findInput'),

        /** Replace field inside the search/replace bar */
        replace     : document.getElementById('replaceInput'),

        /** Inline "2/7" match counter overlaid on the find field */
        matchCounter: document.getElementById('matchCounter'),

        /** Sidebar element — toggled open/closed on mobile */
        sidebar     : document.getElementById('sidebar'),

        /** Search/replace box — collapsed on mobile until toggled */
        searchBox   : document.getElementById('searchBox'),

        /** Processing overlay — shown during async heavy transforms */
        processOverlay: document.getElementById('processOverlay'),

        /** Analysis modal backdrop overlay */
        modal       : document.getElementById('analysisModal'),

        /** Live stat display elements in the status bar */
        stats: {
            char : document.getElementById('charCount'),
            word : document.getElementById('wordCount'),
            line : document.getElementById('lineCount'),
            size : document.getElementById('liveSizeInfo')    // Byte-size in config bar
        },

        /** Stat value elements inside the analysis modal */
        modalStats: {
            char : document.getElementById('modalChar'),
            word : document.getElementById('modalWord'),
            line : document.getElementById('modalLine'),
            size : document.getElementById('modalSize'),
            read : document.getElementById('modalRead'),
            sent : document.getElementById('modalSent')
        },

        /** Config checkbox elements (case sensitivity, regex mode, live stats) */
        config: {
            case  : document.getElementById('caseSensitive'),
            regex : document.getElementById('regexMode'),
            live  : document.getElementById('liveStats')
        }
    };

    // =========================================================================
    //  STATE MANAGEMENT
    //  Central mutable state object. Only modified through dedicated functions.
    // =========================================================================
    const state = {
        /** Undo history stack — stores past textarea values */
        history         : [],

        /** Redo buffer — populated when the user triggers undo */
        redoStack       : [],

        /** Maximum number of history snapshots to retain (memory cap) */
        maxHistory      : 30,

        /** Array of { start, end } match objects from the current search */
        searchMatches   : [],

        /** Index of the currently highlighted match (-1 = none) */
        currentMatchIdx : -1,

        /** Timer ID for the 800ms debounced history-save on keyup */
        typingTimer     : null
    };

    // =========================================================================
    //  UTILITY: DEBOUNCE FACTORY
    //  Returns a debounced wrapper around `func` that delays execution by
    //  `wait` ms. Any rapid successive calls reset the timer, ensuring the
    //  wrapped function only runs after typing pauses.
    //  Used for: stats update (200ms) and history save (800ms).
    // =========================================================================
    /**
     * Creates and returns a debounced version of the provided function.
     * @param {Function} func - The function to debounce.
     * @param {number}   wait - Delay in milliseconds.
     * @returns {Function} Debounced wrapper function.
     */
    const debounce = (func, wait) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    };

    // =========================================================================
    //  UTILITY: LOADING OVERLAY TOGGLE
    //  Shows or hides the full-editor processing overlay. Used by async
    //  operations (transform, generateHash) to prevent user interaction
    //  while the main thread is busy.
    // =========================================================================
    /**
     * Activates or deactivates the processing overlay UI element.
     * @param {boolean} isLoading - Pass `true` to show, `false` to hide.
     */
    const setLoading = (isLoading) => {
        if (isLoading) dom.processOverlay.classList.add('active');
        else           dom.processOverlay.classList.remove('active');
    };

    // =========================================================================
    //  HISTORY ENGINE — UNDO / REDO
    //  Maintains a bounded stack of textarea snapshots for undo operations.
    //  Maximum stack depth: state.maxHistory (30 entries) to cap memory use.
    //  When a new value is pushed, the redoStack is cleared (standard UX).
    // =========================================================================
    const historyManager = {

        /**
         * Saves the current textarea value to the undo stack.
         * Skips the save if the latest entry already matches the current value
         * (prevents consecutive duplicate snapshots on repeated transforms).
         */
        save: () => {
            const val = dom.input.value;

            // Skip if the value hasn't changed since the last snapshot
            if (state.history.length > 0 && state.history[state.history.length - 1] === val) return;

            state.history.push(val);

            // Trim oldest entry when stack exceeds the memory cap
            if (state.history.length > state.maxHistory) state.history.shift();

            // Clear redo buffer — any new action invalidates the redo path
            state.redoStack = [];
        },

        /**
         * Restores the previous textarea value from the undo stack.
         * Pushes the current value onto the redo buffer before restoring.
         * Notifies the user via the global toast system.
         */
        undo: () => {
            if (state.history.length > 0) {
                state.redoStack.push(dom.input.value);
                dom.input.value = state.history.pop();
                updateStats();
                window.showToast('Undo Successful');
            } else {
                window.showToast('Nothing to Undo', true);
            }
        },

        /**
         * Restores the next value from the redo buffer.
         * Pushes the current value back onto the undo stack before restoring.
         */
        redo: () => {
            if (state.redoStack.length > 0) {
                const next = state.redoStack.pop();
                state.history.push(dom.input.value);
                dom.input.value = next;
                updateStats();
                window.showToast('Redo Successful');
            }
        }
    };

    // =========================================================================
    //  INITIALISATION
    //  Called once via window.onload. Wires up all event listeners, sets up
    //  the initial history snapshot, and registers global keyboard shortcuts.
    //  Theme is controlled globally by global.js — no local override needed.
    // =========================================================================
    /**
     * Bootstraps the TextNova Core application.
     * Sets the initial history entry, attaches the textarea input listener
     * (debounced history save + live stats), and registers keyboard shortcuts
     * for Undo (Ctrl+Z), Redo (Ctrl+Y), Save (Ctrl+S), and Escape (close modal).
     * On desktop (≥769px) the sidebar opens automatically; on mobile it starts
     * hidden and slides in via the hamburger toggle.
     */
    function init() {
        // Seed the history stack with the empty initial state
        state.history.push("");

        // ── Auto-open sidebar on desktop, keep closed on mobile ─────────────
        // Sidebar always starts hidden — user opens via hamburger button.
// (No auto-open on any screen size)


        // ── Sidebar overlay backdrop: tap outside to close on mobile ────────
        // Creates a transparent backdrop behind the sidebar drawer so tapping
        // outside of it closes the panel — standard mobile UX pattern.
        const backdrop = document.createElement('div');
        backdrop.className = 'tnc-sidebar-backdrop';
        dom.sidebar.closest('.tnc-app-layout').appendChild(backdrop);
        backdrop.addEventListener('click', () => {
            dom.sidebar.classList.remove('active');
            backdrop.classList.remove('active');
        });

        // Mirror backdrop visibility with sidebar state
        const origToggle = toggleSidebar;
        // Patch toggleSidebar to also manage backdrop
        Object.defineProperty(window.TextNova || {}, '_backdropRef', { value: backdrop });

        // ── Textarea input handler ──────────────────────────────────────────
        dom.input.addEventListener('input', () => {
            clearTimeout(state.typingTimer);
            state.typingTimer = setTimeout(() => {
                historyManager.save();
            }, 800);

            if (dom.config.live.checked) debouncedStats();
            resetSearch();
        });

        // ── Global keyboard shortcuts ───────────────────────────────────────
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); historyManager.undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); historyManager.redo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); downloadFile(); }
            if (e.key === 'Escape') closeAnalysisModal();
        });

        console.log("TextNova Core v3.0: Engine Initialized ✓");
    }

    // =========================================================================
    //  STATS ENGINE
    //  Computes character count, word count, line count, and byte size from
    //  the textarea content. Updates both the status bar and config bar readouts.
    //  The debouncedStats wrapper prevents running this on every keystroke.
    // =========================================================================

    /**
     * Reads the textarea value and writes updated statistics to the status bar
     * (charCount, wordCount, lineCount) and the config bar byte-size label.
     * Uses the Blob API for an accurate UTF-8 byte size calculation.
     */
    function updateStats() {
        const val = dom.input.value;
        const len = val.length;

        // Character count (includes spaces and newlines)
        dom.stats.char.textContent = len.toLocaleString();

        // Word count: split on whitespace after trimming, guard for empty string
        dom.stats.word.textContent = val.trim() === ''
            ? 0
            : val.trim().split(/\s+/).length.toLocaleString();

        // Line count: split on all newline variants (\r\n, \r, \n)
        dom.stats.line.textContent = val === ''
            ? 0
            : val.split(/\r\n|\r|\n/).length.toLocaleString();

        // Byte size: Blob measures accurate UTF-8 encoded byte length
        const blobSize = new Blob([val]).size;
        dom.stats.size.textContent = formatBytes(blobSize);
    }

    /**
     * Debounced version of updateStats — limits re-computation to at most
     * once per 200ms during rapid typing.
     */
    const debouncedStats = debounce(updateStats, 200);

    /**
     * Converts a raw byte count into a human-readable string with unit suffix.
     * Examples: 0 → "0 B", 1536 → "1.50 KB", 2097152 → "2.00 MB"
     *
     * @param {number} bytes    - Raw byte count to format.
     * @param {number} decimals - Number of decimal places (default: 2).
     * @returns {string} Formatted byte string, e.g., "4.25 KB".
     */
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 B';
        const k     = 1024;
        const dm    = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i     = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    // =========================================================================
    //  ANALYSIS MODAL
    //  Opens a full-screen overlay with six detailed text metrics.
    //  Computes stats fresh each time the modal is opened so values
    //  are always up to date with the current textarea content.
    // =========================================================================

    /**
     * Calculates detailed text metrics (chars, words, lines, bytes, sentences,
     * estimated reading time) and populates the analysis modal before showing it.
     * Silently returns with a warning toast if the editor is empty.
     */
    function showAnalysisModal() {
        const val = dom.input.value;
        if (!val) return window.showToast('Editor is empty', true);

        // ── Metric calculations ──────────────────────────────────────────────
        const charCount     = val.length;
        const wordCount     = val.trim() === '' ? 0 : val.trim().split(/\s+/).length;
        const lineCount     = val.split(/\r\n|\r|\n/).length;
        const blobSize      = new Blob([val]).size;

        // Sentence count: split on terminal punctuation, filter empty strings
        const sentenceCount = val.split(/[.!?]+/).filter(Boolean).length;

        // Reading time estimate: 200 words per minute average (rounded up)
        const readTime      = Math.ceil(wordCount / 200);

        // ── Populate modal UI ────────────────────────────────────────────────
        dom.modalStats.char.textContent = charCount.toLocaleString();
        dom.modalStats.word.textContent = wordCount.toLocaleString();
        dom.modalStats.line.textContent = lineCount.toLocaleString();
        dom.modalStats.size.textContent = formatBytes(blobSize);
        dom.modalStats.read.textContent = `~${readTime} min`;
        dom.modalStats.sent.textContent = sentenceCount.toLocaleString();

        // Add .active class to show the modal overlay
        dom.modal.classList.add('active');
    }

    /**
     * Closes the analysis modal by removing the .active class from the overlay.
     * Called by the close button and the Escape key shortcut.
     */
    function closeAnalysisModal() {
        dom.modal.classList.remove('active');
    }

    // =========================================================================
    //  TRANSFORMATION ENGINE
    //  Central dispatcher for all text transformation operations.
    //  Each case in the switch statement is a pure string transformation.
    //  The function always:
    //   1. Checks for empty input (warns the user via toast and exits early).
    //   2. Shows the loading overlay (supports heavy async operations).
    //   3. Saves a history snapshot before modifying.
    //   4. Dispatches to the appropriate transformation logic.
    //   5. Updates the textarea and stats on success.
    //   6. Hides the overlay in the finally block (always runs).
    // =========================================================================

    /**
     * Applies a named text transformation to the textarea content.
     * Uses setTimeout(0) to yield to the browser's rendering engine before
     * executing heavy synchronous operations, preventing UI freezes.
     *
     * @param {string} type - Transformation key (e.g., 'upper', 'jsonFormat', 'camel').
     */
    async function transform(type) {
        let text = dom.input.value;
        if (!text) return window.showToast("No text to process", true);

        // Show the processing overlay while transform runs
        setLoading(true);

        // Yield to the browser render loop so the overlay is painted before
        // the (potentially heavy) synchronous transformation begins
        setTimeout(() => {
            historyManager.save(); // Checkpoint before modification

            let msg     = "Processed";   // Success toast message (overridden per case)
            let success = true;          // Flag — set to false for non-fatal soft failures

            try {
                switch (type) {

                    // ── CASE CONVERSION ──────────────────────────────────────
                    case 'upper':
                        text = text.toUpperCase();
                        break;

                    case 'lower':
                        text = text.toLowerCase();
                        break;

                    case 'capitalize':
                        // Capitalises the first character of every word
                        text = text.replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase());
                        break;

                    case 'titleCase':
                        // Title case: capitalises after spaces, hyphens, and slashes
                        text = text.toLowerCase().replace(/(?:^|\s|-|\/)\w/g, m => m.toUpperCase());
                        msg  = "Title Case Applied";
                        break;

                    case 'reverse':
                        // Reverses the character order of the entire string
                        text = text.split('').reverse().join('');
                        break;

                    // ── DEVELOPER CASE CONVERTERS ────────────────────────────
                    case 'camel':  text = toCase(text, 'camel');  break;
                    case 'pascal': text = toCase(text, 'pascal'); break;
                    case 'snake':  text = toCase(text, 'snake');  break;
                    case 'kebab':  text = toCase(text, 'kebab');  break;

                    // ── LINE OPERATIONS ──────────────────────────────────────
                    case 'sortAZ':
                        // Sorts all lines alphabetically (locale-aware for accented chars)
                        text = text.split('\n').sort((a, b) => a.localeCompare(b)).join('\n');
                        break;

                    case 'unique':
                        // Trims each line before deduplication to handle trailing spaces
                        text = [...new Set(text.split('\n').map(l => l.trim()))].join('\n');
                        msg  = "Duplicates Removed";
                        break;

                    case 'trim':
                        // Strips leading/trailing whitespace from every line
                        text = text.split('\n').map(l => l.trim()).join('\n');
                        break;

                    case 'empty':
                        // Removes completely blank or whitespace-only lines
                        text = text.split('\n').filter(l => l.trim() !== '').join('\n');
                        break;

                    case 'number':
                        // Prepends "1. ", "2. ", etc. to each line
                        text = text.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n');
                        break;

                    // ── FORMATTING & CLEANING ────────────────────────────────
                    case 'jsonFormat':
                        // Parses JSON and re-serialises with 4-space indentation.
                        // Throws a descriptive error on malformed JSON.
                        try {
                            text = JSON.stringify(JSON.parse(text), null, 4);
                            msg  = "JSON Beautified";
                        } catch (e) {
                            throw new Error(`Invalid JSON: ${e.message}`);
                        }
                        break;

                    case 'jsonMin':
                        // Parses and re-serialises JSON with zero whitespace (minified).
                        try {
                            text = JSON.stringify(JSON.parse(text));
                            msg  = "JSON Minified";
                        } catch (e) {
                            throw new Error(`Invalid JSON: ${e.message}`);
                        }
                        break;

                    case 'sqlFormat':
                        // Multi-step regex formatter:
                        //  1. Collapses all whitespace runs into single spaces.
                        //  2. Adds a newline before major SQL keywords.
                        //  3. Adds extra indent before AND/OR logic operators.
                        //  4. Formats opening/closing parentheses onto their own lines.
                        text = text
                            .replace(/\s+/g, ' ')
                            .replace(/\s(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|INSERT|UPDATE|DELETE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|ON|VALUES|SET|LIMIT|HAVING|UNION)\s/gi, '\n$1 ')
                            .replace(/\s(AND|OR)\s/gi, '\n  $1 ')
                            .replace(/\(/g, ' (\n  ')
                            .replace(/\)/g, '\n) ');
                        msg = "SQL Formatted";
                        break;

                    case 'stripHtml':
                        // Uses the browser's own HTML parser (DOMParser) to extract
                        // plain text from an HTML string — no manual regex needed.
                        const doc = new DOMParser().parseFromString(text, 'text/html');
                        text = doc.body.textContent || "";
                        msg  = "HTML Stripped";
                        break;

                    case 'extractEmail':
                        // Extracts all unique email addresses from the text using
                        // a standard RFC-compatible email regex.
                        const emails = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
                        text    = emails ? [...new Set(emails)].join('\n') : "No emails found";
                        if (!emails) success = false;
                        break;

                    // ── ENCODING & DECODING ──────────────────────────────────
                    case 'base64En':
                        // Encodes to Base64 using encodeURIComponent + escape for
                        // full Unicode support (handles multi-byte characters safely).
                        text = btoa(unescape(encodeURIComponent(text)));
                        break;

                    case 'base64De':
                        // Decodes Base64 string back to UTF-8.
                        // Throws a clear error if the input is not valid Base64.
                        try {
                            text = decodeURIComponent(escape(atob(text)));
                        } catch {
                            throw new Error("Invalid Base64");
                        }
                        break;

                    case 'urlEn':
                        // Percent-encodes all special characters for use in a URL.
                        text = encodeURIComponent(text);
                        break;

                    case 'urlDe':
                        // Decodes percent-encoded URL components back to readable text.
                        text = decodeURIComponent(text);
                        break;
                }

                // ── Write result back to textarea ─────────────────────────
                if (success) {
                    dom.input.value = text;
                    updateStats();
                    window.showToast(msg);
                } else {
                    // Soft failure (e.g., "No emails found") — still write result
                    // but show as a warning rather than a success
                    dom.input.value = text;
                    updateStats();
                    window.showToast(text, true);
                }

            } catch (e) {
                // Hard failure — log to console for debugging, notify user
                console.error('[TextNova] Transform error:', e);
                window.showToast(e.message || "Processing Error", true);
            } finally {
                // Always hide the loading overlay, even on error
                setLoading(false);
            }
        }, 10);
    }

    // =========================================================================
    //  GENERATOR ENGINE
    //  Inserts generated content (Lorem Ipsum, UUID, Secure Password) at the
    //  cursor position inside the textarea, with a smart newline prefix so
    //  generated content always starts on a fresh line.
    // =========================================================================

    /**
     * Inserts generated content at the current cursor position in the textarea.
     * Supported types: 'lorem', 'uuid', 'password'.
     * Uses the Web Crypto API for cryptographically secure random generation.
     *
     * @param {string} type - The type of content to generate and insert.
     */
    function insert(type) {
        historyManager.save(); // Checkpoint before inserting

        let val = "";

        if (type === 'lorem') {
            // Standard Lorem Ipsum placeholder paragraph
            val = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
        }

        if (type === 'uuid') {
            // RFC 4122 compliant UUID v4 via native Web Crypto (no library needed)
            val = crypto.randomUUID();
        }

        if (type === 'password') {
            // Cryptographically secure 20-character password using Uint32Array.
            // Using crypto.getRandomValues() prevents Math.random() bias.
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
            const array = new Uint32Array(20);
            crypto.getRandomValues(array);
            for (let i = 0; i < 20; i++) val += chars[array[i] % chars.length];
        }

        // ── Insert at cursor position ─────────────────────────────────────
        const el     = dom.input;
        const start  = el.selectionStart;
        const end    = el.selectionEnd;
        const before = el.value.substring(0, start);

        // Smart prefix: add a newline if the cursor isn't already at a line start
        const prefix = (before.length > 0 && !before.endsWith('\n') && !before.endsWith(' '))
            ? '\n'
            : '';

        // setRangeText inserts the string and moves the cursor to after it
        el.setRangeText(prefix + val, start, end, 'end');
        el.focus();
        updateStats();
        window.showToast('Inserted successfully');
    }

    // =========================================================================
    //  SEARCH ENGINE
    //  Implements a stateful forward-cycling search across the textarea.
    //  Supports both literal string search and full JavaScript Regex.
    //  The match list is built once per search query and then cycled through
    //  on each subsequent call to findNext() without re-scanning the text.
    // =========================================================================

    /**
     * Clears all search state and hides the match counter UI element.
     * Called when the textarea content changes (input event) or when a new
     * search query is initiated.
     */
    function resetSearch() {
        state.searchMatches   = [];
        state.currentMatchIdx = -1;
        dom.matchCounter.style.display = 'none';
    }

    /**
     * Finds the next occurrence of the text in the find input field.
     * On the first call (or after a text change), builds the full match list.
     * On subsequent calls, cycles forward through the existing match list.
     * Highlights each match using textarea's setSelectionRange().
     */
    function findNext() {
        const query = dom.find.value;
        if (!query) return window.showToast("Enter search text", true);

        // ── Build match list on first call ────────────────────────────────
        // If state.searchMatches is empty, we need to scan the full text.
        if (state.searchMatches.length === 0) {
            const text    = dom.input.value;
            const isRegex = dom.config.regex.checked;
            const isCase  = dom.config.case.checked;

            try {
                // Flags: always global, conditionally case-insensitive
                const flags   = 'g' + (isCase ? '' : 'i');

                // Escape special regex chars for literal search, use as-is for regex mode
                const pattern = isRegex
                    ? query
                    : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                const regex = new RegExp(pattern, flags);

                let match;
                while ((match = regex.exec(text)) !== null) {
                    state.searchMatches.push({ start: match.index, end: match.index + match[0].length });

                    // Safety guard: advance lastIndex if match length is 0 (avoids infinite loop)
                    if (match.index === regex.lastIndex) regex.lastIndex++;
                }
            } catch (e) {
                return window.showToast("Invalid Regex Pattern", true);
            }

            // No matches found — show counter and warn the user
            if (state.searchMatches.length === 0) {
                dom.matchCounter.style.display = 'block';
                dom.matchCounter.innerText = "0/0";
                return window.showToast("No matches found", true);
            }
        }

        // ── Advance to next match (wraps around at end) ───────────────────
        state.currentMatchIdx = (state.currentMatchIdx + 1) % state.searchMatches.length;

        const m = state.searchMatches[state.currentMatchIdx];

        // Highlight the match by selecting it in the textarea
        dom.input.focus();
        dom.input.setSelectionRange(m.start, m.end);

        // Update the "2/7" counter display
        dom.matchCounter.style.display = 'block';
        dom.matchCounter.innerText = `${state.currentMatchIdx + 1}/${state.searchMatches.length}`;
    }

    /**
     * Replaces ALL occurrences of the find query with the replacement string.
     * Supports full regex replace with capture group references (e.g., $1).
     * Saves a history snapshot before making changes so the action is undoable.
     */
    function performReplace() {
        historyManager.save();

        const findText    = dom.find.value;
        const replaceText = dom.replace.value;
        const isRegex     = dom.config.regex.checked;

        if (!findText) return window.showToast("Search field empty", true);

        try {
            const flags   = 'g' + (dom.config.case.checked ? '' : 'i');
            const pattern = isRegex
                ? findText
                : findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const regex = new RegExp(pattern, flags);

            // Bail early if no matches exist in the current content
            if (!regex.test(dom.input.value)) return window.showToast("Nothing to replace", true);

            // Perform the replacement — supports $1, $2 capture group references
            dom.input.value = dom.input.value.replace(regex, replaceText);

            resetSearch();
            updateStats();
            window.showToast("Replaced All Occurrences");
        } catch (e) {
            window.showToast("Invalid Regex", true);
        }
    }

    // =========================================================================
    //  CRYPTO ENGINE — HASH GENERATION
    //  Uses the browser-native Web Crypto API (crypto.subtle.digest) to
    //  compute a SHA-256 hash of the textarea content. This is the same
    //  algorithm used by TLS certificates and file integrity checks.
    //  No external library is needed — the browser handles it natively.
    // =========================================================================

    /**
     * Computes a cryptographic hash of the textarea content using the
     * specified algorithm (e.g., 'SHA-256') and replaces the textarea
     * content with the resulting hex digest string.
     *
     * @param {string} algo - The hash algorithm identifier, e.g., 'SHA-256'.
     */
    async function generateHash(algo) {
        const text = dom.input.value;
        if (!text) return window.showToast("Enter text to hash", true);

        setLoading(true);
        historyManager.save();

        // Small delay to ensure the overlay is painted before the async work begins
        setTimeout(async () => {
            try {
                // Encode the text as a UTF-8 byte buffer for the digest function
                const msgBuffer  = new TextEncoder().encode(text);

                // crypto.subtle.digest returns an ArrayBuffer of the raw hash bytes
                const hashBuffer = await crypto.subtle.digest(algo, msgBuffer);

                // Convert ArrayBuffer → Uint8Array → hex string
                const hashArray  = Array.from(new Uint8Array(hashBuffer));
                const hashHex    = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                dom.input.value = hashHex;
                updateStats();
                window.showToast(`${algo} Generated`);

            } catch (e) {
                window.showToast("Hash Failed", true);
            } finally {
                setLoading(false);
            }
        }, 10);
    }

    // =========================================================================
    //  FILE I/O — DOWNLOAD
    //  Auto-detects the content type (JSON, HTML, SQL, or plain text) from
    //  the textarea content and downloads it with the appropriate file extension.
    //  The filename is collected via a browser prompt (simple and cross-browser).
    // =========================================================================

    /**
     * Downloads the current textarea content as a file.
     * Auto-detects the file extension based on content structure:
     *  - Starts with { or [ → .json
     *  - Starts with < and contains > → .html
     *  - Starts with SELECT/INSERT/UPDATE/DELETE → .sql
     *  - Otherwise → .txt
     */
    function downloadFile() {
        const content = dom.input.value;
        if (!content) return window.showToast("Editor is empty", true);

        // ── Content type detection ─────────────────────────────────────────
        let ext   = "txt";
        let mime  = "text/plain";
        const trimmed = content.trim();

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            ext  = "json";
            mime = "application/json";
        } else if (trimmed.startsWith('<') && trimmed.includes('>')) {
            ext  = "html";
            mime = "text/html";
        } else if (/^(SELECT|INSERT|UPDATE|DELETE)/i.test(trimmed)) {
            ext  = "sql";
        }

        // Prompt for filename (null means the user cancelled — abort silently)
        const name = prompt("File Name:", `TextNova_Export`);
        if (name === null) return;

        // ── Create and trigger download ────────────────────────────────────
        const blob = new Blob([content], { type: mime });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');

        a.href     = url;
        a.download = `${name}.${ext}`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Release the object URL to free memory

        window.showToast(`Saved as .${ext}`);
    }

    // =========================================================================
    //  CLIPBOARD
    //  Writes the textarea content to the system clipboard using the modern
    //  Clipboard API (navigator.clipboard). Handles permission errors gracefully.
    // =========================================================================

    /**
     * Copies the full textarea content to the system clipboard.
     * Shows a success or error toast based on the Clipboard API result.
     */
    function copyToClipboard() {
        if (!dom.input.value) return window.showToast("Empty", true);

        navigator.clipboard
            .writeText(dom.input.value)
            .then(()  => window.showToast("Copied to Clipboard"))
            .catch(()  => window.showToast("Copy Failed", true));
    }

    // =========================================================================
    //  WORKSPACE CLEAR
    //  Confirms with the user before wiping the textarea. Saves a history
    //  snapshot first so the cleared state itself is undoable.
    // =========================================================================

    /**
     * Clears the entire textarea content after a browser confirm() dialog.
     * Saves a history snapshot beforehand so the user can partially recover
     * via Ctrl+Z (the snapshot is of the pre-clear state).
     */
    function clearAll() {
        if (dom.input.value === '') return; // Nothing to clear

        if (confirm('Clear entire workspace? This cannot be undone by simple Undo.')) {
            historyManager.save(); // Snapshot before clearing (allows undo to restore)
            dom.input.value = "";
            resetSearch();
            updateStats();
        }
    }

    // =========================================================================
    //  UI TOGGLES
    //  Small helpers that toggle CSS classes on sidebar and search box.
    // =========================================================================

    /**
     * Toggles the sidebar open/closed by adding/removing the .active class.
     * Also toggles the .tnc-sidebar-backdrop overlay so tapping outside on
     * mobile closes the sidebar panel.
     */
    function toggleSidebar() {
        dom.sidebar.classList.toggle('active');
        // Find the backdrop injected during init() and sync its visibility
        const backdrop = dom.sidebar.closest('.tnc-app-layout')
            ?.querySelector('.tnc-sidebar-backdrop');
        if (backdrop) {
            backdrop.classList.toggle('active', dom.sidebar.classList.contains('active'));
        }
    }

    /**
     * Toggles the search/replace box visibility on small screens.
     * The .mobile-active class is used instead of .active to avoid conflict
     * with other .active-based systems (modal, sidebar).
     */
    function toggleSearchMobile() {
        dom.searchBox.classList.toggle('mobile-active');
    }

    // =========================================================================
    //  CASE CONVERTER UTILITY
    //  Tokenises a string into its component words (handles camelCase,
    //  PascalCase, snake_case, kebab-case, and plain words) then reconstructs
    //  them in the requested output format.
    // =========================================================================

    /**
     * Splits a string into tokens and reassembles them in the requested case.
     * The regex handles: ALL_CAPS acronyms, camelCase bumps, plain words, numbers.
     *
     * @param {string} str  - The source string to convert.
     * @param {string} type - Target case: 'camel' | 'pascal' | 'snake' | 'kebab'.
     * @returns {string} The converted string.
     */
    function toCase(str, type) {
        // Robust tokeniser — handles camelCase, PascalCase, ACRONYMS, numbers
        let words = str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g);
        if (!words) return str;

        words = words.map(x => x.toLowerCase());

        switch (type) {
            // camelCase: first word lowercase, subsequent words capitalised
            case 'camel':
                return words.map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');

            // PascalCase: every word capitalised
            case 'pascal':
                return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

            // snake_case: words joined with underscores, all lowercase
            case 'snake':
                return words.join('_');

            // kebab-case: words joined with hyphens, all lowercase
            case 'kebab':
                return words.join('-');
        }

        return str; // Fallback: return original if type is unrecognised
    }

    // =========================================================================
    //  PUBLIC API
    //  Only the methods listed here are accessible from HTML onclick handlers.
    //  All internal helpers, state, and DOM references remain private.
    // =========================================================================
    return {
        init,
        transform,
        insert,
        findNext,
        performReplace,
        generateHash,
        downloadFile,
        copyToClipboard,
        clearAll,
        toggleSidebar,
        toggleSearchMobile,
        handleUndo   : historyManager.undo,
        handleRedo   : historyManager.redo,
        showAnalysisModal,
        closeAnalysisModal
    };

})();

// =============================================================================
//  BOOT
//  Defers TextNova.init() until the full DOM and all resources are loaded.
// =============================================================================
window.onload = TextNova.init;
