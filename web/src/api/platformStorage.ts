// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export interface StoragePool {
  id: string
  name: string
  storage_class: string
  backend: string
  path?: string | null
  capacity_gib: number
  used_gib: number
  tier_id?: string | null
}

export interface StorageTierOverview {
  id: string
  name: string
  tier_class: string
  iops_tier: string
  replication: string
  snapshot_retention_days: number
  backup_rpo_hours: number
  description: string
  pool_count: number
  capacity_gib: number
  used_gib: number
}

export interface StorageTiersOverview {
  tiers: StorageTierOverview[]
  summary: string
}

export interface StorageBackupSla {
  id: string
  pool_id: string
  pool_name: string
  tier_name?: string | null
  rpo_hours: number
  rto_hours: number
  retention_days: number
  last_backup_at?: string | null
  compliance_grade: string
}

export interface StorageBackupSlaOverview {
  policies: StorageBackupSla[]
  summary: string
}

export type StoragePoolBackend = 'directory' | 'nfs' | 'lvm' | 'ceph' | 'iscsi' | 'zfs'

export const listStoragePools = () => platformFetch<StoragePool[]>('/api/v1/storage/pools')

export const createStoragePool = (body: {
  name: string
  storage_class?: string
  backend?: string
  path?: string
  capacity_gib?: number
}) =>
  platformFetch<StoragePool>('/api/v1/storage/pools', { method: 'POST', body: JSON.stringify(body) })

export const deleteStoragePool = (id: string) => platformFetch(`/api/v1/storage/pools/${id}`, { method: 'DELETE' })

export const discoverStoragePools = () =>
  platformFetch<{ imported: number; pools: StoragePool[] }>('/api/v1/storage/pools/discover', {
    method: 'POST',
    body: '{}',
  })

export const getStorageTiersOverview = () =>
  platformFetch<StorageTiersOverview>('/api/v1/storage/tiers/overview')

export const bindStoragePoolTier = (poolId: string, tierId: string) =>
  platformFetch(`/api/v1/storage/pools/${poolId}/tier/${tierId}`, { method: 'POST', body: '{}' })

export const getStorageBackupSla = () =>
  platformFetch<StorageBackupSlaOverview>('/api/v1/storage/backup-sla')

export const upsertStorageBackupSla = (poolId: string, body: { rpo_hours: number; rto_hours: number; retention_days: number }) =>
  platformFetch<StorageBackupSla>(`/api/v1/storage/pools/${poolId}/backup-sla`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const getStorageSnapshotPolicy = (poolId: string) =>
  platformFetch<{ pool_name: string; snapshot_retention_days: number; summary: string }>(
    `/api/v1/storage/pools/${poolId}/snapshot-policy`,
  )

export const patchStoragePool = (id: string, body: { path?: string; capacity_gib?: number }) =>
  platformFetch<StoragePool>(`/api/v1/storage/pools/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
