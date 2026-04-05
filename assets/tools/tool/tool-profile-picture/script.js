/**
 * ==========================================================================
 * IDENTITY MATRIX V6 ULTIMATE — COMMERCIAL RELEASE BUILD
 * ==========================================================================
 * Tool Name   : Identity Matrix V6 — Secure Avatar & Glitch Art Generator
 * Author      : MD KAWSAR
 * Platform    : Trusted Tools Web
 * Build Date  : February 13, 2026
 *
 * ARCHITECTURE OVERVIEW:
 * ─────────────────────────────────────────────────────────────────────────
 * This script powers a 100% client-side, privacy-first avatar generator.
 * All computation (hashing, PRNG seeding, canvas rendering) runs entirely
 * in the browser — no network requests are made for generation or export.
 *
 * CORE FEATURES:
 * 1. Deterministic Seeded Randomness  — Mulberry32 PRNG + MurmurHash3 (cyrb128)
 *    ensures that the same input string ALWAYS produces the same visual output.
 * 2. Nine Re-engineered Art Engines   — pixel, circuit, glitch, nebula, bauhaus,
 *    ring, marble, matrix, mosaic.
 * 3. Vector-based Logic Scaling       — art engines use relative math (w/h ratios)
 *    so that the same algorithm renders crisply at 512px or 2048px (Ultra 4K).
 * 4. HUD Controls                     — shape toggle (circle/square), sticker mode,
 *    live animation loop, auto-pilot randomiser.
 * 5. Global Toast Integration         — all user notifications route through
 *    window.showToast() (injected by global.js). No local toast infrastructure.
 *
 * DEPENDENCY:
 *   window.showToast(message, isError) — provided by global.js at runtime.
 *
 * CHANGE LOG (v6 vs v5):
 *   - Local showToast() function removed → replaced with window.showToast().
 *   - All toast error calls now pass boolean `true` instead of string "error".
 *   - Full JSDoc-style professional English comments added throughout.
 *   - Core render logic, art engines, and PRNG are UNCHANGED.
 * ==========================================================================
 */

/* ══════════════════════════════════════════════════════════════════════════
   SECTION 1: BUYER CONFIGURATION
   ══════════════════════════════════════════════════════════════════════════
   Edit these values to customise the tool's default behaviour without
   touching any core logic. Safe for buyers to modify.
 */

/**
 * @typedef {Object} BuyerConfig
 * @property {string}   defaultPlaceholder - Seed used when the input field is empty.
 * @property {Object}   palettes           - Named colour palettes (hex arrays).
 * @property {number}   autoPilotSpeed     - Interval (ms) between auto-pilot cycles.
 */

/** @type {BuyerConfig} */
const BUYER_CONFIG = {
    /** Text shown when input is empty — drives the default avatar render. */
    defaultPlaceholder: "Trusted Tools",

    /**
     * Named colour palettes.
     * Each palette is an array of hex strings; the LAST entry is always
     * the background colour used by the engine.
     */
    palettes: {
        'cyber': ['#00ff9d', '#00d2ff', '#0061ff', '#0d1117'],
        'warm' : ['#ff9966', '#ff5e62', '#ff0055', '#200000'],
        'space': ['#bc13fe', '#00f3ff', '#3b00ff', '#050014'],
        'toxic': ['#ccff00', '#00ff00', '#003300', '#000000'],
        'geo'  : ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff'],
        'mono' : ['#ffffff', '#aaaaaa', '#555555', '#000000']
    },

    /** Auto-pilot speed in milliseconds (lower = faster cycling). */
    autoPilotSpeed: 1200
};


/* ══════════════════════════════════════════════════════════════════════════
   SECTION 2: APPLICATION STATE
   ══════════════════════════════════════════════════════════════════════════
   Single source of truth for all toggleable UI states. Reading from this
   object (rather than querying the DOM) ensures consistency across the
   render pipeline.
 */

/**
 * @typedef {Object} AppStateObject
 * @property {boolean}       isSquare          - Canvas uses square clip (vs default circle).
 * @property {boolean}       isSticker         - Sticker mode active (white border inset).
 * @property {boolean}       isAnimating       - Live rotation animation loop running.
 * @property {boolean}       isAutoPilot       - Auto-pilot randomiser interval running.
 * @property {number|null}   animFrame         - requestAnimationFrame handle for cancellation.
 * @property {number|null}   autoPilotInterval - setInterval handle for auto-pilot cancellation.
 */

/** @type {AppStateObject} */
const AppState = {
    isSquare          : false,
    isSticker         : false,
    isAnimating       : false,
    isAutoPilot       : false,
    animFrame         : null,
    autoPilotInterval : null,
};


/* ══════════════════════════════════════════════════════════════════════════
   SECTION 3: DOM REFERENCES
   ══════════════════════════════════════════════════════════════════════════
   Centralised element cache. All DOM queries are performed once at script
   initialisation; subsequent access uses these references to avoid repeated
   `getElementById` calls during the render loop.
 */

