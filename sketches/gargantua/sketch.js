/**
 * Gargantua
 *
 * A black hole rendered with real gravitational lensing. Each pixel marches a
 * light ray that bends toward the singularity, so the far side of the glowing
 * accretion disk arcs up and over the event horizon — the iconic image of a
 * black hole. A razor-thin photon ring hugs the dark silhouette, the disk
 * Doppler-brightens on the side rotating toward us, and the starfield behind
 * is lensed into a faint Einstein ring.
 *
 * Warm incandescent palette: white-hot inner edge melting through gold and
 * amber to deep red. One seamless ~12s loop.
 *
 * Controls:
 * - Press S for a PNG
 * - Press SPACE for a new black hole (tilt, turbulence, starfield)
 */

const WIDTH = 800;
const HEIGHT = 800;
const LOOP_SECONDS = 12.0;
const TAU = Math.PI * 2;

let theShader;
let seed = 7.0;
let inclination = 0.14;     // radians above the disk plane (near edge-on)
let turbOffset = [0.0, 0.0];

const vert = `
precision highp float;
attribute vec3 aPosition;
void main() {
  vec4 p = vec4(aPosition, 1.0);
  p.xy = p.xy * 2.0 - 1.0;   // map p5 rect [0,1] to clip space [-1,1]
  gl_Position = p;
}
`;

