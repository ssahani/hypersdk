// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Phase 57 — intent-first Jarvis shell (minimal sidebar on desktop landing).

import { loadPlatformDesktopTier, type PlatformDesktopTier } from './platformDesktopTier'

export const JARVIS_SHELL_KEY = 'machina-jarvis-shell'
export const JARVIS_SHELL_EVENT = 'machina-jarvis-shell-changed'
export const OPEN_SPOTLIGHT_EVENT = 'machina-open-spotlight'
export const SCROLL_GEOGRAPHY_EVENT = 'machina-scroll-geography'

export function defaultJarvisShellForTier(tier: PlatformDesktopTier): boolean {
  return tier === 'normal'
}

export function loadJarvisShell(tier?: PlatformDesktopTier): boolean {
  try {
    const raw = localStorage.getItem(JARVIS_SHELL_KEY)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return defaultJarvisShellForTier(tier ?? loadPlatformDesktopTier())
}

export function saveJarvisShell(enabled: boolean) {
  localStorage.setItem(JARVIS_SHELL_KEY, enabled ? '1' : '0')
  window.dispatchEvent(new CustomEvent(JARVIS_SHELL_EVENT, { detail: enabled }))
}

export function dispatchOpenSpotlight(prefill?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_SPOTLIGHT_EVENT, { detail: { prefill } }))
}

export function dispatchScrollGeography() {
  window.dispatchEvent(new CustomEvent(SCROLL_GEOGRAPHY_EVENT))
}

export function isJarvisLandingPath(pathname: string): boolean {
  return pathname === '/platform'
}
