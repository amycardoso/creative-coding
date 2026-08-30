// Maré — one lunar month of real tide at Porto de Itaqui, São Luís (MA),
// drawn as a spiral: one turn = one lunar day (24 h 50 min), ~29.5 turns.
//
// Tidal harmonic constituents (amplitude in meters, angular speed in deg/hour,
// phase lag in degrees) after the FEMAR / Marinha do Brasil tide-station
// catalog values for the Itaqui station. h(t) = Σ Aᵢ·cos(ωᵢ·t − φᵢ).
const CONSTITUENTS = [
  { name: "M2", amp: 2.05, speed: 28.9841042, phase: 300 },
  { name: "S2", amp: 0.65, speed: 30.0000000, phase: 335 },
  { name: "N2", amp: 0.40, speed: 28.4397295, phase: 285 },
  { name: "K1", amp: 0.11, speed: 15.0410686, phase: 190 },
  { name: "O1", amp: 0.08, speed: 13.9430356, phase: 170 },
  { name: "M4", amp: 0.06, speed: 57.9682084, phase:  30 },
];

const LUNAR_DAY_H = 24.8412;          // one spiral turn, hours
const DAYS = 29.5;                    // one synodic month of turns
const TOTAL_H = DAYS * LUNAR_DAY_H;   // ~732.8 simulated hours
const MAX_AMP = CONSTITUENTS.reduce((s, c) => s + c.amp, 0); // theoretical max |h|

function tideHeight(hours) {
  let h = 0;
  for (const c of CONSTITUENTS) {
    h += c.amp * Math.cos(((c.speed * hours - c.phase) * Math.PI) / 180);
  }
  return h;
}

// ---------- geometry ----------
const WIDTH = 800, HEIGHT = 800;
const STEP_H = 0.1;                 // one point every 6 simulated minutes
const BG = [2, 10, 12];             // #020a0c
const COL_LOW  = [14, 84, 88];      // abyssal teal (neap / low water)
const COL_HIGH = [210, 250, 255];   // luminous cyan-white (spring highs)
const SILVER = [200, 210, 222];     // moonlight accent

let pts = [];                        // {x, y, h} centered on (0,0)
let R0, R1, pg;

function buildSpiral(s) {
  R0 = 0.07 * s;
  R1 = 0.42 * s;
  const spacing = (R1 - R0) / DAYS;  // radial gap between consecutive turns
  pts = [];
  for (let t = 0; t <= TOTAL_H; t += STEP_H) {
    const ang = (t / LUNAR_DAY_H) * TWO_PI - HALF_PI;
    const h = tideHeight(t);
    const r = R0 + (R1 - R0) * (t / TOTAL_H) + (h / MAX_AMP) * spacing * 5.0;
    pts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r, h });
  }
}

function segColor(h) {
  const u = pow(constrain((h / MAX_AMP + 1) / 2, 0, 1), 2.2);
  return color(
    lerp(COL_LOW[0], COL_HIGH[0], u),
    lerp(COL_LOW[1], COL_HIGH[1], u),
    lerp(COL_LOW[2], COL_HIGH[2], u)
  );
}

function segWeight(h) {
  return 0.4 + 1.8 * Math.abs(h) / MAX_AMP;
}

// Draw polyline segments [from, to) into graphics buffer g.
function drawSegments(g, from, to) {
  g.push();
  g.translate(g.width / 2, g.height / 2);
  for (let i = Math.max(1, from); i < to; i++) {
    const a = pts[i - 1], b = pts[i];
    g.stroke(segColor(b.h));
    g.strokeWeight(segWeight(b.h));
    g.line(a.x, a.y, b.x, b.y);
  }
  g.pop();
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 60;
const DRAW_FRAMES = 35 * FPS;      // month draws itself
const BREATHE_FRAMES = 9 * FPS;    // completed form breathes
const FADE_FRAMES = 3 * FPS;       // fade to black, then loop
const LOOP_FRAMES = DRAW_FRAMES + BREATHE_FRAMES + FADE_FRAMES;

let frame = 0;
let drawnIdx = 0;        // how many points are already in pg (live mode)
let captureMode = false; // capture rebuilds pg from scratch every frame

function targetIdx(f) {
  const p = constrain(f / DRAW_FRAMES, 0, 1);
  return Math.floor(p * (pts.length - 1)) + 1;
}

function renderFrame(f) {
  const idx = targetIdx(f);
  if (captureMode || idx < drawnIdx) {
    pg.clear();
    drawSegments(pg, 1, idx);
  } else {
    drawSegments(pg, drawnIdx, idx);
  }
  drawnIdx = idx;

  background(BG[0], BG[1], BG[2]);
  image(pg, 0, 0);

  if (f < DRAW_FRAMES) {
    // glowing "now" head leading the line
    const p = pts[idx - 1];
    push();
    translate(width / 2, height / 2);
    noStroke();
    fill(SILVER[0], SILVER[1], SILVER[2], 30); circle(p.x, p.y, 14);
    fill(SILVER[0], SILVER[1], SILVER[2], 90); circle(p.x, p.y, 6);
    fill(255, 255, 255, 220); circle(p.x, p.y, 2.5);
    pop();
  } else if (f < DRAW_FRAMES + BREATHE_FRAMES) {
    // moon-silver pulse sweeping outward through the rings, twice
    const k = ((f - DRAW_FRAMES) / BREATHE_FRAMES) * 2 % 1;
    const rr = lerp(R0, R1, k);
    push();
    translate(width / 2, height / 2);
    noFill();
    const a = 46 * Math.sin(Math.PI * k); // soft in/out
    stroke(SILVER[0], SILVER[1], SILVER[2], a);
    strokeWeight(lerp(R1 - R0, (R1 - R0) * 0.4, k) / DAYS * 2.2);
    circle(0, 0, rr * 2);
    pop();
  } else {
    // fade to black
    const k = (f - DRAW_FRAMES - BREATHE_FRAMES) / FADE_FRAMES;
    noStroke();
    fill(BG[0], BG[1], BG[2], Math.min(1, k * 1.25) * 255);
    rect(0, 0, width, height);
  }

  drawMoonDot(f);
}

// Center moon-phase dot: brightness tracks the synodic month
// (new at both ends of the drawn month, full mid-month).
function drawMoonDot(f) {
  const day = constrain(f / DRAW_FRAMES, 0, 1) * DAYS;
  const illum = 0.5 * (1 - Math.cos((TWO_PI * day) / DAYS));
  push();
  translate(width / 2, height / 2);
  noStroke();
  fill(
    lerp(BG[0], SILVER[0], illum),
    lerp(BG[1], SILVER[1], illum),
    lerp(BG[2], SILVER[2], illum)
  );
  circle(0, 0, 14);
  noFill();
  stroke(SILVER[0], SILVER[1], SILVER[2], 70);
  strokeWeight(1);
  circle(0, 0, 14);
  pop();
}

function setup() {
  const c = createCanvas(WIDTH, HEIGHT);
  c.parent("canvas-container");
  pixelDensity(1);
  buildSpiral(Math.min(WIDTH, HEIGHT));
  pg = createGraphics(WIDTH, HEIGHT);
  pg.pixelDensity(1);

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = (i, n) => {
    captureMode = true;
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
  if (key === "s" || key === "S") saveCanvas("mare", "png");
}
