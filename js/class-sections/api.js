/** class-sections — api responsibilities. **/
"use strict";

async function deleteSectionFromServer(id) {
        let response;

        try {
            response = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
                headers: { "Accept": "application/json" }
            });
        } catch (error) {
            showToast("Could not reach the server. The section was not deleted.", "danger");
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
            showToast(result.message || "Failed to delete class section.", "danger");
            throw new Error(result.message || "Failed to delete class section.");
        }
    }

async function loadSections() {
        try {
            const response = await fetch(API_URL, {
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) throw new Error("API unavailable");

            sections = normalizeList(await response.json());
            saveLocalSections();
        } catch {
            sections = loadLocalSections();

            if (!sections.length) {
                sections = getFallbackSections();
                saveLocalSections();
            }
        }

        populateProgramFilter();
    }

async function persistSection(section, method) {
        let response;

        try {
            response = await fetch(API_URL, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(section)
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
            showToast(result.message || "Failed to save class section.", "danger");
            throw new Error(result.message || "Failed to save class section.");
        }

        return result;
    }

