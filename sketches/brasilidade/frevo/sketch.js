// Frevo — Recife carnival as pure geometry. The sombrinha de frevo is
// exploded into four concentric rings of colored arc segments that do not
// rotate smoothly: they JERK, each ring snapping forward one segment on its
// own syncopated 16th-note pattern at 180 BPM, the staccato of the passo.
// Around the mandala, radial line bursts crack on the offbeats like
// passistas leaping. No figures, no umbrella — just the colors and the
// syncopation.
//
// Everything is frame-indexed and periodic modulo LOOP_FRAMES, so the loop
// is seamless by construction. Pure math stays p5-free for bare-eval Node
// tests.

// ---------- rhythm (pure, deterministic) ----------
const TAU = Math.PI * 2;
const FPS = 60;
const STEPS_PER_BAR = 16;            // 16th-note grid
const FRAMES_PER_STEP = 5;           // 5 frames per 16th -> 180 BPM
const BARS = 8;
const FRAMES_PER_BAR = STEPS_PER_BAR * FRAMES_PER_STEP;  // 80
const LOOP_FRAMES = BARS * FRAMES_PER_BAR;               // 640 (~10.7 s)

function hash01(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 1, 1597334677);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function easeOutCubic(t) {
  const u = Math.min(1, Math.max(0, t));
  const v = 1 - u;
  return 1 - v * v * v;
}

// ---------- frevo palette ----------
const PALETTE = [
  [255, 209, 0],    // yellow
  [255, 106, 0],    // orange
  [244, 42, 60],    // red
  [255, 62, 165],   // pink
  [0, 205, 100],    // green
  [56, 130, 255],   // blue
];

// ---------- the sombrinha rings ----------
// Each ring snaps forward exactly one segment per hit of its pattern.
// Seamlessness: snaps per loop (BARS * pattern.length) must be a multiple
// of the ring's color cycle length, so the loop ends on an identical frame.
const SNAP_DUR = 9;                  // frames per snap ease (staccato)
const RINGS = [
  { radius: 78,  segments: 12, colors: [0, 1, 2, 3, 4, 5], pattern: [0, 6, 10],              dir:  1, weight: 10 },
  { radius: 138, segments: 16, colors: [0, 2, 5, 4],       pattern: [2, 5, 8, 14],           dir: -1, weight: 9 },
  { radius: 198, segments: 12, colors: [1, 3, 0, 5, 2, 4], pattern: [0, 3, 6, 8, 11, 14],    dir:  1, weight: 8 },
  { radius: 258, segments: 20, colors: [1, 3, 4, 5],       pattern: [4, 12],                 dir: -1, weight: 7 },
];

function buildSnapTimes(pattern) {
  const times = [];
  for (let bar = 0; bar < BARS; bar++) {
    for (const s of pattern) times.push(bar * FRAMES_PER_BAR + s * FRAMES_PER_STEP);
  }
  return times;
}
for (const r of RINGS) r.snapTimes = buildSnapTimes(r.pattern);

// Snap progress (in whole segments) at frame f. A snap begun in the previous
// loop carries in as (ease - 1), so the motion is continuous across the seam;
// the loop drops exactly snapTimes.length segments at wrap, which is a
// multiple of the ring's visual symmetry.
function ringProgress(ring, f) {
  let p = 0;
  for (const t of ring.snapTimes) {
    if (t <= f) p += easeOutCubic((f - t) / SNAP_DUR);
    else p += easeOutCubic((f + LOOP_FRAMES - t) / SNAP_DUR) - 1;
  }
  return p;
}

// Percussive downbeat accent: instant attack, fast decay, once per bar.
function kickAt(f) {
  const age = ((f % FRAMES_PER_BAR) + FRAMES_PER_BAR) % FRAMES_PER_BAR;
  return age < 2 ? age / 2 : Math.exp(-(age - 2) / 10);
}

// ---------- burst events (the passistas) ----------
const BURST_STEPS = [1, 3, 6, 9, 11, 14];   // offbeat candidates per bar
const BURST_LIFE = 38;

