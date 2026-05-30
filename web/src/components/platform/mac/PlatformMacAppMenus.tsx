// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useAi } from '../../../contexts/AiContext'
import ConnectionStatus from '../../ConnectionStatus'
import PlatformMacMenuDropdown, { PlatformMacMenuItem } from './PlatformMacMenuDropdown'
import { usePlatformMacDesktop } from './PlatformMacDesktopContext'
import { openCenterPopout } from '../../../utils/platformCenterPopout'

function openSpotlight() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
}

export default function PlatformMacAppMenus() {
  const navigate = useNavigate()
  const location = useLocation()
  const { username, logout } = useAuth()
  const { openCopilot } = useAi()
  const { toggleSidebar, toggleInspector, sidebarVisible, inspectorVisible } = usePlatformMacDesktop()
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const closeMenu = useCallback(() => setOpenMenu(null), [])
  const toggleMenu = (id: string) => setOpenMenu((prev) => (prev === id ? null : id))

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
    <div className="flex items-center gap-1 shrink-0">
      <PlatformMacMenuDropdown label="Machina" open={openMenu === 'machina'} onToggle={() => toggleMenu('machina')} onClose={closeMenu}>
        <PlatformMacMenuItem label="About Machina Platform" onClick={() => { navigate('/platform/settings?section=about'); closeMenu() }} />
        <PlatformMacMenuItem label="Settings…" shortcut="⌘," onClick={() => { navigate('/platform/settings'); closeMenu() }} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label="Sign Out" onClick={() => { void logout(); closeMenu() }} />
      </PlatformMacMenuDropdown>

      <PlatformMacMenuDropdown label="View" open={openMenu === 'view'} onToggle={() => toggleMenu('view')} onClose={closeMenu}>
        <PlatformMacMenuItem label="Show Sidebar" shortcut="⌘⌥S" checked={sidebarVisible} onClick={() => { toggleSidebar(); closeMenu() }} />
        <PlatformMacMenuItem label="Show Inspector" shortcut="⌘⌥I" checked={inspectorVisible} onClick={() => { toggleInspector(); closeMenu() }} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label="Mission Control" onClick={() => { navigate('/mission-control'); closeMenu() }} />
        <PlatformMacMenuItem label="Activity Monitor" onClick={() => { navigate('/platform/activity'); closeMenu() }} />
      </PlatformMacMenuDropdown>

      <PlatformMacMenuDropdown label="Window" open={openMenu === 'window'} onToggle={() => toggleMenu('window')} onClose={closeMenu}>
        <PlatformMacMenuItem label="Spotlight…" shortcut="⌘K" onClick={() => { openSpotlight(); closeMenu() }} />
        <PlatformMacMenuItem label="Ask Zeus…" shortcut="⌘⇧A" onClick={() => { openCopilot(); closeMenu() }} />
        <PlatformMacMenuItem label="Move to New Window" shortcut="⌘⌥N" onClick={() => { openCenterPopout(`${location.pathname}${location.search}`); closeMenu() }} />
        <div className="my-1 border-t border-white/[0.08]" />
        <PlatformMacMenuItem label="Minimize" disabled onClick={closeMenu} />
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
