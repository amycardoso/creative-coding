/**
 * A Curva
 *
 * A study in brasilidade after Oscar Niemeyer: "I am not attracted to the
 * straight line, hard and inflexible. I am attracted to the free-flowing,
 * sensual curve — the curve of the mountains, the rivers, the beloved woman."
 *
 * No literal buildings — only his vocabulary of white concrete abstracted into
 * pure geometry: the sail columns of the Alvorada, a convex dome and concave
 * bowl, a tall leaning blade. They stand at the edge of a still reflecting pool
 * (the Esplanada) while the sun arcs through golden hour: an afternoon-blue sky
 * sinking through gold to rose and back, in a seamless loop. Each load composes
 * a new arrangement.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new composition
 */

const WIDTH = 800;
const HEIGHT = 800;
const LOOP_SECONDS = 18.0;
const TAU = Math.PI * 2;

const WATER_Y = Math.round(HEIGHT * 0.72); // horizon / waterline

// Golden-hour endpoints, lerped by `warmth` (0 = afternoon, 1 = sunset).
const AFT_TOP = [40, 92, 150], SET_TOP = [48, 52, 104];
const AFT_MID = [122, 168, 206], SET_MID = [233, 138, 86];
const AFT_HOR = [223, 206, 172], SET_HOR = [244, 178, 150];

let pg; // above-water scene buffer (re-used for the pool reflection)
let seed = 7;
let comp; // current composition

// Per-frame palette, set in draw() and read by the helpers.
let SKY, CONC, SUN_COL, HOR, POOL;

// Capture hook (inert during normal viewing) — see docs/CAPTURE.md.
let captureT = null;
function loopTime() {
  if (captureT !== null) return captureT;
  return (millis() / 1000.0) % LOOP_SECONDS / LOOP_SECONDS;
}

// --- small helpers ----------------------------------------------------------
const lerpArr = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const brighten = (c, n) => [Math.min(255, c[0] + n), Math.min(255, c[1] + n), Math.min(255, c[2] + n)];

// Deterministic seeded RNG so SPACE gives reproducible compositions.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixed cloud field (independent of the composition seed) — periodic over the
// loop because it simply scrolls one full width.
const CLOUDS = [
  { x: 0.10, y: 0.22, s: 78 }, { x: 0.34, y: 0.15, s: 60 },
  { x: 0.52, y: 0.30, s: 92 }, { x: 0.71, y: 0.18, s: 66 },
  { x: 0.88, y: 0.27, s: 84 }, { x: 0.20, y: 0.38, s: 54 },
];

function buildComposition(s) {
  const r = mulberry32(s);
  const c = { blades: [], columns: [], dome: null, bowl: null };

  // Back layer: 1–2 tall leaning blades (hazy, far off).
  const nBlade = 1 + (r() < 0.45 ? 1 : 0);
  for (let i = 0; i < nBlade; i++) {
    c.blades.push({
      x: (0.18 + r() * 0.64) * WIDTH,
      h: (0.5 + r() * 0.22) * WATER_Y,
      lean: (r() * 2 - 1) * 0.55,
    });
  }

  // Mid layer: a colonnade of sail columns.
  const n = 3 + Math.floor(r() * 4); // 3–6
  const colH = (0.26 + r() * 0.13) * WATER_Y;
  const bw = colH * 0.14;
  const spacing = colH * 0.34;
  const cx = (0.34 + r() * 0.32) * WIDTH;
  for (let k = 0; k < n; k++) {
    c.columns.push({ x: cx + (k - (n - 1) / 2) * spacing, h: colH, bw });
  }

  // Front accents: a convex dome + concave bowl pair, off to one side.
  const side = r() < 0.5 ? -1 : 1;
  const gx = WIDTH * 0.5 + side * (0.26 + r() * 0.1) * WIDTH;
  const dr = (0.07 + r() * 0.03) * WATER_Y;
  c.dome = { x: gx + dr * 1.15, r: dr };
  c.bowl = { x: gx - dr * 1.15, r: dr * 0.92 };
  return c;
}

// --- scene above the waterline (drawn into pg) ------------------------------
function drawSky(g) {
  const grad = g.drawingContext.createLinearGradient(0, 0, 0, g.height);
  grad.addColorStop(0.0, css(SKY.top));
  grad.addColorStop(0.58, css(SKY.mid));
  grad.addColorStop(1.0, css(SKY.hor));
  g.drawingContext.fillStyle = grad;
  g.drawingContext.fillRect(0, 0, g.width, g.height);
}

