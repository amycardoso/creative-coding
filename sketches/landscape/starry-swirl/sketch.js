/**
 * Starry Swirl
 *
 * A Van Gogh / James R. Eads–inspired swirling night sky rendered in GLSL.
 * Double domain-warped FBM creates luminous flowing currents across a deep
 * dark canvas, with twinkling stars and a glowing moon.
 *
 * Controls:
 * - Press S to save PNG
 */

P5Capture.setDefaultOptions({
  format: 'webm',
  framerate: 60,
  quality: 1.0,
  width: 800,
});

const WIDTH = 800;
const HEIGHT = 800;

let swirlShader;

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

// --- Noise foundation ---

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

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value;
}

// --- Explicit Van Gogh spiral distortions ---
// Rotate UV around specific center points with distance falloff
// This creates the large sweeping concentric swirl patterns

vec2 applySwirls(vec2 uv, float t) {
  // Central spiral (gentler, broader)
  vec2 c1 = vec2(0.45, 0.50);
  vec2 d1 = uv - c1;
  float dist1 = length(d1);
  float angle1 = 1.8 * exp(-dist1 * 2.0) + t * 0.02;
  float cos1 = cos(angle1), sin1 = sin(angle1);
  uv = c1 + vec2(cos1 * d1.x - sin1 * d1.y, sin1 * d1.x + cos1 * d1.y);

  // Upper-left spiral
  vec2 c2 = vec2(0.20, 0.75);
  vec2 d2 = uv - c2;
  float dist2 = length(d2);
  float angle2 = 1.3 * exp(-dist2 * 3.5) - t * 0.015;
  float cos2 = cos(angle2), sin2 = sin(angle2);
  uv = c2 + vec2(cos2 * d2.x - sin2 * d2.y, sin2 * d2.x + cos2 * d2.y);

  // Right-side spiral (opposite direction)
  vec2 c3 = vec2(0.78, 0.35);
  vec2 d3 = uv - c3;
  float dist3 = length(d3);
  float angle3 = -1.0 * exp(-dist3 * 4.0) + t * 0.01;
  float cos3 = cos(angle3), sin3 = sin(angle3);
  uv = c3 + vec2(cos3 * d3.x - sin3 * d3.y, sin3 * d3.x + cos3 * d3.y);

  // Small lower-left swirl
  vec2 c4 = vec2(0.30, 0.25);
  vec2 d4 = uv - c4;
  float dist4 = length(d4);
  float angle4 = 0.8 * exp(-dist4 * 5.0) + t * 0.012;
  float cos4 = cos(angle4), sin4 = sin(angle4);
  uv = c4 + vec2(cos4 * d4.x - sin4 * d4.y, sin4 * d4.x + cos4 * d4.y);

  return uv;
}

// --- Double domain warp ---

float domainWarp(vec2 p, float t, out vec2 q, out vec2 r) {
  q = vec2(
    fbm(p + vec2(0.0, 0.0) + t * 0.04),
    fbm(p + vec2(5.2, 1.3) + t * 0.03)
  );

  r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.025),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.02)
  );

  return fbm(p + 3.0 * r);
}

// Palette — hue variation like mixed pigments on canvas
vec3 voidIndigo   = vec3(0.02, 0.01, 0.07);   // purple-black darks
vec3 deepNavy     = vec3(0.03, 0.04, 0.16);   // ultramarine deep
vec3 midBlue      = vec3(0.08, 0.16, 0.40);   // cobalt body
vec3 tealBlue     = vec3(0.06, 0.20, 0.38);   // teal-shifted mid
vec3 lightBlue    = vec3(0.24, 0.38, 0.65);   // bright cobalt
vec3 paleWarm     = vec3(0.50, 0.58, 0.76);   // warm blue-white (not gray)
vec3 warmYellow   = vec3(0.95, 0.88, 0.55);

// Small background stars
float stars(vec2 uv, float t) {
  float star = 0.0;
  for (int i = 0; i < 3; i++) {
    float scale = 60.0 + float(i) * 50.0;
    vec2 grid = floor(uv * scale);
    vec2 gridUv = fract(uv * scale) - 0.5;
    float h = hash(grid + float(i) * 100.0);
    if (h > 0.82) {
      vec2 offset = vec2(hash(grid + 0.1) - 0.5, hash(grid + 0.2) - 0.5) * 0.5;
      float d = length(gridUv - offset);
      float brightness = smoothstep(0.06, 0.0, d);
      float twinkle = sin(t * (1.5 + h * 3.0) + h * 6.28) * 0.5 + 0.5;
      brightness *= 0.4 + twinkle * 0.6;
      brightness *= 0.5 + h * 0.5;
      star += brightness;
    }
  }
  return star;
}

