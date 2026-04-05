/**
 * =============================================================================
 *  ULTRA SPEED PRO MAX — ENTERPRISE ENGINE v3.5
 *  File     : script.js
 *  Tool     : Internet Speed Test
 *  Author   : MD KAWSAR
 *  Project  : Trusted Tools Web (CodeCanyon Release Build)
 * =============================================================================
 *
 *  ARCHITECTURE OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  This script uses the Web Worker API to offload all network I/O to a
 *  separate thread, keeping the main UI thread silky-smooth at 60 fps.
 *
 *  The Worker is created from an inline Blob URL (workerScript constant) so
 *  the entire tool remains a single, portable JS file — no external worker
 *  file is needed.
 *
 *  Test sequence (runSuite):
 *    1. Latency  → measurePing() — 6 sequential HEAD requests to Cloudflare
 *    2. Download → runWorkerTest('download') — 4 concurrent stream threads
 *    3. Upload   → runWorkerTest('upload')   — 2 concurrent XHR threads
 *
 *  UI is updated via Canvas API (speed-history graph) and SVG
 *  stroke-dashoffset manipulation (circular gauge).
 *
 *  BUYER NOTE:
 *  The core logic is encapsulated inside runSuite() and the worker blob.
 *  You generally only need to edit the CONFIG object if you want to change
 *  test servers, thread counts, or test duration.
 * =============================================================================
 */

"use strict";


/* =============================================================================
   SECTION 1 — CONFIGURATION & CONSTANTS
   ─────────────────────────────────────────────────────────────────────────────
   Central configuration object. All tuneable parameters are here so that
   the rest of the code stays clean and easy to read.
   Modify only this section when adapting the tool for different CDN endpoints.
============================================================================= */

const CONFIG = {
    /**
     * DL_ENDPOINT — Cloudflare speed test endpoint for download testing.
     * The `bytes` parameter controls the chunk size per request (25 MB).
     * A random `t` query parameter is appended at runtime to bust browser caches.
     */
    DL_ENDPOINT : 'https://speed.cloudflare.com/__down?bytes=25000000',

    /**
     * UL_ENDPOINT — Cloudflare endpoint that accepts POST data for upload testing.
     * A random `t` query parameter is appended at runtime to avoid caching.
     */
    UL_ENDPOINT : 'https://speed.cloudflare.com/__up',

    /**
     * PING_ENDPOINT — Lightweight Cloudflare trace file used for latency
     * measurement. Each fetch round-trip time is recorded as a ping sample.
     */
    PING_ENDPOINT : 'https://1.1.1.1/cdn-cgi/trace',

    /**
     * THREADS — Number of concurrent download streams launched by the Worker.
     * More threads saturate high-bandwidth connections (e.g., 1 Gbps fibre).
     * Default: 4 streams (suitable for most residential connections).
     */
    THREADS : 4,

    /**
     * DURATION — Duration of each test phase in milliseconds.
     * The download and upload workers self-terminate after this time.
     * Default: 8000 ms (8 seconds per phase).
     */
    DURATION : 8000,

    /**
     * GAUGE_MAX — Initial maximum Mbps value for the gauge scale.
     * The JS engine auto-scales beyond 100 Mbps dynamically.
     */
    GAUGE_MAX : 100,

    /**
     * CIRCUMFERENCE — Stroke circumference of the SVG progress ring.
     * Formula: 2 × π × r  →  2 × 3.14159 × 160 ≈ 1005
     * Used to calculate stroke-dashoffset for the gauge progress animation.
     */
    CIRCUMFERENCE : 1005,

    /**
     * FETCH_TIMEOUT_MS — Hard timeout for individual network requests in the
     * latency measurement phase and the network detection phase.
     * Prevents the UI from hanging indefinitely on a flaky connection.
     */
    FETCH_TIMEOUT_MS : 5000,

    /**
     * NETWORK_DETECT_RETRY — Maximum retry attempts for the network info
     * detection fetch before falling back to placeholder text.
     */
    NETWORK_DETECT_RETRY : 2,

    /**
     * CHART_THROTTLE_MS — Minimum gap between canvas + gauge redraws in ms.
     * ~30 fps cap (33 ms). Prevents wasted CPU cycles on the main thread.
     */
    CHART_THROTTLE_MS : 33,

    /**
     * PING_SAMPLES — Number of round-trip fetches used to calculate ping/jitter.
     */
    PING_SAMPLES : 6
};


/* =============================================================================
   SECTION 2 — DOM ELEMENT CACHE
   ─────────────────────────────────────────────────────────────────────────────
   All DOM elements are resolved once at script load and stored in the ELS
   object. This avoids repeated querySelector calls throughout the code and
   makes element references easy to find in one place.
============================================================================= */

