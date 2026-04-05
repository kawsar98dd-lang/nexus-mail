/**
 * =============================================================================
 *  ULTRA STUDIO PRO MAX — PRODUCTION ENGINE (v6.1.0 STABLE)
 * =============================================================================
 *  @file         script.js
 *  @author       Trusted Tools Web — MD KAWSAR
 *  @version      6.1.0
 *  @description  Complete client-side audio workstation engine.
 *                Handles: File ingestion, AudioContext lifecycle, WaveSurfer
 *                waveform & region visualisation, real-time DSP graph
 *                (3-Band EQ, Bass Boost, Stereo Panner), animated spectrum
 *                visualiser, DSP Voice FX presets (Robot Ring Modulator,
 *                Chipmunk Pitch, Monster Bass), Reverse Mode, Microphone
 *                Recording via MediaRecorder API, and high-quality Offline
 *                Render to MP3 (via LameJS) or Lossless WAV (PCM).
 *  @compliance   Strict mode enabled. Memory leaks patched. GC-safe.
 *  @privacy      100% client-side. No audio data is ever uploaded to a server.
 * =============================================================================
 */
"use strict";

/* ============================================================================
   SECTION 1 — GLOBAL STATE & CONFIGURATION
   Central application state object. All mutable runtime values live here to
   avoid polluting the global scope and to simplify memory cleanup.
============================================================================ */

/**
 * appState
 * Single source of truth for all runtime state.
 * @property {WaveSurfer|null}      wavesurfer       — Active WaveSurfer instance.
 * @property {AudioContext|null}    audioContext      — Web Audio API context (singleton).
 * @property {AudioBuffer|null}     originalBuffer    — Decoded raw audio buffer (source of truth).
 * @property {boolean}             isPlaying         — Current playback state.
 * @property {boolean}             isRecording       — Whether mic recording is active.
 * @property {Blob|null}           currentFileBlob   — The loaded audio file Blob.
 * @property {MediaRecorder|null}  mediaRecorder     — Active MediaRecorder instance.
 * @property {Array}               audioChunks       — Accumulated recorded data chunks.
 * @property {number|null}         animationFrame    — rAF handle for visualiser loop.
 * @property {boolean}             robotMode         — Toggle for offline Ring Modulator render.
 */
const appState = {
    wavesurfer      : null,
    audioContext    : null,
    originalBuffer  : null,
    isPlaying       : false,
    isRecording     : false,
    currentFileBlob : null,
    mediaRecorder   : null,
    audioChunks     : [],
    animationFrame  : null,
    robotMode       : false
};

/* ============================================================================
   SECTION 2 — LIVE AUDIO GRAPH NODES
   These nodes form the real-time DSP chain connected inside WaveSurfer's
   Web Audio backend. Updated on every slider input event.
   Flow: WaveSurfer Source → eqLow → eqMid → eqHigh → panner → analyser → Output
============================================================================ */

/**
 * audioNodes
 * Holds references to active Web Audio API nodes for real-time parameter updates.
 * @property {BiquadFilterNode|null} eqLow    — Low-shelf filter (320 Hz).
 * @property {BiquadFilterNode|null} eqMid    — Peaking filter (1 kHz).
 * @property {BiquadFilterNode|null} eqHigh   — High-shelf filter (3.2 kHz).
 * @property {StereoPannerNode|null} panner   — Stereo panning for 8D effect.
 * @property {AnalyserNode|null}     analyser — FFT data source for spectrum canvas.
 */
const audioNodes = {
    source  : null,
    eqLow   : null,
    eqMid   : null,
    eqHigh  : null,
    panner  : null,
    analyser: null
};

/* ============================================================================
   SECTION 3 — DOM ELEMENT REFERENCES
   All interactive DOM nodes are captured once at module load time to avoid
   repeated querySelector calls during high-frequency events (e.g. slider input).
============================================================================ */

/**
 * el
 * Cached DOM element references keyed by logical name.
 * Sliders are nested under el.sliders for grouped iteration.
 * FX preset buttons are nested under el.fxBtns for batch state resets.
 */
const el = {
    dropZone    : document.getElementById('drop-zone'),
    fileInput   : document.getElementById('file-input'),
    editor      : document.getElementById('editor-interface'),
    playBtn     : document.getElementById('play-btn'),
    stopBtn     : document.getElementById('stop-btn'),
    recBtn      : document.getElementById('rec-trigger'),
    timeCurr    : document.getElementById('time-current'),
    timeTotal   : document.getElementById('time-total'),
    canvas      : document.getElementById('visualizer'),

    /** Grouped slider references for batch update iteration */
    sliders: {
        zoom    : document.getElementById('zoom-slider'),
        pan     : document.getElementById('pan-slider'),
        bass    : document.getElementById('bass-slider'),
        speed   : document.getElementById('speed-slider'),
        eqLow   : document.getElementById('eq-low'),
        eqMid   : document.getElementById('eq-mid'),
        eqHigh  : document.getElementById('eq-high')
    },

    reverseCheck : document.getElementById('reverse-mode'),

    /** FX preset toggle buttons — used for active-state class management */
    fxBtns: {
        robot : document.getElementById('btn-fx-robot'),
        high  : document.getElementById('btn-fx-high'),
        low   : document.getElementById('btn-fx-low')
    }
};

/* ============================================================================
   SECTION 4 — INITIALISATION
   Entry point. Fires on DOMContentLoaded to wire all event listeners.
============================================================================ */

