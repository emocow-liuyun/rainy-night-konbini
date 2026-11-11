/* =========================================================
   effects.js — 雨丝 / 涟漪 / 屋檐滴水 / 招牌闪烁 / 玻璃水痕 / 霓虹
   ========================================================= */
import * as THREE from 'three';
import { canvasTex } from './core.js';

/* ---------------- 雨：GPU 驱动的实例化雨丝 ---------------- */
export function buildRain(scene, opts = {}) {
  const {
    count = 4200,
    area = 26,
    height = 11,
    speed = 15,
    wind = 0.55,
    length = 0.42,
  } = opts;

  const geo = new THREE.PlaneGeometry(0.012, length);
  // 竖直朝向的雨丝（billboard 会在 shader 里做）
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uArea: { value: area },
      uHeight: { value: height },
      uSpeed: { value: speed },
      uWind: { value: wind },
      uColor: { value: new THREE.Color(0xbfd6ee) },
      uOpacity: { value: 0.44 },
    },
    vertexShader: /* glsl */`
      uniform float uTime, uArea, uHeight, uSpeed, uWind;
      attribute vec3 aSeed;
      varying float vAlpha;
      varying float vY;
      void main() {
        float speed = uSpeed * (0.75 + aSeed.z * 0.75);
        float y = mod(aSeed.y * uHeight - uTime * speed, uHeight);
        vec3 p = vec3(aSeed.x * uArea, y, aSeed.z * uArea * 0.5);
        p.x += (uHeight - y) * uWind * 0.075;
        p.z += (uHeight - y) * uWind * 0.02;

        // 相机朝向的板状
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec2 sc = vec2(position.x, position.y * (0.7 + aSeed.z * 0.9));
        // 稍微倾斜，跟随风向
        sc.x += position.y * 0.26;

        mv.xy += sc;
        gl_Position = projectionMatrix * mv;
        vAlpha = smoothstep(0.0, 2.0, y) * smoothstep(uHeight, uHeight - 2.5, y) * (0.35 + aSeed.x * 0.65);
        vY = y;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity;
      varying float vAlpha;
      void main() {
        float a = vAlpha * uOpacity;
        // 两端淡出，中间实
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const inst = new THREE.InstancedBufferGeometry();
  inst.index = geo.index;
  inst.attributes.position = geo.attributes.position;
  inst.attributes.uv = geo.attributes.uv;

  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i * 3 + 0] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
  }
  inst.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
  inst.instanceCount = count;

  const mesh = new THREE.Mesh(inst, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  scene.add(mesh);

  return { mesh, mat };
}

/* ---------------- 溅落雨末（地面小水花） ---------------- */
export function buildSplash(scene, count = 260, area = 22) {
  const geo = new THREE.PlaneGeometry(0.09, 0.09);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uArea: { value: area },
      uTex: { value: ringTex() },
    },
    vertexShader: /* glsl */`
      uniform float uTime, uArea;
      attribute vec3 aSeed;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float period = 0.65 + aSeed.z * 1.4;
        float t = fract((uTime + aSeed.x * 10.0) / period);
        vec3 p = vec3(aSeed.x * uArea, 0.02, aSeed.y * uArea * 0.5);
        float s = 0.35 + t * 1.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        mv.xy += position.xy * s;
        gl_Position = projectionMatrix * mv;
        vUv = uv;
        vA = (1.0 - t) * (1.0 - t) * 0.85;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float a = texture2D(uTex, vUv).a * vA;
        gl_FragColor = vec4(vec3(0.55, 0.70, 0.88), a * 0.34);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const inst = new THREE.InstancedBufferGeometry();
  inst.index = geo.index;
  inst.attributes.position = geo.attributes.position;
  inst.attributes.uv = geo.attributes.uv;
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) seeds[i] = Math.random();
  inst.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
  inst.instanceCount = count;

  const mesh = new THREE.Mesh(inst, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 21;
  scene.add(mesh);
  return { mesh, mat };
}

let _ringTex = null;
function ringTex() {
  if (_ringTex) return _ringTex;
  _ringTex = canvasTex(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.36, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.24, 0, 7); ctx.stroke();
  });
  return _ringTex;
}

/* ---------------- 屋顶滴水 ---------------- */
export function buildDrips(parent, points, opts = {}) {
  const { perPoint = 3, color = 0xbcd8f0 } = opts;
  const n = points.length * perPoint;
  const geo = new THREE.SphereGeometry(0.016, 6, 5);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  inst.frustumCulled = false;
  inst.renderOrder = 22;
  parent.add(inst);

  const data = [];
  const mtx = new THREE.Matrix4();
  const zero = new THREE.Vector3(0, 0, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const p = points[i % points.length];
    data.push({
      x: p.x + (Math.random() - 0.5) * 0.05,
      y0: p.y,
      z: p.z + (Math.random() - 0.5) * 0.05,
      t: Math.random(),
      speed: 0.6 + Math.random() * 0.7,
      len: 0.5 + Math.random() * 0.5,
    });
    mtx.compose(zero, q, new THREE.Vector3(0.001, 0.001, 0.001));
    inst.setMatrixAt(i, mtx);
  }
  inst.instanceMatrix.needsUpdate = true;

  const state = { inst, data, groundY: 0.02 };
  return state;
}

