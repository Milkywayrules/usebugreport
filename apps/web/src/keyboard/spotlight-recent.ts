const STORAGE_KEY = "ubr_spotlight_recent";

export interface SpotlightRecentEntry {
  actionId: string;
  timestamp: number;
}

export function readSpotlightRecent(): SpotlightRecentEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as SpotlightRecentEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((row) => typeof row.actionId === "string").slice(0, 5);
  } catch {
    return [];
  }
}

export function recordSpotlightRecent(actionId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = [
    { actionId, timestamp: Date.now() },
    ...readSpotlightRecent().filter((row) => row.actionId !== actionId),
  ].slice(0, 5);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
