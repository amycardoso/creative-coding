// Logograma — heptapod ink, after Arrival.
// One circular logogram writes itself in ink on pale fog: a hand-unsteady
// ring exhales branching plumes of ink-in-water, holds its complete form
// with a barely-alive shimmer, then inhales back to nothing. The loop is a
// strict palindrome — frame f renders identically to frame LOOP−f, so it
// plays the same forward and backward, the way heptapods read time.
//
// Every frame is a pure function of (glyph seed, frame): no accumulated
// state, so the loop seam is exact by construction. The GIF captures one
// glyph; the live page writes a different glyph each cycle. Pure math
// stays p5-free for bare-eval Node tests.

// ---------- timeline ----------
const TAU = Math.PI * 2;
const FPS = 60;
const LOOP_FRAMES = 720;                 // 12 s
const GROW = 0.4;                        // t∈[0,0.4] exhale, [0.4,0.6] hold, mirror

// Breathe envelope: 0 at the seam, 1 through the hold, palindromic because
// it depends on t only through min(t, 1−t).
function envelope(f) {
  const t = (((f / LOOP_FRAMES) % 1) + 1) % 1;
  const u = Math.min(t, 1 - t);          // palindrome by construction
  const g = Math.min(1, u / GROW);
  return g * g * (3 - 2 * g);
}

// Every time-varying input to a frame, all palindromic: the envelope plus
// shimmer bases built only from cos(2πkt), which satisfies
// cos(2πk(1−t)) = cos(2πkt).
function frameParams(f) {
  const t = (((f / LOOP_FRAMES) % 1) + 1) % 1;
  return {
    e: envelope(f),
    sh1: Math.cos(TAU * t),
    sh2: Math.cos(2 * TAU * t),
  };
}

// ---------- deterministic randomness ----------
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- glyph generation (pure, seeded) ----------
const WIDTH = 800, HEIGHT = 800;
const RING_R = 195;                      // base ring radius, px

