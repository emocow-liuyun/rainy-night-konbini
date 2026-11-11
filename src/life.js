/* Passing street traffic: car models and lane animation only. */
import * as THREE from '../vendor/three.module.js';
import {
  toon, glowMat, glowTex, planeGeo, boxGeo, cylGeo, contactShadow,
} from './core.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

// No pedestrian model, controller or navigation dependency.

/* =========================================================
   车辆合批：仅烘焙直接子网格的局部变换。
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
      map: glowTex(), color: new THREE.Color(0xffe8c0).multiplyScalar(0.24),
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
    period = 20,
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
    elapsed: offset * Math.max(period, len / speed + 2),
    cycle: Math.max(period, len / speed + 2),
    update(dt) {
      this.elapsed += dt;
      const phase = this.elapsed % this.cycle;
      const progress = phase * this.speed;
      this.car.root.visible = progress <= this.len;
      this.t = Math.min(this.len, progress);
      const x = this.x0 + this.dirX * this.t;
      const z = this.z0 + this.dirZ * this.t;
      this.car.root.position.set(x, this.y, z);
      this.car.root.rotation.y = this.heading;
      // A small miniature-scale entry/exit transition hides a visible wraparound.
      const edge = Math.min(this.t, this.len - this.t);
      const f = THREE.MathUtils.smoothstep(edge, 0, 0.8);
      this.car.root.scale.setScalar(f);
    },
  };
  v.update(0);
  return v;
}
