/**
 * Reef
 *
 * Tropics #5.
 *
 * A shallow reef seen from above, growing. Corals grow by diffusion-
 * limited aggregation: for each colony, particles are released just
 * outside it, wander at random while a slow current pushes them, and
 * stick the moment they touch the coral. Tips catch particles before the
 * hollows do, so the colonies branch, and the branches lean into the
 * current. The newest growth is printed in pink, older coral darkens to
 * blue. On the sand, caustics: sunlight focused by the moving surface into
 * a shifting net. When the reef has filled out, a new one starts.
 *
 * Printed as a four-ink risograph: sunflower, aqua, blue and pink.
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

const W = 800, H = 800, G = 400, PER_FRAME = 70, TARGET = 20000, HOLD = 150;
let seed, grid, born, colonies, cur, count, waves, img, img2, t, doneAt;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(G, G); img2 = createImage(G, G);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  grid = new Uint8Array(G * G); born = new Uint16Array(G * G); colonies = []; count = 0; t = 0; doneAt = -1;
  const n = floor(random(5, 10));
  for (let k = 0; k < n; k++) { const x = floor(random(50, 350)), y = floor(random(50, 350)); grid[y * G + x] = 1; colonies.push({ x, y, r: 2 }); }
  cur = p5.Vector.fromAngle(random(TWO_PI)).mult(0.12);
  waves = [];
  for (let k = 0; k < 6; k++) { const a = random(TWO_PI), l = random(40, 120); waves.push([Math.cos(a) * TWO_PI / l, Math.sin(a) * TWO_PI / l, random(TWO_PI), random(0.02, 0.05)]); }
}

const near = (x, y) => grid[y * G + x + 1] || grid[y * G + x - 1] || grid[(y + 1) * G + x] || grid[(y - 1) * G + x];

function grow() {
  let added = 0;
  for (let tries = 0; added < PER_FRAME && tries < PER_FRAME * 6; tries++) {
    const c = random(colonies), a = random(TWO_PI);
    let x = c.x + Math.cos(a) * (c.r + 4), y = c.y + Math.sin(a) * (c.r + 4);
    for (let s = 0; s < 4000; s++) {
      x += random(-1, 1) + cur.x; y += random(-1, 1) + cur.y;
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 1 || yi < 1 || xi >= G - 1 || yi >= G - 1 || Math.hypot(x - c.x, y - c.y) > c.r * 2 + 20) break;
      if (grid[yi * G + xi]) break;
      if (near(xi, yi)) { grid[yi * G + xi] = 1; born[yi * G + xi] = t; c.r = max(c.r, Math.hypot(xi - c.x, yi - c.y)); count++; added++; break; }
    }
  }
}

function draw() {
  if (count < TARGET) grow(); else if (doneAt < 0) doneAt = t;
  img.loadPixels(); img2.loadPixels();
  const D = img.pixels, E = img2.pixels, sc = W / G, tt = t * 0.6;
  for (let py = 0; py < G; py++) for (let px = 0; px < G; px++) {
    const x = px * sc, y = py * sc, i = py * G + px, k = i * 4;
    let v = 0, v2 = 0;
    for (const [kx, ky, p, w] of waves) { v += Math.sin(kx * x + ky * y + p + w * tt); v2 += Math.sin(kx * x * 1.7 - ky * y * 1.3 + p * 2 - w * tt * 1.3); }
    const ca = Math.pow(1 - Math.abs(Math.sin(v * 0.9 + v2 * 0.4)), 8);
    const on = grid[i] || grid[i + 1] || grid[i + G];   // thicken each branch by one cell
    if (on) {
      const j = grid[i] ? i : grid[i + 1] ? i + 1 : i + G, age = constrain((t - born[j]) / 500, 0, 1);
      D[k] = 0; D[k + 1] = 0; D[k + 2] = (1 - 0.25 * age) * 255; E[k] = age * 0.35 * 255;
    } else {
      D[k] = (0.08 + ca * 0.6) * 255;
      D[k + 1] = (0.5 - ca * 0.45 + 0.15 * noise(x * 0.004, y * 0.004)) * 255;
      D[k + 2] = 0; E[k] = 0.05 * 255;
    }
    D[k + 3] = 255; E[k + 3] = 255;
  }
  img.updatePixels(); img2.updatePixels();
  risoPrint(img, img2, [
    { ch: 0, ink: INK.sun, angle: 0 },
    { ch: 1, ink: INK.aqua, angle: 75 },
    { ch: 3, ink: INK.blue, angle: 45 },
    { ch: 2, ink: INK.pink, solid: true },
  ]);
  t++;
  if (doneAt >= 0 && t - doneAt > HOLD) restart(floor(random(1e6)));
}
