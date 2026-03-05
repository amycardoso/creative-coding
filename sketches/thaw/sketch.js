/**
 * Thaw
 *
 * Inspired by Into the Wild. A lone figure sits atop Bus 142
 * in a frozen wilderness. The world slowly transforms from
 * cold isolation to warmth — the figure never moves.
 *
 * "Happiness is only real when shared."
 *
 * Controls:
 * - S: Save PNG
 */

const W = 1080;
const H = 720;
const CYCLE_DURATION = 15; // seconds

// Cold palette
const COLD = {
  sky1: '#0a1628',
  sky2: '#1a2a44',
  mountain1: '#0d1f3a',
  mountain2: '#142844',
  mountain3: '#1a3050',
  tree: '#142840',
  ground: '#1a2a44',
  accent: '#8fa8c8',
};

// Warm palette
const WARM = {
  sky1: '#d4913a',
  sky2: '#c75c3a',
  mountain1: '#5a3a2a',
  mountain2: '#6a4a30',
  mountain3: '#7a5a38',
  tree: '#6a4a30',
  ground: '#8a6a40',
  accent: '#e8c468',
};

let particles = [];
let mountains = [];
let trees = [];
let stars = [];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(1);
  frameRate(30);
  generateStars(50);
  generateMountains();
  generateTrees();
}

function draw() {
  const progress = getProgress();
  drawSky(progress);
  drawMountains(progress);
  drawTreeline(progress);
  drawGround(progress);
}

// --- Generation functions ---

function generateStars(count) {
  stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: random(W),
      y: random(H * 0.6),
      size: random(1, 3),
      twinkleSpeed: random(0.02, 0.06),
      twinklePhase: random(TWO_PI),
    });
  }
}

function generateMountains() {
  mountains = [];
  const configs = [
    { baseline: 0.32, amplitude: 120, noiseScale: 0.005, noiseOffset: 0 },
    { baseline: 0.40, amplitude: 90, noiseScale: 0.007, noiseOffset: 100 },
    { baseline: 0.48, amplitude: 60, noiseScale: 0.009, noiseOffset: 200 },
  ];
  for (const cfg of configs) {
    const yValues = [];
    for (let x = 0; x <= W; x += 4) {
      const n = noise(x * cfg.noiseScale + cfg.noiseOffset);
      const y = cfg.baseline * H - n * cfg.amplitude;
      yValues.push({ x, y });
    }
    mountains.push(yValues);
  }
}

function generateTrees() {
  trees = [];
  const baselineY = H * 0.60;
  let x = 10;
  while (x < W) {
    const undulation = noise(x * 0.01 + 500) * 20 - 10;
    const h = random(30, 70);
    const w = random(12, 25);
    trees.push({
      x,
      y: baselineY + undulation,
      h,
      w,
    });
    x += w + random(15, 30);
  }
}

// --- Drawing functions ---

function drawSky(progress) {
  const coldTop = color(COLD.sky1);
  const coldBot = color(COLD.sky2);
  const warmTop = color(WARM.sky1);
  const warmBot = color(WARM.sky2);

  const topColor = lerpColor(coldTop, warmTop, progress);
  const botColor = lerpColor(coldBot, warmBot, progress);

  noStroke();
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const c = lerpColor(topColor, botColor, t);
    stroke(c);
    line(0, y, W, y);
  }
  noStroke();

  // Stars — fade out as progress increases
  const starAlpha = map(progress, 0, 1, 255, 0);
  if (starAlpha > 2) {
    noStroke();
    for (const s of stars) {
      const twinkle = sin(frameCount * s.twinkleSpeed + s.twinklePhase);
      const a = starAlpha * map(twinkle, -1, 1, 0.3, 1.0);
      fill(255, 255, 255, a);
      ellipse(s.x, s.y, s.size, s.size);
    }
  }
}

function drawMountains(progress) {
  const coldColors = [color(COLD.mountain1), color(COLD.mountain2), color(COLD.mountain3)];
  const warmColors = [color(WARM.mountain1), color(WARM.mountain2), color(WARM.mountain3)];

  noStroke();
  for (let i = 0; i < mountains.length; i++) {
    const c = lerpColor(coldColors[i], warmColors[i], progress);
    fill(c);
    beginShape();
    vertex(0, H);
    for (const pt of mountains[i]) {
      vertex(pt.x, pt.y);
    }
    vertex(W, H);
    endShape(CLOSE);
  }
}

function drawTreeline(progress) {
  const c = lerpColor(color(COLD.tree), color(WARM.tree), progress);
  noStroke();
  fill(c);

  for (const t of trees) {
    // Draw 2 stacked triangles for a fuller pine shape
    const layers = 2;
    for (let i = 0; i < layers; i++) {
      const layerH = t.h * 0.6;
      const topY = t.y - t.h + i * (t.h * 0.3);
      const botY = topY + layerH;
      const layerW = t.w * (0.6 + i * 0.25);
      triangle(t.x, topY, t.x - layerW / 2, botY, t.x + layerW / 2, botY);
    }
  }
}

function drawGround(progress) {
  const c = lerpColor(color(COLD.ground), color(WARM.ground), progress);
  noStroke();
  fill(c);
  rect(0, H * 0.60, W, H * 0.40);
}

function getProgress() {
  const t = (millis() / 1000 % CYCLE_DURATION) / CYCLE_DURATION;
  if (t < 0.33) return 0;
  if (t < 0.66) return map(t, 0.33, 0.66, 0, 1);
  return map(t, 0.66, 1.0, 1, 0);
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('thaw', 'png');
}
