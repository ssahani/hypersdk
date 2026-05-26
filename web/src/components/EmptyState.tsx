// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import type { ReactNode } from 'react'

type Props = {
  icon?: ReactNode
  title: string
  description?: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  className?: string
}

/** Centered empty list / zero-data state with optional CTAs. */
export default function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = '',
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-slate-700/50 bg-slate-800/20 ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-md leading-relaxed">{description}</p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
