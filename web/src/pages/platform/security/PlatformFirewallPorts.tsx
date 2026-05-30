// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MacGlassPanel, MacListRow, MacSectionTitle } from '../../../components/platform/mac/PlatformMacUi'
import PlatformFilterPills from '../../../components/platform/PlatformFilterPills'
import ErrorBanner from '../../../components/ErrorBanner'
import { explainFirewall, getFirewallOverview, getFirewallPorts, type OpenPort } from '../../../api/zeusFirewall'
import { formatUserError } from '../../../utils/apiError'

function riskClass(risk: string) {
  const r = risk.toLowerCase()
  if (r === 'critical') return 'bg-red-500/20 text-red-300'
  if (r === 'warning') return 'bg-amber-500/20 text-amber-200'
  return 'bg-emerald-500/15 text-emerald-300'
}

export default function PlatformFirewallPorts() {
  const [ports, setPorts] = useState<Array<OpenPort & { target: string; targetId: string }>>([])
  const [filter, setFilter] = useState('all')
  const [explain, setExplain] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const ov = await getFirewallOverview()
      const all: Array<OpenPort & { target: string; targetId: string }> = []
      for (const t of ov.targets) {
        const p = await getFirewallPorts(t.id)
        for (const port of p) {
          all.push({ ...port, target: t.name, targetId: t.id })
        }
      }
      setPorts(all)
      if (ov.targets[0]) {
        const r = await explainFirewall(ov.targets[0].id, 'Summarize open port risk')
        setExplain(r.recommendation)
      }
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = ports.filter((p) => {
    if (filter === 'critical') return String(p.risk).toLowerCase() === 'critical'
    if (filter === 'warning') return String(p.risk).toLowerCase() === 'warning'
    return true
  })

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Open Ports" subtitle="Listening services across the fleet" />
      <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400">← Firewall overview</Link>
      {error && <ErrorBanner message={error} />}
      {explain && (
        <MacGlassPanel title="Zeus insight" subtitle="Exposure recommendation">
          <p className="text-sm text-slate-300">{explain}</p>
        </MacGlassPanel>
      )}
      <PlatformFilterPills
        options={[
          { id: 'all', label: 'All' },
          { id: 'critical', label: 'Critical' },
          { id: 'warning', label: 'Warning' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <MacGlassPanel title={`${filtered.length} open ports`}>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">No ports match this filter.</p>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            {filtered.map((p) => (
              <MacListRow
                key={`${p.targetId}-${p.port}-${p.protocol}`}
                href={`/platform/zeus/security/firewall/${p.targetId}`}
                title={`${p.port}/${p.protocol} · ${p.service_name}`}
                subtitle={`${p.target} · ${p.bind_address}`}
                badge={
                  <span className={`text-xs px-2 py-0.5 rounded-full ${riskClass(String(p.risk))}`}>
                    {String(p.risk)}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </MacGlassPanel>
    </div>
  )
}
