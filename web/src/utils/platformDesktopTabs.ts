// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { PLATFORM_PAGE_LABELS } from './platformNav'

export type PlatformDesktopTab = { path: string; label: string }

const KEY = 'machina-platform-desktop-tabs'
export const PLATFORM_DESKTOP_TABS_EVENT = 'machina-platform-desktop-tabs-changed'
export const MAX_PLATFORM_DESKTOP_TABS = 12

export function loadPlatformDesktopTabs(): PlatformDesktopTab[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PlatformDesktopTab[]
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch { /* ignore */ }
  return [{ path: '/platform', label: 'Dashboard' }]
}

function save(tabs: PlatformDesktopTab[]) {
  const trimmed = tabs.slice(-MAX_PLATFORM_DESKTOP_TABS)
  localStorage.setItem(KEY, JSON.stringify(trimmed))
  window.dispatchEvent(new CustomEvent(PLATFORM_DESKTOP_TABS_EVENT))
}

export function upsertPlatformDesktopTab(tab: PlatformDesktopTab): PlatformDesktopTab[] {
  const rest = loadPlatformDesktopTabs().filter((t) => t.path !== tab.path)
  const next = [...rest, tab].slice(-MAX_PLATFORM_DESKTOP_TABS)
  save(next)
  return next
}

export function removePlatformDesktopTab(path: string): PlatformDesktopTab[] {
  const next = loadPlatformDesktopTabs().filter((t) => t.path !== path)
  if (!next.length) next.push({ path: '/platform', label: 'Dashboard' })
  save(next)
  return next
}

export function platformPageLabel(pathname: string): string {
  const base = pathname.split('/').slice(0, 3).join('/') || '/platform'
  return PLATFORM_PAGE_LABELS[pathname] ?? PLATFORM_PAGE_LABELS[base] ?? 'Platform'
}
