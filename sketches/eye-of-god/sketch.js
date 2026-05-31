/**
 * Eye of God
 *
 * A procedural nebula rendered in GLSL — domain-warped FBM noise
 * sculpts gas clouds around a ring nebula core, painted in warm reds
 * through cool cyans against a dense starfield.
 *
 * Controls:
 * - Press S to save PNG
 */

const WIDTH = 400;
const HEIGHT = 600;

let nebulaShader;

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

uniform float u_time;
uniform vec2 u_resolution;

varying vec2 vUv;

// --- Noise foundation ---

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
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

// --- Domain-warped FBM ---

float warpedFBM(vec2 p, float t) {
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + t * 0.03),
    fbm(p + vec2(5.2, 1.3) + t * 0.02)
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.015),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.012)
  );

  return fbm(p + 4.0 * r);
}

// --- Ring nebula structure ---

float ringNebula(vec2 uv, float t) {
  vec2 center = uv - vec2(0.5);

  // Slight elliptical tilt (~15 degrees)
  float tiltAngle = 0.26;
  float cs = cos(tiltAngle), sn = sin(tiltAngle);
  vec2 tilted = vec2(cs * center.x - sn * center.y, sn * center.x + cs * center.y);
  tilted.x *= 1.15; // stretch horizontally → elliptical ring

  float dist = length(tilted);
  float angle = atan(tilted.y, tilted.x);

  // Angular noise breaks perfect symmetry
  float angularNoise = fbm(vec2(angle * 2.0, dist * 8.0) + t * 0.01);

  // Gaussian ring
  float ringRadius = 0.18 + angularNoise * 0.03;
  float ringWidth = 0.08;
  float ring = exp(-pow((dist - ringRadius) / ringWidth, 2.0));

  // Inner blue glow (center hotspot)
  float innerGlow = exp(-dist * dist / 0.006);

  // Outer diffuse halo
  float halo = exp(-pow((dist - 0.28) / 0.15, 2.0)) * 0.4;

  return ring + innerGlow * 0.6 + halo;
}

// --- Starfield ---

float starLayer(vec2 uv, float gridSize, float density, float t) {
  float stars = 0.0;
  vec2 gv = fract(uv * gridSize) - 0.5;
  vec2 id = floor(uv * gridSize);

  float h = hash21(id);

  if (h < density) {
    // Star position jittered within cell
    vec2 offset = vec2(hash21(id + 100.0), hash21(id + 200.0)) - 0.5;
    float d = length(gv - offset * 0.7);

    // Brightness with twinkle
    float brightness = smoothstep(0.04, 0.0, d);
    float twinkle = 0.7 + 0.3 * sin(t * (1.0 + h * 3.0) + h * 6.28);
    stars = brightness * twinkle * (0.5 + h * 0.5);
  }

  return stars;
}

void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;

  // Aspect-correct: map to square centered coordinates
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = uv - vec2(0.5);
  st.x *= aspect;  // now st is centered, aspect-corrected

  float t = u_time;

  // Zoom — nebula fills ~65% of frame
  vec2 nebulaUV = st * 1.5 + vec2(0.5);
  float dist = length(st) * 1.5;

  // --- Nebula density ---
  vec2 np = nebulaUV * 3.0;
  float nebulaDensity = warpedFBM(np, t);

  // Second layer at different scale for detail
  float detailDensity = warpedFBM(np * 1.5 + vec2(10.0, 20.0), t * 0.8);
  nebulaDensity = mix(nebulaDensity, detailDensity, 0.35);

  // Ring nebula contribution
  float ring = ringNebula(nebulaUV, t);
  float combinedDensity = nebulaDensity * 0.7 + ring * 0.5;

  // Irregular, asymmetric edge — extends upper-right, compact lower-left
  float angle = atan(st.y, st.x);
  float edgeNoise = fbm(vec2(angle * 2.5, dist * 4.0) + t * 0.008);
  // Directional bias: upper-right (+x, -y) extends further
  float dirBias = 0.06 * (st.x * 0.8 - st.y * 0.6) / (dist + 0.01);
  float edgeRadius = 0.40 + edgeNoise * 0.18 - 0.08 + dirBias;
  float edgeFade = 1.0 - smoothstep(edgeRadius, edgeRadius + 0.20, dist);
  combinedDensity *= edgeFade;

  // Remap density with contrast
  combinedDensity = smoothstep(0.25, 0.85, combinedDensity);

  // Warm colors: crimson → orange → amber
  vec3 crimson = vec3(0.60, 0.03, 0.10);
  vec3 orange = vec3(0.90, 0.30, 0.04);
  vec3 amber = vec3(0.85, 0.50, 0.08);

  // Center colors
  vec3 hotBlue = vec3(0.15, 0.45, 1.0);
  vec3 teal = vec3(0.05, 0.55, 0.70);

  // Helix Nebula color zones: blue center → teal → amber ring → orange → crimson
  float ringMask = ringNebula(nebulaUV, t);

  // Radial color mapping
  vec3 nebulaColor;

  // Base: orange across the nebula, modulated by density
  nebulaColor = mix(crimson, orange, smoothstep(0.3, 0.6, nebulaDensity));

  // Amber/gold in bright ring areas
  float ringZone = smoothstep(0.3, 0.7, ringMask);
  nebulaColor = mix(nebulaColor, amber, ringZone * 0.5);

  // Strong crimson outer halo
  float outerHalo = smoothstep(0.18, 0.38, dist);
  nebulaColor = mix(nebulaColor, crimson, outerHalo * 0.55);

  // Teal transition between blue center and warm ring
  float tealBand = smoothstep(0.05, 0.11, dist) * smoothstep(0.18, 0.12, dist);
  nebulaColor = mix(nebulaColor, teal, tealBand * 0.75);

  // Center blue — clear, vivid
  float centerMask = exp(-dist * dist / 0.010);
  nebulaColor = mix(nebulaColor, hotBlue, centerMask * 0.85);

  // --- Apply brightness from density ---
  vec3 color = nebulaColor * combinedDensity;

  // Emission glow in dense regions
  float emission = smoothstep(0.5, 1.0, combinedDensity);
  color += nebulaColor * emission * 0.2;

  // --- Starfield (use raw uv for even distribution) ---
  float nebulaOpacity = smoothstep(0.05, 0.4, combinedDensity);

  float stars = 0.0;
  stars += starLayer(uv, 150.0, 0.04, t) * 0.25;
  stars += starLayer(uv, 80.0, 0.05, t) * 0.5;
  stars += starLayer(uv, 35.0, 0.06, t) * 0.8;
  stars += starLayer(uv, 15.0, 0.08, t) * 1.0;

  // Dim stars behind thick nebula gas, let them show in center + outer black
  float centerClear = exp(-dist * dist / 0.018);
  float starMask = mix(1.0 - nebulaOpacity * 0.95, 1.0, centerClear * 0.5);
  stars *= starMask;
  color += vec3(stars * 0.85, stars * 0.88, stars);

  // --- Subtle vignette ---
  float vignette = 1.0 - length(st) * 0.3;
  vignette = clamp(vignette, 0.0, 1.0);
  color *= vignette;

  // --- Tone mapping (prevent blowout, keep saturation) ---
  color = color / (color + vec3(0.45));
  color *= 1.35;

  // --- Gamma correction ---
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');

  nebulaShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(nebulaShader);
  nebulaShader.setUniform('u_time', millis() / 1000.0);
  nebulaShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('eye-of-god', 'png');
  }
  if (key === 'g' || key === 'G') {
    saveGif('eye-of-god', 10);
  }
}
