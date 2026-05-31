// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

const ANY_SOURCE = new Set(['any', '0.0.0.0/0', 'anywhere', '*'])

/** Collapse repeated firewall source CIDRs for readable UI. */
export function formatAllowedFrom(raw: string | string[] | null | undefined): string {
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : []

  const unique: string[] = []
  for (const p of parts) {
    if (!unique.some((u) => u.toLowerCase() === p.toLowerCase())) unique.push(p)
  }

  const nonAny = unique.filter((p) => !ANY_SOURCE.has(p.toLowerCase()))
  const hasAny = unique.some((p) => ANY_SOURCE.has(p.toLowerCase()))

  if (hasAny && nonAny.length === 0) return 'Anywhere'
  if (hasAny && nonAny.length > 0) {
    const tail = nonAny.slice(0, 3).join(', ')
    const extra = nonAny.length > 3 ? ` +${nonAny.length - 3} more` : ''
    return `Anywhere, ${tail}${extra}`
  }
  if (nonAny.length === 0) return 'Internal'
  if (nonAny.length <= 4) return nonAny.join(', ')
  return `${nonAny.slice(0, 3).join(', ')} +${nonAny.length - 3} more`
}

export function firewallRiskClass(risk: string): string {
  const r = risk.toLowerCase()
  if (r === 'critical') return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  if (r === 'warning' || r === 'warn') return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
}
