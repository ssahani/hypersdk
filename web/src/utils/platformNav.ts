// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import React from 'react'
import {
  LayoutDashboard,
  Monitor,
  Boxes,
  Server,
  HardDrive,
  Network,
  Package,
  Layers,
  ArrowRightLeft,
  Archive,
  Shield,
  ClipboardList,
  Bell,
  Activity,
  Workflow,
  Users,
  FileBarChart,
  Settings,
  LifeBuoy,
  Key,
  Cpu,
  GitBranch,
  ShieldAlert,
} from 'lucide-react'

export interface PlatformNavItem {
  to: string
  label: string
  icon: React.ReactNode
}

export interface PlatformNavSection {
  label: string
  items: PlatformNavItem[]
}

const ic = (Icon: React.ComponentType<{ className?: string }>) =>
  React.createElement(Icon, { className: 'w-4 h-4' })

/** Finder-like sidebar for the platform control center. */
export const PLATFORM_SIDEBAR: PlatformNavSection[] = [
  {
    label: 'Overview',
    items: [
      { to: '/platform', label: 'Dashboard', icon: ic(LayoutDashboard) },
      { to: '/platform/vms', label: 'Virtual Machines', icon: ic(Monitor) },
      { to: '/platform/applications', label: 'Applications', icon: ic(Boxes) },
      { to: '/platform/hosts', label: 'Hosts', icon: ic(Server) },
    ],
  },
  {
    label: 'Resources',
    items: [
      { to: '/platform/storage', label: 'Storage', icon: ic(HardDrive) },
      { to: '/platform/networks', label: 'Networks', icon: ic(Network) },
      { to: '/platform/content', label: 'Images & ISOs', icon: ic(Package) },
      { to: '/platform/templates', label: 'Templates', icon: ic(Layers) },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/platform/migration', label: 'Migration Assistant', icon: ic(ArrowRightLeft) },
      { to: '/platform/backups', label: 'Backup & Restore', icon: ic(Archive) },
      { to: '/platform/placement', label: 'Disaster Recovery', icon: ic(Shield) },
      { to: '/platform/tasks', label: 'Tasks', icon: ic(ClipboardList) },
      { to: '/platform/notifications', label: 'Alerts', icon: ic(Bell) },
      { to: '/platform/activity', label: 'Activity Monitor', icon: ic(Activity) },
      { to: '/platform/recommendations', label: 'Recommendations', icon: ic(Workflow) },
      { to: '/platform/blueprints', label: 'Blueprints', icon: ic(Workflow) },
      { to: '/platform/zeus', label: 'Machina Zeus OS', icon: ic(Cpu) },
      { to: '/platform/zeus/security/firewall', label: 'Zeus Firewall', icon: ic(ShieldAlert) },
      { to: '/platform/topology', label: 'Topology', icon: ic(GitBranch) },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/platform/users', label: 'Users & Access', icon: ic(Users) },
      { to: '/platform/projects', label: 'Workspaces', icon: ic(Boxes) },
      { to: '/platform/reports', label: 'Reports', icon: ic(FileBarChart) },
      { to: '/platform/support', label: 'Support', icon: ic(LifeBuoy) },
      { to: '/platform/settings', label: 'Settings', icon: ic(Settings) },
      { to: '/platform/enroll', label: 'Add Host', icon: ic(Key) },
      { to: '/platform/events', label: 'Logs & Audit', icon: ic(LifeBuoy) },
    ],
  },
]

export const PLATFORM_PAGE_LABELS: Record<string, string> = {
  '/platform': 'Dashboard',
  '/platform/vms': 'Virtual Machines',
  '/platform/applications': 'Applications',
  '/platform/hosts': 'Hosts',
  '/platform/storage': 'Storage',
  '/platform/networks': 'Networks',
  '/platform/content': 'Images & ISOs',
  '/platform/templates': 'Templates',
  '/platform/migration': 'Migration Assistant',
  '/platform/backups': 'Backup & Restore',
  '/platform/placement': 'Disaster Recovery',
  '/platform/tasks': 'Tasks',
  '/platform/notifications': 'Alerts',
  '/platform/activity': 'Activity Monitor',
  '/platform/recommendations': 'Recommendations',
  '/platform/blueprints': 'Blueprints',
  '/platform/zeus': 'Machina Zeus OS',
  '/platform/zeus/security/firewall': 'Zeus Firewall',
  '/platform/zeus/security/ports': 'Open Ports',
  '/platform/zeus/security/services': 'Allowed Apps',
  '/platform/zeus/security/activity': 'Firewall Activity',
  '/platform/zeus/security/compliance': 'Firewall Compliance',
  '/platform/topology': 'Topology',
  '/platform/users': 'Users & Access',
  '/platform/projects': 'Workspaces',
  '/platform/reports': 'Reports',
  '/platform/support': 'Support',
  '/platform/settings': 'Settings',
  '/platform/enroll': 'Add Host',
  '/platform/events': 'Logs & Audit',
}
