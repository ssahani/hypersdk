// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react'
import type { VmHardwareCompatReport } from '../../api/platform'
import HardwareApplyBadge from './HardwareApplyBadge'
import { resolveHardwareBadges } from '../../utils/hardwareApplyBadges'

type Props = {
  loading?: boolean
  report: VmHardwareCompatReport | null
  error?: string | null
}

export default function VmHardwareCompatPanel({ loading, report, error }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-slate-900/40 p-3 text-xs text-slate-400 flex items-center gap-2" data-testid="vm-hardware-compat-panel">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking compatibility…
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200" data-testid="vm-hardware-compat-panel">
        {error}
      </div>
    )
  }
  if (!report) return null

  return (
    <div className="rounded-lg border border-white/[0.08] bg-slate-900/40 p-3 space-y-2" data-testid="vm-hardware-compat-panel">
      <div className="flex items-center gap-2">
        {report.ok ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <CircleAlert className="w-4 h-4 text-amber-400" />
        )}
        <p className="text-xs font-medium text-slate-200">
          {report.ok ? 'Compatible with this host' : 'Compatibility issues found'}
        </p>
      </div>
      {report.issues.length === 0 ? (
        <p className="text-xs text-slate-500">No issues detected against domain capabilities.</p>
      ) : (
        <ul className="space-y-2">
          {report.issues.map((issue, idx) => (
            <li key={`${issue.category}-${idx}`} className="text-xs text-slate-300">
              <p>{issue.message}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {resolveHardwareBadges(issue.badges).map((b) => (
                  <HardwareApplyBadge key={b.id} badge={b} compact />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {(() => {
        const modes = report.cpu_modes_supported ?? []
        return modes.length > 0 ? (
          <p className="text-[11px] text-slate-500 pt-1">Host CPU modes: {modes.join(', ')}</p>
        ) : null
      })()}
    </div>
  )
}
