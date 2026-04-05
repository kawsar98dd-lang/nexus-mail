/**
 * =============================================================================
 *  ULTRA FOCUS PRO MAX — CORE ENGINE v4.2 (CodeCanyon Gold Release)
 *  File    : script.js
 *  Tool    : tool-focus-timer
 *  Project : Trusted Tools Web
 *  Author  : MD KAWSAR
 * =============================================================================
 *
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  This file implements the entire application as a single ES6 Singleton class
 *  called UltraFocusEngine. One instance (`app`) is created at the bottom of
 *  the file after the DOM is ready. This pattern ensures:
 *    • No global variable collisions with other tools
 *    • All state is encapsulated and predictable
 *    • Audio nodes are lazily initialised (only on first user gesture)
 *
 *  KEY MODULES INSIDE THE CLASS
 *  ─────────────────────────────────────────────────────────────────────────
 *    1. CONSTRUCTOR          — State bootstrap, DOM map, SVG setup, init calls
 *    2. AUDIO ENGINE         — Web Audio API: noise generation, binaural beats,
 *                              dynamics compressor chain, fade in/out
 *    3. VISUALIZER           — Retina-ready Canvas frequency waveform (rAF loop)
 *    4. DRIFT-FREE TIMER     — Date.now() delta calculation prevents JS drift
 *    5. MODE SWITCHER        — Handles DEEP WORK / RECHARGE / LONG BREAK states
 *    6. XP & GAMIFICATION    — XP points, levels, daily streaks
 *    7. TASK MANAGER         — XSS-safe task CRUD using localStorage
 *    8. STATISTICS           — Weekly focus bar chart rendered from localStorage
 *    9. UTILS & SECURITY     — Wake Lock API, sanitise(), hexToRgb()
 *   10. NOTIFICATION         — Routes all notify() calls to window.showToast()
 *   11. EVENT BINDING        — All DOM event listeners initialised once
 *
 *  TOAST SYSTEM
 *  ─────────────────────────────────────────────────────────────────────────
 *  This tool uses the GLOBAL toast system provided by global.js.
 *  All notifications are dispatched via window.showToast(message, isError).
 *    • window.showToast("Your message")        — standard/info toast
 *    • window.showToast("Your message", true)  — error toast (red variant)
 *  The local notify() wrapper method delegates to window.showToast so that
 *  internal calls remain short and readable throughout the class.
 *
 *  LOCALSTORAGE KEYS USED
 *  ─────────────────────────────────────────────────────────────────────────
 *    ultraConfig_v4  — user configuration object {focus, short, long, soundType}
 *    ultraTasks_v4   — array of task objects  [{text, completed}]
 *    ultraStats_v4   — array of 7 integers    [sun, mon, tue, wed, thu, fri, sat]
 *    ultraXP_v4      — integer total XP
 *    lastVisit_v4    — date string for streak tracking
 *    streak_v4       — integer consecutive-day streak count
 * =============================================================================
 */

class UltraFocusEngine {

    // =========================================================================
    //  SECTION 1 — CONSTRUCTOR
    //  Bootstraps the entire application on instantiation.
    //  Loads persisted config, maps DOM nodes, configures the SVG ring,
    //  binds all event listeners, and sets the initial timer mode.
    // =========================================================================

    /**
     * Initialises application configuration, UI state, audio node references,
     * and all DOM element bindings. Called once when `new UltraFocusEngine()`
     * is executed at page load.
     */
    constructor() {

        // ── USER CONFIGURATION (persisted across sessions) ────────────────────
        // Load saved settings from localStorage, or fall back to safe defaults.
        this.config = JSON.parse(localStorage.getItem('ultraConfig_v4')) || {
            focus     : 25,     // Focus session duration in minutes
            short     : 5,      // Short break duration in minutes
            long      : 15,     // Long break duration in minutes
            soundType : 'pink'  // Default ambient noise type
        };

        // ── RUNTIME STATE ─────────────────────────────────────────────────────
        // All mutable application state lives in this single object.
        this.state = {
            isRunning     : false,      // Whether the countdown is active
            currentMode   : 'focus',    // Active mode: 'focus' | 'short' | 'long'
            timeLeft      : 25 * 60,    // Seconds remaining on the current timer
            totalTime     : 25 * 60,    // Total seconds for the current session
            isSoundOn     : false,      // Whether ambient noise is playing
            isBinauralOn  : false,      // Whether binaural beat oscillators are active
            masterVolume  : 0.5,        // Gain level 0.001–1.0
            statsVisible  : false,      // Whether the stats panel is shown
            endTime       : null,       // Epoch ms when the current session will end
            rafId         : null        // requestAnimationFrame handle for visualizer
        };

        // ── AUDIO NODE REFERENCES (lazy-initialised) ──────────────────────────
        this.audioCtx         = null;   // Web Audio API context
        this.analyser         = null;   // AnalyserNode for frequency data
        this.gainNode         = null;   // Master gain node
        this.sourceNode       = null;   // Current noise BufferSourceNode
        this.binauralNodes    = [];     // [OscillatorNode, OscillatorNode] for binaural
        this.audioBufferCache = {};     // Cached noise AudioBuffers keyed by type

        // ── DOM ELEMENT MAP ───────────────────────────────────────────────────
        // Cache all frequently accessed DOM elements in a single object to
        // avoid repeated getElementById() calls during the timer loop.
        this.dom = {
            timer          : document.getElementById('timer'),
            circle         : document.getElementById('progressRing'),
            startBtn       : document.getElementById('startBtn'),
            visualizer     : document.getElementById('visualizer'),
            visualizerCtx  : document.getElementById('visualizer').getContext('2d'),
            sliderBg       : document.getElementById('sliderBg'),
            taskList       : document.getElementById('taskList'),
            root           : document.documentElement
        };

        // ── SVG PROGRESS RING SETUP ───────────────────────────────────────────
        // Calculate circumference once; set strokeDasharray so progress can be
        // shown by adjusting strokeDashoffset in updateDisplay().
        this.radius         = this.dom.circle.r.baseVal.value;
        this.circumference  = 2 * Math.PI * this.radius;
        this.dom.circle.style.strokeDasharray = `${this.circumference} ${this.circumference}`;

        // ── BOOTSTRAP SEQUENCE ────────────────────────────────────────────────
        this.initEvents();          // Bind all DOM event listeners
        this.loadUserData();        // Restore XP / level from localStorage
        this.checkStreak();         // Update and display daily streak
        this.renderTasks();         // Populate the task list
        this.switchMode('focus');   // Reset UI to default focus mode
    }

