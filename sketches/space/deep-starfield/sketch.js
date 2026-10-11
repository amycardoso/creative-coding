// Deep Starfield — Animated Twinkling Star Field
// Three-layer compositing: background + dust (static) | animated stars (per frame)
// Press Shift+S to start/stop GIF recording

P5Capture.setDefaultOptions({
  format: 'webm',
  framerate: 30,
  quality: 1.0,
  width: 540,
});

const W = 540;
const H = 750;

let bgBuffer;
let dustBuffer;

let tinyStars = [];   // ~800 animated pinpoints
let mediumStars = []; // ~40 slightly brighter
let brightStars = []; // 3 subtle bright ones

let driftX = 0;
let driftY = 0;
const DRIFT_SPEED_X = 0.12;
const DRIFT_SPEED_Y = 0.08;

// Predominantly blue-white palette (matching reference)
const STAR_COLORS = [
  [190, 210, 255],  // blue-white (most common)
  [200, 215, 255],  // blue-white
  [220, 230, 255],  // pale blue
  [255, 255, 255],  // pure white (rare)
  [240, 235, 220],  // warm hint (rare)
];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');

  bgBuffer = createGraphics(W, H);
  dustBuffer = createGraphics(W, H);

  noiseSeed(42);
  drawBackground();
  drawDust();
  generateStars();

  frameRate(30);
}

// Three-octave Perlin noise with strong cluster/void contrast
function noiseDensity(x, y) {
  let broad = noise(x * 0.004, y * 0.004);          // large-scale clusters
  let medium = noise(x * 0.01, y * 0.01) * 0.4;     // filaments
  let fine = noise(x * 0.025, y * 0.025) * 0.15;    // granularity
  let raw = (broad + medium + fine) / 1.55;
  // Steep contrast curve: dark voids vs bright rivers
  return pow(raw, 0.45);
}

// Rejection sampling with steep density bias
function generateStarPosition() {
  for (let i = 0; i < 200; i++) {
    let x = random(W);
    let y = random(H);
    let d = noiseDensity(x, y);
    if (random() < d * d * d * 4) {
      return { x, y };
    }
  }
  return { x: random(W), y: random(H) };
}

function drawBackground() {
  // Very dark navy gradient
  for (let y = 0; y < H; y++) {
    let t = y / H;
    let r = lerp(2, 6, t);
    let g = lerp(4, 10, t);
    let b = lerp(12, 22, t);
    bgBuffer.stroke(r, g, b);
    bgBuffer.line(0, y, W, y);
  }

  // Subtle diffuse glow in dense regions (barely perceptible)
  bgBuffer.noStroke();
  for (let i = 0; i < 8; i++) {
    let bestX = W / 2, bestY = H / 2, bestD = 0;
    for (let a = 0; a < 80; a++) {
      let tx = random(W * 0.05, W * 0.95);
      let ty = random(H * 0.05, H * 0.95);
      let td = noiseDensity(tx, ty);
      if (td > bestD) {
        bestD = td;
        bestX = tx;
        bestY = ty;
      }
    }

    let px = bestX + random(-40, 40);
    let py = bestY + random(-40, 40);
    let radius = random(80, 180);

    for (let j = 15; j >= 0; j--) {
      let t = j / 15;
      let r = radius * t;
      let a = 6 * (1 - t); // very faint, max alpha ~6
      bgBuffer.fill(30, 50, 90, a);
      bgBuffer.ellipse(px, py, r * 2, r * 2);
    }
  }
}

function drawDust() {
  dustBuffer.clear();
  dustBuffer.noStroke();

  // 20000 static dust particles — dense pinpoint field
  for (let i = 0; i < 20000; i++) {
    let pos = generateStarPosition();
    let size = random(0.3, 1.2);
    let d = noiseDensity(pos.x, pos.y);
    let alpha = random(25, 80) + d * 80;
    let col = random(STAR_COLORS);
    dustBuffer.fill(col[0], col[1], col[2], alpha);
    dustBuffer.ellipse(pos.x, pos.y, size, size);
  }
}

