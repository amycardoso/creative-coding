/**
 * Open Ocean
 *
 * A calm, vast open ocean rendered in GLSL — layered FBM noise creates
 * rolling swells with perspective foreshortening, beneath an overcast sky
 * with soft cumulus clouds, blended at a hazy horizon.
 *
 * Controls:
 * - Press S to save PNG
 */

const WIDTH = 600;
const HEIGHT = 340;

let oceanShader;

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

float warpedFBM(vec2 p, float t) {
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + t * 0.03, 4),
    fbm(p + vec2(5.2, 1.3) + t * 0.02, 4)
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.015, 4),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.012, 4)
  );

  return fbm(p + 4.0 * r, 4);
}

// --- Sky ---

vec3 skyGradient(float y) {
  // y: 0 = horizon, 1 = zenith
  vec3 zenith  = vec3(0.30, 0.45, 0.65);
  vec3 mid     = vec3(0.45, 0.55, 0.72);
  vec3 horizon = vec3(0.62, 0.68, 0.78);

  if (y < 0.3) {
    return mix(horizon, mid, y / 0.3);
  } else {
    return mix(mid, zenith, (y - 0.3) / 0.7);
  }
}

float cloudNoise(vec2 uv, float stretch) {
  vec2 p = uv * vec2(1.0, stretch);
  return fbm(p, 6);
}

float wispyClouds(vec2 uv, float seed) {
  vec2 p = uv + seed;

  float n1 = cloudNoise(p * vec2(0.8, 4.0) + u_time * 0.008, 1.0);
  float n2 = cloudNoise(p * vec2(1.2, 6.0) + vec2(50.0, 0.0) + u_time * 0.006, 1.0);
  float n3 = cloudNoise(p * vec2(0.6, 3.0) + vec2(100.0, 20.0) + u_time * 0.01, 1.0);

  float c1 = smoothstep(0.35, 0.55, n1);
  float c2 = smoothstep(0.4, 0.6, n2);
  float c3 = smoothstep(0.3, 0.5, n3);

  return (c1 + c2 * 0.7 + c3 * 0.5) / 2.2;
}

// --- Ocean waves ---

float oceanWaves(vec2 uv, float t) {
  // Perspective foreshortening: compress toward horizon, spread near viewer
  float perspY = pow(uv.y, 2.5);

  // Wave UV: strongly horizontal-stretched for water-like bands
  vec2 waveUV = vec2(uv.x * 6.0, perspY * 30.0);

  // Layer 1: Large rolling swells — very horizontal
  vec2 swellUV = waveUV * vec2(0.2, 0.5) + vec2(t * 0.14, t * 0.07);
  float swells = fbm(swellUV, 4);

  // Layer 2: Medium cross-waves (domain-warped by swells) — horizontal bias
  vec2 medUV = waveUV * vec2(0.4, 0.9) + vec2(swells * 1.2, t * 0.12);
  medUV += vec2(t * 0.07, -t * 0.035);
  float medWaves = fbm(medUV, 5);

  // Layer 3: Fine ripples (fade near horizon) — horizontal lines
  float rippleFade = smoothstep(0.0, 0.35, uv.y);
  vec2 rippleUV = waveUV * vec2(0.8, 2.2) + vec2(t * 0.17, t * 0.1);
  float ripples = fbm(rippleUV, 6) * rippleFade;

  // Combine with weighted blend
  return swells * 0.5 + medWaves * 0.3 + ripples * 0.2;
}

