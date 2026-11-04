/**
 * Colheita
 *
 * Jogos Vorazes #1.
 *
 * A weighted lottery written as tally marks. Twelve rows, each one a
 * community; each group of marks is one person, and each mark is one more
 * entry of that name in the draw. Hunger rises row by row (with noise), and
 * the hungrier a person is, the more entries they trade for food, so the
 * lower rows fill up with dense, crossed bundles while the top stays sparse.
 *
 * The marks arrive one at a time, in random order, until the page is full.
 * Then the draw: a pointer samples marks uniformly from the whole pool,
 * slowing down until it lands. Every mark has the same chance, which is the
 * point: the person with twenty marks is twenty times likelier to be circled.
 * Two names are drawn, then the page is cleared and a new season begins.
 *
 * ?seed=N fixes the first season (the GIF uses seed 3).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new season
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

const ROWS = 12, TOP = 46, ROW_H = 56, LEFT = 40, RIGHT = 760;
const MARKS_PER_FRAME = 9, DRAW_FRAMES = 70, HOLD = 110;

let marks, groups, order, shown, phase, t, chosen, sheet, pointer;

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
  marks = []; groups = [];
  for (let r = 0; r < ROWS; r++) {
    let x = LEFT;
    const hunger = map(r, 0, ROWS - 1, 0.2, 1) + random(-0.08, 0.08);
    while (x < RIGHT) {
      const n = 1 + floor(pow(random(), 1.6 - hunger) * (2 + hunger * 18) * random(0.5, 1));
      const w = n * 3.4 + floor((n - 1) / 5) * 4 + 8;
      if (x + w > RIGHT) break;
      const g = { x, w, y: TOP + r * ROW_H, marks: [] };
      let mx = x;
      for (let k = 0; k < n; k++) {
        let m;
        if (k % 5 === 4) { // the fifth mark crosses the four before it
          m = { x1: mx - 16 + random(-1, 1), y1: g.y + 30 + random(-2, 2), x2: mx + 1, y2: g.y + 6 + random(-2, 2), w: 1.1, a: 200 };
          mx += 4;
        } else {
          const j = random(-1.2, 1.2);
          m = { x1: mx + j, y1: g.y + 4 + random(2), x2: mx - j + random(-0.6, 0.6), y2: g.y + 32 - random(2), w: random(0.8, 1.4), a: 170 + random(60) };
          mx += 3.4;
        }
        m.g = g; g.marks.push(m); marks.push(m);
      }
      groups.push(g);
      x += w;
    }
  }
  // the fifth mark must not appear before the four it crosses: shuffle groups' arrivals, keep order inside a group
  const tickets = [];
  for (const g of groups) for (let k = 0; k < g.marks.length; k++) tickets.push(g);
  shuffle(tickets, true);
  const next = new Map(groups.map(g => [g, 0]));
  order = tickets.map(g => { const i = next.get(g); next.set(g, i + 1); return g.marks[i]; });
  shown = 0; phase = 'fill'; t = 0; chosen = []; pointer = null;
}

function inkMark(m, col) {
  sheet.stroke(...col, m.a); sheet.strokeWeight(m.w);
  sheet.line(m.x1, m.y1, m.x2, m.y2);
}

function circleGroup(g, k) {
  sheet.noFill(); sheet.stroke(...EMBER); sheet.strokeWeight(1.6);
  sheet.beginShape();
  for (let a = 0; a <= TWO_PI + 0.3; a += 0.15) sheet.curveVertex(g.x + g.w / 2 - 4 + cos(a) * (g.w / 2 + 6) + random(-1.5, 1.5), g.y + 19 + sin(a) * 25 + random(-1.5, 1.5));
  sheet.endShape();
}

function draw() {
  image(paperImg, 0, 0);
  if (phase === 'fill') {
    for (let i = 0; i < MARKS_PER_FRAME && shown < order.length; i++) inkMark(order[shown++], INK);
    if (shown >= order.length) { phase = 'draw'; t = 0; }
  } else if (phase === 'draw') {
    // a uniform pick from every mark on the page, slowing down until it lands
    const every = 1 + floor(pow(t / DRAW_FRAMES, 2) * 10);
    if (t % every === 0) pointer = random(marks);
    t++;
    if (t >= DRAW_FRAMES) {
      chosen.push(pointer.g);
      for (const m of pointer.g.marks) inkMark(m, EMBER);
      circleGroup(pointer.g);
      pointer = null; t = 0;
      if (chosen.length === 2) phase = 'hold';
    }
  } else if (++t > HOLD) restart(floor(random(1e6)));
  image(sheet, 0, 0);
  if (pointer) { stroke(...EMBER); strokeWeight(2.2); line(pointer.x1, pointer.y1, pointer.x2, pointer.y2); }
}
