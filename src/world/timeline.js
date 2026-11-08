import * as THREE from 'three';

// 入场组装时间线：把 world 里所有打了 userData.asm 标注的装配单元，编排成
// 7 秒「散件从地面开始一层层组装成完整场景」的动画。构造时一次性摊平，
// 每帧只做标量插值 + 写回 position/scale/opacity，不碰场景树、不做 Box3。

const DUR = 7.0;
const STAGGER = 0.012;          // 同 order 的单元按遍历顺序错开
const MODE_DUR = { rise: 0.62, drop: 0.68, pop: 0.48, grow: 0.75, wipe: 0.72, fade: 0.6 };
const DEFAULT_MODE = 'pop';

const RISE_CLEAR = 0.6;         // rise 的起始深度 = 自身高度 + 0.6
const RISE_BOUNCE = 0.03;       // 末尾 20% 的上抛回弹量（相对行程）
const DROP_CLEAR = 3.0;         // drop 的起始高度 = 自身高度 + 3.0
const DROP_DIP = 0.06;          // easeOutBack 过冲最多沉到静止位以下 0.06（不插进地面）
const DROP_SQUASH = 0.03;       // 落地 0.97 压扁（乘法，不破坏已有缩放）
const POP_BACK = 0.13;          // pop 过冲系数：峰值 ~1.06（原生 easeOutBack 峰值 1.10）
const WIPE_DEFAULT_AXIS = 'x';

const ST_NEW = 0, ST_HIDDEN = 1, ST_MID = 2, ST_DONE = 3;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function easeOutCubic(t) { const u = 1 - t; return 1 - u * u * u; }
function easeOutBack(t) { const u = t - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; }
// 0 -> 1 的「过冲后回落」曲线：起点精确 0、终点精确 1，过冲幅度由 ov 控制
function backOutBounded(t, ov) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const s = Math.sin(Math.PI * t);
  return easeOutCubic(t) * (1 + ov * s * s * s);
}
function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

// 收集所有 asm 标注，且只取最外层：命中后不再下钻，其子孙标注自动被丢弃。
function collectMarked(root) {
  const found = [];
  if (!root) return found;
  const stack = [root];
  while (stack.length) {
    const o = stack.pop();
    if (!o) continue;
    const asm = o.userData && o.userData.asm;
    if (asm) { found.push({ obj: o, asm: asm }); continue; }
    const kids = o.children;
    if (!kids) continue;
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return found;
}

// fade 需要独占材质：构造时 clone 并记住原 opacity / 原 transparent
function prepFade(obj) {
  const recs = [];
  const stack = [obj];
  while (stack.length) {
    const o = stack.pop();
    const src = o.material;
    if (src) {
      const isArr = Array.isArray(src);
      const list = isArr ? src : [src];
      const clones = [];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (!m || typeof m.clone !== 'function') return null;
        const c = m.clone();
        // ShaderMaterial：clone() 会深拷 uniforms，导致原模块写 uTime 动画失效；
        // 这里把 uniforms 共享回原对象，只接管 opacity / uOpacity。
        if (m.isShaderMaterial && c.uniforms) c.uniforms = m.uniforms;
        const op = typeof m.opacity === 'number' && isFinite(m.opacity) ? m.opacity : 1;
        c.transparent = true;
        c.opacity = 0;
        const rec = { m: c, op: op, tr: m.transparent === true, u: null, uOp: 1 };
        const uo = c.uniforms && c.uniforms.uOpacity;
        if (uo && typeof uo.value === 'number') {
          rec.u = uo;
          rec.uOp = uo.value;
          uo.value = 0;
        }
        clones.push(c);
        recs.push(rec);
      }
      o.material = isArr ? clones : clones[0];
    }
    const kids = o.children;
    if (kids) for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return recs.length ? recs : null;
}

function applyFade(e, k) {
  const recs = e.mats;
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    r.m.opacity = r.op * k;
    if (r.u) r.u.value = r.uOp * k;
    if (k > 0 && r.m.transparent !== true) r.m.transparent = true;
  }
}

