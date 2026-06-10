// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Monitor } from 'lucide-react'
import { openCenterPopout } from '../../../utils/platformCenterPopout'

type Props = {
  vmId: string
  vmName: string
  connected?: boolean
}

export default function ConsoleTheatrePreview({ vmId, vmName, connected = true }: Props) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-black/40 overflow-hidden" data-testid="console-theatre-preview">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] text-xs">
        <span className="text-slate-300 font-medium">Console Theatre</span>
        <span className={connected ? 'text-emerald-400' : 'text-slate-500'}>{connected ? 'VNC · Ready' : 'Disconnected'}</span>
      </div>
      <div className="p-3 font-mono text-[10px] text-emerald-300/80 space-y-0.5 min-h-[5rem] bg-gradient-to-b from-slate-950 to-black">
        <p>root@{vmName}:~# htop</p>
        <p className="text-slate-500">CPU · Memory · processes…</p>
      </div>
      <button
        type="button"
        className="w-full btn-secondary text-xs rounded-none border-0 border-t border-white/[0.06] py-2 inline-flex items-center justify-center gap-1"
        onClick={() => openCenterPopout(`/platform/vms/${vmId}/consolehub?popout=1`)}
      >
        <Monitor className="w-3.5 h-3.5" /> Open Theatre
      </button>
    </section>
  )
}
