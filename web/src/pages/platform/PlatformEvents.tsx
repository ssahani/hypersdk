// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { ScrollText, RefreshCw } from 'lucide-react'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import { listAuditLogs, listPlatformEvents, type AuditLog, type PlatformEvent } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'

export default function PlatformEvents() {
  const [events, setEvents] = useState<PlatformEvent[]>([])
  const [audit, setAudit] = useState<AuditLog[]>([])
  const [kind, setKind] = useState('')
  const [actor, setActor] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [ev, au] = await Promise.all([
        listPlatformEvents(kind || undefined),
        listAuditLogs({ actor: actor || undefined }),
      ])
      setEvents(ev)
      setAudit(au)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [kind, actor])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <MacSectionTitle title="Events & Audit" subtitle="Platform activity stream" />
        <button type="button" className="btn-secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4" /></button>
      </header>
      {error && <ErrorBanner message={error} />}
      <input className="input max-w-xs" placeholder="Filter events by kind" value={kind} onChange={(e) => setKind(e.target.value)} />
      <input className="input max-w-xs" placeholder="Filter audit by actor" value={actor} onChange={(e) => setActor(e.target.value)} />
      <section className="card p-4">
        <h2 className="font-semibold mb-3">Events</h2>
        <ul className="space-y-2 text-sm text-slate-400">{events.map((e) => (
          <li key={e.id}><span className="text-slate-300">{e.kind}</span> — {e.message}</li>
        ))}</ul>
      </section>
      <section className="card p-4">
        <h2 className="font-semibold mb-3">Audit log</h2>
        <ul className="space-y-2 text-sm text-slate-400">{audit.map((a) => (
          <li key={a.id}><span className="text-slate-300">{a.actor}</span> {a.action} {a.resource_type || ''}</li>
        ))}</ul>
      </section>
    </div>
  )
}
