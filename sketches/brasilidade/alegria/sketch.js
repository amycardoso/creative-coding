/**
 * Alegria
 *
 * A generative Brazilian pop-art mosaic in the joyful spirit of Romero Britto —
 * thick black outlines carving the canvas into organic patchwork cells of flat,
 * super-saturated tropical colour, each packed with decorative pattern, then
 * strewn with bold motifs (flowers, suns, hearts, leaves, stars) and confetti.
 * Brasilidade as pure celebration: colour, abundance, festa.
 *
 * Each load is a unique composition.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE or click for a new composition
 */

const WIDTH = 800;
const HEIGHT = 800;

const PAL = [
  [255, 46, 136],  // hot pink
  [229, 24, 154],  // magenta
  [22, 198, 198],  // turquoise
  [0, 167, 225],   // cyan
  [255, 209, 26],  // yellow
  [255, 122, 26],  // orange
  [255, 59, 48],   // red
  [142, 216, 26],  // lime
  [0, 166, 81],    // green
  [138, 79, 255],  // purple
  [35, 86, 214],   // blue
];
const INK = [20, 18, 22];
const CREAM = [248, 240, 222];

let seed = 3;
let rnd; // current seeded RNG, reset at the top of every draw for determinism

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rr = (a, b) => a + rnd() * (b - a);
const ri = (a, b) => a + ((rnd() * (b - a + 1)) | 0);
const pick = (a) => a[(rnd() * a.length) | 0];
const setFill = (c) => fill(c[0], c[1], c[2]);
const setStroke = (c) => stroke(c[0], c[1], c[2]);
const diffColor = (c) => { let x; do { x = pick(PAL); } while (x === c); return x; };

// --- patchwork --------------------------------------------------------------
function buildLattice() {
  const C = ri(4, 6), R = ri(4, 6);
  const cw = WIDTH / C, ch = HEIGHT / R;
  const P = [];
  for (let r = 0; r <= R; r++) {
    P[r] = [];
    for (let c = 0; c <= C; c++) {
      const edge = r === 0 || r === R || c === 0 || c === C;
      P[r][c] = {
        x: c * cw + (edge ? 0 : rr(-0.32, 0.32) * cw),
        y: r * ch + (edge ? 0 : rr(-0.32, 0.32) * ch),
      };
      if (c === 0) P[r][c].x = 0; if (c === C) P[r][c].x = WIDTH;
      if (r === 0) P[r][c].y = 0; if (r === R) P[r][c].y = HEIGHT;
    }
  }
  // Control points for curved, shared edges (border edges stay straight).
  const ctrl = (A, B, straight) => {
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    if (straight) return { x: mx, y: my };
    let nx = -(B.y - A.y), ny = B.x - A.x;
    const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
    const b = rr(-0.18, 0.18) * len;
    const Mx = mx + nx * b, My = my + ny * b;
    return { x: 2 * Mx - mx, y: 2 * My - my };
  };
  const Hc = [], Vc = [];
  for (let r = 0; r <= R; r++) { Hc[r] = []; for (let c = 0; c < C; c++) Hc[r][c] = ctrl(P[r][c], P[r][c + 1], r === 0 || r === R); }
  for (let r = 0; r < R; r++) { Vc[r] = []; for (let c = 0; c <= C; c++) Vc[r][c] = ctrl(P[r][c], P[r + 1][c], c === 0 || c === C); }
  return { R, C, P, Hc, Vc };
}

function cellPath(L, r, c) {
  const A = L.P[r][c], B = L.P[r][c + 1], Cc = L.P[r + 1][c + 1], D = L.P[r + 1][c];
  return {
    start: A,
    segs: [
      { cx: L.Hc[r][c].x, cy: L.Hc[r][c].y, x: B.x, y: B.y },          // top
      { cx: L.Vc[r][c + 1].x, cy: L.Vc[r][c + 1].y, x: Cc.x, y: Cc.y }, // right
      { cx: L.Hc[r + 1][c].x, cy: L.Hc[r + 1][c].y, x: D.x, y: D.y },   // bottom (rev)
      { cx: L.Vc[r][c].x, cy: L.Vc[r][c].y, x: A.x, y: A.y },           // left (rev)
    ],
    corners: [A, B, Cc, D],
  };
}

function tracePath(path) {
  beginShape();
  vertex(path.start.x, path.start.y);
  for (const s of path.segs) quadraticVertex(s.cx, s.cy, s.x, s.y);
  endShape(CLOSE);
}

function clipToPath(path, fn) {
  const ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(path.start.x, path.start.y);
  for (const s of path.segs) ctx.quadraticCurveTo(s.cx, s.cy, s.x, s.y);
  ctx.closePath();
  ctx.clip();
  fn();
  ctx.restore();
}

