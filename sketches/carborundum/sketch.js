/**
 * Carborundum
 *
 * Inspired by Margaret Atwood's The Handmaid's Tale. Scratched into the
 * floor of a cupboard by a woman who came before, the narrator finds
 * "Nolite te bastardes carborundorum": don't let the bastards grind you down.
 * Carborundum is a grinding stone.
 *
 * A block of stone is worn down by simulated hydraulic erosion: tens of
 * thousands of droplets run downhill, picking up material and dropping it as
 * they slow. Soft rock goes quickly; the phrase is set in a harder vein, so
 * the grinding that wears everything else away is exactly what brings it to
 * the surface. At the end of the loop, sediment settles back over the block
 * and the grinding starts again.
 *
 * The erosion is simulated once at start-up and replayed from snapshots, so
 * the loop is deterministic.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new stone
 */

const W = 800, H = 800;
const R = 400, SC = W / R;
const DROPS = 140000;
const SNAPS = 90;
const FONT = "'Liberation Serif', 'Times New Roman', Times, serif";

const LOOP_SECONDS = 14;
const ERODE_END = 0.8;     // replay of the erosion ends here; hold; then sediment settles back
const SETTLE = 0.88;

let seed = 13;
let snaps = [];            // Float32Array heightfields
let grainSeed;
let img;
let frame = 0;

function simulate() {
  randomSeed(seed); noiseSeed(seed);
  const m = createGraphics(R, R);
  m.pixelDensity(1); m.background(0); m.fill(255); m.noStroke();
  m.textFont(FONT); m.textStyle(BOLD); m.textAlign(CENTER, CENTER);
  m.textSize(46); m.text('NOLITE TE', R / 2, R / 2 - 62); m.text('BASTARDES', R / 2, R / 2);
  m.textSize(32); m.text('CARBORUNDORUM', R / 2, R / 2 + 56);
  m.filter(BLUR, 1.2); m.loadPixels();

  const Hf = new Float32Array(R * R), hard = new Float32Array(R * R);
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const i = y * R + x;
    Hf[i] = noise(x * 0.01, y * 0.01) * 0.6 + noise(x * 0.05, y * 0.05) * 0.2;
    hard[i] = m.pixels[4 * i] / 255 * 0.95;
  }
  m.remove();
  const get = (x, y) => Hf[Math.min(R - 1, Math.max(0, y | 0)) * R + Math.min(R - 1, Math.max(0, x | 0))];

  snaps = [Hf.slice()];
  const every = Math.floor(DROPS / (SNAPS - 1));
  for (let d = 1; d <= DROPS; d++) {
    let x = random(1, R - 2), y = random(1, R - 2), sed = 0, vx = 0, vy = 0;
    for (let s = 0; s < 40; s++) {
      const gx = get(x + 1, y) - get(x - 1, y), gy = get(x, y + 1) - get(x, y - 1);
      vx = vx * 0.6 - gx * 4; vy = vy * 0.6 - gy * 4;
      const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
      const i = (y | 0) * R + (x | 0);
      const take = 0.012 * (1 - hard[i]) * (1 - hard[i]);
      Hf[i] -= take; sed += take;
      const dep = sed * 0.08;
      Hf[i] += dep * (1 - hard[i]) * 0.5; sed -= dep * 0.5;
      x += vx; y += vy;
      if (x < 1 || y < 1 || x > R - 2 || y > R - 2) break;
    }
    if (d % every === 0 && snaps.length < SNAPS) snaps.push(Hf.slice());
  }
  while (snaps.length < SNAPS) snaps.push(Hf.slice());
  grainSeed = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) grainSeed[i] = random(-10, 10);
}

const ease = (t) => t * t * (3 - 2 * t);

function renderPhase(t) {
  // which heightfield(s) to show
  let a, b, mix;
  if (t < ERODE_END) {
    const f = ease(t / ERODE_END) * (SNAPS - 1);
    a = Math.floor(f); b = Math.min(SNAPS - 1, a + 1); mix = f - a;
  } else if (t < SETTLE) {
    a = b = SNAPS - 1; mix = 0;
  } else {
    // sediment settles back: blend the worn block back into the original one
    a = SNAPS - 1; b = 0; mix = ease((t - SETTLE) / (1 - SETTLE));
  }
  const A = snaps[a], B = snaps[b];
  const h = (x, y) => {
    const i = Math.min(R - 1, Math.max(0, y | 0)) * R + Math.min(R - 1, Math.max(0, x | 0));
    return A[i] * (1 - mix) + B[i] * mix;
  };
  img.loadPixels();
  const p = img.pixels;
  for (let y = 0; y < H; y++) {
    const sy = y / SC;
    for (let x = 0; x < W; x++) {
      const sx = x / SC;
      const shade = (h(sx - 1, sy - 1) - h(sx + 1, sy + 1)) * 900;
      const v = 120 + shade + h(sx, sy) * 60 + grainSeed[y * W + x];
      const id = 4 * (y * W + x);
      p[id] = v * 1.02; p[id + 1] = v * 0.98; p[id + 2] = v * 0.94; p[id + 3] = 255;
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
  if (key === 's' || key === 'S') saveCanvas('carborundum', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    simulate();
  }
}
