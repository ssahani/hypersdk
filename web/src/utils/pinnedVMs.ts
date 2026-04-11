const KEY = 'virtspawn_pinned_vms'

export function getPinnedVMs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
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
