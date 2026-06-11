// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { HardDrive, Network } from 'lucide-react'
import { getFleetNetwork, getFleetStorage, type FleetNetworkOverview, type FleetStorageOverview } from '../../api/platform'

function usagePct(used: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}

function UsageBar({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function MachineFinderResourceStrip() {
  const [storage, setStorage] = useState<FleetStorageOverview | null>(null)
  const [network, setNetwork] = useState<FleetNetworkOverview | null>(null)

  useEffect(() => {
    void Promise.all([
      getFleetStorage().then(setStorage).catch(() => setStorage(null)),
      getFleetNetwork().then(setNetwork).catch(() => setNetwork(null)),
    ])
  }, [])

  const storagePct = usagePct(storage?.total_used_gib ?? 0, storage?.total_capacity_gib ?? 0)
  const poolCount = storage?.pools?.length ?? 0
  const netCount = network?.network_count ?? 0

  return (
    <section
      className="grid gap-3 sm:grid-cols-2 rounded-xl border border-white/[0.08] bg-slate-950/40 px-4 py-3"
      data-testid="machine-finder-resource-strip"
    >
      <div className="flex gap-3 min-w-0">
        <HardDrive className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs font-medium text-slate-300">Fleet storage</p>
          <UsageBar label={`${storage?.total_used_gib?.toFixed(0) ?? '—'} / ${storage?.total_capacity_gib?.toFixed(0) ?? '—'} GiB · ${poolCount} pools`} pct={storagePct} tone="bg-sky-500/70" />
        </div>
      </div>
      <div className="flex gap-3 min-w-0">
        <Network className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-medium text-slate-300">Fleet networks</p>
          <p className="text-[11px] text-slate-400">
            {netCount} libvirt network(s)
            {network?.hosts_online != null ? ` · ${network.hosts_online} hosts online` : ''}
          </p>
        </div>
      </div>
    </section>
  )
}
