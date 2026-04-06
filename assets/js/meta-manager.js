/**
 * ============================================================================
 * TRUSTEDTOOLSWEB — META & SEO AUTOMATION ENGINE
 * ============================================================================
 * Author      : MD KAWSAR
 * Project     : Trusted Tools Web (CodeCanyon Premium)
 * Version     : 2.0.0 — Firebase Dynamic Config Edition
 *
 * WHAT THIS FILE DOES:
 * ─────────────────────
 * 1. Waits for `window.loadDynamicSiteConfig()` to resolve so that
 *    ALL meta/SEO tags are written using the buyer's live Firebase data,
 *    not the static defaults.
 *
 * 2. Updates the following on every page — automatically:
 *    • <title>              — "Page Title - Brand Name"
 *    • canonical link       — Clean, query-free URL
 *    • meta[name=author]    — From SITE_CONFIG.author
 *    • meta[name=theme-color]
 *    • Open Graph tags      — og:url, og:site_name, og:image (absolute URL)
 *    • Twitter Card tags    — twitter:url, twitter:site, twitter:creator, twitter:image
 *    • JSON-LD schema       — url, author, brand fields synced
 *
 * 3. IMAGE URL RESOLUTION:
 *    Handles all three possible states in HTML:
 *    a) Already absolute:  "https://example.com/img.webp"  → used as-is
 *    b) Root-relative:     "assets/img/og-banner.webp"     → baseUrl prepended
 *    c) Not set at all:    (no meta tag / empty content)   → SITE_CONFIG.defaultOGImage
 *
 * DEPENDENCIES (load order in HTML):
 * ────────────────────────────────────
 *  1. Firebase SDK (compat) — app + firestore
 *  2. site-config.js        — defines SITE_CONFIG & loadDynamicSiteConfig()
 *  3. THIS FILE             — meta-manager.js
 *
 * ============================================================================
 */

