# Starry Swirl Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A GLSL shader sketch of a swirling Van Gogh / James R. Eads–inspired night sky with luminous gold-edged swirls, twinkling stars, and a glowing moon.

**Architecture:** Single p5.js WEBGL sketch with inline vertex/fragment shaders. Double domain-warped FBM creates swirl currents. Finite-difference gradient extracts luminous edges. Procedural starfield + moon SDF layered on top.

**Tech Stack:** p5.js, GLSL (fragment shader), p5.capture

---

### Task 1: Scaffold files

**Files:**
- Create: `sketches/starry-swirl/index.html`
- Create: `sketches/starry-swirl/sketch.js`

**Step 1: Create index.html**

Copy the exact HTML boilerplate from `sketches/oil-marble/index.html`, changing only the `<title>` to "Starry Swirl" and background-color to `#000008`.

**Step 2: Create sketch.js with boilerplate**

```javascript
/**
 * Starry Swirl
 *
 * A Van Gogh / James R. Eads–inspired swirling night sky rendered in GLSL.
 * Double domain-warped FBM creates luminous flowing currents across a deep
 * dark canvas, with twinkling stars and a glowing moon.
 *
 * Controls:
 * - Press S to save PNG
 */

P5Capture.setDefaultOptions({
  format: 'webm',
  framerate: 60,
  quality: 1.0,
  width: 800,
});

const WIDTH = 800;
const HEIGHT = 800;

let swirlShader;

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

void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.05, 1.0);
}
`;

function setup() {
  pixelDensity(2);
  const canvas = createCanvas(WIDTH, HEIGHT, WEBGL);
  canvas.parent('canvas-container');
  swirlShader = createShader(vertShader, fragShader);
}

function draw() {
  shader(swirlShader);
  swirlShader.setUniform('u_time', millis() / 1000.0);
  swirlShader.setUniform('u_resolution', [WIDTH, HEIGHT]);
  rect(0, 0, WIDTH, HEIGHT);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('starry-swirl', 'png');
  }
}
```

**Step 3: Verify** — Open in browser (`python3 -m http.server` from project root, navigate to `sketches/starry-swirl/`). Should show a near-black 800x800 canvas.

**Step 4: Commit**

```bash
git add sketches/starry-swirl/index.html sketches/starry-swirl/sketch.js
git commit -m "feat: scaffold starry swirl shader sketch"
```

---

### Task 2: Noise foundation + double domain warp

**Files:**
- Modify: `sketches/starry-swirl/sketch.js` (fragment shader)

**Step 1: Add noise functions to fragment shader**

Add `hash()`, `noise()`, `fbm()` — identical to oil-marble. Then add `domainWarp()` tuned for swirling sky currents:

```glsl
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

float domainWarp(vec2 p, float t, out vec2 q, out vec2 r) {
  q = vec2(
    fbm(p + vec2(0.0, 0.0) + t * 0.04),
    fbm(p + vec2(5.2, 1.3) + t * 0.03)
  );
  r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.025),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.02)
  );
  return fbm(p + 4.0 * r);
}
```

**Step 2: Update main() to visualize the raw warp**

```glsl
void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;
  float t = u_time;
  vec2 p = uv * 3.5;
  vec2 q, r;
  float f = domainWarp(p, t, q, r);
  gl_FragColor = vec4(vec3(f), 1.0);
}
```

**Step 3: Verify** — Reload browser. Should show animated grayscale swirling noise.

**Step 4: Commit**

```bash
git add sketches/starry-swirl/sketch.js
git commit -m "feat: add noise foundation and double domain warp"
```

---

### Task 3: Color palette + luminous edges

**Files:**
- Modify: `sketches/starry-swirl/sketch.js` (fragment shader)

**Step 1: Add color constants and edge detection to fragment shader**

```glsl
// Night sky palette
vec3 voidBlack   = vec3(0.01, 0.01, 0.04);
vec3 deepNavy    = vec3(0.03, 0.05, 0.15);
vec3 midBlue     = vec3(0.10, 0.18, 0.42);
vec3 warmAmber   = vec3(0.85, 0.65, 0.25);
vec3 brightGold  = vec3(1.00, 0.92, 0.70);
```

**Step 2: Update main() with color ramp + edge glow**

```glsl
void main() {
  vec2 uv = vUv;
  uv.y = 1.0 - uv.y;
  float t = u_time;
  vec2 p = uv * 3.5;

  vec2 q, r;
  float f = domainWarp(p, t, q, r);

  // Base color ramp: dark sky with blue mid-tones
  vec3 col = voidBlack;
  col = mix(col, deepNavy, smoothstep(0.0, 0.25, f));
  col = mix(col, midBlue,  smoothstep(0.25, 0.55, f));
  col = mix(col, deepNavy, smoothstep(0.55, 0.80, f));

  // Luminous edges via gradient magnitude
  float eps = 0.004;
  vec2 qD, rD;
  float fx = domainWarp(p + vec2(eps, 0.0), t, qD, rD);
  float fy = domainWarp(p + vec2(0.0, eps), t, qD, rD);
  float edge = length(vec2(fx - f, fy - f)) / eps;

  // Gold glow on swirl edges
  float edgeGlow = smoothstep(0.8, 2.5, edge);
  col = mix(col, warmAmber, edgeGlow * 0.6);
  col += brightGold * pow(edgeGlow, 3.0) * 0.3;

  // Saturation boost
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.3);

  // Vignette
  vec2 vc = uv - 0.5;
  float vignette = 1.0 - dot(vc, vc) * 0.6;
  col *= clamp(vignette, 0.0, 1.0);

  // Gamma
  col = pow(col, vec3(0.95));

  gl_FragColor = vec4(col, 1.0);
}
```

**Step 3: Verify** — Reload. Should show dark blue swirling sky with glowing gold/amber edges tracing the flow.

**Step 4: Commit**

```bash
git add sketches/starry-swirl/sketch.js
git commit -m "feat: add night sky palette with luminous gold edges"
```

---

### Task 4: Procedural starfield

**Files:**
- Modify: `sketches/starry-swirl/sketch.js` (fragment shader)

**Step 1: Add star function**

Add this function before main():

```glsl
float stars(vec2 uv, float t) {
  float star = 0.0;
  // Multiple star layers at different scales
  for (int i = 0; i < 3; i++) {
    float scale = 80.0 + float(i) * 60.0;
    vec2 grid = floor(uv * scale);
    vec2 gridUv = fract(uv * scale) - 0.5;
    float h = hash(grid + float(i) * 100.0);
    // Only ~15% of cells have stars
    if (h > 0.85) {
      vec2 offset = vec2(hash(grid + 0.1) - 0.5, hash(grid + 0.2) - 0.5) * 0.6;
      float d = length(gridUv - offset);
      float brightness = smoothstep(0.04, 0.0, d);
      // Twinkle
      float twinkle = sin(t * (1.5 + h * 3.0) + h * 6.28) * 0.5 + 0.5;
      brightness *= 0.5 + twinkle * 0.5;
      // Size variation
      brightness *= 0.4 + h * 0.6;
      star += brightness;
    }
  }
  return star;
}
```

**Step 2: Add stars to main(), masked by swirl darkness**

Insert before vignette in main():

```glsl
// Stars — only visible in dark areas
float darkness = 1.0 - smoothstep(0.15, 0.45, f);
float starBright = stars(uv, t) * darkness;
col += vec3(0.9, 0.9, 1.0) * starBright;
```

**Step 3: Verify** — Reload. Stars should twinkle in the darker regions between swirl currents.

**Step 4: Commit**

```bash
git add sketches/starry-swirl/sketch.js
git commit -m "feat: add twinkling starfield masked by swirl intensity"
```

---

### Task 5: Glowing moon

**Files:**
- Modify: `sketches/starry-swirl/sketch.js` (fragment shader)

**Step 1: Add moon to main()**

Insert after stars, before vignette:

```glsl
// Moon — off-center upper area
vec2 moonPos = vec2(0.65, 0.72);
float moonDist = length(uv - moonPos);
float moonRadius = 0.045;

