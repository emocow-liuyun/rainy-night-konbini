/* =========================================================
   store.js — 便利店建筑 + 完整店内陈设
   店面朝向 +Z（前街），玻璃幕墙在 z = 1.20
   ========================================================= */
import * as THREE from '../vendor/three.module.js';
import {
  C, toon, glowMat, glassMat, add, box, slab, planeGeo, boxGeo, cyl, group,
  canvasTex, glowSprite, contactShadow, JP_FONT, Batch, sphereGeo,
} from './core.js';

const X0 = -0.6, X1 = 7.2;      // 店面 x 范围
const Z0 = -6.0, Z1 = 1.2;      // z 范围（Z1 为玻璃面）
const H = 3.2;                  // 层高
const FLOOR = 0.16;             // 店内地面 y

/* ================= 贴图 ================= */
function floorTileTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#cfc9b8';
    ctx.fillRect(0, 0, w, h);
    const n = 8, cw = w / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = Math.random() > 0.5 ? 1 : 0.965;
        ctx.fillStyle = `rgba(${232 * v | 0},${226 * v | 0},${208 * v | 0},1)`;
        ctx.fillRect(c * cw + 1.5, r * cw + 1.5, cw - 3, cw - 3);
      }
    }
    ctx.strokeStyle = 'rgba(150,144,128,0.75)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cw); ctx.lineTo(w, i * cw); ctx.stroke();
    }
  }, { repeat: [4, 4] });
}

function ceilTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#eef0ee';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e2e5e3';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      ctx.fillRect(c * 64 + 3, r * 64 + 3, 58, 58);
    }
    ctx.strokeStyle = '#cdd2cf'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
    }
  }, { repeat: [5, 5] });
}

function makeSignTex() {
  return canvasTex(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f7f8f5'; ctx.fillRect(0, 0, w, h);
    // 条纹带（橙/绿/蓝，典型的日式便利店配色，不用真实品牌）
    const bands = ['#e8853a', '#2f8a6e', '#2f6fa8'];
    let x = 0;
    for (const b of bands) { ctx.fillStyle = b; ctx.fillRect(x, 0, 40, h); x += 44; }
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, h - 22, w, 22);

    ctx.fillStyle = '#22303f';
    ctx.font = `bold 96px ${JP_FONT}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('コンビニ', 175, h * 0.44);
    ctx.fillStyle = '#e8853a';
    ctx.font = `bold 40px ${JP_FONT}`;
    ctx.fillText('24 時間 営業', 178, h * 0.78);
    // 装饰
    ctx.fillStyle = '#2f8a6e';
    ctx.beginPath(); ctx.arc(w - 110, h * 0.5, 46, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold 52px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('24', w - 110, h * 0.5 + 2);
    ctx.fillStyle = '#f0c04a';
    ctx.fillRect(w - 216, h * 0.34, 10, h * 0.34);
  });
}

function stripeBandTex() {
  return canvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f7f8f5'; ctx.fillRect(0, 0, w, h);
    const cols = ['#e8853a', '#2f8a6e', '#2f6fa8'];
    const seg = w / 3;
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * seg, 0, seg, h); });
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, 0, w, 4);
  });
}

function posterTexA() {
  return canvasTex(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#f2eee2'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9532f'; ctx.fillRect(0, 0, w, 96);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 46px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.fillText('新発売', w / 2, 64);
    // 商品剪影
    const g2 = ctx.createLinearGradient(0, 120, 0, 300);
    g2.addColorStop(0, '#e8a860'); g2.addColorStop(1, '#c47a38');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.roundRect(70, 130, 116, 150, 14); ctx.fill();
    ctx.fillStyle = '#8a5a2c';
    ctx.fillRect(84, 150, 88, 22);
    ctx.fillStyle = '#2f6fa8';
    ctx.beginPath(); ctx.arc(w / 2, 320, 34, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold 30px ${JP_FONT}`;
    ctx.fillText('限定', w / 2, 332);
  });
}

function posterTexB() {
  return canvasTex(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#e9eef4'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f8a6e'; ctx.fillRect(0, 0, w, 70);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 40px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.fillText('おにぎり', w / 2, 50);
    // 饭团
    ctx.fillStyle = '#fdfdfa';
    ctx.beginPath(); ctx.moveTo(w / 2, 100); ctx.lineTo(w / 2 + 80, 250); ctx.lineTo(w / 2 - 80, 250); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1d2a26';
    ctx.fillRect(w / 2 - 42, 196, 84, 56);
    ctx.fillStyle = '#d9532f';
    ctx.font = `bold 34px ${JP_FONT}`;
    ctx.fillText('100 円', w / 2, 316);
    ctx.fillStyle = '#5c6b7a';
    ctx.font = `22px ${JP_FONT}`;
    ctx.fillText('税込', w / 2, 352);
  });
}

function posterTexC() {
  return canvasTex(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#20303f'; ctx.fillRect(0, 0, w, h);
    // 咖啡海报
    const g2 = ctx.createRadialGradient(w / 2, 150, 10, w / 2, 150, 130);
    g2.addColorStop(0, '#f0d6a8'); g2.addColorStop(1, 'rgba(32,48,63,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 40, w, 240);
    ctx.fillStyle = '#f7f4ec';
    ctx.beginPath(); ctx.moveTo(88, 110); ctx.lineTo(168, 110); ctx.lineTo(158, 205); ctx.lineTo(98, 205); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5a2c';
    ctx.fillRect(92, 140, 72, 46);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 44px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.fillText('COFFEE', w / 2, 300);
    ctx.fillStyle = '#f0c04a';
    ctx.font = `bold 26px ${JP_FONT}`;
    ctx.fillText('HOT / ICE', w / 2, 340);
    ctx.strokeStyle = '#f0c04a'; ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
  });
}

function drinkFridgeTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    // 冰箱内部货架背光
    const g2 = ctx.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, '#eaf6ff'); g2.addColorStop(0.5, '#d7ecfb'); g2.addColorStop(1, '#c2dff5');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
    const rows = 5, cols = 9;
    const cw = w / cols, ch = h / rows;
    const palette = ['#d9532f', '#2f6fa8', '#2f8a6e', '#e0a93a', '#8a4bb8', '#c93b6a', '#3a9fd9', '#d9a23a', '#4a9d5c'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.5, y = r * ch + ch * 0.58;
        const col = palette[(r * 3 + c) % palette.length];
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(c * cw + 3, r * ch + ch * 0.72, cw - 6, 4);
        // 瓶子
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(x - cw * 0.22, y - ch * 0.34, cw * 0.44, ch * 0.52, 4); ctx.fill();
        ctx.fillRect(x - cw * 0.09, y - ch * 0.42, cw * 0.18, ch * 0.10);
        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x - cw * 0.18, y - ch * 0.30, cw * 0.07, ch * 0.40);
        // 标签
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x - cw * 0.2, y - ch * 0.06, cw * 0.4, ch * 0.10);
      }
      // 层板
      ctx.fillStyle = '#9fb6c8';
      ctx.fillRect(0, r * ch + ch * 0.80, w, 5);
    }
  });
}

function shelfGoodsTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f2eee0'; ctx.fillRect(0, 0, w, h);
    const rows = 6, cols = 10;
    const cw = w / cols, ch = h / rows;
    const palette = ['#d9532f', '#e8a13a', '#2f8a6e', '#2f6fa8', '#c93b6a', '#8a4bb8', '#e0c040', '#3a9f8f', '#d97a2f'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * ch;
        const col = palette[(r * 7 + c * 3) % palette.length];
        const kind = (r + c) % 3;
        ctx.fillStyle = '#dfd9c6';
        ctx.fillRect(x + 2, y + ch * 0.82, cw - 4, 5);
        if (kind === 0) {
          // 袋装
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.roundRect(x + cw * 0.14, y + ch * 0.14, cw * 0.72, ch * 0.64, 4); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(x + cw * 0.2, y + ch * 0.34, cw * 0.6, ch * 0.16);
        } else if (kind === 1) {
          // 盒装
          ctx.fillStyle = col;
          ctx.fillRect(x + cw * 0.16, y + ch * 0.22, cw * 0.68, ch * 0.56);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(x + cw * 0.2, y + ch * 0.26, cw * 0.6, ch * 0.14);
        } else {
          // 杯装
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(x + cw * 0.22, y + ch * 0.24);
          ctx.lineTo(x + cw * 0.78, y + ch * 0.24);
          ctx.lineTo(x + cw * 0.68, y + ch * 0.76);
          ctx.lineTo(x + cw * 0.32, y + ch * 0.76);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillRect(x + cw * 0.26, y + ch * 0.30, cw * 0.48, ch * 0.1);
        }
      }
    }
  });
}

function bentoBoxTex(i) {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2a2f38'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f7f4ea'; ctx.fillRect(4, 4, w - 8, h - 8);
    // 饭
    ctx.fillStyle = '#fdfdf8';
    ctx.fillRect(10, 10, 52, 46);
    // 主菜
    const cols = ['#b8542c', '#c98a2e', '#8a5a2c', '#7a9c3a'];
    ctx.fillStyle = cols[i % 4];
    ctx.beginPath(); ctx.roundRect(66, 10, 50, 46, 5); ctx.fill();
    // 配菜
    ctx.fillStyle = cols[(i + 2) % 4];
    ctx.fillRect(10, 62, 34, 30);
    ctx.fillStyle = '#4d8f3f';
    ctx.fillRect(48, 62, 30, 30);
    ctx.fillStyle = '#d94a2f';
    ctx.beginPath(); ctx.arc(96, 78, 14, 0, 7); ctx.fill();
    // 标签
    ctx.fillStyle = 'rgba(220,40,40,0.85)';
    ctx.fillRect(10, 100, 40, 14);
  });
}

function magazineTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(0, 0, w, h);
    const cols = ['#d9532f', '#2f6fa8', '#e0a93a', '#8a4bb8', '#2f8a6e', '#c93b6a'];
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 41;
      ctx.fillStyle = cols[i];
      ctx.fillRect(x, 14, 36, 210);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x + 4, 30, 28, 70);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 4, 120, 28, 88);
    }
  });
}

function menuBoardTex() {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#fbf8ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8a2f22'; ctx.fillRect(0, 0, w, 52);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 30px ${JP_FONT}`;
    ctx.textAlign = 'left'; ctx.fillText('おでん ・ ホットスナック', 18, 36);
    const lines = [['大根', 90], ['卵', 90], ['こんにゃく', 90], ['厚揚げ', 110], ['ちくわ', 100]];
    let y = 92;
    for (const [n, p] of lines) {
      ctx.fillStyle = '#3a3f4a';
      ctx.font = `26px ${JP_FONT}`;
      ctx.fillText(n, 24, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#b83a2a';
      ctx.fillText(`${p}円`, w - 26, y);
      ctx.textAlign = 'left';
      y += 32;
    }
  });
}

function coffeeMachineTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1f242c'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2b333d'; ctx.fillRect(8, 8, w - 16, 80);
    ctx.fillStyle = '#4fd6c8';
    ctx.font = `bold 22px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.fillText('COFFEE', w / 2, 46);
    ctx.fillStyle = '#f0c04a';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(60 + i * 68, 74, 12, 0, 7); ctx.fill();
    }
    // 出液口
    ctx.fillStyle = '#0d1014';
    ctx.fillRect(w / 2 - 26, 110, 52, 40);
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(w / 2 - 6, 150, 12, 30);
  });
}

function clipStripTex() {
  return canvasTex(512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f7f5ee'; ctx.fillRect(0, 0, w, h);
    const cols = ['#d9532f', '#2f6fa8', '#e0a93a', '#2f8a6e', '#c93b6a'];
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(i * 32 + 3, 6, 26, h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(i * 32 + 6, 14, 20, 12);
    }
  });
}

/* ---------------- 共享的货架/杂志材质（离散变体，避免每层 clone） ---------------- */
const _goodsMatCache = new Map();
function goodsMatFor(width) {
  // 把宽度量化到 0.5 的整数倍，最多 6 档，材质总数因此固定
  const rep = Math.max(1, Math.min(6, Math.round(width / 0.6)));
  if (_goodsMatCache.has(rep)) return _goodsMatCache.get(rep);
  const tex = goodsTexBase();
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(rep, 1);
  const mat = toon(0xdad4c4, { map: t, steps: [0.52, 0.72, 0.88, 0.96, 1.0], emissive: 0x2a2519, emissiveIntensity: 1.0 });
  _goodsMatCache.set(rep, mat);
  return mat;
}

let _goodsTexBase = null;
function goodsTexBase() {
  if (!_goodsTexBase) _goodsTexBase = shelfGoodsTex();
  return _goodsTexBase;
}

let _magMat = null;
function magazineMat() {
  if (_magMat) return _magMat;
  const t = magazineTex();
  t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  _magMat = toon(0xd8d2c2, { map: t, steps: [0.48, 0.70, 0.88, 1.0] });
  return _magMat;
}

/* ================= 建筑主体 ================= */
export function buildStore(root, lights) {
  const g = group(root, 'store');
  const G = {}; // 返回可动效部件

  const wallMat = toon(C.wall, { steps: [0.55, 0.78, 0.92, 1.0] });
  const wallSide = toon(0xd8d0be, { steps: [0.50, 0.70, 0.86, 0.96, 1.0], emissive: 0x2c2618, emissiveIntensity: 1.0 });
  const wallDim = toon(0xd4ccb8, { steps: [0.50, 0.70, 0.86, 0.96, 1.0], emissive: 0x2a2418, emissiveIntensity: 1.0 });

  /* ---------- 地面 ---------- */
  const ft = floorTileTex();
  const floorMat = toon(0xc4bcaa, { map: ft, steps: [0.52, 0.72, 0.86, 0.96, 1.0], emissive: 0x241f14, emissiveIntensity: 1.0 });
  box(g, X1 - X0, 0.16, Z1 - Z0, floorMat, (X0 + X1) / 2, FLOOR - 0.08, (Z0 + Z1) / 2);
  // 入口地垫
  const matTex = canvasTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a4553'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5f6f80'; ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#7d8ea0';
    ctx.font = `bold 30px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('いらっしゃいませ', w / 2, h / 2);
  });
  const doormat = new THREE.Mesh(planeGeo(2.4, 1.0), new THREE.MeshBasicMaterial({ map: matTex, transparent: true }));
  doormat.rotation.x = -Math.PI / 2;
  doormat.position.set(4.35, FLOOR + 0.001, -0.55);
  g.add(doormat);

  /* ---------- 天花板 ---------- */
  const ct = ceilTex();
  const ceilMat = toon(0xbcc2be, { map: ct, steps: [0.48, 0.68, 0.84, 0.95, 1.0], emissive: 0x2e2c26, emissiveIntensity: 1.0 });
  box(g, X1 - X0, 0.10, Z1 - Z0, ceilMat, (X0 + X1) / 2, H - 0.05, (Z0 + Z1) / 2);

  /* ---------- 后墙 / 侧墙 ---------- */
  box(g, X1 - X0, H, 0.18, wallDim, (X0 + X1) / 2, H / 2, Z0 + 0.09);        // 后
  box(g, 0.18, H, Z1 - Z0, toon(0xb6b0a2, { steps: [0.40, 0.60, 0.78, 0.92, 1.0] }), X1 - 0.09, H / 2, (Z0 + Z1) / 2);       // 右
  box(g, 0.18, H, Z1 - Z0, toon(0xb6b0a2, { steps: [0.40, 0.60, 0.78, 0.92, 1.0] }), X0 + 0.09, H / 2, (Z0 + Z1) / 2);       // 左

  /* ---------- 屋顶 ---------- */
  // 深色防水屋面（避免顶面过曝，与白墙形成层次）
  const roofMat = toon(0x5a6272, { steps: [0.34, 0.58, 0.80, 0.94, 1.0] });
  box(g, X1 - X0 + 0.40, 0.22, Z1 - Z0 + 0.40, roofMat, (X0 + X1) / 2, H + 0.11, (Z0 + Z1) / 2);
  // 屋顶女儿墙
  const paraMat = toon(0x8e948e, { steps: [0.36, 0.58, 0.80, 1.0] });
  const pw = 0.10, ph = 0.26;
  box(g, X1 - X0 + 0.42, ph, pw, paraMat, (X0 + X1) / 2, H + 0.24, Z1 + 0.16);
  box(g, X1 - X0 + 0.42, ph, pw, paraMat, (X0 + X1) / 2, H + 0.24, Z0 - 0.16);
  box(g, pw, ph, Z1 - Z0 + 0.42, paraMat, X1 + 0.16, H + 0.24, (Z0 + Z1) / 2);
  box(g, pw, ph, Z1 - Z0 + 0.42, paraMat, X0 - 0.16, H + 0.24, (Z0 + Z1) / 2);
  // 屋顶上的设备（空调室外机、通风管、水箱）
  box(g, 0.62, 0.36, 0.46, toon(0xc2c6c8, { steps: [0.5, 0.8, 1] }), X0 + 1.3, H + 0.40, Z0 + 1.4);
  box(g, 0.50, 0.30, 0.40, toon(0xc2c6c8, { steps: [0.5, 0.8, 1] }), X0 + 2.2, H + 0.37, Z0 + 1.2);
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), toon(0x9aa0a8, { steps: [0.5, 0.8, 1] }), X1 - 1.1, H + 0.66, Z0 + 1.1);
  add(g, new THREE.CylinderGeometry(0.30, 0.30, 0.55, 12), toon(0xa8b0b8, { steps: [0.48, 0.76, 1] }), X1 - 2.2, H + 0.49, Z0 + 0.9);
  // 天窗小灯
  add(g, new THREE.CylinderGeometry(0.14, 0.14, 0.06, 10), glowMat(0xfff0d0, 1.5), 3.4, H + 0.25, Z0 + 0.7);

  // 屋檐雨棚
  const canopyMat = toon(0xb6bcc2, { steps: [0.45, 0.72, 0.92, 1.0] });
  box(g, X1 - X0 + 0.5, 0.11, 0.78, canopyMat, (X0 + X1) / 2, H + 0.17, Z1 + 0.33);
  // 雨棚下沿装饰条（暖光带）
  box(g, X1 - X0 + 0.5, 0.15, 0.055, glowMat(0xffb066, 1.5), (X0 + X1) / 2, H + 0.075, Z1 + 0.70);
  // 雨棚支撑柱
  for (const x of [X0 + 0.12, X1 - 0.12]) {
    add(g, new THREE.CylinderGeometry(0.045, 0.045, H + 0.16, 8),
      toon(C.metalDark, { steps: [0.4, 0.7, 1.0] }), x, (H + 0.16) / 2, Z1 + 0.66);
  }

  /* ---------- 招牌（灯箱，可闪烁） ---------- */
  const signTex = makeSignTex();
  const signGeo = boxGeo(X1 - X0 - 0.4, 0.72, 0.18);
  const signFaceMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: true });
  const signBoxMat = toon(0xe8ebe8, { steps: [0.6, 0.85, 1.0] });
  const signMats = [signBoxMat, signBoxMat, signBoxMat, signBoxMat, signFaceMat, signBoxMat];
  const sign = new THREE.Mesh(signGeo, signMats);
  sign.position.set((X0 + X1) / 2, H + 0.62, Z1 + 0.04);
  g.add(sign);
  G.signFace = signFaceMat;
  G.sign = sign;

  // 招牌外框
  box(g, X1 - X0 - 0.28, 0.78, 0.22, toon(0xb9bfc4, { steps: [0.45, 0.72, 0.95, 1] }), (X0 + X1) / 2, H + 0.62, Z1 + 0.0);
  // 重新放招牌面到前面
  sign.position.z = Z1 + 0.13;

  /* 招牌不额外投点光：灯箱面自身亮度配合 Bloom 已足够，
     门口亮度由雨棚灯带（自发光）与地面光池贴片承载。 */
  G.signLight = null;

  /* ---------- 店招侧灯箱（侧街可见） ---------- */
  const sideBoxTex = canvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f7f8f5'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8853a'; ctx.fillRect(0, h - 16, w, 16);
    ctx.fillStyle = '#2f8a6e'; ctx.fillRect(0, 0, 14, h);
    ctx.fillStyle = '#22303f';
    ctx.font = `bold 62px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('コンビニ', w / 2, h / 2 - 4);
  });
  const sideSign = new THREE.Mesh(boxGeo(0.14, 0.40, 2.0), [
    new THREE.MeshBasicMaterial({ map: sideBoxTex }),
    new THREE.MeshBasicMaterial({ map: sideBoxTex }),
    toon(0xe8ebe8, { steps: [0.6, 0.85, 1] }),
    toon(0xe8ebe8, { steps: [0.6, 0.85, 1] }),
    new THREE.MeshBasicMaterial({ map: sideBoxTex }),
    new THREE.MeshBasicMaterial({ map: sideBoxTex }),
  ]);
  sideSign.position.set(X1 + 0.55, H - 0.55, 0.05);
  sideSign.rotation.y = Math.PI / 2;
  g.add(sideSign);

  /* ---------- 三色带（玻璃上方） ---------- */
  const bandTex = stripeBandTex();
  bandTex.wrapS = THREE.RepeatWrapping;
  bandTex.repeat.set(6, 1);
  const bandMat = new THREE.MeshBasicMaterial({ map: bandTex });
  box(g, X1 - X0 - 0.2, 0.16, 0.05, bandMat, (X0 + X1) / 2, H - 0.24, Z1 + 0.02);
  // 侧墙包边
  const bandTex2 = stripeBandTex();
  bandTex2.wrapS = THREE.RepeatWrapping; bandTex2.repeat.set(4, 1);
  const bandMat2 = new THREE.MeshBasicMaterial({ map: bandTex2 });
  box(g, 0.05, 0.16, Z1 - Z0 - 0.4, bandMat2, X0 - 0.01, H - 0.24, (Z0 + Z1) / 2);

  /* ---------- 玻璃幕墙 + 窗框 ---------- */
  const frameMat = toon(0x8e959e, { steps: [0.45, 0.72, 0.94, 1.0] });
  const glass = glassMat(0x9fd0da, 0.055);
  const GH0 = FLOOR + 0.12, GH1 = H - 0.36;      // 玻璃下沿/上沿
  const gh = GH1 - GH0;

  // 竖向分隔
  const mullions = [X0 + 0.1, 2.55, 5.9, X1 - 0.1];
  for (const x of mullions) {
    box(g, 0.10, gh + 0.2, 0.14, frameMat, x, (GH0 + GH1) / 2, Z1 - 0.02);
  }
  // 横向
  box(g, X1 - X0 - 0.1, 0.12, 0.14, frameMat, (X0 + X1) / 2, GH0, Z1 - 0.02);
  box(g, X1 - X0 - 0.1, 0.14, 0.16, frameMat, (X0 + X1) / 2, GH1 + 0.07, Z1 - 0.02);
  // 自动门框
  box(g, 2.6, 0.10, 0.16, frameMat, 4.35, GH1 + 0.07, Z1 - 0.04);

  // 玻璃板（左中右三块 + 门）
  const glassMeshes = [];
  const glassPanel = (x0, x1, h0, h1) => {
    const m = new THREE.Mesh(planeGeo(x1 - x0, h1 - h0), glass);
    m.position.set((x0 + x1) / 2, (h0 + h1) / 2, Z1 - 0.01);
    g.add(m);
    glassMeshes.push(m);
    return m;
  };
  glassPanel(X0 + 0.15, 2.50, GH0, GH1);
  glassPanel(2.60, 5.85, GH0, GH1 - 0.9);   // 门上沿固定玻璃
  glassPanel(5.95, X1 - 0.15, GH0, GH1);

  // 玻璃上的斜向反光贴片
  const glossTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g2 = ctx.createLinearGradient(0, h, w, 0);
    g2.addColorStop(0, 'rgba(255,255,255,0)');
    g2.addColorStop(0.42, 'rgba(200,235,255,0.22)');
    g2.addColorStop(0.5, 'rgba(230,248,255,0.42)');
    g2.addColorStop(0.58, 'rgba(200,235,255,0.22)');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  });
  for (const [x, w, hh, y] of [[1.2, 2.2, gh, (GH0 + GH1) / 2], [6.4, 1.1, gh, (GH0 + GH1) / 2]]) {
    const m = new THREE.Mesh(planeGeo(w, hh), new THREE.MeshBasicMaterial({
      map: glossTex, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.position.set(x, y, Z1 + 0.005);
    m.renderOrder = 6;
    g.add(m);
  }

  /* ---------- 自动门（可开合） ---------- */
  const doorMat = glassMat(0xbfe4ec, 0.07);
  const doorFrameMat = toon(0x9aa1aa, { steps: [0.5, 0.76, 0.96, 1] });
  const doorL = new THREE.Group(), doorR = new THREE.Group();
  const doorW = 1.24, doorH = 1.98;
  for (const [grp, sx] of [[doorL, -1], [doorR, 1]]) {
    const pane = new THREE.Mesh(planeGeo(doorW, doorH), doorMat);
    pane.position.z = 0;
    grp.add(pane);
    // 边框
    const fb = (w, hh, x, y) => {
      const m = new THREE.Mesh(boxGeo(w, hh, 0.06), doorFrameMat);
      m.position.set(x, y, 0); grp.add(m);
    };
    fb(doorW, 0.06, 0, doorH / 2, 0);
    fb(doorW, 0.06, 0, -doorH / 2, 0);
    fb(0.06, doorH, doorW / 2, 0, 0);
    fb(0.06, doorH, -doorW / 2, 0, 0);
    // 门把手/防撞条
    fb(doorW * 0.96, 0.04, 0, doorH * 0.06, 0.03);
    // 贴纸
    const stickerTex = canvasTex(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(40,120,90,0.9)';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.42, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold 30px ${JP_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('自動', w / 2, h / 2 - 12);
      ctx.fillText('ドア', w / 2, h / 2 + 18);
    });
    const st = new THREE.Mesh(planeGeo(0.26, 0.26), new THREE.MeshBasicMaterial({ map: stickerTex, transparent: true }));
    st.position.set(0, doorH * 0.24, 0.02);
    grp.add(st);

    grp.position.set(4.35 + sx * doorW / 2, GH0 + doorH / 2, Z1 - 0.003);
    g.add(grp);
  }
  G.doorL = doorL; G.doorR = doorR; G.doorBaseX = { L: 4.35 - doorW / 2, R: 4.35 + doorW / 2 };
  G.doorW = doorW;

  // 门口雨伞架
  buildUmbrellaStand(g, 6.62, 0.16, 1.62);
  // 门外垃圾桶
  buildTrashBins(g, 0.35, 0.16, 1.66);

  /* ---------- 室内照明（顶灯） ---------- */
  const ceilingLights = [];
  const lampTex = canvasTex(256, 128, (ctx, w, h) => {
    const g2 = ctx.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#fff4dc');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  });
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const x = -0.1 + i * 1.95, z = -1.3 - j * 2.6;
      const panel = new THREE.Mesh(planeGeo(1.5, 0.30), new THREE.MeshBasicMaterial({ map: lampTex, color: new THREE.Color(0xfff8ea).multiplyScalar(3.0) }));
      panel.rotation.x = Math.PI / 2;
      panel.position.set(x, H - 0.112, z);
      g.add(panel);
    }
  }
  // 店内主照明：4 盏，距离拉远以覆盖整个卖场（原 8 盏已合并）
  for (const [x, z, inten] of [[2.0, -0.6, 11.5], [4.9, -0.6, 10.5], [2.0, -3.9, 10.8], [4.9, -3.9, 10.0]]) {
    const L = new THREE.PointLight(0xfff2dc, inten, 9.5, 2);
    L.position.set(x, H - 0.30, z);
    g.add(L);
    ceilingLights.push(L);
  }
  G.ceilingLights = ceilingLights;

  /* ---------- 店内陈设 ---------- */
  buildInterior(g, G);

  /* ---------- 外墙细节 ---------- */
  // 空调外机（侧墙）
  buildACUnit(g, X0 - 0.42, 0.55, -3.6, Math.PI / 2);
  buildACUnit(g, X0 - 0.42, 0.55, -1.2, Math.PI / 2);
  // 电表箱
  box(g, 0.10, 0.55, 0.42, toon(0x9aa3ad, { steps: [0.5, 0.76, 1] }), X0 - 0.16, 1.9, -4.9);

  /* ---------- 左（侧街）墙细节 ---------- */
  {
    const wx = X0 - 0.02;
    const metalMat = toon(0x8e959e, { steps: [0.46, 0.72, 0.92, 1] });
    const darkMat = toon(0x4c5360, { steps: [0.42, 0.68, 0.92, 1] });

    // 高窗（磨砂，透出冷光）
    for (const [zz, yy, ww, hh] of [[-1.2, 2.42, 1.0, 0.52], [-3.4, 2.42, 1.2, 0.52]]) {
      box(g, 0.07, hh, ww, toon(0x2c333d, { steps: [0.42, 0.7, 1] }), wx - 0.02, yy, zz);
      const pane = new THREE.Mesh(planeGeo(ww - 0.1, hh - 0.1), new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x8fc4e8).multiplyScalar(0.55), transparent: true, opacity: 0.9,
      }));
      pane.position.set(wx - 0.06, yy, zz);
      pane.rotation.y = -Math.PI / 2;
      g.add(pane);
      // 玻璃分格
      for (let i = 1; i < 3; i++) {
        box(g, 0.04, hh - 0.08, 0.025, metalMat, wx - 0.065, yy, zz - (ww - 0.1) / 2 + (ww - 0.1) * i / 3);
      }
    }

    // 通风百叶（横向叶片）
    for (const [zz, yy] of [[-0.5, 1.55], [-4.2, 1.5]]) {
      box(g, 0.06, 0.42, 0.75, darkMat, wx - 0.02, yy, zz);
      for (let i = 0; i < 6; i++) {
        add(g, boxGeo(0.045, 0.028, 0.68), metalMat, wx - 0.055, yy - 0.18 + i * 0.07, zz);
      }
    }

    // 竖向落水管（带抱箍）
    add(g, new THREE.CylinderGeometry(0.045, 0.045, H + 0.2, 8), metalMat, wx - 0.10, (H + 0.2) / 2, 0.55);
    for (let i = 0; i < 4; i++) {
      add(g, new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), darkMat, wx - 0.10, 0.5 + i * 0.85, 0.55);
    }
    // 弯头
    add(g, new THREE.TorusGeometry(0.10, 0.042, 5, 10, Math.PI / 2), metalMat, wx - 0.10, H + 0.10, 0.44, 0, Math.PI / 2, 0);

    // 侧招牌支架
    for (const yy of [H + 0.10, H + 0.62]) {
      add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.42, 6), darkMat, wx - 0.2, yy, -2.4, 0, 0, Math.PI / 2);
    }

    // 后门台阶 + 小灯
    box(g, 0.62, 0.14, 1.02, toon(0x9a9384, { steps: [0.46, 0.72, 0.92, 1] }), X0 + 0.5, 0.07, Z0 - 0.30);
    add(g, new THREE.CylinderGeometry(0.055, 0.055, 0.10, 8), glowMat(0xffe0b0, 1.8), X0 + 0.5, 2.35, Z0 - 0.14, Math.PI / 2, 0, 0);
    /* 后门小灯改为纯自发光灯罩，省一盏点光 */

    // 墙脚油污 / 水渍（深色薄贴片）
    const stainTex = canvasTex(128, 128, (ctx, w, h) => {
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(40,44,52,0)');
      gr.addColorStop(0.55, 'rgba(38,42,50,0.55)');
      gr.addColorStop(1, 'rgba(30,34,42,0.85)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    });
    for (const zz of [-2.6, -0.9]) {
      const st = new THREE.Mesh(planeGeo(1.1, 0.42), new THREE.MeshBasicMaterial({
        map: stainTex, transparent: true, opacity: 0.55, depthWrite: false,
      }));
      st.position.set(wx - 0.012, 0.40, zz);
      st.rotation.y = -Math.PI / 2;
      g.add(st);
    }
  }

  // 后门
  box(g, 0.94, 1.94, 0.08, toon(0x8f959c, { steps: [0.5, 0.76, 1] }), X0 + 0.5, 1.12, Z0 - 0.05);

  return { group: g, G };
}

/* ================= 室内 ================= */
function buildInterior(g, G) {
  const IN = group(g, 'interior');

  /* ---------- 后墙：饮料冷柜（3 门） ---------- */
  const fridgeTex = drinkFridgeTex();
  const fridgeGroup = group(IN, 'fridges');
  const FX0 = 0.55, FW = 0.86, FH = 2.20;
  for (let i = 0; i < 5; i++) {
    const x = FX0 + i * (FW + 0.05);
    // 冷柜内部发光面板
    const pane = new THREE.Mesh(planeGeo(FW - 0.06, FH - 0.1), new THREE.MeshBasicMaterial({
      map: fridgeTex, color: new THREE.Color(0xffffff).multiplyScalar(1.10),
    }));
    pane.position.set(x + FW / 2, FLOOR + FH / 2, Z0 + 0.19);
    IN.add(pane);
    // 门框
    const fm = toon(0x2f3640, { steps: [0.4, 0.7, 1.0] });
    box(IN, 0.055, FH, 0.06, fm, x, FLOOR + FH / 2, Z0 + 0.22);
    box(IN, FW, 0.05, 0.06, fm, x + FW / 2, FLOOR + FH, Z0 + 0.22);
    box(IN, FW, 0.05, 0.06, fm, x + FW / 2, FLOOR + 0.02, Z0 + 0.22);
    // 玻璃门
    const gl = new THREE.Mesh(planeGeo(FW - 0.07, FH - 0.1), glassMat(0xc0dcf0, 0.05));
    gl.position.set(x + FW / 2, FLOOR + FH / 2, Z0 + 0.235);
    IN.add(gl);
    // 门把手
    box(IN, 0.035, 0.5, 0.035, toon(0xbfc7d0, { steps: [0.55, 0.85, 1] }), x + FW - 0.12, FLOOR + FH * 0.55, Z0 + 0.27);
  }
  // 冷柜顶箱
  box(IN, 5 * (FW + 0.05) + 0.1, 0.30, 0.34, toon(0xd6d9d2, { steps: [0.52, 0.78, 0.94, 1] }),
    FX0 + (5 * (FW + 0.05)) / 2 - 0.02, FLOOR + FH + 0.15, Z0 + 0.2);
  // 冷柜已用自发光面板承载亮度，不再单独放点光（省一盏）


  /* ---------- 中岛：双排货架 ---------- */
  const shelfMat = toon(0xc8c2b2, { steps: [0.50, 0.72, 0.88, 1.0], emissive: 0x221e15, emissiveIntensity: 1.0 });
  const shelfSide = toon(0xaea89a, { steps: [0.46, 0.70, 0.88, 1] });

  function gondola(cx, cz, len, ry = 0) {
    const gg = group(IN, 'gondola');
    gg.position.set(cx, 0, cz);
    gg.rotation.y = ry;
    const H1 = 1.62, shelves = 5;
    // 端架/侧板
    box(gg, 0.5, H1, len, shelfSide, 0, FLOOR + H1 / 2, 0);
    // 每层隔板 + 商品面
    for (let s = 0; s < shelves; s++) {
      const y = FLOOR + 0.20 + s * 0.31;
      box(gg, 0.56, 0.035, len - 0.04, shelfMat, 0, y, 0);
      // 两面商品
      for (const side of [-1, 1]) {
        // 复用共享材质：贴图重复通过预生成的少量变体承载，避免每层都 clone 出唯一材质
        const p = new THREE.Mesh(planeGeo(len - 0.12, 0.30), goodsMatFor(len));
        p.position.set(side * 0.255, y + 0.17, 0);
        p.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        gg.add(p);
      }
    }
    // 顶部广告牌
    const topTex = canvasTex(512, 64, (ctx, w, h) => {
      ctx.fillStyle = '#f2eee0'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d9532f'; ctx.fillRect(0, 0, w, 12);
      ctx.fillStyle = '#2f6fa8'; ctx.fillRect(0, h - 12, w, 12);
      ctx.fillStyle = '#3a3f4a';
      ctx.font = `bold 34px ${JP_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('お菓子 ・ インスタント', w / 2, h / 2 + 2);
    });
    for (const side of [-1, 1]) {
      const tp = new THREE.Mesh(planeGeo(len - 0.1, 0.28), new THREE.MeshBasicMaterial({ map: topTex }));
      tp.position.set(side * 0.27, FLOOR + H1 + 0.14, 0);
      tp.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      gg.add(tp);
    }
    return gg;
  }
  // 沿街横向排布：商品面朝向橱窗
  gondola(2.10, -1.75, 3.6, Math.PI / 2);
  gondola(2.10, -3.55, 3.6, Math.PI / 2);

  /* ---------- 靠墙货架（右侧墙） ---------- */
  const wallShelf = group(IN, 'wallShelf');
  for (let s = 0; s < 4; s++) {
    const y = FLOOR + 0.30 + s * 0.36;
    box(wallShelf, 0.44, 0.035, 4.2, shelfMat, X1 - 0.35, y, -3.0);
    const p = new THREE.Mesh(planeGeo(4.1, 0.32), goodsMatFor(4.1));
    p.position.set(X1 - 0.55, y + 0.18, -3.0);
    p.rotation.y = -Math.PI / 2;
    wallShelf.add(p);
  }
  box(wallShelf, 0.46, 1.86, 0.05, shelfSide, X1 - 0.35, FLOOR + 0.93, -0.9);
  box(wallShelf, 0.46, 1.86, 0.05, shelfSide, X1 - 0.35, FLOOR + 0.93, -5.1);

  /* ---------- 便当 / 饭团区（后部冷藏展示，靠后墙左侧） ---------- */
  const bentoGroup = group(IN, 'bento');
  const bTex = [bentoBoxTex(0), bentoBoxTex(1), bentoBoxTex(2), bentoBoxTex(3)];
  const bentoMats = bTex.map(t => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0xffffff).multiplyScalar(1.2) }));
  for (let row = 0; row < 2; row++) {
    const y = FLOOR + 1.02 + row * 0.42;
    box(bentoGroup, 1.9, 0.03, 0.46, shelfMat, X0 + 1.15, y, Z0 + 0.52);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(planeGeo(0.22, 0.15), bentoMats[(i + row) % 4]);
      m.rotation.x = -Math.PI / 2 + 0.55;
      m.position.set(X0 + 0.35 + i * 0.24, y + 0.10, Z0 + 0.62);
      bentoGroup.add(m);
    }
  }
  // 冷藏柜体
  box(bentoGroup, 2.0, 1.90, 0.62, toon(0xd4d8d0, { steps: [0.52, 0.78, 0.94, 1] }), X0 + 1.15, FLOOR + 0.95, Z0 + 0.34);
  // 顶部价签灯箱
  const priceTex = canvasTex(512, 96, (ctx, w, h) => {
    ctx.fillStyle = '#f2eee0'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9532f';
    ctx.font = `bold 40px ${JP_FONT}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('お弁当 ・ おにぎり', 16, h / 2);
    ctx.fillStyle = '#2f8a6e';
    ctx.beginPath(); ctx.arc(w - 60, h / 2, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold 24px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('新', w - 60, h / 2 + 1);
  });
  const pb = new THREE.Mesh(planeGeo(1.9, 0.28), new THREE.MeshBasicMaterial({ map: priceTex }));
  pb.position.set(X0 + 1.15, FLOOR + 2.02, Z0 + 0.66);
  bentoGroup.add(pb);

  /* ---------- 收银台 ---------- */
  const counter = group(IN, 'counter');
  const CX = 4.30, CZ = 0.15;
  box(counter, 3.6, 1.02, 0.68, toon(0xd2ccbc, { steps: [0.52, 0.74, 0.90, 1] }), CX, FLOOR + 0.51, CZ);
  box(counter, 3.68, 0.08, 0.76, toon(0x9a9280, { steps: [0.55, 0.8, 1] }), CX, FLOOR + 1.04, CZ);
  // 台面前带（彩色）
  box(counter, 3.6, 0.20, 0.03, toon(C.teal, { steps: [0.5, 0.8, 1], emissive: 0x0d2b22, emissiveIntensity: 0.5 }), CX, FLOOR + 0.88, CZ + 0.35);

  // 收银机 x2
  for (const [x, i] of [[3.35, 0], [5.35, 1]]) {
    box(counter, 0.52, 0.20, 0.40, toon(0x39414d, { steps: [0.4, 0.7, 1] }), x, FLOOR + 1.18, CZ + 0.02);
    const screen = new THREE.Mesh(planeGeo(0.34, 0.24), glowMat(0x8fe8ff, 1.6));
    screen.position.set(x, FLOOR + 1.45, CZ + 0.12);
    screen.rotation.x = -0.28;
    counter.add(screen);
    // 顾客屏
    const cs = new THREE.Mesh(planeGeo(0.24, 0.16), glowMat(0xbfefff, 1.2));
    cs.position.set(x, FLOOR + 1.30, CZ - 0.30);
    cs.rotation.y = Math.PI; cs.rotation.x = 0.2;
    counter.add(cs);
  }

  // 关东煮柜台（玻璃罩）
  const oden = group(counter, 'oden');
  box(oden, 1.05, 0.26, 0.52, toon(0x3a3f4a, { steps: [0.4, 0.7, 1] }), 2.72, FLOOR + 1.21, CZ + 0.04);
  box(oden, 1.0, 0.06, 0.48, glowMat(0xffcf7a, 1.3), 2.72, FLOOR + 1.37, CZ + 0.04);
  // 汤汁
  const soupMat = glowMat(0xd8a04a, 0.9, { opacity: 0.9, transparent: true });
  box(oden, 0.98, 0.03, 0.46, soupMat, 2.72, FLOOR + 1.40, CZ + 0.04);
  // 串/料
  const odenBits = [[-0.32, 0xf2ead0], [-0.14, 0xe8d9a8], [0.04, 0xc9a86a], [0.22, 0xf0e0b0], [0.38, 0xb8a070]];
  for (const [dx, col] of odenBits) {
    add(oden, sphereGeo(0.055, 8), toon(col, { steps: [0.6, 0.85, 1] }), 2.72 + dx, FLOOR + 1.43, CZ + 0.04, 0, 0, 0);
  }
  // 玻璃罩
  const hood = new THREE.Mesh(boxGeo(1.02, 0.34, 0.5), glassMat(0xd0e8f8, 0.06));
  hood.position.set(2.72, FLOOR + 1.58, CZ + 0.04);
  oden.add(hood);

  // 咖啡机
  const cmTex = coffeeMachineTex();
  box(counter, 0.44, 0.62, 0.42, toon(0x2b333d, { steps: [0.4, 0.7, 1] }), 6.35, FLOOR + 1.38, CZ + 0.0);
  const cmf = new THREE.Mesh(planeGeo(0.40, 0.40), new THREE.MeshBasicMaterial({ map: cmTex }));
  cmf.position.set(6.35, FLOOR + 1.42, CZ + 0.215);
  counter.add(cmf);

  // 热食柜
  box(counter, 0.62, 0.5, 0.44, toon(0x454c58, { steps: [0.4, 0.7, 1] }), 1.85, FLOOR + 1.33, CZ - 0.02);
  const hotGlass = new THREE.Mesh(boxGeo(0.60, 0.34, 0.42), glassMat(0xffe8c0, 0.06));
  hotGlass.position.set(1.85, FLOOR + 1.55, CZ - 0.02);
  counter.add(hotGlass);
  box(counter, 0.56, 0.05, 0.38, glowMat(0xffb968, 1.1), 1.85, FLOOR + 1.40, CZ - 0.02);

  // 柜台小物：袋子架、纸巾
  box(counter, 0.30, 0.34, 0.22, toon(0xdfe3e0, { steps: [0.55, 0.82, 1] }), 6.0, FLOOR + 1.24, CZ - 0.16);
  box(counter, 0.16, 0.14, 0.16, toon(0x8a6a48, { steps: [0.5, 0.8, 1] }), 2.3, FLOOR + 1.14, CZ + 0.14);

  /* ---------- 关东煮上方菜单板 ---------- */
  const mbTex = menuBoardTex();
  const mb = new THREE.Mesh(planeGeo(1.5, 0.75),
    new THREE.MeshBasicMaterial({ map: mbTex, color: new THREE.Color(0xffffff).multiplyScalar(0.95) }));
  mb.position.set(2.72, FLOOR + 2.32, CZ - 0.42);
  mb.rotation.y = Math.PI;
  counter.add(mb);

  /* ---------- 杂志架（靠左墙，低矮斜放，不遮挡橱窗） ---------- */
  const magTex = magazineTex();
  const mag = group(IN, 'magazine');
  const MX = X0 + 0.30, MZ0 = -0.2, MZ1 = -4.0;
  const magLen = MZ1 - MZ0;
  // 底座柜
  box(mag, 0.46, 0.80, Math.abs(magLen), toon(0xbfb9a8, { steps: [0.46, 0.68, 0.86, 1.0] }), MX, FLOOR + 0.40, (MZ0 + MZ1) / 2);
  // 三层斜面展示
  for (let i = 0; i < 3; i++) {
    const y = FLOOR + 0.86 + i * 0.34;
    const px = MX + 0.10 - i * 0.02;
    const m = new THREE.Mesh(planeGeo(Math.abs(magLen) - 0.1, 0.30), magazineMat());
    m.position.set(px, y, (MZ0 + MZ1) / 2);
    m.rotation.y = Math.PI / 2;
    m.rotation.x = -0.42;
    mag.add(m);
    // 隔板
    box(mag, 0.22, 0.03, Math.abs(magLen), toon(0xa8a292, { steps: [0.44, 0.68, 0.9, 1] }), px + 0.10, y - 0.13, (MZ0 + MZ1) / 2);
  }
  // 顶部小灯带
  box(mag, 0.10, 0.05, Math.abs(magLen) - 0.2, glowMat(0xfff0cc, 1.2), MX + 0.16, FLOOR + 1.92, (MZ0 + MZ1) / 2);

  /* ---------- 店内导视牌 ---------- */
  const guideTex = canvasTex(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#eef2f6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f6fa8'; ctx.fillRect(0, 0, w, 56);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 26px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('店内案内', w / 2, 30);
    const items = [['おにぎり', '↑'], ['お弁当', '→'], ['飲料', '←'], ['お菓子', '↑'], ['レジ', '↓']];
    let y = 92;
    for (const [t, a] of items) {
      ctx.fillStyle = '#3a3f4a';
      ctx.font = `24px ${JP_FONT}`;
      ctx.textAlign = 'left'; ctx.fillText(t, 26, y);
      ctx.fillStyle = '#d9532f';
      ctx.textAlign = 'right'; ctx.font = `bold 26px ${JP_FONT}`;
      ctx.fillText(a, w - 26, y);
      ctx.strokeStyle = '#c8d0da'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(16, y + 22); ctx.lineTo(w - 16, y + 22); ctx.stroke();
      y += 58;
    }
  });
  const gm = new THREE.Mesh(planeGeo(0.52, 0.78), new THREE.MeshBasicMaterial({ map: guideTex }));
  gm.position.set(0.35, FLOOR + 1.85, -2.6);
  gm.rotation.y = Math.PI / 2;
  IN.add(gm);
  box(IN, 0.04, 0.78, 0.04, toon(0x8f959c, { steps: [0.5, 0.8, 1] }), 0.33, FLOOR + 1.85, -2.6);

  /* ---------- 店内海报 ---------- */
  const posters = [posterTexA(), posterTexB(), posterTexC()];
  const pp = (tex, x, y, z, ry) => {
    const m = new THREE.Mesh(planeGeo(0.62, 0.92),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0xffffff).multiplyScalar(1.05) }));
    m.position.set(x, y, z); m.rotation.y = ry;
    IN.add(m);
    // 边框
    const f = new THREE.Mesh(boxGeo(0.68, 0.98, 0.02), toon(0x3a3f4a, { steps: [0.4, 0.7, 1] }));
    f.position.set(x - Math.sin(ry) * 0.012, y, z - Math.cos(ry) * 0.012);
    f.rotation.y = ry;
    IN.add(f);
  };
  pp(posters[0], 1.6, FLOOR + 1.85, Z0 + 0.22, 0);
  pp(posters[1], 0.42, FLOOR + 1.75, -3.6, Math.PI / 2);
  pp(posters[2], X1 - 0.2, FLOOR + 1.9, -1.7, -Math.PI / 2);

  /* ---------- 后场门（左后角） ---------- */
  box(IN, 0.80, 1.92, 0.05, toon(0xa8a49a, { steps: [0.5, 0.78, 1] }), X0 + 0.52, FLOOR + 0.96, Z0 + 0.24);
  box(IN, 0.84, 1.96, 0.03, toon(0x7f7c74, { steps: [0.5, 0.78, 1] }), X0 + 0.52, FLOOR + 0.96, Z0 + 0.26);
  // 门牌
  const doorSignTex = canvasTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#2f6fa8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 26px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('STAFF', w / 2, h / 2);
  });
  const dsm = new THREE.Mesh(planeGeo(0.24, 0.12), new THREE.MeshBasicMaterial({ map: doorSignTex }));
  dsm.position.set(X0 + 0.52, FLOOR + 1.72, Z0 + 0.28);
  IN.add(dsm);

  /* ---------- 储物柜 ---------- */
  for (let i = 0; i < 3; i++) {
    box(IN, 0.34, 0.62, 0.34, toon(0xb8bcc0, { steps: [0.5, 0.78, 1] }), X0 + 0.34, FLOOR + 0.31 + i * 0.64, -5.3);
  }

  /* ---------- 天花板后场灯带（冷白） ---------- */
  box(IN, 2.0, 0.05, 0.12, glowMat(0xdff0ff, 1.6), X0 + 1.1, H - 0.13, Z0 + 1.2);

  /* ---------- 店内地面导视箭头 ---------- */
  const arrowTex = canvasTex(64, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(60,120,180,0.55)';
    ctx.beginPath();
    ctx.moveTo(w / 2, 8); ctx.lineTo(w - 8, h * 0.5); ctx.lineTo(w * 0.68, h * 0.5);
    ctx.lineTo(w * 0.68, h - 8); ctx.lineTo(w * 0.32, h - 8); ctx.lineTo(w * 0.32, h * 0.5);
    ctx.lineTo(8, h * 0.5); ctx.closePath(); ctx.fill();
  });
  for (const [x, z] of [[3.4, 0.3], [5.2, 0.3]]) {
    const a = new THREE.Mesh(planeGeo(0.26, 0.52), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false }));
    a.rotation.x = -Math.PI / 2;
    a.position.set(x, FLOOR + 0.002, z);
    IN.add(a);
  }

  /* ---------- 在店门口内侧放一个小 POP 立牌 ---------- */
  const popTex = canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f7f4ea'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9532f'; ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 22px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('本日', w / 2, 22);
    ctx.fillStyle = '#2f6fa8';
    ctx.font = `bold 68px ${JP_FONT}`;
    ctx.fillText('100', w / 2, 108);
    ctx.fillStyle = '#3a3f4a';
    ctx.font = `bold 26px ${JP_FONT}`;
    ctx.fillText('円', w / 2, 158);
    ctx.fillStyle = '#d9532f';
    ctx.fillRect(16, 186, w - 32, 8);
    ctx.fillStyle = '#8a4bb8';
    ctx.font = `20px ${JP_FONT}`;
    ctx.fillText('SALE', w / 2, 218);
  });
  const pop = new THREE.Group();
  const popFace = new THREE.Mesh(planeGeo(0.30, 0.60), new THREE.MeshBasicMaterial({ map: popTex }));
  popFace.position.set(0, 0.44, 0);
  pop.add(popFace);
  const popBack = popFace.clone();
  popBack.rotation.y = Math.PI; popBack.position.z = -0.01;
  pop.add(popBack);
  box(pop, 0.32, 0.02, 0.06, toon(0x8f959c, { steps: [0.5, 0.8, 1] }), 0, 0.14, 0);
  pop.position.set(2.95, FLOOR, 0.12);
  pop.rotation.y = -0.4;
  IN.add(pop);

  /* ---------- 室内 AO 阴影 ---------- */
  contactShadow(IN, 4.0, 3.0, 0.16, 2.6, FLOOR + 0.004, -2.5);
  contactShadow(IN, 3.6, 0.9, 0.15, 4.6, FLOOR + 0.005, -0.55);

  return IN;
}

/* ================= 外部小件 ================= */
function buildUmbrellaStand(g, x, y, z) {
  const grp = group(g, 'umbrellaStand');
  grp.position.set(x, y, z);
  const mat = toon(0x6d7583, { steps: [0.45, 0.74, 1] });
  // 桶
  add(grp, new THREE.CylinderGeometry(0.20, 0.17, 0.52, 14, 1, true), mat, 0, 0.26, 0);
  add(grp, new THREE.CylinderGeometry(0.21, 0.21, 0.03, 14), mat, 0, 0.53, 0);
  add(grp, new THREE.CylinderGeometry(0.17, 0.17, 0.02, 14), mat, 0, 0.02, 0);
  // 伞
  const umbCols = [0x2f4f7a, 0xc9463f, 0x2f7f6c, 0x3a3f4a];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6;
    const rx = Math.cos(a) * 0.07, rz = Math.sin(a) * 0.07;
    const u = add(grp, new THREE.CylinderGeometry(0.018, 0.012, 0.78, 6),
      toon(umbCols[i], { steps: [0.5, 0.8, 1] }), rx, 0.40, rz, 0.06 * (i - 1.5), 0, 0.05 * (i - 1.5));
    // 伞布
    add(grp, new THREE.CylinderGeometry(0.02, 0.10, 0.30, 8), toon(umbCols[i], { steps: [0.5, 0.8, 1] }), rx, 0.55, rz);
    // 弯把手
    add(grp, new THREE.TorusGeometry(0.045, 0.014, 4, 10, Math.PI), toon(0x6b4b32, { steps: [0.5, 0.8, 1] }), rx, 0.80, rz, 0, a, 0);
  }
  return grp;
}

function buildTrashBins(g, x, y, z) {
  const grp = group(g, 'trash');
  grp.position.set(x, y, z);
  const bodyMat = toon(0x4d5563, { steps: [0.45, 0.74, 1] });
  const labels = [
    ['もえる', 0xc9463f], ['ペット', 0x2f7f6c], ['かん', 0x2f6fa8],
  ];
  for (let i = 0; i < 3; i++) {
    const bx = i * 0.34 - 0.34;
    box(grp, 0.30, 0.72, 0.32, bodyMat, bx, 0.36, 0);
    // 投入口
    box(grp, 0.22, 0.10, 0.05, toon(0x1a1e26, { steps: [0.4, 0.7, 1] }), bx, 0.60, 0.17);
    // 标签
    const tex = canvasTex(64, 64, (ctx, w, h) => {
      ctx.fillStyle = `#${labels[i][1].toString(16).padStart(6, '0')}`;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = `bold 20px ${JP_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(labels[i][0], w / 2, h / 2);
    });
    const lab = new THREE.Mesh(planeGeo(0.26, 0.16), new THREE.MeshBasicMaterial({ map: tex }));
    lab.position.set(bx, 0.34, 0.165);
    grp.add(lab);
  }
  // 顶盖
  box(grp, 1.02, 0.05, 0.36, toon(0x5c6472, { steps: [0.5, 0.78, 1] }), -0.02, 0.75, 0);
  return grp;
}

function buildACUnit(g, x, y, z, ry) {
  const grp = group(g, 'ac');
  grp.position.set(x, y, z);
  grp.rotation.y = ry;
  const mat = toon(0xc8ccd0, { steps: [0.55, 0.82, 1] });
  box(grp, 0.30, 0.60, 0.86, mat, 0, 0, 0);
  // 风扇格栅
  add(grp, new THREE.CylinderGeometry(0.21, 0.21, 0.03, 16), toon(0x8a9098, { steps: [0.45, 0.75, 1] }), 0.16, 0.06, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    add(grp, new THREE.TorusGeometry(0.18 - i * 0.035, 0.012, 4, 14),
      toon(0x6a7078, { steps: [0.45, 0.75, 1] }), 0.175, 0.06, 0, 0, 0, Math.PI / 2);
  }
  // 支架
  box(grp, 0.06, 0.28, 0.06, toon(0x6a7078, { steps: [0.45, 0.75, 1] }), -0.10, -0.40, -0.32);
  box(grp, 0.06, 0.28, 0.06, toon(0x6a7078, { steps: [0.45, 0.75, 1] }), -0.10, -0.40, 0.32);
  return grp;
}
