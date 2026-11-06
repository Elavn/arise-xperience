import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, STEP, newBall, strike, stepBall, surfaceAt, RADIUS, CUP_RADIUS, CUP_DEPTH } from '../src/golf-physics.js';
function simulate(b,c){let result;for(let i=0;i<3000;i++){result=stepBall(b,c);if(['cup','out','rest'].includes(result))break;}return result;}
test('calibrated putt completes the original practice flag',()=>{const c=COURSES[0],b=newBall(c);const d=Math.hypot(b.x-c.pin[0],b.z-c.pin[1]);strike(b,Math.atan2(c.pin[0]-b.x,b.z-c.pin[1]),Math.sqrt(2*1.65*d)/12);assert.equal(simulate(b,c),'cup');});
test('short putts have no minimum launch-speed floor',()=>{const b=newBall(COURSES[0]),z=b.z;strike(b,0,.05);simulate(b,COURSES[0]);assert.ok(z-b.z>0&&z-b.z<.2);});
test('ball crosses former box boundaries without bouncing',()=>{const b={x:5.8,z:0,vx:10,vz:0};for(let i=0;i<30;i++)stepBall(b,COURSES[0]);assert.ok(b.x>7);assert.ok(b.vx>0);});
test('existing bunker and rough slow shots more than green',()=>{assert.equal(surfaceAt(11,4).name,'sand');assert.equal(surfaceAt(20,0).name,'rough');const c=COURSES[0],a={x:11,z:4,vx:1,vz:0},b={x:0,z:4,vx:1,vz:0};simulate(a,c);simulate(b,c);assert.ok(a.x-11<b.x);});
test('fast shots cross cup without capture',()=>{const c=COURSES[0],b={x:c.pin[0],z:c.pin[1]+.2,vx:0,vz:-9};assert.equal(stepBall(b,c),'rolling');assert.equal(b.falling,undefined);});
test('resting ball does not drift',()=>{const b=newBall(COURSES[0]),original={...b};for(let i=0;i<1200;i++)stepBall(b,COURSES[0]);assert.deepEqual(b,original);});
test('fixed simulation matches across rendering frame rates',()=>{function run(fps){const b=newBall(COURSES[0]);strike(b,.4,.75);let acc=0;for(let f=0;f<fps*4;f++){acc+=1/fps;while(acc+1e-10>=STEP){stepBall(b,COURSES[0]);acc-=STEP;}}return b;}assert.deepEqual(run(30),run(144));});

test('slow centered putt enters then drops under gravity before scoring',()=>{
  const c=COURSES[0],b={x:c.pin[0],z:c.pin[1]+CUP_RADIUS+.003,vx:0,vz:-.6,y:RADIUS,vy:0};
  let event;for(let i=0;i<20;i++){event=stepBall(b,c);if(event==='falling')break;}
  assert.equal(event,'falling');assert.ok(b.y<=RADIUS);
  stepBall(b,c);assert.ok(b.y<RADIUS);assert.ok(b.vy<0);
  assert.equal(simulate(b,c),'cup');assert.equal(b.y,-CUP_DEPTH+RADIUS);
});
test('a putt outside the cup is never magnetically pulled in',()=>{
  const c=COURSES[0],x=c.pin[0]+CUP_RADIUS+RADIUS+.01,b={x,z:c.pin[1]+.3,vx:0,vz:-1};
  simulate(b,c);assert.equal(b.x,x);assert.ok(!b.falling);
});
test('a firm glancing putt lips out instead of scoring',()=>{
  const c=COURSES[0],b={x:c.pin[0]+CUP_RADIUS*.85,z:c.pin[1]+.2,vx:0,vz:-2.5};
  assert.notEqual(simulate(b,c),'cup');assert.ok(!b.falling);
});

test('a hard putt dips over the opening, hits the far lip and carries on',()=>{
  const c=COURSES[0],b={x:c.pin[0],z:c.pin[1]+.2,vx:0,vz:-6,y:RADIUS,vy:0};
  let minimum=RADIUS,maximum=RADIUS,event;
  for(let i=0;i<1000;i++){event=stepBall(b,c);minimum=Math.min(minimum,b.y);maximum=Math.max(maximum,b.y);if(['cup','rest'].includes(event))break;}
  assert.notEqual(event,'cup');assert.ok(b.z<c.pin[1]-.3);assert.ok(minimum<RADIUS-.001);assert.ok(maximum>RADIUS,'far lip produces a small hop');
});
test('centered moderate putts drop while firm edge putts escape',()=>{
  const c=COURSES[0];
  const centered={x:c.pin[0],z:c.pin[1]+.2,vx:0,vz:-1.7,y:RADIUS,vy:0};
  const edge={x:c.pin[0]+CUP_RADIUS*.85,z:c.pin[1]+.2,vx:0,vz:-2.5,y:RADIUS,vy:0};
  assert.equal(simulate(centered,c),'cup');assert.notEqual(simulate(edge,c),'cup');
});
test('cup crossing cannot tunnel at full shot speed',()=>{
  const c=COURSES[0],b={x:c.pin[0],z:c.pin[1]+.2,vx:0,vz:-12,y:RADIUS,vy:0};
  let dip=false;for(let i=0;i<15;i++){stepBall(b,c);dip ||= b.y<RADIUS;}
  assert.ok(dip);assert.ok(b.z<c.pin[1]-CUP_RADIUS);assert.ok(!b.falling||b.y>=0);
});
