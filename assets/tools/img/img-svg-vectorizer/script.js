/**
 * =============================================================================
 * SVG Vectorizer ULTRA MAX — script.js
 * Tool   : img-svg-vectorizer
 * Path   : /assets/tools/img/img-svg-vectorizer/script.js
 * Author : MD KAWSAR
 * Version: 1.0 (CodeCanyon Release Build)
 *
 * =============================================================================
 * ARCHITECTURE OVERVIEW
 * =============================================================================
 *
 * This file is written as a single IIFE (Immediately Invoked Function
 * Expression) to isolate all tool logic from the global namespace and avoid
 * any conflicts with global.js or other tools on the same page.
 *
 * Internal manager objects and their responsibilities:
 *
 *   TabManager          — Switches between the three tab panels
 *                         (Single Convert / Batch Mode / Code Export).
 *
 *   SliderManager       — Keeps the numeric value display beside each slider
 *                         in sync as the user drags. Also maps slider values
 *                         to the option object that ImageTracer.js expects.
 *
 *   VectorizerEngine    — Loads the uploaded image onto an HTML5 Canvas,
 *                         passes ImageData to ImageTracer.js, and returns
 *                         the resulting SVG string.
 *
 *   MinifierEngine      — Cleans and compresses the SVG string (strips
 *                         comments, collapses whitespace, rounds decimals,
 *                         removes empty <g> groups) and returns file-size stats.
 *
 *   LayerInspector      — Parses all <path>/<polygon>/<circle>/<rect>/
 *                         <ellipse>/<polyline> elements in the generated SVG
 *                         and renders a toggle-able list panel per path,
 *                         allowing the user to show/hide individual paths.
 *
 *   SplitViewController — Orchestrates the live split view after vectorization:
 *                         injects the SVG preview (left pane), pretty-prints
 *                         the SVG source (right pane), updates size badges,
 *                         and triggers React/Flutter code generation.
 *
 *   CodeExporter        — Converts the minified SVG string into:
 *                           • A React functional component (JSX, camelCase attrs)
 *                           • A Flutter Dart SvgPicture.string() widget
 *
 *   BatchManager        — Handles multi-image batch processing via an inline
 *                         Web Worker (Blob URL technique) so the main thread
 *                         never freezes. Collects results into JSZip for
 *                         a single ZIP export.
 *
 *   ClipboardManager    — copy() and copyAsBase64() helpers with global toast
 *                         feedback on success or failure.
 *
 *   SingleWorkflow      — Glues the file-selection, vectorization, and reset
 *                         steps together for the single-image panel.
 *
 * All DOM lookups go through queryOnce() and queryAll() wrappers that throw
 * clear, descriptive errors if an expected element is missing — this saves
 * significant debugging time compared to silent "null" failures.
 *
 * Toast notifications use the global window.showToast() system provided by
 * global.js. The old local ToastManager has been removed entirely.
 * =============================================================================
 */

