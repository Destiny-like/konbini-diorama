import * as THREE from 'three';

const TAU = Math.PI * 2;

function makeRand(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- shaders ----------

const SKY_VERT = [
  'varying vec3 vDir;',
  'void main() {',
  '  vDir = normalize(position);',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}',
].join('\n');

const SKY_FRAG = [
  'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow;',
  'varying vec3 vDir;',
  'void main() {',
  '  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);',
  '  vec3 c = mix(uLow, uMid, smoothstep(0.30, 0.56, h));',
  '  c = mix(c, uTop, smoothstep(0.56, 0.92, h));',
  '  c *= mix(0.82, 1.0, smoothstep(0.0, 0.40, h));',
  '  gl_FragColor = vec4(c, 1.0);',
  '}',
].join('\n');

// billboarded additive band (clouds): uses instanceMatrix translation + scale
const CLOUD_VERT = [
  'uniform float uTime;',
  'attribute vec2 aData;', // phase, driftAmp
  'varying vec2 vUv;',
  'varying float vA;',
  'void main() {',
  '  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
  '  float sx = length(instanceMatrix[0].xyz);',
  '  float sy = length(instanceMatrix[1].xyz);',
  '  c.x += sin(uTime * 0.018 + aData.x) * aData.y;',
  '  c.y += sin(uTime * 0.013 + aData.x * 1.7) * 0.6;',
  '  vec3 cv = (viewMatrix * vec4(c, 1.0)).xyz;',
  '  vec3 pv = cv + vec3(position.x * sx, position.y * sy, 0.0);',
  '  gl_Position = projectionMatrix * vec4(pv, 1.0);',
  '  vUv = uv;',
  '  vA = 0.72 + 0.28 * sin(uTime * 0.05 + aData.x);',
  '}',
].join('\n');

const CLOUD_FRAG = [
  'uniform vec3 uColor; uniform float uOpacity; uniform sampler2D uMap;',
  'varying vec2 vUv; varying float vA;',
  'void main() {',
  '  vec4 t = texture2D(uMap, vUv);',
  '  gl_FragColor = vec4(uColor, t.a * uOpacity * vA);',
  '}',
].join('\n');

const RAIN_VERT = [
  'uniform float uTime;',
  'uniform vec3 uWind;',
  'uniform float uSpan;',
  'uniform float uWidth;',
  'attribute vec4 aData;', // phase, speed, length, bright
  'varying float vA;',
  'void main() {',
  '  vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
  '  float fall = mod(aData.x * uSpan + uTime * aData.y, uSpan);',
  '  vec3 c = vec3(base.x + uWind.x * fall, base.y - fall, base.z + uWind.z * fall);',
  '  vec3 dirV = normalize(mat3(viewMatrix) * uWind);',
  '  vec3 perp = cross(dirV, vec3(0.0, 0.0, 1.0));',
  '  float pl = length(perp);',
  '  perp = pl > 0.001 ? perp / pl : vec3(1.0, 0.0, 0.0);',
  '  vec3 cv = (viewMatrix * vec4(c, 1.0)).xyz;',
  '  float dist = max(0.001, -cv.z);',
  '  vec3 pv = cv + dirV * (position.y * aData.z) + perp * (position.x * uWidth);',
  '  gl_Position = projectionMatrix * vec4(pv, 1.0);',
  '  float tail = smoothstep(-0.5, 0.5, position.y);',
  '  vA = aData.w * mix(0.10, 1.0, tail) * smoothstep(1.0, 7.0, dist);',
  '}',
].join('\n');

const RAIN_FRAG = [
  'uniform vec3 uColor; uniform float uOpacity;',
  'varying float vA;',
  'void main() { gl_FragColor = vec4(uColor, vA * uOpacity); }',
].join('\n');

const SPLASH_VERT = [
  'uniform float uTime;',
  'attribute vec2 aData;', // phase, size
  'varying float vA;',
  'void main() {',
  '  float cyc = fract(uTime * 1.55 + aData.x);',
  '  float s = aData.y * (0.16 + 0.84 * cyc);',
  '  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
  '  vec3 pw = c + vec3(position.x, 0.0, position.z) * s;',
  '  vec3 cv = (viewMatrix * vec4(pw, 1.0)).xyz;',
  '  gl_Position = projectionMatrix * vec4(cv, 1.0);',
  '  float f = 1.0 - cyc;',
  '  vA = f * f * smoothstep(0.0, 0.10, cyc) * smoothstep(1.0, 5.0, -cv.z);',
  '}',
].join('\n');

