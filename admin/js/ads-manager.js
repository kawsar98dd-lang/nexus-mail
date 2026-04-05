/**
 * ============================================================
 *  ads-manager.js  —  Trusted Tools Web Admin Panel
 *
 *  Responsibilities:
 *  1. FETCH    — Reads  ads/main  from Firestore and populates
 *                all ad-slot textareas + toggle states.
 *  2. SAVE     — Writes the complete ads config back to
 *                Firestore using set({ merge: true }) +
 *                serverTimestamp().
 *  3. TOGGLES  — Global "Enable Ads" switch and per-slot
 *                enable switches with live UI feedback.
 *  4. UX       — Dirty-state tracking, unsaved-changes guard,
 *                byte counters, per-slot Clear buttons, reset.
 *  5. API      — Exposes window.TTW_AdsManager = { load, save }
 *                so dashboard.js can trigger a reload on tab
 *                switch.
 *
 *  FIRESTORE DATA STRUCTURE
 *  ─────────────────────────
 *  Collection : ads
 *  Document   : main
 *  Fields:
 *    globalEnabled    (boolean) — Master ads on/off switch
 *    publisherId      (string)  — AdSense ca-pub-xxxxx ID
 *    adNetwork        (string)  — Selected network label
 *    headerAd         (string)  — Raw HTML/JS for header slot
 *    slotHeaderEnabled(boolean) — Per-slot enable flag
 *    footerAd         (string)  — Raw HTML/JS for footer slot
 *    slotFooterEnabled(boolean) — Per-slot enable flag
 *    sidebarAd        (string)  — Raw HTML/JS for sidebar slot
 *    slotSidebarEnabled(boolean)— Per-slot enable flag
 *    inToolAd         (string)  — Raw HTML/JS for in-tool slot
 *    slotInToolEnabled(boolean) — Per-slot enable flag
 *    updatedAt        (timestamp)— Auto-set on every save
 *
 *  HOW TO READ THIS IN YOUR FRONTEND (ads-loader.js):
 *  ─────────────────────────────────────────────────────
 *    const db  = firebase.firestore();
 *    const snap = await db.collection("ads").doc("main").get();
 *    const ads  = snap.exists ? snap.data() : {};
 *
 *    if (ads.globalEnabled) {
 *      if (ads.slotHeaderEnabled && ads.headerAd) {
 *        document.querySelector("#header-ad-slot").innerHTML = ads.headerAd;
 *      }
 *      // … repeat for footer, sidebar, in-tool
 *    }
 *
 *  Depends on: firebase-config.js, dashboard.js (TTW_Toast)
 * ============================================================
 */

