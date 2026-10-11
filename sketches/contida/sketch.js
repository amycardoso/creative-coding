/**
 * Contida
 *
 * Inspired by Margaret Atwood's The Handmaid's Tale: life, fertility and
 * growth, held inside walls built to contain them.
 *
 * A Gray-Scott reaction-diffusion system (the chemistry behind coral and
 * fingerprints) grows from a few scattered seeds inside a rigid grid of
 * walls. The walls stop diffusion, so each colony fills its own cell, but the
 * grid has cracks, and wherever there is a crack the pattern finds it and
 * gets through. At the end of the loop the ink drains back into the paper
 * and the seeds start over.
 *
 * The simulation is run once at start-up and replayed from snapshots, so the
 * loop is deterministic.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for new walls, cracks and seeds
 */

const W = 800, H = 800;
const R = 200, PX = W / R;
const CELL = 40;
const PAPER = [238, 230, 212];
const INK = [170, 28, 34];
const WALL = [60, 54, 60];

const F = 0.0545, K = 0.062;   // coral growth
const ITERS = 5000;
const SNAPS = 120;

const LOOP_SECONDS = 12;
const GROW_END = 0.86;         // replay of the growth ends here; then the ink drains

let seed = 3;
let wall;
let snaps = [];                // Uint8Array of ink coverage (0..255) per snapshot
let grainSeed;
let img;
let frame = 0;

function simulate() {
  randomSeed(seed); noiseSeed(seed);
  let A = new Float32Array(R * R).fill(1), B = new Float32Array(R * R);
  let A2 = new Float32Array(R * R), B2 = new Float32Array(R * R);
  wall = new Uint8Array(R * R);
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) if (x % CELL < 1 || y % CELL < 1) wall[y * R + x] = 1;
  // cracks: short gaps in random wall segments
  for (let k = 0; k < 14; k++) {
    const vertical = random() < 0.5, c = Math.floor(random(1, R / CELL)) * CELL, p = Math.floor(random(5, R - 5));
    for (let d = 0; d < 4; d++) wall[vertical ? (p + d) * R + c : c * R + p + d] = 0;
  }
  for (let s = 0; s < 18; s++) {
    const cx = Math.floor(random(10, R - 10)), cy = Math.floor(random(10, R - 10));
    for (let y = cy - 2; y < cy + 3; y++) for (let x = cx - 2; x < cx + 3; x++) B[y * R + x] = 1;
  }
  const nb = [[-1, 0.2], [1, 0.2], [-R, 0.2], [R, 0.2], [-R - 1, 0.05], [-R + 1, 0.05], [R - 1, 0.05], [R + 1, 0.05]];
  snaps = [];
  const every = Math.floor(ITERS / SNAPS);
  for (let it = 0; it <= ITERS; it++) {
    if (it % every === 0 && snaps.length < SNAPS) {
      const s = new Uint8Array(R * R);
      for (let i = 0; i < R * R; i++) s[i] = Math.min(255, B[i] * 900);
      snaps.push(s);
    }
    for (let y = 1; y < R - 1; y++) for (let x = 1; x < R - 1; x++) {
      const i = y * R + x;
      if (wall[i]) { A2[i] = 1; B2[i] = 0; continue; }
      let la = -A[i], lb = -B[i];
      for (let n = 0; n < 8; n++) {
        const j = i + nb[n][0], w = nb[n][1];
        if (wall[j]) { la += A[i] * w; lb += B[i] * w; } else { la += A[j] * w; lb += B[j] * w; }
      }
      const abb = A[i] * B[i] * B[i];
      A2[i] = A[i] + la - abb + F * (1 - A[i]);
      B2[i] = B[i] + 0.5 * lb + abb - (K + F) * B[i];
    }
    [A, A2] = [A2, A]; [B, B2] = [B2, B];
  }
  grainSeed = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) grainSeed[i] = random();
}

const ease = (t) => t * t * (3 - 2 * t);

function renderPhase(t) {
  let a, b, mix, drain = 0;
  if (t < GROW_END) {
    const f = (t / GROW_END) * (SNAPS - 1);
    a = Math.floor(f); b = Math.min(SNAPS - 1, a + 1); mix = f - a;
  } else {
    a = b = SNAPS - 1; mix = 0;
    drain = ease((t - GROW_END) / (1 - GROW_END));
  }
  const sa = snaps[a], sb = snaps[b], s0 = snaps[0];
  img.loadPixels();
  const p = img.pixels;
  for (let y = 0; y < H; y++) {
    const ry = Math.floor(y / PX);
    for (let x = 0; x < W; x++) {
      const ci = ry * R + Math.floor(x / PX), id = 4 * (y * W + x);
      const g = grainSeed[y * W + x];
      let v = (sa[ci] * (1 - mix) + sb[ci] * mix) / 255;
      // the ink drains back to the seeds, patchily
      if (drain > 0) v = v * (1 - drain) + (s0[ci] / 255) * drain - (drain * (1 - drain)) * g * 0.6;
      const n = g * 12 - 6;
      let r = PAPER[0] + n, gg = PAPER[1] + n, bb = PAPER[2] + n;
      if (v > 0.2 + (g - 0.5) * 0.06) { r = INK[0] + n * 0.5; gg = INK[1]; bb = INK[2]; }
      if (wall[ci]) { r = WALL[0] + n; gg = WALL[1] + n; bb = WALL[2] + n; }
      p[id] = r; p[id + 1] = gg; p[id + 2] = bb; p[id + 3] = 255;
    }
  }
  img.updatePixels();
  image(img, 0, 0);
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  img = createImage(W, H);
  simulate();

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
  if (key === 's' || key === 'S') saveCanvas('contida', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    simulate();
  }
}
