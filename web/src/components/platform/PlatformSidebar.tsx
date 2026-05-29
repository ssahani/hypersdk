// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { LayoutGrid } from 'lucide-react'
import { PLATFORM_SIDEBAR } from '../../utils/platformNav'

const DOCK_KEY = 'machina-platform-dock'

export default function PlatformSidebar() {
  const [dock, setDock] = useState(() => localStorage.getItem(DOCK_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(DOCK_KEY, dock ? '1' : '0')
  }, [dock])

  return (
    <>
      <aside className={`platform-sidebar hidden lg:flex flex-col shrink-0 border-r border-white/[0.06] bg-slate-950/50 backdrop-blur-xl ${dock ? 'w-16' : 'w-56'}`}>
        <div className={`px-3 py-4 border-b border-slate-800/80 flex ${dock ? 'justify-center' : 'justify-between'} items-center gap-2`}>
          {!dock && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Control Center</p>
              <p className="text-sm font-medium text-slate-200 mt-0.5">Zyvor Platform</p>
            </div>
          )}
          <button
            type="button"
            title={dock ? 'Expand sidebar' : 'Dock mode'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            onClick={() => setDock((d) => !d)}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
        <SidebarNav dock={dock} />
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
          {PLATFORM_SIDEBAR.flatMap((s) => s.items).map((item) => (
            <option key={item.to} value={item.to}>{item.label}</option>
          ))}
        </select>
      </div>
    </>
  )
}

function SidebarNav({ dock }: { dock: boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
      {PLATFORM_SIDEBAR.map((section) => (
        <div key={section.label}>
          {!dock && <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{section.label}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/platform'}
                  title={dock ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      dock ? 'justify-center' : ''
                    } ${
                      isActive
                        ? 'bg-blue-500/15 text-blue-100 font-medium border border-blue-500/20 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`
                  }
                >
                  <span className="text-slate-400">{item.icon}</span>
                  {!dock && item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
