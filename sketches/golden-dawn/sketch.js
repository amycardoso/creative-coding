/**
 * Golden Dawn
 *
 * A mountain cabin at first light — deep purple sky dissolving into vivid gold,
 * sharp pine silhouettes, a morning star still hanging in the upper sky.
 *
 * Controls:
 * - Press R to regenerate
 * - Press S to save a PNG snapshot
 */

const W = 800;
const H = 800;
const HORIZON = 0.58;  // sky/mountain boundary (fraction of H)
const TERRAIN  = 0.74; // foreground start (fraction of H)

let mountainSeed, terrainSeed, pineSeed, birdSeed;
let cabinX, starX, starY;

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  noLoop();
  regenerateSeeds();
}

function regenerateSeeds() {
  mountainSeed = floor(random(10000));
  terrainSeed  = floor(random(10000));
  pineSeed     = floor(random(10000));
  birdSeed     = floor(random(10000));
  cabinX       = random(W * 0.38, W * 0.62);
  starX        = random(W * 0.12, W * 0.45);
  starY        = random(H * 0.06, H * 0.22);
}

function draw() {
  background(12, 4, 32);
  drawSky();
  drawMorningStar();
  drawHorizonGlow();
  drawMountains();
  drawForeground();
  drawPines();
  drawCabin(cabinX, H * TERRAIN);
  drawBirds();
  drawVignette();
}

function skyColor(p) {
  let r, g, b;
  if (p < 0.20) {
    const s = p / 0.20;
    r = lerp(12, 40, s);  g = lerp(4, 12, s);   b = lerp(32, 80, s);
  } else if (p < 0.48) {
    const s = (p - 0.20) / 0.28;
    r = lerp(40, 104, s); g = lerp(12, 32, s);  b = lerp(80, 160, s);
  } else if (p < 0.74) {
    const s = (p - 0.48) / 0.26;
    r = lerp(104, 192, s); g = lerp(32, 96, s); b = lerp(160, 32, s);
  } else {
    const s = (p - 0.74) / 0.26;
    r = lerp(192, 248, s); g = lerp(96, 208, s); b = lerp(32, 80, s);
  }
  return [r, g, b];
}

function drawSky() {
  const hy = floor(H * HORIZON);
  noStroke();
  for (let y = 0; y < hy; y++) {
    const p = y / hy;
    const [r, g, b] = skyColor(p);
    const n  = noise(mountainSeed + 0.5, y * 0.006) * 14 - 7;
    const n2 = noise(mountainSeed + 1.5, y * 0.018) * 5 - 2.5;
    fill(
      constrain(r + n * 0.45 + n2, 0, 255),
      constrain(g + n * 0.1,       0, 255),
      constrain(b + n2 * 0.3,      0, 255)
    );
    rect(0, y, W, 1);
  }
}

function drawMorningStar() {
  noStroke();
  // Glow halo — outermost to innermost
  fill(232, 224, 192, 20);  ellipse(starX, starY, 24, 24);
  fill(232, 224, 192, 40);  ellipse(starX, starY, 15, 15);
  fill(232, 224, 192, 85);  ellipse(starX, starY, 8, 8);
  fill(232, 224, 192, 200); ellipse(starX, starY, 3.5, 3.5);
  fill(255, 255, 245, 255); ellipse(starX, starY, 2, 2);
}
function drawHorizonGlow() {
  const hy = H * HORIZON;
  noStroke();
  for (let y = hy - 18; y < hy + 10; y++) {
    const d = abs(y - (hy - 4)) / 20;
    const alpha = (1 - d * d) * 150;
    fill(248, 200, 60, alpha);
    rect(0, y, W, 1);
  }
}
function drawMountains() {
  const hy = floor(H * HORIZON);
  fill(16, 8, 24); // #100818
  noStroke();
  beginShape();
  vertex(0, H);
  for (let x = 0; x <= W; x += 2) {
    const n = noise(mountainSeed + x * 0.004);
    const peakHeight = lerp(H * 0.08, H * 0.28, n);
    vertex(x, hy - peakHeight);
  }
  vertex(W, H);
  endShape(CLOSE);
}
function drawForeground() {
  const ft = H * TERRAIN;

  // Dark gradient base
  noStroke();
  for (let y = ft; y <= H; y++) {
    const p = (y - ft) / (H - ft);
    fill(lerp(22, 12, p), lerp(10, 6, p), lerp(24, 16, p));
    rect(0, y, W, 1);
  }

  // Organic ridge silhouette
  fill(18, 8, 22);
  noStroke();
  beginShape();
  vertex(0, H);
  vertex(0, H * 0.90);
  const xPoints = [0.08, 0.20, 0.35, 0.50, 0.65, 0.78, 0.90];
  for (let i = 0; i < xPoints.length; i++) {
    const xf = xPoints[i];
    const yBase = lerp(0.848, 0.840, xf);
    const jitter = noise(terrainSeed + i * 0.5) * 0.030 - 0.015;
    vertex(W * xf, H * (yBase + jitter));
  }
  vertex(W, H * 0.872);
  vertex(W, H);
  endShape(CLOSE);
}
function drawPineTree(x, baseY, h) {
  fill(28, 14, 36); // distinctly darker than cabin, distinctly lighter than mountain
  noStroke();
  const w = h * 0.35;
  // Three tiers — progressively narrower and higher
  triangle(x, baseY - h,        x - w,        baseY,        x + w,        baseY);
  triangle(x, baseY - h * 0.60, x - w * 0.72, baseY - h * 0.24, x + w * 0.72, baseY - h * 0.24);
  triangle(x, baseY - h * 0.28, x - w * 0.44, baseY - h * 0.52, x + w * 0.44, baseY - h * 0.52);
}

