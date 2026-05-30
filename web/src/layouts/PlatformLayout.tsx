// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Outlet } from 'react-router'
import PlatformSidebar from '../components/platform/PlatformSidebar'
import PlatformControlCenter from '../components/platform/PlatformControlCenter'
import PlatformTopBar from '../components/platform/PlatformTopBar'
import PlatformMenuBar from '../components/platform/PlatformMenuBar'

export default function PlatformLayout() {
  return (
    <div className="platform-mac-shell flex gap-0 -mx-2 lg:-mx-4 min-h-[calc(100vh-8rem)] rounded-2xl overflow-hidden border border-white/[0.04]">
      <PlatformSidebar />
      <div className="flex-1 min-w-0 flex flex-col platform-mac-main">
        <div className="flex items-start justify-between gap-3 px-3 lg:px-4 pt-3">
          <div className="flex-1 min-w-0">
            <PlatformTopBar />
            <PlatformMenuBar />
          </div>
          <div className="shrink-0 pt-1">
            <PlatformControlCenter />
          </div>
        </div>
        <div className="flex-1 px-3 lg:px-4 pb-4 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
