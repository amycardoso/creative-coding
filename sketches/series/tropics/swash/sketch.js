/**
 * Swash
 *
 * Tropics #3.
 *
 * The edge of a beach seen from straight above. Waves come in one after
 * another. Each one rushes up the sand to a reach that varies along the
 * beach (a mix of slow and fast noise, with an occasional big set), leaves
 * a line of foam and debris where it stops, and slides back. On the way up
 * it wipes out every older line it covers. What stays on the sand is only
 * what no later wave has reached: a record of the waves that have not yet
 * been erased, the newest ones sharpest. The tide slowly rises and then
 * falls over the cycle, and the beach starts again on a new seed.
 *
 * Printed as a four-ink risograph: sunflower sand, aqua water, and lines
 * of pink and blue.
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

const W = 800, H = 800, ROWS = 400, RY = H / ROWS, RES = 400, PERIOD = 46, CYCLE = 1380;
let seed, t, marks, wave, n, ang, img, lines;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES);
  lines = createGraphics(W, H); lines.pixelDensity(1);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  marks = []; n = 0; ang = random(-0.25, 0.25); t = 0;
  wave = newWave();
}

function base(y) { return 150 + 60 * Math.sin(PI * t / CYCLE) + y * ang; }

function newWave() {
  const big = random() ** 2, r = new Float32Array(ROWS), k = n++;
  for (let j = 0; j < ROWS; j++) {
    const y = j * RY;
    r[j] = base(y) + 60 + big * 230 + (noise(y * 0.006, k * 0.7) - 0.5) * 220 + (noise(y * 0.03, k * 3.1) - 0.5) * 40;
  }
  return { r, born: t, ink: k % 3 === 0 ? 0 : 1, front: new Float32Array(ROWS) };
}

function draw() {
  const p = (t - wave.born) / PERIOD;                 // 0..1 for each wave
  const up = p < 0.45 ? sin(HALF_PI * p / 0.45) : 1 - ease((p - 0.45) / 0.55);
  for (let j = 0; j < ROWS; j++) {
    const b = base(j * RY) - 30;
    wave.front[j] = b + (wave.r[j] - b) * up;
  }
  // the rising wave erases every older line it covers
  if (p < 0.45) for (const m of marks) for (let j = 0; j < ROWS; j++) if (m.alive[j] && m.r[j] < wave.front[j] + 2) m.alive[j] = 0;
  if (p >= 0.45 && !wave.left) { wave.left = true; marks.push({ r: wave.r, ink: wave.ink, born: t, alive: new Uint8Array(ROWS).fill(1) }); }
  if (p >= 1) wave = newWave();
  marks = marks.filter(m => m.alive.some(v => v));

  // lines: pink and blue channels of a 2D layer, older lines thinner and paler
  lines.blendMode(BLEND); lines.background(0); lines.blendMode(ADD);
  const ctx = lines.drawingContext;
  for (const m of marks) {
    const age = constrain((t - m.born) / 900, 0, 1), v = 255 * (1 - age * 0.6);
    ctx.strokeStyle = m.ink === 0 ? `rgb(${v},0,0)` : `rgb(0,${v * 0.85},0)`;
    ctx.lineWidth = 1.6 + 3 * (1 - age);
    ctx.beginPath();
    let open = false;
    for (let j = 0; j < ROWS; j++) {
      if (!m.alive[j]) { open = false; continue; }
      if (!open) { ctx.moveTo(m.r[j], j * RY); open = true; } else ctx.lineTo(m.r[j], j * RY);
    }
    ctx.stroke();
  }
  // water, its foam edge, wet sand behind the newest marks, and dry sand
  img.loadPixels();
  const D = img.pixels, sc = W / RES;
  for (let py = 0; py < RES; py++) {
    const j = py, fr = wave.front[j], y = py * sc;
    let reach = fr; for (const m of marks) if (m.alive[j]) reach = Math.max(reach, m.r[j]);
    const sea = base(y) - 30 + 20 * noise(y * 0.02, t * 0.01);
    for (let px = 0; px < RES; px++) {
      const x = px * sc, i = (py * RES + px) * 4;
      const water = x < fr ? 1 : 0, deep = x < sea ? 1 : 0;
      const foam = water ? Math.pow(noise(x * 0.05, y * 0.02, t * 0.05), 3) * (deep ? 1.2 : 2.2) + (fr - x < 8 ? 0.7 : 0) : 0;
      const wet = x < reach ? constrain(1 - (x - fr) / 120, 0.25, 1) : 0;
      D[i] = water ? 0 : (0.3 - wet * 0.1) * 255;                                        // sand
      D[i + 1] = constrain(water * (0.45 + 0.3 * deep) + (water ? 0 : wet * 0.22) - foam, 0, 1) * 255; // water
      D[i + 2] = water ? 0 : 0.06 * 255;                                                   // warm tint
      D[i + 3] = 255;
    }
  }
  img.updatePixels();
  risoPrint(img, lines, [
    { ch: 0, ink: INK.sun, angle: 0 },
    { ch: 1, ink: INK.aqua, angle: 75 },
    { ch: 2, ink: INK.pink, angle: 15 },
    { ch: 3, ink: INK.pink, solid: true },
    { ch: 4, ink: INK.blue, solid: true },
  ]);
  t++;
  if (t >= CYCLE) restart(floor(random(1e6)));
}

function ease(x) { x = constrain(x, 0, 1); return x * x * (3 - 2 * x); }
