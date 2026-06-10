// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Server } from 'lucide-react'
import type { PlatformHost } from '../../../api/platform'
import type { MachineFinderState } from './useMachineFinder'

type Props = {
  state: MachineFinderState
  compact?: boolean
}

export default function MigrationHeroZone({ state, compact }: Props) {
  const { hosts, dropHost, setDropHost, onHostDrop, dragVmId } = state

  if (state.lens !== 'grid' && state.lens !== 'migration') return null

  return (
    <section
      className={`machine-finder-migrate-zone rounded-2xl border border-dashed transition ${
        dragVmId ? 'border-sky-400/50 bg-sky-500/5' : 'border-white/[0.12] bg-slate-900/30'
      } ${compact ? 'p-3' : 'p-5'}`}
      data-testid="machine-finder-migrate-zone"
    >
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-medium text-slate-200">
          {dragVmId ? 'Drop machine on a destination host' : 'Migration zone — drag a machine here'}
        </h3>
      </div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'}`}>
        {hosts.map((h) => (
          <HostDropTarget
            key={h.id}
            host={h}
            active={dropHost === h.id}
            onDragOver={() => setDropHost(h.id)}
            onDragLeave={() => setDropHost(null)}
            onDrop={() => onHostDrop(h.id)}
          />
        ))}
      </div>
    </section>
  )
}

function HostDropTarget({
  host,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  host: PlatformHost
  active: boolean
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: () => void
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      className={`rounded-xl border p-3 text-sm transition ${
        active ? 'border-blue-500 bg-blue-500/15 scale-[1.02]' : 'border-white/[0.06] bg-slate-950/40'
      }`}
    >
      <p className="font-medium truncate">{host.hostname}</p>
      <p className="text-xs text-slate-500">{host.state} · {host.vm_count} VMs</p>
    </div>
  )
}
