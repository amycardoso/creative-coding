/**
 * Tributo
 *
 * Jogos Vorazes #4.
 *
 * A drainage network. Fifteen hundred points are scattered over twelve
 * sectors around a centre, and every point produces something; how much
 * depends on its sector. A tree grows outward from the centre with Prim's
 * algorithm: at each step the cheapest unconnected point joins the network,
 * where the cost is distance bent by a noise field and a pull toward the
 * centre. The tree is drawn as it grows, in thin ink.
 *
 * Then everything flows. Each point sends what it produced, plus everything
 * it received, to its parent, level by level from the tips inward, and every
 * stretch of the network is redrawn as thick as what passes through it. The
 * thickest lines turn ember as they near the centre, which produces nothing
 * and receives all of it.
 *
 * ?seed=N fixes the first network (the GIF uses seed 3).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new network
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

const CX = 400, CY = 400, N_PTS = 1500, GROW_PER_FRAME = 14, HOLD = 110;

let P, par, order, height, flow, maxF, maxH, shown, level, phase, t, bend;

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed);
  makePaper();
  const sect = []; for (let k = 0; k < 12; k++) sect.push(random(0.3, 1.6));
  P = [{ x: CX, y: CY, yield: 0 }];
  while (P.length < N_PTS) {
    const a = random(TWO_PI), r = 30 + sqrt(random()) * 340;
    P.push({ x: CX + cos(a) * r, y: CY + sin(a) * r, yield: sect[floor(a / TWO_PI * 12)] * random(0.5, 1.5) });
  }
  const n = P.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(1e18);
  par = new Int32Array(n).fill(-1);
  const cost = (i, j) => {
    const d = dist(P[i].x, P[i].y, P[j].x, P[j].y);
    return d * (0.6 + noise((P[i].x + P[j].x) * 0.004, (P[i].y + P[j].y) * 0.004) * 1.4) + 0.12 * dist(P[i].x, P[i].y, CX, CY);
  };
  let cur = 0; inT[0] = 1; order = [0];
  for (let k = 1; k < n; k++) {
    for (let j = 0; j < n; j++) if (!inT[j]) { const c = cost(cur, j); if (c < best[j]) { best[j] = c; par[j] = cur; } }
    let b = -1; for (let j = 0; j < n; j++) if (!inT[j] && (b < 0 || best[j] < best[b])) b = j;
    inT[b] = 1; order.push(b); cur = b;
  }
  // flow accumulation and each node's height above its farthest tip
  flow = P.map(p => p.yield); height = new Int32Array(n);
  for (let k = n - 1; k > 0; k--) {
    const i = order[k], j = par[i];
    flow[j] += flow[i]; height[j] = max(height[j], height[i] + 1);
  }
  maxF = flow[0]; maxH = height[0];
  bend = P.map(() => [random(-2, 2), random(-2, 2)]);
  shown = 1; level = -1; phase = 'grow'; t = 0;
}

function edge(i, w, col, a) {
  const j = par[i];
  stroke(...col, a); strokeWeight(w); strokeCap(ROUND); noFill();
  beginShape(); vertex(P[i].x, P[i].y);
  quadraticVertex((P[i].x + P[j].x) / 2 + bend[i][0], (P[i].y + P[j].y) / 2 + bend[i][1], P[j].x, P[j].y);
  endShape();
}

function draw() {
  if (phase === 'grow') { shown = min(order.length, shown + GROW_PER_FRAME); if (shown === order.length) phase = 'flow'; }
  else if (phase === 'flow') { level++; if (level >= maxH) phase = 'hold'; }
  else if (++t > HOLD) { restart(floor(random(1e6))); return; }

  image(paperImg, 0, 0);
  for (let k = 1; k < shown; k++) {
    const i = order[k];
    if (height[i] <= level) {
      const f = min(1, flow[i] / maxF * 6);
      edge(i, 0.5 + 15 * sqrt(flow[i] / maxF), [lerp(INK[0], EMBER[0], f * f), lerp(INK[1], EMBER[1], f * f), lerp(INK[2], EMBER[2], f * f)], 225);
    } else edge(i, 0.6, INK, 120);
  }
  noStroke();
  for (let k = 1; k < shown; k++) { const p = P[order[k]]; fill(...INK, 160); circle(p.x, p.y, 1.5 + p.yield); }
  const got = level < 0 ? 0 : constrain(level / maxH, 0, 1);
  fill(...EMBER); circle(CX, CY, 8 + 18 * got);
}
