/**
 * Quatro Notas
 *
 * Jogos Vorazes #5.
 *
 * The cultural evolution of a four-note motif. A line of 24 singers (it wraps
 * around, like a ring), 34 generations, read top to bottom like a score.
 * At first everyone sings their own random phrase, and only one singer
 * knows the motif. Each generation, every singer learns from someone in the
 * previous one within two seats: most of the time they copy whatever is most
 * common around them (conformity), sometimes a random neighbour, and when
 * the motif is within earshot it has a slight pull of its own. Copies are
 * not perfect: now and then a note slips a step up or down.
 *
 * The motif is printed in ember and every other phrase in ink, so the score
 * shows lineages: the motif spreading, being lost to a mutation, a local
 * dialect holding its ground, the motif coming back from one surviving
 * singer. Each run is a different history.
 *
 * ?seed=N fixes the first score (the GIF uses seed 2).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new score
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

const SINGERS = 24, GENS = 34, OX = 40, OY = 36, CW = 720 / SINGERS, CH = 728 / GENS;
const MOTIF = [2, 5, 4, 0], FRAMES_PER_GEN = 5, HOLD = 110;
const CONFORM = 0.55, PULL = 0.12, SLIP = 0.09;

let score, sheet, g, t;
const sig = m => m.join('');

function setup() {
  const c = createCanvas(W, H);
  c.parent('canvas-container');
  pixelDensity(1);
  restart(pickSeed());
}

function restart(s) {
  seed = s; randomSeed(seed); noiseSeed(seed);
  makePaper();
  if (sheet) sheet.remove();
  sheet = createGraphics(W, H); sheet.pixelDensity(1);
  const first = floor(random(SINGERS));
  let gen = [];
  for (let i = 0; i < SINGERS; i++) gen.push(i === first ? MOTIF.slice() : [0, 1, 2, 3].map(() => floor(random(7))));
  score = [gen];
  for (let k = 1; k < GENS; k++) {
    const prev = score[k - 1], nx = [];
    for (let i = 0; i < SINGERS; i++) {
      const nb = []; for (let d = -2; d <= 2; d++) nb.push(prev[(i + d + SINGERS) % SINGERS]);
      const cnt = {}; for (const m of nb) cnt[sig(m)] = (cnt[sig(m)] || 0) + 1;
      let pick = random() < CONFORM ? nb.reduce((a, b) => cnt[sig(b)] > cnt[sig(a)] ? b : a) : random(nb);
      if (nb.some(m => sig(m) === sig(MOTIF)) && random() < PULL) pick = MOTIF;
      pick = pick.slice();
      if (random() < SLIP) { const n = floor(random(4)); pick[n] = constrain(pick[n] + (random() < 0.5 ? -1 : 1), 0, 6); }
      nx.push(pick);
    }
    score.push(nx);
  }
  g = 0; t = 0;
}

function phrase(m, i, k) {
  const x0 = OX + i * CW + 4, y0 = OY + k * CH, motif = sig(m) === sig(MOTIF), col = motif ? EMBER : INK;
  sheet.stroke(...INK, 40); sheet.strokeWeight(0.5);
  for (let l = 0; l < 3; l++) sheet.line(x0, y0 + 4 + l * 6, x0 + CW - 8, y0 + 4 + l * 6);
  sheet.stroke(...col, motif ? 255 : 170); sheet.strokeWeight(motif ? 1.6 : 1); sheet.noFill();
  sheet.beginShape();
  for (let n = 0; n < 4; n++) sheet.vertex(x0 + 2 + n * (CW - 12) / 3 + random(-0.4, 0.4), y0 + 16 - m[n] * 2 + random(-0.4, 0.4));
  sheet.endShape();
  sheet.noStroke(); sheet.fill(...col, motif ? 255 : 200);
  for (let n = 0; n < 4; n++) sheet.circle(x0 + 2 + n * (CW - 12) / 3, y0 + 16 - m[n] * 2, motif ? 4 : 3);
}

function draw() {
  if (g < GENS) {
    // a generation is sung left to right over a few frames
    const from = floor(t / FRAMES_PER_GEN * SINGERS), to = floor((t + 1) / FRAMES_PER_GEN * SINGERS);
    for (let i = from; i < to; i++) phrase(score[g][i], i, g);
    if (++t >= FRAMES_PER_GEN) { t = 0; g++; }
  } else if (++t > HOLD) restart(floor(random(1e6)));
  image(paperImg, 0, 0);
  image(sheet, 0, 0);
}
