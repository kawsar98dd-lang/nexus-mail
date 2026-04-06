/**
 * ============================================================================
 * TRUSTEDTOOLSWEB — MASTER SITE CONFIGURATION & DYNAMIC LOADER
 * ============================================================================
 * Author      : MD KAWSAR
 * Project     : Trusted Tools Web (CodeCanyon Premium)
 * Version     : 2.0.0 — Firebase Dynamic Config Edition
 *
 * HOW IT WORKS (White-Label Architecture):
 * ─────────────────────────────────────────
 * 1. `window.SITE_CONFIG` holds all DEFAULT / FALLBACK values.
 *    These are used immediately if Firebase is unavailable.
 *
 * 2. `window.loadDynamicSiteConfig()` is an async function that:
 *    a) Connects to Firestore using the firebase config below.
 *    b) Fetches the `site-config/main` document from Firestore.
 *    c) MERGES the fetched branding data over the defaults.
 *    d) Resolves silently — never throws, never blocks the page.
 *
 * 3. `meta-manager.js` awaits `loadDynamicSiteConfig()` before
 *    touching the DOM, guaranteeing every meta/SEO tag reflects
 *    the buyer's live Admin Panel settings.
 *
 * ⚡ HOW TO RE-BRAND (for Admin Panel buyers):
 * ─────────────────────────────────────────────
 *    Open your Admin Panel → Site Settings.
 *    Update brandName, baseUrl, author, etc.
 *    Changes reflect instantly on ALL 100+ pages.
 *    No HTML files need to be touched.
 *
 * ⚡ HOW TO RE-BRAND (static / no Admin Panel):
 * ─────────────────────────────────────────────
 *    Edit the BRANDING, SEO META, and SOCIAL MEDIA sections below.
 *    Keep the commentSystem.firebase keys unchanged.
 * ============================================================================
 */

