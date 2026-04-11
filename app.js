const STORAGE_KEY = "abyss-watchers-state";
const IDENTITY_KEY = `${STORAGE_KEY}-identity`;
const OLLAMA_ENDPOINT = "/api/ollama/generate";
const OLLAMA_TAGS_ENDPOINT = "/api/ollama/tags";
const OLLAMA_MODEL = "gemma3:4b";
const PAGE_DEFAULT_REALM = document.body.dataset.defaultRealm || "portal";
const OLLAMA_FALLBACK_ENDPOINT = "http://127.0.0.1:11434/api/generate";
const OLLAMA_FALLBACK_TAGS_ENDPOINT = "http://127.0.0.1:11434/api/tags";
const RADIO_AUTOPLAY_KEY = `${STORAGE_KEY}-radio-autoplay`;
const DEFAULT_CAVEMAN_TRANSCRIPT = [
  {
    role: "bot",
    text: "Unga bunga. Grug guard portal. Tell Grug your name, ask wild question, or demand picture magic."
  },
  {
    role: "bot",
    text: "If you want cave-mail portrait, open Get Caveman Pic and leave an email for the message stone."
  }
];

const DEFAULT_STATE = {
  activeRealm: PAGE_DEFAULT_REALM,
  activeTopic: "Metabolic Health",
  activeCryptoTab: "board",
  activeResearchTab: "latest",
  activeCavemanTab: "chat",
  watchlist: ["bitcoin", "ethereum", "solana"],
  notes: "",
  customQuery: "",
  radio: {
    decision: "unset",
    enabled: false,
    lastInput: "",
    lastSearch: "Abyss auto radio"
  },
  caveman: createDefaultCavemanState(),
  helper: createDefaultHelperState()
};

const TOPICS = [
  "Metabolic Health",
  "Fitness Science",
  "Cancer Research",
  "Virology",
  "Parasitology",
  "Longevity"
];

const HEALTH_TOPIC_SCOPES = {
  "Metabolic Health": "(metabolic health OR insulin sensitivity OR obesity OR glucose metabolism OR nutrition science)",
  "Fitness Science": "(exercise physiology OR strength training OR endurance training OR VO2 OR muscle hypertrophy OR recovery)",
  "Cancer Research": "(cancer OR oncology OR tumor microenvironment OR chemotherapy OR immunotherapy)",
  Virology: "(virus OR viral infection OR virology OR influenza OR coronavirus OR antiviral)",
  Parasitology: "(parasite OR parasitology OR helminth OR protozoa OR malaria OR toxoplasma)",
  Longevity: "(healthy aging OR lifespan OR healthspan OR longevity OR senescence OR mitochondrial health)"
};

const RESEARCH_LOOKBACK_DAYS = {
  latest: 365,
  reviews: 1825,
  clinical: 1825
};

const EXCLUDED_PUB_TYPES = new Set([
  "comment",
  "editorial",
  "letter",
  "news",
  "newspaper article",
  "preprint",
  "published erratum",
  "retracted publication"
]);

const DEFAULT_RADIO_STATION = {
  name: "Abyss auto radio",
  kind: "playlist",
  playlistId: "RDMMIVpJZVzGi-8",
  leadVideoId: "IVpJZVzGi-8"
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
  openCavemanBot: document.querySelector("#openCavemanBot"),
  runResearchSearch: document.querySelector("#runResearchSearch"),
  addAsset: document.querySelector("#addAsset"),
  topicChipTemplate: document.querySelector("#topicChipTemplate"),
  radioWelcomeModal: document.querySelector("#radioWelcomeModal"),
  radioControls: document.querySelector("#radioControls"),
  acceptRadio: document.querySelector("#acceptRadio"),
  declineRadio: document.querySelector("#declineRadio"),
  reopenRadioPrompt: document.querySelector("#reopenRadioPrompt"),
  radioInput: document.querySelector("#radioInput"),
  loadRadio: document.querySelector("#loadRadio"),
  stopRadio: document.querySelector("#stopRadio"),
  openYoutubeSearch: document.querySelector("#openYoutubeSearch"),
  radioStatus: document.querySelector("#radioStatus"),
  radioPlayerShell: document.querySelector("#radioPlayerShell"),
  radioPlayer: document.querySelector("#radioPlayer"),
  cavemanSection: document.querySelector("#cavemanSection"),
  cavemanTranscript: document.querySelector("#cavemanTranscript"),
  cavemanInput: document.querySelector("#cavemanInput"),
  cavemanSend: document.querySelector("#cavemanSend"),
  cavemanClear: document.querySelector("#cavemanClear"),
  cavemanName: document.querySelector("#cavemanName"),
  cavemanEmail: document.querySelector("#cavemanEmail"),
  cavemanPrepareEmail: document.querySelector("#cavemanPrepareEmail"),
  cavemanMailStatus: document.querySelector("#cavemanMailStatus"),
  cavemanAiStatus: document.querySelector("#cavemanAiStatus"),
  cavemanToggleAi: document.querySelector("#cavemanToggleAi"),
  cavemanRetryAi: document.querySelector("#cavemanRetryAi"),
  lunaToggle: document.querySelector("#lunaToggle"),
  lunaPanel: document.querySelector("#lunaPanel"),
  lunaContext: document.querySelector("#lunaContext"),
  lunaTranscript: document.querySelector("#lunaTranscript"),
  lunaFaqChips: document.querySelector("#lunaFaqChips"),
  lunaInput: document.querySelector("#lunaInput"),
  lunaSend: document.querySelector("#lunaSend"),
  realmLabel: document.querySelector("#realmLabel"),
  realmMeterFill: document.querySelector("#realmMeterFill"),
  realmDepthValue: document.querySelector("#realmDepthValue")
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
const researchDetailCache = {};
let nodeIdentity = null;
let ollamaAvailable = false;

initialize();

async function initialize() {
  nodeIdentity = await ensureNodeIdentity();
  applyStateToUi();
  renderTopicChips();
  bindEvents();
  bindSceneMotion();
  if (shouldResumeRadioAutoplay()) {
    hideRadioWelcome();
    loadDefaultRadio(true);
    sessionStorage.removeItem(RADIO_AUTOPLAY_KEY);
  } else {
    showRadioWelcome();
  }
  await probeOllama();
  await refreshAllData();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js?v=20260410e").catch(() => {
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
    }, PAGE_DEFAULT_REALM);
  } catch {
    return normalizeState(urlState ?? {}, PAGE_DEFAULT_REALM);
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
  els.cavemanName.value = state.caveman.name;
  els.cavemanEmail.value = state.caveman.email;
  els.cavemanMailStatus.textContent = state.caveman.mailStatus;
  renderRealmNavigation();
  renderSectionTabs();
  renderWatchlist();
  renderRadioState();
  renderPackTrust();
  renderCavemanAiState();
  renderCavemanTranscript();
  renderLunaGuide();
}

