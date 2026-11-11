/* =========================================================
   batch.js — 静态几何合批
   把大量独立 Mesh 按「材质」合并成单个 Mesh，把 draw call
   从 900+ 压到几十。仅处理静态对象：跳过动画部件、透明物体、
   多材质、InstancedMesh、Sprite、以及带自定义 shader 的对象。
   ========================================================= */
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

/* 这些名字下的子树会被排除（有动画或需要独立存在） */
const SKIP_NAME_RE = /autoDoor|door[LR]|sign$|rain|splash|ripple|drip|glassRain|wet|sky|cityGlow|haze|backdrop|sprite|instance|gondola_anim|traffic/i;

/* 逐对象判断能否参与合批 */
function canBatch(mesh, root, protect) {
  if (!mesh.isMesh) return false;
  if (mesh.isInstancedMesh) return false;
  if (mesh.isSkinnedMesh) return false;
  if (Array.isArray(mesh.material)) return false;

  const m = mesh.material;
  if (!m) return false;
  // 透明物体：仅当使用加法混合且不写深度时才能安全合批
  // （加法混合与顺序无关，且 depthWrite=false 不参与遮挡排序）
  if (m.transparent) {
    const additive = (m.blending === THREE.AdditiveBlending);
    if (!additive || m.depthWrite !== false) return false;
    if (m.isShaderMaterial) return false;
  }
  if (m.opacity <= 0) return false;
  // 自定义 shader（雨、湿地面、水面）
  if (m.isShaderMaterial) return false;
  // 只合并不透明的基础/卡通/标准材质
  if (!(m.isMeshToonMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshStandardMaterial)) return false;

  // 带 glow 的 Basic 材质（灯箱等）亮度会影响 Bloom，保留独立也可，但可合批
  // 显式保护的动画对象（及其子树）跳过
  let p = mesh;
  while (p && p !== root) {
    if (protect.has(p)) return false;
    if (p.name && SKIP_NAME_RE.test(p.name)) return false;
    p = p.parent;
  }

  // 必须有 position / normal / uv 三件套才能安全合并
  const g = mesh.geometry;
  if (!g || !g.attributes.position || !g.attributes.normal || !g.attributes.uv) return false;
  // 非索引几何也允许（merge 会处理），但要有 index 或 drawRange 完整
  if (g.index === null && g.attributes.position.count === 0) return false;

  return true;
}

/* 把 geometry 的法线/uv 缺失补齐，并归一化属性集合，避免 merge 失败 */
function normalize(geo) {
  let g = geo.clone();
  if (!g.attributes.uv && g.attributes.position) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (!g.attributes.normal && g.attributes.position) {
    g.computeVertexNormals();
  }
  // 统一属性集为 position / normal / uv —— 本项目无材质启用 vertexColors，
  // 剥离 color/uv2/tangent 既能保证 merge 成功，也不会改变外观
  for (const key of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(key)) {
      g.deleteAttribute(key);
    }
  }
  // 统一成非索引，避免 index 类型/数量不匹配
  if (g.index) g = g.toNonIndexed();
  return g;
}

/* 计算世界矩阵（含父级层级） */
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

function worldMatrix(obj, root) {
  const chain = [];
  let p = obj;
  while (p && p !== root) { chain.push(p); p = p.parent; }
  const m = new THREE.Matrix4();
  for (let i = chain.length - 1; i >= 0; i--) {
    chain[i].updateMatrix();
    m.multiply(chain[i].matrix);
  }
  return m;
}

/**
 * 对 root 下的静态 mesh 做合批。
 * @returns {{ before:number, after:number, mergedMeshes:number, groups:number }}
 */
export function batchStatic(root, opts = {}) {
  const { verbose = false, exclude = [] } = opts;
  const protect = new WeakSet();
  for (const o of exclude) if (o) protect.add(o);

  root.updateMatrixWorld(true);

  // 收集候选，按材质分组
  const groups = new Map();  // material -> [{mesh, matrix}]
  const candidates = [];

  root.traverse((o) => {
    if (canBatch(o, root, protect)) candidates.push(o);
  });

  for (const mesh of candidates) {
    const mat = mesh.material;
    if (!groups.has(mat)) groups.set(mat, []);
    groups.get(mat).push(mesh);
  }

  let mergedCount = 0;
  let groupCount = 0;
  const toRemove = [];

  for (const [mat, meshes] of groups) {
    // 单个的没必要合并（合并反而多一层开销）
    if (meshes.length < 2) continue;

    const geos = [];
    for (const mesh of meshes) {
      let g;
      try {
        g = normalize(mesh.geometry);
      } catch (e) {
        continue;
      }
      // 把世界变换烘进顶点
      mesh.updateMatrixWorld(true);
      g.applyMatrix4(mesh.matrixWorld);
      geos.push(g);
    }
    if (geos.length < 2) { geos.forEach(g => g.dispose()); continue; }

    let merged;
    try {
      merged = mergeGeometries(geos, false);
    } catch (e) {
      geos.forEach(g => g.dispose());
      continue;
    }
    geos.forEach(g => g.dispose());
    if (!merged) continue;

    merged.computeBoundingSphere();
    merged.computeBoundingBox();

    const newMesh = new THREE.Mesh(merged, mat);
    newMesh.name = `batch_${groupCount++}`;
    newMesh.castShadow = false;
    newMesh.receiveShadow = false;
    newMesh.frustumCulled = true;
    newMesh.renderOrder = meshes[0].renderOrder || 0;
    newMesh.matrixAutoUpdate = false;
    newMesh.updateMatrix();
    root.add(newMesh);

    for (const mesh of meshes) toRemove.push(mesh);
    mergedCount += meshes.length;
  }

  // 移除被合并的原 mesh
  for (const mesh of toRemove) {
    if (mesh.parent) mesh.parent.remove(mesh);
    // 几何体和材质由缓存/合批结果持有，不在这里 dispose（避免误删共享资源）
  }

  const info = {
    candidates: candidates.length,
    mergedMeshes: mergedCount,
    groups: groupCount,
    removed: toRemove.length,
  };
  if (verbose) console.log('[batch]', info);
  return info;
}
