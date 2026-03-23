const VERSION_KEY = "cf_version";
const CURRENT_VERSION = "v2";

export function initStorage(): void {
  try {
    const stored = localStorage.getItem(VERSION_KEY);
    if (stored === CURRENT_VERSION) return;

    // Version mismatch or first install — wipe all old game data
    const toRemove = Object.keys(localStorage).filter(k => k.startsWith("cf_"));
    toRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);

    console.log(
      `[Storage] Fresh start: migrated ${stored ?? "none"} → ${CURRENT_VERSION}. ` +
      `Cleared ${toRemove.length} stale keys.`
    );
  } catch (e) {
    console.warn("[Storage] initStorage failed:", e);
  }
}
