/**
 * =============================================================================
 * Web Sandbox STUDIO MAX — Core Script
 * File    : assets/tools/dev/dev-web-sandbox/script.js
 * Author  : Trusted Tools Web
 * Version : 1.0.0
 *
 * Architecture Overview
 * ─────────────────────────────────────────────────────────────────────────
 * 1.  CONFIG          — Constants, localStorage keys, default code templates
 * 2.  STATE           — Centralized mutable application state object
 * 3.  UTILS           — Pure helper functions (debounce, safeStringify, timestamp)
 * 4.  MONACO INIT     — Loads Monaco Editor via AMD require(), creates 3 instances
 * 5.  AUTOSAVE        — Debounced reads/writes to localStorage
 * 6.  LIVE PREVIEW    — Builds srcdoc HTML document and injects into iframe
 * 7.  VIRTUAL CONSOLE — postMessage bridge + entry render pipeline
 * 8.  TOOLBAR ACTIONS — Tab switch, Format, Wrap, Template, Clear, Export ZIP, Run
 * 9.  SPLIT.JS        — Initializes resizable split panels (desktop only)
 * 10. EVENT LISTENERS — Binds all DOM interactions
 * 11. BOOT            — Entry point; initializes all sub-systems in order
 *
 * Toast System
 * ─────────────────────────────────────────────────────────────────────────
 * This tool uses the global `window.showToast()` function provided by
 * global.js. The local showToast() function has been removed.
 * Usage: window.showToast("Message")            → info toast
 *        window.showToast("Error text", true)   → error toast (red)
 * =============================================================================
 */

'use strict';

/* =============================================================================
   1. CONFIG — Constant values, keys, and boilerplate templates
   ============================================================================= */

/**
 * @constant {Object} CONFIG
 * Central configuration object. Modify these values to adjust the tool's
 * behavior globally without hunting through the codebase.
 */
