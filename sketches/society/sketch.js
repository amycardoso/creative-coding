/**
 * Society
 *
 * Inspired by Eddie Vedder's "Society."
 * Why is every person so bad to each other so often?
 *
 * Abstract particle field — communities form and get torn apart.
 * The canvas accumulates scars. Nothing heals. Nothing is learned.
 *
 * Controls: Press Shift+S to start/stop GIF recording
 */

P5Capture.setDefaultOptions({
  format: 'gif',
  framerate: 30,
  quality: 0.8,
  width: 600,
});

const CANVAS_SIZE = 600;

function setup() {
  pixelDensity(1);
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  canvas.parent('canvas-container');
  background(0);
}

function draw() {
  background(0);
}
