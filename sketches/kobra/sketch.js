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

function computeVoronoi(seeds) {
  let delaunay = d3.Delaunay.from(seeds);
  let voronoi = delaunay.voronoi([0, 0, W, H]);
  return voronoi;
}

function assignColors(count) {
  let hues = [];
  for (let i = 0; i < count; i++) {
    let hue;
    let attempts = 0;
    do {
      hue = random(360);
      attempts++;
    } while (attempts < 10 && hues.length > 0 && abs(hue - hues[hues.length - 1]) < 30);
    hues.push(hue);
  }
  return hues;
}

function generatePaintBands() {
  let bands = [];
  let numBands = floor(random(2, 4)); // 2-3 bands

  let families = [
    [0, 30],     // warm reds/oranges
    [200, 240],  // cool blues
    [100, 140],  // greens
    [270, 310],  // purples
    [40, 70],    // yellows/golds
  ];

  shuffle(families, true);

  for (let i = 0; i < numBands; i++) {
    let angle = random(-PI / 6, PI / 6);
    let yCenter = map(i, 0, numBands, H * 0.2, H * 0.8);
    yCenter += random(-40, 40);
    let bandWidth = random(40, 80);
    bands.push({
      angle: angle,
      yCenter: yCenter,
      width: bandWidth,
      hueRange: families[i],
    });
  }

  return bands;
}

function getHueForCell(sx, sy, baseHue, bands) {
  for (let band of bands) {
    let dx = sx - W / 2;
    let dy = sy - H / 2;
    let rotY = -dx * sin(band.angle) + dy * cos(band.angle) + H / 2;
    if (abs(rotY - band.yCenter) < band.width / 2) {
      return random(band.hueRange[0], band.hueRange[1]);
    }
  }
  return baseHue;
}

function renderMosaic(seeds, voronoi, bands) {
  colorMode(HSB, 360, 100, 100);

  let hues = assignColors(seeds.length);

  for (let i = 0; i < seeds.length; i++) {
    let cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    // Check if seed is inside silhouette
    let sx = floor(seeds[i][0]);
    let sy = floor(seeds[i][1]);
    if (sy < 0 || sy >= H || sx < 0 || sx >= W) continue;
    if (!silhouetteMask[sy] || !silhouetteMask[sy][sx]) continue;

    // Determine outline weight based on edge proximity
    let edge = (edgeMap[sy] && edgeMap[sy][sx]) ? edgeMap[sy][sx] : 0;
    let sw = map(edge, 0, 0.5, 1.5, 4);
    sw = constrain(sw, 1.5, 4);

    let cellHue = getHueForCell(sx, sy, hues[i], bands);
    fill(cellHue, random(75, 100), random(80, 100));
    stroke(20, 10, 10);
    strokeWeight(sw);

    beginShape();
    for (let j = 0; j < cell.length; j++) {
      vertex(cell[j][0], cell[j][1]);
    }
    endShape(CLOSE);
  }

  colorMode(RGB, 255);
}

function renderSprayEdge() {
  for (let i = 0; i < 2000; i++) {
    let x = floor(random(W));
    let y = floor(random(H));

    // Only process near silhouette boundary
    let inside = silhouetteMask[y] && silhouetteMask[y][x];
    let neighbors = 0;
    let total = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        let ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
          total++;
          if (silhouetteMask[ny] && silhouetteMask[ny][nx]) neighbors++;
        }
      }
    }
    let ratio = neighbors / total;
    // Near boundary: ratio is between 0.2 and 0.8
    if (ratio > 0.2 && ratio < 0.8) {
      let alpha = map(ratio, 0.2, 0.8, 20, 80);
      if (!inside) alpha *= 0.5;
      colorMode(HSB, 360, 100, 100, 255);
      noStroke();
      fill(random(360), random(70, 100), random(80, 100), alpha);
      circle(x, y, random(1, 4));
    }
  }
  colorMode(RGB, 255);
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
  let seeds = generateSeeds();
  let voronoi = computeVoronoi(seeds);
  let bands = generatePaintBands();
  renderMosaic(seeds, voronoi, bands);
  renderSprayEdge();
}

function mousePressed() {
  noiseSeed(floor(random(99999)));
  redraw();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('kobra', 'png');
  }
}
