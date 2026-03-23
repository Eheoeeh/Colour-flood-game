import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getOverallBest, totalStars, TOTAL_LEVELS } from "@/lib/levels";
import type { LevelProgress } from "@/lib/levels";

const BG_COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6", "#E67E22"];
const COLS = 8;
const ROWS = 14;

interface Props {
  onPlay: () => void;
  progress: LevelProgress[];
}

export default function MenuScreen({ onPlay, progress }: Props) {
  const [cells, setCells] = useState(() =>
    Array.from({ length: COLS * ROWS }, () => BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)])
  );

  useEffect(() => {
    const id = setInterval(() => {
      setCells(prev =>
        prev.map(c => (Math.random() > 0.91 ? BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)] : c))
      );
    }, 850);
    return () => clearInterval(id);
  }, []);

  const best = getOverallBest();
  const stars = totalStars(progress);
  const completed = progress.filter(p => p.stars > 0).length;

  return (
    <div style={rootS}>
      {/* Animated color grid background */}
      <div style={{
        position: "absolute", inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        gap: "3px", padding: "3px",
        opacity: 0.2,
      }}>
        {cells.map((c, i) => (
          <div key={i} style={{ backgroundColor: c, borderRadius: "5px", transition: "background-color 2.8s ease" }} />
        ))}
      </div>

      {/* Gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(160deg, rgba(15,15,26,0.55) 0%, rgba(15,15,26,0.82) 55%, rgba(15,15,26,0.95) 100%)",
      }} />

      {/* Content */}
      <div style={contentS}>
        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: "58px", fontWeight: 900, letterSpacing: "-2.5px", lineHeight: 1,
            background: "linear-gradient(135deg, #E74C3C 0%, #9B59B6 50%, #3498DB 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Color
          </div>
          <div style={{
            fontSize: "58px", fontWeight: 900, letterSpacing: "-2.5px", lineHeight: 1,
            background: "linear-gradient(135deg, #3498DB 0%, #2ECC71 50%, #F1C40F 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Fill
          </div>
          <div style={{ color: "#44447A", fontSize: "11px", letterSpacing: "3px", marginTop: "8px", fontWeight: 600 }}>
            FLOOD & CONQUER
          </div>
        </div>

        {/* Stats row (if progress) */}
        {completed > 0 && (
          <div style={{ display: "flex", gap: "24px", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#F1C40F", fontSize: "18px", fontWeight: 800 }}>
                {"★".repeat(Math.min(3, Math.round(stars / Math.max(1, completed))))}{"☆".repeat(Math.max(0, 3 - Math.min(3, Math.round(stars / Math.max(1, completed)))))}
              </div>
              <div style={{ color: "#5555AA", fontSize: "10px" }}>{stars} / {TOTAL_LEVELS * 3} stars</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#E8E8F0", fontSize: "18px", fontWeight: 800 }}>{completed}</div>
              <div style={{ color: "#5555AA", fontSize: "10px" }}>levels done</div>
            </div>
            {best > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#E8E8F0", fontSize: "18px", fontWeight: 800 }}>{best.toLocaleString()}</div>
                <div style={{ color: "#5555AA", fontSize: "10px" }}>best score</div>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "240px" }}>
          <button onClick={onPlay} style={playBtnS}>
            {completed > 0 ? "Continue" : "Play"}
          </button>
          <button style={settingsBtnS} disabled>
            Settings
          </button>
        </div>
      </div>

      <style>{`
        @keyframes menu-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

const rootS: CSSProperties = {
  position: "relative",
  minHeight: "100dvh",
  overflow: "hidden",
  backgroundColor: "#0F0F1A",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const contentS: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "36px",
};

const playBtnS: CSSProperties = {
  background: "linear-gradient(135deg, #3498DB, #9B59B6)",
  color: "#fff",
  border: "none",
  borderRadius: "16px",
  padding: "18px 0",
  fontSize: "20px",
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "-0.3px",
  boxShadow: "0 10px 30px rgba(52,152,219,0.45)",
  transition: "transform 0.1s ease, box-shadow 0.1s ease",
};

const settingsBtnS: CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.05)",
  color: "#44447A",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "16px",
  padding: "16px 0",
  fontSize: "17px",
  fontWeight: 500,
  cursor: "not-allowed",
  opacity: 0.6,
};
