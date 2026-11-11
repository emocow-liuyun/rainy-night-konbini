/* =========================================================
   base.js — 微缩底座 / 沥青道路 / 人行道 / 斑马线 / 积水
   布局（底座 20×20，原点居中）
     · 商店：x -3.4…4.4，z -5.6…2.0（玻璃面 z = 2.0）
     · 前街（东西向）：z 3.2…8.2
     · 侧街（南北向）：x -9.6…-4.6
     · 店前人行道：z 2.0…3.2
     · 对面人行道：z 8.2…9.4
   ========================================================= */
import * as THREE from 'three';
import {
  C, toon, glowMat, box, slab, add, planeGeo, boxGeo, cyl, group,
  canvasTex, contactShadow, JP_FONT,
} from './core.js';

export const LAYOUT = {
  base: 20,
  roadZ: [3.2, 8.2],        // 前街（东西向）
  roadX: [-8.8, -4.6],      // 侧街（南北向）
  store: { x: [-2.8, 5.0], z: [-5.2, 2.0] },
  northLot: { x: [-4.6, 10], z: [-10, 2.0] },
  frontWalk: { x: [-4.6, 10], z: [2.0, 3.2] },
  southWalk: { x: [-10, 10], z: [8.2, 9.4] },
  westWalk: { x: [-10, -8.8], z: [-10, 3.2] },
  wallH: 3.2,
};

/* ---------------- 程序化贴图 ---------------- */
function asphaltTex() {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#1b2028';
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 24;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.1;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 40 + Math.random() * 190;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() > 0.5;
      g.addColorStop(0, dark ? 'rgba(8,10,15,0.34)' : 'rgba(66,74,88,0.16)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(8,9,13,0.55)';
    for (let i = 0; i < 28; i++) {
      ctx.lineWidth = 0.6 + Math.random() * 1.4;
      ctx.beginPath();
      let x = Math.random() * w, y = Math.random() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function paverTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2f3644';
    ctx.fillRect(0, 0, w, h);
    const cols = 4, rows = 4;
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = 0.86 + Math.random() * 0.28;
        const base = [0x40, 0x48, 0x5a];
        const rr = Math.min(255, base[0] * v), gg = Math.min(255, base[1] * v), bb = Math.min(255, base[2] * v);
        ctx.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
        ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
        if (Math.random() > 0.55) {
          const g = ctx.createRadialGradient(
            c * cw + cw * 0.5, r * ch + ch * 0.5, 0,
            c * cw + cw * 0.5, r * ch + ch * 0.5, cw * 0.6);
          g.addColorStop(0, 'rgba(18,24,34,0.38)');
          g.addColorStop(1, 'rgba(18,24,34,0)');
          ctx.fillStyle = g;
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
      }
    }
    ctx.strokeStyle = 'rgba(108,120,142,0.30)';
    ctx.lineWidth = 2;
    for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, h); ctx.stroke(); }
    for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(w, r * ch); ctx.stroke(); }
  });
}

function tactileTex() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c8a83c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e0bf4c';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.beginPath();
        ctx.arc(16 + c * 32, 16 + r * 32, 9, 0, 7);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(120,96,30,0.35)';
    ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, h - 3, w, 3);
  });
}

/* ---------------- 底座 ---------------- */
export function buildBase(root) {
  const g = group(root, 'base');
  const S = LAYOUT.base;

  // 地形层（最上层薄板，形成清晰方形边界）
  box(g, S, 0.28, S, toon(0x414959, { steps: [0.36, 0.62, 0.84, 1.0] }), 0, -0.14, 0);
  // 地层剖面（深色岩层）
  box(g, S - 0.06, 0.62, S - 0.06, toon(0x232936, { steps: [0.30, 0.55, 0.78, 1.0] }), 0, -0.59, 0);
  // 黄铜饰条（收藏模型感）
  box(g, S + 0.02, 0.055, S + 0.02, toon(C.brass, { steps: [0.38, 0.64, 0.88, 1.0], emissive: 0x2a1c08, emissiveIntensity: 0.85 }), 0, -0.93, 0);
  // 底座主体
  box(g, S - 0.30, 0.86, S - 0.30, toon(0x0e1118, { steps: [0.30, 0.55, 0.80, 1.0] }), 0, -1.39, 0);
  // 底部收边
  box(g, S - 0.62, 0.20, S - 0.62, toon(0x080a0e, { steps: [0.3, 0.6, 1.0] }), 0, -1.92, 0);
  // 顶面（沥青）
  const aTex = asphaltTex();
  aTex.repeat.set(5, 5);
  aTex.wrapS = aTex.wrapT = THREE.RepeatWrapping;
  const asphaltMat = toon(0xc8cedb, { map: aTex, steps: [0.38, 0.62, 0.84, 0.96, 1.0] });
  slab(g, S - 0.01, S - 0.01, asphaltMat, 0, 0.004, 0);

  return g;
}

