/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SCREEN RECORDER ULTRA PRO — Core WebRTC Recording Engine
 *  File    : script.js
 *  Author  : MD KAWSAR
 *  Version : 3.1.0 (CodeCanyon Refactor — Global Toast Integration)
 *
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  A single ES5-compatible class (ScreenRecorderPro) encapsulates all state
 *  and behaviour. An instance is exposed globally as window.ScreenRecorderApp
 *  so that HTML onclick handlers can reach it.
 *
 *  Key APIs used:
 *    • MediaDevices.getDisplayMedia()  — screen/window/tab capture
 *    • MediaDevices.getUserMedia()     — microphone & webcam access
 *    • Web Audio API                   — real-time mic + system audio mixing
 *    • MediaRecorder API               — VP9/WebM encoding & chunk collection
 *    • Canvas 2D API                   — on-screen annotation drawing
 *    • URL.createObjectURL()           — client-side Blob → downloadable URL
 *
 *  TOAST NOTIFICATION SYSTEM
 *  ─────────────────────────────────────────────────────────────────────────
 *  All user feedback is routed through the GLOBAL toast system injected by
 *  global.js (window.showToast). The old local _showToast() has been removed.
 *
 *    window.showToast("Message text")        — standard (info/success) toast
 *    window.showToast("Error message", true) — error toast (second arg = true)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
"use strict";

class ScreenRecorderPro {

    /**
     * constructor()
     * ─────────────────────────────────────────────────────────────────────
     * Builds the internal UI reference map (this.ui) and initialises the
     * application state object (this.state). Called once on page load.
     */
    constructor() {

        /* ── DOM Element Cache ──────────────────────────────────────────────
           All getElementById calls are made once here and stored in this.ui
           to avoid repeated DOM lookups during animation frames and events. */
        this.ui = {
            startBtn          : document.getElementById('startBtn'),
            stopBtn           : document.getElementById('stopBtn'),
            pauseBtn          : document.getElementById('pauseBtn'),
            snapBtn           : document.getElementById('snapBtn'),
            dlBtn             : document.getElementById('downloadBtn'),
            preview           : document.getElementById('preview'),
            timer             : document.getElementById('timerDisplay'),
            recDot            : document.getElementById('recDot'),
            visContainer      : document.getElementById('visContainer'),
            canvas            : document.getElementById('audioVis'),
            videoWrapper      : document.getElementById('videoWrapper'),
            micToggle         : document.getElementById('micToggle'),
            camToggle         : document.getElementById('camToggle'),
            drawToggle        : document.getElementById('drawToggle'),
            facecamBox        : document.getElementById('facecamBox'),
            facecamVideo      : document.getElementById('facecamVideo'),
            drawToolbar       : document.getElementById('drawToolbar'),
            drawCanvas        : document.getElementById('drawingCanvas'),
            teleprompterBox   : document.getElementById('teleprompterBox'),
            countdownOverlay  : document.getElementById('countdownOverlay'),
            qualitySelect     : document.getElementById('qualitySelect'),
            micGain           : document.getElementById('micGain'),
            colorPicker       : document.getElementById('colorPicker')
        };

        /* ── Application State ──────────────────────────────────────────────
           Single source of truth for all runtime values. Centralising state
           here prevents hidden globals and makes debugging straightforward. */
        this.state = {

            /* Recording lifecycle flags */
            isRecording       : false,
            isPaused          : false,
            isMicOn           : false,
            isCamOn           : false,
            isDrawingOn       : false,

            /* MediaRecorder instance and accumulated video chunk array */
            mediaRecorder     : null,
            recordedChunks    : [],

            /* Active media streams keyed by source type */
            streams: {
                display       : null,   // Screen / window / tab capture stream
                mic           : null,   // Microphone audio stream
                cam           : null,   // Webcam video stream
                mixed         : null    // Combined stream fed into MediaRecorder
            },

            /* Web Audio API context — created lazily on first recording */
            audioCtx          : null,

            /* Gain nodes allow real-time volume control per audio source */
            gainNodes: {
                mic           : null,   // Controls microphone amplification
                sys           : null    // Controls system/desktop audio level
            },

            /* Elapsed-time counter for the HH:MM:SS status display */
            timer: {
                ref           : null,   // setInterval handle
                totalSeconds  : 0
            },

            /* Audio visualiser state (frequency analyser + animation frame) */
            visualizer: {
                ref           : null,   // requestAnimationFrame handle
                dataArray     : null,
                analyser      : null
            },

            /* Drawing canvas context + stroke tracking */
            drawing: {
                ctx           : this.ui.drawCanvas.getContext('2d'),
                isDrawing     : false,
                lastX         : 0,
                lastY         : 0,
                tool          : 'pen'   // 'pen' | 'eraser'
            },

            /* Interval that monitors whether the display stream is still active */
            streamMonitorInterval : null
        };

        /* Bootstrap the application */
        this.init();
    }


