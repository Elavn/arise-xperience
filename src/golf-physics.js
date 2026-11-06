// Coordinates are metres on the course. Rendering and simulation share this data.
export const RADIUS = 0.043;
export const CUP_RADIUS = 0.108;
export const CUP_DEPTH = 0.18;
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
export function newBall(course) { return { x: course.tee[0], z: course.tee[1], vx: 0, vz: 0, y: RADIUS, vy: 0 }; }
export function moving(b) { return Math.hypot(b.vx, b.vz) > 0; }
export function strike(b, angle, power) {
  const speed = Math.max(0, Math.min(1, power)) * 12;
  b.vx = Math.sin(angle) * speed; b.vz = -Math.cos(angle) * speed;
}
export function stepBall(b, c, dt = STEP) {
  if (b.falling) {
    b.vy -= 9.81 * dt;
    b.y += b.vy * dt;
    b.x += b.vx * dt; b.z += b.vz * dt;
    const dx=b.x-c.pin[0], dz=b.z-c.pin[1], d=Math.hypot(dx,dz);
    const clearance=CUP_RADIUS-RADIUS;
    if(d>clearance) {
      const nx=dx/d,nz=dz/d,dot=b.vx*nx+b.vz*nz;
      b.x=c.pin[0]+nx*clearance;b.z=c.pin[1]+nz*clearance;
      if(dot>0){b.vx-=1.25*dot*nx;b.vz-=1.25*dot*nz;}
    }
    if(b.y<=-CUP_DEPTH+RADIUS){b.y=-CUP_DEPTH+RADIUS;b.vx=b.vz=b.vy=0;return 'cup';}
    return 'falling';
  }
  const oldX = b.x, oldZ = b.z;
  const speed = Math.hypot(b.vx, b.vz);
  const next = Math.max(0, speed - surfaceAt(b.x,b.z).decel * dt);
  const ratio = speed ? next / speed : 0;
  b.vx *= ratio; b.vz *= ratio;
  b.x += b.vx * dt; b.z += b.vz * dt;
  if (Math.hypot(b.x,b.z)>68) {b.vx=b.vz=0;return 'out';}
  // A swept opening test avoids tunnelling. Available travel time over the
  // opening must exceed the gravitational drop time; glancing putts have
  // a shorter chord and therefore need less speed to fall in.
  const dx=b.x-oldX,dz=b.z-oldZ,length=Math.hypot(dx,dz);
  const nx=length?dx/length:1,nz=length?dz/length:0;
  const along=(c.pin[0]-oldX)*nx+(c.pin[1]-oldZ)*nz;
  const lateral=Math.abs((c.pin[0]-oldX)*nz-(c.pin[1]-oldZ)*nx);
  const opening=CUP_RADIUS-RADIUS*.25;
  const halfChord=Math.sqrt(Math.max(0,opening*opening-lateral*lateral));
  const entry=along-halfChord,exit=along+halfChord;
  const inside=Math.hypot(b.x-c.pin[0],b.z-c.pin[1])<opening;
  if(lateral<opening && ((entry<=length && exit>=0)||inside)) {
    const crossingTime=2*halfChord/Math.max(next,.001);
    if(crossingTime>=Math.sqrt(2*RADIUS/9.81)) {
      b.falling=true;b.y=RADIUS;b.vy=0;b.vx*=.45;b.vz*=.45;
      return 'falling';
    }
  }
  // A slow glancing contact loses radial momentum at the lip; there is no
  // attraction outside the mouth and firm putts continue across it.
  const rx=b.x-c.pin[0],rz=b.z-c.pin[1],distance=Math.hypot(rx,rz);
  if(b.rimContact && distance>CUP_RADIUS+RADIUS)b.rimContact=false;
  if(!b.rimContact && distance<CUP_RADIUS && lateral>opening*.75 && next<1.8 && distance>0) {
    const dot=(b.vx*rx+b.vz*rz)/distance;
    if(dot<0){b.vx-=1.1*dot*rx/distance;b.vz-=1.1*dot*rz/distance;b.vx*=.82;b.vz*=.82;b.rimContact=true;}
  }
  if (next < 0.025) b.vx = b.vz = 0;
  return moving(b) ? 'rolling' : 'rest';
}
