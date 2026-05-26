// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useCallback, useEffect, useState } from 'react'
import { getHypersdkStatus, type HypersdkStatus } from '../api/hypersdk'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'

export type HypersdkPhase = 'off' | 'unreachable' | 'live'

export function useHypersdkConnection() {
  const { info, refreshKey } = usePlatformInfo()
  const enabled = Boolean(info?.hypersdk?.enabled)
  const [status, setStatus] = useState<HypersdkStatus | null>(null)
  const [loading, setLoading] = useState(enabled)

  const refresh = useCallback(async (): Promise<HypersdkStatus | null> => {
    if (!enabled) {
      setStatus(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    try {
      const s = await getHypersdkStatus()
      setStatus(s)
      return s
    } catch {
      setStatus(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshKey])

  const phase: HypersdkPhase = !enabled ? 'off' : status?.reachable ? 'live' : 'unreachable'

  return {
    phase,
    enabled,
    status,
    loading,
    refresh,
    baseUrl: status?.base_url || info?.hypersdk?.base_url || '',
  }
}
