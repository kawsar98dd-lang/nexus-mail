/**
 * ============================================================================
 *  COOKIE CONVERTER PRO MAX — script.js
 *  Version   : 2.2 (CodeCanyon Release Build)
 *  Author    : MD KAWSAR | Trusted Tools Web
 *  Tool      : Netscape ↔ JSON Cookie Converter
 *  Architecture : Class-Based, Client-Side Secure Execution
 *
 *  Overview
 *  ────────
 *  This file contains a single self-contained class: CookieConverterEngine.
 *  All conversion logic, clipboard utilities, and download mechanics are
 *  encapsulated within the class — preventing global namespace pollution.
 *
 *  Toast Notifications
 *  ───────────────────
 *  All user feedback is delivered through the GLOBAL toast system exposed
 *  by global.js as window.showToast(message, isError).
 *    • Normal messages  → window.showToast("Message text")
 *    • Error messages   → window.showToast("Error text", true)
 *  The old local showToast() method has been removed entirely.
 *
 *  Script Loading
 *  ──────────────
 *  This script is loaded AFTER global.js so window.showToast is guaranteed
 *  to be available when any button handler executes.
 * ============================================================================
 */

class CookieConverterEngine {

    /**
     * Constructor — runs once on DOMContentLoaded.
     *
     * Caches all required DOM references and delegates event binding
     * to initEventListeners(). The class holds no additional state
     * beyond the cleanup timeout reference for deferred toasts.
     */
    constructor() {

        /* ── DOM REFERENCES ──────────────────────────────────────────────── */

        /**
         * @type {HTMLTextAreaElement} inputBox
         * The primary input textarea where users paste raw Netscape or JSON data.
         * Targeted by read & write operations throughout the engine.
         */
        this.inputBox  = document.getElementById('inputBox');

        /**
         * @type {HTMLTextAreaElement} outputBox
         * The read-only result textarea that displays the converted cookie data.
         * Written by all conversion and cleaning operations.
         */
        this.outputBox = document.getElementById('outputBox');

        /* Bind all button event listeners */
        this.initEventListeners();
    }

    /* ══════════════════════════════════════════════════════════════════════
       EVENT LISTENER BINDING
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * initEventListeners
     * ──────────────────
     * Registers click handlers for all tool action buttons.
     * Arrow function callbacks preserve `this` context so class methods
     * can safely access instance properties (inputBox, outputBox, etc.).
     *
     * Button IDs match the HTML exactly — do NOT rename.
     */
    initEventListeners() {
        document.getElementById('btnConvert').addEventListener('click',  () => this.convert());
        document.getElementById('btnClean').addEventListener('click',    () => this.cleanExpired());
        document.getElementById('btnReset').addEventListener('click',    () => this.clearAll());
        document.getElementById('btnPaste').addEventListener('click',    () => this.pasteFromClipboard());
        document.getElementById('btnCopy').addEventListener('click',     () => this.copyToClipboard());
        document.getElementById('btnDownload').addEventListener('click', () => this.downloadFile());
    }

    /* ══════════════════════════════════════════════════════════════════════
       SECURITY — INPUT SANITIZATION
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * sanitize
     * ────────
     * Removes basic XSS vectors from raw user input before any processing.
     * This is a client-side defence-in-depth measure; it does NOT replace
     * server-side sanitization (which is unnecessary here as there is no
     * server — all processing is local).
     *
     * Replacements applied:
     *  1. Strip <script> blocks (Self-XSS prevention)
     *  2. Strip javascript: URI schemes
     *  3. Normalize Unicode smart quotes → ASCII equivalents
     *     (Common when copying from Word, Notion, or macOS)
     *
     * @param  {string} raw - The raw string from the textarea
     * @return {string}     - Sanitized string safe for parsing
     */
    sanitize(raw) {
        if (!raw) return "";

        return raw
            /* 1. Remove any <script>...</script> blocks */
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            /* 2. Strip javascript: URI schemes */
            .replace(/javascript:/gim, "")
            /* 3. Replace Unicode left/right double quotes with standard " */
            .replace(/[\u201C\u201D]/g, '"')
            /* 4. Replace Unicode left/right single quotes with standard ' */
            .replace(/[\u2018\u2019]/g, "'");
    }

