/**
 * =============================================================================
 *  JS CODE ARMOR — script.js
 *  Tool        : JavaScript Obfuscator & Code Protector
 *  Category    : Security (sec)
 *  Author      : Trusted Tools Web
 *  Version     : 2.0 (CodeCanyon Release Build)
 *
 *  Architecture Overview:
 *  ─────────────────────────────────────────────────────────────────────────
 *  SECTION 1  : State & Global Variables
 *  SECTION 2  : Monaco Editor Initialization (input + output)
 *  SECTION 3  : Protection Level Presets (Stealth / Balanced / Fortress / God)
 *  SECTION 4  : God Mode UI Control (expand/collapse panel & feature configs)
 *  SECTION 5  : Input Helpers (getInputCode / setOutputCode / clearEditor)
 *  SECTION 6  : Time-Bomb Wrapper Injection (Date.now() expiry guard)
 *  SECTION 7  : Image Steganography Engine (Canvas API pixel encoding)
 *  SECTION 8  : Main Obfuscation Pipeline (async orchestrator)
 *  SECTION 9  : Steganography Pipeline (capacity check + encode + preview)
 *  SECTION 10 : Analysis Report Generator (size metrics + score + tags)
 *  SECTION 11 : Progress Bar Helpers (start / update / complete / stop)
 *  SECTION 12 : Tab Navigation (output / analysis / wrap)
 *  SECTION 13 : Reset (full tool state reset)
 *  SECTION 14 : Copy & Download Helpers
 *  SECTION 15 : Utility Functions (sleep helper)
 *  SECTION 16 : Theme Sync (Monaco theme follows global dark/light toggle)
 *  SECTION 17 : Initialization on DOMContentLoaded
 * =============================================================================
 */


/* ============================================================================
   SECTION 1: STATE & GLOBAL VARIABLES
   Central mutable state for editor instances, processed output, and options.
============================================================================ */

/** @type {monaco.editor.IStandaloneCodeEditor|null} Monaco input editor instance */
let monacoInput  = null;

/** @type {monaco.editor.IStandaloneCodeEditor|null} Monaco output editor instance (readonly) */
let monacoOutput = null;

/** @type {boolean} Tracks whether the Monaco CDN loaded successfully */
let monacoReady  = false;

/** @type {string} Stores the most recently generated obfuscated JavaScript string */
let lastObfuscatedCode = '';

/** @type {string} Stores the last steganography output as a base64 PNG data URL */
let lastStegoDataURL = '';

/**
 * Protection Level Preset Configurations.
 *
 * Each key maps to a UI toggle state object and a corresponding
 * javascript-obfuscator options object (obfOpts). These presets are applied
 * by setLevel() and merged with live toggle overrides in buildObfuscatorOptions().
 *
 * Levels:
 *   - low  (Stealth)   : Minimal obfuscation, fastest output, identifier renaming only.
 *   - medium (Balanced): Default — Control Flow + String Enc, no debug protection.
 *   - high (Fortress)  : All protections enabled, RC4 string encoding.
 *   - god  (God Mode)  : Maximum preset + God Mode panel enabled (Time-Bomb / Stego).
 */
const LEVEL_PRESETS = {

    /** Stealth: fast, light obfuscation — only renames identifiers */
    low: {
        controlFlow:    false,
        stringEnc:      false,
        deadCode:       false,
        antiDebug:      false,
        selfDefend:     false,
        renameId:       true,
        godMode:        false,
        obfOpts: {
            compact                      : true,
            controlFlowFlattening        : false,
            deadCodeInjection            : false,
            debugProtection              : false,
            selfDefending                : false,
            stringArray                  : true,
            stringArrayEncoding          : [],
            renameIdentifiers            : true,
            identifierNamesGenerator     : 'mangled',
        }
    },

    /** Balanced: everyday protection — Control Flow + Base64 string encoding */
    medium: {
        controlFlow:    true,
        stringEnc:      true,
        deadCode:       false,
        antiDebug:      false,
        selfDefend:     false,
        renameId:       true,
        godMode:        false,
        obfOpts: {
            compact                         : true,
            controlFlowFlattening           : true,
            controlFlowFlatteningThreshold  : 0.5,
            deadCodeInjection               : false,
            debugProtection                 : false,
            selfDefending                   : false,
            stringArray                     : true,
            stringArrayEncoding             : ['base64'],
            stringArrayThreshold            : 0.75,
            renameIdentifiers               : true,
            identifierNamesGenerator        : 'hexadecimal',
        }
    },

    /** Fortress: maximum standard protection — RC4 encoding + anti-debug + self-defend */
    high: {
        controlFlow:    true,
        stringEnc:      true,
        deadCode:       true,
        antiDebug:      true,
        selfDefend:     true,
        renameId:       true,
        godMode:        false,
        obfOpts: {
            compact                         : true,
            controlFlowFlattening           : true,
            controlFlowFlatteningThreshold  : 0.75,
            deadCodeInjection               : true,
            deadCodeInjectionThreshold      : 0.4,
            debugProtection                 : true,
            debugProtectionInterval         : 2000,
            selfDefending                   : true,
            stringArray                     : true,
            stringArrayEncoding             : ['rc4'],
            stringArrayThreshold            : 1,
            unicodeEscapeSequence           : true,
            renameIdentifiers               : true,
            identifierNamesGenerator        : 'hexadecimal',
        }
    },

    /** God Mode: all Fortress options + object key transformation + number-to-expression */
    god: {
        controlFlow:    true,
        stringEnc:      true,
        deadCode:       true,
        antiDebug:      true,
        selfDefend:     true,
        renameId:       true,
        godMode:        true,
        obfOpts: {
            compact                         : true,
            controlFlowFlattening           : true,
            controlFlowFlatteningThreshold  : 1,
            deadCodeInjection               : true,
            deadCodeInjectionThreshold      : 0.5,
            debugProtection                 : true,
            debugProtectionInterval         : 2000,
            selfDefending                   : true,
            stringArray                     : true,
            stringArrayEncoding             : ['rc4'],
            stringArrayThreshold            : 1,
            unicodeEscapeSequence           : true,
            renameIdentifiers               : true,
            identifierNamesGenerator        : 'hexadecimal',
            transformObjectKeys             : true,
            numbersToExpressions            : true,
        }
    }
};

/** @type {string} Currently active protection level key */
let currentLevel = 'medium';


