/**
 * Ultra Age AI - Professional Age Calculator & Life Analytics
 * Premium Refactored Version
 * Author: MD KAWSAR
 */

(function() {
    'use strict';

    // --- Configuration ---
    let rafId = null;
    let lastTimestamp = 0;
    let birthDateObj = null;

    const ZODIACS = ["Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"];
    const STONES = ["Garnet", "Amethyst", "Aquamarine", "Diamond", "Emerald", "Pearl", "Ruby", "Peridot", "Sapphire", "Opal", "Topaz", "Turquoise"];
    const SEASONS = ["Winter", "Winter", "Spring", "Spring", "Summer", "Summer", "Monsoon", "Monsoon", "Autumn", "Autumn", "Late Autumn", "Late Autumn"];

    /**
     * Formatting helper for large numbers
     */
    const fmt = (num) => isNaN(num) ? "0" : new Intl.NumberFormat('en-US').format(num);

    /**
     * Initializing the Application
     */
    const init = () => {
        const dobInput = document.getElementById('dobInput');
        if (dobInput) {
            const today = new Date().toISOString().split('T')[0];
            dobInput.setAttribute('max', today);
        }

        // Theme sync
        const savedTheme = localStorage.getItem('siteTheme') || 'dark';
        if (savedTheme === 'light') document.body.classList.add('light-mode');

        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON') {
                window.startAnalysis();
            }
        });
    };

    /**
     * Professional Toast Notifications
     */
    window.showToast = (msg, type = 'success') => {
        const box = document.getElementById('toast-box');
        if (!box) return;

        const toast = document.createElement('div');
        const iconClass = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${msg}</span>`;
        
        box.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    };

    /**
     * Main Analysis Trigger
     */
    window.startAnalysis = () => {
        const dateVal = document.getElementById('dobInput').value;
        const timeVal = document.getElementById('tobInput').value || "00:00";

        if (!dateVal) {
            window.showToast("Please select your Date of Birth!", "error");
            return;
        }

        birthDateObj = new Date(`${dateVal}T${timeVal}`);
        const now = new Date();

        if (isNaN(birthDateObj.getTime()) || birthDateObj > now) {
            window.showToast("Invalid or Future Date provided!", "error");
            return;
        }

        document.getElementById('resultBox').style.display = 'block';
        
        // Stop any existing loop
        if (rafId) cancelAnimationFrame(rafId);
        
        // Calculate non-realtime data once
        performStaticCalculations(birthDateObj);
        
        // Start the optimized Animation Frame loop
        requestAnimationFrame(updateLoop);
        
        window.showToast("Life Analytics Synchronized!", "success");
        
        setTimeout(() => {
            document.getElementById('resultBox').scrollIntoView({ behavior: 'smooth' });
        }, 300);
    };

    /**
     * Optimized Animation Loop (Throttled to ~1s for battery)
     */
    const updateLoop = (timestamp) => {
        if (!lastTimestamp || timestamp - lastTimestamp >= 1000) {
            lastTimestamp = timestamp;
            updateRealTimeMetrics(birthDateObj);
        }
        rafId = requestAnimationFrame(updateLoop);
    };

    /**
     * Static metrics (once per analysis)
     */
    const performStaticCalculations = (dob) => {
        const now = new Date();
        const diffTime = Math.abs(now - dob);
        const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const totalYears = totalDays / 365.2425;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setVal('totalMonths', fmt(Math.floor(totalDays / 30.437)));
        setVal('totalWeeks', fmt(Math.floor(totalDays / 7)));
        setVal('totalDays', fmt(totalDays));
        setVal('totalHours', fmt(Math.floor(diffTime / (1000 * 60 * 60))));
        setVal('totalMinutes', fmt(Math.floor(diffTime / (1000 * 60))));

        // Consumption (Global Averages)
        setVal('foodKg', fmt(Math.floor(totalDays * 1.8)) + " kg");
        setVal('waterL', fmt(Math.floor(totalDays * 2.5)) + " L");
        setVal('steps', fmt(Math.floor(totalDays * 5000)));
        setVal('dreams', fmt(Math.floor(totalDays * 4)));
        setVal('words', fmt(Math.floor(totalDays * 15000)));

        // Biological
        const totalMins = Math.floor(diffTime / (1000 * 60));
        setVal('bioHearts', fmt(totalMins * 72));
        setVal('bioBreaths', fmt(totalMins * 16));
        setVal('bioBlood', fmt(totalDays * 7000) + " L");
        setVal('bioHair', (totalDays * 0.00035).toFixed(3) + " m");

        // Planetary
        setVal('ageMerc', (totalYears / 0.241).toFixed(2));
        setVal('ageVen', (totalYears / 0.615).toFixed(2));
        setVal('ageMars', (totalYears / 1.881).toFixed(2));
        setVal('ageJup', (totalYears / 11.86).toFixed(2));

        // Animal Years
        const dogY = totalYears <= 2 ? totalYears * 12 : 24 + (totalYears - 2) * 4;
        const catY = totalYears <= 2 ? totalYears * 12.5 : 25 + (totalYears - 2) * 4;
        setVal('dogAge', Math.floor(dogY) + " yrs");
        setVal('catAge', Math.floor(catY) + " yrs");

        // Mystical
        const d = dob.getDate(), m = dob.getMonth();
        const cutoffs = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
        const zIndex = (d >= cutoffs[m]) ? (m + 1) % 12 : m;
        
        setVal('zodiac', ZODIACS[zIndex]);
        setVal('stone', STONES[m]);
        setVal('season', SEASONS[m]);

        // Life Progress (80 yr baseline)
        const progress = Math.min((totalYears / 80) * 100, 100);
        const bar = document.getElementById('lifeProgressBar');
        if (bar) bar.style.width = progress + "%";
        setVal('progressText', progress.toFixed(4) + "%");
    };

    /**
     * Ticking updates
     */
    const updateRealTimeMetrics = (dob) => {
        const now = new Date();
        const diff = now - dob;

        let y = now.getFullYear() - dob.getFullYear();
        let m = now.getMonth() - dob.getMonth();
        let d = now.getDate() - dob.getDate();

        if (d < 0) {
            m--;
            d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
        }
        if (m < 0) {
            y--;
            m += 12;
        }
        
        document.getElementById('mainAge').innerText = `${y} Years ${m} Months ${d} Days`;

        const hrs = Math.floor((diff / 3600000) % 24);
        const min = Math.floor((diff / 60000) % 60);
        const sec = Math.floor((diff / 1000) % 60);
        document.getElementById('liveTimer').innerText = 
            `${hrs.toString().padStart(2,'0')}h : ${min.toString().padStart(2,'0')}m : ${sec.toString().padStart(2,'0')}s`;

        document.getElementById('totalSeconds').innerText = fmt(Math.floor(diff/1000));
        updateCountdown(now, dob);
    };

    const updateCountdown = (now, dob) => {
        const bdayElem = document.getElementById('nextBday');
        let next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
        if (now > next) next.setFullYear(now.getFullYear() + 1);
        
        const days = Math.ceil((next - now) / 86400000);
        bdayElem.innerText = days === 0 ? "Happy Birthday! 🎉" : `${days} Days Left`;
    };

     // --- Global Actions ---
    window.downloadTxt = () => {
        const getValue = (id) => document.getElementById(id)?.innerText || "0";
        
        // Report Template formatted for clean plain-text reading
        const content = `
================================================
      ULTRA AGE AI - GOD MODE LIFE REPORT
================================================
Generated On: ${new Date().toLocaleString()}

--- CURRENT EXISTENCE DURATION ---
Exact Age      : ${getValue('mainAge')}
Live Timer     : ${getValue('liveTimer')}
Life Progress  : ${getValue('progressText')}

--- TIME EXPANSION ---
Months Alive   : ${getValue('totalMonths')}
Weeks Alive    : ${getValue('totalWeeks')}
Days Alive     : ${getValue('totalDays')}
Hours Alive    : ${getValue('totalHours')}
Minutes Alive  : ${getValue('totalMinutes')}
Seconds Alive  : ${getValue('totalSeconds')}

--- ESTIMATED CONSUMPTION ---
Food Eaten     : ${getValue('foodKg')}
Water Drank    : ${getValue('waterL')}
Steps Walked   : ${getValue('steps')}
Dreams Seen    : ${getValue('dreams')}
Words Spoken   : ${getValue('words')}

--- BIO-ENGINE STATUS ---
Heartbeats     : ${getValue('bioHearts')}
Breaths Taken  : ${getValue('bioBreaths')}
Blood Pumped   : ${getValue('bioBlood')}
Hair Growth    : ${getValue('bioHair')}

--- COSMIC AGE ---
Mercury Age    : ${getValue('ageMerc')}
Venus Age      : ${getValue('ageVen')}
Mars Age       : ${getValue('ageMars')}
Jupiter Age    : ${getValue('ageJup')}
Next Birthday  : ${getValue('nextBday')}

--- MYSTICAL STATS ---
Dog Years      : ${getValue('dogAge')}
Cat Years      : ${getValue('catAge')}
Zodiac Sign    : ${getValue('zodiac')}
Birthstone     : ${getValue('stone')}
Season (BD)    : ${getValue('season')}

================================================
© ${new Date().getFullYear()} Trusted Tools Web
================================================
`.trim();

        // Create Blob and trigger download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ultra_Age_Report_${Date.now()}.txt`;
        
        // Append to body for better browser compatibility
        document.body.appendChild(a); 
        a.click();
        
        // Cleanup memory
        document.body.removeChild(a); 
        URL.revokeObjectURL(url); 

        if (window.showToast) {
            window.showToast("Full Report Exported Successfully!");
        }
    };


    window.toggleTheme = () => {
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('siteTheme', isLight ? 'light' : 'dark');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.classList.toggle('fa-sun', !isLight), icon.classList.toggle('fa-moon', isLight);
    };

    document.addEventListener('DOMContentLoaded', init);
})();