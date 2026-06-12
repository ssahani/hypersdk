// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { ExternalLink } from 'lucide-react'
import { gradientForName, MacGlassPanel } from '../platform/mac/PlatformMacUi'
import type { LaunchpadApp } from '../../api/launchpad'
import { launchpadStatusLabel, launchpadStatusTone, openLaunchpadApp } from '../../utils/launchpadHelpers'
import { statusToneClass } from '../../utils/semanticColors'

type Props = {
  app: LaunchpadApp
  onInspect?: () => void
}

export default function LaunchpadAppTile({ app, onInspect }: Props) {
  const tone = launchpadStatusTone(app.status) as 'ok' | 'warn' | 'error' | 'neutral'
  const subtitle = app.description?.trim() || app.category || 'Infrastructure app'
  const initial = app.displayName.trim().charAt(0).toUpperCase() || '?'

  return (
    <MacGlassPanel className="launchpad-app-tile h-full" data-testid={`launchpad-tile-${app.slug}`}>
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradientForName(app.displayName)} flex items-center justify-center text-white font-semibold shadow-lg shadow-black/20`}
            aria-hidden
          >
            {initial}
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border border-white/10 ${statusToneClass(tone as 'ok' | 'warn' | 'error' | 'info' | 'neutral')}`}>
            {launchpadStatusLabel(app.status)}
          </span>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-50">{app.displayName}</h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{subtitle}</p>
        </div>
        {app.status === 'broken' && app.statusMessage ? (
          <p className="text-xs text-amber-300/90 line-clamp-2">{app.statusMessage}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="btn-primary text-xs inline-flex items-center gap-1.5"
            onClick={() => void openLaunchpadApp(app)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </button>
          {onInspect ? (
            <button type="button" className="btn-secondary text-xs" onClick={onInspect}>
              Inspect
            </button>
          ) : null}
        </div>
      </div>
    </MacGlassPanel>
  )
}
