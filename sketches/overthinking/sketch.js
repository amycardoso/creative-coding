const W = 600;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const NUM_THOUGHTS = 18;
const TRAIL_ALPHA = 6;
const BG = [8, 12, 24];

const COLORS = [
  [0, 229, 255],   // cyan
  [123, 97, 255],  // purple
  [255, 45, 149],  // hot pink
  [0, 255, 163],   // mint
  [92, 107, 192],  // slate blue
  [255, 96, 144],  // rose
  [64, 196, 255],  // sky blue
  [179, 136, 255], // lavender
  [24, 255, 255],  // electric teal
  [234, 128, 252], // orchid
];

// ── Brain containment ──
let svgLines;
let brainPath;      // Path2D for smooth outline drawing
let brainMask;      // Uint8Array pixel mask for O(1) containment
let brainCentroid;
let thoughts = [];

function preload() {
  svgLines = loadStrings('brain.svg');
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');

  // ── Transform: fit SVG (734x734) into canvas ──
  const svgSize = 734;
  const s = (min(W, H) * 0.92) / svgSize;
  const ox = (W - svgSize * s) / 2;
  const oy = (H - svgSize * s) / 2;

  // ── Create Path2D from SVG ──
  const svgText = svgLines.join('\n');
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const pathEl = doc.querySelector('path');
  if (pathEl) {
    const d = pathEl.getAttribute('d');
    const raw = new Path2D(d);
    brainPath = new Path2D();
    brainPath.addPath(raw, new DOMMatrix().translate(ox, oy).scale(s));
  }

  // ── Build pixel mask by filling Path2D onto offscreen canvas ──
  const offscreen = document.createElement('canvas');
  offscreen.width = W;
  offscreen.height = H;
  const octx = offscreen.getContext('2d');
  octx.fillStyle = '#000000';
  octx.fill(brainPath);
  const imgData = octx.getImageData(0, 0, W, H);
  const pixels = imgData.data;

  // Initial mask from filled path (may have internal holes from sulci)
  const rawMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (pixels[i * 4 + 3] > 128) rawMask[i] = 1; // check alpha channel
  }

  // ── Flood-fill from edges to find exterior ──
  // Anything NOT reachable from outside = inside the brain (fills internal holes)
  const exterior = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let qHead = 0, qTail = 0;

  // Seed from all border pixels that aren't part of the raw fill
  for (let x = 0; x < W; x++) {
    if (!rawMask[x]) { exterior[x] = 1; queue[qTail++] = x; }
    const bot = (H - 1) * W + x;
    if (!rawMask[bot]) { exterior[bot] = 1; queue[qTail++] = bot; }
  }
  for (let y = 1; y < H - 1; y++) {
    const l = y * W;
    if (!rawMask[l]) { exterior[l] = 1; queue[qTail++] = l; }
    const r = y * W + W - 1;
    if (!rawMask[r]) { exterior[r] = 1; queue[qTail++] = r; }
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % W;
    const y = (idx - x) / W;
    const neighbors = [idx - 1, idx + 1, idx - W, idx + W];
    const valid = [x > 0, x < W - 1, y > 0, y < H - 1];
    for (let n = 0; n < 4; n++) {
      if (valid[n] && !rawMask[neighbors[n]] && !exterior[neighbors[n]]) {
        exterior[neighbors[n]] = 1;
        queue[qTail++] = neighbors[n];
      }
    }
  }

  // Final mask: NOT exterior = brain interior (holes filled)
  brainMask = new Uint8Array(W * H);
  let sx = 0, sy = 0, count = 0;
  for (let i = 0; i < W * H; i++) {
    if (!exterior[i]) {
      brainMask[i] = 1;
      const px = i % W;
      const py = (i - px) / W;
      sx += px;
      sy += py;
      count++;
    }
  }
  brainCentroid = count > 0
    ? { x: sx / count, y: sy / count }
    : { x: CX, y: CY };

  // ── Init thoughts ──
  background(BG[0], BG[1], BG[2]);
  for (let i = 0; i < NUM_THOUGHTS; i++) {
    thoughts.push(new Thought(i));
  }
}

function insideBrain(x, y) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return false;
  return brainMask[iy * W + ix] === 1;
}