const ELS = {
    /** Primary CTA button — triggers runSuite() on click */
    btn        : document.getElementById('startBtn'),

    /** SVG circle element whose stroke-dashoffset drives the gauge animation */
    gaugeRing  : document.getElementById('gaugeProgress'),

    /** Large live speed readout centred inside the circular gauge */
    speedNum   : document.getElementById('mainSpeedDisplay'),

    /** Phase badge below the gauge (IDLE / DOWNLOAD / UPLOAD / DONE) */
    phaseBadge : document.getElementById('phaseBadge'),

    /** Status bar text label in the interface header */
    status     : document.getElementById('statusDisplay'),

    /** <canvas> element for the live speed-history graph */
    canvas     : document.getElementById('speedGraph'),

    /* ── Metric value elements (updated live by the test engine) ── */
    ping   : document.getElementById('pingVal'),
    jitter : document.getElementById('jitterVal'),
    down   : document.getElementById('downVal'),
    up     : document.getElementById('upVal'),

    /* ── Network information displays ── */
    ip  : document.getElementById('ipVal'),
    isp : document.getElementById('ispVal')
};


/* =============================================================================
   SECTION 3 — MODULE-LEVEL STATE
   ─────────────────────────────────────────────────────────────────────────────
   Shared mutable state used across functions. Kept minimal to avoid
   unintended side-effects between test runs.
============================================================================= */

/** Prevents runSuite() from being triggered while a test is already running */
let isRunning = false;

/**
 * Array of recent speed samples (Mbps) displayed on the canvas chart.
 * Capped at 100 samples; oldest entries are shifted out as new ones arrive.
 */
let chartPoints = [];

/**
 * Stores the requestAnimationFrame handle so it can be cancelled if needed.
 * Currently reserved for future animation loop extensions.
 */
let animationId;

/**
 * 2D rendering context for the canvas speed-history graph.
 * Initialised by initCanvas() on DOMContentLoaded and re-initialised on resize.
 */
let ctx;

/**
 * Stores the debounce timer handle for the resize event so rapid resize events
 * do not trigger redundant canvas re-initialisations on every pixel change.
 */
let resizeDebounceTimer;

/**
 * Tracks the currently active Web Worker instance so it can be explicitly
 * terminated if the user closes the page mid-test, preventing memory leaks.
 */
let activeWorker = null;


/* =============================================================================
   SECTION 4 — WEB WORKER BLOB
   ─────────────────────────────────────────────────────────────────────────────
   The worker script is embedded as a template-literal string and converted to
   an Object URL Blob. This approach keeps the entire tool self-contained in a
   single JS file — no separate worker.js file is required for deployment.
   The worker handles all network I/O, reporting back bytes transferred and
   elapsed time so the main thread can calculate Mbps without blocking the UI.
============================================================================= */

/**
 * workerScript — The source code of the Web Worker as a string.
 *
 * Message protocol (postMessage to worker):
 *   { type: 'download'|'upload', url: string, duration: number, threads: number }
 *
 * Message protocol (postMessage to main thread, each ~30 ms):
 *   { bytes: number, time: number }
 *   bytes — total bytes transferred since the test started
 *   time  — elapsed milliseconds since the test started
 */