const SPLASH_FRAG = [
  'uniform vec3 uColor; uniform float uOpacity;',
  'varying float vA;',
  'void main() { gl_FragColor = vec4(uColor, vA * uOpacity); }',
].join('\n');

const RIPPLE_VERT = [
  'uniform float uTime;',
  'attribute vec2 aData;', // phase, size
  'varying vec2 vUv;',
  'varying float vA;',
  'void main() {',
  '  float cyc = fract(uTime * 0.42 + aData.x);',
  '  float s = aData.y * (0.22 + 0.78 * cyc);',
  '  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
  '  vec3 pw = c + vec3(position.x, 0.0, position.z) * s;',
  '  vec3 cv = (viewMatrix * vec4(pw, 1.0)).xyz;',
  '  gl_Position = projectionMatrix * vec4(cv, 1.0);',
  '  vUv = uv;',
  '  float f = 1.0 - cyc;',
  '  vA = f * f * smoothstep(0.0, 0.14, cyc);',
  '}',
].join('\n');

const RIPPLE_FRAG = [
  'uniform vec3 uColor; uniform float uOpacity; uniform sampler2D uMap;',
  'varying vec2 vUv; varying float vA;',
  'void main() {',
  '  float a = texture2D(uMap, vUv).a;',
  '  gl_FragColor = vec4(uColor, a * vA * uOpacity);',
  '}',
].join('\n');

const MIST_VERT = [
  'uniform float uTime;',
  'attribute vec2 aData;', // phase, drift amp
  'varying vec2 vUv;',
  'varying float vA;',
  'void main() {',
  '  vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
  '  float sx = length(instanceMatrix[0].xyz);',
  '  float sy = length(instanceMatrix[1].xyz);',
  '  float ph = aData.x;',
  '  c.x += sin(uTime * 0.13 + ph) * aData.y;',
  '  c.z += cos(uTime * 0.10 + ph * 1.3) * aData.y * 0.7;',
  '  c.y += sin(uTime * 0.16 + ph * 2.1) * 0.12;',
  '  vec3 cv = (viewMatrix * vec4(c, 1.0)).xyz;',
  '  vec3 pv = cv + vec3(position.x * sx, position.y * sy, 0.0);',
  '  gl_Position = projectionMatrix * vec4(pv, 1.0);',
  '  vUv = uv;',
  '  vA = 0.72 + 0.28 * sin(uTime * 0.24 + ph * 3.0);',
  '}',
].join('\n');

const MIST_FRAG = [
  'uniform vec3 uColor; uniform float uOpacity; uniform sampler2D uMap;',
  'varying vec2 vUv; varying float vA;',
  'void main() {',
  '  float a = texture2D(uMap, vUv).a;',
  '  gl_FragColor = vec4(uColor, a * uOpacity * vA);',
  '}',
].join('\n');

const DUST_VERT = [
  'uniform float uTime;',
  'uniform float uPix;',
  'uniform float uSize;',
  'attribute vec2 aData;', // phase, speed
  'varying float vA;',
  'void main() {',
  '  vec3 p = position;',
  '  float ph = aData.x;',
  '  p.x += sin(uTime * 0.16 + ph) * 0.34;',
  '  p.y += sin(uTime * 0.11 + ph * 1.9) * 0.26 + mod(uTime * aData.y, 0.6);',
  '  p.z += cos(uTime * 0.13 + ph * 1.4) * 0.30;',
  '  vec4 cv = viewMatrix * vec4(p, 1.0);',
  '  gl_Position = projectionMatrix * cv;',
  '  float d = max(0.001, -cv.z);',
  '  gl_PointSize = clamp(uSize * uPix / d, 1.2, 6.0);',
  '  vA = (0.55 + 0.45 * sin(uTime * 0.5 + ph * 2.0)) * smoothstep(60.0, 26.0, d);',
  '}',
].join('\n');