function drawSun(g, x, y) {
  const R = WATER_Y * 0.55;
  const grad = g.drawingContext.createRadialGradient(x, y, 0, x, y, R);
  grad.addColorStop(0.0, css(SUN_COL, 0.95));
  grad.addColorStop(0.12, css(SUN_COL, 0.55));
  grad.addColorStop(0.4, css(SUN_COL, 0.12));
  grad.addColorStop(1.0, css(SUN_COL, 0.0));
  g.drawingContext.fillStyle = grad;
  g.drawingContext.fillRect(0, 0, g.width, g.height);
  g.noStroke();
  g.fill(SUN_COL[0], SUN_COL[1], SUN_COL[2]);
  g.circle(x, y, WATER_Y * 0.075);
}

// A soft, flattened blob with feathered edges (radial-gradient alpha, scaled
// into a lens) — no hard contour rings.
function softLens(g, x, y, w, hRatio, col, a) {
  g.push();
  g.translate(x, y);
  g.scale(1, hRatio);
  const grad = g.drawingContext.createRadialGradient(0, 0, 0, 0, 0, w);
  grad.addColorStop(0.0, css(col, a));
  grad.addColorStop(0.55, css(col, a * 0.45));
  grad.addColorStop(1.0, css(col, 0));
  g.drawingContext.fillStyle = grad;
  g.drawingContext.beginPath();
  g.drawingContext.arc(0, 0, w, 0, TAU);
  g.drawingContext.fill();
  g.pop();
}

function puff(g, x, y, s, col, a) {
  softLens(g, x, y, s * 1.1, 0.34, col, a);
  softLens(g, x - s * 0.5, y + s * 0.05, s * 0.7, 0.3, col, a * 0.8);
  softLens(g, x + s * 0.6, y + s * 0.04, s * 0.8, 0.3, col, a * 0.8);
}

function drawClouds(g, t) {
  const col = lerpArr([255, 255, 255], [250, 198, 178], 0.85 * SKY.warmth);
  const dx = WIDTH * t;
  for (const c of CLOUDS) {
    const baseX = (c.x * WIDTH + dx) % WIDTH;
    for (const k of [-1, 0]) {
      puff(g, baseX + k * WIDTH, c.y * WATER_Y, c.s, col, 0.5);
    }
  }
}

function sailShape(g, cx, baseY, h, bw) {
  const topY = baseY - h;
  g.beginShape();
  g.vertex(cx, baseY);
  g.bezierVertex(cx - bw, baseY - h * 0.33, cx - bw, baseY - h * 0.68, cx, topY);
  g.bezierVertex(cx + bw, baseY - h * 0.68, cx + bw, baseY - h * 0.33, cx, baseY);
  g.endShape(CLOSE);
}

function drawSail(g, col, baseY, sunX) {
  // Flat lit body + a soft shadow sliver pushed to the anti-sun side.
  g.noStroke();
  g.fill(CONC.lit[0], CONC.lit[1], CONC.lit[2]);
  sailShape(g, col.x, baseY, col.h, col.bw);
  const sgn = sunX > col.x ? -1 : 1;
  g.push();
  g.translate(sgn * col.bw * 0.42, 0);
  g.fill(CONC.shadow[0], CONC.shadow[1], CONC.shadow[2], 120);
  sailShape(g, col.x, baseY, col.h, col.bw);
  g.pop();
}

function arcTop(g, cx, baseY, r) { g.arc(cx, baseY, r * 2, r * 2, Math.PI, TAU); }

function drawDome(g, d, baseY, sunX) {
  const sx = sunX > d.x ? 1 : -1;
  g.noStroke();
  g.fill(CONC.shadow[0], CONC.shadow[1], CONC.shadow[2]); arcTop(g, d.x, baseY, d.r);
  g.fill(CONC.lit[0], CONC.lit[1], CONC.lit[2]); arcTop(g, d.x + sx * d.r * 0.13, baseY, d.r * 0.86);
  const b = brighten(CONC.lit, 14);
  g.fill(b[0], b[1], b[2]); arcTop(g, d.x + sx * d.r * 0.24, baseY, d.r * 0.5);
}

function drawBowl(g, b, baseY) {
  g.noStroke();
  g.fill(CONC.lit[0], CONC.lit[1], CONC.lit[2]);
  g.arc(b.x, baseY, b.r * 2.3, b.r * 1.25, 0, Math.PI); // dish bulging down
  g.fill(CONC.shadow[0], CONC.shadow[1], CONC.shadow[2], 150);
  g.arc(b.x, baseY - 2, b.r * 1.95, b.r * 0.5, 0, Math.PI); // hollow rim shadow
}

