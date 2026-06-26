/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { rpc } from "@web/core/network/rpc";

const formatUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatConverterBtc = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
});

const formatConverterUsd = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const rangeLabels = {
    1: "1 day",
    7: "7 days",
    30: "1 month",
    180: "6 months",
    365: "1 year",
};

publicWidget.registry.BitcoinPriceChart = publicWidget.Widget.extend({
    selector: ".s_bitcoin_price_chart",

    async start() {
        await this._super(...arguments);
        this.statusEl = this.el.querySelector(".bitcoin-chart-status");
        this.skeletonEl = this.el.querySelector(".bitcoin-chart-skeleton");
        this.plotEl = this.el.querySelector(".bitcoin-chart-plot");
        this.canvasEl = this.el.querySelector(".bitcoin-chart-canvas");
        this.tooltipEl = this.el.querySelector(".bitcoin-chart-tooltip");
        this.summaryEl = this.el.querySelector(".bitcoin-chart-summary");
        this.latestEl = this.el.querySelector(".bitcoin-chart-latest");
        this.subtitleEl = this.el.querySelector(".bitcoin-chart-subtitle");
        this.changeEl = this.el.querySelector(".bitcoin-chart-change");
        this.statsEl = this.el.querySelector(".bitcoin-chart-stats");
        this.sideEl = this.el.querySelector(".bitcoin-chart-side");
        this.btcInput = this.el.querySelector(".bitcoin-converter-btc");
        this.usdInput = this.el.querySelector(".bitcoin-converter-usd");
        this.converterNoteEl = this.el.querySelector(".converter-note");
        this.highEl = this.el.querySelector(".bitcoin-chart-high");
        this.averageEl = this.el.querySelector(".bitcoin-chart-average");
        this.lowEl = this.el.querySelector(".bitcoin-chart-low");
        this.rangeButtons = [...this.el.querySelectorAll(".bitcoin-chart-range")];
        this.days = Number(this.rangeButtons.find((button) => button.classList.contains("is-active"))?.dataset.days) || 1;
        this.rangeButtons.forEach((button) => {
            button.addEventListener("click", () => this._onRangeClick(button));
        });
        this.btcInput.addEventListener("input", () => this._convertFromBtc());
        this.usdInput.addEventListener("input", () => this._convertFromUsd());
        this.btcInput.addEventListener("blur", () => this._formatBtcInput());
        this.usdInput.addEventListener("blur", () => this._formatUsdInput());
        this.chartRequestSeq = 0;
        await this._loadChart();
    },

    async _loadChart() {
        const requestSeq = ++this.chartRequestSeq;
        this._showLoading();

        try {
            const result = await rpc("/website_market_snippets/bitcoin_history", {
                days: this.days,
            });
            if (requestSeq !== this.chartRequestSeq) {
                return;
            }
            if (result.error) {
                this._showError(result.message);
                return;
            }
            if (!result.prices.length) {
                this.skeletonEl.classList.add("d-none");
                this._setStatus(result.message || "No Bitcoin price data is available.");
                return;
            }
            this._renderChart(result.prices);
        } catch {
            if (requestSeq !== this.chartRequestSeq) {
                return;
            }
            this._showError("Bitcoin price data could not be loaded.");
        }
    },

    async _onRangeClick(button) {
        const days = Number(button.dataset.days) || 1;
        if (days === this.days) {
            return;
        }

        this.days = days;
        this.rangeButtons.forEach((rangeButton) => {
            const isSelected = rangeButton === button;
            rangeButton.classList.toggle("is-active", isSelected);
            rangeButton.setAttribute("aria-pressed", isSelected ? "true" : "false");
        });
        await this._loadChart();
    },

    _renderChart(prices) {
        const width = 760;
        const height = 340;
        const padding = { top: 46, right: 28, bottom: 74, left: 92 };
        const values = prices.flatMap((point) => [point.high, point.low]);
        const closeValues = prices.map((point) => point.close);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        const points = prices.map((point, index) => {
            const x = padding.left + (plotWidth * index) / Math.max(prices.length - 1, 1);
            const yOpen = padding.top + plotHeight - ((point.open - min) / range) * plotHeight;
            const yHigh = padding.top + plotHeight - ((point.high - min) / range) * plotHeight;
            const yLow = padding.top + plotHeight - ((point.low - min) / range) * plotHeight;
            const yClose = padding.top + plotHeight - ((point.close - min) / range) * plotHeight;
            return { ...point, x, yOpen, yHigh, yLow, yClose };
        });

        const first = prices[0].close;
        const latest = prices[prices.length - 1].close;
        const change = latest - first;
        const changePercent = first ? (change / first) * 100 : 0;
        const changePrefix = change >= 0 ? "+" : "";
        const average = closeValues.reduce((total, value) => total + value, 0) / closeValues.length;
        const candleWidth = Math.max(Math.min(plotWidth / Math.max(points.length, 1) * 0.55, 12), 3);

        this.latestEl.textContent = `Latest ${formatUsd.format(latest)}`;
        this.subtitleEl.textContent = `${rangeLabels[this.days] || "Selected"} close price movement`;
        this.changeEl.textContent = `${changePrefix}${formatUsd.format(change)} (${changePrefix}${changePercent.toFixed(2)}%)`;
        this.changeEl.classList.toggle("is-positive", change >= 0);
        this.changeEl.classList.toggle("is-negative", change < 0);
        this.highEl.textContent = formatUsd.format(max);
        this.averageEl.textContent = formatUsd.format(average);
        this.lowEl.textContent = formatUsd.format(min);
        this.latestPrice = latest;
        this.converterNoteEl.innerHTML = `
            Based on the latest available close<br>
            Updated at ${this._formatUpdatedAt(prices[prices.length - 1].date)} - Yahoo Finance
        `;
        this._convertFromBtc();
        this._formatBtcInput();
        this.summaryEl.classList.remove("d-none");
        this.statsEl.classList.remove("d-none");
        this.sideEl.classList.remove("d-none");
        this.skeletonEl.classList.add("d-none");

        const yTicks = Array.from({ length: 5 }, (_, index) => max - (range * index) / 4);
        const xTickLength = Math.min(7, points.length);
        const xTicks = Array.from({ length: xTickLength }, (_, index) => {
            const pointIndex = Math.round((index * (points.length - 1)) / Math.max(xTickLength - 1, 1));
            return points[pointIndex];
        });
        const candles = points.map((point) => {
            const isPositive = point.close >= point.open;
            const bodyTop = Math.min(point.yOpen, point.yClose);
            const bodyHeight = Math.max(Math.abs(point.yClose - point.yOpen), 2);
            return `
                <g class="bitcoin-chart-candle ${isPositive ? "is-positive" : "is-negative"}">
                    <line x1="${point.x}" x2="${point.x}" y1="${point.yHigh}" y2="${point.yLow}"/>
                    <rect x="${point.x - candleWidth / 2}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" rx="1"/>
                </g>
            `;
        }).join("");
        const hitRadius = Math.max(candleWidth, 6);
        const hitAreas = points.map((point) => `
            <circle class="bitcoin-chart-hit-area"
                    cx="${point.x}"
                    cy="${point.yClose}"
                    r="${hitRadius}"
                    data-label="${point.label}"
                    data-open="${point.open}"
                    data-high="${point.high}"
                    data-low="${point.low}"
                    data-close="${point.close}"
                    data-x="${point.x}"
                    data-y="${point.yClose}"/>
        `).join("");

        this.canvasEl.innerHTML = `
            <svg class="bitcoin-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Bitcoin USD ${rangeLabels[this.days] || "selected range"} price history">
                <text class="bitcoin-chart-axis-title" x="15" y="20" text-anchor="start">Price USD</text>
                <text class="bitcoin-chart-axis-title" x="${padding.left + plotWidth / 2}" y="${height - 8}" text-anchor="middle">Time</text>
                ${yTicks.map((tick) => {
                    const y = padding.top + plotHeight - ((tick - min) / range) * plotHeight;
                    return `
                        <line class="bitcoin-chart-grid" x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}"/>
                        <text class="bitcoin-chart-axis" x="${padding.left - 16}" y="${y + 4}" text-anchor="end">${formatUsd.format(tick)}</text>
                    `;
                }).join("")}
                ${candles}
                ${hitAreas}
                ${xTicks.map((point) => `
                    <text class="bitcoin-chart-axis" x="${point.x}" y="${height - 34}" text-anchor="middle">${point.label}</text>
                `).join("")}
            </svg>
        `;
        this._bindTooltip();

        this._setStatus("");
    },

    _bindTooltip() {
        const hitAreas = this.canvasEl.querySelectorAll(".bitcoin-chart-hit-area");
        hitAreas.forEach((hitArea) => {
            hitArea.addEventListener("mouseenter", () => this._showTooltip(hitArea));
            hitArea.addEventListener("focus", () => this._showTooltip(hitArea));
            hitArea.addEventListener("mouseleave", () => this._hideTooltip());
            hitArea.addEventListener("blur", () => this._hideTooltip());
            hitArea.addEventListener("click", () => this._showTooltip(hitArea));
            hitArea.setAttribute("tabindex", "0");
            hitArea.setAttribute("role", "button");
            hitArea.setAttribute(
                "aria-label",
                `${hitArea.dataset.label}: close ${formatUsd.format(Number(hitArea.dataset.close))}`
            );
        });
    },

    _showTooltip(hitArea) {
        const open = Number(hitArea.dataset.open);
        const high = Number(hitArea.dataset.high);
        const low = Number(hitArea.dataset.low);
        const close = Number(hitArea.dataset.close);
        const x = Number(hitArea.dataset.x);
        const y = Number(hitArea.dataset.y);
        const svg = this.canvasEl.querySelector(".bitcoin-chart-svg");
        const panelRect = this.plotEl.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const left = svgRect.left - panelRect.left + (x / 760) * svgRect.width;
        const top = svgRect.top - panelRect.top + (y / 340) * svgRect.height;

        this.tooltipEl.innerHTML = `
            <span>${hitArea.dataset.label}</span>
            <strong>Close ${formatUsd.format(close)}</strong>
            <small>O ${formatUsd.format(open)} | H ${formatUsd.format(high)} | L ${formatUsd.format(low)}</small>
        `;
        this.tooltipEl.style.left = `${left}px`;
        this.tooltipEl.style.top = `${top}px`;
        this.tooltipEl.classList.add("is-visible");
    },

    _hideTooltip() {
        this.tooltipEl.classList.remove("is-visible");
    },

    _convertFromBtc() {
        if (!this.latestPrice) {
            return;
        }
        const btcValue = this._parseNumber(this.btcInput.value);
        this.usdInput.value = formatConverterUsd.format(btcValue * this.latestPrice);
    },

    _convertFromUsd() {
        if (!this.latestPrice) {
            return;
        }
        const usdValue = this._parseNumber(this.usdInput.value);
        this.btcInput.value = formatConverterBtc.format(usdValue / this.latestPrice);
    },

    _formatBtcInput() {
        this.btcInput.value = formatConverterBtc.format(this._parseNumber(this.btcInput.value));
    },

    _formatUsdInput() {
        this.usdInput.value = formatConverterUsd.format(this._parseNumber(this.usdInput.value));
    },

    _parseNumber(value) {
        return Number(String(value).replace(/,/g, "")) || 0;
    },

    _formatUpdatedAt(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "latest refresh";
        }
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    },

    _setStatus(message) {
        this.statusEl.textContent = message;
        this.statusEl.classList.toggle("d-none", !message);
    },

    _showLoading() {
        this.statusEl.classList.remove("is-error");
        this._setStatus("Loading Bitcoin price data...");
        this.skeletonEl.classList.remove("d-none");
        this.summaryEl.classList.add("d-none");
        this.statsEl.classList.add("d-none");
        this.sideEl.classList.add("d-none");
        this.canvasEl.innerHTML = "";
        this._hideTooltip();
    },

    _showError(message) {
        this.summaryEl.classList.add("d-none");
        this.statsEl.classList.add("d-none");
        this.sideEl.classList.add("d-none");
        this.skeletonEl.classList.add("d-none");
        this.canvasEl.innerHTML = "";
        this._hideTooltip();
        this._setStatus(message);
        this.statusEl.classList.add("is-error");
    },
});