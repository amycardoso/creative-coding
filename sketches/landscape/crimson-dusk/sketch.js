/**
 * Crimson Dusk
 *
 * Warm crimson skies dissolve into purple ocean —
 * silhouettes at the edge of day and night.
 *
 * Controls:
 * - Press S to save a PNG snapshot
 */

const W = 800;
const H = 800;

const HORIZON = 0.565;
const OCEAN_BOTTOM = 0.82;

let skyNoise, waveNoise, terrainSeed;

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  noLoop();
  regenerateSeeds();
}

function regenerateSeeds() {
  skyNoise = floor(random(10000));
  waveNoise = floor(random(10000));
  terrainSeed = floor(random(10000));
}

function draw() {
  drawSky();
  drawHorizonGlow();
  drawOcean();
  drawBoat();
  drawForeground();
  drawLifeguardTower(W * 0.61, H * 0.87);
  drawBirds();
  drawVignette();
}

// ─── Sky ─────────────────────────────────────────────────────────────────────

function skyColor(p) {
  let r, g, b;
  if (p < 0.18) {
    // Deeper purple-crimson crown
    const s = p / 0.18;
    r = lerp(48, 148, s); g = lerp(5, 14, s); b = lerp(58, 28, s);
  } else if (p < 0.44) {
    const s = (p - 0.18) / 0.26;
    r = lerp(148, 210, s); g = lerp(14, 54, s); b = lerp(28, 16, s);
  } else if (p < 0.72) {
    const s = (p - 0.44) / 0.28;
    r = lerp(210, 232, s); g = lerp(54, 100, s); b = lerp(16, 30, s);
  } else {
    const s = (p - 0.72) / 0.28;
    r = lerp(232, 215, s); g = lerp(100, 82, s); b = lerp(30, 76, s);
  }
  return [r, g, b];
}

function drawSky() {
  const hy = floor(H * HORIZON);
  noStroke();

  for (let y = 0; y < hy; y++) {
    const p = y / hy;
    const [r, g, b] = skyColor(p);

    // Horizontal atmosphere banding — subtle cloud-like texture
    const n = noise(skyNoise + 0.5, y * 0.006) * 14 - 7;
    const n2 = noise(skyNoise + 1.5, y * 0.018) * 5 - 2.5;

    fill(
      constrain(r + n * 0.45 + n2, 0, 255),
      constrain(g + n * 0.1, 0, 255),
      constrain(b + n2 * 0.3, 0, 255)
    );
    rect(0, y, W, 1);
  }
}

// ─── Horizon Glow ─────────────────────────────────────────────────────────

function drawHorizonGlow() {
  const hy = H * HORIZON;
  noStroke();

  for (let y = hy - 18; y < hy + 12; y++) {
    const d = abs(y - (hy - 4)) / 20;
    const alpha = (1 - d * d) * 160;
    fill(242, 132, 82, alpha);
    rect(0, y, W, 1);
  }
}

// ─── Ocean ────────────────────────────────────────────────────────────────

function drawOcean() {
  const ot = H * HORIZON;
  const ob = H * OCEAN_BOTTOM;

  // Base gradient — deeper indigo-navy blue
  noStroke();
  for (let y = ot; y <= ob; y++) {
    const p = (y - ot) / (ob - ot);
    fill(lerp(48, 14, p), lerp(35, 22, p), lerp(148, 100, p));
    rect(0, y, W, 1);
  }

  // Reflection shimmer lines
  noFill();
  const nLines = 38;
  for (let i = 0; i < nLines; i++) {
    const relP = i / nLines;
    const lineY = ot + relP * (ob - ot);
    const lw = W * lerp(0.80, 0.10, relP);
    const x0 = (W - lw) / 2;
    const alpha = lerp(55, 3, pow(relP, 0.55));

    const r = lerp(228, 92, relP);
    const g = lerp(110, 48, relP);
    const b = lerp(86, 76, relP);

    stroke(r, g, b, alpha);
    strokeWeight(1);

    beginShape();
    for (let x = x0; x <= x0 + lw; x += 4) {
      const phase = i * 0.6 + waveNoise * 0.001;
      const wy = lineY
        + sin(x * 0.023 + phase) * 1.4
        + sin(x * 0.011 + phase * 0.6) * 0.8;
      vertex(x, wy);
    }
    endShape();
  }
}

// ─── Boat ────────────────────────────────────────────────────────────────

function drawBoat() {
  // Position and size vary per render
  const bx = random(W * 0.18, W * 0.50);
  const waterY = H * HORIZON + random(28, 58); // depth in ocean = perceived distance
  const sc = random(0.55, 0.95);

  const hw = 52 * sc;  // hull half-width
  const hd = 11 * sc;  // hull depth below waterline
  const mh = 90 * sc;  // mast height

  fill(12, 4, 7);
  noStroke();

  // Hull — flat deck, tapered bow and stern below waterline
  beginShape();
  vertex(bx - hw, waterY);
  vertex(bx - hw * 0.88, waterY + hd);
  vertex(bx + hw * 0.88, waterY + hd);
  vertex(bx + hw, waterY);
  endShape(CLOSE);

  // Mast
  stroke(12, 4, 7);
  strokeWeight(max(1.2, 1.8 * sc));
  line(bx - hw * 0.05, waterY, bx - hw * 0.05, waterY - mh);

  noStroke();
  fill(12, 4, 7);

  // Main sail — large triangle from masthead to boom
  triangle(
    bx - hw * 0.05, waterY - mh,
    bx - hw * 0.05, waterY,
    bx + hw * 0.88, waterY - mh * 0.12
  );

  // Jib — smaller triangle on the bow side
  triangle(
    bx - hw * 0.05, waterY - mh * 0.72,
    bx - hw * 0.05, waterY,
    bx - hw * 0.82, waterY - hd * 0.5
  );

  // Subtle waterline reflection (inverted mast, fading fast)
  stroke(12, 4, 7, 30);
  strokeWeight(max(0.8, 1.2 * sc));
  line(bx - hw * 0.05, waterY + hd, bx - hw * 0.05, waterY + mh * 0.18);
  noStroke();
}

