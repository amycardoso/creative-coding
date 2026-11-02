/**
 * Ponto de Ruptura
 *
 * O Teorema do Declínio #4 — the end of the spell, and the form taken back.
 *
 * The gold line of the series starts crumpled and frayed, tangled in a field
 * of static. Gray threads tie it to the static at hundreds of points, and
 * specks of its own gold lie scattered out in the noise.
 *
 * The line is a chain of nodes held by springs, and its stiffness rises over
 * time: it keeps trying to return to its own slow rhythm. Each tie to the
 * static has its own strength and snaps quietly once the line pulls past it.
 * Nothing explodes; contacts just end, one by one. A node with no ties left
 * calls its scattered specks back, and each speck that arrives makes that
 * stretch brighter. As ties break and specks return, the fraying threads
 * close into one band, and its edges are cut sharp and solid.
 *
 * The static stays where it was, still noisy, no longer attached.
 * Every run tangles and frees the line differently.
 *
 * Each visit starts from a random seed; ?seed=1 reproduces the GIF.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new line
 */

const SLUG = 'ponto-de-ruptura';
const W = 800, H = 800;
const LOOP_SECONDS = 24;
const HOLD_START = 60;                      // tangled, before anything gives
const FADE_START = 0.88 * LOOP_SECONDS * 30;
const BG = [22, 21, 26];
const GOLD = [232, 178, 52], BRIGHT = [255, 214, 120], ASH = [150, 148, 142];
const NN = 170, THREADS = 10, X0 = 70, X1 = 730;

let ground, simFrame = 0;
let nodes = [], links = [], specks = [], dust = [], wave, fray = 1, nLinks = 0;

function init() {
  simFrame = 0; fray = 1;
  const ph = random(TWO_PI), cyc = random(1.2, 2.2), amp = random(25, 50), cy = random(370, 420);
  wave = x => cy + amp * sin(((x - X0) / (X1 - X0)) * TWO_PI * cyc + ph);
  // the crumpled line: its own wave buried under folds of noise
  nodes = [];
  for (let i = 0; i < NN; i++) {
    const u = i / (NN - 1), bx = X0 + u * (X1 - X0);
    const ends = sin(u * PI);                  // the ends stay closer to home
    nodes.push({
      bx, x: bx + (noise(u * 9, 3) - 0.5) * 160 * ends,
      y: wave(bx) + (noise(u * 7, 7) - 0.5) * 650 * ends + (noise(u * 30, 1) - 0.5) * 110 * ends,
      vx: 0, vy: 0, glow: 0, free: false,
    });
  }
  // static around the line, much of it tied to it
  dust = []; links = [];
  for (let k = 0; k < 2200; k++) {
    const n = nodes[floor(random(NN))];
    const p = { x: n.x + randomGaussian() * 70, y: n.y + randomGaussian() * 60, s: random(0.7, 2), a: random(90, 220) };
    dust.push(p);
    if (k < 460) {
      let best = 0, bd = 1e9;
      for (let i = 0; i < NN; i++) { const d = (nodes[i].x - p.x) ** 2 + (nodes[i].y - p.y) ** 2; if (d < bd) { bd = d; best = i; } }
      links.push({ i: best, p, rest: Math.sqrt(bd), str: random(4, 50), alive: true, cut: -1 });
    }
  }
  nLinks = links.length;
  // the line's own light, scattered out in the noise
  specks = [];
  for (let k = 0; k < 180; k++) {
    const i = floor(random(2, NN - 2)), n = nodes[i];
    specks.push({ i, x: n.x + randomGaussian() * 90, y: n.y + randomGaussian() * 80, home: false });
  }
}

