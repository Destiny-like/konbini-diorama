import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { P } from './core/palette.js';
import { M } from './core/mats.js';
import { T } from './core/tex.js';
import { U } from './core/utils.js';

import { build as buildStreet } from './world/street.js';
import { build as buildStore } from './world/store.js';
import { build as buildProps } from './world/props.js';
import { build as buildAtmosphere } from './world/atmosphere.js';
import { createAssembly } from './world/timeline.js';

const params = new URLSearchParams(location.search);
const seekT = params.has('t') ? parseFloat(params.get('t')) : null;

function vecParam(name, fallback) {
  const raw = params.get(name);
  if (!raw) return fallback;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return fallback;
  return new THREE.Vector3(parts[0], parts[1], parts[2]);
}
const CAM_TARGET = vecParam('tgt', new THREE.Vector3(-1.0, 1.8, -1.0));
const CAM_END = vecParam('cam', new THREE.Vector3(23, 16, 25));
const CAM_START = CAM_END.clone().multiplyScalar(1.42).setY(CAM_END.y * 1.75);

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(P.skyMid);
scene.fog = new THREE.Fog(P.fog, 42, 96);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.5, 300);
camera.position.copy(CAM_START);
camera.lookAt(CAM_TARGET);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(CAM_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.75;
controls.minDistance = 18;
controls.maxDistance = 62;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = 1.36;
controls.update();

const minDistParam = params.get('min');
if (minDistParam && !isNaN(parseFloat(minDistParam))) controls.minDistance = parseFloat(minDistParam);

let userTouched = false;
controls.addEventListener('start', () => { userTouched = true; });

// ---------- world ----------
const ctx = { THREE: THREE, P: P, M: M, T: T, U: U };
const world = new THREE.Group();
world.name = 'world';
scene.add(world);

const failures = [];
function mount(name, fn) {
  try {
    const r = fn(ctx) || {};
    if (r.group) { r.group.name = name; world.add(r.group); }
    if (r.lights) { r.lights.name = name + ':lights'; scene.add(r.lights); }
    return r;
  } catch (e) {
    failures.push(name + ': ' + (e && e.message));
    console.error('[' + name + '] build failed', e);
    return {};
  }
}

const onlyParam = params.get('only');
const hideParam = params.get('hide');
const onlyList = onlyParam ? onlyParam.split(',') : null;
const hideList = hideParam ? hideParam.split(',') : [];
function wanted(name) {
  if (hideList.indexOf(name) >= 0) return false;
  if (!onlyList) return true;
  return onlyList.indexOf(name) >= 0;
}

const streetR = wanted('street') ? mount('street', buildStreet) : {};
const storeR = wanted('store') ? mount('store', buildStore) : {};
const propsR = wanted('props') ? mount('props', buildProps) : {};
const atmoR = wanted('atmosphere') ? mount('atmosphere', buildAtmosphere) : {};

if (failures.length) document.title = 'FAIL ' + failures.join(' | ');

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.55, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// 收尾调色：轻微提饱和 / 冷暗部 + 暖高光 / 暗角（三渲二夜景的层次感）
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.07 },
    uContrast: { value: 1.045 },
    uVignette: { value: 0.26 },
    uExposure: { value: 1.0 },
  },
  vertexShader: [
    'varying vec2 vUv;',
    'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  ].join('\n'),
  fragmentShader: [
    'uniform sampler2D tDiffuse;',
    'uniform float uSat;',
    'uniform float uContrast;',
    'uniform float uVignette;',
    'uniform float uExposure;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  vec3 col = c.rgb * uExposure;',
    '  col = (col - 0.5) * uContrast + 0.5;',
    '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = mix(vec3(l), col, uSat);',
    '  col += vec3(-0.010, 0.002, 0.028) * (1.0 - smoothstep(0.0, 0.45, l));',
    '  col += vec3(0.020, 0.006, -0.016) * smoothstep(0.55, 1.0, l);',
    '  vec2 d = vUv - 0.5;',
    '  col *= 1.0 - uVignette * dot(d, d) * 1.35;',
    '  gl_FragColor = vec4(col, c.a);',
    '}',
  ].join('\n'),
};
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);

// ---------- stats (验收用：draw call 代理 = 可见 mesh 数) ----------
function reportStats() {
  let meshes = 0, tris = 0, inst = 0;
  scene.traverseVisible((o) => {
    if (o.isMesh || o.isLineSegments || o.isPoints) {
      meshes++;
      if (o.isInstancedMesh) inst += o.count;
      const g = o.geometry;
      if (g) {
        const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
        tris += Math.round((n / 3) * (o.isInstancedMesh ? o.count : 1));
      }
    }
  });
  const s = (failures.length ? 'FAIL ' + failures.join(' | ') : 'OK') +
    ' meshes=' + meshes + ' tris=' + Math.round(tris / 1000) + 'k' + (inst ? ' inst=' + inst : '');
  document.title = s;
  window.__stats = s;
  return s;
}
window.__reportStats = reportStats;

