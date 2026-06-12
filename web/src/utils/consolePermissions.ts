// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ConsoleHubPlan } from '../api/platform'
import type { SessionRole } from '../api/auth'

export type ConsoleAccessPolicy = {
  readOnly: boolean
  canPower: boolean
  canSnapshot: boolean
  canSendKeys: boolean
  recordingActive: boolean
  watermarkLabel: string | null
  role: SessionRole | string
  spectatorMode: boolean
}

export function permissionsFromPlan(plan: ConsoleHubPlan | null | undefined): Pick<
  ConsoleAccessPolicy,
  'readOnly' | 'canPower' | 'canSnapshot' | 'canSendKeys' | 'role'
> {
  const p = plan?.permissions
  if (!p) {
    return {
      readOnly: false,
      canPower: true,
      canSnapshot: true,
      canSendKeys: true,
      role: 'admin',
    }
  }
  return {
    readOnly: p.read_only,
    canPower: p.can_power,
    canSnapshot: p.can_snapshot,
    canSendKeys: p.can_send_keys,
    role: p.role,
  }
}

export function buildConsoleAccessPolicy(opts: {
  plan?: ConsoleHubPlan | null
  sessionRecording?: boolean
  spectatorValid?: boolean
  spectatorActor?: string | null
  username?: string
}): ConsoleAccessPolicy {
  const perms = permissionsFromPlan(opts.plan)
  const recordingActive = Boolean(
    opts.sessionRecording
    || opts.plan?.session_recording_enabled,
  )
  const readOnly = perms.readOnly || Boolean(opts.spectatorValid)
  const actor = opts.spectatorActor?.trim() || opts.username?.trim() || 'operator'

  let watermarkLabel: string | null = null
  if (opts.spectatorValid) {
    watermarkLabel = `Read-only · ${actor}`
  } else if (recordingActive) {
    watermarkLabel = `Recorded · ${actor}`
  } else if (readOnly) {
    watermarkLabel = `View only · ${actor}`
  }

  return {
    ...perms,
    readOnly,
    canPower: readOnly ? false : perms.canPower,
    canSnapshot: readOnly ? false : perms.canSnapshot,
    canSendKeys: readOnly ? false : perms.canSendKeys,
    recordingActive,
    watermarkLabel,
    spectatorMode: Boolean(opts.spectatorValid),
  }
}
