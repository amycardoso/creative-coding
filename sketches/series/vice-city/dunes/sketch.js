/**
 * Dunes
 *
 * Vice City #6.
 *
 * Werner's dune model, running live. The sand is a stack of slabs on a
 * grid that wraps around. The wind picks a slab at random and carries it a
 * few cells downwind; it lands more easily on sand than on bare ground,
 * always lands in the wind shadow behind a crest, and any slope steeper
 * than the angle of repose slides down. The page starts as an even, noisy
 * sheet of sand: ripples appear, merge into crests and the crests march
 * downwind as dunes. Nothing shapes them but those three rules. Lit by a
 * low afternoon sun: lit faces in pink and sunflower, lee faces in blue.
 * After a while the wind drops and a new desert starts on a new seed.
 *
 * Printed as a three-ink risograph: sunflower, fluorescent pink, blue.
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

const W = 800, H = 800, G = 200, RES = 400, L = 5, SWEEPS = 1.5, CYCLE = 1200;
let seed, h, avg, lx, ly, img, t;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  h = new Int16Array(G * G); avg = random(2, 5);
  for (let i = 0; i < G * G; i++) h[i] = floor(random(avg * 2));
  // settle the random sheet so every step starts within the angle of repose
  for (let changed = true; changed;) {
    changed = false;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++)
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (h[id(x, y)] - h[id(x + dx, y + dy)] > 2) { h[id(x, y)]--; h[id(x + dx, y + dy)]++; changed = true; }
  }
  const az = random(-0.6, 0.6); lx = Math.cos(az); ly = Math.sin(az);
  t = 0;
}

const id = (x, y) => (((y % G) + G) % G) * G + (((x % G) + G) % G);

// in the wind shadow if some cell upwind stands higher than a 0.6 slope from here
function shadow(x, y) {
  const hc = h[id(x, y)];
  for (let k = 1; k < 12; k++) if (h[id(x - k, y)] - hc > k * 0.6) return true;
  return false;
}

// avalanche: keep every step between neighbours at 2 slabs or less
function slide(x, y, up) {
  for (let it = 0; it < 30; it++) {
    let bx = 0, by = 0, bd = 2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = up ? h[id(x + dx, y + dy)] - h[id(x, y)] : h[id(x, y)] - h[id(x + dx, y + dy)];
      if (d > bd) { bd = d; bx = dx; by = dy; }
    }
    if (bd === 2) return;
    if (up) { h[id(x + bx, y + by)]--; h[id(x, y)]++; } else { h[id(x, y)]--; h[id(x + bx, y + by)]++; }
    x += bx; y += by;
  }
}

function wind(n) {
  for (let m = 0; m < n; m++) {
    let x = floor(random(G)), y = floor(random(G));
    if (h[id(x, y)] <= 0 || shadow(x, y)) continue;
    h[id(x, y)]--; slide(x, y, true);
    for (let hop = 0; hop < 200; hop++) {
      x += L; const i = id(x, y);
      if (shadow(x, y) || random() < (h[i] > 0 ? 0.6 : 0.4)) { h[i]++; slide(x, y, false); break; }
    }
  }
}

function draw() {
  wind(floor(G * G * SWEEPS));
  img.loadPixels();
  const D = img.pixels, sc = G / RES;
  for (let py = 0; py < RES; py++) for (let px = 0; px < RES; px++) {
    const gx = px * sc, gy = py * sc, x0 = floor(gx), y0 = floor(gy), fx = gx - x0, fy = gy - y0;
    const v = (u, w) => (h[id(u, w)] * (1 - fx) + h[id(u + 1, w)] * fx) * (1 - fy) + (h[id(u, w + 1)] * (1 - fx) + h[id(u + 1, w + 1)] * fx) * fy;
    const dx = v(x0 + 1, y0) - v(x0 - 1, y0), dy = v(x0, y0 + 1) - v(x0, y0 - 1);
    const lit = constrain(0.5 - (dx * lx + dy * ly) * 0.18, 0, 1), i = (py * RES + px) * 4;
    D[i] = (0.3 + 0.4 * lit) * 255;
    D[i + 1] = smoothstep(0.55, 0.9, lit) * 0.8 * 255;
    D[i + 2] = smoothstep(0.45, 0.12, lit) * 0.85 * 255;
    D[i + 3] = 255;
  }
  img.updatePixels();
  risoPrint(img, img, [
    { ch: 0, ink: INK.sun, angle: 0 },
    { ch: 1, ink: INK.pink, angle: 15 },
    { ch: 2, ink: INK.blue, angle: 45 },
  ]);
  t++;
  if (t >= CYCLE) restart(floor(random(1e6)));
}

function smoothstep(a, b, x) { const k = constrain((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); }
