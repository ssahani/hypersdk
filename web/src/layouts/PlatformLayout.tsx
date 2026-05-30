// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import PlatformSidebar from '../components/platform/PlatformSidebar'
import PlatformControlCenter from '../components/platform/PlatformControlCenter'
import PlatformTopBar from '../components/platform/PlatformTopBar'
import PlatformMenuBar from '../components/platform/PlatformMenuBar'
import PlatformMacDock from '../components/platform/PlatformMacDock'
import { PlatformMacDesktopProvider, usePlatformMacDesktop } from '../components/platform/mac/PlatformMacDesktopContext'
import PlatformMacAppMenus from '../components/platform/mac/PlatformMacAppMenus'
import PlatformMacDesktopTabs from '../components/platform/mac/PlatformMacDesktopTabs'
import PopoutTitleBar from '../components/platform/mac/PopoutTitleBar'
import {
  PLATFORM_WALLPAPER_EVENT,
  loadPlatformWallpaper,
  type PlatformWallpaper,
} from '../utils/platformWallpaper'
import { isCenterPopoutMode } from '../utils/platformCenterPopout'
import { platformPageLabel } from '../utils/platformDesktopTabs'
import { OPEN_PLATFORM_DOCK_EDITOR_EVENT } from '../utils/platformDockPins'
import { usePlatformDesktopTier } from '../utils/platformDesktopTier'
import PlatformDockEditor from '../components/platform/mac/PlatformDockEditor'
import { usePlatformTierRouteGuard } from '../hooks/usePlatformTierRouteGuard'

function PlatformDesktopShell() {
  const location = useLocation()
  const isPopout = isCenterPopoutMode(location.search)
  const [wallpaper, setWallpaper] = useState<PlatformWallpaper>(() => loadPlatformWallpaper())
  const [dockEditorOpen, setDockEditorOpen] = useState(false)
  const { sidebarVisible } = usePlatformMacDesktop()
  const [tier] = usePlatformDesktopTier()
  usePlatformTierRouteGuard()

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

  if (isPopout) {
    return (
      <div
        className="mac-desktop-root mac-popout-root platform-mac-desktop tahoe-page-root flex flex-col flex-1 min-h-0 h-full overflow-hidden"
        data-wallpaper={wallpaper}
      >
        <PopoutTitleBar title={platformPageLabel(location.pathname)} />
        <div className="tahoe-canvas flex-1 min-h-0 overflow-auto relative">
          <div className="tahoe-mesh pointer-events-none" aria-hidden />
          <div className="relative z-[1] p-3 lg:p-4">
            <Outlet />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="mac-desktop-root platform-mac-desktop tahoe-page-root flex flex-col flex-1 min-h-0 h-full overflow-hidden"
      data-wallpaper={wallpaper}
      data-desktop-tier={tier}
    >
      <header className="mac-menubar-inner glass shrink-0 relative z-20 flex items-center gap-2 px-2 lg:px-3 h-11">
        <PlatformMacAppMenus />
        <div className="flex-1 min-w-0 flex justify-center absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <PlatformTopBar />
        </div>
        <div className="ml-auto shrink-0 flex items-center gap-2">
          <PlatformControlCenter />
        </div>
      </header>

      <PlatformMacDesktopTabs />

      <div className="flex flex-1 min-h-0">
        {sidebarVisible ? <PlatformSidebar /> : null}
        <div className="tahoe-canvas mac-desktop-main flex-1 min-w-0 flex flex-col relative">
          <div className="tahoe-mesh pointer-events-none" aria-hidden />
          <div className="relative z-[1] flex flex-col flex-1 min-h-0 px-3 lg:px-4 pt-2 pb-24 lg:pb-28">
            <PlatformMenuBar />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Outlet />
            </div>
          </div>
        </div>
      </div>

      <PlatformMacDock />
      <PlatformDockEditor open={dockEditorOpen} onClose={() => setDockEditorOpen(false)} />
    </div>
  )
}

export default function PlatformLayout() {
  return (
    <PlatformMacDesktopProvider>
      <PlatformDesktopShell />
    </PlatformMacDesktopProvider>
  )
}
