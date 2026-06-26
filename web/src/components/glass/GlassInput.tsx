// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { InputHTMLAttributes } from 'react'

export type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
}

export function GlassInput({ label, hint, error, className = '', id, required, ...props }: GlassInputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const errorId = inputId ? `${inputId}-error` : undefined
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      )}
      <input
        id={inputId}
        className={`input-field ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        aria-required={required || undefined}
        required={required}
        {...props}
      />
      {hint && <span className="text-xs text-[var(--text-muted)]">{hint}</span>}
      {error && errorId && <p id={errorId} role="alert" className="text-xs text-red-400 mt-1">{error}</p>}
    </label>
  )
}
