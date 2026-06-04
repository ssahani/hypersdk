// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  getVmGuestAiInsights,
  guestSyncTime,
  guestFstrim,
  installGuestTools,
  type GuestAiInsightsReport,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'
import { MacGlassPanel } from './mac/PlatformMacUi'
import { statusPillClasses, statusToneClass } from '../../utils/semanticColors'

type Props = {
  vmId: string
  focus?: string
  onApplied?: () => void
}

function severityTone(s: string): 'ok' | 'warn' | 'error' | 'info' | 'neutral' {
  if (s === 'error') return 'error'
  if (s === 'warn') return 'warn'
  if (s === 'ok' || s === 'info') return 'info'
  return 'neutral'
}

export default function GuestAiInsightsPanel({ vmId, focus, onApplied }: Props) {
  const toast = useToastContext()
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<GuestAiInsightsReport | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  const load = async (refresh = false) => {
    setLoading(true)
    try {
      setReport(await getVmGuestAiInsights(vmId, { refresh, focus }))
    } catch (e: unknown) {
      toast.error(formatUserError(e))
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  const applyAction = async (action: string) => {
    setApplying(action)
    try {
      switch (action) {
        case 'guest.sync_time':
          await guestSyncTime(vmId)
          toast.success('Guest time sync completed')
          break
        case 'guest.fstrim':
          await guestFstrim(vmId)
          toast.success('Filesystem TRIM completed')
          break
        case 'guest.install_tools':
          await installGuestTools(vmId)
          toast.success('Guest tools install queued')
          break
        default:
          toast.error(`Action ${action} requires approval in Zeus hub`)
          return
      }
      onApplied?.()
      await load(true)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setApplying(null)
    }
  }

  return (
    <MacGlassPanel
      title="AI guest intelligence"
      subtitle="QGA telemetry interpreted by Zeus"
      action={
        <button type="button" className="btn-secondary text-xs" disabled={loading} onClick={() => void load(true)}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <Sparkles className="w-3 h-3 inline" />}
          {report ? 'Refresh' : 'Ask AI'}
        </button>
      }
    >
      {!report && !loading && (
        <p className="text-sm text-slate-500">
          Generate a natural-language summary with security and operations recommendations from live guest-agent data.
        </p>
      )}
      {loading && !report && (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Analyzing guest telemetry…
        </p>
      )}
      {report && (
        <div className="space-y-3 text-sm">
          <p className="text-slate-200">{report.summary}</p>
          {report.llm_powered && (
            <span className={statusPillClasses('info')}>LLM-powered</span>
          )}
          {report.insights.length > 0 && (
            <ul className="space-y-2">
              {report.insights.map((i) => (
                <li key={i.title} className="rounded-lg border border-white/[0.06] bg-slate-900/40 px-3 py-2">
                  <p className={`font-medium ${statusToneClass(severityTone(i.severity))}`}>{i.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{i.detail}</p>
                </li>
              ))}
            </ul>
          )}
          {report.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommendations</p>
              {report.recommendations.map((r) => (
                <div key={r.label} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2">
                  <div>
                    <p className="text-slate-200">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.rationale}</p>
                  </div>
                  {['guest.sync_time', 'guest.fstrim', 'guest.install_tools'].includes(r.action) && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={!!applying}
                      onClick={() => void applyAction(r.action)}
                    >
                      {applying === r.action ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Apply
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </MacGlassPanel>
  )
}
