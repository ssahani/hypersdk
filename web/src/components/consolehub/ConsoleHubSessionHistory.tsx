// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type ConsoleHubSessionRow = {
  session_id: string
  actor: string
  protocol: string
  backend: string
  started_at: string
  ended_at?: string | null
}

type Props = {
  sessions: ConsoleHubSessionRow[]
  loading?: boolean
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function ConsoleHubSessionHistory({ sessions, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-xs text-slate-500">
        Loading session history…
      </div>
    )
  }
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-xs text-slate-500">
        No recorded console sessions for this VM yet.
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800/80 text-xs font-medium text-slate-300">
        Recent sessions
      </div>
      <ul className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto text-xs">
        {sessions.map((s) => (
          <li key={s.session_id} className="px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
            <span className="font-mono text-slate-300">{s.session_id.slice(0, 8)}…</span>
            <span>{s.actor}</span>
            <span>{s.protocol}</span>
            <span className="text-slate-500">{s.backend}</span>
            <span className="text-slate-500">{fmtTime(s.started_at)}</span>
            {s.ended_at ? <span className="text-emerald-400/80">ended</span> : <span className="text-amber-400/80">active</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
