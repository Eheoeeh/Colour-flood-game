import { useEffect, useState } from "react";

export type AdType = "interstitial" | "rewarded";

interface Props {
  type: AdType;
  label?: string;
  onComplete: (watched: boolean) => void;
}

export default function AdOverlay({ type, label, onComplete }: Props) {
  const isRewarded = type === "rewarded";
  const duration = isRewarded ? 3 : 2;
  const [countdown, setCountdown] = useState(duration);
  const [done, setDone] = useState(false);

  useEffect(() => {
    console.log(`[AdMob] ${isRewarded ? "Rewarded" : "Interstitial"} ad started`);
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id);
          setDone(true);
          if (!isRewarded) {
            console.log("[AdMob] Interstitial ad completed — auto-closing");
            setTimeout(() => onComplete(true), 400);
          } else {
            console.log("[AdMob] Rewarded ad completed — granting reward");
            setTimeout(() => onComplete(true), 600);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      backgroundColor: "#0F0F1A",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      userSelect: "none",
    }}>
      <div style={{
        width: "88%", maxWidth: 340,
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18,
        padding: "36px 24px 28px",
        textAlign: "center",
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 52, marginBottom: 14, lineHeight: 1 }}>
          {isRewarded ? "🎬" : "📺"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          {isRewarded ? "Rewarded Ad" : "Advertisement"}
        </div>
        {label && (
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            {label}
          </div>
        )}
        <div style={{
          color: "rgba(255,255,255,0.25)", fontSize: 12, lineHeight: 1.6,
          backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 16px",
          border: "1px dashed rgba(255,255,255,0.07)",
        }}>
          Ad placeholder<br />
          Real AdMob SDK will display here
        </div>
      </div>

      {!done ? (
        <div style={{
          backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 99,
          padding: "9px 22px", color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 600,
        }}>
          {isRewarded ? `Earn reward in ${countdown}s…` : `Closes in ${countdown}s`}
        </div>
      ) : (
        <div style={{
          backgroundColor: "rgba(46,204,113,0.15)", border: "1px solid rgba(46,204,113,0.35)",
          borderRadius: 99, padding: "9px 22px", color: "#2ECC71", fontSize: 14, fontWeight: 700,
        }}>
          {isRewarded ? "✓ Reward granted!" : "✓ Done"}
        </div>
      )}

      {isRewarded && !done && (
        <button
          onClick={() => {
            console.log("[AdMob] Rewarded ad skipped by user — no reward granted");
            onComplete(false);
          }}
          style={{
            marginTop: 14, backgroundColor: "transparent", border: "none",
            color: "rgba(255,255,255,0.25)", fontSize: 13, cursor: "pointer", padding: "6px 12px",
          }}
        >
          No thanks
        </button>
      )}
    </div>
  );
}
