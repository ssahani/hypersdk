// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useAi } from '../../../contexts/AiContext'
import ConnectionStatus from '../../ConnectionStatus'
import PlatformMacMenuDropdown, { PlatformMacMenuItem } from './PlatformMacMenuDropdown'
import { usePlatformMacDesktop } from './PlatformMacDesktopContext'
import { openCenterPopout } from '../../../utils/platformCenterPopout'
import { openPlatformDockEditor } from '../../../utils/platformDockPins'
import { usePlatformDesktopTier } from '../../../hooks/usePlatformDesktopTier'
import {
  PLATFORM_DESKTOP_TIER_LABELS,
  type PlatformDesktopTier,
} from '../../../utils/platformDesktopTier'
import { dispatchOpenMissionControl } from './MissionControlContext'
import { macMenuSectionsForTier } from '../../../utils/platformMacMenus'
import { integrationNavItems } from '../../../utils/platformIntegrationsNav'
import { usePlatformInfo } from '../../../contexts/PlatformInfoContext'

function openSpotlight() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
}

export default function PlatformMacAppMenus() {
  const navigate = useNavigate()
  const location = useLocation()
  const { username, logout } = useAuth()
  const { openCopilot } = useAi()
  const { toggleSidebar, toggleInspector, sidebarVisible, inspectorVisible } = usePlatformMacDesktop()
  const [tier, setTier] = usePlatformDesktopTier()
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const { info } = usePlatformInfo()
  const navSections = useMemo(() => macMenuSectionsForTier(tier, integrationNavItems(info)), [tier, info])

  const closeMenu = useCallback(() => setOpenMenu(null), [])
  const toggleMenu = (id: string) => setOpenMenu((prev) => (prev === id ? null : id))
  const go = useCallback((path: string) => {
    navigate(path)
    closeMenu()
  }, [navigate, closeMenu])

  const pickTier = (next: PlatformDesktopTier) => {
    setTier(next)
    closeMenu()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === ',') {
        e.preventDefault()
        navigate('/platform/settings')
      }
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        toggleSidebar()
      }
      if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        toggleInspector()
      }
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openCenterPopout(`${location.pathname}${location.search}`)
      }
      if (e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        openCopilot()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, toggleSidebar, toggleInspector, openCopilot, location.pathname, location.search])

  return (
    <div className="flex items-center gap-1 shrink-0 min-w-0 overflow-visible">
      <PlatformMacMenuDropdown label="Machina" open={openMenu === 'machina'} onToggle={() => toggleMenu('machina')} onClose={closeMenu}>
        <PlatformMacMenuItem label="About Machina Platform" onClick={() => go('/platform/settings?section=about')} />
        <PlatformMacMenuItem label="Settings…" shortcut="⌘," onClick={() => go('/platform/settings')} />
        <PlatformMacMenuItem label="Customize Dock…" onClick={() => { openPlatformDockEditor(); closeMenu() }} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label="Add Host…" onClick={() => go('/platform/enroll')} />
        <PlatformMacMenuItem label="Platform Support" onClick={() => go('/platform/support')} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label="Sign Out" onClick={() => { void logout(); closeMenu() }} />
      </PlatformMacMenuDropdown>

      <PlatformMacMenuDropdown label="Go" open={openMenu === 'go'} onToggle={() => toggleMenu('go')} onClose={closeMenu}>
        {navSections.map((section, idx) => (
          <div key={section.label}>
            {idx > 0 && <div className="my-1 border-t border-white/[0.08]" />}
            <PlatformMacMenuItem label={section.label} header />
            {section.items.map((item) => (
              <PlatformMacMenuItem
                key={item.to}
                label={item.label}
                checked={location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)}
                onClick={() => go(item.to)}
              />
            ))}
          </div>
        ))}
      </PlatformMacMenuDropdown>

      <PlatformMacMenuDropdown label="View" open={openMenu === 'view'} onToggle={() => toggleMenu('view')} onClose={closeMenu}>
        <PlatformMacMenuItem label="Show Sidebar" shortcut="⌘⌥S" checked={sidebarVisible} onClick={() => { toggleSidebar(); closeMenu() }} />
        <PlatformMacMenuItem label="Show Inspector" shortcut="⌘⌥I" checked={inspectorVisible} onClick={() => { toggleInspector(); closeMenu() }} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label={PLATFORM_DESKTOP_TIER_LABELS.normal} checked={tier === 'normal'} onClick={() => pickTier('normal')} />
        <PlatformMacMenuItem label={PLATFORM_DESKTOP_TIER_LABELS.power} checked={tier === 'power'} onClick={() => pickTier('power')} />
        <PlatformMacMenuItem label={PLATFORM_DESKTOP_TIER_LABELS.advanced} checked={tier === 'advanced'} onClick={() => pickTier('advanced')} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label="Mission Control" shortcut="F3" onClick={() => { dispatchOpenMissionControl(); closeMenu() }} />
        <PlatformMacMenuItem label="Stage Manager" onClick={() => go('/platform/projects')} />
        <PlatformMacMenuItem label="Activity Monitor" onClick={() => go('/platform/activity')} />
        <PlatformMacMenuItem label="Finder" onClick={() => go('/platform/vms')} />
        <PlatformMacMenuItem label="Disk Utility" onClick={() => go('/platform/storage')} />
        <PlatformMacMenuItem label="Console" onClick={() => go('/platform/events')} />
        <PlatformMacMenuItem label="Software Update" onClick={() => go('/platform/maintenance')} />
        <PlatformMacMenuItem label="Zeus OS" onClick={() => go('/platform/zeus')} />
        <PlatformMacMenuItem label="Zeus Firewall" onClick={() => go('/platform/zeus/security/firewall')} />
      </PlatformMacMenuDropdown>

      <PlatformMacMenuDropdown label="Window" open={openMenu === 'window'} onToggle={() => toggleMenu('window')} onClose={closeMenu}>
        <PlatformMacMenuItem label="Spotlight…" shortcut="⌘K" onClick={() => { openSpotlight(); closeMenu() }} />
        <PlatformMacMenuItem label="Ask Machina…" shortcut="⌘⇧A" onClick={() => { openCopilot(); closeMenu() }} />
        <PlatformMacMenuItem label="Move to New Window" shortcut="⌘⌥N" onClick={() => { openCenterPopout(`${location.pathname}${location.search}`); closeMenu() }} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label="Dashboard" onClick={() => go('/platform')} />
        <PlatformMacMenuItem label="Hosts" onClick={() => go('/platform/hosts')} />
        <PlatformMacMenuItem label="Virtual Machines" onClick={() => go('/platform/vms')} />
        <PlatformMacMenuItem label="Notifications" onClick={() => go('/platform/notifications')} />
        <PlatformMacMenuItem label="Tasks" onClick={() => go('/platform/tasks')} />
      </PlatformMacMenuDropdown>

      <PlatformMacMenuDropdown label="Help" open={openMenu === 'help'} onToggle={() => toggleMenu('help')} onClose={closeMenu}>
        <PlatformMacMenuItem label="Ask Machina…" shortcut="⌘⇧A" onClick={() => { openCopilot(); closeMenu() }} />
        <PlatformMacMenuItem label="Spotlight Search" shortcut="⌘K" onClick={() => { openSpotlight(); closeMenu() }} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label="Platform Support" onClick={() => go('/platform/support')} />
        <PlatformMacMenuItem label="Developer / SDK" onClick={() => go('/platform/developer')} />
        <PlatformMacMenuItem label="OpenAPI Reference" onClick={() => { window.open('/api/v1/openapi.json', '_blank'); closeMenu() }} />
      </PlatformMacMenuDropdown>

      <div className="hidden xl:flex items-center gap-2 ml-2 pl-2 border-l border-white/[0.08] text-xs text-white/50">
        <ConnectionStatus />
        <span className="inline-flex items-center gap-1">
          <User className="w-3 h-3" />
          {username || 'user'}
        </span>
        <button type="button" className="mac-menubar-icon-btn" title="Sign out" onClick={() => void logout()}>
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