/* ============================================================================
   SECTION 2: MONACO EDITOR INITIALIZATION
   Attempts to load Monaco Editor (IDE-quality syntax highlighting) from CDN.
   Falls back to styled textareas if the CDN is unavailable (e.g., offline).
============================================================================ */

/**
 * Initializes both Monaco editor instances: the input editor (editable)
 * and the output editor (readonly). Called once the Monaco AMD loader
 * script has been detected on the window object.
 */
function initMonaco() {

    // Configure the Monaco base path for the require() loader to use local files
    require.config({
        paths: {
            vs: '../../assets/library/monaco-editor/min/vs'
        }
    });

    require(['vs/editor/editor.main'], function () {
        monacoReady = true;

        // ── Input Editor (left panel) ──────────────────────────────────────
        // Provides a full IDE experience with syntax highlighting and line numbers.
        monacoInput = monaco.editor.create(document.getElementById('monacoEditor'), {
            value: [
                '// Paste your JavaScript code here to protect it.',
                '// Example:',
                '',
                'function calculateDiscount(price, userLevel) {',
                '    const SECRET_KEY = "promo2026-xyz";',
                '    const discountMap = {',
                '        "gold": 0.30,',
                '        "silver": 0.15,',
                '        "bronze": 0.05',
                '    };',
                '    const rate = discountMap[userLevel] || 0;',
                '    return price * (1 - rate);',
                '}',
            ].join('\n'),
            language             : 'javascript',
            theme                : getMonacoTheme(),
            minimap              : { enabled: false },
            fontSize             : 13,
            fontFamily           : "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures        : true,
            lineNumbers          : 'on',
            scrollBeyondLastLine : false,
            automaticLayout      : true,
            padding              : { top: 12, bottom: 12 },
            wordWrap             : 'on',
        });

        // ── Output Editor (right panel, readonly) ──────────────────────────
        // Displays the obfuscated result with syntax highlighting.
        monacoOutput = monaco.editor.create(document.getElementById('monacoOutput'), {
            value                : '// Protected code will appear here...',
            language             : 'javascript',
            theme                : getMonacoTheme(),
            minimap              : { enabled: false },
            fontSize             : 12,
            fontFamily           : "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures        : true,
            lineNumbers          : 'off',
            readOnly             : true,
            scrollBeyondLastLine : false,
            automaticLayout      : true,
            padding              : { top: 12, bottom: 12 },
            wordWrap             : 'on',
            contextmenu          : false,
        });

        // Keep the empty state visible until a real obfuscation run occurs
        document.getElementById('outputEmptyState').style.display = 'flex';

        console.log('[JS Code Armor] Monaco Editor initialized successfully.');
    });
}

/**
 * Returns the correct Monaco theme string based on the current site theme.
 * Reads the body class set by the global theme toggle.
 *
 * @returns {'vs-dark'|'vs'}
 */
function getMonacoTheme() {
    return document.body.classList.contains('light-mode') ? 'vs' : 'vs-dark';
}

/**
 * Activates the fallback textarea editors when Monaco fails to load.
 * Hides the Monaco mount divs and shows the plain textareas instead.
 * Called automatically after a 5-second timeout if monacoReady is still false.
 */
function activateFallbackEditors() {
    if (monacoReady) return; // Monaco loaded fine — no fallback needed

    console.warn('[JS Code Armor] Monaco failed. Activating fallback editors.');
    document.getElementById('monacoEditor').style.display    = 'none';
    document.getElementById('monacoOutput').style.display    = 'none';
    document.getElementById('fallbackEditor').style.display  = 'block';
    document.getElementById('outputCode').style.display      = 'block';
    document.getElementById('outputEmptyState').style.display = 'none';
}

// ── Boot Monaco when the full page has loaded ────────────────────────────────
window.addEventListener('load', function () {

    // Check if Monaco's require() loader was successfully injected from CDN
    if (typeof require !== 'undefined') {
        initMonaco();
    } else {
        // Monaco CDN script failed (e.g., offline) — use fallback textareas immediately
        activateFallbackEditors();
        return;
    }

    // Safety timeout: if Monaco hasn't initialized in 5 seconds, activate fallback
    setTimeout(activateFallbackEditors, 5000);

    // Pre-fill the Time-Bomb date picker with a sensible default (30 days from now)
    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const isoLocal = new Date(defaultExpiry - defaultExpiry.getTimezoneOffset() * 60000)
                        .toISOString().slice(0, 16);
    document.getElementById('timebombDate').value = isoLocal;
    updateTimebombDisplay();
});


/* ============================================================================
   SECTION 3: PROTECTION LEVEL PRESETS
   Applies a named preset to all UI toggle states and updates the active pill.
============================================================================ */

/**
 * Applies a protection level preset to the tool's UI toggles.
 * Reads from LEVEL_PRESETS and updates all six checkboxes,
 * the active pill highlight, and the God Mode panel state.
 *
 * @param {'low'|'medium'|'high'|'god'} level - The preset key to apply
 */
function setLevel(level) {
    currentLevel = level;

    const preset = LEVEL_PRESETS[level];
    if (!preset) return;

    // ── Sync all six protection toggle checkboxes to the preset ──────────
    document.getElementById('opt_controlFlow').checked = preset.controlFlow;
    document.getElementById('opt_stringEnc').checked   = preset.stringEnc;
    document.getElementById('opt_deadCode').checked    = preset.deadCode;
    document.getElementById('opt_antiDebug').checked   = preset.antiDebug;
    document.getElementById('opt_selfDefend').checked  = preset.selfDefend;
    document.getElementById('opt_renameId').checked    = preset.renameId;

    // ── Highlight the matching level pill button ───────────────────────
    document.querySelectorAll('.jca-level-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.level === level);
    });

    // ── Handle God Mode panel visibility ──────────────────────────────
    const godToggle = document.getElementById('godModeToggle');
    if (level === 'god') {
        // Selecting the God Mode level auto-enables the God Mode panel
        godToggle.checked = true;
        toggleGodMode(true);
    } else {
        // Other levels do not force-disable God Mode if user manually enabled it
        if (currentLevel !== 'god') {
            godToggle.checked = false;
            toggleGodMode(false);
        }
    }
}


/* ============================================================================
   SECTION 4: GOD MODE UI CONTROL
   Expands/collapses the God Mode panel and individual feature config sections.
============================================================================ */

