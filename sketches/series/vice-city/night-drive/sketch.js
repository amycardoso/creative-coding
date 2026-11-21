/**
 * Night Drive
 *
 * Vice City #3.
 *
 * A long exposure of a neighbourhood at night, taken from above. The
 * street grid is jittered, a few blocks are missing and one avenue cuts
 * across diagonally. Every crossing has a traffic light with its own
 * period, and a few hundred cars follow the one in front of them: speed
 * up when the road is clear, brake for the car ahead, stop at the red.
 * Nothing on the page is drawn except what the cars leave behind. Cars
 * coming towards the camera leave headlights (aqua), cars driving away
 * leave tail lights (pink). The bright knots at the corners are not
 * drawn either: they are queues waiting at red lights, exposed for longer.
 * The exposure slowly forgets, so the traffic is always moving; after a
 * while the city changes.
 *
 * Printed as a three-ink risograph: sunflower street lamps, pink, aqua.
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

const W = 800, H = 800, RES = 400, SC = W / RES, CARS = 320, CYCLE = 1500;
let seed, nodes, edges, cars, cam, P, A, S, img, t;

function setup() {
  pixelDensity(1);
  const c = createCanvas(W, H, WEBGL);
  c.parent('canvas-container');
  risoSetup();
  img = createImage(RES, RES);
  restart(pickSeed());
}

function link(a, b) {
  for (const [u, v] of [[a, b], [b, a]]) {
    const e = { a: u, b: v, dx: nodes[v].x - nodes[u].x, dy: nodes[v].y - nodes[u].y, cars: [] };
    e.L = Math.hypot(e.dx, e.dy); e.hor = abs(e.dx) > abs(e.dy);
    edges.push(e); nodes[u].out.push(e);
  }
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed); risoRegister();
  const gc = floor(random(5, 8)), sp = 900 / gc, id = (c, r) => r * (gc + 1) + c;
  nodes = []; edges = []; cars = [];
  for (let r = 0; r <= gc; r++) for (let c = 0; c <= gc; c++)
    nodes.push({ x: -50 + c * sp + random(-sp, sp) * 0.25, y: -50 + r * sp + random(-sp, sp) * 0.25, out: [], ph: random(1), per: random(160, 260) });
  for (let r = 0; r <= gc; r++) for (let c = 0; c <= gc; c++) {
    if (c < gc && random() > 0.15) link(id(c, r), id(c + 1, r));
    if (r < gc && random() > 0.15) link(id(c, r), id(c, r + 1));
  }
  let c = 0, r = floor(random(gc / 2));
  while (c < gc && r < gc) { link(id(c, r), id(c + 1, r + 1)); c++; r++; }
  cam = p5.Vector.fromAngle(random(TWO_PI));
  for (let k = 0; k < CARS; k++) {
    const e = random(edges), car = { e, s: random(e.L), v: 0, vmax: random(1.6, 2.6), lane: random([0, 0, 5]) + random(-1, 1) };
    e.cars.push(car); cars.push(car);
  }
  P = new Float32Array(RES * RES); A = new Float32Array(RES * RES); S = new Float32Array(RES * RES);
  for (const n of nodes) if (n.out.length > 2)
    for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
      const d = Math.hypot(x * SC - n.x, y * SC - n.y) / 40;
      if (d < 1) S[y * RES + x] = max(S[y * RES + x], 0.35 * pow(1 - d, 2));
    }
  t = 0;
  for (let i = 0; i < 300; i++) step();
  t = 0;
}

function step() {
  for (const e of edges) e.cars.sort((p, q) => p.s - q.s);
  for (const e of edges) {
    const n = nodes[e.b], green = (((t / n.per) + n.ph) % 1 < 0.5) === e.hor;
    for (let i = 0; i < e.cars.length; i++) {
      const car = e.cars[i], lead = e.cars[i + 1];
      let lim = lead ? lead.s - car.s - 9 : 1e9;
      if (!green) lim = min(lim, e.L - 10 - car.s);
      car.v = max(0, min(car.v + 0.06, car.vmax, lim * 0.35));
      car.s += car.v;
    }
  }
  for (const car of cars) {
    const e = car.e;
    if (car.s >= e.L) {
      const opts = nodes[e.b].out.filter(o => o.b !== e.a), ne = opts.length ? random(opts) : nodes[e.b].out[0];
      e.cars.splice(e.cars.indexOf(car), 1); car.e = ne; car.s = 0; ne.cars.push(car);
    }
    const E = car.e, ux = E.dx / E.L, uy = E.dy / E.L, off = 4 + car.lane;
    const x = (nodes[E.a].x + ux * car.s - uy * off) / SC, y = (nodes[E.a].y + uy * car.s + ux * off) / SC;
    const F = ux * cam.x + uy * cam.y < 0 ? A : P;
    const xi = round(x), yi = round(y);
    if (xi >= 0 && yi >= 0 && xi < RES && yi < RES) F[yi * RES + xi] += 0.35 / (0.3 + car.v);
  }
  for (let i = 0; i < RES * RES; i++) { P[i] *= 0.998; A[i] *= 0.998; }
  t++;
}

function draw() {
  step(); step();
  img.loadPixels();
  const D = img.pixels;
  for (let i = 0; i < RES * RES; i++) {
    D[i * 4] = S[i] * 255;
    D[i * 4 + 1] = (1 - Math.exp(-P[i] * 1.6)) * 255;
    D[i * 4 + 2] = (1 - Math.exp(-A[i] * 1.6)) * 255;
    D[i * 4 + 3] = 255;
  }
  img.updatePixels();
  risoPrint(img, img, [
    { ch: 0, ink: INK.sun, angle: 0, cell: 4 },
    { ch: 1, ink: INK.pink, solid: true },
    { ch: 2, ink: INK.aqua, solid: true },
  ]);
  if (t >= CYCLE * 2) restart(floor(random(1e6)));
}
