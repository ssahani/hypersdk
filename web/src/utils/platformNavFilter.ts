// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { PlatformDesktopTier } from './platformDesktopTier'
import { isPathAllowedForTier } from './platformDesktopTier'
import { PLATFORM_SIDEBAR, type PlatformNavSection } from './platformNav'

export function sidebarForTier(tier: PlatformDesktopTier): PlatformNavSection[] {
  if (tier === 'advanced') return PLATFORM_SIDEBAR

  const filtered = PLATFORM_SIDEBAR.map((section) => ({
    ...section,
    items: section.items.filter((item) => isPathAllowedForTier(item.to, tier)),
  })).filter((section) => section.items.length > 0)

  if (tier === 'normal') {
    const items = filtered.flatMap((s) => s.items)
    return [{ label: 'Favorites', items }]
  }

  return filtered
}
