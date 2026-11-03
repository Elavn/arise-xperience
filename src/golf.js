import * as THREE from 'three';

// First-person golf on the practice green: pick a club, aim, hold to charge
// the swing, and play the ball as it lies until you hole out at the flagstick.

const BALL_R = 0.21;
const GRAVITY = -22;
const TEE = new THREE.Vector3(23, BALL_R, -14);
const PIN = new THREE.Vector3(33, 0, -10);
const CUP_RADIUS = 0.42;

const CLUBS = {
  driver: { label: 'Driver', maxSpeed: 46, loft: 0.23, color: 0xb84925 },
  iron: { label: 'Iron', maxSpeed: 25, loft: 0.5, color: 0x9d9c87 },
  putter: { label: 'Putter', maxSpeed: 12.5, loft: 0.04, color: 0x33433e },
};

// Surface ellipses mirroring the landscaping in scene.js [cx, cz, rx, rz].
const SURFACES = [
  { name: 'putting', c: [32, -10], r: [9, 7], decel: 2.4 },
  { name: 'green', c: [35, -9], r: [15.5, 12], decel: 2.9 },
  { name: 'fringe', c: [35, -9], r: [23, 18], decel: 4.0 },
  { name: 'sand', c: [46, -5], r: [6.5, 3.1], decel: 16 },
];

function surfaceAt(x, z) {
  for (const s of SURFACES) {
    const dx = (x - s.c[0]) / s.r[0];
    const dz = (z - s.c[1]) / s.r[1];
    if (dx * dx + dz * dz <= 1) return s;
  }
  return { name: 'rough', decel: 7.0 };
}

function makeClub() {
  // Procedural club: grip, steel shaft and an angled head, pivoting at the hands.
  const pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ'; // pitch in the yawed local frame so the head leans toward the ball
  const club = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c0c4, roughness: 0.35, metalness: 0.85 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x22261f, roughness: 0.95 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x3c4340, roughness: 0.3, metalness: 0.8 });

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.34, 10), rubber);
  grip.position.y = -0.17;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 1.06, 10), steel);
  shaft.position.y = -0.86;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.13), headMat);
  head.position.set(0.1, -1.42, 0.02);
  head.rotation.y = -0.22;
  const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.09, 8), steel);
  hosel.position.set(0.0, -1.37, 0);
  club.add(grip, shaft, head, hosel);
  club.rotation.z = 0.42; // natural address lean
  pivot.add(club);
  pivot.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return pivot;
}

function makeBall() {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xf5f3ea, roughness: 0.42 }),
  );
  ball.castShadow = true;
  return ball;
}

