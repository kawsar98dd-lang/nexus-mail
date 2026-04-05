/**
 * ==========================================================================
 *  HYPERTYPE X — PRO ENGINE  (ES6 Class)
 *  Project  : Trusted Tools Web
 *  Author   : MD KAWSAR
 *  Version  : 2.0 (CodeCanyon Release Build)
 * ==========================================================================
 *
 *  OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  A commercial-grade, drift-free typing speed test engine built as a
 *  self-contained ES6 class. All game state lives inside the class instance,
 *  making it trivial to reset or extend without side effects.
 *
 *  KEY FEATURES
 *  ─────────────────────────────────────────────────────────────────────────
 *  • Net WPM formula      : ((chars/5) - errors) / (elapsed minutes)
 *  • Drift-free timer     : uses Date.now() delta instead of interval count
 *  • Mobile optimised     : invisible <input> captures all keystroke events
 *  • XSS-safe             : custom text is HTML-escaped before rendering
 *  • High score           : persisted to localStorage key 'hypertype_highscore'
 *  • Confetti             : canvas-confetti fires on successful test completion
 *  • Global toast         : uses window.showToast() from global.js for all
 *                           user-facing notifications (no local toast functions)
 *
 *  ARCHITECTURE
 *  ─────────────────────────────────────────────────────────────────────────
 *  HyperEngine (class)
 *    ├── constructor()        — DOM refs, state init, paragraph DB, init()
 *    ├── init()               — attaches all event listeners
 *    ├── loadParagraph()      — picks text, renders character spans
 *    ├── handleFocus()        — click/keydown → startCountdown()
 *    ├── startCountdown()     — 3-2-1 animated countdown
 *    ├── beginSession()       — reveals arena, starts drift-free timer
 *    ├── handleInput()        — per-keystroke correct/incorrect/backspace logic
 *    ├── updateStats()        — delegates live stats to runTimer()
 *    ├── runTimer()           — drift-free elapsed-time logic + WPM calc
 *    ├── calculateWPM()       — Net WPM & accuracy formula
 *    ├── updateProgressBar()  — drives the CSS progress fill bar
 *    ├── endGame()            — stops timer, shows modal, saves high score
 *    ├── resetGame()          — full state reset back to ready state
 *    ├── setTime()            — config-btn click → change maxTime
 *    ├── toggleSound()        — mute / unmute keystroke audio
 *    ├── setCustomText()      — prompt for custom paragraph
 *    ├── loadHighScore()      — reads localStorage, updates #high-score-val
 *    └── handleGlobalKeydown()— desktop shortcut to auto-start on first keypress
 * ==========================================================================
 */


/* ==========================================================================
   HYPERENGINE CLASS — Complete Typing Game Logic
   ========================================================================== */

class HyperEngine {

