// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import {
  createMaintenanceSchedule,
  deleteMaintenanceSchedule,
  listMaintenanceSchedules,
  listPlatformHosts,
  type MaintenanceSchedule,
  type PlatformHost,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function PlatformMaintenance() {
  const toast = useToastContext()
  const [rows, setRows] = useState<MaintenanceSchedule[]>([])
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hostId, setHostId] = useState('')
  const [runAt, setRunAt] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [schedules, hostRows] = await Promise.all([listMaintenanceSchedules(), listPlatformHosts()])
      setRows(schedules)
      setHosts(hostRows)
      if (!hostId && hostRows[0]) setHostId(hostRows[0].id)
    } catch (e: unknown) { setError(formatUserError(e)) }
  }, [hostId])

  useEffect(() => { void load() }, [load])

  const hostName = (id: string) => hosts.find((h) => h.id === id)?.hostname || id.slice(0, 8)

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Maintenance schedules" subtitle="Deferred host maintenance windows" />
      {error && <ErrorBanner message={error} />}
      <div className="card p-4 grid gap-3 md:grid-cols-4">
        <select className="input" value={hostId} onChange={(e) => setHostId(e.target.value)}>
          {hosts.map((h) => <option key={h.id} value={h.id}>{h.hostname}</option>)}
        </select>
        <input className="input md:col-span-2" type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
        <button type="button" className="btn-primary w-fit flex items-center gap-2" disabled={!hostId || !runAt} onClick={async () => {
          try {
            await createMaintenanceSchedule({ host_id: hostId, action: 'enter', evacuate: true, run_at: new Date(runAt).toISOString() })
            toast.success('Schedule created')
            await load()
          } catch (e: unknown) { toast.error(formatUserError(e)) }
        }}><Plus className="w-4 h-4" /> Schedule</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-slate-400 border-b border-slate-800"><th className="p-3 text-left">Host</th><th className="p-3">Action</th><th className="p-3">Run at</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.id} className="border-b border-slate-900">
              <td className="p-3">{hostName(s.host_id)}</td>
              <td className="p-3">{s.action}{s.evacuate ? ' (evacuate)' : ''}</td>
              <td className="p-3 text-slate-500">{new Date(s.run_at).toLocaleString()}</td>
              <td className="p-3">{s.status}</td>
              <td className="p-3 text-right">
                {s.status === 'pending' && (
                  <button type="button" className="btn-secondary text-xs" onClick={async () => {
                    try { await deleteMaintenanceSchedule(s.id); toast.success('Cancelled'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
                  }}><Trash2 className="w-3 h-3 inline" /></button>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
