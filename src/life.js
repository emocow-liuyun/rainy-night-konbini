/* =========================================================
   life.js — 行人行为系统 + 街角过路车辆
   · 行人：高精度人形（见 figure.js）+ 状态机行为（进店/看橱窗/等灯/过马路/离场）
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
   行人行为系统
   不再是简单折线往返，而是一套带状态机的生活行为：
     ENTER_STORE  → 走向店门 → 进店消失 → 店内停留 → 出店
     BROWSE       → 停在橱窗前看
     VENDING      → 去贩卖机买东西
     WALK         → 沿人行道走一段（单向，不折返）
     WAIT_CROSS   → 停在路口等灯
     CROSS        → 过斑马线
     GONE         → 从画面边缘离开，延迟后从另一侧重新进入
   ========================================================= */
import { buildFigure, poseWalk, poseStand, RATIO } from './figure.js';

/* --- 世界坐标锚点（与 base.js 的布局一致）--- */
const WALK_Y = 0.16;                    // 人行道面高
/* 自动门在世界坐标里的位置：
   store 局部 x=4.35，storeGroup 偏移 -2.2 → 世界 x=2.15
   玻璃面 z=2.0，门洞宽 2.48（x 0.91 ~ 3.39） */
const DOOR_X = 2.15;
const DOOR_Z = 2.00;
const DOOR_HALF_W = 1.16;               // 门洞半宽（略小于 1.24，留边）
const DOOR_IN_Z = 0.95;                 // 门内侧进深
const AISLE_Z = 0.30;                   // 店内导视地面
const STORE_IN_Y = 0.16;

const VP_LANE = [-9.2, 8.9];            // 前街可行走范围
const SIDE_LANE = [-8.6, 1.8];

/* 一行人的行为脚本：who / 起点 / 状态序列 */
export class Pedestrian {
  constructor(parent, opts) {
    const {
      name = 'ped',
      startX = 0,
      startZ = 2.55,
      facing = 0,                 // 初始朝向（弧度，0 = +Z）
      figure,                     // buildFigure 的返回值
      speed = 1.15,               // m/s，微缩尺度下约 1.1
      script = [],                // [{state, ...params}]
    } = opts;

    this.name = name;
    this.fig = figure;
    this.parent = parent;
    this.root = figure.root;
    this.speed = speed;
    this.script = script;
    this.step = 0;
    this.state = null;
    this.stateT = 0;
    this.stateData = {};
    this.pos = new THREE.Vector2(startX, startZ);
    this.heading = facing;
    this.targetHeading = facing;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.idleT = Math.random() * 3;
    this.visible = true;

    this.root.position.set(startX, WALK_Y, startZ);
    this.root.rotation.y = facing;
    parent.add(this.root);

    // 标记持伞的手臂（poseWalk/poseStand 会跳过）
    if (figure.joints.shoulderR.rotation.x < -0.5) figure.joints.__holdR = true;

    this._enterState(script[0]);
  }

  _enterState(st) {
    if (!st) { this.state = 'GONE'; this.stateT = 0; return; }
    this.state = st.state;
    this.stateT = 0;
    this.stateData = { ...st };
    // 设定目标点
    if (st.x !== undefined && st.z !== undefined) {
      this.stateData.tx = st.x;
      this.stateData.tz = st.z;
    }
  }

  _next() {
    this.step++;
    if (this.step < this.script.length) {
      this._enterState(this.script[this.step]);
    } else {
      // 脚本走完：循环回第一项
      this.step = 0;
      this._enterState(this.script[0]);
    }
  }

  /* 朝目标点走，返回是否到达 */
  _moveTo(tx, tz, dt, opts = {}) {
    const { arriveDist = 0.16, speedScale = 1, walk = true } = opts;
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.y;
    const dist = Math.hypot(dx, dz);
    if (dist < arriveDist) return true;

    const spd = this.speed * speedScale;
    const step = Math.min(dist, spd * dt);
    this.pos.x += (dx / dist) * step;
    this.pos.y += (dz / dist) * step;

    this.targetHeading = Math.atan2(dx, dz);
    if (walk) this.walkPhase += dt * spd * 5.2 * this.fig.strideScale;
    return false;
  }