/**
 * Cached DOM element references.
 * NOTE: `els.toast` is retained for backward compatibility but is no longer
 * used for toast output — all notifications now go through window.showToast().
 *
 * @type {Object.<string, HTMLElement>}
 */
const els = {
    /** Main generation canvas — id="avatarCanvas" */
    canvas    : document.getElementById('avatarCanvas'),

    /** Text seed input — id="username" */
    input     : document.getElementById('username'),

    /** Algorithm engine dropdown — id="styleMode" */
    select    : document.getElementById('styleMode'),

    /** Hue rotation range slider — id="hueSlider" */
    hue       : document.getElementById('hueSlider'),

    /** Live hue value label — id="hueVal" */
    hueDisplay: document.getElementById('hueVal'),

    /** Auto-pilot toggle button — id="autoPilotBtn" */
    btnAuto   : document.getElementById('autoPilotBtn'),

    /** Shape toggle HUD icon — id="btnShape" */
    btnShape  : document.getElementById('btnShape'),

    /** Sticker mode HUD icon — id="btnSticker" */
    btnSticker: document.getElementById('btnSticker'),

    /** Animation toggle HUD icon — id="btnAnim" */
    btnAnim   : document.getElementById('btnAnim'),

    /**
     * Legacy toast container reference — kept for internal reference only.
     * Actual toasts are fired via window.showToast() (global system).
     */
    toast     : document.getElementById('toast-container'),

    /** Loading overlay shown during high-res export — id="loadingOverlay" */
    overlay   : document.getElementById('loadingOverlay')
};

/**
 * 2D rendering context for the main preview canvas.
 * `alpha: true` allows the canvas background to be transparent before fill,
 * which is required for the sticker-mode white-border technique.
 *
 * @type {CanvasRenderingContext2D}
 */
const ctx = els.canvas.getContext('2d', { alpha: true });


/* ══════════════════════════════════════════════════════════════════════════
   SECTION 4: DETERMINISTIC RANDOMNESS UTILITIES
   ══════════════════════════════════════════════════════════════════════════
   Two components work together to guarantee that the same string input
   always produces the same visual output:

   1. cyrb128  — MurmurHash3 variant that converts any string into a
                 stable 32-bit unsigned integer (the "seed").
   2. Random   — Mulberry32 PRNG class that uses the seed to generate
                 a deterministic, repeatable sequence of floats/ints.
 */

/**
 * cyrb128 — MurmurHash3 (cyrb128 variant)
 *
 * Converts a string into a stable 32-bit unsigned integer seed.
 * The same string always maps to the same integer, making avatar generation
 * fully deterministic regardless of when or where it is called.
 *
 * Algorithm: four interleaved 32-bit accumulators mixed with Math.imul for
 * avalanche diffusion, then a finalisation round to reduce collisions.
 *
 * @param  {string} str - Input seed text (e.g. username or random phrase).
 * @returns {number}     Unsigned 32-bit integer hash value.
 */
function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

/**
 * Random — Mulberry32 Pseudo-Random Number Generator (PRNG)
 *
 * A stateful PRNG that accepts a seed value, making it 100% reproducible.
 * Standard `Math.random()` produces a different sequence every time;
 * Mulberry32 produces the same sequence for the same seed — every time.
 *
 * This class is instantiated fresh for every render call, ensuring that
 * a given (seed × mode) pair always yields identical artwork.
 */
class Random {
    /**
     * @param {number} seed - 32-bit unsigned integer seed (from cyrb128).
     */
    constructor(seed) {
        /** @type {number} Internal state — advanced by each `next()` call. */
        this.state = seed;
    }

