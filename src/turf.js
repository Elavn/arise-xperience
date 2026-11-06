import * as THREE from 'three';

// Subtle, deterministic turf grain; world-scaled UVs keep it consistent
// across the existing landscape shapes without adding geometry.
export function createTurfTexture(renderer) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);
  let seed=317;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const grain=(random()-.5)*22;
    const patch=Math.sin(x*.049)*Math.sin(y*.036)*5;
    const mow=Math.cos(y/256*Math.PI*4)*3;
    const value=Math.round(219+grain+patch+mow),i=(y*256+x)*4;
    pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return texture;
}
export function turfUVs(geometry) {
  const positions=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)/3.5,positions.getY(i)/3.5);
  uv.needsUpdate=true;
  return geometry;
}