    // =========================================================================
    //  SECTION 2 — AUDIO ENGINE
    //  Manages the Web Audio API context, noise generation, binaural beats,
    //  and the dynamics compressor master chain.
    // =========================================================================

    /**
     * Lazily initialises the Web Audio API context and master signal chain.
     * Only runs on the first user gesture to comply with browser autoplay policy.
     *
     * Signal chain:
     *   GainNode → DynamicsCompressor → AnalyserNode → AudioDestination
     *
     * The DynamicsCompressor normalises varying noise levels and prevents
     * sudden volume spikes when switching audio types.
     *
     * @async
     * @returns {Promise<boolean>} true if audio context is ready, false on failure.
     */
    async initAudio() {
        if (!this.audioCtx) {
            try {
                // Cross-browser AudioContext constructor
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContext();

                // ── MASTER DYNAMICS COMPRESSOR ────────────────────────────────
                // Prevents clipping and normalises disparate noise colour levels.
                const compressor = this.audioCtx.createDynamicsCompressor();
                compressor.threshold.value = -24;   // dB: compression starts here
                compressor.knee.value      = 30;    // dB: soft knee width
                compressor.ratio.value     = 12;    // 12:1 compression ratio
                compressor.attack.value    = 0.003; // seconds: fast attack
                compressor.release.value   = 0.25;  // seconds: medium release

                // ── ANALYSER NODE ─────────────────────────────────────────────
                // Provides frequency data for the canvas visualizer.
                this.analyser          = this.audioCtx.createAnalyser();
                this.analyser.fftSize  = 256; // 128 frequency bins

                // ── MASTER GAIN ───────────────────────────────────────────────
                this.gainNode = this.audioCtx.createGain();

                // ── CONNECT CHAIN ─────────────────────────────────────────────
                this.gainNode.connect(compressor);
                compressor.connect(this.analyser);
                this.analyser.connect(this.audioCtx.destination);

                // Initialise retina canvas and bind future resize events
                this.resizeCanvas();
                window.addEventListener('resize', () => this.resizeCanvas());

            } catch (e) {
                // Non-fatal: log and inform user via global toast (error variant)
                console.error("Audio Engine Critical Failure:", e);
                window.showToast("Audio Hardware Unavailable", true);
                return false;
            }
        }

        // Resume a suspended context (e.g., after tab switch on mobile)
        if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
        return true;
    }

    /**
     * Generates a procedural noise AudioBuffer for the specified noise colour.
     * Buffers are cached in this.audioBufferCache to avoid re-computation.
     *
     * Noise types:
     *   'white' — equal energy per frequency (raw random)
     *   'pink'  — 1/f spectrum (Paul Kellet's refined method): warmest, most
     *             effective for sustained cognitive focus
     *   'brown' — 1/f² spectrum (Brownian motion integration): deep, rumbling
     *   'rain'  — white noise run through a lowpass filter at 800 Hz in toggleSound()
     *
     * @param {string} type - Noise colour identifier.
     * @returns {AudioBuffer} The generated (or cached) audio buffer.
     */
    generateNoiseBuffer(type) {
        // Return cached buffer if this type has been generated before
        if (this.audioBufferCache[type]) return this.audioBufferCache[type];

        // 4-second loop buffer (sufficient for seamless looped playback)
        const bufferSize = this.audioCtx.sampleRate * 4;
        const buffer     = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data       = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            // Base white noise sample: uniformly distributed in [-1, 1]
            const white = Math.random() * 2 - 1;

            if (type === 'white') {
                // ── WHITE NOISE ────────────────────────────────────────────
                // Attenuated to prevent clipping after the compressor.
                data[i] = white * 0.15;

            } else if (type === 'pink') {
                // ── PINK NOISE (Paul Kellet's Refined Method) ──────────────
                // Approximates 1/f frequency spectrum using a bank of
                // six first-order IIR filters with tuned coefficients.
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616  * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;

            } else if (type === 'brown') {
                // ── BROWN NOISE (Brownian Motion / Random Walk) ────────────
                // Each sample is a small random step from the previous value,
                // yielding a very deep, low-frequency rumble.
                let lastOut = 0;
                data[i]  = (lastOut + (0.02 * white)) / 1.02;
                lastOut  = data[i];
                data[i] *= 3.5; // Boost amplitude to compensate for filtering

            } else {
                // ── RAIN / FALLBACK ────────────────────────────────────────
                // Lightly attenuated white noise; a lowpass BiquadFilter is
                // applied in toggleSound() to give a rain-like texture.
                data[i] = white * 0.1;
            }
        }

