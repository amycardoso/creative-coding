/**
 * Metronomes
 *
 * Seventy metronomes stand on one loose board, each ticking at its own
 * tempo. Through the board they nudge each other (the Kuramoto model:
 * every phase is pulled toward the mean phase, in proportion to how
 * tightly the board couples them and how in step they already are).
 *
 * Each metronome is a thread of ink written by a pen that sweeps down the
 * page like a heart monitor, overwriting the previous pass: the thread
 * swings left and right with its pendulum. The coupling breathes
 * over the loop. Loose, the threads tangle and cross. Tight, the crowd
 * falls into one shared pulse and the threads comb themselves parallel,
 * then the board loosens and they drift apart again.
 *
 * ?seed=N fixes the crowd of tempos (the GIF uses seed 5); otherwise every
 * visit sets up a new board.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const M = 70;                    // metronomes
const DT = 0.04;                 // simulation step (one sample = one step)
const PERIOD = 4200;             // samples in one coupling cycle (= the loop)
const WINDOW = 1050;             // samples per page; PERIOD is a whole number of pages
const GAP_ROWS = 24;             // blank samples just ahead of the pen
const BLEND = 600;               // samples used to stitch the loop seam
const K_MAX = 2.0;
const SPREAD = 0.1;              // spread of natural tempos
const SWING = 13;                // px a pendulum swings either side
const LOOP_SECONDS = 16.8;
const PAPER = [238, 232, 220];
const INK = [28, 30, 44], RED = [180, 50, 40];

let theta, ground;               // theta[i][k]: displayed phase, periodic in k

// coupling strength over the cycle: loose at the seam, tight in the middle
const coupling = (k) => K_MAX * (0.5 - 0.5 * Math.cos(TWO_PI * k / PERIOD));

function simulate() {
  const w = [], ph = [];
  for (let i = 0; i < M; i++) { w.push(TWO_PI * 0.42 * (1 + randomGaussian() * SPREAD)); ph.push(random(TWO_PI)); }
  const total = PERIOD + BLEND;
  const raw = Array.from({ length: M }, () => new Float64Array(total));
  for (let k = 0; k < total; k++) {
    let cr = 0, ci = 0;
    for (let i = 0; i < M; i++) { cr += Math.cos(ph[i]); ci += Math.sin(ph[i]); }
    cr /= M; ci /= M;
    const R = Math.hypot(cr, ci), psi = Math.atan2(ci, cr), K = coupling(k % PERIOD);
    for (let i = 0; i < M; i++) { raw[i][k] = ph[i]; ph[i] += DT * (w[i] + K * R * Math.sin(psi - ph[i])); }
  }
  // Stitch: over the first BLEND samples ease from the run's continuation
  // (k + PERIOD, wrapped by whole turns) into the run itself, so the phase
  // track is periodic in k with matching value and slope at the seam.
  theta = raw.map((r) => {
    const out = new Float64Array(PERIOD);
    const turns = Math.round((r[PERIOD] - r[0]) / TWO_PI) * TWO_PI;
    for (let k = 0; k < PERIOD; k++) {
      if (k >= BLEND) { out[k] = r[k]; continue; }
      const u = k / BLEND, s = u * u * (3 - 2 * u);
      out[k] = (1 - s) * (r[k + PERIOD] - turns) + s * r[k];
    }
    return out;
  });
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 12;
    const i = 4 * (y * W + x);
    ground.pixels[i] = PAPER[0] + n; ground.pixels[i + 1] = PAPER[1] + n; ground.pixels[i + 2] = PAPER[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

function renderPhase(t) {
  image(ground, 0, 0);
  const now = Math.floor(t * PERIOD);              // newest sample
  const head = now % WINDOW;                       // where the pen is on the page
  const top = 30, bottom = H - 30, step = 2;
  const yOf = (s) => top + (s / WINDOW) * (bottom - top);
  // sample shown at page row s: above the pen this sweep, below it the last one
  const sampleAt = (s) => ((s <= head ? now - head + s : now - head + s - WINDOW) % PERIOD + PERIOD) % PERIOD;
  const segments = [[0, head], [head + GAP_ROWS, WINDOW]];
  noFill();
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < M; i++) {
    const x0 = 30 + (i + 0.5) * ((W - 60) / M);
    const c = i % 17 === 8 ? RED : INK;
    stroke(c[0], c[1], c[2], pass ? 210 : 35); strokeWeight(pass ? 1.0 : 3);
    for (const [a, b] of segments) {
      if (b - a < 2) continue;
      beginShape();
      for (let s = a; s <= b; s += step) vertex(x0 + SWING * Math.sin(theta[i][sampleAt(s)]), yOf(s));
      endShape();
    }
  }
  // the pens: one bead per metronome at the writing line
  noStroke();
  for (let i = 0; i < M; i++) {
    const x0 = 30 + (i + 0.5) * ((W - 60) / M), c = i % 17 === 8 ? RED : INK;
    fill(...c);
    circle(x0 + SWING * Math.sin(theta[i][now % PERIOD]), yOf(head), 4.5);
  }
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  const p = new URLSearchParams(window.location.search);
  const seed = p.has('seed') ? parseInt(p.get('seed'), 10) : Math.floor(Math.random() * 1e6);
  randomSeed(seed); noiseSeed(seed);
  buildGround();
  simulate();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    noLoop();
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  if (p.has('f') && p.has('n')) {
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  renderPhase(frame / LOOP_FRAMES);
  if (isLooping()) frame = (frame + 1) % LOOP_FRAMES;
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('metronomes', 'png');
}
