/**
 * Mitose
 *
 * Reflexões #2: o eu e o outro.
 *
 * Gray–Scott reaction–diffusion. Two chemicals spread over the paper; one
 * feeds on the other. With these rates (f = 0.0367, k = 0.0649) a spot that
 * grows too large cannot feed its own middle, so it pinches in two. The
 * loop starts from a single drop of ink. Every spot on the page descends
 * from it, and each one only exists because its neighbours keep it from
 * spreading: a self is drawn by its border with the others.
 *
 * At the end of the loop the ink dries back into the paper and a new drop
 * falls in the centre.
 *
 * The simulation runs once in setup and is stored as one snapshot per
 * frame, so the loop is deterministic for capture.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const N = 220;                   // simulation grid (wraps around)
const F = 0.0367, K = 0.0649;    // the "mitosis" region of Gray–Scott
const DA = 1.0, DB = 0.5;
const ITERATIONS = 14000;
const LOOP_SECONDS = 14;
const GROW = 0.86;               // share of the loop the ink keeps growing
const DROP = 0.035;              // the new drop fades in over the last bit

const PAPER = [238, 230, 212];
const INK = [26, 34, 70];

let snaps = [];                  // Uint8Array of B (0..255) per growth frame
let paperTex, inkVar, dryAt;

function simulate() {
  const steps = Math.round(LOOP_FRAMES * GROW);
  let A = new Float32Array(N * N).fill(1), B = new Float32Array(N * N);
  let A2 = new Float32Array(N * N), B2 = new Float32Array(N * N);
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
    if (x * x + y * y >= 25) continue;
    const i = (N / 2 + y) * N + N / 2 + x;
    A[i] = 0.5; B[i] = 0.25 + random(0.05);
  }
  const store = () => {
    const s = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) s[i] = Math.min(255, B[i] * 600);
    snaps.push(s);
  };
  store();
  let done = 0;
  for (let k = 1; k <= steps; k++) {
    const target = Math.round(ITERATIONS * k / steps);
    for (; done < target; done++) {
      for (let y = 0; y < N; y++) {
        const ym = ((y - 1 + N) % N) * N, yp = ((y + 1) % N) * N, yc = y * N;
        for (let x = 0; x < N; x++) {
          const xm = (x - 1 + N) % N, xp = (x + 1) % N, i = yc + x;
          const a = A[i], b = B[i];
          const la = 0.2 * (A[yc + xm] + A[yc + xp] + A[ym + x] + A[yp + x])
            + 0.05 * (A[ym + xm] + A[ym + xp] + A[yp + xm] + A[yp + xp]) - a;
          const lb = 0.2 * (B[yc + xm] + B[yc + xp] + B[ym + x] + B[yp + x])
            + 0.05 * (B[ym + xm] + B[ym + xp] + B[yp + xm] + B[yp + xp]) - b;
          const r = a * b * b;
          A2[i] = a + DA * la - r + F * (1 - a);
          B2[i] = b + DB * lb + r - (K + F) * b;
        }
      }
      [A, A2] = [A2, A]; [B, B2] = [B2, B];
    }
    store();
  }
}

function buildTexture() {
  paperTex = new Uint8ClampedArray(W * H * 3);
  inkVar = new Float32Array(W * H);
  dryAt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const n = noise(x * 0.01, y * 0.01) * 12 + noise(x * 0.3, y * 0.3) * 7 + random(-5, 5);
    paperTex[i * 3] = PAPER[0] + n; paperTex[i * 3 + 1] = PAPER[1] + n; paperTex[i * 3 + 2] = PAPER[2] + n;
    inkVar[i] = 0.75 + 0.35 * noise(x * 0.08 + 50, y * 0.08);
    // drying order: blotchy, a little earlier towards the edges of the page
    const d = Math.hypot(x - W / 2, y - H / 2) / (W * 0.7);
    dryAt[i] = GROW + (1 - GROW - DROP - 0.01) * constrain(noise(x * 0.012, y * 0.012 + 9) * 0.9 + 0.25 - d * 0.35, 0, 1);
  }
}

function renderPhase(t) {
  const steps = snaps.length - 1;
  const k = Math.min(steps, Math.floor(t / GROW * steps));
  const B = snaps[k];
  const seed = snaps[0];
  const dropA = t > 1 - DROP ? (t - (1 - DROP)) / DROP : 0;
  const s = N / W;
  loadPixels();
  for (let y = 0; y < H; y++) {
    const fy = y * s, y0 = fy | 0, y1 = (y0 + 1) % N, ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4;
      const fx = x * s, x0 = fx | 0, x1 = (x0 + 1) % N, tx = fx - x0;
      let src = B, fade = 1;
      if (t > GROW) {
        // drying: each pixel loses its ink at its own moment
        fade = t < dryAt[i] ? 1 : Math.max(0, 1 - (t - dryAt[i]) / 0.03);
        if (dropA > 0) { src = seed; fade = dropA; }
      }
      const v = ((src[y0 * N + x0] * (1 - tx) + src[y0 * N + x1] * tx) * (1 - ty)
        + (src[y1 * N + x0] * (1 - tx) + src[y1 * N + x1] * tx) * ty) / 600;
      const ink = constrain((v - 0.12) * 7, 0, 1) * inkVar[i] * fade;
      let r = paperTex[i * 3], g = paperTex[i * 3 + 1], b = paperTex[i * 3 + 2];
      if (ink > 0) { r += (INK[0] - r) * ink; g += (INK[1] - g) * ink; b += (INK[2] - b) * ink; }
      pixels[p] = r; pixels[p + 1] = g; pixels[p + 2] = b; pixels[p + 3] = 255;
    }
  }
  updatePixels();
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 60;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  randomSeed(2); noiseSeed(2);
  buildTexture();
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
  if (key === 's' || key === 'S') saveCanvas('mitose', 'png');
}
