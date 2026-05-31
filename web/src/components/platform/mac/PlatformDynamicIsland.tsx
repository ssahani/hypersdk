// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useFleetDesktop } from '../../../hooks/useFleetDesktop'
import { getSreForecast, type SreForecast } from '../../../api/ai'

export default function PlatformDynamicIsland() {
  const { desktop, linuxHealth } = useFleetDesktop(true, 60_000)
  const [expanded, setExpanded] = useState(false)
  const [forecasts, setForecasts] = useState<SreForecast[]>([])

  useEffect(() => {
    void getSreForecast()
      .then((r) => setForecasts(r.forecasts ?? []))
      .catch(() => setForecasts([]))
  }, [])

  const pressure = linuxHealth?.pressure_hosts ?? desktop?.pressure_hosts ?? 0
  const criticalForecast = forecasts.find((f) => f.severity === 'critical')
  const failedTasks = desktop?.failed_tasks_24h ?? 0
  const actionableIssues = (desktop?.slo_breach_count ?? 0) + pressure
  const alertBacklog = desktop?.unread_notifications ?? 0

  const state = useMemo(() => {
    if (pressure > 0 || criticalForecast) return 'alert' as const
    if (actionableIssues > 0 || failedTasks > 0) return 'warn' as const
    if (alertBacklog > 0) return 'notify' as const
    return 'ok' as const
  }, [pressure, criticalForecast, actionableIssues, failedTasks, alertBacklog])

  const formatCount = (n: number) => (n > 999 ? '999+' : String(n))

  const label = state === 'ok'
    ? `Healthy · ${desktop?.hosts_online ?? 0}/${desktop?.hosts_total ?? 0} hosts`
    : state === 'warn'
      ? failedTasks > 0 && actionableIssues === 0
        ? `${formatCount(failedTasks)} failed task${failedTasks === 1 ? '' : 's'}`
        : `${formatCount(actionableIssues + (failedTasks > 0 ? 1 : 0))} issue${actionableIssues + (failedTasks > 0 ? 1 : 0) === 1 ? '' : 's'}`
      : state === 'notify'
        ? `${formatCount(alertBacklog)} alert${alertBacklog === 1 ? '' : 's'}`
        : pressure > 0
          ? `${pressure} host(s) under pressure`
          : 'Critical alert'

  const pillClass = state === 'ok'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : state === 'notify'
      ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
      : state === 'warn'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
        : 'border-red-500/40 bg-red-500/10 text-red-200'

  return (
    <div className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`mac-dynamic-island inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-medium transition-all ${pillClass}`}
        aria-expanded={expanded}
      >
        <span className={`h-2 w-2 rounded-full ${state === 'ok' ? 'bg-emerald-400' : state === 'warn' ? 'bg-amber-400' : 'bg-red-400 animate-pulse'}`} />
        {label}
      </button>
      {expanded && (
        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-white/[0.1] bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl z-50 text-left">
          <p className="text-xs font-semibold text-slate-300 mb-2">Infrastructure status</p>
          {desktop && <p className="text-xs text-slate-400 mb-3">{desktop.summary}</p>}
          {alertBacklog > 0 && (
            <p className="text-xs text-sky-300/90 mb-2">
              {alertBacklog.toLocaleString()} unread notification{alertBacklog === 1 ? '' : 's'} in backlog
            </p>
          )}
          {failedTasks > 0 && (
            <p className="text-xs text-amber-300/90 mb-2">
              {formatCount(failedTasks)} failed task{failedTasks === 1 ? '' : 's'} in the last 24 hours —{' '}
              <Link to="/platform/operations" className="text-sky-400 hover:underline" onClick={() => setExpanded(false)}>Operations hub</Link>
            </p>
          )}
          {actionableIssues > 0 && (
            <p className="text-xs text-amber-300/90 mb-2">
              {actionableIssues} open issue{actionableIssues === 1 ? '' : 's'} (SLO breaches, host pressure)
            </p>
          )}
          {criticalForecast ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 mb-3 text-xs text-red-200">
              <p className="font-medium">Action suggested</p>
              <p className="mt-1 text-red-200/90">{criticalForecast.message}</p>
            </div>
          ) : pressure > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 mb-3 text-xs text-amber-200">
              <p>{linuxHealth?.summary ?? desktop?.linux_summary ?? 'Hosts under resource pressure'}</p>
            </div>
          ) : (
            <p className="text-xs text-emerald-300/90 mb-3">All monitored systems nominal.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to="/platform/hosts" className="text-xs text-blue-400 hover:underline" onClick={() => setExpanded(false)}>Hosts</Link>
            <Link to="/platform/operations" className="text-xs text-blue-400 hover:underline" onClick={() => setExpanded(false)}>Operations</Link>
            <Link to="/platform/activity" className="text-xs text-blue-400 hover:underline" onClick={() => setExpanded(false)}>Activity</Link>
          </div>
        </div>
      )}
    </div>
  )
}
