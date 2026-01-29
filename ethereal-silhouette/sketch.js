import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// CONFIGURATION
// ============================================================
const TEXTURE_SIZE = 256; // 65,536 particles
const BODY_PARTICLES = Math.floor(TEXTURE_SIZE * TEXTURE_SIZE * 0.55);
const HAIR_PARTICLES = 0; // Removed - didn't look like hair
const HALO_PARTICLES = Math.floor(TEXTURE_SIZE * TEXTURE_SIZE * 0.20); // Galaxy - increased
const RING_PARTICLES = Math.floor(TEXTURE_SIZE * TEXTURE_SIZE * 0.12);
const AURA_PARTICLES = Math.floor(TEXTURE_SIZE * TEXTURE_SIZE * 0.13);

// ============================================================
// CREATE HUMAN FIGURE FROM PRIMITIVES
// ============================================================
function createHumanFigure() {
  const geometries = [];

  // Helper to create and transform geometry
  const addGeometry = (geo, position, rotation, scale) => {
    const cloned = geo.clone();
    const matrix = new THREE.Matrix4();

    const pos = position || new THREE.Vector3();
    const rot = rotation || new THREE.Euler();
    const scl = scale || new THREE.Vector3(1, 1, 1);

    const quaternion = new THREE.Quaternion().setFromEuler(rot);
    matrix.compose(pos, quaternion, scl);
    cloned.applyMatrix4(matrix);

    // Remove UV attribute if exists (not needed, causes merge issues)
    if (cloned.getAttribute('uv')) {
      cloned.deleteAttribute('uv');
    }

    geometries.push(cloned);
  };

  // Head - sphere
  addGeometry(
    new THREE.SphereGeometry(0.32, 24, 24),
    new THREE.Vector3(0, 4.2, 0)
  );

  // Neck
  addGeometry(
    new THREE.CylinderGeometry(0.08, 0.1, 0.25, 12),
    new THREE.Vector3(0, 3.75, 0)
  );

  // Shoulders
  addGeometry(
    new THREE.CapsuleGeometry(0.12, 0.8, 8, 12),
    new THREE.Vector3(0, 3.5, 0),
    new THREE.Euler(0, 0, Math.PI / 2)
  );

  // Chest
  addGeometry(
    new THREE.CylinderGeometry(0.32, 0.25, 0.6, 16),
    new THREE.Vector3(0, 3.1, 0)
  );

  // Waist
  addGeometry(
    new THREE.CylinderGeometry(0.2, 0.28, 0.4, 16),
    new THREE.Vector3(0, 2.6, 0)
  );

  // Hips
  addGeometry(
    new THREE.SphereGeometry(0.3, 16, 12),
    new THREE.Vector3(0, 2.3, 0),
    new THREE.Euler(),
    new THREE.Vector3(1, 0.6, 0.7)
  );

  // Dress/Skirt - flared cone
  addGeometry(
    new THREE.CylinderGeometry(0.28, 0.65, 1.6, 20),
    new THREE.Vector3(0, 1.2, 0)
  );

  // Dress bottom frill
  addGeometry(
    new THREE.TorusGeometry(0.65, 0.08, 8, 24),
    new THREE.Vector3(0, 0.4, 0),
    new THREE.Euler(Math.PI / 2, 0, 0)
  );

  // Left upper arm
  addGeometry(
    new THREE.CapsuleGeometry(0.07, 0.5, 6, 10),
    new THREE.Vector3(-0.55, 3.25, 0),
    new THREE.Euler(0, 0, Math.PI / 5)
  );

  // Left lower arm
  addGeometry(
    new THREE.CapsuleGeometry(0.055, 0.45, 6, 10),
    new THREE.Vector3(-0.9, 2.7, 0.05),
    new THREE.Euler(0.2, 0, Math.PI / 3.5)
  );

  // Left hand
  addGeometry(
    new THREE.SphereGeometry(0.07, 10, 10),
    new THREE.Vector3(-1.15, 2.25, 0.1)
  );

  // Right upper arm
  addGeometry(
    new THREE.CapsuleGeometry(0.07, 0.5, 6, 10),
    new THREE.Vector3(0.55, 3.25, 0),
    new THREE.Euler(0, 0, -Math.PI / 5)
  );

  // Right lower arm
  addGeometry(
    new THREE.CapsuleGeometry(0.055, 0.45, 6, 10),
    new THREE.Vector3(0.9, 2.7, 0.05),
    new THREE.Euler(0.2, 0, -Math.PI / 3.5)
  );

  // Right hand
  addGeometry(
    new THREE.SphereGeometry(0.07, 10, 10),
    new THREE.Vector3(1.15, 2.25, 0.1)
  );

  // Merge all geometries
  const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
  const material = new THREE.MeshBasicMaterial();

  return new THREE.Mesh(mergedGeometry, material);
}

