// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  // Silhouette sampling buffer
  silhouetteW: 350,
  silhouetteH: 400,

  // Particle counts
  bodyParticles: 4000,
  edgeParticles: 800,

  // Physics
  springConstant: 0.12,
  damping: 0.85,
  noiseScale: 0.008,
  noiseSpeed: 0.25,
  edgeScatterMultiplier: 1.5,
  headScatterMultiplier: 1.3,
  headThreshold: 0.20, // top 20% = head region

  // Noise positional offsets (px, not forces)
  baseNoiseOffset: 4,
  edgeNoiseOffset: 10,

  // Traveling audio wave
  waveSpeed: 1.5,
  waveWidth: 0.15,
  waveDisplacement: 12,
  waveBrightness: 120,
  waveSize: 3,

  // Breathing
  breathScale: 0.008,

  // Colors (warm golds)
  palette: [
    [255, 223, 150],
    [255, 200, 120],
    [255, 240, 200],
    [255, 180, 100],
  ],

  // Glow
  glowSizeMultiplier: 5,
  glowAlpha: 15, // out of 255

  // Grid
  gridHorizon: 0.70, // fraction of canvas height
  gridLineCount: 14,
  gridVerticalCount: 20,

  // Rings
  ringCount: 3,
  ringDotsPerRing: 120,
  ringBaseSpeed: 0.3,

  // Stars
  starCount: 150,
};

