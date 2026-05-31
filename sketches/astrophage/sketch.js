/**
 * Astrophage
 *
 * Diagonal rain of relativistic light inspired by Project Hail Mary —
 * long motion-blurred streaks drift across the frame through a prismatic
 * spectrum (molten gold -> magenta -> violet -> blue-green), shot through
 * with glittering specular sparkles over deep black. Rendered entirely in a
 * GLSL shader; streaks scroll on a seamless loop.
 *
 * Controls:
 * - Press S to save a PNG
 * - Press SPACE to nudge the composition seed
 */

const WIDTH = 800;
const HEIGHT = 800;
const LOOP_SECONDS = 24.0;

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

uniform float u_time;       // normalized loop time in [0, 1)
uniform vec2 u_resolution;
uniform float u_seed;

varying vec2 vUv;

#define TAU 6.2831853

// Periodic value noise: lattice wraps on PERIOD so scrolling by whole
// periods is seamless (key to a loopable rain of streaks).
float phash(vec2 p, float period) {
  p = mod(p, period);
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float pnoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = phash(i, period);
  float b = phash(i + vec2(1.0, 0.0), period);
  float c = phash(i + vec2(0.0, 1.0), period);
  float d = phash(i + vec2(1.0, 1.0), period);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Prismatic spectrum: molten gold -> orange -> magenta -> violet -> blue -> teal.
vec3 spectrum(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 gold    = vec3(1.00, 0.62, 0.12);
  vec3 orange  = vec3(0.98, 0.34, 0.10);
  vec3 magenta = vec3(0.85, 0.12, 0.45);
  vec3 violet  = vec3(0.42, 0.18, 0.72);
  vec3 blue    = vec3(0.16, 0.34, 0.88);
  vec3 teal    = vec3(0.12, 0.78, 0.62);
  vec3 c = mix(gold, orange, smoothstep(0.0, 0.2, t));
  c = mix(c, magenta, smoothstep(0.2, 0.42, t));
  c = mix(c, violet, smoothstep(0.42, 0.6, t));
  c = mix(c, blue, smoothstep(0.6, 0.8, t));
  c = mix(c, teal, smoothstep(0.8, 1.0, t));
  return c;
}

void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= u_resolution.x / u_resolution.y;

  // Diagonal streak basis (~60 deg): 'along' runs down the streaks, 'across'
  // separates the lanes.
  vec2 dir = normalize(vec2(0.5, 0.866));
  vec2 perp = vec2(-dir.y, dir.x);
  float along = dot(uv, dir);
  float across = dot(uv, perp);

  float period = 24.0;
  float seed = u_seed;
  float scroll = u_time;   // advance by whole periods over the loop => seamless

  // Dense, even field of long parallel streaks. Each layer is a set of lanes;
  // each lane has its own width and a long, drifting brightness along its
  // length so rays stay continuous as they rain. Layers differ in scale/speed
  // for parallax. A soft glow term keeps the whole field luminous.
  float streak = 0.0;
  float glow = 0.0;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float laneFreq = 45.0 + fk * 30.0;          // many fine lanes
    float speed = (4.0 + fk * 3.0);             // whole numbers => loops
    float w = 1.0 - fk * 0.12;

    float lanePos = across * laneFreq + seed * 7.0 + fk * 17.0;
    float laneId = floor(lanePos);
    float laneFrac = fract(lanePos);

    // Per-lane random width => some rays thick, some hair-thin (not corduroy).
    float wid = mix(0.12, 0.5, phash(vec2(laneId, fk + 3.0), period));
    float d = abs(laneFrac - 0.5);
    float core = smoothstep(wid, 0.0, d);       // sharp bright core
    float halo = smoothstep(0.5, 0.0, d);       // soft glow around it

    // Long, drifting brightness that genuinely falls to zero, so streaks fade
    // in and out and clusters of light emerge from black (not a full field).
    float bright = pnoise(vec2(laneId * 0.31,
                               along * 1.2 - scroll * speed), period);
    bright = pow(smoothstep(0.42, 1.0, bright), 1.6);

    streak += core * bright * w;
    glow += halo * bright * w * 0.12;
  }

  // Glittering specular sparkles riding along the streaks.
  float sp = pnoise(vec2(across * 130.0 + seed, along * 55.0 - scroll * 9.0), period);
  float sparkle = pow(smoothstep(0.82, 1.0, sp), 4.0) * 2.6 * smoothstep(0.05, 0.4, streak + glow);

  // Prismatic band runs corner-to-corner, drifting slowly.
  float band = across * 0.85 + 0.5 + 0.06 * sin(u_time * TAU);
  vec3 col = spectrum(band);

  // Luminous emission: bright cores + faint halo glow, color from the spectrum.
  float intensity = streak * 3.2 + glow * 1.4;
  col *= intensity;
  col += sparkle * vec3(1.0, 0.97, 0.9);      // white-hot sparkle cores

  // Gentle highlight rolloff only (no shadow lift) -> deep saturated blacks.
  col = col / (col + 0.85);
  col = pow(col, vec3(0.9));

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
  const loopT = (millis() / 1000.0 % LOOP_SECONDS) / LOOP_SECONDS;
  skyShader.setUniform('u_resolution', [width, height]);
  skyShader.setUniform('u_time', loopT);
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
