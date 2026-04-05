/**
 * ============================================================================
 *  3D Mockup STUDIO MAX — Core Application Script
 *  ─────────────────────────────────────────────────────────────────────────
 *  Tool    : img-3d-mockup
 *  Author  : MD KAWSAR
 *  Version : 1.0 (CodeCanyon Release Build)
 *
 *  Architecture Overview
 *  ─────────────────────────────────────────────────────────────────────────
 *  • 100% Client-Side. No server, no uploads, no data egress of any kind.
 *  • Three.js r128 WebGL rendering pipeline (loaded via CDN before this file).
 *  • Procedural device geometry — no external GLTF/OBJ files required.
 *  • FileReader API for in-memory screenshot loading (never leaves the tab).
 *  • Custom OrbitControls (mouse + multi-touch) — avoids addon import issues.
 *  • 4K PNG export via canvas.toDataURL() + temporary renderer resize trick.
 *
 *  Module Structure
 *  ─────────────────────────────────────────────────────────────────────────
 *  StudioApp (IIFE namespace)
 *    ├── state            — Central mutable state object
 *    ├── ThreeSetup       — Scene / camera / renderer / lights initialization
 *    ├── DeviceBuilder    — Procedural iPhone & MacBook geometry builders
 *    ├── SceneManager     — Device swap, background rendering, render loop
 *    ├── TextureManager   — FileReader → THREE.Texture → screen mesh mapping
 *    ├── OrbitControls    — Custom mouse + touch rotation and pinch-zoom
 *    ├── ExportEngine     — 4K PNG export via canvas.toDataURL()
 *    ├── UI               — DOM event binding and UI helpers
 *    └── Bootstrap        — Entry point: WebGL check → init sequence
 *
 *  Toast Notification Convention
 *  ─────────────────────────────────────────────────────────────────────────
 *  All toasts use the global window.showToast() function injected by global.js.
 *  Signature: window.showToast(message, isError)
 *    - isError = false (or omitted) → success/info toast
 *    - isError = true               → error toast (red)
 * ============================================================================
 */

'use strict';

