/**
 * =============================================================================
 *  ULTRA TTS STUDIO PRO — script.js
 *  Tool        : Text-to-Speech Studio (text-to-speech.html)
 *  Author      : MD KAWSAR
 *  Version     : 2.1 (CodeCanyon Release Build)
 *  Architecture: IIFE Module Pattern with Event-Driven State Management
 * =============================================================================
 *
 *  TABLE OF CONTENTS
 *  ─────────────────────────────────────────────────────────────────────────
 *  MODULE CONFIG  : Browser capability detection & global constants
 *  MODULE STATE   : All mutable runtime state variables
 *  MODULE el      : Cached DOM element references
 *  FUNCTION cacheDOM     : Fetches and stores all required DOM nodes once
 *  MODULE ui             : UI feedback helpers (status bar, stats, play button)
 *  MODULE engine         : Core voice/TTS engine (init, loadVoices, parse, play)
 *  MODULE files          : Async file handlers (PDF, DOCX, OCR image)
 *  MODULE audio          : AudioContext, studio recorder, SFX playback
 *  MODULE app (PUBLIC)   : Public interface — all onclick targets live here
 *  INIT           : DOMContentLoaded bootstrap
 * =============================================================================
 */

const TTSApp = (() => {
    'use strict'; /* Enforce strict mode for cleaner, safer code execution */

    /* =========================================================================
       MODULE: CONFIG
       Static configuration values resolved once at startup.
       - speech         : Native browser SpeechSynthesis API reference
       - AudioContext   : Cross-browser AudioContext constructor (with webkit fallback)
       - isMobile       : True if the user agent matches a known mobile device
       - chunkSize      : Max characters per speech chunk to prevent Chrome TTS timeout bugs
    ========================================================================= */
    const config = {
        speech       : window.speechSynthesis,
        AudioContext : window.AudioContext || window.webkitAudioContext,
        isMobile     : /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
        chunkSize    : 200
    };

    /* =========================================================================
       MODULE: STATE
       All mutable variables that represent the current runtime state.
       Centralized here to avoid global scope pollution.
    ========================================================================= */
    const state = {
        voices          : [],        /* Array of SpeechSynthesisVoice objects loaded from browser */
        isPlaying       : false,     /* True when the TTS engine is actively speaking */
        isPaused        : false,     /* True when the user has paused mid-playback */
        isRecording     : false,     /* True when studio recorder is capturing tab audio */
        queue           : [],        /* Parsed speech queue (array of {type, val, voice} objects) */
        currIndex       : 0,         /* Current position pointer in the speech queue */
        bgAudio         : new Audio(),/* Background music Audio element — loops automatically */
        sfxCache        : {},        /* Object map of SFX slot ID → Blob URL for custom uploads */
        mediaRecorder   : null,      /* MediaRecorder instance used during studio recording */
        audioChunks     : [],        /* Collects Blob chunks from the recorder's ondataavailable */
        ctx             : null,      /* AudioContext instance — lazy-initialized on first use */
        voiceLoadAttempts: 0,        /* Counter for voice polling fallback (prevents infinite loops) */
        timer           : null       /* setTimeout handle used for [pause:N] queue items */
    };

    /* =========================================================================
       MODULE: el (DOM Cache)
       Empty object populated by cacheDOM() at DOMContentLoaded.
       All DOM queries run exactly once to minimize reflow costs.
    ========================================================================= */
    const el = {};

    /* =========================================================================
       FUNCTION: cacheDOM
       Fetches and stores references to every required DOM element.
       Called once during app.init(). Must be called before any UI update.
    ========================================================================= */
    const cacheDOM = () => {
        el.input       = document.getElementById('text-input');
        el.voiceSelect = document.getElementById('voice-select');
        el.rate        = document.getElementById('rate');
        el.pitch       = document.getElementById('pitch');
        el.volMusic    = document.getElementById('vol-music');
        el.volSfx      = document.getElementById('vol-sfx');
        el.btnPlay     = document.getElementById('btn-play');
        el.btnRecord   = document.getElementById('btn-record');
        el.statusBar   = document.getElementById('status-bar');
        el.statusText  = document.getElementById('status-text');
        el.visualizer  = document.getElementById('visualizer');
        el.statChar    = document.getElementById('stat-char');
        el.statTime    = document.getElementById('stat-time');
        el.voiceTags   = document.getElementById('voice-tags');
        el.bgInfo      = document.getElementById('bg-info');
        el.bgName      = document.getElementById('bg-name');
    };

    /* =========================================================================
       MODULE: ui
       A collection of small helpers that update the visual interface.
       None of these functions touch the speech engine or recording logic.

       Methods:
         status(msg, active) — Shows/hides the bottom status bar in the editor
         updateStats()       — Recalculates and displays character count & estimated time
         togglePlayBtn(active, paused) — Swaps play button label/color for each playback state
    ========================================================================= */
    const ui = {

        /**
         * status(msg, active)
         * ───────────────────
         * Shows or hides the processing status bar that overlays the textarea.
         * @param {string}  msg    - The message to display (e.g. "Speaking...", "Reading PDF: Page 3/10")
         * @param {boolean} active - True = show bar; False = hide it
         */
        status: (msg, active = true) => {
            if (active) {
                el.statusText.innerText = msg;
                el.statusBar.classList.add('active');
            } else {
                el.statusBar.classList.remove('active');
            }
        },

        /**
         * updateStats()
         * ─────────────
         * Reads the current textarea value and updates the live stats bar
         * at the bottom-right of the workspace.
         * Estimation: average speaking speed of ~150 words per minute.
         */
        updateStats: () => {
            const text    = el.input.value;
            el.statChar.innerText = text.length;
            const words   = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
            const minutes = Math.floor(words / 150);
            const seconds = Math.floor((words / 150 - minutes) * 60);
            el.statTime.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        },

        /**
         * togglePlayBtn(active, paused)
         * ──────────────────────────────
         * Swaps the play button's icon and background color to reflect the
         * current playback state (idle, playing, or paused).
         * @param {boolean} active - False = idle state (show "PLAY STUDIO")
         * @param {boolean} paused - True  = paused state (show "RESUME STUDIO" in yellow)
         */
        togglePlayBtn: (active, paused = false) => {
            if (active) {
                el.btnPlay.innerHTML    = paused
                    ? '<i class="fa-solid fa-play"></i> RESUME STUDIO'
                    : '<i class="fa-solid fa-pause"></i> PAUSE STUDIO';
                el.btnPlay.style.background = paused ? '#f1c40f' : '#ff0055';
                el.btnPlay.style.color      = paused ? '#000'    : '#fff';
            } else {
                /* Reset to default idle state */
                el.btnPlay.innerHTML        = '<i class="fa-solid fa-play"></i> PLAY STUDIO';
                el.btnPlay.style.background = '';
                el.btnPlay.style.color      = '';
            }
        }
    };

    /* =========================================================================
       MODULE: engine
       The core Text-to-Speech voice engine. Manages voice loading, text parsing,
       and the recursive playback queue.

       Methods:
         init()       — Starts voice loading with polling fallback
         loadVoices() — Populates the voice dropdown and multi-voice tags
         parse(text)  — Tokenizes the script into a speakable queue array
         play()       — Recursively plays the next item in state.queue
    ========================================================================= */
    const engine = {

        /**
         * init()
         * ───────
         * Initializes the TTS engine. Sets up the onvoiceschanged handler
         * (Chrome fires it async) and a polling interval as a fallback for
         * Safari/Firefox which may not fire the event reliably.
         */
        init: () => {
            if (!config.speech) {
                /* Browser does not support Web Speech API — alert the user */
                window.showToast("Your browser does not support Text-to-Speech.", true);
                return;
            }

            engine.loadVoices();

            /* Chrome and Edge: voices load asynchronously; re-populate on change */
            if (config.speech.onvoiceschanged !== undefined) {
                config.speech.onvoiceschanged = engine.loadVoices;
            }

            /*
             * Fallback Polling:
             * Some browsers have a slight startup delay before voices become
             * available. Poll every 500ms, stop after 10 attempts or on success.
             */
            const poller = setInterval(() => {
                if (config.speech.getVoices().length > 0 || state.voiceLoadAttempts > 10) {
                    engine.loadVoices();
                    clearInterval(poller);
                }
                state.voiceLoadAttempts++;
            }, 500);

            /* Background music loops by default */
            state.bgAudio.loop = true;
        },

        /**
         * loadVoices()
         * ─────────────
         * Reads available voices from the browser's SpeechSynthesis API,
         * organizes them into <optgroup> elements by language code,
         * and creates quick-access tag buttons for English/Google/Premium voices.
         *
         * Preserves the currently selected voice if it still exists after reload.
         */
        loadVoices: () => {
            const voices = config.speech.getVoices();
            if (voices.length === 0) return; /* Not ready yet — wait for polling */

            state.voices = voices;

            const currentVal     = el.voiceSelect.value;
            el.voiceSelect.innerHTML = '';
            el.voiceTags.innerHTML   = ''; /* Reset quick-tag buttons */

            /*
             * Group voices by their 2-letter language code (e.g. "EN", "FR", "DE").
             * Also builds quick-tag buttons for Google/Premium/en-US voices.
             */
            const groups = {};
            voices.forEach(v => {
                const lang = v.lang.slice(0, 2).toUpperCase();
                if (!groups[lang]) groups[lang] = [];
                groups[lang].push(v);

                /* Add a tag button only for popular/high-quality voices */
                if (v.name.includes("Google") || v.name.includes("Premium") || v.lang.includes("en-US")) {
                    const tag      = document.createElement('div');
                    tag.className  = 'btn btn-secondary';
                    tag.style.cssText = 'font-size:10px; padding:6px; justify-content:flex-start; margin-bottom:3px;';
                    tag.innerHTML  = `<i class="fa-solid fa-user"></i> ${v.name.substring(0, 18)}..`;

                    /* Clicking a tag inserts the [voice:Name] syntax into the textarea */
                    tag.onclick    = () => app.insertTag(`[voice:${v.name}] `);
                    el.voiceTags.appendChild(tag);
                }
            });

            /* Render sorted language groups as <optgroup> elements */
            Object.keys(groups).sort().forEach(lang => {
                const optgroup   = document.createElement('optgroup');
                optgroup.label   = `--- ${lang} ---`;
                groups[lang].forEach(v => {
                    const opt        = document.createElement('option');
                    opt.value        = v.name;
                    opt.innerText    = `${v.name} (${v.lang})`;
                    if (v.default) opt.selected = true;
                    optgroup.appendChild(opt);
                });
                el.voiceSelect.appendChild(optgroup);
            });

            /* Restore previously selected voice if it still exists in the new list */
            if (currentVal && Array.from(el.voiceSelect.options).some(o => o.value === currentVal)) {
                el.voiceSelect.value = currentVal;
            }
        },

        /**
         * parse(text)
         * ────────────
         * High-performance text parser that tokenizes the user's script into a
         * flat array of queue items, respecting [voice:Name] and [pause:N] tags.
         *
         * Queue item types:
         *   { type: 'text',  val: string, voice: string } — a speakable sentence
         *   { type: 'pause', val: number }                — a timed silent gap in ms
         *
         * Long text blocks are split by sentence-ending punctuation to prevent
         * the Chrome browser from silently dropping long utterances.
         *
         * @param  {string} text - The raw script from the textarea
         * @returns {Array}      - Ordered array of queue items
         */
        parse: (text) => {
            /* Split on [voice:...] and [pause:N] tags but keep the delimiters */
            const regex  = /(\[voice:.*?\]|\[pause:\d+\])/g;
            const parts  = text.split(regex);
            const queue  = [];
            let currentVoice = el.voiceSelect.value;

            parts.forEach(part => {
                if (!part.trim()) return;

                if (part.startsWith('[voice:')) {
                    /* Switch active voice for subsequent text blocks */
                    const match = part.match(/\[voice:(.*?)\]/);
                    if (match) currentVoice = match[1];

                } else if (part.startsWith('[pause:')) {
                    /* Insert a timed pause item into the queue */
                    const match = part.match(/\[pause:(\d+)\]/);
                    const ms    = match ? parseInt(match[1]) : 1000;
                    queue.push({ type: 'pause', val: ms });

                } else {
                    /*
                     * Regular text block: split into individual sentences.
                     * The regex captures sentences ending in . ! ? as well as
                     * trailing text that has no punctuation.
                     * Each sentence becomes a separate utterance item to avoid
                     * Chrome's ~32,768 character utterance limit bug.
                     */
                    const sentences = part.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [part];
                    sentences.forEach(s => {
                        if (s.trim()) {
                            queue.push({ type: 'text', val: s.trim(), voice: currentVoice });
                        }
                    });
                }
            });

            return queue;
        },

        /**
         * play()
         * ───────
         * Recursively processes the speech queue one item at a time.
         * - For 'pause' items: uses setTimeout to delay the next call.
         * - For 'text' items: creates a SpeechSynthesisUtterance, assigns the
         *   voice, rate, and pitch, then speaks it.
         * Implements audio ducking: lowers BGM volume while speech is active.
         * Calls app.stopAll() when the queue is exhausted.
         */
        play: () => {
            if (state.currIndex >= state.queue.length) {
                /* Queue finished — clean up and return to idle state */
                app.stopAll();
                return;
            }

            const item = state.queue[state.currIndex];

            if (item.type === 'pause') {
                /* Timed silence: update status and wait before advancing */
                ui.status(`Waiting ${item.val}ms...`);
                state.timer = setTimeout(() => {
                    state.currIndex++;
                    engine.play();
                }, item.val);
                return;
            }

            /* Build the utterance for this speech chunk */
            const utt   = new SpeechSynthesisUtterance(item.val);

            /*
             * Voice Resolution:
             * First try exact name match for [voice:Name] tagged chunks.
             * Fall back to the currently selected dropdown voice.
             */
            const voice = state.voices.find(v => v.name === item.voice) ||
                          state.voices.find(v => v.name === el.voiceSelect.value);
            if (voice) utt.voice = voice;

            utt.rate  = parseFloat(el.rate.value);
            utt.pitch = parseFloat(el.pitch.value);

            /* Audio Ducking: reduce BGM to 20% of its volume while speaking */
            utt.onstart = () => {
                ui.status("Speaking...");
                if (!state.bgAudio.paused) {
                    state.bgAudio.volume = parseFloat(el.volMusic.value) * 0.2;
                }
            };

            /* Restore BGM volume after each utterance, then advance the queue */
            utt.onend = () => {
                if (!state.bgAudio.paused) {
                    state.bgAudio.volume = parseFloat(el.volMusic.value);
                }
                state.currIndex++;
                state.timer = setTimeout(engine.play, 50); /* 50ms buffer prevents audio glitches */
            };

            /* Error Recovery: log the error but skip the block to prevent queue stall */
            utt.onerror = (e) => {
                console.warn("TTS Error (skipping block):", e);
                state.currIndex++;
                engine.play();
            };

            config.speech.speak(utt);
        }
    };

    /* =========================================================================
       MODULE: files
       Async file handlers for document import and OCR.
       All parsing runs entirely in the browser — nothing is sent to a server.

       Methods:
         read(input) — Handles .txt, .pdf (via pdf.js), and .docx (via Mammoth.js)
         ocr(input)  — Runs Tesseract OCR on an uploaded image file
    ========================================================================= */
    const files = {

        /**
         * read(input)
         * ────────────
         * Reads the selected file from the file input element.
         * Supports three formats:
         *   - PDF  : Parsed page-by-page using pdf.js; status updates per 5 pages
         *   - DOCX : Raw text extracted using Mammoth.js
         *   - TXT  : Read directly with File.text()
         *
         * On success, the extracted text is injected into the textarea.
         * On failure, a global error toast is shown.
         *
         * @param {HTMLInputElement} input - The file input element
         */
        read: async (input) => {
            const file = input.files[0];
            if (!file) return;

            ui.status("Processing Document...", true);

            try {
                let text = "";

                if (file.type === "application/pdf") {
                    /* PDF: stream each page's text content via pdf.js */
                    const buffer = await file.arrayBuffer();
                    const pdf    = await pdfjsLib.getDocument(buffer).promise;

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page    = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        text += content.items.map(item => item.str).join(' ') + "\n";

                        /* Progress status update every 5 pages for large PDFs */
                        if (i % 5 === 0) {
                            ui.status(`Reading PDF: Page ${i}/${pdf.numPages}...`);
                        }
                    }

                } else if (file.name.endsWith(".docx")) {
                    /* DOCX: use Mammoth.js to extract raw body text */
                    const buffer = await file.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                    text = result.value;

                } else {
                    /* TXT and other plain text formats */
                    text = await file.text();
                }

                el.input.value = text;
                ui.updateStats();
                window.showToast("Document Imported Successfully!");

            } catch (e) {
                console.error("File Read Error:", e);
                window.showToast("Failed to read the file. Please try a different format.", true);
            } finally {
                /* Always hide the status bar and reset the input — even on error */
                ui.status("", false);
                input.value = "";
            }
        },

        /**
         * ocr(input)
         * ───────────
         * Runs Tesseract.js OCR on the selected image file.
         * Streams progress percentage to the status bar while recognizing.
         * Appends the recognized text to any existing textarea content.
         *
         * @param {HTMLInputElement} input - The file input element (accept="image/*")
         */
        ocr: (input) => {
            const file = input.files[0];
            if (!file) return;

            ui.status("Initializing OCR Engine...", true);

            Tesseract.recognize(file, 'eng', {
                workerPath : 'assets/library/media-vision/tesseract/worker.min.js',
                corePath   : 'assets/library/media-vision/tesseract/tesseract-core.wasm.js',
                langPath   : 'assets/library/media-vision/tesseract/lang-data',

                /* Live progress updates: shows percentage while scanning */
                logger: m => {
                    if (m.status === 'recognizing text') {
                        ui.status(`Scanning Image: ${Math.round(m.progress * 100)}%`);
                    }
                }

            }).then(({ data: { text } }) => {
                /* Append (not replace) extracted text to preserve existing content */
                el.input.value += (el.input.value ? "\n\n" : "") + text;
                ui.updateStats();
                window.showToast("Text Extracted from Image!");

            }).catch(e => {
                console.error("OCR Error:", e);
                window.showToast("OCR Failed. Please try a clearer image.", true);

            }).finally(() => {
                ui.status("", false);
                input.value = "";
            });
        }
    };

    /* =========================================================================
       MODULE: audio
       Manages the Web Audio API context, the studio recorder, and SFX playback.

       Methods:
         initContext()    — Lazy-initializes the AudioContext (user gesture required)
         toggleRecord()   — Starts or stops tab audio capture via getDisplayMedia
         playSfx(id)      — Plays a sound from the SFX cache, or a synthesized beep
    ========================================================================= */
    const audio = {

        /**
         * initContext()
         * ──────────────
         * Creates the AudioContext on first use or resumes it if suspended.
         * Must be called inside a user gesture handler (click/keydown) to
         * comply with browser autoplay policies.
         */
        initContext: () => {
            if (!state.ctx) {
                state.ctx = new config.AudioContext();
            } else if (state.ctx.state === 'suspended') {
                state.ctx.resume();
            }
        },

        /**
         * toggleRecord()
         * ───────────────
         * Starts or stops studio-quality audio recording.
         *
         * Recording Flow:
         *   1. Request tab audio via getDisplayMedia (user must click "Share Audio")
         *   2. Validate that an audio track was actually shared
         *   3. Create a MediaRecorder with opus codec (falls back to generic webm)
         *   4. Collect data chunks in state.audioChunks
         *   5. On stop: assemble Blob → create download link → auto-click
         *
         * If playback has not started, it auto-starts before recording begins.
         * On mobile: the getDisplayMedia API is not available in most mobile
         * browsers, and an appropriate error is shown via the global toast.
         */
        toggleRecord: async () => {
            if (state.isRecording) {
                /* ── STOP RECORDING ── */
                if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
                    state.mediaRecorder.stop();
                }
                state.isRecording           = false;
                el.btnRecord.classList.remove('btn-danger');
                el.btnRecord.style.animation  = "none";
                el.btnRecord.innerHTML        = '<i class="fa-solid fa-circle"></i> REC';
                el.btnRecord.style.color      = "";
                el.btnRecord.style.borderColor= "";
                return;
            }

            /* ── START RECORDING ── */
            try {
                /* Auto-start playback if not already playing */
                if (!state.isPlaying) app.togglePlay();

                /*
                 * getDisplayMedia captures the entire browser tab's audio stream.
                 * preferCurrentTab:true reduces the selection dialog for the user.
                 * The user MUST check "Share Audio" or recording will fail.
                 */
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video : { displaySurface: "browser" },
                    audio : {
                        echoCancellation   : false,
                        noiseSuppression   : false,
                        autoGainControl    : false,
                        sampleRate         : 48000
                    },
                    preferCurrentTab    : true,
                    selfBrowserSurface  : "include"
                });

                /* Validate that audio sharing was actually granted */
                if (stream.getAudioTracks().length === 0) {
                    stream.getTracks().forEach(t => t.stop());
                    throw new Error("Audio sharing was denied. Please check 'Share Audio' in the popup.");
                }

                state.audioChunks = [];

                /* Prefer opus codec for best quality/file-size ratio */
                const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? { mimeType: 'audio/webm;codecs=opus' }
                    : { mimeType: 'audio/webm' };

                state.mediaRecorder = new MediaRecorder(stream, options);

                /* Collect data chunks as they arrive from the recorder */
                state.mediaRecorder.ondataavailable = e => {
                    if (e.data.size > 0) state.audioChunks.push(e.data);
                };

                /* On stop: assemble all chunks into a single Blob and trigger download */
                state.mediaRecorder.onstop = () => {
                    const blob = new Blob(state.audioChunks, { type: 'audio/webm' });
                    const url  = URL.createObjectURL(blob);
                    const a    = document.createElement('a');
                    a.href     = url;
                    a.download = `Ultra_Studio_${Date.now()}.webm`;
                    a.click();

                    /* Stop all shared media tracks to end the system share indicator */
                    stream.getTracks().forEach(t => t.stop());
                    window.showToast("Recording Downloaded Successfully!");

                    /* Release the Blob URL after 60 seconds to free memory */
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                };

                state.mediaRecorder.start();
                state.isRecording = true;

                /* Update button appearance to indicate active recording */
                el.btnRecord.classList.add('btn-danger');
                el.btnRecord.innerHTML         = '<i class="fa-solid fa-square"></i> STOP';
                el.btnRecord.style.animation   = "pulse 1.5s infinite";
                el.btnRecord.style.color       = "white";

                window.showToast("Recording Started! Minimize window to hide the share popup.");

            } catch (e) {
                console.error("Recorder Error:", e);
                window.showToast(e.message, true);

                /* If recording failed immediately after starting playback, stop everything */
                if (state.isPlaying) app.stopAll();
            }
        },

        /**
         * playSfx(id)
         * ────────────
         * Plays a sound effect by its pad ID (1–6).
         * - If the user has uploaded a custom audio file for this pad, plays that.
         * - Otherwise, generates a short synthesized beep tone using the Web Audio API.
         *
         * Adds a brief .playing CSS class to the pad element for visual feedback.
         *
         * @param {number} id - The SFX pad slot number (1 through 6)
         */
        playSfx: (id) => {
            if (state.sfxCache[id]) {
                /* Play the cached user-uploaded audio file */
                const sound    = new Audio(state.sfxCache[id]);
                sound.volume   = parseFloat(el.volSfx.value);
                sound.play();
            } else {
                /*
                 * Fallback: synthesize a short beep at a frequency derived from the ID.
                 * Each pad gets a unique pitch: 500, 600, 700... Hz.
                 */
                audio.initContext();
                const osc  = state.ctx.createOscillator();
                const gain = state.ctx.createGain();
                osc.connect(gain);
                gain.connect(state.ctx.destination);
                osc.frequency.value = 400 + (id * 100);
                gain.gain.value     = 0.1;
                osc.type            = 'sine';
                osc.start();
                osc.stop(state.ctx.currentTime + 0.15); /* 150ms beep duration */
            }

            /* Brief visual flash on the pad button */
            const btn = document.getElementById(`sfx-${id}`);
            btn.classList.add('playing');
            setTimeout(() => btn.classList.remove('playing'), 200);
        }
    };

    /* =========================================================================
       MODULE: app (PUBLIC INTERFACE)
       All functions exposed as TTSApp.methodName() for HTML onclick attributes.
       This is the only object returned from the IIFE and made public.
    ========================================================================= */
    const app = {

        /**
         * init()
         * ───────
         * Application bootstrap. Called once on DOMContentLoaded.
         *  1. Caches all DOM elements
         *  2. Initializes the voice engine
         *  3. Attaches the stats update listener to the textarea
         *  4. Builds the 40-bar visualizer DOM
         *  5. Starts the 100ms visualizer animation interval
         *  6. Shows a mobile warning if the user is on a mobile device
         *     (recording feature is restricted on mobile)
         */
        init: () => {
            cacheDOM();
            engine.init();

            /* Update character count and estimated time on every keystroke */
            el.input.addEventListener('input', ui.updateStats);

            /*
             * Visualizer Animation Loop:
             * Every 100ms, randomize the height of all 40 bars between 10%–90%
             * while playing, or reset all to 10% when idle/paused.
             */
            setInterval(() => {
                const bars     = el.visualizer.children;
                const isActive = state.isPlaying && !state.isPaused;
                for (let i = 0; i < bars.length; i++) {
                    bars[i].style.height = isActive
                        ? (Math.random() * 80 + 10) + '%'
                        : '10%';
                }
            }, 100);

            /* Inject 40 bar elements into the visualizer container */
            for (let i = 0; i < 40; i++) {
                const d       = document.createElement('div');
                d.className   = 'bar';
                el.visualizer.appendChild(d);
            }

            /*
             * Mobile Warning:
             * The Studio Recorder (getDisplayMedia) is not available on most
             * mobile browsers. Warn the user without blocking the interface.
             */
            if (config.isMobile) {
                window.showToast("Mobile detected: Recording feature may not be available in your browser.", true);
            }
        },

        /**
         * togglePlay()
         * ─────────────
         * Main play/pause/resume toggle for the TTS engine.
         *
         * States:
         *   Playing + Not Paused → PAUSE   (suspends speech + bgAudio)
         *   Paused               → RESUME  (resumes speech + bgAudio)
         *   Idle                 → START   (parses text, builds queue, starts playback)
         *
         * Shows error toast if the textarea is empty on a fresh start.
         */
        togglePlay: () => {
            audio.initContext();

            if (state.isPlaying && !state.isPaused) {
                /* ── PAUSE ── */
                config.speech.pause();
                state.bgAudio.pause();
                clearTimeout(state.timer);
                state.isPaused = true;
                ui.togglePlayBtn(true, true);
                ui.status("Paused", true);

            } else if (state.isPaused) {
                /* ── RESUME ── */
                config.speech.resume();
                if (state.bgAudio.src) state.bgAudio.play();
                state.isPaused = false;
                engine.play(); /* Re-enter the queue loop */
                ui.togglePlayBtn(true);
                ui.status("Speaking...", true);

            } else {
                /* ── START NEW PLAYBACK ── */
                const text = el.input.value.trim();
                if (!text) {
                    window.showToast("Please enter some text before playing.", true);
                    return;
                }

                app.stopAll(); /* Reset any lingering state from previous session */

                state.queue      = engine.parse(text);
                state.currIndex  = 0;
                state.isPlaying  = true;
                state.isPaused   = false;

                /* Start background music if a file has been loaded */
                if (state.bgAudio.src) {
                    state.bgAudio.volume = parseFloat(el.volMusic.value);
                    state.bgAudio.play().catch(e => console.warn("BGM autoplay blocked:", e));
                }

                ui.togglePlayBtn(true);
                ui.status("Starting...", true);
                engine.play();
            }
        },

        /**
         * stopAll()
         * ──────────
         * Immediately halts all speech synthesis, background audio,
         * and timers. Resets the queue pointer to 0 and returns the UI
         * to its idle state.
         *
         * Also auto-saves the recording if one is in progress.
         */
        stopAll: () => {
            config.speech.cancel();
            state.bgAudio.pause();
            state.bgAudio.currentTime = 0;
            clearTimeout(state.timer);
            state.isPlaying  = false;
            state.isPaused   = false;
            state.currIndex  = 0;
            ui.togglePlayBtn(false);
            ui.status("", false);

            /* If a recording was in progress, stop it and trigger the download */
            if (state.isRecording) audio.toggleRecord();
        },

        /* ── Public Bridge Methods ──
           These expose internal module functions to HTML onclick attributes. */

        /** Delegates document file reading to the files module */
        handleDoc     : (i) => files.read(i),

        /** Delegates OCR image reading to the files module */
        handleOCR     : (i) => files.ocr(i),

        /**
         * loadAudio(input, type)
         * ───────────────────────
         * Loads an audio file from a file input into a background music or
         * SFX cache slot.
         * @param {HTMLInputElement} input - The file input element
         * @param {string}           type  - Currently only 'bg' (background music)
         */
        loadAudio: (input, type) => {
            const file = input.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            if (type === 'bg') {
                state.bgAudio.src         = url;
                el.bgInfo.style.display   = 'block';
                el.bgName.innerText       = file.name.substring(0, 20) + (file.name.length > 20 ? "..." : "");
                window.showToast("Background Music Loaded!");
            }
        },

        /**
         * loadSfx(input, id)
         * ───────────────────
         * Stores a custom audio Blob URL for an SFX pad slot.
         * Updates the pad's border color to indicate a custom file is loaded.
         * @param {HTMLInputElement} input - The hidden file input inside the SFX pad
         * @param {number}           id    - The SFX pad slot number (1–6)
         */
        loadSfx: (input, id) => {
            const file = input.files[0];
            if (!file) return;
            state.sfxCache[id] = URL.createObjectURL(file);
            document.getElementById(`sfx-${id}`).style.borderColor = 'var(--accent-cyan)';
            window.showToast(`SFX Pad ${id} — Custom Sound Set!`);
        },

        /** Delegates SFX playback to the audio module */
        playSfx     : (id) => audio.playSfx(id),

        /** Delegates recording toggle to the audio module */
        toggleRecord: ()   => audio.toggleRecord(),

        /**
         * insertTag(tag)
         * ───────────────
         * Inserts a TTS control tag ([pause:N] or [voice:Name]) at the
         * current cursor position in the textarea.
         * @param {string} tag - The tag string to insert
         */
        insertTag: (tag) => {
            const start  = el.input.selectionStart;
            const end    = el.input.selectionEnd;
            const val    = el.input.value;
            el.input.value = val.substring(0, start) + tag + val.substring(end);
            el.input.focus();
            ui.updateStats();
        },

        /**
         * clearAll()
         * ───────────
         * Prompts the user for confirmation, then clears the textarea and
         * resets the entire playback state.
         */
        clearAll: () => {
            if (confirm("Clear the entire workspace? This cannot be undone.")) {
                el.input.value = '';
                app.stopAll();
                ui.updateStats();
            }
        },

        /**
         * uiUpdate(id)
         * ─────────────
         * Syncs the display value of a range slider's adjacent <span> label.
         * Called by the oninput event on #rate and #pitch sliders.
         * @param {string} id - The ID of the range input (e.g. 'rate', 'pitch')
         */
        uiUpdate: (id) => {
            document.getElementById(`${id}-val`).innerText = document.getElementById(id).value;
        },

        /**
         * updateMixer()
         * ──────────────
         * Applies the current BGM volume slider value to the live background
         * audio element (only when it is actively playing).
         */
        updateMixer: () => {
            if (!state.bgAudio.paused) {
                state.bgAudio.volume = parseFloat(el.volMusic.value);
            }
        },

        /**
         * updateConfig()
         * ───────────────
         * Called when the voice dropdown selection changes.
         * Notifies the user of the switch via a global toast.
         */
        updateConfig: () => {
            window.showToast("Voice Updated Successfully.");
        },

        /**
         * saveProject()
         * ──────────────
         * Serializes the current workspace state (text, voice, rate, pitch)
         * into a JSON blob and triggers a download as TTS_Project.json.
         * The saved file can be reloaded via loadProject().
         */
        saveProject: () => {
            const data = {
                text  : el.input.value,
                voice : el.voiceSelect.value,
                rate  : el.rate.value,
                pitch : el.pitch.value
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a    = document.createElement('a');
            a.href     = URL.createObjectURL(blob);
            a.download = "TTS_Project.json";
            a.click();
        },

        /**
         * loadProject(input)
         * ───────────────────
         * Reads a previously saved TTS_Project.json file and restores all
         * workspace settings: text content, voice, rate, and pitch.
         * Validates JSON before applying to prevent corrupt file errors.
         *
         * @param {HTMLInputElement} input - The hidden file input (accept=".json")
         */
        loadProject: (input) => {
            const file = input.files[0];
            if (!file) return;

            const r    = new FileReader();
            r.onload   = e => {
                try {
                    const d          = JSON.parse(e.target.result);
                    el.input.value   = d.text;
                    el.voiceSelect.value = d.voice;
                    el.rate.value    = d.rate;
                    el.pitch.value   = d.pitch;

                    /* Sync both slider display labels after restoring values */
                    app.uiUpdate('rate');
                    app.uiUpdate('pitch');
                    ui.updateStats();
                    window.showToast("Project Loaded Successfully!");

                } catch (err) {
                    console.error("Project Load Error:", err);
                    window.showToast("Invalid project file. Please check the file format.", true);
                }
            };
            r.readAsText(file);
        }
    };

    /* Return only the public app interface — all internal modules stay private */
    return app;

})();

/* =============================================================================
   INIT
   Bootstrap the application once the DOM is fully parsed and ready.
   TTSApp.init() wires up all event listeners and starts the voice engine.
============================================================================= */
window.addEventListener('DOMContentLoaded', TTSApp.init);
