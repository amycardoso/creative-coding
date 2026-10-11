/**
 * Antropofagia
 *
 * "Tupi or not Tupi, that is the question." — Oswald de Andrade,
 * Manifesto Antropófago (1928).
 *
 * Brazilian modernism's founding idea: the culture does not imitate foreign
 * influence, it devours and digests it into something of its own. Here a cold
 * imported order — a Concrete-art grid of black lines and cool primary blocks
 * (Grupo Ruptura, Mondrian) — is eaten by swelling organic forms in Tarsila do
 * Amaral's warm caipira palette. The metaballs breathe: they engulf the grid
 * into sensual tropical colour, then recede to reveal the rigid order again, in
 * an endless seamless digestion. Where two devourers meet, their colours blend
 * — cannibalism as mixture.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE for a new composition
 */

const WIDTH = 800;
const HEIGHT = 800;
const LOOP_SECONDS = 16.0;

let prog;
let seedOffset = 0.0;

// Capture hook (inert during normal viewing) — see docs/CAPTURE.md.
let captureT = null;
function loopTime() {
  if (captureT !== null) return captureT;
  return (millis() / 1000.0) % LOOP_SECONDS / LOOP_SECONDS;
}

const vertShader = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  vec4 p = vec4(aPosition, 1.0);
  p.xy = p.xy * 2.0 - 1.0;
  gl_Position = p;
}
`;

const fragShader = `
precision highp float;

uniform float u_time;   // normalized loop time [0,1)
uniform float u_seed;
varying vec2 vUv;

#define TAU 6.2831853
#define N 5

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// The cold imported order: Concrete-art grid — black lines, mostly white with
// a few cool primary / black / grey blocks.
vec3 gridColor(vec2 uv) {
  float gn = 6.0;
  vec2 cell = floor(uv * gn);
  vec2 f = fract(uv * gn);
  float lw = 0.055;
  float line = clamp(step(f.x, lw) + step(1.0 - lw, f.x) +
                     step(f.y, lw) + step(1.0 - lw, f.y), 0.0, 1.0);

  float h = hash21(cell + 0.5 + u_seed * 3.1);
  vec3 white = vec3(0.957, 0.941, 0.910);
  vec3 col = white;
  if (h > 0.84)       col = vec3(0.231, 0.431, 0.647);  // cold blue
  else if (h > 0.70)  col = vec3(0.588, 0.204, 0.251);  // cold red
  else if (h > 0.62)  col = vec3(0.090, 0.090, 0.090);  // black block
  else if (h > 0.54)  col = vec3(0.580, 0.557, 0.518);  // grey
  return mix(col, vec3(0.05), line);
}

vec2 centerBase(int i) {
  if (i == 0) return vec2(0.30, 0.32);
  if (i == 1) return vec2(0.72, 0.27);
  if (i == 2) return vec2(0.50, 0.55);
  if (i == 3) return vec2(0.24, 0.72);
  return vec2(0.78, 0.70);
}
vec3 centerColor(int i) {
  if (i == 0) return vec3(0.102, 0.561, 0.769);  // Tarsila blue
  if (i == 1) return vec3(0.910, 0.365, 0.608);  // rose
  if (i == 2) return vec3(0.949, 0.757, 0.306);  // yellow
  if (i == 3) return vec3(0.227, 0.616, 0.431);  // green
  return vec3(0.757, 0.275, 0.184);              // terra
}

void main() {
  vec2 uv = vUv;
  float t = u_time;
  float gb = 0.5 + 0.5 * sin(TAU * t);  // global breath (0 exhale .. 1 inhale)

  float field = 0.0, wsum = 0.0;
  vec3 ocol = vec3(0.0);
  vec2 grad = vec2(0.0);
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    vec2 c = centerBase(i)
           + 0.05 * vec2(sin(TAU * t + fi * 1.7 + u_seed),
                         cos(TAU * t + fi * 1.1 + u_seed));
    float wob = 0.6 + 0.4 * sin(TAU * t + fi * 1.25);
    float r = (0.20 + 0.06 * hash21(vec2(fi, u_seed))) * gb * wob;
    vec2 d = uv - c;
    float dist2 = dot(d, d) + 0.0009;
    float w = r * r / dist2;
    field += w;
    ocol += centerColor(i) * w;
    wsum += w;
    grad += d * w / dist2;
  }
  ocol /= max(wsum, 1e-4);

  float m = smoothstep(0.85, 1.7, field);  // digestion mask

  // Warp the grid outward as the blobs swell — the order deforms as it is eaten.
  vec2 disp = (length(grad) > 1e-4 ? normalize(grad) : vec2(0.0)) * m * 0.045;
  vec3 base = gridColor(uv + disp);

  // Organic body: bold Tarsila outline at the boundary, soft volume in the core.
  float vol = smoothstep(1.2, 5.0, field);
  vec3 organic = mix(ocol, ocol + vec3(0.10), vol * 0.55);
  vec3 col = mix(base, organic, m);

  float outline = smoothstep(0.18, 0.42, m) * (1.0 - smoothstep(0.42, 0.66, m));
  col = mix(col, vec3(0.16, 0.09, 0.07), outline * 0.85);

  // Static gouache grain.
  col += hash21(uv * 1400.0 + 7.0) * 0.05 - 0.025;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function setup() {
  const cnv = createCanvas(WIDTH, HEIGHT, WEBGL);
  cnv.parent('canvas-container');
  noStroke();
  prog = createShader(vertShader, fragShader);
  shader(prog);

  const p = new URLSearchParams(window.location.search);
  if (p.has('seed')) seedOffset = (parseInt(p.get('seed'), 10) || 0) * 1.37;
  window.__captureFrame = (i, n) => { captureT = (((i % n) + n) % n) / n; redraw(); };
  if (p.has('f') && p.has('n')) {
    noLoop();
    window.__captureFrame(parseInt(p.get('f'), 10), Math.max(1, parseInt(p.get('n'), 10)));
  }
}

function draw() {
  prog.setUniform('u_time', loopTime());
  prog.setUniform('u_seed', seedOffset);
  rect(-width / 2, -height / 2, width, height);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('antropofagia', 'png');
  } else if (key === ' ') {
    seedOffset += 13.37;
    if (captureT !== null) redraw();
  }
}
