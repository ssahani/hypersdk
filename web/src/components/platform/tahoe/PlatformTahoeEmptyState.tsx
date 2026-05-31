// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface PlatformTahoeEmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  primaryAction?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
  hint?: ReactNode
  children?: ReactNode
}

export default function PlatformTahoeEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  hint,
  children,
}: PlatformTahoeEmptyStateProps) {
  return (
    <div className="tahoe-empty relative overflow-hidden rounded-3xl border border-white/[0.08] px-6 py-16 text-center sm:px-10 sm:py-20">
      <div className="tahoe-empty-orb" aria-hidden />
      <div className="relative z-10 mx-auto max-w-md">
        <div className="tahoe-empty-icon mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
          <Icon className="h-8 w-8 text-sky-200" strokeWidth={1.5} />
        </div>
        <h2 className="mt-6 text-xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/50">{description}</p>
        {(primaryAction || secondaryAction) && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {primaryAction ? (
              <button type="button" onClick={primaryAction.onClick} className="tahoe-btn-primary">
                {primaryAction.label}
              </button>
            ) : null}
            {secondaryAction ? (
              <button type="button" onClick={secondaryAction.onClick} className="tahoe-btn-ghost">
                {secondaryAction.label}
              </button>
            ) : null}
          </div>
        )}
        {children ? <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
        {hint ? <div className="mt-6 text-xs text-white/35">{hint}</div> : null}
      </div>
    </div>
  )
}
