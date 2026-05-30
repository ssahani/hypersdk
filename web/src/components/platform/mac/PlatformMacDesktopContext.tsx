// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  defaultSidebarVisibleForTier,
  loadPlatformDesktopTier,
  PLATFORM_DESKTOP_TIER_EVENT,
} from '../../../utils/platformDesktopTier'

type PlatformMacDesktopContextValue = {
  sidebarVisible: boolean
  sidebarCollapsed: boolean
  inspectorVisible: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleInspector: () => void
  setInspectorVisible: (v: boolean) => void
}

const PlatformMacDesktopContext = createContext<PlatformMacDesktopContextValue | null>(null)

export function PlatformMacDesktopProvider({ children }: { children: ReactNode }) {
  const [sidebarVisible, setSidebarVisible] = useState(() => defaultSidebarVisibleForTier(loadPlatformDesktopTier()))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('machina-platform-sidebar-collapsed') === '1')
  const [inspectorVisible, setInspectorVisible] = useState(true)

  useEffect(() => {
    const onTier = () => {
      const tier = loadPlatformDesktopTier()
      setSidebarVisible(defaultSidebarVisibleForTier(tier))
    }
    window.addEventListener(PLATFORM_DESKTOP_TIER_EVENT, onTier)
    return () => window.removeEventListener(PLATFORM_DESKTOP_TIER_EVENT, onTier)
  }, [])

  const toggleSidebar = useCallback(() => setSidebarVisible((v) => !v), [])
  const toggleInspector = useCallback(() => setInspectorVisible((v) => !v), [])

  const setCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsed(v)
    localStorage.setItem('machina-platform-sidebar-collapsed', v ? '1' : '0')
  }, [])

  const value = useMemo(
    () => ({
      sidebarVisible,
      sidebarCollapsed,
      inspectorVisible,
      toggleSidebar,
      setSidebarCollapsed: setCollapsed,
      toggleInspector,
      setInspectorVisible,
    }),
    [sidebarVisible, sidebarCollapsed, inspectorVisible, toggleSidebar, setCollapsed, toggleInspector],
  )

  return <PlatformMacDesktopContext.Provider value={value}>{children}</PlatformMacDesktopContext.Provider>
}

export function usePlatformMacDesktop() {
  const ctx = useContext(PlatformMacDesktopContext)
  if (!ctx) throw new Error('usePlatformMacDesktop must be used within PlatformMacDesktopProvider')
  return ctx
}
