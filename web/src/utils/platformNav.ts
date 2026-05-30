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
  Download,
  Workflow,
  Users,
  FileBarChart,
  Settings,
  LifeBuoy,
  Key,
  Cpu,
  GitBranch,
  ShieldAlert,
  Code2,
  Gauge,
  LayoutGrid,
  Lock,
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
      { to: '/platform/integrations', label: 'Apps & Integrations', icon: ic(Boxes) },
    ],
  },
  {
    label: 'Resources',
    items: [
      { to: '/platform/storage', label: 'Disk Utility', icon: ic(HardDrive) },
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
      { to: '/platform/maintenance', label: 'Software Update', icon: ic(Download) },
      { to: '/platform/recommendations', label: 'Recommendations', icon: ic(Workflow) },
      { to: '/platform/blueprints', label: 'Shortcuts', icon: ic(Workflow) },
      { to: '/platform/zeus', label: 'Machina Zeus OS', icon: ic(Cpu) },
      { to: '/platform/zeus/security/firewall', label: 'Zeus Firewall', icon: ic(ShieldAlert) },
      { to: '/platform/zeus/security/policies', label: 'Policy Studio', icon: ic(ShieldAlert) },
      { to: '/platform/zeus/security/k8s', label: 'K8s Policies', icon: ic(ShieldAlert) },
      { to: '/platform/zeus/security/cloud', label: 'Cloud SGs', icon: ic(ShieldAlert) },
      { to: '/platform/zeus/security/connectivity', label: 'Connectivity', icon: ic(ShieldAlert) },
      { to: '/platform/topology', label: 'Topology', icon: ic(GitBranch) },
      { to: '/platform/observability', label: 'Observability', icon: ic(Gauge) },
    ],
  },
  {
    label: 'Developer',
    items: [
      { to: '/platform/developer', label: 'SDK & Terraform', icon: ic(Code2) },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/platform/users', label: 'Users & Groups', icon: ic(Users) },
      { to: '/platform/enterprise', label: 'Keychain', icon: ic(Lock) },
      { to: '/platform/projects', label: 'Stage Manager', icon: ic(LayoutGrid) },
      { to: '/platform/reports', label: 'Reports', icon: ic(FileBarChart) },
      { to: '/platform/policy', label: 'Policy & Quotas', icon: ic(Shield) },
      { to: '/platform/webhooks', label: 'Webhooks', icon: ic(Workflow) },
      { to: '/platform/api-keys', label: 'API Keys', icon: ic(Key) },
      { to: '/platform/support', label: 'Support', icon: ic(LifeBuoy) },
      { to: '/platform/settings', label: 'Settings', icon: ic(Settings) },
      { to: '/platform/enroll', label: 'Add Host', icon: ic(Key) },
      { to: '/platform/events', label: 'Console', icon: ic(LifeBuoy) },
    ],
  },
]

export const PLATFORM_PAGE_LABELS: Record<string, string> = {
  '/platform': 'Dashboard',
  '/platform/vms': 'Finder',
  '/platform/applications': 'Applications',
  '/platform/hosts': 'Hosts',
  '/platform/integrations': 'Apps & Integrations',
  '/platform/storage': 'Disk Utility',
  '/platform/networks': 'Networks',
  '/platform/content': 'Images & ISOs',
  '/platform/templates': 'Templates',
  '/platform/migration': 'Migration Assistant',
  '/platform/backups': 'Backup & Restore',
  '/platform/placement': 'Disaster Recovery',
  '/platform/tasks': 'Tasks',
  '/platform/notifications': 'Alerts',
  '/platform/activity': 'Activity Monitor',
  '/platform/maintenance': 'Software Update',
  '/platform/recommendations': 'Recommendations',
  '/platform/blueprints': 'Shortcuts',
  '/platform/zeus': 'Machina Zeus OS',
  '/platform/zeus/security/firewall': 'Zeus Firewall',
  '/platform/zeus/security/ports': 'Open Ports',
  '/platform/zeus/security/services': 'Allowed Apps',
  '/platform/zeus/security/activity': 'Firewall Activity',
  '/platform/zeus/security/compliance': 'Firewall Compliance',
  '/platform/zeus/security/k8s': 'K8s Firewall',
  '/platform/zeus/security/cloud': 'Cloud Security Groups',
  '/platform/zeus/security/connectivity': 'Connectivity Matrix',
  '/platform/topology': 'Topology',
  '/platform/observability': 'Observability',
  '/platform/developer': 'SDK & Terraform',
  '/platform/enterprise': 'Keychain',
  '/platform/users': 'Users & Groups',
  '/platform/projects': 'Stage Manager',
  '/platform/reports': 'Reports',
  '/platform/support': 'Support',
  '/platform/settings': 'Settings',
  '/platform/enroll': 'Add Host',
  '/platform/events': 'Console',
  '/platform/webhooks': 'Webhooks',
  '/platform/api-keys': 'API Keys',
  '/platform/policy': 'Policy & Quotas',
  '/platform/zeus/security/policies': 'Firewall Policies',
}
