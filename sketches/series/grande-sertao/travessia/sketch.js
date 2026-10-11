/**
 * Travessia
 *
 * Grande Sertão: Veredas #2.
 *
 * A random spanning tree is grown over a coarse grid (Kruskal, with edge
 * weights that make some regions prefer running east–west and others
 * north–south). Walking around that tree, always keeping it on the same
 * hand, gives one path that passes through every cell of a grid twice as
 * fine and never crosses itself. Nobody lays out the labyrinth; it is the
 * outline of a tree no one sees.
 *
 * The whole path is always there, faint, like a track in dust. Only a
 * stretch of it is carved: a black line with a white gouge down its middle,
 * cut at the head while the tail is let go. Head and tail go around at the
 * same speed, so the picture never shows where the crossing began or where it
 * ends, only the middle of it.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new crossing
 */

const W = 800, H = 800;
const T = 26;                    // spanning-tree cells per side
const G = T * 2;                 // path cells per side
const M = 50, CS = (W - 2 * M) / G;
const LOOP_SECONDS = 24;
const SPAN = 0.42;               // share of the path that is carved at once
const FADE = 0.12;               // the cut softens into dust over this share

const PAPER = [236, 225, 200];
const INK = [30, 24, 19];

let seed = 12;
let path = [];                   // fine-cell indices in walking order (a cycle)
let paperImg;

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

// ---------- the path (pure, seeded) ----------
function spanningTree() {
  const edges = [];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const grain = noise(x * 0.12, y * 0.12);
    if (x < T - 1) edges.push({ a: y * T + x, b: y * T + x + 1, w: random() * (0.3 + grain) });
    if (y < T - 1) edges.push({ a: y * T + x, b: (y + 1) * T + x, w: random() * (1.3 - grain) });
  }
  edges.sort((p, q) => p.w - q.w);
  const parent = [...Array(T * T).keys()];
  const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const right = new Uint8Array(T * T), down = new Uint8Array(T * T);
  for (const e of edges) {
    const ra = find(e.a), rb = find(e.b);
    if (ra === rb) continue;
    parent[ra] = rb;
    if (e.b === e.a + 1) right[e.a] = 1; else down[e.a] = 1;
  }
  return { right, down };
}

// Each tree cell becomes a 2×2 block whose four cells are linked in a ring;
// where the tree crosses a side, that side's link is replaced by two links
// into the neighbour. Every fine cell ends with exactly two links: one cycle.
function outline({ right, down }) {
  const nb = Array.from({ length: G * G }, () => []);
  const link = (x0, y0, x1, y1) => { const a = y0 * G + x0, b = y1 * G + x1; nb[a].push(b); nb[b].push(a); };
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const c = y * T + x, X = 2 * x, Y = 2 * y;
    const up = y > 0 && down[c - T], left = x > 0 && right[c - 1];
    if (!up) link(X, Y, X + 1, Y);
    if (!left) link(X, Y, X, Y + 1);
    if (right[c]) { link(X + 1, Y, X + 2, Y); link(X + 1, Y + 1, X + 2, Y + 1); } else link(X + 1, Y, X + 1, Y + 1);
    if (down[c]) { link(X, Y + 1, X, Y + 2); link(X + 1, Y + 1, X + 1, Y + 2); } else link(X, Y + 1, X + 1, Y + 1);
  }
  const out = [0];
  let prev = -1, cur = 0;
  for (;;) {
    const next = nb[cur][0] === prev ? nb[cur][1] : nb[cur][0];
    if (next === 0) break;
    out.push(next); prev = cur; cur = next;
  }
  return out;
}

// ---------- drawing ----------
const px = (i) => M + ((i % G) + 0.5) * CS;
const py = (i) => M + (((i / G) | 0) + 0.5) * CS;

// Draw path[a..b] (indices may run past the end; they wrap around the cycle).
function cut(a, b, w, col) {
  if (b - a < 1) return;
  const L = path.length, at = (k) => path[((k % L) + L) % L];
  noFill();
  stroke(col);
  strokeWeight(w);
  strokeJoin(ROUND); strokeCap(ROUND);
  beginShape();
  curveVertex(px(at(a)), py(at(a)));
  for (let k = a; k <= b; k++) curveVertex(px(at(k)), py(at(k)));
  curveVertex(px(at(b)), py(at(b)));
  endShape();
}

function renderPhase(t) {
  image(paperImg, 0, 0);
  const L = path.length;
  const tail = Math.floor(t * L), span = Math.floor(SPAN * L), fade = Math.floor(FADE * L);

  // the dust: the whole crossing, always there
  cut(0, L, 2.2, color(INK[0], INK[1], INK[2], 26));

  // behind the tail the cut softens into the dust
  const steps = 8;
  for (let s = 0; s < steps; s++) {
    const a = tail - fade + Math.floor((fade * s) / steps), b = tail - fade + Math.floor((fade * (s + 1)) / steps);
    cut(a, b + 1, lerp(2.4, CS * 0.5, s / steps), color(INK[0], INK[1], INK[2], lerp(30, 200, s / steps)));
  }

  cut(tail, tail + span, CS * 0.62, color(INK[0], INK[1], INK[2]));
  cut(tail, tail + span, 1.8, color(PAPER[0] + 6, PAPER[1] + 6, PAPER[2] + 6));

  const head = path[(tail + span) % L];
  noStroke(); fill(INK[0], INK[1], INK[2]);
  circle(px(head), py(head), CS * 0.8);

  noFill();
  stroke(INK[0], INK[1], INK[2]);
  strokeWeight(3);
  rect(M, M, W - 2 * M, H - 2 * M);
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function build() {
  randomSeed(seed); noiseSeed(seed);
  makePaper();
  path = outline(spanningTree());
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
  if (key === 's' || key === 'S') saveCanvas('travessia', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    build();
  }
}
