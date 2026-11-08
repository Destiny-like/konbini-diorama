// Worker C · 街景道具：贩卖机 / 自行车 / 雨伞架 / 分类桶 / 护栏 / 路灯 / 电线杆+电线 / 路牌 / 公告栏 / 小巷杂物 / 盆栽 / 交通锥
import * as THREE from 'three';
import { P } from '../core/palette.js';
import { M } from '../core/mats.js';
import { T } from '../core/tex.js';
import { U } from '../core/utils.js';

const SW = 0.14;          // 人行道顶面
const AL = 0.06;          // 小巷地面
const HALF = Math.PI / 2;

// ---------------------------------------------------------------- 局部材质
// M.glow() 不支持贴图（会渲染成硬边矩形），这里补一个带径向贴图的加法材质
const _gm = new Map();
function glowMat(map, hex, opacity) {
  const key = hex + '|' + opacity + '|' + (map ? map.uuid : '');
  let m = _gm.get(key);
  if (!m) {
    const c = new THREE.Color(hex).multiplyScalar(1.3);
    m = new THREE.MeshBasicMaterial({
      map: map || null, color: c, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    });
    _gm.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------- 程序化贴图
function kitTextures() {
  if (kitTextures._c) return kitTextures._c;
  const K = {};

  // 禁止停车（蓝底 + 红圈 + 斜杠）
  {
    const d = T.canvas(256, 256), g = d.g;
    g.fillStyle = '#1b4a94'; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#eef3f8'; g.lineWidth = 13;
    g.beginPath(); g.arc(128, 128, 115, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#c9484a'; g.lineWidth = 16;
    g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 24; g.beginPath(); g.moveTo(50, 206); g.lineTo(206, 50); g.stroke();
    K.noParking = T.finish(d.c, { clamp: true });
  }

  // 街名牌
  {
    const d = T.canvas(512, 128), g = d.g;
    g.fillStyle = '#f1f4f8'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#2c5c8f'; g.lineWidth = 9; g.strokeRect(5, 5, 502, 118);
    g.fillStyle = '#1d283c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 60px ' + T.JP; g.fillText('ひだまり通り', 256, 60);
    g.fillStyle = '#3a4a63'; g.font = '600 21px ' + T.JP;
    g.fillText('HIDAMARI-DORI', 256, 103);
    K.street = T.finish(d.c, { clamp: true });
  }

  // 巷口小路牌
  {
    const d = T.canvas(384, 160), g = d.g;
    g.fillStyle = '#eef2f7'; g.fillRect(0, 0, 384, 160);
    g.strokeStyle = '#2f7a63'; g.lineWidth = 10; g.strokeRect(5, 5, 374, 150);
    g.fillStyle = '#23303f'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 58px ' + T.JP; g.fillText('ひだまり横丁', 192, 70);
    g.fillStyle = '#4a5a70'; g.font = '600 24px ' + T.JP;
    g.fillText('ろじ 20m 先', 192, 124);
    K.alley = T.finish(d.c, { clamp: true });
  }

  // 电线杆竖条告示
  {
    const d = T.canvas(128, 384), g = d.g;
    g.fillStyle = '#eae7dc'; g.fillRect(0, 0, 128, 384);
    g.fillStyle = '#2f5f8f'; g.fillRect(0, 0, 128, 46);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 26px ' + T.JP; g.fillText('ひだまり', 64, 24);
    g.fillStyle = '#28303c'; g.font = '700 40px ' + T.JP;
    g.fillText('防', 64, 104); g.fillText('犯', 64, 168); g.fillText('カ', 64, 232);
    g.fillStyle = '#c9484a'; g.font = '700 34px ' + T.JP;
    g.fillText('カメラ', 64, 300); g.fillText('作動中', 64, 344);
    K.stripA = T.finish(d.c, { clamp: true });
  }
  {
    const d = T.canvas(128, 384), g = d.g;
    g.fillStyle = '#dfe4ea'; g.fillRect(0, 0, 128, 384);
    g.strokeStyle = '#8a94a4'; g.lineWidth = 6; g.strokeRect(4, 4, 120, 376);
    g.fillStyle = '#2b3444'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 44px ' + T.JP;
    g.fillText('電', 64, 66); g.fillText('柱', 64, 122);
    g.font = '700 22px ' + T.JP; g.fillStyle = '#4a5668';
    g.fillText('No.', 64, 210); g.font = '700 34px monospace';
    g.fillText('17', 64, 254);
    g.fillStyle = '#c9484a'; g.fillRect(16, 300, 96, 8);
    g.fillStyle = '#4a5668'; g.font = '600 20px ' + T.JP;
    g.fillText('ひだまり町会', 64, 340);
    K.stripB = T.finish(d.c, { clamp: true });
  }

  // 回收标识贴纸（不透明小牌，避免 alpha 需求）
  {
    const d = T.canvas(160, 160), g = d.g;
    g.fillStyle = '#eef1f4'; g.fillRect(0, 0, 160, 160);
    g.strokeStyle = '#c3cbd6'; g.lineWidth = 6; g.strokeRect(3, 3, 154, 154);
    g.strokeStyle = '#2f7a4f'; g.lineWidth = 9; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(80, 30); g.lineTo(134, 122); g.lineTo(26, 122); g.closePath(); g.stroke();
    g.fillStyle = '#2f7a4f';
    g.beginPath(); g.moveTo(80, 22); g.lineTo(96, 52); g.lineTo(64, 52); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(140, 128); g.lineTo(118, 100); g.lineTo(110, 128); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(20, 128); g.lineTo(42, 100); g.lineTo(50, 128); g.closePath(); g.fill();
    g.fillStyle = '#37455a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 20px ' + T.JP; g.fillText('リサイクル', 80, 146);
    K.recycle = T.finish(d.c, { clamp: true });
  }

  K.ring = T.glowSprite('rgba(255,255,255,0.95)', 'rgba(255,255,255,0.22)');
  kitTextures._c = K;
  return K;
}

// ---------------------------------------------------------------- 贩卖机
function buildVending(K, accent, bodyHex) {
  const g = new THREE.Group();
  const W = 1.0, H = 1.85, D = 0.75;
  const body = U.box(D, H, W, M.cel(bodyHex), { y: H / 2 });
  M.outline(body, 0.025);
  g.add(body);
  g.add(U.box(D + 0.03, 0.10, W + 0.03, M.cel(P.metalDark), { y: 0.05 }));
  // 正面发光面（含顶部灯带）
  g.add(U.quad(W - 0.03, 1.62, M.lit(0xffffff, 1.35, T.vendingFace(accent)), { x: D / 2 + 0.006, y: 0.91, ry: HALF }));
  g.add(U.quad(W - 0.06, 0.09, M.lit(accent, 2.8), { x: D / 2 + 0.007, y: 1.78, ry: HALF }));
  // 正面加法光晕
  const halo = U.quad(1.5, 2.0, glowMat(K.ring, accent, 0.11), { x: D / 2 + 0.04, y: 0.95, ry: HALF });
  g.add(halo);
  // 地面暖白反光
  g.add(U.plane(2.0, 1.8, glowMat(K.ring, 0xffe6c0, 0.26), { x: D / 2 + 0.5, y: 0.006, z: 0 }));
  return { g: g, halo: halo };
}

// ---------------------------------------------------------------- 自行车
function buildBike() {
  const g = new THREE.Group();
  const mRub = M.cel(P.rubber);
  const mFrm = M.cel(P.metalDark);
  const mStl = M.cel(P.stainless);
  const rub = [], frm = [], stl = [];

  const WX = 0.56, TR = 0.30, TT = 0.035, WY = TR + TT;
  for (const wx of [-WX, WX]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(TR, TT, 5, 20), mRub);
    tire.position.set(wx, WY, 0); rub.push(tire);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TR - TT - 0.015, 0.012, 4, 20), mStl);
    rim.position.set(wx, WY, 0); stl.push(rim);
    stl.push(U.cyl(0.03, 0.03, 0.08, 8, mStl, { x: wx, y: WY, rx: HALF }));
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2 + 0.2;
      stl.push(U.segCyl(
        [wx, WY, 0],
        [wx + Math.cos(a) * (TR - TT - 0.02), WY + Math.sin(a) * (TR - TT - 0.02), 0],
        0.0055, mStl, 3));
    }
  }

  const BB = [0, 0.30, 0];
  const seat = [0.16, 0.72, 0];
  const headT = [-0.35, 0.70, 0];
  const headB = [-0.40, 0.60, 0];
  const rear = [WX, WY, 0];
  const front = [-WX, WY, 0];
  const tube = (a, b, r) => frm.push(U.segCyl(a, b, r || 0.027, mFrm, 5));
  tube(BB, seat); tube(seat, headT); tube(BB, headB); tube(headT, headB);
  tube(headB, front); tube(BB, rear); tube(seat, rear);
  frm.push(U.segCyl(seat, [0.155, 0.80, 0], 0.016, mFrm, 5));
  rub.push(U.box(0.24, 0.05, 0.11, mRub, { x: 0.15, y: 0.83 }));
  // 车把
  frm.push(U.segCyl(headT, [-0.37, 0.82, 0], 0.018, mFrm, 5));
  frm.push(U.segCyl([-0.37, 0.82, -0.23], [-0.37, 0.82, 0.23], 0.016, mFrm, 5));
  rub.push(U.cyl(0.021, 0.021, 0.07, 6, mRub, { x: -0.37, y: 0.82, z: -0.20, rx: HALF }));
  rub.push(U.cyl(0.021, 0.021, 0.07, 6, mRub, { x: -0.37, y: 0.82, z: 0.20, rx: HALF }));
  // 后货架
  for (const z of [-0.09, 0.09]) {
    stl.push(U.segCyl([0.50, 0.62, z], [0.86, 0.62, z], 0.011, mStl, 4));
  }
  for (const x of [0.60, 0.86]) stl.push(U.segCyl([x, 0.62, -0.09], [x, 0.62, 0.09], 0.011, mStl, 4));
  stl.push(U.segCyl([0.60, 0.62, 0.09], [0.56, WY, 0.02], 0.010, mStl, 4));
  stl.push(U.segCyl([0.60, 0.62, -0.09], [0.56, WY, -0.02], 0.010, mStl, 4));
  // 镂空前筐（细杆）
  const bx0 = -0.74, bx1 = -0.46, by0 = 0.54, by1 = 0.76, bz = 0.15;
  for (const y of [by0, by1]) {
    for (const z of [-bz, bz]) stl.push(U.segCyl([bx0, y, z], [bx1, y, z], 0.009, mStl, 4));
    for (const x of [bx0, bx1]) stl.push(U.segCyl([x, y, -bz], [x, y, bz], 0.009, mStl, 4));
  }
  for (const x of [bx0, bx1]) for (const z of [-bz, bz]) stl.push(U.segCyl([x, by0, z], [x, by1, z], 0.008, mStl, 4));
  for (const z of [-bz * 0.5, 0, bz * 0.5]) stl.push(U.segCyl([bx0, by0, z], [bx1, by0, z], 0.008, mStl, 4));
  for (const z of [-0.10, 0.10]) stl.push(U.segCyl([bx1, by0, z], [-0.37, 0.64, z], 0.015, mStl, 4));
  for (const z of [-0.10, 0.10]) stl.push(U.segCyl([bx0, by0, z], [-0.55, 0.62, z], 0.013, mStl, 4));
  stl.push(U.segCyl([bx1, by1, 0], [-0.36, 0.80, 0], 0.012, mStl, 4));
  // 脚踏
  frm.push(U.cyl(0.016, 0.016, 0.13, 6, mFrm, { y: 0.30, rx: HALF }));
  rub.push(U.box(0.09, 0.025, 0.05, mRub, { x: 0.09, y: 0.27, z: 0.10, ry: 0.2 }));
  rub.push(U.box(0.09, 0.025, 0.05, mRub, { x: -0.09, y: 0.33, z: -0.10, ry: 0.2 }));
  // 脚撑
  stl.push(U.segCyl([0.30, 0.30, 0.02], [0.40, 0.0, -0.16], 0.012, mStl, 4));

  const rb = U.merge(rub, mRub); if (rb) { M.outline(rb, 0.02); g.add(rb); }
  const fb = U.merge(frm, mFrm); if (fb) { M.outline(fb, 0.018); g.add(fb); }
  const sb = U.merge(stl, mStl); if (sb) g.add(sb);
  return g;
}

