#!/usr/bin/env node
/**
 * Seed docs/ux-wiring-live-manifest.json from nav sources + hand-curated actions.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs/ux-wiring-live-manifest.json')
const NAV_TS = path.join(ROOT, 'web/src/utils/platformNav.ts')

const POWER_ONLY = new Set([
  '/platform/applications', '/platform/networks', '/platform/content', '/platform/templates',
  '/platform/migration', '/platform/tasks', '/platform/activity', '/platform/blueprints',
  '/platform/projects', '/platform/zeus', '/platform/zeus/security/firewall',
  '/platform/maintenance', '/platform/recommendations', '/platform/topology',
  '/platform/events', '/platform/enroll', '/platform/reports', '/platform/storage',
  '/openstack', '/k8s', '/fleet',
])

const ADVANCED_ONLY = new Set([
  '/platform/developer', '/platform/zeus/security/policies', '/platform/policy',
  '/platform/observability', '/platform/users', '/platform/enterprise', '/platform/webhooks',
  '/platform/api-keys', '/platform/zeus/security/ports', '/platform/zeus/security/services',
  '/platform/zeus/security/activity', '/platform/zeus/security/compliance',
  '/platform/zeus/security/k8s', '/platform/zeus/security/cloud', '/platform/zeus/security/connectivity',
])

function tierForPath(p) {
  if (ADVANCED_ONLY.has(p) || [...ADVANCED_ONLY].some((x) => p.startsWith(`${x}/`))) return 'advanced'
  if (POWER_ONLY.has(p) || p.startsWith('/openstack') || p.startsWith('/k8s') || p.startsWith('/fleet')) return 'power'
  return 'normal'
}

function parsePlatformNav() {
  const src = fs.readFileSync(NAV_TS, 'utf8')
  const paths = [...src.matchAll(/to: '(\/platform[^']*)'/g)].map((m) => m[1])
  return [...new Set(paths)]
}

const ACTION_OVERRIDES = {
  '/platform/backups': {
    headingPattern: 'Backup|Time Machine',
    actions: [
      { kind: 'tab', label: 'Timeline' },
      { kind: 'tab', label: 'Destinations' },
    ],
  },
  '/platform/developer': {
    headingPattern: 'Developer',
    tier: 'advanced',
    actions: [
      { kind: 'tab', label: 'API Console' },
      { kind: 'click', role: 'button', name: 'Controller (fleet)' },
      { kind: 'click', role: 'button', name: 'Host (daemon)' },
    ],
  },
  '/platform/settings': {
    headingPattern: 'Settings|General',
    actions: [
      { kind: 'settingsSection', label: 'General' },
      { kind: 'settingsSection', label: 'Security' },
      { kind: 'settingsSection', label: 'Network' },
    ],
  },
  '/platform/zeus/security/policies': {
    headingPattern: 'Policy Studio',
    tier: 'advanced',
  },
  '/platform/integrations': {
    headingPattern: 'Apps & Integrations',
  },
  '/api-docs': {
    shell: 'classic',
    headingPattern: 'Machina Host|Machina API|API',
  },
}

const CLASSIC_ROUTES = [
  '/', '/vms', '/fleet', '/storage', '/networks', '/disk-images', '/snapshots',
  '/node', '/events', '/capabilities', '/devices', '/nwfilters', '/secrets',
  '/backups', '/host-networking', '/audit', '/import', '/api-docs', '/services',
  '/system-check', '/logs', '/settings', '/jobs',
]

const OPENSTACK_ROUTES = [
  '/openstack', '/openstack/instances', '/openstack/images', '/openstack/volumes',
  '/openstack/volume-snapshots', '/openstack/flavors', '/openstack/server-groups',
  '/openstack/networking', '/openstack/topology', '/openstack/floating-ips',
  '/openstack/heat', '/openstack/load-balancers', '/openstack/identity',
  '/openstack/keypairs', '/openstack/security-groups', '/openstack/migrations',
]

const K8S_ROUTES = ['/k8s', '/k8s/workloads', '/k8s/kata']

const HEADING_DEFAULTS = {
  '/platform': 'Dashboard|Production Cluster|Platform',
  '/platform/vms': 'Finder|Virtual Machines',
  '/platform/hosts': 'Hosts',
  '/platform/storage': 'Storage|Disk',
  '/platform/networks': 'Networks',
  '/openstack': 'OpenStack|Overview',
  '/k8s': 'Kubernetes|KubeVirt|Cluster',
}

function entry(shell, p, extra = {}) {
  const base = {
    id: `${shell}:${p}`,
    shell,
    path: p,
    tier: tierForPath(p),
    headingPattern: HEADING_DEFAULTS[p] ?? '.+',
    requires: null,
    actions: [],
  }
  const ov = ACTION_OVERRIDES[p] ?? {}
  return { ...base, ...extra, ...ov, path: p, shell }
}

function main() {
  const entries = []

  for (const p of parsePlatformNav()) {
    entries.push(entry('platform', p))
  }

  for (const p of CLASSIC_ROUTES) {
    if (p === '/') entries.push(entry('classic', p, { headingPattern: 'Machina|Dashboard|VMs' }))
    else entries.push(entry('classic', p))
  }

  for (const p of OPENSTACK_ROUTES) {
    entries.push(entry('openstack', p, { requires: 'openstack', tier: 'power' }))
  }

  for (const p of K8S_ROUTES) {
    entries.push(entry('k8s', p, { requires: 'k8s', tier: 'power' }))
  }

  const manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    entries: entries.sort((a, b) => a.path.localeCompare(b.path)),
  }

  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Wrote ${OUT} (${entries.length} entries)`)
}

main()
