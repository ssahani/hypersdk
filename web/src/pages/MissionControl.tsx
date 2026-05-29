// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowRightLeft, Boxes, Server, X } from 'lucide-react'
import {
  getClusterSummary,
  listNotifications,
  listPlatformHosts,
  listPlatformTasks,
  listPlatformVms,
  type ClusterSummary,
  type PlatformHost,
  type PlatformTask,
  type PlatformVm,
} from '../api/platform'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { formatUserError } from '../utils/apiError'

export default function MissionControl() {
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [vms, setVms] = useState<PlatformVm[]>([])
  const [tasks, setTasks] = useState<PlatformTask[]>([])
  const [cluster, setCluster] = useState<ClusterSummary | null>(null)
  const [alerts, setAlerts] = useState<Array<{ id: string; kind: string; created_at: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [h, v, t, c, n] = await Promise.all([
        listPlatformHosts(),
        listPlatformVms(),
        listPlatformTasks(),
        getClusterSummary(),
        listNotifications(true).catch(() => []),
      ])
      setHosts(h)
      setVms(v)
      setTasks(t)
      setCluster(c)
      setAlerts(n)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useKeyboardShortcut({
    key: 'Escape',
    handler: () => { window.history.back() },
  })

  const failedTasks = tasks.filter((t) => t.status === 'failed')
  const migrations = tasks.filter((t) => t.operation.includes('migrate'))

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/98 backdrop-blur-xl overflow-y-auto animate-fade-in">
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-slate-950/90">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Mission Control</h1>
          <p className="text-sm text-slate-500">{cluster?.name || 'Cluster'} · {hosts.length} hosts · {vms.length} VMs</p>
        </div>
        <Link to="/platform" className="btn-secondary flex items-center gap-2"><X className="w-4 h-4" /> Close</Link>
      </header>
      {error && <p className="px-6 py-2 text-red-400 text-sm">{error}</p>}
      <div className="p-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-2xl border border-white/[0.06] bg-slate-900/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2"><Server className="w-4 h-4" /> Hosts</h2>
          <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {hosts.map((h) => (
              <li key={h.id}>
                <Link to={`/platform/hosts/${h.id}`} className="flex justify-between hover:text-blue-300">
                  <span>{h.hostname}</span>
                  <span className={h.state === 'online' ? 'text-emerald-400' : 'text-red-400'}>{h.state}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-white/[0.06] bg-slate-900/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2"><Boxes className="w-4 h-4" /> Virtual machines</h2>
          <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {vms.slice(0, 24).map((v) => (
              <li key={v.id}>
                <Link to={`/platform/vms/${v.id}`} className="flex justify-between hover:text-blue-300">
                  <span className="truncate">{v.name}</span>
                  <span className="text-slate-500 shrink-0 ml-2">{v.observed_state}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-white/[0.06] bg-slate-900/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">No unread alerts</p>
          ) : (
            <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="text-amber-200">{a.kind}</li>
              ))}
            </ul>
          )}
          <Link to="/platform/notifications" className="text-xs text-blue-400">Open Notification Center →</Link>
        </section>
        <section className="rounded-2xl border border-white/[0.06] bg-slate-900/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Migrations & tasks</h2>
          <p className="text-xs text-slate-500">{migrations.length} migration tasks · {failedTasks.length} failed</p>
          <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
            {failedTasks.slice(0, 8).map((t) => (
              <li key={t.id} className="text-red-300 truncate">{t.operation} — {t.status}</li>
            ))}
          </ul>
          <Link to="/platform/tasks" className="text-xs text-blue-400">View all tasks →</Link>
        </section>
      </div>
    </div>
  )
}
