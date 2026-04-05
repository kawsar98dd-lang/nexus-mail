/**
 * =============================================================================
 *  Frequency Gen Ultra — Advanced Audio Engine  (v2.0 Refactored)
 *  File    : script.js
 *  Author  : MD KAWSAR
 *  Product : Trusted Tools Web — CodeCanyon Release Build
 * =============================================================================
 *
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────
 *  All audio logic is encapsulated inside the `AudioEngine` class to ensure:
 *    - Proper memory management (no global leaky variables)
 *    - Clean separation between audio processing and DOM interaction
 *    - A single `app` instance accessible from HTML onclick attributes
 *
 *  AUDIO GRAPH  (Web Audio API signal flow)
 *  ─────────────────────────────────────────
 *  Source (Oscillator / Noise Buffer)
 *    → [LFO GainNode] (optional, Manual mode only)
 *    → [Biquad LowPass Filter] (Pink / Brown noise only)
 *    → masterGain   (amplitude control + anti-pop envelope)
 *    → compressor   (dynamics compressor — prevents clipping)
 *    → analyser     (provides waveform / FFT data for the visualizer)
 *    → ctx.destination  (speakers / headphones)
 *    → destStream       (MediaRecorder input for in-browser recording)
 *
 *  MODES
 *  ──────
 *  1. Manual   — Single oscillator with selectable waveform and optional LFO
 *  2. Sweep    — Single oscillator that ramps frequency from start → end Hz
 *  3. Binaural — Two oscillators panned hard left/right (stereo headphones required)
 *  4. Noise    — BufferSource with white, pink (lowpass 500 Hz), or brown (lowpass 150 Hz) noise
 *
 *  GLOBAL TOAST SYSTEM
 *  ─────────────────────
 *  All user notifications are routed through the global window.showToast() function
 *  injected by global.js. Error toasts pass `true` as the second argument.
 * =============================================================================
 */

"use strict";

/* =============================================================================
   CLASS: AudioEngine
   ─────────────────────────────────────────────────────────────────────────────
   The single class responsible for all audio generation, visualizer rendering,
   recording, and UI state management.
   An instance is created at the bottom of this file as `const app`.
============================================================================= */
class AudioEngine {

    /**
     * constructor()
     * ─────────────
     * Initialises all state, parameter defaults, and DOM element references.
     * Does NOT create the AudioContext here — that is deferred to the first
     * user interaction to comply with browser auto-play policies.
     */
    constructor() {

        /* ── Audio API context placeholder ──────────────────────────────── */
        this.ctx = null;

        /* ── Audio Node references (populated during play()) ─────────────
           Kept on a single object so they can be iterated and cleaned up
           systematically by stopInternal().                               */
        this.nodes = {};

        /* ── Synthesis parameters ────────────────────────────────────────
           These values are the "source of truth" for the current signal.
           They are updated by every setter method.                        */
        this.params = {
            freq     : 440,      // Oscillator frequency in Hz (Manual mode)
            wave     : 'sine',   // OscillatorNode.type for Manual mode
            vol      : 0.5,      // Master gain (0.0 – 1.0, before waveform compensation)
            lfoRate  : 5,        // LFO oscillation speed in Hz
            lfoDepth : 30,       // LFO depth (maps to ±Hz cents of pitch deviation)
            binBase  : 200,      // Binaural base frequency fed to the left ear (Hz)
            binBeat  : 4,        // Binaural beat difference fed to the right ear (Hz)
            noiseType: 'white',  // Active noise colour: 'white' | 'pink' | 'brown'
            isLFO    : false     // Whether the LFO modulator is currently active
        };

        /* ── Application state ───────────────────────────────────────────
           Tracks runtime conditions that affect UI and audio behaviour.   */
        this.state = {
            isPlaying  : false,       // True while any audio source is outputting sound
            isRecording: false,       // True while MediaRecorder is capturing
            mode       : 'manual',    // Active tab: 'manual'|'sweep'|'binaural'|'noise'
            vizType    : 'wave',      // Visualizer display: 'wave' (oscilloscope) | 'bar' (FFT)
            recorder   : null,        // Active MediaRecorder instance (or null)
            chunks     : [],          // Recorded audio Blob chunks array
            sweepTimer : null         // setTimeout handle for auto-stopping after sweep duration
        };

        /* ── DOM element cache ───────────────────────────────────────────
           All getElementById calls are made once in the constructor and
           stored here to avoid repeated DOM lookups during animation frames.
           NOTE: These id values MUST match the HTML exactly.              */
        this.el = {
            canvas      : document.getElementById('visualizer'),
            ctx         : document.getElementById('visualizer').getContext('2d'),
            playBtn     : document.getElementById('mainPlayBtn'),
            hzDisplay   : document.getElementById('hzDisplay'),
            unitDisplay : document.getElementById('unitDisplay'),
            freqSlider  : document.getElementById('freqSlider'),
            freqValSmall: document.getElementById('freqValSmall'),
            recBtn      : document.getElementById('recordBtn'),
            lfoToggle   : document.getElementById('lfoToggle')
        };

        /* ── Animation frame handle ──────────────────────────────────────
           Used to track the requestAnimationFrame ID so the visualizer
           loop can be cleanly cancelled when audio stops.                */
        this.animationId = null;

        /* ── Bootstrap ───────────────────────────────────────────────────
           Attach resize listener, size canvas, and set initial display.  */
        this.initListeners();
    }

