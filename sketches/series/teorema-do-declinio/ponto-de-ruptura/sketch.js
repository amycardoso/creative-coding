/**
 * Ponto de Ruptura
 *
 * O Teorema do Declínio #4 — the end of the spell, and the form taken back.
 *
 * Gold and ash particles start mixed in one disc. Three rules: gold is drawn
 * to gold (cohesion with a short-range push so it keeps volume), gold pushes
 * ash away, and ash only jitters. Nothing breaks and nothing explodes; the
 * mixture simply separates. The gold gathers into one body and the ash ends
 * up as a ring of static at a distance.
 *
 * When the separation settles, the density of the gold is read as a field
 * and traced level by level (marching squares), from the core outward, and
 * the outermost level is cut as a hard, bright edge.
 *
 * Every run separates differently and leaves a different shape.
 *
 * Each visit starts from a random seed; ?seed=1 reproduces the GIF.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new separation
 */

const SLUG = 'ponto-de-ruptura';
const W = 800, H = 800;
const LOOP_SECONDS = 24;
const SIM_END = 330;                       // frames (one simulation step per frame)
const LEVELS = 14, LEVEL_FRAMES = 9;
const FADE_START = 0.88 * LOOP_SECONDS * 30;
const BG = [22, 21, 26];
const GOLD = [232, 178, 52], EDGE = [255, 210, 110], ASH = [150, 148, 142];
const NP = 1900, NG = 600, C = 5, GW = 160;

let ground, trail, lines, P = [], G = [], F = null, mx = 0, simFrame = 0, cx = 400, cy = 390;

function init() {
  trail = trail || createGraphics(W, H); trail.pixelDensity(1); trail.clear();
  lines = lines || createGraphics(W, H); lines.pixelDensity(1); lines.clear();
  simFrame = 0; F = null;
  P = [];
  const R = random(300, 340);
  for (let i = 0; i < NP; i++) {
    const a = random(TWO_PI), r = R * sqrt(random());
    P.push({ x: 400 + r * cos(a), y: 390 + r * sin(a), g: i < NG, vx: 0, vy: 0, j: random(0.7, 1.8) });
  }
  G = P.filter(p => p.g);
}

function simulate(it) {
  cx = 0; cy = 0; let mvx = 0, mvy = 0;
  for (const p of G) { cx += p.x; cy += p.y; mvx += p.vx; mvy += p.vy; }
  cx /= G.length; cy /= G.length; mvx /= G.length; mvy /= G.length;
  for (const p of G) { p.vx -= mvx; p.vy -= mvy; }  // no drift of the whole body
  for (const p of P) {
    if (p.g) {
      p.vx += (cx - p.x) * 0.00042; p.vy += (cy - p.y) * 0.00042;
      for (const q of G) {
        if (q === p) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy + 1;
        if (d2 < 3600) { const d = Math.sqrt(d2), f = d < 13 ? -0.35 : 0.012 * (1 - d / 60); p.vx += dx / d * f; p.vy += dy / d * f; }
      }
    } else {
      p.vx += randomGaussian() * 0.35; p.vy += randomGaussian() * 0.35;
      const dx = p.x - cx, dy = p.y - cy, d = Math.sqrt(dx * dx + dy * dy) + 1;
      if (d < 230) { p.vx += dx / d * 0.5; p.vy += dy / d * 0.5; }
    }
    p.vx *= 0.8; p.vy *= 0.8;
    const ox = p.x, oy = p.y;
    p.x = constrain(p.x + p.vx, 20, 780); p.y = constrain(p.y + p.vy, 20, 780);
    if (it % 3 === 0) { trail.stroke(...(p.g ? GOLD : ASH), p.g ? 18 : 22); trail.strokeWeight(0.6); trail.line(ox, oy, p.x, p.y); }
  }
}

function buildField() {
  F = new Float32Array((GW + 1) * (GW + 1)); mx = 0;
  for (const p of G) for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
    const gx = Math.floor(p.x / C) + i, gy = Math.floor(p.y / C) + j;
    if (gx < 0 || gy < 0 || gx > GW || gy > GW) continue;
    const dx = gx * C - p.x, dy = gy * C - p.y;
    F[gy * (GW + 1) + gx] += Math.exp(-(dx * dx + dy * dy) / 260);
  }
  for (const v of F) mx = max(mx, v);
}

function iso(lv, col, w) {
  lines.stroke(col); lines.strokeWeight(w);
  const at = (x, y) => F[y * (GW + 1) + x];
  for (let gy = 0; gy < GW; gy++) for (let gx = 0; gx < GW; gx++) {
    const v = [at(gx, gy), at(gx + 1, gy), at(gx + 1, gy + 1), at(gx, gy + 1)];
    const cr = [[0, 1, gx, gy, gx + 1, gy], [1, 2, gx + 1, gy, gx + 1, gy + 1], [2, 3, gx + 1, gy + 1, gx, gy + 1], [3, 0, gx, gy + 1, gx, gy]];
    const e = [];
    for (const [a, b, ax, ay, bx, by] of cr) if ((v[a] > lv) !== (v[b] > lv)) {
      const t = (lv - v[a]) / (v[b] - v[a]); e.push([(ax + (bx - ax) * t) * C, (ay + (by - ay) * t) * C]);
    }
    if (e.length >= 2) lines.line(e[0][0], e[0][1], e[1][0], e[1][1]);
    if (e.length === 4) lines.line(e[2][0], e[2][1], e[3][0], e[3][1]);
  }
}

function step(f) {
  if (f <= SIM_END) { simulate(f); return; }
  if (!F) buildField();
  const k = (f - SIM_END) / LEVEL_FRAMES;       // levels from the core outward, then the edge
  if (Number.isInteger(k) && k >= 1 && k <= LEVELS) {
    const lvl = LEVELS + 1 - k;
    iso(mx * (0.04 + lvl * 0.06), color(...GOLD, 70 + lvl * 10), 0.9);
  } else if (Number.isInteger(k) && k === LEVELS + 2) {
    iso(mx * 0.04, color(...EDGE), 3.2);
  }
}

function render(f) {
  image(trail, 0, 0);
  noStroke();
  const after = max(0, (f - SIM_END) / (LEVELS * LEVEL_FRAMES));
  for (const p of P) {
    if (p.g) { if (after >= 1) continue; fill(...GOLD, 200 * (1 - after)); circle(p.x, p.y, 2.2); }
    else { fill(...ASH, 120); circle(p.x, p.y, p.j); }
  }
  image(lines, 0, 0);
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
