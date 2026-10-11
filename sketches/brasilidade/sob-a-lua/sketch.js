/**
 * Sob a Lua
 *
 * A study in afro-brasilidade after the contemporary painters of the Black
 * night: a figure with luminous blue-black skin stands with a parasol beneath a
 * gold crescent moon, on the edge of still water that holds the sky. The deep
 * indigo-and-gold rendering of Black skin is the genre's signature gesture.
 * Each load is a new night.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE or click for a new night
 */

const WIDTH = 800;
const HEIGHT = 800;
const HORIZON = Math.round(HEIGHT * 0.66);

const FIG = [40, 46, 100];      // luminous blue-black skin
const FIG_HI = [108, 138, 198]; // moonlight rim / highlight on skin
const GOLD = [233, 187, 96];
const MOON = [244, 214, 138];

let seed = 8;
let rnd, pg;

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rr = (a, b) => a + rnd() * (b - a);
const ri = (a, b) => a + ((rnd() * (b - a + 1)) | 0);

// ---- silhouette figure with a parasol (drawn into buffer g) ----------------
function limb(g, pts, ws) {
  // tapered solid limb through points pts with widths ws (round caps merge)
  g.strokeCap(ROUND); g.strokeJoin(ROUND); g.stroke(FIG[0], FIG[1], FIG[2]);
  for (let i = 0; i < pts.length - 1; i++) {
    g.strokeWeight((ws[i] + ws[i + 1]) / 2);
    g.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
}

function figure(g, cx, feetY, H, parasolTilt, moonX) {
  const Y = (h) => feetY - h * H;     // height in heads above the feet
  const X = (x) => cx + x * H;
  g.noStroke(); g.fill(FIG[0], FIG[1], FIG[2]); g.rectMode(CENTER);

  // legs (slim, clearly two, close together) — slight stance
  limb(g, [[X(-0.5), Y(3.5)], [X(-0.55), Y(1.8)], [X(-0.55), Y(0.1)]], [1.0 * H, 0.85 * H, 0.62 * H]);
  limb(g, [[X(0.5), Y(3.5)], [X(0.55), Y(1.8)], [X(0.6), Y(0.1)]], [1.0 * H, 0.85 * H, 0.62 * H]);
  // feet
  g.ellipse(X(-0.55), Y(0.05), 1.0 * H, 0.42 * H); g.ellipse(X(0.72), Y(0.05), 1.0 * H, 0.42 * H);

  // torso mass (smooth filled shape: shoulders -> waist -> hips), slim
  g.beginShape();
  g.curveVertex(X(-1.32), Y(6.0)); g.curveVertex(X(-1.32), Y(6.0));
  g.curveVertex(X(-0.72), Y(4.5)); g.curveVertex(X(-0.9), Y(3.3));
  g.curveVertex(X(0.9), Y(3.3)); g.curveVertex(X(0.72), Y(4.5));
  g.curveVertex(X(1.32), Y(6.0)); g.curveVertex(X(1.32), Y(6.0));
  g.curveVertex(X(0.45), Y(6.25)); g.curveVertex(X(-0.45), Y(6.25));
  g.curveVertex(X(-1.32), Y(6.0)); g.curveVertex(X(-1.32), Y(6.0));
  g.endShape(CLOSE);

  // neck + head (smaller head, slim neck)
  g.rect(cx, Y(6.35), 0.6 * H, 0.7 * H);
  g.circle(cx, Y(7.0), 1.7 * H);

  // relaxed arm (viewer-right), down along the body
  limb(g, [[X(1.2), Y(5.85)], [X(1.45), Y(4.7)], [X(1.25), Y(3.6)]], [0.7 * H, 0.6 * H, 0.5 * H]);
  // raised arm (viewer-left), up to the parasol handle
  const handX = X(-0.95), handY = Y(7.4);
  limb(g, [[X(-1.2), Y(5.85)], [X(-1.25), Y(6.7)], [handX, handY]], [0.7 * H, 0.62 * H, 0.5 * H]);

  // ---- parasol (gold) ----
  const topX = handX + parasolTilt * H * 0.6, topY = handY - 1.9 * H;
  g.stroke(GOLD[0], GOLD[1], GOLD[2]); g.strokeWeight(H * 0.16); g.strokeCap(ROUND);
  g.line(handX, handY, topX, topY);                       // pole
  const R = 3.4 * H, cyc = topY;
  // canopy: scalloped gold dome
  g.noStroke(); g.fill(GOLD[0], GOLD[1], GOLD[2]);
  g.beginShape();
  const n = 7;
  g.vertex(topX - R, cyc);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = topX - R + 2 * R * t;
    g.vertex(x, cyc + Math.sin(t * Math.PI) * -0.0); // base line
  }
  // dome top
  for (let a = 0; a <= Math.PI; a += Math.PI / 24) g.vertex(topX + Math.cos(a) * R, cyc - Math.sin(a) * R * 0.62);
  g.endShape(CLOSE);
  // scalloped fringe
  g.fill(GOLD[0], GOLD[1], GOLD[2]);
  for (let i = 0; i < n; i++) { const x = topX - R + (2 * R) * ((i + 0.5) / n); g.triangle(x - R / n, cyc, x + R / n, cyc, x, cyc + H * 0.5); }
  // ribs + finial (darker gold)
  g.stroke(150, 110, 40); g.strokeWeight(H * 0.05); g.noFill();
  for (let i = 1; i < n; i++) { const x = topX - R + (2 * R) * (i / n); g.line(topX, cyc - R * 0.6, x, cyc); }
  g.noStroke(); g.fill(GOLD[0], GOLD[1], GOLD[2]); g.circle(topX, cyc - R * 0.62, H * 0.4);

  // ---- moonlight on the blue skin (rim light on the moon side) ----
  const ms = (moonX > cx) ? 1 : -1;
  g.noFill(); g.stroke(FIG_HI[0], FIG_HI[1], FIG_HI[2], 210); g.strokeCap(ROUND);
  g.strokeWeight(H * 0.16);
  g.arc(cx, Y(7.0), 1.7 * H, 1.7 * H, ms > 0 ? -Math.PI / 2 : Math.PI / 2, ms > 0 ? Math.PI / 2 : 3 * Math.PI / 2); // head
  g.strokeWeight(H * 0.14);
  g.line(X(ms * 1.28), Y(5.9), X(ms * 0.86), Y(3.5));   // torso side
  g.line(X(ms * 0.55), Y(3.3), X(ms * 0.58), Y(0.3));   // near leg
  // soft cheek highlight + specular
  g.noStroke(); g.fill(FIG_HI[0], FIG_HI[1], FIG_HI[2], 120); g.circle(cx + ms * 0.4 * H, Y(7.05), 1.0 * H);
  g.fill(200, 218, 245, 210); g.circle(cx + ms * 0.5 * H, Y(7.18), 0.34 * H);
  // faint warm bounce from the gold parasol on the crown
  g.fill(GOLD[0], GOLD[1], GOLD[2], 45); g.ellipse(cx, Y(7.75), 1.5 * H, 0.5 * H);
}

