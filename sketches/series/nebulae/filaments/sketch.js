/**
 * Filaments
 *
 * Nebulae #2. After the Crab Nebula (M1), the supernova of 1054.
 *
 * A shader built on the Rayleigh-Taylor instability: an expanding shell
 * pushes light gas against dense gas and the boundary breaks into fingers
 * and a web of filaments, carried outward by the expansion. Inside, the blue
 * haze of the pulsar wind; at the centre the pulsar sends out wisps.
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
// An expanding shell pushes light gas against dense gas, and the boundary
// breaks into fingers and a web of filaments. Here the fingers are ridged
// noise stretched along the rays, carried outward by the expansion. Inside,
// the blue haze of the pulsar wind; at the centre, the pulsar itself sends
// out wisps.

// Outward expansion: two copies of the field half a period apart, cross-faded.
float fingers(vec2 e, vec2 dir, float r, vec2 wv, float wa) {
  float a = fract(u_phase), b = fract(u_phase + 0.5);
  vec2 sa = e * (1.0 - 0.18 * a), sb = e * (1.0 - 0.18 * b);  // homologous expansion
  float ra = ridge(dir * (9.0 + 3.0 * wa) + vec2(length(sa) * 1.5, 0.0) + wv * 1.5);
  float rb = ridge(dir * (9.0 + 3.0 * wa) + vec2(length(sb) * 1.5, 3.0) + wv * 1.5);
  float web_a = ridge(sa * 5.0 + wv * 2.5);
  float web_b = ridge(sb * 5.0 + wv * 2.5 + 9.0);
  float k = abs(a - 0.5) * 2.0;
  return mix(mix(ra, web_a, 0.7), mix(rb, web_b, 0.7), k);
}

void main() {
  SO = vec2(fract(u_seed * 0.1373), fract(u_seed * 0.2917)) * 100.0;
  float aspect = u_res.x / u_res.y;
  vec2 uv = vUv;
  vec2 st = uv - 0.5;
  st.x *= aspect;
  st *= 1.3;
  vec2 drift = 0.1 * vec2(cos(TAU * u_phase), sin(TAU * u_phase));

  // Random tilt and squash of the remnant
  float th = hash(vec2(5.0)) * 3.14;
  vec2 e = mat2(cos(th), -sin(th), sin(th), cos(th)) * st;
  e.x *= 0.78;
  float r = length(e);
  float a = atan(e.y, e.x);
  vec2 dir = vec2(cos(a), sin(a));

  // Ragged outer boundary that breathes a little
  float R = 0.30 + 0.16 * (fbm(dir * 1.4 + 2.0 + drift) - 0.5) + 0.006 * sin(TAU * u_phase);
  float inside = 1.0 - smoothstep(R - 0.02, R + 0.05, r);

  vec2 wv = vec2(fbm(e * 3.0 + drift), fbm(e * 3.0 + 5.0 - drift)) - 0.5;
  float wa = fbm(dir * 3.0 + r * 2.0);
  float f = pow(fingers(e, dir, r, wv, wa), 5.0) * 3.2;
  float shellBand = smoothstep(0.25 * R, R * 0.85, r);
  float fil = f * inside * shellBand * (0.4 + fbm(e * 12.0));

  // Synchrotron haze from the pulsar wind
  float synch = exp(-r * r / (R * R * 0.35)) * warp(e * 4.0, drift) * inside;

  // Pulsar: a point plus wisps that ripple outward once per loop
  float wave = fract(r * 18.0 - u_phase * 3.0);
  float wisps = exp(-r * r / 0.004) * smoothstep(0.0, 0.2, wave) * smoothstep(0.5, 0.2, wave)
              * fbm(dir * 6.0 + drift);
  float pulsar = exp(-r * r / 0.0002) + 0.35 * wisps;

  vec3 color = vec3(0.25, 0.45, 1.0) * synch * 0.9;
  color += mix(vec3(0.95, 0.30, 0.08), vec3(0.95, 0.85, 0.35), fbm(e * 6.0 + 3.0)) * fil * 0.9;
  color += vec3(0.85, 0.9, 1.0) * pulsar * 1.5;
  color += vec3(starfield(uv * vec2(1.0, 1.5))) * 0.75 * (1.0 - inside * 0.8);

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
  if (key === 's' || key === 'S') saveCanvas('filaments-' + seed, 'png');
  if (key === ' ') seed = Math.floor(Math.random() * 1e6);
}
