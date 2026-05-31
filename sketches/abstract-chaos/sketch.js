/**
 * Abstract Chaos
 *
 * Dense generative geometric abstraction — overlapping circles,
 * rectangles, and curved ribbons in warm oranges, pinks, and
 * corals with teal contrast. Shapes overlap at high opacity
 * to keep colors vivid and saturated.
 *
 * Controls:
 * - Click to generate a new composition
 * - Press S to save PNG
 */

const W = 800;
const H = 800;

// Warm dominant colors — high saturation, no dark navy in shapes
const WARM = [
  '#FF5A2E', // vivid orange
  '#FF7849', // bright coral
  '#FF4070', // hot pink
  '#FF6B8A', // rose pink
  '#E8344E', // crimson
  '#FF9040', // tangerine
  '#FFB830', // golden amber
  '#FF5858', // bright red
  '#F06070', // salmon
  '#FF8566', // peach-coral
];

// Cool accent colors — used sparingly
const COOL = [
  '#00C9B8', // bright teal
  '#20E0D0', // turquoise
  '#0AADA0', // emerald teal
  '#2196C8', // sky blue
];

// Dark accents — for contrast shapes (used rarely)
const DARKS = [
  '#0D1F3C', // deep navy
  '#1A2744', // dark blue
];

const BG = '#0D1428';

let elements = [];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  noLoop();
  generate();
}

function pickColor() {
  const r = random();
  if (r < 0.65) return random(WARM);
  if (r < 0.90) return random(COOL);
  return random(DARKS);
}

function generate() {
  elements = [];

  // Layer 0: Large background blocks — set color zones, high opacity
  for (let i = 0; i < 10; i++) {
    elements.push({
      type: random(['circle', 'rect']),
      x: random(-W * 0.05, W * 1.05),
      y: random(-H * 0.05, H * 1.05),
      w: random(250, 500),
      h: random(250, 500),
      col: random(WARM),
      alpha: random(180, 240),
      rot: random(-PI, PI),
      layer: 0,
    });
  }

  // Layer 1: Broad curved ribbons — sweeping color bands
  for (let i = 0; i < 10; i++) {
    elements.push(makeRibbon(
      random(-50, W + 50), random(-50, H + 50),
      floor(random(3, 6)),
      random(40, 120),
      pickColor(),
      random(180, 240),
      1,
    ));
  }

  // Layer 2: Medium shapes — dense fill
  for (let i = 0; i < 35; i++) {
    const isCircle = random() < 0.5;
    const sz = random(50, 180);
    elements.push({
      type: isCircle ? 'circle' : 'rect',
      x: random(-20, W + 20),
      y: random(-20, H + 20),
      w: sz,
      h: isCircle ? sz : random(50, 180),
      col: pickColor(),
      alpha: random(190, 255),
      rot: random(-PI, PI),
      layer: 2,
    });
  }

  // Layer 3: Upper ribbons — thinner, on top
  for (let i = 0; i < 8; i++) {
    elements.push(makeRibbon(
      random(-30, W + 30), random(-30, H + 30),
      floor(random(2, 4)),
      random(25, 70),
      pickColor(),
      random(180, 230),
      3,
    ));
  }

  // Layer 4: Prominent circles — the bold dots from the reference
  for (let i = 0; i < 18; i++) {
    const sz = random(30, 110);
    elements.push({
      type: 'circle',
      x: random(W),
      y: random(H),
      w: sz,
      h: sz,
      col: pickColor(),
      alpha: random(210, 255),
      rot: 0,
      layer: 4,
    });
  }

  // Layer 5: Accent rectangles
  for (let i = 0; i < 18; i++) {
    elements.push({
      type: 'rect',
      x: random(W),
      y: random(H),
      w: random(20, 90),
      h: random(20, 90),
      col: pickColor(),
      alpha: random(200, 255),
      rot: random(-PI, PI),
      layer: 5,
    });
  }

  // Layer 6: Tiny vivid dots — visual rhythm
  for (let i = 0; i < 25; i++) {
    const sz = random(6, 28);
    elements.push({
      type: 'circle',
      x: random(W),
      y: random(H),
      w: sz,
      h: sz,
      col: pickColor(),
      alpha: 255,
      rot: 0,
      layer: 6,
    });
  }

  // Layer 7: Arc segments — half-circles and wedges
  for (let i = 0; i < 12; i++) {
    elements.push({
      type: 'arc',
      x: random(W),
      y: random(H),
      w: random(60, 200),
      h: random(60, 200),
      col: pickColor(),
      alpha: random(200, 255),
      arcStart: random(TWO_PI),
      arcSpan: random(PI * 0.4, PI * 1.4),
      rot: random(-PI, PI),
      layer: 7,
    });
  }

  elements.sort((a, b) => a.layer - b.layer);
  redraw();
}

