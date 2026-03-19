import { apiGet, apiPost, apiPostVoid, apiDelete } from './client'

const API = '/api/v1'

export interface VmInfo {
  name: string
  state: string
  vcpus: number
  memory_mb: number
}

export interface VmDetails {
  name: string
  uuid: string
  state: string
  vcpus: number
  memory_mb: number
  os_type: string
  arch: string
  autostart: boolean
  persistent: boolean
  interfaces: InterfaceInfo[]
  disks: DiskInfo[]
}

export interface InterfaceInfo {
  mac_address: string
  source: string
  model: string
}

export interface DiskInfo {
  device: string
  source: string
  driver: string
  target: string
}

export interface VmMetrics {
  name: string
  cpu_time_ns: number
  vcpus: number
  memory_total_mb: number
  memory_used_mb: number
  memory_pct: number
  disk_rd_bytes: number
  disk_wr_bytes: number
  net_rx_bytes: number
  net_tx_bytes: number
}

export interface CreateVmRequest {
  name: string
  vcpus: number
  memory_mb: number
  disk_gb: number
  iso?: string
  network?: string
  os_variant?: string
}

export interface VmTemplate {
  name: string
  description: string
  vcpus: number
  memory_mb: number
  disk_gb: number
  os_variant: string
}

export const listVMs = () => apiGet<VmInfo[]>(`${API}/vms`)
export const getVM = (name: string) => apiGet<VmDetails>(`${API}/vms/${name}`)
export const getVMXml = (name: string) => apiGet<string>(`${API}/vms/${name}/xml`)
export const createVM = (req: CreateVmRequest) => apiPost<unknown>(`${API}/vms`, req)
export const deleteVM = (name: string) => apiDelete(`${API}/vms/${name}`)
export const startVM = (name: string) => apiPostVoid(`${API}/vms/${name}/start`)
export const stopVM = (name: string) => apiPostVoid(`${API}/vms/${name}/stop`)
export const shutdownVM = (name: string) => apiPostVoid(`${API}/vms/${name}/shutdown`)
export const rebootVM = (name: string) => apiPostVoid(`${API}/vms/${name}/reboot`)
export const pauseVM = (name: string) => apiPostVoid(`${API}/vms/${name}/pause`)
export const resumeVM = (name: string) => apiPostVoid(`${API}/vms/${name}/resume`)
export const cloneVM = (name: string, newName: string) => apiPostVoid(`${API}/vms/${name}/clone`, { new_name: newName })
export const setAutostart = (name: string, enabled: boolean) => apiPostVoid(`${API}/vms/${name}/autostart/${enabled}`)
export const setVcpus = (name: string, count: number) => apiPostVoid(`${API}/vms/${name}/vcpus/${count}`)
export const setMemory = (name: string, mb: number) => apiPostVoid(`${API}/vms/${name}/memory/${mb}`)
export const renameVM = (name: string, newName: string) => apiPostVoid(`${API}/vms/${name}/rename`, { new_name: newName })
export const getMetrics = () => apiGet<VmMetrics[]>(`${API}/metrics`)
export const getVMMetrics = (name: string) => apiGet<VmMetrics>(`${API}/metrics/${name}`)
export const getTemplates = () => apiGet<VmTemplate[]>(`${API}/templates`)
