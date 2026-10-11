/**
 * Chiba Sky
 *
 * Dead Channel #5: after the first line of William Gibson's Neuromancer, "The sky
 * above the port was the color of television, tuned to a dead channel."
 *
 * Each colour channel of the screen is an Ising model: every pixel is on
 * or off and prefers to agree with its eight neighbours, while temperature
 * shakes it at random (Metropolis updates). Hot, it is dead-channel static.
 * A cold front climbs from the bottom of the screen; below it the red,
 * green and blue channels each freeze into their own territories, and
 * where they overlap the sky turns into flat fields of neon colour. Then
 * the heat returns from the top down and melts it back into static.
 *
 * The simulation runs once in setup and is stored as one snapshot per
 * frame, so the loop is deterministic for capture.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const N = 233, SC = 3, OX = 50, OY = 50;
const HOT = 10, COLD = 2;
const LOOP_SECONDS = 12;
const RISE = 0.7, HOLD = 0.8;    // the cold front climbs until RISE, holds, then the screen reheats
const TOP = 0.3;                 // highest point the front reaches (share of the height)
const BG = [10, 10, 14];

let snaps = [], ground;

function temperature(y, t) {
  if (t > HOLD) {
    // the heat comes back from the top down and melts the territories into static
    const melt = N * TOP + (N * (1 - TOP) + 20) * Math.min(1, (t - HOLD) / (0.97 - HOLD));
    return y < melt ? HOT : COLD;
  }
  const front = N * (1 - (1 - TOP) * Math.min(1, t / RISE));
  return lerp(HOT, COLD, constrain((y - front) / 18 + 0.5, 0, 1));
}

function simulate() {
  const ch = [0, 1, 2].map(() => { const a = new Int8Array(N * N); for (let i = 0; i < N * N; i++) a[i] = random() < 0.5 ? 1 : -1; return a; });
  const sweep = t => {
    for (const a of ch) for (let k = 0; k < N * N; k++) {
      const x = random(N) | 0, y = random(N) | 0, i = y * N + x;
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) s += a[((y + dy + N) % N) * N + (x + dx + N) % N];
      const dE = 2 * a[i] * s;
      if (dE <= 0 || random() < Math.exp(-dE / temperature(y, t))) a[i] = -a[i];
    }
  };
  for (let k = 0; k < 10; k++) sweep(0.99);    // settle into hot static
  for (let f = 0; f < LOOP_FRAMES; f++) {
    const s = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) s[i] = (ch[0][i] > 0 ? 1 : 0) | (ch[1][i] > 0 ? 2 : 0) | (ch[2][i] > 0 ? 4 : 0);
    snaps.push(s);
    sweep(f / LOOP_FRAMES);
  }
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 4 + noise(x * 0.3, y * 0.3) * 3 + random(-2, 2);
    const i = 4 * (y * W + x);
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

function renderPhase(t) {
  image(ground, 0, 0);
  const snap = snaps[Math.min(snaps.length - 1, Math.floor(t * LOOP_FRAMES))];
  loadPixels();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = snap[y * N + x], scan = (y % 2) ? 0.82 : 1;
    const r = (v & 1 ? 255 : 18) * scan, g = (v & 2 ? 235 : 14) * scan, b = (v & 4 ? 255 : 30) * scan;
    for (let dy = 0; dy < SC; dy++) {
      const line = dy === SC - 1 ? 0.55 : 1;
      for (let dx = 0; dx < SC; dx++) {
        const p = 4 * ((OY + y * SC + dy) * W + OX + x * SC + dx);
        pixels[p] = r * line; pixels[p + 1] = g * line; pixels[p + 2] = b * line;
      }
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
  randomSeed(17); noiseSeed(17);
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
  if (key === 's' || key === 'S') saveCanvas('chiba-sky', 'png');
}
