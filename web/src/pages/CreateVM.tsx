import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router'
import { createVMWithProgress, CreateVmRequest, VmTemplate } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { listIsos, listSavedTemplates, ImageFile } from '../api/extras'
import { listPools, listVolumes, StoragePoolInfo, StorageVolumeInfo } from '../api/storage'
import { BrowseHostPathModal, isHostDiskImageFileName, isIsoFileName } from '../components/BrowseHostPathModal'
import { useToastContext } from '../contexts/ToastContext'
import {
  IMAGE_BUILDER_OTHER_LINUX_BUILD_GROUPS,
  IMAGE_BUILDER_PLATFORMS_AND_VERSIONS_LINUX,
  IMAGE_BUILDER_QEMU_RAW_LINUX_EXAMPLES,
  IMAGE_BUILDER_REPO_URL,
  VIRTSPAWN_PACKER_SCRIPT_GUESTS,
} from '../data/packerGuests'
import { ArrowLeft, Boxes, Disc, FolderOpen, HardDrive, Layers, Monitor, Network } from 'lucide-react'

const PACKER_SCRIPT_SYSTEM = '/usr/local/share/virtspawn/packer/build-linux-image.sh'
const PACKER_SCRIPT_REPO = 'contrib/packer/build-linux-image.sh'

type InstallSource = 'iso' | 'url' | 'pxe' | 'download'
type StorageMode = 'new' | 'volume'
type PageFlow = 'install' | 'golden'
type GoldenKind = 'template' | 'backing'

