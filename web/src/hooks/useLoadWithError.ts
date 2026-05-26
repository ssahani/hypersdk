// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useCallback, useState } from 'react'
import { formatUserError } from '../utils/apiError'

/** Standard page load with `loadError` string for ErrorBanner. */
export function useLoadWithError() {
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const wrapLoad = useCallback(<T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setLoadError(null)
    return fn()
      .then((v) => {
        setLoadError(null)
        return v
      })
      .catch((e: unknown) => {
        setLoadError(formatUserError(e))
        return undefined
      })
      .finally(() => setLoading(false))
  }, [])

  return { loadError, setLoadError, loading, setLoading, wrapLoad }
}
