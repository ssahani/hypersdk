import { apiGet, apiPost, apiPostVoid, apiDelete } from './client'
import { VmTemplate } from './vm'

const API = '/api/v1'

export interface ImageFile {
  path: string
  name: string
  size_bytes: number
  format: string
}

/** ISO / disk browse API: discovered files plus directories scanned (libvirt pools + defaults). */
export interface BrowseFilesResponse {
  files: ImageFile[]
  scan_directories: string[]
}

export interface BrowseDirEntry {
  name: string
  path: string
  is_directory: boolean
  size_bytes: number
}

export interface BrowseDirResponse {
  path: string
  parent: string | null
  entries: BrowseDirEntry[]
  roots: string[]
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
export const listIsos = () => apiGet<BrowseFilesResponse>(`${API}/browse/isos`)
/** List one directory under allowed hypervisor roots (pools + /home, /media, …). Pass empty path to start at the first root. */
export const browseDir = (path = '') =>
  apiGet<BrowseDirResponse>(`${API}/browse/dir?path=${encodeURIComponent(path)}`)
export const listDiskImages = () => apiGet<BrowseFilesResponse>(`${API}/browse/disks`)
export const deleteDiskImage = (path: string) =>
  apiDelete(`${API}/browse/disks/delete?path=${encodeURIComponent(path)}`)

export interface VirtBuilderTemplateRow {
  name: string
  summary?: string | null
  arch?: string | null
  size?: string | null
}

/** Response from `virt-builder --list --list-format json` (with plain-list fallback). Cached ~5 minutes on the daemon unless `refresh`. */
export interface VirtBuilderListResponse {
  /** When false, virt-builder APIs are disabled in daemon config. */
  virt_builder_allowed?: boolean
  /** Whether `virt-builder --version` succeeds on the host. */
  virt_builder_installed?: boolean
  /** First line of `virt-builder --version` (diagnostics). */
  virt_builder_version?: string | null
  /** Populated when the catalog could not be loaded (or feature is off / binary missing). */
  catalog_error?: string | null
  format_version: number
  items: VirtBuilderTemplateRow[]
  templates: string[]
  cached?: boolean
  cache_age_secs?: number | null
  source_uri?: string | null
}

/** Allowed absolute path prefixes for virt-image-build / new qcow2 output (pool targets + defaults). */
export const getVirtImageOutputRoots = () =>
  apiGet<{ allowed_prefixes: string[]; effective_tmpdir: string }>(`${API}/browse/virt-image-output-roots`)

export const listVirtBuilderTemplates = (opts?: { refresh?: boolean }) => {
  const q = opts?.refresh ? '?refresh=true' : ''
  return apiGet<VirtBuilderListResponse>(`${API}/browse/virt-builder${q}`)
}

/** Lightweight check: name format + optional presence in server catalog cache. */
export const probeVirtBuilderTemplate = (template: string) =>
  apiGet<{
    virt_builder_allowed: boolean
    name_valid: boolean
    in_cached_catalog: boolean
    hint?: string | null
  }>(`${API}/browse/virt-builder/probe/${encodeURIComponent(template.trim())}`)

/** Request body for POST /browse/virt-image-build (daemon runs `virt-image-build` / `virt-builder` on the host). */
export interface VirtImageBuildRequest {
  os: string
  /** Absolute path; file must not exist; parent under allowed image dirs. */
  output: string
  size?: string
  format?: string
  hostname?: string
  install?: string
  run_command?: string[]
  copy_in?: string[]
  firstboot_script?: string | null
  root_password_file?: string | null
  root_password_inline?: string | null
  ssh_pubkey_file?: string | null
  ssh_pubkey_inline?: string | null
  update?: boolean
  selinux_relabel?: boolean
  extra_virt_builder_args?: string[]
}

export const buildVirtImageDisk = (body: VirtImageBuildRequest) =>
  apiPost<{ status: string; path: string }>(`${API}/browse/virt-image-build`, body)

export const getVirtBuilderNotes = (template: string) =>
  apiGet<{ template: string; notes: string }>(
    `${API}/browse/virt-builder/notes/${encodeURIComponent(template)}`
  )

/** mkosi workspace directories discovered under /var/lib/virtspawn/mkosi-defs/ etc. */
export interface MkosiWorkspace {
  path: string
  name: string
  /** Sub-images in an mkosi image tree (subdirs containing mkosi.conf). */
  images: string[]
}

export const listMkosiWorkspaces = () => apiGet<MkosiWorkspace[]>(`${API}/browse/mkosi-workspaces`)

// USB
export const listUsbDevices = () => apiGet<UsbDevice[]>(`${API}/host/usb`)
export const attachUsb = (vm: string, vendor_id: string, product_id: string) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(vm)}/usb/attach`, { vendor_id, product_id })
export const detachUsb = (vm: string, vendor_id: string, product_id: string) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(vm)}/usb/detach`, { vendor_id, product_id })

