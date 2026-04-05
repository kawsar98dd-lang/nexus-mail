/**
 * ============================================================================
 * TextPro Max Studio — Engine v6.0 (Titanium Release)
 * Developed exclusively for Trusted Tools Web (CodeCanyon Release Build)
 *
 * Author  : MD KAWSAR
 * License : Commercial (Standard / Extended)
 * Version : 6.0 — Titanium
 *
 * Architecture  : Immediately Invoked Function Expression (IIFE) Module pattern.
 *                 All private state and helpers are encapsulated inside the IIFE.
 *                 Only the required public API methods are exposed via the
 *                 returned object, keeping the global scope clean.
 *
 * Dependencies  : global.js (provides window.showToast), FontAwesome, LocalStorage.
 * Toast System  : Uses the site-wide global toast (window.showToast) injected by
 *                 global.js. Error toasts pass boolean `true` as the second argument.
 * ============================================================================
 */

"use strict";

const TextProCore = (function() {

    /* ────────────────────────────────────────────────────────────────────────
     * CONFIGURATION
     * Replace UNSPLASH_ACCESS_KEY with your own key from unsplash.com/developers.
     * Demo mode allows 50 API requests/hour. Apply for Production for more.
     * ──────────────────────────────────────────────────────────────────────── */
    const UNSPLASH_ACCESS_KEY = 'ClOtPIiVrb1Khjkvo4Ct4cSvkSic-BjscVor72HFwL8';


    /* ────────────────────────────────────────────────────────────────────────
     * UNICODE ALPHABET MAPS
     * Each key maps the 62 standard alphanumeric characters (a-z A-Z 0-9) to
     * their Unicode styled equivalents. Used by renderFonts() to generate
     * Fancy Font variations that can be pasted anywhere Unicode is supported.
     * ──────────────────────────────────────────────────────────────────────── */
    const ALPHABETS = {
        'serif_bold': "𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗",
        'sans_bold':  "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵",
        'script':     "𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵0123456789",
        'fraktur':    "𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ0123456789",
        'double':     "𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡",
        'mono':       "𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿",
        'circled':    "ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ0123456789"
    };

    /**
     * Standard ASCII reference string (a-z A-Z 0-9).
     * Used as the character index source when mapping to ALPHABETS entries.
     * @constant {string}
     */
    const STANDARD = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    /* ────────────────────────────────────────────────────────────────────────
     * ASCII BLOCK ART MAP
     * Maps each lowercase letter (and a few symbols) to a 3-line pixel art
     * string using block characters (▄ ▀ █ etc.). Used by renderBigText().
     * ──────────────────────────────────────────────────────────────────────── */
    const BIG_MAP = {
        'a': " ▄▀▄ \n█▀▀█\n█  █", 'b': "█▀▄ \n█▀▄ \n█▀▀ ", 'c': "█▀▀ \n█   \n█▄▄ ", 'd': "█▀▄ \n█ █ \n█▄▀ ",
        'e': "█▀▀ \n█▀▀ \n█▄▄ ", 'f': "█▀▀ \n█▀▀ \n█   ", 'g': "█▀▀ \n█ ▀▄\n█▄▄█", 'h': "█  █\n█▀▀█\n█  █",
        'i': " █ \n █ \n █ ", 'j': "   █\n   █\n█▄▄█", 'k': "█ ▄▀\n█▀▄ \n█ ▀▄", 'l': "█   \n█   \n█▄▄ ",
        'm': "█▀▄▀█\n█ █ █\n█   █", 'n': "█▀▄█\n█ █ \n█  ▀█", 'o': "█▀▀█\n█  █\n█▄▄█", 'p': "█▀▀█\n█▀▀ \n█   ",
        'q': "█▀▀█\n█  █\n▀▀▄▀", 'r': "█▀▀█\n█▀▀▄\n█  █", 's': "█▀▀ \n▀▀▄ \n▄▄▀ ", 't': "▀█▀\n █ \n █ ",
        'u': "█  █\n█  █\n▀▄▄▀", 'v': "█  █\n▀▄▄▀\n ▀▀ ", 'w': "█   █\n█ █ █\n▀▄▀▄▀", 'x': "▀▄▄▀\n ▀▀ \n▄▀▀▄",
        'y': "█  █\n▀▄▄▀\n  █ ", 'z': "▀▀█\n▄▀ \n█▄▄", '0': "█▀▀█\n█  █\n█▄▄█", '.': "   \n   \n █ ", ' ': "   \n   \n   "
    };

    /* ────────────────────────────────────────────────────────────────────────
     * MORSE CODE MAP
     * International Morse Code table mapping each alphanumeric character to
     * its dot-dash representation. Space maps to the word separator ' / '.
     * ──────────────────────────────────────────────────────────────────────── */
    const MORSE_CODE = {
        'a': '.-',   'b': '-...', 'c': '-.-.', 'd': '-..',  'e': '.',    'f': '..-.',
        'g': '--.',  'h': '....', 'i': '..',   'j': '.---', 'k': '-.-',  'l': '.-..',
        'm': '--',   'n': '-.',   'o': '---',  'p': '.--.',  'q': '--.-', 'r': '.-.',
        's': '...',  't': '-',   'u': '..-',  'v': '...-', 'w': '.--',  'x': '-..-',
        'y': '-.--', 'z': '--..',
        '1': '.----','2': '..---','3': '...--','4': '....-','5': '.....',
        '6': '-....','7': '--...','8': '---..','9': '----.','0': '-----',
        ' ': ' / '
    };

    /* ────────────────────────────────────────────────────────────────────────
     * DECORATION TEMPLATES & SYMBOL PALETTE
     * DECORS: Text decoration frames. 'x' is replaced with the user's text.
     * SYMBOLS: Full palette string rendered in the Symbol Picker modal grid.
     * ──────────────────────────────────────────────────────────────────────── */
    const DECORS  = [
        "★彡[ x ]彡★",
        "꧁ x ꧂",
        "•´¯`•. x .•´¯`•",
        "×º°\"˜`\"°º× x ×º°\"˜`\"°º×",
        "▌│█║▌║▌║ x ║▌║▌║█│▌",
        "(っ◔◡◔)っ ♥ x ♥"
    ];
    const SYMBOLS = "★☆✦✧✪✔✘❤♡♥❥🔥💀☠☺☹☻☀☁☂☃❄⚡❝❞➤➥➦➮➢➣➠➟➨➔➙➛➜➝➞➟➡➢➣➤➧➸➹➳➵➶➷➸➹➺➻➼➽←↑→↓↔↕↖↗↘↙↺↻∆∇∞≈≠≤≥±";


    /* ────────────────────────────────────────────────────────────────────────
     * DOM ELEMENT CACHE
     * Populated once in init() to avoid repeated document.getElementById calls
     * on every render cycle, improving performance.
     * ──────────────────────────────────────────────────────────────────────── */
    const els = {
        input         : null,   // Main textarea (#input)
        counts        : null,   // Char/word counter (#counts)
        fontGrid      : null,   // Fancy fonts output grid (#fontGrid)
        decorGrid     : null,   // Decorations output grid (#decorGrid)
        coderGrid     : null,   // Coder output grid (#coderGrid)
        bigTextOutput : null,   // ASCII block art output (#bigTextOutput)
        glitchOutput  : null,   // Zalgo/glitch text output (#glitchOutput)
        morseOutput   : null,   // Morse code output (#morseOutput)
        draftList     : null,   // Sidebar draft list container (#draftList)
        fileInput     : null,   // Hidden file input (#fileInput)
        exportCanvas  : null    // Canvas for image export (#exportCanvas)
    };


    /* ────────────────────────────────────────────────────────────────────────
     * STATE VARIABLES
     * drafts         — Array of draft objects stored in localStorage.
     * currentDraftId — Numeric ID of the currently loaded draft.
     * historyStack   — Array of textarea value snapshots for undo/redo.
     * historyIndex   — Pointer into historyStack for current position.
     * debounceTimer  — Timer reference used to debounce input rendering.
     * uploadedBg     — HTMLImageElement used as canvas background (Image Studio).
     * ──────────────────────────────────────────────────────────────────────── */
    let drafts        = [];
    let currentDraftId = null;
    let historyStack  = [];
    let historyIndex  = -1;
    let debounceTimer = null;
    let uploadedBg    = null;


    /* ============================================================
     * INIT
     * Bootstraps the application on DOMContentLoaded:
     *   1. Caches all required DOM elements.
     *   2. Loads saved drafts from localStorage (or creates one).
     *   3. Attaches the main textarea input event listener.
     *   4. Renders the symbol picker grid.
     * ============================================================ */
    function init() {

        /* -- Cache DOM elements for reuse throughout the engine -- */
        els.input         = document.getElementById('input');
        els.counts        = document.getElementById('counts');
        els.fontGrid      = document.getElementById('fontGrid');
        els.decorGrid     = document.getElementById('decorGrid');
        els.coderGrid     = document.getElementById('coderGrid');
        els.bigTextOutput = document.getElementById('bigTextOutput');
        els.glitchOutput  = document.getElementById('glitchOutput');
        els.morseOutput   = document.getElementById('morseOutput');
        els.draftList     = document.getElementById('draftList');
        els.fileInput     = document.getElementById('fileInput');
        els.exportCanvas  = document.getElementById('exportCanvas');

        /* -- Load drafts from localStorage (graceful fallback on parse error) -- */
        try {
            drafts = JSON.parse(localStorage.getItem('textPro_drafts')) || [];
        } catch (e) {
            drafts = [];
        }

        /* -- If no drafts exist, seed with a blank default draft -- */
        if (drafts.length === 0) {
            drafts = [{
                id      : Date.now(),
                name    : 'Untitled Note',
                content : '',
                date    : new Date().toLocaleTimeString()
            }];
        }

        /* -- Load the first available draft into the editor -- */
        loadDraft(drafts[0].id);

        /* -- Bind the main textarea input event to the debounced handler -- */
        els.input.addEventListener('input', handleInput);

        /* -- Populate the symbol picker grid -- */
        renderSymbols();

        console.log("TextPro Engine v6.0 Initialized [Secure Mode]");
    }


    /* ============================================================
     * handleInput
     * Fired on every keystroke in the main textarea.
     * Updates the character/word counter immediately (synchronous),
     * then debounces the heavier render operations by 300 ms to
     * avoid UI jank during fast typing.
     * ============================================================ */
    function handleInput() {
        updateCountsOnly();

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {

            /* -- Auto-save current content to active draft -- */
            const draft = drafts.find(d => d.id === currentDraftId);
            if (draft) {
                draft.content = els.input.value;
                // Use the first 15 chars of the first line as the draft name
                const line = els.input.value.split('\n')[0].substring(0, 15);
                draft.name = line.trim() || `Note ${drafts.indexOf(draft) + 1}`;
                saveDrafts();
                renderDraftList();
            }

            saveHistory();
            renderAllHeavy();
        }, 300);
    }


    /* ============================================================
     * triggerUpdate
     * Synchronously updates counts, saves to history, and
     * re-renders all transformation engines.
     * Called after programmatic text modifications (utility chips,
     * find/replace, undo/redo, symbol insertion).
     * ============================================================ */
    function triggerUpdate() {
        updateCountsOnly();
        saveHistory();
        renderAllHeavy();
    }


    /* ============================================================
     * updateCountsOnly
     * Updates only the character and word count display.
     * Intentionally lightweight — called on every keystroke
     * without triggering the heavier render engines.
     * ============================================================ */
    function updateCountsOnly() {
        const text  = els.input.value;
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        els.counts.innerText = `${text.length} CHARS / ${words} WORDS`;
    }


    /* ============================================================
     * renderAllHeavy
     * Master render dispatcher — calls all six transformation
     * engines in sequence after the debounce delay expires.
     * ============================================================ */
    function renderAllHeavy() {
        const text = els.input.value;
        renderFonts(text);
        renderDecor(text);
        renderCoder(text);
        renderBigText(text);
        renderGlitch();
        renderMorse(text);
    }


    /* ============================================================
     * renderFonts
     * Generates Unicode fancy-font variations of the input text.
     * Iterates over all ALPHABETS entries and maps each character
     * to its Unicode equivalent using STANDARD as the index key.
     * Uses a DocumentFragment for efficient batch DOM insertion.
     *
     * @param {string} text — The raw input text.
     * ============================================================ */
    function renderFonts(text) {
        const t    = text || "Preview";
        const frag = document.createDocumentFragment();

        for (const [key, map] of Object.entries(ALPHABETS)) {
            let res    = "";
            const mapArr = Array.from(map);

            for (let char of t) {
                const idx = STANDARD.indexOf(char);
                // Replace character if found in map; otherwise keep as-is
                res += (idx !== -1 && mapArr[idx]) ? mapArr[idx] : char;
            }

            frag.appendChild(createCardElement(key.replace(/_/g, " "), res));
        }

        // Single DOM write (minimises reflows)
        els.fontGrid.innerHTML = '';
        els.fontGrid.appendChild(frag);
    }


    /* ============================================================
     * renderDecor
     * Applies decoration frame templates to the input text.
     * Each DECORS template contains 'x' as a placeholder which
     * is replaced with the user's actual input.
     *
     * @param {string} text — The raw input text.
     * ============================================================ */
    function renderDecor(text) {
        const t    = text || "TEXT";
        const frag = document.createDocumentFragment();

        DECORS.forEach(d =>
            frag.appendChild(createCardElement("Decoration", d.replace('x', t)))
        );

        els.decorGrid.innerHTML = '';
        els.decorGrid.appendChild(frag);
    }


    /* ============================================================
     * renderBigText
     * Converts input text into 3-line ASCII block art using
     * the BIG_MAP character dictionary.
     * Each character contributes three horizontal "slices" which
     * are concatenated across all characters before being joined
     * into the final multi-line string.
     *
     * @param {string} text — The raw input text.
     * ============================================================ */
    function renderBigText(text) {
        const t     = (text || "123").toLowerCase();
        let   lines = ["", "", ""];

        for (let char of t) {
            // Fallback to space art if character not in map
            let map   = BIG_MAP[char] || BIG_MAP[' '] || "   \n   \n   ";
            const parts = map.split('\n');
            lines[0] += (parts[0] || "   ") + "  ";
            lines[1] += (parts[1] || "   ") + "  ";
            lines[2] += (parts[2] || "   ") + "  ";
        }

        els.bigTextOutput.textContent = lines.join('\n');
    }


    /* ============================================================
     * renderGlitch
     * Produces Zalgo / glitch text by inserting random Unicode
     * combining diacritical mark characters above, at mid-level,
     * and below each base character.
     * Intensity is controlled by the #g-amt range slider (1–100).
     * ============================================================ */
    function renderGlitch() {
        const t   = els.input.value || "Glitch";
        const amt = parseInt(document.getElementById('g-amt').value);

        // Diacritical mark sets for glitch layers
        const zUp   = ['\u030d','\u030e','\u0304','\u0305','\u033f','\u0311','\u0306','\u0310'];
        const zMid  = ['\u0315','\u031b','\u0488','\u0489','\u0350','\u0357','\u0351'];
        const zDown = ['\u0316','\u0317','\u0318','\u0319','\u031c','\u031d','\u031e','\u031f'];

        let res = "";

        for (let c of t) {
            res += c;

            // Only glitch standard alphanumeric characters and spaces
            if (STANDARD.includes(c) || c === ' ') {
                const count = Math.floor((amt / 100) * 5); // Optimised chaos level

                for (let i = 0; i < count; i++) {
                    if (Math.random() > 0.5) res += zUp[Math.floor(Math.random() * zUp.length)];
                    if (Math.random() > 0.7) res += zMid[Math.floor(Math.random() * zMid.length)];
                    if (Math.random() > 0.5) res += zDown[Math.floor(Math.random() * zDown.length)];
                }
            }
        }

        els.glitchOutput.textContent = res;
    }


    /* ============================================================
     * renderRepeater
     * Generates repeated text output based on the Repeater panel
     * settings: custom text override, count (1–10,000), and
     * separator mode (newline, space, comma, pipe, none).
     * Uses Array.fill + join for O(1) allocation efficiency.
     * ============================================================ */
    function renderRepeater() {
        const custom = document.getElementById('repText').value;
        const t      = custom || els.input.value;

        // Guard: require non-empty text
        if (!t) {
            window.showToast("Please enter text first!", true);
            return;
        }

        // Enforce maximum repeat count of 10,000
        let c = parseInt(document.getElementById('repCount').value) || 10;
        if (c > 10000) {
            c = 10000;
            document.getElementById('repCount').value = 10000;
            window.showToast("Max limit: 10,000 repetitions");
        }

        // Resolve separator: 'newline' mode converts to actual '\n'
        const sepMode = document.getElementById('repSeparator').value;
        const sep     = (sepMode === 'newline') ? '\n' : sepMode;

        // Efficient O(1) allocation: fill array then join with separator
        const result = new Array(c).fill(t).join(sep);

        const out        = document.getElementById('repOutput');
        out.textContent  = result;
        out.style.whiteSpace = "pre-wrap";

        window.showToast(`Generated ${c} times!`);
    }


    /* ============================================================
     * renderMorse
     * Translates input text to International Morse Code.
     * Unmapped characters are passed through unchanged.
     *
     * @param {string} text — The raw input text.
     * ============================================================ */
    function renderMorse(text) {
        const t = (text || "SOS").toLowerCase();
        let res = "";

        for (let char of t) {
            res += (MORSE_CODE[char] || char) + " ";
        }

        els.morseOutput.textContent = res;
    }


    /* ============================================================
     * renderCoder
     * Produces encoding/formatting transformations of the input text:
     *   Binary     — 8-bit binary representation per character.
     *   Hexadecimal — Hex charCode per character.
     *   URL Encoded — encodeURIComponent output.
     *   JSON Beautify — Pretty-printed JSON (only when input is valid JSON).
     * Uses a DocumentFragment for batch DOM insertion.
     *
     * @param {string} text — The raw input text.
     * ============================================================ */
    function renderCoder(text) {
        const t    = text || "Code";
        const frag = document.createDocumentFragment();

        // Binary: 8-bit padded per character, separated by spaces
        const bin = t.split('').map(c =>
            c.charCodeAt(0).toString(2).padStart(8, '0')
        ).join(' ');
        frag.appendChild(createCardElement("Binary", bin));

        // Hexadecimal: lowercase hex per character
        const hex = t.split('').map(c =>
            c.charCodeAt(0).toString(16)
        ).join(' ');
        frag.appendChild(createCardElement("Hexadecimal", hex));

        // URL Encoded: uses native encodeURIComponent
        frag.appendChild(createCardElement("URL Encoded", encodeURIComponent(t)));

        // JSON Beautify: only if input starts with { or [
        if (t.trim().startsWith('{') || t.trim().startsWith('[')) {
            try {
                const json = JSON.stringify(JSON.parse(t), null, 2);
                frag.appendChild(createCardElement("JSON Beautify", json));
            } catch (e) {
                // Silently skip if JSON is malformed
            }
        }

        // Single DOM write
        els.coderGrid.innerHTML = '';
        els.coderGrid.appendChild(frag);
    }


    /* ============================================================
     * DRAFT & HISTORY SYSTEM
     * ============================================================ */

    /**
     * renderDraftList
     * Re-renders the sidebar draft list from the in-memory drafts array.
     * The currently active draft receives the .active highlight class.
     * Each item exposes a delete icon (trash) when more than one draft exists.
     */
    function renderDraftList() {
        els.draftList.innerHTML = drafts.map(d => `
            <div class="tpm-draft-item ${d.id === currentDraftId ? 'active' : ''}"
                 onclick="TextProCore.loadDraft(${d.id})">
                <div style="flex:1; overflow:hidden;">
                    <h4>${escapeHTML(d.name)}</h4>
                    <span>${d.date}</span>
                </div>
                ${drafts.length > 1
                    ? `<div onclick="TextProCore.deleteDraft(event, ${d.id})"
                            style="color:#ff4757; padding:5px; cursor:pointer;">
                            <i class="fa-solid fa-trash"></i>
                       </div>`
                    : ''}
            </div>
        `).join('');
    }

    /**
     * loadDraft
     * Loads a specific draft by ID into the textarea.
     * Resets the undo/redo history stack to the loaded content.
     *
     * @param {number} id — Draft ID to load.
     */
    function loadDraft(id) {
        currentDraftId = id;
        const draft    = drafts.find(d => d.id === id);

        if (draft) {
            els.input.value = draft.content;
            historyStack    = [draft.content];
            historyIndex    = 0;
            renderDraftList();
            updateCountsOnly();
            renderAllHeavy();
        }
    }

    /**
     * createNewDraft
     * Creates a new blank draft, prepends it to the list, saves to
     * localStorage, loads it immediately, and closes the sidebar.
     */
    function createNewDraft() {
        const newDraft = {
            id      : Date.now(),
            name    : `Note ${drafts.length + 1}`,
            content : '',
            date    : new Date().toLocaleTimeString()
        };
        drafts.unshift(newDraft);
        saveDrafts();
        loadDraft(newDraft.id);
        toggleSidebar();
        window.showToast("New Draft Created");
    }

    /**
     * deleteDraft
     * Deletes a draft by ID after user confirmation.
     * If the deleted draft was active, switches to the first remaining draft.
     * If no drafts remain, creates a fresh blank draft automatically.
     *
     * @param {Event}  e  — Click event (used to stop propagation).
     * @param {number} id — ID of the draft to delete.
     */
    function deleteDraft(e, id) {
        e.stopPropagation();

        if (confirm("Delete this draft?")) {
            drafts = drafts.filter(d => d.id !== id);

            if (drafts.length === 0) {
                // Auto-create a fresh draft if the list is now empty
                createNewDraft();
            } else if (currentDraftId === id) {
                // Switch to the first remaining draft
                loadDraft(drafts[0].id);
            } else {
                // Just persist and refresh the list
                saveDrafts();
                renderDraftList();
            }
        }
    }

    /**
     * saveDrafts
     * Serialises the drafts array to localStorage.
     * Called after any create, update, or delete operation.
     */
    function saveDrafts() {
        localStorage.setItem('textPro_drafts', JSON.stringify(drafts));
    }

    /**
     * saveHistory
     * Pushes the current textarea value onto the undo/redo history stack.
     * Truncates any "future" states after the current index on new input.
     * Caps history at 50 entries to bound memory usage.
     */
    function saveHistory() {
        const val = els.input.value;

        // Skip if value is unchanged from last saved state
        if (historyStack[historyIndex] === val) return;

        // Discard all "redo" states beyond current index
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(val);
        historyIndex++;

        // Prune oldest entry when limit exceeded
        if (historyStack.length > 50) {
            historyStack.shift();
            historyIndex--;
        }
    }

    /**
     * undo
     * Restores the previous state from the history stack.
     * Does nothing if already at the oldest state.
     */
    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            els.input.value = historyStack[historyIndex];
            triggerUpdate();
        }
    }

    /**
     * redo
     * Restores the next state from the history stack.
     * Does nothing if already at the newest state.
     */
    function redo() {
        if (historyIndex < historyStack.length - 1) {
            historyIndex++;
            els.input.value = historyStack[historyIndex];
            triggerUpdate();
        }
    }


    /* ============================================================
     * CANVAS IMAGE STUDIO
     * Renders the current textarea text onto an HTML5 Canvas with
     * configurable dimensions, fonts, colors, shadows, and optional
     * background image (upload or Unsplash fetch).
     * ============================================================ */

    /**
     * openImageStudio
     * Shows the Image Studio modal and triggers an initial canvas render.
     */
    function openImageStudio() {
        document.getElementById('imgModal').classList.add('active');
        renderCanvas();
    }

    /**
     * closeImageStudio
     * Hides the Image Studio modal and clears the uploaded background
     * reference so the next open starts fresh.
     */
    function closeImageStudio() {
        document.getElementById('imgModal').classList.remove('active');
        uploadedBg = null;
    }

    /**
     * handleBgUpload
     * Reads a locally uploaded image file via FileReader and sets
     * it as the canvas background. Triggers canvas re-render on load.
     *
     * @param {HTMLInputElement} input — File input element.
     */
    function handleBgUpload(input) {
        if (input.files[0]) {
            const r = new FileReader();
            r.onload = (e) => {
                const i    = new Image();
                i.onload   = () => { uploadedBg = i; renderCanvas(); };
                i.src      = e.target.result;
            };
            r.readAsDataURL(input.files[0]);
        }
    }

    /**
     * usePresetBg
     * Sets a preset thumbnail image as the canvas background.
     * crossOrigin="Anonymous" prevents a "tainted canvas" security error.
     *
     * @param {HTMLImageElement} imgEl — The clicked thumbnail element.
     */
    function usePresetBg(imgEl) {
        const i         = new Image();
        i.crossOrigin   = "Anonymous";
        i.onload        = () => { uploadedBg = i; renderCanvas(); window.showToast("Background Applied!"); };
        i.onerror       = () => window.showToast("Error loading background.", true);
        i.src           = imgEl.src;
    }

    /**
     * renderCanvas
     * Full canvas draw cycle:
     *   1. Sets canvas dimensions based on the selected aspect ratio.
     *   2. Draws background (uploaded image or gradient).
     *   3. Applies text configuration (font, color, shadow).
     *   4. Wraps long text with a word-wrap algorithm.
     *   5. Optionally draws a semi-transparent text background strip.
     *   6. Draws the wrapped text lines centred on the canvas.
     *
     * All settings are read live from the Image Studio modal controls.
     */
    function renderCanvas() {
        const canvas = els.exportCanvas;
        const ctx    = canvas.getContext('2d');
        const text   = els.input.value || "Magic Text";
        const ratio  = document.getElementById('imgRatio').value;
        const size   = parseInt(document.getElementById('imgTextSize').value);

        /* -- High-resolution export dimensions -- */
        canvas.width  = (ratio === '9:16') ? 1080 : 1920;
        canvas.height = (ratio === '16:9') ? 1080 : (ratio === '1:1' ? 1920 : 1920);
        if (ratio === '1:1') { canvas.width = 1080; canvas.height = 1080; }

        /* -- Draw background: uploaded image (cover-fit) or gradient -- */
        if (uploadedBg) {
            const hRatio = canvas.width  / uploadedBg.width;
            const vRatio = canvas.height / uploadedBg.height;
            const r      = Math.max(hRatio, vRatio);

            ctx.drawImage(
                uploadedBg, 0, 0,
                uploadedBg.width, uploadedBg.height,
                (canvas.width  - uploadedBg.width  * r) / 2,
                (canvas.height - uploadedBg.height * r) / 2,
                uploadedBg.width  * r,
                uploadedBg.height * r
            );
        } else {
            // Linear gradient fallback
            const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
            g.addColorStop(0, document.getElementById('imgBg1').value);
            g.addColorStop(1, document.getElementById('imgBg2').value);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        /* -- Configure text rendering properties -- */
        ctx.font         = `bold ${size}px '${document.getElementById('imgFont').value}', sans-serif`;
        ctx.fillStyle    = document.getElementById('imgTextColor').value;
        ctx.shadowColor  = document.getElementById('imgShadowColor').value;
        ctx.shadowBlur   = 20;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        /* -- Word-wrap algorithm: builds line array that fits canvas width -- */
        const words = text.split(' ');
        let line    = '';
        let lines   = [];

        for (let n = 0; n < words.length; n++) {
            let test = line + words[n] + ' ';
            if (ctx.measureText(test).width > canvas.width * 0.9 && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = test;
            }
        }
        lines.push(line);

        const lh      = size * 1.3; // Line height = 130% of font size
        const opacity = parseFloat(document.getElementById('textBgOpacity').value);

        /* -- Optional semi-transparent text background strip -- */
        if (opacity > 0) {
            ctx.fillStyle  = `rgba(0,0,0,${opacity})`;
            ctx.shadowBlur = 0;
            ctx.fillRect(
                0,
                (canvas.height / 2) - (lines.length * lh / 2) - 20,
                canvas.width,
                lines.length * lh + 40
            );
            ctx.shadowBlur = 20;
            ctx.fillStyle  = document.getElementById('imgTextColor').value;
        }

        /* -- Draw each wrapped text line centred vertically -- */
        let y = (canvas.height / 2) - ((lines.length - 1) * lh) / 2;
        lines.forEach(l => { ctx.fillText(l, canvas.width / 2, y); y += lh; });
    }

    /**
     * downloadCanvas
     * Exports the current canvas as a lossless PNG file and triggers
     * a browser download with a timestamped filename.
     */
    function downloadCanvas() {
        const link    = document.createElement('a');
        link.download = `TextPro_${Date.now()}.png`;
        link.href     = els.exportCanvas.toDataURL('image/png', 1.0);
        link.click();
    }


    /* ============================================================
     * TEXT UTILITY FUNCTIONS
     * ============================================================ */

    /**
     * textUtil
     * Applies a named string transformation to the textarea value.
     * Supported modes:
     *   'upper'        — ALL UPPERCASE
     *   'lower'        — all lowercase
     *   'title'        — Title Case
     *   'clean'        — Collapses multiple spaces and trims
     *   'reverse'      — Reverses character order
     *   'slug'         — URL-safe slug (lowercase, hyphen-separated)
     *   'extract-email'— Extracts unique email addresses from text
     *   'json'         — Beautifies valid JSON (reports error if invalid)
     *
     * @param {string} mode — The transformation type identifier.
     */
    function textUtil(mode) {
        let t = els.input.value;

        if (mode === 'upper')   t = t.toUpperCase();
        if (mode === 'lower')   t = t.toLowerCase();
        if (mode === 'title')   t = t.replace(/\w\S*/g, txt =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        if (mode === 'clean')   t = t.replace(/\s+/g, ' ').trim();
        if (mode === 'reverse') t = t.split('').reverse().join('');
        if (mode === 'slug')    t = t.toLowerCase().trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');

        if (mode === 'extract-email') {
            const emails = t.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
            t = emails ? [...new Set(emails)].join('\n') : "No emails found";
        }

        if (mode === 'json') {
            try {
                t = JSON.stringify(JSON.parse(t), null, 2);
            } catch (e) {
                window.showToast("Invalid JSON Format", true);
            }
        }

        els.input.value = t;
        triggerUpdate();
    }


    /* ============================================================
     * SPEECH FUNCTIONS
     * ============================================================ */

    /**
     * toggleSpeech
     * Starts or stops Speech Recognition (microphone dictation).
     * Adds the .active-pulse animation class to #micBtn while recording.
     * Uses the SpeechRecognition Web API (prefixed for WebKit browsers).
     */
    function toggleSpeech() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SR) {
            alert("Speech Recognition is not supported in this browser.");
            return;
        }

        const r         = new SR();
        r.continuous    = true;
        r.interimResults= true;

        // Add pulse animation while microphone is active
        r.onstart  = () => document.getElementById('micBtn').classList.add('active-pulse');
        r.onend    = () => document.getElementById('micBtn').classList.remove('active-pulse');

        // Accumulate all recognised transcripts into the textarea
        r.onresult = (e) => {
            const t = Array.from(e.results).map(r => r[0].transcript).join('');
            els.input.value = t;
            triggerUpdate();
        };

        r.start();
    }

    /**
     * toggleSpeak
     * Reads the current textarea content aloud using the Web Speech
     * Synthesis API. Calling again while speaking will cancel the reading.
     */
    function toggleSpeak() {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            return;
        }
        const u = new SpeechSynthesisUtterance(els.input.value);
        window.speechSynthesis.speak(u);
    }


    /* ============================================================
     * TAB SWITCHER
     * ============================================================ */

    /**
     * setTab
     * Switches the active content panel by toggling .active
     * on both the clicked tab button and the corresponding panel.
     *
     * @param {string}          id  — The id of the content panel to show.
     * @param {HTMLButtonElement} btn — The clicked tab button element.
     */
    function setTab(id, btn) {
        // Deactivate all tabs and panels
        document.querySelectorAll('.tpm-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tpm-content-area').forEach(c => c.classList.remove('active'));

        // Activate the selected tab and its panel
        btn.classList.add('active');
        document.getElementById(id).classList.add('active');
    }


    /* ============================================================
     * HELPER UTILITIES
     * ============================================================ */

    /**
     * createCardElement
     * Factory function that builds a styled output card DOM element.
     * Uses textContent (not innerHTML) for the value to prevent XSS.
     * The card triggers a clipboard copy on click.
     *
     * @param {string} lbl — The card's label text (e.g. "serif bold").
     * @param {string} txt — The card's content text.
     * @returns {HTMLDivElement} — The fully assembled card element.
     */
    function createCardElement(lbl, txt) {
        const div = document.createElement('div');
        div.className = 'tpm-card tpm-card--clickable';

        // Label (using innerHTML is safe here — lbl comes from a trusted constant)
        div.innerHTML = `<div class="tpm-card-label">${lbl}</div>`;

        // Value (using textContent prevents any injected HTML from rendering)
        const txtDiv       = document.createElement('div');
        txtDiv.className   = 'tpm-card-text';
        txtDiv.textContent = txt;
        div.appendChild(txtDiv);

        // "Tap to Copy" hover hint
        const hint       = document.createElement('div');
        hint.className   = 'tpm-copy-hint';
        hint.textContent = 'Tap to Copy';
        div.appendChild(hint);

        // Bind copy action on card click
        div.onclick = () => copyText(txt);
        return div;
    }

    /**
     * escapeHTML
     * Sanitises a string by replacing HTML special characters with
     * their safe entity equivalents. Used when inserting user-supplied
     * strings into innerHTML contexts (e.g., draft names).
     *
     * @param {string} str — Raw string to escape.
     * @returns {string}   — HTML-safe escaped string.
     */
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, t => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            "'": '&#39;', '"': '&quot;'
        }[t]));
    }

    /**
     * copyText
     * Copies a string to the clipboard using the Clipboard API.
     * Triggers the global success toast on completion.
     *
     * @param {string} t — The text to copy.
     */
    function copyText(t) {
        navigator.clipboard.writeText(t).then(() =>
            window.showToast("Copied!")
        );
    }


    /* ============================================================
     * PUBLIC API — Exposed methods accessible from HTML via
     * TextProCore.methodName()
     * ============================================================ */
    return {

        /* Core lifecycle */
        init,

        /* Draft management */
        loadDraft,
        createNewDraft,
        deleteDraft,

        /* Undo / redo */
        undo,
        redo,

        /* Clipboard */
        copyText,
        copyInput : () => copyText(els.input.value),

        /* Editor controls */
        clearText : () => {
            if (confirm("Clear all text?")) {
                els.input.value = "";
                triggerUpdate();
            }
        },

        /* Sidebar toggle — adds/removes .active on #sidebar and .tpm-sidebar-overlay */
        toggleSidebar : () => {
            document.getElementById('sidebar').classList.toggle('active');
            document.querySelector('.tpm-sidebar-overlay').classList.toggle('active');
        },

        /* Symbol picker modal */
        openSymbolPicker : () =>
            document.getElementById('symbolModal').classList.add('active'),

        /* Tab navigation */
        setTab,

        /* Render engines */
        renderRepeater,
        renderGlitch,

        /* Image Studio */
        openImageStudio,
        closeImageStudio,
        renderCanvas,
        downloadCanvas,
        handleBgUpload,
        usePresetBg,

        /* Speech */
        toggleSpeech,
        toggleSpeak,

        /* Text utilities */
        textUtil,

        /* File download */
        downloadText : () => {
            const b = new Blob([els.input.value], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href     = URL.createObjectURL(b);
            a.download = `TextPro_${Date.now()}.txt`;
            a.click();
        },

        /* Find & Replace panel */
        toggleFindReplace : () => {
            const b       = document.getElementById('findReplaceBar');
            b.style.display = b.style.display === 'none' ? 'flex' : 'none';
        },

        execFindReplace : () => {
            const f = document.getElementById('findTxt').value;
            const r = document.getElementById('repTxt').value;

            if (f) {
                // Escape regex special chars in the find string before building RegExp
                const regex = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                els.input.value = els.input.value.replace(regex, r);
                triggerUpdate();
                window.showToast("Replaced Matches!");
            }
        },

        /* Clipboard paste */
        pasteText : async () => {
            try {
                const text = await navigator.clipboard.readText();
                els.input.value += text;
                triggerUpdate();
            } catch (e) {
                alert("Please paste manually (Ctrl+V / Cmd+V)");
            }
        },

        /* File Import */

        /**
         * handleFileImport
         * Reads a local text-based file (.txt, .json, etc.) using FileReader
         * and loads its content directly into the textarea.
         *
         * @param {HTMLInputElement} i — The file input element.
         */
        handleFileImport : (i) => {
            const r    = new FileReader();
            r.onload   = (e) => {
                els.input.value = e.target.result;
                triggerUpdate();
            };
            r.readAsText(i.files[0]);
        },

        /**
         * searchUnsplash
         * Fetches royalty-free background images from the Unsplash API
         * matching the user's search query. Renders clickable thumbnails
         * in the Image Studio panel. Clicking a thumbnail loads the full
         * HD image as the canvas background.
         *
         * IMPORTANT: crossOrigin="Anonymous" is set on the full-res image
         * to prevent a 'Tainted Canvas' security error when calling toDataURL().
         */
        searchUnsplash : async function() {
            const query = document.getElementById('uns-search').value || 'abstract dark';
            const grid  = document.getElementById('unsplash-results');

            // Show loading indicator inside the results container
            grid.innerHTML = '<span style="font-size:12px; color:var(--accent-cyan); margin:auto;">Searching Unsplash...</span>';

            try {
                // Unsplash Search API request
                const response = await fetch(
                    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=15&client_id=${UNSPLASH_ACCESS_KEY}`
                );
                const data = await response.json();

                // Handle empty results
                if (!data.results || data.results.length === 0) {
                    grid.innerHTML = '<span style="font-size:12px; color:#ff4757; margin:auto;">No images found!</span>';
                    return;
                }

                grid.innerHTML = ''; // Clear previous results

                // Render thumbnail for each result
                data.results.forEach(img => {
                    const thumb   = document.createElement('img');
                    thumb.src     = img.urls.thumb;
                    thumb.title   = `Photo by ${img.user.name} (Unsplash)`;
                    thumb.style   = "width:70px; height:70px; object-fit:cover; border-radius:8px; cursor:pointer; border:2px solid #333; transition:0.2s; flex-shrink:0;";

                    // Hover border highlight
                    thumb.onmouseover = () => thumb.style.borderColor = 'var(--brand-primary)';
                    thumb.onmouseout  = () => thumb.style.borderColor = '#333';

                    // On click: load HD version and set as canvas background
                    thumb.onclick = () => {
                        window.showToast("Fetching HD Image...");
                        const fullImg        = new Image();

                        /*
                         * SECURITY NOTE: crossOrigin="Anonymous" is required to
                         * avoid a "Tainted Canvas" DOMException when the canvas
                         * calls toDataURL() after drawing a cross-origin image.
                         */
                        fullImg.crossOrigin  = "Anonymous";

                        fullImg.onload  = () => {
                            uploadedBg = fullImg; // Store as active background
                            renderCanvas();        // Re-render canvas with new bg
                            window.showToast("Background Applied!");
                        };
                        fullImg.onerror = () =>
                            window.showToast("Error: Image load failed.", true);

                        fullImg.src = img.urls.regular; // Load optimised resolution
                    };

                    grid.appendChild(thumb);
                });

            } catch (error) {
                console.error("Unsplash Fetch Error:", error);
                grid.innerHTML = '<span style="font-size:11px; color:#ff4757; margin:auto;">API Connection Error.</span>';
            }
        }

    }; /* end return (public API) */

})(); /* end TextProCore IIFE */


/* ============================================================================
 * SYMBOL PICKER — renderSymbols
 * Populates the symbol picker grid (#symbolGrid) with clickable mini-buttons,
 * one per symbol character. Defined outside the IIFE so it can be called
 * easily by the init() function and re-called if needed.
 * ============================================================================ */
function renderSymbols() {
    document.getElementById('symbolGrid').innerHTML =
        "★☆✦✧✪✔✘❤♡♥❥🔥💀☠☺☹☻☀☁☂☃❄⚡❝❞➤➥➦➮➢➣➠➟➨➔➙➛➜➝➞➟➡➢➣➤➧➸➹➳➵➶➷➸➹➺➻➼➽←↑→↓↔↕↖↗↘↙↺↻∆∇∞≈≠≤≥±"
        .split('')
        .map(s => `<button class="tpm-mini-btn" onclick="insertSymbol('${s}')" title="Insert ${s}" style="font-size:16px; width:36px; height:36px;">${s}</button>`)
        .join('');
}


/* ============================================================================
 * insertSymbol (Global Helper)
 * Inserts a symbol character at the current cursor position (or replaces
 * current selection) in the main textarea (#input), then closes the modal.
 * Exposed on window so it can be called from the onclick attribute generated
 * by renderSymbols() above.
 *
 * @param {string} s — The symbol character to insert.
 * ============================================================================ */
window.insertSymbol = (s) => {
    const el = document.getElementById('input');

    // setRangeText inserts at cursor / replaces selection
    el.setRangeText(s, el.selectionStart, el.selectionEnd, 'end');

    // Manually fire 'input' to trigger the debounced handler
    el.dispatchEvent(new Event('input'));

    // Close the symbol picker modal
    document.getElementById('symbolModal').classList.remove('active');
};


/* ============================================================================
 * ENGINE BOOTSTRAP
 * Initialises the TextPro engine once the full DOM is available.
 * ============================================================================ */
window.addEventListener('DOMContentLoaded', TextProCore.init);
