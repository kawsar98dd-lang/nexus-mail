/**
 * =============================================================================
 * Trusted Tools Web — Admin Panel
 * Module : comments-manager.js
 * Step   : 4 — Comments Manager
 * =============================================================================
 *
 * Responsibilities
 * ────────────────
 *  • Fetch all documents from the Firestore `website_comments` collection.
 *  • Render them in the HTML table defined in comments-manager.html.
 *  • Allow the admin to:
 *      – Approve  → sets `approved: true` on the Firestore document.
 *      – Reject   → sets `approved: false` (marks as rejected / hidden).
 *      – Delete   → removes the document entirely after confirmation.
 *  • Keep the summary stats bar (Total / Pending / Approved) in sync.
 *  • Support client-side search + status filtering without re-fetching.
 *  • Expose `window.TTW_CommentsManager.load()` for the main dashboard router.
 *
 * Prerequisites (already in scope from your global firebase-config.js)
 * ─────────────────────────────────────────────────────────────────────
 *  • firebase.firestore()   — Firestore v9 Compat SDK
 *  • window.TTW_Toast       — { success(title, msg), error(title, msg) }
 *
 * Frontend document shape (website_comments collection)
 * ──────────────────────────────────────────────────────
 *  • name      — User's display name
 *  • email     — User's email
 *  • message   — The actual comment text
 *  • timestamp — Creation date/time (Firestore Timestamp)
 *  • pageId    — Which tool/page the comment is on
 *  • uid       — User ID
 *  • approved  — Boolean managed by the admin panel
 *
 * =============================================================================
 */

