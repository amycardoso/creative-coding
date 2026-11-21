/**
 * Fronds
 *
 * Vice City #4.
 *
 * Palm trees by a pool, seen from straight above. Crowns are scattered by
 * rejection (they may overlap a little) and appear one after another. Each
 * crown grows its fronds from the centre at the golden angle, 137.5° apart,
 * like a real palm: every new frond pushes out in the largest gap left by
 * the others. Fronds lengthen and curl as they age, and each one is a
 * spine with leaflets that taper at both ends. The shadows are the same
 * crowns projected by a low afternoon sun that keeps moving, so the
 * shadows swing round. The pool's caustics shimmer. At sunset the page is
 * cleared and a new garden grows.
 *
 * Printed as a four-ink risograph: sunflower, pink, aqua and blue.
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

const W = 800, H = 800, RES = 400, SC = W / RES, CYCLE = 1100;
let seed, crowns, pool, sunA0, img, lay, t;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES);
  lay = createGraphics(W, H); lay.pixelDensity(1);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  crowns = [];
  for (let k = 0; k < 3000 && crowns.length < 14; k++) {
    const R = random(70, 150), x = random(40, 760), y = random(40, 760);
    if (crowns.every(c => dist(x, y, c.x, c.y) > (R + c.R) * 0.75)) crowns.push({ x, y, R });
  }
  crowns.forEach((c, i) => {
    c.born = i * 22 + random(20); c.n = floor(random(9, 15)); c.rot = random(TWO_PI);
    c.curl = random([-1, 1]) * random(0.2, 0.6); c.gap = random(12, 18);
    c.nuts = []; for (let j = 0; j < 4; j++) c.nuts.push([random(-6, 6), random(-6, 6), random(6, 10)]);
  });
  pool = { x: random(200, 600), y: random(200, 600), w: random(220, 380), h: random(140, 240) };
  sunA0 = random(TWO_PI);
  // ground: sand in pink and sunflower, the pool in aqua
  img.loadPixels();
  for (let py = 0; py < RES; py++) for (let px = 0; px < RES; px++) {
    const x = px * SC, y = py * SC, k = (py * RES + px) * 4;
    const inPool = abs(x - pool.x) < pool.w / 2 && abs(y - pool.y) < pool.h / 2;
    img.pixels[k] = inPool ? 0 : (0.06 + 0.08 * noise(x * 0.005, y * 0.005)) * 255;
    img.pixels[k + 1] = 0;
    img.pixels[k + 2] = inPool ? 0 : 0.12 * 255;
    img.pixels[k + 3] = 255;
  }
  img.updatePixels();
  t = 0;
}

// a crown at age `age` (frames), drawn as one path in the given channel colour
function crown(ctx, c, age, ox, oy) {
  const grown = min(c.n, floor(age / c.gap) + 1);
  ctx.beginPath();
  for (let i = 0; i < grown; i++) {
    const fa = (age - i * c.gap) / (c.gap * c.n);        // this frond's age, 0..~1
    const g = constrain(fa, 0, 1), mature = constrain(fa * 1.2, 0, 1);
    const ang = c.rot + i * 2.39996, len = c.R * (0.45 + 0.55 * mature) * (0.2 + 0.8 * sqrt(g));
    const bend = c.curl * (0.3 + mature);
    let x = c.x + ox, y = c.y + oy, a = ang;
    const steps = 24, pts = [];
    for (let s = 0; s <= steps; s++) { pts.push([x, y, a]); x += cos(a) * len / steps; y += sin(a) * len / steps; a += bend / steps; }
    ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]);
    for (let s = 2; s < steps; s++) {
      const [px, py, pa] = pts[s], u = s / steps, l = len * 0.2 * sin(PI * u) * (0.6 + 0.4 * mature);
      for (const side of [-1, 1]) { const la = pa + side * (0.55 - 0.15 * u); ctx.moveTo(px, py); ctx.lineTo(px + cos(la) * l, py + sin(la) * l); }
    }
  }
  ctx.stroke();
}

function draw() {
  const f = t / CYCLE;
  const sun = p5.Vector.fromAngle(sunA0 + f * HALF_PI).mult(18 + 26 * f);
  lay.blendMode(BLEND); lay.background(0); lay.blendMode(ADD);
  const ctx = lay.drawingContext;
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgb(0,170,0)';
  for (const c of crowns) if (t > c.born) crown(ctx, c, t - c.born, sun.x, sun.y);
  ctx.strokeStyle = 'rgb(255,0,0)';
  for (const c of crowns) if (t > c.born) crown(ctx, c, t - c.born, 0, 0);
  lay.noStroke(); lay.fill(0, 0, 255);
  for (const c of crowns) if (t > c.born + 40) for (const [dx, dy, r] of c.nuts) lay.circle(c.x + dx, c.y + dy, r);
  // caustics: interfering ripples on the pool floor
  img.loadPixels();
  const x0 = max(0, floor((pool.x - pool.w / 2) / SC)), x1 = min(RES, ceil((pool.x + pool.w / 2) / SC));
  const y0 = max(0, floor((pool.y - pool.h / 2) / SC)), y1 = min(RES, ceil((pool.y + pool.h / 2) / SC));
  const tt = t * 0.03;
  for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
    const x = px * SC, y = py * SC;
    const v = Math.sin(x * 0.045 + Math.sin(y * 0.031 + tt) * 1.7) + Math.sin(y * 0.052 + Math.sin(x * 0.027 - tt * 0.8) * 1.9);
    const caustic = Math.pow(1 - Math.abs(v) / 2, 6);
    img.pixels[(py * RES + px) * 4 + 1] = (0.55 - caustic * 0.5) * 255;
  }
  img.updatePixels();
  risoPrint(img, lay, [
    { ch: 2, ch2: 5, ink: INK.sun, angle: 0 },
    { ch: 0, ch2: 4, ink: INK.pink, angle: 15 },
    { ch: 1, ink: INK.aqua, angle: 75 },
    { ch: 3, ink: INK.blue, solid: true },
  ]);
  t++;
  if (t >= CYCLE) restart(floor(random(1e6)));
}
