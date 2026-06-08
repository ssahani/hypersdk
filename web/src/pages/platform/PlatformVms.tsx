// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy,
  FolderOpen,
  Monitor,
  Pause,
  Play,
  Plus,
  Power,
  RefreshCw,
  Server,
  Sparkles,
  Square,
  Tag,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import PageLayout from '../../components/PageLayout'
import ConfirmDialog from '../../components/ConfirmDialog'
import { StructuredErrorBanner } from '../../components/StructuredErrorBanner'
import PlatformEmptyState from '../../components/platform/PlatformEmptyState'
import FinderView, { type FinderViewMode } from '../../components/platform/mac/FinderView'
import { LaunchpadAppIcon } from '../../components/platform/mac/PlatformMacUi'
import SimpleCreateVmWizard, {
  cloudInitUserForOs,
  sizeToSpec,
  type VmWizardInitial,
  type VmWizardPayload,
} from '../../components/platform/SimpleCreateVmWizard'
import WindowsCreateWizard from '../../components/platform/WindowsCreateWizard'
import MigratePrecheckModal from '../../components/platform/MigratePrecheckModal'
import {
  adoptPlatformVm,
  batchVmPower,
  createFromTemplate,
  createPlatformVm,
  getFleetFinder,
  listPlatformHosts,
  listPlatformVms,
  vmDelete,
  type CreatePlatformVmBody,
  type FleetFinderOverview,
  type PlatformApiError,
  type PlatformHost,
  type PlatformVm,
} from '../../api/platform'
import { fleetGuestQuery, type FleetGuestQueryReport } from '../../api/ai'
import { useAi } from '../../contexts/AiContext'
import { useToastContext } from '../../contexts/ToastContext'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'
import { formatUserError } from '../../utils/apiError'
import { guestToolsStatusLabel } from '../../utils/guestAgentUx'
import { installStateTone } from '../../components/platform/GuestAgentDiagnosticsPanel'
import { pruneMissingPlatformVms } from '../../api/platformVmLifecycle'
import { purgeVmShortcuts } from '../../utils/vmShortcuts'
import { toastQueuedOperation } from '../../utils/platformTaskToast'
import VmStatusBadge from '../../components/VmStatusBadge'
import { hubLinkClasses, statusPillClasses } from '../../utils/semanticColors'
import { vmLaunchpadGradient, vmSemanticKind } from '../../utils/vmVisual'
import VmSshConnectDialog, { navigateVmSshSession } from '../../components/vm/VmSshConnectDialog'

type ViewMode = 'launchpad' | 'list' | 'columns'

const VM_VIEW_STORAGE_KEY = 'platform-vms-view'

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(VM_VIEW_STORAGE_KEY)
    if (v === 'list' || v === 'launchpad' || v === 'columns') return v
    if (v === 'grid') return 'launchpad'
  } catch { /* private mode */ }
  return 'launchpad'
}

