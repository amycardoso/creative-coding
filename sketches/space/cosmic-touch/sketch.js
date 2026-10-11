/*
 *  Cosmic Touch
 *  Michelangelo's Creation of Adam — hands dissolve into an animated cosmic nebula.
 *  Hybrid: WEBGL shader for nebula, 2D canvas for PNG alpha compositing.
 *  Generative: edge-dissolution particles, energy arcs, cosmic dust.
 */

P5Capture.setDefaultOptions({
  format: "webm",
  framerate: 30,
  quality: 1.0,
  width: 900,
});

const W = 900;
const H = 600;

let handsImg;
let nebulaGfx, nebulaShader;
let scanOverlay;
let vignetteOverlay;

// Edge data from image alpha channel
let edgeData = [];

// Particle systems
const EDGE_COUNT = 400;
const DUST_COUNT = 50;
let edgeParts = [];
let dustParts = [];

// Image placement (computed in setup)
let imgScale, imgH, imgY;

// Fingertip coords as fraction of image
const LEFT_TIP = { x: 0.445, y: 0.63 };
const RIGHT_TIP = { x: 0.540, y: 0.58 };

// ─── Vertex shader ────────────────────────────────────
const vertSrc = `
attribute vec3 aPosition;
void main() {
  vec4 pos = vec4(aPosition, 1.0);
  pos.xy = pos.xy * 2.0 - 1.0;
  gl_Position = pos;
}
`;

// ─── Fragment shader: nebula + stars ──────────────────
const fragSrc = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float val = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < 6; i++) {
    val += amp * noise(p * freq);
    amp *= 0.5; freq *= 2.0;
  }
  return val;
}

// Single-warp FBM — soft gas clouds, NOT marble swirls
float gasCloud(vec2 p, float t, float drift) {
  vec2 q = vec2(
    fbm(p + vec2(t * drift, t * drift * 0.7)),
    fbm(p + vec2(3.7, 8.1) + t * drift * 0.6)
  );
  return fbm(p + 2.5 * q);
}

vec3 nebula(vec2 uv, float t) {
  // Deep void base
  vec3 col = vec3(0.02, 0.0, 0.06);

  // Radial mask — nebula concentrates toward center, fades at edges
  float radial = 1.0 - smoothstep(0.15, 0.65, length(uv - 0.5));

  // Layer 1: large-scale gas clouds
  float g1 = gasCloud(uv * 2.5, t, 0.06);
  g1 = smoothstep(0.25, 0.75, g1);
  vec3 deep = mix(vec3(0.06, 0.0, 0.14), vec3(0.22, 0.08, 0.42), g1);
  col = mix(col, deep, 0.7 * radial + 0.3);

  // Layer 2: medium wisps (different offset, faster)
  float g2 = gasCloud(uv * 4.0 + vec2(12.3, 7.8), t, 0.09);
  g2 = smoothstep(0.3, 0.8, g2);
  vec3 mid = vec3(0.30, 0.18, 0.55);
  col = mix(col, mid, g2 * 0.45 * (radial * 0.7 + 0.3));

  // Layer 3: fine detail wisps (higher freq)
  float g3 = gasCloud(uv * 7.0 + vec2(5.5, 2.2), t, 0.12);
  g3 = smoothstep(0.35, 0.85, g3);
  vec3 fine = vec3(0.40, 0.35, 0.72);
  col += fine * g3 * 0.18 * radial;

  // Subtle warm glow near center (where the divine energy is)
  float center = smoothstep(0.3, 0.0, length(uv - vec2(0.5, 0.48)));
  col += vec3(0.12, 0.06, 0.18) * center;

  // Sky blue / periwinkle highlight in brighter regions
  float bright = max(g1, g2) * radial;
  col += vec3(0.05, 0.08, 0.14) * smoothstep(0.4, 0.8, bright);

  return col;
}

