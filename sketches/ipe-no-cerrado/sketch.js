/**
 * Ipê no Cerrado
 *
 * Golden hour in the cerrado — a twisted ipê-amarelo in full
 * bloom sheds glowing yellow blossoms over termite mounds,
 * against a pink-to-lilac sky.
 *
 * Controls:
 * - Press S to save a PNG snapshot
 * - Press R to regenerate
 */

const W = 800;
const H = 800;

const HORIZON = 0.74;

let skyNoise, terrainSeed, treeSeed, treeXf, blossoms, moundsSpec;

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  noLoop();
  regenerateSeeds();
}

function regenerateSeeds() {
  skyNoise = floor(random(10000));
  terrainSeed = floor(random(10000));
  treeSeed = floor(random(10000));
  treeXf = random() < 0.5 ? random(0.30, 0.42) : random(0.58, 0.70);

  moundsSpec = [];
  const count = floor(random(3, 6));
  for (let i = 0; i < count; i++) {
    moundsSpec.push({
      xf: (i + random(0.2, 0.8)) / count,
      w: random(34, 70),
      h: random(18, 42),
    });
  }
}

function draw() {
  blossoms = []; // crown tips collected while drawing the tree
  drawSky();
  drawHorizonGlow();
  drawGround();
  drawMounds();
  drawTree();
  drawBlossoms();
  drawFallingPetals();
  drawBirds();
  drawVignette();
}

// ─── Sky ─────────────────────────────────────────────────────────────────────

function skyColor(p) {
  let r, g, b;
  if (p < 0.26) {
    // Deep lilac crown
    const s = p / 0.26;
    r = lerp(62, 108, s); g = lerp(38, 62, s); b = lerp(110, 148, s);
  } else if (p < 0.55) {
    const s = (p - 0.26) / 0.29;
    r = lerp(108, 196, s); g = lerp(62, 104, s); b = lerp(148, 150, s);
  } else if (p < 0.82) {
    const s = (p - 0.55) / 0.27;
    r = lerp(196, 244, s); g = lerp(104, 156, s); b = lerp(150, 128, s);
  } else {
    // Warm rose-gold breath at the horizon
    const s = (p - 0.82) / 0.18;
    r = lerp(244, 252, s); g = lerp(156, 196, s); b = lerp(128, 122, s);
  }
  return [r, g, b];
}

function drawSky() {
  const hy = floor(H * HORIZON);
  noStroke();

  for (let y = 0; y < hy; y++) {
    const p = y / hy;
    const [r, g, b] = skyColor(p);

    // Horizontal atmosphere banding — thin dusk haze
    const n = noise(skyNoise + 0.5, y * 0.006) * 12 - 6;
    const n2 = noise(skyNoise + 1.5, y * 0.018) * 5 - 2.5;

    fill(
      constrain(r + n * 0.5 + n2, 0, 255),
      constrain(g + n * 0.2, 0, 255),
      constrain(b + n2 * 0.5, 0, 255)
    );
    rect(0, y, W, 1);
  }
}

// ─── Horizon Glow ────────────────────────────────────────────────────────────

function drawHorizonGlow() {
  const hy = H * HORIZON;
  noStroke();

  for (let y = hy - 20; y < hy + 10; y++) {
    const d = abs(y - (hy - 5)) / 22;
    const alpha = (1 - d * d) * 130;
    fill(255, 214, 140, alpha);
    rect(0, y, W, 1);
  }
}

// ─── Ground ──────────────────────────────────────────────────────────────────

