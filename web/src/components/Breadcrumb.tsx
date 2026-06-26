// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { Link, useLocation } from 'react-router'
import { ChevronRight, Home } from 'lucide-react'
import { routeLabels } from '../utils/routes'
import { useBreadcrumbNameValue } from '../contexts/BreadcrumbNameContext'

// Matches UUIDs, raw hex IDs, and other non-human-readable path segments
const ID_PATTERN = /^[0-9a-f]{8,}(-[0-9a-f]{4,})*$/i

export default function Breadcrumb() {
  const { pathname } = useLocation()
  const entityName = useBreadcrumbNameValue()

  // Don't render on Dashboard (root)
  if (pathname === '/') return null

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { path: string; label: string }[] = []

  let cumulative = ''
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    cumulative += `/${seg}`
    const isLast = i === segments.length - 1
    const fromRouteLabels = routeLabels[cumulative]
    const label =
      fromRouteLabels ||
      (entityName && ID_PATTERN.test(seg) ? entityName : decodeURIComponent(seg))
    crumbs.push({ path: cumulative, label })
  }

  if (crumbs.length === 0) return null

  return (
    <nav className="liquid-glass-breadcrumb mb-6 flex items-center gap-1.5 text-sm flex-wrap">
      <Link to="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex items-center gap-1">
        <Home className="w-3.5 h-3.5" strokeWidth={1.75} />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.path} className="flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
            {isLast ? (
              <span className="text-[var(--text-primary)] font-medium">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">{crumb.label}</Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
