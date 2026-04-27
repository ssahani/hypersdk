import { apiGet, apiPostVoid, apiDelete } from './client'

const API = '/api/v1'

export interface SnapshotInfo {
  name: string
  vm_name: string
  creation_time: number
  state: string
  description: string
  parent: string
  is_current: boolean
}

export const listAllSnapshots = () => apiGet<SnapshotInfo[]>(`${API}/snapshots`)
export const listSnapshots = (vm: string) => apiGet<SnapshotInfo[]>(`${API}/vms/${encodeURIComponent(vm)}/snapshots`)

export interface SnapshotDiskSpec {
  name: string
  snapshot?: 'no' | 'external' | 'internal' | 'manual' | string
  file?: string
  driver?: string
}

export interface CreateSnapshotRequest {
  name: string
  description?: string
  disk_only?: boolean
  storage_mode?: 'auto' | 'external' | 'internal' | string
  memory_snapshot?: 'internal' | 'external' | string
  memory_file?: string
  external_disk_dir?: string
  external_memory_dir?: string
  disks?: SnapshotDiskSpec[]
  atomic?: boolean
  reuse_external?: boolean
}

export const createSnapshot = (vm: string, body: CreateSnapshotRequest) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(vm)}/snapshots`, body)
export const deleteSnapshot = (vm: string, snap: string) => apiDelete(`${API}/vms/${encodeURIComponent(vm)}/snapshots/${encodeURIComponent(snap)}`)
export const revertSnapshot = (vm: string, snap: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(vm)}/snapshots/${encodeURIComponent(snap)}/revert`)
