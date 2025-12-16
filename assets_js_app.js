// Markets single-page app
// Requires config.js that defines: window.FMP_API_KEY = 'YOUR_KEY';

// Default, editable mapping of sector/factor to tickers (you can change these in config.js or in this file)
const DEFAULT_SECTORS = [
  { name: "Technology", ticker: "XLK" },
  { name: "Financials", ticker: "XLF" },
  { name: "Health Care", ticker: "XLV" },
  { name: "Energy", ticker: "XLE" },
  { name: "Materials", ticker: "XLB" },
  { name: "Industrials", ticker: "XLI" },
  { name: "Consumer Discretionary", ticker: "XLY" },
  { name: "Consumer Staples", ticker: "XLP" },
  { name: "Utilities", ticker: "XLU" },
  { name: "Real Estate", ticker: "XLRE" },
  { name: "Communication Services", ticker: "XLC" },
  // Detailed / commodities
  { name: "Gold", ticker: "GLD" },
  { name: "Silver", ticker: "SLV" },
  { name: "Metals (miners)", ticker: "GDX" },
  { name: "Broad Commodities", ticker: "DBC" }
];

const DEFAULT_FACTORS = [
  { name: "Value (ETF)", ticker: "VLUE" },
  { name: "Momentum (ETF)", ticker: "MTUM" },
  { name: "Quality (ETF)", ticker: "QUAL" },
  { name: "Size (Small)", ticker: "IWM" },
  { name: "Low Volatility", ticker: "USMV" },
  { name: "Growth", ticker: "VUG" }
];

// Which lookbacks (trading days) to compute
const LOOKBACKS = [
  { key: "1d", days: 1, label: "1 Day" },
  { key: "1w", days: 5, label: "1 Week" },
  { key: "1m", days: 21, label: "1 Month" },
  { key: "1y", days: 252, label: "1 Year" }
];

// global DOM refs
const statusEl = document.getElementById("status");
const gridEl = document.getElementById("grid");
const viewSelector = document.getElementById("viewSelector");
const refreshBtn = document.getElementById("refreshBtn");

// Use config-provided lists if present
const SECTORS = (window.MARKETS && window.MARKETS.sectors) || DEFAULT_SECTORS;
const FACTORS = (window.MARKETS && window.MARKETS.factors) || DEFAULT_FACTORS;
const API_KEY = (window.FMP_API_KEY && window.FMP_API_KEY.trim()) || null;

if (!API_KEY || API_KEY === "YOUR_FMP_API_KEY") {
  statusEl.textContent = "Please add your FMP API key to config.js (see config.example.js).";
}

viewSelector.addEventListener("change", () => {
  render();
});

refreshBtn.addEventListener("click", () => {
  render(true);
});

async function render(forceRefresh = false) {
  const view = viewSelector.value;
  const list = view === "factors" ? FACTORS : SECTORS;
  gridEl.innerHTML = "";
  statusEl.textContent = "Fetching data…";

  try {
    // fetch all tickers in parallel (throttling is minimal - FMP free key limits apply)
    const results = await Promise.allSettled(list.map(item => fetchTickerPerf(item.ticker, forceRefresh)));

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const res = results[i];
      if (res.status === "fulfilled") {
        gridEl.appendChild(cardFor(item.name, item.ticker, res.value));
      } else {
        gridEl.appendChild(cardError(item.name, item.ticker, res.reason));
      }
    }
    statusEl.textContent = `Updated: ${new Date().toLocaleString()}`;
  } catch (err) {
    statusEl.textContent = `Error: ${err.message || err}`;
  }
}

// Fetch historical prices and compute percent changes for the lookbacks.
// Uses FMP endpoint: /api/v3/historical-price-full/{ticker}?timeseries=400&apikey=KEY
async function fetchTickerPerf(ticker /*string*/, force = false) {
  if (!API_KEY) throw new Error("No API key configured");
  const timeseries = 400;
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(ticker)}?timeseries=${timeseries}&apikey=${API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${ticker}`);
  const data = await resp.json();
  const hist = data.historical;
  if (!hist || !hist.length) throw new Error(`No historical data for ${ticker}`);
  // hist[0] is most recent close
  const latest = hist[0].close;
  const values = {};
  for (const { key, days } of LOOKBACKS) {
    const idx = days; // index to compare: days trading days ago
    const idxSafe = Math.min(idx, hist.length - 1);
    const old = hist[idxSafe].close;
    const pct = ((latest - old) / old) * 100;
    values[key] = Number(pct.toFixed(2));
  }
  return {
    latest,
    values,
    lastDate: hist[0].date
  };
}

function cardFor(name, ticker, perf) {
  const card = document.createElement("article");
  card.className = "card";
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("div");
  title.innerHTML = `<div class="title">${escapeHtml(name)}</div><div class="ticker">${escapeHtml(ticker)}</div>`;
  head.appendChild(title);
  const date = document.createElement("div");
  date.style.fontSize = "0.8rem";
  date.style.color = "var(--muted)";
  date.textContent = perf.lastDate || "";
  head.appendChild(date);
  card.appendChild(head);

  const metrics = document.createElement("div");
  metrics.className = "metrics";

  for (const lb of LOOKBACKS) {
    const block = document.createElement("div");
    block.className = "metric";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = lb.label;
    const value = document.createElement("div");
    value.className = "value";
    const v = perf.values[lb.key];
    value.textContent = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
    value.classList.add(v >= 0 ? "positive" : "negative");
    block.appendChild(label);
    block.appendChild(value);
    metrics.appendChild(block);
  }

  card.appendChild(metrics);
  return card;
}

function cardError(name, ticker, reason) {
  const card = document.createElement("article");
  card.className = "card";
  const head = document.createElement("div");
  head.className = "head";
  head.innerHTML = `<div class="title">${escapeHtml(name)}</div><div class="ticker">${escapeHtml(ticker)}</div>`;
  card.appendChild(head);
  const err = document.createElement("div");
  err.style.color = "var(--muted)";
  err.style.fontSize = "0.9rem";
  err.textContent = `Error: ${reason && reason.message ? reason.message : reason}`;
  card.appendChild(err);
  return card;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];});
}

// initial render
render();