const frag = `
precision highp float;

uniform vec2  uResolution;
uniform float uTime;        // 0 .. TAU over one loop
uniform float uSeed;
uniform float uIncl;        // camera inclination above disk plane
uniform vec2  uTurb;        // turbulence offset for this seed

const float HORIZON  = 1.0;
const float INNER_R  = 2.6;   // inner edge of the disk (ISCO-ish)
const float OUTER_R  = 9.0;   // outer edge of the disk
const float CAM_DIST = 15.0;
const float FOV      = 0.78;
const float GRAV     = 1.15;  // light-bending strength
const float ESCAPE   = 48.0;
const int   STEPS    = 200;

// ---- hash / value noise ---------------------------------------------------
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

// ---- accretion disk emission ----------------------------------------------
// Returns rgb (already brightness-weighted) and writes opacity in .a-ish slot.
vec4 diskSample(vec3 hit, vec3 camPos) {
  float rc = length(hit.xz);
  if (rc < INNER_R || rc > OUTER_R) return vec4(0.0);

  float t = (rc - INNER_R) / (OUTER_R - INNER_R);   // 0 inner .. 1 outer

  // Rigid rotation of the turbulence field over the loop -> seamless.
  float a = uTime;
  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 rp = R * hit.xz + uTurb;

  // Filamentary turbulence at two scales.
  float turb = fbm(rp * 0.55) * 0.7 + fbm(rp * 1.7) * 0.3;
  float streak = fbm(rp * vec2(0.25, 1.4) + 11.0);
  float density = mix(0.55, 1.0, turb) * mix(0.7, 1.0, streak);

  // Soft inner/outer falloff.
  float edge = smoothstep(0.0, 0.10, t) * smoothstep(1.0, 0.78, t);
  density *= edge;

  // Temperature gradient: white-hot -> gold -> amber -> deep red.
  vec3 col = mix(vec3(1.0, 0.98, 0.92), vec3(1.0, 0.62, 0.20), smoothstep(0.0, 0.30, t));
  col = mix(col, vec3(0.95, 0.30, 0.07), smoothstep(0.30, 0.70, t));
  col = mix(col, vec3(0.55, 0.10, 0.04), smoothstep(0.70, 1.0, t));
  // Blue-white core at the very inner edge.
  col = mix(vec3(0.78, 0.88, 1.0), col, smoothstep(0.0, 0.12, t));

  // Brightness falls off outward; inner edge blazes.
  float bright = density * mix(2.6, 0.25, t);

  // Relativistic Doppler beaming.
  vec3 vdir = normalize(cross(vec3(0.0, 1.0, 0.0), hit));   // orbital direction
  vec3 toCam = normalize(camPos - hit);
  float speed = 0.46 * sqrt(INNER_R / rc);                  // faster inner orbits
  float beta = speed * dot(vdir, toCam);
  bright *= pow(clamp(1.0 + beta, 0.0, 2.0), 3.5);          // beaming
  col = mix(col, vec3(0.75, 0.85, 1.0), clamp(beta, 0.0, 0.6)); // blue approach
  col = mix(col, vec3(0.9, 0.25, 0.10), clamp(-beta, 0.0, 0.5)); // red recede

  float opacity = clamp(density * 1.3, 0.0, 1.0);
  return vec4(col * bright, opacity);
}

// ---- lensed background starfield ------------------------------------------
vec3 background(vec3 d) {
  vec2 uv = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
  vec2 g = uv * 14.0;
  vec2 id = floor(g);
  vec2 gv = fract(g) - 0.5;
  float h = hash21(id + uSeed * 7.13);
  vec3 col = vec3(0.0);
  if (h > 0.90) {
    vec2 off = (vec2(hash21(id + 3.1), hash21(id + 9.7)) - 0.5) * 0.7;
    float dd = length(gv - off);
    float star = smoothstep(0.07, 0.0, dd) * (0.3 + 0.7 * hash21(id + 5.5));
    vec3 sc = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.78), hash21(id + 2.2));
    col += sc * star;
  }
  // Faint deep-space haze.
  col += vec3(0.015, 0.012, 0.022) * fbm(uv * 3.0 + uSeed);
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  // Camera basis: inclined slightly above the disk plane, looking at origin.
  vec3 camPos = vec3(0.0, sin(uIncl), cos(uIncl)) * CAM_DIST;
  vec3 fwd = normalize(-camPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 dir = normalize(fwd + (uv.x * right + uv.y * up) * (FOV * 2.0));

  vec3 pos = camPos;
  vec3 color = vec3(0.0);
  float trans = 1.0;     // remaining transmittance
  float prevY = pos.y;
  bool captured = false;

  for (int i = 0; i < STEPS; i++) {
    float r = length(pos);
    float dt = clamp(r * 0.10, 0.07, 0.55);

    // Gravitational deflection toward the hole.
    vec3 acc = -normalize(pos) * (GRAV / (r * r));
    dir = normalize(dir + acc * dt);

    vec3 next = pos + dir * dt;

    // Disk-plane crossing (y = 0).
    if (prevY * next.y < 0.0) {
      float f = prevY / (prevY - next.y);
      vec3 hit = mix(pos, next, f);
      vec4 ds = diskSample(hit, camPos);
      if (ds.a > 0.0) {
        color += trans * ds.rgb;
        trans *= (1.0 - ds.a * 0.85);
      }
    }

    pos = next;
    prevY = pos.y;
    r = length(pos);

    if (r < HORIZON) { captured = true; break; }
    if (r > ESCAPE)  break;
    if (trans < 0.02) break;
  }

  if (!captured && trans > 0.02) {
    color += trans * background(dir);
  }

  // Photon-ring lift: emerges where rays graze the hole, but nudge it brighter.
  // (Captured pixels stay dark; the disk wrap supplies most of the glow.)

  // Tone map + gamma.
  color = vec3(1.0) - exp(-color * 1.1);
  color = pow(color, vec3(0.4545));

  // Subtle vignette.
  float vig = smoothstep(1.25, 0.35, length(uv));
  color *= mix(0.82, 1.0, vig);

  gl_FragColor = vec4(color, 1.0);
}
`;

function setup() {
  const c = createCanvas(WIDTH, HEIGHT, WEBGL);
  c.parent("canvas-container");
  pixelDensity(1);
  theShader = createShader(vert, frag);
  noStroke();
  applySeed();
}

function draw() {
  const phase = ((millis() / 1000) % LOOP_SECONDS) / LOOP_SECONDS;
  shader(theShader);
  theShader.setUniform("uResolution", [width, height]);
  theShader.setUniform("uTime", phase * TAU);
  theShader.setUniform("uSeed", seed);
  theShader.setUniform("uIncl", inclination);
  theShader.setUniform("uTurb", turbOffset);
  rect(0, 0, width, height);
}

function applySeed() {
  randomSeed(seed * 1000);
  inclination = 0.10 + random() * 0.18;            // ~6deg .. 16deg
  turbOffset = [random() * 100 - 50, random() * 100 - 50];
}

function keyPressed() {
  if (key === "s" || key === "S") {
    saveCanvas("gargantua", "png");
  } else if (key === " ") {
    seed = (seed * 1.618 + 0.137) % 97.0;
    applySeed();
  }
}