function SidebarRow({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${
        active ? 'bg-blue-500/15 text-blue-200' : 'text-slate-300 hover:bg-slate-800/60'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-slate-500 shrink-0">{count}</span>
    </button>
  )
}

export default function PlatformVms() {
  const toast = useToastContext()
  const { openCopilot, setContextVmIds, setContextSummary } = useAi()
  const [fleetGuestReport, setFleetGuestReport] = useState<FleetGuestQueryReport | null>(null)
  const [fleetGuestBusy, setFleetGuestBusy] = useState(false)
  const [tier] = usePlatformDesktopTier()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const folder = searchParams.get('folder') || 'all'
  const tag = searchParams.get('tag') || ''
  const project = searchParams.get('project') || ''
  const source = searchParams.get('source') || ''

  const [vms, setVms] = useState<PlatformVm[]>([])
  const [finder, setFinder] = useState<FleetFinderOverview | null>(null)
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [error, setError] = useState<{ message: string; error_code?: string; remediation?: string } | null>(null)
  const [view, setView] = useState<ViewMode>(() => readStoredView())
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardInitial, setWizardInitial] = useState<VmWizardInitial | undefined>()
  const [windowsOpen, setWindowsOpen] = useState(false)
  const [dragVmId, setDragVmId] = useState<string | null>(null)
  const [migrateModal, setMigrateModal] = useState<{ vm: PlatformVm; destId: string; destName: string } | null>(null)
  const [dropHost, setDropHost] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedVmId, setSelectedVmId] = useState<string | null>(null)
  const [selectedVmIds, setSelectedVmIds] = useState<Set<string>>(new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchDeleteBusy, setBatchDeleteBusy] = useState(false)
  const [batchPowerBusy, setBatchPowerBusy] = useState(false)
  const [sshVm, setSshVm] = useState<PlatformVm | null>(null)
  const [pruneBusy, setPruneBusy] = useState(false)

  const hostMap = useMemo(() => new Map(hosts.map((h) => [h.id, h.hostname])), [hosts])
  const vmById = useMemo(() => new Map(vms.map((v) => [v.id, v])), [vms])

  const filteredVms = useMemo(() => {
    let list = vms
    if (folder === 'guest-gaps') {
      list = list.filter((v) => {
        const s = v.guest_tools_status?.toLowerCase()
        return v.inventory_source !== 'kubevirt' && s !== 'healthy' && s !== 'installed'
      })
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((v) => v.name.toLowerCase().includes(q) || (v.tags ?? []).some((t) => t.toLowerCase().includes(q)))
  }, [vms, search, folder])

  const finderViewMode: FinderViewMode = view === 'list' ? 'list' : view === 'columns' ? 'columns' : 'icons'
  const setFinderViewMode = (mode: FinderViewMode) => {
    if (mode === 'list') setView('list')
    else if (mode === 'columns') setView('columns')
    else setView('launchpad')
  }

  const selectedVm = filteredVms.find((v) => v.id === selectedVmId) ?? filteredVms[0] ?? null

  const setFilter = useCallback((next: { folder?: string; tag?: string; project?: string; source?: string }) => {
    const p = new URLSearchParams(searchParams)
    if (next.source !== undefined) {
      if (next.source) p.set('source', next.source)
      else p.delete('source')
      p.delete('folder')
      p.delete('tag')
      p.delete('project')
    }
    if (next.folder !== undefined) {
      if (next.folder === 'all') p.delete('folder')
      else p.set('folder', next.folder)
      p.delete('tag')
      p.delete('project')
      p.delete('source')
    }
    if (next.tag !== undefined) {
      if (next.tag) p.set('tag', next.tag)
      else p.delete('tag')
      p.delete('folder')
      p.delete('project')
    }
    if (next.project !== undefined) {
      if (next.project) p.set('project', next.project)
      else p.delete('project')
      p.delete('folder')
      p.delete('tag')
    }
    setSearchParams(p, { replace: true })
  }, [searchParams, setSearchParams])

  const load = useCallback(async () => {
    setError(null)
    try {
      const listParams: Parameters<typeof listPlatformVms>[0] = {}
      if (source) listParams.source = source
      if (tag) listParams.tag = tag
      else if (project) listParams.project = project
      else if (folder && folder !== 'all') listParams.folder = folder

      const [v, h, f] = await Promise.all([
        listPlatformVms(listParams),
        listPlatformHosts(),
        getFleetFinder().catch(() => null),
      ])
      setVms(Array.isArray(v) ? v : [])
      setHosts(Array.isArray(h) ? h : [])
      setFinder(f)
    } catch (e: unknown) {
      const err = e as PlatformApiError
      setError({
        message: err.message || formatUserError(e),
        error_code: err.error_code,
        remediation: err.remediation,
      })
    }
  }, [folder, tag, project, source])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const st = location.state as { vmDeleteTaskId?: string; vmDeleteLabel?: string } | null
    if (!st?.vmDeleteTaskId) return
    toastQueuedOperation(toast, st.vmDeleteLabel ?? 'Delete queued', st.vmDeleteTaskId, tier)
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate, toast, tier])

  useEffect(() => {
    try { localStorage.setItem(VM_VIEW_STORAGE_KEY, view) } catch { /* ignore */ }
  }, [view])

  useEffect(() => {
    const create = searchParams.get('create')
    if (!create) return
    setWizardInitial({
      name: create,
      os: searchParams.get('os') ?? undefined,
      size: searchParams.get('size') ?? undefined,
      network: searchParams.get('network') ?? undefined,
      hostId: searchParams.get('host_id') ?? undefined,
    })
    setWizardOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    next.delete('os')
    next.delete('size')
    next.delete('network')
    next.delete('host_id')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const buildVmBody = (
    name: string,
    os: string,
    size: string,
    network: string,
    extraTags: string[] = [],
    cloudInitSshPubkey?: string,
    customSpec?: VmWizardPayload['customSpec'],
  ): CreatePlatformVmBody => {
    const spec = sizeToSpec(size, customSpec)
    const cloudUser = cloudInitUserForOs(os)
    return {
      api_version: 'virt.zyvor.dev/v1',
      kind: 'VirtualMachine',
      metadata: { name },
      tags: [os, network, ...extraTags],
      spec: {
        cpu: { sockets: 1, cores: spec.cores },
        memory: spec.memory,
        storage: [{ name: 'root', size: spec.disk, class: 'silver' }],
        network: [{ network, ip_mode: 'dhcp' }],
        ...(cloudInitSshPubkey
          ? { cloud_init: { user: cloudUser, ssh_pubkey: cloudInitSshPubkey } }
          : {}),
      },
    }
  }

  const handleCreate = async (payload: VmWizardPayload) => {
    try {
      if (payload.os === 'custom-iso') {
        navigate(`/platform/create-iso?name=${encodeURIComponent(payload.name)}`)
        return
      }
      if (payload.windows) {
        await handleWindowsCreate({
          name: payload.name,
          os: payload.os,
          size: payload.size,
          network: payload.network,
          windows: payload.windows,
        })
        return
      }
      const spec = sizeToSpec(payload.size, payload.customSpec)
      if (payload.fromTemplate) {
        const r = await createFromTemplate({
          template_ref: `${payload.os}@${payload.templateVersion ?? '1.0.0'}`,
          name: payload.name,
          memory: spec.memory,
          host_id: payload.hostId,
          template_vars: { hostname: payload.name, name: payload.name },
          cloud_init_user: cloudInitUserForOs(payload.os),
          cloud_init_ssh_pubkey: payload.cloudInitSshPubkey,
        })
        toastQueuedOperation(toast, `Deploying ${payload.name}`, r.task_id, tier)
      } else {
        const r = await createPlatformVm(
          buildVmBody(
            payload.name,
            payload.os,
            payload.size,
            payload.network,
            [],
            payload.cloudInitSshPubkey,
            payload.customSpec,
          ),
        )
        toastQueuedOperation(toast, `Creating ${payload.name}`, r.task_id, tier)
      }
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
      throw e
    }
  }

  const handleWindowsCreate = async (payload: {
    name: string
    os: string
    size: string
    network: string
    windows: { virtio: boolean; uefi: boolean; tpm: boolean; secureBoot: boolean; rdp: boolean }
  }) => {
    const spec = sizeToSpec(payload.size)
    const labels: Record<string, string> = { os_family: 'windows' }
    if (payload.windows.tpm) labels.tpm = 'true'
    if (payload.windows.secureBoot) labels.secure_boot = 'true'
    if (payload.windows.virtio) labels.virtio_win = 'true'
    if (payload.windows.rdp) labels.rdp = 'true'
    const body: CreatePlatformVmBody = {
      api_version: 'virt.zyvor.dev/v1',
      kind: 'VirtualMachine',
      metadata: { name: payload.name, labels },
      tags: ['windows', payload.os, payload.network],
      spec: {
        cpu: { sockets: 1, cores: spec.cores },
        memory: spec.memory,
        firmware: payload.windows.uefi ? 'uefi' : 'bios',
        storage: [{ name: 'root', size: spec.disk, class: 'silver' }],
        network: [{ network: payload.network, ip_mode: 'dhcp' }],
      },
    }
    const r = await createPlatformVm(body)
    toastQueuedOperation(toast, `Creating ${payload.name}`, r.task_id, tier)
    await load()
  }

  const onHostDrop = (hostId: string) => {
    const vmId = dragVmId
    setDropHost(null)
    setDragVmId(null)
    if (!vmId) return
    const vm = vmById.get(vmId)
    const host = hosts.find((h) => h.id === hostId)
    if (!vm || !host || vm.host_id === hostId) return
    setMigrateModal({ vm, destId: hostId, destName: host.hostname })
  }

  const missingCount = useMemo(() => vms.filter((v) => v.observed_state === 'missing').length, [vms])

  const pruneMissing = async () => {
    if (!window.confirm(`Remove ${filteredVms.length} missing VM record(s) from inventory? This cannot be undone.`)) return
    setPruneBusy(true)
    try {
      purgeVmShortcuts(filteredVms.map((v) => v.name))
      const r = await pruneMissingPlatformVms()
      toast.success(`Pruned ${r.deleted} missing record(s)`)
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setPruneBusy(false)
    }
  }

  const toggleVmSelect = (id: string) => {
    setSelectedVmIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    if (selectedVmIds.size === filteredVms.length) setSelectedVmIds(new Set())
    else setSelectedVmIds(new Set(filteredVms.map((v) => v.id)))
  }

  const handleBatchPower = async (action: 'start' | 'stop' | 'shutdown' | 'pause' | 'resume') => {
    const ids = Array.from(selectedVmIds).filter((id) => vmById.get(id)?.inventory_source !== 'kubevirt')
    if (ids.length === 0) {
      toast.error('Batch power applies to libvirt VMs only')
      return
    }
    setBatchPowerBusy(true)
    try {
      const r = await batchVmPower(ids, action)
      const ok = r.results.filter((x) => x.task_id).length
      const fail = r.results.filter((x) => x.error).length
      if (ok > 0) toast.success(`${action} queued for ${ok} VM(s)`)
      if (fail > 0) toast.error(`${fail} VM(s) could not be updated`)
      setSelectedVmIds(new Set())
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setBatchPowerBusy(false)
    }
  }

  const handleBatchDelete = async () => {
    setBatchDeleteOpen(false)
    setBatchDeleteBusy(true)
    const ids = Array.from(selectedVmIds)
    const results = await Promise.allSettled(
      ids.map((id) => {
        const vm = vmById.get(id)
        if (vm?.inventory_source === 'kubevirt') {
          return Promise.reject(new Error(`${vm.name}: KubeVirt guests must be deleted from the cluster`))
        }
        return vmDelete(id, true)
      }),
    )
    const ok = results.filter((r) => r.status === 'fulfilled').length
    const fail = results.filter((r) => r.status === 'rejected').length
    if (ok > 0) {
      purgeVmShortcuts(
        ids
          .filter((_, i) => results[i].status === 'fulfilled')
          .map((id) => vmById.get(id)?.name)
          .filter((n): n is string => Boolean(n)),
      )
      toast.success(`Delete queued for ${ok} VM(s)`)
    }
    if (fail > 0) toast.error(`${fail} VM(s) could not be deleted`)
    setSelectedVmIds(new Set())
    setBatchDeleteBusy(false)
    await load()
  }

  useEffect(() => { setSelectedVmIds(new Set()) }, [search, folder, tag, project, source])

  const guestGapsCount = useMemo(
    () =>
      vms.filter((v) => {
        const s = v.guest_tools_status?.toLowerCase()
        return v.inventory_source !== 'kubevirt' && s !== 'healthy' && s !== 'installed'
      }).length,
    [vms],
  )

  const activeLabel =
    tag ? `#${tag}` :
    project ? project :
    folder === 'guest-gaps' ? 'Guest agent gaps' :
    folder === 'missing' ? 'Missing from inventory' :
    finder?.smart_folders.find((f) => f.id === folder)?.label ?? 'All VMs'

  const runFleetGuestQuery = async () => {
    setFleetGuestBusy(true)
    try {
      const vmIds = selectedVmId
        ? [selectedVmId]
        : filteredVms
            .filter((v) => v.observed_state === 'running' && v.inventory_source !== 'kubevirt')
            .slice(0, 25)
            .map((v) => v.id)
      const r = await fleetGuestQuery({
        query: search.trim() || 'guest agent status and logged in users',
        vm_ids: vmIds,
        project: project || undefined,
        tag: tag || undefined,
      })
      setFleetGuestReport(r)
      setContextVmIds(r.vms.map((v) => v.vm_id))
      setContextSummary(r.summary.slice(0, 120))
      openCopilot()
      toast.success(`${r.matched_count} VM(s) matched`)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setFleetGuestBusy(false)
    }
  }

  const toolbar = (
    <>
      {selectedVmIds.size > 0 && (
        <>
          <span className="text-xs text-slate-400 hidden sm:inline">{selectedVmIds.size} selected</span>
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" disabled={batchPowerBusy} onClick={() => void handleBatchPower('start')}>
            <Play className="w-4 h-4" /> Start
          </button>
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" disabled={batchPowerBusy} onClick={() => void handleBatchPower('shutdown')}>
            <Power className="w-4 h-4" /> Shutdown
          </button>
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" disabled={batchPowerBusy} onClick={() => void handleBatchPower('stop')}>
            <Square className="w-4 h-4" /> Force stop
          </button>
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" disabled={batchPowerBusy} onClick={() => void handleBatchPower('pause')}>
            <Pause className="w-4 h-4" /> Pause
          </button>
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" disabled={batchPowerBusy} onClick={() => void handleBatchPower('resume')}>
            <Play className="w-4 h-4" /> Resume
          </button>
          <button
            type="button"
            className="btn-danger text-sm inline-flex items-center gap-1"
            disabled={batchDeleteBusy || batchPowerBusy}
            onClick={() => setBatchDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            {batchDeleteBusy ? 'Deleting…' : `Delete (${selectedVmIds.size})`}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => setSelectedVmIds(new Set())}>
            Clear
          </button>
        </>
      )}
      {selectedVmIds.size === 0 && filteredVms.length > 0 && (
        <button type="button" className="btn-secondary text-sm" onClick={toggleAllVisible}>
          Select all
        </button>
      )}
      {folder === 'missing' && filteredVms.length > 0 && (
        <button
          type="button"
          className="btn-danger text-sm"
          disabled={pruneBusy}
          onClick={() => void pruneMissing()}
        >
          {pruneBusy ? 'Pruning…' : 'Prune missing records'}
        </button>
      )}
      <button type="button" className="btn-secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4" /></button>
      <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" disabled={fleetGuestBusy} onClick={() => void runFleetGuestQuery()}>
        {fleetGuestBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Analyze guests
      </button>
      <button type="button" className="btn-secondary" onClick={() => setWindowsOpen(true)}>Windows VM</button>
      <Link to="/platform/vm-builder" className="btn-secondary flex items-center gap-2 text-sm">AI builder</Link>
      <button type="button" className="btn-primary flex items-center gap-2" onClick={() => setWizardOpen(true)}><Plus className="w-4 h-4" /> Create VM</button>
    </>
  )

  const vmGrid = view === 'launchpad' ? (
    <div className="grid gap-6 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {filteredVms.map((v) => {
        const running = vmSemanticKind(v.observed_state) === 'running'
        return (
          <div
            key={v.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-platform-vm', v.id)
              e.dataTransfer.effectAllowed = 'move'
              setDragVmId(v.id)
            }}
            onClick={() => setSelectedVmId(v.id)}
            className={`cursor-grab active:cursor-grabbing rounded-2xl p-1 ${selectedVmId === v.id ? 'ring-1 ring-sky-400/40' : ''}`}
          >
            <Link to={`/platform/vms/${v.id}`} onClick={(e) => e.stopPropagation()} className="block">
              <LaunchpadAppIcon
                name={v.name}
                icon={<Monitor className={`w-8 h-8 sm:w-9 sm:h-9 ${running ? '' : 'opacity-75'}`} />}
                gradient={vmLaunchpadGradient(v.observed_state)}
              />
            </Link>
            {running && v.inventory_source !== 'kubevirt' && (
              <div className="flex justify-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                <Link to={`/platform/vms/${v.id}/console`} className="p-1 rounded hover:bg-white/10" title="VNC"><Monitor className="w-3.5 h-3.5 text-slate-400" /></Link>
                <button type="button" className="p-1 rounded hover:bg-white/10" title="SSH" onClick={() => setSshVm(v)}><Terminal className="w-3.5 h-3.5 text-slate-400" /></button>
              </div>
            )}
            {(v.tags ?? []).length > 0 && (
              <p className="text-[10px] text-slate-500 text-center truncate px-1">{(v.tags ?? []).slice(0, 2).join(' · ')}</p>
            )}
          </div>
        )
      })}
    </div>
  ) : (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-white/[0.04]">
            <th className="p-3 w-10">
              <input
                type="checkbox"
                aria-label="Select all visible VMs"
                checked={filteredVms.length > 0 && selectedVmIds.size === filteredVms.length}
                onChange={toggleAllVisible}
              />
            </th>
            <th className="p-3">Name</th>
            <th className="p-3">Source</th>
            <th className="p-3">State</th>
            <th className="p-3">Tags</th>
            <th className="p-3">Host</th>
            <th className="p-3">Guest IP</th>
            <th className="p-3">Guest agent</th>
            <th className="p-3">vCPU</th>
            <th className="p-3">Memory</th>
            <th className="p-3 text-right">Access</th>
          </tr>
        </thead>
        <tbody>
          {filteredVms.map((v) => {
            const running = v.observed_state === 'running'
            const libvirt = v.inventory_source !== 'kubevirt'
            return (
            <tr
              key={v.id}
              className={`border-b border-slate-900/80 cursor-pointer ${selectedVmId === v.id ? 'bg-sky-500/10' : 'hover:bg-white/[0.02]'}`}
              onClick={() => setSelectedVmId(v.id)}
            >
              <td className="p-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`Select ${v.name}`}
                  checked={selectedVmIds.has(v.id)}
                  onChange={() => toggleVmSelect(v.id)}
                />
              </td>
              <td className="p-3"><Link to={`/platform/vms/${v.id}`} className={`hover:underline ${hubLinkClasses()}`} onClick={(e) => e.stopPropagation()}>{v.name}</Link></td>
              <td className="p-3 text-xs text-slate-500 capitalize">{v.inventory_source ?? 'libvirt'}</td>
              <td className="p-3">
                <VmStatusBadge state={v.observed_state} />
              </td>
              <td className="p-3 text-xs text-slate-500">{(v.tags ?? []).join(', ') || '—'}</td>
              <td className="p-3 text-slate-500">
                {v.inventory_source === 'kubevirt'
                  ? (v.k8s_namespace ? `${v.k8s_namespace}/` : 'k8s/')
                  : v.host_id
                    ? hostMap.get(v.host_id)
                    : '—'}
              </td>
              <td className="p-3 font-mono text-xs text-emerald-300/80">{v.guest_ip || '—'}</td>
              <td className="p-3">
                {libvirt ? (
                  <span
                    className={statusPillClasses(
                      v.guest_tools_status === 'healthy' || v.guest_tools_status === 'installed'
                        ? 'ok'
                        : 'warn',
                    )}
                  >
                    {guestToolsStatusLabel(v.guest_tools_status)}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="p-3">{v.vcpus}</td>
              <td className="p-3">{Math.round(v.memory_mib / 1024)} Gi</td>
              <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                {running && libvirt && (
                  <div className="inline-flex gap-1 justify-end">
                    <Link to={`/platform/vms/${v.id}/console`} className="btn-secondary text-xs py-1 px-2" title="VNC"><Monitor className="w-3.5 h-3.5" /></Link>
                    <button type="button" className="btn-secondary text-xs py-1 px-2" title="SSH" onClick={() => setSshVm(v)}><Terminal className="w-3.5 h-3.5" /></button>
                    {v.guest_ip && (
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1 px-2"
                        title="Copy guest IP"
                        onClick={() => {
                          void navigator.clipboard.writeText(v.guest_ip!)
                          toast.success('Guest IP copied')
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const inspector = selectedVm ? (
    <div className="platform-finder-inspector p-4 space-y-3 h-full overflow-y-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-white">{selectedVm.name}</h3>
        <VmStatusBadge state={selectedVm.observed_state} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div><dt className="platform-finder-inspector-label">Source</dt><dd className="capitalize text-white">{selectedVm.inventory_source ?? 'libvirt'}</dd></div>
        <div><dt className="platform-finder-inspector-label">State</dt><dd><VmStatusBadge state={selectedVm.observed_state} /></dd></div>
        <div><dt className="platform-finder-inspector-label">Host</dt><dd className="text-white">{selectedVm.inventory_source === 'kubevirt' ? (selectedVm.k8s_namespace ?? 'default') : selectedVm.host_id ? hostMap.get(selectedVm.host_id) : '—'}</dd></div>
        <div><dt className="platform-finder-inspector-label">vCPU</dt><dd className="text-white">{selectedVm.vcpus}</dd></div>
        <div><dt className="platform-finder-inspector-label">Memory</dt><dd className="text-white">{Math.round(selectedVm.memory_mib / 1024)} Gi</dd></div>
        {selectedVm.guest_ip && (
          <div className="col-span-2"><dt className="platform-finder-inspector-label">Guest IP</dt><dd className="font-mono text-emerald-300/90">{selectedVm.guest_ip}</dd></div>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link to={`/platform/vms/${selectedVm.id}/console`} className="btn-secondary text-sm flex-1 text-center inline-flex items-center justify-center gap-1">
          <Monitor className="w-3.5 h-3.5" /> VNC
        </Link>
        {selectedVm.inventory_source !== 'kubevirt' && (
          <button
            type="button"
            className="btn-secondary text-sm flex-1 inline-flex items-center justify-center gap-1"
            onClick={() => setSshVm(selectedVm)}
          >
            <Terminal className="w-3.5 h-3.5" /> SSH
          </button>
        )}
        {selectedVm.guest_ip && (
          <button
            type="button"
            className="btn-secondary text-sm inline-flex items-center gap-1"
            title="Copy guest IP"
            onClick={() => {
              void navigator.clipboard.writeText(selectedVm.guest_ip!)
              toast.success('Guest IP copied')
            }}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <Link to={`/platform/vms/${selectedVm.id}`} className="platform-finder-inspector-cta btn-primary text-sm block text-center">Open VM</Link>
      {selectedVm.host_id && (
        <Link
          to={`/platform/hosts/finder?host=${encodeURIComponent(selectedVm.host_id)}&vm=${encodeURIComponent(selectedVm.id)}`}
          className="btn-secondary text-xs block text-center"
        >
          Open in Machine Finder
        </Link>
      )}
      {selectedVm.managed === false && (
        <button type="button" className="btn-secondary text-xs" onClick={async () => {
          try { await adoptPlatformVm(selectedVm.id); toast.success('Adopted'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
        }}>Adopt discovered VM</button>
      )}
    </div>
  ) : null

  return (
    <PageLayout
      compact
      title="Virtual Machines"
      subtitle={finder ? `${finder.summary} · ${filteredVms.length} shown` : undefined}
      icon={<Monitor className="w-6 h-6 text-slate-400" />}
      actions={
        <button type="button" className="btn-primary text-sm inline-flex items-center gap-1" onClick={() => { setWizardInitial(undefined); setWizardOpen(true) }}>
          <Plus className="w-4 h-4" /> New VM
        </button>
      }
      contentClassName="space-y-4"
    >
      {error && <StructuredErrorBanner error={error} />}

      {folder === 'missing' && filteredVms.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-medium">Missing from hypervisor inventory</p>
          <p className="text-xs text-amber-200/80 mt-1">
            These VM records no longer exist on the host libvirt domain list. Prune removes stale database rows (admin only).
          </p>
        </div>
      )}

      {fleetGuestReport && (
        <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 p-4 text-sm relative">
          <button
            type="button"
            className="absolute top-3 right-3 p-1 text-slate-500 hover:text-slate-300"
            aria-label="Dismiss fleet guest report"
            onClick={() => setFleetGuestReport(null)}
          >
            <X className="w-4 h-4" />
          </button>
          <p className="text-slate-200 pr-8">{fleetGuestReport.summary}</p>
          <p className="text-xs text-slate-500 mt-1">
            {fleetGuestReport.matched_count} matched · {fleetGuestReport.scanned_count} scanned
          </p>
          {fleetGuestReport.matched_count === 0 ? (
            <p className="text-xs text-slate-500 mt-2">
              No VMs matched — refine search, select running libvirt guests, or check the Guest agent gaps folder.
            </p>
          ) : (
            <ul className="mt-2 text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto">
              {fleetGuestReport.vms.map((v) => (
                <li key={v.vm_id}>
                  <Link
                    to={`/platform/vms/${v.vm_id}?tab=guestHealth`}
                    className="font-mono text-sky-300/90 hover:underline"
                  >
                    {v.vm_name}
                  </Link>
                  {' — '}
                  <span className={statusPillClasses(installStateTone(v.install_state))}>{v.install_state}</span>
                  {v.os_pretty_name ? ` · ${v.os_pretty_name}` : ''}
                  {v.guest_ip ? ` · ${v.guest_ip}` : ''}
                  {v.flags.length > 0 ? ` [${v.flags.join(',')}]` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <FinderView
        title="Inventory"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search VMs…"
        viewMode={finderViewMode}
        onViewModeChange={setFinderViewMode}
        toolbarActions={toolbar}
        pathSegments={[
          { label: 'Platform', onClick: () => navigate('/platform') },
          { label: 'Finder', onClick: () => setFilter({ folder: 'all' }) },
          { label: activeLabel },
        ]}
        columnsContent={
          <div className="flex min-h-[420px] border border-white/[0.06] rounded-xl overflow-hidden">
            <aside className="w-44 shrink-0 border-r border-white/[0.06] p-2 space-y-0.5 overflow-y-auto">
              {(finder?.smart_folders ?? []).map((f) => (
                <SidebarRow key={f.id} active={!tag && !project && folder === f.id} label={f.label} count={f.count} onClick={() => setFilter({ folder: f.id })} />
              ))}
              <SidebarRow
                active={!tag && !project && folder === 'guest-gaps'}
                label="Guest agent gaps"
                count={guestGapsCount}
                onClick={() => setFilter({ folder: 'guest-gaps' })}
              />
            </aside>
            <div className="w-56 shrink-0 border-r border-white/[0.06] overflow-y-auto">
              <div className="platform-finder-inspector-col-header flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
                <input
                  type="checkbox"
                  aria-label="Select all visible VMs"
                  checked={filteredVms.length > 0 && selectedVmIds.size === filteredVms.length}
                  onChange={toggleAllVisible}
                />
                <span className="flex-1">VMs</span>
              </div>
              {filteredVms.map((v) => (
                <div
                  key={v.id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border-b border-white/[0.04] ${selectedVm?.id === v.id ? 'bg-sky-500/15 text-sky-100' : 'text-white/80 hover:bg-white/[0.03]'}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${v.name}`}
                    checked={selectedVmIds.has(v.id)}
                    onChange={() => toggleVmSelect(v.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="flex-1 text-left truncate"
                    onClick={() => setSelectedVmId(v.id)}
                  >
                    {v.name}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto">
              {selectedVm ? inspector : <p className="platform-finder-inspector platform-finder-inspector-empty p-4">Select a VM</p>}
            </div>
          </div>
        }
        listContent={
          <div className="flex flex-col xl:flex-row gap-4">
            <aside className="xl:w-52 shrink-0 space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1 mb-2">
                  <FolderOpen className="w-3 h-3" /> Smart Folders
                </p>
                <div className="space-y-0.5">
                  {(finder?.smart_folders ?? []).map((f) => (
                    <SidebarRow key={f.id} active={!tag && !project && !source && folder === f.id} label={f.label} count={f.count} onClick={() => setFilter({ folder: f.id })} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">Inventory</p>
                <div className="space-y-0.5">
                  <SidebarRow active={!source && !tag && !project && folder === 'all'} label="All sources" count={vms.length} onClick={() => { const p = new URLSearchParams(searchParams); p.delete('source'); setSearchParams(p, { replace: true }) }} />
                  <SidebarRow active={source === 'libvirt'} label="Libvirt" count={vms.filter((v) => (v.inventory_source ?? 'libvirt') === 'libvirt').length} onClick={() => { const p = new URLSearchParams(searchParams); p.set('source', 'libvirt'); p.delete('folder'); setSearchParams(p, { replace: true }) }} />
                  <SidebarRow active={source === 'kubevirt'} label="KubeVirt" count={vms.filter((v) => v.inventory_source === 'kubevirt').length} onClick={() => { const p = new URLSearchParams(searchParams); p.set('source', 'kubevirt'); p.delete('folder'); setSearchParams(p, { replace: true }) }} />
                  <SidebarRow active={folder === 'discovered'} label="Discovered" count={vms.filter((v) => v.managed === false).length} onClick={() => setFilter({ folder: 'discovered' })} />
                  <SidebarRow active={folder === 'missing'} label="Missing" count={missingCount} onClick={() => setFilter({ folder: 'missing' })} />
                </div>
              </div>
              {(finder?.tags.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1 mb-2">
                    <Tag className="w-3 h-3" /> Tags
                  </p>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {finder!.tags.map((t) => (
                      <SidebarRow key={t.tag} active={tag === t.tag} label={`#${t.tag}`} count={t.count} onClick={() => setFilter({ tag: t.tag })} />
                    ))}
                  </div>
                </div>
              )}
              {(finder?.projects.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">Projects</p>
                  <div className="space-y-0.5">
                    {finder!.projects.map((p) => (
                      <SidebarRow key={p.project} active={project === p.project} label={p.project} count={p.count} onClick={() => setFilter({ project: p.project })} />
                    ))}
                  </div>
                </div>
              )}
            </aside>
            <div className="flex-1 min-w-0">{vmGrid}</div>
            <aside className="xl:w-44 shrink-0 space-y-2 hidden xl:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1"><Server className="w-3 h-3" /> Drop to migrate</p>
              {hosts.map((h) => (
                <div
                  key={h.id}
                  onDragOver={(e) => { e.preventDefault(); setDropHost(h.id) }}
                  onDragLeave={() => setDropHost(null)}
                  onDrop={(e) => { e.preventDefault(); onHostDrop(h.id) }}
                  className={`rounded-xl border p-3 text-sm transition ${
                    dropHost === h.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/[0.06] bg-slate-900/40'
                  }`}
                >
                  <p className="font-medium">{h.hostname}</p>
                  <p className="text-xs text-slate-500">{h.state} · {h.vm_count} VMs</p>
                </div>
              ))}
            </aside>
          </div>
        }
        inspector={inspector}
        isEmpty={filteredVms.length === 0 && !error}
        emptyState={
          <PlatformEmptyState title="No virtual machines" subtitle="Try another smart folder or create a VM.">
            <button type="button" className="btn-primary mt-3" onClick={() => setWizardOpen(true)}>Create VM</button>
          </PlatformEmptyState>
        }
      />

      <SimpleCreateVmWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreate={handleCreate} initial={wizardInitial} />
      <WindowsCreateWizard open={windowsOpen} onClose={() => setWindowsOpen(false)} onCreate={handleCreate} />
      {migrateModal && (
        <MigratePrecheckModal
          vm={migrateModal.vm}
          destHostId={migrateModal.destId}
          destHostName={migrateModal.destName}
          onClose={() => setMigrateModal(null)}
          onDone={(taskId) => {
            if (taskId) toastQueuedOperation(toast, `Migrating ${migrateModal.vm.name}`, taskId, tier)
            else toast.success('Migration queued')
            void load()
          }}
        />
      )}
      {sshVm && (
        <VmSshConnectDialog
          open
          vmName={sshVm.name}
          defaultIp={sshVm.guest_ip ?? ''}
          defaultUser="ubuntu"
          detectedIps={sshVm.guest_ip ? [sshVm.guest_ip] : []}
          onClose={() => setSshVm(null)}
          onConnect={(h, u) => navigateVmSshSession(sshVm.name, h, u)}
        />
      )}

      {selectedVmIds.size > 0 && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-slate-900/95 backdrop-blur border border-red-500/30 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3"
          data-testid="platform-vm-bulk-bar"
        >
          <span className="text-sm font-medium text-slate-200">{selectedVmIds.size} selected</span>
          <div className="w-px h-5 bg-white/[0.08]" />
          <button
            type="button"
            disabled={batchDeleteBusy}
            onClick={() => setBatchDeleteOpen(true)}
            className="btn-danger text-sm inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {batchDeleteBusy ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" onClick={() => setSelectedVmIds(new Set())} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition" title="Clear selection" aria-label="Clear selection">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={batchDeleteOpen}
        title="Delete VMs"
        message={`Permanently delete ${selectedVmIds.size} VM(s)? Each guest is stopped if running, then removed from libvirt and inventory. Type DELETE to confirm.`}
        confirmLabel="Delete all"
        typeToMatch="DELETE"
        typeToMatchLabel="Type DELETE (all caps) to confirm bulk delete:"
        onConfirm={() => void handleBatchDelete()}
        onCancel={() => setBatchDeleteOpen(false)}
      />
    </PageLayout>
  )
}
