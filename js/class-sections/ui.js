/** class-sections — ui responsibilities. **/
"use strict";

function clearFilters() {
        document.getElementById("searchSection").value = "";
        document.getElementById("filterProgram").value = "";
        document.getElementById("filterYear").value = "";
        renderAll();
    }

function duplicateSection(id) {
        const item = sections.find(row => String(getSectionId(row)) === String(id));
        if (!item) return;

        resetForm();

        document.getElementById("sectionModalTitle").innerHTML = `
            <i class="fas fa-copy text-warning me-2"></i>Duplicate Class Section
        `;

        // Name left blank (and focused) since the whole point of
        // duplicating is a new section for the same program/year - the
        // one field that must change. Program/year/students carry over
        // as a time-saving starting point.
        document.getElementById("sectionId").value = "";
        document.getElementById("program").value = item.program || "";
        document.getElementById("yearLevel").value = item.year_level || "";
        document.getElementById("students").value = item.students || 40;

        sectionModal.show();
        setTimeout(() => document.getElementById("sectionName")?.focus(), 150);
    }

function editSection(id) {
        const item = sections.find(row => String(getSectionId(row)) === String(id));
        if (!item) return;

        document.getElementById("sectionModalTitle").innerHTML = `
            <i class="fas fa-pen text-warning me-2"></i>Edit Class Section
        `;

        document.getElementById("sectionId").value = getSectionId(item);
        document.getElementById("sectionName").value = getSectionName(item);
        document.getElementById("program").value = item.program || "";
        document.getElementById("yearLevel").value = item.year_level || "";
        document.getElementById("students").value = item.students || 40;

        sectionModal.show();
    }

function getFilteredSections() {
        const search = document.getElementById("searchSection")?.value.trim().toLowerCase() || "";
        const program = document.getElementById("filterProgram")?.value || "";
        const year = document.getElementById("filterYear")?.value || "";

        return sections.filter(item => {
            const haystack = [
                getSectionName(item),
                item.program,
                item.year_level,
                item.students
            ].join(" ").toLowerCase();

            return (!search || haystack.includes(search)) &&
                (!program || item.program === program) &&
                (!year || item.year_level === year);
        });
    }

function openCreateModal() {
        resetForm();

        document.getElementById("sectionModalTitle").innerHTML = `
            <i class="fas fa-users text-warning me-2"></i>Add Class Section
        `;

        sectionModal.show();
    }

function populateProgramFilter() {
        const filter = document.getElementById("filterProgram");
        if (!filter) return;

        const currentValue = filter.value;
        const programs = [...new Set(sections.map(item => item.program).filter(Boolean))].sort();

        filter.innerHTML = `<option value="">All programs</option>`;

        programs.forEach(program => {
            const option = document.createElement("option");
            option.value = program;
            option.textContent = program;
            filter.appendChild(option);
        });

        filter.value = programs.includes(currentValue) ? currentValue : "";
    }

async function removeSection(id) {
        const item = sections.find(row => String(getSectionId(row)) === String(id));
        if (!item) return;

        if (!confirm(`Delete ${getSectionName(item)}?`)) return;

        try {
            await deleteSectionFromServer(id);
        } catch (error) {
            // deleteSectionFromServer already showed a toast describing the failure.
            return;
        }

        sections = sections.filter(row => String(getSectionId(row)) !== String(id));

        saveLocalSections();
        broadcastSectionsChanged();
        renderAll();

        showToast("Class section deleted successfully.", "success");
    }

function renderAll() {
        const filtered = getFilteredSections();

        renderMetrics();
        renderTable(filtered);
        populateProgramFilter();
    }

function renderMetrics() {
        setText("totalSections", sections.length);

        setText(
            "totalPrograms",
            new Set(sections.map(item => item.program).filter(Boolean)).size
        );

        setText(
            "totalYearLevels",
            new Set(sections.map(item => item.year_level).filter(Boolean)).size
        );

        setText(
            "totalStudents",
            sections.reduce((total, item) => total + Number(item.students || 0), 0)
        );
    }

function renderTable(rows) {
        const tbody = document.getElementById("sectionTableBody");
        if (!tbody) return;

        setText("sectionCounter", `${rows.length} record${rows.length === 1 ? "" : "s"}`);

        if (!rows.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-section">
                        <i class="fas fa-users-rectangle fs-2 mb-2"></i>
                        <div>No class sections found.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = rows.map((item, index) => {
            const id = getSectionId(item);
            const sectionName = getSectionName(item);

            return `
                <tr>
                    <td><strong>${index + 1}</strong></td>
                    <td>
                        <div class="section-name">${escapeHtml(sectionName)}</div>
                        <div class="section-detail">${escapeHtml(item.students || 0)} student${Number(item.students || 0) === 1 ? "" : "s"}</div>
                    </td>
                    <td>
                        <span class="badge-program">${escapeHtml(item.program || "N/A")}</span>
                    </td>
                    <td>
                        <span class="badge-year">${escapeHtml(item.year_level || "N/A")}</span>
                    </td>
                    <td>${escapeHtml(item.students || 0)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-success action-btn me-1" title="View ${escapeAttr(item.program || '')} curriculum" onclick="ClassSectionsPage.viewCurriculum('${escapeAttr(item.program || '')}')">
                            <i class="fas fa-list-check"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary action-btn me-1" title="Duplicate this section" onclick="ClassSectionsPage.duplicate('${escapeAttr(id)}')">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary action-btn me-1" onclick="ClassSectionsPage.edit('${escapeAttr(id)}')">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger action-btn" onclick="ClassSectionsPage.remove('${escapeAttr(id)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

function resetForm() {
        document.getElementById("sectionForm").reset();
        document.getElementById("sectionId").value = "";
        document.getElementById("students").value = 40;
        const feedback = document.getElementById("sectionNameFeedback");
        if (feedback) {
            feedback.textContent = "\u00A0";
            feedback.className = "form-text";
        }
    }

async function saveSection(event) {
        event.preventDefault();

        const id = document.getElementById("sectionId").value || crypto.randomUUID();

        const sectionName = document.getElementById("sectionName").value.trim();

        const section = {
            id,
            section_name: sectionName,
            name: sectionName,
            program: document.getElementById("program").value,
            year_level: document.getElementById("yearLevel").value,
            students: Number(document.getElementById("students").value)
        };

        if (!section.section_name || !section.program || !section.year_level || section.students <= 0) {
            showToast("Please complete all required fields.", "danger");
            return;
        }

        const duplicate = sections.find(item =>
            String(getSectionId(item)) !== String(id) &&
            getSectionName(item).toLowerCase() === section.section_name.toLowerCase()
        );

        if (duplicate) {
            showToast("Section name already exists.", "danger");
            return;
        }

        const index = sections.findIndex(item => String(getSectionId(item)) === String(id));
        const isUpdate = index >= 0;

        try {
            await persistSection(section, isUpdate ? "PUT" : "POST");
        } catch (error) {
            // persistSection already showed a toast describing the failure.
            return;
        }

        if (isUpdate) sections[index] = section;
        else sections.push(section);

        saveLocalSections();
        broadcastSectionsChanged();
        renderAll();
        sectionModal.hide();

        showToast("Class section saved successfully.", "success");
    }

function viewCurriculum(program) {
        if (!program) {
            showToast("This section has no program set yet.", "warning");
            return;
        }
        window.location.href = `curriculum.html?program=${encodeURIComponent(program)}`;
    }

