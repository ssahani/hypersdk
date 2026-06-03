// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Boxes,
  Plus,
  Server,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Shield,
  LayoutGrid,
  FolderOpen,
  Wrench,
} from 'lucide-react'
import PlatformPageChrome, { PlatformRefreshButton, platformStatSubtitle } from '../../components/platform/PlatformPageChrome'
import ActionCard from '../../components/platform/ActionCard'
import PlatformJarvisBriefing from '../../components/platform/PlatformJarvisBriefing'
import PlatformFleetInsights from '../../components/platform/PlatformFleetInsights'
import RemediateChips from '../../components/platform/RemediateChips'
import PlatformWelcome from '../../components/platform/PlatformWelcome'
import InfrastructureDnaStrip from '../../components/platform/InfrastructureDnaStrip'
import TemplateMissingImagesPanel from '../../components/platform/TemplateMissingImagesPanel'
import EnterpriseSecurityStrip from '../../components/platform/EnterpriseSecurityStrip'
import PlatformTahoeEmptyState from '../../components/platform/tahoe/PlatformTahoeEmptyState'
import { MacGlassPanel } from '../../components/platform/mac/PlatformMacUi'
import SimpleCreateVmWizard, {
  cloudInitUserForOs,
  sizeToSpec,
  type VmWizardPayload,
} from '../../components/platform/SimpleCreateVmWizard'
import {
  createFromTemplate,
  createPlatformVm,
  getCapacityReport,
  getClusterSummary,
  listPlatformHosts,
  listPlatformTasks,
  listPlatformVms,
  listMissingTemplateImages,
  type CapacityReport,
  type MissingTemplateImage,
  type ClusterSummary,
  type CreatePlatformVmBody,
  type PlatformHost,
} from '../../api/platform'
import { getAiSecurity } from '../../api/ai'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'
import { statusPillClasses } from '../../utils/semanticColors'
import { loadJarvisShell } from '../../utils/platformJarvisShell'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'
import { tierAtLeast } from '../../utils/platformDesktopTier'
import { hubTilesForTier, showPlatformHubsForTier, DOCK_PREVIEW_HUB_PATHS } from '../../utils/platformHubZones'
import { operationsHubHref } from '../../utils/platformHubLinks'
import { unlockDockPreviewPath } from '../../utils/platformDockPins'

