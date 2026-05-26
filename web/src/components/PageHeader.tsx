// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

type Props = {
  title: string
  subtitle?: string
  icon?: ReactNode
  onRefresh?: () => void
  refreshing?: boolean
  actions?: ReactNode
}

/** Standard page title row (non-Hero pages). */
export default function PageHeader({
  title,
  subtitle,
  icon,
  onRefresh,
  refreshing,
  actions,
}: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-100">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5 max-w-2xl">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
        {actions}
      </div>
    </div>
  )
}