const workerScript = `
"use strict";

self.onmessage = async function(e) {
    const { type, url, duration, threads } = e.data;

    if (type === 'download') {
        /*
         * DOWNLOAD MODE
         * ─────────────
         * Launches 'threads' concurrent fetch streams. Each stream reads the
         * response body chunk-by-chunk, accumulating the total byte count
         * and posting progress updates back to the main thread.
         * A setTimeout flag halts all streams after CONFIG.DURATION ms.
         */
        let totalBytes = 0;
        const startTime = performance.now();
        let active = true;

        /* Stop flag — all fetch loops check this and exit when false */
        setTimeout(() => { active = false; }, duration);

        const fetchStream = async () => {
            while (active) {
                try {
                    /* Append random query param to bypass CDN / browser caches */
                    const controller = new AbortController();
                    const abortTimer = setTimeout(() => controller.abort(), duration + 2000);
                    const response = await fetch(url + '&t=' + Math.random(), {
                        signal: controller.signal
                    });
                    clearTimeout(abortTimer);

                    if (!response.ok) break;
                    const reader = response.body.getReader();

                    while (true) {
                        if (!active) { reader.cancel(); break; }
                        const { done, value } = await reader.read();
                        if (done) break;

                        totalBytes += value.length;

                        /* Report cumulative bytes and elapsed time to main thread */
                        self.postMessage({
                            bytes : totalBytes,
                            time  : performance.now() - startTime
                        });
                    }
                } catch (err) {
                    /* Silently break on network error; the loop will retry */
                    break;
                }
            }
        };

        /* Launch the configured number of concurrent download streams */
        const streams = [];
        for (let i = 0; i < threads; i++) streams.push(fetchStream());

        /* Cleanly await all streams; errors are already handled inside fetchStream */
        await Promise.allSettled(streams);

    } else if (type === 'upload') {
        /*
         * UPLOAD MODE
         * ───────────
         * Uses XMLHttpRequest instead of fetch because XHR exposes granular
         * upload.onprogress events, making it straightforward to measure
         * how many bytes have been sent at any moment.
         * Two threads are used for upload (sufficient to saturate most ISPs).
         */
        const startTime  = performance.now();
        let totalLoaded  = 0;
        let active       = true;

        /* Stop flag — mirrors the download mode pattern */
        setTimeout(() => { active = false; }, duration);

        /* 2 MB dummy payload — browser sends this as the POST body */
        const data = new Uint8Array(2 * 1024 * 1024);

        const uploadThread = () => {
            /* Stop launching new requests once the test duration has elapsed */
            if (!active || performance.now() - startTime > duration) return;

            const xhr = new XMLHttpRequest();
            xhr.open('POST', url + '?t=' + Math.random(), true);
            xhr.timeout = duration + 2000;

            /* Progress event fires as each chunk is sent to the server */
            xhr.upload.onprogress = (ev) => {
                const now = performance.now();
                self.postMessage({
                    bytes : totalLoaded + ev.loaded,
                    time  : now - startTime
                });
            };

            /* On successful upload, accumulate bytes and start the next request */
            xhr.onload = () => {
                totalLoaded += 2 * 1024 * 1024;
                uploadThread();
            };

            /* Retry on network error */
            xhr.onerror = () => {
                uploadThread();
            };

            xhr.ontimeout = () => {
                /* Timeout is not a hard failure; just abandon this request */
            };

            xhr.send(data);
        };

        /* Launch 2 concurrent upload threads */
        for (let i = 0; i < 2; i++) uploadThread();
    }
};
`;

/**
 * Convert the worker source string into a Blob URL so it can be passed to
 * the Worker constructor without requiring a separate .js file on disk.
 */
const blob      = new Blob([workerScript], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);


/* =============================================================================
   SECTION 5 — INITIALISATION
   ─────────────────────────────────────────────────────────────────────────────
   Runs once the DOM is fully parsed. Sets up:
     • Network info detection (IP + ISP)
     • Canvas initialisation
     • Start button click listener
     • MutationObserver to redraw the canvas grid on theme toggle
============================================================================= */

document.addEventListener('DOMContentLoaded', () => {

    /* Detect and display the user's public IP address and ISP name */
    detectNetwork();

    /* Initialise the canvas element dimensions and draw the idle baseline grid */
    initCanvas();

    /* Attach the primary CTA — clicking starts the full test suite */
    ELS.btn.addEventListener('click', runSuite);

    /**
     * MutationObserver — watches for class changes on <body>.
     * When the user toggles light/dark mode, global.js adds/removes the
     * 'light-mode' class on <body>. We need to redraw the canvas grid so
     * the grid line colour updates to match the new theme's CSS variables.
     */
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                /* Redraw the idle grid with updated CSS variable colours */
                drawEmptyGrid();
            }
        });
    });
    themeObserver.observe(document.body, { attributes: true });

    /**
     * Cleanup on page unload — terminate any running worker and revoke the
     * Blob Object URL to free memory immediately. Without this, the Blob URL
     * leaks for the lifetime of the browser tab.
     */
    window.addEventListener('pagehide', () => {
        if (activeWorker) {
            activeWorker.terminate();
            activeWorker = null;
        }
        URL.revokeObjectURL(workerUrl);
    });
});


/* =============================================================================
   SECTION 6 — CANVAS GRAPHICS ENGINE
   ─────────────────────────────────────────────────────────────────────────────
   Manages the live speed-history line chart drawn on the <canvas> element.
   The chart displays the last 100 Mbps samples as a gradient line with a
   soft glow fill beneath it.
============================================================================= */

/**
 * initCanvas()
 * ─────────────
 * Sets the canvas pixel dimensions to match its CSS-rendered size (ensuring
 * sharp rendering on HiDPI / Retina displays) and obtains the 2D context.
 * Called on DOMContentLoaded and again on every window resize.
 */