    /* =========================================================================
       METHOD: initAudioContext()
       ─────────────────────────
       Creates the Web Audio API context and builds the permanent node graph
       on first call. Subsequent calls only resume a suspended context.
       This deferred creation satisfies Chrome/Safari's autoplay policy which
       requires AudioContext creation to happen inside a user gesture.
    ========================================================================= */
    initAudioContext() {
        if (!this.ctx) {
            /* Support both standard and webkit-prefixed AudioContext */
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            /* ── Dynamics Compressor ────────────────────────────────────
               Prevents hard clipping at the output while allowing
               the perceived loudness to remain high.                    */
            this.nodes.compressor = this.ctx.createDynamicsCompressor();
            this.nodes.compressor.threshold.value = -1;   // Compress almost everything above
            this.nodes.compressor.knee.value      = 40;   // Soft knee for natural-sounding gain reduction
            this.nodes.compressor.ratio.value     = 12;   // 12:1 ratio = near limiting
            this.nodes.compressor.attack.value    = 0;    // Instant attack to catch transients
            this.nodes.compressor.release.value   = 0.25; // 250 ms release

            /* ── Master Gain Node ───────────────────────────────────────
               Starts at zero; an exponential ramp to the target volume
               is applied during play() to prevent an audible click.     */
            this.nodes.masterGain             = this.ctx.createGain();
            this.nodes.masterGain.gain.value  = 0;

            /* ── Analyser Node ──────────────────────────────────────────
               FFT size of 2048 gives 1024 frequency bins — enough
               resolution for a clear bar chart without excessive CPU.
               A high smoothingTimeConstant (0.85) makes the visualizer
               motion feel fluid and not twitchy.                        */
            this.nodes.analyser                          = this.ctx.createAnalyser();
            this.nodes.analyser.fftSize                  = 2048;
            this.nodes.analyser.smoothingTimeConstant    = 0.85;

            /* ── Media Stream Destination ───────────────────────────────
               Provides a live MediaStream of the audio output so that
               MediaRecorder can capture it for in-browser recording.    */
            this.nodes.destStream = this.ctx.createMediaStreamDestination();

            /* ── Connect the permanent graph ────────────────────────────
               Source nodes are connected to masterGain transiently.
               The rest of the chain is permanent.                       */
            this.nodes.masterGain.connect(this.nodes.compressor);
            this.nodes.compressor.connect(this.nodes.analyser);
            this.nodes.analyser.connect(this.ctx.destination);   // Speakers
            this.nodes.analyser.connect(this.nodes.destStream);  // Recorder
        }

        /* Resume a suspended context (e.g., after a page visibility change) */
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /* =========================================================================
       METHOD: play()
       ─────────────
       Initialises the AudioContext (if needed), cleans up any existing source
       nodes, then creates and starts the appropriate source for the active mode.
       Volume compensation is applied per waveform type to normalise perceived
       loudness before the final master gain ramp.
    ========================================================================= */
    play() {
        this.initAudioContext();
        const t = this.ctx.currentTime;

        /* Tear down any previous oscillators / noise sources cleanly */
        this.stopInternal(t);

        /*
         * Waveform Volume Compensation Factor
         * ─────────────────────────────────────
         * Square and Sawtooth waves have a higher RMS energy than Sine and
         * Triangle waves at the same peak amplitude. Without compensation they
         * would sound painfully loud. The factor is applied to masterGain below.
         */
        let gainMult = 1.0;

        /* ── MODE 1: MANUAL ─────────────────────────────────────────────── */
        if (this.state.mode === 'manual') {
            const osc   = this.ctx.createOscillator();
            osc.type    = this.params.wave;
            osc.frequency.setValueAtTime(this.params.freq, t);

            /* Reduce gain for harmonically rich waveforms */
            if (['square', 'sawtooth'].includes(this.params.wave)) gainMult = 0.6;

            /* ── Optional LFO (pitch vibrato / siren) ──────────────────
               An LFO oscillator whose output is scaled by lfoGain and
               connected to the main oscillator's frequency AudioParam.
               This modulates the frequency over time, creating vibrato. */
            if (this.params.isLFO) {
                const lfo     = this.ctx.createOscillator();
                const lfoGain = this.ctx.createGain();

                lfo.frequency.value  = this.params.lfoRate;
                lfoGain.gain.value   = this.params.lfoDepth * 5; // Scale depth to audible Hz deviation

                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency); // Modulate the main oscillator's pitch

                lfo.start(t);
                this.nodes.oscLFO  = lfo;
                this.nodes.lfoGain = lfoGain;
            }

            osc.connect(this.nodes.masterGain);
            osc.start(t);
            this.nodes.osc1 = osc; // Store reference for frequency updates & cleanup
        }

        /* ── MODE 2: SWEEP ──────────────────────────────────────────────── */
        else if (this.state.mode === 'sweep') {
            const osc   = this.ctx.createOscillator();
            osc.type    = 'sine'; // Pure sine for accurate acoustic testing

            /* Read user-defined sweep parameters from the DOM */
            let start   = parseFloat(document.getElementById('sweepStart').value) || 20;
            let end     = parseFloat(document.getElementById('sweepEnd').value)   || 20000;
            const dur   = parseFloat(document.getElementById('sweepTime').value)  || 10;

            /*
             * Safety clamping for exponentialRampToValueAtTime()
             * — the Web Audio spec does NOT allow zero or negative values
             *   in an exponential ramp; they would throw an InvalidStateError.
             */
            start = Math.max(0.1, start);
            end   = Math.max(0.1, end);

            osc.frequency.setValueAtTime(start, t);
            osc.frequency.exponentialRampToValueAtTime(end, t + dur); // Logarithmic sweep

            osc.connect(this.nodes.masterGain);
            osc.start(t);
            this.nodes.osc1 = osc;

            /* Auto-stop after the sweep duration completes */
            this.state.sweepTimer = setTimeout(() => {
                if (this.state.isPlaying) this.stop();
            }, dur * 1000);
        }

        /* ── MODE 3: BINAURAL ───────────────────────────────────────────── */
        else if (this.state.mode === 'binaural') {
            /*
             * Two independent oscillators — one panned hard left, one hard right.
             * The browser's audio engine mixes them, but at slightly different
             * frequencies. The brain interprets the difference as a third "beat"
             * frequency (e.g., 200 Hz Left + 204 Hz Right = 4 Hz perceived beat).
             */
            const oscL  = this.ctx.createOscillator();
            const oscR  = this.ctx.createOscillator();
            const panL  = this.ctx.createStereoPanner();
            const panR  = this.ctx.createStereoPanner();

            oscL.frequency.value = this.params.binBase;
            panL.pan.value       = -1; // Hard left

            oscR.frequency.value = parseFloat(this.params.binBase) + parseFloat(this.params.binBeat);
            panR.pan.value       = 1;  // Hard right

            oscL.connect(panL).connect(this.nodes.masterGain);
            oscR.connect(panR).connect(this.nodes.masterGain);

            oscL.start(t);
            oscR.start(t);

            /* Store both oscillators for live frequency updates */
            this.nodes.osc1 = oscL;
            this.nodes.osc2 = oscR;
        }

        /* ── MODE 4: NOISE ──────────────────────────────────────────────── */
        else if (this.state.mode === 'noise') {
            /*
             * White noise is generated by filling a PCM buffer with uniformly
             * distributed random samples in the range [–1, +1].
             * A 2-second buffer is looped to avoid audible repetition artefacts.
             */
            const bufSize   = this.ctx.sampleRate * 2; // 2 sec × sampleRate samples
            const buffer    = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data      = buffer.getChannelData(0);

            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

            const noise     = this.ctx.createBufferSource();
            noise.buffer    = buffer;
            noise.loop      = true; // Loop indefinitely until stopped

            if (this.params.noiseType !== 'white') {
                /*
                 * Pink & Brown noise approximation via a lowpass biquad filter.
                 *   Pink  → lowpass at 500 Hz — reduces HF energy with –3 dB/octave slope
                 *   Brown → lowpass at 150 Hz — much heavier HF roll-off (deeper rumble)
                 * After filtering, the gain is boosted (3.5×) to restore perceived loudness.
                 */
                const filter          = this.ctx.createBiquadFilter();
                filter.type           = 'lowpass';
                filter.frequency.value = (this.params.noiseType === 'pink') ? 500 : 150;
                noise.connect(filter).connect(this.nodes.masterGain);
                gainMult = 3.5; // Compensate for filtered energy reduction
            } else {
                /* White noise — connect directly; reduce gain slightly as it is harsh */
                noise.connect(this.nodes.masterGain);
                gainMult = 0.5;
            }

            noise.start(t);
            this.nodes.noise = noise; // Store for cleanup
        }

        /* ── ANTI-POP AMPLITUDE ENVELOPE ────────────────────────────────────
         * Instead of hard-jumping the gain from 0 to the target level (which
         * creates an audible "pop" or click), we use an exponential approach
         * via setTargetAtTime(). The time constant of 0.02 s means the gain
         * reaches ≈63 % of its target in 20 ms — smooth and inaudible.
         */
        this.nodes.masterGain.gain.cancelScheduledValues(t);
        this.nodes.masterGain.gain.setValueAtTime(0, t);
        this.nodes.masterGain.gain.setTargetAtTime(this.params.vol * gainMult, t, 0.02);

        /* Mark as playing and update UI / start visualizer */
        this.state.isPlaying = true;
        this.updateUI();
        if (!this.animationId) this.drawVisualizer();
    }