float stars(vec2 uv, float t) {
  float r = 0.0;
  for (int l = 0; l < 3; l++) {
    float s = 35.0 + float(l) * 25.0;
    vec2 g = floor(uv * s);
    vec2 f = fract(uv * s);
    float h = hash21(g + float(l) * 137.0);
    if (h > 0.96) {
      vec2 sp = hash22(g + float(l) * 200.0);
      float d = length(f - sp);
      float b = smoothstep(0.07, 0.0, d);
      float tw = 0.5 + 0.5 * sin(t * (1.5 + h * 5.0) + h * 80.0);
      r += b * tw * (0.4 + h * 0.6);
      if (h > 0.993) r += smoothstep(0.18, 0.0, d) * 0.12 * tw;
    }
  }
  return r;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 d = vec2(uv.x, 1.0 - uv.y);
  float t = u_time;

  vec3 col = nebula(d, t);
  col += vec3(0.95, 0.90, 1.0) * stars(d, t);

  // Film grain
  float grain = (hash21(d * u_resolution + fract(t * 100.0)) - 0.5) * 0.04;
  col += grain;

  // Subtle vignette (main vignette applied in 2D over entire composition)
  float vig = 1.0 - length(d - 0.5) * 0.35;
  col *= smoothstep(0.0, 1.0, vig);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// ════════════════════════════════════════════════════════
//  EDGE EXTRACTION — find hand silhouette boundary pixels
// ════════════════════════════════════════════════════════

function extractEdges() {
  handsImg.loadPixels();
  const w = handsImg.width;
  const h = handsImg.height;
  const px = handsImg.pixels;
  const step = 3;

  for (let y = 2; y < h - 2; y += step) {
    for (let x = 2; x < w - 2; x += step) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 30) continue;

      // Is this pixel on the edge? (has a transparent neighbor)
      let isEdge = false;
      for (let dy = -2; dy <= 2; dy += 2) {
        for (let dx = -2; dx <= 2; dx += 2) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            isEdge = true;
            break;
          }
          if (px[(ny * w + nx) * 4 + 3] < 30) {
            isEdge = true;
            break;
          }
        }
        if (isEdge) break;
      }
      if (!isEdge) continue;

      // Outward normal from alpha gradient
      const aL = x > 0 ? px[(y * w + x - 1) * 4 + 3] : 0;
      const aR = x < w - 1 ? px[(y * w + x + 1) * 4 + 3] : 0;
      const aU = y > 0 ? px[((y - 1) * w + x) * 4 + 3] : 0;
      const aD = y < h - 1 ? px[((y + 1) * w + x) * 4 + 3] : 0;
      let gnx = -(aR - aL);
      let gny = -(aD - aU);
      const glen = Math.sqrt(gnx * gnx + gny * gny) || 1;
      gnx /= glen;
      gny /= glen;

      edgeData.push({
        cx: x * imgScale,
        cy: imgY + y * imgScale,
        nx: gnx,
        ny: gny,
        r: px[i],
        g: px[i + 1],
        b: px[i + 2],
      });
    }
  }
}

// ════════════════════════════════════════════════════════
//  PARTICLES
// ════════════════════════════════════════════════════════

class EdgeParticle {
  constructor() {
    this.reset();
  }

  reset() {
    if (edgeData.length === 0) return;
    const e = edgeData[floor(random(edgeData.length))];
    const offset = random(1, 4);
    this.x = e.cx + e.nx * offset;
    this.y = e.cy + e.ny * offset;
    this.vx = e.nx * random(0.5, 1.8);
    this.vy = e.ny * random(0.5, 1.8);
    this.r = e.r;
    this.g = e.g;
    this.b = e.b;
    this.life = 1.0;
    this.decay = random(0.002, 0.010);
    this.size = random(2, 6);
    this.nOff = random(1000);
  }

  update(t) {
    this.vx +=
      (noise(this.x * 0.008, this.y * 0.008, t * 0.3 + this.nOff) - 0.5) *
      0.08;
    this.vy +=
      (noise(this.x * 0.008 + 100, this.y * 0.008, t * 0.3 + this.nOff) -
        0.5) *
      0.08;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    if (
      this.life <= 0 ||
      this.x < -20 ||
      this.x > W + 20 ||
      this.y < -20 ||
      this.y > H + 20
    ) {
      this.reset();
    }
  }

