// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useState } from 'react'
import { NavLink } from 'react-router'
import { ChevronDown, ChevronLeft, ChevronRight, Boxes, FolderOpen, Plug } from 'lucide-react'
import { sidebarForTier } from '../../utils/platformNavFilter'
import { integrationNavItems } from '../../utils/platformIntegrationsNav'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'
import { usePlatformMacDesktop } from './mac/PlatformMacDesktopContext'
import type { PlatformNavSection } from '../../utils/platformNav'

const SECTION_COLLAPSE_PREFIX = 'machina-sidebar-section-'

const SECTION_ICONS: Record<string, typeof Plug> = {
  Fleet: Plug,
  Platform: FolderOpen,
  'Connected platforms': Boxes,
}

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
  const { sidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed } = usePlatformMacDesktop()
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.label, loadSectionCollapsed(s)])),
  )

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
        className={`mac-finder-sidebar tahoe-sidebar tahoe-sidebar-expanded platform-sidebar glass glass-elevated hidden lg:flex flex-col shrink-0 border-r border-white/[0.06] ${
          collapsed ? 'w-[60px]' : 'w-[280px]'
        }`}
        aria-label="Platform Finder"
      >
        {!collapsed && (
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Desktop</p>
            <p className="text-sm text-white/75 mt-1">Machina Platform</p>
          </div>
        )}
        <SidebarNav
          collapsed={collapsed}
          sections={sections}
          sectionCollapsed={sectionCollapsed}
          onToggleSection={toggleSection}
        />
        <div className="border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs text-white/50 hover:bg-white/5 hover:text-white/90 transition"
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
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-2 min-h-0">
      {sections.map((section, sectionIdx) => {
        const isFavoritesZone = sectionIdx === 0 && section.label === 'Favorites'
        const isSectionClosed = section.collapsible && sectionCollapsed[section.label]
        const SectionIcon = SECTION_ICONS[section.label]

        return (
          <div key={section.label} className="tahoe-sidebar-section">
            {!collapsed && !isFavoritesZone && (
              section.collapsible ? (
                <button
                  type="button"
                  onClick={() => onToggleSection(section.label)}
                  className="tahoe-sidebar-section-header flex w-full items-center gap-1.5 px-3 py-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35 hover:text-white/55 transition"
                >
                  <ChevronDown
                    className={`h-3 w-3 shrink-0 transition-transform ${isSectionClosed ? '-rotate-90' : ''}`}
                  />
                  {SectionIcon ? <SectionIcon className="h-3 w-3 shrink-0 opacity-60" /> : null}
                  <span className="truncate">{section.label}</span>
                </button>
              ) : (
                <p className="tahoe-sidebar-section-header flex items-center gap-1.5 px-3 py-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  {SectionIcon ? <SectionIcon className="h-3 w-3 shrink-0 opacity-60" /> : null}
                  <span>{section.label}</span>
                </p>
              )
            )}
            {!isSectionClosed && (
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/platform'}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `tahoe-sidebar-link flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 ${
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
              <div className="tahoe-sidebar-divider mx-3 my-3" aria-hidden />
            )}
          </div>
        )
      })}
    </nav>
  )
}