    /* =========================================================================
       METHOD: stop()
       ─────────────
       Fades out the master gain smoothly (anti-pop), then tears down all
       active source nodes after a short delay. Also cancels the sweep timer
       and stops any active recording.
    ========================================================================= */
    stop() {
        if (!this.ctx || !this.state.isPlaying) return;
        const t = this.ctx.currentTime;

        /* ── Smooth fade-out envelope ──────────────────────────────────────
         * setTargetAtTime(0, t, 0.03) decays the gain to near-zero in ~30 ms.
         * This prevents the audible "click" that occurs when a source node is
         * disconnected while the waveform is at a non-zero amplitude.
         */
        this.nodes.masterGain.gain.cancelScheduledValues(t);
        this.nodes.masterGain.gain.setValueAtTime(this.nodes.masterGain.gain.value, t);
        this.nodes.masterGain.gain.setTargetAtTime(0, t, 0.03);

        /* Wait for the fade to complete before stopping source nodes */
        setTimeout(() => {
            this.stopInternal();
            this.state.isPlaying = false;
            this.updateUI();
        }, 150);

        /* Cancel any pending sweep auto-stop timer */
        if (this.state.sweepTimer) {
            clearTimeout(this.state.sweepTimer);
            this.state.sweepTimer = null;
        }

        /* If recording is in progress, stop it cleanly */
        if (this.state.isRecording) this.toggleRecord();
    }

