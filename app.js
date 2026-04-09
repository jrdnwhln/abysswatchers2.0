const STORAGE_KEY = "abyss-watchers-state";
const IDENTITY_KEY = `${STORAGE_KEY}-identity`;
const DEFAULT_STATE = {
  activeTopic: "AI research",
  activeCryptoTab: "board",
  activeResearchTab: "latest",
  watchlist: ["bitcoin", "ethereum", "solana"],
  notes: "",
  customQuery: "",
  radio: {
    decision: "unset",
    enabled: false,
    lastInput: "",
    lastSearch: "Lil Poppa official video"
  }
};

const TOPICS = [
  "AI research",
  "Biotech",
  "Climate tech",
  "Quantum networks",
  "Neuroscience",
  "Materials science"
];

const DEFAULT_RADIO_STATION = {
  name: "Lil Poppa + Luhh Dyl starter station",
  leadVideoId: "Y3W86LVWmP8",
  playlistVideoIds: ["Y3W86LVWmP8", "VhdsCKHXRPU"]
};

const els = {
  abyssStage: document.querySelector("#abyssStage"),
  statusMessage: document.querySelector("#statusMessage"),
  activeTopicLabel: document.querySelector("#activeTopicLabel"),
  watchlistCount: document.querySelector("#watchlistCount"),
  nodeFingerprint: document.querySelector("#nodeFingerprint"),
  packTrustStatus: document.querySelector("#packTrustStatus"),
  nodeNotes: document.querySelector("#nodeNotes"),
  scienceQuery: document.querySelector("#scienceQuery"),
  topicChips: document.querySelector("#topicChips"),
  marketTableBody: document.querySelector("#marketTableBody"),
  marketInsights: document.querySelector("#marketInsights"),
  paperFeed: document.querySelector("#paperFeed"),
  watchlist: document.querySelector("#watchlist"),
  summaryPanel: document.querySelector("#summaryPanel"),
  globalMarketCap: document.querySelector("#globalMarketCap"),
  globalVolume: document.querySelector("#globalVolume"),
  btcDominance: document.querySelector("#btcDominance"),
  paperCount: document.querySelector("#paperCount"),
  marketCapChange: document.querySelector("#marketCapChange"),
  assetInput: document.querySelector("#assetInput"),
  importPack: document.querySelector("#importPack"),
  refreshAll: document.querySelector("#refreshAll"),
  sharePack: document.querySelector("#sharePack"),
  runResearchSearch: document.querySelector("#runResearchSearch"),
  addAsset: document.querySelector("#addAsset"),
  topicChipTemplate: document.querySelector("#topicChipTemplate"),
  radioConsentPanel: document.querySelector("#radioConsentPanel"),
  radioControls: document.querySelector("#radioControls"),
  acceptRadio: document.querySelector("#acceptRadio"),
  declineRadio: document.querySelector("#declineRadio"),
  radioInput: document.querySelector("#radioInput"),
  loadRadio: document.querySelector("#loadRadio"),
  stopRadio: document.querySelector("#stopRadio"),
  openYoutubeSearch: document.querySelector("#openYoutubeSearch"),
  radioStatus: document.querySelector("#radioStatus"),
  radioPlayerShell: document.querySelector("#radioPlayerShell"),
  radioPlayer: document.querySelector("#radioPlayer")
};

let state = loadState();
let latestMarket = [];
let latestPapers = [];
const researchCache = {
  latest: [],
  reviews: [],
  clinical: []
};
const previewCache = {};
let nodeIdentity = null;

initialize();

async function initialize() {
  nodeIdentity = await ensureNodeIdentity();
  applyStateToUi();
  renderTopicChips();
  bindEvents();
  bindSceneMotion();
  await refreshAllData();
  if (state.radio.enabled && state.radio.lastInput) {
    loadRadioFromInput(state.radio.lastInput, false);
  } else if (state.radio.enabled) {
    loadDefaultRadio(false);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      setStatus("Offline shell unavailable, but the node is still running locally.");
    });
  }
}

