/** class-sections — utils responsibilities. **/
"use strict";

function broadcastSectionsChanged() {
        // Scheduling.js (and any other open tab) listens for this key and
        // re-fetches fresh data straight from class_sections.php - the API/DB
        // stays the single source of truth instead of mirroring a copy here.
        localStorage.setItem(SECTIONS_SYNC_KEY, String(Date.now()));
    }

function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#96;");
    }

function getFallbackSections() {
        return [
            {
                id: "sec-1",
                section_name: "BSIT 1A",
                name: "BSIT 1A",
                program: "BSIT",
                year_level: "1st Year",
                students: 40
            },
            {
                id: "sec-2",
                section_name: "BSIT 2A",
                name: "BSIT 2A",
                program: "BSIT",
                year_level: "2nd Year",
                students: 38
            },
            {
                id: "sec-3",
                section_name: "BSCS 3A",
                name: "BSCS 3A",
                program: "BSCS",
                year_level: "3rd Year",
                students: 35
            }
        ];
    }

function getSectionId(item) {
        return item.id ?? item.section_id ?? item.class_section_id;
    }

/**
 * Maps a year-level label to its leading digit, used to build generated
 * section names ("BSIT" + "1" + "A" -> "BSIT 1A") in the Bulk Generate
 * tool. Falls back to stripping the first digit found in the string, so
 * it degrades gracefully if the year-level list ever changes shape.
 */
function yearLevelToDigit(yearLevel) {
        const known = { "1st Year": "1", "2nd Year": "2", "3rd Year": "3", "4th Year": "4" };
        if (known[yearLevel]) return known[yearLevel];
        const match = String(yearLevel || "").match(/\d/);
        return match ? match[0] : "";
    }

/**
 * Real-time "is this section name already taken" feedback (debounced),
 * mirrored from checkRoomCodeAvailability() in js/classrooms/utils.js —
 * same efficiency idea: catch a duplicate before the user hits Save
 * instead of after a round trip and a rejected submit.
 */
async function checkSectionNameAvailability() {
        const feedback = document.getElementById("sectionNameFeedback");
        const name = document.getElementById("sectionName")?.value.trim();
        const excludeId = document.getElementById("sectionId")?.value || "";

        if (!feedback) return;

        if (!name) {
            feedback.textContent = "\u00A0";
            feedback.className = "form-text";
            return;
        }

        try {
            const url = `${API_URL}?action=check_name&name=${encodeURIComponent(name)}` +
                (excludeId ? `&exclude_id=${encodeURIComponent(excludeId)}` : "");
            const response = await fetch(url, { headers: { "Accept": "application/json" } });
            const result = await response.json();

            if (result.available) {
                feedback.textContent = "✓ Section name available";
                feedback.className = "form-text text-success";
            } else {
                feedback.textContent = "⚠ Section name already exists";
                feedback.className = "form-text text-danger";
            }
        } catch {
            feedback.textContent = "\u00A0";
            feedback.className = "form-text";
        }
    }

function scheduleSectionNameCheck() {
        clearTimeout(sectionNameCheckTimer);
        sectionNameCheckTimer = setTimeout(checkSectionNameAvailability, SECTION_NAME_CHECK_DEBOUNCE_MS);
    }

function getSectionName(item) {
        return item.section_name ?? item.name ?? item.section ?? "Unnamed Section";
    }

function loadLocalSections() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

function normalizeList(data) {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.data)) return data.data;
        if (Array.isArray(data?.records)) return data.records;
        if (Array.isArray(data?.sections)) return data.sections;
        if (Array.isArray(data?.class_sections)) return data.class_sections;
        return [];
    }

function saveLocalSections() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
    }

function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

function showToast(message, type = "success") {
    // One shared implementation (js/core/notify.js) so every page shows
    // the same high-contrast, correctly-iconed notification.
    window.CCISNotify.toast(message, type);
}