/**
 * DOMContentLoaded handler.
 * Bootstraps the application by setting up event listeners.
 * Theme sync is handled by global.js — no local override needed.
 */
window.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkMobileCompatibility();
});

/**
 * checkMobileCompatibility
 * Detects mobile browsers where the Web Audio API / OfflineAudioContext may
 * have limited support. Triggers a global toast warning if unsupported APIs
 * are absent, without blocking the UI.
 */
function checkMobileCompatibility() {
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
    const hasWebAudio = !!(window.AudioContext || window.webkitAudioContext);
    const hasOfflineCtx = !!window.OfflineAudioContext;

    if (isMobile && (!hasWebAudio || !hasOfflineCtx)) {
        // Warn the user that rendering/encoding may be limited on their device
        window.showToast('Your browser may have limited audio support. Rendering may not work on this device.', true);
    }
}

/* ============================================================================
   SECTION 5 — EVENT LISTENERS
   Wires all interactive elements: drag-and-drop, file input, playback
   controls, zoom slider, and the real-time DSP slider group.
============================================================================ */

/**
 * initEventListeners
 * Attaches all event listeners to cached DOM elements.
 * Guard checks (if el.x) prevent errors if an element is missing from the DOM.
 */
function initEventListeners() {

    /* ── DRAG & DROP on the upload zone ─────────────────────────────── */
    if (el.dropZone) {

        /** dragover: prevent default browser file-open behaviour; scale zone */
        el.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.dropZone.style.transform   = 'scale(1.02)';
            el.dropZone.style.borderColor = 'var(--brand-primary)';
        });

        /** dragleave: reset drop zone visual state */
        el.dropZone.addEventListener('dragleave', () => {
            el.dropZone.style.transform   = 'scale(1)';
            el.dropZone.style.borderColor = '';
        });

        /**
         * drop: validate dropped file is an audio type before processing.
         * Non-audio drops show an error toast via the global system.
         */
        el.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            el.dropZone.style.transform   = 'scale(1)';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                handleFileUpload(file);
            } else {
                window.showToast('Invalid File. Please drop an Audio file.', true);
            }
        });
    }

    /* ── FILE INPUT: browse-button file selection ────────────────────── */
    if (el.fileInput) {
        el.fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleFileUpload(e.target.files[0]);
        });
    }

    /* ── PLAYBACK TRANSPORT CONTROLS ─────────────────────────────────── */
    if (el.playBtn) el.playBtn.addEventListener('click', togglePlay);
    if (el.stopBtn) el.stopBtn.addEventListener('click', stopPlayback);

    /* ── ZOOM SLIDER: directly drives WaveSurfer zoom level ─────────── */
    if (el.sliders.zoom) {
        el.sliders.zoom.addEventListener('input', (e) => {
            appState.wavesurfer?.zoom(Number(e.target.value));
        });
    }

    /* ── DSP SLIDERS: update live audio graph on every input tick ────── */
    // Iterate all sliders (excluding zoom which targets WaveSurfer directly)
    Object.values(el.sliders).forEach(slider => {
        if (slider && slider !== el.sliders.zoom) {
            slider.addEventListener('input', updateAudioGraph);
        }
    });
}

/* ============================================================================
   SECTION 6 — CORE FILE HANDLING & MEMORY MANAGEMENT
   Manages the full lifecycle of loading a new audio file:
   cleanup → decode → WaveSurfer init.
============================================================================ */

/**
 * cleanupAudio
 * Destroys the existing WaveSurfer instance, cancels the visualiser rAF loop,
 * nullifies all audio node references (enabling GC), and resets FX button states.
 * Must be called before any new file is loaded to prevent memory leaks.
 */
function cleanupAudio() {
    // Stop playback before destroying WaveSurfer
    if (appState.isPlaying) stopPlayback();

    if (appState.wavesurfer) {
        appState.wavesurfer.destroy();
        appState.wavesurfer = null;
    }

    // Cancel the canvas animation loop to stop orphaned rAF callbacks
    if (appState.animationFrame) cancelAnimationFrame(appState.animationFrame);

    // Null all node references so GC can reclaim Web Audio memory
    audioNodes.source   = null;
    audioNodes.analyser = null;
    appState.originalBuffer = null;
    appState.robotMode      = false;

    // Remove active highlight from all FX preset buttons
    Object.values(el.fxBtns).forEach(btn => btn.classList.remove('active'));
}

/**
 * handleFileUpload
 * Entry point for loading audio from either drag-and-drop, file input browse,
 * or microphone recording. Decodes the raw bytes via AudioContext.decodeAudioData,
 * then passes the Blob to initWaveSurfer for waveform rendering.
 * @param {File|Blob} file — Audio file to be decoded and loaded.
 */
async function handleFileUpload(file) {
    cleanupAudio();
    appState.currentFileBlob = file;

    showLoaderReal("READING AUDIO STREAM...", 10);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            updateLoaderReal("DECODING BITSTREAM...", 30);

            // Initialise or resume the AudioContext singleton
            // (AudioContext must be created / resumed after a user gesture)
            if (!appState.audioContext || appState.audioContext.state === 'closed') {
                appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } else if (appState.audioContext.state === 'suspended') {
                await appState.audioContext.resume();
            }

            const arrayBuffer = e.target.result;

            // Decode compressed audio (MP3/WAV/OGG/etc.) to raw PCM AudioBuffer
            try {
                appState.originalBuffer = await appState.audioContext.decodeAudioData(arrayBuffer);
            } catch (decodeErr) {
                throw new Error("Format not supported or file corrupted.");
            }

            updateLoaderReal("GENERATING WAVEFORM...", 70);
            initWaveSurfer(file);

        } catch (err) {
            console.error("[Ultra Studio] File decode error:", err);
            hideLoaderReal();
            // Show error via global toast system
            window.showToast(err.message || 'Error decoding audio.', true);
        }
    };

    // Read the file as an ArrayBuffer for AudioContext.decodeAudioData
    reader.readAsArrayBuffer(file);
}