    /* =========================================================================
       METHOD: stopInternal()
       ──────────────────────
       Iterates over all transient audio source node references (oscillators,
       LFO, noise) and safely calls .stop() + .disconnect() on each.
       Errors are silently swallowed because nodes may already be in a stopped
       state if the sweep timer auto-stopped them.
    ========================================================================= */
    stopInternal() {
        ['osc1', 'osc2', 'oscLFO', 'noise'].forEach(key => {
            if (this.nodes[key]) {
                try {
                    this.nodes[key].stop();
                    this.nodes[key].disconnect();
                } catch (e) {
                    /* Ignore InvalidStateError — node was already stopped */
                }
                this.nodes[key] = null;
            }
        });
    }

    /* =========================================================================
       METHOD: togglePlay()
       ─────────────────────
       Called by the main Play/Stop button's onclick handler.
       Delegates to play() or stop() based on the current state.
    ========================================================================= */
    togglePlay() {
        this.state.isPlaying ? this.stop() : this.play();
    }

    /* =========================================================================
       PARAMETER SETTER: updateFreq(val)
       ────────────────────────────────────
       Updates the oscillator frequency from the slider or fine-tune buttons.
       If audio is playing in Manual mode, the frequency is transitioned
       smoothly using setTargetAtTime() to avoid a harsh pitch jump.
       @param {string|number} val — New frequency value in Hz (1–22000).
    ========================================================================= */
    updateFreq(val) {
        this.params.freq = parseFloat(val);

        /* Update the inline label beside the slider */
        this.el.freqValSmall.innerText = this.params.freq + " Hz";

        if (this.state.mode === 'manual') {
            /* Refresh the large Hz readout on the visualizer */
            this.updateDisplay(this.params.freq, 'Hz');

            /* Smoothly glide the live oscillator to the new frequency */
            if (this.state.isPlaying && this.nodes.osc1) {
                this.nodes.osc1.frequency.setTargetAtTime(
                    this.params.freq,
                    this.ctx.currentTime,
                    0.05 // 50 ms glide time — fast enough to be responsive
                );
            }
        }
    }

