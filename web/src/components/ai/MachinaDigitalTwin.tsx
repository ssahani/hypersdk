// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { GitBranch, Zap } from 'lucide-react'
import { MacGlassPanel } from '../platform/mac/PlatformMacUi'
import {
  analyzeTwinImpact,
  getDigitalTwinGraph,
  type DigitalTwinGraph,
  type ImpactAnalysis,
} from '../../api/ai'

export default function MachinaDigitalTwin() {
  const [graph, setGraph] = useState<DigitalTwinGraph | null>(null)
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null)
  const [hostId, setHostId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const g = await getDigitalTwinGraph()
      setGraph(g)
      const firstHost = g.nodes.find((n) => n.kind === 'host')
      if (firstHost && !hostId) setHostId(firstHost.name)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load digital twin')
    }
  }, [hostId])

  useEffect(() => { void load() }, [load])

  const simulate = async () => {
    if (!hostId.trim()) return
    setBusy(true)
    setError(null)
    try {
      const r = await analyzeTwinImpact({
        action: 'shutdown',
        target_kind: 'host',
        target_id: hostId.trim(),
      })
      setImpact(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Impact simulation failed')
    } finally {
      setBusy(false)
    }
  }

  const hosts = graph?.nodes.filter((n) => n.kind === 'host') ?? []

  return (
    <MacGlassPanel
      title="Infrastructure Digital Twin"
      subtitle="Live datacenter graph — simulate blast radius before changes"
    >
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="block">
          <span className="text-xs text-slate-500">Host to simulate shutdown</span>
          <select className="input mt-1 block min-w-[12rem]" value={hostId} onChange={(e) => setHostId(e.target.value)}>
            {hosts.map((h) => (
              <option key={h.id} value={h.name}>{h.name} ({h.state})</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void simulate()}>
          {busy ? 'Simulating…' : 'What breaks?'}
        </button>
        {graph && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> {graph.node_count} nodes · {graph.edge_count} edges
          </span>
        )}
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {impact && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-slate-900/50 p-4 space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium text-slate-200">
            <Zap className="w-4 h-4 text-orange-400" />
            {impact.summary}
            <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${
              impact.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
              impact.severity === 'high' ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-700 text-slate-300'
            }`}>{impact.severity}</span>
          </p>
          {impact.affected_vms.length > 0 && (
            <p className="text-slate-400 text-xs">VMs affected: {impact.affected_vms.join(', ')}</p>
          )}
          {impact.affected_applications.length > 0 && (
            <p className="text-slate-400 text-xs">Applications: {impact.affected_applications.join(', ')}</p>
          )}
          {impact.recommendations.map((r) => (
            <p key={r} className="text-blue-300/90 text-xs">→ {r}</p>
          ))}
        </div>
      )}
    </MacGlassPanel>
  )
}
