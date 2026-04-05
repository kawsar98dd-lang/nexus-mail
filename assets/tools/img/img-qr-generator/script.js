/**
 * ============================================================================
 * QR CODE ULTRA PRO MAX — Enterprise Edition v3.0
 * ============================================================================
 * File      : script.js
 * Project   : Trusted Tools Web by MD KAWSAR
 * Purpose   : Manages the complete client-side QR lifecycle:
 *               1. Mode switching (12 input types + scanner)
 *               2. Data extraction and validation per QR type
 *               3. Canvas-based QR post-processing (gradients, logos, CTA text)
 *               4. QR scanning via html5-qrcode (camera + file upload)
 *               5. LocalStorage history management
 *               6. Download / Print / Clipboard export utilities
 *
 * Dependencies:
 *   • QRCode.js       (qrcodejs)   — QR image generation
 *   • Html5Qrcode     (html5-qrcode) — QR scanning
 *   • window.showToast()           — Global toast system (injected by global.js)
 *
 * Architecture: IIFE Module Pattern — all private logic is encapsulated inside
 *               the QRApp IIFE; only the public API object is exposed globally
 *               so that HTML onclick handlers can call QRApp.generateQR() etc.
 * ============================================================================
 */

const QRApp = (function() {

    // ========================================================================
    // SECTION A: CONFIGURATION CONSTANTS
    // Static values that control default behaviour. Change here only.
    // ========================================================================

    const CONFIG = {
        defaultSize       : 1000,      // Default QR pixel size (Ultra 1000px)
        defaultCorrection : 'H',       // Default error correction level (High = 30%)
        historyKey        : 'qrHistory_v3', // localStorage key for history array
        maxHistory        : 15         // Maximum history items to retain
    };


    // ========================================================================
    // SECTION B: MUTABLE APPLICATION STATE
    // Centralised state object — avoids scattered global variables.
    // ========================================================================

    const state = {
        currentMode   : 'text',        // Active QR type / tab
        html5QrCode   : null,          // html5-qrcode instance (created on scanner init)
        qrContainer   : document.getElementById("qrcode"), // Output DOM node for QR image
        isScanning    : false,         // Whether the camera is currently streaming
        toastTimeout  : null           // Timer ref used by the global toast (safety guard)
    };


    // ========================================================================
    // SECTION C: INITIALISATION
    // Fires once on DOMContentLoaded. Bootstraps all subsystems.
    // ========================================================================

    document.addEventListener('DOMContentLoaded', () => {

        // Restore history from localStorage and render the list
        loadHistory();

        // Bind persistent event listeners (logo upload, checkbox toggles)
        initEventListeners();

        // Set default tab to "text" mode
        setMode('text');

        // Allow keyboard users to generate QR by pressing Enter in any input field
        document.getElementById('generator-inputs').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') generateQR();
        });
    });


    // ========================================================================
    // SECTION D: GLOBAL EVENT LISTENERS
    // Binds logic to persistent UI controls that exist regardless of active mode.
    // ========================================================================

    /**
     * initEventListeners()
     * Sets up:
     *   - Logo input → auto-regenerate QR when a new image is selected
     *   - Transparent BG checkbox → toggle checkerboard preview + color input visibility
     *   - Gradient checkbox → enable/disable the gradient end-color picker
     */
    function initEventListeners() {

        // ── Logo Upload: auto-regenerate on file select ──
        const logoInput = document.getElementById("logo-input");
        if (logoInput) {
            logoInput.addEventListener('change', () => {
                if (logoInput.files && logoInput.files[0]) generateQR();
            });
        }

        // ── Transparent Background Toggle ──
        // When checked  → hide BG color picker and add checkerboard class to wrapper
        // When unchecked → reveal BG color picker so user can choose a solid background
        const transCheck = document.getElementById('transparent-bg');
        const bgWrap     = document.getElementById('bg-color-wrap');
        const wrapper    = document.getElementById('qr-wrapper');

        if (transCheck && bgWrap) {
            transCheck.addEventListener('change', function() {
                // utility-class-hidden is toggled by JS (DO NOT rename class)
                bgWrap.classList.toggle('utility-class-hidden', this.checked);
                if (this.checked) {
                    wrapper.classList.add('transparent-bg');
                } else {
                    wrapper.classList.remove('transparent-bg');
                }
            });
        }

        // ── Gradient Toggle ──
        // Enables or disables the gradient end-colour input visually
        const gradCheck = document.getElementById('use-gradient');
        const gradInput = document.getElementById('color-gradient');
        if (gradCheck && gradInput) {
            gradCheck.addEventListener('change', function() {
                gradInput.disabled    = !this.checked;
                gradInput.style.opacity = this.checked ? "1" : "0.5";
            });
        }
    }


    // ========================================================================
    // SECTION E: MODE SWITCHER
    // Controls which input panel is visible and whether generator or scanner UI
    // is displayed.
    // ========================================================================

    /**
     * setMode(mode)
     * Switches the active QR generation mode.
     *
     * Steps:
     *   1. Update state.currentMode
     *   2. Highlight the matching tab button (aria + class)
     *   3. Toggle between generator view and scanner view
     *   4. Show only the input panel for the selected mode
     *
     * @param {string} mode - One of: 'text', 'social', 'vcard', 'wifi', 'whatsapp',
     *                        'event', 'paypal', 'crypto', 'zoom', 'maps', 'email', 'scanner'
     */
    function setMode(mode) {
        state.currentMode = mode;

        // ── Step 1: Update Tab Active State ──
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });

        // Find the tab whose onclick attribute references this mode string
        const activeBtn = document.querySelector(`.tab-btn[onclick*="'${mode}'"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.setAttribute('aria-selected', 'true');
        }

        // ── Step 2: Toggle Generator vs Scanner View ──
        const genInputs  = document.getElementById('generator-inputs');
        const genWrap    = document.getElementById('generator-wrapper');
        const scannerWrap = document.getElementById('type-scanner');

        if (mode === 'scanner') {
            // Hide generator UI and reveal scanner panel
            genInputs.classList.add('utility-class-hidden');
            genWrap.classList.add('utility-class-hidden');
            scannerWrap.classList.remove('utility-class-hidden');
            initScanner(); // Start camera / file-scan listeners
        } else {
            // Stop any active camera stream and restore generator UI
            stopScanner();
            genInputs.classList.remove('utility-class-hidden');
            genWrap.classList.remove('utility-class-hidden');
            scannerWrap.classList.add('utility-class-hidden');
        }

        // ── Step 3: Show Only the Correct Input Panel ──
        // Hide every known input type panel first
        const inputGroups = ['text', 'wifi', 'email', 'whatsapp', 'vcard',
                             'maps', 'crypto', 'event', 'paypal', 'zoom', 'social'];
        inputGroups.forEach(id => {
            document.getElementById(`type-${id}`)?.classList.add('utility-class-hidden');
        });

        // Reveal the target panel for the selected mode
        document.getElementById(`type-${mode}`)?.classList.remove('utility-class-hidden');
    }


    // ========================================================================
    // SECTION F: QR SCANNER MODULE
    // Uses the html5-qrcode library to handle both live-camera and
    // file-upload scanning paths.
    // ========================================================================

    /**
     * initScanner()
     * Initialises the html5-qrcode engine inside the #reader DOM element.
     *
     * Handles two scanning paths:
     *   A) File Upload — user selects a QR image from their device
     *   B) Camera     — requests getUserMedia and starts live scanning
     *
     * Guards against double-init with state.isScanning flag.
     */
    async function initScanner() {
        if (state.isScanning) return; // Prevent duplicate camera streams

        // Clean up any previous html5-qrcode instance to release camera
        if (state.html5QrCode) {
            try { await state.html5QrCode.stop(); } catch(e) { /* silent cleanup */ }
        }

        // Mount a new scanner instance targeting the #reader div
        state.html5QrCode = new Html5Qrcode("reader");

        // ── Path A: File Upload Scanning ──
        const fileInput = document.getElementById('qr-input-file');
        if (fileInput) {
            fileInput.value = ''; // Reset to allow same-file re-selection
            fileInput.onchange = e => {
                if (e.target.files.length === 0) return;

                // scanFile() decodes a static QR image — no camera required
                state.html5QrCode.scanFile(e.target.files[0], true)
                    .then(decodedText => {
                        displayScanResult(decodedText);
                    })
                    .catch(() => {
                        // Use global toast with error flag = true
                        window.showToast("Error: Invalid or unreadable QR image.", true);
                    });
            };
        }

        // ── Path B: Live Camera Scanning ──
        try {
            const cameras = await Html5Qrcode.getCameras();

            if (cameras && cameras.length) {
                state.isScanning = true;

                // Show the "Stop Camera" button once streaming begins
                document.getElementById('btn-stop-scan').style.display = 'inline-block';

                // Start scanning using the rear-facing (environment) camera
                await state.html5QrCode.start(
                    { facingMode: "environment" },              // Prefer back camera
                    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                    (decodedText) => {
                        // Success callback — display result and stop stream
                        displayScanResult(decodedText);
                        window.showToast("QR Code Detected!");
                        stopScanner(); // Auto-stop after first successful scan
                    },
                    () => { /* Ignore per-frame decode failures — they are expected */ }
                );

            } else {
                window.showToast("No cameras found on this device.", true);
            }

        } catch (err) {
            console.error("Camera Error:", err);
            window.showToast("Camera access denied or unavailable.", true);
            state.isScanning = false;
        }
    }

    /**
     * stopScanner()
     * Stops the live camera stream, clears the #reader viewport,
     * and resets the scanning state flags.
     */
    async function stopScanner() {
        if (state.html5QrCode && state.isScanning) {
            try {
                await state.html5QrCode.stop();
                state.html5QrCode.clear();
                document.getElementById('btn-stop-scan').style.display = 'none';
                document.getElementById('reader').innerHTML = "";
                state.isScanning = false;
            } catch(e) {
                console.log("Scanner stop failed (may already be stopped):", e);
            }
        }
    }

    /**
     * displayScanResult(text)
     * Reveals the scan result panel and populates it with the decoded QR data.
     *
     * @param {string} text - The raw decoded content from the QR code
     */
    function displayScanResult(text) {
        const resultDiv  = document.getElementById('scan-result');
        const resultText = document.getElementById('scan-result-text');

        // Reveal the result panel (was hidden by utility-class-hidden)
        resultDiv.classList.remove('utility-class-hidden');

        // Set the decoded text — textContent prevents XSS injection
        resultText.textContent = text;
    }


    // ========================================================================
    // SECTION G: DATA EXTRACTION — PRIMARY TYPES
    // Each mode has its own data builder that returns { data, label }.
    // data  → the string encoded into the QR pattern
    // label → a short display string for the history log
    // ========================================================================

    /**
     * updateSocialPlaceholders()
     * Updates the label text and input placeholder dynamically
     * when the user changes the social media platform dropdown.
     * Called via onchange on the #social-platform select.
     */
    function updateSocialPlaceholders() {
        const platform = document.getElementById('social-platform').value;

        // Mapping of platform → UI label and placeholder text
        const config = {
            'facebook'  : { label: "Profile/Page ID",    placeholder: "username" },
            'instagram' : { label: "Instagram Handle",   placeholder: "username" },
            'twitter'   : { label: "X Handle",           placeholder: "username" },
            'youtube'   : { label: "Channel/Video URL",  placeholder: "https://youtube.com/..." },
            'tiktok'    : { label: "TikTok Handle",       placeholder: "@username" },
            'linkedin'  : { label: "Profile URL",        placeholder: "https://linkedin.com/in/..." }
        }[platform] || { label: "Username/Link", placeholder: "Enter here..." };

        document.getElementById('social-label').innerText        = config.label;
        document.getElementById('social-input').placeholder      = config.placeholder;
    }

    /**
     * getQRData()
     * Master data-extraction function. Reads the active input fields for the
     * current mode, validates required fields, and returns a structured object.
     *
     * Returns: { data: string, label: string }
     *   data  — raw string to encode in the QR image
     *   label — short human-readable label for the history log entry
     *
     * Returns null if validation fails (toast is shown internally via catch block).
     */
    function getQRData() {
        try {
            const mode = state.currentMode;

            // ── TEXT / URL ──
            if (mode === 'text') {
                const txt = document.getElementById("text-input").value.trim();
                if (!txt) throw "Please enter text or a URL";
                return {
                    data  : txt,
                    label : "Text: " + txt.substring(0, 15) + (txt.length > 15 ? "..." : "")
                };
            }

            // ── SOCIAL MEDIA ──
            // Intelligently prefixes bare usernames with the correct platform URL
            if (mode === 'social') {
                const plat = document.getElementById('social-platform').value;
                let val    = document.getElementById('social-input').value.trim();
                if (!val) throw "Enter username or link";

                // Only prepend prefix if not already a full URL
                if (!val.includes('http')) {
                    const prefixes = {
                        'facebook'  : 'https://facebook.com/',
                        'instagram' : 'https://instagram.com/',
                        'twitter'   : 'https://x.com/',
                        'tiktok'    : 'https://tiktok.com/',
                        'linkedin'  : 'https://linkedin.com/in/'
                    };
                    if (plat === 'tiktok' && !val.startsWith('@')) val = '@' + val;
                    val = (prefixes[plat] || '') + val;
                }
                return { data: val, label: "Social: " + plat };
            }

            // ── WIFI NETWORK ──
            // Generates standard WIFI: URI syntax understood by all modern phones
            if (mode === 'wifi') {
                const ssid   = document.getElementById("wifi-ssid").value.trim();
                const pass   = document.getElementById("wifi-pass").value;
                const type   = document.getElementById("wifi-type").value;
                const hidden = document.getElementById("wifi-hidden").checked;

                if (!ssid) throw "WiFi Network Name (SSID) required";

                // Use empty password string for open networks
                const safePass = type === 'nopass' ? '' : pass;

                // WIFI QR Standard: WIFI:S:<SSID>;T:<WPA|WEP|nopass>;P:<pass>;H:<hidden>;;
                const wifiStr = `WIFI:S:${ssid};T:${type};P:${safePass};H:${hidden};;`;
                return { data: wifiStr, label: "WiFi: " + ssid };
            }

            // ── VCARD 3.0 ──
            // Builds a standard vCard 3.0 text block for contact import
            if (mode === 'vcard') {
                const fn  = document.getElementById("v-fname").value.trim();
                const ln  = document.getElementById("v-lname").value.trim();
                const ph  = document.getElementById("v-phone").value.trim();
                const em  = document.getElementById("v-email").value.trim();
                const org = document.getElementById("v-org").value.trim();
                const site= document.getElementById("v-site").value.trim();
                const adr = document.getElementById("v-address").value.trim();

                if (!fn && !org) throw "Name or Organization required";

                // Build vCard 3.0 multiline string
                let vcard = `BEGIN:VCARD\nVERSION:3.0\nN:${ln};${fn}\nFN:${fn} ${ln}`;
                if (org)  vcard += `\nORG:${org}`;
                if (ph)   vcard += `\nTEL;TYPE=CELL:${ph}`;
                if (em)   vcard += `\nEMAIL:${em}`;
                if (site) vcard += `\nURL:${site}`;
                if (adr)  vcard += `\nADR:;;${adr};;;;`;
                vcard += `\nEND:VCARD`;

                return { data: vcard, label: "Contact: " + (fn || org) };
            }

            // Delegate remaining modes to the extended data handler
            return getExtendedData(mode);

        } catch(e) {
            // Show validation error via the global toast system
            window.showToast("⚠️ " + e, true);
            return null;
        }
    }


    // ========================================================================
    // SECTION H: DATA EXTRACTION — EXTENDED TYPES
    // Handles simpler modes that map directly to a URL or standard URI scheme.
    // ========================================================================

    /**
     * getExtendedData(mode)
     * Builds the QR data string for modes not handled in getQRData().
     * Throws a string error message if required fields are empty —
     * caught by the try/catch in getQRData().
     *
     * @param {string} mode - Active QR mode
     * @returns {{ data: string, label: string }}
     */
    function getExtendedData(mode) {

        // ── EMAIL (mailto: URI) ──
        if (mode === 'email') {
            const mail = document.getElementById("email-addr").value;
            if (!mail) throw "Email Address Required";
            const sub  = encodeURIComponent(document.getElementById("email-sub").value);
            const body = encodeURIComponent(document.getElementById("email-body").value);
            return { data: `mailto:${mail}?subject=${sub}&body=${body}`, label: "Email: " + mail };
        }

        // ── WHATSAPP (wa.me deep-link) ──
        if (mode === 'whatsapp') {
            const num = document.getElementById("wa-num").value.replace(/\D/g, '');
            if (!num) throw "Enter valid number (with country code)";
            const msg = encodeURIComponent(document.getElementById("wa-msg").value);
            return { data: `https://wa.me/${num}?text=${msg}`, label: "WA: " + num };
        }

        // ── CRYPTO PAYMENT REQUEST ──
        // Uses cryptocurrency: URI scheme (BIP-21 for Bitcoin, EIP-681 for ETH etc.)
        if (mode === 'crypto') {
            const addr = document.getElementById("crypto-addr").value.trim();
            if (!addr) throw "Wallet Address Required";
            const coin = document.getElementById("crypto-type").value;
            return { data: `${coin}:${addr}`, label: "Crypto Asset" };
        }

        // ── GEO COORDINATES (Google Maps URL) ──
        if (mode === 'maps') {
            const lat  = document.getElementById("map-lat").value;
            const long = document.getElementById("map-long").value;
            if (!lat || !long) throw "Coordinates Required";
            return {
                data  : `http://maps.google.com/maps?q=${lat},${long}`,
                label : "Loc: " + lat + "," + long
            };
        }

        // ── PAYPAL.ME PAYMENT LINK ──
        if (mode === 'paypal') {
            const usr = document.getElementById("pp-user").value;
            if (!usr) throw "PayPal Username Required";
            const amt = document.getElementById("pp-amt").value;
            return { data: `https://paypal.me/${usr}/${amt}`, label: "PayPal: " + usr };
        }

        // ── CALENDAR EVENT (simplified iCal / VEVENT format) ──
        if (mode === 'event') {
            const t = document.getElementById("evt-title").value;
            if (!t) throw "Event Title Required";
            const loc = document.getElementById("evt-loc").value;
            // Simplified VEVENT block — widely supported by device calendar apps
            return {
                data  : `BEGIN:VEVENT\nSUMMARY:${t}\nLOCATION:${loc}\nEND:VEVENT`,
                label : "Event: " + t
            };
        }

        // ── ZOOM MEETING LINK ──
        if (mode === 'zoom') {
            const id = document.getElementById("zoom-id").value;
            if (!id) throw "Meeting ID Required";
            const pass = document.getElementById("zoom-pass").value;
            return {
                data  : `https://zoom.us/j/${id.replace(/\s/g, '')}?pwd=${pass}`,
                label : "Zoom ID: " + id
            };
        }

        // Fallback — should never reach here if all modes are handled above
        throw "Invalid Input Data";
    }


    // ========================================================================
    // SECTION I: QR RENDERING ENGINE
    // Orchestrates: QRCode.js generation → Canvas post-processing → DOM output
    // ========================================================================

    /**
     * generateQR()
     * Main entry point for the QR generation pipeline. Called by the
     * "Generate QR" button and the keypress (Enter) listener.
     *
     * Flow:
     *   1. Show loading spinner
     *   2. Extract & validate data via getQRData()
     *   3. Read user settings (size, correction level, colors)
     *   4. Generate raw QR canvas via QRCode.js (off-screen)
     *   5. Pass canvas to processProQR() for colour/logo/text treatment
     *   6. Render final image into #qrcode div
     *   7. Scroll to result on mobile
     */
    async function generateQR() {
        const spinner = document.getElementById('loading-spinner');
        spinner.classList.remove('utility-class-hidden');

        // Yield to browser to paint the spinner before heavy canvas work
        await new Promise(r => setTimeout(r, 50));

        // Extract and validate input data for the current mode
        const content = getQRData();
        if (!content || !content.data) {
            spinner.classList.add('utility-class-hidden');
            return;
        }

        // Read QR configuration settings from the Pro Studio controls
        const size         = parseInt(document.getElementById("qr-size").value) || CONFIG.defaultSize;
        const correctLevel = document.getElementById("qr-correct").value;
        const colorDark    = document.getElementById("color-dark").value;

        // Clear previous QR output from the DOM
        state.qrContainer.innerHTML = "";

        // Create an off-screen container for QRCode.js to render into
        const tempDiv = document.createElement('div');

        try {
            // Generate raw monochrome QR code using QRCode.js library
            new QRCode(tempDiv, {
                text         : content.data,
                width        : size,
                height       : size,
                colorDark    : colorDark,
                colorLight   : "#ffffff",  // White base — manipulated in processProQR()
                correctLevel : QRCode.CorrectLevel[correctLevel]
            });

            // QRCode.js renders asynchronously — poll for the canvas element
            const checkCanvas = setInterval(() => {
                const rawCanvas = tempDiv.querySelector("canvas");
                if (rawCanvas) {
                    clearInterval(checkCanvas);
                    // Hand the raw canvas to the post-processor for styling
                    processProQR(rawCanvas, size, content);
                    spinner.classList.add('utility-class-hidden');
                }
            }, 50);

            // Safety timeout: stop polling after 3 seconds to prevent infinite loops
            setTimeout(() => {
                clearInterval(checkCanvas);
                spinner.classList.add('utility-class-hidden');
            }, 3000);

        } catch(e) {
            window.showToast("Data too long for this complexity. Try 'Low' correction.", true);
            spinner.classList.add('utility-class-hidden');
        }
    }

    /**
     * processProQR(sourceCanvas, size, content)
     * Advanced HTML5 Canvas post-processing pipeline.
     *
     * Applies in sequence:
     *   1. Optional solid background (or transparent if checkbox is checked)
     *   2. Gradient colour masking over QR modules (using globalCompositeOperation)
     *   3. Logo injection with rounded-rect white backing (protects scannability)
     *   4. Delegates final rendering and DOM insertion to finishRendering()
     *
     * @param {HTMLCanvasElement} sourceCanvas - Raw monochrome QR canvas from QRCode.js
     * @param {number}            size         - Output size in pixels
     * @param {{ data, label }}  content      - QR data object for history logging
     */
    function processProQR(sourceCanvas, size, content) {
        // Read all Pro Studio configuration values
        const useGradient   = document.getElementById("use-gradient").checked;
        const isTransparent = document.getElementById("transparent-bg").checked;
        const bgColor       = document.getElementById("color-light").value;
        const frameText     = document.getElementById("frame-text").value.trim();
        const logoInput     = document.getElementById("logo-input");

        // Create the final high-resolution output canvas
        const finalCanvas = document.createElement("canvas");
        const ctx         = finalCanvas.getContext("2d");

        // Calculate dimensions: QR body + 5% quiet-zone padding on all sides + CTA text bar
        const padding    = size * 0.05;                       // Quiet zone (ISO standard)
        const textHeight = frameText ? size * 0.12 : 0;       // CTA label band height

        finalCanvas.width  = size + (padding * 2);
        finalCanvas.height = size + (padding * 2) + textHeight;

        // ── Step 1: Draw Background ──
        if (!isTransparent) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        }
        // If transparent: background is omitted so PNG export retains alpha channel

        // ── Step 2: Gradient Colour Masking ──
        // Draw the raw QR into a temporary qrLayer canvas, then apply
        // gradient fill using source-in composite operation so only the
        // black QR modules receive the gradient colour — white stays clear.
        const qrLayer = document.createElement('canvas');
        qrLayer.width  = size;
        qrLayer.height = size;
        const qCtx = qrLayer.getContext('2d');
        qCtx.drawImage(sourceCanvas, 0, 0); // Copy raw QR modules

        if (useGradient) {
            // source-in: only draws on top of existing opaque pixels (the QR modules)
            qCtx.globalCompositeOperation = "source-in";
            const grad = qCtx.createLinearGradient(0, 0, size, size);
            grad.addColorStop(0, document.getElementById("color-dark").value);      // Start color
            grad.addColorStop(1, document.getElementById("color-gradient").value);  // End color
            qCtx.fillStyle = grad;
            qCtx.fillRect(0, 0, size, size);
        }

        // ── Step 3: Composite QR Layer onto Final Canvas ──
        // Offset by padding to create the quiet zone border
        ctx.drawImage(qrLayer, padding, padding);

        // ── Step 4: Logo Injection ──
        // Reads logo file, draws a rounded backing rectangle, then overlays the image
        if (logoInput.files && logoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Logo occupies max 22% of the QR body width (ISO-safe limit)
                    const logoSize = size * 0.22;
                    const x = (finalCanvas.width  - logoSize) / 2;
                    const y = padding + (size - logoSize) / 2;

                    // Draw protective backing rectangle (soft shadow + rounded corners)
                    ctx.fillStyle   = isTransparent ? "#ffffff" : bgColor;
                    ctx.shadowColor = "rgba(0,0,0,0.1)";
                    ctx.shadowBlur  = 10;

                    // roundRect is supported in all modern browsers (2023+)
                    ctx.beginPath();
                    ctx.roundRect(x - 5, y - 5, logoSize + 10, logoSize + 10, 10);
                    ctx.fill();
                    ctx.shadowBlur = 0; // Reset shadow to avoid bleeding onto QR

                    // Draw the actual logo image on top of the backing
                    ctx.drawImage(img, x, y, logoSize, logoSize);

                    // Proceed to final rendering with logo applied
                    finishRendering(finalCanvas, ctx, frameText,
                                    finalCanvas.width, finalCanvas.height, content);
                };
                img.onerror = () => {
                    window.showToast("Logo file corrupted.", true);
                    // Still render QR without logo
                    finishRendering(finalCanvas, ctx, frameText,
                                    finalCanvas.width, finalCanvas.height, content);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(logoInput.files[0]); // Triggers async read
        } else {
            // No logo — skip straight to final rendering
            finishRendering(finalCanvas, ctx, frameText,
                            finalCanvas.width, finalCanvas.height, content);
        }
    }

    /**
     * finishRendering(canvas, ctx, text, w, h, content)
     * Final stage of the rendering pipeline:
     *   1. Optionally draws the CTA frame text at the bottom of the canvas
     *   2. Exports the canvas as a PNG data-URL and inserts an <img> into #qrcode
     *   3. Adds the generated entry to the history log
     *   4. Smooth-scrolls to the result area on mobile devices
     *
     * @param {HTMLCanvasElement} canvas  - Completed final canvas
     * @param {CanvasRenderingContext2D} ctx
     * @param {string}  text    - CTA label text (empty = skip)
     * @param {number}  w       - Canvas total width
     * @param {number}  h       - Canvas total height
     * @param {object}  content - { data, label } for history
     */
    function finishRendering(canvas, ctx, text, w, h, content) {

        // ── CTA Frame Text ──
        if (text) {
            ctx.fillStyle    = document.getElementById("color-dark").value;
            ctx.font         = `bold ${w * 0.05}px Arial`;
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            // Center text horizontally; position it in the lower text-height band
            ctx.fillText(text.toUpperCase(), w / 2, h - (h * 0.05));
        }

        // ── Export Canvas → <img> Element ──
        const img = document.createElement("img");
        img.src = canvas.toDataURL("image/png");
        img.alt = "Generated QR Code";

        // Replace any previous QR preview with the new image
        state.qrContainer.innerHTML = "";
        state.qrContainer.appendChild(img);

        // Record this generation in the local history log
        addToHistory(content.label, content.data);

        // Auto-scroll to the QR preview on small screens for better UX
        if (window.innerWidth < 768) {
            document.getElementById('generator-wrapper').scrollIntoView({ behavior: 'smooth' });
        }
    }


    // ========================================================================
    // SECTION J: EXPORT UTILITIES
    // Download, Print, and Clipboard copy handlers
    // ========================================================================

    /**
     * downloadQR()
     * Downloads the generated QR image in the format selected by the
     * #dl-format dropdown (png, webp, jpeg).
     *
     * PNG: direct base64 src download (supports transparency).
     * WEBP/JPEG: converts via off-screen canvas; JPEG gets a white background fill.
     */
    function downloadQR() {
        const img = state.qrContainer.querySelector("img");
        if (!img) {
            window.showToast("Generate a QR code first!", true);
            return;
        }

        const format = document.getElementById("dl-format").value; // 'png' | 'jpeg' | 'webp'
        const link   = document.createElement("a");

        if (format !== 'png') {
            // Convert existing PNG base64 to the requested format via Canvas
            const canvas = document.createElement('canvas');
            const ctx    = canvas.getContext('2d');
            const imageObj = new Image();
            imageObj.src = img.src;

            imageObj.onload = () => {
                canvas.width  = imageObj.width;
                canvas.height = imageObj.height;

                // JPEG does not support transparency — fill white background first
                if (format === 'jpeg') {
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(imageObj, 0, 0);
                link.href = canvas.toDataURL(`image/${format}`, 0.9);
                triggerDownload(link, format);
            };
        } else {
            // PNG: use base64 src directly — no conversion needed
            link.href = img.src;
            triggerDownload(link, format);
        }
    }

    /**
     * triggerDownload(link, ext)
     * Appends the anchor link to the DOM, triggers a click for download,
     * then immediately removes it. Filename is timestamped automatically.
     *
     * @param {HTMLAnchorElement} link - Prepared <a> element with href set
     * @param {string}            ext  - File extension (png / webp / jpeg)
     */
    function triggerDownload(link, ext) {
        const date   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        link.download = `QR-Ultra-${date}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.showToast("Downloading High-Res Image...");
    }

    /**
     * copyToClipboard()
     * Copies the rendered QR image to the system clipboard as image/png
     * using the Clipboard API's write() method.
     * Falls back to a helpful error toast if the browser blocks the API.
     */
    function copyToClipboard() {
        const img = state.qrContainer.querySelector("img");
        if (!img) return;

        // Fetch the base64 data URL as a Blob for ClipboardItem
        fetch(img.src)
            .then(res => res.blob())
            .then(blob => {
                const item = new ClipboardItem({ "image/png": blob });
                navigator.clipboard.write([item])
                    .then(() => {
                        window.showToast("Image copied to clipboard!");
                    });
            })
            .catch(() => {
                window.showToast("Browser blocked copy. Right-click image to save.", true);
            });
    }

    /**
     * printQR()
     * Opens a minimal print window containing only the QR image,
     * centered on the page. Automatically triggers the print dialog.
     */
    function printQR() {
        const img = state.qrContainer.querySelector("img");
        if (!img) return;

        const win = window.open('');
        win.document.write(`
            <html>
            <head><title>Print QR — QR Ultra Pro Max</title></head>
            <body style="display:flex; justify-content:center; align-items:center; height:100vh; margin:0; background:#fff;">
                <img src="${img.src}" style="max-width:80%; max-height:80vh;">
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        // Small delay ensures the image is fully loaded before the dialog opens
        setTimeout(() => { win.print(); win.close(); }, 500);
    }

    /**
     * copyScanResult()
     * Copies the decoded scan result text to the clipboard.
     * Triggered by the "Copy Result" button in the scanner panel.
     */
    function copyScanResult() {
        const txt = document.getElementById('scan-result-text').innerText;
        if (!txt) return;
        navigator.clipboard.writeText(txt)
            .then(() => window.showToast("Result copied!"));
    }


    // ========================================================================
    // SECTION K: HISTORY MANAGEMENT (localStorage)
    // Stores and renders a list of recently generated QR entries.
    // Max 15 entries; duplicates (same data) are silently ignored.
    // ========================================================================

    /**
     * addToHistory(label, data)
     * Prepends a new entry to the history array in localStorage.
     * Prevents adding a duplicate if it matches the most recent item.
     *
     * @param {string} label - Short human-readable description (e.g. "WiFi: MyNetwork")
     * @param {string} data  - The full QR data string (used for the copy button)
     */
    function addToHistory(label, data) {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(CONFIG.historyKey)) || [];
        } catch(e) { /* Corrupted JSON — start fresh */ }

        // Sanitise label for safe HTML insertion (basic XSS prevention)
        const cleanLabel = label.replace(/[<>"'&]/g, "");

        // Skip if this exact data is already the most recent entry
        if (history.length > 0 && history[0].data === data) return;

        // Prepend new entry with formatted timestamp
        history.unshift({
            label : cleanLabel,
            data  : data,
            time  : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        // Trim to maximum history length
        if (history.length > CONFIG.maxHistory) history.pop();

        try {
            localStorage.setItem(CONFIG.historyKey, JSON.stringify(history));
        } catch(e) {
            console.warn("localStorage full or disabled — history not saved.");
        }

        // Re-render the history list UI after adding the new entry
        loadHistory();
    }

    /**
     * loadHistory()
     * Reads the history array from localStorage and renders each item
     * as a <li class="history-item"> inside #history-list.
     *
     * Each item has:
     *   • Label + timestamp (left)
     *   • Copy button that recalls QRApp.copyHistory(btn) (right)
     *
     * Empty state: shows a centred muted placeholder message.
     */
    function loadHistory() {
        const list = document.getElementById('history-list');
        if (!list) return;

        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(CONFIG.historyKey)) || [];
        } catch(e) { /* Ignore parse errors */ }

        // Empty state placeholder
        if (!history.length) {
            list.innerHTML = `<li style="text-align:center; color:var(--text-muted); padding:14px;">
                                No recent history found.
                              </li>`;
            return;
        }

        list.innerHTML = ""; // Clear before re-rendering

        // Render each history entry as a flex list item
        history.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item'; // CSS target in tools-template.css Section 42

            // data-content uses encodeURIComponent to safely embed arbitrary QR data
            li.innerHTML = `
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:65%;">
                    <strong style="color:var(--brand-primary);">${item.label}</strong><br>
                    <span style="font-size:0.75rem; opacity:0.7;">${item.time}</span>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-secondary"
                            style="padding:6px; min-width:auto; height:32px; width:32px;"
                            onclick="QRApp.copyHistory(this)"
                            data-content="${encodeURIComponent(item.data)}"
                            title="Copy QR data to clipboard">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    }

    /**
     * copyHistory(btn)
     * Reads the QR data from a history item's data-content attribute and
     * copies it to the clipboard. Called via onclick on each history copy button.
     *
     * @param {HTMLButtonElement} btn - The clicked copy button element
     */
    function copyHistory(btn) {
        const data = decodeURIComponent(btn.getAttribute('data-content'));
        navigator.clipboard.writeText(data)
            .then(() => window.showToast("Copied to clipboard"));
    }

    /**
     * clearHistory()
     * Prompts the user for confirmation, then wipes all history from
     * localStorage and re-renders the empty state.
     */
    function clearHistory() {
        if (confirm("Delete all history logs? This cannot be undone.")) {
            localStorage.removeItem(CONFIG.historyKey);
            loadHistory();
            window.showToast("History cleared");
        }
    }


    // ========================================================================
    // SECTION L: PUBLIC API
    // Only the methods listed here are accessible from HTML onclick handlers.
    // All other functions remain private to the IIFE closure.
    // ========================================================================

    return {
        setMode,                  // Tab switching — called by all tab button onclicks
        generateQR,               // QR generation pipeline — called by Generate button
        downloadQR,               // Download handler — called by Save Image button
        printQR,                  // Print handler — called by print icon button
        stopScanner,              // Stop camera — called by Stop Camera button
        copyScanResult,           // Copy decoded text — called by Copy Result button
        updateSocialPlaceholders, // Platform label update — called by social-platform onchange
        copyToClipboard,          // Clipboard copy — called by copy icon button
        clearHistory,             // Wipe history — called by Clear All button
        copyHistory               // Copy single history item — called by per-item copy buttons
    };

})();
