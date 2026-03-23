import { useEffect, useRef, useState, useCallback } from "react";

const GAP = 1;

const BASE_COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6"] as const;
const HARD_EXTRA_COLOR = "#E67E22";

type Difficulty = "easy" | "medium" | "hard";

interface DifficultyConfig {
  label: string;
  gridSize: number;
  canvasSize: number;
  moveLimit: number;
  colors: string[];
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy:   { label: "Easy",   gridSize: 8,  canvasSize: 320, moveLimit: 25, colors: [...BASE_COLORS] },
  medium: { label: "Medium", gridSize: 10, canvasSize: 340, moveLimit: 22, colors: [...BASE_COLORS] },
  hard:   { label: "Hard",   gridSize: 14, canvasSize: 336, moveLimit: 28, colors: [...BASE_COLORS, HARD_EXTRA_COLOR] },
};

function getCellSize(config: DifficultyConfig): number {
  return (config.canvasSize - (config.gridSize - 1) * GAP) / config.gridSize;
}

function generateBoard(config: DifficultyConfig): string[] {
  const total = config.gridSize * config.gridSize;
  const board: string[] = [];
  for (let i = 0; i < total; i++) {
    board.push(config.colors[Math.floor(Math.random() * config.colors.length)]);
  }
  return board;
}

function floodFillBoard(
  board: string[],
  playerRegion: Set<number>,
  newColor: string,
  gridSize: number
): { board: string[]; playerRegion: Set<number> } {
  const nextBoard = [...board];
  const nextRegion = new Set(playerRegion);

  for (const idx of playerRegion) {
    nextBoard[idx] = newColor;
  }

  const frontier: number[] = [...playerRegion];
  const visited = new Set<number>(playerRegion);

  while (frontier.length > 0) {
    const current = frontier.pop()!;
    const row = Math.floor(current / gridSize);
    const col = current % gridSize;

    const neighbors = [
      row > 0 ? current - gridSize : -1,
      row < gridSize - 1 ? current + gridSize : -1,
      col > 0 ? current - 1 : -1,
      col < gridSize - 1 ? current + 1 : -1,
    ];

    for (const neighbor of neighbors) {
      if (neighbor === -1 || visited.has(neighbor)) continue;
      if (nextBoard[neighbor] === newColor) {
        visited.add(neighbor);
        nextRegion.add(neighbor);
        nextBoard[neighbor] = newColor;
        frontier.push(neighbor);
      }
    }
  }

  return { board: nextBoard, playerRegion: nextRegion };
}

function greedySolveEstimate(board: string[], config: DifficultyConfig): number {
  const total = config.gridSize * config.gridSize;
  let currentBoard = [...board];
  let currentRegion = new Set<number>([0]);
  let currentColor = board[0];
  let moves = 0;

  while (currentRegion.size < total && moves < config.moveLimit * 2) {
    let bestColor = "";
    let bestSize = -1;

    for (const color of config.colors) {
      if (color === currentColor) continue;
      const result = floodFillBoard(currentBoard, currentRegion, color, config.gridSize);
      if (result.playerRegion.size > bestSize) {
        bestSize = result.playerRegion.size;
        bestColor = color;
      }
    }

    if (!bestColor || bestSize <= currentRegion.size) break;

    const result = floodFillBoard(currentBoard, currentRegion, bestColor, config.gridSize);
    currentBoard = result.board;
    currentRegion = result.playerRegion;
    currentColor = bestColor;
    moves++;
  }

  return moves;
}

function makeSolvableBoard(config: DifficultyConfig): string[] {
  const maxAttempts = 10;
  const threshold = config.moveLimit * 1.5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const board = generateBoard(config);
    const estimated = greedySolveEstimate(board, config);
    if (estimated <= threshold) {
      return board;
    }
  }

  return generateBoard(config);
}