// ---------------------------------------------------------------- 雨伞架
function buildUmbrella(K) {
  const g = new THREE.Group();
  g.add(U.cyl(0.175, 0.155, 0.50, 14, M.cel(P.metalDark), { y: 0.25 }));
  const cols = [P.wallCream, P.plastic, P.glassDark, P.wallCream];
  const buckets = new Map();
  const r = T.rand(7);
  for (let i = 0; i < cols.length; i++) {
    const a = (i / cols.length) * Math.PI * 2 + 0.4;
    const px = Math.cos(a) * 0.075, pz = Math.sin(a) * 0.075;
    const h = 0.58 + r() * 0.10;
    const tilt = 0.05 + r() * 0.07;
    const mat = M.cel(cols[i]);
    const arr = buckets.get(cols[i]) || [];
    arr.push(U.cyl(0.015, 0.062, h, 8, mat, {
      x: px, y: 0.40 + h / 2, z: pz, rz: Math.cos(a) * tilt, rx: -Math.sin(a) * tilt,
    }));
    arr.push(U.cyl(0.021, 0.021, 0.07, 6, mat, {
      x: px + Math.cos(a) * tilt * h, y: 0.40 + h + 0.03, z: pz - Math.sin(a) * tilt * h,
      rz: Math.cos(a) * tilt, rx: -Math.sin(a) * tilt,
    }));
    buckets.set(cols[i], arr);
  }
  buckets.forEach((arr) => { const m = U.merge(arr, arr[0].material); if (m) g.add(m); });
  return g;
}

