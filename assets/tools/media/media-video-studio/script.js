/**
 * ============================================================================
 * WASM Video Studio Pro — script.js
 * Tool Path : assets/tools/media/media-video-studio/script.js
 * Project   : Trusted Tools Web — by MD KAWSAR
 * Version   : 1.0 (CodeCanyon Release Build)
 *
 * Architecture:
 *   ES Module. FFmpeg WASM is dynamically imported from CDN (or local path).
 *   All video processing runs 100% client-side — no data is ever uploaded.
 *
 * Toast System:
 *   Uses the global window.showToast(message, isError) provided by global.js.
 *   - Normal toast  : window.showToast("Message")
 *   - Error toast   : window.showToast("Message", true)
 *
 * ── FOR CODCANYON BUYERS — LOCAL INSTALL INSTRUCTIONS ──────────────────────
 *   1. Run: npm install @ffmpeg/ffmpeg@0.12.6 @ffmpeg/util@0.12.1 @ffmpeg/core@0.12.6
 *   2. Copy from node_modules to:
 *        assets/library/ffmpeg/ffmpeg.js          (ESM build of @ffmpeg/ffmpeg)
 *        assets/library/ffmpeg/util.js            (ESM build of @ffmpeg/util)
 *        assets/library/ffmpeg/ffmpeg-core.js     (WASM core bootstrap)
 *        assets/library/ffmpeg/ffmpeg-core.wasm   (WASM binary)
 *        assets/library/ffmpeg/ffmpeg-core.worker.js (Worker thread helper)
 *   3. Update CDN_BASE, UTIL_CDN, and CORE_CDN constants below.
 *   4. Your web server MUST send these HTTP headers for WASM to work:
 *        Cross-Origin-Opener-Policy: same-origin
 *        Cross-Origin-Embedder-Policy: require-corp
 *
 * FFMPEG.WASM VERSION: 0.12.6
 * ============================================================================
 */

'use strict';




/* ============================================================================
   STATE MANAGEMENT
   A single state object holds all mutable runtime values for the tool.
   Keeping state centralized prevents scattered global variables and makes
   the processing pipeline easy to reason about and debug.
   ========================================================================== */
const state = {
    ffmpeg        : null,          // The FFmpeg WASM instance (created on load)
    ffmpegLoaded  : false,         // True once the WASM engine has fully loaded
    isProcessing  : false,         // Guard flag — prevents concurrent processing
    inputFile     : null,          // The File object selected by the user
    inputFileName : 'input',       // Sanitized base name (no extension, no spaces)
    inputFileExt  : 'mp4',         // Original file extension (lowercase)
    outputBlob    : null,          // The Blob created from the FFmpeg output buffer
    outputFilename: 'output.mp4',  // Suggested filename for the download prompt
    currentTab    : 'compress',    // Active action tab ID ('compress','trim',etc.)
    videoDuration : 0,             // Duration in seconds from the <video> element
};


/* ============================================================================
   DOM ELEMENT REFERENCES
   All DOM lookups are wrapped in arrow functions so they are evaluated lazily
   (after DOMContentLoaded) rather than at module parse time. This prevents
   null references on pages where the element might not yet exist.
   ========================================================================== */
const dom = {
    /* ── Upload / File handling ── */
    uploadZone      : () => document.getElementById('uploadZone'),
    fileInput       : () => document.getElementById('fileInput'),
    fileInfoBar     : () => document.getElementById('fileInfoBar'),
    fileInfoName    : () => document.getElementById('fileInfoName'),
    fileInfoSize    : () => document.getElementById('fileInfoSize'),
    removeFileBtn   : () => document.getElementById('removeFileBtn'),
    uploadBrowseBtn : () => document.getElementById('uploadBrowseBtn'),

    /* ── Process button & status ── */
    processBtn      : () => document.getElementById('processBtn'),
    processBtnText  : () => document.getElementById('processBtnText'),
    processBtnIcon  : () => document.getElementById('processBtnIcon'),
    statusDot       : () => document.getElementById('statusDot'),
    statusText      : () => document.getElementById('statusText'),

    /* ── Terminal / log ── */
    terminalBody    : () => document.getElementById('terminalBody'),
    termClear       : () => document.getElementById('termClear'),

    /* ── Progress bar ── */
    progressSection : () => document.getElementById('progressSection'),
    progressBar     : () => document.getElementById('progressBar'),
    progressPct     : () => document.getElementById('progressPct'),
    progressLabel   : () => document.getElementById('progressLabel'),

    /* ── Download / stats section ── */
    downloadSection : () => document.getElementById('downloadSection'),
    downloadBtn     : () => document.getElementById('downloadBtn'),
    downloadBtnText : () => document.getElementById('downloadBtnText'),
    statOriginal    : () => document.getElementById('statOriginal'),
    statResult      : () => document.getElementById('statResult'),
    statSavings     : () => document.getElementById('statSavings'),
    processAnotherBtn: () => document.getElementById('processAnotherBtn'),

    /* ── Video player ── */
    videoPlayer     : () => document.getElementById('videoPlayer'),
    playerPlaceholder: () => document.getElementById('playerPlaceholder'),
    playerWrap      : () => document.getElementById('playerWrap'),
    timelineHint    : () => document.getElementById('timelineHint'),

    /* ── Settings controls (Compress tab) ── */
    crfSlider       : () => document.getElementById('crfSlider'),
    crfHint         : () => document.getElementById('crfHint'),
    resolutionSelect: () => document.getElementById('resolutionSelect'),
    formatSelect    : () => document.getElementById('formatSelect'),
    presetSelect    : () => document.getElementById('presetSelect'),

    /* ── Settings controls (Trim tab) ── */
    trimStart       : () => document.getElementById('trimStart'),
    trimEnd         : () => document.getElementById('trimEnd'),
    trimReencode    : () => document.getElementById('trimReencode'),

    /* ── Settings controls (GIF tab) ── */
    fpsSlider       : () => document.getElementById('fpsSlider'),
    fpsHint         : () => document.getElementById('fpsHint'),
    gifWidth        : () => document.getElementById('gifWidth'),
    gifStart        : () => document.getElementById('gifStart'),
    gifDuration     : () => document.getElementById('gifDuration'),

    /* ── Settings controls (Audio tab) ── */
    audioFormat     : () => document.getElementById('audioFormat'),
    audioBitrate    : () => document.getElementById('audioBitrate'),

    /* ── Settings controls (God Mode tab) ── */
    speedSlider     : () => document.getElementById('speedSlider'),
    speedHint       : () => document.getElementById('speedHint'),
    chromaColor     : () => document.getElementById('chromaColor'),
    chromaSimilarity: () => document.getElementById('chromaSimilarity'),
    rotateSelect    : () => document.getElementById('rotateSelect'),
    godFormatSelect : () => document.getElementById('godFormatSelect'),
};


