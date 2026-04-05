/**
 * =============================================================================
 *  TRUSTED TOOLS WEB — Ultra Strong Password Generator
 *  File    : script.js
 *  Version : 2.5.0 (Enterprise Edition)
 *  Author  : MD KAWSAR
 *
 *  SECURITY ARCHITECTURE:
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. CSPRNG  — Uses window.crypto.getRandomValues() instead of Math.random()
 *               for cryptographically secure entropy sourced from device hardware.
 *  2. Rejection Sampling — Eliminates Modulo Bias by discarding values outside
 *               the nearest power-of-2 boundary, guaranteeing uniform distribution.
 *  3. NIST 800-63B Entropy — Calculates Shannon Entropy (bits) via
 *               Entropy = Length × log₂(PoolSize) to assess cracking difficulty.
 *  4. Fisher-Yates Shuffle — Randomly reorders the final character array so
 *               that "forced" characters (one per active group) are not predictably
 *               clustered at the beginning of the output string.
 *  5. XSS-Safe History — Passwords written to the DOM using textContent (never
 *               innerHTML) to prevent any injection attacks from malformed values.
 *  ─────────────────────────────────────────────────────────────────────────
 *
 *  TOAST SYSTEM:
 *  All notifications use window.showToast() injected by the global module.
 *  Success : window.showToast("Message")
 *  Error   : window.showToast("Message", true)   ← boolean true = error state
 * =============================================================================
 */

/* ── CHARACTER SETS ──────────────────────────────────────────────────────────
 * Each key maps to the allowed printable characters for that group.
 * Symbols use NIST-recommended printable ASCII — the broadest safe set.
 */
const CHAR_SETS = {
    upper   : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower   : 'abcdefghijklmnopqrstuvwxyz',
    numbers : '0123456789',
    // NIST SP 800-63B allows all printable ASCII — most common safe subset used here.
    symbols : '!@#$%^&*()_+~`|}{[]:;?><,./-='
};

/* ── GLOBAL CONFIGURATION ────────────────────────────────────────────────────
 * historyLimit  : Maximum number of recently generated passwords stored locally.
 * toastDuration : Display duration (ms) for toast notifications.
 * storageKey    : Unique localStorage key scoped to this tool version.
 */
const CONFIG = {
    historyLimit  : 10,
    toastDuration : 3000,
    storageKey    : 'ttw_password_gen_v25'
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1 — INITIALISATION
   Runs after the full DOM is parsed and ready.
   Loads stored history, attaches all event listeners, and generates the
   first password so the user is never greeted with an empty output box.
═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    try {
        loadHistory();          // Restore any previously saved passwords from localStorage
        setupEventListeners();  // Attach all button / input listeners
        setupKeyboardNav();     // Enable keyboard (Enter / Space) activation for icon buttons
        generatePassword();     // Auto-generate on load for immediate visual feedback
    } catch (error) {
        // Surface any critical init failure to the developer console without breaking the page
        console.error("Critical Init Error:", error);
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2 — EVENT LISTENERS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * setupEventListeners()
 * Registers all interactive control handlers:
 *  - Length range slider  → live-updates character count and regenerates.
 *  - Checkbox group       → regenerates on any change so the user sees
 *                           immediate feedback when toggling character sets.
 *  - Generate button      → explicit one-click generation.
 *  - Regen icon button    → same action as generate (compact UX pattern).
 *  - Copy icon button     → reads current output and copies to clipboard.
 *  - Clear history button → wipes localStorage and refreshes the history list.
 */
function setupEventListeners() {

    // ── Length slider: update visible number and regenerate password ──────
    document.getElementById('lengthRange')?.addEventListener('input', (e) => {
        updateLength(e.target.value);
    });

    // ── Character set checkboxes: auto-regenerate on every toggle ─────────
    ['uppercase', 'lowercase', 'numbers', 'symbols'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', generatePassword);
    });

    // ── Primary action buttons ────────────────────────────────────────────
    document.getElementById('generateMainBtn')?.addEventListener('click', generatePassword);
    document.getElementById('regenBtn')?.addEventListener('click', generatePassword);
    document.getElementById('copyMainBtn')?.addEventListener('click', copyPassword);
    document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);
}

/**
 * setupKeyboardNav()
 * Makes custom div-based icon buttons and the generate button fully
 * keyboard-accessible. Pressing Enter or Space on any matching element
 * programmatically fires its click handler — meeting WCAG 2.1 AA standards.
 */
