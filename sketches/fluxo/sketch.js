/**
 * Fluxo
 *
 * Inspired by Margaret Atwood's The Handmaid's Tale: a society where everyone
 * is carried by the same current, and the few who walk against it.
 *
 * Thousands of red ink lines are traced through a single flow field that
 * pushes almost everything to the right. The current itself never changes.
 * One dark line walks the other way, right to left, and the field bends
 * around it: the lines it passes are pushed apart and open a wake that
 * closes again once it has gone. Plotter-style ink on paper.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new field and a new path
 */

const W = 800, H = 800;
const PAPER = [238, 230, 212];
const N_LINES = 2400;
const STEPS = 95;
const STEP_LEN = 3;
const TRAIL = 520;         // length of the dissenter's wake, in px
const WAKE = 46;           // how far the wake pushes lines aside

const LOOP_SECONDS = 12;

let seed = 5;
let starts = [];           // { x, y, a, w } fixed start points of the ink lines
let grain;
let frame = 0;

function buildField() {
  randomSeed(seed); noiseSeed(seed);
  starts = [];
  for (let n = 0; n < N_LINES; n++) {
    starts.push({ x: random(-260, 780), y: random(-30, 830), a: random(60, 150), w: random(0.5, 1.1) });
  }
  grain = createGraphics(W, H);
  grain.pixelDensity(1);
  grain.loadPixels();
  for (let i = 0; i < grain.pixels.length; i += 4) {
    const g = random(-9, 7);
    grain.pixels[i] = g > 0 ? 255 : 0; grain.pixels[i + 1] = grain.pixels[i]; grain.pixels[i + 2] = grain.pixels[i];
    grain.pixels[i + 3] = Math.abs(g) * 2.2;
  }
  grain.updatePixels();
}

// The dissenter's path: a gently wandering line across the sheet.
function rebelY(x) {
  return 430 + (noise(x * 0.0018, 40) - 0.5) * 320;
}

function renderPhase(t) {
  background(PAPER);
  // the dissenter enters at the right edge and leaves at the left, trail and all
  const head = lerp(W + 40, -TRAIL - 40, t);
  const trail = [];
  for (let s = 0; s <= TRAIL; s += 12) {
    const x = head + s;
    if (x > -WAKE && x < W + WAKE) trail.push({ x, y: rebelY(x), k: 1 - s / TRAIL });
  }

  const field = (x, y) => {
    let a = (noise(x * 0.0025, y * 0.0025) - 0.5) * 0.9;
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i], dx = x - p.x, dy = y - p.y;
      const r = WAKE * (0.4 + 0.6 * p.k);
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) { const d = Math.sqrt(d2); a += (dy < 0 ? -1 : 1) * (1 - d / r) * (1 - d / r) * 1.3 * p.k; }
    }
    return a;
  };

  noFill();
  for (const s of starts) {
    let px = s.x, py = s.y;
    stroke(168, 24, 30, s.a); strokeWeight(s.w);
    beginShape();
    for (let k = 0; k < STEPS; k++) {
      vertex(px, py);
      const a = field(px, py);
      px += Math.cos(a) * STEP_LEN; py += Math.sin(a) * STEP_LEN;
      if (px > W + 10) break;
    }
    endShape();
  }

  if (trail.length) {
    stroke(30, 26, 40); strokeWeight(2.4);
    beginShape();
    for (let x = Math.max(head, -10); x < Math.min(head + TRAIL, W + 10); x += 3) vertex(x, rebelY(x));
    endShape();
  }
  image(grain, 0, 0);
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  buildField();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    noLoop();
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  const p = new URLSearchParams(window.location.search);
  if (p.has('f') && p.has('n')) {
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  renderPhase(frame / LOOP_FRAMES);
  if (isLooping()) frame = (frame + 1) % LOOP_FRAMES;
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('fluxo', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    buildField();
  }
}