const CONFIG = {
    /** Delay (ms) after the last keystroke before the live preview refreshes */
    PREVIEW_DEBOUNCE_MS: 500,

    /** Delay (ms) after the last keystroke before localStorage auto-saves */
    AUTOSAVE_DEBOUNCE_MS: 800,

    /** localStorage keys for persisting user code and preferences */
    STORAGE_KEYS: {
        html:        'sandbox_html',
        css:         'sandbox_css',
        js:          'sandbox_js',
        splitSizes:  'sandbox_split_sizes',
        wordWrap:    'sandbox_word_wrap',
        consoleOpen: 'sandbox_console_open',
    },

    /**
     * Local path for Monaco Editor's AMD module loader.
     * Ready for 100% offline CodeCanyon release.
     */
    MONACO_VS_PATH: '../../assets/library/monaco-editor/min/vs',

    /** Default [editor%, preview%] split sizes for Split.js */
    DEFAULT_SPLIT: [50, 50],

    /**
     * Maximum number of Virtual Console entries to keep in the DOM.
     * Oldest entries are pruned to prevent memory leaks on long sessions.
     */
    MAX_CONSOLE_ENTRIES: 200,

    /**
     * Default starter code shown when localStorage has no saved session.
     * Users see this on their very first visit.
     */
    DEFAULT_CODE: {
        html: `<!-- Write your HTML here -->
<div class="container">
  <h1>Hello, World! 👋</h1>
  <p>Start editing HTML, CSS, and JS to see your changes live.</p>
  <button onclick="greet()">Click Me</button>
</div>`,
        css: `/* Write your CSS here */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', sans-serif;
  background: #0f0f1a;
  color: #e8ecf3;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.container {
  text-align: center;
  padding: 40px;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #00d4ff, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p {
  color: #6b7280;
  margin-bottom: 24px;
}

button {
  padding: 10px 24px;
  background: #00d4ff;
  border: none;
  border-radius: 8px;
  color: #000;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 212, 255, 0.4);
}`,
        js: `// Write your JavaScript here
function greet() {
  const msg = 'Hello from Web Sandbox STUDIO MAX! 🚀';
  console.log(msg);
  alert(msg);
}

console.log('Sandbox initialized ✅');
console.warn('This is a warning example');
`,
    },

    /**
     * @constant {Object} TEMPLATES
     * Boilerplate snippets available in the Template dropdown.
     * Each key matches the data-template attribute on dropdown buttons.
     * Each value is an object with `html`, `css`, and `js` strings.
     */
    TEMPLATES: {

        /** Blank starter — minimal boilerplate for a fresh project */
        blank: {
            html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
</head>
<body>
  <!-- Start building here -->
</body>
</html>`,
            css: `/* Your styles */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; }`,
            js: `// Your scripts
console.log('Ready!');`,
        },

        /** Hello World — simple button interaction demo */
        hello: {
            html: `<div class="card">
  <h1>Hello, World! 🌍</h1>
  <p>Your first web sandbox project.</p>
  <button id="btn">Say Hello</button>
  <div id="output"></div>
</div>`,
            css: `body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #111;
  font-family: 'Segoe UI', sans-serif;
}
.card {
  background: #1e2230;
  border: 1px solid #2d3446;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  color: #e8ecf3;
}
h1 { font-size: 2rem; margin-bottom: 12px; color: #00d4ff; }
p  { color: #6b7280; margin-bottom: 20px; }
button {
  padding: 10px 24px;
  background: #7c3aed;
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
}
button:hover { background: #6d28d9; }
#output { margin-top: 16px; color: #22c55e; font-size: 13px; }`,
            js: `document.getElementById('btn').addEventListener('click', () => {
  const output = document.getElementById('output');
  output.textContent = '✅ Hello, World! The button works!';
  console.log('Button clicked!');
});`,
        },

        /** Flexbox Layout — three-panel sidebar + cards layout demo */
        flexbox: {
            html: `<div class="page">
  <header class="header">Header</header>
  <div class="main">
    <aside class="sidebar">Sidebar</aside>
    <main class="content">
      <div class="card">Card 1</div>
      <div class="card">Card 2</div>
      <div class="card">Card 3</div>
    </main>
  </div>
  <footer class="footer">Footer</footer>
</div>`,
            css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; background: #0d0f12; color: #e8ecf3; }
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  gap: 0;
}
.header, .footer {
  background: #1e2230;
  padding: 16px 24px;
  font-weight: 700;
  text-align: center;
  color: #00d4ff;
  border-bottom: 1px solid #2d3446;
}
.footer { border-top: 1px solid #2d3446; border-bottom: none; }
.main {
  display: flex;
  flex: 1;
}
.sidebar {
  width: 220px;
  background: #16191f;
  border-right: 1px solid #2d3446;
  padding: 24px;
  font-size: 14px;
  color: #6b7280;
}
.content {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 24px;
  align-content: flex-start;
}
.card {
  flex: 1 1 calc(33% - 16px);
  min-width: 120px;
  background: #1e2230;
  border: 1px solid #2d3446;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}`,
            js: `console.log('Flexbox layout loaded!');`,
        },

        /** CSS Animation — orbiting ring + pulsing orb demo */
        animation: {
            html: `<div class="scene">
  <div class="orb"></div>
  <div class="ring ring-1"></div>
  <div class="ring ring-2"></div>
  <h2 class="label">CSS Animations</h2>
</div>`,
            css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  overflow: hidden;
}
.scene {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.orb {
  width: 60px;
  height: 60px;
  background: radial-gradient(circle at 35% 35%, #00d4ff, #7c3aed);
  border-radius: 50%;
  box-shadow: 0 0 30px rgba(0,212,255,0.6), 0 0 60px rgba(124,58,237,0.4);
  animation: pulse 2s ease-in-out infinite;
}
.ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(0, 212, 255, 0.3);
  animation: spin linear infinite;
}
.ring-1 { width: 110px; height: 110px; animation-duration: 4s; border-color: rgba(0,212,255,0.4); }
.ring-2 { width: 160px; height: 160px; animation-duration: 7s; animation-direction: reverse; border-color: rgba(124,58,237,0.3); }
.label {
  position: absolute;
  bottom: -40px;
  color: #6b7280;
  font-family: sans-serif;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(0,212,255,0.6); }
  50% { transform: scale(1.15); box-shadow: 0 0 60px rgba(0,212,255,0.9); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}`,
            js: `console.log('CSS animations demo loaded!');`,
        },

        /** Fetch API Demo — fetches random post from JSONPlaceholder */
        fetch: {
            html: `<div class="app">
  <h1>Fetch API Demo</h1>
  <p>Fetches a random public JSON from JSONPlaceholder.</p>
  <button id="fetchBtn">Fetch Random Post</button>
  <div id="result" class="result-box">
    <span class="placeholder">Click the button to fetch data.</span>
  </div>
</div>`,
            css: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', sans-serif;
  background: #0d0f12;
  color: #e8ecf3;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}
.app { max-width: 500px; width: 100%; }
h1 { font-size: 1.5rem; color: #00d4ff; margin-bottom: 8px; }
p { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
button {
  padding: 10px 22px;
  background: #7c3aed;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 16px;
  transition: background 0.2s;
}
button:hover { background: #6d28d9; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.result-box {
  background: #1e2230;
  border: 1px solid #2d3446;
  border-radius: 10px;
  padding: 20px;
  min-height: 100px;
  font-size: 13px;
  line-height: 1.7;
}
.placeholder { color: #374151; }
.post-title { color: #00d4ff; font-weight: 700; font-size: 15px; margin-bottom: 8px; }
.post-body { color: #9ca3af; }`,
            js: `const btn = document.getElementById('fetchBtn');
const result = document.getElementById('result');

btn.addEventListener('click', async () => {
  const id = Math.floor(Math.random() * 100) + 1;
  btn.disabled = true;
  btn.textContent = 'Fetching...';
  result.innerHTML = '<span style="color:#6b7280">Loading...</span>';
  
  try {
    const res = await fetch(\`https://jsonplaceholder.typicode.com/posts/\${id}\`);
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    const data = await res.json();
    
    result.innerHTML = \`
      <div class="post-title">\${data.title}</div>
      <div class="post-body">\${data.body}</div>
      <div style="color:#374151; font-size:11px; margin-top:10px;">Post #\${data.id} by User \${data.userId}</div>
    \`;
    console.log('Fetched post:', data);
  } catch (err) {
    result.innerHTML = \`<span style="color:#ef4444">Error: \${err.message}</span>\`;
    console.error('Fetch failed:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Fetch Random Post';
  }
});`,
        },

        /** Canvas Sketch — interactive particle canvas with mouse attraction */
        canvas: {
            html: `<canvas id="c"></canvas>`,
            css: `* { margin: 0; padding: 0; }
body { background: #000; overflow: hidden; }
canvas { display: block; }`,
            js: `// Interactive Particle Canvas
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;
let mouse = { x: W / 2, y: H / 2 };

window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
});

canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.r = Math.random() * 2.5 + 0.5;
    this.alpha = Math.random() * 0.7 + 0.3;
    this.hue = Math.random() * 60 + 180; // cyan-purple range
  }
  update() {
    // Attract slightly toward the mouse cursor
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 150) {
      this.vx += dx / dist * 0.05;
      this.vy += dy / dist * 0.05;
    }
    this.vx *= 0.99;
    this.vy *= 0.99;
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = \`hsla(\${this.hue}, 100%, 70%, \${this.alpha})\`;
    ctx.fill();
  }
}

const particles = Array.from({ length: 200 }, () => new Particle());

function loop() {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, W, H);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(loop);
}

loop();
console.log('Canvas sketch running! Move your mouse over the preview.');`,
        },
    },
};

/* =============================================================================
   2. STATE — Centralized mutable application state (single source of truth)
   ============================================================================= */

/**
 * @type {Object} state
 * The single mutable state object for the entire application.
 * All sub-systems read from and write to this object instead of directly
 * querying/modifying the DOM wherever possible.
 */
const state = {
    /** Currently active editor tab ('html' | 'css' | 'js') */
    activeTab: 'html',

    /** Whether word wrap is enabled across all Monaco editor instances */
    wordWrap: false,

    /** Whether the Virtual Console panel is in its collapsed (header-only) state */
    consoleCollapsed: false,

    /** Active console filter — controls which log level rows are visible */
    consoleFilter: 'all',

    /** Running count of console messages (total, errors, warnings) */
    consoleTotal: 0,
    consoleErrors: 0,
    consoleWarnings: 0,

    /** References to the three Monaco Editor instances (set during initMonaco) */
    editors: {
        html: null,
        css:  null,
        js:   null,
    },

    /** Whether Monaco has fully loaded and all editors are ready */
    monacoReady: false,

    /** Whether the template dropdown menu is currently open */
    templateDropdownOpen: false,

    /** Timer ID returned by the autosave debounce (for internal tracking) */
    autosaveTimer: null,

    /** Timer ID returned by the preview debounce (for internal tracking) */
    previewTimer: null,

    /** Current device simulation mode for the preview frame */
    deviceMode: 'desktop', // 'desktop' | 'mobile'

    /** Split.js instance reference (stored for potential programmatic resize) */
    splitInstance: null,
};

/* =============================================================================
   3. UTILS — Pure helper functions
   ============================================================================= */

/**
 * Creates a debounced version of the given function.
 * The debounced function will only be called once `wait` ms have passed
 * since its last invocation. Every new call resets the timer.
 *
 * Used to prevent live preview from re-rendering on every single keystroke,
 * and to batch localStorage writes for autosave.
 *
 * @param {Function} fn   - The function to debounce.
 * @param {number}   wait - Milliseconds to wait after the last call.
 * @returns {Function} The debounced function wrapper.
 */
function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Safely serializes any JavaScript value to a human-readable display string.
 * Handles edge cases like null/undefined, Errors, DOM nodes, and objects
 * with circular references — all of which would throw in JSON.stringify.
 *
 * Used by the Virtual Console to display log arguments from the iframe.
 *
 * @param {*} value - Any JavaScript value.
 * @returns {string} A display-safe string representation.
 */
function safeStringify(value) {
    if (value === null)      return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string')  return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Error) return `${value.name}: ${value.message}`;

    try {
        // Pretty-print objects/arrays with 2-space indentation
        return JSON.stringify(value, null, 2);
    } catch (_) {
        // Circular reference or non-serializable object — fall back to toString
        return String(value);
    }
}

/**
 * Returns the current wall-clock time formatted as HH:MM:SS.
 * Used to timestamp each Virtual Console log entry.
 *
 * @returns {string} e.g. "14:32:09"
 */
function getTimeStamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Updates the autosave status indicator in the autosave bar.
 * Applies color-coded dot states and descriptive text messages.
 *
 * Called by autoSave() on success/failure, and by initMonaco() on initial load.
 *
 * @param {'saving'|'saved'|'error'} status - The current save state.
 * @param {string} [timeLabel='']           - Optional timestamp of last save.
 */
function setAutosaveStatus(status, timeLabel = '') {
    const dot  = document.getElementById('autosaveDot');
    const text = document.getElementById('autosaveText');
    const time = document.getElementById('autosaveTime');

    if (!dot) return;

    // Remove all state classes before applying the new one
    dot.className = 'autosave-dot';

    const statusConfig = {
        saving: { cls: 'is-saving', msg: 'Saving...' },
        saved:  { cls: 'is-saved',  msg: 'All changes saved to localStorage' },
        error:  { cls: 'is-error',  msg: 'Auto-save failed — localStorage may be full or disabled' },
    };

    const cfg = statusConfig[status] || statusConfig.saving;
    dot.classList.add(cfg.cls);
    if (text) text.textContent = cfg.msg;
    if (time) time.textContent = timeLabel;
}

/* =============================================================================
   4. MONACO EDITOR INITIALIZATION
   ============================================================================= */

/**
 * Configures and bootstraps Monaco Editor via the AMD require() loader.
 *
 * Process:
 * 1. Configures the AMD module loader with the Monaco VS path.
 * 2. Loads the main Monaco AMD module asynchronously.
 * 3. Creates three independent Monaco editor instances (HTML, CSS, JS).
 * 4. Restores previously saved code from localStorage (or falls back to defaults).
 * 5. Registers a global Ctrl+Enter keyboard shortcut for forced preview refresh.
 * 6. Attaches debounced onChange listeners for autosave and live preview.
 * 7. Runs the initial preview render and sets the autosave status to 'saved'.
 */
function initMonaco() {
    // Configure the AMD module loader to find Monaco's worker scripts
    require.config({
        paths: { vs: CONFIG.MONACO_VS_PATH },
    });

    // Load Monaco's main AMD entry point asynchronously
    require(['vs/editor/editor.main'], () => {
        state.monacoReady = true;

        // Attempt to restore user's last session; fall back to default code
        const savedCode = {
            html: localStorage.getItem(CONFIG.STORAGE_KEYS.html) ?? CONFIG.DEFAULT_CODE.html,
            css:  localStorage.getItem(CONFIG.STORAGE_KEYS.css)  ?? CONFIG.DEFAULT_CODE.css,
            js:   localStorage.getItem(CONFIG.STORAGE_KEYS.js)   ?? CONFIG.DEFAULT_CODE.js,
        };

        // Restore word wrap preference from last session
        state.wordWrap = localStorage.getItem(CONFIG.STORAGE_KEYS.wordWrap) === 'true';

        /**
         * Base editor options shared across all three Monaco instances.
         * These match VS Code's default experience for familiarity.
         */
        const baseEditorOptions = {
            theme                    : 'vs-dark',
            fontSize                 : 14,
            fontFamily               : "'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontLigatures            : true,
            minimap                  : { enabled: true },
            automaticLayout          : true,      // Responds to container resize events
            tabSize                  : 2,
            wordWrap                 : state.wordWrap ? 'on' : 'off',
            scrollBeyondLastLine     : false,
            renderLineHighlight      : 'line',
            smoothScrolling          : true,
            cursorBlinking           : 'smooth',
            bracketPairColorization  : { enabled: true },
            padding                  : { top: 12, bottom: 12 },
        };

        // ── Create HTML editor ──────────────────────────────────────────────
        state.editors.html = monaco.editor.create(
            document.getElementById('editor-html'),
            { ...baseEditorOptions, language: 'html', value: savedCode.html }
        );

        // ── Create CSS editor ───────────────────────────────────────────────
        state.editors.css = monaco.editor.create(
            document.getElementById('editor-css'),
            { ...baseEditorOptions, language: 'css', value: savedCode.css }
        );

        // ── Create JavaScript editor ────────────────────────────────────────
        state.editors.js = monaco.editor.create(
            document.getElementById('editor-js'),
            { ...baseEditorOptions, language: 'javascript', value: savedCode.js }
        );

        // Register Ctrl+Enter keyboard shortcut on all three editors:
        // Forces an immediate preview refresh without waiting for the debounce.
        [state.editors.html, state.editors.css, state.editors.js].forEach(editor => {
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                () => renderPreview()
            );
        });

        // Create debounced wrappers for autosave and preview refresh.
        // The debounce prevents expensive operations on every keystroke.
        const debouncedSave    = debounce(autoSave,       CONFIG.AUTOSAVE_DEBOUNCE_MS);
        const debouncedPreview = debounce(renderPreview,  CONFIG.PREVIEW_DEBOUNCE_MS);

        // Attach onChange listeners to all three editors
        Object.values(state.editors).forEach(editor => {
            editor.onDidChangeModelContent(() => {
                setAutosaveStatus('saving'); // Show saving indicator immediately
                debouncedSave();             // Queue debounced localStorage write
                debouncedPreview();          // Queue debounced preview refresh
            });
        });

        // Run initial preview with restored/default code
        renderPreview();

        // Mark as saved on load (code was just restored from localStorage)
        setAutosaveStatus('saved', getTimeStamp());
    });
}

/**
 * Returns the current string content of all three Monaco editor instances.
 * Falls back to empty strings if Monaco hasn't loaded yet.
 *
 * @returns {{ html: string, css: string, js: string }}
 */
function getEditorValues() {
    if (!state.monacoReady) {
        return { html: '', css: '', js: '' };
    }
    return {
        html: state.editors.html.getValue(),
        css:  state.editors.css.getValue(),
        js:   state.editors.js.getValue(),
    };
}

/**
 * Programmatically sets the content of a specific Monaco editor instance.
 * Uses `pushEditOperations` to preserve the undo history stack.
 *
 * @param {'html'|'css'|'js'} lang  - Which editor to update.
 * @param {string}            value - The new content string.
 */
function setEditorValue(lang, value) {
    if (!state.monacoReady || !state.editors[lang]) return;

    const editor    = state.editors[lang];
    const model     = editor.getModel();
    const fullRange = model.getFullModelRange();

    // pushEditOperations keeps the change undoable (unlike setValue which clears undo history)
    model.pushEditOperations(
        [],
        [{ range: fullRange, text: value }],
        () => null
    );
}

/* =============================================================================
   5. AUTOSAVE — Persist code to localStorage
   ============================================================================= */

/**
 * Writes all three editor values to localStorage.
 * Called via a debounced wrapper attached to each Monaco onChange event.
 * Updates the autosave indicator UI to 'saved' on success, 'error' on failure.
 *
 * localStorage failure scenarios: private browsing mode, storage quota exceeded,
 * or the user has blocked localStorage in their browser settings.
 */
function autoSave() {
    try {
        const { html, css, js } = getEditorValues();
        localStorage.setItem(CONFIG.STORAGE_KEYS.html,     html);
        localStorage.setItem(CONFIG.STORAGE_KEYS.css,      css);
        localStorage.setItem(CONFIG.STORAGE_KEYS.js,       js);
        localStorage.setItem(CONFIG.STORAGE_KEYS.wordWrap, String(state.wordWrap));
        setAutosaveStatus('saved', getTimeStamp());
    } catch (err) {
        // localStorage may be full or blocked in private browsing
        setAutosaveStatus('error');
        console.warn('[Sandbox] Auto-save failed:', err);
    }
}

/* =============================================================================
   6. LIVE PREVIEW — Build and inject srcdoc into the iframe
   ============================================================================= */

/**
 * Builds the complete HTML document string used as the live preview's srcdoc.
 *
 * Strategy:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. A console-interceptor script is injected FIRST, before any user code.
 *    It overrides window.console.* and relays messages to the parent via postMessage.
 * 2. The user's CSS is wrapped in a <style> tag inside <head>.
 * 3. The user's HTML goes directly into <body>.
 * 4. The user's JS is wrapped in a try/catch <script> tag at the end of <body>.
 *    Errors thrown by user code are caught and relayed to the Virtual Console.
 *
 * Security: the iframe uses sandbox="allow-scripts" which prevents it from
 * accessing the parent page's DOM, cookies, or localStorage.
 *
 * @returns {string} The complete srcdoc HTML string ready for iframe injection.
 */
function buildPreviewDocument() {
    const { html, css, js } = getEditorValues();

    /**
     * Console interceptor — injected before user code.
     * Overrides console.log/warn/error/info and relays output to the parent
     * window via postMessage using our SANDBOX_CONSOLE message protocol.
     * Also catches uncaught errors and unhandled Promise rejections.
     */
    const consoleInterceptor = `
<script>
(function() {
  // Intercept these four console methods
  var types = ['log', 'warn', 'error', 'info'];
  
  types.forEach(function(type) {
    var original = console[type].bind(console);
    
    console[type] = function() {
      // Serialize all arguments to strings for postMessage transmission
      var args = Array.prototype.slice.call(arguments).map(function(a) {
        if (a === null)      return 'null';
        if (a === undefined) return 'undefined';
        if (a instanceof Error) return a.name + ': ' + a.message;
        if (typeof a === 'object') {
          try { return JSON.stringify(a, null, 2); }
          catch(_) { return String(a); }
        }
        return String(a);
      });
      
      // Relay to parent page via postMessage
      try {
        window.parent.postMessage({
          type      : 'SANDBOX_CONSOLE',
          level     : type,
          args      : args,
          timestamp : new Date().toLocaleTimeString('en-US', { hour12: false })
        }, '*');
      } catch (_) {}
      
      // Also call the original so DevTools still shows the messages
      original.apply(console, arguments);
    };
  });

  // Intercept uncaught synchronous errors
  window.addEventListener('error', function(e) {
    window.parent.postMessage({
      type      : 'SANDBOX_CONSOLE',
      level     : 'error',
      args      : [(e.message || 'Unknown error') + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '')],
      timestamp : new Date().toLocaleTimeString('en-US', { hour12: false })
    }, '*');
  });

  // Intercept unhandled Promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    window.parent.postMessage({
      type      : 'SANDBOX_CONSOLE',
      level     : 'error',
      args      : ['Unhandled Promise Rejection: ' + (e.reason ? (e.reason.message || String(e.reason)) : 'Unknown')],
      timestamp : new Date().toLocaleTimeString('en-US', { hour12: false })
    }, '*');
  });
})();
<\/script>`;

    // Compose and return the complete srcdoc document
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${consoleInterceptor}
  <style>
${css}
  </style>
</head>
<body>
${html}
<script>
try {
${js}
} catch(e) {
  console.error(e);
}
<\/script>
</body>
</html>`;
}

/**
 * Renders the live preview by writing the composed document to the iframe's srcdoc.
 * Triggers a complete fresh iframe reload each time it is called.
 * Updates the preview status indicator briefly to 'Running' then back to 'Ready'.
 */
function renderPreview() {
    const iframe    = document.getElementById('livePreview');
    const statusEl  = document.getElementById('previewStatus');

    if (!iframe) return;

    // Briefly show 'Running' status while the iframe loads
    if (statusEl) {
        statusEl.textContent = 'Running';
        statusEl.className   = 'wsb-preview-status is-running';
        setTimeout(() => {
            statusEl.textContent = 'Ready';
            statusEl.className   = 'wsb-preview-status';
        }, 800);
    }

    // Write srcdoc — this triggers a full iframe reload with the new document
    iframe.srcdoc = buildPreviewDocument();
}

/* =============================================================================
   7. VIRTUAL CONSOLE — postMessage bridge + entry render pipeline
   ============================================================================= */

/**
 * Attaches a window message listener for the SANDBOX_CONSOLE postMessage protocol.
 * Only processes messages matching the exact type identifier to prevent
 * accidental processing of third-party postMessage events on the page.
 * Called once during boot.
 */
function initConsoleListener() {
    window.addEventListener('message', (event) => {
        // Security gate: only handle our specific SANDBOX_CONSOLE protocol
        if (!event.data || event.data.type !== 'SANDBOX_CONSOLE') return;

        const { level, args, timestamp } = event.data;
        appendConsoleEntry(level, args, timestamp);
    });
}

/**
 * Appends a new styled entry row to the Virtual Console output area.
 * Manages the max-entry limit (trims oldest entry when full).
 * Applies the current active filter immediately.
 * Updates the count badge in the console header.
 *
 * @param {'log'|'warn'|'error'|'info'} level - The console log level.
 * @param {string[]} args   - Array of stringified argument values from the iframe.
 * @param {string}   time   - Timestamp string (HH:MM:SS).
 */
function appendConsoleEntry(level, args, time) {
    const body    = document.getElementById('vconsoleBody');
    const emptyEl = document.getElementById('vconsoleEmpty');
    if (!body) return;

    // Hide the empty-state placeholder once at least one entry exists
    if (emptyEl) emptyEl.style.display = 'none';

    // Enforce the MAX_CONSOLE_ENTRIES limit to prevent DOM memory bloat
    const existingEntries = body.querySelectorAll('.vconsole-entry');
    if (existingEntries.length >= CONFIG.MAX_CONSOLE_ENTRIES) {
        existingEntries[0].remove(); // Prune the oldest (top) entry
    }

    // Build the entry DOM element
    const entry = document.createElement('div');
    entry.className      = `vconsole-entry entry-${level}`;
    entry.dataset.level  = level;

    // Apply the active filter — if this level is hidden, add the filter class immediately
    if (state.consoleFilter !== 'all' && state.consoleFilter !== level) {
        entry.classList.add('is-filtered');
    }

    // Join all args with space to mimic native browser console behavior
    const message = args.join(' ');

    entry.innerHTML = `
        <span class="vconsole-entry-type type-${level}">${level.toUpperCase()}</span>
        <span class="vconsole-entry-msg">${escapeHtml(message)}</span>
        <span class="vconsole-entry-time">${time}</span>
    `;

    body.appendChild(entry);

    // Auto-scroll to the newest entry at the bottom
    body.scrollTop = body.scrollHeight;

    // Update running counters
    state.consoleTotal++;
    if (level === 'error') state.consoleErrors++;
    if (level === 'warn')  state.consoleWarnings++;

    updateConsoleCount();
}

/**
 * Escapes HTML special characters in user-generated console output.
 * Prevents XSS from malicious console.log content being injected into the DOM.
 *
 * @param {string} str - Raw string from the iframe console.
 * @returns {string} HTML-entity-encoded safe string.
 */
function escapeHtml(str) {
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;');
}

/**
 * Updates the count badge in the console header with the current total.
 * Applies visual variants: red (.has-errors) if any errors exist,
 * yellow (.has-warnings) if warnings exist but no errors.
 */
function updateConsoleCount() {
    const countEl = document.getElementById('vconsoleCount');
    if (!countEl) return;

    countEl.textContent = state.consoleTotal;
    countEl.className   = 'vconsole-count';

    if (state.consoleErrors > 0)        countEl.classList.add('has-errors');
    else if (state.consoleWarnings > 0) countEl.classList.add('has-warnings');
}

/**
 * Clears all log entries from the Virtual Console and resets all counters.
 * Shows the empty-state placeholder again after clearing.
 * Called by the Clear button and automatically on each Run/Refresh action.
 */
function clearConsole() {
    const body    = document.getElementById('vconsoleBody');
    const emptyEl = document.getElementById('vconsoleEmpty');
    if (!body) return;

    // Remove all rendered log entry elements
    body.querySelectorAll('.vconsole-entry').forEach(el => el.remove());

    // Show the empty-state placeholder
    if (emptyEl) emptyEl.style.display = 'flex';

    // Reset all state counters
    state.consoleTotal    = 0;
    state.consoleErrors   = 0;
    state.consoleWarnings = 0;

    updateConsoleCount();
}

/**
 * Toggles the Virtual Console panel between expanded and collapsed states.
 * Collapsed state shows only the header bar (36px height via CSS).
 * Persists the preference to localStorage so it survives page refreshes.
 */
function toggleConsole() {
    const wrapper   = document.getElementById('vconsoleWrapper');
    const toggleBtn = document.getElementById('vconsoleToggle');
    const icon      = document.getElementById('vconsoleToggleIcon');

    if (!wrapper) return;

    state.consoleCollapsed = !state.consoleCollapsed;
    wrapper.classList.toggle('is-collapsed', state.consoleCollapsed);

    // Flip the chevron direction to indicate current state
    if (icon) {
        icon.className = state.consoleCollapsed
            ? 'fa-solid fa-chevron-up'
            : 'fa-solid fa-chevron-down';
    }

    // Update ARIA attribute for accessibility
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(!state.consoleCollapsed));
    }

    // Persist collapsed state — restored on next page load during init
    localStorage.setItem(CONFIG.STORAGE_KEYS.consoleOpen, String(!state.consoleCollapsed));
}

/**
 * Applies a filter to the Virtual Console, showing only entries matching the level.
 * Updates the active state on filter buttons.
 * Immediately shows/hides existing entries without re-rendering them.
 *
 * @param {'all'|'log'|'warn'|'error'} filter - The level to filter by.
 */
function applyConsoleFilter(filter) {
    state.consoleFilter = filter;

    // Update active state on the filter toggle buttons
    document.querySelectorAll('.vconsole-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Toggle .is-filtered on existing entries to show/hide them
    document.querySelectorAll('.vconsole-entry').forEach(entry => {
        const isVisible = filter === 'all' || entry.dataset.level === filter;
        entry.classList.toggle('is-filtered', !isVisible);
    });
}

/* =============================================================================
   8. TOOLBAR ACTIONS
   ============================================================================= */

/**
 * Switches the active Monaco editor tab to the given language.
 * Updates tab button aria states and shows/hides the corresponding editor mount div.
 * Forces Monaco to relayout (required when the editor was hidden via display:none).
 *
 * @param {'html'|'css'|'js'} lang - The language tab to activate.
 */
function switchEditorTab(lang) {
    if (lang === state.activeTab) return; // Nothing to do if already active
    state.activeTab = lang;

    // Update aria-selected and .active class on tab buttons
    document.querySelectorAll('.editor-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
        btn.setAttribute('aria-selected', String(btn.dataset.lang === lang));
    });

    // Show the correct editor instance, hide the other two
    document.querySelectorAll('.editor-instance').forEach(el => {
        el.classList.toggle('active', el.id === `editor-${lang}`);
    });

    // Force Monaco to recalculate its layout after the container becomes visible
    if (state.editors[lang]) {
        state.editors[lang].layout();
        state.editors[lang].focus();
    }
}

/**
 * Triggers Monaco's built-in document formatter on the currently active editor.
 * Equivalent to pressing Alt+Shift+F in VS Code.
 * Shows a global toast notification on success or failure.
 */
function formatActiveEditor() {
    const editor = state.editors[state.activeTab];
    if (!editor) return;

    editor.getAction('editor.action.formatDocument').run()
        .then(() => {
            window.showToast('Code formatted successfully');
        })
        .catch(() => {
            window.showToast('Formatter not available for this language', true);
        });
}

/**
 * Toggles word wrap on/off across all three Monaco editor instances simultaneously.
 * Persists the setting to localStorage for restoration on next visit.
 * Highlights the Wrap toolbar button when active.
 */
function toggleWordWrap() {
    state.wordWrap = !state.wordWrap;
    const wrap = state.wordWrap ? 'on' : 'off';

    // Apply the new word wrap option to all three editors
    Object.values(state.editors).forEach(editor => {
        if (editor) editor.updateOptions({ wordWrap: wrap });
    });

    // Toggle visual active state on the Wrap button
    const btn = document.getElementById('btnWordWrap');
    if (btn) btn.classList.toggle('toolbar-btn--primary', state.wordWrap);

    localStorage.setItem(CONFIG.STORAGE_KEYS.wordWrap, String(state.wordWrap));
    window.showToast(`Word wrap ${state.wordWrap ? 'enabled' : 'disabled'}`);
}

/**
 * Loads a boilerplate code template into all three Monaco editor instances.
 * Closes the template dropdown, sets editor values, re-renders the preview,
 * and triggers autosave so the template persists for the user.
 *
 * @param {string} templateKey - One of the keys in CONFIG.TEMPLATES.
 */
function loadTemplate(templateKey) {
    const template = CONFIG.TEMPLATES[templateKey];
    if (!template) return;

    closeTemplateDropdown();

    // Write template code into all three editors
    setEditorValue('html', template.html);
    setEditorValue('css',  template.css);
    setEditorValue('js',   template.js);

    // Immediately re-render the preview and save to localStorage
    renderPreview();
    autoSave();

    window.showToast(`Template "${templateKey}" loaded`);
}

/**
 * Opens or closes the Template dropdown menu.
 * Toggles the .is-open class on the dropdown element.
 */
function toggleTemplateDropdown() {
    const dropdown = document.getElementById('templateDropdown');
    if (!dropdown) return;

    state.templateDropdownOpen = !state.templateDropdownOpen;
    dropdown.classList.toggle('is-open', state.templateDropdownOpen);
}

/**
 * Closes the Template dropdown menu by removing .is-open.
 * Called when a template is selected, or when the user clicks outside.
 */
function closeTemplateDropdown() {
    const dropdown = document.getElementById('templateDropdown');
    if (dropdown) dropdown.classList.remove('is-open');
    state.templateDropdownOpen = false;
}

/**
 * Shows the "Clear All Code" confirmation modal.
 * Adds .is-open to the modal overlay to display it.
 * Focuses the Cancel button for keyboard accessibility.
 */
function showClearConfirmModal() {
    const overlay = document.getElementById('clearModalOverlay');
    if (overlay) {
        overlay.classList.add('is-open');
        // Delay focus slightly to let the CSS transition complete
        setTimeout(() => {
            const cancel = overlay.querySelector('.modal-btn-cancel');
            if (cancel) cancel.focus();
        }, 100);
    }
}

/**
 * Hides the "Clear All Code" confirmation modal.
 * Removes .is-open from the modal overlay.
 */
function hideClearConfirmModal() {
    const overlay = document.getElementById('clearModalOverlay');
    if (overlay) overlay.classList.remove('is-open');
}

/**
 * Clears all three editor instances and removes their localStorage entries.
 * Called after the user confirms in the clear confirmation modal.
 * Also clears the Virtual Console and re-renders the (now empty) preview.
 */
function clearAllCode() {
    // Clear all three editors to empty strings
    setEditorValue('html', '');
    setEditorValue('css',  '');
    setEditorValue('js',   '');

    // Remove saved code from localStorage
    [CONFIG.STORAGE_KEYS.html, CONFIG.STORAGE_KEYS.css, CONFIG.STORAGE_KEYS.js].forEach(key => {
        localStorage.removeItem(key);
    });

    hideClearConfirmModal();
    clearConsole();
    renderPreview();
    window.showToast('All code cleared');
}

/**
 * Exports the current project as a downloadable ZIP file.
 * Uses JSZip to bundle three files in memory, then FileSaver.js to trigger download.
 *
 * ZIP contents:
 * ├── index.html  (user HTML wrapped in a full document with <link> + <script> refs)
 * ├── style.css   (raw CSS from the CSS editor)
 * └── script.js  (raw JavaScript from the JS editor)
 *
 * Adds .is-loading to the Export button during the async generation for visual feedback.
 *
 * @returns {Promise<void>}
 */
async function exportAsZip() {
    // Verify JSZip is available — it's loaded from local assets
    if (typeof JSZip === 'undefined') {
        window.showToast('JSZip library not loaded — cannot export', true);
        return;
    }

    const btn = document.getElementById('btnExportZip');
    if (btn) btn.classList.add('is-loading'); // Show loading state on button

    try {
        const { html, css, js } = getEditorValues();

        // Build the wrapper index.html that links the CSS and JS as external files
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${html}
<script src="script.js"><\/script>
</body>
</html>`;

        // Create the JSZip instance and add the three project files
        const zip = new JSZip();
        zip.file('index.html', indexHtml);
        zip.file('style.css',  css);
        zip.file('script.js',  js);

        // Generate the ZIP archive asynchronously with DEFLATE compression
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

        // Trigger the browser download dialog using FileSaver.js
        const fileName = `sandbox-project-${Date.now()}.zip`;
        saveAs(blob, fileName);

        window.showToast(`Exported as ${fileName}`);
    } catch (err) {
        console.error('[Sandbox] ZIP export failed:', err);
        window.showToast('ZIP export failed — see browser console for details', true);
    } finally {
        // Always remove the loading state, even if export failed
        if (btn) btn.classList.remove('is-loading');
    }
}

