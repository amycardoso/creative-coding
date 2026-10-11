/**
 * Maioria
 *
 * Inspired by Margaret Atwood's The Handmaid's Tale: how conformity spreads
 * with no one giving the order, and what a few who refuse can hold open.
 *
 * A majority-rule cellular automaton. Every cell looks at its eight
 * neighbours and becomes whatever most of them are, so red spreads on its
 * own, cell by cell. A few cells never convert, and each one weighs on its
 * neighbours: around them, small white islands survive. When the pattern has
 * settled, the pressure lifts in a wave from those cells outward and every
 * cell returns to how it started, and the vote runs again.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new population
 */

const W = 800, H = 800;
const N = 100, S = W / N;
const PAPER = [238, 230, 212];
const INK = [170, 26, 32];
const STEPS = 40;

const LOOP_SECONDS = 14;
const VOTE_END = 0.7;      // the automaton runs until here; then a hold; then the release
const RELEASE = [0.78, 0.98];

let seed = 29;
let states = [];           // Uint8Array per step
let fixed;                 // cells that never convert
let release;               // when each cell is released (0..1 over RELEASE)
let jitter;                // per-cell size/opacity variation
let paper;
let frame = 0;

function runVote() {
  randomSeed(seed); noiseSeed(seed);
  let g = new Uint8Array(N * N);
  fixed = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) { g[i] = random() < 0.52 ? 1 : 0; fixed[i] = random() < 0.006 ? 1 : 0; }
  for (let i = 0; i < N * N; i++) if (fixed[i]) g[i] = 0;
  states = [g.slice()];
  for (let step = 0; step < STEPS; step++) {
    const n2 = g.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (fixed[i]) continue;
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = ((y + dy + N) % N) * N + (x + dx + N) % N;
        s += fixed[j] ? -1.5 : g[j];      // a cell that never converts weighs on its neighbours
      }
      n2[i] = s > 4.5 ? 1 : (s < 4 ? 0 : g[i]);
    }
    g = n2;
    states.push(g.slice());
  }
  // release wave: distance to the nearest fixed cell
  const pts = [];
  for (let i = 0; i < N * N; i++) if (fixed[i]) pts.push([i % N, Math.floor(i / N)]);
  release = new Float32Array(N * N);
  jitter = new Float32Array(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let d = Infinity;
    for (const [px, py] of pts) d = Math.min(d, Math.hypot(x - px, y - py));
    release[y * N + x] = Math.min(1, d / 22 + random(0, 0.08));
    jitter[3 * (y * N + x)] = random(0.82, 0.98);
    jitter[3 * (y * N + x) + 1] = random(190, 240);
    jitter[3 * (y * N + x) + 2] = random(-0.4, 0.4);
  }
  paper = createGraphics(W, H);
  paper.pixelDensity(1);
  paper.background(PAPER);
  paper.loadPixels();
  for (let i = 0; i < paper.pixels.length; i += 4) {
    const v = random(-8, 6); paper.pixels[i] += v; paper.pixels[i + 1] += v; paper.pixels[i + 2] += v;
  }
  paper.updatePixels();
}

const ease = (t) => t * t * (3 - 2 * t);

function renderPhase(t) {
  image(paper, 0, 0);
  // continuous step index during the vote; each cell eases between consecutive states
  const f = t < VOTE_END ? (t / VOTE_END) * STEPS : STEPS;
  const a = Math.floor(f), b = Math.min(STEPS, a + 1), mix = ease(f - a);
  const sa = states[a], sb = states[b], s0 = states[0];
  const rt = (t - RELEASE[0]) / (RELEASE[1] - RELEASE[0]);
  noStroke();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const cx = x * S + S / 2 + jitter[3 * i + 2], cy = y * S + S / 2 + jitter[3 * i + 2];
    if (fixed[i]) { fill(25, 22, 30); circle(cx, cy, S * 0.55); continue; }
    let v = sa[i] * (1 - mix) + sb[i] * mix;
    if (rt > 0) {
      const k = ease(Math.min(1, Math.max(0, (rt - release[i] * 0.8) / 0.2)));
      v = v * (1 - k) + s0[i] * k;
    }
    // empty cell: a faint red ring; filled cell: a solid dot; in between, the dot grows from the ring
    stroke(INK[0], INK[1], INK[2], 90 * (1 - v)); strokeWeight(0.8); noFill();
    if (v < 0.98) circle(cx, cy, S * 0.5);
    noStroke();
    if (v > 0.02) {
      fill(INK[0], INK[1], INK[2], jitter[3 * i + 1]);
      circle(cx, cy, S * jitter[3 * i] * (0.5 + 0.5 * v) * Math.min(1, v * 3));
    }
  }
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  runVote();

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
  if (key === 's' || key === 'S') saveCanvas('maioria', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    runVote();
  }
}