// ---------- assembly timeline ----------
const assembly = createAssembly({ scene: scene, world: world });
if (seekT != null && !isNaN(seekT)) {
  assembly.seek(seekT);
  userTouched = true;
  camera.position.copy(CAM_END);
  controls.target.copy(CAM_TARGET);
  controls.update();
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

const tmpCam = new THREE.Vector3();
let introSettled = false;
function applyIntro(progress) {
  if (userTouched) return;
  if (progress >= 1) {
    if (!introSettled) {
      introSettled = true;
      camera.position.copy(CAM_END);
      controls.target.copy(CAM_TARGET);
    }
    return;
  }
  introSettled = false;
  const u = easeInOut(Math.min(1, Math.max(0, progress)));
  tmpCam.copy(CAM_START).lerp(CAM_END, u);
  camera.position.copy(tmpCam);
  controls.target.lerp(CAM_TARGET, 0.4);
}

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'm' || ev.key === 'M') {
    audio.muted = !audio.muted;
    if (audio.ready && audio.ctx) {
      audio.master.gain.setTargetAtTime(audio.muted ? 0 : 0.85, audio.ctx.currentTime, 0.25);
    }
    return;
  }
  if (ev.key === 'Escape' && tour.mode === 'inside') { exitTour(); return; }
  if (ev.key === 'r' || ev.key === 'R') {
    if (tour.mode !== 'diorama') return;
    assembly.replay();
    userTouched = false;
    controls.target.copy(CAM_TARGET);
  }
});

// ---------- 店内参观（tour）：门口按钮 → 开门 → 点击前进 → 绕店一圈 → 收银台 → 出来 ----------
const DOOR_FALLBACK = { center: [-1.2, 1.15, 3.5], normal: [0, 0, 1], width: 2.4, height: 2.3, setOpen: null };
const doorInfo = Object.assign({}, DOOR_FALLBACK, (storeR && storeR.door) || {});

const PATH_FALLBACK = [
  { p: [-1.2, 1.55, 2.55], look: [-2.4, 1.4, -0.6] },
  { p: [-3.4, 1.55, 2.35] },
  { p: [-5.8, 1.55, 2.30], look: [-6.2, 1.2, -0.9] },
  { p: [-7.90, 1.55, 1.60] },
  { p: [-8.00, 1.55, -0.60], look: [-8.60, 1.40, -1.10] },
  { p: [-8.00, 1.55, -2.90] },
  { p: [-7.60, 1.55, -4.70], look: [-4.50, 1.20, -5.40] },
  { p: [-4.60, 1.55, -4.90] },
  { p: [-1.60, 1.55, -4.80], look: [0.60, 1.30, -3.60] },
  { p: [0.90, 1.55, -3.60] },
  { p: [1.15, 1.55, -1.60], look: [2.20, 1.30, -0.40] },
  { p: [1.05, 1.55, 0.40], look: [2.35, 1.10, 0.20] },
  { p: [0.20, 1.55, 1.90] },
  { p: [-1.10, 1.55, 2.50], look: [-1.20, 1.40, 4.20] },
];
const rawPath = (storeR && storeR.interiorPath && storeR.interiorPath.length > 2) ? storeR.interiorPath : PATH_FALLBACK;
const eyePts = rawPath.map((w) => new THREE.Vector3(w.p[0], w.p[1] == null ? 1.55 : w.p[1], w.p[2]));
const tourCurve = new THREE.CatmullRomCurve3(eyePts, false, 'centripetal', 0.5);
const tourLen = Math.max(1, tourCurve.getLength());
const lookPts = rawPath.map((w) => (w.look ? new THREE.Vector3(w.look[0], w.look[1], w.look[2]) : null));
const lookUs = (function () {
  const cum = [0];
  for (let i = 1; i < eyePts.length; i++) cum.push(cum[i - 1] + eyePts[i].distanceTo(eyePts[i - 1]));
  const total = cum[cum.length - 1] || 1;
  return cum.map((d) => d / total);
})();

