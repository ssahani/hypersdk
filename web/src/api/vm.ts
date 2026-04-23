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
  /** Libvirt VNC listen IP (default 127.0.0.1). Use 0.0.0.0 for all interfaces (hyper2kvm-style). */
  graphics_listen?: string
  /** `vnc` (noVNC) or `spice` (spice-html5). */
  graphics_type?: string
  /** Second CD-ROM: cloud-init / seed ISO (install ISO stays in `iso`). */
  cloud_init_iso?: string
  /** Saved template key under `/var/lib/virtspawn/templates/` (server merges + optional golden disk). */
  saved_template?: string
  /** With saved template + `base_image`: `backing` (default) or `copy`. */
  template_disk_mode?: string
  /** `libvirt_xml` | `virt_install` | omit for server default from config. */
  create_backend?: string
  /** Legacy: libguestfs `virt-builder` template name. Server default is **disabled** (`[libvirt] virt_builder_allowed`); prefer `mkosi_workspace`. */
  virt_builder_os?: string
  virt_builder_hostname?: string
  virt_builder_ssh_pubkey?: string
  /** Absolute path on the **host** to a small file (≤4KiB) with the guest root password; passed as `virt-builder --root-password file:…`. */
  virt_builder_root_password_file?: string
  virt_builder_packages?: string[]
  virt_builder_firstboot_commands?: string[]
  virt_builder_selinux_relabel?: boolean
  virt_builder_post_customize_install?: string[]
  virt_builder_post_customize_run?: string[]
  virt_builder_sysprep?: boolean
  /** Preferred: absolute directory with `mkosi.conf`; runs `mkosi build`. Mutually exclusive with `virt_builder_os`. */
  mkosi_workspace?: string
  /** For multi-image mkosi workspaces (image trees): selects one image via `--image <name>`. */
  mkosi_image?: string
}

export interface VmTemplate {
  name: string
  description: string
  vcpus: number
  memory_mb: number
  disk_gb: number
  os_variant: string
  /** Present on saved templates: golden qcow2 for backing-file clones. */
  base_image?: string | null
  template_disk_mode?: string
}

export const listVMs = () => apiGet<VmInfo[]>(`${API}/vms`)
export const getVM = (name: string) => apiGet<VmDetails>(`${API}/vms/${encodeURIComponent(name)}`)
export const getVMXml = (name: string) => apiGet<string>(`${API}/vms/${encodeURIComponent(name)}/xml`)
export const createVM = (req: CreateVmRequest) => apiPost<unknown>(`${API}/vms`, req)
/** Optional `virDomainUndefineFlags` query params for `DELETE /vms/{name}`. */
export interface VmDeleteUndefineOpts {
  undefine_managed_save?: boolean
  undefine_snapshots_metadata?: boolean
  undefine_nvram?: boolean
  undefine_keep_nvram?: boolean
  undefine_checkpoints_metadata?: boolean
  undefine_tpm?: boolean
  undefine_keep_tpm?: boolean
  /** Also remove backing disk image files from the host filesystem. */
  delete_disks?: boolean
}

function deleteVmQuery(opts?: VmDeleteUndefineOpts): string {
  if (!opts) return ''
  const p = new URLSearchParams()
  const set = (k: keyof VmDeleteUndefineOpts) => {
    if (opts![k]) p.set(k, 'true')
  }
  set('undefine_managed_save')
  set('undefine_snapshots_metadata')
  set('undefine_nvram')
  set('undefine_keep_nvram')
  set('undefine_checkpoints_metadata')
  set('undefine_tpm')
  set('undefine_keep_tpm')
  set('delete_disks')
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const deleteVM = (name: string, undefine?: VmDeleteUndefineOpts) =>
  apiDelete(`${API}/vms/${encodeURIComponent(name)}${deleteVmQuery(undefine)}`)

/** Response from `GET /api/v1/vms/{name}/guacamole-auth` when `[guacamole]` is enabled on the daemon. */
export interface GuacamoleAuthResponse {
  vm: string
  protocol: string
  target_host: string
  target_port: number
  guac_data: string
  token?: string
}

/** Optional Apache Guacamole encrypted JSON auth; requires server config `[guacamole]`. */
export const getGuacamoleAuth = (name: string) =>
  apiGet<GuacamoleAuthResponse>(`${API}/vms/${encodeURIComponent(name)}/guacamole-auth`)

export interface BlockJobInfo {
  job_type: number
  bandwidth: number
  cur: number
  end: number
}

export const getBlockJobInfo = (name: string, disk: string, bandwidthBytes = false) =>
  apiGet<{ name: string; job: BlockJobInfo | null }>(
    `${API}/vms/${encodeURIComponent(name)}/block/job?disk=${encodeURIComponent(disk)}${bandwidthBytes ? '&bandwidth_bytes=true' : ''}`
  )

export const blockCommit = (
  name: string,
  body: {
    disk: string
    base?: string | null
    top?: string | null
    bandwidth?: number
    shallow?: boolean
    delete?: boolean
    active?: boolean
    relative?: boolean
    bandwidth_bytes?: boolean
  }
) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/block/commit`, body)

export const blockPull = (name: string, body: { disk: string; bandwidth?: number; bandwidth_bytes?: boolean }) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/block/pull`, body)

export const blockJobAbort = (name: string, body: { disk: string; async?: boolean; pivot?: boolean }) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/block/job/abort`, body)

export const setMemTune = (name: string, body: MemTuneInfo) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/memtune`, body)

export const setSchedulerTune = (
  name: string,
  body: { cpu_shares?: number; vcpu_period?: number; vcpu_quota?: number }
) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/scheduler`, body)

export const pinVcpu = (name: string, vcpu: number, cpus: boolean[]) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/vcpu/${vcpu}/pin`, { cpus })
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
export const getVMLogs = (name: string, lines = 500) =>
  apiGet<{ vm_name: string; log_path: string; content: string }>(`${API}/vms/${encodeURIComponent(name)}/logs?lines=${lines}`)

export interface CpuTuneInfo { shares?: number; period?: number; quota?: number; vcpupin: { vcpu: number; cpuset: string }[] }
export interface MemTuneInfo { hard_limit_kb?: number; soft_limit_kb?: number; swap_hard_limit_kb?: number }
export const getCpuTune = (name: string) => apiGet<CpuTuneInfo>(`${API}/vms/${encodeURIComponent(name)}/cputune`)
export const getMemTune = (name: string) => apiGet<MemTuneInfo>(`${API}/vms/${encodeURIComponent(name)}/memtune`)