// ---------------------------------------------------------------- 分类垃圾桶
function buildBins(K) {
  const g = new THREE.Group();
  const cols = [P.trashBlue, P.trashGreen, P.trashOrange];
  const lid = [], slot = [], label = [];
  const lidMat = M.cel(P.metalDark);
  const slotMat = M.cel(0x1a1f28);
  const labelMat = M.lit(0xffffff, 0.8, K.recycle);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.45;
    g.add(U.box(0.40, 0.70, 0.40, M.cel(cols[i]), { x: x, y: 0.35 }));
    lid.push(U.box(0.44, 0.05, 0.44, lidMat, { x: x, y: 0.725 }));
    lid.push(U.box(0.46, 0.03, 0.46, lidMat, { x: x, y: 0.68 }));
    slot.push(U.box(0.22, 0.09, 0.02, slotMat, { x: x, y: 0.60, z: 0.205 }));
    label.push(U.quad(0.23, 0.23, labelMat, { x: x, y: 0.33, z: 0.202 }));
  }
  const lm = U.merge(lid, lidMat); if (lm) g.add(lm);
  const sm = U.merge(slot, slotMat); if (sm) g.add(sm);
  const bm = U.merge(label, labelMat); if (bm) g.add(bm);
  return g;
}

// ---------------------------------------------------------------- 护栏
function buildRailRun(len, alongX) {
  const g = new THREE.Group();
  const postMat = M.cel(P.wallWhite);
  const railMat = M.cel(P.paintWhite);
  const n = Math.round(len / 1.5);
  const list = [];
  for (let i = 0; i <= n; i++) {
    const d = (len / n) * i;
    list.push({ p: alongX ? [d, 0, 0] : [0, 0, d] });
  }
  const geo = new THREE.CylinderGeometry(0.034, 0.042, 0.85, 8);
  const im = U.inst(geo, postMat, list);
  g.add(im);
  const rails = [];
  for (const y of [0.40, 0.78]) {
    const m = alongX
      ? U.cyl(0.028, 0.028, len, 8, railMat, { x: len / 2, y: y, rz: HALF })
      : U.cyl(0.028, 0.028, len, 8, railMat, { z: len / 2, y: y, rx: HALF });
    rails.push(m);
  }
  const rm = U.merge(rails, railMat);
  if (rm) g.add(rm);
  return g;
}