// --- Main ---

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;

  float t = u_time;

  // Horizon line at 55% from top (uv.y = 0.45 after flip)
  float HORIZON = 0.45;

  vec3 color;

  // Color palette
  vec3 skyZenith  = vec3(0.38, 0.50, 0.62);
  vec3 hazeColor  = vec3(0.58, 0.64, 0.74);

  vec3 cloudBright = vec3(0.76, 0.80, 0.86);
  vec3 cloudShadow = vec3(0.45, 0.52, 0.64);

  vec3 oceanDeep    = vec3(0.02, 0.06, 0.24);
  vec3 oceanMid     = vec3(0.04, 0.13, 0.36);
  vec3 oceanHorizon = vec3(0.22, 0.36, 0.58);
  vec3 skyHorizonColor = vec3(0.62, 0.68, 0.78); // must match skyGradient(0)

  if (uv.y < HORIZON) {
    // --- SKY ---
    // skyY: 0 at horizon, 1 at top
    float skyY = 1.0 - uv.y / HORIZON;

    vec3 sky = skyGradient(skyY);

    // Low cumulus near horizon — thick, prominent
    float lowClouds = wispyClouds(uv * vec2(1.5, 1.0), 0.0);
    lowClouds *= smoothstep(0.45, 0.02, skyY);
    vec3 lowColor = mix(cloudShadow, cloudBright, lowClouds * 0.8 + 0.2);
    sky = mix(sky, lowColor, lowClouds * 0.95);

    // Mid-altitude clouds — soft cumulus
    float midClouds = wispyClouds(uv * vec2(1.8, 1.2), 30.0);
    midClouds *= smoothstep(0.1, 0.35, skyY) * smoothstep(0.65, 0.45, skyY);
    vec3 midColor = mix(cloudShadow, cloudBright * 0.95, midClouds * 0.7 + 0.3);
    sky = mix(sky, midColor, midClouds * 0.85);

    // High thin wisps
    float highClouds = wispyClouds(uv * vec2(2.0, 1.5), 70.0);
    highClouds *= smoothstep(0.45, 0.7, skyY) * smoothstep(0.95, 0.75, skyY);
    vec3 highColor = mix(cloudShadow * 0.95, cloudBright * 0.9, highClouds);
    sky = mix(sky, highColor, highClouds * 0.65);

    // Horizon haze: subtle blend toward haze color near horizon
    float horizonHaze = exp(-skyY * 8.0);
    sky = mix(sky, hazeColor, horizonHaze * 0.35);

    color = sky;
  } else {
    // --- OCEAN ---
    // oceanY: 0 at horizon, 1 at bottom
    float oceanY = (uv.y - HORIZON) / (1.0 - HORIZON);

    // Wave displacement
    float waves = oceanWaves(vec2(uv.x, oceanY), t);

    // Ocean base color: deep near viewer, lighter at horizon
    vec3 baseColor = mix(oceanHorizon, oceanDeep, pow(oceanY, 0.5));
    baseColor = mix(baseColor, oceanMid, smoothstep(0.15, 0.6, oceanY) * 0.5);

    // Wave-driven color variation
    float waveHighlight = smoothstep(0.35, 0.6, waves);
    float waveShadow = smoothstep(0.4, 0.2, waves);

    // Wave contrast ramps up from horizon to foreground
    float contrastScale = smoothstep(0.0, 0.25, oceanY);

    vec3 ocean = baseColor;
    vec3 highlightColor = baseColor * 1.6 + vec3(0.05, 0.08, 0.12);
    vec3 shadowColor = baseColor * 0.4;
    ocean = mix(ocean, highlightColor, waveHighlight * contrastScale * 0.85);
    ocean = mix(ocean, shadowColor, waveShadow * contrastScale * 0.6);

    // Specular highlights on wave crests — mid-distance band
    float specFade = smoothstep(0.08, 0.3, oceanY) * (1.0 - smoothstep(0.3, 0.7, oceanY));
    float specular = pow(max(waveHighlight, 0.0), 3.0) * specFade * 0.4;
    ocean += vec3(specular) * vec3(0.8, 0.85, 0.9);

    // Atmospheric perspective: blend toward sky horizon color right at the seam
    float horizonFog = exp(-oceanY * 35.0);
    ocean = mix(ocean, skyHorizonColor, horizonFog * 0.88);

    color = ocean;
  }

  // --- Horizon blend (Gaussian to soften the seam from both sides) ---
  float horizonDist = abs(uv.y - HORIZON);
  float horizonBlend = exp(-horizonDist * horizonDist / 0.0004);
  color = mix(color, hazeColor * 0.95, horizonBlend * 0.3);

  // --- Subtle vignette ---
  vec2 vc = (uv - 0.5) * vec2(0.8, 1.2);
  float vignette = 1.0 - length(vc) * 0.25;
  vignette = clamp(vignette, 0.0, 1.0);
  color *= vignette;

  // --- Reinhard tone mapping ---
  color = color / (color + vec3(0.5));
  color *= 1.25;

  // --- Gamma correction ---
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');

  oceanShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(oceanShader);
  oceanShader.setUniform('u_time', millis() / 1000.0);
  oceanShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('open-ocean', 'png');
  }
}