function bindEvents() {
  els.refreshAll.addEventListener("click", () => refreshAllData());
  document.querySelectorAll("[data-realm-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const realm = button.getAttribute("data-realm-target");
      if (!realm) {
        return;
      }
      setActiveRealm(realm);
    });
  });
  els.openCavemanBot.addEventListener("click", () => {
    setActiveRealm("caveman");
  });
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
    hideRadioWelcome();
    if (state.activeRealm !== "radio") {
      setActiveRealm("radio");
    }
    loadDefaultRadio(true);
  });
  els.declineRadio.addEventListener("click", () => {
    state.radio.decision = "declined";
    state.radio.enabled = false;
    saveState();
    hideRadioWelcome();
    setRadioStatus("Radio declined. The site will stay silent unless you accept later.");
  });
  els.reopenRadioPrompt.addEventListener("click", () => {
    showRadioWelcome();
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
        return;
      }

      if (group === "caveman") {
        state.activeCavemanTab = tabId;
        saveState();
        renderSectionTabs();
      }
    });
  });
  document.querySelectorAll("[data-caveman-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.getAttribute("data-caveman-prompt") || "";
      void handleCavemanInput(prompt);
    });
  });
  els.cavemanSend.addEventListener("click", () => {
    void handleCavemanInput(els.cavemanInput.value);
  });
  els.cavemanInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void handleCavemanInput(els.cavemanInput.value);
  });
  els.cavemanClear.addEventListener("click", () => {
    state.caveman.transcript = DEFAULT_CAVEMAN_TRANSCRIPT.map((entry) => ({ ...entry }));
    state.caveman.mailStatus = createDefaultCavemanState().mailStatus;
    saveState();
  });
  els.cavemanName.addEventListener("input", (event) => {
    state.caveman.name = sanitizeCavemanName(event.target.value);
    saveState();
  });
  els.cavemanEmail.addEventListener("input", (event) => {
    state.caveman.email = sanitizeEmail(event.target.value);
    saveState();
  });
  els.cavemanPrepareEmail.addEventListener("click", () => {
    prepareCavemanEmail();
  });
  els.cavemanToggleAi.addEventListener("click", async () => {
    if (!ollamaAvailable) {
      await probeOllama(true);
      return;
    }

    state.caveman.useOllama = !state.caveman.useOllama;
    saveState();
  });
  els.cavemanRetryAi.addEventListener("click", async () => {
    await probeOllama(true);
  });
  els.lunaToggle.addEventListener("click", () => {
    state.helper.open = !state.helper.open;
    saveState();
  });
  els.lunaSend.addEventListener("click", () => {
    void handleLunaInput(els.lunaInput.value);
  });
  els.lunaInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void handleLunaInput(els.lunaInput.value);
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
    const detailMap = await fetchPubMedDetails(ids);
    latestPapers = mapPubMedSummaries(ids, summaryResponse, detailMap, tab);
    researchCache[tab] = latestPapers;
    renderPaperFeed();
    renderSummary();
    setStatus(`Research radar updated with recent NCBI-screened ${tab} articles.`);
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
    els.paperFeed.innerHTML = `<div class="empty-state">No screened research records cleared the current evidence gate. Try another health topic or a broader query.</div>`;
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
      const verificationMarkup = (paper.verification || [])
        .map((item) => `<span class="evidence-chip">${escapeHtml(item)}</span>`)
        .join("");
      const sourceLinks = [
        `<a href="https://pubmed.ncbi.nlm.nih.gov/${paper.id}/" target="_blank" rel="noreferrer">Open NCBI record</a>`,
        paper.pmcUrl
          ? `<a href="${escapeHtml(paper.pmcUrl)}" target="_blank" rel="noreferrer">Open PMC full text</a>`
          : "",
        paper.doiUrl
          ? `<a href="${escapeHtml(paper.doiUrl)}" target="_blank" rel="noreferrer">Open DOI</a>`
          : "",
        paper.scienceDirectSearchUrl
          ? `<a href="${escapeHtml(paper.scienceDirectSearchUrl)}" target="_blank" rel="noreferrer">Search ScienceDirect</a>`
          : ""
      ].filter(Boolean).join("");
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
          <div class="evidence-row">${verificationMarkup}</div>
          <div class="paper-actions">
            <button type="button" class="ghost-button paper-preview-button" data-preview-id="${paper.id}">
              Quick Preview
            </button>
            ${sourceLinks}
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
        previewCache[paperId] = await fetchPubMedPreview(paperId);
      } else {
        delete previewCache[paperId];
      }
      renderPaperFeed();
    });
  });
}

