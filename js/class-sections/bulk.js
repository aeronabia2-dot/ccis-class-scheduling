/**
 * class-sections — Bulk Generate responsibilities.
 *
 * Mirrors js/classrooms/ui.js's "Add Multiple Classrooms" bulk-create
 * flow: pick a few shared fields, get a live conflict-checked preview,
 * submit once. Sections have a simpler natural pattern than rooms
 * though - one program + one year level + a run of letter suffixes - so
 * this only needs a starting letter and a count rather than a full
 * naming-template UI.
 */
"use strict";

function resetBulkSectionForm() {
    document.getElementById("bulkSectionProgram").value = "";
    document.getElementById("bulkSectionYearLevel").value = "";
    document.getElementById("bulkSectionStartLetter").value = "A";
    document.getElementById("bulkSectionCount").value = 3;
    document.getElementById("bulkSectionStudents").value = 40;
    currentBulkSectionPreview = [];
}

function openBulkSectionModal() {
    resetBulkSectionForm();
    updateBulkSectionPreview();
    bulkSectionModal?.show();
}

/*
    Builds the run of section names for this batch: starting letter is
    bumped by one (A -> B -> C -> ...) for each row, wrapping past Z into
    AA/AB/... the same way spreadsheet columns do, so a very large batch
    never silently runs out of letters.
*/
function letterForIndex(startLetter, index) {
    const startCode = (startLetter || "A").toUpperCase().charCodeAt(0) - 65; // A=0
    let n = startCode + index;
    let out = "";
    do {
        out = String.fromCharCode(65 + (n % 26)) + out;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return out;
}

function updateBulkSectionPreview() {
    const program = document.getElementById("bulkSectionProgram").value;
    const yearLevel = document.getElementById("bulkSectionYearLevel").value;
    const startLetter = (document.getElementById("bulkSectionStartLetter").value || "A").trim() || "A";
    const count = Math.max(0, Math.min(26, parseInt(document.getElementById("bulkSectionCount").value, 10) || 0));
    const students = parseInt(document.getElementById("bulkSectionStudents").value, 10) || 0;

    const tbody = document.getElementById("bulkSectionPreviewBody");
    const summary = document.getElementById("bulkSectionPreviewSummary");
    const submitBtn = document.getElementById("btnSubmitBulkSections");

    if (!program || !yearLevel || count <= 0 || students <= 0) {
        currentBulkSectionPreview = [];
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-3">Select a program and year level to see a preview.</td></tr>`;
        if (summary) summary.textContent = "";
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    const yearDigit = yearLevelToDigit(yearLevel);
    const seenInBatch = new Set();
    let conflictCount = 0;

    const rows = Array.from({ length: count }, (_, i) => {
        const letter = letterForIndex(startLetter, i);
        const sectionName = `${program} ${yearDigit}${letter}`;
        const lowerName = sectionName.toLowerCase();

        const existsInDb = sections.some(item => getSectionName(item).toLowerCase() === lowerName);
        const dupeInBatch = seenInBatch.has(lowerName);
        seenInBatch.add(lowerName);

        const conflict = existsInDb || dupeInBatch;
        const conflictReason = existsInDb ? "Already exists" : (dupeInBatch ? "Duplicate letter" : "");
        if (conflict) conflictCount++;

        return { section_name: sectionName, program, year_level: yearLevel, students, conflict, conflictReason };
    });

    currentBulkSectionPreview = rows;

    tbody.innerHTML = rows.map(row => `
        <tr class="${row.conflict ? "table-danger" : ""}">
            <td>${escapeHtml(row.section_name)}${row.conflict ? ` <span class="badge bg-danger ms-1">${escapeHtml(row.conflictReason)}</span>` : ""}</td>
            <td>${escapeHtml(row.program)}</td>
            <td>${escapeHtml(row.year_level)}</td>
            <td>${escapeHtml(row.students)}</td>
        </tr>
    `).join("");

    if (summary) {
        summary.textContent = conflictCount
            ? `${rows.length} sections — ${conflictCount} need attention`
            : `${rows.length} sections ready to create`;
    }

    if (submitBtn) submitBtn.disabled = conflictCount > 0;
}

async function submitBulkSections() {
    if (!currentBulkSectionPreview.length) return;

    const submitBtn = document.getElementById("btnSubmitBulkSections");
    const originalHtml = submitBtn?.innerHTML;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>Creating...`;
    }

    let response, result;
    try {
        response = await fetch(`${API_URL}?action=bulk_create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ sections: currentBulkSectionPreview })
        });
        result = await response.json();
    } catch (error) {
        showToast("Could not reach the server. No sections were created.", "danger");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalHtml; }
        return;
    }

    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalHtml; }

    if (!response.ok || !result.success) {
        // A row-level conflict (e.g. someone else just created the same
        // name) re-runs the preview so it's obvious which row to fix,
        // instead of just showing a generic error.
        showToast(result.message || "Bulk creation failed.", "danger");
        if (result.rowErrors) updateBulkSectionPreview();
        return;
    }

    const created = normalizeList(result.data);
    created.forEach(section => sections.push(section));

    saveLocalSections();
    broadcastSectionsChanged();
    renderAll();
    bulkSectionModal?.hide();

    showToast(`${created.length} section${created.length === 1 ? "" : "s"} created successfully.`, "success");
}

function initBulkSectionModal() {
    const modalEl = document.getElementById("bulkSectionModal");
    if (!modalEl) return;
    bulkSectionModal = new bootstrap.Modal(modalEl);

    document.getElementById("btnOpenBulkSectionModal")?.addEventListener("click", openBulkSectionModal);
    document.getElementById("btnSubmitBulkSections")?.addEventListener("click", submitBulkSections);

    ["bulkSectionProgram", "bulkSectionYearLevel", "bulkSectionStartLetter", "bulkSectionCount", "bulkSectionStudents"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", updateBulkSectionPreview);
    });
}