    /**
     * Generates the next pseudo-random float in the range [0, 1).
     * Advances the internal state using the Mulberry32 bit-mixing algorithm.
     *
     * @returns {number} Float in range [0, 1).
     */
    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /**
     * Returns a pseudo-random integer between min and max (inclusive).
     *
     * @param {number} min - Lower bound (inclusive).
     * @param {number} max - Upper bound (inclusive).
     * @returns {number} Integer in [min, max].
     */
    range(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Returns a pseudo-random float between min and max.
     *
     * @param {number} min - Lower bound.
     * @param {number} max - Upper bound.
     * @returns {number} Float in [min, max).
     */
    float(min, max) {
        return this.next() * (max - min) + min;
    }

    /**
     * Picks a pseudo-random element from the given array.
     *
     * @param {Array} arr - Source array.
     * @returns {*} A randomly selected element.
     */
    pick(arr) {
        return arr[this.range(0, arr.length - 1)];
    }

    /**
     * Returns a pseudo-random boolean with the given probability of `true`.
     *
     * @param {number} [prob=0.5] - Probability of returning true (0–1).
     * @returns {boolean}
     */
    bool(prob = 0.5) {
        return this.next() < prob;
    }
}


/* ══════════════════════════════════════════════════════════════════════════
   SECTION 5: ART ENGINES
   ══════════════════════════════════════════════════════════════════════════
   The `Engines` object maps each styleMode option value to a drawing
   function. All engines receive the same five arguments and draw directly
   to the canvas 2D context. They are designed with relative arithmetic
   (e.g. `w/7`, `w*0.1`) so they scale perfectly from 512px to 2048px.
 */

/**
 * Collection of nine deterministic canvas art engines.
 * Each function signature: (c, w, h, rand, pal) =>
 *   @param {CanvasRenderingContext2D} c    - 2D context to draw onto.
 *   @param {number}                  w    - Canvas width in pixels.
 *   @param {number}                  h    - Canvas height in pixels.
 *   @param {Random}                  rand - Seeded PRNG instance.
 *   @param {string[]}                pal  - Active colour palette (hex strings).
 */
const Engines = {

    /**
     * PIXEL — 8-Bit Retro
     *
     * Renders a symmetric 7×7 pixel-art sprite using horizontal mirroring,
     * inspired by NES-era sprite design that conserved ROM by storing only
     * half the sprite data. A subtle highlight stripe gives each block a
     * faint 3D bevelled appearance.
     */
    pixel: (c, w, h, rand, pal) => {
        const gridSize = 7;
        const cell = w / gridSize;

        /* Fill solid background using the last palette colour */
        c.fillStyle = pal[pal.length - 1];
        c.fillRect(0, 0, w, h);

        for (let y = 0; y < gridSize; y++) {
            /* Iterate only the left half — mirror result to right half */
            for (let x = 0; x < Math.ceil(gridSize / 2); x++) {
                if (rand.bool(0.55)) {
                    c.fillStyle  = rand.pick(pal.slice(0, -1));
                    c.globalAlpha = 0.8;

                    /* Draw the pixel block and its horizontal mirror */
                    c.fillRect(x * cell,               y * cell, cell + 1, cell + 1);
                    c.fillRect((gridSize - 1 - x) * cell, y * cell, cell + 1, cell + 1);

                    /* Add a subtle top highlight strip for a 3D bevel effect */
                    c.fillStyle  = "rgba(255,255,255,0.1)";
                    c.fillRect(x * cell,               y * cell, cell, cell * 0.2);
                    c.fillRect((gridSize - 1 - x) * cell, y * cell, cell, cell * 0.2);
                    c.globalAlpha = 1.0;
                }
            }
        }
    },

    /**
     * CIRCUIT — Neural Circuit
     *
     * Simulates a printed circuit board topology using Manhattan routing:
     * a set of nodes are randomly placed on a grid, then connected with
     * L-shaped paths (horizontal-then-vertical, or vice versa). Each node
     * is rendered as a filled disc with a smaller glowing core dot.
     *
     * Note: The background is forced to near-black (#0a0a0a) even in light
     * mode because the neon-on-dark aesthetic is core to this style.
     */
    circuit: (c, w, h, rand, pal) => {
        c.fillStyle = '#0a0a0a';
        c.fillRect(0, 0, w, h);
        c.lineCap  = 'round';
        c.lineJoin = 'round';

        const nodes = [];
        const grid  = 8;
        const step  = w / grid;

        /* Create 12 randomly positioned grid-aligned nodes */
        for (let i = 0; i < 12; i++) {
            nodes.push({
                x    : rand.range(1, grid - 1) * step,
                y    : rand.range(1, grid - 1) * step,
                color: rand.pick(pal)
            });
        }

        /* Draw Manhattan-routed connections between consecutive nodes */
        c.lineWidth = w / 80;
        nodes.forEach((n, i) => {
            if (i === nodes.length - 1) return;
            const next = nodes[i + 1];
            c.strokeStyle = n.color;
            c.beginPath();
            c.moveTo(n.x, n.y);

            /* 50% chance: route X-then-Y or Y-then-X */
            if (rand.bool()) {
                c.lineTo(next.x, n.y);
                c.lineTo(next.x, next.y);
            } else {
                c.lineTo(n.x, next.y);
                c.lineTo(next.x, next.y);
            }
            c.stroke();
        });

        /* Draw node circles: outer dark disc + inner coloured dot */
        nodes.forEach(n => {
            c.fillStyle = '#111';
            c.beginPath(); c.arc(n.x, n.y, w / 40, 0, Math.PI * 2); c.fill();
            c.lineWidth = 2; c.stroke();

            c.fillStyle = n.color;
            c.beginPath(); c.arc(n.x, n.y, w / 70, 0, Math.PI * 2); c.fill();
        });
    },

    /**
     * GLITCH — Cyber Glitch
     *
     * Composites a Bauhaus geometry base with simulated VHS/data-corruption
     * artefacts: horizontal scan-line slicing with `difference` blend and
     * RGB-split (chromatic aberration) lines using `screen` blend.
     *
     * The `difference` composite inverts overlapping colours, creating the
     * characteristic glitch inversion bands. The RGB-split lines simulate
     * the red/green channel misalignment of analogue video tape damage.
     */
    glitch: (c, w, h, rand, pal) => {
        c.fillStyle = '#050505';
        c.fillRect(0, 0, w, h);

        /* Use Bauhaus engine as the base geometric layer */
        Engines.bauhaus(c, w, h, rand, pal);

        /* Apply horizontal slice-and-shift corruption passes */
        const slices = 20;
        const sliceH = h / slices;

        for (let i = 0; i < slices; i++) {
            if (rand.bool(0.3)) {
                const shift = rand.range(-w * 0.1, w * 0.1);

                /* Difference blend creates colour inversion on overlap */
                c.globalCompositeOperation = 'difference';
                c.fillStyle = rand.pick(pal);
                c.fillRect(0, i * sliceH, w, sliceH / 2);

                /* Screen blend adds RGB-split chromatic aberration lines */
                c.globalCompositeOperation = 'screen';
                c.fillStyle = '#ff0000';
                c.fillRect(shift,  i * sliceH,     w * 0.8, 2);
                c.fillStyle = '#00ff00';
                c.fillRect(-shift, i * sliceH + 5, w * 0.8, 2);
            }
        }
        /* Reset composite mode to default after glitch pass */
        c.globalCompositeOperation = 'source-over';
    },

    /**
     * NEBULA — Deep Space
     *
     * Renders a deep-space nebula by layering 30 semi-transparent radial
     * gradients using `screen` composite blending (which lightens overlapping
     * colours, mimicking how gas clouds emit light). Stars are added as tiny
     * filled rectangles with variable opacity.
     */
    nebula: (c, w, h, rand, pal) => {
        c.fillStyle = '#020005';
        c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'screen';

        /* Layer 30 radial gradient blobs for the nebula cloud effect */
        for (let i = 0; i < 30; i++) {
            const r = rand.range(w / 5, w);
            const x = rand.range(-w / 4, w * 1.25);
            const y = rand.range(-h / 4, h * 1.25);

            const grad = c.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, rand.pick(pal));
            grad.addColorStop(1, 'transparent');

            c.fillStyle   = grad;
            c.globalAlpha = rand.float(0.1, 0.5);
            c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1.0;

        /* Scatter 100 small star pixels with varying opacity */
        for (let i = 0; i < 100; i++) {
            c.fillStyle   = '#fff';
            const s = rand.float(1, 3);
            c.globalAlpha = rand.float(0.2, 0.9);
            c.fillRect(rand.range(0, w), rand.range(0, h), s, s);
        }
        c.globalAlpha = 1.0;
    },

    /**
     * BAUHAUS — Bauhaus Geo
     *
     * Inspired by the Bauhaus art school's geometric minimalism (circles,
     * rectangles, arcs, triangles). Uses a light `#f4f4f4` canvas to mimic
     * printed poster aesthetics, with `multiply` blend occasionally applied
     * to create natural colour overlap between shapes.
     */
    bauhaus: (c, w, h, rand, pal) => {
        c.fillStyle = '#f4f4f4';
        c.fillRect(0, 0, w, h);

        const shapes = 15;
        for (let i = 0; i < shapes; i++) {
            c.fillStyle = rand.pick(pal);

            /* 30% chance of multiply blend for natural pigment-like overlap */
            c.globalCompositeOperation = rand.bool(0.3) ? 'multiply' : 'source-over';

            const type = rand.range(0, 3);
            const size = rand.range(w / 10, w / 2.5);
            const x    = rand.range(0, w);
            const y    = rand.range(0, h);

            c.beginPath();
            if      (type === 0) { /* Circle */   c.arc(x, y, size / 2, 0, Math.PI * 2); }
            else if (type === 1) { /* Rectangle */ c.rect(x - size / 2, y - size / 2, size, size); }
            else if (type === 2) { /* Arch */      c.arc(x, y, size / 2, Math.PI, 0); }
            else                 { /* Triangle */
                c.moveTo(x,          y - size / 2);
                c.lineTo(x + size / 2, y + size / 2);
                c.lineTo(x - size / 2, y + size / 2);
            }
            c.fill();
        }
        c.globalCompositeOperation = 'source-over';
    },

    /**
     * RING — Orbital Rings
     *
     * Renders concentric arcs of varying radii, start angles, and sweep lengths
     * radiating from the canvas centre. Optional decorative dots are placed at
     * a random point along each arc to simulate orbital bodies.
     */
    ring: (c, w, h, rand, pal) => {
        c.fillStyle = '#111';
        c.fillRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2;

        for (let i = 0; i < 20; i++) {
            const r     = rand.range(w / 20, w / 2.2);
            const start = rand.float(0, Math.PI * 2);
            const end   = start + rand.float(0.5, 4);
            const color = rand.pick(pal);

            c.beginPath();
            c.arc(cx, cy, r, start, end);
            c.strokeStyle = color;
            c.lineWidth   = rand.range(2, w / 20);
            c.lineCap     = rand.bool() ? 'round' : 'butt';
            c.stroke();

            /* 30% chance: add a circular dot on the arc (simulates an orbiting body) */
            if (rand.bool(0.3)) {
                c.fillStyle = color;
                const angle = rand.float(start, end);
                const dx = cx + Math.cos(angle) * r;
                const dy = cy + Math.sin(angle) * r;
                c.beginPath(); c.arc(dx, dy, c.lineWidth, 0, Math.PI * 2); c.fill();
            }
        }
    },

    /**
     * MARBLE — Liquid Marble
     *
     * Simulates marble or fluid-flow texture by drawing hundreds of
     * semi-transparent cubic Bézier curves across the canvas.
     * The random control-point offsets create organic, flowing line patterns
     * reminiscent of natural stone veining or ink in water.
     */
    marble: (c, w, h, rand, pal) => {
        c.fillStyle = pal[pal.length - 1];
        c.fillRect(0, 0, w, h);
        c.lineWidth = 1;

        /* Draw w*2/4 = w/2 Bézier flow lines */
        for (let i = 0; i < w * 2; i += 4) {
            c.strokeStyle = rand.pick(pal);
            c.globalAlpha = rand.float(0.1, 0.4);
            c.beginPath();

            const startX = rand.range(-w, w);
            c.moveTo(startX, 0);

            /* Random cubic Bézier control points for organic curvature */
            const cp1x = startX + rand.range(-200, 200);
            const cp1y = h * 0.3;
            const cp2x = startX + rand.range(-200, 200);
            const cp2y = h * 0.7;
            const endX = startX + rand.range(-100, 100);

            c.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, h);
            c.stroke();
        }
        c.globalAlpha = 1.0;
    },

