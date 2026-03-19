import { useEffect, useState, useCallback } from 'react'
import { listPools, listVolumes, startPool, stopPool, refreshPool, deleteVolume, StoragePoolInfo, StorageVolumeInfo } from '../api/storage'
import { useToastContext } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { Play, Square, RefreshCw, Trash2, ArrowLeft, HardDrive } from 'lucide-react'

export default function StoragePage() {
  const [pools, setPools] = useState<StoragePoolInfo[]>([])
  const [volumes, setVolumes] = useState<StorageVolumeInfo[]>([])
  const [selectedPool, setSelectedPool] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ pool: string; vol: string } | null>(null)
  const toast = useToastContext()

  const loadPools = useCallback(async () => {
    try { setPools(await listPools()) } catch (e: unknown) { toast.error(`${e}`) } finally { setLoading(false) }
  }, [toast])

  const loadVolumes = async (pool: string) => {
    try { setVolumes(await listVolumes(pool)); setSelectedPool(pool) } catch (e: unknown) { toast.error(`${e}`) }
  }

  useEffect(() => { loadPools() }, [loadPools])

  const poolAction = async (name: string, fn: (n: string) => Promise<void>, label: string) => {
    try { await fn(name); toast.success(`${label} '${name}' OK`); loadPools() } catch (e: unknown) { toast.error(`${e}`) }
  }

  const handleDeleteVol = async () => {
    if (!deleteTarget) return
    try { await deleteVolume(deleteTarget.pool, deleteTarget.vol); toast.success(`Deleted volume '${deleteTarget.vol}'`); loadVolumes(deleteTarget.pool) } catch (e: unknown) { toast.error(`${e}`) }
    setDeleteTarget(null)
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  if (selectedPool) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedPool(null); setVolumes([]) }} className="p-2 hover:bg-gray-700 rounded transition"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold">Volumes in '{selectedPool}'</h1>
          <button onClick={() => loadVolumes(selectedPool)} className="p-2 hover:bg-gray-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          {volumes.length === 0 ? <div className="p-8 text-center text-gray-500">No volumes</div> : (
            <table className="w-full">
              <thead><tr className="border-b border-gray-700 text-left text-sm text-gray-400"><th className="px-6 py-3">Name</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Capacity</th><th className="px-6 py-3">Used</th><th className="px-6 py-3 hidden lg:table-cell">Path</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-700">
                {volumes.map((v) => (
                  <tr key={v.name} className="hover:bg-gray-700/50">
                    <td className="px-6 py-3 font-medium">{v.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-400">{v.vol_type}</td>
                    <td className="px-6 py-3 text-sm">{v.capacity_gb.toFixed(2)} GB</td>
                    <td className="px-6 py-3 text-sm">{v.allocation_gb.toFixed(2)} GB</td>
                    <td className="px-6 py-3 text-sm text-gray-400 truncate max-w-xs hidden lg:table-cell">{v.path}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => setDeleteTarget({ pool: selectedPool, vol: v.name })} className="p-1.5 hover:bg-red-600/20 rounded transition"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <ConfirmDialog open={!!deleteTarget} title="Delete Volume" message={`Delete volume '${deleteTarget?.vol}'?`} confirmLabel="Delete" onConfirm={handleDeleteVol} onCancel={() => setDeleteTarget(null)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Storage Pools</h1>
        <button onClick={loadPools} className="p-2 hover:bg-gray-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pools.map((pool) => (
          <div key={pool.name} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-cyan-500" />
                <span className="font-semibold">{pool.name}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${pool.state === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{pool.state}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Capacity</span><span>{pool.capacity_gb.toFixed(1)} GB</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Used</span><span>{pool.allocation_gb.toFixed(1)} GB</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Available</span><span>{pool.available_gb.toFixed(1)} GB</span></div>
              {pool.capacity_gb > 0 && (
                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                  <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${(pool.allocation_gb / pool.capacity_gb * 100).toFixed(0)}%` }} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-700">
              <button onClick={() => loadVolumes(pool.name)} className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition text-center">Browse</button>
              {pool.state !== 'running' && <button onClick={() => poolAction(pool.name, startPool, 'Start pool')} className="p-1.5 hover:bg-green-600/20 rounded transition"><Play className="w-4 h-4 text-green-400" /></button>}
              {pool.state === 'running' && (
                <>
                  <button onClick={() => poolAction(pool.name, refreshPool, 'Refresh pool')} className="p-1.5 hover:bg-blue-600/20 rounded transition"><RefreshCw className="w-4 h-4 text-blue-400" /></button>
                  <button onClick={() => poolAction(pool.name, stopPool, 'Stop pool')} className="p-1.5 hover:bg-red-600/20 rounded transition"><Square className="w-4 h-4 text-red-400" /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
