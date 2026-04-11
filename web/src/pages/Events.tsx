import { useEffect, useState } from 'react'
import { getMetrics, VmMetrics } from '../api/vm'
import { Activity, RefreshCw, Download } from 'lucide-react'
import { downloadJSON, downloadCSV } from '../utils/export'
import { formatBytes } from '../utils/vm'

export default function EventsPage() {
  const [metrics, setMetrics] = useState<VmMetrics[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try { setMetrics(await getMetrics()) } catch { /* no running VMs */ } finally { setLoading(false) }
  }

  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i) }, [])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6" /> Live Metrics</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadJSON(metrics, 'metrics.json')} className="p-2 hover:bg-slate-700 rounded transition" title="Export JSON"><Download className="w-4 h-4" /></button>
          <button onClick={() => downloadCSV(metrics as unknown as Record<string, unknown>[], 'metrics.csv')} className="p-2 hover:bg-slate-700 rounded transition" title="Export CSV"><Download className="w-4 h-4 text-green-400" /></button>
          <button onClick={load} className="p-2 hover:bg-slate-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-12 text-center text-slate-500">No running VMs with metrics.</div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 text-left text-sm text-slate-400">
                <th className="px-6 py-3">VM</th>
                <th className="px-6 py-3">Memory</th>
                <th className="px-6 py-3 hidden md:table-cell">Disk Read</th>
                <th className="px-6 py-3 hidden md:table-cell">Disk Write</th>
                <th className="px-6 py-3 hidden lg:table-cell">Net RX</th>
                <th className="px-6 py-3 hidden lg:table-cell">Net TX</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {metrics.map((m) => (
                <tr key={m.name} className="hover:bg-slate-700/50">
                  <td className="px-6 py-3 font-medium">{m.name}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-700 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${m.memory_pct}%` }} /></div>
                      <span className="text-sm text-slate-400">{m.memory_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-300 hidden md:table-cell">{formatBytes(m.disk_rd_bytes)}</td>
                  <td className="px-6 py-3 text-sm text-slate-300 hidden md:table-cell">{formatBytes(m.disk_wr_bytes)}</td>
                  <td className="px-6 py-3 text-sm text-slate-300 hidden lg:table-cell">{formatBytes(m.net_rx_bytes)}</td>
                  <td className="px-6 py-3 text-sm text-slate-300 hidden lg:table-cell">{formatBytes(m.net_tx_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
