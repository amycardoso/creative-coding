// Pulsar — PSR B1919+21, the first pulsar ever found (Jocelyn Bell Burnell,
// Cambridge, 1967), spinning at its real period of 1.3373 s. Successive radio
// pulses stack into the waterfall made famous by the Unknown Pleasures cover,
// but alive: each new line is one rotation of the star, drawn as the beam
// sweeps past, and the sub-pulses march steadily across the window pulse
// after pulse — the "drifting subpulse" phenomenon B1919+21 really exhibits.
//
// Everything is frame-indexed and periodic modulo M_PULSES, so the loop is
// seamless by construction. Pure math stays p5-free for bare-eval Node tests.

// ---------- pulse-train math (pure, deterministic) ----------
const PERIOD_S = 1.3373;        // PSR B1919+21 rotation period, seconds
const M_PULSES = 60;            // distinct pulses per loop (cycle length)

const SUBPULSE_SEP = 0.09;      // comb spacing between sub-pulses (window units)
const SUBPULSE_DRIFT = 0.021;   // phase advance per pulse -> P3 ≈ 4.3 pulses
const SUBPULSE_SIGMA = 0.02;    // sub-pulse width
const SUBPULSE_FLOOR = 0.3;     // comb never fully extinguishes the envelope

function wrapPulse(i) {
  return ((i % M_PULSES) + M_PULSES) % M_PULSES;
}

function hash01(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 1, 1597334677);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function gauss(u, c, s) {
  const d = u - c;
  return Math.exp(-(d * d) / (2 * s * s));
}

// Integrated (average) profile: main peak with a trailing shoulder.
function envelopeRaw(u) {
  return gauss(u, 0.47, 0.055) + 0.6 * gauss(u, 0.585, 0.045);
}
const ENV_MAX = (() => {
  let m = 0;
  for (let u = 0; u <= 1; u += 0.001) m = Math.max(m, envelopeRaw(u));
  return m;
})();
function envelope(u) {
  return envelopeRaw(u) / ENV_MAX;
}

// Drifting sub-pulse comb: teeth every SUBPULSE_SEP, marching to earlier
// phase by SUBPULSE_DRIFT each pulse. Periodic mod M_PULSES exactly.
function subpulseMod(i, u) {
  const m = wrapPulse(i);
  let ph = (u + m * SUBPULSE_DRIFT) % SUBPULSE_SEP;
  if (ph > SUBPULSE_SEP / 2) ph -= SUBPULSE_SEP;
  const comb = Math.exp(-(ph * ph) / (2 * SUBPULSE_SIGMA * SUBPULSE_SIGMA));
  return SUBPULSE_FLOOR + (1 - SUBPULSE_FLOOR) * comb;
}

// Pulse-to-pulse intensity: pulsars flicker strongly between rotations.
function pulseAmp(i) {
  const r = hash01(wrapPulse(i), 0);
  return 0.4 + 0.6 * Math.pow(r, 0.8);
}

// Smooth per-pulse baseline wiggle (receiver noise).
function baseNoise(i, u) {
  const m = wrapPulse(i);
  const x = u * 24;
  const x0 = Math.floor(x);
  const t = x - x0;
  const s = t * t * (3 - 2 * t);
  const n0 = hash01(m, 100 + x0) * 2 - 1;
  const n1 = hash01(m, 101 + x0) * 2 - 1;
  return (n0 + (n1 - n0) * s) * 0.02;
}

function edgeTaper(u) {
  const a = Math.min(1, Math.max(0, u / 0.03));
  const b = Math.min(1, Math.max(0, (1 - u) / 0.03));
  return a * a * (3 - 2 * a) * (b * b * (3 - 2 * b));
}

// Intensity of pulse i at window phase u ∈ [0,1]. Range ≈ [-0.02, 1].
function pulseValue(i, u) {
  const v =
    pulseAmp(i) * envelope(u) * subpulseMod(i, u) + baseNoise(i, u);
  return Math.min(1, v * edgeTaper(u));
}

