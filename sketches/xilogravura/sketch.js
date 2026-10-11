/**
 * Xilogravura
 *
 * Resistance, Brazil, October 2026. A cordel woodcut that carves itself.
 * A red sun is printed first; then the black block lands on the paper and an
 * invisible gouge starts cutting: the sun opens, its rays split the block,
 * the sky is carved line by line, and a crowd emerges from the solid black,
 * one figure at a time. Once everyone is there, the fists go up in a wave.
 * Then the sheet is lifted and a new print begins.
 *
 * After the xilogravura of the Northeast (J. Borges and the cordel covers),
 * the woodcuts of Käthe Kollwitz and the posters of the Atelier Populaire.
 * Written between the first round (4 Oct 2026) and the runoff (25 Oct 2026).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new print (new crowd, new cuts)
 */

const W = 800, H = 800;
const TAU = Math.PI * 2;

const PAPER = [236, 228, 208];
const INK = [22, 20, 18];
const RED = [196, 38, 30];
const TITLE = 'AINDA ESTAMOS AQUI';

// Print area (the woodblock) and the sun.
const M = 56, X0 = M, Y0 = M, X1 = W - M, Y1 = H - M - 70;
const SUN_X = W * 0.5, SUN_Y = Y0 + 210, SUN_R = 118;

// ---------- timeline (loop phase t in [0, 1)) ----------
const LOOP_SECONDS = 24;
const T_RED = [0.02, 0.07];      // red block printed
const T_BLOCK = [0.06, 0.12];    // black block lands
const T_SUN = [0.12, 0.16];      // sun disc opens
const T_RAYS = [0.15, 0.23];     // rays cut
const T_SKY = [0.20, 0.43];      // sky carved outward from the sun
const T_CROWD = [0.42, 0.61];    // figures emerge, back row to front
const T_RISE = [0.62, 0.73];     // fists go up, left to right
const T_FADE = [0.89, 0.99];     // sheet lifted

let seed = 1964;
let paper, redLayer, specks, block;
let rays = [], sky = [], crowd = [];
let frame = 0;

// ---------- helpers ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, [a, b]) => clamp01((t - a) / (b - a));
const ease = (u) => u * u * (3 - 2 * u);

// A tapered gouge cut, stored as two edges so it can be drawn partially.
function makeGouge(x1, y1, x2, y2, w, wob = 1.2) {
  const n = 18, L = dist(x1, y1, x2, y2);
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux;
  const left = [], right = [];
  const s = random(1000);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const half = 0.5 * w * Math.pow(Math.sin(PI * u), 0.55) * (0.8 + 0.4 * noise(s + u * 3));
    const off = (noise(s + 50 + u * 2) - 0.5) * wob * 2;
    const px = x1 + (x2 - x1) * u + nx * off, py = y1 + (y2 - y1) * u + ny * off;
    left.push([px + nx * half, py + ny * half]);
    right.push([px - nx * half, py - ny * half]);
  }
  return { left, right };
}

// Draw the first fraction u of a gouge, as if the tool were still moving.
function cut(g, gouge, u) {
  if (u <= 0) return;
  const m = Math.max(1, Math.round(u * (gouge.left.length - 1)));
  g.beginShape();
  for (let i = 0; i <= m; i++) g.vertex(...gouge.left[i]);
  for (let i = m; i >= 0; i--) g.vertex(...gouge.right[i]);
  g.endShape(CLOSE);
}

