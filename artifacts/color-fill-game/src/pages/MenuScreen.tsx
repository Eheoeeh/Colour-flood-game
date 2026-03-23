import type { CSSProperties } from "react";
import { getOverallBest, totalStars, TOTAL_LEVELS } from "@/lib/levels";
import type { LevelProgress } from "@/lib/levels";
import { loadCoins } from "@/lib/coins";
import BannerAd from "@/components/BannerAd";

interface Props {
  onPlay: () => void;
  onSettings: () => void;
  progress: LevelProgress[];
}

export default function MenuScreen({ onPlay, onSettings, progress }: Props) {
  const best = getOverallBest();
  const stars = totalStars(progress);
  const completed = progress.filter(p => p.stars > 0).length;
  const coins = loadCoins();

  const handlePlay = () => {
    console.log("[CF] Play button tapped");
    onPlay();
  };

  const handleSettings = () => {
    console.log("[CF] Settings button tapped");
    onSettings();
  };

  return (
    <div className="screen-enter" style={rootS}>
      {/* CSS-only animated gradient background — no JS, no rAF, works in any WebView */}
      <div className="cf-menu-bg" style={{
        position: "absolute", inset: 0, opacity: 0.22,
      }} />

      {/* Dark overlay */}
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
          <button
            type="button"
            onClick={handlePlay}
            onTouchEnd={(e) => { e.preventDefault(); handlePlay(); }}
            style={playBtnS}
          >
            {completed > 0 ? "Continue" : "Play"}
          </button>
          <button
            type="button"
            onClick={handleSettings}
            onTouchEnd={(e) => { e.preventDefault(); handleSettings(); }}
            style={settingsBtnS}
          >
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
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
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
  WebkitTapHighlightColor: "transparent",
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
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
};