function loadState() {
  const urlState = readStateFromHash();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const localState = stored ? JSON.parse(stored) : {};
    return normalizeState({
      ...localState,
      ...(urlState ?? {})
    });
  } catch {
    return normalizeState(urlState ?? {});
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  writeStateToHash();
  applyStateToUi();
}

function applyStateToUi() {
  els.activeTopicLabel.textContent = state.activeTopic;
  els.watchlistCount.textContent = String(state.watchlist.length);
  els.nodeFingerprint.textContent = nodeIdentity?.fingerprint || "Unavailable";
  els.nodeNotes.value = state.notes;
  els.scienceQuery.value = state.customQuery || state.activeTopic;
  els.radioInput.value = state.radio.lastInput;
  renderSectionTabs();
  renderWatchlist();
  renderRadioState();
  renderPackTrust();
}

function bindEvents() {
  els.refreshAll.addEventListener("click", () => refreshAllData());
  els.runResearchSearch.addEventListener("click", async () => {
    state.customQuery = els.scienceQuery.value.trim() || state.activeTopic;
    saveState();
    await refreshResearch();
  });
  els.addAsset.addEventListener("click", async () => {
    const asset = sanitizeAsset(els.assetInput.value);
    if (!asset) {
      setStatus("Add a crypto asset slug like bitcoin, ethereum, or solana.");
      return;
    }

    if (!state.watchlist.includes(asset)) {
      state.watchlist = [...state.watchlist, asset];
      els.assetInput.value = "";
      saveState();
      await refreshMarkets();
    }
  });
  els.nodeNotes.addEventListener("input", (event) => {
    state.notes = event.target.value;
    saveState();
  });
  els.sharePack.addEventListener("click", async () => {
    await exportSignalPack();
  });
  els.importPack.addEventListener("change", importSignalPack);
  els.acceptRadio.addEventListener("click", () => {
    state.radio.decision = "accepted";
    state.radio.enabled = true;
    state.radio.lastInput = "";
    state.radio.lastSearch = DEFAULT_RADIO_STATION.name;
    saveState();
    loadDefaultRadio(true);
  });
  els.declineRadio.addEventListener("click", () => {
    state.radio.decision = "declined";
    state.radio.enabled = false;
    saveState();
    setRadioStatus("Radio declined. The site will stay silent unless you accept later.");
  });
  els.loadRadio.addEventListener("click", () => {
    const input = els.radioInput.value.trim();
    state.radio.lastInput = input;
    state.radio.decision = "accepted";
    state.radio.enabled = true;
    saveState();
    loadRadioFromInput(input, true);
  });
  els.stopRadio.addEventListener("click", () => {
    stopRadio();
    setRadioStatus("Radio stopped.");
  });
  els.openYoutubeSearch.addEventListener("click", () => {
    const search = encodeURIComponent(state.radio.lastSearch || DEFAULT_RADIO_STATION.name);
    window.open(`https://www.youtube.com/results?search_query=${search}`, "_blank", "noopener");
  });
  document.querySelectorAll("[data-radio-fill]").forEach((button) => {
    button.addEventListener("click", () => {
      const fillValue = button.getAttribute("data-radio-fill") || "";
      state.radio.lastSearch = fillValue;
      saveState();
      setRadioStatus(`Search prepared for ${fillValue}. Use Search On YouTube, then paste a playlist or video link here.`);
    });
  });
  document.querySelectorAll("[data-tab-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      const group = button.getAttribute("data-tab-group");
      const tabId = button.getAttribute("data-tab-id");
      if (!group || !tabId) {
        return;
      }

      if (group === "crypto") {
        state.activeCryptoTab = tabId;
        saveState();
        renderSectionTabs();
        renderMarketInsights();
        return;
      }

      if (group === "research") {
        state.activeResearchTab = tabId;
        saveState();
        renderSectionTabs();
        await refreshResearch();
      }
    });
  });
}

function renderTopicChips() {
  els.topicChips.innerHTML = "";

  TOPICS.forEach((topic) => {
    const chip = els.topicChipTemplate.content.firstElementChild.cloneNode(true);
    chip.textContent = topic;
    chip.setAttribute("aria-selected", String(topic === state.activeTopic));
    chip.addEventListener("click", async () => {
      state.activeTopic = topic;
      state.customQuery = topic;
      saveState();
      renderTopicChips();
      await refreshResearch();
    });
    els.topicChips.appendChild(chip);
  });
}

