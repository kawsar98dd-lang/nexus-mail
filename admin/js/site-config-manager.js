/**
 * ============================================================================
 *  site-config-manager.js  —  Trusted Tools Web Admin Panel
 *  Version: 2.0.0  (16-field White-Label Edition)
 * ============================================================================
 *
 *  Responsibilities:
 *  1. FETCH  — Reads Firestore document  site-config/main  and pre-fills
 *              all 16 form fields on load.
 *  2. SAVE   — Collects + validates + writes (merge) all 16 keys back to
 *              Firestore when Save is clicked.
 *  3. UX     — Character counters, live image previews (OG image, favicon,
 *              apple icon), colour picker sync, dirty-state tracking,
 *              reset, Ctrl+S shortcut, beforeunload guard.
 *
 *  FIRESTORE DOCUMENT STRUCTURE  (site-config / main)
 *  ────────────────────────────────────────────────────
 *  KEY                  TYPE     NOTES
 *  ─────────────────────────────────────────────────────────────────────────
 *  brandName            string   Core brand / company name
 *  siteTitle            string   Appended to page <title> tags
 *  tagline              string   Hero section subtitle
 *  author               string   meta[name="author"] + JSON-LD author.name
 *  baseUrl              string   Root domain (no trailing slash)
 *  mainSiteUrl          string   Portfolio / personal site link
 *  contactEmail         string   Contact page email
 *  defaultDescription   string   Fallback meta description (≤ 160 chars)
 *  footerCopyright      string   Footer copyright line
 *  themeColor           string   meta[name="theme-color"] hex value
 *  facebookAppId        string   meta[property="fb:app_id"]
 *  twitterHandle        string   twitter:site + twitter:creator (with @)
 *  ogSiteName           string   og:site_name
 *  defaultOGImage       string   Fallback og:image + twitter:image path
 *  favicon              string   Browser tab icon path / URL
 *  appleIcon            string   Apple touch icon path / URL
 *  updatedAt            timestamp Auto-set by server on every save
 *  ─────────────────────────────────────────────────────────────────────────
 *
 *  Depends on: firebase-config.js, dashboard.js (for TTW_Toast)
 * ============================================================================
 */