/* ============================================================================
   UTILITY: FORMAT FILE SIZE
   Converts a raw byte count into a human-readable string with the most
   appropriate unit suffix (B, KB, MB, GB).
   @param  {number} bytes  — Raw byte count
   @return {string}        — e.g. "12.45 MB"
   ========================================================================== */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k     = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i     = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


/* ============================================================================
   UTILITY: FORMAT DURATION
   Converts a decimal seconds value into HH:MM:SS display format.
   Used for the terminal log entry after a file's metadata is loaded.
   @param  {number} seconds  — Duration in seconds (from video.duration)
   @return {string}          — e.g. "00:02:34"
   ========================================================================== */
function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}


/* ============================================================================
   UTILITY: SANITIZE FILENAME
   Strips characters from a filename that FFmpeg's virtual filesystem may
   reject (spaces, special chars, etc.) and caps the length at 60 chars.
   @param  {string} name  — Raw filename string (no extension)
   @return {string}       — Safe alphanumeric-plus-underscore filename
   ========================================================================== */
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 60);
}


/* ============================================================================
   UTILITY: HTML ESCAPE
   Safely converts user-generated or FFmpeg log strings into HTML-safe text
   to prevent XSS when inserting into the terminal's innerHTML.
   @param  {string} str  — Raw input string
   @return {string}      — HTML-entity-encoded string
   ========================================================================== */
function escapeHtml(str) {
    const div       = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}


/* ============================================================================
   TERMINAL LOGGER
   Appends a styled log line to the on-screen FFmpeg terminal panel.
   Each line consists of a colored $ prompt and a message body.
   The terminal auto-scrolls to the newest line after each append.

   @param {string} message  — The text content to display
   @param {string} type     — One of: 'info' | 'success' | 'error' |
                              'warn' | 'cmd' | 'muted'
   ========================================================================== */
function termLog(message, type = 'info') {
    const body   = dom.terminalBody();
    const line   = document.createElement('div');
    line.className = `term-line term-${type}`;
    line.innerHTML = `<span class="term-prompt">$</span><span class="term-text">${escapeHtml(message)}</span>`;
    body.appendChild(line);

    // Auto-scroll the terminal to always show the latest output
    body.scrollTop = body.scrollHeight;
}


/* ============================================================================
   PROGRESS UPDATER
   Called by the FFmpeg progress event handler and by key pipeline steps.
   Updates the progress bar fill, the percentage counter, and the label text.

   @param {number} progress  — A 0–1 float (0 = 0%, 1 = 100%)
   @param {string} label     — Human-readable operation description
   ========================================================================== */
function updateProgress(progress, label = 'Processing...') {
    const pct = Math.min(Math.round(progress * 100), 100);
    dom.progressBar().style.width     = pct + '%';
    dom.progressPct().textContent     = pct + '%';
    dom.progressLabel().textContent   = label;
}


/* ============================================================================
   FFMPEG WASM LOADER (CDN Version for Live Demo)
   Loads the FFmpeg engine from unpkg CDN to bypass Cloudflare size limits.
   ========================================================================== */
async function loadFFmpeg() {
    termLog('Importing FFmpeg WebAssembly modules from CDN...', 'muted');

    try {
        // 1. Load the standalone UMD scripts from CDN
        await loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/umd/ffmpeg.js');
        await loadScript('https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/util.js');

        // Extract classes from the loaded global window objects
        const { FFmpeg } = window.FFmpegWASM;
        const { fetchFile } = window.FFmpegUtil;

        // Store utility function globally for startProcessing()
        window._ffmpegUtil = { fetchFile };

        // Instantiate the FFmpeg object
        state.ffmpeg = new FFmpeg();

        /* ── Progress Event ────────────────────────────────────────────────── */
        state.ffmpeg.on('progress', ({ progress, time }) => {
            const timeStr = time > 0 ? ` (${(time / 1000000).toFixed(1)}s processed)` : '';
            updateProgress(progress, `Encoding${timeStr}`);
        });

        /* ── Log Event ─────────────────────────────────────────────────────── */
        state.ffmpeg.on('log', ({ type, message }) => {
            if (!message || message.trim() === '') return;
            if (
                message.startsWith('frame=') ||
                message.startsWith('size=')  ||
                message.includes('time=')    ||
                message.startsWith('Error')  ||
                message.includes('error')    ||
                message.includes('Invalid')
            ) {
                termLog(message.trim(), type === 'fferr' ? 'warn' : 'muted');
            }
        });

        termLog('Loading ffmpeg-core.wasm from CDN into memory...', 'info');

        // 2. Load the core WASM files directly from CDN paths
        await state.ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
        });

        // ── Engine Ready ──
        state.ffmpegLoaded              = true;
        dom.statusDot().className       = 'status-dot ready';
        dom.statusText().textContent    = 'FFmpeg WASM engine ready. Drop a video to begin.';
        termLog('FFmpeg WebAssembly engine loaded successfully from CDN.', 'success');
        termLog('All processing is 100% local — your files never leave this device.', 'success');

        if (state.inputFile) {
            enableProcessButton();
        }

    } catch (err) {
        // ── Engine Failed ──
        dom.statusDot().className       = 'status-dot error';
        dom.statusText().textContent    = 'Failed to load WASM engine from CDN. Check connection.';
        termLog(`ERROR loading FFmpeg: ${err.message}`, 'error');
        window.showToast('WASM engine failed to load. See terminal for details.', true);
    }
}


