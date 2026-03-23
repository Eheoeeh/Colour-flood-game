import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import { TOTAL_LEVELS } from "@/lib/levels";
import { loadSettings } from "@/lib/settings";
import { loadCoins, saveCoins, coinsForStars } from "@/lib/coins";
import { playSound } from "@/lib/sound";
import { recordMove, recordTimePlayed, recordCoinsEarned } from "@/lib/gameStats";

// ─── Constants ────────────────────────────────────────────────────────────────
const GAP = 1;
const WAVE_MS = 18;
const PULSE_MS = 130;
const BASE_COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6"] as const;
const HARD_EXTRA = "#E67E22";
const CONFETTI_COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6", "#E67E22", "#ffffff"];
const TIPS = [
  "Focus on capturing large color regions first!",
  "Pick colors adjacent to your territory for biggest gains.",
  "Hint rings show colors that will expand your region!",
  "Watch the timer — speed bonuses add up fast!",
  "Combos trigger after 3 perfect moves in a row!",
  "A perfect move captures more than 10% of remaining cells.",
  "Start from the corner — it gives you the most reach.",
  "On hard mode, plan two moves ahead!",
];

// ─── Power-up config ──────────────────────────────────────────────────────────
const POWER_UPS = [
  { id: "freeze" as const, icon: "❄️", name: "Freeze", cost: 20, max: 3, color: "#64d8fc", desc: "5s timer stop" },
  { id: "hint"   as const, icon: "💡", name: "Hint",   cost: 15, max: 3, color: "#F1C40F", desc: "Best move flash" },
  { id: "bomb"   as const, icon: "💣", name: "Bomb",   cost: 30, max: 2, color: "#E67E22", desc: "3×3 color blast" },
] as const;

type PowerUpId = "freeze" | "hint" | "bomb";
type UsedPU = Record<PowerUpId, number>;

type Difficulty = "easy" | "medium" | "hard";

interface Cfg {
  label: string;
  gridSize: number;
  canvasSize: number;
  moveLimit: number;
  timeLimit: number;
  colors: string[];
}

const DIFFICULTIES: Record<Difficulty, Cfg> = {
  easy:   { label: "Easy",   gridSize: 8,  canvasSize: 320, moveLimit: 25, timeLimit: 60, colors: [...BASE_COLORS] },
  medium: { label: "Medium", gridSize: 10, canvasSize: 340, moveLimit: 22, timeLimit: 45, colors: [...BASE_COLORS] },
  hard:   { label: "Hard",   gridSize: 14, canvasSize: 336, moveLimit: 28, timeLimit: 35, colors: [...BASE_COLORS, HARD_EXTRA] },
};

interface GameProps {
  levelNum?: number;
  onBack?: () => void;
  onNextLevel?: () => void;
  onLevelComplete?: (stars: number, score: number) => void;
  onGoSettings?: () => void;
  onWatchAdContinue?: (onGranted: (extraMoves: number, extraSecs: number) => void) => void;
  onWatchAdHint?: (onGranted: () => void) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function levelDifficulty(n: number): Difficulty {
  if (n <= 10) return "easy";
  if (n <= 20) return "medium";
  return "hard";
}
function cs(cfg: Cfg) { return (cfg.canvasSize - (cfg.gridSize - 1) * GAP) / cfg.gridSize; }
function randomBoard(cfg: Cfg): string[] {
  return Array.from({ length: cfg.gridSize * cfg.gridSize }, () =>
    cfg.colors[Math.floor(Math.random() * cfg.colors.length)]
  );
}
function floodFill(board: string[], region: Set<number>, color: string, gs: number) {
  const b = [...board], r = new Set(region);
  for (const i of region) b[i] = color;
  const frontier = [...region], visited = new Set(region);
  while (frontier.length) {
    const cur = frontier.pop()!;
    const row = Math.floor(cur / gs), col = cur % gs;
    for (const n of [row > 0 ? cur - gs : -1, row < gs - 1 ? cur + gs : -1, col > 0 ? cur - 1 : -1, col < gs - 1 ? cur + 1 : -1]) {
      if (n === -1 || visited.has(n)) continue;
      if (b[n] === color) { visited.add(n); r.add(n); frontier.push(n); }
    }
  }
  return { board: b, region: r };
}
function fillWaves(board: string[], region: Set<number>, color: string, gs: number) {
  const b = [...board];
  for (const i of region) b[i] = color;
  const finalRegion = new Set(region), waves: number[][] = [];
  let frontier = [...region];
  const visited = new Set(region);
  while (true) {
    const wave: number[] = [];
    for (const cur of frontier) {
      const row = Math.floor(cur / gs), col = cur % gs;
      for (const n of [row > 0 ? cur - gs : -1, row < gs - 1 ? cur + gs : -1, col > 0 ? cur - 1 : -1, col < gs - 1 ? cur + 1 : -1]) {
        if (n === -1 || visited.has(n)) continue;
        if (b[n] === color) { visited.add(n); finalRegion.add(n); wave.push(n); }
      }
    }
    if (!wave.length) break;
    waves.push(wave); frontier = wave;
  }
  return { waves, finalBoard: b, finalRegion };
}
function greedyEst(board: string[], cfg: Cfg): number {
  let b = [...board], r = new Set<number>([0]), cur = board[0], moves = 0;
  while (r.size < cfg.gridSize * cfg.gridSize && moves < cfg.moveLimit * 2) {
    let bColor = "", bSize = -1;
    for (const c of cfg.colors) {
      if (c === cur) continue;
      const res = floodFill(b, r, c, cfg.gridSize);
      if (res.region.size > bSize) { bSize = res.region.size; bColor = c; }
    }
    if (!bColor || bSize <= r.size) break;
    const res = floodFill(b, r, bColor, cfg.gridSize);
    b = res.board; r = res.region; cur = bColor; moves++;
  }
  return moves;
}
function makeBoard(cfg: Cfg): string[] {
  const thresh = cfg.moveLimit * 1.5;
  for (let i = 0; i < 10; i++) {
    const b = randomBoard(cfg);
    if (greedyEst(b, cfg) <= thresh) return b;
  }
  return randomBoard(cfg);
}
function adjColors(board: string[], region: Set<number>, gs: number): Set<string> {
  const s = new Set<string>();
  for (const i of region) {
    const row = Math.floor(i / gs), col = i % gs;
    for (const n of [row > 0 ? i - gs : -1, row < gs - 1 ? i + gs : -1, col > 0 ? i - 1 : -1, col < gs - 1 ? i + 1 : -1]) {
      if (n !== -1 && !region.has(n)) s.add(board[n]);
    }
  }
  return s;
}
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ("roundRect" in ctx) (ctx as any).roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fill();
}
function getHigh(d: Difficulty): number {
  try { return parseInt(localStorage.getItem(`cf_best_${d}`) || "0", 10) || 0; } catch { return 0; }
}
function saveHigh(d: Difficulty, s: number) {
  try { localStorage.setItem(`cf_best_${d}`, String(s)); } catch {}
}
function fmtTime(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

// ─── Colorblind shapes ────────────────────────────────────────────────────────
const COLOR_SHAPE: Record<string, string> = {
  "#E74C3C": "circle", "#3498DB": "square", "#2ECC71": "triangle",
  "#F1C40F": "diamond", "#9B59B6": "star", "#E67E22": "cross",
};
function drawCBShape(ctx: CanvasRenderingContext2D, shape: string, cx: number, cy: number, size: number) {
  const r = size * 0.26;
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 1.4;
  switch (shape) {
    case "circle": ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case "square": ctx.beginPath(); ctx.rect(cx - r, cy - r, r * 2, r * 2); ctx.fill(); ctx.stroke(); break;
    case "triangle": {
      const h = r * 1.65; ctx.beginPath();
      ctx.moveTo(cx, cy - h / 2); ctx.lineTo(cx - r, cy + h / 2); ctx.lineTo(cx + r, cy + h / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    }
    case "diamond":
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 1.25); ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r * 1.25); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case "star": {
      const oR = r, iR = r * 0.42; ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2, rad = i % 2 === 0 ? oR : iR;
        const px = cx + rad * Math.cos(a), py = cy + rad * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    }
    case "cross":
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = r * 0.55; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - r * 0.68, cy - r * 0.68); ctx.lineTo(cx + r * 0.68, cy + r * 0.68); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + r * 0.68, cy - r * 0.68); ctx.lineTo(cx - r * 0.68, cy + r * 0.68); ctx.stroke();
      ctx.lineCap = "butt"; break;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Floater { id: number; text: string; x: number; color: string; }
