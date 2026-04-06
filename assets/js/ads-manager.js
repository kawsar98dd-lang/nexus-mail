/*!
 * ============================================================
 * Plugin Name:  Trusted Tools Web — Pro Ad Manager
 * Plugin URI:   https://trustedtoolsweb.com
 * Version:      5.2.0
 * Author:       MD KAWSAR
 * Author URI:   https://trustedtoolsweb.com
 * License:      CodeCanyon Regular / Extended License
 * Description:  Multi-network ad injection engine with lazy
 *               loading, zero-width retry, mutation recovery,
 *               and AdBlocker detection. Compatible with all
 *               modern browsers, legacy Android WebView, and
 *               SPCK Editor preview environment.
 *
 *               v5.2.0 — Dynamic Firestore configuration.
 *               The engine now fetches its config from
 *               Firestore (ads/main) before initialising.
 *               Falls back to the hardcoded defaults below
 *               if the fetch fails for any reason.
 * ============================================================
 *
 * Supported Networks:
 *   - Adsterra  (Banner)
 *   - Google AdSense
 *   - Custom HTML Ads
 *
 * Usage:
 *   1. Drop this file into: assets/js/ads-manager.js
 *      (replaces the old trusted-ad-manager.js)
 *   2. Ensure firebase-app-compat.js + firebase-firestore-compat.js
 *      are loaded BEFORE this file on every page.
 *   3. Ensure window.SITE_CONFIG (from site-config.js) is also
 *      available before this file loads.
 *   4. Place ad slots anywhere in your HTML:
 *        <div class="ad-slot" data-ad-slot="top-banner"></div>
 *        <div class="ad-slot" data-ad-slot="bottom-banner"></div>
 *
 * Public API:
 *   window.TrustedAdManager.refresh()  — re-scan for new slots
 * ============================================================
 */

/* global window, document, firebase */

/* ============================================================
 * SECTION 1 — FALLBACK / DEFAULT AD CONFIGURATION
 *
 * This object is the hardcoded fallback. It is used as-is if:
 *   a) Firestore is unreachable (network error, adblocker).
 *   b) The Firestore document (ads/main) does not exist yet.
 *   c) Any unexpected error occurs during the fetch.
 *
 * When Firestore IS reachable, the fetched document is merged
 * on top of these defaults, so any field present in Firestore
 * wins, and any field missing from Firestore keeps its value
 * from here.
 *
 * Edit the values below to set your local defaults.
 * ============================================================ */

var AD_CONFIG = {

    // ── Network 1: Adsterra ───────────────────────────────────
    adsterra: {
        enabled: true,
        slots: {

            /**
             * Top Banner — 300x250 Medium Rectangle
             * Displays above the main tool UI.
             * Works on all devices: mobile, tablet, desktop.
             */
            'top-banner': {
                type:   'banner',
                src:    'https://www.highperformanceformat.com/5070c547ef90c09b4238c20a4a95d940/invoke.js',
                width:  300,
                height: 250,
                atOptions: {
                    'key':    '5070c547ef90c09b4238c20a4a95d940',
                    'format': 'iframe',
                    'height': 250,
                    'width':  300,
                    'params': {}
                }
            },

            /**
             * Bottom Banner — 320x50 Mobile Banner
             * Displays below the main tool UI.
             * Ideal for mobile; renders cleanly on desktop too.
             */
            'bottom-banner': {
                type:   'banner',
                src:    'https://www.highperformanceformat.com/fcb4441b8ed60640d7288adb340a4ec3/invoke.js',
                width:  320,
                height: 50,
                atOptions: {
                    'key':    'fcb4441b8ed60640d7288adb340a4ec3',
                    'format': 'iframe',
                    'height': 50,
                    'width':  320,
                    'params': {}
                }
            }

        }
    },

    // ── Network 2: Google AdSense ─────────────────────────────
    adsense: {
        enabled: false,                        // Set true when AdSense is approved
        client_id: 'ca-pub-XXXXXXXXXXXXXXXX',  // Replace with your publisher ID
        slots: {
            'top-banner':    '1234567890',     // Replace with your ad slot IDs
            'bottom-banner': '0987654321',
            'in-content':    '1122334455',
            'sidebar':       '5544332211'
        }
    },

    // ── Network 3: Custom HTML Ad ─────────────────────────────
    custom: {
        enabled: false,                        // Set true to use custom HTML ads
        slots: {
            'top-banner':    '',               // Paste full ad HTML string here
            'bottom-banner': ''
        }
    },

    // ── Priority — first enabled network with a matching slot wins
    priority: ['adsterra', 'adsense', 'custom'],

    // ── Global Options ────────────────────────────────────────
    options: {
        lazyLoad:   false,  // Use IntersectionObserver when available
        retryDelay: 500,    // Milliseconds between zero-width retries
        maxRetries: 3       // Maximum retry attempts per slot
    }

};


