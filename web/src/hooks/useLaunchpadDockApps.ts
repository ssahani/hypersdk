// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { listLaunchpadFavorites, type LaunchpadApp } from '../api/launchpad'

export function useLaunchpadDockApps(limit = 4): LaunchpadApp[] {
  const location = useLocation()
  const [apps, setApps] = useState<LaunchpadApp[]>([])

  useEffect(() => {
    if (!location.pathname.startsWith('/platform')) {
      setApps([])
      return
    }
    let cancelled = false
    void listLaunchpadFavorites()
      .then((favs) => {
        if (!cancelled) setApps(favs.slice(0, limit))
      })
      .catch(() => {
        if (!cancelled) setApps([])
      })
    return () => {
      cancelled = true
    }
  }, [location.pathname, limit])

  return apps
}
