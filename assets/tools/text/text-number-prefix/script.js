/**
 * ============================================================================
 *  NUMBER PREFIX ULTRA PRO MAX — ENTERPRISE CORE ENGINE
 *  File    : script.js
 *  Tool    : Bulk Phone Number & Text Formatter
 *  Version : 3.1.0 (CodeCanyon Enterprise Release)
 *  Author  : Trusted Tools Web — MD KAWSAR
 * ============================================================================
 *
 *  ARCHITECTURE OVERVIEW:
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. CONFIG & STATE        — Central configuration object + processing flag
 *  2. PRESET HANDLER        — Applies quick-preset chip values to inputs
 *  3. SMART PREFIX LOGIC    — Prevents double country codes intelligently
 *  4. PROCESSING ENGINE     — Non-blocking chunk processor using rAF
 *  5. OUTPUT RENDERER       — Writes the final result array to the DOM
 *  6. EXPORT & ACTIONS      — Copy, Download (.txt), and Reset handlers
 *  7. INITIALIZATION        — DOMContentLoaded setup and entry animation
 *
 *  KEY FEATURES:
 *  • Non-blocking chunk processing via requestAnimationFrame (handles 100k+ lines)
 *  • Intelligent Smart Prefix with regex-based normalization
 *  • O(1) duplicate removal using JavaScript Set
 *  • Global toast integration via window.showToast()
 *  • Fully stateless — no localStorage, no server calls
 * ============================================================================
 */


/* ════════════════════════════════════════════════════════════════════════════
   SECTION 1: CONFIGURATION & STATE
   ─────────────────────────────────────────────────────────────────────────
   Central CONFIG object holds all DOM selector IDs and engine settings.
   isProcessing flag prevents double-execution during async chunk runs.
════════════════════════════════════════════════════════════════════════════ */

/**
 * Central configuration object.
 * Keeps all DOM IDs in one place so they are easy to update if the HTML
 * structure changes. Also defines engine parameters like chunk size.
 */
const CONFIG = {
    selectors: {
        input       : 'number-input',    // Main textarea: raw input list
        prefix      : 'prefix-input',    // Text field: prefix to prepend
        suffix      : 'suffix-input',    // Text field: suffix to append
        removeDupes : 'remove-dupes',    // Checkbox: enable duplicate removal
        smartPrefix : 'smart-prefix',    // Checkbox: enable smart prefix logic
        output      : 'output-box',      // Read-only textarea: formatted output
        count       : 'result-count',    // Span: live line count display
        progressBar : 'progress-bar',    // Div: animated progress fill bar
        container   : '.container'       // CSS selector for the main card
    },
    /**
     * Number of lines processed per requestAnimationFrame tick.
     * 5,000 lines keeps each frame under ~12ms, maintaining 60FPS smoothness.
     */
    chunkSize    : 5000,
    /** Duration (ms) before the global toast notification auto-dismisses */
    toastDuration: 3000
};

/**
 * Global processing lock.
 * Set to true while a processing job is running to prevent concurrent runs
 * that could corrupt the output or stack requestAnimationFrame callbacks.
 * @type {boolean}
 */
let isProcessing = false;


/* ════════════════════════════════════════════════════════════════════════════
   SECTION 2: QUICK PRESET HANDLER
   ─────────────────────────────────────────────────────────────────────────
   Applies a predefined prefix/suffix pair to the input fields when the user
   clicks one of the Quick Preset chip buttons in the UI.
════════════════════════════════════════════════════════════════════════════ */

/**
 * Applies a quick preset to the prefix and suffix input fields.
 *
 * When the user clicks a preset chip (e.g., "+880", "WA Link"), this function:
 *   1. Sets the prefix and suffix input values immediately.
 *   2. Plays a brief scale-down animation on the clicked chip for tactile feedback.
 *   3. Shows a global success toast confirming which preset was applied.
 *   4. If the input list is small (< 5,000 chars), auto-triggers processing
 *      silently so the user sees results without an extra click.
 *
 * @param {string} prefix - The prefix string to insert into #prefix-input.
 * @param {string} suffix - The suffix string to insert into #suffix-input.
 */