function drawBlade(g, bl, baseY) {
  const haze = lerpArr(CONC.lit, HOR, 0.5);
  const w = bl.h * 0.4, ax = bl.x + bl.lean * w * 0.6, ay = baseY - bl.h;
  g.noStroke();
  g.fill(haze[0], haze[1], haze[2], 235);
  g.beginShape();
  g.vertex(bl.x - w * 0.3, baseY);
  g.bezierVertex(bl.x - w * 0.2, baseY - bl.h * 0.5, ax - w * 0.2, ay + bl.h * 0.12, ax, ay);
  g.bezierVertex(ax + w * 0.06, ay + bl.h * 0.04, bl.x + w * 0.12, baseY - bl.h * 0.5, bl.x + w * 0.06, baseY);
  g.endShape(CLOSE);
}

function drawScene(g, t, sunX, sunY) {
  drawSky(g);
  drawSun(g, sunX, sunY);
  drawClouds(g, t);
  const baseY = g.height; // forms stand at the waterline (bottom of buffer)
  for (const bl of comp.blades) drawBlade(g, bl, baseY);
  for (const col of comp.columns) drawSail(g, col, baseY, sunX);
  drawBowl(g, comp.bowl, baseY);
  drawDome(g, comp.dome, baseY, sunX);
}

// --- main -------------------------------------------------------------------
function setup() {
  const cnv = createCanvas(WIDTH, HEIGHT);
  cnv.parent('canvas-container');
  pixelDensity(1);
  pg = createGraphics(WIDTH, WATER_Y);
  pg.pixelDensity(1);

  const p = new URLSearchParams(window.location.search);
  if (p.has('seed')) seed = parseInt(p.get('seed'), 10) || seed;
  comp = buildComposition(seed);

  window.__captureFrame = (i, n) => { captureT = (((i % n) + n) % n) / n; redraw(); };
  if (p.has('f') && p.has('n')) {
    noLoop();
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  const t = loopTime();

  // Sun arcs up at t=0 (afternoon) down to the horizon at t=0.5 (sunset) and
  // back — sine-driven so the loop is seamless and never goes to night.
  const h = (Math.cos(TAU * t) + 1) / 2;        // 1 high, 0 low
  const warmth = 1 - h;
  const sunX = WIDTH * 0.5 + WIDTH * 0.34 * Math.sin(TAU * t);
  const sunY = WATER_Y - (WATER_Y * 0.12 + WATER_Y * 0.66 * h);

  SKY = { top: lerpArr(AFT_TOP, SET_TOP, warmth), mid: lerpArr(AFT_MID, SET_MID, warmth),
          hor: lerpArr(AFT_HOR, SET_HOR, warmth), warmth };
  HOR = SKY.hor;
  CONC = { lit: lerpArr([244, 241, 233], [250, 224, 202], warmth),
           shadow: lerpArr([198, 194, 184], [206, 168, 148], warmth) };
  SUN_COL = lerpArr([255, 243, 214], [255, 208, 168], warmth);
  POOL = lerpArr([42, 70, 102], [56, 46, 82], warmth);

  drawScene(pg, t, sunX, sunY);
  image(pg, 0, 0);                  // above-water scene

  // Reflection: mirror the buffer down into the pool, slice by slice with a
  // depth-growing ripple, then fade it into the water colour.
  const reflectH = HEIGHT - WATER_Y;
  noStroke();
  for (let yy = 0; yy < reflectH; yy += 2) {
    const depth = yy / reflectH;
    const wob = (2 + depth * 6) * Math.sin(yy * 0.07 + t * TAU);
    const srcY = WATER_Y - 2 - yy;
    if (srcY < 0) break;
    image(pg, wob, WATER_Y + yy, WIDTH, 2, 0, srcY, WIDTH, 2);
  }
  const fade = drawingContext.createLinearGradient(0, WATER_Y, 0, HEIGHT);
  fade.addColorStop(0, css(HOR, 0.1));
  fade.addColorStop(1, css(POOL, 0.85));
  drawingContext.fillStyle = fade;
  drawingContext.fillRect(0, WATER_Y, WIDTH, reflectH);

  // Sun glitter on the water under the sun.
  if (sunY < WATER_Y) {
    noStroke();
    for (let i = 0; i < 12; i++) {
      const yy = WATER_Y + (i + 0.5) * (reflectH / 12);
      const flick = 0.45 + 0.45 * Math.sin(i * 1.3 + t * TAU * 2);
      const a = flick * 46 * (1 - i / 14);
      fill(SUN_COL[0], SUN_COL[1], SUN_COL[2], a);
      ellipse(sunX + Math.sin(i * 2.1 + t * TAU) * 4, yy, WIDTH * 0.05 * (1 - i / 16), 3);
    }
  }

  // Crisp waterline.
  stroke(255, 255, 255, 55);
  strokeWeight(1.5);
  line(0, WATER_Y, WIDTH, WATER_Y);
  noStroke();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('a-curva', 'png');
  } else if (key === ' ') {
    seed = Math.floor(Math.random() * 1e9);
    comp = buildComposition(seed);
    if (captureT !== null) redraw();
  }
}