export function updateDrips(state, dt) {
  const { inst, data, groundY } = state;
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    d.t += dt * d.speed * 1.1;
    if (d.t > 1) d.t -= 1;
    const fall = d.t * d.t; // 重力加速
    const y = d.y0 - fall * (d.y0 - groundY);
    // 拉长为水滴
    const stretch = 1 + fall * 2.2;
    pos.set(d.x, y, d.z);
    scl.set(1, stretch, 1);
    mtx.compose(pos, q, scl);
    inst.setMatrixAt(i, mtx);
  }
  inst.instanceMatrix.needsUpdate = true;
}

/* ---------------- 动态涟漪（水面波纹） ---------------- */
export function buildRipples(scene, spots) {
  const group = new THREE.Group();
  scene.add(group);
  const tex = ringTex();
  const list = [];
  for (const s of spots) {
    const n = s.n ?? 3;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, color: 0xa8d8f8,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(s.x, 0.026, s.z);
      m.renderOrder = 5;
      group.add(m);
      list.push({
        mesh: m, mat,
        x: s.x + (Math.random() - 0.5) * (s.spread ?? 0.4),
        z: s.z + (Math.random() - 0.5) * (s.spread ?? 0.4),
        t: Math.random(),
        period: 0.9 + Math.random() * 1.4,
        max: s.max ?? 0.55,
      });
    }
  }
  return { group, list };
}

export function updateRipples(state, dt) {
  for (const r of state.list) {
    r.t += dt / r.period;
    if (r.t > 1) {
      r.t -= 1;
      r.mesh.position.x = r.x + (Math.random() - 0.5) * 0.3;
      r.mesh.position.z = r.z + (Math.random() - 0.5) * 0.3;
    }
    const s = 0.10 + r.t * r.max * 2.4;
    r.mesh.scale.set(s, s, 1);
    r.mat.opacity = (1 - r.t) * (1 - r.t) * 0.26;
  }
}

/* ---------------- 玻璃雨水滑落 ---------------- */
export function buildGlassRain(parent, plane) {
  // plane: {w,h,x,y,z}
  const tex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // 随机水珠 & 水痕
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 0.8 + Math.random() * 2.0;
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      g2.addColorStop(0, 'rgba(255,255,255,0.85)');
      g2.addColorStop(0.5, 'rgba(220,240,255,0.35)');
      g2.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 24; i++) {
      const x = Math.random() * w;
      const y0 = Math.random() * h * 0.4;
      const len = 40 + Math.random() * 200;
      const grad = ctx.createLinearGradient(x, y0, x, y0 + len);
      grad.addColorStop(0, 'rgba(220,240,255,0)');
      grad.addColorStop(0.4, 'rgba(230,246,255,0.28)');
      grad.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y0, 1 + Math.random() * 2, len);
    }
  }, { repeat: [1, 1] });

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.13,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(plane.w, plane.h), mat);
  m.position.set(plane.x, plane.y, plane.z);
  m.renderOrder = 8;
  parent.add(m);

  return { mesh: m, mat, tex, scroll: 0 };
}

export function updateGlassRain(state, dt) {
  state.tex.offset.y -= dt * 0.06;
  state.tex.offset.y = state.tex.offset.y % 1;
}

/* ---------------- 招牌/灯箱闪烁（多频叠加，非周期性） ---------------- */
export function makeFlicker(base = 1.0, opts = {}) {
  const { amp = 0.16, speed = 1.0, seed = Math.random() * 100, dropout = 0.0 } = opts;
  let t = seed;
  return {
    update(dt) {
      t += dt * speed;
      // 三个不同频率的正弦叠加 → 近似不规则
      const w = Math.sin(t * 2.1) * 0.5 + Math.sin(t * 5.37 + 1.3) * 0.3 + Math.sin(t * 11.9 + 2.7) * 0.2;
      let v = base + w * amp;
      // 偶发的瞬断（老旧灯管）
      if (dropout > 0) {
        const k = Math.sin(t * 0.73 + seed) * Math.sin(t * 1.91);
        if (k > 1 - dropout) v *= 0.35 + Math.abs(Math.sin(t * 40)) * 0.5;
      }
      return v;
    },
  };
}

/* ---------------- 雨幕远景（贴图滚筒） ---------------- */
export function buildBackdropRain(parent, opts = {}) {
  const { w = 40, h = 14, z = -14, opacity = 0.18 } = opts;
  const tex = canvasTex(512, 512, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(180,210,240,0.5)';
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const len = 8 + Math.random() * 26;
      ctx.lineWidth = 0.6 + Math.random() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.16, y + len);
      ctx.stroke();
    }
  }, { repeat: [3, 2] });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(0, h / 2 - 1, z);
  m.renderOrder = 1;
  parent.add(m);
  return { mesh: m, mat, tex };
}

export function updateBackdropRain(state, dt) {
  state.tex.offset.y -= dt * 0.55;
}
