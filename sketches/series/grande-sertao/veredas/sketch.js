/**
 * Veredas
 *
 * Grande Sertão: Veredas #1.
 *
 * A terrain made of noise, and water that only knows one rule: go to the
 * lowest neighbour. Every frame the ground is flooded from the edges so no
 * drop gets stuck in a hollow (priority-flood), then each cell passes all the
 * water it has received to its steepest neighbour (D8 flow accumulation).
 * Nobody draws a river. The thick black lines are only the cells through
 * which a lot of rain happened to pass, and the network branches like the
 * veredas of the Urucuia. Where the flood had to fill a hollow before
 * spilling, the water stands still and is cut as horizontal lines: a lagoa.
 *
 * A thin layer of the ground breathes slowly through the loop, and the rivers redraw
 * themselves: tributaries are captured, a branch dries up, another takes its
 * place. Each frame averages the water of a few neighbouring moments, so a
 * river that moves to the next valley fades across instead of snapping.
 * The sertão is everywhere, and it is never the same twice.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new sertão
 */

const W = 800, H = 800;
const N = 200;                   // grid cells per side
const M = 50, CS = (W - 2 * M) / N;
const LOOP_SECONDS = 20;
const DRIFT = 0.5;               // how far the breathing layer wanders in noise space
const BREATH = 0.35;             // share of the ground that breathes
const RIVER = 40;                // cells of rain before a line is drawn
const LAKE = 0.003;              // flood depth that reads as standing water

const PAPER = [238, 228, 205];
const INK = [30, 24, 19];

let seed = 7;
let paperImg;

function fbm(x, y, z) {
  let v = 0, a = 0.5, f = 1;
  for (let o = 0; o < 5; o++) { v += a * noise(x * f, y * f, z * f); a *= 0.5; f *= 2.03; }
  return v;
}

function makePaper() {
  paperImg = createGraphics(W, H);
  paperImg.pixelDensity(1);
  paperImg.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01 + 500, y * 0.01) * 12 + noise(x * 0.3, y * 0.3 + 500) * 7 + random(-5, 5);
    const i = 4 * (y * W + x);
    paperImg.pixels[i] = PAPER[0] + n; paperImg.pixels[i + 1] = PAPER[1] + n;
    paperImg.pixels[i + 2] = PAPER[2] + n; paperImg.pixels[i + 3] = 255;
  }
  paperImg.updatePixels();
}

// Faint gouge hatching where the resting ground crosses a contour. It is cut
// once into the paper so the moving water is the only thing that changes.
function hatchPaper() {
  terrainAt(7, 11, 0);
  paperImg.stroke(INK[0], INK[1], INK[2], 30);
  paperImg.strokeWeight(0.8);
  for (let y = 1; y < N; y += 3) for (let x = 0; x < N - 2; x += 2) {
    const c = (h[y * N + x] * 34) % 1;
    if (c < 0.2) paperImg.line(M + x * CS, M + y * CS, M + (x + 2) * CS, M + y * CS + 0.6);
  }
}

// ---------- hydrology (pure, per phase) ----------
const h = new Float64Array(N * N);
const h0 = new Float64Array(N * N);
const ground = new Float64Array(N * N);   // ground before flooding
const acc = new Float32Array(N * N);
const down = new Int32Array(N * N);
const done = new Uint8Array(N * N);
const order = new Int32Array(N * N);

function terrain(t) {
  const a = TWO_PI * t;
  terrainAt(7 + DRIFT * Math.cos(a), 11 + DRIFT * Math.sin(a), BREATH);
}

// A fixed ground plus a thin layer that breathes on a circle in noise space,
// so most valleys stay put and only the undecided ones change their minds.
function terrainAt(z1, z2, k) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x * 0.012, v = y * 0.012, i = y * N + x;
    h[i] = (1 - k) * ground[i] + k * (0.5 * fbm(u + 40, v + 40, z1) + 0.5 * fbm(u + 80, v, z2)) + y * 0.0028;
  }
  h0.set(h);
}

