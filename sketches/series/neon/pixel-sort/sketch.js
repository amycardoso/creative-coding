/**
 * Pixel Sort
 *
 * Neon #3: a rule that only touches what is bright enough.
 *
 * A domain-warped noise field is posterised into seven flat neon inks.
 * Then every column is pixel-sorted: wherever a run of pixels is brighter
 * than a threshold, that run is reordered from dark to light. Everything
 * below the threshold is left alone. The threshold breathes over the loop
 * (and differs slightly from column to column): when it is high the image
 * is almost untouched, when it drops the sorting takes over and the light
 * drains down the screen in streaks.
 *
 * The field itself drifts slowly, so the sorted streaks keep reforming.
 * Sorting uses a counting sort over the seven ink levels, so each frame is
 * an exact, deterministic function of the loop phase.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800, S = 700, OX = 50, OY = 50;
const LOOP_SECONDS = 12;
const LEVELS = 7;
const BG = [12, 10, 20];
const STOPS = [[12, 10, 30], [90, 20, 160], [255, 46, 136], [255, 120, 30], [255, 226, 0], [250, 250, 235]];

let inks = [], ground, colNoise;
const RES = 350;                 // field resolution; drawn at 2x

function gradient(t) {
  t = constrain(t, 0, 0.999) * (STOPS.length - 1);
  const i = Math.floor(t), f = t - i;
  return STOPS[i].map((v, k) => lerp(v, STOPS[i + 1][k], f));
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 6 + noise(x * 0.3, y * 0.3) * 4 + random(-3, 3);
    const i = 4 * (y * W + x);
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
  for (let l = 0; l < LEVELS; l++) inks.push(gradient(l / (LEVELS - 1)));
  colNoise = new Float32Array(RES);
  for (let x = 0; x < RES; x++) colNoise[x] = noise(x * 0.02, 77);
}

// posterised field at loop phase t: the warp origin travels on a small circle so t=0 and t=1 match
function field(t) {
  const a = t * TWO_PI, ox = Math.cos(a) * 0.12, oy = Math.sin(a) * 0.12;
  const lv = new Uint8Array(RES * RES);
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const wx = noise(x * 0.008 + ox, y * 0.008 + oy) * 4, wy = noise(x * 0.008 + 9 + ox, y * 0.008 + 3 + oy) * 4;
    let v = noise(x * 0.024 + wx, y * 0.024 + wy) * 0.8 + noise(x * 0.07 + ox * 3, y * 0.07 + oy * 3) * 0.3 - 0.08;
    lv[y * RES + x] = Math.floor(constrain((v - 0.2) * 1.8, 0, 0.999) * LEVELS);
  }
  return lv;
}

function sortColumns(lv, t) {
  const drop = Math.sqrt(0.5 - 0.5 * Math.cos(t * TWO_PI)); // 0 at the loop seam, 1 halfway
  const count = new Int32Array(LEVELS);
  for (let x = 0; x < RES; x++) {
    const thr = Math.floor((0.95 - drop * 0.85 + colNoise[x] * 0.3) * LEVELS);
    let y = 0;
    while (y < RES) {
      if (lv[y * RES + x] <= thr) { y++; continue; }
      let e = y;
      count.fill(0);
      while (e < RES && lv[e * RES + x] > thr) { count[lv[e * RES + x]]++; e++; }
      let k = y;
      for (let l = 0; l < LEVELS; l++) for (let c = 0; c < count[l]; c++) lv[(k++) * RES + x] = l;
      y = e;
    }
  }
}

function renderPhase(t) {
  image(ground, 0, 0);
  const lv = field(t);
  sortColumns(lv, t);
  loadPixels();
  const sc = S / RES;
  for (let y = 0; y < S; y++) {
    const sy = Math.floor(y / sc) * RES;
    for (let x = 0; x < S; x++) {
      const c = inks[lv[sy + Math.floor(x / sc)]], i = 4 * ((y + OY) * W + x + OX);
      pixels[i] = c[0]; pixels[i + 1] = c[1]; pixels[i + 2] = c[2];
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
  randomSeed(5); noiseSeed(5);
  buildGround();

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
  if (key === 's' || key === 'S') saveCanvas('pixel-sort', 'png');
}