function initCanvas() {
    if (!ELS.canvas) return;

    /*
     * HiDPI / Retina scaling — multiply logical CSS pixels by devicePixelRatio
     * so canvas bitmap resolution matches the physical screen, eliminating blur.
     */
    const dpr = window.devicePixelRatio || 1;
    const cssW = ELS.canvas.offsetWidth;
    const cssH = ELS.canvas.offsetHeight;

    ELS.canvas.width  = cssW * dpr;
    ELS.canvas.height = cssH * dpr;
    ELS.canvas.style.width  = cssW + 'px';
    ELS.canvas.style.height = cssH + 'px';

    ctx = ELS.canvas.getContext('2d');
    ctx.scale(dpr, dpr); /* Scale all draw calls to match the physical pixel density */
    drawEmptyGrid();
}

/**
 * getCSSColor(varName)
 * ────────────────────
 * Reads a CSS custom property value from the computed style of <body>.
 * Used to bridge CSS variable colours (which change on theme toggle) into
 * the Canvas 2D API (which only accepts resolved colour strings).
 *
 * @param {string} varName — CSS variable name (e.g., '--brand-primary')
 * @returns {string}       — Resolved colour string (e.g., '#ff0055')
 */
function getCSSColor(varName) {
    return getComputedStyle(document.body).getPropertyValue(varName).trim();
}

/**
 * drawEmptyGrid()
 * ───────────────
 * Clears the canvas and draws a single horizontal baseline across the
 * vertical midpoint. This "idle grid" is displayed before and between tests.
 * The line colour is sourced from the CSS variable --chart-grid (defined in
 * the tool-specific CSS block) so it adapts to light/dark mode automatically.
 */
function drawEmptyGrid() {
    if (!ctx || !ELS.canvas) return;
    const w = ELS.canvas.offsetWidth;
    const h = ELS.canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getCSSColor('--chart-grid');
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
}

/**
 * updateChart(val, max)
 * ──────────────────────
 * Pushes the latest speed sample into chartPoints, then redraws the full
 * speed-history line chart. Older points scroll left as new ones appear on
 * the right (FIFO ring buffer limited to 100 samples).
 *
 * Visual output:
 *   • Gradient stroke from --brand-primary → --brand-accent
 *   • Semi-transparent fill beneath the stroke line for glow depth
 *   • Y-axis is normalised relative to 'max' with a 20% headroom buffer
 *
 * @param {number} val — Current speed in Mbps (newest data point)
 * @param {number} max — Maximum expected Mbps (used for Y-axis scaling)
 */
function updateChart(val, max) {
    if (!ctx || !ELS.canvas) return;

    chartPoints.push(val);
    if (chartPoints.length > 100) chartPoints.shift();

    const w = ELS.canvas.offsetWidth;
    const h = ELS.canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);

    if (chartPoints.length < 2) return;

    /* ── Build the polyline path ── */
    ctx.beginPath();
    const step = w / 100;

    for (let i = 0; i < chartPoints.length; i++) {
        const x = i * step;
        /* 1.2 multiplier adds a 20% headroom buffer above the max so the
           line never touches the very top edge of the canvas */
        const y = h - ((chartPoints[i] / (max * 1.2)) * h);
        const clampedY = Math.max(0, Math.min(h, y)); /* Clamp to canvas bounds */
        if (i === 0) ctx.moveTo(x, clampedY);
        else         ctx.lineTo(x, clampedY);
    }

    /* ── Gradient stroke using brand colours ── */
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, getCSSColor('--brand-primary'));
    grad.addColorStop(1, getCSSColor('--brand-accent'));
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();

    /* ── Soft glow fill beneath the line (brand-primary at ~10% opacity) ── */
    ctx.lineTo(chartPoints.length * step, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = getCSSColor('--brand-primary') + '1A'; /* 1A hex ≈ 10% alpha */
    ctx.fill();
}


/* =============================================================================
   SECTION 7 — MAIN TEST ORCHESTRATOR (runSuite)
   ─────────────────────────────────────────────────────────────────────────────
   Coordinates the full three-phase test sequence:
     Phase 1 — Latency (Ping + Jitter)
     Phase 2 — Download speed
     Phase 3 — Upload speed
   Updates the UI at each stage and handles errors gracefully.
============================================================================= */

/**
 * runSuite()
 * ──────────
 * Async orchestrator that runs all three test phases in sequence.
 * Guards against concurrent runs with the 'isRunning' flag.
 * All UI state changes (badge, status, gauge colour, button label) are
 * driven from this function.
 */
