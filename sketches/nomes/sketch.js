/**
 * Nomes
 *
 * Inspired by Margaret Atwood's The Handmaid's Tale, where women lose their
 * names and are called after the man they are assigned to.
 *
 * A typed page of women's names. An erasure front, shaped by a noise field,
 * sweeps the page and turns every letter it reaches into the same mark: a red
 * cloak with a white wedge where a face would be. A handful of names do not
 * give way. Once the page is uniform, the names come back, spreading outward
 * from the ones that held, letter by letter, until the page is whole again.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new page
 */

const W = 800, H = 800;
const PAPER = [238, 230, 212];
const INK = [172, 26, 32];
const TYPE = [40, 36, 44];

const NAMES = ['MARIA', 'ANA', 'CLARA', 'JOANA', 'LUIZA', 'HELENA', 'BEATRIZ', 'JULIA', 'LAURA',
  'CECILIA', 'SOFIA', 'ROSA', 'TEREZA', 'IRENE', 'MARTA', 'LUCIA', 'DORA', 'NAIR', 'VERA', 'BRUNA',
  'CARLA', 'ELISA', 'FLORA', 'GLORIA', 'IRIS', 'LIA', 'MIRIAM', 'NINA', 'OLGA', 'MARIELLE', 'DANDARA',
  'ZILDA', 'ANTONIA', 'BENEDITA', 'CONCEICAO', 'ESPERANCA', 'RITA', 'YARA', 'JUREMA', 'IARA'];
const FONT = "'Courier 10 Pitch', 'Courier New', Courier, monospace";
const CW = 13, LH = 26, MARGIN = 30;
const HELD = 6;              // names that never give way

const LOOP_SECONDS = 14;
const ERASE = [0.04, 0.52];  // the erasure front crosses the page
const RETURN = [0.62, 0.97]; // the names come back from the ones that held
const FLIP = 0.025;          // duration of one letter's turn

let seed = 8;
let letters = [];            // { ch, x, y, held, e, r, jx, jy, a }
let paper;
let frame = 0;

function buildPage() {
  randomSeed(seed); noiseSeed(seed);
  letters = [];
  const words = [];
  let x = MARGIN, y = 50;
  while (y < H - 20) {
    const name = random(NAMES);
    if (x + name.length * CW > W - MARGIN) { x = MARGIN; y += LH; continue; }
    words.push({ name, x, y });
    x += (name.length + 1) * CW;
  }
  const held = new Set();
  while (held.size < HELD) held.add(Math.floor(random(words.length)));
  const heldPts = [...held].map((i) => ({ x: words[i].x + words[i].name.length * CW / 2, y: words[i].y }));
  words.forEach((w, wi) => {
    for (let c = 0; c < w.name.length; c++) {
      const lx = w.x + c * CW, ly = w.y;
      // when the erasure reaches this letter (0..1 over the ERASE window)
      const e = constrain(noise(lx * 0.004, ly * 0.006) * 0.9 + (lx + ly) / 1600 * 0.6 - 0.15, 0, 1);
      // when the name returns: by distance to the nearest name that held
      let d = Infinity;
      for (const p of heldPts) d = Math.min(d, Math.hypot(lx - p.x, ly - p.y));
      const r = constrain(d / 900 + random(0, 0.04), 0, 1);
      letters.push({ ch: w.name[c], x: lx, y: ly, held: held.has(wi), e, r,
        jx: random(-0.4, 0.4), jy: random(-0.6, 0.6), a: random(150, 230) });
    }
  });
  paper = createGraphics(W, H);
  paper.pixelDensity(1);
  paper.background(PAPER);
  paper.loadPixels();
  for (let i = 0; i < paper.pixels.length; i += 4) {
    const g = random(-7, 5); paper.pixels[i] += g; paper.pixels[i + 1] += g; paper.pixels[i + 2] += g;
  }
  paper.updatePixels();
}

const ease = (t) => t * t * (3 - 2 * t);
const window01 = (t, [a, b]) => (t - a) / (b - a);

function mark(x, y) {
  noStroke(); fill(INK[0], INK[1], INK[2], 225);
  beginShape(); vertex(x + 2, y + 2); vertex(x + 11, y + 2); vertex(x + 9, y - 10); vertex(x + 4, y - 10); endShape(CLOSE);
  fill(PAPER); triangle(x + 4, y - 11, x + 12, y - 15, x + 10, y - 8);
}

function renderPhase(t) {
  image(paper, 0, 0);
  textFont(FONT); textSize(20); textAlign(LEFT, BASELINE);
  const et = window01(t, ERASE), rt = window01(t, RETURN);
  for (const L of letters) {
    // s: 0 = letter, 1 = mark. Erased when the front passes, restored when the return reaches it.
    let s = 0;
    if (!L.held) {
      const on = constrain((et - L.e * (1 - FLIP * 4)) / (FLIP * 4), 0, 1);
      const off = constrain((rt - L.r * (1 - FLIP * 4)) / (FLIP * 4), 0, 1);
      s = ease(on) * (1 - ease(off));
    }
    // a letter turns over like a card: squash to nothing, then open as the other face
    const sy = Math.abs(Math.cos(Math.PI * s));
    push();
    translate(L.x + L.jx + CW / 2, L.y + L.jy - 6);
    scale(1, Math.max(0.02, sy));
    translate(-CW / 2, 6);
    if (s < 0.5) {
      noStroke(); fill(L.held ? 20 : TYPE[0], L.held ? 20 : TYPE[1], L.held ? 30 : TYPE[2], L.held ? 255 : L.a);
      text(L.ch, 0, 0);
    } else {
      mark(0, 0);
    }
    pop();
  }
  // the names that held are underlined, as if by hand
  stroke(20, 20, 30, 110); strokeWeight(1);
  let run = null;
  for (const L of letters) {
    if (L.held) {
      if (run && run.y === L.y && L.x - run.x2 <= CW) run.x2 = L.x + CW;
      else { if (run) line(run.x1, run.y + 5, run.x2, run.y + 6); run = { x1: L.x, x2: L.x + CW, y: L.y }; }
    }
  }
  if (run) line(run.x1, run.y + 5, run.x2, run.y + 6);
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  buildPage();

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
  if (key === 's' || key === 'S') saveCanvas('nomes', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    buildPage();
  }
}
