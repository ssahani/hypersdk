// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type ClassicToolCard = {
  id: string
  title: string
  description: string
  href: string
  /** Shown on host detail quick links */
  hostContext?: boolean
}

/** Classic Machina daemon UI routes bridged from Platform Integrations and host detail. */
export const CLASSIC_TOOL_CARDS: ClassicToolCard[] = [
  {
    id: 'vms',
    title: 'Libvirt VMs',
    description: 'Classic virtual machine list — power, console, snapshots, and libvirt actions.',
    href: '/vms',
  },
  {
    id: 'import',
    title: 'Import VM',
    description: 'OVF/OVA, VMDK, and disk import wizard — same flow as classic Machina.',
    href: '/import',
  },
  {
    id: 'node',
    title: 'Node & libvirt',
    description: 'Hypervisor node info, XML, and libvirt connection details.',
    href: '/node',
    hostContext: true,
  },
  {
    id: 'devices',
    title: 'PCI / USB devices',
    description: 'Host-attached devices available for VM passthrough.',
    href: '/devices',
    hostContext: true,
  },
  {
    id: 'capabilities',
    title: 'Capabilities',
    description: 'CPU features, NUMA, and libvirt capability matrix.',
    href: '/capabilities',
    hostContext: true,
  },
  {
    id: 'host-networking',
    title: 'Host networking',
    description: 'Bridges, routes, and physical interfaces on the daemon host.',
    href: '/host-networking',
    hostContext: true,
  },
  {
    id: 'host-ssh',
    title: 'Host SSH',
    description: 'Browser terminal to the hypervisor shell.',
    href: '/host-ssh',
    hostContext: true,
  },
  {
    id: 'nwfilters',
    title: 'Network filters',
    description: 'Libvirt NWFilter definitions for anti-spoofing and QoS.',
    href: '/nwfilters',
  },
  {
    id: 'secrets',
    title: 'Secrets vault',
    description: 'Libvirt secret store for iSCO/CEPH credentials.',
    href: '/secrets',
  },
  {
    id: 'audit',
    title: 'Audit log (classic)',
    description: 'Full NDJSON audit export and classic audit viewer.',
    href: '/audit',
  },
  {
    id: 'system-check',
    title: 'System check',
    description: 'Daemon health suite — libvirt, storage, network smoke tests.',
    href: '/system-check',
    hostContext: true,
  },
  {
    id: 'backups-classic',
    title: 'Classic backups',
    description: 'Legacy backup jobs UI with per-VM restore points.',
    href: '/backups',
  },
  {
    id: 'marketplace',
    title: 'Templates & plugins',
    description: 'Golden images and marketplace plugins (also in Platform → Templates).',
    href: '/platform/templates?tab=plugins',
  },
]

export function hostClassicTools(): ClassicToolCard[] {
  return CLASSIC_TOOL_CARDS.filter((c) => c.hostContext)
}
