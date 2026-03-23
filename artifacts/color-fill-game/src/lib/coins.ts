const LS_COINS = "cf_coins_v1";
const LS_INITIALIZED = "cf_coins_init";
const STARTING_COINS = 100;

export function loadCoins(): number {
  try {
    const initialized = localStorage.getItem(LS_INITIALIZED);
    if (!initialized) {
      localStorage.setItem(LS_INITIALIZED, "1");
      localStorage.setItem(LS_COINS, String(STARTING_COINS));
      return STARTING_COINS;
    }
    const raw = localStorage.getItem(LS_COINS);
    return raw !== null ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch { return 0; }
}

export function saveCoins(n: number): void {
  try { localStorage.setItem(LS_COINS, String(Math.max(0, Math.round(n)))); } catch {}
}

export function coinsForStars(stars: number): number {
  return stars === 3 ? 50 : stars === 2 ? 25 : 10;
}

export function addWatchAdCoins(): number {
  const current = loadCoins();
  const next = current + 50;
  saveCoins(next);
  return next;
}
