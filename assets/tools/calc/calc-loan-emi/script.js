/**
 * =============================================================================
 *  SMART EMI CALCULATOR — ULTRA PRO MAX
 *  script.js — Tool Logic (External, Strict Separation of Concerns)
 * =============================================================================
 *  Version : 3.6 (CodeCanyon Release Build)
 *  Author  : MD KAWSAR
 *  License : Standard CodeCanyon License
 *  Project : Trusted Tools Web
 *
 *  Changelog v3.6:
 *  - Fixed Chart.js color rendering (CSS variable resolution)
 *  - Added dynamic theme-aware chart color updates
 *  - Improved legend readability for dark/light mode
 *
 *  ARCHITECTURE NOTES:
 *  - All DOM IDs referenced here must remain UNCHANGED in index.html
 *  - Uses the global #toastArea element for notifications (no custom toast)
 *  - Exports: refreshChartTheme() for global.js themeChanged event
 * =============================================================================
 */

'use strict';

// ---------------------------------------------------------------------------
//  APP CONFIGURATION
//  Central state object shared across all functions.
//  currency: active currency code ('BDT' or 'USD')
//  symbol:   active currency symbol ('৳' or '$')
//  chartInstance: reference to the active Chart.js doughnut chart
//  isCalculating: re-entrancy guard for the calculation engine
// ---------------------------------------------------------------------------
const appConfig = {
    currency       : 'BDT',
    symbol         : '৳',
    chartInstance  : null,
    isCalculating  : false
};


// ---------------------------------------------------------------------------
//  DOM READY — INITIALIZER
//  Runs once when the page fully loads.
//  Order: chart first (canvas must exist) → theme → initial calculation.
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initChart();       // Set up Chart.js doughnut canvas (#loanChart)
    loadTheme();       // Apply saved theme and sync chart colors
    calculateUltra();  // Run initial calculation with default values
});


// ---------------------------------------------------------------------------
//  SYNC
//  Keeps a text/number input and its paired range slider in sync.
//  Called via oninput handlers in HTML (e.g., oninput="sync('loanAmount','rangeAmount')").
//
//  @param {string} src  — ID of the element that was just changed
//  @param {string} dest — ID of the paired element to update
// ---------------------------------------------------------------------------
let debounceTimer; // Shared debounce timer to prevent calculation spam

function sync(src, dest) {
    const sourceElement = document.getElementById(src);
    const destElement   = document.getElementById(dest);
    if (!sourceElement || !destElement) return;

    // Parse value and clamp negatives to zero
    let val = parseFloat(sourceElement.value) || 0;
    if (val < 0) val = 0;

    destElement.value = val;
    updateDisplayLabels(src, val); // Refresh the live display badge

    // Debounce: wait 50ms after last input before recalculating
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => calculateUltra(), 50);
}


// ---------------------------------------------------------------------------
//  UPDATE DISPLAY LABELS
//  Refreshes the highlighted live-value badge next to each input label.
//  Targets: #disp-amt | #disp-rate | #disp-year
//
//  @param {string} src — Source element ID (used to determine which badge to update)
//  @param {number} val — The new numeric value to display
// ---------------------------------------------------------------------------
function updateDisplayLabels(src, val) {
    // Helper: format number with locale-based thousand separators
    const fmt = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 0 });

    if (src.includes('Amount')) {
        const el = document.getElementById('disp-amt');
        if (el) el.innerText = fmt(val);
    }
    if (src.includes('Rate')) {
        const el = document.getElementById('disp-rate');
        if (el) el.innerText = val + '%';
    }
    if (src.includes('Tenure')) {
        const el = document.getElementById('disp-year');
        if (el) el.innerText = val + ' Years';
    }
}


// ---------------------------------------------------------------------------
//  SWITCH MODE (Tab Navigation Handler)
//  Activates the correct tab button and shows/hides the corresponding
//  panel sections for Standard, Advanced Pro, and Affordability AI modes.
//
//  @param {string} mode — One of: 'standard' | 'advanced' | 'afford'
// ---------------------------------------------------------------------------
function switchMode(mode) {
    // Deactivate all tab buttons; activate only the matching one
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
        if (btn.id === 'tab-' + mode) {
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
        }
    });

    // Show/hide the advanced pro and affordability panels
    const advanced = document.getElementById('advanced-features');
    const afford   = document.getElementById('afford-features');
    if (advanced) advanced.classList.toggle('hidden', mode !== 'advanced');
    if (afford)   afford.classList.toggle('hidden',   mode !== 'afford');

    // Recalculate immediately after mode switch
    calculateUltra();
}


