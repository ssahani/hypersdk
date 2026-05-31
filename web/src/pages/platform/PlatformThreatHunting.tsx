// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MacGlassPanel, MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import SecurityTimelinePanel from '../../components/platform/SecurityTimelinePanel'
import {
  getFleetSecurityTimeline,
  getSecurityCorrelations,
  nlSecuritySearch,
  reconstructAttack,
  type SecurityEvent,
} from '../../api/zeusSecurity'
import { formatUserError } from '../../utils/apiError'

export default function PlatformThreatHunting() {
  const [timeline, setTimeline] = useState<SecurityEvent[]>([])
  const [correlations, setCorrelations] = useState<Array<Record<string, unknown>>>([])
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<string | null>(null)
  const [attackChain, setAttackChain] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [tl, corr] = await Promise.all([
        getFleetSecurityTimeline(48),
        getSecurityCorrelations(),
      ])
      setTimeline(tl.events ?? [])
      setCorrelations(corr.correlations ?? [])
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Threat hunting" subtitle="Search · timeline · graph · evidence · AI summary" />
      <Link to="/platform/zeus/security" className="text-sm text-blue-400">← Security Center</Link>
      {error && <ErrorBanner message={error} />}

      <MacGlassPanel title="Natural language search" subtitle="Query OpenSearch or in-memory index">
        <div className="flex flex-wrap gap-2">
          <input
            className="input text-sm flex-1 min-w-[14rem]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find every sudo event last week"
          />
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => void nlSecuritySearch(query).then((r) => setSearchHits(`${r.search_query}: ${JSON.stringify(r.results).slice(0, 120)}…`)).catch((e: unknown) => setError(formatUserError(e)))}
          >
            Search
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => void reconstructAttack('h1', 48).then((r) => setAttackChain(r.attack_chain)).catch((e: unknown) => setError(formatUserError(e)))}
          >
            Reconstruct attack (h1)
          </button>
        </div>
        {searchHits && <p className="text-xs text-slate-400 mt-2">{searchHits}</p>}
      </MacGlassPanel>

      <SecurityTimelinePanel events={timeline} />

      {correlations.length > 0 && (
        <MacGlassPanel title="Threat correlations" subtitle="Rule engine findings">
          <ul className="text-sm text-slate-300 space-y-2">
            {correlations.map((c, i) => (
              <li key={i}>
                <span className="text-amber-300">{String(c.severity)}</span> · {String(c.summary)}
                {c.host_id ? (
                  <>
                    {' '}
                    <Link to={`/platform/zeus/machines/${String(c.host_id)}`} className="text-blue-400">
                      {String(c.host_id)}
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </MacGlassPanel>
      )}

      {attackChain && (
        <MacGlassPanel title="AI attack reconstruction" subtitle="Timeline slice">
          <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
            {attackChain.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </MacGlassPanel>
      )}
    </div>
  )
}
