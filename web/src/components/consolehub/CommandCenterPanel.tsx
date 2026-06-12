// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { getVmDoctor, type VmDoctorReport } from '../../api/ai'
import type { ConsoleHubSessionRow } from './ConsoleHubSessionHistory'
import type { VmTimelineEntry } from '../../api/platformVmTimeline'
import type { GuestAccessHints } from '../../utils/guestAccessHints'
import MachineTimeline from './MachineTimeline'
import ConsoleHubSessionHistory from './ConsoleHubSessionHistory'
import VmPortForwardPanel from '../vm/VmPortForwardPanel'
import MachinaDoctorPanel from '../platform/MachinaDoctorPanel'
import ConsoleCopilotLens from './ConsoleCopilotLens'

export type CommandCenterTab = 'Overview' | 'Health' | 'Events' | 'AI'

type Props = {
  open: boolean
  onClose: () => void
  vmId: string
  vmName: string
  healthScore?: number | null
  vmState?: string | null
  guestIp?: string | null
  guestAccess?: GuestAccessHints | null
  hypervisorAddress?: string
  sshUser?: string
  sessions?: ConsoleHubSessionRow[]
  timeline?: VmTimelineEntry[]
  activeTab: CommandCenterTab
  onTabChange: (tab: CommandCenterTab) => void
  onAction?: (action: string) => void
  onPlanRefresh?: () => void
  onOpenVmDetail?: (tab?: string) => void
}

const TABS: CommandCenterTab[] = ['Overview', 'Health', 'Events', 'AI']

export default function CommandCenterPanel({
  open,
  onClose,
  vmId,
  vmName,
  healthScore,
  vmState,
  guestIp,
  guestAccess,
  hypervisorAddress,
  sshUser,
  sessions = [],
  timeline = [],
  activeTab,
  onTabChange,
  onAction,
  onPlanRefresh,
  onOpenVmDetail,
}: Props) {
  const [doctor, setDoctor] = useState<VmDoctorReport | null>(null)
  const [doctorLoading, setDoctorLoading] = useState(false)

  const ip = guestIp?.trim() ?? ''

  useEffect(() => {
    if (!open || activeTab !== 'Health') return
    setDoctorLoading(true)
    void getVmDoctor(vmId)
      .then(setDoctor)
      .catch(() => setDoctor(null))
      .finally(() => setDoctorLoading(false))
  }, [open, activeTab, vmId])

  if (!open) return null

  return (
    <>
      <button type="button" className="fixed inset-0 z-[75] bg-black/40 backdrop-blur-sm" aria-label="Close Ops Shelf" onClick={onClose} />
      <aside className="fixed top-0 right-0 z-[80] h-full w-full max-w-md bg-slate-950/95 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200" data-testid="ops-shelf">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-100">Ops Shelf</h2>
            <p className="text-xs text-slate-500">VM Intelligence · {vmName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-slate-400"><X className="w-5 h-5" /></button>
        </header>
        <div className="flex gap-1 px-3 py-2 border-b border-white/5 shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className={
                t === activeTab
                  ? 'px-2 py-1 rounded text-xs whitespace-nowrap bg-emerald-900/40 text-emerald-100'
                  : 'px-2 py-1 rounded text-xs whitespace-nowrap text-slate-500 hover:text-slate-300'
              }
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          {activeTab === 'Overview' && (
            <>
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
              {guestAccess?.guest_ip_private && ip ? (
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-2">Hypervisor NAT</p>
                  <VmPortForwardPanel
                    platformVmId={vmId}
                    vmName={vmName}
                    guestIp={ip}
                    sshUser={sshUser}
                    hypervisorAddress={hypervisorAddress}
                    compact
                    onNotify={() => onPlanRefresh?.()}
                  />
                </div>
              ) : null}
              <ConsoleHubSessionHistory sessions={sessions} />
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Quick actions</p>
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
            </>
          )}

          {activeTab === 'Health' && (
            <MachinaDoctorPanel
              vmId={vmId}
              report={doctor}
              loading={doctorLoading}
              onRefresh={() => {
                setDoctorLoading(true)
                void getVmDoctor(vmId)
                  .then(setDoctor)
                  .catch(() => setDoctor(null))
                  .finally(() => setDoctorLoading(false))
              }}
              onTab={(t) => onOpenVmDetail?.(t)}
            />
          )}

          {activeTab === 'Events' && (
            <MachineTimeline sessions={sessions} timeline={timeline} />
          )}

          {activeTab === 'AI' && (
            <ConsoleCopilotLens
              vmId={vmId}
              vmName={vmName}
              activeLens="ai"
              guestIp={guestIp}
              vmState={vmState}
            />
          )}

          <div className="pt-2 border-t border-white/5">
            <Link
              to={`/platform/vms/${vmId}`}
              className="text-xs text-sky-400 hover:underline"
              onClick={onClose}
            >
              Open full VM detail →
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
