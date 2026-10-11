/**
 * Cópia da Cópia
 *
 * Reflexões #3: memória.
 *
 * A portrait goes through a photocopier, then the copy goes through it, then
 * the copy of the copy, fifteen times. Each pass is faithful to the sheet it
 * was given, not to the first one: the glass enlarges a little, the sheet
 * sits slightly crooked, toner blurs and clumps, the threshold decides what
 * is black. Nothing is erased on purpose. The eyes go first, then the mouth,
 * then the date, until what is left is the shape of someone.
 *
 * That is how remembering works: every time we recall something we copy the
 * last recollection, not the event.
 *
 * Each copy prints under the moving light of the scanner. At the end of the
 * loop the copies fade and only the original stays on the table.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new set of copies (same portrait, different machine)
 */

const W = 800, H = 800;
const M = 164;                   // size of each sheet in pixels
const PITCH = 190;               // distance between sheets
const GENS = 16;                 // original + 15 copies
const LOOP_SECONDS = 16;
const PRINT = 0.86;              // share of the loop spent printing copies
const FADE = 0.08;               // copies fade out at the end

const PAPER = [232, 230, 222];
const SHEET = [244, 242, 236];
const TONER = [22, 22, 26];

let seed = 3;
let gens = [];                   // Float32Array per generation, 1 = white
let grain = [];                  // per-generation toner speckle
let paperTex;

function portrait() {
  const g = createGraphics(M, M);
  g.pixelDensity(1);
  g.background(240);
  g.noStroke();
  g.fill(20);
  // hair and face
  g.ellipse(82, 58, 92, 86);
  g.rect(36, 56, 92, 50, 0, 0, 20, 20);
  g.fill(196);
  g.ellipse(82, 74, 64, 80);
  g.fill(20);
  // eyes, brows, nose, mouth
  g.ellipse(70, 66, 11, 7); g.ellipse(96, 66, 11, 7);
  g.fill(240); g.circle(71, 66, 3); g.circle(97, 66, 3); g.fill(20);
  g.rect(62, 56, 16, 3, 2); g.rect(88, 56, 16, 3, 2);
  g.rect(81, 70, 3, 14, 2); g.rect(76, 84, 12, 3, 2);
  g.rect(72, 94, 22, 4, 2);
  // neck, collar, dress
  g.fill(196); g.rect(72, 108, 22, 14);
  g.fill(20); g.rect(30, 120, 106, 50, 34, 34, 0, 0);
  g.fill(240); g.triangle(66, 120, 83, 140, 100, 120);
  g.fill(20); g.circle(83, 148, 4); g.circle(83, 158, 4);
  // the date written on the photo
  g.fill(20); g.textFont('Georgia'); g.textStyle(ITALIC); g.textSize(15);
  g.text('1962', 120, 28);
  g.loadPixels();
  const img = new Float32Array(M * M);
  for (let i = 0; i < M * M; i++) img[i] = g.pixels[4 * i] / 255;
  g.remove();
  return img;
}

function photocopy(img, gen) {
  const out = new Float32Array(M * M);
  const sc = 1.03, sh = random(-0.8, 0.8), rot = random(-0.012, 0.012);
  const c = cos(rot), s = sin(rot);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const cx = x - M / 2, cy = y - M / 2;
    const sx = (cx * c - cy * s) / sc + M / 2 + sh, sy = (cx * s + cy * c) / sc + M / 2 + sh * 0.5;
    let acc = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = (sx + dx) | 0, yy = (sy + dy) | 0;
      acc += (xx >= 0 && yy >= 0 && xx < M && yy < M) ? img[yy * M + xx] : 0.94;
    }
    const v = acc / 25 + random(-0.17, 0.17) + (noise(x * 0.06, y * 0.06, gen + seed) - 0.5) * 0.4;
    out[y * M + x] = v > 0.5 ? Math.min(1, 0.9 + random(0.1)) : Math.max(0, random(0.12));
  }
  return out;
}