function drawGround() {
  const gt = H * HORIZON;

  // Dusky mauve earth fading down to dark
  noStroke();
  for (let y = gt; y <= H; y++) {
    const p = (y - gt) / (H - gt);
    fill(lerp(74, 16, p), lerp(34, 8, p), lerp(44, 14, p));
    rect(0, y, W, 1);
  }

  // Rolling cerrado contour (varies per render via terrainSeed)
  fill(38, 15, 24);
  beginShape();
  vertex(0, H);
  vertex(0, H * 0.85);
  const pts = [0.08, 0.20, 0.35, 0.50, 0.65, 0.78, 0.90];
  for (let i = 0; i < pts.length; i++) {
    const xf = pts[i];
    const jitter = noise(terrainSeed + 40 + i * 0.5) * 0.05 - 0.025;
    vertex(W * xf, H * (0.82 + jitter));
  }
  vertex(W, H * 0.845);
  vertex(W, H);
  endShape(CLOSE);

  // Sparse dry-grass tufts
  stroke(30, 12, 19);
  randomSeed(terrainSeed);
  for (let i = 0; i < 60; i++) {
    const tx = random(W);
    const ty = random(H * 0.80, H * 0.97);
    const th = random(4, 12);
    strokeWeight(random(0.7, 1.3));
    for (let j = -2; j <= 2; j++) {
      line(tx, ty, tx + j * th * 0.3, ty - th + abs(j) * 1.5);
    }
  }
  randomSeed();
  noStroke();
}

// ─── Termite Mounds ──────────────────────────────────────────────────────────

function drawMounds() {
  noStroke();
  fill(52, 22, 32);

  for (const m of moundsSpec) {
    const mx = W * lerp(0.05, 0.95, m.xf);
    // Keep clear of the tree trunk
    if (abs(lerp(0.05, 0.95, m.xf) - treeXf) < 0.12) continue;
    const baseY = H * (0.83 + noise(terrainSeed + mx) * 0.06);

    // Lumpy cone — a mound is a stack of shrinking, wobbling ellipses
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const w = m.w * (1 - t * 0.72) * (1 + noise(terrainSeed + mx + i) * 0.2);
      const y = baseY - m.h * t;
      ellipse(mx + noise(terrainSeed + mx * 2 + i * 9) * 6 - 3, y, w, m.h * 0.5);
    }
  }
}

// ─── Ipê Tree ────────────────────────────────────────────────────────────────

function branch(x, y, angle, len, wgt, depth) {
  const x2 = x + cos(angle) * len;
  const y2 = y + sin(angle) * len;

  strokeWeight(wgt);
  line(x, y, x2, y2);

  if (depth <= 0 || len < 9) {
    blossoms.push({ x: x2, y: y2, s: random(0.7, 1.3) });
    return;
  }

  // Inner joints deep in the crown carry blossoms too — no bare gaps
  if (depth <= 3) {
    blossoms.push({ x: x2, y: y2, s: random(0.5, 0.9) });
  }

  // Ipês grow tortuous — every fork kinks hard, but the crown reaches up
  const nKids = random() < 0.75 ? 2 : 3;
  for (let i = 0; i < nKids; i++) {
    const spread = random(0.35, 0.8) * (i === 0 ? -1 : i === 1 ? 1 : random([-1, 1]));
    const kink = random(-0.15, 0.15);
    // Never let a limb dive below horizontal
    const childAngle = constrain(angle + spread + kink, -PI * 0.94, -PI * 0.06);
    branch(
      x2, y2,
      childAngle,
      len * random(0.62, 0.8),
      max(wgt * 0.62, 1.2),
      depth - 1
    );
  }
}

function drawTree() {
  const tx = W * treeXf;
  const groundY = H * 0.855;

  stroke(24, 9, 15);
  strokeCap(ROUND);
  randomSeed(treeSeed);

  // Trunk leans and kinks once before the crown forks
  const lean = random(-0.14, 0.14);
  const trunkH = random(140, 170);
  const kinkX = tx + sin(lean) * trunkH * 0.55 + random(-8, 8);
  const kinkY = groundY - trunkH * 0.55;

  strokeWeight(15);
  line(tx, groundY, kinkX, kinkY);
  branch(kinkX, kinkY, -HALF_PI + lean, trunkH * 0.5, 12, 6);

  randomSeed();
  strokeCap(SQUARE);
  noStroke();

  // Root flare
  fill(24, 9, 15);
  triangle(tx - 14, groundY + 2, tx + 14, groundY + 2, tx, groundY - 26);
}

// ─── Blossoms ────────────────────────────────────────────────────────────────