function buildEvents() {
  const evs = [];
  for (let bar = 0; bar < BARS; bar++) {
    for (const s of BURST_STEPS) {
      const seed = bar * STEPS_PER_BAR + s;
      if (hash01(seed, 7) >= 0.5) continue;
      const ang = hash01(seed, 1) * TAU;
      const rad = 288 + 36 * hash01(seed, 2);
      evs.push({
        frame: bar * FRAMES_PER_BAR + s * FRAMES_PER_STEP,
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        rmax: 48 + 24 * hash01(seed, 3),
        rays: 12 + Math.floor(6 * hash01(seed, 4)),
        color: Math.floor(6 * hash01(seed, 5)),
        off: hash01(seed, 6) * TAU,
        spin: (hash01(seed, 8) - 0.5) * 0.6,
      });
    }
  }
  return evs;
}
const EVENTS = buildEvents();

// ---------- rendering ----------
const WIDTH = 800, HEIGHT = 800;
const BG = [10, 6, 12];

let frame = 0;

function drawRing(ring, f, kick) {
  const step = TAU / ring.segments;
  const base = TAU * (f / LOOP_FRAMES)             // slow global drift
    + ring.dir * step * ringProgress(ring, f);
  const R = ring.radius * (1 + 0.035 * kick);
  const span = step * 0.62;
  const lift = 1 + 0.3 * kick;

  noFill();
  for (let i = 0; i < ring.segments; i++) {
    const c = PALETTE[ring.colors[i % ring.colors.length]];
    const a0 = base + i * step;
    stroke(Math.min(255, c[0] * lift), Math.min(255, c[1] * lift), Math.min(255, c[2] * lift));
    strokeWeight(ring.weight);
    arc(0, 0, R * 2, R * 2, a0, a0 + span);
    // thin inner echo — the umbrella's rib
    stroke(c[0], c[1], c[2], 140);
    strokeWeight(2);
    arc(0, 0, (R - 14) * 2, (R - 14) * 2, a0, a0 + span);
  }
}

function drawBurst(ev, f) {
  const age = (((f - ev.frame) % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  if (age >= BURST_LIFE) return;
  const p = age / BURST_LIFE;
  const outer = ev.rmax * easeOutCubic(age / 8);
  const inner = ev.rmax * 0.92 * easeOutCubic((age - 5) / 18);
  const alpha = p < 0.3 ? 255 : Math.pow(1 - (p - 0.3) / 0.7, 1.5) * 255;
  const c1 = PALETTE[ev.color];
  const c2 = PALETTE[(ev.color + 2) % PALETTE.length];
  const rot = ev.off + ev.spin * p;

  strokeWeight(4.5 * (1 - 0.4 * p));
  for (let j = 0; j < ev.rays; j++) {
    const a = rot + (j / ev.rays) * TAU;
    const ca = Math.cos(a), sa = Math.sin(a);
    const c = j % 2 ? c2 : c1;
    stroke(c[0], c[1], c[2], alpha);
    line(ev.x + ca * inner, ev.y + sa * inner, ev.x + ca * outer, ev.y + sa * outer);
  }
  // hot core flash, gone quickly
  if (age < 6) {
    noStroke();
    fill(255, 244, 224, Math.pow(1 - age / 6, 1.5) * 255);
    circle(ev.x, ev.y, 9 + age * 2);
  }
}

function renderFrame(f) {
  background(BG[0], BG[1], BG[2]);
  push();
  translate(WIDTH / 2, HEIGHT / 2);
  strokeCap(ROUND);

  const kick = kickAt(f);

  for (const ring of RINGS) drawRing(ring, f, kick);
  for (const ev of EVENTS) drawBurst(ev, f);

  // center: the dancer's planted foot
  noStroke();
  fill(255, 244, 224, 90 + 120 * kick);
  circle(0, 0, 26 + 20 * kick);
  fill(255, 250, 240, 230);
  circle(0, 0, 9 + 7 * kick);

  pop();
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
  if (key === "s" || key === "S") saveCanvas("frevo", "png");
}