// ============================================================
// AUDIO ANALYZER (ported from previous Three.js version)
// ============================================================
class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.source = null;
    this.audioElement = null;
    this.bass = 0;
    this.mids = 0;
    this.highs = 0;
    this.smoothing = 0.85;
  }

  init() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.connect(this.audioContext.destination);
  }

  async connectMicrophone() {
    this.init();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.source) this.source.disconnect();
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      this.analyser.disconnect();
      return true;
    } catch (err) {
      console.error('Microphone access denied:', err);
      return false;
    }
  }

  connectAudioElement(audioElement) {
    this.init();
    if (this.source) this.source.disconnect();
    this.audioElement = audioElement;
    this.source = this.audioContext.createMediaElementSource(audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  update() {
    if (!this.analyser) return;
    this.analyser.getByteFrequencyData(this.dataArray);

    const len = this.dataArray.length;
    const bassEnd = Math.floor(len * 0.1);
    const midsEnd = Math.floor(len * 0.5);

    let bassSum = 0, midsSum = 0, highsSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += this.dataArray[i];
    for (let i = bassEnd; i < midsEnd; i++) midsSum += this.dataArray[i];
    for (let i = midsEnd; i < len; i++) highsSum += this.dataArray[i];

    const bassAvg = bassSum / bassEnd / 255;
    const midsAvg = midsSum / (midsEnd - bassEnd) / 255;
    const highsAvg = highsSum / (len - midsEnd) / 255;

    this.bass = this.bass * this.smoothing + bassAvg * (1 - this.smoothing);
    this.mids = this.mids * this.smoothing + midsAvg * (1 - this.smoothing);
    this.highs = this.highs * this.smoothing + highsAvg * (1 - this.smoothing);
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

// ============================================================
// HELPERS
// ============================================================
function fract(x) { return x - floor(x); }

// ============================================================
// PARTICLE CLASS
// ============================================================
class Particle {
  constructor(homeX, homeY, isEdge, normalizedHeight, colorIndex) {
    this.homeX = homeX;
    this.homeY = homeY;
    this.x = homeX;
    this.y = homeY;
    this.vx = 0;
    this.vy = 0;
    this.isEdge = isEdge;
    this.normalizedHeight = normalizedHeight; // 0=top, 1=bottom of figure
    this.noiseOffsetX = random(1000);
    this.noiseOffsetY = random(1000);
    this.colorIndex = colorIndex;
    this.baseSize = isEdge ? random(1.5, 3) : random(2, 4);
    this.alpha = isEdge ? random(120, 200) : random(180, 255);
  }

  update(time, bass, mids, highs) {
    // 1. Noise positional offset (not force!) — tiny organic drift
    const maxOffset = this.isEdge ? CONFIG.edgeNoiseOffset : CONFIG.baseNoiseOffset;
    const headBoost = this.normalizedHeight < CONFIG.headThreshold
      ? CONFIG.headScatterMultiplier : 1.0;
    const ox = (noise(this.noiseOffsetX + time * CONFIG.noiseSpeed, this.homeY * CONFIG.noiseScale) - 0.5) * maxOffset * headBoost;
    const oy = (noise(this.noiseOffsetY + time * CONFIG.noiseSpeed, this.homeX * CONFIG.noiseScale) - 0.5) * maxOffset * headBoost;

    // 2. Traveling audio wave — energy band sweeping up through body
    const wavePos = fract(time * CONFIG.waveSpeed); // 0→1 repeating
    const distToWave = abs(this.normalizedHeight - wavePos);
    const waveInfluence = max(0, 1 - distToWave / CONFIG.waveWidth); // 0 outside, 1 at center
    const audioIntensity = (bass + mids * 2 + highs) / 3;
    const waveStrength = waveInfluence * audioIntensity;

    // Wave pushes particles laterally outward from center
    const lateralDir = this.homeX > figureCenterX ? 1 : -1;
    const waveDx = lateralDir * waveStrength * CONFIG.waveDisplacement;
    const waveDy = waveStrength * CONFIG.waveDisplacement * 0.3;

    // 3. Bass breathing — very subtle expand/contract from figure center
    const breathX = (this.homeX - figureCenterX) * bass * CONFIG.breathScale;
    const breathY = (this.homeY - figureCenterY) * bass * CONFIG.breathScale;

    // 4. Target = home + noise offset + wave + breath
    const targetX = this.homeX + ox + waveDx + breathX;
    const targetY = this.homeY + oy - waveDy + breathY;

    // 5. Spring toward target (offset home, not raw home)
    this.vx += (targetX - this.x) * CONFIG.springConstant;
    this.vy += (targetY - this.y) * CONFIG.springConstant;
    this.vx *= CONFIG.damping;
    this.vy *= CONFIG.damping;
    this.x += this.vx;
    this.y += this.vy;

    // 6. Visual: wave boosts brightness + size; highs add sparkle
    this.currentAlpha = this.alpha + waveStrength * CONFIG.waveBrightness + highs * 30;
    this.currentSize = this.baseSize + waveStrength * CONFIG.waveSize + bass * 0.5;
  }
}

// ============================================================
// GLOBALS
// ============================================================
let particles = [];
let stars = [];
let glowBuffer;
let audioAnalyzer;
let audioElement = null;

// Silhouette bounds (in canvas space) — set during generation
let figureTop, figureBottom, figureLeft, figureRight, figureCenterX, figureCenterY;

// Ring state
let ringAngles = [0, 0, 0];

// ============================================================
// P5.JS SETUP
// ============================================================
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  glowBuffer = createGraphics(floor(width / 2), floor(height / 2));
  glowBuffer.pixelDensity(1);

  generateParticles();
  generateStars();

  audioAnalyzer = new AudioAnalyzer();
  setupAudioControls();
}

// ============================================================
// SILHOUETTE GENERATION & PARTICLE SAMPLING
// ============================================================
function generateParticles() {
  particles = [];

  // Create offscreen buffer for silhouette
  const buf = createGraphics(CONFIG.silhouetteW, CONFIG.silhouetteH);
  buf.background(0);
  buf.noStroke();
  buf.fill(255);

  drawSilhouette(buf);

  buf.loadPixels();
  const w = buf.width;
  const h = buf.height;
  const px = buf.pixels;

  // Collect white pixels and detect edges
  const bodyPixels = [];
  const edgePixels = [];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      if (px[idx] > 128) {
        // Check if edge: any neighbor is black
        const isEdge = isEdgePixel(px, x, y, w);
        if (isEdge) {
          edgePixels.push({ x, y });
        } else {
          bodyPixels.push({ x, y });
        }
      }
    }
  }

  buf.remove();

  // Map buffer coords to canvas coords
  // Center the figure, scale to ~60% of canvas height
  const figureScale = (height * 0.55) / CONFIG.silhouetteH;
  const offsetX = width / 2 - (CONFIG.silhouetteW / 2) * figureScale;
  const offsetY = height * 0.08; // top margin

  figureTop = offsetY;
  figureBottom = offsetY + CONFIG.silhouetteH * figureScale;
  figureCenterX = width / 2;
  figureCenterY = (figureTop + figureBottom) / 2;
  figureLeft = offsetX;
  figureRight = offsetX + CONFIG.silhouetteW * figureScale;

  // Sample body particles
  const bodyCount = min(CONFIG.bodyParticles, bodyPixels.length);
  shuffleArray(bodyPixels);
  for (let i = 0; i < bodyCount; i++) {
    const p = bodyPixels[i];
    const cx = offsetX + p.x * figureScale;
    const cy = offsetY + p.y * figureScale;
    const normH = p.y / CONFIG.silhouetteH; // 0=top, 1=bottom
    const ci = floor(random(CONFIG.palette.length));
    particles.push(new Particle(cx, cy, false, normH, ci));
  }

  // Sample edge particles
  const edgeCount = min(CONFIG.edgeParticles, edgePixels.length);
  shuffleArray(edgePixels);
  for (let i = 0; i < edgeCount; i++) {
    const p = edgePixels[i];
    const cx = offsetX + p.x * figureScale;
    const cy = offsetY + p.y * figureScale;
    const normH = p.y / CONFIG.silhouetteH;
    const ci = floor(random(CONFIG.palette.length));
    particles.push(new Particle(cx, cy, true, normH, ci));
  }
}