// ── Thought agent ──
class Thought {
  constructor(i) {
    // Rejection-sample a starting point inside the brain
    let attempts = 0;
    do {
      this.x = random(W);
      this.y = random(H);
      attempts++;
    } while (!insideBrain(this.x, this.y) && attempts < 2000);
    if (!insideBrain(this.x, this.y)) {
      this.x = brainCentroid.x;
      this.y = brainCentroid.y;
    }

    this.nxOff = random(10000);
    this.nyOff = random(10000);
    this.nInc = random(0.004, 0.012);

    this.baseSpeed = random(1.0, 3.0);
    this.speed = this.baseSpeed;

    const c = COLORS[i % COLORS.length];
    this.col = c;
    this.alpha = random(160, 240);
    this.weight = random(1.5, 3.5);

    this.maxTrail = floor(random(200, 400));
    this.trail = [];

    this.burstTimer = floor(random(120, 300));
    this.burstFrames = 0;
  }

  update() {
    // Speed bursts
    this.burstTimer--;
    if (this.burstTimer <= 0 && this.burstFrames <= 0) {
      this.burstFrames = 50;
      this.burstTimer = floor(random(120, 300));
    }
    if (this.burstFrames > 0) {
      this.speed = this.baseSpeed * 3;
      this.burstFrames--;
    } else {
      this.speed = this.baseSpeed;
    }

    // Noise steering
    const angle = noise(this.nxOff, this.nyOff) * TAU * 2.5;
    let nx = this.x + cos(angle) * this.speed;
    let ny = this.y + sin(angle) * this.speed;
    this.nxOff += this.nInc;
    this.nyOff += this.nInc * 0.7;

    // Boundary containment
    if (!insideBrain(nx, ny)) {
      const toCenter = atan2(brainCentroid.y - this.y, brainCentroid.x - this.x);
      let found = false;

      // Try several deflection angles
      for (let a = 0; a < 8; a++) {
        const deflect = toCenter + random(-1.2, 1.2);
        const tx = this.x + cos(deflect) * this.speed;
        const ty = this.y + sin(deflect) * this.speed;
        if (insideBrain(tx, ty)) {
          nx = tx;
          ny = ty;
          found = true;
          break;
        }
      }

      if (!found) {
        // Move toward centroid at half speed
        nx = this.x + cos(toCenter) * this.speed * 0.5;
        ny = this.y + sin(toCenter) * this.speed * 0.5;
        if (!insideBrain(nx, ny)) {
          nx = this.x;
          ny = this.y;
        }
      }
    }

    this.x = nx;
    this.y = ny;

    this.trail.push(nx, ny);
    if (this.trail.length > this.maxTrail * 2) {
      this.trail.splice(0, 2);
    }
  }

  display() {
    const len = this.trail.length / 2;
    if (len < 4) return;

    noFill();
    strokeWeight(this.weight);

    const segments = 3;
    const segLen = floor(len / segments);

    for (let s = 0; s < segments; s++) {
      const startIdx = s * segLen;
      const endIdx = s === segments - 1 ? len : (s + 1) * segLen + 2;
      const t = (s + 1) / segments;
      const a = this.alpha * t * t;

      stroke(this.col[0], this.col[1], this.col[2], a);
      beginShape();
      for (let i = startIdx; i < endIdx && i < len; i++) {
        curveVertex(this.trail[i * 2], this.trail[i * 2 + 1]);
      }
      endShape();
    }
  }
}

function draw() {
  background(BG[0], BG[1], BG[2], TRAIL_ALPHA);

  drawBrainOutline();

  for (const t of thoughts) {
    t.update();
    t.display();
  }
}

function drawBrainOutline() {
  if (!brainPath) return;

  const pulse = sin(frameCount * 0.012) * 0.3 + 0.5;
  const ctx = drawingContext;
  ctx.save();

  // Soft glow
  ctx.strokeStyle = `rgba(60, 180, 255, ${0.02 * pulse})`;
  ctx.lineWidth = 5;
  ctx.stroke(brainPath);

  // Main outline
  ctx.strokeStyle = `rgba(60, 180, 255, ${0.04 * pulse})`;
  ctx.lineWidth = 0.8;
  ctx.stroke(brainPath);

  ctx.restore();
}

function keyPressed() {
  if (key === 'S' || key === 's') {
    saveCanvas('overthinking', 'png');
  }
}
