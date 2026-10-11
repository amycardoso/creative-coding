/**
 * Redemoinho
 *
 * Grande Sertão: Veredas #3.
 *
 * A field of short ink strokes, each one a streamline traced through a
 * vector field. The field is the sum of two things: a slow wind made of
 * noise, which combs the strokes into the grain of a dry pasture, and a
 * single vortex, a Rankine-like whirl that turns the vectors around a
 * moving centre and pulls them a little inwards. The strokes are seeded on
 * the same jittered grid every frame, so they do not travel; they only
 * change direction as the field under them changes.
 *
 * Through the loop the whirlwind is born out of nothing, crosses the
 * pasture, gathers every line around its eye and lets them go again. The
 * devil in the street, in the middle of the whirlwind: no stroke is drawn
 * as a whirlwind, it is only where the field turns.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new pasture
 */

const W = 800, H = 800;
const M = 50;
const LOOP_SECONDS = 16;
const SEEDS = 52;                // seeds per side of the jittered grid
const STEPS = 11;                // integration steps each way
const STEP = 2.6;                // px per step
const CORE = 70;                 // vortex core radius, px

const PAPER = [226, 202, 168];   // red-earth dust
const INK = [34, 24, 18];
const RED = [150, 52, 30];

let seed = 21;
let seeds = [];
let paperImg;

function makePaper() {
  paperImg = createGraphics(W, H);
  paperImg.pixelDensity(1);
  paperImg.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01 + 500, y * 0.01) * 14 + noise(x * 0.3, y * 0.3 + 500) * 8 + random(-6, 6);
    const i = 4 * (y * W + x);
    paperImg.pixels[i] = PAPER[0] + n; paperImg.pixels[i + 1] = PAPER[1] + n;
    paperImg.pixels[i + 2] = PAPER[2] + n; paperImg.pixels[i + 3] = 255;
  }
  paperImg.updatePixels();
}

function makeSeeds() {
  seeds = [];
  const cell = (W - 2 * M) / SEEDS;
  for (let j = 0; j < SEEDS; j++) for (let i = 0; i < SEEDS; i++) {
    seeds.push({
      x: M + (i + random(0.1, 0.9)) * cell,
      y: M + (j + random(0.1, 0.9)) * cell,
      w: random(0.9, 2.1),
      red: random() < 0.08,
    });
  }
}

// ---------- the field (pure, per phase) ----------
let vortex = { x: 0, y: 0, s: 0 };
let zW = 0;

function setPhase(t) {
  const a = TWO_PI * t;
  const k = Math.sin(Math.PI * t);
  vortex = {
    x: lerp(140, 660, t) + 40 * Math.sin(2 * a),
    y: 400 + 120 * Math.sin(a) * Math.cos(0.5 * a),
    s: k * k * k,                   // born from nothing, gone at the seam
  };
  zW = 0.35 * Math.cos(a);
}

function field(x, y) {
  const ang = noise(x * 0.0032, y * 0.0032, 4 + zW) * TWO_PI * 1.4 + 0.3;
  let vx = Math.cos(ang), vy = Math.sin(ang);
  const dx = x - vortex.x, dy = y - vortex.y, r = Math.hypot(dx, dy) + 1e-6;
  // tangential speed: solid-body inside the core, falling off outside
  const tang = (r < CORE ? r / CORE : Math.pow(CORE / r, 0.9)) * 7 * vortex.s;
  const pull = Math.min(1, CORE / r) * 1.6 * vortex.s;
  vx += (-dy / r) * tang - (dx / r) * pull;
  vy += (dx / r) * tang - (dy / r) * pull;
  const m = Math.hypot(vx, vy) + 1e-9;
  return [vx / m, vy / m];
}

// ---------- drawing ----------
function trace(sx, sy) {
  const fwd = [], back = [];
  let x = sx, y = sy;
  for (let k = 0; k < STEPS; k++) { const [vx, vy] = field(x, y); x += vx * STEP; y += vy * STEP; fwd.push([x, y]); }
  x = sx; y = sy;
  for (let k = 0; k < STEPS; k++) { const [vx, vy] = field(x, y); x -= vx * STEP; y -= vy * STEP; back.push([x, y]); }
  return back.reverse().concat([[sx, sy]], fwd);
}

function renderPhase(t) {
  setPhase(t);
  image(paperImg, 0, 0);
  strokeCap(ROUND);
  noFill();
  for (const s of seeds) {
    const pts = trace(s.x, s.y);
    const c = s.red ? RED : INK;
    // tapered: thick in the middle, thin at both ends, like a brush lifted
    for (let k = 0; k < pts.length - 1; k++) {
      const u = k / (pts.length - 2), taper = Math.sin(Math.PI * u);
      stroke(c[0], c[1], c[2], 230);
      strokeWeight(0.3 + s.w * taper);
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      if (x0 < M || y0 < M || x1 > W - M || y1 > H - M || x1 < M || y1 < M || x0 > W - M || y0 > H - M) continue;
      line(x0, y0, x1, y1);
    }
  }

  noFill();
  stroke(INK[0], INK[1], INK[2]);
  strokeWeight(3);
  rect(M, M, W - 2 * M, H - 2 * M);
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function build() {
  randomSeed(seed); noiseSeed(seed);
  makePaper();
  makeSeeds();
}

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  build();

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
  if (key === 's' || key === 'S') saveCanvas('redemoinho', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    build();
  }
}