// Large feature stars with glowing halos (Van Gogh-style)
vec3 featureStars(vec2 uv, float t) {
  vec3 glow = vec3(0.0);
  // 5 hand-placed bright stars
  vec2 positions[5];
  positions[0] = vec2(0.15, 0.85);
  positions[1] = vec2(0.40, 0.72);
  positions[2] = vec2(0.62, 0.90);
  positions[3] = vec2(0.25, 0.45);
  positions[4] = vec2(0.88, 0.55);

  for (int i = 0; i < 5; i++) {
    vec2 pos = positions[i];
    float d = length(uv - pos);
    float twinkle = sin(t * (1.2 + float(i) * 0.5) + float(i) * 2.1) * 0.3 + 0.7;

    // Bright core
    float core = smoothstep(0.012, 0.0, d) * twinkle;
    glow += vec3(1.0, 1.0, 0.95) * core;

    // Warm halo — bright enough to overpower the dark blue
    float halo = exp(-d * d * 1000.0) * twinkle;
    glow += vec3(1.0, 0.92, 0.55) * halo * 0.8;

    // Soft outer glow — lighter to avoid brown mudiness
    float outer = exp(-d * d * 250.0) * twinkle;
    glow += vec3(0.8, 0.75, 0.5) * outer * 0.3;
  }
  return glow;
}

// --- Main ---

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;
  float t = u_time;

  // Apply Van Gogh spiral distortions, then scale for pattern density
  vec2 swirledUv = applySwirls(uv, t);
  vec2 p = swirledUv * 2.5;

  // Domain warp
  vec2 q, r;
  float f = domainWarp(p, t, q, r);

  // Dark sky base — hue shifts across the f range
  vec3 col = deepNavy;
  col = mix(col, midBlue,   smoothstep(0.45, 0.55, f));
  col = mix(col, lightBlue, smoothstep(0.55, 0.67, f));
  col = mix(col, paleWarm,  smoothstep(0.67, 0.76, f));
  col = mix(col, lightBlue, smoothstep(0.76, 0.88, f));

  // Teal variation in mid-range using warp displacement
  float rMag = length(r);
  col = mix(col, tealBlue, smoothstep(0.3, 0.6, rMag) * smoothstep(0.5, 0.35, f) * 0.45);

  // Purple-black crevices between strokes
  col = mix(col, voidIndigo, smoothstep(0.38, 0.12, f) * 0.85);

  // Subtle luminous edges — light blue/white, NOT gold
  float eps = 0.005;
  vec2 qD, rD;
  float fx = domainWarp(p + vec2(eps, 0.0), t, qD, rD);
  float fy = domainWarp(p + vec2(0.0, eps), t, qD, rD);
  float edge = length(vec2(fx - f, fy - f)) / eps;

  float edgeGlow = smoothstep(1.0, 3.0, edge);
  col = mix(col, paleWarm, edgeGlow * 0.3);
  col += vec3(0.7, 0.75, 0.85) * pow(edgeGlow, 3.0) * 0.15;

  // Warm accent on the very brightest swirl peaks
  float peakGlow = smoothstep(0.72, 0.82, f);
  col += vec3(0.25, 0.18, 0.05) * peakGlow * 0.4;

  // Background stars — visible in dark areas
  float darkness = 1.0 - smoothstep(0.4, 0.65, f);
  float starBright = stars(uv, t) * darkness;
  col += vec3(1.0, 1.0, 0.95) * starBright * 1.8;
  col += warmYellow * pow(max(starBright, 0.0), 0.5) * 0.3;

  // Feature stars with glowing halos
  col += featureStars(uv, t) * darkness;

  // Moon — upper right
  vec2 moonPos = vec2(0.74, 0.76);
  float moonDist = length(uv - moonPos);
  float moonRadius = 0.06;

  float moonDisc = smoothstep(moonRadius, moonRadius - 0.004, moonDist);
  float craters = fbm(uv * 40.0) * 0.12;
  vec3 moonColor = vec3(0.98, 0.95, 0.80) - craters;
  col = mix(col, moonColor, moonDisc);

  // Moon glow — bright enough to read as light, not brown
  float moonGlow = exp(-moonDist * moonDist * 50.0);
  col += vec3(0.55, 0.55, 0.45) * moonGlow * 0.3;
  float innerHalo = exp(-moonDist * moonDist * 180.0);
  col += vec3(0.95, 0.92, 0.75) * innerHalo * 0.6;

  // Saturation boost — more vibrancy
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.35);

  // Soft vignette (don't clip the moon)
  vec2 vc = uv - 0.5;
  float vignette = 1.0 - dot(vc, vc) * 0.35;
  col *= clamp(vignette, 0.0, 1.0);

  // Gamma
  col = pow(col, vec3(0.95));

  gl_FragColor = vec4(col, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');
  swirlShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(swirlShader);
  swirlShader.setUniform('u_time', millis() / 1000.0);
  swirlShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('starry-swirl', 'png');
  }
}