// ---------------------------------------------------------------------------
//  CALCULATE ULTRA — MAIN CALCULATION ENGINE
//  Performs the full EMI calculation including:
//    - Standard EMI formula
//    - Moratorium (interest-only) period adjustment
//    - Pre-payment (extra EMI) amortization simulation
//    - Tax saving badge logic
//  Updates: #emiValue | #totalInterest | #totalPayment | #taxBadge | chart | table
// ---------------------------------------------------------------------------
function calculateUltra() {
    // Re-entrancy guard: prevent overlapping calculations
    if (appConfig.isCalculating) return;
    appConfig.isCalculating = true;

    try {
        // Helper: safely read a numeric value from a DOM element by ID
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? Math.abs(parseFloat(el.value)) || 0 : 0;
        };

        let P     = getVal('loanAmount');    // Principal amount
        let R     = getVal('interestRate');   // Annual interest rate (%)
        let N     = getVal('loanTenure');     // Tenure in years
        let extra = getVal('extraEMI');       // Monthly pre-payment amount
        let morat = getVal('moratorium');     // Moratorium period in months

        // Input validation: all core values must be positive
        if (P <= 0 || R <= 0 || N <= 0) {
            resetResults();
            appConfig.isCalculating = false;
            return;
        }

        // Convert annual rate to monthly rate, and years to months
        let r = R / 12 / 100; // Monthly interest rate (decimal)
        let n = N * 12;       // Total loan months

        // ── Moratorium Adjustment ──
        // During moratorium, only interest is charged and added to principal.
        let p_real       = P;
        let morat_interest = 0;
        if (morat > 0) {
            morat_interest = P * r * morat;
            p_real += morat_interest; // Inflate principal by accumulated moratorium interest
        }

        // ── Standard EMI Formula: EMI = P × r × (1+r)^n / ((1+r)^n - 1) ──
        let emi = (p_real * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        if (!isFinite(emi)) emi = 0;

        // ── Amortization Simulation Loop ──
        // Simulates month-by-month reduction of balance including extra payments.
        let totalInterest = morat_interest;
        let balance       = p_real;
        let actualMonths  = 0;
        const maxLoop     = 720; // Safety cap: max 60 years

        while (balance > 1 && actualMonths < maxLoop) {
            let interest  = balance * r;
            let principal = (emi + extra) - interest;

            // Handle final partial month
            if (balance < principal) {
                principal = balance;
                interest  = balance * r;
                balance   = 0;
            } else {
                balance -= principal;
            }

            totalInterest += interest;
            actualMonths++;
        }

        // Write results to the DOM
        updateUI(emi, totalInterest, P);
        updateChart(P, totalInterest);
        generateTable(p_real, r, emi + extra, actualMonths);

        // ── Tax Saving Badge Logic ──
        // Show badge when loan is large (home loan range) and tenure >= 10 years.
        // Threshold: 2.5M BDT (~30K USD) — typical home loan territory.
        const taxThreshold = appConfig.currency === 'BDT' ? 2500000 : 30000;
        const taxBadge     = document.getElementById('taxBadge');
        if (taxBadge) {
            taxBadge.style.display = (P > taxThreshold && N >= 10) ? 'block' : 'none';
        }

    } catch (e) {
        console.error('EMI Calculation Error:', e);
    } finally {
        // Always release the lock regardless of success or failure
        appConfig.isCalculating = false;
    }
}


// ---------------------------------------------------------------------------
//  RESET RESULTS
//  Clears all result displays when inputs are invalid (e.g., zero values).
// ---------------------------------------------------------------------------
function resetResults() {
    ['emiValue', 'totalInterest', 'totalPayment'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = appConfig.symbol + ' 0';
    });
    updateChart(0, 0); // Reset chart to empty state
}