const DUST_FRAG = [
  'uniform vec3 uColor; uniform float uOpacity;',
  'varying float vA;',
  'void main() {',
  '  vec2 d = gl_PointCoord - vec2(0.5);',
  '  float a = smoothstep(0.5, 0.06, length(d));',
  '  gl_FragColor = vec4(uColor, a * vA * uOpacity);',
  '}',
].join('\n');

// ---------- module ----------

export function build(ctx) {
  const P = ctx.P;
  const T = ctx.T;
  const U = ctx.U;
  const group = new THREE.Group();
  // 室内/室外共用的天气效果层：setIndoor() 只切这一层的 visible
  const fxGroup = new THREE.Group();
  fxGroup.name = 'fx';
  group.add(fxGroup);
  const lights = new THREE.Group();
  const rnd = makeRand(91117);
  const animated = [];

  function track(mat) { animated.push(mat); return mat; }
  function mark(obj) { return U.mark(obj, { order: 0.88, mode: 'fade' }); }

  // ================= 1. lights =================
  lights.add(new THREE.HemisphereLight(P.lightCool, P.asphaltDark, 0.55));

  const key = new THREE.DirectionalLight(0xb9cdf0, 1.9);
  key.position.set(-16, 26, 12);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  const ks = key.shadow;
  ks.mapSize.set(2048, 2048);
  ks.camera.left = -18; ks.camera.right = 18; ks.camera.top = 18; ks.camera.bottom = -18;
  ks.camera.near = 1; ks.camera.far = 90;
  ks.camera.updateProjectionMatrix();
  ks.bias = -0.0006;
  ks.normalBias = 0.02;
  lights.add(key);
  lights.add(key.target);

  const fill = new THREE.DirectionalLight(0x7f8fbf, 0.5);
  fill.position.set(18, 12, -14);
  fill.target.position.set(0, 1, 0);
  fill.castShadow = false;
  lights.add(fill);
  lights.add(fill.target);

  const spill = new THREE.DirectionalLight(P.lightWarm, 0.45);
  spill.position.set(0, 4, 9);
  spill.target.position.set(0, 1.2, -1.0);
  spill.castShadow = false;
  lights.add(spill);
  lights.add(spill.target);

  lights.add(new THREE.AmbientLight(0x3a4a70, 0.35));

  // ================= 2. sky dome =================
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(P.skyTop) },
      uMid: { value: new THREE.Color(P.skyMid) },
      uLow: { value: new THREE.Color(P.skyLow) },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), skyMat);
  sky.name = 'skyDome';
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.castShadow = false;
  sky.receiveShadow = false;
  group.add(sky);

  // 云光带：远处低仰角，极淡
  const cloudTex = T.glowSprite('rgba(226,238,255,0.95)', 'rgba(180,205,240,0.30)');
  const cloudMat = track(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(P.lightCool).multiplyScalar(0.55) },
      uOpacity: { value: 0.085 },
      uMap: { value: cloudTex },
    },
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
  }));
  const cloudGeo = new THREE.PlaneGeometry(1, 1);
  const cloudDefs = [
    { a: 202, d: 74, y: 11.5, w: 46, h: 8.5, p: 0.0, amp: 3.2 },
    { a: 246, d: 66, y: 14.0, w: 38, h: 7.0, p: 2.1, amp: 2.4 },
    { a: 18, d: 70, y: 9.5, w: 40, h: 7.5, p: 4.3, amp: 2.8 },
  ];
  const cloudList = cloudDefs.map((c) => ({
    p: [Math.cos(c.a * Math.PI / 180) * c.d, c.y, Math.sin(c.a * Math.PI / 180) * c.d],
    s: [c.w, c.h, 1],
  }));
  const clouds = U.inst(cloudGeo, cloudMat, cloudList, { cast: false, recv: false });
  const cloudData = new Float32Array(cloudDefs.length * 2);
  for (let i = 0; i < cloudDefs.length; i++) {
    cloudData[i * 2] = cloudDefs[i].p;
    cloudData[i * 2 + 1] = cloudDefs[i].amp;
  }
  clouds.geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(cloudData, 2));
  clouds.frustumCulled = false;
  clouds.renderOrder = 0;
  group.add(clouds);

  // ================= 3. rain =================
  const RAIN_N = 2000;
  const RAIN_SPAN = 15.0;
  const rainGeo = new THREE.PlaneGeometry(1, 1);
  const rainList = [];
  const rainData = new Float32Array(RAIN_N * 4);
  for (let i = 0; i < RAIN_N; i++) {
    const a = rnd() * TAU;
    const r = 38 * Math.pow(rnd(), 0.62);
    rainList.push({ p: [Math.cos(a) * r, RAIN_SPAN, Math.sin(a) * r] });
    rainData[i * 4 + 0] = rnd();
    rainData[i * 4 + 1] = 12 + rnd() * 8;
    rainData[i * 4 + 2] = 0.35 + rnd() * 0.55;
    rainData[i * 4 + 3] = 0.55 + rnd() * 0.45;
  }
  const rainMat = track(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector3(0.142, -1.0, 0.045).normalize() },
      uSpan: { value: RAIN_SPAN },
      uWidth: { value: 0.024 },
      uColor: { value: new THREE.Color(P.lightCool) },
      uOpacity: { value: 0.42 },
    },
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  const rain = U.inst(rainGeo, rainMat, rainList, { cast: false, recv: false });
  rain.geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(rainData, 4));
  rain.frustumCulled = false;
  rain.renderOrder = 6;
  mark(rain);
  fxGroup.add(rain);

  // ================= 4. ground splash =================
  const SPL_N = 140;
  const splGeo = new THREE.RingGeometry(0.58, 1.0, 10, 1);
  splGeo.rotateX(-Math.PI / 2);
  const splList = [];
  const splData = new Float32Array(SPL_N * 2);
  let si = 0;
  function addSplash(x, y, z) {
    splList.push({ p: [x, y, z] });
    splData[si * 2] = rnd();
    splData[si * 2 + 1] = 0.085 + rnd() * 0.115;
    si++;
  }
  // 车行道（南街 / 东街 / 路口）
  for (let i = 0; i < 84; i++) {
    const k = rnd();
    if (k < 0.52) addSplash(-11.4 + rnd() * 22.8, 0.032, 6.3 + rnd() * 5.3);
    else if (k < 0.86) addSplash(6.3 + rnd() * 5.3, 0.032, -11.4 + rnd() * 22.8);
    else addSplash(-11.4 + rnd() * 22.8, 0.032, -11.4 + rnd() * 22.8);
  }
  // 人行道（南 / 东）
  for (let i = 0; i < SPL_N - 84; i++) {
    if (rnd() < 0.6) addSplash(-11.3 + rnd() * 17.0, 0.152, 3.7 + rnd() * 2.1);
    else addSplash(3.7 + rnd() * 2.1, 0.152, -11.3 + rnd() * 14.8);
  }
  const splMat = track(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(P.lightCool) },
      uOpacity: { value: 0.95 },
    },
    vertexShader: SPLASH_VERT,
    fragmentShader: SPLASH_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  const splash = U.inst(splGeo, splMat, splList, { cast: false, recv: false });
  splash.geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(splData, 2));
  splash.frustumCulled = false;
  splash.renderOrder = 3;
  mark(splash);
  fxGroup.add(splash);

  // ================= 5. puddle ripples =================
  const rippleSpots = [
    [-4.2, 0.036, 8.6, 1.15], [1.6, 0.036, 7.3, 0.95], [5.0, 0.036, 10.4, 1.25],
    [-8.6, 0.036, 9.5, 0.85], [9.0, 0.036, 8.2, 1.1], [8.4, 0.036, 0.6, 1.0],
    [9.7, 0.036, -4.3, 0.9], [7.2, 0.036, 3.1, 0.8], [10.6, 0.036, -8.4, 1.05],
    [-1.8, 0.036, 11.0, 0.75], [3.4, 0.036, 6.6, 0.7], [6.8, 0.036, 11.2, 0.95],
    [0.7, 0.156, 4.4, 0.75], [-2.4, 0.156, 4.9, 0.65], [2.4, 0.156, 5.2, 0.6],
    [-5.6, 0.156, 4.3, 0.7], [4.6, 0.156, 0.9, 0.68], [4.9, 0.156, -3.5, 0.72],
  ];
  const ripGeo = new THREE.PlaneGeometry(1, 1);
  ripGeo.rotateX(-Math.PI / 2);
  const ripList = rippleSpots.map((s) => ({ p: [s[0], s[1], s[2]] }));
  const ripData = new Float32Array(rippleSpots.length * 2);
  for (let i = 0; i < rippleSpots.length; i++) {
    ripData[i * 2] = i / rippleSpots.length + rnd() * 0.05;
    ripData[i * 2 + 1] = rippleSpots[i][3];
  }
  const ripMat = track(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(P.lightCool).multiplyScalar(0.85) },
      uOpacity: { value: 0.46 },
      uMap: { value: T.ripple() },
    },
    vertexShader: RIPPLE_VERT,
    fragmentShader: RIPPLE_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  const ripples = U.inst(ripGeo, ripMat, ripList, { cast: false, recv: false });
  ripples.geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(ripData, 2));
  ripples.frustumCulled = false;
  ripples.renderOrder = 4;
  mark(ripples);
  fxGroup.add(ripples);

  // ================= 6. steam / thin mist =================
  const mistTex = T.glowSprite('rgba(214,228,248,0.70)', 'rgba(150,178,220,0.22)');
  const mistDefs = [
    { x: -10.4, y: 0.80, z: 2.0, w: 3.4, h: 2.1, amp: 0.45 },
    { x: -2.4, y: 1.90, z: 4.35, w: 4.2, h: 1.6, amp: 0.30 },
    { x: -3.7, y: 0.42, z: 6.30, w: 2.6, h: 0.95, amp: 0.55 },
    { x: 4.95, y: 1.25, z: -2.1, w: 2.8, h: 1.9, amp: 0.35 },
    { x: -7.4, y: 0.50, z: 5.55, w: 2.6, h: 1.1, amp: 0.50 },
  ];
  const mistGeo = new THREE.PlaneGeometry(1, 1);
  const mistList = mistDefs.map((m) => ({ p: [m.x, m.y, m.z], s: [m.w, m.h, 1] }));
  const mistData = new Float32Array(mistDefs.length * 2);
  for (let i = 0; i < mistDefs.length; i++) {
    mistData[i * 2] = rnd() * TAU;
    mistData[i * 2 + 1] = mistDefs[i].amp;
  }
  const mistMat = track(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(P.lightCool).multiplyScalar(0.7) },
      uOpacity: { value: 0.10 },
      uMap: { value: mistTex },
    },
    vertexShader: MIST_VERT,
    fragmentShader: MIST_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  const mist = U.inst(mistGeo, mistMat, mistList, { cast: false, recv: false });
  mist.geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(mistData, 2));
  mist.frustumCulled = false;
  mist.renderOrder = 5;
  mark(mist);
  fxGroup.add(mist);

  // ================= 7. floating motes =================
  const DUST_N = 300;
  const dustPos = new Float32Array(DUST_N * 3);
  const dustData = new Float32Array(DUST_N * 2);
  for (let i = 0; i < DUST_N; i++) {
    const a = rnd() * TAU;
    const r = 13.5 * Math.pow(rnd(), 0.55);
    dustPos[i * 3 + 0] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = 0.5 + rnd() * 5.5;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
    dustData[i * 2] = rnd() * TAU;
    dustData[i * 2 + 1] = 0.02 + rnd() * 0.06;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aData', new THREE.BufferAttribute(dustData, 2));
  const dustMat = track(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPix: { value: 1200 },
      uSize: { value: 0.05 },
      uColor: { value: new THREE.Color(P.lightCool).multiplyScalar(0.8) },
      uOpacity: { value: 0.30 },
    },
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 7;
  mark(dust);
  fxGroup.add(dust);

  // ================= update =================
  let indoor = false;
  return {
    group: group,
    lights: lights,
    /** 进店参观：只切天气效果层的 visible（雨/溅射/涟漪/雾/微粒），不销毁对象、不改材质与几何、不动灯光组；幂等 */
    setIndoor(flag) {
      indoor = flag === true;
      fxGroup.visible = !indoor;
    },
    get indoor() { return indoor; },
    update(dt, t) {
      const tt = t || 0;
      for (let i = 0; i < animated.length; i++) animated[i].uniforms.uTime.value = tt;
    },
  };
}
