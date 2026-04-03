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

// --- Render target for offscreen drawing ---
let renderTarget = null; // null = main canvas
let staticLayer;

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

  let t = renderTarget || this;
  t.push();
  t.translate(x, y);
  t.rotate(random(TWO_PI));
  let s = size / stamp.size;
  t.tint(red(col), green(col), blue(col), alpha(col));
  t.image(stamp.img, -stamp.size * s / 2, -stamp.size * s / 2,
          stamp.size * s, stamp.size * s);
  t.noTint();
  t.pop();
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
  let target = renderTarget || this;
  target.noStroke();
  for (let d of dustParticles) {
    let c = d.col;
    target.fill(red(c), green(c), blue(c), 100);
    target.circle(d.x, d.y, d.r * 2);
  }
}

// --- Galaxies ---
let galaxies = [];

function generateGalaxies() {
  galaxies = [];
  let count = floor(random(2, 5));
  for (let i = 0; i < count; i++) {
    let r = random(120, 300);

    // Overlap avoidance between galaxies
    let placed = false;
    let attempts = 0;
    let gx, gy;
    while (!placed && attempts < 80) {
      gx = random(r, W - r);
      gy = random(r, H - r);
      placed = true;
      for (let og of galaxies) {
        if (dist(gx, gy, og.x, og.y) < og.radius * 0.6 + r * 0.6) {
          placed = false;
          break;
        }
      }
      attempts++;
    }

    galaxies.push({
      x: gx,
      y: gy,
      radius: r,
      tilt: random(-0.6, 0.6),
      rotation: random(TWO_PI),
      rotSpeed: random(0.0005, 0.0015) * (random() > 0.5 ? 1 : -1),
      numArms: floor(random(2, 4)),
      armWind: random(2.5, 4.0),
      pinkColors: PALETTE.galaxyPink.map(c => color(c)),
      goldColors: PALETTE.galaxyGold.map(c => color(c)),
      coreSize: r * random(0.15, 0.25),
    });
  }
}

function drawGalaxy(g, t) {
  let target = renderTarget || this;
  target.push();
  target.translate(g.x, g.y);
  target.rotate(g.rotation + t * g.rotSpeed);
  target.scale(1, 0.4 + abs(g.tilt) * 0.3);

  // Core — dense concentrated brush stamps
  for (let i = 0; i < 50; i++) {
    let angle = random(TWO_PI);
    let d = random(g.coreSize);
    let cx = cos(angle) * d;
    let cy = sin(angle) * d;
    let col = random(g.pinkColors);
    let a = map(d, 0, g.coreSize, 240, 120);
    stampBrush(cx, cy, color(red(col), green(col), blue(col), a),
              random(20, 45));
  }

  // Spiral arms — dense stamps for continuous painted arcs
  for (let arm = 0; arm < g.numArms; arm++) {
    let armOffset = (TWO_PI / g.numArms) * arm;
    let steps = 150;

    for (let i = 0; i < steps; i++) {
      let frac = i / steps;
      let theta = armOffset + frac * g.armWind * PI;
      let r = g.coreSize * 0.5 + frac * (g.radius - g.coreSize * 0.5);
      let ax = cos(theta) * r;
      let ay = sin(theta) * r;

      // Slight jitter for organic feel
      ax += random(-r * 0.03, r * 0.03);
      ay += random(-r * 0.03, r * 0.03);

      // Color: pink near core, gold near edge
      let col;
      if (frac < 0.4) {
        col = lerpColor(random(g.pinkColors), random(g.goldColors), frac * 2.5);
      } else {
        col = random(g.goldColors);
      }
      let a = map(frac, 0, 1, 230, 80);
      let sz = map(frac, 0, 1, 38, 16);

      stampBrush(ax, ay, color(red(col), green(col), blue(col), a), sz);

      // Extra stamp for width/density on inner arms
      if (frac < 0.6) {
        let perpAngle = theta + HALF_PI;
        let spread = sz * 0.4;
        let bx = ax + cos(perpAngle) * random(-spread, spread);
        let by = ay + sin(perpAngle) * random(-spread, spread);
        stampBrush(bx, by, color(red(col), green(col), blue(col), a * 0.6),
                  sz * 0.7);
      }
    }
  }

  target.pop();
}

function drawGalaxies(t) {
  for (let g of galaxies) {
    drawGalaxy(g, t);
  }
}

// --- Planets ---
let planets = [];

function generatePlanets() {
  planets = [];
  let solidCount = floor(random(6, 11));
  let ringedCount = floor(random(1, 4));

  for (let i = 0; i < solidCount + ringedCount; i++) {
    let r = random(10, 70);
    let hasRing = i >= solidCount;
    if (hasRing) r = random(25, 55);

    // Overlap avoidance
    let placed = false;
    let attempts = 0;
    let px, py;
    while (!placed && attempts < 100) {
      px = random(r + 20, W - r - 20);
      py = random(r + 20, H - r - 20);
      placed = true;
      // Avoid galaxy centers
      for (let g of galaxies) {
        if (dist(px, py, g.x, g.y) < g.radius * 0.4 + r) {
          placed = false;
          break;
        }
      }
      // Avoid other planets
      if (placed) {
        for (let op of planets) {
          if (dist(px, py, op.x, op.y) < op.r + r + 10) {
            placed = false;
            break;
          }
        }
      }
      attempts++;
    }

    planets.push({
      x: px,
      y: py,
      r: r,
      col: color(random(PALETTE.planets)),
      hasRing: hasRing,
      ringTilt: random(0.2, 0.5),
      ringColor: color(random(PALETTE.galaxyGold)),
      driftX: random(-0.05, 0.05),
      driftY: random(-0.05, 0.05),
      highlightAngle: random(TWO_PI),
    });
  }

  // Sort by size so big ones are behind
  planets.sort((a, b) => b.r - a.r);
}

