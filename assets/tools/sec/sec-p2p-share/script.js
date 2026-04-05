/**
 * ============================================================================
 * P2P SHARE VAULT ULTRA — script.js
 * ============================================================================
 * Category  : sec
 * Tool ID   : sec-p2p-share
 * Author    : MD KAWSAR | Trusted Tools Web
 * Version   : 1.0.0
 * License   : CodeCanyon Regular / Extended License
 *
 * ARCHITECTURE OVERVIEW:
 * ──────────────────────────────────────────────────────────────────────────
 * This tool implements a 100% client-side, zero-server WebRTC peer-to-peer
 * file sharing system. No file data ever touches a third-party server.
 *
 * CORE TECHNOLOGY STACK:
 * ──────────────────────────────────────────────────────────────────────────
 * 1. WebRTC (RTCPeerConnection)
 *    - ICE via Google STUN: stun:stun.l.google.com:19302
 *    - Manual SDP Offer/Answer exchange (no signaling server required)
 *    - RTCDataChannel for binary file data transport
 *
 * 2. AES-256 Encryption (CryptoJS)
 *    - Each 64KB chunk is encrypted before sending over the data channel
 *    - Decrypted on arrival using the shared passphrase
 *    - The encryption key is NEVER transmitted — only the ciphertext travels
 *
 * 3. File Chunking (FileReader + ArrayBuffer)
 *    - Files are sliced into CHUNK_SIZE (64KB) pieces
 *    - Each chunk is tagged with { index, total, fileName, transferId }
 *    - The receiver buffers all chunks and reassembles the file on completion
 *
 * 4. Folder ZIP (JSZip)
 *    - Folders are compressed in-browser to a single .zip file
 *    - The zip is then chunked and encrypted for transfer
 *    - Preserves the full directory structure inside the archive
 *
 * 5. QR Code Integration
 *    - QRCode.js generates scannable QR images from the SDP Offer/Answer text
 *    - Html5Qrcode reads QR codes via the device camera
 *
 * 6. Toast Notifications
 *    - All user feedback uses the global window.showToast() system
 *    - Error toasts use boolean `true` as the second argument
 *    - Info/warning toasts use the default (no second argument)
 *
 * SECURITY NOTES:
 * ──────────────────────────────────────────────────────────────────────────
 * - The AES-256 passphrase MUST be exchanged out-of-band (not through WebRTC)
 * - STUN servers are used only for NAT traversal, not for data routing
 * - All file data is encrypted before it enters the WebRTC data channel
 * ============================================================================
 */

'use strict';

// ============================================================================
// SECTION 1: CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * CHUNK_SIZE — 64KB file chunk size for WebRTC data channel transport.
 *
 * This balances two competing concerns:
 * - Larger chunks → fewer round-trip messages, higher throughput
 * - Smaller chunks → less risk of buffer overflow on congested connections
 * 64KB is the widely accepted sweet spot for WebRTC binary channels.
 */
const CHUNK_SIZE = 64 * 1024; // 64KB

/**
 * MAX_BUFFERED_AMOUNT — Backpressure threshold for the RTCDataChannel.
 *
 * If the channel's send buffer exceeds this value (1MB), the sender pauses
 * and waits for the buffer to drain. This prevents packet loss on slow
 * or congested peer connections (e.g., mobile hotspot, cross-continent).
 */
const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1MB

/**
 * ICE_SERVERS — Google STUN server list for NAT traversal.
 *
 * STUN helps two peers behind NAT routers discover each other's public
 * IP:Port pair. No file data is routed through STUN — only the initial
 * ICE candidate exchange during connection setup uses these servers.
 */
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * PROTOCOL_VERSION — Version tag embedded in every data channel message.
 * Useful for backward-compatible upgrades in future releases.
 */
const PROTOCOL_VERSION = 'PSV1';

/**
 * MSG_TYPE — Enum-like object defining all recognized message type strings
 * sent over the WebRTC data channel. Each type maps to a handler.
 */
const MSG_TYPE = {
    META  : 'META',   // File metadata: name, size, totalChunks, etc.
    CHUNK : 'CHUNK',  // Encrypted file chunk payload (AES-256 ciphertext)
    DONE  : 'DONE',   // Signals all chunks for one file have been sent
    ACK   : 'ACK',    // Acknowledgment from receiver (reserved for future use)
    PING  : 'PING',   // Keep-alive ping to detect stale connections
};

// ============================================================================
// SECTION 2: STATE MANAGEMENT
// ============================================================================

/**
 * State — Centralized mutable application state object.
 *
 * All runtime state lives here. This avoids scattered global variables and
 * makes the reset logic (resetConnection) clean and reliable.
 *
 * Properties:
 *  - pc           : The RTCPeerConnection instance (null when disconnected)
 *  - dataChannel  : The RTCDataChannel used for sending/receiving file chunks
 *  - isConnected  : True once the data channel 'open' event fires
 *  - isSender     : True if this peer generated the Offer (sender role)
 *  - encKey       : The AES-256 passphrase entered by the user
 *  - fileQueue    : Array of File objects queued for sending (sender side)
 *  - sendIndex    : Tracks which file in the queue is currently being sent
 *  - stats        : Live transfer metrics used to update the dashboard
 *  - receiveBuffer: Maps transferId → { chunks[], meta } for incoming files
 *  - scanner      : The Html5Qrcode instance (null when not scanning)
 *  - scanTarget   : Which textarea to fill after a successful QR scan
 *  - qrOffer/qrAnswer : QRCode.js instances for the SDP QR displays
 *  - statsInterval: setInterval handle for the speed/ETA polling loop
 */
const State = {
    // WebRTC core
    pc           : null,
    dataChannel  : null,
    isConnected  : false,
    isSender     : false,

    // AES-256 encryption key (passphrase, never transmitted)
    encKey       : '',

    // File queue (sender side)
    fileQueue    : [],
    sendIndex    : 0,

    // Transfer statistics (updated every 500ms by the stats interval)
    stats: {
        startTime  : 0,
        bytesSent  : 0,
        totalBytes : 0,
        chunksSent : 0,
        lastUpdate : 0,
        lastBytes  : 0,
        speed      : 0,
    },

    // Receiver-side chunk buffer: keyed by transferId
    receiveBuffer : {},

    // QR scanner state
    scanner       : null,  // Html5Qrcode instance
    scanTarget    : null,  // 'offer' | 'answer'

    // QR code generation instances
    qrOffer       : null,
    qrAnswer      : null,

    // Stats polling interval handle
    statsInterval : null,
};

// ============================================================================
// SECTION 3: DOM ELEMENT REFERENCES
// ============================================================================

/**
 * DOM — Cached references to all HTML elements used by this script.
 *
 * Centralizing DOM lookups here:
 * 1. Avoids repeated getElementById calls throughout the code
 * 2. Makes it easy to verify all required elements exist on load
 * 3. Keeps the rest of the code readable with short property names
 *
 * IMPORTANT: These id / class values MUST match the HTML exactly.
 *            Never rename them without updating the HTML to match.
 */
const DOM = {
    // ── STATUS BAR ──────────────────────────────────────────────────────
    statusBar     : document.getElementById('statusBar'),
    statusDot     : document.getElementById('statusDot'),
    statusLabel   : document.getElementById('statusLabel'),
    statusMeta    : document.getElementById('statusMeta'),
    btnReset      : document.getElementById('btnResetConnection'),

    // ── PANEL TABS (Sender / Receiver toggle) ───────────────────────────
    tabs          : document.querySelectorAll('.p2p-panel-tab'),
    tabContents   : document.querySelectorAll('.p2p-tab-content'),

    // ── SENDER TAB ELEMENTS ─────────────────────────────────────────────
    encryptionKey        : document.getElementById('encryptionKey'),
    btnToggleKey         : document.getElementById('btnToggleKey'),
    btnGenKey            : document.getElementById('btnGenKey'),
    btnGenerateOffer     : document.getElementById('btnGenerateOffer'),
    offerBox             : document.getElementById('offerBox'),
    offerSDP             : document.getElementById('offerSDP'),
    btnCopyOffer         : document.getElementById('btnCopyOffer'),
    btnShowQR            : document.getElementById('btnShowQR'),
    qrContainer          : document.getElementById('qrContainer'),
    qrCodeOffer          : document.getElementById('qrCodeOffer'),
    answerInputGroup     : document.getElementById('answerInputGroup'),
    answerSDP            : document.getElementById('answerSDP'),
    btnConnectWithAnswer : document.getElementById('btnConnectWithAnswer'),
    btnScanAnswerQR      : document.getElementById('btnScanAnswerQR'),

    // ── RECEIVER TAB ELEMENTS ───────────────────────────────────────────
    recvEncryptionKey  : document.getElementById('recvEncryptionKey'),
    btnToggleRecvKey   : document.getElementById('btnToggleRecvKey'),
    recvOfferSDP       : document.getElementById('recvOfferSDP'),
    btnGenerateAnswer  : document.getElementById('btnGenerateAnswer'),
    btnScanOfferQR     : document.getElementById('btnScanOfferQR'),
    answerBox          : document.getElementById('answerBox'),
    answerSDPOutput    : document.getElementById('answerSDPOutput'),
    btnCopyAnswer      : document.getElementById('btnCopyAnswer'),
    btnShowAnswerQR    : document.getElementById('btnShowAnswerQR'),
    qrAnswerContainer  : document.getElementById('qrAnswerContainer'),
    qrCodeAnswer       : document.getElementById('qrCodeAnswer'),

    // ── FILE TRANSFER UI ─────────────────────────────────────────────────
    overlayRequired  : document.getElementById('overlayRequired'),
    transferUI       : document.getElementById('transferUI'),
    dropZone         : document.getElementById('dropZone'),
    fileInput        : document.getElementById('fileInput'),
    folderInput      : document.getElementById('folderInput'),
    btnBrowseFiles   : document.getElementById('btnBrowseFiles'),
    btnBrowseFolder  : document.getElementById('btnBrowseFolder'),
    fileQueue        : document.getElementById('fileQueue'),
    queueList        : document.getElementById('queueList'),
    btnClearQueue    : document.getElementById('btnClearQueue'),
    btnSendAll       : document.getElementById('btnSendAll'),

    // ── LIVE DASHBOARD ───────────────────────────────────────────────────
    liveDashboard    : document.getElementById('liveDashboard'),
    dashPhase        : document.getElementById('dashPhase'),
    cpFill           : document.getElementById('cpFill'),
    cpPercent        : document.getElementById('cpPercent'),
    speedValue       : document.getElementById('speedValue'),
    speedometerFill  : document.getElementById('speedometerFill'),
    etaValue         : document.getElementById('etaValue'),
    sizeValue        : document.getElementById('sizeValue'),
    sizeUnit         : document.getElementById('sizeUnit'),
    chunksValue      : document.getElementById('chunksValue'),
    progressFill     : document.getElementById('progressFill'),
    progressGlow     : document.getElementById('progressGlow'),
    currentFileName  : document.getElementById('currentFileName'),
    progressText     : document.getElementById('progressText'),

    // ── RECEIVED FILES SECTION ───────────────────────────────────────────
    receivedSection  : document.getElementById('receivedSection'),
    receivedCount    : document.getElementById('receivedCount'),
    receivedList     : document.getElementById('receivedList'),

    // ── QR SCANNER OVERLAY ───────────────────────────────────────────────
    scannerOverlay   : document.getElementById('scanner-overlay'),
    btnCloseScanner  : document.getElementById('btnCloseScanner'),

    // ── SUCCESS OVERLAY ──────────────────────────────────────────────────
    successOverlay   : document.getElementById('successOverlay'),
    successTitle     : document.getElementById('successTitle'),
    successMessage   : document.getElementById('successMessage'),
    btnSuccessClose  : document.getElementById('btnSuccessClose'),
};

