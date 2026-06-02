// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import PlatformPageChrome, { PlatformRefreshButton } from '../../components/platform/PlatformPageChrome'
import { MacGlassPanel } from '../../components/platform/mac/PlatformMacUi'
import { createZeusAction, getRightsizingReport, type RightsizingRecommendation } from '../../api/ai'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function PlatformRightsizing() {
  const toast = useToastContext()
  const [recs, setRecs] = useState<RightsizingRecommendation[]>([])
  const [savings, setSavings] = useState(0)
  const [idle, setIdle] = useState(0)
  const [oversized, setOversized] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getRightsizingReport()
      setRecs(r.recommendations)
      setSavings(r.estimated_monthly_savings_usd)
      setIdle(r.idle_vm_count)
      setOversized(r.oversized_vm_count)
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const queueAction = async (r: RightsizingRecommendation) => {
    try {
      await createZeusAction({
        action_type: r.action,
        label: `${r.action} ${r.vm_name}`,
        review: r.detail,
        risk: r.risk,
        object_ref: { vm_id: r.vm_id, vm_name: r.vm_name },
        source: 'rightsizing',
      })
      toast.success(`Queued ${r.action} for ${r.vm_name}`)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  return (
    <PlatformPageChrome
      title="VM Rightsizing"
      subtitle="FinOps recommendations from fleet metrics"
      icon={<DollarSign className="w-6 h-6" />}
      loading={loading}
      error={error}
      actions={<PlatformRefreshButton onClick={() => void load()} />}
    >
      <MacGlassPanel title="Summary">
        <p className="text-sm text-slate-400">
          {oversized} oversized · {idle} idle · est. ${savings.toFixed(0)}/mo savings
        </p>
      </MacGlassPanel>
      <MacGlassPanel title="Recommendations" className="mt-4">
        <ul className="text-sm space-y-3 max-h-[32rem] overflow-y-auto">
          {recs.map((r) => (
            <li key={`${r.vm_id}-${r.action}`} className="border-b border-white/5 pb-2">
              <p className="font-medium text-slate-200">{r.vm_name}</p>
              <p className="text-xs text-slate-500">{r.detail}</p>
              <p className="text-xs text-slate-400 mt-1">{r.action} · risk {r.risk}{r.savings_usd > 0 ? ` · $${r.savings_usd.toFixed(0)}/mo` : ''}</p>
              <button type="button" className="text-xs text-orange-400 mt-2 hover:underline" onClick={() => void queueAction(r)}>
                Queue for approval
              </button>
            </li>
          ))}
          {recs.length === 0 && <li className="text-slate-500">No rightsizing opportunities detected.</li>}
        </ul>
      </MacGlassPanel>
    </PlatformPageChrome>
  )
}
