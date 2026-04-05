/**
 * ============================================================================
 *  SQL Studio ULTRA MAX — script.js
 *  Offline CSV/JSON to SQLite Database Analyzer
 *
 *  Version   : 1.0.0
 *  Author    : Trusted Tools Web (CodeCanyon Premium)
 *  Tool URL  : https://trustedtoolsweb.com/tools/dev/dev-sql-studio/
 *
 *  Architecture: Pure ES6+ client-side. No server. No API calls. No data sent.
 *  All processing happens in the user's browser tab via WebAssembly + JS.
 *
 *  External Dependencies (injected via index.html):
 *    • sql.js      → SQLite compiled to WebAssembly (in-browser SQL engine)
 *    • PapaParse   → Robust streaming CSV parser
 *    • Ace Editor  → Professional code editor with SQL syntax highlighting
 *    • Chart.js    → Results visualization (Bar, Line, Doughnut)
 *    • JSZip       → Client-side ZIP archive generation
 *    • FileSaver   → Trigger browser file download (saveAs)
 *    • jsPDF       → Client-side PDF report generation
 *
 *  TABLE OF CONTENTS
 *  ─────────────────────────────────────────────────────────────────────────
 *  SECTION 1  : App State
 *  SECTION 2  : SQL Templates
 *  SECTION 3  : DOM References
 *  SECTION 4  : [REMOVED — Local toast replaced by global window.showToast]
 *  SECTION 5  : sql.js WebAssembly Initialization
 *  SECTION 6  : Ace Editor Setup
 *  SECTION 7  : File Import & Table Builder
 *  SECTION 8  : Mock Data Injector
 *  SECTION 9  : Query Execution Engine
 *  SECTION 10 : Results Table Renderer
 *  SECTION 11 : Profiler Bar Updates
 *  SECTION 12 : Table Browser (Sidebar)
 *  SECTION 13 : SQL Template Buttons
 *  SECTION 14 : Chart Visualizer
 *  SECTION 15 : Export System (CSV / JSON / SQL Dump / ZIP / PDF)
 *  SECTION 16 : Results Tab Switching
 *  SECTION 17 : SQL Format / Beautify
 *  SECTION 18 : Drag & Drop Handler
 *  SECTION 19 : Clear Database
 *  SECTION 20 : Utility Functions
 *  SECTION 21 : Event Listeners Wiring
 *  SECTION 22 : Bootstrap — App Initialization
 * ============================================================================
 */

"use strict";

/* ============================================================================
   SECTION 1: APP STATE
   Single source of truth for the entire application.
   Using a plain object (no framework) for maximum portability and
   CodeCanyon buyer friendliness — zero build step required.
============================================================================ */
const AppState = {
    db:            null,   // The sql.js Database instance (in-memory SQLite)
    sqlReady:      false,  // True once the WebAssembly engine has initialized
    lastResults:   null,   // { columns: string[], rows: any[][] } — last query result set
    lastQuery:     '',     // The raw SQL string that produced lastResults (used in exports)
    tables:        {},     // { [tableName]: { columns: [{name, type}], rowCount: number } }
    chartInstance: null,   // Active Chart.js instance — destroyed & recreated on each render
    editor:        null,   // Ace Editor instance
};

/* ============================================================================
   SECTION 2: SQL TEMPLATES
   Pre-built one-click query templates for common data operations.
   The placeholder {{TABLE}} is substituted at click-time with the first
   loaded table name (or 'your_table' if nothing is loaded yet).
============================================================================ */
const SQL_TEMPLATES = [
    {
        icon:        'fa-solid fa-star',
        name:        'SELECT All Rows',
        description: 'Preview every row in a table',
        sql:         `SELECT *\nFROM {{TABLE}}\nLIMIT 500;`
    },
    {
        icon:        'fa-solid fa-clone',
        name:        'Find Duplicates',
        description: 'Find rows with duplicate values in a column',
        sql:         `-- Replace 'your_column' with the column name to check\nSELECT your_column, COUNT(*) AS occurrences\nFROM {{TABLE}}\nGROUP BY your_column\nHAVING COUNT(*) > 1\nORDER BY occurrences DESC;`
    },
    {
        icon:        'fa-solid fa-calendar-days',
        name:        'Group by Date',
        description: 'Aggregate records by date',
        sql:         `-- Replace 'date_column' with your date field\nSELECT DATE(date_column) AS day,\n       COUNT(*) AS total\nFROM {{TABLE}}\nGROUP BY DATE(date_column)\nORDER BY day DESC;`
    },
    {
        icon:        'fa-solid fa-trophy',
        name:        'Top 10 by Value',
        description: 'Find top records ordered by a numeric field',
        sql:         `-- Replace 'value_column' with your numeric field\nSELECT *\nFROM {{TABLE}}\nORDER BY value_column DESC\nLIMIT 10;`
    },
    {
        icon:        'fa-solid fa-circle-info',
        name:        'Column Statistics',
        description: 'MIN, MAX, AVG for a numeric column',
        sql:         `-- Replace 'value_column' with your numeric field\nSELECT COUNT(*) AS total_rows,\n       MIN(value_column) AS minimum,\n       MAX(value_column) AS maximum,\n       ROUND(AVG(value_column), 2) AS average,\n       SUM(value_column) AS total_sum\nFROM {{TABLE}};`
    },
    {
        icon:        'fa-solid fa-filter',
        name:        'Filter & Search',
        description: 'WHERE clause template',
        sql:         `SELECT *\nFROM {{TABLE}}\nWHERE column_name LIKE '%search_term%'\nLIMIT 100;`
    },
    {
        icon:        'fa-solid fa-circle-xmark',
        name:        'Find NULL Values',
        description: 'Locate rows with missing data',
        sql:         `-- Replace 'column_name' with the column to check\nSELECT *\nFROM {{TABLE}}\nWHERE column_name IS NULL\n   OR column_name = ''\nLIMIT 200;`
    },
    {
        icon:        'fa-solid fa-link',
        name:        'INNER JOIN Template',
        description: 'Join two tables on a shared key',
        sql:         `-- Replace table names and join keys as needed\nSELECT a.*, b.column_from_b\nFROM {{TABLE}} AS a\nINNER JOIN other_table AS b\n    ON a.shared_key = b.shared_key\nLIMIT 200;`
    },
    {
        icon:        'fa-solid fa-chart-simple',
        name:        'Value Distribution',
        description: 'Count occurrences per unique value',
        sql:         `-- Replace 'category_column' with your field\nSELECT category_column,\n       COUNT(*) AS count,\n       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM {{TABLE}}), 2) AS pct\nFROM {{TABLE}}\nGROUP BY category_column\nORDER BY count DESC;`
    },
    {
        icon:        'fa-solid fa-clock-rotate-left',
        name:        'Recent Records',
        description: 'Get last 100 rows (assumes id or date)',
        sql:         `SELECT *\nFROM {{TABLE}}\nORDER BY rowid DESC\nLIMIT 100;`
    }
];

/* ============================================================================
   SECTION 3: DOM REFERENCES
   All interactive DOM elements are cached once on DOMContentLoaded
   to avoid repeated querySelector calls throughout the app lifecycle.
============================================================================ */
let DOM = {};

/**
 * cacheDomRefs()
 * Populates the DOM object with references to every element that the
 * script reads or writes. Called once during app bootstrap.
 */
function cacheDomRefs() {
    DOM = {
        // ── File Import Area
        dropZone:             document.getElementById('dropZone'),
        fileInput:            document.getElementById('fileInput'),
        dropZonePanel:        document.getElementById('dropZonePanel'),
        loadProgress:         document.getElementById('loadProgress'),
        progressFill:         document.getElementById('progressFill'),
        progressLabel:        document.getElementById('progressLabel'),
        mockDataBtn:          document.getElementById('mockDataBtn'),

        // ── Sidebar Controls
        clearDbBtn:           document.getElementById('clearDbBtn'),
        tableBrowser:         document.getElementById('tableBrowser'),
        templatesList:        document.getElementById('templatesList'),

        // ── Editor Toolbar
        runQueryBtn:          document.getElementById('runQueryBtn'),
        formatSqlBtn:         document.getElementById('formatSqlBtn'),
        clearEditorBtn:       document.getElementById('clearEditorBtn'),

        // ── Profiler Bar
        profilerStatus:       document.getElementById('profilerStatus'),
        profilerTime:         document.getElementById('profilerTime'),
        profilerRows:         document.getElementById('profilerRows'),
        profilerTables:       document.getElementById('profilerTables'),

        // ── Results Tabs
        resultsTabs:          document.querySelectorAll('.sqs-results-tab'),
        resultsTabContents:   document.querySelectorAll('.sqs-tab-content'),

        // ── Results Table Panel
        resultsEmptyState:    document.getElementById('resultsEmptyState'),
        resultsError:         document.getElementById('resultsError'),
        errorMessage:         document.getElementById('errorMessage'),
        tableScrollContainer: document.getElementById('tableScrollContainer'),
        tableHead:            document.getElementById('tableHead'),
        tableBody:            document.getElementById('tableBody'),

        // ── Chart Visualizer
        chartType:            document.getElementById('chartType'),
        chartLabelCol:        document.getElementById('chartLabelCol'),
        chartValueCol:        document.getElementById('chartValueCol'),
        renderChartBtn:       document.getElementById('renderChartBtn'),
        vizChart:             document.getElementById('vizChart'),
        chartEmptyState:      document.getElementById('chartEmptyState'),

        // ── Export Buttons
        exportCsvBtn:         document.getElementById('exportCsvBtn'),
        exportJsonBtn:        document.getElementById('exportJsonBtn'),
        exportSqlBtn:         document.getElementById('exportSqlBtn'),
        exportZipBtn:         document.getElementById('exportZipBtn'),
        exportPdfBtn:         document.getElementById('exportPdfBtn'),
        copyJsonBtn:          document.getElementById('copyJsonBtn'),
    };
}

