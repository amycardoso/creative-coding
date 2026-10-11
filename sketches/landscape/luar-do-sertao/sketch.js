/**
 * Luar do Sertão
 *
 * A moonlit night over the sertão — a huge low moon,
 * mandacaru cacti and a windmill in silhouette,
 * fireflies drifting over the caatinga.
 *
 * Controls:
 * - Press S to save a PNG snapshot
 * - Press R to regenerate
 */

const W = 800;
const H = 800;

const HORIZON = 0.72;

let skyNoise, terrainSeed, moonSpec, cactiSpec, millSpec;

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

  moonSpec = {
    x: random(W * 0.24, W * 0.72),
    y: random(H * 0.16, H * 0.32),
    r: random(72, 108),
    maria: floor(random(10000)),
  };

  // 3–5 mandacaru cacti spread across the ground, none under the moon's glow
  const count = floor(random(3, 6));
  cactiSpec = [];
  for (let i = 0; i < count; i++) {
    cactiSpec.push({
      xf: (i + random(0.15, 0.85)) / count,
      h: random(160, 285),
      w: random(11, 16),
      arms: floor(random(2, 5)),
      seed: floor(random(10000)),
    });
  }

  millSpec = {
    xf: random() < 0.5 ? random(0.12, 0.30) : random(0.66, 0.86),
    rot: random(TWO_PI),
  };
}

function draw() {
  drawSky();
  drawStars();
  drawMoon();
  drawSerra();
  drawGround();
  drawWindmill();
  drawCacti();
  drawFireflies();
  drawVignette();
}

// ─── Sky ─────────────────────────────────────────────────────────────────────

function skyColor(p) {
  let r, g, b;
  if (p < 0.30) {
    // Deep indigo crown
    const s = p / 0.30;
    r = lerp(8, 14, s); g = lerp(6, 18, s); b = lerp(32, 62, s);
  } else if (p < 0.62) {
    const s = (p - 0.30) / 0.32;
    r = lerp(14, 22, s); g = lerp(18, 52, s); b = lerp(62, 92, s);
  } else if (p < 0.86) {
    const s = (p - 0.62) / 0.24;
    r = lerp(22, 34, s); g = lerp(52, 92, s); b = lerp(92, 108, s);
  } else {
    // Dusty teal breath at the horizon
    const s = (p - 0.86) / 0.14;
    r = lerp(34, 52, s); g = lerp(92, 122, s); b = lerp(108, 118, s);
  }
  return [r, g, b];
}