    /**
     * MATRIX — Matrix Rain
     *
     * Renders a static snapshot of "Matrix digital rain": columns of
     * katakana characters (Unicode block U+30A0–U+30FF) with a gradient
     * fade from head (bright white) to tail (primary colour at low alpha).
     * Renders at a fixed 40-column grid; characters scale to fit.
     */
    matrix: (c, w, h, rand, pal) => {
        c.fillStyle = '#000';
        c.fillRect(0, 0, w, h);

        const cols = 40;
        const colW = w / cols;
        c.font = `bold ${colW}px monospace`;

        for (let x = 0; x < cols; x++) {
            const height = rand.range(5, 25);
            const startY = rand.range(-h, h);

            for (let i = 0; i < height; i++) {
                /* Pick a random katakana character from the Hiragana/Katakana block */
                const char = String.fromCharCode(0x30A0 + rand.range(0, 90));
                const yPos = (startY + i * colW) % (h + height * colW);
                if (yPos < -colW || yPos > h) continue;

                /* Brightest character at the head of the stream; tail fades out */
                if (i === height - 1) {
                    c.fillStyle = '#fff';
                } else {
                    c.fillStyle   = pal[0];
                    c.globalAlpha = (i / height); /* Fade alpha from head to tail */
                }
                c.fillText(char, x * colW, yPos);
                c.globalAlpha = 1.0;
            }
        }
    },

