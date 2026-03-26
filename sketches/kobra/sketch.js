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
const NUM_SEEDS = 500;
const BORDER_SEEDS = 200;

// Curated Kobra palettes — sophisticated color harmonies
const PALETTES = [
  { // Sunset warmth
    name: 'sunset',
    colors: [
      [10, 85, 92],  [25, 80, 95],  [45, 75, 98],  // warm oranges/golds
      [340, 70, 85], [355, 65, 90], [320, 55, 88],  // rose/magentas
      [190, 60, 75], [210, 65, 80],                  // cool accent teals
    ],
  },
  { // Ocean depths
    name: 'ocean',
    colors: [
      [200, 75, 85], [215, 80, 78], [230, 70, 90],  // blues
      [170, 65, 80], [185, 70, 75], [160, 55, 88],  // teals/cyans
      [280, 50, 82], [310, 45, 85],                  // purple/violet accents
    ],
  },
  { // Tropical forest
    name: 'tropical',
    colors: [
      [120, 65, 75], [140, 70, 80], [95, 60, 85],   // greens
      [50, 80, 95],  [35, 75, 90],  [65, 70, 88],   // yellows/golds
      [0, 70, 85],   [350, 60, 80],                  // red accents
    ],
  },
  { // Jewel tones
    name: 'jewel',
    colors: [
      [270, 65, 78], [290, 60, 82], [250, 70, 75],  // amethyst/purple
      [340, 70, 80], [355, 65, 85], [15, 75, 88],   // ruby/garnet
      [170, 60, 70], [195, 55, 78],                  // emerald accents
    ],
  },
  { // Earth & sky
    name: 'earth',
    colors: [
      [25, 60, 70],  [35, 55, 75],  [15, 50, 65],   // warm earth browns
      [200, 50, 80], [215, 55, 85], [190, 45, 78],   // sky blues
      [45, 70, 90],  [55, 65, 85],                   // golden accents
    ],
  },
];

let refImg;
let wallBuffer;
let lineBuffer;
let currentPalette;

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
      let gray = 185;
      gray += (noise(x * 0.015, y * 0.015) - 0.5) * 35;
      gray += (noise(x * 0.08 + 500, y * 0.08 + 500) - 0.5) * 18;
      // Subtle warm tint
      let r = gray + 3;
      let g = gray + 1;
      let b = gray - 2;

      if (noise(x * 0.5 + 1000, y * 0.5 + 1000) > 0.72) {
        r -= 15; g -= 15; b -= 12;
      }

      const idx = (y * W + x) * 4;
      wallBuffer.pixels[idx] = constrain(r, 150, 215);
      wallBuffer.pixels[idx + 1] = constrain(g, 148, 213);
      wallBuffer.pixels[idx + 2] = constrain(b, 146, 210);
      wallBuffer.pixels[idx + 3] = 255;
    }
  }

  wallBuffer.updatePixels();
}