    /* ──────────────────────────────────────────────────────────────────────
       CONSTRUCTOR
       Caches all DOM element references into this.dom for performance,
       initialises all state variables to their default values, loads the
       personal best score from localStorage, and triggers init().
    ────────────────────────────────────────────────────────────────────── */
    constructor() {

        /* ── DOM element map ──
           All querySelector calls happen once here; everywhere else we use
           the cached references to avoid repeated DOM traversals.          */
        this.dom = {
            textDisplay : document.querySelector(".typing-text p"),   // Character render target
            input       : document.querySelector(".input-field"),      // Hidden keystroke capture field
            wrapper     : document.querySelector(".typing-wrapper"),   // Outer arena (gets .focused)
            overlay     : document.getElementById("overlay-layer"),   // Start screen overlay
            overlayMsg  : document.getElementById("overlay-msg"),     // "Click to focus" text
            countdown   : document.getElementById("countdown"),       // Animated countdown digit
            clickMsg    : document.querySelector(".click-msg"),        // Arrow-pointer hint
            timer       : document.getElementById("timer"),           // Live timer display
            wpm         : document.getElementById("wpm"),             // Live WPM display
            accuracy    : document.getElementById("accuracy"),        // Live accuracy display
            modal       : document.getElementById("result-modal"),    // Results overlay
            progressBar : document.getElementById("progress-fill"),   // Progress bar fill
            highScore   : document.getElementById("high-score-val"),  // Best WPM display
            resultWpm   : document.getElementById("final-wpm"),       // Modal: WPM
            resultAcc   : document.getElementById("final-acc"),       // Modal: Accuracy
            resultErr   : document.getElementById("final-err"),       // Modal: Mistakes
            resultChars : document.getElementById("final-chars"),     // Modal: Keystrokes
            resultTime  : document.getElementById("final-time"),      // Modal: Elapsed time
            soundBtn    : document.getElementById("sound-btn"),       // Sound toggle button
            soundStatus : document.getElementById("key-sound-status") // "Sound On / Muted" text
        };

        /* ── Audio element ── */
        this.audio = document.getElementById("key-sound"); // Keystroke sound effect

        /* ── Game State Variables ──────────────────────────────────────────
           These are reset to these exact values by resetGame() on every
           new test. Keep this section in sync with resetGame().            */
        this.maxTime        = 15;    // Test duration in seconds (configurable)
        this.timeLeft       = 15;    // Remaining time (counts down)
        this.timerInterval  = null;  // setInterval reference for cleanup
        this.isTyping       = false; // True while the test is actively running
        this.isCountingDown = false; // True during the 3-2-1 countdown
        this.charIndex      = 0;     // Current cursor position in the text
        this.mistakes       = 0;     // Cumulative uncorrected error count
        this.startTime      = 0;     // Date.now() snapshot at session start
        this.soundEnabled   = true;  // Whether keystroke audio plays
        this.customText     = null;  // User-supplied paragraph (or null = random)

        /* ── Restore personal best from localStorage ── */
        this.loadHighScore();

        /* ── Paragraph Database ─────────────────────────────────────────────
           An array of code-syntax–heavy strings drawn from real programming
           scenarios: async/await, React hooks, SQL, Git, Docker, C++, CSS,
           Python file I/O, and Bash commands. Each string is randomly selected
           by loadParagraph() to keep the test fresh on every round.         */
        this.paragraphs = [
            "const getData = async () => { try { const res = await fetch('api/data'); return res.json(); } catch (err) { console.error(err); } };",
            "import React, { useState } from 'react'; function App() { const [count, setCount] = useState(0); return <div>{count}</div>; }",
            "if (user.isAdmin && user.isLoggedIn) { redirect('/dashboard'); } else { throw new Error('Unauthorized Access'); }",
            "public static void main(String[] args) { System.out.println(\"Hello World\"); int x = 10; int y = 20; int sum = x + y; }",
            "SELECT * FROM users WHERE email = 'admin@example.com' AND status = 'active' ORDER BY created_at DESC LIMIT 5;",
            "git commit -m \"Fixed login bug\"; git push origin main; // Always verify your branch before pushing directly to production.",
            "let numbers = [1, 2, 3, 4, 5]; let squares = numbers.map(n => n * n); console.log(squares); // Output: [1, 4, 9, 16, 25]",
            "docker run -d -p 80:80 --name my-app-container nginx:latest && echo 'Container started successfully'",
            "#include <iostream> using namespace std; int main() { cout << \"C++ is fast!\" << endl; return 0; }",
            "background: linear-gradient(90deg, rgba(2,0,36,1) 0%, rgba(9,9,121,1) 35%, rgba(0,212,255,1) 100%);",
            "try: file = open('data.txt', 'r') content = file.read() finally: file.close() # Always close resources to prevent leaks",
            "border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: grid; place-items: center;",
            "chmod +x script.sh && ./script.sh | grep 'error' > error_log.txt",
            "function debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }"
        ];

        /* ── Boot: attach listeners and render first paragraph ── */
        this.init();
    }