(function SVGVectorizerUltraMax() {
    'use strict';

    /* =========================================================================
       CONSTANTS & CONFIGURATION
    ========================================================================= */

    /**
     * IMAGETRACER_DEFAULTS
     * Base option object passed to ImageTracer.js.
     * Individual values are overridden at vectorization time by SliderManager.
     *
     * Key parameters:
     *   ltres          — line threshold: lower = more faithful line paths
     *   qtres          — quadratic Bézier threshold: lower = smoother curves
     *   pathomit       — minimum path length; paths shorter than this are skipped
     *   numberofcolors — palette size for colour quantisation
     *   colorsampling  — 2 = deterministic sampling (consistent results)
     *   roundcoords    — round all coordinate decimals to this many places
     *   viewbox        — whether to add a viewBox attribute to the SVG root
     *   desc           — suppress <desc> metadata elements in the output
     */
    const IMAGETRACER_DEFAULTS = {
        ltres:            1,
        qtres:            1,
        pathomit:         8,
        numberofcolors:   16,
        colorsampling:    2,
        mincolorratio:    0.02,
        colorquantcycles: 3,
        layering:         0,
        strokewidth:      1,
        linefilter:       false,
        scale:            1,
        roundcoords:      2,
        viewbox:          true,
        desc:             false,
        lcpr:             0,
        qcpr:             0,
    };

    /**
     * mapDetailToThresholds
     * Converts the "Detail Level" slider value (1–100) into ImageTracer
     * line and quadratic Bézier thresholds.
     *
     * Mapping logic:
     *   Slider HIGH (100) → thresholds LOW  (0.20) → captures every tiny path
     *   Slider LOW  (1)   → thresholds HIGH (10.0) → simplifies / omits curves
     *
     * @param  {number} sliderValue  Integer from 1 to 100
     * @returns {{ ltres: number, qtres: number }}
     */
    function mapDetailToThresholds(sliderValue) {
        const t = 10 - ((sliderValue / 100) * 9.8);
        return { ltres: +t.toFixed(2), qtres: +t.toFixed(2) };
    }

    /**
     * mapNoiseToPathomit
     * Converts the "Noise Reduction" slider value (0–100) into the
     * ImageTracer pathomit option (0–40).
     *
     * A higher pathomit value causes ImageTracer to skip very short paths,
     * effectively removing tiny specks and noise from the output.
     *
     * @param  {number} sliderValue  Integer from 0 to 100
     * @returns {number}  pathomit value (0–40)
     */
    function mapNoiseToPathomit(sliderValue) {
        return Math.round((sliderValue / 100) * 40);
    }


    /* =========================================================================
       SAFE DOM HELPER UTILITIES
    ========================================================================= */

    /**
     * queryOnce
     * A safer replacement for querySelector that throws a descriptive Error
     * instead of silently returning null when an expected element is absent.
     *
     * @param  {string}   selector  Any valid CSS selector
     * @param  {Element}  [root]    Search root (defaults to document)
     * @returns {Element}
     * @throws {Error}  If no matching element is found
     */
    function queryOnce(selector, root = document) {
        const el = root.querySelector(selector);
        if (!el) throw new Error(`[SVGVectorizer] Required element missing: "${selector}"`);
        return el;
    }

    /**
     * queryAll
     * A safer replacement for querySelectorAll that returns a plain Array
     * (not a NodeList) for easier iteration.
     *
     * @param  {string}   selector
     * @param  {Element}  [root]
     * @returns {Element[]}
     */
    function queryAll(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    /**
     * show — Makes an element visible by setting its display property.
     * @param {Element}  el
     * @param {string}   [displayType='block']  CSS display value to apply
     */
    function show(el, displayType = 'block') {
        if (el) el.style.display = displayType;
    }

    /**
     * hide — Hides an element by setting display:none.
     * @param {Element} el
     */
    function hide(el) {
        if (el) el.style.display = 'none';
    }

    /**
     * toggleClass — Convenience wrapper around Element.classList.toggle().
     * @param {Element}  el
     * @param {string}   cls   CSS class name to toggle
     * @param {boolean}  force Optional: true=add, false=remove
     */
    function toggleClass(el, cls, force) {
        if (el) el.classList.toggle(cls, force);
    }


    /* =========================================================================
       GLOBAL TOAST HELPER
       All notifications in this tool use window.showToast() provided by
       global.js. This thin wrapper ensures the function is always available
       and converts the old 'error' string type to the boolean `true` format
       that the global system expects.

       Global signature: window.showToast(message, isError)
         - isError = true   → red error toast
         - isError = false  → standard (success/info) toast
    ========================================================================= */

    /**
     * toast
     * Internal helper so managers can call toast.success/error/info/warning
     * using familiar semantics, while always delegating to window.showToast().
     *
     * @param {string}  message   Notification text
     * @param {boolean} [isError] true = error style, false = normal style
     */
    function toast(message, isError = false) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, isError);
        } else {
            // Graceful fallback if global.js has not yet loaded
            console.warn('[SVGVectorizer] window.showToast unavailable:', message);
        }
    }


    /* =========================================================================
       TAB MANAGER
       Switches between the three main panels:
         panel-single  → Single image conversion
         panel-batch   → Batch multi-image processing
         panel-code    → React / Flutter code export
    ========================================================================= */
    const TabManager = (() => {

        /**
         * init
         * Attaches click and keyboard (Enter / Space) listeners to every
         * .tab-btn element so all tabs become interactive.
         */
        function init() {
            const buttons = queryAll('.tab-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => switchTo(btn.dataset.tab));

                // Keyboard accessibility — treat Enter and Space like a click
                btn.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        switchTo(btn.dataset.tab);
                    }
                });
            });
        }

        /**
         * switchTo
         * Activates the specified tab panel and deactivates all others.
         * Updates both visual state (CSS class "active") and ARIA attributes.
         *
         * @param {'single'|'batch'|'code'} tabName
         */
        function switchTo(tabName) {
            // ── Update button active states & ARIA ──
            queryAll('.tab-btn').forEach(btn => {
                const isActive = btn.dataset.tab === tabName;
                toggleClass(btn, 'active', isActive);
                btn.setAttribute('aria-selected', isActive.toString());
            });

            // ── Show/hide corresponding panels ──
            queryAll('.tab-panel').forEach(panel => {
                const isActive = panel.id === `panel-${tabName}`;
                toggleClass(panel, 'active', isActive);
            });
        }

        return { init, switchTo };
    })();


    /* =========================================================================
       SLIDER MANAGER
       Manages the three tracing-parameter sliders.
       Keeps the live numeric display badge beside each slider in sync,
       and maps slider positions to the option object ImageTracer.js expects.
    ========================================================================= */
    const SliderManager = (() => {

        /**
         * Slider descriptor array.
         * Each entry pairs a range input ID with its numeric display element ID.
         */
        const sliders = [
            { input: '#sliderDetail', output: '#valDetail' },
            { input: '#sliderColors', output: '#valColors' },
            { input: '#sliderNoise',  output: '#valNoise'  },
        ];

        /**
         * init
         * Attaches 'input' event listeners to all sliders so the displayed
         * value updates instantly as the user drags the thumb.
         * Also sets the initial display value from the HTML default.
         */
        function init() {
            sliders.forEach(({ input, output }) => {
                const inputEl  = document.querySelector(input);
                const outputEl = document.querySelector(output);
                if (!inputEl || !outputEl) return;

                // Set initial display value on page load
                outputEl.textContent = inputEl.value;

                // Update display value in real-time as slider moves
                inputEl.addEventListener('input', () => {
                    outputEl.textContent = inputEl.value;
                });
            });
        }

        /**
         * getOptions
         * Reads the current positions of all three sliders and maps them
         * to the complete ImageTracer option object used by VectorizerEngine.
         *
         * @returns {object}  Full ImageTracer options, ready to pass to imagedataToSVG()
         */
        function getOptions() {
            const detail = parseInt(document.querySelector('#sliderDetail')?.value ?? 50, 10);
            const colors = parseInt(document.querySelector('#sliderColors')?.value ?? 16, 10);
            const noise  = parseInt(document.querySelector('#sliderNoise')?.value  ?? 25, 10);

            const thresholds = mapDetailToThresholds(detail);
            const pathomit   = mapNoiseToPathomit(noise);

            return {
                ...IMAGETRACER_DEFAULTS,
                ...thresholds,
                pathomit,
                numberofcolors: colors,
            };
        }

        return { init, getOptions };
    })();


    /* =========================================================================
       MINIFIER ENGINE
       Pure string-processing pipeline that reduces SVG file size without
       any visual loss by applying the following transformations in order:

         1. Remove XML/HTML comments  <!-- ... -->
         2. Remove <desc>…</desc> metadata blocks
         3. Remove <title>…</title> metadata blocks
         4. Collapse whitespace between tags  >  <  →  ><
         5. Collapse runs of multiple spaces into one
         6. Round all long decimal numbers to 2 places
         7. Remove empty <g></g> group elements
         8. Strip duplicate xmlns declarations from child elements

       Returns the minified string plus original/minified byte counts and
       a percentage savings figure used by the stats panel.
    ========================================================================= */
    const MinifierEngine = (() => {

        /**
         * minify
         * Applies all minification steps to the given SVG string.
         *
         * @param  {string} svgString  Raw SVG markup from VectorizerEngine
         * @returns {{ minified: string, origBytes: number, minBytes: number, savings: string }}
         */
        function minify(svgString) {
            if (!svgString) return { minified: '', origBytes: 0, minBytes: 0, savings: '0%' };

            let out = svgString;
            const origBytes = new Blob([out]).size;

            // Step 1: Remove XML/HTML comments
            out = out.replace(/<!--[\s\S]*?-->/g, '');

            // Step 2: Remove <desc>…</desc> blocks (metadata, not visual)
            out = out.replace(/<desc>[\s\S]*?<\/desc>/gi, '');

            // Step 3: Remove <title>…</title> blocks (metadata, not visual)
            out = out.replace(/<title>[\s\S]*?<\/title>/gi, '');

            // Step 4: Collapse whitespace between adjacent tags
            out = out.replace(/>\s+</g, '><');

            // Step 5: Collapse runs of 2+ spaces down to one space
            out = out.replace(/\s{2,}/g, ' ');

            // Step 6: Round floating-point coordinates to 2 decimal places
            //         Matches patterns like 123.456789 → 123.46, -0.00123 → 0.00
            out = out.replace(/-?\d+\.\d{3,}/g, match =>
                parseFloat(parseFloat(match).toFixed(2)).toString()
            );

            // Step 7: Remove empty <g></g> groups that may remain after above removals
            out = out.replace(/<g[^>]*>\s*<\/g>/gi, '');

            // Step 8: Strip duplicate xmlns declarations from non-root elements
            out = out.replace(/(<(?!svg)[a-z]+[^>]+)\s+xmlns="[^"]*"/gi, '$1');

            const minBytes = new Blob([out]).size;
            const savedPct  = origBytes > 0
                ? Math.round(((origBytes - minBytes) / origBytes) * 100)
                : 0;

            return {
                minified:  out.trim(),
                origBytes,
                minBytes,
                savings:   `${savedPct}%`,
            };
        }

        /**
         * formatBytes
         * Converts a raw byte count into a human-readable string.
         * Examples: 400 → "400 B", 14745 → "14.4 KB", 2097152 → "2.00 MB"
         *
         * @param  {number} bytes
         * @returns {string}
         */
        function formatBytes(bytes) {
            if (bytes < 1024)        return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }

        return { minify, formatBytes };
    })();


    /* =========================================================================
       VECTORIZER ENGINE
       Wraps ImageTracer.js to convert a File object into an SVG string.

       Process:
         1. fileToCanvas()  — Creates an Object URL from the File, draws it
                              onto a new <canvas>, returns the canvas.
                              Images wider/taller than 2048 px are scaled down
                              proportionally to prevent memory exhaustion.
         2. vectorize()     — Reads ImageData from the canvas context and
                              passes it to ImageTracer.imagedataToSVG() with
                              the options produced by SliderManager.getOptions().
                              Returns a Promise<string> resolving to raw SVG markup.

       NOTE: ImageTracer.js must be loaded via the CDN <script> tag in the HTML
       before this engine is called. The engine checks for its presence and
       throws a helpful error if it is missing.
    ========================================================================= */
    const VectorizerEngine = (() => {

        /**
         * fileToCanvas
         * Loads a File as an Image and paints it onto a new <canvas>.
         * Caps the canvas dimensions at 2048 × 2048 px to avoid
         * excessive memory usage or browser crashes on large images.
         *
         * @param  {File} file
         * @returns {Promise<HTMLCanvasElement>}
         */
        function fileToCanvas(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);

                img.onload = () => {
                    // Scale down if either dimension exceeds MAX
                    const MAX = 2048;
                    let { naturalWidth: w, naturalHeight: h } = img;
                    if (w > MAX || h > MAX) {
                        const ratio = Math.min(MAX / w, MAX / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width  = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);

                    URL.revokeObjectURL(url); // free the object URL immediately
                    resolve(canvas);
                };

                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('Failed to load image. Please ensure it is a valid PNG/JPG/WEBP.'));
                };

                img.src = url;
            });
        }

          /**
         * vectorize
         * Rasterizes the file to a canvas, extracts ImageData, and calls
         * ImageTracer.imagedataToSVG() to produce the SVG string.
         *
         * @param  {File}   file     Image file to vectorize
         * @param  {object} options  ImageTracer options from SliderManager.getOptions()
         * @returns {Promise<string>}  Raw SVG markup string
         */
        async function vectorize(file, options) {
            // Guard: ImageTracer.js must be loaded via the script tag
            if (typeof ImageTracer === 'undefined') {
                throw new Error(
                    'ImageTracer.js is not loaded. Please verify the local path: ' +
                    '../../assets/library/media-vision/imagetracer/imagetracer_v1.2.6.js'
                );
            }

            const canvas = await fileToCanvas(file);

            return new Promise((resolve, reject) => {
                try {
                    // Extract raw pixel data from the canvas context
                    const ctx       = canvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    // Pass ImageData directly to avoid CORS issues with URL-based loading
                    const svgString = ImageTracer.imagedataToSVG(imageData, options);

                    if (!svgString || svgString.length < 10) {
                        reject(new Error(
                            'Vectorization produced an empty SVG. ' +
                            'Try reducing the Color Count or Detail Level.'
                        ));
                    } else {
                        resolve(svgString);
                    }
                } catch (err) {
                    reject(err);
                }
            });
        }

        return { vectorize };
    })();


    /* =========================================================================
       CODE EXPORTER
       Transpiles the minified SVG string into framework-specific code:

         toReact()   — Generates a fully typed React functional component (JSX)
                       with camelCase attribute names, default props, and
                       spread-props support for width / height / className.

         toFlutter() — Generates a Flutter Dart StatelessWidget that renders
                       the SVG using the flutter_svg package (SvgPicture.string).
                       Also includes an inline comment showing the AssetImage
                       alternative pattern.
    ========================================================================= */
    const CodeExporter = (() => {

        /**
         * toReact
         * Converts raw SVG to a complete React JSX functional component.
         *
         * Performs the following SVG-to-JSX attribute transformations:
         *   class        → className
         *   fill-rule    → fillRule
         *   clip-path    → clipPath
         *   stroke-width → strokeWidth
         *   font-size    → fontSize
         *   … (see attrMap for full list)
         *
         * Self-closes empty elements: <tag></tag> → <tag />
         *
         * @param  {string} svgString      Minified SVG string
         * @param  {string} componentName  e.g. "VectorIcon"
         * @returns {string}  Complete JSX component source
         */
        function toReact(svgString, componentName = 'VectorIcon') {
            if (!svgString) return '// No SVG generated yet. Vectorize an image first.';

            // ── Attribute renaming map: SVG HTML attribute → JSX camelCase ──
            const attrMap = {
                'class':                        'className',
                'fill-rule':                    'fillRule',
                'clip-rule':                    'clipRule',
                'clip-path':                    'clipPath',
                'stroke-width':                 'strokeWidth',
                'stroke-linecap':               'strokeLinecap',
                'stroke-linejoin':              'strokeLinejoin',
                'stroke-dasharray':             'strokeDasharray',
                'stroke-dashoffset':            'strokeDashoffset',
                'stroke-miterlimit':            'strokeMiterlimit',
                'stroke-opacity':               'strokeOpacity',
                'fill-opacity':                 'fillOpacity',
                'font-size':                    'fontSize',
                'font-family':                  'fontFamily',
                'font-weight':                  'fontWeight',
                'text-anchor':                  'textAnchor',
                'text-decoration':              'textDecoration',
                'letter-spacing':               'letterSpacing',
                'word-spacing':                 'wordSpacing',
                'dominant-baseline':            'dominantBaseline',
                'alignment-baseline':           'alignmentBaseline',
                'color-interpolation':          'colorInterpolation',
                'shape-rendering':              'shapeRendering',
                'image-rendering':              'imageRendering',
                'stop-color':                   'stopColor',
                'stop-opacity':                 'stopOpacity',
                'marker-start':                 'markerStart',
                'marker-mid':                   'markerMid',
                'marker-end':                   'markerEnd',
                'flood-color':                  'floodColor',
                'flood-opacity':                'floodOpacity',
                'lighting-color':               'lightingColor',
                'color-profile':                'colorProfile',
                'enable-background':            'enableBackground',
                'baseline-shift':               'baselineShift',
                'glyph-orientation-horizontal': 'glyphOrientationHorizontal',
                'glyph-orientation-vertical':   'glyphOrientationVertical',
                'kerning':                      'kerning',
                'xlink:href':                   'href',    // React drops the xlink namespace
                'xmlns:xlink':                  null,      // removed entirely from JSX
                'xml:space':                    null,      // removed entirely from JSX
            };

            // Apply all attribute substitutions
            let jsx = svgString;
            Object.entries(attrMap).forEach(([from, to]) => {
                if (to === null) {
                    // Remove attribute entirely (e.g., xmlns:xlink="...")
                    const re = new RegExp(`\\s+${from.replace(':', '\\:')}="[^"]*"`, 'g');
                    jsx = jsx.replace(re, '');
                } else {
                    // Replace the attribute name
                    const re = new RegExp(`\\b${from.replace('-', '\\-').replace(':', '\\:')}=`, 'g');
                    jsx = jsx.replace(re, `${to}=`);
                }
            });

            // Self-close empty elements: <tag attr="val"></tag> → <tag attr="val" />
            jsx = jsx.replace(/<([a-zA-Z]+)([^>]*)>\s*<\/\1>/g, '<$1$2 />');

            return `import React from 'react';

/**
 * ${componentName}
 * Auto-generated by SVG Vectorizer ULTRA MAX
 * ⚡ 100% client-side — no server involved
 *
 * Usage:
 *   import ${componentName} from './${componentName}';
 *   <${componentName} width={200} height={200} />
 */
const ${componentName} = ({ width, height, style, className, ...props }) => (
  ${jsx
    .replace(/^<svg/, `<svg\n    width={width}\n    height={height}\n    style={style}\n    className={className}`)
    .split('\n')
    .map((line, i) => (i === 0 ? line : '  ' + line))
    .join('\n')}
);

${componentName}.defaultProps = {
  width:  300,
  height: 300,
};

export default ${componentName};`;
        }

        /**
         * toFlutter
         * Converts the minified SVG into a Flutter Dart StatelessWidget that
         * uses the flutter_svg package to render the SVG as a native widget.
         *
         * The output also includes:
         *   • pubspec.yaml dependency instructions
         *   • Commented AssetImage alternative pattern
         *
         * @param  {string} svgString  Minified SVG string
         * @returns {string}  Dart source code
         */
        function toFlutter(svgString) {
            if (!svgString) return '// No SVG generated yet. Vectorize an image first.';

            // Escape single quotes so the SVG embeds safely in Dart string literals
            const escapedSvg = svgString.replace(/'/g, "\\'");

            return `// Auto-generated by SVG Vectorizer ULTRA MAX
// 💙 Flutter + flutter_svg package required
// Add to pubspec.yaml:
//   dependencies:
//     flutter_svg: ^2.0.0

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Renders the vectorized SVG as a Flutter widget.
class VectorIcon extends StatelessWidget {
  final double width;
  final double height;
  final BoxFit fit;

  const VectorIcon({
    Key? key,
    this.width  = 200,
    this.height = 200,
    this.fit    = BoxFit.contain,
  }) : super(key: key);

  // ─── Raw SVG string ────────────────────────────────────────────────
  static const String _svgData = \'\'\'
${svgString}
\'\'\';
  // ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(
      _svgData,
      width:  width,
      height: height,
      fit:    fit,
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Alternative: Use as AssetImage if you save the SVG to assets/
// ────────────────────────────────────────────────────────────────────────────
//
// In pubspec.yaml, add:
//   flutter:
//     assets:
//       - assets/vector_icon.svg
//
// Then use:
//   SvgPicture.asset('assets/vector_icon.svg', width: 200, height: 200)
`;
        }

        return { toReact, toFlutter };
    })();


    /* =========================================================================
       LAYER INSPECTOR
       Parses the generated SVG DOM to list all shape elements.
       Renders a toggle-able layer list — like a miniature Illustrator panel.

       Each row shows:
         • A colour swatch (the fill of the shape)
         • A truncated path data label
         • An eye button to show/hide that path in the live preview

       The panel is hidden by default and made visible when LayerInspector.populate()
       is called after a successful vectorization.
    ========================================================================= */
    const LayerInspector = (() => {
        // Holds a reference to the live SVG element so we can mutate its children
        let liveSvgEl = null;

        /**
         * populate
         * Inspects all shape elements in the SVG and renders the layer list.
         *
         * @param {SVGSVGElement} svgEl  The live SVG DOM element in #previewWrap
         */
        function populate(svgEl) {
            liveSvgEl = svgEl;
            const layerList  = document.getElementById('layerList');
            const layerPanel = document.getElementById('layerPanel');
            const layerCount = document.getElementById('layerCount');
            if (!layerList || !layerPanel) return;

            // Select all shape primitives from the SVG
            const shapes = Array.from(svgEl.querySelectorAll(
                'path, polygon, circle, rect, ellipse, polyline'
            ));

            if (shapes.length === 0) {
                hide(layerPanel);
                return;
            }

            // Update path count badge
            if (layerCount) {
                layerCount.textContent = `${shapes.length} path${shapes.length !== 1 ? 's' : ''}`;
            }

            // Clear any previously rendered layers
            layerList.innerHTML = '';

            // Render one list item per shape
            shapes.forEach((shape, index) => {
                // Resolve fill colour: attribute → inline style → computed → fallback
                const fill = shape.getAttribute('fill') ||
                             shape.style.fill           ||
                             getComputedStyle(shape).fill ||
                             '#888888';

                // Truncate the path "d" attribute for readable display
                const pathD  = shape.getAttribute('d') || shape.tagName;
                const label  = pathD.length > 40 ? `${pathD.substring(0, 40)}…` : pathD;

                const li = document.createElement('li');
                li.className = 'layer-item'; // NOTE: referenced in tools-template.css Section 43
                li.setAttribute('role', 'listitem');
                li.dataset.index = index;

                li.innerHTML = `
                    <div class="layer-swatch" style="background-color:${fill};" aria-hidden="true"></div>
                    <span class="layer-name" title="${pathD}">${label}</span>
                    <button
                        class="layer-eye"
                        title="Toggle visibility of path ${index + 1}"
                        aria-label="Toggle visibility of path ${index + 1}"
                        aria-pressed="true"
                        data-index="${index}"
                    >
                        <i class="fa-solid fa-eye" aria-hidden="true"></i>
                    </button>
                `;

                // Attach eye-button click handler to toggle shape visibility in the live SVG
                const eyeBtn = li.querySelector('.layer-eye');
                eyeBtn.addEventListener('click', () => toggleLayer(shape, li, eyeBtn, index));

                layerList.appendChild(li);
            });

            // Reveal the panel (it is hidden by default)
            layerPanel.classList.add('visible');
        }

        /**
         * toggleLayer
         * Shows or hides a single SVG shape element and updates the
         * corresponding list item's visual state and ARIA attribute.
         *
         * @param {SVGElement}  shapeEl   The SVG shape to show/hide
         * @param {HTMLElement} listItem  The .layer-item <li> element
         * @param {HTMLElement} eyeBtn    The eye toggle <button>
         * @param {number}      index     Zero-based layer index (for labels)
         */
        function toggleLayer(shapeEl, listItem, eyeBtn, index) {
            const isHidden = listItem.classList.contains('layer-hidden');

            if (isHidden) {
                // Restore visibility
                shapeEl.style.display = '';
                listItem.classList.remove('layer-hidden');
                eyeBtn.setAttribute('aria-pressed', 'true');
                eyeBtn.classList.remove('hidden');
                eyeBtn.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
                eyeBtn.title = `Hide path ${index + 1}`;
            } else {
                // Hide the shape
                shapeEl.style.display = 'none';
                listItem.classList.add('layer-hidden');
                eyeBtn.setAttribute('aria-pressed', 'false');
                eyeBtn.classList.add('hidden');
                eyeBtn.innerHTML = '<i class="fa-regular fa-eye-slash" aria-hidden="true"></i>';
                eyeBtn.title = `Show path ${index + 1}`;
            }
        }

        /**
         * reset
         * Clears the layer list and hides the panel.
         * Called by SingleWorkflow.reset() when the user clicks Reset.
         */
        function reset() {
            const layerList  = document.getElementById('layerList');
            const layerPanel = document.getElementById('layerPanel');
            if (layerList)  layerList.innerHTML = '';
            if (layerPanel) layerPanel.classList.remove('visible');
            liveSvgEl = null;
        }

        return { populate, reset };
    })();


    /* =========================================================================
       SPLIT VIEW CONTROLLER
       Orchestrates the two-pane view shown after a successful vectorization.

       Left pane  (#previewWrap)    — Injected SVG rendered visually
       Right pane (#codeInspector)  — Pretty-printed SVG source code

       Also:
         • Updates the Original / Minified size badges
         • Calls LayerInspector.populate() to build the layer list
         • Updates the Code Export stats panel
         • Triggers CodeExporter to generate React + Flutter snippets
    ========================================================================= */
    const SplitViewController = (() => {
        // Preserve raw and minified SVG strings for download / copy actions
        let rawSvgString = '';
        let minSvgString = '';
        let minStats     = {};

        /**
         * display
         * Main entry point — called after VectorizerEngine.vectorize() resolves.
         * Runs the full pipeline: minify → inject preview → pretty-print source
         * → update badges → show split view → update stats → generate code.
         *
         * @param {string} svgString  Raw SVG output from VectorizerEngine
         */
        function display(svgString) {
            rawSvgString = svgString;

            // ── Run the minifier ──────────────────────────────────────────────
            const result = MinifierEngine.minify(svgString);
            minSvgString = result.minified;
            minStats     = result;

            // ── Left pane: inject SVG into the preview container ──────────────
            const previewWrap = document.getElementById('previewWrap');
            if (previewWrap) {
                previewWrap.innerHTML = svgString;

                // Make the SVG responsive within its container
                const svgEl = previewWrap.querySelector('svg');
                if (svgEl) {
                    svgEl.removeAttribute('width');
                    svgEl.removeAttribute('height');
                    svgEl.style.maxWidth  = '100%';
                    svgEl.style.maxHeight = '340px';
                    svgEl.style.height    = 'auto';

                    // Build the layer inspector list from this SVG
                    LayerInspector.populate(svgEl);
                }
            }

            // ── Right pane: pretty-print the SVG source ───────────────────────
            const codeContent = document.getElementById('codeContent');
            if (codeContent) {
                codeContent.textContent = prettyPrintSvg(svgString);
            }

            // ── Update size badges ────────────────────────────────────────────
            const origSizeEl = document.getElementById('origSize');
            const minSizeEl  = document.getElementById('minSize');
            if (origSizeEl) origSizeEl.textContent = MinifierEngine.formatBytes(result.origBytes);
            if (minSizeEl)  minSizeEl.textContent  = MinifierEngine.formatBytes(result.minBytes);

            // ── Reveal the split view ─────────────────────────────────────────
            const splitView = document.getElementById('splitView');
            if (splitView) splitView.classList.add('visible');

            // ── Populate Code Export panel ────────────────────────────────────
            updateCodeStats(svgString, result);
            updateCodeExport(minSvgString);
        }

        /**
         * prettyPrintSvg
         * A lightweight SVG formatter that inserts line breaks and
         * 2-space indentation between XML tags, making the code inspector
         * significantly more readable without any external libraries.
         *
         * @param  {string} svgString  Raw (un-formatted) SVG markup
         * @returns {string}  Indented, human-readable SVG
         */
        function prettyPrintSvg(svgString) {
            let indent = 0;
            return svgString
                .replace(/></g, '>\n<')  // insert line break between adjacent tags
                .split('\n')
                .map(line => {
                    line = line.trim();
                    if (!line) return '';

                    // Decrease indent before rendering closing tags
                    if (line.startsWith('</')) indent = Math.max(0, indent - 1);

                    const out = '  '.repeat(indent) + line;

                    // Increase indent after opening tags (not self-closing, not closing)
                    if (!line.startsWith('</') && !line.endsWith('/>') && line.includes('<')) {
                        indent++;
                    }
                    return out;
                })
                .filter(Boolean)
                .join('\n');
        }

        /**
         * updateCodeStats
         * Counts paths, unique colours, and computes byte sizes to populate
         * the five stat cells on the Code Export tab.
         *
         * @param {string} svgString   Raw SVG markup
         * @param {object} minResult   Return value from MinifierEngine.minify()
         */
        function updateCodeStats(svgString, minResult) {
            // Count all shape elements by tag name
            const paths = (svgString.match(/<path/g)    || []).length +
                          (svgString.match(/<polygon/g)  || []).length +
                          (svgString.match(/<circle/g)   || []).length +
                          (svgString.match(/<rect/g)     || []).length;

            // Count distinct fill attribute values
            const fillMatches  = svgString.match(/fill="([^"]*)"/g) || [];
            const uniqueColors = new Set(
                fillMatches.map(m => m.replace('fill="', '').replace('"', ''))
            ).size;

            // Helper to safely set an element's text content
            const set = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            set('statPaths',   paths);
            set('statColors',  uniqueColors);
            set('statRawSize', MinifierEngine.formatBytes(minResult.origBytes));
            set('statMinSize', MinifierEngine.formatBytes(minResult.minBytes));
            set('statSavings', minResult.savings);
        }

        /**
         * updateCodeExport
         * Calls CodeExporter and injects the generated React JSX and
         * Flutter Dart code into their respective <code> elements.
         *
         * @param {string} svgMin  Minified SVG string
         */
        function updateCodeExport(svgMin) {
            const reactCode   = document.getElementById('reactCodeContent');
            const flutterCode = document.getElementById('flutterCodeContent');
            if (reactCode)   reactCode.textContent   = CodeExporter.toReact(svgMin, 'VectorIcon');
            if (flutterCode) flutterCode.textContent = CodeExporter.toFlutter(svgMin);
        }

        /**
         * reset
         * Hides the split view and clears all state.
         * Called when the user clicks "Reset".
         */
        function reset() {
            const splitView = document.getElementById('splitView');
            if (splitView) splitView.classList.remove('visible');
            rawSvgString = '';
            minSvgString = '';
            minStats     = {};

            const previewWrap = document.getElementById('previewWrap');
            if (previewWrap) previewWrap.innerHTML = '';

            const codeContent = document.getElementById('codeContent');
            if (codeContent) codeContent.textContent = '// Your generated SVG code will appear here…';
        }

        // Expose the current raw/min SVG strings so button handlers can access them
        function getRawSvg() { return rawSvgString; }
        function getMinSvg() { return minSvgString; }

        return { display, reset, getRawSvg, getMinSvg };
    })();


    /* =========================================================================
       DROP ZONE MANAGER
       Attaches drag-and-drop and click-to-browse interactions to both the
       single-image zone (#dropZone) and the batch zone (#batchDropZone).

       Emits file(s) to a caller-supplied callback so the drop zone logic
       is fully decoupled from the workflow that handles the files.
    ========================================================================= */
    const DropZoneManager = (() => {

        /**
         * initSingleZone
         * Sets up the single-image drop zone.
         * Calls onFileSelected(file) with the chosen File object.
         *
         * @param {function(File): void} onFileSelected
         */
        function initSingleZone(onFileSelected) {
            const zone      = document.getElementById('dropZone');
            const fileInput = document.getElementById('fileInput');
            if (!zone || !fileInput) return;

            // Click / keyboard → open native file picker
            zone.addEventListener('click', () => fileInput.click());
            zone.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.click();
                }
            });

            // File picker selection
            fileInput.addEventListener('change', () => {
                if (fileInput.files.length) onFileSelected(fileInput.files[0]);
                fileInput.value = ''; // reset so the same file can be re-selected
            });

            // Drag-over: add visual highlight
            zone.addEventListener('dragover', e => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });

            // Drag-leave: remove highlight
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

            // Drop: validate and pass file to callback
            zone.addEventListener('drop', e => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                const file = e.dataTransfer?.files?.[0];
                if (file && isValidImage(file)) {
                    onFileSelected(file);
                } else {
                    toast('Please drop a PNG, JPG, or WEBP image.', true);
                }
            });
        }

        /**
         * initBatchZone
         * Sets up the multi-image batch drop zone.
         * Calls onFilesSelected(files[]) with an Array of validated File objects.
         *
         * @param {function(File[]): void} onFilesSelected
         */
        function initBatchZone(onFilesSelected) {
            const zone      = document.getElementById('batchDropZone');
            const fileInput = document.getElementById('batchFileInput');
            if (!zone || !fileInput) return;

            zone.addEventListener('click', () => fileInput.click());
            zone.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.click();
                }
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files.length) {
                    onFilesSelected(Array.from(fileInput.files).filter(isValidImage));
                }
                fileInput.value = '';
            });

            zone.addEventListener('dragover', e => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', e => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                const files = Array.from(e.dataTransfer?.files || []).filter(isValidImage);
                if (files.length) {
                    onFilesSelected(files);
                } else {
                    toast('No valid images found. Accepted: PNG, JPG, WEBP.', true);
                }
            });
        }

        /**
         * isValidImage
         * Returns true if the file's MIME type is one of the accepted raster formats.
         *
         * @param  {File}    file
         * @returns {boolean}
         */
        function isValidImage(file) {
            return ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
        }

        return { initSingleZone, initBatchZone, isValidImage };
    })();


    /* =========================================================================
       CLIPBOARD MANAGER
       Provides copy-to-clipboard functionality with global toast feedback.
       Supports both the modern Clipboard API (HTTPS) and an execCommand
       fallback for older browsers or HTTP contexts.
    ========================================================================= */
    const ClipboardManager = (() => {

        /**
         * copy
         * Copies a plain text string to the clipboard.
         * Displays a success or error toast via the global toast system.
         *
         * @param  {string} text    Content to write to the clipboard
         * @param  {string} [label] Human-readable label used in the toast message
         */
        async function copy(text, label = 'Content') {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    // Modern Clipboard API — requires HTTPS or localhost
                    await navigator.clipboard.writeText(text);
                } else {
                    // Fallback: create a temporary off-screen textarea
                    const textarea = document.createElement('textarea');
                    textarea.value          = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity  = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    textarea.remove();
                }
                toast(`${label} copied to clipboard!`);
            } catch {
                toast('Failed to copy. Please select and copy manually.', true);
            }
        }

        /**
         * copyAsBase64
         * Encodes the SVG string as a Base64 Data URI and copies it.
         * Useful for embedding the SVG directly in CSS backgrounds or
         * <img> src attributes without a separate file.
         *
         * @param {string} svgString  Raw or minified SVG
         */
        function copyAsBase64(svgString) {
            if (!svgString) {
                toast('No SVG to copy. Vectorize an image first.', true);
                return;
            }
            const b64 = btoa(unescape(encodeURIComponent(svgString)));
            copy(`data:image/svg+xml;base64,${b64}`, 'SVG Base64 URI');
        }

        return { copy, copyAsBase64 };
    })();


    /* =========================================================================
       DOWNLOAD HELPER
       Creates a Blob from the SVG string and triggers a browser download.
    ========================================================================= */

    /**
     * downloadSvg
     * Triggers a browser download of the given SVG string as a .svg file.
     *
     * @param {string} svgString          The SVG content to download
     * @param {string} [filename]         Suggested filename for the saved file
     */
    function downloadSvg(svgString, filename = 'vectorized.svg') {
        if (!svgString) {
            toast('No SVG to download. Vectorize an image first.', true);
            return;
        }

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url  = URL.createObjectURL(blob);

        // Create a temporary anchor, click it, then clean up
        const a = Object.assign(document.createElement('a'), {
            href:     url,
            download: filename,
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast(`Downloaded "${filename}"`);
    }


    /* =========================================================================
       BATCH MANAGER
       Manages multi-image batch processing using an inline Web Worker.

       DESIGN RATIONALE — WHY A BLOB WORKER?
       ─────────────────────────────────────
       A standard Web Worker requires a separate JavaScript file served from the
       same origin. Since we want the tool to be fully self-contained (one HTML +
       one JS file), the worker code is encoded as a template string, wrapped in a
       Blob, and the Blob's object URL is passed to `new Worker(blobUrl)`.
       This is a well-supported technique in all modern browsers.

       ARCHITECTURE:
       ┌─ Main Thread ─────────────────────────────────────────────────┐
       │ file → <canvas> → ImageData → postMessage({ imageDataObj })   │
       │ ← postMessage({ svgString }) ← Worker processes it           │
       └───────────────────────────────────────────────────────────────┘

       NOTE: ImageTracer.js uses `document` in some branches. We avoid this
       by extracting ImageData on the main thread (where we have canvas access)
       and sending the raw pixel array to the worker.

       One worker processes all queue items sequentially to avoid spawning
       too many threads on low-memory devices.
    ========================================================================= */
    const BatchManager = (() => {
        /** @type {Array<{ file: File, status: string, svgResult: string|null }>} */
        let queue      = [];
        let zipArchive = null;
        let doneCount  = 0;

        /* ── Helper: extract ImageData from a File on the main thread ──── */

        /**
         * fileToImageData
         * Converts a File to an ImageData object by drawing it onto a canvas.
         * Caps at 1600 × 1600 px for batch mode (lower than single mode to
         * allow multiple images to be in flight simultaneously).
         *
         * @param  {File} file
         * @returns {Promise<ImageData>}
         */
        function fileToImageData(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);

                img.onload = () => {
                    const MAX = 1600;
                    let { naturalWidth: w, naturalHeight: h } = img;
                    if (w > MAX || h > MAX) {
                        const r = Math.min(MAX / w, MAX / h);
                        w = Math.round(w * r);
                        h = Math.round(h * r);
                    }
                    const c = document.createElement('canvas');
                    c.width = w; c.height = h;
                    c.getContext('2d').drawImage(img, 0, 0, w, h);
                    URL.revokeObjectURL(url);
                    resolve(c.getContext('2d').getImageData(0, 0, w, h));
                };

                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('Image load failed'));
                };

                img.src = url;
            });
        }

        /* ── Create inline Web Worker via Blob URL ─────────────────────── */

        /**
         * createWorker
         * Builds a self-contained Worker from a template string using a Blob URL.
         * The worker receives ImageData objects (serializable) from the main thread,
         * loads ImageTracer.js via importScripts(), and posts back SVG strings.
         *
         * @returns {Worker}
         */
        function createWorker() {
            const workerCode = `
                let itLoaded = false;

                self.onmessage = async function(e) {
                    const { id, imageDataObj, options, tracerUrl } = e.data;

                    // Load ImageTracer only once per worker lifetime
                    if (!itLoaded) {
                        try {
                            importScripts(tracerUrl);
                            itLoaded = true;
                        } catch(err) {
                            self.postMessage({ id, error: 'Failed to load ImageTracer in worker: ' + err.message });
                            return;
                        }
                    }

                    try {
                        // Reconstruct ImageData from the serialised plain object
                        const imgData = new ImageData(
                            new Uint8ClampedArray(imageDataObj.data),
                            imageDataObj.width,
                            imageDataObj.height
                        );
                        const svgString = ImageTracer.imagedataToSVG(imgData, options);
                        self.postMessage({ id, svgString });
                    } catch(err) {
                        self.postMessage({ id, error: err.message });
                    }
                };
            `;

            const blob    = new Blob([workerCode], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            return new Worker(blobUrl);
        }

        /* ── Add files to the queue ──────────────────────────────────── */

        /**
         * addFiles
         * Appends an array of validated File objects to the queue,
         * re-renders the queue list, and shows the batch control buttons.
         *
         * @param {File[]} files  Array of image Files
         */
        function addFiles(files) {
            files.forEach(file => {
                queue.push({ file, status: 'queued', svgResult: null });
            });
            renderQueue();

            const batchActions = document.getElementById('batchActions');
            show(batchActions, 'flex');
        }

        /* ── Render the entire queue list in the UI ──────────────────── */

        /**
         * renderQueue
         * Rebuilds the entire #batchQueue DOM from the current queue array.
         * Each item shows a thumbnail, filename, file size, and status badge.
         */
        function renderQueue() {
            const container = document.getElementById('batchQueue');
            if (!container) return;
            container.innerHTML = '';

            queue.forEach((item, index) => {
                const div      = document.createElement('div');
                div.className  = `batch-item ${item.status}`;
                div.id         = `batch-item-${index}`;

                const thumbUrl = URL.createObjectURL(item.file);

                // Status markup fragments — NOTE: class names referenced in tools-template.css
                const statusLabels = {
                    queued:     '<span class="batch-status queued">Queued</span>',
                    processing: '<div class="batch-spinner"></div><span class="batch-status working">Processing…</span>',
                    done:       '<span class="batch-status done"><i class="fa-solid fa-check"></i> Done</span>',
                    error:      '<span class="batch-status error"><i class="fa-solid fa-xmark"></i> Error</span>',
                };

                div.innerHTML = `
                    <img class="batch-thumb" src="${thumbUrl}" alt="${item.file.name}" loading="lazy">
                    <div class="batch-item-info">
                        <div class="batch-item-name">${item.file.name}</div>
                        <div class="batch-item-meta">${(item.file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    ${statusLabels[item.status] || ''}
                `;

                container.appendChild(div);
            });
        }

        /* ── Update a single queue item's status ─────────────────────── */

        /**
         * updateItemStatus
         * Updates the DOM for one queue item without re-rendering the whole list.
         * Changes the modifier class on the row and replaces the status element.
         *
         * @param {number} index   Zero-based queue index
         * @param {string} status  'queued' | 'processing' | 'done' | 'error'
         */
        function updateItemStatus(index, status) {
            queue[index].status = status;
            const itemEl = document.getElementById(`batch-item-${index}`);
            if (!itemEl) return;

            itemEl.className = `batch-item ${status}`;

            const statusLabels = {
                queued:     '<span class="batch-status queued">Queued</span>',
                processing: '<div class="batch-spinner"></div><span class="batch-status working">Processing…</span>',
                done:       '<span class="batch-status done"><i class="fa-solid fa-check"></i> Done</span>',
                error:      '<span class="batch-status error"><i class="fa-solid fa-xmark"></i> Error</span>',
            };

            // Replace existing status/spinner elements
            itemEl.querySelectorAll('.batch-spinner').forEach(s => s.remove());
            const oldStatus = itemEl.querySelector('.batch-status');
            if (oldStatus) oldStatus.remove();

            const wrap = document.createElement('div');
            wrap.style.display = 'contents';
            wrap.innerHTML = statusLabels[status] || '';
            itemEl.appendChild(wrap);
        }

        /* ── Update overall progress bar ─────────────────────────────── */

        /**
         * updateProgress
         * Sets the progress bar fill width and updates the progress label text.
         *
         * @param {number} done   Number of items processed so far
         * @param {number} total  Total number of items in the queue
         */
        function updateProgress(done, total) {
            const fill  = document.getElementById('batchProgressFill');
            const label = document.getElementById('batchProgressLabel');
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

            if (fill) {
                fill.style.width = `${pct}%`;
                fill.setAttribute('aria-valuenow', pct);
            }
            if (label) label.textContent = `Processing ${done} of ${total}…`;
        }

        /* ── Main process function ───────────────────────────────────── */

           /**
         * processAll
         * Iterates through the queue, sending each image to the inline Web Worker
         * for vectorization. Falls back to main-thread processing if Web Workers
         * are unavailable. Builds a JSZip archive with the minified SVG results.
         */
        async function processAll() {
            if (queue.length === 0) {
                toast('Add some images to the queue first.', true);
                return;
            }

            // Disable process button to prevent double-clicks
            const btnProcess = document.getElementById('btnBatchProcess');
            if (btnProcess) btnProcess.disabled = true;

            // Show the progress bar
            const progressWrap = document.getElementById('batchProgressWrap');
            show(progressWrap, 'block');

            zipArchive = typeof JSZip !== 'undefined' ? new JSZip() : null;
            doneCount  = 0;
            const total = queue.length;

            // Locate the ImageTracer script URL for the worker to importScripts()
            const itScript  = Array.from(document.scripts).find(s => s.src && s.src.includes('imagetracer'));
            
            // Generate an absolute URL for the worker to prevent cross-origin path resolution issues
            const fallbackPath = '../../assets/library/media-vision/imagetracer/imagetracer_v1.2.6.js';
            const absoluteFallbackUrl = new URL(fallbackPath, window.location.href).href;
            const tracerUrl = itScript ? itScript.src : absoluteFallbackUrl;

            const options = SliderManager.getOptions();

            // ── Attempt to spawn the inline Web Worker ────────────────────────
            let worker;
            try {
                worker = createWorker();
            } catch {
                // Web Workers unavailable — process synchronously on main thread
                toast('Web Worker unavailable. Processing on main thread…');
                for (let i = 0; i < queue.length; i++) {
                    await processItemMainThread(i, options);
                    doneCount++;
                    updateProgress(doneCount, total);
                }
                finalise(btnProcess);
                return;
            }

            // ── Worker message handling via per-item Promise ──────────────────
            let resolveWorker, rejectWorker;

            worker.onmessage = e => {
                const { svgString, error } = e.data;
                if (error) rejectWorker(new Error(error));
                else       resolveWorker(svgString);
            };
            worker.onerror = e => rejectWorker(new Error(e.message));

            // ── Process items one at a time through the single worker ─────────
            for (let i = 0; i < queue.length; i++) {
                updateItemStatus(i, 'processing');
                updateProgress(i, total);

                try {
                    const imageData = await fileToImageData(queue[i].file);

                    // Serialise ImageData to a plain object for postMessage transfer
                    const imageDataObj = {
                        data:   Array.from(imageData.data), // Uint8ClampedArray → Array
                        width:  imageData.width,
                        height: imageData.height,
                    };

                    const svgResult = await new Promise((res, rej) => {
                        resolveWorker = res;
                        rejectWorker  = rej;
                        worker.postMessage({ id: i, imageDataObj, options, tracerUrl });
                    });

                    queue[i].svgResult = svgResult;

                    // Add minified SVG to the ZIP archive
                    if (zipArchive) {
                        const minResult = MinifierEngine.minify(svgResult);
                        const fname     = queue[i].file.name.replace(/\.[^.]+$/, '') + '.svg';
                        zipArchive.file(fname, minResult.minified);
                    }
                    updateItemStatus(i, 'done');
                } catch (err) {
                    updateItemStatus(i, 'error');
                    console.error(`[BatchManager] Failed to process ${queue[i].file.name}:`, err);
                }

                doneCount++;
                updateProgress(doneCount, total);
            }

            worker.terminate(); // release the worker thread
            finalise(btnProcess);
        }

        /* ── Main-thread fallback when Web Workers are unavailable ──── */

        /**
         * processItemMainThread
         * Vectorizes a single queue item on the main thread (blocking).
         * Only used when Worker creation fails.
         *
         * @param {number} index    Queue index of the item to process
         * @param {object} options  ImageTracer options
         */
        async function processItemMainThread(index, options) {
            updateItemStatus(index, 'processing');
            try {
                const svgResult = await VectorizerEngine.vectorize(queue[index].file, options);
                queue[index].svgResult = svgResult;
                if (zipArchive) {
                    const minResult = MinifierEngine.minify(svgResult);
                    const fname     = queue[index].file.name.replace(/\.[^.]+$/, '') + '.svg';
                    zipArchive.file(fname, minResult.minified);
                }
                updateItemStatus(index, 'done');
            } catch {
                updateItemStatus(index, 'error');
            }
        }

        /* ── Finalise after all items are processed ──────────────────── */

        /**
         * finalise
         * Called after the last queue item completes (success or error).
         * Updates the progress label, enables the ZIP export button, and
         * shows a completion toast.
         *
         * @param {HTMLElement|null} btnProcess  The Process All button to re-enable
         */
        function finalise(btnProcess) {
            const progressLabel = document.getElementById('batchProgressLabel');
            if (progressLabel) {
                progressLabel.textContent = `Complete! ${doneCount} of ${queue.length} processed.`;
            }

            // Enable the Export ZIP button
            const btnZip = document.getElementById('btnBatchExportZip');
            if (btnZip) btnZip.disabled = false;

            if (btnProcess) btnProcess.disabled = false;

            toast(`Batch complete! ${doneCount} image(s) vectorized.`);
        }

        /* ── Export all collected SVGs as a ZIP archive ──────────────── */

        /**
         * exportZip
         * Generates the ZIP blob from the JSZip archive and triggers download.
         * Requires JSZip to be loaded. Falls back to a raw Blob URL if
         * FileSaver.js is unavailable.
         */
        async function exportZip() {
            if (!zipArchive) {
                toast('No ZIP data available. Process images first.', true);
                return;
            }
            if (typeof JSZip === 'undefined') {
                toast('JSZip library not loaded. Check the script path.', true);
                return;
            }

            try {
                const blob = await zipArchive.generateAsync({
                    type:        'blob',
                    compression: 'DEFLATE',
                });

                if (typeof saveAs !== 'undefined') {
                    // Use FileSaver.js if available (cleaner UX)
                    saveAs(blob, 'vectorized-svgs.zip');
                } else {
                    // Fallback: create a temporary anchor element
                    const url = URL.createObjectURL(blob);
                    const a   = Object.assign(document.createElement('a'), {
                        href:     url,
                        download: 'vectorized-svgs.zip',
                    });
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
                toast('ZIP downloaded successfully!');
            } catch (err) {
                toast('Failed to create ZIP: ' + err.message, true);
            }
        }

        /* ── Clear the queue ─────────────────────────────────────────── */

        /**
         * clear
         * Empties the queue array and resets the batch UI to its initial state.
         */
        function clear() {
            queue      = [];
            zipArchive = null;
            doneCount  = 0;

            const container = document.getElementById('batchQueue');
            if (container) container.innerHTML = '';

            hide(document.getElementById('batchActions'));
            hide(document.getElementById('batchProgressWrap'));

            const btnZip = document.getElementById('btnBatchExportZip');
            if (btnZip) btnZip.disabled = true;
        }

        return { addFiles, processAll, exportZip, clear };
    })();


    /* =========================================================================
       SINGLE IMAGE WORKFLOW
       Orchestrates the full single-image pipeline:
         1. onFileSelected() — stores the file, shows action buttons, gives feedback
         2. vectorize()      — triggers the engine, shows skeleton, handles errors
         3. reset()          — clears all state and restores the initial UI
    ========================================================================= */
    const SingleWorkflow = (() => {
        let currentFile = null;

        /**
         * onFileSelected
         * Called by DropZoneManager.initSingleZone() when the user selects a file.
         * Updates the drop zone subtitle to confirm the selection and shows the
         * Vectorize / Reset buttons.
         *
         * @param {File} file  The selected image File object
         */
        function onFileSelected(file) {
            currentFile = file;

            // Show action buttons (Vectorize Now / Reset)
            show(document.getElementById('actionArea'), 'flex');

            // Update the drop zone sub-text to confirm the file is ready
            const dropSub = document.querySelector('#dropZone .svv-drop-sub');
            if (dropSub) {
                dropSub.textContent =
                    `✓ ${file.name} (${(file.size / 1024).toFixed(1)} KB) — Click "Vectorize Now"`;
            }

            toast(`"${file.name}" ready for vectorization.`);
        }

        /**
         * vectorize
         * Triggers the full vectorization pipeline for the currently stored file.
         * Shows the skeleton loader while processing; hides it on completion.
         * Disables action buttons to prevent concurrent runs.
         */
        async function vectorize() {
            if (!currentFile) {
                toast('Please upload an image first.', true);
                return;
            }

            const skeleton = document.getElementById('skeletonLoader');
            const splitView = document.getElementById('splitView');
            const btnVec   = document.getElementById('btnVectorize');
            const btnReset = document.getElementById('btnReset');

            // Show loading state
            show(skeleton, 'block');
            if (splitView) splitView.classList.remove('visible');
            LayerInspector.reset();

            // Disable buttons during processing to prevent double-clicks
            if (btnVec)   btnVec.disabled   = true;
            if (btnReset) btnReset.disabled  = true;

            try {
                const options   = SliderManager.getOptions();
                const svgString = await VectorizerEngine.vectorize(currentFile, options);

                // Display results in the split view
                SplitViewController.display(svgString);
                toast('Vectorization complete!');
            } catch (err) {
                toast(`Error: ${err.message}`, true);
                console.error('[SingleWorkflow] Vectorize error:', err);
            } finally {
                // Always restore button state and hide the skeleton
                hide(skeleton);
                if (btnVec)   btnVec.disabled   = false;
                if (btnReset) btnReset.disabled  = false;
            }
        }

        /**
         * reset
         * Restores the single-image panel to its initial empty state.
         * Clears the current file, hides the split view and layer inspector,
         * and resets the drop zone sub-text.
         */
        function reset() {
            currentFile = null;
            SplitViewController.reset();
            LayerInspector.reset();

            hide(document.getElementById('skeletonLoader'));
            hide(document.getElementById('actionArea'));

            // Restore the original drop zone hint text
            const dropSub = document.querySelector('#dropZone .svv-drop-sub');
            if (dropSub) {
                dropSub.innerHTML =
                    'or <span class="svv-drop-link">click to browse</span> — Max 10 MB';
            }

            // Clear the file input so the same file can be re-selected
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.value = '';

            toast('Reset complete. Ready for a new image.');
        }

        return { onFileSelected, vectorize, reset };
    })();


    /* =========================================================================
       BUTTON EVENT BINDING
       Centralised attachment of all button click handlers.
       Called once during init() after the DOM is confirmed ready.
    ========================================================================= */

    /**
     * bindButtons
     * Attaches click listeners to every action button in the tool.
     * Uses safe getElementById checks to avoid errors if an element is absent.
     */
    function bindButtons() {
        // ── Single workflow ────────────────────────────────────────────────
        const btnVectorize = document.getElementById('btnVectorize');
        if (btnVectorize) btnVectorize.addEventListener('click', () => SingleWorkflow.vectorize());

        const btnReset = document.getElementById('btnReset');
        if (btnReset) btnReset.addEventListener('click', () => SingleWorkflow.reset());

        // ── Split view actions ─────────────────────────────────────────────
        const btnCopyBase64 = document.getElementById('btnCopyBase64');
        if (btnCopyBase64) btnCopyBase64.addEventListener('click', () => {
            ClipboardManager.copyAsBase64(SplitViewController.getMinSvg());
        });

        const btnCopyCode = document.getElementById('btnCopyCode');
        if (btnCopyCode) btnCopyCode.addEventListener('click', () => {
            const code = document.getElementById('codeContent')?.textContent;
            ClipboardManager.copy(code || '', 'SVG Source');
        });

        const btnDownloadSVG = document.getElementById('btnDownloadSVG');
        if (btnDownloadSVG) btnDownloadSVG.addEventListener('click', () => {
            downloadSvg(SplitViewController.getRawSvg(), 'vectorized.svg');
        });

        const btnDownloadMin = document.getElementById('btnDownloadMin');
        if (btnDownloadMin) btnDownloadMin.addEventListener('click', () => {
            downloadSvg(SplitViewController.getMinSvg(), 'vectorized.min.svg');
        });

        // ── Code export tab ────────────────────────────────────────────────
        const btnCopyReact = document.getElementById('btnCopyReact');
        if (btnCopyReact) btnCopyReact.addEventListener('click', () => {
            const code = document.getElementById('reactCodeContent')?.textContent;
            ClipboardManager.copy(code || '', 'React JSX Code');
        });

        const btnCopyFlutter = document.getElementById('btnCopyFlutter');
        if (btnCopyFlutter) btnCopyFlutter.addEventListener('click', () => {
            const code = document.getElementById('flutterCodeContent')?.textContent;
            ClipboardManager.copy(code || '', 'Flutter Code');
        });

        // ── Batch buttons ──────────────────────────────────────────────────
        const btnBatchProcess = document.getElementById('btnBatchProcess');
        if (btnBatchProcess) btnBatchProcess.addEventListener('click', () => BatchManager.processAll());

        const btnBatchExportZip = document.getElementById('btnBatchExportZip');
        if (btnBatchExportZip) btnBatchExportZip.addEventListener('click', () => BatchManager.exportZip());

        const btnBatchClear = document.getElementById('btnBatchClear');
        if (btnBatchClear) btnBatchClear.addEventListener('click', () => BatchManager.clear());
    }


    /* =========================================================================
       MOBILE DEVICE WARNING
       This tool uses the HTML5 Canvas API and Web Workers, which are universally
       supported. However, batch processing of large images may be slow on
       low-memory mobile devices. We detect mobile and show a non-blocking
       informational toast to set expectations.
    ========================================================================= */

    /**
     * checkMobileWarning
     * Detects mobile / low-memory devices and shows a non-blocking
     * informational toast via the global toast system if batch processing
     * may be degraded.
     */
    function checkMobileWarning() {
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            // Delay slightly so the page finishes rendering first
            setTimeout(() => {
                toast(
                    'Batch mode may be slow on mobile. Single Convert works great!'
                );
            }, 1500);
        }
    }


    /* =========================================================================
       INITIALISATION
       Entry point — wires everything together once the DOM is ready.
    ========================================================================= */

    /**
     * init
     * Called once the DOM is fully parsed. Initialises all sub-systems,
     * binds all event listeners, sets the initial UI state, and runs the
     * mobile compatibility check.
     */
    function init() {
        // Initialise tab switching and slider live-value display
        TabManager.init();
        SliderManager.init();

        // Wire up drag-and-drop / file-picker for both drop zones
        DropZoneManager.initSingleZone(file  => SingleWorkflow.onFileSelected(file));
        DropZoneManager.initBatchZone(files => BatchManager.addFiles(files));

        // Attach all button click handlers
        bindButtons();

        // Set initial visibility: action area, skeleton, and batch progress are hidden
        hide(document.getElementById('actionArea'));
        hide(document.getElementById('skeletonLoader'));
        hide(document.getElementById('batchProgressWrap'));

        // Show a non-blocking warning on mobile devices
        checkMobileWarning();

        // Debug confirmation in the console
        console.info(
            '%c[SVG Vectorizer ULTRA MAX] v1.0 — Initialised ✔',
            'color: #a78bfa; font-weight: bold; font-size: 12px;'
        );
    }

    /* ── Wait for DOM ready before initialising ───────────────────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init(); // DOM already parsed (e.g., script loaded with defer attribute)
    }

})(); // End IIFE — SVGVectorizerUltraMax