/**
 * Shows or hides the God Mode feature body panel.
 * Adds/removes .active on the panel (glowing border) and .visible on the body.
 *
 * @param {boolean} enabled - true to expand God Mode panel, false to collapse
 */
function toggleGodMode(enabled) {
    const panel = document.getElementById('godModePanel');
    const body  = document.getElementById('godModeBody');

    if (enabled) {
        panel.classList.add('active');
        body.classList.add('visible');

        // If God Mode panel was manually opened but level isn't 'god', sync the pill
        if (currentLevel !== 'god') {
            setLevel('god');
        }
    } else {
        panel.classList.remove('active');
        body.classList.remove('visible');
    }
}

/**
 * Shows or hides a specific God Mode feature's config section.
 * Called via the individual feature toggle (timebombEnabled / stegoEnabled).
 *
 * @param {'timebomb'|'stego'} featureKey - Which feature config to toggle
 * @param {boolean} enabled               - true to show config, false to hide
 */
function toggleFeatureUI(featureKey, enabled) {
    const configEl = document.getElementById(`${featureKey}_config`);
    if (configEl) {
        configEl.style.display = enabled ? 'block' : 'none';
    }

    // Show/hide the redirect URL input when Time-Bomb action changes
    if (featureKey === 'timebomb') {
        handleTimebombActionChange();
    }
}

/**
 * Conditionally shows or hides the redirect URL input field inside
 * the Time-Bomb config based on the selected "On Expiry Action" value.
 * Only visible when the user selects "Redirect to URL".
 */
function handleTimebombActionChange() {
    const action        = document.getElementById('timebombAction').value;
    const redirectGroup = document.getElementById('timebombRedirectGroup');
    redirectGroup.style.display = (action === 'redirect') ? 'block' : 'none';
}

/**
 * Updates the human-readable expiry date string shown in the Time-Bomb
 * info preview box whenever the datetime-local input value changes.
 */
function updateTimebombDisplay() {
    const dateInput = document.getElementById('timebombDate');
    const display   = document.getElementById('timebombDateDisplay');
    if (!display) return;

    if (dateInput.value) {
        const d = new Date(dateInput.value);
        display.textContent = d.toLocaleString(undefined, {
            dateStyle : 'long',
            timeStyle : 'short'
        });
    } else {
        display.textContent = 'the selected date';
    }
}

// Attach live-update listeners for the Time-Bomb date and action selectors
document.addEventListener('DOMContentLoaded', function () {
    const tbDate   = document.getElementById('timebombDate');
    const tbAction = document.getElementById('timebombAction');

    if (tbDate)   tbDate.addEventListener('change', updateTimebombDisplay);
    if (tbAction) tbAction.addEventListener('change', handleTimebombActionChange);
});


/* ============================================================================
   SECTION 5: INPUT HELPERS
   Abstractions for reading from and writing to Monaco or fallback editors.
============================================================================ */

/**
 * Gets the current source code from whichever input editor is active.
 * Prefers Monaco; falls back to the plain textarea.
 *
 * @returns {string} The raw JavaScript source code string
 */
function getInputCode() {
    if (monacoReady && monacoInput) {
        return monacoInput.getValue();
    }
    return document.getElementById('fallbackEditor').value;
}

/**
 * Clears the input editor — resets the Monaco model value or the textarea.
 */
function clearEditor() {
    if (monacoReady && monacoInput) {
        monacoInput.setValue('');
    } else {
        document.getElementById('fallbackEditor').value = '';
    }
}

/**
 * Sets the obfuscated output code in Monaco (or fallback textarea).
 * Also hides the empty-state placeholder and syncs the hidden textarea
 * used by clipboard copy fallback.
 *
 * @param {string} code - The processed JavaScript string to display
 */
function setOutputCode(code) {
    if (monacoReady && monacoOutput) {
        monacoOutput.setValue(code);
        document.getElementById('outputEmptyState').style.display = 'none';
    } else {
        document.getElementById('outputCode').value = code;
        document.getElementById('outputEmptyState').style.display = 'none';
    }
    // Always keep the hidden textarea in sync (used by copyCode() fallback)
    document.getElementById('outputCode').value = code;
}


/* ============================================================================
   SECTION 6: TIME-BOMB WRAPPER INJECTION
   Injects a Date.now() guard at the top of the obfuscated code.
   The guard checks whether the current timestamp has exceeded the expiry.
============================================================================ */

/**
 * Wraps the given JS code with a Time-Bomb expiry guard.
 *
 * Generated wrapper structure:
 * ─────────────────────────────────────────────────────────────────
 * (function() {
 *     var _t = (tsHalf1 + tsHalf2);   // Split timestamp for obfuscation
 *     if (Date['now']() > _t) {
 *         // selected expiry action (silent / redirect / alert)
 *         return;
 *     }
 *     (function() {
 *         // original obfuscated code
 *     })();
 * }());
 * ─────────────────────────────────────────────────────────────────
 *
 * The timestamp is split into two halves at the IIFE level to avoid
 * simple find/replace deobfuscation of the expiry value.
 * If the outer wrapper itself is obfuscated at the 'god' level, the
 * timestamp becomes doubly protected through hexadecimal identifier renaming.
 *
 * @param {string} code        - The obfuscated JavaScript to wrap
 * @param {number} expireTs    - Unix timestamp (milliseconds) of the expiry
 * @param {string} action      - 'silence' | 'redirect' | 'alert'
 * @param {string} redirectUrl - Target URL if action === 'redirect'
 * @returns {string}           - The time-bomb wrapped code string
 */
function injectTimeBomb(code, expireTs, action, redirectUrl) {
    let expiredHandler = '';

    switch (action) {
        case 'redirect':
            // Silently redirect the browser to the specified URL on expiry
            expiredHandler = `window.location.href = "${redirectUrl || 'https://example.com'}";`;
            break;
        case 'alert':
            // Notify the user with an alert dialog and halt execution
            expiredHandler = `alert("This application has expired. Please contact the developer.");`;
            break;
        case 'silence':
        default:
            // Silent fail — execution halts with no visible user-facing message
            expiredHandler = `/* License expired. Execution halted. */`;
            break;
    }

    // Split the timestamp into two halves — simple anti-trivial-reverse measure
    const tsHalf1 = Math.floor(expireTs / 2);
    const tsHalf2 = expireTs - tsHalf1;

    return `/* [Time-Bomb Guard] — Code expires: ${new Date(expireTs).toUTCString()} */
(function(){var _t=(${tsHalf1}+${tsHalf2});if(Date['now']()>_t){${expiredHandler}return;}(function(){${code}})();}());`;
}


