/**
 * =============================================================================
 *  WORD COUNTER ULTRA PRO — Tool Script (v2.0)
 *  File    : script.js
 *  Tool    : text-word-counter.html
 *  Author  : MD KAWSAR | Trusted Tools Web
 *  License : CodeCanyon Extended License
 * =============================================================================
 *
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────
 *  This script is wrapped in an IIFE (Immediately Invoked Function Expression)
 *  to keep all internal variables and helpers in a private scope, preventing
 *  conflicts with the global namespace or other tools on the site.
 *
 *  Internal Sections:
 *  ──────────────────
 *  1. CONFIGURATION & STATE
 *     — MAX_HISTORY cap, STOP_WORDS set, densityMode flag, history stack.
 *
 *  2. DOM CACHE
 *     — All frequently-accessed elements are cached once at startup to
 *       avoid repeated querySelector calls and maximise performance.
 *
 *  3. INITIALIZATION
 *     — Restores saved text from localStorage, runs the first analysis pass.
 *
 *  4. REAL-TIME INPUT LISTENER
 *     — Debounced (250ms) to prevent performance issues with large pastes.
 *
 *  5. CORE ANALYSIS ENGINE
 *     — Word counting via Intl.Segmenter (modern) with Unicode regex fallback.
 *     — Sentence, paragraph, read-time, speak-time calculations.
 *     — Social media character limit progress bar updates.
 *     — Keyword density (N-gram) analysis.
 *
 *  6. HISTORY SYSTEM (Undo / Redo)
 *     — Saves text snapshots + cursor position to a capped stack (100 items).
 *
 *  7. UTILITIES & ACTIONS
 *     — Text transforms (upper/lower/capitalize), space cleaner, clipboard
 *       copy, clear, .TXT download, density mode toggle, auto-save.
 *
 *  8. CUSTOM MODAL SYSTEM
 *     — Tool-specific dialog for info alerts and destructive confirmations.
 *     — This is intentionally separate from the global toast system:
 *       the modal blocks interaction for confirmations ("Delete all?"),
 *       while the global toast is for non-blocking status notifications.
 *
 *  Global Exports (window.*):
 *  ─────────────────────────
 *  window.undo, window.redo, window.transformText, window.cleanText,
 *  window.copyText, window.clearText, window.downloadText,
 *  window.setDensityMode, window.showModal, window.showConfirmationModal,
 *  window.closeModal
 * =============================================================================
 */

