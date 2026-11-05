import { initQuietUI } from './quiet-ui.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initWalkMode } from './walk.js';
import { initGolfMode } from './golf.js';

const SEED = 20261030;
function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const host = document.getElementById('canvas-host');
const loadingScreen = document.getElementById('loading-screen');
const hotspotRoot = document.getElementById('hotspots');

const PHOTOS = {
  'clubhouse-front': { file: 'clubhouse-front.png', caption: 'Golf clubhouse · Front entrance', alt: 'Front exterior of the golf clubhouse with its pyramid roofs and flared columns' },
  'clubhouse-aerial': { file: 'clubhouse-aerial.png', caption: 'Golf clubhouse · Aerial roofscape', alt: 'Top-down aerial view of the golf clubhouse and practice green' },
  'clubhouse-side': { file: 'clubhouse-side.png', caption: 'Golf clubhouse · Garden elevation', alt: 'Side exterior of the golf clubhouse with glass windows and landscaping' },
  'clubhouse-overview': { file: 'clubhouse-overview.png', caption: 'Golf clubhouse · Resort context', alt: 'Elevated view of the golf clubhouse and surrounding grounds' },
  'front-gate': { file: 'front-gate.png', caption: 'Arrival · Dominic Utuk Street gate', alt: 'Aerial view of the resort front gate on Dominic Utuk Street' },
};

const VIEWS = {
  overview: {
    position: [48, 31, 58], target: [0, 4.5, 7],
    kicker: 'WELCOME TO AKWA IBOM', title: 'A tropical escape,<br>before you arrive.',
    description: 'Explore the arrival gate, distinctive golf clubhouse and landscaped grounds inspired by the resort’s latest reference photos.',
  },
  arrival: {
    position: [22, 11, 66], target: [0, 4.2, 42],
    kicker: 'DOMINIC UTUK STREET', title: 'Your escape<br>starts here.',
    description: 'A broad orange-roofed gateway and paired gatehouses create a memorable first impression, with palms lining the approach.',
  },
  clubhouse: {
    position: [29, 14, 29], target: [0, 5.4, 0],
    kicker: 'THE GOLF CLUBHOUSE', title: 'A landmark<br>with a warm welcome.',
    description: 'Octagonal pyramid roofs, stone-toned walls, glass fronts and a columned portico define the resort’s most distinctive gathering place.',
  },
  golf: {
    position: [58, 19, 13], target: [34, 2.2, -8],
    kicker: 'THE GOLF GROUNDS', title: 'Slow down.<br>Take in the green.',
    description: 'Look across the sculpted practice green and sandy bunker, framed by tropical planting and the clubhouse roofscape.',
  },
  aerial: {
    position: [10, 79, 50], target: [0, 0, 7],
    kicker: 'A DIFFERENT PERSPECTIVE', title: 'See how it all<br>comes together.',
    description: 'An elevated look at the arrival sequence, clubhouse, golf green and the garden spaces that connect the experience.',
  },
};

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
} catch (error) {
  loadingScreen.classList.add('loaded');
  document.getElementById('error-message').hidden = false;
  console.error('WebGL initialization failed', error);
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const day = {
  top: new THREE.Color(0x6fabc1), horizon: new THREE.Color(0xd8dfc5), fog: new THREE.Color(0xc8d4b9),
  sun: new THREE.Color(0xffefd1), ground: new THREE.Color(0x526c35), exposure: 1.08,
};
const sunset = {
  top: new THREE.Color(0x48536f), horizon: new THREE.Color(0xf3a267), fog: new THREE.Color(0xd59669),
  sun: new THREE.Color(0xffb36b), ground: new THREE.Color(0x354c36), exposure: 0.92,
};
scene.background = day.horizon.clone();
scene.fog = new THREE.Fog(day.fog.clone(), 105, 310);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 700);
camera.position.fromArray(VIEWS.overview.position);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.fromArray(VIEWS.overview.target);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 9;
controls.maxDistance = 125;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI * 0.475;
controls.panSpeed = 0.65;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.75;

