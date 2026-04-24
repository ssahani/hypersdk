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
