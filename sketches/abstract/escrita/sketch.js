/**
 * Escrita
 *
 * After Mira Schendel's monotypes: a page written in a language that does
 * not exist. Every page invents its own alphabet (22 glyphs, each a few
 * control points) and a vocabulary of words built from it, with letters
 * and words drawn by Zipf's law, so some recur like "a" and "the" and the
 * text reads as language rather than noise.
 *
 * The pen is a mass on a spring chasing each glyph's control points. It
 * never quite reaches them, so corners round into a cursive hand, it
 * thickens as it speeds up, and words run together when the pen is not
 * lifted. The nib carries a limited load of ink: the strokes pale as it
 * runs dry until the pen is dipped again.
 *
 * The page writes itself, rests, fades, and the next page arrives in a new
 * language. ?seed=N fixes the first language (the GIF uses seed 13 and
 * loops one page); otherwise every visit starts somewhere new.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const GLYPHS = 22, WORDS = 60;
const SIZE = 17, LINE_H = 38;            // glyph size and line spacing
const LEFT = 70, RIGHT = 730, TOP = 110, BOTTOM = 730;
const STEPS = 7;                         // pen samples spent per control point
const INK_LOAD = 2600;                   // samples one dip of ink lasts
const LOOP_SECONDS = 24;
const WRITE_END = 0.84, FADE_START = 0.92; // writing, resting, fading
const PAPER = [238, 232, 218];
const INK = [34, 30, 42];

let pen;                                 // [x, y, weight, alpha, down] per sample
let page, drawn = 0, ground;

function buildLanguage() {
  const alphabet = [];
  for (let g = 0; g < GLYPHS; g++) {
    const pts = [], n = floor(random(2, 5));
    for (let i = 0; i < n; i++) pts.push([random(-0.5, 0.6), random(-1, 0.4)]);
    if (random() < 0.3) pts.push([pts[0][0] + 0.2, random(0.3, 0.8)]); // a descender
    alphabet.push(pts);
  }
  const zipf = (n) => { const w = Array.from({ length: n }, (_, i) => 1 / (i + 1)); const sum = w.reduce((a, b) => a + b); return () => { let r = random(sum); for (let i = 0; i < n; i++) { r -= w[i]; if (r <= 0) return i; } return 0; }; };
  const letter = zipf(GLYPHS);
  const vocab = Array.from({ length: WORDS }, () => Array.from({ length: floor(random(1, 7)) }, letter));
  const word = () => vocab[floor(Math.pow(random(), 2.2) * WORDS)];
  return { alphabet, word };
}

// Write a whole page offline: the pen's path, sample by sample.
function writePage() {
  const { alphabet, word } = buildLanguage();
  const slant = random(-0.12, 0.25);
  pen = [];
  let x = LEFT, y = TOP, px = x, py = y, vx = 0, vy = 0, ink = INK_LOAD, down = false;
  while (y < BOTTOM) {
    const w = word(), ww = w.length * SIZE * 0.9;
    if (x + ww > RIGHT) { x = LEFT + random(-4, 4); y += LINE_H; px = x; py = y; vx = vy = 0; down = false; continue; }
    for (const g of w) {
      for (const p of alphabet[g]) {
        const tx = x + (p[0] - p[1] * slant) * SIZE, ty = y + p[1] * SIZE;
        for (let s = 0; s < STEPS; s++) {
          vx = vx * 0.82 + (tx - px) * 0.06; vy = vy * 0.82 + (ty - py) * 0.06;
          px += vx; py += vy;
          const speed = Math.hypot(vx, vy), load = ink / INK_LOAD;
          pen.push([px, py, 0.5 + min(1.4, speed * 0.3) * (0.5 + 0.5 * load), 70 + 170 * Math.sqrt(load), down]);
          down = true;
          if (--ink <= 0) ink = INK_LOAD; // dip the pen
        }
      }
      x += SIZE * 0.9;
    }
    x += SIZE * random(0.6, 1.1);
    if (random() < 0.6) { px = x; py = y; vx = vy = 0; down = false; } // lift between words
  }
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.008, y * 0.008) * 10;
    const i = 4 * (y * W + x);
    ground.pixels[i] = PAPER[0] + n; ground.pixels[i + 1] = PAPER[1] + n; ground.pixels[i + 2] = PAPER[2] + n * 0.8; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

function inkUpTo(n) {
  if (n < drawn) { page.clear(); drawn = 0; }
  page.noFill();
  for (let k = max(1, drawn); k < n; k++) {
    const a = pen[k - 1], b = pen[k];
    if (!b[4]) continue;
    page.stroke(INK[0], INK[1], INK[2], b[3]); page.strokeWeight(b[2]);
    page.line(a[0], a[1], b[0], b[1]);
  }
  drawn = max(drawn, n);
}

function renderPhase(t) {
  image(ground, 0, 0);
  const n = Math.floor(min(1, t / WRITE_END) * pen.length);
  inkUpTo(n);
  push();
  if (t > FADE_START) tint(255, 255 * (1 - (t - FADE_START) / (1 - FADE_START)));
  image(page, 0, 0);
  pop();
  if (t < WRITE_END && n > 0) { const p = pen[n - 1]; noStroke(); fill(...INK); circle(p[0], p[1], 4); }
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0, capturing = false;

function newPage() {
  page.clear(); drawn = 0;
  writePage();
}

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  const p = new URLSearchParams(window.location.search);
  const seed = p.has('seed') ? parseInt(p.get('seed'), 10) : Math.floor(Math.random() * 1e6);
  randomSeed(seed); noiseSeed(seed);
  buildGround();
  page = createGraphics(W, H); page.pixelDensity(1);
  newPage();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    noLoop(); capturing = true;
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  if (p.has('f') && p.has('n')) {
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  renderPhase(frame / LOOP_FRAMES);
  if (isLooping()) {
    frame = (frame + 1) % LOOP_FRAMES;
    if (frame === 0 && !capturing) newPage(); // next page, next language
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('escrita', 'png');
}
