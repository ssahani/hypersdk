// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import PageLayout from '../../components/PageLayout'
import PlatformPageChrome from '../../components/platform/PlatformPageChrome'
import { getNetworkCanvas, type NetworkCanvasPayload, type PacketWolfFlow } from '../../api/platformNetworkCanvas'
import { hubLinkClasses, statusBadgeClasses, statusToneClass } from '../../utils/semanticColors'

type CanvasNode = { id: string; label: string; kind: string; detail?: string }

function flowLabel(f: PacketWolfFlow): string {
  const dst = f.destination_ip
    ? `${f.destination_ip}${f.destination_port ? `:${f.destination_port}` : ''}`
    : 'unknown'
  const proc = f.process ?? 'process'
  return `${proc} → ${dst}`
}

export default function PlatformNetworkCanvas() {
  const [data, setData] = useState<NetworkCanvasPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getNetworkCanvas()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load network canvas'))
  }, [])

  const nodes = useMemo<CanvasNode[]>(() => {
    if (!data) return []
    const list: CanvasNode[] = []
    for (const n of data.topology.nodes ?? []) {
      list.push({
        id: `${n.kind}-${n.id}`,
        label: n.name,
        kind: n.kind,
        detail: n.state,
      })
    }
    return list
  }, [data])

  const flowEdges = useMemo(() => {
    const flows = data?.flows?.flows ?? []
    return flows.slice(0, 24).map((f, i) => ({
      id: `flow-${i}`,
      label: flowLabel(f),
      verdict: f.verdict ?? 'FORWARDED',
      host: f.host_id,
      summary: f.summary,
    }))
  }, [data])

  const localAnomalies = useMemo(() => {
    const found: string[] = []
    const warnings = data?.topology.warnings ?? []
    for (const w of warnings) {
      found.push(w.message)
    }
    const pw = data?.anomalies?.anomalies ?? []
    for (const a of pw.slice(0, 5)) {
      if (a.summary) found.push(a.summary)
    }
    return found
  }, [data])

  const stats = data?.flow_stats
  const dropped = stats?.dropped ?? stats?.dropped_count ?? 0
  const forwarded = stats?.forwarded ?? stats?.allowed ?? 0

  return (
    <PageLayout compact title="Network canvas" subtitle="Topology, PacketWolf flows, and fleet anomalies">
      <PlatformPageChrome error={error} onErrorRetry={() => void getNetworkCanvas().then(setData).catch(() => {})}>
        {data?.packetwolf && (
          <p className={`text-xs mb-4 px-3 py-2 rounded-lg border ${
            data.packetwolf.reachable ? statusBadgeClasses('ok') : statusBadgeClasses('warn')
          }`}>
            {data.packetwolf.summary}
          </p>
        )}

        {(dropped > 0 || forwarded > 0) && (
          <div className="flex flex-wrap gap-3 mb-4 text-sm">
            <span className={statusToneClass('ok')}>Forwarded: {forwarded}</span>
            <span className={statusToneClass(dropped > 0 ? 'warn' : 'neutral')}>Dropped: {dropped}</span>
          </div>
        )}

        {localAnomalies.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-4 text-sm text-amber-200/90">
            <p className="font-medium mb-1">Anomalies</p>
            <ul className="list-disc pl-4 text-xs">{localAnomalies.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}

        {flowEdges.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Recent flows (PacketWolf)</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {flowEdges.map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3 text-xs">
                  <span className={`text-[10px] uppercase mr-2 ${
                    e.verdict === 'DROPPED' || e.verdict === 'blocked' ? statusToneClass('error') : statusToneClass('ok')
                  }`}>
                    {e.verdict}
                  </span>
                  <p className="font-medium text-slate-100 mt-0.5">{e.label}</p>
                  {e.host && <p className="text-slate-500 mt-0.5">Host {e.host}</p>}
                  {e.summary && <p className="text-slate-400 mt-0.5 truncate">{e.summary}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="text-sm font-semibold text-slate-300 mb-2">Fleet topology</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((n) => (
            <div key={n.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3 text-sm">
              <span className="text-[10px] uppercase text-slate-500">{n.kind}</span>
              <p className="font-medium text-slate-100">{n.label}</p>
              {n.detail && <p className="text-xs text-slate-400 mt-0.5">{n.detail}</p>}
            </div>
          ))}
        </div>

        {(data?.topology.edges?.length ?? 0) > 0 && (
          <section className="mt-4">
            <h3 className="text-xs font-semibold text-slate-500 mb-2">Links</h3>
            <ul className="text-xs text-slate-400 space-y-1">
              {data!.topology.edges.slice(0, 20).map((e) => (
                <li key={`${e.from}-${e.to}`}>{e.from} → {e.to} ({e.label})</li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-slate-500 mt-4">
          Deep dive:{' '}
          <Link to="/platform/zeus/security/firewall" className={hubLinkClasses()}>Zeus Firewall</Link>
          {' · '}
          <Link to="/platform/topology" className={hubLinkClasses()}>Topology map</Link>
        </p>
      </PlatformPageChrome>
    </PageLayout>
  )
}