function generateStars() {
  // 1200 tiny animated stars — fast twinkle, sub-pixel to 1.5px
  for (let i = 0; i < 1200; i++) {
    let pos = generateStarPosition();
    tinyStars.push({
      x: pos.x,
      y: pos.y,
      size: random(0.5, 1.5),
      color: random(STAR_COLORS),
      phase: random(TWO_PI),
      speed: random(0.02, 0.08),
      minBright: random(0.1, 0.4),
      parallax: 0.6,
    });
  }

  // 40 medium stars — slightly larger, gentle glow
  for (let i = 0; i < 40; i++) {
    let pos = generateStarPosition();
    mediumStars.push({
      x: pos.x,
      y: pos.y,
      size: random(1.2, 2.0),
      color: random(STAR_COLORS),
      phase: random(TWO_PI),
      speed: random(0.01, 0.035),
      minBright: random(0.5, 0.7),
      parallax: 0.8,
    });
  }

  // 6 bright stars — subtle glow, no crosshairs
  for (let i = 0; i < 6; i++) {
    let pos = generateStarPosition();
    brightStars.push({
      x: pos.x,
      y: pos.y,
      size: random(2.0, 3.0),
      glowSize: random(8, 14),
      color: random(STAR_COLORS),
      phase: random(TWO_PI),
      speed: random(0.006, 0.015),
      minBright: random(0.7, 0.9),
      parallax: 1.0,
    });
  }
}

function wrapCoord(val, max) {
  return ((val % max) + max) % max;
}

function draw() {
  driftX += DRIFT_SPEED_X;
  driftY += DRIFT_SPEED_Y;

  // Layer 1: Background (static)
  image(bgBuffer, 0, 0);

  // Layer 2: Dust with parallax tiling
  let dustOffX = ((driftX * 0.3) % W + W) % W;
  let dustOffY = ((driftY * 0.3) % H + H) % H;
  image(dustBuffer, -dustOffX, -dustOffY);
  image(dustBuffer, -dustOffX + W, -dustOffY);
  image(dustBuffer, -dustOffX, -dustOffY + H);
  image(dustBuffer, -dustOffX + W, -dustOffY + H);

  // Layer 3: Animated stars
  noStroke();

  // Tiny stars
  for (let i = 0; i < tinyStars.length; i++) {
    let s = tinyStars[i];
    let twinkle = s.minBright + (1 - s.minBright) * (0.5 + 0.5 * sin(frameCount * s.speed + s.phase));
    let alpha = 255 * twinkle;
    let sx = wrapCoord(s.x - driftX * s.parallax, W);
    let sy = wrapCoord(s.y - driftY * s.parallax, H);
    fill(s.color[0], s.color[1], s.color[2], alpha);
    ellipse(sx, sy, s.size, s.size);
  }

  // Medium stars — use shadowBlur for natural glow, no ring artifacts
  for (let i = 0; i < mediumStars.length; i++) {
    let s = mediumStars[i];
    let twinkle = s.minBright + (1 - s.minBright) * (0.5 + 0.5 * sin(frameCount * s.speed + s.phase));
    let alpha = 255 * twinkle;
    let sx = wrapCoord(s.x - driftX * s.parallax, W);
    let sy = wrapCoord(s.y - driftY * s.parallax, H);

    drawingContext.shadowBlur = 4 * twinkle;
    drawingContext.shadowColor = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${0.6 * twinkle})`;
    fill(s.color[0], s.color[1], s.color[2], alpha);
    ellipse(sx, sy, s.size, s.size);
  }

  // Bright stars — shadowBlur for smooth glow
  for (let i = 0; i < brightStars.length; i++) {
    let s = brightStars[i];
    let twinkle = s.minBright + (1 - s.minBright) * (0.5 + 0.5 * sin(frameCount * s.speed + s.phase));
    let sx = wrapCoord(s.x - driftX * s.parallax, W);
    let sy = wrapCoord(s.y - driftY * s.parallax, H);

    drawingContext.shadowBlur = s.glowSize * twinkle;
    drawingContext.shadowColor = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${0.5 * twinkle})`;
    fill(255, 255, 255, 220 * twinkle);
    ellipse(sx, sy, s.size, s.size);
  }

  // Reset shadow
  drawingContext.shadowBlur = 0;
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    if (keyIsDown(SHIFT)) {
      if (typeof P5Capture !== 'undefined') {
        const c = P5Capture.getInstance();
        if (c.state === 'idle') c.start({ format: 'webm', duration: 300 });
        else c.stop();
      }
    } else {
      saveCanvas('deep-starfield', 'png');
    }
  }
}
