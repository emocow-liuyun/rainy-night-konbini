/* =========================================================
   props.js — 街角外部元素：自动贩卖机 / 自行车 / 路灯 / 电线杆
             路牌 / 护栏 / 公告栏 / 小巷 / 信号灯 / 管线
   ========================================================= */
import * as THREE from 'three';
import {
  C, toon, glowMat, glassMat, add, box, slab, planeGeo, boxGeo, cyl, group,
  canvasTex, glowSprite, contactShadow, JP_FONT, tube, sphereGeo,
} from './core.js';

/* ================= 自动贩卖机 ================= */
function vendingFrontTex(i) {
  return canvasTex(512, 1024, (ctx, w, h) => {
    // 品牌色
    const themes = [
      { bg: '#c9463f', accent: '#f0c04a', name: 'DRINK' },
      { bg: '#2f6fa8', accent: '#e8f0f8', name: 'COLD' },
    ];
    const t = themes[i % 2];
    ctx.fillStyle = t.bg; ctx.fillRect(0, 0, w, h);
    // 顶部灯箱
    const g2 = ctx.createLinearGradient(0, 0, 0, 170);
    g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, t.bg);
    ctx.fillStyle = g2; ctx.fillRect(14, 14, w - 28, 156);
    ctx.fillStyle = t.bg;
    ctx.font = `bold 74px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('つめたい', w / 2, 92);

    // 商品展示窗（发光）
    ctx.fillStyle = '#eef6ff';
    ctx.fillRect(16, 190, w - 32, 560);
    const rows = 4, cols = 5;
    const cw = (w - 56) / cols, ch = 560 / rows;
    const pal = ['#d9532f', '#2f8a6e', '#e0a93a', '#2f6fa8', '#8a4bb8', '#c93b6a', '#3a9f8f', '#d97a2f', '#4a9d5c'];
    for (let r = 0; r < rows; r++) {
      // 层板
      ctx.fillStyle = '#c3d3e0';
      ctx.fillRect(20, 190 + (r + 1) * ch - 12, w - 40, 8);
      for (let c = 0; c < cols; c++) {
        const x = 32 + c * cw + cw / 2;
        const y = 190 + r * ch + ch * 0.58;
        const col = pal[(r * 5 + c) % pal.length];
        // 罐/瓶
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(x - cw * 0.20, y - ch * 0.34, cw * 0.40, ch * 0.56, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(x - cw * 0.17, y - ch * 0.14, cw * 0.34, ch * 0.18);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x - cw * 0.16, y - ch * 0.30, cw * 0.06, ch * 0.46);
        // 价签
        ctx.fillStyle = '#2a2f38';
        ctx.font = `bold 22px ${JP_FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${120 + ((r * 3 + c) % 4) * 10}`, x, 190 + (r + 1) * ch - 30);
      }
    }
    // 下部：投币口 / 出货口
    ctx.fillStyle = '#1e222a';
    ctx.fillRect(16, 770, w - 32, 240);
    // 按钮排
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(50 + c * ((w - 100) / 4), 800, 13, 0, 7); ctx.fill();
    }
    // 出货口
    ctx.fillStyle = '#0c0e12';
    ctx.fillRect(50, 900, w - 100, 88);
    ctx.fillStyle = '#2b3038';
    ctx.fillRect(56, 906, w - 112, 76);
    // 品牌字
    ctx.fillStyle = '#f0c04a';
    ctx.font = `bold 40px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(t.name, w / 2, 862);
  });
}

