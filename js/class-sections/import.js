/**
 * class-sections — CSV Bulk Import responsibilities.
 *
 * Same drag-and-drop / preview / per-row-results pattern as
 * js/subjects/import.js's "Import Subjects from CSV" - adapted to
 * section_name/program/year_level/students columns. Every row is
 * validated and inserted independently server-side
 * (api/class_sections.php?action=import) - a bad row is reported, not a
 * reason to abort the rest of the file.
 */
"use strict";

const SECTION_IMPORT_TEMPLATE_HEADERS = ["section_name", "program", "year_level", "students"];

function initImportSectionsModal() {
    const modalEl = document.getElementById("importSectionsModal");
    if (modalEl) importSectionsModal = new bootstrap.Modal(modalEl);
    bindImportSectionsEvents();
}

function openImportSectionsModal() {
    resetImportSectionsState();
    importSectionsModal?.show();
}

function resetImportSectionsState() {
    importSectionsParsedRows = [];
    importSectionsFileName = "";
    isImportingSections = false;

    const fileInput = document.getElementById("importSectionsCsvFile");
    if (fileInput) fileInput.value = "";

    document.getElementById("importSectionsPreview")?.classList.add("d-none");
    document.getElementById("importSectionsResults")?.classList.add("d-none");

    const submitBtn = document.getElementById("btnSubmitImportSections");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.remove("d-none");
    }

    document.getElementById("btnImportSectionsDone")?.classList.add("d-none");
    document.getElementById("importSectionsDropZone")?.classList.remove("d-none");
}

/*
    Minimal RFC-4180-ish CSV parser - identical approach to
    js/subjects/import.js's parseCsvText(), duplicated here rather than
    shared since each page module is self-contained (same convention the
    rest of this codebase follows - see js/classrooms vs js/subjects).
*/
function parseSectionsCsvText(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    text = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') { inQuotes = true; continue; }
        if (char === ',') { row.push(field); field = ""; continue; }
        if (char === '\n') { row.push(field); rows.push(row); row = []; field = ""; continue; }

        field += char;
    }

    if (field !== "" || row.length) { row.push(field); rows.push(row); }

    return rows.filter(r => r.some(cell => String(cell).trim() !== ""));
}

function csvRowsToSectionObjects(csvRows) {
    if (!csvRows.length) return { objects: [], error: "The file is empty." };

    const header = csvRows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
    const required = ["section_name", "program", "year_level"];
    const missing = required.filter(col => !header.includes(col));

    if (missing.length) {
        return { objects: [], error: `Missing required column(s): ${missing.join(", ")}. Download the template below to see the expected header row.` };
    }

    const objects = csvRows.slice(1).map(cells => {
        const obj = {};
        header.forEach((col, idx) => { obj[col] = (cells[idx] ?? "").trim(); });
        if (!obj.students) obj.students = "40"; // sensible default, same as the single Add Section form's starting value
        return obj;
    });

    return { objects, error: null };
}

async function handleImportSectionsFileSelected(file) {
    if (!file) return;

    if (!/\.csv$/i.test(file.name)) {
        showToast("Please choose a .csv file.", "danger");
        return;
    }

    importSectionsFileName = file.name;
    const text = await file.text();
    const csvRows = parseSectionsCsvText(text);
    const { objects, error } = csvRowsToSectionObjects(csvRows);

    if (error) {
        showToast(error, "danger");
        return;
    }

    if (!objects.length) {
        showToast("No data rows found below the header.", "danger");
        return;
    }

    if (objects.length > 500) {
        showToast(`This file has ${objects.length} rows - imports are limited to 500 at a time. Split it and try again.`, "danger");
        return;
    }

    importSectionsParsedRows = objects;
    renderImportSectionsPreview();
}

function renderImportSectionsPreview() {
    const dropZone = document.getElementById("importSectionsDropZone");
    const preview = document.getElementById("importSectionsPreview");
    const body = document.getElementById("importSectionsPreviewBody");
    const countEl = document.getElementById("importSectionsPreviewCount");
    const submitBtn = document.getElementById("btnSubmitImportSections");

    if (!preview || !body) return;

    dropZone?.classList.add("d-none");
    preview.classList.remove("d-none");
    if (countEl) countEl.textContent = `${importSectionsParsedRows.length} row${importSectionsParsedRows.length === 1 ? "" : "s"} from ${escapeHtml(importSectionsFileName)}`;

    const maxPreviewRows = 20;
    body.innerHTML = importSectionsParsedRows.slice(0, maxPreviewRows).map((row, i) => `
        <tr>
            <td class="text-muted">${i + 1}</td>
            <td>${escapeHtml(row.section_name || "")}</td>
            <td>${escapeHtml(row.program || "")}</td>
            <td>${escapeHtml(row.year_level || "")}</td>
            <td>${escapeHtml(row.students || "40")}</td>
        </tr>
    `).join("");

    const moreNote = document.getElementById("importSectionsPreviewMoreNote");
    if (moreNote) {
        const extra = importSectionsParsedRows.length - maxPreviewRows;
        moreNote.textContent = extra > 0 ? `+ ${extra} more row${extra === 1 ? "" : "s"} not shown` : "";
    }

    if (submitBtn) submitBtn.disabled = false;
}

