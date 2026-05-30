// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// macOS-like desktop density — Normal · Power · Advanced.

export type PlatformDesktopTier = 'normal' | 'power' | 'advanced'

export const PLATFORM_DESKTOP_TIER_KEY = 'machina-platform-desktop-tier'
export const PLATFORM_DESKTOP_TIER_EVENT = 'machina-platform-desktop-tier-changed'

export const PLATFORM_DESKTOP_TIER_LABELS: Record<PlatformDesktopTier, string> = {
  normal: 'Normal',
  power: 'Power user',
  advanced: 'Advanced',
}

export const PLATFORM_DESKTOP_TIER_HINTS: Record<PlatformDesktopTier, string> = {
  normal: 'Clean desktop — Finder, hosts, backups, and settings. Dock-first layout.',
  power: 'Operations toolkit — storage, networks, Zeus, tasks, and shortcuts.',
  advanced: 'Full Machina fleet surface — every pane, firewall module, and admin tool.',
}

const TIER_RANK: Record<PlatformDesktopTier, number> = {
  normal: 0,
  power: 1,
  advanced: 2,
}

/** Paths always reachable (detail routes, popouts). */
const NORMAL_PATHS = [
  '/platform',
  '/platform/vms',
  '/platform/hosts',
  '/platform/storage',
  '/platform/backups',
  '/platform/settings',
  '/platform/support',
  '/platform/notifications',
]

const POWER_PATHS = [
  ...NORMAL_PATHS,
  '/platform/applications',
  '/platform/storage',
  '/platform/networks',
  '/platform/templates',
  '/platform/content',
  '/platform/tasks',
  '/platform/activity',
  '/platform/migration',
  '/platform/blueprints',
  '/platform/projects',
  '/platform/zeus',
  '/platform/zeus/security/firewall',
  '/platform/maintenance',
  '/platform/recommendations',
  '/platform/topology',
  '/platform/events',
  '/platform/enroll',
  '/platform/reports',
]

export const DOCK_PATHS_BY_TIER: Record<PlatformDesktopTier, string[]> = {
  normal: ['/platform', '/platform/hosts', '/platform/vms', '/platform/storage', '/platform/settings'],
  power: [
    '/platform',
    '/platform/hosts',
    '/platform/vms',
    '/platform/storage',
    '/platform/networks',
    '/platform/zeus',
    '/platform/events',
    '/platform/settings',
  ],
  advanced: [
    '/platform',
    '/platform/hosts',
    '/platform/vms',
    '/platform/storage',
    '/platform/networks',
    '/platform/zeus',
    '/platform/activity',
    '/platform/reports',
    '/platform/topology',
    '/platform/maintenance',
    '/platform/notifications',
    '/platform/events',
    '/platform/settings',
  ],
}

function pathsForTier(tier: PlatformDesktopTier): string[] | null {
  if (tier === 'advanced') return null
  if (tier === 'power') return POWER_PATHS
  return NORMAL_PATHS
}

export function loadPlatformDesktopTier(): PlatformDesktopTier {
  try {
    const raw = localStorage.getItem(PLATFORM_DESKTOP_TIER_KEY)
    if (raw === 'normal' || raw === 'power' || raw === 'advanced') return raw
  } catch {
    /* ignore */
  }
  return 'advanced'
}

export function savePlatformDesktopTier(tier: PlatformDesktopTier) {
  localStorage.setItem(PLATFORM_DESKTOP_TIER_KEY, tier)
  window.dispatchEvent(new CustomEvent(PLATFORM_DESKTOP_TIER_EVENT, { detail: tier }))
}

export function isPathAllowedForTier(path: string, tier: PlatformDesktopTier): boolean {
  if (tier === 'advanced') return true
  const allowed = pathsForTier(tier)!
  return allowed.some((p) => path === p || path.startsWith(`${p}/`))
}

export function tierAtLeast(current: PlatformDesktopTier, min: PlatformDesktopTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[min]
}

export function defaultSidebarVisibleForTier(tier: PlatformDesktopTier): boolean {
  return tier !== 'normal'
}

export function showPlatformMenuBarForTier(tier: PlatformDesktopTier): boolean {
  return tier !== 'normal'
}

export function showPlatformMenuBarFullForTier(tier: PlatformDesktopTier): boolean {
  return tier === 'advanced'
}