export function buildVendingMachine(parent, x, y, z, ry = 0, variant = 0) {
  const g = group(parent, 'vending');
  g.position.set(x, y, z);
  g.rotation.y = ry;

  const shellMat = toon(0xe6e8e6, { steps: [0.55, 0.82, 0.96, 1] });
  const bodyMat = toon(variant === 0 ? 0xb8403a : 0x2f6598, { steps: [0.5, 0.78, 0.96, 1] });

  // 机身
  box(g, 1.02, 1.86, 0.72, shellMat, 0, 0.93, 0);
  // 前面板（发光）
  const fTex = vendingFrontTex(variant);
  const face = new THREE.Mesh(planeGeo(0.96, 1.78), new THREE.MeshBasicMaterial({
    map: fTex, color: new THREE.Color(0xffffff).multiplyScalar(1.5),
  }));
  face.position.set(0, 0.93, 0.365);
  g.add(face);

  // 侧板色条
  box(g, 1.03, 0.10, 0.73, bodyMat, 0, 1.80, 0);
  box(g, 0.02, 1.80, 0.70, bodyMat, 0.515, 0.92, 0);

  // 顶部小灯
  box(g, 0.90, 0.035, 0.05, glowMat(0xeaf6ff, 2.0), 0, 1.90, 0.34);

  // 前面溢光
  glowSprite(g, variant === 0 ? 0xffd0b0 : 0xb8e0ff, 2.6, 0.9, 0, 1.1, 0.55);
  /* 贩卖机面板已高亮自发光，溢光交给 glowSprite，不再放点光 */

  // 底部踢脚
  box(g, 1.04, 0.10, 0.74, toon(0x2a2f38, { steps: [0.4, 0.7, 1] }), 0, 0.05, 0);

  contactShadow(g, 1.7, 1.5, 0.5, 0, 0.004, 0.1);
  return g;
}

/* ================= 自行车 ================= */
export function buildBicycle(parent, x, y, z, ry = 0, col = C.teal) {
  const g = group(parent, 'bicycle');
  g.position.set(x, y, z);
  g.rotation.y = ry;

  const frameMat = toon(col, { steps: [0.5, 0.8, 1.0] });
  const tyreMat = toon(0x1d2028, { steps: [0.4, 0.68, 0.95, 1] });
  const metalMat = toon(0xb8bfc8, { steps: [0.5, 0.8, 1] });

  const R = 0.33;
  const wheel = (wx, wz) => {
    // 轮胎
    add(g, new THREE.TorusGeometry(R, 0.032, 6, 20), tyreMat, wx, R, wz, 0, Math.PI / 2, 0);
    // 轮圈
    add(g, new THREE.TorusGeometry(R - 0.045, 0.010, 4, 20), metalMat, wx, R, wz, 0, Math.PI / 2, 0);
    // 辐条
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      add(g, boxGeo(0.006, R * 1.9, 0.006), metalMat, wx, R, wz, 0, Math.PI / 2, a);
    }
    // 花鼓
    add(g, new THREE.CylinderGeometry(0.028, 0.028, 0.07, 8), metalMat, wx, R, wz, 0, 0, Math.PI / 2);
  };
  wheel(-0.52, 0);
  wheel(0.52, 0);

  // 车架（用细管拼）
  const bar = (x1, y1, z1, x2, y2, z2, r = 0.020, mat = frameMat) => {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    const m = new THREE.Mesh(cylGeo(r, r, len, 6), mat);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    // 朝向
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.quaternion.copy(q);
    g.add(m);
    return m;
  };
  function cylGeo(rt, rb, h, seg) { return new THREE.CylinderGeometry(rt, rb, h, seg); }

  // 主三角
  bar(-0.52, R, 0, -0.06, R + 0.06, 0);            // 后下叉
  bar(-0.06, R + 0.06, 0, -0.05, R + 0.52, 0);     // 座管
  bar(-0.05, R + 0.52, 0, 0.34, R + 0.50, 0);      // 上管
  bar(0.34, R + 0.50, 0, 0.16, R + 0.02, 0);       // 下管前段
  bar(-0.06, R + 0.06, 0, 0.16, R + 0.02, 0);      // 下管后段
  bar(0.34, R + 0.50, 0, 0.52, R, 0);              // 前叉
  // 座杆 + 鞍座
  bar(-0.05, R + 0.52, 0, -0.05, R + 0.66, 0, 0.016, metalMat);
  box(g, 0.22, 0.05, 0.13, toon(0x2a2f38, { steps: [0.45, 0.75, 1] }), -0.06, R + 0.68, 0);
  // 车把
  bar(0.34, R + 0.50, 0, 0.34, R + 0.68, 0, 0.016, metalMat);
  bar(0.34, R + 0.68, -0.18, 0.34, R + 0.68, 0.18, 0.016, metalMat);
  for (const zz of [-0.18, 0.18]) {
    bar(0.34, R + 0.68, zz, 0.34, R + 0.68, zz + Math.sign(zz) * 0.08, 0.022, frameMat);
  }
  // 车筐
  const basketMat = toon(0x8c929a, { steps: [0.5, 0.78, 1] });
  box(g, 0.30, 0.20, 0.26, basketMat, 0.40, R + 0.44, 0);
  box(g, 0.28, 0.01, 0.24, toon(0x3a3f48, { steps: [0.4, 0.7, 1] }), 0.40, R + 0.35, 0);
  // 前挡泥板
  add(g, new THREE.TorusGeometry(R + 0.035, 0.018, 4, 14, Math.PI * 0.9), frameMat, 0.52, R, 0, 0, Math.PI / 2, 0.1);
  // 灯
  add(g, new THREE.CylinderGeometry(0.030, 0.030, 0.05, 10), glowMat(0xfff0d0, 2.0), 0.55, R + 0.28, 0);
  // 撑脚
  bar(-0.30, R + 0.02, 0.02, -0.36, 0.02, 0.12, 0.012, metalMat);

  contactShadow(g, 1.5, 0.7, 0.45, 0, 0.004, 0);
  return g;
}