// ---------------------------------------------------------------- 路灯
function buildLamp(K) {
  const g = new THREE.Group();
  const metal = M.cel(P.metalDark);
  const parts = [];
  parts.push(U.cyl(0.10, 0.14, 0.20, 10, metal, { y: 0.10 }));
  parts.push(U.cyl(0.055, 0.090, 4.75, 12, metal, { y: 2.575 }));
  const pts = [[0, 4.80, 0], [0, 5.03, 0.40], [0, 5.01, 0.80], [0, 4.88, 1.05]];
  for (let i = 0; i < pts.length - 1; i++) parts.push(U.segCyl(pts[i], pts[i + 1], 0.045, metal, 8));
  const shaft = U.merge(parts, metal);
  if (shaft) { M.outline(shaft, 0.022); g.add(shaft); }
  g.add(U.box(0.30, 0.15, 0.48, M.cel(P.metalDark), { y: 4.87, z: 1.05, rx: 0.06 }));
  g.add(U.plane(0.26, 0.40, M.lit(P.lightCool, 2.4), { y: 4.78, z: 1.05 }));
  g.add(U.quad(1.5, 1.5, glowMat(K.ring, P.lightCool, 0.17), { y: 4.84, z: 1.05, ry: Math.PI / 4 }));
  g.add(U.plane(3.1, 3.1, glowMat(K.ring, P.lightCool, 0.16), { x: 0, y: -0.132, z: 1.2 }));
  return g;
}