/* ============================================================================
   SECTION 4: TOAST NOTIFICATION SYSTEM
   [REMOVED — Using global window.showToast() system injected by global.js]

   Usage throughout this file:
     window.showToast('Message')           → info (default)
     window.showToast('Error text', true)  → error (boolean true = error type)
     window.showToast('Success!', false)   → info / success handled by global
============================================================================ */

/* ============================================================================
   SECTION 5: SQL.JS WEBASSEMBLY INITIALIZATION
   sql.js exposes a global initSqlJs() function.
   We call it once, pointing locateFile at the local WASM binary path.
   The result is stored in AppState.db for all subsequent queries.
============================================================================ */

/**
 * initSqlJs()
 * Asynchronously initializes the WebAssembly SQLite engine.
 * Creates an empty in-memory Database and sets AppState.sqlReady = true.
 * On failure, shows a global error toast (network or WASM load issue).
 */
async function initSqlJs() {
    try {
        // Updated to load the .wasm file locally
        const SQL = await window.initSqlJs({
            locateFile: file => `../../assets/library/db-engine/sqljs/${file}`
        });

        // Create an empty in-memory SQLite database ready to receive tables
        AppState.db       = new SQL.Database();
        AppState.sqlReady = true;

        updateProfilerStatus('ready');
        console.info('[SQL Studio] sql.js WebAssembly engine ready ✓');
    } catch (err) {
        console.error('[SQL Studio] Failed to initialize sql.js:', err);
        // Pass boolean true as second argument — global toast treats this as an error
        window.showToast('Failed to load WebAssembly SQL engine. Check your connection.', true);
    }
}

/* ============================================================================
   SECTION 6: ACE EDITOR SETUP
   Ace Editor provides professional syntax highlighting, line numbers,
   code folding, bracket matching, and Ctrl+Enter keyboard shortcut.
   Theme is synced with the global dark/light mode toggle via MutationObserver.
============================================================================ */

/**
 * initAceEditor()
 * Mounts Ace Editor into the #aceEditor div, configures SQL mode,
 * sets the default placeholder SQL, and binds Ctrl+Enter → runQuery().
 * A MutationObserver watches the body class to switch theme on mode change.
 */
