// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { MachineFinderLens, MachineFinderOverlay } from './machineFinderTypes'
import type { MachineFinderState } from './useMachineFinder'

const LENSES: { id: MachineFinderLens; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'table', label: 'Table' },
  { id: 'topology', label: 'Topology' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'migration', label: 'Migration' },
]

const OVERLAYS: { id: MachineFinderOverlay; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'health', label: 'Health' },
  { id: 'backup', label: 'Backup' },
  { id: 'network', label: 'Network' },
  { id: 'security', label: 'Security' },
  { id: 'cost', label: 'Cost' },
  { id: 'migration', label: 'Migration' },
]

type Props = {
  state: MachineFinderState
}

export default function MachineFinderLensBar({ state }: Props) {
  const { lens, overlay, setLens, setOverlay } = state

  return (
    <div className="machine-finder-lens-bar flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-testid="machine-finder-lens-bar">
      <div className="flex flex-wrap gap-1">
        {LENSES.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              lens === l.id ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/30' : 'text-slate-400 hover:bg-white/[0.04]'
            }`}
            onClick={() => setLens(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      {(lens === 'grid' || lens === 'migration') && (
        <div className="flex flex-wrap gap-1">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                overlay === o.id ? 'bg-emerald-900/40 text-emerald-100' : 'text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setOverlay(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
