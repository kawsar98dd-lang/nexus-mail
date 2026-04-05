/**
 * ============================================================
 *  GLOBAL GST/VAT MASTER — COMMERCIAL EDITION v2.0
 * ============================================================
 *  File        : script.js
 *  Tool        : GST/VAT Calculator & Invoice Generator
 *  Project     : Trusted Tools Web by MD KAWSAR
 *  Architecture: Class-based JS module for namespace isolation.
 *                Instantiated as window.taxApp on DOMContentLoaded.
 *
 *  Key Features:
 *    - Real-time tax calculation (Exclusive & Inclusive modes)
 *    - 15+ country/jurisdiction presets with currency formatting
 *    - PDF Invoice export via html2pdf.js
 *    - Clipboard copy of tax summary
 *    - Skeleton loader UX during calculation delay
 *    - Global toast notification system (uses #toast-box)
 *    - Comma-masked amount input for better readability
 *
 *  Privacy: 100% client-side. No data ever leaves the browser.
 * ============================================================
 */


/* ============================================================
   SECTION 1: COUNTRY / JURISDICTION CONFIGURATION
   ============================================================
   Each entry maps a jurisdiction to:
     - code     : Unique country key (matches <option value>)
     - name     : Display name shown in the dropdown
     - rate     : Default standard tax rate (%)
     - currency : ISO 4217 currency code for Intl.NumberFormat
     - symbol   : Display symbol (may differ from browser default)
     - locale   : BCP 47 locale string for number formatting
   ============================================================ */
const COUNTRY_CONFIG = [
    { code: 'custom', name: '🌍 Custom Region (Manual Rate)', rate: 0,    currency: 'USD', symbol: '$',   locale: 'en-US' },
    { code: 'BD',     name: '🇧🇩 Bangladesh (VAT)',           rate: 15,   currency: 'BDT', symbol: '৳',   locale: 'en-BD' },
    { code: 'US',     name: '🇺🇸 United States (Sales Tax)',  rate: 8.25, currency: 'USD', symbol: '$',   locale: 'en-US' },
    { code: 'IN',     name: '🇮🇳 India (GST)',                rate: 18,   currency: 'INR', symbol: '₹',   locale: 'en-IN' },
    { code: 'GB',     name: '🇬🇧 United Kingdom (VAT)',       rate: 20,   currency: 'GBP', symbol: '£',   locale: 'en-GB' },
    { code: 'CA',     name: '🇨🇦 Canada (HST/GST)',           rate: 13,   currency: 'CAD', symbol: 'C$',  locale: 'en-CA' },
    { code: 'AU',     name: '🇦🇺 Australia (GST)',            rate: 10,   currency: 'AUD', symbol: 'A$',  locale: 'en-AU' },
    { code: 'AE',     name: '🇦🇪 UAE (VAT)',                  rate: 5,    currency: 'AED', symbol: 'AED', locale: 'en-AE' },
    { code: 'DE',     name: '🇩🇪 Germany (VAT)',              rate: 19,   currency: 'EUR', symbol: '€',   locale: 'de-DE' },
    { code: 'FR',     name: '🇫🇷 France (VAT)',               rate: 20,   currency: 'EUR', symbol: '€',   locale: 'fr-FR' },
    { code: 'JP',     name: '🇯🇵 Japan (Consumption)',        rate: 10,   currency: 'JPY', symbol: '¥',   locale: 'ja-JP' },
    { code: 'SG',     name: '🇸🇬 Singapore (GST)',            rate: 9,    currency: 'SGD', symbol: 'S$',  locale: 'en-SG' },
    { code: 'MY',     name: '🇲🇾 Malaysia (SST)',             rate: 6,    currency: 'MYR', symbol: 'RM',  locale: 'en-MY' },
    { code: 'SA',     name: '🇸🇦 Saudi Arabia (VAT)',         rate: 15,   currency: 'SAR', symbol: 'SAR', locale: 'ar-SA' },
    { code: 'BR',     name: '🇧🇷 Brazil (ICMS)',              rate: 17,   currency: 'BRL', symbol: 'R$',  locale: 'pt-BR' },
    { code: 'ZA',     name: '🇿🇦 South Africa (VAT)',         rate: 15,   currency: 'ZAR', symbol: 'R',   locale: 'en-ZA' }
];


/* ============================================================
   SECTION 2: TAX MASTER APPLICATION CLASS
   ============================================================
   All tool logic is encapsulated inside TaxMasterUltra to
   prevent global namespace pollution. The instance is exposed
   as window.taxApp so inline onclick handlers in HTML can
   reach public methods (copyToClipboard, openInvoiceModal,
   closeModal, downloadPDF).
   ============================================================ */
