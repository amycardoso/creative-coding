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
  const margin = 20;
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
  const motifTypes = ['zigzag', 'diamond', 'stepped', 'crosshatch', 'nestedRect', 'anaconda', 'fishbone'];
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
// All motifs FILL their band area densely — no dark background showing.

function clipBand(g, by, bh) {
  g.drawingContext.save();
  g.drawingContext.beginPath();
  g.drawingContext.rect(0, by, W / 2, bh);
  g.drawingContext.clip();
}

function unclipBand(g) {
  g.drawingContext.restore();
}

function drawZigzagBand(g, by, bh, colors) {
  const halfW = W / 2;
  clipBand(g, by, bh);

  // Dense thick zigzag lines that fill the band
  const numLines = floor(random(5, 9));
  const spacing = bh / numLines;
  const zigPeriod = spacing * 2.0;
  const sw = spacing * 0.85; // thick enough to nearly touch

  g.noFill();
  g.strokeCap(SQUARE);
  g.strokeJoin(MITER);

  for (let li = 0; li < numLines; li++) {
    g.stroke(colors[li % colors.length]);
    g.strokeWeight(sw);
    const baseY = by + (li + 0.5) * spacing;
    const amp = spacing * 0.5;

    g.beginShape();
    let up = li % 2 === 0;
    for (let x = -zigPeriod; x <= halfW + zigPeriod; x += zigPeriod / 2) {
      g.vertex(x, baseY + (up ? -amp : amp));
      up = !up;
    }
    g.endShape();
  }

  // Thin dark outlines for definition
  g.strokeWeight(1);
  g.stroke(0, 0, 0, 60);
  for (let li = 0; li < numLines; li++) {
    const baseY = by + (li + 0.5) * spacing;
    const amp = spacing * 0.5;
    g.beginShape();
    let up = li % 2 === 0;
    for (let x = -zigPeriod; x <= halfW + zigPeriod; x += zigPeriod / 2) {
      g.vertex(x, baseY + (up ? -amp : amp));
      up = !up;
    }
    g.endShape();
  }

  unclipBand(g);
}

function drawDiamondBand(g, by, bh, colors) {
  const halfW = W / 2;
  clipBand(g, by, bh);

  // Fill background with first color
  g.noStroke();
  g.fill(colors[0]);
  g.rect(0, by, halfW, bh);

  const diamH = bh * 0.85;
  const diamW = diamH * 0.9;
  const spacing = diamW * 1.05;
  const centerY = by + bh / 2;

  for (let cx = spacing * 0.3; cx < halfW + spacing; cx += spacing) {
    // Filled outer diamond
    g.fill(colors[1 % colors.length]);
    g.stroke(0, 0, 0, 50);
    g.strokeWeight(1);
    g.beginShape();
    g.vertex(cx, centerY - diamH / 2);
    g.vertex(cx + diamW / 2, centerY);
    g.vertex(cx, centerY + diamH / 2);
    g.vertex(cx - diamW / 2, centerY);
    g.endShape(CLOSE);

    // Filled inner diamond
    if (colors.length > 2) {
      g.fill(colors[2]);
      const innerH = diamH * 0.45;
      const innerW = diamW * 0.45;
      g.beginShape();
      g.vertex(cx, centerY - innerH / 2);
      g.vertex(cx + innerW / 2, centerY);
      g.vertex(cx, centerY + innerH / 2);
      g.vertex(cx - innerW / 2, centerY);
      g.endShape(CLOSE);
    }

    // Small center diamond
    g.fill(colors[0]);
    const tinyH = diamH * 0.15;
    const tinyW = diamW * 0.15;
    g.beginShape();
    g.vertex(cx, centerY - tinyH / 2);
    g.vertex(cx + tinyW / 2, centerY);
    g.vertex(cx, centerY + tinyH / 2);
    g.vertex(cx - tinyW / 2, centerY);
    g.endShape(CLOSE);
  }

  unclipBand(g);
}