function initAceEditor() {
    // Point Ace's internal module loader to the local path so it can
    // dynamically load additional mode/theme files as needed
    ace.config.set('basePath', '../../assets/library/code-editor/ace/');

    AppState.editor = ace.edit('aceEditor');

    // Select initial theme based on current body class (dark or light)
    const isDark = !document.body.classList.contains('light-mode');
    AppState.editor.setTheme(isDark ? 'ace/theme/one_dark' : 'ace/theme/chrome');

    // Activate SQL language mode for syntax highlighting
    AppState.editor.session.setMode('ace/mode/sql');

    // Configure editor preferences for a professional developer experience
    AppState.editor.setOptions({
        fontSize:                   '14px',
        fontFamily:                 'Fira Code, Cascadia Code, Consolas, monospace',
        enableBasicAutocompletion:  true,
        enableLiveAutocompletion:   false, // Off: avoids intrusive suggestions mid-type
        showPrintMargin:            false,
        highlightActiveLine:        true,
        tabSize:                    2,
        useSoftTabs:                true,
        wrap:                       false,
        scrollPastEnd:              0.5,
    });

    // Default placeholder SQL shown on first load
    AppState.editor.setValue(
        `-- SQL Studio ULTRA MAX\n-- Drop a CSV or JSON file to create a table, then run a query.\n\n-- Example (after loading a file named "sales.csv"):\nSELECT *\nFROM sales\nLIMIT 100;`,
        -1 // -1 = move cursor to the start of the document
    );

    // Bind Ctrl+Enter / Cmd+Enter keyboard shortcut to execute the query
    AppState.editor.commands.addCommand({
        name:    'runQuery',
        bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
        exec:    () => runQuery(),
    });

    // Watch body class changes to sync Ace theme with the global theme toggle
    const themeObserver = new MutationObserver(() => {
        const isLightMode = document.body.classList.contains('light-mode');
        AppState.editor.setTheme(isLightMode ? 'ace/theme/chrome' : 'ace/theme/one_dark');
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

/* ============================================================================
   SECTION 7: FILE IMPORT & TABLE BUILDER
   Handles both drag-and-drop and click-to-browse for .csv and .json files.
   CSV files are parsed using PapaParse (streaming, handles large files).
   JSON files use the native FileReader API.
   Both formats auto-detect SQLite column types by sampling rows.
============================================================================ */

/**
 * fileToTableName(filename)
 * Converts a raw filename into a safe SQLite table identifier.
 * Strips the file extension, replaces invalid characters with underscores,
 * prefixes with _ if the name starts with a digit, and caps at 60 chars.
 *
 * @param {string} filename - Raw file name from the File API (e.g. "my-data 2024.csv")
 * @returns {string} Safe SQLite identifier (e.g. "my_data_2024")
 */
function fileToTableName(filename) {
    return filename
        .replace(/\.(csv|json)$/i, '')   // Remove .csv or .json extension
        .replace(/[^a-zA-Z0-9_]/g, '_')  // Replace any non-alphanumeric chars
        .replace(/^(\d)/, '_$1')          // Prefix with _ if starts with digit
        .substring(0, 60);               // SQLite identifier max safe length
}

/**
 * inferColumnType(samples)
 * Inspects a sample of string values and infers the most specific
 * SQLite affinity: INTEGER → REAL → TEXT (most permissive wins).
 *
 * @param {string[]} samples - Array of raw string values from the CSV/JSON
 * @returns {'INTEGER'|'REAL'|'TEXT'} Inferred SQLite type affinity
 */
function inferColumnType(samples) {
    let allInt  = true;
    let allReal = true;

    for (const val of samples) {
        // Skip empty / null values — they don't constrain the type
        if (val === null || val === undefined || val === '') continue;
        const str = String(val).trim();

        // INTEGER: only matches strict digit strings (with optional leading minus)
        if (!/^-?\d+$/.test(str)) allInt = false;

        // REAL: matches any finite decimal notation
        if (isNaN(parseFloat(str)) || !/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(str)) allReal = false;
    }

    if (allInt)  return 'INTEGER';
    if (allReal) return 'REAL';
    return 'TEXT';
}

/**
 * buildSqliteTable(tableName, rows)
 * Creates a SQLite table in the in-memory database from an array of row objects.
 *
 * Process:
 *   1. Collect all unique column names across every row.
 *   2. Infer column data types by sampling up to 200 rows.
 *   3. DROP any existing table with the same name (re-import = overwrite).
 *   4. CREATE TABLE with the inferred schema.
 *   5. Bulk INSERT all rows using a prepared statement inside a transaction.
 *   6. Cache table metadata in AppState.tables.
 *
 * @param {string}   tableName - Safe SQLite identifier for the table
 * @param {Object[]} rows      - Array of plain objects (column keys = property names)
 */
function buildSqliteTable(tableName, rows) {
    // Guard: ensure the WASM engine is ready before attempting any SQL
    if (!AppState.sqlReady || !AppState.db) {
        window.showToast('SQL engine not ready. Please wait.', true);
        return;
    }

    // Guard: reject empty datasets immediately
    if (!rows || rows.length === 0) {
        window.showToast('File is empty or has no parseable rows.', true);
        return;
    }

    // ── Step 1: Collect all unique column names across all rows ──────────────
    // Using a Set ensures we handle inconsistent JSON objects gracefully.
    const columnSet = new Set();
    rows.forEach(row => Object.keys(row).forEach(k => columnSet.add(k)));
    const columns = Array.from(columnSet);

    // ── Step 2: Infer data types by sampling up to 200 rows per column ───────
    const sampleSize = Math.min(rows.length, 200);
    const colTypes = columns.map(col => {
        const samples = rows.slice(0, sampleSize).map(r => r[col]);
        return inferColumnType(samples);
    });

    // ── Step 3: Sanitize column names for SQL (wrap in double-quotes) ─────────
    // Double-quoting handles reserved words and special characters safely.
    const safeCols = columns.map(c =>
        `"${String(c).replace(/"/g, '""').substring(0, 60)}"`
    );

    // ── Step 4: DROP existing table (re-import overwrites previous version) ───
    AppState.db.run(`DROP TABLE IF EXISTS "${tableName}";`);

    // ── Step 5: CREATE TABLE with the inferred column schema ──────────────────
    const colDefs = safeCols.map((col, i) => `${col} ${colTypes[i]}`).join(', ');
    AppState.db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs});`);

    // ── Step 6: Bulk INSERT using a prepared statement + transaction ──────────
    // Prepared statements are orders of magnitude faster than per-row string building.
    // Wrapping in BEGIN/COMMIT transaction reduces SQLite overhead from O(n) → O(1) syncs.
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = AppState.db.prepare(
        `INSERT INTO "${tableName}" (${safeCols.join(', ')}) VALUES (${placeholders});`
    );

    AppState.db.run('BEGIN TRANSACTION;');
    try {
        for (const row of rows) {
            const values = columns.map(col => {
                const val = row[col];
                // Nested objects/arrays: JSON-stringify so they become TEXT columns
                if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                return val ?? null; // Coerce undefined → SQL NULL
            });
            stmt.run(values);
        }
        AppState.db.run('COMMIT;');
    } catch (err) {
        AppState.db.run('ROLLBACK;'); // Roll back on any insert error
        throw err;                    // Re-throw so the caller can show a toast
    } finally {
        stmt.free(); // Always free prepared statement to prevent memory leak
    }

    // ── Step 7: Cache table metadata for sidebar and export use ───────────────
    AppState.tables[tableName] = {
        columns:  columns.map((name, i) => ({ name, type: colTypes[i] })),
        rowCount: rows.length,
    };
}

/**
 * processCsvFile(file)
 * Parses a .csv File using PapaParse (with header row auto-detection)
 * and builds a SQLite table from the parsed rows.
 *
 * @param {File} file - The .csv File object from drag-and-drop or file input
 * @returns {Promise<void>}
 */
function processCsvFile(file) {
    return new Promise((resolve, reject) => {
        showProgress(true, `Parsing CSV: ${file.name}…`);

        Papa.parse(file, {
            header:         true,   // First row = column names
            skipEmptyLines: true,
            dynamicTyping:  false,  // Keep as strings; we type-infer separately

            // Callback fired when the entire file has been parsed
            complete: (result) => {
                try {
                    const tableName = fileToTableName(file.name);
                    buildSqliteTable(tableName, result.data);

                    // Auto-generate a starter SELECT query for the new table
                    AppState.editor.setValue(`SELECT *\nFROM ${tableName}\nLIMIT 500;`, -1);

                    updateTableBrowser();
                    updateProfilerTables();
                    window.showToast(`✓ Loaded "${tableName}" (${result.data.length.toLocaleString()} rows)`);
                    showProgress(false);
                    resolve();
                } catch (err) {
                    window.showToast(`Failed to build table from "${file.name}": ${err.message}`, true);
                    showProgress(false);
                    reject(err);
                }
            },

            // PapaParse error callback (malformed CSV or read error)
            error: (err) => {
                window.showToast(`CSV Parse Error: ${err.message}`, true);
                showProgress(false);
                reject(err);
            }
        });
    });
}

/**
 * processJsonFile(file)
 * Reads a .json File using FileReader and builds a SQLite table.
 * Supports two JSON shapes:
 *   • Array of objects: [{"id":1,"name":"Alice"}, ...]
 *   • Root object with an array property: {"data": [...], "meta": {}}
 *
 * @param {File} file - The .json File object
 * @returns {Promise<void>}
 */
function processJsonFile(file) {
    return new Promise((resolve, reject) => {
        showProgress(true, `Parsing JSON: ${file.name}…`);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const raw = JSON.parse(e.target.result);
                let rows;

                if (Array.isArray(raw)) {
                    // Standard case: top-level array of objects
                    rows = raw;
                } else if (typeof raw === 'object' && raw !== null) {
                    // Wrapped case: find the first array property in the root object
                    const arrayKey = Object.keys(raw).find(k => Array.isArray(raw[k]));
                    if (arrayKey) {
                        rows = raw[arrayKey];
                    } else {
                        // Edge case: treat the single root object as one row
                        rows = [raw];
                    }
                } else {
                    throw new Error('JSON must be an array of objects or an object containing an array.');
                }

                // Normalize rows: ensure every element is a plain object
                // (handles arrays of primitives gracefully)
                rows = rows.map(row => {
                    if (typeof row !== 'object' || row === null) return { value: row };
                    return row;
                });

                const tableName = fileToTableName(file.name);
                buildSqliteTable(tableName, rows);

                // Auto-generate starter query for the new table
                AppState.editor.setValue(`SELECT *\nFROM ${tableName}\nLIMIT 500;`, -1);

                updateTableBrowser();
                updateProfilerTables();
                window.showToast(`✓ Loaded "${tableName}" (${rows.length.toLocaleString()} rows)`);
                showProgress(false);
                resolve();
            } catch (err) {
                window.showToast(`JSON Error: ${err.message}`, true);
                showProgress(false);
                reject(err);
            }
        };

        // FileReader error (e.g. file permission denied)
        reader.onerror = (e) => {
            window.showToast('Failed to read file.', true);
            showProgress(false);
            reject(e);
        };

        reader.readAsText(file, 'UTF-8');
    });
}

/**
 * processFile(file)
 * Routes a dropped or selected File to the appropriate parser
 * based on its file extension (.csv → PapaParse, .json → FileReader).
 * Unsupported types show a warning toast.
 *
 * @param {File} file - The file selected by the user
 */
async function processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
        await processCsvFile(file);
    } else if (ext === 'json') {
        await processJsonFile(file);
    } else {
        window.showToast(`Unsupported file type ".${ext}". Use .csv or .json`, true);
    }
}

/**
 * showProgress(visible, label)
 * Shows or hides the file loading progress bar with an animated fill effect.
 * Uses setTimeout to create a simulated progress animation since PapaParse
 * does not expose real-time byte progress for main-thread parsing.
 *
 * @param {boolean} visible - true = show, false = hide
 * @param {string}  label   - Text to display next to the progress bar
 */
function showProgress(visible, label = '') {
    DOM.loadProgress.style.display  = visible ? 'flex' : 'none';
    DOM.progressLabel.textContent   = label;

    if (visible) {
        // Animate to 60% quickly, then 90% slowly — simulates work in progress
        DOM.progressFill.style.width = '0%';
        setTimeout(() => { DOM.progressFill.style.width = '60%'; }, 100);
        setTimeout(() => { DOM.progressFill.style.width = '90%'; }, 600);
    } else {
        // Snap to 100% then reset after a brief flash
        DOM.progressFill.style.width = '100%';
        setTimeout(() => { DOM.progressFill.style.width = '0%'; }, 300);
    }
}

/* ============================================================================
   SECTION 8: MOCK DATA INJECTOR
   Generates 1000 rows of realistic fake employee/customer data and
   loads them into a table named "mock_data". Useful for immediate
   testing without needing a real CSV or JSON file.

   Generated columns: id, first_name, last_name, full_name, email,
   department, city, country, salary, score, is_active, status,
   join_date, experience_years, age.
============================================================================ */

/**
 * randInt(min, max)
 * Returns a random integer in the range [min, max] inclusive.
 *
 * @param {number} min - Lower bound (inclusive)
 * @param {number} max - Upper bound (inclusive)
 * @returns {number}
 */
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * randFrom(arr)
 * Returns a random element from the given array.
 *
 * @param {Array} arr - Source array
 * @returns {*} A randomly selected element
 */
function randFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * injectMockData()
 * Generates and inserts 1000 mock employee rows into the "mock_data" table.
 * A setTimeout of 50ms allows the progress bar repaint before the synchronous
 * data-generation loop blocks the main thread.
 * On success, auto-sets the editor to a useful aggregate starter query.
 */
function injectMockData() {
    // Guard: engine must be ready before inserting data
    if (!AppState.sqlReady) {
        window.showToast('SQL engine is still loading. Please wait.', true);
        return;
    }

    showProgress(true, 'Generating 1000 mock rows…');

    // 50ms delay allows the browser to repaint the progress bar before
    // the synchronous generation loop blocks the event loop
    setTimeout(() => {
        // ── Seed data arrays for realistic randomization ─────────────────────
        const FIRST_NAMES  = ['Alice','Bob','Carol','David','Emma','Frank','Grace','Henry','Isla','James','Karen','Liam','Maya','Noah','Olivia','Peter','Quinn','Rachel','Sam','Tara','Uma','Victor','Wendy','Xander','Yara','Zoe','Anna','Ben','Clara','Derek'];
        const LAST_NAMES   = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Moore','Young','Hall','Allen','Scott','King','Green','Baker','Adams','Nelson','Carter','Mitchell','Roberts'];
        const DEPARTMENTS  = ['Engineering','Marketing','Sales','HR','Finance','Operations','Legal','Product','Design','Support'];
        const CITIES       = ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose','London','Toronto','Sydney','Berlin','Paris','Tokyo','Mumbai','Dubai','Singapore','São Paulo'];
        const COUNTRIES    = ['USA','USA','USA','USA','USA','UK','Canada','Australia','Germany','France','Japan','India','UAE','Singapore','Brazil'];
        const STATUSES     = ['active','inactive','on-leave','contractor'];

        const rows      = [];
        const startDate = new Date('2018-01-01').getTime();
        const endDate   = new Date('2024-12-31').getTime();

        // ── Generate 1000 rows ────────────────────────────────────────────────
        for (let i = 1; i <= 1000; i++) {
            const first  = randFrom(FIRST_NAMES);
            const last   = randFrom(LAST_NAMES);
            const domain = randFrom(['gmail.com','yahoo.com','outlook.com','company.io','corp.net','mail.org']);
            const joinTs = new Date(randInt(startDate, endDate));
            const joinDate = joinTs.toISOString().split('T')[0]; // YYYY-MM-DD format

            rows.push({
                id:               i,
                first_name:       first,
                last_name:        last,
                full_name:        `${first} ${last}`,
                email:            `${first.toLowerCase()}.${last.toLowerCase()}${randInt(1, 999)}@${domain}`,
                department:       randFrom(DEPARTMENTS),
                city:             randFrom(CITIES),
                country:          randFrom(COUNTRIES),
                salary:           randInt(38000, 195000),
                score:            parseFloat((Math.random() * 10).toFixed(2)),
                is_active:        randFrom([1, 1, 1, 0]), // 75% probability of being active
                status:           randFrom(STATUSES),
                join_date:        joinDate,
                experience_years: randInt(0, 25),
                age:              randInt(22, 65),
            });
        }

        try {
            buildSqliteTable('mock_data', rows);

            // Auto-load a useful aggregate starter query in the editor
            AppState.editor.setValue(
`-- Mock data injected! (1000 employees)
-- Try some queries:

SELECT department,
       COUNT(*) AS headcount,
       ROUND(AVG(salary), 0) AS avg_salary,
       ROUND(AVG(score), 2) AS avg_score
FROM mock_data
GROUP BY department
ORDER BY avg_salary DESC;`,
                -1
            );

            updateTableBrowser();
            updateProfilerTables();
            window.showToast('✓ 1000 mock rows injected into "mock_data"!');
        } catch (err) {
            window.showToast(`Mock data error: ${err.message}`, true);
        } finally {
            showProgress(false);
        }
    }, 50);
}

/* ============================================================================
   SECTION 9: QUERY EXECUTION ENGINE
   Core function that takes the current SQL in the Ace editor, executes it
   against the in-memory SQLite database via sql.js, measures execution time
   with performance.now(), and dispatches results to the appropriate UI layer.
   Handles both DML (no result rows) and SELECT (result set) queries.
============================================================================ */

/**
 * runQuery()
 * Reads SQL from the Ace editor, executes it against AppState.db,
 * and renders the result set (or error) in the results panel.
 *
 * Timing: uses performance.now() for sub-millisecond precision.
 * DML queries (INSERT/UPDATE/CREATE/etc.) show the affected row count.
 * SELECT queries render a table and update chart column selectors.
 */
function runQuery() {
    // Guard: engine must be initialized
    if (!AppState.sqlReady || !AppState.db) {
        window.showToast('SQL engine is not ready yet.', true);
        return;
    }

    const sql = AppState.editor.getValue().trim();
    if (!sql) {
        window.showToast('Editor is empty. Write a SQL query first.', true);
        return;
    }

    // Update profiler dot to "running" state while the query executes
    updateProfilerStatus('running');

    // High-resolution timer start
    const startTime = performance.now();

    try {
        // sql.js exec() returns an array of result sets (one per SQL statement).
        // We take the LAST one to handle multi-statement inputs correctly.
        const resultSets = AppState.db.exec(sql);
        const elapsed    = performance.now() - startTime;

        if (resultSets.length === 0 || !resultSets[resultSets.length - 1]) {
            // ── DML query (INSERT, UPDATE, CREATE, DROP, etc.) — no rows returned
            const rowsChanged = AppState.db.getRowsModified();
            updateProfilerStatus('success');
            updateProfilerStats(elapsed, 0);
            showResultsEmpty(`Query executed successfully. ${rowsChanged} row(s) affected.`);
            AppState.lastResults = null;
            updateTableBrowser(); // Schema may have changed; refresh sidebar
            window.showToast(`✓ Query OK (${rowsChanged} rows affected, ${elapsed.toFixed(1)}ms)`);
            return;
        }

        // ── SELECT query — take the last result set for multi-statement SQL
        const lastResult       = resultSets[resultSets.length - 1];
        const { columns, values } = lastResult;

        // Persist results in AppState for export and chart rendering
        AppState.lastResults = { columns, rows: values };
        AppState.lastQuery   = sql;

        const rowCount = values.length;

        // Render the data table in the Results tab
        renderResultsTable(columns, values);

        // Populate the chart column selectors with the new column names
        updateChartColumnSelectors(columns);

        // Update profiler bar with timing and row count
        updateProfilerStatus('success');
        updateProfilerStats(elapsed, rowCount);

        window.showToast(`✓ ${rowCount.toLocaleString()} rows returned in ${elapsed.toFixed(1)}ms`);

    } catch (err) {
        const elapsed = performance.now() - startTime;

        // Display the error inline in the results panel (not just the console)
        showResultsError(err.message);
        updateProfilerStatus('error');
        updateProfilerStats(elapsed, 0);

        console.error('[SQL Studio] Query Error:', err);
    }
}

/* ============================================================================
   SECTION 10: RESULTS TABLE RENDERER
   Builds an HTML table from the sql.js result set arrays.
   Uses DocumentFragment for efficient batch DOM insertion.
   Performance cap: maximum 2000 rows rendered in the DOM (display only —
   exports always include the full result set).
============================================================================ */

/**
 * renderResultsTable(columns, rows)
 * Renders the query result as a styled HTML table in the Results tab.
 * NULL values get a special muted style; numeric values are right-aligned.
 * Results are capped at 2000 DOM rows for performance (a note is appended).
 *
 * @param {string[]} columns - Column header names from the result set
 * @param {Array[]}  rows    - 2D array of row values (in column order)
 */
function renderResultsTable(columns, rows) {
    // Hide error and empty states; show the table scroll container
    DOM.resultsError.style.display          = 'none';
    DOM.resultsEmptyState.style.display     = 'none';
    DOM.tableScrollContainer.style.display  = 'block';

    // ── Build the table header row ────────────────────────────────────────────
    const thCells = columns.map(col =>
        `<th title="${escapeHtml(String(col))}">${escapeHtml(String(col))}</th>`
    ).join('');
    DOM.tableHead.innerHTML = `<tr>${thCells}</tr>`;

    // ── Build the table body (cap at 2000 rows for DOM performance) ───────────
    const MAX_DISPLAY_ROWS = 2000;
    const displayRows      = rows.slice(0, MAX_DISPLAY_ROWS);

    // Use DocumentFragment for a single-shot DOM append (avoids multiple reflows)
    const fragment = document.createDocumentFragment();

    displayRows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(val => {
            const td = document.createElement('td');
            if (val === null || val === undefined) {
                // SQL NULL — shown in muted italic style
                td.className  = 'td-null';
                td.textContent = 'NULL';
            } else if (typeof val === 'number') {
                // Numeric values — right-aligned in accent color
                td.className  = 'td-number';
                td.textContent = val.toLocaleString();
            } else {
                td.textContent = String(val);
            }
            td.title = td.textContent; // Tooltip reveals truncated cell content
            tr.appendChild(td);
        });
        fragment.appendChild(tr);
    });

    DOM.tableBody.innerHTML = '';
    DOM.tableBody.appendChild(fragment);

    // Append a truncation notice if the result set exceeds the display cap
    if (rows.length > MAX_DISPLAY_ROWS) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan   = columns.length;
        td.style.cssText = 'text-align:center;color:var(--text-muted);font-style:italic;font-size:0.78rem;padding:10px;';
        td.textContent   = `⚠ Showing first ${MAX_DISPLAY_ROWS.toLocaleString()} of ${rows.length.toLocaleString()} rows. Export to see all.`;
        tr.appendChild(td);
        DOM.tableBody.appendChild(tr);
    }
}

/**
 * showResultsEmpty(message)
 * Shows the empty/information state in the results panel.
 * Used for: initial state, successful DML queries with no rows.
 *
 * @param {string} message - HTML string for the empty state paragraph
 */
function showResultsEmpty(message = 'Query results will appear here.') {
    DOM.resultsError.style.display         = 'none';
    DOM.tableScrollContainer.style.display = 'none';
    DOM.resultsEmptyState.style.display    = 'flex';
    DOM.resultsEmptyState.querySelector('p').innerHTML = message;
}

/**
 * showResultsError(errorText)
 * Shows the SQL error panel with the given error message.
 * The error content div is visible; table and empty state are hidden.
 *
 * @param {string} errorText - The SQL error message string
 */
function showResultsError(errorText) {
    DOM.tableScrollContainer.style.display  = 'none';
    DOM.resultsEmptyState.style.display     = 'none';
    DOM.resultsError.style.display          = 'flex';
    DOM.errorMessage.textContent            = errorText;
}

/* ============================================================================
   SECTION 11: PROFILER BAR UPDATES
   Updates the status bar below the editor with execution state,
   timing, row count, and table count. The status dot changes color
   based on the current state: idle / running / success / error.
============================================================================ */

/**
 * updateProfilerStatus(state)
 * Updates the status dot icon color and the status label text.
 * Valid states: 'idle' | 'ready' | 'running' | 'success' | 'error'
 *
 * @param {string} state - One of the valid state strings listed above
 */
function updateProfilerStatus(state) {
    const dot  = DOM.profilerStatus.querySelector('.sqs-profiler-dot');
    const span = DOM.profilerStatus.querySelector('span');

    // Update dot class — CSS transitions handle color animation
    dot.className = `fa-solid fa-circle-dot sqs-profiler-dot ${state}`;

    // Human-readable status label map
    const labels = { idle: 'Ready', ready: 'Ready', running: 'Running…', success: 'Success', error: 'Error' };
    span.textContent = labels[state] || 'Ready';
}

/**
 * updateProfilerStats(elapsed, rowCount)
 * Updates the execution time and row count displays in the profiler bar.
 *
 * @param {number} elapsed  - Execution time in milliseconds (from performance.now)
 * @param {number} rowCount - Number of rows returned by the last query
 */
function updateProfilerStats(elapsed, rowCount) {
    DOM.profilerTime.textContent = `${elapsed.toFixed(1)} ms`;
    DOM.profilerRows.textContent = `${rowCount.toLocaleString()} rows`;
}

/**
 * updateProfilerTables()
 * Updates the table count display based on AppState.tables.
 * Handles singular/plural "table" / "tables" correctly.
 */
function updateProfilerTables() {
    const count = Object.keys(AppState.tables).length;
    DOM.profilerTables.textContent = `${count} table${count !== 1 ? 's' : ''}`;
}

/* ============================================================================
   SECTION 12: TABLE BROWSER (SIDEBAR)
   Rebuilds the sidebar table list whenever a table is added or removed.
   Each entry shows the table name, row count, and expandable column list.
   Double-clicking a table header inserts a SELECT * query.
============================================================================ */

/**
 * updateTableBrowser()
 * Re-renders the sidebar table list from the current AppState.tables object.
 * Shows a friendly empty state if no tables are loaded.
 * Each table entry is collapsible with an animated chevron.
 */
function updateTableBrowser() {
    const tables = AppState.tables;
    const keys   = Object.keys(tables);

    // Empty state: no tables loaded yet
    if (keys.length === 0) {
        DOM.tableBrowser.innerHTML = `
            <div class="sqs-empty-state">
                <i class="fa-solid fa-database"></i>
                <p>No tables loaded yet.<br>Drop a file above to start.</p>
            </div>`;
        return;
    }

    DOM.tableBrowser.innerHTML = '';

    keys.forEach(tableName => {
        const meta  = tables[tableName];
        const entry = document.createElement('div');
        entry.className = 'table-entry';

        // ── Build the columns list HTML ──────────────────────────────────────
        const colsHtml = meta.columns.map(c => `
            <div class="column-item">
                <i class="fa-solid fa-circle" style="font-size:0.4rem;color:var(--text-muted)"></i>
                <span>${escapeHtml(c.name)}</span>
                <span class="col-type-badge">${c.type}</span>
            </div>`).join('');

        entry.innerHTML = `
            <div class="table-entry-header" data-table="${escapeHtml(tableName)}">
                <i class="fa-solid fa-table"></i>
                <span>${escapeHtml(tableName)}</span>
                <span class="table-row-count">${meta.rowCount.toLocaleString()}r</span>
                <i class="fa-solid fa-chevron-right" style="font-size:0.7rem;margin-left:4px;transition:transform 0.2s;"></i>
            </div>
            <div class="table-columns">${colsHtml}</div>`;

        // ── Toggle expand/collapse on single click ───────────────────────────
        const header = entry.querySelector('.table-entry-header');
        header.addEventListener('click', () => {
            entry.classList.toggle('open');
            const chevron = header.querySelector('.fa-chevron-right');
            chevron.style.transform = entry.classList.contains('open') ? 'rotate(90deg)' : 'rotate(0)';
        });

        // ── Double-click: insert a SELECT * preview query ────────────────────
        header.addEventListener('dblclick', () => {
            AppState.editor.setValue(`SELECT *\nFROM ${tableName}\nLIMIT 500;`, -1);
            window.showToast(`Preview query for "${tableName}" inserted.`);
        });

        DOM.tableBrowser.appendChild(entry);
    });
}

/* ============================================================================
   SECTION 13: SQL TEMPLATE BUTTONS
   Renders the pre-built SQL template buttons in the sidebar.
   On click, the template's SQL is inserted into the Ace editor with
   {{TABLE}} replaced by the first loaded table name (or 'your_table').
============================================================================ */

/**
 * renderTemplates()
 * Injects all SQL_TEMPLATES as button elements into the sidebar template list.
 * Uses event delegation on the parent container for efficiency.
 */
function renderTemplates() {
    DOM.templatesList.innerHTML = SQL_TEMPLATES.map((t, i) => `
        <button class="template-btn" data-index="${i}" title="${escapeHtml(t.description)}">
            <i class="${t.icon}"></i>
            <div class="template-btn-text">
                <strong>${escapeHtml(t.name)}</strong>
                <span>${escapeHtml(t.description)}</span>
            </div>
        </button>`).join('');

    // Event delegation: listen on the list container, find the clicked button
    DOM.templatesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.template-btn');
        if (!btn) return;

        const idx  = parseInt(btn.dataset.index, 10);
        const tmpl = SQL_TEMPLATES[idx];

        // Substitute {{TABLE}} with the first available table name
        const firstTable = Object.keys(AppState.tables)[0] || 'your_table';
        const sql        = tmpl.sql.replace(/{{TABLE}}/g, firstTable);

        AppState.editor.setValue(sql, -1);
        window.showToast(`Template "${tmpl.name}" inserted.`);

        // Ensure the user can see the editor results tab
        switchResultsTab('results-table');
    });
}

/* ============================================================================
   SECTION 14: CHART VISUALIZER
   Uses Chart.js to render the last query result set as Bar, Line, or
   Doughnut charts. Automatically selects label and value columns if the
   user has not manually specified them via the dropdowns.
============================================================================ */

/**
 * updateChartColumnSelectors(columns)
 * Populates the label and value column dropdowns with the current query's
 * column names. Called automatically after every successful SELECT query.
 *
 * @param {string[]} columns - Column names from the last result set
 */
function updateChartColumnSelectors(columns) {
    const auto = `<option value="">— auto —</option>`;
    const opts  = columns.map(c =>
        `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join('');
    DOM.chartLabelCol.innerHTML = auto + opts;
    DOM.chartValueCol.innerHTML = auto + opts;
}

/**
 * renderChart()
 * Renders a Chart.js chart from AppState.lastResults.
 * Auto-selects the first column as labels and the first numeric column as values
 * if the user has not manually chosen them via the dropdowns.
 * Destroys the previous chart instance before creating a new one.
 * Applies dark/light mode colors to Chart.js defaults.
 */
function renderChart() {
    if (!AppState.lastResults) {
        window.showToast('Run a query first to generate chart data.', true);
        return;
    }

    const { columns, rows } = AppState.lastResults;
    const chartType         = DOM.chartType.value;

    // ── Determine label column: prefer user's selection, else column 0 ────────
    let labelColIdx = 0;
    const userLabelCol = DOM.chartLabelCol.value;
    if (userLabelCol) {
        const idx = columns.indexOf(userLabelCol);
        if (idx >= 0) labelColIdx = idx;
    }

    // ── Determine value column: first numeric column that isn't the label ──────
    let valueColIdx = columns.findIndex((_, i) => {
        if (i === labelColIdx) return false;
        return rows.some(r => typeof r[i] === 'number');
    });
    if (valueColIdx < 0) valueColIdx = labelColIdx === 0 ? 1 : 0;

    // Override with user's explicit column selection if provided
    const userValueCol = DOM.chartValueCol.value;
    if (userValueCol) {
        const idx = columns.indexOf(userValueCol);
        if (idx >= 0) valueColIdx = idx;
    }

    // ── Extract display data (cap at 100 data points for readability) ─────────
    const MAX_CHART_ROWS = 100;
    const displayRows    = rows.slice(0, MAX_CHART_ROWS);
    const labels = displayRows.map(r => String(r[labelColIdx] ?? 'NULL'));
    const data   = displayRows.map(r => parseFloat(r[valueColIdx]) || 0);

    // Generate a visually distinct color palette for the dataset
    const palette = generateColorPalette(data.length);

    // ── Destroy the previous chart instance to prevent memory leaks ───────────
    if (AppState.chartInstance) {
        AppState.chartInstance.destroy();
        AppState.chartInstance = null;
    }

    // Show the canvas; hide the empty state placeholder
    DOM.chartEmptyState.style.display = 'none';
    DOM.vizChart.style.display        = 'block';

    // ── Apply theme-aware colors to Chart.js ─────────────────────────────────
    const isDark    = !document.body.classList.contains('light-mode');
    const textColor = isDark ? '#9aa0c0' : '#4a5275';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

    // Build dataset options — different properties for doughnut vs line vs bar
    const commonDatasetOptions = {
        label:       columns[valueColIdx] || 'Value',
        data,
        borderWidth: chartType === 'line' ? 2 : 1,
    };

    if (chartType === 'doughnut') {
        // Doughnut: multi-color segments using the full palette
        commonDatasetOptions.backgroundColor = palette.bg;
        commonDatasetOptions.borderColor     = palette.border;
    } else {
        // Bar / Line: single solid color from the palette
        commonDatasetOptions.backgroundColor = palette.bg[0];
        commonDatasetOptions.borderColor     = palette.border[0];
        if (chartType === 'line') {
            // Line chart extras: smooth curve, filled area, dynamic point radius
            commonDatasetOptions.pointRadius      = data.length > 50 ? 0 : 3;
            commonDatasetOptions.tension          = 0.4;
            commonDatasetOptions.fill             = true;
            commonDatasetOptions.backgroundColor  = palette.fill;
        }
    }

    // ── Create new Chart.js instance ──────────────────────────────────────────
    AppState.chartInstance = new Chart(DOM.vizChart, {
        type: chartType,
        data: { labels, datasets: [commonDatasetOptions] },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation:           { duration: 400 },
            plugins: {
                legend: {
                    display: chartType === 'doughnut',   // Only doughnuts show legend
                    labels:  { color: textColor, font: { family: 'Inter' } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.raw.toLocaleString()}` // Format numbers in tooltips
                    }
                }
            },
            // Axis scales only apply to non-doughnut chart types
            scales: chartType !== 'doughnut' ? {
                x: {
                    ticks: { color: textColor, maxTicksLimit: 20 },
                    grid:  { color: gridColor }
                },
                y: {
                    ticks: { color: textColor },
                    grid:  { color: gridColor }
                }
            } : {},
        }
    });

    // Inform user if data was trimmed for chart display
    if (rows.length > MAX_CHART_ROWS) {
        window.showToast(`Chart shows first ${MAX_CHART_ROWS} rows of ${rows.length.toLocaleString()}.`);
    }
}

/**
 * generateColorPalette(count)
 * Generates an array of HSL colors evenly distributed across the hue wheel.
 * Starts from the cyan/blue range (hue ~200) for brand consistency.
 *
 * @param {number} count - Number of colors needed
 * @returns {{ bg: string[], border: string[], fill: string }}
 */
function generateColorPalette(count) {
    const hueStep = 360 / Math.max(count, 8); // Prevent zero-step for tiny datasets
    const bg      = [];
    const border  = [];

    for (let i = 0; i < count; i++) {
        const h = (200 + i * hueStep) % 360; // Cycle through hues starting at cyan
        bg.push(`hsla(${h}, 70%, 60%, 0.7)`);
        border.push(`hsl(${h}, 70%, 50%)`);
    }

    return {
        bg,
        border,
        fill: 'rgba(0, 229, 255, 0.1)', // Solid area fill for line charts
    };
}

/* ============================================================================
   SECTION 15: EXPORT SYSTEM
   All exports are 100% client-side. No data ever leaves the browser.
   Five formats: CSV, JSON, SQL Dump (.sql), ZIP Archive, PDF Report.
   Plus: Copy results as JSON to clipboard.
============================================================================ */

/**
 * resultsToCSV()
 * Serializes AppState.lastResults as a proper CSV string.
 * Handles commas, quotes, and newlines in cell values by wrapping in quotes
 * and escaping internal double-quotes per RFC 4180.
 *
 * @returns {string} Full CSV string including header row
 */
function resultsToCSV() {
    if (!AppState.lastResults) return '';
    const { columns, rows } = AppState.lastResults;

    // Escape a single cell value: wrap in quotes if it contains special chars
    const escape = val => {
        const str = val === null ? '' : String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const header = columns.map(escape).join(',');
    const body   = rows.map(row => row.map(escape).join(',')).join('\n');
    return `${header}\n${body}`;
}

/**
 * resultsToJSON()
 * Serializes AppState.lastResults as a formatted JSON string.
 * Each row is converted to a plain object with column names as keys.
 *
 * @returns {string} Pretty-printed JSON array of row objects
 */
function resultsToJSON() {
    if (!AppState.lastResults) return '[]';
    const { columns, rows } = AppState.lastResults;

    // Map each row array to a column-keyed object
    const objects = rows.map(row => {
        const obj = {};
        columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
    });
    return JSON.stringify(objects, null, 2);
}

/**
 * generateSqlDump()
 * Generates a full SQL dump of the in-memory database.
 * For each loaded table: DROP TABLE IF EXISTS + CREATE TABLE + all INSERT statements.
 * Includes a privacy header and PRAGMA statements.
 *
 * @returns {string} Complete SQL dump as a multi-line string
 */
function generateSqlDump() {
    if (!AppState.db) return '-- No database loaded.';

    const lines = [
        `-- SQL Studio ULTRA MAX — Full Database Dump`,
        `-- Generated: ${new Date().toISOString()}`,
        `-- Tables: ${Object.keys(AppState.tables).join(', ')}`,
        `-- Privacy: Generated 100% client-side. No data was sent to any server.`,
        ``,
        `PRAGMA foreign_keys = OFF;`,
        ``
    ];

    Object.keys(AppState.tables).forEach(tableName => {
        const meta = AppState.tables[tableName];

        // ── CREATE TABLE statement with inferred column types ─────────────────
        const colDefs = meta.columns.map(c => `  "${c.name}" ${c.type}`).join(',\n');
        lines.push(`-- Table: ${tableName}`);
        lines.push(`DROP TABLE IF EXISTS "${tableName}";`);
        lines.push(`CREATE TABLE "${tableName}" (\n${colDefs}\n);`);
        lines.push('');

        // ── INSERT statements — one per row ───────────────────────────────────
        try {
            const results = AppState.db.exec(`SELECT * FROM "${tableName}"`);
            if (results.length > 0) {
                const { columns, values } = results[0];
                const colList = columns.map(c => `"${c}"`).join(', ');

                values.forEach(row => {
                    const vals = row.map(v => {
                        if (v === null) return 'NULL';
                        if (typeof v === 'number') return v;
                        return `'${String(v).replace(/'/g, "''")}'`; // Escape single quotes
                    }).join(', ');
                    lines.push(`INSERT INTO "${tableName}" (${colList}) VALUES (${vals});`);
                });
            }
        } catch (e) {
            lines.push(`-- Error dumping table "${tableName}": ${e.message}`);
        }

        lines.push('');
    });

    lines.push(`PRAGMA foreign_keys = ON;`);
    return lines.join('\n');
}

