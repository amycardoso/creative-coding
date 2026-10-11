/**
 * Bus 142
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

const W = 800;
const H = 500;
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

// Cached color objects (initialized in setup)
let coldSkyTop, coldSkyBot, warmSkyTop, warmSkyBot;
let coldMountainColors, warmMountainColors;
let coldTreeColor, warmTreeColor;
let coldGroundColor, warmGroundColor;
let coldParticleColor, warmParticleColor;

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(1);
  frameRate(30);
  generateStars(50);
  generateMountains();
  generateTrees();
  initParticles(200);
  cacheColors();
}

function draw() {
  const progress = getProgress();
  drawSky(progress);
  drawMountains(progress);
  drawHorizonGlow(progress);
  drawTreeline(progress);
  drawGround(progress);
  drawBus(progress);
  drawFigure(progress);
  updateAndDrawParticles(progress);
  drawQuote(progress);
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

function cacheColors() {
  coldSkyTop = color(COLD.sky1);
  coldSkyBot = color(COLD.sky2);
  warmSkyTop = color(WARM.sky1);
  warmSkyBot = color(WARM.sky2);
  coldMountainColors = [color(COLD.mountain1), color(COLD.mountain2), color(COLD.mountain3)];
  warmMountainColors = [color(WARM.mountain1), color(WARM.mountain2), color(WARM.mountain3)];
  coldTreeColor = color(COLD.tree);
  warmTreeColor = color(WARM.tree);
  coldGroundColor = color(COLD.ground);
  warmGroundColor = color(WARM.ground);
  coldParticleColor = color(200, 220, 255, 150);
  warmParticleColor = color(255, 180, 60, 180);
}

// --- Drawing functions ---

function drawSky(progress) {
  const topColor = lerpColor(coldSkyTop, warmSkyTop, progress);
  const botColor = lerpColor(coldSkyBot, warmSkyBot, progress);

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
  noStroke();
  for (let i = 0; i < mountains.length; i++) {
    const c = lerpColor(coldMountainColors[i], warmMountainColors[i], progress);
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
  const c = lerpColor(coldTreeColor, warmTreeColor, progress);
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

function drawBus(progress) {
  const busW = 140;
  const busH = 55;
  const busX = W * 0.55;
  const busY = H * 0.60 - busH;

  const bodyColor = lerpColor(color(20, 25, 35), color(40, 35, 30), progress);
  const windowColor = lerpColor(color(30, 40, 55), color(55, 45, 35), progress);

  noStroke();

  // Bus body
  fill(bodyColor);
  rect(busX - busW / 2, busY, busW, busH, 4, 4, 0, 0);

  // Roof — slightly narrower with rounded top
  rect(busX - busW / 2 + 6, busY - 10, busW - 12, 12, 4, 4, 0, 0);

  // Windows — 4 evenly spaced
  fill(windowColor);
  const winMargin = 12;
  const winGap = 6;
  const totalWinArea = busW - winMargin * 2;
  const winW = (totalWinArea - winGap * 3) / 4;
  const winH = 16;
  const winY = busY + 10;
  for (let i = 0; i < 4; i++) {
    const wx = busX - busW / 2 + winMargin + i * (winW + winGap);
    rect(wx, winY, winW, winH, 2);
  }

  // Wheels
  fill(bodyColor);
  const wheelR = 7;
  const wheelY = busY + busH + wheelR * 0.3;
  ellipse(busX - busW / 2 + 25, wheelY, wheelR * 2, wheelR * 2);
  ellipse(busX + busW / 2 - 25, wheelY, wheelR * 2, wheelR * 2);

  // "142" text
  const textColor = lerpColor(color(50, 60, 75), color(75, 65, 50), progress);
  fill(textColor);
  textSize(11);
  textAlign(CENTER, CENTER);
  textFont('monospace');
  text('142', busX, busY + busH - 14);
}

function drawFigure(progress) {
  const busH = 55;
  const busX = W * 0.55;
  const busY = H * 0.60 - busH;
  const roofY = busY - 10;

  const figColor = lerpColor(color(20, 25, 35), color(40, 35, 30), progress);

  // Warm glow behind figure during warmth phase
  if (progress > 0.5) {
    const glowAlpha = map(progress, 0.5, 1, 0, 40);
    noStroke();
    const glowX = busX + 5;
    const glowY = roofY - 18;
    for (let i = 4; i >= 1; i--) {
      fill(220, 160, 60, glowAlpha * (1 - i * 0.2));
      ellipse(glowX, glowY, i * 18, i * 16);
    }
  }

  // Seated figure silhouette facing right
  const headX = busX + 5;
  const headY = roofY - 24;
  const headR = 8;

  noStroke();
  fill(figColor);

  // Head
  ellipse(headX, headY, headR * 2, headR * 2);

  // Torso — leaning slightly forward (right)
  push();
  stroke(figColor);
  strokeWeight(5);
  strokeCap(ROUND);
  // Torso line from neck down, angled forward
  line(headX, headY + headR, headX + 3, roofY - 3);
  // Upper legs — bent, going forward then down
  line(headX + 3, roofY - 3, headX + 12, roofY - 5);
  // Lower legs — hanging down
  line(headX + 12, roofY - 5, headX + 14, roofY);
  pop();
}

function drawGround(progress) {
  const c = lerpColor(coldGroundColor, warmGroundColor, progress);
  noStroke();
  fill(c);
  rect(0, H * 0.60, W, H * 0.40);
}

function initParticles(count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: random(W),
      y: random(H),
      size: random(1.5, 4),
      speedY: random(0.3, 1.2),
      drift: random(-0.3, 0.3),
      phase: random(TWO_PI),
    });
  }
}

function updateAndDrawParticles(progress) {
  const direction = lerp(1, -1, progress);
  const c = lerpColor(coldParticleColor, warmParticleColor, progress);
  const sizeScale = lerp(1, 1.5, progress);

  noStroke();
  for (const p of particles) {
    p.y += p.speedY * direction;
    p.x += p.drift + sin(frameCount * 0.02 + p.phase) * 0.3;

    // Wrap around screen edges
    if (p.y < 0) p.y = H;
    if (p.y > H) p.y = 0;
    if (p.x < 0) p.x = W;
    if (p.x > W) p.x = 0;

    fill(c);
    ellipse(p.x, p.y, p.size * sizeScale, p.size * sizeScale);
  }
}

function drawQuote(progress) {
  if (progress <= 0.7) return;
  const alpha = map(progress, 0.7, 0.9, 0, 220, true);
  fill(255, 255, 245, alpha);
  noStroke();
  textFont('monospace');
  textSize(17);
  textAlign(CENTER, CENTER);
  text('HAPPINESS IS ONLY REAL WHEN SHARED', W / 2, H * 0.20);
}

function drawHorizonGlow(progress) {
  if (progress < 0.2) return;
  const alpha = map(progress, 0.2, 1, 0, 30);
  noStroke();
  const horizonY = H * 0.60;
  for (let i = 5; i >= 1; i--) {
    fill(230, 160, 50, alpha * (1 - i * 0.15));
    ellipse(W / 2, horizonY, W * (0.5 + i * 0.15), i * 60);
  }
}

function getProgress() {
  const t = (millis() / 1000 % CYCLE_DURATION) / CYCLE_DURATION;
  let p;
  if (t < 0.30) p = 0;                              // frozen hold
  else if (t < 0.55) p = map(t, 0.30, 0.55, 0, 1);  // thaw
  else if (t < 0.70) p = 1;                          // warmth hold
  else p = map(t, 0.70, 1.0, 1, 0);                  // fade back
  // smoothstep easing
  return p * p * (3 - 2 * p);
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('thaw', 'png');
}
