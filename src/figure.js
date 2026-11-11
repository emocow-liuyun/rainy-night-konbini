/* =========================================================
   figure.js — 高精度行人模型
   真实人体比例分段：头/颈/肩/胸/腰/胯/大腿/小腿/脚
                    上臂/前臂/手/手指
   每段独立 Group，可单独旋转，支持行走/站立/进店等状态
   ========================================================= */
import * as THREE from '../vendor/three.module.js';
import { toon, boxGeo, cylGeo, sphereGeo, contactShadow } from './core.js';

/* 人体比例（以身高 H 为基准，接近真实成人比例 7.5 头身） */
/* 全部是「相对 root 的绝对比例」，累计必须 = 1.0
   ankle(0.072) + shin(0.205) + thigh(0.240) = 胯 0.517
   胯 0.517 + 腰(0.115) + 胸(0.150) = 肩 0.782
   肩 0.782 + 颈(0.030) + 头(0.128) ≈ 0.94，余 0.06 给帽子/头发 */
export const PELVIS_Y = 0.517;   // pelvis 相对 root 的高度（= ankle+shin+thigh）

export const RATIO = {
  headH: 0.128,
  headW: 0.098,
  neckH: 0.030,
  shouldersY: 0.782,   // 肩线（相对 root）
  chestH: 0.150,
  waistH: 0.115,
  hipY: 0.517,
  thighL: 0.240,
  shinL: 0.205,
  ankleY: 0.072,       // 踝关节离地高度
  footH: 0.025,
  upperArmL: 0.145,
  foreArmL: 0.130,
  shoulderW: 0.215,
};

const SKIN = [0xe8c4a8, 0xdcb295, 0xf0cfb4, 0xc99a7a];
const HAIRS = [0x1a1715, 0x2b2118, 0x3d2b1c, 0x14110f, 0x4a3826];

/**
 * 构建高精度人形。
 * 返回 { root, joints, height, materials }
 */
