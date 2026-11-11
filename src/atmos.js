/* =========================================================
   atmos.js — 夜空穹顶 / 云层 / 远景城市剪影 / 地面雾霾
   ========================================================= */
import * as THREE from 'three';
import { canvasTex, toon, glowMat, box, add, planeGeo, group } from './core.js';

/* ---------------- 夜空穹顶（雨云渐变） ---------------- */
export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(78, 32, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(0x070b14) },
      uMid: { value: new THREE.Color(0x152238) },
      uHorizon: { value: new THREE.Color(0x2c3f5e) },
      uGlow: { value: new THREE.Color(0x46607f) },
      uWarm: { value: new THREE.Color(0x5a4028) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uHorizon, uGlow, uWarm;
      uniform float uTime;
      varying vec3 vDir;

      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float vnoise(vec3 p){
        vec3 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        float n000=hash(i), n100=hash(i+vec3(1,0,0)), n010=hash(i+vec3(0,1,0)), n110=hash(i+vec3(1,1,0));
        float n001=hash(i+vec3(0,0,1)), n101=hash(i+vec3(1,0,1)), n011=hash(i+vec3(0,1,1)), n111=hash(i+vec3(1,1,1));
        return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
                   mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
      }
      float fbm(vec3 p){
        float v = 0.0, a = 0.5;
        for(int i=0;i<4;i++){ v += vnoise(p)*a; p *= 2.03; a *= 0.5; }
        return v;
      }

      void main(){
        float h = clamp(vDir.y, -1.0, 1.0);
        float t = smoothstep(-0.02, 0.55, h);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.30, h));
        col = mix(col, uTop, smoothstep(0.30, 0.95, h));

        // 地平线附近的城市辉光（暖 + 冷混合）
        float horizonGlow = exp(-max(h, 0.0) * 9.0);
        col += uGlow * horizonGlow * 0.55;
        // 便利店方向的暖雾
        float dirWarm = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(0.25, 0.0, 0.55))));
        col += uWarm * pow(dirWarm, 2.0) * horizonGlow * 0.9;

        // 雨云层
        vec3 cp = vec3(vDir.x * 2.2, vDir.y * 5.0 + uTime * 0.012, vDir.z * 2.2);
        float cloud = fbm(cp * 1.6);
        float cloud2 = fbm(cp * 3.4 + 11.0);
        float c = smoothstep(0.42, 0.78, cloud * 0.7 + cloud2 * 0.45);
        // 云被城市灯光从下方照亮
        vec3 cloudCol = mix(vec3(0.055, 0.075, 0.115), vec3(0.16, 0.185, 0.235), horizonGlow);
        col = mix(col, cloudCol, c * smoothstep(-0.05, 0.35, h) * 0.85);

        // 高空极轻的暗角
        col *= 1.0 - smoothstep(0.35, 1.0, h) * 0.28;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -100;
  scene.add(mesh);
  return { mesh, mat };
}

/* ---------------- 远景城市剪影 ---------------- */
export function buildCityGlow(scene, opts = {}) {
  const g = new THREE.Group();
  const { radius = 34, count = 46 } = opts;

  const mat = new THREE.MeshBasicMaterial({ color: 0x0d1521, fog: false });
  const winTex = canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, w, h);
    const cols = 5, rows = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.62) {
          const warm = Math.random() > 0.35;
          ctx.fillStyle = warm
            ? `rgba(255,214,150,${0.35 + Math.random() * 0.5})`
            : `rgba(170,215,255,${0.25 + Math.random() * 0.4})`;
          ctx.fillRect(c * (w / cols) + 3, r * (h / rows) + 4, w / cols - 7, h / rows - 9);
        }
      }
    }
  });
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.08;
    const r = radius + (Math.random() - 0.5) * 9;
    const w = 3 + Math.random() * 5;
    const hgt = 4 + Math.random() * 13;
    const d = 3 + Math.random() * 5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;

    const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
    b.position.set(x, hgt / 2 - 1.5, z);
    b.rotation.y = a;
    g.add(b);

    // 窗光贴片
    const t = winTex.clone();
    t.needsUpdate = true;
    t.repeat.set(1 + Math.random(), 1);
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, hgt * 0.88), new THREE.MeshBasicMaterial({
      map: t, transparent: true, opacity: 0.55, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending,
    }));
    wm.position.set(x + Math.cos(a) * (d / 2 + 0.06), hgt / 2 - 1.5, z + Math.sin(a) * (d / 2 + 0.06));
    wm.rotation.y = a + Math.PI / 2;
    g.add(wm);
  }
  g.renderOrder = -90;
  scene.add(g);
  return g;
}

/* ---------------- 地平线雾带 ---------------- */
export function buildHorizonHaze(scene) {
  const g = new THREE.Group();
  const tex = canvasTex(256, 128, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(120,160,215,0.55)');
    gr.addColorStop(0.45, 'rgba(90,125,175,0.22)');
    gr.addColorStop(1, 'rgba(60,90,140,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  });
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending, opacity: 0.7,
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(96, 15), mat);
    m.position.set(Math.cos(a) * 40, 5.0, Math.sin(a) * 40);
    m.lookAt(0, 5.0, 0);
    g.add(m);
  }
  g.renderOrder = -85;
  scene.add(g);
  return g;
}

export function updateSky(state, dt, time) {
  if (state?.mat) state.mat.uniforms.uTime.value = time;
}
