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
  existing_disk?: string
  firmware?: string
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
export const getVM = (name: string) => apiGet<VmDetails>(`${API}/vms/${encodeURIComponent(name)}`)
export const getVMXml = (name: string) => apiGet<string>(`${API}/vms/${encodeURIComponent(name)}/xml`)
export const createVM = (req: CreateVmRequest) => apiPost<unknown>(`${API}/vms`, req)
export const deleteVM = (name: string) => apiDelete(`${API}/vms/${encodeURIComponent(name)}`)
export const startVM = (name: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/start`)
export const stopVM = (name: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/stop`)
export const shutdownVM = (name: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/shutdown`)
export const rebootVM = (name: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/reboot`)
export const pauseVM = (name: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/pause`)
export const resumeVM = (name: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/resume`)
export const cloneVM = (name: string, newName: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/clone`, { new_name: newName })
export const setAutostart = (name: string, enabled: boolean) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/autostart/${enabled}`)
export const setVcpus = (name: string, count: number) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/vcpus/${count}`)
export const setMemory = (name: string, mb: number) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/memory/${mb}`)
export const renameVM = (name: string, newName: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/rename`, { new_name: newName })
export const getMetrics = () => apiGet<VmMetrics[]>(`${API}/metrics`)
export const getVMMetrics = (name: string) => apiGet<VmMetrics>(`${API}/metrics/${encodeURIComponent(name)}`)
export const getTemplates = () => apiGet<VmTemplate[]>(`${API}/templates`)

export interface GuestIpAddress {
  name: string
  mac: string
  ip_type: string
  address: string
  prefix: number
}

export interface BootConfig {
  boot_devices: string[]
  firmware: string
  secure_boot: boolean
  kernel?: string
  initrd?: string
  cmdline?: string
}

export interface ManagedSaveStatus {
  name: string
  has_managed_save: boolean
}

export const getInterfaces = (name: string) => apiGet<GuestIpAddress[]>(`${API}/vms/${encodeURIComponent(name)}/interfaces`)
export const getHostname = (name: string) => apiGet<{ hostname: string }>(`${API}/vms/${encodeURIComponent(name)}/hostname`)
export const insertCdrom = (name: string, isoPath: string, target: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/cdrom/insert`, { iso_path: isoPath, target })
export const ejectCdrom = (name: string, target: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/cdrom/eject/${encodeURIComponent(target)}`)
export const managedSave = (name: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/managed-save`)
export const managedSaveRemove = (name: string) => apiDelete(`${API}/vms/${encodeURIComponent(name)}/managed-save`)
export const hasManagedSave = (name: string) => apiGet<ManagedSaveStatus>(`${API}/vms/${encodeURIComponent(name)}/managed-save/status`)
export const getBootConfig = (name: string) => apiGet<BootConfig>(`${API}/vms/${encodeURIComponent(name)}/boot`)
export const setBootOrder = (name: string, devices: string[]) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/boot`, { devices })
export const migrateVM = (name: string, destUri: string, live: boolean) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/migrate`, { dest_uri: destUri, live })
export const setMemoryBalloon = (name: string, mb: number) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/balloon/${mb}`)
export const resizeDisk = (name: string, target: string, sizeGb: number) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/disk/resize/${encodeURIComponent(target)}`, { size_gb: sizeGb })
export const attachInterface = (name: string, network: string, model: string = 'virtio') => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/nic/attach`, { network, model })
export const detachInterface = (name: string, mac: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/nic/detach/${encodeURIComponent(mac)}`)