function generateLineBuffer() {
  lineBuffer = createGraphics(W, H);
  lineBuffer.pixelDensity(2);
  lineBuffer.clear();
  lineBuffer.noStroke();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let br = brightnessMap[y][x];
      if (br < 0.18) {
        let alpha = map(br, 0, 0.18, 240, 60);
        let sz = map(br, 0, 0.18, 2.8, 0.8);
        lineBuffer.fill(10, 8, 5, alpha);
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
  let maxAttempts = NUM_SEEDS * 30;

  while (seeds.length < NUM_SEEDS && attempts < maxAttempts) {
    let x = floor(random(W));
    let y = floor(random(H));
    attempts++;

    if (!silhouetteMask[y] || !silhouetteMask[y][x]) continue;

    let br = brightnessMap[y][x];
    let edge = (edgeMap[y] && edgeMap[y][x]) ? edgeMap[y][x] : 0;
    let prob = (1 - br) * 0.4 + edge * 10;
    prob = constrain(prob, 0.03, 1.0);

    if (random() < prob) {
      seeds.push([x, y]);
      isFaceSeed.push(true);
    }
  }

  let placed = 0;
  for (let a = 0; a < BORDER_SEEDS * 50 && placed < BORDER_SEEDS; a++) {
    let x = floor(random(W));
    let y = floor(random(H));
    let inside = silhouetteMask[y] && silhouetteMask[y][x];
    if (inside) continue;
    let nearFace = false;
    for (let dy = -6; dy <= 6; dy += 3) {
      for (let dx = -6; dx <= 6; dx += 3) {
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

function assignColors(seeds) {
  // Use spatial Perlin noise to pick from the curated palette
  // Creates smooth color zones with sophisticated harmonies
  let colors = [];
  let colorScale = 0.007;
  let colorSeed = random(1000);
  let paletteColors = currentPalette.colors;

  for (let i = 0; i < seeds.length; i++) {
    let sx = seeds[i][0];
    let sy = seeds[i][1];
    // Spatial noise picks a palette color index
    let n = noise(sx * colorScale + colorSeed, sy * colorScale);
    let idx = floor(n * paletteColors.length);
    idx = constrain(idx, 0, paletteColors.length - 1);
    let base = paletteColors[idx];
    // Subtle variation around the palette color
    let h = (base[0] + random(-12, 12) + 360) % 360;
    let s = base[1] + random(-8, 8);
    let b = base[2] + random(-8, 8);
    colors.push([h, constrain(s, 40, 100), constrain(b, 50, 100)]);
  }
  return colors;
}

function generatePaintBands() {
  let bands = [];
  let numBands = floor(random(2, 4));

  // Bands use colors from the current palette for cohesion
  let paletteColors = currentPalette.colors;
  let bandIndices = [];
  for (let i = 0; i < numBands; i++) {
    bandIndices.push(floor(random(paletteColors.length)));
  }

  for (let i = 0; i < numBands; i++) {
    let baseColor = paletteColors[bandIndices[i]];
    let angle = random(-PI / 6, PI / 6);
    let yCenter = map(i, 0, numBands, H * 0.15, H * 0.85);
    yCenter += random(-50, 50);
    let bandWidth = random(60, 120);
    bands.push({
      angle: angle,
      yCenter: yCenter,
      width: bandWidth,
      hueRange: [baseColor[0] - 15, baseColor[0] + 15],
      baseSat: baseColor[1],
      baseBri: baseColor[2],
    });
  }

  return bands;
}

function getColorForCell(sx, sy, baseColor, bands) {
  for (let band of bands) {
    let dx = sx - W / 2;
    let dy = sy - H / 2;
    let rotY = -dx * sin(band.angle) + dy * cos(band.angle) + H / 2;
    if (abs(rotY - band.yCenter) < band.width / 2) {
      let h = (random(band.hueRange[0], band.hueRange[1]) + 360) % 360;
      let s = band.baseSat + random(-10, 10);
      let b = band.baseBri + random(-10, 10);
      return [h, constrain(s, 40, 100), constrain(b, 50, 100)];
    }
  }
  return baseColor;
}

function renderMosaic(seeds, isFaceSeed, voronoi, bands) {
  colorMode(HSB, 360, 100, 100);

  let colors = assignColors(seeds);

  for (let i = 0; i < seeds.length; i++) {
    if (!isFaceSeed[i]) continue;

    let cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    let sx = floor(seeds[i][0]);
    let sy = floor(seeds[i][1]);
    if (sy < 0 || sy >= H || sx < 0 || sx >= W) continue;
    if (!silhouetteMask[sy] || !silhouetteMask[sy][sx]) continue;

    let col = getColorForCell(sx, sy, colors[i], bands);
    fill(col[0], col[1], col[2]);
    stroke(12, 15, 8);
    strokeWeight(1.2);

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

  for (let i = 0; i < 3000; i++) {
    let x = floor(random(W));
    let y = floor(random(H));

    let inside = silhouetteMask[y] && silhouetteMask[y][x];
    let neighbors = 0;
    let total = 0;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        let ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
          total++;
          if (silhouetteMask[ny] && silhouetteMask[ny][nx]) neighbors++;
        }
      }
    }
    let ratio = neighbors / total;
    if (ratio > 0.15 && ratio < 0.85) {
      let alpha = map(abs(ratio - 0.5), 0, 0.35, 60, 10);
      if (!inside) alpha *= 0.4;
      // Use palette colors for spray too
      let pc = paletteColors[floor(random(paletteColors.length))];
      fill(pc[0] + random(-15, 15), pc[1], pc[2], alpha);
      circle(x, y, random(1, 5));
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
  generateLineBuffer();
  currentPalette = random(PALETTES);
  noLoop();
}

function draw() {
  image(wallBuffer, 0, 0);
  let { seeds, isFaceSeed } = generateSeeds();
  let voronoi = computeVoronoi(seeds);
  let bands = generatePaintBands();
  renderMosaic(seeds, isFaceSeed, voronoi, bands);
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