// ============================================================================
// SECTION 4: INITIALIZATION
// ============================================================================

/**
 * DOMContentLoaded — Bootstrap all event listeners once the DOM is ready.
 *
 * Initialization order:
 *  1. Tab switching system
 *  2. Encryption key controls (show/hide/generate)
 *  3. WebRTC Offer flow (sender role)
 *  4. WebRTC Answer flow (receiver role)
 *  5. File drop zone + queue management
 *  6. QR camera scanner overlay
 *  7. Transfer success overlay
 *  8. Scroll-triggered animations (IntersectionObserver)
 *  9. SVG gradient injection for circular progress ring
 * 10. Mobile API compatibility check via global toast
 */
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initKeyControls();
    initOfferFlow();
    initAnswerFlow();
    initDropZone();
    initScannerOverlay();
    initSuccessOverlay();
    initScrollAnimations();
    injectSVGGradient();

    // Bind the global reset button
    DOM.btnReset.addEventListener('click', resetConnection);

    // Set initial status bar to disconnected state
    setStatus('disconnected', 'NOT CONNECTED', 'Generate an Offer to start a secure session');

    // ── MOBILE API COMPATIBILITY CHECK ────────────────────────────────────
    // WebRTC P2P file transfer requires RTCPeerConnection and RTCDataChannel.
    // On older or restricted mobile browsers these may be unavailable.
    // We warn the user early via the global toast without blocking the UI.
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile && !window.RTCPeerConnection) {
        window.showToast(
            'WebRTC Not Supported — your mobile browser does not support WebRTC P2P. Try Chrome on Android or Safari 15+ on iOS.',
            true
        );
    }
});

// ============================================================================
// SECTION 5: TAB SYSTEM
// ============================================================================

/**
 * initTabs — Sender / Receiver tab toggle logic.
 *
 * Clicking a .p2p-panel-tab button:
 * 1. Removes .active from all tab buttons
 * 2. Adds .active to the clicked button
 * 3. Hides all .p2p-tab-content panels
 * 4. Shows only the panel whose id matches data-tab
 */
function initTabs() {
    DOM.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            // Deactivate all tab buttons and activate the clicked one
            DOM.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Toggle visibility of the corresponding tab content panel
            DOM.tabContents.forEach(c => {
                c.classList.toggle('active', c.id === target);
            });
        });
    });
}

// ============================================================================
// SECTION 6: ENCRYPTION KEY CONTROLS
// ============================================================================

/**
 * initKeyControls — Binds events for the AES-256 passphrase inputs.
 *
 * Handles:
 *  - Show/hide toggle for both sender and receiver key fields
 *  - Random key generation (32-byte cryptographic hex string)
 */
function initKeyControls() {

    // Toggle show/hide for the sender's key field
    DOM.btnToggleKey.addEventListener('click', () => {
        togglePasswordVisibility(DOM.encryptionKey, DOM.btnToggleKey);
    });

    // Toggle show/hide for the receiver's key field
    DOM.btnToggleRecvKey.addEventListener('click', () => {
        togglePasswordVisibility(DOM.recvEncryptionKey, DOM.btnToggleRecvKey);
    });

    // Generate a random 64-character hex passphrase (32 bytes = 256 bits)
    DOM.btnGenKey.addEventListener('click', () => {
        const randomKey = generateRandomKey();
        DOM.encryptionKey.value = randomKey;
        DOM.encryptionKey.type  = 'text'; // Reveal the key so the user can copy it
        DOM.btnToggleKey.querySelector('i').className = 'fa-solid fa-eye-slash';
        window.showToast('Key Generated — share this key with the receiver via a separate secure channel.');
    });
}

/**
 * togglePasswordVisibility — Switches a password input between text and password type.
 *
 * @param {HTMLInputElement} input - The password input element to toggle.
 * @param {HTMLButtonElement} btn  - The button whose icon must also update.
 */
function togglePasswordVisibility(input, btn) {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('i').className = isHidden
        ? 'fa-solid fa-eye-slash'  // Key is now visible
        : 'fa-solid fa-eye';       // Key is now hidden
}

/**
 * generateRandomKey — Creates a cryptographically secure 32-byte hex string.
 *
 * Uses the Web Crypto API (window.crypto.getRandomValues) which is
 * cryptographically strong and available in all modern browsers.
 * The resulting 64-character hex string serves as the AES-256 passphrase.
 *
 * @returns {string} A 64-character lowercase hex string.
 */
function generateRandomKey() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// SECTION 7: WEBRTC — SENDER FLOW (Offer Generation)
// ============================================================================

/**
 * initOfferFlow — Binds all event listeners for the Sender tab.
 *
 * Button → Function mapping:
 *  btnGenerateOffer     → generateOffer()       : Create the WebRTC offer SDP
 *  btnCopyOffer         → copyText()            : Copy offer to clipboard
 *  btnShowQR            → toggleOfferQR()       : Toggle QR code display
 *  btnConnectWithAnswer → handleAnswerInput()   : Complete the handshake
 *  btnScanAnswerQR      → startScanner('answer'): Scan receiver's answer QR
 */
function initOfferFlow() {
    DOM.btnGenerateOffer.addEventListener('click', generateOffer);
    DOM.btnCopyOffer.addEventListener('click', () => copyText(DOM.offerSDP.value, 'Offer SDP copied!'));
    DOM.btnShowQR.addEventListener('click', toggleOfferQR);
    DOM.btnConnectWithAnswer.addEventListener('click', handleAnswerInput);
    DOM.btnScanAnswerQR.addEventListener('click', () => startScanner('answer'));
}

/**
 * generateOffer — SENDER STEP 1: Create a WebRTC Offer SDP.
 *
 * Full flow:
 *  1. Validate the encryption key is not empty
 *  2. Create an RTCPeerConnection with Google STUN servers
 *  3. Create the RTCDataChannel ('vault') — sender always creates it
 *  4. Create an SDP offer and set it as the local description
 *  5. Wait for ICE gathering to complete (trickle-free for copy-paste)
 *  6. Display the full SDP offer JSON for the user to share
 *
 * The "trickle-free" approach waits for ALL ICE candidates to be embedded
 * in the SDP before displaying it. This makes manual copy-paste reliable
 * since the receiver gets the complete session description in one text block.
 */
