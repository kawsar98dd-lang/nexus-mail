/**
 * ============================================================
 *  dashboard.js  —  Trusted Tools Web Admin Panel
 *
 *  Responsibilities:
 *  1. AUTH GUARD  — Immediately redirect unauthenticated users
 *     back to the login page. The page is hidden until Firebase
 *     confirms a valid session (prevents content flash).
 *  2. NAVIGATION  — Handles sidebar section switching and
 *     breadcrumb updates. Sections are shown/hidden via CSS
 *     class toggling (no page reloads needed).
 *  3. SIDEBAR UX  — Mobile sidebar open/close with overlay.
 *  4. LOGOUT      — Signs the user out and redirects to login.
 *  5. USER INFO   — Populates avatar and email in the sidebar.
 *
 *  Depends on: firebase-config.js (must load first)
 * ============================================================
 */

(function () {
  "use strict";

  /* ─── Constants ──────────────────────────────────────────── */
  const LOGIN_URL = "index.html";   // Redirect target if not authenticated

  /* ─── DOM References ─────────────────────────────────────── */
  const pageGuard        = document.getElementById("pageGuard");
  const sidebar          = document.getElementById("sidebar");
  const sidebarOverlay   = document.getElementById("sidebarOverlay");
  const hamburgerBtn     = document.getElementById("hamburgerBtn");
  const logoutBtn        = document.getElementById("logoutBtn");
  const breadcrumbLabel  = document.getElementById("breadcrumbLabel");
  const userEmailDisplay = document.getElementById("userEmailDisplay");
  const userAvatarInitial = document.getElementById("userAvatarInitial");
  const refreshBtn       = document.getElementById("refreshBtn");

  /* ─── Section metadata ───────────────────────────────────── */
  // Maps data-section attribute → { view element id, breadcrumb label }
  const SECTIONS = {
    "dashboard":   { viewId: "view-dashboard",   label: "Dashboard" },
    "site-config": { viewId: "view-site-config",  label: "Site Config" },
    "ads":         { viewId: "view-ads",          label: "Ads Manager" },
    "comments":    { viewId: "view-comments",     label: "Comments" },
  };

  /* ─── Track active section ───────────────────────────────── */
  let activeSection = "dashboard";

  /* ══════════════════════════════════════════════════════════ */
  /*  1. AUTH GUARD                                             */
  /*                                                            */
  /*  onAuthStateChanged fires once on page load with the       */
  /*  current user (or null). We use it as a security gate:     */
  /*  - null  → kick to login instantly                         */
  /*  - user  → reveal the page and populate user info          */
  /* ══════════════════════════════════════════════════════════ */
  ttw_auth.onAuthStateChanged(function (user) {
    if (!user) {
      // No valid session — redirect to login before any content renders.
      window.location.replace(LOGIN_URL);
      return;
    }

    // ── Valid session confirmed ──────────────────────────────
    populateUserInfo(user);
    revealPage();
  });

  /**
   * Removes the auth guard overlay, revealing the dashboard.
   * Uses a short CSS transition for a polished feel.
   */
  function revealPage() {
    if (!pageGuard) return;
    pageGuard.classList.add("hidden");
    // Remove from DOM after transition completes to free memory
    pageGuard.addEventListener("transitionend", () => pageGuard.remove(), { once: true });
  }

  /**
   * Populates the sidebar user card with email + avatar initial.
   * @param {firebase.User} user
   */
  function populateUserInfo(user) {
    const email = user.email || "Unknown";

    if (userEmailDisplay) userEmailDisplay.textContent = email;

    if (userAvatarInitial) {
      // Use first character of the email address as the avatar initial
      userAvatarInitial.textContent = email.charAt(0).toUpperCase();
    }
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  2. SECTION NAVIGATION                                     */
  /*                                                            */
  /*  All sidebar nav buttons carry a data-section attribute.   */
  /*  Clicking one:                                             */
  /*   a) Hides the current view section                        */
  /*   b) Shows the target view section                         */
  /*   c) Updates active state on nav items                     */
  /*   d) Updates the breadcrumb                                */
  /*   e) Closes the mobile sidebar                             */
  /* ══════════════════════════════════════════════════════════ */

  /**
   * Switches the visible content section.
   * @param {string} sectionKey — key from SECTIONS map
   */
  function switchSection(sectionKey) {
    const target = SECTIONS[sectionKey];
    if (!target) return;

    // Hide current view
    const currentView = document.getElementById(SECTIONS[activeSection]?.viewId);
    if (currentView) currentView.classList.remove("active");

    // Show new view
    const newView = document.getElementById(target.viewId);
    if (newView) newView.classList.add("active");

    // Update nav active states
    document.querySelectorAll(".nav-item[data-section]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === sectionKey);
      btn.setAttribute("aria-current", btn.dataset.section === sectionKey ? "page" : "false");
    });

    // Update breadcrumb
    if (breadcrumbLabel) breadcrumbLabel.textContent = target.label;

    // Store active section
    activeSection = sectionKey;

      // If switching to site-config, fire a reload of Firestore data
    if (sectionKey === "site-config" && window.TTW_SiteConfig) {
      window.TTW_SiteConfig.load();
    }
    // If switching to ads, reload ad config from Firestore
    if (sectionKey === "ads" && window.TTW_AdsManager) {
      window.TTW_AdsManager.load();
    }
    // If switching to comments, reload comments from Firestore
    if (sectionKey === "comments" && window.TTW_CommentsManager) {
      window.TTW_CommentsManager.load();
    }


    // Close mobile sidebar
    closeSidebar();
  }

  // Delegate click events on all [data-section] buttons (nav + quick actions)
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-section]");
    if (!btn) return;
    const sectionKey = btn.dataset.section;
    if (SECTIONS[sectionKey]) {
      switchSection(sectionKey);
    }
  });

  /* ══════════════════════════════════════════════════════════ */
  /*  3. SIDEBAR — MOBILE TOGGLE                               */
  /* ══════════════════════════════════════════════════════════ */

  function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("open");
    document.body.style.overflow = "hidden"; // Prevent background scroll
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener("click", function () {
      sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeSidebar);
  }

  // Close sidebar on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSidebar();
  });

  /* ══════════════════════════════════════════════════════════ */
  /*  4. LOGOUT                                                 */
  /*                                                            */
  /*  Signs out via Firebase Auth and redirects to login.       */
  /*  Uses window.location.replace() so the dashboard cannot    */
  /*  be reached by pressing the browser back button.           */
  /* ══════════════════════════════════════════════════════════ */

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      // Optimistic UI — disable button immediately
      logoutBtn.disabled = true;
      logoutBtn.textContent = "Signing out…";

      try {
        await ttw_auth.signOut();
        window.location.replace(LOGIN_URL);
      } catch (err) {
        console.error("[TTW Admin] Logout error:", err);
        // Re-enable on failure
        logoutBtn.disabled = false;
        logoutBtn.textContent = "Sign Out";

        // Show toast if toast system is available
        if (window.TTW_Toast) {
          window.TTW_Toast.error("Sign Out Failed", "Could not sign out. Please try again.");
        }
      }
    });
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  5. REFRESH BUTTON                                         */
  /*                                                            */
  /*  Reloads data for the currently active section.            */
  /* ══════════════════════════════════════════════════════════ */

  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      // Spin the icon for visual feedback
      const icon = refreshBtn.querySelector("svg");
      if (icon) {
        icon.style.transition  = "transform 0.5s ease";
        icon.style.transform   = "rotate(360deg)";
        setTimeout(() => {
          icon.style.transition = "";
          icon.style.transform  = "";
        }, 500);
      }

      // Reload current section data
      if (activeSection === "site-config" && window.TTW_SiteConfig) {
        window.TTW_SiteConfig.load();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  GLOBAL TOAST API                                          */
  /*                                                            */
  /*  Exposed as window.TTW_Toast so that other modules         */
  /*  (e.g. site-config-manager.js) can display notifications. */
  /*                                                            */
  /*  Usage:                                                     */
  /*    TTW_Toast.success("Title", "Message")                   */
  /*    TTW_Toast.error("Title", "Message")                     */
  /*    TTW_Toast.info("Title", "Message")                      */
  /* ══════════════════════════════════════════════════════════ */

  const toastContainer = document.getElementById("toastContainer");

  const TOAST_ICONS = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  /**
   * Creates and displays a toast notification.
   * @param {"success"|"error"|"info"} type
   * @param {string} title
   * @param {string} message
   * @param {number} [duration=4000] — ms before auto-dismiss
   */
  function showToast(type, title, message, duration = 4000) {
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `
      <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ""}
      </div>
      <button class="toast-close" aria-label="Dismiss notification">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    toastContainer.appendChild(toast);

    // Close button
    toast.querySelector(".toast-close").addEventListener("click", () => dismissToast(toast));

    // Auto-dismiss
    const timer = setTimeout(() => dismissToast(toast), duration);

    // Cancel auto-dismiss on hover (gives user time to read)
    toast.addEventListener("mouseenter", () => clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
      setTimeout(() => dismissToast(toast), 1500);
    });
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add("out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }

  /** Basic HTML escape to prevent XSS in toast messages */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Expose toast API globally for other modules
  window.TTW_Toast = {
    success: (title, msg, dur) => showToast("success", title, msg, dur),
    error:   (title, msg, dur) => showToast("error",   title, msg, dur),
    info:    (title, msg, dur) => showToast("info",    title, msg, dur),
  };

})(); // End IIFE