/**
 * Opens the current preview content in a new browser tab.
 * Creates a Blob URL from the composed srcdoc document so the new tab
 * is self-contained and does not require a server.
 * Revokes the Blob URL after 10 seconds to free memory.
 * Shows a warning toast if the browser blocked the pop-up.
 */
function openPreviewInNewTab() {
    const doc  = buildPreviewDocument();
    const blob = new Blob([doc], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);

    const tab = window.open(url, '_blank');

    // Revoke the temporary Blob URL after the new tab has had time to load
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    if (!tab) {
        window.showToast('Pop-up blocked — please allow pop-ups for this site');
    }
}

/**
 * Toggles the preview device frame between 'desktop' (full-width) and
 * 'mobile' (375px — standard mobile viewport width).
 * Updates the device toggle button icon to reflect the current mode.
 * Shows an info toast indicating the current mode.
 */
function toggleDeviceFrame() {
    const frame = document.getElementById('deviceFrame');
    const btn   = document.getElementById('btnDeviceToggle');

    // Flip the device mode
    state.deviceMode = state.deviceMode === 'desktop' ? 'mobile' : 'desktop';

    // Add/remove .is-mobile class on the frame wrapper to trigger CSS width transition
    if (frame) frame.classList.toggle('is-mobile', state.deviceMode === 'mobile');

    // Update the toggle button icon and tooltip
    if (btn) {
        const isMobile = state.deviceMode === 'mobile';
        btn.innerHTML  = isMobile
            ? '<i class="fa-solid fa-mobile-screen-button"></i>'
            : '<i class="fa-solid fa-desktop"></i>';
        btn.title = isMobile ? 'Switch to Desktop View' : 'Switch to Mobile View';
        btn.classList.toggle('is-active', isMobile);
    }

    window.showToast(
        `Preview: ${state.deviceMode === 'mobile' ? 'Mobile (375px)' : 'Desktop (Full Width)'}`
    );
}