async function runSuite() {
    /* Prevent multiple simultaneous test runs */
    if (isRunning) return;
    isRunning = true;
    resetUI();

    try {
        /* ────── PHASE 1: LATENCY TEST ────── */
        updateStatus('MEASURING LATENCY', getCSSColor('--text-muted'));
        const { ping, jitter } = await measurePing();

        /* Animate the Ping and Jitter values into their display elements */
        animateNumber(ELS.ping,   ping,   0); /* No decimal places for ms */
        animateNumber(ELS.jitter, jitter, 0);
        await wait(500); /* Brief pause before transitioning to download */

        /* ────── PHASE 2: DOWNLOAD TEST ────── */
        updateStatus('TESTING DOWNLOAD', getCSSColor('--brand-primary'));
        setPhaseBadge('DOWNLOAD', 'active');
        setGaugeColor(getCSSColor('--brand-primary'));

        const dlSpeed = await runWorkerTest('download', CONFIG.DL_ENDPOINT);
        animateNumber(ELS.down, dlSpeed, 1); /* 1 decimal place for Mbps */
        ELS.speedNum.innerText = dlSpeed;
        await wait(1000); /* Pause to let the user read the download result */

        /* ────── PHASE 3: UPLOAD TEST ────── */
        chartPoints = []; /* Reset chart history for a clean upload graph */
        updateStatus('TESTING UPLOAD', getCSSColor('--brand-secondary'));
        setPhaseBadge('UPLOAD', 'active');
        setGaugeColor(getCSSColor('--brand-secondary'));

        const ulSpeed = await runWorkerTest('upload', CONFIG.UL_ENDPOINT);
        animateNumber(ELS.up, ulSpeed, 1);
        ELS.speedNum.innerText = ulSpeed;

        /* ────── COMPLETE ────── */
        updateStatus('TEST COMPLETE', '#238636');
        setGaugeProgress(100); /* Pin gauge at 100% as a success indicator */
        ELS.btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> TEST AGAIN';
        ELS.btn.disabled  = false;
        setPhaseBadge('DONE', 'active');

        /* Notify the user that the test has finished successfully */
        if (typeof window.showToast === 'function') {
            window.showToast('Speed test complete! Results are ready.');
        }

    } catch (err) {
        /* Network or API error — surface a clear error notification */
        console.error('[Ultra Speed Pro Max] Test error:', err);
        updateStatus('CONNECTION ERROR', '#ff0050');
        setPhaseBadge('ERROR', '');
        setGaugeColor('#ff0050');
        ELS.btn.innerHTML = '<i class="fa-solid fa-bolt"></i> START ANALYSIS';
        ELS.btn.disabled  = false;

        /* Use the global toast system for error notification (boolean true = error) */
        if (typeof window.showToast === 'function') {
            window.showToast('Connection error. Please check your network and try again.', true);
        }

    } finally {
        /* Always release the running lock so the user can retry */
        isRunning = false;
        activeWorker = null;
    }
}


/* =============================================================================
   SECTION 8 — WEB WORKER BRIDGE (runWorkerTest)
   ─────────────────────────────────────────────────────────────────────────────
   Creates a fresh Worker instance for each test phase, sends configuration
   parameters, listens for progress messages, throttles UI updates to ~30 fps,
   and resolves the Promise with the peak speed recorded during the test.
============================================================================= */

/**
 * runWorkerTest(type, url)
 * ─────────────────────────
 * Spawns a Web Worker from the inline Blob URL, runs a download or upload
 * test, streams real-time progress to the UI, and resolves with the maximum
 * Mbps recorded during the test duration.
 *
 * @param  {string} type — 'download' or 'upload'
 * @param  {string} url  — The CDN endpoint URL to test against
 * @returns {Promise<number>} — Peak measured speed in Mbps
 */