(function () {
    "use strict";

    // ── Utility: Resolve any path to a guaranteed absolute URL ────────────────
    /**
     * @param  {string} path    — Relative ("assets/img/x.webp") or absolute URL.
     * @param  {string} baseUrl — Root domain, no trailing slash.
     * @returns {string}        — Absolute URL safe for og:image / twitter:image.
     */
    function toAbsoluteUrl(path, baseUrl) {
        if (!path || typeof path !== "string") return "";
        if (/^https?:\/\//i.test(path)) return path;           // Already absolute
        const base = (baseUrl || "").replace(/\/$/, "");
        return base + "/" + path.replace(/^\/+/, "");           // Prepend base
    }

    // ── Utility: Get a meta tag's content, or return a fallback ──────────────
    /**
     * @param  {string} selector — CSS selector for the meta tag.
     * @param  {string} fallback — Value to use if tag is missing or empty.
     * @returns {string}
     */
    function getMetaContent(selector, fallback) {
        const el = document.querySelector(selector);
        const val = el ? (el.getAttribute("content") || "").trim() : "";
        return val || fallback || "";
    }

    // ── Utility: Set a meta tag's content if the tag exists ──────────────────
    /**
     * @param {string} selector — CSS selector (property or name).
     * @param {string} value    — New content value.
     */
    function setMetaContent(selector, value) {
        const el = document.querySelector(selector);
        if (el && value) el.setAttribute("content", value);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORE FUNCTION — Runs after dynamic config is loaded
    // ─────────────────────────────────────────────────────────────────────────
    function applyAllSeoUpdates() {
        const CFG     = window.SITE_CONFIG;
        const baseUrl = (CFG.baseUrl || "").replace(/\/$/, "");

        // ── 1. CLEAN CANONICAL URL ────────────────────────────────────────────
        // Strip query strings and hash fragments for a clean canonical link.
        const fullURL = window.location.href.split(/[?#]/)[0];
        const fileName = window.location.pathname.split("/").pop() || "index.html";

        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute("href", fullURL);

        // ── 2. DYNAMIC <title> TAG ────────────────────────────────────────────
        // Format: "Existing Page Title - Brand Name"
        // If the title already contains " - " (was manually set), we replace
        // only the suffix to avoid double-appending on hot reloads.
        const brandSuffix = CFG.siteTitle || CFG.brandName || "";
        if (brandSuffix && document.title) {
            // Remove any existing brand suffix before appending the fresh one
            const titleBase = document.title.split(" - ")[0].trim();
            document.title = titleBase ? titleBase + " - " + brandSuffix : brandSuffix;
        }

        // ── 3. AUTHOR & THEME-COLOR ───────────────────────────────────────────
        setMetaContent('meta[name="author"]',     CFG.author     || "");
        setMetaContent('meta[name="theme-color"]', CFG.themeColor || "");

        // ── 4. OG IMAGE — Resolve to absolute URL ─────────────────────────────
        // Priority: (a) existing og:image tag → (b) SITE_CONFIG.defaultOGImage
        const rawOgImg  = getMetaContent('meta[property="og:image"]', CFG.defaultOGImage);
        const finalOgImg = toAbsoluteUrl(rawOgImg, baseUrl);

        // ── 5. TWITTER IMAGE — Same resolution logic ──────────────────────────
        const rawTwImg  = getMetaContent('meta[name="twitter:image"]', CFG.defaultOGImage);
        const finalTwImg = toAbsoluteUrl(rawTwImg, baseUrl);

        // ── 6. OPEN GRAPH & TWITTER CARD META MAP ─────────────────────────────
        // All values sourced strictly from SITE_CONFIG — zero hardcoded strings.
        const metaUpdates = {
            // Open Graph
            'og:url'         : fullURL,
            'og:site_name'   : CFG.ogSiteName    || CFG.brandName || "",
            'og:image'       : finalOgImg,

            // Twitter Card
            'twitter:url'    : fullURL,
            'twitter:site'   : CFG.twitterHandle  || "",
            'twitter:creator': CFG.twitterHandle  || "",
            'twitter:image'  : finalTwImg
        };

        // Apply the map — handles both property="" and name="" attribute styles
        Object.keys(metaUpdates).forEach(function (key) {
            const val = metaUpdates[key];
            if (!val) return; // Skip empty values — don't overwrite with blank
            const el = document.querySelector(
                'meta[property="' + key + '"], meta[name="' + key + '"]'
            );
            if (el) el.setAttribute("content", val);
        });

        // ── 7. FACEBOOK APP ID ────────────────────────────────────────────────
        if (CFG.facebookAppId) {
            setMetaContent('meta[property="fb:app_id"]', CFG.facebookAppId);
        }

        // ── 8. JSON-LD SCHEMA SYNC ────────────────────────────────────────────
        // Iterates all JSON-LD blocks and updates url, author, and brand fields.
        // All other schema data written by page-level scripts is preserved.
        const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');

        schemaScripts.forEach(function (script) {
            try {
                const data = JSON.parse(script.innerText || script.textContent || "{}");

                // Sync canonical URL into schema
                if (data.hasOwnProperty("url")) {
                    data.url = fullURL;
                }

                // Sync author field
                if (data.hasOwnProperty("author")) {
                    if (typeof data.author === "object" && data.author !== null) {
                        data.author.name = CFG.author  || data.author.name;
                        data.author.url  = baseUrl     || data.author.url;
                    } else {
                        // Plain string author
                        data.author = CFG.author || data.author;
                    }
                }

                // Sync brand field (e.g. Product schema)
                if (data.brand && typeof data.brand === "object") {
                    data.brand.name = CFG.brandName || data.brand.name;
                }

                // Sync publisher field (e.g. Article / NewsArticle schema)
                if (data.publisher && typeof data.publisher === "object") {
                    data.publisher.name = CFG.brandName || data.publisher.name;
                    if (data.publisher.logo && typeof data.publisher.logo === "object") {
                        // Keep the URL pattern but update the base domain
                        if (data.publisher.logo.url && !/^https?:\/\//i.test(data.publisher.logo.url)) {
                            data.publisher.logo.url = toAbsoluteUrl(data.publisher.logo.url, baseUrl);
                        }
                    }
                }

                // Write the updated schema back to the script tag
                script.textContent = JSON.stringify(data, null, 2);

            } catch (err) {
                // Never crash the page over a schema parse error
                console.warn("TTW: Schema sync error on <script[type='application/ld+json']>:", err.message || err);
            }
        });

        // ── Done ──────────────────────────────────────────────────────────────
        console.info("🚀 TTW: SEO & Schema synced for: " + fileName);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // ENTRY POINT — Await dynamic config, then fire SEO updates
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * We run inside DOMContentLoaded to guarantee the DOM is available.
     * We then await loadDynamicSiteConfig() so that Firebase branding is merged
     * into SITE_CONFIG BEFORE any meta tag is touched.
     *
     * If loadDynamicSiteConfig is not defined (e.g., site-config.js failed to
     * load), we fall through immediately using whatever SITE_CONFIG exists.
     */
    document.addEventListener("DOMContentLoaded", async function () {
        try {
            // Wait for Firebase config merge (resolves in ~300ms on fast networks,
            // or immediately from cache on repeat visits)
            if (typeof window.loadDynamicSiteConfig === "function") {
                await window.loadDynamicSiteConfig();
            } else {
                console.warn("TTW: loadDynamicSiteConfig() not found. Ensure site-config.js loads first.");
            }
        } catch (err) {
            // Defensive catch — should never reach here since loadDynamicSiteConfig
            // is already wrapped in try/catch, but just in case.
            console.warn("TTW: Config load guard caught:", err.message || err);
        } finally {
            // Always apply SEO updates, even if Firebase failed
            applyAllSeoUpdates();
        }
    });

})();
