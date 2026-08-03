'use strict';

const http = require('http');
const WebSocket = require('ws');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function ensureChrome(cdpBase, maxWaitMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxWaitMs) {
    try {
      const targets = await getJson(`${cdpBase}/json/list`);
      if (targets.some((t) => t.type === 'page')) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function connectCdp(cdpBase) {
  const ok = await ensureChrome(cdpBase);
  if (!ok) throw new Error(`chrome CDP not ready at ${cdpBase}`);
  const targets = await getJson(`${cdpBase}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no CDP page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (m, p = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      try {
        ws.send(JSON.stringify({ id: mid, method: m, params: p }));
      } catch (e) {
        pending.delete(mid);
        reject(e);
      }
    });
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  await new Promise((r, j) => {
    ws.on('open', r);
    ws.on('error', j);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Security.setIgnoreCertificateErrors', { ignore: true });
  const evalAsync = async (expression) => {
    const r = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  return { ws, send, evalAsync };
}

async function loginBrowser(cdp, cfg) {
  await cdp.send('Page.navigate', { url: `${cfg.baseUrl}/` });
  await new Promise((r) => setTimeout(r, 1200));
  const user = JSON.stringify(cfg.username);
  const pass = JSON.stringify(cfg.password);
  await cdp.evalAsync(
    `fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username:${user},password:${pass}})}).then(r=>r.json())`,
  );
}

module.exports = { getJson, ensureChrome, connectCdp, loginBrowser };
