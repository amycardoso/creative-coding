/**
 * Dawn on the Trail
 *
 * A seringueiro's pre-dawn walk through the Amazon forest —
 * a headlamp reveals tapping scars and latex cups on rubber trees
 * as you journey along the estrada before sunrise.
 *
 * Part of the Acre Series — art about the seringueiro resistance.
 *
 * Controls:
 * - S: Save PNG
 * - Shift+S: Start/stop GIF recording
 */

const W = 800;
const H = 600;

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  frameRate(30);
  background(10, 15, 26);
}

function draw() {
  background(10, 15, 26);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('dawn-on-the-trail', 'png');
  }
}
