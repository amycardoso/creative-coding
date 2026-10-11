/**
 * Feira
 *
 * Reflexões #6: desigualdade.
 *
 * The yard-sale model of wealth exchange (Chakraborti, Hayes). Four hundred
 * people start with exactly the same amount, the faint ring around each one.
 * Two of them meet at random and bet a tenth of what the poorer one has on a
 * fair coin. Nobody cheats, nobody is smarter, and every single trade is
 * even. Still, a loss shrinks what you can stake next time and a win does
 * not protect you, so money drains towards whoever happens to have more.
 * After a few hundred thousand fair trades a handful of gold discs cover
 * the stalls of their neighbours and most people are a speck.
 *
 * The counter shows how much of everything the richest 1% hold. At the end
 * of the loop everything is shared out again, which is the only move in this
 * game that brings the first page back.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new market day
 */

const W = 800, H = 800;
const P = 400, COLS = 20, PITCH = 36;
const START = 100;               // what everyone has at the beginning
const R0 = 9;                    // disc radius at START
const TRADES = 400000;
const STAKE = 0.1;               // share of the poorer one's money at stake
const LOOP_SECONDS = 14;
const TRADE = 0.8;               // share of the loop spent trading
const HOLD = 0.06;

let seed = 6;
let snaps = [];                  // Float32Array wealth per trading frame
let pairs = [];                  // a few trading pairs per frame, to draw
let tradesAt = [];
let paperG, gold;

function simulate() {
  randomSeed(seed); noiseSeed(seed);
  const steps = Math.round(LOOP_FRAMES * TRADE);
  const w = new Float64Array(P).fill(START);
  snaps = [Float32Array.from(w)];
  pairs = [[]];
  tradesAt = [0];
  let done = 0;
  for (let k = 1; k <= steps; k++) {
    const target = Math.round(TRADES * Math.pow(k / steps, 1.6));
    const shown = [];
    for (; done < target; done++) {
      const a = floor(random(P)), b = floor(random(P));
      if (a === b) continue;
      const stake = STAKE * Math.min(w[a], w[b]);
      if (random() < 0.5) { w[a] += stake; w[b] -= stake; } else { w[a] -= stake; w[b] += stake; }
      if (shown.length < 24) shown.push([a, b]);
    }
    snaps.push(Float32Array.from(w));
    pairs.push(shown);
    tradesAt.push(done);
  }
}

function topShare(w) {
  const s = Array.from(w).sort((a, b) => b - a);
  let top = 0;
  for (let i = 0; i < P / 100; i++) top += s[i];
  return top / (P * START);
}

function build() {
  simulate();
  paperG = createGraphics(W, H);
  paperG.pixelDensity(1);
  paperG.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 8 + noise(x * 0.3, y * 0.3) * 5 + random(-3, 3);
    const p = 4 * (y * W + x);
    paperG.pixels[p] = 30 + n; paperG.pixels[p + 1] = 32 + n; paperG.pixels[p + 2] = 36 + n; paperG.pixels[p + 3] = 255;
  }
  paperG.updatePixels();
  paperG.noFill(); paperG.stroke(120, 110, 90, 90); paperG.strokeWeight(0.8);
  for (let i = 0; i < P; i++) { const [x, y] = stall(i); paperG.circle(x, y, 2 * R0); }
  // a grainy gold-leaf disc, scaled per person
  const s = 160;
  gold = createGraphics(s, s);
  gold.pixelDensity(1);
  gold.loadPixels();
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.hypot(x - s / 2 + 0.5, y - s / 2 + 0.5) / (s / 2);
    const edge = constrain((1 - d) * 30, 0, 1);
    const hole = random() < 0.1 ? 0.25 : 1;
    const v = random(-20, 20) + noise(x * 0.05, y * 0.05) * 30 - 15;
    const p = 4 * (y * s + x);
    gold.pixels[p] = 214 + v; gold.pixels[p + 1] = 168 + v; gold.pixels[p + 2] = 70 + v * 0.6;
    gold.pixels[p + 3] = 255 * edge * hole;
  }
  gold.updatePixels();
}

function stall(i) {
  const off = (W - (COLS - 1) * PITCH) / 2;
  return [off + (i % COLS) * PITCH, off - 18 + ((i / COLS) | 0) * PITCH];
}

const ease = (u) => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

function renderPhase(t) {
  const steps = snaps.length - 1;
  let w, shown = [], trades, share;
  if (t < TRADE) {
    const k = Math.min(steps, Math.floor((t / TRADE) * steps));
    w = snaps[k]; shown = pairs[k]; trades = tradesAt[k];
    share = topShare(w);
  } else {
    const last = snaps[steps];
    const u = t < TRADE + HOLD ? 0 : ease((t - TRADE - HOLD) / (1 - TRADE - HOLD));
    w = last.map((v) => v + (START - v) * u);
    trades = tradesAt[steps];
    share = topShare(w);
  }
  image(paperG, 0, 0);
  // the coin flips of this frame, as thin threads between the two stalls
  stroke(214, 168, 70, 60); strokeWeight(0.8);
  for (const [a, b] of shown) { const [x0, y0] = stall(a), [x1, y1] = stall(b); line(x0, y0, x1, y1); }
  noStroke();
  // largest first so nobody small is hidden under somebody rich
  const order = Array.from({ length: P }, (_, i) => i).sort((a, b) => w[b] - w[a]);
  imageMode(CENTER);
  for (const i of order) {
    const r = Math.sqrt(Math.max(w[i], 0) / START) * R0;
    if (r < 0.6) continue;
    const [x, y] = stall(i);
    image(gold, x, y, 2 * r, 2 * r);
  }
  imageMode(CORNER);
  fill(220, 200, 160);
  textFont('Georgia'); textStyle(ITALIC); textSize(15); textAlign(LEFT, BASELINE);
  const label = t < TRADE + HOLD
    ? `${trades.toLocaleString('pt-BR')} trocas justas · 1% tem ${Math.round(share * 100)}% de tudo`
    : `dividindo de novo · 1% tem ${Math.round(share * 100)}% de tudo`;
  text(label, 30, H - 22);
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
  if (key === 's' || key === 'S') saveCanvas('feira', 'png');
  if (key === ' ') {
    seed = Math.floor(Math.random() * 1e6);
    simulate();
  }
}
