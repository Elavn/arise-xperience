// Coordinates are metres on the course. Rendering and simulation share this data.
export const RADIUS = 0.18;
export const STEP = 1 / 120;
export const COURSES = [
  { name: 'Palm Promenade', par: 2, hint: 'Find your touch. A gentle putt goes a long way.', tee: [0, 7], pin: [0, -7], walls: [], sand: [], water: [] },
  { name: 'The Bank Shot', par: 3, hint: 'Use the side rails to get around the central planter.', tee: [-3, 7], pin: [3, -7], walls: [[-2, -1, 2, 1]], sand: [[-5.7, -5, -2.6, -2]], water: [] },
  { name: 'Lagoon Run', par: 4, hint: 'Stay on the right fairway. Water adds one penalty stroke.', tee: [-3, 7], pin: [-3, -7], walls: [[1, -2, 2, 2]], sand: [[2.5, -7, 5.7, -4]], water: [[-5.7, -1.8, 0, 1.8]] },
];
export function newBall(course) { return { x: course.tee[0], z: course.tee[1], vx: 0, vz: 0 }; }
export function inRect(x, z, r) { return x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]; }
export function moving(b) { return Math.hypot(b.vx, b.vz) > 0; }
export function strike(b, angle, power) {
  const speed = Math.max(0, Math.min(1, power)) * 12;
  b.vx = Math.sin(angle) * speed; b.vz = -Math.cos(angle) * speed;
}
export function stepBall(b, c, dt = STEP) {
  const oldX = b.x, oldZ = b.z;
  const speed = Math.hypot(b.vx, b.vz);
  const sand = c.sand.some(r => inRect(b.x, b.z, r));
  const next = Math.max(0, speed - (sand ? 5.8 : 1.65) * dt);
  const ratio = speed ? next / speed : 0;
  b.vx *= ratio; b.vz *= ratio;
  b.x += b.vx * dt; b.z += b.vz * dt;
  let bounced = false;
  for (const axis of ['x', 'z']) {
    const limit = (axis === 'x' ? 6 : 10) - RADIUS;
    if (Math.abs(b[axis]) > limit) {
      b[axis] = Math.sign(b[axis]) * limit;
      b[`v${axis}`] *= -0.76; bounced = true;
    }
  }
  for (const r of c.walls) {
    const nx = Math.max(r[0], Math.min(b.x, r[2]));
    const nz = Math.max(r[1], Math.min(b.z, r[3]));
    let dx = b.x - nx, dz = b.z - nz, d = Math.hypot(dx, dz);
    if (d >= RADIUS) continue;
    if (d === 0) {
      const faces = [[Math.abs(b.x-r[0]), -1, 0], [Math.abs(b.x-r[2]), 1, 0], [Math.abs(b.z-r[1]), 0, -1], [Math.abs(b.z-r[3]), 0, 1]].sort((a,b) => a[0]-b[0]);
      dx = faces[0][1]; dz = faces[0][2]; d = 1;
      b.x += dx * (faces[0][0] + RADIUS); b.z += dz * (faces[0][0] + RADIUS);
    } else { b.x += dx / d * (RADIUS-d); b.z += dz / d * (RADIUS-d); }
    dx /= d; dz /= d;
    const dot = b.vx*dx + b.vz*dz;
    if (dot < 0) { b.vx -= 1.76*dot*dx; b.vz -= 1.76*dot*dz; bounced = true; }
  }
  if (c.water.some(r => inRect(b.x, b.z, r))) { b.vx = b.vz = 0; return 'water'; }
  // Swept capture avoids skipping over the cup between simulation ticks.
  const dx = b.x-oldX, dz = b.z-oldZ, len = dx*dx+dz*dz;
  const t = len ? Math.max(0, Math.min(1, ((c.pin[0]-oldX)*dx+(c.pin[1]-oldZ)*dz)/len)) : 0;
  if (Math.hypot(oldX+t*dx-c.pin[0], oldZ+t*dz-c.pin[1]) < 0.32 && next < 2.8) {
    b.x = c.pin[0]; b.z = c.pin[1]; b.vx = b.vz = 0; return 'cup';
  }
  if (next < 0.025) b.vx = b.vz = 0;
  return bounced ? 'bounce' : moving(b) ? 'rolling' : 'rest';
}