function drawSky() {
  const hy = floor(H * HORIZON);
  noStroke();

  for (let y = 0; y < hy; y++) {
    const p = y / hy;
    const [r, g, b] = skyColor(p);

    // Horizontal atmosphere banding — thin night haze
    const n = noise(skyNoise + 0.5, y * 0.006) * 10 - 5;
    const n2 = noise(skyNoise + 1.5, y * 0.018) * 4 - 2;

    fill(
      constrain(r + n2 * 0.4, 0, 255),
      constrain(g + n * 0.25, 0, 255),
      constrain(b + n * 0.45 + n2, 0, 255)
    );
    rect(0, y, W, 1);
  }
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function drawStars() {
  const hy = H * HORIZON;
  randomSeed(skyNoise);
  noStroke();

  const count = 360;
  for (let i = 0; i < count; i++) {
    const sx = random(W);
    // Denser toward the crown, thinning near the horizon
    const sy = pow(random(), 1.6) * hy * 0.96;

    // Fade out inside the moon's halo
    const dm = dist(sx, sy, moonSpec.x, moonSpec.y);
    const haloFade = constrain((dm - moonSpec.r * 1.15) / (moonSpec.r * 2.2), 0, 1);
    if (haloFade <= 0.02) continue;

    const horizonFade = constrain(1 - sy / hy, 0.15, 1);
    const tw = random();
    const alpha = (30 + tw * 165) * haloFade * horizonFade;
    const sz = tw < 0.86 ? random(0.7, 1.5) : random(1.6, 2.4);

    fill(214, 224, 244, alpha);
    circle(sx, sy, sz);

    // A few bright ones get a tiny cross-glint
    if (tw > 0.965 && haloFade > 0.5) {
      stroke(214, 224, 244, alpha * 0.42);
      strokeWeight(0.7);
      line(sx - sz * 2.1, sy, sx + sz * 2.1, sy);
      line(sx, sy - sz * 2.1, sx, sy + sz * 2.1);
      noStroke();
    }
  }
  randomSeed();
}

// ─── Moon ────────────────────────────────────────────────────────────────────

function drawMoon() {
  const { x, y, r, maria } = moonSpec;
  noStroke();

  // Layered glow halo, tinting the nearby sky
  for (let i = 42; i > 0; i--) {
    const gr = r + i * i * 0.34;
    fill(196, 214, 210, 2.2);
    circle(x, y, gr * 2);
  }

  // Disc
  fill(236, 236, 220);
  circle(x, y, r * 2);

  // Maria — two-octave noise shading clipped to the disc
  for (let py = -r; py <= r; py += 1) {
    for (let px = -r; px <= r; px += 1) {
      const d = sqrt(px * px + py * py);
      if (d > r - 1.5) continue;
      const n = noise(maria + px * 0.02, maria + py * 0.02) * 0.7
              + noise(maria + 50 + px * 0.055, maria + 50 + py * 0.055) * 0.3;
      if (n > 0.52) {
        const shade = map(n, 0.52, 0.78, 4, 30, true);
        const a = map(n, 0.52, 0.62, 40, 130, true);
        fill(202 - shade, 206 - shade, 192 - shade, a);
        rect(x + px, y + py, 1, 1);
      }
    }
  }

  // Gentle limb ring to settle the disc into the sky
  noFill();
  stroke(180, 196, 190, 40);
  strokeWeight(1.5);
  circle(x, y, r * 2);
  noStroke();
}

// ─── Distant Serra ───────────────────────────────────────────────────────────

function drawSerra() {
  const hy = H * HORIZON;
  fill(16, 34, 44);
  noStroke();

  beginShape();
  vertex(0, hy);
  for (let x = 0; x <= W; x += 6) {
    const n = noise(terrainSeed + x * 0.004);
    const ridge = hy - n * n * 46 - 4;
    vertex(x, ridge);
  }
  vertex(W, hy);
  endShape(CLOSE);

  // Faint moonlit rim on the ridge crest
  noFill();
  stroke(120, 160, 158, 26);
  strokeWeight(1);
  beginShape();
  for (let x = 0; x <= W; x += 6) {
    const n = noise(terrainSeed + x * 0.004);
    vertex(x, hy - n * n * 46 - 4);
  }
  endShape();
  noStroke();
}

// ─── Ground ──────────────────────────────────────────────────────────────────

function drawGround() {
  const gt = H * HORIZON;

  noStroke();
  for (let y = gt; y <= H; y++) {
    const p = (y - gt) / (H - gt);
    fill(lerp(10, 4, p), lerp(16, 6, p), lerp(20, 9, p));
    rect(0, y, W, 1);
  }

  // Caatinga scrub contour (varies per render via terrainSeed)
  fill(6, 9, 13);
  beginShape();
  vertex(0, H);
  vertex(0, H * 0.86);
  const pts = [0.08, 0.20, 0.35, 0.50, 0.65, 0.78, 0.90];
  for (let i = 0; i < pts.length; i++) {
    const xf = pts[i];
    const jitter = noise(terrainSeed + 40 + i * 0.5) * 0.05 - 0.025;
    vertex(W * xf, H * (0.83 + jitter));
  }
  vertex(W, H * 0.855);
  vertex(W, H);
  endShape(CLOSE);

  // Sparse scrub tufts along the contour
  stroke(5, 8, 11);
  randomSeed(terrainSeed);
  for (let i = 0; i < 42; i++) {
    const tx = random(W);
    const ty = random(H * 0.84, H * 0.97);
    const th = random(3, 9);
    strokeWeight(random(0.7, 1.3));
    for (let j = -2; j <= 2; j++) {
      line(tx, ty, tx + j * th * 0.28, ty - th + abs(j));
    }
  }
  randomSeed();
  noStroke();
}

// ─── Mandacaru Cacti ─────────────────────────────────────────────────────────

function drawCactus(cx, groundY, spec) {
  const { h, w, arms, seed } = spec;
  const dark = color(4, 7, 11);

  stroke(dark);
  strokeWeight(w);
  strokeCap(ROUND);

  // Trunk
  line(cx, groundY, cx, groundY - h);

  // Arms — sprout from the trunk, elbow out then curl upward
  randomSeed(seed);
  for (let i = 0; i < arms; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const ay = groundY - h * random(0.35, 0.72);
    const reach = w * random(1.4, 2.6);
    const rise = h * random(0.22, 0.42);
    const aw = w * random(0.62, 0.8);

    strokeWeight(aw);
    noFill();
    beginShape();
    vertex(cx, ay);
    quadraticVertex(cx + side * reach, ay + aw * 0.3, cx + side * reach, ay - rise * 0.4);
    vertex(cx + side * reach, ay - rise);
    endShape();
  }
  randomSeed();

  // Crown tips — slight bulge at the top of the trunk
  noStroke();
  fill(dark);
  circle(cx, groundY - h, w * 1.05);

  strokeCap(SQUARE);
}

function drawCacti() {
  for (const spec of cactiSpec) {
    const cx = W * lerp(0.06, 0.94, spec.xf);
    // Keep clear of the windmill
    if (abs(lerp(0.06, 0.94, spec.xf) - millSpec.xf) < 0.12) continue;
    const groundY = H * (0.87 + noise(terrainSeed + cx) * 0.04);
    drawCactus(cx, groundY, spec);
  }
}

// ─── Windmill (catavento) ────────────────────────────────────────────────────

function drawWindmill() {
  const cx = W * millSpec.xf;
  const groundY = H * 0.92;
  const towerH = 195;
  const tw = 44;              // base half-spread
  const topW = 7;             // top half-spread
  const hubY = groundY - towerH;

  const dark = color(5, 8, 12);
  stroke(dark);
  noFill();

  // Tower legs
  strokeWeight(3.2);
  line(cx - tw, groundY, cx - topW, hubY + 8);
  line(cx + tw, groundY, cx + topW, hubY + 8);

  // Lattice braces
  strokeWeight(1.4);
  const rungs = 5;
  for (let i = 0; i < rungs; i++) {
    const t0 = i / rungs;
    const t1 = (i + 1) / rungs;
    const y0 = lerp(groundY, hubY + 8, t0);
    const y1 = lerp(groundY, hubY + 8, t1);
    const w0 = lerp(tw, topW, t0);
    const w1 = lerp(tw, topW, t1);
    line(cx - w0, y0, cx + w0, y0);
    line(cx - w0, y0, cx + w1, y1);
    line(cx + w0, y0, cx - w1, y1);
  }

  // Fan rotor — many-bladed circle, classic water-pump mill
  const fr = 34;
  strokeWeight(2);
  const blades = 14;
  for (let i = 0; i < blades; i++) {
    const a = millSpec.rot + (TWO_PI * i) / blades;
    line(
      cx + cos(a) * fr * 0.22, hubY + sin(a) * fr * 0.22,
      cx + cos(a) * fr, hubY + sin(a) * fr
    );
  }
  noFill();
  strokeWeight(1.6);
  circle(cx, hubY, fr * 2);

  // Hub + tail vane
  noStroke();
  fill(dark);
  circle(cx, hubY, 9);
  const tailSide = millSpec.xf < 0.5 ? 1 : -1;
  triangle(
    cx + tailSide * fr * 0.9, hubY - 3,
    cx + tailSide * (fr * 0.9 + 26), hubY - 13,
    cx + tailSide * (fr * 0.9 + 26), hubY + 9
  );
}

// ─── Fireflies ───────────────────────────────────────────────────────────────

function drawFireflies() {
  noStroke();
  const count = floor(random(15, 26));

  for (let i = 0; i < count; i++) {
    const fx = random(W * 0.05, W * 0.95);
    const fy = random(H * 0.76, H * 0.96);
    const bright = random(0.45, 1);
    const sz = random(1.6, 3) * bright;

    // Soft halo
    for (let g = 6; g > 0; g--) {
      fill(196, 226, 110, 9 * bright);
      circle(fx, fy, sz + g * 3.4);
    }
    fill(232, 246, 158, 235 * bright);
    circle(fx, fy, sz);
  }
}

// ─── Vignette + Border ───────────────────────────────────────────────────────

function drawVignette() {
  noStroke();
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const alpha = map(i, 0, steps, 52, 0);
    const m = i * 5.5;
    fill(2, 4, 8, alpha);
    rect(0, 0, W, m);           // top
    rect(0, H - m, W, m);       // bottom
    rect(0, 0, m, H);           // left
    rect(W - m, 0, m, H);       // right
  }

  // Deep blue-black frame (cinematic border, matching the family)
  noFill();
  stroke(9, 16, 34, 220);
  strokeWeight(10);
  rect(5, 5, W - 10, H - 10);
}

// ─── Controls ────────────────────────────────────────────────────────────────

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('luar-do-sertao', 'png');
  }
  if (key === 'r' || key === 'R') {
    regenerateSeeds(); // new moon, stars, cacti, mill, fireflies
    redraw();
  }
}
