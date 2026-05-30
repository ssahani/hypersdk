// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { PlatformDesktopTier } from './platformDesktopTier'
import { isPathAllowedForTier } from './platformDesktopTier'
import { PLATFORM_SIDEBAR, type PlatformNavItem, type PlatformNavSection } from './platformNav'

function withIntegrations(sections: PlatformNavSection[], extra: PlatformNavItem[]): PlatformNavSection[] {
  if (extra.length === 0) return sections
  return [...sections, { label: 'Cloud & tools', items: extra }]
}

export function sidebarForTier(tier: PlatformDesktopTier, integrationItems: PlatformNavItem[] = []): PlatformNavSection[] {
  if (tier === 'advanced') return withIntegrations(PLATFORM_SIDEBAR, integrationItems)

  const filtered = PLATFORM_SIDEBAR.map((section) => ({
    ...section,
    items: section.items.filter((item) => isPathAllowedForTier(item.to, tier)),
  })).filter((section) => section.items.length > 0)

  const merged = withIntegrations(filtered, integrationItems.filter((item) => {
    if (item.to.startsWith('/platform')) return isPathAllowedForTier(item.to, tier)
    return tier !== 'normal' || item.to === '/openstack' || item.to === '/k8s'
  }))

  if (tier === 'normal') {
    const items = merged.flatMap((s) => s.items)
    return [{ label: 'Favorites', items }]
  }

  return merged
}
