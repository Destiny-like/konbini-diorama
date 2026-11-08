# 雨夜便利店微缩模型 · 实现契约 v1

## 0. 目标
三渲二（cel/toon）日式动画风格的**雨夜便利店街角微缩模型**。第三视角俯瞰一座正方形底座上的小场景，可拖拽旋转/滚轮缩放，**无任何 UI 元素**。
交付物：单文件 `dist/index.html`（esbuild IIFE 内联 three.js）。**禁止**任何网络请求、外部图片、字体文件、CDN；所有贴图运行时用 canvas 程序化生成。

## 1. 坐标系（1 unit = 1 米，y=0 为地面顶面）
底座（plinth）：x∈[-12,12], z∈[-12,12]，顶面 y=0，侧壁下探至 y=-1.0。

区域划分（互不重叠，务必遵守，避免穿模）：
- 南侧车行道 road-south：z∈[6.0,12.0], x∈[-12,12]
- 东侧车行道 road-east：x∈[6.0,12.0], z∈[-12,12]
- 路口 intersection：x∈[6,12] 且 z∈[6,12]
- 南侧人行道 sidewalk-south：z∈[3.5,6.0], x∈[-12,6.0]，顶面 y=+0.14（路缘石 0.14 高）
- 东侧人行道 sidewalk-east：x∈[3.5,6.0], z∈[-12,3.5]，顶面 y=+0.14
- **便利店地块 store lot**：x∈[-9.0,3.5], z∈[-9.0,3.5]。建筑外墙正面贴 z=3.5（面向南街），东侧外墙贴 x=3.5（面向东街）。
- **小巷 alley**：x∈[-12,-9.0], z∈[-9.0,3.5]，地面 y≈0.06，自南向被屋体夹在左侧，通向南街。
- 便利店一层层高 3.4（室内地面 y=+0.15，吊顶 y=+3.05）；上部二层 y∈[3.6,6.3]，含女儿墙/招牌带。
- 街角交叉口一侧（x∈[3.5,6], z∈[3.5,6]）是人行道转角，可放路灯/电线杆/护栏（见 §3 归属）。

## 2. ctx（每个 world 模块收到的唯一上下文）
```js
build(ctx)   // ctx = { THREE, P, M, T, U }
// THREE = three 命名空间（模块内请直接 import * as THREE from 'three'，两者等价）
// P = 调色板（见 core/palette.js，全部为 0xRRGGBB number）
// M = 材质工厂（core/mats.js）
// T = 程序化贴图工厂（core/tex.js）
// U = 几何/组织工具（core/utils.js）
```

## 3. 文件归属（只准改自己名下的文件，否则集成会冲突）
| 文件 | 归属 | 内容 |
| --- | --- | --- |
| `src/world/street.js` | Worker A | 底座 plinth、车行道/路口沥青、车道线、斑马线、停止线、人行道砖、路缘石、排水沟+格栅、井盖、停车位划线+挡车器、积水坑与湿地面反光贴片、小巷地面+排水、底座侧面细节、边缘杂草/泥土 |
| `src/world/store.js` | Worker B | 便利店建筑外壳（墙、柱、女儿墙、二层外立面+窗+瓷砖带）、玻璃幕墙+竖梃、自动门+门框+感应器+地垫、雨棚/屋檐+檐下灯、主招牌带+转角立柱灯箱+副招牌、**店内全部陈设**（地面砖、吊顶灯带、货架排、冷柜、杂志架、收银台+收银机+热食柜+咖啡机、后墙货架、海报、价格签、空调出风口、店内灯光组） |
| `src/world/props.js` | Worker C | 自动贩卖机（2 台）、自行车（带车筐/脚撑）、雨伞架+雨伞、垃圾分类桶（3 个）、街角护栏、路灯（2 盏）、电线杆（2 根）+电线（悬链线）+变压器、路牌（街名/禁止停车）、公告栏/海报栏、空调外机（3 台）、排水立管、周转箱、盆栽、交通锥、湿纸箱 |
| `src/world/atmosphere.js` | Worker C | 天空穹顶/渐变背景、雾、月光主光+补光（含阴影配置）、雨丝、地面溅射、积水涟漪、蒸汽/薄雾、漂浮微粒 |
| `src/world/timeline.js` | Worker D | 入场组装时间线（扫描 `userData.asm`）、相机入场曲线采样 |
| `src/main.js`, `src/core/*`, `build.mjs` | 集成方（调度） | 渲染器/相机/控制器/后处理/主循环/打包 |

