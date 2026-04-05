/**
 * ============================================================
 *  firebase-config.js  —  Trusted Tools Web Admin Panel
 * ============================================================
 *
 *  HOW TO GET YOUR FIREBASE CREDENTIALS
 *  ─────────────────────────────────────
 *  1. Go to https://console.firebase.google.com
 *  2. Click "Add project" (or open your existing project).
 *  3. In the left sidebar, click the ⚙️ gear icon → "Project settings".
 *  4. Scroll down to the "Your apps" section.
 *  5. Click the </> (Web) icon to register a new web app.
 *     - Give it a nickname, e.g. "TTW Admin".
 *     - Do NOT enable Firebase Hosting unless you plan to use it.
 *  6. Firebase will show you a firebaseConfig object. Copy every
 *     value from it and paste below (replacing the placeholder text).
 *
 *  HOW TO ENABLE EMAIL / PASSWORD AUTH
 *  ─────────────────────────────────────
 *  1. In Firebase Console → Build → Authentication → Sign-in method.
 *  2. Enable "Email/Password" provider.
 *  3. Go to the "Users" tab → "Add user".
 *  4. Enter YOUR email and a strong password. This is the only
 *     account that should ever exist in this project.
 *
 *  SECURITY REMINDER
 *  ─────────────────
 *  These keys are safe to expose in client-side code ONLY when your
 *  Firestore Security Rules restrict access to authenticated users.
 *  Always deploy the security rules provided in the documentation.
 *
 *  ⚠️  Never share your project with others or push it to a public
 *  repository without removing or gitignoring this file.
 * ============================================================
 */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDc9m-lsrzsOC3zVRyXb2xoOOMnyQ7hUic",
    authDomain: "account-tools-comments.firebaseapp.com",
    projectId: "account-tools-comments",
    storageBucket: "account-tools-comments.firebasestorage.app",
    messagingSenderId: "339954634804",
    appId: "1:339954634804:web:a0865ac6aa61e76306fa61"
};

/* ─── Initialize Firebase ───────────────────────────────────────────── */
// Guard: prevent duplicate initialization if file is loaded more than once.
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

/* ─── Export references used by auth.js ────────────────────────────── */
const ttw_auth = firebase.auth();