// ─── Foreground ──────────────────────────────────────────────────────────

function drawForeground() {
  const ft = H * OCEAN_BOTTOM;

  // Dark gradient base
  noStroke();
  for (let y = ft; y <= H; y++) {
    const p = (y - ft) / (H - ft);
    fill(lerp(35, 6, p), lerp(8, 3, p), lerp(11, 5, p));
    rect(0, y, W, 1);
  }

  // Organic terrain silhouette (varies per render via terrainSeed)
  fill(18, 5, 8);
  noStroke();
  beginShape();
  vertex(0, H);
  vertex(0, H * 0.92);
  const pts = [0.08, 0.20, 0.35, 0.50, 0.65, 0.78, 0.90];
  for (let i = 0; i < pts.length; i++) {
    const xf = pts[i];
    const yBase = lerp(0.845, 0.840, xf);
    const jitter = noise(terrainSeed + i * 0.5) * 0.028 - 0.014;
    vertex(W * xf, H * (yBase + jitter));
  }
  vertex(W, H * 0.870);
  vertex(W, H);
  endShape(CLOSE);
}

// ─── Lifeguard Tower ──────────────────────────────────────────────────────

function drawLifeguardTower(cx, groundY) {
  const tw = 52;
  const cabinH = 70;
  const legH = 205;          // tall enough to poke cabin above horizon
  const platformY = groundY - legH;

  // Legs
  stroke(13, 5, 8);
  strokeWeight(4);
  noFill();
  line(cx - tw / 2 - 1, platformY, cx - tw / 2 - 6, groundY);
  line(cx + tw / 2 + 1, platformY, cx + tw / 2 + 6, groundY);
  line(cx - tw / 2 + 8, platformY, cx - tw / 2 + 3, groundY);
  line(cx + tw / 2 - 8, platformY, cx + tw / 2 - 3, groundY);

  // Cross braces
  strokeWeight(2);
  line(cx - tw / 2 + 4, platformY + legH * 0.22, cx + tw / 2 - 4, platformY + legH * 0.68);
  line(cx + tw / 2 - 4, platformY + legH * 0.22, cx - tw / 2 + 4, platformY + legH * 0.68);

  noStroke();
  fill(13, 5, 8);

  // Platform deck
  rect(cx - tw / 2 - 6, platformY - 5, tw + 12, 5);

  // Cabin
  rect(cx - tw / 2, platformY - cabinH, tw, cabinH);

  // Roof
  triangle(
    cx - tw / 2 - 8, platformY - cabinH,
    cx + tw / 2 + 8, platformY - cabinH,
    cx, platformY - cabinH - 24
  );

  // Railing
  stroke(13, 5, 8);
  strokeWeight(1.5);
  const railTop = platformY - 15;
  line(cx - tw / 2 - 6, railTop, cx + tw / 2 + 6, railTop);
  for (let x = cx - tw / 2 - 6; x <= cx + tw / 2 + 6; x += 7) {
    line(x, railTop, x, platformY - 5);
  }

  noStroke();
}

// ─── Birds ────────────────────────────────────────────────────────────────

function drawBirds() {
  noFill();
  stroke(10, 5, 8);

  // Number and position vary per render
  const count = floor(random(4, 8));
  const skyTop = H * 0.10;
  const skyMid = H * 0.42;

  for (let i = 0; i < count; i++) {
    const bx = random(W * 0.10, W * 0.80);
    const by = random(skyTop, skyMid);
    const s = random(2.5, 7.5);
    const phase = random(TWO_PI);

    const flap = sin(phase) * s * 0.55;
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

// ─── Vignette + Border ────────────────────────────────────────────────────

function drawVignette() {
  noStroke();
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const alpha = map(i, 0, steps, 52, 0);
    const m = i * 5.5;
    fill(5, 2, 4, alpha);
    rect(0, 0, W, m);           // top
    rect(0, H - m, W, m);       // bottom
    rect(0, 0, m, H);           // left
    rect(W - m, 0, m, H);       // right
  }

  // Dark maroon frame (cinematic border like the photos)
  noFill();
  stroke(58, 11, 16, 220);
  strokeWeight(10);
  rect(5, 5, W - 10, H - 10);
}

// ─── Controls ─────────────────────────────────────────────────────────────

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('crimson-dusk', 'png');
  }
  if (key === 'r' || key === 'R') {
    regenerateSeeds(); // new sky, waves, terrain, birds
    redraw();
  }
}