function drawPlanet(p) {
  let c = p.col;

  // Base sphere — dense overlapping brush stamps for solid coverage
  let stamps = max(15, floor(p.r * 1.5));
  for (let i = 0; i < stamps; i++) {
    let angle = random(TWO_PI);
    let d = random(p.r * 0.5);
    let sx = p.x + cos(angle) * d;
    let sy = p.y + sin(angle) * d;
    let a = map(d, 0, p.r * 0.5, 240, 140);
    stampBrush(sx, sy, color(red(c), green(c), blue(c), a),
              random(p.r * 0.4, p.r * 0.8));
  }

  // Dark crescent (shadow)
  let shadowAngle = p.highlightAngle + PI;
  let shadowX = p.x + cos(shadowAngle) * p.r * 0.3;
  let shadowY = p.y + sin(shadowAngle) * p.r * 0.3;
  for (let i = 0; i < 8; i++) {
    stampBrush(
      shadowX + random(-p.r * 0.15, p.r * 0.15),
      shadowY + random(-p.r * 0.15, p.r * 0.15),
      color(5, 5, 20, 100),
      p.r * random(0.4, 0.7)
    );
  }

  // Highlight spot
  let hlX = p.x + cos(p.highlightAngle) * p.r * 0.3;
  let hlY = p.y + sin(p.highlightAngle) * p.r * 0.3;
  stampBrush(hlX, hlY, color(255, 255, 255, 90), p.r * 0.3);

  // Ring (if applicable) — dense stamps for continuous ring
  if (p.hasRing) {
    let ringSteps = 120;
    for (let i = 0; i < ringSteps; i++) {
      let angle = (TWO_PI / ringSteps) * i;
      let rx = p.x + cos(angle) * p.r * 1.8;
      let ry = p.y + sin(angle) * p.r * 1.8 * p.ringTilt;
      let rc = p.ringColor;
      stampBrush(rx, ry, color(red(rc), green(rc), blue(rc), 180), 10);
    }
  }
}

function drawPlanets() {
  for (let p of planets) {
    drawPlanet(p);
  }
}

function updatePlanets() {
  for (let p of planets) {
    p.x += p.driftX;
    p.y += p.driftY;
    // Wrap around
    if (p.x < -p.r) p.x = W + p.r;
    if (p.x > W + p.r) p.x = -p.r;
    if (p.y < -p.r) p.y = H + p.r;
    if (p.y > H + p.r) p.y = -p.r;
  }
}

// --- Comet ---
let comet;

function generateComet() {
  comet = {
    t: random(1),
    speed: random(0.001, 0.002),
    p0: { x: random(-100, 0), y: random(H * 0.1, H * 0.4) },
    p1: { x: random(W * 0.3, W * 0.5), y: random(-50, H * 0.2) },
    p2: { x: random(W * 0.5, W * 0.7), y: random(H * 0.6, H * 0.9) },
    p3: { x: random(W, W + 100), y: random(H * 0.3, H * 0.6) },
    trailLength: 25,
  };
}

function bezierPoint2D(p0, p1, p2, p3, t) {
  let mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

function drawComet() {
  let head = bezierPoint2D(comet.p0, comet.p1, comet.p2, comet.p3, comet.t);

  // Trail
  for (let i = comet.trailLength; i > 0; i--) {
    let tt = comet.t - i * 0.008;
    if (tt < 0) tt += 1;
    let tp = bezierPoint2D(comet.p0, comet.p1, comet.p2, comet.p3, tt);
    let frac = 1 - i / comet.trailLength;
    let a = frac * 180;
    let sz = frac * 18 + 4;
    stampBrush(tp.x, tp.y, color(232, 67, 147, a), sz);
  }

  // Head glow
  stampBrush(head.x, head.y, color(214, 48, 49, 240), 22);
  stampBrush(head.x, head.y, color(255, 180, 180, 180), 12);

  // Advance
  comet.t += comet.speed;
  if (comet.t > 1) {
    generateComet();
  }
}

function renderStaticLayer() {
  staticLayer = createGraphics(W, H);
  staticLayer.pixelDensity(1);
  staticLayer.background(...BG);

  renderTarget = staticLayer;
  drawDust();
  drawGalaxies(0);
  drawPlanets();
  renderTarget = null;
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(1);
  initBrushStamps();
  generateStars();
  generateSparkles();
  generateDust();
  generateGalaxies();
  generatePlanets();
  generateComet();
  renderStaticLayer();
}

function draw() {
  image(staticLayer, 0, 0);
  let t = frameCount;
  drawComet();
  drawStars(t);
  drawSparkles(t);
  updatePlanets();

  // Re-render static layer periodically for planet drift
  if (frameCount % 120 === 0) {
    renderStaticLayer();
  }
}

function mousePressed() {
  generateStars();
  generateSparkles();
  generateDust();
  generateGalaxies();
  generatePlanets();
  generateComet();
  renderStaticLayer();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('painted-cosmos', 'png');
  }
}
