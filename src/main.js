/* =========================================================
   main.js — 渲染器 / 三渲二后处理（描边+泛光）/ 湿地面平面反射 / 动效循环
   ========================================================= */
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

import { buildBase, buildStreets, buildPuddles, LAYOUT, PUDDLE_SPOTS } from './base.js';
import { buildStore } from './store.js';
import {
  buildVendingMachine, buildBicycle, buildStreetLamp, buildUtilityPole,
  buildPowerLines, buildStreetSign, buildGuardrail, buildNoticeBoard,
  buildAlley, buildTrafficLight, buildLitter,
} from './props.js';
import {
  buildRain, buildSplash, buildDrips, updateDrips, buildRipples, updateRipples,
  buildGlassRain, updateGlassRain, makeFlicker, buildBackdropRain, updateBackdropRain,
} from './effects.js';
import { buildSky, buildCityGlow, buildHorizonHaze } from './atmos.js';
import { batchStatic } from './batch.js';
import { toon, glowMat, box, canvasTex, JP_FONT } from './core.js';

const QS = new URLSearchParams(location.search);
const qf = (k, d) => (QS.has(k) ? parseFloat(QS.get(k)) : d);
const DEBUG_REFL = QS.has('refl');

/* =========================================================
   0. 渲染器 / 场景 / 相机
   ========================================================= */
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a2a44, 0.0125);

