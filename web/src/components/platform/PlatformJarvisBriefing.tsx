// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Sparkles } from 'lucide-react'
import { useAi } from '../../contexts/AiContext'
import { useFleetDesktop } from '../../hooks/useFleetDesktop'
import { getSreForecast, getZeusSummary } from '../../api/ai'
import { useEffect, useState } from 'react'
import { dispatchOpenMissionControl } from './mac/MissionControlContext'

function greetingName(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function PlatformJarvisBriefing() {
  const { openCopilot } = useAi()
  const { desktop } = useFleetDesktop(true, 90_000)
  const [recommendations, setRecommendations] = useState(0)
  const [healthPct, setHealthPct] = useState<number | null>(null)

  useEffect(() => {
    void Promise.all([
      getSreForecast().catch(() => ({ forecasts: [] })),
      getZeusSummary().catch(() => null),
    ]).then(([sre, zeus]) => {
      setRecommendations((sre.forecasts?.length ?? 0) + (zeus?.highlights?.length ?? 0))
      if (desktop && desktop.hosts_total > 0) {
        setHealthPct(Math.round((desktop.hosts_online / desktop.hosts_total) * 100))
      }
    })
  }, [desktop])

  const hosts = desktop?.hosts_total ?? 0
  const vms = desktop?.vm_count ?? 0
  const failedTasks = desktop?.failed_tasks_24h ?? 0
  const openIssues = (desktop?.slo_breach_count ?? 0) + (desktop?.pressure_hosts ?? 0)
  const alerts = desktop?.unread_notifications ?? 0

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-sky-950/30 p-5 sm:p-6 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/80">Machina Intelligence</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-50 mt-1">{greetingName()}.</h2>
        <p className="text-sm text-slate-400 mt-2">
          {hosts} host{hosts === 1 ? '' : 's'} · {vms} VM{vms === 1 ? '' : 's'}
          {healthPct != null && <> · Infrastructure health {healthPct}%</>}
          {failedTasks > 0 && <> · {failedTasks > 999 ? '999+' : failedTasks} failed task{failedTasks === 1 ? '' : 's'}</>}
          {openIssues > 0 && <> · {openIssues} open issue{openIssues === 1 ? '' : 's'}</>}
          {alerts > 0 && <> · {alerts > 999 ? '999+' : alerts} alert{alerts === 1 ? '' : 's'}</>}
          {recommendations > 0 && <> · {recommendations} recommendation{recommendations === 1 ? '' : 's'}</>}
        </p>
      </div>
      <p className="text-sm text-slate-300">What would you like me to do?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary flex items-center gap-2 text-sm" onClick={openCopilot}>
          <Sparkles className="w-4 h-4" /> Ask Machina
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={dispatchOpenMissionControl}>
          Mission Control
        </button>
      </div>
    </section>
  )
}
