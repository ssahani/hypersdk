// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertTriangle, CalendarClock, Download, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  MacGlassPanel,
  MacListRow,
  MacSectionTitle,
  MacStatWidget,
} from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import {
  createMaintenanceSchedule,
  deleteMaintenanceSchedule,
  getFleetUpdates,
  listMaintenanceSchedules,
  listPlatformHosts,
  type FleetUpdatesOverview,
  type MaintenanceSchedule,
  type PlatformHost,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

type TabId = 'updates' | 'schedules'

const TAB_IDS: TabId[] = ['updates', 'schedules']

export default function PlatformMaintenance() {
  const toast = useToastContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: TabId = TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : 'updates'

  const [fleet, setFleet] = useState<FleetUpdatesOverview | null>(null)
  const [rows, setRows] = useState<MaintenanceSchedule[]>([])
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingUpdates, setLoadingUpdates] = useState(false)
  const [hostId, setHostId] = useState('')
  const [runAt, setRunAt] = useState('')

  const setTab = (next: TabId) => {
    setSearchParams(next === 'updates' ? {} : { tab: next })
  }

  const loadSchedules = useCallback(async () => {
    const [schedules, hostRows] = await Promise.all([listMaintenanceSchedules(), listPlatformHosts()])
    setRows(schedules)
    setHosts(hostRows)
    if (!hostId && hostRows[0]) setHostId(hostRows[0].id)
  }, [hostId])

  const loadUpdates = useCallback(async () => {
    setLoadingUpdates(true)
    setError(null)
    try {
      setFleet(await getFleetUpdates())
    } catch (e: unknown) {
      setError(formatUserError(e))
      setFleet(null)
    } finally {
      setLoadingUpdates(false)
    }
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      if (tab === 'updates') {
        await loadUpdates()
      } else {
        await loadSchedules()
      }
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [tab, loadUpdates, loadSchedules])

  useEffect(() => { void load() }, [load])

  const hostName = (id: string) => hosts.find((h) => h.id === id)?.hostname || id.slice(0, 8)

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/80">Software Update</p>
          <MacSectionTitle
            title="Maintenance"
            subtitle="Fleet patch catalog and deferred maintenance windows — macOS Software Update for hypervisors."
          />
        </div>
        <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => void load()}>
          {loadingUpdates ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-1">
        {([
          ['updates', 'Updates', Download],
          ['schedules', 'Schedules', CalendarClock],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm rounded-t-lg flex items-center gap-2 transition ${
              tab === id ? 'bg-slate-800/80 text-orange-300 border-b-2 border-orange-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      {tab === 'updates' && (
        <div className="space-y-4">
          {fleet && (
            <>
              <p className="text-sm text-slate-400">{fleet.summary}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MacStatWidget label="Hosts scanned" value={String(fleet.hosts_scanned)} icon={<Download className="w-4 h-4" />} />
                <MacStatWidget
                  label="OS updates"
                  value={String(fleet.hosts_with_updates)}
                  icon={<AlertTriangle className="w-4 h-4" />}
                  tone={fleet.hosts_with_updates > 0 ? 'warn' : 'ok'}
                />
                <MacStatWidget
                  label="Reboot required"
                  value={String(fleet.hosts_reboot_required)}
                  icon={<RefreshCw className="w-4 h-4" />}
                  tone={fleet.hosts_reboot_required > 0 ? 'warn' : 'ok'}
                />
                <MacStatWidget
                  label="Agent drift"
                  value={String(fleet.agent_drift_count)}
                  icon={<Download className="w-4 h-4" />}
                  tone={fleet.agent_drift_count > 0 ? 'warn' : 'ok'}
                />
              </div>
              <p className="text-xs text-slate-500">
                Recommended agent: <span className="text-slate-300 font-mono">{fleet.recommended_agent}</span>
                {fleet.total_pending_packages > 0 && (
                  <> · <span className="text-slate-300">{fleet.total_pending_packages}</span> pending package(s) counted</>
                )}
              </p>
            </>
          )}
          {!fleet && loadingUpdates && (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Probing host package managers…
            </div>
          )}
          {fleet && (
            <MacGlassPanel title="Host patch catalog" subtitle="Read-only apt/dnf/apk/pacman/zypper probes via enrolled agents.">
              {fleet.hosts.length === 0 ? (
                <p className="text-sm text-slate-400">No online hosts to scan.</p>
              ) : (
                <div className="divide-y divide-white/[0.04] -mx-1">
                  {fleet.hosts.map((h) => (
                    <MacListRow
                      key={h.host_id}
                      title={h.hostname}
                      subtitle={
                        h.summary
                        ?? (h.pending_count != null ? `${h.pending_count} pending (${h.backend})` : h.backend)
                      }
                      href={`/platform/hosts/${h.host_id}`}
                      badge={
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${
                          h.status === 'ok'
                            ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                            : h.status === 'unreachable'
                              ? 'text-slate-400 border-white/[0.08]'
                              : 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                        }`}>
                          {h.reboot_required ? 'reboot' : h.status}
                        </span>
                      }
                      trailing={
                        h.agent_update_available ? (
                          <span className="text-[10px] text-violet-300">agent → {fleet.recommended_agent}</span>
                        ) : null
                      }
                    />
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-4">
                Apply upgrades on-host or schedule maintenance below. Package probes may take up to 45s per hypervisor.
              </p>
            </MacGlassPanel>
          )}
        </div>
      )}

      {tab === 'schedules' && (
        <>
          <div className="card p-4 grid gap-3 md:grid-cols-4">
            <select className="input" value={hostId} onChange={(e) => setHostId(e.target.value)}>
              {hosts.map((h) => <option key={h.id} value={h.id}>{h.hostname}</option>)}
            </select>
            <input className="input md:col-span-2" type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
            <button type="button" className="btn-primary w-fit flex items-center gap-2" disabled={!hostId || !runAt} onClick={async () => {
              try {
                await createMaintenanceSchedule({ host_id: hostId, action: 'enter', evacuate: true, run_at: new Date(runAt).toISOString() })
                toast.success('Schedule created')
                await loadSchedules()
              } catch (e: unknown) { toast.error(formatUserError(e)) }
            }}><Plus className="w-4 h-4" /> Schedule</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 border-b border-slate-800"><th className="p-3 text-left">Host</th><th className="p-3">Action</th><th className="p-3">Run at</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
              <tbody>{rows.map((s) => (
                <tr key={s.id} className="border-b border-slate-900">
                  <td className="p-3">
                    <Link to={`/platform/hosts/${s.host_id}`} className="text-blue-400 hover:underline">{hostName(s.host_id)}</Link>
                  </td>
                  <td className="p-3">{s.action}{s.evacuate ? ' (evacuate)' : ''}</td>
                  <td className="p-3 text-slate-500">{new Date(s.run_at).toLocaleString()}</td>
                  <td className="p-3">{s.status}</td>
                  <td className="p-3 text-right">
                    {s.status === 'pending' && (
                      <button type="button" className="btn-secondary text-xs" onClick={async () => {
                        try { await deleteMaintenanceSchedule(s.id); toast.success('Cancelled'); await loadSchedules() } catch (e: unknown) { toast.error(formatUserError(e)) }
                      }}><Trash2 className="w-3 h-3 inline" /></button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
