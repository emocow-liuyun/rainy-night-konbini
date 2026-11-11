/* =========================================================
   life.js — 常驻行人 + 街角过路车辆
   · 行人：分段人形（腿/躯干/头/手持伞），沿路径行走、自动朝向
   · 车辆：车身 + 车窗 + 前后灯 + 轮胎，沿车道循环行驶
   ========================================================= */
import * as THREE from '../vendor/three.module.js';
import {
  C, toon, glowMat, add, box, planeGeo, boxGeo, cylGeo, group,
  canvasTex, contactShadow, JP_FONT, sphereGeo,
} from './core.js';
import { LAYOUT } from './base.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

/* =========================================================
   合批工具：把 group 里所有叶子 Mesh 按材质合并
   用于行人/车辆这类「小部件很多」的对象，减少 draw call
   ========================================================= */
function mergeGroupByMaterial(group) {
  const byMat = new Map();
  const leaves = [];
  group.traverse(o => { if (o.isMesh && !o.isInstancedMesh) leaves.push(o); });

  for (const m of leaves) {
    if (!m.geometry.attributes.position) continue;
    const mat = m.material;
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(m);
  }

  let merged = 0;
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const geos = [];
    for (const m of meshes) {
      let g = m.geometry.clone();
      // 统一属性集
      for (const k of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      }
      if (!g.attributes.uv) {
        const n = g.attributes.position.count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (g.index) g = g.toNonIndexed();
      // 烘入相对 group 的变换
      m.updateMatrixWorld(true);
      const local = new THREE.Matrix4().copy(m.matrixWorld);
      const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
      local.premultiply(inv);
      g.applyMatrix4(local);
      geos.push(g);
    }
    if (geos.length < 2) { geos.forEach(g => g.dispose()); continue; }
    let mg = null;
    try { mg = mergeGeometries(geos, false); } catch (e) { mg = null; }
    geos.forEach(g => g.dispose());
    if (!mg) continue;

    const nm = new THREE.Mesh(mg, mat);
    nm.frustumCulled = false;
    group.add(nm);
    for (const m of meshes) if (m.parent) m.parent.remove(m);
    merged += meshes.length;
  }
  return merged;
}

/* =========================================================
   行人
   ========================================================= */

/* 行人配色（夜晚的通勤色） */
const COAT_COLORS = [
  0x2f3a4d, 0x3d3346, 0x2a3b36, 0x4a3a2e, 0x33384a,
  0x5a4636, 0x2b3340, 0x463a4a,
];
const SKIN = 0xd8b89a;
const HAIR = 0x1e1b1a;
const PANTS = [0x1f242c, 0x2a2f38, 0x35302a, 0x232830];

/**
 * 构建一个分段人形。
 * 返回 { root, parts, height }，parts 里是可独立摆动的关节组。
 */