// ---- scene -----------------------------------------------------------------
function drawAbove(g) {
  // sky gradient
  const grad = g.drawingContext.createLinearGradient(0, 0, 0, HORIZON);
  grad.addColorStop(0, 'rgb(7,11,34)');
  grad.addColorStop(0.7, 'rgb(20,30,70)');
  grad.addColorStop(1, 'rgb(46,62,108)');
  g.drawingContext.fillStyle = grad; g.drawingContext.fillRect(0, 0, WIDTH, HORIZON);

  // moon: glow + gold crescent
  const mx = rr(0.2, 0.8) * WIDTH, my = rr(0.16, 0.4) * HORIZON, mr = rr(48, 70);
  const halo = g.drawingContext.createRadialGradient(mx, my, 0, mx, my, mr * 5);
  halo.addColorStop(0, 'rgba(244,214,138,0.5)'); halo.addColorStop(0.25, 'rgba(244,214,138,0.14)'); halo.addColorStop(1, 'rgba(244,214,138,0)');
  g.drawingContext.fillStyle = halo; g.drawingContext.fillRect(0, 0, WIDTH, HORIZON);
  g.noStroke(); g.fill(MOON[0], MOON[1], MOON[2]); g.circle(mx, my, mr * 2);
  const ph = rr(0.45, 0.8); g.fill(9, 14, 42);                    // crescent shadow (sky colour)
  g.circle(mx + mr * ph, my - mr * 0.18, mr * 2);

  // stars
  for (let i = 0; i < 150; i++) {
    const x = rr(0, WIDTH), y = rr(0, HORIZON * 0.95), s = rr(0.6, 2.4);
    const c = rnd() < 0.2 ? GOLD : [225, 232, 250];
    g.noStroke(); g.fill(c[0], c[1], c[2], rr(90, 230)); g.circle(x, y, s);
  }

  // distant tree-line / hills along the horizon
  g.fill(6, 9, 26); g.beginShape(); g.vertex(0, HORIZON);
  let x = 0; while (x <= WIDTH) { g.vertex(x, HORIZON - rr(2, 26)); x += rr(18, 46); }
  g.vertex(WIDTH, HORIZON); g.endShape(CLOSE);

  // the figure at the water's edge (lit from the moon side)
  figure(g, rr(0.42, 0.58) * WIDTH, HORIZON, rr(25, 28), rr(-0.4, 0.4), mx);
}

