// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useToastContext } from '../contexts/ToastContext'
import { isPathAllowedForTier, usePlatformDesktopTier } from '../utils/platformDesktopTier'

/** Redirects to /platform when the current route is not allowed for the desktop tier. */
export function usePlatformTierRouteGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToastContext()
  const [tier] = usePlatformDesktopTier()

  useEffect(() => {
    const path = location.pathname
    if (!path.startsWith('/platform')) return
    if (path === '/platform') return
    if (isPathAllowedForTier(path, tier)) return

    toast.info('That area is hidden in your desktop tier — switch to Power or Advanced in Settings → Appearance.')
    navigate('/platform', { replace: true })
  }, [location.pathname, tier, navigate, toast])
}
