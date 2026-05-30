// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

const KEY = 'machina-finder-inspector-width'
export const FINDER_INSPECTOR_MIN = 220
export const FINDER_INSPECTOR_MAX = 420
const DEFAULT = 280

export function loadFinderInspectorWidth(): number {
  try {
    const n = parseInt(localStorage.getItem(KEY) ?? '', 10)
    if (Number.isFinite(n)) return Math.min(FINDER_INSPECTOR_MAX, Math.max(FINDER_INSPECTOR_MIN, n))
  } catch { /* ignore */ }
  return DEFAULT
}

export function saveFinderInspectorWidth(width: number) {
  localStorage.setItem(KEY, String(width))
}