const hemisphere = new THREE.HemisphereLight(0xcce4eb, 0x52603c, 2.1);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(day.sun, 3.4);
sun.position.set(-38, 58, 34);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -78;
sun.shadow.camera.right = 78;
sun.shadow.camera.top = 78;
sun.shadow.camera.bottom = -78;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 180;
sun.shadow.normalBias = 0.035;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xa9c9d8, 0.65);
fill.position.set(38, 22, -35);
scene.add(fill);

const skyUniforms = {
  topColor: { value: day.top.clone() },
  horizonColor: { value: day.horizon.clone() },
  sunColor: { value: new THREE.Color(0xffe5ad) },
  sunDirection: { value: new THREE.Vector3(-0.4, 0.55, 0.5).normalize() },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(360, 32, 18),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: `varying vec3 vWorld; void main(){ vec4 world = modelMatrix * vec4(position,1.0); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform vec3 sunDirection;
      varying vec3 vWorld;
      void main(){
        vec3 d = normalize(vWorld - cameraPosition);
        float h = max(d.y, 0.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.52));
        float sunDot = max(dot(d, sunDirection), 0.0);
        float disc = pow(sunDot, 850.0);
        float halo = pow(sunDot, 22.0) * 0.22 + pow(sunDot, 5.0) * 0.055;
        col += sunColor * (disc * 1.5 + halo);
        col = mix(horizonColor, col, smoothstep(-0.08, 0.025, d.y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }),
);
scene.add(sky);

const MAT = {
  grass: new THREE.MeshStandardMaterial({ color: 0x57763d, roughness: 1 }),
  lawn: new THREE.MeshStandardMaterial({ color: 0x6f9449, roughness: 1 }),
  green: new THREE.MeshStandardMaterial({ color: 0x79a64e, roughness: 0.95 }),
  greenInner: new THREE.MeshStandardMaterial({ color: 0x8ab75b, roughness: 0.95 }),
  road: new THREE.MeshStandardMaterial({ color: 0x4b504b, roughness: 0.92 }),
  paving: new THREE.MeshStandardMaterial({ color: 0x9d9c87, roughness: 0.9 }),
  path: new THREE.MeshStandardMaterial({ color: 0xc0b9a1, roughness: 0.95 }),
  curb: new THREE.MeshStandardMaterial({ color: 0xd9d2b9, roughness: 0.85 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xe2d5aa, roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x786348, roughness: 1 }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x315f35, roughness: 0.88, side: THREE.DoubleSide }),
  coconut: new THREE.MeshStandardMaterial({ color: 0x5e5d2c, roughness: 0.9 }),
  darkLeaf: new THREE.MeshStandardMaterial({ color: 0x355c38, roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x33433e, roughness: 0.65, metalness: 0.35 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xb84925, roughness: 0.76 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xc6bfa8, roughness: 0.85 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x79543b, roughness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8e2cd, roughness: 0.75 }),
};

function addBox(name, size, position, material, rotationY = 0, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(name, radii, height, position, material, sides = 16, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radii[0], radii[1], height, sides), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function pathBetween(name, a, b, width, material = MAT.path, y = 0.1) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  return addBox(name, [width, 0.14, length], [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], material, Math.atan2(dx, dz));
}

function organicDisc(name, center, radii, material, seedOffset = 0) {
  const localRand = mulberry32(SEED + seedOffset);
  const shape = new THREE.Shape();
  const count = 48;
  for (let i = 0; i <= count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const variation = 0.95 + localRand() * 0.08;
    const x = Math.cos(angle) * radii[0] * variation;
    const y = Math.sin(angle) * radii[1] * variation;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center[0], 0.11, center[1]);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Site surfaces: arrival axis, clubhouse court, golf green and connecting paths.
const ground = new THREE.Mesh(new THREE.CircleGeometry(390, 72).rotateX(-Math.PI / 2), MAT.grass);
ground.receiveShadow = true;
scene.add(ground);
addBox('Dominic_Utuk_approach', [15, 0.12, 172], [0, 0.015, 19], MAT.road);
addBox('West_road_walk', [2.2, 0.18, 172], [-8.7, 0.04, 19], MAT.paving);
addBox('East_road_walk', [2.2, 0.18, 172], [8.7, 0.04, 19], MAT.paving);
const court = new THREE.Mesh(new THREE.CircleGeometry(24, 64).rotateX(-Math.PI / 2), MAT.paving);
court.position.set(0, 0.07, 2);
court.receiveShadow = true;
scene.add(court);
const clubhouseLawn = new THREE.Mesh(new THREE.RingGeometry(24.4, 30, 64).rotateX(-Math.PI / 2), MAT.lawn);
clubhouseLawn.position.set(0, 0.075, 2);
clubhouseLawn.receiveShadow = true;
scene.add(clubhouseLawn);
organicDisc('Golf_outer_green', [35, -9], [23, 18], MAT.lawn, 11);
organicDisc('Golf_putting_surface', [35, -9], [15.5, 12], MAT.green, 12);
organicDisc('Golf_inner_surface', [32, -10], [9, 7], MAT.greenInner, 13);
organicDisc('Golf_bunker', [46, -5], [6.5, 3.1], MAT.sand, 14);
pathBetween('Clubhouse_to_golf', [15, 1], [29, -5], 3.2);
pathBetween('Garden_walk_west', [-18, 7], [-31, -10], 2.4);
pathBetween('Gate_garden_walk', [-12, 37], [-24, 33], 2.2);

// Low curbs make the roads and paths feel grounded.
for (const x of [-7.65, 7.65]) addBox('Road_curb', [0.28, 0.25, 172], [x, 0.09, 19], MAT.curb);
for (let z = -50; z <= 82; z += 12) {
  if (z > 34 && z < 50) continue;
  addBox('Road_center_dash', [0.13, 0.025, 4], [0, 0.09, z], MAT.white);
}

// The small polygonal garden pavilion visible near the arrival gate.
const gazebo = new THREE.Group();
gazebo.position.set(-24, 0, 33);
scene.add(gazebo);
addCylinder('Gazebo_base', [4.1, 4.1], 0.35, [0, 0.18, 0], MAT.stone, 8, gazebo);
for (let i = 0; i < 6; i += 1) {
  const a = (i / 6) * Math.PI * 2;
  addCylinder('Gazebo_post', [0.11, 0.14], 3.4, [Math.cos(a) * 3.25, 1.95, Math.sin(a) * 3.25], MAT.stone, 10, gazebo);
}
addCylinder('Gazebo_roof', [0, 4.6], 2.8, [0, 4.7, 0], MAT.orange, 6, gazebo);

// Golf flag and a restrained set of course details.
addCylinder('Golf_flagstick', [0.035, 0.035], 4.2, [33, 2.15, -10], MAT.white, 8);
const flagShape = new THREE.Shape().moveTo(0, 0).lineTo(1.7, -0.42).lineTo(0, -0.9).lineTo(0, 0);
const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), MAT.orange);
flag.position.set(33, 4.18, -10);
flag.rotation.y = -0.5;
scene.add(flag);

function makeFrondGeometry() {
  const positions = [];
  const indices = [];
  const segments = 16;
  // Central rachis.
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const y = Math.sin(t * Math.PI) * 0.11 - t * t * 0.28;
    const w = 0.012 * (1 - t * 0.7);
    positions.push(-w, y, t, w, y, t);
    if (i < segments) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  // Paired, tapered leaflets create a pinnate silhouette rather than a flat banana leaf.
  for (let i = 2; i < segments; i += 1) {
    const t = i / segments;
    const y = Math.sin(t * Math.PI) * 0.11 - t * t * 0.28;
    const width = Math.sin(Math.PI * t) * 0.25 * (1 - t * 0.25);
    const base = positions.length / 3;
    positions.push(0, y, t - 0.025, -width, y - 0.035, t + 0.065, 0, y, t + 0.055);
    positions.push(0, y, t - 0.025, width, y - 0.035, t + 0.065, 0, y, t + 0.055);
    indices.push(base, base + 1, base + 2, base + 3, base + 5, base + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const palmPositions = [];
for (let i = 0; i < 14; i += 1) {
  const z = 78 - i * 9.3;
  for (const side of [-1, 1]) {
    palmPositions.push({ x: side * (13 + rand() * 3.5), z: z + rand() * 2, h: 6.8 + rand() * 3.8 });
  }
}
for (let i = 0; i < 20; i += 1) {
  const a = (i / 20) * Math.PI * 2;
  const r = 28 + rand() * 5;
  const x = Math.cos(a) * r;
  const z = 2 + Math.sin(a) * r;
  if (Math.abs(x) < 12 && z > 0) continue;
  palmPositions.push({ x, z, h: 6 + rand() * 3.5 });
}
for (let i = 0; i < 13; i += 1) {
  const a = (i / 13) * Math.PI * 2;
  palmPositions.push({ x: 35 + Math.cos(a) * (23 + rand() * 4), z: -9 + Math.sin(a) * (19 + rand() * 3), h: 7 + rand() * 3 });
}

function buildPalms(points) {
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.38, 1, 7);
  const frondGeometry = makeFrondGeometry();
  const coconutGeometry = new THREE.SphereGeometry(0.25, 7, 5);
  const trunks = new THREE.InstancedMesh(trunkGeometry, MAT.trunk, points.length);
  const frondsPerTree = 9;
  const fronds = new THREE.InstancedMesh(frondGeometry, MAT.leaves, points.length * frondsPerTree);
  const coconuts = new THREE.InstancedMesh(coconutGeometry, MAT.coconut, points.length * 3);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  points.forEach((p, i) => {
    dummy.position.set(p.x, p.h / 2, p.z);
    dummy.rotation.set(0, rand() * Math.PI, (rand() - 0.5) * 0.045);
    dummy.scale.set(1, p.h, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < frondsPerTree; j += 1) {
      const index = i * frondsPerTree + j;
      const length = 3.7 + rand() * 1.8;
      dummy.position.set(p.x, p.h - 0.05 + rand() * 0.22, p.z);
      dummy.rotation.set(-0.12 + rand() * 0.35, (j / frondsPerTree) * Math.PI * 2 + rand() * 0.25, 0);
      dummy.scale.set(length, length, length);
      dummy.updateMatrix();
      fronds.setMatrixAt(index, dummy.matrix);
      color.setHSL(0.29 + rand() * 0.035, 0.38 + rand() * 0.16, 0.24 + rand() * 0.1);
      fronds.setColorAt(index, color);
    }
    for (let j = 0; j < 3; j += 1) {
      const a = (j / 3) * Math.PI * 2 + rand();
      dummy.position.set(p.x + Math.cos(a) * 0.36, p.h - 0.35, p.z + Math.sin(a) * 0.36);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      coconuts.setMatrixAt(i * 3 + j, dummy.matrix);
    }
  });
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  fronds.castShadow = true;
  fronds.receiveShadow = true;
  scene.add(trunks, fronds, coconuts);
}
buildPalms(palmPositions);

// Coarse distant vegetation supplies a fourth depth band beyond the detailed site.
const distantCount = 90;
const distantTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.5, 1, 6), MAT.trunk, distantCount);
const distantCrowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), MAT.darkLeaf, distantCount);
const treeDummy = new THREE.Object3D();
for (let i = 0; i < distantCount; i += 1) {
  const angle = rand() * Math.PI * 2;
  const radius = 68 + rand() * 120;
  const h = 4 + rand() * 5;
  const x = Math.cos(angle) * radius;
  const z = 4 + Math.sin(angle) * radius;
  treeDummy.position.set(x, h / 2, z);
  treeDummy.scale.set(1, h, 1);
  treeDummy.rotation.set(0, 0, 0);
  treeDummy.updateMatrix();
  distantTrunks.setMatrixAt(i, treeDummy.matrix);
  treeDummy.position.set(x, h + 1.2, z);
  treeDummy.scale.set(3 + rand() * 2.5, 2.7 + rand() * 2, 3 + rand() * 2.5);
  treeDummy.rotation.set(0, rand() * Math.PI, 0);
  treeDummy.updateMatrix();
  distantCrowns.setMatrixAt(i, treeDummy.matrix);
}
scene.add(distantTrunks, distantCrowns);

// Solar path lights, benches and low planting give the scene a human scale.
const lampPoints = [];
for (let i = 0; i < 12; i += 1) {
  const z = 72 - i * 11;
  lampPoints.push([-10.7, z], [10.7, z]);
}
const lampPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 3.8, 8), MAT.metal, lampPoints.length);
const lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.75, 0.12, 0.36), MAT.metal, lampPoints.length);
lampPoints.forEach((p, i) => {
  treeDummy.position.set(p[0], 1.9, p[1]); treeDummy.scale.set(1, 1, 1); treeDummy.rotation.set(0, 0, 0); treeDummy.updateMatrix(); lampPoles.setMatrixAt(i, treeDummy.matrix);
  treeDummy.position.set(p[0], 3.82, p[1]); treeDummy.rotation.set(0, p[0] < 0 ? 0.3 : -0.3, -0.15); treeDummy.updateMatrix(); lampHeads.setMatrixAt(i, treeDummy.matrix);
});
lampPoles.castShadow = true;
scene.add(lampPoles, lampHeads);

function addBench(x, z, rotation) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  addBox('Bench_seat', [2.3, 0.14, 0.65], [0, 0.75, 0], MAT.wood, 0, group);
  addBox('Bench_back', [2.3, 0.75, 0.12], [0, 1.12, 0.3], MAT.wood, 0, group);
  for (const px of [-0.85, 0.85]) addBox('Bench_leg', [0.12, 0.7, 0.5], [px, 0.38, 0], MAT.metal, 0, group);
  scene.add(group);
}
addBench(28, 8, -0.55);
addBench(44, 9, 0.4);
addBench(-27, -7, 0.8);
addBench(-23, 27, Math.PI);

const shrubCount = 60;
const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.65, 1), MAT.darkLeaf, shrubCount);
for (let i = 0; i < shrubCount; i += 1) {
  const side = i % 2 ? -1 : 1;
  const band = Math.floor(i / 2);
  const z = -17 + band * 1.55;
  treeDummy.position.set(side * (20 + rand() * 2), 0.6, z);
  treeDummy.scale.set(0.8 + rand() * 0.7, 0.7 + rand() * 0.6, 0.8 + rand() * 0.7);
  treeDummy.rotation.set(0, rand() * Math.PI, 0);
  treeDummy.updateMatrix();
  shrubs.setMatrixAt(i, treeDummy.matrix);
}
shrubs.castShadow = true;
scene.add(shrubs);

// Interface, camera choreography and accessible alternatives to canvas navigation.
// Mode system: orbit (default), first-person walk and golf share one camera.
// Modules register per-frame hooks and return cleanup functions on exit.
const frameHooks = [];
let appMode = 'orbit';
let modeCleanup = null;
const app = {
  scene, camera, renderer, controls, MAT, VIEWS,
  rand,
  reducedMotion,
  get mode() { return appMode; },
  get tourActive() { return tourActive; },
  endTourIfActive: () => { if (tourActive) endTour(); },
  moveToView: (name, instant) => moveToView(name, instant),
  getCurrentView: () => currentView,
  addFrameHook: (fn) => {
    frameHooks.push(fn);
    return () => {
      const i = frameHooks.indexOf(fn);
      if (i >= 0) frameHooks.splice(i, 1);
    };
  },
  setMode,
};
function setMode(next) {
  if (appMode === next) return;
  if (tourActive) endTour();
  if (modeCleanup) { modeCleanup(); modeCleanup = null; }
  cameraTween = null;
  appMode = next;
  document.body.dataset.mode = next;
  document.getElementById('walk-toggle').setAttribute('aria-pressed', String(next === 'walk'));
  document.getElementById('golf-toggle').setAttribute('aria-pressed', String(next === 'golf'));
  controls.enabled = next === 'orbit';
  if (next === 'orbit') moveToView(currentView, true);
  else if (next === 'walk') modeCleanup = enterWalkMode(app);
  else if (next === 'golf') modeCleanup = enterGolfMode(app);
}

let currentView = 'overview';
let cameraTween = null;
let tourActive = false;
let tourIndex = 0;
let tourTimer = null;
let lighting = 'day';
let scenePaused = false;
let simTime = 0;
const tourStops = ['arrival', 'clubhouse', 'golf', 'aerial'];
const tourToggle = document.getElementById('tour-toggle');
const tourProgress = document.getElementById('tour-progress');
const tempVector = new THREE.Vector3();
const tempProjected = new THREE.Vector3();
const hotspotPositions = {
  arrival: new THREE.Vector3(0, 8.5, 42),
  clubhouse: new THREE.Vector3(0, 16.3, 0),
  golf: new THREE.Vector3(35, 5.2, -9),
};
const hotspotElements = [...document.querySelectorAll('[data-hotspot]')];

function setViewUI(name) {
  const view = VIEWS[name];
  currentView = name;
  window.dispatchEvent(new Event('arise-view-change'));
  document.getElementById('place-kicker').textContent = view.kicker;
  document.getElementById('place-title').innerHTML = view.title;
  document.getElementById('place-description').textContent = view.description;
  document.querySelectorAll('.view-tab').forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function moveToView(name, instant = false) {
  if (!VIEWS[name]) return;
  setViewUI(name);
  const view = VIEWS[name];
  const endPosition = new THREE.Vector3().fromArray(view.position);
  const endTarget = new THREE.Vector3().fromArray(view.target);
  if (instant || reducedMotion) {
    camera.position.copy(endPosition);
    controls.target.copy(endTarget);
    controls.update();
    cameraTween = null;
  } else {
    cameraTween = {
      started: performance.now(), duration: 1750,
      startPosition: camera.position.clone(), startTarget: controls.target.clone(), endPosition, endTarget,
    };
  }
}

function endTour(completed = false) {
  tourActive = false;
  clearTimeout(tourTimer);
  tourProgress.hidden = true;
  tourToggle.querySelector('span').textContent = completed ? 'Replay guided tour' : 'Start guided tour';
  tourToggle.setAttribute('aria-pressed', 'false');
}

function scheduleTourStop() {
  clearTimeout(tourTimer);
  document.getElementById('tour-step').textContent = `Stop ${tourIndex + 1} of ${tourStops.length}`;
  document.getElementById('tour-next').innerHTML = tourIndex === tourStops.length - 1 ? 'Finish tour <span aria-hidden="true">→</span>' : 'Next stop <span aria-hidden="true">→</span>';
  tourTimer = setTimeout(() => {
    if (!tourActive) return;
    if (tourIndex >= tourStops.length - 1) endTour(true);
    else { tourIndex += 1; moveToView(tourStops[tourIndex]); scheduleTourStop(); }
  }, 7200);
}

function startTour() {
  tourActive = true;
  tourIndex = 0;
  tourProgress.hidden = false;
  tourToggle.querySelector('span').textContent = 'Pause guided tour';
  tourToggle.setAttribute('aria-pressed', 'true');
  moveToView(tourStops[tourIndex]);
  scheduleTourStop();
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    if (tourActive) endTour();
    moveToView(button.dataset.view);
  });
});
tourToggle.addEventListener('click', () => { if (tourActive) endTour(); else startTour(); });
document.getElementById('tour-next').addEventListener('click', () => {
  if (!tourActive) return;
  if (tourIndex >= tourStops.length - 1) { endTour(true); return; }
  tourIndex += 1;
  moveToView(tourStops[tourIndex]);
  scheduleTourStop();
});
controls.addEventListener('start', () => {
  cameraTween = null;
  if (tourActive) endTour();
});

function updateLighting(mode) {
  lighting = mode;
  const theme = mode === 'sunset' ? sunset : day;
  skyUniforms.topColor.value.copy(theme.top);
  skyUniforms.horizonColor.value.copy(theme.horizon);
  skyUniforms.sunColor.value.set(mode === 'sunset' ? 0xffa057 : 0xffe5ad);
  skyUniforms.sunDirection.value.set(mode === 'sunset' ? -0.75 : -0.4, mode === 'sunset' ? 0.16 : 0.55, 0.5).normalize();
  scene.background.copy(theme.horizon);
  scene.fog.color.copy(theme.fog);
  sun.color.copy(theme.sun);
  sun.intensity = mode === 'sunset' ? 2.5 : 3.4;
  sun.position.set(mode === 'sunset' ? -65 : -38, mode === 'sunset' ? 22 : 58, 34);
  hemisphere.intensity = mode === 'sunset' ? 1.35 : 2.1;
  hemisphere.groundColor.copy(theme.ground);
  renderer.toneMappingExposure = theme.exposure;
  const button = document.getElementById('lighting-toggle');
  button.setAttribute('aria-pressed', String(mode === 'sunset'));
  button.setAttribute('aria-label', mode === 'sunset' ? 'Switch to daylight lighting' : 'Switch to sunset lighting');
  document.getElementById('lighting-label').textContent = mode === 'sunset' ? 'Daylight' : 'Sunset';
}
document.getElementById('lighting-toggle').addEventListener('click', () => updateLighting(lighting === 'day' ? 'sunset' : 'day'));

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog.open) dialog.showModal();
}
document.getElementById('gallery-open').addEventListener('click', () => openDialog('gallery-dialog'));
document.getElementById('error-gallery').addEventListener('click', () => openDialog('gallery-dialog'));
document.getElementById('about-open').addEventListener('click', () => openDialog('about-dialog'));
document.getElementById('about-start').addEventListener('click', () => { document.getElementById('about-dialog').close(); startTour(); });
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));

document.querySelectorAll('.gallery-thumb').forEach((button, index) => {
  button.addEventListener('click', () => {
    const photo = PHOTOS[button.dataset.photo];
    const image = document.getElementById('gallery-image');
    image.src = `./photos/${photo.file}`;
    image.alt = photo.alt;
    document.getElementById('gallery-caption').textContent = photo.caption;
    document.getElementById('gallery-count').textContent = `${index + 1} / ${Object.keys(PHOTOS).length}`;
    document.querySelectorAll('.gallery-thumb').forEach((thumb) => {
      const active = thumb === button;
      thumb.classList.toggle('active', active);
      thumb.setAttribute('aria-pressed', String(active));
    });
  });
});

document.getElementById('fullscreen-toggle').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn('Fullscreen is not available in this browser', error);
  }
});
document.addEventListener('fullscreenchange', () => {
  document.getElementById('fullscreen-toggle').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
});
document.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (appMode !== 'orbit') return; // walk and golf modes own their keyboard input
  const names = ['overview', 'arrival', 'clubhouse', 'golf', 'aerial'];
  if (/^[1-5]$/.test(event.key)) { if (tourActive) endTour(); moveToView(names[Number(event.key) - 1]); }
  if (event.key.toLowerCase() === 'g') { if (tourActive) endTour(); else startTour(); }
});

function updateHotspots() {
  for (const element of hotspotElements) {
    const world = hotspotPositions[element.dataset.hotspot];
    tempProjected.copy(world).project(camera);
    const visible = tempProjected.z > -1 && tempProjected.z < 1 && Math.abs(tempProjected.x) < 0.94 && Math.abs(tempProjected.y) < 0.86;
    element.style.opacity = visible ? '1' : '0';
    element.style.pointerEvents = visible ? 'auto' : 'none';
    element.tabIndex = visible ? 0 : -1;
    if (visible) {
      element.style.left = `${(tempProjected.x * 0.5 + 0.5) * innerWidth}px`;
      element.style.top = `${(-tempProjected.y * 0.5 + 0.5) * innerHeight}px`;
    }
  }
}

let lastFrame = performance.now();
let fps = 60;
function renderFrame(now = performance.now()) {
  if (cameraTween && !scenePaused) {
    const progress = Math.min((now - cameraTween.started) / cameraTween.duration, 1);
    const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    camera.position.lerpVectors(cameraTween.startPosition, cameraTween.endPosition, eased);
    controls.target.lerpVectors(cameraTween.startTarget, cameraTween.endTarget, eased);
    if (progress >= 1) cameraTween = null;
  }
  if (appMode === 'orbit') controls.update(); // walk/golf modes own the camera
  renderer.render(scene, camera);
  updateHotspots();
  const dt = Math.max(now - lastFrame, 1);
  for (const fn of frameHooks) fn(Math.min(dt / 1000, 0.1));
  fps = fps * 0.92 + (1000 / dt) * 0.08;
  lastFrame = now;
  window.__RESORT_STATS__ = {
    fps: Math.round(fps), calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures, view: currentView, lighting, mode: appMode,
  };
}
renderer.setAnimationLoop((time) => {
  if (!scenePaused) {
    simTime += Math.min((time - lastFrame) / 1000, 0.1);
    renderFrame(time);
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (scenePaused) renderFrame();
});

window.__seek = (time) => {
  scenePaused = true;
  simTime = Number.isFinite(Number(time)) ? Number(time) : 0;
  cameraTween = null;
  renderFrame();
};
window.__play = () => { scenePaused = false; lastFrame = performance.now(); };

async function initialize() {
  try {
    const gltf = await new GLTFLoader().loadAsync('./models/resort-architecture.glb');
    gltf.scene.name = 'ARISE_reference_architecture';
    gltf.scene.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material) {
          object.material.envMapIntensity = 0.65;
          object.material.needsUpdate = true;
        }
      }
    });
    scene.add(gltf.scene);
    controls.update();
    renderFrame();
    loadingScreen.classList.add('loaded');
    hotspotRoot.hidden = false;
    window.__SCENE_READY__ = true;
    window.dispatchEvent(new Event('arise-scene-ready'));
  } catch (error) {
    console.error('Resort architecture could not be loaded', error);
    loadingScreen.classList.add('loaded');
    document.getElementById('error-message').hidden = false;
    renderer.setAnimationLoop(null);
  }
}

// Mode entry points (buttons live in the topbar; Esc exits walk/golf modes).
const enterWalkMode = initWalkMode(app);
const enterGolfMode = initGolfMode(app);
document.getElementById('walk-toggle').addEventListener('click', () => {
  setMode(appMode === 'walk' ? 'orbit' : 'walk');
});
document.getElementById('golf-toggle').addEventListener('click', () => {
  setMode(appMode === 'golf' ? 'orbit' : 'golf');
});
document.querySelectorAll('.view-tab, .map-pin, .hotspot').forEach((el) => {
  el.addEventListener('click', () => { if (appMode !== 'orbit') setMode('orbit'); }, true);
});

const timeParam = new URLSearchParams(location.search).get('t');
if (timeParam !== null) window.__seek(timeParam);
initQuietUI();
initialize();
