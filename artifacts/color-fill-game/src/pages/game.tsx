import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const GAP = 1;
const WAVE_MS = 18;
const PULSE_MS = 130;
const BASE_COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6"] as const;
const HARD_EXTRA = "#E67E22";

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

// ─── Game logic helpers ────────────────────────────────────────────────────────
function cellSize(cfg: Cfg) {
  return (cfg.canvasSize - (cfg.gridSize - 1) * GAP) / cfg.gridSize;
}

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

function greedyEstimate(board: string[], cfg: Cfg): number {
  let b = [...board], r = new Set<number>([0]), cur = board[0], moves = 0;
  const total = cfg.gridSize * cfg.gridSize;
  while (r.size < total && moves < cfg.moveLimit * 2) {
    let bestColor = "", bestSize = -1;
    for (const c of cfg.colors) {
      if (c === cur) continue;
      const res = floodFill(b, r, c, cfg.gridSize);
      if (res.region.size > bestSize) { bestSize = res.region.size; bestColor = c; }
    }
    if (!bestColor || bestSize <= r.size) break;
    const res = floodFill(b, r, bestColor, cfg.gridSize);
    b = res.board; r = res.region; cur = bestColor; moves++;
  }
  return moves;
}

function makeBoard(cfg: Cfg): string[] {
  const thresh = cfg.moveLimit * 1.5;
  for (let i = 0; i < 10; i++) {
    const b = randomBoard(cfg);
    if (greedyEstimate(b, cfg) <= thresh) return b;
  }
  return randomBoard(cfg);
}

