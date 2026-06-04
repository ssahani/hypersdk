// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { CheckCircle2, Clock, Loader2, Users, XCircle } from 'lucide-react'
import type { GuestObservabilitySnapshot, VmGuestHealthReport } from '../../api/platform'
import { guestFstrim, guestSyncTime } from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'
import { statusPillClasses, statusSurfaceClasses, statusToneClass } from '../../utils/semanticColors'

function installStateLabel(state: string) {
  switch (state) {
    case 'running':
      return 'QGA active'
    case 'channel_only':
      return 'Channel only'
    case 'none':
      return 'Not configured'
    default:
      return state
  }
}

function installStateTone(state: string): 'ok' | 'warn' | 'error' | 'neutral' {
  if (state === 'running') return 'ok'
  if (state === 'channel_only') return 'warn'
  if (state === 'none') return 'error'
  return 'neutral'
}

function formatDeltaMs(ms: number) {
  const abs = Math.abs(ms)
  if (abs < 1000) return `${ms} ms`
  if (abs < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${(ms / 60_000).toFixed(1)} min`
}

type Props = {
  vmId: string
  loading?: boolean
  report: VmGuestHealthReport | null
  lastRefreshedAt?: Date | null
  onRefresh?: () => void
  onInstall?: () => void
  installing?: boolean
}

export default function GuestAgentDiagnosticsPanel({
  vmId,
  loading,
  report,
  lastRefreshedAt,
  onRefresh,
  onInstall,
  installing,
}: Props) {
  const toast = useToastContext()
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const obs: GuestObservabilitySnapshot | undefined = report?.guest_observability

  if (loading && !report) {
    return (
      <p className="text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Testing guest agent…
      </p>
    )
  }
  if (!report) return null

  const tone = installStateTone(report.install_state)
  const agentActive = report.install_state === 'running' && report.agent_ping

  const runAction = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setActionBusy(key)
    try {
      await fn()
      toast.success(success)
      onRefresh?.()
    } catch (e) {
      toast.error(formatUserError(e))
    } finally {
      setActionBusy(null)
    }
  }

  const osPill = [obs?.os_pretty_name || report.os_pretty_name, obs?.os_kernel, agentActive ? 'QGA' : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 backdrop-blur-sm ${statusSurfaceClasses(tone)}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-100">Guest agent</p>
            <p className="text-xs text-slate-400 mt-0.5">{report.summary}</p>
            {osPill && (
              <p className="text-xs text-slate-300 mt-2 font-medium">{osPill}</p>
            )}
          </div>
          <span className={statusPillClasses(tone)}>{installStateLabel(report.install_state)}</span>
        </div>
        {report.agent_version && (
          <p className="text-xs text-slate-500 mt-2 font-mono">Agent {report.agent_version}</p>
        )}
        {lastRefreshedAt && (
          <p className="text-xs text-slate-600 mt-1">
            Last refreshed {lastRefreshedAt.toLocaleTimeString()}
          </p>
        )}
      </div>

      {obs?.time && (
        <div className="rounded-lg border border-white/[0.06] bg-slate-900/40 px-3 py-2 text-sm flex items-start gap-2">
          <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${Math.abs(obs.time.delta_ms) > 5000 ? statusToneClass('warn') : statusToneClass('ok')}`} />
          <div>
            <p className="text-slate-200">Guest vs host time</p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Δ {formatDeltaMs(obs.time.delta_ms)} · guest {new Date(obs.time.guest_time_rfc3339).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {obs?.fs_freeze?.frozen && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${statusSurfaceClasses('warn')}`}>
          Filesystems frozen — {obs.fs_freeze.detail}
        </p>
      )}

      {report.checks.length > 0 && (
        <ul className="space-y-2">
          {report.checks.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-slate-900/40 px-3 py-2 text-sm"
            >
              {c.passed ? (
                <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${statusToneClass('ok')}`} />
              ) : (
                <XCircle className={`w-4 h-4 shrink-0 mt-0.5 ${statusToneClass('error')}`} />
              )}
              <div className="min-w-0">
                <p className="text-slate-200">{c.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {obs?.users && obs.users.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 bg-slate-900/60 flex items-center gap-1">
            <Users className="w-3 h-3" /> Users & sessions
          </p>
          <ul className="text-xs divide-y divide-white/[0.04]">
            {obs.users.map((u) => (
              <li key={`${u.username}-${u.login_time ?? ''}`} className="px-3 py-2 text-slate-300">
                <span className="font-medium">{u.username}</span>
                {u.login_time && (
                  <span className="text-slate-500"> · {new Date(u.login_time).toLocaleString()}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {obs?.filesystems && obs.filesystems.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 bg-slate-900/60">
            Guest filesystems
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/[0.06]">
                <th className="px-3 py-2">Mount</th>
                <th className="px-3 py-2 text-right">Used</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {obs.filesystems.map((fs) => {
                const pct = fs.total_bytes > 0 ? Math.round((fs.used_bytes / fs.total_bytes) * 100) : 0
                return (
                  <tr key={fs.mountpoint} className="border-b border-white/[0.04]">
                    <td className="px-3 py-2 font-mono text-slate-300">{fs.mountpoint}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{pct}%</td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {(fs.used_bytes / 1e9).toFixed(1)} / {(fs.total_bytes / 1e9).toFixed(1)} GiB
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {obs?.ip_addresses && obs.ip_addresses.length > 0 && (
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Internal IPs</p>
          {obs.ip_addresses
            .filter((a) => a.ip_type !== 'ipv6' && !a.address.startsWith('127.'))
            .map((a) => (
              <p key={`${a.name}-${a.address}`} className="font-mono">
                {a.address}
                <span className="text-slate-500"> · {a.name}</span>
                {a.source ? <span className="text-slate-600"> ({a.source})</span> : null}
              </p>
            ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {onRefresh && (
          <button type="button" className="btn-secondary text-xs" disabled={loading} onClick={onRefresh}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
            Refresh guest info
          </button>
        )}
        {agentActive && (
          <>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!!actionBusy}
              onClick={() =>
                void runAction('sync', () => guestSyncTime(vmId), 'Guest time synced to host')
              }
            >
              {actionBusy === 'sync' ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
              Sync time to host
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!!actionBusy}
              onClick={() => void runAction('trim', () => guestFstrim(vmId), 'Filesystem TRIM completed')}
            >
              {actionBusy === 'trim' ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
              TRIM filesystems
            </button>
          </>
        )}
        {onInstall && report.install_state !== 'running' && (
          <button type="button" className="btn-secondary text-xs" disabled={installing} onClick={onInstall}>
            {installing ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
            Attach channel
          </button>
        )}
      </div>
    </div>
  )
}

/** Compact pill for VM detail header. */
export function GuestAgentHeaderPill({ report }: { report: VmGuestHealthReport | null | undefined }) {
  if (!report) return null
  const tone = installStateTone(report.install_state)
  const label = report.os_pretty_name || installStateLabel(report.install_state)
  const kernel = report.guest_observability?.os_kernel
  const parts = [label, kernel, report.install_state === 'running' ? 'QGA' : null].filter(Boolean)
  if (!parts.length) return null
  return (
    <span className={statusPillClasses(tone)} title={report.summary}>
      {parts.join(' · ')}
    </span>
  )
}
