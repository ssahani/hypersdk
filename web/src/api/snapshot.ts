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
export const createSnapshot = (vm: string, name: string, description: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(vm)}/snapshots`, { name, description })
export const deleteSnapshot = (vm: string, snap: string) => apiDelete(`${API}/vms/${encodeURIComponent(vm)}/snapshots/${encodeURIComponent(snap)}`)
export const revertSnapshot = (vm: string, snap: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(vm)}/snapshots/${encodeURIComponent(snap)}/revert`)