const camera = new THREE.PerspectiveCamera(qf('fov', 41), window.innerWidth / window.innerHeight, 0.5, 220);
const CAM_START = new THREE.Vector3(qf('cx', -11.0), qf('cy', 12.6), qf('cz', 15.6));
const CAM_TARGET = new THREE.Vector3(qf('tx', 0.70), qf('ty', -0.50), qf('tz', 0.20));
camera.position.copy(CAM_START);
camera.lookAt(CAM_TARGET);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(CAM_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.72;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.6;
controls.minDistance = 10.0;
controls.maxDistance = 70;
controls.minPolarAngle = 0.10;
controls.maxPolarAngle = Math.PI * 0.478;
controls.screenSpacePanning = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.30;
controls.update();

let userTouched = false;
const stopAuto = () => { if (!userTouched) { userTouched = true; controls.autoRotate = false; } };
canvas.addEventListener('pointerdown', stopAuto, { passive: true });
canvas.addEventListener('wheel', stopAuto, { passive: true });
canvas.addEventListener('touchstart', stopAuto, { passive: true });
document.body.addEventListener('pointerdown', () => document.body.classList.add('dragging'));
document.body.addEventListener('pointerup', () => document.body.classList.remove('dragging'));

/* =========================================================
   1. 灯光
   ========================================================= */
scene.add(new THREE.HemisphereLight(0x7ba0d4, 0x3a4453, 2.6));
const moon = new THREE.DirectionalLight(0xc2d6f6, 1.85);
moon.position.set(10, 18, 12);
scene.add(moon);
const fill = new THREE.DirectionalLight(0x4d709c, 0.85);
fill.position.set(-14, 8, -8);
scene.add(fill);
const rim = new THREE.DirectionalLight(0x86aee8, 1.10);
rim.position.set(-10, 7, 16);
scene.add(rim);
scene.add(new THREE.AmbientLight(0x41506e, 3.1));

/* =========================================================
   2. 场景搭建
   ========================================================= */
const world = new THREE.Group();
scene.add(world);

const sky = buildSky(scene);
const cityGlow = buildCityGlow(scene, { radius: 33, count: 44 });
buildHorizonHaze(scene);

buildBase(world);
buildStreets(world);
buildPuddles(world);

/* ---------- 便利店（局部坐标系整体平移到布局位置） ---------- */
const { group: storeGroup, G: SG } = buildStore(world);
storeGroup.position.set(-2.2, 0, 0.8);

/* ---------- 自动贩卖机 ---------- */
buildVendingMachine(world, 6.15, 0.16, 2.60, 0, 0);
buildVendingMachine(world, 7.32, 0.16, 2.60, 0, 1);
buildVendingMachine(world, -4.72, 0.16, -3.1, Math.PI / 2, 1);

/* ---------- 自行车 ---------- */
buildBicycle(world, 8.9, 0.16, 2.05, -0.42, 0x2f5f8a);
buildBicycle(world, 3.35, 0.16, 2.55, 1.62, 0x8a4a3a);
buildBicycle(world, -4.3, 0.16, -6.4, 0.18, 0x3f7b6a);

/* ---------- 路灯 ---------- */
buildStreetLamp(world, -3.95, 2.62, Math.PI, 4.4);
buildStreetLamp(world, 9.45, 2.62, 0, 4.4);
buildStreetLamp(world, -8.15, 9.05, -Math.PI / 2, 4.2);

/* ---------- 电线杆 + 电线 ---------- */
const P1 = { x: -4.05, z: 9.05, h: 6.3 };
const P2 = { x: 9.55, z: 9.1, h: 6.1 };
const P3 = { x: -4.1, z: -0.05, h: 6.5 };
buildUtilityPole(world, P1.x, P1.z, P1.h);
buildUtilityPole(world, P2.x, P2.z, P2.h);
buildUtilityPole(world, P3.x, P3.z, P3.h);

buildPowerLines(world, [
  { ...P1, spans: [{ to: [P3.x, P3.h, P3.z], sag: 1.05 }, { to: [P2.x, P2.h, P2.z], sag: 0.85 }] },
  { ...P3, spans: [{ to: [P1.x - 0.1, P1.h - 0.5, -9.6], sag: 0.7 }] },
]);
buildPowerLines(world, [
  { x: P1.x, z: P1.z, h: P1.h - 0.72, spans: [{ to: [P2.x, P2.h - 0.7, P2.z], sag: 1.55 }] },
  { x: P1.x, z: P1.z, h: P1.h - 1.05, spans: [{ to: [P2.x, P2.h - 1.05, P2.z], sag: 1.75 }] },
  { x: P3.x, z: P3.z, h: P3.h - 0.7, spans: [{ to: [P1.x - 0.1, P1.h - 0.7, -9.6], sag: 0.55 }] },
]);

/* ---------- 街角家具 ---------- */
buildStreetSign(world, -3.9, 3.02);
buildGuardrail(world, -4.55, -1.4, 3.28);
buildGuardrail(world, -0.3, 2.6, 3.28);
buildNoticeBoard(world, -4.55, -1.5, Math.PI / 2);
buildAlley(world, -6.7, -2.0, -9.2, 2.6);
buildLitter(world, 2.0, 6.0);
buildLitter(world, -6.9, 2.6);

const traffic = buildTrafficLight(world, 9.9, 8.9, Math.PI * 0.96);

/* ---------- 远景建筑 ---------- */
const alleyWallMat = toon(0x2a3240, { steps: [0.34, 0.6, 0.86, 1.0] });
box(world, 0.24, 3.6, 7.4, alleyWallMat, -8.05, 1.8, -5.4);
const bgMat = toon(0x1e2836, { steps: [0.32, 0.58, 0.82, 1.0] });
box(world, 3.2, 5.4, 3.0, bgMat, 9.4, 2.7, -8.6);
box(world, 2.6, 4.2, 2.8, bgMat, -8.6, 2.1, -9.2);
box(world, 3.6, 3.2, 2.0, bgMat, 9.8, 1.6, 0.4);

/* =========================================================
   3. 湿地面反射（按地面高度分层，避免被铺装遮挡）
   ========================================================= */
const REFL_SCALE = 0.4;
let rtReflect, reflectCam, wetLayerMat;

function initReflection() {
  const pr = renderer.getPixelRatio();
  const w = Math.max(2, Math.floor(window.innerWidth * pr * REFL_SCALE));
  const h = Math.max(2, Math.floor(window.innerHeight * pr * REFL_SCALE));
  rtReflect = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
    colorSpace: THREE.NoColorSpace,
  });
  reflectCam = new THREE.PerspectiveCamera();
}
initReflection();

