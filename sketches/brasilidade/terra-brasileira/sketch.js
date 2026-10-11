/**
 * Terra Brasileira
 *
 * Procedural landscapes inspired by Tarsila do Amaral —
 * bold outlines, flat tropical color, surreal proportions.
 * Each click generates a unique composition.
 *
 * Controls:
 * - Click or press any key to generate a new composition
 * - Press S to save PNG
 */

const W = 900;
const H = 600;

// --------------- Tarsila color palettes ---------------

const PALETTES = {
  dawn: {
    sky: ['#E86B3A', '#F5C233'],
    hills: ['#9B7840', '#D4A85C', '#4E8C2A', '#6AAE3D'],
    vegetation: ['#1B8C2E', '#4DB84A', '#8BCC33', '#2A7A24'],
    accents: ['#E8334A', '#F04A2A', '#FFD633', '#FF7733'],
    ground: '#B88555',
  },
  day: {
    sky: ['#2E7CC9', '#5DADE2'],
    hills: ['#4E8C2A', '#6AAE3D', '#9B7840', '#D4A85C'],
    vegetation: ['#1B8C2E', '#4DB84A', '#8BCC33', '#33A64C'],
    accents: ['#E8334A', '#FFD633', '#F04A2A', '#FF6B9D'],
    ground: '#B88555',
  },
  dusk: {
    sky: ['#E05A3A', '#C93A6A'],
    hills: ['#7A4A1E', '#9B7840', '#4E8C2A', '#6B8E3A'],
    vegetation: ['#1B8C2E', '#33A64C', '#6AAE3D', '#4DB84A'],
    accents: ['#FFD633', '#F04A2A', '#E8334A', '#FF9933'],
    ground: '#7A4A1E',
  },
  night: {
    sky: ['#0F1E3D', '#1E3566'],
    hills: ['#2B5A1E', '#3D6B2E', '#4A3B28', '#5C7A3B'],
    vegetation: ['#1A6B22', '#2A8A33', '#339944', '#1E5A1B'],
    accents: ['#FFD633', '#D4A85C', '#6BC5E8', '#FF9933'],
    ground: '#2E1E0F',
  },
};

const TIMES_OF_DAY = ['dawn', 'day', 'dusk', 'night'];
const OUTLINE_COLOR = '#1A0A00';
const OUTLINE_WEIGHT = 3.5;

let seed;
let currentPalette;

// --------------- p5 lifecycle ---------------

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  seed = floor(random(999999));
  generateAndDraw();
}

function generateAndDraw() {
  randomSeed(seed);
  noiseSeed(seed);

  const timeOfDay = random(TIMES_OF_DAY);
  currentPalette = PALETTES[timeOfDay];

  drawSky(timeOfDay);
  drawDistantHills();
  drawTinyHouse();
  drawMidGround();
  drawGround();
  drawVegetation();
  drawAbaporuFigure();
  drawForeground();

  noLoop();
}

function mousePressed() {
  seed = floor(random(999999));
  generateAndDraw();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('terra-brasileira', 'png');
    return;
  }
  seed = floor(random(999999));
  generateAndDraw();
}

// --------------- sky ---------------

function drawSky(timeOfDay) {
  const c1 = color(currentPalette.sky[0]);
  const c2 = color(currentPalette.sky[1]);
  noStroke();
  for (let y = 0; y < H; y++) {
    const t = y / H;
    fill(lerpColor(c1, c2, t));
    rect(0, y, W, 1);
  }

  // Celestial body (~50% chance)
  if (random() < 0.5) {
    const cx = random(W * 0.15, W * 0.85);
    const cy = random(H * 0.08, H * 0.28);
    const size = random(60, 120);

    if (timeOfDay === 'night') {
      // Crescent moon
      fill('#F5E6C8');
      stroke(OUTLINE_COLOR);
      strokeWeight(OUTLINE_WEIGHT);
      ellipse(cx, cy, size, size);
      // Cut out a circle to create crescent
      fill(lerpColor(c1, c2, cy / H));
      noStroke();
      ellipse(cx + size * 0.25, cy - size * 0.1, size * 0.8, size * 0.8);
    } else {
      // Sun
      fill('#FFD633');
      stroke(OUTLINE_COLOR);
      strokeWeight(OUTLINE_WEIGHT);
      ellipse(cx, cy, size, size);

      // Radiating lines
      const rayCount = floor(random(8, 14));
      strokeWeight(2.5);
      stroke(OUTLINE_COLOR);
      for (let i = 0; i < rayCount; i++) {
        const angle = (TWO_PI / rayCount) * i + random(-0.1, 0.1);
        const innerR = size * 0.55;
        const outerR = size * 0.55 + random(15, 35);
        line(
          cx + cos(angle) * innerR, cy + sin(angle) * innerR,
          cx + cos(angle) * outerR, cy + sin(angle) * outerR
        );
      }
    }
  }
}

