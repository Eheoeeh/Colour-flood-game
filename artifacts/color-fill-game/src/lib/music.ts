// Ambient background music — Web Audio API only, no audio files
// Defers AudioContext creation until the first user gesture (required on mobile/Android)

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let playing = false;
let stopRequest = false;
let loopTimeout: ReturnType<typeof setTimeout> | null = null;

// Mobile gesture guard
let userInteracted = false;
let pendingStart = false;

// C major pentatonic ambient melody — [freq Hz, beats]
const MELODY: [number, number][] = [
  [392.00, 2],   // G4
  [523.25, 1],   // C5
  [440.00, 1],   // A4
  [329.63, 2],   // E4
  [261.63, 2],   // C4
  [392.00, 1],   // G4
  [440.00, 1],   // A4
  [523.25, 2],   // C5
  [440.00, 1],   // A4
  [392.00, 1],   // G4
  [329.63, 2],   // E4
  [261.63, 4],   // C4 (held)
];

// Bass drone: root + fifth
const BASS: [number, number][] = [
  [130.81, 4],   // C3
  [196.00, 4],   // G3
  [130.81, 4],   // C3
  [146.83, 4],   // D3
];

const BEAT        = 0.52;   // seconds per beat
const TARGET_GAIN = 0.08;
const FADE_IN_S   = 2.0;
const FADE_OUT_S  = 1.5;

// ── Audio context ─────────────────────────────────────────────────────────────
function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
  }
  return ctx;
}

// ── User gesture gate ─────────────────────────────────────────────────────────
function setupInteractionHandler(): void {
  if (userInteracted) return;
  const handler = () => {
    userInteracted = true;
    // Also resume any suspended context created before interaction
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    if (pendingStart) {
      pendingStart = false;
      _startNow();
    }
  };
  document.addEventListener("touchstart", handler, { once: true, passive: true });
  document.addEventListener("click",      handler, { once: true });
  document.addEventListener("keydown",    handler, { once: true });
}

// ── Scheduling ────────────────────────────────────────────────────────────────
function scheduleMelody(ac: AudioContext, gain: GainNode, startT: number): number {
  let t = startT;
  for (const [freq, beats] of MELODY) {
    if (stopRequest) break;
    const dur = beats * BEAT;
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(gain);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.04);
    g.gain.setValueAtTime(0.55, t + dur - 0.08);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t); osc.stop(t + dur + 0.01);
    t += dur;
  }
  return t;
}

function scheduleBass(ac: AudioContext, gain: GainNode, startT: number): void {
  let t = startT;
  for (const [freq, beats] of BASS) {
    if (stopRequest) break;
    const dur = beats * BEAT;
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(gain);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.12);
    g.gain.setValueAtTime(0.35, t + dur - 0.2);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t); osc.stop(t + dur + 0.01);
    t += dur;
  }
}

function runLoop(ac: AudioContext, gain: GainNode, startT: number): void {
  if (stopRequest) return;
  const loopEnd = scheduleMelody(ac, gain, startT);
  scheduleBass(ac, gain, startT);
  const msUntilNext = Math.max(0, (loopEnd - ac.currentTime - 0.05) * 1000);
  loopTimeout = setTimeout(() => {
    if (!stopRequest) runLoop(ac, gain, loopEnd);
  }, msUntilNext);
}

// ── Internal start (requires user gesture already happened) ───────────────────
function _startNow(): void {
  if (playing) return;
  playing = true;
  stopRequest = false;
  try {
    const ac = getCtx();
    if (ac.state === "suspended") ac.resume().catch(() => {});
    masterGain = ac.createGain();
    masterGain.connect(ac.destination);
    masterGain.gain.setValueAtTime(0, ac.currentTime);
    masterGain.gain.linearRampToValueAtTime(TARGET_GAIN, ac.currentTime + FADE_IN_S);
    runLoop(ac, masterGain, ac.currentTime + 0.1);
    console.log("[Music] Started ambient loop.");
  } catch (e) {
    playing = false;
    console.warn("[Music] Could not start:", e);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function startMusic(): void {
  if (playing) return;
  // Always register the interaction handler so context resumes on first tap
  setupInteractionHandler();
  if (!userInteracted) {
    pendingStart = true;
    return; // will auto-start on first tap
  }
  _startNow();
}

export function stopMusic(smooth = true): void {
  stopRequest = true;
  playing = false;
  pendingStart = false;
  if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
  if (masterGain && ctx) {
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    if (smooth) {
      masterGain.gain.linearRampToValueAtTime(0, t + FADE_OUT_S);
    } else {
      masterGain.gain.setValueAtTime(0, t);
    }
    masterGain = null;
  }
}

export function isMusicPlaying(): boolean {
  return playing;
}
