/* =========================================
   TRUSTED TOOLS WEB - MAIN SCRIPT (V2.2)
   Author: MD.KAWSER

   ⚠️ IMPORTANT — THEME SYSTEM নিয়ে নোট:
   ─────────────────────────────────────────
   global.js theme system চালায়:
     • localStorage key : 'siteTheme'
     • method           : body.classList.toggle('light-mode')
     • button           : .floating-contact.theme-pos (footer এ inject হয়)

   এই ফাইলে আগে যে initThemeSystem() ছিল সেটা conflict করত:
     ❌ আলাদা key ('theme') ব্যবহার করত
     ❌ data-theme attribute সেট করত (CSS এ এর কোনো rule নেই)
     ❌ নিজে আলাদা button তৈরি করত (duplicate হতো)

   সমাধান:
     ✅ এই ফাইলে কোনো theme button নেই
     ✅ কোনো toggle logic নেই
     ✅ শুধু page load এ global.js এর 'siteTheme' key sync করা হয়
     ✅ Firebase comment system ই এই ফাইলের একমাত্র কাজ
   ========================================= */

// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDc9m-lsrzsOC3zVRyXb2xoOOMnyQ7hUic",
    authDomain: "account-tools-comments.firebaseapp.com",
    projectId: "account-tools-comments",
    storageBucket: "account-tools-comments.firebasestorage.app",
    messagingSenderId: "339954634804",
    appId: "1:339954634804:web:a0865ac6aa61e76306fa61"
};

const ADMIN_EMAILS = ["kawser98dd@gmail.com"];

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const commentsRef = collection(db, "website_comments");


/* =========================================
   1. THEME SYNC — global.js এর সাথে
   
   global.js DOMContentLoaded এ initThemeSystem()
   call করে। কিন্তু footer inject এর আগেই চলে,
   তাই page load এ theme মাঝে মাঝে miss করে।
   
   এখানে একটা MutationObserver রাখা হয়েছে:
   footer এ theme button inject হওয়ার সাথে সাথে
   'siteTheme' পড়ে icon ও class ঠিক করে দেবে।
   global.js এর কোনো function ডাকা হয় না —
   শুধু DOM ও localStorage sync করা হয়।
   ========================================= */
function syncThemeOnLoad() {
    // global.js এর key থেকে পড়া
    const saved = localStorage.getItem('siteTheme') || 'dark';

    // body class এখনই ঠিক করা
    if (saved === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }

    // themeIcon এখনো inject না হয়ে থাকলে
    // MutationObserver দিয়ে অপেক্ষা করা
    const tryUpdateIcon = () => {
        const icon = document.getElementById('themeIcon');
        if (!icon) return false;
        if (saved === 'light') {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
        return true;
    };

    // icon এখনই পাওয়া গেলে সরাসরি update
    if (!tryUpdateIcon()) {
        // না পাওয়া গেলে footer inject হওয়ার জন্য অপেক্ষা
        const observer = new MutationObserver(() => {
            if (tryUpdateIcon()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}


/* =========================================
   2. HELPER FUNCTIONS
   ========================================= */
const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const timeAgo = (date) => {
    if (!date) return "Just now";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};


/* =========================================
   3. FIREBASE COMMENT SYSTEM
   ========================================= */
let currentUser = null;
const commentsDisplay = document.getElementById("commentsDisplay");
const postBtn        = document.getElementById("postBtn");
const msgInput       = document.getElementById("userMessage");
const statusMsg      = document.getElementById("statusMsg");

// --- Auth State ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const loggedInView  = document.getElementById("logged-in-view");
    const loggedOutView = document.getElementById("logged-out-view");

    if (!loggedInView || !loggedOutView) return;

    if (user) {
        loggedOutView.style.display = "none";
        loggedInView.style.display  = "flex";
        document.getElementById("user-profile-pic").src    = user.photoURL || "https://api.dicebear.com/9.x/avataaars/svg?seed=Guest";
        document.getElementById("user-name-display").textContent  = user.displayName;
        document.getElementById("user-email-display").textContent = user.email;
        if (postBtn) {
            postBtn.disabled = false;
            postBtn.textContent = "Post Comment";
            postBtn.style.opacity = "1";
            postBtn.style.cursor  = "pointer";
        }
    } else {
        loggedOutView.style.display = "block";
        loggedInView.style.display  = "none";
        if (postBtn) {
            postBtn.disabled = true;
            postBtn.textContent = "Login to Post";
            postBtn.style.opacity = "0.6";
            postBtn.style.cursor  = "not-allowed";
        }
    }
});

// --- Login / Logout ---
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        try { await signInWithPopup(auth, provider); }
        catch (e) { alert("Login Failed: " + e.message); }
    });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        if (confirm("Logout from Trusted Tools?")) signOut(auth);
    });
}