function getAdjacentColors(board: string[], playerRegion: Set<number>, gridSize: number): Set<string> {
  const adjacent = new Set<string>();
  for (const idx of playerRegion) {
    const row = Math.floor(idx / gridSize);
    const col = idx % gridSize;
    const neighbors = [
      row > 0 ? idx - gridSize : -1,
      row < gridSize - 1 ? idx + gridSize : -1,
      col > 0 ? idx - 1 : -1,
      col < gridSize - 1 ? idx + 1 : -1,
    ];
    for (const n of neighbors) {
      if (n !== -1 && !playerRegion.has(n)) {
        adjacent.add(board[n]);
      }
    }
  }
  return adjacent;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [board, setBoard] = useState<string[]>([]);
  const [playerRegion, setPlayerRegion] = useState<Set<number>>(new Set([0]));
  const [currentColor, setCurrentColor] = useState<string>("");
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const boardRef = useRef<string[]>(board);
  const playerRegionRef = useRef<Set<number>>(playerRegion);
  const difficultyRef = useRef<Difficulty>(difficulty);

  const config = DIFFICULTIES[difficulty];

  const startNewGame = useCallback((diff: Difficulty) => {
    const cfg = DIFFICULTIES[diff];
    const b = makeSolvableBoard(cfg);
    boardRef.current = b;
    playerRegionRef.current = new Set([0]);
    difficultyRef.current = diff;
    setBoard(b);
    setPlayerRegion(new Set([0]));
    setCurrentColor(b[0]);
    setMoves(0);
    setWon(false);
    setGameOver(false);
  }, []);

  useEffect(() => {
    startNewGame("medium");
  }, [startNewGame]);

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const diff = difficultyRef.current;
    const cfg = DIFFICULTIES[diff];
    const cellSize = getCellSize(cfg);
    const b = boardRef.current;
    const region = playerRegionRef.current;
    const gs = cfg.gridSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < gs; row++) {
      for (let col = 0; col < gs; col++) {
        const idx = row * gs + col;
        const x = col * (cellSize + GAP);
        const y = row * (cellSize + GAP);

        ctx.fillStyle = b[idx];
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }

    for (const idx of region) {
      const row = Math.floor(idx / gs);
      const col = idx % gs;
      const x = col * (cellSize + GAP);
      const y = row * (cellSize + GAP);

      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;

      const up    = row > 0 ? idx - gs : -1;
      const down  = row < gs - 1 ? idx + gs : -1;
      const left  = col > 0 ? idx - 1 : -1;
      const right = col < gs - 1 ? idx + 1 : -1;

      if (up === -1 || !region.has(up)) {
        ctx.beginPath();
        ctx.moveTo(x, y + 0.75);
        ctx.lineTo(x + cellSize, y + 0.75);
        ctx.stroke();
      }
      if (down === -1 || !region.has(down)) {
        ctx.beginPath();
        ctx.moveTo(x, y + cellSize - 0.75);
        ctx.lineTo(x + cellSize, y + cellSize - 0.75);
        ctx.stroke();
      }
      if (left === -1 || !region.has(left)) {
        ctx.beginPath();
        ctx.moveTo(x + 0.75, y);
        ctx.lineTo(x + 0.75, y + cellSize);
        ctx.stroke();
      }
      if (right === -1 || !region.has(right)) {
        ctx.beginPath();
        ctx.moveTo(x + cellSize - 0.75, y);
        ctx.lineTo(x + cellSize - 0.75, y + cellSize);
        ctx.stroke();
      }
    }
  }, []);

  useEffect(() => {
    boardRef.current = board;
    playerRegionRef.current = playerRegion;
    difficultyRef.current = difficulty;
  }, [board, playerRegion, difficulty]);

  useEffect(() => {
    const loop = () => {
      drawBoard();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawBoard]);

  const handleColorPick = useCallback(
    (color: string) => {
      if (color === currentColor || won || gameOver) return;

      const cfg = DIFFICULTIES[difficulty];
      const result = floodFillBoard(board, playerRegion, color, cfg.gridSize);
      boardRef.current = result.board;
      playerRegionRef.current = result.playerRegion;

      const newMoves = moves + 1;
      setBoard(result.board);
      setPlayerRegion(result.playerRegion);
      setCurrentColor(color);
      setMoves(newMoves);

      if (result.playerRegion.size === cfg.gridSize * cfg.gridSize) {
        setWon(true);
      } else if (newMoves >= cfg.moveLimit) {
        setGameOver(true);
      }
    },
    [board, playerRegion, currentColor, won, gameOver, moves, difficulty]
  );

  const handleDifficultyChange = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    startNewGame(diff);
  }, [startNewGame]);

  const handleRestart = useCallback(() => {
    startNewGame(difficulty);
  }, [difficulty, startNewGame]);

  const adjacentColors = getAdjacentColors(board, playerRegion, config.gridSize);
  const movesLeft = config.moveLimit - moves;
  const movesRed = movesLeft <= 3 && !won && !gameOver;

  const canvasSize = board.length > 0 ? config.canvasSize : 340;

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#0F0F1A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          width: "100%",
          maxWidth: "390px",
        }}
      >
        <h1
          style={{
            color: "#E8E8F0",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.5px",
            margin: 0,
          }}
        >
          Color Fill
        </h1>

        <div style={{ display: "flex", gap: "8px" }}>
          {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => {
            const active = diff === difficulty;
            return (
              <button
                key={diff}
                onClick={() => handleDifficultyChange(diff)}
                style={{
                  backgroundColor: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                  color: active ? "#E8E8F0" : "#6666AA",
                  border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "7px 16px",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  letterSpacing: "0.1px",
                  transition: "all 0.15s ease",
                }}
              >
                {DIFFICULTIES[diff].label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            color: movesRed ? "#E74C3C" : "#8888AA",
            fontSize: "14px",
            fontWeight: movesRed ? 700 : 500,
            transition: "color 0.2s ease",
            letterSpacing: "0.2px",
          }}
        >
          Moves: {moves} / {config.moveLimit}
        </div>

        <div
          style={{
            position: "relative",
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5)",
            backgroundColor: "#0F0F1A",
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            style={{
              display: "block",
              width: canvasSize,
              height: canvasSize,
            }}
          />

          {won && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(15,15,26,0.90)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                backdropFilter: "blur(6px)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "44px", lineHeight: 1, marginBottom: "8px" }}>🎉</div>
                <div style={{ color: "#E8E8F0", fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                  You Win!
                </div>
                <div style={{ color: "#8888AA", fontSize: "14px", marginTop: "6px" }}>
                  Completed in {moves} move{moves !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={handleRestart}
                style={{
                  backgroundColor: "#3498DB",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "11px 26px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Play Again
              </button>
            </div>
          )}

          {gameOver && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(15,15,26,0.90)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                backdropFilter: "blur(6px)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "44px", lineHeight: 1, marginBottom: "8px" }}>😢</div>
                <div style={{ color: "#E8E8F0", fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                  Game Over!
                </div>
                <div style={{ color: "#8888AA", fontSize: "14px", marginTop: "6px" }}>
                  Used all {moves} moves
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={handleRestart}
                  style={{
                    backgroundColor: "#E74C3C",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "11px 22px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    const next: Difficulty = difficulty === "hard" ? "medium" : difficulty === "medium" ? "easy" : "easy";
                    handleDifficultyChange(next === difficulty ? "easy" : next);
                  }}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    color: "#B8B8CC",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "10px",
                    padding: "11px 22px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Change Difficulty
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: difficulty === "hard" ? "10px" : "14px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {config.colors.map((color) => {
            const isActive = color === currentColor;
            const isHint = !isActive && adjacentColors.has(color);
            const btnSize = difficulty === "hard" ? 44 : 50;

            return (
              <button
                key={color}
                onClick={() => handleColorPick(color)}
                disabled={isActive || won || gameOver}
                style={{
                  width: btnSize,
                  height: btnSize,
                  borderRadius: "50%",
                  backgroundColor: color,
                  border: isActive
                    ? "3px solid rgba(255,255,255,0.9)"
                    : isHint
                    ? `3px solid rgba(255,255,255,0.55)`
                    : "3px solid transparent",
                  cursor: isActive || won || gameOver ? "default" : "pointer",
                  opacity: isActive ? 0.45 : 1,
                  transition: "transform 0.1s ease, opacity 0.15s ease, box-shadow 0.15s ease",
                  transform: isActive ? "scale(0.85)" : "scale(1)",
                  boxShadow: isActive
                    ? "none"
                    : isHint
                    ? `0 0 0 3px ${color}44, 0 4px 14px ${color}66`
                    : `0 4px 10px ${color}44, 0 0 0 1.5px rgba(255,255,255,0.05)`,
                  outline: "none",
                  padding: 0,
                  position: "relative",
                }}
              >
                {isHint && !isActive && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.35)",
                      animation: "pulse-ring 1.8s ease-in-out infinite",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleRestart}
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "#6666AA",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "9px",
            padding: "9px 22px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: "0.1px",
          }}
        >
          New Game
        </button>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 0.7; }
          50%  { transform: scale(1.18); opacity: 0.3; }
          100% { transform: scale(1);    opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
