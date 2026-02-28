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

// --- Trails ---
const TRAIL_SPEED = 35; // steps drawn per frame

function generateTrails() {
  trails = [];
  const noiseSeedVal = random(1000);

  for (const h of homesteads) {
    const trailCount = floor(random(2, 4)); // 2-3 trails per homestead
    for (let t = 0; t < trailCount; t++) {
      const path = generateOneTrail(h.x, h.y, noiseSeedVal + t * 100);
      trails.push({ path, drawIndex: 0, homestead: h });
    }
  }
}

function generateOneTrail(homeX, homeY, seed) {
  const points = [{ x: homeX, y: homeY }];
  const totalSteps = floor(random(180, 320));
  const stepSize = 5;
  let angle = random(TWO_PI);

  for (let i = 1; i <= totalSteps; i++) {
    const prev = points[i - 1];

    // Noise-based turning
    const n = noise(prev.x * 0.008 + seed, prev.y * 0.008) - 0.5;
    angle += n * 0.8;

    // Homing force: after 60% of steps, pull back toward home
    const homingStart = totalSteps * 0.6;
    if (i > homingStart) {
      const homingStrength = map(i, homingStart, totalSteps, 0, 0.15);
      const toHomeAngle = atan2(homeY - prev.y, homeX - prev.x);
      let diff = toHomeAngle - angle;
      while (diff > PI) diff -= TWO_PI;
      while (diff < -PI) diff += TWO_PI;
      angle += diff * homingStrength;
    }

    // Soft boundary repulsion
    const nx = prev.x + cos(angle) * stepSize;
    const ny = prev.y + sin(angle) * stepSize;
    if (nx < 30) angle += 0.3;
    if (nx > W - 80) angle -= 0.3; // avoid river area
    if (ny < 30) angle += 0.3;
    if (ny > H - 30) angle -= 0.3;

    points.push({
      x: constrain(prev.x + cos(angle) * stepSize, 20, W - 70),
      y: constrain(prev.y + sin(angle) * stepSize, 20, H - 20),
    });
  }

  // Close the loop — smooth return to home
  const last = points[points.length - 1];
  const returnSteps = 20;
  for (let i = 1; i <= returnSteps; i++) {
    const t = i / returnSteps;
    const smooth = t * t * (3 - 2 * t); // smoothstep
    points.push({
      x: lerp(last.x, homeX, smooth),
      y: lerp(last.y, homeY, smooth),
    });
  }

  return points;
}

function drawTrails() {
  if (phase === PHASE_TRAILS) {
    let allDone = true;
    for (const trail of trails) {
      trail.drawIndex = min(trail.drawIndex + TRAIL_SPEED, trail.path.length);
      if (trail.drawIndex < trail.path.length) allDone = false;
    }
    if (allDone) {
      phase = PHASE_CANOPY;
      phaseFrame = 0;
    }
  }

  if (phase < PHASE_TRAILS) return;

  stroke(TRAIL_COLOR);
  strokeWeight(2.5);
  noFill();
  strokeCap(ROUND);
  strokeJoin(ROUND);

  for (const trail of trails) {
    const end = phase >= PHASE_CANOPY ? trail.path.length : trail.drawIndex;
    beginShape();
    for (let i = 0; i < end; i++) {
      curveVertex(trail.path[i].x, trail.path[i].y);
    }
    endShape();
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
  generateTrails();
}

function draw() {
  background(GROUND_COLOR);
  drawRiver();
  drawHomesteads();
  drawTrails();
}

function mousePressed() {
  generateSeringal();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('seringal', 'png');
  }
}
