// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { LucideIcon } from 'lucide-react'
import {
  Cpu,
  FolderOpen,
  LayoutGrid,
  Monitor,
  Plug,
  Server,
  Settings,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import type { PlatformDesktopTier } from './platformDesktopTier'
import { isPathAllowedForTier, tierAtLeast } from './platformDesktopTier'
import { platformPageLabel } from './platformDesktopTabs'

export type ContextNavItem = {
  to: string
  label: string
}

export type PlatformContextNav = {
  appLabel: string
  appIcon: LucideIcon
  hubPath?: string
  items: ContextNavItem[]
}

type ContextDefinition = {
  match: (pathname: string) => boolean
  appLabel: string
  appIcon: LucideIcon
  hubPath?: string
  items: ContextNavItem[]
}

type SettingsNavEntry = ContextNavItem & { minTier?: PlatformDesktopTier }

const SETTINGS_ENTRIES: SettingsNavEntry[] = [
  { to: '/platform/settings?section=general', label: 'General' },
  { to: '/platform/settings?section=security', label: 'Security' },
  { to: '/platform/settings?section=network', label: 'Network' },
  { to: '/platform/settings?section=users', label: 'Users' },
  { to: '/platform/settings?section=stage-manager', label: 'Stage Manager', minTier: 'power' },
  { to: '/platform/settings?section=keychain', label: 'Keychain', minTier: 'power' },
  { to: '/platform/settings?section=policy', label: 'Policy', minTier: 'power' },
  { to: '/platform/settings?section=api-keys', label: 'API Keys', minTier: 'power' },
  { to: '/platform/settings?section=webhooks', label: 'Webhooks', minTier: 'power' },
  { to: '/platform/settings?section=reports', label: 'Reports', minTier: 'power' },
  { to: '/platform/settings?section=console', label: 'Console', minTier: 'power' },
  { to: '/platform/settings?section=resources', label: 'Resources', minTier: 'power' },
  { to: '/platform/settings?section=updates', label: 'Updates' },
  { to: '/platform/settings?section=integrations', label: 'Integrations' },
  { to: '/platform/settings?section=support', label: 'Support' },
  { to: '/platform/settings?section=about', label: 'About' },
]

export function settingsItemsForTier(tier: PlatformDesktopTier): ContextNavItem[] {
  return SETTINGS_ENTRIES
    .filter((item) => tierAtLeast(tier, item.minTier ?? 'normal'))
    .map(({ to, label }) => ({ to, label }))
}

const SECURITY_ITEMS: ContextNavItem[] = [
  { to: '/platform/zeus/security', label: 'Security Center' },
  { to: '/platform/zeus/security/firewall', label: 'Firewall' },
  { to: '/platform/zeus/security/ports', label: 'Open Ports' },
  { to: '/platform/zeus/security/services', label: 'Allowed Apps' },
  { to: '/platform/zeus/security/activity', label: 'Activity' },
  { to: '/platform/zeus/security/compliance', label: 'Compliance' },
  { to: '/platform/zeus/security/k8s', label: 'Kubernetes' },
  { to: '/platform/zeus/security/cloud', label: 'Cloud SGs' },
  { to: '/platform/zeus/security/connectivity', label: 'Connectivity' },
  { to: '/platform/zeus/security/policies', label: 'Policy Studio' },
  { to: '/platform/zeus/security/hunt', label: 'Threat Hunting' },
  { to: '/platform/zeus/security/enforcement', label: 'Enforcement' },
]

const RESOURCES_ITEMS: ContextNavItem[] = [
  { to: '/platform/resources', label: 'Overview' },
  { to: '/platform/storage', label: 'Disk Utility' },
  { to: '/platform/networks', label: 'Networks' },
  { to: '/platform/content', label: 'Images & ISOs' },
  { to: '/platform/templates', label: 'Templates' },
]

const OPERATIONS_ITEMS: ContextNavItem[] = [
  { to: '/platform/operations', label: 'Overview' },
  { to: '/platform/tasks', label: 'Tasks' },
  { to: '/platform/notifications', label: 'Alerts' },
  { to: '/platform/activity', label: 'Activity' },
  { to: '/platform/migration', label: 'Migration' },
  { to: '/platform/backups', label: 'Backups' },
  { to: '/platform/maintenance', label: 'Updates' },
  { to: '/platform/reports', label: 'Reports' },
  { to: '/platform/topology', label: 'Topology' },
  { to: '/platform/observability', label: 'Observability' },
]

const ZEUS_ITEMS: ContextNavItem[] = [
  { to: '/platform/zeus', label: 'Overview' },
  { to: '/platform/zeus?tab=fleet', label: 'Fleet AI' },
  { to: '/platform/zeus?tab=services', label: 'Services' },
  { to: '/platform/zeus?tab=security', label: 'Attack paths' },
  { to: '/platform/zeus?tab=knowledge', label: 'Knowledge' },
  { to: '/platform/zeus?tab=baremetal', label: 'Bare Metal' },
  { to: '/platform/zeus/security', label: 'Security Center' },
]

const CONTEXT_DEFINITIONS: ContextDefinition[] = [
  {
    match: (p) => p.startsWith('/platform/zeus/security'),
    appLabel: 'Security',
    appIcon: ShieldAlert,
    hubPath: '/platform/zeus/security',
    items: SECURITY_ITEMS,
  },
  {
    match: (p) => p === '/platform/zeus' || p.startsWith('/platform/zeus/'),
    appLabel: 'Machina Zeus OS',
    appIcon: Cpu,
    hubPath: '/platform/zeus',
    items: ZEUS_ITEMS,
  },
  {
    match: (p) =>
      p.startsWith('/platform/storage')
      || p.startsWith('/platform/networks')
      || p.startsWith('/platform/content')
      || p.startsWith('/platform/templates')
      || p === '/platform/resources',
    appLabel: 'Resources',
    appIcon: FolderOpen,
    hubPath: '/platform/resources',
    items: RESOURCES_ITEMS,
  },
  {
    match: (p) =>
      p === '/platform/operations'
      || p.startsWith('/platform/tasks')
      || p.startsWith('/platform/notifications')
      || p.startsWith('/platform/activity')
      || p.startsWith('/platform/migration')
      || p.startsWith('/platform/backups')
      || p.startsWith('/platform/placement')
      || p.startsWith('/platform/maintenance')
      || p.startsWith('/platform/reports')
      || p.startsWith('/platform/recommendations')
      || p.startsWith('/platform/blueprints')
      || p.startsWith('/platform/topology')
      || p.startsWith('/platform/observability'),
    appLabel: 'Operations',
    appIcon: Wrench,
    hubPath: '/platform/operations',
    items: OPERATIONS_ITEMS,
  },
  {
    match: (p) => p.startsWith('/platform/settings'),
    appLabel: 'Settings',
    appIcon: Settings,
    hubPath: '/platform/settings',
    items: [],
  },
  {
    match: (p) => p.startsWith('/platform/integrations') || p.startsWith('/platform/applications'),
    appLabel: 'Apps & Integrations',
    appIcon: Plug,
    hubPath: '/platform/integrations',
    items: [
      { to: '/platform/integrations', label: 'Overview' },
      { to: '/platform/applications', label: 'Applications' },
    ],
  },
  {
    match: (p) => p.startsWith('/platform/vms'),
    appLabel: 'Finder',
    appIcon: Monitor,
    hubPath: '/platform/vms',
    items: [{ to: '/platform/vms', label: 'Virtual Machines' }],
  },
  {
    match: (p) => p.startsWith('/platform/hosts'),
    appLabel: 'Hosts',
    appIcon: Server,
    hubPath: '/platform/hosts',
    items: [
      { to: '/platform/hosts', label: 'Machines' },
      { to: '/platform/enroll', label: 'Add Host' },
    ],
  },
]

function filterItems(items: ContextNavItem[], tier: PlatformDesktopTier): ContextNavItem[] {
  return items.filter((item) => {
    const path = item.to.split('?')[0]
    return isPathAllowedForTier(path, tier)
  })
}

export function contextNavForPath(pathname: string, tier: PlatformDesktopTier): PlatformContextNav | null {
  const def = CONTEXT_DEFINITIONS.find((d) => d.match(pathname))
  if (!def) {
    const label = platformPageLabel(pathname)
    if (pathname === '/platform') {
      return {
        appLabel: 'Dashboard',
        appIcon: LayoutGrid,
        items: [],
      }
    }
    return {
      appLabel: label,
      appIcon: LayoutGrid,
      items: [],
    }
  }

  const items = pathname.startsWith('/platform/settings')
    ? settingsItemsForTier(tier)
    : filterItems(def.items, tier)
  if (items.length <= 1) {
    return {
      appLabel: def.appLabel,
      appIcon: def.appIcon,
      hubPath: def.hubPath,
      items: [],
    }
  }

  return {
    appLabel: def.appLabel,
    appIcon: def.appIcon,
    hubPath: def.hubPath,
    items,
  }
}

export function isContextNavActive(pathname: string, search: string, item: ContextNavItem): boolean {
  const [itemPath, itemQuery] = item.to.split('?')

  if (itemQuery) {
    const expected = new URLSearchParams(itemQuery)
    const current = new URLSearchParams(search)

    if (itemPath === '/platform/settings') {
      if (!pathname.startsWith('/platform/settings')) return false
      const expectedSection = expected.get('section') ?? 'general'
      const currentSection = current.get('section') ?? 'general'
      return expectedSection === currentSection
    }

    if (pathname !== itemPath && !pathname.startsWith(`${itemPath}/`)) return false
    for (const [key, value] of expected.entries()) {
      if (current.get(key) !== value) return false
    }
    return true
  }

  const exactHubPaths = ['/platform/zeus/security', '/platform/operations', '/platform/resources', '/platform/integrations', '/platform/zeus']
  if (exactHubPaths.includes(itemPath)) {
    return pathname === itemPath
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

export const MAX_CONTEXT_PILLS = 6

/** Keep primary pills visible; tuck the rest under More (always include active route). */
export function splitContextNavItems(
  items: ContextNavItem[],
  pathname: string,
  search: string,
  maxVisible = MAX_CONTEXT_PILLS,
): { visible: ContextNavItem[]; overflow: ContextNavItem[] } {
  if (items.length <= maxVisible) return { visible: items, overflow: [] }

  const activeIndex = items.findIndex((item) => isContextNavActive(pathname, search, item))
  const primary = items.slice(0, maxVisible - 1)
  const active = activeIndex >= 0 ? items[activeIndex] : null

  if (active && !primary.some((item) => item.to === active.to)) {
    const visible = [...primary, active]
    const visiblePaths = new Set(visible.map((item) => item.to))
    return {
      visible,
      overflow: items.filter((item) => !visiblePaths.has(item.to)),
    }
  }

  return {
    visible: items.slice(0, maxVisible),
    overflow: items.slice(maxVisible),
  }
}