// --------------- hills ---------------

function drawHill(yBase, amplitude, noiseScale, noiseOffset, fillColor, sw) {
  fill(fillColor);
  stroke(OUTLINE_COLOR);
  strokeWeight(sw);
  strokeJoin(ROUND);

  beginShape();
  vertex(0, H);
  for (let x = -10; x <= W + 10; x += 4) {
    const n = noise(x * noiseScale + noiseOffset);
    const y = yBase - n * amplitude;
    curveVertex(x, y);
  }
  vertex(W, H);
  endShape(CLOSE);
}

function drawDistantHills() {
  const hillCount = floor(random(2, 4));
  for (let i = 0; i < hillCount; i++) {
    const yBase = H * random(0.35, 0.5);
    const amplitude = random(40, 90);
    const noiseScale = random(0.003, 0.007);
    const noiseOffset = random(1000);
    const col = random(currentPalette.hills);
    drawHill(yBase, amplitude, noiseScale, noiseOffset, col, 2.5);
  }
}

function drawMidGround() {
  const hillCount = floor(random(1, 3));
  for (let i = 0; i < hillCount; i++) {
    const yBase = H * random(0.5, 0.65);
    const amplitude = random(60, 130);
    const noiseScale = random(0.002, 0.005);
    const noiseOffset = random(2000, 3000);
    const col = random(currentPalette.hills);
    drawHill(yBase, amplitude, noiseScale, noiseOffset, col, OUTLINE_WEIGHT);
  }
}

// --------------- ground ---------------

function drawGround() {
  const groundY = H * 0.75;
  const noiseOff = random(5000, 6000);

  // Organic top edge using noise
  fill(currentPalette.ground);
  stroke(OUTLINE_COLOR);
  strokeWeight(OUTLINE_WEIGHT);
  strokeJoin(ROUND);
  beginShape();
  vertex(0, H);
  for (let x = -10; x <= W + 10; x += 4) {
    const n = noise(x * 0.005 + noiseOff);
    curveVertex(x, groundY - n * 20 + 10);
  }
  vertex(W, H);
  endShape(CLOSE);

  // Subtle texture lines
  stroke(OUTLINE_COLOR);
  strokeWeight(1);
  noFill();
  for (let i = 0; i < 3; i++) {
    const y = H * 0.8 + i * random(12, 25);
    if (y > H - 5) continue;
    beginShape();
    for (let x = 0; x <= W; x += 8) {
      const n = noise(x * 0.01 + i * 100) * 8;
      curveVertex(x, y + n);
    }
    endShape();
  }
}

// --------------- vegetation ---------------

const PLANT_TYPES = ['cactus', 'palm', 'cylindrical', 'banana', 'bush'];

function drawVegetation() {
  const count = floor(random(6, 12));
  const plants = [];

  // Distribute plants across 3 depth zones to avoid clothesline effect
  const zones = [
    { yMin: 0.42, yMax: 0.54, sizeMin: 30, sizeMax: 65 },   // distant — small
    { yMin: 0.54, yMax: 0.66, sizeMin: 55, sizeMax: 100 },   // mid — medium
    { yMin: 0.66, yMax: 0.76, sizeMin: 80, sizeMax: 140 },   // near — large
  ];

  for (let i = 0; i < count; i++) {
    const zone = random(zones);
    const x = random(W * 0.05, W * 0.95);
    const y = H * random(zone.yMin, zone.yMax);
    const size = random(zone.sizeMin, zone.sizeMax);

    const tooClose = plants.some(p => dist(x, y, p.x, p.y) < size * 0.55);
    if (tooClose) continue;

    plants.push({ x, y, size, type: random(PLANT_TYPES) });
  }

  // Sort by y so closer plants draw on top
  plants.sort((a, b) => a.y - b.y);
  for (const p of plants) {
    drawPlant(p.type, p.x, p.y, p.size);
  }
}

function drawPlant(type, x, y, size) {
  switch (type) {
    case 'cactus': drawCactus(x, y, size); break;
    case 'palm': drawPalmTree(x, y, size); break;
    case 'cylindrical': drawCylindricalTree(x, y, size); break;
    case 'banana': drawBananaLeaf(x, y, size); break;
    case 'bush': drawRoundBush(x, y, size); break;
  }
}

