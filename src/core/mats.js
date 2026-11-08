import * as THREE from 'three';
import { P } from './palette.js';

const TOON_RAMP = [0.34, 0.68, 1.0];
const cache = new Map();

function rampTexture(steps) {
  const data = new Uint8Array(steps.length * 4);
  for (let i = 0; i < steps.length; i++) {
    const v = Math.round(255 * steps[i]);
    data[i * 4 + 0] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const GRADIENT = rampTexture(TOON_RAMP);
const GRADIENT_SOFT = rampTexture([0.5, 0.78, 1.0]);

function memo(key, make) {
  let m = cache.get(key);
  if (!m) { m = make(); cache.set(key, m); }
  return m;
}

const outlineVert = [
  'uniform float uThickness;',
  'void main() {',
  '  vec3 p = position + normal * uThickness;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
  '}',
].join('\n');
const outlineFrag = [
  'uniform vec3 uColor;',
  'void main() { gl_FragColor = vec4(uColor, 1.0); }',
].join('\n');

export const M = {
  gradient: GRADIENT,
  ramp: rampTexture,

  /** 主材质：三渲二 toon。opts: { map, emissive, emissiveIntensity, soft, side, transparent, opacity } */
  cel(hex, opts) {
    const o = opts || {};
    const key = 'cel' + hex + '|' + (o.map ? o.map.uuid : '') + '|' + (o.soft ? 1 : 0) + '|' + (o.emissive || 0) + '|' + (o.double ? 1 : 0);
    return memo(key, () => {
      const m = new THREE.MeshToonMaterial({
        color: hex,
        gradientMap: o.soft ? GRADIENT_SOFT : GRADIENT,
        map: o.map || null,
        side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity == null ? 1 : o.emissiveIntensity; }
      return m;
    });
  },

  /** 店内材质：toon + 自发光，隔着玻璃也明亮（模拟被灯光照亮） */
  interior(hex, opts) {
    const o = opts || {};
    const key = 'int' + hex + '|' + (o.map ? o.map.uuid : '') + '|' + (o.glow == null ? 0.42 : o.glow);
    return memo(key, () => {
      const m = new THREE.MeshToonMaterial({ color: hex, gradientMap: GRADIENT_SOFT, map: o.map || null });
      m.emissive = new THREE.Color(hex);
      m.emissiveIntensity = o.glow == null ? 0.42 : o.glow;
      return m;
    });
  },

  /** 标准 PBR，用于金属/湿润反射面（少量使用） */
  standard(hex, opts) {
    const o = opts || {};
    const key = 'std' + hex + '|' + (o.rough == null ? 0.8 : o.rough) + '|' + (o.metal == null ? 0 : o.metal) + '|' + (o.map ? o.map.uuid : '') + '|' + (o.env ? 1 : 0);
    return memo(key, () => new THREE.MeshStandardMaterial({
      color: hex,
      roughness: o.rough == null ? 0.8 : o.rough,
      metalness: o.metal == null ? 0 : o.metal,
      map: o.map || null,
      envMapIntensity: o.env == null ? 1 : o.env,
    }));
  },

  /** 玻璃：极简透明 + 高光感，不用 transmission（性能） */
  glass(opts) {
    const o = opts || {};
    const key = 'glass' + (o.tint == null ? P.glassTint : o.tint) + '|' + (o.opacity == null ? 0.14 : o.opacity);
    return memo(key, () => new THREE.MeshPhysicalMaterial({
      color: o.tint == null ? P.glassTint : o.tint,
      transparent: true,
      opacity: o.opacity == null ? 0.14 : o.opacity,
      roughness: 0.08,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
  },

  /** 自发光平面（招牌字/灯箱/面板/灯泡）；boost>1 用于吃 bloom；map 可选（灯箱面） */
  lit(hex, boost, map) {
    const b = boost == null ? 1.6 : boost;
    return memo('lit' + hex + '|' + b + '|' + (map ? map.uuid : ''), () => {
      const c = new THREE.Color(hex);
      c.multiplyScalar(b);
      return new THREE.MeshBasicMaterial({ color: c, map: map || null, toneMapped: false });
    });
  },

  /** 柔光晕片（加法混合，用于灯晕/反光涂抹） */
  glow(hex, opacity, additive) {
    const op = opacity == null ? 0.5 : opacity;
    const add = additive === false ? THREE.NormalBlending : THREE.AdditiveBlending;
    return memo('glow' + hex + '|' + op + '|' + add, () => {
      const c = new THREE.Color(hex);
      c.multiplyScalar(1.4);
      return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: add, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    });
  },

  /** 给单个 mesh 加反向外壳描边；thickness 为世界单位 */
  outline(mesh, thickness, color) {
    if (!mesh || !mesh.geometry) return mesh;
    const t = thickness == null ? 0.03 : thickness;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uThickness: { value: t }, uColor: { value: new THREE.Color(color == null ? P.outline : color) } },
      vertexShader: outlineVert,
      fragmentShader: outlineFrag,
      side: THREE.BackSide,
    });
    const hull = new THREE.Mesh(mesh.geometry, mat);
    hull.name = '__outline';
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.raycast = () => {};
    mesh.add(hull);
    return mesh;
  },

  /** 给整个 group 的主要 mesh 描边（跳过标记 userData.noOutline 的） */
  outlineGroup(group, thickness, color) {
    group.traverse((o) => {
      if (o.isMesh && o.userData.noOutline !== true && o.name !== '__outline') {
        M.outline(o, thickness, color);
      }
    });
    return group;
  },
};

export default M;