export function buildFigure(opts = {}) {
  const {
    coat = 0x2f3a4d,
    pants = 0x1f242c,
    skin = SKIN[0],
    hair = HAIRS[0],
    umbrella = null,
    bag = false,
    hat = false,
    scarf = null,
    scale = 1.0,
  } = opts;

  /* 高度基准：成年人 1.68 缩放 */
  const H = 1.68 * scale;
  const R = RATIO;

  const root = new THREE.Group();
  root.name = 'figure';

  /* --- 材质（低饱和夜景色，靠 toon 台阶区分明暗） --- */
  const mCoat = toon(coat, { steps: [0.46, 0.68, 0.86, 0.96, 1.0], emissive: 0x0a0c10, emissiveIntensity: 1.0 });
  const mCoatDark = toon(new THREE.Color(coat).multiplyScalar(0.72).getHex(), { steps: [0.38, 0.60, 0.80, 0.93, 1.0] });
  const mPants = toon(pants, { steps: [0.42, 0.64, 0.84, 0.95, 1.0], emissive: 0x08090c, emissiveIntensity: 1.0 });
  const mSkin = toon(skin, { steps: [0.58, 0.78, 0.92, 1.0], emissive: 0x120e0a, emissiveIntensity: 1.0 });
  const mHair = toon(hair, { steps: [0.44, 0.66, 0.88, 1.0] });
  const mShoe = toon(0x14171c, { steps: [0.34, 0.60, 0.86, 1.0] });
  const mSole = toon(0x2a2e36, { steps: [0.36, 0.62, 0.88, 1.0] });
  const mBelt = toon(0x241f1b, { steps: [0.36, 0.62, 0.88, 1.0] });

  const joints = {};

  /* ============ 胯部（所有下半身的枢轴）============ */
  const pelvis = new THREE.Group();
  pelvis.position.y = H * PELVIS_Y;
  root.add(pelvis);
  joints.pelvis = pelvis;

  // 胯部块
  const pelvisMesh = new THREE.Mesh(
    boxGeo(H * 0.155, H * 0.085, H * 0.105), mPants);
  pelvisMesh.position.y = -H * 0.020;
  pelvis.add(pelvisMesh);

  /* ============ 腿 ============ */
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';

    // 髋关节
    const hipJoint = new THREE.Group();
    hipJoint.position.set(side * H * 0.042, -H * 0.030, 0);
    pelvis.add(hipJoint);
    joints['hip' + tag] = hipJoint;

    // 大腿
    const thigh = new THREE.Mesh(
      boxGeo(H * 0.080, H * R.thighL, H * 0.080), mPants);
    thigh.position.y = -H * R.thighL * 0.5;
    hipJoint.add(thigh);

    // 膝关节
    const knee = new THREE.Group();
    knee.position.y = -H * R.thighL;
    hipJoint.add(knee);
    joints['knee' + tag] = knee;

    // 小腿（上粗下细用两段近似）
    const shin = new THREE.Mesh(
      boxGeo(H * 0.066, H * R.shinL, H * 0.068), mPants);
    shin.position.y = -H * R.shinL * 0.5;
    knee.add(shin);

    // 踝关节
    const ankle = new THREE.Group();
    ankle.position.y = -H * R.shinL;
    knee.add(ankle);
    joints['ankle' + tag] = ankle;

    // 鞋（脚掌 + 鞋底 + 鞋头）
    const foot = new THREE.Mesh(
      boxGeo(H * 0.055, H * R.footH, H * 0.115), mShoe);
    foot.position.set(0, -H * 0.018, H * 0.028);
    ankle.add(foot);

    const sole = new THREE.Mesh(
      boxGeo(H * 0.058, H * 0.008, H * 0.120), mSole);
    sole.position.set(0, -H * 0.030, H * 0.028);
    ankle.add(sole);

    const toe = new THREE.Mesh(
      boxGeo(H * 0.052, H * 0.016, H * 0.030), mShoe);
    toe.position.set(0, -H * 0.022, H * 0.080);
    ankle.add(toe);
  }

  /* ============ 躯干 ============ */
  const spine = new THREE.Group();
  /* spine 在 pelvis 之上：从胯到胸底 */
  spine.position.y = H * 0.045;
  pelvis.add(spine);
  joints.spine = spine;

  // 腰
  const waist = new THREE.Mesh(
    boxGeo(H * 0.150, H * R.waistH, H * 0.100), mCoat);
  waist.position.y = H * R.waistH * 0.5;
  spine.add(waist);

  // 腰带
  const belt = new THREE.Mesh(
    boxGeo(H * 0.156, H * 0.018, H * 0.104), mBelt);
  belt.position.y = H * 0.006;
  spine.add(belt);

  // 胸
  const chest = new THREE.Mesh(
    boxGeo(H * 0.175, H * R.chestH, H * 0.108), mCoat);
  chest.position.y = H * (R.waistH + R.chestH * 0.5);
  spine.add(chest);

  // 胸前的拉链/门襟（细条，增加细节层次）
  const placket = new THREE.Mesh(
    boxGeo(H * 0.012, H * (R.waistH + R.chestH) * 0.94, H * 0.006), mCoatDark);
  placket.position.set(0, H * (R.waistH + R.chestH) * 0.47, H * 0.055);
  spine.add(placket);

  // 肩部横条（把肩膀做宽，剪影更清楚）
  const shoulders = new THREE.Mesh(
    boxGeo(H * R.shoulderW, H * 0.052, H * 0.105), mCoat);
  shoulders.position.y = H * (R.waistH + R.chestH - R.chestH * 0.42);
  spine.add(shoulders);

  /* ============ 手臂 ============ */
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';

    const shoulderJoint = new THREE.Group();
    shoulderJoint.position.set(
      side * H * R.shoulderW * 0.44,
      H * (R.waistH + R.chestH - R.chestH * 0.42),
      0
    );
    spine.add(shoulderJoint);
    joints['shoulder' + tag] = shoulderJoint;

    // 上臂
    const upperArm = new THREE.Mesh(
      boxGeo(H * 0.062, H * R.upperArmL, H * 0.064), mCoat);
    upperArm.position.y = -H * R.upperArmL * 0.5;
    shoulderJoint.add(upperArm);

    // 肘
    const elbow = new THREE.Group();
    elbow.position.y = -H * R.upperArmL;
    shoulderJoint.add(elbow);
    joints['elbow' + tag] = elbow;

    // 前臂
    const foreArm = new THREE.Mesh(
      boxGeo(H * 0.052, H * R.foreArmL, H * 0.054), mCoat);
    foreArm.position.y = -H * R.foreArmL * 0.5;
    elbow.add(foreArm);

    // 腕
    const wrist = new THREE.Group();
    wrist.position.y = -H * R.foreArmL;
    elbow.add(wrist);
    joints['wrist' + tag] = wrist;

    // 手掌
    const palm = new THREE.Mesh(
      boxGeo(H * 0.042, H * 0.052, H * 0.030), mSkin);
    palm.position.y = -H * 0.024;
    wrist.add(palm);

    // 四根手指（简化为一排小方块，指甲级精度体现在这里）
    const fingerGroup = new THREE.Group();
    fingerGroup.position.y = -H * 0.048;
    wrist.add(fingerGroup);
    joints['fingers' + tag] = fingerGroup;

    for (let f = 0; f < 4; f++) {
      const fg = new THREE.Group();
      fg.position.x = (f - 1.5) * H * 0.0095;
      fingerGroup.add(fg);
      // 近节
      const p1 = new THREE.Mesh(boxGeo(H * 0.0072, H * 0.020, H * 0.0080), mSkin);
      p1.position.y = -H * 0.010;
      fg.add(p1);
      // 远节
      const p2 = new THREE.Mesh(boxGeo(H * 0.0062, H * 0.016, H * 0.0070), mSkin);
      p2.position.y = -H * 0.028;
      fg.add(p2);
      // 指尖
      const tip = new THREE.Mesh(boxGeo(H * 0.0055, H * 0.008, H * 0.0062), mSkin);
      tip.position.y = -H * 0.039;
      fg.add(tip);
    }
    // 拇指
    const thumb = new THREE.Mesh(boxGeo(H * 0.0085, H * 0.026, H * 0.0090), mSkin);
    thumb.position.set(-side * H * 0.020, -H * 0.014, H * 0.004);
    thumb.rotation.z = -side * 0.55;
    wrist.add(thumb);
  }

  /* ============ 颈 + 头 ============ */
  const neckJoint = new THREE.Group();
  neckJoint.position.y = H * (R.waistH + R.chestH + R.neckH * 0.25);
  spine.add(neckJoint);
  joints.neck = neckJoint;

  const neck = new THREE.Mesh(
    cylGeo(H * 0.024, H * 0.028, H * R.neckH, 8), mSkin);
  neck.position.y = H * R.neckH * 0.5;
  neckJoint.add(neck);

  const headJoint = new THREE.Group();
  headJoint.position.y = H * (R.neckH + R.headH * 0.06);
  neckJoint.add(headJoint);
  joints.head = headJoint;

  /* 头部：颅骨 + 面部特征（眼/鼻/嘴/耳） */
  const headH = H * R.headH;
  const headW = H * R.headW;

  // 颅骨（略扁的球）
  const skull = new THREE.Mesh(sphereGeo(headH * 0.52, 14), mSkin);
  skull.scale.set(headW / headH * 1.06, 1.0, 0.96);
  skull.position.y = headH * 0.46;
  headJoint.add(skull);

  // 下颌（稍微收窄，做出下巴）
  const jaw = new THREE.Mesh(boxGeo(headW * 0.82, headH * 0.20, headH * 0.40), mSkin);
  jaw.position.set(0, headH * 0.16, headH * 0.06);
  headJoint.add(jaw);

  // 头发：后脑壳 + 顶部覆盖 + 鬓角
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(headH * 0.545, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.60), mHair);
  hairCap.scale.set(headW / headH * 1.08, 1.02, 0.99);
  hairCap.position.y = headH * 0.46;
  hairCap.rotation.x = -0.10;
  headJoint.add(hairCap);

  // 后脑（补满，避免从背后看到空洞）
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(headH * 0.535, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.78), mHair);
  hairBack.scale.set(headW / headH * 1.05, 1.0, 0.98);
  hairBack.position.set(0, headH * 0.44, -headH * 0.045);
  hairBack.rotation.x = 0.32;
  headJoint.add(hairBack);

  // 鬓角
  for (const side of [-1, 1]) {
    const sideburn = new THREE.Mesh(boxGeo(headW * 0.14, headH * 0.26, headH * 0.22), mHair);
    sideburn.position.set(side * headW * 0.40, headH * 0.40, -headH * 0.06);
    headJoint.add(sideburn);
  }

  /* 五官（尺寸很小，但这是「指甲级」精度的体现） */
  const mEye = toon(0x1a1614, { steps: [0.4, 0.7, 1.0] });
  const mEyeWhite = toon(0xd8d4cc, { steps: [0.6, 0.85, 1.0] });
  const mMouth = toon(0x8a5a52, { steps: [0.45, 0.72, 1.0] });

  for (const side of [-1, 1]) {
    // 眼白
    const eyeW = new THREE.Mesh(boxGeo(headW * 0.17, headH * 0.075, headH * 0.03), mEyeWhite);
    eyeW.position.set(side * headW * 0.20, headH * 0.47, headH * 0.415);
    headJoint.add(eyeW);
    // 瞳孔
    const pupil = new THREE.Mesh(boxGeo(headW * 0.085, headH * 0.060, headH * 0.02), mEye);
    pupil.position.set(side * headW * 0.21, headH * 0.47, headH * 0.432);
    headJoint.add(pupil);
    // 眉
    const brow = new THREE.Mesh(boxGeo(headW * 0.19, headH * 0.028, headH * 0.02), mHair);
    brow.position.set(side * headW * 0.20, headH * 0.545, headH * 0.418);
    headJoint.add(brow);
    // 耳
    const ear = new THREE.Mesh(boxGeo(headH * 0.045, headH * 0.16, headH * 0.075), mSkin);
    ear.position.set(side * headW * 0.50, headH * 0.42, -headH * 0.02);
    headJoint.add(ear);
  }
  // 鼻
  const nose = new THREE.Mesh(boxGeo(headW * 0.09, headH * 0.13, headH * 0.075), mSkin);
  nose.position.set(0, headH * 0.40, headH * 0.455);
  headJoint.add(nose);
  // 嘴
  const mouth = new THREE.Mesh(boxGeo(headW * 0.17, headH * 0.022, headH * 0.02), mMouth);
  mouth.position.set(0, headH * 0.255, headH * 0.415);
  headJoint.add(mouth);

  if (hat) {
    const mHat = toon(0x22262e, { steps: [0.40, 0.68, 0.92, 1.0] });
    const brim = new THREE.Mesh(cylGeo(headW * 0.86, headW * 0.82, headH * 0.035, 14), mHat);
    brim.position.y = headH * 0.60;
    headJoint.add(brim);
    const crown = new THREE.Mesh(cylGeo(headW * 0.56, headW * 0.62, headH * 0.30, 12), mHat);
    crown.position.y = headH * 0.78;
    headJoint.add(crown);
    // 帽带
    const band = new THREE.Mesh(cylGeo(headW * 0.63, headW * 0.63, headH * 0.035, 12), mCoatDark);
    band.position.y = headH * 0.635;
    headJoint.add(band);
  }

  if (scarf) {
    const mScarf = toon(scarf, { steps: [0.44, 0.70, 0.90, 1.0] });
    const wrap = new THREE.Mesh(cylGeo(headH * 0.34, headH * 0.36, headH * 0.16, 10), mScarf);
    wrap.position.y = H * R.neckH * 0.9;
    neckJoint.add(wrap);
    const tail = new THREE.Mesh(boxGeo(H * 0.030, H * 0.10, H * 0.012), mScarf);
    tail.position.set(H * 0.012, -H * 0.045, H * 0.052);
    neckJoint.add(tail);
  }

  /* ============ 包 ============ */
  if (bag) {
    const mBag = toon(0x2a2520, { steps: [0.38, 0.64, 0.88, 1.0] });
    const mStrap = toon(0x1e1a16, { steps: [0.36, 0.62, 0.86, 1.0] });
    const bagGroup = new THREE.Group();
    // 包体
    const body = new THREE.Mesh(boxGeo(H * 0.10, H * 0.115, H * 0.048), mBag);
    bagGroup.add(body);
    // 盖子
    const flap = new THREE.Mesh(boxGeo(H * 0.102, H * 0.045, H * 0.052), mBag);
    flap.position.y = H * 0.042;
    bagGroup.add(flap);
    // 扣
    const clasp = new THREE.Mesh(boxGeo(H * 0.014, H * 0.014, H * 0.008), mSole);
    clasp.position.set(0, H * 0.020, H * 0.027);
    bagGroup.add(clasp);
    // 斜挎带
    const strap = new THREE.Mesh(boxGeo(H * 0.014, H * 0.46, H * 0.010), mStrap);
    strap.position.set(0, H * 0.15, H * 0.004);
    strap.rotation.z = 0.62;
    bagGroup.add(strap);

    bagGroup.position.set(H * 0.115, H * 0.10, H * 0.008);
    bagGroup.rotation.y = 0.12;
    pelvis.add(bagGroup);
  }

  /* ============ 雨伞 ============ */
  let umbrellaGroup = null;
  if (umbrella !== null) {
    umbrellaGroup = new THREE.Group();
    const mUmb = toon(umbrella, { steps: [0.42, 0.68, 0.88, 0.96, 1.0] });
    const mUmbDark = toon(new THREE.Color(umbrella).multiplyScalar(0.62).getHex(),
      { steps: [0.40, 0.66, 0.88, 1.0] });
    const mRib = toon(0x8a8f98, { steps: [0.44, 0.70, 0.94, 1.0] });

    const R0 = H * 0.275;         // 伞面半径
    const shaftLen = H * 0.40;    // 手(0.46H) → 伞面底(0.86H)
    const rimDrop = R0 * 0.30;     // 伞缘下垂高度

    /* 伞面：用半球的下半部分做穹顶（开口朝下），保证从任何角度看都是正的伞形 */
    const capAngle = Math.PI * 0.42;      // 从顶部往下切的角度
    const canopyGeo = new THREE.SphereGeometry(
      R0, 24, 14, 0, Math.PI * 2,
      0, capAngle                             // phi 从顶部开始
    );
    const canopy = new THREE.Mesh(canopyGeo, mUmb);
    canopy.scale.set(1, 0.92, 1);
    canopy.position.y = shaftLen;
    umbrellaGroup.add(canopy);

    /* 伞缘坐标（几何上的实际边缘） */
    const edgeR = R0 * Math.sin(capAngle);
    const edgeY = R0 * Math.cos(capAngle) * 0.92;

    /* 伞缘垂边：用一圈正弦扰动的薄环，贴合伞面边缘，不再是悬浮圆环 */
    {
      const segs = 40;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        // 每 1/8 处有一个伞骨末端，做出轻微的波浪
        const wav = 1 + Math.sin(a * 8) * 0.012;
        pts.push(new THREE.Vector3(
          Math.cos(a) * edgeR * wav,
          shaftLen + edgeY - rimDrop * 0.10,
          Math.sin(a) * edgeR * wav
        ));
      }
      const rimCurve = new THREE.CatmullRomCurve3(pts, true);
      const rimGeo = new THREE.TubeGeometry(rimCurve, 56, H * 0.0022, 4, true);
      const rim = new THREE.Mesh(rimGeo, mUmbDark);
      umbrellaGroup.add(rim);
    }

    /* 伞骨：从顶端沿伞面弧线伸到边缘，用管状紧贴伞面 */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ribPts = [];
      for (let sIdx = 0; sIdx <= 5; sIdx++) {
        const phi = (sIdx / 5) * capAngle;
        const rr = R0 * Math.sin(phi) * 1.004;
        const yy = R0 * Math.cos(phi) * 0.92 * 1.004;
        ribPts.push(new THREE.Vector3(Math.cos(a) * rr, shaftLen + yy, Math.sin(a) * rr));
      }
      const curve = new THREE.CatmullRomCurve3(ribPts);
      const ribGeo = new THREE.TubeGeometry(curve, 10, H * 0.0018, 4, false);
      const rib = new THREE.Mesh(ribGeo, mRib);
      umbrellaGroup.add(rib);
    }

    /* 伞面内侧（双面材质替代方案：一个稍小的反面壳，避免从下方看穿） */
    {
      const innerGeo = new THREE.SphereGeometry(
        R0 * 0.985, 20, 12, 0, Math.PI * 2, 0, capAngle);
      const innerMat = mUmbDark.clone();
      innerMat.side = THREE.BackSide;
      const inner = new THREE.Mesh(innerGeo, innerMat);
      inner.scale.set(1, 0.92, 1);
      inner.position.y = shaftLen;
      umbrellaGroup.add(inner);
    }

    /* 伞尖 */
    const tipLen = H * 0.028;
    const tip = new THREE.Mesh(cylGeo(0.004, H * 0.007, tipLen, 6), mRib);
    tip.position.y = shaftLen + R0 * 0.92 + tipLen * 0.5;
    umbrellaGroup.add(tip);

    /* 伞杆：从伞顶中心贯穿到底 */
    const shaft = new THREE.Mesh(cylGeo(H * 0.0042, H * 0.0042, shaftLen, 6), mRib);
    shaft.position.y = shaftLen * 0.5;
    umbrellaGroup.add(shaft);

    /* 弯把手（在杆底） */
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(H * 0.020, H * 0.0050, 6, 14, Math.PI * 0.85), mRib);
    handle.position.set(H * 0.020, 0.0, 0);
    handle.rotation.set(0, Math.PI / 2, -Math.PI * 0.10);
    umbrellaGroup.add(handle);

    /* 伞整体挂在右手上：位置由手腕决定，向上延伸 */
    /* 伞挂在「身体坐标系」上而不是旋转过的手腕：
       手腕的 rotation.x 是 -1.05 之类的，把伞挂上去会把伞面转成侧向。
       这里用一个独立节点固定在右侧肩前上方，让伞始终竖直。 */
    /* 锚点挂在 root 上（root 原点在脚底），高度直接是「手的高度」
       不要再加 pelvis/spine 的偏移，否则会叠加两次。 */
    const umbAnchor = new THREE.Group();
    umbAnchor.position.set(
      H * 0.10,         // 右手外侧（贴近身体，不甩太远）
      H * 0.46,         // 手的高度
      H * 0.06          // 稍向前，让伞面正罩头顶
    );
    root.add(umbAnchor);
    umbAnchor.add(umbrellaGroup);
    umbrellaGroup.position.set(0, 0, 0);
    umbrellaGroup.rotation.set(0, 0, 0);
    joints.umbrellaAnchor = umbAnchor;

    /* 举伞的手臂姿态：上臂前抬 + 肘弯曲，手正好落在伞杆底部 */
    joints.shoulderR.rotation.x = -0.30;
    joints.shoulderR.rotation.z = 0.16;
    joints.elbowR.rotation.x = -1.30;
    joints.wristR.rotation.x = 0.95;
    joints.fingersR.rotation.x = -1.25;   // 手指握紧
  }

  contactShadow(root, H * 0.62, H * 0.52, 0.44, 0, 0.003, 0);

  return {
    root,
    joints,
    H,
    geometryHeight: H,
    walkPhase: Math.random() * Math.PI * 2,
    strideScale: 0.92 + Math.random() * 0.16,
  };
}

