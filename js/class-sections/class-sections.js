/** class-sections page coordinator. **/
"use strict";

function bindEvents() {
        document.getElementById("btnAddSection")?.addEventListener("click", openCreateModal);
        document.getElementById("btnAddSection2")?.addEventListener("click", openCreateModal);
        document.getElementById("sectionForm")?.addEventListener("submit", saveSection);

        document.getElementById("btnRefresh")?.addEventListener("click", async () => {
            await loadSections();
            renderAll();
            showToast("Class sections refreshed.", "success");
        });

        document.getElementById("btnClearFilters")?.addEventListener("click", clearFilters);

        document.getElementById("sectionName")?.addEventListener("input", scheduleSectionNameCheck);

        ["searchSection", "filterProgram", "filterYear"].forEach(id => {
            document.getElementById(id)?.addEventListener("input", renderAll);
        });
    }

document.addEventListener("DOMContentLoaded", async () => {
        sectionModal = new bootstrap.Modal(document.getElementById("sectionModal"));

        bindEvents();
        initBulkSectionModal();
        initImportSectionsModal();
        initSaturdayEligibilityPanel();
        await loadSections();
        await loadSaturdayEligibility();
        renderSaturdayEligibilityGrid();
        renderAll();
    });

window.ClassSectionsPage = {
        edit: editSection,
        remove: removeSection,
        duplicate: duplicateSection,
        viewCurriculum
    };
