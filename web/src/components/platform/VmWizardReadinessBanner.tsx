// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { statusSurfaceClasses } from '../../utils/semanticColors'
import { hubLinkClasses } from '../../utils/semanticColors'
import type { TemplateReadiness } from '../../api/platform'

export type { TemplateReadiness }

type Props = {
  loading: boolean
  readiness: TemplateReadiness | null
}

export default function VmWizardReadinessBanner({ loading, readiness }: Props) {
  if (loading) {
    return (
      <p className="text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking template readiness…
      </p>
    )
  }
  if (!readiness) return null

  const pendingFetch = readiness.ready && !readiness.disk_exists && readiness.auto_fetch
  const tone = readiness.ready ? (pendingFetch ? 'info' : 'ok') : 'warn'

  return (
    <div className={`rounded-xl border p-3 text-sm ${statusSurfaceClasses(tone)}`}>
      <p className="font-medium flex items-center gap-2">
        {readiness.ready ? (
          pendingFetch ? <Download className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />
        ) : (
          <AlertTriangle className="w-4 h-4" />
        )}
        {readiness.ready
          ? pendingFetch
            ? 'Will download on first create'
            : 'Ready to deploy'
          : readiness.host_online === 0
            ? 'No online hosts'
            : 'Missing disk image'}
      </p>
      <p className="text-xs mt-1 opacity-90">{readiness.remediation}</p>
      {!readiness.disk_exists && (
        <p className="text-xs mt-2 font-mono text-slate-400 break-all">{readiness.source_disk}</p>
      )}
      {!readiness.ready && !readiness.auto_fetch && (
        <p className="text-xs mt-2 opacity-90">
          This template has no public download URL. Copy the golden image to the path above on an online host (SSH/SCP), or upload via Content Library.
        </p>
      )}
      {!readiness.ready && !readiness.auto_fetch && (
        <Link to="/platform/content" className={`text-xs hover:underline mt-2 inline-block ${hubLinkClasses()}`}>
          Content Library →
        </Link>
      )}
    </div>
  )
}
