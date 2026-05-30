// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { getComplianceRemediate, getSreRemediate } from '../../api/ai'
import { MacGlassPanel } from './mac/PlatformMacUi'

type Remediation = { label: string; review: string; action?: string; framework?: string }

export default function RemediateChips({ compact = false }: { compact?: boolean }) {
  const [sre, setSre] = useState<Remediation[]>([])
  const [compliance, setCompliance] = useState<Remediation[]>([])
  const [summary, setSummary] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([getSreRemediate(), getComplianceRemediate()])
      setSre(s.remediations ?? [])
      setCompliance(c.remediations ?? [])
      setSummary([s.summary, c.summary].filter(Boolean).join(' · ') || null)
    } catch {
      setSre([])
      setCompliance([])
      setSummary(null)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const items = [...sre, ...compliance]
  if (items.length === 0 && !summary) return null

  const inner = (
    <div className="space-y-2">
      {summary && <p className="text-xs text-slate-400">{summary}</p>}
      <div className="flex flex-wrap gap-2">
        {items.slice(0, compact ? 4 : 12).map((r, i) => (
          <span
            key={`${r.label}-${i}`}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200"
            title={r.review}
          >
            <Sparkles className="w-3 h-3 shrink-0" />
            {r.label}
            {r.framework && <span className="text-violet-400/70">({r.framework})</span>}
          </span>
        ))}
      </div>
    </div>
  )

  if (compact) return inner

  return (
    <MacGlassPanel title="AI remediations" subtitle="SRE + compliance suggestions from controller">
      {inner}
    </MacGlassPanel>
  )
}
