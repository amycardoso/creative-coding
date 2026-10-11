const W = 1080;
const H = 1920;
const HORIZON_Y = 1500;

let stars = [];
let mountains = [];
let trees = [];
let skyBuffer;
let auroraBuffer;
let bloomBuffer;
let hueCycleOffset = 0;

const auroraLayers = [
  { yCenter: 480, height: 600, foldAmp: 70, alphaMax: 0.45, speed: 0.08, noiseScale: 0.003, foldScale: 0.012 },
  { yCenter: 600, height: 480, foldAmp: 50, alphaMax: 0.35, speed: 0.06, noiseScale: 0.004, foldScale: 0.010 },
  { yCenter: 400, height: 670, foldAmp: 95, alphaMax: 0.25, speed: 0.04, noiseScale: 0.002, foldScale: 0.008 },
  { yCenter: 720, height: 360, foldAmp: 35, alphaMax: 0.30, speed: 0.10, noiseScale: 0.005, foldScale: 0.015 },
];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent('canvas-container');
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 1.0);
  frameRate(30);

  skyBuffer = createGraphics(W, H);
  skyBuffer.colorMode(HSB, 360, 100, 100, 1.0);
  renderSkyGradient(skyBuffer);

  auroraBuffer = createGraphics(W, HORIZON_Y);
  auroraBuffer.colorMode(HSB, 360, 100, 100, 1.0);

  bloomBuffer = createGraphics(W / 3, HORIZON_Y / 3);
  bloomBuffer.colorMode(HSB, 360, 100, 100, 1.0);

  generateStars(300);
  generateMountains();
  generateTrees();
}

function draw() {
  hueCycleOffset = sin(frameCount * 0.001) * 15;

  image(skyBuffer, 0, 0);
  drawStars();
  drawAtmosphericGlow();

  auroraBuffer.clear();
  for (let i = auroraLayers.length - 1; i >= 0; i--) {
    drawAuroraLayer(auroraBuffer, i);
  }
  image(auroraBuffer, 0, 0);

  drawBloom();
  drawMountains();
  drawTrees();
}

function renderSkyGradient(buf) {
  buf.noStroke();
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const h = lerp(230, 220, t);
    const s = lerp(80, 60, t);
    const b = lerp(8, 18, t);
    buf.fill(h, s, b);
    buf.rect(0, y, W, 1);
  }
}

function generateStars(count) {
  for (let i = 0; i < count; i++) {
    stars.push({
      x: random(W),
      y: random(HORIZON_Y * 0.85),
      size: random(1, 2.5),
      twinkleSpeed: random(0.02, 0.06),
      twinklePhase: random(TWO_PI),
      brightness: random(60, 100),
    });
  }
}

function drawStars() {
  noStroke();
  for (const s of stars) {
    const twinkle = 0.5 + 0.5 * sin(frameCount * s.twinkleSpeed + s.twinklePhase);
    const alpha = map(twinkle, 0, 1, 0.2, 0.9);
    fill(50, 10, s.brightness, alpha);
    ellipse(s.x, s.y, s.size, s.size);
  }
}

function drawAtmosphericGlow() {
  noStroke();
  const glowH = 140 + hueCycleOffset;
  for (let i = 0; i < 60; i++) {
    const t = i / 60;
    const y = HORIZON_Y - 160 + i * 2.5;
    const alpha = (1 - t) * 0.06;
    fill(glowH, 70, 50, alpha);
    rect(0, y, W, 2);
  }
}

