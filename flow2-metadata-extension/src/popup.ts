import { DEFAULT_BASE_URL, DEFAULT_PREFERENCES, getPreferences, getRuntimeState, savePreferences } from "./storage";
import type { LanguageCode, Preferences, ProcessingMode, RuntimeState, TitleSuffix } from "./types";
import { ensureOriginPermission, normalizeBaseUrl } from "./url-policy";

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const connectionView = byId<HTMLElement>("connectionView");
const notAdobeView = byId<HTMLElement>("notAdobeView");
const appView = byId<HTMLElement>("appView");
const baseUrlInput = byId<HTMLInputElement>("baseUrl");
const apiKeyInput = byId<HTMLInputElement>("apiKey");
const connectionError = byId<HTMLElement>("connectionError");
const startButton = byId<HTMLButtonElement>("startButton");
const resumeButton = byId<HTMLButtonElement>("resumeButton");
const stopButton = byId<HTMLButtonElement>("stopButton");
const statusElement = byId<HTMLElement>("status");

let preferences: Preferences = { ...DEFAULT_PREFERENCES };

function showError(message = "") {
  connectionError.textContent = message;
  connectionError.hidden = !message;
}

async function activeAdobeTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url && /^https:\/\/([a-z]{2}\.)?contributor\.stock\.adobe\.com\//i.test(tab.url) ? tab : null;
}

function showConnection(baseUrl = DEFAULT_BASE_URL) {
  baseUrlInput.value = baseUrl;
  apiKeyInput.value = "";
  connectionView.hidden = false;
  appView.hidden = true;
  notAdobeView.hidden = true;
}

async function showApplication(keyLabel: string) {
  connectionView.hidden = true;
  const tab = await activeAdobeTab();
  notAdobeView.hidden = Boolean(tab);
  appView.hidden = !tab;
  byId("connectionLabel").textContent = `Connected: ${keyLabel}`;
}

function numberValue(id: string, fallback: number): number {
  const value = Number(byId<HTMLInputElement>(id).value);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function readPreferences(): Preferences {
  return {
    mode: byId<HTMLButtonElement>("portfolioMode").classList.contains("active") ? "portfolio" : "upload",
    autoCategory: byId<HTMLInputElement>("autoCategory").checked,
    language: byId<HTMLSelectElement>("language").value as LanguageCode,
    titleSuffix: byId<HTMLSelectElement>("titleSuffix").value as TitleSuffix,
    titlePrefix: byId<HTMLInputElement>("titlePrefix").value.trim(),
    customTitleSuffix: byId<HTMLInputElement>("customTitleSuffix").value.trim(),
    limitsEnabled: byId<HTMLInputElement>("limitsEnabled").checked,
    titleMin: numberValue("titleMin", 80),
    titleMax: numberValue("titleMax", 150),
    keywordMin: numberValue("keywordMin", 30),
    keywordMax: numberValue("keywordMax", 40),
    customPromptEnabled: byId<HTMLInputElement>("customPromptEnabled").checked,
    customPrompt: byId<HTMLTextAreaElement>("customPrompt").value,
  };
}

async function persistPreferences(): Promise<boolean> {
  const next = readPreferences();
  if (next.titleMin > next.titleMax || next.keywordMin > next.keywordMax) {
    statusElement.textContent = "Minimum values cannot exceed maximum values.";
    return false;
  }
  preferences = next;
  await savePreferences(next);
  return true;
}

function renderMode(mode: ProcessingMode) {
  byId("uploadMode").classList.toggle("active", mode === "upload");
  byId("portfolioMode").classList.toggle("active", mode === "portfolio");
}

function renderPreferences(value: Preferences) {
  preferences = value;
  renderMode(value.mode);
  byId<HTMLInputElement>("autoCategory").checked = value.autoCategory;
  byId<HTMLSelectElement>("language").value = value.language;
  byId<HTMLSelectElement>("titleSuffix").value = value.titleSuffix;
  byId<HTMLInputElement>("titlePrefix").value = value.titlePrefix;
  byId<HTMLInputElement>("customTitleSuffix").value = value.customTitleSuffix;
  byId<HTMLInputElement>("limitsEnabled").checked = value.limitsEnabled;
  byId<HTMLInputElement>("titleMin").value = String(value.titleMin);
  byId<HTMLInputElement>("titleMax").value = String(value.titleMax);
  byId<HTMLInputElement>("keywordMin").value = String(value.keywordMin);
  byId<HTMLInputElement>("keywordMax").value = String(value.keywordMax);
  byId<HTMLInputElement>("customPromptEnabled").checked = value.customPromptEnabled;
  byId<HTMLTextAreaElement>("customPrompt").value = value.customPrompt;
  byId<HTMLElement>("limits").hidden = !value.limitsEnabled;
  byId<HTMLElement>("customPromptWrap").hidden = !value.customPromptEnabled;
}

function renderRuntime(runtime: RuntimeState) {
  byId("processedCount").textContent = String(runtime.processed);
  const rate = runtime.processed ? Math.round((runtime.successes / runtime.processed) * 100) : 0;
  byId("successRate").textContent = `${rate}%`;
  statusElement.textContent = runtime.message;
  startButton.disabled = runtime.processing;
  resumeButton.disabled = runtime.processing || !runtime.stopped || runtime.processed === 0;
  stopButton.disabled = !runtime.processing;
}

async function connect() {
  showError();
  const button = byId<HTMLButtonElement>("connectButton");
  button.disabled = true;
  button.textContent = "Connecting…";
  try {
    const baseUrl = normalizeBaseUrl(baseUrlInput.value);
    if (!(await ensureOriginPermission(baseUrl))) throw new Error("Host permission is required to connect to this Flow2 API server.");
    const response = await chrome.runtime.sendMessage({ type: "VALIDATE_CONNECTION", baseUrl, apiKey: apiKeyInput.value });
    if (!response?.success) throw new Error(response?.error || "Connection validation failed.");
    apiKeyInput.value = "";
    await showApplication(response.keyLabel);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Connection validation failed.");
  } finally {
    button.disabled = false;
    button.textContent = "Connect";
  }
}

async function sendToActiveTab(message: unknown) {
  const tab = await activeAdobeTab();
  if (!tab?.id) throw new Error("Open an Adobe Stock Contributor Uploads or Portfolio page.");
  return chrome.tabs.sendMessage(tab.id, message);
}

byId("connectButton").addEventListener("click", () => void connect());
byId("disconnectButton").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "DISCONNECT" });
  showConnection();
});
byId("editConnection").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "GET_CONNECTION_STATUS" });
  showConnection(response?.baseUrl || DEFAULT_BASE_URL);
});
byId("openAdobeButton").addEventListener("click", () => void chrome.tabs.create({ url: "https://contributor.stock.adobe.com/" }));

