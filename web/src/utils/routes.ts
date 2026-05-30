// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Home, Server, Plus, Upload, Network, HardDrive, Camera, Shield, Archive, Globe,
  Cpu, Activity, MonitorCog, Usb, Cog, ScrollText, FileText, Key, Users, Database, Terminal,
  ClipboardList,
  Boxes,
  Package,
  Cloud,
  Stethoscope,
  Layers,
  Webhook,
  CalendarClock,
  Bell,
  Settings,
  BookOpen,
} from 'lucide-react'

export interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  /** If true, only show in nav when signed in as UNIX `root`. */
  requiresRoot?: boolean
  /** If true, only show when OpenStack is enabled and configured on the daemon. */
  requiresOpenStack?: boolean
  /** Show only while OpenStack is not wired — links to Settings for setup. */
  openstackSetupOnly?: boolean
  /** If true, only show when HyperSDK is enabled on the daemon. */
  requiresHypersdk?: boolean
}

/** OpenStack credentials present in daemon config (may still be unreachable). */
export function isOpenStackConfigured(
  openstack: { enabled?: boolean; configured?: boolean } | undefined,
): boolean {
  return Boolean(openstack?.enabled && openstack?.configured)
}

/** @deprecated Use isOpenStackConfigured — nav visibility; operational UI gates on phase === live. */
export const isOpenStackNavEnabled = isOpenStackConfigured

/** Match nav item href against current location (supports /openstack prefix + settings query). */
export function navItemActive(
  item: NavItem,
  pathname: string,
  search: string,
): boolean {
  const [path, query] = item.to.split('?')
  if (query) {
    if (pathname !== path) return false
    const params = new URLSearchParams(query)
    for (const [k, v] of params.entries()) {
      if (new URLSearchParams(search).get(k) !== v) return false
    }
    return true
  }
  if (path === '/openstack') {
    return pathname === '/openstack'
  }
  if (path.startsWith('/openstack/')) {
    return pathname === path || pathname.startsWith(`${path}/`)
  }
  return pathname === path
}

export function navGroupHasActive(
  group: NavGroup,
  pathname: string,
  search: string,
  username: string,
  openstackReady: boolean,
  hypersdkEnabled = false,
): boolean {
  return navDropdownSections(group).some((section) =>
    section.items.some(
      (item) =>
        navItemVisible(item, username, openstackReady, hypersdkEnabled) &&
        navItemActive(item, pathname, search),
    ),
  )
}

