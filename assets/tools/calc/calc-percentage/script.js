
/**
 * TRUSTED TOOLS WEB - PROFESSIONAL SCRIPT (CODECANYON READY)
 * Tool: Percentage Master Pro Max
 * Version: 2.0.0
 * Features: 9 Advanced Calculators, History Management, Theme Engine, Offline Support
 * 
 * Description:
 * This script handles all client-side logic for the calculators. 
 * It includes input validation, mathematical computation, result formatting,
 * local storage based history, and UI interactions.
 */

(function() {
    "use strict";

    // --- 1. CONFIGURATION & STATE ---
    
    /**
     * Configuration constants for easy customization.
     */
    const CONFIG = {
        MAX_HISTORY: 20,       // Maximum number of history items to store
        TOAST_DURATION: 3000,  // Duration for toast notifications in ms
        ANIMATION_DELAY: 400,  // Animation timing for UI elements
        PRECISION: 2           // Default decimal places for number formatting
    };

    /**
     * Global application state.
     */
    let state = {
        history: [],
        isDarkMode: true
    };

    // --- 2. UTILITY FUNCTIONS ---


    /**
     * Robust Input Validation & Sanitization
     * Retrieves values from input fields and ensures they are valid numbers.
     * @param {string} id - The ID of the input element.
     * @param {string} label - The user-friendly name of the input field for error messages.
     * @returns {number|null} - The parsed float value or null if invalid.
     */
    const getCleanInput = (id, label = "Input") => {
        const el = document.getElementById(id);
        if (!el) return null;

        const val = parseFloat(el.value);
        
        if (isNaN(val) || el.value.trim() === "") {
            el.classList.add('input-error');
            el.focus();
            showToast(`Please enter a valid number for ${label}`, true);
            setTimeout(() => el.classList.remove('input-error'), 2000);
            return null;
        }
        
        // Ensure error class is removed on valid input
        el.classList.remove('input-error');
        return val;
    };

    /**
     * Professional Number Formatting
     * Formats numbers with commas and fixed decimal places (e.g., 1,200.50).
     * @param {number} num - The number to format.
     * @param {number} decimals - Maximum number of decimal places.
     * @returns {string} - The formatted number string.
     */
    const formatNumber = (num, decimals = CONFIG.PRECISION) => {
        // Math.round to prevent floating point precision issues before formatting
        const roundedNum = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
        
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        }).format(roundedNum);
    };

    /**
     * Clipboard API with Feedback
     * Copies text to clipboard and shows a toast notification.
     * This function is exposed globally for use in HTML onclick attributes.
     * @param {string} text - The text to copy.
     */
    window.copyToClipboard = async (text) => {
        // Check for default placeholder values to prevent copying "0" or "0%"
        if (!text || text === "0" || text === "0%" || text.trim() === "") {
            showToast("Nothing to copy yet!", true);
            return;
        }
        
        try {
            await navigator.clipboard.writeText(text.replace(/,/g, '')); // Remove formatting commas
            showToast("Result copied to clipboard!");
        } catch (err) {
            // Fallback for older browsers or insecure contexts
            const textArea = document.createElement("textarea");
            textArea.value = text.replace(/,/g, '');
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            showToast("Result copied!");
        }
    };

    // --- 3. HISTORY MANAGEMENT ---
    
    /**
     * Loads calculation history from LocalStorage.
     */
    const loadHistory = () => {
        try {
            state.history = JSON.parse(localStorage.getItem('calcHistory')) || [];
            renderHistory();
        } catch (e) {
            state.history = [];
        }
    };

    /**
     * Adds a new entry to the history array and updates LocalStorage.
     * @param {string} type - The type of calculator used.
     * @param {string} details - A summary of input values.
     * @param {string} result - The calculated result.
     */
    const addToHistory = (type, details, result) => {
        const item = { 
            type, 
            details, 
            result, 
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
        };
        
        state.history.unshift(item);
        if(state.history.length > CONFIG.MAX_HISTORY) state.history.pop();
        
        localStorage.setItem('calcHistory', JSON.stringify(state.history));
        renderHistory();
    };

    /**
     * Renders the history list into the DOM.
     */
    const renderHistory = () => {
        const list = document.getElementById('historyList');
        if (!list) return;

        if(state.history.length === 0) {
            list.innerHTML = `
                <div class="history-empty">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; color: var(--text-secondary);"></i>
                    <p style="color: var(--text-secondary);">No history available yet.<br>Start calculating!</p>
                </div>`;
            return;
        }
        
        list.innerHTML = state.history.map(item => `
            <div class="history-item animated-entry">
                <div class="history-item-header">
                    <span>${item.type}</span><span>${item.time}</span>
                </div>
                <div class="history-item-details">${item.details}</div>
                <div class="history-item-result">= ${item.result}</div>
            </div>
        `).join('');
    };

    /**
     * Toggles the visibility of the history side panel.
     * Exposed globally for the HTML button.
     */
    window.toggleHistory = () => {
        const panel = document.getElementById('historyPanel');
        if (panel) {
            panel.classList.toggle('active');
            if(panel.classList.contains('active')) renderHistory();
        }
    };

    /**
     * Clears all history data with user confirmation.
     * Exposed globally for the HTML button.
     */
    window.clearHistory = () => {
        // Confirmation dialog for better User Experience
        if(confirm("Are you sure you want to clear all history?")) {
            state.history = [];
            localStorage.removeItem('calcHistory');
            renderHistory();
            showToast("History cleared", true);
        }
    };

    // --- 4. THEME ENGINE ---
    
    /**
     * Applies the selected theme (light/dark) to the body.
     * @param {string} theme - 'light' or 'dark'.
     */
    const applyTheme = (theme) => {
        const icon = document.getElementById('themeIcon');
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            state.isDarkMode = false;
            if(icon) icon.className = 'fa-solid fa-moon'; // Show moon icon to suggest switching to dark
        } else {
            document.body.classList.remove('light-mode');
            state.isDarkMode = true;
            if(icon) icon.className = 'fa-solid fa-sun'; // Show sun icon to suggest switching to light
        }
    };

    /**
     * Toggles the theme state and saves preference.
     * Exposed globally.
     */
    window.toggleTheme = () => {
        const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem('siteTheme', newTheme);
        showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode enabled`);
    };

    // --- 5. CALCULATION ENGINES ---

    /**
     * Helper to display results with a smooth fade-in animation.
     * @param {string} boxId - The ID of the result container.
     * @param {string} value - The formatted result string to display.
     */
    const displayResult = (boxId, value) => {
        const box = document.getElementById(boxId);
        if (!box) return;
        
        const valSpan = box.querySelector('.result-value');
        
        // Trigger reflow to restart CSS animation
        box.classList.remove('show');
        void box.offsetWidth; 
        
        valSpan.innerText = value;
        box.classList.add('show');
    };

    // 1. General Percentage Calculator
    // Formula: (Percentage / 100) * Value
    window.calcGeneral = function() {
        const p = getCleanInput('gen-percent', 'Percentage');
        const v = getCleanInput('gen-value', 'Value');
        if (p === null || v === null) return;

        const res = (p / 100) * v;
        const formatted = formatNumber(res); 
        
        displayResult('res-box-gen', formatted);
        addToHistory('General %', `${p}% of ${v}`, formatted);
    };

    // 2. Discount Calculator
    // Formula: Original Price - ((Discount / 100) * Original Price)
    window.calcDiscount = function() {
        const price = getCleanInput('disc-price', 'Original Price');
        const disc = getCleanInput('disc-percent', 'Discount %');
        if (price === null || disc === null) return;

        const save = (disc / 100) * price;
        const final = price - save;
        
        const savedEl = document.getElementById('saved-amount');
        if(savedEl) savedEl.innerText = formatNumber(save);
        
        displayResult('res-box-disc', formatNumber(final));
        addToHistory('Discount', `Price: ${price}, Off: ${disc}%`, formatNumber(final));
    };

    // 3. Marks / Percentage Calculator
    // Formula: (Obtained / Total) * 100
    window.calcMarks = function() {
        const obt = getCleanInput('marks-obt', 'Marks Obtained');
        const tot = getCleanInput('marks-total', 'Total Marks');
        
        if (obt === null || tot === null) return;
        if (tot === 0) return showToast("Total marks cannot be 0", true );
        
        // Validation: Ensure obtained marks do not exceed total marks
        if (obt > tot) {
            showToast("Obtained marks cannot exceed total marks", true); 
            return; 
        }

        const res = (obt / tot) * 100;
        const formatted = formatNumber(res) + "%";
        
        displayResult('res-box-marks', formatted);
        addToHistory('Exam Marks', `Got ${obt} out of ${tot}`, formatted);
    };


    // 4. Growth / Decline Calculator
    // Formula: ((New Value - Old Value) / Old Value) * 100
    window.calcChange = function() {
        const oldV = getCleanInput('change-old', 'Initial Value');
        const newV = getCleanInput('change-new', 'Final Value');
        if (oldV === null || newV === null) return;
        if (oldV === 0) return showToast("Initial value cannot be 0", true);

        const diff = newV - oldV;
        const percent = (diff / oldV) * 100;
        
        const sign = percent >= 0 ? "+" : "";
        const resEl = document.getElementById('res-change');
        
        // Dynamic Color: Green for positive growth, Red for decline
        if(resEl) resEl.style.color = percent >= 0 ? 'var(--primary-tool)' : 'var(--danger-color)'; 
        
        const diffEl = document.getElementById('diff-val');
        if(diffEl) diffEl.innerText = formatNumber(diff);
        
        displayResult('res-box-change', sign + formatNumber(percent) + "%");
        addToHistory('Growth', `${oldV} ➝ ${newV}`, sign + formatNumber(percent) + "%");
    };

    // 5. GST / VAT Calculator
    // Supports both adding tax and reverse calculation (removing tax)
    window.calcGST = function(isAdd) {
        const amt = getCleanInput('gst-amount', 'Base Amount');
        const rate = getCleanInput('gst-rate', 'Tax Rate');
        if (amt === null || rate === null) return;

        let tax, total;
        if (isAdd) {
            // Forward Calculation: Total = Amount * (1 + Rate/100)
            tax = (rate / 100) * amt;
            total = amt + tax;
        } else {
            // Reverse Calculation: Base = Amount / (1 + Rate/100)
            let base = amt / (1 + (rate / 100));
            tax = amt - base;
            total = base;
        }

        const gstValEl = document.getElementById('gst-val');
        if(gstValEl) gstValEl.innerText = formatNumber(tax);
        
        const box = document.getElementById('res-box-gst');
        if(box) {
            const hint = box.querySelector('.copy-hint');
            if(hint) hint.innerText = isAdd ? "Total Bill Amount" : "Price Before Tax";
        }
        
        displayResult('res-box-gst', formatNumber(total));
        addToHistory('Tax Calc', `${isAdd ? 'Add' : 'Remove'} ${rate}% on ${amt}`, formatNumber(total));
    };

    // 6. Tip & Split Calculator
    window.calcTip = function() {
        const bill = getCleanInput('tip-bill', 'Bill Amount');
        const tipP = getCleanInput('tip-percent', 'Tip %');
        
        // Manual validation for 'People' to ensure logic doesn't break on empty fields
        const pplInput = document.getElementById('tip-people');
        let ppl = 1; // Default to 1 person

        if (pplInput && pplInput.value.trim() !== "") {
            let val = parseFloat(pplInput.value);
            if (isNaN(val) || val < 1) {
                showToast("Please enter valid number of people", true);
                return;
            }
            ppl = val;
        }
        
        if (bill === null || tipP === null) return;

        const tipAmount = (tipP / 100) * bill;
        const totalBill = bill + tipAmount;
        const perPerson = totalBill / ppl;

        const tipEl = document.getElementById('total-tip');
        const billEl = document.getElementById('total-bill');
        if(tipEl) tipEl.innerText = formatNumber(tipAmount);
        if(billEl) billEl.innerText = formatNumber(totalBill);
        
        displayResult('res-box-tip', formatNumber(perPerson));
        addToHistory('Tip Split', `Bill: ${bill}, Tip: ${tipP}%`, `Each: ${formatNumber(perPerson)}`);
    };


    // 7. Profit Margin Calculator
    // Formula: ((Selling Price - Cost Price) / Selling Price) * 100
    window.calcMargin = function() {
        const cost = getCleanInput('margin-cost', 'Cost Price');
        const sell = getCleanInput('margin-sell', 'Selling Price');
        if (cost === null || sell === null) return;
        if (sell === 0) return showToast("Selling price cannot be 0", true);

        const profit = sell - cost;
        const margin = (profit / sell) * 100;
        
        const profitEl = document.getElementById('margin-profit');
        if(profitEl) profitEl.innerText = formatNumber(profit);
        
        const resBox = document.getElementById('res-box-margin');
        if(resBox) {
            const valEl = resBox.querySelector('.result-value');
            // Dynamic Color: Red for loss (negative margin)
            if(valEl) valEl.style.color = margin < 0 ? 'var(--danger-color)' : 'var(--primary-tool)';
        }
        
        displayResult('res-box-margin', formatNumber(margin) + "%");
        addToHistory('Margin', `Buy: ${cost}, Sell: ${sell}`, formatNumber(margin) + "%");
    };

    // 8. Compound Interest Calculator
    // Formula: A = P(1 + r/100)^t
    window.calcCI = function() {
        const P = getCleanInput('ci-principal', 'Principal');
        const R = getCleanInput('ci-rate', 'Rate');
        const T = getCleanInput('ci-time', 'Years');
        
        if (P === null || R === null || T === null) return;

        const Amount = P * Math.pow((1 + R / 100), T);
        const Interest = Amount - P;

        const ciIntEl = document.getElementById('ci-interest');
        if(ciIntEl) ciIntEl.innerText = formatNumber(Interest);
        
        displayResult('res-box-ci', formatNumber(Amount));
        addToHistory('Compound Int.', `P:${P}, R:${R}%, T:${T}yr`, formatNumber(Amount));
    };

    // 9. Fraction to Percent Converter
    window.calcFraction = function() {
        const num = getCleanInput('frac-num', 'Numerator');
        const den = getCleanInput('frac-den', 'Denominator');
        
        if (num === null || den === null) return;
        if (den === 0) return showToast("Denominator cannot be 0", true);

        const decimal = num / den;
        const percent = decimal * 100;

        const fracDecEl = document.getElementById('frac-decimal');
        // Display decimal with higher precision (4 places)
        if(fracDecEl) fracDecEl.innerText = formatNumber(decimal, 4);
        
        displayResult('res-box-frac', formatNumber(percent) + "%");
        addToHistory('Fraction', `${num} ÷ ${den}`, formatNumber(percent) + "%");
    };

    // --- 6. INITIALIZATION & EVENTS ---
    
    document.addEventListener('DOMContentLoaded', () => {
        // 1. Load User Theme Preference
        const savedTheme = localStorage.getItem('siteTheme') || 'dark';
        applyTheme(savedTheme);
        
        // 2. Load Previous Calculation History
        loadHistory();
        
        // 3. Accessibility: Add Enter Key Support for all Inputs
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                const card = e.target.closest('.calc-card');
                if (card) {
                    // Find the primary calculation button within the active card
                    const btn = card.querySelector('button.btn-calc');
                    if(btn) {
                        e.preventDefault(); // Prevent default form submission
                        btn.click();
                    }
                }
            }
        });

        // 4. UI Polish: Add active states to input wrappers
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('focus', () => input.parentElement.classList.add('focused'));
            input.addEventListener('blur', () => input.parentElement.classList.remove('focused'));
        });
    });

})();
