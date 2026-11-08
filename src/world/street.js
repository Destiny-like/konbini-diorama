import * as THREE from 'three';

// 雨夜便利店 · 地面层（Worker A）
// 坐标严格按 CONTRACTS.md §1：底座 x,z∈[-12,12]，顶面 y=0，侧壁到 y=-1.0
const R = 12;            // 底座半边长
const ROAD_Y = 0.005;    // 车行道顶面
const WALK_Y = 0.14;     // 人行道顶面
const PAINT_Y = 0.012;   // 路面标线
const DECK_Y = -0.10;    // 埋在地下的底板（同时是排水沟槽底）
const EDGE = 6.0;        // 人行道路缘边界
const GUT_IN = 6.22;     // 沟槽内边（路缘石外侧面）
const LIP_A = 6.50;      // 沟槽外边（踢脚lip内侧）
const LIP_B = 6.53;      // 车行道起始
const WALK_IN = 3.5;     // 人行道内侧（贴便利店）

export function build(ctx) {
  const { P, M, T, U } = ctx;
  const root = new THREE.Group();

  const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

  const asphaltTex = T.asphalt();
  const paveTex = T.pavement();
  const concreteTex = T.concrete();
  const grateTex = T.grate();
  const manholeTex = T.manhole();
  const smearTex = T.smear();
  const glowTex = T.glowSprite('rgba(255,255,255,0.95)', 'rgba(255,255,255,0.22)');

  // ---------------- 局部工具 ----------------
  // 世界尺度 UV 的水平面片
  function rectGeo(x0, z0, x1, z1, y, tile) {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(x0 + w / 2, y, z0 + d / 2);
    if (tile) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
    }
    return g;
  }

  function mkMesh(geo, mat, cast) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = !!cast;
    m.receiveShadow = true;
    return m;
  }

  function mergeMeshes(list, mat, cast) {
    const out = U.merge(list, mat);
    out.castShadow = !!cast;
    out.receiveShadow = true;
    return out;
  }

  function boxGeo(w, h, d, x, y, z, ry) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return g;
  }

  // 加法混合反光片（每个实例独占材质，供 fade 动画使用）
  function additive(geo, hex, opacity, map) {
    const c = new THREE.Color(hex).multiplyScalar(1.7);
    const mat = new THREE.MeshBasicMaterial({
      color: c, map: map || null, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = false;
    m.receiveShadow = false;
    m.renderOrder = 6;
    return m;
  }

  // ================= 1. 底座 plinth =================
  const plinthG = new THREE.Group();
  const baseMat = M.cel(P.baseSide, { double: true, emissive: 0x2a3140, emissiveIntensity: 0.5 });

  // 去掉顶面的箱壳（顶面交给 deck / 路面）
  function shell(w, d, top, bot) {
    const g = new THREE.BoxGeometry(w, top - bot, d);
    const py = g.groups[2]; // +Y 面
    const idx = g.index.array;
    const keep = [];
    for (let i = 0; i < idx.length; i++) {
      if (i >= py.start && i < py.start + py.count) continue;
      keep.push(idx[i]);
    }
    g.setIndex(keep);
    g.clearGroups();
    g.translate(0, (top + bot) / 2, 0);
    return g;
  }

  const wallH = 1.005;
  const shellParts = [mkMesh(shell(2 * R, 2 * R, 0.005, -1.0), baseMat)];
  // 四角 0.1 倒角：竖向窄条近似
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.24, wallH, 0.07);
      g.rotateY(sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4);
      g.translate(sx * 11.9, -0.4975, sz * 11.9);
      shellParts.push(new THREE.Mesh(g, baseMat));
    }
  }
  plinthG.add(mergeMeshes(shellParts, baseMat, true));

  // 侧壁上层/下层腰线 + 底部极细装饰线
  plinthG.add(mkMesh(boxGeo(2 * R + 0.06, 0.16, 2 * R + 0.06, 0, -0.13, 0),
    M.cel(P.baseTrim, { emissive: P.baseTrim, emissiveIntensity: 1.2 }), true));
  plinthG.add(mkMesh(boxGeo(2 * R + 0.08, 0.02, 2 * R + 0.08, 0, -0.92, 0),
    M.cel(P.baseAccent, { emissive: P.baseAccent, emissiveIntensity: 1.4 })));

  // 极淡接缝
  const seamMat = M.cel(shade(P.baseSide, 0.45));
  const seamList = [];
  for (const t of [-6, 0, 6]) {
    for (const sz of [1, -1]) seamList.push(new THREE.Mesh(boxGeo(0.024, 0.62, 0.014, t, -0.40, sz * 12.005), seamMat));
    for (const sx of [1, -1]) seamList.push(new THREE.Mesh(boxGeo(0.014, 0.62, 0.024, sx * 12.005, -0.40, t), seamMat));
  }
  plinthG.add(mergeMeshes(seamList, seamMat));

  // 埋地板 / 排水沟槽底（同时兜住所有缝隙）
  plinthG.add(mkMesh(rectGeo(-R, -R, R, R, DECK_Y), M.cel(P.baseTop, { emissive: P.baseTop, emissiveIntensity: 0.55 })));
  U.mark(plinthG, { order: 0.0, mode: 'rise' });
  root.add(plinthG);

  // ================= 2. 车行道 / 路口 =================
  const roadG = new THREE.Group();
  const asphaltMat = M.cel(P.asphalt, { map: asphaltTex, emissive: 0x161e2c, emissiveIntensity: 0.9 });
  roadG.add(mergeMeshes([
    mkMesh(rectGeo(-R, LIP_B, LIP_B, 12, ROAD_Y, 4), asphaltMat),
    mkMesh(rectGeo(LIP_B, -R, 12, LIP_B, ROAD_Y, 4), asphaltMat),
  ], asphaltMat));
  // 路口单独一块
  roadG.add(mkMesh(rectGeo(LIP_B, LIP_B, 12, 12, ROAD_Y, 4), asphaltMat));
  // 便利店地块混凝土垫层（保证地块与底座之间无缝）
  const lotMat = M.cel(shade(P.sidewalk, 0.52), { map: concreteTex, emissive: P.sidewalk, emissiveIntensity: 0.14 });
  roadG.add(mkMesh(rectGeo(-9.06, -9.06, WALK_IN + 0.04, WALK_IN + 0.04, ROAD_Y, 2), lotMat));
  roadG.add(mkMesh(rectGeo(-R, -R, WALK_IN + 0.04, -9.0, ROAD_Y, 2), lotMat));
  U.mark(roadG, { order: 0.04, mode: 'rise' });
  root.add(roadG);

  // ================= 3. 路面标线 =================
  const whiteMat = M.cel(P.paintWhite, { emissive: P.paintWhite, emissiveIntensity: 0.14 });
  const yellowMat = M.cel(P.paintYellow, { emissive: P.paintYellow, emissiveIntensity: 0.16 });
  const whiteList = [];
  const yellowList = [];
  const addW = (x0, z0, x1, z1) => whiteList.push(mkMesh(rectGeo(x0, z0, x1, z1, PAINT_Y), whiteMat));
  const addY = (x0, z0, x1, z1) => yellowList.push(mkMesh(rectGeo(x0, z0, x1, z1, PAINT_Y), yellowMat));

  // 中心虚线（1.5m 段 + 3m 间隔）
  for (let x = -11.9; x + 1.5 <= EDGE; x += 4.5) {
    if (x + 1.5 > -5.3 && x < -0.7) continue; // 让开斑马线
    addW(x, 8.925, x + 1.5, 9.075);
  }
  for (let z = -11.9; z + 1.5 <= EDGE; z += 4.5) {
    if (z + 1.5 > 0.3 && z < 4.7) continue;
    addW(8.925, z, 9.075, z + 1.5);
  }
  // 两侧白实线（内侧白线让开斑马线）
  addW(-R, 6.63, -5.3, 6.75);
  addW(-0.7, 6.63, 6.0, 6.75);
  addW(6.63, -R, 6.75, 0.3);
  addW(6.63, 4.7, 6.75, 6.0);
  // 停止线
  addW(5.3, 6.63, 5.72, 9.0);
  addW(6.63, 5.3, 9.0, 5.72);
  // 斑马线：南街 x∈[-5,-1]
  const pitch = 4 / 7;
  for (let i = 0; i < 7; i++) {
    const cx = -5 + (i + 0.5) * pitch;
    addW(cx - 0.2, 6.56, cx + 0.2, 11.8);
  }
  // 斑马线：东街 z∈[0.5,4.5]
  for (let i = 0; i < 7; i++) {
    const cz = 0.5 + (i + 0.5) * pitch;
    addW(6.56, cz - 0.2, 11.8, cz + 0.2);
  }
  const paintWhiteMesh = mergeMeshes(whiteList, whiteMat);
  U.mark(paintWhiteMesh, { order: 0.12, mode: 'wipe', axis: 'x' });
  root.add(paintWhiteMesh);

  // 黄线：路肩线（斑马线处断开）
  addY(-R, 11.6, -5.3, 11.72);
  addY(-0.7, 11.6, 6.0, 11.72);
  addY(11.6, -R, 11.72, 0.3);
  addY(11.6, 4.7, 11.72, 6.0);
  const paintYellowMesh = mergeMeshes(yellowList, yellowMat);
  U.mark(paintYellowMesh, { order: 0.12, mode: 'wipe', axis: 'z' });
  root.add(paintYellowMesh);

  // ================= 4. 人行道 + 路缘石 =================
  const walkG = new THREE.Group();
  const walkBodyMat = M.cel(P.sidewalk, { emissive: P.sidewalk, emissiveIntensity: 0.22 });
  const walkTopMat = M.cel(P.sidewalk, { map: paveTex, emissive: P.sidewalk, emissiveIntensity: 0.2 });
  // 厚板主体（顶面 0.132 让给 top 面片，避免共面闪烁）
  walkG.add(mergeMeshes([
    mkMesh(boxGeo(2 * R - EDGE, 0.182, 6.0 - WALK_IN, -3.0, 0.041, 4.75), walkBodyMat, true),
    mkMesh(boxGeo(EDGE - WALK_IN, 0.182, WALK_IN + R, 4.75, 0.041, (WALK_IN - R) / 2), walkBodyMat, true),
  ], walkBodyMat, true));
  // 顶面铺砖
  walkG.add(mergeMeshes([
    mkMesh(rectGeo(-R, WALK_IN, EDGE, 6.0, WALK_Y, 2), walkTopMat),
    mkMesh(rectGeo(WALK_IN, -R, EDGE, WALK_IN, WALK_Y, 2), walkTopMat),
  ], walkTopMat));

  // 路缘石：挤出一个带圆角转角的 L 形带（2–3 段斜切近似）
  const curbPts = [[-R, GUT_IN], [EDGE, GUT_IN]];
  for (const a of [67.5, 45, 22.5]) {
    const rad = (a * Math.PI) / 180;
    curbPts.push([EDGE + 0.22 * Math.cos(rad), EDGE + 0.22 * Math.sin(rad)]);
  }
  curbPts.push([GUT_IN, EDGE], [GUT_IN, -R], [EDGE, -R], [EDGE, EDGE], [-R, EDGE]);
  const curbShape = new THREE.Shape();
  curbShape.moveTo(curbPts[0][0], curbPts[0][1]);
  for (let i = 1; i < curbPts.length; i++) curbShape.lineTo(curbPts[i][0], curbPts[i][1]);
  curbShape.closePath();
  const curbGeo = new THREE.ExtrudeGeometry(curbShape, { depth: 0.26, bevelEnabled: false, curveSegments: 1 });
  curbGeo.rotateX(Math.PI / 2);
  curbGeo.translate(0, WALK_Y, 0);
  walkG.add(mkMesh(curbGeo, M.cel(P.curb), true));

  // 人行道分缝线
  const jointMat = M.cel(shade(P.sidewalk, 0.74));
  const jointList = [];
  for (let x = -11.25; x <= 5.8; x += 1.5) jointList.push(new THREE.Mesh(boxGeo(0.035, 0.006, 2.5, x, 0.1425, 4.75), jointMat));
  for (let z = -11.25; z <= 3.2; z += 1.5) jointList.push(new THREE.Mesh(boxGeo(2.5, 0.006, 0.035, 4.75, 0.1425, z), jointMat));
  jointList.push(new THREE.Mesh(boxGeo(17.9, 0.006, 0.035, -3.05, 0.1425, 4.75), jointMat));
  jointList.push(new THREE.Mesh(boxGeo(0.035, 0.006, 14.5, 4.75, 0.1425, -4.0), jointMat));
  walkG.add(mergeMeshes(jointList, jointMat));
  U.mark(walkG, { order: 0.08, mode: 'rise' });
  root.add(walkG);

  // ================= 5. 排水沟 + 格栅 + 井盖 =================
  const drainG = new THREE.Group();
  const lipMat = M.cel(P.gutter);
  drainG.add(mergeMeshes([
    mkMesh(boxGeo(EDGE + 0.53, 0.126, 0.03, (-R + EDGE + 0.53) / 2, -0.057, 6.515), lipMat, true),
    mkMesh(boxGeo(0.03, 0.126, EDGE + 0.50, 6.515, -0.057, (-R + EDGE + 0.5) / 2), lipMat, true),
  ], lipMat, true));

  const grateMat = M.cel(P.metalGrate, { map: grateTex });
  const grateGeo = new THREE.BoxGeometry(0.52, 0.028, 0.28);
  const grates = [];
  for (let x = -11.4; x <= 5.9; x += 1.2) grates.push({ p: [x, -0.008, 6.36] });
  for (let z = -11.4; z <= 5.9; z += 1.2) grates.push({ p: [6.36, -0.008, z], r: [0, Math.PI / 2, 0] });
  // 人行道上的两处方口雨水篦子
  grates.push({ p: [0.9, 0.132, 5.5], s: [1, 1, 1.79] });
  grates.push({ p: [5.5, 0.132, 0.9], r: [0, Math.PI / 2, 0], s: [1, 1, 1.79] });
  drainG.add(U.inst(grateGeo, grateMat, grates));

  // 井盖
  const manholeMat = M.cel(P.wallWhite, { map: manholeTex });
  const mhList = [];
  for (const s of [[-7.6, 9.6, 0.42], [1.4, 10.6, 0.38], [9.6, 1.2, 0.34]]) {
    const g = new THREE.CircleGeometry(s[2], 20);
    g.rotateX(-Math.PI / 2);
    g.translate(s[0], 0.013, s[1]);
    mhList.push(new THREE.Mesh(g, manholeMat));
  }
  drainG.add(mergeMeshes(mhList, manholeMat));
  U.mark(drainG, { order: 0.15, mode: 'pop' });
  root.add(drainG);

  // ================= 6. 停车位 =================
  const parkG = new THREE.Group();
  const parkList = [];
  for (const x of [-8.5, -5.5, -2.5]) parkList.push(mkMesh(rectGeo(x - 0.05, 6.6, x + 0.05, 8.5, PAINT_Y), whiteMat));
  parkList.push(mkMesh(rectGeo(-8.5, 8.45, -2.5, 8.55, PAINT_Y), whiteMat));
  const parkPaint = mergeMeshes(parkList, whiteMat);
  parkG.add(parkPaint);
  const stopMat = M.cel(P.rubber);
  parkG.add(mergeMeshes([
    mkMesh(boxGeo(1.0, 0.14, 0.2, -7.0, 0.075, 8.2), stopMat, true),
    mkMesh(boxGeo(1.0, 0.14, 0.2, -4.0, 0.075, 8.2), stopMat, true),
  ], stopMat, true));
  U.mark(parkG, { order: 0.18, mode: 'wipe', axis: 'x' });
  root.add(parkG);

  // ================= 7. 积水与湿地面反光 =================
  const puddleBase = M.standard(P.puddle, { rough: 0.08, metal: 0.9 });
  function puddleGeo(r, squash, seed) {
    const g = new THREE.CircleGeometry(r, 22);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    let s = (seed * 9301 + 49297) % 233280;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const p1 = rnd() * 6.283, p2 = rnd() * 6.283, p3 = rnd() * 6.283;
    for (let i = 1; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.16 * Math.sin(3 * a + p1) + 0.09 * Math.sin(5 * a + p2) + 0.05 * Math.sin(2 * a + p3);
      pos.setX(i, x * k);
      pos.setZ(i, z * k * squash);
      pos.setY(i, (rnd() - 0.5) * 0.004);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }

  // [x, z, y, r, squash, 反光色, 不透明度]
  const puddles = [
    [0.4, 7.5, ROAD_Y + 0.015, 1.1, 0.72, P.lightWarm, 0.32],
    [2.6, 10.4, ROAD_Y + 0.015, 1.05, 0.82, P.puddleShine, 0.28],
    [9.2, 8.6, ROAD_Y + 0.015, 1.1, 0.68, P.lightCool, 0.3],
    [-9.6, 10.9, ROAD_Y + 0.015, 0.9, 0.86, P.lightWarm, 0.24],
    [7.6, 1.4, ROAD_Y + 0.015, 1.05, 0.64, P.lightCool, 0.26],
    [1.5, 5.3, WALK_Y + 0.016, 0.85, 0.7, P.lightWarm, 0.34],
    [-6.2, 5.35, WALK_Y + 0.016, 0.75, 0.76, P.puddleShine, 0.26],
    [-10.5, -1.6, 0.062, 0.8, 0.9, P.puddleShine, 0.22],
  ];
  puddles.forEach((pd, i) => {
    const [x, z, y, r, sq, col, op] = pd;
    const mat = puddleBase.clone();
    mat.transparent = true;
    const p = new THREE.Mesh(puddleGeo(r, sq, i + 3), mat);
    p.position.set(x, y, z);
    p.castShadow = false;
    p.receiveShadow = false;
    p.renderOrder = 4;
    U.mark(p, { order: 0.30, mode: 'fade' });
    root.add(p);

    // 柔光晕（弱）：只做湿面整体提亮
    const gl = additive(rectGeo(x - r * 1.1, z - r * 1.1 * sq, x + r * 1.1, z + r * 1.1 * sq, y + 0.012), col, op * 0.5, glowTex);
    U.mark(gl, { order: 0.30, mode: 'fade' });
    root.add(gl);

    // 拉长的倒影：湿地面上的光带
    const sm = additive(rectGeo(x - r * 0.5, z - r * 1.25, x + r * 0.5, z + r * 1.25, y + 0.014), col, op * 0.85, smearTex);
    U.mark(sm, { order: 0.30, mode: 'fade' });
    root.add(sm);
  });

  // 便利店玻璃窗外的暖黄反光带
  const bandWide = additive(rectGeo(-9.1, WALK_IN, 3.5, 5.3, WALK_Y + 0.008), P.lightWarmDeep, 0.22, smearTex);
  U.mark(bandWide, { order: 0.30, mode: 'fade' });
  root.add(bandWide);
  const bandCore = additive(rectGeo(-8.8, WALK_IN + 0.05, 3.3, 4.5, WALK_Y + 0.023), P.lightWarmDeep, 0.3, smearTex);
  U.mark(bandCore, { order: 0.30, mode: 'fade' });
  root.add(bandCore);
  // 东侧立面外的反光带（长轴沿 z，用旋转后的片）
  const eastBand = additive(rectGeo(-6, -0.925, 6, 0.925, 0), P.lightWarmDeep, 0.24, smearTex);
  eastBand.position.set(WALK_IN + 1.05, WALK_Y + 0.01, -3.0);
  eastBand.rotation.y = Math.PI / 2;
  eastBand.scale.set(1, 1, 1);
  U.mark(eastBand, { order: 0.30, mode: 'fade' });
  root.add(eastBand);

  // 湿润沥青上的长条反射（店光在车道上的拖影）
  const roadStreaks = [
    [-6.4, 6.62, 9.6, 1.0, P.lightWarm, 0.22],
    [-2.6, 6.62, 10.4, 1.2, P.lightStore, 0.26],
    [1.9, 6.62, 9.2, 1.0, P.lightWarm, 0.2],
    [7.4, 6.62, 8.6, 0.8, P.lightCool, 0.14],
  ];
  for (const s of roadStreaks) {
    const st = additive(rectGeo(s[0] - 0.5, s[1], s[0] + 0.5, s[2], ROAD_Y + 0.016), s[4], s[5], smearTex);
    st.scale.set(1, 1, 1);
    U.mark(st, { order: 0.30, mode: 'fade' });
    root.add(st);
  }

  // ================= 8. 小巷 =================
  const alleyG = new THREE.Group();
  const alleyDark = M.cel(P.asphaltDark, { map: asphaltTex, emissive: P.asphaltDark, emissiveIntensity: 0.42 });
  const alleyBodyMat = M.cel(shade(P.asphaltDark, 0.78));
  // 主体（顶面 0.02 = 中央排水槽底）
  alleyG.add(mergeMeshes([mkMesh(boxGeo(3.0, 0.12, 12.5, -10.5, -0.04, -2.75), alleyBodyMat, true)], alleyBodyMat, true));
  // 地面（中央留 0.3m 排水槽）
  alleyG.add(mergeMeshes([
    mkMesh(rectGeo(-R, -9.0, -10.65, 3.5, 0.06, 4), alleyDark),
    mkMesh(rectGeo(-10.35, -9.0, -9.0, 3.5, 0.06, 4), alleyDark),
  ], alleyDark));
  // 排水槽两侧槽壁
  alleyG.add(mergeMeshes([
    mkMesh(boxGeo(0.04, 0.045, 12.5, -10.67, 0.0375, -2.75), alleyBodyMat, true),
    mkMesh(boxGeo(0.04, 0.045, 12.5, -10.33, 0.0375, -2.75), alleyBodyMat, true),
  ], alleyBodyMat, true));
  // 入口小台阶
  alleyG.add(mkMesh(boxGeo(3.0, 0.04, 0.35, -10.5, 0.08, 3.325), M.cel(shade(P.curb, 0.7)), true));

  // 油污斑
  const oilMat = M.standard(shade(P.asphaltDark, 0.6), { rough: 0.25, metal: 0.5 });
  const oilList = [];
  for (const o of [[-10.1, 1.2, 0.62], [-11.2, -3.4, 0.5], [-9.7, -6.8, 0.7]]) {
    const g = new THREE.CircleGeometry(o[2], 12);
    g.rotateX(-Math.PI / 2);
    g.translate(o[0], 0.0605, o[1]);
    oilList.push(new THREE.Mesh(g, oilMat));
  }
  alleyG.add(mergeMeshes(oilList, oilMat));

  // 边缘杂草
  const weedMat = M.cel(P.plant);
  const weedGeo = new THREE.ConeGeometry(0.055, 0.24, 4);
  const weeds = [];
  for (let i = 0; i < 16; i++) {
    const left = i % 2 === 0;
    weeds.push({
      p: [left ? -11.78 : -9.24, 0.06 + 0.1, -8.4 + i * 0.72],
      s: [0.7 + (i % 3) * 0.35, 0.7 + (i % 4) * 0.3, 0.7 + (i % 3) * 0.35],
      r: [0, (i * 1.7) % 3.14, 0],
    });
  }
  alleyG.add(U.inst(weedGeo, weedMat, weeds));
  U.mark(alleyG, { order: 0.10, mode: 'rise' });
  root.add(alleyG);

  return { group: root };
}
