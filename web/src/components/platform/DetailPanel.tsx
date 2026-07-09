// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ReactNode } from 'react'

export interface MetricItem {
  label: string
  value: ReactNode
  span?: boolean
}

export function MetricList({ items }: { items: MetricItem[] }) {
  return (
    <dl className="divide-y divide-white/[0.04] text-xs">
      {items.map((item) =>
        item.span ? (
          <div key={item.label} className="flex flex-col gap-0.5 py-1.5">
            <dt className="text-slate-500">{item.label}</dt>
            <dd className="text-slate-100 min-w-0">{item.value}</dd>
          </div>
        ) : (
          <div key={item.label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-slate-500 shrink-0">{item.label}</dt>
            <dd className="text-slate-100 text-right min-w-0 truncate">{item.value}</dd>
          </div>
        )
      )}
    </dl>
  )
}

interface DetailPanelProps {
  title?: string
  subtitle?: string
  statusBadge?: ReactNode
  footer?: ReactNode
  empty?: boolean
  emptyMessage?: string
  children?: ReactNode
  className?: string
  testId?: string
}

export function DetailPanel({
  title,
  subtitle,
  statusBadge,
  footer,
  empty,
  emptyMessage,
  children,
  className = '',
  testId,
}: DetailPanelProps) {
  if (empty) {
    return (
      <aside
        className={`machine-finder-command-center xl:w-[30rem] shrink-0 rounded-xl border border-white/[0.06] bg-slate-950/50 flex items-center justify-center p-4 ${className}`}
        data-testid={testId}
      >
        <p className="text-sm text-slate-500">{emptyMessage ?? 'Nothing selected'}</p>
      </aside>
    )
  }

  return (
    <aside
      className={`machine-finder-command-center w-full xl:w-[30rem] shrink-0 flex flex-col rounded-xl border border-white/[0.06] bg-slate-950/50 ${className}`}
      data-testid={testId}
    >
      <header className="px-4 py-3 border-b border-white/[0.06] shrink-0 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {title && <h2 className="font-semibold text-white text-sm truncate">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>}
        </div>
        {statusBadge && <div className="shrink-0">{statusBadge}</div>}
      </header>

      <div className="flex-1 p-4 space-y-4 text-sm min-h-0">
        {children}
      </div>

      {footer && (
        <footer className="px-4 py-3 border-t border-white/[0.06] shrink-0">
          {footer}
        </footer>
      )}
    </aside>
  )
}
