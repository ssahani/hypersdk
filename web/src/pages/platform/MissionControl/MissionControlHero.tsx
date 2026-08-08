// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { platformStatSubtitle } from '../../../components/platform/PlatformPageChrome'
import { statusPillClasses } from '../../../utils/semanticColors'
import { formatFleetDisplayTitle } from '../../../utils/fleetDisplayName'
import HostOrb from '../../../components/platform/fleet/HostOrb'
import type { MissionControlFleetState } from './useMissionControlFleet'

type Props = {
  state: MissionControlFleetState
  warnings: number
}

export default function MissionControlHero({ state, warnings }: Props) {
  const { cluster, hosts, running, onlineHosts, storagePct, needsAttention, attentionMode, setAttentionMode } = state
  const fleetTitle = formatFleetDisplayTitle(cluster, hosts)
  const healthy = !state.loading && hosts.length > 0 && warnings === 0 && onlineHosts === hosts.length

  return (
    <header className="mc-hero flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4" data-testid="mission-control-hero">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white truncate">{fleetTitle}</h1>
          <span className={statusPillClasses(state.loading ? 'neutral' : healthy ? 'ok' : 'warn')}>
            {state.loading
              ? 'Loading fleet…'
              : healthy
                ? <><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Healthy</>
                : <><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />{warnings} warning{warnings === 1 ? '' : 's'}</>}
          </span>
          {needsAttention > 0 && (
            <button
              type="button"
              className={`text-xs px-2.5 py-1 rounded-full border ${attentionMode ? 'border-amber-400/50 bg-amber-500/20 text-amber-100' : 'border-white/10 text-slate-400 hover:text-amber-200'}`}
              onClick={() => setAttentionMode(!attentionMode)}
              data-testid="attention-mode-toggle"
            >
              {needsAttention} need attention
            </button>
          )}
        </div>
        <p className="text-sm text-slate-400 mt-2">
          {platformStatSubtitle([
            { label: 'VMs running', value: state.loading ? '—' : String(running) },
            { label: 'Hosts online', value: state.loading ? '—' : `${onlineHosts} / ${hosts.length}` },
            { label: 'Memory used', value: storagePct != null ? `${Math.round(storagePct)}%` : '—' },
            { label: 'Alerts', value: warnings ? String(warnings) : 'None' },
          ])}
        </p>
      </div>
      <HostOrb healthy={healthy} className="hidden xl:block shrink-0 w-24 h-24" />
    </header>
  )
}
