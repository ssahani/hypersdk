// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { MacListRow } from '../../../components/platform/mac/PlatformMacUi'
import SecurityLensLayout from '../../../components/platform/SecurityLensLayout'
import { getFirewallActivity, getFirewallOverview } from '../../../api/zeusFirewall'
import { formatUserError } from '../../../utils/apiError'
import { statusToneClass } from '../../../utils/semanticColors'

type ActivityEvent = Record<string, unknown> & { target?: string; group?: string }

function eventTitle(e: ActivityEvent): string {
  const verdict = e.verdict ?? e.action ?? e.kind
  const port = e.destination_port ?? e.port ?? e.target_port
  const proc = e.process ?? e.process_name
  if (proc && port) return `${String(proc)} · ${String(verdict || 'flow')} port ${port}`
  if (proc) return `${String(proc)} · ${String(verdict || 'flow')}`
  if (port) return `${String(verdict || 'flow')} · port ${port}`
  return String(e.summary ?? e.message ?? verdict ?? 'Network event')
}

function eventSubtitle(e: ActivityEvent): string {
  const domain = e.dns_query ?? e.domain ?? e.destination
  const parts = [
    e.target,
    e.process ?? e.process_name,
    domain,
    e.source_ip ?? e.source,
    e.destination_ip ?? e.destination,
  ].filter(Boolean)
  return parts.map(String).join(' · ')
}

export default function PlatformFirewallActivity() {
  const [blocked, setBlocked] = useState<ActivityEvent[]>([])
  const [allowed, setAllowed] = useState<ActivityEvent[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const ov = await getFirewallOverview()
      const blockedEv: ActivityEvent[] = []
      const allowedEv: ActivityEvent[] = []
      for (const t of ov.targets) {
        const act = await getFirewallActivity(t.id)
        if (typeof act.note === 'string') setNote(act.note)
        const ev = act.events
        if (!Array.isArray(ev)) continue
        for (const raw of ev) {
          if (!raw || typeof raw !== 'object') continue
          const e = { ...(raw as Record<string, unknown>), target: t.name } as ActivityEvent
          const v = String(e.verdict ?? e.action ?? '').toLowerCase()
          if (v.includes('drop') || v.includes('block') || v.includes('deny')) {
            blockedEv.push({ ...e, group: 'blocked' })
          } else {
            allowedEv.push({ ...e, group: 'allowed' })
          }
        }
      }
      setBlocked(blockedEv)
      setAllowed(allowedEv)
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const totalEvents = blocked.length + allowed.length

  return (
    <SecurityLensLayout
      testId="platform-firewall-activity-page"
      backHref="/platform/zeus/security"
      backLabel="Security Center"
      title="Firewall Activity"
      subtitle={`${blocked.length} blocked · ${allowed.length} allowed connection events`}
      icon={<Shield className="w-6 h-6 text-slate-400" />}
      loading={loading && totalEvents === 0}
      error={error}
      onRefresh={() => void load()}
      stats={[
        { label: 'Blocked', value: String(blocked.length), tone: blocked.length > 0 ? 'warn' : 'default', icon: <Shield className="w-4 h-4" /> },
        { label: 'Allowed', value: String(allowed.length), tone: allowed.length > 0 ? 'ok' : 'default' },
        { label: 'Total events', value: String(totalEvents) },
      ]}
      panelTitle="Today"
      isEmpty={totalEvents === 0}
      emptyTitle="No connection events yet"
      emptySubtitle="Enable PacketWolf for live blocked flows and connection telemetry."
    >
      <p className="text-xs text-slate-500 mb-4">{note || 'PacketWolf provides live flows when connected'}</p>
      <div className="space-y-4">
        {blocked.length > 0 && (
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 px-1 ${statusToneClass('error')}`}>Blocked</p>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {blocked.slice(0, 25).map((e, i) => (
                <MacListRow key={`b-${i}`} title={eventTitle(e)} subtitle={eventSubtitle(e)} />
              ))}
            </div>
          </div>
        )}
        {allowed.length > 0 && (
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 px-1 ${statusToneClass('ok')}`}>Allowed</p>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {allowed.slice(0, 15).map((e, i) => (
                <MacListRow key={`a-${i}`} title={eventTitle(e)} subtitle={eventSubtitle(e)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </SecurityLensLayout>
  )
}
