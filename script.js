const STORAGE_KEY = "little-sips-feed-log";
const params = new URLSearchParams(window.location.search);
const storageMode = params.get("storage");
const memoryStore = createMemoryStore();
const storage = resolveStorage();

const feedForm = document.querySelector("#feedForm");
const feedTimeInput = document.querySelector("#feedTime");
const feedAmountInput = document.querySelector("#feedAmount");
const feedNoteInput = document.querySelector("#feedNote");
const quickAmountButtons = document.querySelectorAll(".chip-btn");
const reportDateInput = document.querySelector("#reportDate");
const todayDateLabel = document.querySelector("#todayDateLabel");
const totalMl = document.querySelector("#totalMl");
const totalFeeds = document.querySelector("#totalFeeds");
const averageFeed = document.querySelector("#averageFeed");
const lastFeed = document.querySelector("#lastFeed");
const reportCaption = document.querySelector("#reportCaption");
const feedList = document.querySelector("#feedList");
const emptyState = document.querySelector("#emptyState");
const historyTableBody = document.querySelector("#historyTableBody");
const historyEmpty = document.querySelector("#historyEmpty");
const feedItemTemplate = document.querySelector("#feedItemTemplate");
const installAppBtn = document.querySelector("#installAppBtn");
const shareAppBtn = document.querySelector("#shareAppBtn");
const shareReportBtn = document.querySelector("#shareReportBtn");
const exportDataBtn = document.querySelector("#exportDataBtn");
const importDataInput = document.querySelector("#importDataInput");
const appStatus = document.querySelector("#appStatus");

let feedEntries = loadEntries();
let deferredInstallPrompt = null;

initialize();

function initialize() {
  const now = new Date();
  const today = formatDateKey(now);

  todayDateLabel.textContent = formatFriendlyDate(now);
  reportDateInput.value = today;
  feedTimeInput.value = toDateTimeLocalValue(now);

  feedForm.addEventListener("submit", handleFeedSave);
  reportDateInput.addEventListener("change", renderApp);
  feedList.addEventListener("click", handleFeedDelete);
  installAppBtn.addEventListener("click", handleInstallApp);
  shareAppBtn.addEventListener("click", handleShareApp);
  shareReportBtn.addEventListener("click", handleShareReport);
  exportDataBtn.addEventListener("click", handleExportData);
  importDataInput.addEventListener("change", handleImportData);

  quickAmountButtons.forEach((button) => {
    button.addEventListener("click", handleQuickAmountSelect);
  });

  setupInstallPrompt();
  registerServiceWorker();
  updateOnlineStatus();
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  renderApp();
}

function handleFeedSave(event) {
  event.preventDefault();

  const amount = Number(feedAmountInput.value);
  const timestamp = feedTimeInput.value;
  const note = feedNoteInput.value.trim();

  if (!timestamp || Number.isNaN(amount) || amount <= 0) {
    setStatus("Enter a feed time and a milk amount greater than 0 ml.");
    return;
  }

  const entry = {
    id: createId(),
    amount,
    timestamp,
    note,
    createdAt: new Date().toISOString(),
  };

  feedEntries.push(entry);
  feedEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  saveEntries();

  reportDateInput.value = formatDateKey(new Date(timestamp));
  feedAmountInput.value = "";
  feedNoteInput.value = "";
  feedTimeInput.value = toDateTimeLocalValue(new Date());

  renderApp();
  setStatus("Feed saved.");
}

function handleFeedDelete(event) {
  const button = event.target.closest(".delete-btn");

  if (!button) {
    return;
  }

  const { entryId } = button.dataset;
  feedEntries = feedEntries.filter((entry) => entry.id !== entryId);
  saveEntries();
  renderApp();
  setStatus("Feed deleted.");
}

function handleQuickAmountSelect(event) {
  const amount = event.currentTarget.dataset.amount;

  if (!amount) {
    return;
  }

  feedAmountInput.value = amount;
  feedAmountInput.focus();
}

async function handleInstallApp() {
  if (!deferredInstallPrompt) {
    setStatus("Install works after this app is hosted on a shareable link and opened in a supported phone browser.");
    return;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;

  if (choice.outcome === "accepted") {
    setStatus("Little Sips installed to your home screen.");
  }

  deferredInstallPrompt = null;
  installAppBtn.classList.add("hidden");
}

async function handleShareApp() {
  const shareData = {
    title: "Little Sips Tracker",
    text: "Use this mobile-friendly baby feeding tracker to log feeds and daily totals.",
    url: window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      setStatus("App link shared.");
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }

  await copyToClipboard(window.location.href);
  setStatus("App link copied to the clipboard.");
}

async function handleShareReport() {
  const selectedDate = reportDateInput.value || formatDateKey(new Date());
  const dayEntries = getEntriesForDate(selectedDate);
  const summary = buildReportText(dayEntries, selectedDate);

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Little Sips Daily Report",
        text: summary,
      });
      setStatus("Daily report shared.");
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }

  await copyToClipboard(summary);
  setStatus("Daily report copied to the clipboard.");
}

function handleExportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    entries: feedEntries,
  };
  const fileDate = formatDateKey(new Date());
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = `little-sips-backup-${fileDate}.json`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
  setStatus("Backup exported.");
}

