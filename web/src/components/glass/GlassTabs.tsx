// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type GlassTab = {
  id: string
  label: string
  disabled?: boolean
}

export type GlassTabsProps = {
  tabs: GlassTab[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function GlassTabs({ tabs, active, onChange, className = '' }: GlassTabsProps) {
  return (
    <div
      className={`inline-flex flex-wrap gap-1 p-1 rounded-liquid glass border border-white/[0.06] ${className}`.trim()}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded-[calc(var(--radius-liquid)-4px)] transition-all ${
            active === tab.id
              ? 'tahoe-segment-active text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
          } ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