    /* ══════════════════════════════════════════════════════════════════════
       CORE CONVERSION ROUTER
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * convert
     * ───────
     * Master conversion orchestrator. Reads the input textarea, sanitizes
     * the content, auto-detects the cookie format (JSON vs Netscape), and
     * routes to the appropriate parser/serializer.
     *
     * Auto-Detection Logic:
     *  • Input starting with '[' or '{' → treat as JSON → convert to Netscape
     *  • Anything else                  → treat as Netscape → convert to JSON
     *
     * On success, the formatted output is written to #outputBox.
     * On any error, the global toast is triggered with isError = true.
     */
    convert() {
        let val = this.inputBox.value.trim();

        /* Guard: ensure there is actually something to process */
        if (!val) {
            return window.showToast("Please enter cookie data first.", true);
        }

        /* Run through sanitization before any parsing */
        val = this.sanitize(val);

        try {
            if (val.startsWith('[') || val.startsWith('{')) {
                /* ── PATH A: JSON → Netscape ───────────────────────────── */
                const json = this.parseJson(val);
                if (!json) return; /* Error already shown by parseJson() */

                this.outputBox.value = this.jsonToNetscape(json);
                window.showToast("Successfully converted JSON → Netscape");

            } else {
                /* ── PATH B: Netscape → JSON ───────────────────────────── */
                const cookies = this.netscapeToJson(val);

                if (!cookies || cookies.length === 0) {
                    return window.showToast("No valid cookies found. Check format.", true);
                }

                /* Pretty-print with 4-space indent for readability */
                this.outputBox.value = JSON.stringify(cookies, null, 4);
                window.showToast(`Converted ${cookies.length} cookie(s) to JSON`);
            }

        } catch (e) {
            /* Catch any unexpected runtime errors during parsing */
            console.error("[CookieConverter] Unexpected error during conversion:", e);
            window.showToast("Critical Error: Unable to process data.", true);
        }
    }

    /* ══════════════════════════════════════════════════════════════════════
       JSON PARSER WITH ERROR RECOVERY
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * parseJson
     * ─────────
     * Attempts to parse a JSON string with automatic error recovery for
     * one of the most common user mistakes: trailing commas before ] or }.
     *
     * Normalization steps:
     *  1. Remove trailing commas (e.g. `{"a":1,}` → `{"a":1}`)
     *  2. Attempt JSON.parse on the normalised string
     *  3. Wrap plain objects in an array for uniform downstream handling
     *
     * @param  {string}     str - The raw JSON input string
     * @return {Array|null}     - Array of cookie objects, or null on failure
     */
    parseJson(str) {
        try {
            /* Regex: remove trailing commas before closing ] or } */
            const fixedStr = str.replace(/,\s*([\]}])/g, '$1');
            const parsed   = JSON.parse(fixedStr);

