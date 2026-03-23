import { useEffect, useRef, useState, useCallback } from "react";

const GRID_SIZE = 10;
const CANVAS_SIZE = 340;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;

const COLORS = [
  "#E74C3C",
  "#3498DB",
  "#2ECC71",
  "#F1C40F",
  "#9B59B6",
] as const;

type Color = (typeof COLORS)[number];

function generateBoard(): Color[] {
  const board: Color[] = [];
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    board.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }
  return board;
}

function floodFill(
  board: Color[],
  playerRegion: Set<number>,
  newColor: Color
): { board: Color[]; playerRegion: Set<number> } {
  const nextBoard = [...board];
  const nextRegion = new Set(playerRegion);

  for (const idx of playerRegion) {
    nextBoard[idx] = newColor;
  }

  const frontier: number[] = [...playerRegion];
  const visited = new Set<number>(playerRegion);

  while (frontier.length > 0) {
    const current = frontier.pop()!;
    const row = Math.floor(current / GRID_SIZE);
    const col = current % GRID_SIZE;

    const neighbors = [
      row > 0 ? current - GRID_SIZE : -1,
      row < GRID_SIZE - 1 ? current + GRID_SIZE : -1,
      col > 0 ? current - 1 : -1,
      col < GRID_SIZE - 1 ? current + 1 : -1,
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

function checkWin(playerRegion: Set<number>): boolean {
  return playerRegion.size === GRID_SIZE * GRID_SIZE;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const [board, setBoard] = useState<Color[]>(() => generateBoard());
  const [playerRegion, setPlayerRegion] = useState<Set<number>>(
    () => new Set([0])
  );
  const [currentColor, setCurrentColor] = useState<Color>(() => {
    const b = generateBoard();
    return b[0];
  });
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);

  const initialColor = useRef<Color | null>(null);
  const boardRef = useRef<Color[]>(board);
  const playerRegionRef = useRef<Set<number>>(playerRegion);

  useEffect(() => {
    const b = generateBoard();
    boardRef.current = b;
    playerRegionRef.current = new Set([0]);
    setBoard(b);
    setPlayerRegion(new Set([0]));
    setCurrentColor(b[0]);
    initialColor.current = b[0];
    setMoves(0);
    setWon(false);
  }, []);

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const b = boardRef.current;
    const region = playerRegionRef.current;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const idx = row * GRID_SIZE + col;
        ctx.fillStyle = b[idx];
        ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);

        if (region.has(idx)) {
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(
            col * CELL_SIZE + 0.25,
            row * CELL_SIZE + 0.25,
            CELL_SIZE - 0.5,
            CELL_SIZE - 0.5
          );
        }
      }
    }
  }, []);

  useEffect(() => {
    boardRef.current = board;
    playerRegionRef.current = playerRegion;

    const loop = () => {
      drawBoard();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [board, playerRegion, drawBoard]);

  const handleColorPick = useCallback(
    (color: Color) => {
      if (color === currentColor || won) return;

      const result = floodFill(board, playerRegion, color);
      boardRef.current = result.board;
      playerRegionRef.current = result.playerRegion;

      setBoard(result.board);
      setPlayerRegion(result.playerRegion);
      setCurrentColor(color);
      setMoves((m) => m + 1);

      if (checkWin(result.playerRegion)) {
        setWon(true);
      }
    },
    [board, playerRegion, currentColor, won]
  );

  const handleRestart = useCallback(() => {
    const b = generateBoard();
    boardRef.current = b;
    playerRegionRef.current = new Set([0]);
    setBoard(b);
    setPlayerRegion(new Set([0]));
    setCurrentColor(b[0]);
    setMoves(0);
    setWon(false);
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#0F0F1A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          width: "100%",
          maxWidth: "390px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <h1
            style={{
              color: "#E8E8F0",
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.5px",
              margin: 0,
            }}
          >
            Color Fill
          </h1>
          <div
            style={{
              color: "#8888AA",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Moves: {moves}
          </div>
        </div>

        <div
          style={{
            position: "relative",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow:
              "0 0 0 2px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{
              display: "block",
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
            }}
          />

          {won && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(15,15,26,0.88)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                backdropFilter: "blur(4px)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "48px",
                    lineHeight: 1,
                    marginBottom: "8px",
                  }}
                >
                  🎉
                </div>
                <div
                  style={{
                    color: "#E8E8F0",
                    fontSize: "28px",
                    fontWeight: 800,
                    letterSpacing: "-0.5px",
                  }}
                >
                  You Win!
                </div>
                <div
                  style={{
                    color: "#8888AA",
                    fontSize: "15px",
                    marginTop: "6px",
                  }}
                >
                  Completed in {moves} move{moves !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={handleRestart}
                style={{
                  backgroundColor: "#3498DB",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  padding: "12px 28px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "-0.2px",
                }}
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {COLORS.map((color) => {
            const isActive = color === currentColor;
            return (
              <button
                key={color}
                onClick={() => handleColorPick(color)}
                disabled={isActive || won}
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  backgroundColor: color,
                  border: isActive
                    ? "3px solid rgba(255,255,255,0.9)"
                    : "3px solid transparent",
                  cursor: isActive || won ? "default" : "pointer",
                  opacity: isActive ? 0.5 : 1,
                  transition: "transform 0.1s ease, opacity 0.15s ease",
                  transform: isActive ? "scale(0.88)" : "scale(1)",
                  boxShadow: isActive
                    ? "none"
                    : `0 4px 12px ${color}55, 0 0 0 2px rgba(255,255,255,0.06)`,
                  outline: "none",
                  padding: 0,
                }}
              />
            );
          })}
        </div>

        <button
          onClick={handleRestart}
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            color: "#8888AA",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "10px 24px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: "0.1px",
          }}
        >
          New Game
        </button>
      </div>
    </div>
  );
}