function step(f) {
  if (f < HOLD_START) return;
  const t = min(1, (f - HOLD_START) / 480);
  const stiff = 0.002 + 0.045 * t * t;              // the will to return to its own form
  const rest = (X1 - X0) / (NN - 1);
  for (let i = 1; i < NN - 1; i++) {
    const n = nodes[i], a = nodes[i - 1], b = nodes[i + 1];
    let fx = (a.x + b.x) / 2 - n.x, fy = (a.y + b.y) / 2 - n.y;      // bending: smooth out
    fx *= 0.25; fy *= 0.25;
    for (const m of [a, b]) {                                        // stretching: keep spacing
      const dx = m.x - n.x, dy = m.y - n.y, d = Math.sqrt(dx * dx + dy * dy) + 1e-6, e = (d - rest) / d;
      fx += dx * e * 0.08; fy += dy * e * 0.08;
    }
    fx += (n.bx - n.x) * stiff; fy += (wave(n.bx) - n.y) * stiff;   // its own rhythm
    n.vx = (n.vx + fx) * 0.82; n.vy = (n.vy + fy) * 0.82;
  }
  // ties to the static drag the line; past its strength, a tie just ends
  for (const L of links) {
    if (!L.alive) continue;
    const n = nodes[L.i], dx = L.p.x - n.x, dy = L.p.y - n.y, d = Math.sqrt(dx * dx + dy * dy);
    n.vx += dx * 0.005; n.vy += dy * 0.005;
    L.str -= 0.03 + 0.16 * t;
    if (d > L.rest + L.str || L.str < 0) { L.alive = false; L.cut = f; }
  }
  for (let i = 1; i < NN - 1; i++) { nodes[i].x += nodes[i].vx; nodes[i].y += nodes[i].vy; }
  const tied = new Uint16Array(NN); let alive = 0;
  for (const L of links) if (L.alive) { tied[L.i]++; alive++; }
  for (let i = 0; i < NN; i++) nodes[i].free = tied[i] === 0;
  // a free node calls its light back
  let away = 0;
  for (const s of specks) {
    if (s.home) continue;
    away++;
    const n = nodes[s.i];
    if (!n.free) continue;
    s.x += (n.x - s.x) * 0.05; s.y += (n.y - s.y) * 0.05;
    if (Math.abs(n.x - s.x) + Math.abs(n.y - s.y) < 3) { s.home = true; for (let k = -3; k <= 3; k++) { const m = nodes[s.i + k]; if (m) m.glow += 1 - Math.abs(k) / 4; } }
  }
  fray = 0.65 * (alive / nLinks) + 0.35 * (away / specks.length);
}

function normalAt(i) {
  const a = nodes[max(0, i - 1)], b = nodes[min(NN - 1, i + 1)];
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
  return [-dy / d, dx / d];
}

function render(f) {
  // static: always noisy
  noStroke();
  for (const p of dust) { fill(...ASH, p.a); circle(p.x + (Math.random() - 0.5) * 1.5, p.y + (Math.random() - 0.5) * 1.5, p.s); }
  // ties, and the stubs of the ones just cut
  strokeWeight(0.6);
  for (const L of links) {
    const n = nodes[L.i];
    if (L.alive) { stroke(...ASH, 110); line(n.x, n.y, L.p.x, L.p.y); }
    else if (f - L.cut < 30) { const k = (f - L.cut) / 30, mx = lerp(L.p.x, n.x, 0.5 * (1 - k)), my = lerp(L.p.y, n.y, 0.5 * (1 - k)); stroke(...ASH, 110 * (1 - k)); line(L.p.x, L.p.y, mx, my); }
  }
  // its own specks
  noStroke();
  for (const s of specks) if (!s.home) { fill(...GOLD, 200); circle(s.x, s.y, 2.2); }
  // the line: frayed threads that close into one band as it frees itself
  const calm = 1 - fray, gold = color(...GOLD), ash = color(...ASH);
  noFill();
  for (let k = 0; k < THREADS; k++) {
    const c = lerpColor(ash, gold, 0.35 + 0.65 * calm);
    stroke(red(c), green(c), blue(c), 90 + 60 * calm); strokeWeight(0.8);
    beginShape();
    for (let i = 0; i < NN; i++) {
      const n = nodes[i], [nx, ny] = normalAt(i);
      const o = (k - (THREADS - 1) / 2) * (0.7 + 0.5 * calm) + (noise(i * 0.12, k * 3.1, f * 0.01) - 0.5) * 26 * fray;
      vertex(n.x + nx * o, n.y + ny * o);
    }
    endShape();
  }
  // edges: sharp, solid, brighter where its light came back
  if (calm > 0.35) {
    const e = constrain((calm - 0.35) / 0.55, 0, 1), half = 4 + 1.5 * e;
    for (const side of [-1, 1]) {
      beginShape();
      for (let i = 0; i < NN; i++) { const n = nodes[i], [nx, ny] = normalAt(i); vertex(n.x + nx * half * side, n.y + ny * half * side); }
      stroke(...BRIGHT, 255 * e); strokeWeight(1 + 1.6 * e); endShape();
    }
    for (let i = 0; i < NN - 1; i++) {
      const g = min(1, (nodes[i].glow + nodes[i + 1].glow) / 6);
      if (g <= 0) continue;
      stroke(...BRIGHT, 120 * g * e); strokeWeight(2.5); line(nodes[i].x, nodes[i].y, nodes[i + 1].x, nodes[i + 1].y);
    }
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
