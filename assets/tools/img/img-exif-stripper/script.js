/**
 * =============================================================================
 *  Image EXIF Stripper & Privacy Guard PRO MAX — script.js
 *  Trusted Tools Web — https://trustedtoolsweb.com
 * =============================================================================
 *
 *  OVERVIEW
 *  ─────────────────────────────────────────────────────────────────────────
 *  This script powers the Image EXIF Stripper tool. It performs all processing
 *  100% client-side — no image data is ever sent to a server.
 *
 *  KEY RESPONSIBILITIES
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. Drag-and-Drop & File Input  — accepts images via drag/drop or file picker.
 *  2. EXIF Parsing (Exifr)        — reads all EXIF metadata from images.
 *  3. Privacy Risk Scoring        — computes a 0–100 risk score per image.
 *  4. Risk Arc Gauge              — animates SVG arc needle to reflect score.
 *  5. GPS Threat Map (Leaflet)    — plots GPS coordinates on an interactive map.
 *  6. Metadata Inspector Table   — renders all EXIF fields sorted by risk level.
 *  7. SHA-256 Fingerprinting     — generates CryptoJS SHA-256 hashes before/after.
 *  8. EXIF Stripping (Piexifjs)  — surgically removes EXIF from JPEG files.
 *  9. Canvas Strip (Fallback)    — re-draws non-JPEG images through canvas.
 * 10. Batch ZIP Export (JSZip)   — strips all queued images and packages as ZIP.
 * 11. Keyboard Shortcuts         — Ctrl+S to strip, Arrow keys to navigate queue.
 * 12. Global Toast Notifications — uses window.showToast() from global.js.
 *
 *  DEPENDENCIES (must be loaded before this script)
 *  ─────────────────────────────────────────────────────────────────────────
 *  - exifr (full.umd.js)     — EXIF metadata parser
 *  - piexifjs (piexif.js)    — JPEG EXIF surgical remover
 *  - JSZip (jszip.min.js)    — ZIP archive generator
 *  - FileSaver (FileSaver.min.js) — cross-browser file download trigger
 *  - CryptoJS (crypto-js.min.js) — SHA-256 hashing
 *  - Leaflet (leaflet.js)    — interactive map rendering
 *  - global.js (module)      — provides window.showToast()
 *
 *  AUTHOR  : MD KAWSAR
 *  VERSION : 1.0 (CodeCanyon Release Build)
 * =============================================================================
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1: GLOBAL STATE OBJECT
   ─────────────────────────────────────────────────────────────────────────
   A single `state` object centralizes all runtime data:
   - `files`       : Array of file entry objects (one per uploaded image).
   - `selectedId`  : The ID string of the currently inspected image.
   - `leafletMap`  : Leaflet map instance (initialized lazily on first GPS hit).
   - `leafletMarker`: Active Leaflet marker pin on the GPS threat map.
═══════════════════════════════════════════════════════════════════════════ */
const state = {
    files        : [],    // Array of { id, file, dataUrl, exif, riskScore, strippedBlob }
    selectedId   : null,  // Currently inspected file ID
    leafletMap   : null,  // Leaflet.Map instance — lazy-initialized
    leafletMarker: null,  // Leaflet.Marker — current GPS pin
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2: RISK FIELD DEFINITIONS (RISK_MAP)
   ─────────────────────────────────────────────────────────────────────────
   Maps known EXIF field names to:
   - `label` : Human-readable display name for the metadata inspector table.
   - `risk`  : Risk level — 'high' | 'medium' | 'low' — used for scoring and
               color-coding the risk indicators in the right panel.
   - `ind`   : The DOM element ID of the corresponding risk indicator pill
               (e.g., 'indGps', 'indCamera'). Null for fields with no indicator.
═══════════════════════════════════════════════════════════════════════════ */
const RISK_MAP = {
    // ── HIGH RISK: GPS / Location fields ─────────────────────────────────
    GPSLatitude       : { label: 'GPS Latitude',    risk: 'high',   ind: 'indGps'       },
    GPSLongitude      : { label: 'GPS Longitude',   risk: 'high',   ind: 'indGps'       },
    GPSAltitude       : { label: 'GPS Altitude',    risk: 'high',   ind: 'indGps'       },
    GPSDateStamp      : { label: 'GPS Date',        risk: 'high',   ind: 'indGps'       },
    GPSTimeStamp      : { label: 'GPS Time',        risk: 'high',   ind: 'indGps'       },
    latitude          : { label: 'Latitude',        risk: 'high',   ind: 'indGps'       },
    longitude         : { label: 'Longitude',       risk: 'high',   ind: 'indGps'       },
    // ── MEDIUM RISK: Camera & Device identification ───────────────────────
    Make              : { label: 'Camera Make',     risk: 'medium', ind: 'indCamera'    },
    Model             : { label: 'Camera Model',    risk: 'medium', ind: 'indCamera'    },
    LensModel         : { label: 'Lens Model',      risk: 'medium', ind: 'indCamera'    },
    SerialNumber      : { label: 'Serial Number',   risk: 'high',   ind: 'indDevice'    },
    BodySerialNumber  : { label: 'Body Serial',     risk: 'high',   ind: 'indDevice'    },
    LensSerialNumber  : { label: 'Lens Serial',     risk: 'high',   ind: 'indDevice'    },
    // ── MEDIUM RISK: Timestamps ───────────────────────────────────────────
    DateTimeOriginal  : { label: 'Date Taken',      risk: 'medium', ind: 'indTimestamp' },
    DateTime          : { label: 'Date Modified',   risk: 'medium', ind: 'indTimestamp' },
    DateTimeDigitized : { label: 'Date Digitized',  risk: 'medium', ind: 'indTimestamp' },
    // ── MEDIUM RISK: Software & Copyright ────────────────────────────────
    Software          : { label: 'Software',        risk: 'medium', ind: 'indSoftware'  },
    ProcessingSoftware: { label: 'Processing SW',   risk: 'medium', ind: 'indSoftware'  },
    Copyright         : { label: 'Copyright',       risk: 'medium', ind: 'indCopyright' },
    Artist            : { label: 'Artist/Author',   risk: 'medium', ind: 'indCopyright' },
    // ── LOW RISK: Technical camera settings ──────────────────────────────
    ImageWidth        : { label: 'Image Width',     risk: 'low',    ind: null },
    ImageHeight       : { label: 'Image Height',    risk: 'low',    ind: null },
    ExifImageWidth    : { label: 'EXIF Width',      risk: 'low',    ind: null },
    ExifImageHeight   : { label: 'EXIF Height',     risk: 'low',    ind: null },
    Orientation       : { label: 'Orientation',     risk: 'low',    ind: null },
    XResolution       : { label: 'X Resolution',    risk: 'low',    ind: null },
    YResolution       : { label: 'Y Resolution',    risk: 'low',    ind: null },
    ColorSpace        : { label: 'Color Space',     risk: 'low',    ind: null },
    Flash             : { label: 'Flash',           risk: 'low',    ind: null },
    FocalLength       : { label: 'Focal Length',    risk: 'low',    ind: null },
    ApertureValue     : { label: 'Aperture',        risk: 'low',    ind: null },
    ExposureTime      : { label: 'Exposure Time',   risk: 'low',    ind: null },
    ISO               : { label: 'ISO',             risk: 'low',    ind: null },
    WhiteBalance      : { label: 'White Balance',   risk: 'low',    ind: null },
    ExposureProgram   : { label: 'Exposure Program',risk: 'low',    ind: null },
    MeteringMode      : { label: 'Metering Mode',   risk: 'low',    ind: null },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3: DROP ZONE INITIALIZATION & EVENT LISTENERS
   ─────────────────────────────────────────────────────────────────────────
   Attaches drag-and-drop and file-input change events to the upload zone.
   Only image/* MIME types are accepted. Duplicate files (same name + size)
   are silently skipped to prevent re-processing.
═══════════════════════════════════════════════════════════════════════════ */

/** @type {HTMLElement} The drag-and-drop upload zone container */
const dropZone  = document.getElementById('dropZone');

/** @type {HTMLInputElement} The hidden file input element */
const fileInput = document.getElementById('fileInput');

/**
 * dragover — Prevents the browser's default "open file" behavior and
 * applies the .dragover CSS class to show the glowing drop visual.
 */
dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

/**
 * dragleave — Removes the .dragover class, but only when the cursor
 * actually leaves the zone (not when entering a child element).
 * Uses relatedTarget check to avoid flicker on inner elements.
 */
dropZone.addEventListener('dragleave', e => {
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('dragover');
    }
});

/**
 * drop — Captures dropped files, filters for images only, and passes them
 * to processFiles(). Removes the .dragover class after the drop.
 */
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) processFiles(files);
});

