// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { Rocket } from 'lucide-react'
import { MacGlassPanel } from '../platform/mac/PlatformMacUi'
import { planMissionStack, type MissionStackPlan } from '../../api/ai'

export default function MachinaMissionStack() {
  const [query, setQuery] = useState('Build a GPU cluster for Llama serving')
  const [plan, setPlan] = useState<MissionStackPlan | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      setPlan(await planMissionStack(query))
    } finally {
      setBusy(false)
    }
  }

  return (
    <MacGlassPanel title="AI Mission Control" subtitle="NL stack builder — GPU, Kubernetes, inference (preview)">
      <div className="flex gap-2">
        <input className="input flex-1 text-sm" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="btn-primary text-xs flex items-center gap-1" disabled={busy} onClick={() => void run()}>
          <Rocket className="w-3 h-3" /> Plan
        </button>
      </div>
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
