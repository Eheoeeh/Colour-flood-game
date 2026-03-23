import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";

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
  colors: string[];
}

const DIFFICULTIES: Record<Difficulty, Cfg> = {
  easy:   { label: "Easy",   gridSize: 8,  canvasSize: 320, moveLimit: 25, colors: [...BASE_COLORS] },
  medium: { label: "Medium", gridSize: 10, canvasSize: 340, moveLimit: 22, colors: [...BASE_COLORS] },
  hard:   { label: "Hard",   gridSize: 14, canvasSize: 336, moveLimit: 28, colors: [...BASE_COLORS, HARD_EXTRA] },
};

function cellSize(cfg: Cfg) {
  return (cfg.canvasSize - (cfg.gridSize - 1) * GAP) / cfg.gridSize;
}

function randomBoard(cfg: Cfg): string[] {
  return Array.from({ length: cfg.gridSize * cfg.gridSize }, () =>
    cfg.colors[Math.floor(Math.random() * cfg.colors.length)]
  );
}

function floodFill(
  board: string[],
  region: Set<number>,
  color: string,
  gs: number
): { board: string[]; region: Set<number> } {
  const b = [...board];
  const r = new Set(region);
  for (const i of region) b[i] = color;
  const frontier = [...region];
  const visited = new Set(region);
  while (frontier.length) {
    const cur = frontier.pop()!;
    const row = Math.floor(cur / gs), col = cur % gs;
    const nbrs = [
      row > 0 ? cur - gs : -1,
      row < gs - 1 ? cur + gs : -1,
      col > 0 ? cur - 1 : -1,
      col < gs - 1 ? cur + 1 : -1,
    ];
    for (const n of nbrs) {
      if (n === -1 || visited.has(n)) continue;
      if (b[n] === color) { visited.add(n); r.add(n); frontier.push(n); }
    }
  }
  return { board: b, region: r };
}

