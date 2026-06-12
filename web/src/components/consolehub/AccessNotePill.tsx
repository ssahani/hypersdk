// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Terminal, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'
import { createVmPortForward } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import {
  aggregateAccessNoteLabels,
  aggregateAccessNoteMessages,
  type GuestAccessHints,
} from '../../utils/guestAccessHints'
import { buildExposePayload, laptopSshCommand, type NatRuleLike } from '../../utils/vmPortForwardServices'

type Props = {
  hints: GuestAccessHints | null | undefined
  vmId?: string
  vmName?: string
  sshUser?: string
  guestIp?: string
  hypervisorHost?: string
  portForwardRules?: NatRuleLike[]
  onPlanRefresh?: () => void
  onNotify?: (message: string) => void
  onOpenShell?: () => void
  onExplain?: () => void
  className?: string
}

export default function AccessNotePill({
  hints,
  vmId,
  vmName,
  sshUser,
  guestIp,
  hypervisorHost,
  portForwardRules = [],
  onPlanRefresh,
  onNotify,
  onOpenShell,
  onExplain,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const host = hypervisorHost || (typeof window !== 'undefined' ? window.location.hostname : undefined)
  const labels = aggregateAccessNoteLabels(hints, { sshUser, guestIp, hypervisorHost: host })
  const messages = aggregateAccessNoteMessages(hints, {
    sshUser,
    guestIp,
    hypervisorHost: host,
    vmNetworkHref: vmId ? `/platform/vms/${vmId}?tab=network` : undefined,
  })

  if (labels.length === 0 && messages.length === 0) return null

  const notify = (msg: string) => onNotify?.(msg)
  const sshCmd = laptopSshCommand(sshUser || 'ubuntu', guestIp || '', host, portForwardRules)

  const exposeSsh = async () => {
    if (!vmId || !vmName) return
    setBusy(true)
    try {
      const taken = portForwardRules.map((r) => r.host_port)
      await createVmPortForward(vmId, buildExposePayload(vmName, 22, taken))
      notify('SSH exposed on hypervisor')
      onPlanRefresh?.()
    } catch (e: unknown) {
      notify(formatUserError(e))
    } finally {
      setBusy(false)
    }
  }

  const copySsh = async () => {
    if (!sshCmd) return
    try {
      await navigator.clipboard.writeText(sshCmd)
      notify('SSH command copied')
    } catch {
      notify('Copy failed')
    }
  }

  return (
    <div
      className={`absolute top-14 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[min(92vw,36rem)] ${className}`}
      data-testid="access-note-pill"
    >
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/35 bg-black/70 backdrop-blur-md text-xs text-amber-100/95 shadow-lg hover:bg-black/80 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
        <span className="truncate text-left flex-1">
          Access note: {labels.join(' · ') || 'Review guest access'}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
      </button>
      {open ? (
        <div className="mt-2 rounded-xl border border-amber-500/25 bg-slate-950/95 backdrop-blur-md p-3 text-xs text-amber-100/90 space-y-2 shadow-xl">
          {messages.map((msg) => (
            <p key={msg}>{msg}</p>
          ))}
          {sshCmd ? (
            <pre className="rounded-lg bg-black/50 border border-white/10 p-2 font-mono text-[11px] text-emerald-200/90 overflow-x-auto">
              {sshCmd}
            </pre>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {sshCmd ? (
              <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1" onClick={() => void copySsh()}>
                <Copy className="w-3 h-3" /> Copy command
              </button>
            ) : null}
            {hints?.guest_ip_private && !hints.ssh_nat_host_port && vmId && vmName ? (
              <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void exposeSsh()}>
                {busy ? 'Exposing…' : 'Expose SSH'}
              </button>
            ) : null}
            {onOpenShell ? (
              <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1" onClick={onOpenShell}>
                <Terminal className="w-3 h-3" /> Open Shell
              </button>
            ) : null}
            {onExplain ? (
              <button type="button" className="btn-secondary text-xs" onClick={onExplain}>
                Explain
              </button>
            ) : null}
            {vmId ? (
              <Link to={`/platform/vms/${vmId}?tab=network`} className="btn-secondary text-xs">
                Network
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
