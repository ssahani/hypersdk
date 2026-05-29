// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MacGlassPanel, MacSectionTitle } from '../../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../../components/ErrorBanner'
import { getFirewallCompliance, exportFirewallSiem } from '../../../api/zeusFirewall'
import { formatUserError } from '../../../utils/apiError'

const REPORTS = [
  'production',
  'public-exposure',
  'ssh-exposure',
  'database-exposure',
  'drift',
  'temporary-access',
]

export default function PlatformFirewallCompliance() {
  const [report, setReport] = useState<Record<string, unknown> | null>(null)
  const [kind, setKind] = useState('production')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await getFirewallCompliance(kind)
      setReport(r)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [kind])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Firewall Compliance" subtitle="Production exposure and segmentation reports" />
      <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400">← Firewall overview</Link>
      {error && <ErrorBanner message={error} />}
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setKind(r)}
            className={`text-xs px-3 py-1.5 rounded-lg ${kind === r ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {r}
          </button>
        ))}
      </div>
      {report && (
        <MacGlassPanel title={`Report: ${kind}`} action={
          <button type="button" className="text-xs text-blue-400" onClick={() => void exportFirewallSiem(168).then((r) => {
            const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'zeus-firewall-siem-export.json'
            a.click()
            URL.revokeObjectURL(url)
          })}>
            Export SIEM JSON
          </button>
        }>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(report, null, 2)}</pre>
        </MacGlassPanel>
      )}
    </div>
  )
}
