// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { Plus, X } from 'lucide-react'

export function MacGlassPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`tahoe-glass-card platform-mac-panel ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-white/[0.04]">
          <div>
            {title && <h2 className="font-semibold text-slate-100">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function MacSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-100 tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function MacStatWidget({
  label,
  value,
  icon,
  href,
  tone = 'default',
}: {
  label: string
  value: string
  icon: React.ReactNode
  href?: string
  tone?: 'default' | 'ok' | 'warn'
}) {
  const toneClass =
    tone === 'ok' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-slate-100'
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500 text-xs font-medium">{label}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className={`text-2xl font-semibold mt-2 tracking-tight ${toneClass}`}>{value}</p>
    </>
  )
  const cls = 'platform-mac-stat rounded-2xl border border-white/[0.06] bg-slate-900/50 backdrop-blur-md p-4 hover:border-white/10 transition-all'
  if (href) return <Link to={href} className={`${cls} block`}>{inner}</Link>
  return <div className={cls}>{inner}</div>
}

export function MacSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={`platform-mac-sheet relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl animate-fade-in overflow-hidden`}
        role="dialog"
        aria-modal
        aria-labelledby="mac-sheet-title"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h3 id="mac-sheet-title" className="text-lg font-semibold text-slate-50">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-400" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[min(70vh,640px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

const GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-orange-500 to-rose-600',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
] as const

export function gradientForName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 17) % GRADIENTS.length
  return GRADIENTS[h]!
}

export function LaunchpadAppIcon({
  name,
  icon,
  vmCount,
  gradient,
  selected,
  onClick,
}: {
  name: string
  icon: React.ReactNode
  vmCount?: number
  gradient?: string
  selected?: boolean
  onClick?: () => void
}) {
  const g = gradient ?? gradientForName(name)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`platform-launchpad-icon group flex flex-col items-center gap-2.5 text-center w-full ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`relative w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-[22%] bg-gradient-to-br ${g} shadow-lg shadow-black/30 flex items-center justify-center text-white transition-transform group-hover:scale-105 group-active:scale-95 ${
          selected ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-slate-950' : ''
        }`}
      >
        {icon}
        {vmCount != null && vmCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-slate-950/90 border border-white/20 text-[10px] font-semibold flex items-center justify-center">
            {vmCount}
          </span>
        )}
      </div>
      <span className="text-xs sm:text-sm font-medium text-slate-200 max-w-[7rem] leading-tight line-clamp-2">{name}</span>
    </Tag>
  )
}

export function NewLaunchpadCard({ onClick, label = 'New Application', subtitle = 'Create from VMs' }: { onClick: () => void; label?: string; subtitle?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="platform-launchpad-icon group flex flex-col items-center gap-2.5 text-center w-full"
    >
      <div className="w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-[22%] border-2 border-dashed border-slate-600/80 bg-slate-900/40 flex items-center justify-center text-slate-400 group-hover:border-blue-400/60 group-hover:text-blue-300 group-hover:bg-blue-500/5 transition-all group-hover:scale-105 group-active:scale-95">
        <Plus className="w-8 h-8" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-slate-300 max-w-[7rem] leading-tight">{label}</span>
      <span className="text-[10px] text-slate-500 -mt-1">{subtitle}</span>
    </button>
  )
}

export function PresetTemplateCard({
  name,
  description,
  icon,
  gradient,
  onClick,
}: {
  name: string
  description: string
  icon: React.ReactNode
  gradient: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-slate-800/40 hover:bg-slate-800/70 hover:border-white/10 transition text-left w-full"
    >
      <div className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-md`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100 truncate">{name}</p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
    </button>
  )
}

/** macOS Settings-style toggle switch */
export function MacToggle({
  checked,
  onChange,
  disabled,
  label,
  description,
  id,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
  description?: string
  id?: string
}) {
  const toggleId = id ?? label.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={toggleId} className="text-sm font-medium text-slate-100 cursor-pointer">
          {label}
        </label>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`platform-mac-toggle relative shrink-0 w-11 h-6 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
          checked ? 'bg-emerald-500' : 'bg-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

/** Segmented control (Stealth mode, etc.) */
export function MacSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>}
      <div className="inline-flex p-0.5 rounded-full bg-black/30 border border-white/[0.08] tahoe-segment" role="tablist">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
              value === opt.value
                ? 'tahoe-segment-active text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Settings list row (Security & Privacy style) */
export function MacListRow({
  title,
  subtitle,
  trailing,
  href,
  onClick,
  badge,
}: {
  title: string
  subtitle?: string
  trailing?: React.ReactNode
  href?: string
  onClick?: () => void
  badge?: React.ReactNode
}) {
  const cls =
    'flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition text-left w-full'
  const inner = (
    <>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-100 truncate">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>}
      </div>
      {badge}
      {trailing}
    </>
  )
  if (href) {
    return (
      <Link to={href} className={cls}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}

/** System Settings sidebar + detail layout */
export function MacSettingsPane({
  sections,
  active,
  onSelect,
  title,
  children,
}: {
  sections: Array<{ id: string; label: string; icon?: React.ReactNode }>
  active: string
  onSelect: (id: string) => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-0 min-h-[28rem] rounded-2xl border border-white/[0.06] overflow-hidden bg-slate-950/30">
      <aside className="lg:w-52 shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.06] p-3">
        <h2 className="text-lg font-semibold text-slate-100 px-2 mb-3 hidden lg:block">{title}</h2>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                active === s.id
                  ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 p-5 lg:p-6">{children}</div>
    </div>
  )
}

export function MacSettingsGroup({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6 last:mb-0">
      {title && (
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">{title}</h3>
      )}
      <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 overflow-hidden divide-y divide-white/[0.04]">
        {children}
      </div>
    </section>
  )
}