// ---------- the print, built once per seed ----------
function buildPrint() {
  randomSeed(seed);
  noiseSeed(seed);

  // release the previous print's buffers (SPACE rebuilds)
  for (const g of [paper, redLayer, specks]) if (g) g.remove();
  paper = createGraphics(W, H);
  paper.pixelDensity(1);
  paper.background(...PAPER);
  for (let i = 0; i < 9000; i++) {
    paper.stroke(120, 100, 70, random(4, 14));
    const x = random(W), y = random(H), a = random(TAU);
    paper.line(x, y, x + cos(a) * random(2, 7), y + sin(a) * random(2, 7));
  }

  // Red block: the sun, slightly off-register like a hand pull.
  redLayer = createGraphics(W, H);
  redLayer.pixelDensity(1);
  redLayer.noStroke();
  redLayer.fill(...RED);
  redLayer.circle(SUN_X + 3, SUN_Y - 2, SUN_R * 2 + 4);
  for (let i = 0; i < 1400; i++) {
    const a = random(TAU), rr = sqrt(random()) * SUN_R;
    redLayer.fill(...PAPER, random(20, 60));
    redLayer.circle(SUN_X + 3 + cos(a) * rr, SUN_Y - 2 + sin(a) * rr, random(1, 3));
  }

  // Specks where the block didn't take ink.
  specks = createGraphics(W, H);
  specks.pixelDensity(1);
  specks.noStroke();
  specks.fill(...PAPER);
  for (let i = 0; i < 5000; i++) {
    const x = random(X0, X1), y = random(Y0, Y1);
    if (noise(x * 0.01, y * 0.01) > 0.55) specks.circle(x, y, random(0.6, 2));
  }

  // Block outline with slightly rough edges.
  block = [];
  for (let t = 0; t <= 1; t += 0.01) block.push([lerp(X0, X1, t), Y0 + (noise(t * 8) - 0.5) * 4]);
  for (let t = 0; t <= 1; t += 0.01) block.push([X1 + (noise(9, t * 8) - 0.5) * 4, lerp(Y0, Y1, t)]);
  for (let t = 0; t <= 1; t += 0.01) block.push([lerp(X1, X0, t), Y1 + (noise(19, t * 8) - 0.5) * 4]);
  for (let t = 0; t <= 1; t += 0.01) block.push([X0 + (noise(29, t * 8) - 0.5) * 4, lerp(Y1, Y0, t)]);

  // Rays: alternating long and short wedges around the sun.
  rays = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU + 0.05;
    const r0 = SUN_R + 24, r1 = SUN_R + (i % 2 ? 120 : 190);
    const gouge = makeGouge(SUN_X + cos(a) * r0, SUN_Y + sin(a) * r0, SUN_X + cos(a) * r1, SUN_Y + sin(a) * r1, i % 2 ? 7 : 12, 0.6);
    rays.push({ gouge, order: (i * 11) % 28 / 28 });
  }

  // Sky: horizontal gouges, wider toward the sun, carved outward from it.
  sky = [];
  for (let y = Y0 + 14; y < Y0 + 420; y += 9) {
    let x = X0 + 10 + random(-6, 6);
    while (x < X1 - 14) {
      const len = random(40, 140);
      const x2 = min(x + len, X1 - 12);
      const d = abs(y - SUN_Y) / 260;
      const w = constrain(5.2 - d * 4, 1.2, 5.2) * random(0.8, 1.1);
      const gouge = makeGouge(x, y + random(-1, 1), x2, y + random(-1.5, 1.5), w);
      const far = dist((x + x2) / 2, y, SUN_X, SUN_Y) / 520;
      sky.push({ gouge, order: clamp01(far + random(-0.05, 0.05)) });
      x = x2 + random(6, 22);
    }
  }

  // Crowd: three rows, back to front.
  crowd = [];
  const rows = [
    { y: Y0 + 330, s: 0.62, n: 15 },
    { y: Y0 + 372, s: 0.85, n: 11 },
    { y: Y0 + 430, s: 1.15, n: 7 },
  ];
  const total = rows.reduce((a, r) => a + r.n, 0);
  let k = 0;
  for (const row of rows) {
    for (let i = 0; i < row.n; i++, k++) {
      const x = lerp(X0 + 20, X1 - 20, (i + 0.5) / row.n) + random(-10, 10);
      const y = row.y + random(-8, 8);
      const s = row.s * random(0.92, 1.08);
      const kind = random();
      const arms = [];
      if (kind < 0.75) arms.push({ side: random() < 0.5 ? -1 : 1, len: random(70, 95), spread: random(8, 26), ph: random() });
      if (kind < 0.3) arms.push({ side: -arms[0].side, len: random(60, 90), spread: random(10, 30), ph: random() });
      const top = y + 30 * s;
      const folds = [makeGouge(x - 26 * s, top + 8 * s, x - 10 * s, top + 2 * s, 3.2 * s)];
      for (let j = 0; j < 3; j++) {
        const fx = x + random(-18, 18) * s;
        folds.push(makeGouge(fx, top + random(26, 40) * s, fx + random(-4, 4), top + random(70, 110) * s, 2.6 * s));
      }
      crowd.push({ x, y, s, arms, folds, order: k / total, riseAt: (x - X0) / (X1 - X0) });
    }
  }
}

// ---------- figures ----------
// Arm endpoint: lowered along the body (r = 0) or raised as a fist (r = 1).
function armEnd(f, a, r, t) {
  const s = f.s;
  const downA = Math.atan2(45, a.side * 8), downL = 45;
  let upA = Math.atan2(-a.len, a.side * a.spread), upL = Math.hypot(a.len, a.spread);
  // once raised, fists pump in a slow rhythm (integer cycles, so the loop is seamless)
  upA += 0.07 * a.side * Math.sin(TAU * (3 * t + a.ph)) * ease(span(t, [T_RISE[1] - 0.02, T_RISE[1] + 0.03]));
  let d = upA - downA;
  if (a.side > 0 && d > 0) d -= TAU; // right arm swings out through the right
  if (a.side < 0 && d < 0) d += TAU; // left arm through the left
  const ang = downA + d * r, len = lerp(downL, upL, r) * s;
  return [Math.cos(ang) * len, Math.sin(ang) * len];
}

