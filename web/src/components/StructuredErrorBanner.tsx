// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { AlertCircle } from 'lucide-react'

export interface StructuredPlatformError {
  message: string
  error_code?: string
  remediation?: string
}

export function StructuredErrorBanner({ error }: { error: StructuredPlatformError | string | null }) {
  if (!error) return null
  const e = typeof error === 'string' ? { message: error } : error
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm space-y-2">
      <div className="flex gap-2 items-start text-red-200">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          {e.error_code && (
            <p className="text-xs uppercase tracking-wide text-red-400/80 mb-1">{e.error_code.replace(/_/g, ' ')}</p>
          )}
          <p>{e.message}</p>
        </div>
      </div>
      {e.remediation && (
        <p className="text-slate-400 pl-7 text-xs">
          <span className="text-slate-500">Remediation:</span> {e.remediation}
        </p>
      )}
    </div>
  )
}