// ---------------------------------------------------------------------------
//  UPDATE UI
//  Formats and writes the three key result values to their DOM targets.
//
//  @param {number} emi           — Calculated monthly EMI
//  @param {number} totalInterest — Total interest paid over loan life
//  @param {number} P             — Original principal amount
// ---------------------------------------------------------------------------
function updateUI(emi, totalInterest, P) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        // Format: currency symbol + space + rounded integer with locale commas
        if (el) el.innerText = appConfig.symbol + ' ' + Math.round(val).toLocaleString();
    };
    set('emiValue',      emi);
    set('totalInterest', totalInterest);
    set('totalPayment',  P + totalInterest); // Grand total = Principal + Interest
}


// ---------------------------------------------------------------------------
//  CHART.JS VISUALIZATION
// ---------------------------------------------------------------------------

/**
 * GET CHART COLORS
 * Resolves chart colors from the active CSS theme at runtime.
 * This ensures the chart always matches the current dark/light mode.
 * Falls back to hardcoded hex values if CSS variables are unavailable.
 *
 * @returns {Object} Color configuration object for Chart.js
 */
function getChartColors() {
    const styles  = getComputedStyle(document.documentElement);
    const isLight = document.body.classList.contains('light-mode');

    // Read brand colors from active CSS theme
    const rawPrimary = styles.getPropertyValue('--brand-primary').trim();
    const rawAccent  = styles.getPropertyValue('--accent-purple').trim();

    // Fallback to hardcoded values if CSS variables fail to resolve
    const primary = rawPrimary || '#ff0055';
    const accent  = rawAccent  || '#d124ff';

    // Tooltip and legend colors adapt to active theme for readability
    const legendColor  = isLight ? '#636e72'                 : '#8b949e';
    const tooltipBg    = isLight ? 'rgba(255,255,255,0.95)'  : 'rgba(13,17,23,0.95)';
    const tooltipTitle = isLight ? '#2c3e50'                 : primary;
    const tooltipBody  = isLight ? '#636e72'                 : '#8b949e';

    return { primary, accent, legendColor, tooltipBg, tooltipTitle, tooltipBody };
}


/**
 * INIT CHART
 * Creates the Chart.js doughnut instance on the #loanChart canvas.
 * Called once on DOMContentLoaded. The instance is stored in appConfig
 * so updateChart() and refreshChartTheme() can access it.
 */
function initChart() {
    const canvas = document.getElementById('loanChart');
    if (!canvas) return;

    const colors = getChartColors();
    const ctx    = canvas.getContext('2d');

    appConfig.chartInstance = new Chart(ctx, {
        type : 'doughnut',
        data : {
            labels   : ['Principal Amount', 'Total Interest'],
            datasets : [{
                data             : [1, 1],          // Placeholder data; overwritten by first calculateUltra()
                backgroundColor  : [colors.primary, colors.accent],
                borderColor      : [colors.primary, colors.accent],
                borderWidth      : 2,
                hoverOffset      : 12,
                hoverBorderWidth : 3
            }]
        },
        options: {
            responsive          : true,
            maintainAspectRatio : false,
            cutout              : '72%', // Ring thickness — higher = thinner ring

            plugins: {
                // Legend positioned below chart
                legend: {
                    position : 'bottom',
                    labels   : {
                        color           : colors.legendColor,
                        usePointStyle   : true,
                        pointStyleWidth : 10,
                        padding         : 20,
                        font            : { size: 13, family: "'Segoe UI', sans-serif" }
                    }
                },

                // Custom tooltip showing currency symbol + formatted value
                tooltip: {
                    backgroundColor : colors.tooltipBg,
                    titleColor      : colors.tooltipTitle,
                    bodyColor       : colors.tooltipBody,
                    borderColor     : colors.primary,
                    borderWidth     : 1,
                    padding         : 12,
                    cornerRadius    : 8,
                    callbacks: {
                        label: (ctx) =>
                            ` ${ctx.label}: ${appConfig.symbol}${Math.round(ctx.raw).toLocaleString()}`
                    }
                }
            },

            animation: {
                animateRotate : true,
                duration      : 700,
                easing        : 'easeInOutQuart'
            }
        }
    });
}