/* ============================================================================
   FILE HANDLING — handleFileSelect
   Called whenever the user selects a file via the file input, drag-and-drop,
   or the browse button. Validates the file, updates UI, loads the video into
   the native player for preview, and enables the process button.

   @param {File} file  — The File object from the input or DataTransfer
   ========================================================================== */
function handleFileSelect(file) {
    // ── Validation: must be a video MIME type ──
    if (!file || !file.type.startsWith('video/')) {
        window.showToast('Please select a valid video file.', true);
        return;
    }

    // ── Validation: 2 GB size limit (FFmpeg WASM memory constraint) ──
    if (file.size > 2 * 1024 * 1024 * 1024) {
        window.showToast('File exceeds 2GB limit. Please use a smaller file.', true);
        return;
    }

    // ── Update state ──
    state.inputFile    = file;
    const parts        = file.name.split('.');
    state.inputFileExt = parts.pop().toLowerCase();
    state.inputFileName = sanitizeFilename(parts.join('.')) || 'video';

    // ── Update UI: swap upload zone for the file info bar ──
    dom.fileInfoName().textContent     = file.name;
    dom.fileInfoSize().textContent     = formatSize(file.size);
    dom.fileInfoBar().style.display    = 'flex';
    dom.uploadZone().style.display     = 'none';

    // ── Load the video into the native <video> player for preview ──
    const url                          = URL.createObjectURL(file);
    const player                       = dom.videoPlayer();
    player.src                         = url;
    player.style.display               = 'block';
    dom.playerPlaceholder().style.display = 'none';

    // Log file metadata once the video's duration is available
    player.addEventListener('loadedmetadata', () => {
        state.videoDuration = player.duration;
        termLog(
            `File loaded: ${file.name} | Size: ${formatSize(file.size)} | Duration: ${formatDuration(player.duration)}`,
            'info'
        );
    }, { once: true }); // { once: true } auto-removes the listener after firing

    // ── Reset result sections from any previous run ──
    dom.downloadSection().style.display = 'none';
    dom.progressSection().style.display = 'none';
    clearProgressBar();

    // Enable the process button only if the WASM engine is also ready
    if (state.ffmpegLoaded) {
        enableProcessButton();
    } else {
        dom.processBtnText().textContent = 'Loading WASM Engine...';
    }
}


/* ============================================================================
   FILE HANDLING — removeFile
   Clears the loaded file from state and resets the entire UI to its initial
   empty state. Also revokes any active object URLs to free browser memory.
   ========================================================================== */
function removeFile() {
    state.inputFile    = null;
    state.outputBlob   = null;

    // Reset UI elements to pre-upload state
    dom.fileInfoBar().style.display       = 'none';
    dom.uploadZone().style.display        = 'block';
    dom.videoPlayer().style.display       = 'none';
    dom.videoPlayer().src                 = '';
    dom.playerPlaceholder().style.display = 'flex';
    dom.downloadSection().style.display   = 'none';
    dom.progressSection().style.display   = 'none';

    disableProcessButton();
    dom.fileInput().value = ''; // Allow the same file to be re-selected
    termLog('File removed. Ready for a new upload.', 'muted');
}


/* ============================================================================
   PROCESS BUTTON HELPERS
   enableProcessButton  — Sets the correct label for the active tab and
                          re-enables the button for user interaction.
   disableProcessButton — Grays out the button and shows default placeholder text.
   clearProgressBar     — Resets all progress bar visuals to 0%.
   ========================================================================== */
function enableProcessButton() {
    const btn    = dom.processBtn();
    btn.disabled = false;

    // Each tab has a distinct action label for the CTA button
    const labels = {
        compress : 'Compress Video',
        trim     : 'Trim Video',
        gif      : 'Create GIF',
        audio    : 'Extract Audio',
        godmode  : 'Apply God Mode',
    };
    dom.processBtnText().textContent  = labels[state.currentTab] || 'Start Processing';
    dom.processBtnIcon().className    = 'fa-solid fa-bolt';
}

function disableProcessButton() {
    dom.processBtn().disabled         = true;
    dom.processBtnText().textContent  = 'Upload a Video to Begin';
    dom.processBtnIcon().className    = 'fa-solid fa-bolt';
}

function clearProgressBar() {
    dom.progressBar().style.width    = '0%';
    dom.progressPct().textContent    = '0%';
    dom.progressLabel().textContent  = 'Processing...';
}


/* ============================================================================
   DRAG AND DROP INITIALIZATION
   Wires up all file-input event sources:
     - Drag-over / drop on the upload zone
     - Click on the upload zone (opens file picker)
     - Click on the "browse" text link
     - Native <input type="file"> change event
     - The "×" remove button on the file info bar
   ========================================================================== */
