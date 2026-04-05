/**
 * ============================================================
 *  MEME STUDIO ULTRA PRO — CORE ENGINE  v3.0
 *  File        : script.js
 *  Tool        : Multi-Layer Canvas Meme Generator
 *  Author      : MD KAWSAR — Trusted Tools Web
 *  Architecture: Modular IIFE-based Object-Oriented State Engine
 *
 *  THREE PRIMARY MODULES
 *  ─────────────────────────────────────────────────────────
 *  MemeEngine     — Canvas rendering, layer management, history,
 *                   drag/touch interaction, export pipeline.
 *  UISystem       — DOM data binding, tab switching, layer list
 *                   updates, control panel synchronisation.
 *  TemplateSystem — Built-in template modal open/close and
 *                   dynamic thumbnail grid generation.
 *
 *  GLOBAL DEPENDENCIES
 *  ─────────────────────────────────────────────────────────
 *  window.showToast(message, isError)  ← global.js toast system
 *    - isError=false (default) → success / info toast (green)
 *    - isError=true            → error toast (red)
 *
 *  KEYBOARD SHORTCUTS
 *  ─────────────────────────────────────────────────────────
 *  Delete / Backspace  → Delete the currently selected layer
 *  Ctrl + Z            → Undo last action
 *  Ctrl + Y            → Redo last undone action
 *  Ctrl + D            → Duplicate the selected layer
 * ============================================================
 */


/* ============================================================
   MODULE 1: MemeEngine
   Encapsulates all canvas drawing, layer state, history
   management, pointer events, and the HD export pipeline.
   Exposed as a singleton on the global window scope via the
   returned public API object at the bottom of the IIFE.
   ============================================================ */