    /* ═══════════════════════════════════════════════════════════════════════
       SECTION 1 : INITIALISATION
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * init()
     * ─────────────────────────────────────────────────────────────────────
     * Wires up all persistent event listeners and runs startup checks.
     *
     * Responsibilities:
     *   1. Attach drag listeners to the facecam and teleprompter boxes.
     *   2. Attach mouse/touch drawing events to the annotation canvas.
     *   3. Watch window resize to keep the annotation canvas correctly sized.
     *   4. Sync the mic gain slider to the Web Audio gain node in real time.
     *   5. Detect mobile browsers and warn the user (screen sharing is
     *      restricted on iOS/Android at the OS level).
     *   6. Register Alt+R / Alt+S / Alt+P keyboard shortcuts for power users.
     *   7. Verify that the MediaDevices API is available in this browser.
     */
    init() {

        /* 1. Make facecam box and teleprompter panel draggable */
        this._setupDraggable(this.ui.facecamBox);
        this._setupDraggable(this.ui.teleprompterBox, document.getElementById('teleDrag'));

        /* 2. Drawing canvas — pointer-event listeners */
        this.ui.drawCanvas.addEventListener('mousedown',  this._onDrawStart.bind(this));
        this.ui.drawCanvas.addEventListener('mousemove',  this._onDrawMove.bind(this));
        this.ui.drawCanvas.addEventListener('mouseup',    this._onDrawEnd.bind(this));
        this.ui.drawCanvas.addEventListener('mouseout',   this._onDrawEnd.bind(this));

        /* 3. Keep annotation canvas dimensions in sync with the viewport */
        window.addEventListener('resize', this._resizeCanvas.bind(this));

        /* 4. Live mic gain — update the Web Audio gain node immediately on
              slider input so the presenter can adjust volume mid-recording */
        this.ui.micGain.addEventListener('input', (e) => {
            if (this.state.gainNodes.mic) {
                this.state.gainNodes.mic.gain.value = parseFloat(e.target.value);
            }
        });

        /* 5. Mobile browser detection
              Screen capture via getDisplayMedia() is blocked by iOS and
              Android at the OS level. Warn the user and disable Start. */
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            window.showToast('Screen recording is not supported on mobile browsers. Please use a desktop.', true);
            this.ui.startBtn.disabled = true;
            this.ui.startBtn.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i> PC Only';
        }

        /* 6. Keyboard shortcuts (Alt+R / Alt+S / Alt+P) */
        document.addEventListener('keydown', (e) => {
            if (e.altKey) {
                switch (e.code) {
                    case 'KeyR': e.preventDefault(); this.initiateRecording(); break;
                    case 'KeyS': e.preventDefault(); this.stopRecording();     break;
                    case 'KeyP': e.preventDefault(); this.togglePause();       break;
                }
            }
        });