function drawCactus(x, y, size) {
  const col = random(currentPalette.vegetation);
  fill(col);
  stroke(OUTLINE_COLOR);
  strokeWeight(OUTLINE_WEIGHT);
  strokeJoin(ROUND);

  // Main body
  ellipse(x, y - size * 0.5, size * 0.35, size);

  // Left arm
  if (random() > 0.3) {
    const armY = y - size * 0.45;
    beginShape();
    curveVertex(x - size * 0.17, armY);
    curveVertex(x - size * 0.17, armY);
    curveVertex(x - size * 0.35, armY - size * 0.1);
    curveVertex(x - size * 0.4, armY - size * 0.3);
    curveVertex(x - size * 0.35, armY - size * 0.45);
    curveVertex(x - size * 0.35, armY - size * 0.45);
    endShape();
  }

  // Right arm
  if (random() > 0.3) {
    const armY = y - size * 0.35;
    beginShape();
    curveVertex(x + size * 0.17, armY);
    curveVertex(x + size * 0.17, armY);
    curveVertex(x + size * 0.35, armY - size * 0.05);
    curveVertex(x + size * 0.38, armY - size * 0.25);
    curveVertex(x + size * 0.32, armY - size * 0.4);
    curveVertex(x + size * 0.32, armY - size * 0.4);
    endShape();
  }
}

function drawPalmTree(x, y, size) {
  const trunkCol = '#8B6543';
  const leafCol = random(currentPalette.vegetation);

  stroke(OUTLINE_COLOR);
  strokeWeight(OUTLINE_WEIGHT);
  fill(trunkCol);

  // Thick curved trunk with taper
  const lean = random(-size * 0.2, size * 0.2);
  const baseW = size * 0.12;
  const topW = size * 0.07;
  beginShape();
  vertex(x - baseW, y);
  curveVertex(x - baseW, y);
  curveVertex(x + lean * 0.3 - baseW * 0.8, y - size * 0.35);
  curveVertex(x + lean * 0.7 - topW, y - size * 0.65);
  curveVertex(x + lean - topW * 0.6, y - size * 0.8);
  curveVertex(x + lean + topW * 0.6, y - size * 0.8);
  curveVertex(x + lean * 0.7 + topW, y - size * 0.65);
  curveVertex(x + lean * 0.3 + baseW * 0.8, y - size * 0.35);
  curveVertex(x + baseW, y);
  vertex(x + baseW, y);
  endShape(CLOSE);

  // Lush leaf fronds — wider, drooping, more leaf-like
  fill(leafCol);
  const topX = x + lean;
  const topY = y - size * 0.8;
  const frondCount = floor(random(6, 10));
  for (let i = 0; i < frondCount; i++) {
    const angle = map(i, 0, frondCount - 1, -PI * 0.85, PI * 0.85) + random(-0.15, 0.15);
    const frondLen = size * random(0.4, 0.65);
    const droop = 0.3 + abs(sin(angle)) * 0.4; // outer fronds droop more
    const endX = topX + cos(angle - HALF_PI) * frondLen;
    const endY = topY + sin(angle - HALF_PI) * frondLen + frondLen * droop;
    const cp1X = topX + cos(angle - HALF_PI) * frondLen * 0.4;
    const cp1Y = topY + sin(angle - HALF_PI) * frondLen * 0.2;
    const cp2X = topX + cos(angle - HALF_PI) * frondLen * 0.7;
    const cp2Y = topY + sin(angle - HALF_PI) * frondLen * 0.4 + frondLen * droop * 0.5;
    const leafWidth = size * 0.08;
    const perpX = cos(angle) * leafWidth;
    const perpY = sin(angle) * leafWidth;

    beginShape();
    vertex(topX, topY);
    bezierVertex(cp1X + perpX, cp1Y + perpY, cp2X + perpX, cp2Y + perpY, endX, endY);
    bezierVertex(cp2X - perpX, cp2Y - perpY, cp1X - perpX, cp1Y - perpY, topX, topY);
    endShape(CLOSE);
  }
}

function drawCylindricalTree(x, y, size) {
  const trunkCol = '#8B6543';
  const canopyCol = random(currentPalette.vegetation);

  fill(trunkCol);
  stroke(OUTLINE_COLOR);
  strokeWeight(OUTLINE_WEIGHT);

  // Thick cylindrical trunk (Floresta style)
  const tw = size * 0.1;
  beginShape();
  vertex(x - tw, y);
  vertex(x - tw * 0.85, y - size * 0.55);
  vertex(x + tw * 0.85, y - size * 0.55);
  vertex(x + tw, y);
  endShape(CLOSE);

  // Full round canopy
  fill(canopyCol);
  ellipse(x, y - size * 0.65, size * 0.55, size * 0.5);
}

