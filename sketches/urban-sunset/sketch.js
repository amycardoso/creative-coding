/**
 * Urban Sunset
 *
 * A generative visualization capturing the beauty of urban sunsets.
 * Shader-based sky with wispy clouds transitioning through
 * autumn-leaf, burnt-peach, rosy-granite, dim-grey, coffee-bean.
 * Silhouetted cityscape with buildings and power lines.
 *
 * Controls:
 * - Press S to save PNG
 * - Press R to regenerate city
 */


const WIDTH = 400;
const HEIGHT = 600;

let skyShader;
let buildings = [];
let powerPoles = [];
let wires = [];
let silhouetteBuffer;

const vertShader = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vUv;

void main() {
  vUv = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`;

const fragShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value;
}

vec3 skyGradient(float y) {
  vec3 autumnLeaf = vec3(0.933, 0.431, 0.071);
  vec3 burntPeach = vec3(0.792, 0.427, 0.318);
  vec3 rosyGranite = vec3(0.580, 0.553, 0.600);
  vec3 dimGrey = vec3(0.365, 0.373, 0.424);

  if (y < 0.2) {
    return mix(autumnLeaf, burntPeach, y / 0.2);
  } else if (y < 0.45) {
    return mix(burntPeach, rosyGranite, (y - 0.2) / 0.25);
  } else if (y < 0.7) {
    return mix(rosyGranite, dimGrey, (y - 0.45) / 0.25);
  } else {
    return mix(dimGrey, dimGrey * 0.85, (y - 0.7) / 0.3);
  }
}

float cloudNoise(vec2 uv, float stretch) {
  vec2 p = uv * vec2(1.0, stretch);
  return fbm(p, 6);
}

float wispyClouds(vec2 uv, float seed) {
  vec2 p = uv + seed;

  float n1 = cloudNoise(p * vec2(0.8, 4.0) + u_time * 0.01, 1.0);
  float n2 = cloudNoise(p * vec2(1.2, 6.0) + vec2(50.0, 0.0) + u_time * 0.008, 1.0);
  float n3 = cloudNoise(p * vec2(0.6, 3.0) + vec2(100.0, 20.0) + u_time * 0.012, 1.0);

  float c1 = smoothstep(0.35, 0.55, n1);
  float c2 = smoothstep(0.4, 0.6, n2);
  float c3 = smoothstep(0.3, 0.5, n3);

  return (c1 + c2 * 0.7 + c3 * 0.5) / 2.2;
}

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;

  vec3 sky = skyGradient(uv.y);

  vec3 autumnLeaf = vec3(0.933, 0.431, 0.071);
  vec3 burntPeach = vec3(0.792, 0.427, 0.318);
  vec3 rosyGranite = vec3(0.580, 0.553, 0.600);
  vec3 dimGrey = vec3(0.365, 0.373, 0.424);

  float horizonDist = uv.y;
  float horizonGlow = exp(-horizonDist * 5.0) * 0.5;
  sky += autumnLeaf * horizonGlow;

  float sunDist = length(vec2(uv.x - 0.5, uv.y) * vec2(1.0, 2.5));
  float sunGlow = exp(-sunDist * 4.0) * 0.35;
  sky += autumnLeaf * 1.1 * sunGlow;

  // Clouds
  float lowClouds = wispyClouds(uv * vec2(1.5, 1.0), 0.0);
  lowClouds *= smoothstep(0.45, 0.08, uv.y);
  vec3 lowColor = mix(autumnLeaf * 1.3, burntPeach * 1.2, lowClouds);
  sky = mix(sky, lowColor, lowClouds * 0.95);

  float midClouds = wispyClouds(uv * vec2(1.8, 1.2), 30.0);
  midClouds *= smoothstep(0.55, 0.15, uv.y) * smoothstep(0.05, 0.2, uv.y);
  vec3 midColor = mix(burntPeach * 1.2, rosyGranite, midClouds);
  sky = mix(sky, midColor, midClouds * 0.85);

  float highClouds = wispyClouds(uv * vec2(2.0, 1.5), 70.0);
  highClouds *= smoothstep(0.35, 0.7, uv.y) * smoothstep(0.9, 0.6, uv.y);
  vec3 highColor = mix(rosyGranite * 1.1, dimGrey, highClouds);
  sky = mix(sky, highColor, highClouds * 0.7);

  float extraTex = fbm(uv * vec2(3.0, 8.0) + u_time * 0.005, 5);
  extraTex = smoothstep(0.4, 0.6, extraTex);
  extraTex *= smoothstep(0.5, 0.1, uv.y);
  sky = mix(sky, burntPeach * 1.15, extraTex * 0.5);

  float vignette = 1.0 - length((vUv - 0.5) * vec2(0.8, 1.2)) * 0.3;
  sky *= vignette;

  sky = pow(sky, vec3(0.95, 1.0, 1.05));

  gl_FragColor = vec4(sky, 1.0);
}
`;

function setup() {
  pixelDensity(1);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');

  skyShader = createShader(vertShader, fragShader);

  // Create 2D buffer for silhouettes (easier coordinate system)
  silhouetteBuffer = createGraphics(WIDTH, HEIGHT);

  generateCityscape();
  drawSilhouetteToBuffer();
}

function draw() {
  // Draw sky with shader
  shader(skyShader);
  skyShader.setUniform('u_time', millis() / 1000.0);
  skyShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);

  // Reset shader and draw silhouette buffer as texture
  resetShader();
  texture(silhouetteBuffer);
  noStroke();
  plane(WIDTH, HEIGHT);
}