/* ============================================================================
   SECTION 7 — WAVESURFER INITIALISATION
   Creates a new WaveSurfer instance, loads the audio Blob, and attaches
   event listeners for the 'ready', 'audioprocess', 'seek', and 'finish' events.
============================================================================ */

/**
 * initWaveSurfer
 * Constructs the WaveSurfer visualisation engine and attaches it to #waveform.
 * Shares the same AudioContext as the DSP graph for seamless filter chaining.
 * @param {File|Blob} file — The audio Blob to load into the waveform.
 */
function initWaveSurfer(file) {
    appState.wavesurfer = WaveSurfer.create({
        container       : '#waveform',
        waveColor       : 'rgba(128, 128, 128, 0.4)',   // Unplayed portion colour
        progressColor   : 'var(--brand-primary)',        // Played portion colour
        cursorColor     : '#ff0055',                     // Playhead cursor
        barWidth        : 2,
        barGap          : 3,
        height          : 120,
        responsive      : true,
        backend         : 'WebAudio',                    // Use Web Audio for DSP filter support
        audioContext    : appState.audioContext          // Shared context with DSP nodes
    });

    // Load the raw audio Blob (already decoded above — WaveSurfer re-renders SVG)
    appState.wavesurfer.loadBlob(file);

    /**
     * 'ready' event: fires when WaveSurfer has finished rendering the waveform.
     * Hides the loader, reveals the editor, builds the audio graph, and starts
     * the spectrum visualiser.
     */
    appState.wavesurfer.on('ready', () => {
        hideLoaderReal();
        el.editor.style.display   = 'block';    // Reveal the editor workspace
        el.dropZone.style.display = 'none';     // Hide the upload drop zone

        buildAudioGraph();  // Wire DSP nodes into WaveSurfer's backend
        drawVisualizer();   // Start the canvas spectrum animation loop
        updateTimer();      // Populate the 00:00 / 00:00 time display

        window.showToast('Audio Engine Ready');
    });

    /** 'audioprocess': fires on every playback tick — keeps time display current */
    appState.wavesurfer.on('audioprocess', updateTimer);

    /** 'seek': fires when user clicks/scrubs the waveform — updates time display */
    appState.wavesurfer.on('seek', updateTimer);

    /** 'finish': fires when audio reaches the end — reset play button state */
    appState.wavesurfer.on('finish', () => {
        appState.isPlaying = false;
        updatePlayBtn();
    });
}

/* ============================================================================
   SECTION 8 — REAL-TIME AUDIO GRAPH & DSP
   Constructs the live DSP filter chain inside WaveSurfer's WebAudio backend.
   All parameter changes are applied immediately during playback.
   Chain: WaveSurfer Source → eqLow → eqMid → eqHigh → panner → analyser → Destination
============================================================================ */

/**
 * buildAudioGraph
 * Creates all BiquadFilter, StereoPanner and AnalyserNode instances,
 * connects them in sequence using WaveSurfer's setFilters() API,
 * then calls updateAudioGraph() to seed initial slider values.
 */
function buildAudioGraph() {
    const backend = appState.wavesurfer.backend;
    const ctx     = appState.audioContext;

    // ── Low-Shelf EQ (320 Hz) ────────────────────────────────────────────
    audioNodes.eqLow = ctx.createBiquadFilter();
    audioNodes.eqLow.type             = 'lowshelf';
    audioNodes.eqLow.frequency.value  = 320;

    // ── Mid Peaking EQ (1 kHz) ───────────────────────────────────────────
    audioNodes.eqMid = ctx.createBiquadFilter();
    audioNodes.eqMid.type             = 'peaking';
    audioNodes.eqMid.frequency.value  = 1000;

    // ── High-Shelf EQ (3.2 kHz) ──────────────────────────────────────────
    audioNodes.eqHigh = ctx.createBiquadFilter();
    audioNodes.eqHigh.type            = 'highshelf';
    audioNodes.eqHigh.frequency.value = 3200;

    // ── Stereo Panner (8D effect) ─────────────────────────────────────────
    audioNodes.panner = ctx.createStereoPanner();

    // ── FFT Analyser (feeds the spectrum canvas visualiser) ───────────────
    audioNodes.analyser        = ctx.createAnalyser();
    audioNodes.analyser.fftSize = 256;   // 128 frequency bins for bar graph

    // Register the DSP chain with WaveSurfer's internal WebAudio backend
    // Flow: Source (WaveSurfer) → EQ Low → EQ Mid → EQ High → Panner → Analyser → Output
    backend.setFilters([
        audioNodes.eqLow,
        audioNodes.eqMid,
        audioNodes.eqHigh,
        audioNodes.panner,
        audioNodes.analyser
    ]);

    // Seed all node values from current slider positions
    updateAudioGraph();
}

/**
 * updateAudioGraph
 * Reads current slider values and applies them directly to the live audio
 * graph nodes. Called on every 'input' event from any DSP slider.
 * Also updates WaveSurfer playback rate for the speed slider.
 * Guard: returns early if the graph hasn't been built yet.
 */
