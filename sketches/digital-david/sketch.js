// Digital David — Michelangelo's David bust as character-density ASCII art
// 3D model → off-screen WEBGL buffer → uniform-grid density-mapped character rendering
// Character visual weight (heavy → light) at UNIFORM size creates tonal gradient
// Color shifts from deep blue-green shadows → emerald mids → white-cyan highlights
//
// David model: "Head of Michelangelo's David, Optimised" by Scan The World
// Source: https://sketchfab.com/3d-models/head-of-michelangelos-david-optimised-d29af50360624e5e9b1855666475380d
// License: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/

const CANVAS_W = 600;
const CANVAS_H = 800;
const BUFFER_SIZE = 600; // square buffer for 3D model rendering
const ROTATION_SPEED = 0.003;
const SCANLINE_INTERVAL = 200;
const NUM_RAIN_STREAMS = 24;
const NUM_FLOATING_CHARS = 8;

// --- Single uniform grid ---
const GRID = 7;
const CHAR_SIZE = 8;
const COLS = Math.floor(CANVAS_W / GRID);
const ROWS = Math.floor(CANVAS_H / GRID);

// Vertical offset to center the 600px buffer content within 800px canvas
const BUST_Y_OFFSET = Math.floor((CANVAS_H - BUFFER_SIZE) / 2);

// --- Character density bands ---
const BAND_HEAVY = '@#MW%&BH8$N'.split('');

const HEAVY_KATAKANA = [];
for (const code of [0xFF8D, 0xFF90, 0xFF91, 0xFF84, 0xFF85, 0xFF86, 0xFF87, 0xFF88, 0xFF89, 0xFF8A, 0xFF8B, 0xFF8C]) {
  HEAVY_KATAKANA.push(String.fromCharCode(code));
}
const BAND_MED_HEAVY = [...HEAVY_KATAKANA, ...'0OGDQRXKZ9'.split('')];

const LIGHT_KATAKANA = [];
for (const code of [0xFF66, 0xFF67, 0xFF68, 0xFF69, 0xFF6A, 0xFF6B, 0xFF6C, 0xFF70, 0xFF71, 0xFF72, 0xFF73]) {
  LIGHT_KATAKANA.push(String.fromCharCode(code));
}
const BAND_MED_LIGHT = [...LIGHT_KATAKANA, ...'+=*?!xci~^'.split('')];

const BAND_LIGHT = '.:;-\'·,`'.split('');

const CHAR_POOL = [...BAND_HEAVY, ...BAND_MED_HEAVY, ...BAND_MED_LIGHT, ...BAND_LIGHT];

// Brightness band boundaries — wider spread for more contrast
const BR_SKIP = 4;
const BR_LIGHT = 18;
const BR_MED_LIGHT = 50;
const BR_MED_HEAVY = 110;
// > 110: heavy/highlight band

function randomChar() {
  return CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)];
}

function randomFromBand(band) {
  return band[Math.floor(Math.random() * band.length)];
}

function pickCharForBrightness(br) {
  if (br > BR_MED_HEAVY) return randomFromBand(BAND_HEAVY);
  if (br > BR_MED_LIGHT) return randomFromBand(BAND_MED_HEAVY);
  if (br > BR_LIGHT) return randomFromBand(BAND_MED_LIGHT);
  return randomFromBand(BAND_LIGHT);
}

// --- State ---
let davidModel;
let modelBuffer;
let rotationAngle = 0;
let charGrid = [];
let charSwapTimers = [];
let rainStreams = [];
let floatingChars = [];
let dataStreams = [];
let scanlineY = -1;
let scanlineTimer = 0;
let debugMode = false;
let glitchTimer = 0;
let glitchRows = [];

function preload() {
  davidModel = loadModel('david-head.obj', true);
}

function setup() {
  pixelDensity(2);
  const cnv = createCanvas(CANVAS_W, CANVAS_H);
  cnv.parent('canvas-container');
  background(0);
  textFont('Courier New');
  textAlign(CENTER, CENTER);
  noStroke();

  modelBuffer = createGraphics(BUFFER_SIZE, BUFFER_SIZE, WEBGL);
  modelBuffer.pixelDensity(1);

  for (let r = 0; r < ROWS; r++) {
    charGrid[r] = [];
    charSwapTimers[r] = [];
    for (let c = 0; c < COLS; c++) {
      charGrid[r][c] = randomChar();
      charSwapTimers[r][c] = Math.floor(Math.random() * 30);
    }
  }

  for (let i = 0; i < NUM_RAIN_STREAMS; i++) rainStreams.push(new RainStream());
  for (let i = 0; i < NUM_FLOATING_CHARS; i++) floatingChars.push(new FloatingChar());
  for (let i = 0; i < 3; i++) dataStreams.push(new DataStream());
}

