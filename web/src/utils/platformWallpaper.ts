// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type PlatformWallpaper = 'tahoe' | 'aurora' | 'midnight' | 'ocean'

const STORAGE_KEY = 'machina-platform-wallpaper'
export const PLATFORM_WALLPAPER_EVENT = 'machina-platform-wallpaper-changed'

export const PLATFORM_WALLPAPER_LABELS: Record<PlatformWallpaper, string> = {
  tahoe: 'Tahoe (default)',
  aurora: 'Aurora',
  midnight: 'Midnight',
  ocean: 'Ocean',
}

export function loadPlatformWallpaper(): PlatformWallpaper {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && raw in PLATFORM_WALLPAPER_LABELS) return raw as PlatformWallpaper
  } catch { /* ignore */ }
  return 'tahoe'
}

export function savePlatformWallpaper(wallpaper: PlatformWallpaper) {
  localStorage.setItem(STORAGE_KEY, wallpaper)
  window.dispatchEvent(new CustomEvent(PLATFORM_WALLPAPER_EVENT, { detail: { wallpaper } }))
}

export function resetPlatformWallpaper() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(PLATFORM_WALLPAPER_EVENT, { detail: { wallpaper: 'tahoe' as PlatformWallpaper } }))
}
