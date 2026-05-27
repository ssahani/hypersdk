// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export interface QuotaRow {
  label: string
  used: number
  max: number
}

/** Extract used/max rows from Nova or Cinder limits JSON. */
export function parseQuotaRows(limits: unknown): QuotaRow[] {
  if (!limits || typeof limits !== 'object') return []
  const root = limits as Record<string, unknown>
  const bag =
    root.absolute && typeof root.absolute === 'object'
      ? (root.absolute as Record<string, unknown>)
      : root

  const rows: QuotaRow[] = []
  const seen = new Set<string>()

  for (const [key, val] of Object.entries(bag)) {
    if (typeof val !== 'number') continue
    const usedMatch = key.match(/^total(.+)Used$/i)
    if (usedMatch) {
      const stem = usedMatch[1]
      const maxKey = Object.keys(bag).find(
        (k) => k.toLowerCase() === `maxtotal${stem.toLowerCase()}`,
      )
      const maxVal = maxKey && typeof bag[maxKey] === 'number' ? (bag[maxKey] as number) : -1
      const label = stem.replace(/([A-Z])/g, ' $1').trim()
      rows.push({ label, used: val, max: maxVal })
      seen.add(stem.toLowerCase())
      continue
    }
    const maxMatch = key.match(/^maxTotal(.+)$/i)
    if (maxMatch && !seen.has(maxMatch[1].toLowerCase())) {
      const stem = maxMatch[1]
      const usedKey = Object.keys(bag).find(
        (k) => k.toLowerCase() === `total${stem.toLowerCase()}used`,
      )
      if (!usedKey) {
        rows.push({
          label: stem.replace(/([A-Z])/g, ' $1').trim(),
          used: 0,
          max: val,
        })
      }
    }
  }

  rows.sort((a, b) => a.label.localeCompare(b.label))
  return rows
}

/** Extract used/limit rows from Neutron quota details JSON. */
export function parseNeutronQuotaRows(quotas: unknown): QuotaRow[] {
  if (!quotas || typeof quotas !== 'object') return []
  const root = quotas as Record<string, unknown>
  const bag =
    root.quota && typeof root.quota === 'object'
      ? (root.quota as Record<string, unknown>)
      : root

  const rows: QuotaRow[] = []
  for (const [key, val] of Object.entries(bag)) {
    if (val && typeof val === 'object' && 'used' in val && 'limit' in val) {
      const d = val as { used: number; limit: number }
      rows.push({
        label: key.replace(/_/g, ' '),
        used: d.used,
        max: d.limit,
      })
    } else if (typeof val === 'number') {
      rows.push({ label: key.replace(/_/g, ' '), used: 0, max: val })
    }
  }
  rows.sort((a, b) => a.label.localeCompare(b.label))
  return rows
}