export function createAssembly(opts) {
  const o = opts || {};
  const root = o.world || o.scene || null;
  const entries = [];
  let time = 0;
  let broken = false;
  let settled = false;

  const _box = new THREE.Box3();
  const _inv = new THREE.Matrix4();
  const _local = new THREE.Box3();
  const _qW = new THREE.Quaternion();
  const _qP = new THREE.Quaternion();

  function makeEntry(obj, asm, stagger) {
    const rawMode = asm && typeof asm.mode === 'string' ? asm.mode : DEFAULT_MODE;
    const mode = Object.prototype.hasOwnProperty.call(MODE_DUR, rawMode) ? rawMode : DEFAULT_MODE;
    const dur = MODE_DUR[mode];
    const order = clamp01(num(asm && asm.order));

    // 同 order 错开 0.012s，并保证 start + dur <= DUR（这样 t>=DUR 一定全部收尾）
    const key = Math.round(order * 4096);
    const idx = stagger.get(key) || 0;
    stagger.set(key, idx + 1);
    let start = order * (DUR - dur) + idx * STAGGER;
    const latest = DUR - dur;
    if (start > latest) start = latest;
    if (start < 0) start = 0;

    const e = {
      obj: obj,
      mode: mode,
      dur: dur,
      start: start,
      end: start + dur,
      axis: asm && asm.axis === 'z' ? 'z' : WIPE_DEFAULT_AXIS,
      basePos: obj.position.clone(),
      baseScale: obj.scale.clone(),
      baseQuat: obj.quaternion.clone(),
      baseVisible: obj.visible !== false,
      hasBox: false,
      h: 0,
      d0: 0,
      up: null,
      grow: null,
      wipe: null,
      mats: null,
      state: ST_NEW,
    };

    if (mode === 'fade') {
      e.mats = prepFade(obj);
      if (!e.mats) return null;           // 无材质：安全跳过，保持静止可见
      return e;
    }
    if (mode === 'pop') return e;          // pop 只需要缩放，不需要包围盒

    // rise / drop / grow / wipe 需要量一次包围盒（构造期一次，之后不再用）
    obj.updateWorldMatrix(true, false);
    _box.setFromObject(obj);
    if (_box.isEmpty()) return null;       // 空盒（无 geometry）：安全跳过
    e.hasBox = true;
    e.h = Math.max(_box.max.y - _box.min.y, 0);

    // 世界方向 -> 父级坐标系方向（父级通常只有平移/绕 Y 旋转，转换后仍是单位轴）
    if (obj.parent) obj.parent.getWorldQuaternion(_qP).invert(); else _qP.identity();
    e.up = new THREE.Vector3(0, 1, 0).applyQuaternion(_qP);

    if (mode === 'grow' || mode === 'wipe') {
      _inv.copy(obj.matrixWorld).invert();
      _local.copy(_box).applyMatrix4(_inv);   // 对象本地坐标系下的包围盒
      obj.getWorldQuaternion(_qW);
      if (mode === 'grow') {
        e.d0 = _local.min.y * e.baseScale.y;
        e.grow = new THREE.Vector3(0, 1, 0).applyQuaternion(_qW).applyQuaternion(_qP);
      } else {
        const ax = e.axis;
        e.d0 = _local.min[ax] * e.baseScale[ax];
        const u = ax === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        e.wipe = u.applyQuaternion(_qW).applyQuaternion(_qP);
      }
    }
    return e;
  }

  try {
    const found = collectMarked(root);
    const stagger = new Map();
    for (let i = 0; i < found.length; i++) {
      let e = null;
      try {
        e = makeEntry(found[i].obj, found[i].asm, stagger);
      } catch (err) {
        e = null;
        if (typeof console !== 'undefined') console.warn('[timeline] skip asm unit', found[i].obj && found[i].obj.name, err);
      }
      if (e) entries.push(e);
    }
  } catch (err) {
    broken = true;
    entries.length = 0;
    if (typeof console !== 'undefined') console.error('[timeline] asm scan failed -> empty timeline', err);
  }

  function hide(e) {
    e.obj.visible = false;
    if (e.mats) applyFade(e, 0);
  }

  function finish(e) {
    const obj = e.obj;
    obj.visible = e.baseVisible;
    obj.position.copy(e.basePos);
    obj.scale.copy(e.baseScale);
    obj.quaternion.copy(e.baseQuat);
    if (e.mats) {
      for (let i = 0; i < e.mats.length; i++) {
        const r = e.mats[i];
        r.m.opacity = r.op;
        r.m.transparent = r.tr;
        if (r.u) r.u.value = r.uOp;
      }
    }
    e.state = ST_DONE;
  }

  function applyOne(e, t) {
    if (t >= e.end) {
      if (e.state !== ST_DONE) finish(e);
      return;
    }
    if (t <= e.start) {
      if (e.state !== ST_HIDDEN) { hide(e); e.state = ST_HIDDEN; }
      return;
    }
    e.state = ST_MID;
    const obj = e.obj;
    const bs = e.baseScale;
    obj.visible = e.baseVisible;
    const p = (t - e.start) / e.dur;

    if (e.mode === 'rise') {
      const A = e.h + RISE_CLEAR;
      let dy = -A * (1 - easeOutCubic(p));
      if (p > 0.8) dy += A * RISE_BOUNCE * Math.sin(Math.PI * (p - 0.8) / 0.2);
      obj.position.copy(e.basePos).addScaledVector(e.up, dy);
      obj.scale.copy(bs);
      obj.quaternion.copy(e.baseQuat);
      return;
    }
    if (e.mode === 'drop') {
      const A = e.h + DROP_CLEAR;
      let k = easeOutBack(p);
      if (k > 1) {
        // 过冲软限幅：最多沉到静止位以下 DROP_DIP，绝不吃进地面
        const dip = (k - 1) * A;
        k = 1 + (DROP_DIP * Math.tanh(dip / DROP_DIP)) / A;
      }
      obj.position.copy(e.basePos).addScaledVector(e.up, A * (1 - k));
      const w = (p - 0.8) / 0.2;
      const s = w > 0 && w < 1 ? Math.sin(Math.PI * w) : 0;
      const fy = 1 - DROP_SQUASH * s;
      const fxz = 1 + DROP_SQUASH * 0.5 * s;
      obj.scale.set(bs.x * fxz, bs.y * fy, bs.z * fxz);
      obj.quaternion.copy(e.baseQuat);
      return;
    }
    if (e.mode === 'pop') {
      obj.scale.copy(bs).multiplyScalar(backOutBounded(p, POP_BACK));
      obj.position.copy(e.basePos);
      obj.quaternion.copy(e.baseQuat);
      return;
    }
    if (e.mode === 'grow') {
      const k = easeOutCubic(p);
      obj.scale.set(bs.x, bs.y * k, bs.z);
      obj.position.copy(e.basePos).addScaledVector(e.grow, e.d0 * (1 - k));
      obj.quaternion.copy(e.baseQuat);
      return;
    }
    if (e.mode === 'wipe') {
      const k = easeOutCubic(p);
      obj.scale.copy(bs);
      obj.scale[e.axis] = bs[e.axis] * k;
      obj.position.copy(e.basePos).addScaledVector(e.wipe, e.d0 * (1 - k));
      obj.quaternion.copy(e.baseQuat);
      return;
    }
    // fade
    applyFade(e, easeOutCubic(p));
  }

  function applyAll(t) {
    if (broken) return;
    for (let i = 0; i < entries.length; i++) applyOne(entries[i], t);
  }

  function resetStates() {
    settled = false;
    for (let i = 0; i < entries.length; i++) entries[i].state = ST_NEW;
  }

  applyAll(0);   // 构造即进入 t=0 的隐藏状态，避免首帧闪整场

  return {
    update(dt) {
      if (broken || settled) return;
      const d = typeof dt === 'number' && isFinite(dt) ? dt : 0;
      if (d <= 0) return;
      time += d;
      // 吸收 dt 累积误差：落在 7s 上的那一帧必须精确收尾（否则最后一帧会差 1e-9）
      if (time >= DUR || DUR - time < 1e-6) time = DUR;
      applyAll(time);
      if (time >= DUR) settled = true;
    },
    seek(v) {
      const t = typeof v === 'number' && isFinite(v) ? v : 0;
      time = t < 0 ? 0 : t;
      resetStates();
      applyAll(time);
      if (time >= DUR) settled = true;
    },
    replay() {
      time = 0;
      resetStates();
      applyAll(0);
    },
    get progress() { return broken ? 1 : clamp01(time / DUR); },
    get done() { return broken ? true : time >= DUR; },
    get duration() { return DUR; },
    get count() { return entries.length; },
  };
}

export default createAssembly;
