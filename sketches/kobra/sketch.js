/**
 * Kobra — Voronoi Mosaic Portrait
 *
 * Generative Eduardo Kobra-style mosaic portrait.
 * A reference image provides facial structure;
 * Voronoi tessellation with kaleidoscopic colors
 * transforms it into a street-mural aesthetic.
 */

const W = 600;
const H = 800;

let refImg;

function preload() {
  refImg = loadImage('reference.png');
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  noLoop();
}

function draw() {
  background(200);
  // Placeholder — draw reference image to verify it loads
  image(refImg, 0, 0, W, H);
}

function mousePressed() {
  redraw();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('kobra', 'png');
  }
}