async function generateOffer() {
    const key = DOM.encryptionKey.value.trim();
    if (!key) {
        window.showToast('Please enter an encryption passphrase first.', true);
        return;
    }

    State.encKey  = key;
    State.isSender = true;

    // Tear down any previous connection attempt before creating a new one
    cleanupPeerConnection();

    setStatus('connecting', 'CREATING SESSION', 'Gathering ICE candidates...');
    DOM.btnGenerateOffer.disabled = true;
    DOM.btnGenerateOffer.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gathering...';

    try {
        // Create the RTCPeerConnection with the configured STUN servers
        State.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        /**
         * Create the data channel BEFORE creating the offer.
         * This is a WebRTC protocol requirement: the sender creates the
         * channel; the receiver will receive it via the 'ondatachannel' event.
         * `ordered: true` ensures chunks arrive in the correct sequence.
         */
        State.dataChannel = State.pc.createDataChannel('vault', {
            ordered: true,
        });

        // Attach open/close/message handlers to the channel
        setupDataChannelEvents(State.dataChannel);

        // Monitor ICE and connection state transitions
        State.pc.oniceconnectionstatechange = handleICEStateChange;
        State.pc.onconnectionstatechange    = handleConnectionStateChange;

        /**
         * Wait for ICE gathering to complete before exposing the SDP.
         * We use a Promise that resolves when iceGatheringState === 'complete'.
         * A fallback timeout of 8 seconds prevents hanging on restrictive networks.
         */
        await new Promise((resolve, reject) => {
            State.pc.onicegatheringstatechange = () => {
                if (State.pc.iceGatheringState === 'complete') resolve();
            };
            setTimeout(resolve, 8000); // Fallback: 8s max wait for ICE gathering

            State.pc.createOffer()
                .then(offer => State.pc.setLocalDescription(offer))
                .catch(reject);
        });

        // Package the final SDP (with all ICE candidates embedded) as JSON
        const offerSDP = State.pc.localDescription.sdp;
        const offerPayload = JSON.stringify({
            type    : 'offer',
            sdp     : offerSDP,
            version : PROTOCOL_VERSION,
        });

        // Show the offer text box and reveal the answer input area
        DOM.offerSDP.value                  = offerPayload;
        DOM.offerBox.style.display          = 'block';
        DOM.answerInputGroup.style.display  = 'block';

        DOM.btnGenerateOffer.disabled = false;
        DOM.btnGenerateOffer.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Regenerate Offer';

        setStatus('connecting', 'WAITING FOR ANSWER', 'Share the Offer SDP with the receiver');
        window.showToast('Offer Ready — copy the SDP and send it to the receiver.');

    } catch (err) {
        console.error('[WebRTC] Offer generation failed:', err);
        DOM.btnGenerateOffer.disabled = false;
        DOM.btnGenerateOffer.innerHTML = '<i class="fa-solid fa-bolt"></i> Generate Offer SDP';
        setStatus('error', 'OFFER FAILED', err.message);
        window.showToast('Offer generation failed: ' + err.message, true);
    }
}

/**
 * handleAnswerInput — SENDER STEP 3: Apply the receiver's Answer SDP.
 *
 * The receiver sends back an Answer SDP after generating one from the Offer.
 * We parse the JSON payload, verify it is a valid 'answer' type, then set
 * it as the remote description to complete the WebRTC handshake.
 * WebRTC will then attempt direct ICE connectivity between both peers.
 */
async function handleAnswerInput() {
    const rawAnswer = DOM.answerSDP.value.trim();
    if (!rawAnswer) {
        window.showToast("Paste the receiver's Answer SDP first.", true);
        return;
    }

    try {
        const payload = JSON.parse(rawAnswer);
        if (payload.type !== 'answer') throw new Error('Invalid answer format.');

        // setRemoteDescription completes the SDP negotiation on the sender side
        await State.pc.setRemoteDescription(new RTCSessionDescription({
            type : 'answer',
            sdp  : payload.sdp,
        }));

        setStatus('connecting', 'CONNECTING', 'Establishing secure channel...');
        window.showToast('Connecting — WebRTC handshake in progress...');

    } catch (err) {
        console.error('[WebRTC] Answer handling failed:', err);
        window.showToast('Could not parse the Answer SDP. Please verify it and try again.', true);
    }
}

// ============================================================================
// SECTION 8: WEBRTC — RECEIVER FLOW (Answer Generation)
// ============================================================================

/**
 * initAnswerFlow — Binds all event listeners for the Receiver tab.
 *
 * Button → Function mapping:
 *  btnGenerateAnswer → generateAnswer()       : Create the WebRTC answer SDP
 *  btnScanOfferQR    → startScanner('offer')  : Scan sender's offer QR
 *  btnCopyAnswer     → copyText()             : Copy answer to clipboard
 *  btnShowAnswerQR   → toggleAnswerQR()       : Toggle answer QR code display
 */
function initAnswerFlow() {
    DOM.btnGenerateAnswer.addEventListener('click', generateAnswer);
    DOM.btnScanOfferQR.addEventListener('click', () => startScanner('offer'));
    DOM.btnCopyAnswer.addEventListener('click', () => copyText(DOM.answerSDPOutput.value, 'Answer SDP copied!'));
    DOM.btnShowAnswerQR.addEventListener('click', toggleAnswerQR);
}

/**
 * generateAnswer — RECEIVER STEP 2: Parse the Offer SDP and generate an Answer.
 *
 * Full flow:
 *  1. Validate that both the Offer SDP and encryption key are provided
 *  2. Create an RTCPeerConnection with STUN servers
 *  3. Set the sender's offer as the remote description
 *  4. CRITICAL: The receiver does NOT create a data channel.
 *     Instead, it listens for the 'ondatachannel' event fired by WebRTC
 *     when the sender's channel negotiation is received.
 *  5. Create an Answer SDP and set it as the local description
 *  6. Wait for ICE gathering to complete
 *  7. Display the Answer SDP for the receiver to send back to the sender
 *
 * Once the sender sets this answer as their remote description, WebRTC
 * will automatically attempt ICE connectivity between both peers.
 */
async function generateAnswer() {
    const rawOffer = DOM.recvOfferSDP.value.trim();
    const key      = DOM.recvEncryptionKey.value.trim();

    if (!rawOffer) {
        window.showToast("Paste the sender's Offer SDP first.", true);
        return;
    }
    if (!key) {
        window.showToast('Enter the encryption passphrase from the sender.', true);
        return;
    }

    State.encKey   = key;
    State.isSender = false;

    cleanupPeerConnection();

    DOM.btnGenerateAnswer.disabled = true;
    DOM.btnGenerateAnswer.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const payload = JSON.parse(rawOffer);
        if (payload.type !== 'offer') throw new Error('Not a valid offer SDP.');

        // Create RTCPeerConnection with the same STUN configuration
        State.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        /**
         * RECEIVER-ONLY: Listen for the data channel created by the sender.
         * WebRTC fires 'ondatachannel' when the sender's channel is negotiated.
         * We must NOT create our own channel — this is a protocol requirement.
         */
        State.pc.ondatachannel = (event) => {
            State.dataChannel = event.channel;
            setupDataChannelEvents(State.dataChannel);
        };

        State.pc.oniceconnectionstatechange = handleICEStateChange;
        State.pc.onconnectionstatechange    = handleConnectionStateChange;

        // Apply the sender's offer as the remote description
        await State.pc.setRemoteDescription(new RTCSessionDescription({
            type : 'offer',
            sdp  : payload.sdp,
        }));

        /**
         * Wait for ICE gathering to complete before packaging the answer.
         * Same trickle-free approach as the offer: all ICE candidates
         * must be embedded before we show the answer to the user.
         */
        await new Promise((resolve) => {
            State.pc.onicegatheringstatechange = () => {
                if (State.pc.iceGatheringState === 'complete') resolve();
            };
            setTimeout(resolve, 8000); // Fallback: 8s max wait

            State.pc.createAnswer()
                .then(answer => State.pc.setLocalDescription(answer))
                .catch(() => resolve());
        });

        // Package the answer SDP for the receiver to send back
        const answerPayload = JSON.stringify({
            type    : 'answer',
            sdp     : State.pc.localDescription.sdp,
            version : PROTOCOL_VERSION,
        });

        DOM.answerSDPOutput.value   = answerPayload;
        DOM.answerBox.style.display = 'block';

        DOM.btnGenerateAnswer.disabled = false;
        DOM.btnGenerateAnswer.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Regenerate';

        setStatus('connecting', 'ANSWER READY', 'Send the Answer SDP back to the Sender');
        window.showToast('Answer Ready — copy the Answer SDP and send it back to the sender.');

    } catch (err) {
        console.error('[WebRTC] Answer generation failed:', err);
        DOM.btnGenerateAnswer.disabled = false;
        DOM.btnGenerateAnswer.innerHTML = '<i class="fa-solid fa-handshake"></i> Generate Answer SDP';
        setStatus('error', 'ANSWER FAILED', err.message);
        window.showToast('Answer generation failed: ' + err.message, true);
    }
}

// ============================================================================
// SECTION 9: DATA CHANNEL EVENT HANDLERS
// ============================================================================

/**
 * setupDataChannelEvents — Attaches all necessary event listeners to the RTCDataChannel.
 *
 * The data channel is the encrypted tunnel through which file chunks flow.
 * This function must be called both when the SENDER creates the channel
 * AND when the RECEIVER receives it via 'ondatachannel'.
 *
 * Events handled:
 *  - onopen    : Channel is ready; unlock the file transfer UI
 *  - onclose   : Channel closed; re-lock the UI and notify the user
 *  - onerror   : Log and toast channel errors
 *  - onmessage : Route incoming messages to the appropriate handler by type
 *
 * @param {RTCDataChannel} channel - The WebRTC data channel to configure.
 */