const counterStation = (function () {
  const list = (storeR && storeR.hotspots) || [];
  let clerkObj = null;
  for (let i = 0; i < list.length; i++) if (list[i].id === 'clerk') clerkObj = list[i].object;
  const fallbackU = lookUs[Math.max(0, lookUs.length - 3)];
  if (!clerkObj) return { u: fallbackU, pos: null };
  const cp = new THREE.Vector3();
  clerkObj.getWorldPosition(cp);
  let best = -1, bestD = 1e9;
  for (let i = 0; i < lookPts.length; i++) {
    if (!lookPts[i]) continue;
    const d = lookPts[i].distanceTo(cp);
    if (d < bestD) { bestD = d; best = i; }
  }
  return { u: best >= 0 ? lookUs[best] : fallbackU, pos: cp };
})();

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

const btnCv = T.canvas(512, 256);
{
  const g = btnCv.g;
  g.clearRect(0, 0, 512, 256);
  roundRect(g, 12, 12, 488, 232, 56);
  g.fillStyle = '#10243a';
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#7cf0bb';
  g.stroke();
  g.fillStyle = '#eafaf1';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 104px ' + T.JP;
  g.fillText('入店', 236, 118);
  g.fillStyle = '#7cf0bb';
  g.font = '700 40px ' + T.JP;
  g.fillText('ENTER', 236, 196);
  g.fillStyle = '#7cf0bb';
  g.beginPath();
  g.moveTo(404, 108); g.lineTo(444, 128); g.lineTo(404, 148);
  g.closePath();
  g.fill();
}
const btnTex = T.finish(btnCv.c, { clamp: true });
const doorBtn = new THREE.Mesh(
  new THREE.PlaneGeometry(0.94, 0.47),
  new THREE.MeshBasicMaterial({ map: btnTex, transparent: true, toneMapped: false, depthWrite: false })
);
const doorHalo = new THREE.Mesh(
  new THREE.PlaneGeometry(1.5, 0.95),
  new THREE.MeshBasicMaterial({ map: T.glowSprite(), color: new THREE.Color(0x6ef0b4).multiplyScalar(0.9), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
);
doorBtn.add(doorHalo);
const btnPos = new THREE.Vector3(doorInfo.center[0], doorInfo.center[1] + 0.30, doorInfo.center[2]);
const btnNormal = new THREE.Vector3(doorInfo.normal[0], doorInfo.normal[1], doorInfo.normal[2]).normalize();
doorBtn.position.copy(btnPos).addScaledVector(btnNormal, 0.09);
doorBtn.rotation.y = Math.atan2(btnNormal.x, btnNormal.z);
scene.add(doorBtn);

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickButton(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(doorBtn, false).length > 0;
}


// ---------- 店内交互：热点 + 3D 对话气泡 ----------
const bubbleCache = new Map();
function bubbleTexture(text) {
  let t = bubbleCache.get(text);
  if (t) return t;
  const d = T.canvas(512, 256);
  const g = d.g;
  g.clearRect(0, 0, 512, 256);
  roundRect(g, 24, 16, 464, 168, 40);
  g.fillStyle = 'rgba(255,255,255,0.96)';
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#2f6fd0';
  g.stroke();
  g.beginPath();
  g.moveTo(228, 184); g.lineTo(256, 232); g.lineTo(288, 184);
  g.closePath();
  g.fillStyle = 'rgba(255,255,255,0.96)';
  g.fill();
  g.strokeStyle = '#2f6fd0';
  g.stroke();
  g.fillStyle = '#20304a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 72px ' + T.JP;
  g.fillText(text, 256, 100);
  t = T.finish(d.c, { clamp: true });
  bubbleCache.set(text, t);
  return t;
}

const bubble = new THREE.Sprite(new THREE.SpriteMaterial({
  map: null, transparent: true, opacity: 1, depthTest: false, toneMapped: false,
}));
bubble.visible = false;
bubble.renderOrder = 999;
scene.add(bubble);
const bubbleState = { t: 0, active: false, dur: 2.5, anchor: new THREE.Vector3() };

function showBubble(text, worldPos) {
  bubble.material.map = bubbleTexture(text);
  bubble.material.needsUpdate = true;
  bubbleState.active = true;
  bubbleState.t = 0;
  bubbleState.anchor.copy(worldPos);
  bubble.position.copy(worldPos);
  bubble.scale.set(0.001, 0.001, 1);
  bubble.visible = true;
}

function updateBubble(dt) {
  if (!bubbleState.active) return;
  bubbleState.t += dt;
  const t = bubbleState.t;
  const popIn = Math.min(1, t / 0.18);
  const pop = 1 - Math.pow(1 - popIn, 3);
  const fade = t > bubbleState.dur - 0.45 ? Math.max(0, (bubbleState.dur - t) / 0.45) : 1;
  const k = (0.72 + 0.28 * pop) * fade;
  bubble.scale.set(1.15 * k, 0.575 * k, 1);
  bubble.material.opacity = Math.min(1, fade * 1.1);
  bubble.position.copy(bubbleState.anchor);
  if (t >= bubbleState.dur) { bubbleState.active = false; bubble.visible = false; }
}

const HOTSPOT_TEXT = {
  clerk: 'いらっしゃいませ！',
  pos: 'レシートをどうぞ',
  pay: 'ピッ（お支払い完了）',
};

function hotspotList() { return (storeR && storeR.hotspots) || []; }

function ndcFromEvent(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  return ndc;
}

const hotProj = new THREE.Vector3();
const hotBox = new THREE.Box3();
function hotspotScreen(h) {
  if (!h || !h.object) return null;
  if (h.object.isGroup) {
    hotBox.setFromObject(h.object);
    if (!hotBox.isEmpty()) hotBox.getCenter(hotProj); else h.object.getWorldPosition(hotProj);
  } else {
    h.object.getWorldPosition(hotProj);
  }
  const p = hotProj.clone().project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: rect.left + (p.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-p.y * 0.5 + 0.5) * rect.height,
    behind: p.z > 1,
  };
}

function pickHotspot(ev) {
  const list = hotspotList();
  if (!list.length) return null;
  const objs = [];
  for (let i = 0; i < list.length; i++) if (list[i] && list[i].object) objs.push(list[i].object);
  if (!objs.length) return null;
  raycaster.setFromCamera(ndcFromEvent(ev), camera);
  const hits = raycaster.intersectObjects(objs, true);
  if (hits.length) {
    let node = hits[0].object;
    while (node) {
      for (let i = 0; i < list.length; i++) if (list[i].object === node) return list[i];
      node = node.parent;
    }
  }
  // 屏幕空间容错：小热点（POS 屏 0.3×0.2m）在 46px 内也算点中
  const rect = renderer.domElement.getBoundingClientRect();
  let best = null, bestD = 46;
  for (let i = 0; i < list.length; i++) {
    const sp = hotspotScreen(list[i]);
    if (!sp || sp.behind) continue;
    const dx = sp.x - ev.clientX, dy = sp.y - ev.clientY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) { bestD = d; best = list[i]; }
  }
  return best;
}