async function submitImportSections() {
    if (isImportingSections || !importSectionsParsedRows.length) return;

    const submitBtn = document.getElementById("btnSubmitImportSections");
    isImportingSections = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalHtml = submitBtn.dataset.originalHtml || submitBtn.innerHTML;
        submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>Importing...`;
    }

    let response, result;
    try {
        response = await fetch(`${API_URL}?action=import`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ rows: importSectionsParsedRows })
        });
        result = await response.json();
    } catch (error) {
        showToast("Could not reach the server. The import did not run.", "danger");
        isImportingSections = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = submitBtn.dataset.originalHtml; }
        return;
    }

    isImportingSections = false;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = submitBtn.dataset.originalHtml; }

    if (!response.ok && !result?.data) {
        showToast(result?.message || "Import failed.", "danger");
        return;
    }

    renderImportSectionsResults(result);

    if (result.summary?.success > 0) {
        await loadSections();
        renderAll();
    }
}

function renderImportSectionsResults(result) {
    const resultsBox = document.getElementById("importSectionsResults");
    const preview = document.getElementById("importSectionsPreview");
    if (!resultsBox) return;

    preview?.classList.add("d-none");
    resultsBox.classList.remove("d-none");

    const summary = result.summary || { total: 0, success: 0, errors: 0 };
    const rows = Array.isArray(result.data) ? result.data : [];
    const errorRows = rows.filter(r => r.status === "error");

    const summaryEl = document.getElementById("importSectionsResultsSummary");
    if (summaryEl) {
        summaryEl.className = `alert ${summary.errors ? "alert-warning" : "alert-success"} small mb-3`;
        summaryEl.innerHTML = `<i class="fas ${summary.errors ? "fa-triangle-exclamation" : "fa-circle-check"} me-2"></i>` +
            `${summary.success} of ${summary.total} section${summary.total === 1 ? "" : "s"} imported successfully` +
            (summary.errors ? `, ${summary.errors} skipped (see below).` : ".");
    }

    const errorBody = document.getElementById("importSectionsErrorsBody");
    const errorSection = document.getElementById("importSectionsErrorsSection");
    if (errorBody && errorSection) {
        if (errorRows.length) {
            errorSection.classList.remove("d-none");
            errorBody.innerHTML = errorRows.map(r => `
                <tr>
                    <td class="text-muted">${r.row}</td>
                    <td>${escapeHtml(r.section_name || "\u2014")}</td>
                    <td class="text-danger">${escapeHtml(r.message)}</td>
                </tr>
            `).join("");
        } else {
            errorSection.classList.add("d-none");
        }
    }

    document.getElementById("btnSubmitImportSections")?.classList.add("d-none");
    document.getElementById("btnImportSectionsDone")?.classList.remove("d-none");
}

function downloadSectionsImportTemplate() {
    const sampleRow = ["BSIT 1D", "BSIT", "1st Year", "40"];
    const csv = [SECTION_IMPORT_TEMPLATE_HEADERS, sampleRow]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sections-import-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function bindImportSectionsEvents() {
    document.getElementById("btnOpenImportSectionsModal")?.addEventListener("click", openImportSectionsModal);
    document.getElementById("btnDownloadSectionsImportTemplate")?.addEventListener("click", downloadSectionsImportTemplate);

    const fileInput = document.getElementById("importSectionsCsvFile");
    fileInput?.addEventListener("change", (e) => handleImportSectionsFileSelected(e.target.files?.[0]));

    const dropZone = document.getElementById("importSectionsDropZone");
    if (dropZone) {
        ["dragover", "dragenter"].forEach(evt => dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.add("border-warning");
        }));
        ["dragleave", "drop"].forEach(evt => dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.remove("border-warning");
        }));
        dropZone.addEventListener("drop", (e) => {
            const file = e.dataTransfer?.files?.[0];
            if (file) handleImportSectionsFileSelected(file);
        });
        dropZone.addEventListener("click", () => fileInput?.click());
    }

    document.getElementById("btnChangeImportSectionsFile")?.addEventListener("click", resetImportSectionsState);
    document.getElementById("btnSubmitImportSections")?.addEventListener("click", submitImportSections);
    document.getElementById("btnImportSectionsDone")?.addEventListener("click", () => {
        importSectionsModal?.hide();
        document.getElementById("btnSubmitImportSections")?.classList.remove("d-none");
        document.getElementById("btnImportSectionsDone")?.classList.add("d-none");
    });
}