/**
 * UPDATE CHART
 * Pushes new principal and interest values into the existing chart instance.
 * Uses Chart.js 'active' update mode for smooth animated transitions.
 *
 * @param {number} p — Principal amount
 * @param {number} i — Total interest
 */
function updateChart(p, i) {
    if (!appConfig.chartInstance) return;
    appConfig.chartInstance.data.datasets[0].data = [p, i];
    appConfig.chartInstance.update('active');
}


/**
 * REFRESH CHART THEME
 * Re-reads CSS variables and updates all chart colors.
 * Called when the user toggles dark/light mode via the global theme system.
 * Exposed globally so global.js can call it via the 'themeChanged' event.
 */
function refreshChartTheme() {
    if (!appConfig.chartInstance) return;
    const colors = getChartColors();

    // Update dataset colors
    const ds = appConfig.chartInstance.data.datasets[0];
    ds.backgroundColor = [colors.primary, colors.accent];
    ds.borderColor     = [colors.primary, colors.accent];

    // Update plugin colors (legend + tooltips)
    appConfig.chartInstance.options.plugins.legend.labels.color     = colors.legendColor;
    appConfig.chartInstance.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
    appConfig.chartInstance.options.plugins.tooltip.titleColor      = colors.tooltipTitle;
    appConfig.chartInstance.options.plugins.tooltip.bodyColor       = colors.tooltipBody;
    appConfig.chartInstance.options.plugins.tooltip.borderColor     = colors.primary;

    appConfig.chartInstance.update(); // Full re-render
}


// ---------------------------------------------------------------------------
//  AMORTIZATION TABLE
// ---------------------------------------------------------------------------

/**
 * GENERATE TABLE
 * Builds the full amortization schedule HTML and injects it into #tableBody.
 * Capped at 360 rows (30 years) for rendering performance.
 *
 * @param {number} bal        — Starting loan balance (may include moratorium interest)
 * @param {number} r          — Monthly interest rate (decimal)
 * @param {number} emi        — Monthly payment amount (standard EMI + extra pre-payment)
 * @param {number} totalMonths — Actual number of months to repay the loan
 */
function generateTable(bal, r, emi, totalMonths) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    let date        = new Date();
    let htmlBuilder = '';
    let limit       = Math.min(totalMonths, 360); // Display cap: 30 years

    for (let i = 0; i < limit; i++) {
        if (bal <= 1) break; // Loan fully paid off

        let int  = bal * r;      // Interest portion this month
        let prin = emi - int;    // Principal portion this month

        // Clamp final month: don't overpay the remaining balance
        if (bal < prin) {
            prin = bal;
            int  = bal * r;
        }

        bal -= prin;           // Reduce outstanding balance
        date.setMonth(date.getMonth() + 1); // Advance calendar month

        // Build table row: Month/Year | Principal | Interest (red) | Balance (cyan)
        htmlBuilder += `<tr>
            <td>${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
            <td>${Math.round(prin).toLocaleString()}</td>
            <td class="text-danger">${Math.round(int).toLocaleString()}</td>
            <td class="text-primary">${appConfig.symbol} ${Math.round(Math.max(0, bal)).toLocaleString()}</td>
        </tr>`;
    }

    tbody.innerHTML = htmlBuilder; // Single DOM write for performance
}


/**
 * TOGGLE TABLE
 * Shows or hides the amortization table wrapper (#tableContainer).
 * Smoothly scrolls into view when revealed.
 */