export function buildPerson(opts = {}) {
  const {
    coat = 0x2f3a4d,
    pants = 0x1f242c,
    umbrella = null,       // 颜色，null = 不打伞
    bag = false,
    scale = 1.0,
    hat = false,
  } = opts;

  const root = new THREE.Group();
  root.name = 'person';

  const coatMat = toon(coat, { steps: [0.42, 0.66, 0.86, 1.0] });
  const pantsMat = toon(pants, { steps: [0.38, 0.62, 0.84, 1.0] });
  const skinMat = toon(SKIN, { steps: [0.46, 0.70, 0.88, 1.0] });
  const hairMat = toon(HAIR, { steps: [0.4, 0.68, 0.9, 1.0] });
  const shoeMat = toon(0x15181d, { steps: [0.35, 0.62, 0.86, 1.0] });

  const H = 1.62 * scale;             // 总身高
  const legLen = H * 0.44;
  const torsoLen = H * 0.31;
  const headR = H * 0.068;

  /* --- 髋部：腿从这里摆动 --- */
  const hip = new THREE.Group();
  hip.position.y = legLen;
  root.add(hip);

  /* 双腿（各自的枢轴在髋部） */
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  hip.add(legL, legR);

  for (const [grp, side] of [[legL, -1], [legR, 1]]) {
    // 大腿+小腿做成一根（低面数风格，靠摆动足够）
    const leg = new THREE.Mesh(boxGeo(H * 0.062, legLen * 0.96, H * 0.05), pantsMat);
    leg.position.y = -legLen * 0.48;
    leg.position.x = side * H * 0.045;
    grp.add(leg);
    // 鞋
    const shoe = new THREE.Mesh(boxGeo(H * 0.075, H * 0.035, H * 0.105), shoeMat);
    shoe.position.set(side * H * 0.045, -legLen * 0.97, H * 0.018);
    grp.add(shoe);
  }

  /* --- 躯干 --- */
  const torso = new THREE.Group();
  torso.position.y = legLen;
  root.add(torso);

  const body = new THREE.Mesh(boxGeo(H * 0.15, torsoLen, H * 0.095), coatMat);
  body.position.y = torsoLen * 0.5;
  torso.add(body);

  // 肩（稍微加宽，剪影更清楚）
  const shoulders = new THREE.Mesh(boxGeo(H * 0.185, H * 0.045, H * 0.10), coatMat);
  shoulders.position.y = torsoLen * 0.94;
  torso.add(shoulders);

  /* --- 手臂（枢轴在肩部） --- */
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  torso.add(armL, armR);
  for (const [grp, side] of [[armL, -1], [armR, 1]]) {
    grp.position.set(side * H * 0.088, torsoLen * 0.90, 0);
    const arm = new THREE.Mesh(boxGeo(H * 0.042, torsoLen * 0.72, H * 0.042), coatMat);
    arm.position.y = -torsoLen * 0.34;
    grp.add(arm);
    // 手
    const hand = new THREE.Mesh(boxGeo(H * 0.038, H * 0.04, H * 0.038), skinMat);
    hand.position.y = -torsoLen * 0.70;
    grp.add(hand);
  }

  /* --- 脖子 + 头 --- */
  const head = new THREE.Group();
  torso.add(head);
  head.position.y = torsoLen + headR * 0.94;

  const skull = new THREE.Mesh(sphereGeo(headR, 10), skinMat);
  skull.scale.set(1, 1.12, 0.95);
  head.add(skull);

  // 头发：只覆盖后上方（用半球，正面露出脸）
  const hairGeo = new THREE.SphereGeometry(headR * 1.04, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.scale.set(1, 1.06, 1);
  hairMesh.position.y = headR * 0.10;
  hairMesh.rotation.x = -0.18;
  head.add(hairMesh);

  if (hat) {
    const brim = new THREE.Mesh(cylGeo(headR * 1.35, headR * 1.3, headR * 0.10, 10), toon(0x22262e, { steps: [0.4, 0.7, 1] }));
    brim.position.y = headR * 1.02;
    head.add(brim);
    const crown = new THREE.Mesh(cylGeo(headR * 0.85, headR * 0.95, headR * 0.55, 10), toon(0x22262e, { steps: [0.4, 0.7, 1] }));
    crown.position.y = headR * 1.30;
    head.add(crown);
  }

  /* --- 包（单肩或手提） --- */
  if (bag) {
    const bagMat = toon(0x2e2a26, { steps: [0.4, 0.68, 0.9, 1] });
    const b = new THREE.Mesh(boxGeo(H * 0.09, H * 0.10, H * 0.05), bagMat);
    b.position.set(H * 0.11, torsoLen * 0.28, H * 0.02);
    torso.add(b);
    // 包带
    const strap = new THREE.Mesh(boxGeo(H * 0.012, torsoLen * 0.55, H * 0.012), bagMat);
    strap.position.set(H * 0.055, torsoLen * 0.62, H * 0.04);
    strap.rotation.z = -0.42;
    torso.add(strap);
  }

  /* --- 伞 --- */
  let umbrellaGroup = null;
  if (umbrella !== null) {
    umbrellaGroup = new THREE.Group();
    const uMat = toon(umbrella, { steps: [0.44, 0.70, 0.90, 1.0] });
    /* 伞面：用球缺（半球压扁）做弧面，比圆锥更像真伞。
       半径 0.30H，纵向压到 0.45，边缘微微下垂。 */
    const R = H * 0.30;
    const canopyGeo = new THREE.SphereGeometry(R, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const canopy = new THREE.Mesh(canopyGeo, uMat);
    canopy.scale.set(1, 0.62, 1);
    canopy.position.y = H * 0.555;
    umbrellaGroup.add(canopy);
    // 伞尖
    const tip = new THREE.Mesh(cylGeo(0.008, 0.014, H * 0.035, 6),
      toon(0x2a2f38, { steps: [0.4, 0.7, 1] }));
    tip.position.y = H * 0.60;
    umbrellaGroup.add(tip);
    // 伞缘垂边（一圈细边，强调剪影）
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.985, H * 0.006, 4, 18), uMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = H * 0.555 - R * 0.62 * Math.cos(Math.PI * 0.42) * 0.0 + 0.0;
    rim.position.y = H * 0.555 - R * 0.62 * 0.40;
    umbrellaGroup.add(rim);
    // 伞柄（斜握在右手）
    const shaft = new THREE.Mesh(cylGeo(0.009, 0.009, H * 0.56, 6),
      toon(0x8a8f98, { steps: [0.45, 0.72, 1] }));
    shaft.position.set(H * 0.07, H * 0.20, H * 0.02);
    shaft.rotation.z = -0.06;
    umbrellaGroup.add(shaft);
    // 伞面轻微前倾（挡雨）
    umbrellaGroup.rotation.x = 0.06;
    torso.add(umbrellaGroup);
    // 举伞的手抬高
    armR.rotation.x = -0.55;
  }

  /* 合批：躯干/头/肩这些不动的部件按材质合并，减少 draw call。
     腿和手臂各自是独立 group（要摆动），保持原样。 */
  mergeGroupByMaterial(torso);
  mergeGroupByMaterial(head);
  // 伞面单独，不动
  if (umbrellaGroup) mergeGroupByMaterial(umbrellaGroup);

  contactShadow(root, H * 0.55, H * 0.45, 0.42, 0, 0.004, 0);

  return {
    root,
    parts: { hip, legL, legR, torso, armL, armR, head, umbrella: umbrellaGroup },
    height: H,
    phase: Math.random() * Math.PI * 2,
    speedScale: 0.94 + Math.random() * 0.14,
  };
}

/* 腿部摆动 + 身体上下起伏 */
export function animatePerson(p, walkPhase, opts = {}) {
  const { moving = true, idleAmp = 0.5 } = opts;
  const { legL, legR, armL, armR, hip, torso, head } = p.parts;

  if (!moving) {
    // 站立：轻微呼吸 + 偶发换重心
    const t = walkPhase * 0.18;
    legL.rotation.x = Math.sin(t) * 0.012;
    legR.rotation.x = -Math.sin(t) * 0.012;
    armL.rotation.x = Math.sin(t * 0.8) * 0.05;
    armR.rotation.x = (armR.rotation.x < -0.4) ? -0.55 : -Math.sin(t * 0.8) * 0.05;
    torso.rotation.z = Math.sin(t * 0.5) * 0.012;
    head.rotation.y = Math.sin(t * 0.34) * 0.16;
    hip.position.y = p.height * 0.44;
    return;
  }

  const s = Math.sin(walkPhase);
  const c = Math.cos(walkPhase * 2);

  legL.rotation.x = s * 0.52;
  legR.rotation.x = -s * 0.52;

  // 手臂反相摆动（打伞的那只手保持不动）
  const armSwing = -s * 0.38;
  armL.rotation.x = armSwing;
  if (armR.userData.holdingUmbrella) {
    armR.rotation.x = -0.55;
  } else {
    armR.rotation.x = -armSwing;
  }

  // 髋部上下起伏（每步一次）
  hip.position.y = p.height * 0.44 + Math.abs(c) * p.height * 0.012;
  // 躯干轻微左右摇
  torso.rotation.z = s * 0.035;
  torso.rotation.y = -s * 0.05;
  // 头轻微点头
  head.rotation.x = Math.abs(c) * 0.03;
  head.rotation.y = -torso.rotation.y * 0.6;
}

/* =========================================================
   行人路径：路径点是世界坐标 [x, z]，行人沿折线循环行走
   ========================================================= */
export function makeWalker(parent, pathPts, opts = {}) {
  const { loop = true, speed = 1.05, personOpts = {}, pauseAt = null } = opts;

  const person = buildPerson(personOpts);
  if (person.parts.umbrella) {
    person.parts.armR.userData.holdingUmbrella = true;
    person.parts.armR.rotation.x = -0.55;
  }
  parent.add(person.root);

  // 路径总长
  const segs = [];
  let total = 0;
  for (let i = 0; i < pathPts.length - 1; i++) {
    const [x0, z0] = pathPts[i];
    const [x1, z1] = pathPts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    segs.push({ x0, z0, x1, z1, len, start: total });
    total += len;
  }

  const w = {
    person,
    segs,
    total,
    t: Math.random() * total,
    speed,
    heading: 0,
    paused: false,
    pauseTimer: 0,
    y: opts.y ?? 0.16,
    groundY: opts.y ?? 0.16,
    walkPhase: person.phase,
    update(dt) {
      if (this.paused) {
        this.pauseTimer -= dt;
        animatePerson(this.person, this.walkPhase, { moving: false });
        if (this.pauseTimer <= 0) this.paused = false;
        return;
      }

      this.t += this.speed * dt;
      if (this.t > this.total) {
        if (loop) this.t -= this.total;
        else { this.t = this.total; }
      }

      // 定位到段
      let seg = this.segs[this.segs.length - 1];
      for (const s of this.segs) {
        if (this.t >= s.start && this.t < s.start + s.len) { seg = s; break; }
      }
      const f = seg.len > 0 ? (this.t - seg.start) / seg.len : 0;
      const x = seg.x0 + (seg.x1 - seg.x0) * f;
      const z = seg.z0 + (seg.z1 - seg.z0) * f;
      this.person.root.position.set(x, this.groundY, z);

      // 朝向：朝运动方向，做角度插值避免拐点瞬转
      const targetHeading = Math.atan2(seg.x1 - seg.x0, seg.z1 - seg.z0);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 5.0);
      this.person.root.rotation.y = this.heading;

      // 步频与速度挂钩
      this.walkPhase += dt * this.speed * 5.4 * this.person.speedScale;
      animatePerson(this.person, this.walkPhase, { moving: true });

      // 随机驻足（看手机 / 看橱窗）
      if (pauseAt && Math.random() < pauseAt * dt) {
        this.paused = true;
        this.pauseTimer = 1.5 + Math.random() * 3.0;
      }
    },
  };
  return w;
}