/* ================= 路灯 ================= */
export function buildStreetLamp(parent, x, z, ry = 0, h = 4.2) {
  const g = group(parent, 'lamp');
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  const poleMat = toon(0x4a515c, { steps: [0.42, 0.7, 0.96, 1] });

  // 底座
  add(g, new THREE.CylinderGeometry(0.15, 0.19, 0.16, 12), poleMat, 0, 0.08, 0);
  // 灯杆
  add(g, new THREE.CylinderGeometry(0.055, 0.075, h, 10), poleMat, 0, h / 2, 0);
  // 弯臂
  tube(g, [[0, h, 0], [0, h + 0.22, 0], [0.28, h + 0.38, 0], [0.72, h + 0.40, 0]], 0.045, poleMat, 20, 6);
  // 灯头
  const head = add(g, new THREE.CylinderGeometry(0.20, 0.10, 0.16, 12), poleMat, 0.78, h + 0.34, 0, 0, 0, 0.22);
  // 灯罩发光
  add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.035, 12), glowMat(0xfff2d8, 3.0), 0.78, h + 0.245, 0);
  /* 路灯不再使用实时点光源：改由加法混合的光池贴片 + 灯头辉光承载。
     3 盏路灯 × 每像素光照循环，是夜景里最不划算的开销。 */
  glowSprite(g, 0xfff0d8, 2.2, 0.9, 0.78, h + 0.22, 0);

  // 地面光锥（软）
  const coneMat = new THREE.MeshBasicMaterial({
    map: glowTexLocal(), color: new THREE.Color(0xffeccc).multiplyScalar(0.95),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pool = new THREE.Mesh(planeGeo(7.2, 7.2), coneMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0.78, 0.03, 0);
  pool.renderOrder = 4;
  g.add(pool);
  return g;
}

let _glowTex = null;
function glowTexLocal() {
  if (_glowTex) return _glowTex;
  _glowTex = canvasTex(128, 128, (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  });
  return _glowTex;
}

/* ================= 电线杆 ================= */
export function buildUtilityPole(parent, x, z, h = 6.4) {
  const g = group(parent, 'utilityPole');
  g.position.set(x, 0, z);
  const mat = toon(0x8f949c, { steps: [0.45, 0.72, 0.95, 1] });
  const darkMat = toon(0x3a3f48, { steps: [0.4, 0.7, 1] });

  add(g, new THREE.CylinderGeometry(0.11, 0.16, h, 10), mat, 0, h / 2, 0);
  // 横担
  for (const [y, w] of [[h - 0.35, 1.5], [h - 0.85, 1.3]]) {
    box(g, w, 0.07, 0.09, darkMat, 0, y, 0);
    // 绝缘子
    for (const dx of [-w / 2 + 0.14, 0, w / 2 - 0.14]) {
      add(g, new THREE.CylinderGeometry(0.045, 0.055, 0.14, 8), toon(0x6b7280, { steps: [0.45, 0.75, 1] }), dx, y + 0.11, 0);
      add(g, new THREE.CylinderGeometry(0.075, 0.075, 0.025, 8), toon(0x6b7280, { steps: [0.45, 0.75, 1] }), dx, y + 0.10, 0);
    }
  }
  // 变压器
  add(g, new THREE.CylinderGeometry(0.19, 0.19, 0.52, 12), toon(0x767b84, { steps: [0.45, 0.72, 1] }), 0.34, h - 1.55, 0);
  box(g, 0.10, 0.10, 0.16, darkMat, 0.34, h - 1.28, 0);
  // 爬钉
  for (let i = 0; i < 7; i++) {
    box(g, 0.14, 0.03, 0.03, darkMat, 0.13, 0.9 + i * 0.55, 0);
  }
  // 接地线
  tube(g, [[-0.1, h - 0.9, 0], [-0.14, 2.2, 0.02], [-0.13, 0.4, 0.03], [-0.13, 0.04, 0.06]], 0.014, darkMat, 12, 4);

  // 灯（抱箍路灯）
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), darkMat, 0.28, h - 2.1, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.SphereGeometry(0.075, 8, 6), glowMat(0xffd9a0, 2.2), 0.55, h - 2.1, 0);
  glowSprite(g, 0xffd0a0, 1.1, 0.7, 0.55, h - 2.1, 0);

  return g;
}

