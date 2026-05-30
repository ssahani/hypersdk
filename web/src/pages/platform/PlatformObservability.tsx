// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Activity, Gauge, Timer } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner'
import { MacGlassPanel, MacSectionTitle, MacStatWidget } from '../../components/platform/mac/PlatformMacUi'
import {
  getObservabilityOverview,
  listApiTraces,
  type ApiTraceSpan,
  type ObservabilityOverview,
  type SloStatusItem,
} from '../../api/platform'
import { formatUserError } from '../../utils/apiError'

function sloBadge(status: string) {
  if (status === 'ok') return 'bg-emerald-900/60 text-emerald-300'
  if (status === 'warn') return 'bg-amber-900/60 text-amber-300'
  return 'bg-rose-900/60 text-rose-300'
}

function SloRow({ slo }: { slo: SloStatusItem }) {
  const pct = Math.min(100, Math.max(0, slo.current_pct))
  return (
    <li className="rounded-xl border border-white/[0.06] bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <p className="font-medium text-slate-200">{slo.name}</p>
          <p className="text-xs text-slate-500">{slo.target}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${sloBadge(slo.status)}`}>{slo.status}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
        <span>{pct.toFixed(2)}%</span>
        <span className="text-slate-600">/</span>
        <span>{slo.objective_pct}% objective</span>
        <span className="text-slate-600">·</span>
        <span>burn {slo.burn_rate.toFixed(3)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${slo.status === 'breach' ? 'bg-rose-500' : slo.status === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-2">{slo.description}</p>
    </li>
  )
}

export default function PlatformObservability() {
  const [overview, setOverview] = useState<ObservabilityOverview | null>(null)
  const [traces, setTraces] = useState<ApiTraceSpan[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [o, t] = await Promise.all([getObservabilityOverview(), listApiTraces(50)])
      setOverview(o)
      setTraces(t)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6 animate-fade-in">
      <MacSectionTitle title="Observability" subtitle="SLO dashboards and API trace inventory." />
      {error && <ErrorBanner message={error} />}
      {overview && (
        <>
          <p className="text-sm text-slate-400">{overview.summary}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <MacStatWidget label="SLO policies" value={String(overview.slos.length)} icon={<Gauge className="w-4 h-4" />} />
            <MacStatWidget label="Traces (1h)" value={String(overview.trace_count_1h)} icon={<Activity className="w-4 h-4" />} />
            <MacStatWidget label="p95 latency" value={`${overview.p95_latency_ms} ms`} icon={<Timer className="w-4 h-4" />} />
          </div>
          <MacGlassPanel title="SLO dashboard" action={
            <button type="button" className="text-xs text-blue-400" onClick={() => void load()}>Refresh</button>
          }>
            <ul className="space-y-3">
              {overview.slos.map((slo) => (
                <SloRow key={slo.name} slo={slo} />
              ))}
            </ul>
          </MacGlassPanel>
          <MacGlassPanel title="Recent API traces">
            {traces.length === 0 ? (
              <p className="text-sm text-slate-400">No traces recorded yet — browse the platform to populate spans.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 border-b border-slate-700">
                    <tr>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Method</th>
                      <th className="py-2 pr-4">Path</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traces.map((t) => (
                      <tr key={t.id} className="border-b border-slate-800/60">
                        <td className="py-2 pr-4 text-slate-500 text-xs whitespace-nowrap">{t.recorded_at}</td>
                        <td className="py-2 pr-4 text-slate-300 font-mono text-xs">{t.method}</td>
                        <td className="py-2 pr-4 text-slate-400 font-mono text-xs max-w-md truncate">{t.path}</td>
                        <td className={`py-2 pr-4 text-xs ${t.status_code >= 500 ? 'text-rose-400' : t.status_code >= 400 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {t.status_code}
                        </td>
                        <td className="py-2 text-slate-400 text-xs">{t.duration_ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </MacGlassPanel>
        </>
      )}
    </div>
  )
}
