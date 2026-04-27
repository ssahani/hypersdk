import { useCallback, useEffect, useState, useRef, useMemo, Fragment } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import {
  getVM, getVMMetrics, getVMXml, startVM, stopVM, shutdownVM, rebootVM, pauseVM, resumeVM,
  setAutostart, setVcpus, setMemory, setMemoryBalloon, setBootOrder,
  cloneVM, renameVM, migrateVM, resizeDisk, attachInterface, detachInterface,
  getInterfaces, getBootConfig, hasManagedSave, managedSave, managedSaveRemove,
  insertCdrom, ejectCdrom, getVMLogs, getCpuTune, getMemTune, getKubeVirtBundle, KubeVirtBundle,
  postKubeVirtApply, postKubeVirtUpload, postKubeVirtStart, type KubeVirtClusterExecResult,
  getBlockJobInfo, blockCommit, blockPull, blockJobAbort,
  setMemTune as applyMemTuneApi, setSchedulerTune, pinVcpu, getNumaTune, setNumaTune, pinEmulator,
  VmDetails, VmMetrics, GuestIpAddress, BootConfig, CpuTuneInfo, MemTuneInfo,
  VmDeleteUndefineOpts, BlockJobInfo,
  tuneVmDisk, tuneVmNic, setVmFirmware, attachVmTpm, detachVmTpm,
  attachVmWatchdog, attachVmSound, attachVmSerial, setVmVideoModel,
} from '../api/vm'
import {
  attachPciHostdev, detachPciHostdev, detachNodeDevice, reattachNodeDevice,
} from '../api/advanced'
import { listNetworks, NetworkInfo } from '../api/network'
import { listSnapshots, createSnapshot, deleteSnapshot, revertSnapshot, SnapshotInfo } from '../api/snapshot'
import { getStateBadgeClasses, formatBytes } from '../utils/vm'
import { loadVmSshPrefs, saveVmSshPrefs } from '../utils/vmSshPrefs'
import { addRecentVM } from '../utils/recentVMs'
import { snapshotForest, type SnapshotTreeNode } from '../utils/snapshotTree'
import { deleteVmWithNvramRetry } from '../utils/deleteVmWithNvramRetry'
import ConfirmDialog from '../components/ConfirmDialog'
import { ChoiceCard, ChoiceCardDenseGrid } from '../components/ChoiceCards'
import { BrowseHostPathModal, isHostDiskImageFileName, isIsoFileName } from '../components/BrowseHostPathModal'
import { useToastContext } from '../contexts/ToastContext'
import { triggerBackup } from '../api/backup'
import { listUsbDevices, attachUsb, detachUsb, listIsos, UsbDevice, ImageFile, liveSetVcpus, liveSetMemory, getVmTags, setVmTags as apiSetVmTags, listPciDevices, PciDevice, saveVmAsTemplate, listIommuGroups, IommuGroup } from '../api/extras'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  ArrowLeft, Play, Square, Power, RotateCcw, Pause, RefreshCw,
  ToggleLeft, ToggleRight, Cpu, HardDrive, Network, Camera, Terminal,
  Save, Disc, Archive, Copy, Pencil, ArrowRightLeft, Download,
  Plus, Trash2, RotateCw, Code, MemoryStick, Settings, Usb, Layers,
  ChevronUp, ChevronDown, X, Tag, Monitor, Shield, Sliders, FolderOpen,
} from 'lucide-react'

interface MetricsPoint { time: string; memory: number; diskRd: number; diskWr: number; netRx: number; netTx: number }

function SnapshotTableRows({
  nodes,
  depth,
  onRevert,
  onDelete,
}: {
  nodes: SnapshotTreeNode[]
  depth: number
  onRevert: (n: string) => void
  onDelete: (n: string) => void
}) {
  return (
    <>
      {nodes.map(({ snap, children }) => (
        <Fragment key={snap.name}>
          <tr className="table-row-hover">
            <td className="px-6 py-3 text-sm text-slate-500" style={{ paddingLeft: `${1.5 + depth * 1}rem` }}>
              {snap.parent ? <span className="text-slate-600 mr-1">↳</span> : null}
              <span className="font-medium text-slate-200">{snap.name}</span>
              {snap.description ? <span className="text-xs text-slate-500 ml-2">{snap.description}</span> : null}
            </td>
            <td className="px-6 py-3 text-sm text-slate-400">{snap.state}</td>
            <td className="px-6 py-3 text-sm text-slate-400">{snap.creation_time ? new Date(snap.creation_time * 1000).toLocaleString() : '-'}</td>
            <td className="px-6 py-3">{snap.is_current && <span className="text-green-400 text-xs font-medium">Current</span>}</td>
            <td className="px-6 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <button type="button" onClick={() => onRevert(snap.name)} className="p-1 hover:bg-blue-600/20 rounded transition" title="Revert" aria-label={`Revert ${snap.name}`}>
                  <RotateCw className="w-4 h-4 text-blue-400" />
                </button>
                <button type="button" onClick={() => onDelete(snap.name)} className="p-1 hover:bg-red-600/20 rounded transition" title="Delete" aria-label={`Delete ${snap.name}`}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </td>
          </tr>
          <SnapshotTableRows nodes={children} depth={depth + 1} onRevert={onRevert} onDelete={onDelete} />
        </Fragment>
      ))}
    </>
  )
}