function initDragAndDrop() {
    const zone = dom.uploadZone();

    // Prevent default browser file-open behavior while dragging over the zone
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over'); // applies the glow border via CSS
    });

    // Remove visual drag-over state when the cursor leaves the zone
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });

    // Handle the actual file drop
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    });

    // Clicking anywhere on the zone triggers the hidden file input
    zone.addEventListener('click', () => {
        dom.fileInput().click();
    });

    // The "click to browse" span also triggers the file input (with stopPropagation
    // to prevent the parent zone click listener from firing twice)
    dom.uploadBrowseBtn().addEventListener('click', (e) => {
        e.stopPropagation();
        dom.fileInput().click();
    });

    // Native file input change: fires when user picks a file via the OS dialog
    dom.fileInput().addEventListener('change', (e) => {
        if (e.target.files[0]) handleFileSelect(e.target.files[0]);
    });

    // Remove-file button on the info bar
    dom.removeFileBtn().addEventListener('click', removeFile);
}


/* ============================================================================
   TAB SYSTEM INITIALIZATION
   Attaches click handlers to all .action-tab buttons. On each click:
     1. Removes .active from all tab buttons and all tab panels.
     2. Adds .active to the clicked tab button and its matching panel.
     3. Shows or hides the trim timeline hint as appropriate.
     4. Updates the process button label to match the newly selected action.
   ========================================================================== */
function initTabs() {
    document.querySelectorAll('.action-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab; // e.g. 'compress', 'trim', 'gif'

            // Deactivate all tabs and panels
            document.querySelectorAll('.action-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

            // Activate the clicked tab and its corresponding content panel
            btn.classList.add('active');
            document.getElementById(`panel-${tab}`).classList.add('active');
            state.currentTab = tab;

            // The timeline hint is only relevant when the Trim tab is active
            dom.timelineHint().style.display = (tab === 'trim') ? 'flex' : 'none';

            // Reflect the new tab name in the process button label
            if (state.inputFile && state.ffmpegLoaded) {
                enableProcessButton();
            }
        });
    });
}


/* ============================================================================
   SETTINGS LIVE HINTS INITIALIZATION
   Attaches 'input' event listeners to all range sliders so the inline
   hint badges update in real time as the user drags the slider thumb.
   ========================================================================== */
function initSettingsHints() {

    /* ── CRF Slider: quality description lookup ──────────────────────── */
    // Maps specific CRF integer values to human-readable quality labels.
    const crfDescriptions = {
        18: 'Near-Lossless (Huge)',
        19: 'Near-Lossless (Huge)',
        20: 'Visually Lossless',
        21: 'Visually Lossless',
        22: 'Very High Quality',
        23: 'High Quality',
        24: 'Good Quality',
        25: 'Good Quality',
        26: 'Standard',
        27: 'Standard',
        28: 'Balanced ★',
        29: 'Web-Optimized',
        30: 'Web-Optimized',
        32: 'Small File',
        34: 'Smaller File',
        36: 'Very Compressed',
        38: 'Low Quality',
        40: 'Minimum Quality',
    };
    dom.crfSlider().addEventListener('input', (e) => {
        const v     = parseInt(e.target.value);
        const label = crfDescriptions[v] || (v <= 28 ? 'High Quality' : 'Compressed');
        dom.crfHint().textContent = `${v} — ${label}`;
    });

    /* ── FPS Slider: raw value display ───────────────────────────────── */
    dom.fpsSlider().addEventListener('input', (e) => {
        dom.fpsHint().textContent = `${e.target.value} FPS`;
    });

    /* ── Speed Slider: contextual slow/fast label ─────────────────────── */
    dom.speedSlider().addEventListener('input', (e) => {
        const v     = parseFloat(e.target.value);
        const label = v === 1
            ? '1× — Normal'
            : (v < 1 ? `${v}× — Slow Motion` : `${v}× — Fast Forward`);
        dom.speedHint().textContent = label;
    });
}


/* ============================================================================
   FFMPEG COMMAND BUILDERS
   Each function returns an array of CLI argument strings that will be passed
   to ffmpeg.exec(). Arguments are built from the current DOM settings values.
   ========================================================================== */

/**
 * buildCompressArgs
 * Constructs the FFmpeg argument list for the Compress tab.
 * Uses libx264 (H.264) or libvpx-vp9 (WEBM), with CRF quality control,
 * optional scale filter for resolution downscaling, and AAC audio.
 * The +faststart movflag re-orders the MP4 container for instant web streaming.
 *
 * @param  {string} inputName   — Filename in the WASM virtual filesystem
 * @param  {string} outputName  — Output filename in the WASM virtual filesystem
 * @return {string[]}           — FFmpeg argument array
 */
