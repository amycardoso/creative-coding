/**
 * Filaments
 *
 * Nebulae #3. After the Crab Nebula (M1), the supernova of 1054.
 *
 * A shader built on the Rayleigh-Taylor instability: an expanding shell
 * pushes light gas against dense gas and the boundary breaks into fingers.
 * The gas is domain-warped noise sampled in coordinates stretched along the
 * rays, so its folds become fingers pointing outward, and the veins of the
 * field are the filaments, carried outward by the expansion. Inside, the
 * blue haze of the pulsar wind; at the centre the pulsar sends out wisps.
 *
 * Every visit draws a new seed; ?seed=N pins one (the GIF uses seed 3).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new seed
 */

const WIDTH = 400;
const HEIGHT = 600;
const LOOP_SECONDS = 12;

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
// --- The rule: Rayleigh-Taylor instability ---
// An expanding shell pushes light gas against dense gas and the boundary
// breaks into fingers. Here the gas is domain-warped FBM sampled in
// coordinates stretched along the rays, so the folds of the noise become
// fingers pointing outward; the veins of the field (where it crosses its
// mean) are the filaments. The expansion carries everything outward. Inside,
// the blue haze of the pulsar wind.

float veins(vec2 e, vec2 c, float s) {
  float r = length(e);
  vec2 dir = e / max(r, 1e-4);
  // homologous expansion: sample at a shrunken radius as time goes by
  float rr = r * (1.0 - 0.22 * s);
  vec2 radial = dir * (1.2 + 2.2 * rr) + vec2(rr * 0.6);   // stretched along rays
  float w = warp(radial * 2.2 + c, c);
  float v = 1.0 - abs(w * 2.0 - 1.0);                       // ridge where the field crosses its mean
  return pow(v, 6.0);
}

void main() {
  SO = vec2(fract(u_seed * 0.1373), fract(u_seed * 0.2917)) * 100.0;
  float aspect = u_res.x / u_res.y;
  vec2 uv = vUv;
  vec2 st = uv - 0.5;
  st.x *= aspect;
  st *= 1.35;
  vec2 drift = 0.08 * vec2(cos(TAU * u_phase), sin(TAU * u_phase));

  float th = hash(vec2(5.0)) * 3.14;
  vec2 e = mat2(cos(th), -sin(th), sin(th), cos(th)) * st;
  e.x *= 0.8;
  float r = length(e);
  vec2 dir = e / max(r, 1e-4);

  // Ragged, gassy envelope (no hard border)
  float edgeNoise = warp(dir * 1.5 + 3.0, drift * 0.5);
  float R = 0.26 + 0.18 * (edgeNoise - 0.4);
  float env = 1.0 - smoothstep(R * 0.55, R * 1.25, r);

  // Two copies of the veins half a period apart, cross-faded, so the
  // outward flow loops without a seam
  float a = fract(u_phase), b = fract(u_phase + 0.5);
  float va = veins(e, vec2(0.0), a);
  float vb = veins(e, vec2(3.1, 7.7), b);
  float fil = mix(va, vb, abs(a - 0.5) * 2.0);

  float gas = warp(e * 3.0 + 4.0, drift);
  float filaments = fil * env * (0.35 + 0.9 * gas) * smoothstep(0.03, 0.14, r);
  float body = gas * env;

  // Synchrotron haze of the pulsar wind
  float synch = exp(-r * r / (R * R * 0.45)) * (0.35 + 0.65 * warp(e * 4.0, drift));

  // Pulsar: a soft point with wisps that ripple out (integer frequency, loops)
  float wave = 0.5 + 0.5 * sin(TAU * (r * 14.0 - u_phase * 3.0));
  float wisps = exp(-r * r / 0.006) * wave * fbm(dir * 4.0 + e * 20.0);
  float pulsar = exp(-r * r / 0.00025);

  vec3 crimson = vec3(0.60, 0.05, 0.08);
  vec3 orange = vec3(0.92, 0.36, 0.06);
  vec3 straw = vec3(0.90, 0.75, 0.35);
  vec3 blue = vec3(0.18, 0.40, 1.0);

  vec3 filCol = mix(crimson, orange, smoothstep(0.3, 0.7, gas));
  filCol = mix(filCol, straw, smoothstep(0.6, 0.9, gas) * 0.6);

  vec3 color = blue * synch * 0.55;
  color += mix(crimson, orange, gas) * smoothstep(0.35, 0.9, body) * 0.18;
  color += filCol * filaments * 1.3;
  color += vec3(0.75, 0.85, 1.0) * (pulsar * 1.4 + wisps * 0.25);

  float stars = starfield(uv * vec2(1.0, 1.5));
  color += vec3(stars * 0.85, stars * 0.88, stars) * (1.0 - smoothstep(0.1, 0.6, body + synch) * 0.9);

  float vignette = clamp(1.0 - length(st) * 0.3, 0.0, 1.0);
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
  if (key === 's' || key === 'S') saveCanvas('filaments-' + seed, 'png');
  if (key === ' ') seed = Math.floor(Math.random() * 1e6);
}