    /**
     * MOSAIC — Crystal Mosaic
     *
     * Divides the canvas into a 10×10 grid of tiles, splitting each square
     * tile diagonally into two triangles, each filled with a palette colour.
     * A subtle dark stroke around each tile creates the stained-glass / crystal
     * mosaic appearance.
     */
    mosaic: (c, w, h, rand, pal) => {
        const tile = w / 10;

        for (let y = 0; y < h; y += tile) {
            for (let x = 0; x < w; x += tile) {
                const color1 = rand.pick(pal);
                const color2 = rand.pick(pal);

                /* Upper-left triangle */
                c.fillStyle = color1;
                c.beginPath();
                c.moveTo(x, y); c.lineTo(x + tile, y); c.lineTo(x, y + tile);
                c.fill();

                /* Lower-right triangle */
                c.fillStyle = color2;
                c.beginPath();
                c.moveTo(x + tile, y + tile);
                c.lineTo(x + tile, y);
                c.lineTo(x, y + tile);
                c.fill();

                /* Tile border stroke — simulates grout lines */
                c.strokeStyle = "rgba(0,0,0,0.1)";
                c.strokeRect(x, y, tile, tile);
            }
        }
    }
};


/* ══════════════════════════════════════════════════════════════════════════
   SECTION 6: CORE APPLICATION LOGIC
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * sanitizeInput
 *
 * Validates and sanitises the raw text field value before it is passed
 * to the hash function. This prevents unexpected characters from entering
 * the generation pipeline and guards against basic injection attempts
 * (though the tool is fully client-side and outputs only to a canvas).
 *
 * @param  {string} str - Raw input field value.
 * @returns {string}     Sanitised string, or the default placeholder if empty.
 */
