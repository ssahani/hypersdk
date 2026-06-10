// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { X } from 'lucide-react'
import type { ConsoleHubSessionRow } from './ConsoleHubSessionHistory'
import type { VmTimelineEntry } from '../../api/platformVmTimeline'
import MachineTimeline from './MachineTimeline'

type Props = {
  open: boolean
  onClose: () => void
  vmId: string
  vmName: string
  healthScore?: number | null
  vmState?: string | null
  guestIp?: string | null
  sessions?: ConsoleHubSessionRow[]
  timeline?: VmTimelineEntry[]
  initialTab?: string
  onAction?: (action: string) => void
}

const TABS = ['Overview', 'Health', 'Events', 'AI'] as const

export default function CommandCenterPanel({
  open,
  onClose,
  vmName,
  healthScore,
  vmState,
  guestIp,
  sessions = [],
  timeline = [],
  initialTab = 'Overview',
  onAction,
}: Props) {
  if (!open) return null

  const tab = initialTab

  return (
    <>
      <button type="button" className="fixed inset-0 z-[75] bg-black/40 backdrop-blur-sm" aria-label="Close Command Center" onClick={onClose} />
      <aside className="fixed top-0 right-0 z-[80] h-full w-full max-w-md bg-slate-950/95 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-100">Command Center</h2>
            <p className="text-xs text-slate-500">{vmName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-slate-400"><X className="w-5 h-5" /></button>
        </header>
        <div className="flex gap-1 px-3 py-2 border-b border-white/5 shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <span
              key={t}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${t === tab ? 'bg-emerald-900/40 text-emerald-100' : 'text-slate-500'}`}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800">
              <p className="text-slate-500">Health</p>
              <p className="text-lg font-semibold text-slate-100">{healthScore ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800">
              <p className="text-slate-500">State</p>
              <p className="text-slate-100 capitalize">{vmState ?? 'unknown'}</p>
            </div>
            <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800 col-span-2">
              <p className="text-slate-500">Network</p>
              <p className="font-mono text-emerald-300/90">{guestIp ?? 'No IP'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Actions</p>
            <div className="flex flex-wrap gap-2">
              {['Snapshot', 'Restart', 'Inspect Disk', 'PacketWolf Trace', 'Migrate'].map((a) => (
                <button
                  key={a}
                  type="button"
                  className="btn-secondary text-xs py-1 px-2"
                  onClick={() => onAction?.(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <MachineTimeline sessions={sessions} timeline={timeline} />
        </div>
      </aside>
    </>
  )
}