// --- Post Comment ---
if (postBtn) {
    postBtn.addEventListener("click", async () => {
        if (!currentUser) return;
        const msg = msgInput.value.trim();
        if (!msg) return;

        postBtn.disabled = true;
        postBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Posting...';

        try {
            await addDoc(commentsRef, {
                uid:       currentUser.uid,
                name:      currentUser.displayName,
                photoURL:  currentUser.photoURL,
                email:     currentUser.email,
                message:   msg,
                timestamp: serverTimestamp(),
                isAdmin:   ADMIN_EMAILS.includes(currentUser.email),
                parentId:  null,
                isEdited:  false
            });
            msgInput.value = "";
            if (statusMsg) {
                statusMsg.textContent = "✅ Posted successfully!";
                setTimeout(() => statusMsg.textContent = "", 3000);
            }
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            postBtn.disabled = false;
            postBtn.textContent = "Post Comment";
        }
    });
}

// --- Real-time Comment Render ---
const q = query(commentsRef, orderBy("timestamp", "desc"), limit(100));

onSnapshot(q, (snapshot) => {
    if (!commentsDisplay) return;
    commentsDisplay.innerHTML = "";

    if (snapshot.empty) {
        commentsDisplay.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-muted);">
                <i class="fa-regular fa-comments" style="font-size:2rem; margin-bottom:10px;"></i><br>
                No discussions yet. Be the first!
            </div>`;
        return;
    }

    const allDocs      = snapshot.docs;
    const rootComments = allDocs.filter(d => !d.data().parentId);
    rootComments.forEach(d => {
        commentsDisplay.innerHTML += generateCommentHTML(d, allDocs);
    });
});

// --- Comment HTML Generator ---
function generateCommentHTML(docSnapshot, allDocs) {
    const data = docSnapshot.data();
    const id   = docSnapshot.id;
    const time = data.timestamp ? timeAgo(data.timestamp.toDate()) : "Posting...";

    let controls = "";
    if (currentUser) {
        const isOwner = currentUser.uid === data.uid;
        const isAdmin = ADMIN_EMAILS.includes(currentUser.email);
        if (isOwner || isAdmin) {
            if (isOwner) {
                controls += `<button onclick="window.editComment('${id}')" class="act-btn edit">
                    <i class="fa-solid fa-pen"></i>
                </button>`;
            }
            controls += `<button onclick="window.deleteComment('${id}')" class="act-btn del">
                <i class="fa-solid fa-trash"></i>
            </button>`;
        }
    }

    const badge  = data.isAdmin
        ? `<span class="badge" style="background:var(--accent-secondary);margin-left:5px;
           font-size:0.65rem;padding:2px 7px;border-radius:4px;color:#fff;font-weight:800;">ADMIN</span>`
        : "";
    const edited = data.isEdited
        ? `<span style="font-size:0.7em;color:var(--text-muted);"> (edited)</span>`
        : "";

    const replies = allDocs
        .filter(d => d.data().parentId === id)
        .sort((a, b) => (a.data().timestamp?.seconds || 0) - (b.data().timestamp?.seconds || 0));

    let repliesHTML = "";
    if (replies.length > 0) {
        repliesHTML = `<div class="reply-wrapper">`;
        replies.forEach(r => repliesHTML += generateCommentHTML(r, allDocs));
        repliesHTML += `</div>`;
    }

    return `
    <div class="single-comment" id="comment-${id}">
        <div class="comment-avatar">
            <img src="${escapeHtml(data.photoURL)}" alt="User">
        </div>
        <div class="comment-content">
            <div class="comment-header">
                <div>
                    <span class="comment-author">${escapeHtml(data.name)}</span>${badge}
                    <span class="comment-date"> • ${time}</span>
                </div>
            </div>
            <div class="comment-text" id="msg-${id}">${escapeHtml(data.message)}${edited}</div>
            <div class="action-bar" style="margin-top:8px;display:flex;gap:10px;opacity:0.8;">
                <button onclick="window.replyComment('${id}','${escapeHtml(data.name)}')" class="act-btn reply">
                    <i class="fa-solid fa-reply"></i> Reply
                </button>
                ${controls}
            </div>
            ${repliesHTML}
        </div>
    </div>`;
}


/* =========================================
   4. GLOBAL WINDOW FUNCTIONS
   ========================================= */
window.replyComment = async (parentId, name) => {
    if (!currentUser) return alert("Please login to reply.");
    const text = prompt(`Reply to ${name}:`);
    if (text) {
        await addDoc(commentsRef, {
            uid:       currentUser.uid,
            name:      currentUser.displayName,
            photoURL:  currentUser.photoURL,
            email:     currentUser.email,
            message:   text,
            timestamp: serverTimestamp(),
            isAdmin:   ADMIN_EMAILS.includes(currentUser.email),
            parentId:  parentId,
            isEdited:  false
        });
    }
};

window.editComment = async (docId) => {
    const el = document.getElementById(`msg-${docId}`);
    const oldText = el ? el.innerText.replace(" (edited)", "") : "";
    const newText = prompt("Edit your comment:", oldText);
    if (newText && newText !== oldText) {
        await updateDoc(doc(db, "website_comments", docId), {
            message:  newText,
            isEdited: true
        });
    }
};

window.deleteComment = async (docId) => {
    if (confirm("Delete this comment permanently?")) {
        await deleteDoc(doc(db, "website_comments", docId));
    }
};


/* =========================================
   5. INITIALIZATION
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
    // global.js এর theme system এর সাথে sync করা
    // নিজে কোনো button বানানো হচ্ছে না
    syncThemeOnLoad();

    console.log("Trusted Tools Web: Firebase Comment System Loaded 🚀");
});
