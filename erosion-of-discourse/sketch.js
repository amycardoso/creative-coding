/**
 * Erosion of Discourse
 *
 * A generative visualization about human incoherence.
 * The background imposes a rigid binary contrast between black and white,
 * representing political discourse. Autonomous agents wander freely,
 * leaving trails of texture and nuance.
 *
 * The rigidity of the background is eroded by the softness of affection,
 * proving that reality is not binary — it is gray.
 */

const NUM_AGENTS = 12;
const GRID_SIZE = 40;
const CANVAS_SIZE = 600;
const TRAIL_HISTORY_LENGTH = 60;
const TRAIL_FADE_RATE = 2; // Alpha value for slow fade (higher = faster fade)

let agents = [];
let trailLayer;

function setup() {
  pixelDensity(1);
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  canvas.parent('canvas-container');

  trailLayer = createGraphics(CANVAS_SIZE, CANVAS_SIZE);
  trailLayer.clear();

  for (let i = 0; i < NUM_AGENTS; i++) {
    agents.push(new Agent(random(width), random(height), i));
  }
}

function draw() {
  drawGrid();

  // Slowly fade the trail layer to prevent complete fog
  // This creates an equilibrium where discourse reasserts itself
  fadeTrailLayer();

  for (const agent of agents) {
    agent.update();
    agent.drawTrail(trailLayer);
  }

  image(trailLayer, 0, 0);

  for (const agent of agents) {
    agent.displayTrailHistory();
    agent.display();
  }
}

function drawGrid() {
  noStroke();
  const cols = ceil(width / GRID_SIZE);
  const rows = ceil(height / GRID_SIZE);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isWhite = (row + col) % 2 === 0;
      fill(isWhite ? 255 : 0);
      rect(col * GRID_SIZE, row * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    }
  }
}

function fadeTrailLayer() {
  // Use erase mode to slowly reduce alpha of existing trails
  trailLayer.loadPixels();
  for (let i = 3; i < trailLayer.pixels.length; i += 4) {
    // Reduce alpha channel
    if (trailLayer.pixels[i] > 0) {
      trailLayer.pixels[i] = max(0, trailLayer.pixels[i] - TRAIL_FADE_RATE);
    }
  }
  trailLayer.updatePixels();
}

// Agent personalities define movement characteristics
const PERSONALITIES = [
  { name: 'contemplative', speedMult: 0.5, noiseInc: 0.002, trailDensity: 25 },
  { name: 'restless', speedMult: 1.8, noiseInc: 0.008, trailDensity: 12 },
  { name: 'wanderer', speedMult: 1.0, noiseInc: 0.004, trailDensity: 18 },
  { name: 'drifter', speedMult: 0.7, noiseInc: 0.003, trailDensity: 22 },
];

// Warm and cool gray tints for emotional depth
const COLOR_TINTS = [
  { r: 140, g: 120, b: 110 }, // warm sepia
  { r: 110, g: 120, b: 140 }, // cool blue
  { r: 130, g: 125, b: 115 }, // neutral warm
  { r: 115, g: 125, b: 130 }, // neutral cool
  { r: 145, g: 130, b: 120 }, // warm amber
  { r: 120, g: 130, b: 145 }, // cool slate
];

