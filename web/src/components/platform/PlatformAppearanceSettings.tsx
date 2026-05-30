// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { MacSettingsGroup } from './mac/PlatformMacUi'
import {
  PLATFORM_WALLPAPER_EVENT,
  PLATFORM_WALLPAPER_LABELS,
  loadPlatformWallpaper,
  resetPlatformWallpaper,
  savePlatformWallpaper,
  type PlatformWallpaper,
} from '../../utils/platformWallpaper'

const SWATCH_CLASS: Record<PlatformWallpaper, string> = {
  tahoe: 'mac-wallpaper-swatch-tahoe',
  aurora: 'mac-wallpaper-swatch-aurora',
  midnight: 'mac-wallpaper-swatch-midnight',
  ocean: 'mac-wallpaper-swatch-ocean',
}

export default function PlatformAppearanceSettings() {
  const [wallpaper, setWallpaper] = useState<PlatformWallpaper>(() => loadPlatformWallpaper())

  useEffect(() => {
    const onChange = () => setWallpaper(loadPlatformWallpaper())
    window.addEventListener(PLATFORM_WALLPAPER_EVENT, onChange)
    return () => window.removeEventListener(PLATFORM_WALLPAPER_EVENT, onChange)
  }, [])

  const pick = (next: PlatformWallpaper) => {
    savePlatformWallpaper(next)
    setWallpaper(next)
  }

  return (
    <MacSettingsGroup title="Appearance">
      <p className="text-sm text-white/55 mb-3">Desktop wallpaper for the Machina Platform shell (macOS Tahoe style).</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(PLATFORM_WALLPAPER_LABELS) as PlatformWallpaper[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => pick(key)}
            className={`rounded-xl border p-2 text-left transition ${
              wallpaper === key ? 'border-sky-400/50 ring-1 ring-sky-400/30' : 'border-white/[0.08] hover:border-white/20'
            }`}
          >
            <div className={`h-16 rounded-lg mb-2 ${SWATCH_CLASS[key]}`} />
            <span className="text-xs text-white/80">{PLATFORM_WALLPAPER_LABELS[key]}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-secondary text-sm mt-4" onClick={() => { resetPlatformWallpaper(); setWallpaper('tahoe') }}>
        Reset to default
      </button>
    </MacSettingsGroup>
  )
}