function updateAudioGraph() {
    if (!audioNodes.eqLow) return;

    // ── EQ + Bass Boost ───────────────────────────────────────────────────
    // Bass Boost is additive on top of the low-shelf EQ gain
    const bassBoost = parseFloat(el.sliders.bass.value);
    audioNodes.eqLow.gain.value  = parseFloat(el.sliders.eqLow.value) + bassBoost;
    audioNodes.eqMid.gain.value  = parseFloat(el.sliders.eqMid.value);
    audioNodes.eqHigh.gain.value = parseFloat(el.sliders.eqHigh.value);

    // ── Stereo Panning (8D spatial effect) ───────────────────────────────
    audioNodes.panner.pan.value = parseFloat(el.sliders.pan.value);

    // ── Playback Speed via WaveSurfer setPlaybackRate ─────────────────────
    const speed = parseFloat(el.sliders.speed.value);
    appState.wavesurfer.setPlaybackRate(speed);
}

/* ============================================================================
   SECTION 9 — DSP FX PRESETS
   Three one-click presets that configure all sliders for a specific sound
   character: Robot (Ring Modulator), Chipmunk (High Pitch), Monster (Low Pitch).
   Exported as window.setPreset() for inline onclick handlers in the HTML.
============================================================================ */

/**
 * setPreset
 * Resets all DSP parameters to neutral, then applies a named preset.
 * Highlights the corresponding FX button and triggers a global toast.
 * @param {'robot'|'chipmunk'|'monster'} type — Preset identifier.
 *
 * Preset Specifications:
 *  robot    — Speed 0.90x, Low +5dB, High +5dB, Ring Mod enabled (render only)
 *  chipmunk — Speed 1.45x, Low −12dB, High +8dB (bright & fast)
 *  monster  — Speed 0.75x, Bass +12dB, High −8dB (dark & slow)
 */
window.setPreset = (type) => {

    // ── Step 1: Reset all controls to neutral defaults ────────────────────
    el.sliders.speed.value  = 1.0;
    el.sliders.eqLow.value  = 0;
    el.sliders.eqHigh.value = 0;
    el.sliders.bass.value   = 0;
    appState.robotMode      = false;

    // Remove active highlight from all FX preset buttons
    Object.values(el.fxBtns).forEach(btn => btn.classList.remove('active'));

    // ── Step 2: Apply the requested preset ───────────────────────────────
    if (type === 'robot') {
        el.sliders.speed.value  = 0.90;   // Slightly slower for robotic effect
        el.sliders.eqLow.value  = 5;
        el.sliders.eqHigh.value = 5;
        appState.robotMode      = true;   // Enables Ring Modulator during offline render
        el.fxBtns.robot.classList.add('active');
        window.showToast('Activated: MECHA-BOT Protocol (Render Only)');
    }
    else if (type === 'chipmunk') {
        el.sliders.speed.value  = 1.45;  // High pitch via speed-up
        el.sliders.eqLow.value  = -12;   // Cut bass for bright character
        el.sliders.eqHigh.value = 8;     // Boost highs for clarity
        el.fxBtns.high.classList.add('active');
        window.showToast('Activated: High Pitch Shift');
    }
    else if (type === 'monster') {
        el.sliders.speed.value  = 0.75;  // Slow down for deep voice
        el.sliders.eqHigh.value = -8;    // Cut highs for darker tone
        el.sliders.bass.value   = 12;    // Maximum bass boost
        el.fxBtns.low.classList.add('active');
        window.showToast('Activated: Deep Voice');
    }

    // Propagate all new slider values to the live audio graph
    updateAudioGraph();
};

/* ============================================================================
   SECTION 10 — PLAYBACK CONTROLS & UI STATE
   Transport controls: Play/Pause toggle, Stop/Reset, and play button label sync.
============================================================================ */

/**
 * togglePlay
 * Toggles WaveSurfer playback between playing and paused.
 * Updates appState.isPlaying and refreshes the button label.
 * Starts the visualiser canvas loop when playback begins.
 */
function togglePlay() {
    if (!appState.wavesurfer) return;
    appState.wavesurfer.playPause();
    appState.isPlaying = appState.wavesurfer.isPlaying();
    updatePlayBtn();
    if (appState.isPlaying) drawVisualizer();
}

/**
 * stopPlayback
 * Stops playback and resets WaveSurfer's position to the beginning.
 * Updates the play button to show PLAY state.
 */
function stopPlayback() {
    if (!appState.wavesurfer) return;
    appState.wavesurfer.stop();
    appState.isPlaying = false;
    updatePlayBtn();
}

/**
 * updatePlayBtn
 * Syncs the Play/Pause button label and active CSS class to the current
 * playback state (appState.isPlaying).
 */
function updatePlayBtn() {
    el.playBtn.innerHTML = appState.isPlaying
        ? '<i class="fas fa-pause"></i> PAUSE'
        : '<i class="fas fa-play"></i> PLAY';

    if (appState.isPlaying) {
        el.playBtn.classList.add('active');
    } else {
        el.playBtn.classList.remove('active');
    }
}

/* ============================================================================
   SECTION 11 — SPECTRUM VISUALISER (Canvas 2D API)
   An animated frequency bar graph drawn on <canvas id="visualizer">.
   Uses AnalyserNode.getByteFrequencyData() for real-time FFT data.
   Each bar receives a cyan-to-purple gradient for a premium studio aesthetic.
============================================================================ */