export function initGolfMode(app) {
  const { camera, renderer, scene } = app;
  const canvas = renderer.domElement;

  let built = false;
  let ball, cup, clubPivot, aimLine, trail, trailPositions, particles;
  let state = 'address'; // address | charging | swing | flight | rest | holed
  let strokes = 0;
  let clubKey = 'iron';
  let aimYaw = 0;
  let power = 0;
  let charging = false;
  let swingT = 0;
  let vel = new THREE.Vector3();
  let lastLie = TEE.clone();
  let disposers = [];
  let audio = null;
  let muted = false;
  try { muted = localStorage.getItem('arise-golf-mute') === '1'; } catch { /* ignore */ }

  const el = (id) => document.getElementById(id);

  function on(target, event, fn, options) {
    target.addEventListener(event, fn, options);
    disposers.push(() => target.removeEventListener(event, fn, options));
  }

  // --- audio: tiny synthesized kit, created on first user gesture ----------
  function ensureAudio() {
    if (audio) return;
    try {
      const ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctxAudio.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctxAudio.destination);
      audio = { ctx: ctxAudio, master };
    } catch { audio = null; }
  }
  function blip(freq, dur, type = 'square', gain = 0.5, sweepTo = 0) {
    if (!audio || muted) return;
    const { ctx, master } = audio;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }
  function noiseBurst(dur, gain = 0.4, freq = 900) {
    if (!audio || muted) return;
    const { ctx, master } = audio;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(master);
    src.start();
  }
  const sfx = {
    swing: () => noiseBurst(0.28, 0.35, 1400),
    strike: () => { blip(210, 0.07, 'square', 0.5); noiseBurst(0.05, 0.4, 2600); },
    bounce: () => blip(110, 0.05, 'triangle', 0.35),
    hole: () => { blip(660, 0.14, 'sine', 0.5); setTimeout(() => blip(990, 0.22, 'sine', 0.5), 130); },
    ob: () => blip(220, 0.3, 'sawtooth', 0.3, 110),
  };

  // --- one-time scene construction ------------------------------------------
  function build() {
    ball = makeBall();
    ball.position.copy(TEE);
    scene.add(ball);

    const cupGeo = new THREE.CircleGeometry(CUP_RADIUS, 24).rotateX(-Math.PI / 2);
    cup = new THREE.Mesh(cupGeo, new THREE.MeshBasicMaterial({ color: 0x10140f }));
    cup.position.set(PIN.x, 0.115, PIN.z);
    scene.add(cup);

    clubPivot = makeClub();
    scene.add(clubPivot);

    aimLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.85 }),
    );
    aimLine.frustumCulled = false;
    scene.add(aimLine);

    trailPositions = new Float32Array(3 * 90);
    trail = new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(trailPositions, 3)),
      new THREE.LineBasicMaterial({ color: 0xffe5ad, transparent: true, opacity: 0.65 }),
    );
    trail.frustumCulled = false;
    trail.visible = false;
    scene.add(trail);

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 14), 3));
    particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xfff3d6, size: 0.09, transparent: true }));
    particles.frustumCulled = false;
    particles.visible = false;
    particles.userData = { vel: [], life: 0 };
    scene.add(particles);
    built = true;
  }

  function burstParticles(origin) {
    const attr = particles.geometry.getAttribute('position');
    particles.userData.vel = [];
    for (let i = 0; i < attr.count; i += 1) {
      attr.setXYZ(i, origin.x, origin.y, origin.z);
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 2.5;
      particles.userData.vel.push([Math.cos(a) * s, 2 + Math.random() * 3, Math.sin(a) * s]);
    }
    attr.needsUpdate = true;
    particles.userData.life = 0.5;
    particles.visible = true;
  }

  // --- helpers ----------------------------------------------------------------
  const aimDir = () => new THREE.Vector3(-Math.sin(aimYaw), 0, -Math.cos(aimYaw));
  const distToPin = () => Math.hypot(ball.position.x - PIN.x, ball.position.z - PIN.z);

  function updateHud() {
    el('golf-strokes').textContent = `Stroke ${Math.max(strokes, 1)}`;
    el('golf-distance').textContent = `${(distToPin() * 1.3).toFixed(1)} m to the pin`;
    document.querySelectorAll('.golf-clubs [data-club]').forEach((b) => {
      b.classList.toggle('active', b.dataset.club === clubKey);
    });
  }

  function selectClub(key) {
    if (!CLUBS[key] || state === 'flight' || state === 'swing') return;
    clubKey = key;
    updateHud();
  }

  function banner(html, buttons = []) {
    const b = el('golf-banner');
    b.innerHTML = html;
    for (const { label, action, primary } of buttons) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = primary ? 'primary-button' : 'text-button';
      btn.addEventListener('click', action);
      b.appendChild(btn);
    }
    b.hidden = false;
  }

  function hideBanner() { el('golf-banner').hidden = true; }

  function setAimTowardPin() {
    const d = new THREE.Vector3().subVectors(PIN, ball.position);
    aimYaw = Math.atan2(-d.x, -d.z);
  }

  function restartHole() {
    ball.position.copy(TEE);
    lastLie.copy(TEE);
    vel.set(0, 0, 0);
    strokes = 0;
    state = 'address';
    hideBanner();
    setAimTowardPin();
    updateHud();
  }

  function startCharge() {
    if (state !== 'address' && state !== 'rest') return;
    state = 'charging';
    charging = true;
    power = 0;
    ensureAudio();
  }

  function releaseSwing() {
    if (!charging) return;
    charging = false;
    if (power < 0.04) { state = ballAtRest() ? 'rest' : 'address'; el('golf-power-fill').style.width = '0%'; return; }
    state = 'swing';
    swingT = 0;
    sfx.swing();
  }

  function ballAtRest() { return vel.lengthSq() < 1e-6; }

  function launch() {
    const club = CLUBS[clubKey];
    const dir = aimDir();
    const speed = club.maxSpeed * (0.25 + 0.75 * power);
    vel.set(dir.x * Math.cos(club.loft) * speed, Math.sin(club.loft) * speed, dir.z * Math.cos(club.loft) * speed);
    strokes += 1;
    state = 'flight';
    lastLie.copy(ball.position);
    trail.visible = true;
    for (let i = 0; i < trailPositions.length; i += 3) {
      trailPositions[i] = ball.position.x;
      trailPositions[i + 1] = ball.position.y;
      trailPositions[i + 2] = ball.position.z;
    }
    burstParticles(ball.position);
    sfx.strike();
    el('golf-power-fill').style.width = '0%';
    updateHud();
  }

  function holeOut() {
    state = 'holed';
    vel.set(0, 0, 0);
    sfx.hole();
    let best = null;
    try {
      best = Number(localStorage.getItem('arise-golf-best')) || null;
      if (!best || strokes < best) { localStorage.setItem('arise-golf-best', String(strokes)); best = strokes; }
    } catch { /* ignore */ }
    banner(
      `<strong>Holed out in ${strokes}!</strong><span>${best ? `Best round: ${best}` : ''}</span>`,
      [
        { label: 'Play again', primary: true, action: restartHole },
        { label: 'Keep exploring', action: () => app.setMode('orbit') },
      ],
    );
    updateHud();
  }

  function outOfBounds() {
    sfx.ob();
    strokes += 1;
    ball.position.copy(lastLie);
    vel.set(0, 0, 0);
    state = 'rest';
    setAimTowardPin();
    banner('<strong>Out of bounds</strong><span>One-stroke penalty — play it back from your last lie.</span>', [
      { label: 'Continue', primary: true, action: hideBanner },
    ]);
    updateHud();
  }

  function stepPhysics(dt) {
    if (state === 'holed') return;
    // Substep so large frame deltas (slow devices, background tabs) behave
    // like small ones — otherwise one gravity tick can exceed the bounce
    // threshold and the ball jitters on the spot instead of coming to rest.
    const steps = Math.max(1, Math.ceil(dt / 0.033));
    const h = dt / steps;
    for (let i = 0; i < steps && state === 'flight'; i += 1) stepPhysicsSub(h);
  }

  function stepPhysicsSub(dt) {
    // Cup capture first: there is no ground under the hole, so a slow ball
    // over the cup drops straight in (the floor clamp must not catch it).
    const dPin = distToPin();
    const hSpeed = Math.hypot(vel.x, vel.z);
    if (dPin < CUP_RADIUS && ball.position.y <= BALL_R + 0.08 && hSpeed < 4.2) {
      vel.set(0, 0, 0);
      ball.position.set(PIN.x, ball.position.y - 3 * dt, PIN.z);
      if (ball.position.y < -0.2) holeOut();
      return;
    }

    vel.y += GRAVITY * dt;
    ball.position.addScaledVector(vel, dt);

    const floor = BALL_R + 0.06;
    if (ball.position.y <= floor) {
      ball.position.y = floor;
      const surf = surfaceAt(ball.position.x, ball.position.z);
      if (vel.y < -1.3) {
        vel.y = -vel.y * 0.42;
        vel.x *= 0.86;
        vel.z *= 0.86;
        sfx.bounce();
      } else {
        vel.y = 0;
        const speed = Math.hypot(vel.x, vel.z);
        if (speed > 0) {
          const drop = surf.decel * dt;
          const next = Math.max(0, speed - drop);
          vel.x *= next / speed;
          vel.z *= next / speed;
          if (next < 0.07) { vel.x = 0; vel.z = 0; }
        }
      }
    }

    if (Math.hypot(ball.position.x - 35, ball.position.z + 9) > 68) { outOfBounds(); return; }

    if (vel.lengthSq() < 1e-6 && state === 'flight') {
      state = 'rest';
      setAimTowardPin();
      if (surfaceAt(ball.position.x, ball.position.z).name === 'putting') selectClub('putter');
      updateHud();
    }
  }

  function updateTrail() {
    if (!trail.visible) return;
    for (let i = trailPositions.length / 3 - 1; i > 0; i -= 1) {
      trailPositions[i * 3] = trailPositions[(i - 1) * 3];
      trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
      trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
    }
    trailPositions[0] = ball.position.x;
    trailPositions[1] = ball.position.y;
    trailPositions[2] = ball.position.z;
    trail.geometry.getAttribute('position').needsUpdate = true;
  }

  function updateCameraAndClub(dt) {
    const dir = aimDir();
    let eye, look;
    if (state === 'flight' || state === 'holed') {
      const flightDir = vel.lengthSq() > 0.2
        ? new THREE.Vector3(vel.x, 0, vel.z).normalize()
        : dir;
      eye = ball.position.clone().addScaledVector(flightDir, -4.2).add(new THREE.Vector3(0, 2.3, 0));
      look = ball.position.clone();
    } else {
      eye = ball.position.clone().addScaledVector(dir, -3.4).add(new THREE.Vector3(0, 1.9, 0));
      look = ball.position.clone().addScaledVector(dir, 5).add(new THREE.Vector3(0, -0.6, 0));
    }
    const k = state === 'flight' ? Math.min(1, dt * 5.5) : Math.min(1, dt * 9);
    camera.position.lerp(eye, k);
    camera.lookAt(look);

    // Club sits low-right of the view; swings on release.
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    clubPivot.position.copy(camera.position)
      .addScaledVector(camDir, 0.85)
      .addScaledVector(right, 0.34)
      .add(new THREE.Vector3(0, -0.24, 0));
    clubPivot.rotation.set(0, aimYaw + Math.PI - 0.35, 0);
    let swingAngle = 0;
    if (state === 'charging') swingAngle = -1.05 * power;
    else if (state === 'swing') {
      const t = Math.min(swingT / 0.32, 1);
      swingAngle = t < 0.4 ? -1.05 * power + (t / 0.4) * (1.05 * power + 0.55) : 0.55 - (t - 0.4) * 0.9;
    }
    clubPivot.rotation.x = -0.55 + swingAngle;
    clubPivot.visible = state !== 'flight' && state !== 'holed';

    // Aim guide length follows the charge.
    const club = CLUBS[clubKey];
    const reach = club.maxSpeed * (state === 'charging' ? Math.max(power, 0.1) : 1) * 0.62;
    const from = ball.position.clone().setY(0.16);
    const to = ball.position.clone().addScaledVector(dir, reach).setY(0.16);
    aimLine.geometry.setFromPoints([from, to]);
    aimLine.computeLineDistances();
    aimLine.visible = state === 'address' || state === 'rest' || state === 'charging';
  }

  function updateDebug() {
    window.__GOLF__ = {
      state,
      ball: [Number(ball.position.x.toFixed(2)), Number(ball.position.y.toFixed(2)), Number(ball.position.z.toFixed(2))],
      strokes,
      club: clubKey,
      power: Number(power.toFixed(2)),
      distToPin: Number(distToPin().toFixed(2)),
    };
  }

  function enter() {
    if (!built) build();
    disposers = [];
    state = 'address';
    strokes = 0;
    power = 0;
    vel.set(0, 0, 0);
    ball.position.copy(TEE);
    lastLie.copy(TEE);
    setAimTowardPin();
    hideBanner();
    trail.visible = false;
    el('golf-hud').hidden = false;
    document.getElementById('control-hint').hidden = true;
    ensureAudio();
    updateHud();

    on(document, 'keydown', (e) => {
      if (document.querySelector('dialog[open]')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' && document.pointerLockElement !== canvas) { app.setMode('orbit'); return; }
      if (k === ' ') { if (!e.repeat) startCharge(); e.preventDefault(); return; }
      if (k === '1') selectClub('driver');
      if (k === '2') selectClub('iron');
      if (k === '3') selectClub('putter');
      if (k === 'r') restartHole();
      if (k === 'arrowleft') aimYaw += 0.06;
      if (k === 'arrowright') aimYaw -= 0.06;
    });
    on(document, 'keyup', (e) => { if (e.key === ' ') releaseSwing(); });

    on(canvas, 'click', () => {
      ensureAudio();
      if (document.pointerLockElement !== canvas && matchMedia('(pointer: fine)').matches) {
        canvas.requestPointerLock();
      }
    });
    on(document, 'mousemove', (e) => {
      if (document.pointerLockElement === canvas && (state === 'address' || state === 'rest' || state === 'charging')) {
        aimYaw -= e.movementX * 0.0022;
      }
    });

    // Touch / mouse drag aims when not pointer-locked.
    let drag = null;
    on(canvas, 'pointerdown', (e) => {
      if (document.pointerLockElement !== canvas) drag = { x: e.clientX, t: performance.now() };
    });
    on(window, 'pointermove', (e) => {
      if (drag && document.pointerLockElement !== canvas) {
        aimYaw -= (e.clientX - drag.x) * 0.004;
        drag.x = e.clientX;
      }
    });
    on(window, 'pointerup', () => { drag = null; });

    const swingBtn = el('golf-swing');
    on(swingBtn, 'pointerdown', (e) => { e.preventDefault(); startCharge(); });
    on(swingBtn, 'pointerup', releaseSwing);
    on(swingBtn, 'pointerleave', () => { if (charging) releaseSwing(); });
    on(el('golf-exit'), 'click', () => app.setMode('orbit'));
    on(el('golf-mute'), 'click', () => {
      muted = !muted;
      if (audio) audio.master.gain.value = muted ? 0 : 0.5;
      try { localStorage.setItem('arise-golf-mute', muted ? '1' : '0'); } catch { /* ignore */ }
      el('golf-mute').setAttribute('aria-pressed', String(muted));
      el('golf-mute').querySelector('span').textContent = muted ? 'Sound off' : 'Sound on';
    });
    document.querySelectorAll('.golf-clubs [data-club]').forEach((b) => {
      on(b, 'click', () => selectClub(b.dataset.club));
    });

    const hook = (dt) => {
      if (app.mode !== 'golf') return;
      if (charging) {
        power = Math.min(1, power + dt / 1.15);
        el('golf-power-fill').style.width = `${Math.round(power * 100)}%`;
      }
      if (state === 'swing') {
        swingT += dt;
        if (swingT >= 0.13 && vel.lengthSq() === 0) launch();
        if (swingT > 0.5) state = 'flight';
      }
      if (state === 'flight' || state === 'holed') stepPhysics(dt);
      if (particles.visible) {
        particles.userData.life -= dt;
        const attr = particles.geometry.getAttribute('position');
        for (let i = 0; i < attr.count; i += 1) {
          const v = particles.userData.vel[i];
          v[1] += GRAVITY * 0.4 * dt;
          attr.setXYZ(i, attr.getX(i) + v[0] * dt, Math.max(0.05, attr.getY(i) + v[1] * dt), attr.getZ(i) + v[2] * dt);
        }
        attr.needsUpdate = true;
        if (particles.userData.life <= 0) particles.visible = false;
      }
      updateTrail();
      updateCameraAndClub(dt);
      updateDebug();
    };
    const removeHook = app.addFrameHook(hook);

    updateDebug();
    return function cleanup() {
      removeHook();
      disposers.forEach((fn) => fn());
      disposers = [];
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      el('golf-hud').hidden = true;
      document.getElementById('control-hint').hidden = false;
      scene.remove(ball, cup, clubPivot, aimLine, trail, particles);
      built = false;
      window.__GOLF__ = undefined;
    };
  }

  return enter;
}
