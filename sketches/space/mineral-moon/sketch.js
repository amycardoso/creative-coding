const WIDTH = 800;
const HEIGHT = 800;

let moonShader;

P5Capture.setDefaultOptions({
  format: 'webm',
  framerate: 60,
  quality: 1.0,
  width: 800,
});

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

/* ── proper 3D noise (no streak artifacts) ── */

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm3(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * (snoise(p) * 0.5 + 0.5);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

/* ── procedural craters ── */

float crater(vec3 p, float scale) {
  // tile space and create circular depressions
  vec3 q = p * scale;
  vec3 cell = floor(q);
  vec3 f = fract(q) - 0.5;

  // hash for random offset and size per cell
  float h = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float h2 = fract(sin(dot(cell, vec3(269.5, 183.3, 246.1))) * 43758.5453);

  // skip some cells (not every cell has a crater)
  if (h > 0.6) return 0.0;

  // random offset within cell
  vec2 offset = vec2(h - 0.3, h2 - 0.3) * 0.3;
  float dist = length(f.xy - offset);

  // crater shape: rim + depression
  float radius = 0.15 + h * 0.2;
  float rimRise = smoothstep(radius, radius * 0.85, dist) * smoothstep(radius * 0.6, radius * 0.85, dist);
  float depression = smoothstep(radius * 0.7, 0.0, dist);

  return rimRise * 0.12 - depression * 0.06;
}

/* ── 2D hash for starfield ── */

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/* ── ray-sphere intersection ── */

float sphereIntersect(vec3 ro, vec3 rd, vec3 center, float radius) {
  vec3 oc = ro - center;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - radius * radius;
  float disc = b * b - c;
  if (disc < 0.0) return -1.0;
  return -b - sqrt(disc);
}

/* ── micro-craters for surface texture ── */

float microCrater(vec3 p, float scale) {
  vec3 q = p * scale;
  vec3 cell = floor(q);
  vec3 f = fract(q) - 0.5;
  float h = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float h2 = fract(sin(dot(cell, vec3(269.5, 183.3, 246.1))) * 43758.5453);
  if (h > 0.45) return 0.0;
  vec2 offset = vec2(h - 0.22, h2 - 0.22) * 0.25;
  float dist = length(f.xy - offset);
  float radius = 0.06 + h * 0.12;
  float rim = smoothstep(radius, radius * 0.75, dist) * smoothstep(radius * 0.5, radius * 0.75, dist);
  float dep = smoothstep(radius * 0.6, 0.0, dist);
  return rim * 0.04 - dep * 0.025;
}

/* ── mineral color: saturation-boost approach (photographic, not painted) ── */

vec3 mineralColor(float titanium, float iron, float olivine, float maria,
                   float detail, float extra, vec3 sp) {
  // photorealistic gray base — slightly warm highlands, cool dark maria
  vec3 highland = vec3(0.74, 0.72, 0.70);
  vec3 mariaBase = vec3(0.18, 0.17, 0.15);  // slightly warm — basalt is brownish
  vec3 base = mix(highland, mariaBase, maria);

  // subtle tonal variation across surface (like real photos)
  float toneShift = snoise(sp * 0.5) * 0.06;
  base += toneShift;
  base *= 0.90 + detail * 0.20;

  // accurate mineral colors — steel blues, warm ambers, soft mauves
  // matched to real mineral moon astrophotography palettes
  vec3 colSteelBlue = vec3(0.17, 0.30, 0.56);   // steel blue (ilmenite/titanium)
  vec3 colTeal      = vec3(0.15, 0.38, 0.42);   // teal (high titanium concentration)
  vec3 colAmber     = vec3(0.72, 0.52, 0.18);   // warm amber (iron basalt)
  vec3 colRust      = vec3(0.55, 0.28, 0.12);   // rust/sienna (iron oxide regions)
  vec3 colOchre     = vec3(0.68, 0.58, 0.26);   // pale ochre (mixed iron)
  vec3 colOlive     = vec3(0.42, 0.44, 0.14);   // olive (olivine minerals)
  // mineral signal strengths — lower thresholds = more coverage of blue & amber
  float sTi     = smoothstep(0.30, 0.48, titanium) * maria;
  float sTiHigh = smoothstep(0.50, 0.64, titanium) * maria;
  float sIron   = smoothstep(0.28, 0.46, iron);
  float ironHi  = smoothstep(0.50, 0.65, iron);
  float sAmber  = sIron * (1.0 - ironHi);
  float sRust   = ironHi * 0.7;
  float sOchre  = sIron * (1.0 - maria) * 0.35;  // ochre at highland-maria borders
  float sOlive  = smoothstep(0.50, 0.66, olivine) * 0.55;

  // blend: steel blue for moderate Ti, teal for high Ti
  vec3 tiColor = mix(colSteelBlue, colTeal, sTiHigh / (sTi + 0.001));
  float sBlue = sTi;

  // weighted color accumulation — no explicit purple, transitions are natural
  float totalW = sBlue + sAmber + sRust + sOchre + sOlive + 0.001;
  vec3 weighted = tiColor * sBlue + colAmber * sAmber + colRust * sRust
                + colOchre * sOchre + colOlive * sOlive;
  weighted /= totalW;

  // key difference: mix gently — colors emerge from gray, not dominate it
  // this mimics the saturation-boost technique of real mineral moon photos
  float maxS = max(max(sBlue, sAmber), max(sRust, sOlive));
  float blend = smoothstep(0.0, 0.6, maxS) * 0.70;
  vec3 mineralCol = mix(base, weighted, blend);

  // crater ray brightening (white streaks from fresh impacts)
  float rays = fbm3(sp * 3.0 + vec3(30.0, 0.0, 15.0));
  float rayMask = smoothstep(0.62, 0.74, rays) * (1.0 - maria * 0.7);
  mineralCol = mix(mineralCol, vec3(0.90, 0.88, 0.85), rayMask * 0.5);

  // secondary rays at finer scale (smaller impact ejecta)
  float fineRays = fbm3(sp * 7.0 + vec3(50.0, 20.0, 35.0));
  float fineRayMask = smoothstep(0.66, 0.76, fineRays) * (1.0 - maria * 0.5);
  mineralCol = mix(mineralCol, vec3(0.85, 0.84, 0.82), fineRayMask * 0.25);

  return mineralCol;
}

/* ── starfield ── */

float stars(vec2 uv, float scale, float seed) {
  vec2 grid = floor(uv * scale);
  vec2 f = fract(uv * scale);
  float r = hash21(grid + seed);
  if (r > 0.97) {
    vec2 center = vec2(hash21(grid + seed + 10.0), hash21(grid + seed + 20.0));
    float d = length(f - center);
    float brightness = (r - 0.97) / 0.03;
    float twinkle = 0.7 + 0.3 * sin(u_time * (2.0 + r * 4.0) + r * 100.0);
    return smoothstep(0.05, 0.0, d) * brightness * twinkle;
  }
  return 0.0;
}

/* ── main ── */

void main() {
  vec2 uv = vUv;
  vec2 st = (uv - 0.5) * 2.0;
  st.x *= u_resolution.x / u_resolution.y;

  float t = u_time;

  // camera
  vec3 ro = vec3(0.0, 0.0, 2.8);
  vec3 rd = normalize(vec3(st, -1.5));

  // background: deep space
  vec3 bgCol = vec3(0.008, 0.008, 0.02);

  // starfield layers
  float starLayer = 0.0;
  starLayer += stars(st, 80.0, 0.0);
  starLayer += stars(st, 140.0, 50.0);
  starLayer += stars(st, 220.0, 100.0) * 0.5;
  bgCol += vec3(0.9, 0.9, 1.0) * starLayer;

  // moon
  float moonRadius = 0.85;
  vec3 moonCenter = vec3(0.0);
  float hit = sphereIntersect(ro, rd, moonCenter, moonRadius);

  vec3 col = bgCol;

  if (hit > 0.0) {
    vec3 pos = ro + rd * hit;
    vec3 normal = normalize(pos - moonCenter);

    // slow rotation around Y
    float angle = t * 0.04;
    float ca = cos(angle), sa = sin(angle);
    vec3 rotPos = vec3(pos.x * ca - pos.z * sa, pos.y, pos.x * sa + pos.z * ca);

    // surface coordinates
    vec3 sp = rotPos * 3.5;

    // terrain: maria vs highlands — layered noise for geological shapes
    float terrain1 = fbm3(sp * 0.5);
    float terrain2 = fbm3(sp * 0.8 + vec3(20.0, 0.0, 10.0));
    float terrain = terrain1 * 0.7 + terrain2 * 0.3;

    // maria regions — large basalt plains with soft edges
    float maria = smoothstep(0.42, 0.58, terrain);
    // sub-maria variation (different lava flows within a mare)
    float mariaAge = fbm3(sp * 1.0 + vec3(40.0, 20.0, 0.0));

    // mineral distribution — geologically motivated offsets
    float titaniumMap = fbm3(sp * 1.1 + vec3(0.0, 5.0, 0.0));
    float ironMap = fbm3(sp * 1.3 + vec3(10.0, 0.0, 5.0));
    float olivineMap = fbm3(sp * 1.6 + vec3(3.0, 8.0, 13.0));

    // titanium concentrated in maria (especially "young" maria flows)
    titaniumMap *= (0.10 + maria * 0.90) * (0.7 + mariaAge * 0.3);
    // iron widespread but stronger in maria
    ironMap *= (0.25 + maria * 0.55);
    // olivine in specific pockets, less common
    olivineMap *= (0.3 + maria * 0.35);

    // detail noises
    float detail = fbm3(sp * 5.0);
    float extra = fbm3(sp * 1.6 + vec3(22.0, 7.0, 15.0));

    // surface color
    vec3 surfaceCol = mineralColor(titaniumMap, ironMap, olivineMap, maria, detail, extra, sp);

    // bump mapping — terrain noise + multi-scale procedural craters
    float eps = 0.003;
    vec3 rp = rotPos;

    // terrain bumps (large scale — maria basins and highland ridges)
    float lx = fbm3((rp + vec3(eps,0,0)) * 8.0) - fbm3((rp - vec3(eps,0,0)) * 8.0);
    float ly = fbm3((rp + vec3(0,eps,0)) * 8.0) - fbm3((rp - vec3(0,eps,0)) * 8.0);
    float lz = fbm3((rp + vec3(0,0,eps)) * 8.0) - fbm3((rp - vec3(0,0,eps)) * 8.0);

    // fine detail (regolith texture)
    float sx = fbm3((rp + vec3(eps,0,0)) * 20.0) - fbm3((rp - vec3(eps,0,0)) * 20.0);
    float sy = fbm3((rp + vec3(0,eps,0)) * 20.0) - fbm3((rp - vec3(0,eps,0)) * 20.0);
    float sz = fbm3((rp + vec3(0,0,eps)) * 20.0) - fbm3((rp - vec3(0,0,eps)) * 20.0);

    // procedural crater bumps — three scales for realism
    float ceps = 0.01;
    // large craters (Tycho, Copernicus scale)
    float cx = crater(rp + vec3(ceps,0,0), 6.0) - crater(rp - vec3(ceps,0,0), 6.0);
    float cy = crater(rp + vec3(0,ceps,0), 6.0) - crater(rp - vec3(0,ceps,0), 6.0);
    float cz = crater(rp + vec3(0,0,ceps), 6.0) - crater(rp - vec3(0,0,ceps), 6.0);
    // medium craters
    float c2x = crater(rp + vec3(ceps,0,0), 14.0) - crater(rp - vec3(ceps,0,0), 14.0);
    float c2y = crater(rp + vec3(0,ceps,0), 14.0) - crater(rp - vec3(0,ceps,0), 14.0);
    float c2z = crater(rp + vec3(0,0,ceps), 14.0) - crater(rp - vec3(0,0,ceps), 14.0);
    // micro craters (pockmarked surface texture)
    float mceps = 0.005;
    float mcx = microCrater(rp + vec3(mceps,0,0), 30.0) - microCrater(rp - vec3(mceps,0,0), 30.0);
    float mcy = microCrater(rp + vec3(0,mceps,0), 30.0) - microCrater(rp - vec3(0,mceps,0), 30.0);
    float mcz = microCrater(rp + vec3(0,0,mceps), 30.0) - microCrater(rp - vec3(0,0,mceps), 30.0);

    vec3 bump = vec3(lx, ly, lz) * 1.8
              + vec3(sx, sy, sz) * 0.5
              + vec3(cx, cy, cz) * 2.8
              + vec3(c2x, c2y, c2z) * 1.8
              + vec3(mcx, mcy, mcz) * 0.8;
    vec3 bumpNormal = normalize(normal + bump);

    // lighting — angled to create dramatic terminator-style relief
    // light from upper-right, like classic mineral moon photos
    vec3 lightDir = normalize(vec3(0.35, 0.2, 0.9));
    float diff = max(dot(bumpNormal, lightDir), 0.0);

    // soft shadow near terminator — smooth falloff for realism
    float terminator = smoothstep(-0.02, 0.12, dot(normal, lightDir));
    diff *= terminator;

    // specular — subtle mineral sheen, slightly warm
    vec3 halfVec = normalize(lightDir - rd);
    float spec = pow(max(dot(bumpNormal, halfVec), 0.0), 60.0) * 0.05;
    vec3 specColor = vec3(1.0, 0.98, 0.95); // slightly warm highlight

    // combine — strong directional light for dramatic contrast
    float ambient = 0.08;  // much lower ambient = more dramatic
    vec3 lit = surfaceCol * (diff * 0.82 + ambient) + specColor * spec;

    // post-process: gentle saturation boost to mimic the astrophotography technique
    // this is the key to making it look like a real mineral moon photo
    vec3 gray = vec3(dot(lit, vec3(0.299, 0.587, 0.114)));
    lit = mix(gray, lit, 1.25);  // 25% saturation boost — visible but not garish

    // limb darkening — matches real lunar photography
    float rim = max(dot(normal, -rd), 0.0);
    float limb = smoothstep(0.0, 0.2, rim);
    lit *= limb;

    // earthshine on dark limb — very faint blue tint on unlit side
    float darkSide = 1.0 - max(dot(normal, lightDir), 0.0);
    float limbEdge = pow(1.0 - rim, 3.0);
    lit += vec3(0.03, 0.04, 0.06) * darkSide * (1.0 - limbEdge) * 0.3;

    // subtle bright edge corona
    float corona = pow(1.0 - rim, 4.0);
    lit += vec3(0.45, 0.45, 0.50) * corona * 0.12;

    col = lit;
  }

  // corona glow — compute actual projected radius on screen
  float d2c = length(st);
  float projR = 1.5 * moonRadius / sqrt(ro.z * ro.z - moonRadius * moonRadius);
  float outer = max(d2c - projR, 0.0);
  float haloTight = exp(-outer * outer * 3500.0) * 0.18;
  float haloSoft = exp(-outer * outer * 600.0) * 0.05;
  col += vec3(0.68, 0.70, 0.76) * (haloTight + haloSoft);

  // ACES-inspired tone mapping — more photographic than Reinhard
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);

  // gamma
  col = pow(col, vec3(0.90));

  // subtle color grading — very faint cool tint in deepest shadows only
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, col * vec3(0.97, 0.98, 1.02), smoothstep(0.15, 0.0, lum) * 0.2);

  // vignette — subtle
  vec2 vc = uv - 0.5;
  col *= 1.0 - dot(vc, vc) * 0.30;

  gl_FragColor = vec4(col, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');
  moonShader = createShader(vertShader, fragShader);
  noStroke();
}

function draw() {
  shader(moonShader);
  moonShader.setUniform('u_time', millis() / 1000.0);
  moonShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('mineral-moon', 'png');
  }
  if (key === 'g' || key === 'G') {
    saveGif('mineral-moon', 10);
  }
}
