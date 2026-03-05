/**
 * Society
 *
 * Inspired by Eddie Vedder's "Society."
 * Why is every person so bad to each other so often?
 *
 * Abstract particle field — communities form and get torn apart.
 * The canvas accumulates scars. Nothing heals. Nothing is learned.
 *
 * Controls: Press Shift+S to start/stop GIF recording
 */

P5Capture.setDefaultOptions({
  format: 'gif',
  framerate: 30,
  quality: 0.8,
  width: 600,
});

// --- Constants ---
const CANVAS_SIZE = 600;
const NUM_PARTICLES = 180;
const FLOW_SCALE = 0.005;
const FLOW_SPEED = 0.002;
const MAX_VEL = 0.8;
const DRAG = 0.98;
const COHESION_RADIUS = 60;
const COHESION_FORCE = 0.02;

// --- Globals ---
let particles = [];
let scarLayer;
let flowTime = 0;

// --- Particle Class ---
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.warmth = random(30, 50);
    this.maxWarmth = this.warmth;
    this.flashTimer = 0;
    this.size = random(3, 5);
    this.noiseOff = random(1000);
    this.alive = true;
  }

  applyFlowField() {
    const angle =
      noise(this.pos.x * FLOW_SCALE, this.pos.y * FLOW_SCALE, flowTime) *
      TWO_PI *
      2;
    const force = p5.Vector.fromAngle(angle);
    force.mult(0.05);
    this.acc.add(force);
  }

  applyCohesion(neighbors) {
    if (neighbors.length === 0) return;

    const center = createVector(0, 0);
    for (const n of neighbors) {
      center.add(n.pos);
    }
    center.div(neighbors.length);

    const desired = p5.Vector.sub(center, this.pos);
    desired.limit(COHESION_FORCE);
    this.acc.add(desired);
  }

  applyImpulse(force) {
    this.acc.add(force);
    this.flashTimer = 15;
    this.warmth = max(0, this.warmth - random(3, 8));
  }

  update() {
    this.vel.add(this.acc);
    this.vel.mult(DRAG);
    this.vel.limit(MAX_VEL);
    this.pos.add(this.vel);
    this.acc.set(0, 0);

    if (this.flashTimer > 0) {
      this.flashTimer--;
    }

    this.wrapEdges();
  }

  wrapEdges() {
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  display() {
    noStroke();

    // Body color: gray, or red flash fading to gray
    let bodyR = 180;
    let bodyG = 180;
    let bodyB = 190;

    if (this.flashTimer > 0) {
      const t = this.flashTimer / 15;
      bodyR = lerp(180, 220, t);
      bodyG = lerp(180, 30, t);
      bodyB = lerp(190, 20, t);
    }

    fill(bodyR, bodyG, bodyB);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);

    // Warm amber core
    fill(255, 180, 60, this.warmth);
    const coreSize = this.size * 0.6;
    ellipse(this.pos.x, this.pos.y, coreSize, coreSize);
  }
}

// --- p5.js Lifecycle ---
function setup() {
  pixelDensity(1);
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  canvas.parent('canvas-container');

  scarLayer = createGraphics(CANVAS_SIZE, CANVAS_SIZE);
  scarLayer.clear();

  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push(new Particle(random(width), random(height)));
  }
}

function draw() {
  background(0, 10);

  flowTime += FLOW_SPEED;

  image(scarLayer, 0, 0);

  for (const p of particles) {
    p.applyFlowField();

    // Find neighbors within COHESION_RADIUS
    const neighbors = [];
    for (const other of particles) {
      if (other === p) continue;
      if (dist(p.pos.x, p.pos.y, other.pos.x, other.pos.y) < COHESION_RADIUS) {
        neighbors.push(other);
      }
    }

    p.applyCohesion(neighbors);
    p.update();
    p.display();
  }
}
