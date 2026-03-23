import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { LevelProgress } from "@/lib/levels";
import { TOTAL_LEVELS, totalStars } from "@/lib/levels";

interface Props {
  progress: LevelProgress[];
  onSelectLevel: (n: number) => void;
  onBack: () => void;
}

// Color theme per difficulty tier
const TIER = {
  easy:   { bg: "linear-gradient(135deg, #1a6fa8, #2980b9)", border: "#3498DB", label: "Easy",   range: "1 – 10" },
  medium: { bg: "linear-gradient(135deg, #6c3483, #8e44ad)", border: "#9B59B6", label: "Medium", range: "11 – 20" },
  hard:   { bg: "linear-gradient(135deg, #a93226, #e74c3c)", border: "#E74C3C", label: "Hard",   range: "21 – 30" },
};

function tier(n: number) {
  if (n <= 10) return "easy" as const;
  if (n <= 20) return "medium" as const;
  return "hard" as const;
}

const STAR = "★";
const EMPTY_STAR = "☆";
const LOCK = "🔒";

export default function LevelSelect({ progress, onSelectLevel, onBack }: Props) {
  // First unlocked+incomplete level = the "current" one (gets pulse highlight)
  const currentLevel = useMemo(() => {
    const idx = progress.findIndex(p => p.unlocked && p.stars === 0);
    return idx === -1 ? TOTAL_LEVELS : idx + 1;
  }, [progress]);

  const stars = totalStars(progress);
  const completed = progress.filter(p => p.stars > 0).length;

  // Group levels into sections of 10
  const sections = [
    { key: "easy",   levels: Array.from({ length: 10 }, (_, i) => i + 1) },
    { key: "medium", levels: Array.from({ length: 10 }, (_, i) => i + 11) },
    { key: "hard",   levels: Array.from({ length: 10 }, (_, i) => i + 21) },
  ] as const;

  return (
    <div className="screen-enter" style={rootS}>
      {/* Header */}
      <div style={headerS}>
        <button onClick={onBack} style={backBtnS}>← Back</button>
        <span style={{ color: "#E8E8F0", fontSize: "16px", fontWeight: 700 }}>Level Select</span>
        <span style={{ fontSize: "11px", color: "#F1C40F", fontWeight: 700, minWidth: "56px", textAlign: "right" }}>
          ★ {stars} / {TOTAL_LEVELS * 3}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ width: "100%", maxWidth: "380px", padding: "0 20px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "10px", color: "#5555AA" }}>Progress</span>
          <span style={{ fontSize: "10px", color: "#5555AA" }}>{completed} / {TOTAL_LEVELS} completed</span>
        </div>
        <div style={{ height: "3px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{
            width: `${(completed / TOTAL_LEVELS) * 100}%`, height: "100%",
            background: "linear-gradient(90deg, #3498DB, #9B59B6)",
            borderRadius: "2px", transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Level sections */}
      <div style={{ width: "100%", maxWidth: "380px", padding: "0 16px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "20px" }}>
        {sections.map(({ key, levels }) => {
          const t = TIER[key];
          return (
            <div key={key}>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: t.border }}>
                  {t.label.toUpperCase()} · {t.range}
                </span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />
              </div>

              {/* 5-column grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
                {levels.map(n => {
                  const p = progress[n - 1];
                  const locked = !p.unlocked;
                  const done = p.stars > 0;
                  const isCurrent = n === currentLevel;

                  return (
                    <button
                      key={n}
                      onClick={() => !locked && onSelectLevel(n)}
                      disabled={locked}
                      className={isCurrent ? "level-pulse" : undefined}
                      style={{
                        aspectRatio: "1",
                        borderRadius: "50%",
                        border: isCurrent
                          ? `2px solid ${t.border}`
                          : done
                          ? "2px solid rgba(255,255,255,0.12)"
                          : "2px solid rgba(255,255,255,0.06)",
                        background: locked
                          ? "rgba(255,255,255,0.04)"
                          : done
                          ? t.bg
                          : isCurrent
                          ? `linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))`
                          : "rgba(255,255,255,0.06)",
                        cursor: locked ? "default" : "pointer",
                        opacity: locked ? 0.4 : 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "1px",
                        padding: "4px",
                        boxShadow: isCurrent ? `0 0 12px ${t.border}55` : done ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                        transition: "transform 0.1s ease",
                      }}
                    >
                      {locked ? (
                        <span style={{ fontSize: "16px", lineHeight: 1 }}>{LOCK}</span>
                      ) : (
                        <>
                          <span style={{
                            fontSize: "15px", fontWeight: 800, lineHeight: 1,
                            color: done ? "#fff" : isCurrent ? "#E8E8F0" : "#6666AA",
                          }}>
                            {n}
                          </span>
                          <div style={{ display: "flex", gap: "1px" }}>
                            {[1, 2, 3].map(s => (
                              <span key={s} style={{
                                fontSize: "7px",
                                color: s <= p.stars ? "#F1C40F" : done ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
                              }}>
                                {s <= p.stars ? STAR : EMPTY_STAR}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom padding */}
      <div style={{ height: "24px" }} />

      <style>{`
        @keyframes level-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(255,255,255,0.15); }
          50% { box-shadow: 0 0 18px rgba(255,255,255,0.4), 0 0 6px rgba(255,255,255,0.2); }
        }
        .level-pulse { animation: level-pulse 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

const rootS: CSSProperties = {
  minHeight: "100dvh",
  backgroundColor: "#0F0F1A",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  paddingBottom: "16px",
  overflowY: "auto",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const headerS: CSSProperties = {
  width: "100%",
  maxWidth: "380px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px 0",
  boxSizing: "border-box",
};

const backBtnS: CSSProperties = {
  backgroundColor: "transparent",
  color: "#8888CC",
  border: "none",
  padding: "6px 0",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  minWidth: "56px",
};
