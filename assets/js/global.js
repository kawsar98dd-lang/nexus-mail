/* =========================================
   TRUSTED TOOLS WEB - CORE GLOBAL SCRIPT
   Author: MD.KAWSER
   Features: Header, Footer, Theme Toggle (No Firebase)
   ========================================= */

/* =========================================
   TRUSTED TOOLS WEB - CORE GLOBAL SCRIPT
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {
    const path = window.location.pathname;
    let root = './';
    if (path.includes('/tools/')) root = '../../';
    else if (path.includes('/pages/')) root = '../';

    loadGlobalHeader(root);
    loadGlobalFooter(root);
    initThemeSystem();
    
    // Initialize the global toast notification system
    initGlobalToast(); 
});

// --- NEW: Global Toast Initializer ---
function initGlobalToast() {
    // Inject the toast HTML directly into the body
    const toastHTML = `
        <div id="global-toast-box" class="global-toast-box" role="status" aria-live="polite">
            <i id="global-toast-icon" class="fa-solid fa-circle-check"></i>
            <span id="global-toast-message"></span>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', toastHTML);
}

// --- NEW: Global Show Toast Function ---
// Attach to window object so any tool script can call window.showToast()
window.showToast = function(msg, isError = false) {
    const toastBox = document.getElementById('global-toast-box');
    const toastMsg = document.getElementById('global-toast-message');
    const toastIcon = document.getElementById('global-toast-icon');

    if (!toastBox || !toastMsg) return;

    // Set the message
    toastMsg.textContent = msg;

    // Handle Success vs Error styling
    if (isError) {
        toastBox.classList.add('error');
        toastIcon.className = 'fa-solid fa-circle-exclamation';
    } else {
        toastBox.classList.remove('error');
        toastIcon.className = 'fa-solid fa-circle-check';
    }

    // Show the toast (slide in)
    toastBox.classList.add('show');

    // Hide the toast after 3.5 seconds
    setTimeout(() => {
        toastBox.classList.remove('show');
    }, 3500);
};

// ... (আপনার বাকি হেডার, ফুটার এবং থিমের ফাংশনগুলো যেমন আছে তেমনই থাকবে) ...

// --- ১. হেডার লোড ফাংশন ---
function loadGlobalHeader(root) {
    const headerEl = document.getElementById('global-header');
    if (!headerEl) return;

    headerEl.innerHTML = `
        <div class="header-content">
            <a href="${root}index.html" class="header-logo" style="text-decoration: none;">
                <i class="fa-solid fa-shield-halved"></i> Trusted Tools <span>Web</span>
            </a>
            <a href="${root}index.html" class="home-btn"><i class="fa-solid fa-house"></i> Home</a>
        </div>
    `;
}

// --- ২. ফুটার লোড ফাংশন ---
function loadGlobalFooter(root) {
    const footerEl = document.getElementById('global-footer');
    if (!footerEl) return;

    footerEl.innerHTML = `
        <a href="https://www.facebook.com/share/1Ftz4p1nov/" target="_blank" rel="noopener noreferrer" class="floating-contact fb-pos" aria-label="Follow me on Facebook">
            <i class="fa-brands fa-facebook-f"></i>
            <span class="tooltip">Follow Me</span>
            <div class="pulse-ring"></div>
        </a>

        <div class="floating-contact theme-pos" onclick="toggleTheme()" role="button" tabindex="0" aria-label="Toggle Dark Mode">
            <i class="fa-solid fa-sun" id="themeIcon"></i>
            <span class="tooltip">Change Theme</span>
        </div>

        <div class="telegram-menu-container" id="tgMenu">
            <a href="https://t.me/TrustedToolsWeb" target="_blank" class="tm-link">
                Join Channel <i class="fa-solid fa-bullhorn"></i>
            </a>
            <a href="https://t.me/Md_Kawser2" target="_blank" class="tm-link">
                Contact Dev <i class="fa-brands fa-telegram"></i>
            </a>
        </div>

        <div class="floating-contact" onclick="toggleTelegramMenu(event)" role="button" aria-label="Open Telegram Options" style="cursor: pointer;">
            <i class="fa-regular fa-paper-plane"></i> <span class="tooltip">Contact Options</span>
            <div class="pulse-ring"></div>
        </div>

        <div class="footer-bg-grid"></div>
        <div class="footer-glow-point"></div>

        <div class="footer-container relative-z">
            <div class="footer-brand animated-entry">
                <i class="fa-solid fa-shield-halved brand-icon"></i> 
                <span class="brand-name">Trusted Tools <span class="highlight">Web</span></span>
            </div>
            <p class="footer-tagline animated-entry delay-1">Your Secure Digital Arsenal. Fast, Free & Private Utilities.</p>

            <div class="glass-nav-panel animated-entry delay-1">
                <a href="${root}pages/about.html" class="f-link"><i class="fa-solid fa-circle-info"></i> About</a>
                <a href="${root}pages/contact.html" class="f-link"><i class="fa-solid fa-envelope"></i> Contact</a>
                <a href="${root}pages/privacy-policy.html" class="f-link"><i class="fa-solid fa-user-shield"></i> Privacy</a>
                <a href="${root}pages/terms.html" class="f-link"><i class="fa-solid fa-gavel"></i> Terms</a>
                <a href="${root}pages/disclaimer.html" class="f-link"><i class="fa-solid fa-triangle-exclamation"></i> Disclaimer</a>
            </div>

            <div class="footer-bottom animated-entry delay-2">
                <p class="copyright">
                    © 2026 <strong>Trusted Tools Web</strong>. Addicted to Security.
                </p>
                <div class="developer-badge">
                    Designed with <i class="fa-solid fa-code" style="color: var(--accent-color);"></i> by 
                    <a href="https://t.me/Md_Kawser2" target="_blank" rel="noopener noreferrer" class="dev-link glow-effect">MD.KAWSER</a>
                </div>
            </div>
        </div>
    `;
    
    initThemeSystem(); 
}

// --- ৩. থিম সিস্টেম (Dark/Light Mode) ---
function initThemeSystem() {
    const savedTheme = localStorage.getItem('siteTheme') || 'dark';
    const body = document.body;
    const icon = document.getElementById('themeIcon');

    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    } else {
        body.classList.remove('light-mode');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
}

// উইন্ডো ফাংশন যাতে HTML এর onclick="toggleTheme()" কাজ করে
window.toggleTheme = function() {
    const body = document.body;
    const icon = document.getElementById('themeIcon');
    
    body.classList.toggle('light-mode');
    
    if (body.classList.contains('light-mode')) {
        localStorage.setItem('siteTheme', 'light');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    } else {
        localStorage.setItem('siteTheme', 'dark');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
};

// --- ৪. টেলিগ্রাম মেনু লজিক ---
window.toggleTelegramMenu = function(event) {
    event.stopPropagation();
    const menu = document.getElementById('tgMenu');
    menu.classList.toggle('active');
}

// স্ক্রিনের অন্য কোথাও ক্লিক করলে মেনু বন্ধ হবে
document.addEventListener('click', function(event) {
    const menu = document.getElementById('tgMenu');
    const triggerBtn = event.target.closest('.floating-contact');
    
    if (menu && menu.classList.contains('active') && !triggerBtn) {
        menu.classList.remove('active');
    }
});