function buildCompressArgs(inputName, outputName) {
    const crf    = dom.crfSlider().value;
    const preset = dom.presetSelect().value;
    const res    = dom.resolutionSelect().value;
    const fmt    = dom.formatSelect().value;

    const args = ['-i', inputName];

    if (fmt === 'webm') {
        // VP9: CRF quality mode with -b:v 0 forces variable bitrate guided by CRF
        args.push('-c:v', 'libvpx-vp9', '-crf', crf, '-b:v', '0');
    } else {
        // H.264: standard CRF encoding with an encoding speed/quality trade-off preset
        args.push('-c:v', 'libx264', '-crf', crf, '-preset', preset);
    }

    // Apply a scale filter if the user selected a specific output resolution
    if (res !== 'source') {
        const [w, h] = res.split(':');
        // force_original_aspect_ratio=decrease maintains the original ratio;
        // pad then fills the remaining area to hit the exact target resolution
        args.push('-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`);
    }

    // Re-encode audio to AAC at 128k (safe universal compatibility)
    args.push('-c:a', 'aac', '-b:a', '128k');

    // Optimize the MP4 container for streaming (moves moov atom to the front)
    args.push('-movflags', '+faststart');
    args.push(outputName);

    return args;
}

/**
 * buildTrimArgs
 * Constructs the FFmpeg argument list for the Trim tab.
 * Placing -ss BEFORE -i enables fast keyframe seeking (input-side seek),
 * which is much faster than output-side seeking for large files.
 * Re-encode mode uses libx264 for frame-accurate (non-keyframe-aligned) cuts.
 *
 * @param  {string} inputName   — Filename in the WASM virtual filesystem
 * @param  {string} outputName  — Output filename in the WASM virtual filesystem
 * @return {string[]}           — FFmpeg argument array
 */
function buildTrimArgs(inputName, outputName) {
    const startRaw = dom.trimStart().value.trim();
    const endRaw   = dom.trimEnd().value.trim();
    const reEncode = dom.trimReencode().value;

    const args = [];

    // Input-side seek: place -ss before -i for fast keyframe-accurate seeking
    if (startRaw) {
        args.push('-ss', startRaw);
    }
    args.push('-i', inputName);

    // -to is interpreted relative to -ss when placed after -i
    if (endRaw) {
        args.push('-to', endRaw);
    }

    if (reEncode === 'copy') {
        // Stream copy: ultra-fast, no quality loss, but cut may start on nearest keyframe
        args.push('-c', 'copy');
    } else {
        // Re-encode: slower but guarantees a frame-perfect cut at exact timestamps
        args.push('-c:v', 'libx264', '-crf', '23', '-c:a', 'aac');
    }

    // Prevent negative DTS timestamps from causing playback issues
    args.push('-avoid_negative_ts', 'make_zero');
    args.push(outputName);

    return args;
}

/**
 * buildGifArgs
 * Constructs the two-pass FFmpeg argument lists for GIF creation.
 *
 * Pass 1 (palettegen): Analyzes the video frames to build an optimized
 *   256-color palette. stats_mode=diff improves quality for animations.
 *
 * Pass 2 (paletteuse): Encodes the GIF using the generated palette with
 *   Bayer dithering for significantly reduced color banding.
 *
 * The Lanczos scaling filter provides high-quality resizing.
 *
 * @param  {string} inputName    — Filename in the WASM virtual filesystem
 * @param  {string} paletteName  — Intermediate palette PNG filename
 * @param  {string} outputName   — Final GIF output filename
 * @return {{ pass1: string[], pass2: string[] }}  — Two argument arrays
 */
function buildGifArgs(inputName, paletteName, outputName) {
    const fps      = dom.fpsSlider().value;
    const width    = dom.gifWidth().value;
    const startRaw = dom.gifStart().value.trim();
    const duration = dom.gifDuration().value;

    // Common time-range arguments prepended to both passes
    const baseArgs = [];
    if (startRaw) baseArgs.push('-ss', startRaw);
    baseArgs.push('-t', duration.toString());

    // Pass 1: Generate the optimal color palette PNG
    const pass1 = [
        ...baseArgs,
        '-i', inputName,
        '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
        '-y', paletteName
    ];

    // Pass 2: Encode the final GIF using the palette from Pass 1
    const pass2 = [
        ...baseArgs,
        '-i', inputName,
        '-i', paletteName,
        '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
        '-loop', '0',   // 0 = infinite loop
        '-y', outputName
    ];

    return { pass1, pass2 };
}

/**
 * buildAudioArgs
 * Constructs the FFmpeg argument list for audio extraction.
 * -vn removes the video stream entirely, leaving only the selected
 * audio codec and bitrate settings.
 *
 * @param  {string} inputName   — Filename in the WASM virtual filesystem
 * @param  {string} outputName  — Output audio filename
 * @return {string[]}           — FFmpeg argument array
 */
function buildAudioArgs(inputName, outputName) {
    const format  = dom.audioFormat().value;
    const bitrate = dom.audioBitrate().value;

    const args = ['-i', inputName, '-vn']; // -vn = strip video stream

    if (format === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
    } else if (format === 'aac') {
        args.push('-c:a', 'aac', '-b:a', bitrate);
    } else if (format === 'wav') {
        args.push('-c:a', 'pcm_s16le'); // Uncompressed 16-bit PCM — bitrate is ignored
    } else if (format === 'ogg') {
        args.push('-c:a', 'libvorbis', '-b:a', bitrate);
    } else if (format === 'flac') {
        args.push('-c:a', 'flac');      // Lossless FLAC — bitrate is ignored
    }

    args.push(outputName);
    return args;
}

/**
 * buildGodModeArgs
 * Constructs a complex FFmpeg argument list combining:
 *   - setpts video speed filter (0.25×–4×)
 *   - colorkey chroma key filter (optional)
 *   - transpose / hflip / vflip rotation/mirror filters
 *   - atempo audio speed chain (for correct audio pitch at all speeds)
 *
 * All active video filters are joined into a single -vf chain so they can
 * be applied in one encoding pass.
 *
 * @param  {string} inputName   — Filename in the WASM virtual filesystem
 * @param  {string} outputName  — Output filename in the WASM virtual filesystem
 * @return {string[]}           — FFmpeg argument array
 */
function buildGodModeArgs(inputName, outputName) {
    const speed    = parseFloat(dom.speedSlider().value);
    const chromaSim = dom.chromaSimilarity().value;
    const rotation = dom.rotateSelect().value;
    const fmt      = dom.godFormatSelect().value;

    const filterParts = [];

    // ── Video speed: setpts scales the presentation timestamps ──
    // setpts=1/speed*PTS — a speed of 2× halves the PTS values (twice as fast)
    if (speed !== 1) {
        filterParts.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
    }

    // ── Chroma key: colorkey removes pixels matching the sampled color ──
    if (chromaSim !== 'off') {
        const color = dom.chromaColor().value.replace('#', '0x');
        // similarity = tolerance; blend = feathering at the edge
        filterParts.push(`colorkey=${color}:${chromaSim}:0.1`);
    }

    // ── Rotation and flip transform filters ──
    if (rotation === '90')    filterParts.push('transpose=1');             // 90° CW
    if (rotation === '180')   filterParts.push('transpose=2,transpose=2'); // 180°
    if (rotation === '270')   filterParts.push('transpose=2');             // 90° CCW
    if (rotation === 'hflip') filterParts.push('hflip');
    if (rotation === 'vflip') filterParts.push('vflip');

    const args = ['-i', inputName];

    // Only add -vf if at least one video filter is active
    if (filterParts.length > 0) {
        args.push('-vf', filterParts.join(','));
    }

    // ── Audio speed: atempo handles audio pitch-corrected speed changes ──
    // atempo only accepts values in 0.5–2.0, so we chain multiple instances
    // for speeds outside that range (e.g. 4× = atempo=2.0,atempo=2.0)
    if (speed !== 1) {
        const audioFilters = buildAtempoChain(speed);
        if (audioFilters) {
            args.push('-af', audioFilters);
        }
    }

    // Select the output video codec based on the chosen container format
    args.push('-c:v', fmt === 'webm' ? 'libvpx-vp9' : 'libx264');
    if (fmt !== 'webm') args.push('-crf', '23');
    args.push('-c:a', 'aac');
    args.push(outputName);

    return args;
}

/**
 * buildAtempoChain
 * Constructs a chained series of atempo filters for audio playback speed.
 * FFmpeg's atempo filter only accepts a value between 0.5 and 2.0 per
 * instance. For speeds outside that range, multiple filters are chained:
 *   4× speed: atempo=2.0,atempo=2.0
 *   0.25× speed: atempo=0.5,atempo=0.5
 *
 * @param  {number} speed  — Desired playback speed multiplier (e.g. 2.5)
 * @return {string|null}   — Comma-separated atempo filter string, or null if 1×
 */
function buildAtempoChain(speed) {
    if (speed === 1) return null;

    const filters = [];
    let s = speed;

    // Chain atempo=2.0 until the remaining multiplier is ≤ 2.0
    while (s > 2.0) {
        filters.push('atempo=2.0');
        s /= 2.0;
    }

    // Chain atempo=0.5 until the remaining multiplier is ≥ 0.5
    while (s < 0.5) {
        filters.push('atempo=0.5');
        s /= 0.5;
    }

    // Append the final fractional remainder
    filters.push(`atempo=${s.toFixed(4)}`);
    return filters.join(',');
}


/* ============================================================================
   TWO-PASS GIF PROCESSOR
   Orchestrates the two-step GIF encoding pipeline:
     Pass 1 — Generate an optimized per-video color palette PNG
     Pass 2 — Encode the GIF using that palette for maximum quality
   Progress updates are manually set since FFmpeg doesn't emit granular
   progress events for palette generation.

   @param {FFmpeg} ff            — Loaded FFmpeg WASM instance
   @param {string} inputVfsName  — Input video path in WASM virtual FS
   @param {string} paletteVfsName — Palette PNG path in WASM virtual FS
   @param {string} outputVfsName — Output GIF path in WASM virtual FS
   ========================================================================== */
async function processGif(ff, inputVfsName, paletteVfsName, outputVfsName) {
    const { pass1, pass2 } = buildGifArgs(inputVfsName, paletteVfsName, outputVfsName);

    // ── GIF Pass 1: palette generation ──
    termLog('[GIF] Pass 1/2: Generating color palette...', 'info');
    termLog(`ffmpeg ${pass1.join(' ')}`, 'cmd');
    updateProgress(0.01, 'GIF: Generating palette (1/2)...');
    await ff.exec(pass1);
    termLog('[GIF] Palette generated.', 'success');

    // ── GIF Pass 2: frame encoding ──
    termLog('[GIF] Pass 2/2: Encoding GIF frames...', 'info');
    termLog(`ffmpeg ${pass2.join(' ')}`, 'cmd');
    updateProgress(0.5, 'GIF: Encoding frames (2/2)...');
    await ff.exec(pass2);
}


/* ============================================================================
   OUTPUT FINALIZER
   Called after FFmpeg completes execution (all modes except GIF call this
   directly; GIF calls processGif first, then calls this).

   Steps:
     1. Read the output file bytes from FFmpeg's virtual filesystem.
     2. Create a Blob from the bytes and generate an Object URL.
     3. Attach the URL and filename to the download anchor.
     4. Calculate and display file size comparison statistics.
     5. Reveal the download section.
     6. Clean up all input/output files from the WASM virtual FS
        to prevent memory accumulation across multiple runs.

   @param {FFmpeg}      ff             — Loaded FFmpeg WASM instance
   @param {string}      outputVfsName  — Output file path in WASM virtual FS
   @param {string}      outputMime     — MIME type string for the Blob
   @param {string}      outputExt      — File extension for the download filename
   @param {string}      inputVfsName   — Input file path to clean up
   @param {string|null} paletteVfsName — Palette PNG path to clean up (GIF only)
   ========================================================================== */
async function finalizeOutput(ff, outputVfsName, outputMime, outputExt, inputVfsName, paletteVfsName = null) {
    termLog('Reading output from WASM filesystem...', 'info');
    updateProgress(0.99, 'Finalizing...');

    // Read the raw output bytes and wrap them in a Blob
    const outputData = await ff.readFile(outputVfsName);
    const outputBlob = new Blob([outputData.buffer], { type: outputMime });
    state.outputBlob = outputBlob;

    // Build a descriptive download filename: vs_<tab>_<name>_<timestamp>.<ext>
    const timestamp         = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    state.outputFilename    = `vs_${state.currentTab}_${state.inputFileName}_${timestamp}.${outputExt}`;

    // Wire up the download anchor with a fresh object URL
    const downloadURL       = URL.createObjectURL(outputBlob);
    dom.downloadBtn().href          = downloadURL;
    dom.downloadBtn().download      = state.outputFilename;
    dom.downloadBtnText().textContent = `Download ${outputExt.toUpperCase()} (${formatSize(outputBlob.size)})`;

    // ── File size comparison statistics ──
    const origSize  = state.inputFile.size;
    const newSize   = outputBlob.size;
    const savedPct  = origSize > 0
        ? (((origSize - newSize) / origSize) * 100).toFixed(1)
        : 0;

    dom.statOriginal().textContent = formatSize(origSize);
    dom.statResult().textContent   = formatSize(newSize);
    dom.statSavings().textContent  = newSize < origSize
        ? `${savedPct}% smaller`
        : (newSize > origSize ? `${Math.abs(savedPct)}% larger` : 'Same size');

    // Reveal the download card
    dom.downloadSection().style.display = 'flex';

    updateProgress(1, 'Complete ✓');
    termLog(`Output: ${state.outputFilename} | Size: ${formatSize(newSize)}`, 'success');
    if (newSize < origSize) {
        termLog(`Saved ${formatSize(origSize - newSize)} (${savedPct}% reduction)`, 'success');
    }
    window.showToast('Processing complete! Ready to download.');

    /* ── WASM Virtual FS Cleanup ──────────────────────────────────────────
       Critical: Removing files from FFmpeg's in-memory filesystem after
       reading them frees the allocated WASM heap memory. Without this,
       repeated processing runs will eventually exhaust available RAM and
       crash the browser tab.
    ──────────────────────────────────────────────────────────────────── */
    try {
        await ff.deleteFile(inputVfsName);
        await ff.deleteFile(outputVfsName);
        if (paletteVfsName) await ff.deleteFile(paletteVfsName);
        termLog('WASM virtual filesystem cleaned up.', 'muted');
    } catch (cleanupErr) {
        // Non-fatal: files may have already been removed or never created
        termLog(`Cleanup note: ${cleanupErr.message}`, 'muted');
    }

    // ── Reset processing guard state ──
    state.isProcessing              = false;
    dom.processBtn().classList.remove('processing');
    dom.processBtn().disabled       = false;
    dom.processBtnText().textContent = 'Process Again';
    dom.processBtnIcon().className  = 'fa-solid fa-bolt';
}


/* ============================================================================
   CORE PROCESSING DISPATCHER — startProcessing
   The main entry point for all FFmpeg operations. Called by the
   "Start Processing" button click event.

   Pipeline:
     1. Pre-flight checks (engine loaded, file present, not already running)
     2. UI transition to "processing" state
     3. Write input file to FFmpeg's virtual filesystem via fetchFile()
     4. Dispatch to the correct command builder for the active tab
     5. Execute ffmpeg.exec() with the built argument array
     6. Call finalizeOutput() to read the result and update the UI
   ========================================================================== */
async function startProcessing() {
    // ── Guard: WASM engine must be loaded ──
    if (!state.ffmpegLoaded) {
        window.showToast('FFmpeg engine is still loading. Please wait...');
        return;
    }

    // ── Guard: a file must be selected ──
    if (!state.inputFile) {
        window.showToast('Please upload a video file first.', true);
        return;
    }

    // ── Guard: prevent concurrent runs ──
    if (state.isProcessing) {
        window.showToast('Processing already in progress...');
        return;
    }

    state.isProcessing = true;
    const ff           = state.ffmpeg;
    const { fetchFile } = window._ffmpegUtil;

    // ── Transition the UI to "processing" state ──
    dom.processBtn().disabled           = true;
    dom.processBtn().classList.add('processing');
    dom.processBtnText().textContent    = 'Processing...';
    dom.processBtnIcon().className      = 'fa-solid fa-spinner fa-spin';
    dom.downloadSection().style.display = 'none';
    dom.progressSection().style.display = 'block';
    clearProgressBar();

    // Determine the WASM virtual FS filenames
    const inputVfsName  = `input.${state.inputFileExt}`;
    let outputVfsName   = 'output.mp4';
    let outputMime      = 'video/mp4';
    let outputExt       = 'mp4';
    const paletteVfsName = 'palette.png';

    try {
        /* ── Step 1: Write input file to WASM virtual filesystem ──────────
           fetchFile() reads the File object into a Uint8Array; writeFile()
           copies it into FFmpeg's in-memory virtual FS so it can be
           accessed by the compiled FFmpeg binary.
        ──────────────────────────────────────────────────────────────── */
        termLog(`Writing ${state.inputFile.name} to WASM virtual filesystem...`, 'info');
        updateProgress(0, 'Loading file into WASM memory...');
        const fileData = await fetchFile(state.inputFile);
        await ff.writeFile(inputVfsName, fileData);
        termLog(`Input file written: ${formatSize(state.inputFile.size)}`, 'success');

        /* ── Step 2: Dispatch to the correct command builder ───────────── */
        let ffArgs;
        const tab = state.currentTab;

        if (tab === 'compress') {
            const fmt     = dom.formatSelect().value;
            outputExt     = fmt;
            outputVfsName = `output.${fmt}`;
            outputMime    = fmt === 'webm' ? 'video/webm' : 'video/mp4';
            ffArgs        = buildCompressArgs(inputVfsName, outputVfsName);

        } else if (tab === 'trim') {
            outputExt     = 'mp4';
            outputVfsName = 'output.mp4';
            outputMime    = 'video/mp4';
            ffArgs        = buildTrimArgs(inputVfsName, outputVfsName);

        } else if (tab === 'gif') {
            // GIF uses a special two-pass flow — handled separately, then returns early
            outputExt     = 'gif';
            outputVfsName = 'output.gif';
            outputMime    = 'image/gif';
            await processGif(ff, inputVfsName, paletteVfsName, outputVfsName);
            await finalizeOutput(ff, outputVfsName, outputMime, outputExt, inputVfsName, paletteVfsName);
            return; // Early return — no single exec() step needed for GIF

        } else if (tab === 'audio') {
            const fmt     = dom.audioFormat().value;
            outputExt     = fmt;
            outputVfsName = `output.${fmt}`;
            // MIME type map for all supported audio output formats
            const mimeMap = {
                mp3: 'audio/mpeg', aac: 'audio/aac',
                wav: 'audio/wav',  ogg: 'audio/ogg',
                flac: 'audio/flac'
            };
            outputMime    = mimeMap[fmt] || 'audio/mpeg';
            ffArgs        = buildAudioArgs(inputVfsName, outputVfsName);

        } else if (tab === 'godmode') {
            const fmt     = dom.godFormatSelect().value;
            outputExt     = fmt;
            outputVfsName = `output.${fmt}`;
            outputMime    = fmt === 'webm' ? 'video/webm' : 'video/mp4';
            ffArgs        = buildGodModeArgs(inputVfsName, outputVfsName);
        }

        /* ── Step 3: Log the full FFmpeg command to the terminal ───────── */
        termLog(`ffmpeg ${ffArgs.join(' ')}`, 'cmd');
        updateProgress(0.01, 'Starting FFmpeg...');

        /* ── Step 4: Execute the FFmpeg command ─────────────────────────── */
        await ff.exec(ffArgs);

        /* ── Step 5: Read output, update stats, and show download ───────── */
        await finalizeOutput(ff, outputVfsName, outputMime, outputExt, inputVfsName);

    } catch (err) {
        // ── Processing failed: update UI and notify the user ──
        termLog(`Processing failed: ${err.message}`, 'error');
        window.showToast(`Processing failed: ${err.message}`, true);
        dom.progressLabel().textContent     = 'Failed';
        dom.processBtnText().textContent    = 'Try Again';
        dom.processBtnIcon().className      = 'fa-solid fa-rotate-right';
        dom.processBtn().disabled           = false;
        dom.processBtn().classList.remove('processing');
        state.isProcessing                  = false;
    }
}


/* ============================================================================
   PROCESS ANOTHER — processAnother
   Resets the tool to a clean state so the user can process a new file
   without refreshing the page. Revokes the previous download Blob URL
   to release the browser memory held by the completed output.
   ========================================================================== */
function processAnother() {
    // Release the Blob Object URL created in finalizeOutput() to free memory
    if (dom.downloadBtn().href.startsWith('blob:')) {
        URL.revokeObjectURL(dom.downloadBtn().href);
    }

    // Reset file state and restore the upload zone UI
    removeFile();
    dom.downloadSection().style.display = 'none';
    dom.progressSection().style.display = 'none';
}


/* ============================================================================
   TERMINAL CLEAR — clearTerminal
   Wipes all log lines from the terminal body and appends a single
   confirmation line to acknowledge the clear action.
   ========================================================================== */
function clearTerminal() {
    dom.terminalBody().innerHTML = '';
    termLog('Terminal cleared.', 'muted');
}


/* ============================================================================
   BUTTON & CONTROL INITIALIZATION
   Binds all action button click events to their handler functions.
   ========================================================================== */
function initProcessButton() {
    dom.processBtn().addEventListener('click', startProcessing);
    dom.processAnotherBtn().addEventListener('click', processAnother);
    dom.termClear().addEventListener('click', clearTerminal);
}


/* ============================================================================
   BROWSER COMPATIBILITY CHECK
   Validates that the two critical browser capabilities required by FFmpeg WASM
   are available: WebAssembly itself, and SharedArrayBuffer.

   - SharedArrayBuffer is required for multi-thread mode. Without it, FFmpeg
     falls back to single-thread (slower) but still functional.
   - If WebAssembly is entirely absent, the tool cannot function at all.

   @return {boolean}  — true if the browser meets minimum requirements
   ========================================================================== */
function checkBrowserCompatibility() {
    // Check for SharedArrayBuffer (COOP/COEP headers required)
    if (typeof SharedArrayBuffer === 'undefined') {
        termLog('WARNING: SharedArrayBuffer not available in this browser.', 'warn');
        termLog('FFmpeg will run in single-thread fallback mode (slower).', 'warn');
        termLog('For best performance, use Chrome 90+ or Firefox 89+.', 'warn');
        window.showToast('Browser may not fully support WASM. Processing may be slower.');
    }

    // Check for WebAssembly — required; tool cannot function without it
    if (!window.WebAssembly) {
        termLog('CRITICAL: WebAssembly is not supported in this browser!', 'error');
        window.showToast('WebAssembly not supported. Please use a modern browser.', true);
        dom.statusDot().className       = 'status-dot error';
        dom.statusText().textContent    = 'WebAssembly not supported in this browser.';
        return false;
    }

    return true;
}


/* ============================================================================
   ENTRY POINT — init
   The main initialization function. Runs after DOMContentLoaded.

   Order of operations:
     1. Browser compatibility check (bail early if WebAssembly is absent)
     2. Bind all UI event listeners (drag-drop, tabs, sliders, buttons)
     3. Load the FFmpeg WASM engine asynchronously (does not block UI)
   ========================================================================== */
async function init() {
    termLog('WASM Video Studio Pro — Initializing...', 'info');

    // 1. Ensure the browser supports the required Web APIs
    const compatible = checkBrowserCompatibility();
    if (!compatible) return;

    // 2. Wire up all UI interaction event listeners
    initDragAndDrop();
    initTabs();
    initSettingsHints();
    initProcessButton();

    // 3. Start the async WASM engine load (non-blocking — UI remains interactive)
    await loadFFmpeg();

    termLog('UI ready. Drag a video file to begin.', 'muted');
}


/* ============================================================================
   DOM READY GUARD
   Ensures init() runs only after the DOM is fully parsed and all element
   IDs referenced in the `dom` map above are accessible.
   ========================================================================== */
if (document.readyState === 'loading') {
    // DOM not yet parsed — wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM already ready (module loaded after parse) — run immediately
    init();
}
