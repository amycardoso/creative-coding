/**
 * Groove
 *
 * A record cut by a composer that never repeats. Each cycle a small
 * generative composer writes a new album side: a random walk over a minor
 * scale picks the notes, each track draws its own loudness, density and FM
 * timbre, and silent runs separate the tracks. A cutting stylus then
 * writes that signal into one spiral, outside in, pushing the groove
 * sideways exactly as a lathe would.
 *
 * Nothing is drawn as a picture of a record: the only mark is the stylus
 * path, and its shape is the music. Loud passages swell into wide, dense
 * bands; quiet ones thin to a hairline; the gaps between tracks are clean
 * rings. When the side is full it is wiped and the next album begins.
 *
 * ?seed=N fixes the composition (the GIF uses seed 11); otherwise every
 * visit composes something new.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800, CX = 400, CY = 400;
const R_OUT = 370, R_IN = 118, PITCH = 7;        // px between turns of the groove
const TURNS = (R_OUT - R_IN) / PITCH;
const TRACKS = 5, GAP = 1;                     // silent turns between tracks
const SWING = 5.5;                               // max sideways cut in px
const CUT = 0.86, HOLD = 0.93;                   // phase windows: cutting, holding, wiping
const LOOP_SECONDS = 20;
const PAPER = [236, 230, 218], INK = [24, 24, 30], RED = [184, 48, 38];

let notes, path, ground, seed;

// ---------- the composer ----------
function compose() {
  randomSeed(seed);
  notes = [];
  const scale = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];
  let T = 0.4;
  const len = (TURNS - 0.8) / TRACKS - GAP;
  for (let tr = 0; tr < TRACKS; tr++) {
    const end = T + len;
    let deg = floor(random(2, 7));
    const loud = random(0.25, 1), dens = random(0.04, 0.16), ratio = random([1, 2, 1.5, 3.5, 0.5]);
    const base = random([12, 18, 26, 36]);
    while (T < end) {
      deg = constrain(deg + random([-2, -1, -1, 0, 1, 1, 2]), 0, scale.length - 1);
      const dur = random([0.5, 1, 1, 2, 4]) * dens;
      if (random() > 0.12) notes.push({
        t0: T, dur, f: base * Math.pow(2, scale[deg] / 12), ratio, I: random(0.3, 3),
        amp: loud * random(0.5, 1) * (0.55 + 0.45 * Math.sin(PI * (T - end + len) / len)),
      });
      T += dur;
    }
    T = end + GAP;
  }
}

// signal at album time T (in turns)
function signal(T) {
  let s = 0;
  for (let k = 0; k < notes.length; k++) {
    const n = notes[k];
    if (n.t0 > T) break;
    if (T > n.t0 + n.dur * 3) continue;
    const t = T - n.t0, env = n.amp * Math.exp(-t / n.dur) * Math.min(1, t / 0.002);
    s += env * Math.sin(TWO_PI * n.f * t + n.I * Math.sin(TWO_PI * n.f * n.ratio * t));
  }
  return Math.tanh(s);
}

// ---------- the lathe: the stylus path, outside in ----------
function cut() {
  path = [];
  for (let T = 0; T < TURNS; ) {
    const r0 = R_OUT - T * PITCH, th = T * TWO_PI - HALF_PI;
    const r = r0 + SWING * signal(T);
    path.push([CX + r * Math.cos(th), CY + r * Math.sin(th)]);
    T += 1.2 / (TWO_PI * r0);                     // ~1.2 px of groove per sample
  }
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 16;
    const i = 4 * (y * W + x);
    ground.pixels[i] = PAPER[0] + n; ground.pixels[i + 1] = PAPER[1] + n; ground.pixels[i + 2] = PAPER[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

function renderPhase(t) {
  image(ground, 0, 0);
  // the label: a flat red print, there from the start
  noStroke(); fill(...RED); circle(CX, CY, (R_IN - 14) * 2);
  fill(...PAPER); circle(CX, CY, 10);
  const head = Math.floor(Math.min(1, t / CUT) * (path.length - 1));
  noFill(); stroke(...INK); strokeWeight(1.1); strokeJoin(ROUND);
  beginShape();
  for (let k = 0; k <= head; k++) vertex(path[k][0], path[k][1]);
  endShape();
  if (t < CUT) { noStroke(); fill(...RED); circle(path[head][0], path[head][1], 7); }
  // wipe: the side fades back to blank paper before the next album
  if (t > HOLD) {
    const a = 255 * Math.min(1, (t - HOLD) / (1 - HOLD - 0.01));
    tint(255, a); image(ground, 0, 0); noTint();
    noStroke(); fill(RED[0], RED[1], RED[2], 255); circle(CX, CY, (R_IN - 14) * 2);
    fill(...PAPER); circle(CX, CY, 10);
  }
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function newAlbum() { compose(); cut(); }

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  const p = new URLSearchParams(window.location.search);
  seed = p.has('seed') ? parseInt(p.get('seed'), 10) : Math.floor(Math.random() * 1e6);
  noiseSeed(seed);
  buildGround();
  newAlbum();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    noLoop();
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  if (p.has('f') && p.has('n')) {
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  renderPhase(frame / LOOP_FRAMES);
  if (isLooping()) {
    frame = (frame + 1) % LOOP_FRAMES;
    if (frame === 0) { seed++; newAlbum(); }       // live: a new album every cycle
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('groove', 'png');
}