function runWorkerTest(type, url) {
    return new Promise((resolve, reject) => {
        /* Terminate any lingering worker from a previous failed run */
        if (activeWorker) {
            activeWorker.terminate();
            activeWorker = null;
        }

        const worker    = new Worker(workerUrl);
        activeWorker    = worker;
        let   maxSpeed  = 0;  /* Tracks the highest single-sample speed seen */
        let   lastUpdate = 0; /* Timestamp of the last UI refresh (throttling) */
        let   settled   = false; /* Guards against double-resolve/reject */

        /* Guard: safely settle the promise only once */
        const settle = (fn, value) => {
            if (settled) return;
            settled = true;
            worker.terminate();
            activeWorker = null;
            fn(value);
        };

        /* Send test parameters to the worker thread */
        worker.postMessage({
            type     : type,
            url      : url,
            duration : CONFIG.DURATION,
            threads  : CONFIG.THREADS
        });

        /**
         * worker.onmessage — Receives cumulative byte/time samples from the
         * worker and converts them into Mbps, applying TCP overhead compensation.
         */
        worker.onmessage = (e) => {
            const { bytes, time } = e.data;
            const durationSec = time / 1000;
            if (durationSec <= 0) return;

            /*
             * Convert cumulative bytes → bits → Mbps.
             * Formula: (bytes × 8) / elapsed_seconds / 1,000,000
             */
            const bps  = (bytes * 8) / durationSec;
            const mbps = bps / 1_000_000;

            /*
             * TCP/IP Overhead Compensation (+6%)
             * Raw fetch bytes do not include TCP headers, IP headers, or
             * TLS handshake overhead. A 6% multiplier brings the reading
             * closer to the true line speed reported by ISPs.
             */
            const speed = parseFloat((mbps * 1.06).toFixed(2));

            /*
             * UI Throttle — limit canvas + gauge redraws to ~30 fps.
             * (time - lastUpdate > 30 ms ≈ 33.3 fps cap)
             * Without throttling, the canvas redraw would run hundreds of
             * times per second and waste CPU on the main thread.
             */
            if (time - lastUpdate > CONFIG.CHART_THROTTLE_MS) {
                ELS.speedNum.innerText = speed.toFixed(2);

                /*
                 * Dynamic Gauge Scaling:
                 *   ≤ 100 Mbps  → gauge maps 0–100 Mbps to 0–100%
                 *   ≤ 500 Mbps  → gauge maps 0–500 Mbps to 0–100%
                 *   > 500 Mbps  → gauge maps 0–1000 Mbps to 0–100%
                 * This auto-zoom prevents the gauge from pegging at 100%
                 * on high-speed fibre connections.
                 */
                let gaugeMax = 100;
                if (speed > 500) gaugeMax = 1000;
                else if (speed > 100) gaugeMax = 500;
                const gaugePercent = Math.min((speed / gaugeMax) * 100, 100);

                setGaugeProgress(gaugePercent);
                updateChart(speed, gaugeMax);
                lastUpdate = time;
            }

            /* Track the peak speed across all worker messages */
            if (speed > maxSpeed) maxSpeed = speed;
        };

        /**
         * worker.onerror — Catches unhandled worker-side exceptions and
         * rejects the promise so the runSuite() catch block handles it.
         */
        worker.onerror = (err) => {
            console.error('[Ultra Speed Pro Max] Worker error:', err.message);
            settle(reject, new Error(err.message || 'Worker failed'));
        };

        /**
         * setTimeout — Terminates the worker after (DURATION + 100 ms) and
         * resolves the promise with the highest speed recorded.
         * The extra 100 ms buffer ensures the final worker message has arrived
         * and been processed before we terminate.
         */
        setTimeout(() => {
            settle(resolve, maxSpeed);
        }, CONFIG.DURATION + 100);
    });
}


/* =============================================================================
   SECTION 9 — LATENCY MEASUREMENT (measurePing)
   ─────────────────────────────────────────────────────────────────────────────
   Sends 6 sequential fetch requests to the Cloudflare trace endpoint and
   records the round-trip time of each. The lowest recorded time is returned
   as the Ping value. Jitter is calculated as the average absolute deviation
   between consecutive samples.
============================================================================= */

/**
 * measurePing()
 * ─────────────
 * Measures network latency (ping) and stability (jitter) by sending
 * 6 sequential round-trip fetch requests and analysing the timing data.
 *
 * Ping  = the lowest single round-trip time (most accurate representation
 *         of the best-case latency for a real request).
 * Jitter = average absolute difference between consecutive ping samples
 *          (measures consistency / stability of the connection).
 *
 * @returns {Promise<{ping: number, jitter: number}>} — Both in milliseconds (integer)
 */
async function measurePing() {
    const pings = [];
    const SAMPLES = CONFIG.PING_SAMPLES;

    for (let i = 0; i < SAMPLES; i++) {
        const start = performance.now();
        try {
            /* 'no-store' cache mode ensures the browser makes a real network request */
            await fetchWithTimeout(
                CONFIG.PING_ENDPOINT + '?t=' + Math.random(),
                { cache: 'no-store' },
                CONFIG.FETCH_TIMEOUT_MS
            );
            pings.push(performance.now() - start);
        } catch (e) {
            /* If the request fails, use 100 ms as a conservative fallback sample */
            pings.push(100);
        }
    }

    /* Sort samples ascending; the lowest represents the best-case ping */
    pings.sort((a, b) => a - b);
    const ping = Math.floor(pings[0]);

    /* Calculate jitter: average absolute deviation between consecutive samples */
    let totalDeviation = 0;
    for (let i = 0; i < pings.length - 1; i++) {
        totalDeviation += Math.abs(pings[i] - pings[i + 1]);
    }
    const jitter = Math.floor(totalDeviation / (pings.length - 1));

    return { ping, jitter };
}


