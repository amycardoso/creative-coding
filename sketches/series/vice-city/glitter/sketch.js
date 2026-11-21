/**
 * Glitter
 *
 * Vice City #5.
 *
 * The path of light the sun lays on the sea at the end of the afternoon.
 * The sea is a sum of two dozen waves with random directions and lengths,
 * each moving at its own speed (longer waves run faster, as on real water).
 * For every point of the water the sketch works out the surface normal,
 * reflects the line of sight off it, and lights the point only if the
 * reflection lands inside the sun. Nobody draws the golden path: it is
 * the statistics of tiny facets that happen to catch the sun, so it
 * sparkles and breaks up as the waves move. The sun sinks while it
 * happens; when it touches the sea a new evening starts on a new seed.
 *
 * Printed as a four-ink risograph: blue, aqua, pink and solid sunflower.
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

const W = 800, H = 800, RES = 400, SC = W / RES, F = 520, CAM = 1.6, CYCLE = 900;
let seed, t, hy, sunAz, el0, waves, cosR, img, img2, hit;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES); img2 = createImage(RES, RES); hit = new Float32Array(RES * RES);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  hy = random(250, 360); sunAz = random(-0.25, 0.25); el0 = random(0.12, 0.2);
  cosR = Math.cos(random(0.09, 0.12));
  waves = [];
  for (let i = 0; i < 24; i++) {
    const l = random(0.25, 5), a = random(-PI * 0.4, PI * 0.4) + random([0, PI]), k = TWO_PI / l;
    waves.push({ kx: Math.sin(a) * k, kz: Math.cos(a) * k, A: l * random(0.015, 0.03), p: random(TWO_PI), w: Math.sqrt(9.8 * k) / 30 });
  }
  t = 0;
}

function draw() {
  const f = t / CYCLE, el = lerp(el0, 0.015, f);
  const sun = [Math.sin(sunAz) * Math.cos(el), Math.sin(el), Math.cos(sunAz) * Math.cos(el)];
  const sx = W / 2 + sunAz * F, sy = hy - el * F, R = 46;
  for (const w of waves) w.ph = w.p - w.w * t;
  img.loadPixels(); img2.loadPixels();
  const D = img.pixels, E = img2.pixels;
  for (let py = 0; py < RES; py++) {
    const y = py * SC + 0.5;
    if (y < hy) {
      for (let px = 0; px < RES; px++) {
        const x = px * SC, k = y / hy, d = Math.hypot(x - sx, y - sy), i = (py * RES + px) * 4;
        const glow = d < R ? 1 : 0.5 * Math.exp(-(d - R) / 60);
        D[i] = Math.min(1, pow(k, 2) * 0.5 + glow) * 255;
        D[i + 1] = Math.min(1, pow(k, 1.5) * (0.55 + 0.2 * f) + (d < R ? 0.25 : 0)) * 255;
        D[i + 2] = pow(1 - k, 1.5) * 0.5 * 255; D[i + 3] = 255; E[i] = 0; E[i + 3] = 255;
        hit[py * RES + px] = 0;
      }
      continue;
    }
    const dvy = -(y - hy) / F, Z = CAM / -dvy, depth = (y - hy) / (H - hy);
    for (let px = 0; px < RES; px++) {
      const x = px * SC + 0.5, dvx = (x - W / 2) / F, X = dvx * Z;
      let gx = 0, gz = 0;
      for (const w of waves) { const c = w.A * Math.cos(w.kx * X + w.kz * Z + w.ph); gx += c * w.kx; gz += c * w.kz; }
      const nl = Math.hypot(gx, 1, gz), nx = -gx / nl, ny = 1 / nl, nz = -gz / nl;
      const vl = Math.hypot(dvx, dvy, 1), vx = dvx / vl, vy = dvy / vl, vz = 1 / vl, vn = vx * nx + vy * ny + vz * nz;
      const rx = vx - 2 * vn * nx, ry = vy - 2 * vn * ny, rz = vz - 2 * vn * nz;
      hit[py * RES + px] = rx * sun[0] + ry * sun[1] + rz * sun[2] > cosR ? 1 : 0;
    }
  }
  // glints in solid sunflower, a pink halo around them, and the sea darkening with depth
  for (let py = Math.ceil((hy - 0.5) / SC); py < RES; py++) {
    const depth = (py * SC + 0.5 - hy) / (H - hy);
    for (let px = 0; px < RES; px++) {
      let s = 0;
      for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) { const X = px + k, Y = py + j; if (X >= 0 && Y >= 0 && X < RES && Y < RES) s += hit[Y * RES + X]; }
      const halo = s / 25, i = (py * RES + px) * 4;
      D[i] = hit[py * RES + px] * 255;
      D[i + 1] = Math.min(1, 0.3 * (1 - depth) + halo * 1.5) * 255;
      D[i + 2] = 0.45 * (1 - Math.min(1, halo * 2)) * 255;
      D[i + 3] = 255; E[i + 3] = 255;
      E[i] = (0.05 + 0.3 * depth) * (1 - Math.min(1, halo * 3)) * 255;
    }
  }
  img.updatePixels(); img2.updatePixels();
  risoPrint(img, img2, [
    { ch: 3, ink: INK.blue, angle: 45 },
    { ch: 2, ink: INK.aqua, angle: 75 },
    { ch: 1, ink: INK.pink, angle: 15 },
    { ch: 0, ink: INK.sun, solid: true },
  ]);
  t++;
  if (t >= CYCLE) restart(floor(random(1e6)));
}
