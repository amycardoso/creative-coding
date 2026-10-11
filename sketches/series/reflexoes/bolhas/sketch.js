/**
 * Bolhas
 *
 * Reflexões #5: polarização.
 *
 * Thomas Schelling's segregation model (1971), printed in two riso inks.
 * Pink and teal dots share a grid. Each dot asks one modest thing: that at
 * least 40% of its neighbours be like it, less than half. If not, it moves
 * to a random empty place. Nobody asks for a pink side and a teal side.
 * Still, round after round, the page sorts itself into territories, and the
 * share of like-minded neighbours climbs far above what anyone asked for.
 * Bubbles are not made by extremists, only by many mild preferences added up.
 *
 * The counter shows the average share of neighbours of the same colour.
 * At the end of the loop every dot goes back to where it started.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new mix
 */

const W = 800, H = 800;
const N = 48;                    // grid size
const CELL = 14, OFF = (W - N * CELL) / 2;
const EMPTY = 0.2;               // share of empty cells
const WANT = 0.4;                // what each dot asks of its neighbours
const MAX_ROUNDS = 40;
const LOOP_SECONDS = 14;
const SORT = 0.78;               // share of the loop spent sorting
const HOLD = 0.08;               // pause on the sorted page before going back

const INK = { 1: [232, 72, 120], 2: [0, 140, 150] };
const MIS = { 1: [1.4, -1], 2: [-1, 1.4] };   // riso misregistration

let seed = 5;
let colorOf = [];                // per agent: 1 pink, 2 teal
let path = [];                   // per agent: cell index at the start of each round
let rounds = 0;
let similarity = [];             // average share of like neighbours per round
let paperG, sprite = {};

function neighboursLike(grid, i) {
  const x = i % N, y = (i / N) | 0;
  let same = 0, total = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const xx = (x + dx + N) % N, yy = (y + dy + N) % N, v = grid[yy * N + xx];
    if (v) { total++; if (colorOf[v - 1] === colorOf[grid[i] - 1]) same++; }
  }
  return total ? same / total : 1;
}

function simulate() {
  randomSeed(seed); noiseSeed(seed);
  // grid holds agent id + 1, 0 for empty
  const grid = new Int32Array(N * N);
  colorOf = []; path = [];
  for (let i = 0; i < N * N; i++) {
    if (random() < EMPTY) continue;
    colorOf.push(random() < 0.5 ? 1 : 2);
    path.push([i]);
    grid[i] = colorOf.length;
  }
  const measure = () => {
    let s = 0, n = 0;
    for (let i = 0; i < N * N; i++) if (grid[i]) { s += neighboursLike(grid, i); n++; }
    return s / n;
  };
  similarity = [measure()];
  rounds = 0;
  for (let r = 0; r < MAX_ROUNDS; r++) {
    const empties = [];
    for (let i = 0; i < N * N; i++) if (!grid[i]) empties.push(i);
    let moved = 0;
    for (let i = 0; i < N * N; i++) {
      if (!grid[i] || neighboursLike(grid, i) >= WANT) continue;
      const k = floor(random(empties.length)), j = empties[k];
      grid[j] = grid[i]; grid[i] = 0; empties[k] = i;
      moved++;
    }
    // record where every agent is after this round
    const at = new Int32Array(colorOf.length);
    for (let i = 0; i < N * N; i++) if (grid[i]) at[grid[i] - 1] = i;
    for (let a = 0; a < colorOf.length; a++) path[a].push(at[a]);
    rounds++;
    similarity.push(measure());
    if (!moved) break;
  }
}

function buildPaper() {
  paperG = createGraphics(W, H);
  paperG.pixelDensity(1);
  paperG.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 8 + noise(x * 0.3, y * 0.3) * 5 + random(-3, 3);
    const p = 4 * (y * W + x);
    paperG.pixels[p] = 240 + n; paperG.pixels[p + 1] = 234 + n; paperG.pixels[p + 2] = 220 + n; paperG.pixels[p + 3] = 255;
  }
  paperG.updatePixels();
  // a grainy riso dot per ink
  for (const k of [1, 2]) {
    const s = 32, g = createGraphics(s, s);
    g.pixelDensity(1);
    g.loadPixels();
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - s / 2 + 0.5, y - s / 2 + 0.5) / (s / 2);
      const edge = constrain((1 - d) * 8, 0, 1);
      const grain = random() < 0.12 ? 0.35 : 0.85 + random(0.15);
      const p = 4 * (y * s + x);
      g.pixels[p] = INK[k][0]; g.pixels[p + 1] = INK[k][1]; g.pixels[p + 2] = INK[k][2];
      g.pixels[p + 3] = 255 * edge * grain;
    }
    g.updatePixels();
    sprite[k] = g;
  }
}

function cellXY(i) {
  return [OFF + (i % N) * CELL + CELL / 2, OFF + ((i / N) | 0) * CELL + CELL / 2];
}

const ease = (u) => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

function positionOf(a, t) {
  const p = path[a];
  if (t < SORT) {
    const f = (t / SORT) * rounds, r = Math.min(rounds - 1, Math.floor(f));
    const from = p[r], to = p[r + 1];
    if (from === to) return cellXY(from);
    // movers within a round leave at slightly different moments
    const lag = ((a * 0.6180339) % 1) * 0.35;
    const u = constrain((f - r - lag) / 0.6, 0, 1);
    const [x0, y0] = cellXY(from), [x1, y1] = cellXY(to);
    const e = ease(u);
    return [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e];
  }
  const last = p[p.length - 1];
  if (t < SORT + HOLD) return cellXY(last);
  // going home
  const lag = ((a * 0.6180339) % 1) * 0.3;
  const u = constrain(((t - SORT - HOLD) / (1 - SORT - HOLD) - lag) / 0.7, 0, 1);
  const [x0, y0] = cellXY(last), [x1, y1] = cellXY(p[0]);
  const e = ease(u);
  return [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e];
}

function renderPhase(t) {
  image(paperG, 0, 0);
  blendMode(MULTIPLY);
  imageMode(CENTER);
  const d = CELL * 0.82;
  for (const k of [1, 2]) {
    for (let a = 0; a < colorOf.length; a++) {
      if (colorOf[a] !== k) continue;
      const [x, y] = positionOf(a, t);
      image(sprite[k], x + MIS[k][0], y + MIS[k][1], d, d);
    }
  }
  imageMode(CORNER);
  blendMode(BLEND);
  // counter
  let r, sim;
  if (t < SORT) { r = Math.min(rounds, Math.floor((t / SORT) * rounds)); sim = similarity[r]; }
  else if (t < SORT + HOLD) { r = rounds; sim = similarity[rounds]; }
  else {
    const u = ease(constrain((t - SORT - HOLD) / (1 - SORT - HOLD), 0, 1));
    r = u < 1 ? rounds : 0;
    sim = similarity[rounds] + (similarity[0] - similarity[rounds]) * u;
  }
  noStroke(); fill(70);
  textFont('Georgia'); textStyle(ITALIC); textSize(15); textAlign(LEFT, BASELINE);
  text(`cada ponto pede 40% de vizinhos iguais · rodada ${r} · ${Math.round(sim * 100)}% iguais`, OFF, H - 22);
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
  simulate();
  buildPaper();

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
  if (key === 's' || key === 'S') saveCanvas('bolhas', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    simulate();
  }
}
