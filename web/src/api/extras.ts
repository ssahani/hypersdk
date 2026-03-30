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
