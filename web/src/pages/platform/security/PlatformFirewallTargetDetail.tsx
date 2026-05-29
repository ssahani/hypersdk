// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Lock, Shield } from 'lucide-react'
import { MacGlassPanel, MacSectionTitle } from '../../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../../components/ErrorBanner'
import {
  applyFirewallProfile,
  detectFirewallDrift,
  explainFirewall,
  getFirewallTarget,
  getFirewallTimeline,
  listFirewallCheckpoints,
  listFirewallProfiles,
  lockdownMachine,
  planFirewall,
  rollbackFirewall,
  secureMachinePlan,
  type FirewallTargetDetail,
} from '../../../api/zeusFirewall'
import { useToastContext } from '../../../contexts/ToastContext'
import { formatUserError } from '../../../utils/apiError'

export default function PlatformFirewallTargetDetail() {
  const { id } = useParams<{ id: string }>()
  const toast = useToastContext()
  const [detail, setDetail] = useState<FirewallTargetDetail | null>(null)
  const [aiExplain, setAiExplain] = useState<string | null>(null)
  const [securePlan, setSecurePlan] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Array<{ name: string; display_name: string }>>([])
  const [selectedProfile, setSelectedProfile] = useState('WebServer')
  const [drift, setDrift] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<Array<Record<string, unknown>>>([])
  const [checkpoints, setCheckpoints] = useState<Array<{ id: string; label: string; created_at: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      const [d, profs, tl, cps, dr] = await Promise.all([
        getFirewallTarget(id),
        listFirewallProfiles(),
        getFirewallTimeline(id).catch(() => []),
        listFirewallCheckpoints(id).catch(() => []),
        detectFirewallDrift(id).catch(() => null),
      ])
      setDetail(d)
      setProfiles(profs)
      setTimeline(tl)
      setCheckpoints(cps)
      if (dr) {
        setDrift(dr.drift_detected ? `${dr.summary} — expected: ${dr.expected}` : dr.summary)
      }
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  if (!id) return null

  const inv = detail?.inventory

  return (
    <div className="space-y-6">
      <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Firewall
      </Link>
      {error && <ErrorBanner message={error} />}
      {detail && inv && (
        <>
          <MacSectionTitle
            title={detail.target.name}
            subtitle={`Firewall ${inv.posture.enabled ? 'On' : 'Off'} · ${detail.target.backend} · Score ${inv.score.score}/100`}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Profile', detail.target.profile || '—'],
              ['Risk', detail.target.risk],
              ['Open ports', String(detail.target.open_ports)],
              ['Blocked today', String(detail.target.blocked_today)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-3">
                <p className="text-xs text-slate-500">{k}</p>
                <p className="text-sm text-slate-100 mt-1">{v}</p>
              </div>
            ))}
          </div>
          <MacGlassPanel title="Controls" subtitle="Large simple toggles">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="px-4 py-2 rounded-xl bg-emerald-600/80 text-white text-sm" disabled>
                Firewall {inv.posture.enabled ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-slate-700 text-slate-100 text-sm"
                onClick={async () => {
                  try {
                    await planFirewall(id, { preset: 'allow_ssh', dry_run: true })
                    toast.success('SSH restrict plan ready (dry-run)')
                  } catch (e: unknown) {
                    toast.error(formatUserError(e))
                  }
                }}
              >
                Allow SSH (admin)
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-slate-700 text-slate-100 text-sm"
                onClick={async () => {
                  try {
                    const r = await secureMachinePlan(id)
                    setSecurePlan(r.steps.map((s) => `${s.step}. ${s.action}`).join('\n'))
                  } catch (e: unknown) {
                    toast.error(formatUserError(e))
                  }
                }}
              >
                Secure This Machine
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-red-700/80 text-white text-sm flex items-center gap-1"
                onClick={async () => {
                  if (!confirm('Enable Emergency Isolation lockdown?')) return
                  try {
                    await lockdownMachine(id, true)
                    toast.success('Lockdown initiated')
                    void load()
                  } catch (e: unknown) {
                    toast.error(formatUserError(e))
                  }
                }}
              >
                <Lock className="w-4 h-4" /> Lock Down
              </button>
            </div>
          </MacGlassPanel>
          <MacGlassPanel title="Firewall profile" subtitle="Apply safe preset with diff preview">
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className="input text-sm"
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>{p.display_name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={async () => {
                  try {
                    const r = await applyFirewallProfile(id, selectedProfile, true)
                    toast.success(`Dry-run: ${r.operations.length} operations`)
                  } catch (e: unknown) {
                    toast.error(formatUserError(e))
                  }
                }}
              >
                Preview diff
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                onClick={async () => {
                  if (!confirm(`Apply profile ${selectedProfile}?`)) return
                  try {
                    await applyFirewallProfile(id, selectedProfile, false)
                    toast.success('Profile applied')
                    void load()
                  } catch (e: unknown) {
                    toast.error(formatUserError(e))
                  }
                }}
              >
                Apply profile
              </button>
            </div>
          </MacGlassPanel>
          {drift && (
            <MacGlassPanel title="Drift detection" subtitle="Changes outside Zeus OS">
              <p className="text-sm text-slate-300">{drift}</p>
            </MacGlassPanel>
          )}
          {securePlan && (
            <MacGlassPanel title="AI Secure Plan" subtitle="Review before apply">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap">{securePlan}</pre>
            </MacGlassPanel>
          )}
          <MacGlassPanel
            title="AI Firewall"
            subtitle="Why is this machine exposed?"
            action={
              <button
                type="button"
                className="text-xs text-blue-400"
                onClick={async () => {
                  try {
                    const r = await explainFirewall(id, 'Why is this machine exposed?')
                    setAiExplain(`${r.summary}\n\n${r.evidence.join('\n')}\n\nRecommended: ${r.recommendation}`)
                  } catch (e: unknown) {
                    toast.error(formatUserError(e))
                  }
                }}
              >
                Explain
              </button>
            }
          >
            {aiExplain ? (
              <pre className="text-xs text-slate-300 whitespace-pre-wrap">{aiExplain}</pre>
            ) : (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Ask Zeus AI about firewall posture and risky ports.
              </p>
            )}
          </MacGlassPanel>
          <MacGlassPanel title="Score breakdown">
            <ul className="space-y-2 text-sm">
              {inv.score.breakdown.map((b) => (
                <li key={b.category} className="flex justify-between text-slate-300">
                  <span>{b.detail}</span>
                  <span className={b.points < 0 ? 'text-amber-300' : 'text-slate-500'}>{b.points}</span>
                </li>
              ))}
            </ul>
          </MacGlassPanel>
          {checkpoints.length > 0 && (
            <MacGlassPanel title="Rollback checkpoints">
              <ul className="space-y-2 text-sm">
                {checkpoints.map((c) => (
                  <li key={c.id} className="flex justify-between items-center">
                    <span className="text-slate-300">{c.label} · {new Date(c.created_at).toLocaleString()}</span>
                    <button
                      type="button"
                      className="text-xs text-blue-400"
                      onClick={async () => {
                        try {
                          await rollbackFirewall(id, c.id)
                          toast.success('Rollback recorded')
                          void load()
                        } catch (e: unknown) {
                          toast.error(formatUserError(e))
                        }
                      }}
                    >
                      Rollback
                    </button>
                  </li>
                ))}
              </ul>
            </MacGlassPanel>
          )}
          {timeline.length > 0 && (
            <MacGlassPanel title="Firewall timeline">
              <ul className="space-y-2 text-xs text-slate-400">
                {timeline.map((e, i) => (
                  <li key={i}>
                    {String(e.created_at || '')} — {String(e.summary || e.kind || '')}
                  </li>
                ))}
              </ul>
            </MacGlassPanel>
          )}
        </>
      )}
    </div>
  )
}
