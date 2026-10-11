/**
 * Marajoara
 *
 * After the pre-Columbian ceramic art of Marajó Island, at the mouth of the
 * Amazon (c. 400–1300 CE): elaborate funerary urns and bowls carved and painted
 * with interlocking spirals, square scrolls (grecas), labyrinth frets, and
 * stylised serpents in red and black on a buff slip. Brazil's deepest visual
 * root — brasilidade reaching back to its indigenous origins, long before the
 * modernists or the colony.
 *
 * Each load is a unique panel of registers, like the rolled-out surface of a pot.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE or click for a new vessel
 */

const WIDTH = 800;
const HEIGHT = 800;

const CREAM = [231, 214, 178];
const RED = [171, 68, 41];
const DARK = [30, 19, 12];
const OCHRE = [199, 138, 64];

let seed = 7;
let rnd;

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
const sf = (c) => fill(c[0], c[1], c[2]);
const ss = (c) => stroke(c[0], c[1], c[2]);

// --- motif: round volute (interlocking spiral scroll) -----------------------
function roundSpiral(cx, cy, R, dir, w) {
  noFill(); ss(DARK); strokeWeight(w); strokeJoin(ROUND); strokeCap(ROUND);
  beginShape();
  const turns = 2.4;
  for (let a = 0; a <= turns * TWO_PI; a += 0.25) {
    const r = R * (1 - a / (turns * TWO_PI));
    vertex(cx + Math.cos(a * dir) * r, cy + Math.sin(a * dir) * r);
  }
  endShape();
}

function spiralBand(x0, y0, x1, y1, bg) {
  noStroke(); sf(bg); rect(x0, y0, x1 - x0, y1 - y0);
  const h = y1 - y0, cy = (y0 + y1) / 2, R = h * 0.36;
  const n = Math.max(2, Math.round((x1 - x0) / (h * 0.92)));
  const tw = (x1 - x0) / n, w = Math.max(3, h * 0.07);
  // running baseline connecting the volutes
  ss(DARK); strokeWeight(w); line(x0, cy, x1, cy);
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * tw;
    roundSpiral(cx, cy, R, i % 2 ? 1 : -1, w);
    // red dots in the spiral eyes
    noStroke(); sf(RED); circle(cx, cy, w * 1.4);
  }
}

// --- motif: stepped pyramids (escalonado) -----------------------------------
function stepBand(x0, y0, x1, y1, bg) {
  noStroke(); sf(bg); rect(x0, y0, x1 - x0, y1 - y0);
  const h = y1 - y0, w = Math.max(2, h * 0.05);
  const n = Math.max(3, Math.round((x1 - x0) / (h * 0.85)));
  const tw = (x1 - x0) / n, levels = 4, step = h / levels, halfBase = tw * 0.46;
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * tw, up = i % 2 === 0;
    for (let L = 0; L < levels; L++) {
      const ww = halfBase * 2 * (1 - L / levels);
      const yy = up ? y1 - (L + 1) * step : y0 + L * step;
      sf(L % 2 ? RED : OCHRE); ss(DARK); strokeWeight(w); strokeJoin(MITER);
      rect(cx - ww / 2, yy, ww, step);
    }
  }
}

// --- motif: triangle dogtooth with inner hatch ------------------------------
function triangleBand(x0, y0, x1, y1, bg) {
  noStroke(); sf(bg); rect(x0, y0, x1 - x0, y1 - y0);
  const h = y1 - y0, w = Math.max(2, h * 0.07);
  const n = Math.max(3, Math.round((x1 - x0) / (h * 0.7)));
  const tw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * tw, xb = xa + tw, up = i % 2 === 0;
    sf(up ? RED : OCHRE); ss(DARK); strokeWeight(w); strokeJoin(ROUND);
    if (up) triangle(xa, y1, xb, y1, (xa + xb) / 2, y0);
    else triangle(xa, y0, xb, y0, (xa + xb) / 2, y1);
  }
}

