/*!
 * ============================================================
 * Plugin Name:  Trusted Tools Web — Pro Ad Manager
 * Plugin URI:   https://trustedtoolsweb.com
 * Version:      6.0.0
 * Author:       MD KAWSAR
 * Author URI:   https://trustedtoolsweb.com
 * License:      CodeCanyon Regular / Extended License
 * Description:  Multi-network ad injection engine with Firebase
 *               dynamic configuration, lazy loading, zero-width
 *               retry, mutation recovery, and AdBlocker detection.
 *               Compatible with all modern browsers, legacy
 *               Android WebView, and SPCK Editor preview environment.
 * ============================================================
 *
 * Supported Networks:
 *   - Adsterra  (Banner)
 *   - Google AdSense
 *   - Custom HTML Ads
 *
 * Usage:
 *   1. Drop this file into: assets/js/trusted-ad-manager.js
 *   2. Add to every HTML page before </body>:
 *        <script src="../../assets/js/trusted-ad-manager.js"></script>
 *   3. Place ad slots anywhere in your HTML:
 *        <div class="ad-slot" data-ad-slot="header"></div>
 *        <div class="ad-slot" data-ad-slot="footer"></div>
 *        <div class="ad-slot" data-ad-slot="sidebar"></div>
 *
 * Firestore document:  ads/main
 *   Fields consumed:
 *     globalEnabled        (boolean) — master kill switch
 *     adNetwork            (string)  — "adsterra" | "adsense" | "custom"
 *     publisherId          (string)  — AdSense ca-pub-XXXX or Adsterra key
 *     headerAd             (string)  — Raw HTML/JS for the header slot
 *     footerAd             (string)  — Raw HTML/JS for the footer slot
 *     sidebarAd            (string)  — Raw HTML/JS for the sidebar slot
 *     slotHeaderEnabled    (boolean) — individual header slot toggle
 *     slotFooterEnabled    (boolean) — individual footer slot toggle
 *     slotSidebarEnabled   (boolean) — individual sidebar slot toggle
 *
 * Public API:
 *   TrustedAdManager.refresh()  — re-scan for new slots
 * ============================================================
 */

/* global window, document, firebase */

/* ============================================================
 * SECTION 1 — STATIC FALLBACK AD CONFIGURATION
 *
 * These values are used ONLY if the Firestore fetch fails or
 * returns no data. Update them as your local defaults.
 * The live Firestore values from the admin panel take priority.
 * ============================================================ */