function drawAuroraLayer(buf, layerIdx) {
  const layer = auroraLayers[layerIdx];
  const t = frameCount * layer.speed * 0.01;
  const xStep = 2;

  buf.noFill();
  buf.strokeWeight(xStep + 0.5);

  for (let x = 0; x < W; x += xStep) {
    const waveY = noise(x * layer.noiseScale, t + layerIdx * 100) * layer.height - layer.height / 2;
    const foldX = (noise(x * layer.foldScale, t * 1.5 + layerIdx * 50) - 0.5) * layer.foldAmp * 2;
    const foldNext = (noise((x + xStep) * layer.foldScale, t * 1.5 + layerIdx * 50) - 0.5) * layer.foldAmp * 2;
    const foldBrightness = constrain(abs(foldNext - foldX) / (layer.foldAmp * 0.3), 0.3, 1.0);

    const baseY = layer.yCenter + waveY;
    const curtainTop = baseY - layer.height * 0.3;
    const curtainBot = baseY + layer.height * 0.7;
    const segments = 20;

    for (let s = 0; s < segments; s++) {
      const segT = s / segments;
      const y1 = lerp(curtainTop, curtainBot, segT);
      const y2 = lerp(curtainTop, curtainBot, (s + 1) / segments);

      const colInfo = auroraColor(segT, layerIdx);

      const verticalFade = pow(1 - segT, 0.6);
      const edgeFade = segT < 0.1 ? segT / 0.1 : 1.0;
      const alpha = layer.alphaMax * verticalFade * edgeFade * foldBrightness;

      buf.stroke(colInfo.h, colInfo.s, colInfo.b, alpha);
      buf.line(x + foldX, y1, x + foldX, y2);
    }
  }
}

function auroraColor(segT, layerIdx) {
  const hueShift = hueCycleOffset + layerIdx * 8;

  if (segT > 0.6) {
    const t = (segT - 0.6) / 0.4;
    return {
      h: (130 + hueShift) % 360,
      s: lerp(75, 85, t),
      b: lerp(70, 95, t),
    };
  } else if (segT > 0.25) {
    const t = (segT - 0.25) / 0.35;
    return {
      h: (lerp(170, 130, t) + hueShift) % 360,
      s: lerp(65, 75, t),
      b: lerp(60, 70, t),
    };
  } else {
    const t = segT / 0.25;
    return {
      h: (lerp(280, 170, t) + hueShift) % 360,
      s: lerp(50, 65, t),
      b: lerp(40, 60, t),
    };
  }
}

function drawBloom() {
  bloomBuffer.clear();
  bloomBuffer.blendMode(BLEND);
  bloomBuffer.image(auroraBuffer, 0, 0, W / 3, HORIZON_Y / 3);
  bloomBuffer.filter(BLUR, 4);

  push();
  blendMode(ADD);
  tint(0, 0, 100, 0.18);
  image(bloomBuffer, 0, 0, W, HORIZON_Y);
  pop();
  blendMode(BLEND);
}

function generateMountains() {
  const configs = [
    { baseY: HORIZON_Y + 40, amp: 180, noiseScale: 0.004, col: [220, 30, 8] },
    { baseY: HORIZON_Y + 20, amp: 220, noiseScale: 0.006, col: [220, 25, 5] },
    { baseY: HORIZON_Y,      amp: 140, noiseScale: 0.008, col: [220, 20, 3] },
  ];

  for (const cfg of configs) {
    const points = [];
    for (let x = 0; x <= W; x += 2) {
      const y = cfg.baseY - noise(x * cfg.noiseScale + cfg.col[2] * 10) * cfg.amp;
      points.push({ x, y });
    }
    mountains.push({ points, col: cfg.col });
  }
}

function drawMountains() {
  noStroke();
  for (const m of mountains) {
    fill(m.col[0], m.col[1], m.col[2]);
    beginShape();
    for (const p of m.points) {
      vertex(p.x, p.y);
    }
    vertex(W, H);
    vertex(0, H);
    endShape(CLOSE);
  }
}

function generateTrees() {
  const frontRidge = mountains[2].points;
  for (let i = 0; i < frontRidge.length; i += 4) {
    if (random() > 0.55) continue;
    const p = frontRidge[i];
    const h = random(25, 60);
    trees.push({
      x: p.x,
      baseY: p.y,
      height: h,
      width: h * random(0.25, 0.4),
    });
  }
}

function drawTrees() {
  noStroke();
  fill(220, 20, 2);
  for (const t of trees) {
    triangle(
      t.x, t.baseY - t.height,
      t.x - t.width / 2, t.baseY,
      t.x + t.width / 2, t.baseY,
    );
    rect(t.x - 1, t.baseY, 2, 4);
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('aurora-boreal', 'png');
  }
  if (key === 'g' || key === 'G') {
    saveGif('aurora-boreal', 5);
  }
}
