/**
 * Sinal Puro
 *
 * O Teorema do Declínio #1 — convergence, and the illusion of symmetry.
 *
 * Two oscillators with almost the same frequency: one runs at 97% of the
 * other. They are coupled as in the Kuramoto model, so each phase is pulled
 * toward the other's, and the closer they are in phase the faster the two
 * lines drift together. Each line is a ribbon of fine threads that jitter
 * apart while out of step and settle into one stroke once the phases lock.
 * Where both are in phase, faint rungs appear between them.
 *
 * Nobody draws the meeting: it is what the coupling does to two rhythms
 * that start apart. Every run picks new phases, amplitudes and coupling.
 *
 * Each visit starts from a random seed; ?seed=2 reproduces the GIF.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new pair
 */

const SLUG = 'sinal-puro';
const W = 800, H = 800;
const LOOP_SECONDS = 24;
const DRAW_END = 0.68 * LOOP_SECONDS * 30; // frames spent drawing
const FADE_START = 0.88 * LOOP_SECONDS * 30;
const BG = [22, 21, 26];
const GOLD = [232, 178, 52], PALE = [255, 220, 130];
const N = 1300, STRANDS = 14, X0 = 50, X1 = 750;

let ground, ink, S = [], drawn = 0, simFrame = 0;

function init() {
  ink = ink || createGraphics(W, H); ink.pixelDensity(1); ink.clear();
  simFrame = 0; drawn = 0;
  const ratio = 0.97;
  const w1 = random(0.1, 0.15), w2 = w1 * ratio, K = random(0.01, 0.022);
  let p1 = random(TWO_PI), p2 = p1 + random(1.5, 3.1), sep = random(220, 300);
  const cy = random(360, 420), sh = random(0.15, 0.35);
  S = [];
  for (let i = 0; i < N; i++) {
    const d = sin(p2 - p1); p1 += w1 + K * d; p2 += w2 - K * d;
    const sync = (1 + cos(p2 - p1)) / 2;          // 1 = in phase
    sep *= 1 - 0.0022 * (0.3 + sync);              // they close in faster while listening
    const t = i / (N - 1);
    const A1 = 20 + 40 * noise(t * 3, 1), A2 = 20 + 40 * noise(t * 3, 5);
    S.push({
      x: X0 + t * (X1 - X0),
      y1: cy - sep / 2 + A1 * (sin(p1) + sh * sin(2 * p1 + 1)),
      y2: cy + sep / 2 + A2 * (sin(p2) + sh * sin(2 * p2 + 1)),
      sync,
    });
  }
}

function strandY(i, k, f) {
  const s = S[i], off = (f - STRANDS / 2) * 1.3;
  return s[k] + off + (noise(i * 0.01, f, k === 'y1' ? 0 : 9) - 0.5) * 6 * (1 - s.sync * 0.7);
}

function step(f) {
  const target = Math.floor(min(1, f / DRAW_END) * (N - 1));
  for (let i = max(1, drawn + 1); i <= target; i++) {
    const a = S[i - 1], b = S[i];
    if (i % 6 === 0 && b.sync > 0.9) {           // rungs where they are in phase
      ink.stroke(...GOLD, 700 * (b.sync - 0.9)); ink.strokeWeight(0.6); ink.line(b.x, b.y1, b.x, b.y2);
    }
    for (const [k, col] of [['y1', GOLD], ['y2', PALE]]) {
      ink.stroke(...col, 70); ink.strokeWeight(0.7);
      for (let s = 0; s < STRANDS; s++) ink.line(a.x, strandY(i - 1, k, s), b.x, strandY(i, k, s));
    }
  }
  drawn = max(drawn, target);
}

function render(f) {
  image(ink, 0, 0);
  if (drawn > 0 && drawn < N - 1) {
    const s = S[drawn]; noStroke();
    fill(...PALE, 230); circle(s.x, s.y1, 5); circle(s.x, s.y2, 5);
  }
}

// ---------- ground: charcoal paper ----------
function makeGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1); ground.loadPixels();
  for (let i = 0; i < ground.pixels.length; i += 4) {
    const n = (Math.random() - 0.5) * 7;
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0, capturing = false, baseSeed = 0, cycle = 0;

function start() {
  const s = baseSeed + cycle * 1013;
  randomSeed(s); noiseSeed(s);
  init();
}

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  const p = new URLSearchParams(window.location.search);
  baseSeed = p.has('seed') ? parseInt(p.get('seed'), 10) : Math.floor(Math.random() * 1e6);
  makeGround();
  start();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    noLoop(); capturing = true;
    const f = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    if (f < simFrame) start();
    frame = f;
    redraw();
  };
  if (p.has('f') && p.has('n')) {
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  advanceTo(frame);
  image(ground, 0, 0);
  render(frame);
  // the last stretch of the loop fades back to bare paper
  const fade = (frame - FADE_START) / (LOOP_FRAMES - FADE_START);
  if (fade > 0) { push(); tint(255, 255 * min(1, fade)); image(ground, 0, 0); pop(); }
  if (isLooping()) {
    frame++;
    if (frame >= LOOP_FRAMES) { frame = 0; cycle++; start(); }
  }
}

function advanceTo(f) { while (simFrame < f) { simFrame++; step(simFrame); } }

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas(SLUG, 'png');
  if (key === ' ') { cycle++; frame = 0; start(); }
}
