// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Shield, Server, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { MacGlassPanel, MacSectionTitle, MacStatWidget } from '../../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../../components/ErrorBanner'
import {
  getFirewallOverview,
  getZeusFirewallStatus,
  type FirewallOverview,
  type FirewallTargetSummary,
} from '../../../api/zeusFirewall'
import { formatUserError } from '../../../utils/apiError'

function TargetCard({ t }: { t: FirewallTargetSummary }) {
  return (
    <Link
      to={`/platform/zeus/security/firewall/${t.id}`}
      className="block rounded-xl border border-white/[0.06] bg-slate-950/40 p-4 hover:border-blue-500/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{t.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t.backend} · {t.enabled ? 'On' : 'Off'}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${t.risk === 'critical' ? 'bg-red-500/20 text-red-300' : t.risk === 'warning' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/15 text-emerald-300'}`}>
          {t.risk}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
        <span>Score {t.score}</span>
        <span>{t.open_ports} ports</span>
        <span>{t.profile || '—'}</span>
      </div>
    </Link>
  )
}

export default function PlatformFirewallOverview() {
  const [overview, setOverview] = useState<FirewallOverview | null>(null)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [ov, st] = await Promise.all([getFirewallOverview(), getZeusFirewallStatus()])
      setOverview(ov)
      const pw = st.packetwolf as { summary?: string }
      setStatusLine(pw?.summary || 'Zeus Firewall active')
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <MacSectionTitle
        title="Zeus Firewall"
        subtitle="Machine protection — macOS-like firewall control for every host and VM"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MacStatWidget label="Machines" value={String(overview.targets.length)} icon={<Server className="w-5 h-5" />} />
            <MacStatWidget label="Critical" value={String(overview.critical_count)} icon={<AlertTriangle className="w-5 h-5" />} tone="warn" />
            <MacStatWidget label="Compliant" value={String(overview.targets.filter((t) => t.risk === 'low').length)} icon={<CheckCircle2 className="w-5 h-5" />} tone="ok" />
          </div>
          <MacGlassPanel title="Fleet posture" subtitle={overview.summary}>
            <div className="grid gap-3 md:grid-cols-2">
              {overview.targets.map((t) => (
                <TargetCard key={t.id} t={t} />
              ))}
            </div>
          </MacGlassPanel>
          <MacGlassPanel title="Quick links" subtitle="Machine Security views">
            <div className="flex flex-wrap gap-2 text-sm">
              <Link className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200" to="/platform/zeus/security/ports">Open Ports</Link>
              <Link className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200" to="/platform/zeus/security/services">Allowed Apps</Link>
              <Link className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200" to="/platform/zeus/security/activity">Blocked Activity</Link>
              <Link className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200" to="/platform/zeus/security/compliance">Compliance</Link>
            </div>
          </MacGlassPanel>
          <MacGlassPanel title="Profiles" subtitle="Read-only preview — apply from target detail (Phase 2)">
            <div className="flex flex-wrap gap-2">
              {overview.profiles.map((p) => (
                <span key={p} className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300">{p}</span>
              ))}
            </div>
          </MacGlassPanel>
        </>
      )}
    </div>
  )
}
