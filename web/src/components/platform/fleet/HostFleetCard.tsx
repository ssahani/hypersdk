// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { Monitor, Server, Wrench } from 'lucide-react'
import type { FleetLinuxHostItem, PlatformHost } from '../../../api/platform'
import { statusPillClasses } from '../../../utils/semanticColors'

type Props = {
  host: PlatformHost
  linux?: FleetLinuxHostItem
  selected?: boolean
  onSelect?: () => void
}

export default function HostFleetCard({ host, linux, selected, onSelect }: Props) {
  const online = host.state === 'online' && !host.maintenance_mode
  const memPct = host.memory_total_mib && host.memory_total_mib > 0
    ? Math.round(((host.memory_used_mib ?? 0) / host.memory_total_mib) * 100)
    : null

  return (
    <article
      className={`mc-host-fleet-card rounded-2xl border p-4 transition cursor-pointer ${
        selected ? 'border-sky-400/40 bg-sky-500/5' : 'border-white/[0.08] bg-slate-950/40 hover:bg-white/[0.02]'
      }`}
      onClick={onSelect}
      data-testid={`host-fleet-card-${host.id}`}
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            {host.hostname}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Libvirt host · {linux?.status ?? 'Linux ok'}</p>
        </div>
        <span className={statusPillClasses(online ? 'ok' : 'warn')}>{online ? 'Healthy' : host.state}</span>
      </header>
      <dl className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-3">
        <div><dt className="text-slate-600">VMs</dt><dd className="text-slate-200">{host.vm_count}</dd></div>
        <div><dt className="text-slate-600">CPU</dt><dd className="text-slate-200">{Math.round(host.cpu_percent ?? 0)}%</dd></div>
        <div><dt className="text-slate-600">Memory</dt><dd className="text-slate-200">{memPct != null ? `${memPct}%` : '—'}</dd></div>
        <div><dt className="text-slate-600">Network</dt><dd className="text-emerald-300/80">OK</dd></div>
      </dl>
      <footer className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        <Link to={`/platform/hosts/${host.id}`} className="btn-secondary text-xs">Open host</Link>
        <Link to={`/platform/vms?lens=topology&host=${encodeURIComponent(host.id)}`} className="btn-secondary text-xs inline-flex items-center gap-1"><Monitor className="w-3 h-3" /> Machines</Link>
      </footer>
    </article>
  )
}

export function HostCommandCenter({
  host,
  linux,
}: {
  host: PlatformHost | null
  linux?: FleetLinuxHostItem
}) {
  if (!host) {
    return (
      <aside className="machine-finder-command-center w-full xl:w-96 shrink-0 rounded-xl border border-white/[0.06] bg-slate-950/50 p-4">
        <p className="text-sm text-slate-500">Select a host for Command Center</p>
      </aside>
    )
  }
  const memPct = host.memory_total_mib && host.memory_total_mib > 0
    ? Math.round(((host.memory_used_mib ?? 0) / host.memory_total_mib) * 100)
    : null
  return (
    <aside className="machine-finder-command-center w-full xl:w-96 shrink-0 rounded-xl border border-white/[0.06] bg-slate-950/50" data-testid="host-command-center">
      <header className="px-4 py-3 border-b border-white/[0.06]">
        <h2 className="font-semibold text-white">Host Command Center</h2>
        <p className="text-xs text-slate-500 truncate">{host.hostname}</p>
      </header>
      <div className="p-4 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800"><p className="text-slate-500">CPU</p><p>{Math.round(host.cpu_percent ?? 0)}%</p></div>
          <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800"><p className="text-slate-500">Memory</p><p>{memPct != null ? `${memPct}%` : '—'}</p></div>
          <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800 col-span-2"><p className="text-slate-500">Linux</p><p>{linux?.status ?? '—'}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/platform/vms?lens=topology&host=${encodeURIComponent(host.id)}`} className="btn-secondary text-xs flex-1 text-center">Machine Finder</Link>
          <Link to="/platform/enroll" className="btn-secondary text-xs flex-1 text-center">Add VM</Link>
        </div>
        <Link to={`/platform/hosts/${host.id}`} className="btn-primary text-sm block text-center inline-flex items-center justify-center gap-1"><Wrench className="w-3.5 h-3.5" /> Open host detail</Link>
      </div>
    </aside>
  )
}
