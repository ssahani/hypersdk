// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ReactNode } from 'react'
import { CheckCircle2, Circle, Copy, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { createVmPortForward } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import type { GuestAccessHints } from '../../utils/guestAccessHints'
import {
  buildExposePayload,
  laptopSshCommand,
  type NatRuleLike,
  sshNatHostPort,
} from '../../utils/vmPortForwardServices'

type Props = {
  vmId: string
  vmName: string
  vmState: string
  guestIp: string
  sshUser: string
  hypervisorAddress?: string
  guestAccess?: GuestAccessHints | null
  portForwardRules?: NatRuleLike[]
  guestToolsInstalling?: boolean
  onInstallGuestTools?: () => void
  onRefreshRules?: () => void
  onNotify?: (message: string) => void
  networkTabHref?: string
}

export default function VmLaptopAccessChecklist({
  vmId,
  vmName,
  vmState,
  guestIp,
  sshUser,
  hypervisorAddress,
  guestAccess,
  portForwardRules = [],
  guestToolsInstalling = false,
  onInstallGuestTools,
  onRefreshRules,
  onNotify,
  networkTabHref,
}: Props) {
  if (!guestAccess?.guest_ip_private) return null

  const running = vmState === 'running'
  const ip = guestIp.trim()
  const sshExposed = Boolean(sshNatHostPort(portForwardRules))
  const notify = (msg: string) => onNotify?.(msg)

  const exposeSsh = async () => {
    try {
      const taken = portForwardRules.map((r) => r.host_port)
      await createVmPortForward(vmId, buildExposePayload(vmName, 22, taken))
      notify('SSH exposed on hypervisor')
      onRefreshRules?.()
    } catch (e: unknown) {
      notify(formatUserError(e))
    }
  }

  const copySsh = async () => {
    const cmd = laptopSshCommand(sshUser, ip, hypervisorAddress, portForwardRules)
    if (!cmd) return
    try {
      await navigator.clipboard.writeText(cmd)
      notify('SSH command copied')
    } catch {
      notify('Copy failed')
    }
  }

  const steps = [
    {
      done: running,
      label: 'VM running',
      action: null as ReactNode,
    },
    {
      done: Boolean(ip),
      label: ip ? `Guest IP ${ip}` : 'Guest IP detected',
      action:
        !ip && onInstallGuestTools ? (
          <button type="button" className="btn-secondary text-xs" disabled={guestToolsInstalling} onClick={onInstallGuestTools}>
            {guestToolsInstalling ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null} Install guest tools
          </button>
        ) : null,
    },
    {
      done: sshExposed,
      label: sshExposed ? 'SSH exposed on hypervisor' : 'Expose SSH for laptop access',
      action: !sshExposed ? (
        <button type="button" className="btn-primary text-xs" disabled={!ip} onClick={() => void exposeSsh()}>
          Expose SSH
        </button>
      ) : networkTabHref ? (
        <Link to={networkTabHref} className="text-xs text-sky-400 hover:underline">Network tab</Link>
      ) : null,
    },
    {
      done: sshExposed && Boolean(ip),
      label: guestAccess.auth_mode === 'ssh_key' ? 'Connect with your SSH private key' : 'Connect from laptop',
      action: sshExposed ? (
        <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1" onClick={() => void copySsh()}>
          <Copy className="w-3 h-3" /> Copy ssh cmd
        </button>
      ) : null,
    },
  ]

  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 p-3 space-y-2" data-testid="vm-laptop-access-checklist">
      <p className="text-xs font-semibold text-sky-100/95">Laptop access checklist</p>
      <ul className="space-y-2 text-xs">
        {steps.map((step) => (
          <li key={step.label} className="flex flex-wrap items-center gap-2">
            {step.done ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <span className={step.done ? 'text-slate-200' : 'text-slate-400'}>{step.label}</span>
            {step.action}
          </li>
        ))}
      </ul>
      {guestAccess.auth_mode === 'ssh_key' && (
        <p className="text-[10px] text-slate-500">Serial password login is not configured — use SSH with the key injected at VM create.</p>
      )}
    </div>
  )
}