function setupDataChannelEvents(channel) {
    // Set binary transport mode — file chunks are sent as ArrayBuffers
    channel.binaryType = 'arraybuffer';

    /**
     * onopen — The data channel is open and ready for file transfer.
     * This fires only after the full ICE negotiation and DTLS handshake
     * have completed successfully on BOTH sides.
     */
    channel.onopen = () => {
        console.log('[DataChannel] Open and ready.');
        State.isConnected = true;
        unlockTransferUI();
        setStatus('connected', 'SECURE CHANNEL ACTIVE', 'AES-256 encrypted tunnel established');
        window.showToast('Connected! Secure AES-256 P2P channel is active. Ready to transfer.');
    };

    /**
     * onclose — The data channel has been closed (normal or abnormal).
     * Re-locks the transfer UI and resets the connection state.
     */
    channel.onclose = () => {
        console.log('[DataChannel] Closed.');
        State.isConnected = false;
        setStatus('disconnected', 'DISCONNECTED', 'The secure channel was closed');
        window.showToast('Disconnected — the P2P channel was closed.');
        lockTransferUI();
    };

    /**
     * onerror — An error occurred on the data channel.
     * Logs the error and notifies the user via the global toast.
     */
    channel.onerror = (err) => {
        console.error('[DataChannel] Error:', err);
        window.showToast('A data channel error occurred.', true);
    };

    /**
     * onmessage — Every incoming message is a JSON-encoded object.
     *
     * We parse the JSON and route to the correct handler based on msg.type:
     *  - META  : Store file metadata and initialize the receive buffer
     *  - CHUNK : Decrypt and store the incoming encrypted file chunk
     *  - DONE  : Reassemble all chunks and trigger the file download
     *  - PING  : Echo back a PONG to keep the connection alive
     */
    channel.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case MSG_TYPE.META  : handleIncomingMeta(msg);  break;
                case MSG_TYPE.CHUNK : handleIncomingChunk(msg); break;
                case MSG_TYPE.DONE  : handleIncomingDone(msg);  break;
                case MSG_TYPE.PING  : channel.send(JSON.stringify({ type: 'PONG' })); break;
                default             : console.warn('[DataChannel] Unknown message type:', msg.type);
            }
        } catch (e) {
            console.error('[DataChannel] Message parse error:', e);
        }
    };
}

// ============================================================================
// SECTION 10: SENDER — FILE SENDING PIPELINE
// ============================================================================

/**
 * sendAllFiles — Entry point for sending all queued files sequentially.
 *
 * Validates prerequisites, then iterates the file queue one file at a time.
 * Uses a for loop (not Promise.all) to ensure chunks are sent in order
 * and the data channel buffer has time to drain between files.
 *
 * On completion, shows the success overlay with a summary message.
 */
async function sendAllFiles() {
    if (!State.isConnected) {
        window.showToast('Establish a secure connection first.', true);
        return;
    }
    if (State.fileQueue.length === 0) {
        window.showToast('Add files or folders to the queue first.');
        return;
    }

    DOM.btnSendAll.disabled = true;
    State.sendIndex         = 0;

    // Pre-calculate total bytes across all queued files for the progress bar
    State.stats.totalBytes = State.fileQueue.reduce((sum, f) => sum + f.size, 0);
    State.stats.bytesSent  = 0;
    State.stats.startTime  = Date.now();

    showDashboard();

    // Send files one at a time — sequential ensures predictable ordering
    for (let i = 0; i < State.fileQueue.length; i++) {
        const file = State.fileQueue[i];
        updateQueueItemStatus(i, 'sending');
        setDashPhase('ENCRYPTING');

        try {
            await sendSingleFile(file, i);
            updateQueueItemStatus(i, 'done');
        } catch (err) {
            console.error('[Send] File failed:', file.name, err);
            updateQueueItemStatus(i, 'error');
            window.showToast(`Failed to send "${file.name}".`, true);
        }
    }

    DOM.btnSendAll.disabled = false;
    stopStatsInterval();
    setDashPhase('COMPLETE');
    showSuccessOverlay(
        'All Files Sent!',
        `${State.fileQueue.length} file(s) transferred securely.`
    );
}

/**
 * sendSingleFile — Sends a single File through the data channel.
 *
 * Full pipeline for one file:
 *  Step A: Send the META message so the receiver can initialize its buffer
 *  Step B: Read the file in CHUNK_SIZE slices, encrypt each with AES-256,
 *          and send them over the data channel with backpressure control
 *  Step C: Send the DONE signal to tell the receiver to reassemble & download
 *
 * @param {File}   file        - The File object to transmit.
 * @param {number} queueIndex  - Index in the visual queue list (for status updates).
 */
async function sendSingleFile(file, queueIndex) {
    const transferId  = generateTransferId();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // ── STEP A: Send file metadata ──────────────────────────────────────────
    // The receiver MUST receive META before any CHUNK messages so it can
    // allocate a pre-sized chunks array and display the file name in the UI.
    const meta = {
        type        : MSG_TYPE.META,
        transferId,
        fileName    : file.name,
        fileSize    : file.size,
        fileType    : file.type || 'application/octet-stream',
        totalChunks,
        version     : PROTOCOL_VERSION,
    };
    sendJSON(meta);

    // Update the dashboard's current file name display
    DOM.currentFileName.innerHTML = `<i class="fa-solid fa-file-shield"></i> ${escapeHtml(file.name)}`;
    startStatsInterval();

    // ── STEP B: Read, encrypt, and send chunks ──────────────────────────────
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {

        // Slice the file to get the bytes for this chunk only
        const start = chunkIndex * CHUNK_SIZE;
        const end   = Math.min(start + CHUNK_SIZE, file.size);
        const blob  = file.slice(start, end);

        // Read the slice as a raw ArrayBuffer (binary bytes)
        const arrayBuffer = await readAsArrayBuffer(blob);

        // Convert the ArrayBuffer to a Base64 string for JSON serialization
        const base64Chunk = arrayBufferToBase64(arrayBuffer);

        /**
         * AES-256 ENCRYPTION
         * ──────────────────────────────────────────────────────────────────
         * CryptoJS.AES.encrypt uses CBC mode with PKCS7 padding by default.
         * When given a passphrase string (not a WordArray key), CryptoJS
         * internally derives a key using PBKDF2 and generates a random salt
         * and IV, which are prepended to the ciphertext output.
         *
         * This means:
         * - Each chunk gets a unique IV even with the same passphrase
         * - The passphrase is NEVER transmitted — only the ciphertext
         * - The receiver's CryptoJS.AES.decrypt extracts the salt+IV automatically
         */
        setDashPhase('ENCRYPTING');
        const encrypted = CryptoJS.AES.encrypt(base64Chunk, State.encKey).toString();

        // Package the encrypted chunk with its positional metadata
        setDashPhase('TRANSMITTING');
        const chunkMsg = {
            type        : MSG_TYPE.CHUNK,
            transferId,
            chunkIndex,
            totalChunks,
            data        : encrypted, // AES-256 ciphertext (Base64-encoded)
        };
        sendJSON(chunkMsg);

        /**
         * BACKPRESSURE CONTROL
         * ──────────────────────────────────────────────────────────────────
         * If the data channel's internal send buffer exceeds MAX_BUFFERED_AMOUNT
         * (1MB), we pause and wait for it to drain below the threshold.
         * This prevents buffer overflow which would cause chunk loss and
         * a corrupted file on the receiver side.
         */
        if (State.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
            await waitForBufferDrain();
        }

        // Accumulate stats for the dashboard
        State.stats.bytesSent  += (end - start);
        State.stats.chunksSent += 1;
        updateProgressUI(State.stats.bytesSent, State.stats.totalBytes, chunkIndex + 1, totalChunks);
    }

    // ── STEP C: Signal transfer complete for this file ──────────────────────
    sendJSON({ type: MSG_TYPE.DONE, transferId, fileName: file.name });
}

/**
 * waitForBufferDrain — Pauses sending until the data channel buffer is below threshold.
 *
 * Uses recursive setTimeout polling (every 50ms) instead of a blocking loop
 * to avoid freezing the browser's event loop while waiting.
 *
 * @returns {Promise<void>} Resolves when the buffer is safely below 50% of the max.
 */
function waitForBufferDrain() {
    return new Promise(resolve => {
        const check = () => {
            if (!State.dataChannel || State.dataChannel.bufferedAmount < MAX_BUFFERED_AMOUNT / 2) {
                resolve();
            } else {
                setTimeout(check, 50); // Poll again in 50ms
            }
        };
        check();
    });
}

// ============================================================================
// SECTION 11: RECEIVER — INCOMING FILE HANDLING
// ============================================================================

/**
 * handleIncomingMeta — RECEIVER STEP 1: Initialize buffer for an incoming file.
 *
 * When a META message arrives, we:
 *  1. Create a new entry in State.receiveBuffer keyed by transferId
 *  2. Allocate a pre-sized sparse Array for the chunks (enables ordered reassembly)
 *  3. Show the dashboard and received files section on the receiver UI
 *
 * @param {Object} msg - The META message from the sender.
 */
function handleIncomingMeta(msg) {
    console.log(`[Receive] Incoming file: "${msg.fileName}" (${formatBytes(msg.fileSize)})`);

    // Initialize receive buffer: sparse Array pre-sized to totalChunks
    State.receiveBuffer[msg.transferId] = {
        meta     : msg,
        chunks   : new Array(msg.totalChunks), // Sparse array — filled by index
        received : 0,
    };

    // Update receiver UI
    showReceivedSection();
    DOM.currentFileName.innerHTML = `<i class="fa-solid fa-file-import"></i> ${escapeHtml(msg.fileName)}`;
    showDashboard();
    setDashPhase('RECEIVING');
    startStatsInterval();

    State.stats.totalBytes = msg.fileSize;
    State.stats.bytesSent  = 0;
    State.stats.startTime  = Date.now();
}

/**
 * handleIncomingChunk — RECEIVER STEP 2: Decrypt and buffer an incoming chunk.
 *
 * Each CHUNK message carries:
 *  - transferId  : Identifies which file this chunk belongs to
 *  - chunkIndex  : The 0-based position of this chunk in the final file
 *  - data        : The AES-256 encrypted Base64-encoded chunk payload
 *
 * Decryption process:
 *  1. CryptoJS.AES.decrypt extracts the embedded salt and IV from `data`
 *  2. Decrypts using the passphrase stored in State.encKey
 *  3. Converts the resulting Base64 back to an ArrayBuffer
 *  4. Stores the ArrayBuffer at the correct index position
 *
 * @param {Object} msg - The CHUNK message from the sender.
 */
