// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { PlatformDesktopTier } from './platformDesktopTier'
import { isPathAllowedForTier, tierAtLeast } from './platformDesktopTier'

export type DesktopHubTile = {
  id: string
  label: string
  href: string
  description: string
  zone: 'Favorites' | 'Fleet' | 'Platform'
}

/** Hub launchpads — deep routes live inside these pages, not as duplicate chrome. */
export const DESKTOP_HUB_TILES: DesktopHubTile[] = [
  {
    id: 'integrations',
    label: 'Apps & Integrations',
    href: '/platform/integrations',
    description: 'OpenStack, Kubernetes, and classic Machina tools',
    zone: 'Fleet',
  },
  {
    id: 'resources',
    label: 'Resources',
    href: '/platform/resources',
    description: 'Disk Utility, networks, images, and templates',
    zone: 'Platform',
  },
  {
    id: 'operations',
    label: 'Operations',
    href: '/platform/operations',
    description: 'Tasks, alerts, lifecycle, and fleet insights',
    zone: 'Platform',
  },
  {
    id: 'security',
    label: 'Security Center',
    href: '/platform/zeus/security',
    description: 'Threat posture, firewall, and Zeus security workspaces',
    zone: 'Platform',
  },
]

export function hubTilesForTier(tier: PlatformDesktopTier): DesktopHubTile[] {
  return DESKTOP_HUB_TILES.filter((tile) => isPathAllowedForTier(tile.href, tier))
}

export function showPlatformHubsForTier(tier: PlatformDesktopTier): boolean {
  return tierAtLeast(tier, 'power')
}
