import { useEffect, useState, useCallback } from 'react'
import { getAuditLog, AuditEvent } from '../api/extras'
import { useToastContext } from '../contexts/ToastContext'
import { FileText, RefreshCw, Search, CheckCircle, XCircle } from 'lucide-react'

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const toast = useToastContext()

  const load = useCallback(async () => {
    try {
      setEvents(await getAuditLog())
    } catch (e: unknown) {
      toast.error(`Failed to load audit log: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = events.filter(e =>
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.target.toLowerCase().includes(search.toLowerCase()) ||
    e.result.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-blue-400" /> Audit Log</h1>
          <p className="text-sm text-slate-400 mt-0.5">{events.length} events</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Filter events..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Time</th><th className="px-6 py-3">Action</th><th className="px-6 py-3">Target</th><th className="px-6 py-3">Result</th></tr></thead>
            <tbody className="divide-y divide-slate-700/30">
              {filtered.map((e, i) => (
                <tr key={i} className="table-row-hover">
                  <td className="px-6 py-2 text-xs text-slate-400 font-mono whitespace-nowrap">{e.timestamp}</td>
                  <td className="px-6 py-2 text-sm font-medium">{e.action}</td>
                  <td className="px-6 py-2 text-sm text-slate-300">{e.target}</td>
                  <td className="px-6 py-2 text-sm">
                    {e.result.includes('ok') || e.result.includes('success')
                      ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" />{e.result}</span>
                      : <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" />{e.result}</span>
                    }
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">{search ? 'No matching events' : 'No audit events recorded yet'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
