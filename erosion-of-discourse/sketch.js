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
 *
 * Controls: Press Shift+S to start/stop GIF recording
 */

P5Capture.setDefaultOptions({
  format: 'gif',
  framerate: 30,
  quality: 0.8,
  width: 600,
});

const NUM_AGENTS = 7;
const GRID_SIZE = 40;
const CANVAS_SIZE = 600;
const TRAIL_HISTORY_LENGTH = 60;
const TRAIL_FADE_RATE = 1;

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
  fadeTrailLayer();

  for (const agent of agents) {
    agent.update();
    agent.drawTrail(trailLayer);
  }

  image(trailLayer, 0, 0);

  for (const agent of agents) {
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
  trailLayer.loadPixels();
  for (let i = 3; i < trailLayer.pixels.length; i += 4) {
    if (trailLayer.pixels[i] > 0) {
      trailLayer.pixels[i] = max(0, trailLayer.pixels[i] - TRAIL_FADE_RATE);
    }
  }
  trailLayer.updatePixels();
}

const PERSONALITIES = [
  { name: 'contemplative', speedMult: 0.5, noiseInc: 0.002, trailDensity: 75 },
  { name: 'restless', speedMult: 1.8, noiseInc: 0.008, trailDensity: 36 },
  { name: 'wanderer', speedMult: 1.0, noiseInc: 0.004, trailDensity: 54 },
  { name: 'drifter', speedMult: 0.7, noiseInc: 0.003, trailDensity: 66 },
];

class Agent {
  constructor(x, y, index) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);

    this.noiseOffsetX = random(1000);
    this.noiseOffsetY = random(1000);
    this.turbulenceOffset = random(1000);

    this.personality = PERSONALITIES[index % PERSONALITIES.length];
    this.baseSpeed = random(0.8, 1.4) * this.personality.speedMult;
    this.noiseIncrement = this.personality.noiseInc;
    this.baseTrailDensity = this.personality.trailDensity;

    this.size = random(10, 18);

    this.history = [];
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
    const angle = noise(this.noiseOffsetX, this.noiseOffsetY) * TWO_PI * 2;
    const speed = this.baseSpeed * map(noise(this.noiseOffsetX * 0.5), 0, 1, 0.5, 1.5);

    this.vel.set(cos(angle) * speed, sin(angle) * speed);
    this.pos.add(this.vel);
    this.wrapEdges();

    this.noiseOffsetX += this.noiseIncrement;
    this.noiseOffsetY += this.noiseIncrement * 1.1;
    this.turbulenceOffset += 0.01;

    const currentCell = this.getCurrentGridCell();
    if (currentCell.col === this.lastGridCell.col &&
        currentCell.row === this.lastGridCell.row) {
      this.lingerCounter = min(this.lingerCounter + 1, 100);
    } else {
      this.lingerCounter = max(this.lingerCounter - 2, 0);
      this.lastGridCell = currentCell;
    }

    this.history.push(createVector(this.pos.x, this.pos.y));
    if (this.history.length > TRAIL_HISTORY_LENGTH) {
      this.history.shift();
    }
  }

  wrapEdges() {
    if (this.pos.x < 0) {
      this.pos.x = width;
      this.history = [];
    }
    if (this.pos.x > width) {
      this.pos.x = 0;
      this.history = [];
    }
    if (this.pos.y < 0) {
      this.pos.y = height;
      this.history = [];
    }
    if (this.pos.y > height) {
      this.pos.y = 0;
      this.history = [];
    }
  }

  drawTrail(buffer) {
    buffer.noStroke();

    const currentSpeed = this.vel.mag();
    const speedFactor = map(currentSpeed, 0, 2, 1.5, 0.5);
    const lingerFactor = map(this.lingerCounter, 0, 100, 1, 2.5);
    const particleCount = floor(this.baseTrailDensity * speedFactor * lingerFactor);
    const moveAngle = this.vel.heading();

    for (let i = 0; i < particleCount; i++) {
      const turbulenceX = noise(this.turbulenceOffset + i * 0.1, this.pos.y * 0.01) * 2 - 1;
      const turbulenceY = noise(this.pos.x * 0.01, this.turbulenceOffset + i * 0.1) * 2 - 1;

      const alongDir = randomGaussian(0, this.size * 1.2);
      const perpDir = randomGaussian(0, this.size * 0.8);

      const offsetX = cos(moveAngle) * alongDir - sin(moveAngle) * perpDir + turbulenceX * 8;
      const offsetY = sin(moveAngle) * alongDir + cos(moveAngle) * perpDir + turbulenceY * 8;

      const gray = random(80, 180);
      const alpha = random(20, 60) * lingerFactor;

      buffer.fill(gray, gray, gray, alpha);

      const particleW = random(2, 6);
      const particleH = random(1.5, 4);

      buffer.push();
      buffer.translate(this.pos.x + offsetX, this.pos.y + offsetY);
      buffer.rotate(moveAngle + random(-0.3, 0.3));
      buffer.ellipse(0, 0, particleW, particleH);
      buffer.pop();
    }

    // Occasional larger smoke wisps
    if (random() < 0.3) {
      const wispX = this.pos.x + randomGaussian(0, this.size * 1.5);
      const wispY = this.pos.y + randomGaussian(0, this.size * 1.5);
      const wispGray = random(100, 160);
      const wispAlpha = random(10, 30);
      const wispSize = random(6, 12);

      buffer.fill(wispGray, wispGray, wispGray, wispAlpha);
      buffer.ellipse(wispX, wispY, wispSize, wispSize * 0.7);
    }
  }

  display() {
    fill(0);
    noStroke();

    // Head
    ellipse(this.pos.x, this.pos.y - 8, 5, 5);

    // Body
    rectMode(CENTER);
    rect(this.pos.x, this.pos.y - 2, 4, 10, 1);

    // Legs with walking animation
    const legOffset = sin(frameCount * 0.15 + this.noiseOffsetX) * 3;

    stroke(0);
    strokeWeight(2);

    // Left leg
    line(this.pos.x - 1, this.pos.y + 3, this.pos.x - 3 + legOffset, this.pos.y + 10);

    // Right leg
    line(this.pos.x + 1, this.pos.y + 3, this.pos.x + 3 - legOffset, this.pos.y + 10);

    // Arms with subtle swing
    const armOffset = sin(frameCount * 0.15 + this.noiseOffsetX + PI) * 2;

    strokeWeight(1.5);

    // Left arm
    line(this.pos.x - 2, this.pos.y - 4, this.pos.x - 4 + armOffset, this.pos.y + 1);

    // Right arm
    line(this.pos.x + 2, this.pos.y - 4, this.pos.x + 4 - armOffset, this.pos.y + 1);

    noStroke();
    rectMode(CORNER);
  }
}
