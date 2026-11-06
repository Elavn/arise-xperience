import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COURSES } from '../src/golf-physics.js';
import { initGolfMode } from '../src/golf.js';
class Element extends EventTarget {
  constructor(){super();this.style={};this.attributes={};this.children=[];this.value='';this.hidden=false;}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k]??null;}
  removeAttribute(k){delete this.attributes[k];}
  focus(){}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
  append(node){this.children.push(node);}
}
test('player camera, timed club strike, hole completion and exit cleanup',()=>{
  const elements=new Map();
  const doc=new Element();
  doc.getElementById=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  doc.createElement=()=>new Element();doc.querySelector=()=>null;doc.activeElement=new Element();
  globalThis.document=doc;globalThis.window=new Element();globalThis.localStorage={getItem:key=>key==='arise-golf-mute'?'1':null,setItem(){}};
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(46,1.6,.1,700),canvas=new Element();
  let frame,removed=false;
  const app={scene,camera,renderer:{domElement:canvas},addFrameHook:fn=>{frame=fn;return()=>{removed=true;};},setMode(){}};
  const exit=initGolfMode(app)();
  assert.ok(camera.position.y<5,'default view is low beside the player');
  assert.ok(scene.getObjectByName('Golfer'));
  frame(1/120);
  const aimBefore=window.__GOLF__.aim, golfer=scene.getObjectByName('Golfer');
  const initial=[...window.__GOLF__.ball],powerBefore=window.__GOLF__.power,cameraBefore=camera.position.clone();
  function pointer(type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:100,clientY:100,...props});canvas.dispatchEvent(e);}
  pointer('pointerdown');pointer('pointermove',{clientX:240,clientY:140});frame(.1);pointer('pointerup');frame(.1);
  assert.equal(window.__GOLF__.state,'ready');assert.equal(window.__GOLF__.strokes,0);
  assert.deepEqual(window.__GOLF__.ball,initial);assert.equal(window.__GOLF__.power,powerBefore);
  assert.ok(camera.position.distanceTo(cameraBefore)>.5,'drag rotates the view');
  assert.ok(Math.abs(window.__GOLF__.aim-aimBefore-.84)<1e-9,'horizontal rotation updates aim');
  assert.ok(Math.abs(golfer.rotation.y+window.__GOLF__.aim)<1e-9,'golfer stance follows aim');
  const rotatedAim=window.__GOLF__.aim;
  const beforePan=camera.position.clone();
  pointer('pointerdown',{shiftKey:true});pointer('pointermove',{clientX:190});frame(.1);pointer('pointerup');frame(.1);
  assert.ok(camera.position.distanceTo(beforePan)>.1);assert.equal(window.__GOLF__.strokes,0);
  assert.equal(window.__GOLF__.aim,rotatedAim,'panning does not change aim');
  pointer('pointerdown');pointer('pointermove',{clientX:100,clientY:130});frame(.1);pointer('pointerup');
  assert.equal(window.__GOLF__.aim,rotatedAim,'vertical tilt does not change aim');
  pointer('pointerdown');pointer('pointercancel');frame(.1);assert.equal(window.__GOLF__.state,'ready');

  pointer('pointerdown');pointer('pointermove',{clientX:-40});frame(.1);pointer('pointerup');
  assert.ok(Math.abs(window.__GOLF__.aim-aimBefore)<1e-9,'reverse orbit restores shot line');
  doc.getElementById('golf-camera').dispatchEvent(new Event('click'));frame(1);
  assert.ok(camera.position.y>20,'View hole changes to overhead camera');
  const power=doc.getElementById('golf-power-input');power.value=Math.sqrt(2*1.65*Math.hypot(COURSES[0].tee[0]-COURSES[0].pin[0],COURSES[0].tee[1]-COURSES[0].pin[1]))/12*100;power.dispatchEvent(new Event('input'));
  doc.getElementById('golf-swing').dispatchEvent(new Event('click'));frame(.1);
  assert.equal(window.__GOLF__.state,'swing');assert.equal(window.__GOLF__.strokes,0);
  const committedAim=window.__GOLF__.aim;
  pointer('pointerdown');pointer('pointermove',{clientX:180});frame(.1);pointer('pointerup');
  assert.equal(window.__GOLF__.aim,committedAim,'camera orbit cannot redirect a committed swing');
  for(let i=0;i<1000;i++)frame(1/120);
  assert.equal(window.__GOLF__.state,'holed');assert.equal(window.__GOLF__.strokes,1);
  doc.getElementById('golf-banner').children[0].onclick();frame(1/120);
  assert.equal(window.__GOLF__.hole,2);assert.equal(window.__GOLF__.state,'ready');
  exit();assert.equal(removed,true);assert.equal(scene.children.length,0);assert.equal(window.__GOLF__,undefined);
  delete globalThis.document;delete globalThis.window;delete globalThis.localStorage;
});
