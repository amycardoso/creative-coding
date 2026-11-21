/**
 * Mirage
 *
 * Vice City #1.
 *
 * Hot asphalt turned into optics. A coarse heat simulation runs under the
 * picture: sources along the ground flicker, warm air is carried upward by
 * swaying currents, spreads and cools. The temperature gradient bends
 * light the way hot air changes the refractive index, so every pixel of a
 * Miami sunset is looked up a little to the side of where it should be.
 * Below the horizon the hot ground mirrors the sky (an inferior mirage).
 * The sun sinks through the horizon, cut into slats that thicken towards
 * the bottom, and the heat keeps shaking it. When it is gone the next day
 * starts on a new seed.
 *
 * Printed as a four-ink risograph: sunflower, fluorescent pink, aqua, blue.
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

const W = 800, H = 800, RES = 400, SC = W / RES;
const GW = 100, GH = 100, CS = W / GW, CYCLE = 900;
let seed, t, T, src, tmax, hy, sx0, R, gaps, img0, img1;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img0 = createImage(RES, RES); img1 = createImage(RES, RES);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  T = new Float32Array(GW * GH); src = []; for (let x = 0; x < GW; x++) src.push(random(1000));
  hy = 470 + random(-30, 30); sx0 = 400 + random(-120, 120); R = random(140, 190);
  gaps = []; let gy = 0.05, th = 3;
  while (gy < 1) { gaps.push([gy * R, gy * R + th]); gy += random(0.1, 0.16); th *= random(1.3, 1.5); }
  t = 0; tmax = 0;
  for (let i = 0; i < 200; i++) stepHeat();
  t = 0;
}

// one step of the heat field: advect upward along swaying currents, spread, cool, re-heat the ground
function stepHeat() {
  const N = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const sway = (noise(x * 0.05, y * 0.05, t * 0.02) - 0.5) * 3;
    const fx = constrain(round(x + sway), 0, GW - 1), fy = min(GH - 1, y + 1);
    const l = T[y * GW + max(0, x - 1)], r = T[y * GW + min(GW - 1, x + 1)];
    N[y * GW + x] = (T[fy * GW + fx] * 0.8 + (l + r) * 0.1) * 0.99;
  }
  for (let x = 0; x < GW; x++) {
    const s = pow(noise(x * 0.1, t * 0.004), 3) * 4;
    for (let y = GH - 3; y < GH; y++) N[y * GW + x] += s * random(0.5, 1.5) * 0.25;
  }
  T = N; t++;
  let m = 0; for (let i = 0; i < T.length; i++) if (T[i] > m) m = T[i];
  tmax = tmax ? lerp(tmax, m, 0.05) : m;
}

function heat(x, y) {
  const gx = constrain(floor(x / CS), 0, GW - 1), gy = constrain(floor(y / CS), 0, GH - 1);
  return T[gy * GW + gx] / tmax;
}

// the sky at a point, as ink densities [sun, pink, aqua, blue]
function sky(x, y, sy0, dusk, o) {
  const k = constrain(y / hy, 0, 1);
  o[0] = pow(k, 2.5) * 0.45 * (1 - dusk * 0.6);
  o[1] = (k < 0.3 ? 0 : sq((k - 0.3) / 0.7)) * (0.6 + dusk * 0.3);
  o[2] = pow(1 - k, 1.6) * 0.55;
  o[3] = pow(1 - k, 2) * dusk * 0.7;
  const dx = x - sx0, dy = y - sy0;
  if (dx * dx + dy * dy < R * R && y < hy) {
    for (const g of gaps) if (dy > g[0] && dy < g[1]) return;
    const u = (dy + R) / (2 * R);
    o[0] = 0.9; o[1] = 0.05 + 0.75 * u; o[2] = 0; o[3] = 0;
  }
}

function draw() {
  stepHeat();
  const f = (t % CYCLE) / CYCLE;
  const sy0 = lerp(hy - R * 1.15, hy + R * 1.05, f), dusk = f;
  const o = [0, 0, 0, 0], K = 420;
  img0.loadPixels(); img1.loadPixels();
  const A = img0.pixels, B = img1.pixels;
  for (let py = 0; py < RES; py++) for (let px = 0; px < RES; px++) {
    const x = px * SC, y = py * SC;
    const dx = (heat(x + CS, y) - heat(x - CS, y)) * K, dy = (heat(x, y + CS) - heat(x, y - CS)) * K * 0.15;
    const X = x + dx, Y = y + dy, i = (py * RES + px) * 4;
    if (Y < hy) sky(X, Y, sy0, dusk, o);
    else {
      const depth = (Y - hy) / (H - hy), refl = pow(1 - depth, 3) * 0.9;
      sky(X, 2 * hy - Y, sy0, dusk, o);
      o[0] *= refl; o[1] = lerp(0.35 + 0.2 * depth, o[1], refl);
      o[2] = lerp(0.6 + 0.25 * depth, o[2], refl); o[3] = lerp(dusk * 0.5, o[3], refl);
    }
    A[i] = o[0] * 255; A[i + 1] = o[1] * 255; A[i + 2] = o[2] * 255; A[i + 3] = 255;
    B[i] = o[3] * 255; B[i + 1] = 0; B[i + 2] = 0; B[i + 3] = 255;
  }
  img0.updatePixels(); img1.updatePixels();
  risoPrint(img0, img1, [
    { ch: 0, ink: INK.sun, angle: 0 },
    { ch: 3, ink: INK.blue, angle: 45 },
    { ch: 1, ink: INK.pink, angle: 15 },
    { ch: 2, ink: INK.aqua, angle: 75 },
  ]);
  if (t % CYCLE === CYCLE - 1) restart(floor(random(1e6)));
}
