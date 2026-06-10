// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { explainInfraObject } from '../../api/ai'
import { hubLinkClasses, statusToneClass } from '../../utils/semanticColors'

export default function MachinaExplainObjectPanel({
  kind,
  id,
  name,
  onClose,
  showOpenLink = true,
}: {
  kind: string
  id: string
  name?: string
  onClose?: () => void
  showOpenLink?: boolean
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof explainInfraObject>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await explainInfraObject(kind, id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Explain failed')
    } finally {
      setLoading(false)
    }
  }, [kind, id])

  useEffect(() => { void load() }, [load])

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-orange-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          {name ?? data?.name ?? id}
          <span className="text-xs text-slate-500 font-normal">{kind}</span>
        </p>
        {onClose && (
          <button type="button" className="text-xs text-slate-500 hover:text-slate-300" onClick={onClose}>Close</button>
        )}
      </div>
      {loading && <p className="text-xs text-slate-500">Loading object explain…</p>}
      {error && <p className={`text-xs ${statusToneClass('error')}`}>{error}</p>}
      {data && (
        <>
          <p className="text-slate-300">{data.purpose}</p>
          {data.health_score != null && (
            <p className="text-xs text-slate-500">Health {data.health_score}/100</p>
          )}
          {data.risks.length > 0 && (
            <ul className="text-xs text-amber-200/90 space-y-0.5">
              {data.risks.map((r) => <li key={r}>⚠ {r}</li>)}
            </ul>
          )}
          {showOpenLink && kind === 'vm' && (
            <Link to={`/platform/vms/${id}`} className={`text-xs ${hubLinkClasses()}`}>Open VM →</Link>
          )}
          {showOpenLink && kind === 'host' && (
            <Link to={`/platform/hosts/${id}`} className={`text-xs ${hubLinkClasses()}`}>Open host →</Link>
          )}
        </>
      )}
    </div>
  )
}
