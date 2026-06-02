// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Siren } from 'lucide-react'
import PlatformPageChrome, { PlatformRefreshButton } from '../../components/platform/PlatformPageChrome'
import { MacGlassPanel } from '../../components/platform/mac/PlatformMacUi'
import { ackIncident, getActiveIncidents, getIncidentRoom, type ActiveIncident } from '../../api/ai'
import { formatUserError } from '../../utils/apiError'
import { hubLinkClasses } from '../../utils/semanticColors'

export default function PlatformIncidentCommander() {
  const [incidents, setIncidents] = useState<ActiveIncident[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [room, setRoom] = useState<Awaited<ReturnType<typeof getIncidentRoom>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setIncidents(await getActiveIncidents())
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openRoom = async (id: string) => {
    setSelected(id)
    try {
      setRoom(await getIncidentRoom(id))
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }

  const acknowledge = async (id: string) => {
    await ackIncident(id)
    void load()
  }

  return (
    <PlatformPageChrome
      title="Incident Commander"
      subtitle="Correlated war room for infrastructure outages"
      icon={<Siren className="w-6 h-6" />}
      loading={loading}
      error={error}
      actions={<PlatformRefreshButton onClick={() => void load()} />}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <MacGlassPanel title="Active incidents">
          <ul className="space-y-2 text-sm">
            {incidents.map((inc) => (
              <li key={inc.id} className="rounded-lg border border-white/10 p-3">
                <button type="button" className="text-left w-full" onClick={() => void openRoom(inc.id)}>
                  <p className="font-medium text-slate-200">{inc.title}</p>
                  <p className="text-xs text-slate-500">{inc.severity} · {inc.status}</p>
                  <p className="text-xs text-slate-400 mt-1">{inc.summary}</p>
                </button>
                <button type="button" className={`text-xs mt-2 ${hubLinkClasses()}`} onClick={() => void acknowledge(inc.id)}>Acknowledge</button>
              </li>
            ))}
            {incidents.length === 0 && <p className="text-slate-500">No active incidents.</p>}
          </ul>
        </MacGlassPanel>

        {room && selected && (
          <MacGlassPanel title="War room">
            <p className="text-sm text-slate-300">{room.incident.root_cause ?? room.incident.summary}</p>
            <p className="text-xs text-slate-500 mt-2">{room.correlated_count} correlated signals · {room.pending_approvals} pending approvals</p>
            <Link to="/platform/zeus" className={`text-xs mt-2 inline-block ${hubLinkClasses()}`}>Open Zeus approvals →</Link>
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto text-xs font-mono">
              {room.timeline.slice(0, 10).map((e, i) => (
                <div key={`${e.at}-${i}`} className="text-slate-400">[{e.source}] {e.message}</div>
              ))}
            </div>
            {room.runbook_steps.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-400 mb-1">Runbook</p>
                <ol className="text-xs text-slate-500 list-decimal list-inside space-y-1">
                  {room.runbook_steps.slice(0, 5).map((s) => <li key={s}>{s}</li>)}
                </ol>
              </div>
            )}
          </MacGlassPanel>
        )}
      </div>
    </PlatformPageChrome>
  )
}
