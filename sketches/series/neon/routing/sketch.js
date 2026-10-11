/**
 * Routing
 *
 * Neon #1: wires that have to get out of each other's way.
 *
 * A board with 190 pairs of pads. A maze router (Lee's algorithm: a
 * breadth-first wave that floods out from one pad until it touches the
 * other) connects them one at a time, in a fixed order. Each wire is the
 * shortest path that avoids every wire laid before it, so the first ones
 * run almost straight and the late ones snake around the city the others
 * built. You can watch the search wave spread before each wire is laid.
 *
 * Colour = detour: cyan wires are close to the straight line between their
 * pads, pink ones had to travel more than twice as far.
 *
 * At the end of the loop the board is wiped and the routing starts over.
 *
 * Controls:
 * - Press S to save a PNG
 */

const W = 800, H = 800;
const G = 116, CS = 700 / G, OX = 50, OY = 50;
const NETS = 190;
const LOOP_SECONDS = 16;
const BUILD = 0.86;              // share of the loop spent routing
const WAVE = 18, LAY = 14;       // frames each net spends searching / being laid
const BG = [14, 18, 30];
const RAMP = [[0, 200, 230], [60, 230, 110], [255, 226, 0], [255, 120, 30], [255, 46, 136]];

let nets = [], ground;

function route() {
  const used = new Int32Array(G * G).fill(-1);
  const I = (x, y) => y * G + x;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const freePt = () => {
    for (;;) {
      const x = 2 + (random(G - 4) | 0), y = 2 + (random(G - 4) | 0);
      let ok = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (used[I(x + dx, y + dy)] >= 0) ok = false;
      if (ok) return [x, y];
    }
  };
  // reserve every pad first so no wire can run over a pad that is not its own
  const pairs = [];
  for (let n = 0; n < NETS; n++) {
    const a = freePt(); used[I(...a)] = n;
    let b; do { b = freePt(); } while (dist(...a, ...b) < 8 || dist(...a, ...b) > 45);
    used[I(...b)] = n; pairs.push({ a, b });
  }
  const d = new Int32Array(G * G), prev = new Int32Array(G * G);
  for (let n = 0; n < NETS; n++) {
    const { a, b } = pairs[n];
    d.fill(-1);
    const src = I(...a), tgt = I(...b), q = [src];
    d[src] = 0; let found = false;
    for (let h = 0; h < q.length && !found; h++) {
      const c = q[h], cx = c % G, cy = (c / G) | 0;
      for (const [dx, dy] of dirs) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= G || y >= G) continue;
        const j = I(x, y);
        if (d[j] >= 0 || (used[j] >= 0 && j !== tgt)) continue;
        // a diagonal step may not squeeze between two foreign wires
        if (dx && dy) {
          const s1 = used[I(cx + dx, cy)], s2 = used[I(cx, cy + dy)];
          if (s1 >= 0 && s1 !== n && s2 >= 0 && s2 !== n) continue;
        }
        d[j] = d[c] + 1; prev[j] = c; q.push(j);
        if (j === tgt) { found = true; break; }
      }
    }
    if (!found) continue;
    const path = [];
    for (let c = tgt; ; c = prev[c]) { path.unshift(c); if (c === src) break; }
    for (const c of path) used[c] = n;
    let L = 0;
    for (let i = 1; i < path.length; i++) L += dist(path[i] % G, (path[i] / G) | 0, path[i - 1] % G, (path[i - 1] / G) | 0);
    // the explored wave, kept as cells with their distance from the first pad
    const wave = q.map(c => [c, d[c]]), reach = d[tgt];
    nets.push({ a, b, path, len: L, ratio: L / dist(...a, ...b), wave, reach, col: rampColour(L / dist(...a, ...b)) });
  }
  // schedule: nets start one after another, overlapping
  const span = Math.round(LOOP_FRAMES * BUILD) - WAVE - LAY;
  nets.forEach((net, k) => { net.start = Math.round(k / (nets.length - 1) * span); });
}

function rampColour(r) {
  const t = constrain((r - 1) / 1.6, 0, 0.999) * (RAMP.length - 1), i = Math.floor(t), f = t - i;
  return RAMP[i].map((v, k) => lerp(v, RAMP[i + 1][k], f));
}

function buildGround() {
  ground = createGraphics(W, H); ground.pixelDensity(1);
  ground.loadPixels();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x * 0.01, y * 0.01) * 7 + noise(x * 0.3, y * 0.3) * 4 + random(-3, 3);
    const i = 4 * (y * W + x);
    ground.pixels[i] = BG[0] + n; ground.pixels[i + 1] = BG[1] + n; ground.pixels[i + 2] = BG[2] + n; ground.pixels[i + 3] = 255;
  }
  ground.updatePixels();
}

const px = c => OX + (c % G + 0.5) * CS, py = c => OY + (((c / G) | 0) + 0.5) * CS;

function drawPad(p, col, a) {
  noStroke(); fill(col[0], col[1], col[2], a);
  circle(OX + (p[0] + 0.5) * CS, OY + (p[1] + 0.5) * CS, CS * 1.9);
  fill(BG[0], BG[1], BG[2]); circle(OX + (p[0] + 0.5) * CS, OY + (p[1] + 0.5) * CS, CS * 0.8);
}

function renderPhase(t) {
  image(ground, 0, 0);
  const f = t * LOOP_FRAMES, end = LOOP_FRAMES * BUILD;
  const wipe = f > end ? (f - end) / (LOOP_FRAMES - end) : 0;     // 0..1 board fades out
  const alpha = 255 * (1 - constrain(wipe * 1.4, 0, 1));
  strokeJoin(ROUND); strokeCap(ROUND);
  for (const net of nets) {
    const lf = f - net.start;
    if (lf < 0) break;
    const c = net.col;
    if (lf < WAVE + 4) {
      // search wave: cells already reached by the breadth-first flood
      const front = net.reach * Math.min(1, lf / WAVE), fade = lf > WAVE ? 1 - (lf - WAVE) / 4 : 1;
      noStroke();
      for (const [cell, dd] of net.wave) {
        if (dd > front) break;
        const edge = front - dd < 1.5 ? 1 : 0.18;
        fill(c[0], c[1], c[2], 120 * edge * fade);
        rect(px(cell) - CS / 2, py(cell) - CS / 2, CS, CS);
      }
    }
    if (lf >= WAVE) {
      // the wire is laid from pad to pad along the path found
      const k = Math.min(net.path.length, Math.floor((lf - WAVE) / LAY * net.path.length) + 1);
      noFill(); stroke(c[0], c[1], c[2], alpha); strokeWeight(CS * 0.55);
      beginShape(); for (let i = 0; i < k; i++) vertex(px(net.path[i]), py(net.path[i])); endShape();
    }
    drawPad(net.a, c, alpha); drawPad(net.b, c, alpha);
  }
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
  randomSeed(11); noiseSeed(11);
  buildGround();
  route();

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
  if (key === 's' || key === 'S') saveCanvas('routing', 'png');
}
