/**
 * Thaw
 *
 * Inspired by Into the Wild. A lone figure sits atop Bus 142
 * in a frozen wilderness. The world slowly transforms from
 * cold isolation to warmth — the figure never moves.
 *
 * "Happiness is only real when shared."
 *
 * Controls:
 * - S: Save PNG
 */

const W = 1080;
const H = 720;
const CYCLE_DURATION = 15; // seconds

// Cold palette
const COLD = {
  sky1: '#0a1628',
  sky2: '#1a2a44',
  mountain1: '#0d1f3a',
  mountain2: '#142844',
  mountain3: '#1a3050',
  tree: '#142840',
  ground: '#1a2a44',
  accent: '#8fa8c8',
};

// Warm palette
const WARM = {
  sky1: '#d4913a',
  sky2: '#c75c3a',
  mountain1: '#5a3a2a',
  mountain2: '#6a4a30',
  mountain3: '#7a5a38',
  tree: '#6a4a30',
  ground: '#8a6a40',
  accent: '#e8c468',
};

let particles = [];
let mountains = [];
let trees = [];
let stars = [];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(1);
  frameRate(30);
}

function draw() {
  const progress = getProgress();
  background(0);
}

function getProgress() {
  const t = (millis() / 1000 % CYCLE_DURATION) / CYCLE_DURATION;
  if (t < 0.33) return 0;
  if (t < 0.66) return map(t, 0.33, 0.66, 0, 1);
  return map(t, 0.66, 1.0, 1, 0);
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('thaw', 'png');
}