        /* 7. Browser API compatibility check
              If MediaDevices or getDisplayMedia is missing (old browser),
              disable the Start button and inform the user. */
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            window.showToast('Your browser does not support screen recording. Please use Chrome, Firefox, or Edge.', true);
            this.ui.startBtn.disabled = true;
        }
    }


    /* ═══════════════════════════════════════════════════════════════════════
       SECTION 2 : AUDIO ENGINE
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * _initAudioEngine()  [async]
     * ─────────────────────────────────────────────────────────────────────
     * Creates (or resumes) a single Web Audio AudioContext that persists for
     * the entire session. A persistent context avoids the "pop" artefact
     * caused by creating / destroying contexts between recordings.
     *
     * @returns {AudioContext|null} The ready AudioContext, or null on failure.
     */
    async _initAudioEngine() {
        try {
            if (!this.state.audioCtx || this.state.audioCtx.state === 'closed') {
                /* Use the prefixed constructor on older Safari / WebKit */
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.state.audioCtx = new AudioContext();
            }

            /* Browsers auto-suspend the AudioContext until a user gesture.
               Resume it here since we are inside a click handler chain. */
            if (this.state.audioCtx.state === 'suspended') {
                await this.state.audioCtx.resume();
            }

            return this.state.audioCtx;

        } catch (e) {
            console.error("Audio Engine Initialisation Failed:", e);
            return null;
        }
    }


    /* ═══════════════════════════════════════════════════════════════════════
       SECTION 3 : FEATURE TOGGLES
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * toggleMic()
     * ─────────────────────────────────────────────────────────────────────
     * Flips the microphone-enabled flag and updates the toggle-button UI.
     *
     * If a recording is already in progress, instead of re-initialising the
     * MediaRecorder (which is not possible mid-stream), we soft-mute the
     * existing gain node by setting its value to 0, which is lossless and
     * imperceptibly instant.
     */
    toggleMic() {
        /* Flip the boolean state */
        this.state.isMicOn = !this.state.isMicOn;

        /* Reflect active state on the toggle button */
        this.ui.micToggle.classList.toggle('active', this.state.isMicOn);

        /* Swap the toggle icon class (off → on / on → off) */
        const micIcon = this.ui.micToggle.querySelector('i.fa-toggle-off, i.fa-toggle-on');
        if (micIcon) {
            micIcon.className = this.state.isMicOn ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off';
        }

        /* Inform the user via the global toast system */
        window.showToast(this.state.isMicOn ? 'Microphone enabled.' : 'Microphone disabled.');

        /* Live soft-mute / unmute during an active recording */
        if (this.state.isRecording && this.state.gainNodes.mic) {
            this.state.gainNodes.mic.gain.value = this.state.isMicOn
                ? parseFloat(this.ui.micGain.value)
                : 0;
        }
    }

    /**
     * toggleCam()  [async]
     * ─────────────────────────────────────────────────────────────────────
     * Requests webcam access via getUserMedia() when turning the camera on,
     * or stops all tracks and hides the facecam overlay when turning it off.
     *
     * @throws Will toast an error if camera permission is denied.
     */
    async toggleCam() {
        if (!this.state.isCamOn) {
            try {
                /* Request camera with HD constraints (1280×720, front-facing) */
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width       : { ideal: 1280 },
                        height      : { ideal: 720  },
                        facingMode  : "user"
                    }
                });

                /* Pipe the stream into the facecam <video> element */
                this.state.streams.cam = stream;
                this.ui.facecamVideo.srcObject = stream;
                this.ui.facecamBox.style.display = 'block';
                this.state.isCamOn = true;

                /* Update toggle button visual state */
                this.ui.camToggle.classList.add('active');
                const camIconOn = this.ui.camToggle.querySelector('i.fa-toggle-off');
                if (camIconOn) camIconOn.className = 'fa-solid fa-toggle-on';

            } catch (err) {
                console.error("Camera Access Error:", err);
                window.showToast('Camera permission denied or device not found.', true);
            }

        } else {
            /* Stop all camera tracks to release the hardware LED indicator */
            if (this.state.streams.cam) {
                this.state.streams.cam.getTracks().forEach(track => track.stop());
            }
            this.ui.facecamBox.style.display = 'none';
            this.state.isCamOn = false;
            this.ui.camToggle.classList.remove('active');
            const camIconOff = this.ui.camToggle.querySelector('i.fa-toggle-on');
            if (camIconOff) camIconOff.className = 'fa-solid fa-toggle-off';
        }
    }

    /**
     * toggleDrawing(enable)
     * ─────────────────────────────────────────────────────────────────────
     * Shows or hides the floating drawing toolbar and the transparent
     * annotation canvas overlay.
     *
     * When activating, _resizeCanvas() is called to ensure the canvas DPI
     * matches the current viewport dimensions before any strokes are drawn.
     *
     * @param {boolean|*} enable  Pass true to show, false to hide.
     *                            Any non-boolean value toggles the current state.
     */
    toggleDrawing(enable) {
        /* Resolve boolean intent — explicit boolean overrides toggle */
        this.state.isDrawingOn = (typeof enable === 'boolean')
            ? enable
            : !this.state.isDrawingOn;

        /* Sync toggle button active state */
        this.ui.drawToggle.classList.toggle('active', this.state.isDrawingOn);

        /* Show/hide the draw toolbar */
        this.ui.drawToolbar.style.display = this.state.isDrawingOn ? 'flex' : 'none';

        /* Show/hide the transparent canvas overlay */
        this.ui.drawCanvas.style.display       = this.state.isDrawingOn ? 'block' : 'none';
        this.ui.drawCanvas.style.pointerEvents = this.state.isDrawingOn ? 'all'   : 'none';

        /* Resize the canvas to the current viewport on activation */
        if (this.state.isDrawingOn) {
            this._resizeCanvas();
        }
    }

    /**
     * toggleTeleprompter()
     * ─────────────────────────────────────────────────────────────────────
     * Shows or hides the draggable teleprompter / script-reader panel.
     * Reads the current display value and simply toggles between block/none.
     */
    toggleTeleprompter() {
        const el = this.ui.teleprompterBox;
        el.style.display = (el.style.display === 'none' || !el.style.display)
            ? 'block'
            : 'none';
    }

    /**
     * toggleCamShape()
     * ─────────────────────────────────────────────────────────────────────
     * Alternates the facecam overlay between a circle (1:1 aspect ratio)
     * and a rounded rectangle (16:9-ish). Uses direct style manipulation
     * because the shape transition is a purely cosmetic runtime change.
     */
    toggleCamShape() {
        const box = this.ui.facecamBox;
        /* Read the computed (not just inline) border-radius so the CSS default
           of 50% is correctly detected on the first toggle. */
        const computed = window.getComputedStyle(box).borderRadius;
        if (computed === '50%' || box.style.borderRadius === '50%') {
            /* Switch to rounded rectangle */
            box.style.borderRadius = '15px';
            box.style.aspectRatio  = 'auto';
            box.style.height       = '135px';
        } else {
            /* Switch back to circle */
            box.style.borderRadius = '50%';
            box.style.aspectRatio  = '1 / 1';
            box.style.height       = box.offsetWidth + 'px';
        }
    }

    /**
     * toggleCamFilter()
     * ─────────────────────────────────────────────────────────────────────
     * Cycles the facecam <video> element through a predefined list of CSS
     * filter effects (none → grayscale → sepia → contrast → hue-rotate →
     * none…). Pure aesthetic — does not affect the recorded stream.
     */
    toggleCamFilter() {
        const filters = [
            'none',
            'grayscale(100%)',
            'sepia(80%)',
            'contrast(150%)',
            'hue-rotate(90deg)'
        ];
        const current = this.ui.facecamVideo.style.filter || 'none';
        const next    = filters[(filters.indexOf(current) + 1) % filters.length];
        this.ui.facecamVideo.style.filter = next;
    }


    /* ═══════════════════════════════════════════════════════════════════════
       SECTION 4 : DRAWING LOGIC
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * setDrawMode(tool, btn)
     * ─────────────────────────────────────────────────────────────────────
     * Sets the active drawing tool ('pen' or 'eraser') and visually
     * highlights the selected toolbar button.
     *
     * @param {string}      tool  'pen' or 'eraser'
     * @param {HTMLElement} btn   The toolbar button element that was clicked.
     */
    setDrawMode(tool, btn) {
        this.state.drawing.tool = tool;

        /* Remove active highlight from all draw buttons */
        document.querySelectorAll('.scr-draw-btn').forEach(b => b.classList.remove('active'));

        /* Highlight only the clicked button */
        if (btn) btn.classList.add('active');
    }

    /**
     * clearCanvas()
     * ─────────────────────────────────────────────────────────────────────
     * Clears all drawn annotations from the overlay canvas.
     * Uses the canvas dimensions (which match the viewport) to wipe cleanly.
     */
    clearCanvas() {
        const { width, height } = this.ui.drawCanvas;
        this.state.drawing.ctx.clearRect(0, 0, width, height);
    }

    /**
     * _resizeCanvas()
     * ─────────────────────────────────────────────────────────────────────
     * Recalculates the annotation canvas dimensions to match the current
     * viewport, accounting for the device pixel ratio (DPR) to produce
     * crisp lines on Retina / HiDPI displays.
     *
     * Only performs the resize when dimensions have actually changed to
     * prevent unnecessary canvas clears (which would erase in-progress work).
     */
    _resizeCanvas() {
        const dpr  = window.devicePixelRatio || 1;
        const rect = document.body.getBoundingClientRect();

        /* Guard: skip if nothing has changed */
        if (
            this.ui.drawCanvas.width  !== rect.width  * dpr ||
            this.ui.drawCanvas.height !== rect.height * dpr
        ) {
            /* Set the backing store at device resolution */
            this.ui.drawCanvas.width  = rect.width  * dpr;
            this.ui.drawCanvas.height = rect.height * dpr;

            /* Scale the context so coordinate space stays in CSS pixels */
            const ctx = this.state.drawing.ctx;
            ctx.scale(dpr, dpr);

            /* Keep the element CSS size equal to the viewport */
            this.ui.drawCanvas.style.width  = `${rect.width}px`;
            this.ui.drawCanvas.style.height = `${rect.height}px`;
        }
    }

    /**
     * _onDrawStart(e)
     * ─────────────────────────────────────────────────────────────────────
     * Begins a new stroke when the pointer is pressed down on the canvas.
     *
     * @param {MouseEvent} e
     */
    _onDrawStart(e) {
        this.state.drawing.isDrawing = true;
        [this.state.drawing.lastX, this.state.drawing.lastY] = [e.clientX, e.clientY];
    }

    /**
     * _onDrawMove(e)
     * ─────────────────────────────────────────────────────────────────────
     * Draws a line from the previous cursor position to the current one.
     * Pen mode uses the selected colour; eraser uses destination-out to
     * punch transparent holes in the annotation layer (non-destructive to
     * underlying content — only the canvas pixels are affected).
     *
     * @param {MouseEvent} e
     */
    _onDrawMove(e) {
        if (!this.state.drawing.isDrawing) return;

        const ctx = this.state.drawing.ctx;

        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';

        if (this.state.drawing.tool === 'eraser') {
            /* destination-out removes existing canvas pixels */
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 30;
        } else {
            /* source-over draws on top of existing pixels */
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = this.ui.colorPicker.value;
            ctx.lineWidth   = 4;
        }

        ctx.beginPath();
        ctx.moveTo(this.state.drawing.lastX, this.state.drawing.lastY);
        ctx.lineTo(e.clientX, e.clientY);
        ctx.stroke();

        /* Update last position for next frame */
        [this.state.drawing.lastX, this.state.drawing.lastY] = [e.clientX, e.clientY];
    }

    /**
     * _onDrawEnd()
     * ─────────────────────────────────────────────────────────────────────
     * Ends the current stroke when the pointer is released or leaves the
     * canvas boundary.
     */
    _onDrawEnd() {
        this.state.drawing.isDrawing = false;
    }


    /* ═══════════════════════════════════════════════════════════════════════
       SECTION 5 : RECORDING ORCHESTRATION
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * initiateRecording()
     * ─────────────────────────────────────────────────────────────────────
     * Entry point called by the "Start Recording" button.
     * Guards against double-starts and delegates to startCapture().
     */
    initiateRecording() {
        if (this.state.isRecording) return;
        this.startCapture();
    }

    /**
     * startCapture()  [async]
     * ─────────────────────────────────────────────────────────────────────
     * Orchestrates the entire capture pipeline in the correct order:
     *
     *   Step 1 — Initialise the Web Audio context.
     *   Step 2 — Call getDisplayMedia() to prompt the user for screen access.
     *   Step 3 — Mix system audio from the display stream into the destination.
     *   Step 4 — If mic is enabled, get getUserMedia() and mix mic audio in.
     *   Step 5 — Combine video + mixed audio into a single MediaStream.
     *   Step 6 — Show the countdown overlay (3 → 2 → 1) before recording.
     *   Step 7 — Hand off to _startActualRecording() after countdown.
     *
     * Error handling: NotAllowedError (user cancelled) shows an info toast;
     * all other errors show an error toast.
     */
    async startCapture() {
        try {

            /* Step 1: Initialise / resume the Web Audio context */
            const ctx = await this._initAudioEngine();

            /* Guard: if AudioContext failed to initialise, abort gracefully */
            if (!ctx) {
                window.showToast('Audio engine could not start. Please check browser permissions.', true);
                return;
            }

            const dest = ctx.createMediaStreamDestination();

            /* Step 2: Prompt the user to choose screen / window / tab.
               frameRate ideal=60 requests smooth 60 fps capture.
               systemAudio:"include" is a Chrome hint to share desktop audio. */
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video       : { frameRate: { ideal: 60, max: 60 } },
                audio       : {
                    echoCancellation : false,
                    noiseSuppression : false,
                    autoGainControl  : false,
                    channelCount     : 2
                },
                systemAudio : "include"
            });
            this.state.streams.display = displayStream;

            /* Step 3: Route system audio through a gain node into the mixer */
            if (displayStream.getAudioTracks().length > 0) {
                const sysSrc = ctx.createMediaStreamSource(displayStream);
                this.state.gainNodes.sys = ctx.createGain();
                this.state.gainNodes.sys.gain.value = 1.0;          // Unity gain
                sysSrc.connect(this.state.gainNodes.sys).connect(dest);
            }

            /* Step 4: Add microphone audio to the mixer if enabled in the UI */
            if (this.state.isMicOn) {
                try {
                    const micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation : true,
                            noiseSuppression : true,
                            autoGainControl  : true
                        }
                    });
                    this.state.streams.mic = micStream;
                    const micSrc = ctx.createMediaStreamSource(micStream);
                    this.state.gainNodes.mic = ctx.createGain();

                    /* Honour the current slider value for initial gain */
                    this.state.gainNodes.mic.gain.value = parseFloat(this.ui.micGain.value);
                    micSrc.connect(this.state.gainNodes.mic).connect(dest);

                } catch (e) {
                    window.showToast('Could not access microphone. Check browser permissions.', true);
                    console.error("Microphone Access Error:", e);
                }
            }

            /* Step 5: Build the combined MediaStream
               — Video track from the screen capture
               — Audio track(s) from the Web Audio mixer destination */
            const mixedAudioTracks = dest.stream.getAudioTracks();
            const tracks           = [...displayStream.getVideoTracks()];
            if (mixedAudioTracks.length > 0) {
                tracks.push(...mixedAudioTracks);
            }

            const combinedStream       = new MediaStream(tracks);
            this.state.streams.mixed   = combinedStream;

            /* Show a live preview of the screen before recording starts */
            this.ui.preview.srcObject = combinedStream;
            this.ui.videoWrapper.style.display = 'block';

            /* Step 6: Countdown overlay (3 → 2 → 1)
               Displayed AFTER permissions are granted so the user can see
               the count without needing to alt-tab back to the browser. */
            this.ui.countdownOverlay.style.display = 'flex';
            let count = 3;
            this.ui.countdownOverlay.innerText = count;

            const interval = setInterval(() => {
                count--;
                if (count > 0) {
                    this.ui.countdownOverlay.innerText = count;
                } else {
                    clearInterval(interval);
                    this.ui.countdownOverlay.style.display = 'none';

                    /* Step 7: Begin actual encoding */
                    this._startActualRecording(combinedStream, displayStream);
                }
            }, 1000);

        } catch (err) {
            console.error("Screen Capture Initialisation Failed:", err);

            /* Distinguish user-cancellation from genuine errors */
            if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
                window.showToast('Screen sharing was cancelled.');
            } else {
                window.showToast('Could not initialise recording. Please try again.', true);
            }
        }
    }

    /**
     * _startActualRecording(combinedStream, displayStream)
     * ─────────────────────────────────────────────────────────────────────
     * Called once the countdown finishes. Sets up MediaRecorder, updates
     * the UI to "recording" state, starts the timer, visualiser, and stream
     * health monitor, then begins chunk collection.
     *
     * @param {MediaStream} combinedStream  Video + mixed audio stream for recording.
     * @param {MediaStream} displayStream   Raw display stream (used for stop detection).
     */
    _startActualRecording(combinedStream, displayStream) {

        /* Configure the MediaRecorder with quality-appropriate bitrate */
        this._setupMediaRecorder(combinedStream);

        /* ── UI → Recording State ────────────────────────────────────── */
        this.ui.recDot.style.display = 'block';
        this.ui.startBtn.classList.add('d-none');
        this.ui.stopBtn.disabled = false;
        this.ui.pauseBtn.classList.remove('d-none');
        this.ui.snapBtn.classList.remove('d-none');
        this.ui.dlBtn.classList.add('d-none');

        /* Disable mic toggle during recording — stream cannot be re-initialised
           without stopping; volume is still adjustable via the gain node. */
        this.ui.micToggle.disabled = true;

        /* Set recording flag BEFORE starting the visualiser */
        this.state.isRecording = true;

        /* Show audio visualiser if mic is active */
        if (this.state.isMicOn && this.state.streams.mic) {
            this.startVisualizer(this.state.streams.mic);
            this.ui.visContainer.style.display = 'block';
        }

        /* Start MediaRecorder — collect a new chunk every 1 second */
        this.state.mediaRecorder.start(1000);
        this._startTimer();
        this._startStreamMonitor();

        /* If the user clicks "Stop Sharing" in the browser's native UI,
           treat it the same as clicking our Stop button. */
        displayStream.getVideoTracks()[0].onended = () => this.stopRecording();

        window.showToast('Recording started. The screen is now being captured.');
    }

    /**
     * _setupMediaRecorder(stream)
     * ─────────────────────────────────────────────────────────────────────
     * Instantiates the MediaRecorder with the best supported MIME type and
     * a video bitrate matched to the user-selected quality setting.
     *
     * Bitrate mapping:
     *   4K   → 12 Mbps  (High bitrate for maximum detail)
     *   1080p →  6 Mbps  (Balanced quality vs file size)
     *   720p  →  2.5 Mbps (Efficient for weaker hardware)
     *
     * Falls back to the browser default if the explicit options are rejected.
     *
     * @param {MediaStream} stream  The combined recording stream.
     */
    _setupMediaRecorder(stream) {
        const quality  = this.ui.qualitySelect.value;
        const bps      = (quality === '4k')    ? 12000000
                       : (quality === '1080p') ?  6000000
                       :                          2500000;
        const mimeType = this._getBestMimeType();

        try {
            this.state.mediaRecorder = new MediaRecorder(stream, {
                mimeType            : mimeType,
                videoBitsPerSecond  : bps
            });
        } catch (e) {
            console.warn("MediaRecorder: option-based init failed, falling back to default.", e);
            this.state.mediaRecorder = new MediaRecorder(stream);
        }

        /* Reset chunk array for a clean recording */
        this.state.recordedChunks = [];

        /* Accumulate encoded data chunks as they arrive */
        this.state.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.state.recordedChunks.push(e.data);
        };

        /* Bind the stop handler so Blob creation triggers immediately */
        this.state.mediaRecorder.onstop = this._onRecordingStop.bind(this);
    }

    /**
     * _getBestMimeType()
     * ─────────────────────────────────────────────────────────────────────
     * Iterates a priority list of MIME types and returns the first one that
     * the current browser supports.
     *
     * Priority:
     *   1. VP9 + Opus  — Best quality and compression (Chrome ≥ 68)
     *   2. VP8 + Opus  — Wider browser support
     *   3. H264 + Opus — Hardware-accelerated on some systems
     *   4. Raw WebM    — Absolute fallback
     *
     * @returns {string}  A supported MIME type string, or '' for browser default.
     */
    _getBestMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm'
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return ''; // Let the browser choose its own default
    }

    /**
     * togglePause()
     * ─────────────────────────────────────────────────────────────────────
     * Pauses or resumes the active MediaRecorder.
     *
     * On pause: the timer stops, the REC dot animation freezes, and the
     *           AudioContext is suspended to halt all Web Audio processing.
     * On resume: everything restarts and the timer continues from where it
     *            was (totalSeconds is not reset between resumes).
     */
    togglePause() {
        if (!this.state.mediaRecorder) return;

        if (this.state.isPaused) {
            /* ── RESUME ─────────────────────────────────────────────── */
            this.state.mediaRecorder.resume();
            this.ui.pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
            this._startTimer();
            this.ui.recDot.style.animationPlayState = 'running';

            /* Resume AudioContext if it was suspended on pause */
            if (this.state.audioCtx && this.state.audioCtx.state === 'suspended') {
                this.state.audioCtx.resume();
            }

            window.showToast('Recording resumed.');

        } else {
            /* ── PAUSE ──────────────────────────────────────────────── */
            this.state.mediaRecorder.pause();
            this.ui.pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
            clearInterval(this.state.timer.ref);
            this.ui.recDot.style.animationPlayState = 'paused';

            /* Suspend AudioContext to stop DSP processing while paused */
            if (this.state.audioCtx) this.state.audioCtx.suspend();

            window.showToast('Recording paused.');
        }

        /* Toggle the paused flag */
        this.state.isPaused = !this.state.isPaused;
    }

    /**
     * stopRecording()
     * ─────────────────────────────────────────────────────────────────────
     * Stops the MediaRecorder, which triggers the ondataavailable callback
     * one final time and then fires onstop → _onRecordingStop().
     *
     * Falls back to calling _onRecordingStop() directly if the recorder
     * was never properly started (e.g., the stream failed mid-setup).
     */
    stopRecording() {
        if (this.state.mediaRecorder && this.state.mediaRecorder.state !== 'inactive') {
            this.state.mediaRecorder.stop();
        } else {
            /* Manual cleanup in edge-case where recorder was never active */
            this._onRecordingStop();
        }
    }

    /**
     * _onRecordingStop()
     * ─────────────────────────────────────────────────────────────────────
     * Called automatically by MediaRecorder.onstop. Performs all cleanup:
     *
     *   1. Clears timers and animation frames.
     *   2. Stops all hardware tracks (releases camera LED, mic indicator).
     *   3. Disconnects Web Audio nodes to prevent memory leaks.
     *   4. Builds a Blob from the collected chunks and creates a Blob URL.
     *   5. Resets the UI to a "finished" state with the Save Video button.
     *   6. Shows the recorded video in the preview player for review.
     */
    _onRecordingStop() {

        /* Guard against double-invocation (e.g. user clicks Stop and the
           browser simultaneously fires the track.onended event). */
        if (!this.state.isRecording && this.state.recordedChunks.length === 0) return;

        /* 1. Stop all timing and animation loops */
        this.state.isRecording = false;
        clearInterval(this.state.timer.ref);
        clearInterval(this.state.streamMonitorInterval);
        if (this.state.visualizer.ref) cancelAnimationFrame(this.state.visualizer.ref);

        /* 2. Release all media tracks — frees camera/mic hardware resources */
        Object.values(this.state.streams).forEach(stream => {
            if (stream) stream.getTracks().forEach(track => track.stop());
        });

        /* 3. Disconnect Web Audio graph nodes to allow garbage collection */
        if (this.state.gainNodes.mic) this.state.gainNodes.mic.disconnect();
        if (this.state.gainNodes.sys) this.state.gainNodes.sys.disconnect();

        /* 4. Assemble the final video Blob from collected 1-second chunks.
              createObjectURL() returns a memory URL valid for this session. */
        const blob = new Blob(this.state.recordedChunks, { type: 'video/webm' });
        const url  = URL.createObjectURL(blob);

        /* 5. Reset the UI to post-recording state */
        this.ui.visContainer.style.display  = 'none';
        this.ui.recDot.style.display        = 'none';
        this.ui.stopBtn.disabled            = true;
        this.ui.pauseBtn.classList.add('d-none');
        this.ui.snapBtn.classList.add('d-none');
        this.ui.startBtn.classList.remove('d-none');
        this.ui.startBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> New Record';

        /* Configure the download anchor with the Blob URL */
        this.ui.dlBtn.href     = url;
        this.ui.dlBtn.download = `ScreenRec_${Date.now()}.webm`;
        this.ui.dlBtn.classList.remove('d-none');

        /* Re-enable the mic toggle for the next session */
        this.ui.micToggle.disabled = false;

        /* 6. Switch the preview player from live srcObject to the recorded Blob */
        this.ui.preview.srcObject = null;
        this.ui.preview.src       = url;
        this.ui.preview.muted     = false;
        this.ui.preview.controls  = true;

        window.showToast('Recording complete. Your video is ready to save.');
    }


    /* ═══════════════════════════════════════════════════════════════════════
       SECTION 6 : SCREENSHOT
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * takeScreenshot()
     * ─────────────────────────────────────────────────────────────────────
     * Captures a PNG snapshot of the current live video frame at the
     * stream's native resolution (not the CSS-displayed size), then
     * programmatically triggers a browser download.
     *
     * Guard: The preview element must have an active srcObject and a
     * readyState ≥ HAVE_CURRENT_DATA (2) before the capture is valid.
     */
    takeScreenshot() {
        if (!this.ui.preview.srcObject || this.ui.preview.readyState < 2) {
            window.showToast('The video stream is not ready yet. Please wait a moment.', true);
            return;
        }

        /* Create an off-screen canvas at the native video resolution */
        const canvas = document.createElement('canvas');
        canvas.width  = this.ui.preview.videoWidth;
        canvas.height = this.ui.preview.videoHeight;
        canvas.getContext('2d').drawImage(this.ui.preview, 0, 0, canvas.width, canvas.height);

        /* Trigger a browser download of the PNG */
        const link      = document.createElement('a');
        link.download   = `Snapshot_${Date.now()}.png`;
        link.href       = canvas.toDataURL('image/png');
        link.click();

        window.showToast('High-resolution screenshot saved.');
    }


    /* ═══════════════════════════════════════════════════════════════════════
       SECTION 7 : UTILITIES
    ═══════════════════════════════════════════════════════════════════════ */

    /**
     * _startTimer()
     * ─────────────────────────────────────────────────────────────────────
     * Starts (or restarts after a resume) a 1-second tick that increments
     * totalSeconds and renders the formatted HH:MM:SS string into the DOM.
     * On a fresh recording start, totalSeconds is reset to 0.
     */
    _startTimer() {
        /* Reset the counter only on a brand-new recording, not on resume.
           isPaused is true when coming back from a pause, so we skip the reset. */
        if (!this.state.isPaused) this.state.timer.totalSeconds = 0;
        clearInterval(this.state.timer.ref);

        this.state.timer.ref = setInterval(() => {
            this.state.timer.totalSeconds++;

            const h = Math.floor(this.state.timer.totalSeconds / 3600)
                          .toString().padStart(2, '0');
            const m = Math.floor((this.state.timer.totalSeconds % 3600) / 60)
                          .toString().padStart(2, '0');
            const s = (this.state.timer.totalSeconds % 60)
                          .toString().padStart(2, '0');

            this.ui.timer.innerText = `${h}:${m}:${s}`;
        }, 1000);
    }

    /**
     * startVisualizer(stream)
     * ─────────────────────────────────────────────────────────────────────
     * Creates a Web Audio AnalyserNode fed by the microphone stream and
     * draws real-time frequency bars onto the #audioVis canvas element.
     *
     * The canvas always uses a black background so the neon bars are
     * readable in both dark mode and light mode.
     *
     * Bar colour is calculated from bar height using HSL, producing a
     * purple-to-pink gradient that matches the tool's brand palette.
     *
     * @param {MediaStream} stream  The mic stream to analyse.
     */
    startVisualizer(stream) {
        if (!this.state.audioCtx) return;

        const ctx      = this.state.audioCtx;
        const analyser = ctx.createAnalyser();
        const src      = ctx.createMediaStreamSource(stream);

        src.connect(analyser);
        analyser.fftSize = 128;     // 64 frequency bins — lightweight & fast

        const bufferLength = analyser.frequencyBinCount;
        const dataArray    = new Uint8Array(bufferLength);
        const canvasCtx    = this.ui.canvas.getContext('2d');
        const canvas       = this.ui.canvas;

        /* Recursive animation loop — stops automatically when isRecording = false */
        const draw = () => {
            if (!this.state.isRecording) return;

            this.state.visualizer.ref = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            /* Always use a black background for maximum neon contrast */
            canvasCtx.fillStyle = '#000';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x          = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;

                /* HSL hue derived from bar height → purple / pink spectrum */
                canvasCtx.fillStyle = `hsl(${barHeight + 280}, 100%, 50%)`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        };

        draw();
    }

    /**
     * _startStreamMonitor()
     * ─────────────────────────────────────────────────────────────────────
     * Polls the display stream's active flag every second. If the user
     * revokes screen-share permission (or unplugs a capture device), the
     * stream becomes inactive and we trigger a clean stopRecording().
     *
     * This handles the edge case where the stream dies without firing the
     * track.onended event (observed in some Firefox builds).
     */
    _startStreamMonitor() {
        this.state.streamMonitorInterval = setInterval(() => {
            if (this.state.streams.display && !this.state.streams.display.active) {
                this.stopRecording();
            }
        }, 1000);
    }

    /**
     * _setupDraggable(elmnt, handle)
     * ─────────────────────────────────────────────────────────────────────
     * Attaches mouse and touch drag listeners to make a floating element
     * repositionable by the user. Uses CSS transform: translate3d() for
     * hardware-accelerated, jank-free movement at 60 fps.
     *
     * Events are bound to document (not the element) so fast mouse movements
     * outside the element boundary don't lose the drag.
     *
     * @param {HTMLElement} elmnt   The element to move.
     * @param {HTMLElement} handle  Optional drag handle. Defaults to elmnt itself.
     */
    _setupDraggable(elmnt, handle) {
        let startX  = 0, startY  = 0;
        let initialX = 0, initialY = 0;
        const dragHandle = handle || elmnt;

        /* dragStart — record cursor offset from element origin */
        const dragStart = (e) => {
            if (e.type === 'touchstart') {
                initialX = e.touches[0].clientX - startX;
                initialY = e.touches[0].clientY - startY;
            } else {
                initialX = e.clientX - startX;
                initialY = e.clientY - startY;
            }

            /* Attach move and end listeners to document to track fast moves */
            document.addEventListener('mouseup',    dragEnd);
            document.addEventListener('mousemove',  dragMove);
            document.addEventListener('touchend',   dragEnd);
            document.addEventListener('touchmove',  dragMove);
        };

        /* dragMove — calculate new position and apply via transform */
        const dragMove = (e) => {
            e.preventDefault();
            let currentX, currentY;

            if (e.type === 'touchmove') {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }

            startX = currentX;
            startY = currentY;

            /* translate3d enables GPU compositing for smooth 60 fps drag */
            elmnt.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        };

        /* dragEnd — clean up document-level listeners */
        const dragEnd = () => {
            document.removeEventListener('mouseup',   dragEnd);
            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('touchend',  dragEnd);
            document.removeEventListener('touchmove', dragMove);
        };

        /* Attach drag start to the designated handle */
        dragHandle.addEventListener('mousedown', dragStart);
        dragHandle.addEventListener('touchstart', dragStart);
    }

}

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL INSTANCE
   Exposed on window so HTML onclick="ScreenRecorderApp.method()" handlers
   work without any additional module import.
════════════════════════════════════════════════════════════════════════════ */
window.ScreenRecorderApp = new ScreenRecorderPro();
