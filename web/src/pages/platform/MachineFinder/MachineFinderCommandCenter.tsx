// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Camera,
  Copy,
  Monitor,
  Pause,
  Play,
  Power,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react'
import { runVmHealthCheck, type PlatformVm } from '../../../api/platform'
import VmStatusBadge from '../../../components/VmStatusBadge'
import { formatVmMemoryGiB } from '../../../utils/vmVisual'
import { useToastContext } from '../../../contexts/ToastContext'
import type { MachineFinderState } from './useMachineFinder'

type Props = {
  state: MachineFinderState
}

export default function MachineFinderCommandCenter({ state }: Props) {
  const toast = useToastContext()
  const {
    selectedVm,
    hostMap,
    vmPowerAction,
    vmSnapshotAction,
    vmDeleteAction,
    adoptVm,
    setSshVm,
    setMigrateModal,
    hosts,
  } = state

  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  useEffect(() => {
    if (!selectedVm) {
      setHealthScore(null)
      return
    }
    setHealthLoading(true)
    void runVmHealthCheck(selectedVm.id)
      .then((h) => setHealthScore(h.score != null ? Number(h.score) || null : null))
      .catch(() => setHealthScore(null))
      .finally(() => setHealthLoading(false))
  }, [selectedVm?.id])

  if (!selectedVm) {
    return (
      <aside className="machine-finder-command-center hidden xl:flex xl:w-72 shrink-0 flex-col rounded-xl border border-white/[0.06] bg-slate-950/50 p-4" data-testid="machine-finder-command-center">
        <p className="text-sm text-slate-500">Select a machine to open Command Center</p>
      </aside>
    )
  }

  return (
    <aside className="machine-finder-command-center w-full xl:w-72 shrink-0 flex flex-col rounded-xl border border-white/[0.06] bg-slate-950/50 overflow-hidden" data-testid="machine-finder-command-center">
      <header className="px-4 py-3 border-b border-white/[0.06]">
        <h2 className="font-semibold text-white">Command Center</h2>
        <p className="text-xs text-slate-500 truncate">{selectedVm.name}</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Metric label="Health" value={healthLoading ? '…' : healthScore ?? '—'} />
          <Metric label="State" value={<VmStatusBadge state={selectedVm.observed_state} />} />
          <Metric label="vCPU" value={String(selectedVm.vcpus)} />
          <Metric label="Memory" value={formatVmMemoryGiB(selectedVm.memory_mib)} />
          <Metric label="Source" value={<span className="capitalize">{selectedVm.inventory_source ?? 'libvirt'}</span>} className="col-span-2" />
          {selectedVm.guest_ip && (
            <Metric label="Guest IP" value={<span className="font-mono text-emerald-300/90">{selectedVm.guest_ip}</span>} className="col-span-2" />
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Quick actions</p>
          <div className="flex flex-wrap gap-1.5">
            <ActionBtn icon={Play} label="Start" onClick={() => void vmPowerAction(selectedVm, 'start')} />
            <ActionBtn icon={Power} label="Shutdown" onClick={() => void vmPowerAction(selectedVm, 'shutdown')} />
            <ActionBtn icon={Square} label="Stop" onClick={() => void vmPowerAction(selectedVm, 'stop')} />
            <ActionBtn icon={Pause} label="Pause" onClick={() => void vmPowerAction(selectedVm, 'pause')} />
            <ActionBtn icon={Camera} label="Snapshot" onClick={() => void vmSnapshotAction(selectedVm)} />
            <ActionBtn icon={Trash2} label="Delete" danger onClick={() => void vmDeleteAction(selectedVm)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/platform/vms/${selectedVm.id}/consolehub`} className="btn-secondary text-xs flex-1 text-center inline-flex items-center justify-center gap-1">
            <Monitor className="w-3.5 h-3.5" /> Console
          </Link>
          {selectedVm.inventory_source !== 'kubevirt' && (
            <button type="button" className="btn-secondary text-xs flex-1 inline-flex items-center justify-center gap-1" onClick={() => setSshVm(selectedVm)}>
              <Terminal className="w-3.5 h-3.5" /> SSH
            </button>
          )}
        </div>

        {selectedVm.guest_ip && (
          <button
            type="button"
            className="btn-secondary text-xs w-full inline-flex items-center justify-center gap-1"
            onClick={() => {
              void navigator.clipboard.writeText(selectedVm.guest_ip!)
              toast.success('Guest IP copied')
            }}
          >
            <Copy className="w-3.5 h-3.5" /> Copy IP
          </button>
        )}

        <Link to={`/platform/vms/${selectedVm.id}`} className="btn-primary text-sm block text-center">Open VM detail</Link>

        {selectedVm.host_id && hosts.length > 1 && (
          <MigratePicker vm={selectedVm} hosts={hosts} hostMap={hostMap} onPick={(destId, destName) => state.setMigrateModal({ vm: selectedVm, destId, destName })} />
        )}

        {selectedVm.managed === false && (
          <button type="button" className="btn-secondary text-xs w-full" onClick={() => void adoptVm(selectedVm)}>Adopt discovered VM</button>
        )}

        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs text-emerald-100/90">
          <p className="font-medium text-emerald-200/90 mb-1">Zeus says</p>
          <p>
            {healthScore != null && healthScore < 70
              ? 'Health score is low — review backups and guest agent connectivity.'
              : selectedVm.guest_ip
                ? 'Machine is reachable — console and SSH are ready.'
                : 'No guest IP yet — check network and guest tools.'}
          </p>
        </div>
      </div>
    </aside>
  )
}

function Metric({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg bg-slate-900/60 p-2 border border-slate-800 ${className}`}>
      <p className="text-slate-500">{label}</p>
      <div className="text-slate-100 mt-0.5">{value}</div>
    </div>
  )
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Play
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button type="button" className={`btn-secondary text-xs py-1 px-2 inline-flex items-center gap-1 ${danger ? 'border-red-500/30 text-red-200' : ''}`} onClick={onClick}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  )
}

function MigratePicker({
  vm,
  hosts,
  hostMap,
  onPick,
}: {
  vm: PlatformVm
  hosts: MachineFinderState['hosts']
  hostMap: Map<string, string>
  onPick: (destId: string, destName: string) => void
}) {
  const candidates = hosts.filter((h) => h.id !== vm.host_id)
  if (candidates.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-1">Migrate to</p>
      <select
        className="w-full text-xs rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5"
        defaultValue=""
        onChange={(e) => {
          const id = e.target.value
          if (!id) return
          const host = hosts.find((h) => h.id === id)
          if (host) onPick(id, host.hostname)
          e.target.value = ''
        }}
      >
        <option value="">Select host…</option>
        {candidates.map((h) => (
          <option key={h.id} value={h.id}>{h.hostname} ({hostMap.get(h.id) ?? h.id.slice(0, 8)})</option>
        ))}
      </select>
    </div>
  )
}
