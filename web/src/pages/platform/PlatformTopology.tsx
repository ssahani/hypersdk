// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Cable, GitBranch, Layers } from 'lucide-react'
import { MacSectionTitle, MacGlassPanel } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import MachinaNetworkLens from '../../components/ai/MachinaNetworkLens'
import MachinaDigitalTwin from '../../components/ai/MachinaDigitalTwin'
import {
  getClusterTopology,
  getHostLldp,
  listPlatformHosts,
  type HostLldpInventory,
  type TopologyGraph,
} from '../../api/platform'

type LldpStripEntry = {
  hostId: string
  hostname: string
  lldp: HostLldpInventory | null
  error?: string
}

export default function PlatformTopology() {
  const [graph, setGraph] = useState<TopologyGraph | null>(null)
  const [lldpStrip, setLldpStrip] = useState<LldpStripEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [topo, hosts] = await Promise.all([
        getClusterTopology(),
        listPlatformHosts(),
      ])
      setGraph(topo)

      const online = hosts.filter((h) => h.state === 'online').slice(0, 8)
      const strip = await Promise.all(
        online.map(async (h) => {
          try {
            const lldp = await getHostLldp(h.id)
            return { hostId: h.id, hostname: h.hostname, lldp }
          } catch (e: unknown) {
            return {
              hostId: h.id,
              hostname: h.hostname,
              lldp: null,
              error: e instanceof Error ? e.message : 'LLDP unavailable',
            }
          }
        }),
      )
      setLldpStrip(strip)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load topology')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const segmentLegend = useMemo(
    () => graph?.nodes.filter((n) => n.kind === 'segment') ?? [],
    [graph],
  )

  const uplinkEdges = useMemo(
    () => graph?.edges.filter((e) => e.label === 'uplink') ?? [],
    [graph],
  )

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Topology" subtitle="Digital twin graph — hosts, VMs, overlay segments, and LLDP uplinks" />
      {error && <ErrorBanner message={error} />}
      <MachinaDigitalTwin />
      <MachinaNetworkLens vmNames={graph?.nodes.filter((n) => n.kind === 'vm').map((n) => n.name) ?? []} />

      {(segmentLegend.length > 0 || uplinkEdges.length > 0) && (
        <MacGlassPanel title="Overlay legend" subtitle="Segment nodes and LLDP uplink edges from cluster topology.">
          <div className="flex flex-wrap gap-4 text-sm">
            {segmentLegend.map((s) => (
              <span key={s.id} className="flex items-center gap-2 text-violet-300">
                <Layers className="w-4 h-4" /> {s.name}
              </span>
            ))}
            {uplinkEdges.length > 0 && (
              <span className="flex items-center gap-2 text-cyan-300">
                <Cable className="w-4 h-4" /> {uplinkEdges.length} LLDP uplink(s) in graph
              </span>
            )}
          </div>
        </MacGlassPanel>
      )}

      {lldpStrip.length > 0 && (
        <MacGlassPanel title="LLDP uplink strip" subtitle="Per-host switch neighbors (lazy fetch from online agents).">
          <div className="space-y-3">
            {lldpStrip.map((entry) => (
              <div key={entry.hostId} className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <Link to={`/platform/hosts/${entry.hostId}`} className="text-sm font-medium text-blue-300 hover:underline">
                    {entry.hostname}
                  </Link>
                  {entry.lldp && (
                    <span className="text-xs text-slate-500">{entry.lldp.source.replace(/_/g, ' ')}</span>
                  )}
                </div>
                {entry.error && (
                  <p className="text-xs text-slate-500">{entry.error}</p>
                )}
                {entry.lldp && entry.lldp.neighbors.length > 0 ? (
                  <ul className="text-xs font-mono space-y-1 text-slate-300">
                    {entry.lldp.neighbors.map((n, i) => (
                      <li key={i} className="flex flex-wrap gap-x-3">
                        <span className="text-cyan-400/90">{n.local_interface}</span>
                        <span>→</span>
                        <span>{n.system_name || n.chassis_id || 'switch'}</span>
                        {n.port_id && <span className="text-slate-500">port {n.port_id}</span>}
                      </li>
                    ))}
                  </ul>
                ) : entry.lldp ? (
                  <p className="text-xs text-slate-500">{entry.lldp.summary}</p>
                ) : null}
              </div>
            ))}
          </div>
        </MacGlassPanel>
      )}

      {graph?.warnings.map((w, i) => (
        <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {w.message}
        </div>
      ))}
      <MacGlassPanel title="Cluster graph">
        <div className="space-y-4 font-mono text-xs overflow-x-auto">
        {graph?.nodes.filter((n) => n.kind === 'cluster').map((c) => (
          <div key={c.id}>
            <p className="text-slate-300 font-semibold">▸ {c.name}</p>
            {graph.nodes.filter((n) => n.kind === 'segment').map((seg) => (
              <p key={seg.id} className="ml-4 mt-1 text-violet-400/90">
                ◆ {seg.name}
              </p>
            ))}
            {graph.nodes.filter((n) => n.kind === 'host').map((h) => (
              <div key={h.id} className="ml-4 mt-2">
                <p className="text-blue-400">└ {h.name} <span className="text-slate-600">({h.state})</span></p>
                {graph.edges.filter((e) => e.from === h.id && e.label === 'uplink').map((e) => {
                  const sw = graph.nodes.find((n) => n.id === e.to)
                  return sw ? (
                    <p key={e.to} className="ml-6 text-cyan-400/80">
                      ⇄ {sw.name} <span className="text-slate-600">(uplink)</span>
                    </p>
                  ) : null
                })}
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
        {!graph && (
          <p className="text-slate-500 flex items-center gap-2"><GitBranch className="w-4 h-4" /> Loading graph…</p>
        )}
        </div>
      </MacGlassPanel>
    </div>
  )
}