class Agent {
  constructor(x, y, index) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);

    // Unique noise offsets
    this.noiseOffsetX = random(1000);
    this.noiseOffsetY = random(1000);

    // Assign personality
    this.personality = PERSONALITIES[index % PERSONALITIES.length];
    this.baseSpeed = random(0.8, 1.4) * this.personality.speedMult;
    this.noiseIncrement = this.personality.noiseInc;
    this.baseTrailDensity = this.personality.trailDensity;

    // Visual properties
    this.size = random(10, 18);
    this.colorTint = COLOR_TINTS[index % COLOR_TINTS.length];

    // Trail history for visible path
    this.history = [];

    // Lingering detection
    this.lingerCounter = 0;
    this.lastGridCell = this.getCurrentGridCell();
  }

  getCurrentGridCell() {
    return {
      col: floor(this.pos.x / GRID_SIZE),
      row: floor(this.pos.y / GRID_SIZE)
    };
  }

  update() {
    // Perlin noise-based movement
    const angle = noise(this.noiseOffsetX, this.noiseOffsetY) * TWO_PI * 2;
    const speed = this.baseSpeed * map(noise(this.noiseOffsetX * 0.5), 0, 1, 0.5, 1.5);

    this.vel.set(cos(angle) * speed, sin(angle) * speed);
    this.pos.add(this.vel);

    this.wrapEdges();

    // Update noise offsets
    this.noiseOffsetX += this.noiseIncrement;
    this.noiseOffsetY += this.noiseIncrement * 1.1;

    // Track lingering (staying in same grid cell)
    const currentCell = this.getCurrentGridCell();
    if (currentCell.col === this.lastGridCell.col &&
        currentCell.row === this.lastGridCell.row) {
      this.lingerCounter = min(this.lingerCounter + 1, 100);
    } else {
      this.lingerCounter = max(this.lingerCounter - 2, 0);
      this.lastGridCell = currentCell;
    }

    // Update trail history
    this.history.push(createVector(this.pos.x, this.pos.y));
    if (this.history.length > TRAIL_HISTORY_LENGTH) {
      this.history.shift();
    }
  }

  wrapEdges() {
    if (this.pos.x < 0) {
      this.pos.x = width;
      this.clearHistoryOnWrap();
    }
    if (this.pos.x > width) {
      this.pos.x = 0;
      this.clearHistoryOnWrap();
    }
    if (this.pos.y < 0) {
      this.pos.y = height;
      this.clearHistoryOnWrap();
    }
    if (this.pos.y > height) {
      this.pos.y = 0;
      this.clearHistoryOnWrap();
    }
  }

  clearHistoryOnWrap() {
    this.history = [];
  }

  drawTrail(buffer) {
    buffer.noStroke();

    // Calculate current speed for density variation
    const currentSpeed = this.vel.mag();
    const speedFactor = map(currentSpeed, 0, 2, 1.5, 0.5);
    const lingerFactor = map(this.lingerCounter, 0, 100, 1, 2.5);

    // More particles when slow or lingering
    const particleCount = floor(this.baseTrailDensity * speedFactor * lingerFactor);

    // Get movement direction for elongated particles
    const moveAngle = this.vel.heading();

    for (let i = 0; i < particleCount; i++) {
      // Directional offset - elongated in movement direction
      const alongDir = randomGaussian(0, this.size * 0.8);
      const perpDir = randomGaussian(0, this.size * 0.5);

      const offsetX = cos(moveAngle) * alongDir - sin(moveAngle) * perpDir;
      const offsetY = sin(moveAngle) * alongDir + cos(moveAngle) * perpDir;

      // Tinted gray with variation
      const tintStrength = random(0.3, 0.7);
      const baseGray = random(90, 170);
      const r = lerp(baseGray, this.colorTint.r, tintStrength);
      const g = lerp(baseGray, this.colorTint.g, tintStrength);
      const b = lerp(baseGray, this.colorTint.b, tintStrength);

      // Higher alpha when lingering
      const alpha = random(15, 35) * lingerFactor;

      buffer.fill(r, g, b, alpha);

      // Elongated ellipse in movement direction
      const particleW = random(1.5, 4);
      const particleH = random(1, 2.5);

      buffer.push();
      buffer.translate(this.pos.x + offsetX, this.pos.y + offsetY);
      buffer.rotate(moveAngle);
      buffer.ellipse(0, 0, particleW, particleH);
      buffer.pop();
    }
  }

  displayTrailHistory() {
    // Draw fading trail showing recent path
    noFill();

    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];

      // Skip if positions are far apart (wrapped)
      if (dist(prev.x, prev.y, curr.x, curr.y) > 50) continue;

      const alpha = map(i, 0, this.history.length, 0, 120);
      const weight = map(i, 0, this.history.length, 0.5, 2.5);

      // Tinted stroke
      stroke(
        this.colorTint.r,
        this.colorTint.g,
        this.colorTint.b,
        alpha
      );
      strokeWeight(weight);
      line(prev.x, prev.y, curr.x, curr.y);
    }
  }

  display() {
    noStroke();

    // Outer glow layers
    for (let i = 4; i > 0; i--) {
      const glowSize = this.size + i * 6;
      const glowAlpha = map(i, 4, 0, 10, 40);
      fill(this.colorTint.r, this.colorTint.g, this.colorTint.b, glowAlpha);
      ellipse(this.pos.x, this.pos.y, glowSize, glowSize);
    }

    // Main body with tint
    fill(this.colorTint.r, this.colorTint.g, this.colorTint.b, 200);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);

    // Bright core
    fill(255, 220);
    ellipse(this.pos.x, this.pos.y, this.size * 0.35, this.size * 0.35);

    // Tiny highlight
    fill(255, 255);
    ellipse(
      this.pos.x - this.size * 0.15,
      this.pos.y - this.size * 0.15,
      this.size * 0.15,
      this.size * 0.15
    );
  }
}