/**
 * exportCSV()
 * Triggers a browser download of query results as a .csv file.
 * Uses FileSaver.js saveAs() for cross-browser compatibility.
 */
function exportCSV() {
    if (!AppState.lastResults) {
        window.showToast('No query results to export. Run a query first.', true);
        return;
    }
    const csv  = resultsToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `sql-studio-results-${timestamp()}.csv`);
    window.showToast('✓ CSV downloaded.');
}

/**
 * exportJSON()
 * Triggers a browser download of query results as a .json file.
 */
function exportJSON() {
    if (!AppState.lastResults) {
        window.showToast('No query results to export. Run a query first.', true);
        return;
    }
    const json = resultsToJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    saveAs(blob, `sql-studio-results-${timestamp()}.json`);
    window.showToast('✓ JSON downloaded.');
}

/**
 * exportSQLDump()
 * Triggers a browser download of the full database as a .sql dump file.
 * Includes CREATE TABLE + all INSERT statements for every loaded table.
 */
function exportSQLDump() {
    if (Object.keys(AppState.tables).length === 0) {
        window.showToast('No tables in database to dump. Load a file first.', true);
        return;
    }
    const sql  = generateSqlDump();
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8;' });
    saveAs(blob, `sql-studio-dump-${timestamp()}.sql`);
    window.showToast('✓ SQL dump downloaded.');
}

