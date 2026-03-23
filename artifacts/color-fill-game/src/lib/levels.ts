export type Difficulty = "easy" | "medium" | "hard";

export const TOTAL_LEVELS = 30;
const DEFAULT_UNLOCKED = 3;

const BASE_COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6"];
const HARD_EXTRA = "#E67E22";

export interface LevelCfg {
  num: number;
  difficulty: Difficulty;
  gridSize: number;
  canvasSize: number;
  moveLimit: number;
  timeLimit: number;
  colors: string[];
}

export function getLevelCfg(num: number): LevelCfg {
  if (num <= 10) {
    return { num, difficulty: "easy", gridSize: 8, canvasSize: 320, moveLimit: 25, timeLimit: 60, colors: [...BASE_COLORS] };
  } else if (num <= 20) {
    return { num, difficulty: "medium", gridSize: 10, canvasSize: 340, moveLimit: 22, timeLimit: 45, colors: [...BASE_COLORS] };
  } else {
    return { num, difficulty: "hard", gridSize: 14, canvasSize: 336, moveLimit: 28, timeLimit: 35, colors: [...BASE_COLORS, HARD_EXTRA] };
  }
}

export interface LevelProgress {
  stars: number;
  unlocked: boolean;
}

const LS_PROGRESS = "cf_progress_v1";
const LS_OVERALL = "cf_overall_best";

export function loadProgress(): LevelProgress[] {
  try {
    const raw = localStorage.getItem(LS_PROGRESS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === TOTAL_LEVELS) return parsed;
    }
  } catch {}
  return Array.from({ length: TOTAL_LEVELS }, (_, i) => ({
    stars: 0,
    unlocked: i < DEFAULT_UNLOCKED,
  }));
}

export function saveProgress(p: LevelProgress[]): void {
  try { localStorage.setItem(LS_PROGRESS, JSON.stringify(p)); } catch {}
}

export function updateLevelProgress(levelNum: number, stars: number, progress: LevelProgress[]): LevelProgress[] {
  const next = [...progress];
  const idx = levelNum - 1;
  if (stars > next[idx].stars) next[idx].stars = stars;
  next[idx].unlocked = true;
  if (idx + 1 < TOTAL_LEVELS) next[idx + 1].unlocked = true;
  return next;
}

export function getOverallBest(): number {
  try { return parseInt(localStorage.getItem(LS_OVERALL) || "0", 10) || 0; } catch { return 0; }
}

export function saveOverallBest(score: number): void {
  try {
    if (score > getOverallBest()) localStorage.setItem(LS_OVERALL, String(score));
  } catch {}
}

export function totalStars(progress: LevelProgress[]): number {
  return progress.reduce((s, p) => s + p.stars, 0);
}
