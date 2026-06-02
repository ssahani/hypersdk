// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ReactNode } from 'react'

export type ZeusHubGroup = {
  label: string
  subtitle?: string
  tiles: ZeusHubTile[]
}

export type ZeusHubTile = {
  id: string
  label: string
  description: string
  to: string
  tab?: 'fleet' | 'security' | 'knowledge' | 'services' | 'baremetal' | 'brain'
}

export const ZEUS_HUB_GROUPS: ZeusHubGroup[] = [
  {
    label: 'Fleet intelligence',
    subtitle: 'Heat maps, rebalance, Linux health, and service fabric',
    tiles: [
      { id: 'fleet', label: 'Fleet AI', description: 'Heat map · rebalance · diagnose', to: '/platform/zeus', tab: 'fleet' },
      { id: 'brain', label: 'Graph Brain', description: 'VM ↔ network path analysis', to: '/platform/zeus', tab: 'brain' },
      { id: 'services', label: 'Service fabric', description: 'Dependencies and blast radius', to: '/platform/zeus', tab: 'services' },
      { id: 'baremetal', label: 'Bare Metal', description: 'BMC inventory and PXE', to: '/platform/zeus', tab: 'baremetal' },
    ],
  },
  {
    label: 'Security & knowledge',
    subtitle: 'Threat graph, compliance, and runbooks',
    tiles: [
      { id: 'security-center', label: 'Security Center', description: 'Threat hunting and enforcement', to: '/platform/zeus/security' },
      { id: 'firewall', label: 'Zeus Firewall', description: 'Host firewall posture and policy', to: '/platform/zeus/security/firewall' },
      { id: 'security-tab', label: 'Attack paths', description: 'Graph analysis inside Zeus OS', to: '/platform/zeus', tab: 'security' },
      { id: 'knowledge', label: 'Knowledge engine', description: 'Runbooks and NL search', to: '/platform/zeus', tab: 'knowledge' },
    ],
  },
  {
    label: 'Mission tools',
    subtitle: 'Desktop-wide fleet views',
    tiles: [
      { id: 'mission', label: 'Mission Control', description: 'Infrastructure Earth and inventory', to: '/mission-control' },
      { id: 'topology', label: 'Digital Twin', description: 'Topology and service graph', to: '/platform/topology' },
      { id: 'rightsizing', label: 'Rightsizing', description: 'FinOps VM recommendations', to: '/platform/zeus/rightsizing' },
      { id: 'incidents', label: 'Incidents', description: 'War room for active outages', to: '/platform/zeus/incidents' },
      { id: 'operations', label: 'Operations hub', description: 'Tasks, alerts, and lifecycle', to: '/platform/operations' },
    ],
  },
]

/** Map tab query to launchpad icon name for PlatformMacUi gradients. */
export function zeusTileIconName(tile: ZeusHubTile): string {
  return tile.label
}

export type ZeusHubTileRender = ZeusHubTile & { icon: ReactNode }
