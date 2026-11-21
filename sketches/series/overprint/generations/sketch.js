/**
 * Generations
 *
 * Overprint #3.
 *
 * A cellular automaton (HighLife: a cell is born with 3 or 6 neighbours and
 * survives with 2 or 3) printed in three passes, the way a riso prints one
 * drum at a time. The current generation is printed as circles, the one
 * before it as rounded squares, the one before that as arches, each in its
 * own ink. Where all three passes land on the same cell the inks pile up
 * into a dark overprint: that is life that has stayed put. A single clean
 * colour is something just born or about to die. Every step, each ink hands
 * its pattern to the next one. When the colony dies out or settles into a
 * loop, a new one is seeded.
 *
 * Printed as three flat riso inks with a little misregistration.
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

const W = 800, H = 800, RES = 400, N = 20, C = RES / N, TICK = 14;
let seed, t, gens, gen, size, inks, masks, img, D, seen, img2, hold = 0;
// each ink has its own shape, like a riso test sheet
const SHAPES = [
  (u, v) => u * u + v * v < 0.92,
  (u, v) => Math.max(Math.abs(u), Math.abs(v)) < 0.82 && u * u + v * v < 1.05,
  (u, v) => v > -0.85 && (v > 0.1 ? Math.abs(u) < 0.85 : u * u + (v - 0.1) ** 2 / 0.9 < 0.72),
];

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES); img2 = createImage(RES, RES);
  D = [0, 1, 2].map(() => new Float32Array(RES * RES));
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  inks = random([[INK.pink, INK.aqua, INK.yellow], [INK.red, INK.blue, INK.yellow], [INK.pink, INK.teal, INK.orange], [INK.violet, INK.orange, INK.aqua]]);
  let g = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g[y * N + x] = random() < 0.38 * (0.6 + 0.8 * noise(x * 0.15, y * 0.15)) ? 1 : 0;
  gens = [g, g, g]; gen = 0; seen = new Map(); t = 0; hold = 0;
  // displayed size of every cell in every pass, easing towards alive (1) or dead (0)
  size = [0, 1, 2].map(() => new Float32Array(N * N));
  // every cell's three shapes, drawn once with their own wobble so no two prints match
  masks = [0, 1, 2].map(k => Array.from({ length: N * N }, () => {
    const m = new Uint8Array(C * C), ph = random(100);
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
      const u = (x + 0.5) / C * 2 - 1, v = (y + 0.5) / C * 2 - 1, a = Math.atan2(v, u);
      const r = 1 + 0.12 * (noise(ph + Math.cos(a), Math.sin(a)) - 0.5);
      m[y * C + x] = SHAPES[k](u * r, -v * r) ? 1 : 0;
    }
    return m;
  }));
}

function step(g) {
  const n = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let c = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) c += g[((y + j + N) % N) * N + (x + i + N) % N];
    n[y * N + x] = g[y * N + x] ? (c === 2 || c === 3 ? 1 : 0) : (c === 3 || c === 6 ? 1 : 0);
  }
  return n;
}

function draw() {
  if (t % TICK === 0) {
    const next = step(gens[0]);
    gens = [next, gens[0], gens[1]]; gen++;
    const key = next.join(''), pop = next.reduce((a, b) => a + b, 0);
    const looped = seen.has(key) && gen - seen.get(key) <= 12; seen.set(key, gen);
    if ((pop < 4 || gen > 220 || looped) && !hold) hold = gen;
    if (hold && gen - hold > 10) { hold = 0; restart(floor(random(1e6))); }
  }
  for (let k = 0; k < 3; k++) {
    const sz = size[k], g = gens[k], d = D[k];
    for (let i = 0; i < N * N; i++) sz[i] += (g[i] - sz[i]) * 0.22;
    d.fill(0);
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
      const s = sz[cy * N + cx]; if (s < 0.04) continue;
      const m = masks[k][cy * N + cx];
      for (let y = 0; y < C; y++) {
        const sy = Math.floor((y + 0.5 - C / 2) / s + C / 2); if (sy < 0 || sy >= C) continue;
        for (let x = 0; x < C; x++) {
          const sx = Math.floor((x + 0.5 - C / 2) / s + C / 2);
          if (sx >= 0 && sx < C && m[sy * C + sx]) d[(cy * C + y) * RES + cx * C + x] = 0.72;
        }
      }
    }
  }
  img.loadPixels(); img2.loadPixels();
  const A = img.pixels, B = img2.pixels;
  for (let i = 0; i < RES * RES; i++) { const p = i * 4; A[p] = D[0][i] * 255; A[p + 1] = D[1][i] * 255; A[p + 2] = D[2][i] * 255; A[p + 3] = 255; B[p + 3] = 255; }
  img.updatePixels(); img2.updatePixels();
  // oldest generation first, current generation on top
  risoPrint(img, img2, [{ ch: 2, ink: inks[2], solid: true }, { ch: 1, ink: inks[1], solid: true }, { ch: 0, ink: inks[0], solid: true }]);
  t++;
}