async function refreshAllData() {
  setStatus("Refreshing crypto feed and research stream...");
  await Promise.all([refreshMarkets(), refreshResearch()]);
  renderSummary();
}

async function refreshMarkets() {
  const watchlist = state.watchlist.length ? state.watchlist : DEFAULT_STATE.watchlist;
  try {
    const [globalResponse, marketsResponse] = await Promise.all([
      fetchJson("https://api.coingecko.com/api/v3/global"),
      fetchJson(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(watchlist.join(","))}&order=market_cap_desc&per_page=12&page=1&sparkline=false&price_change_percentage=24h`
      )
    ]);

    latestMarket = Array.isArray(marketsResponse) ? marketsResponse : [];
    renderGlobalMetrics(globalResponse?.data);
    renderMarketTable();
    renderWatchlist();
    renderMarketInsights();
    renderSummary();
    setStatus("Crypto mesh updated from CoinGecko.");
    cacheSnapshot("globalSnapshot", globalResponse?.data ?? {});
    cacheSnapshot("marketSnapshot", latestMarket);
  } catch {
    renderGlobalMetrics(readSnapshot("globalSnapshot", {}));
    latestMarket = readSnapshot("marketSnapshot");
    renderMarketTable();
    renderWatchlist();
    renderMarketInsights();
    renderSummary();
    setStatus("Live market feed is unavailable, showing the latest cached market snapshot.");
  }
}

async function refreshResearch() {
  const query = state.customQuery || state.activeTopic;
  const tab = state.activeResearchTab;
  const term = buildPubMedQuery(query, tab);
  const searchEndpoint =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" +
    new URLSearchParams({
      db: "pubmed",
      retmode: "json",
      retmax: "8",
      sort: "pub+date",
      tool: "abyss_watchers_signal_mesh",
      term
    });

  try {
    const searchResponse = await fetchJson(searchEndpoint);
    const ids = searchResponse?.esearchresult?.idlist ?? [];
    if (!ids.length) {
      latestPapers = [];
      researchCache[tab] = [];
      renderPaperFeed();
      renderSummary();
      setStatus(`No NCBI records found for the ${tab} research tab.`);
      cacheSnapshot(`paperSnapshot-${tab}`, []);
      return;
    }

    const summaryEndpoint =
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?" +
      new URLSearchParams({
        db: "pubmed",
        retmode: "json",
        tool: "abyss_watchers_signal_mesh",
        id: ids.join(",")
      });
    const summaryResponse = await fetchJson(summaryEndpoint);
    latestPapers = mapPubMedSummaries(ids, summaryResponse);
    researchCache[tab] = latestPapers;
    renderPaperFeed();
    renderSummary();
    setStatus(`Research radar updated from NCBI PubMed (${tab} tab).`);
    cacheSnapshot(`paperSnapshot-${tab}`, latestPapers);
  } catch {
    latestPapers = researchCache[tab].length
      ? researchCache[tab]
      : readSnapshot(`paperSnapshot-${tab}`);
    renderPaperFeed();
    renderSummary();
    setStatus(`Live NCBI research search is unavailable, showing the latest cached ${tab} snapshot.`);
  }
}

function renderGlobalMetrics(data) {
  if (!data) {
    return;
  }

  els.globalMarketCap.textContent = currency(data.total_market_cap?.usd);
  els.globalVolume.textContent = currency(data.total_volume?.usd);
  els.btcDominance.textContent = percent(data.market_cap_percentage?.btc);

  const change = data.market_cap_change_percentage_24h_usd ?? 0;
  els.marketCapChange.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}% over 24h`;
  els.marketCapChange.className = `market-sentiment ${change >= 0 ? "positive" : "negative"}`;
}

function renderMarketTable() {
  if (!latestMarket.length) {
    els.marketTableBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No market data yet. Try refreshing the mesh.</div></td></tr>`;
    return;
  }

  els.marketTableBody.innerHTML = latestMarket
    .map((asset) => {
      const change = Number(asset.price_change_percentage_24h_in_currency ?? 0);
      return `
        <tr>
          <td>
            <div class="asset-cell">
              <img class="asset-icon" src="${asset.image}" alt="${asset.name} logo" />
              <div>
                <strong>${asset.name}</strong>
                <div class="subtle-copy">${asset.symbol.toUpperCase()}</div>
              </div>
            </div>
          </td>
          <td>${currency(asset.current_price)}</td>
          <td class="${change >= 0 ? "change-up" : "change-down"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</td>
          <td>${compactCurrency(asset.market_cap)}</td>
          <td>${compactCurrency(asset.total_volume)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderPaperFeed() {
  els.paperCount.textContent = String(latestPapers.length);

  if (!latestPapers.length) {
    els.paperFeed.innerHTML = `<div class="empty-state">No NCBI records yet for this tab. Try another topic or refresh again.</div>`;
    return;
  }

  els.paperFeed.innerHTML = latestPapers
    .map((paper) => {
      const title = paper.title || "Untitled article";
      const journal = paper.journal || "Journal unavailable";
      const published = paper.pubdate || "Date unavailable";
      const authors = (paper.authors || []).slice(0, 3).join(", ");
      const kind = paper.pubtype || "PubMed record";
      const badge = buildJournalBadge(journal);
      const preview = previewCache[paper.id];
      const previewMarkup = preview
        ? `<div class="paper-preview">
            <p>${escapeHtml(preview.abstractText)}</p>
            <p class="paper-meta">${escapeHtml(preview.citation)}</p>
          </div>`
        : "";

      return `
        <article class="paper-card">
          <div class="paper-card-top">
            <div class="paper-badge">${escapeHtml(badge)}</div>
            <div>
              <p class="paper-meta">${escapeHtml(published)} | ${escapeHtml(journal)}</p>
              <h3>${escapeHtml(title)}</h3>
            </div>
          </div>
          <p class="paper-meta">${escapeHtml(kind)} | ${escapeHtml(authors || "Author list unavailable")}</p>
          <div class="paper-actions">
            <button type="button" class="ghost-button paper-preview-button" data-preview-id="${paper.id}">
              Quick Preview
            </button>
            <a href="https://pubmed.ncbi.nlm.nih.gov/${paper.id}/" target="_blank" rel="noreferrer">Open NCBI record</a>
          </div>
          ${previewMarkup}
        </article>
      `;
    })
    .join("");

  els.paperFeed.querySelectorAll("[data-preview-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const paperId = button.getAttribute("data-preview-id");
      if (!paperId) {
        return;
      }

      if (!previewCache[paperId]) {
        previewCache[paperId] = {
          abstractText: "Loading preview...",
          citation: "Fetching NCBI abstract..."
        };
        renderPaperFeed();
      }

      const preview = await fetchPubMedPreview(paperId);
      previewCache[paperId] = preview;
      renderPaperFeed();
    });
  });
}

function buildPubMedQuery(query, tab) {
  const baseQuery = `${query} AND journal article[Publication Type]`;
  if (tab === "reviews") {
    return `${query} AND review[Publication Type]`;
  }

  if (tab === "clinical") {
    return `${query} AND (clinical trial[Publication Type] OR randomized controlled trial[Publication Type])`;
  }

  return baseQuery;
}

function mapPubMedSummaries(ids, summaryResponse) {
  const result = summaryResponse?.result ?? {};
  return ids
    .map((id) => result[id])
    .filter(Boolean)
    .map((record) => ({
      id: record.uid,
      title: record.title,
      journal: record.fulljournalname || record.source || "NCBI",
      pubdate: record.pubdate,
      authors: Array.isArray(record.authors) ? record.authors.map((author) => author.name).filter(Boolean) : [],
      pubtype: Array.isArray(record.pubtype) && record.pubtype.length ? record.pubtype[0] : "PubMed record"
    }));
}

async function fetchPubMedPreview(id) {
  try {
    const endpoint =
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" +
      new URLSearchParams({
        db: "pubmed",
        retmode: "xml",
        tool: "abyss_watchers_signal_mesh",
        id
      });
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
    const abstractParts = Array.from(xml.querySelectorAll("AbstractText"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    const articleTitle = xml.querySelector("ArticleTitle")?.textContent?.trim() || "PubMed article";
    const journal = xml.querySelector("Journal > Title")?.textContent?.trim() || "NCBI";
    const pubDate = xml.querySelector("PubDate Year")?.textContent?.trim() || "";

    return {
      abstractText: abstractParts.length
        ? abstractParts.join(" ")
        : "No abstract preview is available for this PubMed record.",
      citation: [articleTitle, journal, pubDate].filter(Boolean).join(" | ")
    };
  } catch {
    return {
      abstractText: "Preview unavailable right now. Open the NCBI record for the full article page.",
      citation: `PubMed ID ${id}`
    };
  }
}

function buildJournalBadge(journal) {
  return journal
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "NC";
}

function renderWatchlist() {
  if (!state.watchlist.length) {
    els.watchlist.innerHTML = `<div class="empty-state">Add a few assets to start tracking your local signal mesh.</div>`;
    return;
  }

  els.watchlist.innerHTML = state.watchlist
    .map((assetId) => {
      const match = latestMarket.find((asset) => asset.id === assetId);
      const headline = match
        ? `${currency(match.current_price)} | ${signedPercent(match.price_change_percentage_24h_in_currency)}`
        : "Waiting for market data...";

      return `
        <article class="watchlist-item">
          <div>
            <h3>${formatAssetLabel(assetId)}</h3>
            <p>${headline}</p>
          </div>
          <button type="button" data-remove="${assetId}">Remove</button>
        </article>
      `;
    })
    .join("");

  els.watchlist.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const assetId = button.getAttribute("data-remove");
      state.watchlist = state.watchlist.filter((asset) => asset !== assetId);
      saveState();
      await refreshMarkets();
    });
  });
}

function renderSummary() {
  const topMover = [...latestMarket].sort(
    (left, right) =>
      Math.abs(right.price_change_percentage_24h_in_currency ?? 0) -
      Math.abs(left.price_change_percentage_24h_in_currency ?? 0)
  )[0];

  const newestPaper = latestPapers[0];
  const summaryPoints = [
    {
      title: "Market momentum",
      body: topMover
        ? `${topMover.name} is leading this node's watchlist with a ${signedPercent(topMover.price_change_percentage_24h_in_currency)} move in the last 24 hours.`
        : "Market movers will appear here once the crypto feed lands."
    },
    {
      title: "Research front",
      body: newestPaper
        ? `The newest publication record in your stream is "${newestPaper.title || "Untitled paper"}", helping anchor the latest ${state.customQuery || state.activeTopic} discussion.`
        : "Recent publication records will appear here once the research stream loads."
    },
    {
      title: "Node thesis",
      body: state.notes.trim()
        ? state.notes.trim()
        : "Add a short thesis note so everyone using this node understands what signal matters most to you."
    }
  ];

  els.summaryPanel.innerHTML = summaryPoints
    .map(
      (point) => `
        <article class="summary-point">
          <h3>${escapeHtml(point.title)}</h3>
          <p>${escapeHtml(point.body)}</p>
        </article>
      `
    )
    .join("");
}

async function exportSignalPack() {
  const payload = {
    exportedAt: new Date().toISOString(),
    format: "abyss-watchers-signal-pack",
    formatVersion: 2,
    activeTopic: state.activeTopic,
    customQuery: state.customQuery,
    watchlist: state.watchlist,
    notes: state.notes
  };

  const envelope = {
    payload,
    signer: {
      fingerprint: nodeIdentity?.fingerprint || "unknown",
      publicKeyJwk: nodeIdentity?.publicJwk || null
    },
    signature: nodeIdentity ? await signPayload(payload) : null
  };

  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "abyss-watchers-signal-pack.json";
  anchor.click();
  URL.revokeObjectURL(url);
  state.lastPackTrust = {
    level: "verified",
    message: `Signed by ${nodeIdentity?.fingerprint || "this node"}`
  };
  saveState();
  renderPackTrust();
  setStatus("Signal pack exported with this node's signature.");
}

async function importSignalPack(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const imported = JSON.parse(await file.text());
    const envelope = normalizeImportedPack(imported);
    state.lastPackTrust = await verifyImportedPack(envelope);
    state = {
      ...normalizeState(state),
      activeTopic: envelope.payload.activeTopic || state.activeTopic,
      customQuery: envelope.payload.customQuery || envelope.payload.activeTopic || state.customQuery,
      watchlist: Array.isArray(envelope.payload.watchlist)
        ? envelope.payload.watchlist.map(sanitizeAsset).filter(Boolean)
        : state.watchlist,
      notes: typeof envelope.payload.notes === "string" ? envelope.payload.notes : state.notes,
      radio: {
        ...state.radio
      }
    };
    saveState();
    renderTopicChips();
    await refreshAllData();
    setStatus("Signal pack imported into this local node.");
  } catch {
    state.lastPackTrust = {
      level: "error",
      message: "Import failed"
    };
    renderPackTrust();
    setStatus("That signal pack could not be imported. Check that it is valid JSON.");
  } finally {
    event.target.value = "";
  }
}

function recentDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function sanitizeAsset(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function formatAssetLabel(assetId) {
  return assetId
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function signedPercent(value) {
  const numeric = Number(value ?? 0);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value ?? 0);
}

function compactCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function percent(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function extractDate(published) {
  const parts = published?.["date-parts"]?.[0];
  if (!parts) {
    return "Date unavailable";
  }

  const [year, month = 1, day = 1] = parts;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message) {
  els.statusMessage.textContent = message;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json();
}

function cacheSnapshot(key, payload) {
  localStorage.setItem(`${STORAGE_KEY}-${key}`, JSON.stringify(payload));
}

function readSnapshot(key, fallback = []) {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}-${key}`);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeState(raw = {}) {
  return {
    ...DEFAULT_STATE,
    ...raw,
    watchlist: Array.isArray(raw.watchlist) ? raw.watchlist : [...DEFAULT_STATE.watchlist],
    radio: {
      ...DEFAULT_STATE.radio,
      ...(raw.radio ?? {})
    },
    lastPackTrust: raw.lastPackTrust ?? {
      level: "warning",
      message: "Unsigned"
    }
  };
}

function renderPackTrust() {
  const trust = state.lastPackTrust ?? {
    level: "warning",
    message: "Unsigned"
  };
  els.packTrustStatus.textContent = trust.message;
  els.packTrustStatus.className = `metric-value ${trust.level === "verified" ? "trust-verified" : trust.level === "error" ? "trust-error" : "trust-warning"}`;
}

function renderSectionTabs() {
  document.querySelectorAll("[data-tab-group='crypto']").forEach((button) => {
    const active = button.getAttribute("data-tab-id") === state.activeCryptoTab;
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-tab-group='research']").forEach((button) => {
    const active = button.getAttribute("data-tab-id") === state.activeResearchTab;
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelector("#cryptoPaneBoard")?.classList.toggle("hidden", state.activeCryptoTab !== "board");
  document.querySelector("#cryptoPaneWatchlist")?.classList.toggle("hidden", state.activeCryptoTab !== "watchlist");
  document.querySelector("#cryptoPanePulse")?.classList.toggle("hidden", state.activeCryptoTab !== "pulse");
}

function renderMarketInsights() {
  const topGainer = [...latestMarket].sort(
    (left, right) =>
      (right.price_change_percentage_24h_in_currency ?? 0) -
      (left.price_change_percentage_24h_in_currency ?? 0)
  )[0];
  const topVolume = [...latestMarket].sort(
    (left, right) => (right.total_volume ?? 0) - (left.total_volume ?? 0)
  )[0];
  const points = [
    {
      title: "Risk pulse",
      body: `${els.btcDominance.textContent} BTC dominance with ${els.marketCapChange.textContent.toLowerCase()} in global crypto market cap.`
    },
    {
      title: "Top gainer",
      body: topGainer
        ? `${topGainer.name} is leading the watchlist with ${signedPercent(topGainer.price_change_percentage_24h_in_currency)} over the last 24 hours.`
        : "Top gainers appear here once market data loads."
    },
    {
      title: "Liquidity focus",
      body: topVolume
        ? `${topVolume.name} has the strongest 24h volume in this node's watchlist at ${compactCurrency(topVolume.total_volume)}.`
        : "Volume leaders appear here once market data loads."
    }
  ];

  els.marketInsights.innerHTML = points
    .map(
      (point) => `
        <article class="summary-point">
          <h3>${escapeHtml(point.title)}</h3>
          <p>${escapeHtml(point.body)}</p>
        </article>
      `
    )
    .join("");
}