/** Returns BFS layers of newly absorbed cells */
function fillWaves(
  board: string[],
  region: Set<number>,
  color: string,
  gs: number
): { waves: number[][]; finalBoard: string[]; finalRegion: Set<number> } {
  const b = [...board];
  for (const i of region) b[i] = color;
  const finalRegion = new Set(region);
  const waves: number[][] = [];
  let frontier = [...region];
  const visited = new Set(region);
  while (true) {
    const wave: number[] = [];
    for (const cur of frontier) {
      const row = Math.floor(cur / gs), col = cur % gs;
      const nbrs = [
        row > 0 ? cur - gs : -1,
        row < gs - 1 ? cur + gs : -1,
        col > 0 ? cur - 1 : -1,
        col < gs - 1 ? cur + 1 : -1,
      ];
      for (const n of nbrs) {
        if (n === -1 || visited.has(n)) continue;
        if (b[n] === color) { visited.add(n); finalRegion.add(n); wave.push(n); }
      }
    }
    if (!wave.length) break;
    waves.push(wave);
    frontier = wave;
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
    for (const n of [
      row > 0 ? i - gs : -1,
      row < gs - 1 ? i + gs : -1,
      col > 0 ? i - 1 : -1,
      col < gs - 1 ? i + 1 : -1,
    ]) {
      if (n !== -1 && !region.has(n)) s.add(board[n]);
    }
  }
  return s;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if ("roundRect" in ctx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [board, setBoard] = useState<string[]>([]);
  const [region, setRegion] = useState<Set<number>>(new Set([0]));
  const [curColor, setCurColor] = useState<string>("");
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isAnim, setIsAnim] = useState(false);

  // Canvas drawing refs — updated immediately without waiting for React re-render
  const boardR = useRef<string[]>([]);
  const regionR = useRef<Set<number>>(new Set([0]));
  const diffR = useRef<Difficulty>("medium");
  const isAnimR = useRef(false);
  const pulseR = useRef<Map<number, number>>(new Map());

  const cfg = DIFFICULTIES[difficulty];

  const startGame = useCallback((diff: Difficulty) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    isAnimR.current = false;
    pulseR.current.clear();
    const c = DIFFICULTIES[diff];
    const b = makeBoard(c);
    boardR.current = b;
    regionR.current = new Set([0]);
    diffR.current = diff;
    setBoard(b);
    setRegion(new Set([0]));
    setCurColor(b[0]);
    setMoves(0);
    setWon(false);
    setGameOver(false);
    setIsAnim(false);
  }, []);

  useEffect(() => { startGame("medium"); }, [startGame]);

  // Sync refs from React state (non-anim path)
  useEffect(() => { boardR.current = board; }, [board]);
  useEffect(() => { regionR.current = region; }, [region]);
  useEffect(() => { diffR.current = difficulty; }, [difficulty]);

  // rAF draw loop
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

    // Draw cells
    for (let row = 0; row < gs; row++) {
      for (let col = 0; col < gs; col++) {
        const idx = row * gs + col;
        const bx = col * (cs + GAP);
        const by = row * (cs + GAP);
        const pt = pulseR.current.get(idx);
        ctx.fillStyle = b[idx];

        if (pt !== undefined) {
          const elapsed = now - pt;
          if (elapsed < PULSE_MS) {
            const t = elapsed / PULSE_MS;
            const scale = 1 + 0.15 * Math.sin(Math.PI * t);
            ctx.save();
            ctx.translate(bx + cs / 2, by + cs / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(bx + cs / 2), -(by + cs / 2));
            roundRect(ctx, bx, by, cs, cs, radius);
            ctx.restore();
          } else {
            pulseR.current.delete(idx);
            roundRect(ctx, bx, by, cs, cs, radius);
          }
        } else {
          roundRect(ctx, bx, by, cs, cs, radius);
        }
      }
    }

    // Blob outline with glow
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

        if (row === 0 || !r.has(idx - gs)) {
          ctx.beginPath(); ctx.moveTo(x, y + 0.5); ctx.lineTo(x + cs, y + 0.5); ctx.stroke();
        }
        if (row === gs - 1 || !r.has(idx + gs)) {
          ctx.beginPath(); ctx.moveTo(x, y + cs - 0.5); ctx.lineTo(x + cs, y + cs - 0.5); ctx.stroke();
        }
        if (col === 0 || !r.has(idx - 1)) {
          ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + cs); ctx.stroke();
        }
        if (col === gs - 1 || !r.has(idx + 1)) {
          ctx.beginPath(); ctx.moveTo(x + cs - 0.5, y); ctx.lineTo(x + cs - 0.5, y + cs); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const pickColor = useCallback((color: string) => {
    if (color === curColor || won || gameOver || isAnimR.current) return;

    const c = DIFFICULTIES[difficulty];
    const { waves, finalBoard, finalRegion } = fillWaves(board, region, color, c.gridSize);
    const newMoves = moves + 1;

    // Paint existing region to new color immediately
    const visualBoard = [...board];
    for (const i of region) visualBoard[i] = color;
    boardR.current = visualBoard;

    // Pulse existing region cells on color change
    const now = performance.now();
    for (const i of region) pulseR.current.set(i, now);

    if (waves.length === 0) {
      // No new cells — instant update
      setBoard(finalBoard);
      setRegion(finalRegion);
      setCurColor(color);
      setMoves(newMoves);
      if (newMoves >= c.moveLimit && finalRegion.size < c.gridSize * c.gridSize) setGameOver(true);
      return;
    }

    isAnimR.current = true;
    setIsAnim(true);

    const animB = [...visualBoard];
    const animR = new Set(region);
    let wi = 0;

    intervalRef.current = setInterval(() => {
      if (wi >= waves.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        isAnimR.current = false;
        boardR.current = finalBoard;
        regionR.current = finalRegion;
        setBoard(finalBoard);
        setRegion(finalRegion);
        setCurColor(color);
        setMoves(newMoves);
        setIsAnim(false);
        if (finalRegion.size === c.gridSize * c.gridSize) {
          setWon(true);
        } else if (newMoves >= c.moveLimit) {
          setGameOver(true);
        }
        return;
      }
      const wave = waves[wi];
      const wt = performance.now();
      for (const i of wave) {
        animB[i] = color;
        animR.add(i);
        pulseR.current.set(i, wt);
      }
      boardR.current = [...animB];
      regionR.current = new Set(animR);
      wi++;
    }, WAVE_MS);
  }, [board, region, curColor, won, gameOver, moves, difficulty]);

  const changeDiff = useCallback((d: Difficulty) => { setDifficulty(d); startGame(d); }, [startGame]);
  const restart = useCallback(() => startGame(difficulty), [difficulty, startGame]);

  // Capture gains per color
  const gains = useMemo(() => {
    const g: Record<string, number> = {};
    if (isAnim || !board.length) return g;
    for (const c of cfg.colors) {
      if (c === curColor) { g[c] = 0; continue; }
      const res = floodFill(board, region, c, cfg.gridSize);
      g[c] = res.region.size - region.size;
    }
    return g;
  }, [board, region, curColor, cfg, isAnim]);

  const adjColors = useMemo(() => adjacentColors(board, region, cfg.gridSize), [board, region, cfg.gridSize]);

  const total = cfg.gridSize * cfg.gridSize;
  const coverage = board.length ? Math.round((region.size / total) * 100) : 0;
  const movesLeft = cfg.moveLimit - moves;
  const movesRatio = movesLeft / cfg.moveLimit;
  const movesRed = movesLeft <= 3 && !won && !gameOver;
  const barColor = won ? "#2ECC71" : movesRatio > 0.5 ? "#2ECC71" : movesRatio > 0.25 ? "#F1C40F" : "#E74C3C";
  const canvasSz = board.length ? cfg.canvasSize : 340;
  const btnSz = difficulty === "hard" ? 44 : 50;

  return (
    <div style={rootStyle}>
      <div style={colStyle}>
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

        {/* Moves counter */}
        <div style={{ color: movesRed ? "#E74C3C" : "#8888AA", fontSize: "14px", fontWeight: movesRed ? 700 : 500, transition: "color 0.2s ease" }}>
          Moves: {moves} / {cfg.moveLimit}
        </div>

        {/* Progress */}
        <div style={{ width: canvasSz, display: "flex", flexDirection: "column", gap: "5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", color: "#6666AA" }}>Captured: {coverage}%</span>
            <span style={{ fontSize: "11px", color: "#6666AA" }}>{region.size} / {total}</span>
          </div>
          <div style={{ width: "100%", height: "5px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{
              width: `${coverage}%`, height: "100%", borderRadius: "3px",
              backgroundColor: barColor,
              transition: "width 0.35s ease, background-color 0.4s ease",
              boxShadow: `0 0 8px ${barColor}99`,
            }} />
          </div>
        </div>

        {/* Canvas */}
        <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", backgroundColor: "#0F0F1A", boxShadow: "0 0 0 2px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5)" }}>
          <canvas ref={canvasRef} width={canvasSz} height={canvasSz} style={{ display: "block", width: canvasSz, height: canvasSz }} />

          {won && (
            <div style={overlayS}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "44px", lineHeight: 1, marginBottom: "8px" }}>🎉</div>
                <div style={{ color: "#E8E8F0", fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px" }}>You Win!</div>
                <div style={{ color: "#8888AA", fontSize: "14px", marginTop: "6px" }}>
                  Completed in {moves} move{moves !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={restart} style={btnPrimary("#3498DB")}>Play Again</button>
            </div>
          )}

          {gameOver && (
            <div style={overlayS}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "44px", lineHeight: 1, marginBottom: "8px" }}>😢</div>
                <div style={{ color: "#E8E8F0", fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px" }}>Game Over!</div>
                <div style={{ color: "#8888AA", fontSize: "14px", marginTop: "6px" }}>
                  Used all {moves} moves
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={restart} style={btnPrimary("#E74C3C")}>Try Again</button>
                <button
                  onClick={() => {
                    const order: Difficulty[] = ["easy", "medium", "hard"];
                    const i = order.indexOf(difficulty);
                    changeDiff(order[Math.max(0, i - 1)]);
                  }}
                  style={btnSecondary}
                >
                  Easier
                </button>
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
                <button
                  onClick={() => pickColor(color)}
                  disabled={active || won || gameOver || isAnim}
                  style={{
                    width: sz, height: sz,
                    borderRadius: "50%",
                    backgroundColor: color,
                    border: active
                      ? "3px solid rgba(255,255,255,0.95)"
                      : isHint ? "3px solid rgba(255,255,255,0.45)"
                      : "3px solid transparent",
                    cursor: active || won || gameOver || isAnim ? "default" : "pointer",
                    opacity: isZero ? 0.28 : 1,
                    transition: "width 0.15s ease, height 0.15s ease, opacity 0.2s ease, box-shadow 0.15s ease",
                    boxShadow: active
                      ? `0 0 0 4px rgba(255,255,255,0.18), 0 4px 18px ${color}99`
                      : isHint ? `0 0 0 3px ${color}44, 0 4px 14px ${color}77`
                      : `0 4px 10px ${color}44`,
                    outline: "none", padding: 0,
                  }}
                />
                {showBadge && (
                  <div style={{
                    position: "absolute", top: -5, right: -5,
                    backgroundColor: "#E8E8F0", color: "#0F0F1A",
                    fontSize: "9px", fontWeight: 800,
                    borderRadius: "99px", padding: "1.5px 4px", lineHeight: 1.3,
                    pointerEvents: "none", minWidth: "14px", textAlign: "center",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                  }}>
                    +{gain}
                  </div>
                )}
                {isHint && !active && !isZero && (
                  <span style={{
                    position: "absolute",
                    width: sz + 8, height: sz + 8,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.28)",
                    animation: "pulse-ring 2s ease-in-out infinite",
                    pointerEvents: "none",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* New Game */}
        <button onClick={restart} style={{
          background: "linear-gradient(135deg, rgba(52,152,219,0.2) 0%, rgba(155,89,182,0.2) 100%)",
          color: "#AAAACC",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "9px", padding: "9px 24px",
          fontSize: "12px", fontWeight: 500, cursor: "pointer", letterSpacing: "0.1px",
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
      `}</style>
    </div>
  );
}

const rootStyle: CSSProperties = {
  minHeight: "100dvh",
  backgroundColor: "#0F0F1A",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const colStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  maxWidth: "390px",
};

const overlayS: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundColor: "rgba(15,15,26,0.90)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  backdropFilter: "blur(6px)",
};

function btnPrimary(bg: string): CSSProperties {
  return { backgroundColor: bg, color: "#fff", border: "none", borderRadius: "10px", padding: "11px 26px", fontSize: "14px", fontWeight: 600, cursor: "pointer" };
}

const btnSecondary: CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#B8B8CC",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  padding: "11px 22px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
};