/**
 * drawVisualizer
 * Starts the requestAnimationFrame loop that reads FFT data from the
 * AnalyserNode and paints the spectrum bar graph onto the canvas.
 * The loop self-terminates when appState.isPlaying becomes false.
 */
function drawVisualizer() {
    if (!audioNodes.analyser) return;

    const ctx          = el.canvas.getContext('2d');
    const bufferLength = audioNodes.analyser.frequencyBinCount; // 128 bins (fftSize/2)
    const dataArray    = new Uint8Array(bufferLength);

    /**
     * render (inner loop function)
     * Called on every animation frame. Reads frequency data, clears canvas,
     * then draws one gradient bar per FFT bin.
     */
    const render = () => {
        // Stop the loop when playback is paused/stopped
        if (!appState.isPlaying) {
            cancelAnimationFrame(appState.animationFrame);
            return;
        }

        // Pull current frequency magnitude data (0–255 per bin)
        audioNodes.analyser.getByteFrequencyData(dataArray);

        // Clear previous frame
        ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);

        // Bar width calculated to fill the full canvas width across all bins
        const barWidth = (el.canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            // Scale bar height from raw 0–255 magnitude value
            const barHeight = dataArray[i] / 1.7;

            // Dynamic bottom-to-top gradient: cyan (base) → purple (peak)
            const gradient = ctx.createLinearGradient(0, el.canvas.height, 0, el.canvas.height - barHeight);
            gradient.addColorStop(0, '#00f3ff');  // Cyan at bar base
            gradient.addColorStop(1, '#bc13fe');  // Purple at bar peak

            ctx.fillStyle = gradient;
            ctx.beginPath();

            // Use roundRect for modern browsers; fall back to rect for older ones
            if (ctx.roundRect) {
                ctx.roundRect(x, el.canvas.height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
            } else {
                ctx.rect(x, el.canvas.height - barHeight, barWidth, barHeight);
            }
            ctx.fill();

            x += barWidth + 1; // Advance by bar width + 1px gap
        }

        // Schedule the next frame
        appState.animationFrame = requestAnimationFrame(render);
    };

    render();
}

/* ============================================================================
   SECTION 12 — TIMER / PLAYHEAD DISPLAY
   Keeps the "00:00 / 00:00" time display in the Transport module current.
============================================================================ */

/**
 * updateTimer
 * Reads current time and total duration from WaveSurfer and updates the
 * two time display <span> elements in the Transport module.
 * Called on 'audioprocess' (every frame) and 'seek' events.
 */
function updateTimer() {
    if (!appState.wavesurfer) return;
    const curr  = appState.wavesurfer.getCurrentTime();
    const total = appState.wavesurfer.getDuration();
    el.timeCurr.innerText = formatTime(curr);
    el.timeTotal.innerText = formatTime(total);
}

/**
 * formatTime
 * Converts a raw floating-point number of seconds into "MM:SS" string format.
 * Returns "00:00" for invalid or infinite values (guard for pre-ready state).
 * @param   {number} s — Time in seconds.
 * @returns {string}   Formatted time string "MM:SS".
 */
function formatTime(s) {
    if (isNaN(s) || !isFinite(s)) return "00:00";
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/* ============================================================================
   SECTION 13 — MICROPHONE RECORDING FEATURE
   Captures audio from the user's default microphone using the MediaRecorder API.
   On stop, assembles the recorded chunks into an audio Blob and feeds it back
   through the normal handleFileUpload() pipeline.
============================================================================ */

if (el.recBtn) {

    /**
     * Click handler for the REC / STOP recording button (#rec-trigger).
     * First click: requests microphone permission, starts recording, updates UI.
     * Second click: stops recording, assembles Blob, loads into editor.
     */
    el.recBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent click from bubbling to drop zone

        if (!appState.isRecording) {

            // ── START RECORDING ───────────────────────────────────────────
            try {
                // Request microphone access from the browser
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                appState.mediaRecorder = new MediaRecorder(stream);
                appState.audioChunks   = [];

                // Accumulate data chunks as they arrive
                appState.mediaRecorder.ondataavailable = event => {
                    appState.audioChunks.push(event.data);
                };

                /**
                 * onstop: fires when MediaRecorder is stopped.
                 * Assembles all chunks into a single MP3 Blob and loads it.
                 * Also stops all tracks on the microphone stream to release the device.
                 */
                appState.mediaRecorder.onstop = () => {
                    const blob = new Blob(appState.audioChunks, { type: 'audio/mp3' });
                    handleFileUpload(blob);
                    stream.getTracks().forEach(t => t.stop()); // Release microphone
                };

                appState.mediaRecorder.start();
                appState.isRecording = true;

                // Update button to show STOP state with pulsing icon
                el.recBtn.innerHTML = '<i class="fas fa-stop-circle fa-beat"></i> STOP';
                el.recBtn.classList.remove('danger');
                el.recBtn.classList.add('active');

                window.showToast('Recording Started');

            } catch (err) {
                // Permission denied or device not available
                window.showToast('Microphone Access Denied', true);
                console.error("[Ultra Studio] Microphone error:", err);
            }

        } else {

            // ── STOP RECORDING ────────────────────────────────────────────
            appState.mediaRecorder.stop();
            appState.isRecording = false;

            // Restore button to default REC appearance
            el.recBtn.innerHTML = '<i class="fas fa-microphone-lines"></i> REC';
            el.recBtn.classList.add('danger');
            el.recBtn.classList.remove('active');
        }
    });
}

