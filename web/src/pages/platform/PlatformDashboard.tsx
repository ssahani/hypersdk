// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Boxes,
  Plus,
  ArrowRightLeft,
  Server,
  Upload,
  Terminal,
  Bell,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  Shield,
  Sparkles,
} from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner'
import ActionCard from '../../components/platform/ActionCard'
import PlatformAboutHelp from '../../components/platform/PlatformAboutHelp'
import PlatformWelcome from '../../components/platform/PlatformWelcome'
import { MacGlassPanel, MacStatWidget } from '../../components/platform/mac/PlatformMacUi'
import SimpleCreateVmWizard, { sizeToSpec } from '../../components/platform/SimpleCreateVmWizard'
import {
  createPlatformVm,
  getCapacityReport,
  getClusterSummary,
  listPlatformHosts,
  listPlatformTasks,
  listPlatformVms,
  type CapacityReport,
  type ClusterSummary,
  type CreatePlatformVmBody,
  type PlatformHost,
  type PlatformTask,
} from '../../api/platform'
import { getAiSecurity, getAiSettings, getZeusSummary, runAutopilotSafe, type AiSettings, type SecurityReport } from '../../api/ai'
import { useAi } from '../../contexts/AiContext'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function PlatformDashboard() {
  const toast = useToastContext()
  const { mode } = useAi()
  const [autopilotBusy, setAutopilotBusy] = useState(false)
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [vms, setVms] = useState<{ observed_state: string }[]>([])
  const [tasks, setTasks] = useState<PlatformTask[]>([])
  const [cluster, setCluster] = useState<ClusterSummary | null>(null)
  const [capacity, setCapacity] = useState<CapacityReport | null>(null)
  const [security, setSecurity] = useState<SecurityReport | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null)
  const [zeusStrip, setZeusStrip] = useState<{
    status: string
    tagline: string
    firewallCritical: number
    firewallDrift: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [hosts, v, t, c, cap, sec, ai] = await Promise.all([
        listPlatformHosts(),
        listPlatformVms(),
        listPlatformTasks(),
        getClusterSummary(),
        getCapacityReport().catch(() => null),
        getAiSecurity().catch(() => null),
        getAiSettings().catch(() => null),
      ])
      setHosts(hosts)
      setVms(v)
      setTasks(t)
      setCluster(c)
      setCapacity(cap)
      setSecurity(sec)
      setAiSettings(ai)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    void getZeusSummary()
      .then((z) => setZeusStrip({
        status: z.status,
        tagline: z.tagline,
        firewallCritical: z.firewall_critical_hosts ?? 0,
        firewallDrift: z.firewall_drift_hosts ?? 0,
      }))
      .catch(() => {})
  }, [])

  const running = vms.filter((v) => v.observed_state === 'running').length
  const onlineHosts = hosts.filter((h) => h.state !== 'offline').length
  const failedTasks = tasks.filter((t) => t.status === 'failed').length
  const warnings = failedTasks + (cluster?.offline_hosts || 0)
  const storagePct = capacity && capacity.memory_total_mib > 0
    ? (capacity.memory_used_mib / capacity.memory_total_mib) * 100
    : null
  const healthy = warnings === 0 && onlineHosts === hosts.length

  const handleCreate = async ({ name, os, size, network }: { name: string; os: string; size: string; network: string }) => {
    const spec = sizeToSpec(size)
    const body: CreatePlatformVmBody = {
      api_version: 'virt.zyvor.dev/v1',
      kind: 'VirtualMachine',
      metadata: { name },
      tags: [os, network],
      spec: {
        cpu: { sockets: 1, cores: spec.cores },
        memory: spec.memory,
        storage: [{ name: 'root', size: spec.disk, class: 'silver' }],
        network: [{ network, ip_mode: 'dhcp' }],
      },
    }
    await createPlatformVm(body)
    toast.success('Create task queued')
    await load()
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/80">Zyvor Platform</p>
            <p className="text-xs text-slate-500 mt-0.5">Control your KVM datacenter</p>
            <h1 className="text-3xl font-bold text-slate-50 mt-1">{cluster?.name || 'Production Cluster'}</h1>
          </div>
          <button type="button" onClick={() => void load()} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
          healthy ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
        }`}>
          {healthy ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {healthy ? 'Healthy' : `${warnings} warning${warnings === 1 ? '' : 's'} need attention`}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MacStatWidget label="VMs running" value={String(running)} icon={<Terminal className="w-4 h-4" />} href="/platform/vms" tone={running > 0 ? 'ok' : 'default'} />
          <MacStatWidget label="Hosts online" value={`${onlineHosts} / ${hosts.length}`} icon={<Server className="w-4 h-4" />} href="/platform/hosts" tone={onlineHosts === hosts.length ? 'ok' : 'warn'} />
          <MacStatWidget label="Memory used" value={storagePct != null ? `${Math.round(storagePct)}%` : '—'} icon={<HardDrive className="w-4 h-4" />} href="/platform/reports" />
          <MacStatWidget label="Alerts" value={warnings ? String(warnings) : 'None'} icon={<Bell className="w-4 h-4" />} href="/platform/notifications" tone={warnings ? 'warn' : 'ok'} />
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 px-1">
        {[
          { to: '/mission-control', label: 'Mission Control' },
          { to: '/platform/hosts', label: 'Hosts' },
          { to: '/platform/vms', label: 'VMs' },
          { to: '/platform/storage', label: 'Storage' },
          { to: '/platform/backups', label: 'Time Machine' },
          { to: '/platform/zeus', label: 'Zeus OS' },
          { to: '/platform/settings', label: 'Settings' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="px-3 py-1.5 rounded-xl border border-white/[0.06] bg-slate-900/50 text-xs text-slate-300 hover:bg-slate-800/60 transition"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {error && <ErrorBanner message={error} />}
      {zeusStrip && (
        <MacGlassPanel
          title="Machina Zeus OS"
          subtitle={zeusStrip.tagline}
          action={<Link to="/platform/zeus" className="text-xs text-blue-400">Open hub →</Link>}
        >
          <div className="flex flex-wrap items-center gap-3 -mt-1">
            <span className="inline-flex items-center gap-1.5 text-sm text-orange-200/90">
              <Sparkles className="w-4 h-4 text-orange-400" />
              {zeusStrip.status}
            </span>
            <Link
              to="/platform/zeus/security/firewall"
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
                zeusStrip.firewallCritical > 0
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : zeusStrip.firewallDrift > 0
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              <Shield className="w-3 h-3" />
              {zeusStrip.firewallCritical > 0
                ? `${zeusStrip.firewallCritical} critical firewall host(s)`
                : zeusStrip.firewallDrift > 0
                  ? `${zeusStrip.firewallDrift} host(s) with drift`
                  : 'Firewall posture OK'}
            </Link>
          </div>
        </MacGlassPanel>
      )}

      {mode === 'autopilot' && (
        <MacGlassPanel title="Machina Autopilot" subtitle={`Runs up to ${aiSettings?.autopilot_max_actions ?? 5} low-risk fixes per batch — audited`}>
          <p className="text-sm text-slate-400 -mt-2">Backups, HA enable, and guest tools installs only. Destructive actions always require manual review.</p>
          {aiSettings && aiSettings.autopilot_interval_secs > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Scheduled every {aiSettings.autopilot_interval_secs}s
              {aiSettings.autopilot_last_run
                ? ` · last run ${new Date(aiSettings.autopilot_last_run).toLocaleString()}`
                : ' · no runs yet'}
            </p>
          )}
          <button
            type="button"
            className="btn-primary text-sm mt-3"
            disabled={autopilotBusy}
            onClick={async () => {
              setAutopilotBusy(true)
              try {
                const r = await runAutopilotSafe(undefined, aiSettings?.autopilot_max_actions ?? 5)
                toast.success(`Autopilot ran ${r.executed_count} action(s), skipped ${r.skipped_count}`)
              } catch (e: unknown) {
                toast.error(formatUserError(e))
              } finally {
                setAutopilotBusy(false)
              }
            }}
          >
            {autopilotBusy ? 'Running…' : 'Run safe fixes now'}
          </button>
        </MacGlassPanel>
      )}

      {security && security.findings.length > 0 && (
        <MacGlassPanel title="Security Sentinel" subtitle={`${security.findings.length} finding(s) · risk ${security.risk_level}`}>
          <ul className="text-sm space-y-2">
            {security.findings.slice(0, 4).map((f) => (
              <li key={f.id} className="flex justify-between gap-2">
                <span className={f.severity === 'critical' ? 'text-red-400' : 'text-amber-300'}>{f.title}</span>
                <Link to="/platform/reports" className="text-xs text-blue-400 shrink-0">View</Link>
              </li>
            ))}
          </ul>
        </MacGlassPanel>
      )}

      <PlatformAboutHelp compact />

      <section>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard icon={<Plus className="w-5 h-5" />} title="Create VM" subtitle="Simple wizard — OS, size, network" onClick={() => setWizardOpen(true)} />
          <ActionCard icon={<Boxes className="w-5 h-5" />} title="Applications" subtitle="Launchpad groups — operate stacks" to="/platform/applications" />
          <ActionCard icon={<ArrowRightLeft className="w-5 h-5" />} title="Import VMware VM" subtitle="Migration Assistant" to="/platform/migration" />
          <ActionCard icon={<Server className="w-5 h-5" />} title="Add Host" subtitle="Enroll a hypervisor" to="/platform/enroll" />
          <ActionCard icon={<Upload className="w-5 h-5" />} title="Upload ISO" subtitle="Images & ISO library" to="/platform/content" />
          <ActionCard icon={<Terminal className="w-5 h-5" />} title="Open Console" subtitle="Browse VMs" to="/platform/vms" />
          <ActionCard icon={<Bell className="w-5 h-5" />} title="View Alerts" subtitle={`${warnings} need attention`} to="/platform/notifications" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <MacGlassPanel title="Recent tasks" subtitle="Activity Monitor preview" action={<Link to="/platform/tasks" className="text-xs text-blue-400">View all</Link>}>
          <ul className="space-y-2 text-sm -mt-2">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.id} className="flex justify-between border-b border-white/[0.04] pb-2 last:border-0">
                <span className="text-slate-300">{t.operation}</span>
                <span className={t.status === 'failed' ? 'text-red-400' : 'text-slate-500'}>{t.status} {t.progress}%</span>
              </li>
            ))}
            {tasks.length === 0 && <li className="text-slate-500 text-sm">No tasks yet</li>}
          </ul>
        </MacGlassPanel>
        <MacGlassPanel title="Hosts" subtitle="Hypervisors in this cluster" action={<Link to="/platform/hosts" className="text-xs text-blue-400">Manage</Link>}>
          <ul className="space-y-2 text-sm -mt-2">
            {hosts.slice(0, 6).map((h) => (
              <li key={h.id} className="flex justify-between items-center">
                <Link to={`/platform/hosts/${h.id}`} className="text-blue-400 hover:underline">{h.hostname}</Link>
                <span className={`text-xs capitalize ${h.state === 'online' ? 'text-emerald-400' : 'text-amber-400'}`}>{h.state} · {h.vm_count} VMs</span>
              </li>
            ))}
            {hosts.length === 0 && <li className="text-slate-500 text-sm">No hosts enrolled — <Link to="/platform/enroll" className="text-blue-400">Add Host</Link></li>}
          </ul>
        </MacGlassPanel>
      </div>

      <SimpleCreateVmWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreate={handleCreate} />
      <PlatformWelcome vmCount={vms.length} onCreateVm={() => setWizardOpen(true)} onDone={() => void load()} />
    </div>
  )
}