(function () {
  "use strict";

  /* ─── Firestore reference ────────────────────────────────── */
  const db = firebase.firestore();

  /**
   * Firestore path:  ads / main
   * Change these constants if you rename the collection/doc.
   */
  const ADS_COLLECTION = "ads";
  const ADS_DOCUMENT   = "main";

  /* ══════════════════════════════════════════════════════════ */
  /*  FIELD REGISTRY                                            */
  /*                                                            */
  /*  Central map of every form control in the Ads Manager.    */
  /*  type: "textarea" | "checkbox" | "text" | "select"        */
  /* ══════════════════════════════════════════════════════════ */
  const FIELDS = [
    // Global controls
    { inputId: "adsGlobalEnabled",   firestoreKey: "globalEnabled",     type: "checkbox" },
    { inputId: "fieldPublisherId",   firestoreKey: "publisherId",       type: "text"     },
    { inputId: "fieldAdNetwork",     firestoreKey: "adNetwork",         type: "select"   },

    // Ad slot code areas
    { inputId: "fieldHeaderAd",      firestoreKey: "headerAd",          type: "textarea", byteCounterId: "bytes-headerAd"  },
    { inputId: "fieldFooterAd",      firestoreKey: "footerAd",          type: "textarea", byteCounterId: "bytes-footerAd"  },
    { inputId: "fieldSidebarAd",     firestoreKey: "sidebarAd",         type: "textarea", byteCounterId: "bytes-sidebarAd" },
    { inputId: "fieldInToolAd",      firestoreKey: "inToolAd",          type: "textarea", byteCounterId: "bytes-inToolAd"  },

    // Per-slot enable toggles
    { inputId: "slotHeaderEnabled",  firestoreKey: "slotHeaderEnabled",  type: "checkbox" },
    { inputId: "slotFooterEnabled",  firestoreKey: "slotFooterEnabled",  type: "checkbox" },
    { inputId: "slotSidebarEnabled", firestoreKey: "slotSidebarEnabled", type: "checkbox" },
    { inputId: "slotInToolEnabled",  firestoreKey: "slotInToolEnabled",  type: "checkbox" },
  ];

  /**
   * Maps each per-slot enable toggle id to the parent .field-group
   * that should receive the "slot-disabled" CSS class when unchecked.
   *
   * We walk UP from the textarea to find its .field-group ancestor.
   * This map makes that lookup O(1).
   */
  const SLOT_TOGGLE_TO_TEXTAREA = {
    "slotHeaderEnabled":  "fieldHeaderAd",
    "slotFooterEnabled":  "fieldFooterAd",
    "slotSidebarEnabled": "fieldSidebarAd",
    "slotInToolEnabled":  "fieldInToolAd",
  };

  /* ─── DOM references ─────────────────────────────────────── */
  const btnSave         = document.getElementById("btnSaveAds");
  const btnReset        = document.getElementById("btnResetAds");
  const adsSaveStatus   = document.getElementById("adsSaveStatus");
  const globalToggle    = document.getElementById("adsGlobalEnabled");
  const adsView         = document.getElementById("view-ads");

  /* ─── Internal state ─────────────────────────────────────── */
  let _savedData = {};   // Snapshot of last Firestore data (for reset)
  let _isDirty   = false; // Tracks unsaved form changes

  /* ══════════════════════════════════════════════════════════ */
  /*  UTILITY HELPERS                                           */
  /* ══════════════════════════════════════════════════════════ */

  /**
   * Reads the current value of any registered form element.
   * Handles checkboxes (boolean), textareas, inputs, selects.
   * @param {Object} field — from FIELDS array
   * @returns {string|boolean}
   */
  function readField(field) {
    const el = document.getElementById(field.inputId);
    if (!el) return field.type === "checkbox" ? false : "";
    return field.type === "checkbox" ? el.checked : el.value;
  }

  /**
   * Writes a value into any registered form element.
   * @param {Object} field
   * @param {string|boolean} value
   */
  function writeField(field, value) {
    const el = document.getElementById(field.inputId);
    if (!el) return;
    if (field.type === "checkbox") {
      el.checked = Boolean(value);
    } else {
      el.value = value != null ? String(value) : "";
    }
  }

  /**
   * Formats a raw byte count into a human-readable string.
   * e.g. 1536 → "1.5 KB"
   * @param {number} bytes
   * @returns {string}
   */
  function formatBytes(bytes) {
    if (bytes === 0)    return "0 bytes";
    if (bytes < 1024)   return `${bytes} bytes`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  /**
   * Updates the byte counter label for a textarea field.
   * @param {Object} field
   * @param {string} value
   */
  function updateByteCounter(field, value) {
    if (!field.byteCounterId) return;
    const counter = document.getElementById(field.byteCounterId);
    if (!counter) return;
    const bytes = new TextEncoder().encode(value).length;
    counter.textContent = formatBytes(bytes);
    counter.style.color = bytes > 50000
      ? "var(--danger)"
      : bytes > 20000
        ? "var(--warn)"
        : "var(--text-muted)";
  }

  /**
   * Converts a Firestore Timestamp to a readable string.
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

  /* ══════════════════════════════════════════════════════════ */
  /*  DIRTY STATE MANAGEMENT                                    */
  /* ══════════════════════════════════════════════════════════ */

  function markDirty() {
    _isDirty = true;
    if (adsSaveStatus) {
      adsSaveStatus.textContent = "● Unsaved changes";
      adsSaveStatus.style.color = "var(--warn)";
    }
  }

  function markClean(statusText) {
    _isDirty = false;
    if (adsSaveStatus) {
      adsSaveStatus.textContent = statusText || "";
      adsSaveStatus.style.color = "var(--text-muted)";
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  BUTTON STATE                                              */
  /* ══════════════════════════════════════════════════════════ */

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
        Save Ad Configuration`;
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  TOGGLE UI LOGIC                                           */
  /*                                                            */
  /*  Global toggle: dims the entire ad slots panel when OFF.  */
  /*  Per-slot toggle: dims only that slot's textarea.          */
  /* ══════════════════════════════════════════════════════════ */

  /**
   * Syncs the "globally disabled" visual state to the ads view.
   * When global ads are OFF the slot panels get an opacity dim.
   */
  function applyGlobalToggleUi() {
    if (!adsView) return;
    if (globalToggle && !globalToggle.checked) {
      adsView.classList.add("ads-globally-disabled");
    } else {
      adsView.classList.remove("ads-globally-disabled");
    }
  }

  /**
   * Syncs the disabled visual state for a single slot.
   * @param {string} toggleId — e.g. "slotHeaderEnabled"
   * @param {boolean} checked
   */
  function applySlotToggleUi(toggleId, checked) {
    const textareaId = SLOT_TOGGLE_TO_TEXTAREA[toggleId];
    if (!textareaId) return;

    // Walk up to the nearest .field-group ancestor
    const textarea   = document.getElementById(textareaId);
    const fieldGroup = textarea ? textarea.closest(".field-group") : null;
    if (!fieldGroup) return;

    if (checked) {
      fieldGroup.classList.remove("slot-disabled");
    } else {
      fieldGroup.classList.add("slot-disabled");
    }
  }

  /**
   * Applies toggle UI for all slots at once (called after load).
   */
  function applyAllSlotTogglesUi() {
    Object.keys(SLOT_TOGGLE_TO_TEXTAREA).forEach((toggleId) => {
      const el = document.getElementById(toggleId);
      applySlotToggleUi(toggleId, el ? el.checked : false);
    });
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  CORE: LOAD FROM FIRESTORE                                 */
  /*                                                            */
  /*  Reads  ads/main  and populates every registered field.    */
  /*  Safe to call multiple times (idempotent).                 */
  /* ══════════════════════════════════════════════════════════ */

  async function loadAds() {
    if (adsSaveStatus) {
      adsSaveStatus.textContent = "Loading…";
      adsSaveStatus.style.color = "var(--text-muted)";
    }

    try {
      const docRef  = db.collection(ADS_COLLECTION).doc(ADS_DOCUMENT);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();
        _savedData = { ...data }; // Snapshot for reset

        // ── Populate all fields ────────────────────────────
        FIELDS.forEach((field) => {
          const value = data.hasOwnProperty(field.firestoreKey)
            ? data[field.firestoreKey]
            : (field.type === "checkbox" ? true : ""); // sensible defaults

          writeField(field, value);

          // Update byte counters for textarea fields
          if (field.type === "textarea") {
            updateByteCounter(field, String(value || ""));
          }
        });

        // ── Apply toggle UI states ─────────────────────────
        applyGlobalToggleUi();
        applyAllSlotTogglesUi();

        markClean(`Last saved: ${formatTimestamp(data.updatedAt)}`);

      } else {
        // ── First-time setup: apply sensible defaults ──────
        _savedData = {};

        // Default: global ads ON, all slots ON
        if (globalToggle) globalToggle.checked = true;
        ["slotHeaderEnabled", "slotFooterEnabled",
         "slotSidebarEnabled", "slotInToolEnabled"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.checked = true;
        });

        applyGlobalToggleUi();
        applyAllSlotTogglesUi();

        markClean("No ad config saved yet. Fill in the slots and save.");
      }

    } catch (err) {
      console.error("[TTW Admin] Failed to load ads config:", err);
      markClean("Failed to load. Check Firestore rules.");
      window.TTW_Toast?.error(
        "Load Failed",
        "Could not fetch ad config from Firestore. Check your security rules."
      );
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  CORE: SAVE TO FIRESTORE                                   */
  /*                                                            */
  /*  Collects every field value, attaches a serverTimestamp,  */
  /*  and writes to Firestore with set({ merge: true }).        */
  /*                                                            */
  /*  WHY merge: true?                                          */
  /*  Future admin steps (Comments etc.) might add fields to    */
  /*  documents we also touch here. merge ensures we never      */
  /*  accidentally wipe data we didn't write.                   */
  /* ══════════════════════════════════════════════════════════ */

  async function saveAds() {
    // ── Build the payload ────────────────────────────────────
    const payload = {};

    FIELDS.forEach((field) => {
      payload[field.firestoreKey] = readField(field);
    });

    // Server-side timestamp prevents clock-skew issues
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    // ── Light validation ─────────────────────────────────────
    const publisherId = payload.publisherId;
    if (
      publisherId &&
      publisherId.trim() !== "" &&
      !/^ca-pub-\d{16}$/.test(publisherId.trim())
    ) {
      window.TTW_Toast?.error(
        "Validation Error",
        "AdSense Publisher ID must follow the format: ca-pub-0000000000000000"
      );
      document.getElementById("fieldPublisherId")?.focus();
      return;
    }

    // ── Write ────────────────────────────────────────────────
    setSaveLoading(true);

    try {
      await db
        .collection(ADS_COLLECTION)
        .doc(ADS_DOCUMENT)
        .set(payload, { merge: true });

      // ── Success ──────────────────────────────────────────
      _savedData = { ...payload };
      markClean("Saved just now");

      window.TTW_Toast?.success(
        "Ad Config Saved",
        "Your ad slot settings have been updated in Firestore."
      );

    } catch (err) {
      console.error("[TTW Admin] Failed to save ads config:", err);

      window.TTW_Toast?.error(
        "Save Failed",
        err.code === "permission-denied"
          ? "Permission denied. Verify your Firestore security rules."
          : "Could not save. Check your connection and retry."
      );

    } finally {
      setSaveLoading(false);
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  RESET FORM                                                */
  /*                                                            */
  /*  Restores all fields to the last values loaded from        */
  /*  Firestore. If no data has been saved yet, clears fields.  */
  /* ══════════════════════════════════════════════════════════ */

  function resetForm() {
    FIELDS.forEach((field) => {
      const value = _savedData.hasOwnProperty(field.firestoreKey)
        ? _savedData[field.firestoreKey]
        : (field.type === "checkbox" ? true : "");

      writeField(field, value);

      if (field.type === "textarea") {
        updateByteCounter(field, String(value || ""));
      }
    });

    applyGlobalToggleUi();
    applyAllSlotTogglesUi();
    markClean("Form reset to last saved values.");
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  EVENT LISTENERS                                           */
  /* ══════════════════════════════════════════════════════════ */

  // ── Attach change/input listeners to all fields ─────────────
  FIELDS.forEach((field) => {
    const el = document.getElementById(field.inputId);
    if (!el) return;

    const eventType = field.type === "checkbox" ? "change" : "input";

    el.addEventListener(eventType, function () {
      markDirty();

      // Update byte counter for textareas on every keystroke
      if (field.type === "textarea") {
        updateByteCounter(field, el.value);
      }

      // React to global toggle change immediately
      if (field.inputId === "adsGlobalEnabled") {
        applyGlobalToggleUi();
      }

      // React to per-slot toggle changes
      if (SLOT_TOGGLE_TO_TEXTAREA[field.inputId] !== undefined) {
        applySlotToggleUi(field.inputId, el.checked);
      }
    });
  });

  // ── Save button ──────────────────────────────────────────────
  if (btnSave) {
    btnSave.addEventListener("click", saveAds);
  }

  // ── Reset button ─────────────────────────────────────────────
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      if (_isDirty) {
        if (!window.confirm("Reset all ad fields to the last saved values?")) return;
      }
      resetForm();
    });
  }

  // ── Per-slot "Clear" buttons (delegated) ─────────────────────
  //    Each Clear button carries  data-clear-field="fieldHeaderAd" etc.
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".ads-clear-btn");
    if (!btn) return;

    const targetId = btn.dataset.clearField;
    const textarea = document.getElementById(targetId);
    if (!textarea) return;

    if (textarea.value.trim() === "") return; // Nothing to clear

    if (!window.confirm(`Clear the ${targetId.replace("field", "").replace(/([A-Z])/g, " $1").trim()} slot code?`)) return;

    textarea.value = "";
    markDirty();

    // Find the matching field definition and update its byte counter
    const field = FIELDS.find((f) => f.inputId === targetId);
    if (field) updateByteCounter(field, "");
  });

  // ── Keyboard shortcut: Ctrl/Cmd + S ──────────────────────────
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      const adsView = document.getElementById("view-ads");
      if (adsView && adsView.classList.contains("active")) {
        e.preventDefault();
        saveAds();
      }
    }
  });

  // ── Before-unload warning ────────────────────────────────────
  //    Complements the one in dashboard.js (belt-and-suspenders).
  window.addEventListener("beforeunload", function (e) {
    if (_isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ══════════════════════════════════════════════════════════ */
  /*  DASHBOARD NAVIGATION HOOK                                 */
  /*                                                            */
  /*  dashboard.js calls TTW_AdsManager.load() whenever the    */
  /*  user switches to the "ads" section, ensuring the latest   */
  /*  Firestore data is always displayed.                        */
  /*                                                            */
  /*  Add this line to the switchSection() function in          */
  /*  dashboard.js (inside the if-chain for section keys):      */
  /*                                                            */
  /*    if (sectionKey === "ads" && window.TTW_AdsManager) {   */
  /*      window.TTW_AdsManager.load();                         */
  /*    }                                                        */
  /* ══════════════════════════════════════════════════════════ */

  window.TTW_AdsManager = {
    load: loadAds,
    save: saveAds,
  };

  /* ── Auto-load on module init ────────────────────────────── */
  loadAds();

})(); // End IIFE