/* =========================================================
   姿态：行走
   ========================================================= */
export function poseWalk(fig, phase) {
  const J = fig.joints;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const H = fig.H;

  // 腿：髋摆动 + 膝弯曲（后摆时膝弯得更多，符合真实步态）
  const hipSwing = s * 0.56;
  J.hipL.rotation.x = hipSwing;
  J.hipR.rotation.x = -hipSwing;

  // 膝盖只在腿向后时弯曲
  const kneeL = Math.max(0, -s) * 0.90 + 0.06;
  const kneeR = Math.max(0, s) * 0.90 + 0.06;
  J.kneeL.rotation.x = kneeL;
  J.kneeR.rotation.x = kneeR;

  // 踝：抵地时回勾，抬起时下垂
  J.ankleL.rotation.x = -kneeL * 0.42 + s * 0.14;
  J.ankleR.rotation.x = -kneeR * 0.42 - s * 0.14;

  // 手臂反相摆动（持伞的那侧已被固定，这里会覆盖，故跳过）
  if (!J.__holdR) {
    J.shoulderR.rotation.x = -s * 0.44;
    J.shoulderR.rotation.z = 0.06;
  }
  if (!J.__holdL) {
    J.shoulderL.rotation.x = s * 0.44;
    J.shoulderL.rotation.z = -0.06;
  }

  // 肘：轻微跟随
  if (!J.__holdR) J.elbowR.rotation.x = -0.22 - Math.max(0, -s) * 0.30;
  if (!J.__holdL) J.elbowL.rotation.x = -0.22 - Math.max(0, s) * 0.30;

  // 髋部起伏（每一步一次，双频）
  const bob = Math.abs(c) * H * 0.011;
  J.pelvis.position.y = H * PELVIS_Y + bob;

  // 髋部左右摆（重心转移）
  J.pelvis.rotation.z = s * 0.045;
  J.pelvis.rotation.y = -s * 0.075;

  // 躯干反向扭转
  J.spine.rotation.y = s * 0.055;
  J.spine.rotation.z = -s * 0.028;

  // 头保持水平稳定（人会自然稳定视线）
  J.head.rotation.y = -J.spine.rotation.y * 0.75;
  J.head.rotation.x = Math.abs(c) * 0.025;
  J.neck.rotation.x = 0.04;
}

