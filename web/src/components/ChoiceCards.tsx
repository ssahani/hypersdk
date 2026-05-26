// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Accent used for selected state (ring + border + tint). */
export type ChoiceTone = 'blue' | 'amber' | 'sky' | 'cyan' | 'purple' | 'emerald' | 'slate' | 'violet'

const selectedClass: Record<ChoiceTone, string> = {
  blue: 'border-blue-500 bg-blue-950/35 ring-2 ring-blue-500/80 shadow-lg shadow-blue-900/20',
  amber: 'border-amber-500 bg-amber-950/25 ring-2 ring-amber-500/80 shadow-lg shadow-amber-900/15',
  sky: 'border-sky-500 bg-sky-950/30 ring-2 ring-sky-500/70 shadow-md shadow-sky-950/20',
  cyan: 'border-cyan-500 bg-cyan-950/25 ring-2 ring-cyan-500/70',
  purple: 'border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/70 shadow-md shadow-purple-950/20',
  emerald: 'border-emerald-500 bg-emerald-950/25 ring-2 ring-emerald-500/70',
  slate: 'border-slate-400 bg-slate-800/80 ring-2 ring-slate-400/60',
  violet: 'border-violet-500 bg-violet-950/30 ring-2 ring-violet-500/70',
}

const iconSelectedClass: Record<ChoiceTone, string> = {
  blue: 'bg-blue-600/30 text-blue-300',
  amber: 'bg-amber-600/30 text-amber-100',
  sky: 'bg-sky-600/40 text-sky-200',
  cyan: 'bg-cyan-600/30 text-cyan-200',
  purple: 'bg-purple-600/35 text-purple-200',
  emerald: 'bg-emerald-600/30 text-emerald-200',
  slate: 'bg-slate-500/40 text-slate-100',
  violet: 'bg-violet-600/35 text-violet-200',
}

const iconIdleClass: Record<ChoiceTone, string> = {
  blue: 'bg-slate-700/80 text-slate-300',
  amber: 'bg-slate-600 text-amber-100',
  sky: 'bg-slate-700/80 text-slate-300',
  cyan: 'bg-slate-600 text-slate-200',
  purple: 'bg-slate-700/80 text-slate-300',
  emerald: 'bg-slate-700/80 text-slate-300',
  slate: 'bg-slate-700/80 text-slate-300',
  violet: 'bg-slate-700/80 text-slate-300',
}

const baseUnselected = 'border-slate-600 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-800/50'

const baseButton =
  'rounded-xl border text-left transition flex flex-col gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-45 disabled:pointer-events-none'

export function ChoiceCardGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`.trim()}>{children}</div>
}

/** Denser grid for many options (e.g. settings / VM detail tabs). */
export function ChoiceCardDenseGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 ${className}`.trim()}>{children}</div>
  )
}

/** Same shell as an idle choice card, for navigation (e.g. NodeInfo quick links). */
export function ChoiceLinkCard({
  to,
  icon,
  title,
  description,
  className = '',
}: {
  to: string
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={`${baseButton} p-3 gap-2 ${baseUnselected} hover:border-blue-500/45 hover:bg-slate-800/55 ${className}`.trim()}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/80 text-blue-300">{icon}</span>
        {title}
      </span>
      {description ? <span className="text-xs text-slate-500 leading-snug">{description}</span> : null}
    </Link>
  )
}

export function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  description,
  tone,
  disabled,
  compact,
  largeIcon,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  tone: ChoiceTone
  disabled?: boolean
  compact?: boolean
  /** Taller icon tile (e.g. primary flow pickers on Create VM). */
  largeIcon?: boolean
  className?: string
}) {
  const pad = compact ? 'p-2.5 gap-1.5' : 'p-4 gap-2'
  const minh = compact ? '' : 'min-h-[108px]'
  const iconBox = largeIcon ? 'h-10 w-10 shrink-0' : compact ? 'h-8 w-8 shrink-0' : 'h-9 w-9 shrink-0'
  const titleCls = compact ? 'text-sm font-medium text-white' : largeIcon ? 'text-white font-semibold' : 'text-white font-medium'
  const descCls = compact
    ? 'text-[11px] text-slate-500 leading-snug line-clamp-2'
    : largeIcon
      ? 'text-sm text-slate-400 leading-snug'
      : 'text-xs text-slate-500 leading-relaxed'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${baseButton} ${pad} ${minh} ${selected ? selectedClass[tone] : baseUnselected} ${className}`.trim()}
    >
      <span className={`flex items-center gap-2 ${compact ? '' : ''}`}>
        <span
          className={`flex ${iconBox} items-center justify-center rounded-lg ${
            selected ? iconSelectedClass[tone] : iconIdleClass[tone]
          }`}
        >
          {icon}
        </span>
        <span className={titleCls}>{title}</span>
      </span>
      {description ? <span className={descCls}>{description}</span> : null}
    </button>
  )
}