/* ============================================================================
   SECTION 7: IMAGE STEGANOGRAPHY ENGINE
   Uses the HTML5 Canvas API to encode a JavaScript string into pixel RGB data.

   ENCODING SCHEME:
   ─────────────────────────────────────────────────────────────────────────
   - Each pixel encodes one UTF-16 character (max char code: 65535).
   - R channel = Math.floor(charCode / 256)  → high byte
   - G channel = charCode % 256              → low byte
   - B channel = key length hint (or 0)      → XOR key indicator
   - A channel = 255 (always fully opaque)
   - A null sentinel pixel (R=G=0, A=255) terminates the encoded data.
   - Remaining pixels are filled with random noise for camouflage.

   DECODING SCHEME (companion decoder script):
   ─────────────────────────────────────────────────────────────────────────
   - Load the carrier PNG into a Canvas element.
   - Read pixel RGBA data via getImageData().
   - For each pixel i: charCode = (R * 256) + G
   - Stop at charCode === 0 or when charCount is reached.
   - Optionally XOR-decode using the secret key.
   - Execute the reconstructed string via new Function(str)().

   CAPACITY:
   - A 256×256 image = 65,536 pixels = 65,536 characters max.
   - Most obfuscated scripts are well under this limit.
============================================================================ */

/**
 * Encodes a JavaScript string into the RGBA pixel data of a generated PNG.
 * Returns the image as a base64 data URL along with dimensional metadata.
 *
 * @param {string} jsCode    - The obfuscated JS string to hide in the image
 * @param {number} imgWidth  - Width (in pixels) of the output PNG
 * @param {string} secretKey - Optional XOR key; pass empty string to disable
 * @returns {{ dataURL: string, width: number, height: number, charCount: number }}
 */
function encodeJsInImage(jsCode, imgWidth, secretKey) {
    const canvas  = document.getElementById('stegoCanvas');
    const ctx     = canvas.getContext('2d');
    const charLen = jsCode.length;

    // ── Capacity calculation ──────────────────────────────────────────────
    // +1 pixel for the null sentinel that marks the end of data
    const totalPixels = charLen + 1;
    const imgHeight   = Math.ceil(totalPixels / imgWidth);

    canvas.width  = imgWidth;
    canvas.height = imgHeight;

    // Allocate the image data buffer (Uint8ClampedArray: [R,G,B,A per pixel])
    const imageData = ctx.createImageData(imgWidth, imgHeight);
    const data      = imageData.data;

    // ── Optional XOR key setup ────────────────────────────────────────────
    // Each character's code is XOR'd against a rolling byte sequence derived
    // from the secret key, adding an extra layer of obfuscation.
    const useKey   = secretKey && secretKey.length > 0;
    const keyBytes = useKey ? Array.from(secretKey).map(c => c.charCodeAt(0)) : [];
    const keyLen   = keyBytes.length;

    /**
     * XOR-encodes a char code using the rolling key bytes.
     * Returns the original charCode unchanged when no key is provided.
     *
     * @param {number} charCode - UTF-16 character code to encode
     * @param {number} index    - Position index for rolling key offset
     * @returns {number}        - XOR-encoded character code
     */
    function xorEncode(charCode, index) {
        if (!useKey) return charCode;
        return charCode ^ keyBytes[index % keyLen];
    }

    // ── Encode each character as one pixel ───────────────────────────────
    for (let i = 0; i < charLen; i++) {
        const rawCode    = jsCode.charCodeAt(i); // UTF-16 char code (0–65535)
        const encoded    = xorEncode(rawCode, i);
        const pixelIndex = i * 4; // 4 bytes per pixel in the data array

        data[pixelIndex]     = Math.floor(encoded / 256); // R: high byte (0–255)
        data[pixelIndex + 1] = encoded % 256;             // G: low byte  (0–255)
        data[pixelIndex + 2] = useKey ? (keyLen & 0xFF) : 0; // B: key length hint
        data[pixelIndex + 3] = 255;                       // A: fully opaque
    }

    // ── Write null sentinel pixel (marks end of encoded data) ────────────
    const sentinelIndex        = charLen * 4;
    data[sentinelIndex]        = 0;   // R: 0
    data[sentinelIndex + 1]    = 0;   // G: 0 → charCode (0*256 + 0) = 0 triggers stop
    data[sentinelIndex + 2]    = 0;   // B: 0
    data[sentinelIndex + 3]    = 255; // A: pixel is real, just null data

    // ── Fill remaining pixels with random noise (camouflage) ─────────────
    for (let i = (charLen + 1) * 4; i < data.length; i += 4) {
        data[i]     = Math.floor(Math.random() * 256);
        data[i + 1] = Math.floor(Math.random() * 256);
        data[i + 2] = Math.floor(Math.random() * 256);
        data[i + 3] = 255;
    }

    // Commit the pixel data to the canvas and export as lossless PNG
    ctx.putImageData(imageData, 0, 0);

    return {
        dataURL   : canvas.toDataURL('image/png'),
        width     : imgWidth,
        height    : imgHeight,
        charCount : charLen
    };
}

/**
 * Generates the companion JavaScript decoder script that, when included
 * on a web page alongside the carrier PNG, reconstructs and executes
 * the hidden JavaScript at runtime using the Canvas API.
 *
 * The decoder is intentionally compact (IIFE) to minimize footprint.
 * If a secret key was used during encoding, the same XOR logic is included.
 *
 * @param {string} imageSrc  - Relative or absolute path to the carrier PNG
 * @param {number} charCount - Number of characters encoded into the image
 * @param {string} secretKey - The same secret key used during encoding
 * @returns {string}         - The complete decoder JavaScript string
 */
