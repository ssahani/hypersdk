// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export function snapshotStateSeverity(state: string): 'ok' | 'warn' | 'error' | 'info' {
  const s = state?.toLowerCase() ?? ''
  if (s === 'error' || s === 'crashed') return 'error'
  if (s === 'blocking' || s === 'paused') return 'warn'
  return 'info'
}
