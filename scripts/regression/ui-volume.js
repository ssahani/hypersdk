#!/usr/bin/env node
'use strict';

/**
 * CDP UI: storage volumes, observability, VM detail console/backups shells.
 */

const { loadConfig } = require('./lib/config');
const { createApi } = require('./lib/api');
const { connectCdp, loginBrowser } = require('./lib/cdp');
const { createLogger } = require('./lib/log');

const cfg = loadConfig();
const { login } = createApi(cfg);
const log = createLogger(cfg.resultsDir, 'ui-volume');
const PID = process.env.MACHINA_PLATFORM_VM_ID || '3b2803c9-68e9-4235-b0f8-ef46a42c7a80';

const PATHS = [
  '/storage',
  '/storage/default',
  '/disk-images',
  '/backups',
  '/snapshots',
  `/vms/${cfg.vmName}`,
  `/platform/vms/${PID}`,
  `/platform/vms/${PID}/consolehub`,
  '/platform/storage',
  '/platform/storage-atlas',
  '/platform/backups',
  '/platform/observability',
  '/platform/reports',
  '/platform/activity',
  '/fleet',
];

(async () => {
  try {
    await login();
  } catch (e) {
    // Browser form login is authoritative for CDP; skip if PAM rate-limited.
    console.log('API_LOGIN_SKIP', String(e.message || e).slice(0, 120));
  }
  const cdp = await connectCdp(cfg.cdpUrl, { freshPage: true, url: cfg.baseUrl + '/' });
  await loginBrowser(cdp, cfg);
  let pass = 0;
  let soft = 0;
  let fail = 0;

  for (const path of PATHS) {
    try {
      await cdp.send('Page.navigate', { url: cfg.baseUrl + path });
      const wait = path.startsWith('/platform') || path.startsWith('/vms/') ? 12000 : 8000;
      const t0 = Date.now();
      let t = '';
      while (Date.now() - t0 < wait) {
        t = await cdp.evalAsync(
          `document.body ? document.body.innerText.replace(/\\s+/g, ' ').trim() : ''`,
        );
        if (t.length >= 120) break;
        await new Promise((r) => setTimeout(r, 350));
      }
      const crashed = /Something went wrong|Route not found/i.test(t);
      if (crashed) {
        fail++;
        log.append({ kind: 'UI', path, ok: false, note: `FAIL ${t.slice(0, 140)}` });
      } else if (t.length < 100) {
        soft++;
        log.append({ kind: 'UI', path, ok: true, soft: true, note: `SOFT len=${t.length}` });
      } else {
        pass++;
        log.append({ kind: 'UI', path, ok: true, note: `len=${t.length}` });
      }
    } catch (e) {
      fail++;
      log.append({ kind: 'UI', path, ok: false, note: e.message.slice(0, 180) });
    }
  }

  try {
    cdp.ws.close();
  } catch {
    /* ignore */
  }

  log.append({ kind: 'SUMMARY', ok: fail === 0, note: `pass=${pass} soft=${soft} fail=${fail}` });
  console.log(`UI_VOLUME_DONE pass=${pass} soft=${soft} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
