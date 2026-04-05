/**
 * ============================================================================
 * BULK DATA EXTRACTOR & REGEX MINER PRO — script.js
 * Tool Path : assets/tools/text/text-data-extractor/
 * Author    : Trusted Tools Web — MD KAWSAR
 * Version   : 2.1.0 (CodeCanyon Release Build)
 *
 * Architecture:
 *  - IIFE-wrapped to avoid global scope pollution.
 *  - Modular object-literal pattern: State, Dom, Patterns,
 *    Extractor, FileProcessor, OCRProcessor, Analytics,
 *    DomainMap, Exporter, UI.
 *  - 100% client-side — no server calls at any point.
 *  - Toast notifications use the global window.showToast() system.
 *    Error toasts pass boolean true as second argument.
 * ============================================================================
 */

(function () {
    'use strict';

    /* ========================================================================
       § 1. APPLICATION STATE
    ======================================================================== */
    const State = {
        /** Extraction results keyed by data type */
        results: { emails: [], phones: [], urls: [], ips: [], custom: [] },
        /** Currently active output type filter */
        activeResultType: 'all',
        /** Chart.js instance — destroyed before re-render to avoid canvas error */
        chartInstance: null,
        /** Prevents duplicate concurrent OCR jobs */
        ocrRunning: false
    };

    /* ========================================================================
       § 2. DOM REFERENCES — cached once at startup
    ======================================================================== */
    const Dom = {
        inputText          : document.getElementById('inputText'),
        charCount          : document.getElementById('charCount'),
        fileInput          : document.getElementById('fileInput'),
        browseFilesBtn     : document.getElementById('browseFilesBtn'),
        dropzone           : document.getElementById('dropzone'),
        dropzoneInner      : document.getElementById('dropzoneInner'),
        dropzoneLoading    : document.getElementById('dropzoneLoading'),
        dropzoneLoadingMsg : document.getElementById('dropzoneLoadingMsg'),
        ocrInput           : document.getElementById('ocrInput'),
        ocrUploadBtn       : document.getElementById('ocrUploadBtn'),
        ocrFilename        : document.getElementById('ocrFilename'),
        ocrProgressWrap    : document.getElementById('ocrProgressWrap'),
        ocrProgressFill    : document.getElementById('ocrProgressFill'),
        ocrProgressLabel   : document.getElementById('ocrProgressLabel'),
        filterCheckboxes   : document.querySelectorAll('input[name="filter"]'),
        customRegexWrap    : document.getElementById('customRegexWrap'),
        customRegex        : document.getElementById('customRegex'),
        customRegexFlags   : document.getElementById('customRegexFlags'),
        regexStatus        : document.getElementById('regexStatus'),
        optDedup           : document.getElementById('optDedup'),
        optSort            : document.getElementById('optSort'),
        optGroupByDomain   : document.getElementById('optGroupByDomain'),
        optStripProtocol   : document.getElementById('optStripProtocol'),
        btnExtract         : document.getElementById('btnExtract'),
        btnReset           : document.getElementById('btnReset'),
        outputResults      : document.getElementById('outputResults'),
        outputEmptyState   : document.getElementById('outputEmptyState'),
        typeBtns           : document.querySelectorAll('.bde-type-btn'),
        tabBadgeResults    : document.getElementById('tabBadgeResults'),
        tabBtns            : document.querySelectorAll('.tab-btn'),
        btnCopy            : document.getElementById('btnCopy'),
        btnDownloadCSV     : document.getElementById('btnDownloadCSV'),
        btnDownloadZIP     : document.getElementById('btnDownloadZIP'),
        chartCanvas        : document.getElementById('chartDoughnut'),
        chartCenterNum     : document.getElementById('chartCenterNum'),
        analyticsLegend    : document.getElementById('analyticsLegend'),
        analyticsCards     : document.getElementById('analyticsCards'),
        domainList         : document.getElementById('domainList'),
        statTotalFound     : document.getElementById('statTotalFound'),
        statEmails         : document.getElementById('statEmails'),
        statPhones         : document.getElementById('statPhones'),
        statUrls           : document.getElementById('statUrls'),
        statIps            : document.getElementById('statIps'),
        chipCountEmails    : document.getElementById('chipCountEmails'),
        chipCountPhones    : document.getElementById('chipCountPhones'),
        chipCountUrls      : document.getElementById('chipCountUrls'),
        chipCountIps       : document.getElementById('chipCountIps'),
        chipCountCustom    : document.getElementById('chipCountCustom'),
    };

    /* ========================================================================
       § 3. REGEX PATTERNS
    ======================================================================== */
    const Patterns = {
        /**
         * Email — RFC 5322-inspired. Handles plus-addressing, subdomains,
         * international TLDs, and IP literal domain parts.
         */
        email: /(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi,

        /**
         * Phone — E.164, NANP, UK, European, Asian formats.
         * Post-filtered to 7–15 digits to remove false positives.
         */
        phone: /(?:(?:\+|00)(?:[1-9]\d{0,3})[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?)(?:\d{1,4}[\s.-]?){1,5}\d{2,4}/g,

        /** URL — http/https/ftp, paths, query strings, fragments */
        url: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*[-a-zA-Z0-9@:%_+~#?&/=])?/gi,

        /** IPv4 — strict 0–255 octet validation with word boundaries */
        ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\b/g,

        /** IPv6 — full and compressed forms including :: notation */
        ipv6: /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}/g,
    };

    /* ========================================================================
       § 4. CORE EXTRACTION ENGINE
    ======================================================================== */
    const Extractor = {

        /**
         * Run all enabled filter patterns against the input text.
         * Apply deduplication and sorting based on option toggles.
         * @param {string} text
         * @returns {Object} results keyed by type
         */
        run(text) {
            const results = { emails: [], phones: [], urls: [], ips: [], custom: [] };

            const activeFilters = Array.from(Dom.filterCheckboxes)
                .filter(cb => cb.checked).map(cb => cb.value);

            if (!text.trim() || activeFilters.length === 0) return results;

            /* Emails */
            if (activeFilters.includes('emails')) {
                Patterns.email.lastIndex = 0;
                results.emails = text.match(Patterns.email) || [];
            }

            /* Phones — post-filter to valid digit lengths (7–15) */
            if (activeFilters.includes('phones')) {
                Patterns.phone.lastIndex = 0;
                results.phones = (text.match(Patterns.phone) || []).filter(p => {
                    const d = p.replace(/\D/g, '');
                    return d.length >= 7 && d.length <= 15;
                });
            }

            /* URLs — optionally strip protocol prefix */
            if (activeFilters.includes('urls')) {
                Patterns.url.lastIndex = 0;
                let raw = text.match(Patterns.url) || [];
                if (Dom.optStripProtocol.checked) {
                    raw = raw.map(u => u.replace(/^https?:\/\//i, ''));
                }
                results.urls = raw;
            }

            /* IPs — merge IPv4 and IPv6 results */
            if (activeFilters.includes('ips')) {
                Patterns.ipv4.lastIndex = 0;
                Patterns.ipv6.lastIndex = 0;
                results.ips = [
                    ...(text.match(Patterns.ipv4) || []),
                    ...(text.match(Patterns.ipv6) || [])
                ];
            }

            /* Custom Regex — user-defined pattern with flags */
            if (activeFilters.includes('custom')) {
                const pattern = Dom.customRegex.value.trim();
                const flags   = Dom.customRegexFlags.value.trim() || 'gi';
                if (pattern) {
                    try {
                        results.custom = text.match(new RegExp(pattern, flags)) || [];
                    } catch (e) { /* Invalid regex — results stay empty */ }
                }
            }

            /* Post-processing: deduplication and alphabetical sort */
            const doDedup = Dom.optDedup.checked;
            const doSort  = Dom.optSort.checked;
            Object.keys(results).forEach(type => {
                if (doDedup) results[type] = [...new Set(results[type])];
                if (doSort)  results[type] = results[type].sort((a, b) =>
                    a.toLowerCase().localeCompare(b.toLowerCase())
                );
            });

            return results;
        },

        /**
         * Format results for display in the output textarea.
         * 'all' produces sectioned output with headers; specific types are plain lists.
         * @param {Object} results
         * @param {string} type
         * @returns {string}
         */
        toOutputString(results, type) {
            const labelMap = {
                emails: '📧 EMAILS', phones: '📞 PHONE NUMBERS',
                urls: '🔗 URLs', ips: '🌐 IP ADDRESSES', custom: '🔍 CUSTOM REGEX'
            };

            if (type !== 'all') return results[type].join('\n');

            const lines = [];
            Object.entries(results).forEach(([key, arr]) => {
                if (arr.length === 0) return;
                lines.push(`── ${labelMap[key]} (${arr.length}) ──`);
                lines.push(...arr);
                lines.push('');
            });
            return lines.join('\n').trim();
        }
    };

    /* ========================================================================
       § 5. FILE PROCESSING
    ======================================================================== */
    const FileProcessor = {

        /**
         * Read one or more text files using the FileReader API.
         * Files are validated for size, then read concurrently and concatenated.
         * @param {FileList} files
         */
        readTextFiles(files) {
            if (!files || files.length === 0) return;

            const validFiles = Array.from(files).filter(file => {
                if (file.size > 50 * 1024 * 1024) {
                    window.showToast(`"${file.name}" exceeds the 50MB file size limit.`, true);
                    return false;
                }
                return true;
            });

            if (validFiles.length === 0) return;

            /* Show loading overlay in the drop zone */
            Dom.dropzoneInner.style.display    = 'none';
            Dom.dropzoneLoading.style.display  = 'flex';
            Dom.dropzoneLoadingMsg.textContent = `Reading ${validFiles.length} file(s)...`;

            let combinedText = Dom.inputText.value;
            let pending      = validFiles.length;

            validFiles.forEach(file => {
                const reader = new FileReader();

                reader.onload = function (e) {
                    combinedText += (combinedText ? '\n\n' : '') + e.target.result;
                    if (--pending === 0) {
                        Dom.inputText.value               = combinedText;
                        UI.updateCharCount();
                        Dom.dropzoneInner.style.display   = 'flex';
                        Dom.dropzoneLoading.style.display = 'none';
                        window.showToast(`${validFiles.length} file(s) loaded successfully.`);
                    }
                };

                reader.onerror = function () {
                    window.showToast(`Error reading "${file.name}".`, true);
                    if (--pending === 0) {
                        Dom.dropzoneInner.style.display   = 'flex';
                        Dom.dropzoneLoading.style.display = 'none';
                    }
                };

                reader.readAsText(file, 'UTF-8');
            });
        }
    };

    /* ========================================================================
       § 6. OCR ENGINE (Tesseract.js) - UPDATED FOR LOCAL (CODECANYON)
    ======================================================================== */
    const OCRProcessor = {

        /**
         * Process an image file through Tesseract.js running via WebAssembly.
         * Appends recognised text to the main textarea.
         * Updates the progress bar via the Tesseract logger callback.
         * Forces local loading of worker, core, and language data.
         * @param {File} file
         */
        async process(file) {
            if (State.ocrRunning) {
                window.showToast('OCR is already running. Please wait for it to finish.');
                return;
            }
            if (!file.type.startsWith('image/')) {
                window.showToast('Please upload a valid image file (.jpg, .png, .webp).', true);
                return;
            }

            State.ocrRunning                  = true;
            Dom.ocrProgressWrap.style.display = 'block';
            Dom.ocrProgressFill.style.width   = '0%';
            Dom.ocrProgressLabel.textContent  = 'Initializing OCR engine...';
            Dom.ocrFilename.textContent       = file.name;

            try {
                // Initialize worker with local paths based on your directory structure
                const worker = await Tesseract.createWorker({
                    workerPath: '../../assets/library/media-vision/tesseract/worker.min.js',
                    corePath: '../../assets/library/media-vision/tesseract/tesseract-core.wasm.js',
                    langPath: '../../assets/library/media-vision/tesseract/lang-data',
                    logger: (log) => {
                        if (log.status === 'recognizing text') {
                            const pct = Math.round(log.progress * 100);
                            Dom.ocrProgressFill.style.width  = `${pct}%`;
                            Dom.ocrProgressLabel.textContent = `Recognizing text... ${pct}%`;
                        } else if (log.status === 'loading tesseract core') {
                            Dom.ocrProgressLabel.textContent = 'Loading OCR core...';
                            Dom.ocrProgressFill.style.width  = '20%';
                        } else if (log.status === 'initialized api') {
                            Dom.ocrProgressLabel.textContent = 'Engine ready. Analysing image...';
                            Dom.ocrProgressFill.style.width  = '40%';
                        }
                    }
                });

                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                const result = await worker.recognize(file);
                
                const recognizedText = result.data.text.trim();
                if (recognizedText) {
                    const existing        = Dom.inputText.value;
                    Dom.inputText.value   = existing
                        ? existing + '\n\n── OCR EXTRACTED TEXT ──\n' + recognizedText
                        : recognizedText;
                    UI.updateCharCount();
                    window.showToast('OCR complete! Extracted text has been appended to input.');
                } else {
                    window.showToast('OCR could not find readable text in this image.');
                }
                
                // Important: Terminate the worker after job is done to free up memory
                await worker.terminate();

            } catch (err) {
                console.error('[DataExtractor] OCR Error:', err);
                window.showToast('OCR failed. Please ensure local files are loaded correctly.', true);
            } finally {
                Dom.ocrProgressFill.style.width  = '100%';
                Dom.ocrProgressLabel.textContent = 'Done.';
                setTimeout(() => {
                    Dom.ocrProgressWrap.style.display = 'none';
                    Dom.ocrProgressFill.style.width   = '0%';
                }, 1500);
                State.ocrRunning = false;
            }
        }
    };

    /* ========================================================================
       § 7. ANALYTICS DASHBOARD (Chart.js)
    ======================================================================== */
    const Analytics = {

        colorMap: {
            emails : { fill: '#00e5ff' }, phones : { fill: '#ff6b35' },
            urls   : { fill: '#a78bfa' }, ips    : { fill: '#4ade80' },
            custom : { fill: '#fbbf24' },
        },

        labelMap: {
            emails: 'Emails', phones: 'Phones', urls: 'URLs',
            ips: 'IP Addresses', custom: 'Custom Regex'
        },

        /**
         * Render or re-render the doughnut chart with current results.
         * Destroys any previous Chart.js instance first.
         * @param {Object} results
         */
        render(results) {
            const types  = Object.keys(results);
            const counts = types.map(t => results[t].length);
            const total  = counts.reduce((a, b) => a + b, 0);
            const colors = types.map(t => this.colorMap[t].fill);

            Dom.chartCenterNum.textContent = total;

            if (State.chartInstance) {
                State.chartInstance.destroy();
                State.chartInstance = null;
            }

            if (total === 0) {
                Dom.analyticsLegend.innerHTML = `
                    <div class="bde-analytics-empty">
                        <i class="fa-solid fa-chart-pie"></i>
                        <p>Run an extraction to see analytics</p>
                    </div>`;
                Dom.analyticsCards.innerHTML = '';
                return;
            }

            const ctx = Dom.chartCanvas.getContext('2d');
            State.chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels  : types.map(t => this.labelMap[t]),
                    datasets: [{
                        data            : counts,
                        backgroundColor : colors,
                        borderColor     : colors.map(c => c + '44'),
                        borderWidth     : 2,
                        hoverOffset     : 8,
                        hoverBorderWidth: 0,
                    }]
                },
                options: {
                    responsive         : true,
                    maintainAspectRatio: true,
                    cutout             : '72%',
                    animation          : { animateRotate: true, duration: 600 },
                    plugins: {
                        legend : { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                                    return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });

            this.renderLegend(results, total);
            this.renderCards(results);
        },

        /**
         * Build the custom legend HTML beside the doughnut.
         */
        renderLegend(results, total) {
            const html = Object.entries(results)
                .filter(([, arr]) => arr.length > 0)
                .map(([type, arr]) => {
                    const pct   = total > 0 ? ((arr.length / total) * 100).toFixed(1) : 0;
                    const color = this.colorMap[type].fill;
                    return `
                    <div class="legend-item">
                        <div class="legend-dot" style="background:${color};"></div>
                        <span class="legend-label">${this.labelMap[type]}</span>
                        <span class="legend-value">${arr.length}<span class="legend-pct">${pct}%</span></span>
                    </div>`;
                }).join('');

            Dom.analyticsLegend.innerHTML = html || `
                <div class="bde-analytics-empty"><p>No data types matched.</p></div>`;
        },

        /**
         * Render four stat cards: Total, Unique, Email Domains, Top Domain.
         */
        renderCards(results) {
            const allItems = Object.values(results).flat();
            const total    = allItems.length;

            let topDomain = '—';
            if (results.emails.length > 0) {
                const counts = {};
                results.emails.forEach(e => {
                    const d = e.split('@')[1]?.toLowerCase();
                    if (d) counts[d] = (counts[d] || 0) + 1;
                });
                topDomain = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
            }

            const uniqueDomains = new Set(
                results.emails.map(e => e.split('@')[1]?.toLowerCase()).filter(Boolean)
            ).size;

            Dom.analyticsCards.innerHTML = `
                <div class="analytics-card">
                    <div class="analytics-card-icon" style="color:#00e5ff;"><i class="fa-solid fa-database"></i></div>
                    <div class="analytics-card-num"  style="color:#00e5ff;">${total}</div>
                    <div class="analytics-card-label">Total Items</div>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-icon" style="color:#4ade80;"><i class="fa-solid fa-copy"></i></div>
                    <div class="analytics-card-num"  style="color:#4ade80;">${new Set(allItems).size}</div>
                    <div class="analytics-card-label">Unique Items</div>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-icon" style="color:#a78bfa;"><i class="fa-solid fa-at"></i></div>
                    <div class="analytics-card-num"  style="color:#a78bfa;">${uniqueDomains}</div>
                    <div class="analytics-card-label">Email Domains</div>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-icon" style="color:#fbbf24;"><i class="fa-solid fa-star"></i></div>
                    <div class="analytics-card-num"  style="font-size:0.9rem; color:#fbbf24;">${topDomain}</div>
                    <div class="analytics-card-label">Top Domain</div>
                </div>`;
        }
    };

    /* ========================================================================
       § 8. DOMAIN MAP
    ======================================================================== */
    const DomainMap = {

        /**
         * Build a frequency bar list of email domains sorted by count.
         * @param {string[]} emails
         */
        render(emails) {
            if (emails.length === 0) {
                Dom.domainList.innerHTML = `
                    <div class="bde-analytics-empty">
                        <i class="fa-solid fa-sitemap"></i>
                        <p>Extract emails to see domain map</p>
                    </div>`;
                return;
            }

            const counts = {};
            emails.forEach(email => {
                const domain = email.split('@')[1]?.toLowerCase();
                if (domain) counts[domain] = (counts[domain] || 0) + 1;
            });

            const sorted   = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const maxCount = sorted[0]?.[1] || 1;

            Dom.domainList.innerHTML = sorted.map(([domain, count]) => `
                <div class="domain-item">
                    <span class="domain-name">@${domain}</span>
                    <div class="domain-bar-wrap">
                        <div class="domain-bar" style="width:${Math.round((count / maxCount) * 100)}%;"></div>
                    </div>
                    <span class="domain-count">${count}</span>
                </div>`).join('');
        }
    };

    /* ========================================================================
       § 9. EXPORT FUNCTIONS
    ======================================================================== */
    const Exporter = {

        /** Copy output textarea content to clipboard */
        copy() {
            const text = Dom.outputResults.value;
            if (!text.trim()) return;
            navigator.clipboard.writeText(text)
                .then(() => window.showToast('Results copied to clipboard!'))
                .catch(() => {
                    Dom.outputResults.select();
                    document.execCommand('copy');
                    window.showToast('Results copied to clipboard!');
                });
        },

        /** Download current output as a .csv file */
        downloadCSV() {
            const type    = State.activeResultType;
            const results = State.results;
            let csv = '', filename = 'extracted-data.csv';

            if (type === 'all') {
                const rows = [['Type', 'Value']];
                Object.entries(results).forEach(([t, arr]) => arr.forEach(v => rows.push([t, v])));
                csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\r\n');
            } else {
                const header = type.charAt(0).toUpperCase() + type.slice(1);
                const rows   = [[header], ...results[type].map(v => [v])];
                csv      = rows.map(r => `"${r[0].replace(/"/g, '""')}"`).join('\r\n');
                filename = `extracted-${type}.csv`;
            }

            this._download(csv, filename, 'text/csv;charset=utf-8;');
        },

        /** Create and download a ZIP archive via JSZip + FileSaver */
        async downloadZIP() {
            if (typeof JSZip === 'undefined') {
                window.showToast('JSZip library is not loaded.', true); return;
            }
            if (typeof saveAs === 'undefined') {
                window.showToast('FileSaver library is not loaded.', true); return;
            }

            Dom.btnDownloadZIP.disabled  = true;
            Dom.btnDownloadZIP.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Zipping...';

            const zip    = new JSZip();
            const folder = zip.folder('extracted-data');
            let hasContent = false;

            const fileMap = { emails: 'emails.txt', phones: 'phones.txt',
                              urls: 'urls.txt', ips: 'ip-addresses.txt', custom: 'custom-regex.txt' };

            Object.entries(State.results).forEach(([type, arr]) => {
                if (arr.length > 0) { folder.file(fileMap[type], arr.join('\n')); hasContent = true; }
            });

            if (!hasContent) {
                window.showToast('No extracted data available to export.');
                Dom.btnDownloadZIP.disabled  = false;
                Dom.btnDownloadZIP.innerHTML = '<i class="fa-solid fa-file-zipper"></i> ZIP Archive';
                return;
            }

            try {
                const total  = Object.values(State.results).flat().length;
                const readme = [
                    'BULK DATA EXTRACTOR — Export Package',
                    '=====================================',
                    `Exported On : ${new Date().toLocaleString()}`,
                    `Total Items : ${total}`, '',
                    'Included Files:',
                    ...Object.entries(State.results)
                        .filter(([, a]) => a.length > 0)
                        .map(([t, a]) => `  ${fileMap[t]} — ${a.length} item(s)`)
                ].join('\n');
                folder.file('README.txt', readme);

                const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
                saveAs(blob, `extracted-data-${Date.now()}.zip`);
                window.showToast('ZIP archive downloaded successfully!');
            } catch (err) {
                console.error('[DataExtractor] ZIP error:', err);
                window.showToast('Failed to create ZIP archive.', true);
            } finally {
                Dom.btnDownloadZIP.disabled  = false;
                Dom.btnDownloadZIP.innerHTML = '<i class="fa-solid fa-file-zipper"></i> ZIP Archive';
            }
        },

        /** Create a Blob URL download with UTF-8 BOM for Excel compatibility */
        _download(content, filename, mimeType) {
            const blob = new Blob(['\ufeff', content], { type: mimeType });
            const url  = URL.createObjectURL(blob);
            const a    = Object.assign(document.createElement('a'),
                         { href: url, download: filename, style: 'display:none' });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showToast(`Downloaded: ${filename}`);
        }
    };

    /* ========================================================================
       § 10. UI HELPERS
    ======================================================================== */
    const UI = {

        /** Update live character count above the textarea */
        updateCharCount() {
            const len = Dom.inputText.value.length;
            Dom.charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
        },

        /**
         * Update hero stats bar with animated pop on each number.
         * @param {Object} results
         */
        updateHeroStats(results) {
            const total = Object.values(results).flat().length;
            [
                [Dom.statTotalFound, total],
                [Dom.statEmails,     results.emails.length],
                [Dom.statPhones,     results.phones.length],
                [Dom.statUrls,       results.urls.length],
                [Dom.statIps,        results.ips.length],
            ].forEach(([el, val]) => {
                el.textContent = val.toLocaleString();
                el.closest('.bde-hero-stat')?.classList.add('updated');
                setTimeout(() => el.closest('.bde-hero-stat')?.classList.remove('updated'), 400);
            });
        },

        /** Update count badges on each filter chip */
        updateChipCounts(results) {
            Dom.chipCountEmails.textContent = results.emails.length;
            Dom.chipCountPhones.textContent = results.phones.length;
            Dom.chipCountUrls.textContent   = results.urls.length;
            Dom.chipCountIps.textContent    = results.ips.length;
            Dom.chipCountCustom.textContent = results.custom.length;
        },

        /** Update the Results tab badge */
        updateTabBadge(count) {
            Dom.tabBadgeResults.textContent = count.toLocaleString();
        },

        /** Write text to the output textarea and toggle the empty state overlay */
        renderOutput(text) {
            Dom.outputResults.value = text;
            Dom.outputEmptyState.classList.toggle('hidden', !!text.trim());
        },

        /** Enable or disable all export buttons */
        setExportEnabled(hasData) {
            Dom.btnCopy.disabled        = !hasData;
            Dom.btnDownloadCSV.disabled = !hasData;
            Dom.btnDownloadZIP.disabled = !hasData;
        },

        /** Switch the output display to a specific result type */
        setResultType(type) {
            State.activeResultType = type;
            Dom.typeBtns.forEach(btn =>
                btn.classList.toggle('active', btn.dataset.resultType === type));
            this.renderOutput(Extractor.toOutputString(State.results, type));
        },

        /** Switch between Results / Analytics / Domain Map tab panels */
        switchTab(tabId) {
            Dom.tabBtns.forEach(btn =>
                btn.classList.toggle('active', btn.dataset.tab === tabId));
            document.querySelectorAll('.tab-panel').forEach(panel =>
                panel.classList.toggle('active', panel.id === `view-${tabId}`));
        },

        /** Validate the custom regex pattern in real-time */
        validateCustomRegex() {
            const pattern = Dom.customRegex.value.trim();
            const flags   = Dom.customRegexFlags.value.trim() || 'gi';
            if (!pattern) { Dom.regexStatus.textContent = ''; return; }
            try {
                new RegExp(pattern, flags);
                Dom.regexStatus.textContent = '✓ Valid pattern';
                Dom.regexStatus.className   = 'bde-regex-status valid';
            } catch (e) {
                Dom.regexStatus.textContent = '✗ ' + e.message;
                Dom.regexStatus.className   = 'bde-regex-status invalid';
            }
        },

        /** Reset the entire tool to its factory default state */
        reset() {
            Dom.inputText.value = '';
            this.updateCharCount();
            Dom.outputResults.value = '';
            Dom.outputEmptyState.classList.remove('hidden');
            this.setExportEnabled(false);

            Object.keys(State.results).forEach(k => (State.results[k] = []));
            this.updateHeroStats(State.results);
            this.updateChipCounts(State.results);
            this.updateTabBadge(0);
            this.setResultType('all');

            if (State.chartInstance) { State.chartInstance.destroy(); State.chartInstance = null; }
            Dom.chartCenterNum.textContent = '0';
            Dom.analyticsLegend.innerHTML  = `
                <div class="bde-analytics-empty">
                    <i class="fa-solid fa-chart-pie"></i>
                    <p>Run an extraction to see analytics</p>
                </div>`;
            Dom.analyticsCards.innerHTML = '';
            Dom.domainList.innerHTML = `
                <div class="bde-analytics-empty">
                    <i class="fa-solid fa-sitemap"></i>
                    <p>Extract emails to see domain map</p>
                </div>`;

            Dom.ocrFilename.textContent = 'No file selected';
            Dom.ocrInput.value          = '';

            Dom.filterCheckboxes.forEach(cb => {
                cb.checked = ['emails', 'phones', 'urls', 'ips'].includes(cb.value);
            });
            Dom.customRegexWrap.style.display = 'none';
            Dom.optDedup.checked         = true;
            Dom.optSort.checked          = false;
            Dom.optGroupByDomain.checked = false;
            Dom.optStripProtocol.checked = false;

            window.showToast('Tool has been reset to its initial state.');
        }
    };

    /* ========================================================================
       § 11. MAIN EXTRACTION HANDLER
    ======================================================================== */
    function handleExtract() {
        const text = Dom.inputText.value;
        if (!text.trim()) {
            window.showToast('Please enter or upload some text before extracting.');
            return;
        }

        Dom.btnExtract.disabled = true;
        Dom.btnExtract.querySelector('span').textContent = 'Extracting...';

        /* Defer heavy processing to allow the browser to repaint the button */
        setTimeout(() => {
            try {
                const results = Extractor.run(text);
                Object.assign(State.results, results);

                const total = Object.values(results).flat().length;
                UI.updateHeroStats(results);
                UI.updateChipCounts(results);
                UI.updateTabBadge(total);
                UI.setResultType(State.activeResultType);
                UI.setExportEnabled(total > 0);
                Analytics.render(results);
                DomainMap.render(results.emails);

                if (total > 0) {
                    window.showToast(`Extraction complete! Found ${total.toLocaleString()} item(s).`);
                } else {
                    window.showToast('No matching data found. Try adjusting your filters or input.');
                }
            } catch (err) {
                console.error('[DataExtractor] Extraction error:', err);
                window.showToast('An unexpected error occurred during extraction.', true);
            } finally {
                Dom.btnExtract.disabled = false;
                Dom.btnExtract.querySelector('span').textContent = 'Extract Data';
            }
        }, 10);
    }

    /* ========================================================================
       § 12. EVENT LISTENERS
    ======================================================================== */
    function initEventListeners() {

        Dom.btnExtract.addEventListener('click', handleExtract);
        Dom.btnReset.addEventListener('click', () => UI.reset());
        Dom.inputText.addEventListener('input', () => UI.updateCharCount());
        Dom.browseFilesBtn.addEventListener('click', () => Dom.fileInput.click());

        Dom.fileInput.addEventListener('change', (e) => {
            FileProcessor.readTextFiles(e.target.files);
            e.target.value = '';
        });

        Dom.dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); Dom.dropzone.classList.add('drag-over'); });
        Dom.dropzone.addEventListener('dragleave', ()  => { Dom.dropzone.classList.remove('drag-over'); });
        Dom.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            Dom.dropzone.classList.remove('drag-over');
            FileProcessor.readTextFiles(e.dataTransfer.files);
        });
        Dom.dropzone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') Dom.fileInput.click();
        });

        Dom.ocrUploadBtn.addEventListener('click', () => Dom.ocrInput.click());
        Dom.ocrInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) OCRProcessor.process(file);
            e.target.value = '';
        });

        document.querySelector('input[value="custom"]')?.addEventListener('change', function () {
            Dom.customRegexWrap.style.display = this.checked ? 'block' : 'none';
        });

        Dom.customRegex.addEventListener('input',      () => UI.validateCustomRegex());
        Dom.customRegexFlags.addEventListener('input', () => UI.validateCustomRegex());

        Dom.typeBtns.forEach(btn =>
            btn.addEventListener('click', () => UI.setResultType(btn.dataset.resultType)));

        Dom.tabBtns.forEach(btn =>
            btn.addEventListener('click', () => UI.switchTab(btn.dataset.tab)));

        Dom.btnCopy.addEventListener('click',        () => Exporter.copy());
        Dom.btnDownloadCSV.addEventListener('click', () => Exporter.downloadCSV());
        Dom.btnDownloadZIP.addEventListener('click', () => Exporter.downloadZIP());

        /* Ctrl+Enter / Cmd+Enter keyboard shortcut to trigger extraction */
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleExtract();
            }
        });
    }

    /* ========================================================================
       § 13. MOBILE CAPABILITY CHECK
       Notify mobile users about potential OCR/ZIP performance limitations
       without blocking the interface.
    ======================================================================== */
    function checkMobileSupport() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
            .test(navigator.userAgent);
        if (isMobile) {
            window.showToast('Mobile detected: OCR and ZIP export may run slower on mobile browsers.');
        }
    }

    /* ========================================================================
       § 14. BOOTSTRAP
    ======================================================================== */
    function init() {
        initEventListeners();
        UI.updateCharCount();
        UI.setExportEnabled(false);
        checkMobileSupport();

        console.info(
            '%c🔍 Bulk Data Extractor & Regex Miner PRO',
            'color:#00e5ff; font-weight:900; font-size:14px;',
            '\nVersion: 2.1.0 | Trusted Tools Web | 100% Client-Side'
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(); /* END IIFE */