function setPreset(prefix, suffix) {
    // Apply preset values to their respective input fields
    document.getElementById(CONFIG.selectors.prefix).value = prefix;
    document.getElementById(CONFIG.selectors.suffix).value = suffix;

    // Tactile visual feedback: brief press-down scale on the chip button
    const btn = event.currentTarget;
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => (btn.style.transform = ''), 150);

    // Confirm the action to the user via the global toast system
    window.showToast(`Preset Applied: ${prefix || 'Suffix Only'}`);

    // Auto-trigger processing for small lists — saves the user an extra click
    const content = document.getElementById(CONFIG.selectors.input).value;
    if (content.length > 0 && content.length < 5000) {
        startProcessing(true); // silent=true suppresses the "Processing Complete" toast
    }
}


/* ════════════════════════════════════════════════════════════════════════════
   SECTION 3: CORE LOGIC — SMART PREFIX ENGINE
   ─────────────────────────────────────────────────────────────────────────
   Handles intelligent prefix application so numbers like "88017..." are not
   incorrectly turned into "+880+88017..." when the prefix is "+880".
════════════════════════════════════════════════════════════════════════════ */

/**
 * Applies a prefix to a single line using intelligent normalization rules.
 *
 * This engine runs three checks in priority order before defaulting to a
 * simple string concatenation:
 *
 *   CHECK 1 — Exact Match:
 *     If the line already starts exactly with the prefix, skip it.
 *     e.g., "+88017..." + prefix "+880" → returns "+88017..." unchanged.
 *
 *   CHECK 2 — Numeric Country Code Match (prefix starts with "+"):
 *     If prefix is "+880" and line starts with "880" (no plus),
 *     the function adds the "+" to normalize it: "+880...".
 *
 *   CHECK 3 — International Dialing Prefix "00":
 *     If prefix is "+880" and line starts with "00880",
 *     it strips the "00" and replaces with "+": "+880...".
 *
 *   DEFAULT — Simple Prepend:
 *     If none of the smart checks match, just concatenate prefix + line.
 *
 * @param   {string} line   - A single trimmed line from the input list.
 * @param   {string} prefix - The desired prefix string from the prefix input.
 * @returns {string}          The line with the prefix correctly applied.
 */
function applySmartPrefix(line, prefix) {
    // No prefix specified — return line untouched
    if (!prefix) return line;

    const cleanLine   = line.trim();
    const cleanPrefix = prefix.trim();

    // Empty lines are filtered out in a later phase; skip processing them
    if (!cleanLine) return cleanLine;

    // ── CHECK 1: Exact prefix match — line already has the correct prefix ──
    if (cleanLine.startsWith(cleanPrefix)) {
        return cleanLine;
    }

    // ── CHECK 2 & 3: Numeric normalization for country codes (e.g., +880) ──
    if (cleanPrefix.startsWith('+')) {
        // Extract the numeric portion of the prefix (e.g., "880" from "+880")
        const numberPart = cleanPrefix.substring(1);

        // Case A: Line starts with the raw numeric code (e.g., "88017...")
        // → Add the "+" to normalize it into "+88017..."
        if (cleanLine.startsWith(numberPart)) {
            return '+' + cleanLine;
        }

        // Case B: Line uses the international "00" prefix (e.g., "0088017...")
        // → Strip "00" and replace with "+" to get "+88017..."
        if (cleanLine.startsWith('00' + numberPart)) {
            return '+' + cleanLine.substring(2);
        }
    }

    // ── DEFAULT: No smart match found — simply prepend the prefix ──
    return cleanPrefix + cleanLine;
}


/* ════════════════════════════════════════════════════════════════════════════
   SECTION 4: NON-BLOCKING PROCESSING ENGINE
   ─────────────────────────────────────────────────────────────────────────
   The main entry point (startProcessing) reads all inputs, validates them,
   sets the UI into a loading state, and kicks off the chunk-based async
   processor which uses requestAnimationFrame to stay frame-rate friendly.
════════════════════════════════════════════════════════════════════════════ */

