import * as THREE from 'three';

// First-person walk mode: WASD / arrow-key movement, pointer-lock or drag
// look, and tap-to-move — tap any spot on the grounds to stroll over to it.

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 5.4;
const RUN_FACTOR = 1.8;
const TAP_SPEED = 4.6;
const SITE_RADIUS = 118;

// Simple collision volumes: circles [x, z, r] and boxes [x1, z1, x2, z2].
const CIRCLES = [
  [0, 1, 14.6],      // clubhouse building
  [-8, 42, 3.9],     // west gatehouse
  [8, 42, 3.9],      // east gatehouse
  [-24, 33, 4.6],    // gazebo
];
const BOXES = [
  [-27.5, 40.6, -11, 43.4], // west boundary wall
  [11, 40.6, 27.5, 43.4],   // east boundary wall
];

function collide(x, z) {
  for (const [cx, cz, r] of CIRCLES) {
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.hypot(dx, dz);
    if (d < r && d > 1e-4) {
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    }
  }
  for (const [x1, z1, x2, z2] of BOXES) {
    if (x > x1 && x < x2 && z > z1 && z < z2) {
      const pushLeft = x - x1;
      const pushRight = x2 - x;
      const pushNear = z - z1;
      const pushFar = z2 - z;
      const min = Math.min(pushLeft, pushRight, pushNear, pushFar);
      if (min === pushLeft) x = x1;
      else if (min === pushRight) x = x2;
      else if (min === pushNear) z = z1;
      else z = z2;
    }
  }
  const dist = Math.hypot(x, z - 7);
  if (dist > SITE_RADIUS) {
    const s = SITE_RADIUS / dist;
    x *= s;
    z = 7 + (z - 7) * s;
  }
  return [x, z];
}

export function initWalkMode(app) {
  const { camera, renderer } = app;
  const canvas = renderer.domElement;
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();

  let yaw = 0;
  let pitch = -0.06;
  let pos = new THREE.Vector3(0, EYE_HEIGHT, 56);
  let tapTarget = null;
  let bobTime = 0;
  let moving = false;
  let dragging = false;
  let dragMoved = 0;
  let dragStart = 0;
  let lastTouch = null;
  let disposers = [];

  const hud = () => document.getElementById('walk-hud');

  function on(target, event, fn, options) {
    target.addEventListener(event, fn, options);
    disposers.push(() => target.removeEventListener(event, fn, options));
  }

  function look(deltaX, deltaY) {
    yaw -= deltaX * 0.0024;
    pitch = Math.max(-1.35, Math.min(1.35, pitch - deltaY * 0.0022));
  }

  function groundFromScreen(clientX, clientY) {
    const ndc = new THREE.Vector2(
      (clientX / innerWidth) * 2 - 1,
      -(clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(groundPlane, hitPoint) ? hitPoint : null;
  }

  function updateDebug() {
    window.__WALK__ = {
      mode: app.mode,
      position: [Number(pos.x.toFixed(2)), Number(pos.y.toFixed(2)), Number(pos.z.toFixed(2))],
      yaw: Number(yaw.toFixed(3)),
      moving,
    };
  }

  function enter() {
    keys.clear();
    tapTarget = null;
    // Spawn where the orbit camera was looking, pulled back to ground level.
    const target = app.controls.target.clone();
    const back = camera.position.clone().sub(target);
    back.y = 0;
    if (back.lengthSq() < 1e-4) back.set(0, 0, 1);
    back.normalize();
    pos.set(target.x + back.x * 15, EYE_HEIGHT, target.z + back.z * 15);
    [pos.x, pos.z] = collide(pos.x, pos.z);
    yaw = Math.atan2(back.x, back.z);
    pitch = -0.05;
    hud().hidden = false;
    document.getElementById('control-hint').hidden = true;

    on(document, 'keydown', (e) => {
      if (document.querySelector('dialog[open]')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { app.setMode('orbit'); return; }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift'].includes(k)) {
        keys.add(k);
        tapTarget = null;
        e.preventDefault();
      }
    });
    on(document, 'keyup', (e) => keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => keys.clear());

    on(canvas, 'click', () => {
      if (document.pointerLockElement !== canvas && matchMedia('(pointer: fine)').matches) {
        canvas.requestPointerLock();
      }
    });
    on(document, 'mousemove', (e) => {
      if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
    });

    // Drag to look; a short tap (or click while pointer-locked) walks there.
    on(canvas, 'pointerdown', (e) => {
      if (document.pointerLockElement === canvas) {
        const p = groundFromScreen(innerWidth / 2, innerHeight * 0.62);
        if (p) tapTarget = new THREE.Vector3(p.x, 0, p.z);
        return;
      }
      dragging = true;
      dragMoved = 0;
      dragStart = performance.now();
      lastTouch = { x: e.clientX, y: e.clientY };
    });
    on(window, 'pointermove', (e) => {
      if (!dragging || document.pointerLockElement === canvas) return;
      const dx = e.clientX - lastTouch.x;
      const dy = e.clientY - lastTouch.y;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      lastTouch = { x: e.clientX, y: e.clientY };
      look(dx * 1.6, dy * 1.6);
    });
    on(window, 'pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      const quick = performance.now() - dragStart < 300;
      if (quick && dragMoved < 12 && document.pointerLockElement !== canvas) {
        const p = groundFromScreen(e.clientX, e.clientY);
        if (p) tapTarget = new THREE.Vector3(p.x, 0, p.z);
      }
    });

    const hook = (dt) => {
      if (app.mode !== 'walk') return;
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const step = new THREE.Vector3();
      const run = keys.has('shift') ? RUN_FACTOR : 1;
      if (keys.has('w') || keys.has('arrowup')) step.add(forward);
      if (keys.has('s') || keys.has('arrowdown')) step.sub(forward);
      if (keys.has('d') || keys.has('arrowright')) step.add(right);
      if (keys.has('a') || keys.has('arrowleft')) step.sub(right);

      if (step.lengthSq() > 0) {
        step.normalize().multiplyScalar(WALK_SPEED * run * dt);
        tapTarget = null;
      } else if (tapTarget) {
        const to = new THREE.Vector3(tapTarget.x - pos.x, 0, tapTarget.z - pos.z);
        const d = to.length();
        if (d < 0.45) tapTarget = null;
        else {
          step.copy(to.normalize().multiplyScalar(Math.min(TAP_SPEED * dt, d)));
          yaw = Math.atan2(-to.x, -to.z);
        }
      }

      moving = step.lengthSq() > 1e-8;
      if (moving) {
        pos.x += step.x;
        pos.z += step.z;
        [pos.x, pos.z] = collide(pos.x, pos.z);
        bobTime += dt * (run > 1 ? 12.5 : 9.5);
      }
      const bob = moving && !app.reducedMotion ? Math.sin(bobTime) * 0.045 : 0;
      camera.position.set(pos.x, EYE_HEIGHT + bob, pos.z);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);
      updateDebug();
    };
    const removeHook = app.addFrameHook(hook);

    updateDebug();
    return function cleanup() {
      removeHook();
      disposers.forEach((fn) => fn());
      disposers = [];
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      hud().hidden = true;
      document.getElementById('control-hint').hidden = false;
      camera.rotation.set(0, 0, 0);
      window.__WALK__ = undefined;
    };
  }

  return enter;
}