/* =============================================================================
   SECTION 10 — NETWORK INFORMATION DETECTION (detectNetwork)
   ─────────────────────────────────────────────────────────────────────────────
   Fetches the user's public IP address from the Cloudflare trace endpoint,
   then performs a secondary lookup against ipapi.co to retrieve the ISP name.
   All requests are fire-and-forget; failures degrade gracefully to placeholder
   text so the UI never appears broken.
============================================================================= */

/**
 * detectNetwork()
 * ───────────────
 * Asynchronously fetches and displays:
 *   • Public IP address  → from 1.1.1.1/cdn-cgi/trace (plain-text response)
 *   • ISP organisation   → from ipapi.co/json (JSON response, 'org' field)
 *
 * Both requests are non-blocking. Failures update the display elements with
 * appropriate placeholder text ("Hidden" / "VPN/Proxy" or "Private Network").
 */
async function detectNetwork() {
    let attempt = 0;
    let ipDetected = false;

    while (attempt <= CONFIG.NETWORK_DETECT_RETRY && !ipDetected) {
        try {
            const res  = await fetchWithTimeout(
                'https://1.1.1.1/cdn-cgi/trace',
                {},
                CONFIG.FETCH_TIMEOUT_MS
            );
            const data = await res.text();

            /* Extract the IP line from the plain-text trace response */
            const ipMatch = data.match(/ip=(.+)/);
            if (ELS.ip) ELS.ip.innerText = ipMatch ? ipMatch[1].trim() : 'Unknown';
            ipDetected = true;

            /* Secondary ISP lookup using ipapi.co (free tier) */
            try {
                const ispRes  = await fetchWithTimeout(
                    'https://ipapi.co/json/',
                    {},
                    CONFIG.FETCH_TIMEOUT_MS
                );
                const ispData = await ispRes.json();
                if (ELS.isp) ELS.isp.innerText = sanitizeText(ispData.org) || 'Unknown ISP';
            } catch {
                /* ipapi.co request failed — likely behind a privacy proxy */
                if (ELS.isp) ELS.isp.innerText = 'Private Network';
            }

        } catch {
            attempt++;
            if (attempt > CONFIG.NETWORK_DETECT_RETRY) {
                /* Cloudflare trace request failed — user may be behind a VPN/proxy */
                if (ELS.ip)  ELS.ip.innerText  = 'Hidden';
                if (ELS.isp) ELS.isp.innerText = 'VPN/Proxy';
            } else {
                /* Brief delay before retrying */
                await wait(800);
            }
        }
    }
}


/* =============================================================================
   SECTION 11 — UI HELPERS & ANIMATION UTILITIES
   ─────────────────────────────────────────────────────────────────────────────
   Small, focused functions that handle individual UI state changes.
   Keeping these as separate named functions makes the runSuite() orchestrator
   clean and easy to read.
============================================================================= */

/**
 * resetUI()
 * ─────────
 * Returns all UI elements to their initial idle state before a new test run.
 * Clears the chart data buffer, resets the gauge to zero, and restores all
 * stat displays to their placeholder "--" state.
 */
function resetUI() {
    ELS.btn.disabled  = true;
    ELS.btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ANALYZING...';
    if (ELS.ping)   ELS.ping.innerText   = '--';
    if (ELS.jitter) ELS.jitter.innerText = '--';
    if (ELS.down)   ELS.down.innerText   = '--';
    if (ELS.up)     ELS.up.innerText     = '--';
    chartPoints = []; /* Clear historical speed samples */
    setGaugeProgress(0); /* Reset the SVG gauge ring to empty */
    drawEmptyGrid();
}

/**
 * setGaugeProgress(percent)
 * ─────────────────────────
 * Updates the SVG circular gauge by manipulating stroke-dashoffset.
 * A stroke-dashoffset of 0 = full ring visible (100%), and
 * CONFIG.CIRCUMFERENCE = empty ring (0%).
 *
 * @param {number} percent — Value between 0 and 100
 */
function setGaugeProgress(percent) {
    if (!ELS.gaugeRing) return;
    /* Clamp the percentage to the valid 0–100 range */
    percent = Math.min(Math.max(percent, 0), 100);
    const offset = CONFIG.CIRCUMFERENCE - ((percent / 100) * CONFIG.CIRCUMFERENCE);
    ELS.gaugeRing.style.strokeDashoffset = offset;
}

/**
 * setGaugeColor(color)
 * ─────────────────────
 * Changes the stroke colour and glow drop-shadow of the SVG progress ring.
 * Called at the start of each test phase (download = brand-primary,
 * upload = brand-secondary) so the gauge visually signals the active phase.
 *
 * @param {string} color — Any CSS colour string (hex, rgb, etc.)
 */
