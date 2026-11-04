/**
 * Faísca
 *
 * Jogos Vorazes #3.
 *
 * A Granovetter threshold model. Every stroke is a person with a threshold:
 * they only light up once the share of lit neighbours around them passes it.
 * The ground is cut into twelve sectors around a centre, and each sector has
 * its own temperament: some are tinder (low thresholds), some are cautious.
 * The centre's thresholds are too high to ever be reached.
 *
 * One spark, three people wide. Each step everyone looks at their 24
 * neighbours and decides. The fire races through the easy sectors, stalls
 * at the border of a cautious one, sometimes finds a lower-threshold seam
 * and pours through it. When a person lights up, their upright stroke is
 * recut in ember and turned by the moment it happened, so the order of the
 * uprising is printed as the grain of the plate. When nothing changes any
 * more, the plate is held, then a new one is cut.
 *
 * ?seed=N fixes the first plate (the GIF uses seed 3).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new spark
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

const N = 110, CELL = 700 / N, OX = 50, OY = 50, CX = N / 2, CY = N / 2;
const STEP_EVERY = 3, HOLD = 110, MAX_T = 90;

let th, lit, sheet, step, t, phase;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  restart(pickSeed());
}

function cellPos(x, y) { return [OX + (x + 0.5) * CELL, OY + (y + 0.5) * CELL]; }

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed);
  makePaper();
  if (sheet) sheet.remove();
  sheet = createGraphics(W, H); sheet.pixelDensity(1);
  const sect = []; for (let k = 0; k < 12; k++) sect.push(random() < 0.5 ? random(0.12, 0.3) : random(0.38, 0.6));
  th = new Float32Array(N * N); lit = new Int16Array(N * N).fill(-1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = (atan2(y - CY, x - CX) + TWO_PI) % TWO_PI, k = floor(a / TWO_PI * 12), d = dist(x, y, CX, CY);
    let v = sect[k] + randomGaussian(0, 0.13);
    if (d < 9) v = 0.95;
    if (d > N / 2) v = 2;
    th[y * N + x] = constrain(v, 0, 2);
    if (v < 1.5) {
      const [px, py] = cellPos(x, y);
      sheet.stroke(...INK, 200); sheet.strokeWeight(1.1);
      sheet.line(px, py - CELL * 0.42, px + random(-0.5, 0.5), py + CELL * 0.42);
    }
  }
  // the spark: somewhere on a ring between centre and edge, in a sector that can catch
  let sx, sy;
  for (let tries = 0; tries < 50; tries++) {
    const a0 = random(TWO_PI); sx = floor(CX + cos(a0) * 40); sy = floor(CY + sin(a0) * 40);
    if (th[sy * N + sx] < 0.35) break;
  }
  step = 0; t = 0; phase = 'burn';
  for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx - 1; x <= sx + 1; x++) ignite(x, y);
}

function ignite(x, y) {
  const i = y * N + x; lit[i] = step;
  const [px, py] = cellPos(x, y), f = min(1, step / MAX_T);
  const ang = -HALF_PI + f * PI * 0.9 + (noise(x * 0.1, y * 0.1) - 0.5) * 0.4, L = CELL * (0.55 - f * 0.15);
  sheet.erase(); sheet.rect(px - CELL / 2, py - CELL / 2, CELL, CELL); sheet.noErase();
  sheet.stroke(lerp(EMBER[0], 120, f * 0.6), lerp(EMBER[1], 30, f * 0.6), lerp(EMBER[2], 20, f), 235);
  sheet.strokeWeight(1.6 - f * 0.6);
  sheet.line(px - cos(ang) * L, py - sin(ang) * L, px + cos(ang) * L, py + sin(ang) * L);
}

function advance() {
  step++;
  const next = [];
  for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) {
    const i = y * N + x; if (lit[i] >= 0 || th[i] > 1.5) continue;
    let on = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && lit[(y + dy) * N + x + dx] >= 0) on++;
    if (on / 24 >= th[i]) next.push([x, y]);
  }
  for (const [x, y] of next) ignite(x, y);
  return next.length;
}

function draw() {
  if (phase === 'burn') {
    if (frameCount % STEP_EVERY === 0 && advance() === 0) phase = 'hold';
  } else if (++t > HOLD) restart(floor(random(1e6)));
  image(paperImg, 0, 0);
  blendMode(MULTIPLY); image(sheet, 0, 0); blendMode(BLEND);
}
