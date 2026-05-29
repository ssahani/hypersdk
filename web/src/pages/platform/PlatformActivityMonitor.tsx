// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import PlatformEmptyState from '../../components/platform/PlatformEmptyState'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import { listPlatformVms, getPlatformVmMetrics, type PlatformVm } from '../../api/platform'

export default function PlatformActivityMonitor() {
  const [vms, setVms] = useState<PlatformVm[]>([])
  const [metrics, setMetrics] = useState<Record<string, { memory_used_mib: number; cpu_percent: number }>>({})

  const load = useCallback(async () => {
    const v = await listPlatformVms()
    setVms(v.filter((x) => x.observed_state === 'running'))
    const m: Record<string, { memory_used_mib: number; cpu_percent: number }> = {}
    await Promise.all(
      v.slice(0, 20).map(async (vm) => {
        try {
          const row = await getPlatformVmMetrics(vm.id)
          m[vm.id] = { memory_used_mib: row.memory_used_mib, cpu_percent: row.cpu_percent }
        } catch { /* no metrics yet */ }
      }),
    )
    setMetrics(m)
  }, [])

  useEffect(() => { void load() }, [load])

  const sorted = [...vms].sort((a, b) => (metrics[b.id]?.memory_used_mib ?? 0) - (metrics[a.id]?.memory_used_mib ?? 0))
  const maxMem = Math.max(1, ...sorted.map((v) => metrics[v.id]?.memory_used_mib ?? 0))

  return (
    <div className="space-y-6 animate-fade-in">
      <MacSectionTitle title="Activity Monitor" subtitle="Top resource consumers — bar meters like macOS Activity Monitor." />
      {sorted.length === 0 ? (
        <PlatformEmptyState title="No running VMs" subtitle="Start a VM to see live CPU and memory usage." />
      ) : (
        <ul className="space-y-2">
          {sorted.map((vm) => {
            const m = metrics[vm.id]
            const memPct = m ? Math.min(100, (m.memory_used_mib / maxMem) * 100) : 0
            const cpuPct = m ? Math.min(100, m.cpu_percent) : 0
            return (
              <li key={vm.id} className="platform-mac-stat rounded-xl border border-white/[0.06] bg-slate-900/50 p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-slate-200">{vm.name}</span>
                  <span className="text-xs text-slate-500">{m ? `${m.memory_used_mib} MiB · ${m.cpu_percent.toFixed(0)}% CPU` : '—'}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="w-12">Memory</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${memPct}%` }} /></div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="w-12">CPU</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cpuPct}%` }} /></div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">{m && m.memory_used_mib > 8192 ? 'High memory — consider right-sizing' : 'Normal'}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