  draw() {
    const f = this.life;
    // Start warm white, transition to twilight purple/periwinkle
    const cr = f > 0.7 ? lerp(this.r, 255, (f - 0.7) * 3.3) : lerp(100, this.r, f / 0.7);
    const cg = f > 0.7 ? lerp(this.g, 240, (f - 0.7) * 3.3) : lerp(80, this.g, f / 0.7);
    const cb = f > 0.7 ? lerp(this.b, 230, (f - 0.7) * 3.3) : lerp(200, this.b, f / 0.7);
    fill(cr, cg, cb, f * 220);
    const s = this.size * (0.4 + f * 0.6);
    ellipse(this.x, this.y, s, s);
  }
}

class DustParticle {
  constructor() {
    this.x = random(W);
    this.y = random(H);
    this.size = random(1, 3);
    this.alpha = random(40, 90);
    this.nOff = random(1000);
  }

  update(t) {
    this.x +=
      (noise(this.x * 0.003, this.y * 0.003, t * 0.15 + this.nOff) - 0.5) *
      1.2;
    this.y +=
      (noise(this.x * 0.003 + 50, this.y * 0.003, t * 0.15 + this.nOff) -
        0.5) *
      1.2;
    if (this.x < 0) this.x += W;
    if (this.x > W) this.x -= W;
    if (this.y < 0) this.y += H;
    if (this.y > H) this.y -= H;
  }