function handleIncomingChunk(msg) {
    const buffer = State.receiveBuffer[msg.transferId];
    if (!buffer) {
        console.warn('[Receive] Got chunk for unknown transferId:', msg.transferId);
        return;
    }

    /**
     * AES-256 DECRYPTION
     * ──────────────────────────────────────────────────────────────────
     * CryptoJS.AES.decrypt automatically reads the salt and IV that were
     * prepended by the sender during encryption. The same passphrase
     * (State.encKey) is used. toString(CryptoJS.enc.Utf8) recovers the
     * original Base64 string representation of the chunk bytes.
     */
    const decryptedBase64 = CryptoJS.AES.decrypt(msg.data, State.encKey).toString(CryptoJS.enc.Utf8);
    const arrayBuffer     = base64ToArrayBuffer(decryptedBase64);

    // Store chunk at the exact index position for in-order reassembly
    buffer.chunks[msg.chunkIndex] = arrayBuffer;
    buffer.received++;

    // Update transfer progress in the dashboard
    State.stats.bytesSent += arrayBuffer.byteLength;
    updateProgressUI(State.stats.bytesSent, State.stats.totalBytes, buffer.received, buffer.meta.totalChunks);
}

/**
 * handleIncomingDone — RECEIVER STEP 3: Reassemble all chunks and trigger download.
 *
 * When the DONE signal arrives:
 *  1. Verify no chunks are missing (defensive check against loss)
 *  2. Concatenate all ArrayBuffer chunks into a single Uint8Array
 *  3. Wrap in a Blob with the correct MIME type
 *  4. Trigger download via FileSaver.js (saveAs)
 *  5. Add the file to the received files list UI
 *  6. Clean up the buffer entry from State.receiveBuffer
 *
 * @param {Object} msg - The DONE message from the sender.
 */
function handleIncomingDone(msg) {
    const buffer = State.receiveBuffer[msg.transferId];
    if (!buffer) return;

    const { meta, chunks } = buffer;

    // Defensive check: ensure no chunk slot is still undefined
    const missing = chunks.findIndex(c => c === undefined);
    if (missing !== -1) {
        console.error(`[Receive] Missing chunk at index ${missing}!`);
        window.showToast(`Chunk #${missing} missing for "${meta.fileName}". Transfer may be incomplete.`, true);
        return;
    }

    // Compute total reassembled size and allocate a combined Uint8Array
    const totalSize = chunks.reduce((s, c) => s + c.byteLength, 0);
    const combined  = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
    }

    // Create the final Blob and trigger the browser's download prompt
    const blob = new Blob([combined], { type: meta.fileType });
    saveAs(blob, meta.fileName); // FileSaver.js — cross-browser reliable download

    // Add the received file to the UI list with a re-download button
    addReceivedFileToUI(meta, blob);

    // Remove the buffer entry to free memory
    delete State.receiveBuffer[msg.transferId];

    stopStatsInterval();
    setDashPhase('COMPLETE');
    updateProgressUI(meta.fileSize, meta.fileSize, meta.totalChunks, meta.totalChunks);

    window.showToast(`"${meta.fileName}" saved successfully.`);
    showSuccessOverlay('File Received!', `"${meta.fileName}" has been decrypted and saved.`);
}

// ============================================================================
// SECTION 12: DROP ZONE & FILE QUEUE MANAGEMENT
// ============================================================================

/**
 * initDropZone — Binds all drag-and-drop and file browse events.
 *
 * Handles:
 *  - dragenter / dragover : Highlight the drop zone
 *  - dragleave / drop     : Remove highlight
 *  - drop                 : Route dropped items to handleDroppedItems()
 *  - fileInput.change     : Add selected files to the queue
 *  - folderInput.change   : Zip and add a selected folder to the queue
 *  - btnClearQueue.click  : Clear all queued files
 *  - btnSendAll.click     : Start the file sending pipeline
 */
function initDropZone() {
    const dz = DOM.dropZone;

    // Highlight drop zone when a dragged item is over it
    ['dragenter', 'dragover'].forEach(e => {
        dz.addEventListener(e, (ev) => {
            ev.preventDefault();
            dz.classList.add('drag-over');
        });
    });

    // Remove highlight when drag leaves or drop occurs
    ['dragleave', 'drop'].forEach(e => {
        dz.addEventListener(e, () => dz.classList.remove('drag-over'));
    });

    // Process items dropped onto the drop zone
    dz.addEventListener('drop', (ev) => {
        ev.preventDefault();
        handleDroppedItems(ev.dataTransfer.items || []);
    });

    // "Select Files" button triggers the hidden file input
    DOM.btnBrowseFiles.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', () => {
        addFilesToQueue([...DOM.fileInput.files]);
        DOM.fileInput.value = ''; // Reset input so the same file can be re-added
    });

    // "Select Folder" button triggers the hidden folder input
    DOM.btnBrowseFolder.addEventListener('click', () => DOM.folderInput.click());
    DOM.folderInput.addEventListener('change', () => {
        handleFolderInput([...DOM.folderInput.files]);
        DOM.folderInput.value = ''; // Reset input
    });

    // Queue management buttons
    DOM.btnClearQueue.addEventListener('click', clearQueue);
    DOM.btnSendAll.addEventListener('click', sendAllFiles);
}

/**
 * handleDroppedItems — Processes items dropped onto the drop zone.
 *
 * Separates dropped items into regular files vs. directories.
 * Directories are passed to zipFolderEntry() for JSZip compression.
 * Regular files are passed directly to addFilesToQueue().
 *
 * @param {DataTransferItemList} items - The list of dragged items.
 */
async function handleDroppedItems(items) {
    const files         = [];
    const folderEntries = [];

    for (const item of items) {
        if (item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;

        if (entry && entry.isDirectory) {
            folderEntries.push(entry);
        } else {
            const f = item.getAsFile();
            if (f) files.push(f);
        }
    }

    // Add regular files immediately
    if (files.length) addFilesToQueue(files);

    // Zip each dropped folder asynchronously, then add to queue
    for (const entry of folderEntries) {
        await zipFolderEntry(entry);
    }
}

/**
 * handleFolderInput — Handles a folder selected via the webkitdirectory input.
 *
 * When a user selects a folder via the input, we receive a flat array of
 * all files within the folder (and sub-folders) with their relative paths.
 * JSZip compresses them while preserving the folder structure.
 *
 * Progress updates are shown in the queue item status during compression.
 *
 * @param {File[]} files - Array of File objects from the webkitdirectory input.
 */
async function handleFolderInput(files) {
    if (!files.length) return;

    // Extract the top-level folder name from the first file's relative path
    const folderName = files[0].webkitRelativePath.split('/')[0] || 'folder';

    window.showToast(`Compressing "${folderName}"...`);

    // Add a placeholder queue item so the user sees it immediately
    const placeholderIndex = State.fileQueue.length;
    const placeholder      = new File([], `${folderName}.zip`, { type: 'application/zip' });
    addFilesToQueue([placeholder]);
    updateQueueItemStatus(placeholderIndex, 'zipping');

    try {
        /**
         * JSZip IN-BROWSER COMPRESSION
         * ──────────────────────────────────────────────────────────────────
         * We use DEFLATE compression at level 6 (balanced speed vs. size).
         * Each file is added with its full relative path preserved inside
         * the archive (e.g., "folder/sub/file.txt").
         */
        const zip = new JSZip();
        for (const file of files) {
            const relativePath = file.webkitRelativePath;
            const arrayBuffer  = await readAsArrayBuffer(file);
            zip.file(relativePath, arrayBuffer);
        }

        const zipBlob = await zip.generateAsync({
            type               : 'blob',
            compression        : 'DEFLATE',
            compressionOptions : { level: 6 },
        }, (meta) => {
            // Update the placeholder's status with real-time compression percentage
            const pct = Math.round(meta.percent);
            updateQueueItemStatus(placeholderIndex, 'zipping', `${pct}%`);
        });

        // Replace the empty placeholder File with the real compressed zip File
        const zipFile = new File([zipBlob], `${folderName}.zip`, { type: 'application/zip' });
        State.fileQueue[placeholderIndex] = zipFile;

        // Update the displayed file size in the queue item
        const item = DOM.queueList.children[placeholderIndex];
        if (item) {
            item.querySelector('.queue-item-size').textContent = formatBytes(zipFile.size);
        }

        updateQueueItemStatus(placeholderIndex, 'pending');
        window.showToast(`"${folderName}.zip" ready to send (${formatBytes(zipBlob.size)}).`);

    } catch (err) {
        console.error('[JSZip] Compression failed:', err);
        updateQueueItemStatus(placeholderIndex, 'error');
        window.showToast('Folder compression failed: ' + err.message, true);
    }
}

/**
 * zipFolderEntry — Handles a folder dropped as a FileSystemDirectoryEntry.
 *
 * When a folder is drag-and-dropped (not via input), the browser provides
 * a FileSystemDirectoryEntry. We recursively read all files using the
 * FileSystem API and zip them with JSZip.
 *
 * @param {FileSystemDirectoryEntry} dirEntry - The dropped directory entry.
 */
async function zipFolderEntry(dirEntry) {
    window.showToast(`Compressing "${dirEntry.name}"...`);

    const placeholderIndex = State.fileQueue.length;
    const placeholder      = new File([], `${dirEntry.name}.zip`, { type: 'application/zip' });
    addFilesToQueue([placeholder]);
    updateQueueItemStatus(placeholderIndex, 'zipping');

    try {
        const zip = new JSZip();

        // Recursively traverse the directory and add all files to the zip
        await readDirectoryEntry(dirEntry, zip, dirEntry.name);

        const zipBlob = await zip.generateAsync({
            type               : 'blob',
            compression        : 'DEFLATE',
            compressionOptions : { level: 6 },
        });

        const zipFile = new File([zipBlob], `${dirEntry.name}.zip`, { type: 'application/zip' });
        State.fileQueue[placeholderIndex] = zipFile;

        const item = DOM.queueList.children[placeholderIndex];
        if (item) item.querySelector('.queue-item-size').textContent = formatBytes(zipFile.size);

        updateQueueItemStatus(placeholderIndex, 'pending');
        window.showToast(`"${dirEntry.name}.zip" is ready.`);

    } catch (err) {
        console.error('[JSZip] Directory zip failed:', err);
        updateQueueItemStatus(placeholderIndex, 'error');
        window.showToast('Directory compression failed: ' + err.message, true);
    }
}

/**
 * readDirectoryEntry — Recursively reads a FileSystemDirectoryEntry.
 *
 * Traverses the directory tree depth-first, adding every file to the
 * JSZip archive at the correct relative path.
 *
 * @param {FileSystemDirectoryEntry} dirEntry - Directory to read.
 * @param {JSZip}   zip  - The JSZip instance to add files into.
 * @param {string}  path - Current path prefix within the zip archive.
 */
async function readDirectoryEntry(dirEntry, zip, path) {
    const entries = await readEntriesAsync(dirEntry.createReader());
    for (const entry of entries) {
        if (entry.isFile) {
            const file = await getFileAsync(entry);
            const ab   = await readAsArrayBuffer(file);
            zip.file(`${path}/${entry.name}`, ab);
        } else if (entry.isDirectory) {
            await readDirectoryEntry(entry, zip, `${path}/${entry.name}`);
        }
    }
}

/**
 * readEntriesAsync — Promisified FileSystemDirectoryReader.readEntries().
 *
 * @param {FileSystemDirectoryReader} reader
 * @returns {Promise<FileSystemEntry[]>}
 */
function readEntriesAsync(reader) {
    return new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
    });
}

