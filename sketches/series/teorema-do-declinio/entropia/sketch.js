/**
 * Entropia
 *
 * O Teorema do Declínio #5 — the words themselves.
 *
 * Six phrases from the text that started the series, one per line, set in a
 * calm serif. Then every letter starts a random walk. The rule is the same
 * for every letter; only the rate changes: each line down takes more steps
 * than the one above, so the first phrase barely trembles while the later
 * ones loosen, turn, fade and fall. Letters that fall far enough land on the
 * floor of the page and pile up where they land.
 *
 * The last line is outside the rule. No noise reaches it, and it stays as it
 * was set: "a luz pertencia a quem a emitia".
 *
 * Each visit starts from a random seed; ?seed=7 reproduces the GIF.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE to start again
 */

const SLUG = 'entropia';
const W = 800, H = 800;
const LOOP_SECONDS = 26;
const SET_END = 70;                         // frames to set the type, line by line
const WALK_END = 0.8 * LOOP_SECONDS * 30;   // frames of entropy
const FADE_START = 0.9 * LOOP_SECONDS * 30;
const BG = [242, 235, 224];
const FONT = 'Cormorant Garamond';
const LINES = [
  'havia escuta, reverência, delicadeza',
  'a vulnerabilidade entregue como um voto de fé',
  'o carinho que vira implicância',
  'o afeto vira trocadilho',
  'o diálogo vira interrogatório',
  'dar profundidade; receber futilidade',
];
const LAST = 'a luz pertencia a quem a emitia';
const TOTAL_STEPS = 260, FLOOR = 735;

let ground, simFrame = 0, letters = [], pile;

function init() {
  simFrame = 0; letters = []; pile = new Float32Array(W).fill(FLOOR);
  textFont(FONT); textSize(30); textStyle(NORMAL);
  for (let r = 0; r < LINES.length; r++) {
    const e = Math.pow(r / (LINES.length - 1), 2.1), y0 = 92 + r * 76;
    let x = 60;
    for (const ch of LINES[r]) {
      const cw = textWidth(ch);
      letters.push({ ch, r, e, x0: x, y0, dx: 0, dy: 0, rot: 0, steps: 0, landed: false, cw });
      x += cw;
    }
  }
}

function step(f) {
  if (f <= SET_END || f > WALK_END) return;
  const p = TOTAL_STEPS / (WALK_END - SET_END);   // expected steps per frame at full rate
  for (const L of letters) {
    if (L.landed || L.e === 0) continue;
    let n = p * L.e; while (n > 0) {
      if (n < 1 && random() > n) break; n--;
      L.dx += randomGaussian() * 1.2; L.dy += randomGaussian() * 1.2 + 0.9 * L.e * L.e; L.rot += randomGaussian() * 0.03 * L.e; L.steps++;
    }
    const px = L.x0 + L.dx, py = L.y0 + L.dy;
    if (py > 700) {                              // falls to the floor and stays
      const c = constrain(Math.floor(px + L.cw / 2), 0, W - 1);
      L.dy = pile[c] - L.y0; L.landed = true;
      for (let k = -8; k <= 8; k++) if (c + k >= 0 && c + k < W) pile[c + k] = min(pile[c + k], pile[c] - 7 + Math.abs(k) * 0.4);
    }
  }
}

function render(f) {
  textFont(FONT); noStroke();
  const shown = Math.floor(min(1, f / SET_END) * (LINES.length + 1));  // lines set so far
  textSize(30); textStyle(NORMAL); textAlign(LEFT, BASELINE);
  for (const L of letters) {
    if (L.r >= shown) continue;
    const fade = 1 - 0.55 * L.e * min(1, L.steps / (TOTAL_STEPS * max(L.e, 1e-3)));
    push(); translate(L.x0 + L.dx, L.y0 + L.dy); rotate(L.rot);
    fill(40, 30, 34, 255 * fade); text(L.ch, 0, 0); pop();
  }
  if (shown > LINES.length) { textStyle(ITALIC); textSize(36); fill(160, 22, 48); textAlign(RIGHT, BASELINE); text(LAST, 742, 780); }
}

// ---------- ground: cream paper ----------
function makeGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1); ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = 4 * (y * W + x), n = (random() - 0.5) * 9 + (noise(x * 0.004, y * 0.004) - 0.5) * 16;
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n * 0.9; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0, capturing = false, baseSeed = 0, cycle = 0, ready = false;

function start() {
  const s = baseSeed + cycle * 1013;
  randomSeed(s); noiseSeed(s);
  init();
}

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  const p = new URLSearchParams(window.location.search);
  baseSeed = p.has('seed') ? parseInt(p.get('seed'), 10) : Math.floor(Math.random() * 1e6);
  randomSeed(baseSeed); noiseSeed(baseSeed);
  makeGround();
  noLoop();
  // the type needs the web font before letters can be measured
  const fontReady = document.fonts ? Promise.all([document.fonts.load(`30px "${FONT}"`), document.fonts.load(`italic 500 36px "${FONT}"`)]) : Promise.resolve();
  fontReady.catch(() => {}).then(() => {
    ready = true;
    start();
    // Inert during normal viewing; the capture driver calls this per frame.
    window.__captureFrame = async (i, n) => {
      noLoop(); capturing = true;
      const f = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
      if (f < simFrame) start();
      frame = f;
      redraw();
    };
    if (p.has('f') && p.has('n')) window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
    else loop();
  });
}

function draw() {
  if (!ready) { image(ground, 0, 0); return; }
  advanceTo(frame);
  image(ground, 0, 0);
  render(frame);
  const fade = (frame - FADE_START) / (LOOP_FRAMES - FADE_START);
  if (fade > 0) { push(); tint(255, 255 * min(1, fade)); image(ground, 0, 0); pop(); }
  if (isLooping()) {
    frame++;
    if (frame >= LOOP_FRAMES) { frame = 0; cycle++; start(); }
  }
}

function advanceTo(f) { while (simFrame < f) { simFrame++; step(simFrame); } }

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas(SLUG, 'png');
  if (key === ' ') { cycle++; frame = 0; start(); }
}
