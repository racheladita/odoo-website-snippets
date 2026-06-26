/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { rpc } from "@web/core/network/rpc";

const escapeHtml = (value) => {
    const element = document.createElement("div");
    element.textContent = value || "";
    return element.innerHTML;
};

publicWidget.registry.RandomRecruitmentJobs = publicWidget.Widget.extend({
    selector: ".s_random_recruitment_jobs",

    async start() {
        await this._super(...arguments);
        this.statusEl = this.el.querySelector(".recruitment-jobs-status");
        this.skeletonEl = this.el.querySelector(".recruitment-jobs-skeleton");
        this.filtersEl = this.el.querySelector(".recruitment-jobs-filters");
        this.gridEl = this.el.querySelector(".recruitment-jobs-grid");
        this.department = "all";
        this.jobsRequestSeq = 0;
        await this._loadJobs();
    },

    async _loadJobs() {
        const requestSeq = ++this.jobsRequestSeq;
        this._showLoading();

        try {
            const result = await rpc("/website_market_snippets/random_jobs", {
                department: this.department,
            });
            if (requestSeq !== this.jobsRequestSeq) {
                return;
            }
            this._renderFilters(result.departments || []);
            const jobs = result.jobs || [];
            if (!jobs.length) {
                this.skeletonEl.classList.add("d-none");
                this._setStatus("No published jobs are available right now.");
                return;
            }
            this._renderJobs(jobs);
        } catch {
            if (requestSeq !== this.jobsRequestSeq) {
                return;
            }
            this.skeletonEl.classList.add("d-none");
            this._setStatus("Open jobs could not be loaded.");
            this.statusEl.classList.add("is-error");
        }
    },

    _renderFilters(departments) {
        const filters = ["all", ...departments];
        this.filtersEl.innerHTML = `
            <label>Department</label>
            <select class="recruitment-jobs-filter">
                ${filters.map((department) => {
                    const isSelected = department === this.department;
                    const label = department === "all" ? "All departments" : department;
                    return `
                        <option value="${escapeHtml(department)}" ${isSelected ? "selected" : ""}>
                            ${escapeHtml(label)}
                        </option>
                    `;
                }).join("")}
            </select>
        `;

        this.filtersEl.querySelector(".recruitment-jobs-filter")
            .addEventListener("change", (event) => this._onFilterChange(event));
    },

    async _onFilterChange(event) {
        const department = event.currentTarget.value || "all";
        if (department === this.department) {
            return;
        }

        this.department = department;
        await this._loadJobs();
    },

    _renderJobs(jobs) {
        this.gridEl.innerHTML = jobs.map((job) => {
            const fullDescription = job.description || "";
            const description = fullDescription.slice(0, 180);
            const badges = [job.department, job.location]
                .filter(Boolean)
                .map((value) => `<span>${escapeHtml(value)}</span>`)
                .join("");

            return `
                <article class="recruitment-job-card">
                    <div>
                        ${badges ? `<div class="recruitment-job-meta">${badges}</div>` : ""}
                        <h3>${escapeHtml(job.name)}</h3>
                        <p>${escapeHtml(description)}${fullDescription.length > 180 ? "..." : ""}</p>
                    </div>
                    <a class="recruitment-job-link" href="${escapeHtml(job.url)}">View role</a>
                </article>
            `;
        }).join("");
        this.skeletonEl.classList.add("d-none");
        this._setStatus("");
    },

    _setStatus(message) {
        this.statusEl.textContent = message;
        this.statusEl.classList.toggle("d-none", !message);
    },

    _showLoading() {
        this.statusEl.classList.remove("is-error");
        this.gridEl.innerHTML = "";
        this.skeletonEl.classList.remove("d-none");
        this._setStatus("Loading open jobs...");
    },
});