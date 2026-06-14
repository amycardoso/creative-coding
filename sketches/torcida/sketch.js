/**
 * Torcida
 *
 * The crowd is the flag. A Copa do Mundo "mosaico de torcida": a whole stand of
 * supporters holds up coloured cards that together form the bandeira do Brasil —
 * green field, yellow lozenge, blue globe, the white banner and its stars. An
 * "ola" (Mexican wave) sweeps across the terraces in a seamless loop, the fans
 * in the wave-front rising — cards lifting, swelling, catching the light —
 * while camera flashes spark through the crowd. Brasilidade as collective joy.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new crowd (stars, flashes, wave angle)
 */

const WIDTH = 800;
const HEIGHT = 800;
const LOOP_SECONDS = 10.0;
const TAU = Math.PI * 2;

const N = 70;                    // cards per side
const PITCH = WIDTH / N;
const CARD = PITCH - 2.4;

const GREEN = [0, 151, 57];
const YELLOW = [254, 221, 0];
const BLUE = [0, 39, 118];
const WHITE = [245, 246, 240];
const DARK = [9, 11, 15];

let seed = 7;
let grid;        // base flag colour per cell
let flashes;     // [{r,c,phase}]
let slope = 0.16;

let captureT = null;
function loopTime() {
  if (captureT !== null) return captureT;
  return (millis() / 1000.0) % LOOP_SECONDS / LOOP_SECONDS;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Colour of the Brazil flag sampled at normalized (u,v).
function flagColor(u, v) {
  const dx = u - 0.5, dy = v - 0.5;
  const inLoz = Math.abs(dx) / 0.45 + Math.abs(dy) / 0.43 <= 1;
  const inGlobe = dx * dx + dy * dy <= 0.25 * 0.25;
  // White banner: arc of a large circle centred below, crossing the globe.
  const bandDist = Math.hypot(u - 0.5, v - 1.0);
  const onBand = Math.abs(bandDist - 0.55) < 0.045;
  if (inGlobe && onBand) return WHITE;
  if (inGlobe) return BLUE;
  if (inLoz) return YELLOW;
  return GREEN;
}

function build(s) {
  const rnd = mulberry32(Math.floor(s) || 1);
  grid = [];
  for (let r = 0; r < N; r++) {
    grid[r] = [];
    for (let c = 0; c < N; c++) grid[r][c] = flagColor((c + 0.5) / N, (r + 0.5) / N);
  }
  // Scatter ~27 stars in the blue globe (avoiding the banner).
  let placed = 0, guard = 0;
  while (placed < 27 && guard++ < 2000) {
    const c = (rnd() * N) | 0, r = (rnd() * N) | 0;
    const u = (c + 0.5) / N, v = (r + 0.5) / N, dx = u - 0.5, dy = v - 0.5;
    if (dx * dx + dy * dy <= 0.22 * 0.22 && Math.abs(Math.hypot(u - 0.5, v - 1.0) - 0.55) > 0.07) {
      grid[r][c] = WHITE; placed++;
    }
  }
  // Camera flashes sprinkled through the crowd.
  flashes = [];
  const nf = 60;
  for (let i = 0; i < nf; i++) flashes.push({ r: (rnd() * N) | 0, c: (rnd() * N) | 0, phase: rnd() * TAU, sp: 2 + ((rnd() * 3) | 0) });
  slope = 0.10 + rnd() * 0.18;
}

const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function setup() {
  const cnv = createCanvas(WIDTH, HEIGHT);
  cnv.parent('canvas-container');
  pixelDensity(1);
  rectMode(CENTER);
  const p = new URLSearchParams(window.location.search);
  if (p.has('seed')) seed = parseInt(p.get('seed'), 10) || seed;
  build(seed);
  window.__captureFrame = (i, n) => { captureT = (((i % n) + n) % n) / n; redraw(); };
  if (p.has('f') && p.has('n')) {
    noLoop();
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  const t = loopTime();
  background(DARK[0], DARK[1], DARK[2]);
  noStroke();

  const front = t * 1.0;        // wave sweeps once across the loop
  const sig = 0.05;

  // flash lookup
  const flashAt = {};
  for (const f of flashes) flashAt[f.r * N + f.c] = Math.pow(0.5 + 0.5 * Math.sin(TAU * t * f.sp + f.phase), 10);

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const u = (c + 0.5) / N, v = (r + 0.5) / N;
      const pos = ((u + slope * (v - 0.5)) % 1 + 1) % 1;
      let dd = Math.abs(pos - front); dd = Math.min(dd, 1 - dd);
      const raise = Math.exp(-(dd * dd) / (2 * sig * sig));

      const base = grid[r][c];
      const fl = flashAt[r * N + c] || 0;
      // resting fans a touch dim; the wave-front lifts and brightens them.
      let col = lerpC(base, [12, 14, 20], 0.16 * (1 - raise));
      col = lerpC(col, [255, 255, 255], raise * 0.30 + fl * 0.9);

      const size = CARD * (0.84 + raise * 0.30 + fl * 0.1);
      const x = (c + 0.5) * PITCH;
      const y = (r + 0.5) * PITCH - raise * PITCH * 0.55;

      if (raise > 0.12) { fill(0, 0, 0, 70 * raise); rect(x, y + raise * PITCH * 0.4 + 2, size, size, 2); }
      fill(col[0], col[1], col[2]);
      rect(x, y, size, size, 2.5);
      if (raise > 0.25) { fill(255, 255, 255, 60 * raise); rect(x, y - size * 0.28, size * 0.8, size * 0.18, 1.5); }
    }
  }

  // soft stadium vignette
  drawingContext.save();
  const g = drawingContext.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.35, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.4)');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, WIDTH, HEIGHT);
  drawingContext.restore();
}

function reseed() { seed = Math.floor(Math.random() * 1e9); build(seed); if (captureT !== null) redraw(); }
function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('torcida', 'png');
  else if (key === ' ') reseed();
}
function mousePressed() { if (mouseX >= 0 && mouseX < WIDTH && mouseY >= 0 && mouseY < HEIGHT) reseed(); }