export default function PlatformDashboard() {
  const toast = useToastContext()
  const navigate = useNavigate()
  const [tier] = usePlatformDesktopTier()
  const showPower = tierAtLeast(tier, 'power')
  const showAdvanced = tier === 'advanced'
  const jarvisShell = loadJarvisShell(tier)
  const jarvisLanding = jarvisShell && !showPower
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [vms, setVms] = useState<{ observed_state: string }[]>([])
  const [tasks, setTasks] = useState<{ status: string }[]>([])
  const [cluster, setCluster] = useState<ClusterSummary | null>(null)
  const [capacity, setCapacity] = useState<CapacityReport | null>(null)
  const [security, setSecurity] = useState<Awaited<ReturnType<typeof getAiSecurity>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [missingImages, setMissingImages] = useState<MissingTemplateImage[]>([])
  const [missingImagesSummary, setMissingImagesSummary] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [hosts, v, t, c, cap, sec, missing] = await Promise.all([
        listPlatformHosts(),
        listPlatformVms(),
        listPlatformTasks(),
        getClusterSummary(),
        getCapacityReport().catch(() => null),
        getAiSecurity().catch(() => null),
        listMissingTemplateImages().catch(() => ({ missing: [], count: 0, auto_fetch_count: 0, summary: '' })),
      ])
      setHosts(hosts)
      setVms(v)
      setTasks(t)
      setCluster(c)
      setCapacity(cap)
      setSecurity(sec)
      setMissingImages(missing.missing)
      setMissingImagesSummary(missing.summary)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const running = vms.filter((v) => v.observed_state === 'running').length
  const onlineHosts = hosts.filter((h) => h.state !== 'offline').length
  const failedTasks = tasks.filter((t) => t.status === 'failed').length
  const warnings = failedTasks + (cluster?.offline_hosts || 0)
  const storagePct = capacity && capacity.memory_total_mib > 0
    ? (capacity.memory_used_mib / capacity.memory_total_mib) * 100
    : null
  const healthy = warnings === 0 && onlineHosts === hosts.length
  const securityFindings = security?.findings?.length ?? 0
  const insightBadgeCount = securityFindings + (failedTasks > 0 ? 1 : 0) + (missingImages.length > 0 ? 1 : 0)
  const hubTiles = hubTilesForTier(tier)
  const previewHubTiles = hubTilesForTier('power').filter((hub) => DOCK_PREVIEW_HUB_PATHS.includes(hub.href))

  const hubActionIcon = (id: string) => {
    switch (id) {
      case 'integrations':
        return <Boxes className="w-5 h-5" />
      case 'resources':
        return <FolderOpen className="w-5 h-5" />
      case 'operations':
        return <Wrench className="w-5 h-5" />
      case 'security':
        return <Shield className="w-5 h-5" />
      default:
        return <Boxes className="w-5 h-5" />
    }
  }

  const handleCreate = async (payload: VmWizardPayload) => {
    if (payload.os === 'custom-iso') {
      navigate(`/platform/create-iso?name=${encodeURIComponent(payload.name)}`)
      return
    }
    const spec = sizeToSpec(payload.size, payload.customSpec)
    if (payload.fromTemplate) {
      const r = await createFromTemplate({
        template_ref: `${payload.os}@${payload.templateVersion ?? '1.0.0'}`,
        name: payload.name,
        memory: spec.memory,
        template_vars: { hostname: payload.name, name: payload.name },
        cloud_init_user: cloudInitUserForOs(payload.os),
        cloud_init_ssh_pubkey: payload.cloudInitSshPubkey,
      })
      toast.success(`Deploy queued — track task ${r.task_id.slice(0, 8)} in Tasks`)
    } else {
      const cloudUser = cloudInitUserForOs(payload.os)
      const body: CreatePlatformVmBody = {
        api_version: 'virt.zyvor.dev/v1',
        kind: 'VirtualMachine',
        metadata: { name: payload.name },
        tags: [payload.os, payload.network],
        spec: {
          cpu: { sockets: 1, cores: spec.cores },
          memory: spec.memory,
          storage: [{ name: 'root', size: spec.disk, class: 'silver' }],
          network: [{ network: payload.network, ip_mode: 'dhcp' }],
          ...(payload.cloudInitSshPubkey
            ? { cloud_init: { user: cloudUser, ssh_pubkey: payload.cloudInitSshPubkey } }
            : {}),
        },
      }
      const r = await createPlatformVm(body)
      toast.success(`Create queued — track task ${r.task_id.slice(0, 8)} in Tasks`)
    }
    await load()
  }

  const launchpadGrid = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ActionCard icon={<Plus className="w-5 h-5" />} title="Create VM" subtitle="4-step wizard — OS cards, custom size" onClick={() => setWizardOpen(true)} />
      {!showPlatformHubsForTier(tier) && (
        <>
          <ActionCard icon={<Boxes className="w-5 h-5" />} title="Apps & Integrations" subtitle="OpenStack, K8s, classic tools" to="/platform/integrations" />
          <ActionCard icon={<Server className="w-5 h-5" />} title="Add Host" subtitle="Enroll a hypervisor" to="/platform/enroll" />
          <ActionCard icon={<Bell className="w-5 h-5" />} title="Alerts" subtitle={`${warnings} need attention`} to={operationsHubHref(tier)} />
        </>
      )}
      {showPlatformHubsForTier(tier) && hubTiles.map((hub) => (
        <ActionCard
          key={hub.id}
          icon={hubActionIcon(hub.id)}
          title={hub.label}
          subtitle={hub.description}
          to={hub.href}
        />
      ))}
    </div>
  )

  return (
    <PlatformPageChrome
      error={error}
      onErrorRetry={() => void load()}
      title={!jarvisLanding ? (cluster?.name || 'Production Cluster') : 'Zyvor Platform'}
      subtitle={
        !jarvisLanding ? (
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className={statusPillClasses(healthy ? 'ok' : 'warn')}>
                {healthy ? <><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Healthy</> : <><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />{warnings} warning{warnings === 1 ? '' : 's'}</>}
              </span>
            </span>
            {platformStatSubtitle([
              { label: 'VMs running', value: String(running) },
              { label: 'Hosts online', value: `${onlineHosts} / ${hosts.length}` },
              { label: 'Memory used', value: storagePct != null ? `${Math.round(storagePct)}%` : '—' },
              { label: 'Alerts', value: warnings ? String(warnings) : 'None' },
            ])}
          </span>
        ) : (
          <span className="text-slate-400">Fleet overview and launchpad</span>
        )
      }
      icon={<LayoutGrid className="w-6 h-6 text-slate-400" />}
      actions={<PlatformRefreshButton onClick={() => void load()} />}
      contentClassName="space-y-4"
    >
      <PlatformJarvisBriefing />

      {hosts.length === 0 && (
        <PlatformTahoeEmptyState
          icon={Server}
          title="Get started"
          description="Enroll your first hypervisor to import storage, networks, and VMs."
        >
          <Link to="/platform/enroll" className="tahoe-btn-primary text-sm">Add host</Link>
          <Link to="/platform/integrations" className="tahoe-btn-ghost text-sm">Apps &amp; Integrations</Link>
        </PlatformTahoeEmptyState>
      )}

      <MacGlassPanel title="Launchpad" subtitle={jarvisLanding ? 'Create workloads or open a hub' : undefined}>
        {launchpadGrid}
        {tier === 'normal' && previewHubTiles.length > 0 && (
          <div className="space-y-3 mt-4 pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Hub previews · Power user</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {previewHubTiles.map((hub) => (
                <button
                  key={hub.id}
                  type="button"
                  className="platform-action-card tahoe-hub-preview-card flex flex-col items-start gap-3 p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left w-full"
                  onClick={() => {
                    if (unlockDockPreviewPath(hub.href)) {
                      toast.success('Switched to Power user — hub unlocked')
                      navigate(hub.href)
                    }
                  }}
                >
                  <div className="p-2.5 rounded-xl bg-slate-800/60 text-slate-300">{hubActionIcon(hub.id)}</div>
                  <div>
                    <p className="font-semibold text-slate-200">{hub.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{hub.description}</p>
                    <p className="text-[10px] text-sky-400/80 mt-2">Tap to unlock Power user</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </MacGlassPanel>

      {showPower && (
        <PlatformFleetInsights badgeCount={insightBadgeCount}>
          <TemplateMissingImagesPanel summary={missingImagesSummary} missing={missingImages} />
          <RemediateChips compact />
          <InfrastructureDnaStrip />
          {showAdvanced && <EnterpriseSecurityStrip />}
        </PlatformFleetInsights>
      )}

      <SimpleCreateVmWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreate={handleCreate} />
      <PlatformWelcome vmCount={vms.length} onCreateVm={() => setWizardOpen(true)} onDone={() => void load()} />
    </PlatformPageChrome>
  )
}