function setGaugeColor(color) {
    if (!ELS.gaugeRing) return;
    ELS.gaugeRing.style.stroke = color;
    ELS.gaugeRing.style.filter = `drop-shadow(0 0 10px ${color})`;
}

/**
 * updateStatus(text, color)
 * ──────────────────────────
 * Updates the status bar text label and the pulse dot colour in the
 * interface header. Both the text and the dot reflect the current phase.
 *
 * @param {string} text  — Status message (e.g., 'TESTING DOWNLOAD')
 * @param {string} color — Colour for the status text and pulse dot
 */
function updateStatus(text, color) {
    if (!ELS.status) return;
    ELS.status.innerText   = text;
    ELS.status.style.color = color;

    /* Locate the status dot and update its colour and glow */
    const dot = document.querySelector('.isp-status-dot');
    if (dot) {
        dot.style.background = color;
        dot.style.boxShadow  = `0 0 10px ${color}`;
    }
}

/**
 * setPhaseBadge(text, state)
 * ───────────────────────────
 * Updates the phase badge below the circular gauge. Adding the 'active' class
 * triggers the glowing brand-primary CSS state (defined in tools-template.css).
 *
 * @param {string} text  — Badge label (e.g., 'DOWNLOAD', 'DONE')
 * @param {string} state — 'active' to enable glow style, any other value removes it
 */
function setPhaseBadge(text, state) {
    if (!ELS.phaseBadge) return;
    ELS.phaseBadge.innerText = text;
    if (state === 'active') ELS.phaseBadge.classList.add('active');
    else                    ELS.phaseBadge.classList.remove('active');
}

/**
 * animateNumber(el, val, decimals)
 * ──────────────────────────────────
 * Instantly updates a stat value element's innerText and plays a brief
 * CSS scale "pop" animation using the Web Animations API. The scale effect
 * draws the user's attention to the newly populated value.
 *
 * @param {HTMLElement} el       — The element to update (e.g., ELS.ping)
 * @param {number}      val      — Numeric value to display
 * @param {number}      decimals — Number of decimal places to show
 */
function animateNumber(el, val, decimals) {
    if (!el) return;
    el.innerText = parseFloat(val).toFixed(decimals);

    /* Subtle scale pop via Web Animations API (no external library needed) */
    el.animate(
        [
            { transform: 'scale(1)'   },
            { transform: 'scale(1.2)' },
            { transform: 'scale(1)'   }
        ],
        { duration: 200, easing: 'ease-out' }
    );
}

/**
 * wait(ms)
 * ─────────
 * Returns a Promise that resolves after the specified number of milliseconds.
 * Used throughout runSuite() to introduce deliberate pauses between phases
 * so the user has time to read each result before the next phase starts.
 *
 * @param {number} ms — Duration to wait in milliseconds
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));


/* =============================================================================
   SECTION 12 — WINDOW RESIZE HANDLER
   ─────────────────────────────────────────────────────────────────────────────
   Reinitialises the canvas whenever the window is resized. This is necessary
   because the canvas element's width/height attributes must match its CSS
   rendered size to avoid blurry or distorted graph lines.
============================================================================= */

/**
 * Resize listener — re-measures the canvas container and reinitialises
 * the 2D context so the graph remains pixel-perfect at any viewport size.
 * A debounce wrapper prevents redundant reinitialisation during fast drags.
 */
window.addEventListener('resize', () => {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(initCanvas, 150);
});


/* =============================================================================
   SECTION 13 — UTILITY HELPERS
   ─────────────────────────────────────────────────────────────────────────────
   Generic reusable helpers that support the core engine without belonging
   to any single feature section.
============================================================================= */

/**
 * fetchWithTimeout(url, options, timeoutMs)
 * ─────────────────────────────────────────
 * Wraps the native fetch() API with an AbortController-based timeout.
 * If the request does not complete within timeoutMs, the AbortController
 * cancels it and the returned Promise rejects with a TimeoutError.
 * This prevents the UI from hanging indefinitely on a stalled request.
 *
 * @param {string}  url       — The URL to fetch
 * @param {object}  options   — Standard fetch init options
 * @param {number}  timeoutMs — Abort deadline in milliseconds
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(url, options = {}, timeoutMs = CONFIG.FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

/**
 * sanitizeText(str)
 * ─────────────────
 * Strips HTML tags and trims whitespace from a string before displaying it
 * in the DOM. Used to sanitise third-party API responses (e.g., ISP names)
 * and prevent accidental XSS injection via malformed API data.
 *
 * @param {*}      str — Input value (may not be a string)
 * @returns {string}   — Cleaned, trimmed string safe for innerText assignment
 */
function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim();
}
