import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { initGolfMode } from '../src/golf.js';
class Element extends EventTarget {
  constructor(){super();this.style={};this.attributes={};this.children=[];this.value='';this.hidden=false;}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k]??null;}
  removeAttribute(k){delete this.attributes[k];}
  focus(){}
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
  doc.getElementById('golf-camera').dispatchEvent(new Event('click'));frame(1);
  assert.ok(camera.position.y>20,'View hole changes to overhead camera');
  const power=doc.getElementById('golf-power-input');power.value=Math.sqrt(2*1.65*14)/12*100;power.dispatchEvent(new Event('input'));
  doc.getElementById('golf-swing').dispatchEvent(new Event('click'));frame(.1);
  assert.equal(window.__GOLF__.state,'swing');assert.equal(window.__GOLF__.strokes,0);
  for(let i=0;i<1000;i++)frame(1/120);
  assert.equal(window.__GOLF__.state,'holed');assert.equal(window.__GOLF__.strokes,1);
  doc.getElementById('golf-banner').children[0].onclick();frame(1/120);
  assert.equal(window.__GOLF__.hole,2);assert.equal(window.__GOLF__.state,'ready');
  exit();assert.equal(removed,true);assert.equal(scene.children.length,0);assert.equal(window.__GOLF__,undefined);
  delete globalThis.document;delete globalThis.window;delete globalThis.localStorage;
});