var AD_CONFIG = {

    // ── Network 1: Adsterra ───────────────────────────────────
    adsterra: {
        enabled: false,            // Controlled by Firestore globalEnabled
        slots: {
            'header':  {
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
            'footer': {
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
        enabled:   false,
        client_id: 'ca-pub-XXXXXXXXXXXXXXXX',
        slots: {
            'header':  '',
            'footer':  '',
            'sidebar': ''
        }
    },

    // ── Network 3: Custom HTML Ad ─────────────────────────────
    //
    // This is the PRIMARY network driven by Firestore.
    // The admin panel saves raw HTML strings (headerAd, footerAd,
    // sidebarAd) which are loaded here at runtime.
    custom: {
        enabled: false,
        slots: {
            'header':  '',
            'footer':  '',
            'sidebar': ''
        }
    },

    // ── Slot-level enable flags (mirrored from Firestore) ─────
    //
    // Each flag corresponds to a Firestore boolean field.
    // Defaults to false — Firestore must explicitly enable each slot.
    slots: {
        header:  false,
        footer:  false,
        sidebar: false
    },

    // ── Priority — first enabled network with a matching slot wins
    priority: ['custom', 'adsense', 'adsterra'],

    // ── Global Options ────────────────────────────────────────
    options: {
        lazyLoad:   false,  // Use IntersectionObserver when available
        retryDelay: 500,    // Milliseconds between zero-width retries
        maxRetries: 3       // Maximum retry attempts per slot
    }

};


/* ============================================================
 * SECTION 2 — FIREBASE CONFIGURATION LOADER
 *
 * Fetches the Firestore document  ads/main  and merges the
 * live values into AD_CONFIG before any ad injection runs.
 *
 * Returns a Promise<boolean>:
 *   true  — config loaded and globalEnabled is true
 *   false — fetch failed, document missing, or globalEnabled false
 * ============================================================ */

/**
 * Fetches ads/main from Firestore, merges fields into AD_CONFIG,
 * and returns whether ad injection should proceed.
 *
 * Safe to call even if Firebase is not initialised:
 * returns false (no ads) so the page is never broken.
 *
 * @returns {Promise<boolean>}
 */
function _loadFirestoreAdConfig() {
    return new Promise(function (resolve) {

        // ── Guard: Firebase must be available ─────────────────
        if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
            console.warn('[TrustedAds] Firebase not available — ad injection disabled.');
            return resolve(false);
        }

        var db = firebase.firestore();

        db.collection('ads').doc('main').get()

            .then(function (docSnap) {

                // ── Document missing → no ads ─────────────────
                if (!docSnap.exists) {
                    console.info('[TrustedAds] ads/main not found in Firestore — no ads injected.');
                    return resolve(false);
                }

                var data = docSnap.data();

                // ── Master kill switch ────────────────────────
                if (data.globalEnabled !== true) {
                    console.info('[TrustedAds] globalEnabled is false — all ad injection aborted.');
                    return resolve(false);
                }

                /* ── Determine active network ──────────────────
                   The admin sets adNetwork to one of:
                   "adsterra" | "adsense" | "custom"
                   We enable ONLY that network and disable the others,
                   then push the Firestore HTML/key data into it.
                ─────────────────────────────────────────────── */
                var network = (typeof data.adNetwork === 'string')
                    ? data.adNetwork.toLowerCase().trim()
                    : 'custom';

                // Disable all networks first, then enable the chosen one
                AD_CONFIG.adsterra.enabled = false;
                AD_CONFIG.adsense.enabled  = false;
                AD_CONFIG.custom.enabled   = false;

                // Bubble the chosen network to the front of priority
                AD_CONFIG.priority = [network, 'adsense', 'adsterra', 'custom']
                    .filter(function (v, i, a) { return a.indexOf(v) === i; }); // deduplicate

                if (network === 'custom') {
                    /* ── Custom HTML network ───────────────────
                       headerAd / footerAd / sidebarAd are raw HTML
                       strings pasted or generated in the admin panel.
                    ─────────────────────────────────────────── */
                    AD_CONFIG.custom.enabled        = true;
                    AD_CONFIG.custom.slots.header   = (typeof data.headerAd  === 'string') ? data.headerAd  : '';
                    AD_CONFIG.custom.slots.footer   = (typeof data.footerAd  === 'string') ? data.footerAd  : '';
                    AD_CONFIG.custom.slots.sidebar  = (typeof data.sidebarAd === 'string') ? data.sidebarAd : '';

                } else if (network === 'adsense') {
                    /* ── Google AdSense network ────────────────
                       publisherId maps to client_id.
                       Slot IDs can optionally come from Firestore
                       headerAd / footerAd / sidebarAd fields if the
                       admin stores the numeric slot IDs there.
                    ─────────────────────────────────────────── */
                    AD_CONFIG.adsense.enabled = true;
                    if (typeof data.publisherId === 'string' && data.publisherId.trim()) {
                        AD_CONFIG.adsense.client_id = data.publisherId.trim();
                    }
                    // Allow Firestore to override individual slot IDs
                    if (typeof data.headerAd  === 'string' && data.headerAd.trim())  { AD_CONFIG.adsense.slots.header  = data.headerAd.trim();  }
                    if (typeof data.footerAd  === 'string' && data.footerAd.trim())  { AD_CONFIG.adsense.slots.footer  = data.footerAd.trim();  }
                    if (typeof data.sidebarAd === 'string' && data.sidebarAd.trim()) { AD_CONFIG.adsense.slots.sidebar = data.sidebarAd.trim(); }

                } else if (network === 'adsterra') {
                    /* ── Adsterra network ──────────────────────
                       publisherId maps to the Adsterra key.
                       If the admin stores the full invoke.js URL in
                       headerAd / footerAd / sidebarAd, we use them
                       as the src for each slot.
                    ─────────────────────────────────────────── */
                    AD_CONFIG.adsterra.enabled = true;
                    var aKey = (typeof data.publisherId === 'string') ? data.publisherId.trim() : '';

                    // Update key + src only if the admin supplied a publisher ID
                    if (aKey) {
                        ['header', 'footer', 'sidebar'].forEach(function (sName) {
                            var slotCfg = AD_CONFIG.adsterra.slots[sName];
                            if (slotCfg) {
                                slotCfg.atOptions['key'] = aKey;
                                slotCfg.src = 'https://www.highperformanceformat.com/' + aKey + '/invoke.js';
                            }
                        });
                    }

                    // Allow raw HTML overrides for Adsterra slots via the custom mechanism
                    if (typeof data.headerAd  === 'string' && data.headerAd.trim())  { AD_CONFIG.custom.slots.header  = data.headerAd.trim();  AD_CONFIG.custom.enabled = true; }
                    if (typeof data.footerAd  === 'string' && data.footerAd.trim())  { AD_CONFIG.custom.slots.footer  = data.footerAd.trim();  AD_CONFIG.custom.enabled = true; }
                    if (typeof data.sidebarAd === 'string' && data.sidebarAd.trim()) { AD_CONFIG.custom.slots.sidebar = data.sidebarAd.trim(); AD_CONFIG.custom.enabled = true; }
                }

                /* ── Per-slot enable flags ─────────────────────
                   Each slot is gated by its own boolean in Firestore.
                   If the field is missing/non-boolean it defaults to
                   false (conservative — never show an unwanted ad).
                ─────────────────────────────────────────────── */
                AD_CONFIG.slots.header  = data.slotHeaderEnabled  === true;
                AD_CONFIG.slots.footer  = data.slotFooterEnabled  === true;
                AD_CONFIG.slots.sidebar = data.slotSidebarEnabled === true;

                console.log('[TrustedAds] ✅ Firestore config merged. Network:', network,
                    '| Slots:', AD_CONFIG.slots);

                resolve(true);
            })

            .catch(function (err) {
                // Network error, permission denied, etc.
                // Fail safe: no ads rather than a broken page.
                console.error('[TrustedAds] Firestore fetch failed — no ads injected.', err);
                resolve(false);
            });
    });
}


/* ============================================================
 * SECTION 3 — CORE ENGINE
 * Do not edit below this line unless you know what you are doing.
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

        var iframe = document.createElement('iframe');
        iframe.width       = slotCfg.width  || 300;
        iframe.height      = slotCfg.height || 250;
        iframe.frameBorder = '0';
        iframe.scrolling   = 'no';
        iframe.style.cssText = 'border:none; overflow:hidden; display:block; margin:0 auto; background:transparent;';

        slot.innerHTML = '';
        slot.appendChild(iframe);

        // Note: closing script tags are split ('</scr' + 'ipt>') to prevent
        // the browser parser from closing the main document script prematurely.
        var iframeContent =
            '<!DOCTYPE html><html><head>' +
            '<style>body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden;background:transparent;}</style>' +
            '</head><body>' +
            '<script type="text/javascript">' +
            'var atOptions = ' + JSON.stringify(slotCfg.atOptions) + ';' +
            '</scr' + 'ipt>' +
            '<script type="text/javascript" src="' + slotCfg.src + '"></scr' + 'ipt>' +
            '</body></html>';

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
     *
     * NEW — per-slot gate:
     *   Before any network injection is attempted, we check
     *   AD_CONFIG.slots[slotType]. If the admin has not enabled
     *   this specific slot in Firestore, _initAd marks it empty
     *   immediately and returns without injecting anything.
     *
     * Marks the slot with data-ad-loaded to prevent double inject.
     * ---------------------------------------------------------- */
    function _initAd(slot) {
        if (slot.getAttribute('data-ad-loaded') === 'true')  { return; }
        if (slot.getAttribute('data-ad-loaded') === 'empty') { return; }

        var slotType = slot.getAttribute('data-ad-slot');
        if (!slotType) { return; }

        // ── Per-slot enable check (driven by Firestore) ───────
        if (AD_CONFIG.slots[slotType] !== true) {
            slot.setAttribute('data-ad-loaded', 'empty');
            console.info('[TrustedAds] Slot "' + slotType + '" is disabled — skipping.');
            return;
        }

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
                !bait.offsetParent      ||
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
     *
     * This function is called ONLY after the Firestore fetch resolves,
     * so AD_CONFIG already contains the live admin panel values.
     * The MutationObserver also calls this function — by the time
     * any dynamically added slots appear, the config is ready.
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
         * Bootstraps the ad manager. Called automatically at the
         * bottom of this file — no manual call needed in HTML.
         *
         * Flow:
         *   1. AdBlocker detection runs immediately (no config needed).
         *   2. Firestore fetch begins in parallel with DOM readiness.
         *   3. Once BOTH are satisfied, _run() fires.
         *   4. MutationObserver starts watching only after Firestore
         *      is resolved, so every dynamically added slot is also
         *      gated on the live config.
         */
        init: function () {

            // ── AdBlocker detection runs immediately ──────────
            // It only needs document.body and a setTimeout — no
            // ad config required.  We attach it to DOMContentLoaded
            // if the DOM isn't ready yet.
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', _detectAdBlocker);
            } else {
                _detectAdBlocker();
            }

            /* ── Wait for: DOM ready  AND  Firestore config ────
             *
             * We build two promises and settle them in parallel:
             *
             *   domReady      — resolves when DOMContentLoaded fires
             *                   (or immediately if DOM is already ready)
             *   firestoreReady — resolves with true/false from
             *                   _loadFirestoreAdConfig()
             *
             * Promise.all waits for both. If Firestore says
             * globalEnabled is false (resolves with false), we abort
             * without calling _run() or starting MutationObserver.
             * ─────────────────────────────────────────────────── */
            var domReady = new Promise(function (resolve) {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', resolve, { once: true });
                } else {
                    resolve();
                }
            });

            var firestoreReady = _loadFirestoreAdConfig();

            Promise.all([domReady, firestoreReady])

                .then(function (results) {
                    var adsEnabled = results[1]; // boolean from _loadFirestoreAdConfig

                    if (!adsEnabled) {
                        console.info('[TrustedAds] Ad injection skipped — globalEnabled is false or fetch failed.');
                        return; // Do NOT start MutationObserver or call _run()
                    }

                    // ── First scan of existing slots ──────────
                    _run();

                    // ── Watch for dynamically added .ad-slot elements
                    // injected by AJAX, related-tools.js, comments.js,
                    // or any other script. Starts AFTER Firestore config
                    // is confirmed ready — no race condition possible.
                    if ('MutationObserver' in window) {
                        var bodyObserver = new MutationObserver(function () {
                            _run();
                        });
                        bodyObserver.observe(document.body, {
                            childList: true,
                            subtree:   true
                        });
                    }
                })

                .catch(function (err) {
                    // Promise.all itself should not reject (both inner
                    // promises resolve, never reject), but be defensive.
                    console.error('[TrustedAds] Unexpected init error — no ads injected.', err);
                });
        },

        /**
         * refresh()
         * Manually re-scan the page for new unloaded ad slots.
         * Safe to call at any time — if config isn't ready yet,
         * slots will still be unloaded and _run() will catch them
         * when the Promise.all resolves.
         *
         * Example: TrustedAdManager.refresh()
         */
        refresh: function () { _run(); }

    };

}());

// Auto-initialize on script load
TrustedAdManager.init();
