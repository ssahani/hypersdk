import React from 'react'
import {
  Home, Server, Plus, Upload, Network, HardDrive, Camera, Shield, Archive, Globe,
  Cpu, Activity, MonitorCog, Usb, Cog, ScrollText, FileText, Key, Users,
} from 'lucide-react'

export interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  /** If true, only show in nav when signed in as UNIX `root`. */
  requiresRoot?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { to: '/', icon: React.createElement(Home, { className: 'w-4 h-4' }), label: 'Dashboard' },
      { to: '/vms', icon: React.createElement(Server, { className: 'w-4 h-4' }), label: 'Virtual Machines' },
      { to: '/create', icon: React.createElement(Plus, { className: 'w-4 h-4' }), label: 'Create VM' },
      { to: '/import', icon: React.createElement(Upload, { className: 'w-4 h-4' }), label: 'Import VM' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/networks', icon: React.createElement(Network, { className: 'w-4 h-4' }), label: 'Networks' },
      { to: '/storage', icon: React.createElement(HardDrive, { className: 'w-4 h-4' }), label: 'Storage' },
      { to: '/snapshots', icon: React.createElement(Camera, { className: 'w-4 h-4' }), label: 'Snapshots' },
      { to: '/nwfilters', icon: React.createElement(Shield, { className: 'w-4 h-4' }), label: 'Network Filters' },
      { to: '/secrets', icon: React.createElement(Key, { className: 'w-4 h-4' }), label: 'Secrets' },
      { to: '/backups', icon: React.createElement(Archive, { className: 'w-4 h-4' }), label: 'Backups' },
      { to: '/host-networking', icon: React.createElement(Globe, { className: 'w-4 h-4' }), label: 'Host Networking' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/node', icon: React.createElement(Cpu, { className: 'w-4 h-4' }), label: 'Host Info' },
      { to: '/events', icon: React.createElement(Activity, { className: 'w-4 h-4' }), label: 'Live Metrics' },
      { to: '/capabilities', icon: React.createElement(MonitorCog, { className: 'w-4 h-4' }), label: 'Capabilities' },
      { to: '/devices', icon: React.createElement(Usb, { className: 'w-4 h-4' }), label: 'Node Devices' },
      { to: '/services', icon: React.createElement(Cog, { className: 'w-4 h-4' }), label: 'Services' },
      { to: '/logs', icon: React.createElement(ScrollText, { className: 'w-4 h-4' }), label: 'System Logs' },
      { to: '/audit', icon: React.createElement(FileText, { className: 'w-4 h-4' }), label: 'Audit Log' },
      { to: '/api-docs', icon: React.createElement(FileText, { className: 'w-4 h-4' }), label: 'API Docs' },
      { to: '/admin/sessions', icon: React.createElement(Users, { className: 'w-4 h-4' }), label: 'Web sessions', requiresRoot: true },
      { to: '/settings', icon: React.createElement(Shield, { className: 'w-4 h-4' }), label: 'Settings' },
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
  '/node': 'Host Info',
  '/events': 'Live Metrics',
  '/capabilities': 'Capabilities',
  '/devices': 'Node Devices',
  '/nwfilters': 'Network Filters',
  '/secrets': 'Secrets',
  '/backups': 'Backups',
  '/host-networking': 'Host Networking',
  '/audit': 'Audit Log',
  '/import': 'Import VM',
  '/api-docs': 'API Docs',
  '/services': 'Services',
  '/logs': 'System Logs',
  '/settings': 'Settings',
  '/admin/sessions': 'Web sessions',
  '/console': 'Console',
}
