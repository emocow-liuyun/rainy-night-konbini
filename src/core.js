/* =========================================================
   core.js — 色板 / 卡通材质 / 几何工具 / Canvas 贴图
   ========================================================= */
import * as THREE from '../vendor/three.module.js';

export const LAYER = { MAIN: 0, NO_REFLECT: 2 };

/* ---------------- 色板（柔和的日式夜景） ---------------- */
export const C = {
  baseDark:   0x101219,
  baseTop:    0x191d26,
  brass:      0xa9884a,

  asphalt:    0x161a23,
  asphaltHi:  0x202634,
  sidewalk:   0x343b4a,
  sidewalk2:  0x2a3140,
  curb:       0x596274,
  concrete:   0x4b5263,
  concreteHi: 0x5d6577,

  wall:       0xebe6d8,
  wallDim:    0xcfc9ba,
  wallSide:   0xdad4c4,

  teal:       0x2f7f6c,
  tealDark:   0x1c5849,
  orange:     0xdf7c30,
  red:        0xc9463f,
  yellow:     0xf0c04a,

  glass:      0x9fd8dd,
  metal:      0x99a2b0,
  metalDark:  0x39404d,
  metalLight: 0xb8c0cc,

  warm:       0xffd9a5,
  warmStrong: 0xfff0cc,
  cool:       0xcfe2ff,
  coolDeep:   0x5f86c4,

  neonPink:   0xff5f9e,
  neonCyan:   0x4fe3e0,
  neonRed:    0xff4d4d,
  neonViolet: 0x9b6bff,

  paper:      0xf4f1e8,
  wood:       0x6b4b32,
  woodDark:   0x4a3323,
  cloth:      0x2c3b4f,
  green:      0x3f7d4a,
};

/* ---------------- 渐变贴图（toon 分级） ---------------- */
const gradCache = new Map();
export function gradientMap(steps = [0.16, 0.42, 0.68, 0.88, 1.0]) {
  const key = steps.join(',');
  if (gradCache.has(key)) return gradCache.get(key);
  const n = steps.length;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.round(steps[i] * 255);
    data[i * 4 + 0] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  gradCache.set(key, tex);
  return tex;
}

/* ---------------- 材质 ---------------- */
const matCache = new Map();
function cached(key, make) {
  if (matCache.has(key)) return matCache.get(key);
  const m = make();
  matCache.set(key, m);
  return m;
}

/** 卡通材质 */
export function toon(color, o = {}) {
  const { steps, emissive, emissiveIntensity = 1, map, opacity = 1, transparent = false, side, key } = o;
  const k = key || `t|${color}|${steps || ''}|${emissive || ''}|${emissiveIntensity}|${map ? map.uuid : ''}|${opacity}|${transparent}|${side || ''}`;
  return cached(k, () => {
    const m = new THREE.MeshToonMaterial({
      color,
      gradientMap: gradientMap(steps),
      map: map || null,
      transparent,
      opacity,
    });
    if (emissive !== undefined) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
    if (side !== undefined) m.side = side;
    return m;
  });
}

/** 自发光/灯箱材质（不受光照，可超过 1.0 触发泛光） */
export function glowMat(color, intensity = 1, o = {}) {
  const { map = null, opacity = 1, transparent = false, side = THREE.FrontSide, blending = THREE.NormalBlending, depthWrite = true, key } = o;
  const k = key || `g|${color}|${intensity}|${map ? map.uuid : ''}|${opacity}|${transparent}|${side}|${blending}|${depthWrite}`;
  return cached(k, () => {
    const c = new THREE.Color(color).multiplyScalar(intensity);
    const m = new THREE.MeshBasicMaterial({
      color: c, map, transparent, opacity, side, blending, depthWrite, fog: true,
    });
    return m;
  });
}

/** 透明玻璃 */
export function glassMat(color = C.glass, opacity = 0.16) {
  return cached(`glass|${color}|${opacity}`, () => new THREE.MeshPhysicalMaterial({
    color, transparent: true, opacity, roughness: 0.08, metalness: 0.0,
    transmission: 0.0, side: THREE.DoubleSide, depthWrite: false,
    blending: THREE.NormalBlending, clearcoat: 1, clearcoatRoughness: 0.1,
  }));
}

