// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { PlatformDesktopTier } from './platformDesktopTier'
import { isPathAllowedForTier } from './platformDesktopTier'
import { DESKTOP_HUB_TILES, type DesktopHubTile } from './platformHubZones'
import { integrationNavItems } from './platformIntegrationsNav'
import type { PlatformInfo } from '../api/system'
import { sidebarForTier } from './platformNavFilter'

export type SpotlightNavEntry = {
  id: string
  label: string
  path: string
  zone: string
  description?: string
  kind: 'hub' | 'destination'
}

/** Spotlight / Command palette entries grouped by sidebar zone. */
export function spotlightNavForTier(tier: PlatformDesktopTier, info: PlatformInfo | null = null): SpotlightNavEntry[] {
  const entries: SpotlightNavEntry[] = []
  const seen = new Set<string>()

  const push = (entry: SpotlightNavEntry) => {
    if (seen.has(entry.path)) return
    seen.add(entry.path)
    entries.push(entry)
  }

  for (const hub of DESKTOP_HUB_TILES) {
    if (!isPathAllowedForTier(hub.href, tier)) continue
    push({
      id: `hub-${hub.id}`,
      label: hub.label,
      path: hub.href,
      zone: hub.zone,
      description: hub.description,
      kind: 'hub',
    })
  }

  for (const section of sidebarForTier(tier, integrationNavItems(info))) {
    for (const item of section.items) {
      if (!isPathAllowedForTier(item.to, tier)) continue
      push({
        id: `nav-${item.to}`,
        label: item.label,
        path: item.to,
        zone: section.label,
        kind: 'destination',
      })
    }
  }

  return entries
}

export function spotlightZoneOrder(): string[] {
  return ['Favorites', 'Fleet', 'Platform', 'Connected platforms']
}

export function groupSpotlightByZone(entries: SpotlightNavEntry[]): Array<{ zone: string; items: SpotlightNavEntry[] }> {
  const order = spotlightZoneOrder()
  const buckets = new Map<string, SpotlightNavEntry[]>()
  for (const entry of entries) {
    const list = buckets.get(entry.zone) ?? []
    list.push(entry)
    buckets.set(entry.zone, list)
  }
  return order
    .filter((zone) => buckets.has(zone))
    .map((zone) => ({ zone, items: buckets.get(zone)! }))
}

export function hubTileById(id: DesktopHubTile['id']): DesktopHubTile | undefined {
  return DESKTOP_HUB_TILES.find((hub) => hub.id === id)
}
