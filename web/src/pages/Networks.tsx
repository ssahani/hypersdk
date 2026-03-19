import { useEffect, useState, useCallback } from 'react'
import { listNetworks, startNetwork, stopNetwork, deleteNetwork, setNetworkAutostart, NetworkInfo } from '../api/network'
import { useToastContext } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { Play, Square, Trash2, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'

export default function NetworksPage() {
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const toast = useToastContext()

  const load = useCallback(async () => {
    try { setNetworks(await listNetworks()) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const action = async (name: string, fn: (n: string) => Promise<void>, label: string) => {
    try { await fn(name); toast.success(`${label} '${name}' OK`); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const toggleAutostart = async (net: NetworkInfo) => {
    try { await setNetworkAutostart(net.name, !net.autostart); toast.success(`Autostart ${!net.autostart ? 'enabled' : 'disabled'}`); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await action(deleteTarget, deleteNetwork, 'Delete network')
    setDeleteTarget(null)
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Networks</h1>
        <button onClick={load} className="p-2 hover:bg-gray-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-gray-700 text-left text-sm text-gray-400"><th className="px-6 py-3">Name</th><th className="px-6 py-3">Active</th><th className="px-6 py-3 hidden md:table-cell">Bridge</th><th className="px-6 py-3 hidden md:table-cell">Autostart</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-gray-700">
            {networks.map((net) => (
              <tr key={net.name} className="hover:bg-gray-700/50">
                <td className="px-6 py-3 font-medium">{net.name}</td>
                <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${net.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{net.active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-6 py-3 hidden md:table-cell text-sm text-gray-400">{net.bridge || '-'}</td>
                <td className="px-6 py-3 hidden md:table-cell">
                  <button onClick={() => toggleAutostart(net)} className="flex items-center gap-1">
                    {net.autostart ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                  </button>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {!net.active && <button onClick={() => action(net.name, startNetwork, 'Start network')} className="p-1.5 hover:bg-green-600/20 rounded transition"><Play className="w-4 h-4 text-green-400" /></button>}
                    {net.active && <button onClick={() => action(net.name, stopNetwork, 'Stop network')} className="p-1.5 hover:bg-red-600/20 rounded transition"><Square className="w-4 h-4 text-red-400" /></button>}
                    <button onClick={() => setDeleteTarget(net.name)} className="p-1.5 hover:bg-red-600/20 rounded transition"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={!!deleteTarget} title="Delete Network" message={`Delete network '${deleteTarget}'?`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
