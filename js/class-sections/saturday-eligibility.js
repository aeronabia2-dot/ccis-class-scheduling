/**
 * class-sections page — "Saturday Class Eligibility" panel.
 *
 * Not every year level meets on Saturday, and it varies by program -
 * this lets an admin check exactly which Program + Year Level
 * combinations DO have Saturday classes. Anything left unchecked is
 * hard-blocked from Saturday everywhere in scheduling: Auto-Generate,
 * Optimize, and manual/assisted scheduling on the Schedules page (see
 * isSaturdayEligibleSection() in js/scheduling/core/utils.js), and the
 * actual enforcement point on the server, checkSaturdayEligibility() in
 * api/schedules.php, which re-checks this on every save regardless of
 * what the client did.
 *
 * Uses the full SECTION_PROGRAMS x SECTION_YEAR_LEVELS grid (not just
 * combinations that currently have sections) so the policy is already
 * in place before a new section for that Program+Year is even created.
 */
"use strict";

var SATURDAY_ELIGIBILITY_API_URL = "../api/saturday_eligibility.php";

var saturdayEligibleCohorts = [];

function cohortCheckboxId(program, yearLevel) {
    return `sat-elig-${program}-${yearLevel}`.replace(/\s+/g, "-");
}

function isCohortSaturdayEligible(program, yearLevel) {
    return saturdayEligibleCohorts.some(cohort =>
        String(cohort.program || "").toLowerCase() === program.toLowerCase() &&
        String(cohort.year_level || "").toLowerCase() === yearLevel.toLowerCase()
    );
}

async function loadSaturdayEligibility() {
    try {
        const response = await fetch(SATURDAY_ELIGIBILITY_API_URL, { headers: { "Accept": "application/json" } });
        const result = await response.json();
        saturdayEligibleCohorts = (response.ok && result.success && Array.isArray(result.data)) ? result.data : [];
    } catch (error) {
        console.warn("Could not load Saturday eligibility.", error);
        saturdayEligibleCohorts = [];
    }
}

function renderSaturdayEligibilityGrid() {
    const grid = document.getElementById("saturdayEligibilityGrid");
    if (!grid) return;

    grid.innerHTML = SECTION_PROGRAMS.map(program => `
        <div class="col-lg-3 col-md-6">
            <div class="p-3 border rounded-3 h-100">
                <div class="fw-semibold small mb-2">${escapeHtml(program)}</div>
                ${SECTION_YEAR_LEVELS.map(yearLevel => `
                    <div class="form-check">
                        <input class="form-check-input saturday-eligibility-checkbox" type="checkbox"
                            id="${escapeHtml(cohortCheckboxId(program, yearLevel))}"
                            data-program="${escapeHtml(program)}" data-year-level="${escapeHtml(yearLevel)}"
                            ${isCohortSaturdayEligible(program, yearLevel) ? "checked" : ""}>
                        <label class="form-check-label small" for="${escapeHtml(cohortCheckboxId(program, yearLevel))}">
                            ${escapeHtml(yearLevel)}
                        </label>
                    </div>
                `).join("")}
            </div>
        </div>
    `).join("");
}

async function saveSaturdayEligibility() {
    const button = document.getElementById("btnSaveSaturdayEligibility");
    const originalHtml = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    }

    const cohorts = Array.from(document.querySelectorAll(".saturday-eligibility-checkbox:checked")).map(checkbox => ({
        program: checkbox.dataset.program,
        year_level: checkbox.dataset.yearLevel
    }));

    try {
        const response = await fetch(SATURDAY_ELIGIBILITY_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ cohorts })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to save Saturday eligibility.");
        }

        saturdayEligibleCohorts = Array.isArray(result.data) ? result.data : cohorts;
        showToast("Saturday eligibility saved.", "success");
    } catch (error) {
        showToast(error.message || "Could not reach the server. Saturday eligibility was not saved.", "danger");
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    }
}

function initSaturdayEligibilityPanel() {
    document.getElementById("btnSaveSaturdayEligibility")?.addEventListener("click", saveSaturdayEligibility);
}
