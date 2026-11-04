/**
 * Shells
 *
 * Nebulae #3. After the Cat's Eye Nebula (NGC 6543).
 *
 * A shader built on periodic mass loss: the dying star throws off a shell
 * once every period, and each one drifts out from a precessing centre,
 * swells unevenly and fades as it thins. The rings are a record of the
 * rhythm. One loop is one period: a shell is born at the centre as the
 * oldest dissolves at the edge. Inside, two bipolar lobes.
 *
 * Every visit draws a new seed; ?seed=N pins one (the GIF uses seed 1).
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
// The dying star throws off a shell once every period. Each shell drifts
// outward from a centre that precesses with age, swells unevenly and fades
// as it thins, so the concentric rings are a record of the rhythm. One
// loop of the animation is one period: a new shell is born at the centre
// as the oldest one dissolves at the edge. Inside, two bipolar lobes.

void main() {
  SO = vec2(fract(u_seed * 0.1373), fract(u_seed * 0.2917)) * 100.0;
  float aspect = u_res.x / u_res.y;
  vec2 uv = vUv;
  vec2 st = uv - 0.5;
  st.x *= aspect;
  st *= 1.6;
  float r = length(st);
  vec2 drift = 0.1 * vec2(cos(TAU * u_phase), sin(TAU * u_phase));

  float N = 9.0 + floor(hash(vec2(3.0)) * 6.0);   // shells on screen
  float spacing = (0.52 + 0.22 * hash(vec2(6.0))) / N;
  float prec = 1.5 + hash(vec2(4.0)) * 2.0;        // precession rate
  float shells = 0.0;

  for (int k = 0; k < 16; k++) {
    float fk = float(k);
    if (fk > N) break;
    // age in periods; the shape depends on age only, so the loop is seamless
    float age = fk + u_phase;
    float life = age / N;
    vec2 off = 0.006 * age * vec2(cos(age * 0.9 * prec), sin(age * 0.9));
    vec2 q = st - off;
    float rq = length(q);
    vec2 dq = q / max(rq, 1e-4);
    float R = age * spacing * (1.0 + 0.10 * (fbm(dq * 1.2 + age * 0.35) - 0.5));
    float w = 0.004 + 0.010 * life;
    float broken = smoothstep(0.35, 0.75, fbm(dq * 2.0 + q * 5.0 + age * 0.3));
    float birth = smoothstep(0.0, 0.6, age);       // fades in at the centre
    float death = 1.0 - smoothstep(0.75, 1.0, life);
    shells += exp(-pow((rq - R) / w, 2.0)) * broken * 1.3 * (1.0 - life * 0.7) * birth * death;
  }

  // Bipolar core: two rotated ellipses threaded with ridged filaments
  float th = hash(vec2(9.0)) * 3.14 + 0.08 * sin(TAU * u_phase);
  vec2 e = mat2(cos(th), -sin(th), sin(th), cos(th)) * st;
  float sa = 1.8 + hash(vec2(10.0)) * 1.2, sb = 1.6 + hash(vec2(11.0)) * 0.9, tb = 0.4 + hash(vec2(12.0)) * 0.8;
  float lobeA = length(e * vec2(1.0, sa));
  float lobeB = length((mat2(cos(tb), -sin(tb), sin(tb), cos(tb)) * e) * vec2(sb, 1.0));
  float fil = ridge(st * 9.0 + drift);
  float core = exp(-pow((lobeA - 0.13) / 0.02, 2.0)) * fil
             + exp(-pow((lobeB - 0.10) / 0.018, 2.0)) * fil;

  float fog = exp(-r * r / 0.02) * warp(st * 5.0, drift);
  float halo = exp(-r * r / 0.12) * warp(st * 3.0 + 4.0, drift) * 0.5;

  vec3 color = vec3(0.75, 0.18, 0.10) * shells * 0.8 + vec3(0.6, 0.12, 0.12) * halo * 0.6;
  color += vec3(0.10, 0.75, 0.65) * fog * 1.1 + vec3(0.95, 0.35, 0.45) * core * 1.1;
  color += vec3(0.7, 0.85, 1.0) * exp(-r * r / 0.00015) * 2.0;
  color += vec3(starfield(uv * vec2(1.0, 1.5))) * 0.7 * (1.0 - smoothstep(0.0, 0.4, shells + fog));

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
  if (key === 's' || key === 'S') saveCanvas('shells-' + seed, 'png');
  if (key === ' ') seed = Math.floor(Math.random() * 1e6);
}
