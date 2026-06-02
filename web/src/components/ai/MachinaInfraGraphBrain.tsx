// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { GitBranch, Search } from 'lucide-react'
import { MacGlassPanel } from '../platform/mac/PlatformMacUi'
import {
  explainInfraPath,
  getInfraGraph,
  queryInfraGraph,
  type InfraGraph,
  type PathResult,
} from '../../api/ai'
import { statusToneClass } from '../../utils/semanticColors'

export default function MachinaInfraGraphBrain() {
  const [graph, setGraph] = useState<InfraGraph | null>(null)
  const [pathFrom, setPathFrom] = useState('')
  const [pathTo, setPathTo] = useState('')
  const [port, setPort] = useState('')
  const [path, setPath] = useState<PathResult | null>(null)
  const [search, setSearch] = useState('Ubuntu VMs over 8GB RAM')
  const [searchHits, setSearchHits] = useState<Array<{ kind: string; name: string; detail: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setGraph(await getInfraGraph())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Graph unavailable')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const runPath = async () => {
    if (!pathFrom.trim() || !pathTo.trim()) return
    setBusy(true)
    setError(null)
    try {
      setPath(await explainInfraPath({
        from: pathFrom.trim(),
        to: pathTo.trim(),
        port: port ? Number(port) : undefined,
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Path analysis failed')
    } finally {
      setBusy(false)
    }
  }

  const runSearch = async () => {
    setBusy(true)
    try {
      const r = await queryInfraGraph(search)
      setSearchHits(r.hits.map((h) => ({ kind: h.kind, name: h.name, detail: h.detail })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <MacGlassPanel title="Infrastructure Graph Brain" className="space-y-4">
      {error && <p className={`text-sm ${statusToneClass('error')}`}>{error}</p>}
      {graph && (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          {graph.node_count} nodes · {graph.edge_count} edges (hosts, VMs, storage, networks, backups, apps)
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400">Connectivity path</p>
        <div className="flex flex-wrap gap-2">
          <input className="input text-sm flex-1 min-w-[8rem]" placeholder="From VM" value={pathFrom} onChange={(e) => setPathFrom(e.target.value)} />
          <input className="input text-sm flex-1 min-w-[8rem]" placeholder="To VM" value={pathTo} onChange={(e) => setPathTo(e.target.value)} />
          <input className="input text-sm w-20" placeholder="Port" value={port} onChange={(e) => setPort(e.target.value)} />
          <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void runPath()}>Analyze</button>
        </div>
        {path && (
          <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3 text-sm space-y-2">
            <p className={path.can_reach ? 'text-emerald-300' : 'text-amber-300'}>{path.explanation}</p>
            <p className="text-xs text-slate-500">Hops: {path.hops.join(' → ')}</p>
            {path.blockers.map((b) => (
              <p key={b.kind} className="text-xs text-amber-200/90">{b.message} — {b.remediation}</p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400 flex items-center gap-1"><Search className="w-3.5 h-3.5" /> Infrastructure search</p>
        <div className="flex gap-2">
          <input className="input text-sm flex-1" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void runSearch()}>Search</button>
        </div>
        <ul className="text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto">
          {searchHits.map((h) => (
            <li key={`${h.kind}-${h.name}`}><span className="text-slate-500">{h.kind}</span> {h.name} — {h.detail}</li>
          ))}
        </ul>
      </div>
    </MacGlassPanel>
  )
}