/* =============================================================================
   9. SPLIT.JS — Resizable editor/preview panels
   ============================================================================= */

/**
 * Initializes Split.js on the editor and preview panes to create a
 * draggable horizontal divider between them.
 *
 * Notes:
 * - Skipped entirely on mobile (≤768px) where panels stack vertically via CSS.
 * - Restores the user's last split ratio from localStorage.
 * - On drag end, saves the new sizes and forces Monaco editors to relayout.
 * - The CSS `--gutter-size` variable controls the gutter width (default: 6px).
 */
function initSplitPanels() {
    // Mobile skip — CSS handles vertical stacking; Split.js is not needed
    if (window.innerWidth <= 768) return;

    // Verify Split.js loaded correctly
    if (typeof Split === 'undefined') {
        console.warn('[Sandbox] Split.js not loaded — skipping resizable panels');
        return;
    }

    // Restore last saved split sizes, falling back to the default 50/50 split
    let sizes = CONFIG.DEFAULT_SPLIT;
    try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.splitSizes);
        if (saved) sizes = JSON.parse(saved);
    } catch (_) { /* Use defaults if saved value is malformed */ }

    // Initialize Split.js on the two pane containers
    state.splitInstance = Split(['#paneEditor', '#panePreview'], {
        sizes,
        minSize     : [280, 280], // Minimum width to prevent editors from disappearing
        gutterSize  : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gutter-size')) || 6,
        cursor      : 'col-resize',
        direction   : 'horizontal',
        onDragEnd   : (newSizes) => {
            // Persist the new split ratio after the user finishes dragging
            localStorage.setItem(CONFIG.STORAGE_KEYS.splitSizes, JSON.stringify(newSizes));

            // Force Monaco editors to recalculate their dimensions after resize
            Object.values(state.editors).forEach(editor => {
                if (editor) editor.layout();
            });
        },
    });
}

