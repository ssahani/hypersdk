import { apiGet, apiPost, apiPostVoid } from './client'

const API = '/api/v1'

export interface ImageFile {
  path: string
  name: string
  size_bytes: number
  format: string
}

export interface UsbDevice {
  bus: string
  device: string
  vendor_id: string
  product_id: string
  description: string
}

export interface AuditEvent {
  timestamp: string
  action: string
  target: string
  result: string
}

// ISO/Disk browser
export const listIsos = () => apiGet<ImageFile[]>(`${API}/browse/isos`)
export const listDiskImages = () => apiGet<ImageFile[]>(`${API}/browse/disks`)

// USB
export const listUsbDevices = () => apiGet<UsbDevice[]>(`${API}/host/usb`)
export const attachUsb = (vm: string, vendor_id: string, product_id: string) =>
  apiPostVoid(`${API}/vms/${vm}/usb/attach`, { vendor_id, product_id })
export const detachUsb = (vm: string, vendor_id: string, product_id: string) =>
  apiPostVoid(`${API}/vms/${vm}/usb/detach`, { vendor_id, product_id })

// Cloud-init
export const generateCloudInit = (hostname: string, username: string, password: string, ssh_key: string) =>
  apiPost<{ status: string; path: string }>(`${API}/cloud-init`, { hostname, username, password, ssh_key })

// Import
export const importDisk = (source: string, dest_name: string) =>
  apiPost<{ status: string; path: string }>(`${API}/import/disk`, { source, dest_name })

// Live resize
export const liveSetVcpus = (vm: string, count: number) => apiPostVoid(`${API}/vms/${vm}/live/vcpus/${count}`)
export const liveSetMemory = (vm: string, mb: number) => apiPostVoid(`${API}/vms/${vm}/live/memory/${mb}`)

// Audit
export const getAuditLog = () => apiGet<AuditEvent[]>(`${API}/audit`)

// Tags
export const getVmTags = (vm: string) => apiGet<{ tags: string[] }>(`${API}/vms/${vm}/tags`)
export const setVmTags = (vm: string, tags: string[]) =>
  apiPost<{ status: string; name: string; tags: string[] }>(`${API}/vms/${vm}/tags`, { tags })
export const getAllTags = () => apiGet<Record<string, number>>(`${API}/tags`)

// DHCP leases
export interface DhcpLease {
  network: string
  mac: string
  ip: string
  hostname: string
  expiry: string
}
export const listDhcpLeases = () => apiGet<DhcpLease[]>(`${API}/dhcp-leases`)

// Host stats
export interface HostStats {
  cpu_percent: number
  memory_total_mb: number
  memory_used_mb: number
  memory_percent: number
  swap_total_mb: number
  swap_used_mb: number
  disk_total_gb: number
  disk_used_gb: number
  disk_percent: number
  load_1: number
  load_5: number
  load_15: number
  uptime_secs: number
  processes: number
}
export const getHostStats = () => apiGet<HostStats>(`${API}/host/stats`)

// Save as template
export const saveVmAsTemplate = (vm: string, templateName: string) =>
  apiPost<{ status: string }>(`${API}/vms/${vm}/save-template`, { template_name: templateName })

// PCI
export interface PciDevice {
  slot: string
  class: string
  vendor: string
  device: string
  iommu_group: string
}
export const listPciDevices = () => apiGet<PciDevice[]>(`${API}/host/pci`)

// IOMMU Groups
export interface IommuDevice {
  bdf: string
  vendor: string
  device_name: string
}
export interface IommuGroup {
  group_id: number
  devices: IommuDevice[]
}
export const listIommuGroups = () => apiGet<IommuGroup[]>(`${API}/host/iommu-groups`)

// Systemd Services
export interface SystemdService {
  name: string
  description: string
  active_state: string
  sub_state: string
  enabled: string
}
export const listServices = () => apiGet<SystemdService[]>(`${API}/services`)
export const serviceAction = (name: string, action: string) =>
  apiPost<{ status: string }>(`${API}/services/${encodeURIComponent(name)}/${action}`)

// System Logs
export interface JournalEntry {
  timestamp: string
  unit: string
  priority: string
  message: string
}
export const getJournalLogs = (lines: number = 100, priority?: string, unit?: string) => {
  const params = new URLSearchParams({ lines: String(lines) })
  if (priority) params.set('priority', priority)
  if (unit) params.set('unit', unit)
  return apiGet<JournalEntry[]>(`${API}/logs?${params.toString()}`)
}

// Host Shutdown/Reboot
export const hostShutdown = () => apiPost<{ status: string }>(`${API}/host/shutdown`)
export const hostReboot = () => apiPost<{ status: string }>(`${API}/host/reboot`)

// System Info
export interface SystemInfo {
  hostname: string
  timezone: string
  kernel_version: string
  os_name: string
  os_version: string
  os_pretty_name: string
}
export const getSystemInfo = () => apiGet<SystemInfo>(`${API}/host/system-info`)
export const setHostname = (hostname: string) => apiPost<{ status: string }>(`${API}/host/hostname`, { hostname })
export const setTimezone = (timezone: string) => apiPost<{ status: string }>(`${API}/host/timezone`, { timezone })