const SAMPLES = 200;
function pulseProfile(i) {
  const p = new Array(SAMPLES + 1);
  for (let k = 0; k <= SAMPLES; k++) p[k] = pulseValue(i, k / SAMPLES);
  return p;
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 60;
const FRAMES_PER_PULSE = Math.round(PERIOD_S * FPS); // ≈ real time at 60 fps
const LOOP_FRAMES = M_PULSES * FRAMES_PER_PULSE;

// ---------- rendering ----------
const WIDTH = 800, HEIGHT = 800;
const V_LINES = 60;                     // stacked pulses on screen
const BG = [5, 3, 12];                  // violet-black
const COL_LOW  = [64, 34, 120];         // dim indigo baseline
const COL_MID  = [216, 62, 190];        // electric magenta
const COL_HIGH = [178, 246, 255];       // ionized cyan-white
const PLOT_W = 0.56 * WIDTH;
const X0 = (WIDTH - PLOT_W) / 2;
const Y_BOT = 690, Y_TOP = 120;
const SPACING = (Y_BOT - Y_TOP) / (V_LINES + 1);
const AMP_H = 105;                      // peak height in px

let frame = 0;

function mix(a, b, t) {
  return a + (b - a) * t;
}

// Two-stop palette by intensity, dimmed with depth (0 = front, 1 = back).
function lineColor(v, depth) {
  const bright = mix(1, 0.3, Math.pow(depth, 0.9));
  let r, g, bch;
  if (v < 0.45) {
    const t = v / 0.45;
    r = mix(COL_LOW[0], COL_MID[0], t);
    g = mix(COL_LOW[1], COL_MID[1], t);
    bch = mix(COL_LOW[2], COL_MID[2], t);
  } else {
    const t = Math.min(1, (v - 0.45) / 0.45);
    r = mix(COL_MID[0], COL_HIGH[0], t);
    g = mix(COL_MID[1], COL_HIGH[1], t);
    bch = mix(COL_MID[2], COL_HIGH[2], t);
  }
  return [r * bright, g * bright, bch * bright];
}

// Draw one stacked pulse line: occluding fill, then per-segment stroke.
// upTo ∈ (0,1] limits how much of the line exists (the pen-drawn newest line).
function drawPulseLine(pi, yBase, depth, alpha, upTo) {
  const prof = pulseProfile(pi);
  const kMax = Math.max(1, Math.floor(upTo * SAMPLES));

  // hidden-line removal: opaque background under the curve
  noStroke();
  fill(BG[0], BG[1], BG[2]);
  beginShape();
  vertex(X0, yBase + 2);
  for (let k = 0; k <= kMax; k++) {
    vertex(X0 + (k / SAMPLES) * PLOT_W, yBase - prof[k] * AMP_H);
  }
  vertex(X0 + (kMax / SAMPLES) * PLOT_W, yBase + 2);
  endShape(CLOSE);

  noFill();
  for (let k = 1; k <= kMax; k++) {
    const v = Math.max(0, prof[k]);
    const c = lineColor(v, depth);
    stroke(c[0], c[1], c[2], alpha * 255);
    strokeWeight(mix(1.7, 0.9, depth) + v * 0.9);
    line(
      X0 + ((k - 1) / SAMPLES) * PLOT_W, yBase - prof[k - 1] * AMP_H,
      X0 + (k / SAMPLES) * PLOT_W, yBase - prof[k] * AMP_H
    );
  }
}

function renderFrame(f) {
  background(BG[0], BG[1], BG[2]);

  const tp = f / FRAMES_PER_PULSE;      // continuous pulse count
  const curPulse = Math.floor(tp);
  const frac = tp - curPulse;

  // back (top, oldest) to front (bottom, newest); wrapPulse makes negative
  // indices valid, so frame 0 and frame LOOP_FRAMES render identically.
  for (let rb = V_LINES; rb >= 0; rb--) {
    const pi = curPulse - rb;
    const yBase = Y_BOT - (rb + frac) * SPACING;
    const depth = (rb + frac) / (V_LINES + 1);
    const alpha = rb === V_LINES ? 1 - frac : 1;
    const upTo = rb === 0 ? Math.max(0.005, frac) : 1;
    drawPulseLine(pi, yBase, depth, alpha, upTo);
  }

  // the beam's pen: a glowing head writing the newest pulse
  const penU = Math.max(0.005, frac);
  const penV = pulseValue(curPulse, penU);
  const px = X0 + penU * PLOT_W;
  const py = Y_BOT - frac * SPACING - penV * AMP_H;
  const heat = 0.35 + 0.65 * penV;
  noStroke();
  fill(COL_HIGH[0], COL_HIGH[1], COL_HIGH[2], 26 * heat);
  circle(px, py, 18 + 26 * penV);
  fill(COL_HIGH[0], COL_HIGH[1], COL_HIGH[2], 90 * heat);
  circle(px, py, 6 + 8 * penV);
  fill(255, 255, 255, 230 * heat);
  circle(px, py, 2.5);
}

function setup() {
  const c = createCanvas(WIDTH, HEIGHT);
  c.parent("canvas-container");
  pixelDensity(1);

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = (i, n) => {
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  const p = new URLSearchParams(window.location.search);
  if (p.has("f") && p.has("n")) {
    noLoop();
    window.__captureFrame(parseInt(p.get("f"), 10), Math.max(1, parseInt(p.get("n"), 10)));
  }
}

function draw() {
  renderFrame(frame);
  frame = (frame + 1) % LOOP_FRAMES;
}

function keyPressed() {
  if (key === "s" || key === "S") saveCanvas("pulsar", "png");
}