const tour = {
  mode: 'diorama',
  t: 0,
  door: 0,
  s: 0,
  sTarget: 0,
  sVel: 0,
  yaw: 0,
  pitch: 0,
  dwell: 0,
  stepU: Math.min(0.22, 2.0 / tourLen),
  fromPos: new THREE.Vector3(),
  fromQuat: new THREE.Quaternion(),
  toPos: new THREE.Vector3(),
  toQuat: new THREE.Quaternion(),
  stagePos: new THREE.Vector3(),
  stageQuat: new THREE.Quaternion(),
  staged: false,
  fov: 66,
  atCounter: false,
  greeted: false,
};

function applyDoor(p) {
  tour.door = p;
  if (doorInfo.setOpen) { try { doorInfo.setOpen(p); } catch (e) {} }
}

function pathPoint(u, out) {
  const c = tourCurve.getPointAt(Math.min(1, Math.max(0, u)));
  return out.copy(c);
}

function lookTargetFor(s, out) {
  pathPoint(Math.min(1, s + 0.035), out);
  for (let i = 0; i < lookPts.length; i++) {
    if (!lookPts[i]) continue;
    const d = Math.abs(lookUs[i] - s);
    if (d < 0.12) {
      const raw = 1 - d / 0.12;
      const k = raw * raw * (3 - 2 * raw);
      out.lerp(lookPts[i], 0.7 * k);
    }
  }
  return out;
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
const lookMat = new THREE.Matrix4();
const desiredQuat = new THREE.Quaternion();
const upVec = new THREE.Vector3(0, 1, 0);
const angPrev = new THREE.Vector3();
const angNow = new THREE.Vector3();
window.__ang = { maxDeg: 0, reset: function () { this.maxDeg = 0; } };

function enterTour() {
  if (tour.mode !== 'diorama') return;
  tour.mode = 'opening';
  tour.t = 0;
  tour.s = 0;
  tour.sTarget = 0;
  tour.yaw = 0;
  tour.pitch = 0;
  tour.dwell = 0;
  tour.atCounter = false;
  tour.greeted = false;
  tour.fromPos.copy(camera.position);
  tour.fromQuat.copy(camera.quaternion);
  doorBtn.visible = false;
  controls.enabled = false;
  userTouched = true;
  camera.near = 0.06;
  camera.updateProjectionMatrix();

  // 先在门外 2.6m 处落一个过渡机位，避免从高空直接穿过屋顶
  tour.staged = false;
  tour.stagePos.copy(btnPos).setY(1.52).addScaledVector(btnNormal, 2.6);
  tmpB.set(doorInfo.center[0], 1.35, doorInfo.center[2]);
  tmpQ.setFromRotationMatrix(new THREE.Matrix4().lookAt(tour.stagePos, tmpB, new THREE.Vector3(0, 1, 0)));
  tour.stageQuat.copy(tmpQ);
}

function exitTour() {
  if (tour.mode !== 'inside') return;
  tour.mode = 'exiting';
  tour.t = 0;
  tour.fromPos.copy(camera.position);
  tour.fromQuat.copy(camera.quaternion);
  tour.toPos.copy(CAM_END);
  tmpQ.setFromRotationMatrix(new THREE.Matrix4().lookAt(CAM_END, CAM_TARGET, new THREE.Vector3(0, 1, 0)));
  tour.toQuat.copy(tmpQ);
}

function finishTour() {
  tour.mode = 'diorama';
  camera.near = 0.5;
  camera.updateProjectionMatrix();
  camera.position.copy(CAM_END);
  controls.target.copy(CAM_TARGET);
  controls.enabled = true;
  controls.update();
  doorBtn.visible = true;
  if (atmoR && atmoR.setIndoor) { try { atmoR.setIndoor(false); } catch (e) {} }
}

function updateTour(dt) {
  const pulse = 1 + Math.sin(elapsed * 2.6) * 0.03;
  doorBtn.scale.setScalar(pulse);
  doorHalo.material.opacity = 0.30 + 0.12 * (0.5 + 0.5 * Math.sin(elapsed * 2.6));

  if (tour.mode === 'opening') {
    tour.t += dt;
    applyDoor(Math.min(1, tour.t / 0.75));
    if (tour.t >= 0.75) {
      tour.mode = 'entering';
      tour.t = 0;
      tour.fromPos.copy(camera.position);
      pathPoint(0, tour.toPos);
      lookTargetFor(0.01, tmpB);
      tmpQ.setFromRotationMatrix(new THREE.Matrix4().lookAt(tour.toPos, tmpB, new THREE.Vector3(0, 1, 0)));
      tour.toQuat.copy(tmpQ);
    }
    return true;
  }
  if (tour.mode === 'entering') {
    tour.t += dt;
    const T1 = 0.95, T2 = 1.05;
    if (tour.t < T1) {
      const k = easeInOut(Math.min(1, tour.t / T1));
      camera.position.lerpVectors(tour.fromPos, tour.stagePos, k);
      camera.quaternion.copy(tour.fromQuat).slerp(tour.stageQuat, k);
    } else {
      tour.staged = true;
      const k = easeInOut(Math.min(1, (tour.t - T1) / T2));
      camera.position.lerpVectors(tour.stagePos, tour.toPos, k);
      camera.quaternion.copy(tour.stageQuat).slerp(tour.toQuat, k);
    }
    if (tour.t >= T1 + T2) {
      tour.mode = 'inside';
      tour.s = 0;
      tour.sTarget = 0;
      if (atmoR && atmoR.setIndoor) { try { atmoR.setIndoor(true); } catch (e) {} }
    }
    return true;
  }
  if (tour.mode === 'inside') {
    const prevS = tour.s;

    // SmoothDamp：起停柔和、无过冲
    const smoothTime = 0.45;
    const omega = 2 / smoothTime;
    const xw = omega * dt;
    const expw = 1 / (1 + xw + 0.48 * xw * xw + 0.235 * xw * xw * xw);
    const change = tour.s - tour.sTarget;
    const temp = (tour.sVel + omega * change) * dt;
    tour.sVel = (tour.sVel - omega * temp) * expw;
    tour.s = tour.sTarget + (change + temp) * expw;
    if (tour.sTarget >= 1 && tour.s > 0.9992) { tour.s = 1; tour.sVel = 0; }
    if (tour.s < 0.0008 && tour.sTarget <= 0) { tour.s = 0; tour.sVel = 0; }

    const speed = Math.abs(tour.s - prevS) / Math.max(1e-4, dt);
    const moving = speed > 0.0006;
    pathPoint(tour.s, tmpA);
    if (tour.atCounter && counterStation.pos) {
      const back = tmpA.clone().sub(counterStation.pos);
      back.y = 0;
      if (back.lengthSq() > 0.0001) {
        back.normalize().multiplyScalar(0.45);
        tmpA.x += back.x;
        tmpA.z += back.z;
      }
    }
    tmpA.y += moving ? Math.sin(elapsed * 6.2) * 0.009 : Math.sin(elapsed * 1.5) * 0.004;
    camera.position.copy(tmpA);

    if (tour.atCounter && counterStation.pos) {
      tmpB.set(counterStation.pos.x, 1.34, counterStation.pos.z);
    } else {
      lookTargetFor(tour.s, tmpB);
    }
    tmpB.sub(tmpA);
    tmpE.set(tour.pitch, tour.yaw, 0);
    tmpQ.setFromEuler(tmpE);
    tmpB.applyQuaternion(tmpQ).add(tmpA);
    lookMat.lookAt(tmpA, tmpB, upVec);
    desiredQuat.setFromRotationMatrix(lookMat);
    camera.quaternion.slerp(desiredQuat, 1 - Math.exp(-6.5 * dt));
    const nearCounter = Math.abs(tour.s - counterStation.u) < 0.006;
    if (nearCounter && !tour.atCounter) {
      tour.atCounter = true;
      if (!tour.greeted) {
        tour.greeted = true;
        if (storeR && storeR.interact) { try { storeR.interact('clerk'); } catch (e) {} }
        if (counterStation.pos) {
          const bp = counterStation.pos.clone();
          bp.y = 2.06;
          showBubble('いらっしゃいませ！', bp);
        }
      }
    } else if (!nearCounter && tour.s > counterStation.u + 0.01) {
      tour.atCounter = false;
    }

    const wantExit = tour.sTarget >= 0.999 && tour.s >= 0.995;
    tour.dwell = wantExit ? tour.dwell + dt : 0;
    if (tour.dwell > 0.7) exitTour();
    return true;
  }
  if (tour.mode === 'exiting') {
    tour.t += dt;
    const k = easeInOut(Math.min(1, tour.t / 1.4));
    camera.position.lerpVectors(tour.fromPos, tour.toPos, k);
    camera.quaternion.copy(tour.fromQuat).slerp(tour.toQuat, k);
    applyDoor(Math.max(0, 1 - Math.min(1, tour.t / 0.6)));
    if (tour.t >= 1.4) finishTour();
    return true;
  }
  return false;
}

let downX = 0, downY = 0, dragging = false, moved = false;
let holdT = 0, holding = false, holdWalking = false;
const canvasEl = renderer.domElement;
canvasEl.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  downX = ev.clientX; downY = ev.clientY;
  dragging = true; moved = false;
  holdT = 0; holding = true; holdWalking = false;
});
canvasEl.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  const dx = ev.clientX - downX;
  const dy = ev.clientY - downY;
  if (Math.abs(dx) + Math.abs(dy) > 7) moved = true;
  if (!moved && tour.mode === 'inside') {
    canvasEl.style.cursor = pickHotspot(ev) ? 'pointer' : 'default';
  }
  if (moved && tour.mode === 'inside') {
    tour.yaw = Math.max(-1.35, Math.min(1.35, tour.yaw - dx * 0.0042));
    tour.pitch = Math.max(-0.62, Math.min(0.62, tour.pitch - dy * 0.0032));
    downX = ev.clientX; downY = ev.clientY;
  }
});
canvasEl.addEventListener('wheel', (ev) => {
  if (tour.mode !== 'inside' && tour.mode !== 'entering') return;
  ev.preventDefault();
  const step = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
  tour.fov = Math.max(40, Math.min(92, tour.fov + step * 0.035));
}, { passive: false });

