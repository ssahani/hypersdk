// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ClusterSummary, PlatformHost } from '../api/platform'

const GENERIC_CLUSTER_NAMES = new Set(['default', 'cluster', 'production', 'production cluster'])

export function isGenericClusterName(name?: string | null): boolean {
  const normalized = name?.trim().toLowerCase()
  if (!normalized) return true
  return GENERIC_CLUSTER_NAMES.has(normalized)
}

export function isPlaceholderHostname(hostname?: string | null): boolean {
  const h = hostname?.trim().toLowerCase()
  return !h || h === 'localhost' || h === '127.0.0.1'
}

export function isUsableHostAddress(address?: string | null): boolean {
  const a = address?.trim()
  return !!a && a !== '127.0.0.1' && a !== '::1'
}

/** Human-friendly host label for cards, VM detail, and fleet titles. */
export function formatPlatformHostLabel(
  host: Pick<PlatformHost, 'hostname' | 'address'> | null | undefined,
): string {
  if (!host) return 'No host'
  const hostname = host.hostname?.trim()
  const address = host.address?.trim()
  const placeholder = isPlaceholderHostname(hostname)
  const usableAddr = isUsableHostAddress(address)

  if (placeholder && usableAddr) return address!
  if (!placeholder && usableAddr && hostname !== address) return `${hostname} · ${address}`
  if (!placeholder) return hostname!
  if (usableAddr) return address!
  return hostname || address || 'Unknown host'
}

/** Prefer a meaningful cluster name; fall back to primary host identity for single-node fleets. */
export function formatFleetDisplayTitle(
  cluster: Pick<ClusterSummary, 'name'> | null | undefined,
  hosts: Pick<PlatformHost, 'hostname' | 'address' | 'state'>[],
): string {
  const clusterName = cluster?.name?.trim()
  if (clusterName && !isGenericClusterName(clusterName)) {
    return clusterName
  }

  const sorted = [...hosts].sort((a, b) => {
    const aOffline = a.state === 'offline' ? 1 : 0
    const bOffline = b.state === 'offline' ? 1 : 0
    return aOffline - bOffline
  })

  if (sorted.length === 1) {
    return formatPlatformHostLabel(sorted[0])
  }
  if (sorted.length > 1) {
    return `${formatPlatformHostLabel(sorted[0])} · ${sorted.length} hosts`
  }

  return clusterName || 'Machina fleet'
}
