/**
 * =============================================================================
 *  TITAN AUTHENTICATOR PRO — ENTERPRISE EDITION (v2.2.0)
 * =============================================================================
 *  Architecture : Zero-Knowledge / 100% Client-Side Encrypted
 *  Security     : AES-256-CBC with PBKDF2 Salted Key Derivation (CryptoJS)
 *  TOTP Engine  : RFC 6238 via OTPAuth.TOTP (otpauth.umd.min.js)
 *  Notifications: Global toast system (window.showToast) — no local toast DOM
 *  Author       : MD KAWSAR
 *  Version      : 2.2.0 (CodeCanyon Release Build)
 *
 *  All logic is encapsulated inside an IIFE (Immediately Invoked Function
 *  Expression) and exposed via the global `TitanApp` namespace. This prevents
 *  any global-scope pollution while keeping inline event handlers (onclick="...")
 *  functional throughout the HTML.
 * =============================================================================
 */

const TitanApp = (() => {

    /* =========================================================================
       SECTION A — CONFIGURATION & PERSISTENT STORAGE KEYS
       =========================================================================
       These keys identify the localStorage slots used by Titan Auth.
       Versioned suffixes (_v2) prevent collisions with older vaults.
    ========================================================================= */

    /** Primary key for the AES-encrypted (or plain) account vault JSON. */
    const DB_KEY       = 'titan_vault_pro_v2';

    /** SHA-256 hash of the user's 4-digit PIN, used for PIN verification. */
    const PIN_HASH_KEY = 'titan_pin_hash_v2';

    /** Random 128-bit salt stored alongside the PIN hash for PBKDF2 key derivation. */
    const SALT_KEY     = 'titan_sec_salt';

    /** Persists the user's dark / light theme preference across sessions. */
    const THEME_KEY    = 'titan_theme_pref';


    /* =========================================================================
       SECTION B — RUNTIME STATE
       =========================================================================
       All mutable state lives here as private variables within the closure.
       Nothing is shared with the global window object except the public API
       returned at the very bottom.
    ========================================================================= */

    /** Decrypted array of account objects: [{ id, issuer, secret }, ...] */
    let accounts      = [];

    /**
     * The PBKDF2-derived AES key string, held in RAM only.
     * Never written to localStorage. If the page refreshes, the user must
     * re-enter the PIN — this is intentional for security.
     */
    let encryptionKey = null;

    /** String accumulator for the 4-digit PIN being entered on the lock screen. */
    let pinBuffer     = "";

    /**
     * Cache map: { [accountId]: OTPAuth.TOTP instance }
     * Prevents creating a new TOTP object on every animation frame.
     */
    let totpCache     = {};

    /** Reference to the active Html5Qrcode camera instance (null when idle). */
    let cameraObj     = null;

    /** Guard flag — prevents duplicate scanner initialisation calls. */
    let isScanning    = false;

    /** Guard flag — prevents duplicate dynamic <script> injection for Html5Qrcode. */
    let isScriptLoading = false;

    /** requestAnimationFrame ID for the live TOTP update loop. */
    let rafId         = null;


    /* =========================================================================
       SECTION C — INITIALISATION
    ========================================================================= */

    /**
     * init()
     * Entry point called by `window.onload = TitanApp.init`.
     * Runs in order:
     *   1. Load and apply the saved theme preference.
     *   2. Disable browser autocomplete/autocorrect on all inputs.
     *   3. Show the lock screen if a PIN is active, or load the vault directly.
     */
    function init() {
        loadTheme();
        preventBrowserAuto();
        checkSecurityLock();
    }

    /**
     * preventBrowserAuto()
     * Sets `autocomplete="new-password"` and `autocorrect="off"` on every input
     * in the document. This prevents browsers from auto-filling OTP secret keys
     * with saved passwords, which could silently corrupt the vault.
     */
    function preventBrowserAuto() {
        document.querySelectorAll('input').forEach(input => {
            input.setAttribute('autocomplete', 'new-password');
            input.setAttribute('autocorrect', 'off');
        });
    }


    /* =========================================================================
       SECTION D — THEME MANAGEMENT
       =========================================================================
       The theme toggle reads/writes the `titan_theme_pref` localStorage key.
       The body's `.light-mode` class is the single source of truth at runtime —
       all CSS variables flip automatically via the [body.light-mode] overrides
       defined in tools-template.css SECTION 1.
    ========================================================================= */

    /**
     * toggleTheme()
     * Flips the dark / light class on <body>, persists the preference,
     * swaps the moon/sun icon, and updates the meta theme-color.
     * Called by the theme toggle button's onclick handler.
     */
    function toggleTheme() {
        const body    = document.body;
        body.classList.toggle('light-mode');
        const isLight = body.classList.contains('light-mode');

        /* Persist user preference to survive page refreshes */
        localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');

        /* Swap the header icon between moon (dark) and sun (light) */
        document.getElementById('theme-icon').className = isLight
            ? 'fa-solid fa-sun'
            : 'fa-solid fa-moon';

        /* Update the PWA/browser chrome status bar colour */
        document.querySelector('meta[name="theme-color"]')
            .setAttribute('content', isLight ? '#f6f8fa' : '#090c10');
    }

    /**
     * loadTheme()
     * Reads the persisted theme preference on startup and applies it silently
     * (without a CSS transition) so there is no flash-of-wrong-theme.
     */
    function loadTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light') {
            document.body.classList.add('light-mode');
            document.getElementById('theme-icon').className = 'fa-solid fa-sun';
            document.querySelector('meta[name="theme-color"]')
                .setAttribute('content', '#f6f8fa');
        }
    }


    /* =========================================================================
       SECTION E — SECURITY CORE (PBKDF2 + AES-256)
    ========================================================================= */

    /**
     * deriveKey(pin, salt)
     * Runs PBKDF2 with 1000 iterations to stretch the 4-digit PIN into a
     * cryptographically strong 256-bit key string, which is then used as the
     * passphrase for CryptoJS AES encryption/decryption.
     *
     * @param  {string} pin  — The 4-digit PIN entered by the user.
     * @param  {string} salt — A random 128-bit hex salt stored in localStorage.
     * @returns {string|null} The derived hex key, or null if CryptoJS is missing.
     */
    function deriveKey(pin, salt) {
        if (!CryptoJS || !CryptoJS.PBKDF2) return null;
        return CryptoJS.PBKDF2(pin, salt, { keySize: 256 / 32, iterations: 1000 }).toString();
    }


    /* =========================================================================
       SECTION F — LOCK SCREEN LOGIC
    ========================================================================= */

    /**
     * checkSecurityLock()
     * Determines whether the vault is PIN-protected.
     * If both a pin hash AND a salt exist in localStorage → show lock screen.
     * Otherwise → skip directly to loadAccounts() and start the TOTP loop.
     */
    function checkSecurityLock() {
        const pinHash = localStorage.getItem(PIN_HASH_KEY);
        const salt    = localStorage.getItem(SALT_KEY);

        if (pinHash && salt) {
            /* PIN is set — reveal lock screen and hide main app */
            document.getElementById('lock-screen').classList.remove('hidden');
            document.getElementById('main-app').style.display = 'none';
        } else {
            /* No PIN — bypass lock screen and load the vault directly */
            document.getElementById('lock-screen').classList.add('hidden');
            document.getElementById('main-app').style.display = 'block';
            loadAccounts();
            startLoop();
        }
    }

    /**
     * handlePinInput(num)
     * Called by each numpad key's onclick handler.
     * Accepts digits 0–9 to build the pinBuffer, or -1 as a backspace signal.
     * Visually updates the PIN dot indicators as digits are typed.
     * When 4 digits are collected, verifyPin() is invoked after a short delay.
     *
     * @param {number} num — A digit (0–9) or -1 for backspace.
     */
    function handlePinInput(num) {
        const dots = document.querySelectorAll('.dot');

        /* -1 signals backspace: remove the last character */
        if (num === -1) {
            pinBuffer = pinBuffer.slice(0, -1);
        } else if (pinBuffer.length < 4) {
            pinBuffer += num;
        }

        /* Update each dot's visual fill state */
        dots.forEach((dot, index) => {
            dot.classList.toggle('filled', index < pinBuffer.length);
        });

        /* Trigger verification once 4 digits have been entered */
        if (pinBuffer.length === 4) {
            setTimeout(verifyPin, 100);
        }
    }

    /**
     * verifyPin()
     * Hashes the current pinBuffer with SHA-256 and compares it against the
     * stored hash. On match: derives the encryption key and unlocks the app.
     * On mismatch: plays a shake animation and resets the buffer.
     */
    function verifyPin() {
        const savedHash = localStorage.getItem(PIN_HASH_KEY);
        const salt      = localStorage.getItem(SALT_KEY);

        /* Compute SHA-256 hash of the entered PIN for comparison */
        const inputHash = CryptoJS.SHA256(pinBuffer).toString();

        if (inputHash === savedHash) {
            /* Correct PIN — derive the PBKDF2 encryption key and unlock */
            encryptionKey = deriveKey(pinBuffer, salt);
            unlockApp();
        } else {
            /* Wrong PIN — shake the display and reset */
            shakePin();
        }
    }

    /**
     * unlockApp()
     * Fades out the lock screen, shows the main app, loads the decrypted vault,
     * and starts the TOTP animation loop.
     */
    function unlockApp() {
        const lockScreen = document.getElementById('lock-screen');

        /* Begin CSS opacity fade-out */
        lockScreen.style.opacity = '0';

        setTimeout(() => {
            lockScreen.classList.add('hidden');
            document.getElementById('main-app').style.display = 'block';
            loadAccounts();

            /* Clear the pinBuffer from memory immediately after unlock */
            pinBuffer = "";
            startLoop();
        }, 400);
    }

    /**
     * shakePin()
     * Provides a CSS transform shake animation on the PIN dot row to signal an
     * incorrect PIN entry. Resets the buffer and dot states after the animation.
     */
    function shakePin() {
        const pinDisplay = document.getElementById('pin-display');

        /* Rapid left-right nudge simulating a "wrong" shake */
        pinDisplay.style.transform = 'translateX(10px)';
        setTimeout(() => { pinDisplay.style.transform = 'translateX(-10px)'; }, 100);
        setTimeout(() => {
            pinDisplay.style.transform = 'translateX(0)';

            /* Reset buffer and clear all filled dots */
            pinBuffer = "";
            document.querySelectorAll('.dot').forEach(dot => dot.classList.remove('filled'));
        }, 200);
    }

    /**
     * resetVault()
     * Nuclear option: asks the user to confirm twice before permanently wiping
     * all localStorage data (vault, PIN hash, salt). Used when the PIN is
     * forgotten and no backup exists. Reloads the page after a full clear.
     */
    function resetVault() {
        if (confirm(
            '⚠️ NUCLEAR OPTION: RESET VAULT?\n\n' +
            'This will PERMANENTLY DELETE all 2FA accounts.\n' +
            'Use this only if you forgot your PIN and have no backup.'
        )) {
            const confirmation = prompt("Type 'RESET' to confirm deletion:");
            if (confirmation === 'RESET') {
                localStorage.clear();
                location.reload();
            }
        }
    }


    /* =========================================================================
       SECTION G — DATA MANAGEMENT (Load & Save Vault)
    ========================================================================= */

    /**
     * loadAccounts()
     * Reads the raw vault string from localStorage.
     * If an encryptionKey is present in RAM, decrypts with AES before parsing.
     * Falls back to plain JSON for legacy or unencrypted vaults.
     * Clears the TOTP cache to prevent stale OTPAuth instances after a reload.
     */
    function loadAccounts() {
        const raw = localStorage.getItem(DB_KEY);
        accounts  = [];
        totpCache = {}; /* Always clear cache on reload to avoid stale tokens */

        if (!raw) return renderList();

        try {
            let jsonStr;

            if (encryptionKey) {
                /* Decrypt AES-256-CBC ciphertext using the PBKDF2-derived key */
                const bytes = CryptoJS.AES.decrypt(raw, encryptionKey);
                jsonStr     = bytes.toString(CryptoJS.enc.Utf8);

                /* An empty string after decryption means the key was wrong */
                if (!jsonStr) throw new Error('Decryption Failed — incorrect key');
            } else {
                /* No PIN set — treat stored data as plain JSON */
                jsonStr = raw;
            }

            accounts = JSON.parse(jsonStr);
        } catch (err) {
            console.error('Titan Vault Error:', err);
            alert('Vault Corrupted or Wrong PIN. Please Reset.');
        }

        renderList();
    }

    /**
     * saveVault()
     * Serialises the `accounts` array to JSON, optionally encrypts it with AES
     * (if encryptionKey is in RAM), then writes the result to localStorage.
     * Re-renders the account list after every successful save.
     */
    function saveVault() {
        try {
            let dataToSave;

            if (encryptionKey) {
                /* Encrypt with AES-256-CBC using the in-memory PBKDF2 key */
                dataToSave = CryptoJS.AES.encrypt(
                    JSON.stringify(accounts),
                    encryptionKey
                ).toString();
            } else {
                /* No PIN — store plain JSON (less secure, but user's choice) */
                dataToSave = JSON.stringify(accounts);
            }

            localStorage.setItem(DB_KEY, dataToSave);
            renderList();
        } catch (err) {
            /* Most likely cause: localStorage quota exceeded */
            alert('Storage Limit Reached! Please delete unused accounts.');
        }
    }

    /**
     * addManualAccount()
     * Validates the issuer name and Base32 secret key entered manually.
     * Normalises the secret (strip spaces/hyphens, uppercase), validates it via
     * OTPAuth, checks for duplicates, then saves the new account to the vault.
     * Shows a global success toast on completion.
     */
    function addManualAccount() {
        const issuerInput = document.getElementById('inp-issuer');
        const secretInput = document.getElementById('inp-secret');

        /* Use "Unknown Service" as a fallback if no name was entered */
        const issuer = issuerInput.value.trim() || 'Unknown Service';

        /* Normalise secret: remove spaces and hyphens, convert to uppercase */
        const secret = secretInput.value.trim().replace(/[\s\-]/g, '').toUpperCase();

        if (!secret) {
            return alert('Secret key is required.');
        }

        try {
            /* Validate the Base32 secret by attempting to construct a TOTP instance */
            new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });

            /* Prevent adding a duplicate account with the same secret key */
            if (accounts.some(acc => acc.secret === secret)) {
                return alert('Account already exists.');
            }

            /* Push the new account and persist to localStorage */
            accounts.push({ id: Date.now(), issuer, secret });
            saveVault();

            /* Clear the input fields and collapse the add panel */
            issuerInput.value = '';
            secretInput.value = '';
            toggleAddMenu();

            /* Notify the user via the global toast system */
            window.showToast('✅ Account Secured to Vault');

        } catch (err) {
            alert('Invalid Base32 Secret Key. Please check and try again.');
        }
    }

    /**
     * deleteAccount(id)
     * Asks the user to confirm before permanently removing an account from the
     * vault. Cleans up the corresponding TOTP cache entry to prevent memory leaks.
     *
     * @param {number} id — The unique timestamp-based ID of the account to remove.
     */
    function deleteAccount(id) {
        if (confirm('Delete this account permanently? This cannot be undone.')) {
            /* Filter the account out of the array */
            accounts = accounts.filter(acc => acc.id !== id);

            /* Remove the cached OTPAuth instance for this account */
            delete totpCache[id];

            saveVault();
        }
    }


    /* =========================================================================
       SECTION H — RENDERER
       Dynamically builds the account list DOM from the `accounts` array.
    ========================================================================= */

    /**
     * renderList(filter)
     * Clears and re-renders the account list container, applying an optional
     * case-insensitive filter. Uses a DocumentFragment for efficient batch DOM
     * insertion. Toggles the empty-state notice based on result count.
     *
     * @param {string} [filter=''] — Optional search string to filter by issuer name.
     */
    function renderList(filter = '') {
        const listContainer = document.getElementById('account-list-container');
        listContainer.innerHTML = '';

        /* Filter accounts by issuer name (case-insensitive) */
        const filtered = accounts.filter(acc =>
            acc.issuer.toLowerCase().includes(filter.toLowerCase())
        );

        /* Show or hide the empty-state placeholder */
        document.getElementById('empty-state').classList.toggle('hidden', filtered.length > 0);

        /* Build a document fragment for efficient batch insert */
        const fragment = document.createDocumentFragment();

        filtered.forEach(acc => {
            const el        = document.createElement('div');
            el.className    = 'account-item animated-entry';

            /* Resolve the FontAwesome brand icon for known services */
            const brandIcon = getBrandIcon(acc.issuer);

            /*
             * Build the card's inner HTML.
             * IMPORTANT: acc.issuer is intentionally NOT interpolated here to
             * prevent XSS. It is injected safely via .textContent below.
             */
            el.innerHTML = `
                <div class="acc-main">
                    <div class="acc-icon">${brandIcon}</div>
                    <div class="acc-details">
                        <h4 class="acc-name"></h4>
                        <p style="font-family:monospace; color:var(--text-muted); font-size:11px;">
                            ***-${acc.secret.slice(-4)}
                        </p>
                    </div>
                    <div class="otp-section">
                        <div class="otp-code" id="otp-${acc.id}" onclick="TitanApp.copyCode(this, '${acc.id}')">
                            <span>000</span><span>000</span>
                        </div>
                        <svg class="timer-svg" viewBox="0 0 36 36" aria-hidden="true">
                            <path class="timer-bg"
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831
                                     a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="timer-progress" id="ring-${acc.id}"
                                  stroke-dasharray="100, 100"
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831
                                     a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                    </div>
                </div>
                <div class="acc-actions">
                    <button onclick="TitanApp.copyToClipboard('${acc.id}')">
                        <i class="fa-regular fa-copy"></i> Copy
                    </button>
                    <button onclick="TitanApp.deleteAccount(${acc.id})">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            `;

            /*
             * XSS-Safe injection:
             * Set the account name via textContent (not innerHTML) so that any
             * special characters in the issuer name cannot be interpreted as HTML.
             */
            el.querySelector('.acc-name').textContent = acc.issuer;

            fragment.appendChild(el);
        });

        listContainer.appendChild(fragment);

        /* Immediately populate the OTP codes & rings after render */
        updateTick();
    }

    /**
     * getBrandIcon(name)
     * Maps common service names to their FontAwesome brand icon class.
     * Falls back to the initial letter of the service name for unknown services.
     *
     * @param  {string} name — The issuer/service name string.
     * @returns {string} An HTML string: either a <i class="fa-brands ..."> or a <span>.
     */
    function getBrandIcon(name) {
        const n = name.toLowerCase();

        /* Known service → FontAwesome brand icon map */
        const iconMap = {
            'google'    : 'fa-google',
            'facebook'  : 'fa-facebook',
            'twitter'   : 'fa-twitter',
            'binance'   : 'fa-bitcoin',
            'discord'   : 'fa-discord',
            'github'    : 'fa-github',
            'amazon'    : 'fa-amazon',
            'microsoft' : 'fa-microsoft',
            'apple'     : 'fa-apple',
            'instagram' : 'fa-instagram',
            'linkedin'  : 'fa-linkedin',
            'telegram'  : 'fa-telegram',
            'paypal'    : 'fa-paypal',
            'coinbase'  : 'fa-bitcoin'
        };

        for (const keyword in iconMap) {
            if (n.includes(keyword)) {
                return `<i class="fa-brands ${iconMap[keyword]}"></i>`;
            }
        }

        /* Fallback: display the first letter of the service name in bold */
        return `<span style="font-weight:800;">${name.charAt(0).toUpperCase()}</span>`;
    }


    /* =========================================================================
       SECTION I — TOTP ENGINE (Live Update Loop)
    ========================================================================= */

    /**
     * startLoop()
     * Starts a requestAnimationFrame loop that continuously updates the OTP
     * codes and countdown rings for all visible account cards.
     * Pauses automatically when the tab is hidden (Page Visibility API).
     * Cancels any existing loop before starting a new one to prevent duplicates.
     */
    function startLoop() {
        if (rafId) cancelAnimationFrame(rafId);

        function loop() {
            /* Only update DOM when the tab is visible and accounts exist */
            if (document.visibilityState === 'visible' && accounts.length > 0) {
                updateTick();
            }
            rafId = requestAnimationFrame(loop);
        }

        loop();
    }

    /**
     * updateTick()
     * Called on every animation frame (or after renderList).
     * For each account:
     *   1. Calculates the remaining seconds in the current 30-second TOTP window.
     *   2. Updates the SVG ring stroke-dashoffset to animate the countdown arc.
     *   3. Turns the ring red when fewer than 5 seconds remain.
     *   4. Generates the current TOTP token and updates the DOM only if changed
     *      (minimises reflows by checking existing textContent first).
     */
    function updateTick() {
        const period    = 30; /* TOTP standard window: 30 seconds */
        const remaining = period - (Date.now() / 1000) % period;
        const offset    = ((period - remaining) / period) * 100;

        accounts.forEach(acc => {
            /* ── Ring Update ── */
            const ring = document.getElementById(`ring-${acc.id}`);
            if (ring) {
                ring.style.strokeDashoffset = offset;

                /* Flash red as a warning when fewer than 5 seconds remain */
                ring.style.stroke = remaining < 5
                    ? '#ff0055'
                    : 'var(--accent-cyan)';
            }

            /* ── OTP Code Update ── */
            const codeEl = document.getElementById(`otp-${acc.id}`);
            if (codeEl) {
                /* Lazily create the OTPAuth instance and cache it */
                if (!totpCache[acc.id]) {
                    totpCache[acc.id] = new OTPAuth.TOTP({
                        secret: OTPAuth.Secret.fromBase32(acc.secret)
                    });
                }

                const token = totpCache[acc.id].generate();
                const part1 = token.slice(0, 3);
                const part2 = token.slice(3);

                /* Only touch the DOM if the token has actually changed */
                if (codeEl.children[0].textContent !== part1) {
                    codeEl.children[0].textContent = part1;
                    codeEl.children[1].textContent = part2;
                }
            }
        });
    }


    /* =========================================================================
       SECTION J — QR CODE SCANNER
       Dynamically loads the Html5Qrcode library on first use (lazy loading)
       to avoid blocking the initial page load with a heavy camera script.
    ========================================================================= */

    /**
     * startScanner()
     * Opens the full-screen scanner overlay and initialises the camera.
     * If the Html5Qrcode library has not yet been loaded, dynamically injects
     * the script tag and chains initCamera() to its onload callback.
     * Detects mobile devices and shows a toast warning if the camera API
     * may be unavailable (e.g., iOS WebView without camera permission).
     */
    async function startScanner() {
        if (isScanning) return;

        /* Show the scanner overlay and the loading spinner */
        const overlay = document.getElementById('scanner-overlay');
        overlay.classList.remove('hidden');
        document.getElementById('scan-spinner').classList.remove('hidden');

        /* Warn mobile users that camera access requires HTTPS and permissions */
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile && !navigator.mediaDevices) {
            window.showToast(
                'Camera API unavailable. Please use HTTPS or try uploading a QR image instead.',
                true
            );
            closeScanner();
            return;
        }

        if (typeof Html5Qrcode === 'undefined') {
            /* Library not yet loaded — inject script tag dynamically */
            if (isScriptLoading) return;
            isScriptLoading = true;

            const script    = document.createElement('script');
            script.src      = '../../assets/library/qr-engine/html5-qrcode/html5-qrcode.min.js';
            script.onload   = () => { isScriptLoading = false; initCamera(); };
            script.onerror  = () => {
                window.showToast('Failed to load Camera Library. Please try again.', true);
                stopScanner();
            };
            document.head.appendChild(script);
        } else {
            /* Library already loaded — initialise camera immediately */
            initCamera();
        }
    }

    /**
     * initCamera()
     * Starts the Html5Qrcode camera stream on the #reader element.
     * Uses the back-facing environment camera at 10 fps with a 250×250 QR box.
     * On successful decode, hands the URI to handleScan() and closes the overlay.
     */
    function initCamera() {
        const html5QrCode = new Html5Qrcode('reader');
        cameraObj         = html5QrCode;
        isScanning        = true;

        html5QrCode.start(
            { facingMode: 'environment' },                /* Prefer rear camera */
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => { handleScan(decodedText); stopScanner(); }, /* Success */
            () => { /* Per-frame error — ignore, normal during scanning */  }
        ).then(() => {
            /* Camera stream started — hide the spinner */
            document.getElementById('scan-spinner').classList.add('hidden');
        }).catch(() => {
            window.showToast('Camera Error: Permission denied or unavailable.', true);
            stopScanner();
        });
    }

    /**
     * stopScanner()
     * Gracefully stops the active camera stream and clears the Html5Qrcode
     * instance before hiding the overlay and resetting scanner state.
     */
    function stopScanner() {
        if (cameraObj) {
            cameraObj.stop()
                .then(() => { cameraObj.clear(); closeScanner(); })
                .catch(() => closeScanner()); /* If stop() fails, close anyway */
        } else {
            closeScanner();
        }
    }

    /**
     * closeScanner()
     * Hides the scanner overlay DOM element and resets camera-related state
     * variables so the scanner can be reopened cleanly on the next invocation.
     */
    function closeScanner() {
        document.getElementById('scanner-overlay').classList.add('hidden');
        cameraObj  = null;
        isScanning = false;
    }

    /**
     * handleScan(uri)
     * Parses an otpauth:// URI decoded from a QR code.
     * Extracts `secret` and `issuer` query parameters and pre-fills the
     * manual entry form. Opens the Add panel if it is currently collapsed.
     * Shows a global success toast to confirm the data was captured.
     *
     * @param {string} uri — The raw string decoded from the QR code.
     */
    function handleScan(uri) {
        try {
            if (uri.startsWith('otpauth://')) {
                const url    = new URL(uri);
                const secret = url.searchParams.get('secret');
                const issuer = url.searchParams.get('issuer') || 'Scanned Account';

                if (secret) {
                    /* Pre-fill the manual entry fields */
                    document.getElementById('inp-issuer').value =
                        decodeURIComponent(issuer);
                    document.getElementById('inp-secret').value =
                        secret.replace(/[\s\-]/g, '');

                    /* Expand the Add panel if it is currently collapsed */
                    if (!document.getElementById('add-card').classList.contains('expanded')) {
                        toggleAddMenu();
                    }

                    window.showToast('QR Data Captured — Review and Save.');
                }
            } else {
                alert('Invalid QR Code: Not an otpauth:// URI.');
            }
        } catch (err) {
            alert('Error parsing QR code URI. Please try manual entry.');
        }
    }

    /**
     * processQrImage(input)
     * Handles QR code detection from a static image file selected by the user.
     * If the Html5Qrcode library is not yet loaded, it triggers a load via
     * startScanner()+stopScanner() (which does NOT open the camera) and
     * instructs the user to retry after the library has initialised.
     *
     * @param {HTMLInputElement} input — The file input element with files[0] set.
     */
    function processQrImage(input) {
        if (!input.files || !input.files[0]) return;

        if (typeof Html5Qrcode === 'undefined') {
            /* Library not yet available — trigger lazy-load without opening camera */
            window.showToast(
                'Library loading — please wait a moment and try the Upload again.',
                true
            );
            startScanner();
            stopScanner();
            input.value = '';
            return;
        }

        const html5QrCode = new Html5Qrcode('reader');

        html5QrCode.scanFile(input.files[0], /* showImage: */ true)
            .then(decodedText => handleScan(decodedText))
            .catch(() => {
                window.showToast('Could not read QR from image. Please try a clearer photo.', true);
            });

        input.value = ''; /* Reset so the same file can be re-selected */
    }


    /* =========================================================================
       SECTION K — UI HELPERS
    ========================================================================= */

    /**
     * toggleAddMenu()
     * Expands or collapses the "Add Account" panel by toggling the .expanded
     * class on #add-card. Also syncs the .active highlight on the "Add" tab
     * button. Focuses the issuer input field after the expand animation.
     */
    function toggleAddMenu() {
        const card  = document.getElementById('add-card');
        const btn   = document.getElementById('btn-add');
        const isNowExpanded = card.classList.toggle('expanded');

        /* Keep the Add tab button highlighted while the panel is open */
        btn.classList.toggle('active', isNowExpanded);

        /* Auto-focus the issuer field after the CSS transition completes */
        if (isNowExpanded) {
            setTimeout(() => document.getElementById('inp-issuer').focus(), 300);
        }
    }

    /**
     * copyCode(element, id)
     * Adds a visual .revealed flash to the OTP code element (turns it green)
     * for 5 seconds, then delegates the actual clipboard write to copyToClipboard().
     *
     * @param {HTMLElement} element — The .otp-code div that was clicked.
     * @param {string}      id      — The account ID whose token should be copied.
     */
    function copyCode(element, id) {
        element.classList.add('revealed');
        setTimeout(() => element.classList.remove('revealed'), 5000);
        copyToClipboard(id);
    }

    /**
     * copyToClipboard(id)
     * Finds the account by ID, generates its current TOTP token, writes it to
     * the system clipboard via the Clipboard API, and shows a global success toast.
     *
     * @param {string|number} id — The unique account ID.
     */
    function copyToClipboard(id) {
        const acc = accounts.find(a => a.id == id);

        if (acc && totpCache[id]) {
            const token = totpCache[id].generate();

            navigator.clipboard.writeText(token).then(() => {
                /* Global toast system — shows the copied token for confirmation */
                window.showToast(`Copied: ${token}`);
            });
        }
    }

    /**
     * pasteClipboard()
     * Reads the current clipboard text and pastes it into the #inp-secret field.
     * Provides a fallback message if the Clipboard API permission is denied.
     */
    function pasteClipboard() {
        navigator.clipboard.readText().then(text => {
            document.getElementById('inp-secret').value = text;
        }).catch(() => {
            alert('Paste permission denied. Please use Ctrl+V / Cmd+V.');
        });
    }

    /**
     * filterAccounts(value)
     * Thin wrapper called by the search input's onkeyup handler.
     * Passes the search string to renderList() for live filtering.
     *
     * @param {string} value — The current value of the search input field.
     */
    function filterAccounts(value) {
        renderList(value);
    }


    /* =========================================================================
       SECTION L — IMPORT / EXPORT (Vault Backup & Restore)
    ========================================================================= */

    /**
     * exportVault()
     * Serialises the current `accounts` array to a JSON string, encodes it as a
     * data URI, and triggers a browser download named with today's date.
     * NOTE: The exported JSON is UNENCRYPTED intentionally — it is a plain backup
     * that can be read without the PIN. The user is warned before proceeding.
     */
    function exportVault() {
        if (!accounts.length) {
            return alert('Vault is empty. Nothing to export.');
        }

        if (!confirm(
            'Export Unencrypted Backup JSON?\n\n' +
            'IMPORTANT: Keep this file secure — it contains your raw secret keys.'
        )) return;

        /* Build a data URI from the JSON payload */
        const dataUri = 'data:text/json;charset=utf-8,' +
            encodeURIComponent(JSON.stringify(accounts));

        /* Create a temporary anchor and trigger the download */
        const anchor      = document.createElement('a');
        anchor.href       = dataUri;
        anchor.download   = `Titan_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    /**
     * importVault(input)
     * Reads a .json backup file selected by the user, validates its structure,
     * then lets the user choose between two restore modes:
     *
     *   REPLACE — Wipes the current vault and loads all accounts from the file.
     *   MERGE   — Preserves existing accounts and appends new unique ones from
     *             the file (deduplication is based on the secret key).
     *
     * The TOTP cache is cleared after any import to force fresh instance creation.
     *
     * @param {HTMLInputElement} input — The file input element with files[0] set.
     */
    function importVault(input) {
        const file = input.files[0];
        if (!file) return;

        const reader    = new FileReader();

        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);

                /* Basic structural validation — must be an array of account objects */
                if (!Array.isArray(json)) {
                    alert('Invalid Backup File: Expected a JSON array of accounts.');
                    return;
                }

                /* Prompt the user to choose a merge strategy */
                const mode = prompt(
                    "Type 'MERGE' to add imported accounts to the existing vault,\n" +
                    "or type 'REPLACE' to wipe the vault and load the backup:"
                );

                if (!mode) return; /* User cancelled the prompt */

                const normalised = mode.trim().toUpperCase();

                if (normalised === 'REPLACE') {
                    /*
                     * REPLACE MODE:
                     * Completely overwrite the vault with the backup data.
                     * Ensures every account has a unique ID by generating one
                     * if the backup file's entry is missing an ID field.
                     */
                    accounts = json.map(acc => ({
                        ...acc,
                        id: acc.id || Date.now() + Math.random()
                    }));

                    totpCache = {}; /* Clear stale OTPAuth instances */
                    saveVault();
                    alert('Vault Replaced Successfully.');

                } else if (normalised === 'MERGE') {
                    /*
                     * MERGE MODE:
                     * Only add accounts whose secret key does not already
                     * exist in the current vault (prevents duplicates).
                     */
                    let importedCount = 0;

                    json.forEach(item => {
                        if (!accounts.some(acc => acc.secret === item.secret)) {
                            item.id = item.id || Date.now() + Math.random();
                            accounts.push(item);
                            importedCount++;
                        }
                    });

                    totpCache = {}; /* Clear stale OTPAuth instances */
                    saveVault();
                    alert(`Import Complete: Merged ${importedCount} new account(s).`);

                } else {
                    alert("Action cancelled. Please type 'MERGE' or 'REPLACE'.");
                }

            } catch (err) {
                console.error('Titan Import Error:', err);
                alert('Error: Could not parse the JSON file. Make sure it is a valid Titan Backup.');
            }
        };

        reader.readAsText(file);

        /* Reset the input so the same file can be re-selected if needed */
        input.value = '';
    }


    /* =========================================================================
       SECTION M — SECURITY SETTINGS (PIN Management)
    ========================================================================= */

    /**
     * openSecuritySettings()
     * Toggle function for the PIN protection state.
     *
     * If a PIN already exists:
     *   → Prompts to verify the current PIN, then removes encryption and
     *     re-saves the vault in plain JSON (less secure).
     *
     * If no PIN exists:
     *   → Walks the user through setting a new 4-digit PIN:
     *       1. Enter PIN  →  confirm PIN  →  generate random salt
     *       2. Derive PBKDF2 key from PIN + salt
     *       3. Store SHA-256(PIN) hash + salt in localStorage
     *       4. Re-save the vault encrypted with the new key
     */
    function openSecuritySettings() {
        const hasPin = localStorage.getItem(PIN_HASH_KEY);

        if (hasPin) {
            /* ── REMOVE PIN PATH ── */
            if (confirm(
                'Remove PIN Protection?\n\n' +
                'WARNING: Your data will be re-saved without encryption (less secure).'
            )) {
                const enteredPin = prompt('Enter current PIN to confirm removal:');
                const enteredHash = CryptoJS.SHA256(enteredPin).toString();

                if (enteredHash === localStorage.getItem(PIN_HASH_KEY)) {
                    /* Correct PIN — clear the encryption key and security keys */
                    encryptionKey = null;
                    localStorage.removeItem(PIN_HASH_KEY);
                    localStorage.removeItem(SALT_KEY);

                    /* Re-save vault as plain JSON without encryption */
                    saveVault();
                    alert('PIN Removed. Vault is now unencrypted.');
                } else {
                    alert('Incorrect PIN. No changes were made.');
                }
            }

        } else {
            /* ── SET NEW PIN PATH ── */
            const newPin = prompt('Set a new 4-digit PIN (digits only):');

            if (newPin && newPin.length === 4 && !isNaN(newPin)) {
                const confirmPin = prompt('Confirm PIN:');

                if (newPin === confirmPin) {
                    /* Generate a unique 128-bit random salt for this vault */
                    const salt    = CryptoJS.lib.WordArray.random(128 / 8).toString();
                    const derived = deriveKey(newPin, salt);

                    /* Persist the PIN hash and salt (never store the PIN itself) */
                    localStorage.setItem(PIN_HASH_KEY, CryptoJS.SHA256(newPin).toString());
                    localStorage.setItem(SALT_KEY, salt);

                    /* Update in-memory key and re-save vault with new encryption */
                    encryptionKey = derived;
                    saveVault();
                    alert('Vault Secured! AES-256 + PBKDF2 encryption is now active.');

                } else {
                    alert('PIN Mismatch. Please try again.');
                }

            } else if (newPin !== null) {
                alert('PIN must be exactly 4 numeric digits.');
            }
        }
    }


    /* =========================================================================
       SECTION N — PUBLIC API
       Only the methods listed here are accessible via `TitanApp.xxx()` from
       inline onclick handlers in the HTML. Everything else remains private.
    ========================================================================= */

    return {
        init,
        toggleTheme,
        handlePinInput,
        resetVault,
        addManualAccount,
        deleteAccount,
        startScanner,
        stopScanner,
        processQrImage,
        toggleAddMenu,
        copyCode,
        copyToClipboard,
        pasteClipboard,
        filterAccounts,
        exportVault,
        importVault,
        openSecuritySettings
    };

})();

/* =============================================================================
   BOOT
   Deferred until the DOM and all deferred scripts (CryptoJS, OTPAuth) have
   fully loaded, ensuring the vault libraries are available before init() runs.
============================================================================= */
window.onload = TitanApp.init;
