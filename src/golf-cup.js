import * as THREE from 'three';
import { CUP_RADIUS, CUP_DEPTH } from './golf-physics.js';

// Cut only the temporary playing cup out of the existing grass layers.
// Original landscape geometry and materials are restored when golf exits.
export function createCup(scene,parent,x,z) {
  const center=new THREE.Vector2(parent.position.x+x,parent.position.z+z);
  const originals=[];
  for(const object of scene.children) {
    const terrain=['Golf_outer_green','Golf_putting_surface','Golf_inner_surface','Golf_bunker'].includes(object.name)
      || (object.geometry?.type==='CircleGeometry' && object.geometry.parameters.radius===390);
    if(!terrain||!object.material)continue;
    const original=object.material,mat=original.clone();
    mat.onBeforeCompile=shader=>{
      shader.uniforms.cupCenter={value:center};shader.uniforms.cupRadius={value:CUP_RADIUS};
      shader.vertexShader='varying vec3 cupWorldPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncupWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader='uniform vec2 cupCenter;\nuniform float cupRadius;\nvarying vec3 cupWorldPosition;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(distance(cupWorldPosition.xz,cupCenter)<cupRadius)discard;');
    };
    mat.customProgramCacheKey=()=> 'arise-recessed-cup-v1';object.material=mat;originals.push({object,original,mat});
  }
  const group=new THREE.Group();group.position.set(x,0,z);group.name='Recessed_golf_cup';parent.add(group);
  const soil=new THREE.MeshStandardMaterial({color:0x3d3428,roughness:1,side:THREE.DoubleSide});
  const liner=new THREE.MeshStandardMaterial({color:0x77766a,roughness:.9,side:THREE.DoubleSide});
  const dark=new THREE.MeshBasicMaterial({color:0x10160e});
  function add(geometry,material,y){const m=new THREE.Mesh(geometry,material);m.position.y=y;m.receiveShadow=true;group.add(m);return m;}
  // Flush cut turf edge, exposed earth, and a liner recessed below the lip.
  add(new THREE.RingGeometry(CUP_RADIUS,CUP_RADIUS+.006,48).rotateX(-Math.PI/2),soil,.001);
  add(new THREE.CylinderGeometry(CUP_RADIUS,CUP_RADIUS,.045,48,1,true),soil,-.0225);
  add(new THREE.CylinderGeometry(CUP_RADIUS-.002,CUP_RADIUS-.002,CUP_DEPTH-.045,48,1,true),liner,-(.045+CUP_DEPTH)/2);
  add(new THREE.CircleGeometry(CUP_RADIUS,48).rotateX(-Math.PI/2),dark,-CUP_DEPTH);
  return {dispose(){originals.forEach(({object,original,mat})=>{object.material=original;mat.dispose();});group.traverse(o=>o.geometry?.dispose());soil.dispose();liner.dispose();dark.dispose();group.removeFromParent();}};
}
