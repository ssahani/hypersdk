// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowLeft, LayoutGrid, Puzzle } from 'lucide-react'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { shellLabel } from './shellBridgeUtils'

export { shellLabel } from './shellBridgeUtils'

export default function ShellBridgeBar() {
  const { pathname } = useLocation()
  const { info, loading } = usePlatformInfo()
  const label = shellLabel(pathname)
  const fleetMode = Boolean(info?.control_plane?.proxy_url)
  const [stickyFleet, setStickyFleet] = useState(false)

  useEffect(() => {
    if (fleetMode) setStickyFleet(true)
  }, [fleetMode])

  if (!label) return null
  if (!stickyFleet && !loading) return null

  return (
    <div
      className="shell-bridge-bar platform-space-banner px-4 py-3"
      role="navigation"
      aria-label="Return to Platform desktop"
    >
      <div className="flex flex-wrap items-center gap-3 max-w-[160rem] mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutGrid className="h-4 w-4 text-sky-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/50">Same Machina session — return to the Platform desktop anytime.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Link to="/platform" className="platform-space-banner-link platform-space-banner-link-primary">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Platform
          </Link>
          <Link to="/platform/integrations" className="platform-space-banner-link">
            <Puzzle className="w-3.5 h-3.5" />
            Apps &amp; Integrations
          </Link>
        </div>
      </div>
    </div>
  )
}
