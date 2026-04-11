export const stateColors: Record<string, string> = {
  running: 'bg-green-500',
  shutoff: 'bg-red-500',
  paused: 'bg-yellow-500',
  'shutting down': 'bg-orange-500',
  crashed: 'bg-red-700',
  blocked: 'bg-purple-500',
  suspended: 'bg-blue-500',
  unknown: 'bg-slate-500',
}

export function getStateColor(state: string): string {
  return stateColors[state] || stateColors.unknown
}

export function getStateBadgeClasses(state: string): string {
  const map: Record<string, string> = {
    running: 'bg-green-500/20 text-green-400',
    shutoff: 'bg-red-500/20 text-red-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    'shutting down': 'bg-orange-500/20 text-orange-400',
    crashed: 'bg-red-700/20 text-red-400',
    blocked: 'bg-purple-500/20 text-purple-400',
    suspended: 'bg-blue-500/20 text-blue-400',
  }
  return map[state] || 'bg-slate-500/20 text-slate-400'
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}
