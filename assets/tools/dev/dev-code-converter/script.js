
    /** 
     * UNIVERSAL MASTER ENCODER - SUPREME EDITION V3.5
     * Author: MD KAWSAR
     * Type: Production Ready / CodeCanyon Standard
     * Features: UTF-8 Full Support, Emoji Compatible, Async Hashing, Secure JWT Parsing
     */

    // Namespacing to prevent global scope pollution
    const UME_Engine = (function() {

        // --- PRIVATE VARIABLES ---
        const DOM = {
            in: document.getElementById('TextInput'),
            out: document.getElementById('ResultInput'),
            mode: document.getElementById('codeType'),
            auto: document.getElementById('autoConvert'),
            ac: document.getElementById('autoCopy'),
            lbl: document.getElementById('inputLabel'),
            outLbl: document.getElementById('resultTitle'),
            hist: document.getElementById('historyContainer'),
            file: document.getElementById('fileInput'),
            chips: {
                auto: document.getElementById('autoConvertChip'),
                copy: document.getElementById('autoCopyChip'),
                upload: document.getElementById('uploadBtn'),
                zen: document.getElementById('zenModeBtn')
            },
            btns: {
                enc: document.getElementById('btnEncode'),
                dec: document.getElementById('btnDecode'),
                swap: document.getElementById('btnSwap'),
                speak: document.getElementById('btnSpeak'),
                paste: document.getElementById('btnPaste'),
                clear: document.getElementById('btnClear'),
                copy: document.getElementById('btnCopy'),
                dl: document.getElementById('btnDownload')
            }
        };

        let isProcessing = false; // Flag to prevent recursive loop in auto-convert
        let historyData = [];

        // --- 1. CORE CONVERSION LOGIC ---
        
        /**
         * Main processing hub.
         * @param {string} action - 'encode' or 'decode'
         */
        async function processData(action) {
            if (isProcessing) return;
            isProcessing = true;

            const t0 = performance.now();
            const mode = DOM.mode.value;
            const source = action === 'encode' ? DOM.in : DOM.out;
            const target = action === 'encode' ? DOM.out : DOM.in;
            const val = source.value;

            // Basic Validation
            if (!val && mode !== 'base64img') {
                target.value = '';
                updateStats();
                isProcessing = false;
                return;
            }

            let result = "";
            let errorMsg = null;

            try {
                // Async Hashing Handling
                if (mode === 'sha256' || mode === 'md5') {
                    if (action === 'decode') throw new Error("Hashes are one-way functions (Irreversible).");
                    result = await performHash(val, mode);
                } 
                // Image Handling
                else if (mode === 'base64img') {
                    if (action === 'decode') result = "To view Base64 images, copy the string to a browser URL bar: data:image/png;base64,...";
                    else result = val; // Already populated by file reader
                }
                // Complex Formats
                else if (mode === 'jwt') {
                    if (action === 'encode') result = "JWT is server-signed. Paste a token to Decode.";
                    else result = parseJWT(val);
                }
                else if (mode === 'json') {
                    const obj = JSON.parse(val);
                    result = action === 'encode' ? JSON.stringify(obj, null, 4) : JSON.stringify(obj);
                }
                // Standard Synchronous Conversions
                else {
                    result = standardConvert(val, mode, action);
                }
            } catch (e) {
                errorMsg = e.message;
                result = "Error: " + e.message;
            }

            target.value = result;
            
            // Stats & History
            const t1 = performance.now();
            document.getElementById('timeTaken').innerText = Math.round(t1 - t0) + "ms";
            updateStats();

            if (!errorMsg && val.length > 2 && action === 'encode' && mode !== 'base64img') {
                addToHistory(mode, val);
                if (DOM.ac.checked) navigator.clipboard.writeText(result).catch(()=>{});
            }

            isProcessing = false;
        }

        /**
         * Handles Standard Text/Binary/Hex conversions with UTF-8 support
         */
        function standardConvert(text, mode, action) {
            if (action === 'encode') {
                switch (mode) {
                    case 'binary': return Array.from(text).map(c => c.codePointAt(0).toString(2).padStart(8, '0')).join(' ');
                    case 'hex': return Array.from(text).map(c => c.codePointAt(0).toString(16).toUpperCase()).join(' ');
                    case 'base64': return btoa(unescape(encodeURIComponent(text))); // UTF-8 Safe
                    case 'ascii': return Array.from(text).map(c => c.codePointAt(0)).join(' ');
                    case 'url': return encodeURIComponent(text);
                    case 'morse': return textToMorse(text);
                    default: return text;
                }
            } else {
                let clean = text.trim();
                switch (mode) {
                    case 'binary': return clean.split(/\s+/).map(b => String.fromCodePoint(parseInt(b, 2))).join('');
                    case 'hex': 
                        clean = clean.replace(/[^0-9A-Fa-f]/g, '');
                        if(clean.length % 2 !== 0) throw new Error("Invalid Hex Length");
                        const pairs = clean.match(/.{1,2}/g) || [];
                        return decodeURIComponent(escape(pairs.map(byte => String.fromCharCode(parseInt(byte, 16))).join('')));
                    case 'base64': 
                        clean = clean.replace(/\s/g, '');
                        return decodeURIComponent(escape(atob(clean)));
                    case 'ascii': return clean.split(/\s+/).map(d => String.fromCodePoint(parseInt(d, 10))).join('');
                    case 'url': return decodeURIComponent(text);
                    case 'morse': return morseToText(text);
                    default: return text;
                }
            }
        }

        /**
         * Robust JWT Parser (Header + Payload)
         */
        function parseJWT(token) {
            try {
                const parts = token.split('.');
                if (parts.length !== 3) throw new Error("Invalid JWT Structure (needs 3 parts)");
                
                const decodePart = (str) => {
                    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
                    while (base64.length % 4) base64 += '=';
                    return JSON.parse(decodeURIComponent(escape(window.atob(base64))));
                };

                const header = decodePart(parts[0]);
                const payload = decodePart(parts[1]);
                
                return `// HEADER\n${JSON.stringify(header, null, 4)}\n\n// PAYLOAD\n${JSON.stringify(payload, null, 4)}`;
            } catch (e) {
                throw new Error("Invalid Token: " + e.message);
            }
        }

        /**
         * Secure Hashing (SHA256 / MD5)
         */
        async function performHash(text, type) {
            if (type === 'md5') {
                if (typeof md5 === 'function') return md5(text);
                return "Error: MD5 Library failed to load.";
            }
            if (!crypto || !crypto.subtle) return "Error: HTTPS required for SHA-256.";
            
            const msgBuffer = new TextEncoder().encode(text);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Morse Code Map
        const MORSE = { 'A':'.-', 'B':'-...', 'C':'-.-.', 'D':'-..', 'E':'.', 'F':'..-.', 'G':'--.', 'H':'....', 'I':'..', 'J':'.---', 'K':'-.-', 'L':'.-..', 'M':'--', 'N':'-.', 'O':'---', 'P':'.--.', 'Q':'--.-', 'R':'.-.', 'S':'...', 'T':'-', 'U':'..-', 'V':'...-', 'W':'.--', 'X':'-..-', 'Y':'-.--', 'Z':'--..', '1':'.----', '2':'..---', '3':'...--', '4':'....-', '5':'.....', '6':'-....', '7':'--...', '8':'---..', '9':'----.', '0':'-----', ' ':'/' };
        const REV_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k,v]) => [v, k]));
        function textToMorse(t) { return t.toUpperCase().split('').map(c => MORSE[c] || '').join(' '); }
        function morseToText(t) { return t.split(' ').map(c => REV_MORSE[c] || '').join(''); }

        // --- 2. UI & EVENT HANDLERS ---

        function initListeners() {
            // Typing listeners with Loop Protection
            DOM.in.addEventListener('input', () => {
                updateStats();
                checkStrength();
                if(DOM.auto.checked) processData('encode');
            });

            DOM.out.addEventListener('input', () => {
                const noDecode = ['sha256', 'md5', 'base64img'];
                if(DOM.auto.checked && !noDecode.includes(DOM.mode.value)) processData('decode');
            });

            // Button Actions
            DOM.mode.addEventListener('change', changeMode);
            DOM.btns.enc.onclick = () => processData('encode');
            DOM.btns.dec.onclick = () => processData('decode');
            DOM.btns.swap.onclick = swapContent;
            DOM.btns.copy.onclick = () => copyText(DOM.out.value);
            DOM.btns.paste.onclick = async () => {
                try {
                    const t = await navigator.clipboard.readText();
                    DOM.in.value = t;
                    updateStats();
                    if(DOM.auto.checked) processData('encode');
                } catch(e) { showToast("Clipboard access denied", "error"); }
            };
            DOM.btns.clear.onclick = () => { DOM.in.value = ''; DOM.out.value = ''; updateStats(); };
            DOM.btns.speak.onclick = () => {
                if(!DOM.in.value) return;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(DOM.in.value));
            };
            DOM.btns.dl.onclick = downloadResult;

            // Chip Toggles
            DOM.chips.auto.onclick = (e) => { 
                if(e.target.tagName !== 'INPUT') DOM.auto.checked = !DOM.auto.checked;
                DOM.chips.auto.classList.toggle('active', DOM.auto.checked);
            };
            DOM.chips.copy.onclick = (e) => {
                if(e.target.tagName !== 'INPUT') DOM.ac.checked = !DOM.ac.checked;
            };
            DOM.chips.upload.onclick = () => DOM.file.click();
            DOM.chips.zen.onclick = toggleFullScreen;

            // File Upload
            DOM.file.onchange = handleFileUpload;
        }

        function changeMode() {
            const m = DOM.mode.value;
            const map = {
                'binary': ['Text Input', 'Binary Output'],
                'hex': ['Text Input', 'Hexadecimal'],
                'base64': ['Text Input', 'Base64 String'],
                'base64img': ['Image File', 'Base64 Code'],
                'jwt': ['JWT Token', 'Decoded JSON'],
                'json': ['Raw JSON', 'Beautified/Minified'],
                'sha256': ['Text Input', 'SHA-256 Hash'],
                'md5': ['Text Input', 'MD5 Hash'],
                'ascii': ['🔢 ASCII Codes', 'Text Output'],
                'morse': ['📡 Morse Code', 'Text Output'],
                'url': ['🌐 URL Encode', 'Decoded URL']
            };

            DOM.lbl.innerText = map[m] ? map[m][0] : 'Input Data';
            DOM.outLbl.innerHTML = `<i class="fa-solid fa-code"></i> ${map[m] ? map[m][1] : 'Output Result'}`;

            // Image Mode UI Adjustment
            if(m === 'base64img') {
                DOM.chips.upload.classList.add('active');
                DOM.chips.upload.style.borderColor = 'var(--primary-color)';
                DOM.in.placeholder = "Upload an image using the button above...";
                DOM.in.readOnly = true;
            } else {
                DOM.chips.upload.classList.remove('active');
                DOM.chips.upload.style.borderColor = 'var(--border-color)';
                DOM.in.placeholder = "Type or paste content here...";
                DOM.in.readOnly = false;
            }

            if(DOM.in.value && m !== 'base64img') processData('encode');
        }

        function swapContent() {
            if(DOM.mode.value === 'base64img') return showToast("Image mode cannot be swapped!", "error");
            
            const temp = DOM.in.value;
            DOM.in.value = DOM.out.value;
            DOM.out.value = temp;
            
            checkStrength();
            updateStats();
            
            // Intelligent Swap: If we swapped, we likely want to decode the previous result
            const oneWay = ['sha256', 'md5'];
            if(!oneWay.includes(DOM.mode.value) && DOM.in.value) {
                processData('decode');
                showToast("Swapped & Decoded!");
            }
        }

        function handleFileUpload(e) {
            const file = e.target.files[0];
            if(!file) return;

            // Limit check (5MB soft limit to prevent freeze)
            if(file.size > 5 * 1024 * 1024) showToast("Large file detected. Browser may freeze.", "error");

            if(DOM.mode.value === 'base64img' || file.type.startsWith('image/')) {
                DOM.mode.value = 'base64img';
                changeMode();
                const reader = new FileReader();
                reader.onload = (ev) => {
                    DOM.out.value = ev.target.result;
                    DOM.in.value = `[IMAGE LOADED]\nName: ${file.name}\nSize: ${(file.size/1024).toFixed(2)} KB\nType: ${file.type}`;
                    updateStats();
                    showToast("Image Converted!");
                };
                reader.readAsDataURL(file);
            } else {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    DOM.in.value = ev.target.result;
                    processData('encode');
                    showToast("Text File Loaded");
                };
                reader.readAsText(file);
            }
        }

        // --- 3. UTILITIES ---

        function updateStats() {
            DOM.document.getElementById('charCount').innerText = DOM.in.value.length + " Chars";
            DOM.document.getElementById('resultCount').innerText = DOM.out.value.length + " Length";
        }

        function checkStrength() {
            const val = DOM.in.value;
            const line = document.getElementById('strengthMeter');
            const meter = document.getElementById('sFill');
            if(!val) { line.style.display = 'none'; return; }
            
            line.style.display = 'block';
            let score = 0;
            if(val.length > 8) score++;
            if(/[A-Z]/.test(val)) score++;
            if(/[0-9]/.test(val)) score++;
            if(/[^A-Za-z0-9]/.test(val)) score++;

            const colors = ['#ff0055', '#ff9f43', '#00d2ff', '#00ff9d'];
            const w = ['25%', '50%', '75%', '100%'];
            meter.style.width = w[score-1] || '10%';
            meter.style.background = colors[score-1] || colors[0];
        }

        function copyText(txt) {
            if(!txt) return showToast("Nothing to copy", "error");
            navigator.clipboard.writeText(txt)
                .then(() => showToast("Copied to Clipboard!"))
                .catch(() => showToast("Copy Failed", "error"));
        }

        function downloadResult() {
            if(!DOM.out.value) return;
            const b = new Blob([DOM.out.value], {type: "text/plain"});
            const l = document.createElement("a");
            l.href = URL.createObjectURL(b);
            l.download = `trusted-tools-${DOM.mode.value}-${Date.now()}.txt`;
            l.click();
        }

        function showToast(msg, type='success') {
            const container = document.getElementById('toast-container');
            const b = document.createElement('div');
            b.className = `toast-msg ${type}`;
            b.innerHTML = type==='error' ? `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}` : `<i class="fa-solid fa-circle-check"></i> ${msg}`;
            container.appendChild(b);
            setTimeout(() => b.remove(), 3000);
        }

        function toggleFullScreen() {
            if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
            else if(document.exitFullscreen) document.exitFullscreen();
        }

        // --- 4. HISTORY ---
        function renderHistory() {
            try {
                historyData = JSON.parse(localStorage.getItem('ttw_history')) || [];
            } catch(e) { historyData = []; }
            
            DOM.hist.innerHTML = historyData.length ? '' : '<span style="color:var(--text-faint); font-size:0.9rem; padding:10px;">No history yet...</span>';
            [...historyData].reverse().forEach(item => {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.innerHTML = `<div class="h-text"><b>${item.mode}:</b> ${item.val.substring(0,20)}...</div><div class="h-time">${item.time}</div>`;
                div.onclick = () => { 
                    DOM.in.value = item.val; 
                    DOM.mode.value = item.mode; 
                    changeMode(); 
                    showToast("History Loaded");
                };
                DOM.hist.appendChild(div);
            });
        }

        function addToHistory(mode, val) {
            if(historyData.length > 0 && historyData[historyData.length-1].val === val) return;
            historyData.push({mode, val, time: new Date().toLocaleTimeString()});
            if(historyData.length > 10) historyData.shift();
            localStorage.setItem('ttw_history', JSON.stringify(historyData));
            renderHistory();
        }

        // --- 5. INITIALIZATION ---
        return {
            init: () => {
                initListeners();
                renderHistory();
            }
        };

    })();

    // --- MATRIX ANIMATION CONTROLLER (PERFORMANCE OPTIMIZED) ---
    const MatrixFX = (function() {
        const canvas = document.getElementById('matrixCanvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const chars = '01TRUSTEDTOOLSWEB'.split('');
        
        // OPTIMIZATION: Check if Mobile. Larger font = fewer columns = less CPU/Battery usage
        const isMobile = window.innerWidth < 768;
        const fontSize = isMobile ? 18 : 12; 
        
        let columns = 0;
        let drops = [];
        let animationId;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            columns = canvas.width / fontSize;
            drops = Array(Math.floor(columns)).fill(1);
        }

        function draw() {
            ctx.fillStyle = 'rgba(5, 5, 5, 0.08)'; // Higher opacity for faster fade (better performance)
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#00ff9d';
            ctx.font = fontSize + 'px monospace';

            for(let i=0; i<drops.length; i++) {
                const text = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(text, i*fontSize, drops[i]*fontSize);
                if(drops[i]*fontSize > canvas.height && Math.random() > 0.985) drops[i] = 0;
                drops[i]++;
            }
            animationId = requestAnimationFrame(draw);
        }

        // Start
        window.addEventListener('resize', resize);
        resize();
        draw();

        // Performance: Stop animation if tab is hidden
        document.addEventListener('visibilitychange', () => {
            if(document.hidden) cancelAnimationFrame(animationId);
            else draw();
        });
    })();

    // Initialize Engine when DOM is Ready
    document.addEventListener('DOMContentLoaded', UME_Engine.init);

  