/* =============================================================================
   10. EVENT LISTENERS — Bind all DOM interactions
   ============================================================================= */

/**
 * Attaches all event listeners to toolbar buttons, console controls, and modal.
 * Called once during init, before Monaco loads, so the UI is always interactive.
 */
function bindEventListeners() {

    // ── Language tab switcher ──────────────────────────────────────────────────
    document.querySelectorAll('.editor-tab').forEach(btn => {
        btn.addEventListener('click', () => switchEditorTab(btn.dataset.lang));
    });

    // ── Format active editor ───────────────────────────────────────────────────
    document.getElementById('btnFormat')?.addEventListener('click', formatActiveEditor);

    // ── Word wrap toggle ───────────────────────────────────────────────────────
    document.getElementById('btnWordWrap')?.addEventListener('click', toggleWordWrap);

    // ── Template dropdown toggle ───────────────────────────────────────────────
    document.getElementById('btnTemplate')?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the document click handler from closing it immediately
        toggleTemplateDropdown();
    });

    // ── Template item selection ────────────────────────────────────────────────
    document.querySelectorAll('.dropdown-item[data-template]').forEach(item => {
        item.addEventListener('click', () => loadTemplate(item.dataset.template));
    });

    // ── Close template dropdown on outside click ───────────────────────────────
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.toolbar-dropdown-wrap')) {
            closeTemplateDropdown();
        }
    });

    // ── Clear all code (opens modal first) ────────────────────────────────────
    document.getElementById('btnClear')?.addEventListener('click', showClearConfirmModal);

    // ── Export as ZIP ──────────────────────────────────────────────────────────
    document.getElementById('btnExportZip')?.addEventListener('click', exportAsZip);

    // ── Run / Force preview refresh ────────────────────────────────────────────
    const btnRun = document.getElementById('btnRun');
    if (btnRun) {
        btnRun.addEventListener('click', () => {
            clearConsole();
            renderPreview();
            window.showToast('Preview refreshed');
        });
    }

    // ── Preview: force refresh ─────────────────────────────────────────────────
    document.getElementById('btnPreviewRefresh')?.addEventListener('click', () => {
        clearConsole();
        renderPreview();
    });

    // ── Preview: open in new tab ───────────────────────────────────────────────
    document.getElementById('btnPreviewNewTab')?.addEventListener('click', openPreviewInNewTab);

    // ── Preview: device toggle (desktop / mobile) ──────────────────────────────
    document.getElementById('btnDeviceToggle')?.addEventListener('click', toggleDeviceFrame);

    // ── Virtual Console: clear ─────────────────────────────────────────────────
    document.getElementById('vconsoleClear')?.addEventListener('click', clearConsole);

    // ── Virtual Console: collapse / expand ────────────────────────────────────
    document.getElementById('vconsoleToggle')?.addEventListener('click', toggleConsole);

    // ── Virtual Console: filter buttons ───────────────────────────────────────
    document.querySelectorAll('.vconsole-filter').forEach(btn => {
        btn.addEventListener('click', () => applyConsoleFilter(btn.dataset.filter));
    });

    // ── Modal: Cancel button ───────────────────────────────────────────────────
    document.getElementById('modalBtnCancel')?.addEventListener('click', hideClearConfirmModal);

    // ── Modal: Confirm (clear all) button ─────────────────────────────────────
    document.getElementById('modalBtnConfirm')?.addEventListener('click', clearAllCode);

    // ── Modal: close when clicking outside the modal card ─────────────────────
    document.getElementById('clearModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) hideClearConfirmModal();
    });

    // ── Modal: close on Escape key ────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideClearConfirmModal();
    });

    // ── Window resize: relayout Monaco editors ────────────────────────────────
    // Split.js handles its own resize; we only need to notify Monaco instances.
    window.addEventListener('resize', debounce(() => {
        Object.values(state.editors).forEach(editor => {
            if (editor) editor.layout();
        });
    }, 200));
}

