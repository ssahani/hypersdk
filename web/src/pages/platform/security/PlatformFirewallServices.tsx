// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MacGlassPanel, MacSectionTitle } from '../../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../../components/ErrorBanner'
import { getFirewallOverview, getFirewallServices, type AllowedService } from '../../../api/zeusFirewall'
import { formatUserError } from '../../../utils/apiError'

export default function PlatformFirewallServices() {
  const [services, setServices] = useState<Array<AllowedService & { target: string; targetId: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const ov = await getFirewallOverview()
      const all: Array<AllowedService & { target: string; targetId: string }> = []
      for (const t of ov.targets) {
        const s = await getFirewallServices(t.id)
        for (const svc of s) {
          all.push({ ...svc, target: t.name, targetId: t.id })
        }
      }
      setServices(all)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Allowed Apps & Services" subtitle="Service-centric firewall view" />
      <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400">← Firewall overview</Link>
      {error && <ErrorBanner message={error} />}
      <MacGlassPanel title="Allowed services">
        <div className="space-y-3">
          {services.map((s) => (
            <div key={`${s.targetId}-${s.name}-${s.port}`} className="rounded-xl border border-white/[0.06] p-4 bg-slate-950/30">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-slate-100">{s.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {s.target} · {s.protocol}/{s.port} · Allowed from: {s.allowed_from}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{String(s.status)}</span>
              </div>
              {s.recommendation && (
                <p className="text-xs text-amber-200/90 mt-2">{s.recommendation}</p>
              )}
            </div>
          ))}
          {services.length === 0 && <p className="text-sm text-slate-500">No services mapped yet</p>}
        </div>
      </MacGlassPanel>
    </div>
  )
}
