/**
 * Solar System
 *
 * Animated orrery — planets trace colored orbital rings around a glowing sun
 * in a procedural starfield. Orbital radii use log-scaled real AU distances;
 * speeds follow Kepler's 3rd law (ω ∝ a^-3/2).
 *
 * Controls:
 * - Press S to save PNG
 * - Press Shift+S to start/stop GIF recording
 */

P5Capture.setDefaultOptions({
  format: 'gif',
  framerate: 30,
  quality: 0.8,
  width: 600,
});

const SIZE = 600;
const cx = SIZE / 2;
const cy = SIZE / 2;

// Real astronomical data
const PLANETS = [
  { name: 'Mercury', au: 0.39,  size: 3,  planetColor: '#C0C0C0', ringColor: '#88888855' },
  { name: 'Venus',   au: 0.72,  size: 5,  planetColor: '#F5E6CA', ringColor: '#D4C4A055' },
  { name: 'Earth',   au: 1.00,  size: 5,  planetColor: '#6DB3F2', ringColor: '#4A8AC455' },
  { name: 'Mars',    au: 1.52,  size: 4,  planetColor: '#E07040', ringColor: '#B85A3555' },
  { name: 'Jupiter', au: 5.20,  size: 12, planetColor: '#E8B87C', ringColor: '#C0906055' },
  { name: 'Saturn',  au: 9.54,  size: 10, planetColor: '#F0D080', ringColor: '#C8A85855' },
  { name: 'Uranus',  au: 19.19, size: 7,  planetColor: '#88D8E8', ringColor: '#60B0C055' },
  { name: 'Neptune', au: 30.07, size: 7,  planetColor: '#5878F0', ringColor: '#4060C055' },
];

// Log-scale mapping: AU → pixel radius (fits 600px canvas)
const MIN_R = 45;
const MAX_R = 280;
const logMin = Math.log(PLANETS[0].au);
const logMax = Math.log(PLANETS[PLANETS.length - 1].au);

// Kepler's 3rd law: ω ∝ a^(-3/2)
// Mercury completes one orbit in ~5s of animation
const BASE_SPEED = 0.0013;
const BASE_AU = PLANETS[0].au;

const orbits = PLANETS.map((p) => ({
  ...p,
  r: MIN_R + (MAX_R - MIN_R) * (Math.log(p.au) - logMin) / (logMax - logMin),
  speed: BASE_SPEED * Math.pow(BASE_AU / p.au, 1.5),
}));

let starBuffer;
let planetAngles = [];
let twinkleStars = [];

function setup() {
  const canvas = createCanvas(SIZE, SIZE);
  canvas.parent('canvas-container');
  pixelDensity(2);

  for (let i = 0; i < orbits.length; i++) {
    planetAngles[i] = random(TWO_PI);
  }

  starBuffer = createGraphics(SIZE, SIZE);
  starBuffer.background(0);
  drawStarfield(starBuffer);
}

function drawStarfield(pg) {
  pg.noStroke();
  for (let i = 0; i < 400; i++) {
    const x = random(pg.width);
    const y = random(pg.height);
    const sz = random(0.5, 2);
    const brightness = random(120, 255);
    pg.fill(brightness, brightness, brightness + random(-10, 20));
    pg.ellipse(x, y, sz, sz);
  }

  for (let i = 0; i < 30; i++) {
    twinkleStars.push({
      x: random(SIZE),
      y: random(SIZE),
      size: random(1, 2.5),
      speed: random(0.02, 0.06),
      offset: random(TWO_PI),
      baseBrightness: random(150, 230),
    });
  }
}

function draw() {
  background(0);

  // 1. starfield
  image(starBuffer, 0, 0);

  // twinkle overlay
  noStroke();
  for (const star of twinkleStars) {
    const alpha = map(sin(frameCount * star.speed + star.offset), -1, 1, 60, 255);
    fill(star.baseBrightness, star.baseBrightness, star.baseBrightness + 20, alpha);
    ellipse(star.x, star.y, star.size, star.size);
  }

  // 2. sun glow layers
  drawSunGlow();

  // 3. orbital rings
  noFill();
  strokeWeight(1);
  for (const orbit of orbits) {
    stroke(orbit.ringColor);
    ellipse(cx, cy, orbit.r * 2, orbit.r * 2);
  }

  // 4. planets with glow
  const dt = deltaTime;
  for (let i = 0; i < orbits.length; i++) {
    const orbit = orbits[i];
    planetAngles[i] += orbit.speed * dt;

    const px = cx + orbit.r * cos(planetAngles[i]);
    const py = cy + orbit.r * sin(planetAngles[i]);

    // planet glow
    noStroke();
    const c = color(orbit.planetColor);
    for (let g = 3; g >= 1; g--) {
      const glowSize = orbit.size + g * 4;
      const a = map(g, 1, 3, 50, 15);
      fill(red(c), green(c), blue(c), a);
      ellipse(px, py, glowSize, glowSize);
    }

    // Saturn's ring
    if (orbit.name === 'Saturn') {
      push();
      translate(px, py);
      noFill();
      stroke(240, 208, 128, 80);
      strokeWeight(1.5);
      ellipse(0, 0, orbit.size * 3, orbit.size * 1.2);
      pop();
    }

    // planet body
    fill(orbit.planetColor);
    noStroke();
    ellipse(px, py, orbit.size, orbit.size);
  }

  // 5. sun core (on top)
  noStroke();
  fill('#FFF5D0');
  ellipse(cx, cy, 28, 28);
  fill('#FFFFFF');
  ellipse(cx, cy, 16, 16);
}

function drawSunGlow() {
  noStroke();

  const glowLayers = [
    { size: 100, r: 255, g: 180, b: 50, a: 8 },
    { size: 75,  r: 255, g: 200, b: 80, a: 15 },
    { size: 55,  r: 255, g: 220, b: 120, a: 25 },
    { size: 42,  r: 255, g: 235, b: 170, a: 40 },
    { size: 32,  r: 255, g: 245, b: 210, a: 60 },
  ];

  for (const layer of glowLayers) {
    fill(layer.r, layer.g, layer.b, layer.a);
    ellipse(cx, cy, layer.size, layer.size);
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    if (keyIsDown(SHIFT)) {
      if (typeof P5Capture !== 'undefined') {
        const c = P5Capture.getInstance();
        if (c.state === 'idle') c.start({ format: 'gif', duration: 300, quality: 8 });
        else c.stop();
      }
    } else {
      saveCanvas('solar-system', 'png');
    }
  }
}
