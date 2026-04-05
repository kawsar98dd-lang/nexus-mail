/**
 * ============================================================
 *  site-config-manager.js  —  Trusted Tools Web Admin Panel
 *
 *  Responsibilities:
 *  1. FETCH  — Reads the Firestore document  site-config/main
 *              and pre-fills the Site Config form on load.
 *  2. SAVE   — Writes (merge) form data back to Firestore
 *              when the Save button is clicked.
 *  3. UX     — Character counters, live logo preview, save
 *              status indicator, dirty-state tracking, reset.
 *
 *  FIRESTORE DATA STRUCTURE
 *  ─────────────────────────
 *  Collection : site-config
 *  Document   : main
 *  Fields:
 *    siteTitle       (string) — Browser title & SEO <title>
 *    tagline         (string) — Hero section subtitle
 *    contactEmail    (string) — Contact page email
 *    siteUrl         (string) — Canonical URL (https://…)
 *    logoUrl         (string) — Full URL to logo image
 *    metaDescription (string) — SEO meta description
 *    footerCopyright (string) — Footer copyright line
 *    updatedAt       (timestamp) — Auto-set on every save
 *
 *  HOW TO READ THIS IN YOUR FRONTEND (site-config.js):
 *  ─────────────────────────────────────────────────────
 *    const db  = firebase.firestore();
 *    const doc = await db.collection("site-config").doc("main").get();
 *    const cfg = doc.exists ? doc.data() : {};
 *    document.title = cfg.siteTitle || "Trusted Tools Web";
 *    // … etc.
 *
 *  Depends on: firebase-config.js, dashboard.js (for TTW_Toast)
 * ============================================================
 */