## 4. 模块导出契约
```js
// street.js / store.js / props.js
export function build(ctx) {
  const group = new THREE.Group();
  ...
  return { group, update?(dt, t), lights?(THREE.Object3D) };
}
// atmosphere.js
export function build(ctx) { return { group, lights, update(dt, t, camera?) }; }
// timeline.js
export function createAssembly({ scene, world }) {
  return { update(dt), seek(t), replay(), get progress(), get done() };
}
// 相机入场由 main.js 自己负责（worker D 不要写相机代码）
```

## 5. 入场动画标注规范（timeline 依据）
每个「装配单元」（通常是一个 Group 或整块 Mesh）用 `U.mark(obj, asm)` 打标：
```js
U.mark(obj, { order: 0.35, mode: 'drop' })
// order: 0..1，在总时间线上的相对落位（0=最先，1=最后）
// mode:
//   'rise' 从地面下 -高度 升起（地面/墙基/路面）
//   'drop' 从上方落下 + 轻微回弹（道具、招牌、上层构件）
//   'pop'  缩放 0→1.06→1（店内陈设、小物件）
//   'grow' 仅 Y 轴 0→1 生长（墙体、灯杆、柱子）
//   'wipe' 沿 X 或 Z 从 0 展开（长条物：护栏、电线、车道线）。用 axis: 'x'|'z' 指定
//   'fade' 透明度 0→1（玻璃、发光片、雨幕；需自身独占材质）
```
约定：`order` 建议带层次感——底座/地面 0.00–0.15，路面标线与沟 0.10–0.25，墙体外壳 0.20–0.40，店内陈设 0.35–0.55，招牌/檐口 0.45–0.65，街景道具 0.55–0.85，电线/雨/霓虹 0.75–1.00。
**不要**在 asm 对象内部再嵌套 asm（timeline 只处理最外层标记）。

## 6. 三渲二风格红线
- 大面用 `M.cel(hex)`（MeshToonMaterial + 3 阶梯度贴图）；玻璃 `M.glass()`；**发光体**（灯箱、招牌字、店内脏光、贩卖机面板、路灯灯泡）用 `M.lit(hex, boost)`（MeshBasicMaterial，颜色可 >1 以吃 bloom）。
- 店内陈设用 `M.interior(hex)`（toon + 自发光，模拟被灯光照亮），保证隔着玻璃看依然明亮清楚。
- 剪影描边：只给主要形体（建筑外轮廓、贩卖机、自行车、路灯、招牌、树/大件）加 `M.outline(mesh, 0.03)`；小碎件不加。
- 颜色柔和低饱和为主，霓虹（招牌/贩卖机/路灯）局部高饱和。禁止纯黑纯白大面积。
- 禁止 transmission / physical 玻璃、禁止实时反射（Reflector）、禁止每帧新建材质或几何体。

## 7. 性能红线
总 draw call < 700；三角面 < 600k；同材质小物件（瓷砖线、货架商品、雨滴、砖块）必须用 `U.inst`（InstancedMesh）或 `U.merge` 合并。单模块 draw call 预算：street 150 / store 260 / props 180 / atmosphere 20。

## 8. 可验收质量（默认机位下必须成立）
1. 底座是一个完整正方形，四边都有可见厚度与侧壁，像可收藏的模型。
2. 便利店位于画面视觉中心（略偏左），能同时看到**南立面（正面玻璃+自动门）和东立面（侧窗）**。
3. 透过大玻璃能清楚看到店内：货架排、冷柜、收银台、暖光吊顶，至少 3 层可辨识陈设。
4. 有明确的街角转折：两条街 + 转角人行道 + 斑马线 + 排水沟。
5. 雨夜氛围：可见雨丝、地面积水反光、招牌光晕、夜晚冷蓝环境 + 店内暖黄对比。
6. 画面中没有任何 HTML UI（无按钮、无文字覆盖层、无 loading 文案）。
7. 无人物。

## 9. 禁止事项
人物、动物拟人、外部资源、贴图文件、UI 覆盖层、`document.body` 内除 canvas 外的一切可见元素（调试期可写 console）。
