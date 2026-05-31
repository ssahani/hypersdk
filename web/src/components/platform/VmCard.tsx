// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { Monitor, Cpu, MemoryStick } from 'lucide-react'
import type { PlatformVm } from '../../api/platform'
import { statusBadgeClasses, statusToneClass } from '../../utils/semanticColors'

interface VmCardProps {
  vm: PlatformVm
  hostLabel?: string
  cpuPercent?: number
  memoryUsedMib?: number
  draggable?: boolean
  onDragStart?: () => void
}

export default function VmCard({ vm, hostLabel, cpuPercent, memoryUsedMib, draggable, onDragStart }: VmCardProps) {
  const running = vm.observed_state === 'running'
  const inner = (
    <>
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl ${running ? statusBadgeClasses('ok') : 'bg-slate-800 text-slate-400'}`}>
          <Monitor className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-100 truncate group-hover:text-white">{vm.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">{vm.observed_state || vm.desired_state}</p>
        </div>
        {vm.managed === false && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusBadgeClasses('warn')}`}>Discovered</span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {cpuPercent != null ? `${cpuPercent.toFixed(0)}%` : `${vm.vcpus} vCPU`}</span>
        <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> {memoryUsedMib != null ? `${memoryUsedMib} MiB` : `${Math.round(vm.memory_mib / 1024)} Gi`}</span>
      </div>
      {hostLabel && <p className="mt-2 text-[10px] text-slate-600 truncate">{hostLabel}</p>}
    </>
  )
  const className = 'platform-vm-card group block rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 hover:border-slate-600/80 hover:bg-slate-900/80 transition-all hover:shadow-lg hover:shadow-black/20'
  if (draggable) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-platform-vm', vm.id)
          e.dataTransfer.effectAllowed = 'move'
          onDragStart?.()
        }}
        className={`${className} cursor-grab active:cursor-grabbing`}
      >
        <Link to={`/platform/vms/${vm.id}`} onClick={(e) => e.stopPropagation()}>{inner}</Link>
      </div>
    )
  }
  return <Link to={`/platform/vms/${vm.id}`} className={className}>{inner}</Link>
}
