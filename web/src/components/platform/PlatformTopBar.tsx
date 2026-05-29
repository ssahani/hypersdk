// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useLocation } from 'react-router'
import { Search } from 'lucide-react'
import { PLATFORM_PAGE_LABELS } from '../../utils/platformNav'

export default function PlatformTopBar() {
  const { pathname } = useLocation()
  const base = pathname.split('/').slice(0, 3).join('/') || '/platform'
  const page = PLATFORM_PAGE_LABELS[pathname] ?? PLATFORM_PAGE_LABELS[base] ?? 'Zyvor Platform'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 px-1 border-b border-white/[0.04] mb-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Zyvor Platform</p>
        <h1 className="text-xl font-semibold text-slate-100 tracking-tight">{page}</h1>
      </div>
      <button
        type="button"
        className="platform-spotlight-hint flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.06] bg-slate-900/50 text-xs text-slate-400 hover:text-slate-200 hover:border-white/10 transition"
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search datacenter</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-500">⌘K</kbd>
      </button>
    </div>
  )
}
