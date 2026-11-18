const DEFAULT_SETTINGS = {
  threshold: 6,
  scanVideo: false,
  apiKey: "",
  apiUrl: "https://api.modesty.nsfw/scan",
};
const thresholdInput = document.getElementById("threshold");
const apiKeyInput = document.getElementById("api-key");
const apiUrlInput = document.getElementById("api-url");
const videoInput = document.getElementById("scan-video");
const status = document.getElementById("status");
const error = document.getElementById("error");
const retryButton = document.getElementById("retry");

function showError(message) {
  error.textContent = message;
  error.hidden = !message;
}

function normalizedScannerUrl(value) {
  let endpoint;
  try {
    endpoint = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid HTTPS scan service URL ending in /scan.");
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash || !endpoint.pathname.endsWith("/scan")) {
    throw new Error("The scan service URL must use HTTPS and end in /scan.");
  }
  return endpoint.href;
}

async function saveSettings() {
  const threshold = Number(thresholdInput.value);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 10) {
    showError("Choose a whole-number rating from 1 to 10.");
    return;
  }
  let scannerUrl;
  try {
    scannerUrl = normalizedScannerUrl(apiUrlInput.value);
  } catch (saveError) {
    showError(saveError.message);
    return;
  }
  await chrome.storage.sync.set({
    threshold,
    scanVideo: videoInput.checked,
    scannerUrl,
    apiKey: apiKeyInput.value.trim(),
  });
  apiUrlInput.value = scannerUrl;
  showError("");
}

async function showPageStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      status.textContent = "No active page.";
      return;
    }
    const result = await chrome.tabs.sendMessage(tab.id, { type: "get-scan-status" });
    status.textContent =
      `${result.blockedCount} blocked · ${result.unassessedCount} not assessed`;
  } catch {
    status.textContent = "Open a regular website to scan its images.";
  }
}

async function retryUnassessed() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active page.");
    await chrome.tabs.sendMessage(tab.id, { type: "retry-unassessed" });
    showError("");
    status.textContent = "Retrying media that was not assessed…";
  } catch {
    showError("Open a regular website before retrying scans.");
  }
}

async function initialize() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const threshold = Number(settings.threshold);
  thresholdInput.value = String(
    Number.isInteger(threshold) && threshold >= 1 && threshold <= 10
      ? threshold
      : DEFAULT_SETTINGS.threshold,
  );
  const scannerUrl = settings.scannerUrl || DEFAULT_SETTINGS.apiUrl;
  try {
    apiUrlInput.value = normalizedScannerUrl(scannerUrl);
  } catch {
    apiUrlInput.value = DEFAULT_SETTINGS.apiUrl;
  }
  apiKeyInput.value = settings.apiKey || "";
  videoInput.checked = settings.scanVideo === true;
  await showPageStatus();
}

thresholdInput.addEventListener("change", () => {
  saveSettings().catch(() => showError("Could not save your settings."));
});
apiUrlInput.addEventListener("change", () => {
  saveSettings().catch(() => showError("Could not save your settings."));
});
apiKeyInput.addEventListener("change", () => {
  saveSettings().catch(() => showError("Could not save your settings."));
});
videoInput.addEventListener("change", () => {
  saveSettings().catch(() => showError("Could not save your settings."));
});
retryButton.addEventListener("click", () => {
  retryUnassessed().catch(() => showError("Could not retry the scans."));
});

initialize().catch(() => showError("Could not load your settings."));
