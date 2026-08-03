#!/usr/bin/env node
'use strict';

/**
 * Cross-layer NIC + observability: classic nic attach/detach must show up on
 * platform GET /vms/{id}/nics; HA/events/SOC/webhooks/templates smoke.
 */

const { loadConfig } = require('./lib/config');
const { createApi } = require('./lib/api');
const { createLogger } = require('./lib/log');

const cfg = loadConfig();
const { api, login } = createApi(cfg);
const log = createLogger(cfg.resultsDir, 'ops-net');
const VM = cfg.vmName;
const PID = process.env.MACHINA_PLATFORM_VM_ID || '3b2803c9-68e9-4235-b0f8-ef46a42c7a80';
const HID = process.env.MACHINA_HOST_ID || '98e60da1-5656-404c-87e9-207ae19ebd86';
const P = '/api/v1/platform/controller';

function ok(status) {
  return status >= 200 && status < 400;
}
function isHtml(body) {
  return /^<!DOCTYPE/i.test(body || '');
}

async function step(name, fn) {
  try {
    const note = await fn();
    log.append({ kind: 'NET', api: name, ok: true, note: String(note || 'ok').slice(0, 180) });
    return true;
  } catch (e) {
    log.append({ kind: 'NET', api: name, ok: false, note: e.message.slice(0, 220) });
    return false;
  }
}

async function getJson(path) {
  const r = await api('GET', path);
  if (!ok(r.status) || isHtml(r.body)) throw new Error(`${path} ${r.status}`);
  return JSON.parse(r.body);
}

async function platformNics() {
  const j = await getJson(`${P}/api/v1/vms/${PID}/nics`);
  if (!Array.isArray(j)) throw new Error('nics not array');
  return j;
}

function macOf(n) {
  return String(n.mac_address || n.mac || n.address || '').toLowerCase();
}

async function ensureRunning() {
  let state = JSON.parse((await api('GET', `/api/v1/vms/${VM}`)).body).state;
  if (state === 'paused') {
    await api('POST', `/api/v1/vms/${VM}/resume`);
    await new Promise((x) => setTimeout(x, 1500));
    state = JSON.parse((await api('GET', `/api/v1/vms/${VM}`)).body).state;
  }
  if (state !== 'running') {
    await api('POST', `/api/v1/vms/${VM}/start`);
    await new Promise((x) => setTimeout(x, 2500));
    state = JSON.parse((await api('GET', `/api/v1/vms/${VM}`)).body).state;
  }
  if (state !== 'running') throw new Error(state);
  return state;
}