(function () {
  "use strict";

  /* ─── Firestore reference ────────────────────────────────── */
  const db = firebase.firestore();

  /**
   * Firestore path constants.
   * If you rename the collection, change both values here AND
   * update your Firestore Security Rules to match.
   */
  const CONFIG_COLLECTION = "site-config";
  const CONFIG_DOCUMENT   = "main";

  /* ══════════════════════════════════════════════════════════
     FIELD DEFINITIONS
     ══════════════════════════════════════════════════════════
     Each entry maps one form element to one Firestore key.

     inputId       — id of the HTML element
     firestoreKey  — key in the Firestore document
     maxLen        — hard character limit (null = no limit)
     softLen       — "warning" threshold shown in the counter
     isTextarea    — true for <textarea> elements
     isColor       — true for the theme colour text input
                     (synced with the companion colour picker)
     previewId     — id of the <img> live-preview element (optional)
     previewLabelId— id of the preview label <span>   (optional)
  ══════════════════════════════════════════════════════════ */
  const FIELDS = [
    // ── BASIC BRANDING ──────────────────────────────────────
    {
      inputId      : "fieldBrandName",
      firestoreKey : "brandName",
      maxLen       : 70,
      softLen      : 55,
    },
    {
      inputId      : "fieldSiteTitle",
      firestoreKey : "siteTitle",
      maxLen       : 70,
      softLen      : 55,
    },
    {
      inputId      : "fieldTagline",
      firestoreKey : "tagline",
      maxLen       : 120,
      softLen      : 90,
    },
    {
      inputId      : "fieldAuthor",
      firestoreKey : "author",
      maxLen       : 80,
      softLen      : 60,
    },

    // ── SEO & META ──────────────────────────────────────────
    {
      inputId      : "fieldBaseUrl",
      firestoreKey : "baseUrl",
      maxLen       : null,
    },
    {
      inputId      : "fieldMainSiteUrl",
      firestoreKey : "mainSiteUrl",
      maxLen       : null,
    },
    {
      inputId      : "fieldContactEmail",
      firestoreKey : "contactEmail",
      maxLen       : null,
    },
    {
      inputId      : "fieldDefaultDesc",
      firestoreKey : "defaultDescription",
      maxLen       : 200,   // hard stop on textarea
      softLen      : 160,   // SEO-recommended cap shown in counter
      isTextarea   : true,
    },
    {
      inputId      : "fieldFooterCopy",
      firestoreKey : "footerCopyright",
      maxLen       : 120,
      softLen      : 100,
    },
    {
      inputId      : "fieldThemeColor",
      firestoreKey : "themeColor",
      maxLen       : 20,
      isColor      : true,   // synced with #fieldThemeColorPicker
    },

    // ── SOCIAL MEDIA & OPEN GRAPH ───────────────────────────
    {
      inputId      : "fieldFbAppId",
      firestoreKey : "facebookAppId",
      maxLen       : 20,
    },
    {
      inputId      : "fieldTwitterHandle",
      firestoreKey : "twitterHandle",
      maxLen       : 50,
      softLen      : 16,
    },
    {
      inputId      : "fieldOgSiteName",
      firestoreKey : "ogSiteName",
      maxLen       : 100,
      softLen      : 70,
    },

    // ── ASSETS & ICONS ──────────────────────────────────────
    {
      inputId        : "fieldDefaultOGImage",
      firestoreKey   : "defaultOGImage",
      maxLen         : null,
      previewId      : "ogImagePreview",
      previewLabelId : "ogImagePreviewLabel",
    },
    {
      inputId        : "fieldFavicon",
      firestoreKey   : "favicon",
      maxLen         : null,
      previewId      : "faviconPreview",
      previewLabelId : "faviconPreviewLabel",
    },
    {
      inputId        : "fieldAppleIcon",
      firestoreKey   : "appleIcon",
      maxLen         : null,
      previewId      : "appleIconPreview",
      previewLabelId : "appleIconPreviewLabel",
    },
  ];

  /* ─── DOM references ─────────────────────────────────────── */
  const btnSave          = document.getElementById("btnSaveConfig");
  const btnReset         = document.getElementById("btnResetConfig");
  const saveStatus       = document.getElementById("saveStatus");
  const statConfigStatus = document.getElementById("statConfigStatus"); // dashboard overview card
  const colorPicker      = document.getElementById("fieldThemeColorPicker");
  const colorTextInput   = document.getElementById("fieldThemeColor");

  /* ─── State ──────────────────────────────────────────────── */
  let _savedData = {};    // Snapshot from last Firestore fetch — used for reset
  let _isDirty   = false; // True once any field has been edited since last save/load

  /* ══════════════════════════════════════════════════════════
     UTILITY: getEl
  ══════════════════════════════════════════════════════════ */
  /** Returns the HTMLElement for a field definition. */
  function getEl(field) {
    return document.getElementById(field.inputId);
  }

  /* ══════════════════════════════════════════════════════════
     UTILITY: updateCharCounter
  ══════════════════════════════════════════════════════════ */
  /**
   * Updates the character counter element below a field.
   * Applies .warn (near limit) and .over (at/past limit) classes.
   *
   * Special case: defaultDescription shows "X / 160 recommended"
   * because the hard maxlength (200) is looser than the SEO cap (160).
   *
   * @param {Object} field
   * @param {string} value  — Current field value
   */
  function updateCharCounter(field, value) {
    if (!field.maxLen) return;
    const counterId = "cc-" + field.firestoreKey;
    const counter   = document.getElementById(counterId);
    if (!counter) return;

    const len = (value || "").length;

    if (field.firestoreKey === "defaultDescription") {
      // Show the SEO-recommended cap (160), not the hard limit (200)
      counter.textContent = `${len} / 160 recommended`;
      counter.className   = "char-counter" +
        (len > 200 ? " over" : len > 160 ? " warn" : "");
    } else {
      counter.textContent = `${len} / ${field.maxLen}`;
      counter.className   = "char-counter" +
        (len >= field.maxLen                       ? " over" :
         field.softLen && len > field.softLen      ? " warn" : "");
    }
  }

  /* ══════════════════════════════════════════════════════════
     UTILITY: updateImagePreview
  ══════════════════════════════════════════════════════════ */
  /**
   * Shows or hides the live image preview for a field.
   * Only fires for full absolute URLs (http/https) — relative
   * paths cannot be previewed without the buyer's domain.
   *
   * @param {Object} field  — Must have previewId + previewLabelId
   * @param {string} url    — Current field value
   */
  function updateImagePreview(field, url) {
    if (!field.previewId) return;
    const img   = document.getElementById(field.previewId);
    const label = document.getElementById(field.previewLabelId);
    if (!img) return;

    const trimmed = (url || "").trim();

    if (!trimmed) {
      img.classList.remove("visible");
      if (label) label.textContent = "Enter a full URL above to preview.";
      return;
    }

    // Only attempt preview for absolute URLs
    if (!/^https?:\/\//i.test(trimmed)) {
      img.classList.remove("visible");
      if (label) label.textContent = "Relative path saved. Enter a full URL to preview.";
      return;
    }

    img.src = trimmed;
    img.onload = () => {
      img.classList.add("visible");
      if (label) label.textContent = "Image loaded successfully. ✓";
    };
    img.onerror = () => {
      img.classList.remove("visible");
      if (label) label.textContent = "⚠️ Could not load image — check the URL.";
    };
  }

  /* ══════════════════════════════════════════════════════════
     UTILITY: syncColorPicker
  ══════════════════════════════════════════════════════════ */
  /**
   * Keeps the colour swatch and text input in sync.
   * Only updates the picker if value is a valid 6-digit hex colour.
   *
   * @param {string} hexValue — e.g. "#0d1117"
   */
  function syncColorPicker(hexValue) {
    if (!colorPicker) return;
    if (/^#[0-9a-fA-F]{6}$/.test((hexValue || "").trim())) {
      colorPicker.value = hexValue.trim();
    }
  }

  /* ══════════════════════════════════════════════════════════
     UTILITY: markDirty / markClean
  ══════════════════════════════════════════════════════════ */
  function markDirty() {
    _isDirty = true;
    if (saveStatus) {
      saveStatus.textContent = "● Unsaved changes";
      saveStatus.style.color = "var(--warn)";
    }
  }

  function markClean() {
    _isDirty = false;
    if (saveStatus) saveStatus.textContent = "";
  }

  /* ══════════════════════════════════════════════════════════
     UTILITY: setSaveLoading
  ══════════════════════════════════════════════════════════ */
  function setSaveLoading(isLoading) {
    if (!btnSave) return;
    btnSave.disabled = isLoading;
    btnSave.innerHTML = isLoading
      ? '<span class="btn-spinner"></span> Saving…'
      : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
           <polyline points="20 6 9 17 4 12"/>
         </svg>
         Save Configuration`;
  }

  /* ══════════════════════════════════════════════════════════
     UTILITY: formatTimestamp
  ══════════════════════════════════════════════════════════ */
  /**
   * Converts a Firestore Timestamp (or null) to a readable string.
   * @param {firebase.firestore.Timestamp|null} ts
   * @returns {string}
   */
  function formatTimestamp(ts) {
    if (!ts || !ts.toDate) return "Unknown";
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  /* ══════════════════════════════════════════════════════════
     CORE: POPULATE FORM
     ──────────────────
     Writes a data object (from Firestore) into all 16 fields
     and triggers all live UI helpers (counters, previews, picker).
  ══════════════════════════════════════════════════════════ */
  function populateForm(data) {
    FIELDS.forEach((field) => {
      const el    = getEl(field);
      const value = data[field.firestoreKey] || "";
      if (!el) return;

      el.value = value;
      updateCharCounter(field, value);

      // Sync colour picker if this is the theme colour field
      if (field.isColor) syncColorPicker(value);

      // Trigger live image preview for asset fields
      if (field.previewId) updateImagePreview(field, value);
    });
  }

  /* ══════════════════════════════════════════════════════════
     CORE: LOAD FROM FIRESTORE
     ─────────────────────────
     Fetches site-config/main and pre-fills the form.
     Called automatically on page load AND when dashboard.js
     navigates the user to the "Site Config" section.
  ══════════════════════════════════════════════════════════ */
  async function loadConfig() {
    if (saveStatus) {
      saveStatus.textContent = "Loading…";
      saveStatus.style.color = "var(--text-muted)";
    }

    try {
      const docRef  = db.collection(CONFIG_COLLECTION).doc(CONFIG_DOCUMENT);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();
        _savedData = { ...data }; // Store snapshot for reset

        populateForm(data);

        if (statConfigStatus) statConfigStatus.textContent = "Saved";
        if (saveStatus) {
          saveStatus.textContent = `Last saved: ${formatTimestamp(data.updatedAt)}`;
          saveStatus.style.color = "var(--text-muted)";
        }

      } else {
        // Document doesn't exist yet — first-time setup is fine
        _savedData = {};
        populateForm({});
        if (statConfigStatus) statConfigStatus.textContent = "New";
        if (saveStatus) {
          saveStatus.textContent = "No saved config yet. Fill in the form and save.";
          saveStatus.style.color = "var(--text-muted)";
        }
      }

      markClean();

    } catch (err) {
      console.error("[TTW Admin] Failed to load site config:", err);
      if (saveStatus) {
        saveStatus.textContent = "Failed to load. Check Firestore rules.";
        saveStatus.style.color = "var(--danger)";
      }
      window.TTW_Toast?.error(
        "Load Failed",
        "Could not fetch config from Firestore. Check your security rules and connection."
      );
    }
  }

  /* ══════════════════════════════════════════════════════════
     CORE: SAVE TO FIRESTORE
     ───────────────────────
     Validates required fields, builds the 16-key payload,
     then writes to Firestore using set({ merge: true }).
     merge:true creates the document if absent; updates if present
     without wiping keys not in this payload.
  ══════════════════════════════════════════════════════════ */
  async function saveConfig() {

    // ── Client-side validation ─────────────────────────────

    const brandName = document.getElementById("fieldBrandName")?.value.trim();
    if (!brandName) {
      window.TTW_Toast?.error("Validation Error", "Brand Name is required.");
      document.getElementById("fieldBrandName")?.focus();
      return;
    }

    const baseUrl = document.getElementById("fieldBaseUrl")?.value.trim();
    if (!baseUrl) {
      window.TTW_Toast?.error("Validation Error", "Base URL is required (e.g. https://yourdomain.com).");
      document.getElementById("fieldBaseUrl")?.focus();
      return;
    }
    if (!/^https?:\/\/.+/.test(baseUrl)) {
      window.TTW_Toast?.error("Validation Error", "Base URL must start with https:// or http://");
      document.getElementById("fieldBaseUrl")?.focus();
      return;
    }
    // Silently strip any accidental trailing slash before saving
    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");

    const mainSiteUrl = document.getElementById("fieldMainSiteUrl")?.value.trim();
    if (mainSiteUrl && !/^https?:\/\/.+/.test(mainSiteUrl)) {
      window.TTW_Toast?.error("Validation Error", "Main Site URL must start with https:// or http://");
      document.getElementById("fieldMainSiteUrl")?.focus();
      return;
    }

    const contactEmail = document.getElementById("fieldContactEmail")?.value.trim();
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      window.TTW_Toast?.error("Validation Error", "Please enter a valid Contact Email address.");
      document.getElementById("fieldContactEmail")?.focus();
      return;
    }

    const descLen = (document.getElementById("fieldDefaultDesc")?.value || "").length;
    if (descLen > 200) {
      window.TTW_Toast?.error("Validation Error", "Default Description exceeds the 200-character hard limit.");
      document.getElementById("fieldDefaultDesc")?.focus();
      return;
    }

    // ── Build payload ──────────────────────────────────────
    const payload = {};
    FIELDS.forEach((field) => {
      const el  = getEl(field);
      let value = el ? el.value.trim() : "";

      // Apply cleaned baseUrl (trailing slash removed)
      if (field.firestoreKey === "baseUrl") value = cleanBaseUrl;

      payload[field.firestoreKey] = value;
    });

    // Server timestamp — avoids client clock skew
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    // ── Write to Firestore ─────────────────────────────────
    setSaveLoading(true);

    try {
      const docRef = db.collection(CONFIG_COLLECTION).doc(CONFIG_DOCUMENT);
      await docRef.set(payload, { merge: true });

      // Success
      _savedData = { ...payload };
      markClean();

      if (statConfigStatus) statConfigStatus.textContent = "Saved";
      if (saveStatus) {
        saveStatus.textContent = "Saved just now";
        saveStatus.style.color = "var(--accent-dim)";
      }

      window.TTW_Toast?.success(
        "Configuration Saved",
        "All 16 site settings have been updated in Firestore."
      );

    } catch (err) {
      console.error("[TTW Admin] Failed to save site config:", err);
      window.TTW_Toast?.error(
        "Save Failed",
        err.code === "permission-denied"
          ? "Permission denied. Check your Firestore security rules."
          : "Could not save. Check your connection and try again."
      );

    } finally {
      setSaveLoading(false);
    }
  }

  /* ══════════════════════════════════════════════════════════
     RESET FORM
     ──────────
     Restores all 16 fields to the last Firestore snapshot.
     If no data was ever loaded (first-time setup), clears all.
  ══════════════════════════════════════════════════════════ */
  function resetForm() {
    populateForm(_savedData);
    markClean();
    if (saveStatus) {
      saveStatus.textContent = "Form reset to last saved values.";
      saveStatus.style.color = "var(--text-muted)";
    }
  }

  /* ══════════════════════════════════════════════════════════
     EVENT LISTENERS: FIELD INPUTS
     ─────────────────────────────
     Attached to every field in FIELDS:
     • Updates character counter
     • Triggers image preview for asset fields
     • Marks the form dirty
  ══════════════════════════════════════════════════════════ */
  FIELDS.forEach((field) => {
    const el = getEl(field);
    if (!el) return;

    el.addEventListener("input", function () {
      updateCharCounter(field, el.value);
      if (field.previewId) updateImagePreview(field, el.value.trim());
      if (field.isColor)   syncColorPicker(el.value.trim());
      markDirty();
    });
  });

  /* ── Colour picker → sync hex text input ────────────────── */
  if (colorPicker && colorTextInput) {
    colorPicker.addEventListener("input", function () {
      colorTextInput.value = colorPicker.value;
      updateCharCounter(
        FIELDS.find((f) => f.firestoreKey === "themeColor"),
        colorPicker.value
      );
      markDirty();
    });
  }

  /* ── Save button ─────────────────────────────────────────── */
  if (btnSave) btnSave.addEventListener("click", saveConfig);

  /* ── Reset button ────────────────────────────────────────── */
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      if (_isDirty && !window.confirm("Reset all fields to the last saved values?")) return;
      resetForm();
    });
  }

  /* ── Keyboard shortcut: Ctrl / Cmd + S ──────────────────── */
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      const configView = document.getElementById("view-site-config");
      if (configView && configView.classList.contains("active")) {
        e.preventDefault();
        saveConfig();
      }
    }
  });

  /* ── Warn before leaving with unsaved changes ────────────── */
  window.addEventListener("beforeunload", function (e) {
    if (_isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
     ──────────
     dashboard.js calls TTW_SiteConfig.load() when navigating
     to the Site Config section, ensuring fresh data is always
     displayed without a full page reload.
  ══════════════════════════════════════════════════════════ */
  window.TTW_SiteConfig = {
    /** Fetch from Firestore and populate the form. */
    load: loadConfig,
    /** Validate and save the form to Firestore. */
    save: saveConfig,
  };

  /* ── Auto-load on module init (page load) ────────────────── */
  // By the time this IIFE runs the auth guard in dashboard.js has
  // already confirmed the user is authenticated.
  loadConfig();

})(); // End IIFE