/**
 * exportZIP()
 * Generates a ZIP archive containing:
 *   • results.csv       — query results as CSV
 *   • results.json      — query results as JSON
 *   • database-dump.sql — full SQLite schema + data dump
 *   • README.txt        — export metadata and privacy statement
 * Uses JSZip + FileSaver.
 */
async function exportZIP() {
    if (!AppState.lastResults && Object.keys(AppState.tables).length === 0) {
        window.showToast('Nothing to export. Load data and run a query first.', true);
        return;
    }

    const zip = new JSZip();

    // Add results files if a query has been run
    if (AppState.lastResults) {
        zip.file('results.csv',  resultsToCSV());
        zip.file('results.json', resultsToJSON());
    }

    // Always include the SQL dump if any tables exist
    if (Object.keys(AppState.tables).length > 0) {
        zip.file('database-dump.sql', generateSqlDump());
    }

    // Human-readable README with metadata
    zip.file('README.txt',
        `SQL Studio ULTRA MAX — Export Package\n` +
        `Generated: ${new Date().toLocaleString()}\n` +
        `Query: ${AppState.lastQuery || 'N/A'}\n\n` +
        `Files:\n` +
        `  results.csv        — Query results as CSV\n` +
        `  results.json       — Query results as JSON\n` +
        `  database-dump.sql  — Full SQLite schema + INSERT statements\n\n` +
        `Privacy: All data processed 100% client-side. Nothing was sent to any server.\n` +
        `Tool: https://trustedtoolsweb.com/tools/dev/dev-sql-studio/\n`
    );

    try {
        const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        saveAs(content, `sql-studio-export-${timestamp()}.zip`);
        window.showToast('✓ ZIP archive downloaded.');
    } catch (err) {
        window.showToast(`ZIP export failed: ${err.message}`, true);
    }
}

