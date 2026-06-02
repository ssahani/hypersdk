// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { ChevronDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { MacGlassPanel } from './mac/PlatformMacUi'
import { statusPillClasses } from '../../utils/semanticColors'

const EXPANDED_KEY = 'machina-fleet-insights-expanded'

type PlatformFleetInsightsProps = {
  badgeCount: number
  defaultOpen?: boolean
  children: ReactNode
}

export default function PlatformFleetInsights({
  badgeCount,
  defaultOpen = false,
  children,
}: PlatformFleetInsightsProps) {
  const [open, setOpen] = useState(() => {
    if (badgeCount > 0) return true
    try {
      const raw = localStorage.getItem(EXPANDED_KEY)
      if (raw === '1') return true
      if (raw === '0') return false
    } catch {
      /* ignore */
    }
    return defaultOpen
  })

  useEffect(() => {
    if (badgeCount > 0) setOpen(true)
  }, [badgeCount])

  const toggle = () => {
    setOpen((v) => {
      const next = !v
      try {
        localStorage.setItem(EXPANDED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <MacGlassPanel className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition"
        onClick={toggle}
        aria-expanded={open}
        data-testid="platform-fleet-insights-toggle"
      >
        <div>
          <p className="text-sm font-semibold text-slate-200">Fleet insights</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {badgeCount > 0
              ? `${badgeCount} item${badgeCount === 1 ? '' : 's'} need attention`
              : 'DNA, approvals, posture, and security'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badgeCount > 0 && (
            <span className={statusPillClasses('warn')}>{badgeCount}</span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-0 space-y-4 border-t border-white/[0.04]">{children}</div>}
    </MacGlassPanel>
  )
}
