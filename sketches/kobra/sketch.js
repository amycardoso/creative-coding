/**
 * Kobra — Voronoi Mosaic Portrait
 *
 * Generative Eduardo Kobra-style mosaic portrait.
 * A reference image provides facial structure;
 * Voronoi tessellation with kaleidoscopic colors
 * transforms it into a street-mural aesthetic.
 *
 * Controls:
 * - Click: Generate new composition
 * - S: Save PNG
 */

const W = 600;
const H = 800;
const NUM_SEEDS = 800;
const BORDER_SEEDS = 150;

let refImg;
let wallBuffer;

let brightnessMap;
let silhouetteMask;
let edgeMap;

function preload() {
  refImg = loadImage('reference.jpg');
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
      silhouetteMask[y][x] = br > 0.12;
    }
  }
}

function dilateSilhouette() {
  // Close line gaps in silhouette — any pixel near a bright pixel is also face
  let dilated = [];
  let radius = 4;
  for (let y = 0; y < H; y++) {
    dilated[y] = [];
    for (let x = 0; x < W; x++) {
      if (silhouetteMask[y][x]) {
        dilated[y][x] = true;
        continue;
      }
      let found = false;
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          let ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
            if (silhouetteMask[ny][nx]) found = true;
          }
        }
      }
      dilated[y][x] = found;
    }
  }
  silhouetteMask = dilated;
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
  let isFaceSeed = [];
  let attempts = 0;
  let maxAttempts = NUM_SEEDS * 20;

  // Face seeds — weighted by brightness and edges
  while (seeds.length < NUM_SEEDS && attempts < maxAttempts) {
    let x = floor(random(W));
    let y = floor(random(H));
    attempts++;

    if (!silhouetteMask[y] || !silhouetteMask[y][x]) continue;

    let br = brightnessMap[y][x];
    let edge = (edgeMap[y] && edgeMap[y][x]) ? edgeMap[y][x] : 0;
    let prob = (1 - br) * 0.5 + edge * 8;
    prob = constrain(prob, 0.02, 1.0);

    if (random() < prob) {
      seeds.push([x, y]);
      isFaceSeed.push(true);
    }
  }

  // Border seeds just outside silhouette boundary — tightly bounds face cells
  let placed = 0;
  for (let a = 0; a < BORDER_SEEDS * 50 && placed < BORDER_SEEDS; a++) {
    let x = floor(random(W));
    let y = floor(random(H));
    let inside = silhouetteMask[y] && silhouetteMask[y][x];
    if (inside) continue;
    // Check if any neighbor within 8px is inside the face
    let nearFace = false;
    for (let dy = -8; dy <= 8; dy += 4) {
      for (let dx = -8; dx <= 8; dx += 4) {
        let ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
          if (silhouetteMask[ny] && silhouetteMask[ny][nx]) {
            nearFace = true;
            break;
          }
        }
      }
      if (nearFace) break;
    }
    if (nearFace) {
      seeds.push([x, y]);
      isFaceSeed.push(false);
      placed++;
    }
  }

  return { seeds, isFaceSeed };
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
    let diff;
    let attempts = 0;
    do {
      hue = random(360);
      attempts++;
      diff = hues.length > 0 ? abs(hue - hues[hues.length - 1]) : 360;
      diff = min(diff, 360 - diff);
    } while (attempts < 10 && diff < 30);
    hues.push(hue);
  }
  return hues;
}

function generatePaintBands() {
  let bands = [];
  let numBands = floor(random(2, 4));

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

function renderMosaic(seeds, isFaceSeed, voronoi, bands) {
  colorMode(HSB, 360, 100, 100);

  let hues = assignColors(seeds.length);

  for (let i = 0; i < seeds.length; i++) {
    // Skip border seeds — they exist only to bound the Voronoi cells
    if (!isFaceSeed[i]) continue;

    let cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    let sx = floor(seeds[i][0]);
    let sy = floor(seeds[i][1]);
    if (sy < 0 || sy >= H || sx < 0 || sx >= W) continue;
    if (!silhouetteMask[sy] || !silhouetteMask[sy][sx]) continue;

    // Thin uniform cell outlines — line art handles feature definition
    let sw = 1;

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

function renderLineArt() {
  // Overlay the coloring book's bold lines on top of the mosaic
  noStroke();
  fill(15);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let br = brightnessMap[y][x];
      if (br < 0.18) {
        let sz = map(br, 0, 0.18, 2.5, 1);
        circle(x, y, sz);
      }
    }
  }
}

function renderSprayEdge() {
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();
  for (let i = 0; i < 2000; i++) {
    let x = floor(random(W));
    let y = floor(random(H));

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
    if (ratio > 0.2 && ratio < 0.8) {
      let alpha = map(ratio, 0.2, 0.8, 20, 80);
      if (!inside) alpha *= 0.5;
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
  dilateSilhouette();
  computeEdges();
  noiseSeed(floor(random(99999)));
  generateWall();
  noLoop();
}

function draw() {
  image(wallBuffer, 0, 0);
  let { seeds, isFaceSeed } = generateSeeds();
  let voronoi = computeVoronoi(seeds);
  let bands = generatePaintBands();
  renderMosaic(seeds, isFaceSeed, voronoi, bands);
  renderLineArt();
  renderSprayEdge();
}

function mousePressed() {
  redraw();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('kobra', 'png');
  }
}
