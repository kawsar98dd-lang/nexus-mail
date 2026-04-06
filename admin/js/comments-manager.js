/**
 * =============================================================================
 * Trusted Tools Web — Admin Panel
 * Module : comments-manager.js
 * Version: 2.0 — Moderation + Settings (15 Premium Features)
 * =============================================================================
 *
 * Responsibilities
 * ────────────────
 *  MODERATION TAB (100% original — zero regressions)
 *  • Fetch all documents from `website_comments` collection.
 *  • Render them in the HTML table.
 *  • Approve / Reject / Delete with optimistic UI.
 *  • Stat bar (Total / Pending / Approved).
 *  • Client-side search + status filtering.
 *
 *  SETTINGS TAB (NEW v2.0)
 *  • Load current commentSystem config from Firestore `site-config/main`.
 *  • Populate all 15-feature form fields.
 *  • Save changes back to `site-config/main` under the `commentSystem` key.
 *  • Tab switching (Moderation ↔ Settings) driven by data-cms-tab buttons.
 *
 *  Public API
 *  • window.TTW_CommentsManager.load() — called by dashboard.js router.
 *
 * Prerequisites (already in scope from firebase-config.js)
 *  • firebase.firestore()   — Firestore v9 Compat SDK
 *  • window.TTW_Toast       — { success(title, msg), error(title, msg) }
 * =============================================================================
 */