function build() {
  randomSeed(seed); noiseSeed(seed);
  gens = [portrait()];
  for (let k = 1; k < GENS; k++) gens.push(photocopy(gens[k - 1], k));
  grain = gens.map(() => {
    const a = new Float32Array(M * M);
    for (let i = 0; i < M * M; i++) a[i] = 0.85 + 0.2 * random();
    return a;
  });
  paperTex = new Uint8ClampedArray(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const n = noise(x * 0.01, y * 0.01) * 8 + noise(x * 0.3, y * 0.3) * 5 + random(-3, 3);
    paperTex[i * 3] = PAPER[0] + n; paperTex[i * 3 + 1] = PAPER[1] + n; paperTex[i * 3 + 2] = PAPER[2] + n;
  }
}

function sheetOrigin(k) {
  const off = (W - (3 * PITCH + M)) / 2;
  return [off + (k % 4) * PITCH, off - 8 + ((k / 4) | 0) * PITCH];
}

function renderPhase(t) {
  // copy k (1..15) prints during [start, start + slot)
  const slot = PRINT / (GENS - 1);
  const fade = t > 1 - FADE ? 1 - (t - (1 - FADE)) / FADE : 1;
  loadPixels();
  for (let i = 0; i < W * H; i++) {
    const p = i * 4;
    pixels[p] = paperTex[i * 3]; pixels[p + 1] = paperTex[i * 3 + 1]; pixels[p + 2] = paperTex[i * 3 + 2]; pixels[p + 3] = 255;
  }
  const scans = [];
  for (let k = 0; k < GENS; k++) {
    let printed = 1, alpha = 1;
    if (k > 0) {
      const start = (k - 1) * slot;
      if (t < start) continue;
      printed = Math.min(1, (t - start) / (slot * 0.8));
      alpha = fade;
      if (printed < 1) scans.push([k, printed]);
    }
    if (alpha <= 0) continue;
    const [ox, oy] = sheetOrigin(k);
    const rows = Math.floor(printed * M);
    const img = gens[k], gr = grain[k];
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      const p = 4 * ((oy + y) * W + ox + x);
      let r = SHEET[0], g = SHEET[1], b = SHEET[2];
      if (y < rows) {
        const tn = (1 - img[y * M + x]) * gr[y * M + x];
        r += (TONER[0] - r) * tn; g += (TONER[1] - g) * tn; b += (TONER[2] - b) * tn;
      }
      pixels[p] += (r - pixels[p]) * alpha;
      pixels[p + 1] += (g - pixels[p + 1]) * alpha;
      pixels[p + 2] += (b - pixels[p + 2]) * alpha;
    }
  }
  updatePixels();
  // the scanner light passing over the sheet being printed
  noStroke();
  for (const [k, printed] of scans) {
    const [ox, oy] = sheetOrigin(k);
    const y = oy + printed * M;
    for (let d = 0; d < 14; d++) {
      fill(200, 255, 220, 70 - d * 5);
      rect(ox - 4, y - d, M + 8, 1);
      rect(ox - 4, y + d, M + 8, 1);
    }
    fill(235, 255, 240, 230);
    rect(ox - 4, y - 1, M + 8, 2);
  }
  // labels
  fill(110); textFont('Courier New'); textStyle(NORMAL); textSize(11); textAlign(LEFT, BASELINE);
  for (let k = 0; k < GENS; k++) {
    const [ox, oy] = sheetOrigin(k);
    const shown = k === 0 || t >= (k - 1) * slot;
    if (!shown) continue;
    fill(110, k === 0 ? 255 : 255 * fade);
    text(k === 0 ? 'original' : `cópia ${k}`, ox + 2, oy + M + 13);
  }
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 60;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  build();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    noLoop();
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  const p = new URLSearchParams(window.location.search);
  if (p.has('f') && p.has('n')) {
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  renderPhase(frame / LOOP_FRAMES);
  if (isLooping()) frame = (frame + 1) % LOOP_FRAMES;
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('copia-da-copia', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    build();
  }
}
