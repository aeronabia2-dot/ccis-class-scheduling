/** classrooms page coordinator. **/
"use strict";

function bindEvents() {
        document.getElementById("btnOpenRoomModal")?.addEventListener("click", openCreateModal);
        document.getElementById("btnOpenRoomModal2")?.addEventListener("click", openCreateModal);
        document.getElementById("btnOpenBulkModal")?.addEventListener("click", openBulkModal);

        document.getElementById("roomForm")?.addEventListener("submit", (event) => {
            event.preventDefault();
            saveClassroom(false);
        });
        document.getElementById("btnSaveAndAddAnother")?.addEventListener("click", () => saveClassroom(true));

        document.getElementById("roomModal")?.addEventListener("shown.bs.modal", () => {
            document.getElementById("roomCode")?.focus();
        });

        document.getElementById("roomModal")?.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                document.getElementById("roomForm")?.requestSubmit();
            }
        });

        document.getElementById("btnRefreshRooms")?.addEventListener("click", async () => {
            await loadClassrooms();
            refreshFilterOptions();
            renderAll();
            showToast(loadError ? "Unable to load classroom data. Please check your connection." : "Classroom data refreshed.", loadError ? "danger" : "success");
        });

        ["filterSearch", "filterType", "filterFloor", "filterStatus", "filterFeature", "filterMinCapacity", "filterInstructor"].forEach(id => {
            document.getElementById(id)?.addEventListener("input", renderAll);
            document.getElementById(id)?.addEventListener("change", renderAll);
        });

        document.getElementById("btnClearFilters")?.addEventListener("click", clearFilters);

        document.getElementById("unassignedBannerAction")?.addEventListener("click", () => {
            const select = document.getElementById("filterInstructor");
            if (select) select.value = UNASSIGNED_FILTER_VALUE;
            renderAll();
            document.getElementById("classroomTableBody")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        document.getElementById("roomNotes")?.addEventListener("input", () => {
            setText("notesCounter", document.getElementById("roomNotes").value.length);
        });

        // --- room code / name auto-suggestion + live validation ---
        const roomCodeInput = document.getElementById("roomCode");
        roomCodeInput?.addEventListener("input", () => {
            updateSuggestedName();
            scheduleCodeCheck();
        });
        roomCodeInput?.addEventListener("blur", () => {
            clearTimeout(codeCheckTimer);
            checkRoomCodeAvailability();
        });

        document.getElementById("roomType")?.addEventListener("change", updateSuggestedName);

        document.getElementById("roomName")?.addEventListener("input", () => {
            nameManuallyEdited = document.getElementById("roomName").value.trim() !== "";
        });

        // --- capacity quick picks ---
        document.querySelectorAll(".capacity-pick").forEach(btn => {
            btn.addEventListener("click", () => {
                document.getElementById("roomCapacity").value = btn.dataset.capacity;
                highlightCapacityPick(btn.dataset.capacity);
            });
        });
        document.getElementById("roomCapacity")?.addEventListener("input", (event) => {
            highlightCapacityPick(event.target.value);
        });

        // --- floor select / custom floor ---
        document.getElementById("roomFloor")?.addEventListener("change", function () {
            const custom = document.getElementById("roomFloorCustom");
            if (this.value === "Other") {
                custom.classList.remove("d-none");
                custom.focus();
            } else {
                custom.classList.add("d-none");
                custom.value = "";
            }
        });

        // --- bulk modal ---
        const bulkFieldIds = ["bulkRoomType", "bulkStartCode", "bulkCount", "bulkCapacity", "bulkFloor", "bulkNamePrefix", "bulkAutoNames"];
        bulkFieldIds.forEach(id => {
            document.getElementById(id)?.addEventListener("input", updateBulkPreview);
            document.getElementById(id)?.addEventListener("change", updateBulkPreview);
        });
        document.getElementById("bulkFeatureCheckboxes")?.addEventListener("change", updateBulkPreview);
        document.getElementById("btnSubmitBulk")?.addEventListener("click", submitBulkCreate);

        // --- sortable table headers ---
        document.querySelectorAll("th.sortable").forEach(th => {
            th.addEventListener("click", () => {
                const field = th.dataset.sort;
                sortState = sortState.field === field
                    ? { field, dir: sortState.dir === "asc" ? "desc" : "asc" }
                    : { field, dir: "asc" };

                document.querySelectorAll("th.sortable i").forEach(icon => { icon.className = "fas fa-sort"; });
                const icon = th.querySelector("i");
                if (icon) icon.className = sortState.dir === "asc" ? "fas fa-sort-up" : "fas fa-sort-down";

                renderAll();
            });
        });
    }

document.addEventListener("DOMContentLoaded", async () => {
        const modalElement = document.getElementById("roomModal");
        if (modalElement) roomModal = new bootstrap.Modal(modalElement);

        const bulkModalElement = document.getElementById("bulkModal");
        if (bulkModalElement) bulkModal = new bootstrap.Modal(bulkModalElement);

        const availabilityModalElement = document.getElementById("availabilityModal");
        if (availabilityModalElement) availabilityModal = new bootstrap.Modal(availabilityModalElement);
        document.getElementById("btnSaveAvailability")?.addEventListener("click", saveAvailability);

        injectFeatureCheckboxes(document.getElementById("featureCheckboxes"), "room");
        injectFeatureCheckboxes(document.getElementById("bulkFeatureCheckboxes"), "bulk");
        populateStaticFilterOptions();

        roomInstructorSelector = createInstructorSelector({
            searchInputId: "roomInstructorSearch",
            chipsContainerId: "roomInstructorChips",
            resultsId: "roomInstructorResults",
            helpTextId: "roomInstructorHelp"
        });

        bulkInstructorSelector = createInstructorSelector({
            searchInputId: "bulkInstructorSearch",
            chipsContainerId: "bulkInstructorChips",
            resultsId: "bulkInstructorResults",
            helpTextId: "bulkInstructorHelp",
            onChange: updateBulkPreview
        });

        bindEvents();

        await Promise.all([loadClassrooms(), loadInstructors()]);
        refreshFilterOptions();
        renderAll();
        initClassroomsFilterBar();

        if (loadError) {
            showToast("Unable to load classroom data. Please check your connection.", "danger");
        } else if (instructorsLoadError) {
            showToast("Unable to load instructor data. Preferred Instructor selection may be incomplete.", "danger");
        }
    });

window.ClassroomsPage = {
        edit: editClassroom,
        remove: removeClassroom,
        duplicate: duplicateClassroom,
        availability: openAvailabilityModal
    };
