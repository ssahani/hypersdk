// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

const KEY = 'machina_recent_vms'

export function addRecentVM(name: string) {
  const list = getRecentVMs().filter(n => n !== name)
  list.unshift(name)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5)))
}

export function getRecentVMs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch { return [] }
}

export function removeRecentVM(name: string) {
  removeRecentVMs([name])
}

export function removeRecentVMs(names: string[]) {
  if (!names.length) return
  const drop = new Set(names)
  const next = getRecentVMs().filter((n) => !drop.has(n))
  localStorage.setItem(KEY, JSON.stringify(next))
}
