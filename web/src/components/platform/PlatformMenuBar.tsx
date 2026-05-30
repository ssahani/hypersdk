// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Activity, Archive, Bell, LayoutGrid, Server, Sparkles, Users, Workflow } from 'lucide-react'
import { useFleetDesktop } from '../../hooks/useFleetDesktop'
import { useActiveWorkspace } from '../../hooks/useActiveWorkspace'
import {
  showPlatformMenuBarForTier,
  showPlatformMenuBarFullForTier,
  usePlatformDesktopTier,
} from '../../utils/platformDesktopTier'

export default function PlatformMenuBar() {
  const navigate = useNavigate()
  const [tier] = usePlatformDesktopTier()
  const { desktop, linuxHealth } = useFleetDesktop(true, 90_000)
  const { workspace, setWorkspace, workspaces, label } = useActiveWorkspace()
  const [open, setOpen] = useState(false)

  const pickWorkspace = useCallback((name: string) => {
    setWorkspace(name)
    setOpen(false)
    if (name) navigate(`/platform/vms?project=${encodeURIComponent(name)}`)
    else navigate('/platform/vms')
  }, [navigate, setWorkspace])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  if (!desktop || !showPlatformMenuBarForTier(tier)) return null

  const full = showPlatformMenuBarFullForTier(tier)
  const sloTone = desktop.slo_breach_count > 0 ? 'text-rose-300 border-rose-500/40 bg-rose-500/10' : 'text-slate-400 border-white/[0.06] bg-slate-950/40'
  const pressure = linuxHealth?.pressure_hosts ?? desktop.pressure_hosts
  const pressureTone = pressure > 0 ? 'text-amber-300 border-amber-500/40 bg-amber-500/10' : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'

  return (
    <div className="hidden lg:flex items-center gap-2 px-2 py-1 mb-2 rounded-full border border-white/[0.08] bg-black/20 text-xs text-white/75 backdrop-blur-md">
      {full && (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:text-violet-100 transition"
            title="Switch workspace (tenant)"
          >
            <Users className="w-3 h-3" />
            {label}
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1 z-50 min-w-[12rem] rounded-xl border border-white/[0.08] bg-slate-900/95 shadow-xl py-1">
              <button type="button" className={`block w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] ${!workspace ? 'text-violet-200' : 'text-slate-300'}`} onClick={() => pickWorkspace('')}>
                All workspaces
              </button>
              {workspaces.map((w) => (
                <button key={w.name} type="button" className={`block w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] ${workspace === w.name ? 'text-violet-200' : 'text-slate-300'}`} onClick={() => pickWorkspace(w.name)}>
                  {w.name} <span className="text-slate-500">({w.vm_count})</span>
                </button>
              ))}
              <Link to="/platform/users?tab=workspaces" className="block px-3 py-2 text-xs text-blue-400 border-t border-white/[0.06] mt-1 hover:bg-white/[0.04]" onClick={() => setOpen(false)}>
                Users & Groups →
              </Link>
            </div>
          )}
        </div>
      )}
      {full && <span className="text-slate-600">·</span>}
      <Link to="/platform/hosts" className="inline-flex items-center gap-1 hover:text-blue-200 transition">
        <Server className="w-3 h-3" />
        {desktop.hosts_online}/{desktop.hosts_total} hosts
      </Link>
      <span className="text-slate-600">·</span>
      <Link to="/platform/tasks" className="hover:text-slate-100 transition">
        {desktop.active_tasks} tasks
      </Link>
      {full && (
        <>
          <Link to="/platform/activity" className="inline-flex items-center gap-1 hover:text-blue-200 transition">
            <Activity className="w-3 h-3" />
            Activity
          </Link>
          <Link to="/platform/backups" className="inline-flex items-center gap-1 hover:text-violet-200 transition">
            <Archive className="w-3 h-3" />
            Time Machine
          </Link>
          <Link to="/platform/blueprints" className="inline-flex items-center gap-1 hover:text-emerald-200 transition">
            <Workflow className="w-3 h-3" />
            Shortcuts
          </Link>
          <Link to="/platform/projects" className="inline-flex items-center gap-1 hover:text-violet-200 transition">
            <LayoutGrid className="w-3 h-3" />
            Spaces
          </Link>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${sloTone}`}>
            {desktop.slo_breach_count > 0 ? `${desktop.slo_breach_count} SLO breach` : `${desktop.slo_count} SLO OK`}
          </span>
          <Link to="/platform/hosts" className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${pressureTone}`} title={desktop.linux_summary}>
            <Activity className="w-3 h-3" />
            {pressure > 0 ? `${pressure} under pressure` : 'Linux OK'}
          </Link>
        </>
      )}
      <Link to="/platform/zeus" className="inline-flex items-center gap-1 hover:text-orange-200 transition">
        <Sparkles className="w-3 h-3 text-orange-400" />
        {desktop.zeus_status}
      </Link>
      {desktop.unread_notifications > 0 && (
        <Link to="/platform/notifications" className="inline-flex items-center gap-1 text-amber-300">
          <Bell className="w-3 h-3" />
          {desktop.unread_notifications}
        </Link>
      )}
      {full && (
        <Link to="/platform/projects" className="ml-auto inline-flex items-center gap-1 text-blue-300 hover:text-blue-200">
          <LayoutGrid className="w-3 h-3" /> Stage Manager
        </Link>
      )}
    </div>
  )
}