    /* ──────────────────────────────────────────────────────────────────────
       INIT
       Attaches all event listeners. Called once from the constructor.
       Uses event delegation on .control-bar to handle the reset button
       dynamically, avoiding potential null references during page load.
    ────────────────────────────────────────────────────────────────────── */
    init() {

        /* Render the first random paragraph and reset progress bar */
        this.loadParagraph();

        /* Input event: fires on every keystroke / backspace in the hidden field */
        this.dom.input.addEventListener("input", (e) => this.handleInput(e));

        /* Wrapper click: clicking the typing arena focuses the hidden input */
        this.dom.wrapper.addEventListener("click", () => this.handleFocus());

        /* Overlay click: clicking the overlay also triggers focus sequence */
        this.dom.overlay.addEventListener("click", () => this.handleFocus());

        /* Global keydown: desktop shortcut — pressing any printable key auto-starts
           the test without requiring an explicit click on the arena first.      */
        document.addEventListener("keydown", (e) => this.handleGlobalKeydown(e));

        /* Reset button: event delegation so the listener is on the stable parent,
           not the button itself (safer for dynamic DOM).                         */
        document.querySelector(".control-bar").addEventListener("click", (e) => {
            if (e.target.closest("#reset-btn")) this.resetGame();
        });

        /* Config buttons (time selectors: 15s / 30s / 60s) */
        document.querySelectorAll(".hty-config-btn[data-time]").forEach(btn => {
            btn.addEventListener("click", (e) => this.setTime(e));
        });

        /* Sound toggle button */
        this.dom.soundBtn.addEventListener("click", () => this.toggleSound());

        /* Custom text input button */
        document.getElementById("custom-text-btn").addEventListener("click", () => this.setCustomText());
    }


    /* ──────────────────────────────────────────────────────────────────────
       LOAD PARAGRAPH
       Selects a paragraph (random from the pool or the user's custom text),
       splits it into individual characters, wraps each in a <span>, and
       HTML-escapes the content to prevent XSS in custom text. Marks the
       first span as .active (the cursor starting position).
    ────────────────────────────────────────────────────────────────────── */
    loadParagraph() {

        /* Use custom text if set; otherwise pick a random paragraph from the DB */
        const text = this.customText
            ? this.customText
            : this.paragraphs[Math.floor(Math.random() * this.paragraphs.length)];

        /* Clear previous content */
        this.dom.textDisplay.innerHTML = "";

        /* Split into characters, HTML-escape each, wrap in <span> for per-char styling */
        this.dom.textDisplay.innerHTML = text.split("").map(char => {
            /* XSS prevention: escape HTML special characters in custom user text */
            const safe = char
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            return `<span>${safe}</span>`;
        }).join("");

        /* Mark the first character as the initial cursor position */
        const firstChar = this.dom.textDisplay.querySelector("span");
        if (firstChar) firstChar.classList.add("active");

        /* Reset the progress fill bar to 0% */
        this.updateProgressBar(0);
    }


    /* ──────────────────────────────────────────────────────────────────────
       HANDLE FOCUS
       Called when the user clicks the typing arena or the overlay.
       Guards against re-triggering during an active countdown or session.
       If idle, launches the countdown sequence.
    ────────────────────────────────────────────────────────────────────── */
    handleFocus() {
        /* If already in a countdown or active session, just re-focus the input */
        if (this.isCountingDown || this.isTyping) {
            this.dom.input.focus();
            return;
        }
        this.startCountdown();
    }


