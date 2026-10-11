/**
 * Spheres
 *
 * Neon #4: a rainbow that is the record of its own growth.
 *
 * Gray–Scott reaction–diffusion seeded with seven drops (planets). With
 * these rates (f = 0.055, k = 0.062) the reaction spreads as coral-like
 * worms that fill the whole field. Each cell is coloured by the moment the
 * reaction first reached it, cycling through the neon palette, so the
 * colour bands are fronts of growth frozen in place: the rainbow is not
 * painted on, it is the pattern's history.
 *
 * At the end of the loop the lights go out in the same order they came on,
 * and the seven drops start again.
 *
 * The simulation runs once in setup and is stored as one snapshot per
 * frame, so the loop is deterministic for capture.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800, S = 700, OX = 50, OY = 50;
const N = 240;
const F = 0.055, K = 0.062, DA = 1.0, DB = 0.5;
const ITERATIONS = 9000;
const SEEDS = 7;
const LOOP_SECONDS = 14;
const GROW = 0.88;               // share of the loop the reaction keeps growing
const BG = [16, 14, 24];
const PALETTE = [
  [255, 226, 0], [255, 120, 30], [255, 40, 60], [255, 46, 136],
  [140, 70, 255], [0, 200, 230], [60, 230, 110],
];

let snaps = [], born, cellCol, ground;

function simulate() {
  let A = new Float32Array(N * N).fill(1), B = new Float32Array(N * N);
  let A2 = new Float32Array(N * N), B2 = new Float32Array(N * N);
  born = new Int32Array(N * N).fill(-1);
  for (let s = 0; s < SEEDS; s++) {
    const sx = 20 + (random(N - 40) | 0), sy = 20 + (random(N - 40) | 0);
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { B[(sy + y) * N + sx + x] = 1; A[(sy + y) * N + sx + x] = 0.5; }
  }
  const steps = Math.round(LOOP_FRAMES * GROW);
  const store = () => {
    const s = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) s[i] = B[i] > 0.18 ? 1 : 0;
    snaps.push(s);
  };
  store();
  let done = 0;
  for (let k = 1; k <= steps; k++) {
    const target = Math.round(ITERATIONS * k / steps);
    for (; done < target; done++) {
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
        const i = y * N + x, a = A[i], b = B[i];
        const la = 0.2 * (A[i - 1] + A[i + 1] + A[i - N] + A[i + N])
          + 0.05 * (A[i - N - 1] + A[i - N + 1] + A[i + N - 1] + A[i + N + 1]) - a;
        const lb = 0.2 * (B[i - 1] + B[i + 1] + B[i - N] + B[i + N])
          + 0.05 * (B[i - N - 1] + B[i - N + 1] + B[i + N - 1] + B[i + N + 1]) - b;
        const r = a * b * b;
        A2[i] = a + DA * la - r + F * (1 - a);
        B2[i] = b + DB * lb + r - (K + F) * b;
        if (born[i] < 0 && B2[i] > 0.25) born[i] = done;
      }
      [A, A2] = [A2, A]; [B, B2] = [B2, B];
    }
    store();
  }
  // colour = arrival time, cycling 1.6 times through the palette
  cellCol = new Uint8Array(N * N * 3);
  for (let i = 0; i < N * N; i++) {
    const tt = Math.max(0, born[i]) / ITERATIONS * (PALETTE.length - 1) * 1.6 % (PALETTE.length - 1);
    const k = Math.floor(tt), f = tt - k;
    for (let j = 0; j < 3; j++) cellCol[i * 3 + j] = lerp(PALETTE[k][j], PALETTE[k + 1][j], f);
  }
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 7 + noise(x * 0.3, y * 0.3) * 4 + random(-3, 3);
    const i = 4 * (y * W + x);
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

function renderPhase(t) {
  image(ground, 0, 0);
  const last = snaps.length - 1;
  const snap = snaps[Math.min(last, Math.floor(t / GROW * last))];
  // lights out: cells switch off in the order they were born
  const outBefore = t > GROW ? (t - GROW) / (1 - GROW) * ITERATIONS * 1.05 : -1;
  const sc = N / S;
  loadPixels();
  for (let y = 0; y < S; y++) {
    const row = Math.floor(y * sc) * N;
    for (let x = 0; x < S; x++) {
      const c = row + Math.floor(x * sc);
      if (!snap[c] || born[c] < outBefore) continue;
      const p = 4 * ((y + OY) * W + x + OX);
      pixels[p] = cellCol[c * 3]; pixels[p + 1] = cellCol[c * 3 + 1]; pixels[p + 2] = cellCol[c * 3 + 2];
    }
  }
  updatePixels();
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
  randomSeed(9); noiseSeed(9);
  buildGround();
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
  if (key === 's' || key === 'S') saveCanvas('spheres', 'png');
}
