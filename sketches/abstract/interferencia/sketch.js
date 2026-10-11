// Interferência — moiré wave interference from nothing but straight lines.
// A field of slowly hue-cycling rainbow stripes shines through two black
// picket-fence gratings that tilt and drift against each other. Every mark
// on the canvas is a straight line; the waves, ripples and rolling bands
// are pure interference — the pattern lives only in the space BETWEEN the
// gratings, the way real light beats between two fences.
//
// All motion is sinusoidal with an integer number of cycles per loop (or a
// whole number of grating spacings of drift), so the loop is seamless by
// construction. Everything is frame-indexed. Pure math stays p5-free for
// bare-eval Node tests.

// ---------- timeline ----------
const TAU = Math.PI * 2;
const FPS = 60;
const LOOP_FRAMES = 720;             // 12 s

// ---------- gratings (pure, deterministic) ----------
// angle    : base orientation of the line normals
// wobble   : sinusoidal tilt amplitude (rad) — small angles, big moiré
// wobCyc   : whole tilt cycles per loop
// spacing  : base distance between line centers (px)
// breathe  : relative spacing modulation amplitude
// brCyc    : whole breathing cycles per loop
// driftSp  : whole seam-spacings of lateral drift per loop (integer)

// The light: wide rainbow stripes, geometry almost still, hue flowing.
const BASE = {
  angle: -0.62, wobble: 0.08, wobCyc: 1, phase0: 1.0,
  spacing: 66, breathe: 0.07, brCyc: 1, driftSp: 0,
};
const HUE_STEP = 0.145;              // hue advance per stripe
const HUE_CYCLES = 1;                // whole hue revolutions per loop

// The fences: black bars covering ~48% of each spacing. Their relative
// angle oscillates through zero, so the beat pattern swings from huge
// rolling bands to a tight woven mesh and back.
const FENCES = [
  {
    angle: 0.42, wobble: 0.050, wobCyc: 1, phase0: 0.0,
    spacing: 15.0, breathe: 0.045, brCyc: 2, driftSp: 2,
  },
  {
    angle: 0.48, wobble: 0.070, wobCyc: 1, phase0: 2.3,
    spacing: 17.2, breathe: 0.055, brCyc: 1, driftSp: -3,
  },
];
const FENCE_DUTY = 0.48;             // black bar width / spacing

// Spacing at the loop seam (t = 0): drift must advance whole multiples of
// THIS spacing per loop, or the line set won't line up when the loop wraps.
function seamSpacing(g) {
  return g.spacing * (1 + g.breathe * Math.sin(g.phase0 * 1.7));
}

// State of grating g at frame f: orientation, spacing, lateral offset.
function gratingState(g, f) {
  const t = f / LOOP_FRAMES;
  const angle = g.angle + g.wobble * Math.sin(TAU * (g.wobCyc * t) + g.phase0);
  const spacing = g.spacing * (1 + g.breathe * Math.sin(TAU * (g.brCyc * t) + g.phase0 * 1.7));
  const offset = g.driftSp * seamSpacing(g) * t;
  return { angle, spacing, offset };
}

// Indexed line offsets (signed distances from center along the normal)
// covering [-reach, reach]. Generated from the offset range directly, so
// drift and breathing can never leave a gap at the rim.
function lineOffsets(state, reach) {
  const kMin = Math.ceil((-reach - state.offset) / state.spacing);
  const kMax = Math.floor((reach - state.offset) / state.spacing);
  const lines = [];
  for (let k = kMin; k <= kMax; k++) lines.push({ k, o: state.offset + k * state.spacing });
  return lines;
}

function frac(x) {
  return ((x % 1) + 1) % 1;
}

// Stripe k's hue at frame f. Hue advances HUE_CYCLES whole turns per loop,
// so the seam is exact.
function stripeHue(k, f) {
  return frac(k * HUE_STEP + HUE_CYCLES * (f / LOOP_FRAMES));
}

// Saturated spectral color, pure math (h in [0,1) -> [r,g,b] 0..255).
function hueRgb(h) {
  const v = (n) => {
    const x = frac(h + n / 3) * 6;
    return Math.max(0, Math.min(1, 2 - Math.abs(x - 3))) * 255;
  };
  return [v(0), v(1), v(2)];
}

// ---------- rendering ----------
const WIDTH = 800, HEIGHT = 800;
const BG = [4, 4, 8];
const R_CLIP = 352;                  // interference field radius

let frame = 0;

function drawGratingLines(st, reach, halfLen, weight, colorFn) {
  const nx = Math.cos(st.angle), ny = Math.sin(st.angle);   // normal
  const dx = -ny, dy = nx;                                  // line direction
  strokeWeight(weight);
  for (const { k, o } of lineOffsets(st, reach)) {
    const c = colorFn(k);
    stroke(c[0], c[1], c[2]);
    const cx = nx * o, cy = ny * o;
    line(cx - dx * halfLen, cy - dy * halfLen, cx + dx * halfLen, cy + dy * halfLen);
  }
}

function renderFrame(f) {
  background(BG[0], BG[1], BG[2]);
  push();
  translate(WIDTH / 2, HEIGHT / 2);
  strokeCap(PROJECT);

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.arc(0, 0, R_CLIP, 0, TAU);
  drawingContext.clip();

  const halfLen = R_CLIP + 8;

  // the light: contiguous rainbow stripes
  const bs = gratingState(BASE, f);
  drawGratingLines(bs, R_CLIP + bs.spacing, halfLen, bs.spacing + 1.5,
    (k) => hueRgb(stripeHue(k, f)));

  // the fences: black bars the light must squeeze through
  for (const g of FENCES) {
    const st = gratingState(g, f);
    drawGratingLines(st, R_CLIP + 2, halfLen, st.spacing * FENCE_DUTY,
      () => BG);
  }

  drawingContext.restore();

  // thin rim to hold the circle against the black
  noFill();
  stroke(120, 120, 140, 90);
  strokeWeight(1.5);
  circle(0, 0, R_CLIP * 2);

  pop();
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
  if (key === "s" || key === "S") saveCanvas("interferencia", "png");
}
