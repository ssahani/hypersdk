#!/usr/bin/env node
/**
 * Seed docs/ux-wiring-live-manifest.json from nav sources + scraped tabs/filters + hand-curated actions.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs/ux-wiring-live-manifest.json')
const NAV_TS = path.join(ROOT, 'web/src/utils/platformNav.ts')
const APP_TSX = path.join(ROOT, 'web/src/App.tsx')
const PLATFORM_PAGES = path.join(ROOT, 'web/src/pages/platform')
const SETTINGS_HUB = path.join(PLATFORM_PAGES, 'PlatformSettingsHub.tsx')

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

function parsePlatformPaths() {
  const src = fs.readFileSync(NAV_TS, 'utf8')
  const fromSidebar = [...src.matchAll(/to: '(\/platform[^']*)'/g)].map((m) => m[1])
  const fromLabels = [...src.matchAll(/'(\/platform[^']+)':/g)].map((m) => m[1])
  const appSrc = fs.readFileSync(APP_TSX, 'utf8')
  const fromApp = [...appSrc.matchAll(/<Route path="([^"]+)" element=\{<Platform/g)].map((m) => {
    const routePath = m[1]
    return routePath === '' ? '/platform' : `/platform/${routePath}`
  })
  return [...new Set([...fromSidebar, ...fromLabels, ...fromApp])].sort()
}

function parseRouteComponents() {
  const src = fs.readFileSync(APP_TSX, 'utf8')
  const map = new Map()
  for (const m of src.matchAll(/<Route path="([^"]+)" element=\{<([A-Za-z0-9]+)/g)) {
    const routePath = m[1]
    const component = m[2]
    const full = routePath === '' ? '/platform' : routePath.startsWith('/') ? routePath : `/platform/${routePath}`
    map.set(component, full)
  }
  return map
}

function walkTsx(dir) {
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walkTsx(p))
    else if (ent.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

function extractLabelsFromArrayBlock(block) {
  const labels = []
  for (const m of block.matchAll(/label:\s*['"]([^'"]+)['"]/g)) labels.push(m[1])
  return labels
}

function extractTabLabels(src) {
  const labels = new Set()
  for (const m of src.matchAll(/const\s+[A-Z0-9_]+\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/g)) {
    for (const label of extractLabelsFromArrayBlock(m[1])) labels.add(label)
  }
  for (const m of src.matchAll(/<DetailTabs[\s\S]*?primary=\{\[([\s\S]*?)\]\}/g)) {
    for (const label of extractLabelsFromArrayBlock(m[1])) labels.add(label)
  }
  for (const m of src.matchAll(/more=\{\[([\s\S]*?)\]\}/g)) {
    for (const label of extractLabelsFromArrayBlock(m[1])) labels.add(label)
  }
  return [...labels]
}

function extractFilterPillLabels(src) {
  const labels = new Set()
  for (const m of src.matchAll(/<PlatformFilterPills[\s\S]*?options=\{\[([\s\S]*?)\]\}/g)) {
    for (const label of extractLabelsFromArrayBlock(m[1])) labels.add(label)
  }
  return [...labels]
}

function scrapePageActions() {
  const routeComponents = parseRouteComponents()
  const componentToFile = new Map()
  for (const file of walkTsx(PLATFORM_PAGES)) {
    const base = path.basename(file, '.tsx')
    componentToFile.set(base, file)
  }

  const byPath = new Map()
  for (const [component, routePath] of routeComponents.entries()) {
    const file = componentToFile.get(component)
    if (!file) continue
    const src = fs.readFileSync(file, 'utf8')
    const tabs = extractTabLabels(src)
    const pills = extractFilterPillLabels(src)
    if (tabs.length === 0 && pills.length === 0) continue
    byPath.set(routePath, {
      tabs: tabs.map((label) => ({ kind: 'tab', label })),
      pills: pills.map((label) => ({ kind: 'filterPill', label })),
    })
  }
  return byPath
}

function scrapeSettingsSections() {
  const src = fs.readFileSync(SETTINGS_HUB, 'utf8')
  const labels = []
  for (const m of src.matchAll(/\{\s*id:\s*'[^']+',\s*label:\s*'([^']+)'/g)) labels.push(m[1])
  return labels.map((label) => ({ kind: 'settingsSection', label }))
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
  },
  '/platform/tasks': {
    headingPattern: 'Tasks|Orchestration',
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

function mergeActions(pathKey, scraped, settingsSections) {
  const ov = ACTION_OVERRIDES[pathKey]?.actions ?? []
  const auto = []
  const s = scraped.get(pathKey)
  if (s) auto.push(...s.tabs, ...s.pills)
  if (pathKey === '/platform/settings') auto.push(...settingsSections)
  const seen = new Set()
  const merged = []
  for (const a of [...ov, ...auto]) {
    const key = `${a.kind}:${a.label ?? a.name ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(a)
  }
  return merged
}

function main() {
  const scraped = scrapePageActions()
  const settingsSections = scrapeSettingsSections()
  const entries = []

  for (const p of parsePlatformPaths()) {
    entries.push(entry('platform', p, { actions: mergeActions(p, scraped, settingsSections) }))
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
  const withActions = entries.filter((e) => (e.actions?.length ?? 0) > 0).length
  console.log(`Wrote ${OUT} (${entries.length} entries, ${withActions} with actions)`)
}

main()
