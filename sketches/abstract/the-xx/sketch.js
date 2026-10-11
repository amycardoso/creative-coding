/**
 * The XX — Animated Fluid Logo Art
 *
 * A bold white X logo over an animated organic, iridescent fluid background.
 * Triple domain-warped FBM with voronoi cellular textures and stretched
 * filaments in warm amber/copper tones with green/teal and pink iridescent
 * accents — all rendered in a single GLSL fragment shader.
 *
 * Controls:
 * - Press S to save PNG
 */

P5Capture.setDefaultOptions({
  format: 'webm',
  framerate: 60,
  quality: 1.0,
  width: 600,
});

const WIDTH = 600;
const HEIGHT = 600;

let fluidShader;

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

vec2 hash2(vec2 p) {
  return vec2(
    fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453),
    fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453)
  );
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

// --- Voronoi cellular noise ---

float voronoi(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float minDist = 1.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 pt = hash2(i + neighbor);
      pt = 0.5 + 0.5 * sin(u_time * 0.3 + 6.2831 * pt);
      vec2 diff = neighbor + pt - f;
      float dist = length(diff);
      minDist = min(minDist, dist);
    }
  }

  return minDist;
}

// --- Triple domain warp ---

float tripleWarp(vec2 p, float t, out vec2 q, out vec2 r, out vec2 s) {
  q = vec2(
    fbm(p + vec2(0.0, 0.0) + t * 0.02),
    fbm(p + vec2(5.2, 1.3) + t * 0.015)
  );

  r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.012),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.01)
  );

  s = vec2(
    fbm(p + 3.5 * r + vec2(3.1, 7.4) + t * 0.008),
    fbm(p + 3.5 * r + vec2(6.7, 4.2) + t * 0.006)
  );

  return fbm(p + 4.0 * s);
}

// --- SDF for X shape ---

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdX(vec2 p) {
  float c = 0.7071; // cos(45deg) = sin(45deg)

  // Rotate +45deg
  vec2 p1 = vec2(c * p.x + c * p.y, -c * p.x + c * p.y);
  // Rotate -45deg
  vec2 p2 = vec2(c * p.x - c * p.y, c * p.x + c * p.y);

  float d1 = sdBox(p1, vec2(0.47, 0.075));
  float d2 = sdBox(p2, vec2(0.47, 0.075));

  return min(d1, d2); // union
}

// --- Curated color palette ---
// Warm base + 3 complementary iridescent accents (like real oil film)

// Purple Sunset palette
vec3 indigo      = vec3(0.20, 0.02, 0.58);   // #340593 deep indigo
vec3 berry       = vec3(0.57, 0.11, 0.35);   // #911C58 berry purple
vec3 crimson     = vec3(0.92, 0.20, 0.35);   // #EA3458 hot crimson
vec3 vividOrange = vec3(0.93, 0.38, 0.16);   // #EC602A vivid orange
vec3 sunGold     = vec3(0.96, 0.75, 0.26);   // #F5BF43 golden yellow

// Derived
vec3 darkBg      = vec3(0.08, 0.01, 0.12);   // near-black with purple tint

// --- Main ---

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;

  float t = u_time * 1.2;

  // Scale UV for pattern density
  vec2 p = uv * 3.0;

  // Triple domain warp
  vec2 q, r, s;
  float f = tripleWarp(p, t, q, r, s);
  float rMag = length(r);
  float sMag = length(s);

  // --- Purple Sunset ramp ---
  vec3 col = darkBg;
  col = mix(col, indigo,          smoothstep(0.0, 0.12, f));
  col = mix(col, berry,           smoothstep(0.12, 0.28, f));
  col = mix(col, crimson,         smoothstep(0.28, 0.45, f));
  col = mix(col, vividOrange,     smoothstep(0.45, 0.62, f));
  col = mix(col, sunGold,         smoothstep(0.62, 0.75, f));
  col = mix(col, vividOrange,     smoothstep(0.75, 0.85, f));
  col = mix(col, berry,           smoothstep(0.85, 1.0, f));

  // --- Accent interplay from warp direction ---
  vec2 warpVec = s - q;
  float angle = atan(warpVec.y, warpVec.x);

  // Indigo glow in dark concavities
  float indigoMask = smoothstep(0.2, 0.02, f) * smoothstep(0.3, 0.6, rMag);
  col = mix(col, indigo * 1.2, indigoMask * 0.5);

  // Crimson streaks through mid-tones
  float crimsonMask = smoothstep(0.3, 0.6, sin(angle + t * 0.12))
                    * smoothstep(0.2, 0.4, f) * smoothstep(0.7, 0.5, f);
  col = mix(col, crimson, crimsonMask * 0.3);

  // --- Voronoi — soft glossy highlights only (no dark borders) ---
  float vor = voronoi(p * 3.0 + q * 2.0);
  float cellHighlight = smoothstep(0.35, 0.6, vor);
  col = mix(col, col * 1.3 + vec3(0.04), cellHighlight * 0.2);

  // --- Stretched filaments (right side) ---
  float rightMask = smoothstep(0.4, 0.8, uv.x);
  vec2 stretchP = p * vec2(1.0, 3.5);
  float filament = fbm(stretchP + r * 3.0 + t * 0.1);
  float filamentLine = smoothstep(0.48, 0.5, filament) * smoothstep(0.52, 0.5, filament);
  col = mix(col, sunGold * 0.9, filamentLine * rightMask * 0.3);

  // --- Oil-sheen specular highlights ---
  float eps = 0.005;
  vec2 qD, rD, sD;
  float fx = tripleWarp(p + vec2(eps, 0.0), t, qD, rD, sD);
  float fy = tripleWarp(p + vec2(0.0, eps), t, qD, rD, sD);
  vec3 normal = normalize(vec3((fx - f) / eps, (fy - f) / eps, 1.0));
  vec3 lightDir = normalize(vec3(-0.4, -0.5, 1.0));
  vec3 halfDir = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(normal, halfDir), 0.0), 48.0);
  col += vec3(1.0, 0.95, 0.9) * spec * 0.3;

  // --- Depth variation from warp ---
  col = mix(col, darkBg, smoothstep(0.5, 0.8, sMag) * 0.25);

  // --- Dark vignette ---
  vec2 vc = uv - 0.5;
  float vignette = 1.0 - dot(vc, vc) * 1.1;
  vignette = clamp(vignette, 0.0, 1.0);
  col *= vignette;

  // --- Saturation boost ---
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.4);

  // --- Gentle contrast lift ---
  col = clamp(col, 0.0, 1.0);
  col = pow(col, vec3(0.9));

  // --- X shape overlay ---
  vec2 centered = uv - 0.5;
  float xDist = sdX(centered);
  float xMask = 1.0 - smoothstep(-0.003, 0.003, xDist);
  col = mix(col, vec3(1.0), xMask);

  gl_FragColor = vec4(col, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');

  fluidShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(fluidShader);
  fluidShader.setUniform('u_time', millis() / 1000.0);
  fluidShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('the-xx', 'png');
  }
}
