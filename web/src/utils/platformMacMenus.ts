// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { PlatformDesktopTier } from './platformDesktopTier'
import type { PlatformNavItem, PlatformNavSection } from './platformNav'
import { sidebarForTier } from './platformNavFilter'

export type MacMenuNavItem = { to: string; label: string }

export function macMenuSectionsForTier(tier: PlatformDesktopTier, integrationItems: PlatformNavItem[] = []): PlatformNavSection[] {
  return sidebarForTier(tier, integrationItems)
}

export function flattenMacMenuForTier(tier: PlatformDesktopTier, integrationItems: PlatformNavItem[] = []): MacMenuNavItem[] {
  return macMenuSectionsForTier(tier, integrationItems).flatMap((s) =>
    s.items.map((item) => ({ to: item.to, label: item.label })),
  )
}
