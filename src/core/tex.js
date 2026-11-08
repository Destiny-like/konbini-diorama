import * as THREE from 'three';

const JP = '"Yu Gothic UI","Yu Gothic","Meiryo","MS Gothic","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
const cache = new Map();

function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c: c, g: c.getContext('2d') };
}

function finish(c, o) {
  const opt = o || {};
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opt.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  if (opt.repeat) t.repeat.set(opt.repeat[0], opt.repeat[1]);
  t.anisotropy = opt.aniso || 8;
  t.needsUpdate = true;
  return t;
}

function rand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function memo(key, make) {
  let t = cache.get(key);
  if (!t) { t = make(); cache.set(key, t); }
  return t;
}

function grain(g, w, h, n, alpha, size, seed, light) {
  const r = rand(seed);
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const v = Math.floor(r() * 90) + (light ? 120 : 30);
    g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 6) + ')';
    const s = size * (0.5 + r());
    g.fillRect(r() * w, r() * h, s, s);
  }
  g.globalAlpha = 1;
}

export const T = {
  canvas: cvs,
  finish: finish,
  rand: rand,
  JP: JP,

  asphalt() {
    return memo('asphalt', () => {
      const d = cvs(512, 512), g = d.g;
      g.fillStyle = '#33384a'; g.fillRect(0, 0, 512, 512);
      grain(g, 512, 512, 9000, 0.32, 2.2, 7, false);
      grain(g, 512, 512, 2600, 0.20, 3.4, 21, true);
      const r = rand(3);
      g.globalAlpha = 0.16; g.strokeStyle = '#20242f'; g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        let x = r() * 512, y = r() * 512;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; g.lineTo(x, y); }
        g.stroke();
      }
      g.globalAlpha = 1;
      return finish(d.c);
    });
  },

  pavement() {
    return memo('pavement', () => {
      const d = cvs(512, 512), g = d.g;
      g.fillStyle = '#6d7281'; g.fillRect(0, 0, 512, 512);
      const r = rand(11);
      const n = 4, s = 512 / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = 104 + Math.floor(r() * 26);
        g.fillStyle = 'rgb(' + v + ',' + (v + 4) + ',' + (v + 16) + ')';
        g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
      }
      grain(g, 512, 512, 5000, 0.22, 1.8, 5, false);
      g.strokeStyle = 'rgba(40,44,56,0.55)'; g.lineWidth = 2.5;
      for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(512, i * s); g.stroke(); }
      return finish(d.c);
    });
  },

  concrete() {
    return memo('concrete', () => {
      const d = cvs(256, 256), g = d.g;
      g.fillStyle = '#9a9dab'; g.fillRect(0, 0, 256, 256);
      grain(g, 256, 256, 3000, 0.20, 1.8, 31, false);
      grain(g, 256, 256, 900, 0.14, 3, 41, true);
      return finish(d.c);
    });
  },

  tileWall() {
    return memo('tileWall', () => {
      const d = cvs(256, 256), g = d.g;
      g.fillStyle = '#8e97a8'; g.fillRect(0, 0, 256, 256);
      const r = rand(17);
      const cw = 32, ch = 16;
      for (let y = 0; y < 256 / ch; y++) for (let x = 0; x < 256 / cw; x++) {
        const offset = (y % 2) * (cw / 2);
        const v = 158 + Math.floor(r() * 22);
        g.fillStyle = 'rgb(' + v + ',' + (v + 6) + ',' + (v + 16) + ')';
        g.fillRect(x * cw + offset + 1, y * ch + 1, cw - 2, ch - 2);
      }
      g.fillStyle = 'rgba(60,66,80,0.35)';
      for (let y = 0; y < 256; y += ch) g.fillRect(0, y, 256, 1.2);
      return finish(d.c);
    });
  },

  interiorFloor() {
    return memo('intFloor', () => {
      const d = cvs(512, 512), g = d.g;
      g.fillStyle = '#d9d5c9'; g.fillRect(0, 0, 512, 512);
      const r = rand(23);
      const n = 4, s = 512 / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = 208 + Math.floor(r() * 18);
        g.fillStyle = 'rgb(' + v + ',' + (v - 2) + ',' + (v - 14) + ')';
        g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
      g.strokeStyle = 'rgba(160,152,132,0.5)'; g.lineWidth = 2;
      for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(512, i * s); g.stroke(); }
      return finish(d.c);
    });
  },

  metal() {
    return memo('metal', () => {
      const d = cvs(128, 128), g = d.g;
      g.fillStyle = '#9aa2b1'; g.fillRect(0, 0, 128, 128);
      const r = rand(53);
      for (let i = 0; i < 220; i++) {
        const v = 130 + Math.floor(r() * 70);
        g.globalAlpha = 0.18;
        g.fillStyle = 'rgb(' + v + ',' + (v + 4) + ',' + (v + 12) + ')';
        g.fillRect(r() * 128, 0, 1, 128);
      }
      g.globalAlpha = 1;
      return finish(d.c);
    });
  },

  /** 主招牌带：白底 + 绿橙条纹 + 店名 */
  signBand(name, sub) {
    return memo('signBand' + name + (sub || ''), () => {
      const d = cvs(1024, 256), g = d.g;
      g.fillStyle = '#f4f7f2'; g.fillRect(0, 0, 1024, 256);
      g.fillStyle = '#2f9e6b'; g.fillRect(0, 0, 1024, 34);
      g.fillStyle = '#ef8a3c'; g.fillRect(0, 222, 1024, 34);
      g.fillStyle = '#2f9e6b'; g.beginPath(); g.arc(112, 124, 62, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f4f7f2'; g.font = '800 60px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ひ', 112, 118);
      g.fillStyle = '#1f7a51'; g.font = '900 96px ' + JP; g.textAlign = 'left';
      g.fillText(name, 200, 116);
      g.fillStyle = '#2f6fd0'; g.font = '700 44px ' + JP;
      g.fillText(sub || '24 HOURS', 208, 186);
      g.fillStyle = '#ef8a3c'; g.fillRect(800, 60, 190, 70);
      g.fillStyle = '#ffffff'; g.font = '800 40px ' + JP; g.textAlign = 'center';
      g.fillText('OPEN', 895, 96);
      return finish(d.c, { clamp: true });
    });
  },

  /** 转角立柱灯箱：竖排文字 */
  pylonSign(name) {
    return memo('pylon' + name, () => {
      const d = cvs(256, 1024), g = d.g;
      g.fillStyle = '#f7faf5'; g.fillRect(0, 0, 256, 1024);
      g.fillStyle = '#2f9e6b'; g.fillRect(0, 0, 256, 26); g.fillRect(0, 998, 256, 26);
      g.fillStyle = '#ef8a3c'; g.fillRect(0, 30, 256, 10);
      g.fillStyle = '#1f7a51'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const chars = name.split('');
      const step = 118;
      g.font = '900 104px ' + JP;
      for (let i = 0; i < chars.length; i++) g.fillText(chars[i], 128, 120 + i * step);
      g.fillStyle = '#2f6fd0'; g.font = '700 40px ' + JP;
      g.fillText('24H', 128, 960);
      return finish(d.c, { clamp: true });
    });
  },

  /** 便利店货架商品面（远看五颜六色的商品排面） */
  shelfProducts(seed) {
    return memo('shelfProd' + seed, () => {
      const d = cvs(512, 256), g = d.g;
      const r = rand(seed * 977 + 13);
      g.fillStyle = '#f0f2f5'; g.fillRect(0, 0, 512, 256);
      const cols = ['#d94f4f', '#3f6fbf', '#e8c35c', '#4da96b', '#dd7fa6', '#9c6b48', '#5aa9c9', '#e0803c', '#7a6fb8'];
      const rows = 3, rh = 256 / rows;
      for (let y = 0; y < rows; y++) {
        g.fillStyle = '#dfe3e8'; g.fillRect(0, y * rh + rh - 10, 512, 10);
        let x = 4;
        while (x < 508) {
          const w = 16 + r() * 26;
          const h = rh - 18 - r() * 12;
          g.fillStyle = cols[Math.floor(r() * cols.length)];
          g.fillRect(x, y * rh + (rh - 12 - h), w, h);
          g.fillStyle = 'rgba(255,255,255,0.85)';
          g.fillRect(x + 2, y * rh + (rh - 12 - h) + h * 0.28, w - 4, Math.max(2, h * 0.16));
          g.fillStyle = 'rgba(30,30,40,0.25)';
          g.fillRect(x + 2, y * rh + (rh - 12 - h) + h * 0.62, w - 4, Math.max(1.5, h * 0.08));
          x += w + 3 + r() * 4;
        }
      }
      return finish(d.c, { clamp: true });
    });
  },

  /** 冷柜饮料排面 */
  fridgeProducts(seed) {
    return memo('fridge' + seed, () => {
      const d = cvs(256, 512), g = d.g;
      const r = rand(seed * 331 + 7);
      g.fillStyle = '#eaf3fb'; g.fillRect(0, 0, 256, 512);
      const cols = ['#d94f4f', '#3f6fbf', '#e8c35c', '#4da96b', '#dd7fa6', '#5aa9c9', '#f0f0f0', '#e0803c'];
      const rows = 5, rh = 512 / rows;
      for (let y = 0; y < rows; y++) {
        g.fillStyle = 'rgba(150,175,200,0.55)'; g.fillRect(0, y * rh + rh - 6, 256, 6);
        for (let x = 6; x < 250; x += 20) {
          for (let k = 0; k < 2; k++) {
            g.fillStyle = cols[Math.floor(r() * cols.length)];
            g.fillRect(x + k * 10, y * rh + 8 + r() * 4, 9, rh - 26);
            g.fillStyle = 'rgba(255,255,255,0.8)';
            g.fillRect(x + k * 10, y * rh + 14, 9, 4);
          }
        }
      }
      return finish(d.c, { clamp: true });
    });
  },

  /** 杂志架封面排面 */
  magazines(seed) {
    return memo('magazine' + seed, () => {
      const d = cvs(512, 256), g = d.g;
      const r = rand(seed * 77 + 5);
      g.fillStyle = '#e7e2d6'; g.fillRect(0, 0, 512, 256);
      const cols = ['#d94f4f', '#3f6fbf', '#e8c35c', '#4da96b', '#dd7fa6', '#f4f4f4', '#5aa9c9'];
      for (let i = 0; i < 11; i++) {
        const x = 6 + i * 45, w = 38, h = 150 + r() * 40;
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        g.fillRect(x, 40 + (190 - h), w, h);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.fillRect(x + 4, 40 + (190 - h) + 10, w - 8, 12);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        for (let k = 0; k < 3; k++) g.fillRect(x + 4, 40 + (190 - h) + 34 + k * 12, w - 8, 5);
      }
      return finish(d.c, { clamp: true });
    });
  },

  /** 自动贩卖机正面 */
  vendingFace(accent) {
    return memo('vending' + accent, () => {
      const d = cvs(256, 512), g = d.g;
      g.fillStyle = '#' + ('000000' + accent.toString(16)).slice(-6); g.fillRect(0, 0, 256, 512);
      g.fillStyle = '#f2f6f7'; g.fillRect(14, 14, 228, 300);
      const r = rand(97);
      const cans = ['#d94f4f', '#3f6fbf', '#e8c35c', '#4da96b', '#dd7fa6', '#5aa9c9', '#f0d24a', '#e0803c'];
      for (let row = 0; row < 4; row++) {
        g.fillStyle = 'rgba(170,190,205,0.6)'; g.fillRect(18, 30 + row * 74, 220, 6);
        for (let i = 0; i < 7; i++) {
          g.fillStyle = cans[Math.floor(r() * cans.length)];
          g.fillRect(22 + i * 31, 34 + row * 74, 26, 56);
          g.fillStyle = 'rgba(255,255,255,0.85)';
          g.fillRect(24 + i * 31, 44 + row * 74, 22, 10);
          g.fillStyle = 'rgba(20,24,32,0.35)';
          g.fillRect(24 + i * 31, 78 + row * 74, 22, 6);
        }
      }
      g.fillStyle = '#c9d2da'; g.fillRect(14, 322, 228, 120);
      g.fillStyle = '#39424f'; g.fillRect(30, 336, 120, 26);
      g.fillStyle = '#7ee6a4'; g.font = '700 22px monospace'; g.fillText('¥ 130', 34, 356);
      for (let i = 0; i < 4; i++) { g.fillStyle = i < 2 ? '#4da96b' : '#d94f4f'; g.fillRect(170, 332 + i * 24, 16, 14); }
      g.fillStyle = '#222833'; g.fillRect(14, 452, 228, 46);
      g.fillStyle = '#8fa0b0'; g.fillRect(40, 462, 90, 26); g.fillRect(150, 462, 70, 26);
      return finish(d.c, { clamp: true });
    });
  },

  /** 海报：kind 0..5 */
  poster(kind) {
    return memo('poster' + kind, () => {
      const d = cvs(360, 512), g = d.g;
      const themes = [
        ['#f3e9d2', '#d94f4f', 'らーめん', '新発売'],
        ['#e8f1f8', '#2f6fd0', 'アイス', '夏限定'],
        ['#fdf0e4', '#e0803c', 'からあげ', '揚げたて'],
        ['#eef6ee', '#2f9e6b', 'おにぎり', '100円'],
        ['#f6ecf4', '#dd7fa6', 'スイーツ', 'TVで話題'],
        ['#eef0f6', '#5a6bb8', 'アニメ', '今週放映'],
      ];
      const th = themes[kind % themes.length];
      g.fillStyle = th[0]; g.fillRect(0, 0, 360, 512);
      g.fillStyle = th[1]; g.fillRect(0, 0, 360, 96);
      g.fillStyle = '#ffffff'; g.font = '900 58px ' + JP; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(th[2], 180, 52);
      g.fillStyle = th[1]; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(180, 250, 92, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.5; g.beginPath(); g.arc(180, 250, 64, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
      g.globalAlpha = 1; g.fillStyle = th[1]; g.font = '800 46px ' + JP;
      g.fillText(th[3], 180, 392);
      g.fillStyle = 'rgba(40,44,56,0.7)'; g.font = '600 22px ' + JP;
      g.fillText('ひだまりマート', 180, 452);
      g.fillStyle = 'rgba(40,44,56,0.35)';
      for (let i = 0; i < 3; i++) g.fillRect(50, 470 + i * 0, 0, 0);
      return finish(d.c, { clamp: true });
    });
  },

  /** 公告栏/海报栏 */
  noticeBoard() {
    return memo('notice', () => {
      const d = cvs(512, 384), g = d.g;
      g.fillStyle = '#c9b18d'; g.fillRect(0, 0, 512, 384);
      const r = rand(61);
      grain(g, 512, 384, 2400, 0.14, 2, 61, false);
      const cols = ['#f6f1e4', '#eaf3fb', '#f7e7ea', '#eef6ee', '#f3eddc'];
      for (let i = 0; i < 7; i++) {
        const w = 96 + r() * 58, h = 84 + r() * 74;
        const x = 16 + r() * (512 - w - 32), y = 16 + r() * (384 - h - 32);
        g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((r() - 0.5) * 0.16);
        g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);
        g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(-w / 2, -h / 2, w, h);
        g.fillStyle = 'rgba(60,66,80,0.55)';
        for (let k = 0; k < 5; k++) g.fillRect(-w / 2 + 8, -h / 2 + 12 + k * (h / 8), w - 16 - r() * 24, 5);
        g.fillStyle = '#d94f4f'; g.fillRect(-6, -h / 2 - 3, 12, 8);
        g.restore();
      }
      return finish(d.c, { clamp: true });
    });
  },

  /** 排水沟格栅（alpha） */
  grate() {
    return memo('grate', () => {
      const d = cvs(128, 128), g = d.g;
      g.fillStyle = '#5b6272'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#20242d';
      for (let i = 0; i < 8; i++) g.fillRect(8, 10 + i * 14, 112, 7);
      g.strokeStyle = '#7a828f'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 124);
      return finish(d.c, { clamp: true });
    });
  },

  manhole() {
    return memo('manhole', () => {
      const d = cvs(256, 256), g = d.g;
      g.fillStyle = '#3b4150'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#4a5060'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b303c'; g.lineWidth = 5;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.arc(128, 128, i * 24, 0, Math.PI * 2); g.stroke(); }
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        g.beginPath(); g.moveTo(128 + Math.cos(ang) * 30, 128 + Math.sin(ang) * 30);
        g.lineTo(128 + Math.cos(ang) * 116, 128 + Math.sin(ang) * 116); g.stroke();
      }
      return finish(d.c, { clamp: true });
    });
  },

  /** 径向柔光（灯晕/反光涂抹），带 alpha */
  glowSprite(inner, outer) {
    return memo('glowS' + inner + outer, () => {
      const d = cvs(128, 128), g = d.g;
      const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      grd.addColorStop(0, inner || 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.42, outer || 'rgba(255,255,255,0.28)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      return finish(d.c, { clamp: true });
    });
  },

  /** 积水涟漪（环形 alpha） */
  ripple() {
    return memo('ripple', () => {
      const d = cvs(128, 128), g = d.g;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = 0.5 - i * 0.14; g.lineWidth = 2.4 - i * 0.5;
        g.beginPath(); g.arc(64, 64, 18 + i * 17, 0, Math.PI * 2); g.stroke();
      }
      return finish(d.c, { clamp: true });
    });
  },

  /** 湿润地面的柔和高光涂抹（竖向拉长的光斑） */
  smear() {
    return memo('smear', () => {
      const d = cvs(64, 256), g = d.g;
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, 'rgba(255,255,255,0.0)');
      grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      grd.addColorStop(0.7, 'rgba(255,255,255,0.22)');
      grd.addColorStop(1, 'rgba(255,255,255,0.0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
      g.globalCompositeOperation = 'destination-in';
      const grd2 = g.createLinearGradient(0, 0, 64, 0);
      grd2.addColorStop(0, 'rgba(0,0,0,0)');
      grd2.addColorStop(0.5, 'rgba(0,0,0,0.85)');
      grd2.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd2; g.fillRect(0, 0, 64, 256);
      return finish(d.c, { clamp: true });
    });
  },

  /** 二层住宅窗（部分亮灯） */
  windowBand(count, seed) {
    return memo('winBand' + count + seed, () => {
      const w = 128 * count, d = cvs(w, 128), g = d.g;
      const r = rand(seed || 3);
      g.fillStyle = '#b9bcc4'; g.fillRect(0, 0, w, 128);
      for (let i = 0; i < count; i++) {
        const lit = r() > 0.42;
        g.fillStyle = lit ? '#ffe6b0' : '#2b3446';
        g.fillRect(i * 128 + 22, 22, 84, 84);
        g.strokeStyle = lit ? '#f0d9a8' : '#48546a'; g.lineWidth = 5;
        g.strokeRect(i * 128 + 22, 22, 84, 84);
        g.beginPath(); g.moveTo(i * 128 + 64, 22); g.lineTo(i * 128 + 64, 106); g.stroke();
      }
      return finish(d.c, { clamp: true });
    });
  },
};

export default T;