// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Gauge, Loader2, RefreshCw } from 'lucide-react'
import { getOpenStackQuotas } from '../api/openstackExtras'
import { parseQuotaRows, parseNeutronQuotaRows, type QuotaRow } from '../utils/openstackQuotas'
import { formatUserError } from '../utils/apiError'

type Props = {
  compact?: boolean
}

function QuotaTable({ title, rows }: { title: string; rows: QuotaRow[] }) {
  if (rows.length === 0) return null
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-400 text-left">
            <tr>
              <th className="px-3 py-2">Resource</th>
              <th className="px-3 py-2">Used</th>
              <th className="px-3 py-2">Limit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-3 py-2 text-slate-300">{r.label}</td>
                <td className="px-3 py-2 font-mono text-slate-400">{r.used}</td>
                <td className="px-3 py-2 font-mono text-slate-400">
                  {r.max >= 0 ? r.max : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function OpenStackQuotasPanel({ compact }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [computeRows, setComputeRows] = useState<QuotaRow[]>([])
  const [cinderRows, setCinderRows] = useState<QuotaRow[]>([])
  const [neutronRows, setNeutronRows] = useState<QuotaRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { quotas } = await getOpenStackQuotas()
      setComputeRows(parseQuotaRows(quotas.compute))
      setCinderRows(quotas.cinder ? parseQuotaRows(quotas.cinder) : [])
      setNeutronRows(quotas.neutron ? parseNeutronQuotaRows(quotas.neutron) : [])
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section
      className={`rounded-xl border border-slate-700/50 bg-slate-800/30 ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <Gauge className="w-4 h-4 text-sky-400" />
          Project quotas
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-600 text-xs text-slate-400 hover:bg-slate-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
          Loading quotas…
        </div>
      )}
      {error && !loading && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {!loading && !error && computeRows.length === 0 && cinderRows.length === 0 && neutronRows.length === 0 && (
        <p className="text-sm text-slate-500">No quota data returned.</p>
      )}
      {!loading && !error && (computeRows.length > 0 || cinderRows.length > 0 || neutronRows.length > 0) && (
        <div className={compact ? 'space-y-4' : 'grid gap-6 lg:grid-cols-3'}>
          <QuotaTable title="Nova" rows={computeRows} />
          <QuotaTable title="Cinder" rows={cinderRows} />
          <QuotaTable title="Neutron" rows={neutronRows} />
        </div>
      )}
    </section>
  )
}
