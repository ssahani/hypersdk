import { useEffect, useState } from 'react'
import { getMetrics, VmMetrics } from '../api/vm'
import { Activity, RefreshCw } from 'lucide-react'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6" /> Live Metrics</h1>
        <button onClick={load} className="p-2 hover:bg-gray-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {metrics.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center text-gray-500">No running VMs with metrics.</div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                <th className="px-6 py-3">VM</th>
                <th className="px-6 py-3">Memory</th>
                <th className="px-6 py-3 hidden md:table-cell">Disk Read</th>
                <th className="px-6 py-3 hidden md:table-cell">Disk Write</th>
                <th className="px-6 py-3 hidden lg:table-cell">Net RX</th>
                <th className="px-6 py-3 hidden lg:table-cell">Net TX</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {metrics.map((m) => (
                <tr key={m.name} className="hover:bg-gray-700/50">
                  <td className="px-6 py-3 font-medium">{m.name}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-700 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${m.memory_pct}%` }} /></div>
                      <span className="text-sm text-gray-400">{m.memory_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-300 hidden md:table-cell">{formatBytes(m.disk_rd_bytes)}</td>
                  <td className="px-6 py-3 text-sm text-gray-300 hidden md:table-cell">{formatBytes(m.disk_wr_bytes)}</td>
                  <td className="px-6 py-3 text-sm text-gray-300 hidden lg:table-cell">{formatBytes(m.net_rx_bytes)}</td>
                  <td className="px-6 py-3 text-sm text-gray-300 hidden lg:table-cell">{formatBytes(m.net_tx_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
