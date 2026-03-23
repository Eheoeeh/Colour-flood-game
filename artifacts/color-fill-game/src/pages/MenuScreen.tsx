import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getOverallBest, totalStars, TOTAL_LEVELS } from "@/lib/levels";
import type { LevelProgress } from "@/lib/levels";
import { loadCoins } from "@/lib/coins";
import BannerAd from "@/components/BannerAd";
import { isAndroid } from "@/lib/device";

const BG_COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F1C40F", "#9B59B6", "#E67E22"];

// Reduce grid heavily on Android to prevent CPU/render overload
const android = isAndroid();
const COLS = android ? 4 : 8;
const ROWS = android ? 6 : 14;
const CELL_INTERVAL = android ? 3500 : 900;
const CELL_TRANSITION = android ? "none" : "background-color 2.8s ease";

interface Props {
  onPlay: () => void;
  onSettings: () => void;
  progress: LevelProgress[];
}

export default function MenuScreen({ onPlay, onSettings, progress }: Props) {
  const [cells, setCells] = useState(() =>
    Array.from({ length: COLS * ROWS }, () => BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)])
  );

  useEffect(() => {
    let raf: number;
    let lastUpdate = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastUpdate < CELL_INTERVAL) return;
      lastUpdate = now;
      setCells(prev =>
        prev.map(c => (Math.random() > 0.93 ? BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)] : c))
      );
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const best = getOverallBest();
  const stars = totalStars(progress);
  const completed = progress.filter(p => p.stars > 0).length;
  const coins = loadCoins();

  return (
    <div className="screen-enter" style={rootS}>
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
          <div key={i} style={{ backgroundColor: c, borderRadius: "5px", transition: CELL_TRANSITION }} />
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

        {/* Coin balance badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(241,196,15,0.12)", border: "1px solid rgba(241,196,15,0.25)", borderRadius: "99px", padding: "6px 16px" }}>
          <span style={{ fontSize: "16px" }}>🪙</span>
          <span style={{ color: "#F1C40F", fontSize: "16px", fontWeight: 800, letterSpacing: "-0.3px" }}>{coins}</span>
          <span style={{ color: "#886600", fontSize: "11px", fontWeight: 500 }}>coins</span>
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
          <button onClick={onPlay} style={playBtnS} type="button">
            {completed > 0 ? "Continue" : "Play"}
          </button>
          <button onClick={onSettings} style={settingsBtnS} type="button">
            Settings
          </button>
        </div>
      </div>

      <BannerAd />
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
  touchAction: "manipulation",
};

const settingsBtnS: CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "#8888BB",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
  padding: "16px 0",
  fontSize: "17px",
  fontWeight: 500,
  cursor: "pointer",
  touchAction: "manipulation",
};
