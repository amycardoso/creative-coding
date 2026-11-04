/**
 * Arena
 *
 * Jogos Vorazes #2.
 *
 * Twenty-four Voronoi seeds share a circular territory: every point of the
 * ground belongs to the nearest seed. The circle shrinks and the seeds drift
 * inward, so the borders are always moving. At the end of each round the
 * seed with the smallest territory disappears and its neighbours absorb
 * the space. The border of every round is engraved on top of the previous
 * ones, darker as the field narrows, so the picture is the history of the
 * contest: concentric walls on the outside, a thicket of crossed borders
 * where the last ones fought. The survivor is marked in ember, then the
 * plate is cleared.
 *
 * ?seed=N fixes the first arena (the GIF uses seed 3).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new arena
 */

const W = 800, H = 800;
const PAPER = [236, 228, 212], INK = [28, 24, 22], EMBER = [214, 72, 28];
let paperImg, seed;

function pickSeed() {
  const p = new URLSearchParams(location.search);
  return p.has('seed') ? parseInt(p.get('seed'), 10) : Math.floor(Math.random() * 1e6);
}

function makePaper() {
  if (paperImg) paperImg.remove();
  paperImg = createGraphics(W, H);
  paperImg.pixelDensity(1);
  paperImg.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01 + 500, y * 0.01) * 10 + noise(x * 0.3, y * 0.3 + 500) * 6 + random(-6, 6);
    const i = 4 * (y * W + x);
    paperImg.pixels[i] = PAPER[0] + n; paperImg.pixels[i + 1] = PAPER[1] + n;
    paperImg.pixels[i + 2] = PAPER[2] + n; paperImg.pixels[i + 3] = 255;
  }
  paperImg.updatePixels();
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas(`${document.title.toLowerCase().replace(/\s+/g, '-')}-${seed}`, 'png');
  if (key === ' ') restart(Math.floor(Math.random() * 1e6));
}

const G = 266, SC = W / G, CX = G / 2, CY = G / 2 - 4;
const N_SEEDS = 24, ROUND = 16, HOLD = 100;

let seeds, R, acc, lab, round, t, done, img;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  img = createImage(W, H);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed);
  makePaper();
  R = 124; seeds = [];
  for (let i = 0; i < N_SEEDS; i++) {
    const a = random(TWO_PI), r = sqrt(random()) * R * 0.9;
    seeds.push({ x: CX + cos(a) * r, y: CY + sin(a) * r, vx: 0, vy: 0, n: random(1000) });
  }
  acc = new Float32Array(G * G); lab = new Int16Array(G * G);
  round = 0; t = 0; done = false;
}

function label() {
  const area = new Array(seeds.length).fill(0);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const i = y * G + x;
    if ((x - CX) ** 2 + (y - CY) ** 2 > R * R) { lab[i] = -1; continue; }
    let b = 0, bd = 1e9;
    for (let s = 0; s < seeds.length; s++) { const d = (x - seeds[s].x) ** 2 + (y - seeds[s].y) ** 2; if (d < bd) { bd = d; b = s; } }
    lab[i] = b; area[b]++;
  }
  return area;
}

const isEdge = i => lab[i] !== lab[i + 1] || lab[i] !== lab[i + G];

function draw() {
  if (!done) {
    // seeds drift inward with a little wandering; the ring tightens smoothly
    for (const s of seeds) {
      s.x += (CX - s.x) * 0.004 + (noise(s.n, frameCount * 0.02) - 0.5) * 0.6;
      s.y += (CY - s.y) * 0.004 + (noise(s.n + 50, frameCount * 0.02) - 0.5) * 0.6;
    }
    R *= pow(0.95, 1 / ROUND);
  }
  const area = label();
  if (!done && ++t >= ROUND) {
    t = 0;
    const wgt = 0.3 + 0.7 * round / (N_SEEDS - 1);
    for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) { const i = y * G + x; if (isEdge(i)) acc[i] += wgt; }
    round++;
    if (seeds.length > 1) { let mi = 0; for (let s = 1; s < seeds.length; s++) if (area[s] < area[mi]) mi = s; seeds.splice(mi, 1); }
    else done = true;
  }
  if (done && ++t > HOLD) { restart(floor(random(1e6))); return; }

  // print: engraved history in ink, the live border as a thin ember line
  paperImg.loadPixels(); img.loadPixels();
  const P = paperImg.pixels, D = img.pixels;
  for (let y = 0; y < H; y++) {
    const gy = floor(y / SC);
    for (let x = 0; x < W; x++) {
      const gx = floor(x / SC), gi = gy * G + gx, p = (y * W + x) * 4;
      let r = P[p], g = P[p + 1], b = P[p + 2];
      const a = acc[gi];
      if (a) { const k = min(1, a * 0.55) * (0.75 + 0.25 * ((x * 7 + y * 13) % 5) / 4); r += (INK[0] - r) * k; g += (INK[1] - g) * k; b += (INK[2] - b) * k; }
      if (!done && gx < G - 1 && gy < G - 1 && lab[gi] >= 0 && isEdge(gi)) { r = (r + EMBER[0]) / 2; g = (g + EMBER[1]) / 2; b = (b + EMBER[2]) / 2; }
      D[p] = r; D[p + 1] = g; D[p + 2] = b; D[p + 3] = 255;
    }
  }
  img.updatePixels();
  image(img, 0, 0);
  noStroke();
  for (const s of seeds) { fill(...(seeds.length === 1 ? EMBER : INK)); circle(s.x * SC, s.y * SC, seeds.length === 1 ? 10 : 4); }
  if (seeds.length === 1) { noFill(); stroke(...EMBER); strokeWeight(1.2); circle(seeds[0].x * SC, seeds[0].y * SC, 24); }
}