function generateDecoderScript(imageSrc, charCount, secretKey) {
    const useKey   = secretKey && secretKey.length > 0;
    const keyParam = useKey ? `var _k="${secretKey}";` : '';
    const xorLogic = useKey
        ? `function _x(c,i){var k=_k.split("").map(function(ch){return ch.charCodeAt(0);});return c^k[i%k.length];}`
        : `function _x(c,i){return c;}`; // Identity function when no key is used

    return `/* =====================================================
 * JS Code Armor — Steganography Decoder Script
 * WARNING: Keep this file and the carrier image together.
 * Generated by: Trusted Tools Web (trustedtoolsweb.com)
 * ===================================================== */
(function(){
  ${keyParam}
  ${xorLogic}
  var _img = new Image();
  _img.crossOrigin = "anonymous";
  _img.src = "${imageSrc}";
  _img.onload = function(){
    var _c = document.createElement("canvas");
    _c.width = _img.width; _c.height = _img.height;
    var _ctx = _c.getContext("2d");
    _ctx.drawImage(_img, 0, 0);
    var _d = _ctx.getImageData(0, 0, _img.width, _img.height).data;
    var _s = ""; var _n = ${charCount};
    for(var i = 0; i < _n; i++){
      var p = i * 4;
      var code = (_d[p] * 256) + _d[p+1];
      if(code === 0) break;
      _s += String.fromCharCode(_x(code, i));
    }
    try { (new Function(_s))(); }
    catch(e){ console.error("[Decoder] Execution error:", e); }
  };
  _img.onerror = function(){ console.error("[Decoder] Failed to load carrier image."); };
})();`;
}


/* ============================================================================
   SECTION 8: MAIN OBFUSCATION PIPELINE
   The async orchestrator that drives the full protect workflow:
     Input validation → Obfuscation → Time-Bomb → Domain Lock →
     Output display → HTML wrap generation → Analysis → Steganography
============================================================================ */

/**
 * Main entry point for the obfuscation workflow.
 * Called by the "Obfuscate & Protect" button click handler.
 *
 * The pipeline is async to allow the UI (progress bar) to repaint between
 * each computationally heavy step using short await sleep() calls.
 */
async function runObfuscation() {

    // ── Step 1: Get & validate source code ────────────────────────────────
    const sourceCode = getInputCode().trim();

    if (!sourceCode || sourceCode.startsWith('//')) {
        window.showToast('Please paste your JavaScript code first.', false);
        return;
    }

    // ── Step 2: Ensure the obfuscator library loaded from CDN ─────────────
    if (typeof JavaScriptObfuscator === 'undefined') {
        window.showToast('Obfuscator library not loaded. Check your CDN connection.', true);
        return;
    }

    // ── Step 3: Show and reset the progress bar ────────────────────────────
    startProgress();
    setProgressStatus('Analyzing source code...', 10);

    try {
        // Yield to allow the browser to repaint the progress bar at 10%
        await sleep(80);

        // ── Step 4: Build the final obfuscator options from UI state ──────
        const options = buildObfuscatorOptions();
        setProgressStatus('Applying obfuscation engine...', 35);
        await sleep(60);

        // ── Step 5: Run javascript-obfuscator (core engine) ───────────────
        let obfuscatedResult;
        try {
            obfuscatedResult = JavaScriptObfuscator.obfuscate(sourceCode, options);
        } catch (obfErr) {
            // Provide a user-friendly error if the input is invalid JavaScript
            throw new Error(`Obfuscation failed: ${obfErr.message}. Ensure your input is valid JavaScript.`);
        }

        let finalCode = obfuscatedResult.getObfuscatedCode();
        setProgressStatus('Applying God Mode layers...', 60);
        await sleep(60);

        // ── Step 6: Time-Bomb injection (if enabled) ──────────────────────
        const timebombEnabled = document.getElementById('timebombEnabled').checked;
        if (timebombEnabled) {
            const expiryDateVal = document.getElementById('timebombDate').value;
            if (!expiryDateVal) {
                throw new Error('Please set an expiry date for the Time-Bomb feature.');
            }
            const expiryTs    = new Date(expiryDateVal).getTime();
            if (isNaN(expiryTs) || expiryTs <= Date.now()) {
                throw new Error('Expiry date must be set to a future date and time.');
            }
            const action      = document.getElementById('timebombAction').value;
            const redirectUrl = document.getElementById('timebombRedirect').value;

            finalCode = injectTimeBomb(finalCode, expiryTs, action, redirectUrl);
            setProgressStatus('Time-Bomb injected...', 72);
            await sleep(40);
        }

        // ── Step 7: Domain Lock injection (if a domain was specified) ──────
        const domainLock = document.getElementById('opt_domainLock').value.trim();
        if (domainLock) {
            finalCode = injectDomainLock(finalCode, domainLock);
        }

        setProgressStatus('Finalizing output...', 88);
        await sleep(40);

        // ── Step 8: Store the fully processed result globally ─────────────
        lastObfuscatedCode = finalCode;

        // ── Step 9: Push to the output editor (Monaco or fallback) ────────
        setOutputCode(finalCode);

        // ── Step 10: Generate the HTML <script> wrapper tab content ────────
        const wrapCode = `<script>\n${finalCode}\n<\/script>`;
        document.getElementById('outputWrapCode').value = wrapCode;

        // ── Step 11: Enable the copy and download action buttons ───────────
        document.getElementById('copyOutputBtn').disabled = false;
        document.getElementById('dlOutputBtn').disabled   = false;
        document.getElementById('copyWrapBtn').disabled   = false;

        setProgressStatus('Generating analysis report...', 94);
        await sleep(40);

        // ── Step 12: Build and render the analysis report ──────────────────
        generateAnalysisReport(sourceCode, finalCode, options);

        // ── Step 13: Steganography (if Ninja Mode is enabled) ──────────────
        const stegoEnabled = document.getElementById('stegoEnabled').checked;
        if (stegoEnabled) {
            setProgressStatus('Encoding in image pixels...', 97);
            await sleep(100);
            runSteganography(finalCode);
        }

        // ── Step 14: Complete the progress bar and notify the user ─────────
        setProgressStatus('✓ Protection complete!', 100);
        await sleep(600);

        completeProgress();
        window.showToast('Code protected successfully!');

        // Auto-switch to the Output tab to reveal the result
        setTab('output');

    } catch (err) {
        // ── Error recovery ─────────────────────────────────────────────────
        stopProgress();
        window.showToast(err.message, true);
        console.error('[JS Code Armor] Error during obfuscation pipeline:', err);
    }
}

/**
 * Builds the javascript-obfuscator options object from the current UI state.
 * Merges the active level preset's base options with live toggle overrides,
 * allowing users to customize individual settings within any preset.
 *
 * @returns {object} A complete options object for JavaScriptObfuscator.obfuscate()
 */
