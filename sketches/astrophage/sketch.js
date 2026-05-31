/**
 * Astrophage
 *
 * A slowly breathing alien sky inspired by Project Hail Mary.
 * High-contrast marbled astrophage-green bleeding into molten orange,
 * produced by domain-warped fBm and rendered entirely in a GLSL shader.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE to nudge the composition seed
 */

const WIDTH = 800;
const HEIGHT = 800;
const LOOP_SECONDS = 30.0;

let skyShader;
let seedOffset = 0.0;

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

uniform float u_time;       // looping phase in [0, 2*PI)
uniform vec2 u_resolution;
uniform float u_seed;

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

// Fine spiral-curl warp: rotate the sample position by a noise-driven angle so
// the field folds into tight paisley vortices, then ridge the result so the
// curls read as bright thin filaments (the reference's little swirls).
float swirl(vec2 p, float t) {
  for (int i = 0; i < 4; i++) {
    float a = fbm(p * 1.8 + t) * 6.2831853;
    p += vec2(cos(a), sin(a)) * 0.55;
  }
  float n = fbm(p);
  return 1.0 - abs(2.0 * n - 1.0); // ridged -> sharp veins
}

void main() {
  vec2 uv = vUv;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 p = uv * 3.0 + u_seed;

  // Seamless loop: every time term is periodic in u_time (phase 0..2*PI).
  float phase = u_time;
  vec2 drift  = vec2(cos(phase), sin(phase)) * 0.6;
  vec2 drift2 = vec2(cos(phase * 2.0), sin(phase * 2.0)) * 0.25;
  float breath = 0.85 + 0.15 * sin(phase);

  // Two levels of domain warping fold smooth gradients into marbled swirls.
  vec2 q = vec2(fbm(p + drift),
                fbm(p + vec2(5.2, 1.3) + drift));

  vec2 r = vec2(fbm(p + 4.0 * breath * q + vec2(1.7, 9.2) + drift2),
                fbm(p + 4.0 * breath * q + vec2(8.3, 2.8) + drift2));

  float base = fbm(p + 4.0 * breath * r);

  // Fine spiral curls layered onto the large marbled structure. Ridged veins
  // are added (not averaged) so the swirls stay crisp instead of blurring.
  // Gate the veins by the base so they only brighten already-lit gas, leaving
  // the dark troughs as breathing room.
  float curls = swirl(p * 3.6 + 2.0 * r, phase);
  float veins = smoothstep(0.62, 0.98, curls);
  float f = clamp(base + veins * 0.3 * smoothstep(0.3, 0.7, base), 0.0, 1.0);

  // Large-scale region mask: decides whether an area reads green or molten.
  // Low-frequency so it paints big zones (like the reference), not specks.
  float region = fbm(p * 0.55 + r * 1.5 + drift * 0.5);
  region = smoothstep(0.42, 0.72, region);

  // Astrophage palette
  vec3 shadow    = vec3(0.02, 0.03, 0.02);  // near-black trough
  vec3 deepGreen = vec3(0.05, 0.25, 0.06);
  vec3 acidGreen = vec3(0.45, 0.95, 0.18);  // bright green core
  vec3 deepAmber = vec3(0.35, 0.16, 0.02);  // dark molten body
  vec3 molten    = vec3(0.98, 0.42, 0.05);  // bright orange
  vec3 emberGold = vec3(1.00, 0.78, 0.20);  // hottest highlight

  // Green regime: shadow -> deep green -> acid green by structure.
  vec3 green = mix(shadow, deepGreen, smoothstep(0.25, 0.5, f));
  green = mix(green, acidGreen, smoothstep(0.5, 0.85, f));

  // Molten regime: shadow -> deep amber -> orange -> gold by structure.
  vec3 fire = mix(shadow, deepAmber, smoothstep(0.22, 0.45, f));
  fire = mix(fire, molten, smoothstep(0.45, 0.72, f));
  fire = mix(fire, emberGold, smoothstep(0.78, 0.98, f));

  // Blend the two regimes across the frame.
  vec3 col = mix(green, fire, region);

  // Deepen troughs for high contrast (avoid soft-fog washout).
  col *= smoothstep(0.08, 0.5, base) * 0.92 + 0.08;

  gl_FragColor = vec4(col, 1.0);
}
`;

function setup() {
  const cnv = createCanvas(WIDTH, HEIGHT, WEBGL);
  cnv.parent('canvas-container');
  noStroke();
  skyShader = createShader(vertShader, fragShader);
  shader(skyShader);
}

function draw() {
  const phase = ((millis() / 1000.0) % LOOP_SECONDS) / LOOP_SECONDS * TWO_PI;
  skyShader.setUniform('u_resolution', [width, height]);
  skyShader.setUniform('u_time', phase);
  skyShader.setUniform('u_seed', seedOffset);
  rect(-width / 2, -height / 2, width, height);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('astrophage', 'png');
  } else if (key === ' ') {
    seedOffset += 137.5;
  }
}
