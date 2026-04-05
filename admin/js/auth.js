/**
 * ============================================================
 *  auth.js  —  Trusted Tools Web Admin Panel
 *  Handles: Login, Logout, Auth State, Rate Limiting,
 *           Persistence, Password Toggle, UI feedback.
 * ============================================================
 */

(function () {
  "use strict";

  /* ─── Constants ──────────────────────────────────────────── */
  const DASHBOARD_URL    = "dashboard.html";   // Redirect after login
  const MAX_ATTEMPTS     = 5;                  // Max failed logins before lockout
  const LOCKOUT_MS       = 15 * 60 * 1000;    // 15 minutes lockout window
  const STORAGE_KEY      = "ttw_auth_attempts";
  const LOCKOUT_KEY      = "ttw_auth_lockout";

  /* ─── DOM References ─────────────────────────────────────── */
  const emailInput    = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const loginBtn      = document.getElementById("loginBtn");
  const rememberMe    = document.getElementById("rememberMe");
  const togglePwBtn   = document.getElementById("togglePw");
  const eyeOpen       = document.getElementById("eyeOpen");
  const eyeClosed     = document.getElementById("eyeClosed");
  const msgError      = document.getElementById("msgError");
  const msgErrorText  = document.getElementById("msgErrorText");
  const msgSuccess    = document.getElementById("msgSuccess");
  const msgSuccessText = document.getElementById("msgSuccessText");
  const loginCard     = document.getElementById("loginCard");
  const rateWrap      = document.getElementById("rateWrap");
  const rateBar       = document.getElementById("rateBar");

  /* ─── Utility: Show / hide messages ─────────────────────── */
  function showError(msg) {
    msgErrorText.textContent = msg;
    msgError.classList.add("show");
    msgSuccess.classList.remove("show");
    // Shake the card
    loginCard.classList.remove("shake");
    void loginCard.offsetWidth; // reflow trigger
    loginCard.classList.add("shake");
    loginCard.addEventListener("animationend", () => loginCard.classList.remove("shake"), { once: true });
  }

  function showSuccess(msg) {
    msgSuccessText.textContent = msg;
    msgSuccess.classList.add("show");
    msgError.classList.remove("show");
  }

  function clearMessages() {
    msgError.classList.remove("show");
    msgSuccess.classList.remove("show");
  }

  /* ─── Utility: Button loading state ─────────────────────── */
  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    if (isLoading) {
      loginBtn.innerHTML = '<span class="spinner"></span> Authenticating…';
    } else {
      loginBtn.textContent = "Sign In to Dashboard";
    }
  }

  /* ─── Rate Limiting ──────────────────────────────────────── */
  function getRateData() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || { count: 0 };
    } catch {
      return { count: 0 };
    }
  }

  function getLockoutExpiry() {
    return parseInt(sessionStorage.getItem(LOCKOUT_KEY) || "0", 10);
  }

  function isLockedOut() {
    const expiry = getLockoutExpiry();
    if (expiry && Date.now() < expiry) return true;
    if (expiry && Date.now() >= expiry) {
      // Lockout expired — clear it
      sessionStorage.removeItem(LOCKOUT_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    return false;
  }

  function recordFailedAttempt() {
    const data = getRateData();
    data.count = (data.count || 0) + 1;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const remaining = MAX_ATTEMPTS - data.count;

    if (data.count >= MAX_ATTEMPTS) {
      sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
      showLockout();
    } else {
      updateRateBar(data.count);
      if (remaining <= 2) {
        showError(`Incorrect credentials. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before lockout.`);
      }
    }
  }

  function clearRateData() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(LOCKOUT_KEY);
  }

  function updateRateBar(count) {
    const pct = Math.min((count / MAX_ATTEMPTS) * 100, 100);
    rateWrap.style.display = "block";
    rateBar.style.width    = pct + "%";
    rateBar.style.background = pct >= 80
      ? "linear-gradient(90deg,#f87171,#ef4444)"
      : pct >= 60
        ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
        : "linear-gradient(90deg,#34d399,#6ee7b7)";
  }

  function showLockout() {
    const expiry      = getLockoutExpiry();
    const remaining   = Math.ceil((expiry - Date.now()) / 60000);
    loginBtn.disabled = true;
    emailInput.disabled    = true;
    passwordInput.disabled = true;
    rateWrap.style.display = "block";
    rateBar.style.width    = "100%";
    rateBar.style.background = "linear-gradient(90deg,#f87171,#ef4444)";
    showError(`Too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? "s" : ""}.`);

    // Auto-refresh countdown
    const interval = setInterval(() => {
      if (!isLockedOut()) {
        clearInterval(interval);
        clearMessages();
        loginBtn.disabled       = false;
        emailInput.disabled    = false;
        passwordInput.disabled = false;
        rateWrap.style.display = "none";
      } else {
        const mins = Math.ceil((getLockoutExpiry() - Date.now()) / 60000);
        showError(`Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`);
      }
    }, 30000);
  }

  /* ─── Firebase Auth: Persistence ────────────────────────── */
  function getAuthPersistence() {
    return rememberMe && rememberMe.checked
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
  }

  /* ─── Auth State Observer ────────────────────────────────── */
  // If a user is already signed in, redirect immediately.
  ttw_auth.onAuthStateChanged(function (user) {
    if (user) {
      redirectToDashboard();
    }
  });

  function redirectToDashboard() {
    showSuccess("Authentication successful. Redirecting…");
    setTimeout(() => {
      window.location.href = DASHBOARD_URL;
    }, 800);
  }

  /* ─── Main Login Handler ─────────────────────────────────── */
  async function handleLogin() {
    clearMessages();

    // ── Check lockout ──
    if (isLockedOut()) {
      showLockout();
      return;
    }

    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    // ── Client-side validation ──
    if (!email) {
      showError("Please enter your email address.");
      emailInput.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Please enter a valid email address.");
      emailInput.focus();
      return;
    }
    if (!password) {
      showError("Please enter your password.");
      passwordInput.focus();
      return;
    }
    if (password.length < 6) {
      showError("Password must be at least 6 characters.");
      passwordInput.focus();
      return;
    }

    setLoading(true);

    try {
      // ── Set persistence based on "remember me" ──
      await ttw_auth.setPersistence(getAuthPersistence());

      // ── Firebase sign-in ──
      await ttw_auth.signInWithEmailAndPassword(email, password);

      // Success — clear rate data
      clearRateData();
      redirectToDashboard();

    } catch (err) {
      setLoading(false);
      recordFailedAttempt();

      // Map Firebase error codes to friendly messages
      const errorMap = {
        "auth/user-not-found":       "No account found with this email.",
        "auth/wrong-password":       "Incorrect password. Please try again.",
        "auth/invalid-email":        "The email address is not valid.",
        "auth/user-disabled":        "This account has been disabled.",
        "auth/too-many-requests":    "Too many attempts. Account temporarily locked by Firebase.",
        "auth/network-request-failed": "Network error. Check your connection.",
        "auth/invalid-credential":   "Invalid credentials. Please check and retry.",
      };

      const friendly = errorMap[err.code] || "An unexpected error occurred. Please try again.";

      // Only show the generic error if rate limiting hasn't already shown one
      if (getRateData().count < MAX_ATTEMPTS - 2) {
        showError(friendly);
      }

      // Clear password field on failure for security
      passwordInput.value = "";
      passwordInput.focus();
    }
  }

  /* ─── Password Visibility Toggle ────────────────────────── */
  if (togglePwBtn) {
    togglePwBtn.addEventListener("click", function () {
      const isPassword = passwordInput.type === "password";
      passwordInput.type    = isPassword ? "text" : "password";
      eyeOpen.style.display  = isPassword ? "none"  : "block";
      eyeClosed.style.display = isPassword ? "block" : "none";
      passwordInput.focus();
    });
  }

  /* ─── Event Listeners ────────────────────────────────────── */
  if (loginBtn) {
    loginBtn.addEventListener("click", handleLogin);
  }

  // Allow Enter key to submit
  [emailInput, passwordInput].forEach((el) => {
    if (el) {
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") handleLogin();
      });
    }
  });

  // Clear error on input change
  [emailInput, passwordInput].forEach((el) => {
    if (el) {
      el.addEventListener("input", function () {
        msgError.classList.remove("show");
      });
    }
  });

  /* ─── Lockout check on page load ─────────────────────────── */
  if (isLockedOut()) {
    showLockout();
  }

})(); // End IIFE
