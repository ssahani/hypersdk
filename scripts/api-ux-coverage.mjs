#!/usr/bin/env node
/**
 * Maps controller HTTP routes to UX surfaces.
 * Usage: node scripts/api-ux-coverage.mjs [--check] [--write]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOD_RS = path.join(ROOT, 'controller/src/api/mod.rs')
const WEB_SRC = path.join(ROOT, 'web/src')
const MANIFEST = path.join(ROOT, 'docs/api-ux-route-manifest.json')
const OUT_JSON = path.join(ROOT, 'docs/api-ux-coverage.json')
const OUT_MD = path.join(ROOT, 'docs/api-ux-coverage.md')

const DOCUMENTED = new Set([
  '/api/v1/health/ready',
  '/api/v1/metrics/prometheus',
  '/api/v1/install.sh',
  '/api/v1/hosts/join',
])

const CONSOLE_PREFIXES = ['/api/v1/']

function read(p) {
  return fs.readFileSync(p, 'utf8')
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, acc)
    else if (/\.(tsx?|jsx?)$/.test(ent.name)) acc.push(full)
  }
  return acc
}

function parseRoutes(modSrc) {
  const routes = []
  const re = /\.route\s*\(\s*"([^"]+)"\s*,([^)]+(?:\([^)]*\)[^)]*)*)\)/gs
  let m
  while ((m = re.exec(modSrc)) !== null) {
    const routePath = m[1]
    const handlers = m[2]
    const methods = []
    if (/\bget\s*\(/.test(handlers)) methods.push('GET')
    if (/\bpost\s*\(/.test(handlers)) methods.push('POST')
    if (/\bpatch\s*\(/.test(handlers)) methods.push('PATCH')
    if (/\bdelete\s*\(/.test(handlers)) methods.push('DELETE')
    if (/\bput\s*\(/.test(handlers)) methods.push('PUT')
    routes.push({ path: routePath, methods })
  }
  return routes
}

function normPath(p) {
  return p.replace(/\{[^}]+\}/g, '{id}')
}

function pathRegex(routePath) {
  const escaped = routePath.replace(/\{[^}]+\}/g, '[^/]+').replace(/\//g, '\\/')
  return new RegExp(escaped)
}

function surfaceForFile(file) {
  const rel = path.relative(WEB_SRC, file).replace(/\\/g, '/')
  if (rel.startsWith('pages/platform/')) return 'page'
  if (rel.startsWith('pages/OpenStack') || rel.includes('/openstack')) return 'openstack'
  if (rel.startsWith('pages/K8s') || rel === 'pages/KataContainers.tsx') return 'k8s'
  if (rel.startsWith('pages/')) return 'classic'
  if (rel.startsWith('components/platform/')) return 'page'
  return null
}

function buildUsageIndex(files) {
  const byPath = new Map()
  for (const file of files) {
    const src = read(file)
    const surface = surfaceForFile(file)
    if (!surface) continue
    const paths = [...src.matchAll(/['"`](\/api\/v1[^'"`$]*|\/openstack[^'"`$]*|\/k8s[^'"`$]*)['"`]/g)].map((x) => x[1])
    for (const p of paths) {
      const key = normPath(p.split('?')[0])
      if (!byPath.has(key)) byPath.set(key, new Set())
      byPath.get(key).add(surface)
    }
  }
  return byPath
}

function classify(route, usageIndex, manifest) {
  const key = normPath(route.path)
  if (manifest.routes?.[route.path]) return manifest.routes[route.path]
  if (manifest.routes?.[key]) return manifest.routes[key]
  if (DOCUMENTED.has(route.path) || DOCUMENTED.has(key)) return 'documented'

  const surfaces = usageIndex.get(key)
  if (surfaces?.has('page')) return 'page'
  if (surfaces?.has('openstack')) return 'openstack'
  if (surfaces?.has('k8s')) return 'k8s'
  if (surfaces?.has('classic')) return 'classic'

  for (const [usedPath, s] of usageIndex) {
    if (pathRegex(route.path).test(usedPath) || pathRegex(usedPath).test(route.path)) {
      if (s.has('page')) return 'page'
      if (s.has('openstack')) return 'openstack'
      if (s.has('k8s')) return 'k8s'
      if (s.has('classic')) return 'classic'
    }
  }

  if (manifest.defaults?.console && CONSOLE_PREFIXES.some((p) => route.path.startsWith(p))) {
    return 'console'
  }
  return 'unmapped'
}

function main() {
  const check = process.argv.includes('--check')
  const write = process.argv.includes('--write') || !check

  const manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(read(MANIFEST))
    : { defaults: { console: true }, routes: {} }

  const routes = parseRoutes(read(MOD_RS))
  const files = walk(WEB_SRC)
  const usageIndex = buildUsageIndex(files)

  const rows = routes.map((r) => ({
    path: r.path,
    methods: r.methods,
    surface: classify(r, usageIndex, manifest),
  }))

  const counts = {}
  for (const row of rows) counts[row.surface] = (counts[row.surface] || 0) + 1
  const unmapped = rows.filter((r) => r.surface === 'unmapped')

  const report = {
    generated_at: new Date().toISOString(),
    total_routes: rows.length,
    counts,
    unmapped_count: unmapped.length,
    routes: rows,
  }

  if (write) {
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2))
    const md = [
      '# API ↔ UX coverage',
      '',
      `Generated: ${report.generated_at}`,
      '',
      '| Surface | Routes |',
      '|---------|--------|',
      ...Object.entries(counts).sort().map(([k, v]) => `| ${k} | ${v} |`),
      '',
      unmapped.length
        ? `**Unmapped:** ${unmapped.length} — see \`api-ux-coverage.json\``
        : '**All routes mapped.**',
      '',
    ].join('\n')
    fs.writeFileSync(OUT_MD, md)
    console.log(`Wrote ${OUT_JSON} (${rows.length} routes, ${unmapped.length} unmapped)`)
  }

  if (check && unmapped.length > 0) {
    console.error(`API UX coverage check failed: ${unmapped.length} unmapped route(s)`)
    for (const u of unmapped.slice(0, 20)) console.error(`  ${u.methods.join(',')} ${u.path}`)
    process.exit(1)
  }
  if (check) console.log(`API UX coverage OK (${rows.length} routes)`)
}

main()
