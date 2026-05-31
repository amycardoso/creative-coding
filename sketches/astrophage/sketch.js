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

  float f = fbm(p + 4.0 * breath * r);

  // Astrophage palette
  vec3 shadow    = vec3(0.02, 0.03, 0.02);  // near-black trough
  vec3 deepGreen = vec3(0.05, 0.25, 0.06);
  vec3 acidGreen = vec3(0.45, 0.95, 0.18);  // bright core
  vec3 amber     = vec3(0.95, 0.65, 0.10);
  vec3 molten    = vec3(0.95, 0.30, 0.05);

  // Base body from the final structure: shadow -> deep green -> acid green.
  vec3 col = mix(shadow, deepGreen, smoothstep(0.25, 0.5, f));
  col = mix(col, acidGreen, smoothstep(0.5, 0.85, f));

  // Warp channels push molten orange into the eddies for contrast.
  float heat = smoothstep(0.4, 0.9, r.y) * smoothstep(0.3, 0.8, q.x);
  col = mix(col, amber, heat * 0.7);
  col = mix(col, molten, smoothstep(0.7, 1.0, r.y) * 0.5);

  // Deepen troughs for high contrast (avoid soft-fog washout).
  col *= smoothstep(0.1, 0.55, f) * 0.85 + 0.15;

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
