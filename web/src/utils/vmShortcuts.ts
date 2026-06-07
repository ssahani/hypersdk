// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { removePinnedVMs } from './pinnedVMs'
import { removeRecentVMs } from './recentVMs'

/** Drop deleted VM names from Spotlight recent/pinned shortcuts. */
export function purgeVmShortcuts(names: string[]) {
  const unique = [...new Set(names.filter(Boolean))]
  if (!unique.length) return
  removeRecentVMs(unique)
  removePinnedVMs(unique)
}
