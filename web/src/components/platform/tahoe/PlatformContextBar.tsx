// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link, NavLink, useLocation } from 'react-router'
import { Bell, Server, Sparkles } from 'lucide-react'
import { useFleetDesktop } from '../../../hooks/useFleetDesktop'
import { usePlatformDesktopTier } from '../../../hooks/usePlatformDesktopTier'
import { contextNavForPath, isContextNavActive } from '../../../utils/platformContextNav'
import { showPlatformMenuBarForTier } from '../../../utils/platformDesktopTier'

export default function PlatformContextBar() {
  const location = useLocation()
  const [tier] = usePlatformDesktopTier()
  const { desktop } = useFleetDesktop(true, 90_000)
  const ctx = contextNavForPath(location.pathname, tier)
  const AppIcon = ctx?.appIcon

  if (!ctx) return null

  return (
    <div className="tahoe-context-bar shrink-0" role="navigation" aria-label="Context navigation">
      <div className="tahoe-context-bar-inner flex items-center gap-3 min-w-0">
        <div className="tahoe-context-app flex items-center gap-2.5 shrink-0 min-w-0">
          {AppIcon ? (
            <span className="tahoe-context-app-icon">
              <AppIcon className="h-4 w-4" strokeWidth={1.75} />
            </span>
          ) : null}
          {ctx.hubPath ? (
            <Link to={ctx.hubPath} className="tahoe-context-app-title truncate">
              {ctx.appLabel}
            </Link>
          ) : (
            <span className="tahoe-context-app-title truncate">{ctx.appLabel}</span>
          )}
        </div>

        {ctx.items.length > 1 ? (
          <nav className="tahoe-context-pills flex-1 min-w-0 overflow-x-auto" aria-label={`${ctx.appLabel} sections`}>
            <div className="flex items-center gap-1.5 min-w-max pr-2">
              {ctx.items.map((item) => {
                const hasQuery = item.to.includes('?')
                if (hasQuery) {
                  const active = isContextNavActive(location.pathname, location.search, item)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`tahoe-context-pill ${active ? 'tahoe-context-pill-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  )
                }
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/platform/zeus/security' || item.to === '/platform/resources' || item.to === '/platform/operations' || item.to === '/platform/integrations' || item.to === '/platform/zeus'}
                    className={({ isActive }) => `tahoe-context-pill ${isActive ? 'tahoe-context-pill-active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </nav>
        ) : (
          <div className="flex-1 min-w-0" />
        )}

        {desktop && showPlatformMenuBarForTier(tier) ? (
          <div className="tahoe-context-status hidden md:flex items-center gap-2 shrink-0 text-[11px] text-white/55">
            <Link to="/platform/hosts" className="tahoe-context-status-chip" title="Hosts">
              <Server className="w-3 h-3" />
              {desktop.hosts_online}/{desktop.hosts_total}
            </Link>
            <Link to="/platform/operations" className="tahoe-context-status-chip" title="Tasks">
              {desktop.active_tasks} tasks
            </Link>
            <Link to="/platform/zeus" className="tahoe-context-status-chip text-orange-200/80" title="Zeus">
              <Sparkles className="w-3 h-3 text-orange-400" />
              {desktop.zeus_status}
            </Link>
            {desktop.unread_notifications > 0 ? (
              <Link to="/platform/operations" className="tahoe-context-status-chip text-amber-200/90" title="Alerts">
                <Bell className="w-3 h-3" />
                {desktop.unread_notifications}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