// A glyph: ring polyline (varying width and ink density), ink plumes
// (fans of wiggling filaments leaving the ring), and splatter dots near
// the plume tips. All coordinates are center-relative px.
function makeGlyph(seed) {
  const r = mulberry32((seed * 2654435761) >>> 0);

  // ring shape: low harmonics make it read hand-drawn, integer frequencies
  // keep it exactly closed
  const shape = [], width = [], density = [];
  for (let k = 2; k <= 8; k++) {
    shape.push({ k, amp: ((0.2 + 0.5 * r()) / k) * 0.13, ph: r() * TAU });
    width.push({ k, amp: (0.25 + 0.55 * r()) / k, ph: r() * TAU });
    density.push({ k, amp: (0.2 + 0.5 * r()) / k, ph: r() * TAU });
  }
  const harm = (hs, th) => hs.reduce((s, h) => s + h.amp * Math.sin(h.k * th + h.ph), 0);
  const radiusAt = (th) => RING_R * (1 + harm(shape, th));

  // plume placement first: major blooms locally thicken the ring they grow from
  const np = 5 + Math.floor(r() * 4);
  const nMajor = 1 + Math.floor(r() * 2);
  const plumeSpots = [];
  for (let p = 0; p < np; p++) {
    plumeSpots.push({ th: (p / np) * TAU + (r() - 0.5) * 0.5, major: p < nMajor });
  }
  const angDist = (a, b) => {
    const d = Math.abs((((a - b) % TAU) + TAU) % TAU);
    return Math.min(d, TAU - d);
  };

  const ring = [];
  const STEPS = 540;
  for (let i = 0; i <= STEPS; i++) {
    const th = (i / STEPS) * TAU;
    const rad = radiusAt(th);
    // dramatic thickness swings: blotchy heavy sections against thin wisps,
    // swelling further where a major bloom is anchored
    let w = Math.max(2.5, 13 * (1 + 1.15 * harm(width, th)));
    for (const ps of plumeSpots) {
      if (ps.major) {
        const d = angDist(th, ps.th) / 0.38;
        w += 11 * Math.exp(-d * d);
      }
    }
    if (i === STEPS) {
      ring.push({ ...ring[0] });   // closed loop: endpoint shares the jitter too
    } else {
      ring.push({
        x: Math.cos(th) * rad + (r() - 0.5) * w * 0.35,
        y: Math.sin(th) * rad + (r() - 0.5) * w * 0.35,
        w,
        ink: Math.min(1, Math.max(0.18, 0.6 + 0.7 * harm(density, th))),
        j1: r() * TAU,
        j2: r() * TAU,
      });
    }
  }

  // plumes: smoky ink blooms leaving the ring — one or two dominant masses
  // (like the movie's logograms) plus smaller wisps, a few turned inward.
  // A major bloom anchors its filaments across a wide arc of the ring, the
  // middle ones longest, so it reads as one flame-shaped mass fraying into
  // wisps rather than a tassel from a point.
  const plumes = [];
  for (let p = 0; p < np; p++) {
    const { th, major } = plumeSpots[p];
    const outward = major || r() < 0.75;   // majors always bloom outward
    const len = major
      ? RING_R * (0.45 + 0.17 * r())
      : outward
        ? RING_R * (0.16 + 0.18 * r())
        : RING_R * (0.12 + 0.12 * r());
    const dir = outward ? 1 : -1;
    const fanArc = major ? 0.5 + 0.3 * r() : 0.04 + 0.05 * r();
    const nf = major ? 10 + Math.floor(r() * 5) : 3 + Math.floor(r() * 3);
    const filaments = [];
    for (let fi = 0; fi < nf; fi++) {
      const u = nf > 1 ? fi / (nf - 1) - 0.5 : 0;   // −0.5..0.5 across the base
      const thF = th + fanArc * u;
      const rad = radiusAt(thF);
      // length profile: longest in the middle of the arc, frayed at the sides
      const lenF = len * (major ? 0.35 + 0.65 * Math.cos(Math.PI * u) : 1) * (0.85 + 0.3 * r());
      const wig = [
        { k: 1 + Math.floor(r() * 2), amp: 0.08 + 0.10 * r(), ph: r() * TAU },
        { k: 3 + Math.floor(r() * 3), amp: 0.03 + 0.05 * r(), ph: r() * TAU },
      ];
      const w0 = major ? 10 + 6 * r() : 4.5 + 3 * r();
      const pts = [];
      const NPTS = 48;
      for (let j = 0; j < NPTS; j++) {
        const s = j / (NPTS - 1);
        const d = rad + dir * lenF * Math.pow(s, 0.9);
        const lat = lenF * s * wig.reduce((a, w) => a + w.amp * Math.sin(w.k * s * TAU * 0.5 + w.ph), 0);
        // fuzz: a seeded jitter per point turns dotted chains into ink smoke
        const jx = (r() - 0.5) * w0 * 0.9;
        const jy = (r() - 0.5) * w0 * 0.9;
        const px = Math.cos(thF) * d - Math.sin(thF) * lat + jx;
        const py = Math.sin(thF) * d + Math.cos(thF) * lat + jy;
        pts.push({ x: px, y: py, r: w0 * (1 - 0.7 * s), a: Math.pow(1 - s, 0.5), s });
      }
      filaments.push(pts);
    }
    plumes.push({ stagger: major ? 0.12 + 0.15 * r() : 0.2 + 0.3 * r(), filaments });

    // splatter beyond the outward tips
    if (outward) {
      const nspl = 1 + Math.floor(r() * 3);
      for (let sp = 0; sp < nspl; sp++) {
        const d = radiusAt(th) + len * (1.02 + 0.18 * r());
        const lat = (r() - 0.5) * len * 0.5;
        splatsScratch.push({
          x: Math.cos(th) * d - Math.sin(th) * lat,
          y: Math.sin(th) * d + Math.cos(th) * lat,
          size: 1.6 + 3.4 * r(),
          stagger: 0.45 + 0.25 * r(),
        });
      }
    }
  }
  const splats = splatsScratch.splice(0, splatsScratch.length);
  return { ring, plumes, splats };
}
const splatsScratch = [];

// ---------- rendering ----------
const GIF_SEED = 7;
const INK = [30, 28, 32];
const WASH = [96, 86, 76];   // warm sepia for the bleed halo
const PAPER = [233, 230, 223];
let frame = 0;        // capture frame index
let liveFrame = 0;
let captureMode = false;
let glyphSeed = GIF_SEED;
let glyph = null;

