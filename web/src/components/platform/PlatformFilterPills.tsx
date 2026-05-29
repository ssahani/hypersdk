// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export interface FilterPill {
  id: string
  label: string
  count?: number
}

export default function PlatformFilterPills({
  options,
  value,
  onChange,
}: {
  options: FilterPill[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            value === o.id
              ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
              : 'bg-slate-900/60 text-slate-400 border border-white/[0.06] hover:border-white/10'
          }`}
        >
          {o.label}
          {o.count != null && <span className="ml-1 opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
