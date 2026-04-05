/**
 * =============================================================================
 *  TRUSTED TOOLS WEB — Robots.txt Generator Pro
 *  Script     : script.js
 *  Tool       : seo-robots-generator.html
 *  Author     : MD KAWSAR
 *  Version    : 3.0.0 (2026 Stable — CodeCanyon Elite Edition)
 *
 *  DESCRIPTION
 *  ─────────────────────────────────────────────────────────────────────────
 *  This is the complete client-side logic engine for the Robots.txt Generator
 *  Pro tool. It handles:
 *    • Real-time robots.txt generation (RFC 9309 compliant)
 *    • CMS quick-template application (WordPress, Shopify, Magento, Wix, Joomla)
 *    • AI/LLM bot blocking (GPTBot, CCBot, ClaudeBot, Google-Extended, etc.)
 *    • Crawl delay configuration
 *    • Sitemap URL validation and injection
 *    • Clipboard copy (Async Clipboard API with legacy execCommand fallback)
 *    • File download as robots.txt
 *    • Advanced Mode toggle (show / hide advanced UI sections)
 *    • Full form reset
 *
 *  TOAST SYSTEM
 *  ─────────────────────────────────────────────────────────────────────────
 *  This script uses the GLOBAL toast system provided by global.js:
 *    window.showToast("Message")        → success toast (default)
 *    window.showToast("Message", true)  → error toast
 *  No local toast HTML or local showToast() function is present here.
 *
 *  ARCHITECTURE NOTE
 *  ─────────────────────────────────────────────────────────────────────────
 *  All logic is wrapped inside DOMContentLoaded to guarantee that every
 *  DOM element is fully parsed before any references are made. No global
 *  scope pollution — all variables and functions are scoped to the listener.
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    /* =========================================================================
       SECTION 1 — DOM ELEMENT CACHING
       ─────────────────────────────────────────────────────────────────────────
       All frequently-accessed DOM elements are cached here once on load.
       This avoids repeated document.getElementById() calls throughout the
       script, improving performance and readability.
    ========================================================================= */
    const els = {
        /** CMS platform dropdown — triggers template application */
        cmsTemplate     : document.getElementById('cmsTemplate'),

        /** Default access selector — "Allow Everything" or "Disallow Everything" */
        defaultAccess   : document.getElementById('defaultAccess'),

        /** Crawl-delay dropdown — visible only in Advanced Mode */
        crawlDelay      : document.getElementById('crawlDelay'),

        /** Sitemap URL textarea — accepts comma- or newline-separated URLs */
        sitemap         : document.getElementById('sitemap'),

        /** Restricted paths textarea — one path per line */
        restrictedPaths : document.getElementById('restrictedPaths'),

        /** Read-only output textarea — displays the generated robots.txt */
        output          : document.getElementById('output'),

        /** Copy-to-clipboard button */
        btnCopy         : document.getElementById('btnCopy'),

        /** Download-as-file button */
        btnDownload     : document.getElementById('btnDownload'),

        /** Reset-all button */
        btnReset        : document.getElementById('btnReset'),

        /** Advanced Mode checkbox toggle */
        advancedToggle  : document.getElementById('advancedToggle'),

        /** NodeList of all elements that are hidden until Advanced Mode is ON */
        advancedSections: document.querySelectorAll('.advanced-section')
    };


    /* =========================================================================
       SECTION 2 — BOT CONFIGURATION (2026 UPDATE)
       ─────────────────────────────────────────────────────────────────────────
       Defines two bot categories:
         • ai     — Modern LLM / AI training scrapers (opt-out via robots.txt)
         • legacy — Traditional search engine and SEO auditing crawlers
       Each entry maps a checkbox element ID to the corresponding User-agent
       string that will be written into the robots.txt output.
    ========================================================================= */
    const botConfig = {

        /**
         * AI / LLM SCRAPERS
         * These bots collect content to train large language models.
         * Website owners can legitimately opt out by blocking them.
         */
        ai: [
            { id: 'blockGPT',        agent: 'GPTBot'            }, // OpenAI (ChatGPT)
            { id: 'blockCC',         agent: 'CCBot'             }, // Common Crawl (used by many LLMs)
            { id: 'blockAnthropic',  agent: 'ClaudeBot'         }, // Anthropic (Claude)
            { id: 'blockGoogleAI',   agent: 'Google-Extended'   }, // Google Gemini training (no Search impact)
            { id: 'blockAppleAI',    agent: 'Applebot-Extended' }, // Apple AI features
            { id: 'blockMeta',       agent: 'FacebookBot'       }, // Meta AI
            { id: 'blockPerplexity', agent: 'PerplexityBot'     }  // Perplexity AI
        ],

        /**
         * LEGACY / SEO CRAWLERS
         * These bots serve search indexing or third-party SEO auditing.
         * Blocking them is optional and only recommended for specific use-cases.
         */
        legacy: [
            { id: 'blockGoogleImg', agent: 'Googlebot-Image' }, // Google Images sub-crawler
            { id: 'blockYahoo',     agent: 'Slurp'           }, // Yahoo Search
            { id: 'blockBing',      agent: 'Bingbot'         }, // Microsoft Bing
            { id: 'blockBaidu',     agent: 'Baiduspider'     }, // Baidu (Chinese search engine)
            { id: 'blockMJ12',      agent: 'MJ12bot'         }, // Majestic SEO crawler
            { id: 'blockAhrefs',    agent: 'AhrefsBot'       }, // Ahrefs backlink tool
            { id: 'blockSemrush',   agent: 'SemrushBot'      }, // SEMrush audit tool
            { id: 'blockDotbot',    agent: 'DotBot'          }  // Moz Domain Authority crawler
        ]
    };


    /* =========================================================================
       SECTION 3 — CMS QUICK TEMPLATES
       ─────────────────────────────────────────────────────────────────────────
       Pre-defined sets of Disallow paths for the most popular CMS platforms.
       Selecting a platform from the dropdown populates the Restricted Paths
       textarea with these standard paths, saving the user manual entry time.
    ========================================================================= */
    const templates = {
        /** WordPress — blocks admin, core, plugins, and REST API */
        wordpress : "/wp-admin/\n/wp-includes/\n/wp-content/plugins/\n/wp-json/",

        /** Shopify — blocks cart, orders, and checkout flows */
        shopify   : "/cart\n/orders\n/checkouts/\n/checkout\n/account",

        /** Magento 2 — blocks all non-public application directories */
        magento   : "/app/\n/bin/\n/dev/\n/lib/\n/phpserver/\n/pkginfo/",

        /** Wix — blocks internal API, partials, and editor endpoints */
        wix       : "/_api/\n/_partials/\n/editor.jsp",

        /** Joomla — blocks administrator, cache, CLI, and installer */
        joomla    : "/administrator/\n/bin/\n/cache/\n/cli/\n/components/\n/includes/\n/installation/\n/language/\n/layouts/"
    };


    /* =========================================================================
       SECTION 4 — UTILITY FUNCTIONS
    ========================================================================= */

    /**
     * toggleAdvancedMode()
     * ─────────────────────────────────────────────────────────────────────────
     * Shows or hides all elements with the `.advanced-section` class based on
     * the checked state of the Advanced Mode toggle.
     *
     * Called by the advancedToggle 'change' event listener and also programma-
     * tically during the reset flow (passing a synthetic event object).
     *
     * @param {Event|{target:{checked:boolean}}} e — The change event (or a
     *   synthetic event object used during programmatic calls).
     */
    const toggleAdvancedMode = (e) => {
        const isChecked = e.target.checked;

        els.advancedSections.forEach(sec => {
            if (isChecked) {
                // Reveal the section with a smooth CSS transition
                sec.classList.add('active');
            } else {
                // Collapse the section back to zero height
                sec.classList.remove('active');
            }
        });
    };


    /**
     * validateSitemap()
     * ─────────────────────────────────────────────────────────────────────────
     * Parses the raw sitemap URL input field. Splits by comma or newline,
     * trims whitespace, and auto-prepends "https://" if the scheme is missing.
     *
     * @param  {string}   rawInput — Raw value from the sitemap textarea.
     * @returns {string[]}           Array of cleaned, absolute sitemap URLs.
     *                               Returns an empty array if input is blank.
     */
    const validateSitemap = (rawInput) => {
        if (!rawInput) return [];

        return rawInput
            .split(/[\n,]+/)               // Split on newlines or commas
            .map(url => url.trim())        // Remove surrounding whitespace
            .filter(url => url.length > 0) // Discard empty entries
            .map(url => {
                // Auto-prepend HTTPS scheme if the URL has no protocol
                if (!/^https?:\/\//i.test(url)) {
                    return `https://${url}`;
                }
                return url;
            });
    };


    /**
     * formatRestrictedPath()
     * ─────────────────────────────────────────────────────────────────────────
     * Normalises a single user-entered path string to ensure it has exactly
     * one leading forward-slash and no duplicate leading slashes.
     *
     * Examples:
     *   "  /admin/  " → "/admin/"
     *   "//private"   → "/private"
     *   "tmp/"        → "/tmp/"
     *
     * @param  {string} path — Raw path string from the textarea line.
     * @returns {string}       Normalised path, or empty string for blank input.
     */
    const formatRestrictedPath = (path) => {
        let p = path.trim();
        if (!p) return '';

        // Strip any number of leading slashes to avoid double-slashes
        p = p.replace(/^\/+/, '');

        // Re-add exactly one leading slash
        return '/' + p;
    };


    /**
     * handleTemplateChange()
     * ─────────────────────────────────────────────────────────────────────────
     * Handles selection of a CMS platform from the Quick Templates dropdown.
     * If a known template is selected, its Disallow paths are injected into
     * the restrictedPaths textarea and the generator is re-run immediately.
     * If the blank option is selected, the textarea is cleared.
     *
     * @param {Event} e — The 'change' event fired by the cmsTemplate select.
     */
    const handleTemplateChange = (e) => {
        const type = e.target.value;

        if (templates[type]) {
            // Populate restrictedPaths with the platform's standard paths
            els.restrictedPaths.value = templates[type];

            // Capitalise the first letter of the platform name for the toast
            const displayName = type.charAt(0).toUpperCase() + type.slice(1);
            window.showToast(`${displayName} Template Applied!`);

        } else if (type === '') {
            // User selected the blank "Select a Platform..." option — clear paths
            els.restrictedPaths.value = '';
        }

        // Always regenerate after a template change
        generateRobotsTxt();
    };


    /* =========================================================================
       SECTION 5 — CORE GENERATION LOGIC
       ─────────────────────────────────────────────────────────────────────────
       generateRobotsTxt() is the heart of this tool. It reads the current
       state of every UI control and constructs a valid robots.txt file as a
       multi-line string, which is then written to the read-only output textarea.

       The output adheres to the Robots Exclusion Protocol (RFC 9309):
       https://www.rfc-editor.org/rfc/rfc9309

       Generated file structure:
         SECTION A — Global rules  (User-agent: *)
         SECTION B — AI bot rules  (one block per checked AI bot)
         SECTION C — Legacy bot rules (one block per checked legacy bot)
         SECTION D — Sitemap declarations
    ========================================================================= */

    /**
     * generateRobotsTxt()
     * ─────────────────────────────────────────────────────────────────────────
     * Reads all form inputs and checkbox states, constructs a robots.txt
     * compliant string, and writes it into the output textarea.
     * Called on every relevant input/change event and on initial load.
     */
    const generateRobotsTxt = () => {
        // Accumulate all output lines in this array; joined at the end
        let out = [];

        // ── SECTION A: GLOBAL RULES (User-agent: *) ──────────────────────────
        // This block applies to every bot that is NOT explicitly named below.
        out.push('User-agent: *');

        // Crawl-delay directive: only emitted when the user picks a value
        if (els.crawlDelay.value) {
            out.push(`Crawl-delay: ${els.crawlDelay.value}`);
        }

        if (els.defaultAccess.value === 'disallow') {
            // "Disallow Everything" — single blanket rule blocks all paths
            out.push('Disallow: /');

        } else {
            // "Allow Everything" (default) — only emit specific Disallow entries
            // Parse and deduplicate restricted paths using a Set
            const userPaths = els.restrictedPaths.value.split('\n');
            const cleanPaths = new Set();

            userPaths.forEach(p => {
                const formatted = formatRestrictedPath(p);
                if (formatted) cleanPaths.add(formatted);
            });

            // Write each unique Disallow directive
            if (cleanPaths.size > 0) {
                cleanPaths.forEach(p => out.push(`Disallow: ${p}`));
            }
            // If no paths are restricted, the block intentionally remains empty
            // (implicit "Allow: /" behaviour per RFC 9309)
        }

        out.push(''); // Blank line separates the global block from bot blocks

        // ── SECTION B: AI SCRAPER BLOCKING ───────────────────────────────────
        // Collect the user-agent names for every checked AI bot checkbox
        let blockedAiBots = [];
        botConfig.ai.forEach(bot => {
            const el = document.getElementById(bot.id);
            if (el && el.checked) blockedAiBots.push(bot.agent);
        });

        if (blockedAiBots.length > 0) {
            out.push('# Block AI Scrapers & LLM Training Data');

            // Each bot gets its own User-agent / Disallow pair (per RFC 9309)
            blockedAiBots.forEach(agent => {
                out.push(`User-agent: ${agent}`);
                out.push('Disallow: /');
            });

            out.push(''); // Blank line separator after the AI group
        }

        // ── SECTION C: LEGACY / SPECIFIC CRAWLER BLOCKING ────────────────────
        // Collect user-agent names for every checked legacy bot checkbox
        let blockedLegacyBots = [];
        botConfig.legacy.forEach(bot => {
            const el = document.getElementById(bot.id);
            if (el && el.checked) blockedLegacyBots.push(bot.agent);
        });

        if (blockedLegacyBots.length > 0) {
            out.push('# Block Specific Crawlers');

            blockedLegacyBots.forEach(agent => {
                out.push(`User-agent: ${agent}`);
                out.push('Disallow: /');
            });

            out.push(''); // Blank line separator after the legacy group
        }

        // ── SECTION D: SITEMAP DECLARATIONS ──────────────────────────────────
        // RFC 9309 allows Sitemap directives anywhere in the file; placing them
        // at the bottom is the widely accepted convention.
        const sitemaps = validateSitemap(els.sitemap.value);
        if (sitemaps.length > 0) {
            out.push('# Sitemaps');
            sitemaps.forEach(url => out.push(`Sitemap: ${url}`));
        }

        // Join all lines and strip leading/trailing blank lines from the output
        els.output.value = out.join('\n').trim();
    };


    /* =========================================================================
       SECTION 6 — EVENT LISTENERS
       ─────────────────────────────────────────────────────────────────────────
       All DOM event bindings. Every relevant change to the UI immediately
       triggers generateRobotsTxt() to keep the live preview in sync.
    ========================================================================= */

    // ── Live input watchers ───────────────────────────────────────────────────
    // Both 'input' (for typing) and 'change' (for select/paste) are observed
    // so the output updates regardless of how the user modifies the field.
    const inputsToWatch = [
        els.defaultAccess,
        els.crawlDelay,
        els.sitemap,
        els.restrictedPaths
    ];

    inputsToWatch.forEach(el => {
        if (el) {
            el.addEventListener('input',  generateRobotsTxt);
            el.addEventListener('change', generateRobotsTxt);
        }
    });

    // ── Checkbox watchers ─────────────────────────────────────────────────────
    // Every checkbox inside .rtg-checkbox-group (both AI and Legacy bot groups)
    // triggers a full regeneration whenever its checked state changes.
    document.querySelectorAll('.rtg-checkbox-group input[type="checkbox"]').forEach(el => {
        el.addEventListener('change', generateRobotsTxt);
    });

    // ── CMS template dropdown ─────────────────────────────────────────────────
    // Handled by handleTemplateChange (applies preset paths + toasts user).
    els.cmsTemplate.addEventListener('change', handleTemplateChange);

    // ── Advanced Mode toggle ──────────────────────────────────────────────────
    // Shows or hides the advanced UI sections (crawl delay, legacy bots).
    els.advancedToggle.addEventListener('change', toggleAdvancedMode);

    // ── Output textarea auto-select ───────────────────────────────────────────
    // When the user focuses the read-only output, select all content for
    // quick manual copying (fallback for non-clipboard browsers).
    els.output.addEventListener('focus', function () {
        this.select();
    });


    /* =========================================================================
       SECTION 7 — ACTION BUTTONS
    ========================================================================= */

    /**
     * COPY TO CLIPBOARD
     * ─────────────────────────────────────────────────────────────────────────
     * Attempts the modern Async Clipboard API first (requires secure context /
     * HTTPS). Falls back to the legacy document.execCommand('copy') method for
     * older browsers or non-secure contexts (e.g., local file:// preview).
     *
     * On success: the button text and background briefly change to confirm
     * the action, then revert after 2 seconds.
     *
     * On failure: a global error toast is triggered and the error is logged.
     */
    els.btnCopy.addEventListener('click', async () => {
        const code = els.output.value;

        // Guard: no content in the output textarea
        if (!code) {
            window.showToast('Nothing to copy!', true);
            return;
        }

        // Preserve the original button HTML for restoration after feedback
        const originalHtml = els.btnCopy.innerHTML;

        try {
            // ── Method 1: Async Clipboard API (modern, preferred) ─────────────
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(code);
            } else {
                // Async Clipboard API unavailable — fall through to legacy method
                throw new Error('Clipboard API unavailable');
            }

            successFeedback();

        } catch (err) {

            // ── Method 2: Legacy fallback — textarea select + execCommand ─────
            try {
                els.output.select();
                document.execCommand('copy');
                successFeedback();
            } catch (fallbackErr) {
                console.error('Copy Error (both methods failed):', fallbackErr);
                window.showToast('Copy failed. Please copy manually.', true);
            }
        }

        /**
         * successFeedback()
         * Provides visual confirmation that the copy succeeded.
         * Updates the button label and background, then resets after 2 seconds.
         */
        function successFeedback() {
            window.showToast('Copied to Clipboard!');

            // Temporary visual state: green background + checkmark icon
            els.btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            els.btnCopy.style.background = 'linear-gradient(135deg, #00b894, #00cec9)';

            setTimeout(() => {
                // Restore original button label and remove inline style override
                els.btnCopy.innerHTML = originalHtml;
                els.btnCopy.style.background = '';
            }, 2000);
        }
    });


    /**
     * DOWNLOAD AS FILE
     * ─────────────────────────────────────────────────────────────────────────
     * Creates an in-memory Blob from the generated robots.txt content,
     * programmatically triggers a download via a temporary <a> element, and
     * immediately cleans up the Object URL to free browser memory.
     *
     * The file is always named "robots.txt" — the correct filename for the
     * Robots Exclusion Protocol (must be in the root of the domain).
     */
    els.btnDownload.addEventListener('click', () => {
        try {
            const code = els.output.value;

            // Guard: no content to download
            if (!code) {
                window.showToast('File is empty!', true);
                return;
            }

            // Wrap content in a UTF-8 plain-text Blob
            const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });

            // Create a temporary object URL and trigger a click on a hidden <a>
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'robots.txt';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Release the Object URL after the browser has processed the download
            setTimeout(() => URL.revokeObjectURL(link.href), 100);

            window.showToast('Downloading robots.txt...');

        } catch (e) {
            console.error('Download Error:', e);
            window.showToast('Download failed due to a browser restriction.', true);
        }
    });


    /**
     * RESET ALL SETTINGS
     * ─────────────────────────────────────────────────────────────────────────
     * Restores all form controls to their default/empty state:
     *   • Clears all text/textarea inputs
     *   • Resets all select dropdowns to their first option
     *   • Unchecks all checkboxes (except the Advanced Mode toggle itself,
     *     which is also reset and its UI state is collapsed via toggleAdvancedMode)
     *   • Re-runs generateRobotsTxt() to refresh the output
     */
    els.btnReset.addEventListener('click', () => {
        // Clear text areas
        els.restrictedPaths.value = '';
        els.sitemap.value         = '';

        // Reset select dropdowns to their default values
        els.defaultAccess.value   = 'allow';
        els.crawlDelay.value      = '';
        els.cmsTemplate.value     = '';

        // Uncheck every checkbox on the page except the Advanced Mode toggle
        document.querySelectorAll('input[type="checkbox"]').forEach(el => {
            if (el !== els.advancedToggle) el.checked = false;
        });

        // Also reset the Advanced Mode toggle and collapse its sections
        els.advancedToggle.checked = false;
        toggleAdvancedMode({ target: { checked: false } });

        // Re-generate to update the output textarea
        generateRobotsTxt();

        window.showToast('All settings have been reset.');
    });


    /* =========================================================================
       SECTION 8 — INITIALISATION
       ─────────────────────────────────────────────────────────────────────────
       Run the generator once immediately on load so the output textarea is
       never blank when the user first sees the tool.
    ========================================================================= */
    generateRobotsTxt();

}); // end DOMContentLoaded