function sanitizeInput(str) {
    if (!str) return BUYER_CONFIG.defaultPlaceholder;
    /* Allow: letters, digits, spaces, hyphens, underscores, periods */
    return str.replace(/[^a-zA-Z0-9 \-_.]/g, '').substring(0, 30) || BUYER_CONFIG.defaultPlaceholder;
}

/**
 * debounce
 *
 * Returns a debounced version of the supplied function that delays execution
 * by `wait` milliseconds after the last invocation. Used on the username
 * input to prevent the canvas from re-rendering on every single keystroke,
 * which would cause unnecessary CPU usage on low-end devices.
 *
 * @param  {Function} func - The function to debounce.
 * @param  {number}   wait - Delay in milliseconds.
 * @returns {Function}       Debounced wrapper function.
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


/* ══════════════════════════════════════════════════════════════════════════
   SECTION 7: RENDER PIPELINE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * render
 *
 * Core rendering pipeline. Orchestrates the full draw cycle for a given
 * context, dimensions, seed text, and style mode. Handles the following
 * pre-engine transformations in order:
 *
 *   1. Background fill       — solid colour from selected palette.
 *   2. Sticker mode inset    — white border + scaled inner workspace.
 *   3. Animation rotation    — sinusoidal rotate applied before engine draw.
 *   4. Engine invocation     — delegates to the matching Engines[mode] function.
 *
 * The `isExport` flag disables the live animation transformation during
 * high-resolution off-screen export, ensuring the exported PNG matches the
 * last-seen preview frame rather than capturing a random rotation angle.
 *
 * @param {CanvasRenderingContext2D} targetCtx - Destination drawing context.
 * @param {number}  w        - Canvas width in pixels.
 * @param {number}  h        - Canvas height in pixels.
 * @param {string}  text     - Sanitised seed text (drives hash + PRNG).
 * @param {string}  mode     - Selected engine key (e.g. "pixel", "circuit").
 * @param {boolean} [isExport=false] - When true, skips animation transform.
 */
function render(targetCtx, w, h, text, mode, isExport = false) {
    if (!targetCtx) return;

    /* ── Step 1: Seed PRNG from hash of input text ── */
    const seed = cyrb128(text);
    const rand = new Random(seed);

    /* ── Step 2: Select colour palette based on mode mapping ── */
    let palette = BUYER_CONFIG.palettes.cyber;
    if (['nebula', 'ring'].includes(mode))    palette = BUYER_CONFIG.palettes.space;
    if (['bauhaus', 'mosaic'].includes(mode)) palette = BUYER_CONFIG.palettes.geo;
    if (['matrix'].includes(mode))            palette = BUYER_CONFIG.palettes.toxic;
    if (['marble'].includes(mode))            palette = BUYER_CONFIG.palettes.warm;

    targetCtx.save();

    /* ── Step 3: Draw background colour behind all engine content ── */
    targetCtx.fillStyle = palette[palette.length - 1];
    if (mode === 'bauhaus') targetCtx.fillStyle = '#f4f4f4';
    if (mode === 'matrix')  targetCtx.fillStyle = '#000000';
    targetCtx.fillRect(0, 0, w, h);

    /* ── Step 4: Sticker mode — shrink workspace to create white border ──
       A white full-canvas fill is drawn first, then the context is
       translated and scaled to 90% so the engine draws inside the border. */
    if (AppState.isSticker) {
        targetCtx.fillStyle = '#ffffff';
        targetCtx.fillRect(0, 0, w, h);
        const border = w * 0.05;
        targetCtx.translate(border, border);
        targetCtx.scale(0.9, 0.9);

        /* Re-draw background inside the scaled sticker area */
        targetCtx.fillStyle = palette[palette.length - 1];
        if (mode === 'bauhaus') targetCtx.fillStyle = '#f4f4f4';
        if (mode === 'matrix')  targetCtx.fillStyle = '#000000';
        targetCtx.fillRect(0, 0, w, h);
    }

    /* ── Step 5: Animation rotation (live preview only, not during export) ──
       A time-based sinusoidal rotate gives a gentle pendulum motion. */
    if (AppState.isAnimating && !isExport) {
        const t = Date.now() / 2000;
        targetCtx.translate(w / 2, h / 2);
        targetCtx.rotate(Math.sin(t) * 0.2);
        targetCtx.translate(-w / 2, -h / 2);
    }

    /* ── Step 6: Invoke the selected art engine ── */
    try {
        const engine = Engines[mode] || Engines.pixel;
        engine(targetCtx, w, h, rand, palette);
    } catch (e) {
        console.error("Render Error:", e);
    }

    targetCtx.restore();
}


/* ══════════════════════════════════════════════════════════════════════════
   SECTION 8: MAIN INTERACTIVE FUNCTIONS
   ══════════════════════════════════════════════════════════════════════════
   These functions are exposed via `window.*` for HTML onclick attributes
   and are also called internally. Each corresponds to a distinct user action.
 */

