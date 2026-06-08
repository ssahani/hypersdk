// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { vmStatusBadgeClasses, vmStatusDotClass } from './vmVisual'

export function getStateColor(state: string): string {
  return vmStatusDotClass(state)
}

export function getStateBadgeClasses(state: string): string {
  return vmStatusBadgeClasses(state)
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