function bindSceneMotion() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion || !els.abyssStage) {
    return;
  }

  const rootStyle = document.documentElement.style;
  const maxScroll = () =>
    Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

  const updateScrollMotion = () => {
    const progress = window.scrollY / maxScroll();
    rootStyle.setProperty("--scene-zoom", String(1 + progress * 0.24));
    rootStyle.setProperty("--scene-rotate", `${-8 + progress * 20}deg`);
    rootStyle.setProperty("--scene-card-shift", `${progress * 42}px`);
  };

  const updatePointerMotion = (event) => {
    const xRatio = event.clientX / window.innerWidth - 0.5;
    const yRatio = event.clientY / window.innerHeight - 0.5;
    rootStyle.setProperty("--scene-drift-x", `${xRatio * 38}px`);
    rootStyle.setProperty("--scene-drift-y", `${yRatio * 28}px`);
  };

  const pulseScene = (event) => {
    rootStyle.setProperty("--pulse-x", `${event.clientX}px`);
    rootStyle.setProperty("--pulse-y", `${event.clientY}px`);
    document.body.classList.remove("scene-pulse");
    void document.body.offsetWidth;
    document.body.classList.add("scene-pulse");
    window.setTimeout(() => {
      document.body.classList.remove("scene-pulse");
    }, 920);
  };

  updateScrollMotion();
  window.addEventListener("scroll", updateScrollMotion, { passive: true });
  window.addEventListener("pointermove", updatePointerMotion, { passive: true });
  window.addEventListener("click", pulseScene, { passive: true });
}

