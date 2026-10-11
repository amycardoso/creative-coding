/**
 * ICE
 *
 * Neon #5: after William Gibson's Neuromancer, where data is guarded by ICE,
 * intrusion countermeasures electronics.
 *
 * The ICE is a perfect maze carved by a recursive backtracker around a
 * sealed core: exactly one corridor between any two rooms. A virus cracks
 * a few random walls, then floods the corridors breadth-first from three
 * entry points. Colour is how many steps the virus needed to reach each
 * room, yellow at the breach, violet at the end of its run. It runs out of
 * time before it reaches the core.
 *
 * At the end of the loop the ICE regrows: the cracked walls close, the
 * flood drains, and the attack starts again.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const M = 41, CS = 700 / M, OX = 50, OY = 50;
const CRACK = 0.05, LIMIT = 70;
const LOOP_SECONDS = 14;
const CRACKS = [0.06, 0.16], FLOOD = [0.18, 0.8], DRAIN = [0.86, 0.97];   // phase windows
const BG = [8, 10, 18];
const WALL = [0, 200, 230];
const RAMP = [[255, 226, 0], [255, 120, 30], [255, 46, 136], [140, 70, 255]];

let wallE, wallS, crackE, crackS, dist, ground;
const I = (x, y) => y * M + x;
const C = (M - 1) / 2;
const isCore = (x, y) => Math.abs(x - C) <= 2 && Math.abs(y - C) <= 2;

function carve() {
  wallE = new Uint8Array(M * M).fill(1); wallS = new Uint8Array(M * M).fill(1);
  const seen = new Uint8Array(M * M);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) if (isCore(x, y)) seen[I(x, y)] = 1;
  const st = [[0, 0]]; seen[0] = 1;
  while (st.length) {
    const [x, y] = st[st.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy, dx, dy])
      .filter(([a, b]) => a >= 0 && b >= 0 && a < M && b < M && !seen[I(a, b)]);
    if (!nb.length) { st.pop(); continue; }
    const [a, b, dx, dy] = random(nb);
    if (dx === 1) wallE[I(x, y)] = 0; if (dx === -1) wallE[I(a, b)] = 0;
    if (dy === 1) wallS[I(x, y)] = 0; if (dy === -1) wallS[I(a, b)] = 0;
    seen[I(a, b)] = 1; st.push([a, b]);
  }
  // the virus cracks a few of the remaining walls (never the core's); each crack gets a moment
  crackE = new Float32Array(M * M).fill(-1); crackS = new Float32Array(M * M).fill(-1);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    if (isCore(x, y) || random() > CRACK) continue;
    const when = random();
    if (x < M - 1 && wallE[I(x, y)] && !isCore(x + 1, y)) crackE[I(x, y)] = when;
    else if (y < M - 1 && wallS[I(x, y)] && !isCore(x, y + 1)) crackS[I(x, y)] = when;
  }
  // flood through open corridors and cracked walls
  dist = new Int32Array(M * M).fill(-1);
  const q = [];
  for (const [x, y] of [[0, (M * 0.3) | 0], [M - 1, (M * 0.75) | 0], [(M * 0.6) | 0, 0]]) { dist[I(x, y)] = 0; q.push(I(x, y)); }
  const openE = i => !wallE[i] || crackE[i] >= 0, openS = i => !wallS[i] || crackS[i] >= 0;
  for (let k = 0; k < q.length; k++) {
    const c = q[k], x = c % M, y = (c / M) | 0;
    if (dist[c] >= LIMIT) continue;
    const go = (a, b, open) => {
      if (!open || a < 0 || b < 0 || a >= M || b >= M || isCore(a, b)) return;
      const j = I(a, b);
      if (dist[j] < 0) { dist[j] = dist[c] + 1; q.push(j); }
    };
    go(x + 1, y, x < M - 1 && openE(c)); go(x - 1, y, x > 0 && openE(I(x - 1, y)));
    go(x, y + 1, y < M - 1 && openS(c)); go(x, y - 1, y > 0 && openS(I(x, y - 1)));
  }
}

function ramp(t) {
  t = constrain(t, 0, 0.999) * (RAMP.length - 1);
  const i = Math.floor(t), f = t - i;
  return RAMP[i].map((v, k) => lerp(v, RAMP[i + 1][k], f));
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 5 + noise(x * 0.3, y * 0.3) * 3 + random(-2, 2);
    const i = 4 * (y * W + x);
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

const win = (t, [a, b]) => constrain((t - a) / (b - a), 0, 1);

function renderPhase(t) {
  image(ground, 0, 0);
  const cracked = win(t, CRACKS), front = win(t, FLOOD) * LIMIT, drain = win(t, DRAIN);
  noStroke();
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const i = I(x, y), px = OX + x * CS, py = OY + y * CS;
    if (isCore(x, y)) { fill(240, 250, 255); rect(px, py, CS + 0.5, CS + 0.5); continue; }
    const d = dist[i];
    // the flood drains in the order it arrived
    if (d < 0 || d > front || d < drain * LIMIT * 1.02) continue;
    const c = ramp(d / LIMIT), fresh = front - d < 1.5 && t < FLOOD[1];
    fill(fresh ? 255 : c[0], fresh ? 255 : c[1], fresh ? 255 : c[2]);
    rect(px + 1, py + 1, CS - 2, CS - 2);
  }
  stroke(...WALL); strokeWeight(3); strokeCap(SQUARE);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const i = I(x, y), X = OX + x * CS, Y = OY + y * CS;
    if (isCore(x, y) && (isCore(x + 1, y) || x === M - 1) && (isCore(x, y + 1) || y === M - 1)) continue;
    // a cracked wall is gone between its moment in CRACKS and the regrowth in DRAIN
    const gone = w => w >= 0 && cracked > w && drain < 0.98;
    if (wallE[i] && x < M - 1 && !(isCore(x, y) && isCore(x + 1, y)) && !gone(crackE[i])) line(X + CS, Y, X + CS, Y + CS);
    if (wallS[i] && y < M - 1 && !(isCore(x, y) && isCore(x, y + 1)) && !gone(crackS[i])) line(X, Y + CS, X + CS, Y + CS);
  }
  // a wall flashes pink for a moment as it cracks
  stroke(255, 46, 136); strokeWeight(5);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const i = I(x, y), X = OX + x * CS, Y = OY + y * CS;
    const flash = w => w >= 0 && cracked > w && cracked - w < 0.25 && t < FLOOD[0] + 0.03;
    if (flash(crackE[i])) line(X + CS, Y, X + CS, Y + CS);
    if (flash(crackS[i])) line(X, Y + CS, X + CS, Y + CS);
  }
  stroke(...WALL); strokeWeight(3);
  noFill(); rect(OX, OY, 700, 700);
}

// ---------- timeline (frame-driven; deterministic for capture) ----------
const FPS = 30;
const LOOP_FRAMES = LOOP_SECONDS * FPS;
let frame = 0;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  frameRate(FPS);
  randomSeed(31); noiseSeed(31);
  buildGround();
  carve();

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
  if (key === 's' || key === 'S') saveCanvas('ice', 'png');
}