// ============================================================
// PARTICLE POSITION GENERATORS
// ============================================================

// Spiral hair particles emanating from head - positioned relative to model
function generateHairParticle(index, headY = 4.0) {
  const numSpirals = 5;
  const spiralIndex = index % numSpirals;
  const t = (index / HAIR_PARTICLES) * 1.5; // 0 to 1.5

  const baseAngle = (spiralIndex / numSpirals) * Math.PI * 2;
  const spiralTurns = 2.5;
  const angle = baseAngle + t * spiralTurns * Math.PI * 2;

  // Start at top of head, spiral outward and upward
  const startY = headY + 0.3;
  const radius = 0.15 + t * 0.6;
  const height = t * 1.2;

  // Add some randomness
  const randR = (Math.random() - 0.5) * 0.1;
  const randY = (Math.random() - 0.5) * 0.08;

  return {
    x: Math.cos(angle) * (radius + randR),
    y: startY + height + randY,
    z: Math.sin(angle) * (radius + randR) * 0.7
  };
}

// Galaxy spiral halo above head - logarithmic spiral arms
function generateHaloParticle(index, headY = 4.0) {
  const t = index / HALO_PARTICLES;

  // Two spiral arms
  const numArms = 2;
  const armIndex = index % numArms;
  const armBaseAngle = (armIndex / numArms) * Math.PI * 2;

  // Logarithmic spiral: r increases with angle
  const maxRadius = 1.2;
  const theta = t * Math.PI * 6; // 3 rotations per arm
  const r = 0.1 + t * maxRadius;

  // Spiral twist
  const spiralTightness = 2.5;
  const angle = armBaseAngle + theta + r * spiralTightness;

  // More scatter near center (denser), less at edges
  const scatter = (1 - t * 0.7) * 0.12;

  return {
    x: Math.cos(angle) * r + (Math.random() - 0.5) * scatter,
    y: headY + 1.5 + (Math.random() - 0.5) * 0.08, // Flat disk above head
    z: Math.sin(angle) * r * 0.5 + (Math.random() - 0.5) * scatter
  };
}

// Orbital rings around chest/heart area
function generateRingParticle(index, chestY = 2.8) {
  const numRings = 3;
  const ringIndex = index % numRings;
  const particlesPerRing = RING_PARTICLES / numRings;
  const t = (index % particlesPerRing) / particlesPerRing;

  const angle = t * Math.PI * 2;

  // Rings at different heights around torso
  const ringConfigs = [
    { radius: 0.5, y: chestY + 0.3, tiltX: 0.2, tiltZ: 0.1 },  // Upper chest
    { radius: 0.6, y: chestY, tiltX: -0.15, tiltZ: 0.2 },      // Heart level
    { radius: 0.55, y: chestY - 0.3, tiltX: 0.1, tiltZ: -0.15 } // Lower chest
  ];

  const config = ringConfigs[ringIndex];
  const radius = config.radius + (Math.random() - 0.5) * 0.03;

  return {
    x: Math.cos(angle) * radius,
    y: config.y + Math.sin(angle) * radius * config.tiltX + (Math.random() - 0.5) * 0.03,
    z: Math.sin(angle) * radius * 0.5 + Math.cos(angle) * radius * config.tiltZ + (Math.random() - 0.5) * 0.03
  };
}

