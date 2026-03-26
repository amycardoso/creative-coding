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
const NUM_SEEDS = 500;

let refImg;
let wallBuffer;

let brightnessMap;
let silhouetteMask;
let edgeMap;

function preload() {
  refImg = loadImage('reference.png');
}

function generateWall() {
  wallBuffer = createGraphics(W, H);
  wallBuffer.pixelDensity(1);
  wallBuffer.loadPixels();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let gray = 190;
      gray += (noise(x * 0.02, y * 0.02) - 0.5) * 30;
      gray += (noise(x * 0.1 + 500, y * 0.1 + 500) - 0.5) * 15;

      if (noise(x * 0.5 + 1000, y * 0.5 + 1000) > 0.75) {
        gray -= 20;
      }

      gray = constrain(gray, 160, 220);

      const idx = (y * W + x) * 4;
      wallBuffer.pixels[idx] = gray;
      wallBuffer.pixels[idx + 1] = gray;
      wallBuffer.pixels[idx + 2] = gray;
      wallBuffer.pixels[idx + 3] = 255;
    }
  }

  wallBuffer.updatePixels();
}

function processReference() {
  refImg.resize(W, H);
  refImg.loadPixels();

  brightnessMap = [];
  silhouetteMask = [];

  for (let y = 0; y < H; y++) {
    brightnessMap[y] = [];
    silhouetteMask[y] = [];
    for (let x = 0; x < W; x++) {
      let idx = (y * W + x) * 4;
      let r = refImg.pixels[idx];
      let g = refImg.pixels[idx + 1];
      let b = refImg.pixels[idx + 2];
      let br = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      brightnessMap[y][x] = br;
      // The reference image has a pure black background.
      // Face pixels are significantly brighter than the background.
      silhouetteMask[y][x] = br > 0.08;
    }
  }
}

function computeEdges() {
  edgeMap = [];
  for (let y = 0; y < H; y++) {
    edgeMap[y] = [];
    for (let x = 0; x < W; x++) {
      if (y === 0 || y === H - 1 || x === 0 || x === W - 1) {
        edgeMap[y][x] = 0;
        continue;
      }
      let gx = brightnessMap[y][x + 1] - brightnessMap[y][x - 1];
      let gy = brightnessMap[y + 1][x] - brightnessMap[y - 1][x];
      edgeMap[y][x] = sqrt(gx * gx + gy * gy);
    }
  }
}

function generateSeeds() {
  let seeds = [];
  let attempts = 0;
  let maxAttempts = NUM_SEEDS * 20;

  while (seeds.length < NUM_SEEDS && attempts < maxAttempts) {
    let x = floor(random(W));
    let y = floor(random(H));
    attempts++;

    // Skip pixels outside silhouette
    if (!silhouetteMask[y] || !silhouetteMask[y][x]) continue;

    // Acceptance probability based on brightness and edges
    // Darker pixels (lower brightness) → higher chance → denser cells
    let br = brightnessMap[y][x];
    let edge = (edgeMap[y] && edgeMap[y][x]) ? edgeMap[y][x] : 0;
    // Combine: darker areas + high-edge areas get more points
    let prob = (1 - br) * 0.7 + edge * 5;
    prob = constrain(prob, 0.05, 1.0);

    if (random() < prob) {
      seeds.push([x, y]);
    }
  }

  return seeds;
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(2);
  processReference();
  computeEdges();
  noiseSeed(floor(random(99999)));
  generateWall();
  noLoop();
}

function draw() {
  image(wallBuffer, 0, 0);
}

function mousePressed() {
  redraw();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('kobra', 'png');
  }
}
