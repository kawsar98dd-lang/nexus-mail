/**
 * ============================================================================
 * TRUSTEDTOOLSWEB — MASTER SITE CONFIGURATION  (Firebase-Dynamic Edition)
 * ============================================================================
 * Author      : MD KAWSAR
 * Project     : Trusted Tools Web (CodeCanyon Premium)
 * Description : Initialises window.SITE_CONFIG from static defaults, then
 *               merges live values fetched from Firestore (site-config/main).
 *               All dependent scripts (meta-manager.js, etc.) MUST wait for
 *               the exported promise  window.SITE_CONFIG_READY  to resolve
 *               before reading SITE_CONFIG.
 *
 * Load order in your HTML (before </body>):
 *   1. Firebase compat SDK  (firebase-app.js + firebase-firestore.js)
 *   2. This file            (site-config.js)
 *   3. meta-manager.js      (and any other config-dependent scripts)
 * ============================================================================
 */

(function () {
  "use strict";

  /* ══════════════════════════════════════════════════════════════════════════
     STEP 1 — STATIC DEFAULTS
     These values are used immediately and act as a guaranteed fallback if
     Firestore is unreachable or the document doesn't exist yet.
  ══════════════════════════════════════════════════════════════════════════ */
  window.SITE_CONFIG = {

    // ── BRANDING ────────────────────────────────────────────────────────────
    brandName : "Trusted Tools Web",
    author    : "MD KAWSAR",
    /** Your domain — no trailing slash */
    baseUrl   : "https://trustedtoolsweb.com",

    // ── SEO META ────────────────────────────────────────────────────────────
    defaultDescription : "Secure, Fast, and Client-Side Developer Tools for everyone.",
    themeColor         : "#0d1117",

    // ── SOCIAL MEDIA ────────────────────────────────────────────────────────
    facebookAppId : "123456789",
    twitterHandle : "@TrustedToolsWeb",
    ogSiteName    : "Trusted Tools Web - Secure Developer Suite",

    // ── ASSETS & PATHS ──────────────────────────────────────────────────────
    defaultOGImage : "../../assets/img/og-banner.webp",
    favicon        : "favicon.png",
    appleIcon      : "favicon.png",

    // ── CONTACT ─────────────────────────────────────────────────────────────
    contactEmail : "contact@trustedtoolsweb.com",
    mainSiteUrl  : "https://trustedtoolsweb.com",

    // ══════════════════════════════════════════════════════════════════════
    // COMMENT SYSTEM — All 15 Premium Feature Controls Live Here
    // ══════════════════════════════════════════════════════════════════════
    commentSystem: {

      // ── ADMIN ──────────────────────────────────────────────────────────
      adminEmails: ["kawsar98dd@gmail.com"],

      // ── FIREBASE (Required) ────────────────────────────────────────────
      firebase: {
        apiKey            : "AIzaSyDc9m-lsrzsOC3zVRyXb2xoOOMnyQ7hUic",
        authDomain        : "account-tools-comments.firebaseapp.com",
        projectId         : "account-tools-comments",
        storageBucket     : "account-tools-comments.firebasestorage.app",
        messagingSenderId : "339954634804",
        appId             : "1:339954634804:web:a0865ac6aa61e76306fa61"
      },

      // ── FEATURE 1 — IMAGE ATTACHMENTS (ImgBB) ─────────────────────────
      imageAttachments: {
        enabled       : true,
        imgbbApiKey   : "",
        expiration    : 0,
        maxSizeMB     : 5,
        acceptedTypes : "image/jpeg,image/png,image/gif,image/webp"
      },

      // ── FEATURE 2 — VOICE NOTES (Cloudinary) ──────────────────────────
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

      // ── FEATURE 3 — USER CRUD ─────────────────────────────────────────
      userCRUD: { editEnabled: true, deleteEnabled: true },

      // ── FEATURE 4 — TELEGRAM NOTIFICATIONS ───────────────────────────
      telegram: {
        enabled  : true,
        botToken : "8685711544:AAFQbpEN-j6u6C57QVvn6cYNug6Y-K_SPFU",
        chatId   : "8369086998"
      },

      // ── FEATURE 5 — UPVOTES & SORTING ────────────────────────────────
      upvotes: { enabled: true, defaultSort: "newest" },

      // ── FEATURE 6 — ADMIN PIN COMMENT ────────────────────────────────
      pinComment: { enabled: true },

      // ── FEATURE 7 — PAGINATION / LOAD MORE ───────────────────────────
      pagination: { commentsPerPage: 10 },

      // ── FEATURE 8 — ANTI-SPAM / COOLDOWN TIMER ───────────────────────
      antiSpam: { cooldownSeconds: 30 },

      // ── FEATURE 9 — MARKDOWN & CODE SNIPPETS ─────────────────────────
      markdown: { enabled: true },

      // ── FEATURE 10 — IN-FEED ADS ──────────────────────────────────────
      ads: {
        enabled      : true,
        injectAfterN : 5,
        adHTML       : `<div style="text-align:center;padding:12px 0;">
                          <ins class="adsbygoogle" style="display:block"
                               data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                               data-ad-slot="XXXXXXXXXX"
                               data-ad-format="auto"
                               data-full-width-responsive="true"></ins>
                        </div>`
      },

      // ── FEATURE 11 — AUTO PROFANITY FILTER ───────────────────────────
      profanityFilter: {
        enabled  : true,
        wordList : ["badword1", "badword2", "spam", "scam", "idiot", "stupid", "dumb"]
      },

      // ── FEATURE 12 — USER BADGES ──────────────────────────────────────
      badges: { enabled: true, trustedUserUpvoteThreshold: 10 },

      // ── FEATURE 13 — @MENTION SYSTEM ─────────────────────────────────
      mentions: { enabled: true },

      // ── FEATURE 14 — GDPR COMPLIANCE ─────────────────────────────────
      gdpr: {
        consentCheckboxEnabled : true,
        dataExportEnabled      : true,
        consentText            : "I agree that my name and comment will be stored as per the Privacy Policy."
      },

      // ── FEATURE 15 — AUTO SEO SCHEMA (JSON-LD) ───────────────────────
      seoSchema: { enabled: true }
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     STEP 2 — FIRESTORE FIELD → SITE_CONFIG KEY MAPPING
     Only the fields managed by the admin panel (site-config-manager.js) are
     listed here.  Deep/nested keys (commentSystem.*) are intentionally left
     out of admin-panel control; they remain static above.

     Firestore field      →  window.SITE_CONFIG property path
  ══════════════════════════════════════════════════════════════════════════ */
  const FIRESTORE_MAP = {
    siteTitle       : "brandName",          // maps to SITE_CONFIG.brandName
    tagline         : "tagline",            // new optional field
    contactEmail    : "contactEmail",
    siteUrl         : "baseUrl",            // maps to SITE_CONFIG.baseUrl
    logoUrl         : "logoUrl",            // new optional field
    metaDescription : "defaultDescription",
    footerCopyright : "footerCopyright",    // new optional field
    // ogSiteName can be mirrored from siteTitle if desired (see merge logic below)
  };

  /* ══════════════════════════════════════════════════════════════════════════
     STEP 3 — FIRESTORE FETCH & MERGE
     Returns a Promise that resolves once the config is ready (whether from
     Firestore or the static fallback).  This Promise is stored on
     window.SITE_CONFIG_READY for dependents to await.
  ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Deep-sets a value on an object using a dot-notation path string.
   * e.g. setPath(obj, "commentSystem.pagination.commentsPerPage", 20)
   * @param {Object} obj
   * @param {string} path
   * @param {*}      value
   */
  function setPath(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] === undefined || typeof cur[keys[i]] !== "object") {
        cur[keys[i]] = {};
      }
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  /**
   * Merges Firestore document data into window.SITE_CONFIG using FIRESTORE_MAP.
   * Only non-empty string values overwrite the defaults.
   * @param {Object} data  — Raw Firestore document data
   */
  function mergeFirestoreData(data) {
    if (!data || typeof data !== "object") return;

    Object.entries(FIRESTORE_MAP).forEach(function ([fsKey, configPath]) {
      const val = data[fsKey];
      // Only overwrite if the Firestore value is a non-empty string
      if (typeof val === "string" && val.trim() !== "") {
        setPath(window.SITE_CONFIG, configPath, val.trim());
      }
    });

    // Optional convenience: keep ogSiteName in sync with brandName
    if (data.siteTitle && data.siteTitle.trim()) {
      window.SITE_CONFIG.ogSiteName = data.siteTitle.trim() + " - Secure Developer Suite";
    }

    // Keep mainSiteUrl in sync with baseUrl
    if (window.SITE_CONFIG.baseUrl) {
      window.SITE_CONFIG.mainSiteUrl = window.SITE_CONFIG.baseUrl;
    }
  }

  /**
   * Fetches site-config/main from Firestore and merges into SITE_CONFIG.
   * Resolves (never rejects) so the page always loads even on network errors.
   * @returns {Promise<void>}
   */
  async function fetchAndMergeFirestoreConfig() {
    // Guard: Firebase must be initialised before this runs.
    if (typeof firebase === "undefined" || typeof firebase.firestore !== "function") {
      console.warn("[TTW] Firebase not available — using static SITE_CONFIG defaults.");
      return;
    }

    try {
      const db      = firebase.firestore();
      const docRef  = db.collection("site-config").doc("main");
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        mergeFirestoreData(docSnap.data());
        console.log("[TTW] SITE_CONFIG merged from Firestore ✅");
      } else {
        // Document not yet created — first-time setup, use static defaults.
        console.info("[TTW] site-config/main not found in Firestore — using static defaults.");
      }
    } catch (err) {
      // Network error, permission denied, etc.  Fall back silently.
      console.error("[TTW] Firestore fetch failed — using static SITE_CONFIG defaults.", err);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     STEP 4 — EXPORT THE READY PROMISE
     window.SITE_CONFIG_READY is a Promise<void> that resolves when SITE_CONFIG
     is fully populated.  All dependent scripts must do:

       window.SITE_CONFIG_READY.then(function() { ... });
       // — or inside an async function —
       await window.SITE_CONFIG_READY;
  ══════════════════════════════════════════════════════════════════════════ */
  window.SITE_CONFIG_READY = fetchAndMergeFirestoreConfig();

})();
