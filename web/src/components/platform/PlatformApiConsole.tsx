// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Search } from 'lucide-react'
import JsonInspector from './JsonInspector'
import { getControllerBase, platformFetch } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'

interface OpenApiOp {
  id: string
  method: HttpMethod
  path: string
  summary: string
  tag: string
}

interface OpenApiSpec {
  paths?: Record<string, Record<string, { summary?: string; operationId?: string }>>
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT']

const AGENT_ONLY = new Set([
  '/api/v1/hosts/join',
  '/api/v1/install.sh',
  '/api/v1/metrics/prometheus',
])

function groupTag(path: string) {
  const parts = path.replace(/^\/api\/v1\//, '').split('/')
  return parts[0] || 'root'
}

function buildOps(spec: OpenApiSpec): OpenApiOp[] {
  const ops: OpenApiOp[] = []
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const lower = method.toLowerCase()
      if (!methods[lower]) continue
      const meta = methods[lower]
      ops.push({
        id: `${method}:${path}`,
        method,
        path,
        summary: meta.summary ?? meta.operationId ?? path,
        tag: groupTag(path),
      })
    }
  }
  return ops.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}

/** Fallback catalog when openapi.json is minimal — covers controller routes for try-it UX. */
function fallbackOps(): OpenApiOp[] {
  const paths = [
    '/api/v1/health',
    '/api/v1/cluster',
    '/api/v1/hosts',
    '/api/v1/vms',
    '/api/v1/users/me',
    '/api/v1/backup-targets',
    '/api/v1/network/segments/gitops/export',
    '/api/v1/developer/overview',
    '/api/v1/fleet/mission',
    '/api/v1/ai/fleet/heatmap',
    '/api/v1/zeus-firewall/compliance/production',
  ]
  return paths.flatMap((path) => {
    const m: HttpMethod[] = path.includes('export') || path.includes('heatmap') || path.includes('compliance') || path.includes('overview') || path.includes('mission') || path.includes('health') || path.includes('cluster') || path.includes('me') || path.endsWith('hosts') || path.endsWith('vms') || path.endsWith('backup-targets')
      ? ['GET']
      : ['GET', 'POST']
    return m.map((method) => ({
      id: `${method}:${path}`,
      method,
      path,
      summary: `${method} ${path}`,
      tag: groupTag(path),
    }))
  })
}

export default function PlatformApiConsole() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<OpenApiOp | null>(null)
  const [body, setBody] = useState('{}')
  const [pathParams, setPathParams] = useState<Record<string, string>>({})
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void platformFetch<OpenApiSpec>('/api/v1/openapi.json')
      .then(setSpec)
      .catch(() => setSpec({ paths: {} }))
  }, [])

  const ops = useMemo(() => {
    const built = spec ? buildOps(spec) : []
    return built.length > 3 ? built : fallbackOps()
  }, [spec])

  const tags = useMemo(() => [...new Set(ops.map((o) => o.tag))].sort(), [ops])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ops
    return ops.filter((o) => o.path.toLowerCase().includes(q) || o.summary.toLowerCase().includes(q) || o.tag.includes(q))
  }, [ops, query])

  const selectOp = (op: OpenApiOp) => {
    setSelected(op)
    setResult(null)
    setError(null)
    const params: Record<string, string> = {}
    for (const m of op.path.matchAll(/\{([^}]+)\}/g)) params[m[1]] = ''
    setPathParams(params)
    setBody(op.method === 'GET' || op.method === 'DELETE' ? '' : '{}')
  }

  const resolvedPath = useCallback(() => {
    if (!selected) return ''
    let p = selected.path
    for (const [k, v] of Object.entries(pathParams)) {
      p = p.replace(`{${k}}`, encodeURIComponent(v || 'id'))
    }
    return p
  }, [selected, pathParams])

  const execute = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const path = resolvedPath()
      if (AGENT_ONLY.has(selected.path)) {
        setResult({
          note: 'Agent-only route — use shell command instead',
          curl: `curl -fsS ${getControllerBase()}${path}`,
        })
        return
      }
      const init: RequestInit = { method: selected.method }
      if (selected.method !== 'GET' && selected.method !== 'DELETE' && body.trim()) {
        init.body = body
        init.headers = { 'Content-Type': 'application/json' }
      }
      const data = await platformFetch<unknown>(path, init)
      setResult(data)
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="tahoe-glass-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/25 border border-white/10 text-sm text-white"
            placeholder="Filter operations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[28rem] overflow-y-auto space-y-3">
          {tags.map((tag) => {
            const group = filtered.filter((o) => o.tag === tag)
            if (!group.length) return null
            return (
              <section key={tag}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{tag}</h3>
                <ul className="space-y-1">
                  {group.map((op) => (
                    <li key={op.id}>
                      <button
                        type="button"
                        onClick={() => selectOp(op)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition ${
                          selected?.id === op.id ? 'bg-sky-500/15 text-sky-100' : 'text-slate-300 hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="font-mono text-sky-300/90">{op.method}</span>{' '}
                        <span className="font-mono">{op.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>

      <div className="tahoe-glass-card p-4 space-y-3">
        {!selected ? (
          <p className="text-sm text-slate-400">Select an operation to try it against the controller.</p>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-white">{selected.summary}</p>
              <p className="text-xs font-mono text-slate-400 mt-1">{selected.method} {resolvedPath()}</p>
            </div>
            {Object.keys(pathParams).length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.keys(pathParams).map((k) => (
                  <label key={k} className="text-xs text-slate-400">
                    {k}
                    <input
                      className="input text-sm mt-1 w-full"
                      value={pathParams[k]}
                      onChange={(e) => setPathParams((prev) => ({ ...prev, [k]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            )}
            {selected.method !== 'GET' && selected.method !== 'DELETE' && (
              <textarea
                className="input text-xs font-mono min-h-[8rem] w-full"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            )}
            <button type="button" className="tahoe-btn-primary text-sm" disabled={busy} onClick={() => void execute()}>
              <Play className="w-3.5 h-3.5" /> {busy ? 'Running…' : 'Execute'}
            </button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            {result != null ? (
              <JsonInspector data={result} />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
