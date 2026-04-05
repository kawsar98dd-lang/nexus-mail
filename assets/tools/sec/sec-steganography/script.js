/**
 * ============================================================================
 * STEGANO VAULT ULTRA MAX — script.js
 * Image Steganography with AES-256 Encryption
 *
 * CORE TECHNOLOGY:
 *   - LSB (Least Significant Bit) steganography via HTML5 Canvas API
 *   - AES-256-CBC encryption via CryptoJS (loaded in <head>)
 *   - 100% Vanilla JavaScript — no jQuery, no frameworks
 *   - Fully client-side — zero server communication
 *
 * ARCHITECTURE OVERVIEW:
 *   1. SteganoVault        — Main controller / entry point
 *   2. ImageHandler        — Manages file uploads, canvas draw, preview
 *   3. CapacityAnalyzer    — Computes and displays pixel capacity stats
 *   4. PasswordHelper      — Strength meter, show/hide, match check
 *   5. SteganographyEngine — Core LSB encode/decode bit manipulation
 *   6. CryptoEngine        — AES-256 encrypt/decrypt wrappers (CryptoJS)
 *   7. UIController        — Tabs, loading states, error display
 *
 * LSB METHOD EXPLAINED:
 *   Each pixel has 4 channels: R, G, B, A.
 *   We hide 1 bit in the LSB of each of R, G, B → 3 bits per pixel.
 *   We read the image data as a flat Uint8ClampedArray and traverse it
 *   sequentially, replacing the final bit of each R/G/B byte value.
 *   Changing 1 LSB shifts a value by at most 1 (e.g. 200 → 201).
 *   The human eye cannot distinguish this change.
 *
 * DATA FORMAT:
 *   The payload embedded into pixels has this structure:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ HEADER (32 chars): "SVUM:" + zero-padded length      │
 *   │ BODY: AES-256-CBC ciphertext (Base64 encoded)        │
 *   └──────────────────────────────────────────────────────┘
 *   e.g.: "SVUM:00000312HelloAES..."
 *         └── 5-char magic + 8-char decimal length + ciphertext
 *
 * TOAST NOTIFICATIONS:
 *   This script uses the global toast system exposed by global.js.
 *   API: window.showToast(message)           — success (green)
 *        window.showToast(message, true)      — error (red)
 *
 * MOBILE AWARENESS:
 *   On initialization, the tool detects mobile browsers and warns the user
 *   that the Canvas API and File API are required for full functionality.
 *
 * AUTHORED FOR: Trusted Tools Web — CodeCanyon Premium Release
 * ============================================================================
 */