// ---------------------------------------------------------------- 电线杆
function buildPole(K, H, arm1, arm2) {
  const g = new THREE.Group();
  const concrete = M.cel(P.wallGrey, { map: T.concrete() });
  const concrete2 = M.cel(P.metalDark);
  const ceramic = M.cel(P.plastic);

  const p = U.cyl(0.11, 0.16, H, 12, concrete, { y: H / 2 });
  M.outline(p, 0.022);
  g.add(p);

  const metal = [];
  for (const y of [arm1, arm2]) {
    metal.push(U.box(0.09, 0.10, 1.55, concrete2, { y: y }));
    metal.push(U.box(0.28, 0.06, 0.10, concrete2, { y: y - 0.08, z: 0.0 }));
  }
  metal.push(U.cyl(0.20, 0.20, 0.52, 12, concrete2, { y: arm1 - 0.85, z: 0.30, rx: 0.06 }));
  metal.push(U.box(0.10, 0.10, 0.80, concrete2, { y: arm1 - 0.62, z: 0.28 }));
  const mm = U.merge(metal, concrete2);
  if (mm) g.add(mm);

  const ins = [];
  for (const y of [arm1, arm2]) {
    for (const dz of [-0.55, 0, 0.55]) {
      ins.push({ p: [0, y + 0.10, dz] });
    }
  }
  g.add(U.inst(new THREE.CylinderGeometry(0.038, 0.05, 0.14, 7), ceramic, ins));

  const plates = [];
  plates.push(U.quad(0.24, 0.72, M.lit(0xffffff, 0.85, K.stripA), { y: 2.30, z: 0.165 }));
  plates.push(U.quad(0.24, 0.72, M.lit(0xffffff, 0.85, K.stripB), { y: 3.25, z: 0.165 }));
  const pm = U.merge(plates, plates[0].material);
  if (pm) g.add(pm);
  return g;
}

// ---------------------------------------------------------------- 路牌
function buildSigns(K) {
  const g = new THREE.Group();
  // 主路牌（转角）
  g.add(U.cyl(0.036, 0.044, 2.40, 8, M.cel(P.metalLight), { y: 1.20 }));
  const disc = U.cyl(0.28, 0.28, 0.035, 20, M.lit(0xffffff, 0.95, K.noParking), { y: 2.16, z: 0.02, rx: HALF });
  g.add(disc);
  g.add(U.box(0.90, 0.28, 0.035, M.cel(P.metalLight), { y: 1.74, z: 0.01 }));
  g.add(U.quad(0.88, 0.26, M.lit(0xffffff, 0.95, K.street), { y: 1.74, z: 0.030 }));
  return g;
}

function buildAlleySign(K) {
  const g = new THREE.Group();
  g.add(U.cyl(0.032, 0.038, 1.55, 8, M.cel(P.metalLight), { y: 0.775 }));
  g.add(U.box(0.62, 0.30, 0.035, M.cel(P.metalLight), { y: 1.42, z: 0.01 }));
  g.add(U.quad(0.60, 0.28, M.lit(0xffffff, 0.95, K.alley), { y: 1.42, z: 0.030 }));
  return g;
}

// ---------------------------------------------------------------- 公告栏
function buildNotice(K) {
  const g = new THREE.Group();
  const wood = M.cel(P.woodDark);
  const parts = [];
  for (const x of [-0.68, 0.68]) parts.push(U.box(0.09, 0.58, 0.09, wood, { x: x, y: 0.29 }));
  parts.push(U.box(1.62, 0.09, 0.10, wood, { y: 0.55 }));
  parts.push(U.box(1.62, 0.09, 0.10, wood, { y: 1.79 }));
  for (const x of [-0.765, 0.765]) parts.push(U.box(0.09, 1.32, 0.10, wood, { x: x, y: 1.17 }));
  parts.push(U.box(1.62, 1.24, 0.05, wood, { y: 1.17, z: -0.02 }));
  parts.push(U.box(1.80, 0.05, 0.26, wood, { y: 1.88, z: 0.06, rx: -0.14 }));
  for (const x of [-0.70, 0.70]) parts.push(U.box(0.05, 0.24, 0.05, wood, { x: x, y: 1.90, z: 0.06 }));
  const fm = U.merge(parts, wood);
  if (fm) g.add(fm);
  g.add(U.quad(1.44, 1.10, M.interior(0xdedede, { map: T.noticeBoard(), glow: 0.32 }), { y: 1.17, z: 0.035 }));
  return g;
}