function renderDavid() {
  modelBuffer.background(0);

  // Dramatic Rembrandt lighting — strong side contrast
  modelBuffer.directionalLight(255, 255, 255, 1.0, -0.4, -0.5);
  modelBuffer.directionalLight(15, 15, 15, -0.6, 0.3, 0.4);
  modelBuffer.ambientLight(3);
  modelBuffer.noStroke();
  modelBuffer.fill(220);

  modelBuffer.push();
  modelBuffer.rotateY(rotationAngle);
  modelBuffer.rotateX(HALF_PI);
  modelBuffer.rotateZ(PI);
  modelBuffer.scale(2.5);
  modelBuffer.model(davidModel);
  modelBuffer.pop();

  modelBuffer.loadPixels();
}

function sampleBr(cx, cy, px, w) {
  const sx = Math.min(Math.max(Math.floor(cx), 0), w - 1);
  const sy = Math.min(Math.max(Math.floor(cy), 0), w - 1);
  const idx = (sy * w + sx) * 4;
  return (px[idx] + px[idx + 1] + px[idx + 2]) / 3;
}

// --- Main draw loop ---

function draw() {
  renderDavid();

  if (debugMode) {
    background(0);
    image(modelBuffer, 0, BUST_Y_OFFSET);
    fill(0, 255, 0);
    textAlign(LEFT, TOP);
    textSize(14);
    text('DEBUG — press D to toggle', 10, 10);
    textAlign(CENTER, CENTER);
    return;
  }

  background(0);

  // === BACKGROUND LAYERS ===
  drawVignette();
  for (const ds of dataStreams) { ds.update(); ds.draw(); }
  for (const s of rainStreams) { s.update(); s.draw(); }
  for (const fc of floatingChars) { fc.update(); fc.draw(); }

  // === BUST RENDERING ===
  const px = modelBuffer.pixels;
  const w = BUFFER_SIZE;

  // Glitch effect
  glitchTimer++;
  if (glitchTimer > 120 + Math.floor(Math.random() * 180)) {
    glitchTimer = 0;
    glitchRows = [];
    const numGlitch = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numGlitch; i++) {
      glitchRows.push({
        row: Math.floor(Math.random() * ROWS),
        offset: (Math.random() - 0.5) * 20,
        life: 3 + Math.floor(Math.random() * 5)
      });
    }
  }
  for (let i = glitchRows.length - 1; i >= 0; i--) {
    glitchRows[i].life--;
    if (glitchRows[i].life <= 0) glitchRows.splice(i, 1);
  }

  textSize(CHAR_SIZE);

  for (let r = 0; r < ROWS; r++) {
    let xOffset = 0;
    for (const g of glitchRows) {
      if (g.row === r || g.row === r - 1 || g.row === r + 1) {
        xOffset = g.offset;
        break;
      }
    }

    for (let c = 0; c < COLS; c++) {
      const cx = c * GRID + GRID / 2;
      const cy = r * GRID + GRID / 2;

      // Map canvas Y back to buffer Y (buffer is centered vertically)
      const bufY = cy - BUST_Y_OFFSET;
      // Skip cells outside the buffer region
      if (bufY < 0 || bufY >= BUFFER_SIZE) continue;

      const br = sampleBr(cx, bufY, px, w);

      if (br < BR_SKIP) continue;

      // Cycle characters
      charSwapTimers[r][c]++;
      const swapRate = br > BR_MED_HEAVY ? 25 : br > BR_MED_LIGHT ? 15 : 10;
      if (charSwapTimers[r][c] > swapRate + Math.floor(Math.random() * 10)) {
        charGrid[r][c] = pickCharForBrightness(br);
        charSwapTimers[r][c] = 0;
      }

      // --- Color mapping with temperature shift ---
      if (br > BR_MED_HEAVY) {
        const t = constrain((br - BR_MED_HEAVY) / (200 - BR_MED_HEAVY), 0, 1);
        fill(
          Math.floor(200 * t),
          Math.floor(210 + 45 * t),
          Math.floor(140 * t + 30)
        );
      } else if (br > BR_MED_LIGHT) {
        const t = (br - BR_MED_LIGHT) / (BR_MED_HEAVY - BR_MED_LIGHT);
        fill(0, Math.floor(100 + 110 * t), Math.floor(10 + 30 * t));
      } else if (br > BR_LIGHT) {
        const t = (br - BR_LIGHT) / (BR_MED_LIGHT - BR_LIGHT);
        fill(0, Math.floor(30 + 70 * t), Math.floor(8 + 10 * t));
      } else {
        const t = (br - BR_SKIP) / (BR_LIGHT - BR_SKIP);
        fill(0, Math.floor(8 + 22 * t), Math.floor(4 + 8 * t));
      }

      text(charGrid[r][c], cx + xOffset, cy);
    }
  }

  // === OVERLAYS ===
  scanlineTimer++;
  if (scanlineTimer >= SCANLINE_INTERVAL) {
    scanlineTimer = 0;
    scanlineY = 0;
  }
  if (scanlineY >= 0 && scanlineY < CANVAS_H) {
    noStroke();
    fill(0, 255, 70, 40);
    rect(0, scanlineY - 1, CANVAS_W, 2);
    fill(0, 255, 120, 80);
    rect(0, scanlineY, CANVAS_W, 1);
    scanlineY += 4;
    if (scanlineY >= CANVAS_H) scanlineY = -1;
  }

  rotationAngle += ROTATION_SPEED;
}