function renderCavemanTranscript() {
  const transcript = Array.isArray(state.caveman.transcript) && state.caveman.transcript.length
    ? state.caveman.transcript
    : DEFAULT_CAVEMAN_TRANSCRIPT;

  els.cavemanTranscript.innerHTML = transcript
    .map(
      (entry) => `
        <article class="caveman-bubble caveman-bubble-${escapeHtml(entry.role || "bot")}">
          <p class="caveman-speaker">${entry.role === "user" ? "You" : "Grug"}</p>
          <p>${escapeHtml(entry.text || "")}</p>
        </article>
      `
    )
    .join("");

  els.cavemanTranscript.scrollTop = els.cavemanTranscript.scrollHeight;
}

function renderLunaGuide() {
  const transcript = Array.isArray(state.helper.transcript) && state.helper.transcript.length
    ? state.helper.transcript
    : createDefaultHelperState().transcript;
  const realm = state.activeRealm || PAGE_DEFAULT_REALM;
  const realmLabels = {
    portal: "portal map",
    crypto: "crypto realm",
    research: "research realm",
    caveman: "caveman cave",
    radio: "radio realm"
  };

  els.lunaPanel.classList.toggle("hidden", !state.helper.open);
  els.lunaToggle.setAttribute("aria-expanded", String(state.helper.open));
  els.lunaContext.textContent = `Luna is guiding the ${realmLabels[realm] || "site"}${ollamaAvailable ? " with local brain backup." : " with built-in help."}`;
  els.lunaTranscript.innerHTML = transcript
    .map(
      (entry) => `
        <article class="luna-bubble luna-bubble-${escapeHtml(entry.role || "bot")}">
          <p class="luna-speaker">${entry.role === "user" ? "You" : "Luna"}</p>
          <p>${escapeHtml(entry.text || "")}</p>
        </article>
      `
    )
    .join("");
  els.lunaTranscript.scrollTop = els.lunaTranscript.scrollHeight;
  renderLunaFaqs();
}

function renderLunaFaqs() {
  const faqs = getLunaFaqs();
  els.lunaFaqChips.innerHTML = faqs
    .map((faq) => `<button class="topic-chip" type="button" data-luna-faq="${escapeHtml(faq)}">${escapeHtml(faq)}</button>`)
    .join("");

  els.lunaFaqChips.querySelectorAll("[data-luna-faq]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.getAttribute("data-luna-faq") || "";
      void handleLunaInput(question);
    });
  });
}

function getLunaFaqs() {
  const realm = state.activeRealm || PAGE_DEFAULT_REALM;
  const shared = ["How do I use this site?", "Where is the radio?", "What data is real here?"];
  const byRealm = {
    portal: ["What page should I start with?", "Where is crypto?", "Where is research?", "What is the caveman page?"],
    crypto: ["How do I add an asset?", "What is Macro Pulse?", "Where is research?", "How do I export my setup?"],
    research: ["Are these articles real?", "What topics are included?", "What is Quick Preview?", "Where is crypto?"],
    caveman: ["Is Caveman using Ollama?", "How do I get the caveman picture?", "Can Luna help me navigate?", "Where is the radio?"],
    radio: ["Why is there no sound?", "What starts on entry?", "How do I stop the music?", "Where is the caveman page?"]
  };
  return [...(byRealm[realm] || []), ...shared].slice(0, 6);
}

async function handleLunaInput(rawMessage) {
  const message = rawMessage.trim();
  if (!message) {
    return;
  }

  state.helper.open = true;
  state.helper.transcript = [...state.helper.transcript, { role: "user", text: message }].slice(-18);
  let reply = "";
  if (ollamaAvailable) {
    reply = await requestLunaReply(message);
  }
  if (!reply) {
    reply = buildLunaReply(message);
  }
  state.helper.transcript = [...state.helper.transcript, { role: "bot", text: reply }].slice(-18);
  els.lunaInput.value = "";
  saveState();
}

