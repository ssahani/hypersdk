// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

const KEY = 'machina_pinned_vms'

export function getPinnedVMs(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : []
  } catch { return [] }
}

export function isPinned(name: string): boolean {
  return getPinnedVMs().includes(name)
}

export function togglePin(name: string) {
  const list = getPinnedVMs()
  const idx = list.indexOf(name)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(name)
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function removePinnedVMs(names: string[]) {
  if (!names.length) return
  const drop = new Set(names)
  const next = getPinnedVMs().filter((n) => !drop.has(n))
  localStorage.setItem(KEY, JSON.stringify(next))
}
