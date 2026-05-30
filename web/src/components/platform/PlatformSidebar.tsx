// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { sidebarForTier } from '../../utils/platformNavFilter'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'

const COLLAPSE_KEY = 'machina-platform-sidebar-collapsed'

export default function PlatformSidebar() {
  const [tier] = usePlatformDesktopTier()
  const sections = sidebarForTier(tier)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return (
    <>
      <aside
        className={`mac-finder-sidebar tahoe-sidebar platform-sidebar glass glass-elevated hidden lg:flex flex-col shrink-0 border-r border-white/[0.06] ${
          collapsed ? 'w-[60px]' : 'w-[240px]'
        }`}
        aria-label="Platform Finder"
      >
        {!collapsed && (
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Favorites</p>
            <p className="text-xs text-white/70 mt-0.5">Fleet desktop</p>
          </div>
        )}
        <SidebarNav collapsed={collapsed} sections={sections} />
        <div className="border-t border-white/[0.06] p-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white/90 transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
      <div className="lg:hidden mb-4">
        <label className="text-xs text-slate-500 block mb-1">Navigate</label>
        <select
          className="input w-full text-sm"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) window.location.href = e.target.value
          }}
        >
          <option value="" disabled>Jump to…</option>
          {sections.flatMap((s) => s.items).map((item) => (
            <option key={item.to} value={item.to}>{item.label}</option>
          ))}
        </select>
      </div>
    </>
  )
}

function SidebarNav({ collapsed, sections }: { collapsed: boolean; sections: ReturnType<typeof sidebarForTier> }) {
  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3 min-h-0">
      {sections.map((section) => (
        <div key={section.label}>
          {!collapsed && (
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {section.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/platform'}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `tahoe-sidebar-link flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200 ${
                      collapsed ? 'justify-center' : ''
                    } ${
                      isActive
                        ? 'tahoe-sidebar-link-active text-white bg-white/[0.08]'
                        : 'text-white/55 hover:text-white/90 hover:bg-white/[0.04]'
                    }`
                  }
                >
                  <span className="shrink-0 opacity-80">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