function buildObfuscatorOptions() {
    const preset = LEVEL_PRESETS[currentLevel] || LEVEL_PRESETS.medium;

    // Read each toggle's current live state from the DOM
    const controlFlow = document.getElementById('opt_controlFlow').checked;
    const stringEnc   = document.getElementById('opt_stringEnc').checked;
    const deadCode    = document.getElementById('opt_deadCode').checked;
    const antiDebug   = document.getElementById('opt_antiDebug').checked;
    const selfDefend  = document.getElementById('opt_selfDefend').checked;
    const renameId    = document.getElementById('opt_renameId').checked;

    return {
        ...preset.obfOpts,                       // Start with preset's base options
        // Override individual toggle values from live UI:
        controlFlowFlattening           : controlFlow,
        controlFlowFlatteningThreshold  : controlFlow ? preset.obfOpts.controlFlowFlatteningThreshold || 0.5 : 0,
        deadCodeInjection               : deadCode,
        debugProtection                 : antiDebug,
        selfDefending                   : selfDefend,
        stringArray                     : stringEnc,
        stringArrayEncoding             : stringEnc ? (preset.obfOpts.stringArrayEncoding || ['base64']) : [],
        renameIdentifiers               : renameId,
        sourceMap                       : false,  // Source maps disabled — client-side tool only
    };
}

/**
 * Injects a domain lock guard at the top of the given code.
 * The guard compares window.location.hostname against the authorized domain.
 * The domain string is split at its midpoint to resist trivial find/replace.
 *
 * @param {string} code   - The obfuscated JavaScript to wrap
 * @param {string} domain - The authorized hostname (e.g., "yourdomain.com")
 * @returns {string}      - Domain-locked wrapper around the original code
 */
function injectDomainLock(code, domain) {
    // Split the domain at its midpoint to obfuscate the literal string value
    const splitAt  = Math.floor(domain.length / 2);
    const domPart1 = domain.slice(0, splitAt);
    const domPart2 = domain.slice(splitAt);

    return `/* [Domain Lock Guard] — Authorized domain: ${domain} */
(function(){var _d=window.location.hostname;var _a="${domPart1}"+"${domPart2}";if(_d!==_a&&_d!=="www."+_a){return;}(function(){${code}})();}());`;
}


/* ============================================================================
   SECTION 9: STEGANOGRAPHY PIPELINE
   Orchestrates capacity checking, canvas encoding, decoder generation,
   and UI preview display for the Ninja Mode feature.
============================================================================ */

/**
 * Runs the steganography encoding pipeline on the final obfuscated code.
 * Auto-adjusts the image width if the code is too large to fit.
 * Updates the steganography preview area with the output image and decoder script.
 *
 * @param {string} finalCode - The fully processed obfuscated JavaScript string
 */
function runSteganography(finalCode) {
    const imgWidth  = parseInt(document.getElementById('stegoWidth').value) || 256;
    const secretKey = document.getElementById('stegoSecret').value.trim();

    // ── Capacity check: ensure the specified width can hold all characters ─
    const requiredPixels = finalCode.length + 1; // +1 for null sentinel
    const minWidth       = Math.ceil(Math.sqrt(requiredPixels));
    const effectiveWidth = Math.max(imgWidth, minWidth);

    // Notify user if width was auto-adjusted upwards
    if (effectiveWidth !== imgWidth) {
        window.showToast(`Image width auto-adjusted to ${effectiveWidth}px to fit the code.`);
        document.getElementById('stegoWidth').value = effectiveWidth;
    }

    // ── Encode the JS string into pixel data ──────────────────────────────
    const result     = encodeJsInImage(finalCode, effectiveWidth, secretKey);
    lastStegoDataURL = result.dataURL;

    // ── Generate the companion decoder script ─────────────────────────────
    // Note: user must replace 'carrier.png' with the actual hosted image path
    const decoderCode = generateDecoderScript('carrier.png', result.charCount, secretKey);

    // ── Update the preview area with image and decoder output ─────────────
    const previewArea = document.getElementById('stegoPreviewArea');
    const imgPreview  = document.getElementById('stegoImgPreview');
    const decoderOut  = document.getElementById('stegoDecoderOutput');

    imgPreview.src            = result.dataURL;
    decoderOut.value          = decoderCode;
    previewArea.style.display = 'block';

    window.showToast(`JS hidden in ${result.width}×${result.height}px image (${result.charCount} chars).`);
}

/**
 * Triggers a browser file download of the steganography carrier PNG.
 * Uses the base64 data URL stored in lastStegoDataURL after encoding.
 */
function downloadStegoImage() {
    if (!lastStegoDataURL) {
        window.showToast('No steganography image generated yet. Run obfuscation first.', true);
        return;
    }
    const link    = document.createElement('a');
    link.download = 'carrier.png';
    link.href     = lastStegoDataURL;
    link.click();
}


/* ============================================================================
   SECTION 10: ANALYSIS REPORT GENERATOR
   Computes original vs. obfuscated size metrics, a weighted protection score,
   and a list of active protection feature tags. Injects the HTML into the DOM.
============================================================================ */

/**
 * Builds and renders the analysis report in the Analysis tab.
 * Injects the metric grid, score bar, and active feature tags directly
 * into the #analysisReport container element.
 *
 * @param {string} original   - The original source JavaScript string
 * @param {string} obfuscated - The final obfuscated JavaScript string
 * @param {object} options    - The obfuscator options object that was used
 */
