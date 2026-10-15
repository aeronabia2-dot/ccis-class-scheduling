/** classrooms — ui responsibilities. **/
"use strict";

function clearFilters() {
        ["filterSearch", "filterType", "filterFloor", "filterStatus", "filterFeature", "filterMinCapacity", "filterInstructor"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
        renderAll();
    }

function editClassroom(id) {
        const room = classrooms.find(item => String(getRoomId(item)) === String(id));

        if (!room) {
            showToast("Classroom not found.", "danger");
            return;
        }

        resetForm({
            room_code: getRoomCode(room),
            room_name: getRoomName(room),
            room_type: getRoomType(room),
            capacity: room.capacity,
            floor: room.floor,
            features: room.features || [],
            status: getRoomStatus(room),
            notes: room.notes,
            preferred_instructor_ids: getPreferredInstructorIds(room)
        });

        document.getElementById("roomId").value = getRoomId(room);
        document.getElementById("roomModalTitle").innerHTML = `<i class="fas fa-pen text-warning me-2"></i>Edit Classroom`;
        document.getElementById("btnSaveAndAddAnother")?.classList.add("d-none");
        roomModal?.show();
    }

function generateBulkSequence(startCode, count) {
        const codes = [];
        const current = String(startCode || "").trim();
        if (!current) return codes;

        const match = current.match(/^(.*?)(\d+)(\D*)$/);

        if (match) {
            const [, prefix, num, suffix] = match;
            const width = num.length;
            let n = parseInt(num, 10);
            for (let i = 0; i < count; i++) {
                codes.push(`${prefix}${String(n).padStart(width, "0")}${suffix}`);
                n++;
            }
        } else {
            for (let i = 0; i < count; i++) {
                codes.push(i === 0 ? current : `${current} ${i + 1}`);
            }
        }

        return codes;
    }

function injectFeatureCheckboxes(container, idPrefix) {
        if (!container) return;
        container.innerHTML = FEATURES.map((feature, index) => `
            <div class="form-check feature-check">
                <input class="form-check-input" type="checkbox" value="${escapeAttr(feature)}" id="${idPrefix}-feat-${index}">
                <label class="form-check-label" for="${idPrefix}-feat-${index}">${escapeHtml(feature)}</label>
            </div>
        `).join("");
    }

async function openAvailabilityModal(id) {
        const room = classrooms.find(item => String(getRoomId(item)) === String(id));
        if (!room) {
            showToast("Classroom not found.", "danger");
            return;
        }

        availabilityRoomId = getRoomId(room);
        document.getElementById("availabilityModalTitle").textContent = `Availability — ${getRoomName(room) || "Room"}`;

        let existingRows = [];
        try {
            const response = await fetch(`${API_URL}?action=availability&room_id=${encodeURIComponent(availabilityRoomId)}`);
            const result = await response.json();
            if (response.ok && result.success) existingRows = result.data || [];
        } catch (error) {
            // Non-fatal - open with everything unchecked/default.
        }

        renderAvailabilityDays(existingRows);
        availabilityModal?.show();
    }

function openBulkModal() {
        document.getElementById("bulkStartCode").value = "";
        document.getElementById("bulkCount").value = 5;
        document.getElementById("bulkCapacity").value = 40;
        document.getElementById("bulkNamePrefix").value = "";
        document.getElementById("bulkAutoNames").checked = true;
        setCheckedFeatures(document.getElementById("bulkFeatureCheckboxes"), []);
        bulkInstructorSelector?.reset();
        updateBulkPreview();
        bulkModal?.show();
    }

function openCreateModal() {
        resetForm();
        document.getElementById("roomModalTitle").innerHTML = `<i class="fas fa-building text-warning me-2"></i>Add Classroom`;
        document.getElementById("btnSaveAndAddAnother")?.classList.remove("d-none");
        roomModal?.show();
    }

function populateStaticFilterOptions() {
        const statusSelect = document.getElementById("filterStatus");
        if (statusSelect) {
            STATUSES.forEach(status => {
                const opt = document.createElement("option");
                opt.value = status;
                opt.textContent = status;
                statusSelect.appendChild(opt);
            });
        }

        const featureSelect = document.getElementById("filterFeature");
        if (featureSelect) {
            FEATURES.forEach(feature => {
                const opt = document.createElement("option");
                opt.value = feature;
                opt.textContent = feature;
                featureSelect.appendChild(opt);
            });
        }
    }

function refreshFilterOptions() {
        const floorSelect = document.getElementById("filterFloor");
        if (floorSelect) {
            const existing = new Set(Array.from(floorSelect.options).map(opt => opt.value));
            const floors = Array.from(new Set(classrooms.map(room => room.floor).filter(Boolean)));
            floors.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            floors.forEach(floor => {
                if (!existing.has(floor)) {
                    const opt = document.createElement("option");
                    opt.value = floor;
                    opt.textContent = floor;
                    floorSelect.appendChild(opt);
                }
            });
        }

        refreshInstructorFilterOptions();
    }

function refreshInstructorFilterOptions() {
        const select = document.getElementById("filterInstructor");
        if (!select) return;

        const currentValue = select.value;
        const sorted = instructors.slice().sort((a, b) =>
            getInstructorName(a).localeCompare(getInstructorName(b), undefined, { numeric: true })
        );

        select.innerHTML = `
            <option value="">All instructors</option>
            <option value="${UNASSIGNED_FILTER_VALUE}">⚠ Unassigned only</option>
        ` + sorted.map(ins => `
            <option value="${escapeAttr(getInstructorId(ins))}">${escapeHtml(getInstructorName(ins))}</option>
        `).join("");

        if (Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    }

function renderAll() {
        const filtered = getFilteredClassrooms();
        const sorted = sortClassrooms(filtered);
        renderMetrics();
        renderTable(sorted);
    }

function renderAvailabilityDays(existingRows) {
        const container = document.getElementById("availabilityDaysContainer");
        if (!container) return;

        const byDay = new Map(existingRows.filter(r => r.is_available == 1).map(r => [r.day, r]));

        container.innerHTML = AVAILABILITY_DAYS.map(day => {
            const existing = byDay.get(day);
            const checked = Boolean(existing);
            const start = (existing?.start_time || "07:00:00").slice(0, 5);
            const end = (existing?.end_time || "21:00:00").slice(0, 5);

            return `
                <div class="d-flex align-items-center gap-2 mb-2 availability-day-row">
                    <div class="form-check" style="width: 130px; flex-shrink: 0;">
                        <input class="form-check-input avail-day-toggle" type="checkbox" id="avail_${day}" data-day="${day}" ${checked ? "checked" : ""}>
                        <label class="form-check-label" for="avail_${day}">${day}</label>
                    </div>
                    <input type="time" class="form-control form-control-sm avail-start" style="max-width: 130px;" value="${start}" ${checked ? "" : "disabled"}>
                    <span class="text-muted small">to</span>
                    <input type="time" class="form-control form-control-sm avail-end" style="max-width: 130px;" value="${end}" ${checked ? "" : "disabled"}>
                </div>
            `;
        }).join("");

        container.querySelectorAll(".avail-day-toggle").forEach(toggle => {
            toggle.addEventListener("change", () => {
                const row = toggle.closest(".availability-day-row");
                row.querySelectorAll(".avail-start, .avail-end").forEach(input => {
                    input.disabled = !toggle.checked;
                });
            });
        });
    }

function renderMetrics() {
        setText("metricTotalRooms", classrooms.length);
        setText("metricLectureRooms", classrooms.filter(room => getRoomType(room) === "Lecture").length);
        setText("metricLaboratories", classrooms.filter(room => getRoomType(room) === "Laboratory").length);

        const unassignedRooms = classrooms.filter(room => getPreferredInstructorIds(room).length === 0);

        renderUnassignedBanner(unassignedRooms.length);
    }

function renderTable(rows) {
        const tbody = document.getElementById("classroomTableBody");
        if (!tbody) return;

        setText("roomCounter", `${rows.length} record${rows.length === 1 ? "" : "s"}`);

        if (!rows.length) {
            let message = "No classrooms found.";
            let actionLabel = '<i class="fas fa-plus me-1"></i>Add Classroom';
            let actionKind = "add";

            if (loadError) {
                message = "Unable to load classroom data. Please check your connection.";
                actionLabel = '<i class="fas fa-rotate me-1"></i>Try Again';
                actionKind = "retry";
            } else if (hasActiveFilters()) {
                message = "No classrooms match your current filters.";
                actionLabel = '<i class="fas fa-xmark me-1"></i>Clear Filters';
                actionKind = "clear";
            }

            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-classroom">
                        <i class="fas fa-door-open fs-2 mb-2"></i>
                        <div>${message}</div>
                        <button type="button" class="btn btn-sm ${actionKind === "add" ? "classroom-btn" : "btn-outline-secondary"} mt-2" id="emptyStateAction">
                            ${actionLabel}
                        </button>
                    </td>
                </tr>
            `;

            const actionBtn = document.getElementById("emptyStateAction");
            if (actionBtn) {
                if (actionKind === "add") actionBtn.addEventListener("click", openCreateModal);
                else if (actionKind === "clear") actionBtn.addEventListener("click", clearFilters);
                else actionBtn.addEventListener("click", () => document.getElementById("btnRefreshRooms")?.click());
            }
            return;
        }

        tbody.innerHTML = rows.map(room => {
            const id = getRoomId(room);
            const type = getRoomType(room);
            const status = getRoomStatus(room);
            const features = room.features || [];

            const featureBadges = features.length
                ? features.slice(0, 3).map(f => `<span class="feature-tag">${escapeHtml(f)}</span>`).join(" ") +
                  (features.length > 3 ? ` <span class="feature-tag feature-tag-more">+${features.length - 3}</span>` : "")
                : '<span class="text-muted small">None</span>';

            return `
                <tr>
                    <td>
                        <div class="room-code">${escapeHtml(getRoomCode(room))}</div>
                        <div class="room-detail">${escapeHtml(room.notes || "No notes")}</div>
                    </td>
                    <td>${escapeHtml(getRoomName(room))}</td>
                    <td><span class="type-badge ${typeClass(type)}">${escapeHtml(type)}</span></td>
                    <td>${escapeHtml(room.capacity || 0)}</td>
                    <td>${escapeHtml(room.floor || "Not set")}</td>
                    <td><div class="feature-tag-wrap">${featureBadges}</div></td>
                    <td><span class="status-badge ${statusClass(status)}"><span class="status-dot"></span>${escapeHtml(status)}</span></td>
                    <td>${renderPreferredInstructorsCell(room)}</td>
                    <td class="text-end">
                        <button type="button" class="btn btn-sm btn-outline-secondary action-btn me-1" onclick="ClassroomsPage.availability('${escapeAttr(id)}')" title="Set availability">
                            <i class="fas fa-calendar-check"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-warning action-btn me-1" onclick="ClassroomsPage.edit('${escapeAttr(id)}')" title="Edit classroom">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary action-btn me-1" onclick="ClassroomsPage.duplicate('${escapeAttr(id)}')" title="Duplicate classroom">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-danger action-btn" onclick="ClassroomsPage.remove('${escapeAttr(id)}')" title="Delete or deactivate classroom">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

function renderUnassignedBanner(unassignedCount) {
        const banner = document.getElementById("unassignedBanner");
        if (!banner) return;

        if (unassignedCount > 0) {
            banner.classList.remove("d-none");
            setText("unassignedBannerCount", unassignedCount);
            setText("unassignedBannerLabel", unassignedCount === 1 ? "classroom needs" : "classrooms need");
        } else {
            banner.classList.add("d-none");
        }
    }

async function saveClassroom(addAnother) {
        if (isSaving) return;

        const form = document.getElementById("roomForm");
        const floor = getEffectiveFloor();

        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            showToast("Please complete all required fields.", "danger");
            return;
        }

        const capacity = Number(document.getElementById("roomCapacity").value);
        if (!Number.isInteger(capacity) || capacity <= 0) {
            showToast("Capacity must be a whole number greater than zero.", "danger");
            return;
        }

        const room_type = document.getElementById("roomType").value;
        if (!ROOM_TYPES.includes(room_type)) {
            showToast("Room type must be Lecture or Laboratory only.", "danger");
            return;
        }

        // Preferred instructors are optional (spec Part 6) — zero, one, or
        // many are all valid, so there is no required-selection check here.
        const preferredInstructorIds = roomInstructorSelector?.getValues() || [];

        const existingId = document.getElementById("roomId").value;
        const id = existingId || crypto.randomUUID();
        const isUpdate = !!existingId;

        const room = {
            id,
            room_code: clean(document.getElementById("roomCode").value),
            room_name: clean(document.getElementById("roomName").value),
            room_type,
            capacity,
            floor: clean(floor),
            notes: clean(document.getElementById("roomNotes").value),
            status: document.getElementById("roomStatus").value,
            features: getCheckedFeatures(document.getElementById("featureCheckboxes")),
            preferred_instructor_ids: preferredInstructorIds
        };

        room.name = room.room_code;
        room.code = room.room_code;
        room.type = room.room_type;
        room.title = room.room_name;

        room.preferred_instructors = preferredInstructorIds.map(instructorId => {
            const instructor = findInstructorById(instructorId);
            return instructor ? {
                id: getInstructorId(instructor),
                name: getInstructorName(instructor),
                employee_id: instructor.employee_id,
                department: instructor.department,
                status: getInstructorStatus(instructor)
            } : { id: instructorId, name: "Unknown instructor" };
        });
        // Legacy singular fields kept in sync for any code still reading
        // them optimistically before the next full reload from the API.
        room.primary_instructor_id = preferredInstructorIds[0] || null;
        room.primary_instructor = room.preferred_instructors[0] || null;

        const duplicate = classrooms.find(item =>
            String(getRoomId(item)) !== String(id) &&
            getRoomCode(item).toLowerCase() === room.room_code.toLowerCase()
        );

        if (duplicate) {
            showToast("Room code already exists.", "danger");
            return;
        }

        isSaving = true;
        setSavingState(true);

        try {
            await persistRoom(room, isUpdate ? "PUT" : "POST");
        } catch (error) {
            // persistRoom already showed a toast describing the failure.
            setSavingState(false);
            isSaving = false;
            return;
        }

        if (isUpdate) {
            const index = classrooms.findIndex(item => String(getRoomId(item)) === String(id));
            if (index >= 0) classrooms[index] = room;
        } else {
            classrooms.push(room);
        }

        saveLocalClassrooms();
        broadcastRoomsChanged();
        refreshFilterOptions();
        renderAll();
        setSavingState(false);
        isSaving = false;

        if (addAnother && !isUpdate) {
            showToast(`Classroom ${room.room_code} added. Ready for the next one.`, "success");

            const nextCode = suggestNextCode(room.room_code);
            resetForm({
                room_type: room.room_type,
                capacity: room.capacity,
                floor: room.floor,
                features: room.features,
                status: "Available",
                room_code: nextCode,
                room_name: "",
                preferred_instructor_ids: room.preferred_instructor_ids
            });
            nameManuallyEdited = false;
            updateSuggestedName();
            document.getElementById("roomCode").focus();
            scheduleCodeCheck();
        } else {
            showToast(isUpdate ? "Classroom updated successfully." : "Classroom added successfully.", "success");
            roomModal?.hide();
        }
    }

async function setRoomStatus(room, status) {
        const updated = { ...room, status };
        updated.name = updated.room_code;
        updated.code = updated.room_code;
        updated.type = updated.room_type;
        updated.title = updated.room_name;

        try {
            await persistRoom(updated, "PUT");
        } catch {
            return;
        }

        const index = classrooms.findIndex(item => String(getRoomId(item)) === String(getRoomId(room)));
        if (index >= 0) classrooms[index] = updated;

        saveLocalClassrooms();
        broadcastRoomsChanged();
        renderAll();
        showToast("Classroom status updated.", "success");
    }

function setSavingState(saving) {
        const saveBtn = document.getElementById("btnSaveClassroom");
        const addAnotherBtn = document.getElementById("btnSaveAndAddAnother");

        [saveBtn, addAnotherBtn].forEach(btn => { if (btn) btn.disabled = saving; });

        if (saveBtn) {
            saveBtn.innerHTML = saving
                ? `<i class="fas fa-spinner fa-spin me-2"></i>Saving...`
                : `<i class="fas fa-save me-2"></i>Save Classroom`;
        }
    }

async function submitBulkCreate() {
        if (!currentBulkPreview.length || currentBulkPreview.some(r => r.conflict)) {
            showToast("Resolve the highlighted conflicts before creating.", "danger");
            return;
        }

        const btn = document.getElementById("btnSubmitBulk");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>Creating...`;
        }

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                    action: "bulk_create",
                    rooms: currentBulkPreview.map(({ conflict, conflictReason, ...room }) => room)
                })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                showToast(result.message || "Bulk creation failed.", "danger");
                if (result.rowErrors) {
                    const codes = Object.values(result.rowErrors).map(entry => entry.room?.room_code || "?").join(", ");
                    showToast(`Fix these rooms and try again: ${codes}`, "danger");
                }
                return;
            }

            const created = normalizeList(result.data);
            created.forEach(room => {
                const preferredIds = getPreferredInstructorIds(room);
                const preferredInstructorRecords = preferredIds
                    .map(findInstructorById)
                    .filter(Boolean)
                    .map(instructor => ({
                        id: getInstructorId(instructor),
                        name: getInstructorName(instructor),
                        employee_id: instructor.employee_id,
                        department: instructor.department,
                        status: getInstructorStatus(instructor)
                    }));

                classrooms.push({
                    ...room,
                    name: room.room_code,
                    code: room.room_code,
                    type: room.room_type,
                    title: room.room_name,
                    preferred_instructor_ids: preferredIds,
                    preferred_instructors: preferredInstructorRecords,
                    primary_instructor_id: preferredIds[0] || null,
                    primary_instructor: preferredInstructorRecords[0] || null
                });
            });

            saveLocalClassrooms();
            broadcastRoomsChanged();
            refreshFilterOptions();
            renderAll();
            bulkModal?.hide();
            showToast(result.message || `${created.length} classroom(s) created successfully.`, "success");
        } catch {
            showToast("Could not reach the server. No classrooms were created.", "danger");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fas fa-check me-2"></i>Create Classrooms`;
            }
        }
    }

function updateBulkPreview() {
        const type = document.getElementById("bulkRoomType").value;
        const startCode = document.getElementById("bulkStartCode").value;
        const count = Math.max(1, Math.min(100, Number(document.getElementById("bulkCount").value) || 0));
        const capacity = Number(document.getElementById("bulkCapacity").value) || 0;
        const floor = document.getElementById("bulkFloor").value;
        const prefix = document.getElementById("bulkNamePrefix").value.trim();
        const autoNames = document.getElementById("bulkAutoNames").checked;
        const features = getCheckedFeatures(document.getElementById("bulkFeatureCheckboxes"));
        // Preferred instructors are optional for bulk creation too (spec
        // Part 26) — an empty list never blocks the batch.
        const preferredInstructorIds = bulkInstructorSelector?.getValues() || [];
        const preferredInstructors = preferredInstructorIds.map(findInstructorById).filter(Boolean);

        const tbody = document.getElementById("bulkPreviewBody");
        const summary = document.getElementById("bulkPreviewSummary");
        const submitBtn = document.getElementById("btnSubmitBulk");

        if (!startCode.trim()) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-3">Enter a starting room code to see a preview.</td></tr>`;
            summary.textContent = "";
            currentBulkPreview = [];
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        const codes = generateBulkSequence(startCode, count);
        const seen = new Set();
        let conflictCount = 0;

        const rows = codes.map(code => {
            const lower = code.toLowerCase();
            const existsInDb = classrooms.some(room => getRoomCode(room).toLowerCase() === lower);
            const dupeInBatch = seen.has(lower);
            seen.add(lower);
            // Not selecting a preferred instructor is never a conflict for
            // bulk creation (spec Part 26) — only real duplicates are.
            const conflict = existsInDb || dupeInBatch;
            const conflictReason = existsInDb ? "Already exists" : (dupeInBatch ? "Duplicate in batch" : "");

            if (conflict) conflictCount++;

            const name = autoNames
                ? generateSuggestedName(code, type)
                : (prefix ? `${prefix} ${code}`.trim() : code);

            return {
                room_code: code,
                room_name: name,
                room_type: type,
                capacity,
                floor,
                status: "Available",
                notes: "",
                features,
                preferred_instructor_ids: preferredInstructorIds,
                conflict,
                conflictReason
            };
        });

        currentBulkPreview = rows;

        const preferredCellHtml = preferredInstructors.length
            ? preferredInstructors.map(ins => escapeHtml(getInstructorName(ins))).join(", ")
            : '<span class="text-muted">Any instructor</span>';

        tbody.innerHTML = rows.map(row => `
            <tr class="${row.conflict ? "table-danger" : ""}">
                <td>${escapeHtml(row.room_code)}${row.conflict ? ` <span class="badge bg-danger ms-1">${escapeHtml(row.conflictReason)}</span>` : ""}</td>
                <td>${escapeHtml(row.room_name)}</td>
                <td>${escapeHtml(row.capacity)}</td>
                <td>${escapeHtml(row.floor || "Not set")}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>${preferredCellHtml}</td>
            </tr>
        `).join("");

        summary.textContent = conflictCount
            ? `${rows.length} rooms — ${conflictCount} need attention`
            : `${rows.length} rooms ready to create`;

        if (submitBtn) submitBtn.disabled = conflictCount > 0 || capacity <= 0;
    }

function updateSuggestedName() {
        if (nameManuallyEdited) return;

        const code = document.getElementById("roomCode")?.value || "";
        const type = document.getElementById("roomType")?.value || "";
        if (!code || !type) return;

        document.getElementById("roomName").value = generateSuggestedName(code, type);
    }