function drawSilhouette(buf) {
  const cx = buf.width / 2; // 175

  buf.push();
  buf.noStroke();
  buf.fill(255);

  // --- Head ---
  buf.ellipse(cx, 38, 54, 60);

  // --- Neck (smooth ellipse bridging head to shoulders) ---
  buf.ellipse(cx, 68, 22, 30);

  // --- Torso (hourglass bezier shape) ---
  buf.beginShape();
  buf.vertex(cx - 50, 86);
  buf.bezierVertex(cx - 52, 100, cx - 44, 135, cx - 26, 172); // left side: shoulder → waist
  buf.bezierVertex(cx - 30, 190, cx - 36, 200, cx - 36, 210);  // waist → hip
  buf.vertex(cx + 36, 210);
  buf.bezierVertex(cx + 36, 200, cx + 30, 190, cx + 26, 172);  // hip → waist (right)
  buf.bezierVertex(cx + 44, 135, cx + 52, 100, cx + 50, 86);   // waist → shoulder (right)
  buf.endShape(CLOSE);

  // --- Hips (smooth ellipse overlapping lower torso and upper legs) ---
  buf.ellipse(cx, 205, 76, 40);

  // --- Arms (mirrored) ---
  drawArm(buf, cx, -1); // left
  drawArm(buf, cx, 1);  // right

  // --- Legs (mirrored) ---
  drawLeg(buf, cx, -1); // left
  drawLeg(buf, cx, 1);  // right

  buf.pop();
}

