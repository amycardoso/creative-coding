// Cimática — Chladni figures: geometry born from vibration.
// Thousands of sand grains ride a vibrating square plate. Each vibration
// mode (m,n) has an amplitude field whose zero-set — the nodal lines, where
// the plate stands still — is where the sand comes to rest. Grains descend
// the gradient of A² (toward silence) while being jittered in proportion to
// the local amplitude (shaken hardest where the plate moves most). Nothing
// is drawn but the grains; every figure is real standing-wave physics.
//
// The loop visits six modes of increasing intricacy. Transitions crossfade
// the field, so old nodal lines stop being silent and the settled pattern
// bursts apart before crystallizing onto the next figure. The final blend
// returns to the first mode and frame 0 starts pre-settled into it, so the
// seam reads as the same figure. Pure math stays p5-free for bare-eval
// Node tests.

// ---------- timeline ----------
const TAU = Math.PI * 2;
const FPS = 60;
const LOOP_FRAMES = 900;                 // 15 s
// Each mode is [m, n, s]: s = +1 is the antisymmetric combination (nodal on
// the diagonal), s = −1 the symmetric one (NOT nodal there). Alternating
// them matters: if every mode shared the diagonal nodal line, that line
// would be quiet forever and slowly absorb every grain on the plate.
const MODES = [[1, 2, 1], [1, 3, -1], [2, 3, 1], [1, 4, -1], [2, 5, 1], [3, 5, -1]];
const SEG = LOOP_FRAMES / MODES.length;  // frames per mode
const BLEND = 45;                        // crossfade frames at each segment's end

// ---------- Chladni field (pure, deterministic) ----------
// Square plate, unit coordinates x,y ∈ [0,1]. Free-plate approximation:
// A(x,y) = cos(mπx)cos(nπy) − s·cos(nπx)cos(mπy). Nodal lines are A = 0.
function modeAmp(m, n, x, y, s = 1) {
  return (
    Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y) -
    s * Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y)
  );
}

function modeGrad(m, n, x, y, s = 1) {
  const pi = Math.PI;
  const dx =
    -m * pi * Math.sin(m * pi * x) * Math.cos(n * pi * y) +
    s * n * pi * Math.sin(n * pi * x) * Math.cos(m * pi * y);
  const dy =
    -n * pi * Math.cos(m * pi * x) * Math.sin(n * pi * y) +
    s * m * pi * Math.cos(n * pi * x) * Math.sin(m * pi * y);
  return [dx, dy];
}

