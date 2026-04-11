import { useCallback, useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import {
  getVM, getVMMetrics, getVMXml, startVM, stopVM, shutdownVM, rebootVM, pauseVM, resumeVM,
  setAutostart, setVcpus, setMemory, setMemoryBalloon, setBootOrder,
  cloneVM, renameVM, migrateVM, resizeDisk, attachInterface, detachInterface,
  getInterfaces, getBootConfig, hasManagedSave, managedSave, managedSaveRemove,
  insertCdrom, ejectCdrom, getVMLogs,
  VmDetails, VmMetrics, GuestIpAddress, BootConfig,
} from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { listSnapshots, createSnapshot, deleteSnapshot, revertSnapshot, SnapshotInfo } from '../api/snapshot'
import { getStateBadgeClasses, formatBytes } from '../utils/vm'
import { addRecentVM } from '../utils/recentVMs'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToastContext } from '../contexts/ToastContext'
import { triggerBackup } from '../api/backup'
import { listUsbDevices, attachUsb, detachUsb, listIsos, UsbDevice, ImageFile, liveSetVcpus, liveSetMemory, getVmTags, setVmTags as apiSetVmTags, listPciDevices, PciDevice, saveVmAsTemplate, listIommuGroups, IommuGroup } from '../api/extras'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  ArrowLeft, Play, Square, Power, RotateCcw, Pause, RefreshCw,
  ToggleLeft, ToggleRight, Cpu, HardDrive, Network, Camera, Terminal,
  Save, Disc, Archive, Copy, Pencil, ArrowRightLeft, Download,
  Plus, Trash2, RotateCw, Code, MemoryStick, Settings, Usb, Layers,
  ChevronUp, ChevronDown, X, Tag, Monitor, Shield,
} from 'lucide-react'

interface MetricsPoint { time: string; memory: number; diskRd: number; diskWr: number; netRx: number; netTx: number }

type Tab = 'overview' | 'disks' | 'network' | 'snapshots' | 'devices' | 'xml' | 'logs'
type Dialog = null | 'cdrom' | 'clone' | 'rename' | 'migrate' | 'snapshot' | 'boot-order' | 'vcpus' | 'memory' | 'balloon' | 'attach-disk' | 'resize-disk' | 'attach-nic' | 'attach-usb' | 'save-template'