export function navItemVisible(
  item: NavItem,
  username: string,
  openstackReady: boolean,
  hypersdkEnabled = false,
): boolean {
  if (item.requiresRoot && username !== 'root') return false
  if (item.requiresOpenStack && !openstackReady) return false
  if (item.openstackSetupOnly && openstackReady) return false
  if (item.requiresHypersdk && !hypersdkEnabled) return false
  return true
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export interface NavGroup {
  /** Full name (tooltips, mobile drawer, aria). */
  label: string
  /** Top-bar icon trigger (v9s-style icon cluster). */
  barIcon: LucideIcon
  items: NavItem[]
  /** When set, desktop nav renders a sectioned dropdown instead of a flat list. */
  sections?: NavSection[]
  /** Tall menus scroll inside the panel (long groups). */
  menuScroll?: boolean
}

/** Sections for dropdown / mobile drawer (single section when `items` only). */
export function navDropdownSections(group: NavGroup): NavSection[] {
  if (group.sections?.length) return group.sections
  if (group.items.length) return [{ label: '', items: group.items }]
  return []
}

/** Flatten group items (sections or top-level items). */
export function navGroupItems(group: NavGroup): NavItem[] {
  return navDropdownSections(group).flatMap((s) => s.items)
}

/** Always-visible toolbar shortcuts beside the main nav icons. */
export const TOP_BAR_QUICK_LINKS: NavItem[] = [
  { to: '/settings', icon: React.createElement(Settings, { className: 'w-4 h-4' }), label: 'Settings' },
  { to: '/host-ssh', icon: React.createElement(Terminal, { className: 'w-4 h-4' }), label: 'Host SSH' },
  { to: '/api-docs', icon: React.createElement(BookOpen, { className: 'w-4 h-4' }), label: 'API Docs' },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Core',
    barIcon: Home,
    items: [
      { to: '/', icon: React.createElement(Home, { className: 'w-4 h-4' }), label: 'Dashboard' },
      { to: '/vms', icon: React.createElement(Server, { className: 'w-4 h-4' }), label: 'Virtual Machines' },
      { to: '/create', icon: React.createElement(Plus, { className: 'w-4 h-4' }), label: 'Create VM' },
      { to: '/import', icon: React.createElement(Upload, { className: 'w-4 h-4' }), label: 'Import VM' },
      {
        to: '/fleet',
        icon: React.createElement(Server, { className: 'w-4 h-4' }),
        label: 'Fleet',
      },
    ],
  },
  {
    label: 'Platform',
    barIcon: Cloud,
    items: [],
    menuScroll: true,
    sections: [
      {
        label: 'Overview',
        items: [
          { to: '/platform', icon: React.createElement(Cloud, { className: 'w-4 h-4' }), label: 'Dashboard' },
          { to: '/platform/vms', icon: React.createElement(MonitorCog, { className: 'w-4 h-4' }), label: 'Virtual Machines' },
          { to: '/platform/applications', icon: React.createElement(Boxes, { className: 'w-4 h-4' }), label: 'Applications' },
          { to: '/platform/hosts', icon: React.createElement(Server, { className: 'w-4 h-4' }), label: 'Hosts' },
        ],
      },
      {
        label: 'Resources',
        items: [
          { to: '/platform/storage', icon: React.createElement(HardDrive, { className: 'w-4 h-4' }), label: 'Disk Utility' },
          { to: '/platform/networks', icon: React.createElement(Network, { className: 'w-4 h-4' }), label: 'Networks' },
          { to: '/platform/content', icon: React.createElement(Package, { className: 'w-4 h-4' }), label: 'Images & ISOs' },
          { to: '/platform/templates', icon: React.createElement(Layers, { className: 'w-4 h-4' }), label: 'Templates' },
        ],
      },
      {
        label: 'Operations',
        items: [
          { to: '/platform/migration', icon: React.createElement(Upload, { className: 'w-4 h-4' }), label: 'Migration Assistant' },
          { to: '/platform/backups', icon: React.createElement(Archive, { className: 'w-4 h-4' }), label: 'Backup & Restore' },
          { to: '/platform/tasks', icon: React.createElement(ClipboardList, { className: 'w-4 h-4' }), label: 'Tasks' },
          { to: '/platform/notifications', icon: React.createElement(Bell, { className: 'w-4 h-4' }), label: 'Alerts' },
          { to: '/platform/activity', icon: React.createElement(Activity, { className: 'w-4 h-4' }), label: 'Activity Monitor' },
          { to: '/platform/recommendations', icon: React.createElement(BookOpen, { className: 'w-4 h-4' }), label: 'Recommendations' },
        ],
      },
      {
        label: 'Administration',
        items: [
          { to: '/platform/settings', icon: React.createElement(Settings, { className: 'w-4 h-4' }), label: 'Settings' },
          { to: '/platform/users', icon: React.createElement(Users, { className: 'w-4 h-4' }), label: 'Users & Access' },
          { to: '/platform/projects', icon: React.createElement(Boxes, { className: 'w-4 h-4' }), label: 'Workspaces' },
          { to: '/platform/enroll', icon: React.createElement(Key, { className: 'w-4 h-4' }), label: 'Add Host' },
          { to: '/platform/events', icon: React.createElement(ScrollText, { className: 'w-4 h-4' }), label: 'Console' },
        ],
      },
    ],
  },
  {
    label: 'Infrastructure',
    barIcon: Layers,
    items: [],
    menuScroll: true,
    sections: [
      {
        label: 'Storage',
        items: [
          { to: '/storage', icon: React.createElement(HardDrive, { className: 'w-4 h-4' }), label: 'Storage Pools' },
          { to: '/disk-images', icon: React.createElement(Database, { className: 'w-4 h-4' }), label: 'Disk Images' },
          { to: '/snapshots', icon: React.createElement(Camera, { className: 'w-4 h-4' }), label: 'Snapshots' },
          { to: '/backups', icon: React.createElement(Archive, { className: 'w-4 h-4' }), label: 'Backups' },
        ],
      },
      {
        label: 'Network',
        items: [
          { to: '/networks', icon: React.createElement(Network, { className: 'w-4 h-4' }), label: 'Networks' },
          { to: '/nwfilters', icon: React.createElement(Shield, { className: 'w-4 h-4' }), label: 'Network Filters' },
          { to: '/host-networking', icon: React.createElement(Globe, { className: 'w-4 h-4' }), label: 'Host Networking' },
          { to: '/secrets', icon: React.createElement(Key, { className: 'w-4 h-4' }), label: 'Secrets' },
        ],
      },
      {
        label: 'Kubernetes',
        items: [
          { to: '/k8s', icon: React.createElement(Boxes, { className: 'w-4 h-4' }), label: 'Kubernetes' },
          { to: '/k8s/workloads', icon: React.createElement(Boxes, { className: 'w-4 h-4' }), label: 'K8s Workloads' },
          { to: '/k8s/kata', icon: React.createElement(Package, { className: 'w-4 h-4' }), label: 'Kata + Cloud Hypervisor' },
          { to: '/host-ssh', icon: React.createElement(Terminal, { className: 'w-4 h-4' }), label: 'Host SSH' },
        ],
      },
    ],
  },
  {
    label: 'OpenStack',
    barIcon: Boxes,
    items: [
      {
        to: '/settings?openstack=1',
        icon: React.createElement(Cloud, { className: 'w-4 h-4' }),
        label: 'Wire OpenStack',
        openstackSetupOnly: true,
      },
      { to: '/openstack', icon: React.createElement(Cloud, { className: 'w-4 h-4' }), label: 'Overview' },
      { to: '/openstack/instances', icon: React.createElement(Server, { className: 'w-4 h-4' }), label: 'Instances' },
      { to: '/openstack/images', icon: React.createElement(HardDrive, { className: 'w-4 h-4' }), label: 'Glance Images' },
      { to: '/openstack/create', icon: React.createElement(Plus, { className: 'w-4 h-4' }), label: 'Create Instance' },
      { to: '/openstack/migrations', icon: React.createElement(Cloud, { className: 'w-4 h-4' }), label: 'Migrations', requiresHypersdk: true },
    ],
  },
  {
    label: 'Monitoring',
    barIcon: Activity,
    items: [],
    menuScroll: true,
    sections: [
      {
        label: 'Host',
        items: [
          { to: '/node', icon: React.createElement(Cpu, { className: 'w-4 h-4' }), label: 'Host overview' },
          { to: '/events', icon: React.createElement(Activity, { className: 'w-4 h-4' }), label: 'Live Metrics' },
          { to: '/system-check', icon: React.createElement(Stethoscope, { className: 'w-4 h-4' }), label: 'System Check' },
          { to: '/capabilities', icon: React.createElement(MonitorCog, { className: 'w-4 h-4' }), label: 'Capabilities' },
          { to: '/devices', icon: React.createElement(Usb, { className: 'w-4 h-4' }), label: 'Node Devices' },
          { to: '/services', icon: React.createElement(Cog, { className: 'w-4 h-4' }), label: 'Services' },
        ],
      },
      {
        label: 'Operations',
        items: [
          { to: '/jobs', icon: React.createElement(ClipboardList, { className: 'w-4 h-4' }), label: 'Jobs' },
          { to: '/logs', icon: React.createElement(ScrollText, { className: 'w-4 h-4' }), label: 'System Logs' },
          { to: '/audit', icon: React.createElement(FileText, { className: 'w-4 h-4' }), label: 'Audit Log' },
          { to: '/admin/sessions', icon: React.createElement(Users, { className: 'w-4 h-4' }), label: 'Web sessions', requiresRoot: true },
        ],
      },
    ],
  },
]

