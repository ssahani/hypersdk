// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useRef, type ReactNode } from 'react'

export default function PlatformMacMenuDropdown({
  label,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, onClose])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`mac-menu-item px-2.5 py-1 rounded-md text-sm ${open ? 'mac-menu-item-active' : ''}`}
      >
        {label}
      </button>
      {open ? (
        <div className="mac-menu-panel absolute left-0 top-full mt-1 min-w-[220px] py-1 z-[300]">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function PlatformMacMenuItem({
  label,
  onClick,
  shortcut,
  checked,
  disabled,
}: {
  label: string
  onClick?: () => void
  shortcut?: string
  checked?: boolean
  disabled?: boolean
}) {
  const cls =
    'flex w-full items-center justify-between gap-4 px-3 py-1.5 text-sm text-left hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      <span className="flex items-center gap-2 min-w-0">
        <span className="w-3 shrink-0 text-xs text-sky-300">{checked ? '✓' : ''}</span>
        <span className="truncate">{label}</span>
      </span>
      {shortcut ? <span className="text-xs text-white/40 shrink-0">{shortcut}</span> : null}
    </button>
  )
}