const MemeEngine = (() => {

    /* ----------------------------------------------------------
       INTERNAL STATE
       canvas   — reference to the <canvas id="main-canvas"> element
       ctx      — 2D rendering context obtained from canvas
       wrapper  — the parent container used for width calculations
       dpr      — device pixel ratio for HiDPI (Retina) rendering
       state    — mutable application state object
    ---------------------------------------------------------- */
    let canvas, ctx, wrapper;

    /** Device pixel ratio — ensures crisp rendering on HiDPI screens */
    const dpr = window.devicePixelRatio || 1;

    /**
     * state
     * Central mutable object that represents the complete editor state.
     *
     * @property {Image|null}   baseImage     — The background image loaded from file / template
     * @property {Array}        layers        — Ordered array of text/sticker layer objects
     * @property {number}       selectedIndex — Index of the currently active layer (-1 = none)
     * @property {Array}        history       — JSON snapshot stack for undo/redo (max 30 entries)
     * @property {number}       historyIndex  — Current position in the history stack
     * @property {number}       zoom          — Reserved for future pinch-to-zoom (unused in v3)
     * @property {boolean}      isDragging    — True while the user is actively dragging a layer
     * @property {Object|null}  dragTarget    — Reserved; actual drag uses selectedIndex
     * @property {Object}       dragStart     — Fractional {x,y} offset from layer origin to pointer
     * @property {number}       canvasScale   — Ratio of canvas display width to the 1000px
     *                                           reference coordinate space used for font sizing
     * @property {Object}       filters       — CSS filter values: bright / contrast / saturate
     */
    let state = {
        baseImage     : null,
        layers        : [],
        selectedIndex : -1,
        history       : [],
        historyIndex  : -1,
        zoom          : 1,
        isDragging    : false,
        dragTarget    : null,
        dragStart     : { x: 0, y: 0 },
        canvasScale   : 1,
        filters       : { bright: 100, contrast: 100, saturate: 100 }
    };

    /**
     * templates
     * Static list of built-in meme template images.
     * Each entry has a display name and a path relative to the project root.
     * These are rendered as thumbnail cards in the template picker modal.
     */
    const templates = [
        { name: "Drake",          url: "../../assets/tools/img/img-meme-generator/img/templates/drake.webp"          },
        { name: "Distracted BF",  url: "../../assets/tools/img/img-meme-generator/img/templates/distracted-bf.webp"  },
        { name: "Two Buttons",    url: "../../assets/tools/img/img-meme-generator/img/templates/two-buttons.webp"    },
        { name: "Change Mind",    url: "../../assets/tools/img/img-meme-generator/img/templates/change-mind.webp"    },
        { name: "Think Mark",     url: "../../assets/tools/img/img-meme-generator/img/templates/think-mark.webp"     },
        { name: "Batman Slap",    url: "../../assets/tools/img/img-meme-generator/img/templates/batman-slap.webp"    }
    ];


    /* ----------------------------------------------------------
       INITIALISATION
    ---------------------------------------------------------- */

    /**
     * init()
     * Entry point called on DOMContentLoaded.
     * Safely resolves all required DOM elements, creates the 2D
     * rendering context, and wires up all event listeners.
     * Exits gracefully with a console error if critical elements
     * are missing from the DOM.
     */
    const init = () => {
        canvas  = document.getElementById('main-canvas');
        wrapper = document.getElementById('canvas-wrapper');

        if (!canvas || !wrapper) {
            console.error("MemeEngine Error: Required DOM elements (main-canvas, canvas-wrapper) are missing.");
            return;
        }

        /*
         * willReadFrequently: true — hints to the browser that pixel
         * data will be read back often (used in filter calculations),
         * which can improve performance on some GPU back-ends.
         * alpha: false — disables the canvas alpha channel; the base
         * image always fills the entire canvas so transparency is unused
         * and this gives a minor compositing performance boost.
         */
        ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

        setupListeners();
        UISystem.init();
    };


    /* ----------------------------------------------------------
       UTILITY
    ---------------------------------------------------------- */

    /**
     * safeAddListener(id, event, handler)
     * Resolves a DOM element by ID and attaches an event listener only
     * if the element exists. Prevents null-reference errors when optional
     * elements are absent from the page.
     *
     * @param {string}   id      — The target element's id attribute
     * @param {string}   event   — DOM event name (e.g. 'change', 'input')
     * @param {Function} handler — The callback to attach
     */
    const safeAddListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };


    /* ----------------------------------------------------------
       EVENT LISTENER SETUP
    ---------------------------------------------------------- */

    /**
     * setupListeners()
     * Wires up all interactive event listeners for:
     *   • File upload inputs (image + sticker)
     *   • Canvas mouse interactions (mousedown / mousemove / mouseup)
     *   • Mobile touch support (touchstart / touchmove / touchend)
     *   • Keyboard shortcuts (Delete, Ctrl+Z, Ctrl+Y, Ctrl+D)
     *   • Image filter range sliders (brightness / contrast / saturation)
     */
    const setupListeners = () => {

        /* ── File upload inputs ── */
        safeAddListener('upload-input',  'change', e => handleMainUpload(e.target.files[0]));
        safeAddListener('sticker-input', 'change', e => handleStickerUpload(e.target.files[0]));

        /* ── Canvas mouse interaction ── */
        canvas.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('mousemove',  handlePointerMove);
        window.addEventListener('mouseup',    handlePointerUp);

        /*
         * Mobile touch support.
         * passive: false on touchstart/touchmove allows e.preventDefault()
         * inside handlePointerMove, which stops the page from scrolling
         * while the user drags a layer on a touch device.
         */
        canvas.addEventListener('touchstart',
            e => handlePointerDown(e.touches[0]),
            { passive: false }
        );
        window.addEventListener('touchmove', e => {
            if (state.isDragging) e.preventDefault(); // prevent page scroll while dragging
            handlePointerMove(e.touches[0]);
        }, { passive: false });
        window.addEventListener('touchend', handlePointerUp);

        /* ── Keyboard shortcuts ── */
        window.addEventListener('keydown', e => {
            // Ignore shortcuts when the user is typing inside an input or textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Delete' || e.key === 'Backspace') deleteLayer();
            if (e.ctrlKey && e.key === 'z') undo();
            if (e.ctrlKey && e.key === 'y') redo();
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault(); // prevent browser bookmark dialog
                duplicate();
            }
        });

        /*
         * Image filter sliders — Brightness, Contrast, Saturation.
         * Each slider shares the same handler pattern:
         *   1. Extract the CSS property name from the element id suffix.
         *   2. Update state.filters with the new integer value.
         *   3. Update the live percentage readout span.
         *   4. Re-render the canvas to show the filter change immediately.
         */
        ['f-bright', 'f-contrast', 'f-saturate'].forEach(id => {
            safeAddListener(id, 'input', e => {
                const prop = id.split('-')[1]; // 'bright' | 'contrast' | 'saturate'
                state.filters[prop] = e.target.value;
                const valDisplay = document.getElementById(`val-${prop}`);
                if (valDisplay) valDisplay.innerText = e.target.value + '%';
                render();
            });
        });
    };


    /* ----------------------------------------------------------
       FILE UPLOAD HANDLERS
    ---------------------------------------------------------- */

    /**
     * handleMainUpload(file)
     * Reads a user-selected image file using FileReader, creates an
     * HTMLImageElement from the data URL, then passes it to startWithImage()
     * to initialise the canvas workspace.
     *
     * @param {File} file — The File object from the upload input change event
     */
    const handleMainUpload = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => startWithImage(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    /**
     * handleStickerUpload(file)
     * Reads a user-selected sticker/overlay image file using FileReader
     * and passes both the Image element and its data URL to addSticker().
     * The data URL is stored on the layer so it can be re-loaded during
     * undo/redo snapshot restoration.
     *
     * @param {File} file — The File object from the sticker input change event
     */
    const handleStickerUpload = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => addSticker(img, e.target.result);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };


    /* ----------------------------------------------------------
       CANVAS INITIALISATION
    ---------------------------------------------------------- */

    /**
     * startWithImage(img)
     * Resets the entire editor state, resizes the canvas to match the
     * image's aspect ratio while fitting within the wrapper width, adds
     * default "TOP TEXT" and "BOTTOM TEXT" layers, and triggers the
     * first render pass.
     *
     * The canvas is sized in CSS pixels using canvas.style, while the
     * underlying pixel buffer is multiplied by dpr for HiDPI clarity.
     * All coordinate calculations throughout the engine use CSS pixels
     * (divided by dpr) to keep the maths consistent.
     *
     * @param {HTMLImageElement} img — The fully loaded image to use as background
     */
    const startWithImage = (img) => {
        state.baseImage    = img;
        state.layers       = [];
        state.history      = [];
        state.historyIndex = -1;

        /* Calculate display dimensions: constrain to wrapper width */
        const wrapW   = wrapper.clientWidth - 40;
        const aspect  = img.width / img.height;
        const displayW = Math.min(wrapW, img.width);
        const displayH = displayW / aspect;

        /* Set the physical pixel buffer (HiDPI) */
        canvas.width  = displayW * dpr;
        canvas.height = displayH * dpr;

        /* Set the CSS display size */
        canvas.style.width  = displayW + 'px';
        canvas.style.height = displayH + 'px';

        /*
         * canvasScale maps the display width to the 1000px reference space.
         * Text layer sizes are authored relative to 1000px so they remain
         * visually proportional across different canvas display widths.
         */
        state.canvasScale = displayW / 1000;

        /* Switch from empty-state placeholder to the live canvas */
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.classList.add('hidden');
        canvas.classList.remove('hidden');

        /* Add default text layers at top and bottom */
        addText("TOP TEXT",    0.1);
        addText("BOTTOM TEXT", 0.85);

        saveHistory();
        render();
    };

    /**
     * startBlank()
     * Creates a 1000×1000 white canvas as the base image, then passes it
     * through startWithImage() to allow the user to build a meme from scratch
     * without needing to upload an image first.
     */
    const startBlank = () => {
        const dummy = document.createElement('canvas');
        dummy.width = 1000;
        dummy.height = 1000;
        const dCtx = dummy.getContext('2d');
        dCtx.fillStyle = '#ffffff';
        dCtx.fillRect(0, 0, 1000, 1000);

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => startWithImage(img);
        img.src = dummy.toDataURL();
    };


    /* ----------------------------------------------------------
       LAYER CREATION
    ---------------------------------------------------------- */

    /**
     * addText(txt, yPos)
     * Creates a new text layer object and appends it to state.layers.
     * Positions are stored as fractional values (0–1) relative to the
     * canvas dimensions so they scale correctly across different sizes.
     *
     * Layer schema:
     *   type     — 'text'
     *   text     — The display string (may contain \n for multi-line)
     *   x, y     — Fractional position (0–1) within the canvas
     *   size     — Reference font size (scaled at render time)
     *   font     — Font family name (must be loaded via @font-face / Google Fonts)
     *   color    — Fill colour hex string
     *   stroke   — Outline colour hex string
     *   opacity  — Layer opacity (0–1)
     *   rotation — Rotation angle in degrees
     *
     * @param {string} txt  — Initial text content   (default: "EDIT ME")
     * @param {number} yPos — Vertical position 0–1  (default: 0.5 centre)
     */
    const addText = (txt = "EDIT ME", yPos = 0.5) => {
        state.layers.push({
            type     : 'text',
            text     : txt,
            x        : 0.5,
            y        : yPos,
            size     : 60,
            font     : 'Impact',
            color    : '#ffffff',
            stroke   : '#000000',
            opacity  : 1,
            rotation : 0
        });
        selectLayer(state.layers.length - 1);
        render();
    };

    /**
     * addSticker(img, src)
     * Creates a new sticker (image overlay) layer and appends it to
     * state.layers. The src data URL is stored alongside the Image element
     * so that undo/redo snapshot restoration can reload the image asynchronously.
     *
     * Layer schema (additional to text):
     *   img    — Live HTMLImageElement reference (excluded from JSON snapshots)
     *   src    — Data URL of the sticker (included in JSON snapshots for reload)
     *   size   — Reference display width in the 1000px coordinate space
     *   aspect — Natural width/height ratio to maintain correct proportions
     *
     * @param {HTMLImageElement} img — The loaded sticker image element
     * @param {string}           src — Base64 data URL of the sticker image
     */
    const addSticker = (img, src) => {
        state.layers.push({
            type    : 'sticker',
            img     : img,
            src     : src,
            x       : 0.5,
            y       : 0.5,
            size    : 200,
            opacity : 1,
            rotation: 0,
            aspect  : img.width / img.height
        });
        selectLayer(state.layers.length - 1);
        saveHistory();
        render();
    };


    /* ----------------------------------------------------------
       CANVAS RENDERING
    ---------------------------------------------------------- */

    /**
     * render()
     * Full canvas redraw. Called after every state change that affects
     * the visual output (layer move, text edit, filter change, etc.).
     *
     * Render order:
     *   1. Clear the canvas.
     *   2. Save context, apply dpr scale.
     *   3. Draw the base image with CSS filter string applied.
     *   4. Iterate layers in order — draw each text or sticker.
     *   5. If a layer is selected, draw a dashed bounding-box highlight.
     *   6. Restore context.
     *   7. Trigger UISystem.updateLayerList() to keep the layer panel in sync.
     */
    const render = () => {
        if (!state.baseImage || !ctx) return;

        const w = canvas.width  / dpr;
        const h = canvas.height / dpr;

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.scale(dpr, dpr);

        /* Draw base image with current filter values */
        ctx.filter = `brightness(${state.filters.bright}%) contrast(${state.filters.contrast}%) saturate(${state.filters.saturate}%)`;
        ctx.drawImage(state.baseImage, 0, 0, w, h);
        ctx.filter = 'none';

        /* Draw each layer in array order (index 0 = bottom, last index = top) */
        state.layers.forEach((layer, idx) => {
            ctx.save();
            ctx.globalAlpha = layer.opacity;

            /* Translate to the layer's fractional position, then rotate */
            ctx.translate(layer.x * w, layer.y * h);
            ctx.rotate(layer.rotation * Math.PI / 180);

            if (layer.type === 'text') {
                /*
                 * Font size calculation:
                 *   layer.size         — reference size in the 1000px coordinate space
                 *   state.canvasScale  — ratio of actual display width to 1000
                 *   × 2                — empirical multiplier that produces visually
                 *                        appropriate text weight for meme format
                 */
                const fs = layer.size * state.canvasScale * 2;
                ctx.font         = `900 ${fs}px "${layer.font}"`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineJoin     = 'round';
                ctx.miterLimit   = 2;
                ctx.lineWidth    = fs * 0.12; // stroke width is 12% of font size
                ctx.strokeStyle  = layer.stroke;
                ctx.fillStyle    = layer.color;

                /* Multi-line text support — split on newline characters */
                const lines  = layer.text.split('\n');
                const lh     = fs * 1.1;           // line height = 110% of font size
                const totalH = lines.length * lh;

                lines.forEach((line, i) => {
                    /* Centre the block of lines vertically around the origin */
                    const py = (i * lh) - (totalH / 2) + (lh / 2);
                    ctx.strokeText(line, 0, py); // draw outline first (behind fill)
                    ctx.fillText(line, 0, py);   // then draw fill on top
                });

            } else {
                /* Sticker layer: draw image centred on the translated origin */
                const sw = layer.size * state.canvasScale * 2;
                const sh = sw / layer.aspect; // maintain natural aspect ratio
                ctx.drawImage(layer.img, -sw / 2, -sh / 2, sw, sh);
            }

            /* Selection highlight: dashed bounding-box for the active layer */
            if (idx === state.selectedIndex) {
                ctx.strokeStyle = '#ff0055';
                ctx.lineWidth   = 2;
                ctx.setLineDash([5, 5]);
                const bounds = getLayerBounds(layer, w, h);
                ctx.strokeRect(
                    -bounds.w / 2 - 5,
                    -bounds.h / 2 - 5,
                     bounds.w + 10,
                     bounds.h + 10
                );
            }

            ctx.restore();
        });

        ctx.restore();

        /* Keep the layer panel list in sync after every render */
        UISystem.updateLayerList();
    };

    /**
     * getLayerBounds(layer, w, h)
     * Calculates the approximate bounding-box dimensions of a layer in
     * canvas pixel space. Used for:
     *   • Drawing the selection highlight rectangle.
     *   • Hit-testing during pointer-down to determine which layer was clicked.
     *
     * For text layers, measureText() provides the width; height is estimated
     * from line count × line height.
     * For sticker layers, width and height are derived from the size/aspect.
     *
     * @param {Object} layer — The layer object from state.layers
     * @param {number} w     — Canvas display width in CSS pixels
     * @param {number} h     — Canvas display height in CSS pixels  (unused but kept for API symmetry)
     * @returns {{ w: number, h: number }}
     */
    const getLayerBounds = (layer, w, h) => {
        if (layer.type === 'text') {
            const fs    = layer.size * state.canvasScale * 2;
            ctx.font    = `900 ${fs}px "${layer.font}"`;
            const lines = layer.text.split('\n');
            let maxW    = 0;
            lines.forEach(l => { maxW = Math.max(maxW, ctx.measureText(l).width); });
            return { w: maxW, h: lines.length * fs * 1.1 };
        } else {
            const sw = layer.size * state.canvasScale * 2;
            return { w: sw, h: sw / layer.aspect };
        }
    };


    /* ----------------------------------------------------------
       POINTER / TOUCH INTERACTION
    ---------------------------------------------------------- */

    /**
     * handlePointerDown(e)
     * Handles both mousedown and touchstart events on the canvas.
     * Converts the pointer position to fractional canvas coordinates,
     * then performs a reverse-order hit-test across all layers to find
     * the topmost layer under the pointer.
     * If a layer is hit: selects it and begins a drag operation.
     * If no layer is hit: deselects the current layer.
     *
     * @param {MouseEvent|Touch} e — Normalised event / touch object
     */
    const handlePointerDown = (e) => {
        if (!state.baseImage) return;

        const rect = canvas.getBoundingClientRect();
        const px   = (e.clientX - rect.left)  / rect.width;   // fractional x (0–1)
        const py   = (e.clientY - rect.top)   / rect.height;  // fractional y (0–1)

        let hitFound = -1;

        /* Iterate in reverse so the topmost (last-drawn) layer is tested first */
        for (let i = state.layers.length - 1; i >= 0; i--) {
            const l      = state.layers[i];
            const bounds = getLayerBounds(l, canvas.width / dpr, canvas.height / dpr);

            /* Convert fractional delta to canvas pixels for comparison */
            const dx = Math.abs(px - l.x) * (canvas.width  / dpr);
            const dy = Math.abs(py - l.y) * (canvas.height / dpr);

            /* 10px padding around the bounding box increases ease of selection */
            if (dx < bounds.w / 2 + 10 && dy < bounds.h / 2 + 10) {
                hitFound = i;
                break;
            }
        }

        if (hitFound !== -1) {
            selectLayer(hitFound);
            state.isDragging = true;
            /* Record the offset from the layer's origin to the click point */
            state.dragStart = {
                x: px - state.layers[hitFound].x,
                y: py - state.layers[hitFound].y
            };
        } else {
            selectLayer(-1); // click on empty canvas deselects
        }

        render();
    };

    /**
     * handlePointerMove(e)
     * Handles both mousemove and touchmove events on the window.
     * Only acts when state.isDragging is true (a layer drag is in progress).
     * Updates the selected layer's fractional x/y position and re-renders.
     *
     * @param {MouseEvent|Touch} e — Normalised event / touch object
     */
    const handlePointerMove = (e) => {
        if (!state.isDragging || state.selectedIndex === -1) return;

        const rect = canvas.getBoundingClientRect();
        const px   = (e.clientX - rect.left)  / rect.width;
        const py   = (e.clientY - rect.top)   / rect.height;

        const l = state.layers[state.selectedIndex];
        /* Subtract the stored drag offset so the layer doesn't "jump" to the pointer */
        l.x = px - state.dragStart.x;
        l.y = py - state.dragStart.y;

        render();
    };

    /**
     * handlePointerUp()
     * Fires on mouseup and touchend.
     * Ends the drag operation and saves a history snapshot so the
     * final position of the drag is undoable.
     */
    const handlePointerUp = () => {
        if (state.isDragging) {
            state.isDragging = false;
            saveHistory(); // commit drag end position to history
        }
    };


    /* ----------------------------------------------------------
       LAYER SELECTION & MANIPULATION
    ---------------------------------------------------------- */

    /**
     * selectLayer(idx)
     * Sets state.selectedIndex to the specified layer index and
     * triggers UISystem.syncControls() to update the Design tab
     * controls to reflect the newly selected layer's properties.
     *
     * Pass idx = -1 to deselect all layers.
     *
     * @param {number} idx — Index in state.layers, or -1 to deselect
     */
    const selectLayer = (idx) => {
        state.selectedIndex = idx;
        UISystem.syncControls();
    };

    /**
     * deleteLayer()
     * Removes the currently selected layer from state.layers, deselects,
     * saves a history snapshot, and re-renders the canvas.
     * Does nothing if no layer is selected (selectedIndex === -1).
     */
    const deleteLayer = () => {
        if (state.selectedIndex === -1) return;
        state.layers.splice(state.selectedIndex, 1);
        selectLayer(-1);
        saveHistory();
        render();
    };

    /**
     * duplicate()
     * Creates a shallow copy of the currently selected layer, offsets it
     * by (0.05, 0.05) in fractional coordinates so the duplicate is
     * visibly separate, appends it to state.layers, selects it, and renders.
     * Does nothing if no layer is selected.
     */
    const duplicate = () => {
        if (state.selectedIndex === -1) return;
        const copy = { ...state.layers[state.selectedIndex] };
        copy.x += 0.05;
        copy.y += 0.05;
        state.layers.push(copy);
        selectLayer(state.layers.length - 1);
        saveHistory();
        render();
    };

    /**
     * reorder(dir)
     * Moves the selected layer one position up or down in the stack.
     * 'up'   → brings the layer forward (renders on top of the next layer)
     * 'down' → sends the layer backward (renders beneath the previous layer)
     * Guards against out-of-bounds swaps.
     *
     * @param {'up'|'down'} dir — Direction to move the layer in the stack
     */
    const reorder = (dir) => {
        if (state.selectedIndex === -1) return;
        const i = state.selectedIndex;

        if (dir === 'up' && i < state.layers.length - 1) {
            /* Swap with the layer above */
            [state.layers[i], state.layers[i + 1]] = [state.layers[i + 1], state.layers[i]];
            selectLayer(i + 1);
        } else if (dir === 'down' && i > 0) {
            /* Swap with the layer below */
            [state.layers[i], state.layers[i - 1]] = [state.layers[i - 1], state.layers[i]];
            selectLayer(i - 1);
        }

        saveHistory();
        render();
    };


    /* ----------------------------------------------------------
       UNDO / REDO HISTORY
    ---------------------------------------------------------- */

    /**
     * saveHistory()
     * Captures a JSON snapshot of the current layers array (excluding the
     * non-serialisable .img property on sticker layers) and pushes it onto
     * the history stack.
     *
     * If the user has undone actions and then makes a new edit, all "future"
     * history beyond the current index is discarded before the new snapshot
     * is appended (standard linear undo model).
     *
     * The history stack is capped at 30 entries. If the cap is exceeded the
     * oldest entry is removed with shift().
     */
    const saveHistory = () => {
        /* Serialise layers, stripping the non-serialisable Image reference */
        const snap = JSON.stringify(state.layers.map(l => {
            const c = { ...l };
            delete c.img; // HTMLImageElement cannot be JSON-serialised
            return c;
        }));

        /* Truncate any redo history when a new action is taken */
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }

        state.history.push(snap);

        /* Keep the stack at a maximum of 30 entries */
        if (state.history.length > 30) state.history.shift();

        state.historyIndex = state.history.length - 1;
    };

    /**
     * undo()
     * Steps back one position in the history stack and applies the snapshot
     * at the new index. Does nothing if already at the oldest snapshot.
     */
    const undo = () => {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            applySnapshot(state.history[state.historyIndex]);
        }
    };

    /**
     * redo()
     * Steps forward one position in the history stack and applies the
     * snapshot at the new index. Does nothing if already at the newest snapshot.
     */
    const redo = () => {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            applySnapshot(state.history[state.historyIndex]);
        }
    };

    /**
     * applySnapshot(json)
     * Deserialises a JSON history snapshot back into state.layers.
     * For sticker layers, the .img HTMLImageElement must be reconstructed
     * asynchronously from the stored .src data URL.
     * Uses Promise.all() to wait for all sticker images to load before
     * reassigning state.layers and triggering a re-render.
     *
     * @param {string} json — JSON string produced by saveHistory()
     */
    const applySnapshot = (json) => {
        const data = JSON.parse(json);

        /* For each layer, create a Promise that resolves when the layer is ready */
        const loaders = data.map(l => new Promise(res => {
            if (l.type === 'sticker') {
                /* Reload the Image element from the stored data URL */
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => { l.img = img; res(l); };
                img.src = l.src;
            } else {
                /* Text layers carry no Image reference — resolve immediately */
                res(l);
            }
        }));

        /* Reassign layers and render only when all images have fully loaded */
        Promise.all(loaders).then(restored => {
            state.layers = restored;
            render();
        });
    };


    /* ----------------------------------------------------------
       HD EXPORT PIPELINE
    ---------------------------------------------------------- */

    /**
     * exportMeme()
     * Renders a full-resolution version of the meme onto a temporary
     * off-screen canvas and triggers a browser file download.
     *
     * Export resolution: max(naturalWidth of base image, 2000px).
     * Using naturalWidth ensures we never upscale beyond the original
     * image resolution. The 2000px floor ensures a minimum HD output.
     *
     * Steps:
     *   1. Show the loader overlay.
     *   2. Create an off-screen canvas at export resolution.
     *   3. Apply image filters to the base image draw call.
     *   4. Draw each layer scaled to the export coordinate space.
     *   5. Convert to the selected format (JPEG/PNG/WebP) via toDataURL().
     *   6. Trigger download via a temporary <a> element.
     *   7. Hide the loader overlay after a short delay.
     */
    const exportMeme = () => {
        /* Show the loading overlay while the export renders */
        const loader = document.getElementById('canvas-loader');
        if (loader) loader.classList.remove('hidden');

        /* Create an off-screen canvas at full / HD resolution */
        const exportCanvas = document.createElement('canvas');
        const eCtx         = exportCanvas.getContext('2d');
        const exportW      = Math.max(state.baseImage.naturalWidth, 2000);
        const exportH      = exportW * (state.baseImage.naturalHeight / state.baseImage.naturalWidth);

        exportCanvas.width  = exportW;
        exportCanvas.height = exportH;

        /* Draw the base image with filter pipeline at full resolution */
        eCtx.filter = `brightness(${state.filters.bright}%) contrast(${state.filters.contrast}%) saturate(${state.filters.saturate}%)`;
        eCtx.drawImage(state.baseImage, 0, 0, exportW, exportH);
        eCtx.filter = 'none';

        /*
         * Draw each layer at the export resolution.
         * The scale factor maps the 1000px reference space to the export canvas width.
         */
        state.layers.forEach(l => {
            eCtx.save();
            eCtx.globalAlpha = l.opacity;
            eCtx.translate(l.x * exportW, l.y * exportH);
            eCtx.rotate(l.rotation * Math.PI / 180);

            const scale = exportW / 1000; // export coordinate scale factor

            if (l.type === 'text') {
                const fs = l.size * scale * 2;
                eCtx.font         = `900 ${fs}px "${l.font}"`;
                eCtx.textAlign    = 'center';
                eCtx.textBaseline = 'middle';
                eCtx.lineJoin     = 'round';
                eCtx.lineWidth    = fs * 0.12;
                eCtx.strokeStyle  = l.stroke;
                eCtx.fillStyle    = l.color;

                const lines = l.text.split('\n');
                const lh    = fs * 1.1;

                lines.forEach((line, i) => {
                    const py = (i * lh) - ((lines.length * lh) / 2) + (lh / 2);
                    eCtx.strokeText(line, 0, py);
                    eCtx.fillText(line,   0, py);
                });
            } else {
                /* Sticker: maintain aspect ratio at export scale */
                const sw = l.size * scale * 2;
                const sh = sw / l.aspect;
                eCtx.drawImage(l.img, -sw / 2, -sh / 2, sw, sh);
            }

            eCtx.restore();
        });

        /* Read the selected export format from the dropdown */
        const formatElement = document.getElementById('export-format');
        const format        = formatElement ? formatElement.value : 'image/png';

        /* Trigger file download via a temporary anchor element */
        const link      = document.createElement('a');
        link.download   = `Meme_${Date.now()}.${format.split('/')[1]}`;
        link.href       = exportCanvas.toDataURL(format, 0.95); // 0.95 = 95% quality for JPEG
        link.click();

        /* Hide the loader after a short delay to confirm the download started */
        if (loader) setTimeout(() => loader.classList.add('hidden'), 500);
    };

    /**
     * copyToClipboard()
     * Converts the current canvas to a PNG Blob and writes it to the
     * system clipboard using the Clipboard API (ClipboardItem).
     * Shows a success toast on completion via the global toast system.
     *
     * Note: This API requires HTTPS and a browser that supports ClipboardItem
     * (Chrome 86+, Edge 86+). Safari requires special handling not yet included.
     */
    const copyToClipboard = () => {
        if (!canvas) return;

        canvas.toBlob(blob => {
            const item = new ClipboardItem({ "image/png": blob });

            navigator.clipboard.write([item])
                .then(() => {
                    /* Notify the user via the global toast notification system */
                    window.showToast("Meme copied to clipboard!");
                })
                .catch(() => {
                    /* Clipboard API failure — likely non-HTTPS or unsupported browser */
                    window.showToast("Could not copy to clipboard. Try saving instead.", true);
                });
        });
    };


    /* ----------------------------------------------------------
       PUBLIC API
       Only the methods and properties listed here are accessible
       from outside the IIFE (i.e. from inline onclick attributes
       in the HTML, UISystem, and TemplateSystem).
    ---------------------------------------------------------- */
    return {
        init,
        state,
        addText,
        deleteLayer,
        reorder,
        duplicate,
        undo,
        redo,
        export       : exportMeme,    // 'export' is a reserved word; aliased here
        startBlank,
        startWithImage,
        templates,
        copyToClipboard,
        render,
        saveHistory,
        selectLayer
    };

})();