function drawArm(buf, cx, dir) {
  // Arm extends outward and slightly downward (~25° below horizontal)
  // dir: -1 = left, 1 = right

  const shoulderX = cx + dir * 48;
  const shoulderY = 92;

  // Elbow position
  const elbowX = cx + dir * 105;
  const elbowY = 120;

  // Wrist position
  const wristX = cx + dir * 148;
  const wristY = 140;

  // Fingertips
  const tipX = cx + dir * 165;
  const tipY = 150;

  // Arm thickness tapers: shoulder=14, elbow=11, wrist=8, hand=12
  const armHalf = 7;
  const elbowHalf = 5.5;
  const wristHalf = 4;

  // Draw arm as a smooth bezier shape (top edge → tip → bottom edge back)
  buf.beginShape();

  // Top edge: shoulder → elbow → wrist
  buf.vertex(shoulderX, shoulderY - armHalf);
  buf.bezierVertex(
    shoulderX + dir * 20, shoulderY - armHalf - 2,
    elbowX - dir * 15, elbowY - elbowHalf - 2,
    elbowX, elbowY - elbowHalf
  );
  buf.bezierVertex(
    elbowX + dir * 15, elbowY - elbowHalf + 1,
    wristX - dir * 10, wristY - wristHalf - 1,
    wristX, wristY - wristHalf
  );

  // Hand (paddle shape: widen then taper to fingertips)
  buf.bezierVertex(
    wristX + dir * 4, wristY - 7,
    tipX - dir * 5, tipY - 8,
    tipX, tipY
  );
  buf.bezierVertex(
    tipX - dir * 5, tipY + 8,
    wristX + dir * 4, wristY + 7,
    wristX, wristY + wristHalf
  );

  // Bottom edge back: wrist → elbow → shoulder
  buf.bezierVertex(
    wristX - dir * 10, wristY + wristHalf + 1,
    elbowX + dir * 15, elbowY + elbowHalf - 1,
    elbowX, elbowY + elbowHalf
  );
  buf.bezierVertex(
    elbowX - dir * 15, elbowY + elbowHalf + 2,
    shoulderX + dir * 20, shoulderY + armHalf + 2,
    shoulderX, shoulderY + armHalf
  );

  buf.endShape(CLOSE);

  // Extra overlap at shoulder joint (circle to merge with torso)
  buf.ellipse(shoulderX, shoulderY, 20, 20);
}

function drawLeg(buf, cx, dir) {
  // dir: -1 = left, 1 = right
  const hipX = cx + dir * 18;
  const hipY = 215;
  const kneeX = cx + dir * 20;
  const kneeY = 305;
  const ankleX = cx + dir * 20;
  const ankleY = 385;
  const footX = cx + dir * 24;
  const footY = 395;

  // Thickness tapers: hip=16, knee=12, ankle=7
  const hipHalf = 8;
  const kneeHalf = 6;
  const ankleHalf = 3.5;

  buf.beginShape();

  // Outer edge: hip → knee → ankle → foot
  buf.vertex(hipX + dir * hipHalf, hipY);
  buf.bezierVertex(
    hipX + dir * hipHalf + dir * 2, hipY + 30,
    kneeX + dir * kneeHalf + dir * 1, kneeY - 30,
    kneeX + dir * kneeHalf, kneeY
  );
  buf.bezierVertex(
    kneeX + dir * kneeHalf - dir * 1, kneeY + 25,
    ankleX + dir * ankleHalf + dir * 1, ankleY - 30,
    ankleX + dir * ankleHalf, ankleY
  );

  // Foot (small rounded bump)
  buf.bezierVertex(
    ankleX + dir * ankleHalf + dir * 2, ankleY + 5,
    footX + dir * 3, footY,
    footX, footY
  );
  buf.bezierVertex(
    footX - dir * 3, footY,
    ankleX - dir * ankleHalf - dir * 2, ankleY + 5,
    ankleX - dir * ankleHalf, ankleY
  );

  // Inner edge back: ankle → knee → hip
  buf.bezierVertex(
    ankleX - dir * ankleHalf - dir * 1, ankleY - 30,
    kneeX - dir * kneeHalf + dir * 1, kneeY + 25,
    kneeX - dir * kneeHalf, kneeY
  );
  buf.bezierVertex(
    kneeX - dir * kneeHalf - dir * 1, kneeY - 30,
    hipX - dir * hipHalf - dir * 2, hipY + 30,
    hipX - dir * hipHalf, hipY
  );

  buf.endShape(CLOSE);

  // Extra overlap at hip joint (ellipse to merge with hips)
  buf.ellipse(hipX, hipY, 22, 18);
}

function isEdgePixel(pixels, x, y, w) {
  const neighbors = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];
  for (const [dx, dy] of neighbors) {
    const ni = ((y + dy) * w + (x + dx)) * 4;
    if (pixels[ni] < 128) return true;
  }
  return false;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ============================================================
// STARFIELD
// ============================================================
function generateStars() {
  stars = [];
  const horizonY = height * CONFIG.gridHorizon;
  for (let i = 0; i < CONFIG.starCount; i++) {
    stars.push({
      x: random(width),
      y: random(horizonY),
      size: random(0.5, 2),
      twinkleSpeed: random(0.5, 3),
      twinkleOffset: random(TWO_PI),
    });
  }
}

