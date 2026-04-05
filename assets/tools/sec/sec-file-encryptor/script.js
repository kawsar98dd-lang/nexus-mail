/**
 * =============================================================================
 *  DATA VAULT ULTRA MAX — script.js
 *  AES-256 File Encryptor & Decryptor (Zero-Knowledge, Client-Side Only)
 *  Author  : MD KAWSAR
 *  Version : 1.0 (CodeCanyon Release Build)
 *  Path    : ../../assets/tools/sec/sec-file-encryptor/script.js
 * =============================================================================
 *
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  This script implements AES-256-CBC encryption and decryption entirely in
 *  the browser using CryptoJS. No data is ever sent to a server.
 *
 *  FLOW — ENCRYPT:
 *    File → FileReader (ArrayBuffer) → Uint8Array → CryptoJS WordArray
 *    → PBKDF2 key derivation (password + salt) → AES-256-CBC encrypt
 *    → Build .vault binary container → Blob → FileSaver download
 *
 *  FLOW — DECRYPT:
 *    .vault file → FileReader (ArrayBuffer) → parse header + segments
 *    → PBKDF2 key derivation (password + stored salt) → AES-256-CBC decrypt
 *    → WordArray → Uint8Array → Blob → FileSaver download
 *
 *  DECOY VAULT (Plausible Deniability):
 *    Two independent encrypted segments are written into the .vault container.
 *    Segment 0 = Real file, encrypted with real password's derived key.
 *    Segment 1 = Decoy file, encrypted with decoy password's derived key.
 *    At decryption time, both segments are attempted with the supplied password.
 *    Whichever one decrypts without error is served — with zero UI indication
 *    of which segment succeeded. A coerced user can supply the decoy password
 *    and yield only the harmless file, with no evidence the real one exists.
 *
 *  .VAULT BINARY FORMAT (version 1):
 *    [0..11]  Magic header: "DATAVAULT10"  (12 bytes, UTF-8)
 *    [12]     Format version: 0x01          (1 byte)
 *    [13]     Flags byte: bit0 = hasDecoy   (1 byte)
 *    [14..15] Number of segments (uint16 BE)(2 bytes)
 *    — Per segment: —
 *    [+0..+3]  Segment payload length (uint32 BE, 4 bytes) — ENCRYPTED blob length
 *    [+4..+35] Salt (32 bytes)
 *    [+36..+51]IV (16 bytes)
 *    [+52..N]  Encrypted blob (AES-256-CBC ciphertext)
 *    — After all segments —
 *    [+0..+3]  Metadata block length (uint32 BE)
 *    [+4..+N]  Encrypted metadata JSON (real metadata only, keyed to realPassword)
 *
 *  METADATA JSON (encrypted with real password key):
 *    { "fileName": "original.pdf", "mimeType": "application/pdf", "segmentIndex": 0 }
 *    For decoy:
 *    { "fileName": "groceries.txt", "mimeType": "text/plain", "segmentIndex": 1 }
 *    Each segment's metadata is encrypted independently with its own key.
 *
 * =============================================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────────────────────────── */

/** Magic bytes that identify a valid Data Vault file. 12 ASCII chars. */
const MAGIC_HEADER = 'DATAVAULT10\x01'; // 11 chars + version byte

/** PBKDF2 iteration count. Higher = slower brute-force. */
const PBKDF2_ITERATIONS = 100000;

/** PBKDF2 key size in 32-bit words (256 bits = 8 words). */
const KEY_SIZE_WORDS = 8;

/** AES-CBC IV size in bytes. */
const IV_SIZE_BYTES = 16;

/** PBKDF2 salt size in bytes. */
const SALT_SIZE_BYTES = 32;

/** Maximum recommended file size before showing a warning (200 MB). */
const WARN_SIZE_BYTES = 200 * 1024 * 1024;

/* ─────────────────────────────────────────────────────────────────────────
   APPLICATION STATE
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Holds references to selected File objects for each slot.
 * @type {{ real: File|null, decoy: File|null, vault: File|null }}
 */
const selectedFiles = {
    real:  null,
    decoy: null,
    vault: null
};

/**
 * Tracks whether Decoy Vault mode is currently enabled.
 * @type {boolean}
 */
let decoyModeEnabled = false;

/**
 * Tracks the currently active panel ('encrypt' | 'decrypt').
 * @type {string}
 */
let currentMode = 'encrypt';

/* ─────────────────────────────────────────────────────────────────────────
   MODE SWITCHING (Encrypt / Decrypt tabs)
   ───────────────────────────────────────────────────────────────────────── */

/**
 * switchMode — Activates the selected tab and its associated panel.
 * Called by the onclick of each .vault-tab button in the HTML.
 *
 * @param {string} mode - 'encrypt' or 'decrypt'
 */
