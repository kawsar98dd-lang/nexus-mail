/**
 * ============================================================
 * PWA Studio PRO MAX — script.js
 * Tool     : dev-pwa-studio | Trusted Tools Web
 * Author   : MD KAWSAR
 * Version  : 1.0.0
 *
 * Architecture Overview:
 * ─────────────────────────────────────────────────────────────
 *  PwaConfig        : Reads all form field values and validates them.
 *  IconResizer      : Canvas API — loads, resizes, and previews icons.
 *  ManifestBuilder  : Assembles the manifest.json object → JSON string.
 *  SwBuilder        : Generates service worker code based on chosen strategy.
 *  OfflineBuilder   : Generates a branded offline.html fallback page.
 *  ZipExporter      : Bundles all assets into a ZIP via JSZip + FileSaver.
 *  PreviewManager   : Keeps the device mockups and manifest panel in sync.
 *  ChecklistManager : Updates the six PWA readiness checklist indicators.
 *  ProgressController: Shows/hides and updates the generation progress bar.
 *  UIController     : Wires all events, initialises all modules on DOMContentLoaded.
 *
 * Toast Notifications:
 *   All toasts are dispatched via the global window.showToast() provided
 *   by global.js.  Signature: window.showToast(message, isError?).
 *   Pass boolean true as the second argument for error-type toasts.
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
   ICON_SIZES — The three standard PWA icon dimensions required by the
   Web App Manifest specification for full browser/OS compatibility.
───────────────────────────────────────────────────────────────────────────── */
const ICON_SIZES = [512, 192, 144];

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: PwaConfig
   Responsible for reading the current state of every form field and returning
   a clean configuration object. Also exposes a validate() method that checks
   required fields and business rules before the ZIP export can proceed.
───────────────────────────────────────────────────────────────────────────── */
const PwaConfig = {

    /**
     * get()
     * Reads all configuration inputs and returns a flat config object.
     * Checkbox values are coerced to booleans via .checked.
     * Text inputs are .trim()-ed to remove accidental whitespace.
     * Fallback defaults are applied inline (e.g., '/' for startUrl).
     *
     * @returns {Object} cfg — Complete PWA configuration snapshot.
     */
    get() {
        return {
            appName            : document.getElementById('appName').value.trim(),
            shortName          : document.getElementById('shortName').value.trim(),
            appDescription     : document.getElementById('appDescription').value.trim(),
            startUrl           : document.getElementById('startUrl').value.trim() || '/',
            appScope           : document.getElementById('appScope').value.trim() || '/',
            themeColor         : document.getElementById('themeColor').value,
            bgColor            : document.getElementById('bgColor').value,
            displayMode        : document.getElementById('displayMode').value,
            orientation        : document.getElementById('orientation').value,
            appCategory        : document.getElementById('appCategory').value,
            lang               : document.getElementById('lang').value,
            cacheStrategy      : document.getElementById('cacheStrategy').value,
            cacheName          : document.getElementById('cacheName').value.trim() || 'pwa-cache-v1',
            shareTarget        : document.getElementById('shareTarget').checked,
            appBadging         : document.getElementById('appBadging').checked,
            protocolHandler    : document.getElementById('protocolHandler').checked,
            includeScreenshots : document.getElementById('includeScreenshots').checked,
        };
    },

    /**
     * validate(cfg)
     * Runs a set of business-rule checks against the config object.
     * Returns an array of human-readable error strings. An empty array
     * means the config is valid and export can proceed.
     *
     * Rules:
     *  - appName must not be empty.
     *  - shortName must not be empty and must be ≤12 characters
     *    (PWA specification limit for home screen display).
     *  - startUrl must not be empty.
     *
     * @param   {Object}   cfg    Configuration object from get().
     * @returns {string[]} errors Array of validation error messages.
     */
    validate(cfg) {
        const errors = [];
        if (!cfg.appName)                           errors.push('App Name is required.');
        if (!cfg.shortName)                         errors.push('Short Name is required.');
        if (cfg.shortName.length > 12)              errors.push('Short Name must be 12 characters or fewer.');
        if (!cfg.startUrl)                          errors.push('Start URL is required.');
        return errors;
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: IconResizer
   Uses the HTML5 Canvas API to load an image file uploaded by the user,
   then resizes it to each required PWA icon dimension (512, 192, 144 px)
   and returns PNG Blob objects ready for inclusion in the ZIP file.
   Stores the original Image object in `sourceImage` so any number of
   resize operations can be performed without re-reading the file.
───────────────────────────────────────────────────────────────────────────── */
const IconResizer = {

    /** @type {HTMLImageElement|null} The original loaded source image object. */
    sourceImage: null,

    /**
     * loadFromFile(file)
     * Reads an image file via FileReader and creates an HTMLImageElement.
     * Validates that the file is an image type before reading.
     * Stores the resulting image in this.sourceImage for subsequent resizes.
     *
     * @param   {File}    file  The image file selected by the user.
     * @returns {Promise<HTMLImageElement>} Resolves with the loaded image.
     */
    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                return reject(new Error('Invalid file type. Please upload a PNG, JPEG, or WebP image.'));
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    this.sourceImage = img;
                    resolve(img);
                };

                img.onerror = () => reject(new Error('Failed to load image.'));
                img.src = e.target.result;
            };

            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsDataURL(file);
        });
    },

    /**
     * resizeTo(size)
     * Creates an off-screen canvas of (size × size) pixels, draws the
     * source image into it with high-quality smoothing enabled, then
     * exports the result as a PNG Blob at full quality (1.0).
     *
     * @param   {number}          size  Target width and height in pixels.
     * @returns {Promise<Blob|null>}    PNG Blob or null if no source loaded.
     */
    resizeTo(size) {
        return new Promise((resolve) => {
            if (!this.sourceImage) return resolve(null);

            const canvas = document.createElement('canvas');
            canvas.width  = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            /* Enable high-quality bicubic resampling for sharp icon output */
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            /* Draw source image scaled to fill the square canvas exactly */
            ctx.drawImage(this.sourceImage, 0, 0, size, size);

            canvas.toBlob(resolve, 'image/png', 1.0);
        });
    },

    /**
     * generateAll()
     * Iterates over ICON_SIZES and calls resizeTo() for each dimension.
     * Returns an array of objects each containing { size, blob } so the
     * ZipExporter can name and store each icon file correctly.
     *
     * @returns {Promise<Array<{size: number, blob: Blob}>>}
     */
    async generateAll() {
        const results = [];
        for (const size of ICON_SIZES) {
            const blob = await this.resizeTo(size);
            results.push({ size, blob });
        }
        return results;
    },

    /**
     * getPreviewDataUrl(size)
     * Generates a small data URL for thumbnail preview in the upload zone.
     * Defaults to 128 px — large enough for the 56 px UI preview but small
     * enough to not bloat memory usage.
     *
     * @param   {number} [size=128] Preview dimension in pixels.
     * @returns {string|null}       Base-64 PNG data URL or null if no source.
     */
    getPreviewDataUrl(size = 128) {
        if (!this.sourceImage) return null;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this.sourceImage, 0, 0, size, size);
        return canvas.toDataURL('image/png');
    },

    /**
     * clear()
     * Resets the stored source image to null.
     * Called when the user removes the uploaded icon via the Remove button.
     */
    clear() { this.sourceImage = null; }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: ManifestBuilder
   Constructs the Web App Manifest JSON string from the user's configuration.
   Conditionally includes optional spec fields (share_target, permissions,
   protocol_handlers, screenshots) based on the toggle states.
