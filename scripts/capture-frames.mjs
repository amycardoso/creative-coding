// Capture a seamless loop of PNG frames from a p5 sketch using one persistent
// headless Chrome over the DevTools Protocol. No npm dependencies — relies on
// Node's built-in global `fetch` and `WebSocket` (Node >= 22).
//
// The sketch must expose a capture hook (see sketches/calcadao/sketch.js):
//   window.__captureFrame(i, N)  -> render loop phase i of N, then redraw()
// Frames evenly tile [0,1) so the resulting GIF loops without a seam.
//
// Usage:
//   node scripts/capture-frames.mjs <url> <outDir> <frames> <width> <height>

const [, , url, outDir, framesArg, wArg, hArg] = process.argv;
if (!url || !outDir) {
  console.error('usage: node capture-frames.mjs <url> <outDir> <frames> <width> <height>');
  process.exit(1);
}
const FRAMES = parseInt(framesArg ?? '180', 10);
const WIDTH = parseInt(wArg ?? '800', 10);
const HEIGHT = parseInt(hArg ?? '800', 10);

const fs = await import('node:fs');
const { spawn } = await import('node:child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const PROFILE = `/tmp/cc_capture_profile_${PORT}`;

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  `--window-size=${WIDTH},${HEIGHT}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait for the debugging endpoint to come up.
let wsUrl;
for (let i = 0; i < 50; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    wsUrl = (await r.json()).webSocketDebuggerUrl;
    if (wsUrl) break;
  } catch {}
  await sleep(100);
}
if (!wsUrl) { console.error('Chrome devtools never came up'); process.exit(1); }

// Minimal CDP client over the browser-level WebSocket.
const ws = new WebSocket(wsUrl);
await new Promise((res) => (ws.onopen = res));
let msgId = 0;
const pending = new Map();
const sessions = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}, sessionId) =>
  new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

// Open a page target and attach a flat session to it.
const { result: target } = await send('Target.createTarget', { url: 'about:blank' });
const { result: attached } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
const sid = attached.sessionId;

await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
// Force an exact WIDTH×HEIGHT layout surface so the centred canvas fills the
// frame (the default CDP viewport is 800×600 and would letterbox the capture).
await send('Emulation.setDeviceMetricsOverride',
  { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false }, sid);
await send('Page.navigate', { url }, sid);

// Wait until the sketch is ready (capture hook installed).
let ready = false;
for (let i = 0; i < 100; i++) {
  const { result } = await send('Runtime.evaluate',
    { expression: 'typeof window.__captureFrame === "function"', returnByValue: true }, sid);
  if (result?.result?.value === true) { ready = true; break; }
  await sleep(100);
}
if (!ready) { console.error('sketch capture hook never appeared'); process.exit(1); }

const clip = { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 };
const pad = (n) => String(n).padStart(4, '0');

for (let i = 0; i < FRAMES; i++) {
  await send('Runtime.evaluate',
    { expression: `window.__captureFrame(${i}, ${FRAMES})`, awaitPromise: true }, sid);
  const { result } = await send('Page.captureScreenshot',
    { format: 'png', clip, captureBeyondViewport: true }, sid);
  fs.writeFileSync(`${outDir}/f${pad(i)}.png`, Buffer.from(result.data, 'base64'));
  if (i % 20 === 0) process.stdout.write(`  frame ${i}/${FRAMES}\r`);
}
console.log(`  captured ${FRAMES} frames -> ${outDir}        `);

ws.close();
chrome.kill();
process.exit(0);
