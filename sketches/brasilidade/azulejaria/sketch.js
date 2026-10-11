/**
 * Azulejaria
 *
 * After Athos Bulcão (1918–2008), whose tile panels cover Brasília. He drew a
 * handful of modules and let the workers who laid them choose each tile's
 * turn on the wall, so no two panels came out alike: the composition was
 * handed to chance and to the people building the city.
 *
 * Here the wall keeps being re-laid. Four times per loop a wave passes over
 * the panel (a diagonal sweep, a scatter, a ripple from the centre, a snake
 * row by row) and every tile it touches lifts and turns a quarter. After four
 * passes each tile has made a full turn and the first panel comes back.
 * Glazed ceramic with pooled colour, crackle and chipped edges; the light
 * stays put while the tiles turn under it.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new panel (new modules, new chips and cracks)
 */

const W = 800, H = 800;
const N = 8, T = W / N, GAP = 2.5, TS = T - 2 * GAP;

const BLUE = [24, 58, 140];
const NAVY = [18, 30, 70];
const WHITE = [238, 236, 226];
const GROUT = [196, 190, 176];

const LOOP_SECONDS = 12;
const PASSES = 4;          // quarter turns per tile per loop -> one full turn
const TURN = 0.05;         // duration of a single tile's turn (loop phase)
const SPREAD = 0.15;       // how long one wave takes to cross the panel

let seed = 7;
let tiles = [];            // { g, base, dir, delays[] }
let light;                 // fixed glaze lighting over the whole wall
let frame = 0;

// ---------- modules (drawn in a T×T box, origin top-left) ----------
function drawModule(g, kind) {
  g.noStroke();
  if (kind === 0) {
    g.fill(BLUE); g.arc(0, 0, T, T, 0, Math.PI / 2);
    g.rect(T * 0.62, T * 0.62, T * 0.38, T * 0.38);
  } else if (kind === 1) {
    g.fill(BLUE); g.triangle(0, 0, T, 0, 0, T);
    g.fill(WHITE); g.circle(T * 0.22, T * 0.22, T * 0.26);
  } else if (kind === 2) {
    g.fill(BLUE); g.rect(0, T * 0.38, T, T * 0.24);
    g.fill(NAVY); g.arc(T, T, T * 0.7, T * 0.7, Math.PI, Math.PI * 1.5);
  } else {
    g.fill(BLUE); g.arc(T / 2, 0, T, T, 0, Math.PI);
  }
}

function crackle(g, count) {
  g.stroke(90, 90, 90, 70); g.strokeWeight(0.6); g.noFill();
  for (let c = 0; c < count; c++) {
    let x = random(TS), y = random(TS), a = random(TWO_PI);
    g.beginShape();
    for (let s = 0; s < 6; s++) {
      g.vertex(x, y);
      a += random(-0.9, 0.9);
      x += cos(a) * random(6, 16); y += sin(a) * random(6, 16);
    }
    g.endShape();
  }
}

function makeTile() {
  const g = createGraphics(TS, TS);
  g.pixelDensity(1);
  const tint = random(-8, 6);
  g.background(WHITE[0] + tint, WHITE[1] + tint, WHITE[2] + tint - 2);
  g.push();
  g.translate(-GAP, -GAP);
  drawModule(g, random() < 0.5 ? 0 : floor(random(4)));
  g.pop();
  // glaze pooling: soft mottling baked into the tile, so it turns with it
  g.loadPixels();
  const ox = random(1000), oy = random(1000);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const i = 4 * (y * TS + x);
    const n = noise(ox + x * 0.02, oy + y * 0.02) * 14 - 7 + random(-4, 4);
    g.pixels[i] += n; g.pixels[i + 1] += n; g.pixels[i + 2] += n;
  }
  g.updatePixels();
  crackle(g, floor(random(1, 5)));
  // chipped glaze along the edges
  g.noStroke();
  for (let c = 0; c < floor(random(0, 3)); c++) {
    g.fill(170, 160, 140);
    const e = floor(random(4)), u = random(TS);
    const [x, y] = [[u, 0], [TS, u], [u, TS], [0, u]][e];
    g.ellipse(x, y, random(4, 8), random(4, 9));
  }
  // rounded corners: clear outside a rounded rect
  const m = createGraphics(TS, TS);
  m.pixelDensity(1); m.noStroke(); m.fill(255); m.rect(0, 0, TS, TS, 3);
  const img = g.get(); img.mask(m.get());
  g.remove(); m.remove();
  return img;
}