// ---------------------------------------------------------------- 空调外机 / 立管
function buildAC() {
  const g = new THREE.Group();
  const shell = M.cel(P.shelfWhite);
  const dark = M.cel(P.metalDark);
  const body = [], grille = [], bracket = [], pipe = [];
  const spots = [[-5.9, 2.35], [-3.4, 2.35], [1.9, 2.60]];
  for (const s of spots) {
    const z = s[0], y = s[1];
    body.push(U.box(0.35, 0.60, 0.80, shell, { x: -0.185, y: y, z: z }));
    grille.push(U.cyl(0.21, 0.21, 0.03, 16, dark, { x: -0.375, y: y, z: z - 0.16, rz: HALF }));
    bracket.push(U.box(0.40, 0.05, 0.06, dark, { x: -0.20, y: y - 0.33, z: z - 0.30 }));
    bracket.push(U.box(0.40, 0.05, 0.06, dark, { x: -0.20, y: y - 0.33, z: z + 0.30 }));
    pipe.push(U.cyl(0.018, 0.018, 1.6, 6, dark, { x: -0.36, y: y - 1.05, z: z + 0.42 }));
    pipe.push(U.cyl(0.016, 0.016, 0.34, 6, dark, { x: -0.20, y: y - 0.36, z: z + 0.42, rz: HALF }));
  }
  const bm = U.merge(body, shell); if (bm) g.add(bm);
  const gm = U.merge(grille, dark); if (gm) g.add(gm);
  const km = U.merge(bracket, dark); if (km) g.add(km);
  const pm = U.merge(pipe, dark); if (pm) g.add(pm);
  return g;
}

function buildDownpipe() {
  const g = new THREE.Group();
  const mat = M.cel(P.stainless);
  g.add(U.cyl(0.05, 0.055, 6.2, 8, mat, { y: 3.1 }));
  const list = [];
  for (let i = 0; i < 5; i++) list.push({ p: [0, 0.6 + i * 1.35, 0] });
  g.add(U.inst(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 6), M.cel(P.metalDark), list));
  return g;
}

// ---------------------------------------------------------------- 小巷杂物
function buildCrates() {
  const g = new THREE.Group();
  const cols = [P.trashGreen, P.productBlue, P.wood];
  const lists = cols.map(() => []);
  const stacks = [
    { x: -10.55, z: 1.05, n: 3 },
    { x: -10.35, z: -1.45, n: 4 },
  ];
  let k = 0;
  for (const s of stacks) {
    for (let i = 0; i < s.n; i++) {
      const ci = (k + i) % 3;
      const m = U.box(0.46, 0.28, 0.36, M.cel(cols[ci]), {
        x: s.x + (i % 2 ? 0.03 : -0.02), y: 0.14 + i * 0.29, z: s.z + (i % 2 ? -0.02 : 0.03), ry: (i % 2 ? 0.12 : -0.09),
      });
      lists[ci].push(m);
    }
    k += 1;
  }
  for (let i = 0; i < 3; i++) {
    const merged = U.merge(lists[i], M.cel(cols[i]));
    if (merged) g.add(merged);
  }
  return g;
}

function buildJunk() {
  const g = new THREE.Group();
  // 压扁湿纸箱
  const card = M.cel(P.productBrown);
  const cards = [];
  for (let i = 0; i < 3; i++) {
    cards.push(U.box(0.66, 0.045, 0.52, card, { x: -10.45 + i * 0.05, y: 0.085 + i * 0.05, z: 2.15 + i * 0.04, ry: 0.18 * i - 0.1, rz: 0.02 }));
  }
  const cm = U.merge(cards, card); if (cm) g.add(cm);
  // 黑色垃圾袋
  const bag = M.cel(P.rubber);
  const bags = [];
  const spots = [[-10.95, 2.45, 0.24], [-11.15, 2.10, 0.20], [-10.75, 2.05, 0.17]];
  for (const s of spots) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(s[2], 10, 7), bag);
    b.position.set(s[0], 0.055 + s[2] * 0.62, s[1]);
    b.scale.set(1.25, 0.66, 1.05);
    bags.push(b);
  }
  const bm = U.merge(bags, bag); if (bm) g.add(bm);
  return g;
}

