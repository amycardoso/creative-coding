/**
 * Neon Signs
 *
 * Neon #3: a city written in a language nobody taught it.
 *
 * The facade is cut into sign panels by recursive subdivision. Every sign is
 * written in an invented script: a seeded alphabet of 28 glyphs, each one a
 * short walk on a 3x4 grid of nodes. Words are not random strings either:
 * each glyph has three favourite successors (a tiny Markov chain), so the
 * same clusters keep coming back and the signs read like a real language.
 *
 * Each sign lives on its own clock: its tubes light up stroke by stroke,
 * hold, stutter, go dark, and the sign comes back with a new word. Signs
 * repeat 1 to 3 times per loop, so the whole facade loops seamlessly.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const LOOP_SECONDS = 16;
const GLYPHS = 28;
const BG = [14, 12, 22];
const PALETTE = [
  [255, 46, 136], [0, 200, 230], [255, 226, 0], [60, 230, 110],
  [255, 120, 30], [140, 70, 255], [255, 40, 60],
];

let alphabet = [], next = [], signs = [], ground;

function buildAlphabet() {
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]];
  for (let g = 0; g < GLYPHS; g++) {
    const strokes = [], n = 2 + (random(3) | 0);
    for (let s = 0; s < n; s++) {
      let x = random(3) | 0, y = random(4) | 0;
      const pts = [[x, y]];
      for (let k = 0, L = 1 + (random(3) | 0); k < L; k++) {
        const opts = steps.filter(([dx, dy]) => x + dx >= 0 && x + dx < 3 && y + dy >= 0 && y + dy < 4);
        const [dx, dy] = random(opts); x += dx; y += dy; pts.push([x, y]);
      }
      strokes.push(pts);
    }
    alphabet.push(strokes);
    next.push([random(GLYPHS) | 0, random(GLYPHS) | 0, random(GLYPHS) | 0]);
  }
}

function word(n) {
  const w = [random(GLYPHS) | 0];
  while (w.length < n) w.push(random() < 0.8 ? random(next[w[w.length - 1]]) : random(GLYPHS) | 0);
  return w;
}

function buildFacade() {
  const panels = [];
  const split = (x, y, w, h, d) => {
    if (d > 5 || (w * h < 22000 && random() < 0.5) || w < 50 || h < 50) { panels.push([x, y, w, h]); return; }
    const vert = h / w > 1.2 ? false : w / h > 1.2 ? true : random() < 0.5;
    const f = random([0.25, 0.33, 0.5, 0.66, 0.75]);
    if (vert) { split(x, y, w * f, h, d + 1); split(x + w * f, y, w * (1 - f), h, d + 1); }
    else { split(x, y, w, h * f, d + 1); split(x, y + h * f, w, h * (1 - f), d + 1); }
  };
  split(50, 50, 700, 700, 0);
  for (const [x0, y0, w0, h0] of panels) {
    const m = 5, x = x0 + m, y = y0 + m, w = w0 - 2 * m, h = h0 - 2 * m;
    const vertical = h > w, short = vertical ? w : h;
    const gs = Math.min(short * random(0.38, 0.6), random(40, 72)), gw = gs * 0.62, gap = gs * 0.28;
    const pitch = (vertical ? gw : gs) * 1.7, rows = Math.max(1, Math.floor((short - gap * 2) / pitch));
    const len = vertical ? h : w;
    const n = Math.max(1, Math.floor((len - gap * 2) / ((vertical ? gs : gw) + gap)));
    const cycles = random([1, 2, 2, 3]);
    const words = [];
    for (let k = 0; k < cycles; k++) { const lines = []; for (let r = 0; r < rows; r++) lines.push(word(n)); words.push(lines); }
    signs.push({
      x, y, w, h, vertical, gs, gw, gap, n, rows, pitch, cycles, words,
      phase: random(), col: random(PALETTE), inv: random() < 0.3,
      sw: Math.max(2, gs * 0.09), flick: random(1000),
    });
  }
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 7 + noise(x * 0.3, y * 0.3) * 4 + random(-3, 3);
    const i = 4 * (y * W + x);
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

// draw a sign's lines of text, but only the first `amount` (0..1) of its total tube length
function drawWord(s, lines, amount, ink) {
  const total = s.n * ((s.vertical ? s.gs : s.gw) + s.gap) - s.gap;
  const block = (s.rows - 1) * s.pitch;
  const segs = [];
  lines.forEach((glyphs, r) => glyphs.forEach((g, i) => {
    const off = r * s.pitch - block / 2;
    const gx = s.vertical ? s.x + (s.w - s.gw) / 2 + off : s.x + (s.w - total) / 2 + i * (s.gw + s.gap);
    const gy = s.vertical ? s.y + (s.h - total) / 2 + i * (s.gs + s.gap) : s.y + (s.h - s.gs) / 2 + off;
    for (const st of alphabet[g]) for (let k = 1; k < st.length; k++) {
      const ax = gx + st[k - 1][0] / 2 * s.gw, ay = gy + st[k - 1][1] / 3 * s.gs;
      const bx = gx + st[k][0] / 2 * s.gw, by = gy + st[k][1] / 3 * s.gs;
      segs.push([ax, ay, bx, by, Math.hypot(bx - ax, by - ay)]);
    }
  }));
  let budget = amount * segs.reduce((a, q) => a + q[4], 0);
  stroke(ink); strokeWeight(s.sw); strokeCap(ROUND); noFill();
  for (const [ax, ay, bx, by, l] of segs) {
    if (budget <= 0) break;
    const f = Math.min(1, budget / l);
    line(ax, ay, ax + (bx - ax) * f, ay + (by - ay) * f);
    budget -= l;
  }
}

function renderPhase(t) {
  image(ground, 0, 0);
  for (const s of signs) {
    const u = (t * s.cycles + s.phase) % 1;
    const k = Math.floor(((t * s.cycles + s.phase) % s.cycles));
    const c = s.col;
    // stutter: a few quick drop-outs just before the sign dies
    const stutter = u > 0.8 && u < 0.88 && noise(s.flick, u * 60) < 0.45;
    const on = u < 0.88 && !stutter;
    const written = constrain(u / 0.25, 0, 1);
    const lit = color(...c), dim = color(c[0] * 0.28, c[1] * 0.28, c[2] * 0.28);
    if (s.inv && on && written >= 1) {
      noStroke(); fill(lit); rect(s.x, s.y, s.w, s.h, 4);
      drawWord(s, s.words[k], 1, color(...BG));
    } else {
      noFill(); stroke(on ? lit : dim); strokeWeight(3); rect(s.x, s.y, s.w, s.h, 6);
      drawWord(s, s.words[k], 1, dim);                   // unlit tubes stay faintly visible
      if (on) drawWord(s, s.words[k], written, lit);
    }
  }
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  randomSeed(4); noiseSeed(4);
  buildGround();
  buildAlphabet();
  buildFacade();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    noLoop();
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  const p = new URLSearchParams(window.location.search);
  if (p.has('f') && p.has('n')) {
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  renderPhase(frame / LOOP_FRAMES);
  if (isLooping()) frame = (frame + 1) % LOOP_FRAMES;
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('neon-signs', 'png');
}
