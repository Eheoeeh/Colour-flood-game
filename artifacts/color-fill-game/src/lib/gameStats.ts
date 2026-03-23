const LS_STATS = "cf_game_stats_v1";

export interface GameStats {
  totalMoves: number;
  totalTimeSec: number;
  colorUsage: Record<string, number>;
  totalCoinsEarned: number;
}

const DEFAULT: GameStats = {
  totalMoves: 0,
  totalTimeSec: 0,
  colorUsage: {},
  totalCoinsEarned: 0,
};

export function loadGameStats(): GameStats {
  try {
    const raw = localStorage.getItem(LS_STATS);
    if (!raw) return { ...DEFAULT, colorUsage: {} };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed, colorUsage: parsed.colorUsage ?? {} };
  } catch { return { ...DEFAULT, colorUsage: {} }; }
}

export function saveGameStats(s: GameStats): void {
  try { localStorage.setItem(LS_STATS, JSON.stringify(s)); } catch {}
}

export function recordMove(color: string): void {
  const s = loadGameStats();
  s.totalMoves++;
  s.colorUsage[color] = (s.colorUsage[color] || 0) + 1;
  saveGameStats(s);
}

export function recordTimePlayed(seconds: number): void {
  if (seconds <= 0) return;
  const s = loadGameStats();
  s.totalTimeSec += Math.round(seconds);
  saveGameStats(s);
}

export function recordCoinsEarned(amount: number): void {
  if (amount <= 0) return;
  const s = loadGameStats();
  s.totalCoinsEarned += amount;
  saveGameStats(s);
}

export function getFavoriteColor(s: GameStats): string | null {
  const entries = Object.entries(s.colorUsage);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export function formatTimePlayed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

export function clearGameStats(): void {
  try { localStorage.removeItem(LS_STATS); } catch {}
}
