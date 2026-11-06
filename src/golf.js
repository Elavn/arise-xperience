import { createCup } from './golf-cup.js';
import { createGolfer } from './golfer.js';
import * as THREE from 'three';
import { COURSES, RADIUS, STEP, newBall, moving, strike, stepBall } from './golf-physics.js';

export function initGolfMode(app) {
  const { scene, camera, renderer } = app;
  const canvas = renderer.domElement;
  const el = id => document.getElementById(id);
  return function enter() {
    let hole = 0, strokes = 0, scores = [], ball = newBall(COURSES[0]);
    let angle = 0, power = 0.6, state = 'ready', accumulator = 0, charge = false;
    let lastLie = { ...ball }, drag = null, overview = false, audio;
    let guideKey = '';
    let cameraYaw=0, cameraPitch=0, cameraZoom=1;
    const cameraPan=new THREE.Vector3();
    let swingTime = 0;
    const golfer = createGolfer();
    const previousFocus = document.activeElement;
    const oldTabIndex = canvas.getAttribute('tabindex');
    canvas.tabIndex = 0; canvas.focus();
    let muted = false, best = null;
    try { muted = localStorage.getItem('arise-golf-mute') === '1'; best = Number(localStorage.getItem('arise-open-green-best')) || null; } catch { /* Storage is optional. */ }
    const listeners = [];
    const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); };
    const root = new THREE.Group();
    root.position.set(35, 0.12, -9);
    scene.add(root);
    root.add(golfer.group);
    let courseGroup, sphere, guide, flag, cup;
    const savedFlag = [scene.getObjectByName('Golf_flagstick'), ...scene.children.filter(o => o.geometry?.type === 'ShapeGeometry' && o.position.x === 33)];
    const flagVisibility = savedFlag.map(o => o?.visible);
    savedFlag.forEach(o => { if (o) o.visible = false; });
    const material = (color, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extras });
    const dark = material(0x143d32), orange = material(0xf48b43), white = material(0xfffbef);
    const allMaterials = new Set([dark,orange,white]);
    function mesh(geometry, mat, x, y, z, parent = courseGroup) {
      const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    function disposeGroup(group) { group.traverse(o => { o.geometry?.dispose(); }); group.removeFromParent(); }
    function sound(freq = 400, duration = 0.08) {
      if (muted) return;
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended') audio.resume();
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq,audio.currentTime);
        gain.gain.setValueAtTime(0.08,audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+duration);
        osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime+duration);
      } catch { /* Silent play remains available. */ }
    }
    function setPower(value) {
      power = Math.max(0.02, Math.min(1,value));
      el('golf-power-input').value = Math.round(power*100);
      el('golf-power-value').textContent = `${Math.round(power*100)}%`;
    }
    function aimAtPin() { angle = Math.atan2(COURSES[hole].pin[0]-ball.x, ball.z-COURSES[hole].pin[1]); }
    function hud(message) {
      const c = COURSES[hole];
      el('golf-course-name').textContent = c.name;
      el('golf-hole-label').textContent = `HOLE ${hole+1} / 3 · PAR ${c.par}`;
      el('golf-strokes').textContent = `${strokes} ${strokes === 1 ? 'stroke' : 'strokes'}`;
      el('golf-distance').textContent = `${Math.hypot(ball.x-c.pin[0],ball.z-c.pin[1]).toFixed(1)} m to pin`;
      el('golf-status').textContent = message || c.hint;
      el('golf-scorecard').innerHTML = COURSES.map((c,i) => `<span class="${i===hole?'current':''}"><small>${String(i+1).padStart(2,'0')}</small>${scores[i] ?? '—'}<small>PAR ${c.par}</small></span>`).join('');
      const locked = state !== 'ready';
      for (const id of ['golf-swing','golf-power-input','golf-aim-left','golf-aim-right']) el(id).disabled = locked;
    }
    function buildCourse() {
      cup?.dispose();
      if (courseGroup) disposeGroup(courseGroup);
      courseGroup = new THREE.Group(); root.add(courseGroup);
      // The existing resort grass is the playing surface: no enclosure.
      const c = COURSES[hole];
      cup=createCup(scene,root,c.pin[0],c.pin[1]);
      mesh(new THREE.CylinderGeometry(0.009,0.009,2.5,8),white,c.pin[0],1.25,c.pin[1]);
      flag = mesh(new THREE.PlaneGeometry(1,0.55),orange,c.pin[0]+0.5,2.15,c.pin[1]); flag.material.side = THREE.DoubleSide;
      const tee = mesh(new THREE.RingGeometry(0.36,0.42,32),white,...[c.tee[0],0.02,c.tee[1]]); tee.rotation.x=-Math.PI/2;
      sphere = mesh(new THREE.SphereGeometry(RADIUS,24,16),white,ball.x,RADIUS,ball.z);
      const stripe = mesh(new THREE.TorusGeometry(RADIUS*0.99,0.002,6,32),orange,0,0,0,sphere); stripe.rotation.x=Math.PI/2;
      const lineMat = new THREE.LineDashedMaterial({ color:0xffe4aa, dashSize:0.22, gapSize:0.15, depthTest:false }); allMaterials.add(lineMat);
      guideKey = '';
      guide = new THREE.Line(new THREE.BufferGeometry(),lineMat); guide.frustumCulled=false; guide.renderOrder=5; courseGroup.add(guide);
    }
    function loadHole() {
      ball = newBall(COURSES[hole]); lastLie={...ball}; strokes=0; state='ready'; charge=false; drag=null; accumulator=0; swingTime=0;cameraYaw=0;
      el('golf-banner').hidden=true; setPower(0.6); aimAtPin(); buildCourse(); hud();
    }
    function showResult() {
      scores[hole]=strokes; state='holed'; sound(880,0.3);
      const total=scores.reduce((a,b)=>a+b,0), complete=hole===2;
      if (complete) {
        if (!best || total<best) best=total;
        try { localStorage.setItem('arise-open-green-best',String(best)); } catch { /* optional */ }

      }
      const stars=strokes<=COURSES[hole].par ? '★★★' : strokes===COURSES[hole].par+1 ? '★★☆' : '★☆☆';
      const banner=el('golf-banner');
      banner.innerHTML=`<span class="golf-result-stars" aria-label="${stars.split('★').length-1} stars">${stars}</span><strong>${complete?'Round complete':strokes===1?'Hole in one!':strokes<COURSES[hole].par?'Birdie!':strokes===COURSES[hole].par?'Right on par':'Nicely holed'}</strong><span>${complete?`${total} strokes · Par 9 · Personal best ${best}`:`${strokes} strokes · ${COURSES[hole].name}`}</span>`;
      const next=document.createElement('button'); next.className='primary-button'; next.textContent=complete?'Play a new round':'Next hole →';
      next.onclick=()=>{ if(complete){hole=0;scores=[];}else hole++; loadHole(); }; banner.append(next);
      const exit=document.createElement('button'); exit.className='text-button'; exit.textContent='Explore the resort'; exit.onclick=()=>app.setMode('orbit'); banner.append(exit);
      banner.hidden=false; hud('Hole complete. Ready for the next challenge?'); next.focus();
    }
    function shoot() {
      if(state!=='ready'||drag)return;
      charge=false; drag=null; lastLie={...ball}; swingTime=0; state='swing'; hud('');
    }
    function cancel() { charge=false; drag=null; if(state==='ready')hud(); }
    function updateGuide() {
      guide.visible=state==='ready'; if(!guide.visible)return;
      const key = `${hole}:${ball.x}:${ball.z}:${angle}:${power}`;
      if (key === guideKey) return;
      guideKey = key;
      const ghost={...ball}, points=[new THREE.Vector3(ball.x,0.08,ball.z)]; strike(ghost,angle,power);
      for(let i=0;i<720;i++) {
        const event=stepBall(ghost,COURSES[hole]);
        if(i%6===0)points.push(new THREE.Vector3(ghost.x,0.08,ghost.z));
        if(['cup','out','rest'].includes(event))break;
      }
      guide.geometry.dispose(); guide.geometry=new THREE.BufferGeometry().setFromPoints(points); guide.computeLineDistances();
    }
    el('golf-camera').textContent='View hole';
    el('golf-hud').hidden=false; el('control-hint').hidden=true;
    el('golf-mute').setAttribute('aria-pressed',String(muted)); el('golf-mute').textContent=muted?'Sound off':'Sound on';
    on(el('golf-mute'),'click',()=>{muted=!muted;el('golf-mute').setAttribute('aria-pressed',String(muted));el('golf-mute').textContent=muted?'Sound off':'Sound on';try{localStorage.setItem('arise-golf-mute',muted?'1':'0');}catch{} });
    on(el('golf-exit'),'click',()=>app.setMode('orbit'));
    on(el('golf-camera'),'click',()=>{overview=!overview;el('golf-camera').textContent=overview?'Player view':'View hole';});
    on(el('golf-restart'),'click',()=>{hole=0;scores=[];loadHole();});
    on(el('golf-power-input'),'input',e=>setPower(Number(e.target.value)/100));
    on(el('golf-swing'),'click',shoot);
    on(el('golf-aim-left'),'click',()=>{angle-=0.055;}); on(el('golf-aim-right'),'click',()=>{angle+=0.055;});
    on(canvas,'pointerdown',e=>{
      if(drag || (e.button!==0 && e.button!==1 && e.button!==2))return;
      charge=false;canvas.focus();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.button===1||e.shiftKey};
      canvas.setPointerCapture(e.pointerId);e.preventDefault();
    });
    on(canvas,'pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(drag.pan){
        const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);
        const forward=new THREE.Vector3().setFromMatrixColumn(camera.matrix,2);forward.y=0;forward.normalize();
        cameraPan.addScaledVector(right,-dx*.018*cameraZoom).addScaledVector(forward,-dy*.018*cameraZoom);
        cameraPan.clampLength(0,20);
       }else{
        // At address the camera, stance and shot guide share one heading.
        // During a committed swing/roll, orbit only the view, never the shot.
        if(state==='ready')angle+=dx*.006;
        else cameraYaw-=dx*.006;
        cameraPitch=THREE.MathUtils.clamp(cameraPitch+dy*.004,-.2,.9);
      }
      drag.x=e.clientX;drag.y=e.clientY;
    });
    on(canvas,'pointerup',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    });
    on(canvas,'contextmenu',e=>e.preventDefault());
    on(canvas,'wheel',e=>{e.preventDefault();cameraZoom=THREE.MathUtils.clamp(cameraZoom*Math.exp(e.deltaY*.001),.65,2.5);});
    on(canvas,'pointercancel',cancel); on(canvas,'lostpointercapture',cancel); on(window,'blur',cancel);
    on(document,'visibilitychange',()=>{cancel();accumulator=0;});
    on(document,'keydown',e=>{
      if(document.querySelector('dialog[open]'))return;
      if(e.key==='Escape'){app.setMode('orbit');return;}
      if(e.target.matches('button,input'))return;
      if(state!=='ready'||drag)return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
      if(e.key==='ArrowLeft')angle-=0.04; if(e.key==='ArrowRight')angle+=0.04;
      if(e.key==='ArrowUp')setPower(power+0.02); if(e.key==='ArrowDown')setPower(power-0.02);
      if(e.code==='Space'&&!e.repeat){charge=true;setPower(0.02);}
    });
    on(document,'keyup',e=>{if(e.code==='Space'&&charge)shoot();});
    loadHole();
    const target=new THREE.Vector3(), eye=new THREE.Vector3();
    function cameraFrame(dt, instant=false) {
      const portrait=camera.aspect<0.8;
      if(overview) { target.set(35,0,-9);const back=portrait?31:24;eye.set(35-Math.sin(angle)*back,portrait?38:27,-9+Math.cos(angle)*back); }
      else {
        // Low, behind-the-ball view, with the golfer on the left of frame.
        const dir=new THREE.Vector3(Math.sin(angle),0,-Math.cos(angle));
        const origin=new THREE.Vector3(35+ball.x,root.position.y,-9+ball.z);
        const right=new THREE.Vector3(-dir.z,0,dir.x);
        target.copy(origin).addScaledVector(dir,3.8);target.y+=.65;
        eye.copy(origin).addScaledVector(dir,portrait?-8:-6.2).addScaledVector(right,portrait?.2:.65);eye.y+=portrait?4.2:3.1;
      }
      const pivot=new THREE.Vector3(35+ball.x,root.position.y,-9+ball.z);
      const spherical=new THREE.Spherical().setFromVector3(eye.clone().sub(pivot));
      spherical.theta+=cameraYaw;
      spherical.phi=THREE.MathUtils.clamp(spherical.phi-cameraPitch,.2,1.42);
      spherical.radius*=cameraZoom;
      eye.copy(pivot).add(new THREE.Vector3().setFromSpherical(spherical)).add(cameraPan);
      if(cameraYaw!==0||cameraPitch!==0)target.copy(pivot).add(new THREE.Vector3(0,.5,0));
      target.add(cameraPan);
      camera.position.lerp(eye,instant||app.reducedMotion?1:1-Math.exp(-dt*5));camera.lookAt(target);
    }
    cameraFrame(0,true);
    const remove=app.addFrameHook(dt=>{
      if(charge)setPower(power+dt*0.65);
      if(state==='swing') {
        swingTime+=dt;
        if(swingTime>=.32) {strike(ball,angle,power);strokes++;state='rolling';sound(320);hud('Ball rolling...');}
      } else if(state==='rolling') swingTime+=dt;
      golfer.group.visible=state!=='holed' && !ball.falling && (state!=='rolling'||swingTime<1.05);
      const lie=state==='rolling'?lastLie:ball;
      golfer.group.position.set(lie.x,0,lie.z);golfer.group.rotation.y=-angle;
      const windup=-(.25+power*.5);
      const pose=state==='swing'?windup*(1-Math.min(swingTime/.32,1)):state==='rolling'?Math.sin(Math.min((swingTime-.32)/.5,1)*Math.PI)*.4:charge?windup:0;
      golfer.pose(pose);
      accumulator+=Math.min(dt,0.1);
      while(accumulator>=STEP){
        accumulator-=STEP;
        if(state==='rolling') {
          const result=stepBall(ball,COURSES[hole]);
          if(result==='cup'){showResult();break;}
          if(result==='out'){strokes++;ball={...lastLie,vx:0,vz:0};state='ready';angle-=cameraYaw;cameraYaw=0;sound(130,0.2);hud('Outside the practice grounds. +1 penalty; back to your last position.');break;}
          if(result==='bounce')sound(180,0.04);
          if(!moving(ball)&&!ball.falling){state='ready';angle-=cameraYaw;cameraYaw=0;hud('Your turn. Adjust your aim and power.');}
        }
      }
      sphere.position.set(ball.x,ball.y??RADIUS,ball.z);
      sphere.visible=true;sphere.rotation.x+=ball.vz*dt/RADIUS;sphere.rotation.z-=ball.vx*dt/RADIUS;
      if(state==='rolling')el('golf-distance').textContent=`${Math.hypot(ball.x-COURSES[hole].pin[0],ball.z-COURSES[hole].pin[1]).toFixed(1)} m to pin`;
      updateGuide();cameraFrame(dt);
      window.__GOLF__={state,hole:hole+1,strokes,ball:[ball.x,ball.z],power,aim:angle,scores:[...scores]};
    });
    return ()=>{
      remove();listeners.forEach(fn=>fn());cancel();audio?.close();
      if (oldTabIndex === null) canvas.removeAttribute('tabindex'); else canvas.setAttribute('tabindex',oldTabIndex);
      previousFocus?.focus();
      cup?.dispose();
      golfer.dispose();
      disposeGroup(root);allMaterials.forEach(m=>m.dispose());
      savedFlag.forEach((o,i)=>{if(o)o.visible=flagVisibility[i];});
      el('golf-hud').hidden=true;el('control-hint').hidden=false;window.__GOLF__=undefined;
    };
  };
}
