/**
 * Murmuration
 *
 * Overprint #4.
 *
 * Three flocks of starlings, one per ink. Every bird follows the classic
 * flocking rules (keep clear of the nearest birds, match their heading, drift
 * towards the middle of the group) but it only sees birds of its own flock;
 * birds of the other flocks are no more than a faint draught to dodge. So the
 * three clouds fold, stretch and pour straight through each other, and the
 * colours mix only where they happen to cross. A slow wind and a soft pull to
 * the middle of the sky keep them on the sheet.
 *
 * Printed as a risograph: each flock is a screened cloud of its ink with every
 * bird printed on top as a solid mark.
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

const W = 800, H = 800, RES = 400, SC = W / RES, PER = 1200, G = 13;
let seed, t, inks, birds, img, img2, cloud, marks, tmp;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES); img2 = createImage(RES, RES);
  cloud = [0, 1, 2].map(() => new Float32Array(RES * RES));
  marks = [0, 1, 2].map(() => new Float32Array(RES * RES));
  tmp = new Float32Array(RES * RES);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  inks = shuffle([INK.pink, INK.aqua, INK.yellow, INK.violet, INK.orange]).slice(0, 3);
  birds = [];
  for (let f = 0; f < 3; f++) {
    const cx = random(100, 300), cy = random(100, 300), a = random(TWO_PI);
    for (let i = 0; i < PER; i++) birds.push({ f, x: cx + randomGaussian(0, 50), y: cy + randomGaussian(0, 22), vx: Math.cos(a) + random(-0.3, 0.3), vy: Math.sin(a) + random(-0.3, 0.3) });
  }
  t = 0;
}

function draw() {
  // neighbours through a coarse grid
  const cols = Math.ceil(RES / G) + 2, grid = Array.from({ length: cols * cols }, () => []);
  const cell = b => (constrain(Math.floor(b.y / G), -1, cols - 2) + 1) * cols + constrain(Math.floor(b.x / G), -1, cols - 2) + 1;
  for (const b of birds) grid[cell(b)].push(b);
  for (const b of birds) {
    let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, ox = 0, oy = 0, n = 0;
    const gx = constrain(Math.floor(b.x / G), -1, cols - 2) + 1, gy = constrain(Math.floor(b.y / G), -1, cols - 2) + 1;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = gx + i, Y = gy + j; if (X < 0 || Y < 0 || X >= cols || Y >= cols) continue;
      for (const o of grid[Y * cols + X]) {
        if (o === b) continue;
        const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy; if (d2 > G * G) continue;
        if (o.f === b.f) { n++; ax += o.vx; ay += o.vy; cx += dx; cy += dy; if (d2 < 16) { sx -= dx / (d2 + 0.5); sy -= dy / (d2 + 0.5); } }
        else if (d2 < 25) { ox -= dx / (d2 + 0.5); oy -= dy / (d2 + 0.5); }
      }
    }
    if (n) { b.vx += (ax / n - b.vx) * 0.08 + cx / n * 0.0016; b.vy += (ay / n - b.vy) * 0.08 + cy / n * 0.0016; }
    b.vx += sx * 0.75 + ox * 0.08; b.vy += sy * 0.75 + oy * 0.08;
    const wa = noise(b.x * 0.006, b.y * 0.006, t * 0.004 + b.f * 3) * TWO_PI * 2;
    b.vx += Math.cos(wa) * 0.03 + (RES / 2 - b.x) * 0.00025; b.vy += Math.sin(wa) * 0.03 + (RES / 2 - b.y) * 0.00025;
    const sp = Math.hypot(b.vx, b.vy) || 1, v = constrain(sp, 0.8, 1.6); b.vx *= v / sp; b.vy *= v / sp;
  }
  for (const b of birds) { b.x += b.vx; b.y += b.vy; }

  for (let f = 0; f < 3; f++) { cloud[f].fill(0); marks[f].fill(0); }
  for (const b of birds) {
    const x = Math.round(b.x), y = Math.round(b.y);
    if (x < 0 || y < 0 || x >= RES || y >= RES) continue;
    cloud[b.f][y * RES + x] += 0.5;
    // each bird: a short solid dash along its heading
    const sp = Math.hypot(b.vx, b.vy) || 1;
    for (let q = -1; q <= 1; q++) { const X = Math.round(b.x + b.vx / sp * q), Y = Math.round(b.y + b.vy / sp * q); if (X >= 0 && Y >= 0 && X < RES && Y < RES) marks[b.f][Y * RES + X] = 0.9; }
  }
  for (const c of cloud) { boxBlur(c, 4); boxBlur(c, 4); }
  img.loadPixels(); img2.loadPixels();
  const A = img.pixels, B = img2.pixels;
  for (let i = 0; i < RES * RES; i++) {
    const p = i * 4;
    A[p] = Math.min(1, cloud[0][i]) * 255; A[p + 1] = Math.min(1, cloud[1][i]) * 255; A[p + 2] = Math.min(1, cloud[2][i]) * 255; A[p + 3] = 255;
    B[p] = marks[0][i] * 255; B[p + 1] = marks[1][i] * 255; B[p + 2] = marks[2][i] * 255; B[p + 3] = 255;
  }
  img.updatePixels(); img2.updatePixels();
  risoPrint(img, img2, [
    { ch: 0, ink: inks[0], angle: 15, cell: 5 }, { ch: 1, ink: inks[1], angle: 45, cell: 5 }, { ch: 2, ink: inks[2], angle: 75, cell: 5 },
    { ch: 3, ink: inks[0], solid: true }, { ch: 4, ink: inks[1], solid: true }, { ch: 5, ink: inks[2], solid: true },
  ]);
  t++;
}

function boxBlur(d, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < RES; y++) {
    let s = 0; const o = y * RES;
    for (let x = -r; x <= r; x++) s += d[o + Math.max(0, Math.min(RES - 1, x))];
    for (let x = 0; x < RES; x++) { tmp[o + x] = s / n; s += d[o + Math.min(RES - 1, x + r + 1)] - d[o + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < RES; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.max(0, Math.min(RES - 1, y)) * RES + x];
    for (let y = 0; y < RES; y++) { d[y * RES + x] = s / n; s += tmp[Math.min(RES - 1, y + r + 1) * RES + x] - tmp[Math.max(0, y - r) * RES + x]; }
  }
}