/* ---------------- 几何缓存 ---------------- */
const geoCache = new Map();
export function boxGeo(w, h, d) {
  const k = `b${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function cylGeo(rt, rb, h, seg = 12, open = false) {
  const k = `c${rt.toFixed(4)},${rb.toFixed(4)},${h.toFixed(4)},${seg},${open}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  return geoCache.get(k);
}
export function planeGeo(w, h) {
  const k = `p${w.toFixed(4)},${h.toFixed(4)}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.PlaneGeometry(w, h));
  return geoCache.get(k);
}
export function sphereGeo(r, seg = 12) {
  const k = `s${r.toFixed(4)},${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.SphereGeometry(r, seg, seg * 0.6 | 0));
  return geoCache.get(k);
}

/* ---------------- 放置工具 ---------------- */
export function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = false; m.receiveShadow = false;
  parent.add(m);
  return m;
}

export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) {
  return add(parent, boxGeo(w, h, d), mat, x, y, z, 0, ry, 0);
}

export function slab(parent, w, d, mat, x = 0, y = 0, z = 0) {
  return add(parent, planeGeo(w, d), mat, x, y, z, -Math.PI / 2, 0, 0);
}

export function wallX(parent, w, h, mat, x, y, z, ry = 0) {
  return add(parent, planeGeo(w, h), mat, x, y, z, 0, ry, 0);
}

export function cyl(parent, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 12, rx = 0, rz = 0) {
  return add(parent, cylGeo(rt, rb, h, seg), mat, x, y, z, rx, 0, rz);
}

export function group(parent, name = 'g') {
  const g = new THREE.Group();
  g.name = name;
  parent.add(g);
  return g;
}

/** 沿曲线生成管状电线 */
export function tube(parent, pts, radius, mat, seg = 40, radial = 4) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  return add(parent, geo, mat, 0, 0, 0);
}

/* ---------------- 递归设置图层（不进反射） ---------------- */
export function setLayer(obj, layer) {
  obj.traverse(o => o.layers.set(layer));
  return obj;
}
export function noReflect(obj) { return setLayer(obj, LAYER.NO_REFLECT); }

/* ---------------- Canvas 贴图 ---------------- */
export const JP_FONT = '"Noto Sans CJK JP","Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif';

export function canvasTex(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  if (opts.repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(opts.repeat[0], opts.repeat[1]); }
  tex.needsUpdate = true;
  return tex;
}

/** 圆形柔光贴图（用于泛光精灵） */
let _glowTex = null;
export function glowTex() {
  if (_glowTex) return _glowTex;
  _glowTex = canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.13)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return _glowTex;
}

export function glowSprite(parent, color, size, intensity = 1, x = 0, y = 0, z = 0) {
  const mat = new THREE.SpriteMaterial({
    map: glowTex(), color: new THREE.Color(color).multiplyScalar(intensity),
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    depthTest: true, fog: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  sp.position.set(x, y, z);
  parent.add(sp);
  return sp;
}

/** 接触阴影（乘法混合的径向渐变） */
let _shadowTex = null;
export function shadowTex() {
  if (_shadowTex) return _shadowTex;
  _shadowTex = canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return _shadowTex;
}

const shadowMatCache = new Map();
export function contactShadow(parent, w, d, op = 0.55, x = 0, y = 0.002, z = 0, rot = 0) {
  const k = `${op.toFixed(2)}`;
  let mat = shadowMatCache.get(k);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      map: shadowTex(), transparent: true, opacity: op,
      blending: THREE.MultiplyBlending, depthWrite: false,
      color: new THREE.Color(op, op, op),
    });
    shadowMatCache.set(k, mat);
  }
  const m = new THREE.Mesh(planeGeo(w, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(-Math.PI / 2, 0, rot);
  m.renderOrder = 1;
  parent.add(m);
  return m;
}

/* ---------------- 实例化小商品批量器 ---------------- */
export class Batch {
  constructor() { this.items = []; }
  push(x, y, z, sx, sy, sz, color, ry = 0) {
    this.items.push({ x, y, z, sx, sy, sz, color, ry });
  }
  build(parent, mat) {
    const n = this.items.length;
    if (!n) return null;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(geo, mat, n);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      e.set(0, it.ry, 0);
      q.setFromEuler(e);
      mtx.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx, it.sy, it.sz));
      im.setMatrixAt(i, mtx);
      col.set(it.color);
      im.setColorAt(i, col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    parent.add(im);
    return im;
  }
}
