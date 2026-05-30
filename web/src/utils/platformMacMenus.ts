// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { PLATFORM_SIDEBAR, type PlatformNavSection } from './platformNav'
import { isPathAllowedForTier, type PlatformDesktopTier } from './platformDesktopTier'

export type MacMenuNavItem = { to: string; label: string }

export function macMenuSectionsForTier(tier: PlatformDesktopTier): PlatformNavSection[] {
  return PLATFORM_SIDEBAR.map((section) => ({
    ...section,
    items: section.items.filter((item) => isPathAllowedForTier(item.to, tier)),
  })).filter((section) => section.items.length > 0)
}

export function flattenMacMenuForTier(tier: PlatformDesktopTier): MacMenuNavItem[] {
  return macMenuSectionsForTier(tier).flatMap((s) =>
    s.items.map((item) => ({ to: item.to, label: item.label })),
  )
}
