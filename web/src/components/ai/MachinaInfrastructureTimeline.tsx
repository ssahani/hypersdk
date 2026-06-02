// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Clock, Sparkles } from 'lucide-react'
import { analyzeIncident, getTimelineReplay, type IncidentAnalysis } from '../../api/ai'
import { hubLinkClasses, statusToneClass } from '../../utils/semanticColors'

export default function MachinaInfrastructureTimeline({ hours = 4 }: { hours?: number }) {
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null)
  const [replayHours, setReplayHours] = useState(hours)
  const [graphChanges, setGraphChanges] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [incident, replay] = await Promise.all([
        analyzeIncident({ hours: replayHours }),
        getTimelineReplay(
          new Date(Date.now() - replayHours * 3600_000).toISOString(),
          new Date().toISOString(),
        ),
      ])
      setAnalysis(incident)
      setGraphChanges(replay.graph_changes ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Timeline unavailable')
    }
  }, [replayHours])

  useEffect(() => { void load() }, [load])

  if (error) return <p className={`text-xs ${statusToneClass('error')}`}>{error}</p>
  if (!analysis) return <p className="text-slate-500 text-xs">Loading infrastructure timeline…</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <label className="flex items-center gap-2">
          Replay window
          <input
            type="range"
            min={1}
            max={24}
            value={replayHours}
            onChange={(e) => setReplayHours(Number(e.target.value))}
            className="w-24"
          />
          <span>{replayHours}h</span>
        </label>
      </div>
      <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-sm">
        <p className="font-medium text-orange-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> AI Root Cause ({Math.round(analysis.confidence * 100)}% confidence)
        </p>
        <p className="text-slate-300 mt-1">{analysis.root_cause}</p>
        {(analysis.evidence ?? []).slice(0, 3).map((ev) => (
          <p key={ev} className="text-xs text-slate-500 mt-1">Evidence: {ev}</p>
        ))}
        {(analysis.suggested_actions ?? []).slice(0, 2).map((a) => (
          <p key={a} className={`text-xs mt-1 ${hubLinkClasses()}`}>→ {a}</p>
        ))}
      </div>
      {graphChanges.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-xs">
          <p className="text-slate-500 mb-1">Graph changes in window</p>
          {graphChanges.slice(0, 4).map((c) => (
            <p key={c} className="text-slate-400 font-mono">{c}</p>
          ))}
        </div>
      )}
      <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono">
        {analysis.timeline.slice(0, 12).map((e, i) => (
          <div key={`${e.at}-${i}`} className="flex gap-2 text-slate-400">
            <Clock className="w-3 h-3 shrink-0 mt-0.5 opacity-60" />
            <span className="text-slate-500 shrink-0">{new Date(e.at).toLocaleTimeString()}</span>
            <span className="text-slate-600">[{e.source}]</span>
            <span className="text-slate-300">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
