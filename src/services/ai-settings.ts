export const AI_SETTINGS_STORAGE_KEY = "chromnotes_ai_settings";

export type AiSettings = {
  apiKey: string | null;
};

let cachedSettings: AiSettings | null = null;

function sanitizeKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readFromStorage(): AiSettings {
  if (cachedSettings) {
    return cachedSettings;
  }
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      cachedSettings = { apiKey: null };
      return cachedSettings;
    }
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    cachedSettings = {
      apiKey: sanitizeKey(parsed.apiKey)
    };
    return cachedSettings;
  } catch (error) {
    console.warn("Chromnotes: failed to read AI settings.", error);
    cachedSettings = { apiKey: null };
    return cachedSettings;
  }
}

function writeToStorage(settings: AiSettings): void {
  try {
    if (!settings.apiKey) {
      localStorage.removeItem(AI_SETTINGS_STORAGE_KEY);
    } else {
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (error) {
    console.warn("Chromnotes: failed to persist AI settings.", error);
  }
}

export function getAiApiKey(): string | null {
  return readFromStorage().apiKey;
}

export function setAiApiKey(nextKey: string | null): AiSettings {
  const sanitized = sanitizeKey(nextKey);
  cachedSettings = {
    apiKey: sanitized
  };
  writeToStorage(cachedSettings);
  return cachedSettings;
}

export function clearAiApiKey(): void {
  cachedSettings = { apiKey: null };
  writeToStorage(cachedSettings);
}

export function hasAiApiKey(): boolean {
  return Boolean(getAiApiKey());
}
