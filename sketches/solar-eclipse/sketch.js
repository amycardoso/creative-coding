/**
 * Solar Eclipse
 *
 * A stylized solar eclipse rendered in a single GLSL fragment shader —
 * a crescent sun with turbulent chromospheric surface, a glowing corona,
 * and a solar prominence erupting from the limb, over a twinkling
 * starfield. The moon slowly transits across the sun's face.
 *
 * Controls:
 * - Press S to save PNG
 */

const WIDTH = 600;
const HEIGHT = 600;

let eclipseShader;

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

#define PI 3.14159265359

// --- Noise foundation ---

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
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

float fbm8(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 8; i++) {
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value;
}

// --- Domain-warped FBM ---

float warpedFBM(vec2 p, float t) {
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + t * 0.03),
    fbm(p + vec2(5.2, 1.3) + t * 0.02)
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.015),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.012)
  );

  return fbm(p + 4.0 * r);
}

// --- Starfield ---

float starLayer(vec2 uv, float gridSize, float density, float t) {
  float stars = 0.0;
  vec2 gv = fract(uv * gridSize) - 0.5;
  vec2 id = floor(uv * gridSize);

  float h = hash21(id);

  if (h < density) {
    vec2 offset = vec2(hash21(id + 100.0), hash21(id + 200.0)) - 0.5;
    float d = length(gv - offset * 0.7);

    float brightness = smoothstep(0.04, 0.0, d);
    float twinkle = 0.7 + 0.3 * sin(t * (1.0 + h * 3.0) + h * 6.28);
    stars = brightness * twinkle * (0.5 + h * 0.5);
  }

  return stars;
}

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;
  float t = u_time;

  vec3 color = vec3(0.0);

  // === GEOMETRY ===
  vec2 sunCenter = vec2(0.5, 0.52);
  float sunRadius = 0.25;

  // Moon transits slowly from right to left across the sun
  // Slow sinusoidal drift — moon gently oscillates, always showing a crescent
  vec2 moonOffset = vec2(0.12 + 0.03 * sin(t * 0.02), -0.06 + 0.02 * cos(t * 0.015));
  vec2 moonCenter = sunCenter + moonOffset;
  float moonRadius = 0.248;

  float sunDist = length(uv - sunCenter);
  float moonDist = length(uv - moonCenter);

  float px = 1.5 / u_resolution.x;
  float sunMask = 1.0 - smoothstep(sunRadius - px, sunRadius + px, sunDist);
  float moonMask = 1.0 - smoothstep(moonRadius - px, moonRadius + px, moonDist);
  float crescentMask = sunMask * (1.0 - moonMask);

  // === STARFIELD ===
  float stars = 0.0;
  stars += starLayer(uv, 150.0, 0.04, t) * 0.25;
  stars += starLayer(uv, 80.0, 0.05, t) * 0.5;
  stars += starLayer(uv, 35.0, 0.06, t) * 0.8;
  stars += starLayer(uv, 15.0, 0.08, t) * 1.0;

  // Block stars behind sun and moon discs, dim near corona
  float discBlock = 1.0 - max(sunMask, moonMask);
  float starDim = mix(0.06, 1.0, smoothstep(sunRadius, sunRadius + 0.30, sunDist));
  color += vec3(stars * 0.85, stars * 0.88, stars) * discBlock * starDim;

  // === CORONA ===
  float angle = atan(uv.y - sunCenter.y, uv.x - sunCenter.x);

  // Noise-modulated corona width for uneven shape
  float coronaNoise = fbm(vec2(angle * 2.5 + 0.5, t * 0.06));
  float coronaWidth = 0.06 + coronaNoise * 0.04;

  // Streamer features — extended in certain angular directions
  float streamerNoise = fbm(vec2(angle * 4.0, 3.0 + t * 0.03));
  float streamers = smoothstep(0.5, 0.8, streamerNoise);
  coronaWidth += streamers * 0.04;

  float excessDist = max(sunDist - sunRadius, 0.0);
  float corona = exp(-pow(excessDist / coronaWidth, 1.6));

  // Fade corona inside the sun disc
  corona *= smoothstep(sunRadius * 0.92, sunRadius * 1.01, sunDist);

  // Inner corona — bright ring right at the limb
  float innerCorona = exp(-pow(excessDist / 0.012, 2.0));
  innerCorona *= smoothstep(sunRadius * 0.96, sunRadius * 1.005, sunDist);

  // Subtle flickering
  float flicker = 0.9 + 0.1 * sin(t * 2.0 + angle * 3.0);

  // Corona blocked by moon disc
  float coronaVis = 1.0 - moonMask;

  vec3 outerCoronaColor = vec3(0.95, 0.55, 0.12) * corona * 0.45 * flicker;
  vec3 innerCoronaColor = vec3(1.0, 0.75, 0.35) * innerCorona * 0.7;
  color += (outerCoronaColor + innerCoronaColor) * coronaVis;

  // === SOLAR SURFACE (chromospheric granulation) ===
  vec2 surfUV = (uv - sunCenter) / sunRadius * 5.0;
  float surfaceNoise = warpedFBM(surfUV * 1.5, t * 0.35);
  float detailNoise = fbm8(surfUV * 8.0 + t * 0.15);
  surfaceNoise = mix(surfaceNoise, detailNoise, 0.35);

  // Limb darkening — physically-based cosine falloff
  float r = clamp(sunDist / sunRadius, 0.0, 1.0);
  float limbDark = sqrt(max(1.0 - r * r, 0.0));
  limbDark = 0.30 + 0.70 * limbDark;

  // Color ramp: deep amber -> warm orange-gold -> bright amber -> hot white
  vec3 darkAmber  = vec3(0.55, 0.28, 0.04);
  vec3 warmGold   = vec3(0.85, 0.45, 0.06);
  vec3 brightGold = vec3(1.0, 0.65, 0.08);
  vec3 nearWhite  = vec3(1.0, 0.82, 0.45);

  vec3 surfaceColor = mix(darkAmber, warmGold, smoothstep(0.2, 0.4, surfaceNoise));
  surfaceColor = mix(surfaceColor, brightGold, smoothstep(0.4, 0.6, surfaceNoise));
  surfaceColor = mix(surfaceColor, nearWhite, smoothstep(0.65, 0.92, surfaceNoise));
  surfaceColor *= limbDark;

  color += surfaceColor * crescentMask;

  // === TONE MAPPING ===
  color = color / (color + vec3(0.45));
  color *= 1.35;

  // Gamma correction
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');

  eclipseShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(eclipseShader);
  eclipseShader.setUniform('u_time', millis() / 1000.0);
  eclipseShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('solar-eclipse', 'png');
  }
}
