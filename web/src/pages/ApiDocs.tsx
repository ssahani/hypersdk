import { useEffect, useState, useMemo } from 'react'
import { Search } from 'lucide-react'

interface PathItem {
  summary?: string
  description?: string
  tags?: string[]
  parameters?: { name: string; in: string; required?: boolean; schema?: { type: string } }[]
  requestBody?: { content?: { 'application/json'?: { schema?: unknown } } }
  responses?: Record<string, { description?: string }>
}

interface OpenApiSpec {
  info: { title: string; version: string; description?: string }
  paths: Record<string, Record<string, PathItem>>
}

const METHOD_COLORS: Record<string, string> = {
  get: 'bg-green-600/20 text-green-400 border-green-600/30',
  post: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  put: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  delete: 'bg-red-600/20 text-red-400 border-red-600/30',
  patch: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
}

export default function ApiDocs() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/openapi.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setSpec)
      .catch((e) => setError(`Failed to load OpenAPI spec: ${e.message}`))
  }, [])

  const endpoints = useMemo(() => {
    if (!spec) return []
    const list: { method: string; path: string; summary: string; tags: string[] }[] = []
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, detail] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          list.push({
            method: method.toUpperCase(),
            path,
            summary: detail.summary || detail.description || '',
            tags: detail.tags || [],
          })
        }
      }
    }
    return list
  }, [spec])

  const filtered = useMemo(() => {
    if (!search.trim()) return endpoints
    const q = search.toLowerCase()
    return endpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [endpoints, search])

  if (error) return <div className="text-red-400 py-12 text-center">{error}</div>
  if (!spec) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{spec.info.title}</h1>
        <p className="text-sm text-slate-400 mt-1">Version {spec.info.version} {spec.info.description ? `- ${spec.info.description}` : ''}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search endpoints by path, method, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-slate-200"
        />
      </div>

      <div className="text-xs text-slate-500">{filtered.length} of {endpoints.length} endpoints</div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/30 overflow-hidden">
        {filtered.map((ep, i) => (
          <div key={`${ep.method}-${ep.path}-${i}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-700/20 transition">
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${METHOD_COLORS[ep.method.toLowerCase()] || 'bg-slate-600/20 text-slate-400'}`} style={{ minWidth: '60px', textAlign: 'center' }}>
              {ep.method}
            </span>
            <code className="text-sm font-mono text-blue-300 flex-shrink-0">{ep.path}</code>
            <span className="text-sm text-slate-400 truncate">{ep.summary}</span>
            <div className="flex gap-1 ml-auto flex-shrink-0">
              {ep.tags.map((t) => (
                <span key={t} className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] text-slate-400">{t}</span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-6 py-8 text-center text-slate-500">No endpoints match your search</div>
        )}
      </div>
    </div>
  )
}
