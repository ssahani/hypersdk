// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { statusBadgeClasses, statusBgClass, vmStateTone } from './semanticColors'

export const stateColors: Record<string, string> = {
  running: statusBgClass('ok'),
  shutoff: statusBgClass('error'),
  paused: statusBgClass('warn'),
  'shutting down': statusBgClass('warn'),
  crashed: statusBgClass('error'),
  blocked: statusBgClass('info'),
  suspended: statusBgClass('info'),
  unknown: statusBgClass('neutral'),
}

export function getStateColor(state: string): string {
  return stateColors[state] || stateColors.unknown
}

export function getStateBadgeClasses(state: string): string {
  return statusBadgeClasses(vmStateTone(state))
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

/** Bytes per second for throughput / I/O rates from cumulative counters. */
export function formatThroughput(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}
