let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return ctx;
}

function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem("cf_settings_v1");
    if (!raw) return true;
    return JSON.parse(raw).sound !== false;
  } catch { return true; }
}

export type SoundType = "tap" | "fill" | "win" | "gameover" | "coin" | "powerup";

export function playSound(type: SoundType): void {
  if (!isSoundEnabled()) return;
  try {
    const ac = getCtx();
    if (ac.state === "suspended") ac.resume();
    switch (type) {
      case "tap":      playTap(ac);      break;
      case "fill":     playFill(ac);     break;
      case "win":      playWin(ac);      break;
      case "gameover": playGameOver(ac); break;
      case "coin":     playCoin(ac);     break;
      case "powerup":  playPowerUp(ac);  break;
    }
  } catch {}
}

function playTap(ac: AudioContext) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(900, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.05);
  gain.gain.setValueAtTime(0.14, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
  osc.start(); osc.stop(ac.currentTime + 0.05);
}

function playFill(ac: AudioContext) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(280, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(140, ac.currentTime + 0.2);
  gain.gain.setValueAtTime(0.07, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
  osc.start(); osc.stop(ac.currentTime + 0.2);
}

function playWin(ac: AudioContext) {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = "sine";
    const t = ac.currentTime + i * 0.11;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.start(t); osc.stop(t + 0.22);
  });
}

function playGameOver(ac: AudioContext) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(380, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 0.4);
  gain.gain.setValueAtTime(0.09, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
  osc.start(); osc.stop(ac.currentTime + 0.4);
}

function playCoin(ac: AudioContext) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.15);
  gain.gain.setValueAtTime(0.16, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
  osc.start(); osc.stop(ac.currentTime + 0.15);
}

function playPowerUp(ac: AudioContext) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(600, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1400, ac.currentTime + 0.2);
  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
  osc.start(); osc.stop(ac.currentTime + 0.2);
}
