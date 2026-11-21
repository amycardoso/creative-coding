/**
 * Interference
 *
 * Vice City #3.
 *
 * Biscayne Bay seen from above. A few wave sources (boats, jet skis) sit at
 * random points, some of them off the page, and send out rings of
 * different wavelengths at the same frequency. The water is just their
 * sum. Contour lines of the surface are printed in aqua, the crests where
 * the waves reinforce each other in pink, and the nodal lines, where they
 * cancel out and the water stays still, in the yellow of the sun.
 * Everything travels outward but the nodal lines stay put: they are the
 * standing pattern of the sources. One period loops; after a few the bay
 * gets a new set of sources.
 *
 * Printed as a three-ink risograph: sunflower, fluorescent pink, aqua.
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

const W = 800, H = 800, RES = 400, SC = W / RES, PERIOD = 150, LOOPS = 4, LEVELS = 3;
let seed, src, mx, t, img, h;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES); h = new Float32Array(RES * RES);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  src = [];
  const n = floor(random(2, 5));
  for (let i = 0; i < n; i++) src.push({ x: random(-200, 1000), y: random(-200, 1000), l: random(45, 110), p: random(TWO_PI), a: random(0.6, 1) });
  t = 0; mx = 0; field(); mx = 0; for (const v of h) mx = max(mx, abs(v));
}

function field() {
  const w = TWO_PI * (t % PERIOD) / PERIOD;
  for (let py = 0; py < RES; py++) for (let px = 0; px < RES; px++) {
    const x = px * SC, y = py * SC;
    let v = 0;
    for (const s of src) { const r = Math.hypot(x - s.x, y - s.y); v += s.a * Math.sin(TWO_PI * r / s.l - w + s.p) / Math.sqrt(1 + r / 250); }
    h[py * RES + px] = v;
  }
}

function draw() {
  field();
  img.loadPixels();
  const P = img.pixels;
  for (let py = 0; py < RES; py++) for (let px = 0; px < RES; px++) {
    const i = py * RES + px, k = i * 4;
    const x0 = min(px + 1, RES - 1), x1 = max(px - 1, 0), y0 = min(py + 1, RES - 1), y1 = max(py - 1, 0);
    const v = h[i] / mx;
    const gx = (h[py * RES + x0] - h[py * RES + x1]) / mx, gy = (h[y0 * RES + px] - h[y1 * RES + px]) / mx;
    const f = v * LEVELS, gm = Math.hypot(gx, gy) * LEVELS / 2 + 1e-4;
    const dl = Math.abs(f - Math.round(f)) / gm * SC;  // distance to the nearest contour, in pixels
    P[k] = constrain(1 - Math.abs(v) * 9, 0, 1) * 0.7 * 255;           // nodes: still water
    P[k + 1] = constrain((v - 0.35) / 0.6, 0, 1) ** 2 * 0.85 * 255;     // crests
    P[k + 2] = constrain(1.6 - dl * 1.4, 0, 1) * 255;                   // contour lines
    P[k + 3] = 255;
  }
  img.updatePixels();
  risoPrint(img, img, [
    { ch: 0, ink: INK.sun, angle: 0 },
    { ch: 1, ink: INK.pink, angle: 15 },
    { ch: 2, ink: INK.aqua, solid: true },
  ]);
  t++;
  if (t >= PERIOD * LOOPS) restart(floor(random(1e6)));
}