// ============================================================
// DRAW LOOP
// ============================================================
function draw() {
  background(10, 10, 15);

  const t = millis() / 1000;
  audioAnalyzer.update();
  const bass = audioAnalyzer.bass;
  const mids = audioAnalyzer.mids;
  const highs = audioAnalyzer.highs;

  // Update particles
  for (const p of particles) {
    p.update(t, bass, mids, highs);
  }

  // Render layers
  drawStars(t);
  drawPerspectiveGrid(t, bass);
  drawParticlesWithGlow(bass, mids, highs);
  drawOrbitalRings(t, bass);
}

// ============================================================
// STARS
// ============================================================
function drawStars(t) {
  noStroke();
  for (const s of stars) {
    const twinkle = sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.5 + 0.5;
    const a = 80 + twinkle * 175;
    fill(255, 250, 240, a);
    ellipse(s.x, s.y, s.size, s.size);
  }
}

// ============================================================
// PERSPECTIVE GRID
// ============================================================
function drawPerspectiveGrid(t, bass) {
  const horizonY = height * CONFIG.gridHorizon;
  const bottomY = height;
  const vanishX = width / 2;

  // Horizontal lines with exponential spacing
  for (let i = 0; i < CONFIG.gridLineCount; i++) {
    const frac = i / (CONFIG.gridLineCount - 1);
    // Exponential: lines bunch up near horizon
    const expFrac = pow(frac, 2.5);
    const y = horizonY + expFrac * (bottomY - horizonY);

    // Color: cyan at horizon → magenta at bottom
    const r = lerp(0, 200, frac);
    const g = lerp(200, 50, frac);
    const b = lerp(220, 180, frac);
    const a = lerp(60, 120, frac);

    stroke(r, g, b, a);
    strokeWeight(frac < 0.3 ? 0.5 : 1);

    // Bass wave displacement
    const wave = sin(frac * PI * 4 - t * 2) * bass * 15;

    line(0, y + wave, width, y + wave);
  }

  // Vertical lines converging to vanishing point
  for (let i = 0; i < CONFIG.gridVerticalCount; i++) {
    const frac = i / (CONFIG.gridVerticalCount - 1);
    const bottomX = frac * width;

    // Color
    const distFromCenter = abs(frac - 0.5) * 2;
    const r = lerp(50, 180, distFromCenter);
    const g = lerp(180, 80, distFromCenter);
    const b = lerp(200, 160, distFromCenter);
    const a = lerp(80, 40, distFromCenter);

    stroke(r, g, b, a);
    strokeWeight(0.5);

    line(vanishX, horizonY, bottomX, bottomY);
  }

  noStroke();
}

// ============================================================
// PARTICLE RENDERING WITH GLOW
// ============================================================
function drawParticlesWithGlow(bass, mids, highs) {
  // --- Glow pass: draw large dim particles to half-res buffer ---
  glowBuffer.clear();
  glowBuffer.noStroke();

  const gx = glowBuffer.width / width;
  const gy = glowBuffer.height / height;

  for (const p of particles) {
    const col = CONFIG.palette[p.colorIndex];
    const sz = p.currentSize * CONFIG.glowSizeMultiplier * gx;
    glowBuffer.fill(col[0], col[1], col[2], CONFIG.glowAlpha);
    glowBuffer.ellipse(p.x * gx, p.y * gy, sz, sz);
  }

  glowBuffer.filter(BLUR, 3);

  // Composite glow buffer with additive blending
  push();
  drawingContext.globalCompositeOperation = 'lighter';
  image(glowBuffer, 0, 0, width, height);
  pop();

  // --- Sharp pass: draw actual particles ---
  push();
  drawingContext.globalCompositeOperation = 'lighter';
  noStroke();

  for (const p of particles) {
    const col = CONFIG.palette[p.colorIndex];
    fill(col[0], col[1], col[2], p.currentAlpha);
    ellipse(p.x, p.y, p.currentSize, p.currentSize);
  }

  pop();
}

