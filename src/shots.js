// 用 headless chromium 截图并抓取控制台错误（开发用）
// 用法: node src/shots.js <url> <输出路径> [等待毫秒]
// 需要本机有 Chromium；通过环境变量 CHROME 指定可执行文件。
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CHROME = process.env.CHROME || '/usr/bin/chromium';
const URL = process.argv[2] || 'http://127.0.0.1:8080/index.html';
const OUT = process.argv[3] || './shots/shot.png';
const WAIT = parseInt(process.argv[4] || '6000', 10);

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const args = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu-sandbox',
  '--use-gl=angle',
  '--use-angle=gl',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--hide-scrollbars',
  '--window-size=1600,1000',
  '--force-device-scale-factor=1',
  '--remote-debugging-port=0',
  '--user-data-dir=/tmp/chrome-shot-profile-' + process.pid,
  'about:blank',
];

const proc = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });

let wsUrl = null;
proc.stderr.on('data', (d) => {
  const s = d.toString();
  const m = s.match(/DevTools listening on (ws:\/\/\S+)/);
  if (m) wsUrl = m[1];
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 100 && !wsUrl; i++) await sleep(100);
  if (!wsUrl) { console.error('no devtools'); proc.kill(); process.exit(1); }

  const httpBase = wsUrl.replace('ws://', 'http://').split('/devtools/')[0];
  const listRes = await fetch(httpBase + '/json/list');
  const targets = await listRes.json();
  const page = targets.find(t => t.type === 'page');
  if (!page) { console.error('no page target'); proc.kill(); process.exit(1); }

  // 用 node 内置 WebSocket
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push({ type: 'console', level: msg.params.type, text: msg.params.args.map(a => a.value ?? a.description ?? a.type).join(' ') });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push({ type: 'exception', text: (d.exception && (d.exception.description || d.exception.value)) || d.text, line: d.lineNumber });
    } else if (msg.method === 'Log.entryAdded') {
      logs.push({ type: 'log', level: msg.params.entry.level, text: msg.params.entry.text, url: msg.params.entry.url });
    }
  };

  await new Promise((r) => { ws.onopen = r; });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: URL });
  await sleep(WAIT);

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));

  // 抓 WebGL 状态
  const info = await send('Runtime.evaluate', { expression: `(()=>{const c=document.querySelector('canvas');if(!c)return 'no-canvas';const gl=c.getContext('webgl2')||c.getContext('webgl');return JSON.stringify({w:c.width,h:c.height,gl:!!gl,renderer:gl?gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||gl.RENDERER):null});})()`, returnByValue: true });

  console.log('=== INFO ===');
  console.log(info.result.value);
  console.log('=== LOGS ===');
  for (const l of logs.slice(0, 60)) console.log(JSON.stringify(l));
  console.log('=== saved', OUT, fs.statSync(OUT).size, 'bytes ===');

  ws.close(); proc.kill();
  process.exit(0);
})().catch(e => { console.error('ERR', e); proc.kill(); process.exit(1); });