/* --- 湿度遮罩（俯视平面图，世界坐标映射） --- */
const WET_SIZE = 1024;
const wetNoiseTex = canvasTex(WET_SIZE, WET_SIZE, (ctx, W, H) => {
  const B = LAYOUT.base;
  const toPx = (wx, wz) => [((wx + B / 2) / B) * W, ((wz + B / 2) / B) * H];
  const scale = W / B;

  ctx.fillStyle = 'rgb(70,70,70)';
  ctx.fillRect(0, 0, W, H);

  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const sm = (t) => t * t * (3 - 2 * t);
  const bil = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + e * xf) * yf;
  };
  const fbm = (x, y) => {
    let v = 0, amp = 0.5, f = 1;
    for (let o = 0; o < 5; o++) { v += bil(x * f, y * f) * amp; amp *= 0.5; f *= 2.07; }
    return v;
  };

  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const n = fbm(px / 90, py / 90);
      const v = 0.36 + n * 0.42;
      const i = (py * W + px) * 4;
      const g = Math.max(0, Math.min(255, v * 255));
      d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 积水：大面积柔和湿区（不做硬边椭圆，避免反射被裁成白斑）
  ctx.save();
  ctx.filter = 'blur(26px)';
  for (const [x, z, w, dd, seed] of PUDDLE_SPOTS) {
    const [cx, cy] = toPx(x, z);
    const rx = (w / 2) * scale * 2.4;
    const ry = (dd / 2) * scale * 2.4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((seed % 7) * 0.42) + (seed % 5) * 0.31);
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    grd.addColorStop(0.00, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.35, 'rgba(240,240,240,0.80)');
    grd.addColorStop(0.68, 'rgba(190,190,190,0.42)');
    grd.addColorStop(1.00, 'rgba(140,140,140,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 沿路缘 / 排水沟的线性积水
  ctx.save();
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = 'rgba(240,240,240,0.72)';
  for (const [x0, x1, zc, th] of [[-4.6, 10, 3.34, 0.14], [-10, 10, 8.30, 0.11], [-4.85, -4.6, 0, 0.18]]) {
    const [ax, ay] = toPx(x0, zc);
    const [bx] = toPx(x1, zc);
    ctx.fillRect(ax, ay - th * scale / 2, bx - ax, th * scale);
  }
  ctx.restore();

  // 店前雨棚滴水冲刷区
  const [sx0, sz0] = toPx(LAYOUT.store.x[0] - 0.3, LAYOUT.store.z[1]);
  const [sx1, sz1] = toPx(LAYOUT.store.x[1] + 0.3, LAYOUT.store.z[1] + 1.5);
  const shed = ctx.createLinearGradient(0, sz0, 0, sz1);
  shed.addColorStop(0, 'rgba(230,230,230,0.88)');
  shed.addColorStop(1, 'rgba(120,120,120,0)');
  ctx.fillStyle = shed;
  ctx.save(); ctx.filter = 'blur(11px)';
  ctx.fillRect(sx0, sz0, sx1 - sx0, sz1 - sz0);
  ctx.restore();
});
wetNoiseTex.wrapS = wetNoiseTex.wrapT = THREE.ClampToEdgeWrapping;
wetNoiseTex.minFilter = THREE.LinearFilter;
wetNoiseTex.magFilter = THREE.LinearFilter;

