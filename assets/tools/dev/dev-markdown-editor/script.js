/**
 * =============================================================================
 *  Pro Markdown Studio Max — Application Logic Engine
 *  File    : script.js
 *  Version : 3.0.0 (CodeCanyon Release Build)
 *  Author  : MD KAWSAR | Trusted Tools Web
 *
 *  Architecture:
 *    This entire module is wrapped in an IIFE (Immediately Invoked Function
 *    Expression) using the Revealing Module Pattern. All internal functions
 *    are private by default. Only the public API object returned at the
 *    bottom is exposed to the global scope as `window.MDStudio`.
 *
 *  Key Responsibilities:
 *    - Parse & sanitize raw Markdown into safe HTML (marked.js + DOMPurify)
 *    - Debounced live preview rendering on every keystroke
 *    - Auto-save document to LocalStorage after every change
 *    - Synchronize editor / preview scroll positions (hover-lock technique)
 *    - Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+S, Tab)
 *    - Export to PDF (html2pdf.js), to HTML blob, and to .md file
 *    - Provide tab-switching API for the mobile "Write / Preview" toggle
 *    - Update live word / line / character statistics on every render
 *
 *  Global Dependencies (loaded via <script> in HTML):
 *    - marked.js     — Markdown → HTML parser
 *    - DOMPurify.js  — XSS sanitizer
 *    - highlight.js  — Syntax highlighter for fenced code blocks
 *    - html2pdf.js   — Client-side PDF generation
 *    - window.showToast() — Global toast notification (injected by global.js)
 * =============================================================================
 */