function renderRadioState() {
  const enabled = Boolean(state.radio.enabled);
  const accepted = state.radio.decision === "accepted";
  els.radioConsentPanel.classList.toggle("hidden", accepted);
  els.radioControls.classList.toggle("hidden", !accepted);

  if (!enabled) {
    stopRadio();
  }
}

function loadDefaultRadio(autoplay) {
  if (!state.radio.enabled) {
    setRadioStatus("Accept the radio prompt first so playback stays opt-in.");
    return;
  }

  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    playsinline: "1",
    rel: "0",
    loop: "1",
    playlist: DEFAULT_RADIO_STATION.playlistVideoIds.join(",")
  });

  els.radioPlayer.src = `https://www.youtube.com/embed/${DEFAULT_RADIO_STATION.leadVideoId}?${params.toString()}`;
  els.radioPlayerShell.classList.remove("hidden");
  setRadioStatus(
    autoplay
      ? `${DEFAULT_RADIO_STATION.name} loaded. If your browser blocks autoplay, press play inside the YouTube frame.`
      : `${DEFAULT_RADIO_STATION.name} is ready. Press play inside the frame if needed.`
  );
}

function loadRadioFromInput(input, autoplay) {
  if (!state.radio.enabled) {
    setRadioStatus("Accept the radio prompt first so playback stays opt-in.");
    return;
  }

  const source = parseYouTubeSource(input);
  if (!source) {
    setRadioStatus("Paste a valid YouTube video or playlist link. Search pages do not embed directly.");
    return;
  }

  const autoplayFlag = autoplay ? "1" : "0";
  const params = new URLSearchParams({
    autoplay: autoplayFlag,
    playsinline: "1",
    rel: "0"
  });

  els.radioPlayer.src =
    source.kind === "playlist"
      ? `https://www.youtube.com/embed?listType=playlist&list=${encodeURIComponent(source.id)}&${params.toString()}`
      : `https://www.youtube.com/embed/${encodeURIComponent(source.id)}?${params.toString()}`;
  els.radioPlayerShell.classList.remove("hidden");
  setRadioStatus(
    autoplay
      ? "Station loaded. If your browser blocks autoplay, press play inside the YouTube frame."
      : "Last station restored. Press Load Station to start playback."
  );
}

