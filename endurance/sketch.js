const W = 800;
const H = 800;
const CX = W / 2;
const CY = H / 2;

// Reference frame radii
const R_EARTH = 300;
const R_ORBIT = 220;
const R_MILLER = 140;

// Time dilation factors (relative to Earth)
const DILATION_EARTH = 1.0;
const DILATION_ORBIT = 0.5;
const DILATION_MILLER = 0.08;

// Colors
const COL_EARTH = [0xFF, 0xD7, 0x00];   // #FFD700 gold
const COL_ORBIT = [0x33, 0x88, 0xAA];   // #3388AA teal
const COL_MILLER = [0x1A, 0x3A, 0x5C];  // #1A3A5C deep blue

const frames = [
  { radius: R_EARTH, dilation: DILATION_EARTH, color: COL_EARTH, label: 'EARTH' },
  { radius: R_ORBIT, dilation: DILATION_ORBIT, color: COL_ORBIT, label: 'ENDURANCE' },
  { radius: R_MILLER, dilation: DILATION_MILLER, color: COL_MILLER, label: 'MILLER' },
];

let startMillis;
let startH, startM, startS;

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  colorMode(RGB);
  frameRate(60);

  startMillis = millis();
  startH = hour();
  startM = minute();
  startS = second();
}

function draw() {
  background(0, 20);

  drawZoneCircles();
  drawTickMarks();
  drawAllHands();
  drawLabels();
}

function drawZoneCircles() {
  noFill();
  strokeWeight(0.5);
  stroke(255, 20);
  ellipse(CX, CY, R_EARTH * 2, R_EARTH * 2);
  ellipse(CX, CY, R_ORBIT * 2, R_ORBIT * 2);
  ellipse(CX, CY, R_MILLER * 2, R_MILLER * 2);
}

function drawTickMarks() {
  const outerR = R_EARTH + 20;

  for (let i = 0; i < 60; i++) {
    const angle = map(i, 0, 60, 0, TWO_PI) - HALF_PI;
    const isHour = i % 5 === 0;
    const innerR = isHour ? outerR - 15 : outerR - 8;
    const alpha = isHour ? 60 : 30;
    const weight = isHour ? 1.5 : 0.5;

    strokeWeight(weight);
    stroke(255, alpha);
    line(
      CX + cos(angle) * innerR,
      CY + sin(angle) * innerR,
      CX + cos(angle) * outerR,
      CY + sin(angle) * outerR
    );
  }
}

function getElapsedSeconds() {
  return (millis() - startMillis) / 1000;
}

function getRealTimeSeconds() {
  const baseSeconds = startH * 3600 + startM * 60 + startS;
  return baseSeconds + getElapsedSeconds();
}

function drawAllHands() {
  for (const frame of frames) {
    const totalSeconds = getRealTimeSeconds() * frame.dilation;

    const s = totalSeconds % 60;
    const m = (totalSeconds / 60) % 60;
    const h = (totalSeconds / 3600) % 12;

    const secondAngle = map(s, 0, 60, 0, TWO_PI) - HALF_PI;
    const minuteAngle = map(m, 0, 60, 0, TWO_PI) - HALF_PI;
    const hourAngle = map(h, 0, 12, 0, TWO_PI) - HALF_PI;

    const col = frame.color;
    const r = frame.radius;

    // Second hand — thin, full radius (primary trail element)
    strokeWeight(1.5);
    stroke(col[0], col[1], col[2], 200);
    line(CX, CY, CX + cos(secondAngle) * r, CY + sin(secondAngle) * r);

    // Minute hand — medium weight, 75% radius
    strokeWeight(2.5);
    stroke(col[0], col[1], col[2], 220);
    line(CX, CY, CX + cos(minuteAngle) * (r * 0.75), CY + sin(minuteAngle) * (r * 0.75));

    // Hour hand — thicker, 50% radius
    strokeWeight(3.5);
    stroke(col[0], col[1], col[2], 240);
    line(CX, CY, CX + cos(hourAngle) * (r * 0.5), CY + sin(hourAngle) * (r * 0.5));
  }

  // Center dot
  noStroke();
  fill(255, 80);
  ellipse(CX, CY, 6, 6);
}

function drawLabels() {
  textAlign(CENTER, CENTER);
  textSize(10);
  noStroke();

  for (const frame of frames) {
    const col = frame.color;
    fill(col[0], col[1], col[2], 120);
    text(frame.label, CX, CY - frame.radius + 20);
  }

  // Dilation factors
  textSize(8);
  fill(COL_EARTH[0], COL_EARTH[1], COL_EARTH[2], 80);
  text('1.0×', CX, CY - R_EARTH + 32);

  fill(COL_ORBIT[0], COL_ORBIT[1], COL_ORBIT[2], 80);
  text('0.5×', CX, CY - R_ORBIT + 32);

  fill(COL_MILLER[0], COL_MILLER[1], COL_MILLER[2], 80);
  text('0.08×', CX, CY - R_MILLER + 32);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('endurance', 'png');
  }
  if (key === 'g' || key === 'G') {
    saveGif('endurance', 5);
  }
}
