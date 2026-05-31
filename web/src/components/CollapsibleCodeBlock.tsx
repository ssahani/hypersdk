// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import CopyButton from './CopyButton'

type Props = {
  title: string
  content: string
  defaultOpen?: boolean
  maxHeight?: string
  className?: string
}

export default function CollapsibleCodeBlock({
  title,
  content,
  defaultOpen = false,
  maxHeight = 'max-h-[40vh]',
  className = '',
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {title}
        </button>
        <CopyButton text={content} label="Copy" className="py-0.5" />
      </div>
      {open && (
        <pre className={`text-[11px] leading-snug font-mono text-slate-200 bg-black/40 border border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all ${maxHeight} overflow-y-auto`}>
          {content || '(no output)'}
        </pre>
      )}
    </div>
  )
}
