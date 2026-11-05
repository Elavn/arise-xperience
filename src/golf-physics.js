// Coordinates are metres on the course. Rendering and simulation share this data.
export const RADIUS = 0.18;
export const STEP = 1 / 120;
// Tee variations on the existing resort green; all play to its original flag.
export const COURSES = [
  { name: 'Practice Green', par: 2, hint: 'Drag to look around. Aim with the arrows, then press Putt.', tee: [-12, -5], pin: [-2, -1] },
  { name: 'South Approach', par: 3, hint: 'Explore your angle freely. Only Putt or Space takes a shot.', tee: [-2, 9], pin: [-2, -1] },
  { name: 'Across the Green', par: 4, hint: 'Play the open green toward the flag.', tee: [10, -8], pin: [-2, -1] },
];
// The elliptical bunker and green match the landscaping in scene.js.
export function surfaceAt(x,z) {
  if (((x-11)/6.5)**2 + ((z-4)/3.1)**2 <= 1) return {name:'sand',decel:5.8};
  if ((x/15.5)**2 + (z/12)**2 <= 1) return {name:'green',decel:1.65};
  return {name:'rough',decel:4.2};
}
export function newBall(course) { return { x: course.tee[0], z: course.tee[1], vx: 0, vz: 0 }; }
export function moving(b) { return Math.hypot(b.vx, b.vz) > 0; }
export function strike(b, angle, power) {
  const speed = Math.max(0, Math.min(1, power)) * 12;
  b.vx = Math.sin(angle) * speed; b.vz = -Math.cos(angle) * speed;
}
export function stepBall(b, c, dt = STEP) {
  const oldX = b.x, oldZ = b.z;
  const speed = Math.hypot(b.vx, b.vz);
  const next = Math.max(0, speed - surfaceAt(b.x,b.z).decel * dt);
  const ratio = speed ? next / speed : 0;
  b.vx *= ratio; b.vz *= ratio;
  b.x += b.vx * dt; b.z += b.vz * dt;
  if (Math.hypot(b.x,b.z)>68) {b.vx=b.vz=0;return 'out';}
  // Swept capture avoids skipping over the cup between simulation ticks.
  const dx = b.x-oldX, dz = b.z-oldZ, len = dx*dx+dz*dz;
  const t = len ? Math.max(0, Math.min(1, ((c.pin[0]-oldX)*dx+(c.pin[1]-oldZ)*dz)/len)) : 0;
  if (Math.hypot(oldX+t*dx-c.pin[0], oldZ+t*dz-c.pin[1]) < 0.32 && next < 2.8) {
    b.x = c.pin[0]; b.z = c.pin[1]; b.vx = b.vz = 0; return 'cup';
  }
  if (next < 0.025) b.vx = b.vz = 0;
  return moving(b) ? 'rolling' : 'rest';
}
