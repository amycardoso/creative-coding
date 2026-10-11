/**
 * Nonada
 *
 * Grande Sertão: Veredas #4.
 *
 * The novel opens with one word, "Nonada": nothing, a thing of no account.
 * Here that word is the seed of a diffusion-limited aggregate. Walkers
 * set off from empty ground away from the cluster and wander at random until
 * they touch it and stick, so the
 * word grows branches the way frost, lightning and river deltas do.
 *
 * Each stuck cell remembers which cell it stuck to, and is printed as the
 * next letter of the word along that chain: walk outwards along any branch
 * and it spells n-o-n-a-d-a, n-o-n-a-d-a, each letter turned the way the
 * branch grew and set a little smaller the further it is from the seed. The
 * whole book coming out of one word that says it is nothing.
 *
 * The loop grows the aggregate in the order the walkers arrived, holds it,
 * and takes it back in reverse until only the word is left.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new growth
 */

const W = 800, H = 800;
const M = 50;
const C = 12;                    // px per grid cell
const G = Math.floor((W - 2 * M) / C);
const WALKERS = 2600;
const FAR = 5;                   // walkers start at least this many cells from the cluster
const LOOP_SECONDS = 18;
const GROW = 0.5, HOLD = 0.08, BACK = 0.34;   // the rest of the loop: only the word
const WORD = 'nonada';

const PAPER = [238, 228, 205];
const INK = [30, 24, 19];

let seed = 3;
let stuck = [];                  // {i, depth, ang} in arrival order
let wordImg, paperImg;

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

// The seed word, set large; its inked cells are the first cluster.
function makeWord() {
  wordImg = createGraphics(W, H);
  wordImg.pixelDensity(1);
  wordImg.clear();
  wordImg.noStroke();
  wordImg.fill(INK[0], INK[1], INK[2]);
  wordImg.textFont('Georgia');
  wordImg.textStyle(BOLDITALIC);
  wordImg.textAlign(CENTER, CENTER);
  wordImg.textSize(92);
  wordImg.text('Nonada', W / 2, H / 2 - 12);
}

// ---------- the aggregate (pure, seeded) ----------
function grow() {
  const owner = new Int32Array(G * G).fill(-1);  // index into nodes
  const nodes = [];
  wordImg.loadPixels();
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const px = M + x * C + (C >> 1), py = M + y * C + (C >> 1);
    if (wordImg.pixels[4 * (py * W + px) + 3] > 128) { owner[y * G + x] = nodes.length; nodes.push({ i: y * G + x, depth: 0, ang: 0, seed: true }); }
  }
  stuck = [];
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (let w = 0; w < WALKERS; w++) {
    // launch from a random empty spot with no part of the cluster close by
    let x = -1, y = -1;
    for (let tries = 0; tries < 400 && x < 0; tries++) {
      const cx = floor(random(G)), cy = floor(random(G));
      let clear = true;
      for (let dy = -FAR; dy <= FAR && clear; dy++) for (let dx = -FAR; dx <= FAR; dx++) {
        const xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && yy >= 0 && xx < G && yy < G && owner[yy * G + xx] >= 0) { clear = false; break; }
      }
      if (clear) { x = cx; y = cy; }
    }
    if (x < 0) break;               // nowhere left to start from: the field is full
    for (let step = 0; step < 200000; step++) {
      let hit = -1;
      for (const [dx, dy] of N8) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= G || yy >= G) continue;
        const o = owner[yy * G + xx];
        if (o >= 0 && (hit < 0 || nodes[o].depth < nodes[hit].depth)) hit = o;
      }
      if (hit >= 0) {
        const p = nodes[hit], pi = p.i;
        const node = { i: y * G + x, depth: p.depth + 1, ang: Math.atan2(y - ((pi / G) | 0), x - (pi % G)), seed: false };
        owner[y * G + x] = nodes.length;
        nodes.push(node);
        stuck.push(node);
        break;
      }
      const d = N8[floor(random(4))];
      x = Math.min(G - 1, Math.max(0, x + d[0]));
      y = Math.min(G - 1, Math.max(0, y + d[1]));
    }
  }
}

// ---------- drawing ----------
function renderPhase(t) {
  image(paperImg, 0, 0);
  let k;
  if (t < GROW) k = t / GROW;
  else if (t < GROW + HOLD) k = 1;
  else if (t < GROW + HOLD + BACK) k = 1 - (t - GROW - HOLD) / BACK;
  else k = 0;
  const n = Math.floor(k * k * (3 - 2 * k) * stuck.length);

  noStroke();
  fill(INK[0], INK[1], INK[2]);
  textFont('Georgia');
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  for (let j = 0; j < n; j++) {
    const s = stuck[j];
    const x = M + (s.i % G) * C + C / 2, y = M + ((s.i / G) | 0) * C + C / 2;
    // depth 1 is the letter after the seed's last "a": the word starts again
    const letter = WORD[(s.depth - 1) % WORD.length];
    push();
    translate(x, y);
    rotate(s.ang + HALF_PI);
    textSize(Math.max(12, 21 - s.depth * 0.18));
    text(letter, 0, 0);
    pop();
  }
  image(wordImg, 0, 0);

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
  makeWord();
  grow();
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
  if (key === 's' || key === 'S') saveCanvas('nonada', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    build();
  }
}