function fillPattern(kind, x0, y0, x1, y1, col, base) {
  strokeJoin(ROUND); strokeCap(ROUND);
  if (kind === 'dots') {
    noStroke(); setFill(col);
    for (let y = y0; y < y1; y += 28) for (let x = x0; x < x1; x += 28) circle(x, y, 9);
  } else if (kind === 'stripes') {
    setStroke(col); strokeWeight(8);
    for (let d = x0 - (y1 - y0); d < x1; d += 26) line(d, y0, d + (y1 - y0), y1);
  } else if (kind === 'vstripes') {
    setStroke(col); strokeWeight(9);
    for (let x = x0; x < x1; x += 26) line(x, y0, x, y1);
  } else if (kind === 'rings') {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; noFill(); setStroke(col); strokeWeight(7);
    for (let rad = 18; rad < Math.hypot(x1 - x0, y1 - y0); rad += 22) circle(cx, cy, rad * 2);
  } else if (kind === 'checker') {
    noStroke();
    for (let y = y0, j = 0; y < y1; y += 32, j++) for (let x = x0, i = 0; x < x1; x += 32, i++) {
      if ((i + j) % 2 === 0) { setFill(col); rect(x, y, 32, 32); }
    }
  } else if (kind === 'chevron') {
    setStroke(col); strokeWeight(7); noFill();
    for (let y = y0; y < y1 + 40; y += 30) {
      beginShape();
      for (let x = x0; x < x1; x += 30) vertex(x, y + ((Math.floor(x / 30) % 2) ? 16 : -16));
      endShape();
    }
  } else if (kind === 'waves') {
    setStroke(col); strokeWeight(6); noFill();
    for (let y = y0; y < y1; y += 26) {
      beginShape();
      for (let x = x0; x <= x1; x += 8) vertex(x, y + Math.sin(x * 0.05) * 7);
      endShape();
    }
  }
  // 'solid' draws nothing extra (lets the eye rest)
  void base;
}

function drawPatchwork(L) {
  const PATTERNS = ['dots', 'stripes', 'vstripes', 'rings', 'checker', 'chevron', 'waves', 'solid', 'solid'];
  const idx = []; // colour index per cell, avoiding left/top neighbour
  for (let r = 0; r < L.R; r++) {
    idx[r] = [];
    for (let c = 0; c < L.C; c++) {
      const banned = new Set([idx[r][c - 1], r > 0 ? idx[r - 1][c] : -1]);
      let k; do { k = (rnd() * PAL.length) | 0; } while (banned.has(k));
      idx[r][c] = k;
      const path = cellPath(L, r, c);
      const col = PAL[k];
      const xs = path.corners.map((p) => p.x), ys = path.corners.map((p) => p.y);
      const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30;
      const y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30;

      noStroke(); setFill(col); tracePath(path);                       // flat colour
      const pcol = rnd() < 0.4 ? INK : (rnd() < 0.5 ? CREAM : diffColor(col));
      clipToPath(path, () => fillPattern(pick(PATTERNS), x0, y0, x1, y1, pcol, col));
      noFill(); setStroke(INK); strokeWeight(6); strokeJoin(ROUND); tracePath(path); // outline
    }
  }
}

// --- motifs -----------------------------------------------------------------
function outlined(fn, col, w = 4) {
  setFill(col); stroke(INK[0], INK[1], INK[2]); strokeWeight(w); strokeJoin(ROUND); fn();
}

function mFlower(x, y, r) {
  const petCol = pick(PAL), ctrCol = diffColor(petCol), n = ri(6, 9);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TWO_PI;
    push(); translate(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); rotate(a);
    outlined(() => ellipse(0, 0, r * 0.55, r * 0.95), petCol); pop();
  }
  outlined(() => circle(x, y, r * 0.7), ctrCol, 4);
  noStroke(); setFill(INK);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TWO_PI; circle(x + Math.cos(a) * r * 0.18, y + Math.sin(a) * r * 0.18, 7); }
}

function mSun(x, y, r) {
  const disc = pick([PAL[4], PAL[5]]), rayCol = diffColor(disc), n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TWO_PI;
    outlined(() => {
      beginShape();
      vertex(x + Math.cos(a - 0.13) * r * 0.7, y + Math.sin(a - 0.13) * r * 0.7);
      vertex(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15);
      vertex(x + Math.cos(a + 0.13) * r * 0.7, y + Math.sin(a + 0.13) * r * 0.7);
      endShape(CLOSE);
    }, rayCol, 3);
  }
  outlined(() => circle(x, y, r * 1.4), disc, 5);
}

function mHeart(x, y, r) {
  const col = pick([PAL[0], PAL[1], PAL[6]]);
  outlined(() => {
    beginShape();
    vertex(x, y + r * 0.5);
    bezierVertex(x - r, y - r * 0.4, x - r * 0.5, y - r, x, y - r * 0.35);
    bezierVertex(x + r * 0.5, y - r, x + r, y - r * 0.4, x, y + r * 0.5);
    endShape(CLOSE);
  }, col, 5);
  noStroke(); setFill(CREAM);
  for (let i = 0; i < 5; i++) circle(x + rr(-r * 0.4, r * 0.4), y + rr(-r * 0.3, r * 0.2), 8);
}

