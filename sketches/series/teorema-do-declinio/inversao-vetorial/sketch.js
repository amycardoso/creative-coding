/**
 * Inversão Vetorial
 *
 * O Teorema do Declínio #2 — the inflection point, where symmetry breaks.
 *
 * Two walkers start as mirror images: every turn one makes, the other makes
 * reflected. They lean toward each other and almost meet. At a moment the
 * picture marks only with a dashed line, the mirror stops holding.
 *
 * From there one vector puts down roots: its tip splits with a fixed
 * probability, every branch is pulled toward gravity, thins as it goes, and
 * the growth piles up into density and weight. The other keeps walking with
 * the same step, but the noise in its heading grows every step; it loses its
 * rudder, wanders in loops, and fades from gold to ash.
 *
 * Every run grows different roots and a different drift.
 *
 * Each visit starts from a random seed; ?seed=5 reproduces the GIF.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new pair
 */

const SLUG = 'inversao-vetorial';
const W = 800, H = 800;
const LOOP_SECONDS = 26;
const MIRROR_END = 110;                    // frames for the mirrored approach
const SPLIT_END = 0.75 * LOOP_SECONDS * 30; // frames for roots and drift
const FADE_START = 0.9 * LOOP_SECONDS * 30;
const BG = [22, 21, 26];
const GOLD = [232, 178, 52], ROOT = [220, 165, 55], ASH = [150, 148, 142];
const MIRROR_STEPS = 300, DRIFT_STEPS = 3000;

let ground, ink, simFrame = 0;
let trA = [], trB = [], mirrored = 0, tips = [], walker, drifted = 0;

function init() {
  ink = ink || createGraphics(W, H); ink.pixelDensity(1); ink.clear();
  simFrame = 0; mirrored = 0; drifted = 0; tips = [];
  // the mirrored approach: A walks on the left, B is its reflection
  const A = { x: random(130, 220), y: random(70, 110), h: random(0.8, 1.2) };
  trA = []; trB = [];
  for (let i = 0; i < MIRROR_STEPS; i++) {
    A.h += random(-0.05, 0.05) + (A.x > 350 ? 0.025 : 0) - (A.x < 190 ? 0.02 : 0);
    A.h = constrain(A.h, 0.6, 2.2);
    A.x = min(388, A.x + cos(A.h) * 1.1); A.y += abs(sin(A.h)) * 0.9;
    trA.push([A.x, A.y]); trB.push([W - A.x, A.y]);
  }
  walker = { x: A.x, y: A.y, h: A.h, i: 0 };
  const pB = trB[MIRROR_STEPS - 1];
  tips.push({ x: pB[0], y: pB[1], h: HALF_PI, w: 3.2, k: 0, alive: true });
}

function step(f) {
  if (f <= MIRROR_END) {
    const target = Math.floor((f / MIRROR_END) * (MIRROR_STEPS - 1));
    ink.stroke(...GOLD); ink.strokeWeight(2.2);
    for (let i = max(1, mirrored + 1); i <= target; i++) {
      ink.line(...trA[i - 1], ...trA[i]); ink.line(...trB[i - 1], ...trB[i]);
    }
    mirrored = max(mirrored, target);
    if (f === MIRROR_END) {                 // the inflection
      const y = trA[MIRROR_STEPS - 1][1];
      ink.stroke(...GOLD, 120); ink.strokeWeight(0.6);
      ink.drawingContext.setLineDash([3, 5]); ink.line(0, y, W, y); ink.drawingContext.setLineDash([]);
    }
    return;
  }
  if (f > SPLIT_END) return;
  // roots: every live tip grows one segment per frame, pulled toward gravity
  const born = [];
  for (const t of tips) {
    if (!t.alive) continue;
    t.h += randomGaussian() * 0.12 + (HALF_PI - t.h) * 0.04;
    const nx = t.x + cos(t.h) * 2, ny = t.y + sin(t.h) * 2;
    ink.stroke(...ROOT, 235); ink.strokeWeight(t.w); ink.line(t.x, t.y, nx, ny);
    t.x = nx; t.y = ny; t.w *= 0.993; t.k++;
    if (t.w < 0.25 || t.k > 400 || ny > 770 || nx < 410 || nx > 790) { t.alive = false; continue; }
    if (random() < 0.035) { born.push({ x: t.x, y: t.y, h: t.h + random([-1, 1]) * random(0.4, 0.9), w: t.w * 0.7, k: t.k, alive: true }); t.w *= 0.85; }
  }
  tips.push(...born);
  // drift: same step, heading noise that only grows
  const target = Math.floor(((f - MIRROR_END) / (SPLIT_END - MIRROR_END)) * DRIFT_STEPS);
  const gold = color(...GOLD), ash = color(...ASH);
  for (; drifted < target; drifted++) {
    const i = drifted, w = walker;
    w.h += randomGaussian() * (0.03 + i * 0.0004);
    let nx = w.x + cos(w.h) * 1.5, ny = w.y + sin(w.h) * 1.5;
    if (nx < 20 || nx > 395 || ny < 20 || ny > 770) w.h += PI;
    nx = constrain(nx, 20, 395); ny = constrain(ny, 20, 770);
    const c = lerpColor(gold, ash, min(1, i / 900));
    ink.stroke(red(c), green(c), blue(c), 220 - i / 16); ink.strokeWeight(max(0.35, 1.8 - i / 1400));
    ink.line(w.x, w.y, nx, ny); w.x = nx; w.y = ny;
  }
}

function render(f) {
  image(ink, 0, 0);
  noStroke(); fill(255, 220, 130, 230);
  if (f < MIRROR_END && mirrored > 0) { circle(...trA[mirrored], 5); circle(...trB[mirrored], 5); }
  else if (f < SPLIT_END) circle(walker.x, walker.y, 4);
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
