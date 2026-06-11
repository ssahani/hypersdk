// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import PlatformPageChrome, { PlatformRefreshButton } from './PlatformPageChrome'
import OperatingSurfaceLayout from './OperatingSurfaceLayout'
import PlatformEmptyState from './PlatformEmptyState'
import { MacGlassPanel, MacStatWidget } from './mac/PlatformMacUi'
import PlatformFilterPills from './PlatformFilterPills'
import { hubLinkClasses } from '../../utils/semanticColors'

type StatItem = {
  label: string
  value: string
  tone?: 'ok' | 'warn' | 'default'
  icon?: ReactNode
}

type FilterOption = { id: string; label: string }

export default function SecurityLensLayout({
  backHref = '/platform/zeus/security/firewall',
  backLabel = 'Firewall',
  title,
  subtitle,
  icon,
  stats,
  insight,
  filters,
  filterValue,
  onFilterChange,
  panelTitle,
  isEmpty,
  emptyTitle,
  emptySubtitle,
  children,
  onRefresh,
  loading,
  error,
  testId,
}: {
  backHref?: string
  backLabel?: string
  title: string
  subtitle?: string
  icon?: ReactNode
  stats?: StatItem[]
  insight?: ReactNode
  filters?: FilterOption[]
  filterValue?: string
  onFilterChange?: (id: string) => void
  panelTitle?: string
  isEmpty?: boolean
  emptyTitle?: string
  emptySubtitle?: string
  children?: ReactNode
  onRefresh: () => void
  loading?: boolean
  error?: string | null
  testId?: string
}) {
  return (
    <PlatformPageChrome
      loading={loading}
      error={error ?? null}
      onErrorRetry={onRefresh}
      prepend={
        <Link to={backHref} className={`text-sm inline-flex items-center gap-1 ${hubLinkClasses()}`}>
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
      }
      title={title}
      subtitle={subtitle}
      icon={icon}
      actions={<PlatformRefreshButton onClick={onRefresh} />}
      contentClassName="space-y-4"
    >
      <OperatingSurfaceLayout testId={testId}>
        {stats && stats.length > 0 && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <MacStatWidget key={s.label} label={s.label} value={s.value} tone={s.tone} icon={s.icon ?? <span className="w-4 h-4" />} />
            ))}
          </div>
        )}
        {insight}
        {filters && filterValue !== undefined && onFilterChange && (
          <PlatformFilterPills options={filters} value={filterValue} onChange={onFilterChange} />
        )}
        {isEmpty && emptyTitle ? (
          <PlatformEmptyState title={emptyTitle} subtitle={emptySubtitle} />
        ) : panelTitle ? (
          <MacGlassPanel title={panelTitle}>{children}</MacGlassPanel>
        ) : (
          children
        )}
      </OperatingSurfaceLayout>
    </PlatformPageChrome>
  )
}
