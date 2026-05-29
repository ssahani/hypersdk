// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { Play, Rocket } from 'lucide-react'
import { MacGlassPanel } from '../platform/mac/PlatformMacUi'
import { executeMissionStack, planMissionStack, type MissionStackPlan } from '../../api/ai'

export default function MachinaMissionStack() {
  const [query, setQuery] = useState('Build a GPU cluster for Llama serving')
  const [plan, setPlan] = useState<MissionStackPlan | null>(null)
  const [executeSummary, setExecuteSummary] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setExecuteSummary(null)
    try {
      setPlan(await planMissionStack(query))
    } finally {
      setBusy(false)
    }
  }

  const previewExecute = async () => {
    setBusy(true)
    try {
      const r = await executeMissionStack(query, true)
      setPlan(r.plan)
      setExecuteSummary(r.summary)
    } finally {
      setBusy(false)
    }
  }

  return (
    <MacGlassPanel title="AI Mission Control" subtitle="NL stack builder — GPU, Kubernetes, inference">
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1 text-sm min-w-[12rem]" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="btn-primary text-xs flex items-center gap-1" disabled={busy} onClick={() => void run()}>
          <Rocket className="w-3 h-3" /> Plan
        </button>
        <button type="button" className="btn-secondary text-xs flex items-center gap-1" disabled={busy} onClick={() => void previewExecute()}>
          <Play className="w-3 h-3" /> Preview infra
        </button>
      </div>
      {executeSummary && <p className="text-xs text-emerald-300/90 mt-2">{executeSummary}</p>}
      {plan && (
        <div className="mt-3 text-xs space-y-2 text-slate-400">
          <p className="text-slate-200 font-medium">{plan.label}</p>
          <p>{plan.review}</p>
          {plan.phases.map((ph) => (
            <div key={ph.name}>
              <p className="text-orange-300/90 font-medium">{ph.name} {ph.automated ? '(automated)' : '(review)'}</p>
              <ul className="ml-3">{ph.steps.map((s) => <li key={s}>• {s}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </MacGlassPanel>
  )
}
