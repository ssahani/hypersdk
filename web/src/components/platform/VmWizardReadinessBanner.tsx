// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { statusSurfaceClasses } from '../../utils/semanticColors'
import { hubLinkClasses } from '../../utils/semanticColors'

export type TemplateReadiness = {
  disk_exists: boolean
  host_online: number
  cloud_init: boolean
  ready: boolean
  remediation: string
  source_disk: string
}

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
  return (
    <div className={`rounded-xl border p-3 text-sm ${statusSurfaceClasses(readiness.ready ? 'ok' : 'warn')}`}>
      <p className="font-medium flex items-center gap-2">
        {readiness.ready ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {readiness.ready ? 'Ready to deploy' : readiness.host_online === 0 ? 'No online hosts' : 'Missing disk image'}
      </p>
      <p className="text-xs mt-1 opacity-90">{readiness.remediation}</p>
      {!readiness.disk_exists && (
        <p className="text-xs mt-2 font-mono text-slate-400">{readiness.source_disk}</p>
      )}
      {!readiness.ready && (
        <Link to="/platform/content" className={`text-xs hover:underline mt-2 inline-block ${hubLinkClasses()}`}>
          Upload image in Content Library →
        </Link>
      )}
    </div>
  )
}