function switchMode(mode) {
    currentMode = mode;

    // Update tab aria/active states
    document.getElementById('tab-encrypt').classList.toggle('active', mode === 'encrypt');
    document.getElementById('tab-decrypt').classList.toggle('active', mode === 'decrypt');

    document.getElementById('tab-encrypt').setAttribute('aria-selected', String(mode === 'encrypt'));
    document.getElementById('tab-decrypt').setAttribute('aria-selected', String(mode === 'decrypt'));

    // Show / hide panels
    document.getElementById('panel-encrypt').classList.toggle('active', mode === 'encrypt');
    document.getElementById('panel-decrypt').classList.toggle('active', mode === 'decrypt');

    // Reset the status card whenever mode changes
    hideStatusCard();
}

/* ─────────────────────────────────────────────────────────────────────────
   DECOY VAULT TOGGLE
   ───────────────────────────────────────────────────────────────────────── */

/**
 * toggleDecoyMode — Reads the Decoy Mode checkbox and shows/hides
 * the extra UI fields (decoy file zone, decoy password field).
 * Called by onchange of #decoyModeToggle.
 */
function toggleDecoyMode() {
    const checkbox = document.getElementById('decoyModeToggle');
    decoyModeEnabled = checkbox.checked;

    // Show/hide decoy file section
    document.getElementById('decoyFileSection').style.display   = decoyModeEnabled ? 'block' : 'none';

    // Show/hide decoy password field and expand password grid
    document.getElementById('decoyPasswordField').style.display = decoyModeEnabled ? 'block' : 'none';

    // Update the hint text
    const hintEl = document.getElementById('decoyHintText');
    if (decoyModeEnabled) {
        hintEl.innerHTML = '<i class="fa-solid fa-masks-theater" style="flex-shrink:0;color:var(--accent-purple);margin-top:2px;"></i> '
            + '<span><strong>Decoy Vault active.</strong> Set a <strong>Real File</strong> + Real Password, '
            + 'and a <strong>Dummy File</strong> + Fake Password. Both are locked into one .vault container. '
            + 'Entering either password at decryption will silently yield only its respective file.</span>';
    } else {
        hintEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> '
            + 'Enable Decoy Vault to set a real password + a fake "decoy" password. '
            + 'If coerced, give the decoy — it will decrypt a harmless dummy file instead.';
    }

    // Clear decoy file if toggled off
    if (!decoyModeEnabled) {
        selectedFiles.decoy = null;
        resetDropzone('dropzoneDecoy', 'decoyFileMeta');
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   DROP ZONE HANDLERS
   ───────────────────────────────────────────────────────────────────────── */

/**
 * handleDragOver — Adds drag-over styling and prevents default browser
 * behaviour (which would navigate to the dropped file).
 *
 * @param {DragEvent} event
 * @param {string}    zoneId - ID of the dropzone element
 */
function handleDragOver(event, zoneId) {
    event.preventDefault();
    document.getElementById(zoneId).classList.add('drag-over');
}

/**
 * handleDragLeave — Removes drag-over styling when cursor leaves zone.
 *
 * @param {string} zoneId - ID of the dropzone element
 */
function handleDragLeave(zoneId) {
    document.getElementById(zoneId).classList.remove('drag-over');
}

/**
 * handleDrop — Handles files dropped onto a dropzone.
 * Extracts the file from the DataTransfer object and delegates
 * to handleFileSelect for unified processing.
 *
 * @param {DragEvent} event
 * @param {string}    inputId - ID of the hidden <input type="file">
 */
function handleDrop(event, inputId) {
    event.preventDefault();

    // Map inputId → zoneId and metaId
    const map = {
        realFileInput:  { zoneId: 'dropzoneReal',  metaId: 'realFileMeta'  },
        decoyFileInput: { zoneId: 'dropzoneDecoy', metaId: 'decoyFileMeta' },
        vaultFileInput: { zoneId: 'dropzoneVault', metaId: 'vaultFileMeta' }
    };

    const { zoneId, metaId } = map[inputId] || {};
    if (!zoneId) return;

    document.getElementById(zoneId).classList.remove('drag-over');

    const dt = event.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) return;

    const file = dt.files[0];

    // Inject into the hidden input so handleFileSelect can work uniformly
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const input = document.getElementById(inputId);
    input.files = dataTransfer.files;

    handleFileSelect(inputId, zoneId, metaId);
}

/**
 * handleFileSelect — Called when a file is chosen (either via input
 * click or drag-and-drop). Updates state and dropzone visual feedback.
 *
 * @param {string} inputId - ID of the <input type="file"> element
 * @param {string} zoneId  - ID of the .dropzone element
 * @param {string} metaId  - ID of the .dropzone-meta element
 */
function handleFileSelect(inputId, zoneId, metaId) {
    const input = document.getElementById(inputId);
    const zone  = document.getElementById(zoneId);
    const meta  = document.getElementById(metaId);

    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Store reference in state
    if (inputId === 'realFileInput')  selectedFiles.real  = file;
    if (inputId === 'decoyFileInput') selectedFiles.decoy = file;
    if (inputId === 'vaultFileInput') selectedFiles.vault = file;

    // Visual feedback — mark zone as having a file
    zone.classList.add('has-file');
    zone.classList.remove('drag-over');

    // Display file name + size in meta area
    const sizeStr = formatFileSize(file.size);
    meta.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> 
        <strong>${escapeHtml(file.name)}</strong> &nbsp;(${sizeStr})`;

    // Warn if file is very large
    if (file.size > WARN_SIZE_BYTES) {
        showToast('⚠️ Large file detected. Processing may take a moment on mobile devices.', false);
    }

    // For encrypt mode: auto-fill the output filename from the real file
    if (inputId === 'realFileInput') {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        document.getElementById('encryptOutputName').value = nameWithoutExt;
        // Also start the strength meter listeners if not already running
        attachStrengthMeter('realPassword', 'strengthBarReal', 'strengthLabelReal');
    }

    // Reset status card when new file is chosen
    hideStatusCard();
}

/* ─────────────────────────────────────────────────────────────────────────
   PASSWORD STRENGTH METER
   ───────────────────────────────────────────────────────────────────────── */

/**
 * attachStrengthMeter — Binds an 'input' event listener to a password field
 * that updates a visual strength bar in real-time.
 *
 * Scoring:
 *   +1 if length >= 8
 *   +1 if contains uppercase & lowercase
 *   +1 if contains a digit
 *   +1 if contains a symbol
 *   Score 1 = Weak, 2 = Fair, 3 = Good, 4 = Strong
 *
 * @param {string} inputId  - ID of the password <input>
 * @param {string} barId    - ID of the .strength-bar <div>
 * @param {string} labelId  - ID of the .strength-label <span>
 */
function attachStrengthMeter(inputId, barId, labelId) {
    const input = document.getElementById(inputId);
    if (!input || input._strengthListenerAttached) return;
    input._strengthListenerAttached = true;

    input.addEventListener('input', () => {
        const val = input.value;
        const bar   = document.getElementById(barId);
        const label = document.getElementById(labelId);

        if (!val) {
            bar.setAttribute('data-level', '');
            bar.style.width = '0%';
            label.textContent = '';
            label.className = 'strength-label';
            return;
        }

        let score = 0;
        if (val.length >= 8)                              score++;
        if (/[a-z]/.test(val) && /[A-Z]/.test(val))      score++;
        if (/[0-9]/.test(val))                            score++;
        if (/[^a-zA-Z0-9]/.test(val))                    score++;

        const levels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
        const classes = ['', 'weak', 'fair', 'good', 'strong'];

        bar.setAttribute('data-level', String(score));
        label.textContent = levels[score] || '';
        label.className   = 'strength-label ' + (classes[score] || '');
    });
}

/* ─────────────────────────────────────────────────────────────────────────
   PASSWORD VISIBILITY TOGGLE
   ───────────────────────────────────────────────────────────────────────── */

/**
 * toggleVisibility — Toggles an input between type="password" and type="text",
 * updating the eye icon accordingly.
 *
 * @param {string}      inputId - ID of the password input
 * @param {HTMLElement} btn     - The eye button element (passed via onclick)
 */
function toggleVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon  = btn.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fa-solid fa-eye';
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   ENCRYPTION ENTRY POINT
   ───────────────────────────────────────────────────────────────────────── */

/**
 * runEncrypt — Main entry point for the "Encrypt & Download" button.
 * Validates inputs, reads file(s) as ArrayBuffer, encrypts, and triggers download.
 *
 * Async because file reading and heavy crypto work are done in promises/chunks.
 */
async function runEncrypt() {
    hideStatusCard();

    // ── Validate file selection ──
    if (!selectedFiles.real) {
        showToast('Please select a file to encrypt.', true);
        return;
    }

    const realPassword = document.getElementById('realPassword').value.trim();
    if (!realPassword) {
        showToast('Please enter a real encryption password.', true);
        return;
    }

    // Validate decoy fields if Decoy Mode is on
    if (decoyModeEnabled) {
        if (!selectedFiles.decoy) {
            showToast('Decoy Vault enabled: please also select a dummy/decoy file.', true);
            return;
        }
        const decoyPassword = document.getElementById('decoyPassword').value.trim();
        if (!decoyPassword) {
            showToast('Decoy Vault enabled: please enter a decoy/fake password.', true);
            return;
        }
        if (realPassword === decoyPassword) {
            showToast('Real and decoy passwords must be different.', true);
            return;
        }
    }

    // ── Disable UI while processing ──
    setEncryptUIBusy(true);

    try {
        // Determine output filename
        const rawName   = document.getElementById('encryptOutputName').value.trim();
        const outputName = (rawName || selectedFiles.real.name.replace(/\.[^/.]+$/, '')) + '.vault';

        // Step 1: Read real file as ArrayBuffer
        showEncryptProgress(10, 'Reading file…');
        const realBuffer = await readFileAsArrayBuffer(selectedFiles.real);

        let vaultBlob;

        if (decoyModeEnabled) {
            // Step 2a: Read decoy file
            showEncryptProgress(20, 'Reading decoy file…');
            const decoyBuffer = await readFileAsArrayBuffer(selectedFiles.decoy);

            const decoyPassword = document.getElementById('decoyPassword').value.trim();

            // Step 3a: Encrypt both segments
            showEncryptProgress(35, 'Encrypting real segment…');
            const realSegment  = encryptSegment(realBuffer,  realPassword,  selectedFiles.real.name,  selectedFiles.real.type);

            showEncryptProgress(65, 'Encrypting decoy segment…');
            const decoySegment = encryptSegment(decoyBuffer, decoyPassword, selectedFiles.decoy.name, selectedFiles.decoy.type);

            // Step 4a: Build vault container with two segments
            showEncryptProgress(85, 'Building vault container…');
            vaultBlob = buildVaultBlob([realSegment, decoySegment], true);

        } else {
            // Step 3b: Encrypt single segment
            showEncryptProgress(40, 'Encrypting…');
            const realSegment = encryptSegment(realBuffer, realPassword, selectedFiles.real.name, selectedFiles.real.type);

            // Step 4b: Build vault container with one segment
            showEncryptProgress(85, 'Building vault container…');
            vaultBlob = buildVaultBlob([realSegment], false);
        }

        // Step 5: Trigger download
        showEncryptProgress(100, 'Done!');
        saveAs(vaultBlob, outputName);

        showStatusCard(
            'success',
            '🔒 Encryption Successful!',
            `Saved as <strong>${escapeHtml(outputName)}</strong> — ${formatFileSize(vaultBlob.size)}`
            + (decoyModeEnabled ? ' · Decoy Vault included' : '')
        );

        showToast('File encrypted successfully!', false);

    } catch (err) {
        console.error('[DataVault] Encrypt error:', err);
        showStatusCard('error', '⚠️ Encryption Failed', err.message || 'An unexpected error occurred.');
        showToast('Encryption failed: ' + (err.message || 'Unknown error'), true);
    } finally {
        setEncryptUIBusy(false);
        setTimeout(() => showEncryptProgress(0, ''), 2000);
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   DECRYPTION ENTRY POINT
   ───────────────────────────────────────────────────────────────────────── */

/**
 * runDecrypt — Main entry point for the "Decrypt & Download" button.
 * Validates inputs, parses the .vault file, decrypts the correct segment
 * (based on which password succeeds), and triggers a download.
 */
async function runDecrypt() {
    hideStatusCard();

    if (!selectedFiles.vault) {
        showToast('Please select a .vault file to decrypt.', true);
        return;
    }

    const password = document.getElementById('decryptPassword').value.trim();
    if (!password) {
        showToast('Please enter the decryption password.', true);
        return;
    }

    setDecryptUIBusy(true);

    try {
        showDecryptProgress(10, 'Reading vault file…');
        const vaultBuffer = await readFileAsArrayBuffer(selectedFiles.vault);

        showDecryptProgress(25, 'Parsing vault container…');
        const segments = parseVaultBlob(vaultBuffer);

        if (!segments || segments.length === 0) {
            throw new Error('Invalid or corrupted .vault file. The magic header is missing or unrecognized.');
        }

        showDecryptProgress(40, 'Attempting decryption…');

        // ── Try each segment until one succeeds with the given password ──
        // This is the core of the Decoy Vault system. Both segments are
        // attempted silently. No UI difference is shown for which one succeeded.
        let decryptedResult = null;

        for (let i = 0; i < segments.length; i++) {
            showDecryptProgress(40 + Math.round((i / segments.length) * 40), `Testing segment ${i + 1}…`);
            const result = tryDecryptSegment(segments[i], password);
            if (result !== null) {
                decryptedResult = result;
                break;
            }
        }

        if (!decryptedResult) {
            throw new Error('Incorrect password. The file could not be decrypted. Please check your password and try again.');
        }

        showDecryptProgress(90, 'Restoring original file…');

        // Build a Blob from the decrypted bytes with the original MIME type
        const outputBlob = new Blob(
            [decryptedResult.data],
            { type: decryptedResult.mimeType || 'application/octet-stream' }
        );

        const outputFilename = decryptedResult.fileName || 'decrypted-file';

        showDecryptProgress(100, 'Done!');
        saveAs(outputBlob, outputFilename);

        showStatusCard(
            'success',
            '🔓 Decryption Successful!',
            `Restored: <strong>${escapeHtml(outputFilename)}</strong> — ${formatFileSize(outputBlob.size)}`
        );

        showToast('File decrypted and downloaded!', false);

    } catch (err) {
        console.error('[DataVault] Decrypt error:', err);
        showStatusCard('error', '⚠️ Decryption Failed', err.message || 'An unexpected error occurred.');
        showToast('Decryption failed: ' + (err.message || 'Unknown error'), true);
    } finally {
        setDecryptUIBusy(false);
        setTimeout(() => showDecryptProgress(0, ''), 2000);
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   CORE CRYPTO: ENCRYPT ONE SEGMENT
   ───────────────────────────────────────────────────────────────────────── */

/**
 * encryptSegment — Encrypts a single ArrayBuffer with the given password.
 * Returns an object containing all the data needed to write a vault segment.
 *
 * Steps:
 *  1. Generate a cryptographically random 32-byte salt and 16-byte IV.
 *  2. Derive a 256-bit AES key via PBKDF2-SHA512 with 100,000 iterations.
 *  3. Convert the file ArrayBuffer to a CryptoJS WordArray.
 *  4. Prepend a small metadata JSON (filename, MIME type) to the plaintext
 *     so it travels with the encrypted payload.
 *  5. AES-256-CBC encrypt the combined plaintext.
 *  6. Return { saltBytes, ivBytes, ciphertextBytes } for vault building.
 *
 * @param {ArrayBuffer} fileBuffer    - Raw bytes of the file to encrypt
 * @param {string}      password      - The password to derive the key from
 * @param {string}      originalName  - Original filename (stored in metadata)
 * @param {string}      mimeType      - Original MIME type (stored in metadata)
 * @returns {{ saltBytes: Uint8Array, ivBytes: Uint8Array, ciphertextBytes: Uint8Array }}
 */
function encryptSegment(fileBuffer, password, originalName, mimeType) {
    // 1. Generate random salt and IV
    const saltWordArray = CryptoJS.lib.WordArray.random(SALT_SIZE_BYTES);
    const ivWordArray   = CryptoJS.lib.WordArray.random(IV_SIZE_BYTES);

    // 2. Derive AES-256 key via PBKDF2
    const key = CryptoJS.PBKDF2(password, saltWordArray, {
        keySize:    KEY_SIZE_WORDS,
        iterations: PBKDF2_ITERATIONS,
        hasher:     CryptoJS.algo.SHA512
    });

    // 3. Build metadata object and encode to UTF-8 bytes
    const meta     = JSON.stringify({ fileName: originalName, mimeType: mimeType || 'application/octet-stream' });
    const metaBytes = new TextEncoder().encode(meta);

    // 4. Build the plaintext = [4-byte meta length][meta bytes][file bytes]
    //    The 4-byte meta length prefix allows the decryptor to split them apart.
    const fileBytes     = new Uint8Array(fileBuffer);
    const combined      = new Uint8Array(4 + metaBytes.length + fileBytes.length);
    const metaLenView   = new DataView(combined.buffer);
    metaLenView.setUint32(0, metaBytes.length, false); // big-endian
    combined.set(metaBytes, 4);
    combined.set(fileBytes, 4 + metaBytes.length);

    // 5. Convert combined Uint8Array → CryptoJS WordArray
    const plaintextWordArray = uint8ArrayToWordArray(combined);

    // 6. AES-256-CBC encrypt
    const encrypted = CryptoJS.AES.encrypt(plaintextWordArray, key, {
        iv:      ivWordArray,
        mode:    CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    // 7. Convert ciphertext WordArray → Uint8Array
    const ciphertextBytes = wordArrayToUint8Array(encrypted.ciphertext);

    // 8. Export salt and IV as Uint8Arrays for vault writing
    const saltBytes = wordArrayToUint8Array(saltWordArray);
    const ivBytes   = wordArrayToUint8Array(ivWordArray);

    return { saltBytes, ivBytes, ciphertextBytes };
}

/* ─────────────────────────────────────────────────────────────────────────
   CORE CRYPTO: DECRYPT ONE SEGMENT
   ───────────────────────────────────────────────────────────────────────── */

/**
 * tryDecryptSegment — Attempts to decrypt a single vault segment with the
 * given password. Returns null silently if decryption fails (wrong password
 * or corrupted data), which is how the Decoy Vault system works without
 * leaking which segment was "real".
 *
 * @param {{ saltBytes: Uint8Array, ivBytes: Uint8Array, ciphertextBytes: Uint8Array }} segment
 * @param {string} password
 * @returns {{ data: Uint8Array, fileName: string, mimeType: string }|null}
 */
function tryDecryptSegment(segment, password) {
    try {
        const { saltBytes, ivBytes, ciphertextBytes } = segment;

        // 1. Reconstruct CryptoJS WordArrays from stored bytes
        const saltWordArray = uint8ArrayToWordArray(saltBytes);
        const ivWordArray   = uint8ArrayToWordArray(ivBytes);

        // 2. Re-derive the key (same PBKDF2 parameters — deterministic)
        const key = CryptoJS.PBKDF2(password, saltWordArray, {
            keySize:    KEY_SIZE_WORDS,
            iterations: PBKDF2_ITERATIONS,
            hasher:     CryptoJS.algo.SHA512
        });

        // 3. Wrap ciphertext bytes into a CryptoJS ciphertext params object
        const ciphertextWordArray = uint8ArrayToWordArray(ciphertextBytes);
        const cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: ciphertextWordArray
        });

        // 4. AES-256-CBC decrypt
        const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
            iv:      ivWordArray,
            mode:    CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        // 5. Convert decrypted WordArray → Uint8Array
        //    A zero-length result or wrong size means wrong password.
        if (!decrypted || decrypted.sigBytes <= 0) return null;

        const combinedBytes = wordArrayToUint8Array(decrypted);

        // 6. Parse the [4-byte metaLen][meta JSON][file bytes] structure
        if (combinedBytes.length < 4) return null;

        const metaView = new DataView(combinedBytes.buffer, combinedBytes.byteOffset, combinedBytes.byteLength);
        const metaLen  = metaView.getUint32(0, false); // big-endian

        if (metaLen > combinedBytes.length - 4) return null; // sanity check

        const metaBytes  = combinedBytes.slice(4, 4 + metaLen);
        const fileBytes  = combinedBytes.slice(4 + metaLen);

        // 7. Decode and parse the metadata JSON
        let fileName = 'decrypted-file';
        let mimeType = 'application/octet-stream';

        try {
            const metaStr = new TextDecoder().decode(metaBytes);
            const meta    = JSON.parse(metaStr);
            if (meta.fileName) fileName = meta.fileName;
            if (meta.mimeType) mimeType = meta.mimeType;
        } catch (_) {
            // Metadata parse failed — probably wrong password produced garbage.
            // Return null to indicate failure.
            return null;
        }

        return { data: fileBytes, fileName, mimeType };

    } catch (_) {
        // Any error (PKCS7 unpad error, etc.) means wrong password — return null silently.
        return null;
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   VAULT CONTAINER: BUILD
   ───────────────────────────────────────────────────────────────────────── */

/**
 * buildVaultBlob — Assembles the binary .vault container from one or more
 * encrypted segments and returns a Blob ready for download.
 *
 * Binary layout:
 *   [MAGIC_HEADER: 12 bytes]
 *   [flags:  1 byte  — bit0 = hasDecoy]
 *   [numSegs:2 bytes — uint16 BE]
 *   For each segment:
 *     [payloadLen: 4 bytes  — uint32 BE — length of ciphertextBytes only]
 *     [salt:      32 bytes]
 *     [iv:        16 bytes]
 *     [ciphertext: payloadLen bytes]
 *
 * @param {Array<{saltBytes:Uint8Array, ivBytes:Uint8Array, ciphertextBytes:Uint8Array}>} segments
 * @param {boolean} hasDecoy
 * @returns {Blob}
 */
function buildVaultBlob(segments, hasDecoy) {
    // Calculate total byte length
    const headerLen = MAGIC_HEADER.length + 1 + 2; // magic + flags + numSegs
    const segDataLen = segments.reduce((sum, seg) => {
        return sum + 4 + SALT_SIZE_BYTES + IV_SIZE_BYTES + seg.ciphertextBytes.length;
    }, 0);

    const totalLen   = headerLen + segDataLen;
    const buffer     = new ArrayBuffer(totalLen);
    const view       = new DataView(buffer);
    const bytes      = new Uint8Array(buffer);

    let offset = 0;

    // Write magic header (ASCII)
    for (let i = 0; i < MAGIC_HEADER.length; i++) {
        bytes[offset++] = MAGIC_HEADER.charCodeAt(i);
    }

    // Write flags byte
    bytes[offset++] = hasDecoy ? 0x01 : 0x00;

    // Write number of segments (uint16 BE)
    view.setUint16(offset, segments.length, false);
    offset += 2;

    // Write each segment
    for (const seg of segments) {
        // Payload length (ciphertext only — uint32 BE)
        view.setUint32(offset, seg.ciphertextBytes.length, false);
        offset += 4;

        // Salt (32 bytes)
        bytes.set(seg.saltBytes, offset);
        offset += SALT_SIZE_BYTES;

        // IV (16 bytes)
        bytes.set(seg.ivBytes, offset);
        offset += IV_SIZE_BYTES;

        // Ciphertext
        bytes.set(seg.ciphertextBytes, offset);
        offset += seg.ciphertextBytes.length;
    }

    return new Blob([buffer], { type: 'application/octet-stream' });
}

/* ─────────────────────────────────────────────────────────────────────────
   VAULT CONTAINER: PARSE
   ───────────────────────────────────────────────────────────────────────── */

/**
 * parseVaultBlob — Reads and validates the binary .vault container from an
 * ArrayBuffer, returning an array of segment objects.
 *
 * @param {ArrayBuffer} buffer
 * @returns {Array<{saltBytes:Uint8Array, ivBytes:Uint8Array, ciphertextBytes:Uint8Array}>|null}
 */
function parseVaultBlob(buffer) {
    const bytes  = new Uint8Array(buffer);
    const view   = new DataView(buffer);

    // Validate magic header
    for (let i = 0; i < MAGIC_HEADER.length; i++) {
        if (bytes[i] !== MAGIC_HEADER.charCodeAt(i)) {
            return null; // Not a valid .vault file
        }
    }

    let offset = MAGIC_HEADER.length;

    // Read flags (1 byte) — currently used for hasDecoy but not needed for parsing
    /*const flags =*/ bytes[offset++]; // consume flags byte

    // Read number of segments (uint16 BE)
    const numSegs = view.getUint16(offset, false);
    offset += 2;

    if (numSegs < 1 || numSegs > 16) {
        throw new Error('Vault file is corrupted: invalid segment count.');
    }

    const segments = [];

    for (let i = 0; i < numSegs; i++) {
        if (offset + 4 > bytes.length) throw new Error('Vault file is truncated at segment ' + i);

        // Payload length (uint32 BE)
        const payloadLen = view.getUint32(offset, false);
        offset += 4;

        if (offset + SALT_SIZE_BYTES + IV_SIZE_BYTES + payloadLen > bytes.length) {
            throw new Error('Vault file is truncated: segment ' + i + ' data is incomplete.');
        }

        // Salt
        const saltBytes = bytes.slice(offset, offset + SALT_SIZE_BYTES);
        offset += SALT_SIZE_BYTES;

        // IV
        const ivBytes = bytes.slice(offset, offset + IV_SIZE_BYTES);
        offset += IV_SIZE_BYTES;

        // Ciphertext
        const ciphertextBytes = bytes.slice(offset, offset + payloadLen);
        offset += payloadLen;

        segments.push({ saltBytes, ivBytes, ciphertextBytes });
    }

    return segments;
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: FILE READER
   ───────────────────────────────────────────────────────────────────────── */

/**
 * readFileAsArrayBuffer — Wraps the FileReader API in a Promise so it
 * can be used with async/await cleanly.
 *
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve(e.target.result);
        reader.onerror = ()  => reject(new Error('Failed to read file: ' + file.name));
        reader.readAsArrayBuffer(file);
    });
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: CRYPTOJS <-> UINT8ARRAY CONVERSIONS
   ───────────────────────────────────────────────────────────────────────── */

/**
 * uint8ArrayToWordArray — Converts a Uint8Array to a CryptoJS WordArray.
 * CryptoJS works internally with 32-bit word arrays; files are Uint8Arrays.
 *
 * @param {Uint8Array} u8arr
 * @returns {CryptoJS.lib.WordArray}
 */
function uint8ArrayToWordArray(u8arr) {
    const words = [];
    for (let i = 0; i < u8arr.length; i += 4) {
        words.push(
            ((u8arr[i]     || 0) << 24) |
            ((u8arr[i + 1] || 0) << 16) |
            ((u8arr[i + 2] || 0) <<  8) |
             (u8arr[i + 3] || 0)
        );
    }
    return CryptoJS.lib.WordArray.create(words, u8arr.length);
}

/**
 * wordArrayToUint8Array — Converts a CryptoJS WordArray back to a Uint8Array.
 * Used to convert encrypted/decrypted data for Blob construction.
 *
 * @param {CryptoJS.lib.WordArray} wordArray
 * @returns {Uint8Array}
 */
function wordArrayToUint8Array(wordArray) {
    const words  = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8arr  = new Uint8Array(sigBytes);

    for (let i = 0; i < sigBytes; i++) {
        u8arr[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8arr;
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: UI STATE MANAGEMENT
   ───────────────────────────────────────────────────────────────────────── */

/**
 * setEncryptUIBusy — Disables/re-enables the encrypt button and shows a
 * loading spinner while the operation is in progress.
 *
 * @param {boolean} isBusy
 */
function setEncryptUIBusy(isBusy) {
    const btn     = document.getElementById('btnEncrypt');
    const btnText = document.getElementById('btnEncryptText');
    btn.disabled  = isBusy;
    if (isBusy) {
        btnText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> &nbsp;Encrypting…';
        document.getElementById('encryptProgressWrapper').style.display = 'block';
    } else {
        btnText.innerHTML = 'Encrypt &amp; Download';
    }
}

/**
 * setDecryptUIBusy — Disables/re-enables the decrypt button.
 *
 * @param {boolean} isBusy
 */
function setDecryptUIBusy(isBusy) {
    const btn     = document.getElementById('btnDecrypt');
    const btnText = document.getElementById('btnDecryptText');
    btn.disabled  = isBusy;
    if (isBusy) {
        btnText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> &nbsp;Decrypting…';
        document.getElementById('decryptProgressWrapper').style.display = 'block';
    } else {
        btnText.innerHTML = 'Decrypt &amp; Download';
    }
}

/**
 * showEncryptProgress — Updates the encrypt progress bar and label.
 *
 * @param {number} percent  - 0–100
 * @param {string} label    - Status text
 */
function showEncryptProgress(percent, label) {
    const wrapper = document.getElementById('encryptProgressWrapper');
    const fill    = document.getElementById('encryptProgressFill');
    const lbl     = document.getElementById('encryptProgressLabel');

    if (percent === 0 && !label) {
        wrapper.style.display = 'none';
        fill.style.width = '0%';
        return;
    }

    wrapper.style.display = 'block';
    fill.style.width  = percent + '%';
    lbl.textContent   = label;
}

/**
 * showDecryptProgress — Updates the decrypt progress bar and label.
 *
 * @param {number} percent  - 0–100
 * @param {string} label    - Status text
 */
function showDecryptProgress(percent, label) {
    const wrapper = document.getElementById('decryptProgressWrapper');
    const fill    = document.getElementById('decryptProgressFill');
    const lbl     = document.getElementById('decryptProgressLabel');

    if (percent === 0 && !label) {
        wrapper.style.display = 'none';
        fill.style.width = '0%';
        return;
    }

    wrapper.style.display = 'block';
    fill.style.width  = percent + '%';
    lbl.textContent   = label;
}

/**
 * showStatusCard — Displays the vault status card with a success or error message.
 *
 * @param {'success'|'error'} type
 * @param {string}            title   - Bold first line
 * @param {string}            sub     - Secondary line (supports HTML for <strong>)
 */
function showStatusCard(type, title, sub) {
    const card  = document.getElementById('vaultStatusCard');
    const icon  = document.getElementById('vaultStatusIcon');
    const titleEl = document.getElementById('vaultStatusTitle');
    const subEl   = document.getElementById('vaultStatusSub');

    card.className = 'vault-status-card ' + type;
    icon.innerHTML = type === 'success'
        ? '<i class="fa-solid fa-shield-check"></i>'
        : '<i class="fa-solid fa-circle-exclamation"></i>';

    titleEl.textContent = title;
    subEl.innerHTML     = sub;

    card.style.display = 'flex';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * hideStatusCard — Hides the vault status card.
 */
function hideStatusCard() {
    const card = document.getElementById('vaultStatusCard');
    if (card) card.style.display = 'none';
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: DROPZONE RESET
   ───────────────────────────────────────────────────────────────────────── */

/**
 * resetDropzone — Clears a dropzone's has-file state and meta text.
 *
 * @param {string} zoneId - ID of the .dropzone element
 * @param {string} metaId - ID of the .dropzone-meta element
 */
function resetDropzone(zoneId, metaId) {
    const zone = document.getElementById(zoneId);
    const meta = document.getElementById(metaId);
    if (zone) zone.classList.remove('has-file');
    if (meta) meta.innerHTML = '';
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: FILE SIZE FORMATTER
   ───────────────────────────────────────────────────────────────────────── */

/**
 * formatFileSize — Converts a byte count to a human-readable string.
 *
 * @param {number} bytes
 * @returns {string}  e.g. "1.23 MB"
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPER: XSS PREVENTION
   ───────────────────────────────────────────────────────────────────────── */

/**
 * escapeHtml — Escapes user-supplied strings before inserting into innerHTML.
 * Prevents XSS in status messages that display filenames.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ─────────────────────────────────────────────────────────────────────────
   FALLBACK TOAST (if global.js hasn't loaded yet)
   ───────────────────────────────────────────────────────────────────────── */

/**
 * If the global showToast() from global.js isn't available yet,
 * we provide a no-op fallback to prevent errors. The real function
 * is attached to window by global.js and will override this.
 */
if (typeof window.showToast !== 'function') {
    window.showToast = function(msg, isError) {
        console[isError ? 'error' : 'info']('[DataVault Toast]', msg);
    };
}

/* ─────────────────────────────────────────────────────────────────────────
   INITIALISATION
   ───────────────────────────────────────────────────────────────────────── */

/**
 * init — Called once the DOM is ready.
 * Attaches all event listeners that can't be set inline (e.g., strength meters,
 * keyboard accessibility improvements).
 */
function init() {
    // Attach real-time strength meter to the Real Password field
    attachStrengthMeter('realPassword', 'strengthBarReal', 'strengthLabelReal');

    // Keyboard "Enter" submission shortcut on password fields
    ['realPassword', 'decoyPassword', 'encryptOutputName'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') runEncrypt();
            });
        }
    });

    document.getElementById('decryptPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runDecrypt();
    });

    // Expose functions used in HTML onclick attributes to the global scope.
    // (Not strictly necessary in non-module scripts, but explicit is cleaner.)
    window.switchMode         = switchMode;
    window.toggleDecoyMode    = toggleDecoyMode;
    window.handleDragOver     = handleDragOver;
    window.handleDragLeave    = handleDragLeave;
    window.handleDrop         = handleDrop;
    window.handleFileSelect   = handleFileSelect;
    window.toggleVisibility   = toggleVisibility;
    window.runEncrypt         = runEncrypt;
    window.runDecrypt         = runDecrypt;
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
