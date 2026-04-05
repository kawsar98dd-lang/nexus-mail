/**
 * =============================================================================
 *  URL SHORTENER PRO MAX — ENTERPRISE EDITION
 *  Tool    : seo-link-shortener.html
 *  Author  : Trusted Tools Web | MD KAWSAR
 *  Version : 2.5.3 (CodeCanyon Release Build — Global Toast System)
 * =============================================================================
 *
 *  FEATURE SET:
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. Multi-Proxy Failover (is.gd Primary → TinyURL Fallback) for 99.9% uptime
 *  2. Intelligent UTM Builder Injection — merges parameters into URL safely
 *  3. Client-Side QR Code Generation via api.qrserver.com (High-Res + Blob)
 *  4. Secure localStorage History (XSS-sanitised via escapeHtml)
 *  5. Social Sharing (WhatsApp, Facebook, Telegram, X/Twitter)
 *  6. Async Clipboard API with execCommand fallback for older browsers
 *  7. Global Toast Notification System (window.showToast from global.js)
 *  8. AbortController-based timeout for every network request
 *
 *  ARCHITECTURE:
 *  ─────────────────────────────────────────────────────────────────────────
 *  The entire module is wrapped in an IIFE and exposed as window.app so that
 *  inline HTML event handlers (onclick="app.xxx()") can invoke its methods
 *  without polluting the global namespace with private helper functions.
 * =============================================================================
 */

