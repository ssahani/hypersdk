// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { Activity, Bell, LayoutGrid, Server, Sparkles } from 'lucide-react'
import { useFleetDesktop } from '../../hooks/useFleetDesktop'

export default function PlatformMenuBar() {
  const { desktop, linuxHealth } = useFleetDesktop(true, 90_000)

  if (!desktop) return null

  const sloTone = desktop.slo_breach_count > 0 ? 'text-rose-300 border-rose-500/40 bg-rose-500/10' : 'text-slate-400 border-white/[0.06] bg-slate-950/40'
  const pressure = linuxHealth?.pressure_hosts ?? desktop.pressure_hosts
  const pressureTone = pressure > 0 ? 'text-amber-300 border-amber-500/40 bg-amber-500/10' : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'

  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.06] bg-slate-900/60 text-xs text-slate-300 mb-2">
      <Link to="/platform/zeus" className="inline-flex items-center gap-1 hover:text-orange-200 transition">
        <Sparkles className="w-3 h-3 text-orange-400" />
        {desktop.zeus_status}
      </Link>
      <span className="text-slate-600">·</span>
      <Link to="/platform/hosts" className="inline-flex items-center gap-1 hover:text-blue-200 transition">
        <Server className="w-3 h-3" />
        {desktop.hosts_online}/{desktop.hosts_total} hosts
      </Link>
      <span className="text-slate-600">·</span>
      <Link to="/platform/tasks" className="hover:text-slate-100 transition">
        {desktop.active_tasks} tasks
      </Link>
      <Link to="/platform/activity" className="inline-flex items-center gap-1 hover:text-blue-200 transition">
        <Activity className="w-3 h-3" />
        Activity
      </Link>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${sloTone}`}>
        {desktop.slo_breach_count > 0 ? `${desktop.slo_breach_count} SLO breach` : `${desktop.slo_count} SLO OK`}
      </span>
      <Link
        to="/platform/hosts"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${pressureTone}`}
        title={desktop.linux_summary}
      >
        <Activity className="w-3 h-3" />
        {pressure > 0 ? `${pressure} under pressure` : 'Linux OK'}
      </Link>
      {desktop.unread_notifications > 0 && (
        <Link to="/platform/notifications" className="inline-flex items-center gap-1 text-amber-300">
          <Bell className="w-3 h-3" />
          {desktop.unread_notifications}
        </Link>
      )}
      <Link to="/mission-control" className="ml-auto inline-flex items-center gap-1 text-blue-300 hover:text-blue-200">
        <LayoutGrid className="w-3 h-3" /> Mission Control
      </Link>
    </div>
  )
}
