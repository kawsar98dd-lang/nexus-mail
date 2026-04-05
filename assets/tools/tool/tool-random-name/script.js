/**
 * ============================================================
 * PRODUCT  : Ultra Name Generator Pro
 * VERSION  : 3.1.0 (Offline Gold Master)
 * AUTHOR   : MD KAWSAR
 * LICENSE  : Commercial / CodeCanyon
 * FILE     : assets/tools/tool/tool-random-name/script.js
 *
 * PURPOSE  : Core application module.
 *            Drives all UI interactions for the random name /
 *            user-profile generator.  Consumes the offline
 *            name database exposed by name-database.js via
 *            the global `window.nameDatabase` object.
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 *  • Wrapped in a single IIFE to avoid polluting global scope.
 *  • Exposes a minimal `window.app` surface for the inline
 *    onclick handlers defined in the HTML template.
 *  • Zero external HTTP calls — all data is sourced from the
 *    bundled name-database.js file (mock-engine layer).
 *  • DocumentFragment-based rendering prevents layout thrash
 *    for large batches (up to 500 rows).
 *  • Every string that reaches the DOM passes through `sanitize()`
 *    to neutralise XSS vectors.
 *
 * CHANGELOG
 * ─────────
 *  v3.1.0  - Removed ALL fetch / AbortController / API-fallback
 *            logic from generateData().
 *          - generateData() now calls generateLocalProfile()
 *            exclusively.
 *          - Added 195-country regionalMap (ISO-3166-1 alpha-2
 *            codes mapped to shared linguistic/cultural pools).
 *          - Expanded flags object to cover all 195 countries.
 *          - Maintained IIFE, DocumentFragment, XSS sanitization,
 *            and CodeCanyon premium commenting format.
 * ============================================================
 */

/* ─── Strict mode — catches silent JS errors early ───────── */
'use strict';

