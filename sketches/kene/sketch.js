/**
 * Kene
 *
 * Generative sacred geometry inspired by the kene patterns of the
 * Huni Kuin (Kaxinawa) people from Acre, Brazil. Rendered in the
 * vibrant palette of the MAHKU collective.
 *
 * The pattern weaves itself into existence line by line,
 * like a loom building sacred fabric.
 *
 * Part of the Acre Series.
 *
 * Controls:
 * - Click: Generate new pattern
 * - S: Save PNG
 * - Shift+S: Start/stop GIF recording
 */

const W = 800;
const H = 800;

// --- MAHKU-inspired palette ---
const PALETTE = [
  '#c0392b', // deep crimson
  '#2980b9', // rich blue
  '#f39c12', // warm gold
  '#27ae60', // forest green
  '#8e44ad', // deep purple
  '#f5e6ca', // cream white
  '#e74c3c', // bright red
  '#1abc9c', // teal
];
const BG_COLOR = '#0a0a12';

// --- Animation ---
const PHASE_WEAVING = 0;
const PHASE_DONE = 1;
let phase = PHASE_WEAVING;
let revealRow = 0;
const REVEAL_SPEED = 5; // pixel rows per frame

// --- Pattern buffer ---
let patternBuffer;

// --- Band data ---
let bands = [];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  frameRate(30);
  patternBuffer = createGraphics(W, H);
  patternBuffer.pixelDensity(2);
  generatePattern();
}

function generatePattern() {
  phase = PHASE_WEAVING;
  revealRow = 0;
  bands = [];

  patternBuffer.background(BG_COLOR);

  // Will be filled by later tasks:
  // generateBands() — divide into horizontal bands
  // For each band, draw its motif into patternBuffer
  // Mirror left half to right half
}

function draw() {
  background(BG_COLOR);

  if (phase === PHASE_WEAVING) {
    revealRow = min(revealRow + REVEAL_SPEED, H);
    if (revealRow >= H) {
      phase = PHASE_DONE;
    }
  }

  // Show only the revealed portion of the pattern
  if (revealRow > 0) {
    image(patternBuffer, 0, 0, W, revealRow, 0, 0, W, revealRow);
  }
}

function mousePressed() {
  generatePattern();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('kene', 'png');
  }
}
