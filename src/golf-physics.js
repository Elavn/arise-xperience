// Coordinates are metres on the course. Rendering and simulation share this data.
export const RADIUS = 0.043;
export const CUP_RADIUS = 0.108;
export const CUP_DEPTH = 0.18;
export const STEP = 1 / 120;
// Tee variations on the existing resort green; all play to its original flag.
export const COURSES = [
  { name: 'Practice Green', par: 2, hint: 'Rotate to align your stance and aim. Press Putt to hit.', tee: [-12, -5], pin: [-2, -1] },
  { name: 'South Approach', par: 3, hint: 'Rotate to aim; Shift-drag to pan. Only Putt or Space hits.', tee: [-2, 9], pin: [-2, -1] },
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
// Resolve gravity and the rounded cup lip at small fixed substeps. A ball
// loses support above the opening instead of being captured by a speed test.
const GRAVITY=9.81;
const SUBSTEP=1/720;
export function stepBall(b,c,dt=STEP) {
  const count=Math.max(1,Math.ceil(dt/SUBSTEP));
  let result='rest';
  for(let i=0;i<count;i++) {
    result=stepContact(b,c,dt/count);
    if(result==='cup'||result==='out')return result;
  }
  return result;
}
function stepContact(b,c,dt) {
  const y=b.y??RADIUS;
  const distance=Math.hypot(b.x-c.pin[0],b.z-c.pin[1]);
  const supported=distance>=CUP_RADIUS && y<=RADIUS+.0001 && (b.vy??0)<=0;
  if(supported) {
    const speed=Math.hypot(b.vx,b.vz),next=Math.max(0,speed-surfaceAt(b.x,b.z).decel*dt);
    if(speed){b.vx*=next/speed;b.vz*=next/speed;}
  }
  b.x+=b.vx*dt;b.z+=b.vz*dt;
  const dx=b.x-c.pin[0],dz=b.z-c.pin[1],d=Math.hypot(dx,dz);
  if(Math.hypot(b.x,b.z)>68){b.vx=b.vz=0;return 'out';}
  if(supported && d>=CUP_RADIUS){
    // Preserve resting state exactly and avoid applying gravity on grass.
    if(b.y!==undefined)b.y=RADIUS;
    if(b.vy!==undefined)b.vy=0;
    if(b.falling)b.falling=false;
    return moving(b)?'rolling':'rest';
  }
  b.vy=(b.vy??0)-GRAVITY*dt;
  b.y=y+b.vy*dt;
  // Sphere against the circular turf lip. The contact normal determines
  // whether a fast ball hops out or a deeper ball rebounds into the cup.
  const radial=d-CUP_RADIUS,lipDistance=Math.hypot(radial,b.y);
  if(lipDistance<RADIUS && lipDistance>1e-8 && d>1e-8) {
    const nr=radial/lipDistance,ny=b.y/lipDistance;
    const nx=dx/d*nr,nz=dz/d*nr;
    const penetration=RADIUS-lipDistance;
    b.x+=nx*penetration;b.z+=nz*penetration;b.y+=ny*penetration;
    const impact=b.vx*nx+b.vy*ny+b.vz*nz;
    if(impact<0){
      const restitution=b.y>0?.22:.12;
      b.vx-=(1+restitution)*impact*nx;b.vy-=(1+restitution)*impact*ny;b.vz-=(1+restitution)*impact*nz;
      b.vx*=.96;b.vz*=.96;
    }
  }
  const rd=Math.hypot(b.x-c.pin[0],b.z-c.pin[1]);
  if(b.y<-RADIUS && rd>CUP_RADIUS-RADIUS && rd>0){
    const nx=(b.x-c.pin[0])/rd,nz=(b.z-c.pin[1])/rd;
    const dot=b.vx*nx+b.vz*nz;
    b.x=c.pin[0]+nx*(CUP_RADIUS-RADIUS);b.z=c.pin[1]+nz*(CUP_RADIUS-RADIUS);
    if(dot>0){b.vx-=1.2*dot*nx;b.vz-=1.2*dot*nz;}
  }
  if(rd>=CUP_RADIUS && b.y<RADIUS && b.y>=0){
    b.y=RADIUS;b.vy=Math.abs(b.vy)>.15?Math.abs(b.vy)*.15:0;
  }
  if(b.y<=-CUP_DEPTH+RADIUS){b.y=-CUP_DEPTH+RADIUS;b.vx=b.vz=b.vy=0;b.falling=true;return 'cup';}
  b.falling=b.y<RADIUS-.0001 || rd<CUP_RADIUS || Math.abs(b.vy)>.001;
  return b.falling?'falling':moving(b)?'rolling':'rest';
}