// Press S to save PNG, R to regenerate city
function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('urban-sunset', 'png');
  }
  if (key === 'r' || key === 'R') {
    generateCityscape();
    drawSilhouetteToBuffer();
  }
}

function generateCityscape() {
  buildings = [];
  powerPoles = [];
  wires = [];

  // 2D coordinates: origin top-left, Y+ is down
  const baseY = HEIGHT * 0.88;

  let x = -20;
  while (x < WIDTH + 50) {
    const buildingWidth = 35 + random(60);
    const buildingHeight = 50 + random(130);
    const hasAntenna = random() > 0.7;

    buildings.push({
      x: x,
      y: baseY,
      width: buildingWidth,
      height: buildingHeight,
      hasAntenna: hasAntenna,
      antennaHeight: hasAntenna ? 10 + random(20) : 0,
      windows: generateWindows(buildingWidth, buildingHeight)
    });

    x += buildingWidth - 2 + random(5);
  }

  const polePositions = [WIDTH * 0.15, WIDTH * 0.45, WIDTH * 0.75];
  polePositions.forEach((px) => {
    const poleHeight = 180 + random(40);
    powerPoles.push({
      x: px,
      y: baseY + 20,
      height: poleHeight,
      crossbarWidth: 40 + random(20),
      crossbarY: poleHeight - 30
    });
  });

  for (let i = 0; i < powerPoles.length - 1; i++) {
    const p1 = powerPoles[i];
    const p2 = powerPoles[i + 1];

    [0, 15, 30].forEach(offset => {
      wires.push({
        x1: p1.x,
        y1: p1.y - p1.crossbarY + offset,
        x2: p2.x,
        y2: p2.y - p2.crossbarY + offset,
        sag: 15 + random(10)
      });
    });
  }

  const firstPole = powerPoles[0];
  const lastPole = powerPoles[powerPoles.length - 1];

  [0, 15, 30].forEach(offset => {
    wires.push({
      x1: -50,
      y1: firstPole.y - firstPole.crossbarY + offset + 20,
      x2: firstPole.x,
      y2: firstPole.y - firstPole.crossbarY + offset,
      sag: 10
    });
    wires.push({
      x1: lastPole.x,
      y1: lastPole.y - lastPole.crossbarY + offset,
      x2: WIDTH + 50,
      y2: lastPole.y - lastPole.crossbarY + offset + 20,
      sag: 10
    });
  });
}

function generateWindows(buildingWidth, buildingHeight) {
  const windows = [];
  const windowWidth = 6;
  const windowHeight = 8;
  const spacingX = 12;
  const spacingY = 14;
  const margin = 8;

  const cols = floor((buildingWidth - margin * 2) / spacingX);
  const rows = floor((buildingHeight - margin * 2) / spacingY);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (random() > 0.3) {
        windows.push({
          x: margin + col * spacingX,
          y: margin + row * spacingY,
          width: windowWidth,
          height: windowHeight,
          lit: random() > 0.7
        });
      }
    }
  }

  return windows;
}

function drawSilhouetteToBuffer() {
  const g = silhouetteBuffer;
  g.clear();
  g.background(0, 0, 0, 0); // Fully transparent background
  g.noStroke();

  // coffee-bean color
  g.fill(50, 33, 33);

  // Draw buildings
  buildings.forEach(b => {
    g.rect(b.x, b.y - b.height, b.width, b.height + 50);

    if (b.hasAntenna) {
      g.rect(b.x + b.width / 2 - 1, b.y - b.height - b.antennaHeight, 2, b.antennaHeight);
    }

    // Lit windows
    b.windows.forEach(w => {
      if (w.lit) {
        g.fill(238, 110, 18, 180);
        g.rect(b.x + w.x, b.y - b.height + w.y, w.width, w.height);
        g.fill(50, 33, 33);
      }
    });
  });

  // Draw power poles
  powerPoles.forEach(p => {
    g.rect(p.x - 3, p.y - p.height, 6, p.height + 30);
    g.rect(p.x - p.crossbarWidth / 2, p.y - p.crossbarY - 3, p.crossbarWidth, 6);

    const insulatorPositions = [-0.4, -0.2, 0, 0.2, 0.4];
    insulatorPositions.forEach(pos => {
      g.rect(p.x + pos * p.crossbarWidth - 2, p.y - p.crossbarY - 8, 4, 12);
    });
  });

  // Draw wires
  g.stroke(50, 33, 33);
  g.strokeWeight(1.5);
  g.noFill();
  wires.forEach(w => {
    g.beginShape();
    g.vertex(w.x1, w.y1);
    const midX = (w.x1 + w.x2) / 2;
    const midY = max(w.y1, w.y2) + w.sag;
    g.quadraticVertex(midX, midY, w.x2, w.y2);
    g.endShape();
  });

  // Ground fill
  g.noStroke();
  g.fill(50, 33, 33);
  g.rect(0, HEIGHT * 0.88, WIDTH, HEIGHT * 0.15);
}