// --- Radial vignette ---
function drawVignette() {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const maxR = CANVAS_W * 0.45;
  noStroke();
  for (let i = 6; i >= 0; i--) {
    const r = maxR * (i / 6);
    const alpha = Math.floor(3 + (6 - i) * 1.5);
    fill(0, 20, 5, alpha);
    ellipse(cx, cy, r * 2, r * 2);
  }
}

// --- Vertical rain streams ---
class RainStream {
  constructor() {
    this.reset();
    this.y = Math.floor(Math.random() * CANVAS_H);
  }

  reset() {
    this.x = Math.floor(Math.random() * COLS) * GRID + GRID / 2;
    this.y = -Math.floor(Math.random() * CANVAS_H * 0.5);
    this.speed = 1.5 + Math.random() * 3;
    this.length = 5 + Math.floor(Math.random() * 10);
    this.chars = Array.from({ length: this.length }, () => randomChar());
  }

  update() {
    this.y += this.speed;
    for (let i = 0; i < this.chars.length; i++) {
      if (Math.random() < 0.03) this.chars[i] = randomChar();
    }
    if (this.y - this.length * GRID > CANVAS_H) this.reset();
  }

  draw() {
    textSize(CHAR_SIZE);
    for (let i = 0; i < this.chars.length; i++) {
      const charY = this.y - i * GRID;
      if (charY < -GRID || charY > CANVAS_H + GRID) continue;

      if (i === 0) {
        fill(180, 255, 180, 120);
      } else {
        const fade = 1 - i / this.chars.length;
        fill(0, Math.floor(40 * fade), Math.floor(15 * fade), Math.floor(70 * fade));
      }
      text(this.chars[i], this.x, charY);
    }
  }
}

// --- Horizontal data streams ---
class DataStream {
  constructor() {
    this.reset();
  }

  reset() {
    this.y = Math.random() * CANVAS_H;
    this.x = -Math.random() * CANVAS_W;
    this.speed = 0.3 + Math.random() * 0.8;
    this.direction = Math.random() > 0.5 ? 1 : -1;
    if (this.direction === -1) this.x = CANVAS_W + Math.random() * CANVAS_W;
    this.length = 20 + Math.floor(Math.random() * 40);
    this.chars = Array.from({ length: this.length }, () =>
      Math.random() > 0.3 ? randomFromBand(BAND_MED_LIGHT) : randomFromBand(BAND_LIGHT)
    );
    this.alpha = 15 + Math.random() * 20;
    this.swapTimer = 0;
  }

  update() {
    this.x += this.speed * this.direction;
    this.swapTimer++;
    if (this.swapTimer > 8) {
      this.swapTimer = 0;
      const idx = Math.floor(Math.random() * this.chars.length);
      this.chars[idx] = Math.random() > 0.3 ? randomFromBand(BAND_MED_LIGHT) : randomFromBand(BAND_LIGHT);
    }
    if (this.direction === 1 && this.x > CANVAS_W + this.length * 6) this.reset();
    if (this.direction === -1 && this.x < -this.length * 6) this.reset();
  }

  draw() {
    textSize(6);
    for (let i = 0; i < this.chars.length; i++) {
      const charX = this.x + i * 6 * this.direction;
      if (charX < -6 || charX > CANVAS_W + 6) continue;

      const edgeFade = Math.min(
        Math.min(charX, CANVAS_W - charX) / 60,
        Math.min(i, this.chars.length - i) / 8
      );
      const a = Math.floor(this.alpha * constrain(edgeFade, 0, 1));
      fill(0, Math.floor(a * 0.8), Math.floor(a * 0.3), a);
      text(this.chars[i], charX, this.y);
    }
    textSize(CHAR_SIZE);
  }
}

// --- Floating background noise characters ---
class FloatingChar {
  constructor() {
    this.reset(true);
  }

  reset(randomizeY = false) {
    this.x = Math.random() * CANVAS_W;
    this.y = randomizeY ? Math.random() * CANVAS_H : -40;
    this.char = randomFromBand(BAND_HEAVY);
    this.size = 20 + Math.random() * 10;
    this.alpha = 10 + Math.random() * 15;
    this.driftX = (Math.random() - 0.5) * 0.3;
    this.driftY = 0.1 + Math.random() * 0.2;
    this.swapTimer = 0;
    this.swapInterval = 60 + Math.floor(Math.random() * 120);
  }

  update() {
    this.x += this.driftX;
    this.y += this.driftY;
    this.swapTimer++;
    if (this.swapTimer > this.swapInterval) {
      this.char = randomFromBand(BAND_HEAVY);
      this.swapTimer = 0;
    }
    if (this.y > CANVAS_H + 40) this.reset();
  }

  draw() {
    fill(0, Math.floor(this.alpha), Math.floor(this.alpha * 0.4));
    textSize(this.size);
    text(this.char, this.x, this.y);
    textSize(CHAR_SIZE);
  }
}

function keyPressed() {
  if (key === 'S' || key === 's') saveCanvas('digital-david', 'png');
  if (key === 'D' || key === 'd') debugMode = !debugMode;
}
