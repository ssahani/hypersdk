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

export function statusBadgeClasses(tone: 'ok' | 'warn' | 'error' | 'info' | 'neutral'): string {
  const varName = {
    ok: '--machina-status-ok',
    warn: '--machina-status-warn',
    error: '--machina-status-error',
    info: '--machina-status-info',
    neutral: '--machina-status-neutral',
  }[tone]
  return `bg-[color-mix(in_srgb,var(${varName})_18%,transparent)] text-[var(${varName})]`
}

export function sessionBadgeClasses(extra = ''): string {
  return `px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadgeClasses('warn')} border-[color-mix(in_srgb,var(--machina-status-warn)_20%,transparent)] ${extra}`.trim()
}

export function statusActionLinkClasses(tone: 'ok' | 'warn' | 'error' | 'info' | 'neutral', extra = ''): string {
  return `${statusToneClass(tone)} hover:underline ${extra}`.trim()
}

export function statusDestructiveButtonClasses(extra = ''): string {
  return `inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm ${statusBadgeClasses('error')} ${extra}`.trim()
}

export function vmStateTone(state: string): 'ok' | 'warn' | 'error' | 'info' | 'neutral' {
  const s = state.toLowerCase()
  if (s === 'running' || s === 'active') return 'ok'
  if (s === 'shutoff' || s === 'crashed' || s === 'error') return 'error'
  if (s === 'paused' || s === 'shutting down') return 'warn'
  if (s === 'suspended' || s === 'blocked') return 'info'
  return 'neutral'
}

export function openstackStatusTone(status: string): 'ok' | 'warn' | 'error' | 'info' | 'neutral' {
  const s = status.toUpperCase()
  if (s === 'ACTIVE' || s === 'UP') return 'ok'
  if (s === 'ERROR' || s === 'DOWN') return 'error'
  if (s === 'BUILD' || s === 'BUILDING') return 'info'
  return 'warn'
}

export function k8sPhaseTone(phase: string): 'ok' | 'warn' | 'error' | 'info' | 'neutral' {
  const p = phase.toLowerCase()
  if (p === 'running' || p === 'succeeded' || p === 'bound') return 'ok'
  if (p === 'failed' || p === 'error') return 'error'
  if (p === 'pending' || p === 'containercreating') return 'info'
  if (p === 'warning' || p === 'unknown') return 'warn'
  return 'neutral'
}

export type IntegrationPhase = 'off' | 'needsSetup' | 'needsWire' | 'unreachable' | 'live'

export function integrationPhaseTone(phase: IntegrationPhase): 'ok' | 'warn' | 'error' | 'info' | 'neutral' {
  if (phase === 'live') return 'ok'
  if (phase === 'unreachable') return 'error'
  if (phase === 'needsSetup' || phase === 'needsWire') return 'warn'
  if (phase === 'off') return 'neutral'
  return 'neutral'
}

export function httpStatusTone(code: number): 'ok' | 'warn' | 'error' | 'neutral' {
  if (code >= 500) return 'error'
  if (code >= 400) return 'warn'
  if (code >= 200) return 'ok'
  return 'neutral'
}

export function riskTone(risk: string): 'ok' | 'warn' | 'error' {
  const r = risk.toLowerCase()
  if (r === 'critical') return 'error'
  if (r === 'warning' || r === 'warn') return 'warn'
  return 'ok'
}

export function migrationReadinessTone(status: string): 'ok' | 'warn' | 'error' {
  if (status === 'ready') return 'ok'
  if (status === 'check') return 'warn'
  return 'error'
}

export function webhookDeliveryTone(status: string): 'ok' | 'warn' | 'error' {
  if (status === 'delivered') return 'ok'
  if (status === 'failed') return 'error'
  return 'warn'
}

export function statusPillClasses(tone: 'ok' | 'warn' | 'error' | 'info' | 'neutral'): string {
  const varName = {
    ok: '--machina-status-ok',
    warn: '--machina-status-warn',
    error: '--machina-status-error',
    info: '--machina-status-info',
    neutral: '--machina-status-neutral',
  }[tone]
  return `px-2 py-1 rounded-md border ${statusBadgeClasses(tone)} border-[color-mix(in_srgb,var(${varName})_40%,transparent)]`
}