function generateAnalysisReport(original, obfuscated, options) {
    const origSize  = new Blob([original]).size;
    const obfSize   = new Blob([obfuscated]).size;
    const sizeRatio = ((obfSize / origSize) * 100).toFixed(0);
    const scoreVal  = calculateProtectionScore(options);

    // ── Build active protection feature tags ──────────────────────────────
    const tags = [];
    if (options.controlFlowFlattening)  tags.push({ label: 'Control Flow Flattening', cls: 'cyan'   });
    if (options.stringArray)            tags.push({ label: 'String Encryption',        cls: ''       });
    if (options.deadCodeInjection)      tags.push({ label: 'Dead Code Injection',      cls: 'cyan'   });
    if (options.debugProtection)        tags.push({ label: 'Anti-Debugging',           cls: 'danger' });
    if (options.selfDefending)          tags.push({ label: 'Self-Defending',           cls: 'danger' });
    if (options.renameIdentifiers)      tags.push({ label: 'Identifier Renaming',      cls: ''       });
    if (document.getElementById('opt_domainLock').value.trim())
                                        tags.push({ label: 'Domain Lock',              cls: 'cyan'   });
    if (document.getElementById('timebombEnabled').checked)
                                        tags.push({ label: '💣 Time-Bomb',             cls: 'danger' });
    if (document.getElementById('stegoEnabled').checked)
                                        tags.push({ label: '🥷 Steganography',         cls: 'purple' });
    if (currentLevel === 'god')         tags.push({ label: '⚡ God Mode',              cls: 'gold'   });

    // Map tags to badge HTML using the reusable .analysis-tag component
    const tagHTML = tags.map(t =>
        `<span class="analysis-tag ${t.cls}">${t.label}</span>`
    ).join('');

    // Inject the complete analysis report HTML into the Analysis tab
    document.getElementById('analysisReport').innerHTML = `
        <div class="analysis-grid">
            <div class="analysis-metric">
                <div class="metric-value">${formatBytes(origSize)}</div>
                <div class="metric-label">Original Size</div>
            </div>
            <div class="analysis-metric">
                <div class="metric-value">${formatBytes(obfSize)}</div>
                <div class="metric-label">Protected Size</div>
            </div>
            <div class="analysis-metric">
                <div class="metric-value">${sizeRatio}%</div>
                <div class="metric-label">Size Ratio</div>
            </div>
            <div class="analysis-metric">
                <div class="metric-value">${original.split('\n').length}</div>
                <div class="metric-label">Source Lines</div>
            </div>
        </div>

        <div class="protection-score-label">
            Protection Score: <strong style="color:var(--brand-primary);">${scoreVal}/100</strong>
        </div>
        <div class="protection-score-bar">
            <div class="protection-score-fill" style="width:0%;" id="scoreBarFill"></div>
        </div>

        <div class="protection-score-label" style="margin-top:16px;">Active Protections</div>
        <div class="analysis-tags">
            ${tagHTML || '<span style="color:var(--text-muted);font-size:12px;">No protections active.</span>'}
        </div>
    `;

    // Animate the score bar fill using a double rAF (ensures CSS transition fires)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const fill = document.getElementById('scoreBarFill');
            if (fill) fill.style.width = scoreVal + '%';
        });
    });
}

/**
 * Calculates a weighted numeric protection score from 0 to 100
 * based on which obfuscation options are currently active.
 *
 * Score breakdown:
 *   Identifier Renaming    : 15 pts
 *   String Array (Enc)     : 15 pts
 *   Control Flow Flattening: 20 pts
 *   Dead Code Injection    : 10 pts
 *   Debug Protection       : 15 pts
 *   Self-Defending         :  10 pts
 *   Domain Lock            :   5 pts
 *   Time-Bomb              :   5 pts
 *   Steganography          :   5 pts
 *   Total max              : 100 pts
 *
 * @param {object} options - The obfuscator options object
 * @returns {number}       - Score clamped to [0, 100]
 */
function calculateProtectionScore(options) {
    let score = 0;
    if (options.renameIdentifiers)          score += 15;
    if (options.stringArray)                score += 15;
    if (options.controlFlowFlattening)      score += 20;
    if (options.deadCodeInjection)          score += 10;
    if (options.debugProtection)            score += 15;
    if (options.selfDefending)              score += 10;
    if (document.getElementById('opt_domainLock').value.trim()) score += 5;
    if (document.getElementById('timebombEnabled').checked)     score += 5;
    if (document.getElementById('stegoEnabled').checked)        score += 5;
    return Math.min(score, 100);
}

/**
 * Formats a byte count into a human-readable string with appropriate unit.
 * Supports B, KB, and MB ranges.
 *
 * @param {number} bytes - Raw byte count
 * @returns {string}     - Formatted string (e.g., "12.3 KB", "1.50 MB")
 */
function formatBytes(bytes) {
    if (bytes < 1024)    return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}


/* ============================================================================
   SECTION 11: PROGRESS BAR HELPERS
   Controls the visual progress bar shown during the obfuscation pipeline.
============================================================================ */

/**
 * Shows the progress wrapper, resets the fill to 0%, and disables the
 * Obfuscate button to prevent concurrent execution.
 */
function startProgress() {
    const wrap = document.getElementById('progressWrap');
    const fill = document.getElementById('progressFill');
    wrap.style.display = 'block';
    fill.style.width   = '0%';
    fill.classList.add('shimmer'); // Animated shimmer while processing
    document.getElementById('obfuscateBtn').disabled = true;
}

/**
 * Updates the progress bar fill width and the status text label
 * to reflect the current pipeline stage.
 *
 * @param {string} message - Human-readable stage description
 * @param {number} pct     - Progress percentage (0–100)
 */
function setProgressStatus(message, pct) {
    document.getElementById('progressStatus').textContent = message;
    document.getElementById('progressFill').style.width  = pct + '%';
}

/**
 * Completes the progress animation: removes shimmer, fills to 100%,
 * then hides the progress wrapper and re-enables the button after 1 second.
 */
function completeProgress() {
    const fill = document.getElementById('progressFill');
    fill.classList.remove('shimmer');
    fill.style.width = '100%';
    setTimeout(() => {
        document.getElementById('progressWrap').style.display = 'none';
        document.getElementById('obfuscateBtn').disabled      = false;
    }, 1000);
}

/**
 * Immediately stops and hides the progress bar on error.
 * Re-enables the Obfuscate button so the user can try again.
 */
function stopProgress() {
    document.getElementById('progressWrap').style.display = 'none';
    document.getElementById('progressFill').style.width   = '0%';
    document.getElementById('obfuscateBtn').disabled      = false;
}


/* ============================================================================
   SECTION 12: TAB NAVIGATION
   Switches between the Output, Analysis, and HTML Wrap preview tabs.
============================================================================ */

/**
 * Activates the specified preview tab and deactivates all others.
 * Updates both the content panel visibility (.active class) and
 * the tab button highlight (.active class).
 *
 * @param {'output'|'analysis'|'wrap'} tabKey - The tab to switch to
 */
