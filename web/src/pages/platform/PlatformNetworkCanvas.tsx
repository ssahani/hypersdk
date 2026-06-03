// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageLayout from '../../components/PageLayout'
import PlatformPageChrome from '../../components/platform/PlatformPageChrome'
import { getClusterTopology, listPlatformVms, type PlatformVm } from '../../api/platform'
import { getZeusAssetInventory } from '../../api/zeusSecurity'
import { hubLinkClasses } from '../../utils/semanticColors'

type CanvasNode = { id: string; label: string; kind: string; detail?: string }

export default function PlatformNetworkCanvas() {
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [anomalies, setAnomalies] = useState<string[]>([])

  useEffect(() => {
    void Promise.all([getClusterTopology(), getZeusAssetInventory().catch(() => ({ hosts: [] })), listPlatformVms()])
      .then(([topo, inv, vms]: [Awaited<ReturnType<typeof getClusterTopology>>, Record<string, unknown>, PlatformVm[]]) => {
        const list: CanvasNode[] = []
        for (const v of vms) {
          list.push({
            id: `vm-${v.id}`,
            label: v.name,
            kind: 'vm',
            detail: v.guest_ip ? `${v.observed_state} · ${v.guest_ip}` : v.observed_state,
          })
        }
        for (const e of topo.edges ?? []) {
          list.push({ id: `edge-${e.from}-${e.to}`, label: `${e.from} → ${e.to}`, kind: 'link', detail: e.label })
        }
        for (const h of (inv.hosts as Array<{ id?: string; name?: string; state?: string }>) ?? []) {
          list.push({
            id: `host-${h.id ?? h.name}`,
            label: h.name ?? 'host',
            kind: 'host',
            detail: h.state,
          })
        }
        setNodes(list)
        const ips = vms.map((v) => v.guest_ip).filter(Boolean) as string[]
        const dup = ips.find((ip, i) => ips.indexOf(ip) !== i)
        const found: string[] = []
        if (dup) found.push(`Duplicate guest IP: ${dup}`)
        if (vms.some((v) => v.observed_state === 'running' && !v.guest_ip)) {
          found.push('Running VM(s) without guest IP — DHCP or guest tools may be pending')
        }
        setAnomalies(found)
      })
      .catch(() => setNodes([]))
  }, [])

  return (
    <PageLayout compact title="Network canvas" subtitle="VM → host → fleet (PacketWolf flows in Security)">
      <PlatformPageChrome>
        {anomalies.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-4 text-sm text-amber-200/90">
            <p className="font-medium mb-1">Anomalies</p>
            <ul className="list-disc pl-4 text-xs">{anomalies.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((n) => (
            <div key={n.id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3 text-sm">
              <span className="text-[10px] uppercase text-slate-500">{n.kind}</span>
              <p className="font-medium text-slate-100">{n.label}</p>
              {n.detail && <p className="text-xs text-slate-400 mt-0.5">{n.detail}</p>}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Full flow graph: <Link to="/platform/zeus/security/firewall" className={hubLinkClasses()}>Zeus Firewall activity</Link>
          {' · '}
          <Link to="/platform/topology" className={hubLinkClasses()}>Topology map</Link>
        </p>
      </PlatformPageChrome>
    </PageLayout>
  )
}
