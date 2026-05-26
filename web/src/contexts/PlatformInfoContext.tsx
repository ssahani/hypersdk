// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getPlatformInfo, type PlatformInfo } from '../api/system'
import { getAuthProviders, type AuthProviders } from '../api/auth'
import { useEventStream, type MachinaEvent } from '../hooks/useEventStream'

/**
 * Snapshot of "what is this daemon doing right now?" used by the global
 * `<Hero/>` to show capability badges (TLS, OIDC, KubeVirt cluster exec) and
 * by every page to react to broadcast events without polling.
 */
export interface PlatformInfoContextValue {
  info: PlatformInfo | null
  providers: AuthProviders | null
  loading: boolean
  /** Bumps every time the daemon emits an event on `/api/v1/events/stream`. */
  refreshKey: number
  /** Live state of the SSE channel (false during reconnect). */
  liveConnected: boolean
  lastEvent: MachinaEvent | null
}

const DEFAULT: PlatformInfoContextValue = {
  info: null,
  providers: null,
  loading: true,
  refreshKey: 0,
  liveConnected: false,
  lastEvent: null,
}

const PlatformInfoContext = createContext<PlatformInfoContextValue>(DEFAULT)

export function PlatformInfoProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<PlatformInfo | null>(null)
  const [providers, setProviders] = useState<AuthProviders | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([getPlatformInfo(), getAuthProviders()]).then(([pi, ap]) => {
      if (cancelled) return
      setInfo(pi.status === 'fulfilled' ? pi.value : null)
      setProviders(ap.status === 'fulfilled' ? ap.value : null)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const { connected: liveConnected, lastEvent, refreshKey } = useEventStream()

  const value = useMemo<PlatformInfoContextValue>(
    () => ({ info, providers, loading, refreshKey, liveConnected, lastEvent }),
    [info, providers, loading, refreshKey, liveConnected, lastEvent],
  )

  return <PlatformInfoContext.Provider value={value}>{children}</PlatformInfoContext.Provider>
}

export function usePlatformInfo(): PlatformInfoContextValue {
  return useContext(PlatformInfoContext)
}
