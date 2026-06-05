// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useState } from 'react'
import { Cloud, Loader2, RefreshCw } from 'lucide-react'
import { getVmGuestObservability, type GuestObservabilitySnapshot } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import { statusPillClasses } from '../../utils/semanticColors'

type Props = {
  vmId: string
  className?: string
}

export default function GuestObservabilityStrip({ vmId, className = '' }: Props) {
  const [obs, setObs] = useState<GuestObservabilitySnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getVmGuestObservability(vmId)
      setObs(r as GuestObservabilitySnapshot)
    } catch (e: unknown) {
      setError(formatUserError(e))
      setObs(null)
    } finally {
      setLoading(false)
    }
  }, [vmId])

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-slate-900/40 p-3 text-sm space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Cloud className="w-3.5 h-3.5" /> Live guest observability
        </p>
        <button
          type="button"
          className="btn-secondary text-xs inline-flex items-center gap-1"
          disabled={loading}
          aria-label="Refresh guest observability"
          onClick={() => void refresh()}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      </div>
      {error && <p className="text-xs text-amber-300/90">{error}</p>}
      {!obs && !error && !loading && (
        <p className="text-xs text-slate-500">Pull cloud-init status, filesystems, and sessions directly from the guest agent.</p>
      )}
      {obs && (
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          {obs.cloud_init_status && (
            <div>
              <dt className="text-slate-500">Cloud-init</dt>
              <dd className="text-slate-200 font-mono">{obs.cloud_init_status}</dd>
            </div>
          )}
          {obs.hostname && (
            <div>
              <dt className="text-slate-500">Hostname</dt>
              <dd className="text-slate-200 font-mono">{obs.hostname}</dd>
            </div>
          )}
          {(obs.filesystems?.length ?? 0) > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500 mb-1">Filesystems</dt>
              <dd className="flex flex-wrap gap-1">
                {obs.filesystems!.slice(0, 6).map((fs) => {
                  const pct = fs.total_bytes > 0 ? Math.round((fs.used_bytes / fs.total_bytes) * 100) : 0
                  return (
                    <span key={fs.mountpoint} className={statusPillClasses(pct > 90 ? 'warn' : 'neutral')}>
                      {fs.mountpoint} {pct}%
                    </span>
                  )
                })}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
