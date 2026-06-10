// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { Server } from 'lucide-react'
import LivingMachineCard from '../MachineFinder/LivingMachineCard'
import { openCenterPopout } from '../../../utils/platformCenterPopout'
import { statusPillClasses } from '../../../utils/semanticColors'
import type { MissionControlFleetState } from './useMissionControlFleet'

type Props = {
  state: MissionControlFleetState
}

export default function HostMachinePanels({ state }: Props) {
  const { hosts, vmsByHost, selectedVmId, setSelectedVmId, setDragVmId, setSshVm } = state

  if (hosts.length === 0) {
    return (
      <section className="rounded-xl border border-white/[0.08] bg-slate-900/40 p-6 text-center">
        <p className="text-slate-400 mb-3">No hosts enrolled yet.</p>
        <Link to="/platform/enroll" className="btn-primary text-sm">Add host</Link>
      </section>
    )
  }

  return (
    <section data-testid="host-machine-panels" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Hosts / Machines</h2>
        <span className="text-xs text-slate-500">Grouped</span>
      </div>
      {hosts.map((host) => {
        const hostVms = vmsByHost.get(host.id) ?? []
        const online = host.state !== 'offline'
        return (
          <article key={host.id} className="mc-host-panel rounded-2xl border border-white/[0.08] bg-slate-950/40 p-4 space-y-3">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Server className="w-4 h-4 text-sky-400 shrink-0" />
                <h3 className="font-medium text-white truncate">{host.hostname}</h3>
                <span className={statusPillClasses(online ? 'ok' : 'warn')}>{online ? 'Healthy' : host.state}</span>
              </div>
              <p className="text-xs text-slate-500">
                {hostVms.length} machines · {Math.round(host.cpu_percent ?? 0)}% CPU · {host.vm_count} VMs fleet
              </p>
            </header>
            {hostVms.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {hostVms.map((vm) => (
                  <LivingMachineCard
                    key={vm.id}
                    vm={vm}
                    selected={selectedVmId === vm.id}
                    overlay="default"
                    onSelect={() => setSelectedVmId(vm.id)}
                    onDragStart={() => setDragVmId(vm.id)}
                    onSsh={() => setSshVm(vm)}
                    onDoubleClickTheatre={() => openCenterPopout(`/platform/vms/${vm.id}/consolehub?popout=1`)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No machines on this host.</p>
            )}
            <footer className="flex flex-wrap gap-2 pt-1">
              <Link to={`/platform/hosts/${host.id}`} className="btn-secondary text-xs">Open host</Link>
              <Link to={`/platform/vms?lens=topology&host=${encodeURIComponent(host.id)}`} className="btn-secondary text-xs">Machine Finder</Link>
            </footer>
          </article>
        )
      })}
      {vmsByHost.has('__unassigned__') && (
        <article className="mc-host-panel rounded-2xl border border-dashed border-white/[0.12] p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Unassigned machines</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(vmsByHost.get('__unassigned__') ?? []).map((vm) => (
              <LivingMachineCard
                key={vm.id}
                vm={vm}
                selected={selectedVmId === vm.id}
                overlay="default"
                onSelect={() => setSelectedVmId(vm.id)}
                onDragStart={() => setDragVmId(vm.id)}
                onSsh={() => setSshVm(vm)}
                onDoubleClickTheatre={() => openCenterPopout(`/platform/vms/${vm.id}/consolehub?popout=1`)}
              />
            ))}
          </div>
        </article>
      )}
    </section>
  )
}
