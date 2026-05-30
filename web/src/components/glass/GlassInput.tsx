// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { InputHTMLAttributes } from 'react'

export type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
}

export function GlassInput({ label, hint, className = '', id, ...props }: GlassInputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      )}
      <input id={inputId} className={`input-field ${className}`.trim()} {...props} />
      {hint && <span className="text-xs text-[var(--text-muted)]">{hint}</span>}
    </label>
  )
}
