// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Copy, Play, Square, RotateCcw, Trash2, Terminal, MoveRight, Archive, HardDrive, Activity, Shield, ExternalLink, Monitor, Pause, Power, Server, Loader2 } from 'lucide-react'
import PageLayout from '../../components/PageLayout'
import GuestToolsStrip from '../../components/platform/GuestToolsStrip'
import GuestAgentDiagnosticsPanel, {
  GuestAgentHeaderPill,
  installStateTone,
  type RunGuestActionFn,
} from '../../components/platform/GuestAgentDiagnosticsPanel'
import GuestkitOfflineAssurancePanel from '../../components/platform/GuestkitOfflineAssurancePanel'
import PlatformEmptyState from '../../components/platform/PlatformEmptyState'
import GuestAiInsightsPanel from '../../components/platform/GuestAiInsightsPanel'
import { getVmGuestAiInsights } from '../../api/platform'
import MachinaVmOutageRca from '../../components/ai/MachinaVmOutageRca'
import MachinaExplainObjectPanel from '../../components/ai/MachinaExplainObjectPanel'
import MachinaVmTroubleshootPanel from '../../components/ai/MachinaVmTroubleshootPanel'
import AiTerminalSuggestStrip from '../../components/ai/AiTerminalSuggestStrip'
import VmOverviewTroubleshootPanel from '../../components/ai/VmOverviewTroubleshootPanel'
import MachinaDoctorPanel from '../../components/platform/MachinaDoctorPanel'
import ExplainButton from '../../components/ai/ExplainButton'
import OsDiagnosePanel from '../../components/platform/OsDiagnosePanel'
import VmDetailTabs, { type VmDetailTab, isGuestRelatedTab } from '../../components/platform/VmDetailTabs'
import { MacGlassPanel, MacListRow } from '../../components/platform/mac/PlatformMacUi'
import JsonInspector from '../../components/platform/JsonInspector'
import { StructuredErrorBanner } from '../../components/StructuredErrorBanner'
import {
  createVmBackup,
  createVmSnapshot,
  type CreateVmSnapshotBody,
  deleteVmSnapshot,
  getPlatformVm,
  getPlatformVmSpec,
  getVmDisks,
  getPlatformVmMetrics,
  getVmMigrations,
  runVmHealthCheck,
  attachVmDisk,
  adoptPlatformVm,
  getVmHaPolicy,
  listPlatformHosts,
  listVmBackups,
  listVmSnapshots,
  listVmTimeline,
  migratePrecheck,
  patchVm,
  restoreVmBackup,
  revertVmSnapshot,
  cloneVmSnapshot,
  getVmDomainXml,
  setVmHa,
  vmClone,
  installGuestTools,
  vmDelete,
  vmMigrate,
  vmPower,
  type PlatformHost,
  type PlatformVm,
  type MigratePrecheckResult,
  type HaPolicy,
  type SnapshotRecord,
  type VmTimelineEntry,
  type VmDiskRow,
  type VmMigrationRecord,
  type BackupRecord,
  type VmHealthReport,
  getVmGuestHealth,
  getVmGuestServices,
  diagnoseVm,
  getVmTopology,
  type TopologyGraph,
  type VmGuestHealthReport,
  type GuestAiInsightsReport,
  type VmGuestServicesReport,
  type VmOsDiagnoseReport,
} from '../../api/platform'
import { getVmDoctor, type VmDoctorReport } from '../../api/ai'
import { getVmGuestFirewallPorts, type GuestPortReport } from '../../api/zeusFirewall'
import { useAi } from '../../contexts/AiContext'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError, isPlatformNotFoundError } from '../../utils/apiError'
import { GUEST_TOAST_CHANNEL_ATTACH, qgaHealthy } from '../../utils/guestAgentUx'
import { toastQueuedOperation } from '../../utils/platformTaskToast'
import {hostStateTone, httpStatusTone, migrationReadinessTone, riskTone, statusBadgeClasses, statusPillClasses, statusSurfaceClasses, statusToneClass, taskStatusTone, vmStateTone, webhookDeliveryTone, hubLinkClasses} from '../../utils/semanticColors'
import { vmErrorPresentation } from '../../utils/vmErrorPresentation'
import { loadVmSshPrefs } from '../../utils/vmSshPrefs'
import VmDailyAccessStrip from '../../components/vm/VmDailyAccessStrip'
import VmPortForwardPanel from '../../components/vm/VmPortForwardPanel'
import VmSshConnectDialog, { navigateVmSshSession } from '../../components/vm/VmSshConnectDialog'
import { isCenterPopoutMode, openCenterPopout } from '../../utils/platformCenterPopout'
import { PlatformOpenStackVmLink } from '../../components/platform/PlatformCrossLinks'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'
import { tasksHubHref } from '../../utils/platformHubLinks'
import { downloadVmIacBundle, downloadVmIacZip, exportVmDisk, exportVmIac, retirePlatformVm, type VmIacExportBundle } from '../../api/platformVmLifecycle'
import { publishVmAsTemplate } from '../../api/platformTemplatesExtra'

