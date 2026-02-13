// Opus — Audio Explanation of Life
// A geometric mandala that breathes with Eric Prydz "Opus"

const W = 800;
const H = 800;
const CX = W / 2;
const CY = H / 2;

const ENERGY_CURVE = [
  [0,    0.00],  [10,   0.05],  [60,   0.12],
  [90,   0.18],  [150,  0.30],  [180,  0.22],
  [210,  0.10],  [240,  0.15],  [280,  0.45],
  [310,  0.70],  [325,  0.88],  [330,  1.00],
  [345,  0.92],  [390,  0.80],  [420,  0.65],
  [450,  0.35],  [480,  0.18],  [520,  0.05],
  [545,  0.00],
];

const COLOR_KEYFRAMES = [
  { t: 0,   c: ['#1a1a3e', '#2d2d6e', '#4a3f8f'] },
  { t: 90,  c: ['#0ff4c6', '#ff6b6b', '#ffd93d'] },
  { t: 180, c: ['#7ec8e3', '#b8e0f6', '#dceefb'] },
  { t: 240, c: ['#ff4060', '#ff8c42', '#ffdc5e'] },
  { t: 330, c: ['#ffffff', '#ff2d55', '#ffcc00'] },
  { t: 345, c: ['#e040fb', '#00e5ff', '#76ff03'] },
  { t: 420, c: ['#7c4dff', '#536dfe', '#448aff'] },
  { t: 480, c: ['#37474f', '#455a64', '#546e7a'] },
];

let sound, fft, amp;
let smoothBass = 0, smoothMid = 0, smoothHigh = 0, smoothLevel = 0;
let prevBass = 0, beatDetected = false, lastBeatTime = 0, beatIntensity = 0;
let spectrum = [];
let smoothEnergy = 0;

let started = false, paused = false;
let frameCounter = 0;
let dropFlash = 0, hasDropped = false;

let particles = [];
const NUM_PARTICLES = 600;
let currentColors = [];

let recorder = null;
let recordedChunks = [];
let isRecording = false;

function sampleCurve(t) {
  const c = ENERGY_CURVE;
  if (t <= c[0][0]) return c[0][1];
  if (t >= c[c.length - 1][0]) return c[c.length - 1][1];
  for (let i = 0; i < c.length - 1; i++) {
    if (t >= c[i][0] && t < c[i + 1][0]) {
      const p = (t - c[i][0]) / (c[i + 1][0] - c[i][0]);
      const s = p * p * (3 - 2 * p);
      return lerp(c[i][1], c[i + 1][1], s);
    }
  }
  return 0;
}

function interpolateColors(t) {
  const kf = COLOR_KEYFRAMES;
  if (t <= kf[0].t) return kf[0].c.map(h => color(h));
  if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].c.map(h => color(h));
  for (let i = 0; i < kf.length - 1; i++) {
    if (t >= kf[i].t && t < kf[i + 1].t) {
      const p = (t - kf[i].t) / (kf[i + 1].t - kf[i].t);
      const s = p * p * (3 - 2 * p);
      return kf[i].c.map((h, idx) => lerpColor(color(h), color(kf[i + 1].c[idx]), s));
    }
  }
  return kf[kf.length - 1].c.map(h => color(h));
}

function analyzeAudio() {
  spectrum = fft.analyze();
  const rawBass = fft.getEnergy('bass') / 255;
  const rawMid = fft.getEnergy('mid') / 255;
  const rawHigh = fft.getEnergy('treble') / 255;
  const rawLevel = amp.getLevel();

  smoothBass  = rawBass  > smoothBass  ? lerp(smoothBass,  rawBass,  0.4) : smoothBass  * 0.92;
  smoothMid   = rawMid   > smoothMid   ? lerp(smoothMid,   rawMid,   0.3) : smoothMid   * 0.92;
  smoothHigh  = rawHigh  > smoothHigh  ? lerp(smoothHigh,  rawHigh,  0.25): smoothHigh  * 0.92;
  smoothLevel = rawLevel > smoothLevel ? lerp(smoothLevel, rawLevel, 0.3) : smoothLevel * 0.92;

  const bassDelta = rawBass - prevBass;
  const now = millis();
  beatDetected = bassDelta > 0.1 && rawBass > 0.2 && (now - lastBeatTime) > 180;
  if (beatDetected) { lastBeatTime = now; beatIntensity = 1.0; }
  beatIntensity *= 0.85;
  prevBass = smoothBass;

  const target = sampleCurve(sound.currentTime());
  smoothEnergy = lerp(smoothEnergy, target, 0.03);

  const ct = sound.currentTime();
  if (!hasDropped && ct >= 329.5 && ct < 332) {
    hasDropped = true;
    dropFlash = 1.0;
  }

  currentColors = interpolateColors(ct);
}