type Tab = 'overview' | 'disks' | 'network' | 'snapshots' | 'devices' | 'xml' | 'logs' | 'advanced'
type Dialog = null | 'cdrom' | 'clone' | 'rename' | 'migrate' | 'snapshot' | 'boot-order' | 'vcpus' | 'memory' | 'balloon' | 'attach-disk' | 'resize-disk' | 'attach-nic' | 'attach-usb' | 'save-template'
  | 'delete-vm' | 'scheduler-tune' | 'memtune' | 'numa-tune' | 'emulator-pin' | 'pin-vcpu' | 'block-commit'
  | 'disk-tune' | 'nic-tune' | 'firmware' | 'watchdog' | 'sound' | 'serial' | 'video'

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
  const [migrateBandwidth, setMigrateBandwidth] = useState('')
  const [migrateUnsafe, setMigrateUnsafe] = useState(false)
  const [migratePostcopy, setMigratePostcopy] = useState(false)
  const [migrateTunnelled, setMigrateTunnelled] = useState(false)
  const [snapName, setSnapName] = useState('')
  const [snapDesc, setSnapDesc] = useState('')
  const [editVcpus, setEditVcpus] = useState(1)
  const [editMemory, setEditMemory] = useState(1024)
  const [balloonMb, setBalloonMb] = useState(0)
  const [bootDevices, setBootDevices] = useState<string[]>([])
  const [attachSource, setAttachSource] = useState('')
  const [attachTarget, setAttachTarget] = useState('vdb')
  const [attachDriver, setAttachDriver] = useState('qcow2')
  const [attachBus, setAttachBus] = useState('virtio')
  const [attachCache, setAttachCache] = useState('')
  const [attachDiscard, setAttachDiscard] = useState('')
  const [attachReadonly, setAttachReadonly] = useState(false)
  const [attachShareable, setAttachShareable] = useState(false)
  const [cdromBrowseOpen, setCdromBrowseOpen] = useState(false)
  const [attachDiskBrowseOpen, setAttachDiskBrowseOpen] = useState(false)
  const [kubevirtOpen, setKubevirtOpen] = useState(false)
  const [kubevirtBundle, setKubevirtBundle] = useState<KubeVirtBundle | null>(null)
  const [kubevirtLoading, setKubevirtLoading] = useState(false)
  /** Local checklist only (not sent to the server). */
  const [kubevirtDoneUpload, setKubevirtDoneUpload] = useState(false)
  const [kubevirtDoneApply, setKubevirtDoneApply] = useState(false)
  const [kubevirtDoneStart, setKubevirtDoneStart] = useState(false)
  const [kubevirtExecBusy, setKubevirtExecBusy] = useState<'apply' | 'upload' | 'start' | null>(null)
  const [kubevirtExecLast, setKubevirtExecLast] = useState<KubeVirtClusterExecResult | null>(null)
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
  const [sshUser, setSshUser] = useState('root')
  const [sshDialogOpen, setSshDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [snapDiskOnly, setSnapDiskOnly] = useState(false)
  const [logsContent, setLogsContent] = useState('')
  const [logsLines, setLogsLines] = useState(500)
  const [cpuTune, setCpuTune] = useState<CpuTuneInfo | null>(null)
  const [memTune, setMemTune] = useState<MemTuneInfo | null>(null)

  const [deleteUndefine, setDeleteUndefine] = useState<VmDeleteUndefineOpts>({})
  const [deleteVmTypeConfirm, setDeleteVmTypeConfirm] = useState('')
  const [blockDisk, setBlockDisk] = useState('')
  const [blockJob, setBlockJob] = useState<BlockJobInfo | null | undefined>(undefined)
  const [blockBase, setBlockBase] = useState('')
  const [blockTop, setBlockTop] = useState('')
  const [blockShallow, setBlockShallow] = useState(true)
  const [blockDelete, setBlockDelete] = useState(true)
  const [blockActive, setBlockActive] = useState(false)
  const [pciBdf, setPciBdf] = useState('')
  const [nodedevName, setNodedevName] = useState('')
  const [schedShares, setSchedShares] = useState('')
  const [schedPeriod, setSchedPeriod] = useState('')
  const [schedQuota, setSchedQuota] = useState('')
  const [memHardKb, setMemHardKb] = useState('')
  const [memSoftKb, setMemSoftKb] = useState('')
  const [memSwapKb, setMemSwapKb] = useState('')
  const [pinVcpuN, setPinVcpuN] = useState(0)
  const [pinMap, setPinMap] = useState<boolean[]>(() => Array.from({ length: 64 }, () => false))
  const [numaNodeSet, setNumaNodeSet] = useState('')
  const [numaModeInput, setNumaModeInput] = useState('')
  const [emuPinMap, setEmuPinMap] = useState<boolean[]>(() => Array.from({ length: 64 }, () => false))

  // Confirmation dialog state for destructive actions
  const [detachDiskTarget, setDetachDiskTarget] = useState<string | null>(null)
  const [detachNicMac, setDetachNicMac] = useState<string | null>(null)
  const [deleteSnapName, setDeleteSnapName] = useState<string | null>(null)

  const [tuneDiskTarget, setTuneDiskTarget] = useState('')
  const [tuneBus, setTuneBus] = useState('')
  const [tuneCache, setTuneCache] = useState('')
  const [tuneDiscard, setTuneDiscard] = useState('')
  const [tuneRo, setTuneRo] = useState('')
  const [tuneShare, setTuneShare] = useState('')
  const [tuneMac, setTuneMac] = useState('')
  const [tuneNicModel, setTuneNicModel] = useState('virtio')
  const [tuneNicNet, setTuneNicNet] = useState('')
  const [fwChoice, setFwChoice] = useState<'bios' | 'uefi'>('uefi')
  const [wdModel, setWdModel] = useState('i6300esb')
  const [wdAction, setWdAction] = useState('reset')
  const [sndModel, setSndModel] = useState('ich6')
  const [serPort, setSerPort] = useState(1)
  const [vidModel, setVidModel] = useState('qxl')

  const snapshotRoots = useMemo(() => snapshotForest(snapshots), [snapshots])

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
      try { setCpuTune(await getCpuTune(name)) } catch { /* optional */ }
      try { setMemTune(await getMemTune(name)) } catch { /* optional */ }
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
    listIsos().then((r) => setIsoFiles(r.files)).catch(() => {})
    listPciDevices().then(setPciDevices).catch(() => {})
    listIommuGroups().then(setIommuGroups).catch(() => {})
  }, [])

  useEffect(() => {
    if (dialog !== 'cdrom') setCdromBrowseOpen(false)
    if (dialog !== 'attach-disk') setAttachDiskBrowseOpen(false)
  }, [dialog])

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

  useEffect(() => {
    if (dialog === 'numa-tune' && name) {
      void getNumaTune(name)
        .then((n) => {
          setNumaNodeSet(n.node_set ?? '')
          setNumaModeInput(n.mode != null ? String(n.mode) : '')
        })
        .catch(() => {
          setNumaNodeSet('')
          setNumaModeInput('')
        })
    }
  }, [dialog, name])

  useEffect(() => {
    if (tab === 'advanced' && vm?.disks?.length && !blockDisk) {
      const t = vm.disks.find((d) => d.device === 'disk')?.target
      if (t) setBlockDisk(t)
    }
  }, [tab, vm, blockDisk])

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
      if (d === 'scheduler-tune') {
        setSchedShares(cpuTune?.shares != null ? String(cpuTune.shares) : '')
        setSchedPeriod(cpuTune?.period != null ? String(cpuTune.period) : '')
        setSchedQuota(cpuTune?.quota != null ? String(cpuTune.quota) : '')
      }
      if (d === 'memtune') {
        setMemHardKb(memTune?.hard_limit_kb != null ? String(memTune.hard_limit_kb) : '')
        setMemSoftKb(memTune?.soft_limit_kb != null ? String(memTune.soft_limit_kb) : '')
        setMemSwapKb(memTune?.swap_hard_limit_kb != null ? String(memTune.swap_hard_limit_kb) : '')
      }
      if (d === 'pin-vcpu') {
        setPinVcpuN(0)
        setPinMap(Array.from({ length: 64 }, () => false))
      }
      if (d === 'emulator-pin') {
        setEmuPinMap(Array.from({ length: 64 }, () => false))
      }
      if (d === 'delete-vm') {
        setDeleteUndefine({})
        setDeleteVmTypeConfirm('')
      }
      if (d === 'block-commit') {
        const first = vm.disks.find((x) => x.device === 'disk')?.target || ''
        setBlockDisk((prev) => prev || first)
        setBlockBase('')
        setBlockTop('')
      }
    }
    setDialog(d)
  }

  const runKubevirtClusterStep = async (kind: 'apply' | 'upload' | 'start') => {
    if (!name) return
    setKubevirtExecBusy(kind)
    setKubevirtExecLast(null)
    try {
      const fn =
        kind === 'apply'
          ? postKubeVirtApply
          : kind === 'upload'
            ? postKubeVirtUpload
            : postKubeVirtStart
      const r = await fn(name, {})
      setKubevirtExecLast(r)
      if (r.exit_code !== 0) {
        const hint = r.stderr?.trim() || r.stdout?.trim() || ''
        toast.error(`${kind}: exit ${r.exit_code}${hint ? ` — ${hint.slice(0, 200)}` : ''}`)
      } else {
        toast.success(`${kind === 'apply' ? 'kubectl apply' : kind === 'upload' ? 'virtctl image-upload' : 'virtctl start'} finished (exit 0)`)
      }
    } catch (e: unknown) {
      toast.error(`${kind}: ${e instanceof Error ? e.message : e}`)
    } finally {
      setKubevirtExecBusy(null)
    }
  }

  const loadKubevirtExport = async () => {
    if (!name) return
    setKubevirtLoading(true)
    setKubevirtBundle(null)
    setKubevirtDoneUpload(false)
    setKubevirtDoneApply(false)
    setKubevirtDoneStart(false)
    setKubevirtExecLast(null)
    try {
      const b = await getKubeVirtBundle(name)
      setKubevirtBundle(b)
      setKubevirtOpen(true)
    } catch (e: unknown) {
      toast.error(`KubeVirt bundle: ${e instanceof Error ? e.message : e}`)
    } finally {
      setKubevirtLoading(false)
    }
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
    try {
      const bw = migrateBandwidth.trim() === '' ? NaN : parseInt(migrateBandwidth, 10)
      await migrateVM(name, migrateUri.trim(), migrateLive, {
        unsafe_migrate: migrateUnsafe,
        postcopy: migratePostcopy,
        tunnelled: migrateTunnelled,
        parameters: !Number.isNaN(bw) && bw > 0 ? { bandwidth: bw } : undefined,
      })
      toast.success('Migration completed')
      setDialog(null)
    } catch (e: unknown) {
      toast.error(`Migration failed: ${e instanceof Error ? e.message : e}`)
    }
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
      const body: Record<string, unknown> = {
        source: attachSource.trim(),
        target: attachTarget,
        driver: attachDriver,
        bus: attachBus,
      }
      if (attachCache.trim()) body.cache = attachCache.trim()
      if (attachDiscard.trim()) body.discard = attachDiscard.trim()
      if (attachReadonly) body.readonly = true
      if (attachShareable) body.shareable = true
      await apiPostVoid(`/api/v1/vms/${encodeURIComponent(name)}/disk/attach`, body)
      toast.success('Disk attached'); setDialog(null); setAttachSource(''); load(); setVmXml('')
    } catch (e: unknown) { toast.error(`Attach failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleDiskTune = async () => {
    if (!name || !tuneDiskTarget) return
    try {
      const body: {
        target: string
        bus?: string
        cache?: string
        discard?: string
        readonly?: boolean
        shareable?: boolean
      } = { target: tuneDiskTarget }
      if (tuneBus.trim()) body.bus = tuneBus.trim()
      if (tuneCache.trim()) body.cache = tuneCache.trim()
      if (tuneDiscard.trim()) body.discard = tuneDiscard.trim()
      if (tuneRo === 'true') body.readonly = true
      if (tuneRo === 'false') body.readonly = false
      if (tuneShare === 'true') body.shareable = true
      if (tuneShare === 'false') body.shareable = false
      await tuneVmDisk(name, body)
      toast.success('Disk updated')
      setDialog(null)
      load()
      setVmXml('')
    } catch (e: unknown) {
      toast.error(`Disk tune failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleNicTune = async () => {
    if (!name || !tuneMac.trim()) return
    try {
      await tuneVmNic(name, {
        mac_address: tuneMac.trim(),
        ...(tuneNicModel.trim() ? { model: tuneNicModel.trim() } : {}),
        ...(tuneNicNet.trim() ? { network: tuneNicNet.trim() } : {}),
      })
      toast.success('NIC updated')
      setDialog(null)
      load()
      setVmXml('')
    } catch (e: unknown) {
      toast.error(`NIC tune failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleFirmwareSet = async () => {
    if (!name) return
    try {
      await setVmFirmware(name, fwChoice === 'uefi')
      toast.success(`Firmware set to ${fwChoice.toUpperCase()} (may require reboot / guest support)`)
      setDialog(null)
      load()
      setVmXml('')
    } catch (e: unknown) {
      toast.error(`Firmware: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleWatchdogAttach = async () => {
    if (!name) return
    try {
      await attachVmWatchdog(name, wdModel, wdAction)
      toast.success('Watchdog attached')
      setDialog(null)
      load()
      setVmXml('')
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleSoundAttach = async () => {
    if (!name) return
    try {
      await attachVmSound(name, sndModel)
      toast.success('Sound card attached')
      setDialog(null)
      load()
      setVmXml('')
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleSerialAttach = async () => {
    if (!name) return
    try {
      await attachVmSerial(name, serPort)
      toast.success(`Serial port ${serPort} attached`)
      setDialog(null)
      load()
      setVmXml('')
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleVideoSet = async () => {
    if (!name) return
    try {
      await setVmVideoModel(name, vidModel)
      toast.success('Video model updated')
      setDialog(null)
      load()
      setVmXml('')
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
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

  const handleDeleteVm = async () => {
    if (!name) return
    let nvramRetried = false
    try {
      await deleteVmWithNvramRetry(name, deleteUndefine, (merged) => {
        nvramRetried = true
        setDeleteUndefine(merged)
        toast.info('Retrying delete with UEFI NVRAM removal (same as virsh undefine --nvram)…')
      })
      toast.success(
        nvramRetried
          ? 'VM deleted (UEFI NVRAM removed as required by libvirt)'
          : 'VM deleted',
      )
      setDialog(null)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleSchedulerSave = async () => {
    if (!name) return
    try {
      const body: { cpu_shares?: number; vcpu_period?: number; vcpu_quota?: number } = {}
      if (schedShares.trim() !== '') body.cpu_shares = parseInt(schedShares, 10)
      if (schedPeriod.trim() !== '') body.vcpu_period = parseInt(schedPeriod, 10)
      if (schedQuota.trim() !== '') body.vcpu_quota = parseInt(schedQuota, 10)
      if (Object.keys(body).length === 0) {
        toast.warning('Enter at least one value')
        return
      }
      await setSchedulerTune(name, body)
      toast.success('Scheduler updated')
      setDialog(null)
      load()
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleMemtuneSave = async () => {
    if (!name) return
    try {
      const body: MemTuneInfo = {}
      if (memHardKb.trim() !== '') body.hard_limit_kb = parseInt(memHardKb, 10)
      if (memSoftKb.trim() !== '') body.soft_limit_kb = parseInt(memSoftKb, 10)
      if (memSwapKb.trim() !== '') body.swap_hard_limit_kb = parseInt(memSwapKb, 10)
      if (Object.keys(body).length === 0) {
        toast.warning('Enter at least one limit (KiB)')
        return
      }
      await applyMemTuneApi(name, body)
      toast.success('Memory tuning updated')
      setDialog(null)
      load()
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleNumaSave = async () => {
    if (!name) return
    const ns = numaNodeSet.trim()
    const ms = numaModeInput.trim()
    if (ns === '' && ms === '') {
      toast.warning('Enter node_set and/or mode to apply')
      return
    }
    let mode: number | null = null
    if (ms !== '') {
      const m = parseInt(ms, 10)
      if (Number.isNaN(m)) {
        toast.warning('Mode must be a libvirt mem mode integer')
        return
      }
      mode = m
    }
    try {
      await setNumaTune(name, {
        node_set: ns === '' ? null : ns,
        mode,
      })
      toast.success('NUMA tuning updated')
      setDialog(null)
      load()
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleEmulatorPinSave = async () => {
    if (!name) return
    try {
      await pinEmulator(name, emuPinMap)
      toast.success('Emulator threads pinned')
      setDialog(null)
      load()
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handlePinSave = async () => {
    if (!name) return
    try {
      await pinVcpu(name, pinVcpuN, pinMap)
      toast.success(`vCPU ${pinVcpuN} pinning updated`)
      setDialog(null)
      load()
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleBlockJobRefresh = async () => {
    if (!name || !blockDisk.trim()) {
      toast.warning('Select a disk target (e.g. vda)')
      return
    }
    try {
      const r = await getBlockJobInfo(name, blockDisk.trim(), true)
      setBlockJob(r.job ?? null)
      toast.success(r.job ? 'Active block job' : 'No block job on this disk')
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleBlockCommit = async () => {
    if (!name || !blockDisk.trim()) return
    try {
      await blockCommit(name, {
        disk: blockDisk.trim(),
        base: blockBase.trim() || null,
        top: blockTop.trim() || null,
        bandwidth: 0,
        shallow: blockShallow,
        delete: blockDelete,
        active: blockActive,
        relative: false,
        bandwidth_bytes: true,
      })
      toast.success('Block commit started')
      setDialog(null)
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleBlockPull = async () => {
    if (!name || !blockDisk.trim()) return
    try {
      await blockPull(name, { disk: blockDisk.trim(), bandwidth: 0, bandwidth_bytes: true })
      toast.success('Block pull started')
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  const handleBlockAbort = async (asyncAbort: boolean, pivot: boolean) => {
    if (!name || !blockDisk.trim()) return
    try {
      await blockJobAbort(name, { disk: blockDisk.trim(), async: asyncAbort, pivot })
      toast.success('Block job abort requested')
      setBlockJob(undefined)
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
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

  /** Open SSH dialog: guest IP from agent first, else last-saved IP; SSH user from last successful connect (defaults to root). */
  const openVmSshDialog = useCallback(() => {
    if (!name) return
    const prefs = loadVmSshPrefs(name)
    const fromGuest = guestIps[0]?.address?.trim()
    const ip = fromGuest || prefs?.host?.trim() || ''
    const user = prefs?.user?.trim() || 'root'
    setSshIp(ip)
    setSshUser(user)
    setSshDialogOpen(true)
  }, [name, guestIps])

  const navigateVmSshSession = useCallback(() => {
    if (!name) return
    const h = sshIp.trim()
    const u = sshUser.trim() || 'root'
    if (!h) return
    saveVmSshPrefs(name, { host: h, user: u })
    window.location.href = `/ssh?host=${encodeURIComponent(h)}&user=${encodeURIComponent(u)}`
  }, [name, sshIp, sshUser])

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
    { key: 'advanced', label: 'Advanced', icon: <Sliders className="w-4 h-4" /> },
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
          <button type="button" onClick={openVmSshDialog} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition flex items-center gap-1">
            <Terminal className="w-4 h-4" /> SSH
          </button>
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
        <button type="button" onClick={() => setTab('advanced')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition"><Sliders className="w-3 h-3 inline -mt-0.5" /> Advanced</button>
        <button onClick={load} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition" aria-label="Refresh"><RefreshCw className="w-3 h-3" /></button>
      </div>

      {/* Tabs — card picker */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">VM details</h2>
        <ChoiceCardDenseGrid>
          {tabs.map((t) => (
            <ChoiceCard
              key={t.key}
              compact
              tone="blue"
              selected={tab === t.key}
              onClick={() => setTab(t.key)}
              icon={t.icon}
              title={t.label}
            />
          ))}
        </ChoiceCardDenseGrid>
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-lg font-semibold">Boot Configuration</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openDialog('boot-order')} className="text-xs text-blue-400 hover:text-blue-300 transition">Edit boot</button>
                  <button
                    type="button"
                    onClick={() => {
                      const f = bootConfig.firmware.toLowerCase()
                      setFwChoice(f.includes('efi') || f.includes('ovmf') || f.includes('uefi') ? 'uefi' : 'bios')
                      openDialog('firmware')
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 transition"
                  >
                    Firmware…
                  </button>
                </div>
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

          {(cpuTune || memTune) && (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
              <h3 className="text-lg font-semibold">Resource Limits</h3>
              {cpuTune && (
                <>
                  <InfoRow label="CPU Shares" value={cpuTune.shares != null ? cpuTune.shares : 'Not set'} />
                  <InfoRow label="CPU Period" value={cpuTune.period != null ? `${cpuTune.period} us` : 'Not set'} />
                  <InfoRow label="CPU Quota" value={cpuTune.quota != null ? `${cpuTune.quota} us` : 'Not set'} />
                </>
              )}
              {memTune && (
                <>
                  <InfoRow label="Memory Hard Limit" value={memTune.hard_limit_kb != null ? `${(memTune.hard_limit_kb / 1024).toFixed(0)} MB` : 'Not set'} />
                  <InfoRow label="Memory Soft Limit" value={memTune.soft_limit_kb != null ? `${(memTune.soft_limit_kb / 1024).toFixed(0)} MB` : 'Not set'} />
                  <InfoRow label="Swap Limit" value={memTune.swap_hard_limit_kb != null ? `${(memTune.swap_hard_limit_kb / 1024).toFixed(0)} MB` : 'Not set'} />
                </>
              )}
              {cpuTune && cpuTune.vcpupin.length > 0 && (
                <div className="pt-2">
                  <span className="text-sm text-slate-400">vCPU Pinning</span>
                  <div className="mt-1 space-y-1">
                    {cpuTune.vcpupin.map((pin) => (
                      <div key={pin.vcpu} className="flex items-center justify-between py-1 border-b border-slate-700/30">
                        <span className="text-xs text-slate-400">vCPU {pin.vcpu}</span>
                        <span className="text-xs font-mono font-medium">{pin.cpuset}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void loadKubevirtExport()}
              disabled={kubevirtLoading}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg text-sm transition flex items-center gap-1"
              title="CDI upload DataVolume + KubeVirt VM (virtio root + virtio-win CDROM containerDisk)"
            >
              <Archive className="w-4 h-4" aria-hidden />
              {kubevirtLoading ? 'Loading…' : 'KubeVirt YAML'}
            </button>
            <button onClick={() => openDialog('attach-disk')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition flex items-center gap-1"><Plus className="w-4 h-4" /> Attach Disk</button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Target</th><th className="px-6 py-3">Bus</th><th className="px-6 py-3">Cache</th><th className="px-6 py-3">Device</th><th className="px-6 py-3">Driver</th><th className="px-6 py-3">Source</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {vm.disks.map((d, i) => (
                  <tr key={i} className="table-row-hover">
                    <td className="px-6 py-3 font-mono text-sm">{d.target}</td>
                    <td className="px-6 py-3 text-sm text-slate-400">{d.bus || '—'}</td>
                    <td className="px-6 py-3 text-sm text-slate-400">{d.cache || '—'}</td>
                    <td className="px-6 py-3 text-sm">{d.device}</td>
                    <td className="px-6 py-3 text-sm">{d.driver}</td>
                    <td className="px-6 py-3 text-sm text-slate-400 truncate max-w-xs">{d.source}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {d.device === 'disk' && (
                          <button
                            type="button"
                            onClick={() => {
                              setTuneDiskTarget(d.target)
                              setTuneBus(d.bus || '')
                              setTuneCache(d.cache || '')
                              setTuneDiscard('')
                              setTuneRo(d.readonly === true ? 'true' : d.readonly === false ? 'false' : '')
                              setTuneShare(d.shareable === true ? 'true' : d.shareable === false ? 'false' : '')
                              openDialog('disk-tune')
                            }}
                            className="p-1 hover:bg-amber-600/20 rounded transition"
                            title="Tune disk"
                            aria-label={`Tune ${d.target}`}
                          >
                            <Sliders className="w-4 h-4 text-amber-400" />
                          </button>
                        )}
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
                {vm.disks.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No disks attached</td></tr>}
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTuneMac(iface.mac_address)
                            setTuneNicModel(iface.model)
                            setTuneNicNet(iface.source)
                            openDialog('nic-tune')
                          }}
                          className="p-1 hover:bg-amber-600/20 rounded transition"
                          title="Tune NIC"
                          aria-label={`Tune ${iface.mac_address}`}
                        >
                          <Sliders className="w-4 h-4 text-amber-400" />
                        </button>
                        <button onClick={() => setDetachNicMac(iface.mac_address)} className="p-1 hover:bg-red-600/20 rounded transition" title="Detach NIC" aria-label={`Detach ${iface.mac_address}`}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
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
                <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Snapshot</th><th className="px-6 py-3">State</th><th className="px-6 py-3">Created</th><th className="px-6 py-3">Current</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-700/30">
                  <SnapshotTableRows
                    nodes={snapshotRoots}
                    depth={0}
                    onRevert={handleRevertSnapshot}
                    onDelete={(n) => setDeleteSnapName(n)}
                  />
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Devices Tab (USB + PCI) ─────────────────────────────── */}

      {tab === 'devices' && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-3">
            <h3 className="text-lg font-semibold text-slate-200">Virtual hardware</h3>
            <p className="text-xs text-slate-500">TPM, watchdog, sound, extra serial, and video — shut off the guest when libvirt requires a static config change.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
                onClick={() => {
                  if (!name) return
                  void attachVmTpm(name).then(() => { toast.success('TPM 2.0 attached'); load(); setVmXml('') }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)))
                }}
              >
                Add TPM 2.0
              </button>
              <button
                type="button"
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
                onClick={() => {
                  if (!name) return
                  void detachVmTpm(name).then(() => { toast.success('TPM removed'); load(); setVmXml('') }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)))
                }}
              >
                Remove TPM
              </button>
              <button type="button" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition" onClick={() => openDialog('watchdog')}>Watchdog…</button>
              <button type="button" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition" onClick={() => openDialog('sound')}>Sound…</button>
              <button type="button" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition" onClick={() => openDialog('serial')}>Extra serial…</button>
              <button type="button" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition" onClick={() => openDialog('video')}>Video model…</button>
            </div>
          </div>

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

      {/* ── Advanced (libvirt) ───────────────────────────────────── */}

      {tab === 'advanced' && (
        <div className="space-y-6">
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 text-sm text-amber-200/90">
            These actions map directly to libvirt (<code className="text-amber-100/80">virsh blockcommit</code>, <code className="text-amber-100/80">undefine --nvram</code>, etc.). Wrong options can destroy data or make a VM unbootable. Prefer shutoff VMs for delete and PCI attach unless you know the guest is safe.
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-400" /> Delete VM</h3>
            <p className="text-xs text-slate-400">Optional <code className="text-slate-300">undefine</code> flags (query params on DELETE). Typically use with VM shut off.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" className="rounded border-slate-600" checked={!!deleteUndefine.undefine_managed_save} onChange={(e) => setDeleteUndefine((p) => ({ ...p, undefine_managed_save: e.target.checked }))} />
                <span>Remove managed save image</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" className="rounded border-slate-600" checked={!!deleteUndefine.undefine_snapshots_metadata} onChange={(e) => setDeleteUndefine((p) => ({ ...p, undefine_snapshots_metadata: e.target.checked }))} />
                <span>Drop snapshot metadata only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" className="rounded border-slate-600" checked={!!deleteUndefine.undefine_nvram} onChange={(e) => setDeleteUndefine((p) => ({ ...p, undefine_nvram: e.target.checked }))} />
                <span>Delete UEFI NVRAM file</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" className="rounded border-slate-600" checked={!!deleteUndefine.undefine_keep_nvram} onChange={(e) => setDeleteUndefine((p) => ({ ...p, undefine_keep_nvram: e.target.checked }))} />
                <span>Keep NVRAM (exclusive with delete NVRAM)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" className="rounded border-slate-600" checked={!!deleteUndefine.undefine_checkpoints_metadata} onChange={(e) => setDeleteUndefine((p) => ({ ...p, undefine_checkpoints_metadata: e.target.checked }))} />
                <span>Remove checkpoint metadata</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" className="rounded border-slate-600" checked={!!deleteUndefine.undefine_tpm} onChange={(e) => setDeleteUndefine((p) => ({ ...p, undefine_tpm: e.target.checked }))} />
                <span>Delete TPM state</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" className="rounded border-slate-600" checked={!!deleteUndefine.undefine_keep_tpm} onChange={(e) => setDeleteUndefine((p) => ({ ...p, undefine_keep_tpm: e.target.checked }))} />
                <span>Keep TPM (exclusive with delete TPM)</span>
              </label>
            </div>
            <p className="text-xs text-amber-200/80">
              UEFI: if libvirt returns “cannot undefine domain with nvram”, enable <strong>Delete UEFI NVRAM file</strong> (same as{' '}
              <code className="text-amber-100/80">virsh undefine --nvram</code>). On delete failure the UI may enable this checkbox once so you can confirm again—uncheck if you need to keep NVRAM.
            </p>
            <button type="button" onClick={() => openDialog('delete-vm')} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition">Delete this VM…</button>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
            <h3 className="text-lg font-semibold">CPU / memory tuning</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openDialog('scheduler-tune')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">Edit scheduler (shares / vCPU bandwidth)</button>
              <button type="button" onClick={() => openDialog('memtune')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">Edit memtune (KiB)</button>
              <button type="button" onClick={() => openDialog('numa-tune')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">NUMA memory tuning</button>
              <button type="button" onClick={() => openDialog('emulator-pin')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">Pin QEMU emulator threads</button>
              <button type="button" onClick={() => openDialog('pin-vcpu')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">Pin vCPU to host CPUs</button>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
            <h3 className="text-lg font-semibold">Block jobs (snapshots / backing chain)</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Disk target</label>
                <select value={blockDisk} onChange={(e) => setBlockDisk(e.target.value)} className="input-field min-w-[120px]">
                  <option value="">Select…</option>
                  {vm.disks.filter((d) => d.device === 'disk').map((d) => (
                    <option key={d.target} value={d.target}>{d.target}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={handleBlockJobRefresh} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">Refresh job status</button>
              <button type="button" onClick={() => openDialog('block-commit')} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition">Block commit…</button>
              <button type="button" onClick={handleBlockPull} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm transition">Block pull</button>
              <button type="button" onClick={() => handleBlockAbort(false, false)} className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition">Abort job</button>
              <button type="button" onClick={() => handleBlockAbort(true, true)} className="px-3 py-2 bg-orange-700 hover:bg-orange-600 rounded-lg text-sm transition">Abort (async + pivot)</button>
            </div>
            {blockJob !== undefined && (
              <pre className="text-xs font-mono bg-slate-900/80 p-3 rounded border border-slate-700 overflow-x-auto">{blockJob === null ? 'No active block job on this disk.' : JSON.stringify(blockJob, null, 2)}</pre>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
            <h3 className="text-lg font-semibold">PCI passthrough (VFIO)</h3>
            <p className="text-xs text-slate-400">BDF like <code className="text-slate-300">0000:03:00.0</code>. Detach the node device from the host first when required.</p>
            <div className="flex flex-wrap gap-2 items-end">
              <input value={pciBdf} onChange={(e) => setPciBdf(e.target.value)} placeholder="0000:03:00.0" className="input-field flex-1 min-w-[200px]" />
              <button type="button" onClick={async () => { if (!name || !pciBdf.trim()) return; try { await attachPciHostdev(name, pciBdf.trim()); toast.success('PCI attach requested'); load(); setVmXml('') } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } }} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition">Attach</button>
              <button type="button" onClick={async () => { if (!name || !pciBdf.trim()) return; try { await detachPciHostdev(name, pciBdf.trim()); toast.success('PCI detach requested'); load(); setVmXml('') } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } }} className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition">Detach</button>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
            <h3 className="text-lg font-semibold">Host node device</h3>
            <p className="text-xs text-slate-400">Name from <strong className="text-slate-300">Devices</strong> page or <code className="text-slate-300">pci_0000_03_00_0</code> style libvirt id.</p>
            <div className="flex flex-wrap gap-2 items-end">
              <input value={nodedevName} onChange={(e) => setNodedevName(e.target.value)} placeholder="pci_0000_03_00_0" className="input-field flex-1 min-w-[220px]" />
              <button type="button" onClick={async () => { if (!nodedevName.trim()) return; try { await detachNodeDevice(nodedevName.trim()); toast.success('Node device detached') } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } }} className="px-3 py-2 bg-orange-700 hover:bg-orange-600 rounded-lg text-sm transition">Detach from host</button>
              <button type="button" onClick={async () => { if (!nodedevName.trim()) return; try { await reattachNodeDevice(nodedevName.trim()); toast.success('Node device reattached') } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } }} className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition">Reattach to host</button>
            </div>
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
              <input id="dlg-mem" type="number" min={64} max={1048576} autoFocus value={editMemory} onChange={(e) => setEditMemory(parseInt(e.target.value) || 1024)} className="input-field" />
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
              <label htmlFor="dlg-mig-bw" className="block text-sm text-slate-400 mb-1 mt-3">Bandwidth limit (MiB/s, optional)</label>
              <input id="dlg-mig-bw" type="number" min={1} className="input-field" value={migrateBandwidth} onChange={(e) => setMigrateBandwidth(e.target.value)} placeholder="e.g. 200" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={migrateUnsafe} onChange={(e) => setMigrateUnsafe(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
                  Unsafe migration
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={migratePostcopy} onChange={(e) => setMigratePostcopy(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
                  Post-copy
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={migrateTunnelled} onChange={(e) => setMigrateTunnelled(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
                  Tunnelled
                </label>
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
              <div className="space-y-2">
                {isoFiles.length > 0 ? (
                  <select id="dlg-iso" autoFocus value={cdromPath} onChange={(e) => setCdromPath(e.target.value)} className="input-field">
                    <option value="">Select ISO (from scan)…</option>
                    {isoFiles.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.name} ({(f.size_bytes / 1048576).toFixed(0)} MB)
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="flex gap-2">
                  <input
                    id="dlg-iso"
                    type="text"
                    autoFocus={isoFiles.length === 0}
                    value={cdromPath}
                    onChange={(e) => setCdromPath(e.target.value)}
                    placeholder="/var/lib/libvirt/images/image.iso"
                    className="input-field flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-sm text-slate-200 transition"
                    onClick={() => setCdromBrowseOpen(true)}
                  >
                    <FolderOpen className="w-4 h-4" aria-hidden />
                    Browse
                  </button>
                </div>
              </div>
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
              <div className="flex gap-2">
                <input
                  id="dlg-disk-src"
                  type="text"
                  autoFocus
                  value={attachSource}
                  onChange={(e) => setAttachSource(e.target.value)}
                  placeholder="/var/lib/libvirt/images/data.qcow2"
                  className="input-field flex-1 min-w-0"
                />
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-sm text-slate-200 transition"
                  onClick={() => setAttachDiskBrowseOpen(true)}
                >
                  <FolderOpen className="w-4 h-4" aria-hidden />
                  Browse
                </button>
              </div>
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
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label htmlFor="dlg-disk-bus" className="block text-sm text-slate-400 mb-1">Bus</label>
                  <select id="dlg-disk-bus" value={attachBus} onChange={(e) => setAttachBus(e.target.value)} className="input-field">
                    <option value="virtio">virtio</option>
                    <option value="sata">sata</option>
                    <option value="scsi">scsi</option>
                    <option value="ide">ide</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="dlg-disk-cache" className="block text-sm text-slate-400 mb-1">Cache (optional)</label>
                  <select id="dlg-disk-cache" value={attachCache} onChange={(e) => setAttachCache(e.target.value)} className="input-field">
                    <option value="">default</option>
                    <option value="none">none</option>
                    <option value="writethrough">writethrough</option>
                    <option value="writeback">writeback</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="dlg-disk-discard" className="block text-sm text-slate-400 mb-1">Discard (optional)</label>
                  <select id="dlg-disk-discard" value={attachDiscard} onChange={(e) => setAttachDiscard(e.target.value)} className="input-field">
                    <option value="">—</option>
                    <option value="unmap">unmap</option>
                    <option value="ignore">ignore</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 justify-center">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={attachReadonly} onChange={(e) => setAttachReadonly(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
                    Read-only
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={attachShareable} onChange={(e) => setAttachShareable(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
                    Shareable
                  </label>
                </div>
              </div>
            </DialogBox>
          )}

          {dialog === 'disk-tune' && (
            <DialogBox title={`Tune disk ${tuneDiskTarget}`} icon={<Sliders className="w-5 h-5 text-amber-400" />} onClose={() => setDialog(null)} onConfirm={handleDiskTune} confirmLabel="Apply">
              <p className="text-xs text-slate-500 mb-2">Leave fields empty to skip. Readonly/shareable: choose “no change”, on, or off.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Bus</label>
                  <select value={tuneBus} onChange={(e) => setTuneBus(e.target.value)} className="input-field">
                    <option value="">no change</option>
                    <option value="virtio">virtio</option>
                    <option value="sata">sata</option>
                    <option value="scsi">scsi</option>
                    <option value="ide">ide</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cache</label>
                  <select value={tuneCache} onChange={(e) => setTuneCache(e.target.value)} className="input-field">
                    <option value="">no change</option>
                    <option value="none">none</option>
                    <option value="writethrough">writethrough</option>
                    <option value="writeback">writeback</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Discard</label>
                  <select value={tuneDiscard} onChange={(e) => setTuneDiscard(e.target.value)} className="input-field">
                    <option value="">no change</option>
                    <option value="unmap">unmap</option>
                    <option value="ignore">ignore</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Read-only</label>
                  <select value={tuneRo} onChange={(e) => setTuneRo(e.target.value)} className="input-field">
                    <option value="">no change</option>
                    <option value="true">yes</option>
                    <option value="false">no</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Shareable</label>
                  <select value={tuneShare} onChange={(e) => setTuneShare(e.target.value)} className="input-field">
                    <option value="">no change</option>
                    <option value="true">yes</option>
                    <option value="false">no</option>
                  </select>
                </div>
              </div>
            </DialogBox>
          )}

          {dialog === 'nic-tune' && (
            <DialogBox title="Tune network interface" icon={<Sliders className="w-5 h-5 text-amber-400" />} onClose={() => setDialog(null)} onConfirm={handleNicTune} confirmLabel="Apply">
              <p className="text-xs text-slate-500 mb-2 font-mono">{tuneMac}</p>
              <label className="block text-sm text-slate-400 mb-1">Model</label>
              <select value={tuneNicModel} onChange={(e) => setTuneNicModel(e.target.value)} className="input-field">
                <option value="virtio">virtio</option>
                <option value="e1000">e1000</option>
                <option value="e1000e">e1000e</option>
                <option value="rtl8139">rtl8139</option>
                <option value="vmxnet3">vmxnet3</option>
              </select>
              <label className="block text-sm text-slate-400 mb-1 mt-3">Libvirt network name</label>
              <input type="text" value={tuneNicNet} onChange={(e) => setTuneNicNet(e.target.value)} className="input-field" placeholder="default" />
            </DialogBox>
          )}

          {dialog === 'firmware' && (
            <DialogBox title="Guest firmware" icon={<Settings className="w-5 h-5 text-orange-400" />} onClose={() => setDialog(null)} onConfirm={handleFirmwareSet} confirmLabel="Apply">
              <p className="text-xs text-amber-200/80 mb-2">Changing firmware can make a guest unbootable if disk layout/OS does not match. Prefer shutoff VMs.</p>
              <select value={fwChoice} onChange={(e) => setFwChoice(e.target.value as 'bios' | 'uefi')} className="input-field">
                <option value="bios">BIOS (SeaBIOS)</option>
                <option value="uefi">UEFI (OVMF)</option>
              </select>
            </DialogBox>
          )}

          {dialog === 'watchdog' && (
            <DialogBox title="Attach watchdog" icon={<Settings className="w-5 h-5 text-red-400" />} onClose={() => setDialog(null)} onConfirm={handleWatchdogAttach} confirmLabel="Attach">
              <label className="block text-sm text-slate-400 mb-1">Model</label>
              <select value={wdModel} onChange={(e) => setWdModel(e.target.value)} className="input-field">
                <option value="i6300esb">i6300esb</option>
                <option value="ib700">ib700</option>
                <option value="diag288">diag288</option>
              </select>
              <label className="block text-sm text-slate-400 mb-1 mt-3">Action</label>
              <select value={wdAction} onChange={(e) => setWdAction(e.target.value)} className="input-field">
                <option value="reset">reset</option>
                <option value="shutdown">shutdown</option>
                <option value="poweroff">poweroff</option>
                <option value="pause">pause</option>
                <option value="none">none</option>
                <option value="dump">dump</option>
              </select>
            </DialogBox>
          )}

          {dialog === 'sound' && (
            <DialogBox title="Attach sound" icon={<Settings className="w-5 h-5 text-cyan-400" />} onClose={() => setDialog(null)} onConfirm={handleSoundAttach} confirmLabel="Attach">
              <select value={sndModel} onChange={(e) => setSndModel(e.target.value)} className="input-field">
                <option value="ich6">ich6 (Intel HD Audio)</option>
                <option value="ich9">ich9</option>
                <option value="ac97">ac97</option>
              </select>
            </DialogBox>
          )}

          {dialog === 'serial' && (
            <DialogBox title="Extra serial + console" icon={<Terminal className="w-5 h-5 text-blue-400" />} onClose={() => setDialog(null)} onConfirm={handleSerialAttach} confirmLabel="Attach">
              <label className="block text-sm text-slate-400 mb-1">Guest serial port index</label>
              <input type="number" min={1} max={32} value={serPort} onChange={(e) => setSerPort(parseInt(e.target.value, 10) || 1)} className="input-field" />
              <p className="text-xs text-slate-500 mt-2">Adds PTY serial and matching console (e.g. 1 → ttyS1).</p>
            </DialogBox>
          )}

          {dialog === 'video' && (
            <DialogBox title="Video model" icon={<Monitor className="w-5 h-5 text-purple-400" />} onClose={() => setDialog(null)} onConfirm={handleVideoSet} confirmLabel="Apply">
              <select value={vidModel} onChange={(e) => setVidModel(e.target.value)} className="input-field">
                <option value="qxl">qxl (SPICE)</option>
                <option value="virtio">virtio</option>
                <option value="vga">vga</option>
                <option value="bochs">bochs</option>
                <option value="cirrus">cirrus</option>
              </select>
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

          {dialog === 'delete-vm' && (
            <DialogBox
              title="Delete VM permanently"
              icon={<Trash2 className="w-5 h-5 text-red-400" />}
              onClose={() => setDialog(null)}
              onConfirm={handleDeleteVm}
              confirmLabel="Delete"
              confirmDanger
              confirmDisabled={!vm?.name || deleteVmTypeConfirm !== vm.name}
            >
              <p className="text-sm text-slate-300 mb-3">
                This will stop <strong>{vm?.name}</strong> if running, then remove the libvirt definition.
              </p>

              {/* Disk deletion */}
              <div className={`rounded-lg border p-3 mb-3 ${deleteUndefine.delete_disks ? 'border-red-500/50 bg-red-900/10' : 'border-slate-700/50 bg-slate-800/40'}`}>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!deleteUndefine.delete_disks}
                    onChange={(e) => setDeleteUndefine(o => ({ ...o, delete_disks: e.target.checked }))}
                    className="mt-0.5 accent-red-500 w-4 h-4 shrink-0"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-200">Also delete disk image files</span>
                    <p className="text-xs text-slate-400 mt-0.5">Permanently removes the backing <code>.qcow2</code> / <code>.raw</code> files from the host. Cannot be undone.</p>
                    {deleteUndefine.delete_disks && vm?.disks && vm.disks.filter(d => d.device === 'disk').length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {vm.disks.filter(d => d.device === 'disk').map(d => (
                          <li key={d.target} className="flex items-center gap-1.5 text-xs text-red-300 font-mono">
                            <HardDrive className="w-3 h-3 shrink-0" />
                            {d.source}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </label>
              </div>

              <label htmlFor="dlg-delete-vm-confirm" className="block text-xs text-slate-400 mb-1">
                Type the VM name <span className="font-mono text-slate-200">{vm?.name}</span> to confirm:
              </label>
              <input
                id="dlg-delete-vm-confirm"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={deleteVmTypeConfirm}
                onChange={(e) => setDeleteVmTypeConfirm(e.target.value)}
                className="input-field font-mono text-sm"
                placeholder={vm?.name}
              />
            </DialogBox>
          )}

          {dialog === 'scheduler-tune' && (
            <DialogBox title="Scheduler tuning" icon={<Cpu className="w-5 h-5 text-blue-400" />} onClose={() => setDialog(null)} onConfirm={handleSchedulerSave} confirmLabel="Apply">
              <p className="text-xs text-slate-500 mb-3">Only filled fields are sent; others stay unchanged in libvirt.</p>
              <label className="block text-sm text-slate-400 mb-1">cpu_shares</label>
              <input className="input-field mb-2" value={schedShares} onChange={(e) => setSchedShares(e.target.value)} placeholder="e.g. 1024" />
              <label className="block text-sm text-slate-400 mb-1">vcpu_period (µs)</label>
              <input className="input-field mb-2" value={schedPeriod} onChange={(e) => setSchedPeriod(e.target.value)} />
              <label className="block text-sm text-slate-400 mb-1">vcpu_quota (µs)</label>
              <input className="input-field" value={schedQuota} onChange={(e) => setSchedQuota(e.target.value)} />
            </DialogBox>
          )}

          {dialog === 'memtune' && (
            <DialogBox title="Memory tuning (KiB)" icon={<MemoryStick className="w-5 h-5 text-purple-400" />} onClose={() => setDialog(null)} onConfirm={handleMemtuneSave} confirmLabel="Apply">
              <p className="text-xs text-slate-500 mb-3">Values are KiB (same unit as libvirt memtune XML). Leave blank to leave unchanged.</p>
              <label className="block text-sm text-slate-400 mb-1">hard_limit_kb</label>
              <input className="input-field mb-2" value={memHardKb} onChange={(e) => setMemHardKb(e.target.value)} />
              <label className="block text-sm text-slate-400 mb-1">soft_limit_kb</label>
              <input className="input-field mb-2" value={memSoftKb} onChange={(e) => setMemSoftKb(e.target.value)} />
              <label className="block text-sm text-slate-400 mb-1">swap_hard_limit_kb</label>
              <input className="input-field" value={memSwapKb} onChange={(e) => setMemSwapKb(e.target.value)} />
            </DialogBox>
          )}

          {dialog === 'numa-tune' && (
            <DialogBox title="NUMA memory tuning" icon={<Cpu className="w-5 h-5 text-violet-400" />} onClose={() => setDialog(null)} onConfirm={() => void handleNumaSave()} confirmLabel="Apply">
              <p className="text-xs text-slate-500 mb-2">Maps to libvirt <code className="text-slate-400">numatune</code>. Mode is the raw libvirt mem mode integer; leave blank to skip updating mode.</p>
              <label className="block text-sm text-slate-400 mb-1">node_set (e.g. 0-1 or 0)</label>
              <input className="input-field mb-3" value={numaNodeSet} onChange={(e) => setNumaNodeSet(e.target.value)} placeholder="0" />
              <label className="block text-sm text-slate-400 mb-1">mode (optional)</label>
              <input className="input-field" value={numaModeInput} onChange={(e) => setNumaModeInput(e.target.value)} placeholder="strict / preferred / … as int" />
            </DialogBox>
          )}

          {dialog === 'emulator-pin' && (
            <DialogBox title="Pin QEMU emulator to host CPUs" icon={<Cpu className="w-5 h-5 text-amber-400" />} onClose={() => setDialog(null)} onConfirm={() => void handleEmulatorPinSave()} confirmLabel="Apply">
              <p className="text-xs text-slate-500 mb-2">Host CPUs 0–63 (first 64 logical CPUs), same grid as vCPU pinning.</p>
              <div className="max-h-40 overflow-y-auto border border-slate-700 rounded p-2 grid grid-cols-8 gap-1">
                {emuPinMap.map((on, i) => (
                  <label key={i} className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={on} onChange={(e) => setEmuPinMap((m) => { const n = [...m]; n[i] = e.target.checked; return n })} />
                    {i}
                  </label>
                ))}
              </div>
            </DialogBox>
          )}

          {dialog === 'pin-vcpu' && (
            <DialogBox title="Pin vCPU to host CPUs" icon={<Cpu className="w-5 h-5 text-cyan-400" />} onClose={() => setDialog(null)} onConfirm={handlePinSave} confirmLabel="Apply pin">
              <label className="block text-sm text-slate-400 mb-1">vCPU index</label>
              <input type="number" min={0} max={Math.max(0, (vm?.vcpus ?? 1) - 1)} className="input-field mb-3" value={pinVcpuN} onChange={(e) => setPinVcpuN(parseInt(e.target.value, 10) || 0)} />
              <p className="text-xs text-slate-500 mb-2">Host CPUs 0–63 (first 64 logical CPUs).</p>
              <div className="max-h-40 overflow-y-auto border border-slate-700 rounded p-2 grid grid-cols-8 gap-1">
                {pinMap.map((on, i) => (
                  <label key={i} className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={on} onChange={(e) => setPinMap((m) => { const n = [...m]; n[i] = e.target.checked; return n })} />
                    {i}
                  </label>
                ))}
              </div>
            </DialogBox>
          )}

          {dialog === 'block-commit' && (
            <DialogBox title="Block commit" icon={<HardDrive className="w-5 h-5 text-blue-400" />} onClose={() => setDialog(null)} onConfirm={handleBlockCommit} confirmLabel="Start commit">
              <p className="text-xs text-slate-500 mb-2">Disk: <code className="text-slate-300">{blockDisk || '—'}</code></p>
              <label className="block text-sm text-slate-400 mb-1">Base (optional)</label>
              <input className="input-field mb-2" value={blockBase} onChange={(e) => setBlockBase(e.target.value)} placeholder="backing file name or leave empty" />
              <label className="block text-sm text-slate-400 mb-1">Top (optional)</label>
              <input className="input-field mb-2" value={blockTop} onChange={(e) => setBlockTop(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-slate-300 mb-1"><input type="checkbox" checked={blockShallow} onChange={(e) => setBlockShallow(e.target.checked)} /> Shallow</label>
              <label className="flex items-center gap-2 text-sm text-slate-300 mb-1"><input type="checkbox" checked={blockDelete} onChange={(e) => setBlockDelete(e.target.checked)} /> Delete merged images</label>
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={blockActive} onChange={(e) => setBlockActive(e.target.checked)} /> Active commit</label>
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
              <label htmlFor="dlg-ssh-ip" className="block text-sm text-slate-400 mb-1">Guest IP (guest agent first, then last address you used for this VM; edit if needed)</label>
              <input id="dlg-ssh-ip" type="text" autoFocus value={sshIp} onChange={(e) => setSshIp(e.target.value)} placeholder="192.168.122.100" className="input-field"
                onKeyDown={(e) => { if (e.key === 'Enter' && sshIp.trim()) navigateVmSshSession() }} />
              <label htmlFor="dlg-ssh-user" className="block text-sm text-slate-400 mb-1 mt-3">SSH user (defaults to root; remembers last successful login for this VM in this browser)</label>
              <input id="dlg-ssh-user" type="text" value={sshUser} onChange={(e) => setSshUser(e.target.value)} placeholder="root" className="input-field" autoComplete="username" />
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
              <p className="text-xs text-slate-500">Creates a short-lived server session, then opens a PTY-backed SSH terminal (port 22). The browser never passes the host in the WebSocket URL.</p>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button type="button" onClick={() => setSshDialogOpen(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
              <button type="button" onClick={() => { if (sshIp.trim()) navigateVmSshSession() }} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm text-white font-medium transition">Connect</button>
            </div>
          </div>
        </div>
      )}

      {kubevirtOpen && kubevirtBundle && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kubevirt-export-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setKubevirtOpen(false)
          }}
        >
          <div
            className="bg-slate-900 border border-slate-600 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-2">
              <h2 id="kubevirt-export-title" className="text-lg font-semibold text-slate-100">
                KubeVirt migration bundle
              </h2>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                onClick={() => setKubevirtOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-sm text-slate-300">
              <p className="text-sm text-slate-300 leading-relaxed">
                Move this QEMU/KVM guest from the bare-metal libvirt host into a Kubernetes cluster: CDI upload DataVolume plus KubeVirt{' '}
                <code className="text-slate-200">VirtualMachine</code> YAML. When <code className="text-slate-200">[kubevirt] exec_enabled</code> is true, the buttons below run{' '}
                <code className="text-slate-200">virtctl</code>/<code className="text-slate-200">kubectl</code> on the daemon host.
              </p>
              <p className="text-xs text-slate-400">
                Libvirt root disk <code className="text-slate-200">{kubevirtBundle.libvirt_root_disk}</code> → DataVolume{' '}
                <code className="text-slate-200">{kubevirtBundle.datavolume_name}</code> / VM{' '}
                <code className="text-slate-200">{kubevirtBundle.virtual_machine_name}</code> in namespace{' '}
                <code className="text-slate-200">{kubevirtBundle.namespace}</code>. The VM includes a virtio-win CDROM via{' '}
                <code className="text-slate-200">containerDisk</code> (cluster pulls the image instead of attaching <code className="text-slate-200">virtio-win.iso</code> from the hypervisor). Override image in{' '}
                <code className="text-slate-200">[kubevirt] virtio_container_disk_image</code> in machina config.
              </p>
              <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 space-y-2">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Cluster steps (tick when done)</div>
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-600 bg-slate-900"
                    checked={kubevirtDoneUpload}
                    onChange={(e) => setKubevirtDoneUpload(e.target.checked)}
                  />
                  <span>
                    <strong className="text-slate-200">1.</strong> Run <code className="text-slate-400">virtctl image-upload …</code> on a machine with kubeconfig so the libvirt qcow2 fills the upload DataVolume.
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-600 bg-slate-900"
                    checked={kubevirtDoneApply}
                    onChange={(e) => setKubevirtDoneApply(e.target.checked)}
                  />
                  <span>
                    <strong className="text-slate-200">2.</strong> <code className="text-slate-400">kubectl apply -f</code> the YAML (or paste from below).
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-600 bg-slate-900"
                    checked={kubevirtDoneStart}
                    onChange={(e) => setKubevirtDoneStart(e.target.checked)}
                  />
                  <span className="flex-1 min-w-0">
                    <strong className="text-slate-200">3.</strong> Start the VM when ready:{' '}
                    <code className="text-slate-400 break-all">
                      virtctl start {kubevirtBundle.virtual_machine_name} -n {kubevirtBundle.namespace}
                    </code>
                    <button
                      type="button"
                      className="ml-2 text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline"
                      onClick={() => {
                        const cmd = `virtctl start ${kubevirtBundle.virtual_machine_name} -n ${kubevirtBundle.namespace}`
                        void navigator.clipboard.writeText(cmd)
                        toast.success('virtctl start copied')
                      }}
                    >
                      Copy
                    </button>
                  </span>
                </label>
              </div>
              {kubevirtBundle.cluster_exec_enabled && (
                <div className="rounded-lg border border-violet-800/40 bg-violet-950/20 p-3 space-y-2">
                  <div className="text-xs font-medium text-violet-300 uppercase tracking-wide">Run on daemon host</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <code className="text-slate-300">[kubevirt] exec_enabled = true</code> — uses this machine&apos;s kubeconfig (set{' '}
                    <code className="text-slate-300">kubeconfig_path</code> in machina config if needed).{' '}
                    <strong className="text-slate-300">virtctl image-upload</strong> may run for a long time; the browser request blocks until it finishes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={kubevirtExecBusy !== null}
                      className="text-xs px-2 py-1 rounded bg-violet-900/80 hover:bg-violet-800 disabled:opacity-50 text-violet-100"
                      onClick={() => { void runKubevirtClusterStep('upload') }}
                    >
                      {kubevirtExecBusy === 'upload' ? 'Upload…' : 'virtctl image-upload'}
                    </button>
                    <button
                      type="button"
                      disabled={kubevirtExecBusy !== null}
                      className="text-xs px-2 py-1 rounded bg-violet-900/80 hover:bg-violet-800 disabled:opacity-50 text-violet-100"
                      onClick={() => { void runKubevirtClusterStep('apply') }}
                    >
                      {kubevirtExecBusy === 'apply' ? 'Apply…' : 'kubectl apply'}
                    </button>
                    <button
                      type="button"
                      disabled={kubevirtExecBusy !== null}
                      className="text-xs px-2 py-1 rounded bg-violet-900/80 hover:bg-violet-800 disabled:opacity-50 text-violet-100"
                      onClick={() => { void runKubevirtClusterStep('start') }}
                    >
                      {kubevirtExecBusy === 'start' ? 'Start…' : 'virtctl start'}
                    </button>
                  </div>
                  {kubevirtExecLast && (
                    <div>
                      <span className="text-xs text-slate-500 block mb-1">
                        Last command: exit {kubevirtExecLast.exit_code}
                      </span>
                      <pre className="text-[10px] leading-snug font-mono text-slate-200 bg-black/40 border border-slate-800 rounded-lg p-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                        {kubevirtExecLast.stderr?.trim()
                          ? `stderr:\n${kubevirtExecLast.stderr}\n\n`
                          : ''}
                        {kubevirtExecLast.stdout?.trim()
                          ? `stdout:\n${kubevirtExecLast.stdout}`
                          : (!kubevirtExecLast.stderr?.trim() ? '(no output)' : '')}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                  onClick={() => {
                    void navigator.clipboard.writeText(kubevirtBundle.yaml)
                    toast.success('YAML copied')
                  }}
                >
                  Copy YAML
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                  onClick={() => {
                    void navigator.clipboard.writeText(kubevirtBundle.virtctl_image_upload_example)
                    toast.success('virtctl command copied')
                  }}
                >
                  Copy virtctl upload
                </button>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">virtctl image-upload (run where kubeconfig points at your cluster)</span>
                <pre className="text-[11px] leading-snug font-mono text-slate-200 bg-black/40 border border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                  {kubevirtBundle.virtctl_image_upload_example}
                </pre>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">Kubernetes manifests</span>
                <pre className="text-[11px] leading-snug font-mono text-slate-200 bg-black/40 border border-slate-800 rounded-lg p-3 max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-all">
                  {kubevirtBundle.yaml}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      <BrowseHostPathModal
        open={cdromBrowseOpen}
        onClose={() => setCdromBrowseOpen(false)}
        title="Browse for ISO"
        canSelectFile={isIsoFileName}
        onSelectPath={(p) => setCdromPath(p)}
      />
      <BrowseHostPathModal
        open={attachDiskBrowseOpen}
        onClose={() => setAttachDiskBrowseOpen(false)}
        title="Browse for disk image"
        canSelectFile={isHostDiskImageFileName}
        onSelectPath={(p) => setAttachSource(p)}
      />
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

function DialogBox({ title, icon, onClose, onConfirm, confirmLabel, children, confirmDisabled, confirmDanger }: {
  title: string
  icon: React.ReactNode
  onClose: () => void
  onConfirm: () => void
  confirmLabel: string
  children: React.ReactNode
  confirmDisabled?: boolean
  confirmDanger?: boolean
}) {
  const confirmClass = confirmDanger
    ? 'bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed'
    : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed'
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
        <span className="text-lg font-semibold flex items-center gap-2">{icon} {title}</span>
        <button type="button" onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition" aria-label="Close"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="p-5 space-y-1">{children}</div>
      <div className="flex justify-end gap-3 px-5 pb-5">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={confirmDisabled} className={`px-4 py-2 rounded-lg text-sm text-white font-medium transition ${confirmClass}`}>{confirmLabel}</button>
      </div>
    </div>
  )
}