export default function PlatformVmDetail() {
  const location = useLocation()
  const navigate = useNavigate()
  const isPopout = isCenterPopoutMode(location.search)
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const rawTab = tabParam === 'guestPorts' ? 'security' : tabParam
  const tab: VmDetailTab = (
    ['overview', 'doctor', 'console', 'performance', 'disks', 'network', 'guestHealth', 'guestServices', 'security', 'snapshots', 'backup', 'topology', 'events', 'settings'] as VmDetailTab[]
  ).includes(rawTab as VmDetailTab) ? (rawTab as VmDetailTab) : 'overview'
  const setTab = (next: VmDetailTab, extra?: { guestAction?: string }) => {
    if (next === 'console' && id) {
      navigate(`/platform/vms/${id}/console`)
      return
    }
    setSearchParams((p) => {
      const n = new URLSearchParams(p)
      if (next === 'overview') n.delete('tab')
      else n.set('tab', next)
      if (extra?.guestAction) n.set('guestAction', extra.guestAction)
      else n.delete('guestAction')
      return n
    }, { replace: true })
  }
  const guestMigratePlanAction = searchParams.get('guestAction') === 'migrate-plan'
  const [tier] = usePlatformDesktopTier()
  const { info } = usePlatformInfo()
  const { setContextVmId, setContextSummary, openCopilot } = useAi()
  const toast = useToastContext()
  const [vm, setVm] = useState<PlatformVm | null>(null)
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [error, setError] = useState<string | null>(null)
  const [destHost, setDestHost] = useState('')
  const [migrateLive, setMigrateLive] = useState(true)
  const [migrateBandwidth, setMigrateBandwidth] = useState('')
  const [migratePostcopy, setMigratePostcopy] = useState(false)
  const [timeline, setTimeline] = useState<VmTimelineEntry[]>([])
  const [cloneName, setCloneName] = useState('')
  const [cloneMode, setCloneMode] = useState<'linked' | 'full'>('linked')
  const [precheck, setPrecheck] = useState<MigratePrecheckResult | null>(null)
  const [ha, setHa] = useState<HaPolicy>({ enabled: false, restart_attempts: 3, restart_priority: 'medium', fence_on_failure: false, anti_affinity: false })
  const [specJson, setSpecJson] = useState<string>('')
  const [specData, setSpecData] = useState<Record<string, unknown> | null>(null)
  const [snapName, setSnapName] = useState('snap-01')
  const [snapDiskOnly, setSnapDiskOnly] = useState(true)
  const [snapQuiesce, setSnapQuiesce] = useState(false)
  const [snapStorageMode, setSnapStorageMode] = useState('')
  const [snapAiHint, setSnapAiHint] = useState<GuestAiInsightsReport | null>(null)
  const [snapAiLoading, setSnapAiLoading] = useState(false)
  const [publishTplName, setPublishTplName] = useState('')
  const [publishTplVersion, setPublishTplVersion] = useState('1.0.0')
  const [iacBundle, setIacBundle] = useState<VmIacExportBundle | null>(null)
  const [project, setProject] = useState('')
  const [tags, setTags] = useState('')
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([])
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [disks, setDisks] = useState<VmDiskRow[]>([])
  const [metrics, setMetrics] = useState<{ cpu_percent: number; memory_used_mib: number; updated_at: string } | null>(null)
  const [attachPath, setAttachPath] = useState('/var/lib/libvirt/images/data.qcow2')
  const [attachDev, setAttachDev] = useState('vdb')
  const [health, setHealth] = useState<VmHealthReport | null>(null)
  const [doctor, setDoctor] = useState<VmDoctorReport | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [doctorLoading, setDoctorLoading] = useState(false)
  const [guestInstalling, setGuestInstalling] = useState(false)
  const [guestPorts, setGuestPorts] = useState<GuestPortReport | null>(null)
  const [guestPortsLoading, setGuestPortsLoading] = useState(false)
  const [guestHealth, setGuestHealth] = useState<VmGuestHealthReport | null>(null)
  const [guestHealthLoading, setGuestHealthLoading] = useState(false)
  const [guestHealthError, setGuestHealthError] = useState<string | null>(null)
  const [guestHealthRefreshedAt, setGuestHealthRefreshedAt] = useState<Date | null>(null)
  const [guestServices, setGuestServices] = useState<VmGuestServicesReport | null>(null)
  const [guestServicesError, setGuestServicesError] = useState<string | null>(null)
  const [topology, setTopology] = useState<TopologyGraph | null>(null)
  const [guestServicesLoading, setGuestServicesLoading] = useState(false)
  const [vmDiagnose, setVmDiagnose] = useState<VmOsDiagnoseReport | null>(null)
  const [vmDiagnoseLoading, setVmDiagnoseLoading] = useState(false)
  const [migrations, setMigrations] = useState<VmMigrationRecord[]>([])
  const [sshDialogOpen, setSshDialogOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      const [v, h, policy, spec, snaps, bks, tline, dsk, mtr] = await Promise.all([
        getPlatformVm(id),
        listPlatformHosts(),
        getVmHaPolicy(id),
        getPlatformVmSpec(id),
        listVmSnapshots(id),
        listVmBackups(id),
        listVmTimeline(id).catch(() => [] as VmTimelineEntry[]),
        getVmDisks(id),
        getPlatformVmMetrics(id).catch(() => null),
      ])
      setVm(v)
      setHosts(h)
      setHa(policy)
      setSpecJson(JSON.stringify(spec, null, 2))
      setSpecData(spec as Record<string, unknown>)
      setProject(v.project || '')
      setTags((v.tags || []).join(', '))
      setSnapshots(snaps)
      setBackups(bks)
      setTimeline(tline)
      setDisks(dsk)
      setMetrics(mtr)
      if (!destHost && h.length > 1) {
        setDestHost(h.find((x) => x.id !== v.host_id)?.id || h[0]?.id || '')
      }
    } catch (e: unknown) {
      if (isPlatformNotFoundError(e)) {
        toast.info('This virtual machine was removed.')
        navigate('/platform/vms', { replace: true })
        return
      }
      setError(formatUserError(e))
    }
  }, [id, destHost, navigate, toast])

  useEffect(() => {
    if (tab !== 'topology' || !id) return
    void getVmTopology(id).then(setTopology).catch(() => setTopology(null))
  }, [tab, id])

  const runHealth = useCallback(async () => {
    if (!id) return
    setHealthLoading(true)
    try {
      setHealth(await runVmHealthCheck(id))
    } catch {
      setHealth(null)
    } finally {
      setHealthLoading(false)
    }
  }, [id])

  const runDoctor = useCallback(async () => {
    if (!id) return
    setDoctorLoading(true)
    try {
      setDoctor(await getVmDoctor(id))
    } catch {
      setDoctor(null)
    } finally {
      setDoctorLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  useEffect(() => { void runHealth() }, [runHealth])
  useEffect(() => { void runDoctor() }, [runDoctor])

  useEffect(() => {
    if (!id || tab !== 'events') return
    void getVmMigrations(id).then(setMigrations).catch(() => setMigrations([]))
  }, [id, tab])

  const loadGuestPorts = useCallback(async () => {
    if (!id) return
    setGuestPortsLoading(true)
    try {
      setGuestPorts(await getVmGuestFirewallPorts(id))
    } catch {
      setGuestPorts(null)
    } finally {
      setGuestPortsLoading(false)
    }
  }, [id])

  const loadGuestHealth = useCallback(async () => {
    if (!id) return
    setGuestHealthLoading(true)
    setGuestHealthError(null)
    try {
      const gh = await getVmGuestHealth(id)
      setGuestHealth(gh)
      setGuestHealthRefreshedAt(new Date())
      if (gh.os_pretty_name || gh.install_state === 'running') {
        const chip = [gh.os_pretty_name, qgaHealthy(gh) ? 'QGA' : gh.install_state]
          .filter(Boolean)
          .join(' · ')
        setContextSummary(chip || null)
      }
    } catch (e: unknown) {
      setGuestHealth(null)
      setGuestHealthError(formatUserError(e))
    } finally {
      setGuestHealthLoading(false)
    }
  }, [id])

  const loadGuestServices = useCallback(async () => {
    if (!id) return
    setGuestServicesLoading(true)
    setGuestServicesError(null)
    try {
      setGuestServices(await getVmGuestServices(id))
    } catch (e: unknown) {
      setGuestServices(null)
      setGuestServicesError(formatUserError(e))
    } finally {
      setGuestServicesLoading(false)
    }
  }, [id])

  const queueGuestToolsInstall = useCallback(async () => {
    if (!id) return
    setGuestInstalling(true)
    try {
      const r = await installGuestTools(id)
      toastQueuedOperation(toast, GUEST_TOAST_CHANNEL_ATTACH, r.task_id, tier)
      await loadGuestHealth()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setGuestInstalling(false)
    }
  }, [id, loadGuestHealth, tier, toast])

  const runGuestAction: RunGuestActionFn = useCallback(
    async (key, fn, success) => {
      try {
        await fn()
        toast.success(success)
        await loadGuestHealth()
      } catch (e: unknown) {
        toast.error(formatUserError(e))
      }
    },
    [loadGuestHealth, toast],
  )

  const runVmDiagnose = useCallback(async (query?: string) => {
    if (!id) return
    setVmDiagnoseLoading(true)
    try {
      setVmDiagnose(await diagnoseVm(id, query))
    } catch {
      setVmDiagnose(null)
    } finally {
      setVmDiagnoseLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) void loadGuestHealth()
  }, [id, loadGuestHealth])

  useEffect(() => {
    if (!id || !vm || vm.observed_state !== 'running' || vm.inventory_source === 'kubevirt') return
    void loadGuestPorts()
  }, [id, vm?.observed_state, vm?.inventory_source, loadGuestPorts])

  useEffect(() => {
    if (tab === 'security' && id) void loadGuestPorts()
    if (tab === 'guestServices' && id) void loadGuestServices()
  }, [tab, id, loadGuestPorts, loadGuestServices])

  useEffect(() => {
    setContextVmId(id ?? null)
    return () => setContextVmId(null)
  }, [id, setContextVmId])

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      const r = await fn()
      if (r && typeof r === 'object' && 'task_id' in r && typeof (r as { task_id: string }).task_id === 'string') {
        toastQueuedOperation(toast, label, (r as { task_id: string }).task_id, tier)
      } else {
        toast.success(label)
      }
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const queueVmDelete = async (label: string) => {
    if (!id) return
    try {
      const r = await vmDelete(id, true)
      navigate('/platform/vms', { replace: true, state: { vmDeleteTaskId: r.task_id, vmDeleteLabel: label } })
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const hostRow = hosts.find((h) => h.id === vm?.host_id)
  const hostName = hostRow?.hostname
  const hostLabel =
    hostRow && (hostRow.hostname === 'localhost' || hostRow.hostname === '127.0.0.1')
      ? hostRow.address && hostRow.address !== '127.0.0.1'
        ? hostRow.address
        : `${hostRow.hostname} — update host enrollment`
      : hostName || 'No host'
  const stateTone = vm ? vmStateTone(vm.observed_state) : 'neutral'
  const lifecycleTone = vm?.lifecycle_phase === 'running' ? 'ok' : vm?.lifecycle_phase === 'error' ? 'error' : 'neutral'

  const resolvedGuestIp =
    guestHealth?.guest_ip?.trim() || health?.guest_ip?.trim() || vm?.guest_ip?.trim() || ''

  useEffect(() => {
    if (!id || !vm || vm.observed_state !== 'running' || resolvedGuestIp || vm.inventory_source === 'kubevirt') {
      return
    }
    let cancelled = false
    let attempts = 0
    const poll = () => {
      if (cancelled || attempts >= 24) return
      attempts += 1
      void getVmGuestHealth(id)
        .then((gh) => {
          if (gh?.guest_ip?.trim()) setGuestHealth(gh)
        })
        .catch(() => undefined)
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [id, vm?.observed_state, vm?.inventory_source, resolvedGuestIp])

  if (!id) return null

  const sshUser = (() => {
    const ci = specData?.cloud_init as { user?: string } | undefined
    return ci?.user?.trim() || loadVmSshPrefs(vm?.name ?? '')?.user || 'root'
  })()
  const guestIp = resolvedGuestIp

  const natForwardHref = guestIp
    ? `/host-networking?tab=portforward&vm_ip=${encodeURIComponent(guestIp)}&vm_port=22`
    : undefined

  const powerActions = vm && vm.inventory_source !== 'kubevirt' && vm.observed_state !== 'missing' ? (
    <>
      {(vm.observed_state === 'stopped' || vm.observed_state === 'shut off') && (
        <button type="button" className="btn-primary text-sm" onClick={() => void act('Start queued', () => vmPower(id, 'start'))}><Play className="w-4 h-4" /> Start</button>
      )}
      {vm.observed_state === 'paused' && (
        <button type="button" className="btn-primary text-sm" onClick={() => void act('Resume queued', () => vmPower(id, 'resume'))}><Play className="w-4 h-4" /> Resume</button>
      )}
      {vm.observed_state === 'running' && (
        <>
          {guestHealth?.install_state === 'running' && guestHealth.agent_ping ? (
            <button
              type="button"
              className="btn-secondary text-sm"
              title="Clean shutdown via QEMU guest agent"
              onClick={() => void act('Graceful shutdown queued', () => vmPower(id, 'shutdown', { mode: 'agent' }))}
            >
              <Power className="w-4 h-4" /> Graceful shutdown
            </button>
          ) : (
            <button type="button" className="btn-secondary text-sm" title="ACPI shutdown" onClick={() => void act('Shutdown queued', () => vmPower(id, 'shutdown'))}>
              <Power className="w-4 h-4" /> Shutdown
            </button>
          )}
          <button type="button" className="btn-secondary text-sm" onClick={() => void act('Pause queued', () => vmPower(id, 'pause'))}><Pause className="w-4 h-4" /> Pause</button>
          {guestHealth?.install_state === 'running' && guestHealth.agent_ping ? (
            <button
              type="button"
              className="btn-secondary text-sm"
              title="Clean reboot via QEMU guest agent"
              onClick={() => void act('Graceful reboot queued', () => vmPower(id, 'reboot', { mode: 'agent' }))}
            >
              <RotateCcw className="w-4 h-4" /> Graceful reboot
            </button>
          ) : (
            <button type="button" className="btn-secondary text-sm" onClick={() => void act('Reboot queued', () => vmPower(id, 'reboot'))}>
              <RotateCcw className="w-4 h-4" /> Reboot
            </button>
          )}
        </>
      )}
      {(vm.observed_state === 'running' || vm.observed_state === 'paused') && (
        <button type="button" className="btn-secondary text-sm" title="Force power off (libvirt destroy)" onClick={() => void act('Force stop queued', () => vmPower(id, 'stop'))}><Square className="w-4 h-4" /> Force stop</button>
      )}
      {vm.inventory_source !== 'kubevirt' && (
        <button type="button" className="btn-secondary text-sm" onClick={() => setSshDialogOpen(true)}><Terminal className="w-4 h-4" /> SSH</button>
      )}
    </>
  ) : null

  return (
    <PageLayout
      compact
      prepend={!isPopout ? (
        <Link to="/platform/vms" className={`text-sm inline-flex items-center gap-1 ${hubLinkClasses()}`}>
          <ArrowLeft className="w-4 h-4" /> Virtual Machines
        </Link>
      ) : undefined}
      title={vm?.name ?? 'Virtual machine'}
      subtitle={vm ? (
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <span className={statusPillClasses(stateTone)}>{vm.observed_state}</span>
          {vm.lifecycle_phase && vm.lifecycle_phase !== vm.observed_state && (
            <span className={statusPillClasses(lifecycleTone)}>{vm.lifecycle_phase}</span>
          )}
          <span className="text-slate-500">·</span>
          <span className="text-slate-400" title={hostRow?.address ?? undefined}>{hostLabel}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{vm.vcpus} vCPU · {Math.round(vm.memory_mib / 1024)} GiB</span>
          {guestIp && (
            <>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-emerald-300/90">{guestIp}</span>
            </>
          )}
          <GuestAgentHeaderPill report={guestHealth} onClick={() => setTab('guestHealth')} />
          {guestHealth && !qgaHealthy(guestHealth) && vm.observed_state === 'running' && (
            <button
              type="button"
              className={statusPillClasses(installStateTone(guestHealth.install_state, guestHealth.agent_ping))}
              onClick={() => setTab('guestHealth')}
            >
              Guest agent
            </button>
          )}
          {vm.ha_enabled && <span className={statusPillClasses('info')}>HA</span>}
        </span>
      ) : undefined}
      icon={<Monitor className="w-6 h-6 text-slate-400" />}
      actions={vm ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/platform/vms/${id}/console`} className="btn-primary text-sm inline-flex items-center gap-1">
            <Monitor className="w-4 h-4" /> VNC
          </Link>
          {powerActions}
          {!isPopout && (
            <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => openCenterPopout(`/platform/vms/${id}`)}>
              <ExternalLink className="w-4 h-4" /> Pop out
            </button>
          )}
          <button
            type="button"
            className="btn-danger text-sm"
            onClick={() => {
              if (!window.confirm('Delete this VM permanently?')) return
              void queueVmDelete('Delete queued')
            }}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      ) : undefined}
      error={error}
      onErrorRetry={() => void load()}
      contentLoading={!vm && !error}
    >
      {vm && (
        <>
          <PlatformOpenStackVmLink vm={vm} />
          {vm.inventory_source === 'kubevirt' && (
            <MacGlassPanel title="KubeVirt guest">
              <p className="text-sm text-slate-300">
                Namespace: <span className="font-mono text-sky-200">{vm.k8s_namespace ?? 'default'}</span>
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Link to="/platform/integrations?tab=k8s" className={`text-sm ${hubLinkClasses()}`}>K8s Workloads →</Link>
              </div>
            </MacGlassPanel>
          )}

          {vm.observed_state === 'missing' && (
            <MacGlassPanel title="Missing from inventory">
              <p className={`text-sm ${statusToneClass('warn')}`}>
                This VM is no longer reported by the last inventory scan. Sync hosts or remove the stale record.
              </p>
            </MacGlassPanel>
          )}
          {vm.managed === false && (
            <MacGlassPanel title="Discovered VM">
              <div className="flex items-center justify-between gap-3">
                <p className={`text-sm ${statusToneClass('warn')}`}>
                  {vm.inventory_source === 'kubevirt'
                    ? 'Discovered KubeVirt VM — adopt to track it in platform inventory.'
                    : 'Discovered on a host — adopt to manage lifecycle from the platform.'}
                </p>
                <button type="button" className="btn-primary" onClick={() => void act('VM adopted', () => adoptPlatformVm(id))}>Adopt VM</button>
              </div>
            </MacGlassPanel>
          )}
          {vm.last_error && (
            <StructuredErrorBanner error={vmErrorPresentation(vm.last_error)} />
          )}
          {(vm.observed_state === 'missing' || (vm.last_error && /nodomain|domain not found|no domain with matching name|domain_not_found|kubevirt_not_found/i.test(vm.last_error))) && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-danger text-sm"
                onClick={() => {
                  if (!window.confirm('Remove this stale VM record from the platform?')) return
                  void queueVmDelete('Stale VM removed')
                }}
              >
                <Trash2 className="w-4 h-4" /> Remove stale record
              </button>
              <Link to="/platform/hosts" className="btn-secondary text-sm inline-flex items-center">Sync hosts →</Link>
            </div>
          )}

          <VmDetailTabs active={tab} onChange={setTab} />

          {isGuestRelatedTab(tab) && (
            <GuestToolsStrip
              vmId={id}
              compact={tab !== 'overview'}
              guestHealth={guestHealth}
              guestToolsStatus={health?.guest_tools_status}
              guestIp={guestHealth?.guest_ip || health?.guest_ip}
              guestHostname={guestHealth?.guest_hostname || health?.guest_hostname}
              installing={guestInstalling}
              onOpenGuestHealth={() => setTab('guestHealth')}
              onInstall={
                vm.observed_state === 'running' ? () => void queueGuestToolsInstall() : undefined
              }
            />
          )}

          {tab === 'overview' && vm.inventory_source !== 'kubevirt' && (
            <VmDailyAccessStrip
              vmName={vm.name}
              vmState={vm.observed_state}
              sshUser={sshUser}
              guestIp={guestIp}
              consoleHref={`/platform/vms/${id}/console`}
              specJson={specJson}
              platformVmId={id}
              guestIpWaiting={vm.observed_state === 'running' && !guestIp}
              guestIpHint={guestHealth?.issues?.[0]}
              onRefreshGuestIp={() => void loadGuestHealth()}
              onInstallGuestTools={
                vm.observed_state === 'running' ? () => void queueGuestToolsInstall() : undefined
              }
              guestToolsInstalling={guestInstalling}
              onExportXml={async () => {
                const { xml } = await getVmDomainXml(id)
                return xml
              }}
              guestPorts={guestPorts}
              guestPortsLoading={guestPortsLoading}
              onRefreshPorts={() => void loadGuestPorts()}
              onAllPorts={() => setTab('security')}
              natForwardHref={natForwardHref}
              onNotify={(m) => toast.success(m)}
            />
          )}

          {tab === 'overview' && (
            <div className="space-y-4">
              <MachinaExplainObjectPanel kind="vm" id={id!} name={vm.name} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <InfoCard label="Desired state" value={vm.desired_state} />
                <InfoCard label="Lifecycle" value={vm.lifecycle_phase || 'idle'} />
                <InfoCard label="Project" value={project || 'default'} />
                <InfoCard label="Backup" value={backups.some((b) => b.status === 'completed') ? 'Protected' : 'Not configured'} />
              </div>
              {metrics && (
                <MacGlassPanel title="At a glance">
                  <div className="flex flex-wrap gap-6 text-sm text-slate-300">
                    <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-slate-500" /> CPU {metrics.cpu_percent.toFixed(1)}%</span>
                    <span>Memory {metrics.memory_used_mib} MiB</span>
                    <button type="button" className={`text-xs ${hubLinkClasses()}`} onClick={() => setTab('performance')}>Performance details →</button>
                  </div>
                </MacGlassPanel>
              )}
              <MacGlassPanel
                title="Zeus health doctor"
                subtitle="Live VM diagnostics from the controller doctor API"
                action={
                  <button type="button" className="btn-secondary text-xs" disabled={doctorLoading} onClick={() => void runDoctor()}>
                    {doctorLoading ? 'Scanning…' : 'Rescan'}
                  </button>
                }
              >
                {doctorLoading && !doctor && <p className="text-sm text-slate-500">Running health scan…</p>}
                {doctor && (
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-200">
                      Score <span className="font-semibold">{doctor.score_numeric}/100</span>
                      {' · '}
                      <span className={statusToneClass(doctor.healthy ? 'ok' : 'warn')}>{doctor.score_label}</span>
                      {' · '}
                      <span className="text-slate-500">{doctor.checks_passed}/{doctor.checks_total} checks passed</span>
                    </p>
                    {doctor.issues.length > 0 ? (
                      <ul className="text-xs text-slate-400 space-y-1">
                        {doctor.issues.slice(0, 3).map((issue) => (
                          <li key={issue.id}>{issue.message}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">All checks passed.</p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button type="button" className={`text-xs ${hubLinkClasses()}`} onClick={() => setTab('doctor')}>
                        Full doctor report →
                      </button>
                      {info?.guestkit?.enabled && (
                        <button type="button" className={`text-xs ${hubLinkClasses()}`} onClick={() => setTab('guestHealth')}>
                          Offline assurance →
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {!doctorLoading && !doctor && (
                  <p className="text-sm text-slate-500">Doctor scan unavailable — open the Doctor tab to retry.</p>
                )}
              </MacGlassPanel>
              {vm.observed_state !== 'running' && (
                <VmOverviewTroubleshootPanel vmId={id!} vmName={vm.name} onOpenDoctor={() => setTab('doctor')} />
              )}
              <MacGlassPanel title="AI terminal tips" subtitle="Zeus-suggested commands for this VM">
                <AiTerminalSuggestStrip vmId={id} vmName={vm.name} compact />
              </MacGlassPanel>
              <MacGlassPanel title="Organization">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Project</label>
                    <input className="input" value={project} onChange={(e) => setProject(e.target.value)} placeholder="default" />
                  </div>
                  <div className="flex-1 min-w-[12rem]">
                    <label className="text-xs text-slate-500 block mb-1">Tags</label>
                    <input className="input w-full" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="prod, web" />
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => void act('Project updated', () => patchVm(id, { project, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }))}>Save</button>
                </div>
              </MacGlassPanel>
              {vm.host_id && (
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link to={`/platform/zeus/security/firewall/${vm.host_id}`} className={`inline-flex items-center gap-1 ${hubLinkClasses()}`}>
                    <Shield className="w-4 h-4" /> Host firewall (Zeus)
                  </Link>
                  <button type="button" className={hubLinkClasses()} onClick={() => setTab('doctor')}>Run health doctor →</button>
                </div>
              )}
            </div>
          )}

          <VmSshConnectDialog
            open={sshDialogOpen}
            vmName={vm.name}
            defaultIp={guestIp}
            defaultUser={sshUser}
            detectedIps={guestIp ? [guestIp] : []}
            onClose={() => setSshDialogOpen(false)}
            onConnect={(h, u) => navigateVmSshSession(vm.name, h, u, id)}
          />

          {tab === 'doctor' && (
            <div className="pt-2 space-y-3">
              <div className="flex justify-end">
                <ExplainButton screen="vm_doctor" objectRef={{ vm_id: id, score: doctor?.score_numeric }} />
              </div>
              {vm && <MachinaVmOutageRca vmId={id!} vmName={vm.name} />}
              <MachinaDoctorPanel
                vmId={id}
                report={doctor}
                loading={doctorLoading}
                onRefresh={() => void runDoctor()}
                onTab={(t) => setTab(t as VmDetailTab)}
              />
              {info?.guestkit?.enabled && (
                <MacGlassPanel title="GuestKit offline migration" subtitle="Disk-based KVM migrate plan without a running guest agent">
                  <p className="text-sm text-slate-400 mb-3">
                    Score boot blockers and required changes for live migration using the VM disk image while stopped or online.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => setTab('guestHealth', { guestAction: 'migrate-plan' })}
                    >
                      Run migrate plan
                    </button>
                    <button type="button" className={`btn-secondary text-sm ${hubLinkClasses()}`} onClick={() => setTab('guestHealth')}>
                      Offline assurance
                    </button>
                    <Link to="/platform/migration" className={`btn-secondary text-sm ${hubLinkClasses()}`}>
                      Migration hub
                    </Link>
                  </div>
                </MacGlassPanel>
              )}
              <MachinaVmTroubleshootPanel vmId={id!} vmName={vm?.name} />
            </div>
          )}

          {tab === 'console' && (
            <MacGlassPanel title="VNC console">
              <p className="text-sm text-slate-400 mb-4">
                Opens a full-screen noVNC session in a dedicated view.
              </p>
              <Link to={`/platform/vms/${id}/console`} className="btn-primary inline-flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Open VNC
              </Link>
            </MacGlassPanel>
          )}

          {tab === 'performance' && (
            <MacGlassPanel title="Performance">
              {metrics ? (
                <>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> CPU {metrics.cpu_percent.toFixed(1)}%</span>
                    <span>Memory {metrics.memory_used_mib} MiB</span>
                    <span className="text-slate-500 text-xs">Updated {new Date(metrics.updated_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-500">Guest tools will unlock richer CPU, disk latency, and noisy-neighbor insights.</p>
                </>
              ) : (
                <p className="text-slate-500 text-sm">Metrics appear after the next host inventory sync.</p>
              )}
            </MacGlassPanel>
          )}

          {tab === 'disks' && (
            <div className="space-y-4 pt-2">
              {disks.length > 0 && (
                <MacGlassPanel title="Attached disks">
                  <ul className="text-sm text-slate-400 space-y-2">{disks.map((d) => (
                    <li key={d.id}>{d.name} · {d.size_gib} GiB · {d.storage_class}{d.path ? ` · ${d.path}` : ''}</li>
                  ))}</ul>
                </MacGlassPanel>
              )}
              <MacGlassPanel title="Attach disk">
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="text-xs text-slate-500">Path<input className="input mt-1 block min-w-[18rem]" value={attachPath} onChange={(e) => setAttachPath(e.target.value)} /></label>
                  <label className="text-xs text-slate-500">Target dev<input className="input mt-1 block w-24" value={attachDev} onChange={(e) => setAttachDev(e.target.value)} /></label>
                  <button type="button" className="btn-secondary" disabled={vm.managed === false} onClick={() => void act('Attach disk queued', () => attachVmDisk(id, { disk_path: attachPath, target_dev: attachDev }))}>Attach</button>
                </div>
              </MacGlassPanel>
            </div>
          )}

          {tab === 'network' && vm.inventory_source !== 'kubevirt' && (
            <div className="space-y-4 pt-2">
              <MacGlassPanel title="Hypervisor NAT (port forwards)">
                <VmPortForwardPanel
                  platformVmId={id!}
                  vmName={vm.name}
                  guestIp={guestIp}
                  onNotify={(msg) => toast.success(msg)}
                />
              </MacGlassPanel>
              <MacGlassPanel title="Spec & bridges">
                <p className="text-sm text-slate-400">Network configuration is defined in the VM spec. Use migration pre-check for cross-host network validation.</p>
                <Link to="/platform/networks" className={`text-sm mt-2 inline-block ${hubLinkClasses()}`}>Manage networks →</Link>
              </MacGlassPanel>
            </div>
          )}
          {tab === 'network' && vm.inventory_source === 'kubevirt' && (
            <MacGlassPanel title="Network" className="pt-2">
              <p className="text-sm text-slate-400">KubeVirt networking is managed via the cluster CNI. Use kubectl or the K8s console for service exposure.</p>
            </MacGlassPanel>
          )}

          {tab === 'guestHealth' && (
            <div className="space-y-4 pt-2">
              <MacGlassPanel title="Guest OS health" subtitle="Live QGA · GuestKit offline disk · cloud-init">
                <GuestAgentDiagnosticsPanel
                  vmId={id!}
                  loading={guestHealthLoading}
                  report={guestHealth}
                  error={guestHealthError}
                  vmState={vm.observed_state}
                  lastRefreshedAt={guestHealthRefreshedAt}
                  onRefresh={() => void loadGuestHealth()}
                  onStartVm={
                    vm.observed_state === 'stopped' || vm.observed_state === 'shut off'
                      ? () => void act('Start queued', () => vmPower(id, 'start'))
                      : undefined
                  }
                  onInstall={
                    vm.observed_state === 'running' ? () => void queueGuestToolsInstall() : undefined
                  }
                  installing={guestInstalling}
                  onRunAction={runGuestAction}
                />
                <div className="mt-4">
                  <GuestkitOfflineAssurancePanel
                    vmId={id!}
                    vmState={vm.observed_state}
                    guestkitEnabled={Boolean(info?.guestkit?.enabled)}
                    autoRunMigratePlan={guestMigratePlanAction}
                  />
                </div>
                <OsDiagnosePanel
                  resourceId={id!}
                  resourceKind="vm"
                  defaultQuery="guest health and agent connectivity"
                  loading={vmDiagnoseLoading}
                  report={vmDiagnose}
                  onRun={(q) => void runVmDiagnose(q)}
                  onAskCopilot={openCopilot}
                />
              </MacGlassPanel>
              <GuestAiInsightsPanel
                vmId={id!}
                autoLoad
                onApplied={() => void loadGuestHealth()}
                onRunAction={runGuestAction}
              />
            </div>
          )}

          {tab === 'guestServices' && (
            <div className="space-y-4 pt-2">
              <MacGlassPanel title="Guest services" subtitle="Agent + listening process inventory (v1)">
                {guestServicesLoading && (
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading guest services…
                  </p>
                )}
                {!guestServicesLoading && guestServicesError && (
                  <div className={`rounded-lg border p-3 text-sm ${statusSurfaceClasses('error')}`}>
                    <p className="text-slate-200">{guestServicesError}</p>
                    <button type="button" className="btn-secondary text-xs mt-2" onClick={() => void loadGuestServices()}>
                      Retry
                    </button>
                  </div>
                )}
                {!guestServicesLoading && !guestServicesError && guestServices && (
                  <>
                    <p className="text-xs text-slate-500 mb-3">{guestServices.summary}</p>
                    {guestServices.services.length === 0 ? (
                      <PlatformEmptyState
                        icon={Server}
                        title="No guest services"
                        subtitle="The guest agent did not report any service inventory for this VM."
                      />
                    ) : (
                      guestServices.services.map((s, i) => (
                        <MacListRow key={`${s.name}-${i}`} title={s.name} subtitle={`${s.status} · ${s.detail}`} />
                      ))
                    )}
                  </>
                )}
                {!guestServicesLoading && !guestServicesError && !guestServices && (
                  <PlatformEmptyState
                    icon={Server}
                    title="Guest services unavailable"
                    subtitle="Start the VM and ensure the guest agent is active, then refresh."
                    action={
                      <button type="button" className="btn-secondary text-xs" onClick={() => void loadGuestServices()}>
                        Refresh
                      </button>
                    }
                  />
                )}
                <button type="button" className="btn-secondary text-xs mt-3" onClick={() => void loadGuestServices()}>Refresh</button>
                <OsDiagnosePanel
                  resourceId={id!}
                  resourceKind="vm"
                  defaultQuery="guest services and exposed ports"
                  loading={vmDiagnoseLoading}
                  report={vmDiagnose}
                  onRun={(q) => void runVmDiagnose(q)}
                  onAskCopilot={openCopilot}
                />
              </MacGlassPanel>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-end">
                <ExplainButton screen="guest_ports" objectRef={{ vm_id: id }} />
              </div>
              <MacGlassPanel
                title="Security"
                subtitle="In-guest listening ports via QEMU guest agent · host firewall on parent machine"
              >
                {vm.host_id && (
                  <Link to={`/platform/zeus/security/firewall/${vm.host_id}`} className={`text-sm inline-flex items-center gap-1 mb-4 ${hubLinkClasses()}`}>
                    <Shield className="w-4 h-4" /> Host firewall (Zeus) →
                  </Link>
                )}
                {guestPortsLoading && <p className="text-sm text-slate-500">Loading guest ports…</p>}
                {!guestPortsLoading && guestPorts && (
                  <>
                    <p className="text-xs text-slate-500 mb-3">
                      {guestPorts.summary}
                      {!guestPorts.agent_reachable && ' · Guest agent unreachable — install Guest Tools'}
                    </p>
                    {guestPorts.ports.length === 0 ? (
                      <p className="text-sm text-slate-500">No listening ports reported inside the guest.</p>
                    ) : (
                      <div className="space-y-1">
                        {guestPorts.ports.map((p) => (
                          <MacListRow
                            key={`${p.port}-${p.protocol}`}
                            title={`${p.port}/${p.protocol}`}
                            subtitle={[p.service_name || p.process, String(p.risk)].filter(Boolean).join(' · ')}
                            badge={
                              (p.risk === 'Critical' || p.risk === 'critical') ? (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadgeClasses('error')}`}>critical</span>
                              ) : (p.risk === 'Warning' || p.risk === 'warning') ? (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadgeClasses('warn')}`}>warning</span>
                              ) : undefined
                            }
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
                {!guestPortsLoading && !guestPorts && (
                  <p className="text-sm text-slate-500">Could not load guest firewall ports. Ensure Guest Tools are installed and the VM is running.</p>
                )}
                <button type="button" className="btn-secondary text-xs mt-3" onClick={() => void loadGuestPorts()}>Refresh</button>
              </MacGlassPanel>
            </div>
          )}

          {tab === 'snapshots' && (
            <MacGlassPanel title="Snapshots & Time Machine" className="pt-2">
              {timeline.length > 0 && (
                <div className="mb-4 pb-4 border-b border-white/5">
                  <h3 className="text-sm font-semibold mb-2">Time Machine</h3>
                  <ul className="text-xs space-y-2 max-h-48 overflow-y-auto">
                    {timeline.map((e) => (
                      <li key={`${e.kind}-${e.id}`} className="flex flex-wrap items-center justify-between gap-2 text-slate-400">
                        <span>
                          <span className="text-slate-500 uppercase text-[10px] mr-1">{e.kind}</span>
                          {e.label} · {new Date(e.created_at).toLocaleString()}
                        </span>
                        {e.kind === 'snapshot' && (
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={() => {
                              const name = e.label.replace(/^Snapshot:\s*/, '')
                              void act('Revert queued', () => revertVmSnapshot(id, name))
                            }}
                          >
                            Revert
                          </button>
                        )}
                        {e.kind === 'backup' && e.status === 'completed' && (
                          <button type="button" className="btn-secondary text-xs" onClick={() => void act('Restore queued', () => restoreVmBackup(id, e.id))}>
                            Restore
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <input className="input w-full max-w-xs" value={snapName} onChange={(e) => setSnapName(e.target.value)} placeholder="snap-01" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={snapAiLoading || vm.observed_state !== 'running'}
                  onClick={() => {
                    setSnapAiLoading(true)
                    void getVmGuestAiInsights(id, { focus: 'snapshot' })
                      .then((r) => {
                        setSnapAiHint(r)
                        const quiesceRec = r.recommendations.find((x) => x.action === 'snapshot.quiesce')
                        if (quiesceRec) setSnapQuiesce(true)
                      })
                      .catch((e: unknown) => toast.error(formatUserError(e)))
                      .finally(() => setSnapAiLoading(false))
                  }}
                >
                  AI snapshot advice
                </button>
                {snapAiHint && (
                  <p className="text-xs text-slate-400 max-w-xl">{snapAiHint.summary}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-400">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={snapDiskOnly} onChange={(e) => setSnapDiskOnly(e.target.checked)} /> Disk only
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={snapQuiesce} onChange={(e) => setSnapQuiesce(e.target.checked)} /> Guest quiesce
                </label>
                <select className="input text-xs max-w-[140px]" value={snapStorageMode} onChange={(e) => setSnapStorageMode(e.target.value)}>
                  <option value="">Storage: auto</option>
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    const body: CreateVmSnapshotBody = {
                      name: snapName,
                      disk_only: snapDiskOnly,
                      quiesce: snapQuiesce,
                      storage_mode: snapStorageMode || undefined,
                    }
                    void act('Snapshot queued', () => createVmSnapshot(id, body))
                  }}
                >
                  Create snapshot
                </button>
              </div>
              <ul className="text-xs space-y-3 mt-3">
                {snapshots.map((s) => (
                  <li key={s.id} className="flex flex-col gap-2 text-slate-400 border-b border-white/5 pb-2">
                    <span>{s.name} ({s.status})</span>
                    <span className="flex flex-wrap gap-1">
                      <button type="button" className="btn-secondary text-xs" onClick={() => void act('Revert queued', () => revertVmSnapshot(id, s.name))}>Revert</button>
                      <button type="button" className="btn-secondary text-xs" onClick={() => void act('Delete queued', () => deleteVmSnapshot(id, s.name))}>Delete</button>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary text-xs w-fit"
                      onClick={() => void act('Clone queued', () => cloneVmSnapshot(id, s.name, `${vm.name}-from-${s.name}`))}
                    >
                      Clone to {vm.name}-from-{s.name}
                    </button>
                  </li>
                ))}
              </ul>
            </MacGlassPanel>
          )}

          {tab === 'backup' && (
            <MacGlassPanel title="Backup" className="pt-2">
              <p className="text-xs text-slate-500">Restore will not overwrite the current VM unless you choose restore in place.</p>
              <button type="button" className="btn-secondary text-xs" onClick={() => void act('Backup queued', () => createVmBackup(id))}><Archive className="w-3 h-3 inline" /> Backup now</button>
              <ul className="text-xs space-y-2">
                {backups.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-slate-400">
                    <span>{b.backup_type} ({b.status})</span>
                    {b.status === 'completed' && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => void act('Restore queued', () => restoreVmBackup(id, b.id))}>Restore</button>
                    )}
                  </li>
                ))}
              </ul>
            </MacGlassPanel>
          )}

          {tab === 'topology' && (
            <MacGlassPanel title="VM topology" className="pt-2">
              {!topology ? (
                <p className="text-sm text-slate-400">Loading topology…</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-slate-400">{topology.nodes.length} nodes · {topology.edges.length} edges</p>
                  <ul className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                    {topology.nodes.map((n) => (
                      <li key={n.id} className="py-2 flex justify-between gap-2">
                        <span className="text-slate-200">{n.name}</span>
                        <span className="text-xs text-slate-500 uppercase">{n.kind}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/platform/topology" className={`text-xs ${hubLinkClasses()}`}>Open fleet topology →</Link>
                </div>
              )}
            </MacGlassPanel>
          )}

          {tab === 'events' && (
            <div className="space-y-4 pt-2">
              <MacGlassPanel title="Migration history">
                {migrations.length === 0 ? (
                  <p className="text-sm text-slate-400">No migration records for this VM.</p>
                ) : (
                  <ul className="divide-y divide-white/[0.04] -mx-1">
                    {migrations.map((m) => (
                      <MacListRow
                        key={m.id}
                        title={`${m.source_host} → ${m.dest_host}`}
                        subtitle={`${m.status} · ${new Date(m.started_at).toLocaleString()}`}
                      />
                    ))}
                  </ul>
                )}
              </MacGlassPanel>
              <MacGlassPanel title="Events">
                <Link to={tasksHubHref(tier)} className={hubLinkClasses()}>View task history →</Link>
              </MacGlassPanel>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              <MacGlassPanel title="High availability">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ha.enabled} onChange={(e) => setHa({ ...ha, enabled: e.target.checked })} /> Restart on host failure</label>
                <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={ha.fence_on_failure} onChange={(e) => setHa({ ...ha, fence_on_failure: e.target.checked })} /> Fence host on failure</label>
                <button type="button" className="btn-secondary mt-2" onClick={() => void act('HA policy updated', () => setVmHa(id, ha))}>Save HA policy</button>
              </MacGlassPanel>
              <MacGlassPanel title="Live migrate & clone">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm"><MoveRight className="w-4 h-4" /> Live migrate</h3>
                    <select className="input w-full mb-2" value={destHost} onChange={(e) => setDestHost(e.target.value)}>
                      {hosts.map((h) => <option key={h.id} value={h.id}>{h.hostname}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-3 mb-2 text-xs text-slate-400">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={migrateLive} onChange={(e) => setMigrateLive(e.target.checked)} /> Live migration
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={migratePostcopy} onChange={(e) => setMigratePostcopy(e.target.checked)} /> Post-copy
                      </label>
                      <label className="flex items-center gap-2">
                        Bandwidth (MiB/s)
                        <input
                          type="number"
                          min={0}
                          className="input w-20 text-xs"
                          placeholder="auto"
                          value={migrateBandwidth}
                          onChange={(e) => setMigrateBandwidth(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary text-sm" disabled={!destHost} onClick={async () => {
                        try {
                          setPrecheck(await migratePrecheck(id, destHost, migrateLive))
                        } catch (e: unknown) { toast.error(formatUserError(e)) }
                      }}>Pre-check</button>
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={!destHost}
                        onClick={() => void act('Migration queued', () => vmMigrate(id, {
                          dest_host_id: destHost,
                          live: migrateLive,
                          bandwidth_mib: migrateBandwidth ? Number(migrateBandwidth) : undefined,
                          postcopy: migratePostcopy,
                        }))}
                      >
                        Migrate
                      </button>
                    </div>
                    {precheck && (
                      <ul className="text-xs mt-2 space-y-1">{precheck.checks.map((c) => (
                        <li key={c.name} className={statusToneClass(c.passed ? 'ok' : 'error')}>
                          {c.name}: {c.message}
                          {c.remediation && !c.passed && (
                            <p className="text-slate-400 pl-2 mt-1">
                              Fix: {c.remediation}
                              {!c.passed && c.name.toLowerCase().includes('network') && (
                                <button type="button" className="btn-secondary text-[10px] ml-2" onClick={() => setTab('network')}>Choose network</button>
                              )}
                            </p>
                          )}
                        </li>
                      ))}</ul>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm"><Copy className="w-4 h-4" /> Clone</h3>
                    <input className="input w-full mb-2" placeholder="new-vm-name" value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
                    <select className="input w-full mb-2 text-sm" value={cloneMode} onChange={(e) => setCloneMode(e.target.value as 'linked' | 'full')}>
                      <option value="linked">Linked clone (thin)</option>
                      <option value="full">Full clone (independent disk)</option>
                    </select>
                    <button type="button" className="btn-secondary text-sm" disabled={!cloneName} onClick={() => void act('Clone queued', () => vmClone(id, cloneName, cloneMode))}>Clone</button>
                  </div>
                </div>
              </MacGlassPanel>
              <MacGlassPanel title="Lifecycle & export">
                <p className="text-xs text-slate-500 mb-3">
                  Retire stops the VM, tags it, and blocks start. Export disk queues a full qcow2 backup task.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={vm.lifecycle_phase === 'retired'}
                    onClick={() => {
                      if (!window.confirm('Retire this VM? It will be stopped and cannot be started until restored manually.')) return
                      void act('VM retired', () => retirePlatformVm(id, true))
                    }}
                  >
                    Retire VM
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => void act('Disk export queued', () => exportVmDisk(id))}>
                    Export disk (qcow2)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={async () => {
                      try {
                        setIacBundle(await exportVmIac(id))
                        toast.success('IaC bundle loaded — download below')
                      } catch (e: unknown) {
                        toast.error(formatUserError(e))
                      }
                    }}
                  >
                    Load IaC export
                  </button>
                </div>
                {iacBundle && (
                  <div className="mt-3 space-y-2 text-xs">
                    <button type="button" className="btn-secondary text-xs" onClick={() => void downloadVmIacZip(id, vm.name)}>
                      Download ZIP (IaC)
                    </button>
                    <button type="button" className="btn-secondary text-xs" onClick={() => downloadVmIacBundle(iacBundle)}>
                      Download JSON bundle
                    </button>
                    {(['terraform', 'ansible_role', 'cloud_init', 'domain_xml'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className="btn-secondary text-xs mr-2"
                        onClick={() => {
                          const blob = new Blob([iacBundle[key]], { type: 'text/plain' })
                          const a = document.createElement('a')
                          a.href = URL.createObjectURL(blob)
                          a.download = `${vm.name}-${key}.${key === 'terraform' ? 'tf' : key === 'domain_xml' ? 'xml' : 'txt'}`
                          a.click()
                          URL.revokeObjectURL(a.href)
                        }}
                      >
                        Download {key}
                      </button>
                    ))}
                  </div>
                )}
              </MacGlassPanel>
              {vm.inventory_source !== 'kubevirt' && (
                <MacGlassPanel title="Publish golden template">
                  <input className="input w-full mb-2 text-sm" placeholder="template-name" value={publishTplName} onChange={(e) => setPublishTplName(e.target.value)} />
                  <input className="input w-full mb-2 text-sm" placeholder="version" value={publishTplVersion} onChange={(e) => setPublishTplVersion(e.target.value)} />
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={!publishTplName.trim()}
                    onClick={() =>
                      void act('Template published', () =>
                        publishVmAsTemplate(id, {
                          template_name: publishTplName.trim(),
                          version: publishTplVersion.trim() || '1.0.0',
                          marketplace: true,
                        }),
                      )
                    }
                  >
                    Publish from VM
                  </button>
                </MacGlassPanel>
              )}
              <MacGlassPanel title="VM spec">
                {specData ? <JsonInspector data={specData} /> : <p className="text-sm text-slate-500">Spec unavailable</p>}
              </MacGlassPanel>
            </div>
          )}
        </>
      )}
    </PageLayout>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-medium text-slate-100 mt-0.5 capitalize">{value}</p>
    </div>
  )
}
