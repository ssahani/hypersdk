// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ReactNode } from 'react'
import type { PlatformDesktopTier } from './platformDesktopTier'
import { isPathAllowedForTier } from './platformDesktopTier'
import { DESKTOP_HUB_TILES } from './platformHubZones'
import { hubHrefForTier } from './platformHubLinks'
import { NORMAL_FAVORITE_PATHS, PLATFORM_SIDEBAR, type PlatformNavItem, type PlatformNavSection } from './platformNav'

export type MacMenuNavItem = { to: string; label: string }

/** Hub-first Go menu — favorites + launchpads, not full flat nav. */
export function macMenuSectionsForTier(tier: PlatformDesktopTier, _integrationItems: PlatformNavItem[] = []): PlatformNavSection[] {
  const favorites = PLATFORM_SIDEBAR.flatMap((s) => s.items).filter((item) =>
    (NORMAL_FAVORITE_PATHS as readonly string[]).includes(item.to),
  )

  const hubItems = DESKTOP_HUB_TILES
    .filter((hub) => isPathAllowedForTier(hub.href, tier))
    .map((hub) => ({
      to: hubHrefForTier(hub.id, tier),
      label: hub.label,
      icon: null as ReactNode,
    }))

  const sections: PlatformNavSection[] = [
    { label: 'Favorites', items: favorites },
  ]

  if (hubItems.length > 0) {
    const favoritePaths = new Set(favorites.map((item) => item.to))
    const dedupedHubs = hubItems.filter((hub) => !favoritePaths.has(hub.to))
    if (dedupedHubs.length > 0) {
      sections.push({
        label: 'Hubs',
        items: dedupedHubs.map((h) => ({ ...h, icon: null })),
      })
    }
  }

  return sections
}

export function flattenMacMenuForTier(tier: PlatformDesktopTier, integrationItems: PlatformNavItem[] = []): MacMenuNavItem[] {
  return macMenuSectionsForTier(tier, integrationItems).flatMap((s) =>
    s.items.map((item) => ({ to: item.to, label: item.label })),
  )
}
