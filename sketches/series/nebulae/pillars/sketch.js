/**
 * Pillars
 *
 * Nebulae #2. After the Pillars of Creation (Eagle Nebula, M16).
 *
 * A shader in the family of Eye of God, built on one rule: photoevaporation.
 * Domain-warped gas fills the frame and is lit by young stars above it. For
 * every pixel the shader marches toward the light and adds up the optical
 * depth. Where light gets through, the gas is ionised and glows; where it is
 * shaded by a dense knot, the dust stays and swallows what is behind it. The
 * pillars are never drawn: they are what the shadows keep. The stars wander
 * on a slow circle, so the columns lean and reshape over the loop.
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
// Gas fills the frame and is lit by young stars above it. For every pixel
// the shader marches toward the light and adds up the optical depth. Where
// light gets through, the gas is ionised: it glows and thins out. Where it
// is shaded by denser gas, it stays dark and dusty. Nothing is drawn: the
// pillars are what the shadows keep.

// Gas density, as in Eye of God: two scales of domain-warped FBM
float gasField(vec2 p, vec2 c) {
  float d = warp(p * 1.6, c);
  d = mix(d, warp(p * 2.4 + vec2(10.0, 20.0), c * 0.8), 0.35);
  return d;
}

// Dense knots high up, and a bank of gas below
float knots(vec2 p) {
  return smoothstep(0.58, 0.72, fbm(p * vec2(4.0, 3.0) + 11.0))
       * smoothstep(0.35, 0.6, p.y) * smoothstep(1.45, 1.1, p.y);
}

float bank(vec2 p) {
  return (0.55 + 0.6 * fbm(p * 2.5 + 3.0)) * smoothstep(1.5, 0.2, p.y);
}

void main() {
  SO = vec2(fract(u_seed * 0.1373), fract(u_seed * 0.2917)) * 100.0;
  float aspect = u_res.x / u_res.y;
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * aspect * 1.5, uv.y * 1.5);          // y points up
  vec2 drift = 0.08 * vec2(cos(TAU * u_phase), sin(TAU * u_phase));

  // The ionising stars wander on a slow circle above the frame
  vec2 L = vec2(aspect * 0.75 + 0.5 * cos(TAU * u_phase), 3.0 + 0.3 * sin(TAU * u_phase));
  vec2 dir = normalize(L - p);

  float tau = 0.0;
  float jitter = hash21(vUv * u_res * 2.0);
  for (int i = 1; i < 48; i++) {
    vec2 q = p + dir * 0.022 * (float(i) + jitter);
    tau += knots(q) * 0.9 + bank(q) * 0.035;
  }
  float lit = exp(-tau * 1.2);

  float gas = gasField(p, drift);
  // what survives: the shaded bank, plus the knots that cast the shadows,
  // with a frayed, gassy edge
  float body = smoothstep(0.15, 0.75, bank(p) * (1.0 - lit) + knots(p) + 0.45 * (gas - 0.5));

  // Shaded gas keeps its dust; lit gas is ionised and thins out
  float dust = body * (0.6 + 0.8 * gas);
  float ionised = gas * (0.25 + 0.75 * lit);
  // the surface where light meets dense gas glows brightest
  float front = body * (1.0 - body) * 4.0 * exp(-max(tau - 0.2, 0.0) * 0.6) * gas;

  vec3 teal = vec3(0.05, 0.50, 0.62);
  vec3 amber = vec3(0.90, 0.48, 0.12);
  vec3 crimson = vec3(0.55, 0.06, 0.08);
  vec3 dustCol = vec3(0.30, 0.11, 0.05);

  vec3 emission = mix(amber, teal, smoothstep(0.2, 1.6, p.y + 0.4 * (gas - 0.5)));
  emission = mix(emission, crimson, smoothstep(0.55, 0.8, gas) * 0.4);
  vec3 color = emission * smoothstep(0.15, 0.85, ionised) * 0.9;
  

  // Dust absorbs what is behind it and shows only a faint reddish body
  float absorb = exp(-dust * 2.6);
  color *= absorb;
  // inside the dust: its own warped texture, lit more on the side facing the stars
  color += dustCol * body * (0.12 + 1.5 * gas * gas) * (0.35 + 0.9 * exp(-tau * 0.35));
  color += vec3(1.0, 0.68, 0.38) * front * 0.45;

  float stars = starfield(uv * vec2(1.0, 1.5));
  color += vec3(stars * 0.85, stars * 0.88, stars) * absorb * (1.0 - smoothstep(0.3, 0.9, ionised) * 0.7);

  float vignette = clamp(1.0 - length(uv - 0.5) * 0.4, 0.0, 1.0);
  color *= vignette;
  gl_FragColor = vec4(tone(color), 1.0);
}
`;

// ?seed=N pins a seed; anything missing or non-numeric draws a random one
function pickSeed() {
  const n = parseInt(new URLSearchParams(location.search).get('seed'), 10);
  return Number.isFinite(n) ? n : Math.floor(Math.random() * 1e6);
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
