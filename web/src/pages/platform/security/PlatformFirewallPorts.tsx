// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MacGlassPanel, MacSectionTitle } from '../../../components/platform/mac/PlatformMacUi'
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

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Open Ports" subtitle="Exposure scanner across fleet" />
      <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400">← Firewall overview</Link>
      {error && <ErrorBanner message={error} />}
      {explain && (
        <MacGlassPanel title="Zeus AI" subtitle="Exposure insight">
          <p className="text-sm text-slate-300">{explain}</p>
        </MacGlassPanel>
      )}
      <MacGlassPanel title="Listening ports">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-slate-500 text-xs">
              <tr>
                <th className="pb-2">Port</th>
                <th className="pb-2">Service</th>
                <th className="pb-2">Machine</th>
                <th className="pb-2">Bind</th>
                <th className="pb-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p) => (
                <tr key={`${p.targetId}-${p.port}-${p.protocol}`} className="border-t border-white/[0.04]">
                  <td className="py-2 text-slate-200">{p.port}/{p.protocol}</td>
                  <td className="py-2 text-slate-300">{p.service_name}</td>
                  <td className="py-2">
                    <Link className="text-blue-400" to={`/platform/zeus/security/firewall/${p.targetId}`}>{p.target}</Link>
                  </td>
                  <td className="py-2 text-slate-400">{p.bind_address}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${riskClass(String(p.risk))}`}>{String(p.risk)}</span>
                  </td>
                </tr>
              ))}
              {ports.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-slate-500 text-center">No open ports reported</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </MacGlassPanel>
    </div>
  )
}