/**
 * Main Processing Entry Point.
 *
 * Orchestrates the entire formatting pipeline:
 *   1. Guards against concurrent runs using the isProcessing flag.
 *   2. Validates that the input textarea is not empty.
 *   3. Reads the prefix, suffix, and checkbox option values.
 *   4. Updates the UI to a "Processing..." loading state.
 *   5. Splits input by newline (handles both \r\n and \n line endings).
 *   6. Optionally deduplicates entries using a JavaScript Set (O(1) lookup).
 *   7. Delegates formatted chunk-processing to processChunks().
 *   8. On completion, restores the UI and shows a success toast.
 *
 * @param {boolean} [silent=false] - When true, suppresses success/error toasts.
 *                                   Used internally by setPreset() auto-runs.
 */
async function startProcessing(silent = false) {
    // ── Guard: Prevent overlapping processing jobs ──
    if (isProcessing) return;

    // ── Validate: Ensure the input field has content ──
    const inputVal = document.getElementById(CONFIG.selectors.input).value;
    if (!inputVal.trim()) {
        if (!silent) window.showToast('⚠️ Please enter numbers first.', true);
        return;
    }

    // ── Set UI to Loading State ──
    isProcessing = true;
    document.body.classList.add('processing');

    const btn             = document.getElementById('process-btn');
    const originalBtnHTML = btn.innerHTML;
    btn.innerHTML         = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    // Reset progress bar to 0 before starting a new run
    const progressBar         = document.getElementById(CONFIG.selectors.progressBar);
    progressBar.style.width   = '0%';

    // ── Snapshot processing options at job start ──
    // Reading once here avoids mid-processing inconsistencies if the user
    // changes a checkbox or input field while chunks are being processed.
    const options = {
        prefix      : document.getElementById(CONFIG.selectors.prefix).value,
        suffix      : document.getElementById(CONFIG.selectors.suffix).value,
        removeDupes : document.getElementById(CONFIG.selectors.removeDupes).checked,
        smartPrefix : document.getElementById(CONFIG.selectors.smartPrefix).checked
    };

    // Use setTimeout to give the browser one render cycle to paint the
    // "Processing..." button state before the heavy JS execution begins.
    setTimeout(() => {

        // ── Phase 0: Split input into an array of raw lines ──
        // The regex /\r?\n/ handles both Windows (\r\n) and Unix (\n) line endings.
        let rawLines = inputVal.split(/\r?\n/);

        // ── Phase 1: Deduplication (Optional) ──
        // Runs BEFORE formatting to save CPU — fewer unique lines to process.
        // Uses a Set for O(1) has() checks, far faster than indexOf() on arrays.
        if (options.removeDupes) {
            const uniqueSet   = new Set();
            const uniqueLines = [];

            for (let i = 0; i < rawLines.length; i++) {
                const trimmed = rawLines[i].trim();
                // Only keep non-empty lines that haven't been seen before
                if (trimmed !== '' && !uniqueSet.has(trimmed)) {
                    uniqueSet.add(trimmed);
                    uniqueLines.push(trimmed);
                }
            }
            rawLines = uniqueLines;
        } else {
            // Even without deduplication, trim whitespace and remove blank lines
            rawLines = rawLines.map(l => l.trim()).filter(l => l !== '');
        }

        // ── Phase 2: Chunk-Based Async Formatting ──
        processChunks(rawLines, options, () => {
            // ── Completion Cleanup Callback ──
            isProcessing = false;
            document.body.classList.remove('processing');
            btn.innerHTML = originalBtnHTML;

            if (!silent) window.showToast('✅ Processing Complete!');
        });

    }, 50); // 50ms delay ensures the browser paints the loading state first
}