/**
 * exportPDF()
 * Generates a formatted PDF report using jsPDF (UMD build).
 * Includes: branded header, query preview box, stats line, and a
 * paginated data table with alternating row shading.
 * Limited to 300 rows for manageable PDF file size.
 */
function exportPDF() {
    if (!AppState.lastResults) {
        window.showToast('No query results to export. Run a query first.', true);
        return;
    }

    // jsPDF is available as window.jspdf.jsPDF in the UMD build
    const { jsPDF }      = window.jspdf;
    const doc            = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    const { columns, rows } = AppState.lastResults;
    const ts     = new Date().toLocaleString();
    const pageW  = doc.internal.pageSize.getWidth();
    const margin = 36;

    // ── Header band ───────────────────────────────────────────────────────────
    doc.setFillColor(13, 15, 23);
    doc.rect(0, 0, pageW, 60, 'F');
    doc.setTextColor(0, 229, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SQL Studio ULTRA MAX', margin, 32);
    doc.setTextColor(154, 160, 192);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Query Results Report  •  Generated: ${ts}`, margin, 48);

    // ── Query preview box ─────────────────────────────────────────────────────
    doc.setFillColor(26, 30, 46);
    doc.roundedRect(margin, 70, pageW - margin * 2, 40, 4, 4, 'F');
    doc.setTextColor(200, 210, 230);
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    const queryPreview = (AppState.lastQuery || '').substring(0, 200).replace(/\n/g, ' ');
    doc.text(`SQL: ${queryPreview}`, margin + 8, 94, { maxWidth: pageW - margin * 2 - 16 });

    // ── Stats line ────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 120, 160);
    doc.setFontSize(8);
    doc.text(
        `${rows.length.toLocaleString()} rows × ${columns.length} columns  •  ${Object.keys(AppState.tables).join(', ')}`,
        margin,
        128
    );

    // ── Data table (manual rendering — no autoTable plugin required) ──────────
    const colWidth  = Math.max(60, Math.min(140, (pageW - margin * 2) / columns.length));
    const rowHeight = 18;
    let   y         = 146;

    // Column headers row
    doc.setFillColor(31, 36, 54);
    doc.rect(margin, y, pageW - margin * 2, rowHeight, 'F');
    doc.setTextColor(0, 229, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    columns.forEach((col, i) => {
        doc.text(String(col).substring(0, 18), margin + i * colWidth + 4, y + 12, { maxWidth: colWidth - 6 });
    });
    y += rowHeight;

    // Data rows (capped at 300 for reasonable PDF size)
    const pdfRows = rows.slice(0, 300);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    pdfRows.forEach((row, ri) => {
        // Page break check: add new page if current row would overflow
        if (y + rowHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
        }

        // Alternating zebra stripe for readability
        if (ri % 2 === 0) {
            doc.setFillColor(20, 24, 38);
            doc.rect(margin, y, pageW - margin * 2, rowHeight, 'F');
        }

        // Render each cell value (truncated to 25 chars for fitting)
        doc.setTextColor(220, 225, 240);
        row.forEach((val, i) => {
            const display = val === null ? 'NULL' : String(val).substring(0, 25);
            doc.text(display, margin + i * colWidth + 4, y + 12, { maxWidth: colWidth - 6 });
        });
        y += rowHeight;
    });

    // Truncation notice if PDF was capped at 300 rows
    if (rows.length > 300) {
        y += 10;
        doc.setTextColor(150, 120, 60);
        doc.setFontSize(8);
        doc.text(
            `Note: PDF shows first 300 of ${rows.length.toLocaleString()} rows. Export as CSV/JSON for full dataset.`,
            margin,
            y
        );
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(13, 15, 23);
        doc.rect(0, doc.internal.pageSize.getHeight() - 24, pageW, 24, 'F');
        doc.setTextColor(80, 90, 120);
        doc.setFontSize(7);
        doc.text(
            `SQL Studio ULTRA MAX  •  trustedtoolsweb.com  •  100% client-side, zero privacy risk  •  Page ${p} of ${totalPages}`,
            margin,
            doc.internal.pageSize.getHeight() - 9
        );
    }

    doc.save(`sql-studio-report-${timestamp()}.pdf`);
    window.showToast('✓ PDF report downloaded.');
}

/**
 * copyResultsAsJSON()
 * Copies the last query results as a formatted JSON string to the clipboard.
 * Uses the modern Clipboard API with a fallback to execCommand for older browsers.
 */
async function copyResultsAsJSON() {
    if (!AppState.lastResults) {
        window.showToast('No results to copy. Run a query first.', true);
        return;
    }
    try {
        // Modern Clipboard API (Chrome/Firefox/Safari with secure context)
        await navigator.clipboard.writeText(resultsToJSON());
        window.showToast('✓ JSON copied to clipboard.');
    } catch {
        // Legacy fallback via temporary textarea + document.execCommand
        const ta    = document.createElement('textarea');
        ta.value    = resultsToJSON();
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        window.showToast('✓ JSON copied to clipboard.');
    }
}

/**
 * timestamp()
 * Generates a compact timestamp string suitable for use in filenames.
 * Format: "YYYYMMDDTHHmmss" — e.g. "20240711T143022"
 *
 * @returns {string}
 */
function timestamp() {
    return new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(/-/g, '').slice(0, 15);
}

/* ============================================================================
   SECTION 16: RESULTS TAB SWITCHING
   Activates the correct tab button and shows the corresponding content panel.
   Uses CSS class toggling (active) rather than display manipulation
   for smooth transitions and proper CSS selector support.
============================================================================ */

/**
 * switchResultsTab(tabId)
 * Activates the tab button and content panel matching the given ID.
 *
 * @param {string} tabId - One of: 'results-table' | 'results-chart' | 'results-export'
 */
function switchResultsTab(tabId) {
    // Toggle .active class on tab buttons based on matching data-tab attribute
    DOM.resultsTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Toggle .active class on tab content panels based on matching element ID
    DOM.resultsTabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

/* ============================================================================
   SECTION 17: SQL FORMAT / BEAUTIFY
   A lightweight SQL formatter — not a full parser, but handles the most
   common developer expectations: keyword capitalization and clause newlines.
   Uses regex-based keyword replacement for portability (no external lib).
============================================================================ */

/**
 * formatSQL()
 * Reads the raw SQL from the editor, capitalizes all recognized SQL keywords,
 * inserts newlines before major clause keywords, removes extra blank lines,
 * and writes the result back into the editor.
 * Shows a brief info toast on completion.
 */
function formatSQL() {
    const raw = AppState.editor.getValue();
    if (!raw.trim()) return;

    // ── Keywords that should each appear on their own line ────────────────────
    const lineBreakKeywords = [
        'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY',
        'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
        'OUTER JOIN', 'CROSS JOIN', 'UNION', 'UNION ALL', 'WITH', 'SET',
        'INSERT INTO', 'VALUES', 'UPDATE', 'DELETE FROM', 'CREATE TABLE',
        'DROP TABLE', 'ALTER TABLE', 'ON', 'AND', 'OR',
    ];

    let formatted = raw;

    // ── All keywords to capitalize (includes line-break keywords) ─────────────
    const allKeywords = [
        ...lineBreakKeywords,
        'AS', 'IN', 'NOT', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'ALL',
        'ASC', 'DESC', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
        'COALESCE', 'IFNULL', 'CAST', 'ROUND', 'DATE', 'SUBSTR',
    ];

    // Step 1: Capitalize each keyword using a word-boundary regex
    allKeywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'gi');
        formatted = formatted.replace(regex, kw);
    });

    // Step 2: Insert a newline before each major clause keyword
    lineBreakKeywords.forEach(kw => {
        const regex = new RegExp(`\\s+\\b(${kw.replace(/ /g, '\\s+')})\\b`, 'gi');
        formatted = formatted.replace(regex, `\n${kw}`);
    });

    // Step 3: Collapse 3+ consecutive blank lines into at most 2
    formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();

    AppState.editor.setValue(formatted, -1);
    window.showToast('SQL formatted.');
}

/* ============================================================================
   SECTION 18: DRAG & DROP HANDLER
   Sets up drag-and-drop events on the drop zone element.
   Prevents the browser's default behavior of navigating to a dropped file.
   Processes multiple files sequentially (each becomes its own table).
============================================================================ */

/**
 * initDragAndDrop()
 * Attaches drag-and-drop event listeners to DOM.dropZone.
 * Also attaches the change listener to the hidden file input (Browse Files).
 */
function initDragAndDrop() {
    const zone = DOM.dropZone;

    // Prevent the browser from opening dropped files as navigation events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        document.addEventListener(evt, e => e.preventDefault(), false);
    });

    // Visual feedback: add .dragover class while a file is being dragged over the zone
    zone.addEventListener('dragenter', () => zone.classList.add('dragover'));
    zone.addEventListener('dragover',  () => zone.classList.add('dragover'));
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

    // On drop: process each dropped file sequentially
    zone.addEventListener('drop', async (e) => {
        zone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            await processFile(file); // Sequential: each file creates its own table
        }
    });

    // Hidden <input type="file"> — triggers when Browse Files button is clicked
    DOM.fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            await processFile(file);
        }
        DOM.fileInput.value = ''; // Reset so the same file can be re-selected
    });
}

/* ============================================================================
   SECTION 19: CLEAR DATABASE
   Drops all tables from the in-memory SQLite database and resets the UI
   back to the initial state (empty sidebar, empty results, reset profiler).
============================================================================ */

/**
 * clearDatabase()
 * Iterates all tables in AppState.tables, issues DROP TABLE statements,
 * clears state, and resets every UI component to its initial empty state.
 * Also destroys any active Chart.js instance to free canvas memory.
 */
function clearDatabase() {
    if (!AppState.db) return;

    // Drop every known table from the in-memory SQLite instance
    Object.keys(AppState.tables).forEach(tableName => {
        try {
            AppState.db.run(`DROP TABLE IF EXISTS "${tableName}";`);
        } catch (e) { /* Silently ignore drop errors for robustness */ }
    });

    // Reset application state
    AppState.tables      = {};
    AppState.lastResults = null;
    AppState.lastQuery   = '';

    // Reset all UI components to their initial empty/idle states
    updateTableBrowser();
    updateProfilerTables();
    updateProfilerStatus('idle');
    DOM.profilerTime.textContent = '— ms';
    DOM.profilerRows.textContent = '— rows';

    // Restore the results empty state with the default message
    showResultsEmpty('Query results will appear here.<br>Run a SQL query to get started.');

    // Destroy Chart.js instance and reset the canvas
    if (AppState.chartInstance) {
        AppState.chartInstance.destroy();
        AppState.chartInstance = null;
    }
    DOM.vizChart.style.display        = 'none';
    DOM.chartEmptyState.style.display = 'flex';

    window.showToast('Database cleared. All tables removed from memory.');
}

/* ============================================================================
   SECTION 20: UTILITY FUNCTIONS
   Small helper functions used throughout the codebase.
============================================================================ */

/**
 * escapeHtml(str)
 * Escapes HTML special characters to prevent XSS when inserting user-supplied
 * or file-derived strings into innerHTML (table headers, sidebar table names,
 * column names from CSV/JSON headers).
 *
 * Replaces: & < > " '
 *
 * @param {string} str - Raw string that may contain HTML characters
 * @returns {string} HTML-safe string safe for innerHTML insertion
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}

/* ============================================================================
   SECTION 21: EVENT LISTENERS WIRING
   All button click handlers and interactive element listeners are bound here
   in a single function, keeping event handling centralized and separated
   from both DOM structure (HTML) and business logic (above functions).
============================================================================ */

/**
 * bindEventListeners()
 * Attaches all event listeners to cached DOM references.
 * Called once during app bootstrap after cacheDomRefs().
 */
function bindEventListeners() {
    // ── Editor toolbar: Run Query, Format SQL, Clear Editor ──────────────────
    DOM.runQueryBtn.addEventListener('click',    runQuery);
    DOM.formatSqlBtn.addEventListener('click',   formatSQL);
    DOM.clearEditorBtn.addEventListener('click', () => {
        AppState.editor.setValue('', -1); // Empty the editor without destroying Ace
    });

    // ── Drop zone: Mock Data injection button ─────────────────────────────────
    DOM.mockDataBtn.addEventListener('click', injectMockData);

    // ── Sidebar: Clear Database button (with confirmation dialog) ─────────────
    DOM.clearDbBtn.addEventListener('click', () => {
        if (Object.keys(AppState.tables).length === 0) {
            window.showToast('Database is already empty.');
            return;
        }
        // Confirm before destructive action — no undo possible
        if (confirm('Clear all tables from the in-memory database? This cannot be undone.')) {
            clearDatabase();
        }
    });

    // ── Results panel: Tab switching ──────────────────────────────────────────
    DOM.resultsTabs.forEach(tab => {
        tab.addEventListener('click', () => switchResultsTab(tab.dataset.tab));
    });

    // ── Chart tab: Render Chart button ────────────────────────────────────────
    DOM.renderChartBtn.addEventListener('click', () => {
        switchResultsTab('results-chart'); // Ensure the chart tab is visible first
        renderChart();
    });

    // ── Export tab: all six export action buttons ─────────────────────────────
    DOM.exportCsvBtn.addEventListener('click',  exportCSV);
    DOM.exportJsonBtn.addEventListener('click', exportJSON);
    DOM.exportSqlBtn.addEventListener('click',  exportSQLDump);
    DOM.exportZipBtn.addEventListener('click',  exportZIP);
    DOM.exportPdfBtn.addEventListener('click',  exportPDF);
    DOM.copyJsonBtn.addEventListener('click',   copyResultsAsJSON);
}

/* ============================================================================
   SECTION 22: BOOTSTRAP — App Initialization
   Entry point for the entire application.
   Async to allow awaiting WebAssembly initialization (sql.js).
   Mobile API compatibility check: warns if WebAssembly is unavailable.
============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {

    // ── Step 1: Mobile / WebAssembly compatibility check ─────────────────────
    // sql.js requires WebAssembly support. Warn mobile users on very old devices,
    // but do not block — modern mobile browsers all support WASM.
    const isMobile   = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const hasWasm    = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    if (isMobile && !hasWasm) {
        window.showToast('Your browser may not support WebAssembly. SQL engine may not work.', true);
    }

    // ── Step 2: Cache all DOM references ─────────────────────────────────────
    cacheDomRefs();

    // ── Step 3: Initialize the Ace SQL code editor ────────────────────────────
    initAceEditor();

    // ── Step 4: Render the SQL template buttons in the sidebar ────────────────
    renderTemplates();

    // ── Step 5: Set up drag-and-drop + file input listeners ──────────────────
    initDragAndDrop();

    // ── Step 6: Bind all button and interactive element event listeners ───────
    bindEventListeners();

    // ── Step 7: Initialize WebAssembly SQLite engine (async) ──────────────────
    // This is the most critical bootstrap step — all query execution depends on it.
    // initSqlJs() will show a global error toast if the WASM binary fails to load.
    await initSqlJs();

    // ── Step 8: Welcome toast once everything is ready ────────────────────────
    if (AppState.sqlReady) {
        window.showToast('SQL Studio ULTRA MAX ready. Drop a file or inject mock data to start!');
    }

    console.info('[SQL Studio] App initialized ✓');
});