  _face(tx, tz, dt, rate = 4.0) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.y;
    this.targetHeading = Math.atan2(dx, dz);
    let d = this.targetHeading - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * rate);
  }

  update(dt, t) {
    if (this.state === 'GONE') {
      this.stateT += dt;
      this.root.visible = false;
      if (this.stateT > (this.stateData.wait || 3)) this._next();
      return;
    }
    this.root.visible = this.visible;
    this.stateT += dt;

    const st = this.stateData;

    switch (this.state) {
      /* ---- 单向行走 ---- */
      case 'WALK': {
        const arrived = this._moveTo(st.tx, st.tz, dt, { speedScale: st.speedScale || 1 });
        // 转向
        let d = this.targetHeading - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(1, dt * 5.5);
        poseWalk(this.fig, this.walkPhase);
        if (arrived) this._next();
        break;
      }

      /* ---- 走向店门：分两段，先到门洞正前方，再沿门洞进入 ---- */
      case 'ENTER': {
        // 第一段：走到门洞中心正前方（保持与人行道同高）
        if (this.pos.y > DOOR_Z + 0.30) {
          const arrived = this._moveTo(DOOR_X, DOOR_Z + 0.42, dt, { arriveDist: 0.10 });
          let d = this.targetHeading - this.heading;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          this.heading += d * Math.min(1, dt * 5.5);
          poseWalk(this.fig, this.walkPhase);
          if (arrived) this.stateT = 0;
        } else {
          // 第二段：沿 +z 反方向穿门洞进店（x 锁死在门洞内）
          this.pos.x += (DOOR_X - this.pos.x) * Math.min(1, dt * 3.0);
          const stepZ = this.speed * dt;
          this.pos.y -= stepZ;
          this.targetHeading = Math.PI;      // 面向店内（-z）
          let d = this.targetHeading - this.heading;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          this.heading += d * Math.min(1, dt * 4.5);
          this.walkPhase += dt * this.speed * 5.2 * this.fig.strideScale;
          poseWalk(this.fig, this.walkPhase);
          if (this.pos.y <= DOOR_IN_Z) {
            this._enterState({ state: 'INSIDE', duration: st.duration || 6 });
          }
        }
        break;
      }

      /* ---- 店内：真的站在店里（可见，透过玻璃能看到）---- */
      case 'INSIDE': {
        // 在店内缓慢走动挑选商品
        this.root.visible = true;
        const wander = Math.sin(this.stateT * 0.55 + this.idleT) * 1.1;
        this.pos.x = DOOR_X + wander;
        this.pos.y = DOOR_IN_Z - 0.35;
        this.targetHeading = Math.PI + Math.sin(this.stateT * 0.4) * 0.9;
        let d = this.targetHeading - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(1, dt * 1.8);
        poseStand(this.fig, t + this.idleT, { lookAround: true });
        if (this.stateT >= (st.duration || 6)) {
          this._enterState({ state: 'EXIT' });
        }
        break;
      }

      /* ---- 从店里走出来：沿门洞退出到人行道 ---- */
      case 'EXIT': {
        this.root.visible = true;
        this.pos.x += (DOOR_X - this.pos.x) * Math.min(1, dt * 3.0);
        const stepZ = this.speed * dt * 0.95;
        this.pos.y += stepZ;
        this.targetHeading = 0;               // 面向街外（+z）
        let d = this.targetHeading - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(1, dt * 4.5);
        this.walkPhase += dt * this.speed * 5.2 * this.fig.strideScale;
        poseWalk(this.fig, this.walkPhase);
        if (this.pos.y >= DOOR_Z + 0.45) this._next();
        break;
      }

      /* ---- 站着做某事 ---- */
      case 'STAND': {
        this._face(st.faceX ?? st.tx ?? this.pos.x, st.faceZ ?? st.tz ?? this.pos.y, dt, 2.5);
        poseStand(this.fig, t + this.idleT, { lookAround: st.lookAround ?? true, phone: st.phone });
        if (this.stateT >= (st.duration || 5)) this._next();
        break;
      }

      /* ---- 橱窗前看 ---- */
      case 'BROWSE': {
        this._face(st.faceX, st.faceZ, dt, 3.0);
        poseStand(this.fig, t + this.idleT, { lookAround: false });
        // 头部左右扫视商品
        this.fig.joints.head.rotation.y = Math.sin(t * 0.55 + this.idleT) * 0.55;
        if (this.stateT >= (st.duration || 6)) this._next();
        break;
      }

      /* ---- 等灯 ---- */
      case 'WAIT': {
        this._face(st.tx ?? this.pos.x, st.tz ?? this.pos.y + 1, dt, 2.0);
        poseStand(this.fig, t + this.idleT, { lookAround: true });
        if (this.stateT >= (st.duration || 6)) this._next();
        break;
      }

      /* ---- 过马路 ---- */
      case 'CROSS': {
        const arrived = this._moveTo(st.tx, st.tz, dt, { speedScale: st.speedScale || 1.3 });
        let d = this.targetHeading - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(1, dt * 5.0);
        poseWalk(this.fig, this.walkPhase);
        if (arrived) this._next();
        break;
      }

      /* ---- 消失（出画面）---- */
      case 'DESPAWN': {
        this.stateT += dt;
        if (this.stateT > 0.4) { this.root.visible = false; }
        if (this.stateT >= (st.delay || 6)) this._next();
        break;
      }

      default:
        poseStand(this.fig, t, {});
        break;
    }

    // 应用位置与朝向
    const inStore = (this.state === 'INSIDE');
    this.root.position.set(this.pos.x, inStore ? STORE_IN_Y : WALK_Y, this.pos.y);
    this.root.rotation.y = this.heading;
  }
}

