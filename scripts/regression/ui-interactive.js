#!/usr/bin/env node
'use strict';

/**
 * CDP UI smoke: classic power controls + platform VM tabs + Machine Finder.
 * Requires Chrome CDP (chrome-launch.sh).
 */

const { loadConfig } = require('./lib/config');
const { createApi } = require('./lib/api');
const { connectCdp, loginBrowser } = require('./lib/cdp');
const { createLogger } = require('./lib/log');

const cfg = loadConfig();
const { api, login } = createApi(cfg);
const log = createLogger(cfg.resultsDir, 'ui-interactive');
const VM = cfg.vmName;
const PLATFORM_VM =
  process.env.MACHINA_PLATFORM_VM_ID || '3b2803c9-68e9-4235-b0f8-ef46a42c7a80';

async function bodyText(cdp) {
  return cdp.evalAsync(
    `document.body ? document.body.innerText.replace(/\\s+/g, ' ').trim() : ''`,
  );
}

async function visit(cdp, path, { minLen = 100, waitMs = 8000 } = {}) {
  await cdp.send('Page.navigate', { url: cfg.baseUrl + path });
  const t0 = Date.now();
  let t = '';
  while (Date.now() - t0 < waitMs) {
    t = await bodyText(cdp);
    if (t.length >= minLen) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const crashed = /Something went wrong|Route not found/i.test(t);
  return { t, crashed, len: t.length };
}

async function clickByText(cdp, label) {
  return cdp.evalAsync(`(() => {
    const want = ${JSON.stringify(label)}.toLowerCase();
    const els = [...document.querySelectorAll('button,a,[role="button"]')];
    const el = els.find(e => (e.innerText||e.textContent||'').trim().toLowerCase().includes(want));
    if (!el) return {ok:false, reason:'not-found'};
    if (el.disabled) return {ok:false, reason:'disabled'};
    el.click();
    return {ok:true, text:(el.innerText||'').trim().slice(0,40)};
  })()`);
}

(async () => {
  await login();
  // ensure running
  const v = await api('GET', `/api/v1/vms/${VM}`);
  const st = JSON.parse(v.body).state;
  if (st === 'paused') await api('POST', `/api/v1/vms/${VM}/resume`);
  else if (st !== 'running') await api('POST', `/api/v1/vms/${VM}/start`);

  const cdp = await connectCdp(cfg.cdpUrl, { freshPage: true, url: cfg.baseUrl + '/' });
  await loginBrowser(cdp, cfg);
  let pass = 0;
  let fail = 0;

  const check = async (name, fn) => {
    try {
      const note = await fn();
      log.append({ kind: 'UI', api: name, ok: true, note: String(note).slice(0, 160) });
      pass++;
    } catch (e) {
      log.append({ kind: 'UI', api: name, ok: false, note: e.message.slice(0, 200) });
      fail++;
    }
  };

  await check('classic-vm-detail', async () => {
    const r = await visit(cdp, `/vms/${VM}`, { waitMs: 12000, minLen: 200 });
    if (r.crashed) throw new Error('crash');
    if (r.len < 100) throw new Error(`short ${r.len}`);
    // Wait until power controls hydrate
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      const has = await cdp.evalAsync(
        `!![...document.querySelectorAll('button')].find(b => /pause|resume|stop/i.test(b.innerText||''))`,
      );
      if (has) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    return `len=${r.len}`;
  });

  await check('classic-pause-btn', async () => {
    const c = await clickByText(cdp, 'Pause');
    if (!c.ok) throw new Error(c.reason);
    await new Promise((r) => setTimeout(r, 2500));
    const v2 = await api('GET', `/api/v1/vms/${VM}`);
    const state = JSON.parse(v2.body).state;
    if (state !== 'paused') throw new Error(`state=${state}`);
    return state;
  });

  await check('classic-resume-btn', async () => {
    // After pause the button label flips to Resume
    const t0 = Date.now();
    let c = { ok: false, reason: 'timeout' };
    while (Date.now() - t0 < 8000) {
      c = await clickByText(cdp, 'Resume');
      if (c.ok) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!c.ok) throw new Error(c.reason);
    await new Promise((r) => setTimeout(r, 2500));
    const v2 = await api('GET', `/api/v1/vms/${VM}`);
    const state = JSON.parse(v2.body).state;
    if (state !== 'running') throw new Error(`state=${state}`);
    return state;
  });

  const tabs = ['overview', 'storage', 'network', 'snapshots', 'console', 'activity'];
  for (const tab of tabs) {
    await check(`platform-tab-${tab}`, async () => {
      const r = await visit(cdp, `/platform/vms/${PLATFORM_VM}?tab=${tab}`, {
        waitMs: 12000,
        minLen: 80,
      });
      if (r.crashed) throw new Error('crash');
      if (r.len < 80) throw new Error(`soft len=${r.len}`);
      return `len=${r.len}`;
    });
  }

  await check('machine-finder', async () => {
    const r = await visit(cdp, '/platform/hosts/finder', { waitMs: 14000, minLen: 80 });
    if (r.crashed) throw new Error('crash');
    if (r.len < 80) throw new Error(`soft len=${r.len}`);
    return `len=${r.len} hasMachines=${/chrome-e2e-vm|bug-hunt|ui-e2e/i.test(r.t)}`;
  });

  await check('cinema', async () => {
    const r = await visit(cdp, `/vms/${VM}/consolehub`, { waitMs: 12000, minLen: 50 });
    if (r.crashed) throw new Error('crash');
    const canvas = await cdp.evalAsync(
      `document.querySelectorAll('canvas').length`,
    );
    return `len=${r.len} canvases=${canvas}`;
  });

  try {
    cdp.ws.close();
  } catch {
    /* ignore */
  }

  log.append({ kind: 'SUMMARY', ok: fail === 0, note: `pass=${pass} fail=${fail}` });
  console.log(`UI_OPS_DONE pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