// Aura particles scattered around
function generateAuraParticle() {
  const angle = Math.random() * Math.PI * 2;
  const height = Math.random() * 5;
  const radius = 1.5 + Math.random() * 2;

  return {
    x: Math.cos(angle) * radius,
    y: height,
    z: Math.sin(angle) * radius * 0.8
  };
}

// ============================================================
// GLSL SHADERS
// ============================================================

const positionSimulationFragmentShader = `
  precision highp float;

  uniform sampler2D uCurrentPosition;
  uniform sampler2D uOriginalPosition;
  uniform float uTime;
  uniform float uBass;
  uniform float uMids;
  uniform float uHighs;
  uniform float uModelHeight;

  varying vec2 vUv;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec4 currentPos = texture2D(uCurrentPosition, vUv);
    vec4 originalPos = texture2D(uOriginalPosition, vUv);

    vec3 pos = currentPos.xyz;
    vec3 origin = originalPos.xyz;
    float particleType = originalPos.w; // 0=body, 1=hair, 2=halo, 3=ring, 4=aura

    // Normalized height (0 = feet, 1 = head)
    float heightNorm = origin.y / uModelHeight;

    // Chest/heart position (around 65% height)
    float chestY = uModelHeight * 0.65;
    float distFromChest = abs(origin.y - chestY);

    // === BODY PARTICLES: Shape stays stable, only tiny shimmer for life ===
    if (particleType < 0.5) {
      // Only tiny shimmer, no expansion
      float shimmer = noise(origin * 10.0 + uTime * 2.0) - 0.5;
      pos += vec3(shimmer) * 0.005;
    }

    // === HALO/GALAXY: Slow gentle rotation ===
    else if (particleType < 2.5) {
      float haloAngle = atan(origin.z, origin.x) + uTime * 0.2;
      float haloR = length(vec2(origin.x, origin.z));

      pos.x = cos(haloAngle) * haloR;
      pos.z = sin(haloAngle) * haloR;

      // Gentle bob
      pos.y = origin.y + sin(uTime * 0.8) * 0.02;
    }

    // === RINGS: Steady orbit, slightly faster with bass ===
    else if (particleType < 3.5) {
      float ringSpeed = 0.5 + uBass * 0.3;
      float ringAngle = atan(origin.z, origin.x) + uTime * ringSpeed;
      float ringR = length(vec2(origin.x, origin.z));

      pos.x = cos(ringAngle) * ringR;
      pos.z = sin(ringAngle) * ringR * 0.5;
      pos.y = origin.y + sin(ringAngle * 2.0) * 0.03;
    }

    // === AURA: Gentle ambient float ===
    else {
      pos.x += sin(uTime * 0.3 + origin.y) * 0.03;
      pos.z += cos(uTime * 0.25 + origin.x) * 0.03;
      pos.y += sin(uTime * 0.2 + origin.z) * 0.02;
    }

    // Spring back toward original (keeps shape stable)
    vec3 toOrigin = origin - pos;
    pos += toOrigin * 0.08;

    // Very subtle ambient breathing for all
    pos.y += sin(uTime * 0.5) * 0.01;

    gl_FragColor = vec4(pos, particleType);
  }
`;

const positionSimulationVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const particleVertexShader = `
  uniform sampler2D uPositionTexture;
  uniform float uTime;
  uniform float uBass;
  uniform float uMids;
  uniform float uHighs;

  attribute vec2 aReference;

  varying float vHeight;
  varying float vEnergy;
  varying float vType;
  varying vec3 vPosition;

  void main() {
    vec4 posData = texture2D(uPositionTexture, aReference);
    vec3 pos = posData.xyz;
    vType = posData.w;
    vPosition = pos;

    vHeight = pos.y / 6.0;
    vEnergy = (uBass + uMids + uHighs) / 3.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Size varies by type
    float baseSize = 1.2; // Body default
    if (vType > 0.5 && vType < 2.5) baseSize = 1.4; // Halo/Galaxy
    if (vType > 2.5 && vType < 3.5) baseSize = 2.2; // Rings
    if (vType > 3.5) baseSize = 0.8; // Aura

    float audioBonus = vEnergy * 1.0;
    float size = baseSize + audioBonus;

    gl_PointSize = size * (55.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  uniform float uBass;
  uniform float uMids;
  uniform float uHighs;
  uniform float uTime;
  uniform float uModelHeight;

  varying float vHeight;
  varying float vEnergy;
  varying float vType;
  varying vec3 vPosition;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.1, 0.5, dist);

    vec3 color;

    // Warm color palette
    vec3 baseColor = vec3(1.0, 0.92, 0.78);    // Warm cream
    vec3 heartColor = vec3(1.0, 0.75, 0.8);    // Soft pink for bass pulse
    vec3 waveColor = vec3(1.0, 0.88, 0.65);    // Golden for mids wave
    vec3 sparkleColor = vec3(1.0, 0.95, 0.9);  // Warm white for highs

    // === BODY PARTICLES: Color responds to music, shape stays stable ===
    if (vType < 0.5) {
      // Bass: pink pulse from heart (65% height)
      float heartDist = abs(vHeight - 0.65);
      float bassPulse = (1.0 - smoothstep(0.0, 0.35, heartDist)) * uBass;

      // Mids: golden wave flowing up
      float wave = sin(vHeight * 6.0 - uTime * 2.5) * 0.5 + 0.5;
      float midsWave = wave * uMids;

      // Highs: sparkle at extremities
      float extremity = max(1.0 - vHeight, vHeight * 0.7);
      float sparkle = uHighs * extremity;

      // Blend colors
      color = baseColor;
      color = mix(color, heartColor, bassPulse * 0.5);
      color = mix(color, waveColor, midsWave * 0.3);
      color += sparkleColor * sparkle * 0.25;

      // Overall brightness boost with energy
      color *= (0.7 + vEnergy * 0.3);
    }

    // === HALO/GALAXY: Vivid pink center fading to gold ===
    else if (vType < 2.5) {
      // Use distance from center for color blend
      float galaxyDist = length(vec2(vPosition.x, vPosition.z));
      vec3 galaxyCenter = vec3(1.0, 0.4, 0.6);   // Center: vivid pink/magenta
      vec3 galaxyOuter = vec3(1.0, 0.85, 0.5);   // Outer: warm golden
      color = mix(galaxyCenter, galaxyOuter, smoothstep(0.0, 0.8, galaxyDist));
      // Pulse with mids
      color += vec3(0.15, 0.1, 0.1) * uMids;
      color *= (0.85 + vEnergy * 0.25);
    }

    // === RINGS: Bright gold ===
    else if (vType < 3.5) {
      vec3 ringColor = vec3(1.0, 0.9, 0.55);
      color = ringColor;
      // Intensify with bass
      color += vec3(0.15, 0.1, 0.0) * uBass;
      color *= (0.9 + uBass * 0.4);
    }

    // === AURA: Warm subtle glow ===
    else {
      color = vec3(1.0, 0.85, 0.7);
      color += vec3(uBass * 0.05, uMids * 0.05, uHighs * 0.03);
      color *= 0.5;
    }

    // Alpha varies by type
    float baseAlpha = 0.15;
    if (vType < 0.5) baseAlpha = 0.18; // Body
    else if (vType < 2.5) baseAlpha = 0.35; // Halo/Galaxy - more visible
    else if (vType < 3.5) baseAlpha = 0.45; // Rings - bright
    else baseAlpha = 0.06; // Aura - very subtle

    gl_FragColor = vec4(color, alpha * baseAlpha);
  }
`;

const gridVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const gridFragmentShader = `
  uniform float uTime;
  uniform float uBass;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vec2 pos = vWorldPos.xz;

    // Grid lines
    float gridSize = 0.5;
    vec2 grid = abs(fract(pos / gridSize - 0.5) - 0.5) / fwidth(pos / gridSize);
    float line = min(grid.x, grid.y);
    float gridAlpha = 1.0 - min(line, 1.0);

    // Circular rings
    float dist = length(pos);
    float rings = sin(dist * 3.0 - uTime * 2.0) * 0.5 + 0.5;
    rings *= uBass * 0.6;

    // Fade with distance
    float fade = 1.0 - smoothstep(0.0, 8.0, dist);

    float alpha = (gridAlpha * 0.25 + rings * 0.3) * fade;
    vec3 color = vec3(0.4, 0.35, 0.3) + vec3(0.3, 0.2, 0.1) * uBass;

    gl_FragColor = vec4(color, alpha * 0.7);
  }
`;

