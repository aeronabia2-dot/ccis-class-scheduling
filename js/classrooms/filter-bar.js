/** classrooms — filter bar responsibilities.
 *
 *  The filters themselves (ids, values, getFilteredRooms / clearFilters)
 *  are unchanged. This file only adds, on top of them:
 *    - removable chips for every active filter
 *    - a count badge on the "More" button for the hidden filters
 *    - persistence of the filter values for the browser session
 *
 *  Same pattern as js/scheduling/ui/filter-bar.js: it wraps the global
 *  renderAll() (declared in ui.js) so the chips are rebuilt after EVERY
 *  render, whatever triggered it (typing, Refresh, Clear, the "show these
 *  rooms" banner action...).
 *  Load order: after ui.js/utils.js, before classrooms.js (which binds
 *  renderAll to the filter inputs - it must bind the wrapped version - and
 *  calls initClassroomsFilterBar() once at the end of its init).
 **/
"use strict";

var CLASSROOMS_FILTER_STORAGE_KEY = "ccis_classrooms_filters_v1";

var CLASSROOMS_FILTERS = [
    { id: "filterSearch",       label: "Search" },
    { id: "filterType",         label: "Room type" },
    { id: "filterStatus",       label: "Status" },
    { id: "filterFloor",        label: "Floor",       more: true },
    { id: "filterInstructor",   label: "Instructor",  more: true },
    { id: "filterMinCapacity",  label: "Min. capacity", more: true },
    { id: "filterFeature",      label: "Feature",     more: true }
];

var classroomsFilterBarReady = false;

function readSavedClassroomsFilters() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(CLASSROOMS_FILTER_STORAGE_KEY));
        return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
        return {};
    }
}

// Read at load time, before the first render can overwrite it with empty values.
var savedClassroomsFilters = readSavedClassroomsFilters();

function getClassroomsFilterDisplayValue(el) {
    if (!el.value) return "";
    if (el.tagName === "SELECT") return el.selectedOptions[0]?.textContent.trim() || el.value;
    return el.value.trim();
}

function persistClassroomsFilters() {
    const values = {};
    CLASSROOMS_FILTERS.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el && el.value) values[id] = el.value;
    });

    try {
        sessionStorage.setItem(CLASSROOMS_FILTER_STORAGE_KEY, JSON.stringify(values));
    } catch (error) {
        // Storage unavailable (private mode): filters just won't survive a reload.
    }
}

function renderClassroomsFilterChips() {
    const container = document.getElementById("activeFilterChips");
    if (!container) return;

    const active = CLASSROOMS_FILTERS
        .map(filter => ({ filter, el: document.getElementById(filter.id) }))
        .filter(({ el }) => el && el.value);

    container.innerHTML = "";

    active.forEach(({ filter, el }) => {
        const chip = document.createElement("span");
        chip.className = "pg-chip";
        chip.append(`${filter.label}: ${getClassroomsFilterDisplayValue(el)}`);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${filter.label} filter`);
        remove.innerHTML = '<i class="fas fa-xmark"></i>';
        remove.addEventListener("click", () => {
            el.value = "";
            el.dispatchEvent(new Event("input", { bubbles: true })); // same event the page already listens to
        });

        chip.append(remove);
        container.append(chip);
    });

    const hidden = active.filter(({ filter }) => filter.more).length;
    const badge = document.getElementById("moreFiltersCount");
    if (badge) {
        badge.textContent = hidden;
        badge.classList.toggle("d-none", !hidden);
    }
}

function updateClassroomsFilterBar() {
    renderClassroomsFilterChips();
    if (classroomsFilterBarReady) persistClassroomsFilters();
}

/* Wrap renderAll (declared in ui.js) - see the note in the header. */
(function wrapRenderAll() {
    const original = window.renderAll;
    if (typeof original !== "function") return;

    window.renderAll = function renderAllWithFilterBar() {
        const result = original.apply(this, arguments);
        updateClassroomsFilterBar();
        return result;
    };
})();

/* Called once by classrooms.js after refreshFilterOptions() has filled the
   Floor/Status/Instructor/Feature dropdowns and the first render has
   happened, so saved values can be put back safely. */
function initClassroomsFilterBar() {
    let restored = false;

    CLASSROOMS_FILTERS.forEach(({ id }) => {
        const el = document.getElementById(id);
        const value = savedClassroomsFilters[id];
        if (!el || !value) return;

        // Only restore values that still exist (a floor/instructor/feature may have changed).
        const exists = el.tagName !== "SELECT" || Array.from(el.options).some(opt => opt.value === value);
        if (exists) {
            el.value = value;
            restored = true;
        }
    });

    classroomsFilterBarReady = true;

    // renderAll reads every filter, so one render applies them all.
    if (restored) window.renderAll();
    else updateClassroomsFilterBar();
}
