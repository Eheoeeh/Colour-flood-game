import { useState } from "react";
import { loadSettings, saveSettings, type GameSettings } from "@/lib/settings";
import { resetProgress } from "@/lib/levels";
import { loadCoins, addWatchAdCoins } from "@/lib/coins";

interface Props {
  onBack: () => void;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: value ? "#3498DB" : "rgba(255,255,255,0.12)",
        position: "relative",
        cursor: "pointer",
        transition: "background-color 0.25s ease",
        flexShrink: 0,
        border: value ? "1.5px solid rgba(52,152,219,0.6)" : "1.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: value ? 24 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: "#fff",
          transition: "left 0.25s ease",
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}

function Row({
  icon,
  label,
  sub,
  right,
}: {
  icon: string;
  label: string;
  sub?: string;
  right: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ fontSize: 22, marginRight: 14 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        color: "rgba(255,255,255,0.35)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 6,
        marginLeft: 4,
      }}
    >
      {text}
    </div>
  );
}

export default function SettingsScreen({ onBack }: Props) {
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [coins, setCoins] = useState<number>(loadCoins);
  const [adDone, setAdDone] = useState(false);

  function update(key: keyof GameSettings, val: boolean) {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveSettings(next);
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    resetProgress();
    setConfirmReset(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 2500);
  }

  function handleWatchAd() {
    const next = addWatchAdCoins();
    setCoins(next);
    setAdDone(true);
    setTimeout(() => setAdDone(false), 3000);
  }

  return (
    <div
      className="screen-enter"
      style={{
        minHeight: "100dvh",
        backgroundColor: "#0F0F1A",
        color: "#fff",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 18px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#3498DB",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            padding: "6px 0",
            marginRight: "auto",
          }}
        >
          ← Back
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          Settings
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 40px" }}>
        {/* Sound & Music */}
        <SectionLabel text="Sound & Music" />
        <Card>
          <Row
            icon="🔊"
            label="Sound Effects"
            sub="Taps, fills, and game sounds"
            right={<Toggle value={settings.sound} onChange={(v) => update("sound", v)} />}
          />
          <Row
            icon="🎵"
            label="Background Music"
            sub="Ambient game music"
            right={<Toggle value={settings.music} onChange={(v) => update("music", v)} />}
          />
          <Row
            icon="📳"
            label="Vibration"
            sub="Haptic feedback on mobile"
            right={<Toggle value={settings.vibration} onChange={(v) => update("vibration", v)} />}
          />
        </Card>

        {/* Accessibility */}
        <SectionLabel text="Accessibility" />
        <Card>
          <Row
            icon="👁"
            label="Color Blind Mode"
            sub="Adds shapes inside cells (circle, square, triangle…)"
            right={<Toggle value={settings.colorblind} onChange={(v) => update("colorblind", v)} />}
          />
        </Card>

        {/* Color Blind Shape Legend */}
        {settings.colorblind && (
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 12,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
              Shape Legend
            </div>
            {[
              { color: "#E74C3C", shape: "●  Circle", name: "Red" },
              { color: "#3498DB", shape: "■  Square", name: "Blue" },
              { color: "#2ECC71", shape: "▲  Triangle", name: "Green" },
              { color: "#F1C40F", shape: "◆  Diamond", name: "Yellow" },
              { color: "#9B59B6", shape: "★  Star", name: "Purple" },
              { color: "#E67E22", shape: "✕  Cross", name: "Orange" },
            ].map((item) => (
              <div key={item.color} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: item.color, marginRight: 10, flexShrink: 0 }} />
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, flex: 1 }}>{item.name}</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>{item.shape}</span>
              </div>
            ))}
          </div>
        )}

        {/* Shop */}
        <SectionLabel text="Shop" />
        <Card>
          <div style={{ padding: "16px 18px" }}>
            {/* Coin balance */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Your balance</span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "rgba(241,196,15,0.12)", border: "1px solid rgba(241,196,15,0.25)", borderRadius: "99px", padding: "4px 12px" }}>
                <span style={{ fontSize: 15 }}>🪙</span>
                <span style={{ color: "#F1C40F", fontSize: 16, fontWeight: 800 }}>{coins}</span>
              </div>
            </div>
            {/* Power-up cost reference */}
            <div style={{ marginBottom: "14px" }}>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>Power-up costs</div>
              {[
                { icon: "❄️", name: "Freeze", cost: 20, desc: "Stop timer 5s" },
                { icon: "💡", name: "Hint",   cost: 15, desc: "Flash best move" },
                { icon: "💣", name: "Bomb",   cost: 30, desc: "3×3 color blast" },
              ].map(pu => (
                <div key={pu.name} style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: 16, marginRight: 10 }}>{pu.icon}</span>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, flex: 1 }}>{pu.name}</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginRight: 8 }}>{pu.desc}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 12 }}>🪙</span>
                    <span style={{ color: "#F1C40F", fontSize: 13, fontWeight: 700 }}>{pu.cost}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Watch Ad button */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "14px" }}>
              {adDone ? (
                <div style={{ textAlign: "center", color: "#F1C40F", fontWeight: 700, fontSize: 15 }}>
                  ✓ +50 coins added! 🪙
                </div>
              ) : (
                <button
                  onClick={handleWatchAd}
                  style={{
                    width: "100%", padding: "13px",
                    borderRadius: 10, border: "1px solid rgba(241,196,15,0.35)",
                    background: "linear-gradient(135deg, rgba(241,196,15,0.15), rgba(230,126,34,0.15))",
                    color: "#F1C40F", fontSize: 15, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <span>🎬</span>
                  <span>Watch Ad for +50 🪙</span>
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Data */}
        <SectionLabel text="Data" />
        <Card>
          <div style={{ padding: "16px 18px" }}>
            {resetDone ? (
              <div style={{ textAlign: "center", color: "#2ECC71", fontWeight: 600, fontSize: 15 }}>
                ✓ Progress reset successfully
              </div>
            ) : confirmReset ? (
              <div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 14, textAlign: "center" }}>
                  This will delete all level stars, high scores, and unlock progress. Are you sure?
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setConfirmReset(false)}
                    style={{
                      flex: 1,
                      padding: "11px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    style={{
                      flex: 1,
                      padding: "11px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, #E74C3C, #C0392B)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Reset All
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleReset}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid rgba(231,76,60,0.35)",
                  background: "rgba(231,76,60,0.08)",
                  color: "#E74C3C",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🗑 Reset All Progress
              </button>
            )}
          </div>
        </Card>

        {/* Version */}
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 8 }}>
          Color Fill v1.0
        </div>
      </div>
    </div>
  );
}
