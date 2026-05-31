// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState, type ReactNode } from 'react'

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function recordEntries(data: Record<string, unknown>, max = 12): Array<[string, unknown]> {
  return Object.entries(data)
    .filter(([k]) => !k.startsWith('_'))
    .slice(0, max)
}

export default function JsonInspector({
  data,
  children,
  emptyMessage = 'No data.',
  className = '',
}: {
  data: unknown
  children?: ReactNode
  emptyMessage?: string
  className?: string
}) {
  const [raw, setRaw] = useState(false)
  if (data == null) return <p className="text-sm text-slate-500">{emptyMessage}</p>

  return (
    <div className={`space-y-3 ${className}`}>
      {!raw && (children ?? (
        <dl className="grid gap-2 sm:grid-cols-2 text-sm">
          {recordEntries(asRecord(data) ?? { value: data }).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/[0.06] bg-slate-950/30 px-3 py-2">
              <dt className="text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}</dt>
              <dd className="text-slate-200 mt-0.5 break-words">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      ))}
      {raw && (
        <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-96 bg-slate-950/50 rounded-lg p-3 border border-white/[0.06]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      <button
        type="button"
        className="text-xs text-blue-400 hover:text-blue-300"
        onClick={() => setRaw((v) => !v)}
      >
        {raw ? 'Hide raw JSON' : 'View raw JSON'}
      </button>
    </div>
  )
}
