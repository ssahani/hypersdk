// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Search, Sparkles } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { getJarvisLanding, type SpotlightIntent } from '../../api/ai'
import { useAi } from '../../contexts/AiContext'
import { useFleetDesktop } from '../../hooks/useFleetDesktop'
import { getSreForecast, getZeusSummary } from '../../api/ai'
import { dispatchOpenMissionControl } from './mac/MissionControlContext'
import { dispatchOpenSpotlight, loadJarvisShell } from '../../utils/platformJarvisShell'
import { statusChipClasses } from '../../utils/semanticColors'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'

function greetingName(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function PlatformJarvisBriefing() {
  const navigate = useNavigate()
  const { openCopilot } = useAi()
  const [tier] = usePlatformDesktopTier()
  const jarvisShell = loadJarvisShell(tier)
  const { desktop } = useFleetDesktop(true, 90_000)
  const [recommendations, setRecommendations] = useState(0)
  const [healthPct, setHealthPct] = useState<number | null>(null)
  const [intents, setIntents] = useState<SpotlightIntent[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    void Promise.all([
      getSreForecast().catch(() => ({ forecasts: [] })),
      getZeusSummary().catch(() => null),
      getJarvisLanding().catch(() => ({ intents: [], search_hits: [] })),
    ]).then(([sre, zeus, landing]) => {
      setRecommendations((sre.forecasts?.length ?? 0) + (zeus?.highlights?.length ?? 0))
      setIntents(landing.intents ?? [])
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

  const runIntent = (intent: SpotlightIntent) => {
    if (intent.navigate) {
      navigate(intent.navigate)
      return
    }
    dispatchOpenSpotlight(intent.label)
  }

  const submitQuery = (e: FormEvent) => {
    e.preventDefault()
    dispatchOpenSpotlight(query.trim() || undefined)
    setQuery('')
  }

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-sky-950/30 p-5 sm:p-6 space-y-4"
      data-testid="platform-jarvis-shell"
    >
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
        {jarvisShell && (
          <p className="text-xs text-slate-500 mt-1">Jarvis shell — dock & Spotlight first; sidebar hidden on Normal tier.</p>
        )}
      </div>

      <form onSubmit={submitQuery} className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden />
        <input
          type="search"
          className="input w-full pl-10"
          placeholder="Ask Machina or search fleet… (⌘Space)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Jarvis search"
        />
      </form>

      <p className="text-sm text-slate-300">What would you like me to do?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary flex items-center gap-2 text-sm" onClick={openCopilot}>
          <Sparkles className="w-4 h-4" /> Ask Machina
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={dispatchOpenMissionControl}>
          Mission Control
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => dispatchOpenSpotlight()}>
          Open Spotlight
        </button>
      </div>

      {intents.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {intents.map((intent) => (
            <button
              key={intent.id}
              type="button"
              title={intent.review}
              className={statusChipClasses('info')}
              onClick={() => runIntent(intent)}
            >
              {intent.label}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