    /* ──────────────────────────────────────────────────────────────────────
       START COUNTDOWN
       Animates a 3 → 2 → 1 countdown over the overlay before calling
       beginSession(). The CSS animation is restarted each tick using the
       "reflow trick" (read offsetHeight to force a style recalculation).
    ────────────────────────────────────────────────────────────────────── */
    startCountdown() {

        this.isCountingDown = true;

        /* Hide hint text; reveal the large animated digit */
        this.dom.clickMsg.classList.add("hidden");
        this.dom.overlayMsg.classList.add("hidden");
        this.dom.countdown.classList.remove("hidden");

        let count = 3;
        this.dom.countdown.innerText = count;

        const countInterval = setInterval(() => {
            count--;

            if (count > 0) {
                /* Update digit and restart CSS animation by reflow trick */
                this.dom.countdown.innerText = count;
                this.dom.countdown.style.animation = "none";
                this.dom.countdown.offsetHeight; // Force reflow — do not remove this line
                this.dom.countdown.style.animation = "htyPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
            } else {
                /* Countdown finished — clear interval and start the actual session */
                clearInterval(countInterval);
                this.beginSession();
            }
        }, 800); // 800ms per tick → full countdown takes ~2.4 seconds
    }


    /* ──────────────────────────────────────────────────────────────────────
       BEGIN SESSION
       Called when the countdown ends. Removes the overlay, marks the arena
       as focused, resets the hidden input value, and starts the drift-free
       100ms interval timer.
    ────────────────────────────────────────────────────────────────────── */
    beginSession() {
        this.isCountingDown = false;

        /* Remove overlay and add focused class (brand border glow on arena) */
        this.dom.overlay.classList.add("hidden");
        this.dom.wrapper.classList.add("focused");

        /* Clear any stale input value and focus the hidden field */
        this.dom.input.value = "";
        this.dom.input.focus();

        this.isTyping   = true;
        this.startTime  = Date.now(); // Snapshot used for drift-free elapsed calculation

        /* 100ms interval for smooth live WPM and timer updates */
        this.timerInterval = setInterval(() => this.runTimer(), 100);
    }


    /* ──────────────────────────────────────────────────────────────────────
       HANDLE INPUT
       The core per-keystroke logic. Processes one character at a time:
       – If backspace: decrements charIndex, removes error count if the
         deleted character was a mistake.
       – If forward character: marks the span as .correct or .incorrect and
         triggers a visual shake on the wrapper for errors.
       After each keystroke, moves the .active cursor class forward and
       scrolls the active character into view. Calls endGame() if the text
       is fully typed before the timer expires.
    ────────────────────────────────────────────────────────────────────── */
    handleInput(e) {

        /* Guard: ignore input events if the game is not running */
        if (!this.isTyping && !this.isCountingDown) return;

        const characters = this.dom.textDisplay.querySelectorAll("span");
        const typedVal   = this.dom.input.value;
        const typedChar  = typedVal.split("")[this.charIndex]; // Character at current cursor

        /* ── Sound effect ──
           Play the audio clip on every forward keystroke.
           Catch and silently suppress play() promise rejections
           (common on mobile browsers with autoplay restrictions).  */
        if (this.soundEnabled && e.inputType !== "deleteContentBackward") {
            this.audio.currentTime = 0;
            this.audio.play().catch(() => {});
        }

        /* ── Backspace handling ──
           typedChar is undefined when the input value is shorter than charIndex,
           meaning the user deleted a character.                                  */
        if (typedChar == null) {
            if (this.charIndex > 0) {
                this.charIndex--;
                /* If the character being undone was an error, decrement mistake counter */
                if (characters[this.charIndex].classList.contains("incorrect")) {
                    this.mistakes--;
                }
                /* Clear all state classes from the reverted span */
                characters[this.charIndex].className = "";
            }
        }
        /* ── Forward character handling ── */
        else {
            if (this.charIndex < characters.length) {
                /* Compare typed character to expected character */
                if (characters[this.charIndex].innerText === typedChar) {
                    /* Correct keystroke */
                    characters[this.charIndex].classList.add("correct");
                } else {
                    /* Incorrect keystroke: increment mistake counter */
                    this.mistakes++;
                    characters[this.charIndex].classList.add("incorrect");

                    /* CSS shake animation: remove → force reflow → re-add to restart */
                    this.dom.wrapper.classList.remove("error-shake");
                    void this.dom.wrapper.offsetWidth; // Force DOM reflow — do not remove
                    this.dom.wrapper.classList.add("error-shake");
                }
                this.charIndex++;
            }
        }

        /* ── Cursor movement ──
           Remove .active from every span, then re-apply to current position. */
        characters.forEach(span => span.classList.remove("active"));

        if (this.charIndex < characters.length) {
            /* Mark the new cursor position */
            characters[this.charIndex].classList.add("active");
            /* Smooth scroll to keep cursor visible in the fixed-height container */
            characters[this.charIndex].scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
            /* All characters typed before time ran out → end the test early */
            this.endGame();
        }

        /* Sync live stats (delegates to runTimer for time-accuracy) */
        this.updateStats();
    }


