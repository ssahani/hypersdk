// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

/** Semantic status → Tailwind utility classes (Machina color system v1). */

export function statusToneClass(tone: 'ok' | 'warn' | 'error' | 'info' | 'neutral'): string {
  switch (tone) {
    case 'ok':
      return 'text-[var(--machina-status-ok)]'
    case 'warn':
      return 'text-[var(--machina-status-warn)]'
    case 'error':
      return 'text-[var(--machina-status-error)]'
    case 'info':
      return 'text-[var(--machina-status-info)]'
    default:
      return 'text-[var(--machina-status-neutral)]'
  }
}

export function statusBgClass(tone: 'ok' | 'warn' | 'error' | 'info' | 'neutral'): string {
  switch (tone) {
    case 'ok':
      return 'bg-[var(--machina-status-ok)]'
    case 'warn':
      return 'bg-[var(--machina-status-warn)]'
    case 'error':
      return 'bg-[var(--machina-status-error)]'
    case 'info':
      return 'bg-[var(--machina-status-info)]'
    default:
      return 'bg-[var(--machina-status-neutral)]'
  }
}

export function taskStatusTone(status: string): 'ok' | 'warn' | 'error' | 'info' | 'neutral' {
  if (status === 'completed' || status === 'succeeded') return 'ok'
  if (status === 'failed' || status === 'error') return 'error'
  if (status === 'running' || status === 'pending') return 'info'
  return 'neutral'
}

export function hostStateTone(state: string, fenced?: boolean, maintenance?: boolean): 'ok' | 'warn' | 'error' | 'neutral' {
  if (maintenance) return 'warn'
  if (state === 'online' && !fenced) return 'ok'
  if (state === 'offline' || fenced) return 'error'
  return 'neutral'
}