export const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/vms': 'Virtual Machines',
  '/create': 'Create VM',
  '/networks': 'Networks',
  '/storage': 'Storage',
  '/snapshots': 'Snapshots',
  '/node': 'Host overview',
  '/events': 'Live Metrics',
  '/system-check': 'System Check',
  '/jobs': 'Jobs',
  '/capabilities': 'Capabilities',
  '/devices': 'Node Devices',
  '/nwfilters': 'Network Filters',
  '/secrets': 'Secrets',
  '/backups': 'Backups',
  '/host-networking': 'Host Networking',
  '/host-ssh': 'Host SSH',
  '/k8s': 'Kubernetes',
  '/k8s/workloads': 'K8s Workloads',
  '/k8s/kata': 'Kata Containers',
  '/openstack': 'OpenStack',
  '/openstack/instances': 'OpenStack Instances',
  '/openstack/instances/:id': 'OpenStack Instance',
  '/openstack/create': 'Create OpenStack Instance',
  '/openstack/images': 'OpenStack Images',
  '/openstack/migrations': 'OpenStack Migrations',
  '/audit': 'Audit Log',
  '/import': 'Import VM',
  '/api-docs': 'API Docs',
  '/services': 'Services',
  '/logs': 'System Logs',
  '/settings': 'Settings',
  '/admin/sessions': 'Web sessions',
  '/console': 'Console',
  '/platform': 'Zyvor Platform',
  '/platform/vms': 'Virtual Machines',
  '/platform/applications': 'Applications',
  '/platform/hosts': 'Hosts',
  '/platform/content': 'Images & ISOs',
  '/platform/templates': 'Templates',
  '/platform/migration': 'Migration Assistant',
  '/platform/backups': 'Backup & Restore',
  '/platform/activity': 'Activity Monitor',
  '/platform/recommendations': 'Recommendations',
  '/platform/enroll': 'Add Host',
  '/platform/placement': 'Disaster Recovery',
  '/platform/storage': 'Disk Utility',
  '/platform/networks': 'Networks',
  '/platform/tasks': 'Tasks',
  '/platform/events': 'Console',
  '/platform/reports': 'Reports',
  '/platform/projects': 'Workspaces',
  '/platform/notifications': 'Alerts',
  '/platform/settings': 'Settings',
  '/platform/users': 'Users & Access',
  '/platform/api-keys': 'API Keys',
  '/platform/webhooks': 'Webhooks',
  '/platform/maintenance': 'Maintenance',
}