    /* ──────────────────────────────────────────────────────────────────────
       UPDATE STATS
       Called after every keystroke. The actual WPM / accuracy computation
       lives in runTimer() / calculateWPM() to keep stats time-accurate.
       This method exists as a hook for future per-keystroke extensions.
    ────────────────────────────────────────────────────────────────────── */
    updateStats() {
        /* Real-time stats are calculated in runTimer() to keep them time-synced.
           No additional logic needed here — the timer loop runs every 100ms. */
    }


    /* ──────────────────────────────────────────────────────────────────────
       RUN TIMER  (called every 100ms)
       Computes elapsed time using Date.now() subtraction (drift-free).
       Updates the visible timer countdown, triggers WPM recalculation,
       and calls endGame() when timeLeft hits 0.
    ────────────────────────────────────────────────────────────────────── */
    runTimer() {
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;

        /* Ceiling to avoid showing 0 a full second early */
        this.timeLeft = Math.max(0, Math.ceil(this.maxTime - elapsedSeconds));
        this.dom.timer.innerText = this.timeLeft;

        /* Recalculate live WPM and accuracy */
        this.calculateWPM(elapsedSeconds);

        /* End condition: time has run out */
        if (this.timeLeft <= 0) {
            this.endGame();
        }
    }


    /* ──────────────────────────────────────────────────────────────────────
       CALCULATE WPM
       Implements the international Net WPM formula:
         Gross WPM = (Total Characters Typed / 5) / (Elapsed Minutes)
         Net WPM   = Gross WPM − (Errors / Elapsed Minutes)
       Net WPM is clamped to 0 (never negative) and handles NaN / Infinity.
       Accuracy is the percentage of correctly typed characters.
    ────────────────────────────────────────────────────────────────────── */
    calculateWPM(elapsedSeconds) {

        /* Skip calculation for the first second to avoid wild initial readings */
        if (elapsedSeconds < 1) return;

        /* Convert elapsed seconds to minutes for standard WPM formulas */
        const elapsedMinutes = elapsedSeconds / 60;

        /* Gross WPM: raw speed before error penalty */
        const grossWPM = (this.charIndex / 5) / elapsedMinutes;

        /* Net WPM: penalises uncorrected errors at a rate per minute */
        let netWPM = Math.round(grossWPM - (this.mistakes / elapsedMinutes));
        if (netWPM < 0 || !isFinite(netWPM)) netWPM = 0;

        this.dom.wpm.innerText = netWPM;

        /* Accuracy: percentage of correctly typed chars over total typed */
        let accuracy = Math.floor(((this.charIndex - this.mistakes) / this.charIndex) * 100);
        this.dom.accuracy.innerText = (isNaN(accuracy) || accuracy < 0) ? 100 : accuracy;

        /* Sync progress bar to character completion percentage */
        this.updateProgressBar(this.charIndex);
    }


    /* ──────────────────────────────────────────────────────────────────────
       UPDATE PROGRESS BAR
       Calculates the percentage of characters typed relative to total
       characters in the current paragraph, then updates the CSS width
       of the fill bar for a smooth real-time progress indicator.
    ────────────────────────────────────────────────────────────────────── */
    updateProgressBar(current) {
        const spans = this.dom.textDisplay.querySelectorAll("span");
        if (spans.length === 0) return;

        const percentage = (current / spans.length) * 100;
        this.dom.progressBar.style.width = percentage + "%";
    }


