// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Radar, Shield, ShieldAlert } from 'lucide-react'
import PlatformPageChrome, { PlatformRefreshButton } from '../../components/platform/PlatformPageChrome'
import { MacGlassPanel, MacListRow, MacStatWidget } from '../../components/platform/mac/PlatformMacUi'
import {
  getAsmSummary,
  getSocAlerts,
  getSocEvents,
  getSocOverview,
  getSocRules,
  getSplunkIntegration,
  patchSocAlert,
  patchSocRule,
  putSplunkIntegration,
  replaySocForward,
  testSocRule,
  testSplunkIntegration,
  type AsmSummary,
  type SocAlert,
  type SocEvent,
  type SocOverview,
  type SocRule,
} from '../../api/soc'
import { getFleetThreatSummary } from '../../api/zeusSecurity'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'
import { hubLinkClasses, statusBadgeClasses, statusToneClass } from '../../utils/semanticColors'

type Tab = 'overview' | 'alerts' | 'detections' | 'asm' | 'integrations'

export default function PlatformSoc() {
  const toast = useToastContext()
  const [tab, setTab] = useState<Tab>('overview')
  const [overview, setOverview] = useState<SocOverview | null>(null)
  const [threatScore, setThreatScore] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<SocAlert[]>([])
  const [events, setEvents] = useState<SocEvent[]>([])
  const [rules, setRules] = useState<SocRule[]>([])
  const [asm, setAsm] = useState<AsmSummary | null>(null)
  const [splunkUrl, setSplunkUrl] = useState('')
  const [splunkToken, setSplunkToken] = useState('')
  const [splunkIndex, setSplunkIndex] = useState('machina')
  const [splunkEnabled, setSplunkEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, al, ev, ru, asmRes, threat, splunk] = await Promise.all([
        getSocOverview(),
        getSocAlerts({ limit: 50 }),
        getSocEvents(30),
        getSocRules(),
        getAsmSummary().catch(() => null),
        getFleetThreatSummary().catch(() => null),
        getSplunkIntegration().catch(() => null),
      ])
      setOverview(ov)
      setAlerts(al)
      setEvents(ev)
      setRules(ru)
      setAsm(asmRes)
      setThreatScore(threat?.fleet_threat_score ?? null)
      if (splunk?.config) {
        setSplunkUrl(String(splunk.config.url ?? ''))
        setSplunkIndex(String(splunk.config.index ?? 'machina'))
        setSplunkEnabled(splunk.enabled)
      }
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const ackAlert = async (id: string) => {
    try {
      await patchSocAlert(id, { status: 'acknowledged' })
      toast.success('Alert acknowledged')
      void load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const closeAlert = async (id: string) => {
    try {
      await patchSocAlert(id, { status: 'closed' })
      toast.success('Alert closed')
      void load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const toggleRule = async (r: SocRule) => {
    try {
      await patchSocRule(r.id, { enabled: !r.enabled })
      void load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const runRuleTest = async (id: string) => {
    try {
      const r = await testSocRule(id)
      toast.success(`Test: ${r.match_count} matches${r.would_fire ? ' (would fire)' : ''}`)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const saveSplunk = async () => {
    try {
      await putSplunkIntegration({
        url: splunkUrl,
        token: splunkToken,
        index: splunkIndex,
        enabled: splunkEnabled,
      })
      toast.success('Splunk HEC saved')
      setSplunkToken('')
      void load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'detections', label: 'Detections' },
    { id: 'asm', label: 'Attack surface' },
    { id: 'integrations', label: 'Integrations' },
  ]

  return (
    <PlatformPageChrome
      title="Security Operations Center"
      subtitle="Unified detection, hunting, ASM, and SIEM export"
      icon={<Shield className="w-5 h-5" />}
      loading={loading}
      error={error}
      actions={<PlatformRefreshButton onClick={() => void load()} />}
    >
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <Link to="/platform/zeus/security/hunt" className={`btn-secondary text-sm ml-auto ${hubLinkClasses()}`}>
          Threat hunting →
        </Link>
        <Link to="/platform/zeus/security" className={`btn-secondary text-sm ${hubLinkClasses()}`}>
          Security Center →
        </Link>
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MacStatWidget label="Open alerts" value={String(overview?.open_alerts ?? '—')} icon={<ShieldAlert className="w-4 h-4" />} />
            <MacStatWidget label="Critical / high" value={String(overview?.critical_alerts ?? '—')} icon={<ShieldAlert className="w-4 h-4" />} />
            <MacStatWidget label="Events (24h)" value={String(overview?.events_24h ?? '—')} icon={<Radar className="w-4 h-4" />} />
            <MacStatWidget label="Fleet threat" value={threatScore != null ? `${threatScore.toFixed(0)}` : '—'} icon={<Shield className="w-4 h-4" />} />
          </div>
          <MacGlassPanel title="Recent events">
            {events.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">No SOC events yet — ingestion runs every 2 minutes.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {events.slice(0, 12).map((e) => (
                  <li key={e.id} className="px-3 py-2 text-sm flex justify-between gap-2">
                    <span className="text-slate-200 truncate">{e.summary}</span>
                    <span className={`text-xs shrink-0 ${statusToneClass(e.severity === 'high' ? 'error' : 'neutral')}`}>
                      {e.source} · {e.severity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </MacGlassPanel>
        </div>
      )}

      {tab === 'alerts' && (
        <MacGlassPanel title="Alert queue">
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500 p-3">No open alerts.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {alerts.map((a) => (
                <li key={a.id} className="px-3 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm text-slate-100">{a.title}</p>
                    <p className="text-xs text-slate-500">
                      {a.severity} · {a.status} · {a.event_count} events
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {a.status === 'open' && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => void ackAlert(a.id)}>
                        Ack
                      </button>
                    )}
                    {a.status !== 'closed' && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => void closeAlert(a.id)}>
                        Close
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </MacGlassPanel>
      )}

      {tab === 'detections' && (
        <MacGlassPanel title="Detection rules">
          <ul className="divide-y divide-white/5">
            {rules.map((r) => (
              <li key={r.id} className="px-3 py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {r.name}
                    {r.builtin && <span className={statusBadgeClasses('neutral')}>built-in</span>}
                  </p>
                  <p className="text-xs text-slate-500">{r.description}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => void runRuleTest(r.id)}>
                    Test
                  </button>
                  {!r.builtin && (
                    <button type="button" className="btn-secondary text-xs" onClick={() => void toggleRule(r)}>
                      {r.enabled ? 'Disable' : 'Enable'}
                    </button>
                  )}
                  {r.builtin && (
                    <button type="button" className="btn-secondary text-xs" onClick={() => void toggleRule(r)}>
                      {r.enabled ? 'On' : 'Off'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </MacGlassPanel>
      )}

      {tab === 'asm' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MacStatWidget label="Exposure score" value={asm ? asm.exposure_score.toFixed(0) : '—'} icon={<Radar className="w-4 h-4" />} />
            <MacStatWidget label="Firewall targets" value={String(asm?.firewall_targets ?? '—')} icon={<Shield className="w-4 h-4" />} />
            <MacStatWidget label="High-risk nodes" value={String(asm?.high_risk_nodes ?? '—')} icon={<ShieldAlert className="w-4 h-4" />} />
          </div>
          <MacGlassPanel title="Findings">
            {(asm?.open_port_findings ?? []).length === 0 ? (
              <p className="text-sm text-slate-500 p-3">No high-risk exposure findings.</p>
            ) : (
              <ul>
                {asm!.open_port_findings.map((f, i) => (
                  <MacListRow
                    key={`${f.resource}-${i}`}
                    title={f.resource}
                    subtitle={`${f.kind} · ${f.detail}`}
                  />
                ))}
              </ul>
            )}
          </MacGlassPanel>
          {asm?.recommendations?.length ? (
            <MacGlassPanel title="Recommendations">
              <ul className="p-3 text-sm text-slate-300 space-y-1 list-disc list-inside">
                {asm.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </MacGlassPanel>
          ) : null}
        </div>
      )}

      {tab === 'integrations' && (
        <div className="space-y-4">
          <MacGlassPanel title="Splunk HTTP Event Collector (HEC)">
            <div className="p-3 space-y-3 max-w-xl">
              <label className="block text-sm">
                <span className="text-slate-400 text-xs">HEC URL</span>
                <input
                  className="input w-full mt-1 text-sm"
                  value={splunkUrl}
                  onChange={(e) => setSplunkUrl(e.target.value)}
                  placeholder="https://splunk:8088"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400 text-xs">HEC token (leave blank to keep)</span>
                <input
                  className="input w-full mt-1 text-sm"
                  type="password"
                  value={splunkToken}
                  onChange={(e) => setSplunkToken(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400 text-xs">Index</span>
                <input
                  className="input w-full mt-1 text-sm"
                  value={splunkIndex}
                  onChange={(e) => setSplunkIndex(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={splunkEnabled}
                  onChange={(e) => setSplunkEnabled(e.target.checked)}
                />
                Enable Splunk forwarder
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => void saveSplunk()}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => void testSplunkIntegration().then((r) => toast.success(r.message)).catch((e: unknown) => toast.error(formatUserError(e)))}
                >
                  Test connection
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => void replaySocForward(24).then((r) => toast.success(`Replay forwarded ${r.forwarded}`)).catch((e: unknown) => toast.error(formatUserError(e)))}
                >
                  Replay 24h
                </button>
              </div>
            </div>
          </MacGlassPanel>
          <p className="text-xs text-slate-500">
            Elastic, Microsoft Sentinel, and QRadar adapters are configured under the same Integrations API (
            <code className="text-slate-400">/api/v1/soc/integrations/&#123;type&#125;</code>).
          </p>
        </div>
      )}
    </PlatformPageChrome>
  )
}