/* ============================================================
   MODULE 2: UISystem
   Manages all DOM interactions for the control sidebar:
     • Binding layer property inputs to the active layer state
     • Switching between the three sidebar tab panels
     • Re-rendering the layer list in the Layers tab
     • Synchronising Design tab controls with the selected layer
   ============================================================ */
const UISystem = (() => {

    /**
     * init()
     * Binds all sidebar input controls to their corresponding layer
     * properties using the internal bind() helper.
     * Called once by MemeEngine.init() after the canvas is ready.
     */
    const init = () => {

        /**
         * bind(id, prop, event)
         * Attaches a live input listener to a DOM element identified by id.
         * On every event (default: 'input' for immediate feedback):
         *   1. Resolve the active layer from MemeEngine state.
         *   2. Update the layer's [prop] value from the input element.
         *      Range inputs are parsed as floats; all others use raw string value.
         *   3. Call MemeEngine.render() to immediately reflect the change.
         *   4. For 'change' events (e.g. select boxes), save a history snapshot.
         *
         * @param {string} id    — DOM element id attribute
         * @param {string} prop  — The layer property key to update (e.g. 'text', 'size')
         * @param {string} event — DOM event name to listen for (default: 'input')
         */
        const bind = (id, prop, event = 'input') => {
            const el = document.getElementById(id);
            if (!el) return;

            el.addEventListener(event, e => {
                if (MemeEngine.state.selectedIndex === -1) return; // no layer selected
                const layer = MemeEngine.state.layers[MemeEngine.state.selectedIndex];
                /* Parse range inputs as floats; all other inputs use their string value */
                layer[prop] = (e.target.type === 'range') ? parseFloat(e.target.value) : e.target.value;
                MemeEngine.render();
                /* Commit a history entry after discrete changes (select / color) */
                if (event === 'change') MemeEngine.saveHistory();
            });
        };

        /* ── Text layer property bindings ── */
        bind('edit-text',     'text');              // text content (textarea — live)
        bind('edit-font',     'font',    'change'); // font family  (select — on change)
        bind('edit-color',    'color');             // fill colour  (color input — live)
        bind('edit-stroke',   'stroke');            // outline      (color input — live)

        /* ── Shared layer property bindings (text + sticker) ── */
        bind('edit-size',     'size',    'change'); // scale / size (range — on change)
        bind('edit-opacity',  'opacity');           // opacity      (range — live)
        bind('edit-rotation', 'rotation');          // rotation     (range — live)
    };

    /**
     * switchTab(idx)
     * Activates the sidebar tab panel at the given index by toggling the
     * 'active' class on both .mg-panel-tab buttons and .mg-panel-content panels.
     * All other tabs/panels are deactivated simultaneously.
     *
     * @param {number} idx — Zero-based index of the tab to activate (0=Layers, 1=Design, 2=Effects)
     */
    const switchTab = (idx) => {
        document.querySelectorAll('.mg-panel-tab').forEach((t, i) => {
            t.classList.toggle('active', i === idx);
        });
        document.querySelectorAll('.mg-panel-content').forEach((p, i) => {
            p.classList.toggle('active', i === idx);
        });
    };

    /**
     * updateLayerList()
     * Rebuilds the layer list HTML inside #layer-list to reflect the
     * current state.layers array. Called at the end of every render() cycle.
     *
     * If no layers exist, a placeholder message is shown.
     * Otherwise, layer items are created in reverse order (topmost layer
     * at the top of the UI list — mirrors design-app conventions).
     * Clicking a list item calls MemeEngine.selectLayer() and re-renders.
     *
     * NOTE: The injected element uses class="layer-item" (with optional
     * .selected modifier) which maps to the CSS defined in Section 40-H.
     */
    const updateLayerList = () => {
        const list = document.getElementById('layer-list');
        if (!list) return;

        if (MemeEngine.state.layers.length === 0) {
            list.innerHTML = '<div class="mg-layer-empty-msg">No active layers</div>';
            return;
        }

        list.innerHTML = '';

        MemeEngine.state.layers.forEach((l, i) => {
            const item      = document.createElement('div');
            const isActive  = i === MemeEngine.state.selectedIndex;

            /* Apply selected modifier when this is the currently active layer */
            item.className  = `layer-item${isActive ? ' selected' : ''}`;

            item.innerHTML  = `
                <span>
                    <i class="fa-solid ${l.type === 'text' ? 'fa-font' : 'fa-image'}"></i>
                    ${l.text ? l.text.substring(0, 12) : 'Sticker'}
                </span>
                <i class="fa-solid fa-eye" style="opacity: 0.5;"></i>
            `;

            item.onclick = () => {
                MemeEngine.selectLayer(i);
                MemeEngine.render();
            };

            /* prepend so the topmost layer (highest index) appears at the top of the list */
            list.prepend(item);
        });
    };

    /**
     * syncControls()
     * Updates the Design tab inputs to reflect the properties of the
     * currently selected layer. Called whenever selectLayer() is invoked.
     *
     * If no layer is selected:
     *   • Hides #design-controls
     *   • Shows #no-selection-msg
     *
     * If a layer is selected:
     *   • Shows #design-controls
     *   • Hides #no-selection-msg
     *   • Populates each input with the layer's current property values
     *   • Shows/hides #text-fields based on layer type (text vs sticker)
     */
    const syncControls = () => {
        const idx   = MemeEngine.state.selectedIndex;
        const panel = document.getElementById('design-controls');
        const empty = document.getElementById('no-selection-msg');

        if (!panel || !empty) return;

        if (idx === -1) {
            /* No selection — hide property controls, show placeholder message */
            panel.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        /* A layer is selected — show controls, hide placeholder */
        panel.classList.remove('hidden');
        empty.classList.add('hidden');

        const l          = MemeEngine.state.layers[idx];
        const textFields = document.getElementById('text-fields');

        /* Hide text-specific fields for sticker layers */
        if (textFields) textFields.classList.toggle('hidden', l.type !== 'text');

        /**
         * safeSetValue(id, value)
         * Sets the .value of a DOM element by id if the element exists.
         * Prevents null-reference errors for optional controls.
         *
         * @param {string} id    — Target element id
         * @param {*}      value — Value to assign
         */
        const safeSetValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        /* Populate text-only controls */
        if (l.type === 'text') {
            safeSetValue('edit-text',   l.text);
            safeSetValue('edit-font',   l.font);
            safeSetValue('edit-color',  l.color);
            safeSetValue('edit-stroke', l.stroke);
        }

        /* Populate shared controls (text + sticker) */
        safeSetValue('edit-size',     l.size);
        safeSetValue('edit-opacity',  l.opacity);
        safeSetValue('edit-rotation', l.rotation);
    };

    /* ── Public API ── */
    return { init, switchTab, updateLayerList, syncControls };

})();


/* ============================================================
   MODULE 3: TemplateSystem
   Manages the built-in template picker modal.
   Dynamically generates thumbnail cards from MemeEngine.templates
   and handles open / close modal visibility.
   ============================================================ */
const TemplateSystem = (() => {

    /**
     * open()
     * Populates the #template-grid element with thumbnail cards generated
     * from the MemeEngine.templates array, then makes the modal visible
     * by setting its display style to 'block'.
     *
     * Each thumbnail card is assigned class="template-card" (styled in
     * Section 40-M of tools-template.css). Clicking a card:
     *   1. Creates a new Image element.
     *   2. On load, calls MemeEngine.startWithImage() to initialise the canvas.
     *   3. Closes the modal via close().
     */
    const open = () => {
        const grid = document.getElementById('template-grid');
        if (!grid) return;

        grid.innerHTML = '';

        MemeEngine.templates.forEach(t => {
            const card      = document.createElement('div');
            card.className  = 'template-card';

            card.innerHTML  = `
                <img src="${t.url}" alt="${t.name}" loading="lazy">
                <p>${t.name}</p>
            `;

            card.onclick = () => {
                const img       = new Image();
                img.crossOrigin = "anonymous";
                img.onload      = () => { MemeEngine.startWithImage(img); close(); };
                img.src         = t.url;
            };

            grid.appendChild(card);
        });

        /* Show the modal overlay */
        const modal = document.getElementById('template-modal');
        if (modal) modal.style.display = 'block';
    };

    /**
     * close()
     * Hides the template picker modal by setting its display style to 'none'.
     * Called when the user clicks the × close button or after a template
     * has been successfully loaded into the canvas.
     */
    const close = () => {
        const modal = document.getElementById('template-modal');
        if (modal) modal.style.display = 'none';
    };

    /* ── Public API ── */
    return { open, close };

})();


/* ============================================================
   BOOT
   Wait for the complete DOM to be parsed before running init()
   so all required element IDs (#main-canvas, #canvas-wrapper, etc.)
   are guaranteed to be present.
   ============================================================ */
document.addEventListener('DOMContentLoaded', MemeEngine.init);