function adjacentColors(board: string[], region: Set<number>, gs: number): Set<string> {
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

// ─── localStorage helpers ──────────────────────────────────────────────────────
function getHigh(d: Difficulty): number {
  try { return parseInt(localStorage.getItem(`cf_best_${d}`) || "0", 10) || 0; } catch { return 0; }
}
function saveHigh(d: Difficulty, s: number) {
  try { localStorage.setItem(`cf_best_${d}`, String(s)); } catch {}
}

// ─── Score floater type ────────────────────────────────────────────────────────
interface Floater { id: number; text: string; x: number; color: string; }

// ─── Win screen data ───────────────────────────────────────────────────────────
interface WinData {
  score: number;
  prevBest: number;
  isNewBest: boolean;
  stars: number;
  timeTaken: number;
  movesUsed: number;
}

// ─── Format timer ─────────────────────────────────────────────────────────────
function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const waveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // React state
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
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

  // Canvas / animation refs (bypass React for 60fps drawing)
  const boardR = useRef<string[]>([]);
  const regionR = useRef<Set<number>>(new Set([0]));
  const diffR = useRef<Difficulty>("medium");
  const isAnimR = useRef(false);
  const pulseR = useRef<Map<number, number>>(new Map());
  const timeLeftR = useRef(45);
  const scoreR = useRef(0);
  const comboR = useRef(0);
  const floaterIdR = useRef(0);

  const cfg = DIFFICULTIES[difficulty];

  // ── Timer helpers ────────────────────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
  }, []);

  // ── Floater helper ───────────────────────────────────────────────────────────
  const addFloater = useCallback((text: string, xFrac: number, color = "#F1C40F") => {
    const id = ++floaterIdR.current;
    const c = DIFFICULTIES[diffR.current];
    const x = Math.max(10, Math.min(c.canvasSize - 60, xFrac * c.canvasSize));
    setFloaters(prev => [...prev, { id, text, x, color }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 1400);
  }, []);

  // ── startGame ────────────────────────────────────────────────────────────────
  const startGame = useCallback((diff: Difficulty) => {
    clearTimer();
    if (waveIntervalRef.current) { clearInterval(waveIntervalRef.current); waveIntervalRef.current = null; }
    isAnimR.current = false;
    pulseR.current.clear();
    comboR.current = 0;
    scoreR.current = 0;

    const c = DIFFICULTIES[diff];
    const b = makeBoard(c);
    boardR.current = b;
    regionR.current = new Set([0]);
    diffR.current = diff;
    timeLeftR.current = c.timeLimit;

    setBoard(b);
    setRegion(new Set([0]));
    setCurColor(b[0]);
    setMoves(0);
    setWon(false);
    setGameOver(false);
    setIsAnim(false);
    setTimeLeft(c.timeLimit);
    setScore(0);
    setHighScore(getHigh(diff));
    setFloaters([]);
    setWinData(null);

    timerIntervalRef.current = setInterval(() => {
      timeLeftR.current = Math.max(0, timeLeftR.current - 1);
      setTimeLeft(timeLeftR.current);
      if (timeLeftR.current <= 0) {
        clearInterval(timerIntervalRef.current!);
        timerIntervalRef.current = null;
        setGameOver(true);
      }
    }, 1000);
  }, [clearTimer]);

  useEffect(() => { startGame("medium"); }, [startGame]);
  useEffect(() => () => { clearTimer(); }, [clearTimer]);

  // Sync refs from state
  useEffect(() => { boardR.current = board; }, [board]);
  useEffect(() => { regionR.current = region; }, [region]);
  useEffect(() => { diffR.current = difficulty; }, [difficulty]);

  // ── rAF draw loop ────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const c = DIFFICULTIES[diffR.current];
    const cs = cellSize(c);
    const gs = c.gridSize;
    const b = boardR.current;
    const r = regionR.current;
    const now = performance.now();
    const radius = Math.max(1.5, cs * 0.07);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < gs; row++) {
      for (let col = 0; col < gs; col++) {
        const idx = row * gs + col;
        const bx = col * (cs + GAP), by = row * (cs + GAP);
        const pt = pulseR.current.get(idx);
        ctx.fillStyle = b[idx];
        if (pt !== undefined) {
          const elapsed = now - pt;
          if (elapsed < PULSE_MS) {
            const scale = 1 + 0.15 * Math.sin(Math.PI * (elapsed / PULSE_MS));
            ctx.save();
            ctx.translate(bx + cs / 2, by + cs / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(bx + cs / 2), -(by + cs / 2));
            rrect(ctx, bx, by, cs, cs, radius);
            ctx.restore();
          } else {
            pulseR.current.delete(idx);
            rrect(ctx, bx, by, cs, cs, radius);
          }
        } else {
          rrect(ctx, bx, by, cs, cs, radius);
        }
      }
    }

    if (r.size > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(255,255,255,0.7)";
      ctx.shadowBlur = 7;
      ctx.lineCap = "butt";
      for (const idx of r) {
        const row = Math.floor(idx / gs), col = idx % gs;
        const x = col * (cs + GAP), y = row * (cs + GAP);
        if (row === 0 || !r.has(idx - gs))          { ctx.beginPath(); ctx.moveTo(x, y + .5);          ctx.lineTo(x + cs, y + .5);          ctx.stroke(); }
        if (row === gs - 1 || !r.has(idx + gs))     { ctx.beginPath(); ctx.moveTo(x, y + cs - .5);     ctx.lineTo(x + cs, y + cs - .5);     ctx.stroke(); }
        if (col === 0 || !r.has(idx - 1))           { ctx.beginPath(); ctx.moveTo(x + .5, y);          ctx.lineTo(x + .5, y + cs);          ctx.stroke(); }
        if (col === gs - 1 || !r.has(idx + 1))      { ctx.beginPath(); ctx.moveTo(x + cs - .5, y);     ctx.lineTo(x + cs - .5, y + cs);     ctx.stroke(); }
      }
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── pickColor ────────────────────────────────────────────────────────────────
  const pickColor = useCallback((color: string) => {
    if (color === curColor || won || gameOver || isAnimR.current) return;

    const c = DIFFICULTIES[difficulty];
    const { waves, finalBoard, finalRegion } = fillWaves(board, region, color, c.gridSize);
    const newMoves = moves + 1;
    const gained = finalRegion.size - region.size;
    const totalCells = c.gridSize * c.gridSize;
    const remaining = totalCells - region.size;

    // Score calculation
    const base = 100;
    const isPerfect = remaining > 0 && gained > 0 && (gained / remaining) > 0.1;
    const perfectBonus = isPerfect ? 250 : 0;
    let comboBonus = 0;
    if (isPerfect) {
      comboR.current++;
      if (comboR.current >= 3) { comboBonus = 500; comboR.current = 0; }
    } else {
      comboR.current = 0;
    }
    const moveScore = base + perfectBonus + comboBonus;
    scoreR.current += moveScore;
    setScore(scoreR.current);

    // Floaters
    const xPos = 0.2 + Math.random() * 0.55;
    if (comboBonus > 0) {
      addFloater(`COMBO! +${comboBonus}`, 0.35, "#E67E22");
    } else if (isPerfect) {
      addFloater(`+${moveScore} ✦`, xPos, "#F1C40F");
    } else {
      addFloater(`+${base}`, xPos, "#9999BB");
    }

    // Update canvas refs immediately
    const visualBoard = [...board];
    for (const i of region) visualBoard[i] = color;
    boardR.current = visualBoard;
    const now = performance.now();
    for (const i of region) pulseR.current.set(i, now);

    if (waves.length === 0) {
      setBoard(finalBoard); setRegion(finalRegion); setCurColor(color); setMoves(newMoves);
      if (newMoves >= c.moveLimit && finalRegion.size < totalCells) { clearTimer(); setGameOver(true); }
      return;
    }

    isAnimR.current = true;
    setIsAnim(true);
    const animB = [...visualBoard], animR = new Set(region);
    let wi = 0;

    waveIntervalRef.current = setInterval(() => {
      if (wi >= waves.length) {
        clearInterval(waveIntervalRef.current!); waveIntervalRef.current = null;
        isAnimR.current = false;
        boardR.current = finalBoard; regionR.current = finalRegion;
        setBoard(finalBoard); setRegion(finalRegion); setCurColor(color); setMoves(newMoves);
        setIsAnim(false);

        if (finalRegion.size === totalCells) {
          const tLeft = timeLeftR.current;
          const speedBonus = tLeft * 10;
          const totalScore = scoreR.current + speedBonus;
          scoreR.current = totalScore;
          setScore(totalScore);
          if (speedBonus > 0) addFloater(`+${speedBonus} SPEED!`, 0.3, "#3498DB");

          clearTimer();

          const movesLeft = c.moveLimit - newMoves;
          const timeRatio = tLeft / c.timeLimit;
          const movesRatio = movesLeft / c.moveLimit;
          const stars = (movesRatio > 0.4 && timeRatio > 0.4) ? 3 : (movesRatio > 0.2 || timeRatio > 0.2) ? 2 : 1;

          const prevBest = getHigh(diffR.current);
          const isNewBest = totalScore > prevBest;
          if (isNewBest) saveHigh(diffR.current, totalScore);
          setHighScore(isNewBest ? totalScore : prevBest);

          setWinData({
            score: totalScore,
            prevBest,
            isNewBest,
            stars,
            timeTaken: c.timeLimit - tLeft,
            movesUsed: newMoves,
          });
          setWon(true);
        } else if (newMoves >= c.moveLimit) {
          clearTimer(); setGameOver(true);
        }
        return;
      }
      const wave = waves[wi], wt = performance.now();
      for (const i of wave) { animB[i] = color; animR.add(i); pulseR.current.set(i, wt); }
      boardR.current = [...animB]; regionR.current = new Set(animR);
      wi++;
    }, WAVE_MS);
  }, [board, region, curColor, won, gameOver, moves, difficulty, clearTimer, addFloater]);

  const changeDiff = useCallback((d: Difficulty) => { setDifficulty(d); startGame(d); }, [startGame]);
  const restart = useCallback(() => startGame(difficulty), [difficulty, startGame]);
  const nextLevel = useCallback(() => {
    const order: Difficulty[] = ["easy", "medium", "hard"];
    const idx = order.indexOf(difficulty);
    const next = order[Math.min(idx + 1, order.length - 1)];
    setDifficulty(next);
    startGame(next);
  }, [difficulty, startGame]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const gains = useMemo(() => {
    const g: Record<string, number> = {};
    if (isAnim || !board.length) return g;
    for (const c of cfg.colors) {
      if (c === curColor) { g[c] = 0; continue; }
      g[c] = floodFill(board, region, c, cfg.gridSize).region.size - region.size;
    }
    return g;
  }, [board, region, curColor, cfg, isAnim]);

  const adjColors = useMemo(() => adjacentColors(board, region, cfg.gridSize), [board, region, cfg.gridSize]);

  const total = cfg.gridSize * cfg.gridSize;
  const coverage = board.length ? Math.round((region.size / total) * 100) : 0;
  const movesLeft = cfg.moveLimit - moves;
  const movesRatio = movesLeft / cfg.moveLimit;
  const timeRatio = timeLeft / cfg.timeLimit;
  const movesRed = movesLeft <= 3 && !won && !gameOver;
  const timeRed = timeLeft <= 8 && !won && !gameOver;
  const boardBarColor = movesRatio > 0.5 ? "#2ECC71" : movesRatio > 0.25 ? "#F1C40F" : "#E74C3C";
  const timerBarColor = timeRatio > 0.5 ? "#2ECC71" : timeRatio > 0.25 ? "#F1C40F" : "#E74C3C";
  const canvasSz = board.length ? cfg.canvasSize : 340;
  const btnSz = difficulty === "hard" ? 44 : 50;
  const goMsg = coverage < 30 ? "Keep practicing!" : coverage < 60 ? "So close! Try again!" : "Almost had it!";

  return (
    <div style={rootStyle}>
      <div style={colStyle}>
        {/* Title */}
        <h1 style={{ color: "#E8E8F0", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>
          Color Fill
        </h1>

        {/* Difficulty */}
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
              }}>
                {DIFFICULTIES[d].label}
              </button>
            );
          })}
        </div>

        {/* Timer + Score row */}
        <div style={{ width: canvasSz, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{
              fontSize: "22px", fontWeight: 800, letterSpacing: "-1px", fontVariantNumeric: "tabular-nums",
              color: timeRed ? "#E74C3C" : "#E8E8F0",
              transition: "color 0.3s ease",
            }}>
              {fmtTime(timeLeft)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#E8E8F0", fontSize: "16px", fontWeight: 700, letterSpacing: "-0.3px" }}>
              {score.toLocaleString()}
            </div>
            {highScore > 0 && (
              <div style={{ color: "#5555AA", fontSize: "10px", marginTop: "1px" }}>
                Best: {highScore.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Moves + progress */}
        <div style={{ width: canvasSz, display: "flex", flexDirection: "column", gap: "5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: movesRed ? "#E74C3C" : "#6666AA", fontWeight: movesRed ? 700 : 400, transition: "color 0.2s" }}>
              Moves: {moves} / {cfg.moveLimit}
            </span>
            <span style={{ fontSize: "12px", color: "#6666AA" }}>
              {coverage}% captured
            </span>
          </div>
          <div style={{ width: "100%", height: "5px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{
              width: `${coverage}%`, height: "100%", borderRadius: "3px",
              backgroundColor: boardBarColor,
              transition: "width 0.35s ease, background-color 0.4s ease",
              boxShadow: `0 0 8px ${boardBarColor}99`,
            }} />
          </div>
        </div>

        {/* Timer bar */}
        <div style={{ width: canvasSz, height: "3px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{
            width: `${timeRatio * 100}%`, height: "100%", borderRadius: "2px",
            backgroundColor: timerBarColor,
            transition: "width 0.95s linear, background-color 0.5s ease",
            boxShadow: `0 0 6px ${timerBarColor}`,
          }} />
        </div>

        {/* Canvas */}
        <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", backgroundColor: "#0F0F1A", boxShadow: "0 0 0 2px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5)" }}>
          <canvas ref={canvasRef} width={canvasSz} height={canvasSz} style={{ display: "block", width: canvasSz, height: canvasSz }} />

          {/* Score floaters */}
          {floaters.map(f => (
            <div key={f.id} className="floater" style={{
              position: "absolute",
              left: f.x,
              top: "35%",
              color: f.color,
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "-0.3px",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              textShadow: `0 0 8px ${f.color}`,
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}>
              {f.text}
            </div>
          ))}

          {/* Win overlay */}
          {won && winData && (
            <div style={overlayS}>
              <div style={{ textAlign: "center" }}>
                {/* Stars */}
                <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginBottom: "10px" }}>
                  {[1, 2, 3].map(i => (
                    <span key={i} className={`star star-${i}`} style={{
                      fontSize: "28px",
                      opacity: i <= winData.stars ? 1 : 0.2,
                      display: "inline-block",
                      animationDelay: `${(i - 1) * 0.18}s`,
                    }}>⭐</span>
                  ))}
                </div>

                <div style={{ color: "#E8E8F0", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                  You Win!
                </div>

                {winData.isNewBest && (
                  <div style={{
                    display: "inline-block",
                    marginTop: "6px",
                    backgroundColor: "#F1C40F",
                    color: "#0F0F1A",
                    fontSize: "10px", fontWeight: 800,
                    borderRadius: "99px", padding: "3px 10px",
                    letterSpacing: "0.5px",
                  }}>
                    ✦ NEW BEST!
                  </div>
                )}

                <div style={{ marginTop: "10px", display: "flex", gap: "20px", justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#F1C40F", fontSize: "20px", fontWeight: 800 }}>
                      {winData.score.toLocaleString()}
                    </div>
                    <div style={{ color: "#5555AA", fontSize: "10px" }}>Score</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#8888CC", fontSize: "20px", fontWeight: 700 }}>
                      {(winData.isNewBest ? winData.score : winData.prevBest).toLocaleString()}
                    </div>
                    <div style={{ color: "#5555AA", fontSize: "10px" }}>Best</div>
                  </div>
                </div>

                <div style={{ marginTop: "8px", color: "#5555AA", fontSize: "11px", display: "flex", gap: "14px", justifyContent: "center" }}>
                  <span>⏱ {winData.timeTaken}s</span>
                  <span>🎯 {winData.movesUsed} moves</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={restart} style={btnPrimary("#3498DB")}>Play Again</button>
                {difficulty !== "hard" && (
                  <button onClick={nextLevel} style={btnPrimary("#2ECC71")}>Next Level →</button>
                )}
              </div>
            </div>
          )}

          {/* Game Over overlay */}
          {gameOver && (
            <div style={overlayS}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "40px", lineHeight: 1, marginBottom: "6px" }}>😢</div>
                <div style={{ color: "#E8E8F0", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                  Game Over!
                </div>
                <div style={{ color: "#8888AA", fontSize: "13px", marginTop: "4px" }}>
                  {goMsg}
                </div>
                <div style={{ marginTop: "10px", color: "#F1C40F", fontSize: "18px", fontWeight: 700 }}>
                  {score.toLocaleString()} pts
                </div>
                <div style={{ color: "#5555AA", fontSize: "11px", marginTop: "3px" }}>
                  {coverage}% captured · {moves} moves
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={restart} style={btnPrimary("#E74C3C")}>Try Again</button>
                <button onClick={() => {
                  const order: Difficulty[] = ["easy", "medium", "hard"];
                  const i = order.indexOf(difficulty);
                  changeDiff(order[Math.max(0, i - 1)]);
                }} style={btnSecondary}>Easier</button>
              </div>
            </div>
          )}
        </div>

        {/* Color buttons */}
        <div style={{ display: "flex", gap: difficulty === "hard" ? "10px" : "14px", alignItems: "center", justifyContent: "center" }}>
          {cfg.colors.map((color) => {
            const active = color === curColor;
            const gain = gains[color] ?? 0;
            const isZero = !active && gain === 0 && !isAnim;
            const showBadge = !active && gain > 5 && !isAnim;
            const isHint = !active && adjColors.has(color);
            const sz = active ? btnSz + 7 : btnSz;
            return (
              <div key={color} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button onClick={() => pickColor(color)} disabled={active || won || gameOver || isAnim}
                  style={{
                    width: sz, height: sz, borderRadius: "50%", backgroundColor: color,
                    border: active ? "3px solid rgba(255,255,255,0.95)" : isHint ? "3px solid rgba(255,255,255,0.45)" : "3px solid transparent",
                    cursor: active || won || gameOver || isAnim ? "default" : "pointer",
                    opacity: isZero ? 0.28 : 1,
                    transition: "width 0.15s ease, height 0.15s ease, opacity 0.2s ease, box-shadow 0.15s ease",
                    boxShadow: active ? `0 0 0 4px rgba(255,255,255,0.18), 0 4px 18px ${color}99` : isHint ? `0 0 0 3px ${color}44, 0 4px 14px ${color}77` : `0 4px 10px ${color}44`,
                    outline: "none", padding: 0,
                  }}
                />
                {showBadge && (
                  <div style={{
                    position: "absolute", top: -5, right: -5,
                    backgroundColor: "#E8E8F0", color: "#0F0F1A",
                    fontSize: "9px", fontWeight: 800, borderRadius: "99px",
                    padding: "1.5px 4px", lineHeight: 1.3, pointerEvents: "none",
                    minWidth: "14px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                  }}>
                    +{gain}
                  </div>
                )}
                {isHint && !active && !isZero && (
                  <span style={{
                    position: "absolute", width: sz + 8, height: sz + 8, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.28)",
                    animation: "pulse-ring 2s ease-in-out infinite", pointerEvents: "none",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* New Game */}
        <button onClick={restart} style={{
          background: "linear-gradient(135deg, rgba(52,152,219,0.2) 0%, rgba(155,89,182,0.2) 100%)",
          color: "#AAAACC", border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "9px", padding: "9px 24px", fontSize: "12px",
          fontWeight: 500, cursor: "pointer", letterSpacing: "0.1px",
        }}>
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
      `}</style>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  minHeight: "100dvh",
  backgroundColor: "#0F0F1A",
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  padding: "12px 16px",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const colStyle: CSSProperties = {
  display: "flex", flexDirection: "column",
  alignItems: "center", gap: "10px",
  width: "100%", maxWidth: "390px",
};

const overlayS: CSSProperties = {
  position: "absolute", inset: 0,
  backgroundColor: "rgba(15,15,26,0.92)",
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  gap: "16px", backdropFilter: "blur(8px)",
};

function btnPrimary(bg: string): CSSProperties {
  return { backgroundColor: bg, color: "#fff", border: "none", borderRadius: "10px", padding: "11px 22px", fontSize: "14px", fontWeight: 600, cursor: "pointer" };
}

const btnSecondary: CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.08)", color: "#B8B8CC",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px",
  padding: "11px 20px", fontSize: "14px", fontWeight: 500, cursor: "pointer",
};
