import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, STEP, newBall, strike, stepBall, moving } from '../src/golf-physics.js';
function simulate(ball, course, limit=3000) { let result;for(let i=0;i<limit;i++){result=stepBall(ball,course);if(['cup','water','rest'].includes(result))break;}return result; }
test('a calibrated straight putt completes the first hole',()=>{const b=newBall(COURSES[0]);strike(b,0,Math.sqrt(2*1.65*14)/12);assert.equal(simulate(b,COURSES[0]),'cup');});
test('low power permits short putts',()=>{const b=newBall(COURSES[0]);strike(b,0,.05);simulate(b,COURSES[0]);assert.ok(7-b.z<.2);assert.ok(7-b.z>0);});
test('rails return a ball with energy loss',()=>{const b={x:5.8,z:4,vx:10,vz:0};assert.equal(stepBall(b,COURSES[0]),'bounce');assert.ok(b.vx<0);assert.ok(Math.abs(b.vx)<10);assert.ok(b.x<=5.82);});
test('central obstacle blocks a maximum-power shot',()=>{const b={x:0,z:2,vx:0,vz:-12};let bounce=false;for(let i=0;i<30;i++){if(stepBall(b,COURSES[1])==='bounce')bounce=true;}assert.ok(bounce);assert.ok(b.z>1);});
test('sand stops the ball sooner than turf',()=>{const a={x:-4,z:-2.2,vx:0,vz:-2},b={...a};simulate(a,COURSES[1]);simulate(b,{...COURSES[1],sand:[]});assert.ok(a.z>b.z);});
test('lagoon reports a penalty event and stops motion',()=>{const b={x:-3,z:2,vx:0,vz:-5};assert.equal(simulate(b,COURSES[2]),'water');assert.equal(moving(b),false);});
test('fast shots cross the cup without being captured',()=>{const b={x:0,z:-6.8,vx:0,vz:-9};assert.notEqual(stepBall(b,COURSES[0]),'cup');});
test('a resting ball stays at rest without drift',()=>{const b=newBall(COURSES[0]),original={...b};for(let i=0;i<1200;i++)stepBall(b,COURSES[0],STEP);assert.deepEqual(b,original);});
test('simulation is identical across rendering frame rates',()=>{function run(fps){const b=newBall(COURSES[0]);strike(b,.4,.75);let acc=0;for(let frame=0;frame<fps*4;frame++){acc+=1/fps;while(acc+1e-10>=STEP){stepBall(b,COURSES[0]);acc-=STEP;}}return b;}assert.deepEqual(run(30),run(144));});
