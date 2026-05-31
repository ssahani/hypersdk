// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { PlatformDesktopTier } from './platformDesktopTier'
import { tierAtLeast } from './platformDesktopTier'

/** Primary Operations entry — hub on Power+, Notification Center on Normal. */
export function operationsHubHref(tier: PlatformDesktopTier): string {
  return tierAtLeast(tier, 'power') ? '/platform/operations' : '/platform/notifications'
}

/** Task list entry — full tasks on Power+, alerts fallback on Normal. */
export function tasksHubHref(tier: PlatformDesktopTier): string {
  return tierAtLeast(tier, 'power') ? '/platform/tasks' : '/platform/notifications'
}

/** Activity monitor entry — hidden behind Power tier on Normal. */
export function activityHubHref(tier: PlatformDesktopTier): string {
  return tierAtLeast(tier, 'power') ? '/platform/activity' : '/platform/notifications'
}
