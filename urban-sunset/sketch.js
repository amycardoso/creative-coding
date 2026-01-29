/**
 * Urban Sunset
 *
 * A generative visualization capturing the beauty of urban sunsets.
 * Shader-based sky with layered clouds transitioning from
 * deep orange through coral and pink to lavender blue-gray.
 * Silhouetted cityscape with buildings and power lines.
 */

const WIDTH = 400;
const HEIGHT = 600;

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform float u_time;
  uniform vec2 u_resolution;

  varying vec2 v_uv;

  // Hash function for noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Value noise
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

  // Fractal Brownian Motion
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

  // Smooth minimum for blending
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Color palette
  // burnt-peach: #CA6D51 - warm coral
  // autumn-leaf: #EE6E12 - vibrant orange
  // rosy-granite: #948D99 - muted lavender-gray
  // dim-grey: #5D5F6C - cool blue-gray
  // coffee-bean: #322121 - dark warm brown

  vec3 skyGradient(float y) {
    vec3 autumnLeaf = vec3(0.933, 0.431, 0.071);   // #EE6E12 - horizon
    vec3 burntPeach = vec3(0.792, 0.427, 0.318);   // #CA6D51 - lower sky
    vec3 rosyGranite = vec3(0.580, 0.553, 0.600);  // #948D99 - mid sky
    vec3 dimGrey = vec3(0.365, 0.373, 0.424);      // #5D5F6C - upper sky

    // Multi-stop gradient
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

  // Stretched horizontal cloud noise
  float cloudNoise(vec2 uv, float stretch) {
    vec2 p = uv * vec2(1.0, stretch);
    return fbm(p, 6);
  }

  // Create dramatic wispy cloud streaks
  float wispyClouds(vec2 uv, float seed) {
    vec2 p = uv + seed;

    // Heavily stretch horizontally for wispy look
    float n1 = cloudNoise(p * vec2(0.8, 4.0) + u_time * 0.01, 1.0);
    float n2 = cloudNoise(p * vec2(1.2, 6.0) + vec2(50.0, 0.0) + u_time * 0.008, 1.0);
    float n3 = cloudNoise(p * vec2(0.6, 3.0) + vec2(100.0, 20.0) + u_time * 0.012, 1.0);

    // Combine with different thresholds for layered look
    float c1 = smoothstep(0.35, 0.55, n1);
    float c2 = smoothstep(0.4, 0.6, n2);
    float c3 = smoothstep(0.3, 0.5, n3);

    return (c1 + c2 * 0.7 + c3 * 0.5) / 2.2;
  }

  void main() {
    vec2 uv = v_uv;

    // Flip Y so 0 is at bottom (horizon)
    uv.y = 1.0 - uv.y;

    // Base sky gradient
    vec3 sky = skyGradient(uv.y);

    // Palette colors for clouds
    vec3 autumnLeaf = vec3(0.933, 0.431, 0.071);
    vec3 burntPeach = vec3(0.792, 0.427, 0.318);
    vec3 rosyGranite = vec3(0.580, 0.553, 0.600);
    vec3 dimGrey = vec3(0.365, 0.373, 0.424);

    // Horizon glow effect
    float horizonDist = uv.y;
    float horizonGlow = exp(-horizonDist * 5.0) * 0.5;
    sky += autumnLeaf * horizonGlow;

    // Sun glow near center-bottom
    float sunDist = length(vec2(uv.x - 0.5, uv.y) * vec2(1.0, 2.5));
    float sunGlow = exp(-sunDist * 4.0) * 0.35;
    sky += autumnLeaf * 1.1 * sunGlow;

    // DRAMATIC WISPY CLOUDS

    // Low clouds - intense orange near horizon
    float lowClouds = wispyClouds(uv * vec2(1.5, 1.0), 0.0);
    lowClouds *= smoothstep(0.45, 0.08, uv.y);
    vec3 lowColor = mix(autumnLeaf * 1.3, burntPeach * 1.2, lowClouds);
    sky = mix(sky, lowColor, lowClouds * 0.95);

    // Mid clouds - burnt peach / coral
    float midClouds = wispyClouds(uv * vec2(1.8, 1.2), 30.0);
    midClouds *= smoothstep(0.55, 0.15, uv.y) * smoothstep(0.05, 0.2, uv.y);
    vec3 midColor = mix(burntPeach * 1.2, rosyGranite, midClouds);
    sky = mix(sky, midColor, midClouds * 0.85);

    // High clouds - rosy granite / gray
    float highClouds = wispyClouds(uv * vec2(2.0, 1.5), 70.0);
    highClouds *= smoothstep(0.35, 0.7, uv.y) * smoothstep(0.9, 0.6, uv.y);
    vec3 highColor = mix(rosyGranite * 1.1, dimGrey, highClouds);
    sky = mix(sky, highColor, highClouds * 0.7);

    // Extra texture layer
    float extraTex = fbm(uv * vec2(3.0, 8.0) + u_time * 0.005, 5);
    extraTex = smoothstep(0.4, 0.6, extraTex);
    extraTex *= smoothstep(0.5, 0.1, uv.y);
    sky = mix(sky, burntPeach * 1.15, extraTex * 0.5);

    // Subtle vignette
    float vignette = 1.0 - length((v_uv - 0.5) * vec2(0.8, 1.2)) * 0.3;
    sky *= vignette;

    // Slight color correction for warmth
    sky = pow(sky, vec3(0.95, 1.0, 1.05));

    gl_FragColor = vec4(sky, 1.0);
  }
`;

let gl, program, timeLocation;
let startTime;

function initWebGL(canvas) {
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    console.error('WebGL not supported');
    return false;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link failed:', gl.getProgramInfoLog(program));
    return false;
  }

  const vertices = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  timeLocation = gl.getUniformLocation(program, 'u_time');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

  gl.useProgram(program);
  gl.uniform2f(resolutionLocation, WIDTH, HEIGHT);

  return true;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

// City silhouette data
const buildings = [];
const powerPoles = [];
const wires = [];

function generateCityscape() {
  buildings.length = 0;
  powerPoles.length = 0;
  wires.length = 0;

  const baseY = HEIGHT * 0.88;

  // Generate buildings with varied heights and widths
  let x = -20;
  while (x < WIDTH + 50) {
    const buildingWidth = 30 + Math.random() * 80;
    const buildingHeight = 40 + Math.random() * 150;
    const hasAntenna = Math.random() > 0.7;

    buildings.push({
      x: x,
      y: baseY,
      width: buildingWidth,
      height: buildingHeight,
      hasAntenna: hasAntenna,
      antennaHeight: hasAntenna ? 10 + Math.random() * 20 : 0,
      windows: generateWindows(buildingWidth, buildingHeight)
    });

    x += buildingWidth + Math.random() * 20 - 10;
  }

  // Power poles
  const polePositions = [WIDTH * 0.15, WIDTH * 0.45, WIDTH * 0.75];
  polePositions.forEach((px) => {
    const poleHeight = 180 + Math.random() * 40;
    powerPoles.push({
      x: px,
      y: baseY + 20,
      height: poleHeight,
      crossbarWidth: 40 + Math.random() * 20,
      crossbarY: poleHeight - 30
    });
  });

  // Generate wires between poles
  for (let i = 0; i < powerPoles.length - 1; i++) {
    const p1 = powerPoles[i];
    const p2 = powerPoles[i + 1];

    // Multiple wire levels
    [0, 15, 30].forEach(offset => {
      wires.push({
        x1: p1.x,
        y1: p1.y - p1.crossbarY + offset,
        x2: p2.x,
        y2: p2.y - p2.crossbarY + offset,
        sag: 15 + Math.random() * 10
      });
    });
  }

  // Extended wires going off screen
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

  const cols = Math.floor((buildingWidth - margin * 2) / spacingX);
  const rows = Math.floor((buildingHeight - margin * 2) / spacingY);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() > 0.3) {
        windows.push({
          x: margin + col * spacingX,
          y: margin + row * spacingY,
          width: windowWidth,
          height: windowHeight,
          lit: Math.random() > 0.7
        });
      }
    }
  }

  return windows;
}

function drawSilhouette(ctx) {
  // coffee-bean color for silhouettes
  ctx.fillStyle = '#322121';
  ctx.strokeStyle = '#322121';

  // Draw buildings
  buildings.forEach(b => {
    ctx.fillRect(b.x, b.y - b.height, b.width, b.height + 50);

    // Antenna
    if (b.hasAntenna) {
      ctx.fillRect(b.x + b.width / 2 - 1, b.y - b.height - b.antennaHeight, 2, b.antennaHeight);
    }

    // Windows (some lit with warm glow using autumn-leaf)
    b.windows.forEach(w => {
      if (w.lit) {
        ctx.fillStyle = 'rgba(238, 110, 18, 0.7)';
        ctx.fillRect(b.x + w.x, b.y - b.height + w.y, w.width, w.height);
        ctx.fillStyle = '#322121';
      }
    });
  });

  // Draw power poles
  powerPoles.forEach(p => {
    // Main pole
    ctx.fillRect(p.x - 3, p.y - p.height, 6, p.height + 30);

    // Crossbar
    ctx.fillRect(p.x - p.crossbarWidth / 2, p.y - p.crossbarY - 3, p.crossbarWidth, 6);

    // Insulators
    const insulatorPositions = [-0.4, -0.2, 0, 0.2, 0.4];
    insulatorPositions.forEach(pos => {
      ctx.fillRect(p.x + pos * p.crossbarWidth - 2, p.y - p.crossbarY - 8, 4, 12);
    });
  });

  // Draw wires with catenary sag
  ctx.lineWidth = 1.5;
  wires.forEach(w => {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);

    // Catenary curve approximation
    const midX = (w.x1 + w.x2) / 2;
    const midY = Math.max(w.y1, w.y2) + w.sag;
    ctx.quadraticCurveTo(midX, midY, w.x2, w.y2);

    ctx.stroke();
  });

  // Ground fill
  ctx.fillRect(0, HEIGHT * 0.88, WIDTH, HEIGHT * 0.15);
}

function init() {
  const canvas = document.getElementById('sunset-canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  if (!initWebGL(canvas)) {
    console.error('Failed to initialize WebGL');
    return;
  }

  generateCityscape();
  startTime = performance.now();

  // Create overlay canvas for silhouettes
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = WIDTH;
  overlayCanvas.height = HEIGHT;
  overlayCanvas.style.position = 'absolute';
  overlayCanvas.style.top = '0';
  overlayCanvas.style.left = '0';
  overlayCanvas.style.pointerEvents = 'none';
  canvas.parentElement.appendChild(overlayCanvas);

  const overlayCtx = overlayCanvas.getContext('2d');

  function animate() {
    const time = (performance.now() - startTime) / 1000;

    // Render sky shader
    gl.uniform1f(timeLocation, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Clear and draw silhouettes
    overlayCtx.clearRect(0, 0, WIDTH, HEIGHT);
    drawSilhouette(overlayCtx);

    requestAnimationFrame(animate);
  }

  animate();
}

window.addEventListener('load', init);
