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

function setup() {
  const c = createCanvas(WIDTH, HEIGHT);
  c.parent("canvas-container");
  pixelDensity(1);
  buildSpiral(Math.min(WIDTH, HEIGHT));
  pg = createGraphics(WIDTH, HEIGHT);
  pg.pixelDensity(1);
  // Static render for now — Task 3 replaces this with the animated loop.
  drawSegments(pg, 1, pts.length);
  noLoop();
}

function draw() {
  background(BG[0], BG[1], BG[2]);
  image(pg, 0, 0);
}
