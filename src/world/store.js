import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// 雨夜便利店 · 建筑外壳 + 店内陈设（Worker B）
// 占地 x∈[-9.0,3.5], z∈[-9.0,3.5]；室内地面 y=0.15，吊顶 y=3.05，一层墙高 3.4
// ─────────────────────────────────────────────────────────────────────────────

const X0 = -9.0, X1 = 3.5, Z0 = -9.0, Z1 = 3.5;
const WT = 0.25;               // 墙厚
const FL = 0.15;               // 室内地面
const CEIL = 3.05;             // 吊顶
const WTOP = 3.4;              // 一层墙顶
const IW = 0.35;               // 室内可用界内缩
const IX0 = X0 + IW, IX1 = X1 - IW, IZ0 = Z0 + IW, IZ1 = Z1 - IW;

// 正面开间
const GA0 = -8.8, GA1 = -2.5;  // 玻璃 A
const D0 = -2.5, D1 = 0.1;     // 自动门
const GB0 = 0.1, GB1 = 3.3;    // 玻璃 B
// 东面开间
const EG0 = -6.5, EG1 = 1.5;

const DUMMY = new THREE.MeshBasicMaterial();

export function build(ctx) {
  const { P, M, T, U } = ctx;

  const group = new THREE.Group();
  group.name = 'store';
  const actor = {
    clerkG: null, bodyP: null, headG: null, armR: null,
    posScr: null, posMat: null, posBase: null,
    payScr: null, payMat: null, payBase: null,
    receipt: null,
    anim: { clerk: -1, pos: -1, pay: -1 },
  };
  const lights = new THREE.Group();

  // ── 局部贴图/材质工具 ──────────────────────────────────────────────────────
  const texCache = new Map();
  function texRep(tex, rx, ry) {
    const key = tex.uuid + '|' + rx + '|' + ry;
    let t = texCache.get(key);
    if (!t) {
      t = tex.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      texCache.set(key, t);
    }
    return t;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g2 = c.getContext('2d');
    draw(g2, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }
  // 派生自 M 的带贴图透明/加法材质（M 无此参数的入口）
  function glowMat(hex, opacity, tex, additive) {
    const base = M.glow(hex, opacity, additive !== false);
    const m = base.clone();
    if (tex) m.map = tex;
    m.needsUpdate = true;
    return m;
  }
  function decalMat(tex, opacity) {
    const m = M.lit(0xffffff, 1.0, tex).clone();
    m.transparent = true;
    m.opacity = opacity == null ? 0.55 : opacity;
    m.depthWrite = false;
    m.needsUpdate = true;
    return m;
  }

  // ── 几何工具 ──────────────────────────────────────────────────────────────
  function bx(w, h, d, x, y, z, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), DUMMY);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    return m;
  }
  function qd(w, h, x, y, z, ry, rx) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), DUMMY);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    if (rx) m.rotation.x = rx;
    return m;
  }
  function merge(list, mat) {
    if (!list || !list.length) return null;
    return U.merge(list, mat);
  }
  function push(list, mesh) { if (mesh) list.push(mesh); return mesh; }

  // ── 主材质 ────────────────────────────────────────────────────────────────
  const tileTex = texRep(T.tileWall(), 5.2, 1.45);
  const tileTex2 = texRep(T.tileWall(), 6.4, 1.05);
  const MAT = {
    shellWhite: M.cel(P.wallWhite),
    shellCream: M.cel(P.wallCream),
    tile: M.cel(P.wallTile, { map: tileTex }),
    tile2: M.cel(P.wallTileDark, { map: tileTex2 }),
    grey: M.cel(P.wallGrey),
    trim: M.cel(P.wallTrim),
    metal: M.cel(P.metal),
    metalLight: M.cel(P.metalLight),
    canopy: M.cel(P.wallCream),
    metalDark: M.cel(P.metalDark),
    stainless: M.cel(P.stainless),
    roof: M.cel(P.roofSlab),
    interiorWall: M.interior(0xd2c5a6, { glow: 0.15 }),
    shelfWhite: M.interior(0xf0e0c2, { glow: 0.26 }),
    shelfBoard: M.interior(0xd8cbae, { glow: 0.17 }),
    shelfMetal: M.interior(P.shelfMetal, { glow: 0.22 }),
    counterTop: M.interior(0xeddcba, { glow: 0.22 }),
    counterBody: M.interior(0xe2d2b4, { glow: 0.22 }),
    plastic: M.interior(P.plastic, { glow: 0.26 }),
    panelWhite: M.interior(0xf2efe6, { glow: 0.19 }),
    paper: M.interior(0xf5f2e8, { glow: 0.24 }),
  };

  // ── 玻璃材质（每种用途独占一份，便于 timeline 单独 fade）──────────────────
  const G = {
    front: M.glass({ tint: 0xffe9cf, opacity: 0.06 }),
    east: M.glass({ tint: 0xffe9cf, opacity: 0.06 }),
    door: M.glass({ tint: 0xffeeda, opacity: 0.08 }),
    fridge: M.glass({ tint: 0xd6eeff, opacity: 0.12 }),
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1. 外壳（墙 / 柱 / 踢脚 / 室内饰面）
  // ══════════════════════════════════════════════════════════════════════════
  const shell = new THREE.Group();
  {
    const white = [], cream = [], tile = [], grey = [], inner = [], dark = [];

    // 北墙（实墙）
    push(tile, bx(X1 - X0, WTOP, WT, (X0 + X1) / 2, WTOP / 2, Z0 + WT / 2));
    // 西墙（实墙）
    push(tile, bx(WT, WTOP, Z1 - Z0 - WT, X0 + WT / 2, WTOP / 2, (Z0 + WT + Z1) / 2));

    // 正立面：上过梁 / 下墙裙 / 两端墙垛
    push(white, bx(X1 - X0, WTOP - 3.0, WT, (X0 + X1) / 2, (WTOP + 3.0) / 2, Z1 - WT / 2)); // 3.0~3.4 通长
    push(white, bx(GA1 - GA0, 0.35, WT, (GA0 + GA1) / 2, 0.175, Z1 - WT / 2));
    push(white, bx(GB1 - GB0, 0.35, WT, (GB0 + GB1) / 2, 0.175, Z1 - WT / 2));
    push(white, bx(0.22, 2.65, WT, X0 + 0.11, 1.675, Z1 - WT / 2));       // 西端墙垛
    push(white, bx(0.22, 2.65, WT, X1 - 0.11, 1.675, Z1 - WT / 2));       // 东端墙垛
    push(white, bx(0.10, 2.65, WT, GA1 - 0.02, 1.675, Z1 - WT / 2));      // 玻璃A / 门之间
    push(white, bx(0.10, 2.65, WT, GB0 + 0.02, 1.675, Z1 - WT / 2));      // 门 / 玻璃B 之间

    // 东立面：实体段 + 玻璃段上下墙裙
    push(white, bx(WT, WTOP, EG0 - Z0, X1 - WT / 2, WTOP / 2, (Z0 + EG0) / 2));
    push(white, bx(WT, WTOP, Z1 - EG1, X1 - WT / 2, WTOP / 2, (EG1 + Z1) / 2));
    push(white, bx(WT, WTOP - 3.0, EG1 - EG0, X1 - WT / 2, (WTOP + 3.0) / 2, (EG0 + EG1) / 2));
    push(white, bx(WT, 0.35, EG1 - EG0, X1 - WT / 2, 0.175, (EG0 + EG1) / 2));

    // 踢脚（0.25 深色，四周，略外挑）
    push(dark, bx(X1 - X0 + 0.06, 0.25, 0.04, (X0 + X1) / 2, 0.125, Z1 + 0.02));
    push(dark, bx(0.04, 0.25, Z1 - Z0 + 0.06, X1 + 0.02, 0.125, (Z0 + Z1) / 2));
    push(dark, bx(X1 - X0 + 0.06, 0.25, 0.04, (X0 + X1) / 2, 0.125, Z0 - 0.02));
    push(dark, bx(0.04, 0.25, Z1 - Z0 + 0.06, X0 - 0.02, 0.125, (Z0 + Z1) / 2));

    // 四角立柱（P.wallGrey，各外挑 0.03）
    const cx = [X0 + 0.15, X1 - 0.15], cz = [Z0 + 0.15, Z1 - 0.15];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      push(grey, bx(0.36, WTOP + 0.02, 0.36, cx[i], (WTOP + 0.02) / 2, cz[j]));
    }
    // 中间壁柱（东立面 / 正立面）
    push(grey, bx(0.30, WTOP, 0.30, X1 - 0.16, WTOP / 2, EG0 + 0.15));
    push(grey, bx(0.30, WTOP, 0.30, X1 - 0.16, WTOP / 2, EG1 - 0.15));

    // 室内墙面饰面（西 / 北 / 东）
    push(inner, qd(Z1 - Z0, WTOP, X0 + WT + 0.005, WTOP / 2, (Z0 + Z1) / 2, Math.PI / 2));
    push(inner, qd(X1 - X0, WTOP, (X0 + X1) / 2, WTOP / 2, Z0 + WT + 0.005, 0));
    push(inner, qd(Z1 - Z0, WTOP, X1 - WT - 0.005, WTOP / 2, (Z0 + Z1) / 2, -Math.PI / 2));
    // 正面内侧（玻璃上方过梁内侧 + 门两侧墙垛内侧）
    push(inner, qd(X1 - X0, WTOP - 3.0, (X0 + X1) / 2, (WTOP + 3.0) / 2, Z1 - WT - 0.005, Math.PI));

    const mw = merge(white, MAT.shellWhite); if (mw) shell.add(mw);
    const mc = merge(cream, MAT.shellCream); if (mc) shell.add(mc);
    const mt = merge(tile, MAT.tile); if (mt) shell.add(mt);
    const mg = merge(grey, MAT.grey); if (mg) shell.add(mg);
    const mi = merge(inner, MAT.interiorWall); if (mi) { mi.castShadow = false; mi.receiveShadow = false; shell.add(mi); }
    const md = merge(dark, MAT.trim); if (md) shell.add(md);
  }
  U.mark(shell, { order: 0.22, mode: 'grow' });
  group.add(shell);

  // ══════════════════════════════════════════════════════════════════════════
  // 2. 玻璃幕墙 + 竖梃
  // ══════════════════════════════════════════════════════════════════════════
  const glassG = new THREE.Group();
  {
    const paneFront = [], barsM = [], barsD = [];
    // 正面两段玻璃
    const fA = qd(GA1 - GA0, 2.65, (GA0 + GA1) / 2, 1.675, Z1 - 0.06, 0);
    const fB = qd(GB1 - GB0, 2.65, (GB0 + GB1) / 2, 1.675, Z1 - 0.06, 0);
    fA.material = G.front; fB.material = G.front;
    glassG.add(fA); glassG.add(fB);
    // 东面一段玻璃
    const eA = qd(EG1 - EG0, 2.65, X1 - 0.06, 1.675, (EG0 + EG1) / 2, Math.PI / 2);
    eA.material = G.east; glassG.add(eA);

    // 竖梃：每 1.4m 一根 0.06 宽
    function mullions(a, b, axis, fixed) {
      const n = Math.max(1, Math.round((b - a) / 1.4));
      for (let i = 0; i <= n; i++) {
        const p = a + (b - a) * (i / n);
        if (axis === 'z') push(barsM, bx(0.05, 2.65, 0.06, p, 1.675, Z1 - 0.06));
        else push(barsM, bx(0.06, 2.65, 0.05, X1 - 0.06, 1.675, p));
      }
    }
    mullions(GA0, GA1, 'z');
    mullions(GB0, GB1, 'z');
    mullions(EG0, EG1, 'x');
    // 横档：中横 + 上缘 0.18 窗框
    push(barsM, bx(GA1 - GA0, 0.05, 0.06, (GA0 + GA1) / 2, 1.55, Z1 - 0.06));
    push(barsM, bx(GB1 - GB0, 0.05, 0.06, (GB0 + GB1) / 2, 1.55, Z1 - 0.06));
    push(barsM, bx(0.06, 0.05, EG1 - EG0, X1 - 0.06, 1.55, (EG0 + EG1) / 2));
    push(barsD, bx(GA1 - GA0, 0.18, 0.12, (GA0 + GA1) / 2, 2.95, Z1 - 0.05));
    push(barsD, bx(GB1 - GB0, 0.18, 0.12, (GB0 + GB1) / 2, 2.95, Z1 - 0.05));
    push(barsD, bx(0.12, 0.18, EG1 - EG0, X1 - 0.05, 2.95, (EG0 + EG1) / 2));
    // 下缘窗框
    push(barsD, bx(GA1 - GA0, 0.09, 0.12, (GA0 + GA1) / 2, 0.39, Z1 - 0.05));
    push(barsD, bx(GB1 - GB0, 0.09, 0.12, (GB0 + GB1) / 2, 0.39, Z1 - 0.05));
    push(barsD, bx(0.12, 0.09, EG1 - EG0, X1 - 0.05, 0.39, (EG0 + EG1) / 2));
    // 端柱
    push(barsD, bx(0.12, 2.65, 0.14, GA0 + 0.02, 1.675, Z1 - 0.05));
    push(barsD, bx(0.12, 2.65, 0.14, GB1 - 0.02, 1.675, Z1 - 0.05));
    push(barsD, bx(0.14, 2.65, 0.12, X1 - 0.05, 1.675, EG0 + 0.02));
    push(barsD, bx(0.14, 2.65, 0.12, X1 - 0.05, 1.675, EG1 - 0.02));

    const bm = merge(barsM, MAT.metalLight); if (bm) glassG.add(bm);
    const bd = merge(barsD, MAT.metalLight); if (bd) glassG.add(bd);

    // 半透明小贴纸（canvas 圆角色块，避开视线中心）
    const stickerTex = canvasTex(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#2f9e6b';
      c.beginPath();
      if (c.roundRect) c.roundRect(14, 14, 100, 100, 24); else c.rect(14, 14, 100, 100);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.92)';
      c.beginPath(); c.arc(64, 58, 26, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ef8a3c';
      c.fillRect(38, 92, 52, 9);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(46, 38, 36, 7);
    });
    const st1 = qd(0.42, 0.42, GA0 + 0.75, 1.32, Z1 - 0.05, 0);
    st1.material = decalMat(stickerTex, 0.62);
    glassG.add(st1);
    const st2 = qd(0.36, 0.36, GB1 - 0.62, 2.30, Z1 - 0.05, 0);
    st2.material = decalMat(stickerTex, 0.5);
    glassG.add(st2);
  }
  U.mark(glassG, { order: 0.34, mode: 'fade' });
  group.add(glassG);

  // 玻璃内侧极淡暖色加法面（增强「里面很亮」）
  {
    const warm = M.glow(P.lightWarm, 0.07);
    const a = qd(GA1 - GA0, 2.65, (GA0 + GA1) / 2, 1.675, Z1 - 0.10, 0);
    const b = qd(GB1 - GB0, 2.65, (GB0 + GB1) / 2, 1.675, Z1 - 0.10, 0);
    const c = qd(EG1 - EG0, 2.65, X1 - 0.10, 1.675, (EG0 + EG1) / 2, Math.PI / 2);
    a.material = warm; b.material = warm; c.material = warm;
    const mg2 = merge([a, b, c], warm);
    if (mg2) { mg2.castShadow = false; mg2.receiveShadow = false; glassG.add(mg2); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. 自动门 + 门框 + 感应器 + 地垫 + 无障碍坡道
  // ══════════════════════════════════════════════════════════════════════════
  const doorG = new THREE.Group();
  const leafL = new THREE.Group();
  const leafR = new THREE.Group();
  const LEAF_L_X = -1.82, LEAF_R_X = -0.58, LEAF_W = 1.20, LEAF_SLIDE = 1.16;
  const LEAF_Z = Z1 - 0.02;
  function buildLeaf(grp) {
    const glass = qd(LEAF_W, 2.55, 0, 1.60, LEAF_Z, 0);
    glass.material = G.door;
    grp.add(glass);
    const bars = [];
    push(bars, bx(0.06, 2.55, 0.06, -LEAF_W / 2 + 0.03, 1.60, LEAF_Z));
    push(bars, bx(0.06, 2.55, 0.06, LEAF_W / 2 - 0.03, 1.60, LEAF_Z));
    push(bars, bx(LEAF_W, 0.06, 0.06, 0, 2.855, LEAF_Z));
    push(bars, bx(LEAF_W, 0.06, 0.06, 0, 0.345, LEAF_Z));
    push(bars, bx(0.035, 0.90, 0.05, -LEAF_W / 2 + 0.16, 1.45, LEAF_Z + 0.04)); // 推拉把手
    const m = merge(bars, MAT.metalDark);
    if (m) grp.add(m);
  }
  buildLeaf(leafL);
  buildLeaf(leafR);
  leafL.position.set(LEAF_L_X, 0, 0);
  leafR.position.set(LEAF_R_X, 0, 0);
  doorG.add(leafL);
  doorG.add(leafR);
  {
    const darkF = [];
    // 静态门框
    push(darkF, bx(0.14, 2.75, 0.16, D0 - 0.03, 1.475, Z1 - 0.05));
    push(darkF, bx(0.14, 2.75, 0.16, D1 + 0.03, 1.475, Z1 - 0.05));
    push(darkF, bx(D1 - D0 + 0.28, 0.16, 0.16, (D0 + D1) / 2, 2.98, Z1 - 0.05));
    push(darkF, bx(D1 - D0 + 0.28, 0.05, 0.20, (D0 + D1) / 2, 0.175, Z1 - 0.06)); // 门槛
    const mf = merge(darkF, MAT.metalDark); if (mf) doorG.add(mf);

    // 感应器盒
    const sensor = bx(0.52, 0.24, 0.20, (D0 + D1) / 2, 3.14, Z1 - 0.14);
    sensor.material = MAT.metalDark;
    doorG.add(sensor);
    const lensTex = canvasTex(64, 32, (c, w, h) => {
      c.fillStyle = '#2a2f3a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#7ef2b0'; c.fillRect(6, 12, 52, 8);
    });
    const lens = qd(0.40, 0.10, (D0 + D1) / 2, 3.12, Z1 - 0.0, 0);
    lens.material = M.lit(0xbff8d8, 1.2, lensTex);
    doorG.add(lens);

    // 门口地垫 0.9(z) × 1.8(x)
    const matTex = canvasTex(128, 64, (c, w, h) => {
      c.fillStyle = '#3b4048'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#565d68'; c.lineWidth = 3;
      for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(0, i * 8 + 4); c.lineTo(w, i * 8 + 4); c.stroke(); }
      c.strokeStyle = '#6a7280'; c.lineWidth = 5; c.strokeRect(4, 4, w - 8, h - 8);
    });
    const mat = qd(1.8, 0.9, (D0 + D1) / 2, FL + 0.012, Z1 - 0.62, 0, -Math.PI / 2);
    mat.material = M.interior(0x4a505a, { map: matTex, glow: 0.22 });
    doorG.add(mat);
    const matSide = bx(1.8, 0.03, 0.9, (D0 + D1) / 2, FL - 0.005, Z1 - 0.62);
    matSide.material = MAT.trim; doorG.add(matSide);

    // 无障碍坡道（人行道顶 0.14 → 店内 0.15，做成缓坡台 + 盲道条）
    const rampTex = canvasTex(64, 128, (c, w, h) => {
      c.fillStyle = '#8d919c'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(120,124,134,0.6)';
      for (let i = 0; i < 10; i++) c.fillRect(0, i * 13, w, 2);
    });
    const apron = bx(D1 - D0 + 0.5, 0.02, 1.0, (D0 + D1) / 2, 0.152, Z1 + 0.52);
    apron.material = M.cel(P.curb, { map: rampTex });
    doorG.add(apron);
    const wedge = bx(D1 - D0 + 0.5, 0.03, 0.34, (D0 + D1) / 2, 0.140, Z1 + 1.18);
    wedge.material = M.cel(P.curb); doorG.add(wedge);
    const tact = bx(0.5, 0.012, 0.34, (D0 + D1) / 2, 0.158, Z1 + 0.55);
    tact.material = M.cel(P.paintYellow); doorG.add(tact);
  }
  /** 0=全关 1=全开；两扇各自反向滑动，直接写位置（确定性、幂等） */
  function setOpen(p) {
    const t = p < 0 ? 0 : (p > 1 ? 1 : p);
    leafL.position.x = LEAF_L_X - LEAF_SLIDE * t;
    leafR.position.x = LEAF_R_X + LEAF_SLIDE * t;
  }
  setOpen(0);
  U.mark(doorG, { order: 0.40, mode: 'pop' });
  group.add(doorG);

  // ══════════════════════════════════════════════════════════════════════════
  // 4. 雨棚 / 檐下灯带
  // ══════════════════════════════════════════════════════════════════════════
  const canopyG = new THREE.Group();
  {
    const slabs = [], braces = [], strips = [];
    push(slabs, bx(X1 - X0, 0.09, 1.16, (X0 + X1) / 2, 3.19, Z1 + 0.58));
    push(slabs, bx(X1 - X0, 0.15, 0.07, (X0 + X1) / 2, 3.14, Z1 + 1.14));  // 前檐口
    push(slabs, bx(1.16, 0.09, EG1 - EG0, X1 + 0.58, 3.19, (EG0 + EG1) / 2));
    push(slabs, bx(0.07, 0.15, EG1 - EG0, X1 + 1.14, 3.14, (EG0 + EG1) / 2));
    // 两根细钢斜撑
    push(braces, U.segCyl([-6.1, 2.52, Z1 - 0.02], [-6.1, 3.14, Z1 + 1.0], 0.035, MAT.metalDark, 6));
    push(braces, U.segCyl([1.1, 2.52, Z1 - 0.02], [1.1, 3.14, Z1 + 1.0], 0.035, MAT.metalDark, 6));
    // 檐下暖白灯带
    const under = [];
    push(under, bx(X1 - X0 - 0.06, 0.02, 1.08, (X0 + X1) / 2, 3.142, Z1 + 0.57));
    push(under, bx(1.08, 0.02, EG1 - EG0 - 0.06, X1 + 0.57, 3.142, (EG0 + EG1) / 2));
    const mu = merge(under, M.cel(0xc4bba6));
    if (mu) canopyG.add(mu);
    push(strips, bx(X1 - X0 - 0.3, 0.05, 0.10, (X0 + X1) / 2, 3.135, Z1 + 0.95));
    push(strips, bx(0.10, 0.05, EG1 - EG0 - 0.3, X1 + 0.95, 3.135, (EG0 + EG1) / 2));

    const ms = merge(slabs, MAT.canopy); if (ms) canopyG.add(ms);
    const mb = merge(braces, MAT.metalDark); if (mb) canopyG.add(mb);
    const st = merge(strips, M.lit(P.lightWarm, 1.8)); if (st) canopyG.add(st);
  }
  U.mark(canopyG, { order: 0.42, mode: 'drop' });
  group.add(canopyG);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. 主招牌带（正 / 东）
  // ══════════════════════════════════════════════════════════════════════════
  const signG = new THREE.Group();
  {
    const signTex = T.signBand('ひだまりマート', '24 HOURS');
    const bandY = 4.075, bandH = 0.95;

    // —— 正面 ——
    const fasciaF = bx(X1 - X0, bandH, 0.12, (X0 + X1) / 2, bandY, Z1 + 0.05);
    fasciaF.material = M.lit(P.storeSignWhite, 0.40);
    signG.add(fasciaF);
    // 店名牌（4.1:1，1024×256 不拉伸）
    const plateF = qd(3.8, 0.925, -1.0, bandY, Z1 + 0.115, 0);
    plateF.material = M.lit(0xffffff, 0.66, signTex);
    signG.add(plateF);
    // 绿 / 橙条纹腰带（与贴图呼应）
    const railG = [], railO = [];
    push(railG, bx(X1 - X0, 0.10, 0.135, (X0 + X1) / 2, 4.50, Z1 + 0.055));
    push(railO, bx(X1 - X0, 0.10, 0.135, (X0 + X1) / 2, 3.65, Z1 + 0.055));
    const rg = merge(railG, M.cel(P.storeGreen)); if (rg) signG.add(rg);
    const ro = merge(railO, M.cel(P.storeOrange)); if (ro) signG.add(ro);
    // 四条窄边框
    const frame = [];
    push(frame, bx(X1 - X0 + 0.06, 0.05, 0.16, (X0 + X1) / 2, 4.55, Z1 + 0.05));
    push(frame, bx(X1 - X0 + 0.06, 0.05, 0.16, (X0 + X1) / 2, 3.60, Z1 + 0.05));
    push(frame, bx(0.05, bandH, 0.16, X0 - 0.01, bandY, Z1 + 0.05));
    push(frame, bx(0.05, bandH, 0.16, X1 + 0.01, bandY, Z1 + 0.05));

    // —— 东面 ——
    const fasciaE = bx(0.12, bandH, Z1 - Z0, X1 + 0.05, bandY, (Z0 + Z1) / 2);
    fasciaE.material = M.lit(P.storeSignWhite, 0.40);
    signG.add(fasciaE);
    const plateE = qd(3.8, 0.925, X1 + 0.115, bandY, 0.9, Math.PI / 2);
    plateE.material = M.lit(0xffffff, 0.66, signTex);
    signG.add(plateE);
    const railGE = [], railOE = [];
    push(railGE, bx(0.135, 0.10, Z1 - Z0, X1 + 0.055, 4.50, (Z0 + Z1) / 2));
    push(railOE, bx(0.135, 0.10, Z1 - Z0, X1 + 0.055, 3.65, (Z0 + Z1) / 2));
    const rge = merge(railGE, M.cel(P.storeGreen)); if (rge) signG.add(rge);
    const roe = merge(railOE, M.cel(P.storeOrange)); if (roe) signG.add(roe);
    push(frame, bx(0.16, 0.05, Z1 - Z0 + 0.06, X1 + 0.05, 4.55, (Z0 + Z1) / 2));
    push(frame, bx(0.16, 0.05, Z1 - Z0 + 0.06, X1 + 0.05, 3.60, (Z0 + Z1) / 2));
    push(frame, bx(0.16, bandH, 0.05, X1 + 0.05, bandY, Z0 - 0.01));
    push(frame, bx(0.16, bandH, 0.05, X1 + 0.05, bandY, Z1 + 0.01));
    const mf2 = merge(frame, MAT.metalDark); if (mf2) signG.add(mf2);
  }
  U.mark(signG, { order: 0.50, mode: 'drop' });
  group.add(signG);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. 转角立柱灯箱（视觉锚点）
  // ══════════════════════════════════════════════════════════════════════════
  const pylonG = new THREE.Group();
  {
    const pylonTex = T.pylonSign('ひだまりマート');
    const body = bx(0.82, 3.4, 0.82, 3.62, 3.70, 3.62);
    body.material = M.lit(0xffffff, 0.62, pylonTex);
    body.userData.noOutline = true;
    pylonG.add(body);
    // 顶盖 / 底托
    const caps = [];
    push(caps, bx(0.90, 0.10, 0.90, 3.62, 5.45, 3.62));
    push(caps, bx(0.90, 0.12, 0.90, 3.62, 2.00, 3.62));
    push(caps, bx(0.12, 0.55, 0.12, 3.30, 1.75, 3.30));   // 与墙体连接的支脚
    const mc = merge(caps, MAT.metalDark); if (mc) pylonG.add(mc);
    // 两片加法光晕
    const gTex = T.glowSprite();
    const gA = qd(2.0, 3.9, 4.06, 3.70, 3.62, Math.PI / 2);
    gA.material = glowMat(P.neonGreen, 0.13, gTex);
    const gB = qd(2.0, 3.9, 3.62, 3.70, 4.06, 0);
    gB.material = gA.material;
    gA.userData.noOutline = true; gB.userData.noOutline = true;
    pylonG.add(gA); pylonG.add(gB);
  }
  U.mark(pylonG, { order: 0.54, mode: 'drop' });
  group.add(pylonG);

  // ══════════════════════════════════════════════════════════════════════════
  // 7. 二层 + 女儿墙 + 屋顶
  // ══════════════════════════════════════════════════════════════════════════
  const upperG = new THREE.Group();
  {
    const Y0 = 3.6, Y1 = 6.3;
    const tile2 = [], cream2 = [], trims = [], roofParts = [], greyParts = [];
    // 二层墙体
    push(tile2, bx(X1 - X0, Y1 - Y0, WT, (X0 + X1) / 2, (Y0 + Y1) / 2, Z1 - WT / 2));
    push(tile2, bx(WT, Y1 - Y0, Z1 - Z0, X1 - WT / 2, (Y0 + Y1) / 2, (Z0 + Z1) / 2));
    push(cream2, bx(X1 - X0, Y1 - Y0, WT, (X0 + X1) / 2, (Y0 + Y1) / 2, Z0 + WT / 2));
    push(cream2, bx(WT, Y1 - Y0, Z1 - Z0 - WT, X0 + WT / 2, (Y0 + Y1) / 2, (Z0 + WT + Z1) / 2));
    // 窗带（3:1 贴图，repeat 保证窗形近似正方）
    function windowStrip(litIdx) {
      return canvasTex(1024, 128, (c, w, h) => {
        c.fillStyle = '#b6bac4'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 8; i++) {
          const x = i * 128 + 22;
          const lit = litIdx.indexOf(i) >= 0;
          c.fillStyle = lit ? '#ffe6b0' : '#2b3446';
          c.fillRect(x, 22, 84, 84);
          if (lit) {
            c.fillStyle = 'rgba(196,138,74,0.40)';
            c.fillRect(x + 46, 26, 34, 76);
            c.fillStyle = 'rgba(255,248,224,0.95)';
            c.fillRect(x + 8, 74, 34, 28);
          }
          c.strokeStyle = lit ? '#f0d9a8' : '#48546a';
          c.lineWidth = 5;
          c.strokeRect(x, 22, 84, 84);
          c.beginPath(); c.moveTo(x + 42, 22); c.lineTo(x + 42, 106); c.stroke();
        }
        c.fillStyle = 'rgba(88,94,108,0.45)'; c.fillRect(0, 116, w, 12);
      });
    }
    const winTex = windowStrip([2, 5]);
    const winTexE = windowStrip([3]);
    const winF = qd(12.1, 1.2, (X0 + X1) / 2, 5.45, Z1 + 0.005, 0);
    winF.material = M.interior(0xffffff, { map: winTex, glow: 0.24 });
    upperG.add(winF);
    const winE = qd(11.4, 1.2, X1 + 0.005, 5.45, -2.6, Math.PI / 2);
    winE.material = M.interior(0xffffff, { map: winTexE, glow: 0.24 });
    upperG.add(winE);
    // 窗台滴水线
    push(trims, bx(12.2, 0.12, 0.12, (X0 + X1) / 2, 4.79, Z1 + 0.02));
    push(trims, bx(0.12, 0.12, 11.5, X1 + 0.02, 4.79, -2.6));
    // 招牌带上沿压顶线
    push(trims, bx(12.5, 0.09, 0.14, (X0 + X1) / 2, 4.62, Z1 + 0.03));
    push(trims, bx(0.14, 0.09, 12.5, X1 + 0.03, 4.62, (Z0 + Z1) / 2));
    // 女儿墙 + 盖板
    const PH = 0.36;
    push(cream2, bx(X1 - X0, PH, 0.20, (X0 + X1) / 2, Y1 + PH / 2, Z1 - 0.10));
    push(cream2, bx(0.20, PH, Z1 - Z0, X1 - 0.10, Y1 + PH / 2, (Z0 + Z1) / 2));
    push(cream2, bx(X1 - X0, PH, 0.20, (X0 + X1) / 2, Y1 + PH / 2, Z0 + 0.10));
    push(cream2, bx(0.20, PH, Z1 - Z0, X0 + 0.10, Y1 + PH / 2, (Z0 + Z1) / 2));
    push(trims, bx(X1 - X0 + 0.12, 0.08, 0.28, (X0 + X1) / 2, Y1 + PH + 0.04, Z1 - 0.10));
    push(trims, bx(0.28, 0.08, Z1 - Z0 + 0.12, X1 - 0.10, Y1 + PH + 0.04, (Z0 + Z1) / 2));
    push(trims, bx(X1 - X0 + 0.12, 0.08, 0.28, (X0 + X1) / 2, Y1 + PH + 0.04, Z0 + 0.10));
    push(trims, bx(0.28, 0.08, Z1 - Z0 + 0.12, X0 + 0.10, Y1 + PH + 0.04, (Z0 + Z1) / 2));
    // 屋顶平台
    push(roofParts, bx(X1 - X0 - 0.36, 0.12, Z1 - Z0 - 0.36, (X0 + X1) / 2, Y1 - 0.01, (Z0 + Z1) / 2));
    // 水箱 + 通风管
    push(roofParts, U.cyl(0.44, 0.44, 0.95, 12, DUMMY, { x: -5.6, y: Y1 + 0.62, z: -5.2 }));
    push(roofParts, U.cyl(0.48, 0.48, 0.08, 12, DUMMY, { x: -5.6, y: Y1 + 1.12, z: -5.2 }));
    push(roofParts, U.cyl(0.07, 0.07, 0.55, 8, DUMMY, { x: -1.2, y: Y1 + 0.28, z: -7.0 }));
    push(roofParts, U.cyl(0.07, 0.07, 0.42, 8, DUMMY, { x: 0.9, y: Y1 + 0.22, z: -6.4 }));
    push(roofParts, U.cyl(0.10, 0.10, 0.34, 8, DUMMY, { x: -7.6, y: Y1 + 0.18, z: 1.8 }));
    push(roofParts, bx(1.3, 0.10, 1.3, -5.6, Y1 + 0.05, -5.2));  // 水箱基座
    // 壁挂空调外机 ×2（二层立面）
    const acBox = [];
    push(acBox, bx(0.72, 0.52, 0.32, -6.9, 5.05, Z1 + 0.16));
    push(acBox, bx(0.72, 0.52, 0.32, 2.0, 5.05, Z1 + 0.16));
    push(greyParts, bx(0.72, 0.52, 0.32, -6.9, 5.05, Z1 + 0.16));
    push(greyParts, bx(0.72, 0.52, 0.32, 2.0, 5.05, Z1 + 0.16));
    // 屋顶空调外机
    push(greyParts, bx(0.8, 0.5, 0.6, -2.6, Y1 + 0.32, -6.6));
    push(greyParts, bx(0.8, 0.5, 0.6, -0.6, Y1 + 0.32, -6.6));

    const m1 = merge(tile2, MAT.tile2); if (m1) upperG.add(m1);
    const m2 = merge(cream2, MAT.shellCream); if (m2) upperG.add(m2);
    const m3 = merge(trims, MAT.shellWhite); if (m3) upperG.add(m3);
    const m4 = merge(roofParts, MAT.roof); if (m4) upperG.add(m4);
    const m5 = merge(greyParts, MAT.grey); if (m5) upperG.add(m5);
  }
  U.mark(upperG, { order: 0.46, mode: 'rise' });
  group.add(upperG);

  // ══════════════════════════════════════════════════════════════════════════
  // 8. 店内
  // ══════════════════════════════════════════════════════════════════════════
  const interior = new THREE.Group();

  // —— 8.1 地砖 ——
  {
    const floorTex = texRep(T.interiorFloor(), 2.95, 2.95);
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(IX1 - IX0, IZ1 - IZ0),
      M.interior(0xd8bd8a, { map: floorTex, glow: 0.26 }));
    fm.rotation.x = -Math.PI / 2;
    fm.position.set((IX0 + IX1) / 2, FL, (IZ0 + IZ1) / 2);
    fm.receiveShadow = false; fm.castShadow = false;
    U.mark(fm, { order: 0.36, mode: 'rise' });
    group.add(fm);
  }

  // —— 8.2 吊顶 + 灯带 + 出风口 ——
  const ceilG = new THREE.Group();
  {
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(IX1 - IX0, IZ1 - IZ0),
      M.interior(0xd8ccb2, { glow: 0.15 }));
    cm.rotation.x = Math.PI / 2;
    cm.position.set((IX0 + IX1) / 2, CEIL, (IZ0 + IZ1) / 2);
    cm.castShadow = false; cm.receiveShadow = false;
    ceilG.add(cm);

    const strips = [];
    const rows = [1.5, 0.4, -0.7, -1.8];
    for (const z of rows) {
      push(strips, bx(2.6, 0.05, 0.16, -6.2, CEIL - 0.05, z));
      push(strips, bx(2.6, 0.05, 0.16, -1.4, CEIL - 0.05, z));
    }
    const st = merge(strips, M.lit(P.lightStore, 1.15));
    if (st) { st.castShadow = false; st.receiveShadow = false; ceilG.add(st); }

    // 方形出风口格栅
    const ventTex = T.grate();
    const vents = [];
    push(vents, bx(0.62, 0.05, 0.62, -4.6, CEIL - 0.06, 1.9));
    push(vents, bx(0.62, 0.05, 0.62, 0.4, CEIL - 0.06, -3.0));
    const vt = merge(vents, M.cel(P.metalGrate, { map: ventTex }));
    if (vt) { vt.castShadow = false; vt.receiveShadow = false; ceilG.add(vt); }

    // 四周发光灯槽
    const cove = [];
    push(cove, bx(11.4, 0.08, 0.12, -2.75, 2.90, IZ0 + 0.12, 0));
    push(cove, bx(0.12, 0.08, 11.4, IX0 + 0.12, 2.90, -2.75, 0));
    push(cove, bx(0.12, 0.08, 11.4, IX1 - 0.12, 2.90, -2.75, 0));
    const cv = merge(cove, M.lit(P.lightStore, 1.25));
    if (cv) { cv.castShadow = false; cv.receiveShadow = false; ceilG.add(cv); }
  }
  U.mark(ceilG, { order: 0.40, mode: 'rise' });
  group.add(ceilG);

  // —— 8.3 中岛货架 ×3（深 0.72m，排间净过道 1.33m，两条内过道可走）——
  let srand = 918273645;
  function rnd() { srand = (srand * 16807) % 2147483647; return srand / 2147483647; }
  const _o3 = new THREE.Object3D();
  function paint(geo, hex) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const n = g.attributes.position.count;
    const c = new THREE.Color(hex);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  }
  function place(geo, hex, x, y, z, rx, ry, rz) {
    _o3.position.set(x || 0, y || 0, z || 0);
    _o3.rotation.set(rx || 0, ry || 0, rz || 0);
    _o3.scale.set(1, 1, 1);
    _o3.updateMatrix();
    const g = geo.clone();
    g.applyMatrix4(_o3.matrix);
    return paint(g, hex);
  }
  function mergeColored(list) {
    const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
    let total = 0;
    for (const g of parts) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const g of parts) {
      const p3 = g.attributes.position, n3 = g.attributes.normal, c3 = g.attributes.color;
      for (let i = 0; i < p3.count; i++, o++) {
        pos[o * 3] = p3.getX(i); pos[o * 3 + 1] = p3.getY(i); pos[o * 3 + 2] = p3.getZ(i);
        if (n3) { nor[o * 3] = n3.getX(i); nor[o * 3 + 1] = n3.getY(i); nor[o * 3 + 2] = n3.getZ(i); }
        if (c3) { col[o * 3] = c3.getX(i); col[o * 3 + 1] = c3.getY(i); col[o * 3 + 2] = c3.getZ(i); }
        else { col[o * 3] = 1; col[o * 3 + 1] = 1; col[o * 3 + 2] = 1; }
      }
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g2.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g2.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g2;
  }

  // ── 7 类具体商品几何（顶点色 + instanceColor 着色）──
  const GEO_ONIGIRI = (() => {
    const tri = new THREE.CylinderGeometry(0.062, 0.062, 0.046, 3, 1);
    const body = place(tri, 0xfdfdf6, 0, 0, 0, Math.PI / 2, 0, Math.PI);
    const nori = place(new THREE.BoxGeometry(0.072, 0.026, 0.050), 0x22301f, 0, -0.030, 0, 0, 0, 0);
    return mergeColored([body, nori]);
  })();
  const GEO_BENTO = (() => {
    const tray = place(new THREE.BoxGeometry(0.165, 0.042, 0.115), 0xd8d2c2, 0, 0, 0, 0, 0, 0);
    const lid = place(new THREE.BoxGeometry(0.168, 0.016, 0.118), 0xf7f4e6, 0, 0.028, 0, 0, 0, 0);
    const band = place(new THREE.BoxGeometry(0.170, 0.020, 0.050), 0xffd9a8, 0, 0.002, 0, 0, 0, 0);
    return mergeColored([tray, lid, band]);
  })();
  const GEO_CUP = (() => {
    const cup = place(new THREE.CylinderGeometry(0.048, 0.036, 0.092, 10), 0xffffff, 0, 0, 0, 0, 0, 0);
    const rim = place(new THREE.CylinderGeometry(0.050, 0.050, 0.012, 10), 0xf4f4ec, 0, 0.050, 0, 0, 0, 0);
    const label = place(new THREE.CylinderGeometry(0.047, 0.040, 0.040, 10), 0xfff0d8, 0, 0.004, 0, 0, 0, 0);
    return mergeColored([cup, rim, label]);
  })();
  const GEO_PET = (() => {
    const body = place(new THREE.CylinderGeometry(0.033, 0.033, 0.105, 8), 0xf2f8ff, 0, 0, 0, 0, 0, 0);
    const neck = place(new THREE.CylinderGeometry(0.019, 0.031, 0.030, 8), 0xf2f8ff, 0, 0.066, 0, 0, 0, 0);
    const cap = place(new THREE.CylinderGeometry(0.020, 0.020, 0.018, 8), 0x3a4256, 0, 0.088, 0, 0, 0, 0);
    const label = place(new THREE.CylinderGeometry(0.034, 0.034, 0.046, 8), 0xffffff, 0, -0.012, 0, 0, 0, 0);
    return mergeColored([body, neck, cap, label]);
  })();
  const GEO_CAN = (() => {
    const body = place(new THREE.CylinderGeometry(0.031, 0.031, 0.078, 9), 0xffffff, 0, 0, 0, 0, 0, 0);
    const top = place(new THREE.CylinderGeometry(0.030, 0.030, 0.010, 9), 0xcfd6de, 0, 0.041, 0, 0, 0, 0);
    return mergeColored([body, top]);
  })();
  const GEO_BAG = (() => {
    const bag = place(new THREE.BoxGeometry(0.100, 0.126, 0.055), 0xffffff, 0, 0, 0, 0, 0, 0);
    const seal = place(new THREE.BoxGeometry(0.100, 0.014, 0.020), 0xf0f0ea, 0, 0.068, 0, 0, 0, 0);
    return mergeColored([bag, seal]);
  })();
  const GEO_MAG = (() => {
    const cover = place(new THREE.BoxGeometry(0.150, 0.205, 0.014), 0xffffff, 0, 0, 0, 0, 0, 0);
    const pages = place(new THREE.BoxGeometry(0.142, 0.196, 0.006), 0xf2efe4, 0, 0, 0.010, 0, 0, 0);
    return mergeColored([cover, pages]);
  })();

  const CAT = {
    onigiri: { geo: GEO_ONIGIRI, y: 0.023, w: 0.075, cols: [0xffffff, 0xf7f2e2] },
    bento: { geo: GEO_BENTO, y: 0.030, w: 0.180, cols: [0xffb27a, 0xffd9a8, 0x9fd6b0, 0xf6c2cf, 0xd7c6f0] },
    cup: { geo: GEO_CUP, y: 0.050, w: 0.105, cols: [0xd94f4f, 0x3f6fbf, 0xe8c35c, 0x4da96b, 0xe0803c] },
    pet: { geo: GEO_PET, y: 0.058, w: 0.072, cols: [0x63e8ff, 0x4da96b, 0xe8c35c, 0xdd7fa6, 0x3f6fbf] },
    can: { geo: GEO_CAN, y: 0.040, w: 0.070, cols: [0xd94f4f, 0x3f6fbf, 0xe8c35c, 0x4da96b, 0x5aa9c9] },
    bag: { geo: GEO_BAG, y: 0.064, w: 0.108, cols: [0xff8f4a, 0xe04f5f, 0x4f8fd4, 0x5cb46a, 0xe8c35c] },
    mag: { geo: GEO_MAG, y: 0.103, w: 0.160, cols: [0xd94f4f, 0x3f6fbf, 0xe8c35c, 0x4da96b, 0xdd7fa6, 0xf0f0f0] },
  };
  const INST2 = { onigiri: [], bento: [], cup: [], pet: [], can: [], bag: [], mag: [] };
  function addProd(kind, x, y, z, ry) {
    const c = CAT[kind];
    INST2[kind].push({
      p: [x, y + c.y, z],
      r: [0, ry || 0, 0],
      s: [1, 1, 1],
      c: c.cols[Math.floor(rnd() * c.cols.length)],
    });
  }

  const GON_L = 5.6, GON_D = 0.72, GON_H = 1.45;
  const GON_TIERS = [0.30, 0.64, 0.98, 1.32];
  // 每个 gondola 每一面 4 层分区（下两层 A，上两层 B）
  const ZONES = [
    { a: 'onigiri', b: 'bento' },   // g1 正面（前场走廊）
    { a: 'bag', b: 'cup' },         // g1 背面（内过道 1 西侧）
    { a: 'pet', b: 'can' },         // g2 正面（内过道 1 东侧）
    { a: 'bento', b: 'onigiri' },   // g2 背面（内过道 2 西侧）
    { a: 'cup', b: 'bag' },         // g3 正面（内过道 2 东侧）
    { a: 'pet', b: 'can' },         // g3 背面（后场）
  ];
  function fillShelf(cx, cz, y0, side, catKind, dense) {
    const c = CAT[catKind];
    const n = Math.max(6, Math.floor((GON_L - 0.5) / c.w));
    for (let i = 0; i < n; i++) {
      if (dense < 1 && rnd() > dense) continue;
      const lx = -GON_L / 2 + 0.30 + i * ((GON_L - 0.60) / (n - 1)) + (rnd() - 0.5) * 0.012;
      const z = cz + side * (0.20 + rnd() * 0.07);
      addProd(catKind, cx + lx, FL + y0, z, (rnd() - 0.5) * 0.10);
    }
  }

  const priceTex = canvasTex(512, 32, (c, w, h) => {
    c.fillStyle = '#f7f4e8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const x = i * 32;
      c.fillStyle = i % 3 === 0 ? '#e8e1cc' : '#ffffff';
      c.fillRect(x + 1, 2, 30, 28);
      c.fillStyle = '#2b3446'; c.fillRect(x + 4, 8, 24, 4);
      c.fillStyle = '#c94a4a'; c.fillRect(x + 4, 16, 12, 6);
    }
  });
  const popTex = canvasTex(128, 64, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d94f4f'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = '#d94f4f'; c.font = '700 26px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('売切', w / 2, h / 2);
  });
  // 分区吊牌
  function zoneTex(label, col) {
    return canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = col; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.font = '700 34px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(label, w / 2, h / 2 + 1);
    });
  }

  function buildGondola(cx, cz, gi) {
    const grp = new THREE.Group();
    const body = [], faces = [], tags = [], ends = [], pops = [];
    push(body, bx(GON_L, GON_H, 0.10, 0, GON_H / 2, 0));
    for (let ti = 0; ti < GON_TIERS.length; ti++) {
      const y0 = GON_TIERS[ti];
      for (const sd of [-1, 1]) {
        const zone = ZONES[gi * 2 + (sd > 0 ? 0 : 1)];
        const kind = ti < 2 ? zone.a : zone.b;
        push(body, bx(GON_L, 0.035, 0.30, 0, y0, sd * 0.19));
        const f = qd(GON_L - 0.12, 0.32, 0, y0 + 0.175, sd * 0.105, sd > 0 ? 0 : Math.PI);
        faces.push(f);
        push(tags, bx(GON_L - 0.12, 0.05, 0.02, 0, y0 + 0.008, sd * 0.355));
        fillShelf(cx, cz, y0, sd, kind, ti === 0 ? 1.0 : ti === 1 ? 0.92 : ti === 2 ? 0.72 : 0.5);
        if (rnd() < 0.5) {
          const sx2 = cx - GON_L / 2 + 0.8 + rnd() * (GON_L - 1.6);
          pops.push(qd(0.16, 0.07, sx2, FL + y0 + 0.075, cz + sd * 0.352, sd > 0 ? 0 : Math.PI));
        }
      }
    }
    for (const ex of [-GON_L / 2, GON_L / 2]) {
      for (let t = 0; t < 3; t++) {
        push(ends, bx(0.42, 0.06, 0.60, ex, 0.22 + t * 0.30, 0));
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            addProd(t % 2 ? 'bento' : 'cup', cx + ex + (i - 0.5) * 0.17, FL + 0.25 + t * 0.30, cz + (j - 0.5) * 0.24, 0);
          }
        }
      }
      push(ends, bx(0.44, 0.05, 0.62, ex, 1.16, 0));
    }
    push(body, bx(0.06, GON_H + 0.06, GON_D, -GON_L / 2, (GON_H + 0.06) / 2, 0));
    push(body, bx(0.06, GON_H + 0.06, GON_D, GON_L / 2, (GON_H + 0.06) / 2, 0));
    push(body, bx(GON_L, 0.05, GON_D, 0, GON_H + 0.03, 0));
    push(body, bx(GON_L, 0.20, 0.05, 0, GON_H + 0.15, 0.35));
    push(body, bx(GON_L, 0.20, 0.05, 0, GON_H + 0.15, -0.35));
    const mb = merge(body, MAT.shelfBoard); if (mb) grp.add(mb);
    const me = merge(ends, MAT.shelfWhite); if (me) grp.add(me);
    const prodTex = texRep(T.shelfProducts(3 + gi), 2.6, 1);
    const mf = merge(faces, M.cel(0x8f8a80, { map: prodTex, emissive: 0x6a6055, emissiveIntensity: 0.06 }));
    if (mf) grp.add(mf);
    const mt = merge(tags, M.cel(0xffffff, { map: texRep(priceTex, 4.4, 1), emissive: 0x6a6152, emissiveIntensity: 0.10 }));
    if (mt) grp.add(mt);
    if (pops.length) {
      const mp = merge(pops, M.cel(0xffffff, { map: popTex, emissive: 0x8a7f74, emissiveIntensity: 0.10 }));
      if (mp) grp.add(mp);
    }
    const capTex = T.poster(1 + (gi % 5));
    const cap = qd(0.58, 0.86, -GON_L / 2 - 0.055, 1.02, 0, -Math.PI / 2);
    cap.material = M.interior(0xffffff, { map: capTex, glow: 0.5 });
    grp.add(cap);
    const head = bx(GON_L, 0.20, 0.02, 0, GON_H + 0.15, 0.365);
    head.material = M.lit(gi % 2 ? P.storeOrange : P.storeGreen, 0.75);
    grp.add(head);
    grp.position.set(cx, FL, cz);
    return grp;
  }
  {
    const gz = [1.05, -1.00, -3.05];
    const orders = [0.44, 0.47, 0.50];
    for (let i = 0; i < 3; i++) {
      const gg = buildGondola(-3.75, gz[i], i);
      U.mark(gg, { order: orders[i], mode: 'pop' });
      interior.add(gg);
    }
  }

  // 分区吊牌（吊在货架上方，标明该面卖什么）
  {
    const zones = [
      { label: 'おにぎり・お弁当', col: '#2f9e6b', cz: 1.05, sd: 1 },
      { label: 'お菓子・カップ麺', col: '#e0803c', cz: 1.05, sd: -1 },
      { label: '飲料', col: '#2f6fd0', cz: -1.00, sd: 1 },
      { label: 'お弁当・おにぎり', col: '#2f9e6b', cz: -1.00, sd: -1 },
      { label: 'カップ麺・お菓子', col: '#e0803c', cz: -3.05, sd: 1 },
      { label: '飲料・お酒', col: '#2f6fd0', cz: -3.05, sd: -1 },
    ];
    for (const z of zones) {
      const tex = zoneTex(z.label, z.col);
      const q = qd(1.30, 0.24, -3.75, 2.28, z.cz + z.sd * 0.42, z.sd > 0 ? 0 : Math.PI);
      q.material = M.lit(0xffffff, 0.62, tex);
      q.userData.noOutline = true;
      U.mark(q, { order: 0.55, mode: 'pop' });
      interior.add(q);
    }
  }

  // 7 个 InstancedMesh（每个品类 1 个 draw call）
  {
    const itemMat = M.interior(0xffffff, { glow: 0.12 }).clone();
    itemMat.vertexColors = true;
    itemMat.needsUpdate = true;
    const dummy = new THREE.Object3D();
    const cTmp = new THREE.Color();
    const prodG = new THREE.Group();
    for (const kind of ['onigiri', 'bento', 'cup', 'pet', 'can', 'bag', 'mag']) {
      const list = INST2[kind];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(CAT[kind].geo, itemMat, list.length);
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        dummy.position.set(it.p[0], it.p[1], it.p[2]);
        dummy.rotation.set(0, it.r[1], 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        im.setColorAt(i, cTmp.set(it.c));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = false; im.receiveShadow = false;
      prodG.add(im);
    }
    U.mark(prodG, { order: 0.52, mode: 'pop' });
    interior.add(prodG);
  }

  // —— 8.4 饮料冷柜墙（西墙，5 台，面朝 +x）——
  {
    const fridgeG = new THREE.Group();
    const body = [], frame = [], glow = [];
    const units = 5, UW = 1.2, zTop = 1.35;
    const fridgeSeeds = [1, 2, 3, 1, 2];
    const prodBySeed = new Map();
    for (let i = 0; i < units; i++) {
      const zc = zTop - UW / 2 - i * UW;
      // 柜体（后箱）
      push(body, bx(0.62, 2.05, UW - 0.04, X0 + 0.35 + 0.31, FL + 1.025, zc));
      // 内腔亮背板 / 顶灯
      push(glow, bx(0.03, 1.78, UW - 0.12, -8.02, FL + 1.20, zc));
      push(glow, bx(0.30, 0.05, UW - 0.14, -8.20, FL + 1.98, zc));
      // 商品贴面
      const p = qd(UW - 0.14, 1.80, -7.99, FL + 1.15, zc, Math.PI / 2);
      p.material = null;
      const arr = prodBySeed.get(fridgeSeeds[i]) || [];
      arr.push(p); prodBySeed.set(fridgeSeeds[i], arr);
      // 玻璃门 + 金属框 + 竖把手
      const dg = qd(UW - 0.10, 1.94, -7.90, FL + 1.10, zc, Math.PI / 2);
      dg.material = G.fridge;
      fridgeG.add(dg);
      push(frame, bx(0.07, 2.02, 0.07, -7.90, FL + 1.05, zc - UW / 2 + 0.03));
      push(frame, bx(0.07, 2.02, 0.07, -7.90, FL + 1.05, zc + UW / 2 - 0.03));
      push(frame, bx(0.07, 0.07, UW - 0.06, -7.90, FL + 2.05, zc));
      push(frame, bx(0.07, 0.07, UW - 0.06, -7.90, FL + 0.05, zc));
      push(frame, bx(0.05, 0.90, 0.05, -7.83, FL + 1.25, zc + UW / 2 - 0.20));
    }
    const mb = merge(body, MAT.shelfWhite); if (mb) fridgeG.add(mb);
    const mg = merge(glow, M.lit(P.fridgeGlow, 0.55)); if (mg) fridgeG.add(mg);
    const mf = merge(frame, MAT.metal); if (mf) fridgeG.add(mf);
    for (const [seed, arr] of prodBySeed) {
      const tex = T.fridgeProducts(seed);
      const mp = merge(arr, M.lit(0xffffff, 0.74, tex));
      if (mp) fridgeG.add(mp);
    }
    U.mark(fridgeG, { order: 0.46, mode: 'pop' });
    interior.add(fridgeG);
  }

  // —— 8.5 杂志架（靠正面玻璃内侧偏西）——
  {
    const magG = new THREE.Group();
    const body = [];
    const W = 4.0, Dp = 0.34, Hh = 0.85;
    push(body, bx(W, Hh, Dp, 0, Hh / 2, 0));
    const faces = [];
    const tiers = [0.30, 0.545, 0.79];
    for (const y of tiers) {
      // 斜面（法线朝 +z 上倾）
      const f = qd(W - 0.1, 0.26, 0, y, 0.235, 0, -Math.PI / 2 + 0.30);
      f.rotation.set(-0.30, 0, 0);
      faces.push(f);
      push(body, bx(W, 0.03, 0.10, 0, y - 0.155, 0.235));
    }
    const mb = merge(body, MAT.shelfBoard); if (mb) magG.add(mb);
    const tex = texRep(T.magazines(1), 2.6, 1);
    const mf = merge(faces, M.cel(0xffffff, { map: tex, emissive: 0xffe9c4, emissiveIntensity: 0.14 }));
    if (mf) magG.add(mf);
    magG.position.set(-5.6, FL, 3.07);
    for (let t = 0; t < 3; t++) {
      const y0 = [0.30, 0.545, 0.79][t];
      for (let i = 0; i < 9; i++) {
        INST2.mag.push({
          p: [-7.45 + i * 0.42, FL + y0 + 0.155, 3.20],
          r: [0, 0, 0],
          s: [1, 1, 1],
          c: CAT.mag.cols[Math.floor(rnd() * CAT.mag.cols.length)],
        });
      }
    }
    U.mark(magG, { order: 0.49, mode: 'pop' });
    interior.add(magG);
  }

  // —— 8.5a 东侧沿 z 货架排（透过东面玻璃可见）——
  {
    const rowG = new THREE.Group();
    const body = [], faces = [], tags = [];
    const L = 2.6, D = 0.86, H = 1.38;
    push(body, bx(0.09, H, L, 0, H / 2, 0));
    const tiers = [0.28, 0.61, 0.94];
    for (const y0 of tiers) {
      for (const s of [-1, 1]) {
        push(body, bx(0.38, 0.035, L, s * 0.23, y0, 0));
        const f = qd(L - 0.1, 0.29, s * 0.42, y0 + 0.175, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2);
        faces.push(f);
        push(tags, bx(0.02, 0.05, L - 0.1, s * 0.44, y0 + 0.012, 0));
      }
    }
    push(body, bx(D, H + 0.05, 0.06, 0, (H + 0.05) / 2, -L / 2));
    push(body, bx(D, H + 0.05, 0.06, 0, (H + 0.05) / 2, L / 2));
    push(body, bx(D, 0.05, L, 0, H + 0.03, 0));
    const mb = merge(body, MAT.shelfBoard); if (mb) rowG.add(mb);
    const rTex = texRep(T.shelfProducts(21), 2.9, 1);
    const mf = merge(faces, M.cel(0xffffff, { map: rTex, emissive: 0xffe9c4, emissiveIntensity: 0.16 })); if (mf) rowG.add(mf);
    const mt = merge(tags, M.lit(P.lightStore, 1.0)); if (mt) rowG.add(mt);
    rowG.position.set(2.30, FL, -5.40);
    U.mark(rowG, { order: 0.51, mode: 'pop' });
    interior.add(rowG);
  }

  // —— 8.5b 前排促销柜 + 中岛端架 ——
  {
    // 前排促销冷柜（正面玻璃 B 内侧，商品面朝街）
    const promo = new THREE.Group();
    const pb = [];
    push(pb, bx(1.62, 0.84, 0.52, 0, 0.54, 0));
    const pm = merge(pb, MAT.shelfWhite); if (pm) promo.add(pm);
    const pt = bx(1.70, 0.06, 0.60, 0, 0.99, 0);
    pt.material = MAT.counterTop; promo.add(pt);
    const pk = bx(1.52, 0.12, 0.44, 0, 0.06, 0);
    pk.material = MAT.trim; promo.add(pk);
    const fTex = texRep(T.shelfProducts(11), 1.12, 1);
    const f1 = qd(1.50, 0.74, 0, 0.56, 0.265, 0);
    f1.material = M.cel(0xffffff, { map: fTex, emissive: 0xffe9c4, emissiveIntensity: 0.10 });
    promo.add(f1);
    promo.position.set(1.95, FL, 2.96);
    U.mark(promo, { order: 0.50, mode: 'pop' });
    interior.add(promo);

  }

  // —— 8.6 收银台（L 形）+ 设备 + 店员 ——
  const clerkAnim = { body: null, head: null };
  {
    const cG = new THREE.Group();
    const bodyC = [], tops = [], darkF = [], metalF = [];
    const TOPY = FL + 0.95;
    // 主台：沿 z，顾客在西侧
    push(bodyC, bx(0.85, 0.92, 3.30, 1.875, 0.46, -0.20));
    push(tops, bx(0.98, 0.05, 3.40, 1.875, 0.945, -0.20));
    // L 短边：南端向 +x
    push(bodyC, bx(0.85, 0.92, 0.75, 2.30, 0.46, 1.42));
    push(tops, bx(0.95, 0.05, 0.85, 2.30, 0.945, 1.42));
    // 台前踢脚
    push(darkF, bx(0.07, 0.14, 3.42, 1.415, 0.07, -0.20));
    push(darkF, bx(0.85, 0.13, 0.05, 2.30, 0.065, 1.79));
    // 台面正面：A4 促销海报 + 小挂钩牌
    const frontPoster = qd(0.24, 0.33, 1.428, 0.72, -0.62, -Math.PI / 2);
    frontPoster.material = M.interior(0xffffff, { map: T.poster(2), glow: 0.34 });
    cG.add(frontPoster);
    const hookTex = canvasTex(128, 96, (c, w, h) => {
      c.fillStyle = '#f7f4e8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ef8a3c'; c.fillRect(0, 0, w, 26);
      c.fillStyle = '#ffffff'; c.font = '700 18px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('本日のおすすめ', w / 2, 14);
      c.fillStyle = '#2b3446'; c.font = '700 22px sans-serif';
      c.fillText('からあげ 180円', w / 2, 56);
      c.fillStyle = '#c94a4a'; c.fillRect(28, 72, 72, 12);
    });
    const hookSign = qd(0.22, 0.16, 1.428, 0.86, 0.55, -Math.PI / 2);
    hookSign.material = M.lit(0xffffff, 0.55, hookTex);
    cG.add(hookSign);
    const mb = merge(bodyC, MAT.counterBody); if (mb) cG.add(mb);
    const mt = merge(tops, MAT.counterTop); if (mt) cG.add(mt);

    // ── POS 收银机（机身 + 倾斜屏 + 键盘）──
    const posZ = 1.20;
    push(darkF, bx(0.34, 0.10, 0.28, 2.14, TOPY + 0.05, posZ));
    push(darkF, bx(0.30, 0.24, 0.22, 2.18, TOPY + 0.20, posZ));
    const posMat = M.lit(0x9fe8ff, 0.95).clone();
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.20), posMat);
    scr.rotation.order = 'YXZ';
    scr.rotation.set(-0.55, -Math.PI / 2, 0);
    scr.position.set(2.12, TOPY + 0.36, posZ);
    cG.add(scr);
    actor.posScr = scr; actor.posMat = posMat; actor.posBase = posMat.color.clone();
    // 键盘
    push(darkF, bx(0.34, 0.03, 0.22, 2.10, TOPY + 0.015, 0.86));
    // 小票打印机（矮盒 + 出纸口白纸）
    push(darkF, bx(0.22, 0.13, 0.17, 2.14, TOPY + 0.065, 1.56));
    const rcptGeo = new THREE.PlaneGeometry(0.06, 0.18);
    rcptGeo.translate(0, -0.09, 0);
    const rcptMat = M.lit(0xf8f6ee, 0.95).clone();
    const rcpt = new THREE.Mesh(rcptGeo, rcptMat);
    rcpt.position.set(2.11, TOPY + 0.135, 1.545);
    rcpt.rotation.y = -Math.PI / 2;
    rcpt.scale.y = 0.001;
    cG.add(rcpt);
    actor.receipt = rcpt;
    const paper = qd(0.15, 0.10, 2.14, TOPY + 0.16, 1.50, 0, -0.35);
    paper.material = M.lit(0xf6f4ea, 0.85);
    cG.add(paper);
    // 扫码枪 + 底座
    push(metalF, bx(0.11, 0.05, 0.11, 1.78, TOPY + 0.025, 0.98));
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.030, 0.15, 6), MAT.metalDark);
    gun.position.set(1.78, TOPY + 0.115, 0.98);
    gun.rotation.x = 0.45;
    cG.add(gun);
    const gunLed = bx(0.035, 0.012, 0.035, 1.78, TOPY + 0.185, 0.92);
    gunLed.material = M.lit(P.neonRed, 1.1); cG.add(gunLed);
    // 顾客侧支付终端（小竖屏，朝过道）
    push(metalF, bx(0.09, 0.16, 0.07, 1.56, TOPY + 0.08, 1.62));
    const payMat = M.lit(0x6cf0b4, 1.05).clone();
    const payScr = qd(0.14, 0.12, 1.505, TOPY + 0.24, 1.62, -Math.PI / 2, -0.15);
    payScr.material = payMat; cG.add(payScr);
    actor.payScr = payScr; actor.payMat = payMat; actor.payBase = payMat.color.clone();
    const card = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 8), MAT.metalDark);
    card.position.set(1.66, TOPY + 0.05, 1.48); card.rotation.z = Math.PI / 2;
    cG.add(card);
    // 台面防滑垫 + レジ 立牌
    const matTex = canvasTex(128, 64, (c, w, h) => {
      c.fillStyle = '#3d424c'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#565d68'; c.lineWidth = 3;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, i * 11 + 4); c.lineTo(w, i * 11 + 4); c.stroke(); }
    });
    const slip = qd(0.46, 0.30, 1.92, TOPY + 0.006, 0.18, 0, -Math.PI / 2);
    slip.material = M.interior(0x4a505a, { map: matTex, glow: 0.20 });
    cG.add(slip);
    const regiTex = canvasTex(128, 96, (c, w, h) => {
      c.fillStyle = '#f7f4e8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#2f9e6b'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#1f7a51'; c.font = '700 44px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('レジ', w / 2, h / 2 + 2);
    });
    const regi = qd(0.16, 0.12, 1.62, TOPY + 0.07, 1.32, 0);
    regi.material = M.lit(0xffffff, 0.9, regiTex);
    cG.add(regi);
    // 台下垃圾口 + 袋架
    push(darkF, bx(0.06, 0.26, 0.22, 1.45, 0.62, -1.55));
    // 购物篮叠放（柜台西侧地面）
    const bk = [];
    for (let i = 0; i < 3; i++) {
      push(bk, bx(0.46, 0.09, 0.32, 1.18, FL + 0.05 + i * 0.095, -1.62));
      if (i > 0) push(bk, bx(0.44, 0.05, 0.30, 1.18, FL + 0.09 + i * 0.095, -1.62));
    }
    const bkM = merge(bk, M.interior(P.trashBlue, { glow: 0.30 }));
    if (bkM) cG.add(bkM);

    // ── 后台背柜（沿东墙）──
    push(bodyC, bx(0.55, 0.80, 3.30, 2.875, 0.55, -0.20));
    const backTop = bx(0.60, 0.05, 3.36, 2.885, 0.975, -0.20);
    backTop.material = MAT.counterTop; cG.add(backTop);
    const backM = merge([bx(0.55, 0.80, 3.30, 2.875, 0.55, -0.20)], MAT.shelfWhite);
    if (backM) cG.add(backM);
    const mD2 = merge(darkF, MAT.metalDark); if (mD2) cG.add(mD2);
    const mM2 = merge(metalF, MAT.metal); if (mM2) cG.add(mM2);

    // 烟架：12 列 × 6 行 = 72 格
    const cigTex = canvasTex(768, 228, (c, w, h) => {
      c.fillStyle = '#e9ecf0'; c.fillRect(0, 0, w, h);
      const cols = ['#d94f4f', '#3f6fbf', '#e8c35c', '#4da96b', '#dd7fa6', '#5aa9c9', '#f0f0f0', '#e0803c', '#8a6fb8', '#c9d2da'];
      let sd = 7;
      const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 12; x++) {
          c.fillStyle = cols[Math.floor(rr() * cols.length)];
          c.fillRect(4 + x * 64, 6 + y * 38, 56, 28);
          c.fillStyle = 'rgba(255,255,255,0.92)';
          c.fillRect(8 + x * 64, 12 + y * 38, 48, 7);
          c.fillStyle = 'rgba(40,44,56,0.25)';
          c.fillRect(4 + x * 64, 32 + y * 38, 56, 3);
        }
      }
    });
    const cig = qd(3.20, 0.95, 3.18, 1.78, -0.20, -Math.PI / 2);
    cig.material = M.interior(0xece4d2, { map: cigTex, glow: 0.16 });
    cG.add(cig);
    const cigFrame = bx(0.04, 1.04, 3.28, 3.20, 1.78, -0.20);
    cigFrame.material = MAT.metal; cG.add(cigFrame);
    // 烟架上方分类标牌
    const catTex = canvasTex(512, 48, (c, w, h) => {
      const names = ['タバコ', '加熱式', '葉巻', 'ライター'];
      const cols2 = ['#2f9e6b', '#2f6fd0', '#ef8a3c', '#8a6fb8'];
      for (let i = 0; i < 4; i++) {
        c.fillStyle = cols2[i]; c.fillRect(i * 128, 0, 128, h);
        c.fillStyle = '#ffffff'; c.font = '700 26px sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(names[i], i * 128 + 64, h / 2 + 1);
      }
    });
    const cat = qd(3.10, 0.16, 3.17, 2.37, -0.20, -Math.PI / 2);
    cat.material = M.lit(0xffffff, 0.75, catTex);
    cG.add(cat);

    // ── 热食柜（玻璃罩 + 暖光 + 炸物）──
    const hotX = 2.86, hotZ = -1.60;
    const hotBody = [];
    push(hotBody, bx(0.46, 0.10, 0.62, hotX, FL + 0.98, hotZ));
    push(hotBody, bx(0.46, 0.06, 0.62, hotX, FL + 1.46, hotZ));
    push(hotBody, bx(0.46, 0.38, 0.04, hotX, FL + 1.24, hotZ - 0.29));
    const hotM = merge(hotBody, MAT.metal); if (hotM) cG.add(hotM);
    const hotGlass = bx(0.02, 0.38, 0.60, hotX - 0.225, FL + 1.24, hotZ);
    hotGlass.material = G.fridge; cG.add(hotGlass);
    const hotGlass2 = bx(0.44, 0.38, 0.02, hotX, FL + 1.24, hotZ + 0.29);
    hotGlass2.material = G.fridge; cG.add(hotGlass2);
    const hotIn = qd(0.30, 0.26, hotX - 0.19, FL + 1.22, hotZ, -Math.PI / 2);
    hotIn.material = M.lit(P.lightWarm, 0.80); cG.add(hotIn);
    const fA = [], fB = [], fC = [];
    const fried = [[-0.14, -0.12, 0.075], [0.04, -0.14, 0.070], [-0.10, 0.12, 0.065], [0.15, 0.10, 0.070]];
    for (let i = 0; i < fried.length; i++) {
      const o = fried[i];
      const m = new THREE.Mesh(new THREE.SphereGeometry(o[2], 8, 6), MAT.shelfWhite);
      m.position.set(hotX + o[0], FL + 1.06, hotZ + o[1]);
      m.scale.set(1.25, 0.62, 1.0);
      (i % 3 === 0 ? fA : i % 3 === 1 ? fB : fC).push(m);
    }
    const fa = merge(fA, M.interior(0xd9a24e, { glow: 0.35 })); if (fa) cG.add(fa);
    const fb = merge(fB, M.interior(P.productBrown, { glow: 0.35 })); if (fb) cG.add(fb);
    const fc = merge(fC, M.interior(0xc98a48, { glow: 0.35 })); if (fc) cG.add(fc);

    // ── 咖啡机 + 纸杯摞 ──
    const cofX = 2.86, cofZ = 0.00;
    const cof = [];
    push(cof, bx(0.42, 0.56, 0.40, cofX, FL + 1.24, cofZ));
    push(cof, bx(0.20, 0.06, 0.14, cofX - 0.16, FL + 1.34, cofZ));
    push(cof, bx(0.30, 0.04, 0.26, cofX - 0.05, FL + 1.02, cofZ));
    const cofM = merge(cof, MAT.metalDark); if (cofM) cG.add(cofM);
    const cofPanel = qd(0.24, 0.12, cofX - 0.215, FL + 1.34, cofZ, -Math.PI / 2);
    cofPanel.material = M.lit(0x9ee8c0, 1.0); cG.add(cofPanel);
    const cups = [];
    for (let i = 0; i < 6; i++) {
      push(cups, U.cyl(0.042, 0.032, 0.055, 8, DUMMY, { x: cofX - 0.02, y: FL + 1.05 + i * 0.05, z: cofZ + 0.30 }));
    }
    const cupM = merge(cups, MAT.paper); if (cupM) cG.add(cupM);

    // ── 关东煮锅 + 竹签 + 蒸汽 ──
    const odX = 2.86, odZ = -0.90;
    const pot = [];
    push(pot, bx(0.52, 0.26, 0.62, odX, FL + 1.10, odZ));
    push(pot, bx(0.54, 0.05, 0.64, odX, FL + 1.25, odZ));
    const potM = merge(pot, MAT.stainless); if (potM) cG.add(potM);
    const potGlow = qd(0.48, 0.12, odX - 0.265, FL + 1.18, odZ, -Math.PI / 2);
    potGlow.material = M.lit(P.lightWarmDeep, 1.0); cG.add(potGlow);
    const sticks = [];
    for (let i = 0; i < 8; i++) {
      const sx3 = odX - 0.18 + (i % 4) * 0.12;
      const sz3 = odZ - 0.15 + Math.floor(i / 4) * 0.30;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 4), MAT.paper);
      st.position.set(sx3, FL + 1.32, sz3);
      st.rotation.z = 0.25; st.rotation.x = 0.12;
      sticks.push(st);
    }
    const stM = merge(sticks, MAT.paper); if (stM) cG.add(stM);
    const steam = qd(0.70, 0.55, odX - 0.30, FL + 1.60, odZ, -Math.PI / 2);
    steam.material = glowMat(P.lightWarm, 0.16, T.glowSprite());
    steam.userData.noOutline = true;
    cG.add(steam);

    cG.position.set(0, 0, 0);
    U.mark(cG, { order: 0.52, mode: 'pop' });
    interior.add(cG);
  }

  // —— 8.6b 店员（三渲二低模，站收银台后）——
  const clerkG = new THREE.Group();
  {
    const SKIN = 0xf0c9a8, HAIR = 0x3a2f2a, TROUSER = 0x4a4f5a;
    const bodyP = new THREE.Group();
    const parts = [];
    // 鞋 / 腿
    push(parts, bx(0.14, 0.07, 0.24, -0.10, 0.035, 0.02));
    push(parts, bx(0.14, 0.07, 0.24, 0.10, 0.035, 0.02));
    push(parts, bx(0.135, 0.72, 0.16, -0.10, 0.42, 0));
    push(parts, bx(0.135, 0.72, 0.16, 0.10, 0.42, 0));
    const legM = merge(parts, M.cel(TROUSER)); if (legM) { M.outline(legM, 0.018); bodyP.add(legM); }
    // 躯干（白衬衫）
    const torsoM = bx(0.40, 0.54, 0.24, 0, 1.05, 0);
    torsoM.material = M.cel(0xf2f2ee);
    M.outline(torsoM, 0.018);
    bodyP.add(torsoM);
    // 工装马甲（深绿）
    const vestM = bx(0.43, 0.44, 0.27, 0, 1.02, 0);
    vestM.material = M.cel(P.storeGreen);
    M.outline(vestM, 0.016);
    bodyP.add(vestM);
    // 领子 + 名牌
    const collar = bx(0.20, 0.05, 0.20, 0, 1.33, 0);
    collar.material = M.cel(0xfbfbf6); bodyP.add(collar);
    const tag = bx(0.07, 0.035, 0.012, 0.10, 1.16, 0.142);
    tag.material = M.cel(0xfaf7ec); bodyP.add(tag);
    // 脖子
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 6), M.cel(SKIN));
    neck.position.set(0, 1.375, 0); bodyP.add(neck);
    // 头（压扁球）
    const headG = new THREE.Group();
    headG.position.set(0, 1.50, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 9), M.cel(SKIN));
    head.scale.set(1.0, 0.95, 0.95);
    M.outline(head, 0.016);
    headG.add(head);
    // 短发（压扁半球 + 两鬓）
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.36), M.cel(HAIR));
    hair.scale.set(1.0, 0.95, 1.0);
    hair.position.y = 0.005;
    headG.add(hair);
    const bangL = bx(0.042, 0.07, 0.085, -0.100, 0.078, 0.020);
    bangL.material = M.cel(HAIR); headG.add(bangL);
    const bangR = bx(0.042, 0.07, 0.085, 0.100, 0.078, 0.020);
    bangR.material = M.cel(HAIR); headG.add(bangR);
    // 眼（两点，简笔）
    const eyeL = bx(0.026, 0.022, 0.012, -0.047, 0.004, 0.107);
    eyeL.material = M.cel(0x2b2f38); headG.add(eyeL);
    const eyeR = bx(0.026, 0.022, 0.012, 0.047, 0.004, 0.107);
    eyeR.material = M.cel(0x2b2f38); headG.add(eyeR);
    bodyP.add(headG);
    // 手臂：肩 → 肘 → 手（右手掌平放在台面上）
    const S_L = new THREE.Vector3(-0.235, 1.30, 0);
    const H_L = new THREE.Vector3(-0.265, 0.86, 0.03);
    const S_R = new THREE.Vector3(0.235, 1.30, 0);
    const H_R = new THREE.Vector3(0.10, 0.955, 0.50);
    function buildArm(S, H, L1, L2, upperMat, foreMat, palmFlat) {
      const g = new THREE.Group();
      const d = new THREE.Vector3().subVectors(H, S);
      const dist = Math.min(d.length(), L1 + L2 - 0.005);
      const half = dist / 2;
      const hb = Math.sqrt(Math.max(0.0004, L1 * L1 - half * half));
      const dir = d.clone().normalize();
      const perp = new THREE.Vector3(0.15, -0.55, -0.85);
      perp.sub(dir.clone().multiplyScalar(perp.dot(dir))).normalize();
      const E = S.clone().addScaledVector(dir, half).addScaledVector(perp, hb);
      const up = U.segCyl([S.x, S.y, S.z], [E.x, E.y, E.z], 0.046, upperMat, 6);
      const fo = U.segCyl([E.x, E.y, E.z], [H.x, H.y, H.z], 0.038, foreMat, 6);
      g.add(up); g.add(fo);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.043, 8, 6), M.cel(SKIN));
      hand.position.copy(H);
      hand.scale.set(palmFlat ? 1.15 : 0.9, palmFlat ? 0.55 : 1.0, palmFlat ? 1.25 : 0.9);
      g.add(hand);
      return g;
    }
    const armL = buildArm(S_L, H_L, 0.32, 0.30, M.cel(P.storeGreen), M.cel(0xf2f2ee), false);
    bodyP.add(armL);
    const armR = buildArm(S_R, H_R, 0.32, 0.30, M.cel(P.storeGreen), M.cel(0xf2f2ee), true);
    bodyP.add(armR);
    actor.armR = armR;

    bodyP.position.set(0, 0, 0);
    clerkG.add(bodyP);
    clerkG.position.set(2.46, FL, 0.55);
    clerkG.rotation.y = -Math.PI / 2;   // 面向 -x（过道 / 顾客）
    U.mark(clerkG, { order: 0.58, mode: 'pop' });
    interior.add(clerkG);
    clerkAnim.body = bodyP;
    clerkAnim.head = headG;
    actor.clerkG = clerkG; actor.bodyP = bodyP; actor.headG = headG;
  }

  // —— 8.7 后墙日用品货架 + 通后场的门 + A4 告示 ——
  {
    const bG = new THREE.Group();
    const body = [], faces = [], tags = [];
    const W = 8.6, Dp = 0.60, Hh = 1.85;
    push(body, bx(W, Hh, 0.06, 0, Hh / 2, -0.27));  // 背板
    for (const y0 of [0.28, 0.70, 1.12, 1.54]) {
      push(body, bx(W, 0.035, Dp, 0, y0, 0));
      const f = qd(W - 0.1, 0.30, 0, y0 + 0.18, Dp / 2 - 0.01, 0);
      faces.push(f);
      push(tags, bx(W - 0.1, 0.05, 0.02, 0, y0 + 0.01, Dp / 2 + 0.01));
    }
    push(body, bx(0.06, Hh, Dp, -W / 2, Hh / 2, 0));
    push(body, bx(0.06, Hh, Dp, W / 2, Hh / 2, 0));
    push(body, bx(W, 0.05, Dp, 0, Hh + 0.025, 0));
    const mb = merge(body, MAT.shelfBoard); if (mb) bG.add(mb);
    const pTex = texRep(T.shelfProducts(9), 6.0, 1);
    const mf = merge(faces, M.cel(0xffffff, { map: pTex, emissive: 0xffe9c4, emissiveIntensity: 0.10 })); if (mf) bG.add(mf);
    const mt = merge(tags, M.lit(P.lightStore, 1.0)); if (mt) bG.add(mt);
    bG.position.set(-2.2, FL, IZ0 + 0.30);
    U.mark(bG, { order: 0.55, mode: 'pop' });
    interior.add(bG);

    // 通后场的门（0.9×2.1）+ 小窗 + STAFF 牌
    const dw = new THREE.Group();
    const dBody = [];
    push(dBody, bx(1.02, 2.20, 0.08, 0, 1.10, 0));
    const dM = merge(dBody, MAT.counterBody); if (dM) dw.add(dM);
    const panel = bx(0.9, 2.06, 0.03, 0, 1.05, 0.05);
    panel.material = M.interior(0x6b6f78, { glow: 0.25 }); dw.add(panel);
    const winTex = canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = '#3a4250'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffe6b0'; c.fillRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#3a4250'; c.fillRect(30, 8, 4, h - 16);
    });
    const dwin = qd(0.38, 0.38, 0, 1.62, 0.075, 0);
    dwin.material = M.lit(0xffffff, 0.85, winTex); dw.add(dwin);
    const staffTex = canvasTex(128, 40, (c, w, h) => {
      c.fillStyle = '#f2f4f0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2f9e6b'; c.font = '700 22px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('STAFF ONLY', w / 2, h / 2 + 1);
    });
    const staff = qd(0.42, 0.13, 0, 1.30, 0.075, 0);
    staff.material = M.lit(0xffffff, 0.95, staffTex); dw.add(staff);
    const handle = bx(0.05, 0.16, 0.05, 0.35, 1.02, 0.09);
    handle.material = MAT.metal; dw.add(handle);
    dw.position.set(2.35, FL, IZ0 + 0.06);
    U.mark(dw, { order: 0.57, mode: 'pop' });
    interior.add(dw);

    // A4 告示 ×2
    const nTex = T.poster(3);
    const n1 = qd(0.30, 0.42, 1.35, 1.55, IZ0 + 0.09, 0);
    n1.material = M.interior(0xffffff, { map: nTex, glow: 0.55 });
    n1.userData.noOutline = true;
    U.mark(n1, { order: 0.58, mode: 'pop' });
    interior.add(n1);
    const n2 = qd(0.30, 0.42, -6.9, 1.55, IZ0 + 0.09, 0);
    n2.material = M.interior(0xffffff, { map: T.poster(0), glow: 0.55 });
    n2.userData.noOutline = true;
    U.mark(n2, { order: 0.58, mode: 'pop' });
    interior.add(n2);
  }

  // —— 8.8 ATM / 购物篮 / 感应器 / 海报 ——
  {
    // ATM（东墙内侧 x≈3.0, z≈2.4）
    const atm = new THREE.Group();
    const aBody = [];
    push(aBody, bx(0.50, 1.62, 0.60, 0, 0.81, 0));
    push(aBody, bx(0.52, 0.10, 0.62, 0, 1.66, 0));
    const aM = merge(aBody, MAT.metalDark); if (aM) atm.add(aM);
    const aScr = qd(0.36, 0.26, -0.26, 1.22, 0, -Math.PI / 2);
    aScr.material = M.lit(0x9fd8ff, 1.1); atm.add(aScr);
    const aPad = bx(0.04, 0.26, 0.30, -0.25, 0.95, 0);
    aPad.material = MAT.metal; atm.add(aPad);
    const aGlow = qd(1.1, 1.6, -0.30, 0.95, 0, -Math.PI / 2);
    aGlow.material = glowMat(P.neonCyan, 0.12, T.glowSprite());
    aGlow.userData.noOutline = true;
    atm.add(aGlow);
    atm.position.set(2.92, FL, 2.40);
    U.mark(atm, { order: 0.60, mode: 'pop' });
    interior.add(atm);

    // 购物篮堆（收银台旁）
    const basketG = new THREE.Group();
    const bBlue = [], bRed = [];
    for (let i = 0; i < 4; i++) {
      const b4 = bx(0.52, 0.10, 0.36, 0, 0.09 + i * 0.105, 0);
      if (i === 0) bRed.push(b4); else bBlue.push(b4);
      if (i > 0) {
        const rim = bx(0.50, 0.06, 0.34, 0, 0.135 + i * 0.105, 0);
        bBlue.push(rim);
      }
    }
    const bb = merge(bBlue, M.interior(P.trashBlue, { glow: 0.35 })); if (bb) basketG.add(bb);
    const br = merge(bRed, M.interior(P.storeOrange, { glow: 0.35 })); if (br) basketG.add(br);
    basketG.position.set(-3.00, FL, 2.90);
    U.mark(basketG, { order: 0.60, mode: 'pop' });
    interior.add(basketG);

    // 天花板下 2 个感应器小盒
    const sensG = new THREE.Group();
    const sens = [];
    push(sens, bx(0.16, 0.07, 0.16, 0, 0, 0));
    push(sens, bx(0.16, 0.07, 0.16, 3.1, 0, -1.5));
    const sm = merge(sens, MAT.metalDark);
    if (sm) { sm.castShadow = false; sm.receiveShadow = false; sensG.add(sm); }
    sensG.position.set(-1.8, CEIL - 0.10, 1.9);
    U.mark(sensG, { order: 0.58, mode: 'pop' });
    interior.add(sensG);

    // 柱 / 墙海报 3 张
    const p1 = qd(0.52, 0.74, 3.20, 2.30, -3.30, -Math.PI / 2);
    p1.material = M.interior(0xffffff, { map: T.poster(0), glow: 0.55 });
    p1.userData.noOutline = true; U.mark(p1, { order: 0.58, mode: 'pop' }); interior.add(p1);
    const p2 = qd(0.52, 0.74, 3.20, 2.30, -4.30, -Math.PI / 2);
    p2.material = M.interior(0xffffff, { map: T.poster(2), glow: 0.55 });
    p2.userData.noOutline = true; U.mark(p2, { order: 0.58, mode: 'pop' }); interior.add(p2);
    const p3 = qd(0.52, 0.74, -8.74, 2.30, 2.55, Math.PI / 2);
    p3.material = M.interior(0xffffff, { map: T.poster(4), glow: 0.55 });
    p3.userData.noOutline = true; U.mark(p3, { order: 0.58, mode: 'pop' }); interior.add(p3);
  }

  // 店内不参与室外阴影
  interior.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  group.add(interior);

  // ══════════════════════════════════════════════════════════════════════════
  // 9. 门外 A 字立牌
  // ══════════════════════════════════════════════════════════════════════════
  {
    const ab = new THREE.Group();
    const pTex = T.poster(0);
    // 板体（有厚度，双面都成立）
    const boardA = bx(0.56, 0.86, 0.05, 0, 0.50, 0.055, 0);
    boardA.rotation.x = -0.13;
    boardA.material = MAT.paper;
    ab.add(boardA);
    const boardB = bx(0.56, 0.86, 0.05, 0, 0.50, -0.055, 0);
    boardB.rotation.x = 0.13;
    boardB.material = MAT.paper;
    ab.add(boardB);
    // 正面海报（贴纸面）
    const face = qd(0.50, 0.78, 0, 0.50, 0.085, 0);
    face.rotation.x = -0.13;
    face.material = M.lit(0xffffff, 0.62, pTex);
    ab.add(face);
    const fr = [];
    push(fr, bx(0.62, 0.05, 0.06, 0, 0.92, 0.0));
    push(fr, bx(0.62, 0.06, 0.34, 0, 0.05, 0.0));
    push(fr, bx(0.05, 0.90, 0.06, -0.29, 0.48, 0.0));
    push(fr, bx(0.05, 0.90, 0.06, 0.29, 0.48, 0.0));
    const fm = merge(fr, MAT.metalDark); if (fm) ab.add(fm);
    ab.position.set(-3.55, 0.14, 4.35);
    ab.rotation.y = 0.30;
    U.mark(ab, { order: 0.62, mode: 'pop' });
    group.add(ab);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. 描边（主要形体）
  // ══════════════════════════════════════════════════════════════════════════
  for (const o of [shell.children[0], upperG.children[0], signG.children[0], pylonG.children[0], canopyG.children[0]]) {
    if (o && o.isMesh) M.outline(o, 0.028);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 11. 店内灯光（随装配进度渐亮）
  // ══════════════════════════════════════════════════════════════════════════
  const bulbs = [];
  const lightDefs = [
    [-4.6, 2.25, 0.0, 2.6],
    [1.9, 2.25, 0.6, 2.4],
    [-7.4, 2.15, -1.4, 2.2],
  ];
  for (const [x, y, z, base] of lightDefs) {
    const l = new THREE.PointLight(P.lightStore, 0, 13, 2);
    l.position.set(x, y, z);
    l.castShadow = false;
    l.intensity = 0;
    l.userData.base = base;
    lights.add(l);
    bulbs.push(l);
  }

  /** 触发一次交互动画（幂等，重复触发=从头重播，不叠加） */
  function interact(id) {
    if (id === 'clerk') actor.anim.clerk = 0;
    else if (id === 'pos') actor.anim.pos = 0;
    else if (id === 'pay') actor.anim.pay = 0;
  }

  const _cA = new THREE.Color();

  let asmT = 0;
  function update(dt, t) {
    asmT = Math.max(asmT + dt, t || 0);
    const o0 = 0.40 * 7, o1 = 0.62 * 7;
    let p = (asmT - o0) / (o1 - o0);
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    const k = p * p * (3 - 2 * p);
    for (const l of bulbs) l.intensity = l.userData.base * k;

    // ── 交互：店员鞠躬 + 招手 ──
    const A = actor.anim;
    if (A.clerk >= 0) {
      A.clerk += dt;
      const T = A.clerk;
      let bow = 0;
      if (T < 0.55) bow = T / 0.55;
      else if (T < 1.2) bow = 1 - (T - 0.55) / 0.65;
      bow = Math.max(0, Math.min(1, bow));
      const e = bow * bow * (3 - 2 * bow);
      if (actor.bodyP) actor.bodyP.rotation.x = e * 0.315;
      if (actor.headG) actor.headG.rotation.x = e * 0.21;
      let wave = 0;
      if (T > 0.25 && T < 0.65) wave = (T - 0.25) / 0.4;
      else if (T >= 0.65 && T < 1.15) wave = 1 - (T - 0.65) / 0.5;
      if (actor.armR) actor.armR.rotation.x = -Math.max(0, Math.min(1, wave)) * 1.85;
      if (T > 1.35) {
        A.clerk = -1;
        if (actor.bodyP) actor.bodyP.rotation.x = 0;
        if (actor.headG) actor.headG.rotation.x = 0;
        if (actor.armR) actor.armR.rotation.x = 0;
      }
    }
    // ── 交互：POS 闪屏 + 打小票 ──
    if (A.pos >= 0) {
      A.pos += dt;
      const T = A.pos;
      const flash = T < 0.85 ? (Math.sin(T * 22) > 0 ? 1 : 0) : 0;
      if (actor.posMat) {
        _cA.copy(actor.posBase).multiplyScalar(0.85 + flash * 0.85);
        actor.posMat.color.copy(_cA);
      }
      if (actor.receipt) {
        let rl = 0;
        if (T < 0.35) rl = T / 0.35;
        else if (T < 1.85) rl = 1;
        else rl = Math.max(0, 1 - (T - 1.85) / 0.4);
        actor.receipt.scale.y = Math.max(0.001, rl);
      }
      if (T > 2.3) {
        A.pos = -1;
        if (actor.posMat) actor.posMat.color.copy(actor.posBase);
        if (actor.receipt) actor.receipt.scale.y = 0.001;
      }
    }
    // ── 交互：支付终端闪绿 ──
    if (A.pay >= 0) {
      A.pay += dt;
      const T = A.pay;
      const pulse = T < 0.8 ? Math.abs(Math.sin(T * 15)) : 0;
      if (actor.payMat) {
        _cA.copy(actor.payBase).lerp(new THREE.Color(0x9dffcf), 0.15 + pulse * 0.75);
        actor.payMat.color.copy(_cA);
      }
      if (T > 0.95) {
        A.pay = -1;
        if (actor.payMat) actor.payMat.color.copy(actor.payBase);
      }
    }
  }

  // ── 店内参观路径（第一人称，视高 1.55；y 固定）────────────────────────────
  // 绕 3 排 gondola 一圈：门内 → 前场西行 → 西侧冷柜通道 → 后场 → 东折 → 收银台前 → 回门口
  const interiorPath = [
    { p: [-1.20, 1.55, 2.75], look: [-2.70, 1.35, 2.00] },
    { p: [-2.55, 1.55, 2.28], look: [-5.00, 1.30, 2.20] },
    { p: [-4.10, 1.55, 2.22], look: [-6.90, 1.30, 2.15] },
    { p: [-5.60, 1.55, 2.22], look: [-7.75, 1.35, 1.40] },
    { p: [-7.00, 1.55, 2.20], look: [-7.60, 1.35, 0.60] },
    { p: [-7.22, 1.55, 0.70], look: [-7.10, 1.35, -0.30] },
    { p: [-6.30, 1.55, 0.03], look: [-4.20, 1.30, 0.03] },
    { p: [-4.90, 1.55, 0.03], look: [-2.60, 1.30, 0.03] },
    { p: [-3.50, 1.55, 0.03], look: [-1.30, 1.30, 0.03] },
    { p: [-2.10, 1.55, 0.03], look: [0.20, 1.30, 0.03] },
    { p: [-1.15, 1.55, 0.03], look: [-0.40, 1.30, -0.90] },
    { p: [-0.50, 1.55, -0.60], look: [-0.30, 1.30, -1.60] },
    { p: [-0.50, 1.55, -1.50], look: [-0.50, 1.30, -2.40] },
    { p: [-1.30, 1.55, -2.02], look: [-3.20, 1.30, -2.02] },
    { p: [-2.70, 1.55, -2.02], look: [-4.60, 1.30, -2.02] },
    { p: [-4.10, 1.55, -2.02], look: [-6.10, 1.30, -2.02] },
    { p: [-5.50, 1.55, -2.02], look: [-6.95, 1.35, -2.30] },
    { p: [-6.60, 1.55, -2.02], look: [-7.30, 1.35, -3.10] },
    { p: [-7.22, 1.55, -2.70], look: [-7.50, 1.35, -4.20] },
    { p: [-7.22, 1.55, -4.00], look: [-6.40, 1.30, -4.70] },
    { p: [-6.30, 1.55, -4.40], look: [-4.60, 1.30, -4.70] },
    { p: [-5.00, 1.55, -4.55], look: [-2.20, 1.20, -8.10] },
    { p: [-3.50, 1.55, -4.60], look: [-0.60, 1.30, -5.60] },
    { p: [-2.00, 1.55, -4.60], look: [0.40, 1.30, -4.70] },
    { p: [-0.55, 1.55, -4.55], look: [0.60, 1.30, -2.60] },
    { p: [0.30, 1.55, -3.95], look: [0.10, 1.35, -2.10] },
    { p: [-0.05, 1.55, -2.95], look: [0.90, 1.30, -1.30] },
    { p: [-0.05, 1.55, -1.45], look: [2.20, 1.25, -1.30] },
    { p: [-0.05, 1.55, 0.10], look: [2.45, 1.20, -0.30] },
    { p: [-0.55, 1.55, 1.30], look: [-1.20, 1.45, 3.20] },
    { p: [-1.20, 1.55, 2.60], look: [-1.20, 1.45, 4.20] },
  ];






  const door = {
    setOpen,
    center: [(D0 + D1) / 2, 1.15, Z1],
    normal: [0, 0, 1],
    width: 2.6,
    height: 2.3,
  };

  const hotspots = [
    { id: 'clerk', object: actor.clerkG, anchorY: 1.80 },
    { id: 'pos', object: actor.posScr, anchorY: 1.45 },
    { id: 'pay', object: actor.payScr, anchorY: 1.30 },
  ];

  return { group, lights, update, door, interiorPath, hotspots, interact };
}