/* --- 湿地面着色器 --- */
wetLayerMat = new THREE.ShaderMaterial({
  uniforms: {
    tReflect: { value: null },
    tWet: { value: wetNoiseTex },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uStrength: { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    varying vec4 vScreen;
    varying vec3 vWorld;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 clip = projectionMatrix * viewMatrix * wp;
      vScreen = clip;
      gl_Position = clip;
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tReflect;
    uniform sampler2D tWet;
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uStrength;
    varying vec2 vUv;
    varying vec4 vScreen;
    varying vec3 vWorld;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
      vec2 suv = (vScreen.xy / vScreen.w) * 0.5 + 0.5;

      float wetRaw = texture2D(tWet, vUv).r;
      float wet = smoothstep(0.30, 0.72, wetRaw);
      float puddle = smoothstep(0.52, 0.92, wetRaw) * 0.85;

      // 涟漪扰动
      vec2 p = vUv * 30.0;
      float t = uTime;
      vec2 dist = vec2(
        sin(p.y * 3.1 + t * 2.0) * 0.5 + sin(p.x * 7.3 - t * 1.3) * 0.5,
        cos(p.x * 2.7 - t * 1.7) * 0.5 + cos(p.y * 6.1 + t * 1.1) * 0.5
      );
      float dn = hash(floor(p * 1.2));
      vec2 droplet = vec2(hash(floor(p * 1.2) + 3.0), hash(floor(p * 1.2) + 7.0)) - 0.5;
      dist += droplet * 0.55 * step(0.74, dn) * (0.5 + 0.5 * sin(t * 6.0 + dn * 30.0));

      vec2 offs = dist * 0.0022 * (0.30 + wet) * uStrength;
      vec2 sOffs = suv + offs;

      // 竖向多重采样：湿地灯光被拉成光柱拖影
      float stretchPx = (2.2 + 7.5 * puddle) / uRes.y;
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int i = -5; i <= 5; i++) {
        float fi = float(i);
        float w = exp(-fi * fi / 16.0);
        acc += texture2D(tReflect, clamp(sOffs + vec2(0.0, fi * stretchPx), 0.001, 0.999)).rgb * w;
        wsum += w;
      }
      vec3 refl = acc / wsum;

      // 掠射角菲涅尔
      vec3 viewDir = normalize(cameraPosition - vWorld);
      float ny = clamp(viewDir.y, 0.0, 1.0);
      float fres = pow(1.0 - ny, 1.9);

      float k = wet * (0.22 + 0.44 * fres) + puddle * (0.34 + 0.62 * fres);
      k *= uStrength;

      // 软压缩，避免过曝
      vec3 col = refl;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = col / (1.0 + lum * 0.55);
      col *= vec3(0.84, 0.94, 1.18);

      gl_FragColor = vec4(col * k, 1.0);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});

const WET_HEIGHTS = [0.014, 0.104, 0.154];  // 沥青 / 地块 / 人行道
const wetMeshes = WET_HEIGHTS.map((y, i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(LAYOUT.base, LAYOUT.base), wetLayerMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = 4 + i;
  m.frustumCulled = false;
  m.name = `wet${i}`;
  world.add(m);
  return m;
});

/* 反射时隐藏的对象 */
let hideInReflection = [];

/* =========================================================
   4. 动效对象
   ========================================================= */
const rain = buildRain(scene, { count: 5200, area: 30, height: 12, speed: 17, wind: 0.95, length: 0.46 });
const splash = buildSplash(scene, 340, 28);
const backdropRain = buildBackdropRain(world, { w: 46, h: 16, z: -16.0, opacity: 0.10 });

const SX0 = LAYOUT.store.x[0], SX1 = LAYOUT.store.x[1], SZ1 = LAYOUT.store.z[1];
const dripPoints = [];
for (let x = SX0 + 0.3; x <= SX1 - 0.2; x += 0.78) {
  dripPoints.push(new THREE.Vector3(x, 3.30, SZ1 + 0.64));
}
dripPoints.push(new THREE.Vector3(6.15, 1.94, 2.98));
dripPoints.push(new THREE.Vector3(7.32, 1.94, 2.98));
const drips = buildDrips(world, dripPoints, { perPoint: 3 });

const ripples = buildRipples(scene, [
  { x: 1.2, z: 3.6, n: 4, spread: 0.9, max: 0.55 },
  { x: 4.8, z: 3.55, n: 3, spread: 0.6, max: 0.42 },
  { x: -6.6, z: 4.6, n: 4, spread: 1.2, max: 0.70 },
  { x: -6.4, z: 0.6, n: 3, spread: 0.9, max: 0.60 },
  { x: 2.4, z: 6.8, n: 4, spread: 1.3, max: 0.70 },
  { x: -1.2, z: 7.2, n: 3, spread: 1.0, max: 0.55 },
  { x: -7.8, z: 7.2, n: 2, spread: 0.7, max: 0.50 },
  { x: 7.0, z: 6.2, n: 2, spread: 0.6, max: 0.45 },
  { x: -9.6, z: -6.0, n: 2, spread: 0.6, max: 0.45 },
]);

const glassRain = buildGlassRain(world, {
  w: 7.5, h: 2.56, x: 1.10, y: 1.56, z: SZ1 + 0.010,
});

const flickerSign = makeFlicker(1.0, { amp: 0.13, speed: 1.0, dropout: 0.06 });

/* 天空穹顶与远景雨幕不参与反射：否则积水会反射出亮天空，变成白斑 */
hideInReflection = [
  ...wetMeshes, rain.mesh, splash.mesh, ripples.group, backdropRain.mesh, sky.mesh,
];

/* =========================================================
   4.5 静态几何合批 —— 把 900+ 个独立 Mesh 压成几十个
       必须放在所有动画对象创建之后：这些对象要显式排除
   ========================================================= */
const protectFromBatch = [
  ...(SG.doorL ? [SG.doorL, SG.doorR] : []),   // 自动门双扇
  SG.sign,                                     // 招牌灯箱面（逐帧改色）
  ...SG.ceilingLights,                         // 店内点光（呼吸）
  traffic.group,                               // 信号灯（逐帧改色）
  ...traffic.lamps.map(l => l.mesh),           // 三颗灯球
  cityGlow,                                    // 远景窗光贴片
];
const batchInfo = batchStatic(world, { verbose: true, exclude: protectFromBatch });
console.log('[batch] draw-call reduction:', batchInfo);

/* =========================================================
   5. 后处理：法线/深度描边 + 泛光 + 调色
   ========================================================= */
let rtScene, rtNormal, rtBright1, rtBright2, rtBloom1, rtBloom2;

const normalMat = new THREE.ShaderMaterial({
  uniforms: {},
  vertexShader: /* glsl */`
    varying vec3 vN;
    varying float vD;
    void main(){
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vD = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */`
    varying vec3 vN;
    varying float vD;
    void main(){
      gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, vD);
    }
  `,
  side: THREE.DoubleSide,
});

const quadGeo = new THREE.PlaneGeometry(2, 2);
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadScene = new THREE.Scene();
const quadMesh = new THREE.Mesh(quadGeo, null);
quadScene.add(quadMesh);
function blit(mat, target, clear = true) {
  quadMesh.material = mat;
  renderer.setRenderTarget(target);
  if (clear) renderer.clear(true, false, false);
  renderer.render(quadScene, orthoCam);
}

const brightMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.80 }, uKnee: { value: 0.34 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uThreshold, uKnee;
    varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = max(max(c.r, c.g), c.b);
      float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
      soft = soft * soft / (4.0 * uKnee + 1e-4);
      float w = max(soft, l - uThreshold) / max(l, 1e-4);
      gl_FragColor = vec4(c * w, 1.0);
    }
  `,
});

const blurMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uDir, uRes;
    varying vec2 vUv;
    void main(){
      vec2 px = uDir / uRes;
      vec3 sum = vec3(0.0);
      sum += texture2D(tDiffuse, vUv - px * 4.0).rgb * 0.051;
      sum += texture2D(tDiffuse, vUv - px * 3.0).rgb * 0.0918;
      sum += texture2D(tDiffuse, vUv - px * 2.0).rgb * 0.12245;
      sum += texture2D(tDiffuse, vUv - px * 1.0).rgb * 0.1531;
      sum += texture2D(tDiffuse, vUv).rgb           * 0.1633;
      sum += texture2D(tDiffuse, vUv + px * 1.0).rgb * 0.1531;
      sum += texture2D(tDiffuse, vUv + px * 2.0).rgb * 0.12245;
      sum += texture2D(tDiffuse, vUv + px * 3.0).rgb * 0.0918;
      sum += texture2D(tDiffuse, vUv + px * 4.0).rgb * 0.051;
      gl_FragColor = vec4(sum, 1.0);
    }
  `,
});

const compositeMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tBloom: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBloomStrength: { value: 0.74 },
    uLineStrength: { value: 1.0 },
    uLineColor: { value: new THREE.Color(0x090d15) },
    uTime: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tNormal, tBloom;
    uniform vec2 uRes;
    uniform float uBloomStrength, uLineStrength, uTime;
    uniform vec3 uLineColor;
    varying vec2 vUv;

    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

    void main(){
      vec2 px = 1.0 / uRes;
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      vec2 o = px * 1.0;
      vec4 nC = texture2D(tNormal, vUv);
      vec4 nL = texture2D(tNormal, vUv - vec2(o.x, 0.0));
      vec4 nR = texture2D(tNormal, vUv + vec2(o.x, 0.0));
      vec4 nD = texture2D(tNormal, vUv - vec2(0.0, o.y));
      vec4 nU = texture2D(tNormal, vUv + vec2(0.0, o.y));
      vec4 nDL = texture2D(tNormal, vUv - o);
      vec4 nDR = texture2D(tNormal, vUv + vec2(o.x, -o.y));
      vec4 nUL = texture2D(tNormal, vUv + vec2(-o.x, o.y));
      vec4 nUR = texture2D(tNormal, vUv + o);

      vec3 gx = (nR.xyz - nL.xyz) + (nUR.xyz - nUL.xyz) * 0.7 + (nDR.xyz - nDL.xyz) * 0.7;
      vec3 gy = (nU.xyz - nD.xyz) + (nUR.xyz - nDR.xyz) * 0.7 + (nUL.xyz - nDL.xyz) * 0.7;
      float nEdge = length(gx) + length(gy);

      float dC = nC.w;
      float lap = abs(nL.w + nR.w - 2.0 * dC) + abs(nU.w + nD.w - 2.0 * dC);
      float dEdge = smoothstep(0.004, 0.05, lap / max(dC * 0.06 + 0.02, 0.02));

      float edge = clamp(nEdge * 0.85, 0.0, 1.0) * 0.85 + dEdge * 0.75;
      edge = smoothstep(0.18, 0.88, edge) * uLineStrength;

      col = mix(col, uLineColor, edge * 0.96);

      vec3 bloom = texture2D(tBloom, vUv).rgb;
      col += bloom * uBloomStrength;

      float l = lum(col);
      vec3 coolTint = vec3(0.86, 0.92, 1.10);
      vec3 warmTint = vec3(1.06, 1.00, 0.94);
      col *= mix(coolTint, warmTint, smoothstep(0.12, 0.72, l));

      float v = distance(vUv, vec2(0.5));
      col *= 1.0 - smoothstep(0.58, 1.02, v) * 0.30;

      float grain = fract(sin(dot(vUv * uRes + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      col += (grain - 0.5) * 0.008;

      col = pow(max(col, 0.0), vec3(0.94)) * 1.06;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

function initTargets() {
  const pr = renderer.getPixelRatio();
  const w = Math.floor(window.innerWidth * pr);
  const h = Math.floor(window.innerHeight * pr);
  const opt = {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
    colorSpace: THREE.NoColorSpace,
  };
  rtScene = new THREE.WebGLRenderTarget(w, h, { ...opt, samples: 4 });
  rtNormal = new THREE.WebGLRenderTarget(w, h, { ...opt, samples: 0 });
  const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
  rtBright1 = new THREE.WebGLRenderTarget(bw, bh, opt);
  rtBright2 = new THREE.WebGLRenderTarget(bw, bh, opt);
  rtBloom1 = new THREE.WebGLRenderTarget(bw, bh, opt);
  rtBloom2 = new THREE.WebGLRenderTarget(bw, bh, opt);
  compositeMat.uniforms.uRes.value.set(w, h);
  wetLayerMat.uniforms.uRes.value.set(w, h);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  initTargets();
  const pr = renderer.getPixelRatio();
  rtReflect.setSize(
    Math.max(2, Math.floor(w * pr * REFL_SCALE)),
    Math.max(2, Math.floor(h * pr * REFL_SCALE))
  );
  wetLayerMat.uniforms.tReflect.value = rtReflect.texture;
  wetLayerMat.uniforms.uRes.value.set(w * pr, h * pr);
}
initTargets();
resize();
window.addEventListener('resize', resize);
wetLayerMat.uniforms.tReflect.value = rtReflect.texture;

/* =========================================================
   6. 平面反射渲染
   ========================================================= */
const _mirrorM = new THREE.Matrix4();
const _clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.016);
const REFL_BG = new THREE.Color(0x0a1220);

function updateReflection() {
  _mirrorM.set(
    1, 0, 0, 0,
    0, -1, 0, 0.028,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
  reflectCam.matrixWorld.copy(camera.matrixWorld).premultiply(_mirrorM);
  reflectCam.matrixWorld.decompose(reflectCam.position, reflectCam.quaternion, reflectCam.scale);
  reflectCam.matrixWorldInverse.copy(reflectCam.matrixWorld).invert();
  reflectCam.projectionMatrix.copy(camera.projectionMatrix);
  reflectCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

  renderer.clippingPlanes = [_clipPlane];

  const prevVis = hideInReflection.map(o => o.visible);
  hideInReflection.forEach((o) => { o.visible = false; });

  const prevBg = scene.background;
  scene.background = REFL_BG;

  renderer.setRenderTarget(rtReflect);
  renderer.clear(true, true, false);
  renderer.render(scene, reflectCam);

  hideInReflection.forEach((o, i) => { o.visible = prevVis[i]; });
  renderer.clippingPlanes = [];
  scene.background = prevBg;
  renderer.setRenderTarget(null);
}

/* =========================================================
   7. 主循环
   ========================================================= */
const clock = new THREE.Clock();
let t = 0;
/* 法线缓冲刷新间隔（帧）。1 = 每帧，2 = 隔帧 */
const NORMAL_INTERVAL = 3;   // 法线/深度缓冲：每 3 帧刷新
let normalTick = 0;
const REFL_INTERVAL = 2;     // 湿地面反射：每 2 帧刷新（相机自转极慢，肉眼无差）
let reflTick = 0;
/* 自适应分辨率：连续低帧时降低 pixelRatio，保证可拖拽流畅 */
const perf = { acc: 0, n: 0, done: false };
function adaptPerf(dt) {
  if (perf.done) return;
  perf.acc += dt; perf.n++;
  if (perf.n >= 90) {
    const avg = perf.acc / perf.n;
    if (avg > 0.028 && renderer.getPixelRatio() > 1.0) {
      renderer.setPixelRatio(Math.max(1.0, renderer.getPixelRatio() - 0.25));
      resize();
    } else {
      perf.done = true;
    }
    perf.acc = 0; perf.n = 0;
  }
}
const door = { t: 0, open: false, next: 5 + Math.random() * 5 };

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  adaptPerf(dt);

  controls.update();

  /* --- 天气动效 --- */
  rain.mat.uniforms.uTime.value = t;
  splash.mat.uniforms.uTime.value = t;
  updateBackdropRain(backdropRain, dt);
  updateDrips(drips, dt);
  updateRipples(ripples, dt);
  updateGlassRain(glassRain, dt);

  /* --- 招牌闪烁 --- */
  const fv = flickerSign.update(dt);
  if (SG.signFace) SG.signFace.color.setScalar(fv * 1.62);
  // 招牌不再有独立点光，闪烁只作用于灯箱面材质

  /* --- 自动门 --- */
  door.next -= dt;
  if (door.next <= 0) {
    door.open = !door.open;
    door.next = door.open ? 1.7 : (5.0 + Math.random() * 6);
  }
  const tgt = door.open ? 1 : 0;
  door.t += (tgt - door.t) * Math.min(1, dt * 3.6);
  const slide = door.t * 1.12;
  if (SG.doorL && SG.doorR) {
    SG.doorL.position.x = SG.doorBaseX.L - slide;
    SG.doorR.position.x = SG.doorBaseX.R + slide;
  }

  /* --- 交通信号灯 --- */
  const cyc = (t * 0.42) % 3;
  const active = cyc < 1.35 ? 0 : (cyc < 2.0 ? 1 : 2);
  traffic.lamps.forEach((l, i) => {
    l.mat.color.copy(new THREE.Color(l.base).multiplyScalar(i === active ? 2.6 : 0.14));
  });
  if (traffic.light) {
    traffic.light.color.set(traffic.colors[active]);
    traffic.light.intensity = 1.6;
  }
  const walkOn = active === 2;
  traffic.walkMat.color.set(walkOn ? 0x34c759 : 0x1a3d26).multiplyScalar(walkOn ? 2.2 : 1.0);
  traffic.stopMat.color.set(walkOn ? 0x4a1c1c : 0xff3b30).multiplyScalar(walkOn ? 1.0 : 2.0);

  /* --- 店内灯呼吸 --- */
  if (SG.ceilingLights) {
    SG.ceilingLights.forEach((L, i) => {
      L.intensity *= 1;
      L.userData.base = L.userData.base ?? L.intensity;
      L.intensity = L.userData.base * (0.97 + Math.sin(t * 0.7 + i * 1.3) * 0.03);
    });
  }

  wetLayerMat.uniforms.uTime.value = t;

  /* --- 渲染 --- */
  /* 反射与法线缓冲按帧间隔刷新：几何与灯光几乎静止，
     逐帧重绘整场景是纯 CPU 浪费。 */
  reflTick = (reflTick + 1) % REFL_INTERVAL;
  if (reflTick === 0) updateReflection();

  /* 法线/深度缓冲：几何是静态的，描边每 2 帧刷新一次即可（省一次全场景重绘） */
  normalTick = (normalTick + 1) % NORMAL_INTERVAL;
  if (normalTick === 0) {
    scene.overrideMaterial = normalMat;
    renderer.setRenderTarget(rtNormal);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
  }

  renderer.setRenderTarget(rtScene);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);

  if (DEBUG_REFL) {
    blit(new THREE.ShaderMaterial({
      uniforms: { t: { value: rtReflect.texture } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor=vec4(texture2D(t,vUv).rgb*3.0,1.0); }',
    }), null);
    return;
  }

  brightMat.uniforms.tDiffuse.value = rtScene.texture;
  blit(brightMat, rtBright1);

  const bw = rtBright1.width, bh = rtBright1.height;
  blurMat.uniforms.uRes.value.set(bw, bh);

  blurMat.uniforms.tDiffuse.value = rtBright1.texture;
  blurMat.uniforms.uDir.value.set(1, 0);
  blit(blurMat, rtBright2);

  blurMat.uniforms.tDiffuse.value = rtBright2.texture;
  blurMat.uniforms.uDir.value.set(0, 1);
  blit(blurMat, rtBloom1);

  blurMat.uniforms.tDiffuse.value = rtBloom1.texture;
  blurMat.uniforms.uDir.value.set(1.6, 0);
  blit(blurMat, rtBloom2);

  blurMat.uniforms.tDiffuse.value = rtBloom2.texture;
  blurMat.uniforms.uDir.value.set(0, 1.6);
  blit(blurMat, rtBloom1);

  compositeMat.uniforms.tDiffuse.value = rtScene.texture;
  compositeMat.uniforms.tNormal.value = rtNormal.texture;
  compositeMat.uniforms.tBloom.value = rtBloom1.texture;
  compositeMat.uniforms.uTime.value = t;
  blit(compositeMat, null);
}

/* --- 调试：移除 / 只保留指定名字的子树 --- */
{
  const hp = QS.get('hide');
  if (hp) {
    const list = hp.split(',');
    const kill = [];
    scene.traverse(o => { if (o.name) for (const k of list) if (o.name.includes(k)) kill.push(o); });
    kill.forEach(o => { if (o.parent) o.parent.remove(o); });
    console.log('[debug] removed', kill.map(o => o.name).join(' | '));
  }
}

/* 调试句柄：仅 ?debug=1 时暴露，供外部诊断 draw call / 分段耗时 */
if (QS.has('debug')) {
  window.__KONBINI = {
    renderer, scene, camera, controls,
    info: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0,
    }),
    countObjects: () => {
      let mesh = 0, sprite = 0, light = 0, total = 0;
      scene.traverse(o => {
        total++;
        if (o.isMesh) mesh++;
        else if (o.isSprite) sprite++;
        else if (o.isLight) light++;
      });
      return { total, mesh, sprite, light };
    },
    timings: () => window.__KONBINI._t || null,
    _t: null,
  };
}

animate();
console.log('[rainy-konbini] ready');