/**
 * getFileAsync — Promisified FileSystemFileEntry.file().
 *
 * @param {FileSystemFileEntry} entry
 * @returns {Promise<File>}
 */
function getFileAsync(entry) {
    return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/**
 * addFilesToQueue — Adds an array of File objects to the queue and renders them.
 *
 * Updates State.fileQueue and calls renderQueueItem() for each file.
 * Also toggles the drop zone / queue visibility.
 *
 * @param {File[]} files - Array of File objects to add.
 */
function addFilesToQueue(files) {
    files.forEach(file => {
        const index = State.fileQueue.length;
        State.fileQueue.push(file);
        renderQueueItem(file, index);
    });

    // Hide drop zone and show the queue list
    DOM.fileQueue.style.display  = 'block';
    DOM.dropZone.style.display   = 'none';
}

/**
 * renderQueueItem — Creates and appends a single file row in the queue list.
 *
 * The rendered HTML uses class names that JS also references:
 * .queue-item, .queue-item-icon, .queue-item-info,
 * .queue-item-name, .queue-item-size, .queue-item-status
 *
 * @param {File}   file  - The File to render.
 * @param {number} index - Position in State.fileQueue (used as data-index).
 */
function renderQueueItem(file, index) {
    const icon = getFileIcon(file.name);
    const item = document.createElement('div');
    item.className   = 'queue-item';
    item.dataset.index = index;
    item.innerHTML = `
        <div class="queue-item-icon">
            <i class="${icon}"></i>
        </div>
        <div class="queue-item-info">
            <div class="queue-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            <div class="queue-item-size">${formatBytes(file.size)}</div>
        </div>
        <span class="queue-item-status pending">PENDING</span>
    `;
    DOM.queueList.appendChild(item);
}

/**
 * updateQueueItemStatus — Updates the status badge on a queue item by index.
 *
 * Status modifier classes: pending | sending | done | error | zipping
 * The `label` parameter overrides the displayed text (e.g., "45%").
 *
 * @param {number} index  - Queue item index.
 * @param {string} status - CSS modifier class to apply.
 * @param {string} [label] - Optional display text (defaults to uppercase status).
 */
function updateQueueItemStatus(index, status, label) {
    const item = DOM.queueList.children[index];
    if (!item) return;
    const badge         = item.querySelector('.queue-item-status');
    badge.className     = `queue-item-status ${status}`;
    badge.textContent   = (label || status).toUpperCase();
}

/**
 * clearQueue — Resets the file queue: clears state, DOM, and shows drop zone.
 */
function clearQueue() {
    State.fileQueue               = [];
    DOM.queueList.innerHTML       = '';
    DOM.fileQueue.style.display   = 'none';
    DOM.dropZone.style.display    = '';
    DOM.liveDashboard.style.display = 'none';
}

// ============================================================================
// SECTION 13: DASHBOARD UI UPDATES
// ============================================================================

/**
 * showDashboard — Makes the live transfer dashboard panel visible.
 */
function showDashboard() {
    DOM.liveDashboard.style.display = 'block';
}

/**
 * setDashPhase — Updates the phase badge text in the dashboard header.
 *
 * @param {string} phase - The phase label (e.g., 'ENCRYPTING', 'TRANSMITTING', 'COMPLETE').
 */
function setDashPhase(phase) {
    DOM.dashPhase.textContent = phase;
}

/**
 * updateProgressUI — Refreshes all dashboard indicators with current transfer data.
 *
 * Updates:
 *  1. Circular SVG progress (strokeDashoffset)
 *  2. Percentage text inside the ring
 *  3. Linear progress bar width and glow position
 *  4. Transferred size display (value + unit)
 *  5. Chunks sent counter
 *  6. Progress text (bytes / total bytes)
 *
 * @param {number} bytesTransferred   - Total bytes sent/received so far.
 * @param {number} totalBytes         - Total bytes in this transfer session.
 * @param {number} chunksTransferred  - Number of chunks completed.
 * @param {number} totalChunks        - Total number of chunks in this file.
 */
function updateProgressUI(bytesTransferred, totalBytes, chunksTransferred, totalChunks) {
    const pct = totalBytes > 0
        ? Math.min(100, Math.round((bytesTransferred / totalBytes) * 100))
        : 0;

    // SVG circumference for radius=52: 2 * π * 52 ≈ 326.73
    const CIRCUMFERENCE = 326.73;

    // ── Circular progress arc ──────────────────────────────────────────────
    const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
    DOM.cpFill.style.strokeDashoffset = offset;
    DOM.cpPercent.textContent         = `${pct}%`;

    // ── Linear progress bar ────────────────────────────────────────────────
    DOM.progressFill.style.width = `${pct}%`;
    DOM.progressGlow.style.left  = `${pct}%`;

    // ── Transferred size display ───────────────────────────────────────────
    const { value: sVal, unit: sUnit } = formatBytesUnit(bytesTransferred);
    DOM.sizeValue.textContent = sVal;
    DOM.sizeUnit.textContent  = sUnit;

    // ── Chunks counter ─────────────────────────────────────────────────────
    DOM.chunksValue.textContent = chunksTransferred.toLocaleString();

    // ── Progress text ──────────────────────────────────────────────────────
    DOM.progressText.textContent = `${formatBytes(bytesTransferred)} / ${formatBytes(totalBytes)}`;
}

/**
 * startStatsInterval — Starts the 500ms polling loop for speed and ETA.
 *
 * Calculates:
 *  - Instantaneous transfer speed (bytes/sec over the last 500ms window)
 *  - Speed in MB/s for display
 *  - Speedometer bar fill percentage (relative to assumed max of 50 MB/s)
 *  - Estimated time to completion (ETA) based on remaining bytes / speed
 */
function startStatsInterval() {
    stopStatsInterval(); // Prevent duplicate intervals

    State.stats.lastUpdate = Date.now();
    State.stats.lastBytes  = State.stats.bytesSent;

    State.statsInterval = setInterval(() => {
        const now        = Date.now();
        const delta      = (now - State.stats.lastUpdate) / 1000; // Seconds since last tick
        const bytesDelta = State.stats.bytesSent - State.stats.lastBytes;
        const speed      = delta > 0 ? bytesDelta / delta : 0; // bytes/sec

        State.stats.speed      = speed;
        State.stats.lastUpdate = now;
        State.stats.lastBytes  = State.stats.bytesSent;

        // Display speed in MB/s
        const speedMBs = speed / (1024 * 1024);
        DOM.speedValue.textContent = speedMBs.toFixed(2);

        // Speedometer bar: proportional fill (max assumed = 50 MB/s)
        const speedPct = Math.min(100, (speedMBs / 50) * 100);
        DOM.speedometerFill.style.width = `${speedPct}%`;

        // ETA calculation
        const remaining = State.stats.totalBytes - State.stats.bytesSent;
        if (speed > 0 && remaining > 0) {
            DOM.etaValue.textContent = formatTime(remaining / speed);
        } else {
            DOM.etaValue.textContent = '--:--';
        }
    }, 500);
}

/**
 * stopStatsInterval — Clears the stats polling interval.
 * Called when a transfer completes or the connection is reset.
 */
function stopStatsInterval() {
    if (State.statsInterval) {
        clearInterval(State.statsInterval);
        State.statsInterval = null;
    }
}

// ============================================================================
// SECTION 14: QR CODE GENERATION
// ============================================================================

/**
 * toggleOfferQR — Shows or hides the QR code for the Offer SDP.
 *
 * On first show: generates a new QRCode via QRCode.js into #qrCodeOffer.
 * On subsequent calls: toggles the container visibility.
 * Shows a warning toast if no offer has been generated yet.
 */
function toggleOfferQR() {
    const isVisible = DOM.qrContainer.style.display !== 'none';
    if (isVisible) {
        DOM.qrContainer.style.display = 'none';
        return;
    }

    const sdpText = DOM.offerSDP.value.trim();
    if (!sdpText) {
        window.showToast('Generate an offer first.');
        return;
    }

    DOM.qrContainer.style.display = 'block';
    DOM.qrCodeOffer.innerHTML      = ''; // Clear any previous QR

    // Generate QR code using QRCode.js library
    State.qrOffer = new QRCode(DOM.qrCodeOffer, {
        text         : sdpText,
        width        : 220,
        height       : 220,
        colorDark    : '#000000',
        colorLight   : '#ffffff',
        correctLevel : QRCode.CorrectLevel.M, // Medium error correction
    });
}

/**
 * toggleAnswerQR — Shows or hides the QR code for the Answer SDP.
 *
 * Behaves identically to toggleOfferQR but uses the answer textarea
 * and qrCodeAnswer container.
 */
function toggleAnswerQR() {
    const isVisible = DOM.qrAnswerContainer.style.display !== 'none';
    if (isVisible) {
        DOM.qrAnswerContainer.style.display = 'none';
        return;
    }

    const sdpText = DOM.answerSDPOutput.value.trim();
    if (!sdpText) {
        window.showToast('Generate an answer first.');
        return;
    }

    DOM.qrAnswerContainer.style.display = 'block';
    DOM.qrCodeAnswer.innerHTML           = '';

    State.qrAnswer = new QRCode(DOM.qrCodeAnswer, {
        text         : sdpText,
        width        : 220,
        height       : 220,
        colorDark    : '#000000',
        colorLight   : '#ffffff',
        correctLevel : QRCode.CorrectLevel.M,
    });
}

// ============================================================================
// SECTION 15: QR SCANNER
// ============================================================================

/**
 * startScanner — Opens the camera scanner overlay and starts QR scanning.
 *
 * Uses the Html5Qrcode library to access the device camera (back-facing
 * on mobile). On a successful scan, the decoded text is injected into
 * the appropriate SDP textarea and the scanner is closed automatically.
 *
 * @param {'offer'|'answer'} target - Which SDP textarea to fill with the scanned value.
 */
function startScanner(target) {
    State.scanTarget = target;
    DOM.scannerOverlay.classList.remove('p2p-hidden');

    // Initialize the Html5Qrcode instance targeting the #reader div
    State.scanner = new Html5Qrcode('reader');

    const config = {
        fps         : 10,                         // Decode attempts per second
        qrbox       : { width: 280, height: 280 }, // Active scan region
        aspectRatio : 1.0,                        // Square viewfinder
    };

    State.scanner.start(
        { facingMode: 'environment' }, // Prefer back camera on mobile devices
        config,
        (decodedText) => {
            // ── On successful scan ────────────────────────────────────────────
            // Fill the correct textarea with the decoded SDP text
            if (State.scanTarget === 'offer') {
                DOM.recvOfferSDP.value = decodedText;
                window.showToast('Offer SDP loaded from QR code.');
            } else {
                DOM.answerSDP.value = decodedText;
                window.showToast('Answer SDP loaded from QR code.');
            }
            stopScanner(); // Close overlay after successful scan
        },
        () => {
            // Ignore frame-by-frame decode failures — these happen constantly
            // until a valid QR code enters the frame. Not an error condition.
        }
    ).catch(err => {
        console.error('[Scanner] Start failed:', err);
        window.showToast('Could not access camera. Check permissions.', true);
        stopScanner();
    });
}

/**
 * stopScanner — Stops the Html5Qrcode camera stream and hides the overlay.
 *
 * We call stop() then clear() to properly release the camera resource.
 * The overlay is hidden regardless of whether stop() succeeds.
 */
function stopScanner() {
    if (State.scanner) {
        State.scanner.stop()
            .then(() => { State.scanner.clear(); State.scanner = null; })
            .catch(() => { State.scanner = null; });
    }
    DOM.scannerOverlay.classList.add('p2p-hidden');
}

/**
 * initScannerOverlay — Binds the close button for the scanner overlay.
 */
function initScannerOverlay() {
    DOM.btnCloseScanner.addEventListener('click', stopScanner);
}

// ============================================================================
// SECTION 16: SUCCESS OVERLAY
// ============================================================================

/**
 * initSuccessOverlay — Binds the "Awesome!" close button.
 */
function initSuccessOverlay() {
    DOM.btnSuccessClose.addEventListener('click', () => {
        DOM.successOverlay.classList.add('p2p-hidden');
    });
}

/**
 * showSuccessOverlay — Displays the animated success overlay.
 *
 * The SVG checkmark and ring animation are CSS-driven; no JS animation needed.
 * The overlay is dismissed by the user clicking "Awesome!" or via btnSuccessClose.
 *
 * @param {string} title   - Heading text (e.g., "All Files Sent!" / "File Received!").
 * @param {string} message - Descriptive message body.
 */
function showSuccessOverlay(title, message) {
    DOM.successTitle.textContent   = title;
    DOM.successMessage.textContent = message;
    DOM.successOverlay.classList.remove('p2p-hidden');
}

// ============================================================================
// SECTION 17: RECEIVED FILES UI
// ============================================================================

/**
 * showReceivedSection — Makes the received files panel visible.
 * Called as soon as a META message arrives on the receiver side.
 */
function showReceivedSection() {
    DOM.receivedSection.style.display = 'block';
}

/**
 * addReceivedFileToUI — Adds a completed received file entry to the UI list.
 *
 * Creates a .received-item div containing:
 *  - File type icon
 *  - File name (truncated if long)
 *  - File size + receive timestamp
 *  - Re-download button (.btn-download) that re-triggers saveAs on click
 *
 * @param {Object} meta - File metadata object from the META message.
 * @param {Blob}   blob - The fully reassembled file Blob.
 */
function addReceivedFileToUI(meta, blob) {
    // Increment the count badge
    const count = DOM.receivedList.children.length + 1;
    DOM.receivedCount.textContent = count;

    const icon = getFileIcon(meta.fileName);
    const item = document.createElement('div');
    item.className = 'received-item';
    item.innerHTML = `
        <div class="received-item-icon">
            <i class="${icon}"></i>
        </div>
        <div class="received-item-info">
            <div class="received-item-name" title="${escapeHtml(meta.fileName)}">${escapeHtml(meta.fileName)}</div>
            <div class="received-item-meta">${formatBytes(meta.fileSize)} &middot; ${new Date().toLocaleTimeString()}</div>
        </div>
        <button class="btn-download" data-filename="${escapeHtml(meta.fileName)}">
            <i class="fa-solid fa-download"></i> Save
        </button>
    `;

    // Re-download button: triggers FileSaver.js saveAs with the in-memory Blob
    item.querySelector('.btn-download').addEventListener('click', () => {
        saveAs(blob, meta.fileName);
    });

    DOM.receivedList.appendChild(item);
}

// ============================================================================
// SECTION 18: STATUS BAR & UI STATE HELPERS
// ============================================================================

/**
 * setStatus — Updates the connection status bar with new state data.
 *
 * Applies the appropriate color modifier class to the dot and label,
 * and updates the descriptive meta text.
 *
 * @param {'connected'|'connecting'|'disconnected'|'error'} state - Connection state.
 * @param {string} label - Bold uppercase status label text.
 * @param {string} meta  - Descriptive hint text shown beside the label.
 */
function setStatus(state, label, meta) {
    DOM.statusDot.className             = `p2p-status-dot ${state}`;
    DOM.statusLabel.className           = `p2p-status-label ${state}`;
    DOM.statusLabel.textContent         = label;
    DOM.statusMeta.querySelector('span').textContent = meta;
}

/**
 * unlockTransferUI — Shows the file transfer panel and hides the overlay.
 * Called when the data channel fires its 'open' event.
 */
function unlockTransferUI() {
    DOM.overlayRequired.style.display = 'none';
    DOM.transferUI.style.display      = 'flex';
}

/**
 * lockTransferUI — Hides the transfer panel and shows the awaiting overlay.
 * Called when the data channel is closed or the connection is reset.
 */
function lockTransferUI() {
    DOM.overlayRequired.style.display = '';
    DOM.transferUI.style.display      = 'none';
}

/**
 * cleanupPeerConnection — Closes and nullifies the current peer connection.
 *
 * Safely closes both the data channel and the RTCPeerConnection to prevent
 * resource leaks. try/catch handles cases where they are already closed.
 */
function cleanupPeerConnection() {
    if (State.dataChannel) {
        try { State.dataChannel.close(); } catch (_) {}
        State.dataChannel = null;
    }
    if (State.pc) {
        try { State.pc.close(); } catch (_) {}
        State.pc = null;
    }
    State.isConnected = false;
}

/**
 * resetConnection — Fully resets the application to its initial state.
 *
 * Performs:
 *  1. Close the peer connection and data channel
 *  2. Stop any active stats polling
 *  3. Clear all SDP textareas and hide all dynamic UI panels
 *  4. Clear the file queue and re-show the drop zone
 *  5. Reset the status bar to "NOT CONNECTED"
 *  6. Show a confirmation toast
 */
function resetConnection() {
    cleanupPeerConnection();
    stopStatsInterval();

    // Hide and clear all connection-related panels
    DOM.offerBox.style.display           = 'none';
    DOM.answerInputGroup.style.display   = 'none';
    DOM.answerBox.style.display          = 'none';
    DOM.qrContainer.style.display        = 'none';
    DOM.qrAnswerContainer.style.display  = 'none';

    // Clear all SDP textarea values
    DOM.offerSDP.value          = '';
    DOM.answerSDP.value         = '';
    DOM.answerSDPOutput.value   = '';
    DOM.recvOfferSDP.value      = '';

    // Reset file transfer state
    clearQueue();
    lockTransferUI();
    DOM.receivedSection.style.display = 'none';
    DOM.receivedList.innerHTML        = '';
    DOM.receivedCount.textContent     = '0';

    setStatus('disconnected', 'NOT CONNECTED', 'Generate an Offer to start a secure session');
    window.showToast('Connection and session have been reset.');
}

// ============================================================================
// SECTION 19: WEBRTC STATE CHANGE HANDLERS
// ============================================================================

/**
 * handleICEStateChange — Responds to ICE connection state transitions.
 *
 * ICE states: new → checking → connected → completed → failed / disconnected
 * We only act on terminal failure states to notify the user.
 * Connected/completed states are handled by the data channel 'onopen' event.
 */
function handleICEStateChange() {
    const state = State.pc?.iceConnectionState;
    console.log('[ICE] State:', state);

    if (state === 'failed' || state === 'disconnected') {
        setStatus('error', 'ICE FAILED', 'Connection attempt failed. Try again.');
        window.showToast('ICE negotiation failed. Check your network and try regenerating.', true);
    }
}

/**
 * handleConnectionStateChange — Responds to RTCPeerConnection state transitions.
 *
 * Connection states: new → connecting → connected → disconnected → failed → closed
 * We only surface the 'failed' state since connected/disconnected are
 * already handled by the data channel events.
 */
function handleConnectionStateChange() {
    const state = State.pc?.connectionState;
    console.log('[PC] State:', state);

    if (state === 'failed') {
        setStatus('error', 'CONNECTION FAILED', 'WebRTC connection could not be established');
    }
}

// ============================================================================
// SECTION 20: SVG GRADIENT INJECTION
// ============================================================================

/**
 * injectSVGGradient — Injects a linearGradient <defs> into the circular progress SVG.
 *
 * The CSS `stroke: url(#progressGradient)` on .p2p-cp-fill references this
 * definition. Without this injection, the arc would fall back to a solid color.
 * The gradient goes: neon green (#00ff87) → cyan (#00d4ff) → deep blue (#0072ff).
 */
function injectSVGGradient() {
    const svg = document.getElementById('progressSVG');
    if (!svg) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="#00ff87"/>
            <stop offset="50%"  stop-color="#00d4ff"/>
            <stop offset="100%" stop-color="#0072ff"/>
        </linearGradient>
    `;
    svg.prepend(defs);
}

// ============================================================================
// SECTION 21: SCROLL-BASED ANIMATION OBSERVER
// ============================================================================

/**
 * initScrollAnimations — Triggers fade-in animations on .animated-entry elements.
 *
 * Uses IntersectionObserver to detect when each element enters the viewport.
 * On intersection, adds the 'in-view' class which triggers the CSS animation.
 * The element is then unobserved to prevent re-triggering on scroll back.
 */
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target); // Animate only once
            }
        });
    }, { threshold: 0.1 }); // Trigger when 10% of the element is visible

    document.querySelectorAll('.animated-entry').forEach(el => observer.observe(el));
}

// ============================================================================
// SECTION 22: UTILITY FUNCTIONS
// ============================================================================

/**
 * sendJSON — Serializes an object to JSON and sends it over the data channel.
 *
 * Guards against sending on a closed or unavailable channel.
 * All data channel messages (META, CHUNK, DONE, PING) pass through here.
 *
 * @param {Object} obj - The JSON-serializable message to send.
 */
function sendJSON(obj) {
    if (!State.dataChannel || State.dataChannel.readyState !== 'open') {
        console.warn('[DataChannel] Attempted to send on closed channel.');
        return;
    }
    State.dataChannel.send(JSON.stringify(obj));
}

/**
 * readAsArrayBuffer — Reads a Blob or File as an ArrayBuffer using FileReader.
 *
 * @param {Blob|File} blob - The data to read.
 * @returns {Promise<ArrayBuffer>}
 */
function readAsArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader    = new FileReader();
        reader.onload   = () => resolve(reader.result);
        reader.onerror  = reject;
        reader.readAsArrayBuffer(blob);
    });
}

/**
 * arrayBufferToBase64 — Converts an ArrayBuffer to a Base64-encoded string.
 *
 * Processes the buffer in 8192-byte chunks to avoid call stack overflow
 * that would occur with very large files if String.fromCharCode was called
 * on the entire Uint8Array at once.
 *
 * @param {ArrayBuffer} buffer
 * @returns {string} Base64-encoded string.
 */
function arrayBufferToBase64(buffer) {
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    const chunk  = 8192; // Process 8KB at a time to stay within call stack limits
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

/**
 * base64ToArrayBuffer — Converts a Base64 string back to an ArrayBuffer.
 *
 * @param {string} base64 - Base64-encoded string.
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * copyText — Copies a string to the clipboard and shows feedback via global toast.
 *
 * Prefers the modern navigator.clipboard API with a legacy execCommand fallback
 * for browsers that do not support the Clipboard API (e.g., older iOS Safari).
 *
 * @param {string} text       - The text to copy.
 * @param {string} successMsg - Message to show in the success toast body.
 */
async function copyText(text, successMsg = 'Copied!') {
    if (!text) {
        window.showToast('The field is empty — nothing to copy.');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        window.showToast(successMsg);
    } catch (_) {
        // Fallback for browsers without the Clipboard API
        const el       = document.createElement('textarea');
        el.value       = text;
        el.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        el.remove();
        window.showToast(successMsg);
    }
}

/**
 * generateTransferId — Creates a unique string ID for each file transfer session.
 *
 * Format: `{timestamp}-{randomHex}` — practically collision-free for a session.
 *
 * @returns {string}
 */
function generateTransferId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * formatBytes — Converts raw byte count to a human-readable string.
 *
 * Examples: 0 → "0 B", 1500 → "1.46 KB", 2097152 → "2.00 MB"
 *
 * @param {number} bytes - Raw byte count.
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k     = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i     = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * formatBytesUnit — Like formatBytes but returns value and unit separately.
 *
 * Used by the dashboard to display value and unit in different styled spans.
 *
 * @param {number} bytes
 * @returns {{ value: string, unit: string }}
 */
function formatBytesUnit(bytes) {
    if (bytes === 0) return { value: '0', unit: 'B' };
    const k     = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i     = Math.floor(Math.log(bytes) / Math.log(k));
    return { value: (bytes / Math.pow(k, i)).toFixed(2), unit: units[i] };
}

/**
 * formatTime — Formats a duration in seconds to MM:SS string.
 *
 * Used for the ETA display in the dashboard.
 *
 * @param {number} seconds - Duration in seconds.
 * @returns {string} Formatted as "MM:SS".
 */
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * getFileIcon — Returns a FontAwesome class string based on file extension.
 *
 * Used to display appropriate file type icons in the queue and received list.
 * Falls back to `fa-solid fa-file` for unknown extensions.
 *
 * @param {string} fileName - The file name (extension is extracted from it).
 * @returns {string} FontAwesome icon class string.
 */
function getFileIcon(fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const map = {
        // Images
        jpg: 'fa-solid fa-file-image', jpeg: 'fa-solid fa-file-image',
        png: 'fa-solid fa-file-image', gif: 'fa-solid fa-file-image',
        webp: 'fa-solid fa-file-image', svg: 'fa-solid fa-file-image',
        // Video
        mp4: 'fa-solid fa-file-video', mov: 'fa-solid fa-file-video',
        avi: 'fa-solid fa-file-video', mkv: 'fa-solid fa-file-video',
        // Audio
        mp3: 'fa-solid fa-file-audio', wav: 'fa-solid fa-file-audio',
        flac: 'fa-solid fa-file-audio',
        // Documents
        pdf: 'fa-solid fa-file-pdf',
        doc: 'fa-solid fa-file-word', docx: 'fa-solid fa-file-word',
        xls: 'fa-solid fa-file-excel', xlsx: 'fa-solid fa-file-excel',
        ppt: 'fa-solid fa-file-powerpoint', pptx: 'fa-solid fa-file-powerpoint',
        // Code
        js: 'fa-solid fa-file-code', ts: 'fa-solid fa-file-code',
        html: 'fa-solid fa-file-code', css: 'fa-solid fa-file-code',
        py: 'fa-solid fa-file-code', json: 'fa-solid fa-file-code',
        // Archives
        zip: 'fa-solid fa-file-zipper', rar: 'fa-solid fa-file-zipper',
        gz: 'fa-solid fa-file-zipper', '7z': 'fa-solid fa-file-zipper',
        // Text
        txt: 'fa-solid fa-file-lines', md: 'fa-solid fa-file-lines',
        csv: 'fa-solid fa-file-csv',
    };
    return map[ext] || 'fa-solid fa-file';
}

/**
 * escapeHtml — Escapes HTML special characters to prevent XSS injection.
 *
 * Used whenever user-controlled strings (file names, etc.) are injected
 * into innerHTML. Creates a temporary text node and reads back the escaped HTML.
 *
 * @param {string} str - Raw string to escape.
 * @returns {string} HTML-entity-escaped string.
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ============================================================================
// END OF script.js — P2P SHARE VAULT ULTRA
// ============================================================================
