import type { Connection, Preferences, RuntimeState } from "./types";

const CONNECTION_KEY = "flow2MetadataConnection";
const PREFERENCES_KEY = "flow2MetadataPreferences";
const RUNTIME_KEY = "flow2MetadataRuntime";

export const DEFAULT_BASE_URL = "https://flow-api.prismacreative.online";

export const DEFAULT_PREFERENCES: Preferences = {
  mode: "upload",
  autoCategory: false,
  language: "en",
  titleSuffix: "none",
  titlePrefix: "",
  customTitleSuffix: "",
  limitsEnabled: false,
  titleMin: 80,
  titleMax: 150,
  keywordMin: 30,
  keywordMax: 40,
  customPromptEnabled: false,
  customPrompt: "",
};

export const DEFAULT_RUNTIME: RuntimeState = {
  processing: false,
  stopped: false,
  processed: 0,
  successes: 0,
  currentPage: 1,
  message: "Ready to start",
};

export async function getConnection(): Promise<Connection | null> {
  const result = await chrome.storage.local.get(CONNECTION_KEY);
  return (result[CONNECTION_KEY] as Connection | undefined) ?? null;
}

export async function saveConnection(connection: Connection): Promise<void> {
  await chrome.storage.local.set({ [CONNECTION_KEY]: connection });
}

export async function invalidateConnection(): Promise<void> {
  const connection = await getConnection();
  if (connection) await saveConnection({ ...connection, validatedAt: 0 });
}

export async function clearConnection(): Promise<void> {
  await chrome.storage.local.remove(CONNECTION_KEY);
}

export async function getPreferences(): Promise<Preferences> {
  const result = await chrome.storage.local.get(PREFERENCES_KEY);
  return { ...DEFAULT_PREFERENCES, ...(result[PREFERENCES_KEY] as Partial<Preferences> | undefined) };
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await chrome.storage.local.set({ [PREFERENCES_KEY]: preferences });
}

export async function getRuntimeState(): Promise<RuntimeState> {
  const result = await chrome.storage.local.get(RUNTIME_KEY);
  return { ...DEFAULT_RUNTIME, ...(result[RUNTIME_KEY] as Partial<RuntimeState> | undefined) };
}

export async function saveRuntimeState(state: RuntimeState): Promise<void> {
  await chrome.storage.local.set({ [RUNTIME_KEY]: state });
}