/* ============================================================
 * SECTION 2 — CORE ENGINE
 * ⚠️  DO NOT EDIT BELOW THIS LINE.
 * All injection logic is heavily optimised for cross-browser
 * and legacy WebView compatibility. Changes will break ads.
 * ============================================================ */

var TrustedAdManager = (function () {

    'use strict';

    /* ----------------------------------------------------------
     * Internal: safely append a <script> element to a parent.
     *
     * Why createElement instead of innerHTML:
     *   Per HTML5 spec section 4.12.1, <script> tags injected
     *   via innerHTML are NOT executed by the browser. This is a
     *   known cross-browser limitation. Using createElement and
     *   appendChild guarantees execution in all environments
     *   including legacy Android WebView and SPCK Editor.
     * ---------------------------------------------------------- */
    function _appendScript(parent, config) {
        var s = document.createElement('script');

        if (config.text) {
            try {
                s.text = config.text;       // Standard (all modern browsers)
            } catch (e) {
                s.innerHTML = config.text;  // IE8 fallback
            }
        }

        if (config.src) {
            s.src   = config.src;
            s.async = true;
        }

        if (config.type) {
            s.type = config.type;
        }

        parent.appendChild(s);
        return s;
    }

    /* ----------------------------------------------------------
     * Internal: create a flex-center wrapper div.
     * Reserves minimum height to prevent layout shift (CLS).
     * Vendor-prefixed flex properties ensure Android 4.x support.
     * ---------------------------------------------------------- */
    function _createWrapper(minHeight) {
        var div       = document.createElement('div');
        div.className = 'adsterra-wrapper';
        div.style.cssText = [
            'display:-webkit-box',
            'display:-webkit-flex',
            'display:-ms-flexbox',
            'display:flex',
            '-webkit-box-align:center',
            '-webkit-align-items:center',
            '-ms-flex-align:center',
            'align-items:center',
            '-webkit-box-pack:center',
            '-webkit-justify-content:center',
            '-ms-flex-pack:center',
            'justify-content:center',
            'width:100%',
            'min-height:' + (minHeight || 90) + 'px',
            'overflow:hidden'
        ].join(';');
        return div;
    }

    /* ----------------------------------------------------------
     * Inject: Adsterra Banner (Iframe Isolation Method)
     *
     * FIX FOR MULTIPLE ADS:
     * Adsterra relies on a global 'atOptions' variable. If multiple
     * ads are injected directly into the DOM, the last ad's config
     * overwrites the previous ones globally, causing earlier ads
     * to fail silently. By wrapping each ad in a dynamically
     * generated iframe, we isolate their JavaScript execution
     * context, allowing multiple Adsterra banners to load
     * flawlessly on the same page without variable collisions.
     * ---------------------------------------------------------- */
    function _injectAdsterra(slot, slotType) {
        var cfg     = AD_CONFIG.adsterra;
        var slotCfg = cfg.slots[slotType];
        if (!slotCfg) { return false; }

        // Create an isolated iframe element
        var iframe = document.createElement('iframe');
        iframe.width = slotCfg.width || 300;
        iframe.height = slotCfg.height || 250;
        iframe.frameBorder = "0";
        iframe.scrolling = "no";
        iframe.style.cssText = "border:none; overflow:hidden; display:block; margin:0 auto; background:transparent;";

        slot.innerHTML = '';
        slot.appendChild(iframe);

        // Generate the iframe HTML content
        // Note: The closing script tags are split ('</scr' + 'ipt>')
        // to prevent the browser parser from closing the main document script prematurely.
        var iframeContent = '<!DOCTYPE html><html><head>' +
            '<style>body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden;background:transparent;}</style>' +
            '</head><body>' +
            '<script type="text/javascript">' +
            'var atOptions = ' + JSON.stringify(slotCfg.atOptions) + ';' +
            '</scr' + 'ipt>' +
            '<script type="text/javascript" src="' + slotCfg.src + '"></scr' + 'ipt>' +
            '</body></html>';

        // Safely write the content into the iframe's isolated document
        var iframeDoc = iframe.contentWindow || iframe.contentDocument;
        if (iframeDoc.document) {
            iframeDoc = iframeDoc.document;
        }

        iframeDoc.open();
        iframeDoc.write(iframeContent);
        iframeDoc.close();

        return true;
    }

    /* ----------------------------------------------------------
     * Inject: Google AdSense
     * ---------------------------------------------------------- */
    function _injectAdSense(slot, slotType) {
        var cfg    = AD_CONFIG.adsense;
        var slotId = cfg.slots[slotType];
        if (!slotId) { return false; }

        var ins           = document.createElement('ins');
        ins.className     = 'adsbygoogle';
        ins.style.cssText = [
            'display:block',
            'min-height:90px',
            'width:100%',
            'opacity:0',
            '-webkit-transition:opacity 0.3s',
            'transition:opacity 0.3s'
        ].join(';');
        ins.setAttribute('data-ad-client',             cfg.client_id);
        ins.setAttribute('data-ad-slot',               slotId);
        ins.setAttribute('data-ad-format',             'auto');
        ins.setAttribute('data-full-width-responsive', 'true');

        slot.innerHTML = '';
        slot.appendChild(ins);

        _processPush(slot, 0);
        return true;
    }

    /* ----------------------------------------------------------
     * AdSense push() with zero-width retry guard.
     * AdSense silently fails when the slot has offsetWidth === 0
     * (e.g. inside a hidden container at paint time). Retrying
     * after a short delay gives the layout time to settle.
     * ---------------------------------------------------------- */
    function _processPush(slot, retryCount) {
        if (slot.offsetWidth === 0 && retryCount < AD_CONFIG.options.maxRetries) {
            setTimeout(function () {
                _processPush(slot, retryCount + 1);
            }, AD_CONFIG.options.retryDelay);
            return;
        }
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.warn('[TrustedAds] AdSense push deferred:', e.message);
        }
    }

    /* ----------------------------------------------------------
     * Inject: Custom HTML Ad
     * Scripts inside the HTML string are re-created via
     * createElement to ensure execution across all browsers.
     * ---------------------------------------------------------- */
    function _injectCustom(slot, slotType) {
        var cfg  = AD_CONFIG.custom;
        var html = cfg.slots[slotType];
        if (!html) { return false; }

        var temp = document.createElement('div');
        temp.innerHTML = html;

        slot.innerHTML = '';

        var nodes = temp.childNodes;
        var i, node;
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            if (node.nodeName === 'SCRIPT') {
                _appendScript(slot, {
                    src:  node.src  || null,
                    text: node.src  ? null : (node.text || node.innerHTML),
                    type: node.type || null
                });
            } else {
                slot.appendChild(node.cloneNode(true));
            }
        }
        return true;
    }

    /* ----------------------------------------------------------
     * Core: try each network in priority order for a given slot.
     * Marks the slot with data-ad-loaded to prevent double inject.
     * ---------------------------------------------------------- */
    function _initAd(slot) {
        if (slot.getAttribute('data-ad-loaded') === 'true') { return; }

        var slotType = slot.getAttribute('data-ad-slot');
        if (!slotType) { return; }

        var injected = false;
        var priority = AD_CONFIG.priority;
        var i, network, cfg;

        for (i = 0; i < priority.length; i++) {
            network = priority[i];
            cfg     = AD_CONFIG[network];

            if (!cfg || !cfg.enabled) { continue; }

            if (network === 'adsterra') { injected = _injectAdsterra(slot, slotType); }
            if (network === 'adsense')  { injected = _injectAdSense(slot, slotType);  }
            if (network === 'custom')   { injected = _injectCustom(slot, slotType);   }

            if (injected) {
                slot.setAttribute('data-ad-loaded',  'true');
                slot.setAttribute('data-ad-network', network);
                break;
            }
        }

        // Mark empty so the slot is not retried on future MutationObserver calls
        if (!injected) {
            slot.setAttribute('data-ad-loaded', 'empty');
        }
    }

    /* ----------------------------------------------------------
     * AdBlocker Detection
     * Injects a honeypot element styled like a real ad container.
     * If an adblocker hides it, sets data-adblock="true" on <body>
     * so you can show a polite notice via CSS if desired.
     * ---------------------------------------------------------- */
    function _detectAdBlocker() {
        var bait       = document.createElement('div');
        bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads';
        bait.style.cssText = [
            'position:absolute',
            'top:-9999px',
            'left:-9999px',
            'width:1px',
            'height:1px',
            'pointer-events:none'
        ].join(';');
        document.body.appendChild(bait);

        setTimeout(function () {
            var blocked = (
                !bait.offsetParent    ||
                bait.offsetHeight === 0 ||
                bait.offsetWidth  === 0
            );
            document.body.setAttribute('data-adblock', blocked ? 'true' : 'false');
            if (blocked) {
                console.info('[TrustedAds] AdBlocker detected.');
            }
            if (bait.parentNode) {
                bait.parentNode.removeChild(bait);
            }
        }, 150);
    }

    /* ----------------------------------------------------------
     * Scan: query all unloaded .ad-slot elements and observe or
     * inject them depending on browser IntersectionObserver support.
     * ---------------------------------------------------------- */
    function _run() {
        var slots = document.querySelectorAll(
            '.ad-slot:not([data-ad-loaded="true"]):not([data-ad-loaded="empty"])'
        );
        if (!slots.length) { return; }

        var i;

        if ('IntersectionObserver' in window && AD_CONFIG.options.lazyLoad) {
            // Modern path — inject only when slot enters viewport
            var observer = new IntersectionObserver(function (entries) {
                var j;
                for (j = 0; j < entries.length; j++) {
                    if (entries[j].isIntersecting) {
                        _initAd(entries[j].target);
                        observer.unobserve(entries[j].target);
                    }
                }
            }, { rootMargin: '600px 0px' });

            for (i = 0; i < slots.length; i++) {
                observer.observe(slots[i]);
            }

        } else {
            // Fallback path — inject immediately (IE11, old Android WebView)
            for (i = 0; i < slots.length; i++) {
                _initAd(slots[i]);
            }
        }
    }

    /* ----------------------------------------------------------
     * Public API
     * ---------------------------------------------------------- */
    return {

        /**
         * init()
         * Bootstraps the ad manager. Called by the Firestore
         * bootstrapper below — NOT called directly here anymore.
         */
        init: function () {
            _detectAdBlocker();

            // Wait for DOM if script loads in <head>
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', _run);
            } else {
                _run();
            }

            // Watch for dynamically added .ad-slot elements injected
            // by AJAX, related-tools.js, comments.js, or any other script
            if ('MutationObserver' in window) {
                var bodyObserver = new MutationObserver(function () { _run(); });
                bodyObserver.observe(document.body, {
                    childList: true,
                    subtree:   true
                });
            }
        },

        /**
         * refresh()
         * Manually re-scan the page for new unloaded ad slots.
         * Example: window.TrustedAdManager.refresh()
         */
        refresh: function () { _run(); }

    };

}());

