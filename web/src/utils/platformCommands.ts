// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import {
  discoverPlatformNetworks,
  discoverStoragePools,
  listPlatformHosts,
  syncAllHosts,
} from '../api/platform'

export type PlatformCommandId =
  | 'import-networks'
  | 'import-storage'
  | 'sync-hosts'
  | 'create-vm'
  | 'show-offline-hosts'

export interface PlatformCommand {
  id: PlatformCommandId
  label: string
  review: string
  vmName?: string
  prefill?: { name?: string; os?: string; size?: string; network?: string }
}

const VERB_PATTERNS: { re: RegExp; id: PlatformCommandId; label: string; review: (m: RegExpMatchArray, hosts: number) => string }[] = [
  {
    re: /^>?import\s+networks?$/i,
    id: 'import-networks',
    label: 'Import networks',
    review: (_, n) => `This will import libvirt networks from ${n || 'online'} host(s).`,
  },
  {
    re: /^>?import\s+storage$/i,
    id: 'import-storage',
    label: 'Import storage',
    review: (_, n) => `This will discover storage pools from ${n || 'online'} host(s).`,
  },
  {
    re: /^>?sync\s+hosts?$/i,
    id: 'sync-hosts',
    label: 'Sync hosts',
    review: () => 'This will queue inventory sync for all enrolled hypervisors.',
  },
  {
    re: /^>?create\s+vm\s+(.+)$/i,
    id: 'create-vm',
    label: 'Create VM',
    review: (m) => `Open the VM wizard with name "${m[1]?.trim()}".`,
  },
  {
    re: /^>?show\s+offline\s+hosts?$/i,
    id: 'show-offline-hosts',
    label: 'Show offline hosts',
    review: () => 'Navigate to Hosts and filter to offline hypervisors.',
  },
]

export function parsePlatformCommand(raw: string, onlineHostCount = 0): PlatformCommand | null {
  const q = raw.trim()
  if (!q) return null
  const isCommand = q.startsWith('>') || /^(import|sync|create|show)\b/i.test(q)
  if (!isCommand) return null

  for (const p of VERB_PATTERNS) {
    const m = q.match(p.re)
    if (m) {
      return {
        id: p.id,
        label: p.label,
        review: p.review(m, onlineHostCount),
        vmName: p.id === 'create-vm' ? m[1]?.trim() : undefined,
      }
    }
  }
  return null
}

export async function executePlatformCommand(cmd: PlatformCommand): Promise<{ message: string; navigate?: string }> {
  switch (cmd.id) {
    case 'import-networks': {
      const r = await discoverPlatformNetworks()
      return { message: `Imported networks — ${r.networks.length} total in inventory` }
    }
    case 'import-storage': {
      const r = await discoverStoragePools()
      return { message: `Imported storage — ${r.pools.length} pool(s) in inventory` }
    }
    case 'sync-hosts': {
      await syncAllHosts()
      return { message: 'Host sync queued for all hypervisors' }
    }
    case 'create-vm': {
      const params = new URLSearchParams()
      const name = cmd.prefill?.name ?? cmd.vmName
      if (name) params.set('create', name)
      if (cmd.prefill?.os) params.set('os', cmd.prefill.os)
      if (cmd.prefill?.size) params.set('size', cmd.prefill.size)
      if (cmd.prefill?.network) params.set('network', cmd.prefill.network)
      const qs = params.toString()
      return {
        message: `Opening VM wizard${name ? ` for ${name}` : ''}`,
        navigate: qs ? `/platform/vms?${qs}` : '/platform/vms',
      }
    }
    case 'show-offline-hosts': {
      const hosts = await listPlatformHosts()
      const offline = hosts.filter((h) => h.state === 'offline').length
      return {
        message: offline ? `${offline} offline host(s)` : 'No offline hosts',
        navigate: '/platform/hosts?filter=offline',
      }
    }
    default:
      return { message: 'Unknown command' }
  }
}

export function platformCommandSuggestions(onlineHostCount: number): PlatformCommand[] {
  const n = onlineHostCount
  return [
    { id: 'import-networks', label: 'import networks', review: `Import libvirt networks from ${n} online host(s)` },
    { id: 'import-storage', label: 'import storage', review: `Discover storage pools from ${n} online host(s)` },
    { id: 'sync-hosts', label: 'sync hosts', review: 'Queue inventory sync for all hosts' },
    { id: 'create-vm', label: 'create vm NAME', review: 'Open wizard with a pre-filled VM name' },
    { id: 'show-offline-hosts', label: 'show offline hosts', review: 'Go to Hosts filtered to offline' },
  ]
}