class TaxMasterUltra {

    constructor() {
        /* ── Application State ── */
        this.currentLocale   = 'en-US';   // Active locale for Intl.NumberFormat
        this.currentCurrency = 'USD';     // Active ISO 4217 currency code
        this.currentSymbol   = '$';       // Active display currency symbol
        this.isInclusive     = false;     // Tax mode: false = Exclusive, true = Inclusive
        this.lastResult      = null;      // Stores last calculated result object

        /* ── DOM Element Cache (populated in _cacheDom) ── */
        this.dom = {};

        /* Boot the application */
        this.init();
    }

    /* ----------------------------------------------------------
       INITIALIZATION
       Entry point — called from constructor. Sequences all
       setup steps in the correct order.
    ---------------------------------------------------------- */
    init() {
        this._cacheDom();             // Step 1: Cache all DOM references
        this._populateCountries();    // Step 2: Build the country dropdown
        this._attachListeners();      // Step 3: Bind all event handlers
        this._updateCountryConfig();  // Step 4: Apply default jurisdiction settings
        console.info('[TaxMaster] Engine initialized and ready.');
    }

    /* ----------------------------------------------------------
       DOM CACHING
       Centralises all getElementById calls so the rest of the
       class can use this.dom.* without repeated DOM queries.
       IDs must exactly match those in index.html.
    ---------------------------------------------------------- */
    _cacheDom() {
        this.dom = {
            /* ── Input Controls ── */
            countrySelect  : document.getElementById('countrySelect'),
            taxRateInput   : document.getElementById('taxRateInput'),
            amountInput    : document.getElementById('amountInput'),
            taxToggle      : document.getElementById('taxToggle'),

            /* ── Action Buttons ── */
            btnCalculate   : document.getElementById('btnCalculate'),
            btnReset       : document.getElementById('btnReset'),

            /* ── UX Feedback Elements ── */
            resultBox      : document.getElementById('resultBox'),
            skeleton       : document.getElementById('skeletonLoader'),

            /* ── Toggle Mode Labels ── */
            lblExc         : document.getElementById('lblExc'),
            lblInc         : document.getElementById('lblInc'),

            /* ── Result Output Fields ── */
            resNet         : document.getElementById('resNet'),
            resTax         : document.getElementById('resTax'),
            resTotal       : document.getElementById('resTotal'),
            resRateDisplay : document.getElementById('resRateDisplay'),

            /* ── Invoice Modal & Toast ── */
            modal          : document.getElementById('invoiceModal'),
            toastBox       : document.getElementById('toast-box')
        };
    }

    /* ----------------------------------------------------------
       POPULATE COUNTRY DROPDOWN
       Reads COUNTRY_CONFIG and generates <option> elements.
       data-* attributes store rate, symbol, currency, locale
       so _updateCountryConfig() can read them on selection.
    ---------------------------------------------------------- */
    _populateCountries() {
        this.dom.countrySelect.innerHTML = COUNTRY_CONFIG.map(c =>
            `<option value="${c.code}" data-rate="${c.rate}" data-sym="${c.symbol}" data-cur="${c.currency}" data-loc="${c.locale}">${c.name}</option>`
        ).join('');
    }

