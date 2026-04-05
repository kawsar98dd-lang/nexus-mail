/**
 * =============================================================================
 * TRUSTED TOOLS WEB — Gmail Alias Generator Pro
 * =============================================================================
 *
 * File     : script.js
 * Tool     : Gmail Alias Generator Pro (Section 32, gag- prefix)
 * Version  : 3.2.0 (CodeCanyon Refactor)
 * Author   : MD KAWSAR
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * This file implements the Gmail Alias Generator Pro using the Revealing
 * Module Pattern (IIFE). All logic is encapsulated inside `GmailGeneratorApp`
 * to avoid polluting the global namespace.
 *
 * INTERNAL MODULES
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONFIG     — Read-only configuration constants (limits, defaults, regexes).
 *  state      — Mutable runtime state (email list, generation lock flag).
 *  Utils      — Stateless helper functions (crypto random, case randomiser,
 *               clipboard copy). Toast notifications use the global system
 *               via window.showToast().
 *  Generator  — Pure generation logic (dot trick, plus trick, domain selection,
 *               case randomisation, main async loop).
 *  UI         — DOM controller: caches element references, binds event
 *               listeners, manages loading state, and drives batched rendering.
 *
 * TOAST SYSTEM
 * ─────────────────────────────────────────────────────────────────────────────
 * All user-facing notifications use the global toast system injected by the
 * site's global JS. Calls follow the pattern:
 *   window.showToast("Message")              → success (green)
 *   window.showToast("Message", true)        → error   (red)
 *   window.showToast("Message", false, true) → warning (orange)
 *
 * PERFORMANCE
 * ─────────────────────────────────────────────────────────────────────────────
 * The generator runs synchronously inside a Promise then hands the complete
 * result array to renderBatchedOutput(), which uses requestAnimationFrame to
 * paint CONFIG.BATCH_SIZE rows per frame. This prevents UI jank when
 * generating 10,000+ aliases.
 *
 * SECURITY
 * ─────────────────────────────────────────────────────────────────────────────
 * All random decisions use window.crypto.getRandomValues() (CSPRNG) via
 * Utils.secureRandom(). The only exception is the random-suffix mode inside
 * applyPlusTrick(), which uses Math.random() for speed (suffix privacy is
 * low-stakes — this can be upgraded if required).
 * =============================================================================
 */

