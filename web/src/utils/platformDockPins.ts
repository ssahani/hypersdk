// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Archive,
  LayoutDashboard,
  LayoutGrid,
  Monitor,
  Server,
  Settings,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { PLATFORM_SIDEBAR } from './platformNav'

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
  '/platform/activity': Activity,
  '/platform/backups': Archive,
  '/platform/blueprints': Workflow,
  '/platform/projects': LayoutGrid,
  '/platform/zeus': Sparkles,
  '/platform/settings': Settings,
}

/** Default pinned apps for the Machina platform dock (v9s MacDock pattern). */
export const DEFAULT_PLATFORM_DOCK_PATHS = [
  '/platform',
  '/platform/vms',
  '/platform/hosts',
  '/platform/activity',
  '/platform/backups',
  '/platform/blueprints',
  '/platform/projects',
  '/platform/zeus',
  '/platform/settings',
]

export const PLATFORM_SIDEBAR_FLAT = PLATFORM_SIDEBAR.flatMap((s) =>
  s.items.map((item) => ({ path: item.to, label: item.label })),
)

function itemForPath(path: string): PlatformDockItem | null {
  const flat = PLATFORM_SIDEBAR_FLAT.find((i) => i.path === path)
  const Icon = ICON_BY_PATH[path] ?? Monitor
  if (flat) return { path, label: flat.label, icon: Icon }
  if (path in ICON_BY_PATH) {
    return { path, label: path.split('/').pop() ?? path, icon: Icon }
  }
  return null
}

export function loadPlatformDockItems(): PlatformDockItem[] {
  try {
    const raw = localStorage.getItem(DOCK_KEY)
    if (raw) {
      const paths = JSON.parse(raw) as string[]
      if (Array.isArray(paths)) {
        const items = paths.map(itemForPath).filter(Boolean) as PlatformDockItem[]
        if (items.length) return items
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PLATFORM_DOCK_PATHS.map(itemForPath).filter(Boolean) as PlatformDockItem[]
}

export function loadPlatformDockPaths(): string[] {
  return loadPlatformDockItems().map((i) => i.path)
}

export function savePlatformDockPaths(paths: string[]) {
  localStorage.setItem(DOCK_KEY, JSON.stringify(paths))
  window.dispatchEvent(new CustomEvent(PLATFORM_DOCK_CHANGED_EVENT))
}

export function resetPlatformDockPaths() {
  savePlatformDockPaths(DEFAULT_PLATFORM_DOCK_PATHS)
}

export function openPlatformDockEditor() {
  window.dispatchEvent(new CustomEvent(OPEN_PLATFORM_DOCK_EDITOR_EVENT))
}

export function usePlatformDockItems(): PlatformDockItem[] {
  const [items, setItems] = useState(loadPlatformDockItems)
  useEffect(() => {
    const refresh = () => setItems(loadPlatformDockItems())
    window.addEventListener(PLATFORM_DOCK_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(PLATFORM_DOCK_CHANGED_EVENT, refresh)
  }, [])
  return items
}

/** @deprecated use loadPlatformDockItems */
export const PLATFORM_DOCK_ITEMS = loadPlatformDockItems()