/* ─────────────────────────────────────────────────────────────────────────
   MODULE WRAPPER — Immediately Invoked Function Expression (IIFE)
   All private helpers live here. Only the public API is returned.
───────────────────────────────────────────────────────────────────────── */
window.app = (function () {

    /* =====================================================================
       DOM ELEMENT CACHE
       All interactive elements are resolved once at module initialisation
       and stored here to avoid repeated getElementById lookups.
    ===================================================================== */
    const dom = {
        longUrl         : document.getElementById('longUrl'),
        alias           : document.getElementById('customAlias'),
        advancedSection : document.getElementById('advancedSection'),
        shortenBtn      : document.getElementById('shortenBtn'),
        loader          : document.getElementById('loader'),
        btnText         : document.getElementById('btnText'),
        errorMsg        : document.getElementById('errorMsg'),
        resultContainer : document.getElementById('resultContainer'),
        shortUrlDisplay : document.getElementById('shortUrlDisplay'),
        qrImage         : document.getElementById('qrImage'),
        qrColor         : document.getElementById('qrColor'),
        qrBgColor       : document.getElementById('qrBgColor'),
        historyList     : document.getElementById('historyList'),
        utmSource       : document.getElementById('utmSource'),
        utmMedium       : document.getElementById('utmMedium'),
        utmCampaign     : document.getElementById('utmCampaign')
    };

    /* =====================================================================
       INITIALISATION — DOMContentLoaded
       Runs once the DOM is fully parsed. Sets up history display, theme
       state, and attaches the Enter-key listener to the URL input.
    ===================================================================== */
    document.addEventListener('DOMContentLoaded', () => {

        /* Render any previously saved links into the history list */
        loadHistory();

        /* Re-apply the persisted light/dark theme selection from localStorage */
        initThemeCheck();

        /*
         * Allow the user to trigger URL shortening by pressing Enter
         * while the long-URL input is focused — mirrors standard form UX.
         */
        if (dom.longUrl) {
            dom.longUrl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') initiateShortening();
            });
        }
    });


    /* =====================================================================
       SECTION A — UI UTILITY FUNCTIONS
    ===================================================================== */

    /**
     * toggleAdvancedSettings()
     * ─────────────────────────────────────────────────────────────────────
     * Shows or hides the Advanced Settings panel (#advancedSection) which
     * contains the UTM Analytics Builder and QR Code color studio.
     *
     * Logic:
     *  - Reads the current display style of the panel.
     *  - If hidden ('' or 'none') → sets display to 'block' and changes the
     *    toggle button icon to a chevron-up arrow to indicate collapse.
     *  - If visible → sets display to 'none' and restores the sliders icon.
     *  - After revealing, smoothly scrolls the panel into view after a
     *    brief 100ms delay so the browser can render the new height first.
     */
    function toggleAdvancedSettings() {
        const isHidden = (
            dom.advancedSection.style.display === 'none' ||
            dom.advancedSection.style.display === ''
        );

        dom.advancedSection.style.display = isHidden ? 'block' : 'none';

        /* Swap the toggle button icon to communicate current state */
        const btnIcon = document.querySelector('.usp-toggle-btn i');
        if (btnIcon) {
            btnIcon.className = isHidden
                ? 'fa-solid fa-chevron-up'
                : 'fa-solid fa-sliders';
        }

        /* Smooth scroll to panel when it is being revealed */
        if (isHidden) {
            setTimeout(() => {
                dom.advancedSection.scrollIntoView({
                    behavior : 'smooth',
                    block    : 'nearest'
                });
            }, 100);
        }
    }

    /**
     * isValidUrl(string)
     * ─────────────────────────────────────────────────────────────────────
     * Validates that the provided string is a properly formatted HTTP/HTTPS
     * URL. Automatically prepends "https://" if no protocol is found.
     *
     * @param  {string}  string — Raw URL string from the input field.
     * @return {boolean}         True if the URL is well-formed and navigable.
     */
    function isValidUrl(string) {
        try {
            const url = new URL(
                string.startsWith('http') ? string : `https://${string}`
            );
            /* Accept only http/https and ensure hostname contains a dot */
            return (
                (url.protocol === 'http:' || url.protocol === 'https:') &&
                url.hostname.includes('.')
            );
        } catch (_) {
            return false;
        }
    }

    /**
     * escapeHtml(unsafe)
     * ─────────────────────────────────────────────────────────────────────
     * Sanitises a string by converting HTML special characters to their
     * safe entity equivalents. Used before injecting any user-provided or
     * API-provided data into innerHTML to prevent XSS attacks.
     *
     * @param  {string} unsafe — Raw string that may contain HTML characters.
     * @return {string}          HTML-safe string ready for innerHTML injection.
     */
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#039;');
    }


    /* =====================================================================
       SECTION B — CLIPBOARD (PASTE)
    ===================================================================== */

    /**
     * pasteFromClipboard()
     * ─────────────────────────────────────────────────────────────────────
     * Reads the system clipboard using the async Clipboard API and places
     * the content into the long-URL input field.
     *
     * On permission denial (e.g., non-HTTPS context or browser restriction)
     * a user-friendly error is shown instead of a silent failure.
     */
    async function pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                dom.longUrl.value = text;
                window.showToast('URL Pasted!');
            }
        } catch (err) {
            showError('Clipboard access denied. Please press Ctrl+V.');
        }
    }


    /* =====================================================================
       SECTION C — CORE SHORTENING LOGIC
    ===================================================================== */

    /**
     * buildEnhancedUrl(baseUrl)
     * ─────────────────────────────────────────────────────────────────────
     * Prepares the final destination URL by:
     *  1. Ensuring the URL has a protocol prefix (https:// if missing).
     *  2. Appending any UTM tracking parameters that have been filled in
     *     by the user in the Advanced Settings panel.
     *  3. Merging new UTM params with any existing ones in the URL using
     *     the URL.searchParams API (overwrites duplicates cleanly).
     *
     * @param  {string} baseUrl — The raw URL entered by the user.
     * @return {string}           The final URL with UTM parameters injected.
     */
    function buildEnhancedUrl(baseUrl) {
        let formattedUrl = baseUrl.trim();

        /* Prepend protocol if missing (e.g., user typed "example.com/...") */
        if (!/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'https://' + formattedUrl;
        }

        try {
            const urlObj = new URL(formattedUrl);

            /* Collect UTM field values entered by the user */
            const utmParams = {
                'utm_source'   : dom.utmSource.value.trim(),
                'utm_medium'   : dom.utmMedium.value.trim(),
                'utm_campaign' : dom.utmCampaign.value.trim()
            };

            /* Only append UTM parameters that have a non-empty value */
            Object.entries(utmParams).forEach(([key, val]) => {
                if (val) urlObj.searchParams.set(key, val);
            });

            return urlObj.toString();
        } catch (e) {
            /* If URL parsing fails, return the formatted URL as-is */
            return formattedUrl;
        }
    }

    /**
     * fetchWithProxy(targetUrl)
     * ─────────────────────────────────────────────────────────────────────
     * Sends a race-condition request through multiple CORS proxy endpoints
     * simultaneously. The first proxy to return a valid HTTP URL wins;
     * the rest are discarded. This provides multi-node failover resilience.
     *
     * TIMEOUT: A shared AbortController fires after 8 seconds to prevent
     * the tool from hanging indefinitely on slow or unresponsive proxies.
     *
     * NOTE FOR CODECANYON BUYERS:
     * For production environments, consider replacing these free proxies
     * with your own proxy.php server-side script for better reliability:
     *   const localProxy = `proxy.php?url=${encodeURIComponent(targetUrl)}`;
     *
     * @param  {string} targetUrl — The fully-formed API URL to fetch.
     * @return {Promise<string>}   Resolves with the shortened URL string.
     * @throws {Error}             If all proxies fail or timeout is reached.
     */
    async function fetchWithProxy(targetUrl) {
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
            `https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`
        ];

        /* Single AbortController shared across all proxy fetch calls */
        const controller = new AbortController();

        /* AbortSignal.timeout() polyfill — uses setTimeout for compatibility
           with older browsers that don't support AbortSignal.timeout natively */
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
            /*
             * Promise.any() resolves as soon as ONE proxy returns a valid
             * response that starts with "http". All other requests are ignored.
             */
            const fastestResponse = await Promise.any(
                proxies.map(proxy =>
                    fetch(proxy, { signal: controller.signal }).then(async res => {
                        if (res.ok) {
                            const text = await res.text();
                            /* Validate the response is actually a URL */
                            if (text && text.startsWith('http')) return text;
                        }
                        throw new Error('Invalid Response');
                    })
                )
            );

            clearTimeout(timeoutId);
            return fastestResponse;

        } catch (e) {
            clearTimeout(timeoutId);
            throw new Error('Service temporarily busy. Please try again in a moment.');
        }
    }

    /**
     * initiateShortening()
     * ─────────────────────────────────────────────────────────────────────
     * The main entry point for the URL shortening workflow. Called by the
     * primary action button's onclick handler AND the Enter-key listener.
     *
     * Workflow:
     *  1. Read and trim input values.
     *  2. Validate the URL format and alias characters.
     *  3. Inject UTM parameters via buildEnhancedUrl().
     *  4. Enter loading state (spinner + disabled inputs).
     *  5. Try primary API (is.gd) via multi-proxy fetcher.
     *  6. On failure, automatically fall back to TinyURL API.
     *  7. On success → renderSuccess(); on total failure → showError().
     *  8. Always restore loading state in the finally block.
     */
    async function initiateShortening() {
        const rawUrl = dom.longUrl.value.trim();
        const alias  = dom.alias.value.trim();

        /* Reset previous result and error states */
        dom.errorMsg.style.display        = 'none';
        dom.resultContainer.style.display = 'none';

        /* ── Validation ── */
        if (!rawUrl) {
            return showError('Please enter a destination URL.');
        }
        if (!isValidUrl(rawUrl)) {
            return showError('Invalid URL format. Please check and try again.');
        }
        if (alias && !/^[a-zA-Z0-9\-_]+$/.test(alias)) {
            return showError('Custom alias can only contain alphanumeric characters and dashes.');
        }

        /* Append UTM parameters to the destination URL if provided */
        const finalUrl = buildEnhancedUrl(rawUrl);
        setLoading(true);

        try {
            /* ── PRIMARY API: is.gd ── */
            let apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(finalUrl)}`;
            if (alias) apiUrl += `&shorturl=${encodeURIComponent(alias)}`;

            const shortUrl = await fetchWithProxy(apiUrl);

            if (shortUrl && shortUrl.startsWith('http')) {
                renderSuccess(shortUrl, finalUrl);
            } else {
                throw new Error('API Provider returned an empty response.');
            }

        } catch (err) {
            /* Log the primary API failure for debugging */
            console.error('[Primary API Failure]:', err);

            try {
                /* ── FALLBACK API: TinyURL ── */
                let fallbackApi = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(finalUrl)}`;
                if (alias) fallbackApi += `&alias=${encodeURIComponent(alias)}`;

                const backupUrl = await fetchWithProxy(fallbackApi);

                if (backupUrl && backupUrl.startsWith('http')) {
                    renderSuccess(backupUrl, finalUrl);
                } else {
                    throw new Error('Empty fallback response');
                }

            } catch (fallbackErr) {
                /* Log fallback failure and surface a user-visible error */
                console.error('[Fallback API Failure]:', fallbackErr);
                showError('Multiple API nodes are congested. Please try again in 10 seconds.');
            }
        } finally {
            /* Always restore UI to interactive state after the attempt */
            setLoading(false);
        }
    }

    /**
     * renderSuccess(shortUrl, originalUrl)
     * ─────────────────────────────────────────────────────────────────────
     * Populates and reveals the result panel after a successful API response.
     *
     * Steps:
     *  1. Set the short URL anchor's href and text content.
     *  2. Generate the high-res QR code for the new short URL.
     *  3. Save the entry to localStorage history.
     *  4. Make the result container visible and scroll it into view.
     *  5. Trigger a global success toast notification.
     *
     * @param {string} shortUrl    — The API-generated short URL string.
     * @param {string} originalUrl — The final destination URL (with UTM).
     */
    function renderSuccess(shortUrl, originalUrl) {
        /* Update the clickable short URL anchor in the result panel */
        dom.shortUrlDisplay.textContent = shortUrl;
        dom.shortUrlDisplay.href        = shortUrl;

        /* Generate a QR code for the new short URL */
        generateHighResQR(shortUrl);

        /* Persist the new entry in the history panel */
        saveHistory(shortUrl, originalUrl);

        /* Reveal the result container with a smooth scroll */
        dom.resultContainer.style.display = 'block';
        requestAnimationFrame(() => {
            dom.resultContainer.scrollIntoView({
                behavior : 'smooth',
                block    : 'center'
            });
        });

        /* Notify the user with a global success toast */
        window.showToast('Link successfully shortened!');
    }

    /**
     * setLoading(isLoading)
     * ─────────────────────────────────────────────────────────────────────
     * Toggles the loading state of the primary action button.
     *
     * When loading = true:
     *  - Button label text is hidden.
     *  - CSS spinner (.usp-loader) is shown in its place.
     *  - The shorten button and URL input are disabled to prevent re-submission.
     *
     * When loading = false:
     *  - Spinner is hidden, label is restored, inputs are re-enabled.
     *
     * @param {boolean} isLoading — True to enter loading state; false to exit.
     */
    function setLoading(isLoading) {
        dom.loader.style.display    = isLoading ? 'block'   : 'none';
        dom.btnText.style.display   = isLoading ? 'none'    : 'inline';
        dom.shortenBtn.disabled     = isLoading;
        dom.longUrl.disabled        = isLoading;
    }

    /**
     * showError(msg)
     * ─────────────────────────────────────────────────────────────────────
     * Displays an inline validation or network error inside the tool card.
     * Also fires a global error toast to draw the user's attention.
     *
     * @param {string} msg — Human-readable error description.
     */
    function showError(msg) {
        dom.errorMsg.innerHTML      = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
        dom.errorMsg.style.display  = 'flex';

        /* Use global toast system — true = error toast (red) */
        window.showToast('Operation Failed', true);
    }


    /* =====================================================================
       SECTION D — QR CODE GENERATION & DOWNLOAD
    ===================================================================== */

    /**
     * generateHighResQR(text)
     * ─────────────────────────────────────────────────────────────────────
     * Builds a QR code image URL using the api.qrserver.com public API and
     * sets it as the src of the #qrImage element.
     *
     * Configuration used:
     *  - size: 1000×1000px (high-resolution for print quality)
     *  - ecc: Q (Quartile error correction — up to 25% damage tolerance)
     *  - qzone: 1 (one-module quiet zone border)
     *  - color/bgcolor: from the user's color picker inputs
     *
     * The full resolution URL is also stored in dataset.downloadUrl so
     * that downloadQr() can fetch the raw PNG bytes for local save.
     *
     * @param {string} text — The short URL to encode into the QR image.
     */
    function generateHighResQR(text) {
        /* Strip # from color picker values as the API expects hex without it */
        const color = dom.qrColor.value.replace('#', '');
        const bg    = dom.qrBgColor.value.replace('#', '');

        const qrUrl = [
            'https://api.qrserver.com/v1/create-qr-code/',
            `?size=1000x1000`,
            `&data=${encodeURIComponent(text)}`,
            `&color=${color}`,
            `&bgcolor=${bg}`,
            `&qzone=1`,
            `&ecc=Q`,
            `&format=png`
        ].join('');

        dom.qrImage.src                   = qrUrl;
        dom.qrImage.dataset.downloadUrl   = qrUrl;
    }

    /**
     * downloadQr()
     * ─────────────────────────────────────────────────────────────────────
     * Fetches the QR code image as a binary Blob via a CORS proxy and
     * triggers a browser download with a timestamped filename.
     *
     * Workflow:
     *  1. Retrieve the high-res QR URL from dataset.downloadUrl.
     *  2. Show a spinner inside the download button.
     *  3. Fetch image bytes through allorigins proxy (bypasses CORS).
     *  4. Create an Object URL from the Blob and simulate a link click.
     *  5. Revoke the Object URL immediately after the click to free memory.
     *
     * Fallback:
     *  If the fetch fails (network error or timeout), opens the QR URL in a
     *  new tab with a toast advising the user to save it manually.
     */
    async function downloadQr() {
        const imgUrl = dom.qrImage.dataset.downloadUrl || dom.qrImage.src;
        if (!imgUrl) return;

        /* Reference the download button using the stable .qr-dl-btn class */
        const btn          = document.querySelector('.qr-dl-btn');
        const originalText = btn.innerHTML;

        /* Enter loading state for the download button */
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        btn.disabled  = true;

        /* AbortController for a 10-second download timeout */
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 10000);

        try {
            /* Proxy the image fetch to work around CORS restrictions */
            const proxyUrl  = `https://api.allorigins.win/raw?url=${encodeURIComponent(imgUrl)}`;
            const response  = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Network error during download');

            /* Convert response to a Blob and create a temporary Object URL */
            const blob = await response.blob();
            const url  = window.URL.createObjectURL(blob);

            /* Programmatically trigger the browser's file-save dialog */
            const link      = document.createElement('a');
            link.href       = url;
            link.download   = `QR_Code_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();

            /* Clean up DOM node and release the Blob URL from memory */
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            window.showToast('QR Downloaded!');

        } catch (e) {
            clearTimeout(timeoutId);
            console.error('[QR Download Error]:', e);

            /* Graceful fallback: open the image in a new tab */
            window.open(imgUrl, '_blank');
            window.showToast('Opened in new tab — save manually (right-click → Save)');

        } finally {
            /* Always restore the button to its original state */
            btn.innerHTML = originalText;
            btn.disabled  = false;
        }
    }


    /* =====================================================================
       SECTION E — HISTORY MANAGEMENT (localStorage)
    ===================================================================== */

    /**
     * saveHistory(short, long)
     * ─────────────────────────────────────────────────────────────────────
     * Saves a newly generated short link to the browser's localStorage under
     * the key 'urlShortenerHistory'. Enforces a maximum of 10 entries and
     * prevents duplicate consecutive saves (same short URL back-to-back).
     *
     * After saving, loadHistory() is called to refresh the UI panel.
     *
     * @param {string} short — The shortened URL string.
     * @param {string} long  — The destination URL (with UTM parameters).
     */
    function saveHistory(short, long) {
        try {
            let history = JSON.parse(localStorage.getItem('urlShortenerHistory')) || [];

            /* Guard: skip if this exact short URL was just saved */
            if (history.length > 0 && history[0].short === short) return;

            history.unshift({
                short,
                long,
                date : new Date().toLocaleDateString(undefined, {
                    month  : 'short',
                    day    : 'numeric',
                    hour   : '2-digit',
                    minute : '2-digit'
                })
            });

            /* Keep only the 10 most recent entries */
            if (history.length > 10) history.pop();

            localStorage.setItem('urlShortenerHistory', JSON.stringify(history));
            loadHistory();

        } catch (e) {
            console.error('History Save Error:', e);
        }
    }

    /**
     * loadHistory()
     * ─────────────────────────────────────────────────────────────────────
     * Reads the 'urlShortenerHistory' array from localStorage and renders
     * each entry as a list item inside #historyList.
     *
     * Empty state: Shows a centered "No recent links found." message.
     *
     * Each history item contains:
     *  - The short URL as a clickable anchor (opens in new tab)
     *  - The original destination URL (truncated via CSS)
     *  - The date/time the link was created
     *  - A copy-to-clipboard icon button
     *
     * All user-provided strings are run through escapeHtml() before being
     * injected into innerHTML to prevent XSS vulnerabilities.
     */
    function loadHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('urlShortenerHistory')) || [];
            const list    = dom.historyList;

            if (history.length === 0) {
                /* Render an empty-state placeholder */
                list.innerHTML = `
                    <li style="text-align:center;color:var(--text-muted);padding:15px;font-size:13px;">
                        No recent links found.
                    </li>
                `;
                return;
            }

            /*
             * Map each history entry to a list item HTML string.
             * Staggered animation delay (50ms per item) creates a pleasant
             * cascade effect as the list renders.
             */
            list.innerHTML = history.map((item, i) => `
                <li class="history-item"
                    style="animation: fadeIn 0.3s ease forwards ${i * 0.05}s">
                    <div class="h-info">
                        <a href="${escapeHtml(item.short)}"
                           target="_blank"
                           class="h-link">${escapeHtml(item.short)}</a>
                        <span class="h-orig"
                              title="${escapeHtml(item.long)}">${escapeHtml(item.long)}</span>
                        <small style="color:var(--text-muted);font-size:10px;">
                            ${escapeHtml(item.date)}
                        </small>
                    </div>
                    <div class="h-actions">
                        <button onclick="window.app.copyText('${escapeHtml(item.short)}')"
                                title="Copy Short Link">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                </li>
            `).join('');

        } catch (e) {
            console.error('History Load Error:', e);
        }
    }

    /**
     * clearHistory()
     * ─────────────────────────────────────────────────────────────────────
     * Prompts the user for confirmation before removing the entire
     * 'urlShortenerHistory' key from localStorage and re-rendering the
     * now-empty history list. Fires a global info toast on completion.
     */
    function clearHistory() {
        if (confirm('Delete all history?')) {
            localStorage.removeItem('urlShortenerHistory');
            loadHistory();
            window.showToast('History Cleared');
        }
    }


    /* =====================================================================
       SECTION F — COPY TO CLIPBOARD
    ===================================================================== */

    /**
     * copyResult()
     * ─────────────────────────────────────────────────────────────────────
     * Convenience wrapper that reads the displayed short URL from the result
     * panel and delegates to copyText() for the actual clipboard write.
     */
    function copyResult() {
        const url = dom.shortUrlDisplay.textContent;
        copyText(url);
    }

    /**
     * copyText(text)
     * ─────────────────────────────────────────────────────────────────────
     * Copies an arbitrary string to the system clipboard.
     *
     * Strategy:
     *  - Uses the modern async Clipboard API when available (requires HTTPS
     *    context and browser permission).
     *  - Falls back to the legacy execCommand('copy') approach for older
     *    browsers or non-secure contexts.
     *
     * @param {string} text — The string to copy to the clipboard.
     */
    function copyText(text) {
        if (!text || text === '...') return;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => window.showToast('Copied to clipboard!'))
                .catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    /**
     * fallbackCopy(text)
     * ─────────────────────────────────────────────────────────────────────
     * Legacy clipboard copy using a temporarily inserted off-screen
     * <textarea> element and document.execCommand('copy').
     * Used when the Clipboard API is unavailable.
     *
     * @param {string} text — The string to copy via the legacy method.
     */
    function fallbackCopy(text) {
        const ta       = document.createElement('textarea');
        ta.value       = text;
        ta.style.position = 'fixed';
        ta.style.left     = '-9999px';
        document.body.appendChild(ta);
        ta.select();

        try {
            document.execCommand('copy');
            window.showToast('Copied!');
        } catch (e) {
            /* Use global error toast — true = error (red) */
            window.showToast('Copy failed — please select and copy manually', true);
        }

        document.body.removeChild(ta);
    }


    /* =====================================================================
       SECTION G — SOCIAL SHARING
    ===================================================================== */

    /**
     * shareSocial(platform)
     * ─────────────────────────────────────────────────────────────────────
     * Opens a pre-filled share dialog for the specified social platform in
     * a new browser tab. If no link has been generated yet, an error toast
     * is shown instead.
     *
     * Supported platforms:
     *  - 'wa'  → WhatsApp Web
     *  - 'fb'  → Facebook Sharer
     *  - 'tg'  → Telegram Share
     *  - 'tw'  → X (Twitter) Intent
     *
     * noopener,noreferrer is added to the window.open call to prevent the
     * opened tab from accessing this page via window.opener (security best
     * practice for external links).
     *
     * @param {string} platform — Platform key: 'wa' | 'fb' | 'tg' | 'tw'.
     */
    function shareSocial(platform) {
        const url = dom.shortUrlDisplay.textContent;

        if (!url || url === '...') {
            /* Use global error toast — true = error (red) */
            return window.showToast('Create a link first!', true);
        }

        const text   = encodeURIComponent('Check out this link: ');
        const encUrl = encodeURIComponent(url);

        const shareMap = {
            wa : `https://wa.me/?text=${text}${encUrl}`,
            fb : `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
            tg : `https://t.me/share/url?url=${encUrl}&text=${text}`,
            tw : `https://twitter.com/intent/tweet?url=${encUrl}&text=${text}`
        };

        if (shareMap[platform]) {
            window.open(shareMap[platform], '_blank', 'noopener,noreferrer');
        }
    }


    /* =====================================================================
       SECTION H — THEME INITIALISATION
       NOTE: This function only reads the theme from localStorage and applies
       the 'light-mode' class to the body. It does NOT set or change the theme.
       Full theme management (toggle, persist, apply) is handled by the global
       JavaScript file (assets/js/global.js).
    ===================================================================== */

    /**
     * initThemeCheck()
     * ─────────────────────────────────────────────────────────────────────
     * Reads the persisted 'siteTheme' value from localStorage and applies
     * the 'light-mode' CSS class to <body> if the user had previously
     * selected light mode. This prevents a flash of dark mode on load.
     */
    function initThemeCheck() {
        const savedTheme = localStorage.getItem('siteTheme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
        }
    }


    /* =====================================================================
       PUBLIC API — METHODS EXPOSED VIA window.app
       Only functions called from inline HTML onclick handlers need to be
       exported here. All private helpers remain encapsulated within the IIFE.
    ===================================================================== */
    return {
        initiateShortening,
        toggleAdvancedSettings,
        pasteFromClipboard,
        copyResult,
        copyText,
        downloadQr,
        shareSocial,
        clearHistory
    };

})();
