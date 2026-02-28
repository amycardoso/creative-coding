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

let trees = [];

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
}

function draw() {
  background(...BG_COLOR);

  // Draw ground
  noStroke();
  fill(...GROUND_COLOR);
  rect(0, H * 0.88, W, H * 0.12);

  // Update and draw trees
  for (const t of trees) {
    t.x -= SCROLL_SPEED * t.z;

    // Recycle tree when it exits left
    if (t.x < -60) {
      const recycled = createTree(t.band, W + random(20, 120));
      Object.assign(t, recycled);
    }

    drawTreeSilhouette(t);
  }
}

function drawTreeSilhouette(t) {
  noStroke();
  const alpha = map(t.z, 0.1, 1.0, 80, 220);
  fill(TRUNK_DARK[0], TRUNK_DARK[1], TRUNK_DARK[2], alpha);
  rect(t.x - t.w / 2, t.baseY - t.h, t.w, t.h);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('dawn-on-the-trail', 'png');
  }
}
