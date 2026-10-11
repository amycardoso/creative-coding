const W = 800;
const H = 800;
const CX = W / 2;
const CY = H / 2;

const NUM_RINGS = 12;
const SEGMENTS_PER_RING = 12;
const SEGMENT_GAP = 0.05;
const INNER_RADIUS = 60;
const OUTER_RADIUS = 350;
const SCHWARZSCHILD_RADIUS = 50;
const MAX_SPEED = 0.02;

const COLOR_INNER = [0x1A, 0x3A, 0x5C];
const COLOR_MID = [0x33, 0x88, 0xAA];
const COLOR_OUTER = [0xFF, 0x9E, 0x2C];

let ringAngles = [];
let ringSpeeds = [];
let ringRadii = [];
let ringColors = [];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  colorMode(RGB);
  frameRate(60);

  for (let i = 0; i < NUM_RINGS; i++) {
    const t = i / (NUM_RINGS - 1);
    const r = lerp(INNER_RADIUS, OUTER_RADIUS, t);
    ringRadii.push(r);

    const dilationFactor = sqrt(1 - SCHWARZSCHILD_RADIUS / r);
    ringSpeeds.push(dilationFactor * MAX_SPEED);

    ringAngles.push(random(TWO_PI));

    ringColors.push(ringColor(t));
  }
}

function ringColor(t) {
  if (t < 0.5) {
    const st = t / 0.5;
    return [
      lerp(COLOR_INNER[0], COLOR_MID[0], st),
      lerp(COLOR_INNER[1], COLOR_MID[1], st),
      lerp(COLOR_INNER[2], COLOR_MID[2], st),
    ];
  }
  const st = (t - 0.5) / 0.5;
  return [
    lerp(COLOR_MID[0], COLOR_OUTER[0], st),
    lerp(COLOR_MID[1], COLOR_OUTER[1], st),
    lerp(COLOR_MID[2], COLOR_OUTER[2], st),
  ];
}

function draw() {
  background(0, 25);

  drawGuideCircles();
  drawRadialGrid();
  drawRings();
  drawEventHorizon();

  for (let i = 0; i < NUM_RINGS; i++) {
    ringAngles[i] += ringSpeeds[i];
  }
}

function drawGuideCircles() {
  noFill();
  strokeWeight(0.5);
  stroke(255, 12);
  for (let i = 0; i < NUM_RINGS; i++) {
    ellipse(CX, CY, ringRadii[i] * 2, ringRadii[i] * 2);
  }
}

function drawRadialGrid() {
  strokeWeight(0.5);
  stroke(255, 15);
  for (let i = 0; i < 12; i++) {
    const angle = (TWO_PI / 12) * i;
    const x1 = CX + cos(angle) * (INNER_RADIUS - 10);
    const y1 = CY + sin(angle) * (INNER_RADIUS - 10);
    const x2 = CX + cos(angle) * (OUTER_RADIUS + 20);
    const y2 = CY + sin(angle) * (OUTER_RADIUS + 20);
    line(x1, y1, x2, y2);
  }
}

function drawRings() {
  noFill();

  for (let i = 0; i < NUM_RINGS; i++) {
    const r = ringRadii[i];
    const col = ringColors[i];
    const angleOffset = ringAngles[i];
    const segmentArc = (TWO_PI / SEGMENTS_PER_RING) - SEGMENT_GAP;

    strokeWeight(map(i, 0, NUM_RINGS - 1, 3, 5));
    stroke(col[0], col[1], col[2]);

    for (let s = 0; s < SEGMENTS_PER_RING; s++) {
      const startAngle = angleOffset + (TWO_PI / SEGMENTS_PER_RING) * s;
      const endAngle = startAngle + segmentArc;
      arc(CX, CY, r * 2, r * 2, startAngle, endAngle);

      drawTickMark(r, startAngle);
      drawTickMark(r, endAngle);
    }
  }
}

function drawTickMark(radius, angle) {
  const tickLen = 4;
  const x1 = CX + cos(angle) * (radius - tickLen);
  const y1 = CY + sin(angle) * (radius - tickLen);
  const x2 = CX + cos(angle) * (radius + tickLen);
  const y2 = CY + sin(angle) * (radius + tickLen);
  strokeWeight(1);
  stroke(255, 180);
  line(x1, y1, x2, y2);
}

function drawEventHorizon() {
  const ehRadius = SCHWARZSCHILD_RADIUS * 0.8;

  noStroke();
  for (let i = 4; i >= 0; i--) {
    const glowR = ehRadius + i * 8;
    const alpha = map(i, 0, 4, 30, 5);
    fill(26, 58, 92, alpha);
    ellipse(CX, CY, glowR * 2, glowR * 2);
  }

  fill(0);
  noStroke();
  ellipse(CX, CY, ehRadius * 2, ehRadius * 2);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('time-dilation', 'png');
  }
  if (key === 'g' || key === 'G') {
    saveGif('time-dilation', 5);
  }
}
