// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { getSession } from '../api/auth'
import { validateConsoleSpectator, type ConsoleHubPlan, type ConsoleHubSessionResponse } from '../api/platform'
import { useAuth } from '../contexts/AuthContext'
import { buildConsoleAccessPolicy, type ConsoleAccessPolicy } from '../utils/consolePermissions'

export function useConsoleAccessPolicy(
  plan: ConsoleHubPlan | null | undefined,
  session: ConsoleHubSessionResponse | null | undefined,
): ConsoleAccessPolicy {
  const { username } = useAuth()
  const location = useLocation()
  const [role, setRole] = useState<string | undefined>()
  const [spectator, setSpectator] = useState<{ valid: boolean; actor?: string }>({ valid: false })

  const search = useMemo(() => new URLSearchParams(location.search), [location.search])
  const spectatorToken = search.get('spectator')
  const spectatorSessionId = search.get('session')

  useEffect(() => {
    void getSession().then((s) => {
      if (s.role) setRole(s.role)
    })
  }, [])

  useEffect(() => {
    if (!spectatorToken || !spectatorSessionId) {
      setSpectator({ valid: false })
      return
    }
    let cancelled = false
    void validateConsoleSpectator(spectatorSessionId, spectatorToken)
      .then((res) => {
        if (!cancelled) {
          setSpectator(res.valid ? { valid: true, actor: res.actor } : { valid: false })
        }
      })
      .catch(() => {
        if (!cancelled) setSpectator({ valid: false })
      })
    return () => {
      cancelled = true
    }
  }, [spectatorSessionId, spectatorToken])

  return buildConsoleAccessPolicy({
    plan: plan
      ? {
          ...plan,
          permissions: plan.permissions ?? {
            role: role ?? 'admin',
            read_only: role === 'readonly',
            can_power: role !== 'readonly',
            can_snapshot: role !== 'readonly',
            can_send_keys: role !== 'readonly',
          },
        }
      : null,
    sessionRecording: session?.recording_enabled,
    spectatorValid: spectator.valid,
    spectatorActor: spectator.actor,
    username,
  })
}