/**
 * Non-Blocking Chunk Processor.
 *
 * Divides the full line array into time-sliced batches processed inside
 * requestAnimationFrame callbacks. Each batch processes lines for up to 12ms
 * (leaving ~4ms for the browser to render UI updates in a standard 16ms frame),
 * ensuring the page remains responsive even with 100,000+ line datasets.
 *
 * When all lines are processed, it calls finalizeOutput() to render the result,
 * then invokes the onComplete callback to restore the UI state.
 *
 * @param {string[]}  lines      - Array of cleaned, deduplicated lines to format.
 * @param {Object}    options    - Snapshot of prefix, suffix, and checkbox states.
 * @param {Function}  onComplete - Callback invoked when all chunks are finished.
 */
function processChunks(lines, options, onComplete) {
    const total       = lines.length;
    const outputArray = new Array(total); // Pre-allocate the exact size for performance
    let index         = 0;

    /**
     * Inner batch function — called once per animation frame.
     * Runs a tight loop for up to 12ms, then yields to the browser.
     */
    function processBatch() {
        const frameStart = performance.now();

        // ── Process lines until the 12ms budget runs out or we're done ──
        while (index < total && (performance.now() - frameStart < 12)) {
            let line = lines[index];

            // Apply smart prefix (avoids double codes) or simple concatenation
            if (options.smartPrefix) {
                line = applySmartPrefix(line, options.prefix);
            } else {
                line = (options.prefix || '') + line;
            }

            // Append suffix if one is specified
            if (options.suffix) {
                line = line + options.suffix;
            }

            outputArray[index] = line;
            index++;
        }

        // ── Update progress bar proportionally ──
        const percent = Math.floor((index / total) * 100);
        document.getElementById(CONFIG.selectors.progressBar).style.width = `${percent}%`;

        if (index < total) {
            // Still lines remaining — schedule the next batch on the next frame
            requestAnimationFrame(processBatch);
        } else {
            // All lines processed — render the output and fire the callback
            finalizeOutput(outputArray);
            onComplete();
        }
    }

    // Kick off the first batch
    processBatch();
}


/* ════════════════════════════════════════════════════════════════════════════
   SECTION 5: OUTPUT RENDERER
   ─────────────────────────────────────────────────────────────────────────
   Writes the final processed array to the output textarea and updates the
   live line count badge. Also applies a brief border-color pulse to draw
   the user's eye to the result.
════════════════════════════════════════════════════════════════════════════ */

/**
 * Renders the final processed result to the DOM.
 *
 * - Joins the output array with newlines and writes it to the read-only textarea.
 * - Updates the "Total: N Lines" count badge with a highlighted number span.
 * - Applies a brief brand-color border pulse on the output textarea to
 *   visually signal that new results are ready.
 *
 * @param {string[]} resultArray - The fully formatted array of output lines.
 */
function finalizeOutput(resultArray) {
    const outputBox  = document.getElementById(CONFIG.selectors.output);
    const countLabel = document.getElementById(CONFIG.selectors.count);

    // Write the processed lines as a newline-delimited string
    outputBox.value = resultArray.join('\n');

    // Update the count badge — JS injects a colored span for the number
    countLabel.innerHTML =
        `Total: <span style="color:var(--brand-primary)">${resultArray.length.toLocaleString()}</span> Lines`;

    // Brief border-color pulse: grabs attention without being disruptive
    outputBox.style.borderColor = 'var(--brand-primary)';
    setTimeout(() => (outputBox.style.borderColor = ''), 600);
}


/* ════════════════════════════════════════════════════════════════════════════
   SECTION 6: EXPORT & ACTION HANDLERS
   ─────────────────────────────────────────────────────────────────────────
   Three user-triggered actions:
     copyResult()     — Clipboard copy via the Async Clipboard API
     downloadResult() — Downloads a timestamped .txt file
     resetTool()      — Clears all inputs, output, and counters
════════════════════════════════════════════════════════════════════════════ */

/**
 * Copies the output textarea content to the system clipboard.
 *
 * Uses the modern Async Clipboard API (navigator.clipboard.writeText) with
 * a graceful fallback to the legacy document.execCommand('copy') for
 * environments that do not support the modern API (e.g., some older Android
 * WebViews or non-HTTPS contexts).
 *
 * Shows an error toast if the output box is empty.
 */