/* ============================================================================
   SECTION 14 — OFFLINE RENDER ENGINE (PRO FEATURE)
   High-quality offline DSP rendering using OfflineAudioContext.
   Reconstructs the entire DSP chain (EQ, Panner, Reverse, Robot Ring Mod)
   at full quality, then encodes the rendered buffer to MP3 or WAV.

   Pipeline:
   1. Deep-copy original AudioBuffer (optionally reverse channels)
   2. Create OfflineAudioContext at correct output length
   3. Recreate full DSP chain in offline context
   4. Optionally apply Ring Modulator (Robot mode)
   5. Render via offlineCtx.startRendering()
   6. Encode result: WAV (PCM) or MP3 (via LameJS)
   7. Trigger browser download
============================================================================ */

document.getElementById('render-btn').addEventListener('click', async () => {

    // Guard: ensure audio is loaded before attempting render
    if (!appState.originalBuffer) {
        window.showToast('No audio loaded!', true);
        return;
    }

    // Read current export settings
    const format   = document.getElementById('format-select').value;
    const speed    = parseFloat(el.sliders.speed.value);
    const isReverse = el.reverseCheck.checked;

    // Pause playback if active — rendering and playback cannot run simultaneously
    if (appState.isPlaying) togglePlay();

    showLoaderReal("INITIALIZING RENDER ENGINE...", 0);
    await new Promise(r => setTimeout(r, 100)); // Allow UI to repaint before heavy computation

    try {
        updateLoaderReal("CALCULATING BUFFER...", 10);

        let renderBuffer = appState.originalBuffer;

        /* ── STEP 1: REVERSE MODE ──────────────────────────────────────── */
        if (isReverse) {
            updateLoaderReal("REVERSING POLARITY...", 15);

            // Create an offline context just to hold the reversed buffer data
            const revCtx = new OfflineAudioContext(
                renderBuffer.numberOfChannels,
                renderBuffer.length,
                renderBuffer.sampleRate
            );
            const revBuf = revCtx.createBuffer(
                renderBuffer.numberOfChannels,
                renderBuffer.length,
                renderBuffer.sampleRate
            );

            // Clone each channel's data and reverse it in-place
            // (clone to avoid mutating the original appState.originalBuffer)
            for (let c = 0; c < renderBuffer.numberOfChannels; c++) {
                const chanData = new Float32Array(renderBuffer.getChannelData(c));
                revBuf.getChannelData(c).set(chanData.reverse());
            }

            renderBuffer = revBuf;
        }

        /* ── STEP 2: OFFLINE CONTEXT SETUP ─────────────────────────────── */
        // Output length adjusted for playback speed (faster = shorter buffer)
        const newLength = Math.ceil(renderBuffer.length / speed);
        const offlineCtx = new OfflineAudioContext(
            renderBuffer.numberOfChannels,
            newLength,
            renderBuffer.sampleRate
        );

        // Create the source node from the (potentially reversed) buffer
        const source = offlineCtx.createBufferSource();
        source.buffer             = renderBuffer;
        source.playbackRate.value = speed;   // Apply speed change via playback rate

        /* ── STEP 3: RECREATE DSP CHAIN IN OFFLINE CONTEXT ─────────────── */
        // Each node mirrors the live graph with current slider values

        // Low-Shelf EQ: base shelf + bass boost additive
        const eqL = offlineCtx.createBiquadFilter();
        eqL.type            = 'lowshelf';
        eqL.frequency.value = 320;
        eqL.gain.value      = parseFloat(el.sliders.eqLow.value) + parseFloat(el.sliders.bass.value);

        // Mid Peaking EQ
        const eqM = offlineCtx.createBiquadFilter();
        eqM.type            = 'peaking';
        eqM.frequency.value = 1000;
        eqM.gain.value      = parseFloat(el.sliders.eqMid.value);

        // High-Shelf EQ
        const eqH = offlineCtx.createBiquadFilter();
        eqH.type            = 'highshelf';
        eqH.frequency.value = 3200;
        eqH.gain.value      = parseFloat(el.sliders.eqHigh.value);

        // Stereo Panner
        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = parseFloat(el.sliders.pan.value);

        // Chain: Source → eqL → eqM → eqH
        let lastNode = source;
        lastNode.connect(eqL); lastNode = eqL;
        lastNode.connect(eqM); lastNode = eqM;
        lastNode.connect(eqH); lastNode = eqH;

        /* ── STEP 4: ROBOT / RING MODULATOR (Optional) ──────────────────── */
        /**
         * Ring Modulation produces a metallic / robotic timbre.
         * Topology: Audio Signal × Carrier Oscillator
         * Web Audio approach:
         *   - A carrier Oscillator drives the .gain parameter of a GainNode.
         *   - The audio signal flows through that GainNode.
         *   - Result: amplitude of audio is modulated at carrier frequency
         *     (classic Dalek / vocoder effect).
         */
        if (appState.robotMode) {
            const carrier = offlineCtx.createOscillator();
            carrier.type             = 'sine';
            carrier.frequency.value  = 50;   // 50 Hz carrier — classic Dalek ring mod

            // modGain: the signal passes through here; carrier modulates its gain
            const modGain = offlineCtx.createGain();
            modGain.gain.value = 0; // Initial gain 0; carrier oscillates it ±1

            // Carrier oscillator → modGain.gain (amplitude modulation)
            carrier.connect(modGain.gain);
            // Audio signal → modGain (the signal being modulated)
            lastNode.connect(modGain);

            carrier.start(0);
            lastNode = modGain;
        }

        // Connect remaining chain to destination
        lastNode.connect(panner);
        panner.connect(offlineCtx.destination);
        source.start(0);

        /* ── STEP 5: RENDER ─────────────────────────────────────────────── */
        updateLoaderReal("PROCESSING DSP CHAIN...", 35);
        const renderedBuffer = await offlineCtx.startRendering();

        /* ── STEP 6: ENCODE & DOWNLOAD ──────────────────────────────────── */
        updateLoaderReal("ENCODING STREAM...", 55);

        if (format === 'wav') {
            // Lossless PCM WAV encoding
            const wavBlob = await encodeWAV(renderedBuffer, (p) => {
                updateLoaderReal(`PACKING WAV: ${Math.floor(p)}%`, 55 + (p * 0.45));
            });
            downloadFile(wavBlob, 'wav');

        } else {
            // Lossy MP3 encoding via LameJS
            const bitrate = parseInt(format);   // 320 or 192
            const mp3Blob = await encodeMP3(renderedBuffer, bitrate, (p) => {
                updateLoaderReal(`COMPRESSING MP3: ${Math.floor(p)}%`, 55 + (p * 0.45));
            });
            downloadFile(mp3Blob, 'mp3');
        }

        hideLoaderReal();
        window.showToast('Render Complete!');

    } catch (e) {
        console.error("[Ultra Studio] Render error:", e);
        hideLoaderReal();
        window.showToast('Render Error: ' + e.message, true);
    }
});

