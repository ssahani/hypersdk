import { apiGet, apiGetBlob, apiPost, apiPostVoid, apiDelete } from './client'

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
  bus?: string
  cache?: string
  readonly?: boolean
  shareable?: boolean
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
  /** Libvirt VNC listen IP (default 127.0.0.1). Use 0.0.0.0 for all interfaces (remote display; still use machina’s console proxy where applicable). */
  graphics_listen?: string
  /** `vnc` (noVNC) or `spice` (spice-html5). */
  graphics_type?: string
  /** Second CD-ROM: cloud-init / seed ISO (install ISO stays in `iso`). */
  cloud_init_iso?: string
  /** Saved template key under `/var/lib/machina/templates/` (server merges + optional golden disk). */
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
  /** `virt-install --print-xml=1` + define; halted shell (no install media). Requires virt_install backend. */
  virt_install_define_only?: boolean
  /** Network / kickstart tree: `virt-install --location …`. */
  virt_install_location?: string
  /** `virt-install --pxe` (extra NIC; network from `virt_install_pxe_network` or `network`). */
  virt_install_pxe?: boolean
  /** Libvirt network for the PXE interface (defaults to main `network`). */
  virt_install_pxe_network?: string
  /** `virt-install --install os=…` (libosinfo short id). */
  virt_install_install_os?: string
  /** `virt-install --extra-args`. */
  virt_install_extra_args?: string
  /** With `root_disk_storage_volume`: `virt-install --disk vol=pool/vol`. */
  root_disk_storage_pool?: string
  root_disk_storage_volume?: string
  /** `virt-install --check path_in_use=off`. */
  virt_install_path_in_use_check_off?: boolean
  /** New overlay root disk with `backing_store=` + `--import`. */
  virt_install_disk_backing_store?: string
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

/** CDI DataVolume (upload) + KubeVirt VM YAML; virtio-win CDROM via containerDisk (post-migrate driver disk pattern). */
export interface KubeVirtBundle {
  libvirt_vm: string
  libvirt_root_disk: string
  namespace: string
  virtual_machine_name: string
  datavolume_name: string
  /** PVC/DataVolume upload size (Gi) for virtctl and manifests. */
  upload_size_gi: number
  /** True when `[kubevirt] exec_enabled` — daemon may run kubectl/virtctl for this VM. */
  cluster_exec_enabled: boolean
  yaml: string
  virtctl_image_upload_example: string
}

/** JSON from `POST .../kubevirt/{apply,upload,start}` when the command finished (check `exit_code`). */
export interface KubeVirtClusterExecResult {
  exit_code: number
  stdout: string
  stderr: string
}

export type KubeVirtBundleQuery = {
  namespace?: string
  k8s_vm_name?: string
  datavolume_name?: string
  storage_gi?: number
  storage_class?: string
  /** Default true: attach virtio-win as containerDisk CDROM. */
  include_virtio_cdrom?: boolean
}

export function getKubeVirtBundle(name: string, q?: KubeVirtBundleQuery) {
  const p = new URLSearchParams()
  if (q?.namespace) p.set('namespace', q.namespace)
  if (q?.k8s_vm_name) p.set('k8s_vm_name', q.k8s_vm_name)
  if (q?.datavolume_name) p.set('datavolume_name', q.datavolume_name)
  if (q?.storage_gi != null) p.set('storage_gi', String(q.storage_gi))
  if (q?.storage_class) p.set('storage_class', q.storage_class)
  if (q?.include_virtio_cdrom === false) p.set('include_virtio_cdrom', 'false')
  const qs = p.toString()
  return apiGet<KubeVirtBundle>(
    `${API}/vms/${encodeURIComponent(name)}/kubevirt-bundle${qs ? `?${qs}` : ''}`,
  )
}

/** POST body for kubevirt apply/upload/start — same fields as `KubeVirtBundleQuery` (all optional). */
export type KubeVirtBundleBody = KubeVirtBundleQuery

export function postKubeVirtApply(name: string, body: KubeVirtBundleBody = {}) {
  return apiPost<KubeVirtClusterExecResult>(
    `${API}/vms/${encodeURIComponent(name)}/kubevirt/apply`,
    body,
  )
}

export function postKubeVirtUpload(name: string, body: KubeVirtBundleBody = {}) {
  return apiPost<KubeVirtClusterExecResult>(
    `${API}/vms/${encodeURIComponent(name)}/kubevirt/upload`,
    body,
  )
}

