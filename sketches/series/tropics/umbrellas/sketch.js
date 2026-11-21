/**
 * Umbrellas
 *
 * Tropics #4.
 *
 * A beach from straight above, over one day. People arrive one at a time.
 * Each newcomer looks at a few dozen spots at random and takes the best:
 * close to the water, far from strangers (personal space), and close to
 * whoever they came with. They open an umbrella and lay a towel on the
 * sunny side. Nobody plans the crowd: the tight front row, the looser back
 * of the beach and the little clusters are what those three wishes
 * produce. The sun crosses the sky so the shadows swing round, the sea
 * keeps breaking, and late in the day people pack up in the order they
 * came. Then a new day, on a new seed.
 *
 * Printed as a three-ink risograph: sunflower, pink and aqua.
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

const W = 800, H = 800, RES = 200, SC = W / RES, CYCLE = 1200;
let seed, t, um, plan, wSea, img, lay;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES);
  lay = createGraphics(W, H); lay.pixelDensity(1);
  restart(pickSeed());
}

function sea(x) { return 150 + 40 * noise(x * 0.004); }

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  um = []; wSea = random(0.6, 1.4);
  const n = floor(random(35, 65));
  // arrival times: a slow morning, a busy late morning, a few stragglers
  for (let k = 0; k < n; k++) {
    const group = um.length && random() < 0.35 ? random(um) : null;
    let best = null, bs = -1e9;
    for (let c = 0; c < 60; c++) {
      const x = random(20, 780), y = random(sea(x) + 30, 760);
      let sc = -wSea * (y - sea(x)) / 6;
      for (const o of um) { const d = dist(x, y, o.x, o.y); sc -= 900 / max(1, d - 30); if (d < 75) sc -= 1e4; }
      if (group) sc -= dist(x, y, group.x, group.y) * 1.5;
      if (sc > bs) { bs = sc; best = { x, y }; }
    }
    Object.assign(best, {
      r: random(22, 34), rot: random(TWO_PI), seg: random([6, 8, 10]), ink: floor(random(3)),
      towel: floor(random(3)), ta: random(TWO_PI),
      arrive: 40 + 700 * pow(k / n, 1.4) + random(-10, 10),
    });
    best.leave = 820 + (best.arrive / 740) * 320 + random(-20, 20);
    um.push(best);
  }
  t = 0;
}

// ink channels in the drawing layer: R pink, G aqua, B sunflower
const CH = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];

function draw() {
  const f = t / CYCLE, sa = lerp(-2.4, -0.7, f), sv = p5.Vector.fromAngle(sa + PI).mult(10 + 14 * abs(f - 0.5) * 2);
  lay.blendMode(BLEND); lay.background(0); lay.blendMode(BLEND); lay.noStroke();
  const open = [];
  for (const u of um) {
    const a = constrain((t - u.arrive) / 20, 0, 1) * constrain((u.leave - t) / 20, 0, 1);
    if (a > 0) open.push([u, a]);
  }
  // towels first, then umbrellas on top (each pixel holds one ink)
  for (const [u, a] of open) {
    lay.fill(...CH[u.towel]); lay.push(); lay.translate(u.x - sv.x * 1.8, u.y - sv.y * 1.8); lay.rotate(u.ta); lay.rect(-9 * a, -18 * a, 18 * a, 36 * a); lay.pop();
  }
  for (const [u, a] of open) {
    const r = u.r * a;
    lay.fill(...CH[(u.ink + 1) % 3]); lay.circle(u.x, u.y, r * 2);
    lay.fill(...CH[u.ink]);
    for (let s = 0; s < u.seg; s += 2) lay.arc(u.x, u.y, r * 2, r * 2, u.rot + s * TWO_PI / u.seg, u.rot + (s + 1) * TWO_PI / u.seg, PIE);
  }
  // sea, sand and shadows at low resolution
  img.loadPixels();
  const D = img.pixels;
  for (let py = 0; py < RES; py++) for (let px = 0; px < RES; px++) {
    const x = px * SC, y = py * SC, s = sea(x) + 6 * Math.sin(x * 0.02 + t * 0.05), i = (py * RES + px) * 4;
    let shade = 0, cover = 0;
    for (const [u, a] of open) {
      const rr = u.r * u.r * a * a, dx = x - u.x, dy = y - u.y;
      if (dx * dx + dy * dy < rr) cover = 1;
      if ((dx - sv.x) ** 2 + (dy - sv.y) ** 2 < rr) shade = 1;
    }
    if (y < s) {
      const foam = pow(noise(x * 0.03, y * 0.08 - t * 0.02), 4) * 1.4 + (s - y < 6 ? 0.8 : 0);
      D[i] = 0; D[i + 1] = constrain(0.75 - 0.3 * (y / s) - foam, 0, 1) * 255; D[i + 2] = 0;
    } else {
      D[i] = (0.06 + shade * 0.35) * (1 - cover) * 255; D[i + 1] = shade * 0.3 * (1 - cover) * 255; D[i + 2] = 0.28 * (1 - cover) * 255;
    }
    D[i + 3] = 255;
  }
  img.updatePixels();
  risoPrint(img, lay, [
    { ch: 2, ink: INK.sun, angle: 0 },
    { ch: 0, ink: INK.pink, angle: 15 },
    { ch: 1, ink: INK.aqua, angle: 75 },
    { ch: 3, ink: INK.pink, solid: true },
    { ch: 4, ink: INK.aqua, solid: true },
    { ch: 5, ink: INK.sun, solid: true },
  ]);
  t++;
  if (t >= CYCLE) restart(floor(random(1e6)));
}