function drawSteppedBand(g, by, bh, colors) {
  const halfW = W / 2;
  clipBand(g, by, bh);

  // Fill background with first color
  g.noStroke();
  g.fill(colors[0]);
  g.rect(0, by, halfW, bh);

  // Interlocking staircase rows that fill the entire band
  const numSteps = floor(random(4, 7));
  const stepH = bh / numSteps;
  const stepW = stepH * 1.2;
  const patternW = stepW * 4; // one full up-down cycle

  g.stroke(0, 0, 0, 50);
  g.strokeWeight(1);

  // Draw two interlocking staircase waves
  for (let layer = 0; layer < 2; layer++) {
    const col = colors[(layer + 1) % colors.length];
    g.fill(col);
    const xOff = layer * patternW / 2;

    for (let px = -patternW + xOff; px < halfW + patternW; px += patternW) {
      // Rising staircase
      g.beginShape();
      let x = px;
      let y = by + bh; // start at bottom
      g.vertex(x, y);
      for (let s = 0; s < numSteps; s++) {
        g.vertex(x, y - stepH);
        x += stepW;
        g.vertex(x, y - stepH);
        y -= stepH;
      }
      // Falling staircase
      for (let s = 0; s < numSteps; s++) {
        g.vertex(x, y + stepH);
        x += stepW;
        g.vertex(x, y + stepH);
        y += stepH;
      }
      g.vertex(x, by + bh);
      g.endShape(CLOSE);
    }
  }

  // Third color accent — smaller staircases offset
  if (colors.length > 2) {
    g.fill(colors[2]);
    const smallStepH = stepH * 0.5;
    const smallStepW = stepW * 0.5;
    const smallPatternW = smallStepW * 4;
    const xOff = patternW / 4;

    for (let px = -smallPatternW + xOff; px < halfW + smallPatternW; px += smallPatternW) {
      g.beginShape();
      let x = px;
      let y = by + bh / 2 + numSteps * smallStepH / 2;
      g.vertex(x, y);
      for (let s = 0; s < numSteps; s++) {
        g.vertex(x, y - smallStepH);
        x += smallStepW;
        g.vertex(x, y - smallStepH);
        y -= smallStepH;
      }
      for (let s = 0; s < numSteps; s++) {
        g.vertex(x, y + smallStepH);
        x += smallStepW;
        g.vertex(x, y + smallStepH);
        y += smallStepH;
      }
      g.vertex(x, by + bh / 2 + numSteps * smallStepH / 2);
      g.endShape(CLOSE);
    }
  }

  unclipBand(g);
}

function drawCrossHatchBand(g, by, bh, colors) {
  const halfW = W / 2;
  clipBand(g, by, bh);

  // Fill background with palette color (no black gaps)
  g.noStroke();
  g.fill(colors[0]);
  g.rect(0, by, halfW, bh);

  // Thick diagonal lines — spacing tight enough to overlap on the background
  const numLines = floor(random(5, 8));
  const spacing = bh / numLines;
  const sw = spacing * 0.65;

  g.noFill();
  g.strokeCap(SQUARE);

  // Diagonal lines going down-right
  g.stroke(colors[1 % colors.length]);
  g.strokeWeight(sw);
  for (let offset = -bh * 2; offset < halfW + bh * 2; offset += spacing) {
    g.line(offset, by, offset + bh, by + bh);
  }

  // Diagonal lines going up-right
  if (colors.length > 2) {
    g.stroke(colors[2]);
  } else {
    // Use a darker shade of colors[1] instead of black
    g.stroke(colors[1 % colors.length]);
  }
  g.strokeWeight(sw);
  for (let offset = -bh * 2; offset < halfW + bh * 2; offset += spacing) {
    g.line(offset, by + bh, offset + bh, by);
  }

  unclipBand(g);
}

function drawNestedRectBand(g, by, bh, colors) {
  const halfW = W / 2;
  clipBand(g, by, bh);

  // Filled concentric rectangles with alternating colors
  const tileW = bh * 1.05;
  const numRects = floor(random(4, 7));

  g.strokeWeight(1);
  g.stroke(0, 0, 0, 40);
  g.strokeJoin(MITER);

  for (let tx = -tileW * 0.5; tx < halfW + tileW; tx += tileW) {
    const cx = tx + tileW / 2;
    const cy = by + bh / 2;
    // Draw from outer to inner (painter's algorithm)
    for (let ri = 0; ri < numRects; ri++) {
      g.fill(colors[ri % colors.length]);
      const margin = ri * (min(tileW, bh) / (numRects * 2));
      g.rect(
        cx - tileW / 2 + margin,
        cy - bh / 2 + margin,
        tileW - margin * 2,
        bh - margin * 2
      );
    }
  }

  unclipBand(g);
}