export default function VMDetailsPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [vm, setVM] = useState<VmDetails | null>(null)
  const [metrics, setMetrics] = useState<VmMetrics | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<MetricsPoint[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
  const [guestIps, setGuestIps] = useState<GuestIpAddress[]>([])
  const [bootConfig, setBootConfig] = useState<BootConfig | null>(null)
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [hasSave, setHasSave] = useState(false)
  const [vmXml, setVmXml] = useState('')
  const [backingUp, setBackingUp] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<Dialog>(null)
  const toast = useToastContext()
  const prevMetricsRef = useRef<VmMetrics | null>(null)

  // Dialog form state
  const [cdromPath, setCdromPath] = useState('')
  const [cdromTarget, setCdromTarget] = useState('sda')
  const [cloneName, setCloneName] = useState('')
  const [newName, setNewName] = useState('')
  const [migrateUri, setMigrateUri] = useState('')
  const [migrateLive, setMigrateLive] = useState(true)
  const [snapName, setSnapName] = useState('')
  const [snapDesc, setSnapDesc] = useState('')
  const [editVcpus, setEditVcpus] = useState(1)
  const [editMemory, setEditMemory] = useState(2048)
  const [balloonMb, setBalloonMb] = useState(0)
  const [bootDevices, setBootDevices] = useState<string[]>([])
  const [attachSource, setAttachSource] = useState('')
  const [attachTarget, setAttachTarget] = useState('vdb')
  const [attachDriver, setAttachDriver] = useState('qcow2')
  const [resizeTarget, setResizeTarget] = useState('')
  const [resizeGb, setResizeGb] = useState(20)
  const [nicNetwork, setNicNetwork] = useState('default')
  const [nicModel, setNicModel] = useState('virtio')
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([])
  const [selectedUsb, setSelectedUsb] = useState('')
  const [isoFiles, setIsoFiles] = useState<ImageFile[]>([])
  const [vmTags, setVmTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [pciDevices, setPciDevices] = useState<PciDevice[]>([])
  const [iommuGroups, setIommuGroups] = useState<IommuGroup[]>([])
  const [sshIp, setSshIp] = useState('')
  const [sshDialogOpen, setSshDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [snapDiskOnly, setSnapDiskOnly] = useState(false)
  const [logsContent, setLogsContent] = useState('')
  const [logsLines, setLogsLines] = useState(500)

  // Confirmation dialog state for destructive actions
  const [detachDiskTarget, setDetachDiskTarget] = useState<string | null>(null)
  const [detachNicMac, setDetachNicMac] = useState<string | null>(null)
  const [deleteSnapName, setDeleteSnapName] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!name) return
    try {
      const [vmData, snapData] = await Promise.all([getVM(name), listSnapshots(name).catch(() => [])])
      setVM(vmData)
      setSnapshots(snapData)
      addRecentVM(name)
      if (vmData.state === 'running') {
        try { setMetrics(await getVMMetrics(name)) } catch { /* no metrics */ }
        try { setGuestIps(await getInterfaces(name)) } catch { /* no guest agent */ }
      } else {
        setMetrics(null)
        setGuestIps([])
      }
      try { setBootConfig(await getBootConfig(name)) } catch { /* optional */ }
      try { const s = await hasManagedSave(name); setHasSave(s.has_managed_save) } catch { /* optional */ }
      try { const t = await getVmTags(name); setVmTags(t.tags) } catch { /* optional */ }
    } catch (e: unknown) {
      toast.error(`Failed to load VM: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [name, toast])

  useEffect(() => { load() }, [load])

  // Load network list, USB devices, ISOs for dialogs
  useEffect(() => {
    listNetworks().then(setNetworks).catch(() => {})
    listUsbDevices().then(setUsbDevices).catch(() => {})
    listIsos().then(setIsoFiles).catch(() => {})
    listPciDevices().then(setPciDevices).catch(() => {})
    listIommuGroups().then(setIommuGroups).catch(() => {})
  }, [])

  // Poll per-VM metrics every 5s for charts
  useEffect(() => {
    if (!name) return
    const poll = async () => {
      try {
        const m = await getVMMetrics(name)
        setMetrics(m)
        const prev = prevMetricsRef.current
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        // Calculate deltas for I/O rates
        const diskRdDelta = prev ? Math.max(0, m.disk_rd_bytes - prev.disk_rd_bytes) : 0
        const diskWrDelta = prev ? Math.max(0, m.disk_wr_bytes - prev.disk_wr_bytes) : 0
        const netRxDelta = prev ? Math.max(0, m.net_rx_bytes - prev.net_rx_bytes) : 0
        const netTxDelta = prev ? Math.max(0, m.net_tx_bytes - prev.net_tx_bytes) : 0
        prevMetricsRef.current = m
        setMetricsHistory(h => [...h.slice(-59), {
          time, memory: parseFloat(m.memory_pct.toFixed(1)),
          diskRd: diskRdDelta, diskWr: diskWrDelta,
          netRx: netRxDelta, netTx: netTxDelta,
        }])
      } catch { /* VM may not be running */ }
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [name])

  // Load XML when tab switches to xml
  useEffect(() => {
    if (tab === 'xml' && name && !vmXml) {
      getVMXml(name).then(setVmXml).catch(() => setVmXml('Failed to load XML'))
    }
  }, [tab, name, vmXml])

  // Load logs when tab switches to logs
  useEffect(() => {
    if (tab === 'logs' && name) {
      getVMLogs(name, logsLines).then((r) => setLogsContent(r.content)).catch(() => setLogsContent('Failed to load logs'))
    }
  }, [tab, name, logsLines])

  const action = async (fn: (n: string) => Promise<void>, label: string) => {
    if (!name) return
    try { await fn(name); toast.success(`${label} OK`); load() } catch (e: unknown) { toast.error(`${label} failed: ${e instanceof Error ? e.message : e}`) }
  }

  const openDialog = (d: Dialog) => {
    if (vm) {
      if (d === 'vcpus') setEditVcpus(vm.vcpus)
      if (d === 'memory') setEditMemory(vm.memory_mb)
      if (d === 'balloon') setBalloonMb(vm.memory_mb)
      if (d === 'boot-order') setBootDevices(bootConfig?.boot_devices || [])
      if (d === 'clone') setCloneName(`${vm.name}-clone`)
      if (d === 'rename') setNewName(vm.name)
      if (d === 'save-template') setTemplateName(`${vm.name}-template`)
    }
    setDialog(d)
  }

  // ── Dialog handlers ──────────────────────────────────────────────

  const handleClone = async () => {
    if (!name || !cloneName.trim()) return
    try { await cloneVM(name, cloneName.trim()); toast.success(`Cloned to '${cloneName}'`); setDialog(null); load() } catch (e: unknown) { toast.error(`Clone failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleRename = async () => {
    if (!name || !newName.trim() || newName === name) return
    try { await renameVM(name, newName.trim()); toast.success(`Renamed to '${newName}'`); setDialog(null); navigate(`/vms/${newName.trim()}`) } catch (e: unknown) { toast.error(`Rename failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleMigrate = async () => {
    if (!name || !migrateUri.trim()) return
    toast.info('Starting migration...')
    try { await migrateVM(name, migrateUri.trim(), migrateLive); toast.success('Migration completed'); setDialog(null) } catch (e: unknown) { toast.error(`Migration failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleSetVcpus = async () => {
    if (!name) return
    try {
      if (vm?.state === 'running') {
        await liveSetVcpus(name, editVcpus)
        toast.success(`vCPUs live-set to ${editVcpus}`)
      } else {
        await setVcpus(name, editVcpus)
        toast.success(`vCPUs set to ${editVcpus} (effective on next boot)`)
      }
      setDialog(null); load()
    } catch (e: unknown) { toast.error(`Failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleSetMemory = async () => {
    if (!name) return
    try {
      if (vm?.state === 'running') {
        await liveSetMemory(name, editMemory)
        toast.success(`Memory live-set to ${editMemory} MB`)
      } else {
        await setMemory(name, editMemory)
        toast.success(`Memory set to ${editMemory} MB (effective on next boot)`)
      }
      setDialog(null); load()
    } catch (e: unknown) { toast.error(`Failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleBalloon = async () => {
    if (!name) return
    try { await setMemoryBalloon(name, balloonMb); toast.success(`Memory ballooned to ${balloonMb} MB`); setDialog(null); load() } catch (e: unknown) { toast.error(`Failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleSetBootOrder = async () => {
    if (!name) return
    try { await setBootOrder(name, bootDevices); toast.success('Boot order updated'); setDialog(null); load(); setVmXml('') } catch (e: unknown) { toast.error(`Failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleInsertCdrom = async () => {
    if (!name || !cdromPath) return
    try { await insertCdrom(name, cdromPath, cdromTarget); toast.success('CD-ROM inserted'); setDialog(null); setCdromPath(''); load(); setVmXml('') } catch (e: unknown) { toast.error(`Insert failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleCreateSnapshot = async () => {
    if (!name || !snapName.trim()) return
    try { await createSnapshot(name, snapName.trim(), snapDesc, snapDiskOnly); toast.success(`Snapshot '${snapName}' created`); setDialog(null); setSnapName(''); setSnapDesc(''); setSnapDiskOnly(false); load() } catch (e: unknown) { toast.error(`Snapshot failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleDeleteSnapshot = async (snapN: string) => {
    if (!name) return
    try { await deleteSnapshot(name, snapN); toast.success(`Snapshot '${snapN}' deleted`); load() } catch (e: unknown) { toast.error(`Delete failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleRevertSnapshot = async (snapN: string) => {
    if (!name) return
    try { await revertSnapshot(name, snapN); toast.success(`Reverted to '${snapN}'`); load() } catch (e: unknown) { toast.error(`Revert failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleAttachDisk = async () => {
    if (!name || !attachSource.trim()) return
    try {
      const { apiPostVoid } = await import('../api/client')
      await apiPostVoid(`/api/v1/vms/${encodeURIComponent(name)}/disk/attach`, { source: attachSource.trim(), target: attachTarget, driver: attachDriver })
      toast.success('Disk attached'); setDialog(null); setAttachSource(''); load(); setVmXml('')
    } catch (e: unknown) { toast.error(`Attach failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleDetachDisk = async (targetDev: string) => {
    if (!name) return
    try {
      const { apiPostVoid } = await import('../api/client')
      await apiPostVoid(`/api/v1/vms/${encodeURIComponent(name)}/disk/detach/${encodeURIComponent(targetDev)}`)
      toast.success(`Disk '${targetDev}' detached`); load(); setVmXml('')
    } catch (e: unknown) { toast.error(`Detach failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleResizeDisk = async () => {
    if (!name || !resizeTarget) return
    try { await resizeDisk(name, resizeTarget, resizeGb); toast.success(`Disk '${resizeTarget}' resized to ${resizeGb} GB`); setDialog(null); load() } catch (e: unknown) { toast.error(`Resize failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleAttachNic = async () => {
    if (!name || !nicNetwork.trim()) return
    try { await attachInterface(name, nicNetwork.trim(), nicModel); toast.success(`NIC attached to '${nicNetwork}'`); setDialog(null); load(); setVmXml('') } catch (e: unknown) { toast.error(`Attach failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleAttachUsb = async (vendorId?: string, productId?: string) => {
    if (!name) return
    const vid = vendorId ?? selectedUsb.split(':')[0]
    const pid = productId ?? selectedUsb.split(':')[1]
    if (!vid || !pid) return
    try { await attachUsb(name, vid, pid); toast.success('USB device attached'); setDialog(null); load(); setVmXml('') } catch (e: unknown) { toast.error(`Failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleDetachUsb = async (vid: string, pid: string) => {
    if (!name) return
    try { await detachUsb(name, vid, pid); toast.success('USB device detached'); load(); setVmXml('') } catch (e: unknown) { toast.error(`Failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleDetachNic = async (mac: string) => {
    if (!name) return
    try { await detachInterface(name, mac); toast.success(`NIC '${mac}' detached`); load(); setVmXml('') } catch (e: unknown) { toast.error(`Detach failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleSaveTemplate = async () => {
    if (!name || !templateName.trim()) return
    try {
      await saveVmAsTemplate(name, templateName.trim())
      toast.success(`Saved as template '${templateName.trim()}'`)
      setDialog(null)
    } catch (e: unknown) {
      toast.error(`Save template failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  const downloadXml = () => {
    if (!vmXml || !vm) return
    const blob = new Blob([vmXml], { type: 'text/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${vm.name}.xml`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('XML downloaded')
  }

  const confirmDetachDisk = async () => {
    if (detachDiskTarget) { await handleDetachDisk(detachDiskTarget); setDetachDiskTarget(null) }
  }

  const confirmDetachNic = async () => {
    if (detachNicMac) { await handleDetachNic(detachNicMac); setDetachNicMac(null) }
  }

  const confirmDeleteSnapshot = async () => {
    if (deleteSnapName) { await handleDeleteSnapshot(deleteSnapName); setDeleteSnapName(null) }
  }

  const toggleAutostart = async () => {
    if (!name || !vm) return
    try { await setAutostart(name, !vm.autostart); toast.success(`Autostart ${!vm.autostart ? 'enabled' : 'disabled'}`); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const moveBootDevice = (index: number, dir: -1 | 1) => {
    const newDevices = [...bootDevices]
    const target = index + dir
    if (target < 0 || target >= newDevices.length) return
    ;[newDevices[index], newDevices[target]] = [newDevices[target], newDevices[index]]
    setBootDevices(newDevices)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
  if (!vm) return <div className="text-center text-slate-500 py-12">VM not found</div>

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Cpu className="w-4 h-4" /> },
    { key: 'disks', label: `Disks (${vm.disks.length})`, icon: <HardDrive className="w-4 h-4" /> },
    { key: 'network', label: `Network (${vm.interfaces.length})`, icon: <Network className="w-4 h-4" /> },
    { key: 'snapshots', label: `Snapshots (${snapshots.length})`, icon: <Camera className="w-4 h-4" /> },
    { key: 'devices', label: 'Devices', icon: <Monitor className="w-4 h-4" /> },
    { key: 'xml', label: 'XML', icon: <Code className="w-4 h-4" /> },
    { key: 'logs', label: 'Logs', icon: <Terminal className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Back to VM list"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{vm.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStateBadgeClasses(vm.state)}`}>{vm.state}</span>
            <span className="text-sm text-slate-500 font-mono">{vm.uuid}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {vmTags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded-full text-xs font-medium">
                <Tag className="w-3 h-3" />{t}
                <button onClick={async () => { const next = vmTags.filter(x => x !== t); try { await apiSetVmTags(vm.name, next); setVmTags(next) } catch {} }} className="hover:text-red-400 ml-0.5" aria-label={`Remove tag ${t}`}><X className="w-3 h-3" /></button>
              </span>
            ))}
            <form className="inline-flex items-center gap-1" onSubmit={async (e) => { e.preventDefault(); const tag = newTag.trim(); if (!tag || vmTags.includes(tag)) return; const next = [...vmTags, tag]; try { await apiSetVmTags(vm.name, next); setVmTags(next); setNewTag('') } catch {} }}>
              <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="+ tag" className="w-16 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs focus:outline-none focus:border-blue-500 text-slate-300" />
            </form>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link to={`/vms/${vm.name}/console`} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition flex items-center gap-1"><Terminal className="w-4 h-4" /> Console</Link>
          <button onClick={() => setSshDialogOpen(true)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition flex items-center gap-1"><Terminal className="w-4 h-4" /> SSH</button>
          {vm.state === 'shutoff' && <button onClick={() => action(startVM, 'Start')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition flex items-center gap-1"><Play className="w-4 h-4" /> Start</button>}
          {vm.state === 'running' && (
            <>
              <button onClick={() => action(shutdownVM, 'Shutdown')} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm transition flex items-center gap-1"><Power className="w-4 h-4" /> Shutdown</button>
              <button onClick={() => action(rebootVM, 'Reboot')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition flex items-center gap-1"><RotateCcw className="w-4 h-4" /> Reboot</button>
              <button onClick={() => action(stopVM, 'Force Stop')} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition flex items-center gap-1"><Square className="w-4 h-4" /> Stop</button>
              <button onClick={() => action(pauseVM, 'Pause')} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition flex items-center gap-1"><Pause className="w-4 h-4" /> Pause</button>
              <button onClick={() => action(managedSave, 'Managed Save')} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition flex items-center gap-1"><Save className="w-4 h-4" /> Save</button>
            </>
          )}
          {vm.state === 'paused' && <button onClick={() => action(resumeVM, 'Resume')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Resume</button>}
          {hasSave && <button onClick={() => action(managedSaveRemove, 'Remove Save')} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm transition flex items-center gap-1"><Save className="w-4 h-4" /> Remove Save</button>}
        </div>
      </div>

      {/* Settings Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 mr-1"><Settings className="w-3.5 h-3.5 inline -mt-0.5" /> Settings:</span>
        <button onClick={() => openDialog('vcpus')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><Cpu className="w-3 h-3 inline -mt-0.5" /> vCPUs</button>
        <button onClick={() => openDialog('memory')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><MemoryStick className="w-3 h-3 inline -mt-0.5" /> Memory</button>
        {vm.state === 'running' && <button onClick={() => openDialog('balloon')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><MemoryStick className="w-3 h-3 inline -mt-0.5" /> Balloon</button>}
        <button onClick={() => openDialog('boot-order')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><Settings className="w-3 h-3 inline -mt-0.5" /> Boot Order</button>
        <button onClick={() => openDialog('cdrom')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><Disc className="w-3 h-3 inline -mt-0.5" /> CD-ROM</button>
        <button onClick={() => openDialog('clone')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><Copy className="w-3 h-3 inline -mt-0.5" /> Clone</button>
        {vm.state === 'shutoff' && <button onClick={() => openDialog('rename')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><Pencil className="w-3 h-3 inline -mt-0.5" /> Rename</button>}
        <button onClick={() => openDialog('migrate')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><ArrowRightLeft className="w-3 h-3 inline -mt-0.5" /> Migrate</button>
        <button disabled={backingUp} onClick={async () => { if (backingUp) return; setBackingUp(true); toast.info('Backup started in background'); try { await triggerBackup({ vm_name: vm.name }); toast.success(`Backup triggered successfully for '${vm.name}'`) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } finally { setBackingUp(false) } }} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition disabled:opacity-50"><Archive className="w-3 h-3 inline -mt-0.5" /> {backingUp ? '...' : 'Backup'}</button>
        <button onClick={() => openDialog('save-template')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><Layers className="w-3 h-3 inline -mt-0.5" /> Save Template</button>
        <button onClick={load} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition" aria-label="Refresh"><RefreshCw className="w-3 h-3" /></button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700/50">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm transition border-b-2 ${tab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────── */}

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
            <h3 className="text-lg font-semibold">Configuration</h3>
            <EditableRow label="vCPUs" value={vm.vcpus} onEdit={() => openDialog('vcpus')} />
            <EditableRow label="Memory" value={`${vm.memory_mb} MB`} onEdit={() => openDialog('memory')} />
            <InfoRow label="OS Type" value={vm.os_type} />
            <InfoRow label="Architecture" value={vm.arch} />
            <InfoRow label="Persistent" value={vm.persistent ? 'Yes' : 'No'} />
            <InfoRow label="Managed Save" value={hasSave ? 'Yes' : 'No'} />
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400 text-sm">Autostart</span>
              <button onClick={toggleAutostart} className="flex items-center gap-2 text-sm">
                {vm.autostart ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                <span className={vm.autostart ? 'text-green-400' : 'text-slate-500'}>{vm.autostart ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>
          </div>

          {bootConfig && (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Boot Configuration</h3>
                <button onClick={() => openDialog('boot-order')} className="text-xs text-blue-400 hover:text-blue-300 transition">Edit</button>
              </div>
              <InfoRow label="Boot Devices" value={bootConfig.boot_devices.join(', ') || 'None'} />
              <InfoRow label="Firmware" value={bootConfig.firmware} />
              <InfoRow label="Secure Boot" value={bootConfig.secure_boot ? 'Yes' : 'No'} />
              {bootConfig.kernel && <InfoRow label="Kernel" value={bootConfig.kernel} />}
              {bootConfig.initrd && <InfoRow label="Initrd" value={bootConfig.initrd} />}
              {bootConfig.cmdline && <InfoRow label="Cmdline" value={bootConfig.cmdline} />}
            </div>
          )}

          {guestIps.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
              <h3 className="text-lg font-semibold">Guest IP Addresses</h3>
              {guestIps.map((ip, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700/30">
                  <div>
                    <span className="text-sm font-medium text-blue-400">{ip.address}/{ip.prefix}</span>
                    <span className="text-xs text-slate-500 ml-2">{ip.ip_type}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-slate-400">{ip.mac}</div>
                    <div className="text-xs text-slate-500">{ip.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {metrics && (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
              <h3 className="text-lg font-semibold">Live Metrics</h3>
              <InfoRow label="Memory Used" value={`${metrics.memory_used_mb} / ${metrics.memory_total_mb} MB (${metrics.memory_pct.toFixed(1)}%)`} />
              <InfoRow label="Disk Read" value={formatBytes(metrics.disk_rd_bytes)} />
              <InfoRow label="Disk Write" value={formatBytes(metrics.disk_wr_bytes)} />
              <InfoRow label="Net RX" value={formatBytes(metrics.net_rx_bytes)} />
              <InfoRow label="Net TX" value={formatBytes(metrics.net_tx_bytes)} />
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Memory</span><span>{metrics.memory_pct.toFixed(0)}%</span></div>
                <div className="w-full bg-slate-700 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${metrics.memory_pct}%` }} /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-VM Metrics Charts (below overview, visible when running) */}
      {tab === 'overview' && metricsHistory.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><MemoryStick className="w-4 h-4 text-blue-400" /> Memory Usage</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={metricsHistory}>
                <defs><linearGradient id="memG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem' }} labelStyle={{ color: '#94a3b8' }} />
                <Area type="monotone" dataKey="memory" name="Memory %" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#memG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><HardDrive className="w-4 h-4 text-emerald-400" /> Disk I/O</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={metricsHistory}>
                <defs>
                  <linearGradient id="rdG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="wrG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} tickFormatter={(v: number) => formatBytes(v)} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem' }} labelStyle={{ color: '#94a3b8' }} formatter={(v: number) => formatBytes(v)} />
                <Area type="monotone" dataKey="diskRd" name="Read" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#rdG)" />
                <Area type="monotone" dataKey="diskWr" name="Write" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={1} fill="url(#wrG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 lg:col-span-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><Network className="w-4 h-4 text-cyan-400" /> Network Throughput</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={metricsHistory}>
                <defs>
                  <linearGradient id="rxG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                  <linearGradient id="txG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} /><stop offset="95%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} tickFormatter={(v: number) => formatBytes(v)} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem' }} labelStyle={{ color: '#94a3b8' }} formatter={(v: number) => formatBytes(v)} />
                <Area type="monotone" dataKey="netRx" name="RX" stroke="#06b6d4" strokeWidth={1.5} fillOpacity={1} fill="url(#rxG)" />
                <Area type="monotone" dataKey="netTx" name="TX" stroke="#a855f7" strokeWidth={1.5} fillOpacity={1} fill="url(#txG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Disks Tab ────────────────────────────────────────────── */}

      {tab === 'disks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => openDialog('attach-disk')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition flex items-center gap-1"><Plus className="w-4 h-4" /> Attach Disk</button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Target</th><th className="px-6 py-3">Device</th><th className="px-6 py-3">Driver</th><th className="px-6 py-3">Source</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {vm.disks.map((d, i) => (
                  <tr key={i} className="table-row-hover">
                    <td className="px-6 py-3 font-mono text-sm">{d.target}</td>
                    <td className="px-6 py-3 text-sm">{d.device}</td>
                    <td className="px-6 py-3 text-sm">{d.driver}</td>
                    <td className="px-6 py-3 text-sm text-slate-400 truncate max-w-xs">{d.source}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {d.device === 'disk' && <button onClick={() => { setResizeTarget(d.target); setResizeGb(20); setDialog('resize-disk') }} className="p-1 hover:bg-blue-600/20 rounded transition" title="Resize disk" aria-label={`Resize ${d.target}`}>
                          <HardDrive className="w-4 h-4 text-blue-400" />
                        </button>}
                        <button onClick={() => setDetachDiskTarget(d.target)} className="p-1 hover:bg-red-600/20 rounded transition" title="Detach disk" aria-label={`Detach ${d.target}`}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {vm.disks.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No disks attached</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Network Tab ──────────────────────────────────────────── */}

      {tab === 'network' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setNicNetwork(networks[0]?.name || 'default'); setDialog('attach-nic') }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition flex items-center gap-1"><Plus className="w-4 h-4" /> Add NIC</button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">MAC Address</th><th className="px-6 py-3">Source</th><th className="px-6 py-3">Model</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {vm.interfaces.map((iface, i) => (
                  <tr key={i} className="table-row-hover">
                    <td className="px-6 py-3 font-mono text-sm">{iface.mac_address}</td>
                    <td className="px-6 py-3 text-sm">{iface.source}</td>
                    <td className="px-6 py-3 text-sm">{iface.model}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => setDetachNicMac(iface.mac_address)} className="p-1 hover:bg-red-600/20 rounded transition" title="Detach NIC" aria-label={`Detach ${iface.mac_address}`}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
                {vm.interfaces.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No network interfaces</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Snapshots Tab ────────────────────────────────────────── */}

      {tab === 'snapshots' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => openDialog('snapshot')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition flex items-center gap-1"><Plus className="w-4 h-4" /> Create Snapshot</button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            {snapshots.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No snapshots. Create one to save the current VM state.</div>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Name</th><th className="px-6 py-3">State</th><th className="px-6 py-3">Created</th><th className="px-6 py-3">Current</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-700/30">
                  {snapshots.map((s) => (
                    <tr key={s.name} className="table-row-hover">
                      <td className="px-6 py-3 font-medium">{s.name}{s.description && <span className="text-xs text-slate-500 ml-2">{s.description}</span>}</td>
                      <td className="px-6 py-3 text-sm text-slate-400">{s.state}</td>
                      <td className="px-6 py-3 text-sm text-slate-400">{s.creation_time ? new Date(s.creation_time * 1000).toLocaleString() : '-'}</td>
                      <td className="px-6 py-3">{s.is_current && <span className="text-green-400 text-xs font-medium">Current</span>}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleRevertSnapshot(s.name)} className="p-1 hover:bg-blue-600/20 rounded transition" title="Revert to this snapshot" aria-label={`Revert to ${s.name}`}>
                            <RotateCw className="w-4 h-4 text-blue-400" />
                          </button>
                          <button onClick={() => setDeleteSnapName(s.name)} className="p-1 hover:bg-red-600/20 rounded transition" title="Delete snapshot" aria-label={`Delete ${s.name}`}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Devices Tab (USB + PCI) ─────────────────────────────── */}

      {tab === 'devices' && (
        <div className="space-y-6">
          {/* USB Devices */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Usb className="w-5 h-5 text-blue-400" /> USB Devices</h3>
              <button onClick={() => setDialog('attach-usb')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition flex items-center gap-1"><Plus className="w-4 h-4" /> Attach USB</button>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700/50 text-left text-xs text-slate-500"><th className="px-6 py-2">Bus</th><th className="px-6 py-2">Device</th><th className="px-6 py-2">ID</th><th className="px-6 py-2">Description</th><th className="px-6 py-2 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-700/30 text-sm">
                  {usbDevices.map((d, i) => (
                    <tr key={i} className="table-row-hover">
                      <td className="px-6 py-2 font-mono text-xs">{d.bus}</td>
                      <td className="px-6 py-2 font-mono text-xs">{d.device}</td>
                      <td className="px-6 py-2 font-mono text-blue-400">{d.vendor_id}:{d.product_id}</td>
                      <td className="px-6 py-2 text-slate-300">{d.description}</td>
                      <td className="px-6 py-2 text-right">
                        <button onClick={() => handleAttachUsb(d.vendor_id, d.product_id)} className="px-2 py-0.5 bg-blue-600/20 hover:bg-blue-600/30 rounded text-xs text-blue-400 transition">Attach</button>
                      </td>
                    </tr>
                  ))}
                  {usbDevices.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No USB devices found on host</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* PCI Devices */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Monitor className="w-5 h-5 text-purple-400" /> PCI Devices</h3>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700/50 text-left text-xs text-slate-500"><th className="px-6 py-2">Slot</th><th className="px-6 py-2">Class</th><th className="px-6 py-2">Vendor</th><th className="px-6 py-2">Device</th><th className="px-6 py-2">IOMMU Group</th></tr></thead>
                <tbody className="divide-y divide-slate-700/30 text-sm">
                  {pciDevices.map((d, i) => (
                    <tr key={i} className="table-row-hover">
                      <td className="px-6 py-2 font-mono text-xs text-blue-400">{d.slot}</td>
                      <td className="px-6 py-2 text-slate-300">{d.class}</td>
                      <td className="px-6 py-2 text-slate-300">{d.vendor}</td>
                      <td className="px-6 py-2 text-slate-300">{d.device}</td>
                      <td className="px-6 py-2 font-mono text-xs text-slate-400">{d.iommu_group || '-'}</td>
                    </tr>
                  ))}
                  {pciDevices.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No PCI devices found or lspci not available</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* IOMMU Groups */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-orange-400" /> IOMMU Groups</h3>
            {iommuGroups.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center text-slate-500">No IOMMU groups found. IOMMU may not be enabled or /sys/kernel/iommu_groups is empty.</div>
            ) : (
              <div className="space-y-3">
                {iommuGroups.map((g) => (
                  <div key={g.group_id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                    <div className="px-5 py-2.5 bg-slate-800/80 border-b border-slate-700/50 text-sm font-medium text-orange-400">Group {g.group_id} ({g.devices.length} device{g.devices.length !== 1 ? 's' : ''})</div>
                    <table className="w-full">
                      <thead><tr className="border-b border-slate-700/50 text-left text-xs text-slate-500"><th className="px-5 py-2">BDF</th><th className="px-5 py-2">Vendor</th><th className="px-5 py-2">Device</th></tr></thead>
                      <tbody className="divide-y divide-slate-700/30 text-sm">
                        {g.devices.map((d, i) => (
                          <tr key={i} className="table-row-hover">
                            <td className="px-5 py-2 font-mono text-xs text-blue-400">{d.bdf}</td>
                            <td className="px-5 py-2 text-slate-300">{d.vendor || '-'}</td>
                            <td className="px-5 py-2 text-slate-300">{d.device_name || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── XML Tab ──────────────────────────────────────────────── */}

      {tab === 'xml' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-sm text-slate-400">Domain XML Configuration</span>
            <div className="flex items-center gap-3">
              <button onClick={downloadXml} className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>
              <button onClick={() => { if (vmXml) navigator.clipboard.writeText(vmXml).then(() => toast.success('XML copied')) }} className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
            </div>
          </div>
          <pre className="p-6 text-xs font-mono text-slate-300 overflow-x-auto max-h-[600px] whitespace-pre">{vmXml || 'Loading...'}</pre>
        </div>
      )}

      {/* ── Logs Tab ────────────────────────────────────────────── */}

      {tab === 'logs' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-sm text-slate-400">QEMU Log ({`/var/log/libvirt/qemu/${vm.name}.log`})</span>
            <div className="flex items-center gap-3">
              <select value={logsLines} onChange={(e) => setLogsLines(parseInt(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300">
                <option value={500}>500 lines</option>
                <option value={1000}>1000 lines</option>
                <option value={2000}>2000 lines</option>
                <option value={5000}>5000 lines</option>
              </select>
              <button onClick={() => { if (name) getVMLogs(name, logsLines).then((r) => setLogsContent(r.content)).catch(() => setLogsContent('Failed to load logs')) }} className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Refresh</button>
            </div>
          </div>
          <pre className="p-6 text-xs font-mono text-slate-300 overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre">{logsContent || 'No log content available.'}</pre>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────── */}

      {dialog && (
        <DialogOverlay onClose={() => setDialog(null)}>
          {dialog === 'vcpus' && (
            <DialogBox title="Set vCPUs" icon={<Cpu className="w-5 h-5 text-blue-400" />} onClose={() => setDialog(null)} onConfirm={handleSetVcpus} confirmLabel="Apply">
              <label htmlFor="dlg-vcpus" className="block text-sm text-slate-400 mb-1">vCPU Count (1-256)</label>
              <input id="dlg-vcpus" type="number" min={1} max={256} autoFocus value={editVcpus} onChange={(e) => setEditVcpus(parseInt(e.target.value) || 1)} className="input-field" />
              <p className="text-xs text-slate-500 mt-2">Changes to a running VM take effect on next reboot.</p>
            </DialogBox>
          )}

          {dialog === 'memory' && (
            <DialogBox title="Set Memory" icon={<MemoryStick className="w-5 h-5 text-blue-400" />} onClose={() => setDialog(null)} onConfirm={handleSetMemory} confirmLabel="Apply">
              <label htmlFor="dlg-mem" className="block text-sm text-slate-400 mb-1">Memory (MB, 64 - 1048576)</label>
              <input id="dlg-mem" type="number" min={64} max={1048576} autoFocus value={editMemory} onChange={(e) => setEditMemory(parseInt(e.target.value) || 2048)} className="input-field" />
              <p className="text-xs text-slate-500 mt-2">Sets the maximum memory allocation. Takes effect on next reboot.</p>
            </DialogBox>
          )}

          {dialog === 'balloon' && (
            <DialogBox title="Memory Balloon" icon={<MemoryStick className="w-5 h-5 text-purple-400" />} onClose={() => setDialog(null)} onConfirm={handleBalloon} confirmLabel="Apply">
              <label htmlFor="dlg-balloon" className="block text-sm text-slate-400 mb-1">Target Memory (MB)</label>
              <input id="dlg-balloon" type="number" min={64} autoFocus value={balloonMb} onChange={(e) => setBalloonMb(parseInt(e.target.value) || 64)} className="input-field" />
              <p className="text-xs text-slate-500 mt-2">Dynamically adjust memory on a running VM. The guest must have balloon drivers installed.</p>
            </DialogBox>
          )}

          {dialog === 'clone' && (
            <DialogBox title="Clone VM" icon={<Copy className="w-5 h-5 text-green-400" />} onClose={() => setDialog(null)} onConfirm={handleClone} confirmLabel="Clone">
              <label htmlFor="dlg-clone" className="block text-sm text-slate-400 mb-1">New VM Name</label>
              <input id="dlg-clone" type="text" autoFocus value={cloneName} onChange={(e) => setCloneName(e.target.value)} className="input-field" placeholder="my-vm-clone" />
              <p className="text-xs text-slate-500 mt-2">Creates a copy of the VM definition with new UUID and MAC addresses. Disk images are NOT copied.</p>
            </DialogBox>
          )}

          {dialog === 'rename' && (
            <DialogBox title="Rename VM" icon={<Pencil className="w-5 h-5 text-yellow-400" />} onClose={() => setDialog(null)} onConfirm={handleRename} confirmLabel="Rename">
              <label htmlFor="dlg-rename" className="block text-sm text-slate-400 mb-1">New Name</label>
              <input id="dlg-rename" type="text" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field" />
              <p className="text-xs text-slate-500 mt-2">VM must be shut off to rename.</p>
            </DialogBox>
          )}

          {dialog === 'migrate' && (
            <DialogBox title="Migrate VM" icon={<ArrowRightLeft className="w-5 h-5 text-cyan-400" />} onClose={() => setDialog(null)} onConfirm={handleMigrate} confirmLabel="Migrate">
              <label htmlFor="dlg-migrate" className="block text-sm text-slate-400 mb-1">Destination URI</label>
              <input id="dlg-migrate" type="text" autoFocus value={migrateUri} onChange={(e) => setMigrateUri(e.target.value)} className="input-field" placeholder="qemu+ssh://host/system" />
              <div className="flex items-center gap-2 mt-3">
                <input id="dlg-live" type="checkbox" checked={migrateLive} onChange={(e) => setMigrateLive(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
                <label htmlFor="dlg-live" className="text-sm text-slate-300">Live migration (minimal downtime)</label>
              </div>
              <p className="text-xs text-slate-500 mt-2">Allowed URI schemes: qemu://, qemu+ssh://, qemu+tcp://, qemu+tls://, qemu+unix://</p>
            </DialogBox>
          )}

          {dialog === 'snapshot' && (
            <DialogBox title="Create Snapshot" icon={<Camera className="w-5 h-5 text-green-400" />} onClose={() => { setDialog(null); setSnapDiskOnly(false) }} onConfirm={handleCreateSnapshot} confirmLabel="Create">
              <label htmlFor="dlg-snap-name" className="block text-sm text-slate-400 mb-1">Snapshot Name</label>
              <input id="dlg-snap-name" type="text" autoFocus value={snapName} onChange={(e) => setSnapName(e.target.value)} className="input-field" placeholder="before-upgrade" />
              <label htmlFor="dlg-snap-desc" className="block text-sm text-slate-400 mb-1 mt-3">Description (optional)</label>
              <input id="dlg-snap-desc" type="text" value={snapDesc} onChange={(e) => setSnapDesc(e.target.value)} className="input-field" placeholder="Snapshot before kernel upgrade" />
              <div className="flex items-center gap-2 mt-3">
                <input id="dlg-snap-disk-only" type="checkbox" checked={snapDiskOnly} onChange={(e) => setSnapDiskOnly(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
                <label htmlFor="dlg-snap-disk-only" className="text-sm text-slate-300">Disk-only snapshot (faster, no memory state)</label>
              </div>
            </DialogBox>
          )}

          {dialog === 'boot-order' && (
            <DialogBox title="Edit Boot Order" icon={<Settings className="w-5 h-5 text-orange-400" />} onClose={() => setDialog(null)} onConfirm={handleSetBootOrder} confirmLabel="Save">
              <p className="text-sm text-slate-400 mb-3">Drag to reorder boot devices. VM must be restarted for changes to take effect.</p>
              <div className="space-y-2">
                {bootDevices.map((dev, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-500 w-4">{i + 1}.</span>
                    <span className="flex-1 text-sm font-medium">{dev}</span>
                    <button onClick={() => moveBootDevice(i, -1)} disabled={i === 0} className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => moveBootDevice(i, 1)} disabled={i === bootDevices.length - 1} className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-4 h-4" /></button>
                    <button onClick={() => setBootDevices(bootDevices.filter((_, j) => j !== i))} className="p-0.5 hover:bg-red-600/20 rounded" aria-label="Remove"><X className="w-4 h-4 text-red-400" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                {['hd', 'cdrom', 'network', 'fd'].filter(d => !bootDevices.includes(d)).map(d => (
                  <button key={d} onClick={() => setBootDevices([...bootDevices, d])} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs hover:bg-slate-700 transition">+ {d}</button>
                ))}
              </div>
            </DialogBox>
          )}

          {dialog === 'cdrom' && (() => {
            const cdromDisks = vm?.disks.filter(d => d.device === 'cdrom') || []
            return (
            <DialogBox title="CD-ROM Management" icon={<Disc className="w-5 h-5 text-blue-400" />} onClose={() => setDialog(null)} onConfirm={handleInsertCdrom} confirmLabel="Mount ISO">
              {/* Show existing CD-ROM devices */}
              {cdromDisks.length > 0 && (
                <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-500 block mb-2">Current CD-ROM devices:</span>
                  {cdromDisks.map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-sm"><span className="font-mono text-blue-400">{d.target}</span> {d.source ? <span className="text-slate-400 text-xs ml-2">{d.source.split('/').pop()}</span> : <span className="text-slate-500 text-xs ml-2">(empty)</span>}</span>
                      {d.source && <button onClick={() => { if (name) { ejectCdrom(name, d.target).then(() => { toast.success('CD-ROM ejected'); setDialog(null); load() }).catch((e: unknown) => toast.error(`Eject failed: ${e instanceof Error ? e.message : e}`)) } }} className="px-2 py-0.5 bg-red-600/20 hover:bg-red-600/30 rounded text-xs text-red-400 transition">Eject</button>}
                    </div>
                  ))}
                </div>
              )}
              {cdromDisks.length === 0 && (
                <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                  No CD-ROM drive found. A new one will be attached automatically.
                </div>
              )}
              <label htmlFor="dlg-iso" className="block text-sm text-slate-400 mb-1">ISO File</label>
              {isoFiles.length > 0 ? (
                <select id="dlg-iso" autoFocus value={cdromPath} onChange={(e) => setCdromPath(e.target.value)} className="input-field">
                  <option value="">Select ISO...</option>
                  {isoFiles.map(f => <option key={f.path} value={f.path}>{f.name} ({(f.size_bytes / 1048576).toFixed(0)} MB)</option>)}
                </select>
              ) : (
                <input id="dlg-iso" type="text" autoFocus value={cdromPath} onChange={(e) => setCdromPath(e.target.value)} placeholder="/var/lib/libvirt/images/image.iso" className="input-field" />
              )}
              <label htmlFor="dlg-cdtarget" className="block text-sm text-slate-400 mb-1 mt-3">Target Device</label>
              <select id="dlg-cdtarget" value={cdromTarget} onChange={(e) => setCdromTarget(e.target.value)} className="input-field">
                {cdromDisks.length > 0
                  ? cdromDisks.map(d => <option key={d.target} value={d.target}>{d.target}</option>)
                  : <><option value="sda">sda</option><option value="sdb">sdb</option><option value="hda">hda</option></>
                }
              </select>
              <p className="text-xs text-slate-500 mt-2">Enter the full path to an ISO file on the host. The VM {vm?.state === 'running' ? 'will see the change immediately' : 'will see it on next start'}.</p>
            </DialogBox>
            )
          })()}

          {dialog === 'attach-disk' && (
            <DialogBox title="Attach Disk" icon={<HardDrive className="w-5 h-5 text-blue-400" />} onClose={() => setDialog(null)} onConfirm={handleAttachDisk} confirmLabel="Attach">
              <label htmlFor="dlg-disk-src" className="block text-sm text-slate-400 mb-1">Disk Image Path</label>
              <input id="dlg-disk-src" type="text" autoFocus value={attachSource} onChange={(e) => setAttachSource(e.target.value)} placeholder="/var/lib/libvirt/images/data.qcow2" className="input-field" />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label htmlFor="dlg-disk-target" className="block text-sm text-slate-400 mb-1">Target Device</label>
                  <input id="dlg-disk-target" type="text" value={attachTarget} onChange={(e) => setAttachTarget(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label htmlFor="dlg-disk-driver" className="block text-sm text-slate-400 mb-1">Driver</label>
                  <select id="dlg-disk-driver" value={attachDriver} onChange={(e) => setAttachDriver(e.target.value)} className="input-field">
                    <option value="qcow2">qcow2</option>
                    <option value="raw">raw</option>
                  </select>
                </div>
              </div>
            </DialogBox>
          )}

          {dialog === 'resize-disk' && (
            <DialogBox title={`Resize Disk (${resizeTarget})`} icon={<HardDrive className="w-5 h-5 text-green-400" />} onClose={() => setDialog(null)} onConfirm={handleResizeDisk} confirmLabel="Resize">
              <label htmlFor="dlg-resize" className="block text-sm text-slate-400 mb-1">New Size (GB)</label>
              <input id="dlg-resize" type="number" min={1} max={10240} autoFocus value={resizeGb} onChange={(e) => setResizeGb(parseInt(e.target.value) || 1)} className="input-field" />
              <p className="text-xs text-slate-500 mt-2">Can only grow, not shrink. VM must be running with guest agent or shut off.</p>
            </DialogBox>
          )}

          {dialog === 'attach-nic' && (
            <DialogBox title="Add Network Interface" icon={<Network className="w-5 h-5 text-cyan-400" />} onClose={() => setDialog(null)} onConfirm={handleAttachNic} confirmLabel="Attach">
              <label htmlFor="dlg-nic-net" className="block text-sm text-slate-400 mb-1">Network</label>
              {networks.length > 0 ? (
                <select id="dlg-nic-net" autoFocus value={nicNetwork} onChange={(e) => setNicNetwork(e.target.value)} className="input-field">
                  {networks.map(n => <option key={n.name} value={n.name}>{n.name}{n.active ? '' : ' (inactive)'}</option>)}
                </select>
              ) : (
                <input id="dlg-nic-net" type="text" autoFocus value={nicNetwork} onChange={(e) => setNicNetwork(e.target.value)} className="input-field" placeholder="default" />
              )}
              <label htmlFor="dlg-nic-model" className="block text-sm text-slate-400 mb-1 mt-3">Model</label>
              <select id="dlg-nic-model" value={nicModel} onChange={(e) => setNicModel(e.target.value)} className="input-field">
                <option value="virtio">virtio</option>
                <option value="e1000">e1000</option>
                <option value="rtl8139">rtl8139</option>
              </select>
            </DialogBox>
          )}

          {dialog === 'save-template' && (
            <DialogBox title="Save as Template" icon={<Layers className="w-5 h-5 text-purple-400" />} onClose={() => setDialog(null)} onConfirm={handleSaveTemplate} confirmLabel="Save">
              <label htmlFor="dlg-template-name" className="block text-sm text-slate-400 mb-1">Template Name</label>
              <input id="dlg-template-name" type="text" autoFocus value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="input-field" placeholder="my-vm-template" />
              <p className="text-xs text-slate-500 mt-2">Saves the VM configuration as a reusable template. Disk images are not included.</p>
            </DialogBox>
          )}
        </DialogOverlay>
      )}

      {/* Confirmation Dialogs for destructive actions */}
      <ConfirmDialog
        open={detachDiskTarget !== null}
        title="Detach Disk"
        message={`This will detach disk '${detachDiskTarget}' from the VM. The disk image will not be deleted.`}
        confirmLabel="Detach"
        onConfirm={confirmDetachDisk}
        onCancel={() => setDetachDiskTarget(null)}
      />
      <ConfirmDialog
        open={detachNicMac !== null}
        title="Detach Network Interface"
        message={`This will remove the network interface with MAC '${detachNicMac}' from the VM.`}
        confirmLabel="Detach"
        onConfirm={confirmDetachNic}
        onCancel={() => setDetachNicMac(null)}
      />
      <ConfirmDialog
        open={deleteSnapName !== null}
        title="Delete Snapshot"
        message={`This will permanently delete snapshot '${deleteSnapName}'. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteSnapshot}
        onCancel={() => setDeleteSnapName(null)}
      />

      {/* SSH Dialog — standalone, not using DialogOverlay/DialogBox to avoid click conflicts */}
      {sshDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
              <span className="text-lg font-semibold flex items-center gap-2"><Terminal className="w-5 h-5 text-green-400" /> SSH Connection</span>
              <button onClick={() => setSshDialogOpen(false)} className="p-1 hover:bg-slate-700 rounded transition"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <label htmlFor="dlg-ssh-ip" className="block text-sm text-slate-400 mb-1">Host IP Address</label>
              <input id="dlg-ssh-ip" type="text" autoFocus value={sshIp} onChange={(e) => setSshIp(e.target.value)} placeholder="192.168.122.100" className="input-field"
                onKeyDown={(e) => { if (e.key === 'Enter' && sshIp.trim()) window.location.href = `/ssh/${encodeURIComponent(sshIp.trim())}` }} />
              {guestIps.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500">Detected IPs:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {guestIps.map((ip, i) => (
                      <button key={i} type="button" onClick={() => setSshIp(ip.address)} className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs text-blue-400 hover:bg-slate-700 transition">{ip.address}</button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500">Opens browser SSH terminal to port 22 on the specified host.</p>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button type="button" onClick={() => setSshDialogOpen(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
              <button type="button" onClick={() => { if (sshIp.trim()) window.location.href = `/ssh/${encodeURIComponent(sshIp.trim())}` }} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm text-white font-medium transition">Connect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared components ──────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-sm font-medium">{String(value)}</span>
    </div>
  )
}

function EditableRow({ label, value, onEdit }: { label: string; value: string | number; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
      <span className="text-slate-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{String(value)}</span>
        <button onClick={onEdit} className="p-0.5 hover:bg-slate-700 rounded transition" aria-label={`Edit ${label}`}><Pencil className="w-3 h-3 text-slate-500 hover:text-blue-400" /></button>
      </div>
    </div>
  )
}

function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" onClick={onClose}>
      {children}
    </div>
  )
}

function DialogBox({ title, icon, onClose, onConfirm, confirmLabel, children }: {
  title: string; icon: React.ReactNode; onClose: () => void; onConfirm: () => void; confirmLabel: string; children: React.ReactNode
}) {
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
        <span className="text-lg font-semibold flex items-center gap-2">{icon} {title}</span>
        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition" aria-label="Close"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="p-5 space-y-1">{children}</div>
      <div className="flex justify-end gap-3 px-5 pb-5">
        <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition">{confirmLabel}</button>
      </div>
    </div>
  )
}