window.SITE_CONFIG = {

    // ── BRANDING ──────────────────────────────────────────────────────────────
    /** Your project / brand name shown in titles, footers, and SEO. */
    brandName   : "Trusted Tools Web",
    /** Displayed in meta[name="author"] and JSON-LD schema. */
    author      : "MD KAWSAR",
    /** Your live domain — NO trailing slash. Used for canonical & OG URLs. */
    baseUrl     : "https://trustedtoolsweb.com",

    // ── SEO META ──────────────────────────────────────────────────────────────
    /** Fallback site title appended to page titles: "Page - siteTitle" */
    siteTitle          : "Trusted Tools Web",
    defaultDescription : "Secure, Fast, and Client-Side Developer Tools for everyone.",
    themeColor         : "#0d1117",

    // ── SOCIAL MEDIA ──────────────────────────────────────────────────────────
    facebookAppId : "123456789",
    twitterHandle : "@TrustedToolsWeb",
    ogSiteName    : "Trusted Tools Web - Secure Developer Suite",

    // ── ASSETS & PATHS ────────────────────────────────────────────────────────
    /**
     * defaultOGImage: Can be a root-relative path ("assets/img/og-banner.webp")
     * or a full URL. meta-manager.js will resolve it to an absolute URL.
     */
    defaultOGImage : "assets/img/og-banner.webp",
    favicon        : "favicon.png",
    appleIcon      : "favicon.png",

    // ── CONTACT ───────────────────────────────────────────────────────────────
    contactEmail : "contact@trustedtoolsweb.com",
    mainSiteUrl  : "https://trustedtoolsweb.com",

    // ══════════════════════════════════════════════════════════════════════════
    // COMMENT SYSTEM — All 15 Premium Feature Controls
    // ══════════════════════════════════════════════════════════════════════════
    commentSystem: {

        // ── ADMIN ─────────────────────────────────────────────────────────────
        /** Array of Google email addresses with full admin privileges. */
        adminEmails: ["kawsar98dd@gmail.com"],

        // ── FIREBASE (Required) ───────────────────────────────────────────────
        /**
         * These Firebase keys are used by BOTH the comment system AND
         * `loadDynamicSiteConfig()` to read the Admin Panel's saved settings.
         * DO NOT remove or rename these keys.
         */
        firebase: {
            apiKey            : "AIzaSyDc9m-lsrzsOC3zVRyXb2xoOOMnyQ7hUic",
            authDomain        : "account-tools-comments.firebaseapp.com",
            projectId         : "account-tools-comments",
            storageBucket     : "account-tools-comments.firebasestorage.app",
            messagingSenderId : "339954634804",
            appId             : "1:339954634804:web:a0865ac6aa61e76306fa61"
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 1 — IMAGE ATTACHMENTS (ImgBB)
        // ────────────────────────────────────────────────────────────────────
        imageAttachments: {
            enabled       : true,
            imgbbApiKey   : "",
            expiration    : 0,
            maxSizeMB     : 5,
            acceptedTypes : "image/jpeg,image/png,image/gif,image/webp"
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 2 — VOICE NOTES (Cloudinary)
        // ────────────────────────────────────────────────────────────────────
        voiceNotes: {
            enabled            : true,
            cloudName          : "",
            uploadPreset       : "ttw_audio_preset",
            maxDurationSeconds : 60,
            enableVoiceEnhance : true,
            voiceEnhance: {
                highpassFrequency  : 80,
                highpassQ          : 0.707,
                compressorThreshold: -24,
                compressorKnee     : 30,
                compressorRatio    : 4,
                compressorAttack   : 0.003,
                compressorRelease  : 0.25
            }
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 3 — USER CRUD
        // ────────────────────────────────────────────────────────────────────
        userCRUD: {
            editEnabled  : true,
            deleteEnabled: true
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 4 — TELEGRAM NOTIFICATIONS
        // ────────────────────────────────────────────────────────────────────
        telegram: {
            enabled  : true,
            botToken : "8685711544:AAFQbpEN-j6u6C57QVvn6cYNug6Y-K_SPFU",
            chatId   : "8369086998"
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 5 — UPVOTES & SORTING
        // ────────────────────────────────────────────────────────────────────
        upvotes: {
            enabled    : true,
            defaultSort: "newest"
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 6 — ADMIN PIN COMMENT
        // ────────────────────────────────────────────────────────────────────
        pinComment: {
            enabled: true
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 7 — PAGINATION / LOAD MORE
        // ────────────────────────────────────────────────────────────────────
        pagination: {
            commentsPerPage: 10
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 8 — ANTI-SPAM / COOLDOWN TIMER
        // ────────────────────────────────────────────────────────────────────
        antiSpam: {
            cooldownSeconds: 30
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 9 — MARKDOWN & CODE SNIPPETS
        // ────────────────────────────────────────────────────────────────────
        markdown: {
            enabled: true
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 10 — IN-FEED ADS
        // ────────────────────────────────────────────────────────────────────
        ads: {
            enabled     : true,
            injectAfterN: 5,
            adHTML      : `<div style="text-align:center;padding:12px 0;">
                              <ins class="adsbygoogle" style="display:block"
                                   data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                                   data-ad-slot="XXXXXXXXXX"
                                   data-ad-format="auto"
                                   data-full-width-responsive="true"></ins>
                           </div>`
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 11 — AUTO PROFANITY FILTER
        // ────────────────────────────────────────────────────────────────────
        profanityFilter: {
            enabled : true,
            wordList: ["badword1", "badword2", "spam", "scam", "idiot", "stupid", "dumb"]
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 12 — USER BADGES
        // ────────────────────────────────────────────────────────────────────
        badges: {
            enabled                   : true,
            trustedUserUpvoteThreshold: 10
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 13 — @MENTION SYSTEM
        // ────────────────────────────────────────────────────────────────────
        mentions: {
            enabled: true
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 14 — GDPR COMPLIANCE
        // ────────────────────────────────────────────────────────────────────
        gdpr: {
            consentCheckboxEnabled: true,
            dataExportEnabled     : true,
            consentText           : "I agree that my name and comment will be stored as per the Privacy Policy."
        },

        // ────────────────────────────────────────────────────────────────────
        // FEATURE 15 — AUTO SEO SCHEMA (JSON-LD)
        // ────────────────────────────────────────────────────────────────────
        seoSchema: {
            enabled: true
        }
    }
};


/**
 * ============================================================================
 * DYNAMIC CONFIG LOADER — loadDynamicSiteConfig()
 * ============================================================================
 *
 * This async function fetches the buyer's live branding from Firestore and
 * merges it into `window.SITE_CONFIG`, overriding the defaults above.
 *
 * It is designed to:
 *  • NEVER throw an unhandled error (always falls back gracefully).
 *  • NEVER re-initialize Firebase if it is already running (e.g. by comments.js).
 *  • Resolve a cached Promise on repeat calls — safe to await multiple times.
 *
 * FIRESTORE DOCUMENT SHAPE (what the Admin Panel should save):
 * ─────────────────────────────────────────────────────────────
 *  Collection : site-config
 *  Document   : main
 *  Fields (all optional — only present fields are merged):
 *    brandName        (string)
 *    siteTitle        (string)
 *    author           (string)
 *    baseUrl          (string)   ← no trailing slash
 *    defaultDescription (string)
 *    themeColor       (string)
 *    facebookAppId    (string)
 *    twitterHandle    (string)
 *    ogSiteName       (string)
 *    defaultOGImage   (string)
 *    favicon          (string)
 *    appleIcon        (string)
 *    contactEmail     (string)
 *    mainSiteUrl      (string)
 * ============================================================================
 */

(function () {
    "use strict";

    // ── Internal promise cache — guarantees a single Firestore fetch per page ──
    let _configPromise = null;

    /**
     * Resolves an absolute image URL from a given path.
     * If the path is already absolute (starts with http/https), return as-is.
     * Otherwise, prepend baseUrl.
     *
     * @param  {string} path    — Relative or absolute image path.
     * @param  {string} baseUrl — The site's root URL (no trailing slash).
     * @returns {string}        — Guaranteed absolute URL.
     */
    function resolveAbsoluteUrl(path, baseUrl) {
        if (!path) return "";
        if (/^https?:\/\//i.test(path)) return path;
        // Strip any leading slashes from path to avoid double-slash
        return baseUrl.replace(/\/$/, "") + "/" + path.replace(/^\/+/, "");
    }

    /**
     * loadDynamicSiteConfig()
     * ─────────────────────────
     * Fetches `site-config/main` from Firestore and merges it into
     * `window.SITE_CONFIG`. Returns a Promise that always resolves
     * (never rejects), so it is safe to `await` unconditionally.
     *
     * @returns {Promise<void>}
     */
    window.loadDynamicSiteConfig = function () {

        // Return the cached promise if already initiated — prevents double fetch
        if (_configPromise) return _configPromise;

        _configPromise = (async function () {
            try {
                const fbCfg = window.SITE_CONFIG.commentSystem.firebase;

                // ── Step 1: Get or reuse the Firebase App instance ──────────────
                // firebase.apps is populated by the Firebase SDK (compat version).
                // We reuse the existing app to avoid "duplicate app" errors if
                // comments.js has already initialised Firebase on the same page.
                let app;
                if (firebase.apps && firebase.apps.length > 0) {
                    app = firebase.apps[0];
                } else {
                    app = firebase.initializeApp(fbCfg);
                }

                // ── Step 2: Get a Firestore reference ──────────────────────────
                const db  = firebase.firestore(app);
                const ref = db.collection("site-config").doc("main");

                // ── Step 3: Fetch the document (with a 5-second timeout) ────────
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("TTW: Firestore config fetch timed out.")), 5000)
                );

                const snapshot = await Promise.race([ref.get(), timeoutPromise]);

                // ── Step 4: If the document doesn't exist, fall back silently ───
                if (!snapshot.exists) {
                    console.info("TTW: site-config/main not found. Using default SITE_CONFIG.");
                    return;
                }

                // ── Step 5: Merge ONLY the top-level branding keys ─────────────
                // We never touch commentSystem (firebase keys, feature toggles)
                // as those are managed separately and must not be overwritten.
                const remoteData = snapshot.data();

                const BRANDING_KEYS = [
                    "brandName", "siteTitle", "author", "baseUrl",
                    "defaultDescription", "themeColor", "facebookAppId",
                    "twitterHandle", "ogSiteName", "defaultOGImage",
                    "favicon", "appleIcon", "contactEmail", "mainSiteUrl"
                ];

                BRANDING_KEYS.forEach(function (key) {
                    if (remoteData.hasOwnProperty(key) && remoteData[key] !== undefined && remoteData[key] !== "") {
                        window.SITE_CONFIG[key] = remoteData[key];
                    }
                });

                // ── Step 6: Ensure defaultOGImage is always an absolute URL ────
                window.SITE_CONFIG.defaultOGImage = resolveAbsoluteUrl(
                    window.SITE_CONFIG.defaultOGImage,
                    window.SITE_CONFIG.baseUrl
                );

                console.info("✅ TTW: Dynamic SITE_CONFIG loaded from Firebase.");

            } catch (err) {
                // Silent fallback — log the error but never interrupt page load
                console.warn("TTW: Could not load dynamic config. Using defaults.", err.message || err);
            }
        })();

        return _configPromise;
    };

})();