function drawBlossoms() {
  noStroke();
  randomSeed(treeSeed + 7);

  // Soft golden aura behind the whole crown
  for (const b of blossoms) {
    fill(255, 190, 60, 14);
    circle(b.x, b.y, 46 * b.s);
  }

  // Blossom clusters — clumps of overlapping puffs at every branch tip
  for (const b of blossoms) {
    const puffs = floor(random(5, 9));
    for (let i = 0; i < puffs; i++) {
      const a = random(TWO_PI);
      const d = random(2, 11) * b.s;
      const px = b.x + cos(a) * d;
      const py = b.y + sin(a) * d * 0.85;
      const sz = random(5, 11) * b.s;

      fill(248, 176, 28, 220);
      circle(px, py, sz);
      // Sunlit highlight on the upper side of each puff
      fill(255, 216, 84, 190);
      circle(px - sz * 0.12, py - sz * 0.18, sz * 0.6);
    }
  }
  randomSeed();
}

// ─── Falling Petals ──────────────────────────────────────────────────────────

function drawFallingPetals() {
  noStroke();
  randomSeed(treeSeed + 13);

  // Crown bounding box guides where petals drift
  let cx = 0, cy = 0;
  for (const b of blossoms) { cx += b.x; cy += b.y; }
  cx /= blossoms.length; cy /= blossoms.length;
  const groundY = H * 0.86;

  const count = floor(random(26, 40));
  for (let i = 0; i < count; i++) {
    const t = random();
    const px = cx + random(-1, 1) * (60 + t * 130);
    const py = lerp(cy + 40, groundY + random(-4, 18), pow(t, 0.8));
    const sz = random(2.5, 5.5);
    const rot = random(TWO_PI);

    fill(246, 178, 40, random(150, 230));
    push();
    translate(px, py);
    rotate(rot);
    ellipse(0, 0, sz * 1.7, sz * 0.8);
    pop();
  }

  // A drift of settled petals pooled beneath the crown
  for (let i = 0; i < 46; i++) {
    const px = cx + randomGaussian(0, 70);
    const py = groundY + random(-3, 26);
    fill(232, 160, 36, random(90, 190));
    ellipse(px, py, random(3, 6), random(1.5, 2.8));
  }
  randomSeed();
}

// ─── Birds ───────────────────────────────────────────────────────────────────

function drawBirds() {
  noFill();
  stroke(50, 22, 42);

  const count = floor(random(3, 7));
  const skyTop = H * 0.08;
  const skyMid = H * 0.38;

  for (let i = 0; i < count; i++) {
    const bx = random(W * 0.10, W * 0.85);
    const by = random(skyTop, skyMid);
    const s = random(2.5, 7);
    const phase = random(TWO_PI);

    // Keep a minimum wing bend so no bird flattens into a dash
    const flap = (0.4 + abs(sin(phase)) * 0.6) * random([-1, 1]) * s * 0.55;
    strokeWeight(max(0.8, s * 0.18));

    beginShape();
    vertex(bx - s * 1.1, by + flap * 0.35);
    vertex(bx - s * 0.38, by - flap * 0.88);
    vertex(bx, by + flap * 0.1);
    vertex(bx + s * 0.38, by - flap * 0.88);
    vertex(bx + s * 1.1, by + flap * 0.35);
    endShape();
  }
}

// ─── Vignette + Border ───────────────────────────────────────────────────────

function drawVignette() {
  noStroke();
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const alpha = map(i, 0, steps, 52, 0);
    const m = i * 5.5;
    fill(10, 4, 9, alpha);
    rect(0, 0, W, m);           // top
    rect(0, H - m, W, m);       // bottom
    rect(0, 0, m, H);           // left
    rect(W - m, 0, m, H);       // right
  }

  // Deep plum frame (cinematic border, matching the family)
  noFill();
  stroke(44, 14, 34, 220);
  strokeWeight(10);
  rect(5, 5, W - 10, H - 10);
}

// ─── Controls ────────────────────────────────────────────────────────────────

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('ipe-no-cerrado', 'png');
  }
  if (key === 'r' || key === 'R') {
    regenerateSeeds(); // new sky, tree, mounds, petals, birds
    redraw();
  }
}