/* =========================================================
   行人剧本
   ========================================================= */

/* 1. 通勤者：从东侧走来 → 走到店门口 → 进店买东西 → 出来 → 继续往西走掉 */
export function scriptCommuter() {
  return [
    { state: 'WALK', x: -3.4, z: 2.62, speedScale: 1.0 },
    { state: 'ENTER', duration: 7 + Math.random() * 4 },
    { state: 'EXIT' },
    { state: 'WALK', x: 9.4, z: 2.55, speedScale: 0.95 },
    { state: 'DESPAWN', delay: 4 + Math.random() * 4 },
    { state: 'WALK', x: -3.6, z: 2.62, speedScale: 1.0 },
  ];
}

/* 2. 橱窗客：走到橱窗前看一会儿 → 再走开 */
export function scriptBrowser() {
  return [
    { state: 'WALK', x: -0.2, z: 2.58 },
    { state: 'BROWSE', faceX: -0.2, faceZ: 0.6, duration: 7 + Math.random() * 5 },
    { state: 'WALK', x: -9.0, z: 2.60 },
    { state: 'DESPAWN', delay: 4 + Math.random() * 4 },
    { state: 'WALK', x: 9.2, z: 2.56 },
    { state: 'BROWSE', faceX: 5.6, faceZ: 1.0, duration: 5 },
    { state: 'WALK', x: 9.4, z: 2.60 },
  ];
}

/* 3. 夜归人：横穿马路 → 走到店前 → 站一会 → 走掉 */
export function scriptCrosser() {
  return [
    { state: 'CROSS', x: -1.4, z: 8.78, speedScale: 1.4 },
    { state: 'CROSS', x: -1.4, z: 2.62, speedScale: 1.5 },
    { state: 'WALK', x: 3.2, z: 2.58 },
    { state: 'STAND', faceX: 2.0, faceZ: 0.4, duration: 6, phone: true },
    { state: 'WALK', x: -9.2, z: 2.60 },
    { state: 'DESPAWN', delay: 6 },
  ];
}