// Priority-flood (Barnes et al. 2014): raise every pit to its spill height,
// with a tiny epsilon so the filled flats still drain.
function fillPits() {
  done.fill(0);
  const q = [];
  const push = (v, i) => {
    q.push([v, i]);
    let k = q.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (q[p][0] <= q[k][0]) break; [q[p], q[k]] = [q[k], q[p]]; k = p; }
  };
  const pop = () => {
    const top = q[0], last = q.pop();
    if (q.length) {
      q[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1; let m = k;
        if (l < q.length && q[l][0] < q[m][0]) m = l;
        if (r < q.length && q[r][0] < q[m][0]) m = r;
        if (m === k) break;
        [q[m], q[k]] = [q[k], q[m]]; k = m;
      }
    }
    return top;
  };
  for (let i = 0; i < N * N; i++) {
    const x = i % N, y = (i / N) | 0;
    if (x === 0 || y === 0 || x === N - 1 || y === N - 1) { done[i] = 1; push(h[i], i); }
  }
  let n = 0;
  while (q.length) {
    const [v, i] = pop();
    order[n++] = i;                       // lowest first: a valid drainage order
    const x = i % N, y = (i / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx;
      if (done[j]) continue;
      done[j] = 1;
      if (h[j] <= v) h[j] = v + 1e-6;
      push(h[j], j);
    }
  }
}

function flow() {
  down.fill(-1);
  for (let i = 0; i < N * N; i++) {
    const x = i % N, y = (i / N) | 0;
    let best = -1, bs = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const j = yy * N + xx;
      const s = (h[i] - h[j]) / (dx && dy ? Math.SQRT2 : 1);
      if (s > bs) { bs = s; best = j; }
    }
    down[i] = best;
  }
  acc.fill(1);
  for (let k = N * N - 1; k >= 0; k--) {   // highest first
    const i = order[k];
    if (down[i] >= 0) acc[down[i]] += acc[i];
  }
}

// ---------- drawing ----------
// Each frame is the average of the water at a few neighbouring moments, so a
// river that jumps to the next valley fades across instead of snapping.
// Hydrology per moment is cached; stepping one frame computes one new moment.
const BLEND = 7;
const cache = new Map();
let layer, avg;

function moment(slot) {
  slot = ((slot % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  if (cache.has(slot)) return cache.get(slot);
  terrain(slot / LOOP_FRAMES);
  fillPits();
  flow();
  const lake = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) lake[i] = h[i] - h0[i] > LAKE ? 1 : 0;
  const m = { down: down.slice(), acc: acc.slice(), lake };
  cache.set(slot, m);
  if (cache.size > BLEND * 3) cache.delete(cache.keys().next().value);
  return m;
}

function drawWater(g, { down, acc, lake }) {
  // where the flood filled a hollow the water stands still: a lagoa,
  // cut as horizontal lines the way woodcuts draw water
  g.stroke(INK[0], INK[1], INK[2]);
  g.strokeWeight(1.4);
  for (let y = 0; y < N; y += 2) {
    let run = -1;
    for (let x = 0; x <= N; x++) {
      const wet = x < N && lake[y * N + x];
      if (wet && run < 0) run = x;
      if (!wet && run >= 0) { if (x - run > 1) g.line(M + run * CS, M + y * CS, M + x * CS, M + y * CS); run = -1; }
    }
  }
  g.strokeCap(ROUND);
  for (let i = 0; i < N * N; i++) {
    const j = down[i];
    if (j < 0 || acc[i] < RIVER) continue;
    if (lake[i] && lake[j]) continue;
    g.strokeWeight(Math.min(6.5, 0.6 + 0.1 * Math.sqrt(acc[i] - RIVER)));
    g.line(M + (i % N) * CS, M + ((i / N) | 0) * CS, M + (j % N) * CS, M + ((j / N) | 0) * CS);
  }
}

function renderPhase(t) {
  const f = Math.round(t * LOOP_FRAMES);
  avg.clear();
  for (let k = 0; k < BLEND; k++) {
    layer.clear();
    drawWater(layer, moment(f + k - (BLEND >> 1)));
    // running average: the k-th layer over the mean of the first k
    avg.drawingContext.globalAlpha = 1 / (k + 1);
    avg.image(layer, 0, 0);
    avg.drawingContext.globalAlpha = 1;
  }
  image(paperImg, 0, 0);
  drawingContext.globalAlpha = 0.94;
  image(avg, 0, 0);
  drawingContext.globalAlpha = 1;

  noFill();
  stroke(INK[0], INK[1], INK[2]);
  strokeWeight(3);
  rect(M, M, W - 2 * M, H - 2 * M);
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 24;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function build() {
  randomSeed(seed); noiseSeed(seed);
  makePaper();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) ground[y * N + x] = fbm(x * 0.012, y * 0.012, 3);
  hatchPaper();
  cache.clear();
  layer = layer || createGraphics(W, H);
  avg = avg || createGraphics(W, H);
  layer.pixelDensity(1); avg.pixelDensity(1);
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
  if (key === 's' || key === 'S') saveCanvas('veredas', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    build();
  }
}