function drawAnacondaBand(g, by, bh, colors) {
  const halfW = W / 2;
  clipBand(g, by, bh);

  // Fill background
  g.noStroke();
  g.fill(colors[0]);
  g.rect(0, by, halfW, bh);

  // Interlocking hexagonal scales like anaconda skin (Ronin)
  const scaleH = bh / floor(random(2, 4));
  const scaleW = scaleH * 1.3;
  const rows = ceil(bh / scaleH) + 1;
  const cols = ceil(halfW / scaleW) + 2;

  g.strokeWeight(2);
  g.stroke(colors[0]);
  g.strokeJoin(MITER);

  for (let row = -1; row < rows; row++) {
    const offsetX = (row % 2 === 0) ? 0 : scaleW / 2;
    for (let col = -1; col < cols; col++) {
      const cx = col * scaleW + offsetX;
      const cy = by + row * scaleH + scaleH / 2;

      // Outer hexagonal scale
      const colorIdx = (row + col) % 2 === 0 ? 1 : (colors.length > 2 ? 2 : 1);
      g.fill(colors[colorIdx % colors.length]);
      g.beginShape();
      g.vertex(cx, cy - scaleH / 2);
      g.vertex(cx + scaleW / 2, cy - scaleH / 4);
      g.vertex(cx + scaleW / 2, cy + scaleH / 4);
      g.vertex(cx, cy + scaleH / 2);
      g.vertex(cx - scaleW / 2, cy + scaleH / 4);
      g.vertex(cx - scaleW / 2, cy - scaleH / 4);
      g.endShape(CLOSE);

      // Inner diamond marking
      const innerCol = colors.length > 2 ? colors[(colorIdx + 1) % colors.length] : colors[0];
      g.fill(innerCol);
      g.noStroke();
      const iw = scaleW * 0.3;
      const ih = scaleH * 0.35;
      g.beginShape();
      g.vertex(cx, cy - ih / 2);
      g.vertex(cx + iw / 2, cy);
      g.vertex(cx, cy + ih / 2);
      g.vertex(cx - iw / 2, cy);
      g.endShape(CLOSE);
      g.stroke(colors[0]);
      g.strokeWeight(2);
    }
  }

  unclipBand(g);
}

function drawFishboneBand(g, by, bh, colors) {
  const halfW = W / 2;
  clipBand(g, by, bh);

  // Fill background
  g.noStroke();
  g.fill(colors[0]);
  g.rect(0, by, halfW, bh);

  // Herringbone / fish-bone pattern — diagonal bars meeting at a spine
  const numSpines = floor(random(2, 4));
  const spineSpacing = bh / numSpines;
  const boneLen = spineSpacing * 0.42;
  const boneSpacing = boneLen * 0.55;
  const sw = boneSpacing * 0.7;

  g.strokeCap(SQUARE);

  for (let si = 0; si < numSpines; si++) {
    const spineY = by + (si + 0.5) * spineSpacing;

    // Spine line
    g.stroke(colors[1 % colors.length]);
    g.strokeWeight(sw * 0.6);
    g.line(0, spineY, halfW, spineY);

    // Bones — diagonal lines angled away from spine
    g.strokeWeight(sw);
    for (let x = boneSpacing / 2; x < halfW + boneSpacing; x += boneSpacing) {
      // Upper bones (angled left)
      g.stroke(colors[1 % colors.length]);
      g.line(x, spineY, x - boneLen * 0.6, spineY - boneLen);

      // Lower bones (angled left, mirrored)
      const lowerCol = colors.length > 2 ? colors[2] : colors[1 % colors.length];
      g.stroke(lowerCol);
      g.line(x, spineY, x - boneLen * 0.6, spineY + boneLen);
    }

    // Fill gaps between bone tips with small accent marks
    if (colors.length > 2) {
      g.stroke(colors[2]);
      g.strokeWeight(sw * 0.4);
      for (let x = boneSpacing; x < halfW; x += boneSpacing * 2) {
        const tipY1 = spineY - boneLen;
        const tipY2 = spineY + boneLen;
        g.line(x - boneLen * 0.6 - boneSpacing * 0.3, tipY1, x - boneLen * 0.6 + boneSpacing * 0.3, tipY1);
        g.line(x - boneLen * 0.6 - boneSpacing * 0.3, tipY2, x - boneLen * 0.6 + boneSpacing * 0.3, tipY2);
      }
    }
  }

  unclipBand(g);
}

function drawBandMotif(g, band) {
  switch (band.motif) {
    case 'zigzag':
      drawZigzagBand(g, band.y, band.h, band.colors);
      break;
    case 'diamond':
      drawDiamondBand(g, band.y, band.h, band.colors);
      break;
    case 'stepped':
      drawSteppedBand(g, band.y, band.h, band.colors);
      break;
    case 'crosshatch':
      drawCrossHatchBand(g, band.y, band.h, band.colors);
      break;
    case 'nestedRect':
      drawNestedRectBand(g, band.y, band.h, band.colors);
      break;
    case 'anaconda':
      drawAnacondaBand(g, band.y, band.h, band.colors);
      break;
    case 'fishbone':
      drawFishboneBand(g, band.y, band.h, band.colors);
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

  // Separator lines between bands
  patternBuffer.stroke('#f5e6ca'); // cream white from palette
  patternBuffer.strokeWeight(1.5);
  for (let i = 0; i < bands.length - 1; i++) {
    const sepY = bands[i].y + bands[i].h;
    patternBuffer.line(0, sepY, W, sepY);
  }

  // Thin border around the whole pattern
  patternBuffer.noFill();
  patternBuffer.stroke('#f5e6ca');
  patternBuffer.strokeWeight(2);
  patternBuffer.rect(1, 1, W - 2, H - 2);
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