function setupKeyboardNav() {
    // Targets the regen/copy icon buttons (.pwd-icon-btn) and the generate button
    document.querySelectorAll('.pwd-icon-btn, #generateMainBtn').forEach(btn => {
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Prevent page scroll on Space
                btn.click();
            }
        });
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3 — CORE CRYPTOGRAPHIC ENGINE
═══════════════════════════════════════════════════════════════════════════ */

/**
 * getSecureRandomInt(max)
 * ─────────────────────────────────────────────────────────────────────────
 * Generates a cryptographically secure integer in the range [0, max).
 *
 * ALGORITHM — Rejection Sampling with Bit Masking:
 *  1. Calculate the smallest bitmask that covers [0, max).
 *     e.g. max=62 → binary 111110 → mask = 63 (binary 111111)
 *  2. Draw a raw 32-bit value from window.crypto.getRandomValues().
 *  3. Apply the mask (AND) to reduce to the relevant bit range.
 *  4. Reject and retry if the masked value falls outside [0, max).
 *
 * WHY: Standard `% max` (Modulo Bias) makes lower indices slightly more
 * likely when max is not a power of 2. This loop eliminates that skew,
 * giving every character in the pool a perfectly equal chance of selection.
 *
 * @param {number} max — Exclusive upper bound (pool length).
 * @returns {number} Uniformly distributed integer in [0, max).
 */
