// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { statusBadgeClasses, statusSurfaceClasses, statusToneClass } from '../../utils/semanticColors'

export default function GuestToolsStrip({
  status,
  guestIp,
  guestHostname,
  onInstall,
  installing,
}: {
  status?: string
  guestIp?: string
  guestHostname?: string
  onInstall?: () => void
  installing?: boolean
}) {
  const healthy = status === 'healthy' || status === 'installed'
  return (
    <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${statusSurfaceClasses(healthy ? 'ok' : 'warn')}`}>
      <div className="flex items-center gap-3">
        {healthy ? <CheckCircle2 className={`w-5 h-5 ${statusToneClass('ok')}`} /> : <AlertTriangle className={`w-5 h-5 ${statusToneClass('warn')}`} />}
        <div>
          <p className="font-medium text-sm">
            Zyvor Guest Tools: {status === 'healthy' ? 'Installed and healthy' : status === 'installed' ? 'Installed' : 'Not installed'}
          </p>
          {(guestIp || guestHostname) && (
            <p className="text-xs text-slate-400 mt-0.5">
              {guestHostname && <span>{guestHostname} · </span>}
              {guestIp && <span>{guestIp}</span>}
            </p>
          )}
          {!healthy && (
            <p className="text-xs text-slate-500 mt-1">Install for graceful shutdown, IP reporting, and app-consistent backups.</p>
          )}
        </div>
      </div>
      {!healthy && onInstall && (
        <button type="button" className="btn-secondary text-xs flex items-center gap-1" disabled={installing} onClick={onInstall}>
          <Download className="w-3 h-3" /> {installing ? 'Installing…' : 'Install tools'}
        </button>
      )}
    </div>
  )
}