export default function CreateVMPage() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const logEndRef = useRef<HTMLDivElement>(null)

  const [installSource, setInstallSource] = useState<InstallSource>('iso')
  const [vmName, setVmName] = useState('')
  const [vcpus, setVcpus] = useState(2)
  const [memoryMb, setMemoryMb] = useState(2048)
  const [diskGb, setDiskGb] = useState(20)
  const [network, setNetwork] = useState('default')
  const [firmware, setFirmware] = useState('bios')
  const [osVariant, setOsVariant] = useState('')
  const [iso, setIso] = useState('')
  const [virtInstallLocation, setVirtInstallLocation] = useState('')
  const [virtInstallInstallOs, setVirtInstallInstallOs] = useState('')
  const [virtInstallExtraArgs, setVirtInstallExtraArgs] = useState('')
  const [virtInstallPxeNetwork, setVirtInstallPxeNetwork] = useState('')
  const [cloudInitIso, setCloudInitIso] = useState('')
  const [pathCheckOff, setPathCheckOff] = useState(false)

  const [storageMode, setStorageMode] = useState<StorageMode>('new')
  const [pools, setPools] = useState<StoragePoolInfo[]>([])
  const [diskPool, setDiskPool] = useState('')
  const [volumes, setVolumes] = useState<StorageVolumeInfo[]>([])
  const [diskVol, setDiskVol] = useState('')

  const [graphicsType, setGraphicsType] = useState<'vnc' | 'spice'>('vnc')
  const [graphicsListen, setGraphicsListen] = useState('127.0.0.1')

  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [isoScan, setIsoScan] = useState<ImageFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createLog, setCreateLog] = useState<string[]>([])
  const [isoBrowseOpen, setIsoBrowseOpen] = useState(false)
  const [cloudBrowseOpen, setCloudBrowseOpen] = useState(false)

  const [pageFlow, setPageFlow] = useState<PageFlow>('install')
  const [goldenKind, setGoldenKind] = useState<GoldenKind>('template')
  const [savedTemplates, setSavedTemplates] = useState<VmTemplate[]>([])
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [templateDiskMode, setTemplateDiskMode] = useState<'backing' | 'copy'>('backing')
  const [backingGoldenPath, setBackingGoldenPath] = useState('')
  const [goldenOverlayGb, setGoldenOverlayGb] = useState(40)
  const [backingBrowseOpen, setBackingBrowseOpen] = useState(false)

  const loadVolumes = useCallback(async (pool: string) => {
    if (!pool) {
      setVolumes([])
      setDiskVol('')
      return
    }
    try {
      const v = await listVolumes(pool)
      setVolumes(v)
      setDiskVol((cur) => (v.some((x) => x.name === cur) ? cur : ''))
    } catch {
      setVolumes([])
      setDiskVol('')
    }
  }, [])

  useEffect(() => {
    listNetworks().then(setNetworks).catch(() => {})
    listIsos().then((r) => setIsoScan(r.files)).catch(() => {})
    listPools()
      .then((p) => {
        setPools(p)
        setDiskPool((prev) => (prev || (p[0]?.name ?? '')))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (storageMode === 'volume' && diskPool) void loadVolumes(diskPool)
  }, [storageMode, diskPool, loadVolumes])

  useEffect(() => {
    if (createLog.length) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [createLog])

  useEffect(() => {
    if (pageFlow !== 'golden') return
    listSavedTemplates()
      .then((t) => {
        setSavedTemplates(t)
        setSelectedTemplateName((prev) => {
          if (prev && t.some((x) => x.name === prev)) return prev
          const withGolden = t.filter((x) => x.base_image)
          return withGolden[0]?.name ?? t[0]?.name ?? ''
        })
      })
      .catch(() => setSavedTemplates([]))
  }, [pageFlow])

  const setSource = (src: InstallSource) => {
    setInstallSource(src)
    if (src !== 'iso') setIso('')
    if (src !== 'url') setVirtInstallLocation('')
    if (src !== 'download') setVirtInstallInstallOs('')
  }

  const handleCreate = async () => {
    const name = vmName.trim()
    if (!name) {
      toast.warning('Name is required')
      return
    }

    if (storageMode === 'volume') {
      if (!diskPool.trim() || !diskVol.trim()) {
        toast.warning('Choose a storage pool and volume, or switch to “Create new disk image”.')
        return
      }
    }

    if (installSource === 'iso' && !iso.trim()) {
      toast.warning('Select or enter the install ISO path on the hypervisor')
      return
    }
    if (installSource === 'url' && !virtInstallLocation.trim()) {
      toast.warning('Enter the install URL or tree (virt-install --location), e.g. https://…/os/')
      return
    }
    if (installSource === 'download' && !virtInstallInstallOs.trim()) {
      toast.warning('Enter the OS identifier for automatic download (e.g. fedora40, win2k22)')
      return
    }

    const req: CreateVmRequest = {
      name,
      vcpus,
      memory_mb: memoryMb,
      disk_gb: diskGb,
      network,
      firmware,
      create_backend: 'virt_install',
      os_variant: osVariant.trim() || undefined,
      graphics_type: graphicsType,
      graphics_listen: graphicsListen.trim() || undefined,
      cloud_init_iso: cloudInitIso.trim() || undefined,
      virt_install_path_in_use_check_off: pathCheckOff || undefined,
    }
    if (installSource !== 'pxe' && virtInstallExtraArgs.trim()) {
      req.virt_install_extra_args = virtInstallExtraArgs.trim()
    }

    if (storageMode === 'volume') {
      req.root_disk_storage_pool = diskPool.trim()
      req.root_disk_storage_volume = diskVol.trim()
    }

    if (installSource === 'iso') {
      req.iso = iso.trim()
    } else if (installSource === 'url') {
      req.virt_install_location = virtInstallLocation.trim()
    } else if (installSource === 'pxe') {
      req.virt_install_pxe = true
      if (virtInstallPxeNetwork.trim()) req.virt_install_pxe_network = virtInstallPxeNetwork.trim()
    } else {
      req.virt_install_install_os = virtInstallInstallOs.trim()
    }

    setSubmitting(true)
    setCreateLog([])
    try {
      await createVMWithProgress(req, (line) => setCreateLog((prev) => [...prev, line]))
      toast.success(`VM '${name}' created — open Console to finish install (same idea as Cockpit Machines).`)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateGolden = async () => {
    const name = vmName.trim()
    if (!name) {
      toast.warning('Name is required')
      return
    }
    if (goldenKind === 'template') {
      if (!selectedTemplateName.trim()) {
        toast.warning('Choose a saved template (create one under /var/lib/virtspawn/templates/ or Save template from a VM)')
        return
      }
      const tmpl = savedTemplates.find((x) => x.name === selectedTemplateName.trim())
      if (!tmpl?.base_image?.trim()) {
        toast.warning('That template has no base_image (Packer qcow2 path). Edit the JSON or use “Direct qcow2 backing”.')
        return
      }
    } else {
      if (!backingGoldenPath.trim()) {
        toast.warning('Enter the golden qcow2 path on the hypervisor (or browse)')
        return
      }
      if (goldenOverlayGb < 5) {
        toast.warning('Overlay disk size must be at least 5 GiB')
        return
      }
    }

    const req: CreateVmRequest = {
      name,
      vcpus: goldenKind === 'backing' ? vcpus : 1,
      memory_mb: goldenKind === 'backing' ? memoryMb : 512,
      disk_gb: goldenKind === 'backing' ? goldenOverlayGb : 10,
      network,
      firmware,
      create_backend: 'virt_install',
      graphics_type: graphicsType,
      graphics_listen: graphicsListen.trim() || undefined,
      virt_install_path_in_use_check_off: pathCheckOff || undefined,
    }

    if (goldenKind === 'template') {
      req.saved_template = selectedTemplateName.trim()
      req.template_disk_mode = templateDiskMode
    } else {
      req.virt_install_disk_backing_store = backingGoldenPath.trim()
    }

    setSubmitting(true)
    setCreateLog([])
    try {
      await createVMWithProgress(req, (line) => setCreateLog((prev) => [...prev, line]))
      toast.success(`VM '${name}' created from golden image — start it from the VM list.`)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const sourceTabs: { id: InstallSource; label: string; hint: string }[] = [
    { id: 'iso', label: 'Local install media', hint: 'ISO on the hypervisor (like Cockpit “Local install media”)' },
    { id: 'url', label: 'Network install', hint: 'HTTP(S) or NFS tree — virt-install --location' },
    { id: 'pxe', label: 'Network boot (PXE)', hint: 'PXE on a second NIC (Cockpit-style network install)' },
    { id: 'download', label: 'Automatic OS install', hint: 'virt-install --install os=… (downloaded media)' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-8">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded transition" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="w-6 h-6 text-cyan-400" />
            Create new virtual machine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Same <code className="text-slate-400">virt-install</code> flow as{' '}
            <span className="text-slate-400">Cockpit Machines</span>: install from media, or clone many identical guests from a Packer golden qcow2.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setPageFlow('install')
            setCreateLog([])
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            pageFlow === 'install'
              ? 'bg-blue-600/90 border-blue-500 text-white'
              : 'bg-slate-900/60 border-slate-600 text-slate-300 hover:border-slate-500'
          }`}
        >
          Install from media
        </button>
        <button
          type="button"
          onClick={() => {
            setPageFlow('golden')
            setCreateLog([])
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            pageFlow === 'golden'
              ? 'bg-amber-600/90 border-amber-500 text-white'
              : 'bg-slate-900/60 border-slate-600 text-slate-300 hover:border-slate-500'
          }`}
        >
          Clone from golden image
        </button>
      </div>

      {pageFlow === 'install' && (
        <>
      {/* Installation source (Cockpit-style) */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Disc className="w-5 h-5 text-amber-400" />
          Installation source
        </h2>
        <div className="flex flex-wrap gap-2">
          {sourceTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSource(t.id)}
              className={`px-3 py-2 rounded-lg text-sm border transition ${
                installSource === t.id
                  ? 'bg-blue-600/90 border-blue-500 text-white'
                  : 'bg-slate-900/60 border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{sourceTabs.find((x) => x.id === installSource)?.hint}</p>

        {installSource === 'iso' && (
          <div className="space-y-3 pt-2 border-t border-slate-700/50">
            {isoScan.length > 0 && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Recently discovered ISOs</label>
                <select
                  value=""
                  onChange={(e) => e.target.value && setIso(e.target.value)}
                  className="input-field"
                >
                  <option value="">— pick to fill path —</option>
                  {isoScan.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="iso-path" className="block text-sm text-slate-400 mb-1">
                ISO file on hypervisor *
              </label>
              <div className="flex gap-2">
                <input
                  id="iso-path"
                  type="text"
                  value={iso}
                  onChange={(e) => setIso(e.target.value)}
                  className="input-field flex-1 font-mono text-sm"
                  placeholder="/var/lib/libvirt/images/install.iso"
                />
                <button
                  type="button"
                  onClick={() => setIsoBrowseOpen(true)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2 shrink-0"
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse
                </button>
              </div>
            </div>
          </div>
        )}

        {installSource === 'url' && (
          <div className="space-y-3 pt-2 border-t border-slate-700/50">
            <label htmlFor="loc-url" className="block text-sm text-slate-400 mb-1">
              Install URL or directory tree *
            </label>
            <input
              id="loc-url"
              type="text"
              value={virtInstallLocation}
              onChange={(e) => setVirtInstallLocation(e.target.value)}
              className="input-field font-mono text-sm"
              placeholder="https://download.fedoraproject.org/pub/fedora/linux/releases/40/Server/x86_64/os/"
            />
          </div>
        )}

        {installSource === 'pxe' && (
          <div className="space-y-3 pt-2 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              The VM boots with an extra NIC on the libvirt network you choose for PXE (primary NIC stays on “Network” below).
            </p>
            <label htmlFor="pxe-net" className="block text-sm text-slate-400 mb-1">
              PXE network (libvirt network name)
            </label>
            <input
              id="pxe-net"
              type="text"
              value={virtInstallPxeNetwork}
              onChange={(e) => setVirtInstallPxeNetwork(e.target.value)}
              className="input-field"
              placeholder="Leave empty to use the same as primary network"
            />
          </div>
        )}

        {installSource === 'download' && (
          <div className="space-y-3 pt-2 border-t border-slate-700/50">
            <label htmlFor="os-id" className="block text-sm text-slate-400 mb-1">
              OS identifier (libosinfo short-id) *
            </label>
            <input
              id="os-id"
              type="text"
              value={virtInstallInstallOs}
              onChange={(e) => setVirtInstallInstallOs(e.target.value)}
              className="input-field font-mono text-sm"
              placeholder="e.g. fedora40, ubuntu24.04, win2k22"
            />
          </div>
        )}

        {(installSource === 'iso' || installSource === 'url' || installSource === 'download') && (
          <div>
            <label htmlFor="extra-args" className="block text-sm text-slate-400 mb-1">
              Kernel / installer arguments (optional, virt-install --extra-args)
            </label>
            <textarea
              id="extra-args"
              value={virtInstallExtraArgs}
              onChange={(e) => setVirtInstallExtraArgs(e.target.value)}
              rows={2}
              className="input-field font-mono text-xs"
              placeholder="e.g. inst.ks=http://…/ks.cfg for kickstart"
            />
          </div>
        )}
      </div>

      {/* VM details */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
        <h2 className="text-lg font-semibold text-white">Machine details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="vm-name" className="block text-sm text-slate-400 mb-1">
              Name *
            </label>
            <input
              id="vm-name"
              type="text"
              value={vmName}
              onChange={(e) => setVmName(e.target.value)}
              className="input-field"
              placeholder="my-vm"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="vcpus" className="block text-sm text-slate-400 mb-1">
              CPUs
            </label>
            <input
              id="vcpus"
              type="number"
              min={1}
              max={64}
              value={vcpus}
              onChange={(e) => setVcpus(Number(e.target.value) || 1)}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="mem" className="block text-sm text-slate-400 mb-1">
              Memory (MiB)
            </label>
            <input
              id="mem"
              type="number"
              min={256}
              step={256}
              value={memoryMb}
              onChange={(e) => setMemoryMb(Number(e.target.value) || 1024)}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="fw" className="block text-sm text-slate-400 mb-1">
              Firmware
            </label>
            <select id="fw" value={firmware} onChange={(e) => setFirmware(e.target.value)} className="input-field">
              <option value="bios">BIOS</option>
              <option value="uefi">UEFI</option>
            </select>
          </div>
          <div>
            <label htmlFor="osv" className="block text-sm text-slate-400 mb-1">
              Operating system (optional)
            </label>
            <input
              id="osv"
              type="text"
              value={osVariant}
              onChange={(e) => setOsVariant(e.target.value)}
              className="input-field"
              placeholder="libosinfo id — empty = generic"
            />
          </div>
        </div>
      </div>

      {/* Storage — Cockpit: new image vs existing volume */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-sky-400" />
          Storage
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStorageMode('new')}
            className={`px-3 py-2 rounded-lg text-sm border transition ${
              storageMode === 'new'
                ? 'bg-blue-600/90 border-blue-500 text-white'
                : 'bg-slate-900/60 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            Create new disk image
          </button>
          <button
            type="button"
            onClick={() => setStorageMode('volume')}
            className={`px-3 py-2 rounded-lg text-sm border transition ${
              storageMode === 'volume'
                ? 'bg-blue-600/90 border-blue-500 text-white'
                : 'bg-slate-900/60 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            Use existing storage volume
          </button>
        </div>
        {storageMode === 'new' ? (
          <div>
            <label htmlFor="disk-gb" className="block text-sm text-slate-400 mb-1">
              Disk size (GiB)
            </label>
            <input
              id="disk-gb"
              type="number"
              min={5}
              value={diskGb}
              onChange={(e) => setDiskGb(Number(e.target.value) || 10)}
              className="input-field max-w-xs"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pool" className="block text-sm text-slate-400 mb-1">
                Storage pool *
              </label>
              <select
                id="pool"
                value={diskPool}
                onChange={(e) => {
                  setDiskPool(e.target.value)
                  setDiskVol('')
                }}
                className="input-field"
              >
                {pools.length === 0 ? <option value="">No pools (refresh libvirt)</option> : null}
                {pools.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.state})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="vol" className="block text-sm text-slate-400 mb-1">
                Volume *
              </label>
              <select
                id="vol"
                value={diskVol}
                onChange={(e) => setDiskVol(e.target.value)}
                className="input-field"
                disabled={!diskPool || volumes.length === 0}
              >
                <option value="">{volumes.length ? '— select volume —' : '— no volumes —'}</option>
                {volumes.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.capacity_gb} GiB)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Network + console */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Network className="w-5 h-5 text-emerald-400" />
          Networking
        </h2>
        <div>
          <label htmlFor="net" className="block text-sm text-slate-400 mb-1">
            Virtual network (NAT / bridge)
          </label>
          <select id="net" value={network} onChange={(e) => setNetwork(e.target.value)} className="input-field max-w-md">
            {networks.length === 0 ? <option value="default">default</option> : null}
            {networks.map((n) => (
              <option key={n.name} value={n.name}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 pt-2 border-t border-slate-700/50">
          <Monitor className="w-4 h-4 text-violet-400" />
          Console (remote viewer)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="gfx-type" className="block text-sm text-slate-400 mb-1">
              Graphics
            </label>
            <select id="gfx-type" value={graphicsType} onChange={(e) => setGraphicsType(e.target.value as 'vnc' | 'spice')} className="input-field">
              <option value="vnc">VNC</option>
              <option value="spice">SPICE</option>
            </select>
          </div>
          <div>
            <label htmlFor="gfx-listen" className="block text-sm text-slate-400 mb-1">
              Listen address
            </label>
            <select id="gfx-listen" value={graphicsListen} onChange={(e) => setGraphicsListen(e.target.value)} className="input-field">
              <option value="127.0.0.1">Localhost only (default, secure)</option>
              <option value="0.0.0.0">All interfaces (remote viewer like Cockpit)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Optional cloud-init CD */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
        <h2 className="text-base font-semibold text-white">Cloud-init / seed ISO (optional)</h2>
        <p className="text-xs text-slate-500">Second CD-ROM for nocloud / autoinstall seeds — same pattern as Cockpit when attaching user-data.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={cloudInitIso}
            onChange={(e) => setCloudInitIso(e.target.value)}
            className="input-field flex-1 font-mono text-sm"
            placeholder="Absolute path on hypervisor"
          />
          <button type="button" onClick={() => setCloudBrowseOpen(true)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2 shrink-0">
            <FolderOpen className="w-4 h-4" />
            Browse
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={pathCheckOff} onChange={(e) => setPathCheckOff(e.target.checked)} className="rounded" />
          Ignore path-in-use check (busy images / volumes)
        </label>
      </div>

      <button
        type="button"
        onClick={handleCreate}
        disabled={submitting}
        className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
      >
        {submitting ? 'Creating…' : 'Create and install virtual machine'}
      </button>
        </>
      )}

      {pageFlow === 'golden' && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-amber-900/40 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Golden image source
            </h2>
            <p className="text-sm text-slate-400">
              After Packer writes e.g. <code className="text-slate-300">output-fedora43/fedora43.qcow2</code>, keep one canonical file on the host and reuse it: either register a{' '}
              <span className="text-slate-200">saved template</span> JSON under{' '}
              <code className="text-slate-300">/var/lib/virtspawn/templates/</code> with <code className="text-slate-300">base_image</code> pointing at that path, or attach the qcow2 directly as a{' '}
              <span className="text-slate-200">backing store</span> (thin overlay per VM).
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGoldenKind('template')}
                className={`px-3 py-2 rounded-lg text-sm border transition ${
                  goldenKind === 'template'
                    ? 'bg-amber-600/90 border-amber-500 text-white'
                    : 'bg-slate-900/60 border-slate-600 text-slate-300'
                }`}
              >
                Saved template
              </button>
              <button
                type="button"
                onClick={() => setGoldenKind('backing')}
                className={`px-3 py-2 rounded-lg text-sm border transition ${
                  goldenKind === 'backing'
                    ? 'bg-amber-600/90 border-amber-500 text-white'
                    : 'bg-slate-900/60 border-slate-600 text-slate-300'
                }`}
              >
                Direct qcow2 backing
              </button>
            </div>

            {goldenKind === 'template' && (
              <div className="space-y-3 pt-2 border-t border-slate-700/50">
                <label htmlFor="tmpl-sel" className="block text-sm text-slate-400 mb-1">
                  Template *
                </label>
                <select
                  id="tmpl-sel"
                  value={selectedTemplateName}
                  onChange={(e) => setSelectedTemplateName(e.target.value)}
                  className="input-field"
                >
                  <option value="">— select —</option>
                  {savedTemplates.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                      {t.base_image ? ' (has golden qcow2)' : ' (no base_image)'}
                    </option>
                  ))}
                </select>
                {savedTemplates.length === 0 && (
                  <p className="text-xs text-amber-200/90">
                    No templates found. Add <code className="text-slate-300">/var/lib/virtspawn/templates/mytmpl.json</code> with{' '}
                    <code className="text-slate-300">base_image</code> set to your Packer qcow2 path, or use <span className="text-slate-200">Save template</span> on a VM details page.
                  </p>
                )}
                <div>
                  <label htmlFor="tmpl-mode" className="block text-sm text-slate-400 mb-1">
                    New disk from golden
                  </label>
                  <select
                    id="tmpl-mode"
                    value={templateDiskMode}
                    onChange={(e) => setTemplateDiskMode(e.target.value as 'backing' | 'copy')}
                    className="input-field max-w-md"
                  >
                    <option value="backing">Thin clone (qemu-img backing → small overlay)</option>
                    <option value="copy">Full copy (standalone qcow2)</option>
                  </select>
                </div>
                {selectedTemplateName && (
                  <p className="text-xs text-slate-500">
                    {(() => {
                      const t = savedTemplates.find((x) => x.name === selectedTemplateName)
                      if (!t) return null
                      return (
                        <>
                          Template sizing: {t.vcpus} vCPU, {t.memory_mb} MiB RAM, disk hint {t.disk_gb} GiB, os_variant{' '}
                          <code className="text-slate-400">{t.os_variant || 'generic'}</code>
                          {t.base_image ? (
                            <>
                              . Golden: <code className="text-slate-400 break-all">{t.base_image}</code>
                            </>
                          ) : (
                            <span className="text-amber-300/90"> — add base_image in JSON for Packer golden reuse.</span>
                          )}
                        </>
                      )
                    })()}
                  </p>
                )}
              </div>
            )}

            {goldenKind === 'backing' && (
              <div className="space-y-3 pt-2 border-t border-slate-700/50">
                <label htmlFor="golden-path" className="block text-sm text-slate-400 mb-1">
                  Golden qcow2 on hypervisor *
                </label>
                <div className="flex gap-2">
                  <input
                    id="golden-path"
                    type="text"
                    value={backingGoldenPath}
                    onChange={(e) => setBackingGoldenPath(e.target.value)}
                    className="input-field flex-1 font-mono text-sm"
                    placeholder="/var/lib/libvirt/images/fedora43.qcow2"
                  />
                  <button
                    type="button"
                    onClick={() => setBackingBrowseOpen(true)}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2 shrink-0"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </button>
                </div>
                <div>
                  <label htmlFor="golden-gb" className="block text-sm text-slate-400 mb-1">
                    Overlay disk size (GiB)
                  </label>
                  <input
                    id="golden-gb"
                    type="number"
                    min={5}
                    value={goldenOverlayGb}
                    onChange={(e) => setGoldenOverlayGb(Number(e.target.value) || 20)}
                    className="input-field max-w-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
            <h2 className="text-lg font-semibold text-white">New VM</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="g-vm-name" className="block text-sm text-slate-400 mb-1">
                  Name *
                </label>
                <input
                  id="g-vm-name"
                  type="text"
                  value={vmName}
                  onChange={(e) => setVmName(e.target.value)}
                  className="input-field"
                  placeholder="clone-01"
                />
              </div>
              {goldenKind === 'backing' && (
                <>
                  <div>
                    <label htmlFor="g-vcpus" className="block text-sm text-slate-400 mb-1">
                      vCPUs
                    </label>
                    <input
                      id="g-vcpus"
                      type="number"
                      min={1}
                      value={vcpus}
                      onChange={(e) => setVcpus(Number(e.target.value) || 1)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="g-mem" className="block text-sm text-slate-400 mb-1">
                      Memory (MiB)
                    </label>
                    <input
                      id="g-mem"
                      type="number"
                      min={256}
                      step={256}
                      value={memoryMb}
                      onChange={(e) => setMemoryMb(Number(e.target.value) || 1024)}
                      className="input-field"
                    />
                  </div>
                </>
              )}
              {goldenKind === 'template' && (
                <p className="sm:col-span-2 text-sm text-slate-500">
                  vCPU, RAM, and OS variant for this clone come from the template JSON (applied on the server).
                </p>
              )}
              <div>
                <label htmlFor="g-fw" className="block text-sm text-slate-400 mb-1">
                  Firmware
                </label>
                <select id="g-fw" value={firmware} onChange={(e) => setFirmware(e.target.value)} className="input-field">
                  <option value="bios">BIOS</option>
                  <option value="uefi">UEFI</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-emerald-400" />
              Networking &amp; console
            </h2>
            <div>
              <label htmlFor="g-net" className="block text-sm text-slate-400 mb-1">
                Virtual network
              </label>
              <select id="g-net" value={network} onChange={(e) => setNetwork(e.target.value)} className="input-field max-w-md">
                {networks.length === 0 ? <option value="default">default</option> : null}
                {networks.map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="g-gfx" className="block text-sm text-slate-400 mb-1">
                  Graphics
                </label>
                <select id="g-gfx" value={graphicsType} onChange={(e) => setGraphicsType(e.target.value as 'vnc' | 'spice')} className="input-field">
                  <option value="vnc">VNC</option>
                  <option value="spice">SPICE</option>
                </select>
              </div>
              <div>
                <label htmlFor="g-listen" className="block text-sm text-slate-400 mb-1">
                  Listen
                </label>
                <select id="g-listen" value={graphicsListen} onChange={(e) => setGraphicsListen(e.target.value)} className="input-field">
                  <option value="127.0.0.1">127.0.0.1</option>
                  <option value="0.0.0.0">0.0.0.0</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={pathCheckOff} onChange={(e) => setPathCheckOff(e.target.checked)} className="rounded" />
              Ignore path-in-use check
            </label>
          </div>

          <button
            type="button"
            onClick={handleCreateGolden}
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
          >
            {submitting ? 'Creating…' : 'Create VM from golden image'}
          </button>
        </div>
      )}

      {(submitting || createLog.length > 0) && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 space-y-2">
          <h4 className="text-xs font-semibold text-slate-300">virt-install</h4>
          <pre className="max-h-56 overflow-y-auto rounded bg-black/50 border border-slate-800 p-2 text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-all">
            {createLog.length ? createLog.join('\n') : <span className="text-slate-500">Starting…</span>}
          </pre>
          <div ref={logEndRef} />
        </div>
      )}

      {/* Packer */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
        <h2 className="text-lg font-semibold text-white">Or: unattended image (Packer)</h2>
        <p className="text-sm text-slate-400">
          Build a qcow2 on the host, then import. Script on a host install: <code className="text-slate-300">{PACKER_SCRIPT_SYSTEM}</code> — in-repo:{' '}
          <code className="text-slate-300">{PACKER_SCRIPT_REPO}</code>. Example:{' '}
          <code className="text-slate-300">sudo {PACKER_SCRIPT_REPO} ubuntu2404</code>
        </p>
        <p className="text-sm text-slate-400">
          Linux platform names below are aligned with{' '}
          <a href={IMAGE_BUILDER_REPO_URL} className="text-cyan-400 hover:underline" target="_blank" rel="noreferrer">
            kubernetes-sigs/image-builder
          </a>{' '}
          (<code className="text-slate-300">images/capi/Makefile</code>: <code className="text-slate-300">PLATFORMS_AND_VERSIONS</code>,{' '}
          <code className="text-slate-300">QEMU_BUILD_NAMES</code>, <code className="text-slate-300">RAW_BUILD_NAMES</code>, …). The virtspawn script is a small QEMU/KVM subset; upstream builds Photon, Flatcar, RHEL, cloud images, and more.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-700/60">
          <table className="min-w-[640px] w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Script arg</th>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">SSH login</th>
                <th className="px-3 py-2 font-medium">
                  <code className="text-slate-400">--os-variant</code> hint
                </th>
                <th className="px-3 py-2 font-medium">image-builder ids</th>
              </tr>
            </thead>
            <tbody>
              {VIRTSPAWN_PACKER_SCRIPT_GUESTS.map((g) => (
                <tr key={g.id} className="border-t border-slate-700/50 odd:bg-slate-950/30">
                  <td className="px-3 py-2 font-mono text-cyan-300/90">{g.id}</td>
                  <td className="px-3 py-2">
                    {g.label}
                    {g.notes ? <span className="block text-xs text-slate-500 mt-0.5">{g.notes}</span> : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-200">
                    {g.defaultLoginUser} / <span className="text-slate-400">password</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-200">{g.osVariantHint}</td>
                  <td className="px-3 py-2 text-xs text-slate-400 max-w-[280px]">
                    {g.imageBuilderTargets.length ? g.imageBuilderTargets.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-3 space-y-2 text-xs text-slate-400">
          <p>
            <span className="text-slate-300">Makefile</span> <code className="text-slate-500">PLATFORMS_AND_VERSIONS</code> (Linux):{' '}
            <span className="font-mono text-slate-300 break-all">{IMAGE_BUILDER_PLATFORMS_AND_VERSIONS_LINUX.join(', ')}</span>
          </p>
          <p>
            <span className="text-slate-300">QEMU / RAW</span> (examples): <span className="font-mono text-slate-300 break-all">{IMAGE_BUILDER_QEMU_RAW_LINUX_EXAMPLES}</span>
          </p>
          <p className="break-words">{IMAGE_BUILDER_OTHER_LINUX_BUILD_GROUPS}</p>
        </div>
        <p className="text-sm text-slate-400">
          Windows + VirtIO: <code className="text-slate-300">contrib/packer/windows-qemu/</code> (<code className="text-slate-300">HOWTO.txt</code>) — image-builder:{' '}
          <code className="text-slate-300">windows-2019</code>, <code className="text-slate-300">windows-2022</code>, EFI variants, Azure/GCE/OCI targets, etc.
        </p>
        <p className="text-sm text-slate-400">
          Reuse the qcow2 for many VMs: copy it to a stable path, then either use <span className="text-slate-300">Clone from golden image</span> above (direct backing or saved template), or add{' '}
          <code className="text-slate-300">/var/lib/virtspawn/templates/&lt;name&gt;.json</code> with a <code className="text-slate-300">base_image</code> field.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/import" className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
          Import disk
        </Link>
        <Link to="/disk-images" className="inline-flex items-center justify-center px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
          Disk images
        </Link>
      </div>

      <BrowseHostPathModal
        open={isoBrowseOpen}
        onClose={() => setIsoBrowseOpen(false)}
        title="Browse for install ISO"
        canSelectFile={isIsoFileName}
        onSelectPath={(p) => {
          setIso(p)
          setIsoBrowseOpen(false)
        }}
      />
      <BrowseHostPathModal
        open={cloudBrowseOpen}
        onClose={() => setCloudBrowseOpen(false)}
        title="Browse for cloud-init / seed ISO"
        canSelectFile={isIsoFileName}
        onSelectPath={(p) => {
          setCloudInitIso(p)
          setCloudBrowseOpen(false)
        }}
      />
      <BrowseHostPathModal
        open={backingBrowseOpen}
        onClose={() => setBackingBrowseOpen(false)}
        title="Browse for golden qcow2"
        canSelectFile={isHostDiskImageFileName}
        onSelectPath={(p) => {
          setBackingGoldenPath(p)
          setBackingBrowseOpen(false)
        }}
      />
    </div>
  )
}