function getSecureRandomInt(max) {
    if (max === 0) return 0; // Guard against empty pool

    const array = new Uint32Array(1);

    // Build the smallest (2ⁿ − 1) mask that encompasses the range [0, max)
    let mask = 1;
    while (mask < max) mask = (mask << 1) | 1;

    let r;
    do {
        window.crypto.getRandomValues(array); // Hardware entropy source
        r = array[0] & mask;                  // Clamp to bitmask range
    } while (r >= max);                       // Reject values outside [0, max)

    return r;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 4 — PASSWORD GENERATION
═══════════════════════════════════════════════════════════════════════════ */

/**
 * generatePassword()
 * ─────────────────────────────────────────────────────────────────────────
 * Orchestrates the full password creation pipeline:
 *
 *  Step 1 — Validation:
 *    Ensure at least one character set checkbox is active. If none are
 *    checked, display an error state and fire a global error toast.
 *
 *  Step 2 — Guaranteed Complexity:
 *    For each active character group, one random character from that group
 *    is selected first. This ensures the output ALWAYS contains at least
 *    one uppercase, one lowercase, one digit, and/or one symbol — preventing
 *    the edge case where a purely random fill might omit an entire group.
 *
 *  Step 3 — Pool Fill:
 *    The remaining (length − forced) characters are selected uniformly from
 *    the combined pool of all active character sets.
 *
 *  Step 4 — Fisher-Yates Shuffle:
 *    The array is securely shuffled so the forced characters (always at the
 *    start of the array before shuffling) cannot be identified positionally.
 *
 *  Step 5 — UI Update:
 *    The final string is written to the output input, a pulse animation
 *    is triggered for visual feedback, entropy is calculated, and the
 *    new password is appended to the local history.
 */
function generatePassword() {
    const lengthInput = document.getElementById('lengthRange');
    const length      = parseInt(lengthInput.value || 16);
    const output      = document.getElementById('passwordOutput');
    const pwdBox      = document.getElementById('pwdBox');

    // ── Read active character-set selections from checkboxes ──────────────
    const options = {
        upper   : document.getElementById('uppercase').checked,
        lower   : document.getElementById('lowercase').checked,
        numbers : document.getElementById('numbers').checked,
        symbols : document.getElementById('symbols').checked
    };

    // ── VALIDATION: Require at least one character group ─────────────────
    if (!options.upper && !options.lower && !options.numbers && !options.symbols) {
        output.value = "SELECT AN OPTION";
        pwdBox.classList.add('error-state', 'shake');

        // Remove 'shake' class after the animation completes to allow re-triggering
        setTimeout(() => pwdBox.classList.remove('shake'), 500);

        // Global error toast — boolean `true` flags this as an error notification
        window.showToast("Select at least 1 character type", true);

        resetStrength(); // Clear the strength meter to reflect invalid state
        return;
    } else {
        // Remove error styling when a valid selection exists
        pwdBox.classList.remove('error-state');
    }

    let pool          = "";     // Combined character pool string for the fill phase
    let passwordChars = [];     // Array of selected characters before shuffle

    // ── STEP 2: Force one character from each active group ────────────────
    if (options.upper) {
        pool += CHAR_SETS.upper;
        passwordChars.push(CHAR_SETS.upper[getSecureRandomInt(CHAR_SETS.upper.length)]);
    }
    if (options.lower) {
        pool += CHAR_SETS.lower;
        passwordChars.push(CHAR_SETS.lower[getSecureRandomInt(CHAR_SETS.lower.length)]);
    }
    if (options.numbers) {
        pool += CHAR_SETS.numbers;
        passwordChars.push(CHAR_SETS.numbers[getSecureRandomInt(CHAR_SETS.numbers.length)]);
    }
    if (options.symbols) {
        pool += CHAR_SETS.symbols;
        passwordChars.push(CHAR_SETS.symbols[getSecureRandomInt(CHAR_SETS.symbols.length)]);
    }

    // ── STEP 3: Fill remaining slots from the combined pool ───────────────
    while (passwordChars.length < length) {
        passwordChars.push(pool[getSecureRandomInt(pool.length)]);
    }

    // ── STEP 4: Secure Fisher-Yates Shuffle ───────────────────────────────
    // Iterates backwards from the last element; at each position i, swaps
    // it with a securely random position j where 0 ≤ j ≤ i.
    for (let i = passwordChars.length - 1; i > 0; i--) {
        const j = getSecureRandomInt(i + 1);
        [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }

    const finalPassword = passwordChars.join('');

    // ── STEP 5: Update the output UI with animation ────────────────────────
    if (output) {
        output.value = finalPassword;

        // Force animation restart by removing the class, triggering a reflow,
        // then re-adding. Without the reflow, the browser ignores the re-add.
        output.classList.remove('pulse-animation');
        void output.offsetWidth; // Deliberate reflow trigger
        output.classList.add('pulse-animation');
    }

    // ── Post-processing: strength analysis and history logging ────────────
    calculateNistStrength(finalPassword, pool.length);
    addToHistory(finalPassword);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 5 — NIST 800-63B ENTROPY ANALYZER
═══════════════════════════════════════════════════════════════════════════ */

/**
 * calculateNistStrength(pwd, poolSize)
 * ─────────────────────────────────────────────────────────────────────────
 * Calculates the Shannon Entropy of the generated password and maps it to
 * one of four human-readable strength levels.
 *
 * FORMULA: H = L × log₂(N)
 *   H = entropy in bits
 *   L = password length (characters)
 *   N = total size of the combined character pool
 *
 * THRESHOLDS (calibrated against 2026-era GPU cracking benchmarks):
 *   > 110 bits → MILITARY  (cyan)    — Trillions of years
 *   > 70  bits → STRONG    (green)   — Billions of years
 *   > 50  bits → MEDIUM    (yellow)  — Months to years
 *   ≤ 50  bits → WEAK      (red)     — Crackable in hours/days
 *
 * @param {string} pwd      — The generated password string.
 * @param {number} poolSize — Total number of distinct characters in the active pool.
 */
function calculateNistStrength(pwd, poolSize) {
    const length = pwd.length;
    if (poolSize === 0) return resetStrength(); // No pool means no strength

    // Core entropy calculation using the Shannon entropy formula
    const entropyBits = length * Math.log2(poolSize);

    // Map entropy value to a labelled strength tier
    let strengthLevel = 0; // 0=Weak, 1=Medium, 2=Strong, 3=Military
    let color         = '#ff3333';
    let label         = 'WEAK';

    if (entropyBits > 110)      { strengthLevel = 3; color = '#00e5ff'; label = 'MILITARY'; }
    else if (entropyBits > 70)  { strengthLevel = 2; color = '#238636'; label = 'STRONG';   }
    else if (entropyBits > 50)  { strengthLevel = 1; color = '#d29922'; label = 'MEDIUM';   }

    updateStrengthUI(strengthLevel, color, label);
}

/**
 * updateStrengthUI(level, color, text)
 * ─────────────────────────────────────────────────────────────────────────
 * Applies the computed strength data to the four bar segments and the
 * text label. Bars at index ≤ level are colored; the rest are reset to muted.
 *
 * @param {number} level — Strength tier index (0–3); bars 0..level are filled.
 * @param {string} color — CSS colour string for filled bars and label.
 * @param {string} text  — Human-readable label ("WEAK", "MEDIUM", etc.).
 */
function updateStrengthUI(level, color, text) {
    const bars = [
        document.getElementById('bar1'),
        document.getElementById('bar2'),
        document.getElementById('bar3'),
        document.getElementById('bar4')
    ];
    const textEl = document.getElementById('strengthText');

    // Update the text label and its colour
    if (textEl) {
        textEl.innerText   = text;
        textEl.style.color = color;
    }

    // Color each bar according to whether its index falls within the active level
    bars.forEach((bar, idx) => {
        if (idx <= level) {
            // Active bar: apply the strength colour with a matching glow shadow
            bar.style.background = color;
            bar.style.boxShadow  = `0 0 10px ${color}`;
        } else {
            // Inactive bar: reset to the default muted border colour
            bar.style.background = 'var(--border-main)';
            bar.style.boxShadow  = 'none';
        }
    });
}

/**
 * resetStrength()
 * Clears all bar segments and resets the label to "WEAK" with red colour.
 * Called when no character set is selected (validation failure).
 */
function resetStrength() {
    updateStrengthUI(-1, 'var(--border-main)', 'WEAK'); // -1 fills zero bars
    const textEl = document.getElementById('strengthText');
    if (textEl) textEl.style.color = '#ff3333';
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 6 — LENGTH SLIDER HANDLER
═══════════════════════════════════════════════════════════════════════════ */

/**
 * updateLength(val)
 * ─────────────────────────────────────────────────────────────────────────
 * Called on every 'input' event from the range slider.
 * Updates the visible character-count badge and immediately regenerates
 * the password to reflect the new length.
 *
 * @param {string|number} val — The new slider value (character count).
 */
function updateLength(val) {
    document.getElementById('lengthVal').innerText = val;
    generatePassword(); // Live-regenerate on every slider move
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 7 — CLIPBOARD MANAGER
═══════════════════════════════════════════════════════════════════════════ */

/**
 * copyPassword()
 * ─────────────────────────────────────────────────────────────────────────
 * Reads the current value of the password output input and passes it to
 * performCopy(). Bails early if the field is empty or in an error state.
 */
async function copyPassword() {
    const pwd = document.getElementById('passwordOutput').value;

    // Guard: do not attempt to copy placeholder / error state text
    if (!pwd || pwd.includes("SELECT AN OPTION") || pwd.includes("INITIALIZING")) return;

    await performCopy(pwd);
}

/**
 * performCopy(text)
 * ─────────────────────────────────────────────────────────────────────────
 * Two-tier clipboard strategy:
 *
 *  PRIMARY (Modern): navigator.clipboard.writeText()
 *    — Available in all modern browsers when the page is served over HTTPS.
 *    — Asynchronous, permission-aware, secure-context enforced.
 *
 *  FALLBACK (Legacy): document.execCommand('copy')
 *    — Used for HTTP contexts or older browser versions.
 *    — Creates an off-screen textarea, selects it, issues the copy command,
 *      then immediately removes the element to avoid layout impact.
 *
 * @param {string} text — The password string to copy to the clipboard.
 */
async function performCopy(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // ── Modern secure clipboard API (preferred) ────────────────────
            await navigator.clipboard.writeText(text);
            window.showToast("Copied to Clipboard Securely!");
        } else {
            // ── Legacy execCommand fallback (HTTP or old browsers) ─────────
            const textArea = document.createElement("textarea");
            textArea.value = text;

            // Position off-screen to prevent layout shift and mobile keyboard popup
            textArea.style.position = "fixed";
            textArea.style.left     = "-9999px";
            textArea.style.top      = "0";
            textArea.setAttribute("readonly", "");

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea); // Clean up immediately

            if (successful) {
                window.showToast("Copied!");
            } else {
                throw new Error("execCommand copy returned false");
            }
        }
    } catch (err) {
        // Surface the error to the developer console and notify the user
        console.error("Clipboard copy failed:", err);
        window.showToast("Copy failed. Please check browser permissions.", true);
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 8 — PASSWORD HISTORY MANAGER (localStorage, XSS-Safe)
═══════════════════════════════════════════════════════════════════════════ */

/**
 * addToHistory(pwd)
 * ─────────────────────────────────────────────────────────────────────────
 * Prepends the newly generated password to the local history array.
 * Enforces CONFIG.historyLimit (default: 10) — oldest entry is removed
 * when the limit is exceeded. Duplicate consecutive entries are suppressed.
 *
 * @param {string} pwd — The generated password string to log.
 */
function addToHistory(pwd) {
    try {
        let history = JSON.parse(localStorage.getItem(CONFIG.storageKey)) || [];

        // Prevent duplicate entry at position [0] (same password regenerated twice)
        if (history.length > 0 && history[0] === pwd) return;

        history.unshift(pwd); // Add to front of array (most recent first)

        // Trim to the configured limit to avoid unbounded storage growth
        if (history.length > CONFIG.historyLimit) history.pop();

        localStorage.setItem(CONFIG.storageKey, JSON.stringify(history));
        loadHistory(); // Re-render the history list in the DOM
    } catch (e) {
        // localStorage may be unavailable in private/incognito browsing modes
        console.warn("LocalStorage unavailable (Incognito Mode or storage quota exceeded).");
    }
}

/**
 * loadHistory()
 * ─────────────────────────────────────────────────────────────────────────
 * Reads the saved history array from localStorage and renders it as a
 * list of rows inside #historyList. Each row shows a truncated password
 * (full text available via tooltip) and a copy icon button.
 *
 * XSS SAFETY: All password content is inserted via textContent — never
 * innerHTML — so even adversarially crafted strings cannot inject HTML.
 *
 * The copy button uses an addEventListener (not onclick="") for clean
 * code separation and to keep passwords out of the HTML attribute space.
 */
function loadHistory() {
    const list = document.getElementById('historyList');
    if (!list) return;

    try {
        const history = JSON.parse(localStorage.getItem(CONFIG.storageKey)) || [];
        list.innerHTML = ""; // Clear existing rows before re-rendering

        // Empty state: show a placeholder message
        if (history.length === 0) {
            list.innerHTML = `<li style="text-align:center; color:var(--text-muted); font-size:12px; padding:10px 0;">
                No history yet. Generated passwords will appear here.
            </li>`;
            return;
        }

        // Render one <li> per history entry
        history.forEach((pwd, index) => {
            const li = document.createElement('li');
            li.className = 'history-item';

            // Stagger entrance animation delay for a cascading reveal effect
            li.style.animationDelay = `${index * 0.05}s`;

            // ── Password text span (XSS-safe via textContent) ──────────────
            // Truncate long passwords to prevent layout overflow; full value
            // is always accessible in the title tooltip attribute.
            const truncated  = pwd.length > 24 ? pwd.substring(0, 24) + "…" : pwd;
            const textSpan   = document.createElement('span');
            textSpan.className   = 'history-pwd-text';
            textSpan.title       = pwd;          // Full password in tooltip
            textSpan.textContent = truncated;    // Safe DOM text insertion

            // ── Copy button for individual history row ─────────────────────
            // Uses .icon-btn from Section 5 of tools-template.css.
            // Inline dimension overrides (30×30px) match the compact row height.
            const btnDiv       = document.createElement('div');
            btnDiv.className   = 'icon-btn';
            btnDiv.style.width  = '30px';
            btnDiv.style.height = '30px';
            btnDiv.style.fontSize = '14px';
            btnDiv.innerHTML    = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
            btnDiv.title        = 'Copy this password';
            btnDiv.setAttribute('role', 'button');
            btnDiv.setAttribute('tabindex', '0');

            // Bind the copy action — passes the full (untruncated) password
            btnDiv.addEventListener('click', () => performCopy(pwd));

            // Keyboard accessibility for history copy buttons
            btnDiv.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    performCopy(pwd);
                }
            });

            li.appendChild(textSpan);
            li.appendChild(btnDiv);
            list.appendChild(li);
        });

    } catch (e) {
        // Non-critical: log but do not surface to the user
        console.warn("History Load Error:", e);
    }
}

/**
 * clearHistory()
 * ─────────────────────────────────────────────────────────────────────────
 * Prompts the user for confirmation, then wipes the localStorage history key
 * and refreshes the (now empty) history list in the DOM.
 * Uses a global info-style toast to confirm the action was successful.
 */
function clearHistory() {
    if (confirm("Clear your local password history? This cannot be undone.")) {
        localStorage.removeItem(CONFIG.storageKey);
        loadHistory(); // Re-render to show the empty-state placeholder

        // Use global toast — boolean `true` marks it as an error/warning-style notification
        window.showToast("Password history cleared.", true);
    }
}
