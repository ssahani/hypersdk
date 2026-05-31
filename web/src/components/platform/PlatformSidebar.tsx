// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { sidebarForTier } from '../../utils/platformNavFilter'
import { integrationNavItems } from '../../utils/platformIntegrationsNav'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'
import type { PlatformNavSection } from '../../utils/platformNav'

const COLLAPSE_KEY = 'machina-platform-sidebar-collapsed'
const SECTION_COLLAPSE_PREFIX = 'machina-sidebar-section-'

function sectionCollapseKey(label: string) {
  return `${SECTION_COLLAPSE_PREFIX}${label}`
}

function loadSectionCollapsed(section: PlatformNavSection): boolean {
  if (!section.collapsible) return false
  try {
    const raw = localStorage.getItem(sectionCollapseKey(section.label))
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return section.defaultCollapsed ?? false
}

export default function PlatformSidebar() {
  const [tier] = usePlatformDesktopTier()
  const { info } = usePlatformInfo()
  const sections = sidebarForTier(tier, integrationNavItems(info))
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.label, loadSectionCollapsed(s)])),
  )

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const toggleSection = useCallback((label: string) => {
    setSectionCollapsed((prev) => {
      const next = !prev[label]
      try {
        localStorage.setItem(sectionCollapseKey(label), next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return { ...prev, [label]: next }
    })
  }, [])

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
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Desktop</p>
            <p className="text-xs text-white/70 mt-0.5">Machina Platform</p>
          </div>
        )}
        <SidebarNav
          collapsed={collapsed}
          sections={sections}
          sectionCollapsed={sectionCollapsed}
          onToggleSection={toggleSection}
        />
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

function SidebarNav({
  collapsed,
  sections,
  sectionCollapsed,
  onToggleSection,
}: {
  collapsed: boolean
  sections: ReturnType<typeof sidebarForTier>
  sectionCollapsed: Record<string, boolean>
  onToggleSection: (label: string) => void
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1 min-h-0">
      {sections.map((section, sectionIdx) => {
        const isFavoritesZone = sectionIdx === 0 && section.label === 'Favorites'
        const isSectionClosed = section.collapsible && sectionCollapsed[section.label]

        return (
          <div key={section.label} className="tahoe-sidebar-section">
            {!collapsed && !isFavoritesZone && (
              section.collapsible ? (
                <button
                  type="button"
                  onClick={() => onToggleSection(section.label)}
                  className="tahoe-sidebar-section-header flex w-full items-center gap-1.5 px-2 py-1.5 mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/35 hover:text-white/55 transition"
                >
                  <ChevronDown
                    className={`h-3 w-3 shrink-0 transition-transform ${isSectionClosed ? '-rotate-90' : ''}`}
                  />
                  <span className="truncate">{section.label}</span>
                </button>
              ) : (
                <p className="tahoe-sidebar-section-header px-2 py-1.5 mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  {section.label}
                </p>
              )
            )}
            {!isSectionClosed && (
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/platform'}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `tahoe-sidebar-link flex items-center gap-2.5 px-2.5 py-1.5 text-sm transition-all duration-200 ${
                          collapsed ? 'justify-center rounded-xl' : 'rounded-full'
                        } ${
                          isActive
                            ? 'tahoe-sidebar-link-active text-white'
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
            )}
            {!collapsed && sectionIdx < sections.length - 1 && (
              <div className="tahoe-sidebar-divider mx-2 my-2" aria-hidden />
            )}
          </div>
        )
      })}
    </nav>
  )
}