function mTarget(x, y, r) {
  const a = pick(PAL), b = diffColor(a);
  for (let k = 0, rad = r; rad > 8; rad -= r / 5, k++) outlined(() => circle(x, y, rad * 2), k % 2 ? a : b, 4);
}

function mLeaf(x, y, r) {
  const col = pick([PAL[7], PAL[8], PAL[2]]), a = rr(0, TWO_PI);
  push(); translate(x, y); rotate(a);
  outlined(() => {
    beginShape();
    vertex(0, -r);
    bezierVertex(r * 0.7, -r * 0.4, r * 0.7, r * 0.4, 0, r);
    bezierVertex(-r * 0.7, r * 0.4, -r * 0.7, -r * 0.4, 0, -r);
    endShape(CLOSE);
  }, col, 4);
  stroke(INK[0], INK[1], INK[2]); strokeWeight(3); line(0, -r * 0.85, 0, r * 0.85);
  for (let t = -0.6; t <= 0.6; t += 0.3) line(0, t * r, Math.sign(0.5) * r * 0.45, t * r + r * 0.18 * (t < 0 ? -1 : 1));
  pop();
}

function mStar(x, y, r) {
  const col = pick(PAL);
  outlined(() => {
    beginShape();
    for (let i = 0; i < 10; i++) {
      const a = -HALF_PI + (i / 10) * TWO_PI, rad = i % 2 ? r * 0.45 : r;
      vertex(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    endShape(CLOSE);
  }, col, 4);
}

function mBubbles(x, y, r) {
  const a = pick(PAL), b = diffColor(a);
  outlined(() => circle(x, y, r * 2), a, 5);
  noStroke(); setFill(b);
  for (let i = 0; i < 14; i++) { const ang = rr(0, TWO_PI), d = rr(0, r * 0.7); circle(x + Math.cos(ang) * d, y + Math.sin(ang) * d, rr(8, 16)); }
}

function drawMotifs(L) {
  const MOTIFS = [mFlower, mSun, mHeart, mTarget, mLeaf, mStar, mBubbles];
  // jittered 3x3 anchor grid, shuffled
  const anchors = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    anchors.push({ x: (c + 0.5) / 3 * WIDTH + rr(-70, 70), y: (r + 0.5) / 3 * HEIGHT + rr(-70, 70) });
  for (let i = anchors.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0;[anchors[i], anchors[j]] = [anchors[j], anchors[i]]; }
  const n = ri(6, 8);
  for (let i = 0; i < n; i++) {
    const a = anchors[i], r = rr(55, 115);
    noStroke(); fill(INK[0], INK[1], INK[2], 38); circle(a.x + 6, a.y + 7, r * 2.1); // soft shadow
    pick(MOTIFS)(a.x, a.y, r);
  }
  void L;
}

function drawConfetti() {
  const n = ri(34, 50);
  for (let i = 0; i < n; i++) {
    const x = rr(20, WIDTH - 20), y = rr(20, HEIGHT - 20), s = rr(7, 16), col = pick(PAL);
    const t = ri(0, 2);
    setFill(col); stroke(INK[0], INK[1], INK[2]); strokeWeight(2.5); strokeJoin(ROUND);
    if (t === 0) circle(x, y, s);
    else if (t === 1) {
      beginShape();
      for (let k = 0; k < 10; k++) { const a = -HALF_PI + (k / 10) * TWO_PI, rad = k % 2 ? s * 0.4 : s * 0.9; vertex(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
      endShape(CLOSE);
    } else { strokeWeight(s * 0.4); setStroke(col); line(x - s, y, x + s, y); }
  }
}

function grain() {
  noStroke();
  for (let i = 0; i < 5000; i++) {
    fill(255, 255, 255, 10); rect(rr(0, WIDTH), rr(0, HEIGHT), 1, 1);
    fill(0, 0, 0, 10); rect(rr(0, WIDTH), rr(0, HEIGHT), 1, 1);
  }
}

// --- main -------------------------------------------------------------------
function setup() {
  const cnv = createCanvas(WIDTH, HEIGHT);
  cnv.parent('canvas-container');
  pixelDensity(1);
  const p = new URLSearchParams(window.location.search);
  if (p.has('seed')) seed = parseInt(p.get('seed'), 10) || seed;
  noLoop();
}

function draw() {
  rnd = mulberry32(Math.floor(seed) || 1);
  background(CREAM[0], CREAM[1], CREAM[2]);
  const L = buildLattice();
  drawPatchwork(L);
  drawMotifs(L);
  drawConfetti();
  grain();
  noFill(); stroke(INK[0], INK[1], INK[2]); strokeWeight(16); rect(8, 8, WIDTH - 16, HEIGHT - 16); // bold frame
}

function newComposition() { seed = Math.floor(Math.random() * 1e9); redraw(); }
function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('alegria', 'png');
  else if (key === ' ') newComposition();
}
function mousePressed() { if (mouseX >= 0 && mouseX < WIDTH && mouseY >= 0 && mouseY < HEIGHT) newComposition(); }