───────────────────────────────────────────────────────────────────────────── */
const ManifestBuilder = {

    /**
     * build(cfg, hasIcons)
     * Builds the complete manifest object and serialises it to a
     * nicely indented JSON string (2-space indent for readability).
     *
     * If `hasIcons` is true, a full icon array is generated from ICON_SIZES.
     * Otherwise, placeholder icon entries are included so the manifest
     * remains spec-compliant even without an uploaded image.
     *
     * @param   {Object}  cfg      Configuration object from PwaConfig.get().
     * @param   {boolean} hasIcons Whether an icon has been uploaded.
     * @returns {string}           Indented manifest.json content string.
     */
    build(cfg, hasIcons = false) {
        const manifest = {
            name             : cfg.appName  || 'My App',
            short_name       : cfg.shortName || 'App',
            description      : cfg.appDescription || '',
            lang             : cfg.lang,
            start_url        : cfg.startUrl,
            scope            : cfg.appScope,
            display          : cfg.displayMode,
            orientation      : cfg.orientation,
            theme_color      : cfg.themeColor,
            background_color : cfg.bgColor,
            categories       : [cfg.appCategory],

            /*
             * Icon array — when an icon is uploaded, all three PWA-required
             * dimensions are listed with the correct `purpose` field.
             * The 512px icon is marked "any maskable" for adaptive icon
             * support on Android. Smaller icons use "any".
             */
            icons: hasIcons
                ? ICON_SIZES.map(size => ({
                    src     : `/icons/icon-${size}x${size}.png`,
                    sizes   : `${size}x${size}`,
                    type    : 'image/png',
                    purpose : size >= 512 ? 'any maskable' : 'any'
                }))
                : [
                    { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ],
        };

        /*
         * OPTIONAL: Web Share Target API
         * Adds the share_target field which registers the PWA as a system-level
         * share destination. Requires server-side handling at share_target.action.
         */
        if (cfg.shareTarget) {
            manifest.share_target = {
                action  : '/share-target/',
                method  : 'GET',
                enctype : 'application/x-www-form-urlencoded',
                params  : { title: 'title', text: 'text', url: 'url' }
            };
        }

        /*
         * OPTIONAL: App Badging API
         * Declares "badge" in the permissions array so the PWA can display
         * numeric notification badges on the home screen / taskbar icon.
         * Also sets handle_links to "preferred" for intent handling.
         */
        if (cfg.appBadging) {
            manifest.permissions = manifest.permissions || [];
            manifest.permissions.push('badge');
            manifest.handle_links = 'preferred';
        }

        /*
         * OPTIONAL: Protocol Handler
         * Registers a custom URL scheme (e.g., "web+myapp://") so the OS
         * can route matching URLs directly to this installed PWA.
         */
        if (cfg.protocolHandler) {
            manifest.protocol_handlers = [{
                protocol : `web+${(cfg.appName || 'app').toLowerCase().replace(/\s+/g, '')}`,
                url      : `${cfg.startUrl}?protocol=%s`
            }];
        }

        /*
         * OPTIONAL: Screenshots
         * Placeholder screenshot entries for app-store-style install dialogs.
         * The developer must replace src paths with real screenshot images.
         */
        if (cfg.includeScreenshots) {
            manifest.screenshots = [
                { src: '/screenshots/screenshot-desktop.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide',   label: `${cfg.appName} Desktop View` },
                { src: '/screenshots/screenshot-mobile.png',  sizes: '390x844',  type: 'image/png', form_factor: 'narrow', label: `${cfg.appName} Mobile View`  }
            ];
        }

        /*
         * prefer_related_applications: false
         * Tells the browser to prefer the web app over any native app,
         * ensuring the PWA install prompt is shown when criteria are met.
         */
        manifest.prefer_related_applications = false;

        /* Clean up empty description to avoid an empty string in the output */
        if (!manifest.description) delete manifest.description;

        return JSON.stringify(manifest, null, 2);
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: SwBuilder
   Generates the service worker (sw.js) source code string based on the
   user's chosen caching strategy. Supports three strategies:
     1. Cache First          — Speed-optimised; serves cache, falls back to network.
     2. Network First        — Freshness-optimised; fetches network, falls back to cache.
     3. Stale While Revalidate — Immediate cache serve + background cache refresh.
   All strategies include a full offline fallback that serves offline.html
   for navigation requests when both cache and network are unavailable.
───────────────────────────────────────────────────────────────────────────── */
const SwBuilder = {

    /**
     * build(cfg)
     * Generates the complete sw.js file content as a string.
     * The fetch event handler body is conditionally constructed
     * based on cfg.cacheStrategy.
     *
     * @param   {Object} cfg  Configuration object from PwaConfig.get().
     * @returns {string}      Complete service worker source code.
     */
    build(cfg) {
        const cacheName = cfg.cacheName;
        const strategy  = cfg.cacheStrategy;

        /*
         * Precache asset list — these URLs are added to the cache during the
         * install event so they are available offline immediately.
         * Null entries (when startUrl === '/') are filtered out to avoid duplicates.
         */
        const precacheAssets = JSON.stringify([
            '/',
            cfg.startUrl !== '/' ? cfg.startUrl : null,
            '/offline.html',
            '/manifest.json',
            ...ICON_SIZES.map(s => `/icons/icon-${s}x${s}.png`)
        ].filter(Boolean), null, 2);

        /* Build the fetch strategy logic block based on user selection */
        let fetchLogic = '';

        if (strategy === 'cache-first') {
            fetchLogic = `
    // ── Cache First Strategy ──────────────────────────────
    // Serve from cache if available, network as fallback.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                // Return cached version immediately
                return cachedResponse;
            }
            // Not in cache: fetch from network and cache it
            return fetch(event.request).then(networkResponse => {
                if (
                    !networkResponse ||
                    networkResponse.status !== 200 ||
                    networkResponse.type === 'opaque'
                ) {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // Network failed: serve offline page for navigate requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html');
                }
            });
        })
    );`;
        } else if (strategy === 'network-first') {
            fetchLogic = `
    // ── Network First Strategy ────────────────────────────
    // Try network first, cache as fallback.
    event.respondWith(
        fetch(event.request).then(networkResponse => {
            if (
                networkResponse &&
                networkResponse.status === 200 &&
                networkResponse.type !== 'opaque'
            ) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        }).catch(() => {
            // Network unavailable: try cache
            return caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                // Ultimate fallback: offline page
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html');
                }
            });
        })
    );`;
        } else {
            /* Stale While Revalidate strategy */
            fetchLogic = `
    // ── Stale-While-Revalidate Strategy ──────────────────
    // Serve from cache immediately, update cache in background.
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(cachedResponse => {
                const networkFetch = fetch(event.request).then(networkResponse => {
                    if (
                        networkResponse &&
                        networkResponse.status === 200 &&
                        networkResponse.type !== 'opaque'
                    ) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                });
                // Return cached immediately, or wait for network
                return cachedResponse || networkFetch;
            });
        })
    );`;
        }

        /* Assemble the complete sw.js file string */
        return `/**
 * Service Worker — Generated by PWA Studio PRO MAX
 * App: ${cfg.appName || 'My App'}
 * Strategy: ${strategy}
 * Cache: ${cacheName}
 * Generated: ${new Date().toISOString()}
 * https://trustedtoolsweb.com
 */

'use strict';

const CACHE_NAME = '${cacheName}';
const OFFLINE_URL = '/offline.html';

// Assets to precache on install
const PRECACHE_ASSETS = ${precacheAssets};

/* ── Install Event ────────────────────────────────────── */
self.addEventListener('install', event => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Precaching assets...');
            return cache.addAll(PRECACHE_ASSETS.filter(url => url !== null));
        }).then(() => {
            console.log('[SW] Precache complete. Activating immediately.');
            return self.skipWaiting();
        })
    );
});

/* ── Activate Event ───────────────────────────────────── */
self.addEventListener('activate', event => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Claiming clients...');
            return self.clients.claim();
        })
    );
});

/* ── Fetch Event ──────────────────────────────────────── */
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;
    // Skip chrome-extension and non-http(s) requests
    if (!event.request.url.startsWith('http')) return;
${fetchLogic}
});

/* ── Background Sync (future-ready) ──────────────────── */
self.addEventListener('sync', event => {
    console.log('[SW] Background sync event:', event.tag);
    // Add your background sync logic here
});

/* ── Push Notifications (future-ready) ───────────────── */
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || '${cfg.appName || 'My App'}';
    const options = {
        body: data.body || 'You have a new notification.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-144x144.png',
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

/* ── Notification Click ───────────────────────────────── */
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url === targetUrl && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});
`;
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: OfflineBuilder
   Generates the offline.html fallback page that the service worker serves
   when both the cache and network are unavailable. The page is fully
   self-contained (inlined CSS + script) and branded with the user's chosen
   theme color and background color for visual consistency with the PWA.
───────────────────────────────────────────────────────────────────────────── */
const OfflineBuilder = {

    /**
     * build(cfg)
     * Generates the complete offline.html file as a string.
     * Automatically detects whether the background color is dark or light
     * and adjusts foreground text colors for readability.
     *
     * @param   {Object} cfg  Configuration object from PwaConfig.get().
     * @returns {string}      Complete offline.html file content.
     */
    build(cfg) {
        const name    = cfg.appName    || 'My App';
        const theme   = cfg.themeColor || '#10b981';
        const bg      = cfg.bgColor    || '#0f172a';
        const isDark  = this._isDark(bg);

        /* Adaptive text colors based on background luminance */
        const textCol = isDark ? '#e8f4f1' : '#0f2033';
        const subCol  = isDark ? '#8eadb8' : '#3d5a72';
        const cardBg  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

        return `<!DOCTYPE html>
<html lang="${cfg.lang || 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Offline — ${name}</title>
    <meta name="theme-color" content="${theme}">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: ${bg};
            color: ${textCol};
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            text-align: center;
        }
        .offline-card {
            max-width: 420px;
            width: 100%;
            background: ${cardBg};
            border: 1px solid ${theme}33;
            border-radius: 20px;
            padding: 48px 36px;
            backdrop-filter: blur(12px);
        }
        .offline-icon {
            width: 80px; height: 80px;
            border-radius: 20px;
            background: ${theme}20;
            border: 2px solid ${theme}40;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 28px;
            font-size: 2.2rem;
        }
        h1 { font-size: 1.6rem; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.02em; }
        p { font-size: 0.9rem; color: ${subCol}; line-height: 1.7; margin-bottom: 28px; }
        .retry-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: ${theme};
            color: #fff;
            border: none;
            padding: 13px 28px;
            border-radius: 10px;
            font-size: 0.9rem;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
            transition: opacity 0.2s, transform 0.2s;
            box-shadow: 0 4px 16px ${theme}44;
            text-decoration: none;
        }
        .retry-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .app-name { font-size: 0.8rem; color: ${theme}; font-weight: 600; margin-top: 28px; letter-spacing: 0.05em; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .offline-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1.5s ease-in-out infinite; margin-right: 6px; }
    </style>
</head>
<body>
    <div class="offline-card">
        <div class="offline-icon">📡</div>
        <h1>You're Offline</h1>
        <p>
            <span class="offline-dot"></span>
            No internet connection detected.<br>
            Check your connection and try again.
        </p>
        <button class="retry-btn" onclick="window.location.reload()">
            ↺ Try Again
        </button>
        <p class="app-name">${name}</p>
    </div>
    <script>
        // Auto-retry when connection is restored
        window.addEventListener('online', () => window.location.reload());
    <\/script>
</body>
</html>`;
    },

    /**
     * _isDark(hex)
     * Calculates the relative luminance of a hex color using the
     * ITU-R BT.601 luma formula. Returns true when the color is dark
     * (luminance < 0.5), signalling that light text should be used.
     *
     * @param   {string}  hex  6-digit hex color string (e.g. "#0f172a").
     * @returns {boolean}      True if the color is dark.
     */
    _isDark(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: ZipExporter
   Orchestrates the full export pipeline:
     1. Generates manifest.json string via ManifestBuilder.
     2. Generates sw.js string via SwBuilder.
     3. Generates offline.html string via OfflineBuilder.
     4. Resizes uploaded icon (if any) to all required sizes via IconResizer.
     5. Adds a HOW-TO-INSTALL.txt readme file.
     6. Compresses all assets into a ZIP blob via JSZip.
     7. Triggers download via FileSaver.js (saveAs).
   Exposes an onProgress callback so ProgressController can display real-time
   status updates during the asynchronous generation process.
───────────────────────────────────────────────────────────────────────────── */
const ZipExporter = {

    /**
     * export(cfg, onProgress)
     * Main export entry point. Async — resolves true on success.
     * Calls onProgress(label, percent) at each major step to update the UI.
     *
     * @param   {Object}   cfg         Configuration object from PwaConfig.get().
     * @param   {Function} onProgress  Callback(label: string, percent: number).
     * @returns {Promise<boolean>}     Resolves true when download is triggered.
     */
    async export(cfg, onProgress) {
        const zip = new JSZip();

        /* ── Step 1: manifest.json ── */
        onProgress('Generating manifest.json…', 10);
        const hasIcons    = !!IconResizer.sourceImage;
        const manifestStr = ManifestBuilder.build(cfg, hasIcons);
        zip.file('manifest.json', manifestStr);

        /* ── Step 2: sw.js ── */
        onProgress('Generating service worker…', 25);
        const swStr = SwBuilder.build(cfg);
        zip.file('sw.js', swStr);

        /* ── Step 3: offline.html ── */
        onProgress('Generating offline page…', 40);
        const offlineStr = OfflineBuilder.build(cfg);
        zip.file('offline.html', offlineStr);

        /* ── Step 4: Icons (Canvas-resized PNG blobs) ── */
        if (hasIcons) {
            onProgress('Resizing icons (512px)…', 55);
            const icons = await IconResizer.generateAll();

            const iconsFolder = zip.folder('icons');
            let iconProgress  = 60;

            for (const { size, blob } of icons) {
                if (blob) {
                    iconsFolder.file(`icon-${size}x${size}.png`, blob);
                }
                onProgress(`Resizing icons (${size}px)…`, iconProgress);
                iconProgress += 8;
            }
        } else {
            /*
             * No icon uploaded — include a README placeholder so the /icons
             * folder exists and the developer knows what files are needed.
             */
            const iconsFolder = zip.folder('icons');
            iconsFolder.file('README.txt', `Place your PWA icons in this folder:\n\n- icon-144x144.png\n- icon-192x192.png\n- icon-512x512.png\n\nIcons should be square PNG files.\nUpload your icon in PWA Studio PRO MAX to auto-generate all sizes.`);
        }

        /* ── Step 5: HOW-TO-INSTALL.txt README ── */
        onProgress('Generating integration guide…', 82);
        zip.file('HOW-TO-INSTALL.txt', this._generateReadme(cfg));

        /* ── Step 6: Compress ZIP ── */
        onProgress('Compressing ZIP…', 90);
        const zipBlob = await zip.generateAsync(
            { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
            (meta) => onProgress(`Compressing… ${meta.percent.toFixed(0)}%`, 90 + (meta.percent * 0.09))
        );

        /* ── Step 7: Trigger download via FileSaver.js ── */
        onProgress('Download starting…', 100);
        const safeName = (cfg.appName || 'my-app').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        saveAs(zipBlob, `${safeName}-pwa-package.zip`);

        return true;
    },

    /**
     * _generateReadme(cfg)
     * Generates a plain-text integration guide included in the ZIP as
     * HOW-TO-INSTALL.txt. Covers: file placement, manifest link tag,
     * service worker registration script, HTTPS requirement, and troubleshooting.
     *
     * @param   {Object} cfg  Configuration object from PwaConfig.get().
     * @returns {string}      Formatted plain-text readme content.
     */
    _generateReadme(cfg) {
        return `PWA Package — Generated by PWA Studio PRO MAX
App: ${cfg.appName || 'My App'}
Generated: ${new Date().toLocaleString()}
https://trustedtoolsweb.com
${'='.repeat(60)}

FILES INCLUDED:
  manifest.json    — Web App Manifest (PWA configuration)
  sw.js            — Service Worker (${cfg.cacheStrategy} strategy)
  offline.html     — Offline fallback page
  /icons/          — App icons (PNG)

${'='.repeat(60)}

STEP 1: UPLOAD FILES
Extract this ZIP and copy all files to the ROOT of your website.
(Same directory as your index.html)

STEP 2: LINK MANIFEST IN <head>
Add this inside your <head> tag:

  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="${cfg.themeColor}">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="apple-touch-icon" href="/icons/icon-192x192.png">

STEP 3: REGISTER SERVICE WORKER
Add this just before </body>:

  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW error:', err));
    }
  <\/script>

STEP 4: SERVE OVER HTTPS
PWAs require HTTPS. If using localhost, the browser allows it for development.
For production, use an SSL certificate (Let's Encrypt is free).

${'='.repeat(60)}

TROUBLESHOOTING:
- Install prompt not showing? Ensure HTTPS, valid manifest, registered SW, and 192x192 icon.
- iOS: Use Share → "Add to Home Screen" (Safari only, no auto-prompt).
- Chrome: Open DevTools → Application → Manifest to validate.

${'='.repeat(60)}
Generated with ❤ by PWA Studio PRO MAX | Trusted Tools Web
`;
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: PreviewManager
   Keeps all live preview elements in sync with the current form state.
   Called after every input event on any configuration field.
   Manages: PWA splash screen, home screen icon + label, desktop app bar,
   and the manifest.json code preview panel.
───────────────────────────────────────────────────────────────────────────── */
const PreviewManager = {

    /**
     * init()
     * Runs the initial preview render so the mockup is populated on page load
     * rather than showing empty/placeholder content until the user interacts.
     */
    init() {
        this.updateAll();
    },

    /**
     * updateAll()
     * Convenience method — triggers all four preview update functions.
     * Called from every live-update input binding in UIController.
     */
    updateAll() {
        const cfg = PwaConfig.get();
        this.updateSplash(cfg);
        this.updateHomescreen(cfg);
        this.updateDesktop(cfg);
        this.updateManifestPreview(cfg);
    },

    /**
     * updateSplash(cfg)
     * Updates the mobile mockup splash screen:
     *  - Sets .pws-pwa-splash background to cfg.bgColor.
     *  - Updates the app name text in .pws-splash-app-name.
     *  - Colors the loading dots with cfg.themeColor (semi-transparent).
     *
     * @param {Object} cfg  Configuration snapshot from PwaConfig.get().
     */
    updateSplash(cfg) {
        const splash = document.querySelector('.pws-pwa-splash');
        if (splash) splash.style.background = cfg.bgColor;

        const nameEl = document.getElementById('splashAppName');
        if (nameEl) nameEl.textContent = cfg.appName || 'My Awesome App';

        /* Tint loading dots with theme color for branded feel */
        const dots = document.querySelectorAll('.pws-splash-dot');
        dots.forEach(d => d.style.background = cfg.themeColor + '99');
    },

    /**
     * updateHomescreen(cfg)
     * Updates the home screen icon preview below the phone mockup:
     *  - Sets the .pws-hs-label short name.
     *  - If no icon has been uploaded, applies a theme-color gradient to the
     *    home screen icon tile and the splash icon as well.
     *
     * @param {Object} cfg  Configuration snapshot from PwaConfig.get().
     */
    updateHomescreen(cfg) {
        const label = document.getElementById('hsLabel');
        if (label) label.textContent = cfg.shortName || cfg.appName || 'My App';

        /* Only update icon gradient when no real image has been uploaded */
        if (!IconResizer.sourceImage) {
            const hsIcon = document.getElementById('hsIconImg');
            if (hsIcon) {
                hsIcon.style.background = `linear-gradient(135deg, ${cfg.themeColor}, ${this._shiftColor(cfg.themeColor)})`;
                hsIcon.querySelector('i') && (hsIcon.querySelector('i').style.opacity = '1');
            }
            const splashIcon = document.getElementById('splashIcon');
            if (splashIcon && !splashIcon.querySelector('img')) {
                splashIcon.style.background = `linear-gradient(135deg, ${cfg.themeColor}, ${this._shiftColor(cfg.themeColor)})`;
            }
        }
    },

    /**
     * updateDesktop(cfg)
     * Updates the desktop browser mockup:
     *  - Sets the PWA app bar background to cfg.themeColor.
     *  - Updates the app title text.
     *  - Updates the address bar URL based on startUrl.
     *
     * @param {Object} cfg  Configuration snapshot from PwaConfig.get().
     */
    updateDesktop(cfg) {
        const appBar = document.getElementById('desktopAppBar');
        if (appBar) appBar.style.background = cfg.themeColor;

        const titleEl = document.getElementById('desktopAppName');
        if (titleEl) titleEl.textContent = cfg.appName || 'My Awesome App';

        const urlEl = document.getElementById('desktopUrl');
        if (urlEl) {
            const startUrl = cfg.startUrl || '/';
            urlEl.textContent = `yoursite.com${startUrl === '/' ? '' : startUrl}`;
        }
    },

    /**
     * updateManifestPreview(cfg)
     * Rebuilds the manifest.json string via ManifestBuilder and injects it
     * into the <code id="manifestCodeInner"> element for live preview.
     * Shows a fallback comment if ManifestBuilder throws an error.
     *
     * @param {Object} cfg  Configuration snapshot from PwaConfig.get().
     */
    updateManifestPreview(cfg) {
        const el = document.getElementById('manifestCodeInner');
        if (!el) return;
        const hasIcons = !!IconResizer.sourceImage;
        try {
            el.textContent = ManifestBuilder.build(cfg, hasIcons);
        } catch(e) {
            el.textContent = '// Invalid configuration — check required fields';
        }
    },

    /**
     * updateIconPreviews(dataUrl)
     * Replaces the placeholder icon elements in all three mockup locations
     * (splash icon, home screen icon, desktop app bar icon) with a real
     * <img> sourced from the uploaded image data URL.
     *
     * @param {string} dataUrl  Base-64 PNG data URL from IconResizer.getPreviewDataUrl().
     */
    updateIconPreviews(dataUrl) {
        /* Splash screen icon */
        const splashIcon = document.getElementById('splashIcon');
        if (splashIcon) {
            splashIcon.innerHTML = `<img src="${dataUrl}" alt="App Icon">`;
            splashIcon.style.background = 'transparent';
        }

        /* Home screen icon */
        const hsIcon = document.getElementById('hsIconImg');
        if (hsIcon) {
            hsIcon.innerHTML = `<img src="${dataUrl}" alt="App Icon">`;
            hsIcon.style.background = 'transparent';
        }

        /* Desktop app bar icon */
        const desktopIcon = document.getElementById('desktopBarIcon');
        if (desktopIcon) {
            desktopIcon.innerHTML = `<img src="${dataUrl}" alt="App Icon" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`;
        }
    },

    /**
     * resetIconPreviews()
     * Restores all three icon preview locations to their default placeholder
     * icons. Called when the user removes their uploaded icon.
     */
    resetIconPreviews() {
        const splashIcon = document.getElementById('splashIcon');
        if (splashIcon) splashIcon.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i>';

        const hsIcon = document.getElementById('hsIconImg');
        if (hsIcon) hsIcon.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i>';

        const desktopIcon = document.getElementById('desktopBarIcon');
        if (desktopIcon) desktopIcon.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i>';
    },

    /**
     * _shiftColor(hex)
     * Produces a slightly shifted variant of the input hex color by
     * increasing the red and blue channels. Used to generate a gradient
     * from the theme color for the mockup icon backgrounds.
     *
     * @param   {string} hex  6-digit hex color string.
     * @returns {string}      Modified hex color string.
     */
    _shiftColor(hex) {
        try {
            let r = parseInt(hex.slice(1, 3), 16);
            let g = parseInt(hex.slice(3, 5), 16);
            let b = parseInt(hex.slice(5, 7), 16);
            r = Math.min(255, r + 40);
            b = Math.min(255, b + 60);
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        } catch { return hex; }
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: ChecklistManager
   Manages the six PWA readiness checklist items by adding or removing the
   .is-pass class on each list item based on the current form state.
   The CSS uses .is-pass to swap the X icon for a check icon.
───────────────────────────────────────────────────────────────────────────── */
const ChecklistManager = {

    /**
     * update()
     * Reads the current config and evaluates each of the six readiness criteria.
     * Delegates per-item DOM update to _setCheck().
     * Called after every form input event.
     */
    update() {
        const cfg = PwaConfig.get();
        this._setCheck('chk-appName',  !!cfg.appName);
        this._setCheck('chk-shortName', !!cfg.shortName && cfg.shortName.length <= 12);
        this._setCheck('chk-startUrl',  !!cfg.startUrl);
        this._setCheck('chk-icon',      !!IconResizer.sourceImage);
        this._setCheck('chk-colors',    !!(cfg.themeColor && cfg.bgColor));
        this._setCheck('chk-sw',        !!cfg.cacheStrategy);
    },

    /**
     * _setCheck(id, pass)
     * Toggles the .is-pass class on a checklist item element.
     * The CSS handles icon swap via sibling/class selectors.
     *
     * @param {string}  id    The element ID of the checklist <li>.
     * @param {boolean} pass  True if the criterion is met.
     */
    _setCheck(id, pass) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('is-pass', pass);
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: ProgressController
   Controls the visibility and state of the generation progress bar shown
   during the ZIP export operation. The progress bar provides visual feedback
   so users understand the multi-step async process is working.
───────────────────────────────────────────────────────────────────────────── */
const ProgressController = {

    /**
     * show()
     * Makes the progress bar container visible by removing the `hidden` attribute.
     * Called at the start of the export process.
     */
    show() {
        const wrap = document.getElementById('progressWrap');
        if (wrap) wrap.hidden = false;
    },

    /**
     * hide()
     * Hides the progress bar container.
     * Called after the export completes or fails (with a delay for UX).
     */
    hide() {
        const wrap = document.getElementById('progressWrap');
        if (wrap) wrap.hidden = true;
    },

    /**
     * update(label, percent)
     * Updates the progress bar label text, fill width, and percentage readout.
     * Clamps percent to [0, 100] to prevent overflow.
     *
     * @param {string} label    Human-readable step description.
     * @param {number} percent  Progress value from 0 to 100.
     */
    update(label, percent) {
        const lbl  = document.getElementById('progressLabel');
        const fill = document.getElementById('progressBarFill');
        const pct  = document.getElementById('progressPercent');
        if (lbl)  lbl.textContent  = label;
        if (fill) fill.style.width = `${Math.min(100, percent)}%`;
        if (pct)  pct.textContent  = `${Math.min(100, Math.round(percent))}%`;
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   MODULE: UIController
   The top-level orchestrator that wires all event listeners, initialises
   all modules, and handles every user interaction not covered by individual
   modules. Called once on DOMContentLoaded via UIController.init().
───────────────────────────────────────────────────────────────────────────── */
const UIController = {

    /**
     * init()
     * Entry point called on DOMContentLoaded.
     * Calls all private binding methods in the correct dependency order
     * and performs the initial preview + checklist render.
     */
    init() {
        this._spawnParticles();
        this._bindFormInputs();
        this._bindColorSync();
        this._bindIconUpload();
        this._bindMockupSwitcher();
        this._bindGenerateButton();
        this._bindSnippetCopyButtons();
        this._bindCopyManifestButton();
        this._bindCharCounters();

        /* Initial render — populate previews and checklist before first interaction */
        PreviewManager.init();
        ChecklistManager.update();
    },

    /* ── Particles ──────────────────────────────────────────────────────────
     * _spawnParticles()
     * Programmatically creates 22 <span> elements inside the hero particle
     * container. Each span's position, size, animation duration, and delay
     * are randomised so the particle field looks organic rather than patterned.
     * Animation is driven by the CSS `pwsParticleFloat` keyframe using
     * CSS custom properties (--dur, --delay) set here via JS.
     */
    _spawnParticles() {
        const container = document.getElementById('heroParticles');
        if (!container) return;

        for (let i = 0; i < 22; i++) {
            const span = document.createElement('span');
            span.style.left   = `${Math.random() * 100}%`;
            span.style.top    = `${Math.random() * 100}%`;
            span.style.setProperty('--dur',   `${4 + Math.random() * 6}s`);
            span.style.setProperty('--delay', `${Math.random() * 5}s`);
            span.style.width  = `${2 + Math.random() * 3}px`;
            span.style.height = span.style.width;
            span.style.opacity = '0';
            container.appendChild(span);
        }
    },

    /* ── Live-Update Form Inputs ────────────────────────────────────────────
     * _bindFormInputs()
     * Attaches 'input' (text/select) or 'change' (checkbox) event listeners
     * to every field that affects the manifest or preview. On each event,
     * triggers a full preview refresh and checklist re-evaluation.
     */
    _bindFormInputs() {
        const liveInputIds = [
            'appName', 'shortName', 'appDescription', 'startUrl', 'appScope',
            'displayMode', 'orientation', 'appCategory', 'lang',
            'cacheStrategy', 'cacheName',
            'shareTarget', 'appBadging', 'protocolHandler', 'includeScreenshots'
        ];

        liveInputIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            /* Checkboxes fire 'change'; all others fire 'input' */
            const evtType = el.type === 'checkbox' ? 'change' : 'input';
            el.addEventListener(evtType, () => {
                PreviewManager.updateAll();
                ChecklistManager.update();
            });
        });
    },

    /* ── Color Picker Synchronisation ──────────────────────────────────────
     * _bindColorSync()
     * Keeps each native color picker (<input type="color">) and its paired
     * hex text field in sync so changes in one are reflected in the other.
     * The text input only propagates when it matches the #RRGGBB pattern
     * to avoid applying invalid partial values during typing.
     */
    _bindColorSync() {
        /* ─ Theme Color ─ */
        const themeColor    = document.getElementById('themeColor');
        const themeColorTxt = document.getElementById('themeColorText');

        /* Swatch → text field */
        themeColor.addEventListener('input', () => {
            themeColorTxt.value = themeColor.value;
            PreviewManager.updateAll();
            ChecklistManager.update();
        });

        /* Text field → swatch (only on valid 6-digit hex) */
        themeColorTxt.addEventListener('input', () => {
            const val = themeColorTxt.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                themeColor.value = val;
                PreviewManager.updateAll();
                ChecklistManager.update();
            }
        });

        /* ─ Background Color ─ */
        const bgColor    = document.getElementById('bgColor');
        const bgColorTxt = document.getElementById('bgColorText');

        bgColor.addEventListener('input', () => {
            bgColorTxt.value = bgColor.value;
            PreviewManager.updateAll();
            ChecklistManager.update();
        });

        bgColorTxt.addEventListener('input', () => {
            const val = bgColorTxt.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                bgColor.value = val;
                PreviewManager.updateAll();
                ChecklistManager.update();
            }
        });
    },

    /* ── Icon Upload: Click + Drag & Drop ──────────────────────────────────
     * _bindIconUpload()
     * Wires the icon upload zone for three interaction modes:
     *   1. Click on zone or browse button → opens file picker.
     *   2. Drag-and-drop files onto the zone.
     *   3. Remove button click → clears icon and resets UI.
     *
     * After a valid file is selected, delegates to _handleIconFile() for
     * async loading, preview update, and checklist refresh.
     */
    _bindIconUpload() {
        const zone          = document.getElementById('iconUploadZone');
        const fileInput     = document.getElementById('iconFileInput');
        const browseBtn     = document.getElementById('uploadBrowseBtn');
        const placeholder   = document.getElementById('uploadPlaceholder');
        const preview       = document.getElementById('uploadPreview');
        const previewImg    = document.getElementById('previewImg');
        const previewName   = document.getElementById('previewFileName');
        const previewDims   = document.getElementById('previewDimensions');
        const removeBtn     = document.getElementById('removeIconBtn');
        const sizesPreview  = document.getElementById('iconSizesPreview');

        /* Click on zone opens file picker (but not if clicking Remove button) */
        zone.addEventListener('click', (e) => {
            if (e.target === removeBtn || removeBtn.contains(e.target)) return;
            fileInput.click();
        });

        /* Explicit browse button also opens file picker */
        browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });

        /* File selected via the native file picker */
        fileInput.addEventListener('change', () => {
            if (fileInput.files[0]) {
                this._handleIconFile(fileInput.files[0], zone, placeholder, preview, previewImg, previewName, previewDims, sizesPreview);
            }
        });

        /* Drag-over: highlight the zone */
        zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));

        /* Drop: extract file and process */
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                this._handleIconFile(file, zone, placeholder, preview, previewImg, previewName, previewDims, sizesPreview);
            }
        });

        /* Remove icon: clears state, resets all preview elements */
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            IconResizer.clear();
            fileInput.value    = '';
            placeholder.hidden = false;
            preview.hidden     = true;
            sizesPreview.hidden = true;
            previewImg.src     = '';
            PreviewManager.resetIconPreviews();
            PreviewManager.updateManifestPreview(PwaConfig.get());
            ChecklistManager.update();
            window.showToast('Icon removed.');
        });
    },

    /**
     * _handleIconFile(file, ...)
     * Async handler called after a file is selected (click or drop).
     * Loads the image via IconResizer.loadFromFile(), generates a 128 px
     * data URL for UI preview, updates all mockup previews, and refreshes
     * the checklist. Shows error toast if loading fails.
     *
     * @param {File}        file         The selected image file.
     * @param {HTMLElement} zone         The upload zone (for drag-over class).
     * @param {HTMLElement} placeholder  The placeholder div (hidden on success).
     * @param {HTMLElement} preview      The preview div (shown on success).
     * @param {HTMLImageElement} previewImg   Preview thumbnail element.
     * @param {HTMLElement} previewName  File name display element.
     * @param {HTMLElement} previewDims  Image dimensions display element.
     * @param {HTMLElement} sizesPreview The "will generate" sizes strip.
     */
    async _handleIconFile(file, zone, placeholder, preview, previewImg, previewName, previewDims, sizesPreview) {
        try {
            const img    = await IconResizer.loadFromFile(file);
            const dataUrl = IconResizer.getPreviewDataUrl(128);

            /* Populate the upload preview UI */
            previewImg.src           = dataUrl;
            previewName.textContent  = file.name;
            previewDims.textContent  = `${img.naturalWidth} × ${img.naturalHeight} px`;
            placeholder.hidden       = true;
            preview.hidden           = false;
            sizesPreview.hidden      = false;

            /* Sync mockup icon previews and checklist */
            PreviewManager.updateIconPreviews(dataUrl);
            PreviewManager.updateManifestPreview(PwaConfig.get());
            ChecklistManager.update();

            window.showToast('Icon loaded! All sizes will be generated on export.');
        } catch (err) {
            window.showToast(err.message, true);
        }
    },

    /* ── Mockup Switcher (Mobile ↔ Desktop) ─────────────────────────────────
     * _bindMockupSwitcher()
     * Toggles between the mobile phone mockup and the desktop browser mockup
     * by toggling the `hidden` attribute and the `.active` class on buttons.
     */
    _bindMockupSwitcher() {
        const btnMobile   = document.getElementById('btnMobile');
        const btnDesktop  = document.getElementById('btnDesktop');
        const mobileMock  = document.getElementById('mobileMockup');
        const desktopMock = document.getElementById('desktopMockup');

        btnMobile.addEventListener('click', () => {
            btnMobile.classList.add('active');
            btnDesktop.classList.remove('active');
            mobileMock.hidden  = false;
            desktopMock.hidden = true;
        });

        btnDesktop.addEventListener('click', () => {
            btnDesktop.classList.add('active');
            btnMobile.classList.remove('active');
            desktopMock.hidden = false;
            mobileMock.hidden  = true;
        });
    },

    /* ── Generate & Download Button ─────────────────────────────────────────
     * _bindGenerateButton()
     * Handles the main CTA click event:
     *  1. Reads and validates configuration.
     *  2. Disables the button and enters a loading state.
     *  3. Shows the progress bar.
     *  4. Calls ZipExporter.export() with a progress callback.
     *  5. Re-enables the button and hides the progress bar after completion.
     *  6. Shows a global success or error toast.
     */
    _bindGenerateButton() {
        const btn = document.getElementById('generateBtn');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            const cfg    = PwaConfig.get();
            const errors = PwaConfig.validate(cfg);

            /* Validation failed — show each error as a separate toast */
            if (errors.length > 0) {
                errors.forEach(e => window.showToast(e, true));
                return;
            }

            /* Enter loading state: disable button, show spinner, show progress */
            btn.disabled = true;
            btn.classList.add('loading');
            btn.querySelector('.pws-btn-content span:last-child').textContent = 'Generating…';
            ProgressController.show();
            ProgressController.update('Starting…', 0);

            try {
                await ZipExporter.export(cfg, (label, percent) => {
                    ProgressController.update(label, percent);
                });

                window.showToast('🎉 PWA package downloaded successfully!');
            } catch (err) {
                console.error('[PWA Studio] Export error:', err);
                window.showToast(`Export failed: ${err.message}`, true);
            } finally {
                /* Always restore the button regardless of success or failure */
                btn.disabled = false;
                btn.classList.remove('loading');
                btn.querySelector('.pws-btn-content span:last-child').textContent = 'Generate & Download PWA ZIP';

                /* Keep progress bar visible briefly so user can see 100% */
                setTimeout(() => ProgressController.hide(), 2200);
            }
        });
    },

    /* ── Code Snippet Copy Buttons ──────────────────────────────────────────
     * _bindSnippetCopyButtons()
     * Attaches click handlers to all elements with class .snippet-copy-btn.
     * Each button reads its data-target attribute to find the <pre> element
     * whose text content should be copied to the clipboard.
     * On success: icon flips to a checkmark for 1.8 seconds.
     */
    _bindSnippetCopyButtons() {
        document.querySelectorAll('.snippet-copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const el = document.getElementById(targetId);
                if (!el) return;

                navigator.clipboard.writeText(el.textContent).then(() => {
                    window.showToast('Code snippet copied!');

                    /* Visual confirmation: swap copy icon for check icon */
                    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                    setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i>', 1800);
                });
            });
        });
    },

    /* ── Copy Manifest Button ────────────────────────────────────────────────
     * _bindCopyManifestButton()
     * Copies the full manifest.json preview text to the clipboard when the
     * user clicks the copy button in the manifest preview panel header.
     * On success: swaps the copy icon to a check icon for 1.8 seconds.
     */
    _bindCopyManifestButton() {
        const btn = document.getElementById('copyManifestBtn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const code = document.getElementById('manifestCodeInner');
            if (!code) return;

            navigator.clipboard.writeText(code.textContent).then(() => {
                window.showToast('manifest.json copied to clipboard!');

                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i>', 1800);
            });
        });
    },

    /* ── Character Counters ─────────────────────────────────────────────────
     * _bindCharCounters()
     * Attaches 'input' listeners to the App Name, Short Name, and Description
     * fields to display a live "x/max" character count below each input.
     * The counter color changes to warn (orange) at 85% capacity and to
     * danger (red) when the maximum is reached, giving users clear feedback.
     */
    _bindCharCounters() {
        const counters = [
            { inputId: 'appName',        countId: 'appNameCount',  max: 50  },
            { inputId: 'shortName',      countId: 'shortNameCount', max: 12 },
            { inputId: 'appDescription', countId: 'descCount',      max: 200 },
        ];

        counters.forEach(({ inputId, countId, max }) => {
            const input   = document.getElementById(inputId);
            const counter = document.getElementById(countId);
            if (!input || !counter) return;

            /**
             * update()
             * Inner function — recalculates the character count and updates
             * the counter element text and color on every input event.
             */
            const update = () => {
                const len = input.value.length;
                counter.textContent = `${len}/${max}`;

                /* Colour transitions: normal → warn (85%) → danger (100%) */
                counter.style.color = len > max * 0.85
                    ? (len >= max ? 'var(--accent-red)' : 'var(--accent-orange)')
                    : 'var(--text-muted)';
            };

            input.addEventListener('input', update);
            update(); /* Run immediately to set initial state */
        });
    }
};

/* ─────────────────────────────────────────────────────────────────────────────
   BOOT — DOMContentLoaded
   Delays all initialisation until the full DOM is available.
   Logs a branded console message to assist developers identifying the tool.
───────────────────────────────────────────────────────────────────────────── */



document.addEventListener('DOMContentLoaded', () => {
    UIController.init();
    console.log(
        '%c PWA Studio PRO MAX ',
        'background:#10b981;color:#fff;padding:4px 10px;border-radius:4px;font-weight:bold;',
        '| Trusted Tools Web | v1.0.0'
    );
});
