/**
 * Calçadão
 *
 * A study in brasilidade: Roberto Burle Marx's iconic Copacabana promenade —
 * the great black-and-white wave the city walks on. The 1970 redesign laid
 * sinuous bands of Portuguese stone (calçada portuguesa) into rolling ondas
 * that read as the sea seen from above. Here those waves are rebuilt stone by
 * stone — thousands of irregular hand-set cobbles over warm grout — and set
 * slowly drifting, so the pavement breathes like the surf it imitates.
 *
 * Modernist Brazil's idea of itself: foreign technique (Portuguese mosaic)
 * digested into something unmistakably its own.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE to reshape the waves (new seed)
 */

const WIDTH = 800;
const HEIGHT = 800;
const LOOP_SECONDS = 18.0; // seamless drift cycle

const TAU = Math.PI * 2;

// Calçada portuguesa palette — warm basalt black, weathered limestone cream.
const STONE_DARK = { h: 38, base: 14, jitter: 18 }; // dark basalt, slight warmth
const STONE_LIGHT = { h: 44, base: 224, jitter: 16 }; // limestone cream
const GROUT = [196, 184, 156]; // sandy mortar between the stones
const BG = [205, 193, 166];

const PITCH = 9; // stone spacing (centre to centre)
const STONE = 7.2; // drawn stone size; gap reveals grout

const BAND = 96; // thickness of one colour wave band
const COLS = Math.ceil(WIDTH / PITCH) + 1;
const ROWS = Math.ceil(HEIGHT / PITCH) + 1;

let seed = 0;

// Optional capture hook: load with ?f=<i>&n=<N> to render exactly one loop
// phase (frame i of N) as a static image. Used to export a seamless GIF and
// reproducible stills; inert during normal interactive viewing.
let captureT = null;

// Normalised loop time in [0,1). Seamless because every wave term completes a
// whole number of cycles per LOOP_SECONDS.
function loopTime() {
  if (captureT !== null) return captureT;
  return (millis() / 1000.0) % LOOP_SECONDS / LOOP_SECONDS;
}

// Cheap deterministic hash in [0,1) — static per stone, so the mosaic texture
// stays put while only the wave phase animates (keeps the loop seamless).
function hash(i, j) {
  let h = (i * 374761393 + j * 668265263 + seed * 144) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 100000) / 100000;
}

// Vertical displacement of the wave field at column x and loop time t∈[0,1).
// Sum of sines (each an integer number of cycles per loop) → drifts forever
// without a seam. Big slow swell + a smaller faster ripple for life.
function waveOffset(x, t) {
  const k1 = (TAU * 1.5) / WIDTH; // grand, sweeping swells across the width
  const k2 = (TAU * 3.0) / WIDTH;
  const a1 = 104;
  const a2 = 12;
  const swell = a1 * Math.sin(k1 * x - TAU * t + seed * 0.7);
  const ripple = a2 * Math.sin(k2 * x - TAU * 2 * t + seed * 1.3);
  return swell + ripple;
}

function setup() {
  const cnv = createCanvas(WIDTH, HEIGHT);
  cnv.parent('canvas-container');
  noStroke();
  rectMode(CENTER);
  pixelDensity(1);

  // Capture entry points (both inert during normal viewing):
  //  - URL ?f=i&n=N renders one static phase (reproducible stills).
  //  - window.__captureFrame(i, N) lets a headless driver step the loop in a
  //    single browser session — far faster than reloading per frame.
  window.__captureFrame = (i, n) => {
    captureT = (((i % n) + n) % n) / n;
    redraw();
  };

  const p = new URLSearchParams(window.location.search);
  if (p.has('f') && p.has('n')) {
    noLoop();
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  const t = loopTime();

  background(BG[0], BG[1], BG[2]);

  // One soft pass of grout shadow under everything for depth between stones.
  for (let cj = 0; cj < ROWS; cj++) {
    const y = cj * PITCH;
    for (let ci = 0; ci < COLS; ci++) {
      const x = ci * PITCH;

      // Which wave band this stone falls in (even = dark, odd = cream).
      const bandPos = (y + waveOffset(x, t)) / BAND;
      const dark = (Math.floor(bandPos) & 1) === 0;
      const spec = dark ? STONE_DARK : STONE_LIGHT;

      // Per-stone tone, size and placement jitter → hand-laid, not printed.
      const r1 = hash(ci, cj);
      const r2 = hash(ci + 7, cj - 3);
      const r3 = hash(ci - 5, cj + 11);

      const tone = spec.base + (r1 - 0.5) * spec.jitter;
      // Subtle warmth: nudge toward the stone's hue tint.
      const warm = (spec.h - 40) * 0.25;
      fill(tone + warm * 0.6, tone + warm * 0.2, tone - warm * 0.8);

      const s = STONE * (0.82 + r2 * 0.3);
      const ox = (r2 - 0.5) * 1.6;
      const oy = (r3 - 0.5) * 1.6;

      square(x + ox, y + oy, s, 1.2); // tiny rounding = tumbled cobble
    }
  }

  // Faint sunlight gradient across the promenade — top-left a touch brighter,
  // bottom-right cooler — to keep the flat mosaic from reading as a print.
  noFill();
  for (let i = 0; i < HEIGHT; i += 4) {
    const a = map(i, 0, HEIGHT, 0, 22);
    stroke(40, 30, 10, a);
    line(0, i, WIDTH, i);
  }
  noStroke();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('calcadao', 'png');
  } else if (key === ' ') {
    seed += 13;
  }
}
