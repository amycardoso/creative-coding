/**
 * Oil Marble
 *
 * Swirling oil/acrylic pour painting rendered in GLSL — double domain-warped
 * FBM noise creates dense, organic marble swirls with a glossy wet-paint
 * appearance. Deep blues, salmon pinks, whites, teal, and dark tones flow
 * into each other.
 *
 * Controls:
 * - Press S to save PNG
 * - Press Shift+S to start/stop GIF recording
 */

P5Capture.setDefaultOptions({
  format: 'webm',
  framerate: 60,
  quality: 1.0,
  width: 600,
});

const WIDTH = 600;
const HEIGHT = 600;

let marbleShader;

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

  for (int i = 0; i < 6; i++) {
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value;
}

// --- Double domain warp ---
// Returns f and exposes q, r through out parameters

float domainWarp(vec2 p, float t, out vec2 q, out vec2 r) {
  q = vec2(
    fbm(p + vec2(0.0, 0.0) + t * 0.025),
    fbm(p + vec2(5.2, 1.3) + t * 0.02)
  );

  r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.018),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.015)
  );

  return fbm(p + 4.0 * r);
}

// --- Color palette (saturated, high-contrast like real acrylic pour) ---

vec3 cobaltBlue  = vec3(0.08, 0.30, 0.85);  // vivid cobalt
vec3 royalBlue   = vec3(0.06, 0.12, 0.55);  // deep royal blue
vec3 salmonPink  = vec3(0.95, 0.55, 0.50);  // warm salmon
vec3 blushPink   = vec3(0.92, 0.72, 0.72);  // soft blush
vec3 pureWhite   = vec3(0.97, 0.96, 0.94);  // bright white
vec3 teal        = vec3(0.15, 0.55, 0.58);  // muted teal-green
vec3 deepBlack   = vec3(0.02, 0.02, 0.06);  // near-black
vec3 coralRed    = vec3(0.75, 0.30, 0.30);  // subtle warm coral

// --- Main ---

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;

  float t = u_time;

  // Scale UV for marble pattern density
  vec2 p = uv * 3.0;

  // Double domain warp
  vec2 q, r;
  float f = domainWarp(p, t, q, r);
  float rMag = length(r);
  float qMag = length(q);

  // --- Color ramp: branchless palette lookup, white separates blue/pink ---
  // Ramp: black → royal → cobalt → teal → white → salmon → blush → white

  vec3 col = deepBlack;
  col = mix(col, royalBlue,  smoothstep(0.0,  0.15, f));
  col = mix(col, cobaltBlue, smoothstep(0.15, 0.35, f));
  col = mix(col, teal,       smoothstep(0.35, 0.44, f));
  col = mix(col, pureWhite,  smoothstep(0.44, 0.52, f));
  col = mix(col, salmonPink, smoothstep(0.52, 0.62, f));
  col = mix(col, blushPink,  smoothstep(0.62, 0.78, f));
  col = mix(col, pureWhite,  smoothstep(0.78, 0.94, f));

  // Add depth variation from warp displacement
  vec3 blueTone = mix(cobaltBlue, royalBlue, smoothstep(0.3, 0.65, rMag));
  col = mix(col, blueTone, smoothstep(0.5, 0.75, rMag) * smoothstep(0.4, 0.2, f) * 0.5);

  // White veins from extreme warp (on top of everything)
  float whiteMask = smoothstep(0.7, 0.88, rMag);
  col = mix(col, pureWhite, whiteMask * 0.6);

  // --- Saturation boost (mild — ramp already has clean colors) ---
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.25);

  // --- Oil sheen / glossy lighting ---
  float eps = 0.005;
  vec2 qD, rD;
  float fx = domainWarp(p + vec2(eps, 0.0), t, qD, rD);
  float fy = domainWarp(p + vec2(0.0, eps), t, qD, rD);

  vec3 normal = normalize(vec3(
    (fx - f) / eps,
    (fy - f) / eps,
    1.0
  ));

  // Directional light from upper-left
  vec3 lightDir = normalize(vec3(-0.4, -0.5, 1.0));
  float diffuse = max(dot(normal, lightDir), 0.0);

  // Specular highlight (Blinn-Phong)
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 60.0);

  // Apply lighting — subtle to maintain color richness
  col *= 0.88 + diffuse * 0.18;
  col += vec3(1.0, 0.98, 0.95) * spec * 0.2;

  // --- Vignette ---
  vec2 vc = uv - 0.5;
  float vignette = 1.0 - dot(vc, vc) * 0.5;
  vignette = clamp(vignette, 0.0, 1.0);
  col *= vignette;

  // --- Light tone mapping (preserve saturation) ---
  col = pow(col, vec3(0.95));

  gl_FragColor = vec4(col, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');

  marbleShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(marbleShader);
  marbleShader.setUniform('u_time', millis() / 1000.0);
  marbleShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('oil-marble', 'png');
  }
}