canvasEl.addEventListener('pointerup', (ev) => {
  const wasDrag = moved;
  const wasHoldWalk = holdWalking;
  dragging = false; holding = false; holdWalking = false; holdT = 0;
  if (wasHoldWalk) return;
  if (wasDrag) return;
  if (tour.mode === 'diorama') {
    if (pickButton(ev)) enterTour();
  } else if (tour.mode === 'inside') {
    const hot = pickHotspot(ev);
    if (hot) {
      if (storeR && storeR.interact) { try { storeR.interact(hot.id); } catch (e) {} }
      const p = new THREE.Vector3();
      if (hot.object) hot.object.getWorldPosition(p);
      p.y = (hot.anchorY == null ? 1.75 : hot.anchorY) + 0.26;
      showBubble(HOTSPOT_TEXT[hot.id] || '……', p);
    } else if (tour.atCounter) {
      tour.sTarget = 1;
      tour.yaw = 0;
      tour.pitch = 0;
    } else {
      let next = Math.min(1, tour.sTarget + tour.stepU);
      if (tour.sTarget < counterStation.u - 0.001 && next > counterStation.u) next = counterStation.u;
      tour.sTarget = next;
      tour.yaw *= 0.3;
      tour.pitch *= 0.3;
    }
  }
});

if (params.get('inside')) {
  if (seekT == null) assembly.seek(999);
  const s0 = Math.max(0, Math.min(1, parseFloat(params.get('s') || '0.02') || 0.02));
  tour.mode = 'inside';
  tour.s = params.get('at') === 'counter' ? counterStation.u : s0;
  tour.sTarget = tour.s;
  if (params.get('at') === 'counter') tour.atCounter = true;
  applyDoor(1);
  doorBtn.visible = false;
  controls.enabled = false;
  userTouched = true;
  camera.near = 0.06;
  camera.updateProjectionMatrix();
  if (atmoR && atmoR.setIndoor) { try { atmoR.setIndoor(true); } catch (e) {} }
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ---------- loop ----------
let indoorFactor = 0;
let last = performance.now();
let elapsed = seekT != null ? seekT : 0;
let frames = 0;

function frame(now) {
  const dtRaw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, Math.max(0, dtRaw));
  elapsed += dt;

  assembly.update(dt);
  if (streetR.update) streetR.update(dt, elapsed);
  if (storeR.update) storeR.update(dt, elapsed);
  if (propsR.update) propsR.update(dt, elapsed);
  if (atmoR.update) atmoR.update(dt, elapsed, camera);

  const indoors = (tour.mode === 'inside' || tour.mode === 'entering') ? 1 : 0;
  indoorFactor += (indoors - indoorFactor) * Math.min(1, dt * 3.2);
  bloom.strength = 0.42 - 0.27 * indoorFactor;
  gradePass.uniforms.uExposure.value = 1.0 - 0.14 * indoorFactor;
  gradePass.uniforms.uVignette.value = 0.26 - 0.10 * indoorFactor;
  gradePass.uniforms.uSat.value = 1.07 + 0.10 * indoorFactor;

  const wantFov = 32 + (tour.fov - 32) * indoorFactor;
  if (Math.abs(camera.fov - wantFov) > 0.02) {
    camera.fov = wantFov;
    camera.updateProjectionMatrix();
  }

  if (holding && !moved && tour.mode === 'inside' && !tour.atCounter) {
    holdT += dt;
    if (holdT > 0.35) {
      holdWalking = true;
      let next = Math.min(1, tour.sTarget + dt * 0.12);
      if (tour.sTarget < counterStation.u - 0.001 && next > counterStation.u) next = counterStation.u;
      tour.sTarget = next;
      tour.yaw *= 0.9;
      tour.pitch *= 0.9;
    }
  }

  updateAudio(dt);
  updateBubble(dt);
  const inTour = updateTour(dt);
  if (!inTour) {
    applyIntro(assembly.progress);
    controls.update();
  }
  composer.render();

  camera.getWorldDirection(angNow);
  if (frames > 3) {
    const dot = Math.max(-1, Math.min(1, angPrev.dot(angNow)));
    const deg = Math.acos(dot) * 180 / Math.PI;
    if (deg < 40 && deg > window.__ang.maxDeg) window.__ang.maxDeg = deg;
  }
  angPrev.copy(angNow);

  if (frames++ === 1) window.__READY = true;
  if (frames === 2) reportStats();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


// ---------- 合成雨声（Web Audio，无外部音频文件） ----------
const audio = {
  ready: false,
  muted: false,
  ctx: null,
  master: null,
  rain: null,
  hum: null,
  lastPush: 0,
  d: 0,
};

function initAudio() {
  if (audio.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let ctx;
  try { ctx = new AC(); } catch (e) { return; }
  audio.ctx = ctx;

  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  audio.master = master;

  // 3 秒立体声粉噪（左右去相关，听感更宽）
  const len = Math.floor(ctx.sampleRate * 3);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let pink = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      pink = (pink + 0.02 * w) / 1.02;
      d[i] = w * 0.42 + pink * 2.4;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 240;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  lp.Q.value = 0.6;

  const rainGain = ctx.createGain();
  rainGain.gain.value = 0.0;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(rainGain);
  rainGain.connect(master);
  src.start(0);

  // 阵风：极慢 LFO 轻微起伏，避免像白噪音机器
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.085;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.05;
  lfo.connect(lfoGain);
  lfoGain.connect(rainGain.gain);
  lfo.start(0);

  // 店内环境低鸣（冷柜/空调），只在进店时淡入
  const humGain = ctx.createGain();
  humGain.gain.value = 0.0;
  humGain.connect(master);
  const humA = ctx.createOscillator();
  humA.type = 'sine';
  humA.frequency.value = 118;
  const humAg = ctx.createGain();
  humAg.gain.value = 0.6;
  humA.connect(humAg);
  humAg.connect(humGain);
  humA.start(0);
  const humB = ctx.createOscillator();
  humB.type = 'sine';
  humB.frequency.value = 177;
  const humBg = ctx.createGain();
  humBg.gain.value = 0.22;
  humB.connect(humBg);
  humBg.connect(humGain);
  humB.start(0);

  audio.rain = { gain: rainGain, lp: lp, hp: hp };
  audio.hum = { gain: humGain };
  audio.ready = true;
  master.gain.setTargetAtTime(audio.muted ? 0 : 0.85, ctx.currentTime, 0.8);
}

function ensureAudio() {
  initAudio();
  if (audio.ctx && audio.ctx.state === 'suspended') {
    try { audio.ctx.resume(); } catch (e) {}
  }
}

const STORE_CENTER = new THREE.Vector3(-2.75, 1.6, -2.75);

function updateAudio(dt) {
  if (!audio.ready) return;
  audio.lastPush += dt;
  if (audio.lastPush < 0.12) return;
  audio.lastPush = 0;
  const ctx = audio.ctx;
  const t = ctx.currentTime;

  // 离便利店越近，雨声越小（屋檐/雨棚遮挡），进店后几乎只剩闷响
  const d = camera.position.distanceTo(STORE_CENTER);
  audio.d = d;
  // 30m 之外是完整雨声，8m 之内是屋檐下的雨声
  let near = Math.max(0, Math.min(1, (30 - d) / 22));
  near = near * near * (3 - 2 * near);
  const indoor = indoorFactor;
  const rainTarget = 0.34 * (1 - 0.55 * near) * (1 - 0.67 * indoor);
  audio.rain.gain.gain.setTargetAtTime(rainTarget, t, 0.25);

  // 进店后低通下沉：雨变成远处闷响
  const cutoff = 2600 - 1850 * indoor;
  audio.rain.lp.frequency.setTargetAtTime(cutoff, t, 0.35);
  audio.rain.hp.frequency.setTargetAtTime(240 + 320 * indoor, t, 0.35);
  audio.hum.gain.gain.setTargetAtTime(0.05 * indoor, t, 0.5);
}

window.addEventListener('pointerdown', ensureAudio, { passive: true });
window.addEventListener('keydown', ensureAudio);

window.__hotspotScreen = function (id) {
  const list = hotspotList();
  let h = null;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) h = list[i];
  const sp = hotspotScreen(h);
  if (!sp) return null;
  return { x: Math.round(sp.x), y: Math.round(sp.y), behind: sp.behind };
};
window.__bubble = function () {
  return { visible: bubble.visible, y: Math.round(bubble.position.y * 100) / 100, opacity: Math.round(bubble.material.opacity * 100) / 100 };
};
window.__hotspotIds = function () { return hotspotList().map(function (h) { return h.id; }); };

window.__tour = function () {
  return {
    mode: tour.mode,
    s: Math.round(tour.s * 1000) / 1000,
    sTarget: Math.round(tour.sTarget * 1000) / 1000,
    door: Math.round(tour.door * 100) / 100,
    fov: Math.round(camera.fov * 10) / 10,
    yaw: Math.round(tour.yaw * 100) / 100,
    pitch: Math.round(tour.pitch * 100) / 100,
    pathPoints: rawPath.length,
    curveLen: Math.round(tourLen * 10) / 10,
    indoor: atmoR && atmoR.indoor === true,
    atCounter: tour.atCounter,
    audio: audio.ready ? {
      state: audio.ctx.state,
      muted: audio.muted,
      gain: Math.round(audio.rain.gain.gain.value * 1000) / 1000,
      lp: Math.round(audio.rain.lp.frequency.value),
      hum: Math.round(audio.hum.gain.gain.value * 1000) / 1000,
      dist: Math.round(audio.d * 10) / 10,
    } : null,
    counterU: Math.round(counterStation.u * 1000) / 1000,
  };
};
window.__btnScreen = function () {
  const v = new THREE.Vector3();
  doorBtn.getWorldPosition(v);
  v.project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: Math.round(rect.left + (v.x * 0.5 + 0.5) * rect.width),
    y: Math.round(rect.top + (-v.y * 0.5 + 0.5) * rect.height),
    visible: doorBtn.visible,
  };
};

window.__dbg = function () {
  return {
    frames: frames,
    elapsed: Math.round(elapsed * 100) / 100,
    progress: Math.round(assembly.progress * 1000) / 1000,
    done: assembly.done,
    stats: window.__stats || '',
    cam: [Math.round(camera.position.x), Math.round(camera.position.y), Math.round(camera.position.z)],
  };
};
window.__scene = scene;
window.__camera = camera;
window.__renderer = renderer;