// Moon disc
float moonDisc = smoothstep(moonRadius, moonRadius - 0.003, moonDist);

// Subtle crater texture
float craters = fbm(uv * 40.0) * 0.15;
vec3 moonColor = vec3(0.95, 0.93, 0.85) - craters;
col = mix(col, moonColor, moonDisc);

// Soft outer glow
float moonGlow = exp(-moonDist * moonDist * 80.0);
col += vec3(0.6, 0.55, 0.35) * moonGlow * 0.4;

// Bright inner halo
float innerHalo = exp(-moonDist * moonDist * 300.0);
col += vec3(0.9, 0.85, 0.7) * innerHalo * 0.3;
```

**Step 2: Verify** — Reload. Crescent-sized moon with warm glow in the upper-right area, swirls flowing around it.

**Step 3: Commit**

```bash
git add sketches/starry-swirl/sketch.js
git commit -m "feat: add glowing moon with crater texture and halo"
```

---

### Task 6: Polish + visual tuning

**Files:**
- Modify: `sketches/starry-swirl/sketch.js` (fragment shader)

**Step 1: Fine-tune parameters**

This is the visual tuning pass. Review and adjust:

- **Swirl speed**: `t * 0.04` / `t * 0.03` in domainWarp — slow enough to feel dreamy
- **Swirl density**: `uv * 3.5` — the pattern scale
- **Edge glow intensity**: `edgeGlow * 0.6` and `pow(edgeGlow, 3.0) * 0.3`
- **Star density**: threshold `0.85` in stars function
- **Moon size and position**: `moonRadius = 0.045`, `moonPos = vec2(0.65, 0.72)`
- **Color balance**: the smoothstep breakpoints in the color ramp

Iterate visually until the balance between dark sky, luminous edges, stars, and moon feels right.

**Step 2: Verify** — Final visual check. The piece should feel like a dreamy, luminous night sky with flowing Van Gogh–like currents.

**Step 3: Commit**

```bash
git add sketches/starry-swirl/sketch.js
git commit -m "feat: polish visual tuning for starry swirl"
```

---

### Task 7: Add to manifest

**Files:**
- Modify: `manifest.json`

**Step 1: Add entry to manifest.json sketches array**

Add as the last entry in the `"sketches"` array:

```json
{
  "slug": "starry-swirl",
  "title": "Starry Swirl",
  "description": "A Van Gogh / James R. Eads–inspired night sky — luminous gold-edged swirls flow across a deep navy void, with twinkling stars and a glowing moon.",
  "date": "2026-04-04",
  "media": "sketches/starry-swirl/starry-swirl.png",
  "tags": ["generative", "shader", "landscape"],
  "tech": ["p5.js", "GLSL"]
}
```

**Step 2: Verify** — Run `python3 -c "import json; json.load(open('manifest.json'))"` to validate JSON.

**Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add starry swirl to manifest"
```