(function () {

    /* =========================================================================
       SECTION 1: CONFIGURATION & STATE
       =========================================================================
       MAX_HISTORY  — Maximum number of undo states kept in memory.
                      Keeping this at 100 prevents unbounded memory growth
                      on very long editing sessions.

       STOP_WORDS   — A set of common English function words excluded from
                      keyword density analysis. This ensures only meaningful
                      content words appear in the SEO density report, matching
                      the behaviour of professional SEO tools.

       densityMode  — Tracks the currently active N-gram size (1, 2, or 3).
                      Toggled by setDensityMode().

       historyStack — Array of { val, start } objects representing undo states.
       historyIndex — Pointer into historyStack; moves with undo/redo.
    ========================================================================= */

    /** @const {number} Maximum entries kept in the undo history stack */
    const MAX_HISTORY = 100;

    /**
     * @const {Set<string>} Stop words excluded from keyword density analysis.
     * These are high-frequency English function words with no SEO value.
     * Phrases that START or END with a stop word are filtered out.
     */
    const STOP_WORDS = new Set([
        "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
        "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
        "this", "but", "his", "by", "from", "they", "we", "say", "her",
        "she", "or", "an", "will", "my", "one", "all", "would", "there",
        "their", "what", "so", "up", "out", "if", "about", "who", "get",
        "which", "go", "me", "is", "are", "was", "were", "has", "had"
    ]);

    /** @type {number} Active N-gram analysis size: 1 = single words, 2 = bigrams, 3 = trigrams */
    let densityMode = 1;

    /** @type {Array<{val: string, start: number}>} Undo/redo history stack */
    let historyStack = [];

    /** @type {number} Current position within historyStack (-1 = empty) */
    let historyIndex = -1;


    /* =========================================================================
       SECTION 2: DOM CACHE
       =========================================================================
       All UI elements that are accessed more than once are cached here at
       script load time. This is a performance best-practice: a single
       getElementById call per element vs. repeated queries inside loops.
    ========================================================================= */

    /**
     * @const {Object} DOM - Cached references to all interactive UI elements.
     *
     * DOM.input        — Main <textarea> for user text input.
     * DOM.saveBadge    — "Auto Saved" confirmation pill (opacity toggled).
     * DOM.densityTable — <tbody> of the keyword density results table.
     * DOM.stats.*      — The six real-time statistic display spans.
     * DOM.modal        — The full-screen modal backdrop overlay.
     * DOM.modalMsg     — The <div> that holds the dialog's message text.
     */
    const DOM = {
        input        : document.getElementById('textInput'),
        saveBadge    : document.getElementById('saveIndicator'),
        densityTable : document.getElementById('densityList'),
        stats: {
            words      : document.getElementById('words'),
            chars      : document.getElementById('chars'),
            sentences  : document.getElementById('sentences'),
            paragraphs : document.getElementById('paragraphs'),
            readTime   : document.getElementById('readTime'),
            speakTime  : document.getElementById('speakTime')
        },
        modal    : document.getElementById('customModal'),
        modalMsg : document.getElementById('modalMsg')
    };


    /* =========================================================================
       SECTION 3: INITIALIZATION
       =========================================================================
       Runs once when the DOM is fully loaded.
       — Restores the user's last editing session from localStorage (if any).
       — Saves an initial undo state so the user can undo back to the
         restored content if desired.
       — Triggers the first analyzeText() pass so the stats dashboard is
         populated immediately upon page load.
    ========================================================================= */

    document.addEventListener('DOMContentLoaded', () => {

        // Restore previously saved text from the browser's Local Storage.
        // NOTE: Text is stored locally in the user's browser only — it is
        // never transmitted to any server (100% client-side privacy guarantee).
        const savedText = localStorage.getItem('ultraWordCounter_text');
        if (savedText) {
            DOM.input.value = savedText;
            saveState(); // Capture the restored content as the first undo state
        }

        // Run the full analysis engine on the restored (or empty) text
        // so all stat cards and progress bars show correct values on load.
        analyzeText();
    });


    /* =========================================================================
       SECTION 4: REAL-TIME INPUT LISTENER
       =========================================================================
       The 'input' event fires on every keystroke, paste, cut, or IME commit.
       Wrapping the handler in a 250ms debounce prevents the analysis engine
       from running on every single character during rapid typing — which
       would cause noticeable lag with large texts (10,000+ words).

       The debounce fires 250ms after the LAST keystroke in a burst,
       ensuring the UI still feels instantaneous for normal typing speeds.
    ========================================================================= */

    /**
     * Creates a debounced version of a function.
     * The returned function will only invoke `fn` after `delay` ms have
     * elapsed since the last call.
     *
     * @param  {Function} fn    - The function to debounce.
     * @param  {number}   delay - Milliseconds to wait after last call.
     * @returns {Function} Debounced wrapper function.
     */
    const debounce = (fn, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    /**
     * Debounced input handler — triggers the full analysis pipeline
     * (analyze → auto-save → save undo state) 250ms after typing stops.
     */
    DOM.input.addEventListener('input', debounce(() => {
        analyzeText();
        autoSave();
        saveState();
    }, 250));


    /* =========================================================================
       SECTION 5: CORE ANALYSIS ENGINE
       =========================================================================
       analyzeText() is the central function of this tool. It reads the
       current textarea value and updates ALL UI components in one pass.

       Sub-tasks performed:
       A. Word counting — uses Intl.Segmenter for multilingual accuracy,
          falls back to Unicode regex for older environments.
       B. Statistics — words, characters, sentences, paragraphs, times.
       C. Social limits — updates progress bars for Twitter and Google Meta.
       D. Keyword density — delegates to calculateDensity().
    ========================================================================= */

    /**
     * Analyzes the current textarea content and updates all UI components.
     * Called on every debounced input event and after any text mutation.
     *
     * @returns {void}
     */
    function analyzeText() {
        const text    = DOM.input.value;
        const trimmed = text.trim();

        /* -----------------------------------------------------------------
           A. WORD COUNTING STRATEGY
           -----------------------------------------------------------------
           We prefer Intl.Segmenter (an ECMAScript 2021 API) because it
           understands word boundaries in ALL Unicode scripts — including
           Chinese, Japanese, Thai, and Arabic — where words are NOT
           separated by spaces.

           For browsers that do not support Intl.Segmenter (e.g., older
           Firefox or Samsung Internet), we fall back to a Unicode-aware
           regex that correctly handles:
           — Latin, Cyrillic, Arabic, Greek, Hebrew scripts
           — Internal hyphens (e.g., "well-known") and apostrophes (e.g., "don't")
        ----------------------------------------------------------------- */

        let wordCount = 0;
        let wordsList = []; // Reused by calculateDensity() below

        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            // Modern path: context-aware, script-agnostic segmentation
            const segmenter = new Intl.Segmenter([], { granularity: 'word' });
            const segments  = segmenter.segment(text);
            for (const segment of segments) {
                if (segment.isWordLike) {
                    wordCount++;
                    wordsList.push(segment.segment);
                }
            }
        } else {
            // Legacy fallback: Unicode regex matching word-like tokens
            // Handles Latin, Cyrillic, Arabic etc. with internal hyphens/apostrophes
            const matches = text.match(/[\p{L}\p{N}]+(?:[-''][\p{L}\p{N}]+)*/gu) || [];
            wordCount = matches.length;
            wordsList = matches;
        }

        /* -----------------------------------------------------------------
           B. STATISTICS UPDATES
           All values are formatted with toLocaleString() to add thousand
           separators (e.g., "12,345 words") for readability.
        ----------------------------------------------------------------- */

        // Words
        DOM.stats.words.textContent = wordCount.toLocaleString();

        // Characters (includes spaces — matches social media platform counting)
        DOM.stats.chars.textContent = text.length.toLocaleString();

        // Sentence count: matches terminal punctuation (.!?) before whitespace or end-of-string.
        // Falls back to 1 when words exist but no terminal punctuation is detected
        // (e.g., a single-sentence note without a period).
        const sentenceCount = trimmed
            ? (text.match(/[.!?]+(?=\s|$)/g) || []).length
            : 0;
        DOM.stats.sentences.textContent = sentenceCount || (wordCount > 0 ? 1 : 0);

        // Paragraph count: splits on one or more blank lines,
        // then filters out empty/whitespace-only segments.
        const paragraphCount = trimmed
            ? text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length
            : 0;
        DOM.stats.paragraphs.textContent = paragraphCount || (wordCount > 0 ? 1 : 0);

        // Reading time (average adult silent reading speed: 225 wpm)
        DOM.stats.readTime.textContent  = Math.ceil(wordCount / 225) + 'm';

        // Speaking time (average conversational speech speed: 130 wpm)
        DOM.stats.speakTime.textContent = Math.ceil(wordCount / 130) + 'm';

        /* -----------------------------------------------------------------
           C. SOCIAL MEDIA CHARACTER LIMIT BARS
        ----------------------------------------------------------------- */
        updateProgress('twBar',  'twCount',  text.length, 280); // X / Twitter limit
        updateProgress('seoBar', 'seoCount', text.length, 160); // Google Meta Description limit

        /* -----------------------------------------------------------------
           D. KEYWORD DENSITY CALCULATION
        ----------------------------------------------------------------- */
        calculateDensity(wordsList);
    }

    /**
     * Updates a social media character limit progress bar with colour coding.
     *
     * Colour thresholds (SEO / UX best practice):
     *  — Under 90% of limit : platform's brand colour (default)
     *  — 90%–100% of limit  : amber warning (#d29922)
     *  — Over limit         : danger red (#ff4757)
     *
     * @param {string} barId   - ID of the fill <div> element.
     * @param {string} countId - ID of the "X / MAX" label element.
     * @param {number} current - Current character count.
     * @param {number} max     - Platform character limit.
     * @returns {void}
     */
    function updateProgress(barId, countId, current, max) {
        const elBar   = document.getElementById(barId);
        const elCount = document.getElementById(countId);
        if (!elBar || !elCount) return;

        // Cap visual percentage at 100% (bar does not overflow its track)
        const percentage = Math.min((current / max) * 100, 100);
        elBar.style.width       = percentage + '%';
        elCount.textContent     = `${current} / ${max}`;

        // Colour logic: transitions from brand colour → amber → danger red
        if (current > max) {
            elBar.style.backgroundColor = '#ff4757';           // Over limit: danger red
        } else if (current > max * 0.9) {
            elBar.style.backgroundColor = '#d29922';           // Near limit: amber warning
        } else {
            // Restore platform brand colour for each bar
            elBar.style.backgroundColor = (barId === 'twBar') ? '#1da1f2' : '#fbbc05';
        }
    }

    /**
     * Generates an N-gram frequency table from the provided word list and
     * renders the top-8 results into the keyword density <tbody>.
     *
     * Algorithm:
     * 1. Normalize all words to lower-case.
     * 2. Generate all N-grams (n = densityMode) using a sliding window.
     * 3. Filter out N-grams that START or END with a stop word (e.g. "the dog").
     * 4. Filter out tokens shorter than 2 characters (noise elimination).
     * 5. Count frequencies in a Map.
     * 6. Sort descending by frequency, take the top 8.
     * 7. Render each result row with an inline visual density bar.
     *    Bar color: green (1.5%–3%) → red (>3%) → cyan (<1.5%).
     *
     * @param {string[]} words - Array of raw word tokens from the analysis engine.
     * @returns {void}
     */
    function calculateDensity(words) {
        if (words.length === 0) {
            DOM.densityTable.innerHTML =
                '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No keywords found</td></tr>';
            return;
        }

        // Normalize to lower-case for case-insensitive frequency grouping
        const cleanWords = words.map(w => w.toLowerCase());
        const freqMap    = new Map();
        const totalItems = cleanWords.length;

        /**
         * Generates all N-grams of size `n` from cleanWords and accumulates
         * their frequency in freqMap. Stop-word-bounded and short phrases
         * are skipped.
         *
         * @param {number} n - N-gram size (1, 2, or 3).
         */
        const generateNGrams = (n) => {
            for (let i = 0; i <= totalItems - n; i++) {
                const phraseArr = cleanWords.slice(i, i + n);

                // Skip phrases that begin or end with a function/stop word
                // (e.g., "of the", "in a") — they have no SEO value.
                if (STOP_WORDS.has(phraseArr[0]) || STOP_WORDS.has(phraseArr[phraseArr.length - 1])) {
                    continue;
                }

                // Skip any token shorter than 2 characters (single-letter noise)
                if (phraseArr.some(w => w.length < 2)) continue;

                const phrase = phraseArr.join(' ');
                freqMap.set(phrase, (freqMap.get(phrase) || 0) + 1);
            }
        };

        // Generate N-grams for the currently selected density mode
        if (densityMode === 1) generateNGrams(1);
        else if (densityMode === 2) generateNGrams(2);
        else if (densityMode === 3) generateNGrams(3);

        // Sort by frequency descending and keep only the top 8 results
        const sorted = Array.from(freqMap.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8);

        // Denominator: total usable positions for N-grams of current length
        // (avoids inflating density % for bigrams/trigrams)
        const baseCount = Math.max(1, totalItems - (densityMode - 1));

        let html = '';
        sorted.forEach(([word, count]) => {
            const density  = ((count / baseCount) * 100).toFixed(1);

            // Bar color encodes SEO density health:
            //  > 3%            → red   (over-optimised / potential keyword stuffing)
            //  1.5% – 3%       → green (ideal SEO range)
            //  < 1.5%          → cyan  (under-optimised or low frequency)
            const barColor = density > 3 ? '#ff4757' : (density > 1.5 ? '#238636' : '#0abde3');

            html += `
                <tr>
                    <td>${word}</td>
                    <td>${count}</td>
                    <td>
                        <div class="density-bar-bg">
                            <div class="density-bar-fill" style="width:${Math.min(density * 10, 100)}%; background:${barColor};"></div>
                        </div>
                        ${density}%
                    </td>
                </tr>`;
        });

        // Render results, or a polite empty-state message
        DOM.densityTable.innerHTML = html ||
            '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No significant keywords found</td></tr>';
    }


    /* =========================================================================
       SECTION 6: HISTORY SYSTEM — UNDO / REDO
       =========================================================================
       Maintains a capped stack of text snapshots with cursor positions.
       This is entirely in-memory — no localStorage is used for history.

       saveState()    — Pushes a new snapshot (only if content changed).
                        Truncates any "future" states when editing after undo.
       restoreState() — Applies the snapshot at historyIndex to the textarea.
       undo()         — Moves historyIndex back one step.
       redo()         — Moves historyIndex forward one step.
    ========================================================================= */

    /**
     * Captures the current textarea value and cursor position as an undo state.
     * Only pushes a new snapshot if the content has actually changed since
     * the last saved state (prevents empty/duplicate entries in the stack).
     * Caps the stack at MAX_HISTORY to prevent unbounded memory growth.
     *
     * @returns {void}
     */
    function saveState() {
        const currentVal = DOM.input.value;

        // Only record a new snapshot if content has changed
        if (historyIndex === -1 || historyStack[historyIndex].val !== currentVal) {

            // If we undo several steps and then type, all "future" states are
            // discarded — the new edit becomes the new branch of history.
            if (historyIndex < historyStack.length - 1) {
                historyStack = historyStack.slice(0, historyIndex + 1);
            }

            // Push snapshot: text value + cursor start position
            historyStack.push({
                val   : currentVal,
                start : DOM.input.selectionStart
            });

            // Enforce memory cap: drop the oldest state if over limit
            if (historyStack.length > MAX_HISTORY) historyStack.shift();

            historyIndex = historyStack.length - 1;
        }
    }

    /**
     * Steps backwards in the undo history (if possible) and restores state.
     * Exposed on `window` so the HTML onclick handler can call it.
     *
     * @returns {void}
     */
    window.undo = function () {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState();
        }
    };

    /**
     * Steps forwards in the undo history (if possible) and restores state.
     * Exposed on `window` so the HTML onclick handler can call it.
     *
     * @returns {void}
     */
    window.redo = function () {
        if (historyIndex < historyStack.length - 1) {
            historyIndex++;
            restoreState();
        }
    };

    /**
     * Applies the snapshot at the current historyIndex to the textarea.
     * Re-runs the full analysis pass and repositions the cursor via
     * setTimeout(0) to allow the browser paint cycle to complete first.
     *
     * @returns {void}
     */
    function restoreState() {
        const state       = historyStack[historyIndex];
        DOM.input.value   = state.val;
        analyzeText();
        autoSave();

        // Restore cursor position after the current execution thread ends
        setTimeout(() => {
            DOM.input.selectionStart = state.start;
            DOM.input.selectionEnd   = state.start;
            DOM.input.focus();
        }, 0);
    }


    /* =========================================================================
       SECTION 7: UTILITIES & ACTIONS
       =========================================================================
       These functions are all exposed on `window` so the HTML inline onclick
       attributes can reach them. Each function follows the same pattern:
       1. Guard against empty/invalid input.
       2. Perform the mutation.
       3. Re-run analyzeText() + saveState() + autoSave() to keep UI in sync.
    ========================================================================= */

    /**
     * Transforms the textarea text to UPPER CASE, lower case, or Title Case.
     * "capitalize" uses a word-boundary regex to capitalise the first letter
     * of every word (e.g., "hello world" → "Hello World").
     *
     * @param {'upper'|'lower'|'capitalize'} type - Desired transform.
     * @returns {void}
     */
    window.transformText = function (type) {
        const val = DOM.input.value;
        if (!val) return; // Guard: nothing to transform

        if (type === 'upper')      DOM.input.value = val.toUpperCase();
        if (type === 'lower')      DOM.input.value = val.toLowerCase();
        if (type === 'capitalize') {
            // Word-boundary regex: capitalises the first character after any
            // word boundary, covering punctuation-separated words too.
            DOM.input.value = val.replace(/\b(\w)/g, s => s.toUpperCase());
        }

        analyzeText();
        saveState();
        autoSave();
    };

    /**
     * Cleans the textarea text by collapsing redundant whitespace.
     * 'spaces' mode:
     *  — Collapses multiple spaces/tabs on a single line to one space.
     *  — Reduces 3+ consecutive newlines to a maximum of 2 (one blank line).
     *  — Trims leading and trailing whitespace.
     *
     * @param {'spaces'} mode - The cleaning operation to apply.
     * @returns {void}
     */
    window.cleanText = function (mode) {
        if (mode === 'spaces') {
            let txt = DOM.input.value;
            txt = txt.replace(/[ \t]+/g, ' ');            // Collapse inline whitespace
            txt = txt.replace(/\n\s*\n\s*\n/g, '\n\n');  // Limit to one blank line between paragraphs
            txt = txt.trim();
            DOM.input.value = txt;

            analyzeText();
            saveState();
            autoSave();

            // Inform the user via the custom modal (non-blocking info message)
            showModal('Cleaned up extra spaces and blank lines.');
        }
    };

    /**
     * Copies the entire textarea content to the system clipboard.
     * Attempts the modern Clipboard API first; falls back to the deprecated
     * execCommand('copy') for browsers that restrict async clipboard access.
     * Success and failure states are communicated via the custom modal.
     *
     * @returns {void}
     */
    window.copyText = function () {
        if (!DOM.input.value) return; // Guard: nothing to copy

        navigator.clipboard.writeText(DOM.input.value)
            .then(() => {
                showModal('✅ Text copied to clipboard!');
            })
            .catch(() => {
                // Fallback: select all text and use legacy execCommand
                DOM.input.select();
                document.execCommand('copy');
                showModal('✅ Text copied (Fallback method)');
            });
    };

    /**
     * Clears all text from the textarea after user confirmation.
     * Uses showConfirmationModal() to present a Yes / Cancel dialog,
     * preventing accidental data loss. The "Yes, Delete" button triggers
     * the callback which resets state and re-runs the analysis engine.
     *
     * @returns {void}
     */
    window.clearText = function () {
        if (!DOM.input.value) return; // Guard: already empty

        showConfirmationModal(
            'Are you sure you want to delete everything? This cannot be undone.',
            () => {
                DOM.input.value = '';
                analyzeText();
                saveState();
                autoSave();
                closeModal();
            }
        );
    };

    /**
     * Downloads the current textarea content as a UTF-8 encoded .TXT file.
     * — Normalises line endings to CRLF (\r\n) for Windows Notepad compat.
     * — Prepends a UTF-8 BOM (\uFEFF) so Excel and other apps detect the
     *   encoding correctly without the user needing to manually specify it.
     * — Uses a timestamped filename to prevent accidental overwrites.
     *
     * @returns {void}
     */
    window.downloadText = function () {
        const txt = DOM.input.value;
        if (!txt) {
            showModal('Type something to save first.');
            return;
        }

        // Normalise line endings to CRLF for cross-platform compatibility
        const normalized = txt.replace(/\n/g, '\r\n');

        // BOM + UTF-8 blob ensures correct encoding detection
        const blob = new Blob(['\uFEFF' + normalized], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);

        // Programmatically trigger the browser's download dialog
        const a      = document.createElement('a');
        a.href       = url;
        a.download   = `Ultra_Draft_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up the object URL to free browser memory
        URL.revokeObjectURL(url);
    };

    /**
     * Switches the keyword density N-gram mode and updates button states.
     *
     * Visual state: the active mode button receives `.btn.btn-primary`,
     * inactive buttons revert to `.btn.btn-secondary`.
     * Immediately re-runs analyzeText() so the table updates without
     * requiring a re-type.
     *
     * @param {1|2|3} mode - The N-gram size to activate.
     * @returns {void}
     */
    window.setDensityMode = function (mode) {
        densityMode = mode;

        // Update button visual states to reflect the active N-gram mode
        [1, 2, 3].forEach(n => {
            const btn = document.getElementById(`btnKW${n}`);
            if (btn) {
                btn.className = (n === mode) ? 'btn btn-primary' : 'btn btn-secondary';
            }
        });

        analyzeText(); // Immediately re-render the density table for the new mode
    };

    /**
     * Persists the current textarea content to localStorage and briefly
     * shows the "Auto Saved" confirmation badge.
     *
     * The badge fades out after 1.5s via opacity transition (handled by CSS).
     * The `pointer-events: none` on the badge ensures it cannot be clicked.
     *
     * NOTE: Text is stored ONLY in the user's own browser via localStorage.
     * No data is sent to any server — this is a core privacy guarantee.
     *
     * @returns {void}
     */
    function autoSave() {
        localStorage.setItem('ultraWordCounter_text', DOM.input.value);

        // Flash the "Auto Saved" badge
        DOM.saveBadge.style.opacity = 1;
        setTimeout(() => { DOM.saveBadge.style.opacity = 0; }, 1500);
    }


    /* =========================================================================
       SECTION 8: CUSTOM MODAL SYSTEM
       =========================================================================
       This tool ships with its own lightweight modal dialog system for two
       specific use cases that the global toast cannot handle:

       1. INFO ALERTS — e.g., "Text copied!", "Clean up complete."
          These require the user to acknowledge the message before continuing.

       2. DESTRUCTIVE CONFIRMATIONS — e.g., "Are you sure you want to clear?"
          These require explicit Yes / Cancel choices before a destructive
          action proceeds, preventing accidental data loss.

       The backdrop (#customModal) uses the existing .modal-overlay class from
       tools-template.css Section 11. Only the inner card (.wct-modal-box)
       and its sub-elements have new wct- CSS in Section 19.

       IMPORTANT: This modal is SEPARATE from the global window.showToast()
       system. Toasts are for non-blocking status feedback (e.g., "Copied!").
       This modal is for blocking dialogs that require user interaction.
    ========================================================================= */

    /**
     * Removes all buttons that were previously injected into the modal box,
     * returning a clean reference to the box element for re-use.
     *
     * This is called at the start of both showModal() and showConfirmationModal()
     * so that stale buttons from a previous call are never shown.
     *
     * @returns {HTMLElement} The .wct-modal-box element, cleared of buttons.
     */
    function resetModalButtons() {
        const box = DOM.modal.querySelector('.wct-modal-box');
        box.querySelectorAll('button').forEach(b => b.remove());
        return box;
    }

    /**
     * Displays a simple informational alert modal with a single "OK" button.
     * The user must click OK to dismiss it.
     * Exposed on `window` so utility functions (copyText, cleanText, etc.) can call it.
     *
     * @param {string} msg - The message to display inside the modal.
     * @returns {void}
     */
    window.showModal = function (msg) {
        const box              = resetModalButtons();
        DOM.modalMsg.textContent = msg;
        DOM.modal.style.display  = 'flex'; // Activates the .modal-overlay backdrop

        // Inject a single "OK" dismiss button
        const btn     = document.createElement('button');
        btn.className = 'modal-btn';
        btn.textContent = 'OK';
        btn.onclick   = closeModal;
        box.appendChild(btn);
    };

    /**
     * Displays a confirmation dialog with "Yes, Delete" and "Cancel" buttons.
     * Used exclusively for destructive actions (e.g., clearing all text).
     * The `onConfirm` callback is executed only if the user clicks "Yes, Delete".
     *
     * @param {string}   msg       - Confirmation question to display.
     * @param {Function} onConfirm - Callback to execute if the user confirms.
     * @returns {void}
     */
    window.showConfirmationModal = function (msg, onConfirm) {
        const box              = resetModalButtons();
        DOM.modalMsg.textContent = msg;
        DOM.modal.style.display  = 'flex';

        // "Yes, Delete" — danger-coloured to signal destructive action
        const btnYes               = document.createElement('button');
        btnYes.className           = 'modal-btn';
        btnYes.style.backgroundColor = '#ff4757';
        btnYes.style.marginRight   = '10px';
        btnYes.textContent         = 'Yes, Delete';
        btnYes.onclick             = onConfirm;

        // "Cancel" — neutral-coloured safe exit
        const btnNo               = document.createElement('button');
        btnNo.className           = 'modal-btn';
        btnNo.style.backgroundColor = '#30363d';
        btnNo.textContent         = 'Cancel';
        btnNo.onclick             = closeModal;

        box.appendChild(btnYes);
        box.appendChild(btnNo);
    };

    /**
     * Hides the custom modal by setting display to 'none'.
     * Exposed on `window` so the HTML's fallback `onclick="closeModal()"` works.
     *
     * @returns {void}
     */
    window.closeModal = function () {
        DOM.modal.style.display = 'none';
    };

})(); /* End IIFE — all private variables remain scoped, no global pollution */