/* ============================================================================
   SECTION 15 — AUDIO ENCODERS
   High-performance, non-blocking encoders for MP3 and WAV formats.
   Both use a time-sliced loop (max 15ms per frame) to keep the UI responsive
   during encoding, yielding to the main thread via setTimeout(fn, 0).
============================================================================ */

/**
 * encodeMP3
 * Encodes a decoded AudioBuffer to MP3 using the LameJS library.
 * Processes audio in 1152×4 sample blocks, yielding to the main thread between
 * blocks to prevent the page from freezing on long files.
 *
 * @param   {AudioBuffer}   buffer      — The rendered PCM AudioBuffer to encode.
 * @param   {number}        kbps        — Target bitrate (192 or 320).
 * @param   {Function}      onProgress  — Callback receiving progress percentage (0–100).
 * @returns {Promise<Blob>}             — Resolves with the final MP3 Blob.
 */
function encodeMP3(buffer, kbps, onProgress) {
    return new Promise((resolve, reject) => {

        // Guard: LameJS must be available (loaded via the local CDN asset)
        if (!window.lamejs) {
            reject(new Error("LameJS library not found. Check internet connection."));
            return;
        }

        const channels   = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const mp3enc     = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
        let   mp3Data    = [];

        // Convert float32 channel data to Int16 (required by LameJS)
        const left  = convertFloatToInt16(buffer.getChannelData(0));
        const right = channels > 1 ? convertFloatToInt16(buffer.getChannelData(1)) : null;

        // Block size: 1152 samples × 4 = 4608 samples per chunk
        // (1152 is the standard MP3 frame size; ×4 for throughput)
        const blockSize = 1152 * 4;
        const total     = left.length;
        let   i         = 0;

        /**
         * process (inner loop)
         * Processes audio chunks for up to 15ms per invocation, then yields.
         * This prevents the browser UI from becoming unresponsive on large files.
         */
        function process() {
            const start = Date.now();

            // Encode as many blocks as possible within the 15ms window
            while (i < total && (Date.now() - start < 15)) {
                const chunkLen = Math.min(blockSize, total - i);
                const lChunk   = left.subarray(i, i + chunkLen);
                let   mp3buf;

                if (channels === 2 && right) {
                    // Stereo encoding: provide both L and R channel chunks
                    const rChunk = right.subarray(i, i + chunkLen);
                    mp3buf = mp3enc.encodeBuffer(lChunk, rChunk);
                } else {
                    // Mono encoding
                    mp3buf = mp3enc.encodeBuffer(lChunk);
                }

                if (mp3buf.length > 0) mp3Data.push(mp3buf);
                i += chunkLen;
            }

            // Report progress (0–100) to the loader overlay
            onProgress((i / total) * 100);

            if (i < total) {
                // Yield to the main thread, then continue
                setTimeout(process, 0);
            } else {
                // Flush the final MP3 frame and assemble the Blob
                const endBuf = mp3enc.flush();
                if (endBuf.length > 0) mp3Data.push(endBuf);
                resolve(new Blob(mp3Data, { type: 'audio/mp3' }));
            }
        }

        process();
    });
}

/**
 * encodeWAV
 * Encodes a decoded AudioBuffer to a standard PCM WAV file (16-bit, any sample rate).
 * Writes the canonical RIFF/WAVE header, then interleaves all channel data.
 * Uses the same 15ms-yield approach as encodeMP3 for UI responsiveness.
 *
 * @param   {AudioBuffer}   buffer      — The rendered PCM AudioBuffer to encode.
 * @param   {Function}      onProgress  — Callback receiving progress percentage (0–100).
 * @returns {Promise<Blob>}             — Resolves with the final WAV Blob.
 */