function toggleTable() {
    const t = document.getElementById('tableContainer');
    if (!t) return;
    t.classList.toggle('hidden');
    // Scroll table into view after a brief paint delay
    if (!t.classList.contains('hidden')) {
        t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}


// ---------------------------------------------------------------------------
//  AI AFFORDABILITY ADVISOR
// ---------------------------------------------------------------------------

/**
 * RUN AI ADVISOR
 * Calculates the Debt-to-Income (DTI) ratio using:
 *   - Monthly income (#monthlyIncome)
 *   - Existing EMI obligations (#currentEMI)
 *   - The newly calculated EMI (#emiValue)
 *
 * Outputs a color-coded risk assessment into #aiResponse.
 * Uses the global showToast() for validation errors.
 */
function runAIAdvisor() {
    const incomeInput = document.getElementById('monthlyIncome');
    const emiValueEl  = document.getElementById('emiValue');
    const responseBox = document.getElementById('aiResponse');

    let income      = parseFloat(incomeInput?.value)  || 0;
    let currentDebt = parseFloat(document.getElementById('currentEMI')?.value) || 0;

    // Parse EMI from the display text (strips currency symbol and commas)
    let newEMI = parseFloat(emiValueEl?.innerText.replace(/[^0-9.]/g, '')) || 0;

    // Validate: income must be a positive number
    if (income <= 0) {
        showToast('Enter valid monthly income!', 'error');
        return;
    }

    let totalObligation = currentDebt + newEMI;
    let ratio           = (totalObligation / income) * 100; // DTI as percentage

    // Make the response box visible
    responseBox.style.display = 'block';

    // ── Risk Classification ──
    // < 40% DTI: Healthy — high bank approval likelihood
    // 40–59%: Moderate risk — may need co-applicant
    // 60%+:   High risk — likely rejection
    let msg, color, icon;
    if (ratio < 40) {
        msg   = `<strong>Excellent! (DTI: ${ratio.toFixed(1)}%)</strong><br>Your debt load is healthy. High approval chance.`;
        color = 'var(--status-success)';
        icon  = 'fa-circle-check';
    } else if (ratio < 60) {
        msg   = `<strong>Moderate Risk (DTI: ${ratio.toFixed(1)}%)</strong><br>Crossing 50% limit. Banks may require a co-applicant.`;
        color = 'var(--status-warning)';
        icon  = 'fa-triangle-exclamation';
    } else {
        msg   = `<strong>High Risk (DTI: ${ratio.toFixed(1)}%)</strong><br>EMIs consume over 60% of income. Risk of rejection.`;
        color = 'var(--status-error)'; // NOTE: original used --status-danger (undefined); corrected to --status-error
        icon  = 'fa-hand-paper';
    }

    // Inject result HTML and apply dynamic risk color to the left border
    responseBox.innerHTML         = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    responseBox.style.borderLeft  = `3px solid ${color}`;
    responseBox.style.borderColor = color;

    // Scroll the response box into view smoothly
    setTimeout(() => responseBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}


// ---------------------------------------------------------------------------
//  PDF GENERATOR
// ---------------------------------------------------------------------------

/**
 * GENERATE PDF
 * Creates a branded Loan Summary PDF using jsPDF and triggers download.
 * Requires the jsPDF library to be loaded (via script tag in index.html).
 * File name includes a timestamp to prevent browser caching conflicts.
 */
async function generatePDF() {
    // Guard: ensure jsPDF library is loaded
    if (!window.jspdf) {
        showToast('PDF Library loading... Try again in 2s', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc       = new jsPDF();

    showToast('Generating Report...', 'success');

    // ── Header Bar ──
    // Dark branded header block at the top of the page
    doc.setFillColor(5, 5, 16);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(0, 242, 255); // Cyan brand color
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('TRUSTED TOOLS WEB', 105, 18, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Financial Assessment Report', 105, 28, { align: 'center' });

    // ── Loan Summary Section ──
    let y = 60;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('Loan Summary', 20, y);
    doc.setDrawColor(0, 242, 255);
    doc.line(20, y + 2, 190, y + 2); // Decorative underline

    y += 15;

    // Helper functions to safely read values from the live DOM
    const getTxt = (id) => document.getElementById(id)?.innerText || '-';
    const getVal = (id) => document.getElementById(id)?.value     || '-';

    // Summary data rows: [Label, Value]
    const rows = [
        ['Loan Amount',    `${getVal('loanAmount')} ${appConfig.currency}`],
        ['Interest Rate',  `${getVal('interestRate')}%`],
        ['Tenure',         `${getVal('loanTenure')} Years`],
        ['Monthly EMI',    getTxt('emiValue').replace(appConfig.symbol, appConfig.currency + ' ')],
        ['Total Interest', getTxt('totalInterest').replace(appConfig.symbol, appConfig.currency + ' ')]
    ];

    doc.setFontSize(11);
    rows.forEach(row => {
        doc.setFont('helvetica', 'bold');
        doc.text(row[0], 25, y);
        doc.setFont('helvetica', 'normal');
        doc.text(':  ' + row[1], 80, y);
        y += 10;
    });

    // ── Footer ──
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated on: ' + new Date().toLocaleString(), 105, 280, { align: 'center' });
    doc.text('www.trustedtoolsweb.com',                      105, 285, { align: 'center' });

    // Trigger download with timestamp-based filename
    doc.save(`EMI_Report_${Date.now()}.pdf`);
}


// ---------------------------------------------------------------------------
//  UTILITIES
// ---------------------------------------------------------------------------

/**
 * TOGGLE CURRENCY
 * Switches the active currency between BDT (Bangladeshi Taka) and USD.
 * Updates the currency icon, resets the loan amount to a contextually
 * appropriate default, and recalculates immediately.
 */
function toggleCurrency() {
    // Flip currency state
    appConfig.currency = (appConfig.currency === 'BDT') ? 'USD' : 'BDT';
    appConfig.symbol   = (appConfig.currency === 'USD') ? '$'   : '৳';

    // Swap the button icon to reflect active currency
    const icon = document.getElementById('curIcon');
    if (icon) {
        icon.className = (appConfig.currency === 'USD')
            ? 'fa-solid fa-dollar-sign'
            : 'fa-solid fa-coins';
    }

    // Reset loan amount to a sensible default for each currency
    // USD: 5,000 | BDT: 500,000
    const newAmt = appConfig.currency === 'USD' ? 5000 : 500000;
    document.getElementById('loanAmount').value  = newAmt;
    document.getElementById('rangeAmount').value = newAmt;
    sync('loanAmount', 'rangeAmount'); // Sync slider and recalculate

    showToast(`Switched to ${appConfig.currency}`, 'success');
}


/**
 * LOAD THEME
 * Reads the saved theme preference from localStorage and applies
 * light mode if necessary. Also triggers a chart color refresh so
 * the doughnut always matches the active theme on initial load.
 */
function loadTheme() {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        refreshChartTheme();
    }
}


/**
 * SHOW TOAST
 * Displays a brief notification using the global #toastArea element.
 *
 * FIX (v3.6.1): The #toastArea wrapper is force-fixed to the top of the
 * viewport via inline style on first use. This guarantees the toast is
 * always visible even when the user has scrolled down — regardless of
 * whether global.css has already applied position:fixed to .toast-wrapper.
 *
 * @param {string} msg  — Message text to display
 * @param {string} type — 'success' for green | any other value for error/red
 */
function showToast(msg, type) {
    const area = document.getElementById('toastArea');
    if (!area) return;

    // ── CRITICAL FIX: Force the toast container to stay fixed on screen ──
    // This runs every call to ensure it's applied even if global.css loads late.
    // position:fixed + high z-index keeps the toast above ALL page content,
    // and above the sticky header, so it's always visible when scrolled.
    area.style.cssText = [
        'position: fixed',
        'top: 70px',          /* Below the sticky site header (~60px tall) */
        'left: 50%',
        'transform: translateX(-50%)',
        'z-index: 99999',     /* Above header, modals, and overlays */
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'gap: 10px',
        'pointer-events: none', /* Toasts don't block clicks on page content */
        'width: max-content',
        'max-width: 90vw'
    ].join(';');

    // Build the toast element
    const div = document.createElement('div');
    div.className = 'toast ' + (type === 'success' ? 'success' : 'error');

    // Allow pointer events on the toast itself (for readability)
    div.style.cssText = 'pointer-events: auto; animation: fadeInUp 0.3s ease both;';

    div.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> <span>${msg}</span>`;

    area.appendChild(div);

    // Auto-dismiss after 3 seconds with a smooth fade-out
    setTimeout(() => {
        div.style.opacity    = '0';
        div.style.transition = 'opacity 0.3s ease';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}


// ---------------------------------------------------------------------------
//  EVENT LISTENERS
// ---------------------------------------------------------------------------

// Listen for the 'themeChanged' custom event dispatched by global.js
// when the user toggles dark/light mode — triggers chart color refresh.
document.addEventListener('themeChanged', refreshChartTheme);

// Disable the right-click context menu as a lightweight content protection measure.
document.addEventListener('contextmenu', e => e.preventDefault());
