/**
 * Kobra — Voronoi Mosaic Portrait
 *
 * Generative Eduardo Kobra-style mosaic portrait.
 * A reference image provides facial structure;
 * Voronoi tessellation with bold spray paint colors
 * creates geometric color blocks like real Kobra murals.
 *
 * Controls:
 * - Click: Generate new composition
 * - S: Save PNG
 */

const W = 600;
const H = 800;
const NUM_SEEDS = 600;
const BORDER_SEEDS = 120;

// Kobra spray paint palettes — bold, vivid, high-saturation colors
const PALETTES = [
  { // Classic Kobra — full rainbow, maximum impact
    name: 'classic',
    colors: [
      [0, 90, 88],    // Kobra Red
      [330, 85, 90],   // Magenta / Fuchsia
      [50, 95, 100],   // Kobra Yellow
      [25, 95, 95],    // Kobra Orange
      [210, 90, 80],   // Kobra Blue
      [120, 85, 65],   // Bold Green
      [270, 75, 75],   // Violet
      [180, 80, 70],   // Turquoise
    ],
  },
  { // Warm Mural — reds, oranges, yellows, magentas
    name: 'warm',
    colors: [
      [0, 90, 85],    [355, 85, 90],
      [15, 95, 95],   [30, 95, 100],
      [50, 95, 100],  [45, 90, 95],
      [330, 80, 85],  [310, 75, 80],
    ],
  },
  { // Cool Mural — blues, teals, greens, purples
    name: 'cool',
    colors: [
      [210, 90, 80],  [225, 85, 75],
      [180, 85, 70],  [165, 80, 75],
      [120, 80, 70],  [140, 75, 65],
      [270, 70, 80],  [285, 65, 75],
    ],
  },
  { // Tropical — greens, yellows, oranges, reds
    name: 'tropical',
    colors: [
      [120, 85, 70],  [100, 80, 80],
      [50, 95, 100],  [60, 90, 90],
      [25, 95, 95],   [15, 90, 90],
      [0, 90, 85],    [345, 85, 80],
    ],
  },
  { // Cosmic — purples, blues, magentas, teals
    name: 'cosmic',
    colors: [
      [270, 80, 78],  [255, 75, 82],
      [210, 85, 85],  [195, 80, 78],
      [330, 85, 88],  [340, 80, 85],
      [180, 80, 72],  [165, 75, 78],
    ],
  },
];

let refImg;
let lineBuffer;
let currentPalette;

let brightnessMap;
let silhouetteMask;
let edgeMap;

function preload() {
  refImg = loadImage('reference.jpg');
}

function generateLineBuffer() {
  lineBuffer = createGraphics(W, H);
  lineBuffer.pixelDensity(2);
  lineBuffer.clear();
  lineBuffer.noStroke();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let br = brightnessMap[y][x];
      if (br < 0.12) {
        let alpha = map(br, 0, 0.12, 200, 30);
        let sz = map(br, 0, 0.12, 2.5, 0.5);
        lineBuffer.fill(5, 5, 2, alpha);
        lineBuffer.circle(x, y, sz);
      }
    }
  }
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
  let dilated = [];
  let radius = 5;
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
  let attempts = 0;
  let maxAttempts = NUM_SEEDS * 40;

  while (seeds.length < NUM_SEEDS && attempts < maxAttempts) {
    let x = floor(random(W));
    let y = floor(random(H));
    attempts++;

    if (!silhouetteMask[y] || !silhouetteMask[y][x]) continue;

    let br = brightnessMap[y][x];
    let edge = (edgeMap[y] && edgeMap[y][x]) ? edgeMap[y][x] : 0;
    // Strong edge weighting — dense small cells on features, large ones on flat areas
    let prob = (1 - br) * 0.15 + edge * 25;
    prob = constrain(prob, 0.01, 1.0);

    if (random() < prob) {
      seeds.push([x, y]);
    }
  }

  let faceSeedCount = seeds.length;

  // Border seeds just outside silhouette
  let placed = 0;
  for (let a = 0; a < BORDER_SEEDS * 50 && placed < BORDER_SEEDS; a++) {
    let x = floor(random(W));
    let y = floor(random(H));
    if (silhouetteMask[y] && silhouetteMask[y][x]) continue;
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
      placed++;
    }
  }

  return { seeds, faceSeedCount };
}

function assignColors(seeds) {
  let colors = [];
  let colorScale = 0.006;
  let colorSeed = random(1000);
  let paletteColors = currentPalette.colors;

  for (let i = 0; i < seeds.length; i++) {
    let sx = seeds[i][0];
    let sy = seeds[i][1];
    let n = noise(sx * colorScale + colorSeed, sy * colorScale);
    let idx = floor(n * paletteColors.length);
    idx = constrain(idx, 0, paletteColors.length - 1);
    let base = paletteColors[idx];
    let h = (base[0] + random(-10, 10) + 360) % 360;
    let s = base[1] + random(-5, 5);
    let b = base[2] + random(-5, 5);
    colors.push([h, constrain(s, 65, 100), constrain(b, 60, 100)]);
  }
  return colors;
}

function renderMosaic(seeds, delaunay, colors, faceSeedCount) {
  colorMode(HSB, 360, 100, 100);
  let voronoi = delaunay.voronoi([0, 0, W, H]);

  // Render all seeds (face + border) — border cells fill edge gaps
  for (let i = 0; i < seeds.length; i++) {
    let cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    // Border seeds get a nearby face color
    let col = colors[i];
    if (i >= faceSeedCount) {
      // For border cells, use a darkened version of a random palette color
      let pc = currentPalette.colors[floor(random(currentPalette.colors.length))];
      col = [pc[0], pc[1] * 0.6, pc[2] * 0.4];
    }

    fill(col[0], col[1], col[2]);
    stroke(0, 0, 5);
    strokeWeight(1.2);
    strokeJoin(MITER);

    beginShape();
    for (let j = 0; j < cell.length; j++) {
      vertex(cell[j][0], cell[j][1]);
    }
    endShape(CLOSE);
  }

  colorMode(RGB, 255);
}

function renderSprayEdge() {
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();
  let paletteColors = currentPalette.colors;

  for (let i = 0; i < 2500; i++) {
    let x = floor(random(W));
    let y = floor(random(H));

    let inside = silhouetteMask[y] && silhouetteMask[y][x];
    let neighbors = 0;
    let total = 0;
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        let ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
          total++;
          if (silhouetteMask[ny] && silhouetteMask[ny][nx]) neighbors++;
        }
      }
    }
    let ratio = neighbors / total;
    if (ratio > 0.1 && ratio < 0.9) {
      let alpha = map(abs(ratio - 0.5), 0, 0.4, 50, 5);
      if (!inside) alpha *= 0.3;
      let pc = paletteColors[floor(random(paletteColors.length))];
      fill(pc[0] + random(-15, 15), pc[1], pc[2], alpha);
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
  generateLineBuffer();
  currentPalette = random(PALETTES);
  noLoop();
}

function draw() {
  background(10);
  let result = generateSeeds();
  let seeds = result.seeds;
  let faceSeedCount = result.faceSeedCount;
  let delaunay = d3.Delaunay.from(seeds);
  let colors = assignColors(seeds);
  renderMosaic(seeds, delaunay, colors, faceSeedCount);
  image(lineBuffer, 0, 0);
  renderSprayEdge();
}

function mousePressed() {
  currentPalette = random(PALETTES);
  redraw();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('kobra', 'png');
  }
}