(function () {
    'use strict';

    /* ========================================================================
       CONSTANTS
       Fixed values used across the encoding/decoding pipeline.
    ======================================================================== */

    /** Magic string prepended to every payload for identification */
    const MAGIC = 'SVUM:';

    /** Fixed-width decimal string for the payload length (8 digits) */
    const LENGTH_DIGITS = 8;

    /**
     * Total header length in characters.
     * = MAGIC.length (5) + LENGTH_DIGITS (8) = 13 characters
     */
    const HEADER_LENGTH = MAGIC.length + LENGTH_DIGITS;

    /** Minimum password length enforced during encoding */
    const MIN_PASSWORD_LENGTH = 6;


    /* ========================================================================
       UTILITY HELPERS
       Small, pure helper functions with no side-effects.
    ======================================================================== */

    /**
     * Pad a number to a fixed number of digits with leading zeros.
     * Used to build the fixed-width length field in the payload header.
     *
     * @param {number} num    - The number to pad.
     * @param {number} digits - Target total digit count.
     * @returns {string}      - Zero-padded string representation.
     *
     * @example padNumber(312, 8) → "00000312"
     */
    function padNumber(num, digits) {
        return String(num).padStart(digits, '0');
    }

    /**
     * Convert a raw byte count into a human-readable size string.
     * Automatically selects B, KB, or MB with appropriate precision.
     *
     * @param {number} bytes - Raw byte count.
     * @returns {string}     - Human-readable string (e.g., "720.0 KB").
     */
    function formatBytes(bytes) {
        if (bytes < 1024)             return bytes + ' B';
        if (bytes < 1024 * 1024)      return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    /**
     * Retrieve a DOM element by its ID with a console warning on miss.
     * Shorthand alias for document.getElementById().
     *
     * @param {string} id     - The element's ID attribute.
     * @returns {HTMLElement} - The found element (or null with a warning).
     */
    function $(id) {
        const el = document.getElementById(id);
        if (!el) console.warn('[SteganoVault] Element not found:', id);
        return el;
    }


    /* ========================================================================
       CRYPTO ENGINE
       AES-256 encryption and decryption wrappers using CryptoJS.
       CryptoJS must be loaded in <head> before this script runs.
    ======================================================================== */
    const CryptoEngine = {

        /**
         * Encrypt a plaintext string with AES-256 using a password.
         *
         * CryptoJS.AES.encrypt automatically:
         *  - Derives a 256-bit key via PBKDF2 (OpenSSL EVP_BytesToKey)
         *  - Generates a cryptographically random 8-byte salt
         *  - Uses AES-256-CBC mode with a random IV
         *  - Returns a CipherParams object; .toString() gives Base64 output
         *
         * @param {string} plaintext  - The secret message to encrypt.
         * @param {string} password   - The user's encryption password.
         * @returns {string}          - Base64-encoded ciphertext string.
         * @throws {Error}            - If CryptoJS global is unavailable.
         */
        encrypt(plaintext, password) {
            if (typeof CryptoJS === 'undefined') {
                throw new Error('CryptoJS library is not loaded. Check the script path in <head>.');
            }
            const encrypted = CryptoJS.AES.encrypt(plaintext, password);
            return encrypted.toString(); // Base64 string output
        },

        /**
         * Decrypt an AES-256-CBC ciphertext back to the original plaintext.
         *
         * CryptoJS.AES.decrypt reverses the encrypt operation using the same
         * password and auto-detects the embedded salt/IV from the Base64 data.
         *
         * @param {string} ciphertext - Base64-encoded AES ciphertext.
         * @param {string} password   - The password used during encryption.
         * @returns {string}          - Decrypted plaintext string (UTF-8).
         * @throws {Error}            - On wrong password or corrupt data
         *                             (detected via empty WordArray result).
         */
        decrypt(ciphertext, password) {
            if (typeof CryptoJS === 'undefined') {
                throw new Error('CryptoJS library is not loaded.');
            }
            const decrypted = CryptoJS.AES.decrypt(ciphertext, password);

            // Convert the resulting WordArray to a UTF-8 string
            const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

            // An empty result indicates either a wrong password or corrupted data
            if (!plaintext) {
                throw new Error('Decryption failed. Incorrect password or corrupted stegano data.');
            }
            return plaintext;
        }
    };


    /* ========================================================================
       STEGANOGRAPHY ENGINE
       Core LSB pixel manipulation — the heart of Stegano Vault.
       All operations work on raw Uint8ClampedArray pixel data from canvas.
    ======================================================================== */
    const SteganographyEngine = {

        /**
         * Calculate the maximum number of characters that can be hidden
         * in an image of the given dimensions.
         *
         * Formula:
         *   totalBits  = width × height × 3    (3 R/G/B channels per pixel)
         *   totalBytes = floor(totalBits / 8)   (8 bits per byte/character)
         *   maxChars   = totalBytes - HEADER_LENGTH  (subtract header overhead)
         *
         * @param {number} width   - Image width in pixels.
         * @param {number} height  - Image height in pixels.
         * @returns {number}       - Maximum hideable character count.
         */
        getMaxChars(width, height) {
            const totalBits  = width * height * 3; // Use R, G, B channels only
            const totalBytes = Math.floor(totalBits / 8);
            return Math.max(0, totalBytes - HEADER_LENGTH);
        },

        /**
         * ENCODE — Embed the payload string into the image's pixel data.
         *
         * Algorithm (step by step):
         *  1. Build the full payload: HEADER (magic + length) + ciphertext body.
         *  2. Convert the payload string to an array of individual bits
         *     (each character → charCode → 8 bits, MSB first).
         *  3. Validate that the image has enough capacity for all bits.
         *  4. For each R, G, or B channel value in the pixel array:
         *       a. Clear the LSB of the current byte value  (byte & 0xFE).
         *       b. Set the LSB to the current payload bit   (byte | bit).
         *       c. Write back to a cloned copy of the pixel array.
         *  5. Return the modified pixel array (the original is never mutated).
         *
         * @param {Uint8ClampedArray} pixelData - Raw RGBA pixel data from canvas.
         * @param {string} payload              - AES ciphertext to embed.
         * @returns {Uint8ClampedArray}          - Modified pixel data with hidden payload.
         * @throws {Error}                       - If payload exceeds image capacity.
         */
        encode(pixelData, payload) {
            // --- Step 1: Build the complete payload with header ---
            // Header format: "SVUM:" + 8-digit zero-padded length of the body
            const header      = MAGIC + padNumber(payload.length, LENGTH_DIGITS);
            const fullPayload = header + payload;

            // --- Step 2: Convert each character of the payload to 8 bits ---
            // We traverse MSB first (bit 7 down to bit 0) for each char code
            const bits = [];
            for (let i = 0; i < fullPayload.length; i++) {
                const charCode = fullPayload.charCodeAt(i);
                for (let bit = 7; bit >= 0; bit--) {
                    bits.push((charCode >> bit) & 1); // Extract single bit
                }
            }

            // --- Step 3: Validate image capacity ---
            // pixelData layout = [R, G, B, A, R, G, B, A, ...]
            // We skip every 4th byte (Alpha), so usable slots = pixels × 3
            const totalBits = pixelData.length / 4 * 3;
            if (bits.length > totalBits) {
                throw new Error(
                    `Payload too large! Image can hold ${Math.floor(totalBits / 8)} bytes ` +
                    `but payload needs ${Math.ceil(bits.length / 8)} bytes.`
                );
            }

            // --- Step 4: Embed bits into LSBs of R, G, B channels ---
            // Clone the pixel array to avoid mutating the live canvas data
            const data     = new Uint8ClampedArray(pixelData);
            let bitIndex   = 0;

            for (let i = 0; i < data.length && bitIndex < bits.length; i++) {
                // Index 3, 7, 11... are Alpha channels — skip them
                if (i % 4 === 3) continue;

                // Clear the LSB (0xFE = 11111110) then OR in the payload bit
                data[i] = (data[i] & 0xFE) | bits[bitIndex];
                bitIndex++;
            }

            return data;
        },

        /**
         * DECODE — Extract the hidden payload from an image's pixel data.
         *
         * Reverse of encode():
         *  1. Read the LSB of each R, G, B channel in sequence.
         *  2. Accumulate those bits into bytes (8 bits → 1 character).
         *  3. Reconstruct the full header string and verify the magic prefix.
         *  4. Extract the payload length from the header's length field.
         *  5. Read exactly that many characters after the header and return them.
         *
         * @param {Uint8ClampedArray} pixelData - Raw RGBA pixel data from canvas.
         * @returns {string}                    - Extracted payload body (AES ciphertext).
         * @throws {Error}                      - If no valid Stegano Vault header found.
         */
        decode(pixelData) {
            // --- Step 1: Collect LSBs from all R, G, B channels ---
            const bits = [];
            for (let i = 0; i < pixelData.length; i++) {
                if (i % 4 === 3) continue;        // Skip Alpha channel
                bits.push(pixelData[i] & 1);       // Isolate the LSB
            }

            // --- Step 2: Verify we have enough bits to read at least the header ---
            const minBits = HEADER_LENGTH * 8;
            if (bits.length < minBits) {
                throw new Error('Image is too small to contain a valid stegano payload.');
            }

            /**
             * Inner helper: reconstruct a string of `charCount` characters
             * from the bits array starting at a given bit `offset`.
             *
             * Each character = 8 consecutive bits, MSB first.
             *
             * @param {number} offset    - Bit position to start reading from.
             * @param {number} charCount - Number of characters to reconstruct.
             * @returns {string}         - Reconstructed string.
             */
            function bitsToString(offset, charCount) {
                let result = '';
                for (let c = 0; c < charCount; c++) {
                    let charCode = 0;
                    for (let b = 0; b < 8; b++) {
                        // Shift accumulated code left and OR in the next bit
                        charCode = (charCode << 1) | (bits[offset + c * 8 + b] || 0);
                    }
                    result += String.fromCharCode(charCode);
                }
                return result;
            }

            // --- Step 3: Read and validate the header ---
            const header = bitsToString(0, HEADER_LENGTH);

            // The header MUST begin with our magic string to be a valid payload
            if (!header.startsWith(MAGIC)) {
                throw new Error(
                    'No Stegano Vault payload found in this image. ' +
                    'Make sure you are using the correct PNG exported by this tool.'
                );
            }

            // --- Step 4: Extract the payload length from the header ---
            // Length field occupies characters after the magic string
            const lengthStr    = header.slice(MAGIC.length, MAGIC.length + LENGTH_DIGITS);
            const payloadLength = parseInt(lengthStr, 10);

            if (isNaN(payloadLength) || payloadLength <= 0) {
                throw new Error('Corrupt stegano header: invalid length field.');
            }

            // Confirm we have enough total bits to read the full body
            const totalNeededBits = (HEADER_LENGTH + payloadLength) * 8;
            if (bits.length < totalNeededBits) {
                throw new Error(
                    'Stegano data appears truncated or the image was modified after encoding.'
                );
            }

            // --- Step 5: Read exactly payloadLength characters of body ---
            // Body starts immediately after the 13-character header
            const payloadBody = bitsToString(HEADER_LENGTH * 8, payloadLength);
            return payloadBody;
        }
    };


    /* ========================================================================
       IMAGE HANDLER
       Factory function that creates a handler object for one upload context
       (either 'encode' or 'decode'). Manages file input, drag & drop, canvas
       rendering, image preview, and metadata display.
    ======================================================================== */

    /**
     * Create and return a new ImageHandler for a specific context.
     *
     * The handler binds events to the DOM elements with IDs prefixed by
     * `context` (e.g., 'encode-drop-zone', 'decode-canvas'), so this factory
     * can create two independent handlers from one code path.
     *
     * @param {string} context - 'encode' or 'decode'
     * @returns {Object}       - Handler object with state and methods.
     */
    function createImageHandler(context) {
        const handler = {

            /** The currently loaded HTMLImageElement (null if no image) */
            image: null,

            /** Native width of the loaded image in pixels */
            width: 0,

            /** Native height of the loaded image in pixels */
            height: 0,

            /** Original filename — used for naming the exported PNG */
            filename: '',

            /**
             * Optional callback fired when an image is successfully loaded.
             * Set externally: handler.onLoad = () => { ... }
             */
            onLoad: null,

            /**
             * Optional callback fired when the image is cleared/removed.
             * Set externally: handler.onClear = () => { ... }
             */
            onClear: null,

            // ── DOM Element References ──────────────────────────────────────
            // These are resolved once at creation time to avoid repeated lookups.
            dropZone:    $(`${context}-drop-zone`),
            fileInput:   $(`${context}-file-input`),
            previewWrap: $(`${context}-preview-wrap`),
            canvas:      $(`${context}-canvas`),
            imageMeta:   $(`${context}-image-meta`),
            clearBtn:    $(`${context}-clear-btn`),

            /**
             * Register all DOM event listeners for this handler.
             * Must be called once during application initialization.
             */
            bindEvents() {
                // --- Click on the drop zone → open the native file picker ---
                this.dropZone.addEventListener('click', () => {
                    this.fileInput.click();
                });

                // --- Keyboard: Enter or Space on the drop zone → open file picker ---
                // Required for keyboard accessibility (drop zone has tabindex=0).
                this.dropZone.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.fileInput.click();
                    }
                });

                // --- File input change event (user selected a file via dialog) ---
                this.fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) {
                        this.loadFile(e.target.files[0]);
                    }
                });

                // --- Drag over: apply visual "drag-over" highlight to drop zone ---
                this.dropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.add('drag-over');
                });

                // --- Drag leave: remove the "drag-over" highlight ---
                this.dropZone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.remove('drag-over');
                });

                // --- Drop event: validate and process the dropped file ---
                this.dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.remove('drag-over');
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                        this.loadFile(file);
                    } else {
                        // Notify the user of invalid file type via global toast
                        window.showToast('Please drop a valid image file (PNG, JPG, WEBP).', true);
                    }
                });

                // --- Clear button: remove the loaded image and reset state ---
                if (this.clearBtn) {
                    this.clearBtn.addEventListener('click', () => this.clear());
                }
            },

            /**
             * Load a File object into the canvas and display the preview.
             *
             * Flow:
             *  1. Validate the MIME type — must be an image/*.
             *  2. Read the file as a Data URL via FileReader.
             *  3. Create an HTMLImageElement and draw it onto the canvas.
             *  4. Store dimensions and update the metadata display.
             *  5. Show the preview area and hide the drop zone.
             *  6. Fire the onLoad callback (if set).
             *
             * @param {File} file - The image file chosen by the user.
             */
            loadFile(file) {
                if (!file.type.startsWith('image/')) {
                    window.showToast('Invalid file type. Please upload PNG, JPG, WEBP, or BMP.', true);
                    return;
                }

                this.filename = file.name;

                const reader = new FileReader();
                reader.onload = (evt) => {
                    const img = new Image();
                    img.onload = () => {
                        // Store image reference and native dimensions
                        this.image  = img;
                        this.width  = img.naturalWidth;
                        this.height = img.naturalHeight;

                        // Draw the image to the canvas at its native resolution.
                        // The canvas stores the pixel data for getImageData() calls.
                        this.canvas.width  = img.naturalWidth;
                        this.canvas.height = img.naturalHeight;
                        const ctx = this.canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        // Build the one-line metadata string shown below the preview
                        const sizeKB = (file.size / 1024).toFixed(1);
                        this.imageMeta.textContent =
                            `${img.naturalWidth} × ${img.naturalHeight}px · ${sizeKB} KB · ${file.type.split('/')[1].toUpperCase()}`;

                        // Swap: hide the drop zone, reveal the image preview
                        this.dropZone.hidden    = true;
                        this.previewWrap.hidden = false;

                        // Notify the parent controller (e.g., trigger capacity analysis)
                        if (typeof this.onLoad === 'function') this.onLoad();
                    };
                    img.onerror = () => {
                        window.showToast('Failed to load image. File may be corrupt.', true);
                    };
                    img.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            },

            /**
             * Get the raw RGBA pixel data from the canvas context.
             * This is the flat Uint8ClampedArray that encode/decode operate on.
             *
             * @returns {ImageData} - The full canvas ImageData object.
             */
            getImageData() {
                if (!this.canvas) return null;
                const ctx = this.canvas.getContext('2d');
                return ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            },

            /**
             * Write modified pixel data back onto the canvas.
             * Called after encoding to persist the LSB-modified pixels so
             * the canvas can subsequently be exported as a PNG.
             *
             * @param {Uint8ClampedArray} pixelArray - Modified RGBA pixel array.
             */
            putImageData(pixelArray) {
                const ctx       = this.canvas.getContext('2d');
                const imageData = new ImageData(pixelArray, this.canvas.width, this.canvas.height);
                ctx.putImageData(imageData, 0, 0);
            },

            /**
             * Export the canvas as a lossless PNG Data URL.
             *
             * PNG is mandatory because JPEG's lossy compression would corrupt
             * the LSB data, making the hidden message unrecoverable.
             *
             * @returns {string} - "data:image/png;base64,..." Data URL string.
             */
            exportPNG() {
                return this.canvas.toDataURL('image/png');
            },

            /**
             * Reset this handler to its initial empty state.
             * Clears the canvas, resets all state properties, hides the preview,
             * and shows the drop zone again. Also fires the onClear callback.
             */
            clear() {
                this.image    = null;
                this.width    = 0;
                this.height   = 0;
                this.filename = '';

                // Clear the canvas drawing surface completely
                const ctx = this.canvas.getContext('2d');
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.canvas.width  = 0;
                this.canvas.height = 0;

                // Reset file input so the same file can be re-selected next time
                this.fileInput.value = '';
                this.imageMeta.textContent = '';

                // Swap: show drop zone, hide preview
                this.dropZone.hidden    = false;
                this.previewWrap.hidden = true;

                // Notify the parent controller
                if (typeof this.onClear === 'function') this.onClear();
            }
        };

        return handler;
    }


    /* ========================================================================
       CAPACITY ANALYZER
       Computes pixel storage capacity for the loaded image and updates
       the real-time progress bar and stat rows in the encode panel.
    ======================================================================== */
    const CapacityAnalyzer = {

        /** DOM element references — resolved once at IIFE load time */
        barFill:      $('capacity-bar-fill'),
        usedSpan:     $('capacity-used'),
        totalSpan:    $('capacity-total'),
        dimensionsEl: $('cap-dimensions'),
        bytesEl:      $('cap-bytes'),
        alertBox:     $('capacity-alert'),
        alertMsg:     $('capacity-alert-msg'),

        /** Stores the current maximum character count for the loaded image */
        maxChars: 0,

        /**
         * Refresh the capacity display for the given image dimensions and
         * current message character count.
         *
         * - If no image is loaded (width=0 / height=0), resets to default state.
         * - Otherwise, computes capacity via SteganographyEngine.getMaxChars(),
         *   updates the progress bar width, usage counters, and stat rows.
         * - Triggers the over-capacity alert if messageChars > maxChars.
         *
         * @param {number} imageWidth   - Loaded image width in pixels (0 if none).
         * @param {number} imageHeight  - Loaded image height in pixels (0 if none).
         * @param {number} messageChars - Current character count in the message textarea.
         */
        update(imageWidth, imageHeight, messageChars) {
            if (!imageWidth || !imageHeight) {
                // No image loaded — show blank/default state
                this.barFill.style.width        = '0%';
                this.barFill.classList.remove('over-capacity');
                this.usedSpan.textContent        = '0';
                this.totalSpan.textContent       = '—';
                this.dimensionsEl.textContent    = 'Upload an image to analyze';
                this.bytesEl.textContent         = '—';
                this.alertBox.hidden             = true;
                return;
            }

            // Compute the maximum characters for the loaded image
            this.maxChars = SteganographyEngine.getMaxChars(imageWidth, imageHeight);

            // Update the dimension and byte capacity stats
            const totalPixels = imageWidth * imageHeight;
            const totalBits   = totalPixels * 3;
            const totalBytes  = Math.floor(totalBits / 8);
            this.dimensionsEl.textContent = `${imageWidth} × ${imageHeight} px = ${totalPixels.toLocaleString()} pixels`;
            this.bytesEl.textContent      = `Max payload: ${formatBytes(this.maxChars)} (${this.maxChars.toLocaleString()} chars)`;

            // Update the "used / total" text counters
            this.usedSpan.textContent  = messageChars.toLocaleString();
            this.totalSpan.textContent = this.maxChars.toLocaleString();

            // Calculate progress bar fill percentage (capped at 100% for CSS)
            const percentage = this.maxChars > 0
                ? Math.min(100, (messageChars / this.maxChars) * 100)
                : 0;

            this.barFill.style.width = percentage + '%';

            // Show/hide the over-capacity warning banner
            if (messageChars > this.maxChars) {
                this.barFill.classList.add('over-capacity');
                this.alertBox.hidden = false;
                this.alertMsg.textContent =
                    `Message exceeds capacity by ${(messageChars - this.maxChars).toLocaleString()} chars. ` +
                    `Use a larger image or shorten your message.`;
            } else {
                this.barFill.classList.remove('over-capacity');
                this.alertBox.hidden = true;
            }
        }
    };


    /* ========================================================================
       PASSWORD HELPER
       Handles password strength scoring, visual meter updates, and the
       match/mismatch indicator for the confirm password field.
    ======================================================================== */
    const PasswordHelper = {

        /**
         * Evaluate the strength of a password on a 0–4 scale.
         *
         * Scoring criteria (each criterion adds +1 to score):
         *   1. Length ≥ 8 characters
         *   2. Contains both lowercase AND uppercase letters
         *   3. Contains at least one digit (0–9)
         *   4. Contains at least one special character (non-alphanumeric)
         *
         * @param {string} password - The password string to evaluate.
         * @returns {{ level: number, label: string }} - Score (0–4) and label.
         */
        getStrength(password) {
            if (!password) return { level: 0, label: 'Enter password' };
            let score = 0;
            if (password.length >= 8)                             score++;
            if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
            if (/\d/.test(password))                              score++;
            if (/[^a-zA-Z0-9]/.test(password))                   score++;

            const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
            return { level: score, label: labels[score] || 'Strong' };
        },

        /**
         * Apply the strength score to the visual meter UI elements.
         *
         * Sets the fill bar's width proportionally (level/4 × 100%) and
         * updates both the bar background color and label text/color inline
         * to avoid needing additional CSS classes for each strength level.
         *
         * @param {string} password        - Current password input value.
         * @param {HTMLElement} fillEl     - The strength bar fill <div>.
         * @param {HTMLElement} labelEl    - The strength label <span>.
         */
        updateStrength(password, fillEl, labelEl) {
            const { level, label } = this.getStrength(password);
            fillEl.setAttribute('data-level', level);
            fillEl.style.width = (level / 4 * 100) + '%';

            // Color spectrum: empty → red → amber → blue → green
            const colors = ['', '#ff4444', '#f59e0b', '#38bdf8', '#00ff88'];
            fillEl.style.background = colors[level] || '';
            labelEl.textContent     = label;
            labelEl.style.color     = colors[level] || 'var(--text-muted)';
        },

        /**
         * Update the password-confirm match indicator below the confirm field.
         *
         * Applies CSS modifier classes to display colored match/mismatch text.
         * Class names "match-ok" and "match-fail" are used by tools-template.css.
         *
         * @param {string} password        - The primary password field value.
         * @param {string} confirm         - The confirmation password field value.
         * @param {HTMLElement} statusEl   - The match status display element.
         */
        updateMatch(password, confirm, statusEl) {
            if (!confirm) {
                // Confirm field is empty — show nothing
                statusEl.textContent = '';
                statusEl.className   = 'match-status stv-match-status';
                return;
            }
            if (password === confirm) {
                statusEl.textContent = '✓ Passwords match';
                statusEl.className   = 'match-status stv-match-status match-ok';
            } else {
                statusEl.textContent = '✗ Passwords do not match';
                statusEl.className   = 'match-status stv-match-status match-fail';
            }
        }
    };


    /* ========================================================================
       UI CONTROLLER
       Manages tab switching, button loading states, and inline error display.
    ======================================================================== */
    const UIController = {

        /**
         * Initialize the tab switcher by wiring click events to all .tab-btn
         * elements. Each button's data-tab attribute drives the switch target.
         */
        initTabs() {
            const buttons = document.querySelectorAll('.tab-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetTab = btn.dataset.tab;
                    this.switchTab(targetTab);
                });
            });
        },

        /**
         * Switch the active tab panel by toggling classes and ARIA attributes.
         *
         * For buttons: toggles .active and aria-selected="true/false".
         * For panels:  removes/adds the "hidden" attribute and .active class.
         *
         * @param {string} tabName - The target tab name ('encode' or 'decode').
         */
        switchTab(tabName) {
            // Update all tab button states
            document.querySelectorAll('.tab-btn').forEach(btn => {
                const isActive = btn.dataset.tab === tabName;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            // Update all tab panel visibility
            document.querySelectorAll('.tab-panel').forEach(panel => {
                const isActive = panel.id === `panel-${tabName}`;
                if (isActive) {
                    panel.removeAttribute('hidden');
                    panel.classList.add('active');
                } else {
                    panel.setAttribute('hidden', '');
                    panel.classList.remove('active');
                }
            });
        },

        /**
         * Put a button into its loading/processing state.
         * Disables the button and swaps the idle span for the loading spinner span.
         * These spans must exist inside the button as .btn-idle and .btn-loading.
         *
         * @param {HTMLButtonElement} btn - The button to update.
         */
        setButtonLoading(btn) {
            btn.disabled = true;
            const idle    = btn.querySelector('.btn-idle');
            const loading = btn.querySelector('.btn-loading');
            if (idle)    idle.hidden    = true;
            if (loading) loading.hidden = false;
        },

        /**
         * Restore a button to its normal idle state.
         * Re-enables the button and swaps the loading spinner back to idle.
         *
         * @param {HTMLButtonElement} btn - The button to restore.
         */
        setButtonIdle(btn) {
            btn.disabled = false;
            const idle    = btn.querySelector('.btn-idle');
            const loading = btn.querySelector('.btn-loading');
            if (idle)    idle.hidden    = false;
            if (loading) loading.hidden = true;
        },

        /**
         * Display an inline error message inside the given container element.
         * Injects a red ✖ icon followed by the error text.
         *
         * @param {HTMLElement} el  - The .stv-tool-error container element.
         * @param {string} message  - The error message to display.
         */
        showError(el, message) {
            el.hidden   = false;
            el.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${message}`;
        },

        /**
         * Hide and clear the given error container element.
         *
         * @param {HTMLElement} el - The error container to clear.
         */
        hideError(el) {
            el.hidden   = true;
            el.innerHTML = '';
        }
    };


    /* ========================================================================
       MAIN CONTROLLER — SteganoVault
       Orchestrates all modules, wires up callbacks, and manages the complete
       encode and decode workflows end to end.
    ======================================================================== */
    const SteganoVault = {

        /** ImageHandler instance for the Encode panel (context='encode') */
        encodeHandler: null,

        /** ImageHandler instance for the Decode panel (context='decode') */
        decodeHandler: null,

        /**
         * Application entry point — called once after the DOM is ready.
         *
         * Initializes all subsystems in dependency order:
         *   1. UIController.initTabs()       — wire tab switching
         *   2. createImageHandler × 2        — encode and decode upload handlers
         *   3. bindEncodeEvents()             — textarea, password, encode button
         *   4. bindDecodeEvents()             — decode button, copy, download
         *   5. bindPasswordToggleEvents()     — eye icon toggles for all pwd fields
         *   6. detectMobileLimitations()      — warn mobile users if needed
         */
        init() {
            console.log('[SteganoVault] Initializing Stegano Vault ULTRA MAX…');

            // Initialize subsystems
            UIController.initTabs();

            // Create independent image handlers for encode and decode contexts
            this.encodeHandler = createImageHandler('encode');
            this.decodeHandler = createImageHandler('decode');

            // Bind all upload/drop/clear events for both panels
            this.encodeHandler.bindEvents();
            this.decodeHandler.bindEvents();

            // Wire the encode image-load and image-clear callbacks
            this.encodeHandler.onLoad  = () => this.onEncodeImageLoad();
            this.encodeHandler.onClear = () => this.onEncodeImageClear();

            // Wire all remaining panel events
            this.bindEncodeEvents();
            this.bindDecodeEvents();
            this.bindPasswordToggleEvents();

            // Warn mobile users about potential Canvas API limitations
            this.detectMobileLimitations();

            console.log('[SteganoVault] Ready.');
        },


        /* ------------------------------------------------------------------
           MOBILE DETECTION & TOAST WARNING
           Informs mobile users that the tool uses Canvas + File APIs which
           may have limitations on some older mobile browsers. Does NOT block.
        ------------------------------------------------------------------ */

        /**
         * Detect common mobile browsers and display a gentle informational
         * toast via the global toast system if the user is on mobile.
         *
         * The check uses the userAgent string as a heuristic — not guaranteed
         * to be 100% accurate, but sufficient for a UX-level warning.
         */
        detectMobileLimitations() {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
                .test(navigator.userAgent);

            if (isMobile) {
                // Use global toast — success=false → info/warning style not needed.
                // Wrap in a slight delay so the page is fully rendered first.
                setTimeout(() => {
                    window.showToast(
                        'Mobile detected. For best results, use a desktop browser with a large image.'
                    );
                }, 1200);
            }
        },


        /* ------------------------------------------------------------------
           ENCODE PANEL EVENT BINDINGS
        ------------------------------------------------------------------ */

        /**
         * Bind all interactive events for the Encode panel:
         *   - Textarea input → live character counter + capacity bar update
         *   - Password field → strength meter + match check
         *   - Confirm field  → match check
         *   - Encode button  → run the full encode workflow
         */
        bindEncodeEvents() {
            const messageArea  = $('encode-message');
            const passwordEl   = $('encode-password');
            const confirmEl    = $('encode-password-confirm');
            const strengthFill = $('encode-strength-fill');
            const strengthLbl  = $('password-strength-label');
            const matchStatus  = $('password-match-status');
            const charCount    = $('char-count');
            const encodeBtn    = $('encode-btn');

            // ── Live character counter + real-time capacity bar update ──────
            messageArea.addEventListener('input', () => {
                const len = messageArea.value.length;
                charCount.textContent = len.toLocaleString();

                // Pass current dimensions and message length to CapacityAnalyzer
                CapacityAnalyzer.update(
                    this.encodeHandler.width,
                    this.encodeHandler.height,
                    len
                );
            });

            // ── Password strength meter ─────────────────────────────────────
            // Also re-validates match whenever the primary password changes
            passwordEl.addEventListener('input', () => {
                PasswordHelper.updateStrength(passwordEl.value, strengthFill, strengthLbl);
                PasswordHelper.updateMatch(passwordEl.value, confirmEl.value, matchStatus);
            });

            // ── Password confirm match check ────────────────────────────────
            confirmEl.addEventListener('input', () => {
                PasswordHelper.updateMatch(passwordEl.value, confirmEl.value, matchStatus);
            });

            // ── Encode button → launch runEncode() ─────────────────────────
            encodeBtn.addEventListener('click', () => this.runEncode());
        },

        /**
         * Called by the encodeHandler.onLoad callback after a new image loads.
         * Triggers an initial capacity analysis and resets the output area.
         */
        onEncodeImageLoad() {
            CapacityAnalyzer.update(
                this.encodeHandler.width,
                this.encodeHandler.height,
                $('encode-message').value.length
            );
            // Hide any previously generated download area and clear errors
            $('encode-download-area').hidden = true;
            UIController.hideError($('encode-error'));
        },

        /**
         * Called by the encodeHandler.onClear callback when the image is removed.
         * Resets the capacity analyzer to its blank state.
         */
        onEncodeImageClear() {
            CapacityAnalyzer.update(0, 0, 0);
            $('encode-download-area').hidden = true;
            UIController.hideError($('encode-error'));
        },


        /* ------------------------------------------------------------------
           ENCODE OPERATION
           Orchestrates the full AES-256 encrypt → LSB embed → PNG export flow.
        ------------------------------------------------------------------ */

            /**
         * Main encode workflow — triggered by the "Encode & Lock" button:
         *
         * STEP 1: Validate all inputs (image present, message, passwords).
         * STEP 2: Check message length against image pixel capacity.
         * STEP 3: AES-256-CBC encrypt the message with CryptoEngine.
         * STEP 4: Get raw pixel data from the encode canvas.
         * STEP 5: Embed ciphertext into pixel LSBs via SteganographyEngine.
         * STEP 6: Write modified pixels back to the canvas.
         * STEP 7: Export the canvas as a lossless PNG Data URL.
         * STEP 8: Set the download link href and output preview src.
         * STEP 9: Show the download area and fire a success toast.
         *
         * The heavy pixel manipulation uses await to yield to the browser
         * so it has a chance to repaint and show the loading spinner first.
         */
        async runEncode() {
            const messageEl    = $('encode-message');
            const passwordEl   = $('encode-password');
            const confirmEl    = $('encode-password-confirm');
            const encodeBtn    = $('encode-btn');
            const downloadArea = $('encode-download-area');
            const errorEl      = $('encode-error');

            // Clear any previous errors and hide the download area
            UIController.hideError(errorEl);
            downloadArea.hidden = true;

            // ── Input validation ────────────────────────────────────────────
            if (!this.encodeHandler.image) {
                UIController.showError(errorEl, 'Please upload a carrier image first.');
                return;
            }

            const message = messageEl.value.trim();
            if (!message) {
                UIController.showError(errorEl, 'Please enter a secret message to hide.');
                return;
            }

            const password = passwordEl.value;
            if (!password || password.length < MIN_PASSWORD_LENGTH) {
                UIController.showError(errorEl, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
                return;
            }

            if (password !== confirmEl.value) {
                UIController.showError(errorEl, 'Passwords do not match. Please re-enter.');
                return;
            }

            // ── Capacity check ──────────────────────────────────────────────
            const maxChars = SteganographyEngine.getMaxChars(
                this.encodeHandler.width,
                this.encodeHandler.height
            );

            if (message.length > maxChars) {
                UIController.showError(
                    errorEl,
                    `Message is too long! Image can hold ${maxChars.toLocaleString()} chars, ` +
                    `but your message has ${message.length.toLocaleString()} chars.`
                );
                return;
            }

            // ── Start processing — show loading spinner ──────────────────────
            UIController.setButtonLoading(encodeBtn);

            // Yield to the browser to repaint before the heavy computation
            await new Promise(resolve => setTimeout(resolve, 50));

            try {
                // STEP 3: AES-256 encrypt the message
                console.log('[SteganoVault] Encrypting message with AES-256…');
                const ciphertext = CryptoEngine.encrypt(message, password);
                console.log(`[SteganoVault] Ciphertext length: ${ciphertext.length} chars`);

                // STEP 4: Read raw pixel data from the canvas
                const imageData = this.encodeHandler.getImageData();
                if (!imageData) {
                    throw new Error('Failed to get image pixel data from canvas.');
                }

                // STEP 5: Embed the ciphertext into the pixel LSBs
                console.log('[SteganoVault] Embedding ciphertext into pixel LSBs…');
                const modifiedPixels = SteganographyEngine.encode(imageData.data, ciphertext);

                // STEP 6: Write modified pixels back onto the canvas
                this.encodeHandler.putImageData(modifiedPixels);

                // STEP 7: Export the canvas as a lossless PNG
                console.log('[SteganoVault] Exporting as lossless PNG…');
                const pngDataUrl = this.encodeHandler.exportPNG();

                // STEP 8: Populate the download link and output preview image
                const downloadLink   = $('encode-download-link');
                const outputPreview  = $('encode-output-preview');
                const outputFilename = 'stegano-vault-' +
                    (this.encodeHandler.filename.replace(/\.[^.]+$/, '') || 'output') + '.png';

                downloadLink.href     = pngDataUrl;
                downloadLink.download = outputFilename;
                outputPreview.src     = pngDataUrl;

                // STEP 9: Reveal the download area
                downloadArea.hidden = false;

                // Notify the user of success via global toast
                window.showToast('Message encoded and hidden successfully! Download your stegano PNG.');
                console.log('[SteganoVault] Encode complete.');

            } catch (err) {
                // Show the error inline and via toast
                console.error('[SteganoVault] Encode error:', err);
                UIController.showError(errorEl, err.message || 'An unexpected error occurred during encoding.');
                window.showToast('Encoding failed. See error details below.', true);
            } finally {
                // Always restore the button regardless of success or failure
                UIController.setButtonIdle(encodeBtn);
            }
        },


        /* ------------------------------------------------------------------
           DECODE PANEL EVENT BINDINGS
        ------------------------------------------------------------------ */

        /**
         * Bind events for the decode panel:
         *   - Decode button     → run the full decode workflow
         *   - Copy button       → copy decoded message to clipboard
         *   - Download button   → download decoded message as a .txt file
         */
        bindDecodeEvents() {
            const decodeBtn       = $('decode-btn');
            const copyBtn         = $('copy-decoded-btn');
            const downloadTextBtn = $('download-decoded-btn');

            // ── Decode button ───────────────────────────────────────────────
            decodeBtn.addEventListener('click', () => this.runDecode());

            // ── Copy decoded message to clipboard ───────────────────────────
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    const text = $('decode-output').textContent;
                    if (!text) return;
                    navigator.clipboard.writeText(text)
                        .then(() => window.showToast('Message copied to clipboard!'))
                        .catch(() => window.showToast('Failed to copy. Please select and copy manually.', true));
                });
            }

            // ── Download decoded message as a .txt file ─────────────────────
            // Creates a Blob URL, simulates a link click, then revokes the URL.
            if (downloadTextBtn) {
                downloadTextBtn.addEventListener('click', () => {
                    const text = $('decode-output').textContent;
                    if (!text) return;
                    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                    const url  = URL.createObjectURL(blob);
                    const a    = document.createElement('a');
                    a.href     = url;
                    a.download = 'stegano-vault-decoded.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url); // Free memory
                    window.showToast('Decoded message downloaded as .txt');
                });
            }
        },


        /* ------------------------------------------------------------------
           DECODE OPERATION
           Orchestrates the full LSB extraction → AES-256 decrypt → display flow.
        ------------------------------------------------------------------ */

          /**
         * Main decode workflow — triggered by the "Decode & Reveal" button:
         *
         * STEP 1: Validate inputs (stegano image loaded, password entered).
         * STEP 2: Get raw pixel data from the decode canvas.
         * STEP 3: Extract the hidden LSB payload via SteganographyEngine.decode().
         * STEP 4: Decrypt the extracted ciphertext via CryptoEngine.decrypt().
         * STEP 5: Display the revealed plaintext in the output card.
         *
         * Heavy computation uses await to allow the browser to render the loading state.
         */
        async runDecode() {
            const passwordEl = $('decode-password');
            const decodeBtn  = $('decode-btn');
            const resultCard = $('decode-result-card');
            const outputEl   = $('decode-output');
            const errorEl    = $('decode-error');

            // Clear previous result and error
            UIController.hideError(errorEl);
            resultCard.hidden = true;

            // ── Input validation ────────────────────────────────────────────
            if (!this.decodeHandler.image) {
                UIController.showError(errorEl, 'Please upload the stegano image (the PNG exported by this tool).');
                return;
            }

            const password = passwordEl.value;
            if (!password) {
                UIController.showError(errorEl, 'Please enter the decryption password.');
                return;
            }

            // ── Start processing — show loading spinner ──────────────────────
            UIController.setButtonLoading(decodeBtn);

            // Yield to the browser to repaint before the heavy computation
            await new Promise(resolve => setTimeout(resolve, 50));

            try {
                // STEP 2: Get raw pixel data from the canvas
                const imageData = this.decodeHandler.getImageData();
                if (!imageData) {
                    throw new Error('Failed to read pixel data from image.');
                }

                // STEP 3: Extract the LSB payload (ciphertext) from pixels
                console.log('[SteganoVault] Reading LSBs from pixel data…');
                const ciphertext = SteganographyEngine.decode(imageData.data);
                console.log(`[SteganoVault] Extracted ciphertext (${ciphertext.length} chars)`);

                // STEP 4: Decrypt the AES-256 ciphertext back to plaintext
                console.log('[SteganoVault] Decrypting with AES-256…');
                const plaintext = CryptoEngine.decrypt(ciphertext, password);

                // STEP 5: Display the revealed message
                outputEl.textContent = plaintext;
                resultCard.hidden    = false;

                // Notify the user of success via global toast
                window.showToast('Secret message revealed successfully!');
                console.log('[SteganoVault] Decode complete.');

            } catch (err) {
                // Show the error inline and via toast
                console.error('[SteganoVault] Decode error:', err);
                UIController.showError(errorEl, err.message || 'Failed to decode or decrypt. Check the image and password.');
                window.showToast('Decoding failed. See error below.', true);
            } finally {
                // Always restore the button regardless of outcome
                UIController.setButtonIdle(decodeBtn);
            }
        },


        /* ------------------------------------------------------------------
           PASSWORD VISIBILITY TOGGLES
        ------------------------------------------------------------------ */

        /**
         * Bind click listeners to every .toggle-password button on the page.
         *
         * Each button carries a data-target attribute containing the ID of the
         * password input it controls. On click:
         *   - Toggles the input type between 'password' (hidden) and 'text' (visible).
         *   - Swaps the FontAwesome eye icon (fa-eye ↔ fa-eye-slash).
         *   - Updates the aria-label for screen reader accessibility.
         */
        bindPasswordToggleEvents() {
            document.querySelectorAll('.toggle-password').forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetId = btn.dataset.target;
                    const input    = document.getElementById(targetId);
                    if (!input) return;

                    // Toggle between hidden and visible input types
                    const isHidden = input.type === 'password';
                    input.type = isHidden ? 'text' : 'password';

                    // Swap the eye/eye-slash icon
                    const icon = btn.querySelector('i');
                    if (icon) {
                        icon.classList.toggle('fa-eye',      !isHidden);
                        icon.classList.toggle('fa-eye-slash', isHidden);
                    }

                    // Update ARIA label for accessibility
                    btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
                });
            });
        }
    };


    /* ========================================================================
       BOOT — Initialize the application when the DOM is ready.
       Uses readyState check to handle both deferred and synchronous loading.
    ======================================================================== */
    if (document.readyState === 'loading') {
        // DOM not yet complete — wait for DOMContentLoaded event
        document.addEventListener('DOMContentLoaded', () => SteganoVault.init());
    } else {
        // DOM already ready (script loaded with defer or at bottom of <body>)
        SteganoVault.init();
    }

})(); // End IIFE — all variables are scoped, no global namespace pollution