// ============================================================
// AUDIO ANALYZER
// ============================================================
class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.source = null;
    this.audioElement = null;
    this.bass = 0;
    this.mids = 0;
    this.highs = 0;
    this.smoothing = 0.85;
  }

  init() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.connect(this.audioContext.destination);
  }

  async connectMicrophone() {
    this.init();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.source) this.source.disconnect();
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      this.analyser.disconnect();
      return true;
    } catch (err) {
      console.error('Microphone access denied:', err);
      return false;
    }
  }

  connectAudioElement(audioElement) {
    this.init();
    if (this.source) this.source.disconnect();
    this.audioElement = audioElement;
    this.source = this.audioContext.createMediaElementSource(audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  update() {
    if (!this.analyser) return;
    this.analyser.getByteFrequencyData(this.dataArray);

    const len = this.dataArray.length;
    const bassEnd = Math.floor(len * 0.1);
    const midsEnd = Math.floor(len * 0.5);

    let bassSum = 0, midsSum = 0, highsSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += this.dataArray[i];
    for (let i = bassEnd; i < midsEnd; i++) midsSum += this.dataArray[i];
    for (let i = midsEnd; i < len; i++) highsSum += this.dataArray[i];

    const bassAvg = bassSum / bassEnd / 255;
    const midsAvg = midsSum / (midsEnd - bassEnd) / 255;
    const highsAvg = highsSum / (len - midsEnd) / 255;

    this.bass = this.bass * this.smoothing + bassAvg * (1 - this.smoothing);
    this.mids = this.mids * this.smoothing + midsAvg * (1 - this.smoothing);
    this.highs = this.highs * this.smoothing + highsAvg * (1 - this.smoothing);
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

// ============================================================
// MAIN APPLICATION
// ============================================================

const container = document.getElementById('container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3.5, 9);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

const audioAnalyzer = new AudioAnalyzer();

// ============================================================
// CREATE INITIAL POSITION TEXTURE
// ============================================================

// Load external GLB model
async function loadModel(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        // Find all meshes and merge them
        const geometries = [];
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            const geo = child.geometry.clone();
            child.updateMatrixWorld(true);
            geo.applyMatrix4(child.matrixWorld);
            // Remove unnecessary attributes
            if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
            if (geo.getAttribute('uv2')) geo.deleteAttribute('uv2');
            geometries.push(geo);
          }
        });

        if (geometries.length > 0) {
          const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
          resolve(new THREE.Mesh(merged, new THREE.MeshBasicMaterial()));
        } else {
          reject(new Error('No meshes found in model'));
        }
      },
      undefined,
      (error) => reject(error)
    );
  });
}