async function copyResult() {
    const outputBox = document.getElementById(CONFIG.selectors.output);

    // Guard: nothing to copy if the output is empty
    if (!outputBox.value) {
        window.showToast('⚠️ Nothing to copy! Run the processor first.', true);
        return;
    }

    try {
        // Modern Async Clipboard API — preferred, works on HTTPS pages
        await navigator.clipboard.writeText(outputBox.value);
        window.showToast('📋 Copied to Clipboard!');
    } catch (err) {
        // Legacy fallback: select the textarea text and copy via execCommand
        outputBox.select();
        document.execCommand('copy');
        window.showToast('📋 Copied!');
    }
}


/**
 * Generates a downloadable plain-text (.txt) file of the processed output.
 *
 * Creates an in-memory Blob from the output textarea's value, generates a
 * temporary Object URL, simulates a link click to trigger the browser's
 * native file download dialog, and then cleans up the DOM element and URL.
 *
 * The filename includes an ISO 8601 date stamp for easy identification
 * (e.g., "Formatted_Numbers_2025-08-01.txt").
 *
 * Shows an error toast if the output is empty.
 */
function downloadResult() {
    const text = document.getElementById(CONFIG.selectors.output).value;

    // Guard: cannot download if there is no processed output
    if (!text) {
        window.showToast('⚠️ Generate data first before downloading!', true);
        return;
    }

    // Build a UTF-8 plain-text Blob from the output string
    const blob       = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url        = URL.createObjectURL(blob);

    // Create a temporary anchor, trigger the download, then clean up
    const a          = document.createElement('a');
    a.href           = url;
    a.download       = `Formatted_Numbers_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();

    // Revoke the Object URL and remove the anchor after a short delay
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    window.showToast('⬇️ Downloading your file...');
}


/**
 * Resets all tool inputs and outputs to their initial empty state.
 *
 * Prompts the user with a browser confirm dialog before clearing data,
 * preventing accidental loss of a large processed list.
 *
 * Clears:
 *   - The main number-input textarea
 *   - The prefix and suffix text inputs
 *   - The read-only output textarea
 *   - The result count label
 *   - The progress bar fill width
 */
function resetTool() {
    // Require explicit confirmation before destroying the user's work
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) return;

    document.getElementById(CONFIG.selectors.input).value       = '';
    document.getElementById(CONFIG.selectors.prefix).value      = '';
    document.getElementById(CONFIG.selectors.suffix).value      = '';
    document.getElementById(CONFIG.selectors.output).value      = '';
    document.getElementById(CONFIG.selectors.count).innerText   = 'Total: 0 Lines';
    document.getElementById(CONFIG.selectors.progressBar).style.width = '0%';

    window.showToast('🗑️ Canvas Cleared. Ready for a new list.');
}


/* ════════════════════════════════════════════════════════════════════════════
   SECTION 7: INITIALIZATION
   ─────────────────────────────────────────────────────────────────────────
   Runs after the DOM is fully loaded. Adds the entry animation class to the
   tool card and wires up any supplementary event listeners.
════════════════════════════════════════════════════════════════════════════ */

/**
 * DOMContentLoaded initialization handler.
 *
 * Fires once the HTML document has been fully parsed (before sub-resources
 * like images finish loading). Used here to:
 *   1. Mark the main container as "loaded" to trigger its CSS entry animation.
 *   2. (Extensible) Wire up any additional keyboard shortcuts or event listeners.
 *
 * NOTE: The global theme system (dark/light toggle) is managed entirely by
 * global.js and requires no setup here.
 */
document.addEventListener('DOMContentLoaded', () => {

    // Add the 'loaded' class to the main container to trigger CSS fade-in
    const container = document.querySelector(CONFIG.selectors.container);
    if (container) {
        container.classList.add('loaded');
    }

    // ── Keyboard Shortcut: Ctrl+Enter / Cmd+Enter to process ──
    // Provides a power-user shortcut so users don't have to reach for the mouse.
    document.getElementById(CONFIG.selectors.input).addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            startProcessing();
        }
    });

});