// --- motif: concentric lozenges ---------------------------------------------
function diamondBand(x0, y0, x1, y1, bg) {
  noStroke(); sf(bg); rect(x0, y0, x1 - x0, y1 - y0);
  const h = y1 - y0, cy = (y0 + y1) / 2, w = Math.max(2, h * 0.05);
  const n = Math.max(2, Math.round((x1 - x0) / (h * 0.85)));
  const tw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * tw;
    const cols = [RED, CREAM, DARK, RED];
    for (let k = 0, r = h * 0.46; r > h * 0.06; r -= h * 0.12, k++) {
      sf(cols[k % cols.length]); ss(DARK); strokeWeight(w); strokeJoin(ROUND);
      quad(cx, cy - r, cx + r * 0.85, cy, cx, cy + r, cx - r * 0.85, cy);
    }
  }
}

// --- divider: hatched strip with rule lines ---------------------------------
function hatchDivider(x0, y0, x1, y1) {
  noStroke(); sf(RED); rect(x0, y0, x1 - x0, y1 - y0);
  ss(DARK); strokeWeight(Math.max(1.5, (y1 - y0) * 0.16));
  for (let x = x0 - (y1 - y0); x < x1; x += (y1 - y0) * 0.7) line(x, y1, x + (y1 - y0), y0);
  strokeWeight(Math.max(2, (y1 - y0) * 0.18)); line(x0, y0, x1, y0); line(x0, y1, x1, y1);
}

function ruleLines(x0, y, x1, w) { ss(DARK); strokeWeight(w); line(x0, y, x1, y); }

// --- composition ------------------------------------------------------------
function draw() {
  rnd = mulberry32(Math.floor(seed) || 1);
  background(CREAM[0], CREAM[1], CREAM[2]);

  const M = 46;
  const x0 = M, x1 = WIDTH - M;
  let y = M;
  const innerH = HEIGHT - 2 * M;

  const mains = [spiralBand, stepBand, triangleBand, diamondBand];
  const nMain = ri(3, 4);
  const divH = 22;
  const nDiv = nMain + 1;
  const mainTotal = innerH - nDiv * divH;
  let prev = -1;

  for (let b = 0; b < nMain; b++) {
    hatchDivider(x0, y, x1, y + divH); y += divH;
    let mh = mainTotal / nMain;
    // pick a motif different from the previous band
    let mi; do { mi = ri(0, mains.length - 1); } while (mi === prev); prev = mi;
    const bg = b % 2 === 0 ? CREAM : [216, 196, 158];
    mains[mi](x0, y, x0 + (x1 - x0), y + mh, bg);
    ss(DARK); strokeWeight(3); noFill(); rect(x0, y, x1 - x0, mh); // band outline
    y += mh;
  }
  hatchDivider(x0, y, x1, y + divH);

  // bold outer frame, like the rim of a vessel
  noFill(); ss(DARK); strokeWeight(10); rect(M - 8, M - 8, WIDTH - 2 * (M - 8), HEIGHT - 2 * (M - 8));
  ss(RED); strokeWeight(4); rect(M - 16, M - 16, WIDTH - 2 * (M - 16), HEIGHT - 2 * (M - 16));

  grain();
}

function grain() {
  noStroke();
  for (let i = 0; i < 5500; i++) {
    fill(40, 26, 14, 12); rect(rr(0, WIDTH), rr(0, HEIGHT), 1, 1);
    fill(255, 246, 222, 12); rect(rr(0, WIDTH), rr(0, HEIGHT), 1, 1);
  }
}

function setup() {
  const cnv = createCanvas(WIDTH, HEIGHT);
  cnv.parent('canvas-container');
  pixelDensity(1);
  const p = new URLSearchParams(window.location.search);
  if (p.has('seed')) seed = parseInt(p.get('seed'), 10) || seed;
  noLoop();
}

function newPanel() { seed = Math.floor(Math.random() * 1e9); redraw(); }
function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('marajoara', 'png');
  else if (key === ' ') newPanel();
}
function mousePressed() { if (mouseX >= 0 && mouseX < WIDTH && mouseY >= 0 && mouseY < HEIGHT) newPanel(); }