// ---------- wave orders: each returns a delay in [0, 1] for tile (i, j) ----------
const WAVES = [
  (i, j) => (i + j) / (2 * (N - 1)),                                     // diagonal sweep
  () => random(),                                                        // scatter
  (i, j) => Math.hypot(i - (N - 1) / 2, j - (N - 1) / 2) / Math.hypot((N - 1) / 2, (N - 1) / 2), // ripple
  (i, j) => (j * N + (j % 2 ? N - 1 - i : i)) / (N * N - 1),             // snake
];

function buildWall() {
  randomSeed(seed); noiseSeed(seed);
  for (const t of tiles) if (t.g.remove) t.g.remove();
  tiles = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    tiles.push({
      i, j,
      g: makeTile(),
      base: floor(random(4)),
      dir: (i + j) % 2 ? -1 : 1,
      delays: WAVES.map((w) => w(i, j)),
    });
  }
  buildLight();
}

function buildLight() {
  // per-cell glossy highlight from a fixed window, plus fine grain
  light = createGraphics(W, H);
  light.pixelDensity(1);
  light.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = 4 * (y * W + x);
    const lx = (x % T) / T, ly = (y % T) / T;
    const hi = Math.max(0, 1 - Math.hypot(lx - 0.28, ly - 0.22) * 3.2);
    light.pixels[i] = light.pixels[i + 1] = light.pixels[i + 2] = 255;
    light.pixels[i + 3] = hi * hi * 36 + random(0, 6);
  }
  light.updatePixels();
}

// ---------- rendering ----------
const easeBack = (u) => {
  // quarter turn with a little settle at the end, like a tile seated by hand
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
};

function tileState(tile, t) {
  // angle in quarter turns, and lift in [0, 1] while turning
  let q = tile.base, lift = 0;
  for (let p = 0; p < PASSES; p++) {
    const start = 0.04 + p / PASSES + tile.delays[p] * SPREAD;
    const u = (t - start) / TURN;
    if (u >= 1) q += tile.dir;
    else if (u > 0) { q += tile.dir * easeBack(u); lift = Math.sin(Math.PI * Math.min(1, u * 1.15)); }
  }
  return { q, lift };
}

function renderPhase(t) {
  background(GROUT);
  // grout texture
  noStroke();
  randomSeed(seed + 99);
  for (let k = 0; k < 900; k++) {
    fill(GROUT[0] + random(-14, 6), GROUT[1] + random(-14, 6), GROUT[2] + random(-14, 6));
    rect(random(W), random(H), 2, 2);
  }
  // still tiles first, lifted ones on top
  const states = tiles.map((tile) => ({ tile, ...tileState(tile, t) }));
  states.sort((a, b) => a.lift - b.lift);
  imageMode(CENTER);
  for (const { tile, q, lift } of states) {
    const cx = tile.i * T + T / 2, cy = tile.j * T + T / 2;
    push();
    translate(cx, cy);
    if (lift > 0) {
      // pried out of the wall: shrinks so its corners clear the neighbours
      const s = 1 - 0.18 * lift;
      push();
      translate(4 * lift, 6 * lift); rotate(q * HALF_PI); scale(s);
      noStroke(); fill(40, 36, 30, 80 * lift);
      rect(-TS / 2, -TS / 2, TS, TS, 4);
      pop();
      translate(-2 * lift, -3 * lift);
      rotate(q * HALF_PI);
      scale(s);
    } else {
      rotate(q * HALF_PI);
    }
    image(tile.g, 0, 0);
    pop();
  }
  imageMode(CORNER);
  image(light, 0, 0);
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 60;
const LOOP_FRAMES = LOOP_SECONDS * FPS;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  buildWall();

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
  if (key === 's' || key === 'S') saveCanvas('azulejaria', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    buildWall();
  }
}