;(function (window, document) {
  "use strict";

  // ─── Firestore reference (v9 Compat — already initialised globally) ───────
  const db = firebase.firestore();

  // ─── Firestore collection name ────────────────────────────────────────────
  const COLLECTION = "website_comments";

  // ─── Module-level state ───────────────────────────────────────────────────
  /**
   * `allComments` holds the raw array fetched from Firestore.
   * Filtering/searching operates on this array client-side so
   * we avoid extra reads on every keystroke.
   */
  let allComments = [];

  /**
   * `pendingDeleteId` stores the Firestore document ID while the
   * confirmation modal is open, so the confirm button knows what to delete.
   */
  let pendingDeleteId = null;

  // ─── DOM Element Cache ────────────────────────────────────────────────────
  // Cached once on first `load()` call — avoids repeated querySelector calls.
  const el = {};

  /**
   * cacheElements()
   * Populates the `el` cache with every DOM node we interact with.
   * Safe to call multiple times — only assigns if the element exists.
   */
  function cacheElements() {
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
    // Modal elements
    el.deleteModal    = document.getElementById("cm-delete-modal");
    el.modalBackdrop  = document.getElementById("cm-modal-backdrop");
    el.modalCancel    = document.getElementById("cm-modal-cancel");
    el.modalConfirm   = document.getElementById("cm-modal-confirm");
    el.emptyTitle     = document.getElementById("cm-empty-title");
    el.emptySub       = document.getElementById("cm-empty-sub");
  }

  // ─── Visibility Helpers ───────────────────────────────────────────────────

  /**
   * showOnly(state)
   * Switches the main content area between three mutually exclusive states:
   *   "loading" | "empty" | "table"
   *
   * @param {"loading"|"empty"|"table"} state
   */
  function showOnly(state) {
    // Hide all three panels first
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

  // ─── Stat Bar Helpers ─────────────────────────────────────────────────────

  /**
   * updateStatBar(comments)
   * Recalculates Total / Pending / Approved counts and updates the DOM.
   *
   * @param {Array} comments — The full (unfiltered) comment array.
   */
  function updateStatBar(comments) {
    const total    = comments.length;
    const approved = comments.filter((c) => c.approved === true).length;
    const pending  = total - approved;

    el.countTotal.textContent    = total;
    el.countPending.textContent  = pending;
    el.countApproved.textContent = approved;
  }

  // ─── Date Formatter ──────────────────────────────────────────────────────

  /**
   * formatDate(value)
   * Accepts a Firestore Timestamp, a JS Date, a number (ms), or an ISO string.
   * Returns a human-readable string like "Jun 14, 2025, 10:30 AM".
   *
   * @param {*} value
   * @returns {string}
   */
  function formatDate(value) {
    if (!value) return "—";

    let date;
    // Firestore Timestamp objects expose `.toDate()`
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

  // ─── HTML Escaping ────────────────────────────────────────────────────────

  /**
   * escapeHTML(str)
   * Prevents XSS when rendering user-supplied content into innerHTML.
   *
   * @param {string} str
   * @returns {string}
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

  // ─── Row Builder ──────────────────────────────────────────────────────────

  /**
   * buildRow(comment)
   * Constructs the HTML string for a single <tr> table row.
   * Data attributes on the action buttons carry the document ID and
   * current approval state so event delegation can act on them.
   *
   * Firestore document shape (website_comments):
   * {
   *   id        : string    (document ID — attached by fetchComments)
   *   name      : string    (display name)
   *   email     : string    (email)
   *   pageId    : string    (which tool/page was commented on)
   *   message   : string    (the comment body)
   *   timestamp : Timestamp | Date | string | number
   *   approved  : boolean
   * }
   *
   * @param {Object} comment
   * @returns {string} HTML string
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

    // ── User avatar initials ─────────────────────────────────────────────────
    const initials = (name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    // ── Approve button (hidden when already approved) ────────────────────────
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

    // ── Truncate long message text in the cell ───────────────────────────────
    const messagePreview = escapeHTML(message).substring(0, 140) +
      (message.length > 140 ? "…" : "");

    return `
      <tr data-comment-id="${escapeHTML(id)}" data-approved="${approved}">

        <!-- User Info -->
        <td class="px-5 py-4 align-top">
          <div class="flex items-center gap-3 min-w-[160px]">
            <!-- Avatar -->
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/20
                        border border-emerald-500/20 flex items-center justify-center
                        text-xs font-bold text-emerald-300 select-none">
              ${escapeHTML(initials)}
            </div>
            <div class="min-w-0">
              <p class="text-slate-200 font-medium truncate max-w-[140px]" title="${escapeHTML(name)}">
                ${escapeHTML(name)}
              </p>
              <p class="text-xs text-slate-500 truncate max-w-[140px]" title="${escapeHTML(email)}">
                ${escapeHTML(email) || "—"}
              </p>
            </div>
          </div>
        </td>

        <!-- Page ID -->
        <td class="px-5 py-4 align-top">
          <span class="inline-block max-w-[140px] truncate text-slate-300 font-medium
                       bg-slate-800/60 border border-slate-700/40 rounded-lg px-2.5 py-0.5 text-xs"
                title="${escapeHTML(pageId)}">
            ${escapeHTML(pageId)}
          </span>
        </td>

        <!-- Message Text -->
        <td class="px-5 py-4 align-top max-w-[280px]">
          <p class="text-slate-300 text-sm leading-relaxed line-clamp-3"
             title="${escapeHTML(message)}">
            ${messagePreview}
          </p>
        </td>

        <!-- Date -->
        <td class="px-5 py-4 align-top whitespace-nowrap">
          <span class="text-slate-400 text-xs">${formatDate(timestamp)}</span>
        </td>

        <!-- Status Badge -->
        <td class="px-5 py-4 align-top whitespace-nowrap">
          ${statusBadge}
        </td>

        <!-- Action Buttons -->
        <td class="px-5 py-4 align-top">
          <div class="flex items-center justify-center gap-2 flex-wrap">
            ${approveBtn}
            ${deleteBtn}
          </div>
        </td>

      </tr>
    `;
  }

  // ─── Render Table ─────────────────────────────────────────────────────────

  /**
   * renderTable(comments)
   * Clears `#cm-table-body` and rebuilds it from the supplied array.
   * Also updates the "Showing N results" meta line.
   *
   * @param {Array} comments — Already-filtered subset to render.
   */
  function renderTable(comments) {
    if (comments.length === 0) {
      // Check if this is a filter-empty vs truly empty scenario
      if (allComments.length > 0) {
        // Data exists but no matches — show a search-specific empty state
        el.emptyTitle.textContent = "No matching comments";
        el.emptySub.textContent   = "Try adjusting your search or filter.";
      } else {
        el.emptyTitle.textContent = "No comments yet";
        el.emptySub.textContent   = "Comments submitted by users will appear here.";
      }
      showOnly("empty");
      return;
    }

    // Build all rows and inject at once (single reflow)
    el.tableBody.innerHTML = comments.map(buildRow).join("");
    el.tableMeta.textContent = `Showing ${comments.length} of ${allComments.length} comment${allComments.length !== 1 ? "s" : ""}`;
    showOnly("table");
  }

  // ─── Client-side Filter / Search ─────────────────────────────────────────

  /**
   * applyFilters()
   * Reads the current search input + status dropdown values and
   * filters `allComments` in-memory, then re-renders the table.
   * Called on every `input` / `change` event from the toolbar.
   */
  function applyFilters() {
    const query  = (el.search.value || "").trim().toLowerCase();
    const status = el.filterStatus.value; // "all" | "pending" | "approved"

    const filtered = allComments.filter((c) => {
      // ── Status filter ──────────────────────────────────────────────────
      if (status === "approved" && !c.approved) return false;
      if (status === "pending"  &&  c.approved) return false;

      // ── Text search (name, email, pageId, message) ─────────────────────
      if (query) {
        const haystack = [
          c.name    || "",
          c.email   || "",
          c.pageId  || "",
          c.message || "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    renderTable(filtered);
  }

  // ─── Firestore Operations ─────────────────────────────────────────────────

  /**
   * fetchComments()
   * Retrieves all documents from `website_comments`, ordered newest-first.
   * Updates `allComments` state and triggers a full re-render.
   *
   * @returns {Promise<void>}
   */
  async function fetchComments() {
    showOnly("loading");

    try {
      const snapshot = await db
        .collection(COLLECTION)
        .orderBy("timestamp", "desc")   // newest comments first
        .get();

      // Map snapshot to plain objects; attach the Firestore doc ID
      allComments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      updateStatBar(allComments);
      applyFilters(); // renders table respecting active search/filter
    } catch (err) {
      console.error("[CommentsManager] fetchComments error:", err);
      showOnly("empty");
      el.emptyTitle.textContent = "Failed to load comments";
      el.emptySub.textContent   = "Check your Firestore rules and connection.";

      window.TTW_Toast.error(
        "Load Failed",
        "Could not fetch comments. Check the console for details."
      );
    }
  }

  /**
   * approveComment(docId)
   * Sets `approved: true` on the specified Firestore document.
   * Updates the in-memory array and re-renders without a full re-fetch.
   *
   * @param {string} docId — Firestore document ID
   * @returns {Promise<void>}
   */
  async function approveComment(docId) {
    // ── Optimistic UI: dim the row while the write is in-flight ───────────
    const row = el.tableBody.querySelector(`tr[data-comment-id="${docId}"]`);
    if (row) row.style.opacity = "0.5";

    try {
      await db.collection(COLLECTION).doc(docId).update({ approved: true });

      // Sync in-memory state
      const idx = allComments.findIndex((c) => c.id === docId);
      if (idx !== -1) allComments[idx].approved = true;

      // Refresh stat bar + re-render (respects active filter)
      updateStatBar(allComments);
      applyFilters();

      window.TTW_Toast.success(
        "Comment Approved",
        "The comment is now publicly visible."
      );
    } catch (err) {
      console.error("[CommentsManager] approveComment error:", err);
      if (row) row.style.opacity = "1"; // revert dim on failure
      window.TTW_Toast.error(
        "Approval Failed",
        "Could not update the comment. Please try again."
      );
    }
  }

  /**
   * rejectComment(docId)
   * Sets `approved: false` on the specified Firestore document (revokes).
   * Mirrors the logic of approveComment.
   *
   * @param {string} docId — Firestore document ID
   * @returns {Promise<void>}
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

      window.TTW_Toast.success(
        "Approval Revoked",
        "The comment has been set back to pending."
      );
    } catch (err) {
      console.error("[CommentsManager] rejectComment error:", err);
      if (row) row.style.opacity = "1";
      window.TTW_Toast.error(
        "Action Failed",
        "Could not update the comment. Please try again."
      );
    }
  }

  /**
   * deleteComment(docId)
   * Permanently removes the Firestore document.
   * Called by the modal's Confirm button after user acknowledges the warning.
   *
   * @param {string} docId — Firestore document ID
   * @returns {Promise<void>}
   */
  async function deleteComment(docId) {
    // Disable the confirm button to prevent double-clicks
    el.modalConfirm.disabled    = true;
    el.modalConfirm.textContent = "Deleting…";

    try {
      await db.collection(COLLECTION).doc(docId).delete();

      // Remove from in-memory array
      allComments = allComments.filter((c) => c.id !== docId);

      updateStatBar(allComments);
      applyFilters();
      closeDeleteModal();

      window.TTW_Toast.success(
        "Comment Deleted",
        "The comment has been permanently removed."
      );
    } catch (err) {
      console.error("[CommentsManager] deleteComment error:", err);
      window.TTW_Toast.error(
        "Delete Failed",
        "Could not delete the comment. Please try again."
      );
    } finally {
      // Re-enable regardless of outcome
      el.modalConfirm.disabled    = false;
      el.modalConfirm.textContent = "Delete";
    }
  }

  // ─── Delete Confirmation Modal ────────────────────────────────────────────

  /**
   * openDeleteModal(docId)
   * Stashes the target doc ID and reveals the confirmation dialog.
   *
   * @param {string} docId
   */
  function openDeleteModal(docId) {
    pendingDeleteId = docId;
    el.deleteModal.classList.remove("hidden");
    el.deleteModal.classList.add("flex");
    // Trap focus inside modal for accessibility
    el.modalCancel.focus();
  }

  /**
   * closeDeleteModal()
   * Hides the dialog and clears the pending ID.
   */
  function closeDeleteModal() {
    el.deleteModal.classList.add("hidden");
    el.deleteModal.classList.remove("flex");
    pendingDeleteId = null;
  }

  // ─── Event Delegation ─────────────────────────────────────────────────────

  /**
   * handleTableClick(e)
   * Single delegated listener on `#cm-table-body`.
   * Reads `data-action` and `data-id` from whichever action button was clicked.
   *
   * @param {MouseEvent} e
   */
  function handleTableClick(e) {
    const btn = e.target.closest(".cm-action-btn");
    if (!btn) return;

    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (!id) return;

    switch (action) {
      case "approve":
        approveComment(id);
        break;
      case "reject":
        rejectComment(id);
        break;
      case "delete":
        openDeleteModal(id);
        break;
    }
  }

  /**
   * handleRefreshClick()
   * Re-fetches from Firestore; animates the refresh icon during the request.
   */
  async function handleRefreshClick() {
    // Spin the icon while loading
    el.refreshIcon.classList.add("cm-spin");
    el.btnRefresh.disabled = true;

    try {
      await fetchComments();
    } finally {
      el.refreshIcon.classList.remove("cm-spin");
      el.btnRefresh.disabled = false;
    }
  }

  // ─── Event Listener Registration ─────────────────────────────────────────

  /**
   * registerListeners()
   * Attaches all event listeners.
   * Uses a flag so listeners aren't added multiple times if `load()` is
   * called more than once (e.g., user navigates away and back).
   */
  let _listenersRegistered = false;

  function registerListeners() {
    if (_listenersRegistered) return;
    _listenersRegistered = true;

    // ── Table action buttons (delegated) ────────────────────────────────────
    el.tableBody.addEventListener("click", handleTableClick);

    // ── Toolbar ─────────────────────────────────────────────────────────────
    el.search.addEventListener("input", applyFilters);
    el.filterStatus.addEventListener("change", applyFilters);
    el.btnRefresh.addEventListener("click", handleRefreshClick);

    // ── Delete modal ─────────────────────────────────────────────────────────
    el.modalCancel.addEventListener("click", closeDeleteModal);
    el.modalBackdrop.addEventListener("click", closeDeleteModal);

    el.modalConfirm.addEventListener("click", () => {
      if (pendingDeleteId) deleteComment(pendingDeleteId);
    });

    // ── Keyboard: ESC closes modal ───────────────────────────────────────────
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        !el.deleteModal.classList.contains("hidden")
      ) {
        closeDeleteModal();
      }
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * load()
   * Entry point called by `dashboard.js` when the user navigates to the
   * "Comments" tab.
   *
   * Usage in dashboard.js:
   *   window.TTW_CommentsManager.load();
   *
   * @returns {Promise<void>}
   */
  async function load() {
    cacheElements();
    registerListeners();
    await fetchComments();
  }

  // ─── Namespace Export ─────────────────────────────────────────────────────
  window.TTW_CommentsManager = { load };

})(window, document);