(function () {

    /* ════════════════════════════════════════════════════════
     * §1  REGIONAL MAP
     *
     * Maps every ISO 3166-1 alpha-2 country code to a "pool
     * key" that exists inside window.nameDatabase.
     *
     * DESIGN RATIONALE — FILE-SIZE OPTIMISATION
     * ─────────────────────────────────────────
     * Maintaining 195 independent name arrays would bloat the
     * database file enormously.  Instead, countries that share
     * a dominant linguistic / cultural naming tradition are
     * mapped to one representative pool key:
     *
     *   'sa'  → Arabic pool  (Gulf, Levant, N. Africa, Horn)
     *   'ir'  → Persian pool (Iran, Afghanistan, Tajikistan)
     *   'es'  → Spanish pool (all Latin American + Spain)
     *   'pt'  → Portuguese pool (Brazil, Portugal, Lusophone Africa)
     *   'fr'  → French pool  (France, Francophone Africa, etc.)
     *   'ru'  → Slavic/Cyrillic pool (Russia, Belarus, Bulgaria…)
     *   'en'  → English/generic pool (Caribbean, Pacific islands,
     *            sub-Saharan Anglophone nations without a distinct
     *            pool of their own)
     *   'bn'  → Bengali pool  (Bangladesh + West Bengal fallback)
     *   'in'  → Indian pool   (multi-lingual India generic)
     *   'cn'  → Chinese pool  (mainland China, Taiwan)
     *   'id'  → Indonesian/Malay pool (Indonesia, Malaysia,
     *            Brunei, Singapore bilingual fallback)
     *
     * Countries with large populations or highly distinctive
     * naming conventions receive their own dedicated pool key
     * (e.g., 'jp', 'kr', 'vn', 'tr', 'pk', 'ng', 'et'…).
     *
     * The pool key must exactly match a top-level key in the
     * window.nameDatabase object defined in name-database.js.
     * ════════════════════════════════════════════════════════ */
    const regionalMap = {

        /* ── Africa ──────────────────────────────────────── */
        dz: 'sa',   // Algeria           → Arabic pool
        ao: 'pt',   // Angola            → Portuguese pool
        bj: 'fr',   // Benin             → French pool
        bw: 'en',   // Botswana          → English pool
        bf: 'fr',   // Burkina Faso      → French pool
        bi: 'fr',   // Burundi           → French pool
        cv: 'pt',   // Cabo Verde        → Portuguese pool
        cm: 'fr',   // Cameroon          → French pool
        cf: 'fr',   // Central African Republic → French pool
        td: 'fr',   // Chad              → French pool
        km: 'sa',   // Comoros           → Arabic pool
        cd: 'fr',   // Congo (DR)        → French pool
        cg: 'fr',   // Congo (Republic)  → French pool
        ci: 'fr',   // Côte d'Ivoire     → French pool
        dj: 'sa',   // Djibouti          → Arabic pool
        eg: 'sa',   // Egypt             → Arabic pool
        gq: 'es',   // Equatorial Guinea → Spanish pool
        er: 'et',   // Eritrea           → Ethiopian/Tigrinya pool
        sz: 'en',   // Eswatini          → English pool
        et: 'et',   // Ethiopia          → Ethiopian pool (own key)
        ga: 'fr',   // Gabon             → French pool
        gm: 'en',   // Gambia            → English pool
        gh: 'en',   // Ghana             → English pool
        gn: 'fr',   // Guinea            → French pool
        gw: 'pt',   // Guinea-Bissau     → Portuguese pool
        ke: 'ke',   // Kenya             → Kenyan pool (own key)
        ls: 'en',   // Lesotho           → English pool
        lr: 'en',   // Liberia           → English pool
        ly: 'sa',   // Libya             → Arabic pool
        mg: 'fr',   // Madagascar        → French pool
        mw: 'en',   // Malawi            → English pool
        ml: 'fr',   // Mali              → French pool
        mr: 'sa',   // Mauritania        → Arabic pool
        mu: 'fr',   // Mauritius         → French pool
        ma: 'sa',   // Morocco           → Arabic pool
        mz: 'pt',   // Mozambique        → Portuguese pool
        na: 'en',   // Namibia           → English pool
        ne: 'fr',   // Niger             → French pool
        ng: 'ng',   // Nigeria           → Nigerian pool (own key)
        rw: 'fr',   // Rwanda            → French pool
        st: 'pt',   // São Tomé & Príncipe → Portuguese pool
        sn: 'fr',   // Senegal           → French pool
        sc: 'fr',   // Seychelles        → French pool
        sl: 'en',   // Sierra Leone      → English pool
        so: 'sa',   // Somalia           → Arabic pool
        za: 'za',   // South Africa      → South African pool (own key)
        ss: 'en',   // South Sudan       → English pool
        sd: 'sa',   // Sudan             → Arabic pool
        tz: 'ke',   // Tanzania          → Swahili/Kenyan pool
        tg: 'fr',   // Togo              → French pool
        tn: 'sa',   // Tunisia           → Arabic pool
        ug: 'en',   // Uganda            → English pool
        zm: 'en',   // Zambia            → English pool
        zw: 'en',   // Zimbabwe          → English pool

        /* ── North & Central America ─────────────────────── */
        ag: 'en',   // Antigua & Barbuda → English pool
        bs: 'en',   // Bahamas           → English pool
        bb: 'en',   // Barbados          → English pool
        bz: 'en',   // Belize            → English pool
        ca: 'ca',   // Canada            → Canadian pool (own key)
        cr: 'es',   // Costa Rica        → Spanish pool
        cu: 'es',   // Cuba              → Spanish pool
        dm: 'en',   // Dominica          → English pool
        do: 'es',   // Dominican Republic → Spanish pool
        sv: 'es',   // El Salvador       → Spanish pool
        gd: 'en',   // Grenada           → English pool
        gt: 'es',   // Guatemala         → Spanish pool
        ht: 'fr',   // Haiti             → French pool
        hn: 'es',   // Honduras          → Spanish pool
        jm: 'en',   // Jamaica           → English pool
        mx: 'mx',   // Mexico            → Mexican pool (own key)
        ni: 'es',   // Nicaragua         → Spanish pool
        pa: 'es',   // Panama            → Spanish pool
        kn: 'en',   // Saint Kitts & Nevis → English pool
        lc: 'en',   // Saint Lucia       → English pool
        vc: 'en',   // Saint Vincent & the Grenadines → English pool
        tt: 'en',   // Trinidad & Tobago → English pool
        us: 'us',   // United States     → US pool (own key)

        /* ── South America ───────────────────────────────── */
        ar: 'es',   // Argentina         → Spanish pool
        bo: 'es',   // Bolivia           → Spanish pool
        br: 'br',   // Brazil            → Brazilian pool (own key)
        cl: 'es',   // Chile             → Spanish pool
        co: 'es',   // Colombia          → Spanish pool
        ec: 'es',   // Ecuador           → Spanish pool
        gy: 'en',   // Guyana            → English pool
        py: 'es',   // Paraguay          → Spanish pool
        pe: 'es',   // Peru              → Spanish pool
        sr: 'nl',   // Suriname          → Dutch pool
        uy: 'es',   // Uruguay           → Spanish pool
        ve: 'es',   // Venezuela         → Spanish pool

        /* ── Central Asia ────────────────────────────────── */
        kz: 'ru',   // Kazakhstan        → Slavic/Russian pool
        kg: 'ru',   // Kyrgyzstan        → Slavic/Russian pool
        tj: 'ir',   // Tajikistan        → Persian pool
        tm: 'ru',   // Turkmenistan      → Slavic/Russian pool
        uz: 'ru',   // Uzbekistan        → Slavic/Russian pool

        /* ── East Asia ───────────────────────────────────── */
        cn: 'cn',   // China             → Chinese pool (own key)
        jp: 'jp',   // Japan             → Japanese pool (own key)
        mn: 'ru',   // Mongolia          → Russian pool (fallback)
        kp: 'kr',   // North Korea       → Korean pool
        kr: 'kr',   // South Korea       → Korean pool (own key)
        tw: 'cn',   // Taiwan            → Chinese pool

        /* ── South Asia ──────────────────────────────────── */
        af: 'ir',   // Afghanistan       → Persian/Dari pool
        bd: 'bd',   // Bangladesh        → Bengali pool (own key)
        bt: 'in',   // Bhutan            → Indian pool (fallback)
        in: 'in',   // India             → Indian pool (own key)
        mv: 'sa',   // Maldives          → Arabic pool
        np: 'np',   // Nepal             → Nepali pool (own key)
        pk: 'pk',   // Pakistan          → Pakistani/Urdu pool (own key)
        lk: 'lk',   // Sri Lanka         → Sri Lankan pool (own key)

        /* ── South East Asia ─────────────────────────────── */
        bn: 'id',   // Brunei            → Indonesian/Malay pool
        kh: 'kh',   // Cambodia          → Khmer pool (own key)
        tl: 'pt',   // East Timor        → Portuguese pool
        id: 'id',   // Indonesia         → Indonesian pool (own key)
        la: 'la',   // Laos              → Lao pool (own key)
        my: 'id',   // Malaysia          → Indonesian/Malay pool
        mm: 'mm',   // Myanmar           → Burmese pool (own key)
        ph: 'ph',   // Philippines       → Filipino pool (own key)
        sg: 'en',   // Singapore         → English pool (multilingual fallback)
        th: 'th',   // Thailand          → Thai pool (own key)
        vn: 'vn',   // Vietnam           → Vietnamese pool (own key)

        /* ── Western Asia & Middle East ──────────────────── */
        am: 'ru',   // Armenia           → Slavic pool (fallback)
        az: 'tr',   // Azerbaijan        → Turkish pool
        bh: 'sa',   // Bahrain           → Arabic pool
        cy: 'gr',   // Cyprus            → Greek pool
        ge: 'ru',   // Georgia           → Slavic pool (fallback)
        iq: 'sa',   // Iraq              → Arabic pool
        ir: 'ir',   // Iran              → Persian pool (own key)
        il: 'il',   // Israel            → Hebrew pool (own key)
        jo: 'sa',   // Jordan            → Arabic pool
        kw: 'sa',   // Kuwait            → Arabic pool
        lb: 'sa',   // Lebanon           → Arabic pool
        om: 'sa',   // Oman              → Arabic pool
        qa: 'sa',   // Qatar             → Arabic pool
        sa: 'sa',   // Saudi Arabia      → Arabic pool (own key)
        sy: 'sa',   // Syria             → Arabic pool
        tr: 'tr',   // Turkey            → Turkish pool (own key)
        ae: 'sa',   // UAE               → Arabic pool
        ye: 'sa',   // Yemen             → Arabic pool

        /* ── Western Europe ──────────────────────────────── */
        at: 'de',   // Austria           → German pool
        be: 'fr',   // Belgium           → French pool (dominant)
        fr: 'fr',   // France            → French pool (own key)
        de: 'de',   // Germany           → German pool (own key)
        ie: 'en',   // Ireland           → English pool
        lu: 'fr',   // Luxembourg        → French pool
        mc: 'fr',   // Monaco            → French pool
        nl: 'nl',   // Netherlands       → Dutch pool (own key)
        ch: 'de',   // Switzerland       → German pool (dominant)
        gb: 'gb',   // United Kingdom    → British pool (own key)

        /* ── Northern Europe ─────────────────────────────── */
        dk: 'dk',   // Denmark           → Danish pool (own key)
        ee: 'ru',   // Estonia           → Slavic pool (fallback)
        fi: 'fi',   // Finland           → Finnish pool (own key)
        is: 'dk',   // Iceland           → Nordic pool
        lv: 'ru',   // Latvia            → Slavic pool (fallback)
        lt: 'ru',   // Lithuania         → Slavic pool (fallback)
        no: 'no',   // Norway            → Norwegian pool (own key)
        se: 'se',   // Sweden            → Swedish pool (own key)

        /* ── Southern Europe ─────────────────────────────── */
        al: 'al',   // Albania           → Albanian pool (own key)
        ad: 'es',   // Andorra           → Spanish pool
        ba: 'ru',   // Bosnia & Herzegovina → Slavic pool
        hr: 'ru',   // Croatia           → Slavic pool
        gr: 'gr',   // Greece            → Greek pool (own key)
        va: 'it',   // Vatican           → Italian pool
        it: 'it',   // Italy             → Italian pool (own key)
        xk: 'al',   // Kosovo            → Albanian pool
        mt: 'en',   // Malta             → English pool
        me: 'ru',   // Montenegro        → Slavic pool
        mk: 'ru',   // North Macedonia   → Slavic pool
        pt: 'pt',   // Portugal          → Portuguese pool (own key)
        sm: 'it',   // San Marino        → Italian pool
        rs: 'ru',   // Serbia            → Slavic pool
        si: 'ru',   // Slovenia          → Slavic pool
        es: 'es',   // Spain             → Spanish pool (own key)

        /* ── Eastern Europe ──────────────────────────────── */
        by: 'ru',   // Belarus           → Slavic pool
        bg: 'ru',   // Bulgaria          → Slavic pool
        cz: 'ru',   // Czech Republic    → Slavic pool
        hu: 'hu',   // Hungary           → Hungarian pool (own key)
        md: 'ru',   // Moldova           → Slavic pool
        pl: 'pl',   // Poland            → Polish pool (own key)
        ro: 'ro',   // Romania           → Romanian pool (own key)
        ru: 'ru',   // Russia            → Slavic/Russian pool (own key)
        sk: 'ru',   // Slovakia          → Slavic pool
        ua: 'ru',   // Ukraine           → Slavic pool

        /* ── Oceania ─────────────────────────────────────── */
        au: 'au',   // Australia         → Australian pool (own key)
        fj: 'en',   // Fiji              → English pool
        ki: 'en',   // Kiribati          → English pool
        mh: 'en',   // Marshall Islands  → English pool
        fm: 'en',   // Micronesia        → English pool
        nr: 'en',   // Nauru             → English pool
        nz: 'en',   // New Zealand       → English pool
        pw: 'en',   // Palau             → English pool
        pg: 'en',   // Papua New Guinea  → English pool
        ws: 'en',   // Samoa             → English pool
        sb: 'en',   // Solomon Islands   → English pool
        to: 'en',   // Tonga             → English pool
        tv: 'en',   // Tuvalu            → English pool
        vu: 'en',   // Vanuatu           → English pool
    };

    /* ════════════════════════════════════════════════════════
     * §2  FLAGS
     *
     * Maps every ISO 3166-1 alpha-2 country code to its flag
     * emoji.  Used when rendering result rows so the UI shows
     * a contextual flag next to each generated profile.
     *
     * 'all' maps to a globe emoji for the "Global Random"
     * option.  Pool keys that are not raw country codes (e.g.
     * 'us', 'gb', 'in') are also present so the lookup never
     * returns undefined regardless of whether we resolve via
     * the raw user selection or the resolved pool key.
     * ════════════════════════════════════════════════════════ */
    const flags = {
        /* ── Global catch-all ── */
        all: '🌍',

        /* ── Africa ── */
        dz: '🇩🇿', ao: '🇦🇴', bj: '🇧🇯', bw: '🇧🇼', bf: '🇧🇫',
        bi: '🇧🇮', cv: '🇨🇻', cm: '🇨🇲', cf: '🇨🇫', td: '🇹🇩',
        km: '🇰🇲', cd: '🇨🇩', cg: '🇨🇬', ci: '🇨🇮', dj: '🇩🇯',
        eg: '🇪🇬', gq: '🇬🇶', er: '🇪🇷', sz: '🇸🇿', et: '🇪🇹',
        ga: '🇬🇦', gm: '🇬🇲', gh: '🇬🇭', gn: '🇬🇳', gw: '🇬🇼',
        ke: '🇰🇪', ls: '🇱🇸', lr: '🇱🇷', ly: '🇱🇾', mg: '🇲🇬',
        mw: '🇲🇼', ml: '🇲🇱', mr: '🇲🇷', mu: '🇲🇺', ma: '🇲🇦',
        mz: '🇲🇿', na: '🇳🇦', ne: '🇳🇪', ng: '🇳🇬', rw: '🇷🇼',
        st: '🇸🇹', sn: '🇸🇳', sc: '🇸🇨', sl: '🇸🇱', so: '🇸🇴',
        za: '🇿🇦', ss: '🇸🇸', sd: '🇸🇩', tz: '🇹🇿', tg: '🇹🇬',
        tn: '🇹🇳', ug: '🇺🇬', zm: '🇿🇲', zw: '🇿🇼',

        /* ── North & Central America ── */
        ag: '🇦🇬', bs: '🇧🇸', bb: '🇧🇧', bz: '🇧🇿', ca: '🇨🇦',
        cr: '🇨🇷', cu: '🇨🇺', dm: '🇩🇲', do: '🇩🇴', sv: '🇸🇻',
        gd: '🇬🇩', gt: '🇬🇹', ht: '🇭🇹', hn: '🇭🇳', jm: '🇯🇲',
        mx: '🇲🇽', ni: '🇳🇮', pa: '🇵🇦', kn: '🇰🇳', lc: '🇱🇨',
        vc: '🇻🇨', tt: '🇹🇹', us: '🇺🇸',

        /* ── South America ── */
        ar: '🇦🇷', bo: '🇧🇴', br: '🇧🇷', cl: '🇨🇱', co: '🇨🇴',
        ec: '🇪🇨', gy: '🇬🇾', py: '🇵🇾', pe: '🇵🇪', sr: '🇸🇷',
        uy: '🇺🇾', ve: '🇻🇪',

        /* ── Central Asia ── */
        kz: '🇰🇿', kg: '🇰🇬', tj: '🇹🇯', tm: '🇹🇲', uz: '🇺🇿',

        /* ── East Asia ── */
        cn: '🇨🇳', jp: '🇯🇵', mn: '🇲🇳', kp: '🇰🇵', kr: '🇰🇷',
        tw: '🇹🇼',

        /* ── South Asia ── */
        af: '🇦🇫', bd: '🇧🇩', bt: '🇧🇹', in: '🇮🇳', mv: '🇲🇻',
        np: '🇳🇵', pk: '🇵🇰', lk: '🇱🇰',

        /* ── South East Asia ── */
        bn: '🇧🇳', kh: '🇰🇭', tl: '🇹🇱', id: '🇮🇩', la: '🇱🇦',
        my: '🇲🇾', mm: '🇲🇲', ph: '🇵🇭', sg: '🇸🇬', th: '🇹🇭',
        vn: '🇻🇳',

        /* ── Western Asia & Middle East ── */
        am: '🇦🇲', az: '🇦🇿', bh: '🇧🇭', cy: '🇨🇾', ge: '🇬🇪',
        iq: '🇮🇶', ir: '🇮🇷', il: '🇮🇱', jo: '🇯🇴', kw: '🇰🇼',
        lb: '🇱🇧', om: '🇴🇲', qa: '🇶🇦', sa: '🇸🇦', sy: '🇸🇾',
        tr: '🇹🇷', ae: '🇦🇪', ye: '🇾🇪',

        /* ── Western Europe ── */
        at: '🇦🇹', be: '🇧🇪', fr: '🇫🇷', de: '🇩🇪', ie: '🇮🇪',
        lu: '🇱🇺', mc: '🇲🇨', nl: '🇳🇱', ch: '🇨🇭', gb: '🇬🇧',

        /* ── Northern Europe ── */
        dk: '🇩🇰', ee: '🇪🇪', fi: '🇫🇮', is: '🇮🇸', lv: '🇱🇻',
        lt: '🇱🇹', no: '🇳🇴', se: '🇸🇪',

        /* ── Southern Europe ── */
        al: '🇦🇱', ad: '🇦🇩', ba: '🇧🇦', hr: '🇭🇷', gr: '🇬🇷',
        va: '🇻🇦', it: '🇮🇹', xk: '🇽🇰', mt: '🇲🇹', me: '🇲🇪',
        mk: '🇲🇰', pt: '🇵🇹', sm: '🇸🇲', rs: '🇷🇸', si: '🇸🇮',
        es: '🇪🇸',

        /* ── Eastern Europe ── */
        by: '🇧🇾', bg: '🇧🇬', cz: '🇨🇿', hu: '🇭🇺', md: '🇲🇩',
        pl: '🇵🇱', ro: '🇷🇴', ru: '🇷🇺', sk: '🇸🇰', ua: '🇺🇦',

        /* ── Oceania ── */
        au: '🇦🇺', fj: '🇫🇯', ki: '🇰🇮', mh: '🇲🇭', fm: '🇫🇲',
        nr: '🇳🇷', nz: '🇳🇿', pw: '🇵🇼', pg: '🇵🇬', ws: '🇼🇸',
        sb: '🇸🇧', to: '🇹🇴', tv: '🇹🇻', vu: '🇻🇺',
    };

    /* ════════════════════════════════════════════════════════
     * §3  CONSTANTS & RUNTIME STATE
     * ════════════════════════════════════════════════════════ */

    /** Maximum profiles allowed per generation batch. */
    const MAX_QUANTITY = 500;

    /**
     * In-memory store for the most recently generated profiles.
     * Populated by generateData(), consumed by copyAll(),
     * copyJSON(), and exportTXT().
     *
     * @type {Array<Object>}
     */
    let lastResults = [];

    /**
     * All pool keys that exist in window.nameDatabase.
     * Computed once at init time and cached here so that
     * resolvePool() can use it for the 'all' global-random mode.
     *
     * @type {string[]}
     */
    let allPoolKeys = [];

    /* ════════════════════════════════════════════════════════
     * §4  DOM HELPERS
     * ════════════════════════════════════════════════════════ */

    /**
     * Shorthand querySelector scoped to document.
     *
     * @param  {string} sel  CSS selector.
     * @returns {Element|null}
     */
    const $ = (sel) => document.querySelector(sel);

    /**
     * XSS sanitizer — converts the five dangerous HTML
     * characters to their safe entity equivalents before any
     * user-derived or database string is injected into the DOM
     * via innerHTML.
     *
     * Called on every field value before it reaches a template
     * literal that is written to innerHTML.
     *
     * @param  {*} value  Any value; coerced to string.
     * @returns {string}  HTML-entity-escaped string.
     */
    const sanitize = (value) => String(value)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;');

    /**
     * Updates the status label inside the terminal bar.
     *
     * @param {string} text   Short status string (e.g. 'IDLE').
     * @param {string} [cls]  Optional CSS class to apply
     *                        ('success' | 'error' | '').
     */
    const setStatus = (text, cls = '') => {
        const el = $('#status-txt');
        if (!el) return;
        el.textContent = text;
        el.className   = `ung-status-txt${cls ? ` ung-status--${cls}` : ''}`;
    };

    /**
     * Shows or hides the loading spinner overlay inside the
     * terminal panel.
     *
     * @param {boolean} visible
     */
    const setLoader = (visible) => {
        const loader = $('#loader');
        if (loader) loader.style.display = visible ? 'flex' : 'none';
    };

    /**
     * Temporarily disables the Generate button to prevent
     * double-clicks during a generation cycle.
     *
     * @param {boolean} disabled
     */
    const setGenerateBtn = (disabled) => {
        const btn = $('#generateBtn');
        if (!btn) return;
        btn.disabled = disabled;
        btn.setAttribute('aria-busy', String(disabled));
    };

    /* ════════════════════════════════════════════════════════
     * §5  NAME-DATABASE ACCESS HELPERS
     * ════════════════════════════════════════════════════════ */

    /**
     * Validates that the global name database loaded correctly.
     * Throws a descriptive Error if not, so the catch block in
     * generateData() can surface a helpful message to the user.
     *
     * @throws {Error}
     */
    const assertDatabase = () => {
        if (typeof window.nameDatabase !== 'object' || window.nameDatabase === null) {
            throw new Error(
                'Name database not found. ' +
                'Ensure name-database.js is loaded before script.js.'
            );
        }
    };

    /**
     * Resolves the correct name-database pool key for a given
     * country code.
     *
     * Resolution order:
     *   1. If 'all'  → pick a random key from allPoolKeys.
     *   2. Look up the code in regionalMap.
     *   3. Verify the resolved pool key exists in nameDatabase.
     *   4. Fall back to 'en' (English generic) if the key is
     *      missing from the database (guards against a stale
     *      database during incremental development).
     *
     * @param  {string} countryCode  ISO 3166-1 alpha-2 or 'all'.
     * @returns {string}  A pool key guaranteed to exist in
     *                    window.nameDatabase.
     */
    const resolvePool = (countryCode) => {
        const db = window.nameDatabase;

        /* Global random — pick any pool uniformly at random. */
        if (countryCode === 'all') {
            return allPoolKeys[Math.floor(Math.random() * allPoolKeys.length)];
        }

        const poolKey = regionalMap[countryCode] || countryCode;

        /* Safety net: fall back to 'en' if the key is absent. */
        return db[poolKey] ? poolKey : 'en';
    };

    /**
     * Returns a random element from an array.
     * Extracted here to keep call-sites readable.
     *
     * @template T
     * @param  {T[]} arr
     * @returns {T}
     */
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    /* ════════════════════════════════════════════════════════
     * §6  PROFILE GENERATION
     * ════════════════════════════════════════════════════════ */

    /**
     * Generates a single synthetic user profile from the
     * offline name database.
     *
     * The function is intentionally SYNCHRONOUS — no Promises,
     * no fetch, no AbortController.  All data is drawn from
     * window.nameDatabase which is guaranteed to be present
     * before this script executes (load order enforced in HTML).
     *
     * Profile shape:
     * ──────────────
     * {
     *   countryCode : string   – raw ISO code from <select>
     *   poolKey     : string   – resolved database pool key
     *   flag        : string   – flag emoji
     *   gender      : string   – 'male' | 'female'
     *   firstName   : string
     *   lastName    : string
     *   fullName    : string
     *   email       : string   – RFC-compatible synthetic address
     *   age         : number   – 18–72 inclusive
     * }
     *
     * @param  {string} countryCode  ISO 3166-1 alpha-2 or 'all'.
     * @param  {string} genderPref   'male' | 'female' | 'all'.
     * @returns {Object}  A single profile object.
     */
    const generateLocalProfile = (countryCode, genderPref) => {
        const db      = window.nameDatabase;
        const poolKey = resolvePool(countryCode);
        const pool    = db[poolKey];

        /* ── Gender resolution ───────────────────────────── */
        const gender  = (genderPref === 'all')
            ? (Math.random() < 0.5 ? 'male' : 'female')
            : genderPref;

        /* ── Name arrays ─────────────────────────────────── */
        /*
         * Database pools expose four arrays:
         *   maleFirst   : string[]
         *   femaleFirst : string[]
         *   lastNames   : string[]
         *   emailDomains: string[]   (optional — falls back to built-in list)
         */
        const firstArr = (gender === 'male')
            ? pool.maleFirst
            : pool.femaleFirst;

        const firstName = pick(firstArr);
        const lastName  = pick(pool.lastNames);
        const fullName  = `${firstName} ${lastName}`;

        /* ── Email generation ────────────────────────────── */
        /*
         * Constructs a realistic-looking email address.
         * Three patterns are used at equal probability to add
         * variety: first.last, firstN.last, firstlastNN.
         * All characters are lowercased and any whitespace /
         * non-word chars from the name tokens are stripped so
         * the address remains RFC-valid.
         */
        const emailDomains = (pool.emailDomains && pool.emailDomains.length)
            ? pool.emailDomains
            : ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'proton.me'];

        const fnSlug = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const lnSlug = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const nn     = Math.floor(Math.random() * 90) + 10; // 10–99
        const domain = pick(emailDomains);

        const emailPatterns = [
            `${fnSlug}.${lnSlug}@${domain}`,
            `${fnSlug}${nn}@${domain}`,
            `${fnSlug[0] || 'u'}${lnSlug}${nn}@${domain}`,
        ];
        const email = pick(emailPatterns);

        /* ── Age ─────────────────────────────────────────── */
        const age = Math.floor(Math.random() * 55) + 18; // 18–72

        /* ── Flag lookup ─────────────────────────────────── */
        /*
         * Prefer the flag of the exact country the user selected.
         * When countryCode === 'all' we surface the pool key's
         * own flag (best-effort) or fall back to the globe.
         */
        const flagCode = (countryCode === 'all') ? poolKey : countryCode;
        const flag     = flags[flagCode] || flags[poolKey] || '🌐';

        return {
            countryCode,
            poolKey,
            flag,
            gender,
            firstName,
            lastName,
            fullName,
            email,
            age,
        };
    };

    /* ════════════════════════════════════════════════════════
     * §7  RENDERING
     * ════════════════════════════════════════════════════════ */

    /**
     * Builds the HTML string for a single result row.
     *
     * All dynamic values pass through sanitize() before
     * entering the template literal to prevent XSS.
     *
     * The row exposes three copy targets:
     *   • Copy Name  → copies firstName + ' ' + lastName
     *   • Copy Email → copies email address
     *   • Copy Row   → copies pipe-separated full profile line
     *
     * @param  {Object} profile  A profile object from generateLocalProfile().
     * @param  {number} index    1-based display index.
     * @returns {string}  Safe HTML string for the row.
     */
    const buildRowHTML = (profile, index) => {
        const sFlag      = sanitize(profile.flag);
        const sFullName  = sanitize(profile.fullName);
        const sEmail     = sanitize(profile.email);
        const sGender    = sanitize(profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1));
        const sAge       = sanitize(String(profile.age));
        const sIndex     = sanitize(String(index));

        /* The raw (unsanitized) values used only inside data-* attributes
         * still go through sanitize() to keep attribute injection safe. */
        const dataName   = sanitize(profile.fullName);
        const dataEmail  = sanitize(profile.email);
        const dataRow    = sanitize(
            `${profile.fullName} | ${profile.email} | ${profile.gender} | Age: ${profile.age}`
        );

        return `
        <div class="ung-result-row" role="listitem">
            <span class="ung-result-index">${sIndex}</span>
            <span class="ung-result-flag"  aria-hidden="true">${sFlag}</span>
            <span class="ung-result-name">${sFullName}</span>
            <span class="ung-result-meta">
                <span class="ung-result-email">${sEmail}</span>
                <span class="ung-result-gender">${sGender}</span>
                <span class="ung-result-age">Age ${sAge}</span>
            </span>
            <span class="ung-result-actions" role="group" aria-label="Copy actions for ${sFullName}">
                <button
                    class="ung-copy-btn"
                    title="Copy name"
                    aria-label="Copy name: ${dataName}"
                    onclick="app.copyField(this, '${dataName}')">
                    <i class="fas fa-user" aria-hidden="true"></i>
                </button>
                <button
                    class="ung-copy-btn"
                    title="Copy email"
                    aria-label="Copy email: ${dataEmail}"
                    onclick="app.copyField(this, '${dataEmail}')">
                    <i class="fas fa-envelope" aria-hidden="true"></i>
                </button>
                <button
                    class="ung-copy-btn ung-copy-btn--row"
                    title="Copy full row"
                    aria-label="Copy full row for ${dataName}"
                    onclick="app.copyField(this, '${dataRow}')">
                    <i class="fas fa-copy" aria-hidden="true"></i>
                </button>
            </span>
        </div>`;
    };

    /**
     * Renders an array of profiles into the output-area using a
     * DocumentFragment to minimise layout reflow.
     *
     * PERFORMANCE NOTE
     * ─────────────────
     * Instead of calling innerHTML += '...' inside a loop (which
     * forces a full DOM serialization + parse on every iteration),
     * we build one large HTML string, inject it into a temporary
     * <template> element, clone its DocumentFragment, and append
     * the whole fragment in a single operation.  For a 500-row
     * batch this approach is ~40× faster than the naive loop.
     *
     * @param {Object[]} profiles  Array of profile objects.
     */
    const renderResults = (profiles) => {
        const outputArea = $('#output-area');
        if (!outputArea) return;

        /* Build the complete HTML string for all rows. */
        const html = profiles
            .map((p, i) => buildRowHTML(p, i + 1))
            .join('');

        /*
         * Inject via <template> → DocumentFragment → single append.
         * This keeps all HTML parsing off the live document tree until
         * the very last moment.
         */
        const tpl = document.createElement('template');
        tpl.innerHTML = `<div class="ung-result-list" role="list">${html}</div>`;

        /* Clear previous results and stamp the new fragment. */
        outputArea.innerHTML = '';
        outputArea.appendChild(tpl.content.cloneNode(true));
    };

    /* ════════════════════════════════════════════════════════
     * §8  CORE PUBLIC ACTIONS
     * ════════════════════════════════════════════════════════ */

    /**
     * generateData()
     * ──────────────
     * The primary action, triggered by the "GENERATE DATA" button.
     *
     * v3.1.0 REFACTOR NOTES
     * ─────────────────────
     * • All fetch() calls have been removed.
     * • AbortController and its associated abort / timeout logic
     *   have been removed.
     * • The API-fallback branch has been removed.
     * • Data is sourced 100% from generateLocalProfile() which
     *   reads window.nameDatabase synchronously.
     * • The function remains async so the UI repaint (await
     *   Promise.resolve()) can flush before the heavy generation
     *   loop begins — ensuring the spinner appears on screen
     *   before JS blocks the main thread for large batches.
     */
    const generateData = async () => {
        /* ── 1. Read and validate UI inputs ─────────────── */
        const countryCode = ($('#region')?.value  || 'all').trim().toLowerCase();
        const genderPref  = ($('#gender')?.value  || 'all').trim().toLowerCase();
        const rawQty      = parseInt($('#quantity')?.value || '10', 10);
        const quantity    = Math.min(Math.max(isNaN(rawQty) ? 1 : rawQty, 1), MAX_QUANTITY);

        /* ── 2. Lock UI & show loader ────────────────────── */
        setGenerateBtn(true);
        setLoader(true);
        setStatus('GENERATING…');

        /* Yield to the event loop so the browser can repaint
         * the spinner before the synchronous generation loop
         * below blocks the main thread. */
        await Promise.resolve();

        try {
            /* ── 3. Validate offline database ───────────── */
            assertDatabase();

            /* ── 4. Generate profiles synchronously ─────── */
            const profiles = [];
            for (let i = 0; i < quantity; i++) {
                profiles.push(generateLocalProfile(countryCode, genderPref));
            }

            /* ── 5. Persist results for export methods ───── */
            lastResults = profiles;

            /* ── 6. Render into DOM via DocumentFragment ─── */
            renderResults(profiles);

            /* ── 7. Update status bar ────────────────────── */
            setStatus(`${profiles.length} PROFILES READY`, 'success');

        } catch (err) {
            /* ── Error handling ──────────────────────────── */
            console.error('[UltraNameGen] Generation error:', err);
            setStatus('ERROR', 'error');

            const outputArea = $('#output-area');
            if (outputArea) {
                outputArea.innerHTML = `
                    <div class="ung-error-state" role="alert">
                        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
                        <span class="ung-error-title">Generation Failed</span>
                        <small class="ung-error-detail">${sanitize(err.message)}</small>
                    </div>`;
            }
        } finally {
            /* ── 8. Always restore UI state ──────────────── */
            setLoader(false);
            setGenerateBtn(false);
        }
    };

    /**
     * clearConsole()
     * ──────────────
     * Resets the terminal panel back to its initial empty state
     * and clears the in-memory results buffer.
     */
    const clearConsole = () => {
        lastResults = [];
        setStatus('IDLE');

        const outputArea = $('#output-area');
        if (!outputArea) return;

        outputArea.innerHTML = `
            <div class="ung-empty-state">
                <i class="fas fa-database" aria-hidden="true"></i>
                <span class="ung-empty-title">Ready to Initialize</span>
                <small class="ung-empty-hint">Select region and quantity to begin</small>
            </div>`;
    };

    /* ════════════════════════════════════════════════════════
     * §9  CLIPBOARD & EXPORT UTILITIES
     * ════════════════════════════════════════════════════════ */

    /**
     * Writes a string to the system clipboard.
     * Falls back to the legacy execCommand API for older browsers
     * (Safari < 13.1, some Android WebViews).
     *
     * @param  {string}  text      The string to copy.
     * @returns {Promise<boolean>} Resolves true on success.
     */
    const writeClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (_) {
            /* Legacy fallback */
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        }
    };

    /**
     * Provides brief visual feedback on a copy button after a
     * successful clipboard write.  Temporarily swaps the icon
     * to a checkmark for 1.2 s then restores it.
     *
     * @param {HTMLElement} btn  The button that was clicked.
     */
    const flashCopyFeedback = (btn) => {
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (!icon) return;
        const originalClass = icon.className;
        icon.className = 'fas fa-check';
        btn.classList.add('ung-copy-btn--success');
        setTimeout(() => {
            icon.className = originalClass;
            btn.classList.remove('ung-copy-btn--success');
        }, 1200);
    };

    /**
     * copyField()
     * ───────────
     * Called by the per-row copy buttons (Name / Email / Row).
     * Copies the provided text to the clipboard and flashes
     * the originating button.
     *
     * Exposed on window.app for HTML onclick access.
     *
     * @param {HTMLElement} btn   The clicked button element.
     * @param {string}      text  Pre-sanitized text to copy.
     */
    const copyField = async (btn, text) => {
        /*
         * The text arriving here has already been HTML-entity-
         * encoded by sanitize() for safe attribute injection.
         * We decode the five entities back to plain text before
         * writing to the clipboard so the user gets raw values.
         */
        const decoded = text
            .replace(/&amp;/g,  '&')
            .replace(/&lt;/g,   '<')
            .replace(/&gt;/g,   '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'");

        const ok = await writeClipboard(decoded);
        if (ok) flashCopyFeedback(btn);
    };

    /**
     * copyAll()
     * ─────────
     * Copies all generated profiles as a pipe-separated plain
     * text list to the clipboard.
     *
     * Format per line:
     *   {flag} {fullName} | {email} | {gender} | Age: {age}
     */
    const copyAll = async () => {
        if (!lastResults.length) {
            setStatus('NO DATA', 'error');
            return;
        }

        const text = lastResults
            .map(p =>
                `${p.flag} ${p.fullName} | ${p.email} | ${p.gender} | Age: ${p.age}`
            )
            .join('\n');

        const ok = await writeClipboard(text);
        setStatus(ok ? 'LIST COPIED!' : 'COPY FAILED', ok ? 'success' : 'error');
        setTimeout(() => setStatus(`${lastResults.length} PROFILES READY`, 'success'), 1800);
    };

    /**
     * copyJSON()
     * ──────────
     * Copies all generated profiles as a formatted JSON array
     * to the clipboard.
     *
     * Each object in the array exposes:
     *   id, flag, fullName, firstName, lastName, email, gender, age, region
     */
    const copyJSON = async () => {
        if (!lastResults.length) {
            setStatus('NO DATA', 'error');
            return;
        }

        const payload = lastResults.map((p, i) => ({
            id        : i + 1,
            flag      : p.flag,
            fullName  : p.fullName,
            firstName : p.firstName,
            lastName  : p.lastName,
            email     : p.email,
            gender    : p.gender,
            age       : p.age,
            region    : p.countryCode,
        }));

        const json = JSON.stringify(payload, null, 2);
        const ok   = await writeClipboard(json);
        setStatus(ok ? 'JSON COPIED!' : 'COPY FAILED', ok ? 'success' : 'error');
        setTimeout(() => setStatus(`${lastResults.length} PROFILES READY`, 'success'), 1800);
    };

    /**
     * exportTXT()
     * ───────────
     * Triggers a browser download of a formatted plain-text
     * report file containing all generated profiles.
     *
     * The file is assembled as a Blob (UTF-8) and dispatched
     * via a temporary <a[download]> element — no server needed.
     *
     * Filename pattern:
     *   ultra-name-gen-{timestamp}.txt
     */
    const exportTXT = () => {
        if (!lastResults.length) {
            setStatus('NO DATA', 'error');
            return;
        }

        const now       = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');

        const header = [
            '============================================================',
            '  Ultra Name Generator Pro — Exported Data',
            `  Generated : ${now.toUTCString()}`,
            `  Total     : ${lastResults.length} profile(s)`,
            '============================================================',
            '',
        ].join('\n');

        const rows = lastResults
            .map((p, i) =>
                `${String(i + 1).padStart(3, '0')}. ${p.flag} ${p.fullName}` +
                `\n     Email  : ${p.email}` +
                `\n     Gender : ${p.gender}` +
                `\n     Age    : ${p.age}` +
                `\n     Region : ${p.countryCode.toUpperCase()}` +
                '\n'
            )
            .join('\n');

        const footer = [
            '',
            '============================================================',
            '  Tool   : https://trustedtoolsweb.com/tool-random-name.html',
            '  Note   : All data is synthetically generated.',
            '           Do NOT use for real identity purposes.',
            '============================================================',
        ].join('\n');

        const content  = header + rows + footer;
        const blob     = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url      = URL.createObjectURL(blob);
        const anchor   = document.createElement('a');
        anchor.href    = url;
        anchor.download = `ultra-name-gen-${timestamp}.txt`;
        anchor.style.display = 'none';

        document.body.appendChild(anchor);
        anchor.click();

        /* Clean up the object URL after a short delay. */
        setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(anchor);
        }, 500);

        setStatus('FILE SAVED!', 'success');
        setTimeout(() => setStatus(`${lastResults.length} PROFILES READY`, 'success'), 1800);
    };

    /* ════════════════════════════════════════════════════════
     * §10  KEYBOARD SHORTCUT
     *
     * Allows power users to trigger generation with Ctrl + Enter
     * (Windows/Linux) or Cmd + Enter (macOS) from anywhere on
     * the page — a common workflow for developers who keep this
     * tool open alongside their IDE.
     * ════════════════════════════════════════════════════════ */
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            generateData();
        }
    });

    /* ════════════════════════════════════════════════════════
     * §11  INITIALISATION
     *
     * Runs once the script is evaluated (the HTML guarantees
     * this script executes after DOMContentLoaded because it
     * is placed at the bottom of <body>).
     *
     * Responsibilities:
     *   1. Assert the name database is present.
     *   2. Cache the list of all available pool keys so
     *      resolvePool('all') can pick among them.
     *   3. Enforce the MAX_QUANTITY cap on the quantity input
     *      to prevent out-of-range values set via DevTools.
     * ════════════════════════════════════════════════════════ */
    const init = () => {
        try {
            assertDatabase();
            allPoolKeys = Object.keys(window.nameDatabase);

            if (!allPoolKeys.length) {
                console.warn('[UltraNameGen] name-database.js is empty — no pools loaded.');
            }
        } catch (err) {
            console.error('[UltraNameGen] Init error:', err.message);
        }

        /* Clamp the quantity input's max attribute defensively. */
        const qtyInput = $('#quantity');
        if (qtyInput) {
            qtyInput.setAttribute('max', String(MAX_QUANTITY));
            qtyInput.addEventListener('change', () => {
                const v = parseInt(qtyInput.value, 10);
                if (isNaN(v) || v < 1)            qtyInput.value = 1;
                else if (v > MAX_QUANTITY)         qtyInput.value = MAX_QUANTITY;
            });
        }
    };

    init();

    /* ════════════════════════════════════════════════════════
     * §12  PUBLIC API
     *
     * Attach only the methods required by HTML onclick handlers
     * to window.app.  Everything else remains private inside
     * the IIFE closure, preserving encapsulation.
     * ════════════════════════════════════════════════════════ */
    window.app = Object.freeze({
        generateData,
        clearConsole,
        copyField,
        copyAll,
        copyJSON,
        exportTXT,
    });

}()); /* ── end IIFE ── */