/* 4. 侧街通勤：从巷口走上人行道，转向店方向 */
export function scriptSideStreet() {
  return [
    { state: 'WALK', x: -3.55, z: -7.6 },
    { state: 'WALK', x: -3.55, z: 1.9 },
    { state: 'ENTER', duration: 14 },
    { state: 'EXIT' },
    { state: 'WALK', x: -3.6, z: 2.60 },
    { state: 'WALK', x: -8.9, z: 2.60 },
    { state: 'DESPAWN', delay: 8 },
    { state: 'WALK', x: -3.55, z: -7.6 },
  ];
}

/* 5. 贩卖机顾客：走到贩卖机前 → 站着按键 → 走开 */
export function scriptVending() {
  return [
    { state: 'WALK', x: 6.70, z: 3.02 },          // 走到贩卖机正前方
    { state: 'STAND', faceX: 6.70, faceZ: 2.55, duration: 6 + Math.random() * 4, lookAround: false },
    { state: 'WALK', x: 3.0, z: 2.56 },
    { state: 'WALK', x: -9.2, z: 2.60 },
    { state: 'DESPAWN', delay: 5 },
    { state: 'WALK', x: 9.2, z: 2.56 },
  ];
}

/* 6. 对面走的路人（不互动，纯背景流动） */
export function scriptPasserby() {
  return [
    { state: 'WALK', x: -9.0, z: 8.82 },
    { state: 'DESPAWN', delay: 3 },
    { state: 'WALK', x: 9.2, z: 8.86 },
    { state: 'DESPAWN', delay: 6 },
  ];
}

/* 7. 等人的人：站在路灯下不走 */
export function scriptLoaiter() {
  return [
    { state: 'STAND', faceX: 2.0, faceZ: 2.4, duration: 14, phone: true },
    { state: 'WALK', x: 9.3, z: 2.58 },
    { state: 'DESPAWN', delay: 6 },
    { state: 'WALK', x: -1.0, z: 2.60 },
    { state: 'BROWSE', faceX: -1.0, faceZ: 0.5, duration: 9 },
    { state: 'WALK', x: -9.0, z: 2.62 },
    { state: 'DESPAWN', delay: 5 },
    { state: 'WALK', x: 9.2, z: 2.58 },
  ];
}



/* =========================================================
   车辆合批：只合并「直接子 Mesh」，不递归进 Group。
   之前用 traverse 会把子 Group 的 mesh 也吃掉，
   导致关节位置被烘到父级原点（行人头跑到胯部就是这个 bug）。
   ========================================================= */
function mergeDirectChildren(group) {
  const byMat = new Map();
  const direct = group.children.filter(o => o.isMesh && !o.isInstancedMesh);
  if (direct.length < 2) return 0;

  for (const m of direct) {
    if (!m.geometry?.attributes?.position) continue;
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
      for (const k of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      }
      if (!g.attributes.uv) {
        const n = g.attributes.position.count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (g.index) g = g.toNonIndexed();
      m.updateMatrix();
      g.applyMatrix4(m.matrix);   // 只烘自身局部矩阵，父级保持原点
      geos.push(g);
    }
    if (geos.length < 2) { geos.forEach(g => g.dispose()); continue; }
    let mg = null;
    try { mg = mergeGeometries(geos, false); } catch { mg = null; }
    geos.forEach(g => g.dispose());
    if (!mg) continue;

    const nm = new THREE.Mesh(mg, mat);
    nm.frustumCulled = false;
    group.add(nm);
    for (const m of meshes) group.remove(m);
    merged += meshes.length;
  }
  return merged;
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
  mergeDirectChildren(root);

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
