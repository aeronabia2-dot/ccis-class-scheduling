/** Activity Log page. **/
"use strict";

(() => {
    const API_URL = "../api/activity_log.php";
    const PAGE_SIZE = 25;

    let page = 1;
    let total = 0;
    let debounceTimer = null;

    const MODULE_LABELS = {
        auth: "Login / Logout",
        users: "User Management",
        classrooms: "Rooms",
        instructors: "Instructors",
        subjects: "Subjects",
        curriculum: "Curriculum",
        class_sections: "Sections",
        schedules: "Scheduling",
        schedule_archives: "Archives",
        teaching_load: "Summary of Load",
        saturday_eligibility: "Saturday Eligibility"
    };

    const ACTION_BADGES = {
        create: "bg-success-subtle text-success",
        update: "bg-info-subtle text-info",
        delete: "bg-danger-subtle text-danger",
        import: "bg-primary-subtle text-primary",
        archive: "bg-secondary-subtle text-secondary",
        restore: "bg-warning-subtle text-warning",
        login: "bg-success-subtle text-success",
        logout: "bg-secondary-subtle text-secondary"
    };

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("btnRefreshLog")?.addEventListener("click", () => loadLog());
        document.getElementById("btnPrevPage")?.addEventListener("click", () => { if (page > 1) { page--; loadLog(); } });
        document.getElementById("btnNextPage")?.addEventListener("click", () => { if (page * PAGE_SIZE < total) { page++; loadLog(); } });
        document.getElementById("btnClearFilters")?.addEventListener("click", clearFilters);

        document.getElementById("filterModule")?.addEventListener("change", () => { page = 1; loadLog(); });
        document.getElementById("filterActionType")?.addEventListener("change", () => { page = 1; loadLog(); });
        document.getElementById("filterDateFrom")?.addEventListener("change", () => { page = 1; loadLog(); });
        document.getElementById("filterDateTo")?.addEventListener("change", () => { page = 1; loadLog(); });
        document.getElementById("filterSearch")?.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => { page = 1; loadLog(); }, 350);
        });

        loadLog();
    });

    function showToast(message, type = "success") {
        // One shared implementation (js/core/notify.js) so every page shows
        // the same high-contrast, correctly-iconed notification.
        window.CCISNotify.toast(message, type);
    }

    function buildQuery() {
        const params = new URLSearchParams();
        params.set("page", page);
        params.set("limit", PAGE_SIZE);

        const module = document.getElementById("filterModule")?.value || "";
        const actionType = document.getElementById("filterActionType")?.value || "";
        const dateFrom = document.getElementById("filterDateFrom")?.value || "";
        const dateTo = document.getElementById("filterDateTo")?.value || "";
        const search = document.getElementById("filterSearch")?.value.trim() || "";

        if (module) params.set("module", module);
        if (actionType) params.set("action_type", actionType);
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
        if (search) params.set("search", search);

        renderChips({ module, actionType, dateFrom, dateTo, search });

        return params.toString();
    }

    function renderChips({ module, actionType, dateFrom, dateTo, search }) {
        const chipsEl = document.getElementById("activeFilterChips");
        const clearBtn = document.getElementById("btnClearFilters");
        if (!chipsEl) return;

        const chips = [];
        if (module) chips.push(MODULE_LABELS[module] || module);
        if (actionType) chips.push(capitalize(actionType));
        if (dateFrom) chips.push(`From ${dateFrom}`);
        if (dateTo) chips.push(`To ${dateTo}`);
        if (search) chips.push(`"${search}"`);

        chipsEl.innerHTML = chips.map(c => `<span class="badge bg-light text-dark border">${escapeHtml(c)}</span>`).join("");
        clearBtn?.classList.toggle("d-none", chips.length === 0);
    }

    function clearFilters() {
        document.getElementById("filterModule").value = "";
        document.getElementById("filterActionType").value = "";
        document.getElementById("filterDateFrom").value = "";
        document.getElementById("filterDateTo").value = "";
        document.getElementById("filterSearch").value = "";
        page = 1;
        loadLog();
    }

    async function loadLog() {
        const tbody = document.getElementById("logTableBody");
        const restricted = document.getElementById("accessRestricted");
        const migrationNeeded = document.getElementById("migrationNeeded");
        const content = document.getElementById("logContent");

        try {
            const response = await fetch(`${API_URL}?${buildQuery()}`, { headers: { "Accept": "application/json" } });
            const result = await response.json();

            if (response.status === 403) {
                restricted?.classList.remove("d-none");
                content?.classList.add("d-none");
                migrationNeeded?.classList.add("d-none");
                return;
            }
            restricted?.classList.add("d-none");

            if (!response.ok) throw new Error(result?.message || `HTTP ${response.status}`);

            if (result.migration_needed) {
                migrationNeeded?.classList.remove("d-none");
                content?.classList.add("d-none");
                return;
            }
            migrationNeeded?.classList.add("d-none");
            content?.classList.remove("d-none");

            const logs = Array.isArray(result.data) ? result.data : [];
            total = Number(result.total ?? logs.length);

            renderTable(logs);
            renderPageInfo(logs.length);
        } catch (error) {
            console.error("Failed to load activity log:", error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Could not load the activity log. Please refresh the page.</td></tr>`;
        }
    }

    function renderTable(logs) {
        const tbody = document.getElementById("logTableBody");
        const countEl = document.getElementById("logResultCount");
        if (!tbody) return;

        if (countEl) countEl.textContent = total === 1 ? "1 entry" : `${total} entries`;

        if (!logs.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No activity found for these filters.</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td class="text-nowrap">${escapeHtml(formatWhen(log.created_at))}</td>
                <td>
                    <div class="fw-semibold">${escapeHtml(log.full_name || log.username || "—")}</div>
                    <div class="small text-muted">${escapeHtml(capitalize(log.role || ""))}</div>
                </td>
                <td><span class="badge bg-light text-dark border">${escapeHtml(MODULE_LABELS[log.module] || log.module)}</span></td>
                <td><span class="badge ${ACTION_BADGES[log.action] || "bg-light text-dark border"}">${escapeHtml(capitalize(log.action))}</span></td>
                <td>${escapeHtml(log.description)}</td>
            </tr>
        `).join("");
    }

    function renderPageInfo(count) {
        const info = document.getElementById("logPageInfo");
        const prevBtn = document.getElementById("btnPrevPage");
        const nextBtn = document.getElementById("btnNextPage");
        if (!info) return;

        const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
        const end = (page - 1) * PAGE_SIZE + count;
        info.textContent = total === 0 ? "No results" : `Showing ${start}–${end} of ${total}`;

        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page * PAGE_SIZE >= total;
    }

    function formatWhen(value) {
        if (!value) return "—";
        const date = new Date(value.replace(" ", "T"));
        if (isNaN(date.getTime())) return value;
        return date.toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit"
        });
    }

    function capitalize(value) {
        const str = String(value || "");
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
})();
