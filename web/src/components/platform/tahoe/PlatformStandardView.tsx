// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import ErrorBanner from '../../ErrorBanner'
import PlatformTahoeHero from './PlatformTahoeHero'
import type { TahoeStat } from './tahoeTypes'

export interface PlatformStandardViewProps {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
  icon: LucideIcon
  stats?: TahoeStat[]
  badge?: ReactNode
  loading?: boolean
  error?: string | null
  className?: string
  children: ReactNode
}

export default function PlatformStandardView({
  title,
  description,
  eyebrow,
  actions,
  icon,
  stats,
  badge,
  loading = false,
  error = null,
  className = 'space-y-6',
  children,
}: PlatformStandardViewProps) {
  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="tahoe-hero rounded-3xl h-40 border border-white/[0.06]" />
        <div className="tahoe-skeleton-block h-48 rounded-3xl" />
      </div>
    )
  }

  return (
    <div className={`${className} animate-fade-in`}>
      <PlatformTahoeHero
        title={title}
        subtitle={description}
        eyebrow={eyebrow}
        icon={icon}
        actions={actions}
        stats={stats}
        badge={badge}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="tahoe-content">{children}</div>
    </div>
  )
}
