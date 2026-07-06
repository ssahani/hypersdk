// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useToastContext } from '../contexts/ToastContext'
import { usePlatformDesktopTier } from '../hooks/usePlatformDesktopTier'
import {
  isPathAllowedForTier,
  minTierForPath,
  PLATFORM_DESKTOP_TIER_LABELS,
} from '../utils/platformDesktopTier'

/**
 * When the current route is hidden at the active desktop tier, raise the tier
 * just enough to show it and stay put — deliberately navigating into an area is
 * intent to see it, so we honor that instead of bouncing to Settings and asking
 * the user to flip a switch by hand.
 */
export function usePlatformTierRouteGuard() {
  const location = useLocation()
  const toast = useToastContext()
  const [tier, setTier] = usePlatformDesktopTier()

  useEffect(() => {
    const path = location.pathname
    if (!path.startsWith('/platform')) return
    if (path === '/platform') return
    if (isPathAllowedForTier(path, tier)) return

    const required = minTierForPath(path)
    setTier(required)
    toast.info(`Switched to ${PLATFORM_DESKTOP_TIER_LABELS[required]} to open this area.`)
    // Intentionally no navigate() — the route stays; only the tier catches up.
  }, [location.pathname, tier, setTier, toast])
}