    /* =========================================================================
       PARAMETER SETTER: setVolume(val)
       ────────────────────────────────────
       Adjusts the master gain in real-time while audio is playing.
       Re-applies the waveform / noise type compensation factor so that
       perceived loudness remains consistent across all modes.
       @param {string|number} val — New volume value (0.0 – 1.0).
    ========================================================================= */
    setVolume(val) {
        this.params.vol = parseFloat(val);

        if (this.state.isPlaying && this.nodes.masterGain) {
            /* Re-compute the compensation multiplier for the current mode */
            let mod = 1.0;
            if (this.state.mode === 'manual' &&
                ['square', 'sawtooth'].includes(this.params.wave)) {
                mod = 0.6;
            }
            if (this.state.mode === 'noise') {
                mod = (this.params.noiseType === 'white') ? 0.5 : 3.5;
            }

            /* Smooth gain transition — 100 ms time constant */
            this.nodes.masterGain.gain.setTargetAtTime(
                this.params.vol * mod,
                this.ctx.currentTime,
                0.1
            );
        }
    }

    /* =========================================================================
       METHOD: setMode(mode, btn)
       ─────────────────────────
       Switches the active tab mode. Stops any current audio, swaps CSS active
       states on the tab buttons, shows/hides the correct panel, and updates
       the Hz overlay to reflect the new mode context.
       @param {string}          mode — One of: 'manual'|'sweep'|'binaural'|'noise'
       @param {HTMLButtonElement} btn — The tab button element that was clicked
    ========================================================================= */
    setMode(mode, btn) {
        /* Stop current audio before switching contexts */
        if (this.state.isPlaying) this.stop();
        this.state.mode = mode;

        /* Update tab button active state */
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        /* Show only the panel that matches the selected mode */
        ['manual', 'sweep', 'binaural', 'noise'].forEach(id => {
            document.getElementById('panel-' + id).classList.add('hidden');
        });
        document.getElementById('panel-' + mode).classList.remove('hidden');

        /* Update the Hz overlay readout with context-specific text */
        const displayMap = {
            manual  : { v: this.params.freq, u: 'Hz'   },
            sweep   : { v: 'SWEEP',          u: 'RUN'  },
            binaural: { v: 'BRAIN',          u: 'WAVE' },
            noise   : { v: 'NOISE',          u: 'GEN'  }
        };
        this.updateDisplay(displayMap[mode].v, displayMap[mode].u);
    }

