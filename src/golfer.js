import * as THREE from 'three';

// Original procedural character: no external model or asset licence required.
export function createGolfer() {
  const group = new THREE.Group();
  group.name = 'Golfer';
  const materials = {
    skin: new THREE.MeshStandardMaterial({color:0x633b29,roughness:0.85}),
    shirt: new THREE.MeshStandardMaterial({color:0x172c29,roughness:0.95}),
    trousers: new THREE.MeshStandardMaterial({color:0x24272a,roughness:0.95}),
    shoes: new THREE.MeshStandardMaterial({color:0x151719,roughness:0.7}),
    trim: new THREE.MeshStandardMaterial({color:0xd9d6c8,roughness:0.8}),
    steel: new THREE.MeshStandardMaterial({color:0xb9c4c9,metalness:0.9,roughness:0.25}),
  };
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  function part(geo,mat,pos,parent=group) {
    const m = new THREE.Mesh(geo,materials[mat]);m.position.copy(pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function ellipsoid(mat,pos,scale,parent=group) {
    const m=part(new THREE.SphereGeometry(1,20,14),mat,pos,parent);m.scale.set(...scale);return m;
  }
  function limb(mat,a,b,r1,r2,parent=group) {
    const m=part(new THREE.CylinderGeometry(r1,r2,1,12),mat,v(0,0,0),parent);
    orient(m,a,b);return m;
  }
  function orient(m,a,b) {
    m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=a.distanceTo(b);
    m.quaternion.setFromUnitVectors(v(0,1,0),b.clone().sub(a).normalize());
  }
  // A side-on putting stance, to the left of the ball, facing along +X.
  for(const z of [-.28,.28]) {
    ellipsoid('shoes',v(-1.02,.1,z),[.25,.1,.13]);
    const knee=v(-.9,.57,z), hip=v(-1.04,1.02,z*.6);
    limb('trousers',v(-1.08,.18,z),knee,.10,.085);
    limb('trousers',knee,hip,.135,.11);
  }
  ellipsoid('trousers',v(-1.04,1.04,0),[.18,.18,.27]);
  const torso=ellipsoid('shirt',v(-.94,1.39,0),[.22,.38,.31]);torso.rotation.z=-.18;
  limb('skin',v(-.86,1.68,0),v(-.79,1.84,0),.085,.09);
  const head=ellipsoid('skin',v(-.72,1.93,0),[.16,.21,.16]);head.rotation.z=-.3;
  ellipsoid('skin',v(-.55,1.92,0),[.065,.055,.045]);
  for(const z of [-.16,.16])ellipsoid('skin',v(-.73,1.94,z),[.045,.06,.025]);
  ellipsoid('shoes',v(-.73,2.08,0),[.17,.1,.17]);
  const brim=part(new THREE.BoxGeometry(.23,.025,.32),'shirt',v(-.54,2.055,0));brim.rotation.z=-.15;
  for(const z of [-.077,.077])ellipsoid('shoes',v(-.573,1.975,z),[.013,.015,.012]);
  const collar=part(new THREE.TorusGeometry(.1,.024,6,20),'trim',v(-.84,1.73,0));collar.rotation.x=Math.PI/2;
  // The shaft, grip, hands and putter head rotate around a common hand pivot.
  const swing=new THREE.Group();swing.position.set(-.4,1.08,.12);group.add(swing);
  const end=v(.4,-.89,0);
  limb('steel',v(0,0,0),end,.012,.016,swing);
  limb('shoes',v(-.02,.04,0),end.clone().multiplyScalar(.22),.024,.024,swing);
  part(new THREE.BoxGeometry(.3,.09,.10),'steel',end,swing);
  ellipsoid('skin',v(-.02,.025,0),[.065,.09,.065],swing);
  ellipsoid('skin',v(.02,-.07,0),[.06,.08,.06],swing);
  const arms=[];
  for(const z of [-.25,.25]) {
    const shoulder=v(-.88,1.6,z), elbow=v(-.65,1.27,z*.85);
    limb('shirt',shoulder,elbow,.095,.08);
    arms.push({mesh:limb('skin',elbow,v(-.4,1.08,.12),.065,.045),elbow});
  }
  function pose(backSwing=0) {
    swing.rotation.x=backSwing;
    for(const {mesh,elbow} of arms) orient(mesh,elbow,v(-.4,1.08,.12));
  }
  return {group,pose,dispose(){group.traverse(o=>o.geometry?.dispose());Object.values(materials).forEach(m=>m.dispose());group.removeFromParent();}};
}
