// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Copy, Loader2, Power, X } from 'lucide-react'
import type { VmGuestHealthReport, VmPendingConfig } from '../../api/platform'
import { guestToolsStripVisible } from '../../utils/guestAgentUx'
import type { GuestAccessHints } from '../../utils/guestAccessHints'
import { statusPillClasses, statusSurfaceClasses, statusToneClass } from '../../utils/semanticColors'
import { sshNatHostPort, type NatRuleLike } from '../../utils/vmPortForwardServices'

const DISMISS_KEY = 'machina_guest_tools_strip_dismissed'

type Props = {
  vmId: string
  pending?: VmPendingConfig | null
  pendingLoading?: boolean
  guestHealth?: VmGuestHealthReport | null
  guestToolsStatus?: string | null
  observedState?: string
  guestIp?: string
  guestAccess?: GuestAccessHints | null
  portForwardRules?: NatRuleLike[]
  guestToolsInstalling?: boolean
  onShutdownForPending?: () => void
  onOpenGuestHealth?: () => void
  onInstallGuestTools?: () => void
  onOpenAccess?: () => void
}

type AttentionItem = {
  id: string
  priority: number
  label: string
  detail: string
  expanded: React.ReactNode
  chipLabel: string
  onChipClick?: () => void
  dismissible?: boolean
}

export default function VmAttentionStack({
  vmId,
  pending,
  pendingLoading,
  guestHealth,
  guestToolsStatus,
  observedState,
  guestIp,
  guestAccess,
  portForwardRules = [],
  guestToolsInstalling,
  onShutdownForPending,
  onOpenGuestHealth,
  onInstallGuestTools,
  onOpenAccess,
}: Props) {
  const dismissId = `${DISMISS_KEY}:${vmId}`
  const [guestDismissed, setGuestDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissId) === '1'
    } catch {
      return false
    }
  })

  if (pendingLoading) return null

  const running = observedState === 'running'
  const ip = guestIp?.trim() ?? ''
  const sshExposed = Boolean(sshNatHostPort(portForwardRules))
  const privateNat = Boolean(guestAccess?.guest_ip_private)

  const items: AttentionItem[] = []

  if (pending?.needs_shutdown) {
    items.push({
      id: 'pending_config',
      priority: 1,
      label: 'Changes pending shutdown',
      chipLabel: 'Pending config',
      detail: 'Persistent configuration differs from the running guest. Shut down and start the VM to apply changes.',
      expanded: (
        <div className="space-y-3">
          <p className="text-sm text-slate-200">{pending.pending_changes.length > 0
            ? 'The following changes require a full shutdown:'
            : 'Shut down and start the VM to apply pending changes.'}</p>
          {pending.pending_changes.length > 0 && (
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              {pending.pending_changes.slice(0, 6).map((c) => (
                <li key={`${c.category}-${c.summary}`}>
                  <span className="text-slate-500 uppercase tracking-wide">{c.category}</span>
                  {' — '}
                  {c.summary}
                </li>
              ))}
              {pending.pending_changes.length > 6 && <li>+{pending.pending_changes.length - 6} more</li>}
            </ul>
          )}
          {onShutdownForPending && (
            <button type="button" className="btn-secondary text-sm" onClick={onShutdownForPending}>
              <Power className="w-4 h-4" /> Shut down to apply
            </button>
          )}
        </div>
      ),
    })
  }

  if (running && guestToolsStripVisible(guestHealth, guestToolsStatus) && !guestDismissed) {
    const detail =
      guestHealth?.install_state === 'channel_only'
        ? 'Virtio channel is attached — start guestkit-agent inside the guest (QGA-compatible).'
        : 'Guest agent is not fully active — attach the channel and install guestkit-agent inside the VM.'
    items.push({
      id: 'guest_agent',
      priority: 2,
      label: 'Guest agent setup',
      chipLabel: 'Guest agent',
      detail,
      dismissible: true,
      onChipClick: onOpenGuestHealth,
      expanded: (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className={`text-sm ${statusToneClass('warn')}`}>{detail}</p>
          <div className="flex flex-wrap gap-2 shrink-0">
            {onOpenGuestHealth && (
              <button type="button" className="btn-secondary text-xs" onClick={onOpenGuestHealth}>
                Open Guest health
              </button>
            )}
            {onInstallGuestTools && (
              <button type="button" className="btn-secondary text-xs" disabled={guestToolsInstalling} onClick={onInstallGuestTools}>
                {guestToolsInstalling ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
                Attach channel
              </button>
            )}
            <button
              type="button"
              className="p-1 text-slate-500 hover:text-slate-300"
              aria-label="Dismiss guest agent reminder"
              onClick={() => {
                setGuestDismissed(true)
                try {
                  localStorage.setItem(dismissId, '1')
                } catch { /* private mode */ }
              }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ),
    })
  }

  if (running && privateNat && (!ip || !sshExposed)) {
    items.push({
      id: 'laptop_access',
      priority: 3,
      label: 'Laptop access',
      chipLabel: !ip ? 'Guest IP' : 'Expose SSH',
      onChipClick: onOpenAccess,
      detail: !ip
        ? 'Guest IP not detected yet — install guest tools or wait for DHCP.'
        : 'Expose SSH on the hypervisor so you can connect from your laptop via NAT.',
      expanded: (
        <ul className="space-y-2 text-xs">
          <li className="flex items-center gap-2">
            {running ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 text-slate-500" />}
            <span className="text-slate-200">VM running</span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            {ip ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 text-slate-500" />}
            <span className={ip ? 'text-slate-200' : 'text-slate-400'}>{ip ? `Guest IP ${ip}` : 'Waiting for guest IP'}</span>
            {!ip && onInstallGuestTools && (
              <button type="button" className="btn-secondary text-xs" disabled={guestToolsInstalling} onClick={onInstallGuestTools}>
                Install guest tools
              </button>
            )}
          </li>
          <li className="flex flex-wrap items-center gap-2">
            {sshExposed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 text-slate-500" />}
            <span className={sshExposed ? 'text-slate-200' : 'text-slate-400'}>
              {sshExposed ? 'SSH exposed on hypervisor' : 'Expose SSH for laptop access'}
            </span>
            {!sshExposed && onOpenAccess && (
              <button type="button" className="btn-primary text-xs" onClick={onOpenAccess}>
                Open Access tab
              </button>
            )}
          </li>
        </ul>
      ),
    })
  }

  if (items.length === 0) return null

  items.sort((a, b) => a.priority - b.priority)
  const [expanded, ...rest] = items

  return (
    <div className="space-y-2" data-testid="vm-attention-stack">
      <div
        className={`rounded-xl border p-4 ${statusSurfaceClasses(expanded.id === 'pending_config' ? 'warn' : 'warn')}`}
        data-testid={expanded.id === 'pending_config' ? 'vm-pending-config-banner' : undefined}
      >
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-medium text-slate-100">{expanded.label}</p>
            {expanded.expanded}
          </div>
        </div>
      </div>
      {rest.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rest.map((item) => (
            <button
              key={item.id}
              type="button"
              className={statusPillClasses('warn')}
              onClick={item.onChipClick}
            >
              {item.chipLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