/* ---------------- 人行道 / 路缘 ---------------- */
function sidewalkBlock(g, x0, x1, z0, z1, h = 0.15) {
  const w = x1 - x0, d = z1 - z0;
  const t = paverTex();
  t.repeat.set(Math.max(1, w / 2.0), Math.max(1, d / 2.0));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const mat = toon(0x9aa2b2, { map: t, steps: [0.32, 0.55, 0.76, 0.92, 1.0] });
  const matSide = toon(C.curb, { steps: [0.38, 0.66, 0.88, 1.0] });
  const m = box(g, w, h, d, mat, (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  const e = 0.05;
  box(g, w + e, h * 0.94, 0.07, matSide, (x0 + x1) / 2, h / 2, z0 - 0.035);
  box(g, w + e, h * 0.94, 0.07, matSide, (x0 + x1) / 2, h / 2, z1 + 0.035);
  box(g, 0.07, h * 0.94, d + e, matSide, x0 - 0.035, h / 2, (z0 + z1) / 2);
  box(g, 0.07, h * 0.94, d + e, matSide, x1 + 0.035, h / 2, (z0 + z1) / 2);
  return m;
}

export function buildStreets(root) {
  const g = group(root, 'streets');
  const L = LAYOUT;
  const S = L.base, HALF = S / 2;

  /* ---------- 地块铺装（商店所在街区） ---------- */
  const lotTex = paverTex();
  lotTex.repeat.set(10, 10); lotTex.wrapS = lotTex.wrapT = THREE.RepeatWrapping;
  const lotMat = toon(0x8e96a4, { map: lotTex, steps: [0.30, 0.52, 0.74, 0.90, 1.0] });
  {
    const { x, z } = L.northLot;
    box(g, x[1] - x[0], 0.10, z[1] - z[0], lotMat, (x[0] + x[1]) / 2, 0.05, (z[0] + z[1]) / 2);
  }

  /* ---------- 人行道 ---------- */
  const sw = (r) => sidewalkBlock(g, r.x[0], r.x[1], r.z[0], r.z[1]);
  sw(L.frontWalk);
  sw(L.southWalk);
  sw(L.westWalk);
  // 侧街东侧人行道（商店左墙外的通道）
  sidewalkBlock(g, -4.6, -2.8, -10, 2.0);

  /* ---------- 路缘高光 ---------- */
  const matCurb = toon(0x9aa4b4, { steps: [0.44, 0.72, 1.0] });
  box(g, 10 - (-4.6), 0.05, 0.10, matCurb, (10 + (-4.6)) / 2, 0.172, L.roadZ[0] - 0.05);
  box(g, 0.10, 0.05, 2.0 - (-10), matCurb, -4.6 - 0.05, 0.172, (2.0 + (-10)) / 2);
  box(g, S, 0.05, 0.10, matCurb, 0, 0.172, L.roadZ[1] + 0.05);
  box(g, 0.10, 0.05, L.roadZ[1] - (-10), matCurb, L.roadX[0] - 0.05, 0.172, (L.roadZ[1] + (-10)) / 2);

  /* ---------- 点字ブロック（盲道） ---------- */
  const tt = tactileTex();
  tt.wrapS = tt.wrapT = THREE.RepeatWrapping;
  tt.repeat.set(1, 12);
  const tacMat = toon(0xffffff, { map: tt, steps: [0.44, 0.74, 1.0], emissive: 0x2a2205, emissiveIntensity: 0.4 });
  box(g, 0.32, 0.014, 11.0, tacMat, -3.55, 0.164, -4.4);
  const tt2 = tactileTex();
  tt2.wrapS = tt2.wrapT = THREE.RepeatWrapping;
  tt2.repeat.set(12, 1);
  const tacMat2 = toon(0xffffff, { map: tt2, steps: [0.44, 0.74, 1.0], emissive: 0x2a2205, emissiveIntensity: 0.4 });
  box(g, 12.0, 0.014, 0.32, tacMat2, 3.4, 0.164, L.roadZ[0] - 0.45);

  /* ---------- 道路标线 ---------- */
  const whiteMat = toon(0x9aa3b0, { steps: [0.50, 0.66, 0.80, 0.92, 1.0] });
  const lineY = 0.015;

  for (let x = -HALF + 0.4; x < HALF; x += 2.4) {
    slab(g, 1.3, 0.14, whiteMat, x + 0.65, lineY, (L.roadZ[0] + L.roadZ[1]) / 2);
  }
  for (let z = -HALF + 0.4; z < L.roadZ[0]; z += 2.4) {
    slab(g, 0.14, 1.3, whiteMat, (L.roadX[0] + L.roadX[1]) / 2, lineY, z + 0.65);
  }
  // 停止线
  slab(g, 3.5, 0.32, whiteMat, -6.6, lineY, L.roadZ[0] + 0.55);
  slab(g, 0.32, 3.5, whiteMat, L.roadX[1] - 0.55, lineY, -0.6);

  // 斑马线跨前街
  for (let i = 0; i < 7; i++) {
    slab(g, 0.44, L.roadZ[1] - L.roadZ[0] - 0.7, whiteMat, -2.2 + i * 0.68, lineY, (L.roadZ[0] + L.roadZ[1]) / 2);
  }
  // 斑马线跨侧街
  for (let i = 0; i < 7; i++) {
    slab(g, L.roadX[1] - L.roadX[0] - 0.7, 0.44, whiteMat, (L.roadX[0] + L.roadX[1]) / 2, lineY, 4.2 + i * 0.68);
  }

  // "止まれ"
  const stopTex = canvasTex(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(242,246,252,0.92)';
    ctx.font = `bold 150px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(1, 1.55);
    ctx.fillText('止まれ', 0, 0); ctx.restore();
  });
  const stopMat = new THREE.MeshBasicMaterial({ map: stopTex, transparent: true, opacity: 0.70, depthWrite: false });
  const sm = new THREE.Mesh(planeGeo(1.9, 0.95), stopMat);
  sm.rotation.x = -Math.PI / 2; sm.rotation.z = Math.PI / 2;
  sm.position.set(L.roadX[1] - 1.4, lineY + 0.002, -2.0);
  g.add(sm);

  /* ---------- 排水沟 ---------- */
  const grateMat = toon(0x323843, { steps: [0.36, 0.64, 0.9, 1.0] });
  const gutterMat = toon(0x555d6b, { steps: [0.36, 0.62, 0.9, 1] });
  for (const x of [-1.4, 2.0, 5.4]) {
    box(g, 1.4, 0.024, 0.30, gutterMat, x, 0.017, L.roadZ[0] + 0.30);
    for (let i = 0; i < 9; i++) box(g, 0.085, 0.040, 0.24, grateMat, x - 0.62 + i * 0.155, 0.018, L.roadZ[0] + 0.30);
  }
  for (let z = -8.4; z < 1.8; z += 3.2) {
    box(g, 0.30, 0.024, 1.4, gutterMat, L.roadX[1] + 0.30, 0.017, z);
    for (let i = 0; i < 9; i++) box(g, 0.24, 0.040, 0.085, grateMat, L.roadX[1] + 0.30, 0.018, z - 0.62 + i * 0.155);
  }

  /* ---------- 井盖 ---------- */
  const mhMat = toon(0x424855, { steps: [0.36, 0.64, 0.9, 1.0] });
  const mhRing = toon(0x5c6373, { steps: [0.42, 0.72, 1] });
  for (const [mx, mz, mr] of [[0.4, 5.9, 0.34], [-6.6, -5.6, 0.30], [7.2, 6.2, 0.32], [-6.9, 6.6, 0.28]]) {
    add(g, new THREE.CylinderGeometry(mr, mr, 0.032, 16), mhMat, mx, 0.018, mz);
    for (let i = 0; i < 4; i++) {
      add(g, new THREE.TorusGeometry(mr * (0.32 + i * 0.18), 0.013, 4, 18), mhRing, mx, 0.035, mz, Math.PI / 2, 0, 0);
    }
  }

  /* ---------- 停车场白线（店前右侧） ---------- */
  const pMat = toon(0x98a1ae, { steps: [0.48, 0.64, 0.78, 0.9, 1.0] });
  for (const x of [6.2, 8.3]) {
    box(g, 0.085, 0.014, 1.8, pMat, x, 0.164, 2.95);
  }
  box(g, 2.1, 0.014, 0.085, pMat, 7.25, 0.164, 2.05);

  return g;
}

/* ---------------- 积水 ---------------- */
function puddleTex(seed) {
  return canvasTex(256, 256, (ctx, w, h) => {
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    const cx = w / 2, cy = h / 2;
    const pts = 14;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const r = (w * 0.38) * (0.70 + rnd() * 0.55);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.80;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.filter = 'blur(4px)';
    ctx.fill();
    ctx.filter = 'none';
  });
}

export const PUDDLE_SPOTS = [
    [1.2, 3.6, 2.6, 0.85, 7],
    [4.8, 3.55, 1.6, 0.65, 13],
    [-1.4, 3.5, 1.4, 0.58, 21],
    [-6.6, 4.6, 2.1, 1.8, 33],
    [-6.4, 0.6, 1.7, 1.4, 43],
    [2.4, 6.8, 2.5, 1.7, 51],
    [7.0, 6.2, 1.5, 1.1, 61],
    [-7.8, 7.2, 1.5, 1.2, 71],
    [-1.2, 7.2, 1.9, 1.3, 81],
    [-6.9, -3.8, 1.2, 1.1, 91],
    [6.8, 9.0, 1.3, 0.75, 101],
    [-3.6, 5.6, 1.6, 0.9, 111],
    [-8.2, 2.4, 1.1, 0.9, 121],
];

export function buildPuddles(root) {
  const g = group(root, 'puddles');
  for (const [x, z, w, d, seed] of PUDDLE_SPOTS) {
    const tex = puddleTex(seed);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.10,
      color: 0x1a2333, depthWrite: false,
      blending: THREE.NormalBlending,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    const m = new THREE.Mesh(planeGeo(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = (seed % 7) * 0.42;
    m.position.set(x, 0.020, z);
    m.renderOrder = 3;
    g.add(m);
  }
  return g;
}