(function () {
  "use strict";

  /* ─── Firestore reference ────────────────────────────────── */
  // `firebase` is available globally from the Firebase compat SDK.
  // `ttw_auth` is defined in firebase-config.js.
  const db = firebase.firestore();

  /**
   * Firestore path for site configuration.
   * Collection: "site-config" | Document: "main"
   *
   * Buyer note: If you want to rename this collection, change
   * the two constants below AND update your Firestore Rules.
   */
  const CONFIG_COLLECTION = "site-config";
  const CONFIG_DOCUMENT   = "main";

  /* ─── Field definitions ──────────────────────────────────── */
  /**
   * Maps each form field's:
   *   inputId     — HTML element id
   *   firestoreKey — Key stored in Firestore document
   *   maxLen      — Hard character limit (for counter display)
   *   softLen     — "Warning" threshold for the counter
   *   isTextarea  — true if it's a <textarea> element
   */
  const FIELDS = [
    { inputId: "fieldSiteTitle",   firestoreKey: "siteTitle",       maxLen: 70,  softLen: 55  },
    { inputId: "fieldTagline",     firestoreKey: "tagline",         maxLen: 100, softLen: 80  },
    { inputId: "fieldContactEmail",firestoreKey: "contactEmail",    maxLen: null                },
    { inputId: "fieldSiteUrl",     firestoreKey: "siteUrl",         maxLen: null                },
    { inputId: "fieldLogoUrl",     firestoreKey: "logoUrl",         maxLen: null                },
    { inputId: "fieldMetaDesc",    firestoreKey: "metaDescription", maxLen: 200, softLen: 160, isTextarea: true },
    { inputId: "fieldFooterCopy",  firestoreKey: "footerCopyright", maxLen: 120, softLen: 100 },
  ];

  /* ─── DOM references ─────────────────────────────────────── */
  const btnSave     = document.getElementById("btnSaveConfig");
  const btnReset    = document.getElementById("btnResetConfig");
  const saveStatus  = document.getElementById("saveStatus");
  const logoPreview = document.getElementById("logoPreview");
  const logoPreviewLabel = document.getElementById("logoPreviewLabel");
  const statConfigStatus = document.getElementById("statConfigStatus"); // on dashboard overview

  /* ─── State ──────────────────────────────────────────────── */
  let _savedData    = {};   // Last data fetched from Firestore (used for reset)
  let _isDirty      = false; // Has the user changed any field since last save?

  /* ══════════════════════════════════════════════════════════ */
  /*  UTILITY FUNCTIONS                                         */
  /* ══════════════════════════════════════════════════════════ */

  /**
   * Returns the HTMLElement for a given field definition.
   * @param {Object} field
   * @returns {HTMLElement|null}
   */
  function getEl(field) {
    return document.getElementById(field.inputId);
  }

  /**
   * Updates the character counter element for a field.
   * Applies warning/over-limit colour classes.
   * @param {Object} field
   * @param {string} value
   */
  function updateCharCounter(field, value) {
    if (!field.maxLen) return;
    const counterId = "cc-" + field.firestoreKey;
    const counter   = document.getElementById(counterId);
    if (!counter) return;

    const len = value.length;

    // Special label for meta description (has a soft SEO cap of 160)
    if (field.firestoreKey === "metaDescription") {
      counter.textContent = `${len} / 160 recommended`;
      counter.className   = "char-counter" + (len > 200 ? " over" : len > 160 ? " warn" : "");
    } else {
      counter.textContent = `${len} / ${field.maxLen}`;
      counter.className   = "char-counter" +
        (len >= field.maxLen             ? " over" :
         field.softLen && len > field.softLen ? " warn" : "");
    }
  }

  /**
   * Updates the logo preview image when the Logo URL field changes.
   * Shows a placeholder label when the URL is empty or fails to load.
   * @param {string} url
   */
  function updateLogoPreview(url) {
    if (!logoPreview) return;
    if (!url) {
      logoPreview.classList.remove("visible");
      if (logoPreviewLabel) logoPreviewLabel.textContent = "Enter a URL above to preview your logo.";
      return;
    }
    logoPreview.src = url;
    logoPreview.onload = () => {
      logoPreview.classList.add("visible");
      if (logoPreviewLabel) logoPreviewLabel.textContent = "Logo loaded successfully.";
    };
    logoPreview.onerror = () => {
      logoPreview.classList.remove("visible");
      if (logoPreviewLabel) logoPreviewLabel.textContent = "⚠️ Could not load image. Check the URL.";
    };
  }

  /**
   * Marks the form as dirty (unsaved changes exist).
   * Updates the save status indicator.
   */
  function markDirty() {
    _isDirty = true;
    if (saveStatus) {
      saveStatus.textContent = "● Unsaved changes";
      saveStatus.style.color = "var(--warn)";
    }
  }

  /**
   * Clears the dirty state (after a successful save or reset).
   */
  function markClean() {
    _isDirty = false;
    if (saveStatus) {
      saveStatus.textContent = "";
    }
  }

  /**
   * Sets the Save button into a loading or ready state.
   * @param {boolean} isLoading
   */
  function setSaveLoading(isLoading) {
    if (!btnSave) return;
    btnSave.disabled = isLoading;
    if (isLoading) {
      btnSave.innerHTML = '<span class="btn-spinner"></span> Saving…';
    } else {
      btnSave.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Save Configuration`;
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  CORE: LOAD FROM FIRESTORE                                 */
  /*                                                            */
  /*  Reads document  site-config/main  from Firestore and     */
  /*  pre-fills the form. If the document doesn't exist yet     */
  /*  (first-time setup), the form starts blank — that's fine. */
  /* ══════════════════════════════════════════════════════════ */

  /**
   * Fetches site config from Firestore and populates the form.
   * Called automatically on page load and when switching to the
   * "Site Config" section from the dashboard.
   */
  async function loadConfig() {
    // Show loading state in Save Status
    if (saveStatus) {
      saveStatus.textContent  = "Loading…";
      saveStatus.style.color  = "var(--text-muted)";
    }

    try {
      const docRef  = db.collection(CONFIG_COLLECTION).doc(CONFIG_DOCUMENT);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();
        _savedData = { ...data }; // Store snapshot for reset

        // Populate each form field with Firestore data
        FIELDS.forEach((field) => {
          const el    = getEl(field);
          const value = data[field.firestoreKey] || "";
          if (el) {
            el.value = value;
            updateCharCounter(field, value);
          }
        });

        // Trigger logo preview for existing URL
        updateLogoPreview(data.logoUrl || "");

        // Update overview stat card
        if (statConfigStatus) statConfigStatus.textContent = "Saved";

        if (saveStatus) {
          saveStatus.textContent = `Last saved: ${formatTimestamp(data.updatedAt)}`;
          saveStatus.style.color = "var(--text-muted)";
        }

      } else {
        // Document doesn't exist yet — first-time setup
        _savedData = {};
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
      if (window.TTW_Toast) {
        TTW_Toast.error(
          "Load Failed",
          "Could not fetch config from Firestore. Check your security rules and connection."
        );
      }
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  CORE: SAVE TO FIRESTORE                                   */
  /*                                                            */
  /*  Collects all form values, validates them, then writes     */
  /*  to Firestore using set() with { merge: true }.            */
  /*                                                            */
  /*  merge: true means existing fields not in our payload      */
  /*  are preserved — safe for partial updates in future steps. */
  /* ══════════════════════════════════════════════════════════ */

  /**
   * Validates and saves the form data to Firestore.
   */
  async function saveConfig() {
    // ── Client-side validation ───────────────────────────────
    const siteTitle = document.getElementById("fieldSiteTitle")?.value.trim();
    if (!siteTitle) {
      TTW_Toast?.error("Validation Error", "Site Title is required.");
      document.getElementById("fieldSiteTitle")?.focus();
      return;
    }

    const contactEmail = document.getElementById("fieldContactEmail")?.value.trim();
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      TTW_Toast?.error("Validation Error", "Please enter a valid Contact Email address.");
      document.getElementById("fieldContactEmail")?.focus();
      return;
    }

    const siteUrl = document.getElementById("fieldSiteUrl")?.value.trim();
    if (siteUrl && !/^https?:\/\/.+/.test(siteUrl)) {
      TTW_Toast?.error("Validation Error", "Site URL must start with http:// or https://");
      document.getElementById("fieldSiteUrl")?.focus();
      return;
    }

    // ── Build payload ────────────────────────────────────────
    const payload = {};
    FIELDS.forEach((field) => {
      const el = getEl(field);
      payload[field.firestoreKey] = el ? el.value.trim() : "";
    });

    // Always record the last-updated timestamp using Firestore server time
    // (avoids clock skew between client and Firebase server)
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    // ── Write to Firestore ───────────────────────────────────
    setSaveLoading(true);

    try {
      const docRef = db.collection(CONFIG_COLLECTION).doc(CONFIG_DOCUMENT);

      // set() with merge:true creates the document if it doesn't exist,
      // or merges fields if it does. This is safer than update() which
      // throws an error on non-existent documents.
      await docRef.set(payload, { merge: true });

      // ── Success ──────────────────────────────────────────
      _savedData = { ...payload };
      markClean();

      if (statConfigStatus) statConfigStatus.textContent = "Saved";
      if (saveStatus) {
        saveStatus.textContent = "Saved just now";
        saveStatus.style.color  = "var(--accent-dim)";
      }

      TTW_Toast?.success(
        "Configuration Saved",
        "Your site settings have been updated in Firestore."
      );

    } catch (err) {
      console.error("[TTW Admin] Failed to save site config:", err);

      TTW_Toast?.error(
        "Save Failed",
        err.code === "permission-denied"
          ? "Permission denied. Check your Firestore security rules."
          : "Could not save. Check your connection and try again."
      );

    } finally {
      setSaveLoading(false);
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  RESET FORM                                                */
  /*                                                            */
  /*  Restores the form to the last-saved Firestore values.     */
  /*  If no data has been loaded, clears all fields.            */
  /* ══════════════════════════════════════════════════════════ */

  function resetForm() {
    FIELDS.forEach((field) => {
      const el    = getEl(field);
      const value = _savedData[field.firestoreKey] || "";
      if (el) {
        el.value = value;
        updateCharCounter(field, value);
      }
    });
    updateLogoPreview(_savedData.logoUrl || "");
    markClean();

    if (saveStatus) {
      saveStatus.textContent = "Form reset to last saved values.";
      saveStatus.style.color  = "var(--text-muted)";
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  EVENT LISTENERS: FORM INPUTS                              */
  /* ══════════════════════════════════════════════════════════ */

  FIELDS.forEach((field) => {
    const el = getEl(field);
    if (!el) return;

    // Character counter + dirty tracking
    el.addEventListener("input", function () {
      updateCharCounter(field, el.value);
      markDirty();

      // Live logo preview
      if (field.firestoreKey === "logoUrl") {
        updateLogoPreview(el.value.trim());
      }
    });
  });

  /* ─── Save button ────────────────────────────────────────── */
  if (btnSave) {
    btnSave.addEventListener("click", saveConfig);
  }

  /* ─── Reset button ───────────────────────────────────────── */
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      if (_isDirty) {
        // Simple confirm — avoids pulling in a modal library
        if (!window.confirm("Reset all fields to the last saved values?")) return;
      }
      resetForm();
    });
  }

  /* ─── Keyboard shortcut: Ctrl/Cmd + S to save ───────────── */
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      // Only intercept when the site-config section is visible
      const configView = document.getElementById("view-site-config");
      if (configView && configView.classList.contains("active")) {
        e.preventDefault();
        saveConfig();
      }
    }
  });

  /* ─── Warn before leaving with unsaved changes ───────────── */
  window.addEventListener("beforeunload", function (e) {
    if (_isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ══════════════════════════════════════════════════════════ */
  /*  HELPER: FORMAT FIRESTORE TIMESTAMP                        */
  /* ══════════════════════════════════════════════════════════ */

  /**
   * Converts a Firestore Timestamp (or null) to a readable string.
   * @param {firebase.firestore.Timestamp|null} ts
   * @returns {string}
   */
  function formatTimestamp(ts) {
    if (!ts || !ts.toDate) return "Unknown";
    const d = ts.toDate();
    return d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  EXPOSE PUBLIC API                                         */
  /*                                                            */
  /*  dashboard.js calls TTW_SiteConfig.load() when the user   */
  /*  navigates to the Site Config section, ensuring fresh data */
  /*  is always shown.                                          */
  /* ══════════════════════════════════════════════════════════ */

  window.TTW_SiteConfig = {
    load: loadConfig,
    save: saveConfig,
  };

  /* ── Auto-load on module init (page load) ─────────────────── */
  // Wait for the auth state to be confirmed (dashboard.js handles
  // the redirect guard). By the time this runs, we know the user
  // is authenticated because unauthenticated users are redirected.
  loadConfig();

})(); // End IIFE