    /* ──────────────────────────────────────────────────────────────────────
       END GAME
       Stops the timer interval, blurs the hidden input, populates the
       results modal with final stats, saves a new high score if beaten,
       opens the modal, and fires the confetti celebration animation.
    ────────────────────────────────────────────────────────────────────── */
    endGame() {

        clearInterval(this.timerInterval);
        this.isTyping = false;
        this.dom.input.blur(); // Remove keyboard focus (important on mobile)

        /* Capture final live stat values */
        const finalWpm = this.dom.wpm.innerText;
        const finalAcc = this.dom.accuracy.innerText;

        /* Populate modal result fields */
        this.dom.resultWpm.innerText   = finalWpm;
        this.dom.resultAcc.innerText   = finalAcc + "%";
        this.dom.resultErr.innerText   = this.mistakes;
        this.dom.resultChars.innerText = this.charIndex;
        this.dom.resultTime.innerText  = (this.maxTime - this.timeLeft) + "s";

        /* ── High Score Logic ──
           Compare against locally stored best; update if this run is better. */
        const currentBest = parseInt(localStorage.getItem("hypertype_highscore") || 0);
        if (parseInt(finalWpm) > currentBest) {
            localStorage.setItem("hypertype_highscore", finalWpm);
            this.loadHighScore(); // Refresh the on-screen high-score display

            /* Notify user of a new personal best via the global toast system */
            window.showToast("🏆 New Personal Best: " + finalWpm + " WPM!");
        }

        /* Display the results modal */
        this.dom.modal.classList.add("show");

        /* ── Confetti animation ──
           canvas-confetti is loaded as an external script (confetti.browser.min.js).
           The typeof guard prevents errors if the library fails to load. */
        if (typeof confetti === "function") {
            confetti({
                particleCount : 150,
                spread        : 70,
                origin        : { y: 0.6 },
                colors        : ["#00e5ff", "#d124ff", "#00ffaa"]
            });
        }
    }


    /* ──────────────────────────────────────────────────────────────────────
       RESET GAME
       Full state reset: clears the timer, resets all counters and DOM values
       back to initial defaults, hides the results modal, restores the overlay,
       and loads a fresh paragraph. Called by the Reset button and also after
       the user selects a new time configuration.
    ────────────────────────────────────────────────────────────────────── */
    resetGame() {

        /* Stop any running timer */
        clearInterval(this.timerInterval);

        /* Reset game state to defaults */
        this.isTyping   = false;
        this.timeLeft   = this.maxTime;
        this.charIndex  = 0;
        this.mistakes   = 0;
        this.dom.input.value = "";

        /* Reset all live stat displays */
        this.dom.timer.innerText    = this.timeLeft;
        this.dom.wpm.innerText      = 0;
        this.dom.accuracy.innerText = 100;
        this.dom.progressBar.style.width = "0%";

        /* Hide the results modal and remove focused styling */
        this.dom.modal.classList.remove("show");
        this.dom.wrapper.classList.remove("focused");

        /* Restore the start overlay to its idle state */
        this.dom.overlay.classList.remove("hidden");
        this.dom.countdown.classList.add("hidden");
        this.dom.clickMsg.classList.remove("hidden");
        this.dom.overlayMsg.classList.remove("hidden");

        /* Load and render a new paragraph */
        this.loadParagraph();
    }