/* ================= 电线 ================= */
export function buildPowerLines(parent, poles) {
  const g = group(parent, 'lines');
  const mat = toon(0x171b22, { steps: [0.6, 0.85, 1.0] });
  // poles: [{x,z,h, spans:[{to:[x,y,z], sag:0.35}]}]
  for (const p of poles) {
    for (const sp of p.spans) {
      const [tx, ty, tz] = sp.to;
      const y0 = p.h + (sp.dy || 0), y1 = ty;
      const mid = [(p.x + tx) / 2, (y0 + y1) / 2 - (sp.sag ?? 0.6), (p.z + tz) / 2];
      const q1 = [(p.x + mid[0]) / 2, (y0 + mid[1]) / 2 - (sp.sag ?? 0.6) * 0.35, (p.z + mid[2]) / 2];
      const q2 = [(mid[0] + tx) / 2, (mid[1] + y1) / 2 - (sp.sag ?? 0.6) * 0.35, (mid[2] + tz) / 2];
      tube(g, [[p.x, y0, p.z], q1, mid, q2, [tx, y1, tz]], 0.018, mat, 26, 4);
    }
  }
  return g;
}

/* ================= 街角路牌 ================= */
export function buildStreetSign(parent, x, z) {
  const g = group(parent, 'streetSign');
  g.position.set(x, 0, z);
  const poleMat = toon(0x9aa1aa, { steps: [0.5, 0.78, 1] });
  add(g, new THREE.CylinderGeometry(0.038, 0.045, 3.1, 8), poleMat, 0, 1.55, 0);

  const makePlate = (txt, sub, w, h, ry, y) => {
    const tex = canvasTex(512, 128, (ctx, W, H) => {
      ctx.fillStyle = '#1f4f7a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 5;
      ctx.strokeRect(7, 7, W - 14, H - 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 48px ${JP_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, W / 2, H * 0.40);
      ctx.font = `20px ${JP_FONT}`;
      ctx.fillStyle = '#bcd4ea';
      ctx.fillText(sub, W / 2, H * 0.74);
    });
    const m = new THREE.Mesh(planeGeo(w, h), new THREE.MeshBasicMaterial({ map: tex, color: 0xcfd9e4 }));
    m.position.set(0, y, 0);
    m.rotation.y = ry;
    // 双面
    const back = m.clone(); back.rotation.y = ry + Math.PI; back.position.z = 0;
    const holder = new THREE.Group();
    holder.add(m); holder.add(back);
    // 框
    const f = new THREE.Mesh(boxGeo(w + 0.02, h + 0.02, 0.03), toon(0x5c646f, { steps: [0.45, 0.74, 1] }));
    f.position.y = y;
    holder.add(f);
    g.add(holder);
    return holder;
  };
  makePlate('桜ヶ丘', 'SAKURAGAOKA', 1.05, 0.26, 0, 2.85);
  makePlate('本町通り', 'HONMACHI DORI', 1.05, 0.24, Math.PI / 2, 2.52);
  // 底部圆盘
  add(g, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 10), toon(0x6a7078, { steps: [0.45, 0.74, 1] }), 0, 0.025, 0);
  return g;
}