(async () => {
  await login({ retries: 5, waitMs: 65000 });
  let pass = 0;
  let fail = 0;
  const mark = async (name, fn) => {
    if (await step(name, fn)) pass++;
    else fail++;
  };

  let baseline = 0;
  let addedMac = '';

  await mark('ensure-running', async () => ensureRunning());

  await mark('daemon-health', async () => {
    const j = await getJson('/api/v1/health');
    if (j.status !== 'healthy' && j.status !== 'ok') throw new Error(JSON.stringify(j));
    return `libvirt=${j.libvirt}`;
  });

  await mark('controller-health', async () => {
    const j = await getJson(`${P}/api/v1/health`);
    if (j.status !== 'ok' && j.status !== 'healthy') throw new Error(JSON.stringify(j));
    return j.component || j.status;
  });

  await mark('platform-nics-baseline', async () => {
    const nics = await platformNics();
    baseline = nics.length;
    if (baseline < 1) throw new Error('expected ≥1 nic');
    return `count=${baseline}`;
  });

  await mark('classic-interfaces', async () => {
    const j = await getJson(`/api/v1/vms/${VM}/interfaces`);
    if (!j.network_gateways && !Array.isArray(j.addresses)) throw new Error('empty');
    return `gw=${Object.keys(j.network_gateways || {}).length}`;
  });

  await mark('networks-default', async () => {
    const nets = await getJson('/api/v1/networks');
    if (!Array.isArray(nets) || !nets.some((n) => n.name === 'default')) throw new Error('no default');
    return `nets=${nets.length}`;
  });

  await mark('nic-attach', async () => {
    const before = new Set((await platformNics()).map(macOf));
    const r = await api('POST', `/api/v1/vms/${VM}/nic/attach`, {
      network: 'default',
      model: 'virtio',
    });
    if (!ok(r.status) || isHtml(r.body)) throw new Error(`attach ${r.status}`);
    // settle libvirt + controller inventory
    let added = '';
    for (let i = 0; i < 20; i++) {
      await new Promise((x) => setTimeout(x, 500));
      const nics = await platformNics();
      const fresh = nics.map(macOf).filter((m) => m && !before.has(m));
      if (fresh.length) {
        added = fresh[0];
        break;
      }
    }
    if (!added) throw new Error('platform nics did not grow after attach');
    addedMac = added;
    return `mac=${addedMac}`;
  });

  await mark('platform-nics-after-attach', async () => {
    const nics = await platformNics();
    if (nics.length < baseline + 1) throw new Error(`count=${nics.length} want≥${baseline + 1}`);
    if (!nics.some((n) => macOf(n) === addedMac)) throw new Error('mac missing');
    return `count=${nics.length}`;
  });

  await mark('nic-detach', async () => {
    const r = await api('POST', `/api/v1/vms/${VM}/nic/detach/${encodeURIComponent(addedMac)}`);
    if (!ok(r.status) || isHtml(r.body)) throw new Error(`detach ${r.status}`);
    for (let i = 0; i < 20; i++) {
      await new Promise((x) => setTimeout(x, 500));
      const nics = await platformNics();
      if (!nics.some((n) => macOf(n) === addedMac) && nics.length <= baseline) {
        return `count=${nics.length}`;
      }
    }
    const nics = await platformNics();
    if (nics.some((n) => macOf(n) === addedMac)) throw new Error('mac still present');
    return `count=${nics.length}`;
  });

  await mark('ha-status', async () => {
    const j = await getJson(`${P}/api/v1/ha/status`);
    if (!j.status) throw new Error('no status');
    return `enabled_vms=${j.status.enabled_vms}`;
  });

  await mark('events', async () => {
    const j = await getJson(`${P}/api/v1/events`);
    if (!Array.isArray(j) || j.length < 1) throw new Error('empty events');
    return `count=${j.length} kind=${j[0].kind}`;
  });

  await mark('notifications', async () => {
    const j = await getJson(`${P}/api/v1/notifications`);
    if (!Array.isArray(j)) throw new Error('not array');
    return `count=${j.length}`;
  });

  await mark('soc-alerts', async () => {
    const j = await getJson(`${P}/api/v1/soc/alerts`);
    if (!Array.isArray(j)) throw new Error('not array');
    return `count=${j.length}`;
  });

  await mark('webhooks', async () => {
    const j = await getJson(`${P}/api/v1/webhooks`);
    if (!Array.isArray(j)) throw new Error('not array');
    return `count=${j.length}`;
  });

  await mark('host-gpus', async () => {
    const j = await getJson(`${P}/api/v1/hosts/${HID}/gpus`);
    if (!Array.isArray(j.devices) && !Array.isArray(j)) throw new Error('no devices');
    const n = (j.devices || j).length;
    return `devices=${n}`;
  });

  await mark('templates-classic', async () => {
    const j = await getJson('/api/v1/templates');
    if (!Array.isArray(j) || j.length < 1) throw new Error('empty');
    return `count=${j.length}`;
  });

  await mark('templates-platform', async () => {
    const j = await getJson(`${P}/api/v1/templates`);
    if (!Array.isArray(j) || j.length < 1) throw new Error('empty');
    return `count=${j.length}`;
  });

  await mark('vm-xml', async () => {
    const r = await api('GET', `/api/v1/vms/${VM}/xml`);
    if (!ok(r.status) || isHtml(r.body)) throw new Error(`${r.status}`);
    if (!/<domain[\s>]/.test(r.body)) throw new Error('no domain');
    return `bytes=${r.body.length}`;
  });

  await mark('leave-one-nic', async () => {
    const nics = await platformNics();
    if (nics.length < 1) throw new Error('zero nics left');
    // detach any extras beyond first (cleanup leftover probes)
    const keep = macOf(nics[0]);
    for (const n of nics.slice(1)) {
      const mac = macOf(n);
      if (!mac || mac === keep) continue;
      await api('POST', `/api/v1/vms/${VM}/nic/detach/${encodeURIComponent(mac)}`);
    }
    const final = await platformNics();
    return `count=${final.length}`;
  });

  log.append({ kind: 'SUMMARY', ok: fail === 0, note: `pass=${pass} fail=${fail}` });
  console.log(`NET_OPS_DONE pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
