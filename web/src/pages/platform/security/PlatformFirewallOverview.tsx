// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Cloud, GitBranch, HardDrive, Network, Server, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  LaunchpadAppIcon,
  MacGlassPanel,
  MacSectionTitle,
  MacStatWidget,
  gradientForName,
} from '../../../components/platform/mac/PlatformMacUi'
import PlatformFilterPills from '../../../components/platform/PlatformFilterPills'
import ErrorBanner from '../../../components/ErrorBanner'
import {
  getFirewallOverview,
  getMultisiteOverview,
  getZeusFirewallStatus,
  type FirewallOverview,
  type FirewallTargetSummary,
  type MultisiteOverview,
} from '../../../api/zeusFirewall'
import { formatUserError } from '../../../utils/apiError'

type KindFilter = 'all' | 'host' | 'bare_metal'

function riskDot(risk: string) {
  if (risk === 'critical') return 'bg-red-400'
  if (risk === 'warning') return 'bg-amber-400'
  return 'bg-emerald-400'
}

export default function PlatformFirewallOverview() {
  const [overview, setOverview] = useState<FirewallOverview | null>(null)
  const [multisite, setMultisite] = useState<MultisiteOverview | null>(null)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [ov, st, ms] = await Promise.all([
        getFirewallOverview(),
        getZeusFirewallStatus(),
        getMultisiteOverview().catch(() => null),
      ])
      setOverview(ov)
      setMultisite(ms)
      const pw = st.packetwolf as { summary?: string }
      setStatusLine(pw?.summary || 'Zeus Firewall active')
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    if (!overview) return []
    if (kindFilter === 'all') return overview.targets
    return overview.targets.filter((t) => t.kind === kindFilter)
  }, [overview, kindFilter])

  const metalCount = overview?.targets.filter((t) => t.kind === 'bare_metal').length ?? 0
  const hostCount = overview?.targets.filter((t) => t.kind === 'host').length ?? 0

  return (
    <div className="space-y-6">
      <MacSectionTitle
        title="Zeus Firewall"
        subtitle="System Settings-style machine protection for hosts and bare metal"
      />
      {error && <ErrorBanner message={error} />}
      {statusLine && (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          {statusLine}
        </p>
      )}
      {overview && (
        <>
          <PlatformFilterPills
            value={kindFilter}
            onChange={(id) => setKindFilter(id as KindFilter)}
            options={[
              { id: 'all', label: 'All', count: overview.targets.length },
              { id: 'host', label: 'Hosts', count: hostCount },
              { id: 'bare_metal', label: 'Bare metal', count: metalCount },
            ]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MacStatWidget label="Machines" value={String(filtered.length)} icon={<Server className="w-5 h-5" />} />
            <MacStatWidget label="Critical" value={String(overview.critical_count)} icon={<AlertTriangle className="w-5 h-5" />} tone="warn" />
            <MacStatWidget
              label="Compliant"
              value={String(overview.targets.filter((t) => t.risk === 'low').length)}
              icon={<CheckCircle2 className="w-5 h-5" />}
              tone="ok"
            />
          </div>
          <MacGlassPanel title="Machines" subtitle={overview.summary}>
            <div className="platform-launchpad-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
              {filtered.map((t: FirewallTargetSummary) => (
                <Link key={t.id} to={`/platform/zeus/security/firewall/${t.id}`} className="relative">
                  <span className={`absolute top-0 right-6 w-2.5 h-2.5 rounded-full ${riskDot(t.risk)} ring-2 ring-slate-950`} />
                  <LaunchpadAppIcon
                    name={t.name}
                    icon={t.kind === 'bare_metal' ? <HardDrive className="w-8 h-8" /> : <Shield className="w-8 h-8" />}
                    gradient={gradientForName(t.name)}
                    vmCount={t.open_ports}
                  />
                  {t.kind === 'bare_metal' && (
                    <p className="text-[10px] text-slate-500 text-center -mt-1">Bare metal</p>
                  )}
                </Link>
              ))}
            </div>
          </MacGlassPanel>
          {multisite && (
            <MacGlassPanel title="Multi-site federation" subtitle={multisite.summary}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 -mt-1">
                {multisite.sites.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/[0.06] bg-slate-950/40 px-3 py-2">
                    <p className="text-sm text-slate-200">{s.name} <span className="text-slate-500">({s.role})</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.gitops_namespace} · {s.target_count} targets · grade {multisite.compliance_rollup.sites.find((c) => c.site === s.name)?.grade ?? '—'}</p>
                  </div>
                ))}
              </div>
              {multisite.policy_conflicts.length > 0 && (
                <ul className="mt-3 text-xs text-amber-300 space-y-1">
                  {multisite.policy_conflicts.map((c) => (
                    <li key={c.id}>{c.policy_name}: {c.detail}</li>
                  ))}
                </ul>
              )}
            </MacGlassPanel>
          )}
          <MacGlassPanel title="Machine Security" subtitle="Open like macOS System Settings panes">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { to: '/platform/zeus?tab=baremetal', label: 'Bare Metal', icon: <HardDrive className="w-5 h-5" /> },
                { to: '/platform/zeus/security/ports', label: 'Open Ports', icon: <Network className="w-5 h-5" /> },
                { to: '/platform/zeus/security/services', label: 'Allowed Apps', icon: <Server className="w-5 h-5" /> },
                { to: '/platform/zeus/security/activity', label: 'Activity', icon: <Shield className="w-5 h-5" /> },
                { to: '/platform/zeus/security/compliance', label: 'Compliance', icon: <CheckCircle2 className="w-5 h-5" /> },
                { to: '/platform/zeus/security/k8s', label: 'Kubernetes', icon: <GitBranch className="w-5 h-5" /> },
                { to: '/platform/zeus/security/cloud', label: 'Cloud SGs', icon: <Cloud className="w-5 h-5" /> },
                { to: '/platform/zeus/security/connectivity', label: 'Connectivity', icon: <Network className="w-5 h-5" /> },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/[0.06] bg-slate-950/40 hover:border-blue-500/30 transition text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-blue-300">
                    {item.icon}
                  </div>
                  <span className="text-xs text-slate-300">{item.label}</span>
                </Link>
              ))}
            </div>
          </MacGlassPanel>
        </>
      )}
    </div>
  )
}
