/**
 * Shells
 *
 * Nebulae #4. After the Cat's Eye Nebula (NGC 6543).
 *
 * A shader built on periodic mass loss: the dying star throws off a shell
 * once every period. A shell is not drawn; it is a soft ripple in the gas
 * density that travels out from a precessing centre, swells unevenly and
 * thins as it ages, so the rings are a record of the rhythm. One loop is one
 * period: a shell is born at the centre as the oldest dissolves at the edge.
 * Inside, a bipolar core.
 *
 * Every visit draws a new seed; ?seed=N pins one (the GIF uses seed 3).
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new seed
 */

const WIDTH = 400;
const HEIGHT = 600;
const LOOP_SECONDS = 10;

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
// --- The rule: periodic mass loss ---
// The dying star throws off a shell once every period. Each shell does not
// get drawn: it is a ripple in the gas density, a soft compression that
// travels outward from a precessing centre, swells unevenly and thins as it
// ages. The rings are the record of the rhythm, read through domain-warped
// gas as in Eye of God. One loop is one period. Inside, a bipolar core.

void main() {
  SO = vec2(fract(u_seed * 0.1373), fract(u_seed * 0.2917)) * 100.0;
  float aspect = u_res.x / u_res.y;
  vec2 uv = vUv;
  vec2 st = uv - 0.5;
  st.x *= aspect;
  st *= 1.5;
  float r = length(st);
  vec2 drift = 0.08 * vec2(cos(TAU * u_phase), sin(TAU * u_phase));

  // Gas, as in Eye of God
  float gas = warp(st * 4.5 + 2.0, drift);
  gas = mix(gas, warp(st * 6.5 + vec2(10.0, 20.0), drift * 0.8), 0.35);

  // Domain-warp the radius itself so the ripples bend with the gas
  vec2 wq = st + 0.05 * (vec2(fbm(st * 5.0 + drift), fbm(st * 5.0 + 9.0 - drift)) - 0.5);

  float N = 8.0 + floor(hash(vec2(3.0)) * 5.0);
  float spacing = (0.50 + 0.18 * hash(vec2(6.0))) / N;
  float prec = 1.5 + hash(vec2(4.0)) * 2.0;
  float ripples = 0.0;

  for (int k = 0; k < 14; k++) {
    float fk = float(k);
    if (fk > N) break;
    float age = fk + u_phase;                 // shape depends on age only: seamless loop
    float life = age / N;
    vec2 off = 0.008 * age * vec2(cos(age * 0.9 * prec), sin(age * 0.9));
    vec2 q = wq - off;
    float rq = length(q);
    vec2 dq = q / max(rq, 1e-4);
    float R = age * spacing * (1.0 + 0.14 * (warp(dq * 1.3 + age * 0.3, vec2(0.0)) - 0.5));
    float w = 0.012 + 0.02 * life;
    float birth = smoothstep(0.0, 0.8, age);
    float death = 1.0 - smoothstep(0.7, 1.0, life);
    ripples += exp(-pow((rq - R) / w, 2.0)) * (1.0 - life * 0.6) * birth * death;
  }

  // The envelope the shells live in
  float env = exp(-pow(r / 0.42, 3.0));
  float density = gas * env * (0.35 + 0.9 * ripples);
  density = smoothstep(0.12, 0.75, density);

  // Bipolar core: two warped, elongated bubbles
  float th = hash(vec2(9.0)) * 3.14 + 0.06 * sin(TAU * u_phase);
  vec2 e = mat2(cos(th), -sin(th), sin(th), cos(th)) * st;
  float sa = 2.0 + hash(vec2(10.0)) * 1.0, tb = 0.5 + hash(vec2(12.0)) * 0.7;
  vec2 eb = mat2(cos(tb), -sin(tb), sin(tb), cos(tb)) * e;
  float coreGas = warp(st * 10.0 + 5.0, drift);
  float lobeA = exp(-pow((length(e * vec2(1.0, sa)) - 0.11) / 0.035, 2.0));
  float lobeB = exp(-pow((length(eb * vec2(sa * 0.8, 1.0)) - 0.09) / 0.03, 2.0));
  float core = (lobeA + lobeB) * smoothstep(0.3, 0.8, coreGas);
  float fog = exp(-r * r / 0.012) * (0.4 + 0.6 * coreGas);

  vec3 crimson = vec3(0.60, 0.04, 0.10);
  vec3 orange = vec3(0.90, 0.30, 0.05);
  vec3 teal = vec3(0.05, 0.62, 0.62);
  vec3 rose = vec3(0.95, 0.38, 0.42);
  vec3 hotBlue = vec3(0.30, 0.65, 1.0);

  vec3 shellCol = mix(crimson, orange, smoothstep(0.3, 0.8, ripples * gas));
  vec3 color = shellCol * density * 0.95;
  color += teal * fog * 0.75;
  color += rose * core * 0.9;
  color += hotBlue * exp(-r * r / 0.0003) * 1.2;

  float stars = starfield(uv * vec2(1.0, 1.5));
  color += vec3(stars * 0.85, stars * 0.88, stars) * (1.0 - smoothstep(0.05, 0.5, density + fog) * 0.9);

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
  if (key === 's' || key === 'S') saveCanvas('shells-' + seed, 'png');
  if (key === ' ') seed = Math.floor(Math.random() * 1e6);
}
