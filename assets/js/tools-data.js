/**
 * ============================================================
 * toolsData.js — Dynamic Tool Card Data Array
 * ============================================================
 * ARCHITECTURE: CSS Custom Properties (Variables) System
 *
 * Each tool object now carries its own unique theme colors
 * (themeColor1 & themeColor2) as data properties. These are
 * injected as inline CSS variables (--c1, --c2) on the card's
 * root wrapper, allowing a single set of generic CSS classes
 * to render infinite unique designs without ever writing new CSS.
 *
 * GENERIC CLASSES USED (fully dynamic via --c1 / --c2):
 *  - .card-badge        → Badge pill (gradient + glow)
 *  - .icon-main         → Main icon (gradient text fill)
 *  - .icon-sub1         → Top-right floating sub-icon
 *  - .icon-sub2         → Bottom-left accent sub-icon
 *  - .title-span        → Title gradient text span
 *  - .ft-1              → Feature tag (primary color)
 *  - .ft-2              → Feature tag (secondary color)
 *
 * TO ADD A NEW TOOL: Copy any object below, update its fields,
 * and choose two hex colors. Zero new CSS required. Ever.
 * ============================================================
 */

const toolsData = [

    /* ── Tool 01: Titan Auth PRO MAX ──────────────────────── */
    {
        link: "tools/sec/2fa-authenticator-pro.html",
        category: "sec",
        classes: "tool-card",
        themeColor1: "#00e5ff",
        themeColor2: "#d124ff",
        dataName: "2fa authenticator titan pro max totp generator offline security aes-256 vault google facebook binance backup restore",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">MILITARY GRADE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-shield-halved icon-main"></i>
                    <i class="fa-solid fa-key icon-sub1"></i>
                    <i class="fa-solid fa-fingerprint icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Titan Auth <span class="title-span">PRO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-lock"></i> AES-256</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline</span>
                </div>
                <div class="meta-info">
                    <span>No Cloud</span> &bull; 
                    <span>JSON Backup</span> &bull; 
                    <span>Pin Lock</span>
                </div>
            </div>`
    },

    /* ── Tool 02: Audio Studio PRO ─────────────────────────── */
    {
        link: "tools/media/audio-studio-pro.html",
        category: "media",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#ffcc00",
        dataName: "audio editor trimmer cutter mp3 converter bass booster 8d audio maker sound engineer music lab",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">MUSIC LAB</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-music icon-main"></i>
                    <i class="fa-solid fa-sliders icon-sub1"></i>
                    <i class="fa-solid fa-scissors icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Audio Studio <span class="title-span">PRO</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-drum"></i> Bass Boost</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-headphones"></i> 8D Audio</span>
                </div>
                <div class="meta-info">
                    <span>Trimmer</span> &bull; 
                    <span>Converter</span> &bull; 
                    <span>No Limit</span>
                </div>
            </div>`
    },

    /* ── Tool 03: TextPro MAX ──────────────────────────────── */
    {
        link: "tools/text/fancy-font-generator.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#8b5cf6",
        themeColor2: "#d946ef",
        dataName: "textpro max studio fancy fonts qr code generator glitch art encryption speech to text ai tools",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">V5.0 STUDIO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-wand-magic-sparkles icon-main"></i>
                    <i class="fa-solid fa-qrcode icon-sub1"></i>
                    <i class="fa-solid fa-shield-halved icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                TextPro <span class="title-span">MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 5px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-font"></i> Fonts</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-qrcode"></i> QR Gen</span>
                </div>
                <div class="meta-info">
                    <span>Security</span> &bull; 
                    <span>Speech AI</span> &bull; 
                    <span>Img Studio</span>
                </div>
            </div>`
    },

    /* ── Tool 04: Thumbnail Ultra Max ─────────────────────── */
    {
        link: "tools/img/youtube-thumbnail-downloader.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#ff0033",
        themeColor2: "#00e5ff",
        dataName: "youtube thumbnail downloader 4k hd image extractor video cover grabber editor brightness contrast metadata tags",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">4K STUDIO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-brands fa-youtube icon-main"></i>
                    <i class="fa-solid fa-wand-magic-sparkles icon-sub1"></i>
                    <i class="fa-solid fa-file-image icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Thumbnail <span class="title-span">Ultra Max</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-sliders"></i> Live Editor</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-code"></i> Metadata</span>
                </div>
                <div class="meta-info">
                    <span>4K Grabber</span> &bull; 
                    <span>Secure</span> &bull; 
                    <span>No Server</span>
                </div>
            </div>`
    },

    /* ── Tool 05: Link Shortener MAX ──────────────────────── */
    {
        link: "tools/seo/link-shortener-pro.html",
        category: "seo",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#d124ff",
        dataName: "url shortener pro max link cutter custom alias utm builder analytics qr code generator secure free",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">HYPER LINK</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-link icon-main"></i>
                    <i class="fa-solid fa-scissors icon-sub1"></i>
                    <i class="fa-solid fa-shield-halved icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Link Shortener <span class="title-span">MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-wand-magic-sparkles"></i> Custom Alias</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-qrcode"></i> Free QR</span>
                </div>
                <div class="meta-info">
                    <span>UTM Builder</span> &bull; 
                    <span>No Ads</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 06: QR Studio PRO MAX ───────────────────────── */
    {
        link: "tools/img/qr-code-generator-pro.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#d124ff",
        dataName: "qr code generator pro with logo custom design high resolution vector svg png scanner privacy secure",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">STUDIO MAX</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-qrcode icon-main"></i>
                    <i class="fa-solid fa-paintbrush icon-sub1"></i>
                    <i class="fa-regular fa-image icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                QR Studio <span class="title-span">PRO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-layer-group"></i> Add Logo</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-expand"></i> 4K Res</span>
                </div>
                <div class="meta-info">
                    <span>Transparent</span> &bull; 
                    <span>Colors</span> &bull; 
                    <span>Vector</span>
                </div>
            </div>`
    },

    /* ── Tool 07: Image Studio TITANIUM ───────────────────── */
    {
        link: "tools/img/image-studio-pro.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#00e5ff",
        themeColor2: "#d124ff",
        dataName: "image editor compressor titanium crop rotate resize heic converter privacy secure batch processing",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">TITANIUM V2</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-wand-magic-sparkles icon-main"></i>
                    <i class="fa-solid fa-crop-simple icon-sub1"></i>
                    <i class="fa-solid fa-lock icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Image Studio <span class="title-span">TITANIUM</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-layer-group"></i> Batch Edit</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-mobile-screen"></i> HEIC Conv</span>
                </div>
                <div class="meta-info">
                    <span>No Upload</span> &bull; 
                    <span>PDF/ZIP</span> &bull; 
                    <span>Editor</span>
                </div>
            </div>`
    },

    /* ── Tool 08: Meta Gen ULTRA MAX ──────────────────────── */
    {
        link: "tools/seo/meta-tag-generator.html",
        category: "seo",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#00e5ff",
        dataName: "seo meta tag generator open graph twitter card preview google serp simulator schema markup builder",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">SEO ARCHITECT</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-magnifying-glass-chart icon-main"></i>
                    <i class="fa-brands fa-google icon-sub1"></i>
                    <i class="fa-solid fa-code icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Meta Gen <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-eye"></i> Live Preview</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-robot"></i> Robots.txt</span>
                </div>
                <div class="meta-info">
                    <span>Google SERP</span> &bull; 
                    <span>Facebook OG</span> &bull; 
                    <span>Twitter</span>
                </div>
            </div>`
    },

    
    /* ── Tool 09: Smart CV Builder PRO MAX ────────────────── */
    {
        link: "tools/doc/resume-cv-builder.html",
        category: "doc",
        classes: "tool-card",
        themeColor1: "#f59e0b", // Professional Gold
        themeColor2: "#3b82f6", // Trust/Corporate Blue
        dataName: "smart cv builder resume maker ats friendly pdf export professional templates job application client side offline secure privacy cv template",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">CAREER PRO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-user-tie icon-main"></i>
                    <i class="fa-solid fa-file-pdf icon-sub1"></i>
                    <i class="fa-solid fa-shield-halved icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Smart CV Builder <span class="title-span">PRO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-robot"></i> ATS Friendly</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> 100% Offline</span>
                </div>
                <div class="meta-info">
                    <span>PDF Export</span> &bull; 
                    <span>Live Preview</span> &bull; 
                    <span>No Upload</span>
                </div>
            </div>`
    },




    /* ── Tool 10: Screen Rec ULTRA ────────────────────────── */
    {
        link: "tools/media/screen-recorder-pro.html",
        category: "media",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#00e5ff",
        dataName: "screen recorder pro 4k video capture facecam audio microphone system sound studio tool",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">4K STUDIO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-record-vinyl icon-main"></i>
                    <i class="fa-solid fa-video icon-sub1"></i>
                    <i class="fa-solid fa-microphone-lines icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Screen Rec <span class="title-span">ULTRA</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-face-smile"></i> Facecam</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-pen-nib"></i> Draw</span>
                </div>
                <div class="meta-info">
                    <span>No Watermark</span> &bull; 
                    <span>System Audio</span> &bull; 
                    <span>Unlimited</span>
                </div>
            </div>`
    },

    /* ── Tool 11: Handwriter ULTRA MAX ────────────────────── */
    {
        link: "tools/text/handwriting-converter-pro.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#00d2ff",
        dataName: "text to handwriting converter assignment maker bangla font galada pdf generator scan effect blue ink ballpoint real handwriting homework",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">STUDENT PRO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-pen-nib icon-main"></i>
                    <i class="fa-solid fa-file-pdf icon-sub1"></i>
                    <i class="fa-solid fa-language icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Handwriter <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-font"></i> Bangla Font</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-droplet"></i> Real Ink</span>
                </div>
                <div class="meta-info">
                    <span>HD PDF</span> &bull; 
                    <span>Scanner Mode</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 12: Secure Avatar ───────────────────────────── */
    {
        link: "tools/tool/avatar-generator-pro.html",
        category: "tool",
        classes: "tool-card",
        themeColor1: "#bc13fe",
        themeColor2: "#00f3ff",
        dataName: "identity generator avatar maker profile picture glitch art 8-bit retro pixel privacy secure hash unique 4k export",
        html: `
            <div class="badge-container">
                <span class="badge card-badge"><i class="fa-solid fa-robot"></i> AI GEN</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-user-astronaut icon-main"></i>
                    <i class="fa-solid fa-wand-magic-sparkles icon-sub1"></i>
                    <i class="fa-solid fa-palette icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Secure <span class="title-span">Avatar</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-user-secret"></i> Hidden ID</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-palette"></i> Auto Art</span>
                </div>
                <div class="meta-info">
                    <span>No Upload</span> &bull; 
                    <span>4K</span> &bull; 
                    <span>Private</span>
                </div>
            </div>`
    },

    /* ── Tool 13: Ultra Name GEN PRO ──────────────────────── */
    {
        link: "tools/tool/random-name-generator.html",
        category: "tool",
        classes: "tool-card",
        themeColor1: "#d124ff",
        themeColor2: "#00e5ff",
        dataName: "random name generator dummy data user profile creator json export testing tool bangladesh india dummy data privacy",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">DATA FORGE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-user-secret icon-main"></i>
                    <i class="fa-solid fa-database icon-sub1"></i>
                    <i class="fa-solid fa-shield-halved icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Ultra Name <span class="title-span">GEN PRO</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-file-code"></i> JSON Export</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-globe"></i> 40+ Regions</span>
                </div>
                <div class="meta-info">
                    <span>100% Client-Side</span> &bull; 
                    <span>Dev Tools</span> &bull; 
                    <span>Privacy</span>
                </div>
            </div>`
    },

    /* ── Tool 14: Smart EMI ULTRA MAX ─────────────────────── */
    {
        link: "tools/calc/loan-emi-calculator.html",
        category: "calc",
        classes: "tool-card",
        themeColor1: "#00f2ff",
        themeColor2: "#bd00ff",
        dataName: "smart emi calculator loan home car personal interest rate amortization schedule pdf download finance banking",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">CYBER FINANCE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-chart-pie icon-main"></i>
                    <i class="fa-solid fa-file-pdf icon-sub1"></i>
                    <i class="fa-solid fa-robot icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Smart EMI <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-brain"></i> AI Advisor</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-table"></i> Schedule</span>
                </div>
                <div class="meta-info">
                    <span>PDF Export</span> &bull; 
                    <span>Graph Visuals</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 15: IP Address Lookup Pro ───────────────────── */
    {
        link: "tools/sec/ip-address-lookup.html",
        category: "sec",
        classes: "tool-card",
        themeColor1: "#00f3ff",
        themeColor2: "#bf00ff",
        dataName: "ip tracker gps location hardware info browser fingerprinting network security speed test cyber intelligence v7",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">ELITE MOD</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-fingerprint icon-main"></i>
                    <i class="fa-solid fa-location-crosshairs icon-sub1"></i>
                    <i class="fa-solid fa-user-secret icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Ip Address<span class="title-span"> Lookup Pro</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-globe"></i> IP Track</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-mask"></i> Identity</span>
                </div>
                <div class="meta-info">
                    <span>GPS Node</span> &bull; 
                    <span>Canvas Hash</span> &bull; 
                    <span>Spyware</span>
                </div>
            </div>`
    },

    /* ── Tool 16: Tone Gen STUDIO ─────────────────────────── */
    {
        link: "tools/media/tone-frequency-generator.html",
        category: "media",
        classes: "tool-card",
        themeColor1: "#00c6ff",
        themeColor2: "#0072ff",
        dataName: "frequency tone generator binaural noise lfo recorder sound sweep audio test hertz 432hz 528hz",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">AUDIO LAB</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-wave-square icon-main"></i>
                    <i class="fa-solid fa-gears icon-sub1"></i>
                    <i class="fa-solid fa-bolt icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Tone Gen <span class="title-span">STUDIO</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-spa"></i> Healing Freq</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-brain"></i> Brainwave</span>
                </div>
                <div class="meta-info">
                    <span>LFO Mod</span> &bull; 
                    <span>Sweep</span> &bull; 
                    <span>Recorder</span>
                </div>
            </div>`
    },

    /* ── Tool 17: Bulk Url To Sitemap ─────────────────────── */
    {
        link: "tools/seo/sitemap-generator-pro.html",
        category: "seo",
        classes: "tool-card",
        themeColor1: "#ff9966",
        themeColor2: "#ff5e62",
        dataName: "ultra pro max tool fire fast secure premium gold",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">
                    <i class="fa-solid fa-bolt"></i> Pro Max
                </span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-fire-flame-curved icon-main"></i>
                    <i class="fa-solid fa-star icon-sub1"></i>
                    <i class="fa-solid fa-rocket icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 14px; font-family: 'Inter', sans-serif; font-weight: 700;">
               Bulk Url To <span class="title-span">Sitemap</span>
            </div>
            <div class="tool-desc" style="margin-top: 10px;">
                <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-crown"></i> Premium</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-check"></i> Verified</span>
                </div>
                <div class="meta-info">
                    <span>No Limits</span> &bull; 
                    <span>High Speed</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 18: Meme Gen ULTIMATE ───────────────────────── */
    {
        link: "tools/img/meme-generator-studio.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#FF0080",
        themeColor2: "#7928CA",
        dataName: "ultra meme generator pro max sticker layer templates deep fry viral",
        html: `
            <div class="badge-container"> 
                <span class="badge card-badge">VIRAL STUDIO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-face-grin-tears icon-main"></i>
                    <i class="fa-solid fa-layer-group icon-sub1"></i>
                    <i class="fa-solid fa-wand-magic-sparkles icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Meme Gen <span class="title-span">ULTIMATE</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-fire"></i> Templates</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-droplet"></i> Deep Fry</span>
                </div>
                <div class="meta-info">
                    <span>Multi-Layer</span> &bull; 
                    <span>Neon Text</span> &bull; 
                    <span>Undo</span>
                </div>
            </div>`
    },

    /* ── Tool 19: JSON ARCHITECT ──────────────────────────── */
    {
        link: "tools/dev/json-formatter-validator.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#d124ff",
        themeColor2: "#60efff",
        dataName: "json formatter validator beautifier xml csv converter viewer editor minifier tree view",
        html: `
            <div class="badge-container"> 
                <span class="badge card-badge">DEV SUITE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-file-code icon-main"></i>
                    <i class="fa-solid fa-circle-check icon-sub1"></i>
                    <i class="fa-solid fa-network-wired icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                JSON <span class="title-span">ARCHITECT</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-wand-magic-sparkles"></i> Beautify</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-compress"></i> Minify</span>
                </div>
                <div class="meta-info">
                    <span>Validator</span> &bull; 
                    <span>Tree View</span> &bull; 
                    <span>XML/CSV</span>
                </div>
            </div>`
    },

    /* ── Tool 20: Word Counter ULTRA ──────────────────────── */
    {
        link: "tools/text/word-counter-analyzer.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#ccff00",
        themeColor2: "#00ff99",
        dataName: "word counter character count seo tool secure analyzer keyword density social media check grammar",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">TEXT GENIUS</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-file-pen icon-main"></i>
                    <i class="fa-solid fa-magnifying-glass-chart icon-sub1"></i>
                    <i class="fa-solid fa-shield-cat icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Word Counter <span class="title-span">ULTRA</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 5px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-chart-pie"></i> Density Check</span>
                    <span class="feature-tag ft-2"><i class="fa-brands fa-twitter"></i> Social</span>
                </div>
                <div class="meta-info">
                    <span>100% Privacy</span> &bull; 
                    <span>SEO Tools</span> &bull; 
                    <span>Grammar</span>
                </div>
            </div>`
    },

    /* ── Tool 21: Gmail ALIAS MAX ─────────────────────────── */
    {
        link: "tools/tool/gmail-alias-generator.html",
        category: "tool",
        classes: "tool-card",
        themeColor1: "#4facfe",
        themeColor2: "#00f2fe",
        dataName: "gmail generator email alias dot trick plus addressing googlemail privacy bulk email maker unlimited accounts",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">GMAIL ELITE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-envelope icon-main"></i>
                    <i class="fa-solid fa-layer-group icon-sub1"></i>
                    <i class="fa-solid fa-shield-cat icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Gmail <span class="title-span">ALIAS MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-ellipsis"></i> Dot Trick</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-plus"></i> Plus Tags</span>
                </div>
                <div class="meta-info">
                    <span>20k+ Gen</span> &bull; 
                    <span>No Login</span> &bull; 
                    <span>.TXT Export</span>
                </div>
            </div>`
    },

    /* ── Tool 22: Robots.txt GEN MAX ──────────────────────── */
    {
        link: "tools/seo/robots-txt-generator.html",
        category: "seo",
        classes: "tool-card",
        themeColor1: "#ff3d00",
        themeColor2: "#00e676",
        dataName: "robots.txt generator seo crawler control googlebot block user-agent allow disallow sitemap builder",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">CRAWL CONTROL</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-robot icon-main"></i>
                    <i class="fa-solid fa-spider icon-sub1"></i>
                    <i class="fa-solid fa-file-shield icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Robots.txt <span class="title-span">GEN MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-ban"></i> Block Bots</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-sitemap"></i> Sitemap</span>
                </div>
                <div class="meta-info">
                    <span>Googlebot</span> &bull; 
                    <span>Crawl Delay</span> &bull; 
                    <span>Security</span>
                </div>
            </div>`
    },

    /* ── Tool 23: Favicon X ULTRA ─────────────────────────── */
    {
        link: "tools/seo/favicon-generator-pro.html",
        category: "seo",
        classes: "tool-card",
        themeColor1: "#6366f1",
        themeColor2: "#d124ff",
        dataName: "favicon generator pro ico maker png converter pwa manifest google seo branding logo builder design",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">SEO RANKER</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-shapes icon-main"></i>
                    <i class="fa-brands fa-google icon-sub1"></i>
                    <i class="fa-brands fa-apple icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Favicon <span class="title-span">X ULTRA</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-eye"></i> Live SEO</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-mobile-screen"></i> PWA Ready</span>
                </div>
                <div class="meta-info">
                    <span>ICO & PNG</span> &bull; 
                    <span>Manifest</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 24: Password ULTRA MAX ──────────────────────── */
    {
        link: "tools/sec/password-generator-pro.html",
        category: "sec",
        classes: "tool-card",
        themeColor1: "#00c6ff",
        themeColor2: "#0072ff",
        dataName: "password generator secure strong random military grade privacy offline titanium",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">CYBER VAULT</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-shield-halved icon-main"></i>
                    <i class="fa-solid fa-key icon-sub1"></i>
                    <i class="fa-solid fa-lock icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Password <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-microchip"></i> High Entropy</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-user-shield"></i> Privacy First</span>
                </div>
                <div class="meta-info">
                    <span>Offline</span> &bull; 
                    <span>Military Grade</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 25: Ultra Age Calculator ───────────────────── */
    {
        link: "tools/calc/age-calculator-pro.html",
        category: "calc",
        classes: "tool-card",
        themeColor1: "#d124ff",
        themeColor2: "#00e5ff",
        dataName: "ultra age ai god mode biological calculator cosmic time death timer zodiac analytics life progress",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">GOD MODE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-hourglass-half icon-main"></i>
                    <i class="fa-solid fa-earth-americas icon-sub1"></i>
                    <i class="fa-solid fa-heart-pulse icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 14px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Ultra Age <span class="title-span">Calculator</span>
            </div>
            <div class="tool-desc" style="margin-top: 10px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-dna"></i> Bio Stats</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-meteor"></i> Cosmic</span>
                </div>
                <div class="meta-info">
                    <span>Death Timer</span> &bull; 
                    <span>Zodiac</span> &bull; 
                    <span>Consumption</span>
                </div>
            </div>`
    },

    /* ── Tool 26: Cookie CONVERTER ────────────────────────── */
    {
        link: "tools/dev/cookie-format-converter.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#d124ff",
        themeColor2: "#00d2ff",
        dataName: "cookie converter netscape json selenium curl wget editthiscookie secure session migration developer tool",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">DEV ELITE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-cookie-bite icon-main"></i>
                    <i class="fa-solid fa-arrow-right-arrow-left icon-sub1"></i>
                    <i class="fa-solid fa-shield-cat icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Cookie <span class="title-span">CONVERTER</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-file-code"></i> Netscape ⇄ JSON</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-lock"></i> Client-Side</span>
                </div>
                <div class="meta-info">
                    <span>Clean Expired</span> &bull; 
                    <span>cURL/Wget</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 27: Markdown ULTIMATE ───────────────────────── */
    {
        link: "tools/dev/markdown-editor-pro.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#d946ef",
        themeColor2: "#00f2ff",
        dataName: "markdown editor pro studio viewer html converter pdf export syntax highlight secure text",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">STUDIO MAX</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-brands fa-markdown icon-main"></i>
                    <i class="fa-solid fa-pen-to-square icon-sub1"></i>
                    <i class="fa-solid fa-file-pdf icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Markdown <span class="title-span">ULTIMATE</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-eye"></i> Live Preview</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-shield-halved"></i> 100% Safe</span>
                </div>
                <div class="meta-info">
                    <span>HTML Export</span> &bull; 
                    <span>PDF Gen</span> &bull; 
                    <span>Autosave</span>
                </div>
            </div>`
    },

    /* ── Tool 28: Ultra Diff PRO MAX ──────────────────────── */
    {
        link: "tools/text/diff-checker-pro.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#00f2ea",
        themeColor2: "#d124ff",
        dataName: "diff checker text compare code json viewer html privacy secure client-side",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">DEV ELITE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-code-compare icon-main"></i>
                    <i class="fa-solid fa-file-code icon-sub1"></i>
                    <i class="fa-solid fa-user-shield icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Ultra Diff <span class="title-span">PRO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-wand-magic-sparkles"></i> Beautify</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-lock"></i> Private</span>
                </div>
                <div class="meta-info">
                    <span>JSON/HTML</span> &bull; 
                    <span>No Upload</span> &bull; 
                    <span>Minify</span>
                </div>
            </div>`
    },

    /* ── Tool 29: TextNova CORE ───────────────────────────── */
    {
        link: "tools/text/advanced-text-editor.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#00f2ea",
        themeColor2: "#d124ff",
        dataName: "text tools pro json formatter sql minifier regex tester hash generator base64 encoder password maker dev studio",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">DEV SUITE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-terminal icon-main"></i>
                    <i class="fa-solid fa-shield-cat icon-sub1"></i>
                    <i class="fa-solid fa-code icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                TextNova <span class="title-span">CORE</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-user-secret"></i> 100% Private</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto Format</span>
                </div>
                <div class="nova-meta">
                    <span>JSON</span> &bull; 
                    <span>SQL</span> &bull; 
                    <span>Regex</span> &bull; 
                    <span>Crypto</span>
                </div>
            </div>`
    },

    /* ── Tool 30: Typing Speed Test ───────────────────────── */
    {
        link: "tools/text/typing-speed-test.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#00e5ff",
        themeColor2: "#d124ff",
        dataName: "typing speed test master hypertype x wpm cpm coding practice programmer keyboard",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">DEV RACER</span>
            </div>
            
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-keyboard icon-main"></i>
                    
                    <i class="fa-solid fa-bolt icon-sub1"></i>
                    
                    <i class="fa-solid fa-code icon-sub2"></i>
                </div>
            </span>

            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Typing Speed<span class="title-span">Test</span>
            </div>

            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-brands fa-js"></i> JS/Python</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-gauge-high"></i> Pro WPM</span>
                </div>
                <div class="meta-info">
                    <span>Accuracy</span> &bull; 
                    <span>Code Mode</span> &bull; 
                    <span>Rank</span>
                </div>
            </div>`
    },

    /* ── Tool 31: UltraTag ULTIMATE ───────────────────────── */
    {
        link: "tools/seo/hashtag-generator-pro.html",
        category: "seo",
        classes: "tool-card",
        themeColor1: "#6366f1",
        themeColor2: "#d946ef",
        dataName: "ultratag hashtag generator ai seo youtube instagram tiktok viral tags keywords optimizer",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">VIRAL AI</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-hashtag icon-main"></i>
                    <i class="fa-solid fa-fire icon-sub1"></i>
                    <i class="fa-solid fa-robot icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                UltraTag <span class="title-span">ULTIMATE</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> Multi-Platform</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Magic</span>
                </div>
                <div class="meta-info">
                    <span>Viral Score</span> &bull; 
                    <span>Safe Mode</span> &bull; 
                    <span>SEO</span>
                </div>
            </div>`
    },

    /* ── Tool 32: Percentage MASTER Calc. ─────────────────── */
    {
        link: "tools/calc/percentage-calculator.html",
        category: "calc",
        classes: "tool-card",
        themeColor1: "#00f260",
        themeColor2: "#0575e6",
        dataName: "percentage calculator master pro max gst vat discount profit margin simple compound interest tax finance secure offline",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">FINANCE GOD</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-percent icon-main"></i>
                    <i class="fa-solid fa-sack-dollar icon-sub1"></i>
                    <i class="fa-solid fa-shield-halved icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 14px; font-family: 'Outfit', sans-serif; font-weight: 800;">
                Percentage <span class="title-span">MASTER Calc.</span>
            </div>
            <div class="tool-desc" style="margin-top: 10px;">
                <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-bottom: 8px;">
                    <span class="feature-tag ft-1">
                        <i class="fa-solid fa-file-invoice-dollar"></i> GST / VAT
                    </span>
                    <span class="feature-tag ft-2">
                        <i class="fa-solid fa-tags"></i> Discount
                    </span>
                </div>
                <div class="math-meta">
                    <span>Secure</span> &bull; 
                    <span>Profit Calc</span> &bull; 
                    <span>Offline</span>
                </div>
            </div>`
    },

    /* ── Tool 33: Speed Test TURBO ────────────────────────── */
    {
        link: "tools/dev/internet-speed-test.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#00f260",
        themeColor2: "#0575e6",
        dataName: "internet speed test bandwidth check wifi ping jitter download upload meter neon gauge",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">NET METER</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-gauge-high icon-main"></i>
                    <i class="fa-solid fa-bolt icon-sub1"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Speed Test <span class="title-span">TURBO</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <span class="feature-tag ft-1">Ping & Jitter</span>
                <div style="font-size:0.75em; color:#a1a1aa; margin-top:5px;">
                    <span style="color:#e4e4e7">WiFi Check</span> &bull; <span style="color:#e4e4e7">Real-time</span>
                </div>
            </div>`
    },

    /* ── Tool 34: Ultra TTS STUDIO ────────────────────────── */
    {
        link: "tools/text/text-to-speech-studio.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#d124ff",
        themeColor2: "#00e5ff",
        dataName: "text to speech tts converter pdf reader ocr voice generator audio mixer mp3 recorder unlimited offline",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">AUDIO GOD MODE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-microphone-lines icon-main"></i>
                    <i class="fa-solid fa-music icon-sub1"></i>
                    <i class="fa-solid fa-file-pdf icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Ultra TTS <span class="title-span">STUDIO</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-sliders"></i> Music Mixer</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-eye"></i> OCR & PDF</span>
                </div>
                <div class="meta-info">
                    <span>Unlimited</span> &bull; 
                    <span>Recorder</span> &bull; 
                    <span>100% Free</span>
                </div>
            </div>`
    },

    /* ── Tool 35: QA Mock Data Studio ─────────────────────── */
    {
        link: "tools/dev/mock-data-generator.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#00e5ff",
        themeColor2: "#d124ff",
        dataName: "mock data generator qa testing tool json creator user profile dummy address luhn validation developer utility",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">DEV STUDIO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-fingerprint icon-main"></i>
                    <i class="fa-solid fa-shield-halved icon-sub1"></i>
                    <i class="fa-solid fa-database icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                QA Mock  <span class="title-span">Data Studio</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-check-double"></i> Valid Format</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-globe"></i> 60+ Nations</span>
                </div>
                <div class="meta-info">
                    <span>JSON</span> &bull; 
                    <span>Luhn Check</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 36: Ultra Focus PRO MAX ─────────────────────── */
    {
        link: "tools/tool/focus-timer-pomodoro.html",
        category: "tool",
        classes: "tool-card",
        themeColor1: "#7000ff",
        themeColor2: "#00f3ff",
        dataName: "ultra focus pro max pomodoro timer binaural beats 40hz productivity task manager breathwork offline privacy",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">NEURAL SYNC</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-brain icon-main"></i>
                    <i class="fa-solid fa-stopwatch icon-sub1"></i>
                    <i class="fa-solid fa-wave-square icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Ultra Focus <span class="title-span">PRO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-headphones"></i> 40Hz Audio</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-list-check"></i> Tasks</span>
                </div>
                <div class="meta-info">
                    <span>Pomodoro</span> &bull; 
                    <span>Breathwork</span> &bull; 
                    <span>Local-DB</span>
                </div>
            </div>`
    },

    /* ── Tool 37: Programming Code Converter ──────────────── */
    {
        link: "tools/dev/code-encoder-decoder.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#00f2ea",
        themeColor2: "#d124ff",
        dataName: "universal code converter translator binary hex base64 decoder jwt hash generator text tools",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">ALL-IN-ONE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-arrow-right-arrow-left icon-main"></i>
                    <i class="fa-solid fa-1 icon-sub1"></i>
                    <i class="fa-solid fa-font icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Programming Code <span class="title-span">Converter</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-language"></i> Translator</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-unlock"></i> Decoder</span>
                </div>
                <div class="meta-info">
                    <span>Text to Binary</span> &bull; 
                    <span>Hex/Base64</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 38: Omni CONVERT ────────────────────────────── */
    {
        link: "tools/calc/unit-converter-pro.html",
        category: "calc",
        classes: "tool-card",
        themeColor1: "#6366f1",
        themeColor2: "#06b6d4",
        dataName: "unit converter currency exchange scientific calculator physics math engineering voice input offline pwa",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">ULTRA CALC</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-arrow-right-arrow-left icon-main"></i>
                    <i class="fa-solid fa-coins icon-sub1"></i>
                    <i class="fa-solid fa-microchip icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Omni <span class="title-span">CONVERT</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-chart-line"></i> Live Rates</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-microphone"></i> Voice AI</span>
                </div>
                <div class="meta-info">
                    <span>Scientific</span> &bull; 
                    <span>Engineering</span> &bull; 
                    <span>Offline</span>
                </div>
            </div>`
    },

    /* ── Tool 39: Number Prefix MASTER ────────────────────── */
    {
        link: "tools/text/number-prefix-formatter.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#25D366",
        themeColor2: "#00e5ff",
        dataName: "whatsapp link generator wa.me number prefix suffix formatter bulk link maker telegram url builder remove duplicates",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">BULK PRO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-brands fa-whatsapp icon-main"></i>
                    <i class="fa-solid fa-link icon-sub1"></i>
                    <i class="fa-solid fa-list-ol icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
              Number  Prefix <span class="title-span">MASTER</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-layer-group"></i> Bulk Edit</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-trash-can"></i> No Dupes</span>
                </div>
                <div class="meta-info">
                    <span>Add +880</span> &bull; 
                    <span>WA Links</span> &bull; 
                    <span>List Gen</span>
                </div>
            </div>`
    },

    /* ── Tool 40: Image To PDF STUDIO MAX ─────────────────── */
    {
        link: "tools/pdf/image-to-pdf-converter.html",
        category: "pdf",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#00e5ff",
        dataName: "image to pdf converter jpg png to pdf merger client side secure no upload hd quality drag drop",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">OFFLINE STUDIO</span>
            </div>
            
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-file-pdf icon-main"></i>
                    
                    <i class="fa-solid fa-images icon-sub1"></i>
                    
                    <span class="icon-sub2-text">JPG</span>
                </div>
            </span>

            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Image To PDF <span class="title-span">STUDIO MAX</span>
            </div>

            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-shield-halved"></i> 100% Secure</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-bolt"></i> Instant</span>
                </div>
                <div class="meta-info">
                    <span>No Upload</span> &bull; 
                    <span>Unlimited</span> &bull; 
                    <span>HD Quality</span>
                </div>
            </div>`
    },

    /* ── Tool 41: PDF Compress TITANIUM ───────────────────── */
    {
        link: "tools/pdf/pdf-compressor-pro.html",
        category: "pdf",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#00f2ea",
        dataName: "pdf compressor reduce size shrink optimize offline secure client side high quality",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">
                    <i class="fa-solid fa-bolt"></i> TITANIUM
                </span>
            </div>

            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-file-pdf icon-main"></i>
                    
                    <i class="fa-solid fa-compress icon-sub1"></i>
                    
                    <i class="fa-solid fa-feather-pointed icon-sub2"></i>
                </div>
            </span>

            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                PDF Compress <span class="title-span">TITANIUM</span>
            </div>

            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1">
                        <i class="fa-solid fa-down-long"></i> 90% Reduce
                    </span>
                    <span class="feature-tag ft-2">
                        <i class="fa-solid fa-wifi"></i> Offline
                    </span>
                </div>
                <div class="meta-info">
                    <span>No Server</span> &bull; 
                    <span>Unlimited</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 42: Ultra PDF MERGER ────────────────────────── */
    {
        link: "tools/pdf/pdf-merger-editor.html",
        category: "pdf",
        classes: "tool-card",
        themeColor1: "#ff0055",
        themeColor2: "#d124ff",
        dataName: "pdf merger editor organize rearrange pages client side privacy secure offline god mode combine images",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">GOD MODE</span>
            </div>

            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-file-pdf icon-main"></i>
                    
                    <i class="fa-solid fa-object-group icon-sub1"></i>
                    
                    <i class="fa-solid fa-hand-pointer icon-sub2"></i>
                </div>
            </span>

            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Ultra PDF <span class="title-span">MERGER</span>
            </div>

            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1">
                        <i class="fa-solid fa-layer-group"></i> Drag & Drop
                    </span>
                    <span class="feature-tag ft-2">
                        <i class="fa-solid fa-shield-halved"></i> 100% Private
                    </span>
                </div>
                <div class="meta-info">
                    <span>Mix Images</span> &bull; 
                    <span>Visual Sort</span> &bull; 
                    <span>Offline</span>
                </div>
            </div>`
    },

    /* ── Tool 43: GST/VAT MASTER ──────────────────────────── */
    {
        link: "tools/calc/gst-vat-calculator.html", 
        category: "calc",
        classes: "tool-card",
        themeColor1: "#0abde3",
        themeColor2: "#2ecc71",
        dataName: "gst vat calculator sales tax invoice generator inclusive exclusive tax commercial finance pdf export",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">COMMERCIAL</span>
            </div>

            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-file-invoice-dollar icon-main"></i>
                    
                    <i class="fa-solid fa-earth-americas icon-sub1"></i>
                    
                    <i class="fa-solid fa-percent icon-sub2"></i>
                </div>
            </span>

            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                GST/VAT <span class="title-span">MASTER</span>
            </div>

            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1">
                        <i class="fa-solid fa-file-pdf"></i> PDF Invoice
                    </span>
                    <span class="feature-tag ft-2">
                        <i class="fa-solid fa-globe"></i> 15+ Regions
                    </span>
                </div>
                <div class="meta-info">
                    <span>Inc/Exc Tax</span> &bull; 
                    <span>Offline</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 44: Code Snap STUDIO MAX ────────────────────── */
    {
        link: "tools/dev/code-snapshot-studio.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#a855f7",
        themeColor2: "#ec4899",
        dataName: "code snippet to image converter screenshot carbon maker beautiful code syntax highlight export png client side offline",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">DEV BEAUTY</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-code icon-main"></i>
                    <i class="fa-solid fa-camera icon-sub1"></i>
                    <i class="fa-solid fa-image icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Code Snap <span class="title-span">STUDIO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-palette"></i> Mac Themes</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-download"></i> HD Export</span>
                </div>
                <div class="meta-info">
                    <span>100% Offline</span> &bull; 
                    <span>Syntax Highlight</span> &bull; 
                    <span>Watermark Free</span>
                </div>
            </div>`
    },

    /* ── Tool 45: EXIF Stripper PRO MAX ───────────────────── */
    {
        link: "tools/img/exif-metadata-remover.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#0ea5e9",
        themeColor2: "#10b981",
        dataName: "exif data metadata viewer remover image privacy gps cleaner photo location eraser secure offline batch delete",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">PRIVACY GUARD</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-camera icon-main"></i>
                    <i class="fa-solid fa-eraser icon-sub1"></i>
                    <i class="fa-solid fa-user-secret icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                EXIF Stripper <span class="title-span">PRO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-location-dot"></i> GPS Erase</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-ghost"></i> Ghost Mode</span>
                </div>
                <div class="meta-info">
                    <span>Batch Clean</span> &bull; 
                    <span>No Upload</span> &bull; 
                    <span>100% Offline</span>
                </div>
            </div>`
    },

    /* ── Tool 46: AI BG Remover ULTRA MAX ─────────────────── */
    {
        link: "tools/img/ai-background-remover.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#8b5cf6",
        themeColor2: "#f43f5e",
        dataName: "ai background remover magic eraser transparent png offline client side machine learning webgl privacy hd",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">AI VISION</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-wand-magic-sparkles icon-main"></i>
                    <i class="fa-solid fa-image icon-sub1"></i>
                    <i class="fa-solid fa-user-shield icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                AI BG Remover <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-brain"></i> Neural Engine</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline AI</span>
                </div>
                <div class="meta-info">
                    <span>100% Private</span> &bull; 
                    <span>No API</span> &bull; 
                    <span>HD Export</span>
                </div>
            </div>`
    },

    /* ── Tool 47: Data Extractor ULTRA MAX ────────────────── */
    {
        link: "tools/text/bulk-data-extractor.html",
        category: "text",
        classes: "tool-card",
        themeColor1: "#f97316",
        themeColor2: "#eab308",
        dataName: "bulk data extractor email scraper phone number finder regex miner url grabber ip address clean offline secure csv export",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">DATA MINER</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-filter icon-main"></i>
                    <i class="fa-solid fa-magnifying-glass-chart icon-sub1"></i>
                    <i class="fa-solid fa-database icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Data Extractor <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-robot"></i> Smart Regex</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-file-csv"></i> CSV Export</span>
                </div>
                <div class="meta-info">
                    <span>Email & Phone</span> &bull; 
                    <span>100% Offline</span> &bull; 
                    <span>Secure</span>
                </div>
            </div>`
    },

    /* ── Tool 48: Video Studio ULTRA MAX ──────────────────── */
    {
        link: "tools/media/video-studio-pro.html",
        category: "media",
        classes: "tool-card",
        themeColor1: "#06b6d4",
        themeColor2: "#6366f1",
        dataName: "video compressor gif maker mp4 webm converter offline webassembly ffmpeg zero server cost privacy secure",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">WASM ENGINE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-film icon-main"></i>
                    <i class="fa-solid fa-microchip icon-sub1"></i>
                    <i class="fa-solid fa-shield-halved icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Video Studio <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-server"></i> 0 Server Cost</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline WebAssembly</span>
                </div>
                <div class="meta-info">
                    <span>Compressor</span> &bull; 
                    <span>GIF Maker</span> &bull; 
                    <span>Private</span>
                </div>
            </div>`
    },
    
    /* ── Tool 49: SQL Studio ULTRA MAX ────────────────────── */
    {
        link: "tools/dev/sql-studio-pro.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#f59e0b", // Premium Amber
        themeColor2: "#ec4899", // Neon Pink
        dataName: "sql studio offline database csv to sql query analyzer webassembly sqlite client side privacy data visualizer export json",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">WASM ENGINE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-database icon-main"></i>
                    <i class="fa-solid fa-terminal icon-sub1"></i>
                    <i class="fa-solid fa-user-shield icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                SQL Studio <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-table"></i> CSV to SQL</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline Run</span>
                </div>
                <div class="meta-info">
                    <span>WebAssembly</span> &bull; 
                    <span>100% Private</span> &bull; 
                    <span>Live Query</span>
                </div>
            </div>`
    },
    
    /* ── Tool 50: PWA Studio PRO MAX ──────────────────────── */
    {
        link: "tools/dev/pwa-builder-studio.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#10b981", // Emerald Green
        themeColor2: "#3b82f6", // Royal Blue
        dataName: "pwa studio pro max progressive web app builder manifest generator service worker icon resizer offline client side web to app",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">APP BUILDER</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-mobile-screen-button icon-main"></i>
                    <i class="fa-brands fa-html5 icon-sub1"></i>
                    <i class="fa-solid fa-bolt icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                PWA Studio <span class="title-span">PRO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-file-code"></i> Manifest Gen</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline SW</span>
                </div>
                <div class="meta-info">
                    <span>Icon Resizer</span> &bull; 
                    <span>100% Private</span> &bull; 
                    <span>ZIP Export</span>
                </div>
            </div>`
    },
    
    /* ── Tool 51: Stegano Vault ULTRA MAX ─────────────────── */
    {
        link: "tools/sec/steganography-vault.html",
        category: "sec",
        classes: "tool-card",
        themeColor1: "#00ff87", // Cyber Neon Green
        themeColor2: "#60efff", // Electric Cyan
        dataName: "steganography image secret message hide text encrypt decrypt password offline security canvas privacy ghost vault",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">GHOST VAULT</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-user-secret icon-main"></i>
                    <i class="fa-solid fa-image icon-sub1"></i>
                    <i class="fa-solid fa-key icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Stegano Vault <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-eye-slash"></i> Invisible Data</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-shield-halved"></i> AES-256 Lock</span>
                </div>
                <div class="meta-info">
                    <span>Canvas API</span> &bull; 
                    <span>100% Offline</span> &bull; 
                    <span>Pixel Perfect</span>
                </div>
            </div>`
    },
    
    /* ── Tool 52: JS Code Armor ───────────────────────────── */
    {
        link: "tools/sec/js-code-obfuscator.html",
        category: "sec",
        classes: "tool-card",
        themeColor1: "#00ff88", // Hacker Neon Green
        themeColor2: "#a855f7", // Cyber Purple
        dataName: "javascript obfuscator js code protector client-side js encryptor hide js in image js time bomb steganography domain lock anti debugging secure offline",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">GOD MODE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-user-secret icon-main"></i>
                    <i class="fa-solid fa-file-code icon-sub1"></i>
                    <i class="fa-solid fa-bomb icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                JS Code <span class="title-span">Armor</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-bomb"></i> Time-Bomb</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-eye-slash"></i> Stego Hide</span>
                </div>
                <div class="meta-info">
                    <span>Domain Lock</span> &bull; 
                    <span>Anti-Debug</span> &bull; 
                    <span>100% Offline</span>
                </div>
            </div>`
    },
    
    /* ── Tool 53: Web Sandbox STUDIO MAX ──────────────────── */
    {
        link: "tools/dev/web-sandbox-studio.html",
        category: "dev",
        classes: "tool-card",
        themeColor1: "#f12711", // Vibrant Orange
        themeColor2: "#f5af19", // Bright Yellow
        dataName: "live code editor sandbox html css javascript compiler frontend studio offline web ide live preview client side",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">FRONTEND PRO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-laptop-code icon-main"></i>
                    <i class="fa-brands fa-html5 icon-sub1"></i>
                    <i class="fa-brands fa-js icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Web Sandbox <span class="title-span">STUDIO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-bolt"></i> Live Preview</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> 100% Offline</span>
                </div>
                <div class="meta-info">
                    <span>HTML/CSS/JS</span> &bull; 
                    <span>ZIP Export</span> &bull; 
                    <span>Private</span>
                </div>
            </div>`
    },
    
    /* ── Tool 54: DocuSign OCR STUDIO ─────────────────────── */
    {
        link: "tools/pdf/pdf-ocr-signer-pro.html",
        category: "pdf",
        classes: "tool-card",
        themeColor1: "#10b981", // Emerald Green
        themeColor2: "#2563eb", // Royal Blue
        dataName: "pdf signer signature maker ocr text extractor image to text secure offline document editor scanner tesseract wasm",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">ENTERPRISE PRO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-file-signature icon-main"></i>
                    <i class="fa-solid fa-expand icon-sub1"></i>
                    <i class="fa-solid fa-shield-halved icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                DocuSign OCR <span class="title-span">STUDIO</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-fingerprint"></i> E-Sign</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline OCR</span>
                </div>
                <div class="meta-info">
                    <span>Text Extract</span> &bull; 
                    <span>100% Private</span> &bull; 
                    <span>PDF Export</span>
                </div>
            </div>`
    },
    
    
    /* ── Tool 55: P2P Share Vault ULTRA ───────────────────── */
    {
        link: "tools/sec/p2p-secure-file-share.html",
        category: "sec",
        classes: "tool-card",
        themeColor1: "#00ff87", // Cyber Neon Green
        themeColor2: "#0072ff", // Deep Tech Blue
        dataName: "p2p file transfer webrtc secure share end to end encryption no server local network send anywhere privacy vault",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">ZERO SERVER</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-network-wired icon-main"></i>
                    <i class="fa-solid fa-satellite-dish icon-sub1"></i>
                    <i class="fa-solid fa-shield-halved icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                P2P Share <span class="title-span">Vault ULTRA</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-lock"></i> E2E Encrypted</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-bolt"></i> Direct Transfer</span>
                </div>
                <div class="meta-info">
                    <span>WebRTC</span> &bull; 
                    <span>100% Private</span> &bull; 
                    <span>No Limit</span>
                </div>
            </div>`
    },
    
    
    /* ── Tool 56: 3D Mockup STUDIO MAX ────────────────────── */
    {
        link: "tools/img/3d-device-mockup-studio.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#ec4899", // Neon Rose
        themeColor2: "#8b5cf6", // Deep Purple
        dataName: "3d device mockup generator iphone macbook frame aesthetic background glassmorphism portfolio export client side offline secure",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">WEBGL STUDIO</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-cube icon-main"></i>
                    <i class="fa-solid fa-mobile-screen icon-sub1"></i>
                    <i class="fa-solid fa-laptop icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                3D Mockup <span class="title-span">STUDIO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-layer-group"></i> Smart Frames</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> 100% Offline</span>
                </div>
                <div class="meta-info">
                    <span>Glassmorphism</span> &bull; 
                    <span>4K Export</span> &bull; 
                    <span>No Upload</span>
                </div>
            </div>`
    },
    
    
    /* ── Tool 57: Smart DocuScan ULTRA MAX ────────────────── */
    {
        link: "tools/img/document-scanner-pro.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#ff00cc", // Cyber Pink
        themeColor2: "#3b82f6", // Neon Blue
        dataName: "document scanner camscanner pdf creator edge detection opencv wasm perspective crop offline privacy secure image text",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">WASM VISION</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-camera-retro icon-main"></i>
                    <i class="fa-solid fa-crop-simple icon-sub1"></i>
                    <i class="fa-solid fa-file-pdf icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Smart DocuScan <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto Crop AI</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline Scan</span>
                </div>
                <div class="meta-info">
                    <span>OpenCV Edge</span> &bull; 
                    <span>100% Private</span> &bull; 
                    <span>PDF Export</span>
                </div>
            </div>`
    },
    
    
    /* ── Tool 58: AI Privacy Censor ULTRA ─────────────────── */
    {
        link: "tools/img/ai-face-blur-censor.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#ff0055", // Cyber Red for Alert/Privacy
        themeColor2: "#00ff87", // Matrix Green for Secure AI
        dataName: "ai face blur pixelate anonymizer privacy censor offline webgl face-api client side auto detect secure image",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">AI SHIELD</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-user-shield icon-main"></i>
                    <i class="fa-solid fa-eye-slash icon-sub1"></i>
                    <i class="fa-solid fa-robot icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                AI Privacy Censor <span class="title-span">ULTRA</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-brain"></i> Auto Detect</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> 100% Offline</span>
                </div>
                <div class="meta-info">
                    <span>Face Blur</span> &bull; 
                    <span>Pixelate</span> &bull; 
                    <span>Zero Upload</span>
                </div>
            </div>`
    },
    
    
    /* ── Tool 59: SVG Vectorizer ULTRA MAX ────────────────── */
    {
        link: "tools/img/svg-vectorizer-pro.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#ff007f", // Neon Magenta
        themeColor2: "#00f2fe", // Cyber Blue
        dataName: "svg vectorizer optimizer converter png to svg raster to vector potrace svgo webassembly offline privacy minifier",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">WASM VECTOR</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-bezier-curve icon-main"></i>
                    <i class="fa-solid fa-image icon-sub1"></i>
                    <i class="fa-solid fa-compress icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                SVG Vectorizer <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto Trace</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline</span>
                </div>
                <div class="meta-info">
                    <span>PNG to SVG</span> &bull; 
                    <span>SVGO Minify</span> &bull; 
                    <span>Zero Upload</span>
                </div>
            </div>`
    },
    
    
    
    /* ── Tool 60: AI Upscaler PRO MAX ─────────────────────── */
    {
        link: "tools/img/ai-image-upscaler.html",
        category: "img",
        classes: "tool-card",
        themeColor1: "#ffaa00", // Cyber Gold
        themeColor2: "#ff00cc", // Neon Magenta
        dataName: "ai image upscaler super resolution enhancer 4k hd waifu2x webgl wasm offline client side privacy upscale photo",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">NEURAL ENGINE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-wand-magic-sparkles icon-main"></i>
                    <i class="fa-solid fa-expand icon-sub1"></i>
                    <i class="fa-solid fa-microchip icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                AI Upscaler <span class="title-span">PRO MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-brain"></i> AI Enhance</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> Offline WebGL</span>
                </div>
                <div class="meta-info">
                    <span>4K Export</span> &bull; 
                    <span>100% Private</span> &bull; 
                    <span>Zero Upload</span>
                </div>
            </div>`
    },
    
    
    
    /* ── Tool 61: Data Vault ULTRA MAX ────────────────────── */
    {
        link: "tools/sec/file-encryptor-aes256.html",
        category: "sec",
        classes: "tool-card",
        themeColor1: "#ff0040", // Alert Red / Cyber Security color
        themeColor2: "#00e5ff", // Neon Cyan
        dataName: "file encryptor decryptor aes-256 zero knowledge privacy offline secure vault web crypto api password protect document file locker",
        html: `
            <div class="badge-container">
                <span class="badge card-badge">ZERO KNOWLEDGE</span>
            </div>
            <span class="icon">
                <div style="position: relative; display: inline-block;">
                    <i class="fa-solid fa-vault icon-main"></i>
                    <i class="fa-solid fa-file-shield icon-sub1"></i>
                    <i class="fa-solid fa-key icon-sub2"></i>
                </div>
            </span>
            <div class="tool-title" style="margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 700;">
                Data Vault <span class="title-span">ULTRA MAX</span>
            </div>
            <div class="tool-desc" style="margin-top: 8px;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center; margin-bottom: 6px;">
                    <span class="feature-tag ft-1"><i class="fa-solid fa-lock"></i> AES-256 GCM</span>
                    <span class="feature-tag ft-2"><i class="fa-solid fa-wifi-slash"></i> 100% Offline</span>
                </div>
                <div class="meta-info">
                    <span>File Encrypt</span> &bull; 
                    <span>No Upload</span> &bull; 
                    <span>Military Grade</span>
                </div>
            </div>`
    }


];

export default toolsData;
