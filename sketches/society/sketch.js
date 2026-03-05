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
const SLOW_PHASE_MIN = 90;   // 3s at 30fps
const SLOW_PHASE_MAX = 150;  // 5s at 30fps
const BURST_DURATION = 12;   // ~0.4s
const RECOVERY_DURATION = 45; // ~1.5s
const SLASH_RADIUS = 40;      // damage radius around slash head
const MAX_EMBERS = 8;
const EMBER_SPAWN_CHANCE = 0.02; // per frame during slow phase

// --- Globals ---
let particles = [];
let scarLayer;
let flowTime = 0;
let phase = 'slow';
let phaseTimer = 0;
let phaseDuration = 120;
let activeSlashes = [];
let embers = [];

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

// --- Slash Class ---
class Slash {
  constructor() {
    // Start from a random edge
    const side = floor(random(4));
    if (side === 0) this.start = createVector(random(width), 0);
    else if (side === 1) this.start = createVector(width, random(height));
    else if (side === 2) this.start = createVector(random(width), height);
    else this.start = createVector(0, random(height));

    // Aim toward center with randomness
    const target = createVector(
      width / 2 + random(-150, 150),
      height / 2 + random(-150, 150)
    );
    this.dir = p5.Vector.sub(target, this.start).normalize();
    this.length = random(300, 500);
    this.progress = 0;
    this.speed = random(25, 40); // pixels per frame — fast and violent
    this.done = false;
  }

  update() {
    if (this.progress < this.length) {
      this.progress += this.speed;

      // Current head position
      const head = p5.Vector.add(
        this.start,
        p5.Vector.mult(this.dir, this.progress)
      );

      // Scatter nearby particles — this is the violence
      for (const p of particles) {
        const d = dist(p.pos.x, p.pos.y, head.x, head.y);
        if (d < SLASH_RADIUS) {
          const repel = p5.Vector.sub(p.pos, head);
          repel.normalize();
          repel.mult(map(d, 0, SLASH_RADIUS, 5, 1));
          p.applyImpulse(repel);
        }
      }

      // Kill nearby embers
      for (const e of embers) {
        const de = dist(e.pos.x, e.pos.y, head.x, head.y);
        if (de < SLASH_RADIUS * 1.5) {
          e.kill();
        }
      }

      // Paint permanent scar on scar layer
      scarLayer.stroke(220, 30, 20, 150);
      scarLayer.strokeWeight(random(1.5, 3));
      const prevProgress = max(0, this.progress - this.speed);
      const prev = p5.Vector.add(
        this.start,
        p5.Vector.mult(this.dir, prevProgress)
      );
      scarLayer.line(prev.x, prev.y, head.x, head.y);
    } else {
      this.done = true;
    }
  }

  display() {
    if (this.done) return;

    const head = p5.Vector.add(
      this.start,
      p5.Vector.mult(this.dir, min(this.progress, this.length))
    );

    // Draw the visible slash line (tail to head)
    const tailProgress = max(0, this.progress - 60);
    const tail = p5.Vector.add(
      this.start,
      p5.Vector.mult(this.dir, tailProgress)
    );

    stroke(220, 30, 20);
    strokeWeight(3);
    line(tail.x, tail.y, head.x, head.y);

    // Red glow around the head
    noStroke();
    fill(220, 30, 20, 40);
    ellipse(head.x, head.y, SLASH_RADIUS, SLASH_RADIUS);
  }
}

// --- Ember Class ---
class Ember {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.life = 1.0;
    this.fadeIn = 0;
    this.size = random(2, 4);
    this.maxLife = random(60, 120); // frames before natural fade
    this.age = 0;
  }

  update() {
    this.age++;
    this.fadeIn = min(1, this.fadeIn + 0.05);
    if (this.age > this.maxLife) {
      this.life -= 0.02;
    }
  }

  kill() {
    this.life -= 0.1; // fast death when near a slash
  }

  display() {
    const alpha = this.life * this.fadeIn * 200;
    noStroke();
    // Inner bright core
    fill(255, 200, 80, alpha);
    ellipse(this.pos.x, this.pos.y, this.size);
    // Outer soft glow
    fill(255, 200, 80, alpha * 0.3);
    ellipse(this.pos.x, this.pos.y, this.size * 3);
  }

  isDead() {
    return this.life <= 0;
  }
}

function trySpawnEmber() {
  if (embers.length >= MAX_EMBERS) return;
  if (random() > EMBER_SPAWN_CHANCE) return;

  // Pick a random candidate position
  const x = random(50, width - 50);
  const y = random(50, height - 50);

  // Check it's far from all particles (a quiet gap)
  let tooClose = false;
  for (const p of particles) {
    if (dist(x, y, p.pos.x, p.pos.y) < 80) {
      tooClose = true;
      break;
    }
  }

  if (!tooClose) {
    embers.push(new Ember(x, y));
  }
}

// --- Phase Management ---
function updatePhase() {
  phaseTimer++;

  if (phase === 'slow' && phaseTimer >= phaseDuration) {
    phase = 'burst';
    phaseTimer = 0;
    phaseDuration = BURST_DURATION;
    // Spawn 1-3 slashes
    const count = floor(random(1, 4));
    for (let i = 0; i < count; i++) {
      activeSlashes.push(new Slash());
    }
  } else if (phase === 'burst' && phaseTimer >= phaseDuration) {
    phase = 'recovery';
    phaseTimer = 0;
    phaseDuration = RECOVERY_DURATION;
  } else if (phase === 'recovery' && phaseTimer >= phaseDuration) {
    phase = 'slow';
    phaseTimer = 0;
    phaseDuration = floor(random(SLOW_PHASE_MIN, SLOW_PHASE_MAX));
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

  updatePhase();

  // Draw permanent scar layer
  image(scarLayer, 0, 0);

  // Update and display particles
  for (const p of particles) {
    p.applyFlowField();
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

  // Update and display slashes
  for (const s of activeSlashes) {
    s.update();
    s.display();
  }
  // Remove finished slashes
  activeSlashes = activeSlashes.filter(s => !s.done);

  // Spawn embers during calm
  if (phase === 'slow') {
    trySpawnEmber();
  }

  // Update and display embers
  for (const e of embers) {
    e.update();
    e.display();
  }
  embers = embers.filter(e => !e.isDead());
}