function figure(g, f, r, t, grow) {
  const { x, y, s } = f;
  g.noStroke();
  g.circle(x, y + 13 * s, (13 * s + grow) * 2);
  const sw = 30 * s + grow, top = y + 30 * s;
  g.beginShape();
  g.vertex(x - 9 * s - grow * 0.5, top - 4 * s);
  g.vertex(x + 9 * s + grow * 0.5, top - 4 * s);
  g.bezierVertex(x + sw, top, x + sw + 2 * s, top + 10 * s, x + sw + 4 * s, top + 40 * s);
  g.vertex(x + sw + 8 * s, H);
  g.vertex(x - sw - 8 * s, H);
  g.vertex(x - sw - 4 * s, top + 40 * s);
  g.bezierVertex(x - sw - 2 * s, top + 10 * s, x - sw, top, x - 9 * s - grow * 0.5, top - 4 * s);
  g.endShape(CLOSE);
  for (const a of f.arms) {
    const sx = x + a.side * (sw - grow - 6 * s), sy = top + 10 * s;
    const [dx, dy] = armEnd(f, a, r, t);
    g.stroke(...INK);
    g.strokeWeight(15 * s + grow * 2);
    g.line(sx, sy, sx + dx, sy + dy);
    g.noStroke();
    g.circle(sx + dx * 1.04, sy + dy * 1.04, 22 * s + grow * 2);
  }
}

// ---------- render ----------
let comp;

function renderPhase(t) {
  image(paper, 0, 0);

  const aRed = ease(span(t, T_RED));
  if (aRed > 0) { tint(255, aRed * 255); image(redLayer, 0, 0); noTint(); }

  const aBlock = ease(span(t, T_BLOCK));
  if (aBlock > 0) {
    comp.clear();
    comp.noStroke();
    comp.fill(...INK);
    comp.beginShape();
    for (const p of block) comp.vertex(...p);
    comp.endShape(CLOSE);

    comp.erase();
    // sky first (it lies behind the sun's rays)
    const uSky = span(t, T_SKY);
    for (const c of sky) cut(comp, c.gouge, clamp01((uSky - c.order * 0.85) / 0.15));
    // sun disc opens from the centre
    const uSun = ease(span(t, T_SUN));
    if (uSun > 0) comp.circle(SUN_X, SUN_Y, (SUN_R * 2 + 26) * uSun);
    const uRays = span(t, T_RAYS);
    for (const c of rays) cut(comp, c.gouge, clamp01((uRays - c.order * 0.7) / 0.3));
    comp.noErase();
    if (uSun >= 1) { // black ring left standing inside the sun
      comp.noFill(); comp.stroke(...INK); comp.strokeWeight(5);
      comp.circle(SUN_X, SUN_Y, SUN_R * 2 + 10);
      comp.noStroke();
    }

    // crowd: each figure is carved out of the black with a halo, then folds
    const uCrowd = span(t, T_CROWD);
    for (const f of crowd) {
      const u = clamp01((uCrowd - f.order * 0.85) / 0.15);
      if (u <= 0) continue;
      const r = ease(clamp01((span(t, T_RISE) - f.riseAt * 0.6) / 0.4));
      comp.strokeCap(ROUND);
      comp.erase(255 * ease(u), 255 * ease(u)); figure(comp, f, r, t, 5); comp.noErase();
      comp.fill(...INK); figure(comp, f, r, t, 0);
      comp.noStroke();
      comp.erase();
      for (const fold of f.folds) cut(comp, fold, clamp01(u * 1.6 - 0.6));
      comp.noErase();
    }
    // bodies end at the edge of the block
    comp.erase(); comp.rect(0, Y1 + 2, W, H); comp.noErase();

    tint(255, aBlock * 255);
    image(comp, 0, 0);
    image(specks, 0, 0);
    noTint();

    // title, printed with the block
    fill(...INK, aBlock * 255);
    noStroke();
    textFont('Anton, Impact, sans-serif');
    textAlign(CENTER, CENTER);
    textSize(52);
    text(TITLE, W / 2, Y1 + 38);
  }

  // the sheet is lifted: back to blank paper
  const aFade = ease(span(t, T_FADE));
  if (aFade > 0) { tint(255, aFade * 255); image(paper, 0, 0); noTint(); }
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 60;
const LOOP_FRAMES = LOOP_SECONDS * FPS;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  comp = createGraphics(W, H);
  comp.pixelDensity(1);
  buildPrint();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    noLoop();
    await document.fonts.load('52px Anton');
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
  if (key === 's' || key === 'S') saveCanvas('xilogravura', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    buildPrint();
  }
}