// ---------------------------------------------------------------- 盆栽 / 交通锥
function buildPlant() {
  const g = new THREE.Group();
  const potMat = M.cel(P.woodDark);
  const leafMat = M.cel(P.plant);
  const leaf2 = M.cel(P.plantDark);
  g.add(U.cyl(0.17, 0.135, 0.30, 12, potMat, { y: 0.15 }));
  g.add(U.cyl(0.16, 0.16, 0.03, 12, M.cel(P.baseTrim), { y: 0.30 }));
  const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), leafMat);
  a.position.set(0, 0.46, 0); g.add(a);
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), leaf2);
  b.position.set(0.13, 0.40, 0.06); g.add(b);
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), leafMat);
  c.position.set(-0.11, 0.52, -0.05); g.add(c);
  return g;
}

function buildCone() {
  const g = new THREE.Group();
  g.add(U.box(0.34, 0.04, 0.34, M.cel(P.metalDark), { y: 0.02 }));
  g.add(U.cyl(0.025, 0.15, 0.52, 12, M.cel(P.trashOrange), { y: 0.28 }));
  g.add(U.cyl(0.105, 0.13, 0.09, 12, M.cel(P.plastic), { y: 0.33 }));
  return g;
}

// ---------------------------------------------------------------- 主构建
export function build(ctx) {
  const root = new THREE.Group();
  root.name = 'props';
  const lights = new THREE.Group();
  lights.name = 'props:lights';
  const K = kitTextures();
  const animated = [];

  // 1. 自动贩卖机 ×2
  const v1 = buildVending(K, P.neonCyan, P.metalLight);
  v1.g.position.set(4.30 - 0.375, SW, -3.6);
  U.mark(v1.g, { order: 0.62, mode: 'drop' });
  root.add(v1.g);
  const v2 = buildVending(K, P.neonRed, P.wallWhite);
  v2.g.position.set(-11.2 - 0.375, AL, -2.0);
  U.mark(v2.g, { order: 0.62, mode: 'drop' });
  root.add(v2.g);
  animated.push(v2.halo);

  // 2. 自行车
  const bike = buildBike();
  bike.position.set(4.72, SW, 1.2);
  bike.rotation.y = 0.26;
  U.mark(bike, { order: 0.66, mode: 'drop' });
  root.add(bike);

  // 3. 雨伞架
  const um = buildUmbrella(K);
  um.position.set(1.2, SW, 3.9);
  U.mark(um, { order: 0.64, mode: 'pop' });
  root.add(um);

  // 4. 分类垃圾桶 ×3
  const bins = buildBins(K);
  bins.position.set(-3.0, SW, 3.95);
  U.mark(bins, { order: 0.64, mode: 'pop' });
  root.add(bins);

  // 5. 街角护栏
  const rS = buildRailRun(5.1, true);
  rS.position.set(0.5, SW, 5.88);
  U.mark(rS, { order: 0.58, mode: 'wipe', axis: 'x' });
  root.add(rS);
  const rE = buildRailRun(2.7, false);
  rE.position.set(5.88, SW, 0.5);
  U.mark(rE, { order: 0.58, mode: 'wipe', axis: 'z' });
  root.add(rE);

  // 6. 路灯 ×2
  const l1 = buildLamp(K);
  l1.position.set(5.5, SW, 5.5);
  U.mark(l1, { order: 0.60, mode: 'grow' });
  root.add(l1);
  const l2 = buildLamp(K);
  l2.position.set(-6.5, SW, 5.6);
  U.mark(l2, { order: 0.60, mode: 'grow' });
  root.add(l2);
  const pl = new THREE.PointLight(P.lightCool, 14, 18, 2);
  pl.position.set(5.5, SW + 4.72, 6.55);
  lights.add(pl);

  // 7. 电线杆 ×2 + 电线
  const PA = { x: -2.0, z: 5.7, h: 8.4, a1: 7.55, a2: 7.95 };
  const PB = { x: -9.6, z: 5.6, h: 8.0, a1: 7.15, a2: 7.55 };
  const p1 = buildPole(K, PA.h, PA.a1, PA.a2);
  p1.position.set(PA.x, SW, PA.z);
  U.mark(p1, { order: 0.56, mode: 'grow' });
  root.add(p1);
  const p2 = buildPole(K, PB.h, PB.a1, PB.a2);
  p2.position.set(PB.x, SW, PB.z);
  U.mark(p2, { order: 0.56, mode: 'grow' });
  root.add(p2);

  const wireMat = M.cel(P.wire);
  const wireMeshes = [];
  const pull = (a, b, sag, r) => {
    const w = U.wire(a, b, sag, r || 0.025, wireMat, 9);
    w.children.forEach((c) => wireMeshes.push(c));
  };
  const ay = (p, arm, dz) => [p.x, SW + arm + 0.17, p.z + dz];
  pull(ay(PA, PA.a1, 0.55), ay(PB, PB.a1, 0.55), 0.70);
  pull(ay(PA, PA.a1, -0.55), ay(PB, PB.a1, -0.55), 0.80);
  pull(ay(PA, PA.a2, 0.30), ay(PB, PB.a2, 0.30), 0.60);
  pull(ay(PA, PA.a2, -0.30), ay(PB, PB.a2, -0.30), 0.66);
  pull([PA.x, SW + 6.30, PA.z + 0.05], [PB.x, SW + 5.95, PB.z + 0.05], 0.90, 0.032);
  pull([PA.x, SW + 6.02, PA.z - 0.05], [PB.x, SW + 5.68, PB.z - 0.05], 0.85, 0.026);
  pull([PA.x + 0.14, SW + PA.a2 + 0.10, PA.z + 0.06], [-1.05, 5.30, 3.58], 0.35, 0.022);
  pull([PA.x + 0.14, SW + PA.a1 + 0.10, PA.z + 0.06], [-3.40, 5.15, 3.58], 0.40, 0.022);
  const wires = U.merge(wireMeshes, wireMat);
  if (wires) { U.mark(wires, { order: 0.82, mode: 'fade' }); root.add(wires); }

  // 8. 路牌
  const sign = buildSigns(K);
  sign.position.set(5.2, SW, 4.2);
  U.mark(sign, { order: 0.70, mode: 'drop' });
  root.add(sign);
  const alleySign = buildAlleySign(K);
  alleySign.position.set(-9.35, SW, 4.55);
  alleySign.rotation.y = -0.18;
  U.mark(alleySign, { order: 0.70, mode: 'drop' });
  root.add(alleySign);

  // 9. 公告栏
  const notice = buildNotice(K);
  notice.position.set(-8.2, SW, 4.3);
  U.mark(notice, { order: 0.72, mode: 'drop' });
  root.add(notice);

  // 10. 小巷：空调外机 / 立管 / 周转箱 / 纸箱 / 垃圾袋
  const ac = buildAC();
  ac.position.set(-9.0, AL, 0);
  U.mark(ac, { order: 0.68, mode: 'drop' });
  root.add(ac);

  const dp = buildDownpipe();
  dp.position.set(-9.07, 0, 3.30);
  U.mark(dp, { order: 0.68, mode: 'drop' });
  root.add(dp);

  const crates = buildCrates();
  crates.position.set(0, AL, 0);
  U.mark(crates, { order: 0.74, mode: 'pop' });
  root.add(crates);

  const junk = buildJunk();
  junk.position.set(0, AL, 0);
  U.mark(junk, { order: 0.74, mode: 'pop' });
  root.add(junk);

  // 11. 盆栽
  for (const x of [0.30, 2.60]) {
    const pl2 = buildPlant();
    pl2.position.set(x, SW, 3.9);
    pl2.rotation.y = x * 0.7;
    U.mark(pl2, { order: 0.66, mode: 'pop' });
    root.add(pl2);
  }

  // 12. 交通锥
  const c1 = buildCone();
  c1.position.set(-10.35, SW, 4.35);
  U.mark(c1, { order: 0.76, mode: 'pop' });
  root.add(c1);
  const c2 = buildCone();
  c2.position.set(2.2, 0, 6.5);
  U.mark(c2, { order: 0.76, mode: 'pop' });
  root.add(c2);

  function update(dt, t) {
    for (let i = 0; i < animated.length; i++) {
      const m = animated[i].material;
      m.opacity = 0.098 + Math.sin(t * 2.3 + i) * 0.022 + Math.sin(t * 7.7) * 0.010;
    }
  }

  return { group: root, lights: lights, update: update };
}
