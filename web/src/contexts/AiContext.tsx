// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getAiSettings } from '../api/ai'
import { usePlatformInfo } from './PlatformInfoContext'

export type AiMode = 'off' | 'advisor' | 'autopilot_preview' | 'autopilot'

interface AiContextValue {
  mode: AiMode
  copilotOpen: boolean
  setMode: (m: AiMode) => void
  openCopilot: () => void
  closeCopilot: () => void
  toggleCopilot: () => void
  contextVmId: string | null
  setContextVmId: (id: string | null) => void
  contextHostId: string | null
  setContextHostId: (id: string | null) => void
}

const AiContext = createContext<AiContextValue | null>(null)

function parseMode(enabled: boolean, raw: string): AiMode {
  if (!enabled) return 'off'
  if (raw === 'autopilot') return 'autopilot'
  if (raw === 'autopilot_preview') return 'autopilot_preview'
  return 'advisor'
}

export function AiProvider({ children }: { children: React.ReactNode }) {
  const { info } = usePlatformInfo()
  const platform = Boolean(info?.control_plane?.proxy_url)
  const [mode, setMode] = useState<AiMode>('advisor')
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [contextVmId, setContextVmId] = useState<string | null>(null)
  const [contextHostId, setContextHostId] = useState<string | null>(null)

  useEffect(() => {
    if (!platform) {
      setMode('advisor')
      return
    }
    void getAiSettings()
      .then((s) => setMode(parseMode(s.enabled, s.mode)))
      .catch(() => { /* keep default */ })
  }, [platform])

  const openCopilot = useCallback(() => setCopilotOpen(true), [])
  const closeCopilot = useCallback(() => setCopilotOpen(false), [])
  const toggleCopilot = useCallback(() => setCopilotOpen((o) => !o), [])

  const value = useMemo(
    () => ({
      mode,
      copilotOpen,
      setMode,
      openCopilot,
      closeCopilot,
      toggleCopilot,
      contextVmId,
      setContextVmId,
      contextHostId,
      setContextHostId,
    }),
    [mode, copilotOpen, openCopilot, closeCopilot, toggleCopilot, contextVmId, contextHostId],
  )

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>
}

export function useAi() {
  const ctx = useContext(AiContext)
  if (!ctx) throw new Error('useAi requires AiProvider')
  return ctx
}
