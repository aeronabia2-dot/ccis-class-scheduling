/** classrooms — api responsibilities. **/
"use strict";

async function deleteRoomFromServer(id) {
        try {
            const response = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
                headers: { "Accept": "application/json" }
            });
            const result = await response.json();
            return { success: !!result.success, message: result.message, inUse: !!result.inUse };
        } catch {
            return { success: false, message: "Could not reach the server. The classroom was not deleted." };
        }
    }

async function loadClassrooms() {
        loadError = false;

        try {
            const response = await fetch(API_URL, { headers: { "Accept": "application/json" } });
            if (!response.ok) throw new Error("API unavailable");

            const data = await response.json();
            classrooms = normalizeList(data);
            saveLocalClassrooms();
        } catch {
            // The database/API is the source of truth. We only fall back to a
            // cached copy for offline viewing — never to fabricated sample data.
            const cached = loadLocalClassrooms();
            classrooms = cached;
            loadError = true;
        }
    }

async function loadInstructors() {
        instructorsLoadError = false;

        try {
            const response = await fetch(INSTRUCTORS_API_URL, { headers: { "Accept": "application/json" } });
            if (!response.ok) throw new Error("Instructors API unavailable");

            const data = await response.json();
            instructors = normalizeInstructorList(data);
        } catch {
            instructors = [];
            instructorsLoadError = true;
        }
    }

async function persistRoom(room, method) {
        let response;

        try {
            response = await fetch(API_URL, {
                method,
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify(room)
            });
        } catch (error) {
            showToast("Could not reach the server. Please check your connection and try again.", "danger");
            throw error;
        }

        let result;

        try {
            result = await response.json();
        } catch (error) {
            showToast("Unexpected response from the server.", "danger");
            throw error;
        }

        if (!response.ok || !result.success) {
            showToast(result.message || "Failed to save classroom.", "danger");
            throw new Error(result.message || "Failed to save classroom.");
        }

        return result;
    }

async function removeClassroom(id) {
        const room = classrooms.find(item => String(getRoomId(item)) === String(id));

        if (!room) {
            showToast("Classroom not found.", "danger");
            return;
        }

        if (!confirm(`Delete ${getRoomCode(room)} - ${getRoomName(room)}?`)) return;

        const result = await deleteRoomFromServer(id);

        if (result.success) {
            classrooms = classrooms.filter(item => String(getRoomId(item)) !== String(id));
            saveLocalClassrooms();
            broadcastRoomsChanged();
            renderAll();
            showToast("Classroom deleted successfully.", "success");
            return;
        }

        if (result.inUse) {
            if (confirm(`${result.message}\n\nMark ${getRoomCode(room)} as Inactive instead?`)) {
                await setRoomStatus(room, "Inactive");
            }
            return;
        }

        showToast(result.message || "Failed to delete classroom.", "danger");
    }

async function saveAvailability() {
        if (!availabilityRoomId) return;

        const saveBtn = document.getElementById("btnSaveAvailability");
        const originalHtml = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

        const rows = document.querySelectorAll(".availability-day-row");
        const availability = [];

        rows.forEach(row => {
            const toggle = row.querySelector(".avail-day-toggle");
            if (!toggle.checked) return;

            availability.push({
                day: toggle.dataset.day,
                start_time: row.querySelector(".avail-start").value,
                end_time: row.querySelector(".avail-end").value,
                is_available: 1
            });
        });

        try {
            const response = await fetch(`${API_URL}?action=availability`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ room_id: availabilityRoomId, availability })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                showToast(result.message || "Failed to save availability.", "danger");
                return;
            }

            showToast("Availability saved.", "success");
            availabilityModal?.hide();
        } catch (error) {
            showToast("Could not reach the server. Please try again.", "danger");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHtml;
        }
    }

