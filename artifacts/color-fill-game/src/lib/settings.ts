export interface GameSettings {
  sound: boolean;
  music: boolean;
  colorblind: boolean;
  vibration: boolean;
}

const LS_KEY = "cf_settings_v1";

const DEFAULTS: GameSettings = { sound: true, music: true, colorblind: false, vibration: true };

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function saveSettings(s: GameSettings): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}