function stamp(x, y, rad, alpha, col = INK) {
  fill(col[0], col[1], col[2], alpha * 255);
  circle(x, y, rad * 2);
}

function drawGlyph(f) {
  const { e, sh1, sh2 } = frameParams(f);
  background(PAPER[0], PAPER[1], PAPER[2]);

  // faint fog vignette
  noStroke();
  for (let i = 0; i < 4; i++) {
    fill(210, 206, 198, 14);
    circle(WIDTH / 2, HEIGHT / 2, WIDTH * (1.9 - i * 0.18));
  }
  if (e <= 0) return;

  push();
  translate(WIDTH / 2, HEIGHT / 2);

  const ringReveal = Math.min(1, e * 1.5);
  const rr = ringReveal * ringReveal * (3 - 2 * ringReveal);
  const breathe = 0.985 + 0.015 * rr;

  // the ring in three watercolor passes: wide wash, mid bleed, dense core.
  // Shimmer phases are seeded per point, so nothing ripples in lockstep.
  for (const [scale, alpha, col] of [[2.0, 0.035, WASH], [1.05, 0.10, WASH], [0.55, 0.42, INK]]) {
    for (let i = 0; i < glyph.ring.length; i++) {
      const p = glyph.ring[i];
      const wob = 1.1 * (sh1 * Math.sin(p.j1) + sh2 * Math.sin(p.j2));
      const x = p.x * breathe + wob, y = p.y * breathe + wob * 0.7;
      stamp(x, y, p.w * scale, alpha * Math.pow(p.ink, 1.4) * rr, col);
    }
  }

  // the plumes: each filament extends with the envelope past its stagger
  for (const pl of glyph.plumes) {
    const q = Math.min(1, Math.max(0, (e - pl.stagger) / (0.92 - pl.stagger)));
    if (q <= 0) continue;
    for (const fil of pl.filaments) {
      for (const p of fil) {
        if (p.s > q) break;
        const wob = 1.4 * p.s * (sh1 * Math.sin(p.x * 0.05) + sh2 * Math.cos(p.y * 0.05));
        const x = p.x + wob, y = p.y + wob * 0.8;
        stamp(x, y, p.r * 1.6, 0.05 * p.a);
        stamp(x, y, p.r * 0.6, 0.42 * p.a);
      }
      // ink gathers at the leading tip while the filament is writing
      if (q < 1) {
        const tipIdx = Math.min(fil.length - 1, Math.floor(q * (fil.length - 1)));
        const tip = fil[tipIdx];
        stamp(tip.x, tip.y, tip.r * 1.7, 0.30);
      }
    }
  }

  // splatter pops as the nearby plume completes
  for (const sp of glyph.splats) {
    const q = Math.min(1, Math.max(0, (e - sp.stagger) / 0.08));
    if (q <= 0) continue;
    stamp(sp.x, sp.y, sp.size * (0.6 + 0.4 * q), 0.45 * q);
  }

  pop();
}

function setup() {
  const c = createCanvas(WIDTH, HEIGHT);
  c.parent("canvas-container");
  pixelDensity(1);
  glyph = makeGlyph(glyphSeed);

  const p = new URLSearchParams(window.location.search);
  if (p.has("seed")) {
    glyphSeed = parseInt(p.get("seed"), 10);
    glyph = makeGlyph(glyphSeed);
  }

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = (i, n) => {
    captureMode = true;
    frame = Math.floor(((((i % n) + n) % n) / n) * LOOP_FRAMES);
    redraw();
  };

  if (p.has("f") && p.has("n")) {
    captureMode = true;
    noLoop();
    window.__captureFrame(parseInt(p.get("f"), 10), Math.max(1, parseInt(p.get("n"), 10)));
  }
}

function draw() {
  if (captureMode) {
    drawGlyph(frame);
  } else {
    // live: a different glyph each breath — an endless sentence
    if (liveFrame > 0 && liveFrame % LOOP_FRAMES === 0) {
      glyphSeed++;
      glyph = makeGlyph(glyphSeed);
    }
    drawGlyph(liveFrame % LOOP_FRAMES);
    liveFrame++;
  }
}

function keyPressed() {
  if (key === "s" || key === "S") saveCanvas("logograma", "png");
}
