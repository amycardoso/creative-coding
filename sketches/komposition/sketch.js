/**
 * Komposition
 *
 * Generative geometric abstraction — bold overlapping shapes,
 * vivid colors, and dynamic composition. Each click births
 * a new arrangement. Inspired by Kandinsky, Mondrian, and
 * modern geometric art.
 *
 * Controls:
 * - Click to generate a new composition
 * - Press S to save PNG
 */

const W = 800;
const H = 800;

// Curated palettes — every color pops against dark background
const PALETTES = [
  ['#E63946', '#457B9D', '#FFD166', '#F1FAEE', '#A8DADC'],
  ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#8338EC'],
  ['#F77F00', '#FCBF49', '#D62828', '#4361EE', '#F1FAEE'],
  ['#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#90BE6D'],
  ['#D00000', '#FFBA08', '#3F88C5', '#F7F7FF', '#8338EC'],
];

const BG_DARK = '#0D1B2A';

let elements = [];
let pal = [];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  frameRate(30);
  generate();
}

// ---------- composition generator ----------

function generate() {
  elements = [];
  pal = random(PALETTES);

  // 1. Background blocks — large, tinted, set the tone
  for (let i = 0; i < 4; i++) {
    elements.push(makeShape({
      type: random(['circle', 'rect']),
      x: biasedRandom(W),
      y: biasedRandom(H),
      w: random(250, 500),
      h: random(250, 500),
      col: randomPal(),
      alpha: random(40, 80),
      filled: true,
      sw: 0,
      rot: random(-0.4, 0.4),
      cornerR: 0,
      layer: 0,
    }));
  }

  // 2. Primary shapes — bold, dense, overlapping
  for (let i = 0; i < 10; i++) {
    const isFilled = random() > 0.25;
    const hasStroke = isFilled ? random() > 0.4 : true;
    elements.push(makeShape({
      type: random(['circle', 'rect', 'triangle', 'semicircle']),
      x: biasedRandom(W),
      y: biasedRandom(H),
      w: random(60, 240),
      h: random(60, 240),
      col: randomPal(),
      alpha: random(230, 255),
      filled: isFilled,
      sw: hasStroke ? random(3, 10) : 0,
      scol: random() > 0.5 ? BG_DARK : randomPal(),
      rot: random(-0.7, 0.7),
      cornerR: random() > 0.7 ? random(6, 14) : 0,
      layer: 1,
    }));
  }

  // 3. Lines — compositional tension
  for (let i = 0; i < 6; i++) {
    elements.push({
      type: 'line',
      x1: random(W), y1: random(H),
      x2: random(W), y2: random(H),
      col: randomPal(),
      alpha: random(100, 220),
      sw: random(2, 6),
      layer: 2,
      phase: random(TWO_PI),
    });
  }

  // 4. Concentric rings — Kandinsky signature motif
  const ringCount = floor(random(2, 5));
  for (let i = 0; i < ringCount; i++) {
    const cx = biasedRandom(W);
    const cy = biasedRandom(H);
    const base = random(70, 180);
    const ringGap = random(25, 45);
    const depth = floor(random(2, 5));
    for (let j = 0; j < depth; j++) {
      elements.push(makeShape({
        type: 'ring',
        x: cx, y: cy,
        w: base * 2 - j * ringGap,
        col: pal[(i + j) % pal.length],
        alpha: random(200, 255),
        sw: random(3, 7),
        layer: 3,
      }));
    }
  }

  // 5. Secondary smaller shapes — fill gaps
  for (let i = 0; i < 6; i++) {
    const isFilled = random() > 0.4;
    elements.push(makeShape({
      type: random(['circle', 'rect', 'triangle']),
      x: random(W),
      y: random(H),
      w: random(25, 70),
      h: random(25, 70),
      col: randomPal(),
      alpha: random(200, 255),
      filled: isFilled,
      sw: isFilled ? 0 : random(2, 5),
      rot: random(-1, 1),
      cornerR: 0,
      layer: 4,
    }));
  }

  // 6. Accent dots — visual rhythm and sparkle
  for (let i = 0; i < 20; i++) {
    elements.push(makeShape({
      type: 'dot',
      x: random(W),
      y: random(H),
      w: random(4, 22),
      col: randomPal(),
      alpha: random(180, 255),
      layer: 5,
    }));
  }

  // sort by layer
  elements.sort((a, b) => a.layer - b.layer);
}

function makeShape(opts) {
  return {
    ...opts,
    phase: random(TWO_PI),
    rotSpeed: random(-0.003, 0.003),
    driftAmpX: random(1.5, 5),
    driftAmpY: random(1, 3.5),
  };
}

/** Biased random — favors center with some spread to edges */
function biasedRandom(range) {
  const center = range / 2;
  const spread = range * 0.42;
  return constrain(randomGaussian(center, spread), -range * 0.1, range * 1.1);
}

function randomPal() {
  return pal[floor(random(pal.length))];
}

// ---------- draw loop ----------

function draw() {
  background(BG_DARK);
  const t = frameCount * 0.008;

  for (const el of elements) {
    drawElement(el, t);
  }
}

function drawElement(el, t) {
  push();
  const c = color(el.col);

  // -- line
  if (el.type === 'line') {
    c.setAlpha(el.alpha);
    stroke(c);
    strokeWeight(el.sw);
    line(el.x1, el.y1, el.x2, el.y2);
    pop();
    return;
  }

  // -- dot
  if (el.type === 'dot') {
    c.setAlpha(el.alpha);
    fill(c);
    noStroke();
    const pulse = sin(t * 2 + el.phase) * 2;
    circle(el.x, el.y, el.w + pulse);
    pop();
    return;
  }

  // -- ring
  if (el.type === 'ring') {
    c.setAlpha(el.alpha);
    noFill();
    stroke(c);
    strokeWeight(el.sw);
    translate(el.x, el.y);
    rotate(t * (el.rotSpeed || 0) * 5);
    circle(0, 0, el.w);
    pop();
    return;
  }

  // -- shapes with animation
  const drift = sin(t + el.phase);
  translate(
    el.x + drift * (el.driftAmpX || 2),
    el.y + drift * 0.7 * (el.driftAmpY || 1.5)
  );
  rotate((el.rot || 0) + t * (el.rotSpeed || 0) * 5);

  // fill + stroke
  if (el.filled) {
    c.setAlpha(el.alpha);
    fill(c);
    if (el.sw > 0) {
      const sc = color(el.scol || BG_DARK);
      sc.setAlpha(min(el.alpha + 30, 255));
      stroke(sc);
      strokeWeight(el.sw);
    } else {
      noStroke();
    }
  } else {
    noFill();
    c.setAlpha(el.alpha);
    stroke(c);
    strokeWeight(el.sw || 3);
  }

  switch (el.type) {
    case 'circle':
      ellipse(0, 0, el.w, el.h || el.w);
      break;
    case 'rect':
      rectMode(CENTER);
      rect(0, 0, el.w, el.h || el.w, el.cornerR || 0);
      break;
    case 'triangle': {
      const s = el.w;
      triangle(0, -s / 2, -s / 2, s / 2, s / 2, s / 2);
      break;
    }
    case 'semicircle':
      arc(0, 0, el.w, el.h || el.w, 0, PI, CHORD);
      break;
  }

  pop();
}

// ---------- interaction ----------

function mousePressed() {
  generate();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('komposition', 'png');
  }
}
