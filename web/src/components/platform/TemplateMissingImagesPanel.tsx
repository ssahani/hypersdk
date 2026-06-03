// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { Download, HardDrive } from 'lucide-react'
import type { MissingTemplateImage } from '../../api/platform'
import { hubLinkClasses } from '../../utils/semanticColors'

type Props = {
  summary: string
  missing: MissingTemplateImage[]
}

export default function TemplateMissingImagesPanel({ summary, missing }: Props) {
  if (missing.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <HardDrive className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-100">Marketplace golden images</p>
          <p className="text-xs text-amber-200/80 mt-0.5">{summary}</p>
        </div>
      </div>
      <ul className="text-xs space-y-1.5 max-h-32 overflow-y-auto">
        {missing.slice(0, 8).map((m) => (
          <li key={`${m.name}@${m.version}`} className="flex items-center justify-between gap-2">
            <span className="text-slate-200 truncate">
              {m.icon ? `${m.icon} ` : ''}{m.name}
              <span className="text-slate-500"> @{m.version}</span>
            </span>
            {m.auto_fetch ? (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-emerald-300/90">
                <Download className="w-3 h-3" /> auto on create
              </span>
            ) : (
              <span className="shrink-0 text-amber-300/70">upload required</span>
            )}
          </li>
        ))}
      </ul>
      <Link to="/platform/templates" className={`text-xs ${hubLinkClasses()}`}>
        Open Templates →
      </Link>
    </div>
  )
}