const MDStudio = (function () {
    'use strict';

    /* =========================================================================
       SECTION 1: CONFIGURATION CONSTANTS
       Central config object to make tuneable values easy to find and modify
       without hunting through the code. All magic numbers live here.
    ========================================================================= */

    /**
     * CONFIG
     * @property {string}  AUTOSAVE_KEY       - LocalStorage key for the editor document.
     * @property {number}  TAB_SIZE           - Number of spaces inserted per Tab keypress.
     * @property {number}  DEBOUNCE_MS        - Milliseconds to wait after typing before re-rendering.
     * @property {boolean} SYNC_SCROLL_ENABLED - Toggle synchronized editor/preview scrolling.
     */
    const CONFIG = {
        AUTOSAVE_KEY       : 'md_studio_content_v3',
        TAB_SIZE           : 4,
        DEBOUNCE_MS        : 150,   // Low debounce = fast response; increase if CPU usage is a concern
        SYNC_SCROLL_ENABLED: true
    };

    /* =========================================================================
       SECTION 2: DOM ELEMENT CACHE
       All getElementById / querySelector calls are made once at module load
       time and cached here. This avoids repeated DOM traversal on every
       render tick, which is important for smooth 60 fps typing performance.
    ========================================================================= */

    /**
     * DOM
     * Cached references to all elements that the module reads or writes.
     * @property {HTMLTextAreaElement} input     - The raw Markdown input textarea (#markdown-input).
     * @property {HTMLDivElement}      editorPane - The left workspace pane (#pane-editor).
     * @property {HTMLDivElement}      preview   - The live HTML preview pane (#pane-preview).
     * @property {Object}              stats     - Child elements that display live statistics.
     * @property {HTMLSpanElement}     stats.words - Word count display (#word-count).
     * @property {HTMLSpanElement}     stats.lines - Line count display (#line-count).
     * @property {HTMLSpanElement}     stats.chars - Character count display (#char-count).
     */
    const DOM = {
        input      : document.getElementById('markdown-input'),
        editorPane : document.getElementById('pane-editor'),
        preview    : document.getElementById('pane-preview'),
        stats      : {
            words : document.getElementById('word-count'),
            lines : document.getElementById('line-count'),
            chars : document.getElementById('char-count')
        }
    };

    /* =========================================================================
       SECTION 3: MODULE-LEVEL STATE
       Mutable variables shared across functions within this IIFE.
    ========================================================================= */

    /** @type {number|null} renderTimeout - Timer ID for the debounced render call. */
    let renderTimeout = null;

    /**
     * @type {string|null} activeScrollPane
     * Tracks which pane the user is currently hovering / touching.
     * Values: 'editor' | 'preview' | null
     * Used by the scroll-sync logic to prevent infinite scroll-loop feedback.
     */
    let activeScrollPane = null;

    /* =========================================================================
       SECTION 4: DOMPURIFY SANITIZATION CONFIG
       Whitelist configuration passed to DOMPurify.sanitize() on every render.
       Allows rich Markdown features (tables, images, checkboxes, code blocks)
       while explicitly blocking all executable / injectable elements and
       event handler attributes that could enable XSS attacks.
    ========================================================================= */

    /**
     * purifyConfig
     * Extends DOMPurify's default allowlist to support full GitHub-Flavored
     * Markdown output while maintaining strict security.
     */
    const purifyConfig = {
        ADD_TAGS    : ['iframe', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                       'del', 'img', 'kbd', 'code', 'pre', 'blockquote', 'input'],
        ADD_ATTR    : ['target', 'allowfullscreen', 'frameborder', 'src', 'class',
                       'href', 'alt', 'title', 'width', 'height', 'align',
                       'checked', 'type', 'disabled'],
        FORBID_TAGS : ['script', 'style', 'object', 'embed', 'form', 'base', 'applet', 'link'],
        FORBID_ATTR : ['onerror', 'onload', 'onclick', 'onmouseover', 'javascript:', 'style']
    };

    /* =========================================================================
       SECTION 5: INITIALISATION
    ========================================================================= */

    /**
     * init()
     * Entry point for the entire MDStudio module. Called automatically when
     * the DOM is ready (see the readyState check at the bottom of this file).
     *
     * Execution order:
     *   1. Guard against missing DOM — abort silently if textarea not found.
     *   2. Configure third-party libraries (marked.js, DOMPurify hooks).
     *   3. Restore any previously auto-saved document from LocalStorage.
     *   4. Attach all event listeners (input, keydown, scroll, touch).
     *   5. Run an initial render so the preview is not blank on page load.
     *   6. Detect mobile and warn if critical APIs are unavailable.
     */
    function init() {
        // Guard: if the textarea is absent the page structure is broken — stop here
        if (!DOM.input) return;

        setupLibraries();
        loadContent();
        setupEventListeners();
        triggerRender(true);        // force=true skips debounce on first render
        detectMobileCapabilities(); // warn mobile users about PDF limitations
    }

    /* =========================================================================
       SECTION 6: LIBRARY SETUP
    ========================================================================= */

    /**
     * setupLibraries()
     * Configures marked.js options and registers a DOMPurify post-sanitize
     * hook. Called once during init().
     *
     * marked.js options:
     *   - breaks:true     — Converts single newlines to <br> (like GitHub)
     *   - gfm:true        — GitHub-Flavored Markdown (tables, task lists)
     *   - headerIds:true  — Adds `id` attributes to headings (anchor links)
     *   - mangle:false    — Disables email obfuscation (deprecated in newer marked)
     *   - highlight       — Delegates code block highlighting to highlight.js
     *
     * DOMPurify hook:
     *   Forces all <a> tags in the rendered output to open in a new tab
     *   with `rel="noopener noreferrer"` for security (prevents tab-napping).
     */
    function setupLibraries() {
        // ── marked.js configuration ─────────────────────────────────────────
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks    : true,
                gfm       : true,
                headerIds : true,
                mangle    : false,
                highlight : function (code, lang) {
                    // Use highlight.js when available; fall back to raw text
                    if (typeof hljs !== 'undefined') {
                        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                        return hljs.highlight(code, { language }).value;
                    }
                    return code;
                }
            });
        } else {
            // Libraries missing — display a user-visible error in the preview pane
            console.warn('MDStudio: marked.js not loaded. Check CDN / library paths.');
            DOM.preview.innerHTML =
                "<p style='color:var(--accent-red);padding:20px;'>" +
                "⚠️ Core rendering library (marked.js) failed to load. " +
                "Please check your internet connection and reload." +
                "</p>";
        }

        // ── DOMPurify after-sanitize hook ─────────────────────────────────
        if (typeof DOMPurify !== 'undefined') {
            DOMPurify.addHook('afterSanitizeAttributes', function (node) {
                // Apply target="_blank" + rel="noopener noreferrer" to all links
                if ('target' in node) {
                    node.setAttribute('target', '_blank');
                    node.setAttribute('rel', 'noopener noreferrer');
                }
            });
        }
    }

    /* =========================================================================
       SECTION 7: AUTO-SAVE (LocalStorage)
    ========================================================================= */

    /**
     * loadContent()
     * Restores a previously saved document from LocalStorage on page load.
     * If no saved document exists (first visit or cleared storage), the
     * textarea remains empty and the placeholder text is shown.
     */
    function loadContent() {
        const saved = localStorage.getItem(CONFIG.AUTOSAVE_KEY);
        if (saved !== null && saved.trim() !== '') {
            DOM.input.value = saved;
        }
    }

    /**
     * saveToLocal()
     * Persists the current textarea content to LocalStorage.
     * Called on every render tick (after debounce) and on Ctrl+S.
     * Wrapped in try/catch to silently handle QuotaExceededError in
     * browsers with restricted storage (e.g., private browsing on iOS).
     */
    function saveToLocal() {
        try {
            localStorage.setItem(CONFIG.AUTOSAVE_KEY, DOM.input.value);
        } catch (e) {
            console.error('MDStudio: LocalStorage quota exceeded — auto-save skipped.', e);
        }
    }

    /* =========================================================================
       SECTION 8: EVENT LISTENERS
    ========================================================================= */

    /**
     * setupEventListeners()
     * Attaches all DOM event handlers. Called once during init().
     *
     * Listeners registered:
     *   - input     → Debounced render trigger (typing)
     *   - keydown   → Keyboard shortcut handler
     *   - mouseover → Sets activeScrollPane for scroll-sync lock
     *   - scroll    → Bi-directional scroll synchronisation
     *   - touchstart → Mobile scroll-sync lock (passive for performance)
     */
    function setupEventListeners() {

        // ── Typing: trigger debounced re-render on every keystroke ──────────
        DOM.input.addEventListener('input', function () {
            clearTimeout(renderTimeout);
            renderTimeout = setTimeout(function () { triggerRender(); }, CONFIG.DEBOUNCE_MS);
        });

        // ── Keyboard shortcuts (Tab indentation, Ctrl+B/I/K/S) ─────────────
        DOM.input.addEventListener('keydown', handleKeydown);

        // ── Scroll sync: Hover-lock technique ───────────────────────────────
        // When the user's mouse enters a pane, that pane "owns" the scroll sync.
        // This prevents the other pane from bouncing back when it receives the
        // programmatic scrollTop update, avoiding an infinite feedback loop.
        DOM.input.addEventListener('mouseover',   function () { activeScrollPane = 'editor'; });
        DOM.preview.addEventListener('mouseover', function () { activeScrollPane = 'preview'; });

        DOM.input.addEventListener('scroll',   syncPreviewScroll);
        DOM.preview.addEventListener('scroll', syncEditorScroll);

        // ── Mobile touch: set ownership the same way as mouseover ─────────
        DOM.input.addEventListener('touchstart',
            function () { activeScrollPane = 'editor'; },
            { passive: true }   // passive:true allows the browser to optimise scrolling
        );
        DOM.preview.addEventListener('touchstart',
            function () { activeScrollPane = 'preview'; },
            { passive: true }
        );
    }

    /* =========================================================================
       SECTION 9: SCROLL SYNCHRONISATION
    ========================================================================= */

    /**
     * syncPreviewScroll()
     * Called when the editor textarea scrolls.
     * Calculates the editor's scroll percentage (0.0 → 1.0) and applies
     * the equivalent absolute scrollTop to the preview pane.
     * Only runs when the editor pane "owns" the scroll context (hover-lock).
     */
    function syncPreviewScroll() {
        if (!CONFIG.SYNC_SCROLL_ENABLED || activeScrollPane !== 'editor') return;

        const percentage = DOM.input.scrollTop / (DOM.input.scrollHeight - DOM.input.clientHeight);
        const targetY    = percentage * (DOM.preview.scrollHeight - DOM.preview.clientHeight);

        DOM.preview.scrollTop = targetY;
    }

    /**
     * syncEditorScroll()
     * Mirror of syncPreviewScroll() — fires when the preview pane scrolls.
     * Applies the preview's scroll percentage back to the editor textarea.
     * Only runs when the preview pane "owns" the scroll context.
     */
    function syncEditorScroll() {
        if (!CONFIG.SYNC_SCROLL_ENABLED || activeScrollPane !== 'preview') return;

        const percentage = DOM.preview.scrollTop / (DOM.preview.scrollHeight - DOM.preview.clientHeight);
        const targetY    = percentage * (DOM.input.scrollHeight - DOM.input.clientHeight);

        DOM.input.scrollTop = targetY;
    }

    /* =========================================================================
       SECTION 10: KEYBOARD SHORTCUTS
    ========================================================================= */

    /**
     * handleKeydown(e)
     * Intercepts keydown events on the textarea and maps key combinations
     * to editor actions. Uses both ctrlKey and metaKey to support both
     * Windows (Ctrl) and macOS (⌘ Cmd) users.
     *
     * Shortcuts handled:
     *   Tab     → Insert CONFIG.TAB_SIZE spaces (prevents focus change)
     *   Ctrl+B  → Wrap selection in ** (Bold)
     *   Ctrl+I  → Wrap selection in *  (Italic)
     *   Ctrl+K  → Wrap selection in [](url) (Link)
     *   Ctrl+S  → Save to LocalStorage + show confirmation toast
     *
     * @param {KeyboardEvent} e - The native keyboard event object.
     */
    function handleKeydown(e) {

        // Tab: Insert spaces instead of moving focus to the next element
        if (e.key === 'Tab') {
            e.preventDefault();
            insertTab(e.shiftKey);
        }

        // Ctrl/Cmd + B — Bold
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            insertMarkdown('**', '**');
        }

        // Ctrl/Cmd + I — Italic
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            insertMarkdown('*', '*');
        }

        // Ctrl/Cmd + K — Hyperlink
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            insertMarkdown('[', '](url)');
        }

        // Ctrl/Cmd + S — Manual save with visual feedback
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveToLocal();
            window.showToast('Progress Saved ✓');
        }
    }

    /**
     * insertTab(isReverse)
     * Inserts CONFIG.TAB_SIZE space characters at the current cursor position.
     * The `isReverse` parameter is accepted for future unindent (Shift+Tab)
     * support but is not yet implemented.
     *
     * @param {boolean} isReverse - True if Shift+Tab was pressed (reserved for future use).
     */
    function insertTab(isReverse) {
        const start  = DOM.input.selectionStart;
        const end    = DOM.input.selectionEnd;
        const spaces = ' '.repeat(CONFIG.TAB_SIZE);

        // setRangeText replaces the current selection (or inserts at cursor) with spaces
        DOM.input.setRangeText(spaces, start, end, 'end');
        triggerRender();
    }

    /* =========================================================================
       SECTION 11: CORE RENDERING ENGINE
    ========================================================================= */

    /**
     * triggerRender(force)
     * The heart of the editor. Every time this runs it:
     *   1. Persists the current content to LocalStorage via saveToLocal().
     *   2. Updates the word / line / char statistics via updateStats().
     *   3. Parses the raw Markdown text with marked.parse().
     *   4. Sanitizes the resulting HTML with DOMPurify to block XSS.
     *   5. Injects the safe HTML into the preview pane's innerHTML.
     *   6. Applies syntax highlighting to all <pre><code> blocks via hljs.
     *
     * @param {boolean} [force=false] - When true, skips the library guard check
     *   and re-renders even if no input change is detected (used on init).
     */
    function triggerRender(force = false) {
        // Persist content and update statistics on every render
        saveToLocal();
        updateStats();

        // Guard: if marked.js failed to load, rendering is impossible
        if (typeof marked === 'undefined') return;

        const rawMarkdown = DOM.input.value;

        // Step 1: Parse Markdown → raw HTML string
        let html = marked.parse(rawMarkdown);

        // Step 2: Sanitize HTML to prevent XSS injection
        if (typeof DOMPurify !== 'undefined') {
            html = DOMPurify.sanitize(html, purifyConfig);
        }

        // Step 3: Inject safe HTML into the live preview pane
        DOM.preview.innerHTML = html;

        // Step 4: Apply syntax highlighting to all fenced code blocks
        if (typeof hljs !== 'undefined') {
            DOM.preview.querySelectorAll('pre code').forEach(function (block) {
                hljs.highlightElement(block);
            });
        }
    }

    /* =========================================================================
       SECTION 12: LIVE STATISTICS
    ========================================================================= */

    /**
     * updateStats()
     * Calculates and displays the current word, line, and character counts.
     * Called synchronously on every render tick (after debounce delay).
     *
     * Word count algorithm:
     *   Trim the text, then split on one-or-more whitespace characters.
     *   An empty or whitespace-only string returns 0 (not 1).
     *
     * Line count algorithm:
     *   Split on newline characters. An empty string returns 0 (not 1),
     *   matching the expected "blank document = 0 lines" user expectation.
     */
    function updateStats() {
        const text  = DOM.input.value;
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        const lines = text === '' ? 0 : text.split('\n').length;

        // toLocaleString() adds thousands separators for large documents
        DOM.stats.words.textContent = words.toLocaleString();
        DOM.stats.lines.textContent = lines.toLocaleString();
        DOM.stats.chars.textContent = text.length.toLocaleString();
    }

    /* =========================================================================
       SECTION 13: TOOLBAR INSERT API
    ========================================================================= */

    /**
     * insertMarkdown(before, after)
     * Public API method called by toolbar buttons and keyboard shortcuts.
     * Wraps the currently selected text with the provided prefix/suffix
     * Markdown syntax tokens. If no text is selected, the cursor is moved
     * to the position between the two tokens so the user can type immediately.
     *
     * Examples:
     *   insertMarkdown('**', '**')        → wraps selection in bold
     *   insertMarkdown('[', '](url)')     → creates a link template
     *   insertMarkdown('```\n', '\n```')  → creates a code fence block
     *
     * @param {string} before - Markdown syntax to insert before the selection.
     * @param {string} after  - Markdown syntax to insert after the selection.
     */
    function insertMarkdown(before, after) {
        const start     = DOM.input.selectionStart;
        const end       = DOM.input.selectionEnd;
        const text      = DOM.input.value;
        const selection = text.substring(start, end);

        // Build the replacement string: prefix + selected text + suffix
        const replacement = before + selection + after;

        // Replace the selection range with the wrapped text
        DOM.input.setRangeText(replacement, start, end, 'select');

        // If no text was selected, move the cursor to the typing position
        // (between the two tokens) rather than leaving the whole token selected
        if (start === end) {
            DOM.input.selectionStart = start + before.length;
            DOM.input.selectionEnd   = start + before.length;
        }

        // Return focus to the textarea so the user can keep typing
        DOM.input.focus();
        triggerRender();
    }

    /**
     * clearEditor()
     * Prompts the user for confirmation, then clears the entire textarea
     * and re-renders to update the preview and stats. A toast notification
     * confirms the action.
     * Uses the native confirm() dialog as a simple, accessible guard against
     * accidental data loss.
     */
    function clearEditor() {
        if (confirm('Are you sure you want to clear the editor? This cannot be undone.')) {
            DOM.input.value = '';
            triggerRender();
            window.showToast('Editor Cleared');
        }
    }

    /* =========================================================================
       SECTION 14: MOBILE TAB SWITCHING
    ========================================================================= */

    /**
     * switchTab(mode)
     * Public API method called by the mobile "Write / Preview" tab buttons.
     * Toggles the .active class on the editor and preview panes, and updates
     * the .active highlight on the corresponding tab button.
     *
     * On mobile (≤ 600px), CSS hides all panes by default (.pane-editor,
     * .pane-preview { display: none }) and only shows the one with .active.
     * On desktop the split layout is always visible so this function has
     * no visible effect (both panes are shown via flex layout).
     *
     * @param {string} mode - 'editor' | 'preview'
     */
    function switchTab(mode) {
        const btns        = document.querySelectorAll('.mobile-tab-btn');
        const editorPane  = document.getElementById('pane-editor');
        const previewPane = document.getElementById('pane-preview');

        if (mode === 'editor') {
            // Activate the editor pane
            editorPane.classList.add('active');
            previewPane.classList.remove('active');
            // Highlight the "Write" tab button (index 0)
            btns[0].classList.add('active');
            btns[1].classList.remove('active');
        } else {
            // Activate the preview pane
            editorPane.classList.remove('active');
            previewPane.classList.add('active');
            // Highlight the "Preview" tab button (index 1)
            btns[0].classList.remove('active');
            btns[1].classList.add('active');
            // Force a fresh render when switching to preview to ensure the
            // latest edits are visible even if the debounce hasn't fired yet
            triggerRender(true);
        }
    }

    /* =========================================================================
       SECTION 15: EXPORT FUNCTIONS
    ========================================================================= */

    /**
     * exportPDF()
     * Generates a PDF from the current preview pane content using html2pdf.js.
     * The PDF is rendered at 2× scale (Retina quality) in A4 portrait format.
     *
     * html2pdf configuration:
     *   - margin      : 0.5 inch on all sides
     *   - filename    : markdown_<timestamp>.pdf (unique per export)
     *   - html2canvas : scale:2 for crisp text, useCORS:true for external images
     *   - pagebreak   : 'avoid-all' prevents tables/code blocks splitting mid-row
     *
     * The function guards against:
     *   - html2pdf library not yet loaded (shows error toast)
     *   - Empty preview pane (shows warning toast)
     */
    function exportPDF() {
        // Guard: library not yet loaded (deferred script may not have executed)
        if (typeof html2pdf === 'undefined') {
            return window.showToast('PDF library is still loading. Please try again.', true);
        }

        // Guard: nothing to export
        const content = DOM.preview.innerText.trim();
        if (!content) {
            return window.showToast('Nothing to export — the preview is empty!', true);
        }

        // Notify the user that generation has started (it can take 1-3 seconds)
        window.showToast('Generating PDF…');

        /** @type {Object} opt - html2pdf option object */
        const opt = {
            margin      : [0.5, 0.5],
            filename    : 'markdown_' + Date.now() + '.pdf',
            image       : { type: 'jpeg', quality: 0.98 },
            html2canvas : { scale: 2, useCORS: true, letterRendering: true },
            jsPDF       : { unit: 'in', format: 'a4', orientation: 'portrait' },
            pagebreak   : { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Use the preview DOM element directly as the PDF source
        html2pdf()
            .set(opt)
            .from(DOM.preview)
            .save()
            .then(function () {
                window.showToast('PDF Downloaded Successfully ✓');
            })
            .catch(function (err) {
                console.error('MDStudio exportPDF error:', err);
                window.showToast('PDF Export Failed. Please try again.', true);
            });
    }

    /**
     * exportHTML()
     * Exports the rendered preview pane as a fully self-contained HTML file.
     * Includes a minimal inline stylesheet so the exported file looks polished
     * when opened in any browser without external dependencies.
     *
     * The export file is created as a Blob URL, programmatically clicked,
     * and then immediately revoked to free browser memory.
     *
     * Guards against an empty preview pane.
     */
    function exportHTML() {
        // Guard: nothing to export
        if (!DOM.preview.innerText.trim()) {
            return window.showToast('Preview is empty — nothing to export!', true);
        }

        // Capture the current rendered HTML from the preview pane
        const content = DOM.preview.innerHTML;

        // Build a self-contained HTML document with minimal GitHub-style CSS
        const htmlContent =
            '<!DOCTYPE html>\n' +
            '<html lang="en">\n' +
            '<head>\n' +
            '<meta charset="UTF-8">\n' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
            '<title>Markdown Export</title>\n' +
            '<style>\n' +
            '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; ' +
                     'line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #24292e; }\n' +
            '  img  { max-width: 100%; border-radius: 6px; }\n' +
            '  pre  { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }\n' +
            '  code { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace; ' +
                     'background: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 6px; }\n' +
            '  pre code { background: transparent; padding: 0; }\n' +
            '  blockquote { border-left: 0.25em solid #d0d7de; color: #656d76; padding: 0 1em; }\n' +
            '  table { border-spacing: 0; border-collapse: collapse; width: 100%; margin-bottom: 16px; }\n' +
            '  table th, table td { padding: 6px 13px; border: 1px solid #d0d7de; }\n' +
            '  table tr:nth-child(2n) { background-color: #f6f8fa; }\n' +
            '</style>\n' +
            '</head>\n' +
            '<body>\n' +
            content + '\n' +
            '</body>\n' +
            '</html>';

        // Create a temporary Blob URL and trigger a download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');

        a.href     = url;
        a.download = 'export_' + Date.now() + '.html';

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Revoke the object URL to free browser memory
        URL.revokeObjectURL(url);

        window.showToast('HTML File Exported ✓');
    }

    /**
     * downloadMD()
     * Exports the raw Markdown text from the editor textarea as a .md file.
     * Uses the same Blob URL download technique as exportHTML().
     *
     * Guards against an empty editor.
     */
    function downloadMD() {
        const content = DOM.input.value;

        // Guard: nothing to save
        if (!content.trim()) {
            return window.showToast('Editor is empty — nothing to save!', true);
        }

        // Create a Blob with MIME type text/markdown and download it
        const blob = new Blob([content], { type: 'text/markdown' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');

        a.href     = url;
        a.download = 'document_' + Date.now() + '.md';

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        window.showToast('Markdown File Saved ✓');
    }

    /* =========================================================================
       SECTION 16: MOBILE CAPABILITY DETECTION
    ========================================================================= */

    /**
     * detectMobileCapabilities()
     * Detects whether the user is on a mobile device and checks if the
     * html2pdf library (which depends on html2canvas + jsPDF) is likely
     * to perform poorly on low-end devices.
     *
     * Strategy: use a non-blocking toast warning rather than disabling the
     * feature entirely — informed users can still attempt the export.
     * The toast fires after a 1-second delay so it does not compete with
     * any page-load animations or the initial render cycle.
     */
    function detectMobileCapabilities() {
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isMobile) {
            setTimeout(function () {
                window.showToast(
                    '📱 Mobile tip: PDF export may be slow on mobile. ' +
                    'HTML and .md export work best.',
                    false   // informational, not an error
                );
            }, 1200);
        }
    }

    /* =========================================================================
       SECTION 17: INITIALISATION TRIGGER
       Waits for the DOM to be fully parsed before calling init().
       If the script is loaded with `defer` or placed at the end of <body>,
       the DOM will already be interactive — the else branch handles that case.
    ========================================================================= */

    if (document.readyState === 'loading') {
        // DOM not yet ready — wait for the DOMContentLoaded event
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM is already parsed (deferred script or bottom-of-body placement)
        init();
    }

    /* =========================================================================
       SECTION 18: PUBLIC API
       The only surface exposed to the global scope. Toolbar onclick attributes
       and keyboard shortcut handlers call these via `MDStudio.methodName()`.
    ========================================================================= */

    return {
        /** Insert Markdown syntax around the current selection — used by toolbar buttons */
        insertMarkdown,
        /** Clear the entire editor with a confirmation dialog */
        clearEditor,
        /** Toggle between the Write and Preview panes on mobile */
        switchTab,
        /** Download the raw Markdown text as a .md file */
        downloadMD,
        /** Export the rendered HTML as a self-contained .html file */
        exportHTML,
        /** Generate and download a PDF from the live preview */
        exportPDF
    };

})();