function buildLunaReply(message) {
  const lower = message.toLowerCase();
  const realm = state.activeRealm || PAGE_DEFAULT_REALM;

  if (/(how do i use|what is this site|what does this site do)/.test(lower)) {
    return "Luna says this site is split into separate pages for portal, crypto, research, caveman, and radio. Use the top nav to move between them.";
  }
  if (/(where is crypto|open crypto)/.test(lower)) {
    return "Luna says the crypto section lives on the Crypto page. Use the top nav or open crypto.html.";
  }
  if (/(where is research|open research|articles real)/.test(lower)) {
    return "Luna says the research page only shows recent biomedical records that clear the site's source screen, with links back to NCBI, PMC, DOI pages, and optional ScienceDirect search.";
  }
  if (/(radio|music|sound|why no sound)/.test(lower)) {
    return "Luna says the radio is opt-in. The welcome popup asks on entry, and the full player lives on the Radio page.";
  }
  if (/(caveman|ollama|local brain)/.test(lower)) {
    return ollamaAvailable
      ? "Luna says the Caveman page can use your local Ollama model gemma3:4b when available, with built-in fallback if it is not."
      : "Luna says the Caveman page has a local brain slot ready, but this browser is currently falling back to built-in replies.";
  }
  if (/(logo|cat|luna)/.test(lower)) {
    return "Luna says the portal uses your Abyss Watchers logo as the main visual anchor, and I am the fluffy guide watching over the site.";
  }
  if (realm === "crypto") {
    return "Luna says this is the crypto realm. Add assets to the watchlist, use the tabs for board, watchlist, and macro pulse, and export a signal pack if you want to carry the setup elsewhere.";
  }
  if (realm === "research") {
    return "Luna says this is the research realm. Search health topics, switch between latest, reviews, and clinical, and use the evidence chips plus Quick Preview before opening the source links.";
  }
  if (realm === "caveman") {
    return "Luna says this is the caveman cave. Talk to Grug, then use Get Caveman Pic if you want the humorous email flow.";
  }
  if (realm === "radio") {
    return "Luna says this is the radio realm. Reopen the entry prompt, load a custom YouTube link, or stop the current station here.";
  }
  return "Luna says use the top page nav to move between the portal, crypto, research, caveman, and radio realms. Ask me about any part and I will point you there.";
}

async function requestLunaReply(message) {
  try {
    const prompt = [
      "You are Luna, a cute black cat helper for the Abyss Watchers website.",
      "Answer as a friendly guide for navigation, FAQ, and feature explanations.",
      "Keep it to 2-3 short sentences.",
      "Be helpful, warm, and concise.",
      "Do not invent features that are not in the site.",
      `Current page realm: ${state.activeRealm || PAGE_DEFAULT_REALM}.`,
      `User question: ${message}`
    ].join("\n");

    const response = await requestOllamaCompletion(prompt);
    return response;
  } catch {
    return "";
  }
}

function renderCavemanAiState() {
  const enabled = Boolean(state.caveman.useOllama);
  if (isHostedHttpsPage()) {
    els.cavemanAiStatus.textContent = "Local Ollama brain is unavailable on GitHub Pages or other hosted HTTPS copies. Run py dev_server.py locally if you want the Caveman page to use Ollama.";
    els.cavemanToggleAi.textContent = "Hosted Mode";
    return;
  }
  if (!ollamaAvailable) {
    els.cavemanAiStatus.textContent = "Local Ollama brain unavailable. Falling back to built-in caveman instincts.";
    els.cavemanToggleAi.textContent = "Use Built-in Brain";
    return;
  }

  els.cavemanAiStatus.textContent = enabled
    ? `Local Ollama brain online with ${OLLAMA_MODEL}.`
    : `Local Ollama brain detected. Toggle it on to let ${OLLAMA_MODEL} run the cave.`;
  els.cavemanToggleAi.textContent = enabled ? "Use Built-in Brain" : "Use Ollama Brain";
}

async function handleCavemanInput(rawMessage) {
  const message = rawMessage.trim();
  if (!message) {
    return;
  }

  const discoveredName = extractNameFromMessage(message);
  const discoveredEmail = extractEmailFromMessage(message);
  if (discoveredName) {
    state.caveman.name = discoveredName;
  }
  if (discoveredEmail) {
    state.caveman.email = discoveredEmail;
  }

  state.caveman.transcript = [...state.caveman.transcript, { role: "user", text: message }].slice(-18);
  let reply = "";
  if (state.caveman.useOllama && ollamaAvailable) {
    reply = await requestOllamaCavemanReply(message, {
      discoveredName,
      discoveredEmail
    });
  }
  if (!reply) {
    reply = buildCavemanReply(message, {
      discoveredName,
      discoveredEmail
    });
  }
  state.caveman.transcript = [...state.caveman.transcript, { role: "bot", text: reply }].slice(-18);
  if (discoveredEmail) {
    state.caveman.mailStatus = `Email remembered for ${state.caveman.email}. Open Get Caveman Pic when you want the portrait message.`;
  }
  els.cavemanInput.value = "";
  saveState();
}

async function probeOllama(forceStatus = false) {
  if (isHostedHttpsPage()) {
    ollamaAvailable = false;
    state.caveman.useOllama = false;
    if (forceStatus) {
      saveState();
    } else {
      renderCavemanAiState();
    }
    return;
  }

  try {
    let response;
    try {
      response = await fetch(OLLAMA_TAGS_ENDPOINT);
    } catch {
      response = await fetch(OLLAMA_FALLBACK_TAGS_ENDPOINT);
    }
    if (!response.ok) {
      response = await fetch(OLLAMA_FALLBACK_TAGS_ENDPOINT);
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }
    }
    const payload = await response.json();
    const hasModel = Array.isArray(payload.models) && payload.models.some((model) => model.name === OLLAMA_MODEL);
    ollamaAvailable = hasModel;
    if (!hasModel) {
      state.caveman.useOllama = false;
    }
    if (forceStatus) {
      saveState();
    } else {
      renderCavemanAiState();
    }
  } catch {
    ollamaAvailable = false;
    state.caveman.useOllama = false;
    if (forceStatus) {
      saveState();
    } else {
      renderCavemanAiState();
    }
  }
}

function isHostedHttpsPage() {
  return location.protocol === "https:" && location.hostname !== "127.0.0.1" && location.hostname !== "localhost";
}