function drawBananaLeaf(x, y, size) {
  const col = random(currentPalette.vegetation);
  fill(col);
  stroke(OUTLINE_COLOR);
  strokeWeight(OUTLINE_WEIGHT);

  const lean = random(-0.4, 0.4);
  push();
  translate(x, y);
  rotate(lean);

  // Wide, lush leaf shape with pointed tip
  beginShape();
  curveVertex(0, 0);
  curveVertex(0, 0);
  curveVertex(-size * 0.15, -size * 0.25);
  curveVertex(-size * 0.18, -size * 0.5);
  curveVertex(-size * 0.1, -size * 0.75);
  curveVertex(0, -size * 0.9);
  curveVertex(size * 0.1, -size * 0.75);
  curveVertex(size * 0.18, -size * 0.5);
  curveVertex(size * 0.15, -size * 0.25);
  curveVertex(0, 0);
  curveVertex(0, 0);
  endShape(CLOSE);

  // Center vein
  stroke(OUTLINE_COLOR);
  strokeWeight(2);
  noFill();
  line(0, -size * 0.05, 0, -size * 0.85);

  // Side veins
  strokeWeight(1);
  for (let i = 1; i <= 4; i++) {
    const vy = -size * 0.15 * i;
    const vw = size * 0.12 * (1 - i * 0.15);
    line(0, vy, -vw, vy - size * 0.06);
    line(0, vy, vw, vy - size * 0.06);
  }
  pop();
}

function drawRoundBush(x, y, size) {
  const cols = [random(currentPalette.vegetation), random(currentPalette.vegetation)];
  stroke(OUTLINE_COLOR);
  strokeWeight(OUTLINE_WEIGHT);

  // Larger overlapping circles for a lush bush
  const count = floor(random(4, 7));
  for (let i = 0; i < count; i++) {
    fill(random(cols));
    const ox = random(-size * 0.2, size * 0.2);
    const oy = random(-size * 0.15, size * 0.05);
    const s = size * random(0.3, 0.5);
    ellipse(x + ox, y - s * 0.4 + oy, s, s * random(0.85, 1.1));
  }
}

// --------------- foreground ---------------

function drawForeground() {
  const count = floor(random(1, 4));
  for (let i = 0; i < count; i++) {
    const side = random() < 0.5 ? 'left' : 'right';
    const x = side === 'left' ? random(-20, W * 0.15) : random(W * 0.85, W + 20);
    const y = H * random(0.5, 0.85);
    const size = random(100, 180);

    if (random() < 0.5) {
      drawBananaLeaf(x, y, size);
    } else {
      drawRoundBush(x, y, size);
    }
  }
}

// --------------- surreal elements ---------------

function drawAbaporuFigure() {
  if (random() > 0.3) return;

  const x = random(W * 0.25, W * 0.75);
  const y = H * random(0.55, 0.7);
  const size = random(80, 140);
  const col = random(currentPalette.accents);

  fill(col);
  stroke(OUTLINE_COLOR);
  strokeWeight(OUTLINE_WEIGHT);
  strokeJoin(ROUND);

  // Oversized foot
  ellipse(x, y, size * 0.5, size * 0.2);

  // Long leg + body
  beginShape();
  curveVertex(x - size * 0.08, y - size * 0.05);
  curveVertex(x - size * 0.08, y - size * 0.05);
  curveVertex(x - size * 0.1, y - size * 0.5);
  curveVertex(x - size * 0.05, y - size * 0.7);
  curveVertex(x + size * 0.05, y - size * 0.7);
  curveVertex(x + size * 0.06, y - size * 0.5);
  curveVertex(x + size * 0.08, y - size * 0.05);
  curveVertex(x + size * 0.08, y - size * 0.05);
  endShape(CLOSE);

  // Tiny head
  ellipse(x - size * 0.02, y - size * 0.78, size * 0.12, size * 0.12);

  // Arm resting on knee
  noFill();
  strokeWeight(OUTLINE_WEIGHT);
  beginShape();
  curveVertex(x + size * 0.05, y - size * 0.6);
  curveVertex(x + size * 0.05, y - size * 0.6);
  curveVertex(x + size * 0.15, y - size * 0.45);
  curveVertex(x + size * 0.1, y - size * 0.3);
  curveVertex(x + size * 0.1, y - size * 0.3);
  endShape();
}

function drawTinyHouse() {
  if (random() > 0.2) return;

  const x = random(W * 0.2, W * 0.8);
  const y = H * random(0.4, 0.55);
  const size = random(15, 28);

  fill(random(currentPalette.accents));
  stroke(OUTLINE_COLOR);
  strokeWeight(2);

  // Walls
  rect(x - size * 0.5, y - size * 0.5, size, size * 0.6);

  // Roof
  triangle(
    x - size * 0.65, y - size * 0.5,
    x, y - size,
    x + size * 0.65, y - size * 0.5
  );

  // Door
  fill(OUTLINE_COLOR);
  rect(x - size * 0.1, y - size * 0.15, size * 0.2, size * 0.25);
}
