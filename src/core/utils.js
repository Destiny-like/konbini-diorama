import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const DEG = Math.PI / 180;

export const U = {
  deg: (d) => d * DEG,

  box(w, h, d, mat, opts) {
    const o = opts || {};
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (o.ry) m.rotation.y = o.ry;
    if (o.rx) m.rotation.x = o.rx;
    if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false;
    m.receiveShadow = o.recv !== false;
    if (o.noOutline) m.userData.noOutline = true;
    return m;
  },

  plane(w, d, mat, opts) {
    const o = opts || {};
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (o.ry) m.rotation.z = -o.ry;
    m.receiveShadow = o.recv !== false;
    m.castShadow = false;
    if (o.noOutline) m.userData.noOutline = true;
    return m;
  },

  quad(w, h, mat, opts) {
    const o = opts || {};
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (o.ry) m.rotation.y = o.ry;
    if (o.rx) m.rotation.x = o.rx;
    m.castShadow = false;
    m.receiveShadow = o.recv === true;
    if (o.noOutline) m.userData.noOutline = true;
    return m;
  },

  cyl(rTop, rBottom, h, seg, mat, opts) {
    const o = opts || {};
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg || 12), mat);
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (o.rx) m.rotation.x = o.rx;
    if (o.rz) m.rotation.z = o.rz;
    if (o.ry) m.rotation.y = o.ry;
    m.castShadow = o.cast !== false;
    m.receiveShadow = o.recv !== false;
    if (o.noOutline) m.userData.noOutline = true;
    return m;
  },

  sphere(r, mat, opts) {
    const o = opts || {};
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, o.seg || 12, o.seg2 || 8), mat);
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    m.castShadow = o.cast !== false;
    m.receiveShadow = o.recv !== false;
    if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
    if (o.noOutline) m.userData.noOutline = true;
    return m;
  },

  group(children, opts) {
    const o = opts || {};
    const g = new THREE.Group();
    (children || []).forEach((c) => { if (c) g.add(c); });
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (o.ry) g.rotation.y = o.ry;
    return g;
  },

  at(obj, x, y, z, ry) {
    obj.position.set(x, y, z);
    if (ry) obj.rotation.y = ry;
    return obj;
  },

  mark(obj, asm) {
    if (obj && asm) obj.userData.asm = asm;
    return obj;
  },

  merge(meshes, material) {
    const geos = [];
    for (const m of meshes) {
      if (!m || !m.geometry) continue;
      m.updateMatrix();
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrix);
      if (!g.attributes.uv) {
        const n = g.attributes.position.count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      }
      geos.push(g);
    }
    if (!geos.length) return null;
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, material || (meshes[0] && meshes[0].material));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  inst(geometry, material, list, opts) {
    const o = opts || {};
    const im = new THREE.InstancedMesh(geometry, material, list.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      dummy.position.set(it.p[0], it.p[1], it.p[2]);
      if (it.r) dummy.rotation.set(it.r[0], it.r[1], it.r[2]); else dummy.rotation.set(0, 0, 0);
      if (it.s) dummy.scale.set(it.s[0], it.s[1], it.s[2]); else dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = o.cast !== false;
    im.receiveShadow = o.recv !== false;
    return im;
  },

  segCyl(a, b, r, mat, seg) {
    const A = new THREE.Vector3(a[0], a[1], a[2]);
    const B = new THREE.Vector3(b[0], b[1], b[2]);
    const d = new THREE.Vector3().subVectors(B, A);
    const len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 6), mat);
    m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.castShadow = true;
    return m;
  },

  wire(a, b, sag, r, mat, segs) {
    const n = segs || 10;
    const A = new THREE.Vector3(a[0], a[1], a[2]);
    const B = new THREE.Vector3(b[0], b[1], b[2]);
    const g = new THREE.Group();
    let prev = A.clone();
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(A, B, t);
      p.y -= Math.sin(Math.PI * t) * sag;
      g.add(U.segCyl([prev.x, prev.y, prev.z], [p.x, p.y, p.z], r, mat, 4));
      prev = p;
    }
    return g;
  },

  shadows(obj, cast, recv) {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = recv; } });
    return obj;
  },
};

export default U;