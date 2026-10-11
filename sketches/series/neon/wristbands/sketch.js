/**
 * Wristbands
 *
 * Neon #1: a crowd with LED wristbands.
 *
 * Every seat in a stadium bowl holds a wristband that cycles through the
 * colours at its own natural speed. Each one only watches its nearest
 * neighbours and nudges its phase towards theirs (Kuramoto oscillators with
 * local coupling). Nobody sends a cue: the show opens as scattered confetti,
 * neighbours lock together into patches, and the patches organise into
 * waves and spirals that sweep around the bowl.
 *
 * At the end of the loop the lights go out row by row, and the next song
 * starts again from scattered phases.
 *
 * The simulation runs once in setup and stores one snapshot per frame, so
 * the loop is deterministic for capture.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const CX = 400, CY = 400, R0 = 118, R1 = 368, RINGS = 46, SQ = 0.82;
const K = 1.6, DT = 0.08, SUBSTEPS = 3;
const LOOP_SECONDS = 14;
const SHOW = 0.88;               // share of the loop the crowd is lit
const BG = [16, 14, 22];
const PALETTE = [
  [255, 40, 60], [255, 46, 136], [140, 70, 255], [0, 200, 230],
  [60, 230, 110], [255, 226, 0], [255, 120, 30],
];

let seats = [], snaps = [], ground;

function buildSeats() {
  const rings = [];
  for (let r = 0; r < RINGS; r++) {
    const rad = lerp(R0, R1, r / (RINGS - 1)), n = Math.floor(TWO_PI * rad / 7.2);
    const ring = [];
    for (let k = 0; k < n; k++) {
      ring.push(seats.length);
      seats.push({ r, k, n, rad, a: k / n * TWO_PI, w: 1 + randomGaussian() * 0.04, off: 0 });
    }
    rings.push(ring);
  }
  // neighbours: same row ±1, ±2 and the closest seats in the rows in front and behind
  for (const s of seats) {
    s.nb = [];
    for (const d of [-2, -1, 1, 2]) s.nb.push(rings[s.r][(s.k + d + s.n) % s.n]);
    for (const dr of [-1, 1]) {
      const rr = rings[s.r + dr]; if (!rr) continue;
      const kk = Math.round(s.k / s.n * rr.length);
      for (const d of [-1, 0, 1]) s.nb.push(rr[(kk + d + rr.length) % rr.length]);
    }
    // lights-out order: back rows first, a little ragged
    s.off = SHOW + (1 - SHOW - 0.02) * constrain((RINGS - 1 - s.r) / RINGS * 0.85 + random(0.15), 0, 1);
  }
}

function simulate() {
  const n = seats.length, th = new Float64Array(n), nt = new Float64Array(n);
  for (let i = 0; i < n; i++) th[i] = random(TWO_PI);
  const frames = Math.round(LOOP_FRAMES * SHOW);
  for (let f = 0; f <= frames; f++) {
    const s = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const ph = ((th[i] % TWO_PI) + TWO_PI) % TWO_PI;
      s[i] = Math.floor(ph / TWO_PI * PALETTE.length) % PALETTE.length;
    }
    snaps.push(s);
    for (let k = 0; k < SUBSTEPS; k++) {
      for (let i = 0; i < n; i++) {
        let c = 0; const nb = seats[i].nb;
        for (const j of nb) c += Math.sin(th[j] - th[i]);
        nt[i] = th[i] + DT * (seats[i].w + K * c / nb.length);
      }
      th.set(nt);
    }
  }
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 8 + noise(x * 0.3, y * 0.3) * 5 + random(-3, 3);
    const i = 4 * (y * W + x);
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

function renderPhase(t) {
  image(ground, 0, 0);
  const last = snaps.length - 1;
  const snap = snaps[Math.min(last, Math.floor(t / SHOW * last))];
  noStroke();
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i];
    const x = CX + Math.cos(s.a) * s.rad, y = CY + Math.sin(s.a) * s.rad * SQ;
    const sz = 3.4 + s.r * 0.04;
    if (t > s.off) fill(34, 30, 44);        // band switched off
    else { const c = PALETTE[snap[i]]; fill(c[0], c[1], c[2]); }
    push(); translate(x, y); rotate(s.a + HALF_PI); rect(-sz * 0.7, -sz * 0.45, sz * 1.4, sz * 0.9, 1); pop();
  }
  fill(30, 28, 38); rect(CX - 50, CY - 18, 100, 36, 2);   // stage
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
  randomSeed(7); noiseSeed(7);
  buildGround();
  buildSeats();
  simulate();

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
  if (key === 's' || key === 'S') saveCanvas('wristbands', 'png');
}