function setTab(tabKey) {
    // Hide all three content panels
    document.querySelectorAll('.jca-preview-content').forEach(el => {
        el.classList.remove('active');
    });

    // Deactivate all tab bar buttons
    document.querySelectorAll('.jca-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activate the selected content panel
    const panel = document.getElementById(`view-${tabKey}`);
    if (panel) panel.classList.add('active');

    // Highlight the corresponding tab button
    const btn = document.querySelector(`.jca-tab-btn[data-mode="${tabKey}"]`);
    if (btn) btn.classList.add('active');
}


/* ============================================================================
   SECTION 13: RESET
   Resets the entire tool back to its default empty state.
============================================================================ */

/**
 * Resets all tool state to defaults:
 *   - Clears both input and output editors
 *   - Resets toggles to the medium (Balanced) preset
 *   - Hides God Mode panel and feature configs
 *   - Resets progress bar, output buttons, and analysis report
 *   - Hides the steganography preview area
 *   - Switches back to the Output tab
 */
function resetAll() {

    // ── Clear editors ─────────────────────────────────────────────────────
    if (monacoReady && monacoInput) {
        monacoInput.setValue('');
    } else {
        document.getElementById('fallbackEditor').value = '';
    }

    setOutputCode('// Protected code will appear here...');
    document.getElementById('outputWrapCode').value = '';

    // ── Reset toggles and level to the medium (Balanced) default ─────────
    setLevel('medium');

    // ── Clear the domain lock input field ─────────────────────────────────
    document.getElementById('opt_domainLock').value = '';

    // ── Collapse the God Mode panel and reset all feature toggles ─────────
    document.getElementById('godModeToggle').checked   = false;
    document.getElementById('timebombEnabled').checked = false;
    document.getElementById('stegoEnabled').checked    = false;
    toggleGodMode(false);
    toggleFeatureUI('timebomb', false);
    toggleFeatureUI('stego', false);

    // ── Reset progress bar display ─────────────────────────────────────────
    stopProgress();

    // ── Disable output action buttons ──────────────────────────────────────
    document.getElementById('copyOutputBtn').disabled = true;
    document.getElementById('dlOutputBtn').disabled   = true;
    document.getElementById('copyWrapBtn').disabled   = true;

    // ── Reset the analysis report to its empty state ───────────────────────
    document.getElementById('analysisReport').innerHTML = `
        <div class="jca-analysis-empty">
            <i class="fa-solid fa-chart-bar" style="font-size: 40px; opacity:0.2;"></i>
            <p>Run obfuscation to see the analysis</p>
        </div>`;

    // ── Hide the steganography preview area ────────────────────────────────
    document.getElementById('stegoPreviewArea').style.display = 'none';

    // ── Clear global result state ──────────────────────────────────────────
    lastObfuscatedCode = '';
    lastStegoDataURL   = '';

    // ── Show the output empty state ────────────────────────────────────────
    document.getElementById('outputEmptyState').style.display = 'flex';

    // ── Return to the Output tab ───────────────────────────────────────────
    setTab('output');

    window.showToast('Reset complete. All data cleared.');
}


/* ============================================================================
   SECTION 14: COPY & DOWNLOAD HELPERS
   Clipboard copy abstraction and .js file download trigger.
============================================================================ */

/**
 * Copies the content of a specified element to the clipboard.
 * Handles three source types:
 *   - Monaco output editor (via .getValue())
 *   - <textarea> elements (via .value)
 *   - Other elements (via .textContent)
 * Falls back to document.execCommand('copy') on browsers without Clipboard API.
 *
 * @param {string} elementId - The ID of the element whose content to copy
 */
function copyCode(elementId) {
    let textToCopy = '';

    // Special case: the obfuscated output uses the Monaco editor
    if (elementId === 'outputCode' && monacoReady && monacoOutput) {
        textToCopy = monacoOutput.getValue();
    } else {
        const el = document.getElementById(elementId);
        if (!el) return;
        textToCopy = el.value || el.textContent || '';
    }

    if (!textToCopy.trim()) {
        window.showToast('Nothing to copy.', false);
        return;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        window.showToast('Copied to clipboard!');
    }).catch(() => {
        // Fallback for older browsers: create a temporary textarea and execCommand
        const temp = document.createElement('textarea');
        temp.value = textToCopy;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        window.showToast('Copied!');
    });
}

/**
 * Triggers a browser download of the obfuscated JavaScript as a .js file.
 * Uses the globally stored lastObfuscatedCode or reads from Monaco / textarea.
 * Creates a temporary Blob URL, triggers the download, and revokes the URL.
 */
function downloadJS() {
    const code = lastObfuscatedCode ||
                 (monacoReady && monacoOutput ? monacoOutput.getValue() : document.getElementById('outputCode').value);

    if (!code || code.startsWith('//')) {
        window.showToast('No protected code to download. Run obfuscation first.', true);
        return;
    }

    const blob  = new Blob([code], { type: 'text/javascript' });
    const url   = URL.createObjectURL(blob);
    const link  = document.createElement('a');
    link.href     = url;
    link.download = 'protected.min.js';
    link.click();
    URL.revokeObjectURL(url); // Clean up the temporary object URL
    window.showToast('Downloaded protected.min.js');
}


/* ============================================================================
   SECTION 15: UTILITY FUNCTIONS
============================================================================ */

/**
 * Promise-based sleep helper that resolves after a given number of milliseconds.
 * Used throughout the async pipeline to yield to the browser's rendering engine,
 * allowing the progress bar UI to repaint between heavy processing steps.
 *
 * @param {number} ms - Duration to wait in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/* ============================================================================
   SECTION 16: THEME SYNC
   Observes document.body class changes to keep the Monaco editor
   theme in sync with the global site dark/light mode toggle.
============================================================================ */

/**
 * MutationObserver that watches for class changes on <body>.
 * When the global theme is toggled (light-mode class added/removed),
 * Monaco's theme is updated via monaco.editor.setTheme().
 */
const themeObserver = new MutationObserver(() => {
    if (!monacoReady) return;
    const theme = getMonacoTheme();
    monaco.editor.setTheme(theme);
});

// Observe only the 'class' attribute on <body>
themeObserver.observe(document.body, {
    attributes     : true,
    attributeFilter: ['class']
});


/* ============================================================================
   SECTION 17: INITIALIZATION ON DOM READY
   Runs once the DOM is fully parsed — applies the default level preset
   and logs tool info to the browser console.
============================================================================ */

document.addEventListener('DOMContentLoaded', function () {

    // ── Apply the default Balanced (medium) preset to all UI toggles ──────
    setLevel('medium');

    // ── Developer console branding ─────────────────────────────────────────
    console.log(
        '%c[JS Code Armor] Trusted Tools Web — JavaScript Obfuscator & Code Protector',
        'color: #00ff88; font-weight: bold; font-size: 13px;'
    );
    console.log(
        '%cAll processing is 100% client-side. Your code never leaves your browser.',
        'color: #00e5ff; font-size: 11px;'
    );
});
