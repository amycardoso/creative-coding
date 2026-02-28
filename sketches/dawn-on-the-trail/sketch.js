/**
 * Dawn on the Trail
 *
 * A seringueiro's pre-dawn walk through the Amazon forest —
 * a headlamp reveals tapping scars and latex cups on rubber trees
 * as you journey along the estrada before sunrise.
 *
 * Part of the Acre Series — art about the seringueiro resistance.
 *
 * Controls:
 * - S: Save PNG
 * - Shift+S: Start/stop GIF recording
 */

const W = 800;
const H = 600;

// --- Colors ---
const BG_COLOR = [10, 15, 26];
const TRUNK_DARK = [26, 26, 20];
const TRUNK_LIT = [74, 63, 53];
const SCAR_COLOR = [212, 200, 168];
const LAMP_COLOR = [232, 168, 76];
const LATEX_COLOR = [240, 236, 228];
const GROUND_COLOR = [26, 21, 16];

// --- Depth bands ---
const BANDS = [
  { minZ: 0.15, maxZ: 0.35, count: 25 }, // far
  { minZ: 0.45, maxZ: 0.65, count: 20 }, // mid
  { minZ: 0.75, maxZ: 1.0, count: 15 },  // near
];

const SCROLL_SPEED = 0.6;

// --- Headlamp ---
const LAMP_ORIGIN_Y = H * 0.92;
const LAMP_CONE_ANGLE = PI / 3; // 60 degrees
const LAMP_REACH = H * 0.95;
const LAMP_SWAY_SPEED = 0.008;
const LAMP_SWAY_AMOUNT = 0.05; // radians (~3 degrees)

let trees = [];

// --- Fireflies ---
const FIREFLY_COUNT = 20;
let fireflies = [];

function initFireflies() {
  fireflies = [];
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    fireflies.push({
      x: random(W),
      y: random(H * 0.2, H * 0.8),
      vx: random(-0.2, 0.2),
      vy: random(-0.15, 0.15),
      phase: random(TWO_PI),
      size: random(1.5, 3),
    });
  }
}

function createTree(band, x) {
  const z = random(band.minZ, band.maxZ);
  const trunkW = map(z, 0.1, 1.0, 3, 28);
  const trunkH = map(z, 0.1, 1.0, 120, 450);
  const baseY = map(z, 0.1, 1.0, H * 0.55, H * 0.85);
  return {
    x: x !== undefined ? x : random(-50, W + 50),
    z,
    w: trunkW,
    h: trunkH,
    baseY,
    hasCuts: z > 0.4 && random() > 0.35,
    cutSide: random() > 0.5 ? 1 : -1,
    scarCount: floor(random(3, 6)),
    hasCup: random() > 0.4,
    band,
  };
}

function initTrees() {
  trees = [];
  for (const band of BANDS) {
    for (let i = 0; i < band.count; i++) {
      trees.push(createTree(band));
    }
  }
  trees.sort((a, b) => a.z - b.z);
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  frameRate(30);
  initTrees();
  initFireflies();
}

function draw() {
  background(...BG_COLOR);

  // Ground
  noStroke();
  fill(...GROUND_COLOR);
  rect(0, H * 0.88, W, H * 0.12);

  drawTrailPath();

  for (const t of trees) {
    t.x -= SCROLL_SPEED * t.z;

    if (t.x < -60) {
      const recycled = createTree(t.band, W + random(20, 120));
      Object.assign(t, recycled);
    }

    const lightAmount = isInLightCone(t.x, t.baseY - t.h / 2);
    drawTree(t, lightAmount);
  }

  updateFireflies();

  drawLightGlow();
}

function getLampAngle() {
  return -HALF_PI + sin(frameCount * LAMP_SWAY_SPEED) * LAMP_SWAY_AMOUNT;
}

function isInLightCone(px, py) {
  const dx = px - W / 2;
  const dy = py - LAMP_ORIGIN_Y;
  const dist = sqrt(dx * dx + dy * dy);
  if (dist > LAMP_REACH || dist < 1) return 0;

  const angle = atan2(dy, dx);
  const lampDir = getLampAngle();
  let angleDiff = abs(angle - lampDir);
  if (angleDiff > PI) angleDiff = TWO_PI - angleDiff;

  if (angleDiff > LAMP_CONE_ANGLE / 2) return 0;

  const angleFalloff = map(angleDiff, 0, LAMP_CONE_ANGLE / 2, 1, 0);
  const distFalloff = map(dist, 0, LAMP_REACH, 1, 0);
  return angleFalloff * distFalloff;
}