function stopRadio() {
  els.radioPlayer.src = "";
  els.radioPlayerShell.classList.add("hidden");
}

function setRadioStatus(message) {
  els.radioStatus.textContent = message;
}

async function ensureNodeIdentity() {
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        parsed.privateJwk,
        {
          name: "ECDSA",
          namedCurve: "P-256"
        },
        true,
        ["sign"]
      );
      const publicKey = await crypto.subtle.importKey(
        "jwk",
        parsed.publicJwk,
        {
          name: "ECDSA",
          namedCurve: "P-256"
        },
        true,
        ["verify"]
      );
      return {
        privateKey,
        publicKey,
        privateJwk: parsed.privateJwk,
        publicJwk: parsed.publicJwk,
        fingerprint: parsed.fingerprint
      };
    }

    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256"
      },
      true,
      ["sign", "verify"]
    );
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const fingerprint = await buildFingerprint(publicJwk);
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({
        privateJwk,
        publicJwk,
        fingerprint
      })
    );
    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      privateJwk,
      publicJwk,
      fingerprint
    };
  } catch {
    setStatus("Node identity could not be initialized.");
    return null;
  }
}

async function buildFingerprint(publicJwk) {
  const bytes = new TextEncoder().encode(canonicalStringify(publicJwk));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `node-${bufferToHex(digest).slice(0, 16)}`;
}

