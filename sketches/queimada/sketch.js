/**
 * Queimada
 *
 * Reflexões #4: clima.
 *
 * A forest-fire cellular automaton seen from above. Each cell is a tree or
 * bare ground. A burning cell sets its neighbours alight with some chance,
 * then turns to ash. The forest took centuries to grow, patch by patch, and
 * the rule for burning is the same for every tree; what changes during the
 * loop is how often a spark lands. The first one burns a clearing. Then they
 * come closer together, the fronts meet, and the fire stops being an event
 * and becomes the landscape.
 *
 * After the fire the ash cools, the soil shows, and the forest grows back
 * cell by cell into exactly the forest it was, which is the one thing the
 * real one cannot do.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new forest
 */

const W = 800, H = 800;
const N = 160, S = 5;            // grid cells, pixels per cell
const LOOP_SECONDS = 14;
const BURN = 0.64;               // share of the loop the fire runs
const FIRE_STEPS = 120;          // automaton steps during the fire
const CATCH = 0.62;              // chance a burning neighbour lights a tree
// sparks: [step, how many] — they come more often as the loop goes on
const SPARKS = [[0, 1], [22, 1], [40, 2], [54, 2], [64, 3], [72, 4], [78, 5], [84, 6]];

const PAPER = [232, 222, 196];

let seed = 4;
let tree, age;                   // the forest before the fire
let burnedAt;                    // Int16Array: step a cell caught fire, -1 never
let regrowAt;                    // Float32Array: loop phase when the tree is back
let pixJit;                      // per-pixel shading

function build() {
  randomSeed(seed); noiseSeed(seed);
  tree = new Uint8Array(N * N);
  age = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, d = noise(x * 0.03, y * 0.03);
    tree[i] = random() < 0.25 + d * 0.85 ? 1 : 0;
    age[i] = constrain(d * 1.1 + random(-0.12, 0.12), 0, 1);
  }
  // run the fire
  burnedAt = new Int16Array(N * N).fill(-1);
  let burning = [];
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (let step = 0; step < FIRE_STEPS; step++) {
    for (const [at, n] of SPARKS) if (at === step) {
      for (let s = 0; s < n; s++) {
        for (let tries = 0; tries < 500; tries++) {
          const i = floor(random(N * N));
          if (tree[i] && burnedAt[i] < 0) { burnedAt[i] = step; burning.push(i); break; }
        }
      }
    }
    const next = [];
    for (const i of burning) {
      const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of nb) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = yy * N + xx;
        if (tree[j] && burnedAt[j] < 0 && random() < CATCH) { burnedAt[j] = step + 1; next.push(j); }
      }
    }
    burning = next;
  }
  regrowAt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    regrowAt[i] = BURN + 0.1 + 0.24 * constrain(noise(x * 0.06 + 30, y * 0.06) * 1.2 - 0.1 + random(-0.08, 0.08), 0, 1);
  }
  pixJit = new Int8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = (x % S === 0 || y % S === 0) ? -12 : 0;
    pixJit[y * W + x] = Math.round(random(-14, 14) + edge);
  }
}

function forestColor(i) {
  const a = age[i];
  return [120 + (26 - 120) * a, 160 + (84 - 160) * a, 80 + (52 - 80) * a];
}

function hash(i, s) {
  let h = (i * 374761393 + s * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function renderPhase(t) {
  const step = t < BURN ? (t / BURN) * FIRE_STEPS : FIRE_STEPS + (t - BURN) * 400;
  const s0 = Math.floor(step);
  const cell = new Uint8Array(N * N * 3);
  const show = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    let c = null;
    const b = burnedAt[i];
    if (b < 0 || b > step) {
      if (tree[i]) c = forestColor(i);
    } else if (t > regrowAt[i]) {
      // grown back: young pale green easing into the old forest colour
      if (tree[i]) {
        const k = Math.min(1, (t - regrowAt[i]) / 0.05);
        const f = forestColor(i);
        c = [180 + (f[0] - 180) * k, 200 + (f[1] - 200) * k, 110 + (f[2] - 110) * k];
      }
    } else {
      const since = step - b;
      if (since < 1.5) {
        c = hash(i, s0) < 0.6 ? [232, 90, 34] : [250, 192, 62];
      } else if (since < 5) {
        c = hash(i, s0) < 0.3 ? [168, 48, 28] : [120, 40, 24];
      } else {
        // ash cools from charcoal to grey, then the soil shows through
        const cool = Math.min(1, (since - 5) / 60);
        const soil = Math.max(0, (t - (regrowAt[i] - 0.12)) / 0.12);
        if (soil < 1) {
          const ash = [28 + 72 * cool, 24 + 66 * cool, 22 + 58 * cool];
          c = [ash[0] + (PAPER[0] - ash[0]) * soil, ash[1] + (PAPER[1] - ash[1]) * soil, ash[2] + (PAPER[2] - ash[2]) * soil];
        }
      }
    }
    if (c) { show[i] = 1; cell[i * 3] = c[0]; cell[i * 3 + 1] = c[1]; cell[i * 3 + 2] = c[2]; }
  }
  loadPixels();
  for (let y = 0; y < H; y++) {
    const row = ((y / S) | 0) * N;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4, ci = row + ((x / S) | 0);
      const j = pixJit[i];
      if (show[ci]) {
        pixels[p] = cell[ci * 3] + j; pixels[p + 1] = cell[ci * 3 + 1] + j; pixels[p + 2] = cell[ci * 3 + 2] + j;
      } else {
        const n = j * 0.4;
        pixels[p] = PAPER[0] + n; pixels[p + 1] = PAPER[1] + n; pixels[p + 2] = PAPER[2] + n;
      }
      pixels[p + 3] = 255;
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
  if (key === 's' || key === 'S') saveCanvas('queimada', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    build();
  }
}
