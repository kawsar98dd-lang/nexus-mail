/**
 * ============================================================
 *  ads-manager.js  —  Trusted Tools Web Admin Panel
 *  Version: 2.0.0
 *
 *  Responsibilities:
 *  1. FETCH    — Reads  ads/main  from Firestore and populates
 *                the entire Pro Ad Manager form (deep nested).
 *  2. SAVE     — Builds a properly nested payload object from
 *                all form fields and writes to Firestore using
 *                set({ merge: true }) + serverTimestamp().
 *  3. TOGGLES  — Global "Enable Ads" switch, three network
 *                master toggles, with live UI feedback.
 *  4. UX       — Dirty-state tracking, unsaved-changes guard,
 *                byte counters, Clear buttons, keyboard save,
 *                reset-to-last-saved.
 *  5. API      — Exposes window.TTW_AdsManager = { load, save }
 *                so dashboard.js can trigger a reload on tab
 *                switch.
 *
 *  FIRESTORE DATA STRUCTURE  (ads / main)
 *  ────────────────────────────────────────────────────────────
 *  {
 *    adsGlobalEnabled: boolean,
 *    options: {
 *      lazyLoad:   boolean,
 *      retryDelay: number,
 *      maxRetries: number
 *    },
 *    priority: [ "adsterra", "adsense", "custom" ],
 *    adsterra: {
 *      enabled: boolean,
 *      slots: {
 *        "top-banner":    { src, atOptions: { key, format, width, height, params }, width, height, type },
 *        "bottom-banner": { src, atOptions: { key, format, width, height, params }, width, height, type }
 *      }
 *    },
 *    adsense: {
 *      enabled:   boolean,
 *      client_id: string,
 *      slots: {
 *        "top-banner":    string,
 *        "bottom-banner": string,
 *        "in-content":    string,
 *        "sidebar":       string
 *      }
 *    },
 *    custom: {
 *      enabled: boolean,
 *      slots: {
 *        "top-banner":    string,
 *        "bottom-banner": string
 *      }
 *    },
 *    updatedAt: Timestamp
 *  }
 *
 *  FIELD CONVENTION
 *  ────────────────────────────────────────────────────────────
 *  Every HTML form element carries a  data-ads-field  attribute
 *  using dot-notation to describe its path in the nested object
 *  above. Examples:
 *    data-ads-field="options.lazyLoad"
 *    data-ads-field="adsterra.slots.top-banner.atOptions.key"
 *    data-ads-field="priority.0"
 *
 *  getNestedValue() / setNestedValue() / buildNestedPayload()
 *  translate between flat dot-paths and the nested structure.
 *
 *  Depends on: firebase-config.js, dashboard.js (TTW_Toast)
 * ============================================================
 */

