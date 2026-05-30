// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

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

export type PlatformDockItem = {
  path: string
  label: string
  icon: LucideIcon
}

/** Pinned apps for the Machina platform dock (v9s MacDock pattern). */
export const PLATFORM_DOCK_ITEMS: PlatformDockItem[] = [
  { path: '/platform', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/platform/vms', label: 'Finder', icon: Monitor },
  { path: '/platform/hosts', label: 'Hosts', icon: Server },
  { path: '/platform/activity', label: 'Activity Monitor', icon: Activity },
  { path: '/platform/backups', label: 'Time Machine', icon: Archive },
  { path: '/platform/blueprints', label: 'Shortcuts', icon: Workflow },
  { path: '/platform/projects', label: 'Stage Manager', icon: LayoutGrid },
  { path: '/platform/zeus', label: 'Zeus OS', icon: Sparkles },
  { path: '/platform/settings', label: 'Settings', icon: Settings },
]
