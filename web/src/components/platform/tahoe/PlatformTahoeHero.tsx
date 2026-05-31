// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TahoeStat } from './tahoeTypes'

const STAT_TONE: Record<NonNullable<TahoeStat['tone']>, string> = {
  sky: 'tahoe-stat-sky',
  violet: 'tahoe-stat-violet',
  emerald: 'tahoe-stat-emerald',
  amber: 'tahoe-stat-amber',
}

export interface PlatformTahoeHeroProps {
  title: string
  subtitle?: string
  eyebrow?: string
  icon: LucideIcon
  actions?: ReactNode
  stats?: TahoeStat[]
  compact?: boolean
  badge?: ReactNode
}

export default function PlatformTahoeHero({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
  stats,
  compact = false,
  badge,
}: PlatformTahoeHeroProps) {
  return (
    <header
      className={`tahoe-hero relative overflow-hidden rounded-[2rem] border border-white/[0.08] ${
        compact ? 'px-6 py-6 sm:px-7' : 'px-7 py-8 sm:px-9 sm:py-9'
      }`}
    >
      <div className="tahoe-hero-shine" aria-hidden />
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex items-start gap-4">
          <div className="tahoe-icon-badge shrink-0">
            <Icon className="h-7 w-7 text-sky-200" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/90">{eyebrow}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 mt-0.5">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
              {badge}
            </div>
            {subtitle ? (
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/72">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        ) : null}
      </div>

      {stats && stats.length > 0 ? (
        <ul className="relative z-10 mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          {stats.map((s) => (
            <li key={s.label} className={`tahoe-stat-tile ${STAT_TONE[s.tone ?? 'sky']}`}>
              <span className="tahoe-stat-value">{s.value}</span>
              <span className="tahoe-stat-label">{s.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  )
}