async function createInitialPositionTexture() {
  const data = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

  // Try to load external model, fallback to primitives
  let humanFigure;
  try {
    // Try loading model.glb from same directory
    humanFigure = await loadModel('./model.glb');
    console.log('Loaded external model');

    // Center and scale the model
    const box = new THREE.Box3().setFromObject(humanFigure);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4.0 / maxDim; // Scale to ~4 units tall

    humanFigure.geometry.translate(-center.x, -box.min.y, -center.z);
    humanFigure.geometry.scale(scale, scale, scale);
  } catch (e) {
    console.log('No external model found, using primitives:', e.message);
    humanFigure = createHumanFigure();
  }

  // Get model dimensions for positioning effects
  const box = new THREE.Box3().setFromObject(humanFigure);
  const modelHeight = box.max.y - box.min.y;
  const headY = box.max.y;
  const chestY = box.min.y + modelHeight * 0.65; // ~65% up is chest

  const sampler = new MeshSurfaceSampler(humanFigure).build();
  const tempPos = new THREE.Vector3();

  let idx = 0;

  // Body particles from mesh surface (55%)
  for (let i = 0; i < BODY_PARTICLES && idx < TEXTURE_SIZE * TEXTURE_SIZE; i++) {
    sampler.sample(tempPos);
    data[idx * 4 + 0] = tempPos.x;
    data[idx * 4 + 1] = tempPos.y;
    data[idx * 4 + 2] = tempPos.z;
    data[idx * 4 + 3] = 0.0; // Type: body
    idx++;
  }

  // Hair particles - positioned above head (15%)
  for (let i = 0; i < HAIR_PARTICLES && idx < TEXTURE_SIZE * TEXTURE_SIZE; i++) {
    const pos = generateHairParticle(i, headY);
    data[idx * 4 + 0] = pos.x;
    data[idx * 4 + 1] = pos.y;
    data[idx * 4 + 2] = pos.z;
    data[idx * 4 + 3] = 1.0; // Type: hair
    idx++;
  }

  // Halo/galaxy particles - centered above head (10%)
  for (let i = 0; i < HALO_PARTICLES && idx < TEXTURE_SIZE * TEXTURE_SIZE; i++) {
    const pos = generateHaloParticle(i, headY);
    data[idx * 4 + 0] = pos.x;
    data[idx * 4 + 1] = pos.y;
    data[idx * 4 + 2] = pos.z;
    data[idx * 4 + 3] = 2.0; // Type: halo
    idx++;
  }

  // Ring particles - around chest (10%)
  for (let i = 0; i < RING_PARTICLES && idx < TEXTURE_SIZE * TEXTURE_SIZE; i++) {
    const pos = generateRingParticle(i, chestY);
    data[idx * 4 + 0] = pos.x;
    data[idx * 4 + 1] = pos.y;
    data[idx * 4 + 2] = pos.z;
    data[idx * 4 + 3] = 3.0; // Type: ring
    idx++;
  }

  // Aura particles - scattered around (10%)
  while (idx < TEXTURE_SIZE * TEXTURE_SIZE) {
    const pos = generateAuraParticle();
    data[idx * 4 + 0] = pos.x;
    data[idx * 4 + 1] = pos.y;
    data[idx * 4 + 2] = pos.z;
    data[idx * 4 + 3] = 4.0; // Type: aura
    idx++;
  }

  const texture = new THREE.DataTexture(
    data, TEXTURE_SIZE, TEXTURE_SIZE,
    THREE.RGBAFormat, THREE.FloatType
  );
  texture.needsUpdate = true;
  return { texture, modelHeight };
}

// ============================================================
// SETUP AND ANIMATION
// ============================================================

let currentPosRT, nextPosRT, originalPositionTexture;
let simulationMaterial, particleMaterial, gridMaterial;
let particles, simulationScene, simulationQuad;
let modelHeight = 4.0; // Will be set from loaded model
const initCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