    /* ----------------------------------------------------------
       EVENT LISTENERS SETUP
       All event bindings are centralised here for clarity and
       easy maintenance. No inline JS in HTML (except public
       method calls on onclick which require window.taxApp).
    ---------------------------------------------------------- */
    _attachListeners() {
        /* Jurisdiction change: auto-fill rate and update currency state */
        this.dom.countrySelect.addEventListener('change', () => this._updateCountryConfig());

        /* Thousands-comma input masking on the amount field */
        this.dom.amountInput.addEventListener('input', (e) => this._handleInputMask(e));

        /* Enter key on amount field triggers calculation immediately */
        this.dom.amountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._triggerCalculation();
        });

        /* Toggle switch: Exclusive ↔ Inclusive mode switch */
        this.dom.taxToggle.addEventListener('change', (e) => {
            this.isInclusive = e.target.checked;

            /* Update ARIA state for screen readers */
            e.target.setAttribute('aria-checked', String(this.isInclusive));

            /* Highlight the active mode label */
            this.dom.lblExc.classList.toggle('active', !this.isInclusive);
            this.dom.lblInc.classList.toggle('active',  this.isInclusive);

            /* Instantly recalculate if a result is already on screen */
            if (this.dom.resultBox.style.display === 'block') {
                this._triggerCalculation(false);
            }
        });

        /* Primary CTA: Calculate — uses skeleton loader */
        this.dom.btnCalculate.addEventListener('click', () => this._triggerCalculation(true));

        /* Reset button: Clear all fields and hide results */
        this.dom.btnReset.addEventListener('click', () => this._resetApp());
    }

    /* ----------------------------------------------------------
       INPUT MASKING
       Applies comma-separated thousands formatting to the amount
       field in real time (e.g. 1000000 → 1,000,000).
       Strips non-numeric characters and limits to one decimal point.
       Also removes any existing input-error highlight on typing.
       @param {Event} e - The input event from amountInput
    ---------------------------------------------------------- */
    _handleInputMask(e) {
        /* Clear validation error state as user starts re-typing */
        this.dom.amountInput.classList.remove('input-error');

        /* Strip everything except digits and a single decimal point */
        let val = e.target.value.replace(/[^0-9.]/g, '');

        /* Prevent multiple decimal points */
        if ((val.match(/\./g) || []).length > 1) {
            val = val.replace(/\.+$/, '');
        }

        /* Re-insert thousands separators in the integer part only */
        const parts = val.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        e.target.value = parts.join('.');
    }

    /* ----------------------------------------------------------
       UPDATE COUNTRY / JURISDICTION CONFIG
       Reads data-* attributes from the currently selected
       <option> and updates application state for currency
       formatting. Also pre-fills the tax rate input.
    ---------------------------------------------------------- */
    _updateCountryConfig() {
        const opt = this.dom.countrySelect.options[this.dom.countrySelect.selectedIndex];
        this.dom.taxRateInput.value = opt.getAttribute('data-rate');
        this.currentSymbol          = opt.getAttribute('data-sym');
        this.currentCurrency        = opt.getAttribute('data-cur');
        this.currentLocale          = opt.getAttribute('data-loc');
    }

    /* ----------------------------------------------------------
       UTILITY: Strip commas and parse to float
       Used before all arithmetic to get the raw numeric value
       from the comma-masked input string.
       @param  {string} val - Potentially comma-formatted number string
       @return {number}       Parsed float value
    ---------------------------------------------------------- */
    _getRawNumber(val) {
        return parseFloat(String(val).replace(/,/g, ''));
    }

    /* ----------------------------------------------------------
       CURRENCY FORMATTING
       Uses native Intl.NumberFormat with the correct ISO 4217
       currency code from COUNTRY_CONFIG, then replaces the
       default browser symbol with our custom display symbol to
       handle non-standard codes (e.g. BDT → ৳, CAD "CA$" → "C$").
       Falls back to manual symbol + toFixed(2) for unsupported locales.
       @param  {number} num - The numeric value to format
       @return {string}       Formatted currency string (e.g. "$1,234.56")
    ---------------------------------------------------------- */
    _formatCurrency(num) {
        try {
            /* Format using the browser's Intl engine */
            const formatted = new Intl.NumberFormat(this.currentLocale, {
                style                : 'currency',
                currency             : this.currentCurrency,
                currencyDisplay      : 'symbol',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(num);

            /*
             * Detect the browser-native symbol so we can swap it.
             * Example: CAD locale renders "CA$1,000.00" but we want "C$1,000.00".
             */
            const nativeSymbol = new Intl.NumberFormat(this.currentLocale, {
                style: 'currency', currency: this.currentCurrency, currencyDisplay: 'symbol'
            }).formatToParts(0).find(p => p.type === 'currency');

            if (nativeSymbol && nativeSymbol.value !== this.currentSymbol) {
                return formatted.replace(nativeSymbol.value, this.currentSymbol);
            }
            return formatted;

        } catch (err) {
            /* Graceful fallback for unsupported locales / currencies */
            return `${this.currentSymbol}${num.toFixed(2)}`;
        }
    }

    /* ----------------------------------------------------------
       CALCULATION TRIGGER
       Validates inputs, optionally shows the skeleton loader
       for a premium UX feel, then delegates to _calculate().
       @param {boolean} showLoader - true = show skeleton animation (default)
                                     false = instant update (used by toggle switch)
    ---------------------------------------------------------- */
    _triggerCalculation(showLoader = true) {
        const amountStr = this.dom.amountInput.value;
        const rateStr   = this.dom.taxRateInput.value;
        const amount    = this._getRawNumber(amountStr);
        const rate      = parseFloat(rateStr);

        /* ── Input Validation ── */
        if (!amountStr || isNaN(amount) || amount <= 0) {
            this._showToast('Please enter a valid amount!', 'error');
            this.dom.amountInput.classList.add('input-error');
            this.dom.amountInput.focus();
            return;
        }

        if (showLoader) {
            /* Show skeleton and hide any previous results for premium UX */
            this.dom.resultBox.style.display = 'none';
            this.dom.skeleton.style.display  = 'block';
            this.dom.skeleton.setAttribute('aria-hidden', 'false');

            /* Delay calculation slightly to let the skeleton animate */
            setTimeout(() => {
                this._calculate(amount, rate);
                this.dom.skeleton.style.display  = 'none';
                this.dom.skeleton.setAttribute('aria-hidden', 'true');
                this.dom.resultBox.style.display = 'block';
                /* Smooth scroll to bring the result into view */
                this.dom.resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                this._showToast('Calculation Complete!', 'success');
            }, 600);

        } else {
            /* Instant update path — used when the toggle switch changes */
            this._calculate(amount, rate);
        }
    }

    /* ----------------------------------------------------------
       MATHEMATICAL ENGINE
       Core formula for both tax modes:

       EXCLUSIVE (tax added on top of the base amount):
         Tax   = Net × (Rate / 100)
         Total = Net + Tax

       INCLUSIVE (tax extracted from a gross/total amount):
         Net   = Total ÷ (1 + Rate / 100)
         Tax   = Total − Net

       Results are stored in this.lastResult for invoice
       generation and clipboard copy access.
       @param {number} amount - Raw transaction amount
       @param {number} rate   - Tax rate percentage
    ---------------------------------------------------------- */
    _calculate(amount, rate) {
        let net, tax, total;

        if (this.isInclusive) {
            /* --- INCLUSIVE FORMULA (Reverse GST) ---
               The entered amount is already the gross total.
               We reverse-calculate the net base and the embedded tax.
            */
            total = amount;
            net   = amount / (1 + (rate / 100));
            tax   = total - net;
        } else {
            /* --- EXCLUSIVE FORMULA (Standard) ---
               The entered amount is the net price before tax.
               Tax is calculated and added on top.
            */
            net   = amount;
            tax   = amount * (rate / 100);
            total = net + tax;
        }

        /* ── Render Results to the DOM ── */
        this.dom.resNet.innerText         = this._formatCurrency(net);
        this.dom.resTax.innerText         = this._formatCurrency(tax);
        this.dom.resTotal.innerText       = this._formatCurrency(total);
        this.dom.resRateDisplay.innerText = rate;

        /* ── Persist result for invoice and clipboard ── */
        this.lastResult = { net, tax, total, rate, date: new Date() };
    }

    /* ----------------------------------------------------------
       RESET APPLICATION
       Clears the amount input, hides the result box,
       removes any validation error states, and shows a toast.
    ---------------------------------------------------------- */
    _resetApp() {
        this.dom.amountInput.value       = '';
        this.dom.resultBox.style.display = 'none';
        this.dom.amountInput.classList.remove('input-error');
        this.lastResult = null;
        this._showToast('Calculator Reset', 'success');
    }

    /* ----------------------------------------------------------
       TOAST NOTIFICATION SYSTEM
       Appends a styled toast element to the global #toast-box
       container (defined in global.css). Animates in using CSS,
       then fades out and removes itself after 3 seconds.
       Uses the existing global #toast-box — no new system built.
       @param {string} msg  - The message text to display
       @param {string} type - 'success' (green) | 'error' (red)
    ---------------------------------------------------------- */
    _showToast(msg, type = 'success') {
        const toast = document.createElement('div');

        /* Choose icon based on type */
        const icon = type === 'error'
            ? '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>'
            : '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>';

        toast.className  = `toast ${type}`;
        toast.innerHTML  = `${icon} <span>${msg}</span>`;
        toast.setAttribute('role', 'alert');

        /* Append to the global toast container */
        this.dom.toastBox.appendChild(toast);

        /* Trigger slide-in animation on next frame */
        requestAnimationFrame(() => {
            toast.style.opacity   = '1';
            toast.style.transform = 'translateX(0)';
        });

        /* Fade out and auto-remove after 3 seconds */
        setTimeout(() => {
            toast.style.opacity   = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    /* ----------------------------------------------------------
       CLIPBOARD COPY  (Public — called via onclick in HTML)
       Copies the formatted tax summary to the user's clipboard.
       Requires a prior calculation (this.lastResult must be set).
    ---------------------------------------------------------- */
    copyToClipboard() {
        /* Guard: ensure a calculation has been performed first */
        if (!this.lastResult) return;

        /* Build the plain-text summary string */
        const text = [
            'GST/VAT Calculation:',
            `Base:  ${this.dom.resNet.innerText}`,
            `Tax:   ${this.dom.resTax.innerText}`,
            `Total: ${this.dom.resTotal.innerText}`
        ].join('\n');

        navigator.clipboard.writeText(text)
            .then(() => this._showToast('Copied to Clipboard!', 'success'))
            .catch(() => this._showToast('Copy failed. Please try manually.', 'error'));
    }

    /* ----------------------------------------------------------
       INVOICE ID GENERATOR
       Auto-increments an invoice counter stored in localStorage.
       Starts from INV-1001 and increases on each invocation.
       @return {string} - Formatted invoice ID, e.g. "INV-1042"
    ---------------------------------------------------------- */
    _getInvoiceID() {
        let id = parseInt(localStorage.getItem('ultra_invoice_id') || '1000', 10) + 1;
        localStorage.setItem('ultra_invoice_id', id);
        return `INV-${id}`;
    }

    /* ----------------------------------------------------------
       OPEN INVOICE MODAL  (Public — called via onclick in HTML)
       Populates all invoice data fields from this.lastResult,
       then displays the modal overlay.
       Guards against opening without a calculation result.
    ---------------------------------------------------------- */
    openInvoiceModal() {
        /* Guard: cannot generate invoice without a prior calculation */
        if (!this.lastResult) {
            this._showToast('Calculate tax first!', 'error');
            return;
        }

        /* ── Populate Invoice Fields ── */
        document.getElementById('invId').innerText    = this._getInvoiceID();
        document.getElementById('invDate').innerText  = this.lastResult.date.toLocaleDateString(
            this.currentLocale,
            { year: 'numeric', month: 'long', day: 'numeric' }
        );
        document.getElementById('invBase').innerText  = this._formatCurrency(this.lastResult.net);
        document.getElementById('invRate').innerText  = `${this.lastResult.rate}%`;
        document.getElementById('invTax').innerText   = this._formatCurrency(this.lastResult.tax);
        document.getElementById('invTotal').innerText = this._formatCurrency(this.lastResult.total);

        /* ── Show Modal & Lock Background Scroll ── */
        this.dom.modal.style.display  = 'flex';
        document.body.style.overflow  = 'hidden';
    }

    /* ----------------------------------------------------------
       CLOSE INVOICE MODAL  (Public — called via onclick in HTML)
       Hides the modal and restores page scroll behaviour.
    ---------------------------------------------------------- */
    closeModal() {
        this.dom.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    /* ----------------------------------------------------------
       PDF GENERATION ENGINE  (Public — called via onclick in HTML)
       Uses html2pdf.js to render the #invoiceContent element
       as a high-quality A4 PDF and triggers a browser download.

       Key settings explained:
         - scale: 2     → 2× resolution for crisp text/graphics
         - scrollY: 0   → Prevents modal scroll offset misalignment
         - windowWidth  → Forces consistent 800px viewport for mobile
         - backgroundColor → White background prevents blank exports
    ---------------------------------------------------------- */
    downloadPDF() {
        const element   = document.getElementById('invoiceContent');
        const invoiceId = document.getElementById('invId').innerText || 'Invoice';

        /* ── html2pdf Configuration ── */
        const options = {
            margin   : 0.3,                            // Small margin around the paper (inches)
            filename : `${invoiceId}.pdf`,             // Descriptive filename for download
            image    : { type: 'jpeg', quality: 0.98 },// High-quality image rendering
            html2canvas: {
                scale           : 2,                   // 2× DPI for sharp output
                useCORS         : true,                // Allow cross-origin images (e.g. logo)
                letterRendering : true,                // Better font rendering
                scrollY         : 0,                   // Fix modal vertical offset issue
                windowWidth     : 800,                 // Consistent viewport prevents mobile layout shift
                backgroundColor : '#ffffff'            // Explicit white BG — prevents blank/transparent page
            },
            jsPDF: {
                unit        : 'in',
                format      : 'a4',
                orientation : 'portrait'
            }
        };

        this._showToast('Generating PDF...', 'success');

        /* ── Execute Export Chain ── */
        html2pdf()
            .set(options)
            .from(element)
            .save()
            .then(() => {
                this._showToast('Invoice Downloaded!', 'success');
            })
            .catch(err => {
                console.error('[TaxMaster Error] PDF generation failed:', err);
                this._showToast('PDF Export Failed. Use Print instead.', 'error');
            });
    }

} /* end class TaxMasterUltra */


/* ============================================================
   SECTION 3: BOOTSTRAP
   ============================================================
   Instantiate the app after the DOM is fully parsed.
   Exposed as window.taxApp so HTML inline onclick handlers
   (copyToClipboard, openInvoiceModal, closeModal, downloadPDF)
   can call the public methods directly.
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    window.taxApp = new TaxMasterUltra();
});