function initParticles() {
  particles = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: random(W), y: random(H),
      px: 0, py: 0,
      life: floor(random(60, 200)),
    });
  }
}

function updateAndRenderParticles(e) {
  const spd = 0.3 + e * 4.5 + smoothBass * 2.5;
  const zoom = 400 - e * 300;
  const baseAlpha = 0.02 + e * 0.18;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.px = p.x;
    p.py = p.y;

    const ang = noise(p.x / zoom, p.y / zoom, frameCounter / 500) * TWO_PI * 2;
    p.x += cos(ang) * spd;
    p.y += sin(ang) * spd;
    p.life--;

    if (p.life <= 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
      p.x = random(W); p.y = random(H);
      p.px = p.x; p.py = p.y;
      p.life = floor(random(60, 200));
      continue;
    }

    const dx = p.x - p.px, dy = p.y - p.py;
    if (dx * dx + dy * dy > 400) continue;

    const c = currentColors[i % currentColors.length];
    const a = baseAlpha * (p.life / 200);
    stroke(red(c), green(c), blue(c), a * 255);
    strokeWeight(0.8);
    line(p.px, p.py, p.x, p.y);
  }
}

function drawMandala(e) {
  push();
  translate(CX, CY);
  noFill();

  const arcN = floor(3 + e * 30);
  const arcBaseR = 30;
  const arcGap = 8 + smoothBass * e * 60;
  const arcRot = 0.2 + e * 4;
  const arcSpan = PI * (0.3 + e * 1.2 + smoothMid * 0.5);
  const arcW = 0.6 + e * 2.2;
  const arcA = 0.06 + e * 0.5;

  for (let i = 0; i < arcN; i++) {
    const t = i / max(arcN, 1);
    const r = arcBaseR + i * arcGap;
    if (r > 400) break;

    const rot = frameCounter * arcRot * (i % 2 === 0 ? 1 : -1) * 0.01;
    const bp = beatIntensity * 0.4 * (i % 3 === 0 ? 1 : 0);
    const c = currentColors[i % currentColors.length];

    stroke(red(c), green(c), blue(c), arcA * (1 - t * 0.4) * 255);
    strokeWeight(arcW * (1 + smoothBass * 1.5));

    const sa = rot + t * PI;
    arc(0, 0, r * 2, r * 2, sa, sa + arcSpan + bp * PI);
  }

  const lineN = floor(6 + e * 58);
  const lineInner = 10 + (1 - e) * 15;
  const lineOuter = 80 + e * 300 + smoothBass * 80;
  const lineRot = 0.2 + e * 3;
  const lineBaseA = 0.05 + e * 0.35;

  for (let i = 0; i < lineN; i++) {
    const ang = (TWO_PI / lineN) * i + frameCounter * lineRot * 0.005;
    const si = floor(map(i, 0, lineN, 0, spectrum.length * 0.3));
    const sv = (spectrum[si] || 0) / 255;

    const r1 = lineInner;
    const r2 = lineInner + (lineOuter - lineInner) * (0.2 + sv * 0.8);
    const la = lineBaseA * (0.3 + sv * 0.7);
    const c = currentColors[i % currentColors.length];

    stroke(red(c), green(c), blue(c), la * 255);
    strokeWeight(0.5 + sv * 2 + e * 0.5);
    line(cos(ang) * r1, sin(ang) * r1, cos(ang) * r2, sin(ang) * r2);
  }

  const spiralN = floor(2 + e * 6);
  const spiralExp = 1.5 + e * 3.5 + smoothBass;
  const spiralA = 0.03 + e * 0.22;
  const spiralRot = frameCounter * (0.001 + e * 0.01);
  const spiralLen = floor(60 + e * 60);

  for (let a = 0; a < spiralN; a++) {
    const c = currentColors[a % currentColors.length];
    stroke(red(c), green(c), blue(c), spiralA * 255);
    strokeWeight(0.8 + e * 0.7);

    beginShape();
    const off = (TWO_PI / spiralN) * a;
    for (let t = 0; t < spiralLen; t++) {
      const ang = off + t * 0.08 + spiralRot;
      const r = t * spiralExp;
      const si = floor(map(t, 0, spiralLen, 0, spectrum.length * 0.3));
      const wobble = ((spectrum[si] || 0) / 255) * (4 + e * 15);
      vertex(cos(ang) * (r + wobble), sin(ang) * (r + wobble));
    }
    endShape();
  }

  if (beatIntensity > 0.05) {
    const ringN = floor(2 + e * 6);
    const ringBase = 25 + smoothBass * 50;
    for (let i = 0; i < ringN; i++) {
      const si = floor(map(i, 0, ringN, 0, spectrum.length * 0.5));
      const sv = (spectrum[si] || 0) / 255;
      const r = ringBase + i * (25 + e * 30) + sv * 25;
      const a = beatIntensity * (0.12 + e * 0.4) * (1 - i / ringN * 0.5);
      stroke(255, a * 255);
      strokeWeight(0.6 + e + sv * 2);
      ellipse(0, 0, r * 2, r * 2);
    }
  }

  pop();
}

