// Paralaxe temporal — all moments at once, after Arrival.
// One thin-lined figure journeys a 2:3 Lissajous orbit, its shape morphing
// as it goes. Every frame draws the ENTIRE journey simultaneously: ninety
// translucent ghosts — the figure at every phase of its loop, past and
// future overlaid in a single image. What animates is not the figure but
// WHEN you are: a brightness field sweeps through the stack, and its
// falloff is symmetric in both directions of time — the glow reaches as
// far into the future as into the past.
//
// Every frame is a pure function of the frame index with integer cycles
// per loop, so the loop is seamless by construction. Pure math stays
// p5-free for bare-eval Node tests.

// ---------- timeline ----------
const TAU = Math.PI * 2;
const FPS = 60;
const LOOP_FRAMES = 720;                 // 12 s
const N_GHOSTS = 90;

// ---------- geometry (pure, deterministic) ----------
const WIDTH = 800, HEIGHT = 800;
const ORBIT_AX = 205, ORBIT_AY = 150;    // 2:3 Lissajous amplitudes
const SHAPE_R = 66;

// phase p ∈ [0,1): one full journey. Integer frequencies close the orbit.
function orbitPos(p) {
  return {
    x: ORBIT_AX * Math.sin(2 * TAU * p + 0.9),
    y: ORBIT_AY * Math.sin(3 * TAU * p + 0.25),
  };
}

// The figure: a closed curve whose radius harmonics drift with the phase.
// Every harmonic advances an integer number of cycles per loop, so the
// shape at p = 0 and p = 1 is identical.
const SHAPE_HARM = [
  { k: 2, amp: 0.16, cyc: 1, ph: 0.7 },
  { k: 3, amp: 0.22, cyc: -2, ph: 2.1 },
  { k: 5, amp: 0.10, cyc: 3, ph: 4.4 },
];
const ROT_CYC = 1;                        // whole rotations per loop

function ghostShape(p) {
  const M = 96;
  const rot = ROT_CYC * TAU * p;
  const pts = [];
  for (let i = 0; i <= M; i++) {
    const th = (i / M) * TAU;
    let rr = 1;
    for (const h of SHAPE_HARM) {
      rr += h.amp * Math.sin(h.k * th + h.cyc * TAU * p + h.ph);
    }
    const rad = SHAPE_R * rr;
    pts.push({ x: Math.cos(th + rot) * rad, y: Math.sin(th + rot) * rad });
  }
  pts[M] = { ...pts[0] };                 // closed exactly
  return pts;
}

// circular phase distance in [0, 0.5]
function phaseDist(a, b) {
  const d = Math.abs((((a - b) % 1) + 1) % 1);
  return Math.min(d, 1 - d);
}

// The present: a Gaussian in phase distance. Symmetric by construction —
// premonition weighs the same as memory.
const SIGMA = 0.055;
function highlight(dp) {
  return Math.exp(-(dp * dp) / (SIGMA * SIGMA));
}

function frameParams(f) {
  const now = (((f / LOOP_FRAMES) % 1) + 1) % 1;
  return { now };
}

// ---------- rendering ----------
const BG = [7, 9, 17];
const GHOST = [106, 128, 170];
const NOW_COL = [214, 240, 255];
let frame = 0;

function renderFrame(f) {
  const { now } = frameParams(f);
  background(BG[0], BG[1], BG[2]);

  // ghosts sorted dimmest-first so the present paints over its echoes
  const order = [];
  for (let g = 0; g < N_GHOSTS; g++) {
    const p = g / N_GHOSTS;
    order.push({ p, w: highlight(phaseDist(p, now)) });
  }
  order.sort((a, b) => a.w - b.w);

  noFill();
  for (const { p, w } of order) {
    const o = orbitPos(p);
    const pts = ghostShape(p);

    // wide soft pass for the glowing present
    if (w > 0.25) {
      stroke(NOW_COL[0], NOW_COL[1], NOW_COL[2], 26 * w);
      strokeWeight(4.5);
      beginShape();
      for (const q of pts) vertex(o.x + q.x + WIDTH / 2, o.y + q.y + HEIGHT / 2);
      endShape();
    }

    const cr = GHOST[0] + (NOW_COL[0] - GHOST[0]) * w;
    const cg = GHOST[1] + (NOW_COL[1] - GHOST[1]) * w;
    const cb = GHOST[2] + (NOW_COL[2] - GHOST[2]) * w;
    stroke(cr, cg, cb, 36 + 200 * w);
    strokeWeight(1 + 0.9 * w);
    beginShape();
    for (const q of pts) vertex(o.x + q.x + WIDTH / 2, o.y + q.y + HEIGHT / 2);
    endShape();
  }
}

function setup() {
  const c = createCanvas(WIDTH, HEIGHT);
  c.parent("canvas-container");
  pixelDensity(1);

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = (i, n) => {
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  const p = new URLSearchParams(window.location.search);
  if (p.has("f") && p.has("n")) {
    noLoop();
    window.__captureFrame(parseInt(p.get("f"), 10), Math.max(1, parseInt(p.get("n"), 10)));
  }
}

function draw() {
  renderFrame(frame);
  frame = (frame + 1) % LOOP_FRAMES;
}

function keyPressed() {
  if (key === "s" || key === "S") saveCanvas("paralaxe", "png");
}
