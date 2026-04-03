/**
 * Painted Cosmos — Generative Cosmic Gouache
 *
 * Animated cosmic scene with hand-painted brush texture.
 * Spiral galaxies, colorful planets, twinkling stars, and a comet
 * drift across a deep navy void.
 *
 * Controls:
 * - Click: Generate new composition
 * - S: Save PNG
 */

const W = 928;
const H = 928;
const BG = [10, 10, 26]; // #0a0a1a

// --- Brush stamps (offscreen buffers) ---
let brushStamps = [];

function createBrushStamp(size) {
  let g = createGraphics(size, size);
  g.pixelDensity(1);
  g.clear();
  g.noStroke();

  // Build an irregular blob from overlapping semi-transparent circles
  let cx = size / 2;
  let cy = size / 2;
  let baseR = size * 0.3;
  let numBlobs = floor(random(12, 20));

  for (let i = 0; i < numBlobs; i++) {
    let angle = random(TWO_PI);
    let dist = random(baseR * 0.3);
    let bx = cx + cos(angle) * dist;
    let by = cy + sin(angle) * dist;
    let br = random(baseR * 0.5, baseR * 1.2);
    let alpha = random(80, 180);
    g.fill(255, alpha);
    g.ellipse(bx, by, br * 2, br * random(0.7, 1.3));
  }

  // Add fine spatter around edges for rough texture
  for (let i = 0; i < size * 2; i++) {
    let angle = random(TWO_PI);
    let dist = random(baseR * 0.6, baseR * 1.8);
    let sx = cx + cos(angle) * dist;
    let sy = cy + sin(angle) * dist;
    if (sx < 0 || sx > size || sy < 0 || sy > size) continue;
    g.fill(255, random(30, 100));
    g.circle(sx, sy, random(1, 3));
  }

  return g;
}

function initBrushStamps() {
  brushStamps = [];
  let sizes = [20, 35, 50, 70];
  for (let s of sizes) {
    // Create 3 variants per size for variety
    for (let v = 0; v < 3; v++) {
      brushStamps.push({ img: createBrushStamp(s), size: s });
    }
  }
}

// Stamp a brush along the canvas at (x, y) with given color and size
function stampBrush(x, y, col, size) {
  let candidates = brushStamps.filter(b => abs(b.size - size) < size * 0.5);
  if (candidates.length === 0) candidates = brushStamps;
  let stamp = random(candidates);

  push();
  translate(x, y);
  rotate(random(TWO_PI));
  let s = size / stamp.size;
  tint(red(col), green(col), blue(col), alpha(col));
  image(stamp.img, -stamp.size * s / 2, -stamp.size * s / 2,
        stamp.size * s, stamp.size * s);
  noTint();
  pop();
}

// Draw a painterly stroke along a path (array of {x, y} points)
function brushStroke(points, col, size, spacing) {
  spacing = spacing || size * 0.4;
  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    let jx = p.x + random(-size * 0.1, size * 0.1);
    let jy = p.y + random(-size * 0.1, size * 0.1);
    let jSize = size * random(0.8, 1.2);
    stampBrush(jx, jy, col, jSize);
  }
}

// --- Color palette ---
const PALETTE = {
  galaxyPink: ['#e84393', '#fd79a8', '#d63031'],
  galaxyGold: ['#fdcb6e', '#f9ca24', '#e1b12c'],
  planets: ['#e84393', '#e17055', '#00cec9', '#0984e3', '#6ab04c', '#a29bfe', '#dfe6e9'],
  dust: ['#fd79a8', '#a29bfe', '#e84393'],
};

// --- Scene objects ---
let stars = [];
let sparkles = [];
let dustParticles = [];

function generateStars() {
  stars = [];
  let count = floor(random(250, 400));
  for (let i = 0; i < count; i++) {
    stars.push({
      x: random(W),
      y: random(H),
      r: random(0.5, 2.5),
      phase: random(TWO_PI),
      speed: random(0.02, 0.06),
      brightness: random(150, 255),
    });
  }
}

function generateSparkles() {
  sparkles = [];
  let count = floor(random(10, 20));
  for (let i = 0; i < count; i++) {
    sparkles.push({
      x: random(W),
      y: random(H),
      size: random(4, 14),
      phase: random(TWO_PI),
      speed: random(0.01, 0.03),
    });
  }
}

function generateDust() {
  dustParticles = [];
  let count = floor(random(120, 200));
  for (let i = 0; i < count; i++) {
    dustParticles.push({
      x: random(W),
      y: random(H),
      r: random(0.5, 2),
      col: color(random(PALETTE.dust)),
    });
  }
}

function drawStars(t) {
  noStroke();
  for (let s of stars) {
    let twinkle = map(sin(t * s.speed + s.phase), -1, 1, 0.3, 1.0);
    let a = s.brightness * twinkle;
    fill(255, 255, 255, a);
    circle(s.x, s.y, s.r * 2);
  }
}

function drawSparkles(t) {
  stroke(255, 255, 255);
  noFill();
  for (let s of sparkles) {
    let pulse = map(sin(t * s.speed + s.phase), -1, 1, 0.5, 1.0);
    let sz = s.size * pulse;
    let a = 200 * pulse;
    stroke(255, 255, 255, a);
    strokeWeight(1.2);
    // 4-point cross
    line(s.x - sz, s.y, s.x + sz, s.y);
    line(s.x, s.y - sz, s.x, s.y + sz);
    // Smaller diagonal cross
    let d = sz * 0.5;
    strokeWeight(0.8);
    line(s.x - d, s.y - d, s.x + d, s.y + d);
    line(s.x - d, s.y + d, s.x + d, s.y - d);
  }
  noStroke();
}

function drawDust() {
  noStroke();
  for (let d of dustParticles) {
    let c = d.col;
    fill(red(c), green(c), blue(c), 100);
    circle(d.x, d.y, d.r * 2);
  }
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(1);
  initBrushStamps();
  generateStars();
  generateSparkles();
  generateDust();
}

function draw() {
  background(...BG);
  let t = frameCount;
  drawDust();
  drawStars(t);
  drawSparkles(t);
}

function mousePressed() {
  // Will regenerate composition later
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('painted-cosmos', 'png');
  }
}