for (const mode of ["upload", "portfolio"] as const) {
  byId(`${mode}Mode`).addEventListener("click", () => {
    renderMode(mode);
    void persistPreferences();
  });
}

for (const id of ["autoCategory", "language", "titleSuffix", "titlePrefix", "customTitleSuffix", "limitsEnabled", "titleMin", "titleMax", "keywordMin", "keywordMax", "customPromptEnabled", "customPrompt"]) {
  byId(id).addEventListener("change", () => {
    if (id === "limitsEnabled") byId("limits").hidden = !byId<HTMLInputElement>(id).checked;
    if (id === "customPromptEnabled") byId("customPromptWrap").hidden = !byId<HTMLInputElement>(id).checked;
    void persistPreferences();
  });
}

startButton.addEventListener("click", async () => {
  try {
    if (!(await persistPreferences())) throw new Error("Fix the metadata limit values before starting.");
    const start = numberValue("startIndex", 1);
    const rawEnd = byId<HTMLInputElement>("endIndex").value.trim();
    const end = rawEnd ? numberValue("endIndex", start) : 0;
    if (end && start > end) throw new Error("Start index cannot exceed end index.");
    const response = await sendToActiveTab({ action: "startProcessing", mode: preferences.mode, startIndex: start, endIndex: end });
    if (!response?.success) throw new Error(response?.error || "Unable to start processing.");
    renderRuntime({ ...await getRuntimeState(), processing: true, message: "Starting processing…" });
  } catch (error) {
    statusElement.textContent = error instanceof Error ? error.message : "Unable to start processing.";
  }
});

resumeButton.addEventListener("click", async () => {
  try {
    const response = await sendToActiveTab({ action: "resumeProcessing" });
    if (!response?.success) throw new Error(response?.error || "Unable to resume processing.");
    renderRuntime({ ...await getRuntimeState(), processing: true, stopped: false, message: "Resuming processing…" });
  } catch (error) {
    statusElement.textContent = error instanceof Error ? error.message : "Unable to resume processing.";
  }
});

stopButton.addEventListener("click", async () => {
  try { await sendToActiveTab({ action: "stopProcessing" }); }
  catch (error) { statusElement.textContent = error instanceof Error ? error.message : "Unable to stop."; }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PROCESSING_UPDATE") renderRuntime(message.state as RuntimeState);
  if (message?.type === "CONNECTION_INVALID") showConnection(message.baseUrl || DEFAULT_BASE_URL);
});

document.addEventListener("DOMContentLoaded", async () => {
  renderPreferences(await getPreferences());
  renderRuntime(await getRuntimeState());
  const response = await chrome.runtime.sendMessage({ type: "GET_CONNECTION_STATUS", action: "revalidate" });
  if (response?.connected) await showApplication(response.keyLabel);
  else {
    showConnection(response?.baseUrl || DEFAULT_BASE_URL);
    if (response?.error) showError(response.error);
  }
});
