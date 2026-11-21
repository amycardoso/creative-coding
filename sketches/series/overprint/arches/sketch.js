/**
 * Arches
 *
 * Overprint #1.
 *
 * A risograph prints every ink from its own drum, so two shapes of different
 * colours never touch each other on the press: they simply land on top of one
 * another and the inks mix. This sketch turns that into a rule. Arches sprout
 * one by one on a few shelves; an arch shoves aside every arch of its own ink
 * that it touches, but passes straight through arches of the other inks.
 * Nobody chooses the colour mixes: they are whatever overlaps survive the
 * pushing. When the shelves are full the sheet is pulled and a new one starts.
 *
 * Printed as five flat riso inks on pale pink paper.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new seed
 */


// ---------------------------------------------------------------------------
// Risograph print. Every ink is a density map stored in one colour channel
// of a texture (t0.rgb, t1.rgb). The shader prints each one as a rotated
// halftone screen (or a solid pass), shifted by its own small misregistration,
// and multiplies the inks onto the paper the way riso inks overlap.
// ---------------------------------------------------------------------------
let PAPER = [246, 240, 230];
const INK = { pink: [255, 72, 176], aqua: [0, 169, 224], sun: [255, 181, 17], yellow: [255, 232, 0], blue: [0, 120, 191], violet: [118, 91, 167], red: [241, 80, 96], teal: [0, 131, 138], orange: [255, 108, 47], navy: [50, 85, 164] };

const RISO_VERT = `
attribute vec3 aPosition;
void main() { vec4 p = vec4(aPosition, 1.0); p.xy = p.xy * 2.0 - 1.0; gl_Position = p; }`;

