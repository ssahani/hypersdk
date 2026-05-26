// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useCallback, useEffect, useState } from 'react'
import { getK8sContexts } from '../api/k8s'

const STORAGE_KEY = 'machina.k8s.context'

/** Persisted kubectl `--context` for K8s pages (overview, workloads, kata). */
export function useK8sContext() {
  const [context, setContextState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [choices, setChoices] = useState<string[]>([])

  const setContext = useCallback((c: string) => {
    setContextState(c)
    try {
      localStorage.setItem(STORAGE_KEY, c)
    } catch {
      /* ignore */
    }
  }, [])

  const refreshChoices = useCallback(() => {
    void getK8sContexts()
      .then((r) => setChoices(Array.isArray(r.contexts) ? r.contexts : []))
      .catch(() => setChoices([]))
  }, [])

  useEffect(() => {
    refreshChoices()
  }, [refreshChoices])

  const ctxTrim = context.trim() || undefined

  return { context, setContext, choices, refreshChoices, ctxTrim }
}