// Cloud-init
export const generateCloudInit = (hostname: string, username: string, password: string, ssh_key: string) =>
  apiPost<{ status: string; path: string }>(`${API}/cloud-init`, { hostname, username, password, ssh_key })

// Import
export const importDisk = (source: string, dest_name: string) =>
  apiPost<{ status: string; path: string }>(`${API}/import/disk`, { source, dest_name })

// Live resize
export const liveSetVcpus = (vm: string, count: number) => apiPostVoid(`${API}/vms/${encodeURIComponent(vm)}/live/vcpus/${count}`)
export const liveSetMemory = (vm: string, mb: number) => apiPostVoid(`${API}/vms/${encodeURIComponent(vm)}/live/memory/${mb}`)

// Audit
export const getAuditLog = () => apiGet<AuditEvent[]>(`${API}/audit`)

// Tags
export const getVmTags = (vm: string) => apiGet<{ tags: string[] }>(`${API}/vms/${encodeURIComponent(vm)}/tags`)
export const setVmTags = (vm: string, tags: string[]) =>
  apiPost<{ status: string; name: string; tags: string[] }>(`${API}/vms/${encodeURIComponent(vm)}/tags`, { tags })
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

/** Per-mount usage from `df` (Linux hypervisor). */
export interface HostFilesystem {
  source: string
  fstype: string
  mount_point: string
  size_bytes: number
  used_bytes: number
  avail_bytes: number
  use_percent: number
}

export const getHostFilesystems = () => apiGet<HostFilesystem[]>(`${API}/host/filesystems`)

/** Top processes by resident memory (Linux `ps`). */
export interface HostProcess {
  pid: number
  user: string
  cpu_percent: number
  rss_kb: number
  command: string
  /** Full argv from `/proc/pid/cmdline` when present (Linux). */
  args?: string
}

export const getHostTopProcesses = (limit = 20) =>
  apiGet<HostProcess[]>(`${API}/host/processes?limit=${encodeURIComponent(String(limit))}`)

/** Distro-specific read-only update probe (apt/dnf/yum/pacman/zypper). */
export interface PackageUpdateCheck {
  backend: string
  probed: boolean
  pending_count: number | null
  summary: string | null
  hint: string | null
  error: string | null
}

export const getHostPackageUpdates = () => apiGet<PackageUpdateCheck>(`${API}/host/package-updates`)

export interface NetDevCounter {
  iface: string
  rx_bytes: number
  rx_packets: number
  tx_bytes: number
  tx_packets: number
}

export const getHostNetCounters = () => apiGet<NetDevCounter[]>(`${API}/host/net-counters`)

export interface NetDevRate {
  iface: string
  rx_bytes_per_sec: number
  tx_bytes_per_sec: number
  rx_packets_per_sec: number
  tx_packets_per_sec: number
}

export interface NetDevRatesResponse {
  sample_interval_ms: number
  interfaces: NetDevRate[]
}

/** Two `/proc/net/dev` samples; blocks ~interval_ms on the server. */
export const getHostNetRates = (intervalMs = 1000) =>
  apiGet<NetDevRatesResponse>(
    `${API}/host/net-rates?interval_ms=${encodeURIComponent(String(Math.min(5000, Math.max(50, intervalMs))))}`,
  )

export interface PasswdEntry {
  username: string
  uid: number
  gid: number
  gecos: string
  home: string
  shell: string
  system_account: boolean
}

export const getHostPasswdUsers = (limit = 150) =>
  apiGet<PasswdEntry[]>(`${API}/host/passwd-users?limit=${encodeURIComponent(String(limit))}`)

export interface GroupEntry {
  name: string
  gid: number
  members: string[]
}

export const getHostGroups = (limit = 150) =>
  apiGet<GroupEntry[]>(`${API}/host/groups?limit=${encodeURIComponent(String(limit))}`)

export interface HostSecuritySummary {
  network_backend: string
  firewall_backend: string
  ufw_status_line: string | null
  firewalld_default_zone: string | null
}

export const getHostSecuritySummary = () => apiGet<HostSecuritySummary>(`${API}/host/security-summary`)

// Save as template
export const saveVmAsTemplate = (vm: string, templateName: string) =>
  apiPost<{ status: string }>(`${API}/vms/${encodeURIComponent(vm)}/save-template`, { template_name: templateName })

// List saved templates
export const listSavedTemplates = () => apiGet<VmTemplate[]>(`${API}/templates/saved`)

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
  apiPost<{ status: string }>(`${API}/services/${encodeURIComponent(name)}/${encodeURIComponent(action)}`)

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
  product_name: string
  sys_vendor: string
  bios_version: string
  bios_date: string
  board_name: string
  serial_number: string
  cpu_model: string
  virtualization: string
}
export const getSystemInfo = () => apiGet<SystemInfo>(`${API}/host/system-info`)
export const setHostname = (hostname: string) => apiPost<{ status: string }>(`${API}/host/hostname`, { hostname })
export const setTimezone = (timezone: string) => apiPost<{ status: string }>(`${API}/host/timezone`, { timezone })