const RISO_FRAG = `
precision highp float;
uniform sampler2D t0; uniform sampler2D t1;
uniform vec2 res; uniform vec3 paper;
uniform vec3 inks[6]; uniform float angs[6]; uniform float cells[6];
uniform float solid[6]; uniform vec2 offs[6]; uniform float chA[6]; uniform float chB[6];
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float chan(float c, vec2 uv) {
  if (c < -0.5) return 0.0;
  vec3 a = texture2D(t0, uv).rgb, b = texture2D(t1, uv).rgb;
  if (c < 0.5) return a.r; if (c < 1.5) return a.g; if (c < 2.5) return a.b;
  if (c < 3.5) return b.r; if (c < 4.5) return b.g; return b.b;
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec3 col = paper + (hash(px) - 0.5) * 0.04;
  for (int i = 0; i < 6; i++) {
    if (chA[i] < -0.5) continue;
    vec2 q = px - offs[i];
    float cov;
    if (solid[i] > 0.5) {
      cov = clamp(chan(chA[i], q / res) + chan(chB[i], q / res), 0.0, 1.0);
    } else {
      float a = angs[i], c = cells[i], ca = cos(a), sa = sin(a);
      vec2 g = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca) / c;
      vec2 k = floor(g) + 0.5;
      vec2 cp = vec2(k.x * ca - k.y * sa, k.x * sa + k.y * ca) * c;
      vec2 uv = clamp(cp / res, 0.0, 1.0);
      float d = clamp(chan(chA[i], uv) + chan(chB[i], uv), 0.0, 1.0);
      cov = d > 0.0 ? clamp(0.78 * c * sqrt(d) - length(g - k) * c + 0.5, 0.0, 1.0) : 0.0;
    }
    cov *= 0.86 + 0.14 * hash(px + float(i) * 17.0);
    col *= 1.0 - cov * (1.0 - inks[i]);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

let risoShader, risoOffs = [];

function risoSetup() {
  risoShader = createShader(RISO_VERT, RISO_FRAG);
}

// misregistration: every ink pass lands a pixel or two away from the others
function risoRegister() {
  risoOffs = [];
  for (let i = 0; i < 6; i++) risoOffs.push(round(random(-2, 2)), round(random(-2, 2)));
}

// passes: [{ ch, ch2?, ink, angle (degrees), cell, solid? }] in print order
function risoPrint(t0, t1, passes) {
  const inks = [], angs = [], cells = [], solid = [], chA = [], chB = [];
  for (let i = 0; i < 6; i++) {
    const p = passes[i];
    inks.push(...(p ? p.ink.map(v => v / 255) : [1, 1, 1]));
    angs.push(p ? (p.angle || 0) * PI / 180 : 0);
    cells.push(p ? p.cell || 4.5 : 4.5);
    solid.push(p && p.solid ? 1 : 0);
    chA.push(p ? p.ch : -1);
    chB.push(p && p.ch2 !== undefined ? p.ch2 : -1);
  }
  shader(risoShader);
  risoShader.setUniform('t0', t0); risoShader.setUniform('t1', t1 || t0);
  risoShader.setUniform('res', [width, height]); risoShader.setUniform('paper', PAPER.map(v => v / 255));
  risoShader.setUniform('inks', inks); risoShader.setUniform('angs', angs); risoShader.setUniform('cells', cells);
  risoShader.setUniform('solid', solid); risoShader.setUniform('offs', risoOffs);
  risoShader.setUniform('chA', chA); risoShader.setUniform('chB', chB);
  noStroke(); rect(0, 0, width, height);
}

function pickSeed() {
  // read ?seed first: seed.js only leaves randomSeed() unmixed for sketches that read it
  const p = new URLSearchParams(location.search), q = parseInt(p.get('seed'), 10);
  // the gallery's seed.js provides the default seed (or ?seed) as window.__seed
  if (Number.isFinite(window.__seed)) return window.__seed;
  return Number.isFinite(q) ? q : Math.floor(Math.random() * 1e6);
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas(`${document.title.toLowerCase().replace(/\s+/g, '-')}-${seed}`, 'png');
  if (key === ' ') restart(Math.floor(Math.random() * 1e6));
}

// ---------------------------------------------------------------------------

const W = 800, H = 800, RES = 400, SC = W / RES, HOLD = 150;
let seed, t, inks, shelves, queue, arches, img, img2, D, ended;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  PAPER = [250, 232, 232];
  img = createImage(RES, RES); img2 = createImage(RES, RES);
  D = Array.from({ length: 6 }, () => new Float32Array(RES * RES));
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  inks = shuffle([INK.pink, INK.yellow, INK.aqua, INK.blue, INK.violet, INK.red, INK.orange]).slice(0, 5);
  const rows = floor(random(3, 5)), rh = RES / rows;
  shelves = []; queue = [];
  for (let r = 0; r < rows; r++) {
    const base = rh * (r + 0.88) + random(-4, 4);
    shelves.push(base);
    // each shelf uses three or four of the inks; each ink gets a few arches
    const use = shuffle([0, 1, 2, 3, 4]).slice(0, floor(random(3, 5)));
    for (const k of use) for (let i = floor(random(2, 5)); i > 0; i--) queue.push({ r, k, w: random(36, 80), h: random(0.5, 0.78) * rh });
  }
  queue = shuffle(queue);
  arches = []; t = 0; ended = -1;
}

// the outline of one arch, drawn once: straight sides, a round top, an edge
// that wobbles the way a rolled ink edge does
function makeMask(w, h) {
  const mw = ceil(w) + 8, mh = ceil(h) + 6, m = new Float32Array(mw * mh), ph = random(1000);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const u = (x - mw / 2) / (w / 2), v = (mh - 3 - y) / h, a = Math.atan2(v, u);
    const wob = 0.12 * (noise(ph + a * 1.5, y * 0.016) - 0.5) + 0.05 * (noise(ph + x * 0.5, y * 0.5) - 0.5);
    const top = Math.max(0, 1 - (w / 2) / h);
    let q;
    if (v < 0) q = 9; else if (v < top) q = Math.abs(u) - wob * 2; else { const vv = (v - top) / (1 - top); q = Math.sqrt(u * u + vv * vv) - wob * 3; }
    m[y * mw + x] = q < 1 ? Math.min(1, (1 - q) * w * 0.5) : 0;
  }
  return { m, mw, mh };
}

function draw() {
  // a new arch sprouts every few frames
  if (queue.length && t % 7 === 0) {
    const q = queue.pop();
    arches.push({ ...q, x: random(-10, RES + 10), vx: 0, g: 0, ...makeMask(q.w, q.h) });
  }
  // growth, then the push: only arches of the same ink on the same shelf collide
  for (const a of arches) a.g = Math.min(1, a.g + 0.03);
  for (let it = 0; it < 3; it++) for (let i = 0; i < arches.length; i++) for (let j = i + 1; j < arches.length; j++) {
    const a = arches[i], b = arches[j];
    if (a.k !== b.k || a.r !== b.r) continue;
    const gap = (a.w * ease(a.g) + b.w * ease(b.g)) / 2 + 4 - Math.abs(b.x - a.x);
    if (gap > 0) { const s = b.x >= a.x ? 1 : -1; a.vx -= s * gap * 0.06; b.vx += s * gap * 0.06; }
  }
  for (const a of arches) { a.x += a.vx; a.vx *= 0.7; a.x = constrain(a.x, -a.w * 0.3, RES + a.w * 0.3); }

  for (const d of D) d.fill(0);
  for (const a of arches) {
    const e = ease(a.g), d = D[a.k], base = shelves[a.r];
    // the arch grows out of its shelf: the mask is scaled up from its base
    if (e <= 0) continue;
    const ow = Math.ceil(a.mw * e), oh = Math.ceil(a.mh * e), x0 = Math.round(a.x - ow / 2), y0 = Math.round(base + 3 - oh);
    for (let y = 0; y < oh; y++) {
      const Y = y0 + y; if (Y < 0 || Y >= RES) continue;
      const sy = Math.min(a.mh - 1, Math.floor(a.mh - (oh - y) / e));
      if (sy < 0) continue;
      for (let x = 0; x < ow; x++) {
        const X = x0 + x, v = a.m[sy * a.mw + Math.min(a.mw - 1, Math.floor(x / e))];
        if (v > 0 && X >= 0 && X < RES) d[Y * RES + X] = Math.max(d[Y * RES + X], v * 0.82);
      }
    }
  }
  img.loadPixels(); img2.loadPixels();
  const A = img.pixels, B = img2.pixels;
  for (let i = 0; i < RES * RES; i++) {
    const p = i * 4;
    A[p] = D[0][i] * 255; A[p + 1] = D[1][i] * 255; A[p + 2] = D[2][i] * 255; A[p + 3] = 255;
    B[p] = D[3][i] * 255; B[p + 1] = D[4][i] * 255; B[p + 2] = 0; B[p + 3] = 255;
  }
  img.updatePixels(); img2.updatePixels();
  risoPrint(img, img2, inks.map((ink, k) => ({ ch: k, ink, solid: true })));
  t++;
  const settled = !queue.length && arches.every(a => a.g >= 1 && Math.abs(a.vx) < 0.02);
  if (settled && ended < 0) ended = t;
  if (ended > 0 && t - ended > HOLD) restart(floor(random(1e6)));
}

function ease(x) { return 1 - (1 - x) ** 3; }
