/**
 * Groove
 *
 * A whole album side, composed by rules and cut into one spiral. A small
 * composer writes five tracks: a random walk over a minor scale picks the
 * notes, each track draws its own loudness, density and FM timbre, and a
 * silent run-out separates the tracks. The signal pushes the groove
 * sideways as it spirals in, exactly as a cutting lathe would.
 *
 * Nothing on the disc is drawn as a picture. Every pixel asks which turn of
 * the spiral it sits on, how far into the album that is, and how steeply
 * the music bends the groove there; a fixed raking light then decides how
 * bright it is. Loud passages scatter the light into a matte grey, the gaps
 * between tracks stay mirror-black, and the bright bow-tie of the light
 * sweeps the music as the record turns once per loop.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800, CX = 400, CY = 400;
const R_OUT = 372, R_IN = 120, PITCH = 1.1;     // px between turns of the groove
const TURNS = (R_OUT - R_IN) / PITCH;
const TRACKS = 5, GAP = 3;                       // silent turns between tracks
const NR = 1100, NA = 4096;                      // polar texture resolution
const LIGHT = Math.atan2(-0.6, -0.8);            // raking light direction
const LOOP_SECONDS = 8;
const PAPER = [221, 213, 198];
const LABEL = [178, 44, 36];

let notes, slopeTex, roughTex, ground, rr, tt;

// ---------- the composer ----------
function compose() {
  notes = [];
  const scale = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];
  let T = 1.5;
  const len = (TURNS - 8) / TRACKS - GAP;
  for (let tr = 0; tr < TRACKS; tr++) {
    const end = T + len;
    let deg = 4;
    const loud = random(0.3, 1), dens = random(0.15, 0.6), ratio = random([1, 2, 1.5, 3.5]);
    while (T < end) {
      deg = constrain(deg + random([-2, -1, -1, 0, 1, 1, 2]), 0, scale.length - 1);
      const dur = random([0.25, 0.5, 0.5, 1, 2]) * dens * 4;
      notes.push({
        t0: T, dur, f: 60 * Math.pow(2, scale[deg] / 12), ratio, I: random(0.5, 4),
        amp: loud * random(0.5, 1) * (0.6 + 0.4 * Math.sin(PI * (T - end + len) / len)),
      });
      T += dur;
    }
    T = end + GAP;
  }
}

// signal at album time T (in turns): displacement s, its slope ds, loudness env
function signal(T, from) {
  let s = 0, ds = 0, ev = 0;
  for (let k = from; k < notes.length; k++) {
    const n = notes[k];
    if (n.t0 > T) break;
    if (T > n.t0 + n.dur * 1.6) continue;
    const t = T - n.t0, env = n.amp * Math.exp(-t / (n.dur * 0.5)) * Math.min(1, t * 40);
    const ph = TWO_PI * n.f * t + n.I * Math.sin(TWO_PI * n.f * n.ratio * t);
    ev += env; s += env * Math.sin(ph); ds += env * Math.cos(ph) * TWO_PI * n.f;
  }
  return [s, ds, ev];
}

// ---------- cutting: bake the groove into a polar texture in disc coordinates ----------
function cut() {
  slopeTex = new Float32Array(NR * NA); roughTex = new Float32Array(NR * NA);
  // notes that can still sound at time T start no earlier than T - longest tail
  const tail = Math.max(...notes.map((n) => n.dur * 1.6));
  for (let a = 0; a < NA; a++) {
    const th = (a / NA) * TWO_PI - PI;
    for (let j = 0; j < NR; j++) {
      const r = R_IN - 6 + (j / (NR - 1)) * (R_OUT - R_IN + 6);
      const fr = (R_OUT - r) / PITCH, w = (th + PI) / TWO_PI;
      const T = Math.max(0, Math.floor(fr - w) + w);
      let lo = 0, hi = notes.length;                  // first note with t0 >= T - tail
      while (lo < hi) { const m = (lo + hi) >> 1; if (notes[m].t0 < T - tail) lo = m + 1; else hi = m; }
      const [s, ds, ev] = signal(T, lo);
      const slope = (ds * 0.36) / (TWO_PI * r) * 6;
      const k = a * NR + j;
      slopeTex[k] = Math.atan(slope);
      roughTex[k] = Math.min(1, ev * 1.1) * (0.4 + 0.6 * Math.abs(Math.sin(s * 3)));
    }
  }
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 20;
    const i = 4 * (y * W + x);
    ground.pixels[i] = PAPER[0] + n; ground.pixels[i + 1] = PAPER[1] + n; ground.pixels[i + 2] = PAPER[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
  rr = new Float32Array(W * H); tt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    rr[y * W + x] = Math.hypot(x - CX, y - CY); tt[y * W + x] = Math.atan2(y - CY, x - CX);
  }
}

function renderPhase(t) {
  image(ground, 0, 0);
  const spin = t * TWO_PI;                         // one turn per loop
  loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, r = rr[p];
    if (r > R_OUT + 4) continue;
    let v, R, G, B;
    if (r < R_IN - 6) {
      if (r < 6) { R = G = B = 232; }
      else {
        const dim = r > R_IN - 14 ? 0.8 : 1, n = (Math.sin(r * 0.7) * 4);
        R = (LABEL[0] + n) * dim; G = (LABEL[1] + n) * dim; B = LABEL[2] * dim;
      }
    } else {
      // where this pixel sits on the disc right now
      let th = tt[p] - spin; th -= TWO_PI * Math.floor((th + PI) / TWO_PI);
      const a = Math.min(NA - 1, Math.floor(((th + PI) / TWO_PI) * NA));
      const j = Math.max(0, Math.min(NR - 1, Math.round(((r - R_IN + 6) / (R_OUT - R_IN + 6)) * (NR - 1))));
      const k = a * NR + j;
      const tang = tt[p] + HALF_PI + slopeTex[k];
      const al = Math.abs(Math.cos(tang + HALF_PI - LIGHT));
      const rough = roughTex[k];
      const fr = (R_OUT - r) / PITCH, groove = 0.5 + 0.5 * Math.cos(TWO_PI * fr);
      const edge = r > R_OUT ? 0.5 : 1;
      v = (8 + 235 * Math.pow(al, 60) * (1 - 0.5 * rough) + 70 * rough * al * al + 38 * rough * groove + 5 * groove) * edge;
      R = v; G = v; B = v + 4;
    }
    const i = 4 * p;
    pixels[i] = R; pixels[i + 1] = G; pixels[i + 2] = B;
  }
  updatePixels();
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
  randomSeed(11); noiseSeed(11);
  buildGround();
  compose();
  cut();

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
  if (key === 's' || key === 'S') saveCanvas('groove', 'png');
}
