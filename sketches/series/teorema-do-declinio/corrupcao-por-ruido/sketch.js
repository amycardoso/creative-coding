/**
 * Corrupção por Ruído
 *
 * O Teorema do Declínio #3 — the sabotage of the mirror.
 *
 * A steady signal is recorded line by line, each line a later stretch of
 * time, top to bottom. Into it a Poisson process injects sharp spikes, and
 * the rate of spikes keeps rising. The recorder has automatic gain control:
 * it measures the energy of the noise and turns the gain down to cope, so the
 * more the noise shouts, the smaller the signal itself is drawn. The scale is
 * forced down by a rule, not by hand. The gold is mixed with ash in
 * proportion to the noise, and static settles between the lines.
 *
 * Each new line hides what lies behind it, like a stack of traces on a
 * recorder. Every run has its own signal and its own noise.
 *
 * Each visit starts from a random seed; ?seed=4 reproduces the GIF.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new recording
 */

const SLUG = 'corrupcao-por-ruido';
const W = 800, H = 800;
const LOOP_SECONDS = 26;
const DRAW_END = 0.8 * LOOP_SECONDS * 30;
const FADE_START = 0.9 * LOOP_SECONDS * 30;
const BG = [22, 21, 26];
const GOLD = [232, 178, 52], ASH = [150, 148, 142];
const ROWS = 46, X0 = 70, X1 = 730, DX = 2;

let ground, ink, rows = [], total = 0, drawn = 0, simFrame = 0;

function init() {
  ink = ink || createGraphics(W, H); ink.pixelDensity(1); ink.clear();
  simFrame = 0; drawn = 0; rows = [];
  let gain = 1, energy = 0;
  const ph = random(100), cycles = random(2, 4), growth = random(0.07, 0.11), yTop = random(60, 80);
  for (let r = 0; r < ROWS; r++) {
    const t = r / (ROWS - 1), y0 = yTop + r * 14.5, rate = 0.002 + growth * t * t;
    const pts = []; let spikeE = 0, hold = 0, v = 0;
    for (let x = X0; x <= X1; x += DX) {
      const u = (x - X0) / (X1 - X0);
      const s = sin(u * TWO_PI * cycles + ph + r * 0.12) * 0.7 + (noise(u * 3, r * 0.08) - 0.5) * 0.6;
      if (hold <= 0 && random() < rate) { hold = floor(random(2, 6)); v = random([-1, 1]) * random(0.6, 2.4); }
      let n = 0; if (hold > 0) { n = v * (random() < 0.5 ? 1 : -1); hold--; }
      spikeE += n * n; pts.push([x, s, n]);
    }
    // automatic gain control: the louder the noise, the smaller the signal
    energy = energy * 0.75 + (spikeE / pts.length) * 10; gain = 1 / (1 + energy * 1.4);
    const mix = constrain(t * 1.1 + energy * 0.2, 0, 1);
    const dust = [];
    for (let k = 0; k < energy * 90; k++) dust.push([random(X0, X1), y0 + random(-12, 8), random(40, 140), random(0.8, 1.6)]);
    dust.sort((a, b) => a[0] - b[0]);
    rows.push({ y0, pts, A: 30 * gain, gain, mix, dust, d: 0 });
  }
  total = ROWS * rows[0].pts.length;
}

function yOf(row, p, withSpike) { return row.y0 - (p[1] * row.A + (withSpike ? p[2] * 22 : 0)); }

function drawPoint(row, i) {
  const a = row.pts[i - 1], b = row.pts[i];
  // this line covers whatever earlier lines left below it
  ink.erase(); ink.noStroke();
  ink.quad(a[0], yOf(row, a, false), b[0] + 0.5, yOf(row, b, false), b[0] + 0.5, row.y0 + 40, a[0], row.y0 + 40);
  ink.noErase();
  const c = lerpColor(color(...GOLD), color(...ASH), row.mix);
  ink.stroke(c); ink.strokeWeight(1.6 * row.gain + 0.4);
  ink.line(a[0], yOf(row, a, false), b[0], yOf(row, b, false));
  if (a[2] !== 0 || b[2] !== 0) {
    ink.stroke(...ASH, 210); ink.strokeWeight(0.8);
    ink.line(a[0], yOf(row, a, true), b[0], yOf(row, b, true));
  }
  while (row.d < row.dust.length && row.dust[row.d][0] <= b[0]) {
    const [x, y, al, w] = row.dust[row.d++]; ink.stroke(...ASH, al); ink.strokeWeight(w); ink.point(x, y);
  }
}

function step(f) {
  const per = rows[0].pts.length;
  const target = Math.floor(min(1, f / DRAW_END) * total);
  for (let k = drawn; k < target; k++) {
    const i = k % per; if (i === 0) continue;
    drawPoint(rows[Math.floor(k / per)], i);
  }
  drawn = max(drawn, target);
}

function render(f) {
  image(ink, 0, 0);
  if (drawn > 0 && drawn < total) {
    const per = rows[0].pts.length, row = rows[Math.floor(drawn / per)], p = row.pts[drawn % per];
    noStroke(); fill(255, 220, 130, 230); circle(p[0], yOf(row, p, true), 4);
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