export function postKubeVirtStart(name: string, body: KubeVirtBundleBody = {}) {
  return apiPost<KubeVirtClusterExecResult>(
    `${API}/vms/${encodeURIComponent(name)}/kubevirt/start`,
    body,
  )
}
export const createVM = (req: CreateVmRequest) => apiPost<unknown>(`${API}/vms`, req)

export interface CreateVmStreamResult {
  status: string
  name: string
}

/** Create VM with live log lines (mkosi / virt-builder / virt-install / qemu-img) via SSE (`POST /vms/stream`). */
export async function createVMWithProgress(
  req: CreateVmRequest,
  onLogLine: (line: string) => void,
  onJobRegistered?: (job: { id: string }) => void,
): Promise<CreateVmStreamResult> {
  const res = await fetch(`${API}/vms/stream`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j?.error) msg = j.error
    } catch {
      /* keep text */
    }
    throw new Error(msg || res.statusText)
  }
  if (!res.body) throw new Error('No response body')
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    for (;;) {
      const idx = buf.indexOf('\n\n')
      if (idx < 0) break
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      let ev = 'message'
      const dataLines: string[] = []
      for (const ln of block.split('\n')) {
        if (ln.startsWith('event:')) ev = ln.slice(6).trim()
        else if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trimStart())
      }
      const data = dataLines.join('\n')
      if (ev === 'complete') {
        return JSON.parse(data) as CreateVmStreamResult
      }
      if (ev === 'error') {
        throw new Error(data || 'Create failed')
      }
      if (ev === 'job') {
        try {
          const j = JSON.parse(data) as { id?: string }
          if (j?.id) onJobRegistered?.({ id: j.id })
        } catch {
          /* ignore */
        }
        continue
      }
      if (data && data !== 'keepalive') onLogLine(data)
    }
  }
  throw new Error('Stream ended before VM was created')
}
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
export interface MigrateOptions {
  parameters?: { bandwidth?: number; bandwidth_postcopy?: number; parallel_connections?: number }
  extra_flags?: number
  unsafe_migrate?: boolean
  postcopy?: boolean
  undefine_source?: boolean
  tunnelled?: boolean
  paused?: boolean
}

export const migrateVM = (name: string, destUri: string, live: boolean, opts?: MigrateOptions) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/migrate`, {
    dest_uri: destUri,
    live,
    ...opts,
  })

export type GuestKeyPreset = 'ctrl_alt_del' | 'esc' | 'alt_tab'

export const sendGuestKey = (name: string, body: { preset?: GuestKeyPreset; keycodes?: number[]; holdtime_ms?: number }) =>
  apiPost(`${API}/vms/${encodeURIComponent(name)}/guest/send-key`, body)

export const getGuestScreenshotBlob = (name: string, screen = 0) =>
  apiGetBlob(`${API}/vms/${encodeURIComponent(name)}/guest/screenshot?screen=${screen}`)

export const setVmFirmware = (name: string, uefi: boolean) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/firmware`, { uefi })

export const attachVmTpm = (name: string) => apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/devices/tpm`)
export const detachVmTpm = (name: string) => apiDelete(`${API}/vms/${encodeURIComponent(name)}/devices/tpm`)

export const attachVmWatchdog = (name: string, model: string, action: string) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/devices/watchdog`, { model, action })

export const attachVmSound = (name: string, model: string) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/devices/sound`, { model })

export const attachVmSerial = (name: string, port: number) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/devices/serial`, { port })

export const setVmVideoModel = (name: string, model: string) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/devices/video-model`, { model })

export interface DiskTuneBody {
  target: string
  bus?: string
  cache?: string
  discard?: string
  readonly?: boolean
  shareable?: boolean
}

export const tuneVmDisk = (name: string, body: DiskTuneBody) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/disk/tune`, body)

export interface NicTuneBody {
  mac_address: string
  model?: string
  network?: string
}

export const tuneVmNic = (name: string, body: NicTuneBody) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/nic/tune`, body)

export const virtViewerVvUrl = (name: string) =>
  `${API}/vms/${encodeURIComponent(name)}/virt-viewer.vv`
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

export interface NumaTuneState {
  node_set?: string | null
  mode?: number | null
}

export const getNumaTune = (name: string) => apiGet<NumaTuneState>(`${API}/vms/${encodeURIComponent(name)}/numa`)

export const setNumaTune = (name: string, body: { node_set?: string | null; mode?: number | null }) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/numa`, body)

export const pinEmulator = (name: string, cpus: boolean[]) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(name)}/emulator/pin`, { cpus })
