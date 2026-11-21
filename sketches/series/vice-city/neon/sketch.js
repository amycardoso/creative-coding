/**
 * Neon
 *
 * Vice City #2.
 *
 * Glass tubes grow on a grid, all at the same time. Each one is a walk that
 * never crosses itself or anything else: it keeps going straight or turns,
 * but never enters a taken cell. While a tube is still growing it is cold
 * glass, a thin unlit line. When it gets boxed in it stops, flickers and
 * fills with gas; only then it glows. The sign is finished when the last
 * tube is trapped, stays lit for a while, and the next one starts.
 *
 * Corners are rounded like bent glass, the electrodes sit at both ends,
 * and the glow is printed as a halftone that dissolves into the paper:
 * a two-ink risograph, fluorescent pink and aqua.
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
const PAPER = [246, 240, 230];
const INK = { pink: [255, 72, 176], aqua: [0, 169, 224], sun: [255, 181, 17], blue: [0, 120, 191] };

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
      cov = clamp(0.78 * c * sqrt(d) - length(g - k) * c + 0.5, 0.0, 1.0);
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
  // the gallery's seed.js provides the default seed (or ?seed) as window.__seed
  if (Number.isFinite(window.__seed)) return window.__seed;
  const p = new URLSearchParams(location.search);
  return p.has('seed') ? parseInt(p.get('seed'), 10) : Math.floor(Math.random() * 1e6);
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas(`${document.title.toLowerCase().replace(/\s+/g, '-')}-${seed}`, 'png');
  if (key === ' ') restart(Math.floor(Math.random() * 1e6));
}

// ---------------------------------------------------------------------------

const W = 800, H = 800, STEP = 4, HOLD = 240;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
let seed, cell, m, cols, rows, occ, tubes, straight, t, doneAt, glow, core;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  glow = createGraphics(W, H); glow.pixelDensity(1);
  core = createGraphics(W, H); core.pixelDensity(1);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  cell = random([22, 25, 28]); m = 60;
  cols = floor((W - 2 * m) / cell); rows = floor((H - 2 * m) / cell);
  m = (W - cols * cell) / 2;
  occ = new Uint8Array(cols * rows); tubes = [];
  straight = random(0.55, 0.85);
  const n = floor(random(8, 16));
  for (let k = 0; k < n; k++) {
    let c, r; do { c = floor(random(cols)); r = floor(random(rows)); } while (occ[r * cols + c]);
    occ[r * cols + c] = 1;
    tubes.push({ p: [[c, r]], d: floor(random(4)), alive: true, ink: random() < 0.5 ? 0 : 1, lit: -1, flick: random(1000) });
  }
  t = 0; doneAt = -1;
}

// every STEP frames each living tube takes one cell, or gets stuck and lights up
function grow() {
  let any = false;
  for (const tb of tubes) {
    if (!tb.alive) continue;
    const [c, r] = tb.p[tb.p.length - 1];
    const turns = shuffle([(tb.d + 1) % 4, (tb.d + 3) % 4]);
    const opts = random() < straight ? [tb.d, ...turns] : [...turns, tb.d];
    let moved = false;
    for (const d of opts) {
      const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
      if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && !occ[nr * cols + nc]) {
        occ[nr * cols + nc] = 1; tb.p.push([nc, nr]); tb.d = d; moved = true; break;
      }
    }
    if (moved) any = true; else { tb.alive = false; tb.lit = t; }
  }
  return any;
}

const XY = ([c, r]) => [m + c * cell + cell / 2, m + r * cell + cell / 2];

function path(g, q) {
  g.beginShape(); g.vertex(...q[0]);
  for (let i = 1; i < q.length - 1; i++) {
    const a = [(q[i - 1][0] + q[i][0]) / 2, (q[i - 1][1] + q[i][1]) / 2];
    const b = [(q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2];
    g.vertex(...a); g.quadraticVertex(...q[i], ...b);
  }
  g.vertex(...q[q.length - 1]); g.endShape();
}

function draw() {
  if (doneAt < 0 && t % STEP === 0 && !grow()) doneAt = t;
  const ph = (t % STEP) / STEP;
  for (const g of [glow, core]) { g.blendMode(BLEND); g.background(0); g.blendMode(ADD); g.noFill(); }
  for (const tb of tubes) {
    // the head slides into its newest cell
    const q = tb.p.map(XY);
    if (tb.alive && q.length > 1) { const a = q[q.length - 2], b = q[q.length - 1]; q[q.length - 1] = [lerp(a[0], b[0], ph), lerp(a[1], b[1], ph)]; }
    const col = (v) => tb.ink === 0 ? [v, 0, 0] : [0, v, 0];
    let on = 0;
    if (tb.lit >= 0) {
      const age = t - tb.lit;
      on = age > 30 ? 1 : (noise(tb.flick, age * 0.4) > 0.45 ? random(0.5, 1) : 0);
    }
    if (q.length < 2) continue;
    if (on > 0) {
      for (const [w, a] of [[cell * 1.3, 40], [cell * 0.9, 50], [cell * 0.5, 70]]) { glow.stroke(...col(a * on)); glow.strokeWeight(w); path(glow, q); }
      core.stroke(...col(255)); core.strokeWeight(3.2); path(core, q);
    } else {
      core.stroke(...col(110)); core.strokeWeight(1.4); path(core, q);
    }
    core.noStroke(); core.fill(...col(on > 0 ? 255 : 140));
    for (const e of [q[0], q[q.length - 1]]) core.rect(e[0] - 4, e[1] - 4, 8, 8, 2);
    core.noFill();
  }
  risoPrint(glow, core, [
    { ch: 0, ink: INK.pink, angle: 15, cell: 5 },
    { ch: 1, ink: INK.aqua, angle: 75, cell: 5 },
    { ch: 3, ink: INK.pink, solid: true },
    { ch: 4, ink: INK.aqua, solid: true },
  ]);
  t++;
  if (doneAt >= 0 && t - doneAt > HOLD) restart(floor(random(1e6)));
}
