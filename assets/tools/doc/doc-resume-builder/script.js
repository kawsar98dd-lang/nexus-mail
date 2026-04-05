
    /**
     * ============================================================
     * SMART CV BUILDER PRO MAX — Core JavaScript Engine
     * ============================================================
     * ARCHITECTURE OVERVIEW:
     *  - cvbState        : Central data object (single source of truth)
     *  - cvbUpdatePreview: Re-renders the live resume DOM from state
     *  - cvbSave         : Persists state to localStorage
     *  - cvbLoad         : Restores state from localStorage on page load
     *  - SortableJS      : Handles drag-and-drop for list items
     *  - html2pdf        : Handles PDF generation
     *  - QRCode          : Handles vCard QR generation
     *  - DOMPurify       : Sanitizes all user input before DOM injection
     * ============================================================
     */

    /* ─────────────────────────────────────────────────────────────
       1. GLOBAL STATE OBJECT
       This is the single source of truth for all resume data.
       Every form input writes to this object.
       cvbUpdatePreview() reads from this object to render the DOM.
       ───────────────────────────────────────────────────────────── */

    let cvbState = {
        // Active template class (tpl-classic | tpl-modern | tpl-minimal)
        template: 'tpl-classic',

        // Personal information fields
        personal: {
            name: '',
            jobTitle: '',
            email: '',
            phone: '',
            location: '',
            linkedin: '',
            website: '',
            github: ''
        },

        // Professional summary paragraph
        summary: '',

        // Arrays for repeatable sections (each item has a unique id)
        experience: [],   // { id, company, role, start, end, current, description }
        education: [],    // { id, school, degree, field, start, end, gpa }
        projects: [],     // { id, name, tech, url, description }
        certs: [],        // { id, name, issuer, date, url }
        languages: [],    // { id, name, level, proficiency (0-100) }

        // Skills array of strings
        skills: []
    };

    /* ─────────────────────────────────────────────────────────────
       2. UNIQUE ID GENERATOR
       Lightweight helper used to give each repeatable item a
       unique DOM id for targeting and state updates.
       ───────────────────────────────────────────────────────────── */
    function cvbUid() {
        // Returns a random string like "cvb_a3f7k2"
        return 'cvb_' + Math.random().toString(36).substr(2, 6);
    }

    /* ─────────────────────────────────────────────────────────────
       3. AUTO-SAVE SYSTEM (localStorage)
       Debounced save function. Runs 600ms after the last input event.
       This prevents writing to localStorage on every single keystroke,
       which could be slow on low-end devices.
       ───────────────────────────────────────────────────────────── */

    const CVB_STORAGE_KEY = 'ttw_cv_builder_v1'; // localStorage key
    let cvbSaveTimer = null;

    /**
     * cvbScheduleSave()
     * Called on every input event. Debounces the actual save by 600ms.
     */
    function cvbScheduleSave() {
        // Show "Saving..." state
        cvbSetAutosaveStatus('saving');
        clearTimeout(cvbSaveTimer);
        cvbSaveTimer = setTimeout(() => {
            cvbSave();
        }, 600);
    }

    /**
     * cvbSave()
     * Serializes cvbState to JSON and writes it to localStorage.
     */
    function cvbSave() {
        try {
            localStorage.setItem(CVB_STORAGE_KEY, JSON.stringify(cvbState));
            cvbSetAutosaveStatus('saved');
            cvbUpdateProgress();
        } catch (e) {
            // localStorage might be full or disabled
            console.warn('CVB AutoSave: localStorage write failed.', e);
            cvbSetAutosaveStatus('error');
        }
    }

    /**
     * cvbLoad()
     * Reads cvbState from localStorage and populates all form fields.
     * Called once on DOMContentLoaded.
     */
    function cvbLoad() {
        try {
            const raw = localStorage.getItem(CVB_STORAGE_KEY);
            if (!raw) return; // Nothing saved yet

            const saved = JSON.parse(raw);

            // Deep-merge saved data into default state
            cvbState = Object.assign(cvbState, saved);

            // Populate all personal info fields
            const p = cvbState.personal;
            setVal('cvb-name',      p.name);
            setVal('cvb-jobtitle',  p.jobTitle);
            setVal('cvb-email',     p.email);
            setVal('cvb-phone',     p.phone);
            setVal('cvb-location',  p.location);
            setVal('cvb-linkedin',  p.linkedin);
            setVal('cvb-website',   p.website);
            setVal('cvb-github',    p.github);

            // Populate summary
            setVal('cvb-summary', cvbState.summary);
            cvbUpdateSummaryCount();

            // Restore repeatable sections (re-renders each item's HTML)
            cvbState.experience.forEach(item => cvbRenderExpItem(item));
            cvbState.education.forEach(item  => cvbRenderEduItem(item));
            cvbState.projects.forEach(item   => cvbRenderProjItem(item));
            cvbState.certs.forEach(item      => cvbRenderCertItem(item));
            cvbState.languages.forEach(item  => cvbRenderLangItem(item));

            // Restore skills tags
            cvbState.skills.forEach(skill => cvbRenderSkillTag(skill));

            // Apply saved template
            cvbSetTemplate(cvbState.template, false); // false = don't save again

            // Trigger live preview update
            cvbUpdatePreview();

            cvbSetAutosaveStatus('saved');
        } catch (e) {
            console.warn('CVB Load: Could not restore saved data.', e);
        }
    }

    /**
     * Helper: set an input/textarea value safely.
     */
    function setVal(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined) el.value = value || '';
    }

    /* ─────────────────────────────────────────────────────────────
       4. AUTOSAVE INDICATOR UI
       Updates the status badge in the panel header.
       ───────────────────────────────────────────────────────────── */
    function cvbSetAutosaveStatus(status) {
        const el = document.getElementById('cvb-autosave-status');
        if (!el) return;

        const configs = {
            saving: { cls: '',      icon: 'fa-spin fa-circle-notch', text: 'Saving…' },
            saved:  { cls: 'saved', icon: 'fa-check',                text: 'Saved'   },
            error:  { cls: '',      icon: 'fa-exclamation',          text: 'Save Error' }
        };

        const cfg = configs[status] || configs.saved;
        el.className = 'cvb-autosave-indicator ' + cfg.cls;
        el.innerHTML = `<i class="fa-solid ${cfg.icon} cvb-autosave-dot" style="font-size:9px"></i><span>${cfg.text}</span>`;
    }

    /* ─────────────────────────────────────────────────────────────
       5. PROGRESS TRACKER
       Calculates a "resume completion %" based on filled sections.
       Updates the progress bar and section status dots.
       ───────────────────────────────────────────────────────────── */
    function cvbUpdateProgress() {
        // Define each section and its completion check
        const checks = [
            { id: 'personal',  done: !!(cvbState.personal.name && cvbState.personal.email) },
            { id: 'summary',   done: cvbState.summary.length > 30 },
            { id: 'experience',done: cvbState.experience.length > 0 },
            { id: 'education', done: cvbState.education.length > 0 },
            { id: 'skills',    done: cvbState.skills.length >= 3 },
            { id: 'projects',  done: cvbState.projects.length > 0 },
            { id: 'certs',     done: cvbState.certs.length > 0 },
            { id: 'languages', done: cvbState.languages.length > 0 }
        ];

        const done = checks.filter(c => c.done).length;
        const pct  = Math.round((done / checks.length) * 100);

        // Update the progress bar fill width
        const bar = document.getElementById('cvb-progress-fill');
        if (bar) bar.style.width = pct + '%';

        // Update each section's status dot
        checks.forEach(c => {
            const dot = document.getElementById('status-' + c.id);
            if (dot) dot.classList.toggle('complete', c.done);
        });
    }

    /* ─────────────────────────────────────────────────────────────
       6. TEMPLATE SELECTOR
       Swaps the template class on #cvb-resume-doc.
       ───────────────────────────────────────────────────────────── */
    function cvbSetTemplate(tpl, shouldSave = true) {
        const doc = document.getElementById('cvb-resume-doc');
        if (!doc) return;

        // Remove all existing template classes, add the new one
        doc.classList.remove('tpl-classic', 'tpl-modern', 'tpl-minimal');
        doc.classList.add(tpl);

        // Update state
        cvbState.template = tpl;

        // Update the active button highlight
        document.querySelectorAll('.cvb-tpl-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tpl === tpl);
        });

        if (shouldSave) cvbScheduleSave();
    }

    /* ─────────────────────────────────────────────────────────────
       7. ACCORDION SECTIONS (Toggle open/close)
       ───────────────────────────────────────────────────────────── */
    function cvbToggleSection(headerEl) {
        const section = headerEl.closest('.cvb-section');
        section.classList.toggle('is-open');
    }

    /* ─────────────────────────────────────────────────────────────
       8. LIVE PREVIEW RENDERER
       The heart of the tool. Reads cvbState and updates the resume
       DOM. Called on every input event via event delegation.

       Security: All user content passes through DOMPurify.sanitize()
       before being inserted into the DOM to prevent XSS.
       ───────────────────────────────────────────────────────────── */

    // Helper: sanitize user input (XSS protection via DOMPurify)
    function san(str) {
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(str || '');
        }
        // Fallback if DOMPurify somehow not loaded
        return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * cvbUpdatePreview()
     * Full re-render of the resume preview from current cvbState.
     * Efficient enough to call on every keystroke.
     */
    function cvbUpdatePreview() {
        const p = cvbState.personal;

        // ── Name & Title ──
        setText('res-name',      p.name      || 'Your Name');
        setText('res-job-title', p.jobTitle  || 'Professional Title');

        // ── Contact Bar ──
        // Build an array of contact items, only show filled fields
        const contacts = [];
        if (p.email)    contacts.push(`<span><i class="fa-solid fa-envelope"></i> ${san(p.email)}</span>`);
        if (p.phone)    contacts.push(`<span><i class="fa-solid fa-phone"></i> ${san(p.phone)}</span>`);
        if (p.location) contacts.push(`<span><i class="fa-solid fa-location-dot"></i> ${san(p.location)}</span>`);
        if (p.linkedin) contacts.push(`<span><i class="fa-brands fa-linkedin"></i> ${san(p.linkedin.replace(/https?:\/\/(www\.)?/,''))}</span>`);
        if (p.website)  contacts.push(`<span><i class="fa-solid fa-globe"></i> ${san(p.website.replace(/https?:\/\/(www\.)?/,''))}</span>`);
        if (p.github)   contacts.push(`<span><i class="fa-brands fa-github"></i> ${san(p.github.replace(/https?:\/\/(www\.)?/,''))}</span>`);

        setHTML('res-contact-bar', contacts.join('') || '<span style="opacity:0.5">email · phone · location</span>');

        // ── Summary ──
        const summaryText = cvbState.summary || 'Your professional summary will appear here…';
        setText('res-summary-text', summaryText);

        // ── Skills ──
        if (cvbState.skills.length > 0) {
            const tagHTML = cvbState.skills.map(s =>
                `<span class="res-skill-tag">${san(s)}</span>`
            ).join('');
            setHTML('res-skills-output', tagHTML);
        } else {
            setHTML('res-skills-output', '<span class="res-skill-tag" style="background:rgba(0,0,0,0.06);color:#999">Your skills here</span>');
        }

        // ── Work Experience ──
        renderExperiencePreview();

        // ── Education ──
        renderEducationPreview();

        // ── Projects ──
        renderProjectsPreview();

        // ── Certifications ──
        renderCertsPreview();

        // ── Languages ──
        renderLanguagesPreview();
    }

    /**
     * Helper: set textContent safely.
     */
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /**
     * Helper: set innerHTML (sanitized content only).
     */
    function setHTML(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    /**
     * renderExperiencePreview()
     * Reads cvbState.experience and builds the HTML for the preview.
     */
    function renderExperiencePreview() {
        const section = document.getElementById('res-exp-section');
        const output  = document.getElementById('res-exp-output');
        if (!section || !output) return;

        if (cvbState.experience.length === 0) {
            output.innerHTML = '<p style="font-size:12px;color:#b2bec3;">Add your work experience…</p>';
            return;
        }

        // Each experience entry rendered as HTML
        const html = cvbState.experience.map(exp => {
            // Convert plain-text bullets (lines starting with - or •) to <li> tags
            let desc = san(exp.description || '');
            if (desc.includes('\n')) {
                const lines = desc.split('\n').filter(l => l.trim());
                desc = '<ul>' + lines.map(l =>
                    `<li>${l.replace(/^[-•]\s*/, '')}</li>`
                ).join('') + '</ul>';
            }

            const dateRange = [exp.start, exp.current ? 'Present' : exp.end].filter(Boolean).join(' – ');

            return `
                <div class="res-entry">
                    <div class="res-entry-title">${san(exp.role) || 'Role / Position'}</div>
                    <div class="res-entry-sub">${san(exp.company) || 'Company Name'}</div>
                    <div class="res-entry-date">${san(dateRange)}</div>
                    <div class="res-entry-desc">${desc}</div>
                </div>
            `;
        }).join('');

        output.innerHTML = html;
    }

    /**
     * renderEducationPreview()
     */
    function renderEducationPreview() {
        const section = document.getElementById('res-edu-section');
        const output  = document.getElementById('res-edu-output');
        if (!section || !output) return;

        if (cvbState.education.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';

        const html = cvbState.education.map(edu => {
            const degree = [san(edu.degree), san(edu.field)].filter(Boolean).join(' in ');
            const dateRange = [edu.start, edu.end].filter(Boolean).join(' – ');
            const gpa = edu.gpa ? `<span style="font-size:11px;color:#b2bec3"> · GPA: ${san(edu.gpa)}</span>` : '';
            return `
                <div class="res-entry">
                    <div class="res-entry-title">${san(edu.school) || 'University / School'}</div>
                    <div class="res-entry-sub">${degree || 'Degree, Field of Study'}${gpa}</div>
                    <div class="res-entry-date">${san(dateRange)}</div>
                </div>
            `;
        }).join('');

        output.innerHTML = html;
    }

    /**
     * renderProjectsPreview()
     */
    function renderProjectsPreview() {
        const section = document.getElementById('res-proj-section');
        const output  = document.getElementById('res-proj-output');
        if (!section || !output) return;

        if (cvbState.projects.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';

        const html = cvbState.projects.map(proj => {
            const link = proj.url
                ? ` <a href="${san(proj.url)}" style="font-size:11px;color:#0f3460;" target="_blank">[Link]</a>`
                : '';
            return `
                <div class="res-entry">
                    <div class="res-entry-title">${san(proj.name) || 'Project Name'}${link}</div>
                    <div class="res-entry-sub" style="font-size:11px;font-style:italic;">${san(proj.tech)}</div>
                    <div class="res-entry-desc">${san(proj.description)}</div>
                </div>
            `;
        }).join('');

        output.innerHTML = html;
    }

    /**
     * renderCertsPreview()
     */
    function renderCertsPreview() {
        const section = document.getElementById('res-certs-section');
        const output  = document.getElementById('res-certs-output');
        if (!section || !output) return;

        if (cvbState.certs.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';

        const html = cvbState.certs.map(c => `
            <div class="res-entry" style="margin-bottom:8px;">
                <div class="res-entry-title" style="font-size:12px;">${san(c.name)}</div>
                <div class="res-entry-sub" style="font-size:11px;">${san(c.issuer)}</div>
                <div class="res-entry-date">${san(c.date)}</div>
            </div>
        `).join('');

        output.innerHTML = html;
    }

    /**
     * renderLanguagesPreview()
     */
    function renderLanguagesPreview() {
        const section = document.getElementById('res-languages-section');
        const output  = document.getElementById('res-languages-output');
        if (!section || !output) return;

        if (cvbState.languages.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';

        const html = cvbState.languages.map(lang => `
            <div class="res-lang-item">
                <div class="res-lang-label">
                    <span>${san(lang.name)}</span>
                    <span style="font-size:11px;opacity:0.7;">${san(lang.level)}</span>
                </div>
                <div class="res-lang-bar">
                    <div class="res-lang-fill" style="width:${parseInt(lang.proficiency)||0}%"></div>
                </div>
            </div>
        `).join('');

        output.innerHTML = html;
    }

    /* ─────────────────────────────────────────────────────────────
       9. EXPERIENCE ITEMS (Add, Render, Delete, SortableJS)
       ───────────────────────────────────────────────────────────── */

    /**
     * cvbAddExperience()
     * Creates a new empty experience item in cvbState and renders it.
     */
    function cvbAddExperience() {
        const item = {
            id:          cvbUid(),
            company:     '',
            role:        '',
            start:       '',
            end:         '',
            current:     false,
            description: ''
        };
        cvbState.experience.push(item);
        cvbRenderExpItem(item);
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /**
     * cvbRenderExpItem(item)
     * Builds and appends the HTML form card for one experience entry.
     * Each field has an oninput handler that writes back to cvbState.
     */
    function cvbRenderExpItem(item) {
        const container = document.getElementById('cvb-exp-list');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'cvb-repeat-item';
        div.dataset.id = item.id;
        div.innerHTML = `
            <!-- Drag handle bar -->
            <div class="cvb-item-handle">
                <div class="cvb-drag-icon">
                    <i class="fa-solid fa-grip-vertical"></i>
                    <span>${item.role || 'New Experience'}</span>
                </div>
                <button class="cvb-delete-item-btn" onclick="cvbDeleteExp('${item.id}')" title="Remove this entry">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Fields -->
            <div class="cvb-item-fields">
                <div class="cvb-field-row">
                    <div class="cvb-field-group">
                        <label class="cvb-label">Job Title / Role *</label>
                        <input class="cvb-input" value="${san(item.role)}" placeholder="Senior Developer"
                            oninput="cvbExpField('${item.id}','role',this.value)">
                    </div>
                    <div class="cvb-field-group">
                        <label class="cvb-label">Company *</label>
                        <input class="cvb-input" value="${san(item.company)}" placeholder="Acme Corp"
                            oninput="cvbExpField('${item.id}','company',this.value)">
                    </div>
                </div>
                <div class="cvb-field-row">
                    <div class="cvb-field-group">
                        <label class="cvb-label">Start Date</label>
                        <input class="cvb-input" value="${san(item.start)}" placeholder="Jan 2020"
                            oninput="cvbExpField('${item.id}','start',this.value)">
                    </div>
                    <div class="cvb-field-group">
                        <label class="cvb-label">End Date</label>
                        <input class="cvb-input" value="${san(item.end)}" placeholder="Dec 2023"
                            id="exp-end-${item.id}"
                            ${item.current ? 'disabled' : ''}
                            oninput="cvbExpField('${item.id}','end',this.value)">
                    </div>
                </div>
                <!-- "Currently working here" checkbox -->
                <div class="cvb-field-group" style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="exp-current-${item.id}" ${item.current ? 'checked' : ''}
                        style="width:14px;height:14px;accent-color:var(--accent-cyan)"
                        onchange="cvbExpCurrent('${item.id}',this.checked)">
                    <label for="exp-current-${item.id}" class="cvb-label" style="margin:0;cursor:pointer;">
                        Currently working here
                    </label>
                </div>
                <div class="cvb-field-group">
                    <label class="cvb-label">Responsibilities / Achievements (one per line, start with -)</label>
                    <textarea class="cvb-textarea" placeholder="- Developed a microservices architecture that reduced latency by 40%&#10;- Led a team of 5 engineers to deliver the product 2 weeks ahead of schedule"
                        oninput="cvbExpField('${item.id}','description',this.value)">${san(item.description)}</textarea>
                </div>
            </div>
        `;
        container.appendChild(div);
    }

    /**
     * cvbExpField(id, field, value)
     * Updates a specific field on a specific experience item in cvbState.
     * Also updates the drag handle label to show the current role.
     */
    function cvbExpField(id, field, value) {
        const item = cvbState.experience.find(e => e.id === id);
        if (!item) return;
        item[field] = value;

        // Update drag handle label to current role name
        if (field === 'role') {
            const handle = document.querySelector(`[data-id="${id}"] .cvb-drag-icon span`);
            if (handle) handle.textContent = value || 'Experience';
        }

        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /**
     * cvbExpCurrent(id, checked)
     * Handles the "currently working here" checkbox.
     */
    function cvbExpCurrent(id, checked) {
        const item = cvbState.experience.find(e => e.id === id);
        if (!item) return;
        item.current = checked;

        // Disable the end date field when "current" is checked
        const endInput = document.getElementById('exp-end-' + id);
        if (endInput) endInput.disabled = checked;

        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /**
     * cvbDeleteExp(id)
     * Removes an experience item from cvbState and the DOM.
     */
    function cvbDeleteExp(id) {
        cvbState.experience = cvbState.experience.filter(e => e.id !== id);
        const el = document.querySelector(`#cvb-exp-list [data-id="${id}"]`);
        if (el) el.remove();
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /* ─────────────────────────────────────────────────────────────
       10. EDUCATION ITEMS
       ───────────────────────────────────────────────────────────── */

    function cvbAddEducation() {
        const item = { id: cvbUid(), school: '', degree: '', field: '', start: '', end: '', gpa: '' };
        cvbState.education.push(item);
        cvbRenderEduItem(item);
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbRenderEduItem(item) {
        const container = document.getElementById('cvb-edu-list');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'cvb-repeat-item';
        div.dataset.id = item.id;
        div.innerHTML = `
            <div class="cvb-item-handle">
                <div class="cvb-drag-icon">
                    <i class="fa-solid fa-grip-vertical"></i>
                    <span>${item.school || 'New Education'}</span>
                </div>
                <button class="cvb-delete-item-btn" onclick="cvbDeleteEdu('${item.id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="cvb-item-fields">
                <div class="cvb-field-group">
                    <label class="cvb-label">School / University *</label>
                    <input class="cvb-input" value="${san(item.school)}" placeholder="MIT"
                        oninput="cvbEduField('${item.id}','school',this.value)">
                </div>
                <div class="cvb-field-row">
                    <div class="cvb-field-group">
                        <label class="cvb-label">Degree</label>
                        <input class="cvb-input" value="${san(item.degree)}" placeholder="B.Sc."
                            oninput="cvbEduField('${item.id}','degree',this.value)">
                    </div>
                    <div class="cvb-field-group">
                        <label class="cvb-label">Field of Study</label>
                        <input class="cvb-input" value="${san(item.field)}" placeholder="Computer Science"
                            oninput="cvbEduField('${item.id}','field',this.value)">
                    </div>
                </div>
                <div class="cvb-field-row">
                    <div class="cvb-field-group">
                        <label class="cvb-label">Start Year</label>
                        <input class="cvb-input" value="${san(item.start)}" placeholder="2018"
                            oninput="cvbEduField('${item.id}','start',this.value)">
                    </div>
                    <div class="cvb-field-group">
                        <label class="cvb-label">End Year</label>
                        <input class="cvb-input" value="${san(item.end)}" placeholder="2022"
                            oninput="cvbEduField('${item.id}','end',this.value)">
                    </div>
                </div>
                <div class="cvb-field-group">
                    <label class="cvb-label">GPA (optional)</label>
                    <input class="cvb-input" value="${san(item.gpa)}" placeholder="3.8 / 4.0"
                        oninput="cvbEduField('${item.id}','gpa',this.value)">
                </div>
            </div>
        `;
        container.appendChild(div);
    }

    function cvbEduField(id, field, value) {
        const item = cvbState.education.find(e => e.id === id);
        if (!item) return;
        item[field] = value;
        if (field === 'school') {
            const handle = document.querySelector(`#cvb-edu-list [data-id="${id}"] .cvb-drag-icon span`);
            if (handle) handle.textContent = value || 'Education';
        }
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbDeleteEdu(id) {
        cvbState.education = cvbState.education.filter(e => e.id !== id);
        const el = document.querySelector(`#cvb-edu-list [data-id="${id}"]`);
        if (el) el.remove();
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /* ─────────────────────────────────────────────────────────────
       11. PROJECT ITEMS
       ───────────────────────────────────────────────────────────── */

    function cvbAddProject() {
        const item = { id: cvbUid(), name: '', tech: '', url: '', description: '' };
        cvbState.projects.push(item);
        cvbRenderProjItem(item);
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbRenderProjItem(item) {
        const container = document.getElementById('cvb-proj-list');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'cvb-repeat-item';
        div.dataset.id = item.id;
        div.innerHTML = `
            <div class="cvb-item-handle">
                <div class="cvb-drag-icon">
                    <i class="fa-solid fa-grip-vertical"></i>
                    <span>${item.name || 'New Project'}</span>
                </div>
                <button class="cvb-delete-item-btn" onclick="cvbDeleteProj('${item.id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="cvb-item-fields">
                <div class="cvb-field-group">
                    <label class="cvb-label">Project Name *</label>
                    <input class="cvb-input" value="${san(item.name)}" placeholder="E-Commerce Platform"
                        oninput="cvbProjField('${item.id}','name',this.value)">
                </div>
                <div class="cvb-field-row">
                    <div class="cvb-field-group">
                        <label class="cvb-label">Technologies Used</label>
                        <input class="cvb-input" value="${san(item.tech)}" placeholder="React, Node.js, MongoDB"
                            oninput="cvbProjField('${item.id}','tech',this.value)">
                    </div>
                    <div class="cvb-field-group">
                        <label class="cvb-label">Project URL (optional)</label>
                        <input class="cvb-input" value="${san(item.url)}" placeholder="https://github.com/..."
                            oninput="cvbProjField('${item.id}','url',this.value)">
                    </div>
                </div>
                <div class="cvb-field-group">
                    <label class="cvb-label">Description / Impact</label>
                    <textarea class="cvb-textarea" placeholder="Built a full-stack marketplace with payment integration..."
                        oninput="cvbProjField('${item.id}','description',this.value)">${san(item.description)}</textarea>
                </div>
            </div>
        `;
        container.appendChild(div);
    }

    function cvbProjField(id, field, value) {
        const item = cvbState.projects.find(p => p.id === id);
        if (!item) return;
        item[field] = value;
        if (field === 'name') {
            const handle = document.querySelector(`#cvb-proj-list [data-id="${id}"] .cvb-drag-icon span`);
            if (handle) handle.textContent = value || 'Project';
        }
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbDeleteProj(id) {
        cvbState.projects = cvbState.projects.filter(p => p.id !== id);
        const el = document.querySelector(`#cvb-proj-list [data-id="${id}"]`);
        if (el) el.remove();
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /* ─────────────────────────────────────────────────────────────
       12. CERTIFICATION ITEMS
       ───────────────────────────────────────────────────────────── */

    function cvbAddCert() {
        const item = { id: cvbUid(), name: '', issuer: '', date: '', url: '' };
        cvbState.certs.push(item);
        cvbRenderCertItem(item);
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbRenderCertItem(item) {
        const container = document.getElementById('cvb-cert-list');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'cvb-repeat-item';
        div.dataset.id = item.id;
        div.innerHTML = `
            <div class="cvb-item-handle">
                <div class="cvb-drag-icon">
                    <i class="fa-solid fa-grip-vertical"></i>
                    <span>${item.name || 'New Certification'}</span>
                </div>
                <button class="cvb-delete-item-btn" onclick="cvbDeleteCert('${item.id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="cvb-item-fields">
                <div class="cvb-field-group">
                    <label class="cvb-label">Certification Name *</label>
                    <input class="cvb-input" value="${san(item.name)}" placeholder="AWS Solutions Architect"
                        oninput="cvbCertField('${item.id}','name',this.value)">
                </div>
                <div class="cvb-field-row">
                    <div class="cvb-field-group">
                        <label class="cvb-label">Issuing Organization</label>
                        <input class="cvb-input" value="${san(item.issuer)}" placeholder="Amazon Web Services"
                            oninput="cvbCertField('${item.id}','issuer',this.value)">
                    </div>
                    <div class="cvb-field-group">
                        <label class="cvb-label">Date Issued</label>
                        <input class="cvb-input" value="${san(item.date)}" placeholder="March 2023"
                            oninput="cvbCertField('${item.id}','date',this.value)">
                    </div>
                </div>
                <div class="cvb-field-group">
                    <label class="cvb-label">Credential URL (optional)</label>
                    <input class="cvb-input" value="${san(item.url)}" placeholder="https://..."
                        oninput="cvbCertField('${item.id}','url',this.value)">
                </div>
            </div>
        `;
        container.appendChild(div);
    }

    function cvbCertField(id, field, value) {
        const item = cvbState.certs.find(c => c.id === id);
        if (!item) return;
        item[field] = value;
        if (field === 'name') {
            const handle = document.querySelector(`#cvb-cert-list [data-id="${id}"] .cvb-drag-icon span`);
            if (handle) handle.textContent = value || 'Certification';
        }
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbDeleteCert(id) {
        cvbState.certs = cvbState.certs.filter(c => c.id !== id);
        const el = document.querySelector(`#cvb-cert-list [data-id="${id}"]`);
        if (el) el.remove();
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /* ─────────────────────────────────────────────────────────────
       13. LANGUAGE ITEMS
       ───────────────────────────────────────────────────────────── */

    function cvbAddLanguage() {
        const item = { id: cvbUid(), name: '', level: 'Intermediate', proficiency: 60 };
        cvbState.languages.push(item);
        cvbRenderLangItem(item);
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbRenderLangItem(item) {
        const container = document.getElementById('cvb-lang-list');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'cvb-repeat-item';
        div.dataset.id = item.id;
        div.innerHTML = `
            <div class="cvb-item-handle">
                <div class="cvb-drag-icon">
                    <i class="fa-solid fa-grip-vertical"></i>
                    <span>${item.name || 'New Language'}</span>
                </div>
                <button class="cvb-delete-item-btn" onclick="cvbDeleteLang('${item.id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="cvb-item-fields">
                <div class="cvb-field-row">
                    <div class="cvb-field-group">
                        <label class="cvb-label">Language *</label>
                        <input class="cvb-input" value="${san(item.name)}" placeholder="English"
                            oninput="cvbLangField('${item.id}','name',this.value)">
                    </div>
                    <div class="cvb-field-group">
                        <label class="cvb-label">Level</label>
                        <select class="cvb-input" onchange="cvbLangLevel('${item.id}',this.value)">
                            ${['Native','Fluent','Advanced','Intermediate','Basic'].map(l =>
                                `<option value="${l}" ${item.level===l?'selected':''}>${l}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="cvb-field-group">
                    <label class="cvb-label">Proficiency Bar: <span id="lang-pct-${item.id}">${item.proficiency}%</span></label>
                    <input type="range" min="0" max="100" value="${item.proficiency}"
                        style="width:100%;accent-color:var(--accent-cyan)"
                        oninput="cvbLangProf('${item.id}',this.value)">
                </div>
            </div>
        `;
        container.appendChild(div);
    }

    function cvbLangField(id, field, value) {
        const item = cvbState.languages.find(l => l.id === id);
        if (!item) return;
        item[field] = value;
        if (field === 'name') {
            const handle = document.querySelector(`#cvb-lang-list [data-id="${id}"] .cvb-drag-icon span`);
            if (handle) handle.textContent = value || 'Language';
        }
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbLangLevel(id, value) {
        const item = cvbState.languages.find(l => l.id === id);
        if (item) { item.level = value; cvbUpdatePreview(); cvbScheduleSave(); }
    }

    function cvbLangProf(id, value) {
        const item = cvbState.languages.find(l => l.id === id);
        if (!item) return;
        item.proficiency = parseInt(value);
        const pctEl = document.getElementById('lang-pct-' + id);
        if (pctEl) pctEl.textContent = value + '%';
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    function cvbDeleteLang(id) {
        cvbState.languages = cvbState.languages.filter(l => l.id !== id);
        const el = document.querySelector(`#cvb-lang-list [data-id="${id}"]`);
        if (el) el.remove();
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /* ─────────────────────────────────────────────────────────────
       14. SKILLS TAG INPUT
       Handles keyboard input, adding tags on Enter or comma,
       and removing tags on click of the × button.
       ───────────────────────────────────────────────────────────── */

    /**
     * cvbRenderSkillTag(skill)
     * Adds a visual tag to the skills container and inserts the
     * tag before the hidden text input.
     */
    function cvbRenderSkillTag(skill) {
        const input = document.getElementById('cvb-skill-input');
        const container = document.getElementById('cvb-skills-tags-container');
        if (!input || !container) return;

        const tag = document.createElement('div');
        tag.className = 'cvb-tag';
        tag.innerHTML = `
            <span>${san(skill)}</span>
            <i class="fa-solid fa-times cvb-tag-remove" onclick="cvbRemoveSkill(this,'${skill.replace(/'/g,"\\'")}')"></i>
        `;
        container.insertBefore(tag, input);
    }

    /**
     * cvbRemoveSkill(iconEl, skill)
     * Removes a skill from state and removes its DOM tag.
     */
    function cvbRemoveSkill(iconEl, skill) {
        cvbState.skills = cvbState.skills.filter(s => s !== skill);
        iconEl.closest('.cvb-tag').remove();
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    /**
     * cvbAddSkillFromInput()
     * Reads the skill input, adds to state, renders tag, clears input.
     */
    function cvbAddSkillFromInput() {
        const input = document.getElementById('cvb-skill-input');
        if (!input) return;

        // Split by comma in case user typed multiple at once
        const raw = input.value.split(',').map(s => s.trim()).filter(Boolean);
        raw.forEach(skill => {
            // Avoid duplicates (case-insensitive)
            const exists = cvbState.skills.some(s => s.toLowerCase() === skill.toLowerCase());
            if (!exists && skill.length > 0 && skill.length < 50) {
                cvbState.skills.push(skill);
                cvbRenderSkillTag(skill);
            }
        });

        input.value = '';
        cvbUpdatePreview();
        cvbScheduleSave();
    }

    // Attach keydown listener to skill input after DOM loads
    // (Done in the init function below)

    /* ─────────────────────────────────────────────────────────────
       15. SUMMARY CHARACTER COUNTER
       ───────────────────────────────────────────────────────────── */
    function cvbUpdateSummaryCount() {
        const textarea = document.getElementById('cvb-summary');
        const counter  = document.getElementById('cvb-summary-count');
        if (textarea && counter) {
            counter.textContent = textarea.value.length;
        }
    }

    /* ─────────────────────────────────────────────────────────────
       16. PDF EXPORT (html2pdf.js)
       Renders the #cvb-resume-doc element as a PDF.
       Configured for A4 size at 2x quality.
       ───────────────────────────────────────────────────────────── */
    function cvbExportPDF() {
        if (typeof html2pdf === 'undefined') {
            alert('PDF library not loaded. Please ensure html2pdf.bundle.min.js is available.');
            return;
        }

        const element = document.getElementById('cvb-resume-doc');
        const name = cvbState.personal.name || 'Resume';

        // Show a toast/message while generating
        cvbShowToast('Generating PDF, please wait…', 'info');

        const opt = {
            margin:       [10, 10, 10, 10],   // mm margins (top, right, bottom, left)
            filename:     `${name}_Resume.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  {
                scale: 2,           // 2x = "4K" quality rendering
                useCORS: true,
                letterRendering: true
            },
            jsPDF:        {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            cvbShowToast('PDF exported successfully!', 'success');
        }).catch(err => {
            console.error('PDF export error:', err);
            if (window.toast) window.toast('PDF export failed. Try the Print option.', 'error');
        });
    }

    /* ─────────────────────────────────────────────────────────────
       17. PRINT (Browser native)
       Opens the browser's print dialog for the resume doc.
       For best results, user should set margins to "none" in print settings.
       ───────────────────────────────────────────────────────────── */
    function cvbPrintResume() {
        window.print();
    }

    /* ─────────────────────────────────────────────────────────────
       18. JSON EXPORT
       Serializes cvbState to a downloadable .json file.
       ───────────────────────────────────────────────────────────── */
    function cvbExportJSON() {
        const json = JSON.stringify(cvbState, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const name = cvbState.personal.name || 'resume';

        a.href     = url;
        a.download = `${name.replace(/\s+/g,'_')}_cv_data.json`;
        a.click();

        // Release the object URL to free memory
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        cvbShowToast('Resume data saved as JSON!', 'success');
    }

    /* ─────────────────────────────────────────────────────────────
       19. JSON IMPORT
       Reads a .json file, parses it, and restores the form.
       ───────────────────────────────────────────────────────────── */
    function cvbImportJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            alert('Please select a valid .json file exported from this tool.');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);

                // Validate that this looks like a CVB export
                if (!imported.personal && !imported.experience) {
                    throw new Error('Invalid format: missing required fields.');
                }

                // Save imported data to localStorage
                localStorage.setItem(CVB_STORAGE_KEY, JSON.stringify(imported));

                // Reload the page to re-render everything cleanly
                window.location.reload();

            } catch (err) {
                alert('Error reading JSON file: ' + err.message);
            }
        };
        reader.readAsText(file);

        // Reset file input so the same file can be re-imported
        event.target.value = '';
    }

    /* ─────────────────────────────────────────────────────────────
       20. CLEAR ALL DATA
       Wipes localStorage and resets cvbState to defaults.
       ───────────────────────────────────────────────────────────── */
    function cvbClearAll() {
        if (!confirm('Clear all resume data? This cannot be undone.')) return;
        localStorage.removeItem(CVB_STORAGE_KEY);
        window.location.reload();
    }

    /* ─────────────────────────────────────────────────────────────
       21. QR CODE GENERATOR (vCard format)
       Builds a vCard 3.0 string from personal info fields,
       then uses qrcode.js to render a QR code in the modal.
       ───────────────────────────────────────────────────────────── */
    let cvbQRInstance = null; // Track QRCode instance for re-generation

    function cvbShowQR() {
        const p = cvbState.personal;
        if (!p.name && !p.email) {
            alert('Please enter at least your name and email first.');
            return;
        }

        // Build a vCard 3.0 string (standard format for contact QR codes)
        const vcard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${p.name}`,
            `TITLE:${p.jobTitle}`,
            `EMAIL:${p.email}`,
            `TEL:${p.phone}`,
            `ADR:;;${p.location};;;;`,
            p.website ? `URL:${p.website}` : '',
            p.linkedin ? `X-SOCIALPROFILE;type=linkedin:${p.linkedin}` : '',
            'END:VCARD'
        ].filter(Boolean).join('\n');

        // Clear previous QR and re-generate
        const previewEl = document.getElementById('cvb-qr-preview');
        previewEl.innerHTML = '';

        if (typeof QRCode !== 'undefined') {
            cvbQRInstance = new QRCode(previewEl, {
                text:          vcard,
                width:         220,
                height:        220,
                colorDark:     '#1a1a2e',
                colorLight:    '#ffffff',
                correctLevel:  QRCode.CorrectLevel.H // Highest error correction
            });
        } else {
            previewEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">QR library not loaded.</p>';
        }

        // Update label
        const label = document.getElementById('cvb-qr-name-label');
        if (label) label.textContent = p.name + (p.jobTitle ? ' · ' + p.jobTitle : '');

        // Show modal
        document.getElementById('cvb-qr-modal').classList.add('active');
    }

    function cvbCloseQR(event) {
        // Close only if clicking backdrop or close button (not the modal box itself)
        const modal = document.getElementById('cvb-qr-modal');
        if (!event || event.target === modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * cvbDownloadQR()
     * Downloads the generated QR code as a PNG image.
     */
    function cvbDownloadQR() {
        const canvas = document.querySelector('#cvb-qr-preview canvas');
        if (!canvas) {
            // QRCode.js might render an img on some browsers
            const img = document.querySelector('#cvb-qr-preview img');
            if (img) {
                const a = document.createElement('a');
                a.href = img.src;
                a.download = 'vcard-qr.png';
                a.click();
            }
            return;
        }

        const a = document.createElement('a');
        a.download = `${cvbState.personal.name || 'vcard'}_qr.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    }

    /* ─────────────────────────────────────────────────────────────
       22. ATS KEYWORD MATCHER
       Pure JS implementation. No server required.

       ALGORITHM:
       1. Tokenize the Job Description into "meaningful" words
          (filter out stop words like "the", "and", "or", etc.)
       2. Tokenize the current resume text the same way
       3. For each JD keyword, check if it appears in the resume text
       4. Score = (found keywords / total JD keywords) × 100
       5. Display found (green) and missing (red) keyword tags
       ───────────────────────────────────────────────────────────── */

    // Common English stop words to filter out from keyword analysis
    const CVB_STOP_WORDS = new Set([
        'a','an','the','and','or','but','in','on','at','to','for',
        'of','with','by','from','is','are','was','were','be','been',
        'being','have','has','had','do','does','did','will','would',
        'could','should','may','might','must','shall','can','need',
        'this','that','these','those','it','its','we','our','you',
        'your','they','their','he','she','his','her','as','if',
        'then','than','when','where','which','who','what','how',
        'about','into','through','during','before','after','above',
        'below','up','down','out','off','over','under','again',
        'further','here','there','both','each','few','more','most',
        'other','some','such','no','not','only','same','so','very',
        'just','because','while','although','however','therefore',
        'including','across','within','between','provide','work',
        'working','experience','years','year','strong','good',
        'ability','skills','knowledge','understanding','excellent',
        'required','preferred','minimum','plus','ability','per',
        'etc','e.g','i.e','ie','eg','vs','well','also','new'
    ]);

    /**
     * cvbTokenize(text)
     * Converts a text string into an array of unique, lowercase keywords,
     * filtering out stop words and very short words.
     * @param {string} text
     * @returns {string[]} Array of unique keyword strings
     */
    function cvbTokenize(text) {
        return [...new Set(
            text.toLowerCase()
                // Replace non-alphanumeric characters (except hyphen) with spaces
                .replace(/[^a-z0-9\-\s]/g, ' ')
                .split(/\s+/)
                .map(w => w.replace(/^-+|-+$/g, '')) // Strip leading/trailing hyphens
                .filter(w =>
                    w.length > 2 &&                   // Skip very short words
                    !CVB_STOP_WORDS.has(w) &&          // Skip stop words
                    isNaN(w)                           // Skip pure numbers
                )
        )];
    }

    /**
     * cvbGetResumeText()
     * Extracts all user-visible text from cvbState into a single string.
     * This is what the ATS matcher compares against.
     */
    function cvbGetResumeText() {
        const parts = [
            cvbState.personal.name,
            cvbState.personal.jobTitle,
            cvbState.summary,
            ...cvbState.skills,
            ...cvbState.experience.flatMap(e => [e.role, e.company, e.description]),
            ...cvbState.education.flatMap(e => [e.school, e.degree, e.field]),
            ...cvbState.projects.flatMap(p => [p.name, p.tech, p.description]),
            ...cvbState.certs.flatMap(c => [c.name, c.issuer]),
            ...cvbState.languages.map(l => l.name)
        ];
        return parts.filter(Boolean).join(' ');
    }

    /**
     * cvbRunATSMatcher()
     * Main ATS analysis function. Called on every JD input event.
     * Uses debouncing to avoid lag on heavy typing.
     */
    let cvbATSTimer = null;
    function cvbRunATSMatcher() {
        clearTimeout(cvbATSTimer);
        cvbATSTimer = setTimeout(() => {
            cvbExecuteATSMatcher();
        }, 400); // 400ms debounce
    }

    function cvbExecuteATSMatcher() {
        const jdInput = document.getElementById('cvb-jd-input');
        const jdText  = jdInput ? jdInput.value.trim() : '';

        const resultsGrid = document.getElementById('cvb-ats-results-grid');
        const emptyState  = document.getElementById('cvb-ats-empty');

        // If JD is too short, show empty state
        if (jdText.length < 30) {
            if (resultsGrid) resultsGrid.style.display = 'none';
            if (emptyState)  emptyState.style.display  = '';
            return;
        }

        // Show results, hide empty state
        if (resultsGrid) resultsGrid.style.display = '';
        if (emptyState)  emptyState.style.display  = 'none';

        // Tokenize both texts
        const jdKeywords     = cvbTokenize(jdText);
        const resumeText     = cvbGetResumeText();
        const resumeKeywords = cvbTokenize(resumeText);
        const resumeSet      = new Set(resumeKeywords);

        // Classify JD keywords as found or missing
        const found   = jdKeywords.filter(kw => resumeSet.has(kw));
        const missing = jdKeywords.filter(kw => !resumeSet.has(kw));

        // Calculate score (0–100)
        const score = jdKeywords.length > 0
            ? Math.round((found.length / jdKeywords.length) * 100)
            : 0;

        // Update score ring SVG animation
        // The ring circumference = 2π × r = 2 × 3.14159 × 50 ≈ 314
        const circumference = 314;
        const offset = circumference - (circumference * score / 100);
        const ringFill = document.getElementById('cvb-ring-fill');
        if (ringFill) ringFill.style.strokeDashoffset = offset;

        // Update score number display
        setText('cvb-score-number', score + '%');

        // Score interpretation badge
        let badgeHTML = '';
        let summaryText = '';
        if (score >= 80) {
            badgeHTML = `<span style="color:var(--accent-green)"><i class="fa-solid fa-trophy"></i> Excellent Match</span>`;
            summaryText = `Your resume matches ${found.length} of ${jdKeywords.length} JD keywords. Very likely to pass ATS.`;
        } else if (score >= 60) {
            badgeHTML = `<span style="color:var(--accent-orange)"><i class="fa-solid fa-circle-half-stroke"></i> Good Match</span>`;
            summaryText = `Matches ${found.length} of ${jdKeywords.length} keywords. Add the missing ones to improve.`;
        } else if (score >= 40) {
            badgeHTML = `<span style="color:var(--accent-yellow)"><i class="fa-solid fa-exclamation-circle"></i> Partial Match</span>`;
            summaryText = `Only ${found.length} of ${jdKeywords.length} keywords found. Significant improvements recommended.`;
        } else {
            badgeHTML = `<span style="color:var(--accent-red)"><i class="fa-solid fa-circle-xmark"></i> Low Match</span>`;
            summaryText = `${found.length} of ${jdKeywords.length} keywords found. Tailor your resume to this job.`;
        }

        setHTML('cvb-score-badge',  badgeHTML);
        setText('cvb-ats-summary',  summaryText);
        setText('cvb-kw-found-count',   found.length);
        setText('cvb-kw-missing-count', missing.length);

        // Render keyword tag lists
        const foundHTML = found.slice(0, 40).map(kw =>
            `<span class="cvb-kw-tag found">${san(kw)}</span>`
        ).join('');
        const missingHTML = missing.slice(0, 40).map(kw =>
            `<span class="cvb-kw-tag missing">${san(kw)}</span>`
        ).join('');

        setHTML('cvb-kw-found',   foundHTML   || '<span style="font-size:12px;color:var(--text-muted)">No matching keywords yet</span>');
        setHTML('cvb-kw-missing', missingHTML || '<span style="font-size:12px;color:var(--text-muted);"></span>');
    }

    /* ─────────────────────────────────────────────────────────────
       23. SORTABLEJS INITIALIZATION
       Initializes drag-and-drop on each list container.
       onEnd callback updates cvbState array order to match new DOM order.
       ───────────────────────────────────────────────────────────── */
    function cvbInitSortable() {
        // Check that SortableJS is loaded
        if (typeof Sortable === 'undefined') {
            console.warn('CVB: SortableJS not loaded. Drag-and-drop disabled.');
            return;
        }

        /**
         * Helper: after a drag ends, reorder the state array to match
         * the new DOM order of items.
         * @param {HTMLElement} listEl   - The container element
         * @param {Array}       stateArr - The cvbState sub-array (e.g. cvbState.experience)
         */
        function syncStateOrder(listEl, stateArr) {
            // Get ordered IDs from the current DOM
            const orderedIds = [...listEl.querySelectorAll('.cvb-repeat-item')]
                .map(el => el.dataset.id);

            // Re-order stateArr in place to match DOM order
            orderedIds.forEach((id, index) => {
                const currentIndex = stateArr.findIndex(item => item.id === id);
                if (currentIndex !== -1 && currentIndex !== index) {
                    // Move item from currentIndex to index
                    const [item] = stateArr.splice(currentIndex, 1);
                    stateArr.splice(index, 0, item);
                }
            });
        }

        // Experience list
        const expList = document.getElementById('cvb-exp-list');
        if (expList) {
            new Sortable(expList, {
                animation:  150,           // Smooth 150ms animation
                handle:     '.cvb-item-handle', // Only drag by the handle bar
                ghostClass: 'sortable-ghost',
                chosenClass:'sortable-chosen',
                onEnd: () => {
                    syncStateOrder(expList, cvbState.experience);
                    cvbUpdatePreview();
                    cvbScheduleSave();
                }
            });
        }

        // Education list
        const eduList = document.getElementById('cvb-edu-list');
        if (eduList) {
            new Sortable(eduList, {
                animation:  150,
                handle:     '.cvb-item-handle',
                ghostClass: 'sortable-ghost',
                chosenClass:'sortable-chosen',
                onEnd: () => {
                    syncStateOrder(eduList, cvbState.education);
                    cvbUpdatePreview();
                    cvbScheduleSave();
                }
            });
        }

        // Projects list
        const projList = document.getElementById('cvb-proj-list');
        if (projList) {
            new Sortable(projList, {
                animation:  150,
                handle:     '.cvb-item-handle',
                ghostClass: 'sortable-ghost',
                chosenClass:'sortable-chosen',
                onEnd: () => {
                    syncStateOrder(projList, cvbState.projects);
                    cvbUpdatePreview();
                    cvbScheduleSave();
                }
            });
        }

        // Certifications list
        const certList = document.getElementById('cvb-cert-list');
        if (certList) {
            new Sortable(certList, {
                animation:  150,
                handle:     '.cvb-item-handle',
                ghostClass: 'sortable-ghost',
                chosenClass:'sortable-chosen',
                onEnd: () => {
                    syncStateOrder(certList, cvbState.certs);
                    cvbUpdatePreview();
                    cvbScheduleSave();
                }
            });
        }

        // Languages list
        const langList = document.getElementById('cvb-lang-list');
        if (langList) {
            new Sortable(langList, {
                animation:  150,
                handle:     '.cvb-item-handle',
                ghostClass: 'sortable-ghost',
                chosenClass:'sortable-chosen',
                onEnd: () => {
                    syncStateOrder(langList, cvbState.languages);
                    cvbUpdatePreview();
                    cvbScheduleSave();
                }
            });
        }
    }

    /* ─────────────────────────────────────────────────────────────
       24. EVENT DELEGATION — MAIN INPUT LISTENER
       A single event listener on the form scroll container
       handles all field inputs and updates both state + preview.
       This is more efficient than attaching individual listeners.
       ───────────────────────────────────────────────────────────── */
    function cvbBindFormEvents() {
        const formScroll = document.getElementById('cvb-form-scroll');
        if (!formScroll) return;

        // Delegate all input events within the form panel
        formScroll.addEventListener('input', function(e) {
            const el = e.target;

            // ── Personal fields ──
            const personalMap = {
                'cvb-name':     'name',
                'cvb-jobtitle': 'jobTitle',
                'cvb-email':    'email',
                'cvb-phone':    'phone',
                'cvb-location': 'location',
                'cvb-linkedin': 'linkedin',
                'cvb-website':  'website',
                'cvb-github':   'github'
            };

            if (personalMap[el.id]) {
                cvbState.personal[personalMap[el.id]] = el.value;
                cvbUpdatePreview();
                cvbScheduleSave();
                return;
            }

            // ── Summary field ──
            if (el.id === 'cvb-summary') {
                cvbState.summary = el.value;
                cvbUpdateSummaryCount();
                cvbUpdatePreview();
                cvbScheduleSave();
                return;
            }
        });
    }

    /* ─────────────────────────────────────────────────────────────
       25. SKILLS INPUT KEYBOARD HANDLER
       ───────────────────────────────────────────────────────────── */
    function cvbBindSkillsInput() {
        const input = document.getElementById('cvb-skill-input');
        if (!input) return;

        input.addEventListener('keydown', function(e) {
            // Add skill on Enter or comma key
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                if (this.value.trim()) {
                    cvbAddSkillFromInput();
                }
            }
            // Remove last tag on Backspace if input is empty
            if (e.key === 'Backspace' && this.value === '' && cvbState.skills.length > 0) {
                const lastSkill = cvbState.skills[cvbState.skills.length - 1];
                cvbRemoveSkill(
                    document.querySelector('.cvb-tags-container .cvb-tag:last-of-type .cvb-tag-remove'),
                    lastSkill
                );
            }
        });
    }

    /* ─────────────────────────────────────────────────────────────
       26. INITIALIZATION — DOMContentLoaded
       Entry point. Runs once when the DOM is ready.
       Order: bind events → load saved data → init sortable → render preview
       ───────────────────────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', function() {

        console.log('%c✅ Smart CV Builder PRO MAX v1.0 initialized', 'color:#00e5ff;font-weight:bold;font-size:14px');

        // 1. Bind form input delegation
        cvbBindFormEvents();

        // 2. Bind skills keyboard handler
        cvbBindSkillsInput();

        // 3. Load any saved data from localStorage (restores previous session)
        cvbLoad();

        // 4. Initialize SortableJS drag-and-drop on all list containers
        //    Small timeout ensures DOM is fully settled after cvbLoad()
        setTimeout(cvbInitSortable, 100);

        // 5. If no saved data, do an initial preview render with empty state
        cvbUpdatePreview();

        // 6. Set initial progress bar state
        cvbUpdateProgress();

        // 7. Set initial autosave status
        cvbSetAutosaveStatus('saved');

        // 8. Keyboard shortcut: Ctrl+S to save JSON
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                cvbExportJSON();
            }
        });

        // 9. Keyboard shortcut: Escape to close QR modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const modal = document.getElementById('cvb-qr-modal');
                if (modal && modal.classList.contains('active')) {
                    modal.classList.remove('active');
                }
            }
        });

    }); // end DOMContentLoaded
    
    
    /* ─────────────────────────────────────────────────────────────
   UNIVERSAL TOAST NOTIFICATION HANDLER
   Integrates directly with Trusted Tools Web global.js
   ───────────────────────────────────────────────────────────── */
function cvbShowToast(msg, type = 'success') {
    // Convert 'error' string to boolean for window.showToast()
    const isError = (type === 'error');

    // Call the global toast function from global.js
    if (typeof window.showToast === 'function') {
        window.showToast(msg, isError);
        return;
    }

    // Fallback if global.js is somehow not loaded
    console.log(`[TOAST FALLBACK] ${type.toUpperCase()}: ${msg}`);
    const fallbackBox = document.getElementById('toast-box');
    if (fallbackBox) {
        fallbackBox.innerHTML = `<div style="background:${isError ? '#ff7675' : '#00b894'};color:#fff;padding:10px;border-radius:5px;margin-bottom:10px;">${msg}</div>`;
        setTimeout(() => fallbackBox.innerHTML = '', 3000);
    }
}


    /* ─────────────────────────────────────────────────────────────
       END OF SMART CV BUILDER PRO MAX JAVASCRIPT ENGINE
       ─────────────────────────────────────────────────────────────
       VERSION: 1.0
       AUTHOR:  MD KAWSAR
       LICENSE: CodeCanyon Regular / Extended
       ───────────────────────────────────────────────────────────── */

    