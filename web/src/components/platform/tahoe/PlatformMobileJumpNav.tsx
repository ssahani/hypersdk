// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Compass } from 'lucide-react'
import { usePlatformInfo } from '../../../contexts/PlatformInfoContext'
import { usePlatformDesktopTier } from '../../../hooks/usePlatformDesktopTier'
import { integrationNavItems } from '../../../utils/platformIntegrationsNav'
import { sidebarForTier } from '../../../utils/platformNavFilter'

function activeNavPath(pathname: string, to: string): boolean {
  if (to === '/platform') return pathname === '/platform'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function PlatformMobileJumpNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tier] = usePlatformDesktopTier()
  const { info } = usePlatformInfo()
  const sections = sidebarForTier(tier, integrationNavItems(info))

  const items = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  )

  const current = useMemo(
    () => items.find((item) => activeNavPath(location.pathname, item.to))?.to ?? '',
    [items, location.pathname],
  )

  return (
    <div className="tahoe-mobile-jump lg:hidden shrink-0 border-b border-white/[0.06] bg-slate-950/40 backdrop-blur-md">
      <label htmlFor="platform-mobile-jump" className="sr-only">
        Navigate platform
      </label>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Compass className="h-4 w-4 shrink-0 text-sky-400/80" aria-hidden />
        <select
          id="platform-mobile-jump"
          className="tahoe-mobile-jump-select flex-1 min-w-0"
          value={current}
          onChange={(e) => {
            if (e.target.value) navigate(e.target.value)
          }}
        >
          <option value="" disabled>
            Jump to…
          </option>
          {items.map((item) => (
            <option key={item.to} value={item.to}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