function makeRibbon(sx, sy, segs, thickness, col, alpha, layer) {
  const points = [];
  let cx = sx;
  let cy = sy;
  for (let j = 0; j < segs; j++) {
    const spread = random(120, 250);
    points.push({
      cp1x: cx + random(-spread, spread),
      cp1y: cy + random(-spread, spread),
      cp2x: cx + random(-spread, spread),
      cp2y: cy + random(-spread, spread),
      ex: cx + random(-spread, spread),
      ey: cy + random(-spread, spread),
    });
    cx = points[j].ex;
    cy = points[j].ey;
  }
  return { type: 'ribbon', startX: sx, startY: sy, points, thickness, col, alpha, layer };
}

function draw() {
  background(BG);

  for (const el of elements) {
    push();

    if (el.type === 'ribbon') {
      drawRibbon(el);
      pop();
      continue;
    }

    const c = color(el.col);
    c.setAlpha(el.alpha);
    noStroke();
    fill(c);
    translate(el.x, el.y);
    rotate(el.rot);

    switch (el.type) {
      case 'circle':
        ellipse(0, 0, el.w, el.h);
        break;
      case 'rect':
        rectMode(CENTER);
        rect(0, 0, el.w, el.h);
        break;
      case 'arc':
        arc(0, 0, el.w, el.h, el.arcStart, el.arcStart + el.arcSpan);
        break;
    }

    pop();
  }

  // Frame / moldura
  drawFrame();
}

function drawRibbon(el) {
  const c = color(el.col);
  c.setAlpha(el.alpha);
  noStroke();
  fill(c);

  const steps = 80;
  const pts = computeBezierPoints(el.startX, el.startY, el.points, steps);
  if (pts.length < 2) return;

  const half = el.thickness / 2;
  const top = [];
  const bot = [];

  for (let i = 0; i < pts.length; i++) {
    let nx, ny;
    if (i < pts.length - 1) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      const len = sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const len = sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    }
    // Smooth thickness variation along the ribbon
    const t = i / pts.length;
    const wave = sin(t * PI) * 0.3 + 0.7;
    const offset = half * wave;
    top.push({ x: pts[i].x + nx * offset, y: pts[i].y + ny * offset });
    bot.push({ x: pts[i].x - nx * offset, y: pts[i].y - ny * offset });
  }

  beginShape();
  for (const p of top) vertex(p.x, p.y);
  for (let i = bot.length - 1; i >= 0; i--) vertex(bot[i].x, bot[i].y);
  endShape(CLOSE);
}

function computeBezierPoints(sx, sy, segs, totalSteps) {
  const pts = [];
  let cx = sx;
  let cy = sy;
  const stepsPerSeg = max(1, floor(totalSteps / segs.length));

  for (const seg of segs) {
    for (let i = 0; i <= stepsPerSeg; i++) {
      const t = i / stepsPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      pts.push({
        x: mt3 * cx + 3 * mt2 * t * seg.cp1x + 3 * mt * t2 * seg.cp2x + t3 * seg.ex,
        y: mt3 * cy + 3 * mt2 * t * seg.cp1y + 3 * mt * t2 * seg.cp2y + t3 * seg.ey,
      });
    }
    cx = seg.ex;
    cy = seg.ey;
  }
  return pts;
}

function drawFrame() {
  const t = 18; // frame thickness
  noStroke();
  fill(255);

  // Four border rectangles
  rect(0, 0, W, t);         // top
  rect(0, H - t, W, t);     // bottom
  rect(0, 0, t, H);         // left
  rect(W - t, 0, t, H);     // right

  // Subtle inner shadow
  noFill();
  stroke(0, 0, 0, 60);
  strokeWeight(2);
  rect(t, t, W - t * 2, H - t * 2);
}

function mousePressed() {
  generate();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('abstract-chaos', 'png');
  }
}