        // Cache and return the generated buffer
        this.audioBufferCache[type] = buffer;
        return buffer;
    }

    /**
     * Toggles the ambient background noise engine on or off.
     * On activation: creates a looping BufferSourceNode, applies a
     *   colour-specific BiquadFilter, and smoothly fades in via
     *   exponentialRampToValueAtTime to avoid audio clicks.
     * On deactivation: exponentially ramps gain to near-zero,
     *   then stops the source node after 500ms (fade-out duration).
     *
     * @async
     */
    async toggleSound() {
        if (!(await this.initAudio())) return;
        const btn = document.getElementById('soundBtn');

        if (this.state.isSoundOn) {
            // ── FADE OUT AND STOP ─────────────────────────────────────────
            if (this.gainNode) {
                // Cancel any in-progress ramps before scheduling new one
                this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
                this.gainNode.gain.exponentialRampToValueAtTime(
                    0.001, this.audioCtx.currentTime + 0.5
                );
                // Stop the source node after the 500ms fade completes
                setTimeout(() => {
                    if (this.sourceNode) {
                        try { this.sourceNode.stop(); } catch (e) {}
                        this.sourceNode = null;
                    }
                    // Cancel visualizer rAF loop if binaural is also off
                    if (!this.state.isBinauralOn) cancelAnimationFrame(this.state.rafId);
                }, 500);
            }
            this.state.isSoundOn = false;
            btn.classList.remove('active');

        } else {
            // ── CREATE LOOPING NOISE SOURCE ───────────────────────────────
            const noise   = this.audioCtx.createBufferSource();
            noise.buffer  = this.generateNoiseBuffer(this.config.soundType);
            noise.loop    = true; // Seamless looping

            // ── APPLY COLOUR-SPECIFIC FILTER ──────────────────────────────
            // Rain: aggressive lowpass for the "heavy rainfall" texture.
            // Pink: gentle lowpass to remove harsh high frequencies.
            // Others: allpass (no modification).
            const filter = this.audioCtx.createBiquadFilter();
            if (this.config.soundType === 'rain') {
                filter.type           = 'lowpass';
                filter.frequency.value = 800;
            } else if (this.config.soundType === 'pink') {
                filter.type           = 'lowpass';
                filter.frequency.value = 6000;
            } else {
                filter.type = 'allpass';
            }

            // Connect source → filter → master gain
            noise.connect(filter);
            filter.connect(this.gainNode);

            // ── SMOOTH FADE IN ─────────────────────────────────────────────
            // Start at near-zero and ramp to master volume over 1.5 seconds.
            this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
            this.gainNode.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
            this.gainNode.gain.exponentialRampToValueAtTime(
                this.state.masterVolume, this.audioCtx.currentTime + 1.5
            );

            noise.start();
            this.sourceNode      = noise;
            this.state.isSoundOn = true;
            btn.classList.add('active');
            this.drawVisualizer(); // Start rAF loop
        }
    }

    /**
     * Toggles 40Hz Gamma Binaural Beats on or off.
     *
     * Binaural beats are created by feeding slightly different frequencies to
     * the left (200 Hz) and right (240 Hz) stereo channels. The brain perceives
     * the 40 Hz difference as a phantom beat, which is associated with focused
     * cognitive states in neuroscience research (Gamma brainwave entrainment).
     *
     * Signal path: OscL → ChannelMerger → BinGain → AnalyserNode → Destination
     *                OscR ↗
     *
     * @async
     */
    async toggleBinaural() {
        if (!(await this.initAudio())) return;
        const btn = document.getElementById('binauralBtn');

        if (this.state.isBinauralOn) {
            // ── STOP BINAURAL OSCILLATORS ─────────────────────────────────
            this.binauralNodes.forEach(n => {
                try { n.stop(); n.disconnect(); } catch (e) {}
            });
            this.binauralNodes       = [];
            this.state.isBinauralOn  = false;
            btn.classList.remove('active');
            this.notify("Neural Sync: OFF");
            // Stop visualizer loop if ambient sound is also inactive
            if (!this.state.isSoundOn) cancelAnimationFrame(this.state.rafId);

        } else {
            // ── CREATE BINAURAL STEREO PAIR ───────────────────────────────
            const base = 200; // Hz — carrier frequency (inaudible as tone)
            const diff = 40;  // Hz — target Gamma frequency

            const oscL   = this.audioCtx.createOscillator();
            const oscR   = this.audioCtx.createOscillator();
            const merger = this.audioCtx.createChannelMerger(2);

            // Left channel: carrier frequency
            oscL.frequency.value = base;
            // Right channel: carrier + Gamma offset
            oscR.frequency.value = base + diff;

            // Route each oscillator to a dedicated stereo channel
            oscL.connect(merger, 0, 0); // Osc L → left channel (index 0)
            oscR.connect(merger, 0, 1); // Osc R → right channel (index 1)

            // Keep binaural subtle so it blends with noise without overwhelming
            const binGain          = this.audioCtx.createGain();
            binGain.gain.value     = 0.05;

            // Connect merged stereo signal to analyser and final destination
            merger.connect(binGain);
            binGain.connect(this.analyser); // Include in visualizer data
            binGain.connect(this.audioCtx.destination);

            oscL.start();
            oscR.start();
            this.binauralNodes      = [oscL, oscR];
            this.state.isBinauralOn = true;
            btn.classList.add('active');
            this.notify("Gamma Waves Active (40Hz)");
            this.drawVisualizer(); // Start rAF loop if not already running
        }
    }

    /**
     * Updates the master gain in real time as the volume slider is dragged.
     * Uses setTargetAtTime for smooth interpolation rather than abrupt jumps.
     *
     * @param {number|string} val - Raw slider value 0–100.
     */
    updateVolume(val) {
        // Clamp minimum to 0.001 to avoid exponential ramp errors with 0
        this.state.masterVolume = Math.max(0.001, val / 100);
        if (this.state.isSoundOn && this.gainNode) {
            this.gainNode.gain.setTargetAtTime(
                this.state.masterVolume, this.audioCtx.currentTime, 0.1
            );
        }
    }

    // =========================================================================
    //  SECTION 3 — VISUALIZER (RETINA-READY CANVAS)
    //  Renders a circular frequency waveform using requestAnimationFrame.
    //  Adapts to high-DPI (Retina) displays via devicePixelRatio scaling.
    // =========================================================================

    /**
     * Adjusts the canvas internal resolution to match the physical pixel density
     * of the display (Retina / HiDPI support). Called on init and on every resize.
     * Without this, the canvas would appear blurry on high-DPI screens.
     */
    resizeCanvas() {
        const canvas = this.dom.visualizer;
        const rect   = canvas.parentElement.getBoundingClientRect();
        const dpr    = window.devicePixelRatio || 1;

        // Set buffer dimensions to physical pixel count
        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;

        // Scale the 2D context so all drawing commands use CSS pixel units
        const ctx = this.dom.visualizerCtx;
        ctx.scale(dpr, dpr);
    }

    /**
     * Draws the real-time audio frequency data as a circular waveform on the
     * canvas element that overlays the SVG progress ring.
     *
     * Algorithm:
     *   1. Read 128 frequency bins from the AnalyserNode into a Uint8Array.
     *   2. Map each bin to an angle on a full circle (0 → 2π).
     *   3. Scale the bin's amplitude to an outward radial displacement.
     *   4. Draw a closed path through all displaced points.
     *   5. Stroke the path with the current --accent CSS variable colour
     *      and a matching glow shadow.
     *   6. Schedule the next frame via requestAnimationFrame.
     *
     * The loop runs at ~60fps and self-cancels if both audio engines are off.
     */
    drawVisualizer() {
        // Self-cancel guard: stop the loop if all audio has been turned off
        if (!this.state.isSoundOn && !this.state.isBinauralOn) return;

        const bufferLength = this.analyser.frequencyBinCount;   // 128 bins
        const dataArray    = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);          // Fill array

        const ctx    = this.dom.visualizerCtx;
        const canvas = this.dom.visualizer;
        const dpr    = window.devicePixelRatio || 1;
        const width  = canvas.width  / dpr;
        const height = canvas.height / dpr;

        // Clear previous frame
        ctx.clearRect(0, 0, width, height);

        const cx     = width  / 2;  // Canvas centre X
        const cy     = height / 2;  // Canvas centre Y
        const radius = 110;         // Base circle radius (matches SVG ring)

        // Build circular path from frequency data
        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
            const v   = dataArray[i] / 255.0;  // Normalise 0–1
            const h   = v * 60;                // Outward amplitude in px
            const rad = (Math.PI * 2) * (i / bufferLength); // Angle for this bin

            const x = cx + Math.cos(rad) * (radius + h);
            const y = cy + Math.sin(rad) * (radius + h);

            if (i === 0) ctx.moveTo(x, y);
            else         ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Stroke with the current theme accent colour (updates when mode changes)
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 10;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.stroke();
        ctx.shadowBlur  = 0; // Reset shadow to avoid bleeding into other draws

        // Schedule the next frame
        this.state.rafId = requestAnimationFrame(() => this.drawVisualizer());
    }

    // =========================================================================
    //  SECTION 4 — DRIFT-FREE TIMER
    //  Uses Date.now() delta calculation instead of setInterval counter.
    //  This ensures accuracy even when the JS thread is blocked or the tab
    //  is backgrounded on mobile.
    // =========================================================================

    /**
     * Toggle handler called by the Start/Pause button.
     * Delegates to startTimer() or pauseTimer() based on current state.
     */
    toggleTimer() {
        if (this.state.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    /**
     * Starts (or resumes) the countdown timer.
     *
     * Instead of decrementing a counter every second (which drifts), this
     * method records the absolute end time (Date.now() + remaining ms) and
     * then polls every 200ms to compute the remaining time by subtracting
     * the current epoch from the end time. This is 100% drift-free.
     *
     * Requests Screen Wake Lock to prevent the phone screen from sleeping
     * during a focus session.
     */
    startTimer() {
        // Guard: do nothing if timer has already counted down to zero
        if (this.state.timeLeft <= 0) return;

        // Ensure audio context is initialised (satisfies browser autoplay policy)
        this.initAudio();
        this.requestWakeLock();

        this.state.isRunning = true;

        // Record the exact future epoch when the session will complete
        this.state.endTime = Date.now() + (this.state.timeLeft * 1000);

        // ── UPDATE BUTTON TO "PAUSE" STATE ────────────────────────────────
        this.dom.startBtn.innerText         = "PAUSE";
        this.dom.startBtn.style.background  = "transparent";
        this.dom.startBtn.style.color       = getComputedStyle(document.body).getPropertyValue('--text-main');
        this.dom.startBtn.style.border      = "1px solid rgba(128,128,128,0.3)";

        // ── POLLING LOOP (200ms frequency for smooth display) ─────────────
        // Updates the display at ~5fps; actual accuracy is tied to Date.now().
        this.timerLoop = setInterval(() => {
            const now   = Date.now();
            const delta = this.state.endTime - now; // ms remaining

            if (delta <= 0) {
                // Session complete
                this.completeTimer();
            } else {
                // Update remaining seconds (ceiling to avoid premature "0")
                this.state.timeLeft = Math.ceil(delta / 1000);
                this.updateDisplay();
            }
        }, 200);
    }

    /**
     * Pauses the countdown, clears the polling interval, and releases the
     * Screen Wake Lock (allowing the screen to sleep while paused).
     */
    pauseTimer() {
        clearInterval(this.timerLoop);
        this.state.isRunning = false;
        this.releaseWakeLock();

        // ── UPDATE BUTTON TO "RESUME" STATE ───────────────────────────────
        this.dom.startBtn.innerText         = "RESUME";
        this.dom.startBtn.style.background  = getComputedStyle(document.body).getPropertyValue('--text-main');
        this.dom.startBtn.style.color       = getComputedStyle(document.body).getPropertyValue('--bg-deep');
        this.dom.startBtn.style.border      = "none";
    }

    /**
     * Fires when the countdown reaches zero.
     * Plays an ascending completion chime, awards XP, logs focus stats,
     * and automatically switches to the appropriate next mode
     * (focus → short break; short/long break → focus).
     */
    completeTimer() {
        // Stop the interval and update UI to reflect paused state
        this.pauseTimer();
        this.state.timeLeft = 0;
        this.updateDisplay();

        // ── COMPLETION CHIME (Ascending Sine Oscillator) ──────────────────
        // A brief 440→880 Hz tone with exponential decay, played directly
        // to the destination to remain audible even if noise engine is off.
        this.initAudio();
        const osc = this.audioCtx.createOscillator();
        const g   = this.audioCtx.createGain();
        osc.connect(g);
        g.connect(this.audioCtx.destination);

        osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.1);
        g.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.5);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 1.5);

        // ── POST-SESSION LOGIC ────────────────────────────────────────────
        if (this.state.currentMode === 'focus') {
            // Award XP and log the completed focus session duration
            this.addXP(100);
            this.logStats(this.config.focus);
            this.notify("Sequence Complete! +100 XP");
            this.switchMode('short'); // Auto-advance to short break
        } else {
            this.notify("Recharge Complete.");
            this.switchMode('focus'); // Return to focus after any break
        }

        // ── RESET BUTTON TO INITIAL STATE ────────────────────────────────
        this.dom.startBtn.innerText         = "INITIATE SEQUENCE";
        this.dom.startBtn.style.background  = getComputedStyle(document.body).getPropertyValue('--text-main');
        this.dom.startBtn.style.color       = getComputedStyle(document.body).getPropertyValue('--bg-deep');
    }

    /**
     * Renders the current timeLeft value to the DOM timer display (#timer)
     * and updates the browser tab title with the remaining time.
     * Also calculates and applies the SVG ring's strokeDashoffset to show
     * visual progress as a percentage of the total session duration.
     */
    updateDisplay() {
        // Format minutes and seconds with zero-padding
        const m       = Math.floor(this.state.timeLeft / 60).toString().padStart(2, '0');
        const s       = (this.state.timeLeft % 60).toString().padStart(2, '0');
        const timeStr = `${m}:${s}`;

        // Update the on-screen timer and the browser tab title
        this.dom.timer.innerText = timeStr;
        document.title           = `${timeStr} | Focus`;

        // ── SVG RING PROGRESS ─────────────────────────────────────────────
        // progress: 0 (session start) → 100 (session complete)
        // offset  : circumference    → 0    (ring fills clockwise)
        const progress           = ((this.state.totalTime - this.state.timeLeft) / this.state.totalTime) * 100;
        const offset             = this.circumference - (progress / 100) * this.circumference;
        this.dom.circle.style.strokeDashoffset = offset;
    }

    // =========================================================================
    //  SECTION 5 — MODE SWITCHER
    //  Manages the three timer modes (DEEP WORK / RECHARGE / LONG BREAK).
    //  Pauses any active timer, updates the sliding tab indicator, changes
    //  the accent colour theme, and resets the countdown to the mode's duration.
    // =========================================================================

    /**
     * Switches the active Pomodoro mode and resets all related UI state.
     *
     * Dynamic accent colours per mode allow the interface to give immediate
     * visual feedback about the current phase:
     *   • #00f3ff — Cyan   (Deep Work / Focus)
     *   • #00ffa3 — Green  (Short Recharge break)
     *   • #ff0055 — Red    (Long Break — brand primary)
     *
     * The CSS variable --accent is updated on :root so ALL accent-dependent
     * styles (slider pill, glow, visualizer stroke) update simultaneously.
     *
     * @param {string} mode - One of 'focus' | 'short' | 'long'.
     */
    switchMode(mode) {
        this.state.currentMode = mode;
        this.pauseTimer(); // Stop if currently running

        // ── TAB INDICATOR SLIDE ───────────────────────────────────────────
        // Remove .active from all mode buttons; apply to the selected one.
        // The slider background pill is translated by N × 100% of its width
        // (0% = first tab, 100% = second tab, 200% = third tab).
        document.querySelectorAll('.uft-mode-btn').forEach(b => b.classList.remove('active'));
        const idx = ['focus', 'short', 'long'].indexOf(mode);
        if (idx !== -1) {
            this.dom.sliderBg.style.transform = `translateX(${idx * 100}%)`;
            document.querySelectorAll('.uft-mode-btn')[idx].classList.add('active');
        }

        // ── DYNAMIC ACCENT COLOUR ─────────────────────────────────────────
        const colors = { focus: '#00f3ff', short: '#00ffa3', long: '#ff0055' };
        const root   = this.dom.root.style;
        root.setProperty('--accent', colors[mode]);

        // Derive an RGBA glow value from the hex colour for box-shadow effects
        const rgb = this.hexToRgb(colors[mode]);
        root.setProperty('--accent-glow', `rgba(${rgb}, 0.6)`);

        // ── TIMER RESET ───────────────────────────────────────────────────
        // config[mode] holds the user-configured minute value; fallback to 25.
        this.state.totalTime = (this.config[mode] || 25) * 60;
        this.state.timeLeft  = this.state.totalTime;
        this.updateDisplay();

        // ── RESET MAIN BUTTON APPEARANCE ──────────────────────────────────
        this.dom.startBtn.innerText         = "INITIATE SEQUENCE";
        this.dom.startBtn.style.background  = getComputedStyle(document.body).getPropertyValue('--text-main');
        this.dom.startBtn.style.color       = getComputedStyle(document.body).getPropertyValue('--bg-deep');
        this.dom.startBtn.style.border      = "none";
    }

    // =========================================================================
    //  SECTION 6 — UTILS, DATA & SECURITY
    // =========================================================================

    /**
     * Requests the Screen Wake Lock API to prevent the device screen from
     * dimming or locking during an active focus session. This is especially
     * important on mobile where screens timeout quickly.
     * Silently catches errors on unsupported browsers (non-critical).
     *
     * @async
     */
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (e) {
                // Wake Lock not granted (e.g., battery saver mode) — non-critical
                console.log('Wake Lock Error (Non-Critical)', e);
            }
        }
    }

    /**
     * Releases the Screen Wake Lock, allowing the device to sleep normally
     * when the timer is paused or a session completes.
     */
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    /**
     * Awards XP points to the user, saves to localStorage, recalculates the
     * level (300 XP per level), and updates the level display in the badge.
     * Briefly triggers a CSS animation on the badge to provide tactile feedback.
     *
     * @param {number} amount - Number of XP points to award.
     */
    addXP(amount) {
        let xp = parseInt(localStorage.getItem('ultraXP_v4')) || 0;
        xp += amount;
        localStorage.setItem('ultraXP_v4', xp);

        // Level formula: every 300 XP grants one level
        const lvl = Math.floor(xp / 300) + 1;
        document.getElementById('userLevel').innerText = lvl;

        // Brief animation on the badge to signal the XP gain
        const badge = document.querySelector('.uft-level-badge');
        badge.style.animation = "orbFloat 0.5s ease";
        setTimeout(() => badge.style.animation = "", 500);
    }

    /**
     * Loads the persisted XP value from localStorage and updates the level
     * badge on initial page load to restore the user's progress.
     */
    loadUserData() {
        const xp = parseInt(localStorage.getItem('ultraXP_v4')) || 0;
        document.getElementById('userLevel').innerText = Math.floor(xp / 300) + 1;
    }

    /**
     * Checks and updates the user's consecutive daily streak.
     * A streak is incremented if the last visit was yesterday; reset to 1
     * if more than one day has passed; maintained if already visited today.
     * Displays a streak notification 2 seconds after page load.
     */
    checkStreak() {
        const today  = new Date().toDateString();
        const last   = localStorage.getItem('lastVisit_v4');
        let streak   = parseInt(localStorage.getItem('streak_v4')) || 0;

        if (last !== today) {
            // Calculate yesterday's date string for streak continuation check
            const yest = new Date();
            yest.setDate(yest.getDate() - 1);

            if (last === yest.toDateString()) {
                streak++; // Consecutive day — increment streak
            } else {
                streak = 1; // Gap detected — reset streak
            }

            localStorage.setItem('lastVisit_v4', today);
            localStorage.setItem('streak_v4', streak);

            // Delay the notification slightly so it doesn't fire during page init
            setTimeout(() => this.notify(`Daily Streak: ${streak} Days! 🔥`), 2000);
        }
    }

    /**
     * Sanitises a raw user-supplied string to prevent XSS injection
     * when rendering task text into the DOM via innerHTML.
     * Converts special HTML characters to their entity equivalents.
     *
     * @param   {string} str - Raw input string from user.
     * @returns {string}     Safe HTML-encoded string.
     */
    sanitize(str) {
        const temp     = document.createElement('div');
        temp.innerText = str;          // Browser handles entity encoding
        return temp.innerHTML;         // Return the safely escaped string
    }

    /**
     * Converts a CSS hex colour string to an "R, G, B" formatted string
     * suitable for use inside rgba() function calls.
     *
     * @param   {string} hex - Hex colour string (e.g., "#00f3ff").
     * @returns {string}     RGB components as a comma-separated string (e.g., "0, 243, 255").
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
            : '255,255,255'; // Fallback to white if parsing fails
    }

    /**
     * Internal notification wrapper.
     * All notify() calls throughout the class delegate to window.showToast()
     * so that the global toast system (injected by global.js) handles all
     * UI rendering, timing, and positioning.
     *
     * @param {string}  msg     - The message string to display.
     * @param {boolean} [isError=false] - Pass true for error/warning toasts (red variant).
     */
    notify(msg, isError = false) {
        window.showToast(msg, isError);
    }

    // =========================================================================
    //  SECTION 7 — TASK MANAGER (XSS-SAFE)
    //  Full CRUD for the Mission Log task list.
    //  Tasks are stored in localStorage as a JSON array.
    //  All rendered text passes through sanitize() before being set in innerHTML.
    // =========================================================================

    /**
     * Renders the complete task list from localStorage into the #taskList <ul>.
     * Clears the current list and re-renders on every mutation to keep the UI
     * in sync with the data source.
     *
     * Each task item includes:
     *   • A checkbox icon (fa-circle / fa-check-circle) toggled by JS
     *   • Sanitised task text
     *   • A trash icon for deletion
     *   • Inline onclick handlers calling app.toggleTask(i) / app.delTask(i)
     */
    renderTasks() {
        const tasks = JSON.parse(localStorage.getItem('ultraTasks_v4')) || [];
        const list  = this.dom.taskList;
        list.innerHTML = "";
        let done = 0;

        tasks.forEach((t, i) => {
            if (t.completed) done++;

            // Create list item with appropriate completed state class
            const li       = document.createElement('li');
            li.className   = `task-item ${t.completed ? 'completed' : ''}`;

            // Build innerHTML using sanitize() to prevent XSS from user-entered text
            li.innerHTML = `
                <div style="display:flex; align-items:center; width:100%" onclick="app.toggleTask(${i})">
                    <i class="far ${t.completed ? 'fa-check-circle' : 'fa-circle'}"
                       style="color:${t.completed ? 'var(--status-text-success)' : 'var(--text-muted)'}; margin-right:12px;"></i>
                    <span>${this.sanitize(t.text)}</span>
                </div>
                <i class="fas fa-trash"
                   onclick="event.stopPropagation(); app.delTask(${i})"
                   style="opacity:0.3; padding:5px; font-size:0.8rem; cursor:pointer;"></i>
            `;
            list.appendChild(li);
        });

        // Update the "done/total" counter in the panel header
        document.getElementById('completedCount').innerText = `${done}/${tasks.length}`;
    }

    /**
     * Reads the text input value, trims whitespace, and appends a new task
     * object to the localStorage array if the value is non-empty.
     * Raw text is stored; sanitisation happens at render time.
     */
    addTask() {
        const inp = document.getElementById('taskInput');
        const val = inp.value.trim();

        if (val) {
            const tasks = JSON.parse(localStorage.getItem('ultraTasks_v4')) || [];
            tasks.push({ text: val, completed: false }); // Store raw; sanitise on render
            localStorage.setItem('ultraTasks_v4', JSON.stringify(tasks));
            inp.value = ""; // Clear input after adding
            this.renderTasks();
        }
    }

    /**
     * Toggles the completed state of the task at the given index.
     * Awards 20 XP when a task is marked as complete.
     *
     * @param {number} i - Zero-based index of the task in the localStorage array.
     */
    toggleTask(i) {
        const tasks         = JSON.parse(localStorage.getItem('ultraTasks_v4')) || [];
        tasks[i].completed  = !tasks[i].completed;
        if (tasks[i].completed) this.addXP(20); // Reward task completion with XP
        localStorage.setItem('ultraTasks_v4', JSON.stringify(tasks));
        this.renderTasks();
    }

    /**
     * Permanently removes the task at the given index from localStorage
     * and re-renders the task list.
     *
     * @param {number} i - Zero-based index of the task to remove.
     */
    delTask(i) {
        const tasks = JSON.parse(localStorage.getItem('ultraTasks_v4')) || [];
        tasks.splice(i, 1);
        localStorage.setItem('ultraTasks_v4', JSON.stringify(tasks));
        this.renderTasks();
    }

    // =========================================================================
    //  SECTION 8 — STATISTICS
    //  Tracks and renders a 7-day weekly focus bar chart.
    // =========================================================================

    /**
     * Appends completed focus minutes to today's slot in the weekly stats array.
     * The array index corresponds to the JavaScript day of week (0 = Sunday).
     * Re-renders the chart if the stats panel is currently visible.
     *
     * @param {number} min - Minutes of focus time to log for today.
     */
    logStats(min) {
        const stats   = JSON.parse(localStorage.getItem('ultraStats_v4')) || [0,0,0,0,0,0,0];
        const day     = new Date().getDay(); // 0 = Sunday … 6 = Saturday
        stats[day]   += parseInt(min);
        localStorage.setItem('ultraStats_v4', JSON.stringify(stats));

        // Immediately update the chart if the stats panel is open
        if (this.state.statsVisible) this.renderStats();
    }

    /**
     * Renders the weekly statistics as a proportional bar chart inside #statsRow.
     * Each bar height is calculated as a percentage of the maximum recorded value
     * (with a floor of 60 to prevent all-zero sessions showing full-height bars).
     * Today's bar receives the .today class for accent colour highlighting.
     */
    renderStats() {
        const container = document.getElementById('statsRow');
        container.innerHTML = '';

        const stats = JSON.parse(localStorage.getItem('ultraStats_v4')) || [0,0,0,0,0,0,0];
        const max   = Math.max(...stats, 60); // Floor of 60 minutes prevents visual glitches

        // Display aggregate weekly focus time in the panel header
        document.getElementById('totalFocusTime').innerText =
            stats.reduce((a, b) => a + b, 0) + "m";

        stats.forEach((val, i) => {
            const h   = (val / max) * 100; // Bar height as percentage of max
            const div = document.createElement('div');

            // Highlight today's bar with .today accent colour class
            div.className  = `stat-bar ${i === new Date().getDay() ? 'today' : ''}`;
            div.style.height = `${h}%`;
            container.appendChild(div);
        });
    }

    // =========================================================================
    //  SECTION 9 — EVENT BINDING
    //  All DOM event listeners are registered here once during construction.
    //  Centralising event binding in a single method makes it easy to audit
    //  and ensures no duplicate listeners are attached.
    // =========================================================================

    /**
     * Registers all DOM event listeners for the application.
     * Called once from the constructor after all DOM references are mapped.
     */
    initEvents() {

        // ── PRIMARY TIMER BUTTON ──────────────────────────────────────────
        this.dom.startBtn.addEventListener('click', () => this.toggleTimer());

        // ── MODE SELECTOR BUTTONS ─────────────────────────────────────────
        // data-mode attribute drives which mode to activate (focus / short / long)
        document.querySelectorAll('.uft-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchMode(e.target.dataset.mode));
        });

        // ── AUDIO CONTROLS ────────────────────────────────────────────────
        document.getElementById('soundBtn').addEventListener('click', () => this.toggleSound());
        document.getElementById('binauralBtn').addEventListener('click', () => this.toggleBinaural());
        document.getElementById('volumeControl').addEventListener('input',
            (e) => this.updateVolume(e.target.value)
        );

        // ── TASK MANAGER ──────────────────────────────────────────────────
        document.getElementById('addTaskBtn').addEventListener('click', () => this.addTask());
        // Allow submitting tasks by pressing Enter in the input field
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // ── STATISTICS PANEL TOGGLE ───────────────────────────────────────
        // Toggles between the task panel and the stats bar chart panel.
        document.getElementById('statsBtn').addEventListener('click', () => {
            this.state.statsVisible = !this.state.statsVisible;
            document.getElementById('taskPanel').style.display  = this.state.statsVisible ? 'none' : 'block';
            document.getElementById('statsPanel').style.display = this.state.statsVisible ? 'block' : 'none';
            if (this.state.statsVisible) this.renderStats(); // Render chart immediately on show
        });

        // ── SETTINGS MODAL ────────────────────────────────────────────────
        // Open: click settingsBtn toggles .open class on the modal overlay.
        document.getElementById('settingsBtn').addEventListener('click', () =>
            document.getElementById('settingsModal').classList.toggle('open')
        );
        // Close: click the backdrop (not the card) to dismiss.
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') e.target.classList.remove('open');
        });

        // Save Configuration: read input values, persist to localStorage,
        // close the modal, and apply the new focus duration immediately.
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.config.focus     = parseInt(document.getElementById('focusTimeInput').value) || 25;
            this.config.soundType = document.getElementById('soundType').value;
            localStorage.setItem('ultraConfig_v4', JSON.stringify(this.config));
            document.getElementById('settingsModal').classList.remove('open');
            this.switchMode(this.state.currentMode); // Re-apply with new duration
            this.notify("Configuration Saved");
        });

        // ── ZEN / FULLSCREEN MODE ─────────────────────────────────────────
        // Requests browser fullscreen; exits if already in fullscreen.
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        // ── BREATHING EXERCISE MODAL ──────────────────────────────────────
        document.getElementById('zenBtn').addEventListener('click', () => {
            const m = document.getElementById('breathModal');
            m.classList.toggle('open');
            if (m.classList.contains('open')) {
                this.notify("Breathing Started");
            }
        });
        // Close: click the backdrop to dismiss
        document.getElementById('breathModal').addEventListener('click', (e) => {
            if (e.target.id === 'breathModal') e.target.classList.remove('open');
        });

        // ── XP BADGE CLICK ────────────────────────────────────────────────
        // Displays the user's total accumulated XP in a toast notification.
        document.getElementById('xpBadgeBtn').addEventListener('click', () => {
            const xp = parseInt(localStorage.getItem('ultraXP_v4')) || 0;
            this.notify(`Total XP: ${xp}`);
        });

        // ── VISIBILITY API (TAB SWITCHING / MOBILE BACKGROUNDING) ────────
        // When the tab becomes visible again while the timer is running,
        // re-request Wake Lock and resume a suspended AudioContext (some
        // browsers suspend audio when the tab is hidden on mobile).
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.state.isRunning) {
                this.requestWakeLock();
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
            }
        });
    }
}

// =============================================================================
//  INSTANTIATE APPLICATION
//  Creating the singleton instance kicks off the constructor which binds all
//  events, loads user data, and renders the initial UI. The global `app`
//  reference is required by inline onclick handlers in renderTasks() HTML.
// =============================================================================
const app = new UltraFocusEngine();

// =============================================================================
//  ENTRANCE ANIMATION
//  Triggered on window.onload to ensure all assets are ready.
//  Fades the main container from opacity:0 / scale:0.95 to fully visible,
//  creating a smooth holographic "materialise" effect.
// =============================================================================
window.onload = () => {
    const c         = document.getElementById('appContainer');
    // Start from invisible, slightly scaled-down state
    c.style.opacity   = 0;
    c.style.transform = 'scale(0.95)';
    c.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';

    // Brief delay lets the browser paint the initial state before animating
    setTimeout(() => {
        c.style.opacity   = 1;
        c.style.transform = 'scale(1)';
    }, 100);
};