const GmailGeneratorApp = (function () {

    /* =========================================================================
       CONFIG — Application-Wide Constants
       =========================================================================
       These constants control the generator's behaviour and safety limits.
       Buyers can tune MAX_ATTEMPTS_MULTIPLIER and BATCH_SIZE to balance
       performance and memory usage on their target deployment environment.
    ========================================================================= */

    const CONFIG = {
        /**
         * Safety ceiling: maximum total loop iterations = requested limit × this
         * multiplier. Prevents infinite loops when the username is very short and
         * the unique-combination space is quickly exhausted.
         *
         * @type {number}
         * [BUYER CONFIG]: Increase this value to allow more attempts on short
         * usernames. Decrease it to cap CPU time on very large requests.
         */
        MAX_ATTEMPTS_MULTIPLIER: 50,

        /**
         * After this many consecutive duplicate attempts (no new unique email
         * found), the generator breaks out of the loop early and returns whatever
         * it has produced so far. This prevents subtle hangs on degenerate inputs.
         *
         * @type {number}
         */
        MAX_CONSECUTIVE_FAILURES: 250,

        /**
         * Number of email rows painted per requestAnimationFrame tick during
         * batched rendering. Higher values render faster but may cause brief
         * frame drops on low-end devices. 200 is a balanced default.
         *
         * @type {number}
         * [BUYER CONFIG]: Reduce to 50–100 for smoother rendering on mobile;
         * increase to 500 for faster rendering on desktop-only deployments.
         */
        BATCH_SIZE: 200,

        /**
         * Default plus-suffix words used when the user selects "Custom Words"
         * mode but leaves the suffix input blank.
         *
         * @type {string[]}
         */
        DEFAULTS: ['newsletter', 'work', 'social', 'temp', 'test', 'dev', 'qa', 'shop'],

        /** Pre-compiled regular expressions for input validation. */
        REGEX: {
            /** Allows only characters valid in a Gmail local-part (letters, digits, dots). */
            USERNAME: /^[a-zA-Z0-9.]+$/,

            /** Minimal structure check: something@something.something */
            EMAIL_STRUCT: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        }
    };


    /* =========================================================================
       STATE — Mutable Runtime State
       =========================================================================
       Centralised state object avoids scattered global variables.
       isGenerating acts as a mutex to prevent concurrent generation runs.
    ========================================================================= */

    let state = {
        /** @type {string[]} The last successfully generated list of alias emails. */
        generatedEmails: [],

        /** @type {boolean} True while an async generation run is in progress. */
        isGenerating: false
    };


    /* =========================================================================
       UTILS — Stateless Helper Functions
       =========================================================================
       All utilities are pure (no side effects other than clipboard/toast calls).
    ========================================================================= */

    const Utils = {

        /**
         * Generates a cryptographically secure pseudo-random float in [0, 1).
         * Uses the Web Crypto API (window.crypto.getRandomValues) to ensure
         * that alias patterns cannot be predicted from the seed.
         *
         * @returns {number} A random float in the range [0, 1).
         */
        secureRandom: function () {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            // Divide by (2^32) to normalise to [0, 1)
            return array[0] / (0xFFFFFFFF + 1);
        },

        /**
         * Randomises the capitalisation of every alphabetic character in a string
         * using cryptographically secure random decisions. Non-alphabetic characters
         * (digits, dots, plus signs, @ symbols) are passed through unchanged.
         *
         * Used by Generator.run() to apply the "Random Case" option.
         *
         * @param   {string} str - The input string to randomise.
         * @returns {string}       The same string with randomly mixed case.
         *
         * @example
         *   Utils.randomizeCase("newsletter") → "NEwSLEtTeR" (varies each call)
         */
        randomizeCase: function (str) {
            let result = '';
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                if (/[a-zA-Z]/.test(char)) {
                    // Flip case based on a fresh CSPRNG value for each character
                    result += Utils.secureRandom() > 0.5
                        ? char.toUpperCase()
                        : char.toLowerCase();
                } else {
                    result += char;
                }
            }
            return result;
        },

        /**
         * Asynchronously copies a text string to the system clipboard.
         *
         * Strategy:
         *  1. If the Clipboard API is available (modern browsers, secure context),
         *     use navigator.clipboard.writeText() — the preferred approach.
         *  2. Fall back to the legacy document.execCommand('copy') method for
         *     older browsers by temporarily creating a hidden <textarea>.
         *
         * In both cases the result is communicated to the user via the global
         * window.showToast() notification system.
         *
         * @param   {string} text - The text to copy to the clipboard.
         * @returns {Promise<void>}
         */
        copyText: async function (text) {
            // ── Modern Clipboard API path ──────────────────────────────────────
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(text);
                    window.showToast("Copied to clipboard successfully!");
                    return;
                } catch (e) {
                    // Clipboard API rejected (e.g. permission denied) — fall through
                    console.error('[GmailAliasGen] Clipboard API error:', e);
                }
            }

            // ── Legacy execCommand fallback path ───────────────────────────────
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity  = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();

            try {
                document.execCommand('copy');
                window.showToast("Copied to clipboard successfully!");
            } catch (e) {
                // Both clipboard strategies failed — inform the user
                window.showToast("Clipboard access failed. Please copy manually.", true);
            } finally {
                document.body.removeChild(ta);
            }
        }

    };


    /* =========================================================================
       GENERATOR — Core Alias Generation Logic
       =========================================================================
       All methods are pure with respect to DOM; they only receive parameters
       and return values or Promises. Side effects are handled by UI.
    ========================================================================= */

    const Generator = {

        /**
         * Main generation entry point. Runs a synchronous while-loop inside a
         * Promise wrapper so the caller (UI.handleGenerate) can await it without
         * blocking the event loop (the setTimeout in handleGenerate handles the
         * actual async deferral).
         *
         * Algorithm:
         *  1. Build the domain pool (gmail.com and optionally googlemail.com).
         *  2. Build the suffix word list (empty if Plus Trick is off).
         *  3. Loop until the requested `limit` unique emails are produced OR the
         *     safety ceiling is hit OR too many consecutive duplicates occur.
         *  4. For each iteration:
         *       a. Apply the Dot Trick to randomly insert dots into the username.
         *       b. Apply the Plus Trick to append a suffix (random or custom word).
         *       c. Pick a random domain from the pool.
         *       d. Optionally randomise the case of username, suffix, and domain.
         *       e. Assemble the final email string and add it to a Set (dedup).
         *  5. Resolve with the resulting unique email array.
         *
         * @param   {string} baseUser   - The sanitised username (no @ or domain).
         * @param   {number} limit      - Target number of unique aliases to produce.
         * @param   {Object} options    - Feature flags collected from the UI:
         *   @param {boolean} options.useDot          - Enable dot trick.
         *   @param {boolean} options.usePlus         - Enable plus trick.
         *   @param {boolean} options.useGoogle       - Include @googlemail.com domain.
         *   @param {boolean} options.useCase         - Enable random case.
         *   @param {string}  options.suffixType      - 'random' | 'custom'
         *   @param {string}  options.customSuffixInput - Raw comma-separated input.
         *   @param {string|null} options.customDomain - User-provided domain or null.
         * @returns {Promise<string[]>} Resolves with the array of unique alias emails.
         */
        run: function (baseUser, limit, options) {
            return new Promise((resolve, reject) => {
                try {
                    // ES6 Set guarantees uniqueness without extra lookup overhead
                    const results = new Set();

                    // Prepare domain pool and suffix pool from options
                    const domains    = Generator.getDomains(options.customDomain, options.useGoogle);
                    const suffixList = Generator.getSuffixList(options.usePlus, options.suffixType, options.customSuffixInput);

                    let attempts           = 0;
                    let consecutiveFailures = 0;
                    const maxAttempts      = limit * CONFIG.MAX_ATTEMPTS_MULTIPLIER;

                    // Strip any existing dots from the base username before
                    // applying the dot trick so we start from a clean slate
                    baseUser = baseUser.replace(/\./g, '');

                    // ── Main generation loop ────────────────────────────────────
                    while (results.size < limit && attempts < maxAttempts) {
                        attempts++;

                        // Step 1: Apply dot trick (randomly inserts dots into username)
                        let currentUser   = Generator.applyDotTrick(baseUser, options.useDot);

                        // Step 2: Apply plus trick (appends +suffix or empty string)
                        let currentSuffix = Generator.applyPlusTrick(options.usePlus, options.suffixType, suffixList);

                        // Step 3: Pick a random domain from the pool
                        let currentDomain = domains[Math.floor(Utils.secureRandom() * domains.length)];

                        // Step 4: Optional case randomisation across all three parts
                        if (options.useCase) {
                            currentUser = Utils.randomizeCase(currentUser);
                            if (currentSuffix) {
                                currentSuffix = Utils.randomizeCase(currentSuffix);
                            }
                            // Domain case is randomised only ~20% of the time to keep
                            // results realistic and reduce visual noise
                            if (Utils.secureRandom() > 0.8) {
                                currentDomain = Utils.randomizeCase(currentDomain);
                            }
                        }

                        // Step 5: Assemble and deduplicate
                        const email   = `${currentUser}${currentSuffix}@${currentDomain}`;
                        const preSize = results.size;
                        results.add(email);

                        // Anti-freeze protection: if consecutive failures exceed the
                        // threshold, the combination space is exhausted — break early
                        if (results.size === preSize) {
                            consecutiveFailures++;
                            if (consecutiveFailures > CONFIG.MAX_CONSECUTIVE_FAILURES) {
                                break;
                            }
                        } else {
                            consecutiveFailures = 0; // Reset counter on each new unique email
                        }
                    }

                    resolve(Array.from(results));

                } catch (error) {
                    reject(error);
                }
            });
        },

        /**
         * Builds the pool of email domains to use during generation.
         *
         * Rules:
         *  — If the user supplied a custom domain (from a full email input),
         *    that domain is the only entry unless they also enabled @googlemail
         *    AND the custom domain is exactly 'gmail.com'.
         *  — Otherwise, 'gmail.com' is always included; 'googlemail.com' is
         *    added when the @googlemail toggle is checked.
         *
         * @param   {string|null} custom     - User-supplied domain or null.
         * @param   {boolean}     useGoogle  - Whether to include googlemail.com.
         * @returns {string[]}               Non-empty array of domain strings.
         */
        getDomains: function (custom, useGoogle) {
            const arr = [];
            if (custom) {
                arr.push(custom);
                // Only supplement with googlemail.com when custom domain is gmail.com
                if (custom.toLowerCase() === 'gmail.com' && useGoogle) {
                    arr.push('googlemail.com');
                }
            } else {
                arr.push('gmail.com');
                if (useGoogle) {
                    arr.push('googlemail.com');
                }
            }
            return arr;
        },

        /**
         * Builds the list of words used for plus-trick suffixes in 'custom' mode.
         *
         * When Plus Trick is disabled, returns an empty array so the loop
         * produces no suffix at all. When enabled in 'random' mode, returns an
         * empty array because the random string is generated inline in
         * applyPlusTrick(). When in 'custom' mode, parses the user's comma-
         * separated input, trimming whitespace and removing blanks.
         *
         * @param   {boolean} usePlus       - Whether the Plus Trick is enabled.
         * @param   {string}  type          - 'random' | 'custom'
         * @param   {string}  inputVal      - Raw value from the suffix <input>.
         * @returns {string[]}               List of suffix words (may be empty).
         */
        getSuffixList: function (usePlus, type, inputVal) {
            if (!usePlus) return [];

            if (type === 'custom') {
                const raw  = inputVal || '';
                const list = raw.split(',')
                                .map(s => s.trim())
                                .filter(s => s.length > 0);
                // Fall back to the built-in defaults if the input was empty
                return list.length > 0 ? list : CONFIG.DEFAULTS;
            }

            // 'random' mode: the suffix is generated on-the-fly in applyPlusTrick
            return [];
        },

        /**
         * Applies the Dot Trick to the given base username.
         *
         * For each position between adjacent characters, a CSPRNG coin flip
         * decides whether to insert a dot. Dots are never inserted at the
         * end of the string. Usernames of length 1 are returned unchanged
         * because a dot cannot be placed.
         *
         * @param   {string}  base   - The username without any existing dots.
         * @param   {boolean} useDot - Whether the Dot Trick is enabled.
         * @returns {string}           The username with randomly inserted dots.
         *
         * @example
         *   applyDotTrick("johnsmith", true) → "j.oh.ns.mith" (varies each call)
         */
        applyDotTrick: function (base, useDot) {
            if (!useDot || base.length <= 1) return base;

            let res = '';
            for (let i = 0; i < base.length; i++) {
                res += base[i];
                // Insert a dot between this character and the next with 50% probability;
                // never insert after the final character
                if (i < base.length - 1 && Utils.secureRandom() > 0.5) {
                    res += '.';
                }
            }
            return res;
        },

        /**
         * Generates the plus-trick suffix string for a single alias.
         *
         * Returns an empty string when Plus Trick is disabled. In 'random' mode,
         * produces a 5-character alphanumeric tag via Math.random() (sufficient
         * entropy for a non-sensitive suffix). In 'custom' mode, picks a word
         * from the pre-built suffixList using a CSPRNG index.
         *
         * @param   {boolean}  usePlus    - Whether Plus Trick is enabled.
         * @param   {string}   type       - 'random' | 'custom'
         * @param   {string[]} list       - Pre-built list of custom suffix words.
         * @returns {string}               Suffix string starting with '+', or "".
         *
         * @example
         *   applyPlusTrick(true, 'custom', ['work', 'shop']) → "+shop"
         *   applyPlusTrick(true, 'random', [])               → "+k7w2z"
         */
        applyPlusTrick: function (usePlus, type, list) {
            if (!usePlus) return '';

            if (type === 'random') {
                // 5-character random alphanumeric tag (base-36 substring)
                return '+' + Math.random().toString(36).substring(2, 7);
            } else {
                // Pick a word from the custom list using the CSPRNG
                const word = list[Math.floor(Utils.secureRandom() * list.length)];
                return '+' + word;
            }
        }

    };


    /* =========================================================================
       UI — DOM Controller
       =========================================================================
       Responsible for all DOM reads, writes, event bindings, and the
       requestAnimationFrame batched rendering pipeline.
    ========================================================================= */

    const UI = {

        /** Cached DOM element references. Populated once during init(). */
        elements: {},

        /**
         * Initialises the application.
         *  1. Caches all required DOM element references.
         *  2. Binds all event listeners.
         *
         * Called once from the DOMContentLoaded handler at the bottom of this file.
         */
        init: function () {
            // ── Cache DOM Elements ─────────────────────────────────────────────
            // All IDs must match those defined in the HTML. Never rename these.
            this.elements = {
                username   : document.getElementById('username-input'),
                quantity   : document.getElementById('quantity-input'),
                btnGenerate: document.getElementById('btn-generate'),
                btnExport  : document.getElementById('btn-export'),
                btnCopy    : document.getElementById('btn-copy'),
                outputArea : document.getElementById('output-area'),
                countBadge : document.getElementById('count-badge'),
                plusCheck  : document.getElementById('opt-plus'),
                plusPanel  : document.getElementById('plus-options-panel')
            };

            this.bindEvents();
        },

        /**
         * Attaches all user-interaction event listeners.
         *
         * Listeners attached here:
         *  — Plus Trick checkbox → toggles the suffix configuration sub-panel.
         *  — Generate button     → triggers the full generation pipeline.
         *  — Enter key on input  → same as clicking Generate.
         *  — Export button       → triggers .TXT file download.
         *  — Copy All button     → copies the full alias list to the clipboard.
         */
        bindEvents: function () {

            // ── Toggle Suffix Configuration Panel ─────────────────────────────
            // When the Plus Trick checkbox changes state, show or hide the
            // suffix configuration sub-panel (#plus-options-panel).
            this.elements.plusCheck.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.elements.plusPanel.style.display = 'block';
                    this.elements.plusPanel.classList.add('active');
                } else {
                    this.elements.plusPanel.style.display = 'none';
                    this.elements.plusPanel.classList.remove('active');
                }
            });

            // ── Generate Button ────────────────────────────────────────────────
            // Delegates to handleGenerate() which performs validation, state
            // management, async generation, and result rendering.
            this.elements.btnGenerate.addEventListener('click', () => {
                this.handleGenerate();
            });

            // ── Enter Key Shortcut ─────────────────────────────────────────────
            // Pressing Enter while focused on the username input triggers
            // generation — improves keyboard-only usability.
            this.elements.username.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleGenerate();
            });

            // ── Export Button ──────────────────────────────────────────────────
            // Builds a Blob from the current alias list and triggers a browser
            // file download. Delegates to exportFile().
            this.elements.btnExport.addEventListener('click', () => {
                this.exportFile();
            });

            // ── Copy All Button ────────────────────────────────────────────────
            // Joins all generated aliases with newlines and copies to clipboard.
            // If no aliases exist yet, shows a warning toast instead.
            this.elements.btnCopy.addEventListener('click', () => {
                if (state.generatedEmails.length === 0) {
                    window.showToast("Nothing to copy — generate some aliases first.", false, true);
                    return;
                }
                Utils.copyText(state.generatedEmails.join('\n'));
            });

        },

        /**
         * Orchestrates the full alias generation pipeline.
         *
         * Steps:
         *  1. Guard: reject concurrent runs (isGenerating mutex).
         *  2. Read and trim the username/email input.
         *  3. Validate the input; parse domain if a full email was provided.
         *  4. Activate the loading UI state (spinner on button, clear output).
         *  5. Collect all option flags from checkboxes/radios.
         *  6. Defer async execution by 50ms so the spinner renders before the
         *     synchronous generation loop starts.
         *  7. Await Generator.run() and hand results to renderBatchedOutput().
         *  8. Show success or partial-result toast feedback.
         *  9. Restore the button state in the finally block.
         *
         * @returns {Promise<void>}
         */
        handleGenerate: async function () {

            // ── 1. Concurrency Guard ───────────────────────────────────────────
            if (state.isGenerating) return;

            // ── 2. Input Reading ───────────────────────────────────────────────
            const rawInput = this.elements.username.value.trim();

            if (!rawInput) {
                window.showToast("Please enter a username or email address.", true);
                this.elements.username.focus();
                return;
            }

            // ── 3. Input Parsing & Validation ──────────────────────────────────
            let baseUser     = rawInput;
            let customDomain = null;

            if (rawInput.includes('@')) {
                // Full email address provided — validate structure then split
                if (!CONFIG.REGEX.EMAIL_STRUCT.test(rawInput)) {
                    window.showToast("Invalid email format detected. Please check and try again.", true);
                    return;
                }
                const parts  = rawInput.split('@');
                baseUser     = parts[0];
                customDomain = parts[1];
            }

            // Soft warning for unusual characters in the username part
            if (!CONFIG.REGEX.USERNAME.test(baseUser)) {
                window.showToast("Username contains unusual characters — proceeding with caution.", false, true);
            }

            // ── 4. UI Loading State ────────────────────────────────────────────
            this.setLoading(true);

            // ── 5. Collect Options ─────────────────────────────────────────────
            const options = {
                useDot          : document.getElementById('opt-dot').checked,
                usePlus         : document.getElementById('opt-plus').checked,
                useGoogle       : document.getElementById('opt-googlGmail').checked,
                useCase         : document.getElementById('opt-case').checked,
                suffixType      : document.querySelector('input[name="suffix_type"]:checked').value,
                customSuffixInput: document.getElementById('custom-suffixes').value,
                customDomain    : customDomain
            };

            const limit = parseInt(this.elements.quantity.value, 10);

            // ── 6 & 7. Async Execution with 50ms Defer ────────────────────────
            // The 50ms delay gives the browser time to paint the loading spinner
            // before the synchronous generator loop blocks the JS thread.
            setTimeout(async () => {
                try {
                    const results = await Generator.run(baseUser, limit, options);

                    // Persist for Copy All and Export operations
                    state.generatedEmails = results;

                    // Paint results progressively via RAF batches
                    this.renderBatchedOutput(results);

                    // ── 8. Feedback Toast ──────────────────────────────────────
                    if (results.length < limit) {
                        // Fewer aliases than requested: combination space exhausted
                        window.showToast(
                            `Max unique combinations reached: ${results.length.toLocaleString()} aliases generated.`,
                            false,
                            true // warning
                        );
                    } else {
                        window.showToast(
                            `Success! ${results.length.toLocaleString()} aliases generated.`
                        );
                    }

                } catch (e) {
                    console.error('[GmailAliasGen] Generation error:', e);
                    window.showToast("Generation failed: " + e.message, true);
                } finally {
                    // ── 9. Restore Button ──────────────────────────────────────
                    this.setLoading(false);
                }
            }, 50);
        },

        /**
         * Toggles the UI loading state on the Generate button.
         *
         * When entering loading state:
         *  — Stores the button's current innerHTML so it can be restored.
         *  — Replaces the label with a spinning icon and "Processing..." text.
         *  — Disables the button to prevent double-clicks.
         *  — Clears the output area and resets the count badge to 0.
         *  — Sets the isGenerating mutex to true.
         *
         * When exiting loading state:
         *  — Restores the original button innerHTML.
         *  — Re-enables the button.
         *  — Releases the mutex.
         *
         * @param {boolean} isLoading - True to enter loading state; false to exit.
         */
        setLoading: function (isLoading) {
            state.isGenerating   = isLoading;
            const btn            = this.elements.btnGenerate;

            if (isLoading) {
                // Save original label for restoration after generation completes
                btn.dataset.originalText   = btn.innerHTML;
                btn.innerHTML              = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
                btn.disabled               = true;

                // Clear previous results from the terminal output area
                this.elements.outputArea.innerHTML  = '';
                this.elements.countBadge.innerText  = '0';

            } else {
                btn.innerHTML = btn.dataset.originalText;
                btn.disabled  = false;
            }
        },

        /**
         * Renders the generated email list into the terminal output area
         * using batched requestAnimationFrame calls to keep the UI responsive.
         *
         * Each email is rendered as a .Gmail-line <div> containing:
         *  — A .line-num <span> with the 1-based sequential index.
         *  — An .email-text <span> with the alias email address.
         *
         * Clicking any row copies that email to the clipboard (via Utils.copyText)
         * and briefly adds the .copied-active class to the email-text span for
         * a visual confirmation flash.
         *
         * The count badge (#count-badge) is updated after each rendered chunk so
         * the user can see progress in real time during large generation runs.
         *
         * @param {string[]} list - The complete array of generated alias emails.
         */
        renderBatchedOutput: function (list) {
            const container = this.elements.outputArea;
            const total     = list.length;
            let index       = 0;

            /**
             * Renders one chunk of CONFIG.BATCH_SIZE rows, then schedules the
             * next chunk via requestAnimationFrame if more rows remain.
             */
            const renderChunk = () => {
                const fragment  = document.createDocumentFragment();
                const chunkEnd  = Math.min(index + CONFIG.BATCH_SIZE, total);

                for (; index < chunkEnd; index++) {
                    const email = list[index];

                    // ── Build the row element ──────────────────────────────────
                    const div = document.createElement('div');
                    div.className = 'Gmail-line';

                    // Line number prefix (1-based)
                    const numSpan       = document.createElement('span');
                    numSpan.className   = 'line-num';
                    numSpan.textContent = index + 1;

                    // Email address text
                    const textSpan       = document.createElement('span');
                    textSpan.className   = 'email-text';
                    textSpan.textContent = email;

                    div.appendChild(numSpan);
                    div.appendChild(textSpan);

                    // ── Click-to-copy handler ──────────────────────────────────
                    // Using a closure to capture the correct `email` and `textSpan`
                    // references for each row independent of the loop variable.
                    div.onclick = (function (emailAddr, span) {
                        return function () {
                            Utils.copyText(emailAddr);
                            span.classList.add('copied-active');
                            // Remove the highlight class after 1 second
                            setTimeout(() => span.classList.remove('copied-active'), 1000);
                        };
                    }(email, textSpan));

                    fragment.appendChild(div);
                }

                // Append all rows from this chunk in one DOM write (performance)
                container.appendChild(fragment);

                // Update the live count badge with the number of rows painted so far
                this.elements.countBadge.innerText = index.toLocaleString();

                // Schedule the next chunk if there are more rows to render
                if (index < total) {
                    requestAnimationFrame(renderChunk);
                }
            };

            // Kick off the first chunk on the next animation frame
            requestAnimationFrame(renderChunk);
        },

        /**
         * Exports the current alias list as a plain-text (.txt) file download.
         *
         * Creates a Blob from the newline-delimited alias list, generates a
         * temporary object URL, programmatically clicks a hidden <a> element to
         * trigger the browser's Save dialog, then immediately revokes the URL to
         * free memory.
         *
         * Shows a warning toast if no aliases have been generated yet, or an
         * error toast if the Blob/download API fails (e.g. on some old browsers).
         */
        exportFile: function () {

            if (state.generatedEmails.length === 0) {
                window.showToast("Please generate aliases before exporting.", false, true);
                return;
            }

            try {
                // Build a plain-text Blob with one alias per line
                const blob      = new Blob(
                    [state.generatedEmails.join('\n')],
                    { type: 'text/plain' }
                );
                const url       = window.URL.createObjectURL(blob);

                // ISO timestamp in the filename for easy identification
                const timestamp = new Date()
                    .toISOString()
                    .replace(/[:.]/g, '-')
                    .slice(0, 19);

                // Programmatic download via a hidden anchor element
                const a         = document.createElement('a');
                a.href          = url;
                a.download      = `Gmail_Aliases_${timestamp}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Release the object URL to avoid memory leaks
                window.URL.revokeObjectURL(url);

                window.showToast("Export complete! File downloaded successfully.");

            } catch (e) {
                console.error('[GmailAliasGen] Export error:', e);
                window.showToast("Export failed. Your browser may not support file downloads.", true);
            }
        }

    };


    /* =========================================================================
       PUBLIC API
       =========================================================================
       Only `init` is exposed. Everything else is private inside the IIFE.
    ========================================================================= */

    return {
        /**
         * Bootstraps the Gmail Alias Generator Pro application.
         * Called once from the DOMContentLoaded event listener below.
         */
        init: () => UI.init()
    };

})();


/* =============================================================================
   BOOTSTRAP — DOMContentLoaded Entry Point
   =============================================================================
   Defers initialisation until the full DOM is parsed, ensuring all element IDs
   referenced in UI.init() are available before the first getElementById call.
============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    GmailGeneratorApp.init();
});
