
    /* ================================================================
       OmniConvert Ultra - Core Engine
       Version: 2.5 (Bug Fix: Currency Logic Corrected)

       [DEVELOPER NOTE]:
       This script handles all logic for conversion, UI updates,
       API fetching, and chart rendering.
       ================================================================ */

    /**
     * [USER CONFIG]: Database Configuration (DB)
     * Defines categories and units.
     * FORMAT:
     * - type: 'linear' (Length/Weight), 'func' (Temp), 'api' (Currency)
     * - u: Unit factors.
     */
    const DB = {
        length: {
            i: "fa-ruler-combined", n: "Length", type: "linear",
            u: { m:1, cm:0.01, mm:0.001, km:1000, inch:0.0254, ft:0.3048, yd:0.9144, mi:1609.34, nm:1852 }
        },
        weight: {
            i: "fa-weight-hanging", n: "Weight", type: "linear",
            u: { kg:1, g:0.001, mg:1e-6, t:1000, lb:0.453592, oz:0.0283495, st:6.35029, carat:0.0002, tola:0.01166, grain:6.479e-5 }
        },
        currency: {
            i: "fa-coins", n: "Currency", type: "api",
            // [Fix]: Base unit is USD = 1. All other rates are relative to USD.
            u: { USD:1, EUR:0.92, BDT:122.33, INR:83.4, GBP:0.79, CAD:1.36, AUD:1.52, AED:3.67, SAR:3.75, MYR:4.73, KWD:0.31, JPY:155.2, CNY:7.23, PKR:278.5, RUB:92.5 }
        },
        speed: {
            i: "fa-gauge-high", n: "Speed", type: "linear",
            u: { mps:1, kph:0.277778, mph:0.44704, knot:0.514444, mach:343, c:299792458, fps:0.3048 }
        },
        temp: {
            i: "fa-temperature-half", n: "Temp", type: "func",
            u: { C:"Celsius", F:"Fahrenheit", K:"Kelvin", R:"Rankine" }
        },
        data: {
            i: "fa-hard-drive", n: "Storage", type: "linear",
            u: { B:1, KB:1024, MB:1048576, GB:1073741824, TB:1099511627776, PB:1125899906842624, bit:0.125, Nibble:0.5 }
        },
        time: {
            i: "fa-clock", n: "Time", type: "linear",
            u: { s:1, min:60, h:3600, d:86400, wk:604800, mo:2628000, y:31536000, ms:0.001, ns:1e-9 }
        },
        area: {
            i: "fa-vector-square", n: "Area", type: "linear",
            u: { m2:1, ha:10000, km2:1e6, ac:4046.86, ft2:0.092903, in2:0.00064516, bigha:1337.8, katha:66.89 }
        },
        volume: {
            i: "fa-cube", n: "Volume", type: "linear",
            u: { l:1, ml:0.001, m3:1000, cm3:0.001, gal:3.78541, qt:0.946353, pt:0.473176, cup:0.236588, fl_oz:0.0295735, tbsp:0.0147868, tsp:0.00492892 }
        },
        pressure: {
            i: "fa-gauge", n: "Pressure", type: "linear",
            u: { Pa:1, bar:100000, psi:6894.76, atm:101325, torr:133.322 }
        },
        energy: {
            i: "fa-bolt", n: "Energy", type: "linear",
            u: { J:1, kJ:1000, cal:4.184, kcal:4184, Wh:3600, kWh:3.6e6, BTU:1055.06, eV:1.60218e-19 }
        },
        power: {
            i: "fa-plug", n: "Power", type: "linear",
            u: { W:1, kW:1000, hp:745.7, MW:1e6 }
        },
        fuel: {
            i: "fa-gas-pump", n: "Fuel", type: "inv",
            u: { mpg:1, kmpl:0.425144, l100km: "special" }
        },
        angle: {
            i: "fa-compass", n: "Angle", type: "linear",
            u: { deg:1, rad:57.2958, grad:0.9, arcmin:0.0166667, arcsec:0.000277778 }
        }
    };

    /**
     * --- APP STATE ---
     * Stores current settings and runtime variables.
     */
    let state = {
        cat: 'length',
        from: 'm',
        to: 'ft',
        modalTarget: null,
        chart: null,
        isLiveRate: false,
        lastInputSource: 'from'
    };

    /**
     * --- INITIALIZATION ---
     * Runs on page load.
     */
    window.addEventListener('DOMContentLoaded', async () => {
        loadTheme();
        renderCats();
        await initCurrency();
        setCat('length');
        loadHist();
        setupInputListeners();
    });

    /**
     * --- CORE RENDERING ---
     * Renders the category slider.
     */
    function renderCats() {
        const slider = document.getElementById('catSlider');
        if (!slider) return;

        slider.innerHTML = Object.keys(DB).map(k => `
            <div class="ocu-cat-item ${k === state.cat ? 'active' : ''}" onclick="setCat('${k}')">
                <i class="fa-solid ${DB[k].i}"></i> ${DB[k].n}
            </div>
        `).join('');
    }

    /**
     * Updates active category and UI elements.
     */
    function setCat(k) {
        state.cat = k;
        const keys = Object.keys(DB[k].u);
        state.from = keys[0];
        state.to = keys[1] || keys[0];

        renderCats();
        updateLabels();
        clearInputs();

        // Show chart only for Currency category
        const chartBox = document.getElementById('chartBox');
        if (chartBox) {
            if (k === 'currency') {
                chartBox.style.display = 'block';
                setTimeout(updateChart, 300);
            } else {
                chartBox.style.display = 'none';
            }
        }
    }

    function updateLabels() {
        document.getElementById('uFromDisp').innerText = state.from;
        document.getElementById('uToDisp').innerText = state.to;

        if (state.lastInputSource === 'from') calculateForward();
        else calculateBackward();
    }

    function clearInputs() {
        document.getElementById('inpFrom').value = '';
        document.getElementById('inpTo').value = '';
        document.getElementById('formula').innerText = '';
    }

    /**
     * --- CALCULATION ENGINE ---
     */
    function setupInputListeners() {
        const inpFrom = document.getElementById('inpFrom');
        const inpTo   = document.getElementById('inpTo');

        inpFrom.addEventListener('input', () => {
            state.lastInputSource = 'from';
            calculateForward();
        });

        inpTo.addEventListener('input', () => {
            state.lastInputSource = 'to';
            calculateBackward();
        });

        inpFrom.addEventListener('keyup', (e) => { if (e.key === "Enter") calculateForward(); });
    }

    function parseInput(raw) {
        if (!raw) return null;
        const cleanRaw = raw.replace(/,/g, '').replace(/[^0-9.+\-*/() eE]/g, '');
        if (!cleanRaw) return null;

        try {
            return (typeof math !== 'undefined')
                ? math.evaluate(cleanRaw)
                : Function('"use strict";return (' + cleanRaw + ')')();
        } catch (e) { return null; }
    }

    function calculateForward() {
        const raw = document.getElementById('inpFrom').value;
        if (!raw) { document.getElementById('inpTo').value = ''; return; }

        const val = parseInput(raw);
        if (val === null || isNaN(val)) return;

        const res = performConversion(val, state.from, state.to);
        document.getElementById('inpTo').value = formatNumber(res);
        updateFormula(state.from, state.to);
        saveHist(val, res);
    }

    function calculateBackward() {
        const raw = document.getElementById('inpTo').value;
        if (!raw) { document.getElementById('inpFrom').value = ''; return; }

        const val = parseInput(raw);
        if (val === null || isNaN(val)) return;

        // For backward calculation, swap 'from' and 'to' in the function call
        const res = performConversion(val, state.to, state.from);
        document.getElementById('inpFrom').value = formatNumber(res);
        updateFormula(state.from, state.to);
    }

    /**
     * [CRITICAL FIX]: Calculation Logic
     * Handles different mathematical models for Currency vs Linear units.
     */
    function performConversion(val, from, to) {
        const catData = DB[state.cat];

        // Case 1: Temperature (Function based)
        if (catData.type === 'func') return convertTemp(val, from, to);

        // Case 2: Fuel (Inverse logic)
        if (catData.type === 'inv') return convertFuel(val, from, to);

        // Case 3: Currency (API Rate based)
        // [FIXED LOGIC]: For API rates (e.g. 1 USD = 120 BDT), the formula is:
        // Result = Amount * (TargetRate / SourceRate)
        if (catData.type === 'api') {
            const rates = catData.u;
            return val * (rates[to] / rates[from]);
        }

        // Case 4: Linear (Length, Weight, etc.)
        // Definition: Factor is "Value in Base Unit".
        // Formula: (Amount * SourceFactor) / TargetFactor
        const rates = catData.u;
        const base  = val * rates[from];
        return base / rates[to];
    }

    function convertTemp(v, f, t) {
        if (f === t) return v;
        let k;
        // Step 1: To Kelvin
        if (f === 'C') k = v + 273.15;
        else if (f === 'F') k = (v + 459.67) * 5 / 9;
        else if (f === 'K') k = v;
        else if (f === 'R') k = v * 5 / 9;

        // Step 2: From Kelvin to Target
        if (t === 'C') return k - 273.15;
        if (t === 'F') return k * 9 / 5 - 459.67;
        if (t === 'K') return k;
        if (t === 'R') return k * 9 / 5;
    }

    function convertFuel(v, f, t) {
        if (v <= 0) return 0;
        if (f === t) return v;
        if (f === 'l100km') return (t === 'mpg') ? 235.215 / v : 100 / v;
        if (t === 'l100km') return (f === 'mpg') ? 235.215 / v : 100 / v;
        let mpg = (f === 'kmpl') ? v * 2.35215 : v;
        return (t === 'kmpl') ? mpg / 2.35215 : mpg;
    }

    /**
     * Updates the formula display (e.g., "1 USD = 122 BDT").
     */
    function updateFormula(from, to) {
        const formula  = document.getElementById('formula');
        const catData  = DB[state.cat];

        let rate;
        if (catData.type === 'api') {
            // [Fix]: Correct rate calculation for display
            rate = catData.u[to] / catData.u[from];
            const badge = state.isLiveRate
                ? `<span class="currency-badge badge-live">LIVE</span>`
                : `<span class="currency-badge badge-offline">OFFLINE</span>`;
            formula.innerHTML = `1 ${from} = ${formatNumber(rate, 4)} ${to} ${badge}`;
        } else {
            rate = catData.u[from] / catData.u[to];
            const displayRate = (isFinite(rate)) ? formatNumber(rate, 6) : "...";
            formula.innerText = `1 ${from} ≈ ${displayRate} ${to}`;
        }
    }

    function formatNumber(n, decimals = 4) {
        if (isNaN(n)) return "Error";
        if (n === 0)  return "0";
        if (Math.abs(n) < 0.000001 || Math.abs(n) > 1e12) return n.toExponential(4);

        return new Intl.NumberFormat('en-US', {
            maximumFractionDigits : decimals,
            minimumFractionDigits : 0,
            useGrouping           : false
        }).format(n);
    }

    /**
     * --- API & CURRENCY ---
     */
    async function initCurrency() {
        // Check local storage cache
        const cached = localStorage.getItem('omniRates');
        const now    = Date.now();

        if (cached) {
            try {
                const data = JSON.parse(cached);
                // 1 Hour cache validity
                if (now - data.time < 3600000) {
                    DB.currency.u    = {...DB.currency.u, ...data.rates};
                    state.isLiveRate = true;
                    return;
                }
            } catch (e) { console.error("Cache Parse Error"); }
        }

        try {
            const loader = document.getElementById('loader');
            if (loader) loader.style.width = '70%';

            // Fetch live rates
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            if (!res.ok) throw new Error("API Limit");
            const json = await res.json();

            DB.currency.u = json.rates;
            localStorage.setItem('omniRates', JSON.stringify({ time: now, rates: json.rates }));
            state.isLiveRate = true;
        } catch (e) {
            state.isLiveRate = false;
            showToast("Offline Mode: Rates may be old");
        } finally {
            const loader = document.getElementById('loader');
            if (loader) loader.style.width = '0%';
        }
    }

    /**
     * --- CHART.JS INTEGRATION ---
     */
    function updateChart() {
        if (state.cat !== 'currency' || !window.Chart) return;

        const ctx = document.getElementById('conversionChart').getContext('2d');
        if (state.chart) state.chart.destroy();

        const isLight  = document.body.classList.contains('light-mode');
        const color    = isLight ? '#4f46e5' : '#6366f1';
        const gridColor = isLight ? '#e2e8f0' : '#334155';

        // Calculate rate relative to From/To
        const baseRate = DB.currency.u[state.to] / DB.currency.u[state.from];
        const labels   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Generate mock fluctuation data (Simulated weekly trend)
        const data = labels.map(() => baseRate * (1 + (Math.random() * 0.02 - 0.01)));

        state.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels   : labels,
                datasets : [{
                    label           : 'Rate',
                    data            : data,
                    borderColor     : color,
                    backgroundColor : isLight ? 'rgba(79, 70, 229, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                    borderWidth     : 2,
                    tension         : 0.4,
                    fill            : true,
                    pointRadius     : 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive          : true,
                maintainAspectRatio : false,
                plugins : { legend: { display: false } },
                scales  : {
                    x: { grid: { display: false }, ticks: { color: isLight ? '#64748b' : '#94a3b8' } },
                    y: { grid: { color: gridColor }, ticks: { display: false } }
                }
            }
        });
    }

    /**
     * --- SEARCH & SMART LOGIC ---
     */
    function smartSearch(txt) {
        if (!txt) return;
        txt = txt.toLowerCase().trim();

        // Regex: "10 kg to lbs"
        const match = txt.match(/^(\d+)?\s*([a-z]+)\s*to\s*([a-z]+)$/);

        if (match) {
            const val = match[1];
            const u1  = match[2];
            const u2  = match[3];

            for (let cat in DB) {
                const units = Object.keys(DB[cat].u).map(u => u.toLowerCase());
                if (units.includes(u1) && units.includes(u2)) {
                    setCat(cat);
                    state.from = Object.keys(DB[cat].u).find(k => k.toLowerCase() === u1);
                    state.to   = Object.keys(DB[cat].u).find(k => k.toLowerCase() === u2);

                    if (val) document.getElementById('inpFrom').value = val;
                    updateLabels();
                    return;
                }
            }
        }

        // Direct search — find matching unit prefix
        for (let cat in DB) {
            const units = Object.keys(DB[cat].u);
            const found = units.find(u => u.toLowerCase().startsWith(txt));
            if (found) {
                setCat(cat);
                state.from = found;
                updateLabels();
                return;
            }
        }
    }

 
    function copyResult() {
        const val = document.getElementById('inpTo').value;
        if (val) {
            navigator.clipboard.writeText(val);
            showToast("Copied to Clipboard");
        }
    }

    function swap() {
        [state.from, state.to] = [state.to, state.from];

        const vFrom = document.getElementById('inpFrom').value;
        const vTo   = document.getElementById('inpTo').value;

        if (vTo && vTo !== 'Error') {
            document.getElementById('inpFrom').value = vTo;
            document.getElementById('inpTo').value   = vFrom;
        }

        updateLabels();
        if (state.cat === 'currency') updateChart();
    }

    function clearAll() {
        clearInputs();
        showToast("Cleared");
    }

    function toggleCalc() {
        const p       = document.getElementById('calcPanel');
        const btn     = document.getElementById('btnCalc');
        const isHidden = p.style.display === 'none' || p.style.display === '';
        p.style.display = isHidden ? 'grid' : 'none';
        btn.classList.toggle('active', !isHidden);
    }

    // [Fix]: Calculator input works based on Last Focused Box
    function calcInput(v) {
        const targetId = state.lastInputSource === 'to' ? 'inpTo' : 'inpFrom';
        const inp      = document.getElementById(targetId);

        if (v === '.' && inp.value.includes('.')) return;
        inp.value += v;

        if (state.lastInputSource === 'to') calculateBackward();
        else calculateForward();
    }

    function calcSolve() {
        const targetId = state.lastInputSource === 'to' ? 'inpTo' : 'inpFrom';
        const inp      = document.getElementById(targetId);
        const val      = parseInput(inp.value);
        if (val !== null) {
            inp.value = val;
            if (state.lastInputSource === 'to') calculateBackward();
            else calculateForward();
        }
    }

    function startDictation() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const r  = new SpeechRecognition();
            r.lang   = "en-US";
            r.start();
            document.getElementById('inpFrom').placeholder = "Listening...";

            r.onresult = e => {
                const txt = e.results[0][0].transcript;
                const num = txt.match(/[\d.]+/);
                if (num) {
                    document.getElementById('inpFrom').value = num[0];
                    calculateForward();
                }
                document.getElementById('inpFrom').placeholder = "0";
            };
            r.onerror = () => { showToast("Voice Error"); };
        } else {
            showToast("Feature not supported on this browser");
        }
    }

    /**
     * --- HISTORY MANAGEMENT ---
     */
    function saveHist(inV, outV) {
        // Debounce: Wait 1.5s after user stops typing
        if (window.histTimer) clearTimeout(window.histTimer);
        window.histTimer = setTimeout(() => {
            if (!inV || !outV || outV === "Error") return;
            const item = {
                t: `${formatNumber(inV)} ${state.from} → ${formatNumber(outV)} ${state.to}`,
                d: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            let h = [];
            try { h = JSON.parse(localStorage.getItem('omniHist') || '[]'); } catch (e) {}

            h.unshift(item);
            if (h.length > 8) h.pop();
            localStorage.setItem('omniHist', JSON.stringify(h));
            loadHist();
        }, 1500);
    }

    function loadHist() {
        let h = [];
        try { h = JSON.parse(localStorage.getItem('omniHist') || '[]'); } catch (e) {}

        const list = document.getElementById('historyList');
        if (!list) return;

        list.innerHTML = h.length
            ? h.map(i => `
                <div class="ocu-hist-item">
                    <span class="ocu-hist-text">${i.t}</span>
                    <span class="ocu-hist-time">${i.d}</span>
                </div>
            `).join('')
            : '<div class="ocu-hist-empty">No recent history</div>';
    }

    function clearHist() {
        localStorage.removeItem('omniHist');
        loadHist();
    }

    function toggleHistory() {
        const p = document.getElementById('historyPanel');
        p.style.display = (p.style.display === 'none') ? 'block' : 'none';
    }

    /**
     * --- MODAL LOGIC ---
     */
    function openModal(target) {
        state.modalTarget = target;
        const units  = Object.keys(DB[state.cat].u);
        const active = target === 'from' ? state.from : state.to;
        renderModalList(units, active);
        document.getElementById('unitModal').classList.add('active');
        setTimeout(() => document.getElementById('modalSearch').focus(), 100);
    }

    function renderModalList(units, active) {
        document.getElementById('modalList').innerHTML = units.map(u => `
            <div class="ocu-unit-opt ${u === active ? 'selected' : ''}" onclick="selectUnit('${u}')">
                <span>${u}</span>
                ${u === active ? '<i class="fa-solid fa-check text-accent-cyan"></i>' : ''}
            </div>
        `).join('');
    }

    function closeModal() { document.getElementById('unitModal').classList.remove('active'); }

    function selectUnit(u) {
        if (state.modalTarget === 'from') state.from = u;
        else state.to = u;
        updateLabels();
        closeModal();
    }

    function filterModalList(txt) {
        const units = Object.keys(DB[state.cat].u).filter(u => u.toLowerCase().includes(txt.toLowerCase()));
        renderModalList(units, state.modalTarget === 'from' ? state.from : state.to);
    }

    window.onclick = e => { if (e.target === document.getElementById('unitModal')) closeModal(); };

    /**
     * --- THEME LOGIC ---
     */
    function loadTheme() {
        const saved = localStorage.getItem('omniTheme');
        if (saved === 'light') {
            document.body.classList.add('light-mode');
            updateThemeIcon(true);
        }
    }

    function toggleTheme() {
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('omniTheme', isLight ? 'light' : 'dark');
        updateThemeIcon(isLight);
        if (state.cat === 'currency') updateChart();
    }

    function updateThemeIcon(isLight) {
        document.getElementById('themeIcon').className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
