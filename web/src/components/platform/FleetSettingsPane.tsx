// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Loader2 } from 'lucide-react'
import { MacGlassPanel } from './mac/PlatformMacUi'
import { useFleetSettings, type FleetSettingsKind } from '../../hooks/useFleetSettings'

const TITLES: Record<FleetSettingsKind, string> = {
  network: 'Fleet network',
  storage: 'Fleet storage',
  console: 'Fleet console',
  updates: 'Fleet updates',
  keychain: 'Fleet keychain',
  users: 'Fleet users',
  shortcuts: 'Fleet shortcuts',
  spaces: 'Fleet spaces',
  general: 'Fleet general',
}

export default function FleetSettingsPane({ kind, enabled = true }: { kind: FleetSettingsKind; enabled?: boolean }) {
  const { data, loading, error } = useFleetSettings(kind, enabled)

  if (!enabled) return null

  const summary = data && typeof data === 'object' && 'summary' in data
    ? String((data as { summary?: string }).summary ?? '')
    : null

  return (
    <MacGlassPanel title={TITLES[kind]} subtitle="Aggregate from /api/v1/fleet/*">
      {loading && (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      )}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {!loading && !error && summary && <p className="text-sm text-slate-300">{summary}</p>}
      {!loading && !error && data && (
        <pre className="mt-3 text-[10px] text-slate-500 overflow-x-auto max-h-32">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </MacGlassPanel>
  )
}
