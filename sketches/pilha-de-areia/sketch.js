/**
 * Pilha de Areia
 *
 * Reflexões #1: finitude.
 *
 * The Bak–Tang–Wiesenfeld sandpile. Grains fall one at a time on the centre
 * of a grid. When a cell holds four grains it topples, giving one to each
 * neighbour, which may topple in turn. Nobody draws the mandala: it is what
 * 52,000 small, local collapses leave behind. Most grains change nothing;
 * a few set off avalanches that cross the whole pile, and there is no way to
 * know in advance which grain will be the one.
 *
 * Each frame drops a handful of grains, and the avalanches they set off
 * redraw the inside of the pile while its rim creeps outwards. At the end of
 * the loop the wind takes the pile from one side to the other and the table
 * is empty again.
 *
 * The rule is abelian: the final pile does not depend on the order in which
 * the grains fell, so the whole growth is precomputed once in batches.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const N = 200, S = 4;            // grid cells, pixels per cell
const TOTAL = 52000;             // grains dropped per loop
const LOOP_SECONDS = 14;
const GROW = 0.82;               // share of the loop spent adding grains

const SAND = [
  [234, 220, 190],               // 0 grains (but reached by sand)
  [214, 150, 70],                // 1
  [176, 74, 44],                 // 2
  [52, 70, 110],                 // 3
];
const PAPER = [234, 222, 196];

let steps;                       // number of growth snapshots
let snaps = [];                  // Uint8Array heights per step
let grains = [];                 // grains on the table at each step
let reachedAt;                   // Int32Array: first step a cell held sand
let windAt;                      // Float32Array: phase at which wind takes the cell
let paperTex, grainJit, speck;   // fixed per-pixel texture

// ---------- precompute ----------
function buildPile() {
  steps = Math.round(LOOP_FRAMES * GROW);
  const h = new Int32Array(N * N);
  const c = (N / 2) * N + N / 2;
  reachedAt = new Int32Array(N * N).fill(-1);
  snaps = [new Uint8Array(N * N)];
  grains = [0];
  let dropped = 0;
  for (let k = 1; k <= steps; k++) {
    // grains grow with t² so the pile's radius grows roughly linearly
    const target = Math.round(TOTAL * (k / steps) ** 2);
    h[c] += target - dropped;
    dropped = target;
    let wave = h[c] >= 4 ? [c] : [];
    while (wave.length) {
      const next = [];
      for (const i of wave) {
        if (h[i] < 4) continue;
        const q = h[i] >> 2;
        h[i] -= q * 4;
        const x = i % N, y = (i / N) | 0;
        if (x > 0) { h[i - 1] += q; if (h[i - 1] >= 4) next.push(i - 1); }
        if (x < N - 1) { h[i + 1] += q; if (h[i + 1] >= 4) next.push(i + 1); }
        if (y > 0) { h[i - N] += q; if (h[i - N] >= 4) next.push(i - N); }
        if (y < N - 1) { h[i + N] += q; if (h[i + N] >= 4) next.push(i + N); }
      }
      wave = next;
    }
    const snap = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      snap[i] = h[i];
      if (h[i] > 0 && reachedAt[i] < 0) reachedAt[i] = k;
    }
    snaps.push(snap);
    grains.push(dropped);
  }
  // the wind blows left to right with a ragged front
  windAt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    windAt[y * N + x] = GROW + 0.02 + (1 - GROW - 0.05) *
      constrain(x / N * 0.8 + noise(x * 0.05, y * 0.05) * 0.35 - 0.1, 0, 1);
  }
}

function buildTexture() {
  paperTex = new Uint8ClampedArray(W * H * 3);
  grainJit = new Int8Array(W * H);
  speck = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const n = noise(x * 0.01, y * 0.01) * 12 + noise(x * 0.3, y * 0.3) * 7 + random(-5, 5);
    paperTex[i * 3] = PAPER[0] + n; paperTex[i * 3 + 1] = PAPER[1] + n; paperTex[i * 3 + 2] = PAPER[2] + n;
    grainJit[i] = Math.round(random(-28, 22));
    const r = random();
    speck[i] = r < 0.045 ? 1 : r < 0.06 ? 2 : 0;
  }
}

// ---------- render ----------
function renderPhase(t) {
  const k = Math.min(steps, Math.floor(t / GROW * steps));
  const h = snaps[k];
  loadPixels();
  for (let y = 0; y < H; y++) {
    const cy = (y / S) | 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4, ci = cy * N + ((x / S) | 0);
      let r = paperTex[i * 3], g = paperTex[i * 3 + 1], b = paperTex[i * 3 + 2];
      const reached = reachedAt[ci] >= 0 && reachedAt[ci] <= k;
      const blown = t > windAt[ci];
      if (reached && !blown) {
        const c = SAND[h[ci]];
        const j = grainJit[i];
        if (speck[i] === 1) { r = 240; g = 232; b = 210; }
        else if (speck[i] === 2 && h[ci] !== 3) { r = 60; g = 72; b = 104; }
        else { r = c[0] + j; g = c[1] + j; b = c[2] + j; }
      } else if (reached && blown && t - windAt[ci] < 0.012) {
        // the front: loose grains lifting off
        if (speck[i] || grainJit[i] > 12) { const c = SAND[h[ci]]; r = c[0]; g = c[1]; b = c[2]; }
      }
      pixels[p] = r; pixels[p + 1] = g; pixels[p + 2] = b; pixels[p + 3] = 255;
    }
  }
  updatePixels();
  noStroke();
  fill(60, 50, 40);
  textFont('Georgia'); textStyle(ITALIC); textSize(15); textAlign(LEFT, BASELINE);
  const label = t < GROW
    ? `grão ${grains[k].toLocaleString('pt-BR')}`
    : `${TOTAL.toLocaleString('pt-BR')} grãos`;
  text(label, 30, 778);
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
  randomSeed(1); noiseSeed(1);
  buildTexture();
  buildPile();

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
  if (key === 's' || key === 'S') saveCanvas('pilha-de-areia', 'png');
}