function draw() {
  rnd = mulberry32(Math.floor(seed) || 1);
  pg.clear();
  drawAbove(pg);
  image(pg, 0, 0);

  // water reflection (mirror the buffer down, with ripple + fade)
  const reflectH = HEIGHT - HORIZON; noStroke();
  for (let yy = 0; yy < reflectH; yy += 2) {
    const depth = yy / reflectH;
    const wob = (1.5 + depth * 7) * Math.sin(yy * 0.06 + seed);
    const srcY = HORIZON - 2 - yy; if (srcY < 0) break;
    image(pg, wob, HORIZON + yy, WIDTH, 2, 0, srcY, WIDTH, 2);
  }
  const fade = drawingContext.createLinearGradient(0, HORIZON, 0, HEIGHT);
  fade.addColorStop(0, 'rgba(14,22,54,0.15)'); fade.addColorStop(1, 'rgba(8,12,36,0.9)');
  drawingContext.fillStyle = fade; drawingContext.fillRect(0, HORIZON, WIDTH, reflectH);

  // waterline glow
  stroke(60, 80, 130, 60); strokeWeight(2); line(0, HORIZON, WIDTH, HORIZON); noStroke();

  // vignette
  drawingContext.save();
  const v = drawingContext.createRadialGradient(WIDTH / 2, HEIGHT * 0.45, HEIGHT * 0.3, WIDTH / 2, HEIGHT * 0.5, HEIGHT * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  drawingContext.fillStyle = v; drawingContext.fillRect(0, 0, WIDTH, HEIGHT);
  drawingContext.restore();
}

function setup() {
  const cnv = createCanvas(WIDTH, HEIGHT);
  cnv.parent('canvas-container');
  pixelDensity(1);
  pg = createGraphics(WIDTH, HORIZON); pg.pixelDensity(1);
  const p = new URLSearchParams(window.location.search);
  if (p.has('seed')) seed = parseInt(p.get('seed'), 10) || seed;
  noLoop();
}

function newNight() { seed = Math.floor(Math.random() * 1e9); redraw(); }
function keyPressed() { if (key === 's' || key === 'S') saveCanvas('sob-a-lua', 'png'); else if (key === ' ') newNight(); }
function mousePressed() { if (mouseX >= 0 && mouseX < WIDTH && mouseY >= 0 && mouseY < HEIGHT) newNight(); }