  draw() {
    fill(160, 150, 210, this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
  }
}

// ════════════════════════════════════════════════════════
//  P5 LIFECYCLE
// ════════════════════════════════════════════════════════

function preload() {
  handsImg = loadImage("silhouette.png");
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent("canvas-container");

  // Image fills canvas (same 3:2 aspect ratio)
  imgScale = W / handsImg.width;
  imgH = handsImg.height * imgScale;
  imgY = 0;

  // Nebula shader (offscreen WEBGL)
  nebulaGfx = createGraphics(W, H, WEBGL);
  nebulaGfx.pixelDensity(1);
  nebulaShader = nebulaGfx.createShader(vertSrc, fragSrc);

  // Pre-render VHS scanline overlay
  scanOverlay = createGraphics(W, H);
  scanOverlay.noStroke();
  scanOverlay.fill(0, 10);
  for (let y = 0; y < H; y += 2) {
    scanOverlay.rect(0, y, W, 1);
  }

  // Pre-render vignette overlay (fades arms into darkness at edges)
  vignetteOverlay = createGraphics(W, H);
  const vctx = vignetteOverlay.drawingContext;
  const diag = Math.sqrt(W * W + H * H) / 2;
  const rg = vctx.createRadialGradient(
    W / 2, H / 2, diag * 0.35,
    W / 2, H / 2, diag * 0.95
  );
  rg.addColorStop(0, "rgba(0,0,0,0)");
  rg.addColorStop(0.6, "rgba(8,0,20,0.15)");
  rg.addColorStop(0.85, "rgba(8,0,20,0.55)");
  rg.addColorStop(1, "rgba(8,0,20,0.92)");
  vctx.fillStyle = rg;
  vctx.fillRect(0, 0, W, H);

  // Extract edge pixels from alpha channel & init particles
  extractEdges();
  for (let i = 0; i < EDGE_COUNT; i++) edgeParts.push(new EdgeParticle());
  for (let i = 0; i < DUST_COUNT; i++) dustParts.push(new DustParticle());
}

function draw() {
  const t = millis() / 1000;

  // 1. Animated nebula background
  nebulaGfx.shader(nebulaShader);
  nebulaShader.setUniform("u_resolution", [W, H]);
  nebulaShader.setUniform("u_time", t);
  nebulaGfx.rect(0, 0, W, H);
  image(nebulaGfx, 0, 0);

  // 2. Fingertip positions in canvas pixels
  const lx = LEFT_TIP.x * W;
  const ly = imgY + LEFT_TIP.y * imgH;
  const rx = RIGHT_TIP.x * W;
  const ry = imgY + RIGHT_TIP.y * imgH;

  // 3. Divine energy (behind hands)
  drawEnergy(lx, ly, rx, ry, 1.0);

  // 4. Hands — native 2D alpha compositing
  image(handsImg, 0, imgY, W, imgH);

  // 5. Edge dissolution particles (over hands, drifting outward)
  push();
  noStroke();
  blendMode(ADD);
  for (const p of edgeParts) {
    p.update(t);
    p.draw();
  }
  blendMode(BLEND);
  pop();

  // 6. Energy glow (over hands, subtle)
  drawEnergy(lx, ly, rx, ry, 0.2);

  // 7. Cosmic dust
  push();
  noStroke();
  for (const d of dustParts) {
    d.update(t);
    d.draw();
  }
  pop();

  // 8. VHS scanlines + glitch
  image(scanOverlay, 0, 0);
  drawGlitch();

  // 9. Vignette over entire composition (fades arm edges smoothly)
  image(vignetteOverlay, 0, 0);
}

// ════════════════════════════════════════════════════════
//  DIVINE ENERGY — arcs + glow + sparks between fingertips
// ════════════════════════════════════════════════════════

function drawEnergy(lx, ly, rx, ry, intensity) {
  const mx = (lx + rx) / 2;
  const my = (ly + ry) / 2;
  const t = millis() / 1000;
  const pulse = 0.6 + 0.4 * sin(t * 2.5);

  push();
  blendMode(ADD);

  // Wide ambient glow
  noStroke();
  for (let r = 120; r > 5; r -= 5) {
    const a = map(r, 120, 5, 1, 18) * pulse * intensity;
    fill(130, 90, 200, a);
    ellipse(mx, my, r * 1.3, r * 0.7);
  }

  // Bright core glow
  for (let r = 60; r > 3; r -= 3) {
    const a = map(r, 60, 3, 2, 35) * pulse * intensity;
    fill(255, 240, 215, a);
    ellipse(mx, my, r, r * 0.5);
  }

  // Energy arcs (bezier curves between fingertips)
  noFill();
  for (let i = 0; i < 10; i++) {
    const n = (noise(i * 0.7, t * 0.6) - 0.5) * 55;
    const a = (40 + noise(i * 0.3, t * 1.2) * 60) * pulse * intensity;
    stroke(255, 235, 210, a);
    strokeWeight(0.6 + noise(i * 0.4, t * 0.8) * 2.0);
    bezier(lx, ly, mx - 20, my + n, mx + 20, my - n * 0.7, rx, ry);
  }

  // Spark particles
  noStroke();
  for (let i = 0; i < 30; i++) {
    const frac = noise(i * 0.5, t * 0.8);
    const px2 =
      lerp(lx - 10, rx + 10, frac) + (noise(i * 0.3, t * 1.2) - 0.5) * 35;
    const py2 =
      lerp(ly, ry, noise(i * 0.5 + 50, t * 0.8)) +
      (noise(i * 0.3 + 100, t * 1.2) - 0.5) * 30;
    const s = noise(i * 0.7, t * 2) * 5 + 1;
    const a = (noise(i * 0.4, t * 1.5) * 160 + 50) * pulse * intensity;
    fill(255, 248, 225, a);
    ellipse(px2, py2, s, s);
  }

  blendMode(BLEND);
  pop();
}

// ════════════════════════════════════════════════════════
//  VHS GLITCH
// ════════════════════════════════════════════════════════

function drawGlitch() {
  const t = millis() / 1000;
  if (noise(floor(t * 6), 99) > 0.82) {
    push();
    noStroke();
    fill(255, 15);
    const gy = noise(t * 15, 42) * H;
    rect(0, gy, W, 1 + noise(t * 20) * 2);
    pop();
  }
}

// ════════════════════════════════════════════════════════
//  SAVE / CAPTURE
// ════════════════════════════════════════════════════════

function keyPressed() {
  if (key === "s" || key === "S") {
    if (keyIsDown(SHIFT)) {
      if (typeof P5Capture !== "undefined") {
        const c = P5Capture.getInstance();
        if (c.state === "idle") c.start({ format: "webm", duration: 300 });
        else c.stop();
      }
    } else {
      saveCanvas("cosmic-touch", "png");
    }
  }
}