async function init() {
  const result = await createInitialPositionTexture();
  originalPositionTexture = result.texture;
  modelHeight = result.modelHeight;

  // Render targets
  const createRT = () => new THREE.WebGLRenderTarget(TEXTURE_SIZE, TEXTURE_SIZE, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType
  });

  currentPosRT = createRT();
  nextPosRT = createRT();

  // Initialize with original positions
  const initScene = new THREE.Scene();
  const initMat = new THREE.MeshBasicMaterial({ map: originalPositionTexture });
  const initQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), initMat);
  initScene.add(initQuad);
  renderer.setRenderTarget(currentPosRT);
  renderer.render(initScene, initCamera);
  renderer.setRenderTarget(null);

  // Simulation material
  simulationMaterial = new THREE.ShaderMaterial({
    vertexShader: positionSimulationVertexShader,
    fragmentShader: positionSimulationFragmentShader,
    uniforms: {
      uCurrentPosition: { value: null },
      uOriginalPosition: { value: originalPositionTexture },
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMids: { value: 0 },
      uHighs: { value: 0 },
      uModelHeight: { value: modelHeight }
    }
  });

  simulationScene = new THREE.Scene();
  simulationQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simulationMaterial);
  simulationScene.add(simulationQuad);

  // Particle geometry
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 3);
  const references = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 2);

  for (let i = 0; i < TEXTURE_SIZE; i++) {
    for (let j = 0; j < TEXTURE_SIZE; j++) {
      const idx = i * TEXTURE_SIZE + j;
      positions[idx * 3] = 0;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = 0;
      references[idx * 2] = j / TEXTURE_SIZE + 0.5 / TEXTURE_SIZE;
      references[idx * 2 + 1] = i / TEXTURE_SIZE + 0.5 / TEXTURE_SIZE;
    }
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('aReference', new THREE.BufferAttribute(references, 2));

  // Particle material
  particleMaterial = new THREE.ShaderMaterial({
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    uniforms: {
      uPositionTexture: { value: null },
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMids: { value: 0 },
      uHighs: { value: 0 },
      uModelHeight: { value: modelHeight }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // Grid floor
  const gridGeometry = new THREE.PlaneGeometry(16, 16);
  gridMaterial = new THREE.ShaderMaterial({
    vertexShader: gridVertexShader,
    fragmentShader: gridFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 }
    },
    transparent: true,
    side: THREE.DoubleSide
  });

  const grid = new THREE.Mesh(gridGeometry, gridMaterial);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0;
  scene.add(grid);

  // Post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.5,   // strength
    0.25,  // radius
    0.8    // threshold
  ));

  // Animation
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    audioAnalyzer.update();
    const { bass, mids, highs } = audioAnalyzer;

    // Update simulation
    simulationMaterial.uniforms.uCurrentPosition.value = currentPosRT.texture;
    simulationMaterial.uniforms.uTime.value = time;
    simulationMaterial.uniforms.uBass.value = bass;
    simulationMaterial.uniforms.uMids.value = mids;
    simulationMaterial.uniforms.uHighs.value = highs;

    renderer.setRenderTarget(nextPosRT);
    renderer.render(simulationScene, initCamera);
    renderer.setRenderTarget(null);

    // Swap
    [currentPosRT, nextPosRT] = [nextPosRT, currentPosRT];

    // Update particles
    particleMaterial.uniforms.uPositionTexture.value = currentPosRT.texture;
    particleMaterial.uniforms.uTime.value = time;
    particleMaterial.uniforms.uBass.value = bass;
    particleMaterial.uniforms.uMids.value = mids;
    particleMaterial.uniforms.uHighs.value = highs;

    // Update grid
    gridMaterial.uniforms.uTime.value = time;
    gridMaterial.uniforms.uBass.value = bass;

    controls.update();
    composer.render();
  }

  animate();
}

init();

// ============================================================
// UI CONTROLS
// ============================================================

const loadBtn = document.getElementById('load-btn');
const micBtn = document.getElementById('mic-btn');
const playBtn = document.getElementById('play-btn');
const fileInput = document.getElementById('file-input');
const audioInfo = document.getElementById('audio-info');

let audioElement = null;

loadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    if (audioElement) {
      audioElement.pause();
      audioElement.remove();
    }
    audioElement = document.createElement('audio');
    audioElement.src = URL.createObjectURL(file);
    audioElement.crossOrigin = 'anonymous';
    audioAnalyzer.connectAudioElement(audioElement);
    audioAnalyzer.resume();
    playBtn.style.display = 'block';
    playBtn.textContent = 'Play';
    audioInfo.textContent = `Loaded: ${file.name}`;
    micBtn.classList.remove('active');
  }
});

playBtn.addEventListener('click', () => {
  if (!audioElement) return;
  audioAnalyzer.resume();
  if (audioElement.paused) {
    audioElement.play();
    playBtn.textContent = 'Pause';
  } else {
    audioElement.pause();
    playBtn.textContent = 'Play';
  }
});

micBtn.addEventListener('click', async () => {
  if (micBtn.classList.contains('active')) {
    micBtn.classList.remove('active');
    audioInfo.textContent = 'Microphone disabled';
    return;
  }
  const success = await audioAnalyzer.connectMicrophone();
  if (success) {
    micBtn.classList.add('active');
    audioInfo.textContent = 'Microphone active';
    playBtn.style.display = 'none';
    if (audioElement) audioElement.pause();
  } else {
    audioInfo.textContent = 'Microphone access denied';
  }
});

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
