// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type ConsoleExperienceMode = 'cinema' | 'studio' | 'mission'

const MODE_PREF_PREFIX = 'machina-console-mode:'

export function parseConsoleMode(search: string): ConsoleExperienceMode {
  const m = new URLSearchParams(search).get('mode')
  if (m === 'studio' || m === 'mission') return m
  return 'cinema'
}

/** When URL has no `mode` param, restore the operator's last choice for this VM. */
export function resolveConsoleMode(search: string, vmId?: string | null): ConsoleExperienceMode {
  const params = new URLSearchParams(search)
  if (params.has('mode')) return parseConsoleMode(search)
  if (vmId) {
    const saved = loadConsoleModePreference(vmId)
    if (saved) return saved
  }
  return 'cinema'
}

export function loadConsoleModePreference(vmId: string): ConsoleExperienceMode | null {
  try {
    const raw = localStorage.getItem(`${MODE_PREF_PREFIX}${vmId}`)
    if (raw === 'cinema' || raw === 'studio' || raw === 'mission') return raw
  } catch {
    /* ignore */
  }
  return null
}

export function saveConsoleModePreference(vmId: string, mode: ConsoleExperienceMode): void {
  try {
    localStorage.setItem(`${MODE_PREF_PREFIX}${vmId}`, mode)
  } catch {
    /* quota */
  }
}

export function consoleModeSearchParam(mode: ConsoleExperienceMode): string {
  if (mode === 'cinema') return ''
  return `mode=${mode}`
}

export function isDisplayProtocol(protocol: string): boolean {
  return (
    protocol === 'novnc'
    || protocol === 'spice'
    || protocol === 'webrtc_spice'
    || protocol.startsWith('guacamole_vnc')
    || protocol.startsWith('guacamole_rdp')
  )
}

export function cinemaHubPath(vmId: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra ?? {})
  if (!params.has('mode')) params.set('mode', 'cinema')
  const q = params.toString()
  return `/platform/vms/${vmId}/consolehub${q ? `?${q}` : ''}`
}

export function studioHubPath(vmId: string, extra?: Record<string, string>): string {
  const q = new URLSearchParams({ mode: 'studio', ...extra })
  return `/platform/vms/${vmId}/consolehub?${q}`
}

export function cinemaPopoutPath(vmId: string, extra?: Record<string, string>): string {
  return cinemaHubPath(vmId, { popout: '1', ...extra })
}
