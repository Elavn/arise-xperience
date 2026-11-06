import * as THREE from 'three';

// Compact whole plants together, after generation, so removing a tree never
// changes the seeded positions or appearance of the remaining vegetation.
export function removeTreesOnHardscape(parts, surfaces, clearance = 0.75) {
  surfaces.forEach(surface => surface.updateWorldMatrix(true, false));
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const offsets = [[0, 0]];
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    offsets.push([Math.cos(angle) * clearance, Math.sin(angle) * clearance]);
  }
  const count = parts[0].mesh.count / parts[0].perTree;
  let kept = 0;
  for (let tree = 0; tree < count; tree += 1) {
    parts[0].mesh.getMatrixAt(tree * parts[0].perTree, matrix);
    const x = matrix.elements[12];
    const z = matrix.elements[14];
    const blocked = offsets.some(([dx, dz]) => {
      ray.ray.origin.set(x + dx, 100, z + dz);
      return ray.intersectObjects(surfaces, false).length > 0;
    });
    if (blocked) continue;
    for (const { mesh, perTree } of parts) {
      for (let part = 0; part < perTree; part += 1) {
        const source = tree * perTree + part;
        const target = kept * perTree + part;
        mesh.getMatrixAt(source, matrix);
        mesh.setMatrixAt(target, matrix);
        if (mesh.instanceColor) {
          mesh.getColorAt(source, color);
          mesh.setColorAt(target, color);
        }
      }
    }
    kept += 1;
  }
  for (const { mesh, perTree } of parts) {
    mesh.count = kept * perTree;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  return count - kept;
}
