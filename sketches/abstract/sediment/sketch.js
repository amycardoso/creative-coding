/**
 * Sediment
 *
 * Rose curves accumulate one by one on a black canvas —
 * love as geology, each line a stratum of time.
 *
 * Controls:
 * - Press S to save a PNG snapshot
 */

const W = 800;
const H = 800;
const TOTAL_CURVES = 800;
const RESET_FRAMES = 60;

let curveCount = 0;
let startAngleDrift = 0;
let isResetting = false;
let resetFrame = 0; // counts frames during the fade-to-black reset phase

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  frameRate(30);
  colorMode(HSB, 360, 100, 100, 255);
  background(0, 0, 0);
  noFill();
}

function draw() {
  if (isResetting) {
    handleReset();
    return;
  }

  drawRoseCurve(curveCount, startAngleDrift);

  curveCount++;
  startAngleDrift += 0.003;

  if (curveCount >= TOTAL_CURVES) {
    isResetting = true;
    resetFrame = 0;
  }
}

function handleReset() {
  // Draw a semi-transparent black rect each frame to fade the canvas
  noStroke();
  fill(0, 0, 0, 12); // HSB black (B=0, S=0), alpha 12/255
  rect(0, 0, W, H);

  resetFrame++;

  if (resetFrame >= RESET_FRAMES) {
    // Canvas is faded — start again
    isResetting = false;
    curveCount = 0;
    startAngleDrift = 0;
    background(0, 0, 0); // hard clear to true black before new cycle
  }
}

function drawRoseCurve(count, startAngle) {
  // k drifts between 0.5 and 3.5 — gives varied petal counts
  const k = 2 + sin(count * 0.008) * 1.5;

  // Radius pulses ±8% like gentle breathing
  const baseRadius = 340;
  const scale = baseRadius * (1 + sin(count * 0.005) * 0.08);

  const hue = getHue(count);
  // Desaturate toward white in the final phase (700–800)
  const sat = count >= 700 ? map(count, 700, TOTAL_CURVES, 85, 25) : 85;
  stroke(hue, sat, 95, 18);
  strokeWeight(0.7);
  noFill();

  // Sweep theta over 3 full rotations — enough to reveal most rose patterns
  const steps = 1000;
  const thetaMax = TWO_PI * 3;

  beginShape();
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * thetaMax + startAngle;
    const r = cos(k * theta);
    vertex(W / 2 + r * cos(theta) * scale, H / 2 + r * sin(theta) * scale);
  }
  endShape();
}

function getHue(count) {
  // Maps curve index to hue, telling the emotional arc of love
  if (count < 150) {
    return map(count, 0, 150, 0, 20);       // crimson → rose
  } else if (count < 400) {
    return map(count, 150, 400, 20, 45);    // coral → gold
  } else if (count < 700) {
    return map(count, 400, 700, 45, 280);   // gold → violet
  } else {
    return map(count, 700, TOTAL_CURVES, 280, 360); // violet → white glow
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('sediment', 'png');
  }
  if (key === 'g' || key === 'G') {
    saveGif('sediment', 6);
  }
}