// Segment i holds MODES[i]; its last BLEND frames smoothstep toward the
// next mode (cyclically), reaching t = 1 on the segment's final frame so
// the handoff to the next segment's pure mode is continuous.
function schedule(f) {
  const fw = ((f % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const seg = Math.floor(fw / SEG);
  const within = fw - seg * SEG;
  const a = MODES[seg];
  const b = MODES[(seg + 1) % MODES.length];
  let t = 0;
  const start = SEG - BLEND;
  if (within >= start) {
    const u = (within - start + 1) / BLEND;
    t = u * u * (3 - 2 * u);
  }
  return { a, b, t };
}

function fieldAt(f, x, y) {
  const { a, b, t } = schedule(f);
  return (1 - t) * modeAmp(a[0], a[1], x, y, a[2]) + t * modeAmp(b[0], b[1], x, y, b[2]);
}

function fieldGradAt(f, x, y) {
  const { a, b, t } = schedule(f);
  const ga = modeGrad(a[0], a[1], x, y, a[2]);
  const gb = modeGrad(b[0], b[1], x, y, b[2]);
  return [(1 - t) * ga[0] + t * gb[0], (1 - t) * ga[1] + t * gb[1]];
}

// Drive strength: a calm base with a burst peaking mid-transition.
const SHAKE_BASE = 0.0011;
const SHAKE_BURST = 0.0042;
function shakeAt(f) {
  const { t } = schedule(f);
  return SHAKE_BASE + SHAKE_BURST * Math.sin(Math.PI * t);
}

// ---------- deterministic randomness ----------
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- grain simulation (p5-free) ----------
const N_GRAINS = 14000;
const DESCENT = 0.00095;   // gradient-descent rate on A²/2
const MAX_STEP = 0.0045;   // per-frame travel clamp (unit coords)
const JITTER_FLOOR = 0.12; // thermal noise floor relative to |A| jitter

// Grain-grain exclusion: without it, piles collapse into dots instead of
// spreading into the continuous sand ridges real plates show.
const REP_RADIUS = 0.005;  // exclusion radius (unit coords)
const REP_FORCE = 0.0009;  // push at zero separation, linear falloff to REP_RADIUS
const GRID = Math.floor(1 / REP_RADIUS); // spatial hash, cell ≥ REP_RADIUS

// Capture warm-up: loops simulated before frame 0 so the captured loop's
// seam is periodic. Grain drift ALONG nodal lines is a slow variable, so
// convergence onto the loop's attractor takes several loops.
const WARMUP_LOOPS = 8;

let gx = null, gy = null;  // grain positions, unit plate coords
let pgx = null, pgy = null; // previous positions (for motion brightness)
let simFrame = -1;         // last simulated frame, -1 = uninitialized
let rng = null;

function gauss(r) {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r());
}

function initGrains(warmupLoops) {
  rng = mulberry32(20260830);
  gx = new Float64Array(N_GRAINS);
  gy = new Float64Array(N_GRAINS);
  pgx = new Float64Array(N_GRAINS);
  pgy = new Float64Array(N_GRAINS);
  for (let i = 0; i < N_GRAINS; i++) {
    gx[i] = rng();
    gy[i] = rng();
  }
  for (let w = 0; w < warmupLoops; w++) {
    for (let f = 0; f < LOOP_FRAMES; f++) stepGrains(f);
  }
  simFrame = -1;
}

let cellHead = null, cellNext = null;

function stepGrains(f) {
  const shake = shakeAt(f);
  // snapshot frame-start positions and hash them into the grid, so every
  // grain sees the same neighbor state regardless of update order
  if (cellHead === null) {
    cellHead = new Int32Array(GRID * GRID);
    cellNext = new Int32Array(N_GRAINS);
  }
  cellHead.fill(-1);
  for (let i = 0; i < N_GRAINS; i++) {
    pgx[i] = gx[i]; pgy[i] = gy[i];
    const cx = Math.min(GRID - 1, Math.floor(pgx[i] * GRID));
    const cy = Math.min(GRID - 1, Math.floor(pgy[i] * GRID));
    const c = cx * GRID + cy;
    cellNext[i] = cellHead[c];
    cellHead[c] = i;
  }
  for (let i = 0; i < N_GRAINS; i++) {
    const x = pgx[i], y = pgy[i];
    const A = fieldAt(f, x, y);
    const [dAx, dAy] = fieldGradAt(f, x, y);
    // jitter scales with local amplitude but keeps a thermal floor: real
    // plates shake grains a little everywhere, which is what keeps grains
    // from freezing forever at spots quiet in every mode.
    const jit = shake * (JITTER_FLOOR + Math.abs(A));
    let vx = -DESCENT * A * dAx + jit * gauss(rng);
    let vy = -DESCENT * A * dAy + jit * gauss(rng);
    // short-range repulsion from neighbors in the 3×3 surrounding cells
    const cx = Math.min(GRID - 1, Math.floor(x * GRID));
    const cy = Math.min(GRID - 1, Math.floor(y * GRID));
    for (let ox = -1; ox <= 1; ox++) {
      const nxc = cx + ox;
      if (nxc < 0 || nxc >= GRID) continue;
      for (let oy = -1; oy <= 1; oy++) {
        const nyc = cy + oy;
        if (nyc < 0 || nyc >= GRID) continue;
        for (let j = cellHead[nxc * GRID + nyc]; j !== -1; j = cellNext[j]) {
          if (j === i) continue;
          const ddx = x - pgx[j], ddy = y - pgy[j];
          const d = Math.hypot(ddx, ddy);
          if (d >= REP_RADIUS) continue;
          if (d < 1e-9) {
            // coincident grains: deterministic split direction from index
            const a = (i * 2654435761 % 6283) / 1000;
            vx += REP_FORCE * Math.cos(a);
            vy += REP_FORCE * Math.sin(a);
          } else {
            const push = (REP_FORCE * (REP_RADIUS - d)) / (REP_RADIUS * d);
            vx += push * ddx;
            vy += push * ddy;
          }
        }
      }
    }
    const sp = Math.hypot(vx, vy);
    if (sp > MAX_STEP) {
      vx *= MAX_STEP / sp;
      vy *= MAX_STEP / sp;
    }
    let nx = x + vx, ny = y + vy;
    if (nx < 0) nx = -nx; else if (nx > 1) nx = 2 - nx;
    if (ny < 0) ny = -ny; else if (ny > 1) ny = 2 - ny;
    gx[i] = nx; gy[i] = ny;
  }
}

// Capture path: advance the simulation through every frame up to `target`,
// resetting (with warm-up) if the target is behind us. Capture steps
// through the identical frame sequence regardless of capture rate.
function simTo(target) {
  if (gx === null || target < simFrame) initGrains(WARMUP_LOOPS);
  while (simFrame < target) stepGrains(++simFrame);
}

// ---------- rendering ----------
const WIDTH = 800, HEIGHT = 800;
const PLATE = 660;                       // plate side in px
const M = (WIDTH - PLATE) / 2;
let frame = 0;        // capture frame index
let liveFrame = 0;    // live playback: monotonic, never resets
let captureMode = false;

// Draws the current grain state; f only sets the driver pulse phase.
function drawPlate(f) {
  background(8, 8, 12);

  // soft vignette to seat the plate in darkness
  noFill();
  for (let r = 0; r < 5; r++) {
    stroke(8, 8, 12, 120 - r * 22);
    strokeWeight(40);
    rect(M - 20 - r * 18, M - 20 - r * 18, PLATE + 40 + r * 36, PLATE + 40 + r * 36);
  }

  // plate edge
  noFill();
  stroke(90, 88, 100, 110);
  strokeWeight(1.5);
  rect(M, M, PLATE, PLATE);

  // center driver: a faint pulse that swells with the drive strength
  const drive = (shakeAt(f) - SHAKE_BASE) / SHAKE_BURST;
  noStroke();
  fill(140, 150, 180, 26 + 70 * drive);
  circle(WIDTH / 2, HEIGHT / 2, 6 + 26 * drive);

  // the sand
  noStroke();
  for (let i = 0; i < N_GRAINS; i++) {
    const px = M + gx[i] * PLATE;
    const py = M + gy[i] * PLATE;
    const sp = Math.hypot(gx[i] - pgx[i], gy[i] - pgy[i]) / MAX_STEP;
    // settled grains glow warm sand; flying grains flare brighter and cooler
    const b = Math.min(1, sp * 2.2);
    fill(232 + 20 * b, 218 + 26 * b, 190 + 55 * b, 150 + 90 * b);
    square(px - 0.75, py - 0.75, 1.5);
  }
}

function setup() {
  const c = createCanvas(WIDTH, HEIGHT);
  c.parent("canvas-container");
  pixelDensity(1);

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = (i, n) => {
    captureMode = true;
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  const p = new URLSearchParams(window.location.search);
  if (p.has("f") && p.has("n")) {
    captureMode = true;
    noLoop();
    window.__captureFrame(parseInt(p.get("f"), 10), Math.max(1, parseInt(p.get("n"), 10)));
  }
}

function draw() {
  if (captureMode) {
    // deterministic warmed-up loop — the GIF's seam is periodic
    simTo(frame);
    drawPlate(frame);
  } else {
    // live viewing: start from uniform chaos and watch the first figure
    // crystallize, then evolve forever — no reset, so no seam to hide
    if (gx === null) initGrains(0);
    stepGrains(liveFrame);
    drawPlate(liveFrame);
    liveFrame++;
  }
}

function keyPressed() {
  if (key === "s" || key === "S") saveCanvas("cimatica", "png");
}
