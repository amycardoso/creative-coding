/**
 * Rosette
 *
 * Overprint #5.
 *
 * The image is the halftone itself. Three inks, and each one is nothing but a
 * disc with a smooth gradient; no pattern is drawn anywhere. A riso prints a
 * tint as a grid of dots, and here the three grids sit at almost the same
 * angle and almost the same size. Where two discs overlap, the grids beat
 * against each other and moiré appears: rosettes, ripples and stripes that
 * belong to neither ink. The discs drift and every screen turns very slowly,
 * so the interference keeps rearranging itself.
 *
 * Printed as three screened riso inks.
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

const W = 800, H = 800, RES = 400, SC = W / RES;
let seed, t, inks, discs, img;

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
  inks = shuffle(random([[INK.pink, INK.aqua, INK.yellow], [INK.red, INK.blue, INK.yellow], [INK.violet, INK.orange, INK.aqua], [INK.pink, INK.teal, INK.yellow]]));
  const a0 = random(90);
  discs = inks.map((ink, k) => ({
    ink, r: random(100, 145), dir: random(TWO_PI),
    ax: random(70, 120), ay: random(70, 120), fx: random(0.6, 1.4), fy: random(0.6, 1.4), px: random(TWO_PI), py: random(TWO_PI),
    angle: a0 + k * random(1.5, 3.5), spin: random(-1, 1) * 2.5, cell: 10 + k * random(0.2, 0.5), sp: random(TWO_PI),
  }));
  t = 0;
}

function draw() {
  const T = t / 30;
  img.loadPixels();
  const P = img.pixels;
  const cs = discs.map(d => ({ x: RES / 2 + d.ax * Math.sin(T * 0.11 * d.fx + d.px), y: RES / 2 + d.ay * Math.sin(T * 0.09 * d.fy + d.py), r: d.r, c: Math.cos(d.dir + T * 0.05), s: Math.sin(d.dir + T * 0.05) }));
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const p = (y * RES + x) * 4;
    for (let k = 0; k < 3; k++) {
      const d = cs[k], dx = x - d.x, dy = y - d.y, q = Math.hypot(dx, dy) / d.r;
      // a smooth tint across the disc, with a soft rim one pixel wide
      P[p + k] = q < 1 ? Math.min(1, (1 - q) * d.r) * (0.1 + 0.34 * (0.5 + 0.5 * (dx * d.c + dy * d.s) / d.r)) * 255 : 0;
    }
    P[p + 3] = 255;
  }
  img.updatePixels();
  // the screens turn very slowly, each at its own pace
  risoPrint(img, img, discs.map((d, k) => ({ ch: k, ink: d.ink, angle: d.angle + d.spin * Math.sin(T * 0.07 + d.sp), cell: d.cell })));
  t++;
}
