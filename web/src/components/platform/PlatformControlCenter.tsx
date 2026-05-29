// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { SlidersHorizontal, X, CheckCircle2, AlertTriangle, HardDrive, Loader2, HelpCircle, Bot } from 'lucide-react'
import {
  getCapacityReport,
  getClusterSummary,
  listNotifications,
  listPlatformHosts,
  listPlatformTasks,
  listPlatformVms,
  type CapacityReport,
  type ClusterSummary,
  type PlatformHost,
  type PlatformTask,
} from '../../api/platform'
import { useAi } from '../../contexts/AiContext'

export default function PlatformControlCenter() {
  const { mode, openCopilot } = useAi()
  const [open, setOpen] = useState(false)
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [vms, setVms] = useState<{ observed_state: string }[]>([])
  const [tasks, setTasks] = useState<PlatformTask[]>([])
  const [cluster, setCluster] = useState<ClusterSummary | null>(null)
  const [capacity, setCapacity] = useState<CapacityReport | null>(null)
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  const load = useCallback(async () => {
    try {
      const [h, v, t, c, cap, alerts] = await Promise.all([
        listPlatformHosts(),
        listPlatformVms(),
        listPlatformTasks(),
        getClusterSummary(),
        getCapacityReport().catch(() => null),
        listNotifications(true).catch(() => []),
      ])
      setHosts(h)
      setVms(v)
      setTasks(t)
      setCluster(c)
      setCapacity(cap)
      setUnreadAlerts(alerts.length)
    } catch {
      /* optional panel */
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const running = vms.filter((v) => v.observed_state === 'running').length
  const activeTasks = tasks.filter((t) => t.status === 'running' || t.status === 'pending').length
  const offlineHosts = hosts.filter((h) => h.state === 'offline')
  const offlineCount = offlineHosts.length
  const warnings = offlineCount + tasks.filter((t) => t.status === 'failed').length
  const memPct = capacity && capacity.memory_total_mib > 0
    ? Math.round((capacity.memory_used_mib / capacity.memory_total_mib) * 100)
    : null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-sm text-slate-200 hover:bg-slate-700/80 transition"
        aria-label="Control Center"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Control Center</span>
        {warnings > 0 && (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-dot" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="font-semibold text-sm">Control Center</span>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <Row
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                label={cluster?.name || 'Production cluster'}
                value={offlineCount === 0 ? 'Healthy' : `${offlineCount} host(s) offline`}
                tone={offlineCount === 0 ? 'ok' : 'warn'}
              />
              {memPct != null && (
                <Row icon={<HardDrive className="w-4 h-4 text-blue-400" />} label="Cluster memory" value={`${memPct}% used`} href="/platform/reports" />
              )}
              {offlineCount > 0 && (
                <Row
                  icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
                  label={offlineHosts[0]?.hostname ?? 'Offline host'}
                  value="Fix — sync agent"
                  href={`/platform/hosts/${offlineHosts[0]?.id ?? ''}`}
                  tone="warn"
                />
              )}
              <Row icon={<HardDrive className="w-4 h-4 text-blue-400" />} label="Storage" value="View pools →" href="/platform/storage" />
              <Row
                icon={<Loader2 className={`w-4 h-4 text-violet-400 ${activeTasks ? 'animate-spin' : ''}`} />}
                label="Running tasks"
                value={String(activeTasks)}
                href="/platform/tasks"
              />
              <Row
                icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
                label="Alerts"
                value={unreadAlerts ? `${unreadAlerts} unread` : warnings ? `${warnings} item(s)` : 'None'}
                href="/platform/notifications"
                tone={unreadAlerts || warnings ? 'warn' : 'ok'}
              />
              <Row
                icon={<Bot className="w-4 h-4 text-orange-400" />}
                label="Machina AI"
                value={mode === 'off' ? 'Disabled' : mode === 'autopilot' ? 'Autopilot' : mode === 'autopilot_preview' ? 'Autopilot preview' : 'Advisor mode'}
                tone={mode === 'off' ? undefined : 'ok'}
              />
              <button type="button" className="w-full btn-secondary text-xs flex items-center justify-center gap-1" onClick={() => { openCopilot(); setOpen(false) }}>
                <Bot className="w-3 h-3" /> Open Copilot
              </button>
              <Link to="/mission-control" className="block text-center text-xs text-blue-400 py-1" onClick={() => setOpen(false)}>Mission Control (F3)</Link>
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-500">
                {running} VMs running · {hosts.filter((h) => h.state === 'online').length}/{hosts.length} hosts online
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
              <Link to="/platform/support" className="btn-secondary text-xs flex items-center justify-center gap-1" onClick={() => setOpen(false)}>
                <HelpCircle className="w-3 h-3" /> Help
              </Link>
              <Link to="/platform/tasks" className="btn-secondary text-xs flex-1 text-center" onClick={() => setOpen(false)}>Tasks</Link>
              <Link to="/platform/recommendations" className="btn-primary text-xs flex-1 text-center" onClick={() => setOpen(false)}>Recommendations</Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  href?: string
  tone?: 'ok' | 'warn'
}) {
  const content = (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-xs">{label}</p>
        <p className={`font-medium truncate ${tone === 'warn' ? 'text-amber-300' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-200'}`}>{value}</p>
      </div>
    </div>
  )
  if (href) {
    return (
      <Link to={href} className="block p-2 -mx-2 rounded-lg hover:bg-slate-800/60 transition">
        {content}
      </Link>
    )
  }
  return <div className="p-2 -mx-2">{content}</div>
}