/**
 * updatePreview
 *
 * The primary preview refresh function. Called whenever the user changes
 * the username input, algorithm selector, or hue slider.
 *
 * Applies the hue rotation as a CSS filter on the canvas element (a
 * performance optimisation — CSS filter is GPU-accelerated and far cheaper
 * than re-running the full engine pipeline for every hue change).
 *
 * Also updates the live hue degree label beside the slider.
 */
function updatePreview() {
    const text = sanitizeInput(els.input.value);
    const mode = els.select.value;

    /* Apply hue rotation as CSS filter — GPU-accelerated, avoids re-render */
    els.canvas.style.filter = `hue-rotate(${els.hue.value}deg)`;

    /* Update live hue degree display (e.g. "180°") */
    els.hueDisplay.innerText = els.hue.value + "°";

    /* Trigger canvas render pipeline */
    render(ctx, els.canvas.width, els.canvas.height, text, mode);
}

/**
 * randomize
 *
 * Generates a random Base36 string as the seed, selects a random algorithm
 * engine, and sets a random hue value. Triggers a full preview refresh.
 * Used by the "Random" button and the auto-pilot interval.
 */
function randomize() {
    /* Random Base36 uppercase string (e.g. "K7B2M") */
    els.input.value    = Math.random().toString(36).substring(7).toUpperCase();
    /* Random algorithm index */
    els.select.selectedIndex = Math.floor(Math.random() * els.select.options.length);
    /* Random hue 0–360 */
    els.hue.value = Math.floor(Math.random() * 360);
    updatePreview();
}

/**
 * toggleAutoPilot
 *
 * Toggles the Auto-Pilot mode on/off.
 *
 * When ACTIVE:
 *   - Sets the button to a "Stop" state (adds .active class).
 *   - Starts a setInterval that calls `randomize()` at autoPilotSpeed ms.
 *   - Notifies the user via global toast.
 *
 * When INACTIVE:
 *   - Restores the button to the "Auto" idle state.
 *   - Clears the interval to stop cycling.
 */
function toggleAutoPilot() {
    AppState.isAutoPilot = !AppState.isAutoPilot;

    if (AppState.isAutoPilot) {
        /* Activate auto-pilot */
        els.btnAuto.classList.add('active');
        els.btnAuto.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
        AppState.autoPilotInterval = setInterval(randomize, BUYER_CONFIG.autoPilotSpeed);

        /* Inform the user via the global toast notification system */
        window.showToast("Auto-Pilot Engaged");
    } else {
        /* Deactivate auto-pilot */
        els.btnAuto.classList.remove('active');
        els.btnAuto.innerHTML = '<i class="fa-solid fa-play"></i> Auto';
        clearInterval(AppState.autoPilotInterval);
    }
}

/**
 * toggleAnimation
 *
 * Toggles the live rotation animation loop on/off.
 *
 * When ACTIVE:
 *   - Marks `AppState.isAnimating = true`.
 *   - Starts a requestAnimationFrame loop that continuously calls updatePreview().
 *   - The render pipeline applies a sinusoidal rotation transform each frame.
 *   - Notifies the user via global toast.
 *
 * When INACTIVE:
 *   - The RAF loop self-terminates because `AppState.isAnimating` is checked
 *     inside the loop before each recursive call.
 */
function toggleAnimation() {
    AppState.isAnimating = !AppState.isAnimating;
    els.btnAnim.classList.toggle('active');

    if (AppState.isAnimating) {
        /**
         * Inner animation loop — runs at display refresh rate (typically 60fps).
         * Checks AppState.isAnimating before each recursive call so the loop
         * self-terminates cleanly when the user toggles off.
         */
        const loop = () => {
            updatePreview();
            if (AppState.isAnimating) requestAnimationFrame(loop);
        };
        loop();

        /* Notify the user via the global toast notification system */
        window.showToast("Live Animation ON");
    }
}

/**
 * toggleShape
 *
 * Switches the canvas display between circular (default) and square shape.
 * Achieved by adding/removing the `.shape-square` CSS class on the canvas,
 * which overrides the default `border-radius: 50%` with `border-radius: var(--radius-md)`.
 *
 * The HUD icon also changes from a square outline to a circle outline to
 * indicate the current active shape.
 */
function toggleShape() {
    AppState.isSquare = !AppState.isSquare;

    if (AppState.isSquare) {
        /* Square mode: add CSS class + swap icon to circle outline */
        els.canvas.classList.add('shape-square');
        els.btnShape.className = "fa-regular fa-circle imd-hud-btn active";
    } else {
        /* Circle mode: remove CSS class + restore square outline icon */
        els.canvas.classList.remove('shape-square');
        els.btnShape.className = "fa-regular fa-square imd-hud-btn";
    }
}

/**
 * toggleSticker
 *
 * Toggles sticker mode on/off. When active, the render pipeline draws a white
 * background fill first, then scales the engine workspace to 90%, creating
 * a white border inset — resembling a physical sticker die-cut.
 *
 * Triggers a full preview re-render to reflect the change immediately.
 */
