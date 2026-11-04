/**
 * Pillars
 *
 * Nebulae #1. After the Pillars of Creation (Eagle Nebula, M16).
 *
 * A shader in the family of Eye of God, built on one rule: photoevaporation.
 * A bank of gas and a few dense knots are lit by young stars above the frame.
 * For every pixel the shader marches toward the light and adds up the optical
 * depth: exposed gas evaporates, gas in the shadow of a knot survives. The
 * pillars are never drawn; they are shadows. The stars wander on a slow
 * circle, so the columns lean and reshape, and wisps stream off the lit rims.
 *
 * Every visit draws a new seed; ?seed=N pins one (the GIF uses seed 3).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new seed
 */

const WIDTH = 400;
const HEIGHT = 600;
const LOOP_SECONDS = 14;

let nebulaShader, seed, phase = 0, captured = false;

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

uniform float u_phase;   // loop phase in [0, 1)
uniform vec2 u_res;
uniform float u_seed;

varying vec2 vUv;

const float TAU = 6.28318530718;
vec2 SO; // seed offset, set at the top of main()

// --- Noise foundation (same family as Eye of God) ---

float hash(vec2 p) {
  p += SO;
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash21(vec2 p) {
  p = fract((p + SO) * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

float ridge(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * (1.0 - abs(noise(p) * 2.0 - 1.0)); p *= 2.1; a *= 0.5; }
  return v;
}

// Domain-warped FBM; c is a small looping drift (a point on a circle)
float warp(vec2 p, vec2 c) {
  vec2 q = vec2(fbm(p + c), fbm(p + vec2(5.2, 1.3) - c));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2)), fbm(p + 4.0 * q + vec2(8.3, 2.8)));
  return fbm(p + 4.0 * r);
}

// --- Starfield ---

float stars(vec2 uv, float g, float d) {
  vec2 gv = fract(uv * g) - 0.5, id = floor(uv * g);
  float h = hash21(id);
  if (h > d) return 0.0;
  vec2 o = vec2(hash21(id + 100.0), hash21(id + 200.0)) - 0.5;
  float tw = 0.75 + 0.25 * sin(TAU * (u_phase * floor(1.0 + h * 40.0)) + h * 6.28);
  return smoothstep(0.05, 0.0, length(gv - o * 0.7)) * (0.4 + 0.6 * h / d) * tw;
}

float starfield(vec2 uv) {
  return stars(uv, 150.0, 0.04) * 0.25 + stars(uv, 80.0, 0.05) * 0.5
       + stars(uv, 35.0, 0.06) * 0.8 + stars(uv, 15.0, 0.08);
}

// Tone mapping as in Eye of God
vec3 tone(vec3 c) { c = c / (c + vec3(0.45)) * 1.35; return pow(c, vec3(0.9)); }
// --- The rule: photoevaporation ---
// A bank of gas and a few dense knots, lit by young stars above the frame.
// For every point we march toward the light and add up the optical depth.
// Exposed gas evaporates; gas in the shadow of a knot survives.

float knots(vec2 p) {
  return smoothstep(0.60, 0.70, fbm(p * vec2(4.0, 3.0) + 11.0))
       * smoothstep(0.35, 0.6, p.y) * smoothstep(1.45, 1.1, p.y);
}

float gas(vec2 p) {
  return (0.55 + 0.6 * fbm(p * 2.5 + 3.0)) * smoothstep(1.5, 0.2, p.y);
}

// Evaporation flow: two layers half a period apart, cross-faded, so the
// wisps stream away from the light forever and the loop has no seam.
float flowWisps(vec2 p, vec2 dir) {
  float a = fract(u_phase), b = fract(u_phase + 0.5);
  float wa = fbm(vec2(p.x * 10.0, p.y * 2.5) - dir * a * 1.2);
  float wb = fbm(vec2(p.x * 10.0, p.y * 2.5) - dir * b * 1.2 + 7.0);
  return mix(wa, wb, abs(a - 0.5) * 2.0);
}

void main() {
  SO = vec2(fract(u_seed * 0.1373), fract(u_seed * 0.2917)) * 100.0;
  float aspect = u_res.x / u_res.y;
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * aspect * 1.5, uv.y * 1.5);          // y points up
  vec2 drift = 0.12 * vec2(cos(TAU * u_phase), sin(TAU * u_phase));

  // The ionising stars wander on a slow circle above the frame, so the
  // shadows (and the pillars they carve) lean and reshape over the loop.
  vec2 L = vec2(aspect * 0.75 + 0.55 * cos(TAU * u_phase), 3.2 + 0.3 * sin(TAU * u_phase));
  vec2 dir = normalize(L - p);

  float tau = 0.0;
  float jitter = hash21(vUv * u_res * 2.0);
  for (int i = 1; i < 48; i++) {
    vec2 q = p + dir * 0.022 * (float(i) + jitter);
    tau += knots(q) * 0.9 + gas(q) * 0.035;
  }
  float lit = exp(-tau * 1.2);

  // Erosion: only what is in shadow keeps its density
  float d = gas(p) * (1.0 - lit) + knots(p);
  d += 0.12 * (warp(p * 3.0, drift) - 0.5);

  float cloud = smoothstep(0.28, 0.46, d);
  float edge = cloud * (1.0 - smoothstep(0.42, 0.60, d));
  float rimLit = exp(-max(tau - 0.2, 0.0) * 0.6);
  float wisp = smoothstep(0.18, 0.32, d) * (1.0 - cloud) * flowWisps(p, dir);

  // Ionised gas behind: teal high up, amber lower down
  float w = warp(p * 1.3 + vec2(7.0), drift);
  vec3 teal = vec3(0.05, 0.45, 0.55);
  vec3 amber = vec3(0.85, 0.45, 0.10);
  vec3 rust = vec3(0.30, 0.09, 0.04);
  vec3 bg = mix(amber * 0.55, teal, smoothstep(0.1, 1.5, p.y)) * (0.15 + 0.85 * w * w);

  vec3 color = bg * (1.0 - cloud * 0.96);
  color += rust * cloud * (0.10 + 0.7 * warp(p * 4.0 + 2.0, drift * 0.5) * fbm(p * 9.0));
  color += vec3(1.0, 0.72, 0.42) * edge * rimLit * 0.9;
  color += vec3(0.95, 0.65, 0.40) * wisp * 0.9;
  color += vec3(starfield(uv * vec2(1.0, 1.5))) * (1.0 - cloud) * 0.8;

  gl_FragColor = vec4(tone(color), 1.0);
}
`;

function pickSeed() {
  const p = new URLSearchParams(location.search);
  return p.has('seed') ? parseInt(p.get('seed'), 10) : Math.floor(Math.random() * 1e6);
}

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');
  nebulaShader = createShader(vertShader, fragShader);
  seed = pickSeed();

  // Inert during normal viewing; the capture driver calls this per frame.
  window.__captureFrame = async (i, n) => {
    captured = true;
    noLoop();
    phase = (((i % n) + n) % n) / n;
    redraw();
  };
}

function draw() {
  if (!captured) phase = (millis() / 1000 / LOOP_SECONDS) % 1;
  shader(nebulaShader);
  nebulaShader.setUniform('u_phase', phase);
  nebulaShader.setUniform('u_res', [WIDTH, HEIGHT]);
  nebulaShader.setUniform('u_seed', seed % 997);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('pillars-' + seed, 'png');
  if (key === ' ') seed = Math.floor(Math.random() * 1e6);
}