    /* ──────────────────────────────────────────────────────────────────────
       SET TIME
       Handles clicks on the duration config buttons (15s / 30s / 60s).
       Toggles the .active class on the config bar, updates maxTime,
       and triggers a full reset so the new duration takes effect immediately.
    ────────────────────────────────────────────────────────────────────── */
    setTime(e) {

        /* Clear active state from all config buttons */
        document.querySelectorAll(".hty-config-btn").forEach(btn => btn.classList.remove("active"));

        /* Set active on the clicked button */
        e.target.classList.add("active");

        /* Update test duration from the button's data-time attribute */
        this.maxTime = parseInt(e.target.getAttribute("data-time"));

        /* Full reset so timer display and state reflect the new duration */
        this.resetGame();
    }


    /* ──────────────────────────────────────────────────────────────────────
       TOGGLE SOUND
       Flips the soundEnabled boolean and updates the status label and
       button opacity to give clear visual feedback to the user.
    ────────────────────────────────────────────────────────────────────── */
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;

        /* Update status label and button opacity to reflect current state */
        this.dom.soundStatus.innerText      = this.soundEnabled ? "Sound On" : "Muted";
        this.dom.soundBtn.style.opacity     = this.soundEnabled ? "1" : "0.5";
    }


    /* ──────────────────────────────────────────────────────────────────────
       SET CUSTOM TEXT
       Opens a native browser prompt allowing the user to paste any text or
       code snippet. The input is trimmed and capped at 500 characters for
       performance. A minimum length of 10 characters is enforced to ensure
       the test is meaningful. Uses window.showToast() for user feedback.
    ────────────────────────────────────────────────────────────────────── */
    setCustomText() {
        const text = prompt("Paste your custom code or text here (max 500 characters):");

        if (text && text.trim().length > 10) {
            /* Accept the input: truncate to 500 chars and trigger a reset */
            this.customText = text.trim().substring(0, 500);
            this.resetGame();

            /* Confirm to the user that their custom text was loaded */
            window.showToast("Custom text loaded! Click the arena to start.");
        } else if (text !== null && text.trim().length <= 10) {
            /* Text too short — notify via global toast (error = true) */
            window.showToast("Text too short. Please enter at least 10 characters.", true);
        }
        /* If the user pressed Cancel (text === null), do nothing silently */
    }


    /* ──────────────────────────────────────────────────────────────────────
       LOAD HIGH SCORE
       Reads the 'hypertype_highscore' key from localStorage and updates
       the #high-score-val display element. Defaults to 0 if no score exists.
    ────────────────────────────────────────────────────────────────────── */
    loadHighScore() {
        const score = localStorage.getItem("hypertype_highscore") || 0;
        this.dom.highScore.innerText = score;
    }


    /* ──────────────────────────────────────────────────────────────────────
       HANDLE GLOBAL KEYDOWN  (Desktop Shortcut)
       Allows desktop users to start the test immediately by pressing any
       printable key without first clicking the arena. Guards are in place
       to only trigger this on wide viewports (> 800px) and only when the
       game is truly idle (not typing, not counting down, modal not showing).
       Modifier keys (Ctrl, Meta) are ignored to avoid intercepting shortcuts.
    ────────────────────────────────────────────────────────────────────── */
    handleGlobalKeydown(e) {

        /* Only auto-start on desktop (> 800px width) */
        const isDesktop = window.innerWidth > 800;

        /* Only trigger when idle: not typing, not in countdown, modal closed */
        const isIdle = !this.isTyping && !this.isCountingDown;

        /* Only on printable single characters (excludes Escape, F-keys, etc.) */
        const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey;

        /* Check the results modal is not visible */
        const modalClosed = !this.dom.modal.classList.contains("show");

        if (isDesktop && isIdle && isPrintable && modalClosed) {
            this.handleFocus();
        }
    }

} /* end class HyperEngine */


/* ==========================================================================
   BOOTSTRAP — Instantiate the game engine on DOMContentLoaded equivalent.
   The script tag is placed at the bottom of <body> so the DOM is guaranteed
   to be available by this point without needing an explicit load event.
   ========================================================================== */

/** Global game engine instance — exposed on window scope so the
 *  inline onclick="gameEngine.resetGame()" in the modal button can reach it. */
const gameEngine = new HyperEngine();