/* ================= 街角护栏（防止乱穿马路） ================= */
export function buildGuardrail(parent, x0, x1, z, ry = 0) {
  const g = group(parent, 'guardrail');
  g.position.set(x0, 0, z);
  g.rotation.y = ry;
  const len = x1 - x0;
  const mat = toon(0x9aa3ad, { steps: [0.5, 0.78, 1] });
  const postMat = toon(0x6f7782, { steps: [0.45, 0.74, 1] });
  // 立柱
  const n = Math.max(2, Math.round(len / 1.1));
  for (let i = 0; i <= n; i++) {
    const px = (i / n) * len;
    add(g, new THREE.CylinderGeometry(0.032, 0.036, 0.92, 8), postMat, px, 0.46, 0);
    add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), postMat, px, 0.94, 0);
  }
  // 横杆
  add(g, new THREE.CylinderGeometry(0.026, 0.026, len, 8), mat, len / 2, 0.86, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.022, 0.022, len, 8), mat, len / 2, 0.56, 0, 0, 0, Math.PI / 2);
  // 反光片
  for (let i = 0; i <= n; i++) {
    box(g, 0.05, 0.05, 0.05, glowMat(0xffd35a, 1.4), (i / n) * len, 0.86, 0.05);
  }
  return g;
}

/* ================= 公告栏 / 海报栏 ================= */
export function buildNoticeBoard(parent, x, z, ry = 0) {
  const g = group(parent, 'noticeBoard');
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  const frameMat = toon(0x8a9098, { steps: [0.45, 0.74, 1] });
  box(g, 0.09, 1.6, 0.09, frameMat, -0.55, 0.8, 0);
  box(g, 0.09, 1.6, 0.09, frameMat, 0.55, 0.8, 0);
  box(g, 1.24, 1.06, 0.07, toon(0xf2f0e8, { steps: [0.55, 0.82, 1] }), 0, 1.5, 0);

  const cols = ['#e8dfc8', '#d9e6f0', '#f0dcd0', '#dfeede', '#f0ecd0'];
  const texts = [
    ['町内会', 'お知らせ', '#c9463f'],
    ['防災', '訓練', '#2f6fa8'],
    ['秋祭り', '開催', '#d9532f'],
    ['資源', '回収', '#2f8a6e'],
  ];
  for (let i = 0; i < 4; i++) {
    const tex = canvasTex(160, 200, (ctx, w, h) => {
      ctx.fillStyle = cols[i]; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = texts[i][2]; ctx.fillRect(0, 0, w, 36);
      ctx.fillStyle = '#fff';
      ctx.font = `bold 22px ${JP_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(texts[i][0], w / 2, 19);
      ctx.fillStyle = '#3a3f4a';
      ctx.font = `bold 26px ${JP_FONT}`;
      ctx.fillText(texts[i][1], w / 2, 76);
      // 假文字行
      ctx.fillStyle = 'rgba(60,66,78,0.5)';
      for (let k = 0; k < 5; k++) {
        ctx.fillRect(16, 108 + k * 16, w - 32 - (k % 2) * 22, 6);
      }
    });
    const m = new THREE.Mesh(planeGeo(0.24, 0.30), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(-0.44 + i * 0.29, 1.52, 0.045);
    m.rotation.z = (i % 2 ? 1 : -1) * 0.02;
    g.add(m);
  }
  // 顶部雨棚
  box(g, 1.32, 0.04, 0.18, toon(0x6f7782, { steps: [0.45, 0.74, 1] }), 0, 2.06, 0.06);
  return g;
}

/* ================= 巷口（暗部） ================= */
export function buildAlley(parent, x, z0, z1, w = 2.2) {
  const g = group(parent, 'alley');
  g.position.set(x, 0, 0);
  // 巷子地面（更暗）
  slab(g, w, z1 - z0, toon(0x14171e, { steps: [0.35, 0.6, 0.85, 1] }), 0, 0.015, (z0 + z1) / 2);
  // 两侧墙
  const wallMat = toon(0x39404c, { steps: [0.4, 0.68, 0.92, 1] });
  box(g, 0.14, 2.6, z1 - z0, wallMat, -w / 2, 1.3, (z0 + z1) / 2);
  box(g, 0.14, 2.6, z1 - z0, wallMat, w / 2, 1.3, (z0 + z1) / 2);
  // 巷内灯
  add(g, sphereGeo(0.06, 8), glowMat(0xffd0a0, 2.4), -0.5, 2.2, z0 + 1.2);
  const L = new THREE.PointLight(0xffbe86, 3.0, 4.5, 2);
  L.position.set(-0.4, 2.0, z0 + 1.2);
  g.add(L);
  // 巷内杂物：空调外机、箱子
  box(g, 0.42, 0.44, 0.36, toon(0x767c86, { steps: [0.4, 0.7, 1] }), w / 2 - 0.35, 0.22, z0 + 0.6);
  box(g, 0.34, 0.30, 0.34, toon(0x5a6b4a, { steps: [0.4, 0.7, 1] }), -w / 2 + 0.35, 0.15, z0 + 1.4);
  // 通风管
  tube(g, [[w / 2 - 0.1, 2.0, z0 + 0.2], [w / 2 - 0.1, 2.0, z1 - 1.0]], 0.05, toon(0x545a64, { steps: [0.4, 0.7, 1] }), 10, 5);
  // 巷口门帘（暖光泄漏）
  const warm = new THREE.Mesh(planeGeo(w - 0.3, 1.6), new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffb673).multiplyScalar(0.55), transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  warm.position.set(0, 0.85, z0 + 0.15);
  g.add(warm);
  return g;
}

/* ================= 交通信号灯 ================= */
export function buildTrafficLight(parent, x, z, ry = 0) {
  const g = group(parent, 'trafficLight');
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  const poleMat = toon(0x3d4450, { steps: [0.42, 0.7, 0.96, 1] });
  add(g, new THREE.CylinderGeometry(0.06, 0.08, 3.4, 10), poleMat, 0, 1.7, 0);
  // 悬臂
  tube(g, [[0, 3.3, 0], [0, 3.45, 0], [0.5, 3.5, 0], [1.0, 3.5, 0]], 0.05, poleMat, 14, 6);
  // 灯箱
  const boxW = 0.28;
  box(g, 1.05, boxW, 0.20, toon(0x22262e, { steps: [0.4, 0.7, 1] }), 1.35, 3.36, 0);
  const lampColors = [0xff3b30, 0xffcc00, 0x34c759];
  const lamps = [];
  for (let i = 0; i < 3; i++) {
    const lx = 1.35 - 0.32 + i * 0.32;
    // 遮光罩
    add(g, new THREE.CylinderGeometry(0.10, 0.10, 0.10, 10), toon(0x181c22, { steps: [0.4, 0.7, 1] }), lx, 3.36, 0.09, Math.PI / 2, 0, 0);
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(lampColors[i]).multiplyScalar(i === 0 ? 2.4 : 0.16) });
    const l = add(g, new THREE.SphereGeometry(0.075, 10, 8), lampMat, lx, 3.36, 0.10);
    lamps.push({ mesh: l, mat: lampMat, base: lampColors[i] });
  }
  // 行人灯
  box(g, 0.20, 0.36, 0.16, toon(0x22262e, { steps: [0.4, 0.7, 1] }), 0.0, 2.5, 0.12);
  const walkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x34c759).multiplyScalar(0.2) });
  const walkLamp = add(g, planeGeo(0.14, 0.14), walkMat, 0.0, 2.44, 0.205);
  const stopMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b30).multiplyScalar(1.8) });
  const stopLamp = add(g, planeGeo(0.14, 0.14), stopMat, 0.0, 2.60, 0.205);

  /* 信号灯同样不用实时点光：三颗灯球自身已设为高亮自发材质，
     Bloom 会自然带出光晕，比一盏会移动的点光更省也更稳。 */
  return { group: g, lamps, walkMat, stopMat, light: null, colors: lampColors };
}

/* ================= 电线掉落的水滴锚点（供动效用） ================= */
export function poleAnchor(x, z, h) {
  return new THREE.Vector3(x, h, z);
}

/* ================= 井盖周围的落叶 / 杂物 ================= */
export function buildLitter(parent, x, z) {
  const g = group(parent, 'litter');
  const cols = [0xdccfae, 0xbfae86, 0x8f9a6a];
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * 7, r = 0.15 + Math.random() * 0.5;
    const m = new THREE.Mesh(planeGeo(0.07 + Math.random() * 0.06, 0.05 + Math.random() * 0.04),
      toon(cols[i % 3], { steps: [0.5, 0.8, 1] }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * 3;
    m.position.set(x + Math.cos(a) * r, 0.024, z + Math.sin(a) * r);
    g.add(m);
  }
  return g;
}