/* =========================================================
   车辆
   ========================================================= */
const CAR_BODY = [0xd8dde3, 0x2a2e36, 0x8c3a3a, 0x2f4a6b, 0xb8bcc2, 0x3a4a3f, 0xc9b8a0];

export function buildCar(opts = {}) {
  const {
    body = 0xd8dde3,
    variant = 'sedan',      // sedan | kei | van | taxi
    headlightsOn = true,
  } = opts;

  const root = new THREE.Group();
  root.name = 'car';

  const bodyMat = toon(body, { steps: [0.46, 0.72, 0.92, 1.0] });
  const glassMatCar = toon(0x223040, { steps: [0.42, 0.66, 0.88, 1] });
  const tyreMat = toon(0x14171c, { steps: [0.34, 0.62, 0.9, 1] });
  const trimMat = toon(0x2a2f38, { steps: [0.4, 0.7, 1] });
  const chromeMat = toon(0xaab2bc, { steps: [0.5, 0.78, 1] });

  let L, W, H, cabH, roofF, roofB;
  /* 按微缩世界的比例：便利店层高 3.2，成年人 1.6，
     所以一辆家用车长约 2.6、宽 1.1 才合理。 */
  if (variant === 'kei') {
    L = 1.85; W = 0.92; H = 0.44; cabH = 0.58; roofF = 0.40; roofB = -0.70;
  } else if (variant === 'van') {
    L = 2.45; W = 1.08; H = 0.52; cabH = 0.74; roofF = 0.70; roofB = -1.10;
  } else {
    L = 2.25; W = 1.02; H = 0.40; cabH = 0.46; roofF = 0.30; roofB = -0.62;
  }

  /* 车身下部 */
  const lower = new THREE.Mesh(boxGeo(W, H, L), bodyMat);
  lower.position.y = 0.215 + H * 0.5;
  root.add(lower);

  /* 车厢（上部，稍窄） */
  const cabLen = Math.abs(roofF - roofB) + 0.30;
  const cab = new THREE.Mesh(boxGeo(W * 0.90, cabH, cabLen), bodyMat);
  cab.position.set(0, 0.215 + H + cabH * 0.5, (roofF + roofB) / 2);
  root.add(cab);

  /* 车窗（四周贴片） */
  const winY = 0.215 + H + cabH * 0.52;
  const winH = cabH * 0.62;
  // 前挡
  const wf = new THREE.Mesh(planeGeo(W * 0.80, winH), glassMatCar);
  wf.position.set(0, winY, (roofF + roofB) / 2 + cabLen / 2 + 0.002);
  root.add(wf);
  // 后挡
  const wb = wf.clone();
  wb.position.z = (roofF + roofB) / 2 - cabLen / 2 - 0.002;
  wb.rotation.y = Math.PI;
  root.add(wb);
  // 侧窗
  for (const side of [-1, 1]) {
    const ws = new THREE.Mesh(planeGeo(cabLen * 0.86, winH), glassMatCar);
    ws.position.set(side * (W * 0.90 / 2 + 0.002), winY, (roofF + roofB) / 2);
    ws.rotation.y = side * Math.PI / 2;
    root.add(ws);
  }

  /* 车轮 */
  const wheelR = 0.215;
  const wheelZ = L * 0.33;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(cylGeo(wheelR, wheelR, 0.115, 12), tyreMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (W / 2 - 0.02), wheelR, sz * wheelZ);
      root.add(wheel);
      // 轮毂
      const hub = new THREE.Mesh(cylGeo(wheelR * 0.52, wheelR * 0.52, 0.125, 8), chromeMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      root.add(hub);
    }
  }

  /* 前照灯 + 尾灯 */
  const lamps = [];
  if (headlightsOn) {
    for (const sx of [-1, 1]) {
      const hl = new THREE.Mesh(planeGeo(W * 0.24, H * 0.32), glowMat(0xfff4d8, 2.6));
      hl.position.set(sx * W * 0.30, 0.215 + H * 0.62, L / 2 + 0.003);
      root.add(hl);
      lamps.push(hl);
    }
    for (const sx of [-1, 1]) {
      const tl = new THREE.Mesh(planeGeo(W * 0.20, H * 0.26), glowMat(0xff3a30, 1.9));
      tl.position.set(sx * W * 0.30, 0.215 + H * 0.62, -L / 2 - 0.003);
      tl.rotation.y = Math.PI;
      root.add(tl);
    }
    // 前灯光晕
    const glow = new THREE.Mesh(planeGeo(W * 1.4, 1.5), new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffe8c0).multiplyScalar(0.30),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.03, L / 2 + 0.75);
    root.add(glow);
  }

  /* 保险杠 / 格栅 */
  const bumpF = new THREE.Mesh(boxGeo(W * 0.96, 0.11, 0.08), trimMat);
  bumpF.position.set(0, 0.245, L / 2 + 0.02);
  root.add(bumpF);
  const bumpB = bumpF.clone();
  bumpB.position.z = -L / 2 - 0.02;
  root.add(bumpB);

  /* 出租车顶灯 */
  if (variant === 'taxi') {
    const sign = new THREE.Mesh(boxGeo(0.30, 0.11, 0.15), glowMat(0xffd98a, 1.8));
    sign.position.set(0, 0.215 + H + cabH + 0.08, (roofF + roofB) / 2);
    root.add(sign);
    // 车顶色带
    const stripe = new THREE.Mesh(boxGeo(W * 0.92, 0.05, L * 0.5), toon(0x30363f, { steps: [0.4, 0.7, 1] }));
    stripe.position.set(0, 0.30 + H * 0.55, -0.1);
    root.add(stripe);
  }

  /* 整车合批：车身所有静态部件按材质合并 */
  mergeGroupByMaterial(root);

  contactShadow(root, W * 1.7, L * 1.12, 0.55, 0, 0.004, 0);

  return { root, length: L, width: W, height: 0.215 + H + cabH };
}

/* =========================================================
   沿路行驶的车辆（循环）
   ========================================================= */
export function makeVehicle(parent, opts = {}) {
  const {
    lane,                // { from: [x,z], to: [x,z] }
    speed = 4.2,
    y = 0.02,
    body = CAR_BODY[Math.floor(Math.random() * CAR_BODY.length)],
    variant = 'sedan',
    offset = 0,          // 初始相位 0..1
    headlightsOn = true,
  } = opts;

  const car = buildCar({ body, variant, headlightsOn });
  parent.add(car.root);

  const [x0, z0] = lane.from;
  const [x1, z1] = lane.to;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const dirX = (x1 - x0) / len;
  const dirZ = (z1 - z0) / len;
  const heading = Math.atan2(dirX, dirZ);

  const v = {
    car,
    x0, z0, dirX, dirZ, len,
    t: offset * len,
    speed,
    y,
    heading,
    update(dt) {
      this.t += this.speed * dt;
      if (this.t > this.len) this.t -= this.len;
      const x = this.x0 + this.dirX * this.t;
      const z = this.z0 + this.dirZ * this.t;
      this.car.root.position.set(x, this.y, z);
      this.car.root.rotation.y = this.heading;
    },
  };
  v.update(0);
  return v;
}