/**
 * Injects the "Clear All Code" confirmation modal HTML into the document body.
 * Called once during init to keep the static HTML clean and minimal.
 * The modal is hidden by default (no .is-open class); JS controls its visibility.
 */
function injectModalHtml() {
    const modalHtml = `
    <div class="sandbox-modal-overlay" id="clearModalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="sandbox-modal">
            <h3 id="modalTitle">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Clear All Code?
            </h3>
            <p>This will permanently erase all HTML, CSS, and JavaScript from all three editors, and clear the console. This action cannot be undone.</p>
            <div class="sandbox-modal-actions">
                <button class="modal-btn modal-btn-cancel" id="modalBtnCancel">Cancel</button>
                <button class="modal-btn modal-btn-confirm" id="modalBtnConfirm">
                    <i class="fa-solid fa-trash-can"></i> Yes, Clear Everything
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/* =============================================================================
   11. BOOT — Application entry point
   ============================================================================= */

/**
 * Main initialization function — coordinates all sub-system startups in order.
 *
 * Order matters here:
 * 1. injectModalHtml()    — DOM ready before binding events
 * 2. bindEventListeners() — UI responsive before Monaco loads (Monaco is async)
 * 3. initSplitPanels()    — Panel dimensions set before Monaco mounts
 * 4. initConsoleListener()— postMessage listener ready before preview runs
 * 5. initMonaco()         — Async; calls renderPreview() when ready
 * 6. Restore console state — Deferred until after Monaco (avoids DOM conflicts)
 * 7. System welcome log   — Delayed to ensure console is rendered and ready
 */
function init() {
    // Step 1: Inject dynamic DOM elements (modal overlay) into the body
    injectModalHtml();

    // Step 2: Bind all event listeners (before Monaco so UI is always responsive)
    bindEventListeners();

    // Step 3: Initialize Split.js resizable panels (desktop only)
    // Must happen before Monaco so panel dimensions are established first
    initSplitPanels();

    // Step 4: Start listening for console postMessages from the iframe
    initConsoleListener();

    // Step 5: Initialize Monaco Editor (async via AMD require)
    // Monaco calls renderPreview() internally once all three editors are ready
    initMonaco();

    // Step 6: Restore the console collapsed/expanded state from last session
    const consoleWasOpen = localStorage.getItem(CONFIG.STORAGE_KEYS.consoleOpen);
    if (consoleWasOpen === 'false') {
        // User had the console collapsed on their last visit — restore that state
        state.consoleCollapsed = true;
        const wrapper = document.getElementById('vconsoleWrapper');
        const icon    = document.getElementById('vconsoleToggleIcon');
        if (wrapper) wrapper.classList.add('is-collapsed');
        if (icon)    icon.className = 'fa-solid fa-chevron-up';
    }

    // Step 7: Append a system welcome message to the Virtual Console.
    // Delayed by 1200ms to ensure Monaco has loaded and the console is rendered.
    // This bypasses console.log() (which routes through the iframe) and writes
    // directly to the DOM as a tool-ready confirmation message.
    setTimeout(() => {
        appendConsoleEntry('info', ['Web Sandbox STUDIO MAX initialized ✅ — Start coding!'], getTimeStamp());
    }, 1200);
}

// ── Bootstrap: start the application once the DOM is fully parsed ─────────────
if (document.readyState === 'loading') {
    // Script loaded in <head> or mid-<body> — wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', init);
} else {
    // Script loaded with defer or at bottom of <body> — DOM is already ready
    init();
}
