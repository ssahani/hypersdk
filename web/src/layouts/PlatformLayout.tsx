// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import PlatformSidebar from '../components/platform/PlatformSidebar'
import PlatformControlCenter from '../components/platform/PlatformControlCenter'
import PlatformContextBar from '../components/platform/tahoe/PlatformContextBar'
import PlatformMobileJumpNav from '../components/platform/tahoe/PlatformMobileJumpNav'
import PlatformMacDock from '../components/platform/PlatformMacDock'
import { PlatformMacDesktopProvider, usePlatformMacDesktop } from '../components/platform/mac/PlatformMacDesktopContext'
import PlatformMacAppMenus from '../components/platform/mac/PlatformMacAppMenus'
import PopoutTitleBar from '../components/platform/mac/PopoutTitleBar'
import PlatformDynamicIsland from '../components/platform/mac/PlatformDynamicIsland'
import MissionControlOverlay from '../components/platform/MissionControlOverlay'
import {
  MissionControlProvider,
  OPEN_MISSION_CONTROL_EVENT,
  useMissionControl,
} from '../components/platform/mac/MissionControlContext'
import {
  PLATFORM_WALLPAPER_EVENT,
  loadPlatformWallpaper,
  type PlatformWallpaper,
} from '../utils/platformWallpaper'
import { isCenterPopoutMode } from '../utils/platformCenterPopout'
import { platformPageLabel, upsertPlatformDesktopTab } from '../utils/platformDesktopTabs'
import { OPEN_PLATFORM_DOCK_EDITOR_EVENT } from '../utils/platformDockPins'
import { usePlatformDesktopTier } from '../hooks/usePlatformDesktopTier'
import PlatformDockEditor from '../components/platform/mac/PlatformDockEditor'
import { usePlatformTierRouteGuard } from '../hooks/usePlatformTierRouteGuard'
import { useKeyboardShortcut, isInputFocused } from '../hooks/useKeyboardShortcut'
import { suppressContextBar } from '../utils/platformNavRegistry'

function PlatformDesktopShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isPopout = isCenterPopoutMode(location.search)
  const [wallpaper, setWallpaper] = useState<PlatformWallpaper>(() => loadPlatformWallpaper())
  const [dockEditorOpen, setDockEditorOpen] = useState(false)
  const { sidebarVisible } = usePlatformMacDesktop()
  const [tier] = usePlatformDesktopTier()
  const { openMissionControl } = useMissionControl()
  usePlatformTierRouteGuard()

  const meshSubtle = location.pathname !== '/platform' && suppressContextBar(location.pathname)

  useEffect(() => {
    const onWallpaper = () => setWallpaper(loadPlatformWallpaper())
    window.addEventListener(PLATFORM_WALLPAPER_EVENT, onWallpaper)
    return () => window.removeEventListener(PLATFORM_WALLPAPER_EVENT, onWallpaper)
  }, [])

  useEffect(() => {
    const open = () => setDockEditorOpen(true)
    window.addEventListener(OPEN_PLATFORM_DOCK_EDITOR_EVENT, open)
    return () => window.removeEventListener(OPEN_PLATFORM_DOCK_EDITOR_EVENT, open)
  }, [])

  useEffect(() => {
    const open = () => openMissionControl()
    window.addEventListener(OPEN_MISSION_CONTROL_EVENT, open)
    return () => window.removeEventListener(OPEN_MISSION_CONTROL_EVENT, open)
  }, [openMissionControl])

  useEffect(() => {
    if (searchParams.get('mission') === '1') {
      openMissionControl()
      const next = new URLSearchParams(searchParams)
      next.delete('mission')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, openMissionControl])

  useEffect(() => {
    try {
      if (sessionStorage.getItem('machina-open-mission') === '1') {
        openMissionControl()
      }
    } catch { /* ignore */ }
  }, [openMissionControl])

  useKeyboardShortcut({
    key: 'F3',
    handler: (e) => {
      if (isInputFocused()) return
      e.preventDefault()
      openMissionControl()
    },
  })

  useKeyboardShortcut({
    key: 'ArrowUp',
    ctrl: true,
    handler: (e) => {
      if (isInputFocused()) return
      e.preventDefault()
      openMissionControl()
    },
  })

  useEffect(() => {
    if (!location.pathname.startsWith('/platform')) return
    upsertPlatformDesktopTab({ path: location.pathname, label: platformPageLabel(location.pathname) })
  }, [location.pathname])

  if (isPopout) {
    return (
      <div
        className="mac-desktop-root mac-popout-root platform-mac-desktop tahoe-page-root flex flex-col min-h-dvh"
        data-wallpaper={wallpaper}
      >
        <PopoutTitleBar title={platformPageLabel(location.pathname)} />
        <div className="tahoe-canvas relative flex-1">
          <div className="tahoe-mesh pointer-events-none" aria-hidden />
          <div className="relative z-[1] p-3 lg:p-4 platform-readable tahoe-readable-stack py-4 pb-8">
            <Outlet />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="mac-desktop-root platform-mac-desktop tahoe-page-root flex flex-col min-h-dvh w-full"
      data-wallpaper={wallpaper}
      data-desktop-tier={tier}
    >
      <header className="mac-menubar-inner glass shrink-0 sticky top-0 z-40 flex items-center gap-2 px-2 lg:px-3 h-11 overflow-visible">
        <div className="flex items-center min-w-0 shrink-0 overflow-visible z-[400]">
          <PlatformMacAppMenus />
        </div>
        <div className="flex-1 flex justify-center min-w-0 pointer-events-none">
          <PlatformDynamicIsland />
        </div>
        <div className="ml-auto shrink-0 flex items-center gap-2 z-[400]">
          <PlatformControlCenter />
        </div>
      </header>

      <PlatformContextBar />
      <PlatformMobileJumpNav />

      <div className="flex w-full flex-1 items-stretch">
        {sidebarVisible ? <PlatformSidebar /> : null}
        <div className="tahoe-canvas mac-desktop-main flex-1 min-w-0 relative">
          <div className={`tahoe-mesh pointer-events-none${meshSubtle ? ' tahoe-mesh-subtle' : ''}`} aria-hidden />
          <div className="relative z-[1] px-4 lg:px-6 pt-1 pb-16 lg:pb-24 max-w-[160rem] mx-auto w-full platform-mac-scroll-body">
            <div className="platform-readable tahoe-readable-stack py-3 pb-8">
              <Outlet />
            </div>
          </div>
        </div>
      </div>

      <PlatformMacDock />
      <PlatformDockEditor open={dockEditorOpen} onClose={() => setDockEditorOpen(false)} />
      <MissionControlOverlay />
    </div>
  )
}

export default function PlatformLayout() {
  return (
    <MissionControlProvider>
      <PlatformMacDesktopProvider>
        <PlatformDesktopShell />
      </PlatformMacDesktopProvider>
    </MissionControlProvider>
  )
}
