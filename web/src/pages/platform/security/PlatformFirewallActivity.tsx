// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MacGlassPanel, MacSectionTitle } from '../../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../../components/ErrorBanner'
import { getFirewallActivity, getFirewallOverview } from '../../../api/zeusFirewall'
import { formatUserError } from '../../../utils/apiError'

export default function PlatformFirewallActivity() {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const ov = await getFirewallOverview()
      const merged: Array<Record<string, unknown>> = []
      for (const t of ov.targets) {
        const act = await getFirewallActivity(t.id)
        if (typeof act.note === 'string') setNote(act.note)
        const ev = act.events
        if (Array.isArray(ev)) {
          for (const e of ev) {
            if (e && typeof e === 'object') merged.push({ ...e as Record<string, unknown>, target: t.name })
          }
        }
      }
      setEvents(merged)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Firewall Activity" subtitle="Blocked and allowed connections" />
      <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400">← Firewall overview</Link>
      {error && <ErrorBanner message={error} />}
      <MacGlassPanel title="Live activity" subtitle={note || 'PacketWolf provides live blocked flows when connected'}>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No blocked connection events yet. Enable PacketWolf for live scans and probe detection.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {events.map((e, i) => (
              <li key={i} className="border-b border-white/[0.04] pb-2">{JSON.stringify(e)}</li>
            ))}
          </ul>
        )}
      </MacGlassPanel>
    </div>
  )
}
