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
 * Nobody switches the signs. They form an excitable medium (Greenberg–
 * Hastings): a dark sign lights up when a sign it touches is lit, then
 * glows down through a few steps of afterglow during which it cannot fire
 * again. Waves of light run across the facade and collide. The rule is
 * deterministic, so the facade must eventually repeat itself: the loop is
 * that cycle, found by remembering every state. Each time a sign fires it
 * shows the next word of its own list.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const GLYPHS = 28;
const BG = [14, 12, 22];
const PALETTE = [
  [255, 46, 136], [0, 200, 230], [255, 226, 0], [60, 230, 110],
  [255, 120, 30], [140, 70, 255], [255, 40, 60],
];

let alphabet = [], next = [], signs = [], cycle = [], ground;

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
    signs.push({
      x, y, w, h, raw: [x0, y0, w0, h0], vertical, gs, gw, gap, n, rows, pitch,
      col: random(PALETTE), inv: random() < 0.3, sw: Math.max(2, gs * 0.09),
      rest: 3 + (random(4) | 0),              // refractory steps after firing
    });
  }
}

// neighbours: panels whose rectangles share a stretch of border
function linkSigns() {
  const touch = (a, b) => {
    const [ax, ay, aw, ah] = a.raw, [bx, by, bw, bh] = b.raw, e = 0.5;
    const ovX = Math.min(ax + aw, bx + bw) - Math.max(ax, bx), ovY = Math.min(ay + ah, by + bh) - Math.max(ay, by);
    return (ovY > 10 && (Math.abs(ax + aw - bx) < e || Math.abs(bx + bw - ax) < e))
        || (ovX > 10 && (Math.abs(ay + ah - by) < e || Math.abs(by + bh - ay) < e));
  };
  for (const a of signs) a.nb = signs.map((b, j) => (a !== b && touch(a, b)) ? j : -1).filter(j => j >= 0);
}

// Greenberg–Hastings excitable medium on the facade graph: 0 = dark, 1 = firing, 2..rest+1 = afterglow.
// A dark sign fires when a neighbour is firing. The rule is deterministic, so the facade must fall into a
// cycle; the loop is that cycle, found by remembering every state.
function simulate() {
  for (let attempt = 0; ; attempt++) {
    let st = signs.map(() => random() < 0.3 ? 1 : (random() < 0.5 ? 0 : 2 + (random(3) | 0)));
    const step = a => a.map((v, i) => {
      if (v === 0) return signs[i].nb.some(j => a[j] === 1) ? 1 : 0;
      return v >= signs[i].rest + 1 ? 0 : v + 1;
    });
    const seen = new Map(), hist = [];
    for (let k = 0; k < 4000; k++) {
      const key = st.join(',');
      if (seen.has(key)) {
        const cyc = hist.slice(seen.get(key));
        const lit = new Set(); cyc.forEach(a => a.forEach((v, i) => { if (v === 1) lit.add(i); }));
        // keep a cycle long enough to read but short enough to loop, in which most of the facade takes part
        if (cyc.length >= 24 && cyc.length <= 72 && lit.size > signs.length * 0.7) { cycle = cyc; return; }
        break;
      }
      seen.set(key, k); hist.push(st); st = step(st);
    }
  }
}

// each firing of a sign shows the next word of its own list
function assignWords() {
  for (let i = 0; i < signs.length; i++) {
    const s = signs[i]; s.words = []; s.wordAt = [];
    // the word shown at step k is the one from its latest firing (wrapping around the cycle)
    const fires = cycle.map(a => a[i] === 1);
    const nFire = Math.max(1, fires.filter(Boolean).length);
    for (let f = 0; f < nFire; f++) { const lines = []; for (let r = 0; r < s.rows; r++) lines.push(word(s.n)); s.words.push(lines); }
    let cur = nFire - 1;
    for (let k = 0; k < cycle.length; k++) { if (fires[k]) cur = (cur + 1) % nFire; s.wordAt.push(cur); }
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

// draw a sign's lines of text
function drawWord(s, lines, ink) {
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
      segs.push([ax, ay, bx, by]);
    }
  }));
  stroke(ink); strokeWeight(s.sw); strokeCap(ROUND); noFill();
  for (const [ax, ay, bx, by] of segs) line(ax, ay, bx, by);
}

function renderPhase(t) {
  image(ground, 0, 0);
  const k = Math.min(cycle.length - 1, Math.floor(t * cycle.length));
  const state = cycle[k];
  for (let i = 0; i < signs.length; i++) {
    const s = signs[i], v = state[i], c = s.col;
    const lines = s.words[s.wordAt[k]];
    const dim = color(c[0] * 0.28, c[1] * 0.28, c[2] * 0.28);
    // firing = full light; afterglow fades step by step back to dark tubes
    const glow = v === 1 ? 1 : v > 1 ? 1 - (v - 1) / (s.rest + 1) : 0;
    const ink = lerpColor(dim, color(...c), glow);
    if (s.inv && v === 1) {
      noStroke(); fill(ink); rect(s.x, s.y, s.w, s.h, 4);
      drawWord(s, lines, color(...BG));
    } else {
      noFill(); stroke(ink); strokeWeight(3); rect(s.x, s.y, s.w, s.h, 6);
      drawWord(s, lines, ink);
    }
  }
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const STEP_FRAMES = 9;           // frames per step of the rule
let LOOP_FRAMES;                 // the cycle length decides the loop
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
  linkSigns();
  simulate();
  assignWords();
  LOOP_FRAMES = cycle.length * STEP_FRAMES;

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