// Expose globally so other scripts can call .refresh()
window.TrustedAdManager = TrustedAdManager;


/* ============================================================
 * SECTION 3 — FIRESTORE BOOTSTRAPPER
 *
 * Execution flow:
 *   1. Safely initialise Firebase (or reuse existing app).
 *   2. Fetch document: Collection "ads", Document "main".
 *   3. Deep-merge the fetched data on top of AD_CONFIG.
 *   4. If adsGlobalEnabled === false in Firestore → abort.
 *   5. Otherwise → call TrustedAdManager.init().
 *
 * Any error in steps 1-3 is silently caught and the engine
 * falls back to the hardcoded AD_CONFIG from Section 1.
 * ============================================================ */

(function () {

    'use strict';

    /* ----------------------------------------------------------
     * _mergeDeep(target, source)
     *
     * Recursively merges `source` into `target`. Only plain
     * objects are merged recursively — arrays and primitives
     * from `source` overwrite `target` directly.
     * This ensures that a partial Firestore document (e.g. one
     * that only stores adsense.client_id) cleanly overwrites
     * just that field without nuking sibling keys that were not
     * included in the saved document.
     * ---------------------------------------------------------- */
    function _mergeDeep(target, source) {
        var key;
        for (key in source) {
            if (!source.hasOwnProperty(key)) { continue; }

            if (
                source[key] !== null &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key]) &&
                target[key] !== null &&
                typeof target[key] === 'object' &&
                !Array.isArray(target[key])
            ) {
                // Both sides are plain objects — recurse
                _mergeDeep(target[key], source[key]);
            } else {
                // Primitive, array, or null — overwrite
                target[key] = source[key];
            }
        }
        return target;
    }

    /* ----------------------------------------------------------
     * _applyFirestoreData(data)
     *
     * Takes the raw Firestore document data object and maps its
     * fields onto AD_CONFIG.
     *
     * Field mapping (mirrors data-ads-field attributes in the UI):
     *
     *   Firestore field              → AD_CONFIG path
     *   ─────────────────────────────────────────────
     *   adsGlobalEnabled             → (abort flag only — not stored in AD_CONFIG)
     *   options.lazyLoad             → AD_CONFIG.options.lazyLoad
     *   options.retryDelay           → AD_CONFIG.options.retryDelay
     *   options.maxRetries           → AD_CONFIG.options.maxRetries
     *   priority                     → AD_CONFIG.priority          (array)
     *   adsterra.enabled             → AD_CONFIG.adsterra.enabled
     *   adsterra.slots               → AD_CONFIG.adsterra.slots    (deep merged)
     *   adsense.enabled              → AD_CONFIG.adsense.enabled
     *   adsense.client_id            → AD_CONFIG.adsense.client_id
     *   adsense.slots                → AD_CONFIG.adsense.slots     (deep merged)
     *   custom.enabled               → AD_CONFIG.custom.enabled
     *   custom.slots                 → AD_CONFIG.custom.slots      (deep merged)
     *
     * The entire `data` object is deep-merged, so any field the
     * dashboard writes to Firestore is automatically picked up
     * without needing to update this mapping.
     * ---------------------------------------------------------- */
    function _applyFirestoreData(data) {
        // Strip the admin-only flag before merging — it has no
        // corresponding key in AD_CONFIG and would pollute it.
        var cleaned = {};
        var key;
        for (key in data) {
            if (!data.hasOwnProperty(key)) { continue; }
            if (key === 'adsGlobalEnabled') { continue; }
            cleaned[key] = data[key];
        }
        _mergeDeep(AD_CONFIG, cleaned);
    }

    /* ----------------------------------------------------------
     * _getFirebaseDb()
     *
     * Initialises Firebase (or reuses an existing app) using the
     * credentials stored in window.SITE_CONFIG.commentSystem.firebase.
     * Returns the Firestore db instance, or null if anything fails.
     * ---------------------------------------------------------- */
    function _getFirebaseDb() {
        try {
            // Guard: firebase SDK must be loaded
            if (typeof firebase === 'undefined') {
                console.warn('[TrustedAds] Firebase SDK not found. Using default AD_CONFIG.');
                return null;
            }

            // Guard: SITE_CONFIG must be available
            if (
                !window.SITE_CONFIG ||
                !window.SITE_CONFIG.commentSystem ||
                !window.SITE_CONFIG.commentSystem.firebase
            ) {
                console.warn('[TrustedAds] window.SITE_CONFIG.commentSystem.firebase not found. Using default AD_CONFIG.');
                return null;
            }

            var fbConfig = window.SITE_CONFIG.commentSystem.firebase;

            // Reuse an existing Firebase app to avoid "duplicate app" errors
            // when multiple scripts on the page initialise Firebase.
            if (!firebase.apps.length) {
                firebase.initializeApp(fbConfig);
            }

            return firebase.firestore();

        } catch (err) {
            console.warn('[TrustedAds] Firebase init error:', err.message, '— Using default AD_CONFIG.');
            return null;
        }
    }

    /* ----------------------------------------------------------
     * _bootstrap()
     *
     * Main entry point. Fetches ads/main from Firestore, merges
     * the result into AD_CONFIG, then decides whether to run
     * the engine or abort based on adsGlobalEnabled.
     * ---------------------------------------------------------- */
    function _bootstrap() {

        var db = _getFirebaseDb();

        // ── No Firebase available → run immediately on defaults ──
        if (!db) {
            TrustedAdManager.init();
            return;
        }

        // ── Attempt Firestore fetch ──────────────────────────────
        db.collection('ads').doc('main').get()

            .then(function (docSnapshot) {

                if (docSnapshot.exists) {
                    var data = docSnapshot.data();

                    // Rule 4c: if admin explicitly disabled all ads, abort.
                    if (data.adsGlobalEnabled === false) {
                        console.info('[TrustedAds] Ads globally disabled via Firestore. Engine not started.');
                        return; // ← exit the .then() without calling init()
                    }

                    // Merge Firestore data on top of default AD_CONFIG
                    _applyFirestoreData(data);
                    console.info('[TrustedAds] Configuration loaded from Firestore (ads/main).');

                } else {
                    // Document doesn't exist yet — use hardcoded defaults
                    console.info('[TrustedAds] Firestore document ads/main not found. Using default AD_CONFIG.');
                }

                // Start the engine with whichever config we ended up with
                TrustedAdManager.init();

            })

            .catch(function (err) {
                // Network error, permission denied, adblocker blocking Firebase, etc.
                // Fall back to default config and run anyway — ads > no ads.
                console.warn('[TrustedAds] Firestore fetch failed (' + err.message + '). Using default AD_CONFIG.');
                TrustedAdManager.init();
            });
    }

    // Kick off the bootstrapper immediately on script load.
    _bootstrap();

}());