interface WinData { score: number; prevBest: number; isNewBest: boolean; stars: number; timeTaken: number; movesUsed: number; coinsEarned: number; }
interface ConfettiPiece { id: number; x: number; color: string; width: number; height: number; isCircle: boolean; delay: number; duration: number; drift: number; }

// ═════════════════════════════════════════════════════════════════════════════
export default function Game({ levelNum, onBack, onNextLevel, onLevelComplete, onGoSettings, onWatchAdContinue, onWatchAdHint }: GameProps) {
  const isLevelMode = levelNum != null;
  const initialDiff: Difficulty = isLevelMode ? levelDifficulty(levelNum) : "medium";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const colorblindR = useRef(false);
  const freezeTimeoutR = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDiff);
  const [board, setBoard] = useState<string[]>([]);
  const [region, setRegion] = useState<Set<number>>(new Set([0]));
  const [curColor, setCurColor] = useState<string>("");
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isAnim, setIsAnim] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [winData, setWinData] = useState<WinData | null>(null);
  const [paused, setPaused] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [gameTip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  // Power-ups & coins
  const [coins, setCoins] = useState<number>(loadCoins);
  const [usedPU, setUsedPU] = useState<UsedPU>({ freeze: 0, hint: 0, bomb: 0 });
  const [frozen, setFrozen] = useState(false);
  const [hintColor, setHintColor] = useState<string | null>(null);
  const [freezeSecsLeft, setFreezeSecsLeft] = useState(0);
  const [adContinueUsed, setAdContinueUsed] = useState(false);

  // ── Refs (no re-render) ────────────────────────────────────────────────────
  const boardR = useRef<string[]>([]);
  const regionR = useRef<Set<number>>(new Set([0]));
  const diffR = useRef<Difficulty>(initialDiff);
  const isAnimR = useRef(false);
  const pulseR = useRef<Map<number, number>>(new Map());
  const timeLeftR = useRef(45);
  const scoreR = useRef(0);
  const comboR = useRef(0);
  const floaterIdR = useRef(0);
  const pausedR = useRef(false);
  const frozenR = useRef(false);
  const coinsR = useRef<number>(loadCoins());
  const movesR = useRef(0);

  useEffect(() => { colorblindR.current = loadSettings().colorblind; }, []);
  const cfg = DIFFICULTIES[difficulty];

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      if (pausedR.current || frozenR.current) return;
      timeLeftR.current = Math.max(0, timeLeftR.current - 1);
      setTimeLeft(timeLeftR.current);
      if (timeLeftR.current <= 0) {
        clearInterval(timerRef.current!); timerRef.current = null;
        playSound("gameover");
        const c = DIFFICULTIES[diffR.current];
        recordTimePlayed(c.timeLimit);
        setGameOver(true);
      }
    }, 1000);
  }, [clearTimer]);

  const addFloater = useCallback((text: string, xFrac: number, color = "#F1C40F") => {
    const id = ++floaterIdR.current;
    const c = DIFFICULTIES[diffR.current];
    const x = Math.max(10, Math.min(c.canvasSize - 70, xFrac * c.canvasSize));
    setFloaters(prev => [...prev, { id, text, x, color }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 1400);
  }, []);

  // ── Win handler (shared between pickColor and bomb) ────────────────────────
  const handleWin = useCallback((newMoves: number) => {
    const c = DIFFICULTIES[diffR.current];
    const tLeft = timeLeftR.current;
    const speedBonus = tLeft * 10;
    const totalScore = scoreR.current + speedBonus;
    scoreR.current = totalScore;
    setScore(totalScore);
    if (speedBonus > 0) addFloater(`+${speedBonus} SPEED!`, 0.3, "#3498DB");
    clearTimer();
    if (freezeTimeoutR.current) { clearTimeout(freezeTimeoutR.current); freezeTimeoutR.current = null; }
    frozenR.current = false; setFrozen(false); setFreezeSecsLeft(0);

    const movesLeft = c.moveLimit - newMoves;
    const tRatio = tLeft / c.timeLimit;
    const mRatio = movesLeft / c.moveLimit;
    const stars = (mRatio > 0.4 && tRatio > 0.4) ? 3 : (mRatio > 0.2 || tRatio > 0.2) ? 2 : 1;

    const prevBest = getHigh(diffR.current);
    const isNewBest = totalScore > prevBest;
    if (isNewBest) saveHigh(diffR.current, totalScore);
    setHighScore(isNewBest ? totalScore : prevBest);

    const earned = coinsForStars(stars);
    coinsR.current += earned;
    saveCoins(coinsR.current);
    setCoins(coinsR.current);

    playSound("win");
    if (earned > 0) { playSound("coin"); recordCoinsEarned(earned); }
    recordTimePlayed(c.timeLimit - tLeft);

    setWinData({ score: totalScore, prevBest, isNewBest, stars,
      timeTaken: c.timeLimit - tLeft, movesUsed: newMoves, coinsEarned: earned });
    setWon(true);
    onLevelComplete?.(stars, totalScore);
  }, [addFloater, clearTimer, onLevelComplete]);

  // ── startGame ─────────────────────────────────────────────────────────────
  const startGame = useCallback((diff: Difficulty) => {
    clearTimer();
    if (waveRef.current) { clearInterval(waveRef.current); waveRef.current = null; }
    if (freezeTimeoutR.current) { clearTimeout(freezeTimeoutR.current); freezeTimeoutR.current = null; }
    isAnimR.current = false; pulseR.current.clear(); comboR.current = 0; scoreR.current = 0;
    pausedR.current = false; frozenR.current = false; movesR.current = 0;
    coinsR.current = loadCoins();

    const c = DIFFICULTIES[diff];
    const b = makeBoard(c);
    boardR.current = b; regionR.current = new Set([0]); diffR.current = diff;
    timeLeftR.current = c.timeLimit;

    setBoard(b); setRegion(new Set([0])); setCurColor(b[0]); setMoves(0);
    setWon(false); setGameOver(false); setIsAnim(false); setTimeLeft(c.timeLimit);
    setScore(0); setHighScore(getHigh(diff)); setFloaters([]); setWinData(null);
    setPaused(false); setConfetti([]); setFrozen(false); setFreezeSecsLeft(0);
    setHintColor(null); setUsedPU({ freeze: 0, hint: 0, bomb: 0 });
    setCoins(coinsR.current); setAdContinueUsed(false);
    startTimer();
  }, [clearTimer, startTimer]);

  useEffect(() => { startGame(initialDiff); }, [startGame]); // eslint-disable-line
  useEffect(() => () => {
    clearTimer();
    if (freezeTimeoutR.current) clearTimeout(freezeTimeoutR.current);
  }, [clearTimer]);

  // Sync refs
  useEffect(() => { boardR.current = board; }, [board]);
  useEffect(() => { regionR.current = region; }, [region]);
  useEffect(() => { diffR.current = difficulty; }, [difficulty]);
  useEffect(() => { pausedR.current = paused; }, [paused]);
  useEffect(() => { movesR.current = moves; }, [moves]);

  // Confetti on 3-star win
  useEffect(() => {
    if (!winData || winData.stars < 3) return;
    const pieces: ConfettiPiece[] = Array.from({ length: 55 }, (_, i) => ({
      id: i, x: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      width: 6 + Math.random() * 6, height: 8 + Math.random() * 10,
      isCircle: Math.random() > 0.6, delay: Math.random() * 1.0,
      duration: 2.2 + Math.random() * 1.8, drift: (Math.random() - 0.5) * 60,
    }));
    setConfetti(pieces);
    const t = setTimeout(() => setConfetti([]), 5000);
    return () => clearTimeout(t);
  }, [winData]);

  // ── Freeze countdown display ───────────────────────────────────────────────
  useEffect(() => {
    if (!frozen) { setFreezeSecsLeft(0); return; }
    setFreezeSecsLeft(5);
    const id = setInterval(() => {
      setFreezeSecsLeft(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [frozen]);

  // ── rAF draw loop ─────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c = DIFFICULTIES[diffR.current];
    const cellSz = cs(c);
    const gs = c.gridSize;
    const b = boardR.current;
    const r = regionR.current;
    const now = performance.now();
    const radius = Math.max(1.5, cellSz * 0.07);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < gs; row++) {
      for (let col = 0; col < gs; col++) {
        const idx = row * gs + col;
        const bx = col * (cellSz + GAP), by = row * (cellSz + GAP);
        const pt = pulseR.current.get(idx);
        ctx.fillStyle = b[idx];
        if (pt !== undefined) {
          const elapsed = now - pt;
          if (elapsed < PULSE_MS) {
            const scale = 1 + 0.15 * Math.sin(Math.PI * (elapsed / PULSE_MS));
            ctx.save();
            ctx.translate(bx + cellSz / 2, by + cellSz / 2); ctx.scale(scale, scale);
            ctx.translate(-(bx + cellSz / 2), -(by + cellSz / 2));
            rrect(ctx, bx, by, cellSz, cellSz, radius); ctx.restore();
          } else { pulseR.current.delete(idx); rrect(ctx, bx, by, cellSz, cellSz, radius); }
        } else { rrect(ctx, bx, by, cellSz, cellSz, radius); }
      }
    }
    if (colorblindR.current && b.length > 0) {
      for (let row = 0; row < gs; row++) {
        for (let col = 0; col < gs; col++) {
          const idx = row * gs + col;
          const bx = col * (cellSz + GAP), by = row * (cellSz + GAP);
          const shape = COLOR_SHAPE[b[idx]];
          if (shape) drawCBShape(ctx, shape, bx + cellSz / 2, by + cellSz / 2, cellSz);
        }
      }
    }
    if (r.size > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,1)"; ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(255,255,255,0.7)"; ctx.shadowBlur = 7; ctx.lineCap = "butt";
      for (const idx of r) {
        const row = Math.floor(idx / gs), col = idx % gs;
        const x = col * (cellSz + GAP), y = row * (cellSz + GAP);
        if (row === 0 || !r.has(idx - gs))      { ctx.beginPath(); ctx.moveTo(x, y + .5);          ctx.lineTo(x + cellSz, y + .5);          ctx.stroke(); }
        if (row === gs - 1 || !r.has(idx + gs)) { ctx.beginPath(); ctx.moveTo(x, y + cellSz - .5); ctx.lineTo(x + cellSz, y + cellSz - .5); ctx.stroke(); }
        if (col === 0 || !r.has(idx - 1))       { ctx.beginPath(); ctx.moveTo(x + .5, y);          ctx.lineTo(x + .5, y + cellSz);          ctx.stroke(); }
        if (col === gs - 1 || !r.has(idx + 1))  { ctx.beginPath(); ctx.moveTo(x + cellSz - .5, y); ctx.lineTo(x + cellSz - .5, y + cellSz); ctx.stroke(); }
      }
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── pickColor ─────────────────────────────────────────────────────────────
  const pickColor = useCallback((color: string) => {
    if (color === curColor || won || gameOver || isAnimR.current || paused) return;
    playSound("fill");
    recordMove(color);
    const c = DIFFICULTIES[difficulty];
    const { waves, finalBoard, finalRegion } = fillWaves(board, region, color, c.gridSize);
    const newMoves = moves + 1;
    const gained = finalRegion.size - region.size;
    const totalCells = c.gridSize * c.gridSize;
    const remaining = totalCells - region.size;

    const base = 100;
    const isPerfect = remaining > 0 && gained > 0 && (gained / remaining) > 0.1;
    const perfectBonus = isPerfect ? 250 : 0;
    let comboBonus = 0;
    if (isPerfect) { comboR.current++; if (comboR.current >= 3) { comboBonus = 500; comboR.current = 0; } }
    else { comboR.current = 0; }
    const moveScore = base + perfectBonus + comboBonus;
    scoreR.current += moveScore; setScore(scoreR.current);

    const xPos = 0.2 + Math.random() * 0.55;
    if (comboBonus > 0) addFloater(`COMBO! +${comboBonus}`, 0.35, "#E67E22");
    else if (isPerfect) addFloater(`+${moveScore} ✦`, xPos, "#F1C40F");
    else addFloater(`+${base}`, xPos, "#9999BB");

    const visualBoard = [...board]; for (const i of region) visualBoard[i] = color;
    boardR.current = visualBoard;
    const now = performance.now(); for (const i of region) pulseR.current.set(i, now);

    if (waves.length === 0) {
      setBoard(finalBoard); setRegion(finalRegion); setCurColor(color); setMoves(newMoves);
      if (newMoves >= c.moveLimit && finalRegion.size < totalCells) {
        clearTimer(); playSound("gameover");
        recordTimePlayed(c.timeLimit - timeLeftR.current);
        setGameOver(true);
      }
      return;
    }
    isAnimR.current = true; setIsAnim(true);
    const animB = [...visualBoard], animR = new Set(region); let wi = 0;

    waveRef.current = setInterval(() => {
      if (wi >= waves.length) {
        clearInterval(waveRef.current!); waveRef.current = null; isAnimR.current = false;
        boardR.current = finalBoard; regionR.current = finalRegion;
        setBoard(finalBoard); setRegion(finalRegion); setCurColor(color); setMoves(newMoves);
        setIsAnim(false);
        if (finalRegion.size === totalCells) { handleWin(newMoves); }
        else if (newMoves >= c.moveLimit) {
          clearTimer(); playSound("gameover");
          recordTimePlayed(c.timeLimit - timeLeftR.current);
          setGameOver(true);
        }
        return;
      }
      const wave = waves[wi], wt = performance.now();
      for (const i of wave) { animB[i] = color; animR.add(i); pulseR.current.set(i, wt); }
      boardR.current = [...animB]; regionR.current = new Set(animR); wi++;
    }, WAVE_MS);
  }, [board, region, curColor, won, gameOver, moves, difficulty, paused, clearTimer, addFloater, handleWin]);

  // ── Power-up activation ───────────────────────────────────────────────────
  const activatePowerUp = useCallback((type: PowerUpId) => {
    const COSTS: Record<PowerUpId, number> = { freeze: 20, hint: 15, bomb: 30 };
    const MAX_USES: Record<PowerUpId, number> = { freeze: 3, hint: 3, bomb: 2 };
    const cost = COSTS[type];
    if (coinsR.current < cost) return;
    if (usedPU[type] >= MAX_USES[type]) return;
    if (won || gameOver || isAnimR.current || paused) return;

    // Spend coins
    coinsR.current -= cost;
    saveCoins(coinsR.current);
    setCoins(coinsR.current);
    setUsedPU(prev => ({ ...prev, [type]: prev[type] + 1 }));
    playSound("powerup");

    if (type === "freeze") {
      frozenR.current = true; setFrozen(true); setFreezeSecsLeft(5);
      addFloater("❄️ FROZEN!", 0.22, "#64d8fc");
      if (freezeTimeoutR.current) clearTimeout(freezeTimeoutR.current);
      freezeTimeoutR.current = setTimeout(() => {
        frozenR.current = false; setFrozen(false);
        freezeTimeoutR.current = null;
      }, 5000);
    } else if (type === "hint") {
      // Find best color move
      const gains: [string, number][] = DIFFICULTIES[diffR.current].colors
        .filter(c => c !== curColor)
        .map(c => [c, floodFill(boardR.current, regionR.current, c, DIFFICULTIES[diffR.current].gridSize).region.size - regionR.current.size]);
      gains.sort((a, b) => b[1] - a[1]);
      const best = gains[0]?.[0];
      if (best) {
        setHintColor(best);
        addFloater("💡 HINT!", 0.25, "#F1C40F");
        setTimeout(() => setHintColor(null), 1700);
      }
    } else if (type === "bomb") {
      const gs = DIFFICULTIES[diffR.current].gridSize;
      const uncaptured: number[] = [];
      for (let i = 0; i < boardR.current.length; i++) {
        if (!regionR.current.has(i)) uncaptured.push(i);
      }
      if (!uncaptured.length) return;

      let totalRow = 0, totalCol = 0;
      for (const i of uncaptured) { totalRow += Math.floor(i / gs); totalCol += i % gs; }
      const centerRow = Math.round(totalRow / uncaptured.length);
      const centerCol = Math.round(totalCol / uncaptured.length);

      const newBoard = [...boardR.current];
      const newRegion = new Set(regionR.current);
      const affected: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const ro = centerRow + dr, co = centerCol + dc;
          if (ro >= 0 && ro < gs && co >= 0 && co < gs) {
            const idx = ro * gs + co;
            if (!newRegion.has(idx)) { newBoard[idx] = curColor; newRegion.add(idx); affected.push(idx); }
          }
        }
      }
      if (!affected.length) return;

      const { region: finalRegion, board: finalBoard } = floodFill(newBoard, newRegion, curColor, gs);
      const nowT = performance.now();
      for (const idx of finalRegion) { if (!regionR.current.has(idx)) pulseR.current.set(idx, nowT); }

      boardR.current = finalBoard; regionR.current = finalRegion;
      setBoard(finalBoard); setRegion(finalRegion);
      addFloater("💣 BOOM!", 0.25, "#E67E22");

      if (finalRegion.size === gs * gs) { handleWin(movesR.current); }
    }
  }, [usedPU, won, gameOver, paused, curColor, addFloater, handleWin]);

  const changeDiff = useCallback((d: Difficulty) => { setDifficulty(d); startGame(d); }, [startGame]);
  const restart = useCallback(() => startGame(isLevelMode ? levelDifficulty(levelNum!) : difficulty), [startGame, isLevelMode, levelNum, difficulty]);
  const togglePause = useCallback(() => { setPaused(prev => { pausedR.current = !prev; return !prev; }); }, []);

  // ── Ad: continue game after game over ─────────────────────────────────────
  const handleAdContinue = useCallback(() => {
    if (!onWatchAdContinue) return;
    onWatchAdContinue((extraMoves, extraSecs) => {
      const newMoves = Math.max(0, movesR.current - extraMoves);
      movesR.current = newMoves;
      setMoves(newMoves);
      timeLeftR.current = Math.min(DIFFICULTIES[diffR.current].timeLimit * 2, timeLeftR.current + extraSecs);
      setTimeLeft(timeLeftR.current);
      setAdContinueUsed(true);
      setGameOver(false);
      startTimer();
    });
  }, [onWatchAdContinue, startTimer]);

  // ── Ad: reveal next 3 best moves as flashing hints ────────────────────────
  const handleAdHint = useCallback(() => {
    if (!onWatchAdHint) return;
    onWatchAdHint(() => {
      const c = DIFFICULTIES[diffR.current];
      const gains: [string, number][] = c.colors
        .filter(col => col !== boardR.current[0])
        .map(col => [col, floodFill(boardR.current, regionR.current, col, c.gridSize).region.size - regionR.current.size]);
      gains.sort((a, b) => b[1] - a[1]);
      const top3 = gains.slice(0, 3).map(g => g[0]);
      top3.forEach((col, idx) => {
        setTimeout(() => setHintColor(col), idx * 600);
        setTimeout(() => setHintColor(null), idx * 600 + 550);
      });
      setGameOver(false);
      startTimer();
    });
  }, [onWatchAdHint, startTimer]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const captureGains = useMemo(() => {
    const g: Record<string, number> = {};
    if (isAnim || !board.length) return g;
    for (const c of cfg.colors) {
      if (c === curColor) { g[c] = 0; continue; }
      g[c] = floodFill(board, region, c, cfg.gridSize).region.size - region.size;
    }
    return g;
  }, [board, region, curColor, cfg, isAnim]);
  const adjacent = useMemo(() => adjColors(board, region, cfg.gridSize), [board, region, cfg.gridSize]);

  const total = cfg.gridSize * cfg.gridSize;
  const coverage = board.length ? Math.round((region.size / total) * 100) : 0;
  const movesLeft = cfg.moveLimit - moves;
  const movesRatio = movesLeft / cfg.moveLimit;
  const timeRatio = timeLeft / cfg.timeLimit;
  const movesRed = movesLeft <= 3 && !won && !gameOver;
  const timeRed = timeLeft <= 8 && !won && !gameOver && !frozen;
  const boardBarColor = movesRatio > 0.5 ? "#2ECC71" : movesRatio > 0.25 ? "#F1C40F" : "#E74C3C";
  const timerBarColor = frozen ? "#64d8fc" : timeRatio > 0.5 ? "#2ECC71" : timeRatio > 0.25 ? "#F1C40F" : "#E74C3C";
  const canvasSz = board.length ? cfg.canvasSize : 340;
  const btnSz = difficulty === "hard" ? 44 : 50;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="screen-enter" style={rootStyle}>
      <div style={colStyle}>

        {/* Top bar */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {isLevelMode ? (
            <button onClick={onBack} style={backBtnStyle}>← Levels</button>
          ) : <div style={{ width: "60px" }} />}
          <h1 style={{ color: "#E8E8F0", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>Color Fill</h1>
          {isLevelMode ? (
            <span style={{ fontSize: "11px", color: "#5555AA", minWidth: "60px", textAlign: "right" }}>{levelNum} of {TOTAL_LEVELS}</span>
          ) : <div style={{ width: "60px" }} />}
        </div>

        {/* Level label / difficulty */}
        {isLevelMode ? (
          <div style={{ color: "#8888CC", fontSize: "13px", fontWeight: 600, letterSpacing: "0.3px", marginTop: "-4px" }}>Level {levelNum}</div>
        ) : (
          <div style={{ display: "flex", gap: "8px" }}>
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
              const active = d === difficulty;
              return (
                <button key={d} onClick={() => changeDiff(d)} style={{
                  backgroundColor: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                  color: active ? "#E8E8F0" : "#6666AA",
                  border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px", padding: "7px 16px", fontSize: "13px",
                  fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s ease",
                }}>{DIFFICULTIES[d].label}</button>
              );
            })}
          </div>
        )}

        {/* Timer + Score + Coins */}
        <div style={{ width: canvasSz, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              fontSize: "22px", fontWeight: 800, letterSpacing: "-1px", fontVariantNumeric: "tabular-nums",
              color: frozen ? "#64d8fc" : timeRed ? "#E74C3C" : "#E8E8F0",
              textShadow: frozen ? "0 0 14px #64d8fc, 0 0 28px #3498DB88" : "none",
              transition: "color 0.3s ease, text-shadow 0.3s ease",
            }}>
              {frozen ? `❄️ ${freezeSecsLeft}s` : fmtTime(timeLeft)}
            </div>
            {!won && !gameOver && (
              <button onClick={togglePause} style={{
                background: "none", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "6px", color: "#6666AA", fontSize: "13px",
                padding: "3px 8px", cursor: "pointer", lineHeight: 1.4,
              }}>
                {paused ? "▶" : "⏸"}
              </button>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#E8E8F0", fontSize: "16px", fontWeight: 700, letterSpacing: "-0.3px" }}>{score.toLocaleString()}</div>
            {highScore > 0 && <div style={{ color: "#5555AA", fontSize: "10px", marginTop: "1px" }}>Best: {highScore.toLocaleString()}</div>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "3px", marginTop: "2px" }}>
              <span style={{ fontSize: "12px" }}>🪙</span>
              <span style={{ color: "#F1C40F", fontSize: "12px", fontWeight: 700 }}>{coins}</span>
            </div>
          </div>
        </div>

        {/* Moves bar */}
        <div style={{ width: canvasSz, display: "flex", flexDirection: "column", gap: "5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: movesRed ? "#E74C3C" : "#6666AA", fontWeight: movesRed ? 700 : 400, transition: "color 0.2s" }}>
              Moves: {moves} / {cfg.moveLimit}
            </span>
            <span style={{ fontSize: "12px", color: "#6666AA" }}>{coverage}% captured</span>
          </div>
          <div style={{ width: "100%", height: "5px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ width: `${coverage}%`, height: "100%", borderRadius: "3px", backgroundColor: boardBarColor, transition: "width 0.35s ease, background-color 0.4s ease", boxShadow: `0 0 8px ${boardBarColor}99` }} />
          </div>
        </div>

        {/* Timer bar */}
        <div style={{ width: canvasSz, height: "3px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ width: `${frozen ? (freezeSecsLeft / 5) * 100 : timeRatio * 100}%`, height: "100%", borderRadius: "2px", backgroundColor: timerBarColor, transition: frozen ? "width 0.95s linear" : "width 0.95s linear, background-color 0.5s ease", boxShadow: `0 0 6px ${timerBarColor}` }} />
        </div>

        {/* ── Power-ups row ── */}
        {!won && !gameOver && (
          <div style={{ width: canvasSz, display: "flex", gap: "7px" }}>
            {POWER_UPS.map(pu => {
              const used = usedPU[pu.id];
              const remaining = pu.max - used;
              const canAfford = coins >= pu.cost;
              const hasUses = remaining > 0;
              const available = canAfford && hasUses && !isAnim && !paused && !won && !gameOver;
              const isActive = pu.id === "freeze" && frozen;
              return (
                <button
                  key={pu.id}
                  onClick={() => activatePowerUp(pu.id)}
                  disabled={!available}
                  className={isActive ? "pu-freeze-active" : ""}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                    gap: "2px", padding: "7px 2px", borderRadius: "11px",
                    border: `1.5px solid ${isActive ? pu.color : available ? pu.color + "44" : "rgba(255,255,255,0.06)"}`,
                    backgroundColor: isActive ? `${pu.color}22` : available ? `${pu.color}0D` : "rgba(255,255,255,0.03)",
                    cursor: available ? "pointer" : "not-allowed",
                    opacity: !hasUses ? 0.28 : !canAfford ? 0.48 : 1,
                    transition: "all 0.2s ease",
                    boxShadow: isActive ? `0 0 16px ${pu.color}55, 0 0 6px ${pu.color}33` : available ? `0 0 10px ${pu.color}18` : "none",
                    outline: "none",
                  }}
                >
                  <span style={{ fontSize: "18px", lineHeight: 1 }}>{pu.icon}</span>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: available ? pu.color : "#444466", letterSpacing: "0.03em" }}>
                    {pu.name.toUpperCase()}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                    <span style={{ fontSize: "10px" }}>🪙</span>
                    <span style={{ fontSize: "10px", color: canAfford ? "#F1C40F" : "#554422", fontWeight: 700 }}>{pu.cost}</span>
                  </div>
                  <div style={{ display: "flex", gap: "2px" }}>
                    {Array.from({ length: pu.max }, (_, i) => (
                      <div key={i} style={{
                        width: 5, height: 5, borderRadius: "50%",
                        backgroundColor: i < remaining ? pu.color : "rgba(255,255,255,0.1)",
                      }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Canvas */}
        <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", backgroundColor: "#0F0F1A", boxShadow: "0 0 0 2px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5)" }}>
          <canvas ref={canvasRef} width={canvasSz} height={canvasSz} style={{ display: "block", width: canvasSz, height: canvasSz }} />

          {/* Floaters */}
          {floaters.map(f => (
            <div key={f.id} className="floater" style={{ position: "absolute", left: f.x, top: "35%", color: f.color, fontSize: "13px", fontWeight: 800, letterSpacing: "-0.3px", pointerEvents: "none", whiteSpace: "nowrap", textShadow: `0 0 8px ${f.color}`, fontFamily: "'Inter', -apple-system, sans-serif" }}>
              {f.text}
            </div>
          ))}

          {/* ── WIN overlay ── */}
          {won && winData && (
            <div style={overlayS}>
              {confetti.length > 0 && (
                <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                  {confetti.map(p => (
                    <div key={p.id} className="confetti-fall" style={{
                      position: "absolute", left: `${p.x}%`, top: "-12px",
                      width: p.width, height: p.height, backgroundColor: p.color,
                      borderRadius: p.isCircle ? "50%" : "2px",
                      animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
                      "--drift": `${p.drift}px`,
                    } as CSSProperties} />
                  ))}
                </div>
              )}
              <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "-0.8px", background: "linear-gradient(135deg, #F1C40F 0%, #E67E22 50%, #F1C40F 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "10px" }}>
                  {isLevelMode ? `Level ${levelNum} Complete!` : "You Win!"}
                </div>
                <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "10px" }}>
                  {[1, 2, 3].map(i => (
                    <span key={i} className="star" style={{ fontSize: "34px", display: "inline-block", opacity: i <= winData.stars ? 1 : 0.18, animationDelay: `${(i - 1) * 0.2}s`, filter: i <= winData.stars ? "drop-shadow(0 0 8px #F1C40F)" : "none" }}>⭐</span>
                  ))}
                </div>
                {winData.isNewBest && (
                  <div style={{ display: "inline-block", marginBottom: "8px", background: "linear-gradient(135deg, #F1C40F, #E67E22)", color: "#0F0F1A", fontSize: "11px", fontWeight: 800, borderRadius: "99px", padding: "4px 12px", letterSpacing: "0.6px", boxShadow: "0 0 16px rgba(241,196,15,0.6)" }}>
                    ✦ NEW BEST!
                  </div>
                )}
                <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginBottom: "8px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#F1C40F", fontSize: "22px", fontWeight: 800 }}>{winData.score.toLocaleString()}</div>
                    <div style={{ color: "#5555AA", fontSize: "10px" }}>Score</div>
                  </div>
                  <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.1)" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#8888CC", fontSize: "22px", fontWeight: 700 }}>{(winData.isNewBest ? winData.score : winData.prevBest).toLocaleString()}</div>
                    <div style={{ color: "#5555AA", fontSize: "10px" }}>Best</div>
                  </div>
                </div>
                <div style={{ color: "#5555AA", fontSize: "11px", display: "flex", gap: "14px", justifyContent: "center", marginBottom: "10px" }}>
                  <span>⏱ {winData.timeTaken}s</span>
                  <span>🎯 {winData.movesUsed} moves</span>
                </div>
                {/* Coins earned */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", backgroundColor: "rgba(241,196,15,0.12)", border: "1px solid rgba(241,196,15,0.3)", borderRadius: "99px", padding: "5px 14px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px" }}>🪙</span>
                  <span style={{ color: "#F1C40F", fontSize: "14px", fontWeight: 700 }}>+{winData.coinsEarned} coins earned!</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "200px", position: "relative", zIndex: 1 }}>
                {isLevelMode && levelNum! < TOTAL_LEVELS && (
                  <button onClick={onNextLevel} style={{ background: "linear-gradient(135deg, #2ECC71, #27AE60)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px 0", fontSize: "16px", fontWeight: 700, cursor: "pointer", width: "100%", boxShadow: "0 6px 20px rgba(46,204,113,0.4)" }}>
                    Next Level →
                  </button>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={restart} style={btnSecondarySmall}>Replay</button>
                  {isLevelMode && <button onClick={onBack} style={btnSecondarySmall}>Levels</button>}
                </div>
              </div>
            </div>
          )}

          {/* ── GAME OVER overlay ── */}
          {gameOver && (
            <div style={overlayS}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "42px", lineHeight: 1, marginBottom: "8px" }}>💀</div>
                <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #E74C3C, #C0392B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "4px" }}>
                  Game Over
                </div>
                <div style={{ color: "#8888AA", fontSize: "13px", marginBottom: "12px" }}>
                  {coverage < 30 ? "Keep practicing!" : coverage < 60 ? "So close! Try again!" : "Almost had it!"}
                </div>
                <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginBottom: "10px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#E8E8F0", fontSize: "20px", fontWeight: 800 }}>{score.toLocaleString()}</div>
                    <div style={{ color: "#5555AA", fontSize: "10px" }}>Score</div>
                  </div>
                  <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.1)" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#E8E8F0", fontSize: "20px", fontWeight: 800 }}>{coverage}%</div>
                    <div style={{ color: "#5555AA", fontSize: "10px" }}>Captured</div>
                  </div>
                </div>
                <div style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 12px", color: "#7777AA", fontSize: "11px", lineHeight: 1.5, maxWidth: "220px", margin: "0 auto" }}>
                  💡 {gameTip}
                </div>
              </div>

              {/* Rewarded ad buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "220px" }}>
                {onWatchAdContinue && !adContinueUsed && (
                  <button
                    onClick={handleAdContinue}
                    style={{
                      width: "100%", padding: "11px 0",
                      borderRadius: "10px", border: "1px solid rgba(52,152,219,0.45)",
                      background: "linear-gradient(135deg, rgba(52,152,219,0.18), rgba(155,89,182,0.18))",
                      color: "#88BBEE", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    }}
                  >
                    <span>🎬</span>
                    <span>Watch Ad to Continue (+5 moves +10s)</span>
                  </button>
                )}
                {onWatchAdHint && (
                  <button
                    onClick={handleAdHint}
                    style={{
                      width: "100%", padding: "11px 0",
                      borderRadius: "10px", border: "1px solid rgba(241,196,15,0.35)",
                      background: "linear-gradient(135deg, rgba(241,196,15,0.12), rgba(230,126,34,0.12))",
                      color: "#CCAA44", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    }}
                  >
                    <span>🎬</span>
                    <span>Watch Ad to Reveal 3 Best Moves</span>
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={restart} style={{ background: "linear-gradient(135deg, #E74C3C, #C0392B)", color: "#fff", border: "none", borderRadius: "10px", padding: "11px 22px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>Try Again</button>
                {isLevelMode ? (
                  <button onClick={onBack} style={btnSecondary}>Levels</button>
                ) : (
                  <button onClick={() => { const o: Difficulty[] = ["easy", "medium", "hard"]; changeDiff(o[Math.max(0, o.indexOf(difficulty) - 1)]); }} style={btnSecondary}>Easier</button>
                )}
              </div>
            </div>
          )}

          {/* ── PAUSE overlay ── */}
          {paused && !won && !gameOver && (
            <div style={{ ...overlayS, gap: "20px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "6px" }}>⏸</div>
                <div style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "-0.8px", color: "#E8E8F0" }}>Paused</div>
                {isLevelMode && <div style={{ color: "#5555AA", fontSize: "12px", marginTop: "4px" }}>Level {levelNum}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px", width: "190px" }}>
                <button onClick={togglePause} style={{ background: "linear-gradient(135deg, #3498DB, #9B59B6)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px 0", fontSize: "16px", fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 20px rgba(52,152,219,0.4)" }}>
                  ▶ Resume
                </button>
                <button onClick={restart} style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "#B8B8CC", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "11px 0", fontSize: "14px", fontWeight: 600, cursor: "pointer", width: "100%" }}>
                  ↺ Restart Level
                </button>
                {onGoSettings && (
                  <button onClick={onGoSettings} style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#8888CC", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "11px 0", fontSize: "14px", fontWeight: 500, cursor: "pointer", width: "100%" }}>
                    ⚙ Settings
                  </button>
                )}
                <button onClick={onBack} style={{ backgroundColor: "transparent", color: "#555577", border: "none", padding: "8px 0", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                  Quit to Menu
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Color buttons */}
        <div style={{ display: "flex", gap: difficulty === "hard" ? "10px" : "14px", alignItems: "center", justifyContent: "center" }}>
          {cfg.colors.map((color) => {
            const active = color === curColor;
            const gain = captureGains[color] ?? 0;
            const isZero = !active && gain === 0 && !isAnim;
            const showBadge = !active && gain > 5 && !isAnim;
            const isHint = !active && adjacent.has(color);
            const isHintFlash = color === hintColor;
            const sz = btnSz;
            return (
              <div key={color} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  onClick={() => pickColor(color)}
                  disabled={active || won || gameOver || isAnim || paused}
                  className={isHintFlash ? "hint-flash-btn" : ""}
                  style={{
                    width: sz, height: sz, borderRadius: "50%", backgroundColor: color,
                    border: active ? "3px solid rgba(255,255,255,0.95)" : isHint ? "3px solid rgba(255,255,255,0.45)" : "3px solid transparent",
                    cursor: active || won || gameOver || isAnim || paused ? "default" : "pointer",
                    opacity: isZero ? 0.55 : 1,
                    transition: "transform 0.15s ease, opacity 0.2s ease, box-shadow 0.15s ease",
                    boxShadow: active ? `0 0 0 5px rgba(255,255,255,0.22), 0 4px 20px ${color}AA` : isHint ? `0 0 0 3px ${color}44, 0 4px 14px ${color}77` : `0 4px 10px ${color}44`,
                    transform: active ? "scale(1.14)" : "scale(1)",
                    outline: "none", padding: 0,
                    touchAction: "manipulation",
                    flexShrink: 0,
                  }}
                />
                {showBadge && (
                  <div style={{ position: "absolute", top: -5, right: -5, backgroundColor: "#E8E8F0", color: "#0F0F1A", fontSize: "9px", fontWeight: 800, borderRadius: "99px", padding: "1.5px 4px", lineHeight: 1.3, pointerEvents: "none", minWidth: "14px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                    +{gain}
                  </div>
                )}
                {isHint && !active && !isZero && (
                  <span style={{ position: "absolute", width: sz + 8, height: sz + 8, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.28)", animation: "pulse-ring 2s ease-in-out infinite", pointerEvents: "none" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* New Game button */}
        <button onClick={restart} style={{ background: "linear-gradient(135deg, rgba(52,152,219,0.2) 0%, rgba(155,89,182,0.2) 100%)", color: "#AAAACC", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "9px", padding: "9px 24px", fontSize: "12px", fontWeight: 500, cursor: "pointer", letterSpacing: "0.1px" }}>
          New Game
        </button>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 0.7; }
          50%  { transform: scale(1.25); opacity: 0.2; }
          100% { transform: scale(1);    opacity: 0.7; }
        }
        @keyframes float-up {
          0%   { transform: translateY(0px);   opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translateY(-55px); opacity: 0; }
        }
        .floater { animation: float-up 1.25s ease-out forwards; }
        @keyframes star-pop {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          55%  { transform: scale(1.35) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .star { animation: star-pop 0.45s cubic-bezier(0.36,0.07,0.19,0.97) both; }
        @keyframes confetti-drop {
          0%   { transform: translateY(0px) translateX(0px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(420px) translateX(var(--drift, 0px)) rotate(600deg); opacity: 0; }
        }
        .confetti-fall { animation: confetti-drop linear both; }
        @keyframes hint-flash {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 0px transparent); }
          50% { filter: brightness(1.6) drop-shadow(0 0 10px #F1C40F); }
        }
        .hint-flash-btn { animation: hint-flash 0.45s ease-in-out 3 both; }
        @keyframes freeze-pulse {
          0%, 100% { box-shadow: 0 0 10px #64d8fc44; }
          50% { box-shadow: 0 0 24px #64d8fc99, 0 0 8px #3498DB55; }
        }
        .pu-freeze-active { animation: freeze-pulse 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

const rootStyle: CSSProperties = {
  minHeight: "100dvh", backgroundColor: "#0F0F1A",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  padding: "12px 16px",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  userSelect: "none", WebkitUserSelect: "none",
};
const colStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", width: "100%", maxWidth: "390px" };
const overlayS: CSSProperties = { position: "absolute", inset: 0, backgroundColor: "rgba(15,15,26,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", backdropFilter: "blur(10px)" };
const backBtnStyle: CSSProperties = { backgroundColor: "transparent", color: "#8888CC", border: "none", padding: "4px 0", fontSize: "13px", fontWeight: 600, cursor: "pointer", minWidth: "60px" };
const btnSecondary: CSSProperties = { backgroundColor: "rgba(255,255,255,0.08)", color: "#B8B8CC", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "11px 18px", fontSize: "14px", fontWeight: 500, cursor: "pointer" };
const btnSecondarySmall: CSSProperties = { backgroundColor: "rgba(255,255,255,0.07)", color: "#9999BB", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: 500, cursor: "pointer", flex: 1 };