async function handleImportData(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  try {
    const contents = await file.text();
    const parsed = JSON.parse(contents);
    const importedEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const normalizedEntries = importedEntries
      .filter(isValidEntry)
      .map((entry) => ({
        id: entry.id || createId(),
        amount: Number(entry.amount),
        timestamp: entry.timestamp,
        note: typeof entry.note === "string" ? entry.note : "",
        createdAt: entry.createdAt || new Date().toISOString(),
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    feedEntries = normalizedEntries;
    saveEntries();
    renderApp();
    setStatus(`Imported ${normalizedEntries.length} feeds from backup.`);
  } catch (error) {
    console.error("Could not import backup", error);
    setStatus("That backup file could not be imported.");
  } finally {
    importDataInput.value = "";
  }
}

function renderApp() {
  const selectedDate = reportDateInput.value || formatDateKey(new Date());
  const dayEntries = getEntriesForDate(selectedDate);

  renderSummary(dayEntries, selectedDate);
  renderFeedList(dayEntries);
  renderHistory();
}

function renderSummary(entries, selectedDate) {
  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const feedCount = entries.length;
  const averageAmount = feedCount ? Math.round(totalAmount / feedCount) : 0;

  totalMl.textContent = `${totalAmount} ml`;
  totalFeeds.textContent = String(feedCount);
  averageFeed.textContent = `${averageAmount} ml`;
  lastFeed.textContent = feedCount
    ? formatTime(new Date(entries[0].timestamp))
    : "--";

  reportCaption.textContent =
    `${formatFriendlyDate(new Date(`${selectedDate}T00:00`))} | ` +
    `${feedCount} feed${feedCount === 1 ? "" : "s"} | ${totalAmount} ml`;
}

function renderFeedList(entries) {
  feedList.innerHTML = "";

  if (!entries.length) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  entries.forEach((entry) => {
    const item = feedItemTemplate.content.firstElementChild.cloneNode(true);
    const note = entry.note ? ` | ${entry.note}` : "";

    item.querySelector(".feed-time").textContent = formatTime(new Date(entry.timestamp));
    item.querySelector(".feed-meta").textContent =
      `${formatFriendlyDate(new Date(entry.timestamp))}${note}`;
    item.querySelector(".feed-amount").textContent = `${entry.amount} ml`;
    item.querySelector(".delete-btn").dataset.entryId = entry.id;

    feedList.appendChild(item);
  });
}

function renderHistory() {
  historyTableBody.innerHTML = "";

  const groupedEntries = groupByDate(feedEntries);
  const days = Object.keys(groupedEntries).sort((a, b) => new Date(b) - new Date(a));

  if (!days.length) {
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyEmpty.classList.add("hidden");

  days.forEach((dateKey) => {
    const entries = groupedEntries[dateKey];
    const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const averageAmount = Math.round(totalAmount / entries.length);
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatFriendlyDate(new Date(`${dateKey}T00:00`))}</td>
      <td>${totalAmount} ml</td>
      <td>${entries.length}</td>
      <td>${averageAmount} ml</td>
    `;

    historyTableBody.appendChild(row);
  });
}

function getEntriesForDate(selectedDate) {
  return feedEntries
    .filter((entry) => formatDateKey(new Date(entry.timestamp)) === selectedDate)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function groupByDate(entries) {
  return entries.reduce((groups, entry) => {
    const dateKey = formatDateKey(new Date(entry.timestamp));

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(entry);
    return groups;
  }, {});
}

function loadEntries() {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Could not load saved feeds", error);
    return [];
  }
}

function saveEntries() {
  storage.setItem(STORAGE_KEY, JSON.stringify(feedEntries));
}

function resolveStorage() {
  if (storageMode === "session") {
    return window.sessionStorage;
  }

  if (storageMode === "memory") {
    return memoryStore;
  }

  return window.localStorage;
}

function createMemoryStore() {
  const values = {};

  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      values[key] = String(value);
    },
    removeItem(key) {
      delete values[key];
    },
  };
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `feed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installAppBtn.classList.remove("hidden");
    setStatus("This app can be installed on a phone home screen.");
  });

  window.addEventListener("appinstalled", () => {
    installAppBtn.classList.add("hidden");
    setStatus("Little Sips was installed successfully.");
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}

function updateOnlineStatus() {
  if (!navigator.onLine) {
    setStatus("You are offline, but previously loaded screens still work.");
    return;
  }

  setStatus(
    "Ready on this device. Host this folder online to share the app by link and install it on phones."
  );
}

function buildReportText(entries, selectedDate) {
  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const feedCount = entries.length;
  const averageAmount = feedCount ? Math.round(totalAmount / feedCount) : 0;
  const lastFeedTime = feedCount ? formatTime(new Date(entries[0].timestamp)) : "--";

  return [
    `Little Sips daily report for ${formatFriendlyDate(new Date(`${selectedDate}T00:00`))}`,
    `Total milk: ${totalAmount} ml`,
    `Total feeds: ${feedCount}`,
    `Average feed: ${averageAmount} ml`,
    `Last feed: ${lastFeedTime}`,
  ].join("\n");
}

async function copyToClipboard(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const tempInput = document.createElement("textarea");
  tempInput.value = value;
  tempInput.style.position = "fixed";
  tempInput.style.opacity = "0";
  document.body.appendChild(tempInput);
  tempInput.focus();
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);
}

function isValidEntry(entry) {
  return (
    entry &&
    typeof entry.timestamp === "string" &&
    !Number.isNaN(Number(entry.amount)) &&
    Number(entry.amount) > 0
  );
}

function setStatus(message) {
  appStatus.textContent = message;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatFriendlyDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