async function requestOllamaCavemanReply(message, discoveries = {}) {
  try {
    const caveName = state.caveman.name || discoveries.discoveredName || "mystery cave friend";
    const prompt = [
      "You are Caveman Bot inside the Abyss Watchers website.",
      "Reply as a funny caveman with primitive noises, but still answer the user's question.",
      "Keep it to 2-4 short sentences.",
      "Be playful, not mean.",
      "If the topic is crypto, mention watching data before panic.",
      "If the topic is health, cancer, viruses, parasites, fitness, or research, remind the user to trust NCBI or real evidence.",
      `User name: ${caveName}.`,
      `User message: ${message}`
    ].join("\n");
    return await requestOllamaCompletion(prompt);
  } catch {
    ollamaAvailable = false;
    state.caveman.useOllama = false;
    renderCavemanAiState();
    return "";
  }
}

async function requestOllamaCompletion(prompt) {
  let response;
  try {
    response = await fetch(OLLAMA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      })
    });
  } catch {
    response = await fetch(OLLAMA_FALLBACK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      })
    });
  }

  if (!response.ok) {
    response = await fetch(OLLAMA_FALLBACK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      })
    });
  }

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  const payload = await response.json();
  return String(payload.response || "").trim();
}

function buildCavemanReply(message, discoveries = {}) {
  const lower = message.toLowerCase();
  const noises = [
    "Unga bunga.",
    "Grug grunt.",
    "Ooga booga.",
    "Snort-snort, cave brain think."
  ];
  const opener = noises[Math.floor(Math.random() * noises.length)];
  const caveName = state.caveman.name || discoveries.discoveredName || "mystery cave friend";
  let response = `${opener} `;

  if (discoveries.discoveredName) {
    response += `${discoveries.discoveredName}, Grug remember your name now. `;
  } else if (/what('?s| is) my name|who am i/.test(lower) && state.caveman.name) {
    response += `You are ${state.caveman.name}, unless cave spirits swapped skins. `;
  }

  if (discoveries.discoveredEmail) {
    response += `Grug also carved your email on the wall. `;
  }

  if (/(bitcoin|btc|ethereum|eth|solana|crypto|coin|market|altcoin)/.test(lower)) {
    response += "Magic money herd runs in circles. Grug watches volume, dominance, and fear before chasing shiny coin mammoth.";
  } else if (/(cancer|tumou?r|oncology|chemo|immunotherapy)/.test(lower)) {
    response += "Cancer scrolls are serious fire-scrolls. Grug says read the PubMed stones carefully and look for study type before roaring.";
  } else if (/(virus|viral|flu|covid|corona|antiviral)/.test(lower)) {
    response += "Tiny invisible bite-things move fast. Grug trusts real NCBI records, not random swamp gossip.";
  } else if (/(parasite|parasites|worm|helminth|malaria|toxoplasma)/.test(lower)) {
    response += "Cave rule one: if worm party happens inside body, that is bad feast. Grug approves parasite scroll hunting with a long spear and peer review.";
  } else if (/(workout|lift|gym|muscle|protein|fitness|cardio|run|stronger)/.test(lower)) {
    response += "Lift big rock many time, sleep in cave, eat beast and berries. Muscle spirits respect consistency more than screaming.";
  } else if (/(research|study|paper|ncbi|pubmed|science)/.test(lower)) {
    response += "Grug love real scrolls. The research cave now pulls from NCBI so the papers are not just random leaf rumors.";
  } else if (/(picture|photo|email|mail|send)/.test(lower)) {
    response += "Portrait ritual lives in Get Caveman Pic. Put name and email there, then Grug prepares a mail stone with the caveman image.";
  } else if (/(hello|hi|hey|yo|sup)/.test(lower)) {
    response += `Welcome, ${caveName}. Fire warm, portal loud, cave jokes ready.`;
  } else if (/\?$/.test(message)) {
    response += `Big question from ${caveName}. Grug answer: maybe yes, maybe no, definitely sniff data before panic.`;
  } else {
    response += `Grug hears "${message.slice(0, 52)}" and feels it deeply in the bone marrow.`;
  }

  if (!state.caveman.name && !discoveries.discoveredName) {
    response += " Tell Grug your name so the cave stops calling you mystery meat.";
  } else if (!state.caveman.email && !discoveries.discoveredEmail) {
    response += " If you want the caveman portrait email, leave your address in Get Caveman Pic.";
  }

  return response;
}

function prepareCavemanEmail() {
  const name = sanitizeCavemanName(els.cavemanName.value);
  const email = sanitizeEmail(els.cavemanEmail.value);
  if (!name) {
    state.caveman.mailStatus = "Grug need your name before he bonk the mail stone.";
    saveState();
    return;
  }

  if (!isValidEmail(email)) {
    state.caveman.mailStatus = "Grug need a real-looking email address before cave mail can launch.";
    saveState();
    return;
  }

  state.caveman.name = name;
  state.caveman.email = email;
  const portraitUrl = new URL("./assets/caveman.webp", window.location.href).href;
  const bodyLines = [
    `Hello ${name},`,
    "",
    "The Caveman Bot has prepared your portrait from the abyss portal.",
    `Caveman image link: ${portraitUrl}`,
    portraitUrl.startsWith("file:")
      ? "This link is local to this machine right now. Host the site online if you want the picture link to work for other people."
      : "Open the link above to see the portrait.",
    "",
    "Unga bunga,",
    "Caveman Bot"
  ];
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Your Caveman Portrait")}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
  window.location.href = mailto;
  state.caveman.mailStatus = `Mail app opened for ${email}. Grug loaded the portrait link into the message.`;
  state.caveman.transcript = [
    ...state.caveman.transcript,
    { role: "bot", text: `HOOF. Grug prepared the portrait message for ${name}. Check your mail app and send the stone.` }
  ].slice(-18);
  saveState();
}

function buildPubMedQuery(query, tab) {
  const scope = HEALTH_TOPIC_SCOPES[state.activeTopic] || HEALTH_TOPIC_SCOPES["Metabolic Health"];
  const normalizedQuery = query?.trim() || state.activeTopic;
  const recencyClause = buildRecentDateClause(tab);
  const sharedRequirements = `AND english[Language] AND hasabstract[text] AND ${recencyClause}`;
  const exclusions = "NOT (preprint[Publication Type] OR editorial[Publication Type] OR comment[Publication Type] OR letter[Publication Type] OR news[Publication Type] OR published erratum[Publication Type] OR retracted publication[Publication Type])";
  const baseQuery = `(${normalizedQuery}) AND ${scope} AND (journal article[Publication Type] OR observational study[Publication Type] OR multicenter study[Publication Type] OR comparative study[Publication Type]) ${sharedRequirements} ${exclusions}`;
  if (tab === "reviews") {
    return `(${normalizedQuery}) AND ${scope} AND (review[Publication Type] OR systematic review[Publication Type] OR meta-analysis[Publication Type]) ${sharedRequirements} ${exclusions}`;
  }

  if (tab === "clinical") {
    return `(${normalizedQuery}) AND ${scope} AND (clinical trial[Publication Type] OR randomized controlled trial[Publication Type] OR controlled clinical trial[Publication Type]) ${sharedRequirements} ${exclusions}`;
  }

  return baseQuery;
}

function buildRecentDateClause(tab) {
  const lookbackDays = RESEARCH_LOOKBACK_DAYS[tab] || RESEARCH_LOOKBACK_DAYS.latest;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const year = cutoff.getFullYear();
  const month = String(cutoff.getMonth() + 1).padStart(2, "0");
  const day = String(cutoff.getDate()).padStart(2, "0");
  return `("${year}/${month}/${day}"[Date - Publication] : "3000"[Date - Publication])`;
}

function mapPubMedSummaries(ids, summaryResponse, detailMap, tab) {
  const result = summaryResponse?.result ?? {};
  return ids
    .map((id) => result[id])
    .filter(Boolean)
    .map((record) => {
      const details = detailMap?.[record.uid] ?? {};
      const pubtypes = Array.isArray(details.publicationTypes) && details.publicationTypes.length
        ? details.publicationTypes
        : Array.isArray(record.pubtype)
          ? record.pubtype.filter(Boolean)
          : [];
      const paper = {
        id: record.uid,
        title: details.articleTitle || record.title,
        journal: details.journal || record.fulljournalname || record.source || "NCBI",
        pubdate: details.pubDate || record.pubdate,
        authors: Array.isArray(record.authors) ? record.authors.map((author) => author.name).filter(Boolean) : [],
        pubtype: summarizePublicationTypes(pubtypes),
        pubtypes,
        medlineStatus: details.medlineStatus || "",
        doi: details.doi || "",
        doiUrl: details.doi ? `https://doi.org/${encodeURIComponent(details.doi)}` : "",
        pmcId: details.pmcId || "",
        pmcUrl: details.pmcId ? `https://pmc.ncbi.nlm.nih.gov/articles/${encodeURIComponent(details.pmcId)}/` : "",
        scienceDirectSearchUrl: buildScienceDirectSearchUrl(details.doi || details.articleTitle || record.title),
        previewSeed: {
          abstractText: details.abstractText || "No abstract preview is available for this record.",
          citation: details.citation || `PubMed ID ${record.uid}`
        }
      };
      paper.verification = buildResearchVerification(paper);
      return paper;
    })
    .filter((paper) => passesEvidenceGate(paper, tab));
}

async function fetchPubMedPreview(id) {
  const cachedDetail = researchDetailCache[id];
  if (cachedDetail) {
    return {
      abstractText: cachedDetail.abstractText || "No abstract preview is available for this record.",
      citation: cachedDetail.citation || `PubMed ID ${id}`
    };
  }

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
    const pubDate = extractArticlePubDate(xml.querySelector("PubmedArticle")) || "";

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

async function fetchPubMedDetails(ids) {
  if (!Array.isArray(ids) || !ids.length) {
    return {};
  }

  const endpoint =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" +
    new URLSearchParams({
      db: "pubmed",
      retmode: "xml",
      tool: "abyss_watchers_signal_mesh",
      id: ids.join(",")
    });
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  const xmlText = await response.text();
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  const map = {};

  Array.from(xml.querySelectorAll("PubmedArticle")).forEach((article) => {
    const pmid = article.querySelector("PMID")?.textContent?.trim();
    if (!pmid) {
      return;
    }

    const abstractParts = Array.from(article.querySelectorAll("AbstractText"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    const articleTitle = article.querySelector("ArticleTitle")?.textContent?.trim() || "PubMed article";
    const journal = article.querySelector("Journal > Title")?.textContent?.trim() || "NCBI";
    const pubDate = extractArticlePubDate(article);
    const publicationTypes = Array.from(article.querySelectorAll("PublicationType"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    const articleIds = Array.from(article.querySelectorAll("ArticleId"));
    const doi = articleIds
      .find((node) => (node.getAttribute("IdType") || "").toLowerCase() === "doi")
      ?.textContent?.trim() || "";
    const pmcId = articleIds
      .find((node) => (node.getAttribute("IdType") || "").toLowerCase() === "pmc")
      ?.textContent?.trim() || "";
    const medlineStatus = article.querySelector("MedlineCitation")?.getAttribute("Status") || "";
    const detail = {
      articleTitle,
      journal,
      pubDate,
      publicationTypes,
      doi,
      pmcId,
      medlineStatus,
      abstractText: abstractParts.length
        ? abstractParts.join(" ")
        : "No abstract preview is available for this record.",
      citation: [articleTitle, journal, pubDate].filter(Boolean).join(" | ")
    };
    researchDetailCache[pmid] = detail;
    map[pmid] = detail;
  });

  return map;
}

function extractArticlePubDate(article) {
  if (!article) {
    return "";
  }

  const directYear =
    article.querySelector("JournalIssue PubDate Year")?.textContent?.trim() ||
    article.querySelector("ArticleDate Year")?.textContent?.trim() ||
    article.querySelector("PubMedPubDate[PubStatus='pubmed'] Year")?.textContent?.trim();
  if (directYear) {
    return directYear;
  }

  const medlineDate = article.querySelector("JournalIssue PubDate MedlineDate")?.textContent?.trim() || "";
  const yearMatch = medlineDate.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : "";
}

function summarizePublicationTypes(pubtypes) {
  if (!Array.isArray(pubtypes) || !pubtypes.length) {
    return "Screened PubMed record";
  }
  return pubtypes.slice(0, 2).join(" | ");
}

function buildScienceDirectSearchUrl(query) {
  const normalized = String(query || "").trim();
  if (!normalized) {
    return "";
  }
  return `https://www.sciencedirect.com/search?qs=${encodeURIComponent(normalized)}`;
}

function passesEvidenceGate(paper, tab) {
  const types = (paper.pubtypes || []).map((type) => type.toLowerCase());
  const excluded = types.some((type) => EXCLUDED_PUB_TYPES.has(type));
  const strongSource = paper.medlineStatus === "MEDLINE" || Boolean(paper.pmcId);

  if (!strongSource || excluded || !paper.title || !paper.journal) {
    return false;
  }

  if (tab === "reviews") {
    return types.some((type) => type.includes("review") || type.includes("meta-analysis"));
  }

  if (tab === "clinical") {
    return types.some(
      (type) =>
        type.includes("clinical trial") ||
        type.includes("randomized controlled trial") ||
        type.includes("controlled clinical trial")
    );
  }

  return types.some(
    (type) =>
      type.includes("journal article") ||
      type.includes("observational study") ||
      type.includes("multicenter study") ||
      type.includes("comparative study") ||
      type.includes("clinical trial")
  );
}

function buildResearchVerification(paper) {
  const labels = ["NCBI record"];
  if (paper.medlineStatus === "MEDLINE") {
    labels.push("MEDLINE screened");
  }
  if (paper.pmcId) {
    labels.push("PMC linked");
  }
  if (paper.previewSeed?.abstractText && !/No abstract preview/i.test(paper.previewSeed.abstractText)) {
    labels.push("Has abstract");
  }
  if (paper.doi) {
    labels.push("DOI linked");
  }
  if (paper.pubtype) {
    labels.push(paper.pubtype);
  }
  labels.push("Read full paper");
  return labels;
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

function normalizeState(raw = {}, forcedRealm = PAGE_DEFAULT_REALM) {
  const defaultCaveman = createDefaultCavemanState();
  const defaultHelper = createDefaultHelperState();
  const allowedRealms = new Set(["portal", "crypto", "research", "caveman", "radio"]);
  return {
    ...DEFAULT_STATE,
    ...raw,
    activeRealm: allowedRealms.has(forcedRealm) ? forcedRealm : DEFAULT_STATE.activeRealm,
    watchlist: Array.isArray(raw.watchlist) ? raw.watchlist : [...DEFAULT_STATE.watchlist],
    radio: {
      ...DEFAULT_STATE.radio,
      ...(raw.radio ?? {})
    },
    caveman: {
      ...defaultCaveman,
      ...(raw.caveman ?? {}),
      transcript: Array.isArray(raw.caveman?.transcript) && raw.caveman.transcript.length
        ? raw.caveman.transcript
            .filter((entry) => entry && (entry.role === "bot" || entry.role === "user"))
            .map((entry) => ({
              role: entry.role,
              text: String(entry.text ?? "")
            }))
            .slice(-18)
        : defaultCaveman.transcript
    },
    helper: {
      ...defaultHelper,
      ...(raw.helper ?? {}),
      open: Boolean(raw.helper?.open),
      transcript: Array.isArray(raw.helper?.transcript) && raw.helper.transcript.length
        ? raw.helper.transcript
            .filter((entry) => entry && (entry.role === "bot" || entry.role === "user"))
            .map((entry) => ({
              role: entry.role,
              text: String(entry.text ?? "")
            }))
            .slice(-18)
        : defaultHelper.transcript
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

function setActiveRealm(realm) {
  state.activeRealm = realm;
  saveState();
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function renderRealmNavigation() {
  const activeRealm = state.activeRealm || "portal";
  document.body.dataset.realm = activeRealm;
  document.querySelectorAll(".realm-tab").forEach((button) => {
    const isActive = button.getAttribute("data-realm-target") === activeRealm;
    button.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll("[data-realm-pane]").forEach((pane) => {
    const matches = pane.getAttribute("data-realm-pane") === activeRealm;
    pane.classList.toggle("hidden", !matches);
  });
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
  document.querySelectorAll("[data-tab-group='caveman']").forEach((button) => {
    const active = button.getAttribute("data-tab-id") === state.activeCavemanTab;
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelector("#cryptoPaneBoard")?.classList.toggle("hidden", state.activeCryptoTab !== "board");
  document.querySelector("#cryptoPaneWatchlist")?.classList.toggle("hidden", state.activeCryptoTab !== "watchlist");
  document.querySelector("#cryptoPanePulse")?.classList.toggle("hidden", state.activeCryptoTab !== "pulse");
  document.querySelector("#cavemanPaneChat")?.classList.toggle("hidden", state.activeCavemanTab !== "chat");
  document.querySelector("#cavemanPaneGift")?.classList.toggle("hidden", state.activeCavemanTab !== "gift");
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
  const realms = [
    { max: 0.12, label: "Threshold" },
    { max: 0.32, label: "Signal Gate" },
    { max: 0.58, label: "Vortex Wake" },
    { max: 0.82, label: "Abyss Core" },
    { max: 1, label: "Other Realm" }
  ];
  const maxScroll = () =>
    Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

  const updateScrollMotion = () => {
    const progress = window.scrollY / maxScroll();
    const realm = realms.find((entry) => progress <= entry.max) || realms[realms.length - 1];
    rootStyle.setProperty("--scene-zoom", String(1 + progress * 0.42));
    rootStyle.setProperty("--scene-rotate", `${-10 + progress * 34}deg`);
    rootStyle.setProperty("--scene-card-shift", `${progress * 84}px`);
    rootStyle.setProperty("--realm-progress", progress.toFixed(4));
    rootStyle.setProperty("--portal-energy", String(1 + progress * 0.5));
    if (els.realmLabel) {
      els.realmLabel.textContent = realm.label;
    }
    if (els.realmDepthValue) {
      els.realmDepthValue.textContent = `${Math.round(progress * 100)}% depth`;
    }
  };

  const updatePointerMotion = (event) => {
    const xRatio = event.clientX / window.innerWidth - 0.5;
    const yRatio = event.clientY / window.innerHeight - 0.5;
    rootStyle.setProperty("--scene-drift-x", `${xRatio * 38}px`);
    rootStyle.setProperty("--scene-drift-y", `${yRatio * 28}px`);
    rootStyle.setProperty("--pointer-x", `${event.clientX}px`);
    rootStyle.setProperty("--pointer-y", `${event.clientY}px`);
    rootStyle.setProperty("--pointer-tilt-x", `${xRatio * 10}deg`);
    rootStyle.setProperty("--pointer-tilt-y", `${yRatio * -10}deg`);
  };

  const pulseScene = (event) => {
    rootStyle.setProperty("--pulse-x", `${event.clientX}px`);
    rootStyle.setProperty("--pulse-y", `${event.clientY}px`);
    rootStyle.setProperty("--pointer-x", `${event.clientX}px`);
    rootStyle.setProperty("--pointer-y", `${event.clientY}px`);
    rootStyle.setProperty("--scene-zoom", String(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--scene-zoom")) + 0.05));
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
  els.radioControls.classList.toggle("hidden", !accepted);

  if (!enabled) {
    stopRadio();
  }
}

function shouldResumeRadioAutoplay() {
  return Boolean(state.radio.enabled) && PAGE_DEFAULT_REALM === "radio" && sessionStorage.getItem(RADIO_AUTOPLAY_KEY) === "1";
}

function showRadioWelcome() {
  els.radioWelcomeModal.classList.remove("hidden");
}

function hideRadioWelcome() {
  els.radioWelcomeModal.classList.add("hidden");
}

function loadDefaultRadio(autoplay) {
  if (!state.radio.enabled) {
    setRadioStatus("Accept the radio prompt first so playback stays opt-in.");
    return;
  }

  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    playsinline: "1",
    rel: "0"
  });

  if (DEFAULT_RADIO_STATION.kind === "playlist" && DEFAULT_RADIO_STATION.playlistId) {
    els.radioPlayer.src =
      `https://www.youtube.com/embed?listType=playlist&list=${encodeURIComponent(DEFAULT_RADIO_STATION.playlistId)}&${params.toString()}`;
  } else {
    if (DEFAULT_RADIO_STATION.leadVideoId) {
      params.set("loop", "1");
      params.set("playlist", DEFAULT_RADIO_STATION.leadVideoId);
    }
    els.radioPlayer.src = `https://www.youtube.com/embed/${DEFAULT_RADIO_STATION.leadVideoId}?${params.toString()}`;
  }
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

function createDefaultCavemanState() {
  return {
    name: "",
    email: "",
    useOllama: true,
    mailStatus: "Enter your name and email, then let the cave prepare the message.",
    transcript: DEFAULT_CAVEMAN_TRANSCRIPT.map((entry) => ({ ...entry }))
  };
}

function createDefaultHelperState() {
  return {
    open: false,
    transcript: [
      {
        role: "bot",
        text: "Purr. I am Luna, the site guide. Ask me where things live or how to use this page."
      }
    ]
  };
}

function sanitizeCavemanName(value) {
  return value.replace(/[^a-zA-Z' -]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

function sanitizeEmail(value) {
  return value.trim().slice(0, 120);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractNameFromMessage(message) {
  const patterns = [
    /my name is\s+([a-z][a-z' -]{0,38})/i,
    /i am\s+([a-z][a-z' -]{0,38})/i,
    /i'm\s+([a-z][a-z' -]{0,38})/i
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return sanitizeCavemanName(match[1]);
    }
  }
  return "";
}

function extractEmailFromMessage(message) {
  const match = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? sanitizeEmail(match[0]) : "";
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