/**
 * fileInput change — Triggered when the user selects files via the "Browse
 * Files" button. Resets the input value after reading to allow re-selecting
 * the same file if needed.
 */
fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    if (files.length) processFiles(files);
    fileInput.value = ''; // Reset so the same file can be re-added later
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 4: processFiles()
   ─────────────────────────────────────────────────────────────────────────
   The primary entry point for adding images to the tool. For each file:
     1. Skips duplicates (matched by name + size).
     2. Reads a base64 Data URL for thumbnail display and SHA-256 hashing.
     3. Computes the original SHA-256 fingerprint.
     4. Parses full EXIF metadata using the Exifr library.
     5. Calculates the Privacy Risk Score.
     6. Pushes the entry object into state.files[].
     7. Re-renders the queue and auto-selects the newest file.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Processes an array of File objects: reads metadata, scores risk, updates UI.
 * @param {File[]} files - Array of image File objects from drag-drop or input.
 */
async function processFiles(files) {
    for (const file of files) {

        // ── Duplicate guard — skip files already in the queue ──
        if (state.files.some(f => f.file.name === file.name && f.file.size === file.size)) continue;

        // ── Generate a unique ID for this entry ──
        const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // ── Build the initial entry object ──
        const entry = { id, file, dataUrl: null, exif: null, riskScore: 0, strippedBlob: null };

        // ── Step 1: Read file as Data URL (needed for thumbnail + SHA-256) ──
        entry.dataUrl = await readFileAsDataURL(file);

        // ── Step 2: Compute SHA-256 hash of the original image data ──
        entry.originalHash = await computeSHA256(entry.dataUrl.split(',')[1]);

        // ── Step 3: Parse EXIF metadata via Exifr (full decode) ──
        try {
            entry.exif = await exifr.parse(file, {
                gps          : true,
                tiff         : true,
                exif         : true,
                iptc         : true,
                xmp          : false,
                icc          : false,
                jfif         : false,
                ihdr         : false,
                translateKeys: false,
                reviveValues : true,
            }) || {};
        } catch (e) {
            // If EXIF parsing fails (e.g., corrupted or unsupported format),
            // gracefully fall back to an empty EXIF object.
            entry.exif = {};
        }

        // ── Step 4: Score the privacy risk based on detected EXIF fields ──
        entry.riskScore = computeRiskScore(entry.exif);

        // ── Add the processed entry to the global state ──
        state.files.push(entry);
    }

    // ── Re-render the file queue list and show the action buttons ──
    renderQueue();
    showActionBar();

    // ── Auto-select: if nothing is selected yet, select the newest file ──
    if (state.files.length > 0 && !state.selectedId) {
        selectFile(state.files[state.files.length - 1].id);
    } else if (state.selectedId) {
        // Re-select current file to refresh the right panel with latest data
        selectFile(state.selectedId);
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 5: renderQueue()
   ─────────────────────────────────────────────────────────────────────────
   Clears and rebuilds the file queue list from the current state.files[].
   Each item shows: thumbnail, filename, file size + risk %, risk dot, remove btn.
   The selected file item receives the .selected highlight class.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Renders the file queue list based on the current state.files array.
 * Dynamically injects HTML for each file entry row.
 */
function renderQueue() {
    const queueEl    = document.getElementById('fileQueue');
    const header     = document.getElementById('queueHeader');
    const countBadge = document.getElementById('queueCount');

    // Clear the existing list before re-rendering
    queueEl.innerHTML = '';

    // Show/hide the queue header based on whether any files exist
    header.style.display = state.files.length ? 'flex' : 'none';

    // Update the file count badge label
    countBadge.textContent = `${state.files.length} file${state.files.length !== 1 ? 's' : ''}`;

    state.files.forEach(entry => {
        const div = document.createElement('div');

        // Apply .selected class to the currently inspected file item
        div.className = `file-item${entry.id === state.selectedId ? ' selected' : ''}`;
        div.setAttribute('data-id', entry.id);
        div.onclick = () => selectFile(entry.id);

        // Determine risk dot color class based on risk score thresholds
        const riskClass = entry.riskScore >= 60 ? 'risk-high'
                        : entry.riskScore >= 30 ? 'risk-med'
                        : 'risk-low';

        const sizeStr = formatBytes(entry.file.size);

        // Inject file row HTML: thumbnail | name + meta | risk dot | remove button
        div.innerHTML = `
            <img class="file-thumb" src="${entry.dataUrl}" alt="${entry.file.name}">
            <div class="file-info">
                <div class="file-name">${entry.file.name}</div>
                <div class="file-meta">${sizeStr} · Risk: ${entry.riskScore}%</div>
            </div>
            <div class="file-risk-dot ${riskClass}"></div>
            <button class="file-remove" onclick="removeFile('${entry.id}', event)" title="Remove">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        queueEl.appendChild(div);
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 6: selectFile()
   ─────────────────────────────────────────────────────────────────────────
   Updates the right panel to reflect the selected file's EXIF data:
   - Highlights the selected item in the queue.
   - Updates the Risk Arc Gauge.
   - Populates the Metadata Inspector table.
   - Updates the GPS Threat Map.
   - Updates the SHA-256 hash panel.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Sets the given file ID as the active selection and refreshes all right-panel
 * analytics cards to display that file's EXIF data.
 * @param {string} id - The unique entry ID to select.
 */
function selectFile(id) {
    state.selectedId = id;
    const entry = state.files.find(f => f.id === id);
    if (!entry) return;

    // ── Update visual selection highlight in the queue list ──
    document.querySelectorAll('.file-item').forEach(el => {
        el.classList.toggle('selected', el.getAttribute('data-id') === id);
    });

    // ── Refresh all four right-panel analytics cards ──
    updateRiskMeter(entry);
    updateMetaTable(entry);
    updateGpsMap(entry);
    updateHashPanel(entry);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 7: updateRiskMeter()
   ─────────────────────────────────────────────────────────────────────────
   Animates the SVG arc gauge and needle to reflect the selected file's
   privacy risk score. Also updates the numeric score text, risk label,
   and the six category indicator pills.

   SVG Arc math:
   - Total arc path length ≈ 283 CSS units (half-circle with r=90).
   - fill = (score / 100) * 283 → used as stroke-dasharray "fill 283".
   - Needle rotation: -90° = 0% (leftmost), +90° = 100% (rightmost).
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Animates the privacy risk arc gauge and label to reflect `entry.riskScore`.
 * @param {{ riskScore: number, exif: object }} entry - The selected file entry.
 */
function updateRiskMeter(entry) {
    const score   = entry.riskScore;
    const scoreEl = document.getElementById('riskScore');
    const labelEl = document.getElementById('riskLabel');
    const arcFill = document.getElementById('arcFill');
    const needle  = document.getElementById('arcNeedle');

    // Update score text
    scoreEl.textContent = `${score}%`;

    // Set label text and score color based on risk threshold
    if      (score >= 75) { labelEl.textContent = '🔴 HIGH RISK';   scoreEl.style.color = 'var(--accent-red)';    }
    else if (score >= 40) { labelEl.textContent = '🟡 MEDIUM RISK'; scoreEl.style.color = 'var(--accent-yellow)'; }
    else if (score > 0)   { labelEl.textContent = '🟢 LOW RISK';    scoreEl.style.color = 'var(--accent-green)';  }
    else                  { labelEl.textContent = 'CLEAN';           scoreEl.style.color = 'var(--text-muted)';    }

    // ── Animate arc fill — total arc length ≈ 283px (half-circle, r=90) ──
    const fill = (score / 100) * 283;
    arcFill.style.strokeDasharray = `${fill} 283`;

    // ── Rotate needle from -90° (0%) to +90° (100%) ──
    const rotation = -90 + (score / 100) * 180;
    needle.style.transform = `rotate(${rotation}deg)`;

    // ── Update the six category indicator pills ──
    updateRiskIndicators(entry.exif);
}

/**
 * Updates the six risk-category indicator pills (GPS, Camera, Device, etc.)
 * based on which EXIF fields are present in the parsed data.
 * Applies CSS classes: inactive | active-high | active-med | active-low.
 * @param {object} exif - Parsed EXIF data object from Exifr.
 */
function updateRiskIndicators(exif) {
    // Track which indicators have been activated and at what risk level
    const indicators = {
        indGps: false, indCamera: false, indDevice: false,
        indTimestamp: false, indSoftware: false, indCopyright: false,
    };
    const highInds = new Set();
    const medInds  = new Set();

    // Scan all present EXIF keys and map to indicator IDs
    Object.keys(exif).forEach(key => {
        const def = RISK_MAP[key];
        if (def && def.ind) {
            if (def.risk === 'high') { highInds.add(def.ind); }
            else                    { medInds.add(def.ind);  }
            indicators[def.ind] = true;
        }
    });

    // GPS may be returned as top-level latitude/longitude by Exifr — check both
    if (exif.latitude !== undefined || exif.GPSLatitude !== undefined) {
        highInds.add('indGps');
        indicators['indGps'] = true;
    }

    // Apply the appropriate CSS class to each indicator pill element
    Object.keys(indicators).forEach(ind => {
        const el = document.getElementById(ind);
        el.className = 'exf-risk-ind'; // Reset to base class
        if (highInds.has(ind))     { el.classList.add('active-high'); }
        else if (medInds.has(ind)) { el.classList.add('active-med');  }
        else if (indicators[ind])  { el.classList.add('active-low');  }
        else                       { el.classList.add('inactive');    }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 8: updateMetaTable()
   ─────────────────────────────────────────────────────────────────────────
   Populates the EXIF Metadata Inspector table with all fields found in the
   selected image. Fields are sorted: high-risk first, then medium, then low.
   Each row includes: field label | value | risk-tag badge.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Renders the EXIF metadata table for the given file entry.
 * Shows the empty-state placeholder when no fields are present.
 * @param {{ exif: object }} entry - The selected file entry.
 */
function updateMetaTable(entry) {
    const empty      = document.getElementById('metaEmpty');
    const table      = document.getElementById('metaTable');
    const tbody      = document.getElementById('metaTableBody');
    const countBadge = document.getElementById('metaCount');

    const exif = entry.exif || {};
    const keys = Object.keys(exif).filter(k => exif[k] !== undefined && exif[k] !== null);

    // Update the field count badge in the card header
    countBadge.textContent = `${keys.length} field${keys.length !== 1 ? 's' : ''}`;

    // If no EXIF fields found, show the empty-state placeholder
    if (keys.length === 0) {
        empty.style.display = 'flex';
        table.style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    table.style.display = 'table';
    tbody.innerHTML     = '';

    // ── Sort fields: high risk → medium → low (for most critical data first) ──
    const sorted = keys.sort((a, b) => {
        const ra = RISK_MAP[a]?.risk === 'high' ? 0 : RISK_MAP[a]?.risk === 'medium' ? 1 : 2;
        const rb = RISK_MAP[b]?.risk === 'high' ? 0 : RISK_MAP[b]?.risk === 'medium' ? 1 : 2;
        return ra - rb;
    });

    // ── Inject a <tr> row for each EXIF field ──
    sorted.forEach((key, i) => {
        const val      = exif[key];
        const def      = RISK_MAP[key];
        const label    = def?.label || formatKey(key);
        const risk     = def?.risk  || 'low';
        const displayVal = formatValue(val);

        const tr = document.createElement('tr');
        tr.style.animationDelay = `${i * 0.02}s`; // Staggered fade-in for visual polish
        tr.innerHTML = `
            <td title="${key}">${label}</td>
            <td title="${displayVal}">${displayVal}</td>
            <td><span class="risk-tag ${risk}">${risk.toUpperCase()}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 9: updateGpsMap()
   ─────────────────────────────────────────────────────────────────────────
   Checks the EXIF data for GPS coordinates. If found:
   - Hides the "Awaiting GPS" placeholder.
   - Updates the "GPS ACQUIRED" badge.
   - Displays latitude and longitude coordinates.
   - Calls initOrUpdateMap() to plot/move the Leaflet marker.
   If not found, resets the map panel to its default "NO SIGNAL" state.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Shows or hides the GPS Threat Map based on whether GPS data exists in EXIF.
 * Converts DMS arrays to decimal degrees if necessary.
 * @param {{ exif: object }} entry - The selected file entry.
 */
function updateGpsMap(entry) {
    const exif        = entry.exif || {};
    const placeholder = document.getElementById('mapPlaceholder');
    const mapStatus   = document.getElementById('mapStatus');
    const gpsCoords   = document.getElementById('gpsCoords');

    // ── Extract latitude and longitude — Exifr may return either format ──
    let lat = exif.latitude  ?? exif.GPSLatitude;
    let lng = exif.longitude ?? exif.GPSLongitude;

    // Exifr sometimes returns raw DMS arrays for legacy JPEG files — convert
    if (Array.isArray(lat)) lat = dmsToDecimal(lat, exif.GPSLatitudeRef);
    if (Array.isArray(lng)) lng = dmsToDecimal(lng, exif.GPSLongitudeRef);

    // ── No valid GPS data — reset to "NO SIGNAL" state ──
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
        placeholder.style.display = 'flex';
        mapStatus.textContent = 'NO SIGNAL';
        mapStatus.classList.remove('acquired');
        gpsCoords.style.display = 'none';
        if (state.leafletMarker) {
            state.leafletMarker.remove();
            state.leafletMarker = null;
        }
        return;
    }

    // ── GPS data found — show map and update UI ──
    placeholder.style.display = 'none';
    mapStatus.textContent = 'GPS ACQUIRED';
    mapStatus.classList.add('acquired');
    gpsCoords.style.display = 'block';

    // Display formatted coordinates with 6 decimal places
    document.getElementById('coordLat').textContent = `Lat: ${lat.toFixed(6)}°`;
    document.getElementById('coordLng').textContent = `Lng: ${lng.toFixed(6)}°`;
    document.getElementById('coordAddress').textContent = ''; // Reserved for reverse geocoding

    // Initialize or move the Leaflet map marker to the new coordinates
    initOrUpdateMap(lat, lng);
}

/**
 * Converts a DMS (Degrees, Minutes, Seconds) array to decimal degrees.
 * Used to normalize GPS data returned in legacy EXIF DMS format.
 * @param {number[]} dms - Array of [degrees, minutes, seconds].
 * @param {string} ref  - Cardinal direction reference: 'N'|'S'|'E'|'W'.
 * @returns {number} Decimal degree value, or NaN if input is invalid.
 */
function dmsToDecimal(dms, ref) {
    if (!Array.isArray(dms) || dms.length < 3) return NaN;
    let decimal = dms[0] + dms[1] / 60 + dms[2] / 3600;
    // Southern and Western hemispheres have negative decimal values
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return decimal;
}

/**
 * Initializes the Leaflet map (if not already created) or moves the existing
 * marker to the new GPS coordinates and re-centers the map view.
 * The map is initialized lazily — only when GPS data is first detected.
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 */
function initOrUpdateMap(lat, lng) {
    // ── Lazy initialization — create map only on first GPS hit ──
    if (!state.leafletMap) {
        state.leafletMap = L.map('threatMap', {
            zoomControl       : true,
            attributionControl: false,
        });
        // OpenStreetMap tile layer (free, no API key required)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
        }).addTo(state.leafletMap);
    }

    // ── Custom pulsing red pin icon (inline HTML div) ──
    const pulseIcon = L.divIcon({
        className: '',
        html: `<div style="
            width:20px; height:20px;
            background:rgba(255,51,85,0.9);
            border:3px solid #fff;
            border-radius:50%;
            box-shadow:0 0 0 6px rgba(255,51,85,0.3), 0 0 20px rgba(255,51,85,0.6);
        "></div>`,
        iconSize  : [20, 20],
        iconAnchor: [10, 10],
    });

    if (state.leafletMarker) {
        // ── Move existing marker to new coordinates ──
        state.leafletMarker.setLatLng([lat, lng]);
    } else {
        // ── Place a new marker with a warning popup ──
        state.leafletMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(state.leafletMap);
        state.leafletMarker.bindPopup(`
            <b style="color:#ff3355">⚠ GPS Data Exposed</b><br>
            <small style="font-family:monospace">${lat.toFixed(6)}, ${lng.toFixed(6)}</small>
        `, { className: 'exif-popup' }).openPopup();
    }

    // Center the map on the GPS location at street level (zoom 14)
    state.leafletMap.setView([lat, lng], 14);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 10: updateHashPanel()
   ─────────────────────────────────────────────────────────────────────────
   Displays the SHA-256 hashes for the original and stripped versions of the
   selected image. When both hashes exist and are different, the comparison
   arrow glows green and a "verified" confirmation message is shown.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Renders the SHA-256 hash comparison panel for the given file entry.
 * Shows placeholder text until the hash values are computed.
 * @param {{ originalHash: string, strippedHash: string }} entry - File entry.
 */
function updateHashPanel(entry) {
    const origEl      = document.getElementById('hashOriginal');
    const strippedEl  = document.getElementById('hashStripped');
    const statusEl    = document.getElementById('hashStatus');
    const arrowEl     = document.getElementById('hashArrow');

    // ── Original hash: display if computed, else show placeholder ──
    if (entry.originalHash) {
        origEl.innerHTML = `<span class="exf-hash-text">${entry.originalHash}</span>`;
        origEl.classList.add('populated');
    } else {
        origEl.innerHTML = `<span class="exf-hash-placeholder">Awaiting image...</span>`;
        origEl.classList.remove('populated');
    }

    // ── Stripped hash: shown after "Strip & Download" is triggered ──
    if (entry.strippedHash) {
        strippedEl.innerHTML = `<span class="exf-hash-text">${entry.strippedHash}</span>`;
        strippedEl.classList.add('populated');
        // Hashes differ — metadata removal confirmed
        arrowEl.classList.add('changed');
        statusEl.className = 'exf-hash-status verified';
        statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Hashes differ — metadata successfully removed`;
    } else {
        strippedEl.innerHTML = `<span class="exf-hash-placeholder">Strip to generate...</span>`;
        strippedEl.classList.remove('populated');
        arrowEl.classList.remove('changed');
        statusEl.className = 'exf-hash-status pending';
        statusEl.innerHTML = `<i class="fa-solid fa-clock"></i> Strip image to verify removal`;
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 11: stripSelected()
   ─────────────────────────────────────────────────────────────────────────
   Strips EXIF metadata from the currently selected image:
   1. Shows the progress bar.
   2. Calls stripEXIF() to produce a clean Blob.
   3. Computes the SHA-256 of the stripped file.
   4. Sets riskScore to 0 (file is now clean).
   5. Triggers a green flash animation on all analytics cards.
   6. Refreshes the hash panel and risk meter.
   7. Initiates a file download via FileSaver.js saveAs().
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Strips EXIF from the selected image, updates the UI, and triggers download.
 * Called by the "Strip & Download" button onclick.
 */
async function stripSelected() {
    const entry = state.files.find(f => f.id === state.selectedId);
    if (!entry) {
        window.showToast('Select an image from the queue first.', true);
        return;
    }

    showProgress('Stripping metadata...', 0);

    try {
        // ── Strip EXIF and get a clean image Blob ──
        entry.strippedBlob = await stripEXIF(entry.file, entry.dataUrl, (p) => updateProgress(p));

        // ── Compute SHA-256 of the stripped image ──
        entry.strippedHash = await computeSHA256FromBlob(entry.strippedBlob);

        // ── Mark this image as clean (risk score = 0) ──
        entry.riskScore = 0;

        // ── Brief "stripping" glow flash on all analytics cards ──
        document.querySelectorAll('.exf-analytics-card').forEach(c => {
            c.classList.add('stripping');
            setTimeout(() => c.classList.remove('stripping'), 1000);
        });

        updateProgress(100);
        setTimeout(() => hideProgress(), 800);

        // ── Refresh the hash panel, risk gauge, and queue list ──
        updateHashPanel(entry);
        updateRiskMeter(entry);
        renderQueue();

        // ── Build the clean filename and trigger download ──
        const ext  = entry.file.name.split('.').pop();
        const name = entry.file.name.replace(/\.[^.]+$/, '') + '_clean.' + ext;
        saveAs(entry.strippedBlob, name);

        window.showToast('Metadata stripped & downloaded!');

    } catch (err) {
        hideProgress();
        console.error('[EXIF Stripper] Strip error:', err);
        window.showToast('Error stripping file. See console.', true);
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 12: batchExportZip()
   ─────────────────────────────────────────────────────────────────────────
   Strips EXIF from ALL files in the queue simultaneously and packages them
   into a single ZIP archive using JSZip. Files that fail stripping are
   skipped with a console warning (they do not abort the batch).
   Progress is reported to the progress bar as each file is processed.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Batch-strips all queued images and downloads them as a ZIP archive.
 * Called by the "Batch Export ZIP" button onclick.
 */
async function batchExportZip() {
    if (state.files.length === 0) {
        window.showToast('No images in queue.', true);
        return;
    }

    showProgress('Preparing batch...', 0);

    const zip   = new JSZip();
    const total = state.files.length;

    // ── Process each file in sequence, updating progress bar per file ──
    for (let i = 0; i < total; i++) {
        const entry = state.files[i];

        // Scale progress from 0–85% across all files (85–100% reserved for ZIP generation)
        updateProgress(Math.round((i / total) * 85));
        document.getElementById('processLabel').textContent = `Processing: ${entry.file.name}`;

        try {
            // ── Strip EXIF and add clean file to the ZIP archive ──
            const blob = await stripEXIF(entry.file, entry.dataUrl);
            const ext  = entry.file.name.split('.').pop();
            const name = entry.file.name.replace(/\.[^.]+$/, '') + '_clean.' + ext;
            zip.file(name, blob);

            // ── Update entry state with stripped results ──
            entry.strippedBlob = blob;
            entry.strippedHash = await computeSHA256FromBlob(blob);
            entry.riskScore    = 0; // Mark as clean
        } catch (e) {
            // Non-fatal: log and skip problematic files to continue the batch
            console.warn('[EXIF Stripper] Skipped (error):', entry.file.name, e);
        }
    }

    // ── Generate the ZIP file (DEFLATE compression, fast level 1) ──
    updateProgress(95);
    document.getElementById('processLabel').textContent = 'Generating ZIP...';

    const zipBlob = await zip.generateAsync({
        type              : 'blob',
        compression       : 'DEFLATE',
        compressionOptions: { level: 1 }, // Level 1 = fast (images are pre-compressed)
    });

    updateProgress(100);
    setTimeout(() => hideProgress(), 600);

    // ── Trigger ZIP download with a timestamped filename ──
    saveAs(zipBlob, `exif-stripped-${Date.now()}.zip`);

    // ── Refresh queue and update inspector for the selected file ──
    renderQueue();
    if (state.selectedId) {
        const entry = state.files.find(f => f.id === state.selectedId);
        if (entry) {
            updateHashPanel(entry);
            updateRiskMeter(entry);
        }
    }

    window.showToast(`${total} image${total !== 1 ? 's' : ''} stripped & zipped!`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 13: stripEXIF() — Core EXIF Removal Logic
   ─────────────────────────────────────────────────────────────────────────
   Routes the file to the most appropriate stripping method:
   - JPEG/JPG: Piexifjs surgically removes only the EXIF APP1 segment,
     preserving the full original bitstream (no re-compression quality loss).
     Falls back to canvasStrip() if Piexifjs encounters a malformed file.
   - PNG / WebP / TIFF / HEIC: Canvas re-draw via canvasStrip(). The browser's
     canvas API never injects EXIF, so the output is inherently clean.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Strips all EXIF metadata from the provided image file.
 * Returns a clean image Blob without any embedded metadata.
 * @param {File}     file       - Original image File object.
 * @param {string}   dataUrl    - Base64 Data URL of the original image.
 * @param {function} [onProgress] - Optional progress callback (0–100).
 * @returns {Promise<Blob>} Clean image Blob, free of EXIF metadata.
 */
async function stripEXIF(file, dataUrl, onProgress) {
    const type = file.type;

    // ── JPEG/JPG path: use Piexifjs for non-destructive EXIF segment removal ──
    if (type === 'image/jpeg' || type === 'image/jpg') {
        onProgress && onProgress(30);
        return new Promise((resolve, reject) => {
            try {
                // piexif.remove() strips the EXIF APP1 segment from the base64 string
                const cleaned = piexif.remove(dataUrl); // dataUrl is already data:image/jpeg;base64,...
                onProgress && onProgress(80);
                const blob = dataURLtoBlob(cleaned);
                resolve(blob);
            } catch (e) {
                // Piexifjs failed (e.g., non-standard EXIF structure) — fall back to canvas re-draw
                console.warn('[EXIF Stripper] Piexifjs fallback to canvas:', e.message);
                resolve(canvasStrip(dataUrl, type, onProgress));
            }
        });
    }

    // ── All other formats: redraw through canvas (strips all metadata naturally) ──
    return canvasStrip(dataUrl, type, onProgress);
}

/**
 * Strips metadata by drawing the image onto an HTML5 Canvas and exporting it.
 * Browsers never inject EXIF data into canvas toBlob() output.
 * Preserves transparency for PNG and WEBP; all others export as JPEG at 97% quality.
 * @param {string}   dataUrl    - Base64 Data URL of the source image.
 * @param {string}   type       - Original MIME type (e.g., 'image/png').
 * @param {function} [onProgress] - Optional progress callback (0-100).
 * @returns {Promise<Blob>} Clean image Blob from canvas output.
 */
function canvasStrip(dataUrl, type, onProgress) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            onProgress && onProgress(50);

            const canvas  = document.createElement('canvas');
            canvas.width  = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            onProgress && onProgress(80);

            // Preserve PNG and WEBP formats; everything else uses JPEG at 97% quality
            const outType = (type === 'image/png' || type === 'image/webp') ? type : 'image/jpeg';
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas toBlob() returned null'));
            }, outType, 0.97);
        };
        img.onerror = reject;
        img.src     = dataUrl;
    });
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 14: SHA-256 HASHING via CryptoJS
   ─────────────────────────────────────────────────────────────────────────
   Generates a 64-character hex SHA-256 hash for verification.
   computeSHA256()         → operates on a base64 string (from Data URL).
   computeSHA256FromBlob() → reads a Blob back as Data URL then hashes it.
   Both return 'unavailable' gracefully on failure.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Computes a SHA-256 hash of the given base64 image data string.
 * @param {string} base64String - Raw base64 image data (no Data URL prefix).
 * @returns {Promise<string>} 64-character hex hash, or 'unavailable' on error.
 */
async function computeSHA256(base64String) {
    try {
        return CryptoJS.SHA256(base64String).toString();
    } catch (e) {
        console.warn('[EXIF Stripper] SHA256 failed:', e.message);
        return 'unavailable';
    }
}

/**
 * Reads a Blob as a Data URL, extracts the base64 portion, and hashes it.
 * Used to hash the stripped output Blob after EXIF removal.
 * @param {Blob} blob - The stripped image Blob.
 * @returns {Promise<string>} 64-character hex hash, or 'unavailable' on error.
 */
async function computeSHA256FromBlob(blob) {
    return new Promise(resolve => {
        const reader   = new FileReader();
        reader.onload  = () => {
            try {
                const b64 = reader.result.split(',')[1];
                resolve(CryptoJS.SHA256(b64).toString());
            } catch {
                resolve('unavailable');
            }
        };
        reader.onerror = () => resolve('unavailable');
        reader.readAsDataURL(blob);
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 15: computeRiskScore()
   ─────────────────────────────────────────────────────────────────────────
   Calculates a 0–100 privacy risk score from the parsed EXIF object.
   Scoring weights:
   - GPS present  → +40 points (single biggest risk factor, capped at 40)
   - High risk field  → +35 pts each (serial number, device ID, etc.)
   - Medium risk field → +12 pts each (camera model, timestamp, software)
   - Low risk field    →  +2 pts each (resolution, focal length, etc.)
   - Unknown field     →  +1 pt  each
   Final score is capped at 100.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Computes a 0–100 privacy risk score for the given EXIF data object.
 * @param {object} exif - Parsed EXIF object from Exifr.
 * @returns {number} Integer risk score between 0 and 100.
 */
function computeRiskScore(exif) {
    if (!exif || Object.keys(exif).length === 0) return 0;

    let score = 0;
    const weights = { high: 35, medium: 12, low: 2 };
    const counted  = {};

    // ── GPS is the single highest risk — capped contribution at 40 pts ──
    const hasGPS = (
        exif.latitude    !== undefined || exif.longitude    !== undefined ||
        exif.GPSLatitude !== undefined || exif.GPSLongitude !== undefined
    );
    if (hasGPS) score += 40;

    // ── Score all other present EXIF keys by their risk weight ──
    Object.keys(exif).forEach(key => {
        if (exif[key] === undefined || exif[key] === null) return;

        const def = RISK_MAP[key];

        // Unknown EXIF field — small flat score contribution
        if (!def) { score += 1; return; }

        // Skip GPS keys as they are already accounted for in the GPS block above
        if (key === 'GPSLatitude' || key === 'GPSLongitude' ||
            key === 'latitude'    || key === 'longitude') return;

        // Accumulate the weight for this field's risk level
        if (counted[def.risk]) { counted[def.risk]++; }
        else                   { counted[def.risk] = 1; }

        score += weights[def.risk] || 1;
    });

    return Math.min(100, Math.round(score));
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 16: REMOVE FILE & CLEAR ALL
   ─────────────────────────────────────────────────────────────────────────
   removeFile() removes a single file from the queue.
   clearAll() empties the entire queue and resets all right-panel displays.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Removes a single file entry from the queue by ID.
 * Auto-selects the first remaining file, or resets the right panel if empty.
 * @param {string}     id    - The unique file entry ID to remove.
 * @param {MouseEvent} event - The click event (stopPropagation prevents row selection).
 */
function removeFile(id, event) {
    event.stopPropagation(); // Prevent the row's onclick from firing
    state.files = state.files.filter(f => f.id !== id);

    // If the removed file was selected, select the first remaining file
    if (state.selectedId === id) {
        state.selectedId = state.files[0]?.id || null;
    }

    renderQueue();

    if (state.selectedId) {
        selectFile(state.selectedId);
    } else {
        resetRightPanel();
    }

    // Hide queue header and action bar if no files remain
    if (state.files.length === 0) {
        document.getElementById('queueHeader').style.display = 'none';
        document.getElementById('actionBar').style.display   = 'none';
    }
}

/**
 * Clears all files from the queue and resets the entire tool UI to its
 * initial "no file selected" empty state.
 */
function clearAll() {
    state.files      = [];
    state.selectedId = null;
    renderQueue();
    resetRightPanel();
    document.getElementById('queueHeader').style.display = 'none';
    document.getElementById('actionBar').style.display   = 'none';
    hideProgress();
    window.showToast('Queue cleared.');
}

/**
 * Resets all four right-panel analytics cards to their default empty state.
 * Called when no file is selected (after removeFile or clearAll).
 */
function resetRightPanel() {
    // ── Risk meter reset ──
    document.getElementById('riskScore').textContent        = '--';
    document.getElementById('riskLabel').textContent        = 'No Image';
    document.getElementById('riskScore').style.color        = '';
    document.getElementById('arcFill').style.strokeDasharray = '0 283';
    document.getElementById('arcNeedle').style.transform    = 'rotate(-90deg)';

    // Reset all six indicator pills to inactive state
    ['indGps','indCamera','indDevice','indTimestamp','indSoftware','indCopyright'].forEach(id => {
        const el    = document.getElementById(id);
        el.className = 'exf-risk-ind inactive';
    });

    // ── GPS map reset ──
    document.getElementById('mapPlaceholder').style.display = 'flex';
    document.getElementById('mapStatus').textContent        = 'NO SIGNAL';
    document.getElementById('mapStatus').classList.remove('acquired');
    document.getElementById('gpsCoords').style.display      = 'none';
    if (state.leafletMarker) {
        state.leafletMarker.remove();
        state.leafletMarker = null;
    }

    // ── Metadata table reset ──
    document.getElementById('metaEmpty').style.display      = 'flex';
    document.getElementById('metaTable').style.display      = 'none';
    document.getElementById('metaTableBody').innerHTML      = '';
    document.getElementById('metaCount').textContent        = '0 fields';

    // ── SHA-256 hash panel reset ──
    document.getElementById('hashOriginal').innerHTML  = '<span class="exf-hash-placeholder">Awaiting image...</span>';
    document.getElementById('hashStripped').innerHTML  = '<span class="exf-hash-placeholder">Strip to generate...</span>';
    document.getElementById('hashOriginal').classList.remove('populated');
    document.getElementById('hashStripped').classList.remove('populated');
    document.getElementById('hashArrow').classList.remove('changed');
    document.getElementById('hashStatus').className = 'exf-hash-status pending';
    document.getElementById('hashStatus').innerHTML  = '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 17: UI HELPER FUNCTIONS
   ─────────────────────────────────────────────────────────────────────────
   Progress bar control and action bar visibility toggle.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Shows the action button bar (Strip / Batch ZIP / Clear All).
 * Called once the first image is added to the queue.
 */
function showActionBar() {
    document.getElementById('actionBar').style.display = 'flex';
}

/**
 * Shows the processing progress bar and sets its initial label and percentage.
 * @param {string} label - Operation description (e.g., "Stripping metadata...").
 * @param {number} pct   - Initial percentage value (0–100).
 */
function showProgress(label, pct) {
    const wrap = document.getElementById('processBarWrap');
    wrap.style.display = 'block';
    document.getElementById('processLabel').textContent   = label;
    document.getElementById('processPercent').textContent = `${pct}%`;
    document.getElementById('processBarFill').style.width = `${pct}%`;
}

/**
 * Updates the progress bar's current percentage display and fill width.
 * @param {number} pct - New percentage value (0–100).
 */
function updateProgress(pct) {
    document.getElementById('processPercent').textContent = `${pct}%`;
    document.getElementById('processBarFill').style.width = `${pct}%`;
}

/**
 * Hides the processing progress bar and resets the fill to 0%.
 */
function hideProgress() {
    document.getElementById('processBarWrap').style.display = 'none';
    document.getElementById('processBarFill').style.width    = '0%';
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 18: UTILITY FUNCTIONS
   ─────────────────────────────────────────────────────────────────────────
   Shared helpers used across the application.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Reads a File object as a base64 Data URL string.
 * Used to generate thumbnail previews and feed data to SHA-256 and Piexifjs.
 * @param {File} file - The source File object.
 * @returns {Promise<string>} Base64 Data URL (e.g., "data:image/jpeg;base64,...").
 */
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader   = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Converts a base64 Data URL string to a Blob object.
 * Used to convert Piexifjs output (base64 string) back to a downloadable Blob.
 * @param {string} dataURL - Full Data URL with MIME prefix.
 * @returns {Blob} Binary Blob of the image data.
 */
function dataURLtoBlob(dataURL) {
    const [header, data] = dataURL.split(',');
    const mime   = header.match(/:(.*?);/)[1];
    const binary = atob(data);
    const array  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
}

/**
 * Formats a byte count into a human-readable string.
 * @param {number} bytes - Raw byte count.
 * @returns {string} Formatted string (e.g., "1.5 MB", "432 KB", "512 B").
 */
function formatBytes(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Converts a camelCase EXIF key name to a human-readable label.
 * Used as a fallback when a key is not found in RISK_MAP.
 * @param {string} key - CamelCase EXIF key (e.g., "FocalLengthIn35mmFilm").
 * @returns {string} Spaced label (e.g., "Focal Length In 35mm Film").
 */
function formatKey(key) {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

/**
 * Formats an EXIF field value for display in the metadata inspector table.
 * Handles: null/undefined → em-dash, arrays → comma-joined, Date → locale string,
 * objects → truncated JSON, numbers → fixed decimals, strings → truncated.
 * @param {*} val - Raw EXIF field value.
 * @returns {string} Display-safe string representation, max 80 characters.
 */
function formatValue(val) {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') {
        if (Array.isArray(val))  return val.map(v => (typeof v === 'number' ? v.toFixed(4) : v)).join(', ');
        if (val instanceof Date) return val.toLocaleString();
        return JSON.stringify(val).substring(0, 60);
    }
    if (typeof val === 'number') return Number.isInteger(val) ? val.toString() : val.toFixed(6);
    return String(val).substring(0, 80);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 19: MAP INITIALIZATION NOTE
   ─────────────────────────────────────────────────────────────────────────
   The Leaflet map is intentionally initialized lazily — only when the first
   image with GPS data is selected. This avoids initializing a map tile
   request on page load, improving performance and offline compatibility.
   No action is needed here at startup.
═══════════════════════════════════════════════════════════════════════════ */
// Leaflet map lazy-initialized in initOrUpdateMap() on first GPS detection.

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 20: KEYBOARD SHORTCUTS
   ─────────────────────────────────────────────────────────────────────────
   Provides keyboard navigation for power users:
   - Ctrl+S / Cmd+S → Strip & Download the currently selected image.
   - ArrowUp         → Select the previous file in the queue.
   - ArrowDown       → Select the next file in the queue.
   - Escape          → No action (intentionally disabled to avoid accidental clear).
═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
    // ── Ctrl+S / Cmd+S — strip selected image (prevents browser save dialog) ──
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (state.selectedId) stripSelected();
    }

    // ── Escape — no action (prevent accidental queue wipe) ──
    if (e.key === 'Escape' && state.files.length) {
        // Intentionally left empty — user must use the "Clear All" button
    }

    // ── Arrow keys — navigate through the file queue ──
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && state.files.length > 1) {
        e.preventDefault();
        const idx  = state.files.findIndex(f => f.id === state.selectedId);
        if (idx === -1) return;
        const next = e.key === 'ArrowDown'
            ? Math.min(idx + 1, state.files.length - 1) // Move down (clamp at last)
            : Math.max(idx - 1, 0);                      // Move up   (clamp at first)
        selectFile(state.files[next].id);
    }
});
