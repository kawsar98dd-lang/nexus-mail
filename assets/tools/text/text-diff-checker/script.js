/*
 * =============================================================================
 *  ULTRA DIFF PRO MAX — ENTERPRISE EDITION CORE
 * =============================================================================
 *  Tool      : Text & Code Diff Checker
 *  Author    : MD KAWSAR
 *  Project   : Trusted Tools Web (CodeCanyon Release Build)
 *  Features  :
 *    • Threaded diff engine via Web Worker (non-blocking UI)
 *    • High-performance incremental DOM rendering with DocumentFragment
 *    • Synchronized scroll engine (initiator / receiver anti-loop pattern)
 *    • Split View and Unified View rendering modes
 *    • JSON & HTML/XML Beautifier + Minifier
 *    • Drag-and-Drop and File Upload support
 *    • One-click styled HTML Diff Report export
 *    • XSS-safe diff output via manual character escaping
 *    • Integrates with the global Trusted Tools toast notification system
 * =============================================================================
 */

(function () {

    /* =========================================================================
       SECTION 1 — APPLICATION STATE & DOM CACHE
       =========================================================================
       All mutable application flags live in a single `State` object so that
       the state is easy to inspect during debugging and never leaks into the
       global `window` scope.

       `DOM` caches every frequently accessed element reference at startup.
       Querying the DOM repeatedly inside hot loops is expensive; caching once
       is a meaningful performance optimization for large diffs.
    ========================================================================= */

    /**
     * @type {Object} State — Central mutable application state
     * @property {string}       view          - Current render mode: 'split' | 'unified'
     * @property {boolean}      isProcessing  - Guard flag: prevents double-submission
     * @property {Element|null} activeScroll  - The element currently driving sync scroll
     * @property {Worker|null}  worker        - Reference to the spawned Web Worker instance
     * @property {boolean}      wrap          - Word Wrap toggle state
     */
    const State = {
        view          : 'split',
        isProcessing  : false,
        activeScroll  : null,
        worker        : null,
        wrap          : false
    };

    /**
     * @type {Object} DOM — Pre-resolved element references
     * All elements are captured once on script execution to minimize
     * repeated document.getElementById calls during runtime.
     */
    const DOM = {
        t1     : document.getElementById('text1'),
        t2     : document.getElementById('text2'),
        drop1  : document.getElementById('dropZone1'),
        drop2  : document.getElementById('dropZone2'),
        output : document.getElementById('diff-output'),
        results: document.getElementById('diff-results'),
        loader : document.getElementById('loader'),
        stats  : {
            rem  : document.getElementById('rem-count'),
            add  : document.getElementById('add-count'),
            char1: document.getElementById('stat1'),
            char2: document.getElementById('stat2')
        },
        btns: {
            compare: document.getElementById('btnCompare'),
            split  : document.getElementById('btnSplit'),
            unified: document.getElementById('btnUnified'),
            wrap   : document.getElementById('btnWrap'),
            format : document.getElementById('btnFormat'),
            minify : document.getElementById('btnMinify'),
            clear  : document.getElementById('btnClear')
        }
    };


    /* =========================================================================
       SECTION 2 — SECURE XSS SANITIZATION
       =========================================================================
       All user-provided text that gets injected into innerHTML MUST pass
       through sanitize() first.  This replaces the five HTML-significant
       characters with their named entity equivalents, preventing any
       script injection via maliciously crafted input text or code.
    ========================================================================= */

    /**
     * Escapes HTML special characters to prevent XSS injection.
     * Applied to every user-supplied string before it is written
     * into .innerHTML inside the diff renderer.
     *
     * @param  {string} str - Raw user input string
     * @returns {string}     - HTML-entity-encoded safe string
     */
    const sanitize = (str) => {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, (m) => map[m]);
    };


    /* =========================================================================
       SECTION 3 — WEB WORKER INITIALIZATION
       =========================================================================
       The diff algorithm (jsdiff's Diff.diffLines) can be CPU-intensive for
       very large files.  Running it on the main thread would freeze the UI.

       We spawn a Web Worker via a Blob URL (no separate .js file required).
       The Worker imports the jsdiff library using importScripts(), performs
       the diff, then postMessage()s the result back to the main thread.

       handleWorkerMessage() receives the result and triggers rendering.
    ========================================================================= */

    /**
     * Creates and returns a new Web Worker that runs the jsdiff engine.
     * The Worker script is constructed as an inline Blob to avoid needing
     * a dedicated worker JS file on the server.
     *
     * @returns {Worker|null} - The spawned Worker, or null if Workers are unsupported
     */
    const initWorker = () => {
        if (!window.Worker) return null;

        /* Absolute URL to the jsdiff library so importScripts() can resolve it */
        const libPath = window.location.origin + '/assets/library/diff-engine/diff.min.js';

        /* Inline Worker source — runs inside an isolated thread */
        const script = `
            importScripts('${libPath}');

            self.onmessage = function(e) {
                const { t1, t2 } = e.data;
                try {
                    if (typeof Diff === 'undefined') {
                        throw new Error("Diff Engine not loaded inside worker");
                    }

                    /* Run the line-level diff algorithm */
                    const diff = Diff.diffLines(t1, t2);

                    /* Tally added / removed line counts for the stats bar */
                    let added = 0, removed = 0;
                    diff.forEach(p => {
                        if (!p.value) return;
                        const lc = p.value.replace(/\\n$/, '').split('\\n').length;
                        if (p.added)   added   += lc;
                        if (p.removed) removed += lc;
                    });

                    self.postMessage({ success: true, diff, added, removed });

                } catch (err) {
                    self.postMessage({ success: false, error: err.message });
                }
            };
        `;

        const blob   = new Blob([script], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = handleWorkerMessage;
        return worker;
    };

    /**
     * Callback invoked when the Web Worker finishes processing.
     * Hides the loading overlay, re-enables the Compare button, and
     * either renders the diff result or shows an error toast.
     *
     * @param {MessageEvent} e - Message event from the Worker; e.data contains
     *                           { success, diff, added, removed } on success
     *                           or { success: false, error: string } on failure
     */
    const handleWorkerMessage = (e) => {
        DOM.loader.classList.add('hidden');
        DOM.btns.compare.disabled = false;
        State.isProcessing = false;

        if (e.data.success) {
            renderDiff(e.data);
        } else {
            /* Pass true as the second argument to trigger the error (red) toast */
            window.showToast(`Worker Error: ${e.data.error}`, true);
        }
    };

    /* Spawn the worker immediately on page load */
    State.worker = initWorker();


    /* =========================================================================
       SECTION 4 — CORE DIFF ENGINE: TRIGGER & RENDER
       =========================================================================
       triggerCompare() is the entry point for a diff operation.
         1. Guards against double-submission via State.isProcessing.
         2. Short-circuits with a "Perfect Match" result when texts are identical
            (avoids sending identical strings to the worker at all).
         3. Posts the two text values to the Worker for async processing.
         4. Falls back to synchronous Diff.diffLines() if Workers are unavailable.

       renderDiff() converts the flat diff array from jsdiff into DOM nodes.
         • Unified view  : single-column rows with +/- prefix and background color.
         • Split view    : two half-panels per row with a lookahead for modification
                           blocks (removed → immediately followed by added) paired
                           side-by-side for the best possible visual comparison.
    ========================================================================= */

    /**
     * Initiates a diff comparison operation.
     * Guards processing state, handles the identical-text shortcut,
     * and dispatches the payload to the Web Worker.
     */
    const triggerCompare = () => {
        /* Prevent duplicate submission while a diff is in progress */
        if (State.isProcessing) return;

        const val1 = DOM.t1.value;
        const val2 = DOM.t2.value;

        /* Require at least one editor to have content */
        if (!val1 && !val2) {
            return window.showToast("Please input text to compare.", true);
        }

        /* Show the loading overlay and disable the button */
        DOM.loader.classList.remove('hidden');
        DOM.btns.compare.disabled = true;
        State.isProcessing = true;

        /* ── IDENTICAL CHECK OPTIMISATION ──
           If both texts are character-for-character identical we can skip
           the diff algorithm entirely and render a "Perfect Match" result.
           A small artificial delay (400ms) preserves the UX sensation of
           real work being performed. */
        if (val1 === val2) {
            setTimeout(() => {
                DOM.loader.classList.add('hidden');
                DOM.btns.compare.disabled = false;
                State.isProcessing = false;
                DOM.results.classList.remove('hidden');
                DOM.stats.rem.textContent = '0';
                DOM.stats.add.textContent = '0';
                DOM.output.innerHTML = `
                    <div style="padding: 50px; text-align: center; color: #00ff9d;">
                        <i class="fa-solid fa-circle-check" style="font-size: 48px; margin-bottom: 20px;"></i>
                        <h3 style="margin:0;">Perfect Match!</h3>
                        <p style="color: var(--text-muted); margin-top:10px;">The files are identical.</p>
                    </div>`;
                DOM.results.scrollIntoView({ behavior: 'smooth' });
                window.showToast("Files are identical!");
            }, 400);
            return;
        }

        /* ── DISPATCH TO WORKER (or synchronous fallback) ── */
        if (State.worker) {
            /* Primary path: non-blocking threaded computation */
            State.worker.postMessage({ t1: val1, t2: val2 });
        } else {
            /* Fallback: Web Workers not available (very old browsers) */
            try {
                const diff = Diff.diffLines(val1, val2);
                renderDiff({ success: true, diff, added: 0, removed: 0 });
            } catch (e) {
                window.showToast("Processing Error — Diff library unavailable.", true);
            }
        }
    };

    /**
     * Renders the diff result array into the #diff-output container.
     * Uses a DocumentFragment for batched DOM insertion (single reflow).
     * Supports two rendering modes controlled by State.view:
     *   - 'unified' : each changed line on its own row with +/- prefix
     *   - 'split'   : side-by-side half-panels; modification blocks paired
     *
     * @param {Object} data - Payload from the Worker or fallback call
     * @param {Array}  data.diff    - Array of jsdiff part objects
     * @param {number} data.removed - Total removed line count
     * @param {number} data.added   - Total added line count
     */
    const renderDiff = (data) => {
        /* Reveal the results section */
        DOM.results.classList.remove('hidden');
        DOM.stats.rem.textContent = data.removed;
        DOM.stats.add.textContent = data.added;
        DOM.output.innerHTML = '';

        /* Apply the correct diff view class and word-wrap setting */
        DOM.output.className = `dif-content ${State.view === 'split' ? 'diff-view-split' : 'diff-view-unified'}`;
        DOM.output.style.whiteSpace = State.wrap ? 'pre-wrap' : 'pre';

        /* DocumentFragment batches all row insertions — avoids n reflows */
        const fragment = document.createDocumentFragment();
        let lLine = 1, rLine = 1; // Running line-number counters for left / right gutter

        if (State.view === 'unified') {
            /* ── UNIFIED VIEW ── */
            data.diff.forEach(part => {
                /* Strip the trailing newline before splitting into lines */
                const lines = part.value.replace(/\n$/, '').split('\n');

                /* Determine CSS classes based on whether lines were added/removed */
                const color = part.added ? 'text-add' : part.removed ? 'text-rem' : '';
                const bg    = part.added ? 'bg-add'   : part.removed ? 'bg-rem'   : '';

                lines.forEach(line => {
                    const row = document.createElement('div');
                    row.className = `diff-row ${bg}`;

                    if (part.added) {
                        row.innerHTML = `<div class="line-num">+${rLine++}</div><div class="line-code ${color}">${sanitize(line)}</div>`;
                    } else if (part.removed) {
                        row.innerHTML = `<div class="line-num">-${lLine++}</div><div class="line-code ${color}">${sanitize(line)}</div>`;
                    } else {
                        lLine++; rLine++;
                        row.innerHTML = `<div class="line-num">${rLine - 1}</div><div class="line-code">${sanitize(line)}</div>`;
                    }
                    fragment.appendChild(row);
                });
            });

        } else {
            /* ── SPLIT VIEW ── */
            for (let i = 0; i < data.diff.length; i++) {
                const part  = data.diff[i];
                const lines = part.value.replace(/\n$/, '').split('\n');

                /* ── LOOKAHEAD: Modification Block (removed → added pair) ──
                   When a "removed" part is immediately followed by an "added"
                   part, we pair them side-by-side (original left, modified right)
                   for maximum visual clarity.  If one side has more lines we
                   pad the shorter side with empty placeholder cells. */
                if (part.removed && data.diff[i + 1] && data.diff[i + 1].added) {
                    const next      = data.diff[i + 1];
                    const nextLines = next.value.replace(/\n$/, '').split('\n');
                    const max       = Math.max(lines.length, nextLines.length);

                    for (let j = 0; j < max; j++) {
                        const row = document.createElement('div');
                        row.className = 'diff-row';

                        /* ── Left half (deleted line) ── */
                        let lHTML  = `<div class="line-num" style="border:none"></div><div class="line-code bg-empty"></div>`;
                        let lClass = 'bg-empty';
                        if (lines[j] !== undefined) {
                            lHTML  = `<div class="line-num">${lLine++}</div><div class="line-code text-rem">${sanitize(lines[j])}</div>`;
                            lClass = 'bg-rem';
                        }

                        /* ── Right half (inserted line) ── */
                        let rHTML  = `<div class="line-num" style="border:none"></div><div class="line-code bg-empty"></div>`;
                        let rClass = 'bg-empty';
                        if (nextLines[j] !== undefined) {
                            rHTML  = `<div class="line-num">${rLine++}</div><div class="line-code text-add">${sanitize(nextLines[j])}</div>`;
                            rClass = 'bg-add';
                        }

                        row.innerHTML = `<div class="diff-half ${lClass}">${lHTML}</div><div class="diff-half ${rClass}">${rHTML}</div>`;
                        fragment.appendChild(row);
                    }

                    i++; /* Skip the paired "added" part — already consumed above */

                } else if (part.removed) {
                    /* Deletion with no corresponding insertion — left side only */
                    lines.forEach(l => {
                        const row = document.createElement('div');
                        row.className = 'diff-row';
                        row.innerHTML = `<div class="diff-half bg-rem"><div class="line-num">${lLine++}</div><div class="line-code text-rem">${sanitize(l)}</div></div><div class="diff-half bg-empty"><div class="line-num" style="border:none"></div><div class="line-code"></div></div>`;
                        fragment.appendChild(row);
                    });

                } else if (part.added) {
                    /* Insertion with no corresponding deletion — right side only */
                    lines.forEach(l => {
                        const row = document.createElement('div');
                        row.className = 'diff-row';
                        row.innerHTML = `<div class="diff-half bg-empty"><div class="line-num" style="border:none"></div><div class="line-code"></div></div><div class="diff-half bg-add"><div class="line-num">${rLine++}</div><div class="line-code text-add">${sanitize(l)}</div></div>`;
                        fragment.appendChild(row);
                    });

                } else {
                    /* Unchanged lines — identical content on both sides */
                    lines.forEach(l => {
                        const row  = document.createElement('div');
                        row.className = 'diff-row';
                        const safe = sanitize(l);
                        row.innerHTML = `<div class="diff-half"><div class="line-num">${lLine++}</div><div class="line-code">${safe}</div></div><div class="diff-half"><div class="line-num">${rLine++}</div><div class="line-code">${safe}</div></div>`;
                        fragment.appendChild(row);
                    });
                }
            }
        }

        /* Single DOM insertion — one reflow for the entire diff output */
        DOM.output.appendChild(fragment);
        DOM.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.showToast("Comparison Complete ✓");
    };


    /* =========================================================================
       SECTION 5 — FILE HANDLING & DRAG-AND-DROP
       =========================================================================
       updateStats()  — Refreshes the character count badges in each editor header.
       handleFile()   — Reads a File object via FileReader and populates a textarea.
       Drag-and-Drop  — Listens for dragover / dragleave / drop on both dropZones.
    ========================================================================= */

    /**
     * Updates the live character count badges below each editor header.
     * Called on every `input` event and after any content mutation.
     */
    const updateStats = () => {
        DOM.stats.char1.textContent = DOM.t1.value.length.toLocaleString() + " chars";
        DOM.stats.char2.textContent = DOM.t2.value.length.toLocaleString() + " chars";
    };

    /**
     * Reads a File object as plain text and populates the target textarea.
     * Enforces a 10 MB soft limit — warns the user but does not block loading.
     *
     * @param {File}            file     - The File object from input.files or dataTransfer
     * @param {HTMLTextAreaElement} textarea - The target editor textarea element
     */
    const handleFile = (file, textarea) => {
        if (!file) return;

        /* Warn for very large files that may cause slow processing */
        if (file.size > 10 * 1024 * 1024) {
            window.showToast("File exceeds 10 MB — performance may degrade.", true);
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            textarea.value = e.target.result;
            updateStats();
            window.showToast("File loaded successfully");
        };
        reader.readAsText(file);
    };

    /* Live character count update on every keystroke */
    DOM.t1.addEventListener('input', updateStats);
    DOM.t2.addEventListener('input', updateStats);

    /* Hidden file-input triggers — called from onclick="triggerFile(1/2)" in HTML */
    window.triggerFile = (id) => document.getElementById(`fileInput${id}`).click();

    document.getElementById('fileInput1').addEventListener('change', (e) => {
        handleFile(e.target.files[0], DOM.t1);
    });
    document.getElementById('fileInput2').addEventListener('change', (e) => {
        handleFile(e.target.files[0], DOM.t2);
    });

    /* ── Drag-and-Drop for both editor drop zones ── */
    [DOM.drop1, DOM.drop2].forEach((zone, idx) => {
        const textarea = idx === 0 ? DOM.t1 : DOM.t2;

        /* Indicate a valid drop target by adding the drag-active highlight class */
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-active');
        });

        /* Remove highlight when the drag leaves the zone */
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-active');
        });

        /* Accept the dropped file and load it into the textarea */
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-active');
            if (e.dataTransfer.files.length) {
                handleFile(e.dataTransfer.files[0], textarea);
            }
        });
    });


    /* =========================================================================
       SECTION 6 — TOOLS & UTILITIES
       =========================================================================
       A collection of editor utility functions grouped in the `tools` object:

       setView()      — Switches between 'split' and 'unified' rendering modes
       toggleWrap()   — Toggles word-wrap on both editors and the diff output
       beautify()     — Formats JSON (JSON.stringify) and XML/HTML (regex indent)
       minify()       — Compresses JSON or strips extra whitespace from text
       clear()        — Clears both editors after a confirmation prompt
       copyChanges()  — Copies only the +/- diff lines to clipboard
       exportReport() — Generates and downloads a standalone HTML diff report
    ========================================================================= */

    const tools = {

        /**
         * Switches the diff rendering mode between 'split' and 'unified'.
         * If the diff output already contains rendered rows, a fresh comparison
         * is triggered so the existing data is re-rendered in the new layout.
         *
         * @param {'split'|'unified'} mode - The desired view mode
         */
        setView: (mode) => {
            State.view = mode;
            DOM.btns.split.classList.toggle('active', mode === 'split');
            DOM.btns.unified.classList.toggle('active', mode === 'unified');

            /* Re-render only if there is already a diff result to display */
            if (DOM.output.hasChildNodes()) triggerCompare();
        },

        /**
         * Toggles word-wrap on both input textareas and the diff output panel.
         * The active state of the Wrap toolbar button is updated accordingly.
         */
        toggleWrap: () => {
            State.wrap = !State.wrap;
            const val = State.wrap ? 'pre-wrap' : 'pre';
            DOM.t1.style.whiteSpace     = val;
            DOM.t2.style.whiteSpace     = val;
            DOM.output.style.whiteSpace = val;
            DOM.btns.wrap.classList.toggle('active', State.wrap);
            window.showToast(`Word Wrap: ${State.wrap ? 'ON' : 'OFF'}`);
        },

        /**
         * Attempts to beautify (pretty-print) the content of both editors.
         * Supports two formats:
         *   • JSON  — parsed and re-serialised with 4-space indentation.
         *   • HTML/XML — naively formatted by splitting on ><.
         * Unsupported formats are left unchanged.  Stats are refreshed after.
         */
        beautify: () => {
            let count = 0;
            [DOM.t1, DOM.t2].forEach(t => {
                const v = t.value.trim();
                if (!v) return;
                try {
                    if (v.startsWith('{') || v.startsWith('[')) {
                        /* ── JSON Beautifier ── */
                        t.value = JSON.stringify(JSON.parse(v), null, 4);
                        count++;
                    } else if (v.startsWith('<')) {
                        /* ── HTML/XML Naive Indenter ──
                           Splits on ><, tracks closing tag indentation depth */
                        let formatted = '', indent = 0;
                        v.split(/>\s*</).forEach(node => {
                            if (node.match(/^\/\w/)) indent = Math.max(0, indent - 1);
                            formatted += '  '.repeat(indent) + '<' + node + '>\r\n';
                            if (node.match(/^[^/]/) && !node.match(/\/$/) && !node.match(/<.*\/>/)) indent++;
                        });
                        t.value = formatted.substring(1, formatted.length - 3);
                        count++;
                    }
                } catch (e) {
                    console.warn("Formatting failed for one input — content may not be valid JSON/XML.");
                }
            });
            updateStats();
            count > 0
                ? window.showToast("Content Beautified ✓")
                : window.showToast("No valid JSON/XML detected.", true);
        },

        /**
         * Minifies the content of both editors.
         * JSON content is parsed and re-serialised without whitespace.
         * All other content has newlines and extra spaces collapsed.
         */
        minify: () => {
            [DOM.t1, DOM.t2].forEach(t => {
                if (!t.value) return;
                try {
                    /* Attempt JSON parse/re-serialise (removes all whitespace) */
                    t.value = JSON.stringify(JSON.parse(t.value));
                } catch (e) {
                    /* Fallback: strip newlines and collapse multiple spaces */
                    t.value = t.value.replace(/\r?\n|\r/g, '').replace(/\s{2,}/g, ' ').trim();
                }
            });
            updateStats();
            window.showToast("Content Minified ✓");
        },

        /**
         * Clears both editors and hides the diff results section.
         * Prompts for confirmation first to prevent accidental data loss.
         */
        clear: () => {
            if (confirm("Are you sure you want to clear both editors?")) {
                DOM.t1.value = '';
                DOM.t2.value = '';
                DOM.results.classList.add('hidden');
                updateStats();
                window.showToast("Workspace Cleared");
            }
        },

        /**
         * Copies only the changed lines (prefixed with + or -) from the
         * unified or split diff output to the clipboard.
         * Requires the Clipboard API (available in all modern browsers).
         */
        copyChanges: () => {
            const text = DOM.output.innerText
                .split('\n')
                .filter(l => l.startsWith('+') || l.startsWith('-'))
                .join('\n');

            if (!text) return window.showToast("No differences to copy.", true);

            navigator.clipboard.writeText(text)
                .then(() => window.showToast("Changes copied to clipboard ✓"));
        },

        /**
         * Generates a standalone, self-contained HTML diff report and
         * triggers a browser download.  The report embeds minimal inline CSS
         * for readability and captures the current diff output innerHTML.
         * Requires an active comparison result in the DOM.
         */
        exportReport: () => {
            if (DOM.results.classList.contains('hidden')) {
                return window.showToast("Run a comparison first before exporting.", true);
            }

            /* Minimal inline CSS — makes the downloaded report legible without
               any dependency on the parent site's stylesheets */
            const css = `
                body { font-family: sans-serif; padding: 20px; background: #fff; }
                h2, p { margin-bottom: 10px; }
                .diff-row { display: flex; border-bottom: 1px solid #ccc; }
                .line-num { min-width: 40px; color: #888; background: #f0f0f0;
                            padding: 5px; border-right: 1px solid #ccc; font-size: 12px; }
                .line-code { flex: 1; white-space: pre-wrap; font-family: monospace;
                             padding: 5px; font-size: 12px; }
                .bg-add  { background: #e6ffec; }
                .bg-rem  { background: #ffebe9; }
                .text-add { color: #1a7f37; }
                .text-rem { color: #cf222e; }
                .diff-half { width: 50%; display: flex; border-right: 1px solid #ccc; }
                .diff-half:last-child { border-right: none; }
                .bg-empty { background: #fafafa; }
            `;

            const content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Diff Report — Ultra Diff Pro Max</title>
    <style>${css}</style>
</head>
<body>
    <h2>Comparison Report</h2>
    <p>Generated by <strong>Ultra Diff Pro Max</strong> — Trusted Tools Web</p>
    <p>Removed: <strong style="color:#cf222e">${DOM.stats.rem.textContent} lines</strong> &nbsp;|&nbsp;
       Added: <strong style="color:#1a7f37">${DOM.stats.add.textContent} lines</strong></p>
    <div style="border: 1px solid #ccc; border-radius: 6px; overflow: hidden;">
        ${DOM.output.innerHTML}
    </div>
</body>
</html>`;

            const blob = new Blob([content], { type: 'text/html' });
            const a    = document.createElement('a');
            a.href     = URL.createObjectURL(blob);
            a.download = `diff-report-${Date.now()}.html`;
            a.click();

            window.showToast("Diff Report saved ✓");
        }
    };


    /* =========================================================================
       SECTION 7 — SYNC SCROLLING ENGINE
       =========================================================================
       When the user scrolls one editor, the other editor mirrors the scroll
       position proportionally.  A simple event-listener-only approach causes
       infinite feedback loops (A scrolls B → B fires scroll → B scrolls A…).

       This implementation uses an "initiator" lock:
         • The element that the user's mouse is hovering (tracked via mouseenter)
           is registered as the "active scroller".
         • syncScroll() is a no-op if the calling element is not the active one.
         • A 50 ms debounced timeout resets the lock after scroll ends.
    ========================================================================= */

    /**
     * Mirrors the scroll position of `initiator` onto `receiver`.
     * Uses proportional scroll calculation to handle differing scroll heights.
     * A guard on State.activeScroll prevents feedback-loop oscillation.
     *
     * @param {HTMLElement} initiator - The element being scrolled by the user
     * @param {HTMLElement} receiver  - The element that should mirror the scroll
     */
    const syncScroll = (initiator, receiver) => {
        /* Block if a different element is currently driving the scroll */
        if (State.activeScroll && State.activeScroll !== initiator) return;

        State.activeScroll = initiator;

        /* Proportional scroll: map initiator's scroll % to receiver's range */
        const p   = initiator.scrollTop / (initiator.scrollHeight - initiator.clientHeight);
        const top = p * (receiver.scrollHeight - receiver.clientHeight);

        receiver.scrollTop  = top;
        receiver.scrollLeft = initiator.scrollLeft;

        /* Debounce the active-scroller reset to 50 ms after last scroll event */
        clearTimeout(initiator.scrollTimeout);
        initiator.scrollTimeout = setTimeout(() => { State.activeScroll = null; }, 50);
    };

    /* Attach synchronized scroll listeners to both textareas */
    DOM.t1.addEventListener('scroll', () => syncScroll(DOM.t1, DOM.t2));
    DOM.t2.addEventListener('scroll', () => syncScroll(DOM.t2, DOM.t1));

    /* Register which editor has mouse focus so syncScroll can determine the
       initiator without requiring pointer-event inspection on every scroll */
    DOM.t1.addEventListener('mouseenter', () => { State.activeScroll = DOM.t1; });
    DOM.t2.addEventListener('mouseenter', () => { State.activeScroll = DOM.t2; });


    /* =========================================================================
       SECTION 8 — EVENT BINDINGS
       =========================================================================
       All interactive UI elements are wired here in one consolidated block.
       Using .onclick assignment (rather than addEventListener) is intentional:
       it prevents duplicate listeners if the script is re-evaluated in any
       hot-module environment, and keeps bindings easy to audit.
    ========================================================================= */

    /* ── Primary CTA: Compare button ── */
    DOM.btns.compare.onclick = triggerCompare;

    /* ── Toolbar: View Mode Toggles ── */
    DOM.btns.split.onclick   = () => tools.setView('split');
    DOM.btns.unified.onclick = () => tools.setView('unified');

    /* ── Toolbar: Utilities ── */
    DOM.btns.wrap.onclick    = tools.toggleWrap;
    DOM.btns.format.onclick  = tools.beautify;
    DOM.btns.minify.onclick  = tools.minify;
    DOM.btns.clear.onclick   = tools.clear;

    /* ── Results Actions ── */
    document.getElementById('btnCopyChanges').onclick = tools.copyChanges;
    document.getElementById('btnExport').onclick      = tools.exportReport;

    /* ── Mid Controls: Swap and Copy ── */

    /**
     * Swap button — exchanges the contents of both editors using array
     * destructuring assignment.  Refreshes stats after the swap.
     */
    document.getElementById('btnSwap').onclick = () => {
        [DOM.t1.value, DOM.t2.value] = [DOM.t2.value, DOM.t1.value];
        updateStats();
        window.showToast("Contents Swapped");
    };

    /**
     * Copy Original → Modified button.
     * Overwrites the Modified editor with the content of the Original editor.
     */
    document.getElementById('btnCopyRight').onclick = () => {
        DOM.t2.value = DOM.t1.value;
        updateStats();
        window.showToast("Copied to Modified");
    };

    /**
     * Copy Modified → Original button.
     * Overwrites the Original editor with the content of the Modified editor.
     */
    document.getElementById('btnCopyLeft').onclick = () => {
        DOM.t1.value = DOM.t2.value;
        updateStats();
        window.showToast("Copied to Original");
    };


    /* =========================================================================
       SECTION 9 — INITIALISATION
       =========================================================================
       Set the default view (Split) by calling tools.setView() which applies
       the correct .active class to the Split button.  All other state is
       already initialised at declaration time in the State object.
    ========================================================================= */

    /* Apply the default Split View selection on page load */
    tools.setView('split');

})();
