/**
 * Beam
 *
 * Overprint #2.
 *
 * Phototropism. A light drifts slowly across the night sky, shining a cone
 * down onto a ridge of young pines. Every pine grows one step at a time and
 * at each step turns its tip a little towards wherever the light is now;
 * pines standing inside the beam grow faster and turn harder. Nobody draws
 * the forest: the curve of every trunk is a record of where the light has
 * been, and the dotted trail in the sky is the same path seen from below.
 * When the light reaches the far side, the night ends and a new one starts.
 *
 * Printed as a risograph: pink and blue screens for the sky, a yellow beam,
 * and the pines in solid navy with a violet screen on top.
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

const W = 800, H = 800, RES = 400, SC = W / RES, STEPS = 320, HOLD = 120;
let seed, t, path, trees, g, img, img2, stars, trail, grounds;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES); img2 = createImage(RES, RES);
  g = createGraphics(RES, RES); g.pixelDensity(1);
  stars = new Float32Array(RES * RES); trail = new Float32Array(RES * RES);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  // the light's path: from one side of the sky to the other, wandering
  path = [];
  const x0 = random() < 0.5 ? random(50, 120) : random(280, 350), x1 = RES - x0 + random(-50, 50);
  for (let i = 0; i < STEPS; i++) { const f = i / (STEPS - 1); path.push([lerp(x0, x1, f) + (noise(f * 3, 7) - 0.5) * 90, 52 + 24 * noise(f * 2, 3)]); }
  g.clear(); g.background(0); g.noStroke(); g.fill(255);
  trees = []; grounds = [];
  for (let L = 0; L < 3; L++) {
    const base = 345 + L * 20, sc = 0.6 + L * 0.25, ph = random(100);
    grounds.push(x => base + 10 * noise(x * 0.02, ph));
    for (let i = 30 - L * 7; i > 0; i--) {
      const x = random(-15, RES + 15);
      trees.push({ x, y: grounds[L](x), base, sc, ang: -HALF_PI + random(-0.05, 0.05), spine: [], k: random(0.8, 1.1) });
    }
  }
  stars.fill(0); trail.fill(0);
  for (let i = 0; i < 160; i++) dot(stars, random(RES), random(RES * 0.7), random(0.6, 1.3));
  t = 0;
}

function beamAt(L, x, y) {
  if (y < L[1]) return 0;
  const f = (y - L[1]) / (RES - L[1]), hw = lerp(13, 95, f);
  return smoothstep(hw + 2, hw - 2, Math.abs(x - L[0]));
}

function grow(s) {
  const p = path[s];
  for (const tr of trees) {
    const light = beamAt(p, tr.x, tr.base);
    tr.ang = lerpAngle(tr.ang, Math.atan2(p[1] - tr.y, p[0] - tr.x), 0.006 + 0.016 * light);
    const len = (0.24 + 0.45 * light) * tr.sc, px = tr.x, py = tr.y;
    tr.x += Math.cos(tr.ang) * len; tr.y += Math.sin(tr.ang) * len;
    tr.spine.push([tr.x, tr.y, tr.ang]);
    g.stroke(255); g.strokeWeight(1.2 * tr.sc); g.line(px, py, tr.x, tr.y); g.noStroke();
    // a tier of branches: hung from the trunk, smaller towards the top
    const n = tr.spine.length, at = n - 21;
    if (at >= 33 && at % 13 === 0) {
      const f = 1 - at / STEPS, [sx, sy, a] = tr.spine[at], [tx, ty] = tr.spine[n - 1], [ux, uy] = tr.spine[at + 10];
      const w = (2.5 + 13 * f) * tr.sc * tr.k, nx = -Math.sin(a), ny = Math.cos(a);
      g.triangle(tx, ty, sx + nx * w, sy + ny * w + w * 0.35, ux, uy);
      g.triangle(tx, ty, sx - nx * w, sy - ny * w + w * 0.35, ux, uy);
    }
  }
  if (s % 8 === 0) dot(trail, p[0], p[1], 0.8 + 2.2 * s / STEPS);
}

function draw() {
  const s = Math.min(t, STEPS - 1);
  if (t < STEPS) grow(t);
  const L = path[s];
  // ground of each ridge, redrawn on top so the trunks start below it
  for (let i = 0; i < 3; i++) { g.beginShape(); g.vertex(0, RES); for (let x = 0; x <= RES; x += 5) g.vertex(x, grounds[i](x) + 3); g.vertex(RES, RES); g.endShape(CLOSE); }
  g.loadPixels(); img.loadPixels(); img2.loadPixels();
  const T = g.pixels, A = img.pixels, B = img2.pixels;
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const i = y * RES + x, p = i * 4, k = y / RES, b = beamAt(L, x, y), tr = T[p] / 255;
    const open = (1 - b) * (1 - tr);
    A[p] = Math.min(1, (0.25 + 0.65 * (1 - k) ** 1.4) * open * (1 - trail[i])) * 255;            // blue sky
    A[p + 1] = smoothstep(0.25, 0.85, k) * 0.85 * open * 255;                                       // pink horizon
    A[p + 2] = Math.min(1, b * (1 - tr) * (0.3 + 0.55 * k) + b * tr * 0.5) * 255;                   // yellow beam
    B[p] = Math.min(1, stars[i] * open * (1 - k) + trail[i]) * 255;                                  // stars + trail
    B[p + 1] = tr * (1 - b * 0.55) * 255;                                                            // navy pines
    B[p + 2] = tr * 0.5 * 255;                                                                       // violet screen
    A[p + 3] = 255; B[p + 3] = 255;
  }
  img.updatePixels(); img2.updatePixels();
  risoPrint(img, img2, [
    { ch: 1, ink: INK.pink, angle: 15, cell: 5 },
    { ch: 0, ink: INK.blue, angle: 45, cell: 5 },
    { ch: 2, ink: INK.yellow, angle: 75, cell: 4 },
    { ch: 3, ink: INK.yellow, solid: true },
    { ch: 4, ink: INK.navy, solid: true },
    { ch: 5, ink: INK.violet, angle: 30, cell: 5 },
  ]);
  t++;
  if (t >= STEPS + HOLD) restart(floor(random(1e6)));
}

function dot(d, cx, cy, r) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    if (x < 0 || y < 0 || x >= RES || y >= RES) continue;
    const q = Math.hypot(x - cx, y - cy); if (q < r + 0.5) d[y * RES + x] = Math.max(d[y * RES + x], Math.min(1, r + 0.5 - q));
  }
}
function smoothstep(a, b, x) { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); }
function lerpAngle(a, b, u) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * u; }