function drawTree(t, lightAmount) {
  noStroke();
  const darkAlpha = map(t.z, 0.1, 1.0, 80, 220);

  if (lightAmount > 0.05) {
    // Lit trunk
    const r = lerp(TRUNK_DARK[0], TRUNK_LIT[0], lightAmount);
    const g = lerp(TRUNK_DARK[1], TRUNK_LIT[1], lightAmount);
    const b = lerp(TRUNK_DARK[2], TRUNK_LIT[2], lightAmount);
    fill(r, g, b, darkAlpha);
  } else {
    fill(TRUNK_DARK[0], TRUNK_DARK[1], TRUNK_DARK[2], darkAlpha);
  }

  rect(t.x - t.w / 2, t.baseY - t.h, t.w, t.h);

  // Only draw detail on lit trees in near/mid bands
  if (lightAmount > 0.15 && t.hasCuts && t.z > 0.4) {
    drawScars(t, lightAmount);
    if (t.hasCup) {
      drawCup(t, lightAmount);
    }
  }
}

function drawScars(t, lightAmount) {
  const scarAlpha = lightAmount * 200;
  stroke(SCAR_COLOR[0], SCAR_COLOR[1], SCAR_COLOR[2], scarAlpha);
  strokeWeight(max(1, t.w * 0.06));

  const scarLen = t.w * 0.7;
  const spacing = t.w * 0.18;
  const startY = t.baseY - t.h * 0.55;
  const angle = radians(30) * t.cutSide;

  for (let i = 0; i < t.scarCount; i++) {
    const sy = startY + i * spacing;
    const sx = t.x - scarLen / 2 * t.cutSide;
    line(sx, sy, sx + cos(angle) * scarLen, sy + sin(angle) * scarLen);
  }
}

function drawCup(t, lightAmount) {
  const cupAlpha = lightAmount * 180;
  const cupY = t.baseY - t.h * 0.35;
  const cupX = t.x + t.w * 0.4 * t.cutSide;
  const cupSize = t.w * 0.35;

  noStroke();
  fill(SCAR_COLOR[0], SCAR_COLOR[1], SCAR_COLOR[2], cupAlpha);
  arc(cupX, cupY, cupSize, cupSize, 0, PI);

  // Occasional latex drop
  if (random() < 0.01) {
    fill(LATEX_COLOR[0], LATEX_COLOR[1], LATEX_COLOR[2], cupAlpha);
    ellipse(cupX, cupY - cupSize * 0.5 - random(2, 8), 2, 2);
  }
}

function updateFireflies() {
  for (const f of fireflies) {
    f.x += f.vx;
    f.y += f.vy;
    f.phase += 0.03;

    // Wrap around
    if (f.x < -10) f.x = W + 10;
    if (f.x > W + 10) f.x = -10;
    if (f.y < H * 0.1) f.vy = abs(f.vy);
    if (f.y > H * 0.85) f.vy = -abs(f.vy);

    const brightness = map(sin(f.phase), -1, 1, 0, 1);
    const alpha = brightness * 120;
    noStroke();
    fill(180, 210, 130, alpha);
    ellipse(f.x, f.y, f.size * brightness, f.size * brightness);
  }
}

function drawTrailPath() {
  // Subtle lighter strip at ground level suggesting the worn trail
  noStroke();
  fill(GROUND_COLOR[0] + 8, GROUND_COLOR[1] + 6, GROUND_COLOR[2] + 4, 60);

  beginShape();
  const trailY = H * 0.89;
  const trailWidth = 60;
  for (let x = 0; x <= W; x += 20) {
    const wobble = sin(x * 0.01 + frameCount * 0.005) * 8;
    vertex(x, trailY + wobble - trailWidth / 2);
  }
  for (let x = W; x >= 0; x -= 20) {
    const wobble = sin(x * 0.01 + frameCount * 0.005) * 8;
    vertex(x, trailY + wobble + trailWidth / 2);
  }
  endShape(CLOSE);
}

function drawLightGlow() {
  // Soft radial glow at lamp origin
  noStroke();
  const lampDir = getLampAngle();
  for (let r = LAMP_REACH; r > 10; r -= 8) {
    const alpha = map(r, 10, LAMP_REACH, 12, 1);
    fill(LAMP_COLOR[0], LAMP_COLOR[1], LAMP_COLOR[2], alpha);
    const cx = W / 2 + cos(lampDir) * r * 0.3;
    const cy = LAMP_ORIGIN_Y + sin(lampDir) * r * 0.3;
    ellipse(cx, cy, r * 0.8, r * 1.2);
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('dawn-on-the-trail', 'png');
  }
}