;(function (window, document) {
  "use strict";

  // ─── Firestore references ─────────────────────────────────────────────────
  const db              = firebase.firestore();
  const COLLECTION      = "website_comments";
  const SITECONFIG_DOC  = db.collection("site-config").doc("main");

  // ─── Module-level state ───────────────────────────────────────────────────
  let allComments       = [];
  let pendingDeleteId   = null;

  // ─── DOM element cache (populated by cacheElements) ───────────────────────
  const el = {};

  // ─── Listener registration guard ─────────────────────────────────────────
  let _listenersRegistered = false;


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION A — SHARED UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * escapeHTML — XSS prevention for user-supplied content.
   */
  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * formatDate — Accepts a Firestore Timestamp, Date, ms number, or ISO string.
   * Returns a human-readable string like "Jun 14, 2025, 10:30 AM".
   */
  function formatDate(value) {
    if (!value) return "—";
    let date;
    if (value && typeof value.toDate === "function") {
      date = value.toDate();
    } else {
      date = new Date(value);
    }
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", {
      month  : "short",
      day    : "numeric",
      year   : "numeric",
      hour   : "numeric",
      minute : "2-digit",
      hour12 : true,
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION B — DOM CACHE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * cacheElements()
   * Caches every DOM node we interact with (Moderation + Settings + Tabs).
   * Safe to call more than once — only assigns if the element exists.
   */
  function cacheElements() {
    // ── Moderation tab elements ─────────────────────────────────────────────
    el.loading        = document.getElementById("cm-loading");
    el.empty          = document.getElementById("cm-empty");
    el.tableWrapper   = document.getElementById("cm-table-wrapper");
    el.tableBody      = document.getElementById("cm-table-body");
    el.tableMeta      = document.getElementById("cm-table-meta");
    el.search         = document.getElementById("cm-search");
    el.filterStatus   = document.getElementById("cm-filter-status");
    el.btnRefresh     = document.getElementById("cm-btn-refresh");
    el.refreshIcon    = document.getElementById("cm-refresh-icon");
    el.countTotal     = document.getElementById("cm-count-total");
    el.countPending   = document.getElementById("cm-count-pending");
    el.countApproved  = document.getElementById("cm-count-approved");
    el.deleteModal    = document.getElementById("cm-delete-modal");
    el.modalBackdrop  = document.getElementById("cm-modal-backdrop");
    el.modalCancel    = document.getElementById("cm-modal-cancel");
    el.modalConfirm   = document.getElementById("cm-modal-confirm");
    el.emptyTitle     = document.getElementById("cm-empty-title");
    el.emptySub       = document.getElementById("cm-empty-sub");

    // ── Tab switching elements ─────────────────────────────────────────────
    el.tabBtns        = document.querySelectorAll("[data-cms-tab]");
    el.tabPanelMod    = document.getElementById("cms-panel-moderation");
    el.tabPanelSet    = document.getElementById("cms-panel-settings");

    // ── Settings tab — form fields ─────────────────────────────────────────
    // Feature: Admin
    el.adminEmails         = document.getElementById("cfs-admin-emails");
    // Feature 1: Image Attachments
    el.imgEnabled          = document.getElementById("cfs-img-enabled");
    el.imgbbKey            = document.getElementById("cfs-imgbb-key");
    el.imgMaxSize          = document.getElementById("cfs-img-maxsize");
    el.imgExpiration       = document.getElementById("cfs-img-expiration");
    // Feature 2: Voice Notes
    el.voiceEnabled        = document.getElementById("cfs-voice-enabled");
    el.voiceEnhanceEnabled = document.getElementById("cfs-voice-enhance-enabled");
    el.cloudinaryName      = document.getElementById("cfs-cloudinary-name");
    el.cloudinaryPreset    = document.getElementById("cfs-cloudinary-preset");
    el.voiceMaxDuration    = document.getElementById("cfs-voice-maxduration");
    el.hpFreq              = document.getElementById("cfs-hp-freq");
    el.hpQ                 = document.getElementById("cfs-hp-q");
    el.compThreshold       = document.getElementById("cfs-comp-threshold");
    el.compKnee            = document.getElementById("cfs-comp-knee");
    el.compRatio           = document.getElementById("cfs-comp-ratio");
    el.compAttack          = document.getElementById("cfs-comp-attack");
    el.compRelease         = document.getElementById("cfs-comp-release");
    // Feature 3: User CRUD
    el.crudEdit            = document.getElementById("cfs-crud-edit");
    el.crudDelete          = document.getElementById("cfs-crud-delete");
    // Feature 4: Telegram
    el.telegramEnabled     = document.getElementById("cfs-telegram-enabled");
    el.telegramToken       = document.getElementById("cfs-telegram-token");
    el.telegramChatId      = document.getElementById("cfs-telegram-chatid");
    // Feature 5 & 6: Upvotes & Pin
    el.upvotesEnabled      = document.getElementById("cfs-upvotes-enabled");
    el.pinEnabled          = document.getElementById("cfs-pin-enabled");
    el.upvotesSort         = document.getElementById("cfs-upvotes-sort");
    // Feature 7, 8, 9: Pagination, Anti-Spam, Markdown
    el.paginationLimit     = document.getElementById("cfs-pagination-limit");
    el.antispamCooldown    = document.getElementById("cfs-antispam-cooldown");
    el.markdownEnabled     = document.getElementById("cfs-markdown-enabled");
    // Feature 10: Ads
    el.adsEnabled          = document.getElementById("cfs-ads-enabled");
    el.adsInterval         = document.getElementById("cfs-ads-interval");
    el.adsHtml             = document.getElementById("cfs-ads-html");
    // Feature 11: Profanity
    el.profanityEnabled    = document.getElementById("cfs-profanity-enabled");
    el.profanityWords      = document.getElementById("cfs-profanity-words");
    // Feature 12: Badges
    el.badgesEnabled       = document.getElementById("cfs-badges-enabled");
    el.badgesThreshold     = document.getElementById("cfs-badges-threshold");
    // Feature 13 & 14: Mentions & GDPR
    el.mentionsEnabled     = document.getElementById("cfs-mentions-enabled");
    el.gdprConsent         = document.getElementById("cfs-gdpr-consent");
    el.gdprExport          = document.getElementById("cfs-gdpr-export");
    el.gdprText            = document.getElementById("cfs-gdpr-text");
    // Feature 15: SEO
    el.seoEnabled          = document.getElementById("cfs-seo-enabled");
    // Save button + status text
    el.saveBtn             = document.getElementById("cfs-save-btn");
    el.saveStatus          = document.getElementById("cfs-save-status");
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION C — MODERATION: Visibility Helpers
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * showOnly(state)
   * Switches the moderation area between three exclusive states:
   *   "loading" | "empty" | "table"
   */
  function showOnly(state) {
    el.loading.classList.add("hidden");
    el.loading.classList.remove("flex");
    el.empty.classList.add("hidden");
    el.empty.classList.remove("flex");
    el.tableWrapper.classList.add("hidden");

    if (state === "loading") {
      el.loading.classList.remove("hidden");
      el.loading.classList.add("flex");
    } else if (state === "empty") {
      el.empty.classList.remove("hidden");
      el.empty.classList.add("flex");
    } else if (state === "table") {
      el.tableWrapper.classList.remove("hidden");
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION D — MODERATION: Stat Bar
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * updateStatBar(comments)
   * Recalculates Total / Pending / Approved and updates the DOM.
   */
  function updateStatBar(comments) {
    const total    = comments.length;
    const approved = comments.filter((c) => c.approved === true).length;
    const pending  = total - approved;
    el.countTotal.textContent    = total;
    el.countPending.textContent  = pending;
    el.countApproved.textContent = approved;
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION E — MODERATION: Row Builder
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * buildRow(comment)
   * Constructs the HTML string for a single <tr> table row.
   * Data attributes carry the document ID and state for event delegation.
   */
  function buildRow(comment) {
    const {
      id,
      name      = "Unknown User",
      email     = "",
      pageId    = "—",
      message   = "",
      timestamp,
      approved  = false,
    } = comment;

    // ── Status badge ────────────────────────────────────────────────────────
    const statusBadge = approved
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
                      bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
           Approved
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
                      bg-amber-500/10 text-amber-300 border border-amber-500/20">
           <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
           Pending
         </span>`;

    // ── Avatar initials ──────────────────────────────────────────────────────
    const initials = (name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    // ── Approve / Revoke button ──────────────────────────────────────────────
    const approveBtn = !approved
      ? `<button
           data-action="approve"
           data-id="${escapeHTML(id)}"
           title="Approve comment"
           class="cm-action-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  text-emerald-300 bg-emerald-500/10 border border-emerald-500/20
                  hover:bg-emerald-500/20 hover:text-emerald-200 active:scale-95
                  transition-all duration-150 whitespace-nowrap">
           <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2.5">
             <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
           </svg>
           Approve
         </button>`
      : `<button
           data-action="reject"
           data-id="${escapeHTML(id)}"
           title="Revoke approval"
           class="cm-action-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  text-slate-400 bg-slate-700/40 border border-slate-600/40
                  hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/20 active:scale-95
                  transition-all duration-150 whitespace-nowrap">
           <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2.5">
             <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
           </svg>
           Revoke
         </button>`;

    // ── Delete button ────────────────────────────────────────────────────────
    const deleteBtn = `<button
         data-action="delete"
         data-id="${escapeHTML(id)}"
         title="Delete comment"
         class="cm-action-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                text-red-400 bg-red-500/10 border border-red-500/20
                hover:bg-red-500/20 hover:text-red-300 active:scale-95
                transition-all duration-150 whitespace-nowrap">
         <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="2.2">
           <path stroke-linecap="round" stroke-linejoin="round"
             d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
         </svg>
         Delete
       </button>`;

    const messagePreview =
      escapeHTML(message).substring(0, 140) + (message.length > 140 ? "…" : "");

    return `
      <tr data-comment-id="${escapeHTML(id)}" data-approved="${approved}">
        <td class="px-5 py-4 align-top">
          <div class="flex items-center gap-3 min-w-[160px]">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/20
                        border border-emerald-500/20 flex items-center justify-center
                        text-xs font-bold text-emerald-300 select-none">
              ${escapeHTML(initials)}
            </div>
            <div class="min-w-0">
              <p class="text-slate-200 font-medium truncate max-w-[140px]" title="${escapeHTML(name)}">${escapeHTML(name)}</p>
              <p class="text-xs text-slate-500 truncate max-w-[140px]" title="${escapeHTML(email)}">${escapeHTML(email) || "—"}</p>
            </div>
          </div>
        </td>
        <td class="px-5 py-4 align-top">
          <span class="inline-block max-w-[140px] truncate text-slate-300 font-medium
                       bg-slate-800/60 border border-slate-700/40 rounded-lg px-2.5 py-0.5 text-xs"
                title="${escapeHTML(pageId)}">${escapeHTML(pageId)}</span>
        </td>
        <td class="px-5 py-4 align-top max-w-[280px]">
          <p class="text-slate-300 text-sm leading-relaxed line-clamp-3" title="${escapeHTML(message)}">${messagePreview}</p>
        </td>
        <td class="px-5 py-4 align-top whitespace-nowrap">
          <span class="text-slate-400 text-xs">${formatDate(timestamp)}</span>
        </td>
        <td class="px-5 py-4 align-top whitespace-nowrap">${statusBadge}</td>
        <td class="px-5 py-4 align-top">
          <div class="flex items-center justify-center gap-2 flex-wrap">
            ${approveBtn}
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION F — MODERATION: Render + Filter
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * renderTable(comments)
   * Clears #cm-table-body and rebuilds it from the supplied array.
   */
  function renderTable(comments) {
    if (comments.length === 0) {
      if (allComments.length > 0) {
        el.emptyTitle.textContent = "No matching comments";
        el.emptySub.textContent   = "Try adjusting your search or filter.";
      } else {
        el.emptyTitle.textContent = "No comments yet";
        el.emptySub.textContent   = "Comments submitted by users will appear here.";
      }
      showOnly("empty");
      return;
    }
    el.tableBody.innerHTML   = comments.map(buildRow).join("");
    el.tableMeta.textContent = `Showing ${comments.length} of ${allComments.length} comment${allComments.length !== 1 ? "s" : ""}`;
    showOnly("table");
  }

  /**
   * applyFilters()
   * Reads search input + status dropdown and filters allComments in-memory.
   */
  function applyFilters() {
    const query  = (el.search.value || "").trim().toLowerCase();
    const status = el.filterStatus.value; // "all" | "pending" | "approved"

    const filtered = allComments.filter((c) => {
      if (status === "approved" && !c.approved) return false;
      if (status === "pending"  &&  c.approved) return false;
      if (query) {
        const haystack = [c.name || "", c.email || "", c.pageId || "", c.message || ""]
          .join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    renderTable(filtered);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION G — MODERATION: Firestore Operations (comments)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * fetchComments()
   * Retrieves all documents from website_comments, ordered newest-first.
   */
  async function fetchComments() {
    showOnly("loading");
    try {
      const snapshot = await db
        .collection(COLLECTION)
        .orderBy("timestamp", "desc")
        .get();

      allComments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      updateStatBar(allComments);
      applyFilters();
    } catch (err) {
      console.error("[CommentsManager] fetchComments error:", err);
      showOnly("empty");
      el.emptyTitle.textContent = "Failed to load comments";
      el.emptySub.textContent   = "Check your Firestore rules and connection.";
      window.TTW_Toast.error("Load Failed", "Could not fetch comments. Check the console.");
    }
  }

  /**
   * approveComment(docId)
   * Sets approved: true with optimistic UI dimming.
   */
  async function approveComment(docId) {
    const row = el.tableBody.querySelector(`tr[data-comment-id="${docId}"]`);
    if (row) row.style.opacity = "0.5";
    try {
      await db.collection(COLLECTION).doc(docId).update({ approved: true });
      const idx = allComments.findIndex((c) => c.id === docId);
      if (idx !== -1) allComments[idx].approved = true;
      updateStatBar(allComments);
      applyFilters();
      window.TTW_Toast.success("Comment Approved", "The comment is now publicly visible.");
    } catch (err) {
      console.error("[CommentsManager] approveComment error:", err);
      if (row) row.style.opacity = "1";
      window.TTW_Toast.error("Approval Failed", "Could not update the comment. Please try again.");
    }
  }

  /**
   * rejectComment(docId)
   * Sets approved: false (revokes visibility).
   */
  async function rejectComment(docId) {
    const row = el.tableBody.querySelector(`tr[data-comment-id="${docId}"]`);
    if (row) row.style.opacity = "0.5";
    try {
      await db.collection(COLLECTION).doc(docId).update({ approved: false });
      const idx = allComments.findIndex((c) => c.id === docId);
      if (idx !== -1) allComments[idx].approved = false;
      updateStatBar(allComments);
      applyFilters();
      window.TTW_Toast.success("Approval Revoked", "The comment has been set back to pending.");
    } catch (err) {
      console.error("[CommentsManager] rejectComment error:", err);
      if (row) row.style.opacity = "1";
      window.TTW_Toast.error("Action Failed", "Could not update the comment. Please try again.");
    }
  }

  /**
   * deleteComment(docId)
   * Permanently removes the Firestore document.
   */
  async function deleteComment(docId) {
    el.modalConfirm.disabled    = true;
    el.modalConfirm.textContent = "Deleting…";
    try {
      await db.collection(COLLECTION).doc(docId).delete();
      allComments = allComments.filter((c) => c.id !== docId);
      updateStatBar(allComments);
      applyFilters();
      closeDeleteModal();
      window.TTW_Toast.success("Comment Deleted", "The comment has been permanently removed.");
    } catch (err) {
      console.error("[CommentsManager] deleteComment error:", err);
      window.TTW_Toast.error("Delete Failed", "Could not delete the comment. Please try again.");
    } finally {
      el.modalConfirm.disabled    = false;
      el.modalConfirm.textContent = "Delete";
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION H — MODERATION: Delete Modal
  // ══════════════════════════════════════════════════════════════════════════

  function openDeleteModal(docId) {
    pendingDeleteId = docId;
    el.deleteModal.classList.remove("hidden");
    el.deleteModal.classList.add("flex");
    el.modalCancel.focus();
  }

  function closeDeleteModal() {
    el.deleteModal.classList.add("hidden");
    el.deleteModal.classList.remove("flex");
    pendingDeleteId = null;
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION I — SETTINGS: Load config from Firestore → populate form
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * loadSettings()
   * Fetches the `site-config/main` document and populates all Settings fields.
   * Fields are silently skipped if the document / key is absent (safe defaults).
   */
  async function loadSettings() {
    try {
      const snap = await SITECONFIG_DOC.get();
      if (!snap.exists) {
        console.warn("[CommentsManager] site-config/main not found — using blank defaults.");
        return;
      }

      const cfg = snap.data().commentSystem || {};

      // ── Admin emails ───────────────────────────────────────────────────────
      const emails = cfg.adminEmails || [];
      if (el.adminEmails) el.adminEmails.value = emails.join("\n");

      // ── Feature 1: Image Attachments ───────────────────────────────────────
      const img = cfg.imageAttachments || {};
      if (el.imgEnabled)    el.imgEnabled.checked  = !!img.enabled;
      if (el.imgbbKey)      el.imgbbKey.value       = img.imgbbApiKey   || "";
      if (el.imgMaxSize)    el.imgMaxSize.value      = img.maxSizeMB    ?? 5;
      if (el.imgExpiration) el.imgExpiration.value   = img.expiration   ?? 0;

      // ── Feature 2: Voice Notes ─────────────────────────────────────────────
      const voice = cfg.voiceNotes || {};
      const ve    = voice.voiceEnhance || {};
      if (el.voiceEnabled)        el.voiceEnabled.checked        = !!voice.enabled;
      if (el.voiceEnhanceEnabled) el.voiceEnhanceEnabled.checked = !!voice.enableVoiceEnhance;
      if (el.cloudinaryName)      el.cloudinaryName.value        = voice.cloudName     || "";
      if (el.cloudinaryPreset)    el.cloudinaryPreset.value      = voice.uploadPreset  || "";
      if (el.voiceMaxDuration)    el.voiceMaxDuration.value      = voice.maxDurationSeconds ?? 60;
      if (el.hpFreq)         el.hpFreq.value         = ve.highpassFrequency     ?? 80;
      if (el.hpQ)            el.hpQ.value            = ve.highpassQ             ?? 0.707;
      if (el.compThreshold)  el.compThreshold.value  = ve.compressorThreshold   ?? -24;
      if (el.compKnee)       el.compKnee.value       = ve.compressorKnee        ?? 30;
      if (el.compRatio)      el.compRatio.value      = ve.compressorRatio       ?? 4;
      if (el.compAttack)     el.compAttack.value     = ve.compressorAttack      ?? 0.003;
      if (el.compRelease)    el.compRelease.value    = ve.compressorRelease     ?? 0.25;

      // ── Feature 3: User CRUD ───────────────────────────────────────────────
      const crud = cfg.userCRUD || {};
      if (el.crudEdit)   el.crudEdit.checked   = !!crud.editEnabled;
      if (el.crudDelete) el.crudDelete.checked = !!crud.deleteEnabled;

      // ── Feature 4: Telegram ────────────────────────────────────────────────
      const tg = cfg.telegram || {};
      if (el.telegramEnabled) el.telegramEnabled.checked = !!tg.enabled;
      if (el.telegramToken)   el.telegramToken.value     = tg.botToken || "";
      if (el.telegramChatId)  el.telegramChatId.value    = tg.chatId   || "";

      // ── Feature 5 & 6: Upvotes & Pin ──────────────────────────────────────
      const upv = cfg.upvotes   || {};
      const pin = cfg.pinComment || {};
      if (el.upvotesEnabled) el.upvotesEnabled.checked = !!upv.enabled;
      if (el.pinEnabled)     el.pinEnabled.checked     = !!pin.enabled;
      if (el.upvotesSort)    el.upvotesSort.value      = upv.defaultSort || "newest";

      // ── Feature 7: Pagination ──────────────────────────────────────────────
      const pag = cfg.pagination || {};
      if (el.paginationLimit) el.paginationLimit.value = pag.commentsPerPage ?? 10;

      // ── Feature 8: Anti-Spam ───────────────────────────────────────────────
      const spam = cfg.antiSpam || {};
      if (el.antispamCooldown) el.antispamCooldown.value = spam.cooldownSeconds ?? 30;

      // ── Feature 9: Markdown ────────────────────────────────────────────────
      const md = cfg.markdown || {};
      if (el.markdownEnabled) el.markdownEnabled.checked = !!md.enabled;

      // ── Feature 10: Ads ────────────────────────────────────────────────────
      const ads = cfg.ads || {};
      if (el.adsEnabled)  el.adsEnabled.checked  = !!ads.enabled;
      if (el.adsInterval) el.adsInterval.value    = ads.injectAfterN ?? 5;
      if (el.adsHtml)     el.adsHtml.value        = ads.adHTML       || "";

      // ── Feature 11: Profanity ──────────────────────────────────────────────
      const pf = cfg.profanityFilter || {};
      if (el.profanityEnabled) el.profanityEnabled.checked = !!pf.enabled;
      if (el.profanityWords)   el.profanityWords.value     = (pf.wordList || []).join(", ");

      // ── Feature 12: Badges ─────────────────────────────────────────────────
      const bdg = cfg.badges || {};
      if (el.badgesEnabled)    el.badgesEnabled.checked  = !!bdg.enabled;
      if (el.badgesThreshold)  el.badgesThreshold.value  = bdg.trustedUserUpvoteThreshold ?? 10;

      // ── Feature 13: Mentions ───────────────────────────────────────────────
      const men = cfg.mentions || {};
      if (el.mentionsEnabled) el.mentionsEnabled.checked = !!men.enabled;

      // ── Feature 14: GDPR ───────────────────────────────────────────────────
      const gdpr = cfg.gdpr || {};
      if (el.gdprConsent) el.gdprConsent.checked = !!gdpr.consentCheckboxEnabled;
      if (el.gdprExport)  el.gdprExport.checked  = !!gdpr.dataExportEnabled;
      if (el.gdprText)    el.gdprText.value       = gdpr.consentText || "";

      // ── Feature 15: SEO ────────────────────────────────────────────────────
      const seo = cfg.seoSchema || {};
      if (el.seoEnabled) el.seoEnabled.checked = !!seo.enabled;

      setSaveStatus("Settings loaded from Firestore.", "ok");

    } catch (err) {
      console.error("[CommentsManager] loadSettings error:", err);
      setSaveStatus("Could not load settings. Check Firestore rules.", "error");
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION J — SETTINGS: Collect form data → build payload
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * collectSettingsPayload()
   * Reads all Settings form inputs and returns a structured `commentSystem`
   * object ready to be written to Firestore.
   *
   * NOTE: The `firebase` sub-key is intentionally excluded — those credentials
   * should only be managed through firebase-config.js, not the UI.
   *
   * @returns {Object} commentSystem payload (no firebase sub-key)
   */
  function collectSettingsPayload() {
    // Helper: safely parse a float, returning fallback if NaN
    const flt = (el, fallback) => {
      const v = parseFloat(el ? el.value : "");
      return isNaN(v) ? fallback : v;
    };
    // Helper: safely parse an integer
    const int = (el, fallback) => {
      const v = parseInt(el ? el.value : "", 10);
      return isNaN(v) ? fallback : v;
    };
    // Helper: read checkbox state
    const chk = (el) => !!(el && el.checked);

    // Admin emails — split by newline, trim, drop empties
    const adminEmailsRaw = (el.adminEmails ? el.adminEmails.value : "");
    const adminEmails    = adminEmailsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    // Profanity word list — split by comma, trim, drop empties
    const profanityRaw  = (el.profanityWords ? el.profanityWords.value : "");
    const profanityList = profanityRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      adminEmails,

      // Feature 1
      imageAttachments: {
        enabled      : chk(el.imgEnabled),
        imgbbApiKey  : el.imgbbKey      ? el.imgbbKey.value.trim()      : "",
        maxSizeMB    : int(el.imgMaxSize,    5),
        expiration   : int(el.imgExpiration, 0),
        acceptedTypes: "image/jpeg,image/png,image/gif,image/webp",
      },

      // Feature 2
      voiceNotes: {
        enabled            : chk(el.voiceEnabled),
        cloudName          : el.cloudinaryName   ? el.cloudinaryName.value.trim()   : "",
        uploadPreset       : el.cloudinaryPreset ? el.cloudinaryPreset.value.trim() : "",
        maxDurationSeconds : int(el.voiceMaxDuration, 60),
        enableVoiceEnhance : chk(el.voiceEnhanceEnabled),
        voiceEnhance: {
          highpassFrequency  : flt(el.hpFreq,        80),
          highpassQ          : flt(el.hpQ,            0.707),
          compressorThreshold: flt(el.compThreshold, -24),
          compressorKnee     : flt(el.compKnee,       30),
          compressorRatio    : flt(el.compRatio,       4),
          compressorAttack   : flt(el.compAttack,      0.003),
          compressorRelease  : flt(el.compRelease,     0.25),
        },
      },

      // Feature 3
      userCRUD: {
        editEnabled  : chk(el.crudEdit),
        deleteEnabled: chk(el.crudDelete),
      },

      // Feature 4
      telegram: {
        enabled : chk(el.telegramEnabled),
        botToken: el.telegramToken  ? el.telegramToken.value.trim()  : "",
        chatId  : el.telegramChatId ? el.telegramChatId.value.trim() : "",
      },

      // Feature 5
      upvotes: {
        enabled    : chk(el.upvotesEnabled),
        defaultSort: el.upvotesSort ? el.upvotesSort.value : "newest",
      },

      // Feature 6
      pinComment: {
        enabled: chk(el.pinEnabled),
      },

      // Feature 7
      pagination: {
        commentsPerPage: int(el.paginationLimit, 10),
      },

      // Feature 8
      antiSpam: {
        cooldownSeconds: int(el.antispamCooldown, 30),
      },

      // Feature 9
      markdown: {
        enabled: chk(el.markdownEnabled),
      },

      // Feature 10
      ads: {
        enabled     : chk(el.adsEnabled),
        injectAfterN: int(el.adsInterval, 5),
        adHTML      : el.adsHtml ? el.adsHtml.value : "",
      },

      // Feature 11
      profanityFilter: {
        enabled : chk(el.profanityEnabled),
        wordList: profanityList,
      },

      // Feature 12
      badges: {
        enabled                    : chk(el.badgesEnabled),
        trustedUserUpvoteThreshold : int(el.badgesThreshold, 10),
      },

      // Feature 13
      mentions: {
        enabled: chk(el.mentionsEnabled),
      },

      // Feature 14
      gdpr: {
        consentCheckboxEnabled: chk(el.gdprConsent),
        dataExportEnabled     : chk(el.gdprExport),
        consentText           : el.gdprText ? el.gdprText.value.trim() : "",
      },

      // Feature 15
      seoSchema: {
        enabled: chk(el.seoEnabled),
      },
    };
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION K — SETTINGS: Save payload → Firestore
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * saveSettings()
   * Writes the collected payload to `site-config/main` using Firestore merge,
   * so any other top-level keys in that document are not overwritten.
   */
  async function saveSettings() {
    if (!el.saveBtn) return;

    // ── Enter loading state ────────────────────────────────────────────────
    el.saveBtn.disabled = true;
    el.saveBtn.classList.add("loading");
    setSaveStatus("Saving…", "pending");

    try {
      const payload = collectSettingsPayload();

      // Use set with merge:true so only commentSystem is touched
      await SITECONFIG_DOC.set({ commentSystem: payload }, { merge: true });

      setSaveStatus("Saved successfully! Frontend will reflect changes on next page load.", "ok");
      window.TTW_Toast.success(
        "Settings Saved",
        "commentSystem config updated in site-config/main."
      );
    } catch (err) {
      console.error("[CommentsManager] saveSettings error:", err);
      setSaveStatus("Save failed. Check Firestore rules and connection.", "error");
      window.TTW_Toast.error(
        "Save Failed",
        "Could not write to Firestore. See console for details."
      );
    } finally {
      el.saveBtn.disabled = false;
      el.saveBtn.classList.remove("loading");
    }
  }

  /**
   * setSaveStatus(text, type)
   * Updates the small status line beneath the Save button.
   * @param {string}                   text
   * @param {"ok"|"error"|"pending"|"default"} type
   */
  function setSaveStatus(text, type) {
    if (!el.saveStatus) return;
    const colorMap = {
      ok     : "#34d399",  // emerald
      error  : "#f87171",  // red
      pending: "#fbbf24",  // amber
      default: "#475569",  // slate
    };
    el.saveStatus.textContent = text;
    el.saveStatus.style.color = colorMap[type] || colorMap.default;
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION L — TAB SWITCHING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * switchTab(targetId)
   * Activates the chosen tab button + panel; deactivates all others.
   * When switching to "settings" for the first time, triggers loadSettings().
   *
   * @param {"moderation"|"settings"} targetId
   */
  let _settingsLoaded = false;

  function switchTab(targetId) {
    // ── Update tab buttons ────────────────────────────────────────────────
    el.tabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cmsTab === targetId);
    });

    // ── Show/hide panels ──────────────────────────────────────────────────
    if (el.tabPanelMod) el.tabPanelMod.classList.toggle("active", targetId === "moderation");
    if (el.tabPanelSet) el.tabPanelSet.classList.toggle("active", targetId === "settings");

    // ── Lazy-load settings from Firestore on first visit ──────────────────
    if (targetId === "settings" && !_settingsLoaded) {
      _settingsLoaded = true;
      loadSettings();
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION M — EVENT LISTENER REGISTRATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * registerListeners()
   * Attaches all event listeners. Guard prevents double-binding on re-entry.
   */
  function registerListeners() {
    if (_listenersRegistered) return;
    _listenersRegistered = true;

    // ── Moderation: table action buttons (delegated) ───────────────────────
    if (el.tableBody) {
      el.tableBody.addEventListener("click", (e) => {
        const btn = e.target.closest(".cm-action-btn");
        if (!btn) return;
        const action = btn.dataset.action;
        const id     = btn.dataset.id;
        if (!id) return;
        if (action === "approve") approveComment(id);
        if (action === "reject")  rejectComment(id);
        if (action === "delete")  openDeleteModal(id);
      });
    }

    // ── Moderation: toolbar ────────────────────────────────────────────────
    if (el.search)        el.search.addEventListener("input", applyFilters);
    if (el.filterStatus)  el.filterStatus.addEventListener("change", applyFilters);
    if (el.btnRefresh)    el.btnRefresh.addEventListener("click", handleRefreshClick);

    // ── Moderation: delete modal ───────────────────────────────────────────
    if (el.modalCancel)   el.modalCancel.addEventListener("click", closeDeleteModal);
    if (el.modalBackdrop) el.modalBackdrop.addEventListener("click", closeDeleteModal);
    if (el.modalConfirm) {
      el.modalConfirm.addEventListener("click", () => {
        if (pendingDeleteId) deleteComment(pendingDeleteId);
      });
    }

    // ── Keyboard: ESC closes modal ─────────────────────────────────────────
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.deleteModal && !el.deleteModal.classList.contains("hidden")) {
        closeDeleteModal();
      }
    });

    // ── Tab switching ──────────────────────────────────────────────────────
    el.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.cmsTab));
    });

    // ── Settings: save button ──────────────────────────────────────────────
    if (el.saveBtn) {
      el.saveBtn.addEventListener("click", saveSettings);
    }
  }

  /**
   * handleRefreshClick()
   * Re-fetches from Firestore with spinner animation on the refresh icon.
   */
  async function handleRefreshClick() {
    el.refreshIcon.classList.add("cm-spin");
    el.btnRefresh.disabled = true;
    try {
      await fetchComments();
    } finally {
      el.refreshIcon.classList.remove("cm-spin");
      el.btnRefresh.disabled = false;
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SECTION N — PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * load()
   * Entry point called by dashboard.js when the user navigates to the
   * "Comments" section.
   *
   * Usage in dashboard.js:
   *   window.TTW_CommentsManager.load();
   *
   * @returns {Promise<void>}
   */
  async function load() {
    cacheElements();
    registerListeners();

    // Default to Moderation tab being active on every load
    switchTab("moderation");

    await fetchComments();
  }

  // ── Namespace export ───────────────────────────────────────────────────────
  window.TTW_CommentsManager = { load };

})(window, document);