/* =========================================================
   姿态：站立（呼吸 + 偶发小动作）
   ========================================================= */
export function poseStand(fig, t, opts = {}) {
  const J = fig.joints;
  const H = fig.H;
  const { phone = false, lookAround = true } = opts;

  const breathe = Math.sin(t * 1.15) * 0.5 + 0.5;

  // 腿基本直立，重心微微偏一侧
  J.hipL.rotation.x = 0.02;
  J.hipR.rotation.x = -0.02;
  J.kneeL.rotation.x = 0.05;
  J.kneeR.rotation.x = 0.03;
  J.ankleL.rotation.x = -0.03;
  J.ankleR.rotation.x = -0.02;

  // 髋部轻微左右移重心
  J.pelvis.position.y = H * PELVIS_Y - breathe * H * 0.0015;
  J.pelvis.rotation.z = Math.sin(t * 0.42) * 0.016;

  // 手臂自然下垂（持伞侧保持）
  if (!J.__holdR) {
    J.shoulderR.rotation.x = -0.06 + Math.sin(t * 0.9) * 0.012;
    J.shoulderR.rotation.z = 0.10;
    J.elbowR.rotation.x = -0.20;
  }
  if (!J.__holdL) {
    J.shoulderL.rotation.x = 0.04 + Math.sin(t * 0.8 + 1.2) * 0.012;
    J.shoulderL.rotation.z = -0.10;
    J.elbowL.rotation.x = -0.18;
  }

  if (phone) {
    // 低头看手机
    J.shoulderR.rotation.x = -0.85;
    J.elbowR.rotation.x = -1.55;
    J.wristR.rotation.x = 0.55;
    J.head.rotation.x = 0.42;
    J.neck.rotation.x = 0.16;
    J.spine.rotation.x = 0.05;
  } else if (lookAround) {
    // 缓慢环视
    J.head.rotation.y = Math.sin(t * 0.31) * 0.42;
    J.head.rotation.x = 0.02 + Math.sin(t * 0.23) * 0.03;
    J.neck.rotation.x = 0.03;
    J.spine.rotation.y = Math.sin(t * 0.31) * 0.06;
  }

  // 呼吸：胸腔微扩
  J.spine.rotation.x = -breathe * 0.012;
}