(function () {
  "use strict";

  /* ─── Firestore reference ────────────────────────────────── */
  const db             = firebase.firestore();
  const ADS_COLLECTION = "ads";
  const ADS_DOCUMENT   = "main";

  /* ══════════════════════════════════════════════════════════
     FIELD REGISTRY
     ══════════════════════════════════════════════════════════
     Central source of truth for every form control.

     firestoreKey : dot-notation path matching the
                    data-ads-field attribute in the HTML and
                    the nested Firestore document structure.
     type         : "checkbox" | "text" | "number" |
                    "select"   | "textarea"
     byteCounterId: (textarea only) id of the <span> that
                    shows live byte usage.
     defaultValue : value applied when the Firestore field is
                    absent (first-time setup / new installs).
  ══════════════════════════════════════════════════════════ */
  const FIELDS = [

    // ── Global ────────────────────────────────────────────────
    {
      inputId:      "adsGlobalEnabled",
      firestoreKey: "adsGlobalEnabled",
      type:         "checkbox",
      defaultValue: true,
    },

    // ── options ───────────────────────────────────────────────
    {
      inputId:      "adsLazyLoad",
      firestoreKey: "options.lazyLoad",
      type:         "checkbox",
      defaultValue: false,
    },
    {
      inputId:      "adsRetryDelay",
      firestoreKey: "options.retryDelay",
      type:         "number",
      defaultValue: 500,
    },
    {
      inputId:      "adsMaxRetries",
      firestoreKey: "options.maxRetries",
      type:         "number",
      defaultValue: 3,
    },

    // ── priority (three ordered selects → normalised to array) ─
    {
      inputId:      "adsPriority1",
      firestoreKey: "priority.0",
      type:         "select",
      defaultValue: "adsterra",
    },
    {
      inputId:      "adsPriority2",
      firestoreKey: "priority.1",
      type:         "select",
      defaultValue: "adsense",
    },
    {
      inputId:      "adsPriority3",
      firestoreKey: "priority.2",
      type:         "select",
      defaultValue: "custom",
    },

    // ── adsterra ──────────────────────────────────────────────
    {
      inputId:      "adsterraMasterEnabled",
      firestoreKey: "adsterra.enabled",
      type:         "checkbox",
      defaultValue: true,
    },
    // top-banner
    {
      inputId:      "adsterraTopSrc",
      firestoreKey: "adsterra.slots.top-banner.src",
      type:         "text",
      defaultValue: "",
    },
    {
      inputId:      "adsterraTopKey",
      firestoreKey: "adsterra.slots.top-banner.atOptions.key",
      type:         "text",
      defaultValue: "",
    },
    {
      inputId:      "adsterraTopWidth",
      firestoreKey: "adsterra.slots.top-banner.width",
      type:         "number",
      defaultValue: 300,
    },
    {
      inputId:      "adsterraTopHeight",
      firestoreKey: "adsterra.slots.top-banner.height",
      type:         "number",
      defaultValue: 250,
    },
    // bottom-banner
    {
      inputId:      "adsterraBottomSrc",
      firestoreKey: "adsterra.slots.bottom-banner.src",
      type:         "text",
      defaultValue: "",
    },
    {
      inputId:      "adsterraBottomKey",
      firestoreKey: "adsterra.slots.bottom-banner.atOptions.key",
      type:         "text",
      defaultValue: "",
    },
    {
      inputId:      "adsterraBottomWidth",
      firestoreKey: "adsterra.slots.bottom-banner.width",
      type:         "number",
      defaultValue: 320,
    },
    {
      inputId:      "adsterraBottomHeight",
      firestoreKey: "adsterra.slots.bottom-banner.height",
      type:         "number",
      defaultValue: 50,
    },

    // ── adsense ───────────────────────────────────────────────
    {
      inputId:      "adsenseMasterEnabled",
      firestoreKey: "adsense.enabled",
      type:         "checkbox",
      defaultValue: false,
    },
    {
      inputId:      "adsenseClientId",
      firestoreKey: "adsense.client_id",
      type:         "text",
      defaultValue: "",
    },
    {
      inputId:      "adsenseSlotTopBanner",
      firestoreKey: "adsense.slots.top-banner",
      type:         "text",
      defaultValue: "",
    },
    {
      inputId:      "adsenseSlotBottomBanner",
      firestoreKey: "adsense.slots.bottom-banner",
      type:         "text",
      defaultValue: "",
    },
    {
      inputId:      "adsenseSlotInContent",
      firestoreKey: "adsense.slots.in-content",
      type:         "text",
      defaultValue: "",
    },
    {
      inputId:      "adsenseSlotSidebar",
      firestoreKey: "adsense.slots.sidebar",
      type:         "text",
      defaultValue: "",
    },

    // ── custom HTML ads ───────────────────────────────────────
    {
      inputId:      "customMasterEnabled",
      firestoreKey: "custom.enabled",
      type:         "checkbox",
      defaultValue: false,
    },
    {
      inputId:       "customTopBanner",
      firestoreKey:  "custom.slots.top-banner",
      type:          "textarea",
      defaultValue:  "",
      byteCounterId: "bytes-customTop",
    },
    {
      inputId:       "customBottomBanner",
      firestoreKey:  "custom.slots.bottom-banner",
      type:          "textarea",
      defaultValue:  "",
      byteCounterId: "bytes-customBottom",
    },

  ]; // end FIELDS

  /* ══════════════════════════════════════════════════════════
     NETWORK PANEL MAP
     Maps each master-toggle inputId to the id of the panel
     body that should be dimmed when the toggle is OFF.
  ══════════════════════════════════════════════════════════ */
  const NETWORK_PANEL_MAP = {
    adsterraMasterEnabled: "adsterraPanelBody",
    adsenseMasterEnabled:  "adsensePanelBody",
    customMasterEnabled:   "customPanelBody",
  };

  /* ─── DOM references ─────────────────────────────────────── */
  const btnSave       = document.getElementById("btnSaveAds");
  const btnReset      = document.getElementById("btnResetAds");
  const adsSaveStatus = document.getElementById("adsSaveStatus");
  const globalToggle  = document.getElementById("adsGlobalEnabled");
  const adsView       = document.getElementById("view-ads");

  /* ─── Internal state ─────────────────────────────────────── */
  // Flat snapshot keyed by firestoreKey — used by resetForm().
  let _savedData = {};
  let _isDirty   = false;

  /* ══════════════════════════════════════════════════════════
     DEEP OBJECT HELPERS
  ══════════════════════════════════════════════════════════ */

  /**
   * getNestedValue(obj, "a.b.c")
   *
   * Safely reads a deeply nested value via a dot-path string.
   * Handles hyphenated segment names (e.g. "slots.top-banner.src")
   * because String.split(".") on a path like that will correctly
   * yield ["slots", "top-banner", "src"] — hyphens are not dots,
   * so they pass through untouched.
   *
   * @param {Object} obj
   * @param {string} path  — dot-notation path
   * @returns {*}  the value, or undefined if any segment is missing
   */
  function getNestedValue(obj, path) {
    return path.split(".").reduce(function (current, key) {
      return (current != null && typeof current === "object")
        ? current[key]
        : undefined;
    }, obj);
  }

  /**
   * setNestedValue(obj, "a.b.c", value)
   *
   * Writes a value into a deeply nested position.
   * Creates plain-object intermediates on the fly.
   *
   * @param {Object} obj
   * @param {string} path
   * @param {*}      value
   */
  function setNestedValue(obj, path, value) {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] == null || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * buildNestedPayload()
   *
   * Iterates over FIELDS, reads each form element with the
   * correct type cast, and assembles a properly nested object
   * ready for Firestore.
   *
   * WHY this matters:
   *   Writing { "options.lazyLoad": true } to Firestore creates a
   *   field whose literal name is the string "options.lazyLoad".
   *   This function produces { options: { lazyLoad: true } } so
   *   the engine receives the nested structure it expects.
   *
   * @returns {Object}
   */
  function buildNestedPayload() {
    const payload = {};
    FIELDS.forEach(function (field) {
      setNestedValue(payload, field.firestoreKey, readField(field));
    });
    return payload;
  }

  /* ══════════════════════════════════════════════════════════
     FIELD READ / WRITE
  ══════════════════════════════════════════════════════════ */

  /**
   * Reads a form element and casts to the correct JS type.
   *   checkbox → boolean
   *   number   → Number  (NaN falls back to 0)
   *   *        → string
   *
   * @param {Object} field
   * @returns {boolean|number|string}
   */
  function readField(field) {
    const el = document.getElementById(field.inputId);
    if (!el) {
      return field.type === "checkbox" ? false
           : field.type === "number"   ? 0
           : "";
    }

    if (field.type === "checkbox") return el.checked;

    if (field.type === "number") {
      const n = parseFloat(el.value);
      return isNaN(n) ? 0 : n;
    }

    return el.value; // text | textarea | select → string
  }

  /**
   * Writes a Firestore value into a form element.
   *
   * @param {Object} field
   * @param {*}      value
   */
  function writeField(field, value) {
    const el = document.getElementById(field.inputId);
    if (!el) return;

    if (field.type === "checkbox") {
      el.checked = Boolean(value);
    } else if (field.type === "number") {
      el.value = (value != null && value !== "") ? String(value) : "";
    } else {
      el.value = value != null ? String(value) : "";
    }
  }

  /* ══════════════════════════════════════════════════════════
     UX UTILITIES
  ══════════════════════════════════════════════════════════ */

  function formatBytes(bytes) {
    if (bytes === 0)  return "0 bytes";
    if (bytes < 1024) return `${bytes} bytes`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  /**
   * Updates the byte-counter <span> for a textarea field.
   * Colour thresholds: warn ≥ 20 KB, danger ≥ 50 KB.
   */
  function updateByteCounter(field, value) {
    if (!field.byteCounterId) return;
    const counter = document.getElementById(field.byteCounterId);
    if (!counter) return;
    const bytes = new TextEncoder().encode(value).length;
    counter.textContent = formatBytes(bytes);
    counter.style.color =
      bytes > 50000 ? "var(--danger)" :
      bytes > 20000 ? "var(--warn)"   :
                      "var(--text-muted)";
  }

  function formatTimestamp(ts) {
    if (!ts || !ts.toDate) return "Unknown";
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  /* ══════════════════════════════════════════════════════════
     DIRTY STATE
  ══════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════
     SAVE BUTTON STATE
  ══════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════
     TOGGLE UI LOGIC

     Three levels:
       1. Global (adsGlobalEnabled)
          → adds .ads-globally-disabled to #view-ads
          → existing CSS rule dims all network panels.
       2. Network master toggles (adsterra / adsense / custom)
          → adds .ads-network-disabled to the specific panel body.
  ══════════════════════════════════════════════════════════ */

  function applyGlobalToggleUi() {
    if (!adsView) return;
    const enabled = globalToggle ? globalToggle.checked : true;
    adsView.classList.toggle("ads-globally-disabled", !enabled);
  }

  /**
   * @param {string}  toggleId — key in NETWORK_PANEL_MAP
   * @param {boolean} checked
   */
  function applyNetworkPanelUi(toggleId, checked) {
    const panelBodyId = NETWORK_PANEL_MAP[toggleId];
    if (!panelBodyId) return;
    const panelBody = document.getElementById(panelBodyId);
    if (!panelBody) return;
    panelBody.classList.toggle("ads-network-disabled", !checked);
  }

  function applyAllNetworkPanelUi() {
    Object.keys(NETWORK_PANEL_MAP).forEach(function (toggleId) {
      const el = document.getElementById(toggleId);
      applyNetworkPanelUi(toggleId, el ? el.checked : false);
    });
  }

  /* ══════════════════════════════════════════════════════════
     VALIDATION
  ══════════════════════════════════════════════════════════ */

  /**
   * Returns true if the AdSense client_id is empty or valid.
   * Shows an error toast and returns false if malformed.
   */
  function validateAdSenseClientId(clientId) {
    if (!clientId || clientId.trim() === "") return true;
    if (!/^ca-pub-\d{16}$/.test(clientId.trim())) {
      window.TTW_Toast?.error(
        "Validation Error",
        "AdSense Client ID must be in the format: ca-pub-0000000000000000 (16 digits)"
      );
      document.getElementById("adsenseClientId")?.focus();
      return false;
    }
    return true;
  }

  /**
   * Returns true if all three priority values are unique.
   * Shows an error toast and returns false if there are duplicates.
   */
  function validatePriority(priorityArray) {
    if (new Set(priorityArray).size !== priorityArray.length) {
      window.TTW_Toast?.error(
        "Validation Error",
        "Each network must appear only once in the Priority order."
      );
      document.getElementById("adsPriority1")?.focus();
      return false;
    }
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     CORE: LOAD FROM FIRESTORE

     Reads the nested  ads/main  document and populates every
     field using getNestedValue() + writeField().
     Safe to call multiple times (idempotent).
  ══════════════════════════════════════════════════════════ */

  async function loadAds() {
    if (adsSaveStatus) {
      adsSaveStatus.textContent = "Loading…";
      adsSaveStatus.style.color = "var(--text-muted)";
    }

    try {
      const docSnap = await db.collection(ADS_COLLECTION).doc(ADS_DOCUMENT).get();

      if (docSnap.exists) {
        const data = docSnap.data();

        // ── Build flat snapshot for reset() ───────────────
        // Keyed by firestoreKey so each field can look up its
        // last saved value in O(1) without re-traversing the tree.
        _savedData = {};
        FIELDS.forEach(function (field) {
          _savedData[field.firestoreKey] = getNestedValue(data, field.firestoreKey);
        });

        // ── Populate all form controls ─────────────────────
        FIELDS.forEach(function (field) {
          const raw = getNestedValue(data, field.firestoreKey);
          // Use defaultValue only when the key is truly absent
          // (undefined). null / false / 0 are valid stored values.
          const value = raw !== undefined ? raw : field.defaultValue;
          writeField(field, value);
          if (field.type === "textarea") {
            updateByteCounter(field, String(value || ""));
          }
        });

        // ── Sync all toggle-driven UI ──────────────────────
        applyGlobalToggleUi();
        applyAllNetworkPanelUi();

        markClean(`Last saved: ${formatTimestamp(data.updatedAt)}`);

      } else {
        // ── First-time setup: write defaults into the form ─
        _savedData = {};
        FIELDS.forEach(function (field) {
          writeField(field, field.defaultValue);
          if (field.type === "textarea") updateByteCounter(field, "");
        });

        applyGlobalToggleUi();
        applyAllNetworkPanelUi();

        markClean("No ad config saved yet. Fill in the form and save.");
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

  /* ══════════════════════════════════════════════════════════
     CORE: SAVE TO FIRESTORE

     Flow:
       1. buildNestedPayload() — collects + type-casts all fields
          into a deeply nested object (NOT flat dot-string keys).
       2. Validate AdSense client_id format.
       3. Validate priority uniqueness.
       4. Normalise priority: { "0":…, "1":…, "2":… } → real Array.
       5. Auto-sync Adsterra atOptions (width/height/format/params)
          from the slot-level width/height inputs so the admin
          never has to enter the same value twice.
       6. Attach serverTimestamp.
       7. set({ merge: true }) — never wipes sibling fields.
  ══════════════════════════════════════════════════════════ */

  async function saveAds() {

    // Step 1 — build nested payload
    const payload = buildNestedPayload();

    // Step 2 — validate AdSense client_id
    const clientId = payload.adsense && payload.adsense.client_id;
    if (!validateAdSenseClientId(clientId)) return;

    // Step 3 — validate priority uniqueness
    // buildNestedPayload produces priority: { "0": "adsterra", … }
    // because dot-paths "priority.0" etc. use numeric string keys.
    const priorityObj = payload.priority || {};
    const priorityArr = [
      priorityObj["0"] || "adsterra",
      priorityObj["1"] || "adsense",
      priorityObj["2"] || "custom",
    ];
    if (!validatePriority(priorityArr)) return;

    // Step 4 — normalise priority to a real JS Array
    payload.priority = priorityArr;

    // Step 5 — auto-complete Adsterra atOptions from slot dimensions
    // The frontend engine reads both slotCfg.width/height (for the
    // iframe element) and slotCfg.atOptions.width/height (for the
    // atOptions variable injected into the iframe). We keep them in
    // sync here so the admin only fills in the visible W/H inputs.
    const at = payload.adsterra;
    if (at && at.slots) {
      const syncSlot = function (slotKey, defaultW, defaultH) {
        const slot = at.slots[slotKey];
        if (!slot) return;
        if (!slot.atOptions || typeof slot.atOptions !== "object") {
          slot.atOptions = {};
        }
        slot.type              = "banner";
        slot.atOptions.key     = slot.atOptions.key    || "";
        slot.atOptions.format  = "iframe";
        slot.atOptions.width   = slot.width  || defaultW;
        slot.atOptions.height  = slot.height || defaultH;
        slot.atOptions.params  = slot.atOptions.params || {};
      };
      syncSlot("top-banner",    300, 250);
      syncSlot("bottom-banner", 320,  50);
    }

    // Step 6 — timestamp
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    // Step 7 — write to Firestore
    setSaveLoading(true);

    try {
      await db
        .collection(ADS_COLLECTION)
        .doc(ADS_DOCUMENT)
        .set(payload, { merge: true });

      // Refresh flat snapshot from current form state
      _savedData = {};
      FIELDS.forEach(function (field) {
        _savedData[field.firestoreKey] = readField(field);
      });

      markClean("Saved just now");
      window.TTW_Toast?.success(
        "Ad Config Saved",
        "Your ad configuration has been written to Firestore."
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

  /* ══════════════════════════════════════════════════════════
     RESET FORM

     Restores every field to its _savedData value (or its
     defaultValue if it was absent from Firestore).
  ══════════════════════════════════════════════════════════ */

  function resetForm() {
    FIELDS.forEach(function (field) {
      const saved = _savedData[field.firestoreKey];
      const value = saved !== undefined ? saved : field.defaultValue;
      writeField(field, value);
      if (field.type === "textarea") updateByteCounter(field, String(value || ""));
    });

    applyGlobalToggleUi();
    applyAllNetworkPanelUi();
    markClean("Form reset to last saved values.");
  }

  /* ══════════════════════════════════════════════════════════
     EVENT LISTENERS
  ══════════════════════════════════════════════════════════ */

  // ── Change / input listeners on all registered fields ────────
  FIELDS.forEach(function (field) {
    const el = document.getElementById(field.inputId);
    if (!el) return;

    // Selects and checkboxes fire "change"; text/number/textarea
    // fire "input" for live dirty-tracking on every keystroke.
    const eventType =
      (field.type === "checkbox" || field.type === "select") ? "change" : "input";

    el.addEventListener(eventType, function () {
      markDirty();

      if (field.type === "textarea") {
        updateByteCounter(field, el.value);
      }

      if (field.inputId === "adsGlobalEnabled") {
        applyGlobalToggleUi();
      }

      if (NETWORK_PANEL_MAP[field.inputId] !== undefined) {
        applyNetworkPanelUi(field.inputId, el.checked);
      }
    });
  });

  // ── Save button ──────────────────────────────────────────────
  if (btnSave) btnSave.addEventListener("click", saveAds);

  // ── Reset button ─────────────────────────────────────────────
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      if (_isDirty && !window.confirm("Reset all fields to the last saved values?")) return;
      resetForm();
    });
  }

  // ── Clear buttons (event delegation) ─────────────────────────
  //    Each Clear button carries  data-clear-field="<inputId>"
  //    Works for any textarea registered in FIELDS.
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".ads-clear-btn");
    if (!btn) return;

    const targetId = btn.dataset.clearField;
    if (!targetId) return;

    const textarea = document.getElementById(targetId);
    if (!textarea || textarea.value.trim() === "") return;

    const label = targetId
      .replace(/^field/i, "")
      .replace(/([A-Z])/g, " $1")
      .trim() || targetId;

    if (!window.confirm(`Clear the "${label}" field?`)) return;

    textarea.value = "";
    markDirty();

    const field = FIELDS.find(function (f) { return f.inputId === targetId; });
    if (field) updateByteCounter(field, "");
  });

  // ── Keyboard shortcut: Ctrl / Cmd + S ────────────────────────
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      const view = document.getElementById("view-ads");
      if (view && view.classList.contains("active")) {
        e.preventDefault();
        saveAds();
      }
    }
  });

  // ── Before-unload guard ───────────────────────────────────────
  window.addEventListener("beforeunload", function (e) {
    if (_isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ══════════════════════════════════════════════════════════
     PUBLIC API

     dashboard.js calls TTW_AdsManager.load() whenever the
     user switches to the "ads" section, ensuring the latest
     Firestore data is always displayed.

     Add this inside switchSection() in dashboard.js:

       if (sectionKey === "ads" && window.TTW_AdsManager) {
         window.TTW_AdsManager.load();
       }
  ══════════════════════════════════════════════════════════ */

  window.TTW_AdsManager = {
    /** Re-fetch from Firestore and repopulate the form. */
    load: loadAds,
    /** Programmatically trigger a save. */
    save: saveAds,
  };

  // Auto-load on first script evaluation
  loadAds();

})(); // End IIFE
