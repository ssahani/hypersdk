// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { GitBranch } from 'lucide-react'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import MachinaNetworkLens from '../../components/ai/MachinaNetworkLens'
import MachinaDigitalTwin from '../../components/ai/MachinaDigitalTwin'
import { getClusterTopology, type TopologyGraph } from '../../api/platform'

export default function PlatformTopology() {
  const [graph, setGraph] = useState<TopologyGraph | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setGraph(await getClusterTopology())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load topology')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Topology" subtitle="Digital twin graph — hosts, VMs, storage, and networks" />
      {error && <ErrorBanner message={error} />}
      <MachinaDigitalTwin />
      <MachinaNetworkLens vmNames={graph?.nodes.filter((n) => n.kind === 'vm').map((n) => n.name) ?? []} />
      {graph?.warnings.map((w, i) => (
        <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {w.message}
        </div>
      ))}
      <div className="card p-5 space-y-4 font-mono text-xs overflow-x-auto">
        {graph?.nodes.filter((n) => n.kind === 'cluster').map((c) => (
          <div key={c.id}>
            <p className="text-slate-300 font-semibold">▸ {c.name}</p>
            {graph.nodes.filter((n) => n.kind === 'host').map((h) => (
              <div key={h.id} className="ml-4 mt-2">
                <p className="text-blue-400">└ {h.name} <span className="text-slate-600">({h.state})</span></p>
                {graph.edges.filter((e) => e.from === h.id && e.label === 'runs').map((e) => {
                  const vm = graph.nodes.find((n) => n.id === e.to)
                  return vm ? (
                    <p key={e.to} className="ml-6 text-emerald-400/90">
                      → <Link to={`/platform/vms/${vm.id}`} className="hover:underline">{vm.name}</Link>
                      <span className="text-slate-600"> ({vm.state})</span>
                    </p>
                  ) : null
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
