/**
 * Drifting Clouds
 *
 * A realistic animated sky with fluffy cumulus clouds drifting gently
 * across a deep blue gradient. Layered FBM noise creates volumetric
 * clouds with sunlit tops and shadowed bottoms, parallax depth between
 * four cloud layers.
 *
 * Controls:
 * - Press S to save PNG
 */

const WIDTH = 600;
const HEIGHT = 400;

let skyShader;

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

// --- Sky gradient ---

vec3 skyGradient(float y) {
  // y: 0 = bottom, 1 = zenith
  vec3 zenith  = vec3(0.08, 0.22, 0.55);  // deep cobalt
  vec3 mid     = vec3(0.18, 0.42, 0.75);  // vivid cerulean
  vec3 bottom  = vec3(0.42, 0.62, 0.85);  // bright blue

  if (y < 0.4) {
    return mix(bottom, mid, y / 0.4);
  } else {
    return mix(mid, zenith, (y - 0.4) / 0.6);
  }
}

// --- Cloud density with volumetric lighting ---
// Returns vec2(shape, light) where shape is cloud opacity, light is 0=shadow 1=sunlit

vec2 cloud(vec2 uv, float scale, float drift, float seed,
           float bandLo, float bandHi, float thresh) {
  vec2 asp = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = uv * asp * scale + vec2(u_time * drift, 0.0) + seed;

  // 5-octave FBM: big enough for shape, detailed enough for fluffy edges
  float d = fbm(p, 5);
  // Second frequency at 1.6x for cumulus cauliflower detail
  float d2 = fbm(p * 1.6 + vec2(31.7, 9.3), 5);
  float n = d * 0.6 + d2 * 0.4;

  // Cloud shape with defined but not harsh edges
  float shape = smoothstep(thresh, thresh + 0.10, n);

  // Vertical band confinement
  shape *= smoothstep(bandLo - 0.05, bandLo + 0.08, uv.y)
         * smoothstep(bandHi + 0.05, bandHi - 0.08, uv.y);

  // Volumetric lighting: sample density at sun-direction offset
  vec2 lightOff = vec2(0.05, -0.09);
  float nL = fbm(p + lightOff, 5) * 0.6
           + fbm((p + lightOff) * 1.6 + vec2(31.7, 9.3), 5) * 0.4;
  float light = clamp((nL - n) * 5.5 + 0.5, 0.0, 1.0);

  return vec2(shape, light);
}

// --- Main ---

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;

  vec3 sky = skyGradient(uv.y);
  vec3 baseSky = sky;

  // Cloud palette — stronger contrast for volumetric pop
  vec3 cloudWhite  = vec3(1.0, 1.0, 1.0);
  vec3 cloudShadow = vec3(0.52, 0.56, 0.70);

  // Layer 1: Distant haze (high, slow, faint)
  {
    vec2 cl = cloud(uv, 4.0, 0.025, 0.0, 0.55, 0.92, 0.52);
    vec3 color = mix(cloudShadow, cloudWhite * 0.90, cl.y);
    color = mix(color, baseSky, 0.50);
    sky = mix(sky, color, cl.x * 0.28);
  }

  // Layer 2: Background cumulus (mid-high)
  {
    vec2 cl = cloud(uv, 5.0, 0.045, 47.0, 0.38, 0.80, 0.50);
    vec3 color = mix(cloudShadow, cloudWhite, cl.y);
    color = mix(color, baseSky, 0.25);
    sky = mix(sky, color, cl.x * 0.60);
  }

  // Layer 3: Hero clouds (mid-band, prominent)
  {
    vec2 cl = cloud(uv, 6.0, 0.070, 120.0, 0.20, 0.65, 0.48);
    vec3 color = mix(cloudShadow, cloudWhite, cl.y);
    sky = mix(sky, color, cl.x * 0.88);
  }

  // Layer 4: Near foreground wisps (lower, faster)
  {
    vec2 cl = cloud(uv, 7.5, 0.100, 200.0, 0.08, 0.42, 0.50);
    vec3 color = mix(cloudShadow, cloudWhite, cl.y);
    sky = mix(sky, color, cl.x * 0.55);
  }

  // --- Subtle vignette ---
  vec2 vc = (uv - 0.5) * vec2(0.8, 1.2);
  float vignette = 1.0 - length(vc) * 0.18;
  vignette = clamp(vignette, 0.0, 1.0);
  sky *= vignette;

  // --- Gamma correction ---
  sky = pow(sky, vec3(0.95));

  gl_FragColor = vec4(sky, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');

  skyShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(skyShader);
  skyShader.setUniform('u_time', millis() / 1000.0);
  skyShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('drifting-clouds', 'png');
  }
}
