// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bell, Server, Sparkles, Users } from 'lucide-react'
import { useFleetDesktop } from '../../hooks/useFleetDesktop'
import { useActiveWorkspace } from '../../hooks/useActiveWorkspace'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'
import {
  showPlatformMenuBarForTier,
  showPlatformMenuBarFullForTier,
} from '../../utils/platformDesktopTier'
import { operationsHubHref } from '../../utils/platformHubLinks'

/** Live fleet status strip — links only to aggregate views, not duplicate sidebar apps. */
export default function PlatformMenuBar() {
  const navigate = useNavigate()
  const [tier] = usePlatformDesktopTier()
  const { desktop } = useFleetDesktop(true, 90_000)
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
      <Link to="/platform/hosts" className="inline-flex items-center gap-1 hover:text-blue-200 transition" title="Hosts">
        <Server className="w-3 h-3" />
        {desktop.hosts_online}/{desktop.hosts_total} hosts
      </Link>
      <span className="text-slate-600">·</span>
      <Link to={operationsHubHref(tier)} className="hover:text-slate-100 transition" title="Operations">
        {desktop.active_tasks} tasks
      </Link>
      <span className="text-slate-600">·</span>
      <Link to="/platform/zeus" className="inline-flex items-center gap-1 hover:text-orange-200 transition" title="Machina Zeus OS">
        <Sparkles className="w-3 h-3 text-orange-400" />
        {desktop.zeus_status}
      </Link>
      {desktop.unread_notifications > 0 && (
        <>
          <span className="text-slate-600">·</span>
          <Link to={operationsHubHref(tier)} className="inline-flex items-center gap-1 text-amber-300" title="Alerts">
            <Bell className="w-3 h-3" />
            {desktop.unread_notifications} alert{desktop.unread_notifications === 1 ? '' : 's'}
          </Link>
        </>
      )}
    </div>
  )
}