function drawPines() {
  randomSeed(pineSeed);
  const groundY = H * TERRAIN;
  const count   = floor(random(4, 8));
  const half    = floor(count / 2);

  for (let i = 0; i < count; i++) {
    const h = random(H * 0.09, H * 0.17);
    let px;
    if (i < half) {
      // Left side of cabin
      px = random(cabinX - W * 0.40, cabinX - W * 0.09);
    } else {
      // Right side of cabin
      px = random(cabinX + W * 0.08, cabinX + W * 0.36);
    }
    px = constrain(px, W * 0.04, W * 0.96);
    drawPineTree(px, groundY, h);
  }
}
function drawCabin(cx, groundY) {
  const bw    = 72;  // body width
  const bh    = 40;  // body height
  const roofH = 28;  // roof height
  const chimW = 9;   // chimney width
  const chimH = 22;  // chimney height

  fill(42, 24, 54); // distinctly lighter than mountain (#100818) so cabin reads
  noStroke();

  // Body
  rect(cx - bw / 2, groundY - bh, bw, bh);

  // Roof (wider than body)
  triangle(
    cx - bw / 2 - 9, groundY - bh,
    cx + bw / 2 + 9, groundY - bh,
    cx,               groundY - bh - roofH
  );

  // Chimney
  const chimX = cx + bw / 4;
  const chimTopY = groundY - bh - roofH * 0.55;
  rect(chimX, chimTopY, chimW, chimH);

  // Smoke wisps — two static curves
  noFill();
  const sx = chimX + chimW / 2;
  const sy = chimTopY;
  stroke(196, 140, 64, 90);
  strokeWeight(1.6);
  beginShape();
  curveVertex(sx,      sy);
  curveVertex(sx,      sy - 7);
  curveVertex(sx + 6,  sy - 15);
  curveVertex(sx + 3,  sy - 24);
  curveVertex(sx - 4,  sy - 32);
  endShape();

  beginShape();
  curveVertex(sx + 1,  sy + 1);
  curveVertex(sx - 4,  sy - 7);
  curveVertex(sx - 7,  sy - 16);
  curveVertex(sx - 3,  sy - 24);
  endShape();

  noStroke();

  // Window glow — outer bloom
  fill(255, 200, 80, 40);
  rect(cx - 13, groundY - bh * 0.62, 26, 20);
  // Window glow — inner light
  fill(255, 210, 100, 220);
  rect(cx - 9, groundY - bh * 0.58, 18, 15);
}
function drawBirds() {
  randomSeed(birdSeed);
  noFill();
  stroke(10, 5, 8);

  const count   = floor(random(4, 9));
  const skyTop  = H * 0.08;
  const skyMid  = H * 0.44;

  for (let i = 0; i < count; i++) {
    const bx    = random(W * 0.08, W * 0.82);
    const by    = random(skyTop, skyMid);
    const s     = random(2.5, 7.5);
    const phase = random(TWO_PI);
    const flap  = sin(phase) * s * 0.55;
    strokeWeight(max(0.8, s * 0.18));

    beginShape();
    vertex(bx - s * 1.1, by + flap * 0.35);
    vertex(bx - s * 0.38, by - flap * 0.88);
    vertex(bx,            by + flap * 0.1);
    vertex(bx + s * 0.38, by - flap * 0.88);
    vertex(bx + s * 1.1, by + flap * 0.35);
    endShape();
  }
}
function drawVignette() {
  noStroke();
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const alpha = map(i, 0, steps, 52, 0);
    const m = i * 5.5;
    fill(5, 2, 8, alpha);
    rect(0, 0, W, m);        // top
    rect(0, H - m, W, m);    // bottom
    rect(0, 0, m, H);        // left
    rect(W - m, 0, m, H);    // right
  }

  // Deep purple-black cinematic border
  noFill();
  stroke(32, 10, 48, 220);
  strokeWeight(10);
  rect(5, 5, W - 10, H - 10);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('golden-dawn', 'png');
  }
  if (key === 'r' || key === 'R') {
    regenerateSeeds();
    redraw();
  }
}