// ============================================================
// ORBITAL RINGS
// ============================================================
function drawOrbitalRings(t, bass) {
  const ringConfigs = [
    { radiusX: (figureRight - figureLeft) * 0.55, radiusY: 25, tilt: -0.25, yOffset: -30, speed: 1.0 },
    { radiusX: (figureRight - figureLeft) * 0.65, radiusY: 30, tilt: 0.15, yOffset: 0, speed: -0.7 },
    { radiusX: (figureRight - figureLeft) * 0.50, radiusY: 20, tilt: 0.35, yOffset: 30, speed: 1.3 },
  ];

  // Ring center = torso area (around 40% of figure from top)
  const ringCenterX = figureCenterX;
  const ringCenterY = figureTop + (figureBottom - figureTop) * 0.45;

  push();
  drawingContext.globalCompositeOperation = 'lighter';
  noStroke();

  for (let r = 0; r < CONFIG.ringCount; r++) {
    const cfg = ringConfigs[r];
    const speed = CONFIG.ringBaseSpeed * cfg.speed + bass * 0.5;
    ringAngles[r] += speed * 0.016; // ~60fps dt

    for (let i = 0; i < CONFIG.ringDotsPerRing; i++) {
      const angle = ringAngles[r] + (i / CONFIG.ringDotsPerRing) * TWO_PI;
      const px = ringCenterX + cos(angle) * cfg.radiusX;
      const py = ringCenterY + cfg.yOffset + sin(angle) * cfg.radiusY
        + cos(angle) * cfg.radiusX * cfg.tilt;

      // Dot size and alpha based on position (front vs back)
      const depth = sin(angle);
      const dotAlpha = map(depth, -1, 1, 40, 200);
      const dotSize = map(depth, -1, 1, 1, 3);

      // Golden color with glow
      fill(255, 210, 120, dotAlpha);

      drawingContext.shadowColor = 'rgba(255, 200, 100, 0.6)';
      drawingContext.shadowBlur = 8;

      ellipse(px, py, dotSize, dotSize);
    }
  }

  drawingContext.shadowBlur = 0;
  pop();
}

// ============================================================
// AUDIO CONTROLS
// ============================================================
function setupAudioControls() {
  const loadBtn = document.getElementById('load-btn');
  const micBtn = document.getElementById('mic-btn');
  const playBtn = document.getElementById('play-btn');
  const fileInput = document.getElementById('file-input');
  const audioInfo = document.getElementById('audio-info');

  loadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (audioElement) {
        audioElement.pause();
        audioElement.remove();
      }
      audioElement = document.createElement('audio');
      audioElement.src = URL.createObjectURL(file);
      audioElement.crossOrigin = 'anonymous';
      audioAnalyzer.connectAudioElement(audioElement);
      audioAnalyzer.resume();
      playBtn.style.display = 'block';
      playBtn.textContent = 'Play';
      audioInfo.textContent = `Loaded: ${file.name}`;
      micBtn.classList.remove('active');
    }
  });

  playBtn.addEventListener('click', () => {
    if (!audioElement) return;
    audioAnalyzer.resume();
    if (audioElement.paused) {
      audioElement.play();
      playBtn.textContent = 'Pause';
    } else {
      audioElement.pause();
      playBtn.textContent = 'Play';
    }
  });

  micBtn.addEventListener('click', async () => {
    if (micBtn.classList.contains('active')) {
      micBtn.classList.remove('active');
      audioInfo.textContent = 'Microphone disabled';
      return;
    }
    const success = await audioAnalyzer.connectMicrophone();
    if (success) {
      micBtn.classList.add('active');
      audioInfo.textContent = 'Microphone active';
      playBtn.style.display = 'none';
      if (audioElement) audioElement.pause();
    } else {
      audioInfo.textContent = 'Microphone access denied';
    }
  });
}

// ============================================================
// PNG EXPORT
// ============================================================
function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('ethereal-silhouette', 'png');
  }
}

// ============================================================
// RESPONSIVE RESIZE
// ============================================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  glowBuffer = createGraphics(floor(width / 2), floor(height / 2));
  glowBuffer.pixelDensity(1);
  generateParticles();
  generateStars();
}