    /* =========================================================================
       METHOD: setWave(type, btn)
       ─────────────────────────
       Changes the OscillatorNode waveform type.
       If audio is playing, the oscillator is restarted (brief 160 ms pause)
       because OscillatorNode.type cannot be changed while the node is running
       without an audible artefact.
       @param {string}          type — 'sine'|'square'|'sawtooth'|'triangle'
       @param {HTMLButtonElement} btn — The waveform button that was clicked
    ========================================================================= */
    setWave(type, btn) {
        this.params.wave = type;

        /* Update waveform button active state */
        document.querySelectorAll('.fgu-wave-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        /* Restart audio cleanly to apply the new waveform type */
        if (this.state.isPlaying && this.state.mode === 'manual') {
            this.stop();
            setTimeout(() => this.play(), 160);
        }
    }

    /* =========================================================================
       METHOD: setNoise(type, btn)
       ─────────────────────────────
       Switches the active noise colour. If playing, restarts the noise buffer
       to apply the new filter parameters immediately.
       @param {string}          type — 'white'|'pink'|'brown'
       @param {HTMLButtonElement} btn — The noise button that was clicked
    ========================================================================= */
    setNoise(type, btn) {
        this.params.noiseType = type;

        /* Update noise type button active state (scoped to noise panel) */
        document.querySelectorAll('#panel-noise .fgu-wave-btn')
                .forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        /* Restart to rebuild buffer with new filter config */
        if (this.state.isPlaying && this.state.mode === 'noise') {
            this.stop();
            setTimeout(() => this.play(), 160);
        }
    }

    /* =========================================================================
       METHOD: toggleLFO()
       ─────────────────────
       Enables or disables Low-Frequency Oscillation (pitch modulation).
       Updates the toggle button UI and restarts audio if currently playing
       so the LFO node is added to (or removed from) the graph.
    ========================================================================= */
    toggleLFO() {
        this.params.isLFO = !this.params.isLFO;

        /* Update toggle button label and visual active state */
        this.el.lfoToggle.innerHTML = this.params.isLFO
            ? '<i class="fa-solid fa-bolt"></i> ON'
            : '<i class="fa-solid fa-power-off"></i> OFF';
        this.el.lfoToggle.classList.toggle('active', this.params.isLFO);

        /* Restart to rebuild the audio graph with/without the LFO node */
        if (this.state.isPlaying && this.state.mode === 'manual') {
            this.stop();
            setTimeout(() => this.play(), 160);
        }
    }

    /* =========================================================================
       METHOD: updateLFO(key, val)
       ────────────────────────────
       Updates LFO rate or depth in real-time. If the LFO nodes exist
       (audio is playing with LFO active), parameters are applied immediately
       via AudioParam scheduling for zero-latency response.
       @param {string}        key — 'rate' or 'depth'
       @param {string|number} val — New numeric value for the parameter
    ========================================================================= */
    updateLFO(key, val) {
        val = parseFloat(val);

        if (key === 'rate') {
            this.params.lfoRate = val;
            /* Live update of the LFO oscillator's speed */
            if (this.nodes.oscLFO) {
                this.nodes.oscLFO.frequency.setTargetAtTime(
                    val,
                    this.ctx.currentTime,
                    0.1
                );
            }
        } else {
            /* key === 'depth' */
            this.params.lfoDepth = val;
            /* Live update of the LFO gain (depth) */
            if (this.nodes.lfoGain) {
                this.nodes.lfoGain.gain.setTargetAtTime(
                    val * 5,
                    this.ctx.currentTime,
                    0.1
                );
            }
        }
    }

    /* =========================================================================
       METHOD: updateBinaural(val, key)
       ─────────────────────────────────
       Updates the base frequency or beat difference for Binaural mode.
       Refreshes the corresponding display label and, if audio is playing,
       smoothly transitions both oscillators to the new frequencies.
       @param {string|number} val — New Hz value
       @param {string}        key — 'base' (left ear) or 'beat' (difference)
    ========================================================================= */
    updateBinaural(val, key) {
        val = parseFloat(val);

        if (key === 'base') {
            this.params.binBase = val;
            document.getElementById('binBaseVal').innerText = val + " Hz";
        } else {
            /* key === 'beat' */
            this.params.binBeat = val;
            document.getElementById('binBeatVal').innerText = val + " Hz";
        }

        /* Apply frequency changes live if binaural audio is currently playing */
        if (this.state.isPlaying && this.state.mode === 'binaural' && this.nodes.osc1) {
            const t = this.ctx.currentTime;
            /* Left oscillator tracks the base frequency */
            this.nodes.osc1.frequency.setTargetAtTime(this.params.binBase, t, 0.1);
            /* Right oscillator tracks base + beat difference */
            this.nodes.osc2.frequency.setTargetAtTime(
                parseFloat(this.params.binBase) + parseFloat(this.params.binBeat),
                t,
                0.1
            );
        }
    }

    /* =========================================================================
       METHOD: fineTune(amt)
       ─────────────────────
       Adjusts the frequency slider and live oscillator by ±1 Hz (or any integer
       amount). Clamps the result to the valid slider range (1–22000 Hz).
       @param {number} amt — Integer step amount, typically +1 or -1
    ========================================================================= */
    fineTune(amt) {
        let val = parseInt(this.el.freqSlider.value) + amt;
        val     = Math.max(1, Math.min(22000, val)); // Clamp to slider range

        this.el.freqSlider.value = val;
        this.updateFreq(val);
    }

    /* =========================================================================
       METHOD: applyPreset(val)
       ─────────────────────────
       Applies a Smart Preset from the dropdown. The preset value string encodes
       both the target frequency and waveform type (e.g., "165|square").
       Switches to Manual mode if not already active, then starts playback.
       @param {string} val — Preset string in the format "hz|wavetype"
    ========================================================================= */
    applyPreset(val) {
        const [hz, wave]  = val.split('|');
        this.params.wave  = wave;
        this.el.freqSlider.value = hz;

        /* Sync waveform grid button active state to the preset's wave type */
        document.querySelectorAll('.fgu-wave-grid .fgu-wave-btn').forEach(b => {
            b.classList.toggle('active', b.innerText.toLowerCase().includes(wave));
        });

        this.updateFreq(hz);

        /* If not in manual mode, switch to it so the preset plays correctly */
        if (this.state.mode !== 'manual') {
            const manBtn = document.querySelector('.tab-nav .tab-btn:first-child');
            this.setMode('manual', manBtn);
        }

        /* Auto-start playback if not already playing */
        if (!this.state.isPlaying) this.play();
    }

    /* =========================================================================
       VISUALIZER: toggleVizMode()
       ────────────────────────────
       Cycles between the two visualizer rendering modes:
         'wave' → oscilloscope-style time-domain waveform
         'bar'  → frequency-domain FFT bar chart
    ========================================================================= */
    toggleVizMode() {
        this.state.vizType = (this.state.vizType === 'wave') ? 'bar' : 'wave';
    }

    /* =========================================================================
       VISUALIZER: resizeCanvas()
       ────────────────────────────
       Sizes the canvas element to match its CSS layout dimensions, scaled by
       the device pixel ratio (DPR) for crisp rendering on HiDPI / Retina
       displays. Called on window resize and during initialisation.
    ========================================================================= */
    resizeCanvas() {
        const dpr  = window.devicePixelRatio || 1;
        const rect = this.el.canvas.getBoundingClientRect();
        /* Physical pixel dimensions */
        this.el.canvas.width  = rect.width  * dpr;
        this.el.canvas.height = rect.height * dpr;
        /* Scale the 2D context uniformly so all drawing coordinates
           remain in CSS pixel units for simplicity */
        this.el.ctx.scale(dpr, dpr);
    }

    /* =========================================================================
       VISUALIZER: drawVisualizer()
       ──────────────────────────────
       The main animation loop. Runs via requestAnimationFrame while audio is
       playing. Clears the canvas and redraws either:
         Wave mode — a cyan oscilloscope line (time-domain data)
         Bar  mode — a gradient FFT frequency bar chart
       Stops itself when isPlaying becomes false.
    ========================================================================= */
    drawVisualizer() {
        /* Stop the loop if audio has been stopped */
        if (!this.state.isPlaying) {
            const dpr = window.devicePixelRatio || 1;
            this.el.ctx.clearRect(
                0, 0,
                this.el.canvas.width  / dpr,
                this.el.canvas.height / dpr
            );
            this.animationId = null;
            return;
        }

        /* Schedule the next frame */
        this.animationId = requestAnimationFrame(() => this.drawVisualizer());

        const bufferLen = this.nodes.analyser.frequencyBinCount; // fftSize / 2 = 1024
        const dataArray = new Uint8Array(bufferLen);

        const dpr    = window.devicePixelRatio || 1;
        const width  = this.el.canvas.width  / dpr;
        const height = this.el.canvas.height / dpr;

        /* Clear the canvas for a fresh frame */
        this.el.ctx.clearRect(0, 0, width, height);

        /* ── WAVE MODE — Oscilloscope ─────────────────────────────────── */
        if (this.state.vizType === 'wave') {
            this.nodes.analyser.getByteTimeDomainData(dataArray);

            /* Neon cyan line with a soft glow shadow */
            this.el.ctx.lineWidth    = 2;
            this.el.ctx.strokeStyle  = '#00f3ff';
            this.el.ctx.shadowBlur   = 10;
            this.el.ctx.shadowColor  = 'rgba(0, 243, 255, 0.4)';
            this.el.ctx.beginPath();

            const sliceWidth = width / bufferLen; // Pixels per sample
            let x = 0;

            for (let i = 0; i < bufferLen; i++) {
                /*
                 * dataArray values are 0–255 (unsigned bytes).
                 * We normalise to the range [0, height]:
                 *   v = dataArray[i] / 128.0  → [0, 2] where 1 = zero-crossing
                 *   y = v * height / 2         → [0, height]
                 */
                const v = dataArray[i] / 128.0;
                const y = v * height / 2;
                (i === 0) ? this.el.ctx.moveTo(x, y) : this.el.ctx.lineTo(x, y);
                x += sliceWidth;
            }

            this.el.ctx.stroke();
            this.el.ctx.shadowBlur = 0; // Reset shadow to avoid bleeding into next frame
        }

        /* ── BAR MODE — FFT Frequency Spectrum ───────────────────────── */
        else {
            this.nodes.analyser.getByteFrequencyData(dataArray);

            /*
             * Draw 64 evenly-spaced bars by averaging every (bufferLen/64)-th bin.
             * Fewer bars = cleaner, more readable FFT visualization at small sizes.
             */
            const bars     = 64;
            const step     = Math.floor(bufferLen / bars);
            const barWidth  = (width / bars) - 2; // 2 px gap between bars

            for (let i = 0; i < bars; i++) {
                const val       = dataArray[i * step];              // 0–255
                const barHeight = (val / 255) * height;             // Normalised height

                /* Cyan-to-purple vertical gradient per bar */
                const gradient = this.el.ctx.createLinearGradient(
                    0, height - barHeight, 0, height
                );
                gradient.addColorStop(0, '#00f3ff'); // Top → cyan
                gradient.addColorStop(1, '#7000ff'); // Bottom → purple

                this.el.ctx.fillStyle = gradient;
                this.el.ctx.fillRect(
                    i * (barWidth + 2), // x position with 2 px gap
                    height - barHeight, // y position (bars grow upward)
                    barWidth,
                    barHeight
                );
            }
        }
    }

    /* =========================================================================
       METHOD: toggleRecord()
       ──────────────────────
       Starts or stops in-browser audio recording using the MediaRecorder API.
       The recorder captures the live stream from destStream (which taps
       directly from the analyser output) so the recording matches exactly
       what is heard on the speakers.
       On stop: the recorded Blob is immediately downloaded as a file.
    ========================================================================= */
    toggleRecord() {
        /* Guard: cannot start recording when no audio is playing */
        if (!this.state.isPlaying && !this.state.isRecording) {
            window.showToast("Play sound first to record!", true);
            return;
        }

        if (!this.state.isRecording) {
            /* ── START recording ──────────────────────────────────────── */
            this.state.chunks = []; // Reset chunks array for a fresh recording

            /* Probe supported MIME types in order of preference */
            const types    = [
                "audio/webm;codecs=opus",
                "audio/mp4",
                "audio/ogg",
                "audio/wav"
            ];
            const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));

            if (!mimeType) {
                window.showToast("Your browser does not support audio recording.", true);
                return;
            }

            try {
                const rec = new MediaRecorder(
                    this.nodes.destStream.stream,
                    { mimeType }
                );

                /* Collect data chunks as the recording progresses */
                rec.ondataavailable = e => {
                    if (e.data.size > 0) this.state.chunks.push(e.data);
                };

                /* When MediaRecorder stops, compile chunks into a downloadable Blob */
                rec.onstop = () => {
                    const blob = new Blob(this.state.chunks, { type: mimeType });
                    const url  = URL.createObjectURL(blob);
                    const a    = document.createElement('a');
                    a.href     = url;

                    /* Derive file extension from the chosen MIME type */
                    let ext = 'webm';
                    if (mimeType.includes('wav'))  ext = 'wav';
                    if (mimeType.includes('mp4'))  ext = 'mp4';

                    a.download = `FrequencyGen_${Date.now()}.${ext}`;
                    a.click();

                    /* Revoke the object URL after 1 s to free memory */
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    window.showToast("Audio Downloaded!");
                };

                rec.start();
                this.state.recorder   = rec;
                this.state.isRecording = true;
                this.el.recBtn.classList.add('recording'); // Visual feedback
                window.showToast("Recording Started...");

            } catch (e) {
                console.error("[AudioEngine] Recording failed:", e);
                window.showToast("Recording failed. Please try again.", true);
            }

        } else {
            /* ── STOP recording ───────────────────────────────────────── */
            if (this.state.recorder && this.state.recorder.state !== 'inactive') {
                this.state.recorder.stop(); // Triggers rec.onstop → download
            }
            this.state.isRecording = false;
            this.el.recBtn.classList.remove('recording'); // Remove red glow
            window.showToast("Processing audio...");
        }
    }

    /* =========================================================================
       UTILITY: updateDisplay(v, u)
       ─────────────────────────────
       Updates the large Hz readout overlaid on the visualizer canvas.
       @param {string|number} v — Value to display (e.g., 440 or 'NOISE')
       @param {string}        u — Unit label (e.g., 'Hz', 'GEN', 'WAVE')
    ========================================================================= */
    updateDisplay(v, u) {
        this.el.hzDisplay.innerText  = v;
        this.el.unitDisplay.innerText = u;
    }

    /* =========================================================================
       UTILITY: updateUI()
       ─────────────────────
       Syncs the main Play/Stop button's visual state with the isPlaying flag.
       Adds/removes the .playing CSS class and swaps the icon.
    ========================================================================= */
    updateUI() {
        if (this.state.isPlaying) {
            this.el.playBtn.classList.add('playing');
            this.el.playBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        } else {
            this.el.playBtn.classList.remove('playing');
            this.el.playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    }

    /* =========================================================================
       METHOD: initListeners()
       ─────────────────────────
       Sets up global event listeners that are required for the tool to function:
         1. window resize → resizes the canvas to stay sharp at all viewport sizes
         2. User gesture events → resume suspended AudioContext (browser policy)
       Also performs the initial canvas sizing and display update.
    ========================================================================= */
    initListeners() {
        /* ── Resize handler — re-scale canvas on viewport changes ────── */
        window.addEventListener('resize', () => this.resizeCanvas());

        /*
         * ── Mobile / strict-mode Autoplay unlock ─────────────────────
         * Browsers suspend an AudioContext if it was created before a user
         * interaction. Listening for the first 'click', 'touchstart', or
         * 'keydown' event and calling ctx.resume() inside it satisfies the
         * policy. The { once: true } option auto-removes each listener after
         * it fires, preventing memory leaks.
         */
        ['click', 'touchstart', 'keydown'].forEach(eventType => {
            document.body.addEventListener(eventType, () => {
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            }, { once: true });
        });

        /* ── Initial setup ──────────────────────────────────────────── */
        this.resizeCanvas();                               // Size canvas on load
        this.updateDisplay(this.params.freq, 'Hz');       // Show default 440 Hz
    }

} /* end class AudioEngine */


/* =============================================================================
   BOOTSTRAP
   ────────────────────────────────────────────────────────────────────────────
   Create the single global `app` instance.
   HTML onclick attributes reference `app.*` methods directly (e.g., app.togglePlay()).
   DOMContentLoaded is not needed here because this <script> tag is placed
   at the bottom of <body>, after all elements are parsed.
============================================================================= */
const app = new AudioEngine();
