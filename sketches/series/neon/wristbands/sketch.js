/**
 * Wristbands
 *
 * Neon #1: a crowd with LED wristbands.
 *
 * The crowd seen from the stage, in perspective. Every person wears a
 * wristband that cycles through the colours at its own natural speed. Each
 * one only watches the people within arm's reach and nudges its phase
 * towards theirs (Kuramoto oscillators with local coupling). Nobody sends a
 * cue: the show opens as scattered confetti, neighbours lock together into
 * patches, and the patches organise into waves that roll across the field.
 *
 * At the end of the loop the lights go out from the back to the front, and the next song
 * starts again from scattered phases.
 *
 * The simulation runs once in setup and stores one snapshot per frame, so
 * the loop is deterministic for capture.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const HZ = 10, FOCAL = 400, CAM_H = 6;     // camera on the stage, looking down over the crowd
const Z_NEAR = 3.2, Z_FAR = 44, GAP = 0.45, REACH = 0.75;
const K = 1.6, DT = 0.08, SUBSTEPS = 3;
const LOOP_SECONDS = 14;
const SHOW = 0.88;               // share of the loop the crowd is lit
const BG = [16, 14, 22];
const PALETTE = [
  [255, 40, 60], [255, 46, 136], [140, 70, 255], [0, 200, 230],
  [60, 230, 110], [255, 226, 0], [255, 120, 30],
];

let seats = [], snaps = [], ground;

const project = (x, z) => [W / 2 + FOCAL * x / z, HZ + FOCAL * CAM_H / z];

function buildSeats() {
  // people stand on a ground plane in loose rows; only those inside the camera's view are kept
  for (let z = Z_NEAR; z < Z_FAR; z += GAP) {
    const half = (W / 2 + 20) * z / FOCAL;
    for (let x = -half; x < half; x += GAP) {
      const px = x + random(-0.15, 0.15), pz = z + random(-0.15, 0.15);
      seats.push({ x: px, z: pz, w: 1 + randomGaussian() * 0.04, off: 0 });
    }
  }
  // neighbours: everyone within arm's reach on the ground plane (spatial hash)
  const cell = new Map(), key = (i, j) => i * 100003 + j;
  seats.forEach((s, n) => {
    const k = key(Math.floor(s.x / REACH), Math.floor(s.z / REACH));
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(n);
  });
  for (const s of seats) {
    s.nb = [];
    const ci = Math.floor(s.x / REACH), cj = Math.floor(s.z / REACH);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      for (const n of cell.get(key(ci + di, cj + dj)) || []) {
        const o = seats[n];
        if (o !== s && (o.x - s.x) ** 2 + (o.z - s.z) ** 2 < REACH * REACH) s.nb.push(n);
      }
    }
    // lights-out order: from the back of the crowd to the front, a little ragged
    s.off = SHOW + (1 - SHOW - 0.02) * constrain((Z_FAR - s.z) / Z_FAR * 0.85 + random(0.15), 0, 1);
  }
  // draw far to near: sort, then remap neighbour indices to the new order
  const order = seats.map((s, i) => i).sort((a, b) => seats[b].z - seats[a].z);
  const where = new Int32Array(seats.length); order.forEach((o, i) => where[o] = i);
  seats = order.map(o => seats[o]);
  for (const s of seats) s.nb = s.nb.map(n => where[n]);
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
    const s = seats[i], [x, y] = project(s.x, s.z), sz = FOCAL * 0.2 / s.z;
    if (t > s.off) fill(34, 30, 44);        // band switched off
    else { const c = PALETTE[snap[i]]; fill(c[0], c[1], c[2]); }
    rect(x - sz * 0.8, y - sz * 0.35, sz * 1.6, sz * 0.7, sz * 0.2);
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