/* ============================================================================
   MODULE: StudioApp
   Main IIFE namespace — keeps everything off the global scope.
   Returns a minimal public API for console debugging.
============================================================================ */
const StudioApp = (() => {

    // -------------------------------------------------------------------------
    // STATE
    // Central mutable state object shared across all internal modules.
    // All UI interactions read from / write to this single source of truth.
    // -------------------------------------------------------------------------
    const state = {
        device              : 'phone',          // Active device model: 'phone' | 'laptop'
        deviceColor         : '#1a1a2e',        // Hex string for the Claymorphism body color
        bgStyle             : 'glassmorphism',  // Active background: 'glassmorphism' | 'gradient' | 'solid' | 'dark' | 'mesh'
        gradColorA          : '#6c63ff',        // Gradient color stop A (used by gradient + mesh styles)
        gradColorB          : '#f093fb',        // Gradient color stop B (used by gradient + mesh styles)
        solidColor          : '#0f0f1a',        // Solid background color (used by 'solid' style)
        ambientIntensity    : 0.6,              // THREE.AmbientLight intensity (0–2)
        directionalIntensity: 1.2,              // THREE.DirectionalLight intensity (0–4)
        rimIntensity        : 0.4,              // Rim (back) light intensity (0–2)
        hasImage            : false,            // Whether a screenshot texture has been loaded
        isAutoRotating      : false,            // Whether the auto-spin animation is active
        isExporting         : false,            // Guard flag: prevents double-click during export
        userTexture         : null,             // THREE.Texture | null — the loaded screenshot texture
    };

    // -------------------------------------------------------------------------
    // THREE.JS CORE OBJECTS
    // Declared at module scope so every sub-module can access them directly.
    // -------------------------------------------------------------------------
    let scene, camera, renderer;
    let ambientLight, directionalLight, rimLight;
    let deviceGroup;        // THREE.Group — holds all meshes for the current device
    let screenMesh = null;  // Reference to the flat PlaneGeometry that receives the user's screenshot

    // -------------------------------------------------------------------------
    // ORBIT STATE
    // Custom OrbitControls state — tracks pointer position, rotation angles,
    // zoom factor, and pinch-to-zoom distance for multi-touch support.
    // -------------------------------------------------------------------------
    const orbit = {
        isPointerDown   : false,
        lastX           : 0,
        lastY           : 0,
        rotationX       : -0.15,    // Initial vertical tilt in radians (slight upward view)
        rotationY       : 0.45,     // Initial horizontal rotation in radians
        pinchDist       : 0,        // Starting distance between two touch points (for pinch zoom)
        zoomFactor      : 1.0,      // Current zoom multiplier (1.0 = default)
        minZoom         : 0.5,      // Maximum zoom-out limit
        maxZoom         : 2.2,      // Maximum zoom-in limit
    };

    // Canvas element — assigned during ThreeSetup.init()
    let canvas;


    /* ========================================================================
       MODULE: ThreeSetup
       Responsible for initializing the Three.js rendering pipeline:
       scene graph, perspective camera, WebGL renderer, and three-point lighting.
    ======================================================================== */
    const ThreeSetup = {

        /**
         * init()
         * ─────
         * Bootstraps the entire Three.js pipeline.
         * Must be called exactly once, after the DOM is fully ready.
         *
         * @returns {boolean} true if initialization succeeded, false on failure.
         */
        init() {
            // Locate the canvas element that Three.js will render into
            canvas = document.getElementById('mockupCanvas');
            if (!canvas) {
                console.error('[StudioApp] Fatal: Canvas element #mockupCanvas not found in DOM.');
                return false;
            }

            // ── SCENE ──
            // The root container for all 3D objects, lights, and cameras.
            scene = new THREE.Scene();

            // ── CAMERA ──
            // PerspectiveCamera(fov, aspect, near, far)
            // FOV of 40° gives a natural telephoto look (less distortion than wide-angle).
            camera = new THREE.PerspectiveCamera(
                40,                                         // Field of view in degrees
                canvas.clientWidth / canvas.clientHeight,   // Aspect ratio (corrected on resize)
                0.1,                                        // Near clipping plane
                1000                                        // Far clipping plane
            );
            camera.position.set(0, 0, 7); // Place camera 7 units in front of the device

            // ── RENDERER ──
            // antialias: true          → smooth device edges (no jagged stair-stepping)
            // alpha: true              → transparent clear color (background comes from scene.background)
            // preserveDrawingBuffer    → CRITICAL: allows canvas.toDataURL() for 4K export
            renderer = new THREE.WebGLRenderer({
                canvas,
                antialias               : true,
                alpha                   : true,
                preserveDrawingBuffer   : true
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2× for performance
            renderer.setSize(canvas.clientWidth, canvas.clientHeight);
            renderer.outputEncoding     = THREE.sRGBEncoding;         // Correct gamma for PBR materials
            renderer.toneMapping        = THREE.ACESFilmicToneMapping; // Cinematic tone curve
            renderer.toneMappingExposure= 1.1;                        // Slightly boosted exposure
            renderer.shadowMap.enabled  = true;
            renderer.shadowMap.type     = THREE.PCFSoftShadowMap;     // Soft-edge shadows

            // ── LIGHTS ──
            this.setupLights();

            return true;
        },

        /**
         * setupLights()
         * ─────────────
         * Creates a classic three-point lighting rig:
         *   1. Ambient  — uniform soft fill from all directions
         *   2. Key      — primary directional light that casts shadows
         *   3. Rim      — colored back-light that separates the device from the background
         *
         * All three lights can be adjusted via the UI sliders (state.ambientIntensity etc.).
         */
        setupLights() {
            // ── AMBIENT LIGHT ──
            // Provides a base level of illumination so no face is completely black.
            ambientLight = new THREE.AmbientLight(0xffffff, state.ambientIntensity);
            scene.add(ambientLight);

            // ── DIRECTIONAL (KEY) LIGHT ──
            // Main light source. Positioned upper-right-front. Casts shadows for depth.
            directionalLight = new THREE.DirectionalLight(0xffffff, state.directionalIntensity);
            directionalLight.position.set(4, 6, 5);
            directionalLight.castShadow             = true;
            directionalLight.shadow.mapSize.width   = 1024;  // Shadow map resolution
            directionalLight.shadow.mapSize.height  = 1024;
            directionalLight.shadow.camera.near     = 0.5;
            directionalLight.shadow.camera.far      = 50;
            scene.add(directionalLight);

            // ── RIM LIGHT ──
            // Subtle purple back-light from lower-left-back.
            // Gives the device a "floating" glow effect and prevents flat silhouettes.
            rimLight = new THREE.DirectionalLight(0x6c63ff, state.rimIntensity);
            rimLight.position.set(-5, -3, -4);
            scene.add(rimLight);
        },

    }; // end ThreeSetup


    /* ========================================================================
       MODULE: DeviceBuilder
       Constructs procedural 3D device models from primitive Three.js geometries.
       No external GLTF, OBJ, or FBX files are required — the models are fully
       self-contained and generated at runtime.
    ======================================================================== */
    const DeviceBuilder = {

        /**
         * buildPhone()
         * ────────────
         * Constructs an iPhone-style smartphone model from simple geometries:
         *   - Body        : tall BoxGeometry with metallic PBR material
         *   - Bezel frame : slightly larger box, slightly recessed
         *   - Screen      : flat PlaneGeometry (UV texture target)
         *   - Front camera: small cylinder + reflective lens
         *   - Home indicator: thin pill at bottom of screen
         *   - Side / volume buttons: extruded box buttons on the frame
         *   - Rear camera module: protruding box + two lens cylinders
         *
         * @returns {THREE.Group} A group containing all phone mesh components.
         */
        buildPhone() {
            const group = new THREE.Group();

            // Parse the chosen device color and determine if it's a dark or light tint
            const bodyColor = new THREE.Color(state.deviceColor);
            const isDark = bodyColor.getHSL({}).l < 0.5;

            // ── BODY ──
            // The main rectangular slab of the phone.
            const bodyGeo = new THREE.BoxGeometry(2.0, 4.0, 0.22, 1, 1, 1);
            const bodyMat = new THREE.MeshStandardMaterial({
                color           : bodyColor,
                roughness       : 0.15,
                metalness       : 0.65,
                envMapIntensity : 0.8,
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.castShadow     = true;
            body.receiveShadow  = true;
            group.add(body);

            // ── BEZEL FRAME ──
            // Slightly larger than the body, positioned behind it to create a visible edge.
            const bezelGeo   = new THREE.BoxGeometry(2.08, 4.08, 0.18);
            const bezelColor = bodyColor.clone().multiplyScalar(isDark ? 0.65 : 1.2);
            const bezelMat   = new THREE.MeshStandardMaterial({
                color     : bezelColor,
                roughness : 0.08,
                metalness : 0.85,
            });
            const bezel = new THREE.Mesh(bezelGeo, bezelMat);
            bezel.position.z = -0.02;
            group.add(bezel);

            // ── SCREEN PLANE ──
            // A flat plane sitting flush on the front face.
            // This is the mesh that receives the user's screenshot as a texture.
            // screenMesh is assigned here so TextureManager can find it later.
            const screenGeo = new THREE.PlaneGeometry(1.72, 3.52);
            const screenMat = new THREE.MeshStandardMaterial({
                color               : 0x000000,  // Default black; overwritten when texture is loaded
                roughness           : 0.0,
                metalness           : 0.0,
                emissive            : new THREE.Color(0x000000),
                emissiveIntensity   : 0,
            });
            screenMesh = new THREE.Mesh(screenGeo, screenMat);
            screenMesh.position.z = 0.12; // Sit flush on the front face of the body
            group.add(screenMesh);

            // ── FRONT CAMERA HOUSING ──
            // Small dark cylinder at the top-center of the screen.
            const camGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.03, 32);
            const camMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
            const cam    = new THREE.Mesh(camGeo, camMat);
            cam.rotation.x = Math.PI / 2;
            cam.position.set(0, 1.78, 0.115);
            group.add(cam);

            // ── FRONT CAMERA LENS ──
            // Smaller, more reflective cylinder inside the camera housing.
            const lensGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.031, 32);
            const lensMat = new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.0, metalness: 1.0 });
            const lens    = new THREE.Mesh(lensGeo, lensMat);
            lens.rotation.x = Math.PI / 2;
            lens.position.set(0, 1.78, 0.12);
            group.add(lens);

            // ── HOME INDICATOR ──
            // Thin horizontal pill at the bottom of the screen (modern iPhone style).
            const indicatorGeo = new THREE.BoxGeometry(0.52, 0.06, 0.02);
            const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.5 });
            const indicator    = new THREE.Mesh(indicatorGeo, indicatorMat);
            indicator.position.set(0, -1.72, 0.12);
            group.add(indicator);

            // ── SIDE POWER BUTTON (right edge) ──
            const sideButtonGeo = new THREE.BoxGeometry(0.05, 0.45, 0.15);
            const sideButtonMat = new THREE.MeshStandardMaterial({
                color     : bezelColor,
                roughness : 0.1,
                metalness : 0.9,
            });
            const sideButton = new THREE.Mesh(sideButtonGeo, sideButtonMat);
            sideButton.position.set(1.055, 0.5, 0);
            group.add(sideButton);

            // ── VOLUME BUTTONS (left edge, two stacked buttons) ──
            // Iterates over two y-offset values to position the two volume buttons.
            [-0.2, 0.3].forEach(yOffset => {
                const volGeo = new THREE.BoxGeometry(0.05, 0.28, 0.13);
                const vol    = new THREE.Mesh(volGeo, sideButtonMat);
                vol.position.set(-1.055, 0.6 + yOffset, 0);
                group.add(vol);
            });

            // ── REAR CAMERA MODULE HOUSING (back face, upper-left) ──
            const rearCamModGeo = new THREE.BoxGeometry(0.55, 0.55, 0.06);
            const rearCamModMat = new THREE.MeshStandardMaterial({
                color     : bezelColor.clone().multiplyScalar(0.7),
                roughness : 0.05,
                metalness : 0.95,
            });
            const rearCamMod = new THREE.Mesh(rearCamModGeo, rearCamModMat);
            rearCamMod.position.set(-0.55, 1.45, -0.14);
            group.add(rearCamMod);

            // ── TWO REAR CAMERA LENSES ──
            // Array of [xOffset, yOffset] pairs relative to the camera module center.
            [[-0.1, 0.1], [0.15, -0.1]].forEach(([ox, oy]) => {
                const rLensGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 32);
                const rLensMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.0, metalness: 1.0 });
                const rLens    = new THREE.Mesh(rLensGeo, rLensMat);
                rLens.rotation.x = Math.PI / 2;
                rLens.position.set(-0.55 + ox, 1.45 + oy, -0.17);
                group.add(rLens);
            });

            return group;
        },

        /**
         * buildLaptop()
         * ─────────────
         * Constructs a MacBook-style laptop from stacked geometries:
         *   - Base         : wide flat BoxGeometry (keyboard deck)
         *   - Keyboard area: recessed dark region on the base
         *   - Touchpad     : polished rectangle below keyboard
         *   - Lid          : tall thin BoxGeometry, tilted ~70° open
         *   - Screen       : PlaneGeometry as a child of the lid (inherits tilt)
         *   - Apple logo   : subtle circle on the back of the lid
         *   - Hinges       : two thin cylinders at the lid/base junction
         *   - Front edge   : thin strip along the base front
         *
         * @returns {THREE.Group} A group containing all laptop mesh components.
         */
        buildLaptop() {
            const group = new THREE.Group();

            const bodyColor    = new THREE.Color(state.deviceColor);
            const isDark       = bodyColor.getHSL({}).l < 0.5;
            const shinierColor = bodyColor.clone().multiplyScalar(isDark ? 0.75 : 1.15);

            // Shared materials for body and shiny trim
            const bodyMat = new THREE.MeshStandardMaterial({
                color     : bodyColor,
                roughness : 0.12,
                metalness : 0.75,
            });
            const shinierMat = new THREE.MeshStandardMaterial({
                color     : shinierColor,
                roughness : 0.06,
                metalness : 0.9,
            });

            // ── BASE (keyboard body) ──
            const baseGeo = new THREE.BoxGeometry(4.8, 0.18, 3.2);
            const base    = new THREE.Mesh(baseGeo, bodyMat);
            base.position.set(0, -1.3, 0.5);
            base.castShadow     = true;
            base.receiveShadow  = true;
            group.add(base);

            // ── TOUCHPAD ──
            const padGeo = new THREE.BoxGeometry(1.2, 0.01, 0.8);
            const padMat = new THREE.MeshStandardMaterial({ color: shinierColor, roughness: 0.05, metalness: 0.9 });
            const pad    = new THREE.Mesh(padGeo, padMat);
            pad.position.set(0, -1.2, 1.45);
            group.add(pad);

            // ── KEYBOARD AREA (slightly recessed dark region) ──
            const kbGeo = new THREE.BoxGeometry(4.0, 0.01, 1.8);
            const kbMat = new THREE.MeshStandardMaterial({
                color     : bodyColor.clone().multiplyScalar(isDark ? 0.5 : 0.85),
                roughness : 0.3,
                metalness : 0.4,
            });
            const kb = new THREE.Mesh(kbGeo, kbMat);
            kb.position.set(0, -1.21, 0.3);
            group.add(kb);

            // ── LID ──
            // Tilted ~70° open to show the screen. Screen mesh is a child of the lid
            // so it inherits the tilt transformation automatically.
            const lidGeo = new THREE.BoxGeometry(4.8, 3.0, 0.14);
            const lid    = new THREE.Mesh(lidGeo, bodyMat);
            lid.position.set(0, 0.2, -1.1);
            lid.rotation.x = THREE.MathUtils.degToRad(70); // Tilt lid open ~70°
            lid.castShadow = true;
            group.add(lid);

            // ── SCREEN (child of lid — inherits 70° tilt) ──
            // This is the PlaneGeometry that receives the user's screenshot texture.
            const screenGeo = new THREE.PlaneGeometry(4.3, 2.6);
            const screenMat = new THREE.MeshStandardMaterial({
                color               : 0x000000,
                roughness           : 0.0,
                metalness           : 0.0,
                emissive            : 0x000000,
                emissiveIntensity   : 0,
            });
            screenMesh = new THREE.Mesh(screenGeo, screenMat);
            screenMesh.position.set(0, 0, 0.075); // Front face of the lid
            lid.add(screenMesh); // Add as child so it tilts with the lid

            // ── APPLE LOGO PLACEHOLDER (back of lid) ──
            // A simple metallic circle on the outer face of the lid.
            const logoGeo = new THREE.CircleGeometry(0.22, 32);
            const logoMat = new THREE.MeshStandardMaterial({
                color     : shinierColor,
                roughness : 0.02,
                metalness : 1.0,
            });
            const logo = new THREE.Mesh(logoGeo, logoMat);
            logo.position.set(0, 0, -0.075); // Back face of the lid
            logo.rotation.y = Math.PI;        // Flip to face outward
            lid.add(logo);

            // ── HINGES (two cylinders connecting lid to base) ──
            [-1.8, 1.8].forEach(xPos => {
                const hingeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.3, 16);
                const hinge    = new THREE.Mesh(hingeGeo, shinierMat);
                hinge.rotation.z = Math.PI / 2;
                hinge.position.set(xPos, -1.22, -0.96);
                group.add(hinge);
            });

            // ── BASE FRONT EDGE ──
            const frontEdgeGeo = new THREE.BoxGeometry(4.8, 0.05, 0.12);
            const frontEdge    = new THREE.Mesh(frontEdgeGeo, shinierMat);
            frontEdge.position.set(0, -1.21, 2.07);
            group.add(frontEdge);

            return group;
        },

    }; // end DeviceBuilder


    /* ========================================================================
       MODULE: SceneManager
       Manages the Three.js scene lifecycle:
         - Loading / swapping device models with proper memory cleanup
         - Generating canvas-based background textures (glassmorphism, gradient, mesh)
         - Running the main requestAnimationFrame render loop
         - Handling canvas resize events to maintain correct aspect ratio
    ======================================================================== */
    const SceneManager = {

        /**
         * loadDevice(type)
         * ────────────────
         * Removes the current device group from the scene, disposes of its
         * geometries and materials to prevent GPU memory leaks, builds a new
         * device, and re-applies the user's screenshot texture if one exists.
         *
         * @param {string} type — 'phone' | 'laptop'
         */
        loadDevice(type) {
            // Remove and dispose old device to free GPU resources
            if (deviceGroup) {
                scene.remove(deviceGroup);
                deviceGroup.traverse(child => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material?.dispose();
                        }
                    }
                });
            }

            // Build the new device geometry
            deviceGroup = (type === 'phone')
                ? DeviceBuilder.buildPhone()
                : DeviceBuilder.buildLaptop();

            scene.add(deviceGroup);

            // Apply current orbit rotation so the device appears at the same angle
            deviceGroup.rotation.x = orbit.rotationX;
            deviceGroup.rotation.y = orbit.rotationY;

            // Re-apply screenshot texture if it was already loaded
            if (state.hasImage && state.userTexture && screenMesh) {
                TextureManager.applyTextureToScreen(state.userTexture);
            }
        },

        /**
         * applyBackground()
         * ─────────────────
         * Sets scene.background based on state.bgStyle.
         *
         * 'dark' and 'solid' styles map directly to THREE.Color.
         * 'glassmorphism', 'gradient', and 'mesh' are rendered onto a 512×512
         * offscreen canvas and uploaded as a THREE.CanvasTexture.
         */
        applyBackground() {
            const style = state.bgStyle;

            // ── SOLID COLOUR STYLES ──
            if (style === 'dark') {
                scene.background = new THREE.Color(0x060610);
                return;
            }
            if (style === 'solid') {
                scene.background = new THREE.Color(state.solidColor);
                return;
            }

            // ── CANVAS-GENERATED TEXTURE STYLES ──
            // Create an offscreen canvas to paint the background texture onto.
            const bgCanvas     = document.createElement('canvas');
            bgCanvas.width     = 512;
            bgCanvas.height    = 512;
            const ctx          = bgCanvas.getContext('2d');

            if (style === 'glassmorphism') {
                // Dark base
                ctx.fillStyle = '#0a0a1a';
                ctx.fillRect(0, 0, 512, 512);

                // Purple radial glow (upper-left)
                const g1 = ctx.createRadialGradient(140, 150, 20, 140, 150, 220);
                g1.addColorStop(0, 'rgba(108,99,255,0.45)');
                g1.addColorStop(1, 'rgba(108,99,255,0)');
                ctx.fillStyle = g1;
                ctx.fillRect(0, 0, 512, 512);

                // Pink radial glow (lower-right)
                const g2 = ctx.createRadialGradient(380, 360, 20, 380, 360, 200);
                g2.addColorStop(0, 'rgba(240,147,251,0.38)');
                g2.addColorStop(1, 'rgba(240,147,251,0)');
                ctx.fillStyle = g2;
                ctx.fillRect(0, 0, 512, 512);

                // Subtle grid lines (glassmorphism aesthetic accent)
                ctx.strokeStyle = 'rgba(255,255,255,0.03)';
                ctx.lineWidth   = 1;
                for (let i = 0; i < 512; i += 32) {
                    ctx.beginPath(); ctx.moveTo(i, 0);   ctx.lineTo(i, 512);   ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, i);   ctx.lineTo(512, i);   ctx.stroke();
                }

            } else if (style === 'gradient') {
                // Clean linear gradient from user-chosen Color A to Color B
                const linGrad = ctx.createLinearGradient(0, 0, 512, 512);
                linGrad.addColorStop(0, state.gradColorA);
                linGrad.addColorStop(1, state.gradColorB);
                ctx.fillStyle = linGrad;
                ctx.fillRect(0, 0, 512, 512);

            } else if (style === 'mesh') {
                // Mesh gradient: linear base + multiple overlapping radial blobs
                const base = ctx.createLinearGradient(0, 0, 512, 512);
                base.addColorStop(0, state.gradColorA);
                base.addColorStop(1, state.gradColorB);
                ctx.fillStyle = base;
                ctx.fillRect(0, 0, 512, 512);

                // Helper: convert hex color to rgba string with given alpha
                const hexToRgba = (hex, alpha) => {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    return `rgba(${r},${g},${b},${alpha})`;
                };

                // Three overlapping radial gradient blobs for the mesh effect
                // Each entry: [centerX, centerY, radius, color]
                [
                    [256, 100, 180, state.gradColorA],
                    [100, 380, 150, state.gradColorB],
                    [400, 300, 130, state.gradColorA],
                ].forEach(([cx, cy, r, col]) => {
                    const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
                    rg.addColorStop(0, hexToRgba(col, 0.55));
                    rg.addColorStop(1, hexToRgba(col, 0));
                    ctx.fillStyle = rg;
                    ctx.fillRect(0, 0, 512, 512);
                });
            }

            // Upload the painted canvas as a Three.js texture and set as scene background
            const bgTexture  = new THREE.CanvasTexture(bgCanvas);
            scene.background = bgTexture;
        },

        /**
         * startRenderLoop()
         * ─────────────────
         * Starts the main animation loop using requestAnimationFrame.
         * Renders at the display's native refresh rate (typically 60fps).
         * Applies auto-rotation increment when state.isAutoRotating is true.
         */
        startRenderLoop() {
            const tick = () => {
                requestAnimationFrame(tick);

                // Increment the device group Y rotation if auto-spin is active
                if (state.isAutoRotating && deviceGroup) {
                    deviceGroup.rotation.y += 0.008;        // ~0.5° per frame at 60fps
                    orbit.rotationY = deviceGroup.rotation.y; // Keep orbit state in sync
                }

                renderer.render(scene, camera);
            };
            tick();
        },

        /**
         * onResize()
         * ──────────
         * Synchronizes the renderer size and camera aspect ratio with the
         * current canvas container dimensions. Called on window 'resize' and
         * once during Bootstrap.run() for correct initial sizing.
         */
        onResize() {
            const width  = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (width === 0 || height === 0) return; // Guard against zero-size flash

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false); // false = don't set canvas CSS size
        },

    }; // end SceneManager


    /* ========================================================================
       MODULE: TextureManager
       Handles the complete pipeline from a browser File object to a live
       Three.js texture mapped onto the device screen mesh.
    ======================================================================== */
    const TextureManager = {

        /**
         * loadFromFile(file)
         * ──────────────────
         * Validates the file type and size, reads it via FileReader into
         * a base64 Data URL, then passes it to THREE.TextureLoader.
         * On success, applies the texture to the screen mesh and enables export.
         *
         * @param {File} file — The image file selected or dropped by the user.
         */
        loadFromFile(file) {
            // Validate: only allow supported image MIME types
            const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
            if (!validTypes.includes(file.type)) {
                window.showToast('Unsupported format. Please use PNG, JPEG, WebP, or GIF.', true);
                return;
            }

            // Guard against excessively large files that could crash older devices
            if (file.size > 50 * 1024 * 1024) {
                window.showToast('File is too large (max 50MB). Please use a smaller image.', true);
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const dataURL = e.target.result;

                // Dispose the previous texture from GPU memory before loading a new one
                if (state.userTexture) {
                    state.userTexture.dispose();
                    state.userTexture = null;
                }

                // Load the Data URL as a Three.js texture
                const loader = new THREE.TextureLoader();

                loader.load(
                    dataURL,

                    // ── SUCCESS CALLBACK ──
                    (texture) => {
                        // Configure texture for best quality rendering
                        texture.encoding    = THREE.sRGBEncoding;    // Match renderer color space
                        texture.minFilter   = THREE.LinearFilter;     // No mipmapping (avoids blurring)
                        texture.magFilter   = THREE.LinearFilter;
                        texture.anisotropy  = renderer.capabilities.getMaxAnisotropy(); // Best sharpness at angles
                        texture.needsUpdate = true;

                        state.userTexture   = texture;
                        state.hasImage      = true;

                        // Map texture onto the screen mesh
                        this.applyTextureToScreen(texture);

                        // Hide the drop overlay, show the rotation/zoom hint
                        UI.revealCanvas();

                        // Notify the user that the screenshot was applied successfully
                        window.showToast('Screenshot mapped to device!');

                        // Enable the Export 4K PNG button
                        document.getElementById('btnExport4K').disabled = false;
                    },

                    // ── PROGRESS CALLBACK ── (not used, but required as placeholder)
                    undefined,

                    // ── ERROR CALLBACK ──
                    (err) => {
                        console.error('[TextureManager] THREE.TextureLoader error:', err);
                        window.showToast('Failed to load image. Please try another file.', true);
                    }
                );
            };

            reader.onerror = () => {
                window.showToast('FileReader error. Could not read the file.', true);
            };

            // Start reading the file as a base64 Data URL
            reader.readAsDataURL(file);
        },

        /**
         * applyTextureToScreen(texture)
         * ─────────────────────────────
         * Assigns a THREE.Texture to the screenMesh material.
         * Sets the material to white so the texture colors show correctly,
         * and adds a slight emissive glow to simulate a lit screen.
         *
         * @param {THREE.Texture} texture — The loaded screenshot texture.
         */
        applyTextureToScreen(texture) {
            if (!screenMesh) {
                console.warn('[TextureManager] screenMesh is null — device may not be loaded yet.');
                return;
            }

            screenMesh.material.map               = texture;
            screenMesh.material.color.set(0xffffff);    // White tint so texture renders at full color
            screenMesh.material.emissiveMap       = texture; // Subtle screen glow effect
            screenMesh.material.emissive.set(0xffffff);
            screenMesh.material.emissiveIntensity = 0.08;  // Very subtle — just enough to look lit
            screenMesh.material.needsUpdate       = true;
        },

    }; // end TextureManager


    /* ========================================================================
       MODULE: OrbitControls
       Custom mouse and multi-touch orbital rotation implementation.
       Avoids dependency on the THREE.OrbitControls addon (not included in
       the CDN r128 three.min.js bundle without a separate import map).

       Features:
         - Click + drag to rotate (mouse)
         - One-finger drag to rotate (touch)
         - Scroll wheel to zoom in/out
         - Two-finger pinch to zoom in/out (mobile)
         - Clamped vertical rotation (prevents model flipping upside-down)
    ======================================================================== */
    const OrbitControls = {

        /**
         * init()
         * ──────
         * Attaches all mouse and touch event listeners to the canvas element.
         * Mouse move and mouseup are bound to window so drag works outside canvas.
         */
        init() {
            // Mouse event listeners
            canvas.addEventListener('mousedown',   this.onMouseDown.bind(this));
            window.addEventListener('mousemove',   this.onMouseMove.bind(this));
            window.addEventListener('mouseup',     this.onMouseUp.bind(this));
            canvas.addEventListener('wheel',       this.onWheel.bind(this), { passive: false });

            // Touch event listeners (mobile support)
            canvas.addEventListener('touchstart',  this.onTouchStart.bind(this), { passive: true });
            canvas.addEventListener('touchmove',   this.onTouchMove.bind(this),  { passive: false });
            canvas.addEventListener('touchend',    this.onTouchEnd.bind(this),   { passive: true });
        },

        /**
         * onMouseDown(e)
         * ──────────────
         * Begins a drag operation. Records the starting pointer position.
         */
        onMouseDown(e) {
            orbit.isPointerDown = true;
            orbit.lastX         = e.clientX;
            orbit.lastY         = e.clientY;
        },

        /**
         * onMouseMove(e)
         * ──────────────
         * While the pointer is held, compute delta movement and rotate the device.
         * Vertical rotation is clamped to ±PI/2.2 to prevent flipping.
         */
        onMouseMove(e) {
            if (!orbit.isPointerDown || !deviceGroup) return;

            const deltaX = (e.clientX - orbit.lastX) * 0.008; // Horizontal: rotate around Y axis
            const deltaY = (e.clientY - orbit.lastY) * 0.006; // Vertical: rotate around X axis

            orbit.rotationY += deltaX;
            orbit.rotationX += deltaY;

            // Clamp vertical rotation to prevent the model from flipping upside-down
            orbit.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, orbit.rotationX));

            deviceGroup.rotation.y = orbit.rotationY;
            deviceGroup.rotation.x = orbit.rotationX;

            orbit.lastX = e.clientX;
            orbit.lastY = e.clientY;
        },

        /**
         * onMouseUp()
         * ───────────
         * Ends the drag operation.
         */
        onMouseUp() {
            orbit.isPointerDown = false;
        },

        /**
         * onWheel(e)
         * ──────────
         * Scroll wheel zooms by adjusting camera.position.z.
         * Zoom is clamped between minZoom and maxZoom.
         */
        onWheel(e) {
            e.preventDefault(); // Prevent page scroll while cursor is over canvas

            const delta        = e.deltaY > 0 ? 0.07 : -0.07; // Positive = scroll down = zoom out
            orbit.zoomFactor   = Math.max(orbit.minZoom, Math.min(orbit.maxZoom, orbit.zoomFactor + delta));
            camera.position.z  = 7 / orbit.zoomFactor; // Higher zoomFactor → camera moves closer
        },

        /**
         * onTouchStart(e)
         * ───────────────
         * For single touch: begin orbit drag.
         * For two touches: record initial pinch distance for zoom.
         */
        onTouchStart(e) {
            if (e.touches.length === 1) {
                orbit.isPointerDown = true;
                orbit.lastX         = e.touches[0].clientX;
                orbit.lastY         = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                orbit.pinchDist = this.getPinchDistance(e.touches);
            }
        },

        /**
         * onTouchMove(e)
         * ──────────────
         * Single touch: rotate device (same logic as mouse drag).
         * Two-touch: calculate pinch delta and adjust zoom factor.
         */
        onTouchMove(e) {
            if (e.touches.length === 1 && orbit.isPointerDown && deviceGroup) {
                e.preventDefault();

                const deltaX = (e.touches[0].clientX - orbit.lastX) * 0.010;
                const deltaY = (e.touches[0].clientY - orbit.lastY) * 0.008;

                orbit.rotationY += deltaX;
                orbit.rotationX += deltaY;
                orbit.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, orbit.rotationX));

                deviceGroup.rotation.y = orbit.rotationY;
                deviceGroup.rotation.x = orbit.rotationX;

                orbit.lastX = e.touches[0].clientX;
                orbit.lastY = e.touches[0].clientY;

            } else if (e.touches.length === 2) {
                e.preventDefault();

                const newDist      = this.getPinchDistance(e.touches);
                const scaleDelta   = (newDist - orbit.pinchDist) * 0.003;
                orbit.zoomFactor   = Math.max(orbit.minZoom, Math.min(orbit.maxZoom, orbit.zoomFactor + scaleDelta));
                camera.position.z  = 7 / orbit.zoomFactor;
                orbit.pinchDist    = newDist;
            }
        },

        /**
         * onTouchEnd()
         * ────────────
         * Resets the pointer-down flag when all fingers are lifted.
         */
        onTouchEnd() {
            orbit.isPointerDown = false;
        },

        /**
         * getPinchDistance(touches)
         * ─────────────────────────
         * Calculates the Euclidean distance between two touch points.
         * Used to determine the pinch-to-zoom scale delta.
         *
         * @param {TouchList} touches — The current list of active touch points.
         * @returns {number} Pixel distance between the two touch points.
         */
        getPinchDistance(touches) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        },

    }; // end OrbitControls


    /* ========================================================================
       MODULE: ExportEngine
       Handles the 4K PNG export pipeline.

       Technique:
         1. Record current canvas display dimensions.
         2. Resize renderer to 3840×2160 (4K).
         3. Update camera aspect ratio to match 4K.
         4. Render one high-res frame into the canvas buffer.
         5. Capture the buffer as a lossless PNG via canvas.toDataURL().
         6. Trigger a programmatic <a> click to download the file.
         7. Restore renderer and camera to original display dimensions.
    ======================================================================== */
    const ExportEngine = {

        /**
         * export4K()
         * ──────────
         * Executes the full 4K export sequence described above.
         * Uses a 60ms setTimeout to allow the browser to repaint the button
         * state (spinner icon) before the heavy rendering begins.
         * The isExporting flag prevents double-click race conditions.
         */
        export4K() {
            // Guard: prevent multiple simultaneous export operations
            if (state.isExporting) return;
            state.isExporting = true;

            // Update the export button UI to show a loading state
            const btn       = document.getElementById('btnExport4K');
            btn.classList.add('exporting');
            btn.innerHTML   = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting…';

            // Delay to allow the browser to repaint the button before the GPU-heavy work
            setTimeout(() => {
                // ── Record current display dimensions for restoration ──
                const displayW      = canvas.clientWidth;
                const displayH      = canvas.clientHeight;
                const displayAspect = displayW / displayH;

                // ── Target 4K export resolution ──
                const EXPORT_W      = 3840;
                const EXPORT_H      = 2160;

                try {
                    // 1. Resize renderer to 4K
                    renderer.setSize(EXPORT_W, EXPORT_H, true);

                    // 2. Correct camera aspect ratio for 4K (16:9 widescreen)
                    camera.aspect = EXPORT_W / EXPORT_H;
                    camera.updateProjectionMatrix();

                    // 3. Render one full 4K frame into the canvas pixel buffer
                    renderer.render(scene, camera);

                    // 4. Capture the pixel buffer as a lossless PNG Data URL
                    const dataURL = canvas.toDataURL('image/png', 1.0);

                    // 5. Construct a timestamped filename for the download
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const filename  = `3d-mockup-studio-max-${state.device}-4k-${timestamp}.png`;

                    // 6. Programmatically trigger a download via a temporary anchor
                    const anchor        = document.createElement('a');
                    anchor.href         = dataURL;
                    anchor.download     = filename;
                    document.body.appendChild(anchor);
                    anchor.click();
                    document.body.removeChild(anchor);

                    // 7. Notify the user of success
                    window.showToast('4K PNG exported successfully!');

                } catch (err) {
                    console.error('[ExportEngine] 4K export failed:', err);
                    window.showToast('Export failed. Your browser may not support canvas export.', true);

                } finally {
                    // ── ALWAYS restore display size, even if export threw an error ──
                    renderer.setSize(displayW, displayH, false);
                    camera.aspect = displayAspect;
                    camera.updateProjectionMatrix();

                    // Reset button back to normal state
                    btn.classList.remove('exporting');
                    btn.innerHTML   = '<i class="fa-solid fa-file-image"></i> Export 4K PNG';
                    state.isExporting = false;
                }

            }, 60); // 60ms: enough time for the browser to paint the spinner
        },

    }; // end ExportEngine


    /* ========================================================================
       MODULE: UI
       Wires up all DOM event listeners and provides UI helper methods.
       Called once during Bootstrap.run() after Three.js is initialized.
    ======================================================================== */
    const UI = {

        /**
         * init()
         * ──────
         * Attaches all event listeners to DOM elements.
         * Organizes listeners by feature: device toggle, color swatches,
         * background styles, color pickers, lighting sliders, rotation controls,
         * upload trigger, file input, drag-and-drop, and export button.
         */
        init() {

            // ── DEVICE TOGGLE BUTTONS (.device-btn) ──
            // Clicking a device button updates state.device and rebuilds the 3D model.
            document.querySelectorAll('.mck-device-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Deactivate all device buttons, then activate the clicked one
                    document.querySelectorAll('.mck-device-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    state.device = btn.dataset.device;
                    SceneManager.loadDevice(state.device);
                });
            });

            // ── DEVICE COLOR SWATCHES (.mck-swatch / .color-swatch) ──
            // Selecting a swatch updates state.deviceColor and rebuilds the model with new colors.
            document.querySelectorAll('.mck-swatch').forEach(swatch => {
                swatch.addEventListener('click', () => {
                    document.querySelectorAll('.mck-swatch').forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');

                    state.deviceColor = swatch.dataset.color;
                    SceneManager.loadDevice(state.device); // Rebuild with new Claymorphism color
                });
            });

            // ── BACKGROUND STYLE BUTTONS (.mck-bg-btn / .bg-style-btn) ──
            // Selecting a style updates state.bgStyle, toggles color pickers, and redraws background.
            document.querySelectorAll('.mck-bg-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.mck-bg-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    state.bgStyle = btn.dataset.bg;
                    this.toggleBgPickers(state.bgStyle);
                    SceneManager.applyBackground();
                });
            });

            // ── GRADIENT COLOR PICKERS ──
            // Both gradient pickers update their respective state colors and refresh the background.
            document.getElementById('gradColorA').addEventListener('input', (e) => {
                state.gradColorA = e.target.value;
                SceneManager.applyBackground();
            });
            document.getElementById('gradColorB').addEventListener('input', (e) => {
                state.gradColorB = e.target.value;
                SceneManager.applyBackground();
            });
            document.getElementById('solidColor').addEventListener('input', (e) => {
                state.solidColor = e.target.value;
                SceneManager.applyBackground();
            });

            // ── LIGHTING SLIDERS ──
            // Each slider uses bindSlider() to link input changes to light intensity updates.
            this.bindSlider('ambientSlider',     'ambientVal',     (val) => {
                state.ambientIntensity = val;
                if (ambientLight) ambientLight.intensity = val;
            });
            this.bindSlider('directionalSlider', 'directionalVal', (val) => {
                state.directionalIntensity = val;
                if (directionalLight) directionalLight.intensity = val;
            });
            this.bindSlider('rimSlider',         'rimVal',         (val) => {
                state.rimIntensity = val;
                if (rimLight) rimLight.intensity = val;
            });

            // ── RESET ROTATION BUTTON (#btnResetRotation) ──
            // Snaps the device back to its default viewing angle and zoom level.
            document.getElementById('btnResetRotation').addEventListener('click', () => {
                orbit.rotationX  = -0.15;
                orbit.rotationY  = 0.45;
                orbit.zoomFactor = 1.0;
                camera.position.z = 7;

                if (deviceGroup) {
                    deviceGroup.rotation.x = orbit.rotationX;
                    deviceGroup.rotation.y = orbit.rotationY;
                }
            });

            // ── AUTO-ROTATE TOGGLE BUTTON (#btnAutoRotate) ──
            // Toggles state.isAutoRotating. Updates button label and style accordingly.
            document.getElementById('btnAutoRotate').addEventListener('click', (e) => {
                state.isAutoRotating = !state.isAutoRotating;

                // active-spin CSS class shows a red "stop" style on the button
                e.currentTarget.classList.toggle('active-spin', state.isAutoRotating);

                // Update button icon and label to reflect current state
                e.currentTarget.innerHTML = state.isAutoRotating
                    ? '<i class="fa-solid fa-circle-stop"></i> Stop Spin'
                    : '<i class="fa-solid fa-circle-play"></i> Auto-Spin';
            });

            // ── UPLOAD TRIGGER BUTTON (#btnUploadTrigger) ──
            // Programmatically clicks the hidden file input to open the OS file picker.
            document.getElementById('btnUploadTrigger').addEventListener('click', () => {
                document.getElementById('imageFileInput').click();
            });

            // ── FILE INPUT CHANGE (#imageFileInput) ──
            // Triggered when the user selects a file via the OS picker.
            // Resets the input value so the same file can be re-selected later.
            document.getElementById('imageFileInput').addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (file) TextureManager.loadFromFile(file);
                e.target.value = ''; // Allow re-selecting the same file
            });

            // ── DRAG-AND-DROP ON CANVAS PANEL ──
            // The .mck-drop-overlay and the canvas both accept drag-and-drop.
            const dropOverlay = document.getElementById('dropOverlay');
            const canvasPanel = document.querySelector('.mck-canvas-panel');

            // Visual feedback: add drag-over class when file enters the canvas panel
            canvasPanel.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropOverlay.classList.add('drag-over');
            });

            // Remove visual feedback when drag leaves the canvas panel
            canvasPanel.addEventListener('dragleave', (e) => {
                if (!canvasPanel.contains(e.relatedTarget)) {
                    dropOverlay.classList.remove('drag-over');
                }
            });

            // Handle file drop on the canvas panel (overlay visible state)
            canvasPanel.addEventListener('drop', (e) => {
                e.preventDefault();
                dropOverlay.classList.remove('drag-over');
                const file = e.dataTransfer.files?.[0];
                if (file) TextureManager.loadFromFile(file);
            });

            // Also support drop directly on the canvas after overlay is hidden
            canvas.addEventListener('dragover', (e) => e.preventDefault());
            canvas.addEventListener('drop', (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) TextureManager.loadFromFile(file);
            });

            // ── EXPORT 4K PNG BUTTON (#btnExport4K) ──
            // Triggers the full export sequence. Button is disabled until screenshot is loaded.
            document.getElementById('btnExport4K').addEventListener('click', () => {
                ExportEngine.export4K();
            });

            // ── WINDOW RESIZE ──
            // Keep renderer and camera aspect ratio in sync with the canvas container.
            window.addEventListener('resize', () => {
                SceneManager.onResize();
            });

            // Initialize the color picker visibility on load
            this.toggleBgPickers(state.bgStyle);
        },

        /**
         * bindSlider(sliderId, valId, onChange)
         * ──────────────────────────────────────
         * Generic helper that binds a range <input> to a display <span> and
         * an onChange callback. Updates the display to 2 decimal places.
         *
         * @param {string}   sliderId — ID of the <input type="range"> element.
         * @param {string}   valId    — ID of the <span> that shows the numeric value.
         * @param {Function} onChange — Callback receiving the parsed float value.
         */
        bindSlider(sliderId, valId, onChange) {
            const slider = document.getElementById(sliderId);
            const valEl  = document.getElementById(valId);
            if (!slider || !valEl) return;

            slider.addEventListener('input', () => {
                const val     = parseFloat(slider.value);
                valEl.textContent = val.toFixed(2); // Display 2 decimal places
                onChange(val);
            });
        },

        /**
         * toggleBgPickers(bgStyle)
         * ─────────────────────────
         * Shows or hides the gradient and solid color picker rows based on
         * the currently active background style.
         *
         * @param {string} bgStyle — One of 'glassmorphism' | 'gradient' | 'solid' | 'dark' | 'mesh'
         */
        toggleBgPickers(bgStyle) {
            const gradPickers = document.getElementById('gradientPickers');
            const solidPicker = document.getElementById('solidPicker');

            // Gradient pickers are relevant for both 'gradient' and 'mesh' styles
            const showGrad  = bgStyle === 'gradient' || bgStyle === 'mesh';
            const showSolid = bgStyle === 'solid';

            gradPickers.style.display = showGrad  ? 'flex'  : 'none';
            solidPicker.style.display = showSolid ? 'block' : 'none';
        },

        /**
         * revealCanvas()
         * ──────────────
         * Hides the drop-zone overlay and shows the rotation/zoom hint bar.
         * Called by TextureManager.loadFromFile() after a texture is loaded successfully.
         */
        revealCanvas() {
            const overlay = document.getElementById('dropOverlay');
            const hint    = document.getElementById('canvasHint');
            if (overlay) overlay.style.display = 'none';
            if (hint)    hint.style.display    = 'block';
        },

    }; // end UI


    /* ========================================================================
       MODULE: Bootstrap
       Application entry point.
       Runs WebGL capability check, then initializes all modules in the
       correct dependency order.
    ======================================================================== */
    const Bootstrap = {

        /**
         * run()
         * ─────
         * The main initialization sequence.
         *
         * Order:
         *  1. WebGL support check (abort with error UI if unavailable)
         *  2. ThreeSetup.init()         — scene / camera / renderer / lights
         *  3. SceneManager.loadDevice() — build default phone model
         *  4. SceneManager.applyBackground() — set initial glassmorphism background
         *  5. OrbitControls.init()      — attach mouse + touch listeners
         *  6. UI.init()                 — wire up all button / slider listeners
         *  7. SceneManager.startRenderLoop() — begin the 60fps animation loop
         *  8. SceneManager.onResize()   — correct initial aspect ratio
         *  9. Mobile WebGL warning      — toast if mobile device detected
         */
        run() {
            // Step 0: WebGL capability check
            if (!this.checkWebGLSupport()) {
                this.showWebGLError();
                return;
            }

            // Step 1: Initialize Three.js core pipeline
            const threeReady = ThreeSetup.init();
            if (!threeReady) return;

            // Step 2: Build and add the default device (phone) to the scene
            SceneManager.loadDevice(state.device);

            // Step 3: Apply the initial background style (glassmorphism)
            SceneManager.applyBackground();

            // Step 4: Initialize custom orbit controls (mouse + touch)
            OrbitControls.init();

            // Step 5: Wire up all DOM event listeners
            UI.init();

            // Step 6: Start the main render loop
            SceneManager.startRenderLoop();

            // Step 7: Sync renderer size with canvas container dimensions
            SceneManager.onResize();

            // Step 8: Mobile device warning
            // If running on a mobile browser, warn that 4K export may be slow
            // and that drag-and-drop might not be supported.
            this.checkMobileWarning();

            console.log('[StudioApp] 3D Mockup STUDIO MAX initialized successfully.');
        },

        /**
         * checkWebGLSupport()
         * ───────────────────
         * Tests for WebGL 1.0 support by attempting to get a WebGL context
         * from a temporary canvas element. Falls back to experimental-webgl
         * for older browser compatibility.
         *
         * @returns {boolean} true if WebGL is supported, false otherwise.
         */
        checkWebGLSupport() {
            try {
                const testCanvas = document.createElement('canvas');
                return !!(
                    testCanvas.getContext('webgl') ||
                    testCanvas.getContext('experimental-webgl')
                );
            } catch (e) {
                return false;
            }
        },

        /**
         * showWebGLError()
         * ────────────────
         * Replaces the canvas panel content with a user-friendly error message
         * when WebGL is unavailable. This covers old browsers, corporate
         * environments with GPU acceleration disabled, and some embedded views.
         */
        showWebGLError() {
            const panel = document.querySelector('.mck-canvas-panel');
            if (!panel) return;

            panel.innerHTML = `
                <div style="
                    display         : flex;
                    flex-direction  : column;
                    align-items     : center;
                    justify-content : center;
                    height          : 100%;
                    min-height      : 280px;
                    gap             : 14px;
                    padding         : 32px;
                    text-align      : center;
                    color           : var(--accent-red, #e74c3c);
                ">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem;"></i>
                    <h3 style="margin:0; font-size: 1.1rem; color: inherit;">WebGL Not Supported</h3>
                    <p style="margin:0; font-size: 0.85rem; color: var(--text-muted);">
                        Your browser or device does not support WebGL, which is required
                        to render 3D device mockups. Please try Chrome, Firefox, Edge,
                        or Safari 15+ on a modern device.
                    </p>
                </div>
            `;
        },

        /**
         * checkMobileWarning()
         * ─────────────────────
         * Detects if the user is on a mobile device.
         * If so, shows a toast notification warning that 4K export may be
         * slower on mobile hardware and that drag-and-drop may not be available.
         * This does NOT block the tool — it simply informs the user.
         */
        checkMobileWarning() {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                // Delay slightly so the toast appears after the tool finishes rendering
                setTimeout(() => {
                    window.showToast('Mobile detected: 4K export may be slower. Use desktop for best performance.');
                }, 1500);
            }
        },

    }; // end Bootstrap


    // -------------------------------------------------------------------------
    // INIT — Run Bootstrap when the DOM is fully ready.
    // If the script is loaded with defer or at the bottom of <body>, the DOM
    // is already ready; otherwise wait for DOMContentLoaded.
    // -------------------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Bootstrap.run());
    } else {
        Bootstrap.run();
    }


    // -------------------------------------------------------------------------
    // PUBLIC API
    // Expose a minimal read-only interface for browser console debugging.
    // Developers can call StudioApp.getState(), getScene(), or getRenderer()
    // to inspect the internal state without breaking encapsulation.
    // -------------------------------------------------------------------------
    return {
        /** Returns a shallow copy of the current application state object. */
        getState    : () => ({ ...state }),
        /** Returns the live THREE.Scene instance. */
        getScene    : () => scene,
        /** Returns the live THREE.WebGLRenderer instance. */
        getRenderer : () => renderer,
    };

})(); // end StudioApp IIFE