function encodeWAV(buffer, onProgress) {
    return new Promise(resolve => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate  = buffer.sampleRate;
        const format      = 1;    // PCM format code
        const bitDepth    = 16;   // 16-bit depth

        // Allocate full WAV binary buffer (44-byte header + PCM data)
        const length      = buffer.length * numChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view        = new DataView(arrayBuffer);

        /* ── WAV HEADER (Little Endian) ────────────────────────────────── */
        writeString(view, 0,  'RIFF');                                                // Chunk ID
        view.setUint32(4,  36 + buffer.length * numChannels * 2, true);              // Chunk size
        writeString(view, 8,  'WAVE');                                               // Format
        writeString(view, 12, 'fmt ');                                               // Sub-chunk 1 ID
        view.setUint32(16,  16,          true);                                      // Sub-chunk 1 size (PCM = 16)
        view.setUint16(20,  format,      true);                                      // Audio format (PCM = 1)
        view.setUint16(22,  numChannels, true);                                      // Number of channels
        view.setUint32(24,  sampleRate,  true);                                      // Sample rate
        view.setUint32(28,  sampleRate * numChannels * 2, true);                     // Byte rate
        view.setUint16(32,  numChannels * 2, true);                                  // Block align
        view.setUint16(34,  bitDepth,    true);                                      // Bits per sample
        writeString(view, 36, 'data');                                               // Sub-chunk 2 ID
        view.setUint32(40, buffer.length * numChannels * 2, true);                   // Sub-chunk 2 size

        /* ── PCM DATA: Interleave channels & convert float32 → int16 ───── */
        let offset  = 44;      // Start writing sample data after the 44-byte header
        let i       = 0;
        const totalLen = buffer.length;

        /**
         * processWav (inner loop)
         * Converts float32 samples (-1.0 to +1.0) to signed int16 (−32768 to +32767).
         * Applies hard clipping to prevent wrap-around distortion on near-clipped signals.
         * Yields after 15ms to maintain UI responsiveness.
         */
        function processWav() {
            const start = Date.now();

            while (i < totalLen && (Date.now() - start < 15)) {
                for (let channel = 0; channel < numChannels; channel++) {
                    let sample = buffer.getChannelData(channel)[i];

                    // Hard clip: clamp to [-1, 1] to prevent integer overflow
                    sample = Math.max(-1, Math.min(1, sample));

                    // Convert float → 16-bit signed integer
                    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;

                    view.setInt16(offset, sample, true);  // Write little-endian int16
                    offset += 2;
                }
                i++;
            }

            onProgress((i / totalLen) * 100);

            if (i < totalLen) {
                setTimeout(processWav, 0);   // Yield to main thread
            } else {
                resolve(new Blob([view], { type: 'audio/wav' }));
            }
        }

        processWav();
    });
}

/* ============================================================================
   SECTION 16 — UTILITY FUNCTIONS
   Helpers used across the encoder and download pipeline.
============================================================================ */

/**
 * convertFloatToInt16
 * Converts a Float32Array of audio samples (range −1.0 to +1.0) to an
 * Int16Array suitable for LameJS or WAV output (range −32768 to +32767).
 * Applies hard clipping to prevent overflow on loud/saturated signals.
 * @param   {Float32Array} float32 — Input channel data.
 * @returns {Int16Array}           — Output Int16 audio data.
 */
function convertFloatToInt16(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s   = Math.max(-1, Math.min(1, float32[i]));
        int16[i]  = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
}

/**
 * writeString
 * Writes an ASCII string into a DataView at a specified byte offset.
 * Used exclusively for writing WAV header four-character codes
 * ('RIFF', 'WAVE', 'fmt ', 'data').
 * @param {DataView} view   — Target DataView (the WAV ArrayBuffer).
 * @param {number}   offset — Byte offset at which to begin writing.
 * @param {string}   string — ASCII string to write (typically 4 chars).
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * downloadFile
 * Creates a temporary anchor element, sets it to an object URL for the
 * given Blob, and programmatically clicks it to trigger the browser's
 * native "Save As" download dialog. Cleans up the object URL after 1s
 * to avoid memory leaks.
 * @param {Blob}   blob — The encoded audio Blob (MP3 or WAV).
 * @param {string} ext  — File extension string ('mp3' or 'wav').
 */
function downloadFile(blob, ext) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `ULTRA_STUDIO_EXPORT_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();

    // Defer cleanup to allow download dialog to open before revoking the URL
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);
}

/* ============================================================================
   SECTION 17 — LOADER OVERLAY UI HELPERS
   Thin wrappers around the DOM manipulation for the full-screen loader overlay.
   Called throughout the render pipeline to display stage-specific progress.
============================================================================ */

/**
 * showLoaderReal
 * Makes the overlay loader visible and sets initial text + percentage.
 * Adds the .active class to trigger the CSS opacity transition.
 * @param {string} text    — Stage label to display (e.g. "READING AUDIO STREAM...").
 * @param {number} percent — Initial progress percentage (0–100).
 */
function showLoaderReal(text, percent) {
    const loader = document.getElementById('overlay-loader');
    loader.classList.add('active');
    updateLoaderReal(text, percent);
}

/**
 * updateLoaderReal
 * Updates the loader's status text, progress bar width, and percentage counter.
 * @param {string} text    — New stage label.
 * @param {number} percent — New progress value (0–100).
 */
function updateLoaderReal(text, percent) {
    document.querySelector('.aus-loader-text').innerText = text;
    document.getElementById('progress-fill').style.width  = percent + '%';
    document.getElementById('progress-percent').innerText = Math.floor(percent) + '%';
}

/**
 * hideLoaderReal
 * Removes the .active class to hide the overlay loader via CSS transition.
 * After a short delay, resets the progress bar and label back to defaults
 * so it is ready for the next operation.
 */
function hideLoaderReal() {
    document.getElementById('overlay-loader').classList.remove('active');
    setTimeout(() => updateLoaderReal('Ready', 0), 400);
}