function renderAttractMode() {
  background(0);
  push();
  translate(CX, CY);
  noFill();
  const t = frameCount * 0.005;

  for (let i = 0; i < 5; i++) {
    const r = 80 + i * 35;
    stroke(255, map(i, 0, 4, 50, 15));
    strokeWeight(1);
    const s = t * (i % 2 === 0 ? 1 : -1) + i * 0.5;
    arc(0, 0, r * 2, r * 2, s, s + PI * 0.6);
  }
  for (let i = 0; i < 8; i++) {
    const ang = (TWO_PI / 8) * i + t * 0.3;
    stroke(255, 12);
    strokeWeight(0.5);
    line(cos(ang) * 30, sin(ang) * 30, cos(ang) * 120, sin(ang) * 120);
  }
  pop();

  const pulse = (sin(frameCount * 0.04) + 1) / 2;
  noStroke();
  fill(255, 60 + pulse * 80);
  textAlign(CENTER);
  textSize(13);
  textFont('monospace');
  text('click to begin', CX, H - 55);
}

function preload() {
  sound = loadSound('opus.mp3');
}

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(1);
  frameRate(30);
  fft = new p5.FFT(0.8, 512);
  amp = new p5.Amplitude();
  initParticles();
}

function draw() {
  frameCounter++;
  if (!started) { renderAttractMode(); return; }
  if (paused) return;

  analyzeAudio();

  const e = constrain(smoothEnergy + smoothLevel * 0.12, 0, 1);
  background(0, map(e, 0, 1, 10, 45));

  if (dropFlash > 0.01) {
    background(255, dropFlash * 150);
    dropFlash *= 0.85;
  }

  drawMandala(e);
  updateAndRenderParticles(e);

  if (isRecording) {
    noStroke();
    fill(255, 0, 0);
    ellipse(25, 25, 12, 12);
  }
}

function mousePressed() {
  if (!started) {
    started = true;
    sound.play();
    background(0);
  }
}

function keyPressed() {
  if (key === ' ') {
    if (!started) return;
    if (paused) { sound.play(); paused = false; }
    else { sound.pause(); paused = true; }
  }
  if (key === 'r' || key === 'R') {
    if (sound && sound.isPlaying()) sound.stop();
    smoothBass = 0; smoothMid = 0; smoothHigh = 0; smoothLevel = 0;
    prevBass = 0; lastBeatTime = 0; beatDetected = false; beatIntensity = 0;
    spectrum = []; smoothEnergy = 0;
    started = false; paused = false; frameCounter = 0;
    dropFlash = 0; hasDropped = false;
    initParticles();
  }
  if (keyCode === RIGHT_ARROW && started) sound.jump(min(sound.currentTime() + 30, sound.duration()));
  if (keyCode === LEFT_ARROW && started) sound.jump(max(sound.currentTime() - 30, 0));
  if (key === 's' || key === 'S') saveCanvas('opus', 'png');
  if (key === 'g' || key === 'G') toggleRecording();
}

function toggleRecording() {
  if (isRecording) {
    recorder.stop();
    isRecording = false;
    return;
  }

  const canvas = document.querySelector('canvas');
  const stream = canvas.captureStream(30);
  recordedChunks = [];
  recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm; codecs=vp9',
    videoBitsPerSecond: 20_000_000,
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opus.webm';
    a.click();
    URL.revokeObjectURL(url);
  };

  recorder.start();
  isRecording = true;
}
