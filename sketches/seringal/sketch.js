/**
 * Seringal
 *
 * A generative aerial map of a seringal (rubber estate) in the Amazon.
 * Watch as a river draws itself, homesteads appear, rubber trails grow
 * outward as random walks, and dense forest canopy fills with packed circles.
 *
 * Inspired by the painting "Seringal na Amazônia" and the seringueiro
 * resistance in Acre, Brazil. Part of the Acre Series.
 *
 * Controls:
 * - Click: Generate new seringal
 * - S: Save PNG
 * - Shift+S: Start/stop GIF recording
 */

const W = 800;
const H = 800;

// --- Colors ---
const GREENS = ['#1a5c2a', '#2d8a4e', '#3cb371', '#228b22', '#4caf50', '#1b6b30'];
const RIVER_COLORS = ['#c8a050', '#b8913a', '#d4a855'];
const TRAIL_COLOR = '#8b7355';
const GROUND_COLOR = '#1a2e1a';
const HOUSE_COLOR = '#5c4033';

// --- Animation phases ---
const PHASE_RIVER = 0;
const PHASE_HOMESTEADS = 1;
const PHASE_TRAILS = 2;
const PHASE_CANOPY = 3;
const PHASE_DONE = 4;

let phase = PHASE_RIVER;
let phaseFrame = 0;

// --- Data ---
let riverPath = [];
let homesteads = [];
let trails = [];
let canopyCircles = [];

let riverDrawIndex = 0;
const RIVER_WIDTH = 38;
const RIVER_SPEED = 8; // points per frame

function generateRiver() {
  riverPath = [];
  let x = W * 0.65 + random(-40, 40);
  let y = -10;
  const stepY = 3;

  while (y < H + 10) {
    riverPath.push({ x, y });
    y += stepY;
    x += (noise(y * 0.005) - 0.5) * 12;
    x = constrain(x, W * 0.5, W * 0.85);
  }
}

function drawRiver() {
  if (phase === PHASE_RIVER) {
    riverDrawIndex = min(riverDrawIndex + RIVER_SPEED, riverPath.length);
    if (riverDrawIndex >= riverPath.length) {
      phase = PHASE_HOMESTEADS;
      phaseFrame = 0;
    }
  }

  noFill();
  strokeCap(ROUND);
  strokeJoin(ROUND);

  const end = phase >= PHASE_HOMESTEADS ? riverPath.length : riverDrawIndex;
  for (let w = RIVER_WIDTH; w > 0; w -= 6) {
    const ci = floor(map(w, 0, RIVER_WIDTH, 0, RIVER_COLORS.length - 0.01));
    stroke(RIVER_COLORS[ci]);
    strokeWeight(w);
    beginShape();
    for (let i = 0; i < end; i++) {
      curveVertex(riverPath[i].x, riverPath[i].y);
    }
    endShape();
  }
}

// --- Homesteads ---
const HOMESTEAD_FADE_FRAMES = 15;

function generateHomesteads() {
  homesteads = [];
  const count = floor(random(2, 4)); // 2-3 homesteads
  for (let i = 0; i < count; i++) {
    const riverIdx = floor(random(riverPath.length * 0.2, riverPath.length * 0.8));
    const riverPt = riverPath[riverIdx];
    const inlandDist = random(100, 200);
    homesteads.push({
      x: riverPt.x - inlandDist,
      y: riverPt.y + random(-30, 30),
      opacity: 0,
    });
  }
}

function drawHomesteads() {
  if (phase === PHASE_HOMESTEADS) {
    phaseFrame++;
    for (const h of homesteads) {
      h.opacity = min(h.opacity + (255 / HOMESTEAD_FADE_FRAMES), 255);
    }
    if (phaseFrame >= HOMESTEAD_FADE_FRAMES) {
      phase = PHASE_TRAILS;
      phaseFrame = 0;
    }
  }

  if (phase < PHASE_HOMESTEADS) return;

  for (const h of homesteads) {
    noStroke();
    const c = color(HOUSE_COLOR);
    fill(red(c), green(c), blue(c), h.opacity);
    rect(h.x - 6, h.y - 5, 12, 10);
    ellipse(h.x + 15, h.y + 8, 6, 6);
  }
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  frameRate(30);
  generateSeringal();
}

function generateSeringal() {
  phase = PHASE_RIVER;
  phaseFrame = 0;
  riverPath = [];
  homesteads = [];
  trails = [];
  canopyCircles = [];
  noiseSeed(random(10000));
  generateRiver();
  riverDrawIndex = 0;
  generateHomesteads();
}

function draw() {
  background(GROUND_COLOR);
  drawRiver();
  drawHomesteads();
}

function mousePressed() {
  generateSeringal();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('seringal', 'png');
  }
}