            /* Normalise to array — some tools export a single object */
            return Array.isArray(parsed) ? parsed : [parsed];

        } catch (e) {
            window.showToast("Invalid JSON Format. Check brackets and commas.", true);
            return null;
        }
    }

    /* ══════════════════════════════════════════════════════════════════════
       JSON → NETSCAPE SERIALIZER
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * jsonToNetscape
     * ──────────────
     * Converts an array of cookie objects into a Netscape HTTP Cookie File
     * format string. This format is required by CLI tools such as cURL,
     * Wget, and Python's requests library.
     *
     * Column order (tab-separated):
     *   domain | flag | path | secure | expiration | name | value
     *
     * Special handling:
     *  • httpOnly : Prepends "#HttpOnly_" to domain per RFC convention
     *  • flag     : Set to "TRUE" when domain begins with "." (wildcard)
     *  • expDate  : Rounded to integer; defaults to 0 for session cookies
     *  • Entries without a domain or name are silently skipped (invalid)
     *
     * @param  {Array}  cookies - Array of standardised cookie objects
     * @return {string}         - Full Netscape-format file contents
     */
    jsonToNetscape(cookies) {
        /* File header required by consuming applications (cURL, Wget, etc.) */
        let out = "# Netscape HTTP Cookie File\n";
        out    += "# Generated by Trusted Tools Web — Secure Client-Side Tool\n";
        out    += "# This is a generated file! Do not edit.\n\n";

        cookies.forEach(c => {
            /* Skip null entries or non-object array items */
            if (!c || typeof c !== 'object') return;

            /* Extract and trim required fields */
            let domain = (c.domain || "").trim();
            let name   = (c.name   || "").trim();

            /* Skip any entry that is missing the mandatory domain or name */
            if (!domain || !name) return;

            /* Apply HttpOnly prefix convention if the flag is present */
            if (c.httpOnly === true && !domain.startsWith('#HttpOnly_')) {
                domain = "#HttpOnly_" + domain;
            }

            /*
             * Domain flag: "TRUE" for subdomain-wildcard cookies (dot prefix),
             * "FALSE" for host-only cookies.
             */
            const flag   = domain.startsWith('.') ? "TRUE" : "FALSE";
            const path   = c.path   || "/";
            const secure = (c.secure === true) ? "TRUE" : "FALSE";

            /* Expiration: convert to integer Unix timestamp; 0 = session */
            let exp = 0;
            if (c.expirationDate) {
                exp = Math.round(Number(c.expirationDate));
                if (isNaN(exp) || exp < 0) exp = 0;
            }

            /* Value: coerce to string; empty string for valueless cookies */
            const value = (c.value !== undefined && c.value !== null)
                          ? String(c.value)
                          : "";

            /* Emit one tab-delimited line per cookie */
            out += `${domain}\t${flag}\t${path}\t${secure}\t${exp}\t${name}\t${value}\n`;
        });

        return out;
    }

    /* ══════════════════════════════════════════════════════════════════════
       NETSCAPE → JSON PARSER
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * netscapeToJson
     * ──────────────
     * Parses a Netscape HTTP Cookie File string into a structured JSON array
     * compatible with Selenium's driver.add_cookie() API.
     *
     * Parsing rules:
     *  • Lines beginning with "#" are comments — skipped unless they start
     *    with "#HttpOnly_" which is a data line with the httpOnly flag set.
     *  • Lines are split on one or more tab characters to handle copy-paste
     *    inconsistencies from different editors.
     *  • Minimum 6 parts required (value column may be absent/empty).
     *  • Column order: domain, flag, path, secure, expiration, name[, value]
     *
     * Generated JSON fields follow the Chrome cookie extension schema for
     * maximum Selenium and Playwright compatibility.
     *
     * @param  {string} text - Raw Netscape-format text
     * @return {Array}       - Array of cookie objects (may be empty)
     */
    netscapeToJson(text) {
        const lines   = text.split(/\r?\n/); /* Normalise Windows/Unix line endings */
        const cookies = [];

        lines.forEach(line => {
            line = line.trim();

            /*
             * Skip blank lines and standard comment lines.
             * Exception: "#HttpOnly_" lines carry real cookie data.
             */
            if (!line || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) {
                return;
            }

            /*
             * Split on one or more tabs — handles copy-paste artefacts where
             * multiple spaces were substituted for tabs by text editors.
             */
            const parts = line.split(/\t+/);

            /*
             * Netscape format requires at minimum 6 columns.
             * The 7th column (value) is optional and may be empty.
             */
            if (parts.length >= 6) {
                let domain   = parts[0];
                let httpOnly = false;

                /* Detect and strip the HttpOnly convention prefix */
                if (domain.startsWith('#HttpOnly_')) {
                    httpOnly = true;
                    domain   = domain.substring(10); /* Remove "#HttpOnly_" prefix */
                }

                /* Parse expiration; treat NaN or negative as 0 (session) */
                const expRaw  = parseFloat(parts[4]);
                const expDate = (isNaN(expRaw) || expRaw < 0) ? 0 : expRaw;

                /*
                 * Reconstruct value: if the value itself contained tabs
                 * (unusual but valid), join the remaining parts back.
                 */
                const valPart = parts.length > 6 ? parts.slice(6).join('\t') : "";

                /* Build the standardised cookie object */
                cookies.push({
                    domain         : domain,
                    expirationDate : expDate,
                    hostOnly       : !domain.startsWith('.'),    /* No dot = host-only */
                    httpOnly       : httpOnly,
                    name           : parts[5],
                    path           : parts[2],
                    sameSite       : "no_restriction",           /* Safe default for imports */
                    secure         : (parts[3].toUpperCase() === "TRUE"),
                    session        : (expDate === 0),            /* True when no expiry */
                    storeId        : "0",                        /* Default store context */
                    value          : valPart,
                    id             : Math.floor(Math.random() * 10000000) /* Unique local ID */
                });
            }
        });

        return cookies;
    }

    /* ══════════════════════════════════════════════════════════════════════
       EXPIRED COOKIE CLEANER
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * cleanExpired
     * ────────────
     * Removes expired cookies from the current input, preserving only
     * session cookies and cookies whose expiration timestamp is in the future.
     *
     * Retention logic:
     *  • expDate === 0  : Session cookie (no expiry set) — always retained
     *  • expDate === -1 : Some frameworks use -1 for "session" — retained
     *  • expDate > now  : Future expiry — retained
     *  • Anything else  : Expired — removed
     *
     * Output format matches the input format (JSON stays JSON, Netscape
     * stays Netscape). Both inputBox and outputBox are updated simultaneously.
     */
    cleanExpired() {
        const val = this.inputBox.value.trim();
        if (!val) {
            return window.showToast("No data to clean.", true);
        }

        let cookies = [];
        let wasJson = false;

        /* Route parsing based on detected format */
        if (val.startsWith('[') || val.startsWith('{')) {
            cookies = this.parseJson(val);
            wasJson = true;
        } else {
            cookies = this.netscapeToJson(val);
        }

        if (!cookies || cookies.length === 0) {
            return window.showToast("No valid cookies could be parsed.", true);
        }

        const total = cookies.length;
        const now   = Date.now() / 1000; /* Current time as Unix seconds */

        /*
         * Filter predicate:
         *  Keep the cookie if it is a session cookie (exp = 0 or -1)
         *  OR if its expiration timestamp is still in the future.
         */
        const active  = cookies.filter(c => {
            const exp = Number(c.expirationDate);
            return exp === 0 || exp === -1 || exp > now;
        });

        const removed = total - active.length;

        /* Serialize back into the original format and update both panes */
        if (wasJson) {
            const res              = JSON.stringify(active, null, 4);
            this.inputBox.value   = res;
            this.outputBox.value  = res;
        } else {
            const resNetscape      = this.jsonToNetscape(active);
            this.inputBox.value   = resNetscape;
            this.outputBox.value  = resNetscape;
        }

        /* Inform the user of the outcome */
        if (removed > 0) {
            window.showToast(`Cleaned ${removed} expired cookie(s).`);
        } else {
            window.showToast("All cookies are already clean and active.");
        }
    }

    /* ══════════════════════════════════════════════════════════════════════
       CLIPBOARD UTILITIES
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * pasteFromClipboard
     * ──────────────────
     * Reads text from the system clipboard and populates the input textarea.
     * Uses the modern async Clipboard API (Clipboard.readText).
     *
     * Graceful degradation:
     *  If the user denies clipboard permission, a toast instructs them to
     *  paste manually via Ctrl+V / Cmd+V.
     */
    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();

            if (text) {
                this.inputBox.value = text;
                window.showToast("Pasted from clipboard successfully.");
            } else {
                window.showToast("Clipboard is empty — nothing to paste.", true);
            }

        } catch (err) {
            /* Permission denied or API unavailable */
            window.showToast("Clipboard permission denied. Use Ctrl+V to paste manually.", true);
        }
    }

    /**
     * copyToClipboard
     * ───────────────
     * Copies the contents of the output textarea to the system clipboard.
     * Uses the modern async Clipboard API with a legacy execCommand fallback
     * for older browsers that do not support Clipboard.writeText.
     */
    async copyToClipboard() {
        const content = this.outputBox.value;

        if (!content) {
            return window.showToast("Nothing to copy — the output is empty.", true);
        }

        try {
            /* Modern path: Clipboard API */
            await navigator.clipboard.writeText(content);
            window.showToast("Output copied to clipboard!");

        } catch (err) {
            /*
             * Legacy fallback: select the textarea text and use execCommand.
             * execCommand is deprecated but still supported in most browsers
             * as a fallback mechanism.
             */
            this.outputBox.select();
            document.execCommand('copy');
            window.showToast("Copied using fallback method.");
        }
    }

    /* ══════════════════════════════════════════════════════════════════════
       FILE DOWNLOAD
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * downloadFile
     * ────────────
     * Creates an in-memory Blob from the output textarea content and
     * triggers a browser download. File name and MIME type are inferred
     * from the content format (JSON vs Netscape text).
     *
     * Download lifecycle:
     *  1. Create Blob → generate object URL
     *  2. Programmatically click a hidden <a> element
     *  3. Schedule URL revocation after 100ms to free memory
     */
    downloadFile() {
        const content = this.outputBox.value;

        if (!content) {
            return window.showToast("Output is empty — nothing to download.", true);
        }

        /* Detect output format from the first non-whitespace character */
        const isJson   = content.trim().startsWith('[');
        const filename = isJson ? "cookies_clean.json" : "cookies_netscape.txt";
        const mimeType = isJson ? "application/json"   : "text/plain";

        /* Create Blob and temporary object URL for the download trigger */
        const blob = new Blob([content], { type: mimeType });
        const url  = URL.createObjectURL(blob);

        /* Build a transient anchor element and click it to start download */
        const a      = document.createElement("a");
        a.href       = url;
        a.download   = filename;
        document.body.appendChild(a);
        a.click();

        /* Clean up — remove the element and revoke the object URL after a tick */
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        window.showToast(`Downloading ${filename}...`);
    }

    /* ══════════════════════════════════════════════════════════════════════
       WORKSPACE RESET
    ══════════════════════════════════════════════════════════════════════ */

    /**
     * clearAll
     * ────────
     * Resets both the input and output textareas to empty strings,
     * giving the user a clean slate for the next conversion session.
     */
    clearAll() {
        this.inputBox.value  = "";
        this.outputBox.value = "";
        window.showToast("Workspace reset — ready for new data.");
    }

} /* end class CookieConverterEngine */


/* ══════════════════════════════════════════════════════════════════════════
   INITIALISATION
   ──────────────
   Bootstrap the engine after the full DOM is parsed and ready.
   global.js (loaded before this script) sets up window.showToast
   and handles theme persistence, so no theme logic is needed here.
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    /**
     * Instantiate the converter engine.
     * All event listeners are registered inside the constructor via
     * initEventListeners(), so the returned instance reference is not
     * needed at the module level.
     */
    new CookieConverterEngine();
});
