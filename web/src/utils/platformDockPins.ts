// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Bell,
  FileBarChart,
  GitBranch,
  HardDrive,
  LayoutDashboard,
  Monitor,
  Network,
  Server,
  Settings,
  Sparkles,
  Terminal,
  Download,
} from 'lucide-react'
import { PLATFORM_SIDEBAR } from './platformNav'
import {
  DOCK_PATHS_BY_TIER,
  isPathAllowedForTier,
  loadPlatformDesktopTier,
  PLATFORM_DESKTOP_TIER_EVENT,
  type PlatformDesktopTier,
} from './platformDesktopTier'

export type PlatformDockItem = {
  path: string
  label: string
  icon: LucideIcon
}

const DOCK_KEY = 'machina-platform-dock-pins'
export const PLATFORM_DOCK_CHANGED_EVENT = 'machina-platform-dock-changed'
export const OPEN_PLATFORM_DOCK_EDITOR_EVENT = 'machina-open-dock-editor'

const ICON_BY_PATH: Record<string, LucideIcon> = {
  '/platform': LayoutDashboard,
  '/platform/vms': Monitor,
  '/platform/hosts': Server,
  '/platform/storage': HardDrive,
  '/platform/networks': Network,
  '/platform/events': Terminal,
  '/platform/activity': Activity,
  '/platform/reports': FileBarChart,
  '/platform/topology': GitBranch,
  '/platform/maintenance': Download,
  '/platform/notifications': Bell,
  '/platform/zeus': Sparkles,
  '/platform/settings': Settings,
}

const LABEL_BY_PATH: Record<string, string> = {
  '/platform/hosts': 'Machines',
  '/platform/vms': 'VMs',
  '/platform/storage': 'Storage',
  '/platform/networks': 'Network',
  '/platform/zeus': 'GPU',
  '/platform/events': 'Terminal',
  '/platform/activity': 'Activity',
  '/platform/reports': 'Reports',
  '/platform/topology': 'Topology',
  '/platform/maintenance': 'Updates',
  '/platform/notifications': 'Alerts',
}

/** Default pinned apps for the Machina platform dock (v9s MacDock pattern). */
export function defaultDockPathsForTier(tier: PlatformDesktopTier = loadPlatformDesktopTier()): string[] {
  return DOCK_PATHS_BY_TIER[tier]
}

export const DEFAULT_PLATFORM_DOCK_PATHS = defaultDockPathsForTier('advanced')

export const PLATFORM_SIDEBAR_FLAT = PLATFORM_SIDEBAR.flatMap((s) =>
  s.items.map((item) => ({ path: item.to, label: item.label })),
)

function itemForPath(path: string): PlatformDockItem | null {
  const flat = PLATFORM_SIDEBAR_FLAT.find((i) => i.path === path)
  const Icon = ICON_BY_PATH[path] ?? Monitor
  const label = LABEL_BY_PATH[path] ?? flat?.label
  if (label) return { path, label, icon: Icon }
  if (path in ICON_BY_PATH) {
    return { path, label: path.split('/').pop() ?? path, icon: Icon }
  }
  return null
}

export function loadPlatformDockItems(): PlatformDockItem[] {
  const tier = loadPlatformDesktopTier()
  try {
    const raw = localStorage.getItem(DOCK_KEY)
    if (raw) {
      const paths = JSON.parse(raw) as string[]
      if (Array.isArray(paths)) {
        const allowed = paths.filter((p) => isPathAllowedForTier(p, tier))
        const items = allowed.map(itemForPath).filter(Boolean) as PlatformDockItem[]
        if (items.length) return items
      }
    }
  } catch {
    /* ignore */
  }
  return defaultDockPathsForTier(tier).map(itemForPath).filter(Boolean) as PlatformDockItem[]
}

export function loadPlatformDockPaths(): string[] {
  return loadPlatformDockItems().map((i) => i.path)
}

export function savePlatformDockPaths(paths: string[]) {
  localStorage.setItem(DOCK_KEY, JSON.stringify(paths))
  window.dispatchEvent(new CustomEvent(PLATFORM_DOCK_CHANGED_EVENT))
}

export function resetPlatformDockPaths(tier: PlatformDesktopTier = loadPlatformDesktopTier()) {
  savePlatformDockPaths(defaultDockPathsForTier(tier))
}

export function openPlatformDockEditor() {
  window.dispatchEvent(new CustomEvent(OPEN_PLATFORM_DOCK_EDITOR_EVENT))
}

export function usePlatformDockItems(): PlatformDockItem[] {
  const [items, setItems] = useState(loadPlatformDockItems)
  useEffect(() => {
    const refresh = () => setItems(loadPlatformDockItems())
    window.addEventListener(PLATFORM_DOCK_CHANGED_EVENT, refresh)
    window.addEventListener(PLATFORM_DESKTOP_TIER_EVENT, refresh)
    return () => {
      window.removeEventListener(PLATFORM_DOCK_CHANGED_EVENT, refresh)
      window.removeEventListener(PLATFORM_DESKTOP_TIER_EVENT, refresh)
    }
  }, [])
  return items
}

/** @deprecated use loadPlatformDockItems */
export const PLATFORM_DOCK_ITEMS = loadPlatformDockItems()
