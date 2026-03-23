export default function BannerAd() {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: 52, zIndex: 100,
      backgroundColor: "rgba(10,10,20,0.97)",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        position: "absolute", top: 4, right: 10,
        color: "rgba(255,255,255,0.18)", fontSize: 9,
        fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      }}>
        Ad
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px dashed rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "7px 22px",
        color: "rgba(255,255,255,0.2)", fontSize: 12,
      }}>
        <span>📺</span>
        <span>Banner Ad · AdMob SDK goes here</span>
      </div>
    </div>
  );
}