async function signPayload(payload) {
  if (!nodeIdentity?.privateKey) {
    return null;
  }

  const bytes = new TextEncoder().encode(canonicalStringify(payload));
  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256"
    },
    nodeIdentity.privateKey,
    bytes
  );
  return bufferToBase64(signature);
}

function normalizeImportedPack(imported) {
  if (imported?.payload) {
    return imported;
  }

  return {
    payload: imported,
    signer: null,
    signature: null
  };
}

async function verifyImportedPack(envelope) {
  if (!envelope.signature || !envelope.signer?.publicKeyJwk) {
    return {
      level: "warning",
      message: "Unsigned"
    };
  }

  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      envelope.signer.publicKeyJwk,
      {
        name: "ECDSA",
        namedCurve: "P-256"
      },
      true,
      ["verify"]
    );
    const verified = await crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: "SHA-256"
      },
      publicKey,
      base64ToArrayBuffer(envelope.signature),
      new TextEncoder().encode(canonicalStringify(envelope.payload))
    );
    if (!verified) {
      return {
        level: "error",
        message: "Signature failed"
      };
    }

    const fingerprint = await buildFingerprint(envelope.signer.publicKeyJwk);
    return {
      level: "verified",
      message: `Verified ${fingerprint}`
    };
  } catch {
    return {
      level: "error",
      message: "Signature failed"
    };
  }
}

function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function bufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToArrayBuffer(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseYouTubeSource(input) {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { kind: "video", id: trimmed };
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? { kind: "video", id } : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const playlistId = url.searchParams.get("list");
      if (playlistId) {
        return { kind: "playlist", id: playlistId };
      }

      const videoId =
        url.searchParams.get("v") ||
        url.pathname.split("/embed/")[1] ||
        url.pathname.split("/shorts/")[1] ||
        url.pathname.split("/live/")[1];

      if (videoId) {
        return { kind: "video", id: videoId.split(/[/?&]/)[0] };
      }
    }
  } catch {
    return null;
  }

  return null;
}

function writeStateToHash() {
  const shareState = {
    topic: state.activeTopic,
    query: state.customQuery,
    watchlist: state.watchlist
  };

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(shareState))));
  history.replaceState(null, "", `#${encoded}`);
}

function readStateFromHash() {
  if (!location.hash.slice(1)) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(escape(atob(location.hash.slice(1))));
    const parsed = JSON.parse(decoded);
    return {
      activeTopic: parsed.topic || DEFAULT_STATE.activeTopic,
      customQuery: parsed.query || parsed.topic || DEFAULT_STATE.activeTopic,
      watchlist: Array.isArray(parsed.watchlist)
        ? parsed.watchlist.map(sanitizeAsset).filter(Boolean)
        : DEFAULT_STATE.watchlist
    };
  } catch {
    return null;
  }
}
