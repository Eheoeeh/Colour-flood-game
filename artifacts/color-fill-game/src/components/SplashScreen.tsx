import { useEffect, useState } from "react";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1700);
    const t2 = setTimeout(() => onDone(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      backgroundColor: "#0F0F1A",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
      opacity: fading ? 0 : 1,
      WebkitTransition: "opacity 0.5s ease",
      transition: "opacity 0.5s ease",
      pointerEvents: "none",
      userSelect: "none",
      WebkitUserSelect: "none",
    }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          fontSize: "56px", fontWeight: 900, letterSpacing: "-2.5px", lineHeight: 1,
          background: "linear-gradient(135deg, #E74C3C 0%, #9B59B6 50%, #3498DB 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          Color
        </div>
        <div style={{
          fontSize: "56px", fontWeight: 900, letterSpacing: "-2.5px", lineHeight: 1,
          background: "linear-gradient(135deg, #3498DB 0%, #2ECC71 50%, #F1C40F 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          Fill
        </div>
        <div style={{ color: "#44447A", fontSize: "11px", letterSpacing: "3px", marginTop: "10px", fontWeight: 600 }}>
          FLOOD & CONQUER
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {(["#E74C3C", "#2ECC71", "#3498DB"] as const).map((color, i) => (
          <div
            key={color}
            className="cf-splash-dot"
            style={{
              width: 11, height: 11, borderRadius: "50%",
              backgroundColor: color,
              animationDelay: `${i * 0.18}s`,
              WebkitAnimationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