function toggleSticker() {
    AppState.isSticker = !AppState.isSticker;
    els.btnSticker.classList.toggle('active');
    updatePreview();
}

/**
 * resetAll
 *
 * Resets the tool to its default state:
 *   - Clears the username input field.
 *   - Resets hue slider to 0.
 *   - Resets algorithm selector to the first option (8-Bit Retro).
 *   - Disables shape-square, sticker, animation, and auto-pilot modes.
 *   - Triggers a fresh preview render with the default placeholder seed.
 *   - Notifies the user via global toast.
 */
function resetAll() {
    /* Clear all input controls */
    els.input.value          = "";
    els.hue.value            = 0;
    els.select.selectedIndex = 0;

    /* Reset all AppState toggles */
    AppState.isSquare  = false;
    AppState.isSticker = false;

    /* Remove all active CSS state classes */
    els.canvas.classList.remove('shape-square');
    els.btnSticker.classList.remove('active');
    els.btnShape.className = "fa-regular fa-square imd-hud-btn";

    /* Stop running loops if active */
    if (AppState.isAnimating) toggleAnimation(); /* Self-terminates the RAF loop */
    if (AppState.isAutoPilot) toggleAutoPilot(); /* Clears the setInterval */

    /* Re-render with default state */
    updatePreview();

    /* Notify the user via the global toast notification system */
    window.showToast("Reset Complete");
}

/**
 * downloadAsset
 *
 * Exports the current avatar as a high-resolution PNG file using an
 * off-screen canvas. The export process:
 *
 *   1. Shows the loading overlay (prevents user interaction during render).
 *   2. Creates an off-screen canvas at the selected export size (512/1024/2048px).
 *   3. Applies the hue CSS filter to the off-screen context.
 *   4. Runs the render pipeline with `isExport = true` (no animation rotation).
 *   5. Converts the canvas to a PNG data-URL and triggers a browser download.
 *   6. Hides the loading overlay in the `finally` block to ensure it always clears.
 *
 * The 100ms `setTimeout` delay allows the browser to paint the loading overlay
 * before the synchronous heavy-render begins, giving visual feedback on all devices.
 */
function downloadAsset() {
    const text = sanitizeInput(els.input.value);
    const mode = els.select.value;
    const size = parseInt(document.getElementById('exportQuality').value);

    /* Show the full-canvas loading spinner overlay */
    els.overlay.classList.add('active');

    /* Small delay ensures the browser repaints the overlay before the CPU-heavy render */
    setTimeout(() => {
        try {
            /* Create an off-screen canvas at the target export resolution */
            const tCanvas  = document.createElement('canvas');
            tCanvas.width  = size;
            tCanvas.height = size;
            const tCtx = tCanvas.getContext('2d');

            /* Apply hue rotation to the export context to match the preview */
            tCtx.filter = `hue-rotate(${els.hue.value}deg)`;

            /* Run the full render pipeline on the off-screen canvas */
            render(tCtx, size, size, text, mode, true);

            /* Build a download link and click it programmatically */
            const link    = document.createElement('a');
            link.download = `Identity_${text}_${size}px.png`;
            link.href     = tCanvas.toDataURL("image/png", 0.9); /* Quality 0.9 for PNG */
            link.click();

            /* Notify the user of successful export via the global toast system */
            window.showToast("Downloaded Successfully!");

        } catch (e) {
            console.error(e);
            /* Notify the user of the failure — boolean `true` flags it as an error toast */
            window.showToast("Export Failed. Please try again.", true);
        } finally {
            /* Always hide the overlay, even if an error occurred */
            els.overlay.classList.remove('active');
        }
    }, 100);
}


/* ══════════════════════════════════════════════════════════════════════════
   SECTION 9: INITIALISATION
   ══════════════════════════════════════════════════════════════════════════
   Runs after the DOM is fully parsed. Binds all event listeners, triggers
   the initial preview render, and exposes functions globally for HTML
   onclick attributes.
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ── Bind input event listeners ──
       - username input:  debounced 250ms to avoid re-rendering every keystroke.
       - styleMode select: immediate re-render on algorithm change.
       - hueSlider input:  immediate re-render for smooth real-time colour grading. */
    els.input.addEventListener('input',  debounce(updatePreview, 250));
    els.select.addEventListener('change', updatePreview);
    els.hue.addEventListener('input',    updatePreview);

    /* ── Initial render ──
       Trigger the first preview render so the canvas is never blank on load. */
    if (els.input.value.trim() === "") els.input.value = "";
    updatePreview();

    /* ── Expose public API for HTML onclick attributes ──
       All interactive functions must be on `window` since the script uses
       a local scope (non-module) and HTML onclick attributes require globals. */
    window.downloadAsset   = downloadAsset;
    window.randomize       = randomize;
    window.toggleAutoPilot = toggleAutoPilot;
    window.toggleAnimation = toggleAnimation;
    window.toggleShape     = toggleShape;
    window.toggleSticker   = toggleSticker;
    window.resetAll        = resetAll;
});
