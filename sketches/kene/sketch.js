/**
 * Kene
 *
 * Generative sacred geometry inspired by the kene patterns of the
 * Huni Kuin (Kaxinawa) people from Acre, Brazil. Rendered in the
 * vibrant palette of the MAHKU collective.
 *
 * The pattern weaves itself into existence line by line,
 * like a loom building sacred fabric.
 *
 * Part of the Acre Series.
 *
 * Controls:
 * - Click: Generate new pattern
 * - S: Save PNG
 * - Shift+S: Start/stop GIF recording
 */

const W = 800;
const H = 800;

// --- MAHKU-inspired palette ---
const PALETTE = [
  '#c0392b', // deep crimson
  '#2980b9', // rich blue
  '#f39c12', // warm gold
  '#27ae60', // forest green
  '#8e44ad', // deep purple
  '#f5e6ca', // cream white
  '#e74c3c', // bright red
  '#1abc9c', // teal
];
const BG_COLOR = '#0a0a12';

// --- Animation ---
const PHASE_WEAVING = 0;
const PHASE_DONE = 1;
let phase = PHASE_WEAVING;
let revealRow = 0;
const REVEAL_SPEED = 5; // pixel rows per frame

// --- Pattern buffer ---
let patternBuffer;

// --- Band data ---
let bands = [];

// --- Band generation ---
function generateBands() {
  bands = [];
  const margin = 15;
  const numBands = floor(random(5, 8)); // 5-7 bands
  const availableH = H - margin * 2;

  // Generate random heights that sum to availableH
  let heights = [];
  for (let i = 0; i < numBands; i++) {
    heights.push(random(0.7, 1.3));
  }
  const totalWeight = heights.reduce((a, b) => a + b, 0);
  heights = heights.map(w => floor((w / totalWeight) * availableH));

  // Fix rounding errors
  const diff = availableH - heights.reduce((a, b) => a + b, 0);
  heights[0] += diff;

  // Assign motifs and colors
  const motifTypes = ['zigzag', 'diamond', 'stepped', 'crosshatch', 'nestedRect'];
  let lastMotif = '';
  let lastColorIdx = -1;
  let y = margin;

  for (let i = 0; i < numBands; i++) {
    // Pick a motif different from the previous band
    let motif;
    do {
      motif = random(motifTypes);
    } while (motif === lastMotif && motifTypes.length > 1);
    lastMotif = motif;

    // Pick 2-3 colors, avoiding same first color as previous band
    let colorIndices;
    do {
      colorIndices = pickRandomIndices(PALETTE.length, floor(random(2, 4)));
    } while (colorIndices[0] === lastColorIdx);
    lastColorIdx = colorIndices[0];

    const bandColors = colorIndices.map(idx => PALETTE[idx]);

    bands.push({
      y,
      h: heights[i],
      motif,
      colors: bandColors,
    });

    y += heights[i];
  }
}

function pickRandomIndices(max, count) {
  const indices = [];
  while (indices.length < count) {
    const idx = floor(random(max));
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices;
}

// --- Bilateral symmetry ---
function mirrorBand(g, by, bh) {
  const leftHalf = g.get(0, by, W / 2, bh);
  g.push();
  g.translate(W, 0);
  g.scale(-1, 1);
  g.image(leftHalf, 0, by);
  g.pop();
}

// --- Motifs ---
// All motifs draw into the LEFT HALF only (0 to W/2).
// mirrorBand() handles the right half.

function drawZigzagBand(g, by, bh, colors) {
  const halfW = W / 2;
  const numLines = floor(random(3, 6));
  const spacing = bh / (numLines + 1);
  const zigPeriod = spacing * 1.8;

  g.noFill();
  g.strokeCap(ROUND);
  g.strokeJoin(ROUND);
  g.strokeWeight(3);

  for (let li = 0; li < numLines; li++) {
    g.stroke(colors[li % colors.length]);
    const baseY = by + (li + 1) * spacing;
    const amp = spacing * 0.35;

    g.beginShape();
    let up = li % 2 === 0;
    for (let x = 0; x <= halfW + zigPeriod; x += zigPeriod / 2) {
      g.vertex(x, baseY + (up ? -amp : amp));
      up = !up;
    }
    g.endShape();
  }
}

function drawDiamondBand(g, by, bh, colors) {
  const halfW = W / 2;
  const diamH = bh * 0.65;
  const diamW = diamH * 0.8;
  const spacing = diamW * 1.3;
  const centerY = by + bh / 2;

  g.noFill();
  g.strokeWeight(3);
  g.strokeJoin(MITER);

  for (let cx = spacing * 0.4; cx < halfW + spacing; cx += spacing) {
    // Outer diamond
    g.stroke(colors[0]);
    g.beginShape();
    g.vertex(cx, centerY - diamH / 2);
    g.vertex(cx + diamW / 2, centerY);
    g.vertex(cx, centerY + diamH / 2);
    g.vertex(cx - diamW / 2, centerY);
    g.endShape(CLOSE);

    // Inner diamond
    if (colors.length > 1) {
      g.stroke(colors[1]);
      const innerH = diamH * 0.4;
      const innerW = diamW * 0.4;
      g.beginShape();
      g.vertex(cx, centerY - innerH / 2);
      g.vertex(cx + innerW / 2, centerY);
      g.vertex(cx, centerY + innerH / 2);
      g.vertex(cx - innerW / 2, centerY);
      g.endShape(CLOSE);
    }

    // Connecting lines between diamonds
    if (colors.length > 2) {
      g.stroke(colors[2]);
      g.strokeWeight(2);
      g.line(cx + diamW / 2, centerY, cx + spacing - diamW / 2, centerY);
      g.strokeWeight(3);
    }
  }
}

function drawBandMotif(g, band) {
  switch (band.motif) {
    case 'zigzag':
      drawZigzagBand(g, band.y, band.h, band.colors);
      break;
    case 'diamond':
      drawDiamondBand(g, band.y, band.h, band.colors);
      break;
    // More motifs added in later tasks
    default:
      drawZigzagBand(g, band.y, band.h, band.colors);
      break;
  }
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  frameRate(30);
  patternBuffer = createGraphics(W, H);
  patternBuffer.pixelDensity(2);
  generatePattern();
}

function generatePattern() {
  phase = PHASE_WEAVING;
  revealRow = 0;
  bands = [];

  patternBuffer.background(BG_COLOR);
  generateBands();

  for (const band of bands) {
    drawBandMotif(patternBuffer, band);
    mirrorBand(patternBuffer, band.y, band.h);
  }
}

function draw() {
  background(BG_COLOR);

  if (phase === PHASE_WEAVING) {
    revealRow = min(revealRow + REVEAL_SPEED, H);
    if (revealRow >= H) {
      phase = PHASE_DONE;
    }
  }

  // Show only the revealed portion of the pattern
  if (revealRow > 0) {
    image(patternBuffer, 0, 0, W, revealRow, 0, 0, W, revealRow);
  }
}

function mousePressed() {
  generatePattern();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('kene', 'png');
  }
}
