// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import {
  loadPlatformDesktopTier,
  PLATFORM_DESKTOP_TIER_EVENT,
  savePlatformDesktopTier,
  type PlatformDesktopTier,
} from '../utils/platformDesktopTier'
import { resetPlatformDockPaths } from '../utils/platformDockPins'

export function usePlatformDesktopTier(): [PlatformDesktopTier, (t: PlatformDesktopTier) => void] {
  const [tier, setTier] = useState<PlatformDesktopTier>(() => loadPlatformDesktopTier())
  useEffect(() => {
    const onChange = () => setTier(loadPlatformDesktopTier())
    window.addEventListener(PLATFORM_DESKTOP_TIER_EVENT, onChange)
    return () => window.removeEventListener(PLATFORM_DESKTOP_TIER_EVENT, onChange)
  }, [])
  const save = (next: PlatformDesktopTier) => {
    savePlatformDesktopTier(next)
    resetPlatformDockPaths(next)
    setTier(next)
  }
  return [tier, save]
}
